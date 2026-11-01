/* ======= 荧光图像智能判读 · 可运行示范 =======
   程序生成 365 nm 紫外灯下荧光岩屑图像 → HSV 分割 → 1—4 级有序判读
   物理口径：F = K·I·θ·C；灯管 500 h 衰减约 30%；油性指数 Oc = FAR × V̄ × 100 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI：backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
  function setupCanvas(cv, lw, lh) {
    var dpr = window.devicePixelRatio || 1;
    var ratio = dpr * ((cv.clientWidth || lw) / lw);
    var bw = Math.max(1, Math.round(lw * ratio));
    var bh = Math.max(1, Math.round(lh * ratio));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hsv2rgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    var r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
  }
  function rgbCss(c, a) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')';
  }
  /* 主波长近似：hue 42(黄褐)→≈585 nm；hue 208(蓝白)→≈470 nm */
  function waveOfHue(h) { return Math.round(620 - 0.72 * h); }

  /* ---------- 常量 ---------- */
  var OILS = {
    heavy: { label: '稠油', hue: 42, hueJit: 9, sat: 0.86, bright: 1.00, colorName: '暗黄褐' },
    light: { label: '轻质油', hue: 208, hueJit: 10, sat: 0.46, bright: 0.92, colorName: '蓝白' }
  };
  var LITHS = {
    sand:   { name: '砂岩',     n: 13, rMin: 20, rMax: 40, base: [0.36, 0.31, 0.25] },
    gravel: { name: '含砾砂岩', n: 9,  rMin: 28, rMax: 52, base: [0.39, 0.34, 0.27] },
    muddy:  { name: '泥质砂岩', n: 17, rMin: 14, rMax: 30, base: [0.30, 0.28, 0.25] }
  };
  var LEVEL_NAMES = ['1 级 荧光', '2 级 油迹', '3 级 油斑', '4 级 油浸'];
  var LEVEL_COLORS = ['#8a9298', '#2f7d6b', '#c9a15a', '#b05a51'];
  var BASE_OIL = [0.06, 0.22, 0.45, 0.72];   /* 1—4 级典型荧光面积比 */
  var OC_BOUNDS = [7, 20, 42];               /* 油性指数分级边界（按生成模型标定） */

  var DEF = { depth: 1260, oil: 'heavy', lith: 'sand', lamp: 120, mud: 0, sat: 0.35, val: 0.18 };
  var S = Object.assign({}, DEF);
  var RESEED = 0;

  var IW = 430, IH = 250;   /* 图像画布逻辑尺寸 */
  var HW = 430, HH = 200;   /* 直方图 */
  var PW = 430, PH = 300;   /* 剖面 */

  /* ---------- 井深剖面（确定性生成，800—1600 m，10 m 取样） ---------- */
  var PROF = [];
  (function buildProfile() {
    var rng = mulberry32(20261030);
    var zones = [
      { c: 1225, w: 52, peak: 4 },   /* 主油层：油浸 */
      { c: 1485, w: 42, peak: 3 }    /* 次油层：油斑 */
    ];
    var lith = 'sand', nextFlip = 800 + 30 + rng() * 50;
    for (var d = 800; d <= 1600; d += 10) {
      if (d >= nextFlip) { lith = lith === 'sand' ? 'mud' : 'sand'; nextFlip = d + 25 + rng() * 65; }
      var bump = 1;
      zones.forEach(function (z) {
        var t = (d - z.c) / z.w;
        bump = Math.max(bump, z.peak * Math.exp(-t * t));
      });
      var lvl = clamp(Math.round(bump + (rng() - 0.5) * 0.9), 1, 4);
      if (lith === 'mud' && lvl > 2) lvl = 2;             /* 泥岩段显示变差 */
      var gas = 0.04 * Math.pow(6, lvl - 1) * (0.75 + rng() * 0.5);
      PROF.push({ d: d, lith: lith, lvl: lvl, gas: gas });
    }
  })();

  function sampleAt(depth) {
    var best = PROF[0], bd = 1e9;
    PROF.forEach(function (p) { var dd = Math.abs(p.d - depth); if (dd < bd) { bd = dd; best = p; } });
    return best;
  }

  function lampFactor(h) { return 1 - 0.3 * Math.min(h, 500) / 500; }

  /* ---------- 场景生成：岩屑 + 荧光斑 + 泥浆反光 ---------- */
  var SCENE = null;

  function buildScene() {
    var rng = mulberry32(((S.depth * 7919) ^ (RESEED * 104729) ^ 0x9e3779b9) >>> 0);
    var smp = sampleAt(S.depth);
    var lvl = smp.lvl;
    var oil = OILS[S.oil], lith = LITHS[S.lith];
    var lf = lampFactor(S.lamp);

    var chips = [], patches = [], i, k;
    for (i = 0; i < lith.n; i++) {
      var cx = 34 + rng() * (IW - 68), cy = 26 + rng() * (IH - 52);
      var R = lith.rMin + rng() * (lith.rMax - lith.rMin);
      var nv = 7 + Math.floor(rng() * 3), verts = [];
      for (k = 0; k < nv; k++) {
        var a = k / nv * Math.PI * 2, rr = R * (0.72 + rng() * 0.45);
        verts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]);
      }
      chips.push({ x: cx, y: cy, r: R, verts: verts, tint: 0.8 + rng() * 0.4 });
    }
    chips.forEach(function (ch) {
      var o = clamp(BASE_OIL[lvl - 1] * (0.55 + rng() * 0.9), 0, 1);
      var np = Math.round(o * 8);
      for (var p = 0; p < np; p++) {
        var px = 0, py = 0, ok = false;
        for (k = 0; k < 8 && !ok; k++) {
          px = ch.x + (rng() - 0.5) * ch.r * 1.4;
          py = ch.y + (rng() - 0.5) * ch.r * 1.1;
          ok = (px - ch.x) * (px - ch.x) + (py - ch.y) * (py - ch.y) < ch.r * ch.r * 0.64;
        }
        patches.push({
          type: 'fluo', x: px, y: py,
          r: (5 + rng() * 12 * (0.5 + o)) * (ch.r / 32),
          h: oil.hue + (rng() - 0.5) * 2 * oil.hueJit,
          s: clamp(oil.sat + (rng() - 0.5) * 0.12, 0, 1),
          v: clamp((0.5 + 0.5 * o) * (0.72 + 0.5 * rng()) * lf * oil.bright, 0.02, 1)
        });
      }
    });
    /* 油基泥浆反光：低饱和蓝白、连片、覆盖全片 */
    var nm = Math.round(S.mud / 7);
    for (i = 0; i < nm; i++) {
      patches.push({
        type: 'mud', x: 20 + rng() * (IW - 40), y: 15 + rng() * (IH - 30),
        rx: 28 + rng() * 46, ry: 15 + rng() * 26, rot: rng() * Math.PI,
        h: 205 + rng() * 10, s: 0.20 + rng() * 0.06,
        v: clamp(0.68 * lf * (0.85 + 0.3 * rng()), 0.02, 1)
      });
    }
    SCENE = { chips: chips, patches: patches, trueLevel: lvl, rng: rng, lf: lf };
    return SCENE;
  }

  function pointInPatch(p, x, y) {
    if (p.type === 'mud') {
      var dx = x - p.x, dy = y - p.y;
      var cs = Math.cos(-p.rot), sn = Math.sin(-p.rot);
      var u = dx * cs - dy * sn, w = dx * sn + dy * cs;
      return (u * u) / (p.rx * p.rx) + (w * w) / (p.ry * p.ry) <= 1;
    }
    var ddx = x - p.x, ddy = y - p.y;
    return ddx * ddx + ddy * ddy <= p.r * p.r;
  }
  function pointInChip(ch, x, y) {
    var inside = false, vs = ch.verts;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      var xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  /* 顶部优先：泥浆反光最后绘制，位于最上层 */
  function classifyAt(x, y) {
    var i;
    for (i = SCENE.patches.length - 1; i >= 0; i--) {
      if (pointInPatch(SCENE.patches[i], x, y)) return SCENE.patches[i];
    }
    for (i = 0; i < SCENE.chips.length; i++) {
      if (pointInChip(SCENE.chips[i], x, y)) return { type: 'chip' };
    }
    return { type: 'bg' };
  }

  /* ---------- 统计：采样 3400 点计算 FAR / V̄ / Oc ---------- */
  var STATS = null;
  function computeStats() {
    var rng = mulberry32(777);
    var pts = [], i;
    for (i = 0; i < 3400; i++) {
      var x = rng() * IW, y = rng() * IH;
      var c = classifyAt(x, y), v, h = 0, s = 0;
      if (c.type === 'fluo' || c.type === 'mud') { v = c.v; h = c.h; s = c.s; }
      else if (c.type === 'chip') { v = 0.20 * SCENE.lf * (0.8 + 0.4 * rng()); }
      else { v = 0.05 + 0.05 * rng(); c = { type: 'bg' }; }
      var pass = (c.type === 'fluo' || c.type === 'mud') && s >= S.sat && v >= S.val;
      var cat;
      if (c.type === 'fluo') cat = pass ? 'fp' : 'fb';
      else if (c.type === 'mud') cat = pass ? 'mp' : 'mb';
      else cat = c.type; /* chip | bg */
      pts.push({ cat: cat, v: v, h: h });
    }
    var nChip = 0, nFp = 0, sumV = 0, sumH = 0, nMp = 0;
    pts.forEach(function (p) {
      if (p.cat === 'fp' || p.cat === 'fb' || p.cat === 'mp' || p.cat === 'mb' || p.cat === 'chip') nChip++;
      if (p.cat === 'fp') { nFp++; sumV += p.v; sumH += p.h; }
      if (p.cat === 'mp') nMp++;
    });
    var far = nChip ? nFp / nChip : 0;
    var avgV = nFp ? sumV / nFp : 0;
    var avgH = nFp ? sumH / nFp : OILS[S.oil].hue;
    var oc = far * avgV * 100;
    var judged = 1;
    OC_BOUNDS.forEach(function (b, idx) { if (oc >= b) judged = idx + 2; });
    var dist = Math.min(Math.abs(oc - OC_BOUNDS[0]), Math.abs(oc - OC_BOUNDS[1]), Math.abs(oc - OC_BOUNDS[2]));
    STATS = {
      pts: pts, far: far, avgV: avgV, avgH: avgH, oc: oc, judged: judged,
      conf: clamp(dist / 12, 0.15, 1), mudPassRatio: nChip ? nMp / nChip : 0
    };
    return STATS;
  }

  /* ---------- 面板 1：原图 ---------- */
  function drawRaw() {
    var cv = $('imgRaw');
    var ctx = setupCanvas(cv, IW, IH);
    var g = ctx.createLinearGradient(0, 0, 0, IH);
    g.addColorStop(0, '#10141d'); g.addColorStop(1, '#07080c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, IW, IH);

    var rng = mulberry32(31337);
    var i;
    for (i = 0; i < 240; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.015 + rng() * 0.05) + ')';
      ctx.fillRect(rng() * IW, rng() * IH, 1, 1);
    }
    /* 岩屑颗粒（暗色） */
    SCENE.chips.forEach(function (ch) {
      var b = LITHS[S.lith].base;
      ctx.beginPath();
      ch.verts.forEach(function (vt, k) { k ? ctx.lineTo(vt[0], vt[1]) : ctx.moveTo(vt[0], vt[1]); });
      ctx.closePath();
      ctx.fillStyle = rgbCss([b[0] * ch.tint, b[1] * ch.tint, b[2] * ch.tint], 1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    /* 荧光斑 */
    SCENE.patches.forEach(function (p) {
      if (p.type !== 'fluo') return;
      var col = hsv2rgb(p.h, p.s, p.v);
      var rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      rg.addColorStop(0, rgbCss(col, 0.95));
      rg.addColorStop(0.7, rgbCss(col, 0.55));
      rg.addColorStop(1, rgbCss(col, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    /* 泥浆反光膜 */
    SCENE.patches.forEach(function (p) {
      if (p.type !== 'mud') return;
      var col = hsv2rgb(p.h, p.s, p.v);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, p.rx);
      rg.addColorStop(0, rgbCss(col, 0.5));
      rg.addColorStop(1, rgbCss(col, 0));
      ctx.fillStyle = rg;
      ctx.scale(1, p.ry / p.rx);
      ctx.beginPath(); ctx.arc(0, 0, p.rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    /* 暗角 */
    var vg = ctx.createRadialGradient(IW / 2, IH / 2, IH * 0.35, IW / 2, IH / 2, IH * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, IW, IH);
  }

  /* ---------- 面板 1：分割图 ---------- */
  function drawSeg() {
    var cv = $('imgSeg');
    var ctx = setupCanvas(cv, IW, IH);
    ctx.fillStyle = '#0d1016'; ctx.fillRect(0, 0, IW, IH);

    SCENE.chips.forEach(function (ch) {
      ctx.beginPath();
      ch.verts.forEach(function (vt, k) { k ? ctx.lineTo(vt[0], vt[1]) : ctx.moveTo(vt[0], vt[1]); });
      ctx.closePath();
      ctx.fillStyle = 'rgba(96,104,112,0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,158,166,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    SCENE.patches.forEach(function (p) {
      var pass = p.s >= S.sat && p.v >= S.val;
      if (p.type === 'fluo') {
        if (pass) {
          ctx.fillStyle = 'rgba(63,180,140,0.8)';
          ctx.strokeStyle = '#e8fff5';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(201,161,90,0.16)';
          ctx.strokeStyle = '#c9a15a';
          ctx.setLineDash([3, 2]);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
        if (pass) {
          ctx.fillStyle = 'rgba(176,90,81,0.75)';
          ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(65,105,155,0.14)';
          ctx.fill();
          ctx.strokeStyle = '#41699b';
          ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2; ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    });
    ctx.fillStyle = 'rgba(232,236,240,0.85)';
    ctx.font = '9px Consolas, monospace';
    ctx.fillText('HSV 分割：S ≥ ' + S.sat.toFixed(2) + ' · V ≥ ' + S.val.toFixed(2), 8, 14);
  }

  /* ---------- 面板 2：指标与判词 ---------- */
  function renderMetrics() {
    var t = STATS;
    $('m-far').innerHTML = (t.far * 100).toFixed(1) + '<small> %</small>';
    $('m-val').innerHTML = t.avgV.toFixed(2);
    $('m-wave').innerHTML = '≈' + waveOfHue(t.avgH) + '<small> nm ' + OILS[S.oil].colorName + '</small>';
    $('m-oc').innerHTML = t.oc.toFixed(1);

    var lm = $('m-level');
    lm.textContent = LEVEL_NAMES[t.judged - 1];
    lm.style.color = LEVEL_COLORS[t.judged - 1];

    var mismatch = t.judged !== SCENE.trueLevel;
    lm.parentNode.className = 'mcard' + (mismatch ? ' bad' : '');

    var v = $('verdict');
    var head = 'FAR <b>' + (t.far * 100).toFixed(1) + '%</b> · V̄ <b>' + t.avgV.toFixed(2) + '</b> · Oc <b>' + t.oc.toFixed(1) + '</b> → 建议 <b>' + LEVEL_NAMES[t.judged - 1] + '</b>（置信 ' + Math.round(t.conf * 100) + '%），岩屑描述为 <b>' + LEVEL_NAMES[SCENE.trueLevel - 1] + '</b>；';
    if (S.lamp >= 500) {
      v.className = 'verdict bad';
      v.innerHTML = head + '灯管累计 ' + S.lamp + ' h，强度衰减已达 30% 上限——按 SY/T 6611 须强制换灯并拍标准荧光片校准，否则同一岩屑复拍将从 3 级掉到 2 级。';
    } else if (t.mudPassRatio > 0.08) {
      v.className = 'verdict warn';
      v.innerHTML = head + '油基泥浆反光有 <b>' + (t.mudPassRatio * 100).toFixed(1) + '%</b> 像元通过阈值，假荧光使级别虚高。建议将饱和度阈值提高到 0.30 以上剔除（泥浆反光 S≈0.22、连片无颗粒边界）。';
    } else if (mismatch) {
      v.className = 'verdict warn';
      v.innerHTML = head + '判读与岩屑描述相差 ' + Math.abs(t.judged - SCENE.trueLevel) + ' 级，属边界样本，按流程应交录井师复核并回流改判结果。';
    } else if (S.lamp >= 400) {
      v.className = 'verdict warn';
      v.innerHTML = head + '判读与描述一致。注意灯管已点亮 ' + S.lamp + ' h，接近 500 h 换灯线，建议本井次结束后更换。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '判读与描述一致。荧光颜色 ' + OILS[S.oil].colorName + '（≈' + waveOfHue(t.avgH) + ' nm），符合' + OILS[S.oil].label + '特征。';
    }
  }

  /* ---------- 面板 3：发光强度直方图 ---------- */
  var HIST = null;
  function drawHist() {
    var cv = $('hist');
    var ctx = setupCanvas(cv, HW, HH);
    var pl = 34, pr = 10, pt = 16, pb = 26;
    var pw = HW - pl - pr, ph = HH - pt - pb;
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, HW, HH);

    var NB = 25, bins = [];
    var i;
    for (i = 0; i < NB; i++) bins.push({ fp: 0, fb: 0, mp: 0, mb: 0, other: 0, total: 0 });
    STATS.pts.forEach(function (p) {
      var b = clamp(Math.floor(p.v * NB), 0, NB - 1);
      var e = bins[b];
      if (p.cat === 'fp') e.fp++;
      else if (p.cat === 'fb') e.fb++;
      else if (p.cat === 'mp') e.mp++;
      else if (p.cat === 'mb') e.mb++;
      else e.other++;
      e.total++;
    });
    var yMax = 0;
    bins.forEach(function (b) { yMax = Math.max(yMax, b.total); });
    yMax = Math.ceil(yMax / 50) * 50 || 50;

    /* 网格与刻度 */
    ctx.font = '8.5px Consolas, monospace';
    var step = yMax >= 800 ? 200 : (yMax >= 300 ? 100 : 50);
    for (i = 0; i <= yMax; i += step) {
      var y = pt + ph - i / yMax * ph;
      ctx.strokeStyle = i ? '#efece1' : '#d8d0bc';
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + pw, y); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'end';
      ctx.fillText(i, pl - 5, y + 3);
    }
    for (i = 0; i <= 100; i += 20) {
      var x = pl + i / 100 * pw;
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(i, x, pt + ph + 12);
    }
    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.font = '9px sans-serif';
    ctx.fillText('发光强度 V（归一化，%）', pl + pw / 2, HH - 3);
    ctx.save();
    ctx.translate(10, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('像元数', 0, 0);
    ctx.restore();

    var bw = pw / NB;
    var COLORS = { fp: '#2f7d6b', fb: '#9db8ac', mp: '#41699b', mb: '#c3ccd8', other: '#d5cfbf' };
    bins.forEach(function (b, k) {
      var y0 = pt + ph;
      ['other', 'mb', 'mp', 'fb', 'fp'].forEach(function (key) {
        var h = b[key] / yMax * ph;
        if (h <= 0) return;
        y0 -= h;
        ctx.fillStyle = COLORS[key];
        ctx.fillRect(pl + k * bw + 0.5, y0, bw - 1, h);
      });
    });

    /* 阈值线 */
    var xt = pl + S.val * pw;
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.3; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(xt, pt); ctx.lineTo(xt, pt + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = xt > pl + pw - 70 ? 'end' : 'start';
    ctx.font = '8.5px Consolas, monospace';
    ctx.fillText('V 阈值 ' + S.val.toFixed(2), xt + (xt > pl + pw - 70 ? -4 : 4), pt + 9);

    HIST = { bins: bins, pl: pl, pw: pw, nb: NB };
  }

  /* ---------- 面板 4：井深剖面 ---------- */
  var PROFGEO = null;
  function batchJudge(d) {
    /* 用当前全局参数对剖面每个深度做简化重判 */
    var smp = sampleAt(d);
    var oil = OILS[S.oil];
    var far = BASE_OIL[smp.lvl - 1];
    var lf = lampFactor(S.lamp);
    var V = clamp((0.55 + 0.4 * far) * lf * oil.bright, 0.02, 1);
    if (oil.sat < S.sat) far *= 0.15;             /* 饱和度阈值过高：真荧光被拦 */
    if (0.22 >= S.sat) far += (S.mud / 100) * 0.55; /* 泥浆反光误入 */
    if (V < S.val) far *= 0.15;
    var oc = far * V * 100;
    var lvl = 1;
    OC_BOUNDS.forEach(function (b, idx) { if (oc >= b) lvl = idx + 2; });
    return lvl;
  }

  function drawProf() {
    var cv = $('prof');
    var ctx = setupCanvas(cv, PW, PH);
    var pl = 38, pt = 18, pb = 30;
    var ph = PH - pt - pb;
    var xLith = pl, wLith = 26;
    var xLvl = xLith + wLith + 8, wLvl = 104;
    var xGas = xLvl + wLvl + 14, wGas = PW - xGas - 12;

    function yOf(d) { return pt + (d - 800) / 800 * ph; }
    function xLvlOf(l) { return xLvl + (l - 1) / 3 * wLvl; }
    function xGasOf(g) { return xGas + (Math.log10(g) + 2) / (Math.log10(30) + 2) * wGas; }

    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, PW, PH);

    /* 深度网格与轴 */
    ctx.font = '8.5px Consolas, monospace';
    for (var d = 800; d <= 1600; d += 100) {
      var y = yOf(d);
      ctx.strokeStyle = d === 800 ? '#d8d0bc' : '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(PW - 10, y); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'end';
      ctx.fillText(d, pl - 5, y + 3);
    }
    ctx.save();
    ctx.translate(10, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center'; ctx.font = '9px sans-serif';
    ctx.fillText('井深 (m)', 0, 0);
    ctx.restore();

    /* 轨首标题 */
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.fillText('岩性', xLith + wLith / 2, pt - 6);
    ctx.fillText('荧光级别', xLvl + wLvl / 2, pt - 6);
    ctx.fillText('气测全烃 TG (%)', xGas + wGas / 2, pt - 6);

    /* 岩性柱 */
    PROF.forEach(function (p, i) {
      var y0 = yOf(p.d) - ph / 80, y1 = yOf(p.d) + ph / 80;
      ctx.fillStyle = p.lith === 'sand' ? '#d8c49a' : '#b9bec2';
      ctx.fillRect(xLith, y0, wLith, y1 - y0 + 0.5);
    });

    /* 描述级别阶梯线 */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    PROF.forEach(function (p, i) {
      var y = yOf(p.d), x = xLvlOf(p.lvl);
      if (i === 0) ctx.moveTo(x, y);
      else { ctx.lineTo(x, y - ph / 80); ctx.lineTo(x, y); }
    });
    ctx.stroke();
    /* 级别底纹 */
    ctx.fillStyle = 'rgba(47,125,107,0.08)';
    ctx.beginPath();
    ctx.moveTo(xLvl, yOf(800));
    PROF.forEach(function (p) { ctx.lineTo(xLvlOf(p.lvl), yOf(p.d)); });
    ctx.lineTo(xLvl, yOf(1600));
    ctx.closePath(); ctx.fill();

    /* 模型重判散点 */
    PROF.forEach(function (p) {
      var jl = batchJudge(p.d);
      var ok = jl === p.lvl;
      ctx.fillStyle = ok ? '#2f7d6b' : '#b05a51';
      ctx.beginPath();
      ctx.arc(xLvlOf(jl), yOf(p.d), ok ? 2.4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    /* 气测曲线（对数轴） */
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    PROF.forEach(function (p, i) {
      var x = xGasOf(p.gas), y = yOf(p.d);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    /* 气测对数刻度 */
    ctx.font = '8.5px Consolas, monospace'; ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
    [0.01, 0.1, 1, 10].forEach(function (g) {
      var x = xGasOf(g);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + ph); ctx.stroke();
      ctx.fillText(g, x, pt + ph + 12);
    });

    /* 级别底轴刻度 */
    for (var l = 1; l <= 4; l++) {
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(l, xLvlOf(l), pt + ph + 12);
    }
    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif';
    ctx.fillText('荧光级别', xLvl + wLvl / 2, PH - 3);
    ctx.textAlign = 'center';
    ctx.fillText('全烃对数轴', xGas + wGas / 2, PH - 3);

    /* 当前采样深度 */
    var yc = yOf(S.depth);
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yc); ctx.lineTo(PW - 10, yc); ctx.stroke();
    ctx.setLineDash([]);
    var smp = sampleAt(S.depth);
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(xLvlOf(smp.lvl), yc, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#41699b'; ctx.textAlign = 'left';
    ctx.font = '8.5px Consolas, monospace';
    ctx.fillText(S.depth + ' m', pl + 2, yc - 4);

    PROFGEO = { yOf: yOf, pt: pt, ph: ph, xLvl: xLvl, wLvl: wLvl, xLvlOf: xLvlOf, xGas: xGas, wGas: wGas };
  }

  /* ---------- 悬停 tooltip ---------- */
  function bindImgTip() {
    var tip = $('img-tip');
    var sec = tip.parentNode;
    ['imgRaw', 'imgSeg'].forEach(function (id) {
      var cv = $(id);
      cv.addEventListener('mousemove', function (evt) {
        var r = cv.getBoundingClientRect();
        var lx = (evt.clientX - r.left) * (IW / r.width);
        var ly = (evt.clientY - r.top) * (IH / r.height);
        var c = classifyAt(lx, ly);
        var html;
        if (c.type === 'fluo') {
          var pass = c.s >= S.sat && c.v >= S.val;
          html = '<b>荧光斑（' + OILS[S.oil].colorName + '）</b><br>H ' + Math.round(c.h) + '° · S ' + c.s.toFixed(2) + ' · V ' + c.v.toFixed(2) + '<br>主波长 ≈' + waveOfHue(c.h) + ' nm · ' + (pass ? '<b>通过阈值</b>' : '<b style="color:#9a7a1c">被阈值拦截</b>');
        } else if (c.type === 'mud') {
          var pass2 = c.s >= S.sat && c.v >= S.val;
          html = '<b>油基泥浆反光</b><br>H ' + Math.round(c.h) + '° · S ' + c.s.toFixed(2) + ' · V ' + c.v.toFixed(2) + '<br>低饱和 · 连片无颗粒边界 · ' + (pass2 ? '<b style="color:#a85147">误入荧光区</b>' : '<b style="color:#41699b">已剔除</b>');
        } else if (c.type === 'chip') {
          html = '<b>岩屑颗粒</b>（' + LITHS[S.lith].name + '）<br>本底低亮度，不计入荧光面积';
        } else {
          html = '<b>暗场本底</b><br>非岩屑区域';
        }
        var sr = sec.getBoundingClientRect();
        tip.innerHTML = html;
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - sr.left + 12, 4, sr.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - sr.top + 10, 4, sr.height - 80) + 'px';
      });
      cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    });
  }

  function bindHistTip() {
    var cv = $('hist'), tip = $('hist-tip'), box = $('hist-box');
    cv.addEventListener('mousemove', function (evt) {
      if (!HIST) return;
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (HW / r.width);
      var k = Math.floor((lx - HIST.pl) / HIST.pw * HIST.nb);
      if (k < 0 || k >= HIST.nb) { tip.style.display = 'none'; return; }
      var b = HIST.bins[k];
      var lo = (k / HIST.nb * 100).toFixed(0), hi = ((k + 1) / HIST.nb * 100).toFixed(0);
      tip.innerHTML = '<b>V ' + lo + '%—' + hi + '%</b>（共 ' + b.total + ' 像元）<br>' +
        '荧光·通过 <b>' + b.fp + '</b> · 荧光·拦截 <b>' + b.fb + '</b><br>' +
        '泥浆·误入 <b>' + b.mp + '</b> · 泥浆·剔除 <b>' + b.mb + '</b><br>' +
        '岩屑 / 本底 <b>' + b.other + '</b>';
      var br = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - br.left + 12, 4, br.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - br.top - 10, 4, br.height - 80) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function bindProfTip() {
    var cv = $('prof'), tip = $('prof-tip'), box = $('prof-box');
    cv.addEventListener('mousemove', function (evt) {
      if (!PROFGEO) return;
      var r = cv.getBoundingClientRect();
      var ly = (evt.clientY - r.top) * (PH / r.height);
      var d = 800 + (ly - PROFGEO.pt) / PROFGEO.ph * 800;
      if (d < 800 || d > 1600) { tip.style.display = 'none'; return; }
      var p = sampleAt(d);
      var jl = batchJudge(p.d);
      var ok = jl === p.lvl;
      tip.innerHTML = '<b>' + p.d + ' m</b>（' + (p.lith === 'sand' ? '砂岩' : '泥岩') + '）<br>' +
        '岩屑描述 <b>' + LEVEL_NAMES[p.lvl - 1] + '</b><br>' +
        '模型判读 <b style="color:' + (ok ? '#2f7d6b' : '#b05a51') + '">' + LEVEL_NAMES[jl - 1] + (ok ? ' ✓' : ' ✗') + '</b><br>' +
        '气测全烃 <b>' + (p.gas < 0.1 ? p.gas.toFixed(3) : p.gas.toFixed(2)) + ' %</b>';
      var br = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - br.left + 12, 4, br.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - br.top - 10, 4, br.height - 80) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 渲染主流程 ---------- */
  function render() {
    buildScene();
    drawRaw();
    drawSeg();
    computeStats();
    renderMetrics();
    drawHist();
    drawProf();
    var smp = sampleAt(S.depth);
    var tl = $('true-level');
    tl.textContent = LEVEL_NAMES[smp.lvl - 1];
    tl.style.color = LEVEL_COLORS[smp.lvl - 1];
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    depth: function (v) { return v + ' m'; },
    lamp: function (v) { return v + ' h'; },
    mud: function (v) { return v + ' %'; },
    sat: function (v) { return v.toFixed(2); },
    val: function (v) { return v.toFixed(2); }
  };
  var KEYS = ['depth', 'lamp', 'mud', 'sat', 'val'];

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('sel-oil').addEventListener('change', function () { S.oil = this.value; render(); });
    $('sel-lith').addEventListener('change', function () { S.lith = this.value; render(); });
    $('btn-reseed').addEventListener('click', function () { RESEED++; render(); });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      KEYS.forEach(function (k) {
        $('s-' + k).value = DEF[k];
        $('o-' + k).textContent = OUT[k](DEF[k]);
      });
      $('sel-oil').value = DEF.oil;
      $('sel-lith').value = DEF.lith;
      render();
    });
  }

  bind();
  bindImgTip(); bindHistTip(); bindProfTip();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      if ($('pane-sim').classList.contains('active')) {
        drawRaw(); drawSeg(); drawHist(); drawProf();
      }
    }, 120);
  });
})();

/* ======= 真实数据来源页：响应曲线图 + 来源汇总表 + 页签 ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(x, y, s, attrs, parent) {
    var t = el('text', attrs || {}, parent);
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.textContent = s;
    return t;
  }

  /* F = K·I·θ·C 响应曲线：新灯管 vs 500 h 灯管 */
  function drawF() {
    var svg = document.getElementById('lit-chartF');
    if (!svg) return;
    var W = 900, H = 240, PL = 52, PR = 24, PT = 26, PB = 38;
    var pw = W - PL - PR, ph = H - PT - PB;
    var X1 = 60, Y1 = 100;               /* C: 0—60 mg/L，F: 0—100（相对强度） */
    function xOf(c) { return PL + c / X1 * pw; }
    function yOf(f) { return PT + ph - f / Y1 * ph; }

    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    var i;
    for (i = 0; i <= Y1; i += 20) {
      var y = yOf(i);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: i ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, i + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    for (i = 0; i <= X1; i += 10) {
      var x = xOf(i);
      el('line', { x1: x, y1: PT, x2: x, y2: PT + ph, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, PT + ph + 14, i + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(PL + pw / 2, H - 4, '含油浓度 C (mg/L)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(13, PT + ph / 2, '荧光强度 F（相对）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 13 ' + (PT + ph / 2) + ')' }, svg);

    /* 3 级 / 2 级判读界线 */
    var y48 = yOf(48);
    el('line', { x1: PL, y1: y48, x2: W - PR, y2: y48, stroke: '#c9a15a', 'stroke-width': 1.2, 'stroke-dasharray': '6 3' }, svg);
    txt(PL + 6, y48 - 5, '3 级 / 2 级判读界线（示意）', { 'font-size': 9, fill: '#9a7a1c' }, svg);

    /* 两条响应线：F = 1.6·C（新灯）与 0.7 倍（500 h） */
    function line(f, color, dash) {
      var d = 'M' + xOf(0) + ' ' + yOf(0) + ' L' + xOf(X1) + ' ' + yOf(f(X1));
      el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-dasharray': dash || 'none' }, svg);
    }
    line(function (c) { return 1.6 * c; }, '#2f7d6b');
    line(function (c) { return 1.12 * c; }, '#b05a51', '7 4');
    txt(xOf(58), yOf(1.6 * 58) - 6, '新灯管 I₀', { 'font-size': 9.5, fill: '#235f51', 'text-anchor': 'end', 'font-weight': 600 }, svg);
    txt(xOf(58), yOf(1.12 * 58) + 14, '500 h 灯管 0.7·I₀', { 'font-size': 9.5, fill: '#b05a51', 'text-anchor': 'end', 'font-weight': 600 }, svg);

    /* 同一岩屑 C=35：3 级掉到 2 级 */
    var c35 = xOf(35);
    el('line', { x1: c35, y1: yOf(39.2), x2: c35, y2: yOf(56), stroke: '#8a9298', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, svg);
    el('circle', { cx: c35, cy: yOf(56), r: 5, fill: '#2f7d6b', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    el('circle', { cx: c35, cy: yOf(39.2), r: 5, fill: '#b05a51', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    txt(c35 - 9, yOf(56) - 8, '同一岩屑 C=35 → 3 级', { 'font-size': 9, fill: '#235f51', 'text-anchor': 'end' }, svg);
    txt(c35 + 9, yOf(39.2) + 14, '灯老化 → 掉到 2 级', { 'font-size': 9, fill: '#b05a51' }, svg);

    txt(PL + 4, 14, 'F = K·I·θ·C（C < 60 mg/L 线性段）· 激发光强 I 衰减 30% 时同一岩屑荧光强度同步降 30%', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function buildTable() {
    var body = document.getElementById('lit-body');
    if (!body) return;
    var rows = [
      ['SY/T 6611-2017《石油定量荧光录井规范》', '样品选取、定量分析、资料解释与报告编制要求；标准荧光片校准', '判读流程、油性指数 Oc 口径、灯源校准与换灯规则'],
      ['SY/T 6020-1994《探井地质录井油气水层解释符合率统计方法》', '解释符合率的统计口径', '页脚评估指标：严格一致率 ≥75%、相邻一级 ≥95%、κ ≥0.80'],
      ['中国石油《定量荧光录井识别低孔低渗油气层新技术》', 'F = K·I·θ·C，C < 60 mg/L 呈线性', '图像亮度生成模型；灯管 500 h 衰减 30% 的联动降级'],
      ['Liu & Eadington (2005) Org. Geochem. 36(7):1023–1036', 'QGF / QGF-E 定量荧光；发射主波长随油质变重红移', '稠油 ≈585 nm 黄褐 / 轻质油 ≈470 nm 蓝白的颜色映射'],
      ['Reyes et al. (1994) 油基泥浆荧光录井分析', '油基钻井液整体发蓝白荧光，须萃取分离识别', '「油基泥浆附着」滑块的假荧光建模与剔除规则'],
      ['《地球科学》2016, 41(3):373–384 储层定量荧光技术综述', 'QGF / QGF-E / TSF 系列；荧光强度与含油饱和度单调相关', '含油级别 1—4 级 → 荧光面积比与亮度的生成模型'],
      ['CIE Publication 15:2004 Colorimetry', 'CIELAB 色彩空间与 ΔE*ab 色差公式', '跨井色差 ΔE 11.4 → 3.2 的度量；图像归一化动机']
    ];
    rows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td>';
      body.appendChild(tr);
    });
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
      });
    });
  }

  bindTabs();
  drawF();
  buildTable();
})();
