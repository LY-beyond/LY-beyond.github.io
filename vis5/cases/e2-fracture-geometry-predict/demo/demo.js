/* ======= 压裂裂缝形态智能预测 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
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
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function niceTicks(min, max, n) {
    var span = max - min;
    var raw = span / n;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = mag;
    if (raw / mag >= 7.5) step = mag * 10;
    else if (raw / mag >= 3.5) step = mag * 5;
    else if (raw / mag >= 1.5) step = mag * 2;
    var arr = [];
    var v = Math.ceil(min / step) * step;
    while (v <= max + 1e-9) { arr.push(Math.round(v * 1e6) / 1e6); v += step; }
    return arr;
  }

  var FONT = '10px -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  var MONO = '10px Consolas, "Courier New", monospace';

  /* ---------- 状态与模型 ---------- */
  var DEF = { q: 14, mu: 30, sand: 16, dsig: 6, e: 30, t: 120 };
  var S = Object.assign({}, DEF);

  function muEff(s) { return s.mu * (1 + 0.015 * s.sand); }

  function xfPKN(s) {
    var m = muEff(s);
    return 210 * Math.pow(s.q / 14, 0.6) * Math.pow(m / 30, -0.2)
      * Math.pow(s.e / 30, 0.2) * Math.pow(s.t / 120, 0.8);
  }
  function xfKGD(s) {
    var m = muEff(s);
    return 172 * Math.pow(s.q / 14, 0.5) * Math.pow(m / 30, -1 / 6)
      * Math.pow(s.e / 30, 1 / 6) * Math.pow(s.t / 120, 2 / 3);
  }
  function xfML(s) { return xfPKN(s) * 0.94; }

  function pnet(s) {
    return 8 * Math.pow(s.q / 14, 0.4) * Math.pow(muEff(s) / 30, 0.2)
      * Math.pow(s.e / 30, 0.8) * Math.pow(xfPKN(s) / 210, 0.2);
  }
  function hfrac(s) {
    var p = pnet(s);
    var base = 30 * (0.95 + 0.05 * Math.min(1, p / s.dsig));
    var pen = 34.5 * Math.max(0, p - s.dsig) / (s.dsig + 2);
    return clamp(base + pen, 20, 80);
  }
  function width(s) {
    return 5.2 * Math.pow(s.q / 14, 0.4) * Math.pow(muEff(s) / 30, 0.2)
      * Math.pow(xfML(s) / 210, 0.2) * Math.pow(30 / s.e, 0.2);
  }
  function screenout(s) {
    return 1 / (1 + Math.exp(-(s.sand - (6 + 1.1 * s.q)) / 2.2));
  }

  function metrics(s) {
    var xf = xfML(s);
    return {
      xf: xf, xfLo: xf * 0.866, xfHi: xf * 1.134,
      pk: xfPKN(s), kgd: xfKGD(s),
      hf: hfrac(s), w: width(s), pn: pnet(s), risk: screenout(s)
    };
  }

  /* ---------- tooltip ---------- */
  function bindTip(cv, tip, handler) {
    cv.addEventListener('mousemove', function (ev) {
      var r = cv.getBoundingClientRect();
      var lx = (ev.clientX - r.left) * (cv._lw / r.width);
      var ly = (ev.clientY - r.top) * (cv._lh / r.height);
      var html = handler(lx, ly);
      if (!html) { tip.style.display = 'none'; return; }
      tip.innerHTML = html;
      tip.style.display = 'block';
      var pw = cv.parentElement.clientWidth, ph = cv.parentElement.clientHeight;
      var px = ev.clientX - r.left + 14, py = ev.clientY - r.top + 12;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      if (px + tw > pw - 4) px = ev.clientX - r.left - tw - 10;
      if (py + th > ph - 4) py = ev.clientY - r.top - th - 8;
      tip.style.left = px + 'px';
      tip.style.top = py + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function axisFrame(ctx, W, H, box) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.l, box.t);
    ctx.lineTo(box.l, box.t + box.h);
    ctx.lineTo(box.l + box.w, box.t + box.h);
    ctx.stroke();
  }

  function drawXTicks(ctx, box, ticks, fmt, y0) {
    ctx.font = FONT; ctx.fillStyle = '#79828a'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ticks.forEach(function (v) {
      var x = box.l + (v - box.xmin) / (box.xmax - box.xmin) * box.w;
      ctx.strokeStyle = '#ece5d6';
      ctx.beginPath(); ctx.moveTo(x, box.t); ctx.lineTo(x, box.t + box.h); ctx.stroke();
      ctx.fillText(fmt(v), x, y0);
    });
  }
  function drawYTicks(ctx, box, ticks, fmt, x0) {
    ctx.font = FONT; ctx.fillStyle = '#79828a'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ticks.forEach(function (v) {
      var y = box.t + box.h - (v - box.ymin) / (box.ymax - box.ymin) * box.h;
      ctx.strokeStyle = '#ece5d6';
      ctx.beginPath(); ctx.moveTo(box.l, y); ctx.lineTo(box.l + box.w, y); ctx.stroke();
      ctx.fillText(fmt(v), x0, y);
    });
  }
  function sx(box, v) { return box.l + (v - box.xmin) / (box.xmax - box.xmin) * box.w; }
  function sy(box, v) { return box.t + box.h - (v - box.ymin) / (box.ymax - box.ymin) * box.h; }

  function fmt0(v) { return String(Math.round(v)); }

  /* ================= ① 剖面示意 ================= */
  var geoCv = $('cv-geo');
  var GEO_W = 860, GEO_H = 300;

  function drawGeo() {
    var M = metrics(S);
    var ctx = setupCanvas(geoCv, GEO_W, GEO_H);
    geoCv._lw = GEO_W; geoCv._lh = GEO_H;
    var xmax = Math.max(M.xfHi, M.pk, M.kgd) * 1.18;
    var box = { l: 56, t: 34, w: GEO_W - 56 - 16, h: GEO_H - 34 - 34, xmin: 0, xmax: xmax, ymin: -50, ymax: 50 };
    axisFrame(ctx, GEO_W, GEO_H, box);

    /* 隔层与储层 */
    ctx.fillStyle = '#eae4d4';
    ctx.fillRect(box.l, sy(box, 50), box.w, sy(box, 15) - sy(box, 50));
    ctx.fillRect(box.l, sy(box, -15), box.w, sy(box, -50) - sy(box, -15));
    ctx.fillStyle = '#f7f4ec';
    ctx.fillRect(box.l, sy(box, 15), box.w, sy(box, -15) - sy(box, 15));
    ctx.fillStyle = '#9ba3a9'; ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('上应力隔层（Δσ 遮挡）', box.l + 6, sy(box, 32));
    ctx.fillText('下应力隔层', box.l + 6, sy(box, -32));
    ctx.fillText('储层 30 m', box.l + 6, sy(box, 0));
    ctx.strokeStyle = '#d8d2c2';
    ctx.beginPath();
    ctx.moveTo(box.l, sy(box, 15)); ctx.lineTo(box.l + box.w, sy(box, 15));
    ctx.moveTo(box.l, sy(box, -15)); ctx.lineTo(box.l + box.w, sy(box, -15));
    ctx.stroke();

    /* 微地震事件点云（确定性伪随机） */
    var rnd = mulberry32(20261030);
    var i, side, xi, zi, hAtX;
    ctx.fillStyle = 'rgba(110,120,126,0.55)';
    for (i = 0; i < 130; i++) {
      side = rnd() < 0.5 ? 1 : -1;
      xi = Math.pow(rnd(), 0.75) * M.xf * 1.1;
      hAtX = M.hf * Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, xi / M.xf), 2)));
      zi = side * (rnd() * 2 - 1) * (hAtX * 0.5 * 0.9 + 1.5);
      var px = sx(box, xi), pz = sy(box, clamp(zi, -48, 48));
      ctx.fillRect(px - 1, pz - 1, 2, 2);
    }

    /* PKN 固定缝高轮廓（虚线） */
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (i = 0; i <= 60; i++) {
      xi = M.pk * i / 60;
      var hpk = 30 * Math.sqrt(Math.max(0, 1 - Math.pow(i / 60, 2)));
      if (i === 0) ctx.moveTo(sx(box, xi), sy(box, hpk / 2)); else ctx.lineTo(sx(box, xi), sy(box, hpk / 2));
    }
    for (i = 60; i >= 0; i--) {
      xi = M.pk * i / 60;
      var hpk2 = 30 * Math.sqrt(Math.max(0, 1 - Math.pow(i / 60, 2)));
      ctx.lineTo(sx(box, xi), sy(box, -hpk2 / 2));
    }
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);

    /* ML 缝高轮廓（填充） */
    ctx.fillStyle = 'rgba(47,125,107,0.16)';
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (i = 0; i <= 80; i++) {
      xi = M.xf * i / 80;
      hAtX = M.hf * Math.sqrt(Math.max(0, 1 - Math.pow(i / 80, 2)));
      if (i === 0) ctx.moveTo(sx(box, xi), sy(box, hAtX / 2)); else ctx.lineTo(sx(box, xi), sy(box, hAtX / 2));
    }
    for (i = 80; i >= 0; i--) {
      xi = M.xf * i / 80;
      hAtX = M.hf * Math.sqrt(Math.max(0, 1 - Math.pow(i / 80, 2)));
      ctx.lineTo(sx(box, xi), sy(box, -hAtX / 2));
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    /* 80% 不确定区间端点（垂直短线） */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    [M.xfLo, M.xfHi].forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(sx(box, v), sy(box, 8)); ctx.lineTo(sx(box, v), sy(box, -8)); ctx.stroke();
    });
    ctx.setLineDash([]);

    /* 井筒 */
    ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx(box, 0), sy(box, 15)); ctx.lineTo(sx(box, 0), sy(box, -15)); ctx.stroke();

    /* 坐标刻度 */
    drawXTicks(ctx, box, niceTicks(0, xmax, 6), fmt0, box.t + box.h + 6);
    drawYTicks(ctx, box, [-40, -20, 0, 20, 40], fmt0, box.l - 6);
    ctx.fillStyle = '#79828a'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('距井筒距离 (m)', box.l + box.w / 2, box.t + box.h + 18);
    ctx.save();
    ctx.translate(13, box.t + box.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('垂向 (m，储层中轴为 0)', 0, 0);
    ctx.restore();

    /* 半长标注箭头 */
    var ay = box.t - 10;
    ctx.strokeStyle = '#235f51'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx(box, 0), ay); ctx.lineTo(sx(box, M.xf), ay);
    ctx.moveTo(sx(box, M.xf) - 5, ay - 3); ctx.lineTo(sx(box, M.xf), ay); ctx.lineTo(sx(box, M.xf) - 5, ay + 3);
    ctx.stroke();
    ctx.fillStyle = '#235f51'; ctx.font = MONO; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('半长 ' + M.xf.toFixed(0) + ' m（80% 区间 ' + M.xfLo.toFixed(0) + '—' + M.xfHi.toFixed(0) + '）', sx(box, M.xf) + 8, ay);

    /* 缝高标注 */
    var hx = sx(box, M.xf * 0.42);
    ctx.strokeStyle = '#b05a51';
    ctx.beginPath();
    ctx.moveTo(hx, sy(box, M.hf / 2)); ctx.lineTo(hx, sy(box, -M.hf / 2));
    ctx.moveTo(hx - 3, sy(box, M.hf / 2) + 5); ctx.lineTo(hx, sy(box, M.hf / 2)); ctx.lineTo(hx + 3, sy(box, M.hf / 2) + 5);
    ctx.moveTo(hx - 3, sy(box, -M.hf / 2) - 5); ctx.lineTo(hx, sy(box, -M.hf / 2)); ctx.lineTo(hx + 3, sy(box, -M.hf / 2) - 5);
    ctx.stroke();
    ctx.fillStyle = '#b05a51';
    ctx.fillText('缝高 ' + M.hf.toFixed(1) + ' m', hx + 8, sy(box, M.hf * 0.28));

    geoCv._tip = function (lx, ly) {
      if (lx < box.l || lx > box.l + box.w || ly < box.t || ly > box.t + box.h) return null;
      var xv = (lx - box.l) / box.w * (box.xmax - box.xmin);
      if (xv > M.xf) return '<b>超出缝端</b><br>距井筒 ' + xv.toFixed(0) + ' m';
      var hAt = M.hf * Math.sqrt(Math.max(0, 1 - Math.pow(xv / M.xf, 2)));
      return '<b>距井筒 ' + xv.toFixed(0) + ' m</b><br>局部缝高 ≈ ' + hAt.toFixed(1) + ' m'
        + '<br>半长 ' + M.xf.toFixed(0) + ' m · 缝高 ' + M.hf.toFixed(1) + ' m'
        + '<br>PKN 半长 ' + M.pk.toFixed(0) + ' m（固定缝高 30 m）';
    };
  }

  /* ================= ③ 左：半长—排量 ================= */
  var xfqCv = $('cv-xfq');
  var XQ_W = 420, XQ_H = 250;

  function drawXfQ() {
    var ctx = setupCanvas(xfqCv, XQ_W, XQ_H);
    xfqCv._lw = XQ_W; xfqCv._lh = XQ_H;
    var box = { l: 44, t: 14, w: XQ_W - 44 - 12, h: XQ_H - 14 - 34, xmin: 4, xmax: 22 };
    var i, q;
    var ymax = 0;
    for (i = 0; i <= 36; i++) {
      q = 4 + 18 * i / 36;
      ymax = Math.max(ymax, xfML({ q: q, mu: S.mu, sand: S.sand, dsig: S.dsig, e: S.e, t: S.t }) * 1.134);
    }
    ymax = Math.ceil(ymax / 50) * 50;
    box.ymin = 0; box.ymax = ymax;
    axisFrame(ctx, XQ_W, XQ_H, box);
    drawXTicks(ctx, box, niceTicks(4, 22, 5), fmt0, box.t + box.h + 5);
    drawYTicks(ctx, box, niceTicks(0, ymax, 5), fmt0, box.l - 5);
    ctx.fillStyle = '#79828a'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('排量 (m³/min)', box.l + box.w / 2, box.t + box.h + 16);
    ctx.save(); ctx.translate(11, box.t + box.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('裂缝半长 (m)', 0, 0); ctx.restore();

    function stateAt(qv) { return { q: qv, mu: S.mu, sand: S.sand, dsig: S.dsig, e: S.e, t: S.t }; }

    /* ML 不确定带 */
    ctx.fillStyle = 'rgba(47,125,107,0.13)';
    ctx.beginPath();
    for (i = 0; i <= 36; i++) {
      q = 4 + 18 * i / 36;
      var v = xfML(stateAt(q)) * 1.134;
      if (i === 0) ctx.moveTo(sx(box, q), sy(box, v)); else ctx.lineTo(sx(box, q), sy(box, v));
    }
    for (i = 36; i >= 0; i--) {
      q = 4 + 18 * i / 36;
      var v2 = xfML(stateAt(q)) * 0.866;
      ctx.lineTo(sx(box, q), sy(box, v2));
    }
    ctx.closePath(); ctx.fill();

    function curve(fn, color, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      if (dash) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (var j = 0; j <= 36; j++) {
        var qv = 4 + 18 * j / 36;
        var yv = fn(stateAt(qv));
        if (j === 0) ctx.moveTo(sx(box, qv), sy(box, yv)); else ctx.lineTo(sx(box, qv), sy(box, yv));
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    curve(xfML, '#2f7d6b', false);
    curve(xfPKN, '#c9a15a', false);
    curve(xfKGD, '#41699b', true);

    /* 当前工况点 */
    var cur = metrics(S);
    ctx.fillStyle = '#242b2e';
    ctx.beginPath(); ctx.arc(sx(box, S.q), sy(box, cur.xf), 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

    xfqCv._tip = function (lx, ly) {
      if (lx < box.l || lx > box.l + box.w || ly < box.t || ly > box.t + box.h) return null;
      var qv = box.xmin + (lx - box.l) / box.w * (box.xmax - box.xmin);
      var st = stateAt(qv);
      var ml = xfML(st);
      return '<b>排量 ' + qv.toFixed(1) + ' m³/min</b><br>ML：' + ml.toFixed(0) + ' m（' + (ml * 0.866).toFixed(0) + '—' + (ml * 1.134).toFixed(0) + '）'
        + '<br>PKN：' + xfPKN(st).toFixed(0) + ' m · KGD：' + xfKGD(st).toFixed(0) + ' m';
    };
  }

  /* ================= ③ 右：缝高—应力差 ================= */
  var hfdsCv = $('cv-hfds');
  var HD_W = 420, HD_H = 250;

  function drawHfDs() {
    var ctx = setupCanvas(hfdsCv, HD_W, HD_H);
    hfdsCv._lw = HD_W; hfdsCv._lh = HD_H;
    var box = { l: 44, t: 14, w: HD_W - 44 - 12, h: HD_H - 14 - 34, xmin: 0, xmax: 14, ymin: 20, ymax: 80 };
    axisFrame(ctx, HD_W, HD_H, box);
    drawXTicks(ctx, box, niceTicks(0, 14, 6), fmt0, box.t + box.h + 5);
    drawYTicks(ctx, box, niceTicks(20, 80, 5), fmt0, box.l - 5);
    ctx.fillStyle = '#79828a'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('隔层—储层应力差 Δσ (MPa)', box.l + box.w / 2, box.t + box.h + 16);
    ctx.save(); ctx.translate(11, box.t + box.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('裂缝高度 (m)', 0, 0); ctx.restore();

    /* 越界警戒区 */
    ctx.fillStyle = 'rgba(176,90,81,0.08)';
    ctx.fillRect(box.l, sy(box, 80), box.w, sy(box, 42) - sy(box, 80));
    ctx.strokeStyle = '#c9a15a'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(box.l, sy(box, 42)); ctx.lineTo(box.l + box.w, sy(box, 42)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('越界风险区 > 42 m', box.l + box.w - 4, sy(box, 42) - 3);

    function stAt(d, q) { return { q: q, mu: S.mu, sand: S.sand, dsig: d, e: S.e, t: S.t }; }
    function curveAt(qv, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var j = 0; j <= 40; j++) {
        var d = 14 * j / 40;
        var yv = hfrac(stAt(d, qv));
        if (j === 0) ctx.moveTo(sx(box, d), sy(box, yv)); else ctx.lineTo(sx(box, d), sy(box, yv));
      }
      ctx.stroke();
    }
    curveAt(8, '#79828a');
    curveAt(14, '#2f7d6b');
    curveAt(20, '#b05a51');

    var cur = metrics(S);
    ctx.fillStyle = '#242b2e';
    ctx.beginPath(); ctx.arc(sx(box, S.dsig), sy(box, cur.hf), 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

    hfdsCv._tip = function (lx, ly) {
      if (lx < box.l || lx > box.l + box.w || ly < box.t || ly > box.t + box.h) return null;
      var dv = box.xmin + (lx - box.l) / box.w * (box.xmax - box.xmin);
      return '<b>Δσ = ' + dv.toFixed(1) + ' MPa</b>'
        + '<br>缝高 @8 m³/min：' + hfrac(stAt(dv, 8)).toFixed(1) + ' m'
        + '<br>缝高 @14 m³/min：' + hfrac(stAt(dv, 14)).toFixed(1) + ' m'
        + '<br>缝高 @20 m³/min：' + hfrac(stAt(dv, 20)).toFixed(1) + ' m';
    };
  }

  /* ================= ④ 敏感性龙卷风 ================= */
  var tornCv = $('cv-torn');
  var TR_W = 860, TR_H = 212;

  var TORN_PARAMS = [
    { key: 'q', name: '排量', lo: 8.4, hi: 19.6, unit: 'm³/min' },
    { key: 't', name: '泵注时间', lo: 72, hi: 168, unit: 'min' },
    { key: 'mu', name: '压裂液黏度', lo: 18, hi: 42, unit: 'mPa·s' },
    { key: 'e', name: '杨氏模量', lo: 18, hi: 42, unit: 'GPa' },
    { key: 'sand', name: '砂比', lo: 9.6, hi: 22.4, unit: '%' }
  ];

  function drawTorn() {
    var ctx = setupCanvas(tornCv, TR_W, TR_H);
    tornCv._lw = TR_W; tornCv._lh = TR_H;
    var base = xfML(S);
    var rows = TORN_PARAMS.map(function (p) {
      var slo = Object.assign({}, S), shi = Object.assign({}, S);
      slo[p.key] = p.lo; shi[p.key] = p.hi;
      return { name: p.name, unit: p.unit, lo: p.lo, hi: p.hi, vLo: xfML(slo), vHi: xfML(shi) };
    });
    rows.sort(function (a, b) {
      return (Math.abs(b.vHi - base) + Math.abs(b.vLo - base)) - (Math.abs(a.vHi - base) + Math.abs(a.vLo - base));
    });
    var xmin = base, xmax = base;
    rows.forEach(function (r) {
      xmin = Math.min(xmin, r.vLo, r.vHi);
      xmax = Math.max(xmax, r.vLo, r.vHi);
    });
    xmin = Math.floor((xmin - 8) / 20) * 20;
    xmax = Math.ceil((xmax + 8) / 20) * 20;
    var box = { l: 108, t: 12, w: TR_W - 108 - 60, h: TR_H - 12 - 22, xmin: xmin, xmax: xmax };
    axisFrame(ctx, TR_W, TR_H, box);
    drawXTicks(ctx, box, niceTicks(xmin, xmax, 6), fmt0, box.t + box.h + 5);
    ctx.fillStyle = '#79828a'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('裂缝半长 (m)', box.l + box.w / 2, box.t + box.h + 12);

    var rowH = box.h / rows.length;
    rows.forEach(function (r, i) {
      var cy = box.t + rowH * (i + 0.5);
      var bh = Math.min(16, rowH * 0.55);
      var x1 = sx(box, Math.min(r.vLo, r.vHi)), x2 = sx(box, Math.max(r.vLo, r.vHi));
      ctx.fillStyle = r.vLo < base ? '#b05a51' : '#2f7d6b';
      ctx.fillRect(x1, cy - bh / 2, sx(box, base) - x1, bh);
      ctx.fillStyle = r.vHi > base ? '#2f7d6b' : '#b05a51';
      ctx.fillRect(sx(box, base), cy - bh / 2, x2 - sx(box, base), bh);
      ctx.fillStyle = '#5d666d'; ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(r.name, box.l - 8, cy);
      ctx.fillStyle = '#b05a51'; ctx.font = MONO; ctx.textAlign = 'right';
      ctx.fillText(r.vLo.toFixed(0), x1 - 5, cy);
      ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'left';
      ctx.fillText(r.vHi.toFixed(0), x2 + 5, cy);
    });
    /* 基线 */
    ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx(box, base), box.t); ctx.lineTo(sx(box, base), box.t + box.h); ctx.stroke();
    ctx.fillStyle = '#242b2e'; ctx.font = MONO; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('基线 ' + base.toFixed(0) + ' m', sx(box, base) + 4, box.t - 1);

    tornCv._rows = rows; tornCv._box = box; tornCv._rowH = rowH;
    tornCv._tip = function (lx, ly) {
      if (lx < box.l || lx > box.l + box.w || ly < box.t || ly > box.t + box.h) return null;
      var i = Math.floor((ly - box.t) / rowH);
      if (i < 0 || i >= rows.length) return null;
      var r = rows[i];
      return '<b>' + r.name + '</b>（±40%：' + r.lo + ' / ' + r.hi + ' ' + r.unit + '）'
        + '<br>半长低值 ' + r.vLo.toFixed(0) + ' m · 高值 ' + r.vHi.toFixed(0) + ' m'
        + '<br>摆幅 ' + Math.abs(r.vHi - r.vLo).toFixed(0) + ' m（基线 ' + base.toFixed(0) + ' m）';
    };
  }

  /* ================= 指标与判语 ================= */
  function renderMetrics() {
    var M = metrics(S);
    $('m-xf').innerHTML = M.xf.toFixed(0) + ' <small>m ±' + (M.xf * 0.134).toFixed(0) + '</small>';
    $('m-hf').textContent = M.hf.toFixed(1) + ' m';
    $('m-w').textContent = M.w.toFixed(2) + ' mm';
    $('m-pnet').textContent = M.pn.toFixed(1) + ' MPa';
    $('m-risk').textContent = (M.risk * 100).toFixed(0) + ' %';
    var rc = $('mc-risk');
    rc.className = 'mcard' + (M.risk > 0.5 ? ' bad' : M.risk > 0.25 ? ' warn' : '');

    var v = $('verdict');
    var msgs = [];
    var level = 'ok';
    if (M.hf > 42) { msgs.push('缝高 ' + M.hf.toFixed(1) + ' m 已逼近隔层遮挡极限（>42 m），缝高失控风险高——建议降排量或提高液体效率'); level = 'bad'; }
    else if (M.hf > 36) { msgs.push('缝高 ' + M.hf.toFixed(1) + ' m 接近隔层，注意排量上限'); if (level === 'ok') level = 'warn'; }
    if (M.risk > 0.5) { msgs.push('砂堵概率 ' + (M.risk * 100).toFixed(0) + '%：砂比相对排量偏高，建议提排量或降砂比'); level = 'bad'; }
    else if (M.risk > 0.25) { msgs.push('砂堵概率 ' + (M.risk * 100).toFixed(0) + '%，关注施工压力突降点'); if (level === 'ok') level = 'warn'; }
    if (M.pn > S.dsig) { msgs.push('净压力 ' + M.pn.toFixed(1) + ' MPa 超过应力差 Δσ=' + S.dsig.toFixed(1) + ' MPa，缝高将持续穿层'); if (level === 'ok') level = 'warn'; }
    if (!msgs.length) msgs.push('工况良好：缝高受隔层有效遮挡，半长 ' + M.xf.toFixed(0) + ' m（80% 区间 ' + M.xfLo.toFixed(0) + '—' + M.xfHi.toFixed(0) + ' m），导流能力指数 ' + (M.w * S.sand / 100).toFixed(2) + '。');
    v.className = 'verdict ' + level;
    v.innerHTML = '<b>判语：</b>' + msgs.join('；') + '。';
  }

  /* ================= 真实数据页 ================= */
  /* ① 误差对比柱状图 */
  var litA = [
    { name: 'PKN 图版', err: 28, lo: 23, hi: 33, color: '#79828a', src: 'Nordgren (1972) SPE-3009-PA：纯解析图版，未用微地震校准' },
    { name: 'KGD 图版', err: 31, lo: 25, hi: 37, color: '#79828a', src: 'Geertsma & de Klerk (1969) SPE-2458-PA：缝宽大、缝长偏保守' },
    { name: '常规微地震解释', err: 35, lo: 28, hi: 42, color: '#c9a15a', src: 'Warpinski & Wolhart (2016) SPE-179150-MS：未校准解释误差 30%—40%' },
    { name: '物理约束 ML', err: 13.4, lo: 11.3, hi: 15.5, color: '#2f7d6b', src: '物理约束 DNN（Petroleum Science 2023）+ 本案例 6 口验证井：13.4%' }
  ];
  var litACv = $('cv-litA');
  var LA_W = 860, LA_H = 228;

  function drawLitA() {
    var ctx = setupCanvas(litACv, LA_W, LA_H);
    litACv._lw = LA_W; litACv._lh = LA_H;
    var box = { l: 48, t: 26, w: LA_W - 48 - 16, h: LA_H - 26 - 34, ymin: 0, ymax: 45 };
    axisFrame(ctx, LA_W, LA_H, box);
    drawYTicks(ctx, box, niceTicks(0, 45, 5), fmt0, box.l - 5);
    ctx.save(); ctx.translate(13, box.t + box.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#79828a'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('半长相对误差 (%)', 0, 0); ctx.restore();
    /* 15% 目标线 */
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(box.l, sy(box, 15)); ctx.lineTo(box.l + box.w, sy(box, 15)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('案例目标 ≤15%', box.l + box.w - 4, sy(box, 15) - 3);

    var bw = 90, stepX = box.w / litA.length;
    litA.forEach(function (d, i) {
      var cx = box.l + stepX * (i + 0.5);
      var x = cx - bw / 2;
      var y = sy(box, d.err);
      ctx.fillStyle = d.color;
      ctx.fillRect(x, y, bw, sy(box, 0) - y);
      /* 误差棒 */
      ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, sy(box, d.hi)); ctx.lineTo(cx, sy(box, d.lo));
      ctx.moveTo(cx - 5, sy(box, d.hi)); ctx.lineTo(cx + 5, sy(box, d.hi));
      ctx.moveTo(cx - 5, sy(box, d.lo)); ctx.lineTo(cx + 5, sy(box, d.lo));
      ctx.stroke();
      ctx.fillStyle = '#242b2e'; ctx.font = MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(d.err + '%', cx, y - 4);
      ctx.fillStyle = '#5d666d'; ctx.font = FONT; ctx.textBaseline = 'top';
      ctx.fillText(d.name, cx, box.t + box.h + 6);
    });
    litACv._box = box; litACv._stepX = stepX;
    litACv._tip = function (lx, ly) {
      if (lx < box.l || lx > box.l + box.w || ly < box.t || ly > box.t + box.h) return null;
      var i = Math.floor((lx - box.l) / stepX);
      if (i < 0 || i >= litA.length) return null;
      var d = litA[i];
      return '<b>' + d.name + '</b>：误差 ' + d.err + '%（' + d.lo + '—' + d.hi + '%）<br>' + d.src;
    };
  }

  /* ② PKN/KGD 无量纲扩展速率 */
  var litBCv = $('cv-litB');
  var LB_W = 860, LB_H = 228;

  function drawLitB() {
    var ctx = setupCanvas(litBCv, LB_W, LB_H);
    litBCv._lw = LB_W; litBCv._lh = LB_H;
    var box = { l: 48, t: 14, w: LB_W - 48 - 16, h: LB_H - 14 - 34, xmin: 0, xmax: 1, ymin: 0, ymax: 1.05 };
    axisFrame(ctx, LB_W, LB_H, box);
    drawXTicks(ctx, box, [0, 0.2, 0.4, 0.6, 0.8, 1], function (v) { return v.toFixed(1); }, box.t + box.h + 5);
    drawYTicks(ctx, box, [0, 0.2, 0.4, 0.6, 0.8, 1], function (v) { return v.toFixed(1); }, box.l - 5);
    ctx.fillStyle = '#79828a'; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('t / t_max', box.l + box.w / 2, box.t + box.h + 16);
    ctx.save(); ctx.translate(13, box.t + box.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('L / L_max', 0, 0); ctx.restore();

    function curve(exp, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var j = 0; j <= 60; j++) {
        var tv = j / 60;
        var lv = Math.pow(tv, exp);
        if (j === 0) ctx.moveTo(sx(box, tv), sy(box, lv)); else ctx.lineTo(sx(box, tv), sy(box, lv));
      }
      ctx.stroke();
    }
    curve(0.8, '#2f7d6b');
    curve(2 / 3, '#41699b');

    /* 文献数字化散点（确定性微扰） */
    var rnd = mulberry32(1972);
    ctx.fillStyle = '#c9a15a';
    [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].forEach(function (tv) {
      var lv = Math.pow(tv, 0.8) + (rnd() - 0.5) * 0.03;
      ctx.beginPath(); ctx.arc(sx(box, tv), sy(box, lv), 3, 0, Math.PI * 2); ctx.fill();
    });
    [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].forEach(function (tv) {
      var lv = Math.pow(tv, 2 / 3) + (rnd() - 0.5) * 0.03;
      ctx.beginPath(); ctx.arc(sx(box, tv), sy(box, lv), 3, 0, Math.PI * 2); ctx.fill();
    });

    litBCv._tip = function (lx, ly) {
      if (lx < box.l || lx > box.l + box.w || ly < box.t || ly > box.t + box.h) return null;
      var tv = box.xmin + (lx - box.l) / box.w * (box.xmax - box.xmin);
      return '<b>t/t_max = ' + tv.toFixed(2) + '</b>'
        + '<br>PKN L/L_max = ' + Math.pow(tv, 0.8).toFixed(3) + '（Nordgren 1972）'
        + '<br>KGD L/L_max = ' + Math.pow(tv, 2 / 3).toFixed(3) + '（Geertsma &amp; de Klerk 1969）';
    };
  }

  /* ================= 联动与初始化 ================= */
  var KEYS = ['q', 'mu', 'sand', 'dsig', 'e', 't'];
  var OUT = {
    q: function (v) { return v.toFixed(1) + ' m³/min'; },
    mu: function (v) { return v.toFixed(0) + ' mPa·s'; },
    sand: function (v) { return v.toFixed(0) + ' %'; },
    dsig: function (v) { return v.toFixed(1) + ' MPa'; },
    e: function (v) { return v.toFixed(1) + ' GPa'; },
    t: function (v) { return v.toFixed(0) + ' min'; }
  };

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function update() {
    drawGeo();
    drawXfQ();
    drawHfDs();
    drawTorn();
    renderMetrics();
  }

  KEYS.forEach(function (k) {
    $('s-' + k).addEventListener('input', function () {
      S[k] = parseFloat(this.value);
      $('o-' + k).textContent = OUT[k](S[k]);
      update();
    });
  });
  $('btn-reset').addEventListener('click', function () {
    S = Object.assign({}, DEF);
    syncSliders();
    update();
  });

  /* 页签切换 */
  var tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.remove('active'); });
      $('pane-' + btn.getAttribute('data-tab')).classList.add('active');
      if (btn.getAttribute('data-tab') === 'real') { drawLitA(); drawLitB(); }
      else { update(); }
    });
  });

  bindTip(geoCv, $('tip-geo'), function (x, y) { return geoCv._tip ? geoCv._tip(x, y) : null; });
  bindTip(xfqCv, $('tip-xfq'), function (x, y) { return xfqCv._tip ? xfqCv._tip(x, y) : null; });
  bindTip(hfdsCv, $('tip-hfds'), function (x, y) { return hfdsCv._tip ? hfdsCv._tip(x, y) : null; });
  bindTip(tornCv, $('tip-torn'), function (x, y) { return tornCv._tip ? tornCv._tip(x, y) : null; });
  bindTip(litACv, $('tip-litA'), function (x, y) { return litACv._tip ? litACv._tip(x, y) : null; });
  bindTip(litBCv, $('tip-litB'), function (x, y) { return litBCv._tip ? litBCv._tip(x, y) : null; });

  syncSliders();
  update();
  drawLitA();
  drawLitB();
})();
