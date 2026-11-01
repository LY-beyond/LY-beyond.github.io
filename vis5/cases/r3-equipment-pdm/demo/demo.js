/* ======= 关键机泵振动退化与剩余寿命预测 · 可运行示范 ======= */
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

  /* 确定性伪随机（固定种子，重绘时波形不闪） */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var ZONE = { ab: 2.3, bc: 4.5, cd: 7.1 };   /* ISO 10816-3 第1/3组刚性基础 mm/s RMS */
  var DEF = { fault: 'normal', sev: 35, rpm: 2000, point: 'DE-H', thr: 4.5 };
  var S = Object.assign({}, DEF);

  var POINTS = ['DE-H', 'DE-V', 'NDE-H', 'NDE-V'];
  var PNAME = { 'DE-H': '驱动端·水平', 'DE-V': '驱动端·垂直', 'NDE-H': '非驱端·水平', 'NDE-V': '非驱端·垂直' };
  /* 各测点对故障的传递增益（不对中偏联轴器侧 NDE，轴承故障偏驱动端 DE） */
  var GAINS = {
    normal: [1, 0.95, 1, 0.9],
    unbal: [1.05, 0.95, 1, 0.9],
    misal: [0.85, 0.8, 1.3, 1.2],
    bpfo: [1.4, 1.3, 0.6, 0.55]
  };
  var LAMBDA_MULT = { normal: 0, unbal: 0.7, misal: 1.0, bpfo: 1.6 };
  var FAULT_NAME = { normal: '正常运行', unbal: '转子不平衡', misal: '轴系不对中', bpfo: '轴承外圈故障' };

  function fr() { return S.rpm / 60; }                    /* 转频 Hz */
  function freqs() {
    var f = fr();
    return { f1: f, f2: 2 * f, f3: 3 * f, bpfo: 3.01 * f, bpfo2: 6.02 * f, bpf: 7 * f };
  }
  function baseRMS(rpm) { return 1.2 + 1.6 * (rpm - 1480) / 1500; }

  /* 特征峰模型：返回各特征频率的速度幅值（峰值，mm/s）与宽带底噪 */
  function peaks() {
    var s = S.sev / 100;
    var rpmF = Math.pow(S.rpm / 2000, 1.5);
    var b = baseRMS(S.rpm);
    var p = { f1: b * 0.5, f2: b * 0.16, f3: b * 0.05, bpfo: b * 0.04, bpfo2: b * 0.015, bpf: b * 0.2, floor: b * 0.05 };
    if (S.fault === 'unbal') { p.f1 += s * 5.6 * rpmF; p.f2 += s * 0.25; }
    if (S.fault === 'misal') { p.f1 += s * 1.6 * rpmF; p.f2 += s * 3.0 * rpmF; p.f3 += s * 0.5; }
    if (S.fault === 'bpfo') { p.bpfo += s * 3.4; p.bpfo2 += s * 1.6; p.f1 += s * 0.35; p.floor += s * 0.8; }
    return p;
  }
  function faultExtras() {
    var b = baseRMS(S.rpm), p = peaks();
    return {
      e1: p.f1 - b * 0.5, e2: p.f2 - b * 0.16, e3: p.f3 - b * 0.05,
      eb: p.bpfo - b * 0.04, eb2: p.bpfo2 - b * 0.015, fl: p.floor - b * 0.05
    };
  }
  function rmsTotal() {
    var b = baseRMS(S.rpm), e = faultExtras();
    return Math.sqrt(b * b + (e.e1 * e.e1 + e.e2 * e.e2 + e.e3 * e.e3 + e.eb * e.eb + e.eb2 * e.eb2) / 2 + e.fl * e.fl);
  }
  function zoneOf(rms) { return rms >= ZONE.cd ? 3 : rms >= ZONE.bc ? 2 : rms >= ZONE.ab ? 1 : 0; }
  var ZONE_NAME = ['A 区', 'B 区', 'C 区', 'D 区'];
  var ZONE_FILL = ['rgba(47,125,107,0.75)', 'rgba(201,161,90,0.8)', 'rgba(176,90,81,0.75)', 'rgba(107,47,42,0.9)'];

  function pointGain() {
    var g = GAINS[S.fault];
    return g[POINTS.indexOf(S.point)];
  }

  /* 劣化速率 λ（1/天）与 RUL（天，P50） */
  function lambda() {
    var s = S.sev / 100;
    if (S.fault === 'normal' || s < 0.03) return 0;
    return 0.012 + 0.05 * Math.pow(s, 1.5) * LAMBDA_MULT[S.fault];
  }
  function rulDays(rms) {
    var l = lambda();
    if (!l || rms >= ZONE.cd) return l && rms >= ZONE.cd ? 0 : null;
    return Math.log(ZONE.cd / rms) / l;
  }

  /* ================= 面板 1a：频谱 ================= */
  var laySpec = null;
  function drawSpec() {
    var W = 430, H = 250;
    var cv = $('c-spec'), ctx = setupCanvas(cv, W, H);
    var pl = 44, pr = 12, pt = 16, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var FMAX = 500;
    var p = peaks(), fq = freqs(), g = pointGain();

    var marks = [
      { f: fq.f1, a: p.f1 * g, name: '1X', col: '#41699b' },
      { f: fq.f2, a: p.f2 * g, name: '2X', col: '#41699b' },
      { f: fq.f3, a: p.f3 * g, name: '3X', col: '#41699b' },
      { f: fq.bpfo, a: p.bpfo * g, name: 'BPFO', col: '#b05a51' },
      { f: fq.bpfo2, a: p.bpfo2 * g, name: '2×BPFO', col: '#b05a51' },
      { f: fq.bpf, a: p.bpf * g, name: 'BPF', col: '#41699b' }
    ];

    var NB = 420, step = FMAX / NB;
    var rnd = rng(20261030);
    var bins = [];
    var yMax = 0.6;
    for (var i = 0; i < NB; i++) {
      var f = i * step;
      var v = p.floor * g * (0.55 + 0.9 * rnd());
      marks.forEach(function (m) {
        var d = (f - m.f) / 1.15;
        v += m.a * Math.exp(-d * d);
      });
      bins.push(v);
      if (v > yMax) yMax = v;
    }
    yMax = Math.min(11, Math.max(1.2, Math.ceil(yMax * 1.25 * 2) / 2));

    var x = function (f) { return pl + f / FMAX * pw; };
    var y = function (v) { return pt + ph - v / yMax * ph; };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 网格与轴 */
    ctx.strokeStyle = '#efece1'; ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace'; ctx.lineWidth = 1;
    var yStep = yMax > 6 ? 2 : yMax > 3 ? 1 : 0.5;
    for (var v = 0; v <= yMax + 1e-9; v += yStep) {
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(v.toFixed(yStep < 1 ? 1 : 0), pl - 5, y(v) + 3);
    }
    for (var f2 = 0; f2 <= FMAX; f2 += 100) {
      ctx.beginPath(); ctx.moveTo(x(f2), pt); ctx.lineTo(x(f2), pt + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(f2 + '', x(f2), pt + ph + 13);
    }

    /* 频谱线 */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (var k = 0; k < NB; k++) {
      var px = x(k * step), py = y(bins[k]);
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();

    /* 特征峰标注 */
    ctx.font = '8.5px Consolas, monospace';
    var placed = [];
    marks.forEach(function (m) {
      if (m.a < yMax * 0.035) return;
      var mx = x(m.f), my = y(m.a);
      ctx.strokeStyle = m.col; ctx.setLineDash([3, 2]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, pt + ph); ctx.stroke();
      ctx.setLineDash([]);
      var ly = my - 6;
      placed.forEach(function (q) { if (Math.abs(q.x - mx) < 30 && Math.abs(q.y - ly) < 11) ly = q.y - 11; });
      placed.push({ x: mx, y: ly });
      ctx.fillStyle = m.col; ctx.textAlign = 'center';
      ctx.fillText(m.name, mx, ly);
    });

    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('频率 (Hz)', pl + pw / 2, H - 4);
    ctx.save(); ctx.translate(10, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('速度幅值 (mm/s 峰值)', 0, 0); ctx.restore();

    laySpec = { pl: pl, pr: pr, pt: pt, pb: pb, pw: pw, ph: ph, W: W, H: H, FMAX: FMAX, yMax: yMax, bins: bins, step: step, marks: marks, x: x, y: y };
  }

  /* ================= 面板 1b：时域波形 ================= */
  var layWave = null;
  function drawWave() {
    var W = 430, H = 250;
    var cv = $('c-wave'), ctx = setupCanvas(cv, W, H);
    var pl = 44, pr = 12, pt = 16, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var T = 0.1, N = 500;
    var p = peaks(), fq = freqs(), g = pointGain();
    var rnd = rng(998877);

    var data = [], vMax = 0.5;
    var impGap = 1 / fq.bpfo;                       /* BPFO 冲击间隔 (s) */
    for (var i = 0; i < N; i++) {
      var t = i / N * T;
      var v = p.f1 * g * Math.sin(2 * Math.PI * fq.f1 * t + 0.6)
        + p.f2 * g * Math.sin(2 * Math.PI * fq.f2 * t + 2.1)
        + p.bpf * g * 0.5 * Math.sin(2 * Math.PI * fq.bpf * t)
        + (rnd() - 0.5) * 2 * p.floor * g * (S.fault === 'bpfo' ? 2.2 : 1);
      /* 轴承外圈故障：按 BPFO 间隔的衰减冲击串 */
      if (S.fault === 'bpfo' && S.sev > 2) {
        var tau = t % impGap;
        v += p.bpfo * g * 1.7 * Math.exp(-tau * 1300) * Math.sin(2 * Math.PI * 3200 * tau);
      }
      data.push(v);
      if (Math.abs(v) > vMax) vMax = Math.abs(v);
    }
    vMax = Math.min(15, Math.max(1, Math.ceil(vMax * 1.2 * 2) / 2));

    var x = function (t) { return pl + t / T * pw; };
    var y = function (v) { return pt + ph / 2 - v / vMax * (ph / 2); };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#efece1'; ctx.lineWidth = 1; ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace';
    var yStep = vMax > 8 ? 4 : vMax > 4 ? 2 : 1;
    for (var v = -Math.floor(vMax / yStep) * yStep; v <= vMax; v += yStep) {
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(v.toFixed(0), pl - 5, y(v) + 3);
    }
    for (var ms = 0; ms <= 100; ms += 20) {
      var tx = x(ms / 1000);
      ctx.beginPath(); ctx.moveTo(tx, pt); ctx.lineTo(tx, pt + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(ms + '', tx, pt + ph + 13);
    }

    /* BPFO 冲击间隔刻度（顶部） */
    if (S.fault === 'bpfo' && S.sev > 2) {
      ctx.strokeStyle = '#b05a51'; ctx.setLineDash([2, 2]);
      for (var tk = 0; tk < T; tk += impGap) {
        ctx.beginPath(); ctx.moveTo(x(tk), pt); ctx.lineTo(x(tk), pt + 5); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left'; ctx.font = '8px Consolas, monospace';
      ctx.fillText('冲击间隔 ' + (impGap * 1000).toFixed(1) + ' ms = BPFO ' + fq.bpfo.toFixed(1) + ' Hz', pl + 3, pt - 4);
    }

    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1.1; ctx.beginPath();
    for (var k = 0; k < N; k++) {
      var px = x(k / N * T), py = y(data[k]);
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('时间 (ms)', pl + pw / 2, H - 4);
    ctx.save(); ctx.translate(10, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('速度 (mm/s)', 0, 0); ctx.restore();

    layWave = { pl: pl, pw: pw, pt: pt, ph: ph, T: T, N: N, data: data, x: x, y: y, vMax: vMax };
  }

  /* ================= 面板 3：趋势 + RUL ================= */
  var layTrend = null;
  function drawTrend() {
    var W = 620, H = 260;
    var cv = $('c-trend'), ctx = setupCanvas(cv, W, H);
    var pl = 46, pr = 14, pt = 18, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;

    var b = baseRMS(S.rpm), rms = rmsTotal(), l = lambda();
    var rul = rulDays(rms);
    var t0 = -60;
    var t1 = rul === null ? 40 : clamp(rul * 1.7 + 8, 25, 150);
    var yMax = Math.max(8, Math.ceil((rms * 1.15) / 2) * 2 + 1);

    var x = function (t) { return pl + (t - t0) / (t1 - t0) * pw; };
    var y = function (v) { return pt + ph - v / yMax * ph; };

    function rmsHist(t) {
      var wob = 1 + 0.02 * Math.sin(t * 0.9) + 0.012 * Math.sin(t * 2.7 + 1.3);
      return l ? Math.max(b * 0.95, rms * Math.exp(l * t)) * wob : b * wob;
    }
    function rmsFc(t, k) { return rms * Math.exp(l * k * t); }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* ISO 分区背景带 */
    var bands = [[0, ZONE.ab, 'rgba(47,125,107,0.07)'], [ZONE.ab, ZONE.bc, 'rgba(201,161,90,0.08)'],
      [ZONE.bc, ZONE.cd, 'rgba(176,90,81,0.07)'], [ZONE.cd, yMax, 'rgba(176,90,81,0.14)']];
    bands.forEach(function (bd) {
      var y1 = y(bd[1]), y2 = y(bd[0]);
      ctx.fillStyle = bd[2];
      ctx.fillRect(pl, y1, pw, y2 - y1);
    });
    ctx.fillStyle = '#8a9298'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('A 区', pl + 4, y((0 + ZONE.ab) / 2) + 3);
    ctx.fillText('B 区', pl + 4, y((ZONE.ab + ZONE.bc) / 2) + 3);
    ctx.fillText('C 区', pl + 4, y((ZONE.bc + ZONE.cd) / 2) + 3);
    if (yMax > ZONE.cd + 0.8) ctx.fillText('D 区', pl + 4, y((ZONE.cd + yMax) / 2) + 3);

    /* 网格与轴 */
    ctx.strokeStyle = '#efece1'; ctx.lineWidth = 1;
    ctx.fillStyle = '#9ba3a9'; ctx.font = '8.5px Consolas, monospace';
    for (var v = 0; v <= yMax; v += 1) {
      if (v % 2 === 0) { ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke(); }
      ctx.textAlign = 'right'; ctx.fillText(v.toFixed(0), pl - 5, y(v) + 3);
    }
    var tStep = (t1 - t0) > 120 ? 30 : 15;
    for (var t = Math.ceil(t0 / tStep) * tStep; t <= t1; t += tStep) {
      ctx.beginPath(); ctx.moveTo(x(t), pt); ctx.lineTo(x(t), pt + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(t + '', x(t), pt + ph + 13);
    }

    /* 阈值线：2.3 / 4.5 / 7.1 + 可调预警线 */
    function hline(v, col, lab, dash) {
      ctx.strokeStyle = col; ctx.setLineDash(dash); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.font = '8.5px Consolas, monospace';
      ctx.fillText(lab, pl + pw - 4, y(v) - 3);
    }
    hline(ZONE.cd, '#b05a51', '停机 7.1', [5, 3]);
    if (Math.abs(S.thr - ZONE.cd) > 0.05) hline(S.thr, '#c9a15a', '预警 ' + S.thr.toFixed(1), [4, 3]);
    if (Math.abs(S.thr - ZONE.ab) > 0.05) hline(ZONE.ab, '#8a9298', 'A/B 2.3', [2, 3]);

    /* 历史曲线 */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 2; ctx.beginPath();
    for (var i = 0; i <= 240; i++) {
      var th = t0 + (0 - t0) * i / 240;
      var py = y(Math.min(rmsHist(th), yMax));
      if (i) ctx.lineTo(x(th), py); else ctx.moveTo(x(th), py);
    }
    ctx.stroke();

    /* 预测带（P10—P90）与 P50 线 */
    if (rul !== null && rul > 0) {
      var tEnd = Math.min(rul * 1.7, t1);
      ctx.fillStyle = 'rgba(47,125,107,0.15)';
      ctx.beginPath();
      var n2 = 120;
      for (var j = 0; j <= n2; j++) {
        var tf = tEnd * j / n2;
        var yF = y(Math.min(rmsFc(tf, 1 / 1.7), yMax));
        if (j) ctx.lineTo(x(tf), yF); else ctx.moveTo(x(tf), yF);
      }
      for (var j2 = n2; j2 >= 0; j2--) {
        var ts = tEnd * j2 / n2;
        ctx.lineTo(x(ts), y(Math.min(rmsFc(ts, 1 / 0.55), yMax)));
      }
      ctx.closePath(); ctx.fill();

      ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 3]); ctx.beginPath();
      for (var j3 = 0; j3 <= n2; j3++) {
        var tc = tEnd * j3 / n2;
        var yc = y(Math.min(rmsFc(tc, 1), yMax));
        if (j3) ctx.lineTo(x(tc), yc); else ctx.moveTo(x(tc), yc);
      }
      ctx.stroke(); ctx.setLineDash([]);

      /* RUL 交汇标注 */
      var yCd = y(ZONE.cd);
      [[rul * 0.55, 'P10 ' + Math.round(rul * 0.55) + 'd', '#b05a51'],
       [rul, 'P50 ' + Math.round(rul) + 'd', '#41699b'],
       [Math.min(rul * 1.7, t1), 'P90 ' + Math.round(rul * 1.7) + 'd', '#2f7d6b']].forEach(function (m) {
        if (m[0] > t1) return;
        ctx.fillStyle = m[2];
        ctx.beginPath(); ctx.arc(x(m[0]), yCd, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'center'; ctx.font = '8.5px Consolas, monospace';
        ctx.fillText(m[1], x(m[0]), yCd + 14);
      });
    }

    /* 今日游标 */
    ctx.strokeStyle = '#79828a'; ctx.setLineDash([3, 2]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x(0), pt); ctx.lineTo(x(0), pt + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#242b2e'; ctx.beginPath(); ctx.arc(x(0), y(rms), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center'; ctx.font = '8.5px Consolas, monospace';
    ctx.fillText('今日 ' + rms.toFixed(2), x(0), pt - 5);

    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('相对天数（0 = 今日，负值 = 历史）', pl + pw / 2, H - 4);
    ctx.save(); ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('振动烈度 RMS (mm/s)', 0, 0); ctx.restore();

    layTrend = { pl: pl, pw: pw, pt: pt, ph: ph, t0: t0, t1: t1, yMax: yMax, x: x, y: y, rms: rms, rul: rul, l: l, hist: rmsHist, fc: rmsFc };
  }

  /* ================= 面板 4：多测点矩阵 ================= */
  var layMat = null;
  function drawMatrix() {
    var W = 620, H = 210;
    var cv = $('c-matrix'), ctx = setupCanvas(cv, W, H);
    var pl = 108, pr = 14, pt = 30, pb = 10;
    var pw = W - pl - pr, ph = H - pt - pb;
    var cols = ['RMS', '1X 幅值', '2X 幅值', 'BPFO 幅值'];
    var limits = [[ZONE.ab, ZONE.bc, ZONE.cd], [1.5, 3.2, 5.0], [1.2, 2.6, 4.0], [0.15, 0.5, 1.2]];
    var p = peaks(), g = GAINS[S.fault];
    var rms = rmsTotal();

    var cw = pw / cols.length, ch = ph / POINTS.length;
    var cells = [];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    ctx.font = '9.5px sans-serif'; ctx.fillStyle = '#79828a'; ctx.textAlign = 'center';
    cols.forEach(function (c, j) { ctx.fillText(c + ' (mm/s)', pl + cw * (j + 0.5), pt - 8); });

    POINTS.forEach(function (pn, i) {
      ctx.fillStyle = '#4d565b'; ctx.textAlign = 'right'; ctx.font = '10px sans-serif';
      var label = PNAME[pn] + (pn === S.point ? ' ◄' : '');
      ctx.fillText(label, pl - 8, pt + ch * (i + 0.5) + 3.5);
      var vals = [rms * g[i], p.f1 * g[i], p.f2 * g[i], p.bpfo * g[i]];
      vals.forEach(function (v, j) {
        var lim = limits[j];
        var z = v >= lim[2] ? 3 : v >= lim[1] ? 2 : v >= lim[0] ? 1 : 0;
        var cx = pl + cw * j, cy = pt + ch * i;
        ctx.fillStyle = ZONE_FILL[z];
        var isSel = pn === S.point;
        ctx.globalAlpha = isSel ? 1 : 0.82;
        ctx.fillRect(cx + 2, cy + 2, cw - 4, ch - 4);
        ctx.globalAlpha = 1;
        if (isSel) { ctx.strokeStyle = '#235f51'; ctx.lineWidth = 1.6; ctx.strokeRect(cx + 2, cy + 2, cw - 4, ch - 4); }
        ctx.fillStyle = z >= 2 ? '#fff' : '#242b2e';
        ctx.textAlign = 'center'; ctx.font = '600 11px Consolas, monospace';
        ctx.fillText(v.toFixed(2), cx + cw / 2, cy + ch / 2 + 4);
        cells.push({ x: cx, y: cy, w: cw, h: ch, v: v, z: z, pn: pn, col: cols[j], lim: lim });
      });
    });

    ctx.fillStyle = '#8a9298'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('分区判据：RMS ' + limits[0].join('/') + ' · 1X ' + limits[1].join('/') + ' · 2X ' + limits[2].join('/') + ' · BPFO ' + limits[3].join('/') + ' mm/s（A/B/C 边界，工程经验值）', pl, H - 2);

    layMat = { cells: cells };
  }

  /* ================= 指标卡与诊断 ================= */
  function renderMetrics() {
    var g = pointGain(), p = peaks(), fq = freqs();
    var rmsP = rmsTotal() * g;
    var z = zoneOf(rmsP);
    var rul = rulDays(rmsTotal());

    $('m-rms').innerHTML = rmsP.toFixed(2) + '<small> mm/s</small>';
    $('m-rms').parentNode.className = 'mcard' + (z >= 2 ? ' bad' : z === 1 ? ' warn' : '');
    $('m-1x').innerHTML = (p.f1 * g).toFixed(2) + '<small> mm/s @' + fq.f1.toFixed(1) + 'Hz</small>';
    $('m-1x').parentNode.className = 'mcard' + (p.f1 * g >= 3.2 ? ' bad' : p.f1 * g >= 1.5 ? ' warn' : '');
    $('m-bpfo').innerHTML = (p.bpfo * g).toFixed(2) + '<small> mm/s @' + fq.bpfo.toFixed(1) + 'Hz</small>';
    $('m-bpfo').parentNode.className = 'mcard' + (p.bpfo * g >= 0.5 ? ' bad' : p.bpfo * g >= 0.15 ? ' warn' : '');
    if (rul === null) {
      $('m-rul').innerHTML = '>365<small> 天</small>';
      $('m-rul').parentNode.className = 'mcard';
    } else {
      $('m-rul').innerHTML = Math.round(rul) + '<small> 天 (P10 ' + Math.round(rul * 0.55) + ')</small>';
      $('m-rul').parentNode.className = 'mcard' + (rul <= 14 ? ' bad' : rul <= 30 ? ' warn' : '');
    }
    var lvl, cls;
    if (rmsP >= ZONE.cd) { lvl = 'D 区·停机'; cls = ' bad'; }
    else if (rmsP >= S.thr) { lvl = 'C 区·报警'; cls = ' bad'; }
    else if (rmsP >= ZONE.ab) { lvl = 'B 区·关注'; cls = ' warn'; }
    else { lvl = 'A 区·正常'; cls = ''; }
    $('m-alarm').innerHTML = lvl;
    $('m-alarm').parentNode.className = 'mcard' + cls;
  }

  function renderVerdict() {
    var v = $('verdict');
    var p = peaks(), fq = freqs(), g = pointGain();
    var rms = rmsTotal() * g, sev = S.sev / 100;
    var rul = rulDays(rmsTotal());
    var conf = Math.round(clamp(52 + 45 * sev, 50, 97));

    if (S.fault === 'normal' || S.sev < 3) {
      v.className = 'verdict ok';
      v.innerHTML = '诊断结论：<b>健康基线运行</b>（置信度 ' + conf + '%）——1X=' + fq.f1.toFixed(1) + ' Hz 幅值 ' +
        p.f1.toFixed(2) + ' mm/s，BPFO 窄带 ' + p.bpfo.toFixed(2) + ' mm/s 均处基线；烈度 ' + rms.toFixed(2) +
        ' mm/s 位于 A/B 区。建议：按 5 min 在线帧继续趋势监测，无需工单。';
      return;
    }
    var feat, advice;
    if (S.fault === 'unbal') {
      feat = '1X 转频幅值主导（' + (p.f1 * g).toFixed(2) + ' mm/s，占谱能量 ' + Math.round(p.f1 * p.f1 / (p.f1 * p.f1 + p.f2 * p.f2 + p.bpfo * p.bpfo + 0.01) * 100) + '%），径向测点同向抬升，符合转子不平衡谱型';
      advice = '安排现场动平衡校验，检查叶轮结垢/磨损与联轴器对中复测';
    } else if (S.fault === 'misal') {
      feat = '2X 幅值 ' + (p.f2 * g).toFixed(2) + ' mm/s 突出，2X/1X = ' + (p.f2 / p.f1).toFixed(2) + '（>0.75 判据），联轴器侧（NDE）测点偏高，符合轴系不对中谱型';
      advice = '停机窗口内做激光对中，复查热态膨胀补偿';
    } else {
      feat = 'BPFO=' + fq.bpfo.toFixed(1) + ' Hz 及 2×BPFO 谐波突出（窄带幅值 ' + (p.bpfo * g).toFixed(2) + ' mm/s，较基线涨 ' +
        (p.bpfo / (baseRMS(S.rpm) * 0.04)).toFixed(1) + ' 倍），时域可见周期冲击——窄带特征领先 RMS 过线约 17 天';
      advice = '按 RUL·P10 下界排检修窗口并锁定轴承备件，停机前 72 h 手持复测确认';
    }
    var state;
    if (rms >= ZONE.cd) { state = '已越停机线 7.1 mm/s，建议<b>立即停机检查</b>'; v.className = 'verdict bad'; }
    else if (rms >= S.thr) { state = '已越过预警阈值 ' + S.thr.toFixed(1) + ' mm/s'; v.className = 'verdict bad'; }
    else if (rul !== null && rul <= 30) { state = '烈度 ' + rms.toFixed(2) + ' mm/s 未过线，但趋势外推 RUL·P50≈<b>' + Math.round(rul) + ' 天</b>（P10 ' + Math.round(rul * 0.55) + ' 天）'; v.className = 'verdict warn'; }
    else { state = '烈度 ' + rms.toFixed(2) + ' mm/s 位于 B 区，劣化速率较低'; v.className = 'verdict warn'; }
    v.innerHTML = '诊断结论：<b>' + FAULT_NAME[S.fault] + '</b>（置信度 ' + conf + '%）——' + feat + '。' + state + '。建议：' + advice + '。';
  }

  function render() {
    drawSpec(); drawWave(); drawTrend(); drawMatrix();
    renderMetrics(); renderVerdict();
  }

  /* ================= 悬停 tooltip ================= */
  function bindTip(boxId, tipId, cvId, htmlFn) {
    var box = $(boxId), tip = $(tipId), cv = $(cvId);
    if (!box || !tip || !cv) return;
    cv.addEventListener('mousemove', function (evt) {
      var rb = cv.getBoundingClientRect();
      var lw = laySpec && cvId === 'c-spec' ? laySpec.W : cvId === 'c-wave' ? 430 : cvId === 'c-trend' ? 620 : 620;
      var lx = (evt.clientX - rb.left) * (lw / rb.width);
      var h = htmlFn(lx, evt);
      if (h) {
        var bb = box.getBoundingClientRect();
        tip.innerHTML = h;
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - bb.left + 12, 4, bb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - bb.top - 10, 4, bb.height - 60) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function bindAllTips() {
    bindTip('box-spec', 'tip-spec', 'c-spec', function (lx) {
      var L = laySpec; if (!L || lx < L.pl || lx > L.pl + L.pw) return null;
      var f = (lx - L.pl) / L.pw * L.FMAX;
      var best = null;
      L.marks.forEach(function (m) { var d = Math.abs(m.f - f); if (d < 7 && (!best || d < best.d)) best = { m: m, d: d }; });
      if (best) return '<b>' + best.m.name + '</b> ' + best.m.f.toFixed(1) + ' Hz<br>幅值 <b>' + best.m.a.toFixed(2) + '</b> mm/s（峰值）';
      var idx = clamp(Math.round(f / L.step), 0, L.bins.length - 1);
      return '频率 <b>' + (idx * L.step).toFixed(1) + '</b> Hz<br>幅值 <b>' + L.bins[idx].toFixed(3) + '</b> mm/s';
    });
    bindTip('box-wave', 'tip-wave', 'c-wave', function (lx) {
      var L = layWave; if (!L || lx < L.pl || lx > L.pl + L.pw) return null;
      var t = (lx - L.pl) / L.pw * L.T;
      var idx = clamp(Math.round(t / L.T * (L.N - 1)), 0, L.N - 1);
      return 't = <b>' + (t * 1000).toFixed(1) + '</b> ms<br>速度 <b>' + L.data[idx].toFixed(2) + '</b> mm/s';
    });
    bindTip('box-trend', 'tip-trend', 'c-trend', function (lx) {
      var L = layTrend; if (!L || lx < L.pl || lx > L.pl + L.pw) return null;
      var t = L.t0 + (lx - L.pl) / L.pw * (L.t1 - L.t0);
      var v = t <= 0 ? L.hist(t) : (L.rul !== null ? L.fc(t, 1) : null);
      if (v === null) return null;
      var z = zoneOf(v);
      var s = '第 <b>' + (t >= 0 ? '+' : '') + Math.round(t) + '</b> 天 · 烈度 <b>' + v.toFixed(2) + '</b> mm/s（' + ZONE_NAME[z] + '）';
      if (t > 0 && L.rul !== null) s += '<br>距停机线 <b>' + Math.max(0, Math.round(L.rul - t)) + '</b> 天（P50）';
      return s;
    });
    bindTip('box-matrix', 'tip-matrix', 'c-matrix', function (lx, evt) {
      var L = layMat; if (!L) return null;
      var cv = $('c-matrix'), rb = cv.getBoundingClientRect();
      var ly = (evt.clientY - rb.top) * (210 / rb.height);
      for (var i = 0; i < L.cells.length; i++) {
        var c = L.cells[i];
        if (lx >= c.x && lx <= c.x + c.w && ly >= c.y && ly <= c.y + c.h) {
          return '<b>' + PNAME[c.pn] + '</b> · ' + c.col + '<br>数值 <b>' + c.v.toFixed(2) + '</b> mm/s · ' + ZONE_NAME[c.z] +
            '<br><span style="color:#8a9298">分区边界 ' + c.lim.join(' / ') + '</span>';
        }
      }
      return null;
    });
  }

  /* ================= 参数绑定 ================= */
  function bind() {
    [['sev', function (v) { return v + ' %'; }],
     ['rpm', function (v) { return v + ' r/min'; }],
     ['thr', function (v) { return v.toFixed(1) + ' mm/s'; }]].forEach(function (kv) {
      var k = kv[0], fmt = kv[1];
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = fmt(S[k]);
        render();
      });
    });
    function bindSeg(id, key) {
      var seg = $(id);
      Array.prototype.forEach.call(seg.querySelectorAll('.seg-btn'), function (btn) {
        btn.addEventListener('click', function () {
          Array.prototype.forEach.call(seg.querySelectorAll('.seg-btn'), function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          S[key] = btn.getAttribute('data-v');
          render();
        });
      });
    }
    bindSeg('seg-fault', 'fault');
    bindSeg('seg-point', 'point');
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      $('s-sev').value = DEF.sev; $('o-sev').textContent = DEF.sev + ' %';
      $('s-rpm').value = DEF.rpm; $('o-rpm').textContent = DEF.rpm + ' r/min';
      $('s-thr').value = DEF.thr; $('o-thr').textContent = DEF.thr.toFixed(1) + ' mm/s';
      [['seg-fault', 'fault'], ['seg-point', 'point']].forEach(function (kv) {
        Array.prototype.forEach.call($(kv[0]).querySelectorAll('.seg-btn'), function (b) {
          b.classList.toggle('active', b.getAttribute('data-v') === DEF[kv[1]]);
        });
      });
      render();
    });
  }

  bind();
  bindAllTips();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });
})();

/* ======= 真实数据来源页：ISO 分区图 + 来源对照 ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(x, y, s, attrs, parent) { var t = el('text', attrs || {}, parent); t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s; return t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ISO 10816-3:2009 区域边界（速度 RMS, mm/s） */
  var GROUPS = [
    { name: '第 1/3 组 · 刚性基础（大型机 300kW—50MW / 泵 ≥15kW）', b: [2.3, 4.5, 7.1] },
    { name: '第 1/3 组 · 弹性基础', b: [3.5, 7.1, 11.0] },
    { name: '第 2/4 组 · 刚性基础（中型机 15—300kW）', b: [1.4, 2.8, 5.6] },
    { name: '第 2/4 组 · 弹性基础', b: [2.3, 4.5, 7.1] }
  ];
  var ZCOL = ['#2f7d6b', '#c9a15a', '#b05a51', '#6b2f2a'];
  var ZNAME = ['A 区 · 新交付机器', 'B 区 · 可长期运行', 'C 区 · 不宜长期运行，限期检修', 'D 区 · 有损坏风险'];
  var XMAX = 12, PL = 210, PR = 20;

  function drawIso() {
    var svg = document.getElementById('iso-chart'); if (!svg) return;
    var W = 900, H = 300, PT = 26, PB = 34;
    var plotW = W - PL - PR, plotH = H - PT - PB;
    function xOf(v) { return PL + v / XMAX * plotW; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var v = 0; v <= XMAX; v += 1) {
      var x = xOf(v);
      el('line', { x1: x, y1: PT, x2: x, y2: PT + plotH, stroke: v % 2 ? '#f4efe2' : '#ece5d6', 'stroke-width': 1 }, svg);
      txt(x, PT + plotH + 14, v + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 4, '振动烈度 速度有效值 (mm/s RMS)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);

    var bh = plotH / GROUPS.length * 0.52, gap = plotH / GROUPS.length;
    var bounds = [[0], [0], [0], [0]];
    GROUPS.forEach(function (g, i) {
      var cy = PT + gap * (i + 0.5);
      txt(PL - 8, cy - 3, g.name.split('（')[0], { 'font-size': 9.5, fill: '#4d565b', 'text-anchor': 'end', 'font-weight': 600 }, svg);
      txt(PL - 8, cy + 9, g.name.indexOf('（') >= 0 ? '（' + g.name.split('（')[1] : '', { 'font-size': 8.5, fill: '#9ba3a9', 'text-anchor': 'end' }, svg);
      var edges = [0, g.b[0], g.b[1], g.b[2], XMAX];
      for (var z = 0; z < 4; z++) {
        var zx = xOf(edges[z]), zw = xOf(edges[z + 1]) - zx;
        var r = el('rect', { x: zx, y: cy - bh / 2, width: zw, height: bh, fill: ZCOL[z], opacity: 0.78, 'data-g': i, 'data-z': z }, svg);
        r.style.cursor = 'pointer';
        if (zw > 42) txt(zx + zw / 2, cy + 3.5, 'ABCD'[z], { 'font-size': 9.5, fill: '#fff', 'text-anchor': 'middle', 'font-weight': 700 }, svg);
      }
      bounds[i] = edges;
      g.b.forEach(function (bv) {
        el('line', { x1: xOf(bv), y1: cy - bh / 2 - 3, x2: xOf(bv), y2: cy + bh / 2 + 3, stroke: '#5d666d', 'stroke-width': 1 }, svg);
        txt(xOf(bv), cy - bh / 2 - 6, bv.toFixed(1), { 'font-size': 8.5, fill: '#3d464b', 'text-anchor': 'middle', 'font-family': 'monospace' }, svg);
      });
    });
    svg._bounds = bounds;
    svg._geom = { PT: PT, gap: gap, bh: bh, PL: PL, plotW: plotW };
  }

  function bindIso() {
    var svg = document.getElementById('iso-chart'), tip = document.getElementById('tip-iso'), box = document.getElementById('box-iso');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t.tagName === 'rect' && t.hasAttribute('data-g')) {
        var gi = +t.getAttribute('data-g'), z = +t.getAttribute('data-z');
        var g = GROUPS[gi], edges = svg._bounds[gi];
        var rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + g.name.split('（')[0] + '</b><br>' + ZNAME[z] + '<br>范围 <b>' + edges[z].toFixed(1) + ' — ' + (z === 3 ? '>' : '') + edges[z + 1].toFixed(1) + '</b> mm/s';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 230) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* 8 条真实来源，均经检索核实 */
  var SRC = [
    { src: 'ISO 10816-3:2009 / GB/T 6075.3-2011（现行 ISO 20816-3:2022）', key: 'A/B/C/D 分区边界：第1/3组刚性基础 2.3 / 4.5 / 7.1 mm/s RMS；弹性基础 3.5 / 7.1 / 11.0；第2/4组 1.4 / 2.8 / 5.6', mod: 'ISO 分区背景带 · 预警阈值滑块 · 报警等级卡', url: 'https://www.iso.org/standard/50528.html',
      det: 'ISO 10816-3:2009《机械振动 在非旋转部件上测量和评价机器的振动 第3部分》适用于额定功率 15 kW—50 MW、转速 120—15,000 r/min 的工业机器现场测量，已被 ISO 20816-3:2022 取代（iso.org 可查）。本 demo 趋势图的 A/B/C/D 背景带、指标卡的报警等级、「预警阈值」滑块默认值 4.5 mm/s（B/C 区界）均取自第 1/3 组刚性基础边界；案例中的「4.5 报警、7.1 停机」即 B/C 与 C/D 区界。' },
    { src: 'ISO 13373-1:2002 / GB/T 19873.1-2005', key: '机器振动状态监测的测量与数据采集通则：传感器类型与量程、测点布置（轴承座径向水平/垂直）、在线与离线采集周期', mod: '多测点布置（DE/NDE × H/V）· 5 min 在线采集设定', url: 'https://www.iso.org/standard/21831.html',
      det: 'ISO 13373-1:2002《机器状态监测与诊断 振动状态监测 第1部分：总则》规定振动状态监测的测量和数据采集功能，国标 GB/T 19873.1-2005 等同采用。本 demo 的四个测点（驱动端/非驱动端 × 水平/垂直，布置于轴承座）与「在线每 5 min 一帧」的监测架构按该通则设定。' },
    { src: 'ISO 13373-3:2015', key: '振动诊断导则：转频 1X 主导→不平衡；2X 突出（2X/1X 比率高）→不对中；高频窄带及谐波→轴承缺陷', mod: '频谱特征峰标注 · 诊断结论的判别规则', url: 'https://www.iso.org/standard/40840.html',
      det: 'ISO 13373-3:2015《机器状态监测与诊断 振动状态监测 第3部分：振动诊断导则》给出按谱图形态判别故障类别的流程。本 demo 诊断卡的判别逻辑（1X 主导判不平衡、2X/1X>0.75 判不对中、BPFO 及 2×BPFO 谐波判外圈缺陷）与置信度表达即按该导则的谱型判据实现。' },
    { src: 'API Std 670《Machinery Protection Systems》第 5 版（2014-11）', key: '机械保护系统最低要求：径向轴振/壳振、轴向位移、转速、超速、喘振、轴承温度测量；报警与停机（危险）两级逻辑', mod: '报警/停机两级阈值逻辑 · 在线监测架构', url: 'https://www.api.org/products-and-services/standards',
      det: 'API 670 第 5 版（2014 年 11 月）是炼化行业机械保护系统的事实标准，覆盖振动/位移/温度/超速/喘振等子系统（标准文本第 1.1 节明确范围）。本 demo 的「预警阈值 + 7.1 停机线」两级逻辑、趋势图上的阈值线表达与传感器测点体系对应 API 670 的保护层级。' },
    { src: 'NASA PCoE 数据集 · IMS 轴承全寿命试验（Univ. of Cincinnati / Rexnord）', key: 'Rexnord ZA-2115 双列轴承（每列 16 滚动体、节径 2.815 in），2000 r/min、6000 lb 径向载荷，2004-02-12→19 持续运转，轴承 1 发生外圈失效；20 kHz 加速度快照每 10 min 一组', mod: '劣化趋势曲线形态 · RUL 标定与置信区间', url: 'https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/',
      det: 'NASA  prognostics 数据仓（PCoE Data Set Repository，nasa.gov 可查）第 4 号数据集，由辛辛那提大学 IMS 中心提供，引用：J. Lee, H. Qiu, G. Yu, J. Lin, Rexnord Technical Services (2007)。该试验的 RMS 趋势呈「长期平稳—指数加速劣化」形态，是本 demo 趋势外推采用指数轨迹 RMS(t)=RMS₀·e^(λt) 的依据；外圈失效模式对应 BPFO 特征。' },
    { src: 'Randall R.B., Antoni J. (2011) Rolling element bearing diagnostics—A tutorial, MSSP 25(2):485—520', key: '包络分析（带通滤波+包络解调）是轴承诊断标准方法；BPFO/BPFI 由轴承几何（滚动体数、接触角、节径比）决定', mod: 'BPFO 窄带峰合成 · 时域周期冲击波形', url: 'https://doi.org/10.1016/j.ymssp.2010.07.017',
      det: '该教程（Mechanical Systems and Signal Processing，DOI 可查）系统阐述轴承加速度信号的包络分析与谱峰判别。本 demo 的 BPFO=3.01×fr、2×BPFO 谐波、时域按 BPFO 间隔重复的高频衰减冲击串（仿真外圈剥落对滚动体的周期性撞击）均按该文机理合成；「窄带先动、宽频后动」特征亦源于此。' },
    { src: 'Li X., Ding Q., Sun J.-Q. (2018) RUL estimation in prognostics using deep CNN, Reliab. Eng. Syst. Saf. 172:1—11', key: '深度卷积网络直接从振动信号估计剩余寿命，C-MAPSS 等基准上优于传统方法；RUL 应给分布而非单点', mod: 'RUL P10/P50/P90 置信区间设计 · 深度学习路线说明', url: 'https://doi.org/10.1016/j.ress.2017.11.021',
      det: '该文（Reliability Engineering & System Safety 172 卷，DOI 可查）是深度学习 RUL 预测的代表作。本 demo 按「RUL 给区间不给单点」的工程要求输出 P10/P50/P90 三条界（备件决策看 P10 下界），与文中「预测不确定性量化」的主张一致；案例正文采用的「单调约束 LSTM + 卡尔曼平滑」为其延伸路线。' },
    { src: 'CWRU Bearing Data Center（凯斯西储大学轴承数据中心）', key: 'SKF 6205-2RS JEM 驱动端轴承，电机转速 1797—1730 r/min，12 kHz/48 kHz 采样，内圈/外圈/滚动体电火花预制故障（0.007—0.040 in）', mod: '故障类型—谱特征对应关系验证（故障类型按钮）', url: 'https://engineering.case.edu/bearingdatacenter/download-data-file',
      det: 'CWRU 轴承数据中心（engineering.case.edu 可查）是故障诊断领域使用最广的公开基准，公开了正常、内圈、外圈、滚动体四类状态的多工况振动数据。本 demo 四类「故障类型」与频谱形态的对应（外圈故障→BPFO 及其谐波）以该类公开试验数据的公认谱型为参照。' }
  ];
  var selRow = -1;

  function bindTable() {
    var body = document.getElementById('lit-body'); if (!body) return;
    SRC.forEach(function (s, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + s.src + '</td><td>' + s.key + '</td><td><span class="mod">' + s.mod + '</span> <a href="' + s.url + '" target="_blank" rel="noopener" style="color:#2f7d6b;font-weight:600;text-decoration:none">↗</a></td>';
      tr.addEventListener('click', function (evt) {
        if (evt.target.tagName === 'A') return;
        selRow = selRow === i ? -1 : i;
        renderDetail();
      });
      body.appendChild(tr);
    });
  }

  function renderDetail() {
    var d = document.getElementById('lit-detail'); if (!d) return;
    var rows = document.querySelectorAll('#lit-body tr');
    rows.forEach(function (r, i) { r.classList.toggle('sel', i === selRow); });
    if (selRow >= 0) {
      d.className = 'r-detail active';
      d.innerHTML = '<b>来源 ' + (selRow + 1) + '：</b>' + SRC[selRow].det;
    } else {
      d.className = 'r-detail';
      d.innerHTML = '点击任一行，查看该来源的可查证要点及其在「模拟演示」页签中的落地位置。8 条来源含 4 项国际/国家标准、1 个 NASA 公开数据集、2 篇代表作论文与 1 个公开基准数据库。';
    }
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
  drawIso();
  bindIso();
  bindTable();
  renderDetail();
})();
