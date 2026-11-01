/* ======= 露头裂缝智能统计与产状反算 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI 适配：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
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

  /* 确定性伪随机数（同一参数组合可复现） */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function mod180(x) { return ((x % 180) + 180) % 180; }
  function circDist180(a, b) { var d = Math.abs(mod180(a) - mod180(b)); return Math.min(d, 180 - d); }

  var DEF = { dens: 240, angle: 75, noise: 0.40, thr: 0.45, minlen: 1.0, dshare: 0.15 };
  var S = Object.assign({}, DEF);
  var SEED = 20261030;

  var FACE_W = 30, FACE_H = 20;   /* 露头顶面 30 m × 20 m */
  var PW = 290, PH = 200;         /* 子面板逻辑像素 */
  var SX = PW / FACE_W, SY = PH / FACE_H;

  var STRIKE_A = 330;             /* NW 组构造缝真值走向 */
  var GROUP_COL = { A: '#41699b', B: '#2f7d6b', D: '#c9a15a' };
  var GROUP_NAME = { A: '构造缝 NW 组', B: '构造缝 NE 组', D: '成岩缝' };

  var MODEL = null;               /* { fracs, noises, strikeB } */
  var PIPE = { xs: [10, 314, 618], y0: 26, W: 920, H: 234 };
  var ROSE = { bins: [], cx: 160, cy: 152, R: 102, total: 0 };
  var HIST = { bars: [] };
  var HIST_EDGES = [0.5, 1, 2, 3, 5, 7, 10, 15];

  /* ---------- 裂缝几何生成 ---------- */
  function strikeToDir(strike) { /* 走向（自北顺时针）→ 画布单位向量 */
    var r = strike * Math.PI / 180;
    return [Math.sin(r), -Math.cos(r)];
  }

  /* 生成一条折线裂缝：中心点 + 走向 + 迹长 + 开度 + 曲率抖动 */
  function genFracture(rnd, strike, len, ap, set, curv) {
    var cx = rnd() * FACE_W, cy = rnd() * FACE_H;
    var dir = strikeToDir(strike);
    var n = Math.max(2, Math.round(len / 0.8));
    var pts = [];
    var x = cx - dir[0] * len / 2, y = cy - dir[1] * len / 2;
    var hd = strike * Math.PI / 180;
    var step = len / n;
    for (var i = 0; i <= n; i++) {
      pts.push([x * SX, y * SY]);
      hd += curv * gauss(rnd) * Math.PI / 180;
      x += Math.sin(hd) * step;
      y += -Math.cos(hd) * step;
    }
    /* 对比度：开度越大、迹长越长越暗（越易被分割检出） */
    var c = clamp(0.42 + 0.38 * (ap / 15) + 0.12 * (len / 12) + 0.08 * gauss(rnd), 0.05, 0.98);
    return { pts: pts, strike: strike, len: len, ap: ap, set: set, contrast: c, detected: false, valid: false };
  }

  function genModel() {
    var rnd = mulberry32(SEED);
    var fracs = [], noises = [];
    var strikeB = (STRIKE_A + S.angle) % 360;
    var N = Math.round(S.dens);
    var i, r, set, strike, len, ap, curv, g;
    for (i = 0; i < N; i++) {
      r = rnd();
      if (r < S.dshare) {                       /* 成岩缝：方位随机、短而弯 */
        set = 'D'; strike = rnd() * 360;
        len = 0.3 + rnd() * 1.9; curv = 16;
        ap = clamp(2.0 * Math.exp(0.55 * gauss(rnd)), 0.5, 15);
      } else if (r < S.dshare + (1 - S.dshare) * 0.55) {
        set = 'A'; strike = (STRIKE_A + 6 * gauss(rnd) + 360) % 360;
        len = clamp(3.2 * Math.exp(0.55 * gauss(rnd)), 0.3, 12); curv = 3;
        ap = clamp(2.2 * Math.exp(0.6 * gauss(rnd)), 0.5, 15);
      } else {
        set = 'B'; strike = (strikeB + 6 * gauss(rnd) + 360) % 360;
        len = clamp(2.8 * Math.exp(0.55 * gauss(rnd)), 0.3, 12); curv = 3;
        ap = clamp(2.0 * Math.exp(0.6 * gauss(rnd)), 0.5, 15);
      }
      fracs.push(genFracture(rnd, strike, len, ap, set, curv));
    }
    /* 层理干扰线：近 EW 走向、长、弱对比 */
    var nBed = Math.round(4 + S.noise * 20);
    for (i = 0; i < nBed; i++) {
      g = genFracture(rnd, (90 + 4 * gauss(rnd) + 360) % 360, 8 + rnd() * 20, 0.5, 'bed', 1.5);
      g.contrast = clamp(0.10 + S.noise * 0.45 + 0.08 * gauss(rnd), 0.04, 0.95);
      noises.push(g);
    }
    /* 碎斑噪声：短划、随机方位 */
    var nSp = Math.round(S.noise * 150);
    for (i = 0; i < nSp; i++) {
      g = genFracture(rnd, rnd() * 360, 0.15 + rnd() * 0.6, 0.5, 'spk', 8);
      g.contrast = clamp(0.08 + S.noise * 0.40 + 0.08 * gauss(rnd), 0.03, 0.90);
      noises.push(g);
    }
    /* 二值分割 + 最小缝长过滤 */
    fracs.forEach(function (f) {
      f.detected = f.contrast >= S.thr;
      f.valid = f.detected && f.len >= S.minlen;
    });
    noises.forEach(function (g2) {
      g2.detected = g2.contrast >= S.thr;
      g2.valid = g2.detected && g2.len >= S.minlen;   /* 层理长线常通过长度过滤 → 误判 */
    });
    MODEL = { fracs: fracs, noises: noises, strikeB: strikeB };
  }

  /* ---------- 统计量 ---------- */
  function computeStats() {
    var nValid = 0, sumLen = 0, totalGE = 0, fp = 0;
    MODEL.fracs.forEach(function (f) {
      if (f.len >= S.minlen) totalGE++;
      if (f.valid) { nValid++; sumLen += f.len; }
    });
    MODEL.noises.forEach(function (g) { if (g.valid && g.set === 'bed') fp++; });
    return {
      nValid: nValid,
      sumLen: sumLen,
      totalGE: totalGE,
      fp: fp,
      recall: totalGE ? nValid / totalGE : 0,
      P10: nValid / FACE_W,
      P21: sumLen / (FACE_W * FACE_H)
    };
  }

  /* 走向频数分箱（0–180，10° 间隔） */
  function roseBins() {
    var bins = [], i;
    for (i = 0; i < 18; i++) bins.push(0);
    MODEL.fracs.forEach(function (f) {
      if (f.valid) bins[Math.min(17, Math.floor(mod180(f.strike) / 10))]++;
    });
    return bins;
  }

  /* 在 ±25° 窗口内找峰值方向 */
  function peakInWindow(bins, center) {
    var best = -1, bestC = 0;
    for (var i = 0; i < 18; i++) {
      var dir = i * 10 + 5;
      if (circDist180(dir, center) <= 25 && bins[i] > bestC) { bestC = bins[i]; best = i; }
    }
    return best < 0 ? null : { dir: best * 10 + 5, count: bestC };
  }

  /* ---------- 通用折线绘制 ---------- */
  function drawLines(ctx, arr, styleFn) {
    arr.forEach(function (g) {
      var st = styleFn(g);
      if (!st) return;
      ctx.strokeStyle = st.col;
      ctx.lineWidth = st.w;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      g.pts.forEach(function (p, i) {
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      });
      ctx.stroke();
    });
  }

  /* ---------- 面板 A 纹理：砂岩底 + 层理 + 暗色裂缝网 ---------- */
  function makeTexture() {
    var off = document.createElement('canvas');
    off.width = PW; off.height = PH;
    var c2 = off.getContext('2d');
    var img = c2.createImageData(PW, PH);
    var rnd = mulberry32(SEED ^ 0x9e3779b9);
    var gw = 8, gh = 6, grid = [];
    var i, x, y;
    for (i = 0; i < gw * gh; i++) grid.push(rnd());
    function nval(px, py) {
      var fx = px / PW * (gw - 1), fy = py / PH * (gh - 1);
      var ix = Math.floor(fx), iy = Math.floor(fy);
      var tx = fx - ix, ty = fy - iy;
      var ix1 = Math.min(gw - 1, ix + 1), iy1 = Math.min(gh - 1, iy + 1);
      var a = grid[iy * gw + ix], b = grid[iy * gw + ix1];
      var c = grid[iy1 * gw + ix], d = grid[iy1 * gw + ix1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
    for (y = 0; y < PH; y++) {
      for (x = 0; x < PW; x++) {
        var n = nval(x, y);
        var band = 0.05 * Math.sin(y * 0.16 + n * 5);
        var gr = (rnd() - 0.5) * 0.09;
        var t = clamp(0.15 + n * 0.28 + band + gr, 0, 0.62);
        var k = (y * PW + x) * 4;
        img.data[k]     = Math.round(251 + (201 - 251) * t);   /* #fbfaf6 → #c9a15a */
        img.data[k + 1] = Math.round(250 + (161 - 250) * t);
        img.data[k + 2] = Math.round(246 + (90 - 246) * t);
        img.data[k + 3] = 255;
      }
    }
    c2.putImageData(img, 0, 0);
    /* 层理与碎斑画在裂缝下层 */
    drawLines(c2, MODEL.noises, function (g) {
      return {
        w: g.set === 'bed' ? 1.1 : 0.8,
        col: 'rgba(70,76,80,' + (0.25 + g.contrast * 0.5).toFixed(2) + ')'
      };
    });
    /* 裂缝：暗色线网，宽度随开度（夸张显示） */
    drawLines(c2, MODEL.fracs, function (f) {
      return {
        w: 0.7 + f.ap * 0.16,
        col: 'rgba(45,50,53,' + (0.30 + f.contrast * 0.55).toFixed(2) + ')'
      };
    });
    return off;
  }

  /* ---------- ① 提取流水线三子图 ---------- */
  function drawPipe() {
    var cv = $('pipe'), W = PIPE.W, H = PIPE.H;
    var ctx = setupCanvas(cv, W, H);
    var xs = PIPE.xs, y0 = PIPE.y0;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, W, H);

    var tex = makeTexture();
    var titles = [
      'A · 原始合成影像（顶面 30 m × 20 m）',
      'B · 二值分割（阈值 ' + S.thr.toFixed(2) + '）',
      'C · 骨架化与分组（最小缝长 ' + S.minlen.toFixed(1) + ' m）'
    ];

    for (var p = 0; p < 3; p++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(xs[p], y0, PW, PH);
      ctx.clip();
      ctx.translate(xs[p], y0);

      if (p === 0) {
        ctx.drawImage(tex, 0, 0);
      } else if (p === 1) {
        ctx.fillStyle = '#fdfcf9';
        ctx.fillRect(0, 0, PW, PH);
        drawLines(ctx, MODEL.noises.filter(function (g) { return g.detected; }), function (g) {
          return { w: g.set === 'bed' ? 1.1 : 0.8, col: '#242b2e' };
        });
        drawLines(ctx, MODEL.fracs.filter(function (f) { return f.detected; }), function (f) {
          return { w: 0.7 + f.ap * 0.16, col: '#242b2e' };
        });
      } else {
        ctx.fillStyle = '#fdfcf9';
        ctx.fillRect(0, 0, PW, PH);
        drawLines(ctx, MODEL.noises.filter(function (g) { return g.detected && !g.valid; }), function () {
          return { w: 0.8, col: '#d8d2c2' };   /* 碎斑：被长度过滤 */
        });
        drawLines(ctx, MODEL.noises.filter(function (g) { return g.valid; }), function () {
          return { w: 1.2, col: '#b05a51' };   /* 层理误判 */
        });
        drawLines(ctx, MODEL.fracs.filter(function (f) { return f.detected && !f.valid; }), function () {
          return { w: 1.0, col: '#8a9298' };   /* 过短被滤 */
        });
        drawLines(ctx, MODEL.fracs.filter(function (f) { return f.valid; }), function (f) {
          return { w: 1.4, col: GROUP_COL[f.set] };
        });
      }
      ctx.restore();
      ctx.strokeStyle = '#cfc7b6';
      ctx.lineWidth = 1;
      ctx.strokeRect(xs[p] + 0.5, y0 + 0.5, PW - 1, PH - 1);
      ctx.fillStyle = '#5d666d';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(titles[p], xs[p], y0 - 8);
    }

    /* 面板间箭头 */
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('→', (xs[0] + PW + xs[1]) / 2, y0 + PH / 2 + 5);
    ctx.fillText('→', (xs[1] + PW + xs[2]) / 2, y0 + PH / 2 + 5);

    /* 比例尺（面板 A 左下） */
    var bx = xs[0] + 12, by = y0 + PH - 12, bl = 5 * SX;
    ctx.strokeStyle = '#fdfcf9';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bl, by); ctx.stroke();
    ctx.strokeStyle = '#242b2e';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bl, by); ctx.stroke();
    ctx.fillStyle = '#242b2e';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('5 m', bx + bl + 4, by + 3);
  }

  /* ---------- ②a 走向玫瑰花图 ---------- */
  function drawRose() {
    var cv = $('rose'), W = 320, H = 300;
    var ctx = setupCanvas(cv, W, H);
    var cx = ROSE.cx, cy = ROSE.cy, R = ROSE.R;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    var bins = roseBins();
    var total = 0;
    bins.forEach(function (c) { total += c; });
    var maxC = Math.max.apply(null, bins.concat([1]));
    ROSE.bins = bins;
    ROSE.total = total;

    /* 网格圆环 + 频数标注 */
    ctx.strokeStyle = '#efece1';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'left';
    [0.25, 0.5, 0.75, 1].forEach(function (fr) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * fr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(String(Math.round(maxC * fr)), cx + 3, cy - R * fr + 10);
    });

    /* 放射辐条 + 方位标注（走向双向，只标 0–150°） */
    ctx.textAlign = 'center';
    for (var d = 0; d < 180; d += 30) {
      var a = d * Math.PI / 180;
      ctx.strokeStyle = '#efece1';
      ctx.beginPath();
      ctx.moveTo(cx - R * Math.sin(a), cy + R * Math.cos(a));
      ctx.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a));
      ctx.stroke();
      ctx.fillStyle = '#79828a';
      ctx.font = '9px sans-serif';
      var name = d === 0 ? 'N 0°' : (d === 90 ? 'E 90°' : d + '°');
      ctx.fillText(name, cx + (R + 14) * Math.sin(a), cy - (R + 14) * Math.cos(a) + 3);
    }

    /* 频数花瓣（双端对称） */
    bins.forEach(function (c, i) {
      if (!c) return;
      var r = c / maxC * R * 0.96;
      var a0 = i * 10 * Math.PI / 180 - Math.PI / 2;
      var a1 = (i * 10 + 10) * Math.PI / 180 - Math.PI / 2;
      [0, Math.PI].forEach(function (off) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0 + off, a1 + off);
        ctx.closePath();
        ctx.fillStyle = 'rgba(47,125,107,0.62)';
        ctx.fill();
        ctx.strokeStyle = '#2f7d6b';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });

    /* 真值走向虚线 */
    [
      { s: STRIKE_A, col: '#41699b', name: 'NW330°' },
      { s: MODEL.strikeB, col: '#c9a15a', name: Math.round(MODEL.strikeB) + '°' }
    ].forEach(function (t) {
      var o = mod180(t.s) * Math.PI / 180;
      ctx.strokeStyle = t.col;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - (R + 4) * Math.sin(o), cy + (R + 4) * Math.cos(o));
      ctx.lineTo(cx + (R + 4) * Math.sin(o), cy - (R + 4) * Math.cos(o));
      ctx.stroke();
      ctx.setLineDash([]);
      /* 标注放在靠上的一端 */
      var ex = cx + (R + 22) * Math.sin(o), ey = cy - (R + 22) * Math.cos(o);
      if (ey > cy) { ex = cx - (R + 22) * Math.sin(o); ey = cy + (R + 22) * Math.cos(o); }
      ctx.fillStyle = t.col;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.name, ex, ey);
    });

    ctx.fillStyle = '#5d666d';
    ctx.font = '9.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('走向玫瑰花图 · 入统 ' + total + ' 条 · 10° 间隔', 8, 14);
  }

  /* ---------- ②b 开度分布直方图 ---------- */
  function drawHist() {
    var cv = $('hist'), W = 440, H = 300;
    var ctx = setupCanvas(cv, W, H);
    var pl = 36, pr = 14, pt = 26, pb = 42;
    var pw = W - pl - pr, ph = H - pt - pb;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    var nb = HIST_EDGES.length - 1;
    var counts = [], i;
    for (i = 0; i < nb; i++) counts.push(0);
    var sumAp = 0, nV = 0;
    MODEL.fracs.forEach(function (f) {
      if (!f.valid) return;
      nV++;
      sumAp += f.ap;
      for (i = 0; i < nb; i++) {
        if (f.ap >= HIST_EDGES[i] && (f.ap < HIST_EDGES[i + 1] || i === nb - 1)) { counts[i]++; break; }
      }
    });
    var meanAp = nV ? sumAp / nV : 0;
    var maxC = Math.max.apply(null, counts.concat([1]));
    var slot = pw / nb, bw = slot * 0.66;

    function xOf(v) { /* 开度值 → x（按分箱线性插值） */
      if (v <= HIST_EDGES[0]) return pl;
      for (var i = 0; i < nb; i++) {
        if (v <= HIST_EDGES[i + 1]) {
          return pl + (i + (v - HIST_EDGES[i]) / (HIST_EDGES[i + 1] - HIST_EDGES[i])) * slot;
        }
      }
      return pl + pw;
    }
    function yOf(c) { return pt + ph - c / (maxC * 1.12) * ph; }

    /* 宽缝区底色（>1 mm，SY/T 6286） */
    var xw = xOf(1);
    ctx.fillStyle = 'rgba(201,161,90,0.10)';
    ctx.fillRect(xw, pt, pl + pw - xw, ph);
    ctx.fillStyle = '#9a7a1c';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('宽缝区 >1 mm（SY/T 6286）', pl + pw - 4, pt + 11);

    /* 网格与 y 轴 */
    var step = maxC <= 10 ? 2 : (maxC <= 30 ? 5 : 10);
    ctx.font = '8.5px Consolas, monospace';
    for (var v = 0; v <= maxC * 1.05; v += step) {
      var yy = yOf(v);
      ctx.strokeStyle = v ? '#efece1' : '#d8d0bc';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, yy); ctx.lineTo(pl + pw, yy); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.textAlign = 'right';
      ctx.fillText(String(v), pl - 5, yy + 3);
    }

    /* 柱条 */
    HIST.bars = [];
    counts.forEach(function (c, i) {
      var x = pl + i * slot + (slot - bw) / 2;
      var y = yOf(c);
      ctx.fillStyle = 'rgba(65,105,155,0.85)';
      ctx.fillRect(x, y, bw, pt + ph - y);
      ctx.fillStyle = '#3a4145';
      ctx.font = '8.5px Consolas, monospace';
      ctx.textAlign = 'center';
      if (c) ctx.fillText(String(c), x + bw / 2, y - 3);
      ctx.fillStyle = '#79828a';
      ctx.font = '8px sans-serif';
      ctx.fillText(HIST_EDGES[i] + '–' + HIST_EDGES[i + 1], pl + i * slot + slot / 2, pt + ph + 12);
      HIST.bars.push({ x: x, y: y, w: bw, h: pt + ph - y, label: HIST_EDGES[i] + '–' + HIST_EDGES[i + 1] + ' mm', count: c, pct: nV ? c / nV * 100 : 0 });
    });

    /* 均值开度虚线 */
    if (nV) {
      var xm = xOf(meanAp);
      ctx.strokeStyle = '#c9a15a';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(xm, pt); ctx.lineTo(xm, pt + ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#9a7a1c';
      ctx.font = '9px sans-serif';
      ctx.textAlign = xm > pl + pw - 70 ? 'right' : 'left';
      ctx.fillText('均值 ' + meanAp.toFixed(1) + ' mm', xm + (xm > pl + pw - 70 ? -4 : 4), pt + ph - 6);
    }

    ctx.fillStyle = '#5d666d';
    ctx.font = '9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('开度 (mm)', pl + pw / 2, H - 6);
    ctx.save();
    ctx.translate(10, pt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('条数', 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillText('开度分布 · 入统 ' + nV + ' 条', 8, 14);
  }

  /* ---------- ③ 指标卡 + 诊断 ---------- */
  function renderMetrics(st) {
    $('m-n').innerHTML = st.nValid + '<small> 条</small>';
    $('m-p10').innerHTML = st.P10.toFixed(2) + '<small> 条/m</small>';
    $('m-p21').innerHTML = st.P21.toFixed(2) + '<small> m/m²</small>';

    var bins = roseBins();
    var pkA = peakInWindow(bins, STRIKE_A);
    var pkB = peakInWindow(bins, MODEL.strikeB);
    var peakTxt = (pkA ? Math.round(mod180(pkA.dir)) + '°' : '—') + ' / ' + (pkB ? Math.round(mod180(pkB.dir)) + '°' : '—');
    $('m-peak').textContent = peakTxt;

    $('m-fp').innerHTML = st.fp + '<small> 条</small>';
    $('m-fp').parentNode.className = 'mcard' + (st.fp === 0 ? '' : (st.fp / Math.max(1, st.nValid + st.fp) > 0.10 ? ' bad' : ' warn'));
    return { pkA: pkA, pkB: pkB };
  }

  function renderVerdict(st, peaks) {
    var v = $('verdict');
    var head = '入统 <b>' + st.nValid + '</b> 条（真缝召回 <b>' + Math.round(st.recall * 100) + '%</b>）· 层理误判 <b>' + st.fp + '</b> 条 · P10 <b>' + st.P10.toFixed(2) + '</b> 条/m · P21 <b>' + st.P21.toFixed(2) + '</b> m/m²；';
    var fpRate = st.fp / Math.max(1, st.fp + st.nValid);
    var pkA = peaks.pkA, pkB = peaks.pkB;
    var errA = pkA ? circDist180(pkA.dir, STRIKE_A) : 99;

    if (st.recall < 0.70) {
      v.className = 'verdict bad';
      v.innerHTML = head + '召回偏低：分割阈值 ' + S.thr.toFixed(2) + ' 偏高或最小缝长 ' + S.minlen.toFixed(1) + ' m 偏大，开度 &lt;2 mm 的细缝大量漏检——细缝恰是密度统计的主体，P21 被系统性低估。建议降低阈值或最小缝长。';
      return;
    }
    if (fpRate > 0.10) {
      v.className = 'verdict warn';
      v.innerHTML = head + '层理混入 ' + st.fp + ' 条，P10 虚增约 <b>' + Math.round(st.fp / Math.max(1, st.nValid) * 100) + '%</b>。参照案例：不剔除层理会把线密度抬高一倍——建议提高分割阈值，或启用「与层理夹角 &lt;15° 且延伸 &gt;5 m」剔除规则。';
      return;
    }
    if (errA > 8) {
      v.className = 'verdict warn';
      v.innerHTML = head + '走向峰值偏差 <b>' + Math.round(errA) + '°</b>，超出 ±8° 验收线：噪声过强导致玫瑰花图弥散。建议降低层理 / 噪声强度或加密采样。';
      return;
    }
    v.className = 'verdict ok';
    v.innerHTML = head + '分割质量良好，走向峰值 ' + (pkA ? Math.round(mod180(pkA.dir)) : '—') + '° / ' + (pkB ? Math.round(mod180(pkB.dir)) : '—') + '°（真值 330° / ' + Math.round(MODEL.strikeB) + '°），满足 ±8° 验收；交付时应按面法向可见率（案例 92%）外推，并与实测玫瑰花图做 KS 对照（≤0.15）。';
  }

  /* ---------- 渲染主流程 ---------- */
  function render() {
    genModel();
    drawPipe();
    drawRose();
    drawHist();
    var st = computeStats();
    var peaks = renderMetrics(st);
    renderVerdict(st, peaks);
  }

  /* ---------- 悬停 tooltip ---------- */
  function bindTips() {
    /* 面板①：最近裂缝 */
    var cv = $('pipe'), tip = $('pipe-tip'), box = $('pipe-box');
    function nearestObj(px, py) {
      var best = null, bd = 8;
      function scan(g, kind) {
        for (var i = 0; i < g.pts.length; i++) {
          var p = g.pts[i];
          if (p[0] < -2 || p[0] > PW + 2 || p[1] < -2 || p[1] > PH + 2) continue;
          var d = Math.hypot(p[0] - px, p[1] - py);
          if (d < bd) { bd = d; best = { g: g, kind: kind }; }
        }
      }
      MODEL.fracs.forEach(function (f) { if (f.detected) scan(f, 'frac'); });
      MODEL.noises.forEach(function (g) { if (g.detected) scan(g, g.set); });
      return best;
    }
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) / r.width * PIPE.W;
      var ly = (evt.clientY - r.top) / r.height * PIPE.H;
      var panel = -1;
      for (var p = 0; p < 3; p++) {
        if (lx >= PIPE.xs[p] && lx <= PIPE.xs[p] + PW && ly >= PIPE.y0 && ly <= PIPE.y0 + PH) panel = p;
      }
      if (panel < 0) { tip.style.display = 'none'; return; }
      var hit = nearestObj(lx - PIPE.xs[panel], ly - PIPE.y0);
      if (!hit) { tip.style.display = 'none'; return; }
      var g = hit.g, html;
      if (hit.kind === 'frac') {
        html = '<b>' + GROUP_NAME[g.set] + '</b><br>走向 ' + Math.round(g.strike) + '° · 迹长 ' + g.len.toFixed(1) + ' m<br>开度 ' + g.ap.toFixed(1) + ' mm · 对比度 ' + g.contrast.toFixed(2) +
          (g.valid ? '' : '<br><span style="color:#b05a51">短于最小缝长，未入统</span>');
      } else if (hit.kind === 'bed') {
        html = '<b>层理干扰</b><br>走向 ' + Math.round(g.strike) + '° · 延伸 ' + g.len.toFixed(1) + ' m<br>' +
          (g.valid ? '<span style="color:#b05a51">通过长度过滤 → 密度虚增</span>' : '被最小缝长规则滤除');
      } else {
        html = '<b>噪声碎斑</b><br>被最小缝长规则滤除';
      }
      var rb = box.getBoundingClientRect();
      tip.innerHTML = html;
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });

    /* 玫瑰花图 */
    var rcv = $('rose'), rtip = $('rose-tip'), rbox = $('rose-box');
    rcv.addEventListener('mousemove', function (evt) {
      var r = rcv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) / r.width * 320;
      var ly = (evt.clientY - r.top) / r.height * 300;
      var dx = lx - ROSE.cx, dy = ly - ROSE.cy;
      var rr = Math.hypot(dx, dy);
      if (rr > ROSE.R + 6 || rr < 6) { rtip.style.display = 'none'; return; }
      var th = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      var bin = Math.min(17, Math.floor(mod180(th) / 10));
      var c = ROSE.bins[bin] || 0;
      var pct = ROSE.total ? c / ROSE.total * 100 : 0;
      rtip.innerHTML = '<b>走向 ' + (bin * 10) + '–' + (bin * 10 + 10) + '°</b><br>' + c + ' 条 · 占 ' + pct.toFixed(1) + '%';
      var rb = rbox.getBoundingClientRect();
      rtip.style.display = 'block';
      rtip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 150) + 'px';
      rtip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
    });
    rcv.addEventListener('mouseleave', function () { rtip.style.display = 'none'; });

    /* 开度直方图 */
    var hcv = $('hist'), htip = $('hist-tip'), hbox = $('hist-box');
    hcv.addEventListener('mousemove', function (evt) {
      var r = hcv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) / r.width * 440;
      var ly = (evt.clientY - r.top) / r.height * 300;
      var hit = null;
      HIST.bars.forEach(function (b) {
        if (lx >= b.x - 3 && lx <= b.x + b.w + 3 && ly >= b.y - 4) hit = b;
      });
      if (!hit) { htip.style.display = 'none'; return; }
      htip.innerHTML = '<b>开度 ' + hit.label + '</b><br>' + hit.count + ' 条 · 占 ' + hit.pct.toFixed(1) + '%';
      var rb = hbox.getBoundingClientRect();
      htip.style.display = 'block';
      htip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 160) + 'px';
      htip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
    });
    hcv.addEventListener('mouseleave', function () { htip.style.display = 'none'; });
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    dens: function (v) { return v + ' 条'; },
    angle: function (v) { return v + '°'; },
    noise: function (v) { return Math.round(v * 100) + ' %'; },
    thr: function (v) { return v.toFixed(2); },
    minlen: function (v) { return v.toFixed(1) + ' m'; },
    dshare: function (v) { return Math.round(v * 100) + ' %'; }
  };
  var KEYS = ['dens', 'angle', 'dshare', 'noise', 'thr', 'minlen'];

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('btn-resample').addEventListener('click', function () {
      SEED = (SEED * 1664525 + 1013904223) >>> 0;
      render();
    });
    $('btn-reset').addEventListener('click', function () {
      KEYS.forEach(function (k) {
        S[k] = DEF[k];
        $('s-' + k).value = DEF[k];
        $('o-' + k).textContent = OUT[k](DEF[k]);
      });
      render();
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

  bind();
  bindTabs();
  bindTips();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawPipe(); drawRose(); drawHist(); }, 120);
  });
})();
