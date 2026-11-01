/* ======= 油气计量智能校正 · 流量计漂移诊断 可运行示范 ======= */
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

  /* 确定性伪噪声（保证每次渲染一致） */
  function nz(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function n2(i) { return nz(i) * 2 - 1; }

  var DEF = { mode: 'linear', rate: 0.4, scale: 0.3, tdev: 8, pdev: 4, thr: 0.5, cycle: 12, comp: 1, recon: 1 };
  var S = Object.assign({}, DEF);
  var T_END = 24;               /* 时间轴 0—24 月 */
  var D_ORIF = 50;              /* 孔板孔径 mm */

  /* ---------- 物理 / 统计模型 ---------- */

  /* 结垢导致的孔板示值偏高 %（ISO 5167 平方根关系：q ∝ d²） */
  function orificeBias() {
    return (Math.pow(D_ORIF / (D_ORIF - S.scale), 2) - 1) * 100;
  }

  /* 未补偿温压偏差引起的体积计量误差 %：≈ ½·(Δp/p − ΔT/T)，T=293.15 K */
  function tpBiasRaw() {
    return 0.5 * (S.pdev - S.tdev * 100 / 293.15);
  }
  /* 补偿开关生效时残余 5% */
  function tpBias() {
    return tpBiasRaw() * (S.comp ? 0.05 : 1);
  }

  /* 原始误差（无定期检定、无 AI 校正），t 单位月 */
  function rawErr(t) {
    var e = 0.06 * n2(Math.round(t * 3));
    if (S.mode === 'zero') {
      e += (t >= 6 ? 3 * S.rate : 0) + 0.05 * S.rate * t;
    } else if (S.mode === 'linear') {
      e += S.rate * 0.25 * t + orificeBias() * (t / T_END);
    } else {
      var sig = 0.08 + 0.05 * S.rate * t;
      e += 0.12 * S.rate * t + sig * n2(Math.round(t * 7))
        + (nz(Math.round(t * 13)) > 0.93 ? 1.8 * S.rate * n2(Math.round(t * 17)) : 0);
    }
    return e + tpBias();
  }

  /* 定期检定复位后的误差（每 cycle 月送检复位一次） */
  function calErr(t) {
    var k = Math.floor(t / S.cycle);
    var anchor = k * S.cycle;
    return rawErr(t) - (anchor > 0 ? rawErr(anchor) : 0);
  }

  /* AI 检出月份：滚动窗（2 月）|残差|均值或标准差超阈值即判漂移 */
  function detectMonth() {
    var t, i, m, sd, w = [];
    for (t = 0; t <= T_END; t += 0.25) {
      w.push(calErr(t));
      if (w.length > 8) w.shift();
      if (w.length >= 5) {
        m = 0; for (i = 0; i < w.length; i++) m += w[i];
        m /= w.length;
        sd = 0; for (i = 0; i < w.length; i++) sd += (w[i] - m) * (w[i] - m);
        sd = Math.sqrt(sd / w.length);
        if (Math.abs(m) > S.thr || sd > S.thr * 0.9) return t;
      }
    }
    return null;
  }

  /* AI 校正后误差：检出后按近 2 月残差均值施加校正系数 */
  var residAmp = function () { return S.recon ? 0.12 : 0.25; };
  function corrErr(t, td) {
    var v = calErr(t);
    if (td === null || t < td) return v;
    var est = 0, n = 0, u;
    for (u = Math.max(0, td - 2); u <= td; u += 0.25) { est += calErr(u); n++; }
    est /= n;
    return v - est + residAmp() * n2(Math.round(t * 5));
  }

  /* 预测超差（|误差| 达 1%）时间，扫描 0—60 月 */
  function overMonth() {
    for (var t = 0; t <= 60; t += 0.25) {
      if (Math.abs(rawErr(t)) >= 1) return t;
    }
    return null;
  }

  /* ---------- 全局派生量（每次参数变化重算一次） ---------- */
  var G = {};
  function recompute() {
    var td = detectMonth();
    var tOver = overMonth();
    var med = [], t;
    if (td !== null) {
      for (t = td; t <= T_END; t += 0.25) med.push(Math.abs(corrErr(t, td)));
      med.sort(function (a, b) { return a - b; });
    }
    var medCorr = med.length ? med[Math.floor(med.length / 2)] : null;
    var raw24 = rawErr(T_END);
    var disputeBefore = 410 * (Math.abs(raw24) / 3.1);
    var disputeAfter = disputeBefore * 0.37 * (S.recon ? 0.85 : 1);
    var recCycle = tOver === null ? 18 : clamp(Math.floor(tOver * 0.8 * (S.recon ? 1.3 : 1)), 6, 18);
    G = {
      td: td, tOver: tOver, medCorr: medCorr, raw24: raw24,
      disputeBefore: disputeBefore, disputeAfter: disputeAfter, recCycle: recCycle
    };
  }

  /* ---------- 通用绘图 ---------- */
  function line(ctx, x1, y1, x2, y2, color, w, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 1;
    ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
  }
  function txt(ctx, s, x, y, color, align, base, font) {
    ctx.fillStyle = color; ctx.font = font || '9px Consolas, monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function dot(ctx, x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function diamond(ctx, x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
  }

  /* ---------- 图① 误差-时间漂移曲线 ---------- */
  var DW = 860, DH = 252, DPL = 46, DPR = 14, DPT = 14, DPB = 26;
  var DPW = DW - DPL - DPR, DPH = DH - DPT - DPB;
  var driftMeta = { ymin: -1.5, ymax: 4 };

  function dX(t) { return DPL + (t / T_END) * DPW; }
  function dY(e) { return DPT + (driftMeta.ymax - e) / (driftMeta.ymax - driftMeta.ymin) * DPH; }

  function drawDrift() {
    var cv = $('cv-drift');
    var ctx = setupCanvas(cv, DW, DH);
    ctx.clearRect(0, 0, DW, DH);

    /* 动态量程 */
    var mx = 4, mn = -1.5, t;
    for (t = 0; t <= T_END; t += 0.25) {
      mx = Math.max(mx, calErr(t) + 0.4);
      mn = Math.min(mn, corrErr(t, G.td) - 0.4);
    }
    driftMeta.ymax = Math.ceil(mx * 2) / 2;
    driftMeta.ymin = Math.floor(mn * 2) / 2;

    /* ±0.5% 检定限带 */
    ctx.fillStyle = 'rgba(65,105,155,0.09)';
    ctx.fillRect(DPL, dY(0.5), DPW, dY(-0.5) - dY(0.5));

    /* 网格与 y 轴刻度（1% 步长） */
    var e;
    for (e = Math.ceil(driftMeta.ymin); e <= driftMeta.ymax; e++) {
      var y = dY(e);
      line(ctx, DPL, y, DPL + DPW, y, e === 0 ? '#c9c2b0' : '#eee9db', e === 0 ? 1 : 0.6);
      txt(ctx, (e > 0 ? '+' : '') + e + '%', DPL - 6, y, '#79828a', 'right', 'middle');
    }
    /* ±0.5% 与 ±1.0% 限线 */
    [-0.5, 0.5].forEach(function (v) { line(ctx, DPL, dY(v), DPL + DPW, dY(v), '#41699b', 1); });
    [-1, 1].forEach(function (v) { line(ctx, DPL, dY(v), DPL + DPW, dY(v), '#b05a51', 1, [5, 4]); });
    txt(ctx, '±0.5% 检定限带', DPL + DPW - 4, dY(0.5) - 4, '#41699b', 'right', 'alphabetic', '9px sans-serif');
    txt(ctx, '+1.0% 超差', DPL + DPW - 4, dY(1) - 4, '#b05a51', 'right', 'alphabetic', '9px sans-serif');

    /* x 轴刻度 */
    for (t = 0; t <= T_END; t += 3) {
      var x = dX(t);
      line(ctx, x, DPT + DPH, x, DPT + DPH + 3, '#a9b0b6', 0.8);
      txt(ctx, t + '', x, DPT + DPH + 14, '#79828a', 'center');
    }
    txt(ctx, '时间（月）', DPL + DPW, DPT + DPH + 14, '#79828a', 'right');
    txt(ctx, '误差', DPL - 38, DPT - 4, '#79828a', 'left', 'alphabetic', '9px sans-serif');

    /* 检定复位竖线 */
    var k;
    for (k = 1; k * S.cycle < T_END; k++) {
      line(ctx, dX(k * S.cycle), DPT, dX(k * S.cycle), DPT + DPH, '#a9b0b6', 0.8, [3, 3]);
      txt(ctx, '检定复位', dX(k * S.cycle) + 3, DPT + 8, '#8a9298', 'left', 'alphabetic', '8.5px sans-serif');
    }

    /* 原始误差曲线（红）与 AI 校正后曲线（绿） */
    function stroke(fn, color, w) {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
      for (var i = 0; i <= T_END / 0.25; i++) {
        var tt = i * 0.25, x = dX(tt), y = dY(fn(tt));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    stroke(function (t) { return calErr(t); }, '#b05a51', 1.6);
    stroke(function (t) { return corrErr(t, G.td); }, '#2f7d6b', 1.6);

    /* AI 检出点 */
    if (G.td !== null) {
      diamond(ctx, dX(G.td), dY(calErr(G.td)), 5, '#c9a15a');
      var lbl = 'AI 检出 ' + G.td.toFixed(1) + ' 月';
      var lx = dX(G.td) + 8;
      if (lx > DPL + DPW - 90) lx = dX(G.td) - 96;
      txt(ctx, lbl, lx, dY(calErr(G.td)) - 8, '#9a7a1c', 'left', 'alphabetic', '9.5px sans-serif');
    }
  }

  /* ---------- 图②a 标准表比对散点 ---------- */
  var SW = 420, SH = 240, SPL = 42, SPR = 10, SPT = 10, SPB = 26;
  var SPW = SW - SPL - SPR, SPH = SH - SPT - SPB;
  var SQ = 200;
  var scatterPts = [];

  function sX(q) { return SPL + (q / SQ) * SPW; }
  function sY(q) { return SPT + (1 - q / SQ) * SPH; }

  function buildScatter() {
    var mt = G.td !== null ? Math.min(G.td, T_END) : Math.min(S.cycle, T_END);
    var eTest = calErr(mt);
    scatterPts = [];
    for (var i = 0; i < 20; i++) {
      var q = 16 + i * 9.2 + 3 * n2(i + 3);
      var dev = eTest + tpBias() * 0.5 + 0.15 * n2(i + 31);
      scatterPts.push({ i: i + 1, std: q, meas: q * (1 + dev / 100), dev: dev });
    }
    return { mt: mt, eTest: eTest };
  }

  function drawScatter() {
    var cv = $('cv-scatter');
    var ctx = setupCanvas(cv, SW, SH);
    ctx.clearRect(0, 0, SW, SH);
    var info = buildScatter();

    /* ±0.5% 偏差带（两条线之间的区域用多边形填充） */
    ctx.fillStyle = 'rgba(65,105,155,0.10)';
    ctx.beginPath();
    ctx.moveTo(sX(0), sY(0));
    ctx.lineTo(sX(SQ), sY(SQ * 1.005));
    ctx.lineTo(sX(SQ), sY(SQ * 0.995));
    ctx.closePath(); ctx.fill();

    /* 网格与刻度 */
    var q;
    for (q = 0; q <= SQ; q += 50) {
      line(ctx, sX(q), SPT, sX(q), SPT + SPH, '#eee9db', 0.6);
      line(ctx, SPL, sY(q), SPL + SPW, sY(q), '#eee9db', 0.6);
      txt(ctx, q + '', sX(q), SPT + SPH + 14, '#79828a', 'center');
      txt(ctx, q + '', SPL - 5, sY(q), '#79828a', 'right', 'middle');
    }
    txt(ctx, '标准装置值 q (m³/h)', SPL + SPW, SPT + SPH + 14, '#79828a', 'right');
    txt(ctx, '被检表 q′', 4, SPT - 2, '#79828a', 'left', 'alphabetic', '9px sans-serif');

    /* y=x 参考线 与 ±0.5% / ±1% 线 */
    line(ctx, sX(0), sY(0), sX(SQ), sY(SQ), '#79828a', 1.2);
    line(ctx, sX(0), sY(0), sX(SQ), sY(SQ * 1.005), '#41699b', 0.9);
    line(ctx, sX(0), sY(0), sX(SQ), sY(SQ * 0.995), '#41699b', 0.9);
    line(ctx, sX(0), sY(0), sX(SQ), sY(SQ * 1.01), '#b05a51', 0.9, [5, 4]);
    line(ctx, sX(0), sY(0), sX(SQ), sY(SQ * 0.99), '#b05a51', 0.9, [5, 4]);
    txt(ctx, 'y = x', sX(176), sY(182) - 4, '#5d666d', 'center', 'alphabetic', '9px sans-serif');
    txt(ctx, '+0.5%', sX(196), sY(196 * 1.005) + 3, '#41699b', 'center', 'alphabetic', '8.5px sans-serif');
    txt(ctx, '−0.5%', sX(196), sY(196 * 0.995) + 9, '#41699b', 'center', 'alphabetic', '8.5px sans-serif');

    /* 检定点 */
    scatterPts.forEach(function (p) {
      var bad = Math.abs(p.dev) > 0.5;
      dot(ctx, sX(p.std), sY(p.meas), 3.2, bad ? '#b05a51' : '#2f7d6b');
    });

    txt(ctx, '比对月 ' + info.mt.toFixed(1) + ' · 系统偏差 ' +
      (info.eTest >= 0 ? '+' : '') + info.eTest.toFixed(2) + '%',
      SPL + 4, SPT + 10, '#9a7a1c', 'left', 'alphabetic', '9.5px sans-serif');
  }

  /* ---------- 图②b 温压补偿前后对比 ---------- */
  var CW = 420, CH = 240, CPL = 42, CPR = 10, CPT = 10, CPB = 26;
  var CPW = CW - CPL - CPR, CPH = CH - CPT - CPB;
  var compPts = [];
  var compMeta = { ymin: -1, ymax: 1 };

  function cX(i) { return CPL + (i / 9) * CPW; }
  function cY(e) { return CPT + (compMeta.ymax - e) / (compMeta.ymax - compMeta.ymin) * CPH; }

  function buildComp() {
    var mt = G.td !== null ? Math.min(G.td, T_END) : Math.min(S.cycle, T_END);
    var eTest = calErr(mt);
    compPts = [];
    for (var i = 0; i < 10; i++) {
      var q = 20 + i * 20;
      compPts.push({
        q: q,
        before: eTest + tpBiasRaw() + 0.2 * n2(i + 7),
        after: eTest + tpBias() + 0.1 * n2(i + 13)
      });
    }
    return eTest;
  }

  function drawComp() {
    var cv = $('cv-comp');
    var ctx = setupCanvas(cv, CW, CH);
    ctx.clearRect(0, 0, CW, CH);
    buildComp();

    var mx = 1, mn = -1, i;
    compPts.forEach(function (p) {
      mx = Math.max(mx, p.before + 0.3, p.after + 0.3);
      mn = Math.min(mn, p.before - 0.3, p.after - 0.3);
    });
    compMeta.ymax = Math.ceil(mx * 2) / 2;
    compMeta.ymin = Math.floor(mn * 2) / 2;

    /* ±0.5% 带 */
    ctx.fillStyle = 'rgba(65,105,155,0.10)';
    var yTop = cY(0.5), yBot = cY(-0.5);
    ctx.fillRect(CPL, Math.max(CPT, yTop), CPW, Math.min(CPT + CPH, yBot) - Math.max(CPT, yTop));

    var e;
    for (e = Math.ceil(compMeta.ymin); e <= compMeta.ymax; e++) {
      line(ctx, CPL, cY(e), CPL + CPW, cY(e), e === 0 ? '#c9c2b0' : '#eee9db', e === 0 ? 1 : 0.6);
      txt(ctx, (e > 0 ? '+' : '') + e + '%', CPL - 5, cY(e), '#79828a', 'right', 'middle');
    }
    for (i = 0; i < 10; i += 2) {
      line(ctx, cX(i), CPT + CPH, cX(i), CPT + CPH + 3, '#a9b0b6', 0.8);
      txt(ctx, (20 + i * 20) + '', cX(i), CPT + CPH + 14, '#79828a', 'center');
    }
    txt(ctx, '流量点 q (m³/h)', CPL + CPW, CPT + CPH + 14, '#79828a', 'right');
    txt(ctx, '误差', 4, CPT - 2, '#79828a', 'left', 'alphabetic', '9px sans-serif');
    [-0.5, 0.5].forEach(function (v) { line(ctx, CPL, cY(v), CPL + CPW, cY(v), '#41699b', 0.9); });

    function stroke(key, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
      compPts.forEach(function (p, i) {
        var x = cX(i), y = cY(p[key]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      compPts.forEach(function (p, i) { dot(ctx, cX(i), cY(p[key]), 2.6, color); });
    }
    stroke('before', '#b05a51');
    stroke('after', '#2f7d6b');
    txt(ctx, '补偿前', CPL + 6, cY(compPts[0].before) - 7, '#b05a51', 'left', 'alphabetic', '9px sans-serif');
    txt(ctx, S.comp ? '补偿后（温压修正）' : '补偿后（未启用补偿）', CPL + 6, cY(compPts[0].after) + 12, '#2f7d6b', 'left', 'alphabetic', '9px sans-serif');
  }

  /* ---------- 图③ 月度残差与滚动均值 ---------- */
  var RW = 420, RH = 196, RPL = 42, RPR = 10, RPT = 10, RPB = 24;
  var RPW = RW - RPL - RPR, RPH = RH - RPT - RPB;
  var residMeta = { ymax: 1 };
  var residData = [];

  function rX(i) { return RPL + ((i + 0.5) / T_END) * RPW; }
  function rY(e) { return RPT + (residMeta.ymax - e) / (2 * residMeta.ymax) * RPH; }

  function buildResid() {
    residData = [];
    var i, j, m, v;
    for (i = 0; i < T_END; i++) {
      var win = [];
      for (j = Math.max(0, i - 1); j <= Math.min(T_END, i + 1); j++) win.push(calErr(j));
      m = 0; win.forEach(function (x) { m += x; }); m /= win.length;
      v = calErr(i + 0.5) - m;
      residData.push({ mo: i + 1, r: v, roll: 0 });
    }
    for (i = 0; i < T_END; i++) {
      m = 0;
      for (j = Math.max(0, i - 1); j <= Math.min(T_END - 1, i + 1); j++) m += residData[j].r;
      residData[i].roll = m / (Math.min(T_END - 1, i + 1) - Math.max(0, i - 1) + 1);
    }
  }

  function drawResid() {
    var cv = $('cv-resid');
    var ctx = setupCanvas(cv, RW, RH);
    ctx.clearRect(0, 0, RW, RH);
    buildResid();

    var mx = Math.max(0.6, S.thr * 1.4), i;
    residData.forEach(function (d) { mx = Math.max(mx, Math.abs(d.r) * 1.2); });
    residMeta.ymax = Math.ceil(mx * 4) / 4;

    /* 网格与刻度 */
    var step = residMeta.ymax > 1.4 ? 1 : 0.5;
    for (var e = -residMeta.ymax; e <= residMeta.ymax + 1e-9; e += step) {
      var ev = Math.round(e * 4) / 4;
      line(ctx, RPL, rY(ev), RPL + RPW, rY(ev), ev === 0 ? '#c9c2b0' : '#eee9db', ev === 0 ? 1 : 0.6);
      txt(ctx, (ev > 0 ? '+' : '') + ev.toFixed(1), RPL - 5, rY(ev), '#79828a', 'right', 'middle');
    }
    for (i = 0; i < T_END; i += 3) {
      txt(ctx, (i + 1) + '', rX(i), RPT + RPH + 13, '#79828a', 'center');
    }
    txt(ctx, '月份', RPL + RPW, RPT + RPH + 13, '#79828a', 'right');
    txt(ctx, '残差 %', 2, RPT - 2, '#79828a', 'left', 'alphabetic', '9px sans-serif');
    [-S.thr, S.thr].forEach(function (v) { line(ctx, RPL, rY(v), RPL + RPW, rY(v), '#41699b', 0.9, [4, 3]); });
    txt(ctx, '±阈值 ' + S.thr.toFixed(2) + '%', RPL + RPW - 2, rY(S.thr) - 3, '#41699b', 'right', 'alphabetic', '8.5px sans-serif');

    /* 柱条 */
    var bw = Math.max(3, RPW / T_END * 0.62);
    residData.forEach(function (d, i) {
      var x = rX(i), y0 = rY(0), y1 = rY(d.r);
      ctx.fillStyle = Math.abs(d.r) > S.thr ? '#b05a51' : '#70a195';
      ctx.fillRect(x - bw / 2, Math.min(y0, y1), bw, Math.max(1, Math.abs(y1 - y0)));
    });

    /* 滚动均值线 */
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.6; ctx.beginPath();
    residData.forEach(function (d, i) {
      var x = rX(i), y = rY(d.roll);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  /* ---------- 诊断得分（在未复位的原始误差序列上提取特征） ---------- */
  function diagScores() {
    var pts = [], i;
    for (i = 0; i <= T_END; i++) pts.push(rawErr(i));
    var n = pts.length;
    /* 偏置：持续性水平跳变（前 3 月均值 → 后 3 月均值的最大变化） */
    var step = 0, j;
    for (i = 3; i < n - 3; i++) {
      var mb = 0, ma = 0;
      for (j = i - 3; j < i; j++) mb += pts[j];
      for (j = i + 1; j <= Math.min(n - 1, i + 3); j++) ma += pts[j];
      step = Math.max(step, Math.abs(ma / Math.min(3, n - 1 - i) - mb / 3));
    }
    /* 脉动：月际差分标准差（对噪声敏感、对平滑趋势与单次阶跃不敏感） */
    var diffs = [];
    for (i = 1; i < n; i++) diffs.push(pts[i] - pts[i - 1]);
    var dm = 0; diffs.forEach(function (v) { dm += v; }); dm /= diffs.length;
    var diffSd = 0; diffs.forEach(function (v) { diffSd += (v - dm) * (v - dm); });
    diffSd = Math.sqrt(diffSd / diffs.length);
    /* 趋势：最小二乘斜率 × 24 月 */
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (i = 0; i < n; i++) { sx += i; sy += pts[i]; sxy += i * pts[i]; sxx += i * i; }
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    var trend = Math.abs(slope) * T_END;
    var sd = diffSd;
    var a = clamp(step / 1.2, 0, 1.4);
    var b = clamp(trend / 2.4, 0, 1.4);
    var c = clamp(diffSd / 0.4, 0, 1.4);
    var sum = a + b + c + 0.06;
    return {
      zero: a / sum, linear: b / sum, pulse: c / sum,
      step: step, trend: trend, sd: sd
    };
  }

  var MODE_TXT = {
    zero: { name: '零点漂移（偏置型）', advice: '特征为残差阶跃偏置——建议执行零点校准并检查传感器零点与接线。' },
    linear: { name: '线性漂移（结垢/磨损型）', advice: '特征为残差持续单向累积——建议安排孔板清洗并送标准装置检定，清洗后重置基线。' },
    pulse: { name: '脉动异常（流态型）', advice: '特征为残差方差增大而均值不稳——建议检查上游流场扰动、整流器与声道诊断参数（AGA 9）。' }
  };

  function updateDiag() {
    var sc = diagScores();
    var rows = [
      { k: 'zero', v: sc.zero }, { k: 'linear', v: sc.linear }, { k: 'pulse', v: sc.pulse }
    ];
    rows.sort(function (a, b) { return b.v - a.v; });
    ['zero', 'linear', 'pulse'].forEach(function (k) {
      var v = sc[k];
      $('sb-' + k).style.width = (v * 100).toFixed(0) + '%';
      $('sv-' + k).textContent = (v * 100).toFixed(0) + '%';
      $('sr-' + k).classList.remove('top');
    });
    $('sr-' + rows[0].k).classList.add('top');
    var top = MODE_TXT[rows[0].k];
    var dv = $('diag-verdict');
    dv.className = 'verdict ' + (rows[0].v >= 0.5 ? 'ok' : 'warn');
    dv.innerHTML = '诊断结论：<b>' + top.name + '</b>，置信度 <b>' + (rows[0].v * 100).toFixed(0) + '%</b>。' +
      '偏置幅值 <b>' + sc.step.toFixed(2) + '%</b> · 趋势斜率 <b>' + (sc.trend / T_END).toFixed(3) + '%/月</b> · 残差 σ <b>' + sc.sd.toFixed(2) + '%</b>。<br>' + top.advice;
  }

  /* ---------- 指标卡与总结论 ---------- */
  function fmtPct(v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d === undefined ? 2 : d) + '%'; }

  function updateMetrics() {
    var mc = $('mc-cur'), md = $('mc-detect'), mo = $('mc-over'),
      my = $('mc-cycle'), mr = $('mc-corr'), mk = $('mc-risk');
    $('m-cur').innerHTML = fmtPct(G.raw24, 1).replace('%', '<small>%</small>');
    mc.className = 'mcard ' + (Math.abs(G.raw24) > 1 ? 'bad' : '');
    $('m-detect').innerHTML = G.td === null ? '未检出' : G.td.toFixed(1) + '<small> 月</small>';
    md.className = 'mcard ' + (G.td === null ? 'bad' : (G.td <= S.cycle ? '' : 'warn'));
    $('m-over').innerHTML = G.tOver === null ? '&gt;60<small> 月</small>' : G.tOver.toFixed(1) + '<small> 月</small>';
    mo.className = 'mcard ' + (G.tOver !== null && G.tOver <= S.cycle ? 'bad' : (G.tOver !== null && G.tOver <= 24 ? 'warn' : ''));
    $('m-cycle').innerHTML = G.recCycle + '<small> 月</small>';
    my.className = 'mcard ' + (G.recCycle > S.cycle ? '' : 'warn');
    $('m-corr').innerHTML = G.medCorr === null ? '—' : '±' + G.medCorr.toFixed(2) + '<small>%</small>';
    mr.className = 'mcard ' + (G.medCorr !== null && G.medCorr <= 0.5 ? '' : 'warn');
    $('m-risk').innerHTML = Math.round(G.disputeAfter) + '<small> 万元</small>';
    mk.className = 'mcard ' + (G.disputeAfter > 200 ? 'bad' : (G.disputeAfter > 120 ? 'warn' : ''));

    var v = $('verdict');
    var early = G.td !== null ? Math.max(0, S.cycle - G.td) : 0;
    var severe = Math.abs(G.raw24) > 2;
    v.className = 'verdict ' + (severe ? 'bad' : (Math.abs(G.raw24) > 1 ? 'warn' : 'ok'));
    v.innerHTML = '当前参数下 24 个月累积偏差 <b>' + fmtPct(G.raw24, 2) + '</b>' +
      (Math.abs(G.raw24) > 1 ? '（超 1.0% 检定限）' : '（尚在检定限内）') +
      (G.td !== null
        ? '；AI 于第 <b>' + G.td.toFixed(1) + '</b> 月检出' +
          (early > 0 ? '，较 ' + S.cycle + ' 月定期检定提前 <b>' + early.toFixed(1) + '</b> 月' : '，不早于定期检定')
        : '；当前阈值下 <b>未能检出漂移</b>，建议调低检测阈值或延长观察窗') +
      '。建议检定周期 <b>' + G.recCycle + '</b> 月（当前 ' + S.cycle + ' 月）；' +
      (G.medCorr !== null ? '校正后中位误差 <b>±' + G.medCorr.toFixed(2) + '%</b>，' : '') +
      '年纠纷风险由 <b>' + Math.round(G.disputeBefore) + '</b> 万元降至 <b>' + Math.round(G.disputeAfter) + '</b> 万元。';
  }

  /* ---------- Tooltip ---------- */
  function attachTip(cv, tip, LW, LH, pick) {
    cv.addEventListener('mousemove', function (ev) {
      var rect = cv.getBoundingClientRect();
      var lx = (ev.clientX - rect.left) / rect.width * LW;
      var ly = (ev.clientY - rect.top) / rect.height * LH;
      var html = pick(lx, ly);
      if (!html) { tip.style.display = 'none'; return; }
      tip.innerHTML = html;
      var box = cv.parentElement.getBoundingClientRect();
      var px = ev.clientX - box.left + 14, py = ev.clientY - box.top + 12;
      if (px > box.width - 220) px -= 234;
      if (py > box.height - 92) py -= 100;
      tip.style.left = px + 'px';
      tip.style.top = py + 'px';
      tip.style.display = 'block';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function setupTips() {
    attachTip($('cv-drift'), $('tip-drift'), DW, DH, function (lx, ly) {
      if (lx < DPL || lx > DPL + DPW || ly < DPT || ly > DPT + DPH) return null;
      var t = (lx - DPL) / DPW * T_END;
      var raw = calErr(t), cor = corrErr(t, G.td);
      var inBand = Math.abs(raw) <= 0.5;
      return '第 <b>' + t.toFixed(1) + '</b> 月<br>' +
        '原始误差 <b>' + fmtPct(raw) + '</b>（' + (inBand ? '限带内' : '超出 ±0.5% 限带') + '）<br>' +
        'AI 校正后 <b>' + fmtPct(cor) + '</b><br>' +
        (G.td !== null && t >= G.td ? '<span style="color:#35765a">✓ 校正系数已生效</span>' : '<span style="color:#8a9298">校正系数未生效</span>');
    });
    attachTip($('cv-scatter'), $('tip-scatter'), SW, SH, function (lx, ly) {
      var best = null, bd = 1e9;
      scatterPts.forEach(function (p) {
        var dx = lx - sX(p.std), dy = ly - sY(p.meas), d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = p; }
      });
      if (!best || bd > 14 * 14) return null;
      return '检定点 <b>#' + best.i + '</b><br>' +
        '标准值 <b>' + best.std.toFixed(1) + '</b> m³/h<br>' +
        '被检表 <b>' + best.meas.toFixed(1) + '</b> m³/h<br>' +
        '偏差 <b>' + fmtPct(best.dev) + '</b> ' + (Math.abs(best.dev) > 0.5 ? '<span style="color:#b05a51">✗ 超 ±0.5% 带</span>' : '<span style="color:#35765a">✓ 合格</span>');
    });
    attachTip($('cv-comp'), $('tip-comp'), CW, CH, function (lx, ly) {
      if (lx < CPL || lx > CPL + CPW || ly < CPT || ly > CPT + CPH) return null;
      var i = clamp(Math.round((lx - CPL) / CPW * 9), 0, 9);
      var p = compPts[i];
      if (!p) return null;
      return '流量点 <b>' + p.q + '</b> m³/h<br>' +
        '补偿前 <b>' + fmtPct(p.before) + '</b><br>' +
        '补偿后 <b>' + fmtPct(p.after) + '</b><br>' +
        '改善 <b>' + (Math.abs(p.before) - Math.abs(p.after)).toFixed(2) + '</b> pp';
    });
    attachTip($('cv-resid'), $('tip-resid'), RW, RH, function (lx, ly) {
      if (lx < RPL || lx > RPL + RPW || ly < RPT || ly > RPT + RPH) return null;
      var i = clamp(Math.floor((lx - RPL) / RPW * T_END), 0, T_END - 1);
      var d = residData[i];
      if (!d) return null;
      return '第 <b>' + d.mo + '</b> 月<br>' +
        '残差 <b>' + fmtPct(d.r) + '</b> ' + (Math.abs(d.r) > S.thr ? '<span style="color:#b05a51">✗ 超阈值</span>' : '<span style="color:#35765a">✓</span>') + '<br>' +
        '滚动均值 <b>' + fmtPct(d.roll) + '</b>';
    });
  }

  /* ---------- 控制绑定 ---------- */
  var OUT = {
    rate: function (v) { return v.toFixed(2) + ' %/月'; },
    scale: function (v) { return v.toFixed(2) + ' mm'; },
    tdev: function (v) { return (v >= 0 ? '+' : '') + v + ' ℃'; },
    pdev: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + ' %'; },
    thr: function (v) { return v.toFixed(2) + ' %'; },
    cycle: function (v) { return v + ' 月'; }
  };
  var SLIDERS = ['rate', 'scale', 'tdev', 'pdev', 'thr', 'cycle'];

  function refreshOutputs() {
    SLIDERS.forEach(function (k) { $('o-' + k).textContent = OUT[k](S[k]); });
    ['zero', 'linear', 'pulse'].forEach(function (m) {
      $('lb-' + m).classList.toggle('on', S.mode === m);
    });
    $('c-comp').checked = !!S.comp;
    $('c-recon').checked = !!S.recon;
  }

  function renderAll() {
    recompute();
    drawDrift();
    drawScatter();
    drawComp();
    drawResid();
    updateDiag();
    updateMetrics();
  }

  function bind() {
    SLIDERS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        renderAll();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
      r.addEventListener('change', function () {
        S.mode = this.value;
        refreshOutputs();
        renderAll();
      });
    });
    $('c-comp').addEventListener('change', function () { S.comp = this.checked ? 1 : 0; renderAll(); });
    $('c-recon').addEventListener('change', function () { S.recon = this.checked ? 1 : 0; renderAll(); });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      SLIDERS.forEach(function (k) { $('s-' + k).value = DEF[k]; });
      document.querySelector('input[name="mode"][value="' + DEF.mode + '"]').checked = true;
      refreshOutputs();
      renderAll();
    });
    /* 页签切换 */
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        $('pane-' + btn.getAttribute('data-tab')).classList.add('active');
      });
    });
    window.addEventListener('resize', renderAll);
  }

  bind();
  refreshOutputs();
  renderAll();
  setupTips();
})();
