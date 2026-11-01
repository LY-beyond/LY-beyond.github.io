/* ======= 结蜡/结垢智能预测 · 清蜡排产可运行示范（模拟页签） ======= */
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

  /* 确定性伪随机（同一井多次渲染一致） */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- 井位（6 口，鄂尔多斯盆地高含蜡区块设定） ---------- */
  var WELLS = [
    { id: 'BD-05', wax: 24.5, wat: 46.5, days: 38, twh: 30.0, fixed: 30, q0: 9.2 },
    { id: 'BD-11', wax: 21.0, wat: 44.0, days: 20, twh: 33.0, fixed: 45, q0: 8.6 },
    { id: 'BD-23', wax: 19.0, wat: 42.5, days: 8,  twh: 36.0, fixed: 60, q0: 7.8 },
    { id: 'BD-37', wax: 26.0, wat: 48.0, days: 55, twh: 28.0, fixed: 30, q0: 9.6 },
    { id: 'BD-52', wax: 22.5, wat: 45.0, days: 18, twh: 31.5, fixed: 45, q0: 8.2 },
    { id: 'BD-68', wax: 20.0, wat: 43.0, days: 12, twh: 35.0, fixed: 60, q0: 7.2 }
  ];

  var S = { well: 1, wax: 21.0, wat: 44.0, days: 20, twh: 33.0 };

  function curParams() { return { wax: S.wax, wat: S.wat, days: S.days, twh: S.twh }; }

  /* ---------- Weibull 生存模型（教学近似） ----------
     η：特征结蜡周期（天），随含蜡量/析蜡点升高、井口温度低于析蜡点而缩短
     F(t) = 1 − e^(−(t/η)^k)，k=2.2（风险率随时间递增） */
  var K_SHAPE = 2.2;
  function etaOf(p) {
    return 80 * Math.exp(-0.075 * (p.wax - 20))
      * Math.exp(-0.09 * (p.wat - 43))
      * Math.exp(-0.055 * Math.max(0, p.wat - p.twh));
  }
  function riskAt(t, eta) { return 1 - Math.exp(-Math.pow(t / eta, K_SHAPE)); }
  function tOfRisk(f, eta) { return eta * Math.pow(-Math.log(1 - f), 1 / K_SHAPE); }

  /* 建议窗口：F ∈ [30%, 55%]，换算为相对今天的天数 */
  function windowOf(p) {
    var eta = etaOf(p);
    var tLo = tOfRisk(0.30, eta), tHi = tOfRisk(0.55, eta);
    return { eta: eta, tLo: tLo, tHi: tHi, s: tLo - p.days, e: tHi - p.days, fNow: riskAt(p.days, eta) };
  }
  function levelOf(f) {
    if (f >= 0.55) return { t: '高', c: '#b05a51', cls: 'bad' };
    if (f >= 0.30) return { t: '中', c: '#c9a15a', cls: 'warn' };
    return { t: '低', c: '#2f7d6b', cls: '' };
  }
  function fmtWin(win) {
    if (win.e < 0) return '已过窗 ' + (-win.e).toFixed(0) + ' 天';
    if (win.s > 30) return '第 ' + win.s.toFixed(0) + ' 天起';
    var s0 = Math.max(0, win.s), e0 = Math.min(30, win.e);
    return '第 ' + s0.toFixed(0) + '–' + e0.toFixed(0) + ' 天';
  }

  /* ---------- 近 12 个月时序（确定性生成，参数联动） ----------
     day 0 = 2025-11-01，day 364 = 今天；最冷点约在 1 月下旬（day 79） */
  var ND = 365;
  var TS = { T: [], Q: [] };
  function genTS() {
    var rnd = mulberry32(20261101 + S.well * 131);
    var mean = S.twh + 1.7, amp = 9;
    var q0 = WELLS[S.well].q0;
    TS.T = []; TS.Q = [];
    for (var d = 0; d < ND; d++) {
      var T = mean - amp * Math.cos(2 * Math.PI * (d - 79) / 365) + (rnd() - 0.5) * 1.6;
      var q = q0 - 0.004 * d + (rnd() - 0.5) * 0.5;
      TS.T.push(T);
      TS.Q.push(clamp(q, 4, 10));
    }
  }

  var MON = [
    [0, '11月'], [30, '12月'], [61, '1月'], [92, '2月'], [120, '3月'], [151, '4月'],
    [181, '5月'], [212, '6月'], [243, '7月'], [273, '8月'], [304, '9月'], [334, '10月']
  ];
  function monOf(d) {
    var m = '11月';
    for (var i = 0; i < MON.length; i++) if (d >= MON[i][0]) m = MON[i][1];
    return m;
  }

  /* ---------- ① 单井结蜡风险曲线 ---------- */
  var RK = { W: 470, H: 252, PL: 44, PR: 16, PT: 20, PB: 32, XMAX: 120 };
  var riskGeom = null;

  function drawRisk() {
    var svg = $('c-risk');
    var p = curParams();
    var eta = etaOf(p), win = windowOf(p);
    var W = RK.W, H = RK.H, PL = RK.PL, PR = RK.PR, PT = RK.PT, PB = RK.PB, XMAX = RK.XMAX;
    var pw = W - PL - PR, ph = H - PT - PB;
    function x(t) { return PL + t / XMAX * pw; }
    function y(f) { return PT + ph - f * ph; }
    riskGeom = { PL: PL, pw: pw, PT: PT, ph: ph, eta: eta };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 未来 30 天滚动带（从今天起） */
    var d0 = Math.min(p.days, XMAX), d1 = Math.min(p.days + 30, XMAX);
    if (d1 > d0) {
      s += '<rect x="' + x(d0).toFixed(1) + '" y="' + PT + '" width="' + (x(d1) - x(d0)).toFixed(1) + '" height="' + ph + '" fill="#c9a15a" opacity="0.08"/>';
      s += '<text x="' + ((x(d0) + x(d1)) / 2).toFixed(1) + '" y="' + (PT + 10) + '" font-size="8.5" fill="#9a7a1c" text-anchor="middle">未来 30 天滚动窗口</text>';
    }
    /* 建议清蜡窗口色带（截入 30 天内） */
    var ws = Math.max(p.days, win.tLo), we = Math.min(win.tHi, p.days + 30, XMAX);
    if (win.e >= 0 && we > ws) {
      var lv = levelOf(win.fNow);
      s += '<rect x="' + x(ws).toFixed(1) + '" y="' + PT + '" width="' + (x(we) - x(ws)).toFixed(1) + '" height="' + ph + '" fill="' + lv.c + '" opacity="0.16"/>';
    }

    /* 网格 + 左轴 */
    for (var g = 0; g <= 1.001; g += 0.2) {
      var yy = y(g);
      s += '<line x1="' + PL + '" y1="' + yy.toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + yy.toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yy + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + Math.round(g * 100) + '%</text>';
    }
    /* x 轴刻度 */
    for (var t = 0; t <= XMAX; t += 20) {
      s += '<line x1="' + x(t) + '" y1="' + PT + '" x2="' + x(t) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(t) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + t + '</text>';
    }

    /* 阈值线 30% / 55%（标签分别放线下方/上方，避免互压） */
    var y30 = y(0.30), y55 = y(0.55);
    s += '<line x1="' + PL + '" y1="' + y30.toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + y30.toFixed(1) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + (PL + pw - 4) + '" y="' + (y30 + 11).toFixed(1) + '" font-size="8.5" fill="#9a7a1c" text-anchor="end" font-family="monospace">关注阈值 F=30%</text>';
    s += '<line x1="' + PL + '" y1="' + y55.toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + y55.toFixed(1) + '" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + (PL + pw - 4) + '" y="' + (y55 - 4).toFixed(1) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">高危阈值 F=55%</text>';

    /* 主曲线 */
    var line = '';
    for (var i = 0; i <= 200; i++) {
      var tt = i / 200 * XMAX;
      line += (i ? 'L' : 'M') + x(tt).toFixed(1) + ' ' + y(riskAt(tt, eta)).toFixed(1) + ' ';
    }
    s += '<path d="' + line + '" fill="none" stroke="#b05a51" stroke-width="2.2"/>';

    /* 上次热洗事件点（t=0） */
    s += '<circle cx="' + x(0) + '" cy="' + y(0) + '" r="4.5" fill="#2f7d6b" stroke="#fff" stroke-width="1.4"/>';
    s += '<text x="' + (x(0) + 8) + '" y="' + (y(0) - 12) + '" font-size="8.5" fill="#2f7d6b" font-weight="600">上次热洗 · 第 0 天</text>';

    /* 今天竖线 + 当前风险点 */
    var xd = x(clamp(p.days, 0, XMAX)), fd = riskAt(p.days, eta);
    s += '<line x1="' + xd.toFixed(1) + '" y1="' + PT + '" x2="' + xd.toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#41699b" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<circle cx="' + xd.toFixed(1) + '" cy="' + y(fd).toFixed(1) + '" r="5" fill="#41699b" stroke="#fff" stroke-width="1.5"/>';
    var nearR = xd > PL + pw - 100;
    s += '<text x="' + (nearR ? xd - 8 : xd + 8).toFixed(1) + '" y="' + (y(fd) - 8).toFixed(1) + '" font-size="9" fill="#41699b" text-anchor="' + (nearR ? 'end' : 'start') + '" font-family="monospace" font-weight="600">今天 第' + p.days + '天 · F=' + Math.round(fd * 100) + '%</text>';

    /* 轴标题 */
    s += '<text x="' + (PL - 32) + '" y="' + (PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 32) + ' ' + (PT + ph / 2) + ')">结蜡风险概率 F(t)</text>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">距上次清蜡（天）</text>';

    /* 悬停层 + 事件捕获 */
    s += '<g id="risk-hov" style="display:none"></g>';
    s += '<rect id="risk-cap" x="' + PL + '" y="' + PT + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
    svg.innerHTML = s;
  }

  function bindRiskHover() {
    var svg = $('c-risk'), tip = $('t-risk'), box = $('box-risk');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      if (!riskGeom) return;
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (RK.W / r.width);
      var t = clamp((vx - riskGeom.PL) / riskGeom.pw, 0, 1) * RK.XMAX;
      var f = riskAt(t, riskGeom.eta);
      var hov = document.getElementById('risk-hov');
      if (hov) {
        var gx = riskGeom.PL + t / RK.XMAX * riskGeom.pw;
        var gy = riskGeom.PT + riskGeom.ph - f * riskGeom.ph;
        hov.setAttribute('style', 'display:block');
        hov.innerHTML = '<line x1="' + gx.toFixed(1) + '" y1="' + riskGeom.PT + '" x2="' + gx.toFixed(1) + '" y2="' + (riskGeom.PT + riskGeom.ph) + '" stroke="#79828a" stroke-width="0.8" stroke-dasharray="2 2"/>' +
          '<circle cx="' + gx.toFixed(1) + '" cy="' + gy.toFixed(1) + '" r="3.5" fill="#b05a51" stroke="#fff" stroke-width="1"/>';
      }
      var rel = t - S.days;
      tip.innerHTML = '<b>第 ' + t.toFixed(0) + ' 天</b>（距上次清蜡）<br>结蜡风险 F = <b>' + (f * 100).toFixed(1) + '%</b><br>' +
        (rel >= 0 ? '相对今天 <b>+' + rel.toFixed(0) + ' 天</b>' : '相对今天 <b>' + rel.toFixed(0) + ' 天</b>');
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 72) + 'px';
    });
    svg.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      var hov = document.getElementById('risk-hov');
      if (hov) hov.setAttribute('style', 'display:none');
    });
  }

  /* ---------- ② 井口温度/产液量时序 × 析蜡点 ---------- */
  var TSG = { W: 470, H: 240, PL: 40, PR: 36, PT: 16, PB: 30, T0: 15, T1: 50, Q0: 4, Q1: 10 };
  var tsGeom = null;

  function drawTS() {
    var svg = $('c-ts');
    var p = curParams();
    var W = TSG.W, H = TSG.H, PL = TSG.PL, PR = TSG.PR, PT = TSG.PT, PB = TSG.PB;
    var pw = W - PL - PR, ph = H - PT - PB;
    function x(d) { return PL + d / (ND - 1) * pw; }
    function yT(t) { return PT + ph - (t - TSG.T0) / (TSG.T1 - TSG.T0) * ph; }
    function yQ(q) { return PT + ph - (q - TSG.Q0) / (TSG.Q1 - TSG.Q0) * ph; }
    tsGeom = { PL: PL, pw: pw, PT: PT, ph: ph };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 析蜡点阈值带 42–48 ℃ */
    var yB1 = yT(48), yB2 = yT(42);
    s += '<rect x="' + PL + '" y="' + yB1.toFixed(1) + '" width="' + pw + '" height="' + (yB2 - yB1).toFixed(1) + '" fill="#c9a15a" opacity="0.14"/>';
    s += '<text x="' + (PL + 6) + '" y="' + ((yB1 + yB2) / 2 + 3).toFixed(1) + '" font-size="8.5" fill="#9a7a1c">析蜡点阈值带 42–48 ℃（区块范围）</text>';

    /* 网格 + 左轴（温度） */
    [15, 20, 25, 30, 35, 40, 45, 50].forEach(function (t) {
      s += '<line x1="' + PL + '" y1="' + yT(t) + '" x2="' + (PL + pw) + '" y2="' + yT(t) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 5) + '" y="' + (yT(t) + 3) + '" font-size="8.5" fill="#7b93b5" text-anchor="end" font-family="monospace">' + t + '</text>';
    });
    /* 右轴（产液量） */
    [4, 6, 8, 10].forEach(function (q) {
      s += '<text x="' + (PL + pw + 5) + '" y="' + (yQ(q) + 3) + '" font-size="8.5" fill="#b39b66" text-anchor="start" font-family="monospace">' + q + '</text>';
    });
    /* 月份刻度 */
    MON.forEach(function (m) {
      s += '<line x1="' + x(m[0]) + '" y1="' + PT + '" x2="' + x(m[0]) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(m[0]) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle">' + m[1] + '</text>';
    });

    /* 本井析蜡点线 */
    var yW = yT(p.wat);
    s += '<line x1="' + PL + '" y1="' + yW.toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + yW.toFixed(1) + '" stroke="#b05a51" stroke-width="1.1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (PL + pw - 4) + '" y="' + (yW - 4).toFixed(1) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">本井析蜡点 ' + p.wat.toFixed(1) + ' ℃</text>';

    /* 产液量线（金） */
    var d = '';
    for (var k = 0; k < ND; k++) d += (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + yQ(TS.Q[k]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#c9a15a" stroke-width="1.3" opacity="0.9"/>';

    /* 井口温度线（蓝），低于析蜡点段叠加红色 */
    d = '';
    for (k = 0; k < ND; k++) d += (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + yT(TS.T[k]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#41699b" stroke-width="1.8"/>';
    var seg = '', inSeg = false;
    for (k = 0; k < ND; k++) {
      if (TS.T[k] < p.wat) {
        seg += (inSeg ? 'L' : 'M') + x(k).toFixed(1) + ' ' + yT(TS.T[k]).toFixed(1) + ' ';
        inSeg = true;
      } else {
        if (inSeg) seg += 'L' + x(k).toFixed(1) + ' ' + yT(TS.T[k]).toFixed(1) + ' ';
        inSeg = false;
      }
    }
    if (seg) s += '<path d="' + seg + '" fill="none" stroke="#b05a51" stroke-width="2.6" opacity="0.85"/>';

    /* 上次热洗竖线 */
    var lw = ND - 1 - S.days;
    if (lw >= 0) {
      s += '<line x1="' + x(lw).toFixed(1) + '" y1="' + PT + '" x2="' + x(lw).toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#2f7d6b" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += '<text x="' + (x(lw) - 4).toFixed(1) + '" y="' + (PT + 10) + '" font-size="8.5" fill="#2f7d6b" text-anchor="end" font-weight="600">上次热洗（' + S.days + ' 天前）</text>';
    }

    /* 轴标题 */
    s += '<text x="' + (PL - 28) + '" y="' + (PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 28) + ' ' + (PT + ph / 2) + ')">井口温度 (℃)</text>';
    s += '<text x="' + (PL + pw + 30) + '" y="' + (PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (PL + pw + 30) + ' ' + (PT + ph / 2) + ')">产液量 (t/d)</text>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">时间（2025-11 → 2026-10，近 12 个月）</text>';

    s += '<g id="ts-hov" style="display:none"></g>';
    s += '<rect id="ts-cap" x="' + PL + '" y="' + PT + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
    svg.innerHTML = s;
  }

  function bindTSHover() {
    var svg = $('c-ts'), tip = $('t-ts'), box = $('box-ts');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      if (!tsGeom) return;
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (TSG.W / r.width);
      var k = clamp(Math.round((vx - tsGeom.PL) / tsGeom.pw * (ND - 1)), 0, ND - 1);
      var hov = document.getElementById('ts-hov');
      var gx = tsGeom.PL + k / (ND - 1) * tsGeom.pw;
      if (hov) {
        hov.setAttribute('style', 'display:block');
        hov.innerHTML = '<line x1="' + gx.toFixed(1) + '" y1="' + tsGeom.PT + '" x2="' + gx.toFixed(1) + '" y2="' + (tsGeom.PT + tsGeom.ph) + '" stroke="#79828a" stroke-width="0.8" stroke-dasharray="2 2"/>';
      }
      var below = TS.T[k] < S.wat;
      tip.innerHTML = '<b>' + monOf(k) + ' · 第 ' + k + ' 天</b><br>井口温度 <b>' + TS.T[k].toFixed(1) + ' ℃</b>' +
        (below ? ' <span style="color:#b05a51">低于析蜡点 ' + (S.wat - TS.T[k]).toFixed(1) + ' ℃</span>' : '') +
        '<br>产液量 <b>' + TS.Q[k].toFixed(1) + ' t/d</b>';
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 72) + 'px';
    });
    svg.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      var hov = document.getElementById('ts-hov');
      if (hov) hov.setAttribute('style', 'display:none');
    });
  }

  /* ---------- 季节风险日历（canvas · HiDPI） ---------- */
  function riskColor(r) {
    var c, t;
    var lo = [47, 125, 107], mid = [201, 161, 90], hi = [176, 90, 81];
    if (r < 0.5) { t = r / 0.5; c = [lo[0] + (mid[0] - lo[0]) * t, lo[1] + (mid[1] - lo[1]) * t, lo[2] + (mid[2] - lo[2]) * t]; }
    else { t = (r - 0.5) / 0.5; c = [mid[0] + (hi[0] - mid[0]) * t, mid[1] + (hi[1] - mid[1]) * t, mid[2] + (hi[2] - mid[2]) * t]; }
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }

  function drawStrip() {
    var cv = $('c-strip');
    if (!cv) return;
    var W = 470, H = 40, PL = 40, PR = 36;
    var pw = W - PL - PR;
    var ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    for (var d = 0; d < ND; d++) {
      var r = clamp(0.12 + 0.085 * (S.wat - TS.T[d]), 0, 1);
      ctx.fillStyle = riskColor(r);
      ctx.fillRect(PL + d / (ND - 1) * pw, 8, pw / (ND - 1) + 0.6, 16);
    }
    ctx.strokeStyle = '#cfc7b6';
    ctx.lineWidth = 1;
    ctx.strokeRect(PL, 8, pw, 16);
    ctx.fillStyle = '#79828a';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('低风险', PL, 35);
    ctx.textAlign = 'right';
    ctx.fillText('高风险', PL + pw, 35);
    ctx.textAlign = 'center';
    ctx.fillText('逐日季节风险（析蜡点 ' + S.wat.toFixed(1) + ' ℃ vs 井口温度）', PL + pw / 2, 35);
  }

  /* ---------- ③ 未来 30 天清蜡排产甘特 ---------- */
  var GT = { W: 470, H: 212, PL: 64, PR: 10, PT: 14, PB: 26, DAYS: 30 };
  var ganttRows = [];

  function drawGantt() {
    var svg = $('c-gantt');
    var W = GT.W, H = GT.H, PL = GT.PL, PR = GT.PR, PT = GT.PT, PB = GT.PB, DAYS = GT.DAYS;
    var pw = W - PL - PR, ph = H - PT - PB;
    function x(d) { return PL + d / DAYS * pw; }
    var n = WELLS.length, rowH = ph / n, barH = 13;
    ganttRows = [];

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格 + 天刻度 */
    for (var d = 0; d <= DAYS; d += 5) {
      s += '<line x1="' + x(d) + '" y1="' + PT + '" x2="' + x(d) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(d) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + d + '</text>';
    }
    /* 今天线 */
    s += '<line x1="' + x(0) + '" y1="' + PT + '" x2="' + x(0) + '" y2="' + (PT + ph) + '" stroke="#41699b" stroke-width="1.4"/>';
    s += '<text x="' + (x(0) + 3) + '" y="' + (PT + 9) + '" font-size="8.5" fill="#41699b" font-weight="600">今天</text>';

    for (var i = 0; i < n; i++) {
      var w = WELLS[i];
      var p = (i === S.well) ? curParams() : w;
      var win = windowOf(p);
      var lv = levelOf(win.fNow);
      var cy = PT + rowH * (i + 0.5);
      ganttRows.push({ i: i, y0: PT + rowH * i, y1: PT + rowH * (i + 1), win: win, p: p });

      /* 选中行底色 */
      if (i === S.well) s += '<rect x="' + PL + '" y="' + (PT + rowH * i).toFixed(1) + '" width="' + pw + '" height="' + rowH.toFixed(1) + '" fill="#f5f2ea" opacity="0.8"/>';
      s += '<line x1="' + PL + '" y1="' + (PT + rowH * i).toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + (PT + rowH * i).toFixed(1) + '" stroke="#efece1"/>';

      /* 井名 + 当前风险 */
      s += '<text x="' + (PL - 8) + '" y="' + (cy - 1).toFixed(1) + '" font-size="9" fill="#2f3538" text-anchor="end" font-family="monospace" font-weight="600">' + w.id + '</text>';
      s += '<text x="' + (PL - 8) + '" y="' + (cy + 9).toFixed(1) + '" font-size="8" fill="' + lv.c + '" text-anchor="end" font-family="monospace">F=' + Math.round(win.fNow * 100) + '%</text>';

      /* 建议窗口条 */
      if (win.e < 0) {
        /* 已过窗：红色警示块 */
        s += '<rect x="' + x(0).toFixed(1) + '" y="' + (cy - barH / 2).toFixed(1) + '" width="' + (x(2.2) - x(0)).toFixed(1) + '" height="' + barH + '" rx="3" fill="#b05a51"/>';
        s += '<text x="' + (x(2.2) + 5).toFixed(1) + '" y="' + (cy + 3).toFixed(1) + '" font-size="8.5" fill="#b05a51" font-family="monospace" font-weight="600">已过窗 ' + (-win.e).toFixed(0) + ' 天 · 立即热洗</text>';
      } else if (win.s > DAYS) {
        /* 窗口在 30 天外：右向箭头 */
        var ax = x(DAYS);
        s += '<path d="M' + (ax - 14) + ' ' + (cy - 4) + ' L' + (ax - 2) + ' ' + cy + ' L' + (ax - 14) + ' ' + (cy + 4) + ' Z" fill="#79828a"/>';
        s += '<text x="' + (ax - 18) + '" y="' + (cy + 3).toFixed(1) + '" font-size="8.5" fill="#79828a" text-anchor="end" font-family="monospace">第 ' + win.s.toFixed(0) + ' 天起（30 天外）→</text>';
      } else {
        var s0 = Math.max(0, win.s), e0 = Math.min(DAYS, win.e);
        s += '<rect x="' + x(s0).toFixed(1) + '" y="' + (cy - barH / 2).toFixed(1) + '" width="' + Math.max(3, x(e0) - x(s0)).toFixed(1) + '" height="' + barH + '" rx="3" fill="' + lv.c + '" opacity="0.85"/>';
        var label = fmtWin(win);
        if (e0 > 24) {
          s += '<text x="' + (x(s0) - 5).toFixed(1) + '" y="' + (cy + 3).toFixed(1) + '" font-size="8.5" fill="' + lv.c + '" text-anchor="end" font-family="monospace" font-weight="600">' + label + '</text>';
        } else {
          s += '<text x="' + (x(e0) + 5).toFixed(1) + '" y="' + (cy + 3).toFixed(1) + '" font-size="8.5" fill="' + lv.c + '" font-family="monospace" font-weight="600">' + label + '</text>';
        }
      }

      /* 固定周期对照点 */
      var tick = w.fixed - p.days;
      if (tick >= 0 && tick <= DAYS) {
        var tx = x(tick);
        s += '<rect x="' + (tx - 3.5).toFixed(1) + '" y="' + (cy + barH / 2 + 2).toFixed(1) + '" width="6" height="6" fill="#fff" stroke="#79828a" stroke-width="1.3" transform="rotate(45 ' + tx.toFixed(1) + ' ' + (cy + barH / 2 + 5).toFixed(1) + ')"/>';
      }
    }
    s += '<line x1="' + PL + '" y1="' + (PT + ph) + '" x2="' + (PL + pw) + '" y2="' + (PT + ph) + '" stroke="#d8d0bc"/>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">未来 30 天（从今天起）</text>';

    /* 行悬停捕获 */
    for (i = 0; i < n; i++) {
      s += '<rect class="g-row" data-i="' + i + '" x="' + PL + '" y="' + (PT + rowH * i).toFixed(1) + '" width="' + pw + '" height="' + rowH.toFixed(1) + '" fill="transparent"/>';
    }
    svg.innerHTML = s;
  }

  function bindGanttHover() {
    var svg = $('c-gantt'), tip = $('t-gantt'), box = $('box-gantt');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.classList && t.classList.contains('g-row')) {
        var i = +t.getAttribute('data-i');
        var row = null;
        for (var k = 0; k < ganttRows.length; k++) if (ganttRows[k].i === i) row = ganttRows[k];
        if (row) {
          var w = WELLS[i], win = row.win, p = row.p;
          tip.innerHTML = '<b>' + w.id + '</b>' + (i === S.well ? '（当前井）' : '') +
            '<br>含蜡量 ' + p.wax.toFixed(1) + '% · 析蜡点 ' + p.wat.toFixed(1) + ' ℃' +
            '<br>距上次清蜡 ' + p.days + ' 天 · 井口 ' + p.twh.toFixed(1) + ' ℃' +
            '<br>当前风险 F = <b>' + Math.round(win.fNow * 100) + '%</b> · η = <b>' + win.eta.toFixed(0) + ' 天</b>' +
            '<br>建议窗口：<b>' + fmtWin(win) + '</b>';
          tip.style.display = 'block';
          var rb = box.getBoundingClientRect();
          tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
          tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 90) + 'px';
        }
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- ④ 指标卡 + 建议 ---------- */
  function renderMetrics() {
    var p = curParams();
    var win = windowOf(p);
    var lv = levelOf(win.fNow);

    $('m-risk').innerHTML = Math.round(win.fNow * 100) + '<small> %</small>';
    $('m-risk').parentNode.className = 'mcard' + (win.fNow >= 0.55 ? ' bad' : win.fNow >= 0.30 ? ' warn' : '');

    $('m-eta').innerHTML = win.eta.toFixed(0) + '<small> 天</small>';

    $('m-win').innerHTML = win.e < 0 ? '已过·立即' : win.s > 30 ? '30 天外' : fmtWin(win).replace('第 ', '').replace(' 天', '<small> 天</small>');
    $('m-win').parentNode.className = 'mcard' + (win.e < 0 ? ' bad' : win.s < 0 ? ' warn' : '');

    $('m-level').textContent = lv.t;
    $('m-level').parentNode.className = 'mcard' + (lv.cls ? ' ' + lv.cls : '');

    var v = $('verdict');
    var head = '当前井 <b>' + WELLS[S.well].id + '</b> · 特征结蜡周期 η = <b>' + win.eta.toFixed(0) + '</b> 天 · 当前风险 F = <b>' + Math.round(win.fNow * 100) + '%</b>；';
    if (win.e < 0) {
      v.className = 'verdict bad';
      v.innerHTML = head + '建议窗口已过 <b>' + (-win.e).toFixed(0) + '</b> 天，蜡卡风险高：<b>立即安排热洗</b>，并在洗后复盘实际恢复幅度以校准标签。';
    } else if (win.s < 0) {
      v.className = 'verdict warn';
      v.innerHTML = head + '正处于建议窗口内（剩余 <b>' + win.e.toFixed(0) + '</b> 天）：本周内安排热洗，可与邻近井合并热洗车路线。';
    } else if (win.s <= 30) {
      v.className = 'verdict ok';
      v.innerHTML = head + '建议窗口为 <b>第 ' + Math.max(0, win.s).toFixed(0) + '–' + Math.min(30, win.e).toFixed(0) + ' 天</b>，尚有 ' + win.s.toFixed(0) + ' 天准备期：纳入 30 天滚动排产，无需提前。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '建议窗口在 <b>第 ' + win.s.toFixed(0) + '</b> 天（30 天外）：本月不排产，继续按日滚动更新风险曲线。';
    }
  }

  /* ---------- 渲染与绑定 ---------- */
  function render() {
    genTS();
    drawRisk();
    drawTS();
    drawStrip();
    drawGantt();
    renderMetrics();
  }

  var OUT = {
    wax: function (v) { return v.toFixed(1) + ' %'; },
    wat: function (v) { return v.toFixed(1) + ' ℃'; },
    days: function (v) { return v + ' 天'; },
    twh: function (v) { return v.toFixed(1) + ' ℃'; }
  };
  var KEYS = ['wax', 'wat', 'days', 'twh'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function buildWellBtns() {
    var box = $('well-btns');
    box.innerHTML = '';
    WELLS.forEach(function (w, i) {
      var b = document.createElement('button');
      b.className = 'well-btn' + (i === S.well ? ' active' : '');
      b.textContent = w.id;
      b.title = '含蜡量 ' + w.wax + '% · 析蜡点 ' + w.wat + ' ℃ · 固定周期 ' + w.fixed + ' 天';
      b.addEventListener('click', function () {
        S.well = i;
        S.wax = w.wax; S.wat = w.wat; S.days = w.days; S.twh = w.twh;
        syncSliders();
        buildWellBtns();
        render();
      });
      box.appendChild(b);
    });
  }

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      var w = WELLS[S.well];
      S.wax = w.wax; S.wat = w.wat; S.days = w.days; S.twh = w.twh;
      syncSliders();
      render();
    });
  }

  bind();
  buildWellBtns();
  syncSliders();
  render();
  bindRiskHover();
  bindTSHover();
  bindGanttHover();

  /* 尺寸变化时重建 canvas backing store（防抖），SVG 随布局自适应 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawStrip(); }, 120);
  });
})();

/* ======= 真实数据来源页签（公开标准 / 文献 / 官方报道） ======= */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- ① 来源汇总表（Web 检索整理，可点击溯源） ---------- */
  var SRC = [
    { src: 'SY/T 0545-2012《原油析蜡热特性参数的测定 差示扫描量热法》', type: '行业标准', key: 'DSC 曲线第一放热峰的起始温度即为析蜡点 Tc；2012-03-01 实施，代替 SY/T 0545-1995', url: 'https://img.antpedia.com/standard/files/pdfs_ora/CN-SY/fbb/SY_T%200545-2012_9375.pdf', tag: '标准原文↗' },
    { src: 'Burger, Perkins & Striegler (1981), J. Pet. Technol. 33(6):1075–1086', type: '结蜡机理', key: 'TAPS 管道蜡沉积奠基研究：分子扩散 + 剪切弥散 + 布朗扩散三种横向输运机理；DOI 10.2118/8788-PA', url: 'https://www.osti.gov/biblio/6650586', tag: 'OSTI↗' },
    { src: 'Kaplan & Meier (1958), JASA 53(282):457–481', type: '生存分析', key: 'Kaplan-Meier 乘积极限估计，天然支持右删失；统计学被引最多文献之一（3.6 万+）；DOI 10.1080/01621459.1958.10501452', url: 'https://www.tandfonline.com/doi/pdf/10.1080/01621459.1958.10501452', tag: '原文↗' },
    { src: 'Cox (1972), J. R. Stat. Soc. B 34(2):187–220', type: '生存分析', key: 'Cox 比例风险模型：协变量对风险率的乘性影响 h(t)=h₀(t)·e^(βx)；被引 5.7 万+', url: 'https://academic.oup.com/jrsssb/article-pdf/34/2/187/56901755/jrsssb_34_2_187.pdf', tag: '原文↗' },
    { src: 'Katzman et al. (2018) DeepSurv, BMC Med. Res. Methodol. 18:24', type: '深度生存模型', key: 'Cox 深度神经网络生存模型，本案例逐井风险曲线同源方法；DOI 10.1186/s12874-018-0482-1', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5828433/', tag: 'PMC↗' },
    { src: 'Fan et al. (2026), Can. J. Chem. Eng.（高含蜡原油冷区输送蜡沉积行为与预测建模）', type: '预测模型', key: '实验 + 麻雀搜索算法优化 BP 神经网络（SSA-BP）预测蜡沉积速率，与实验高度相关', url: 'https://onlinelibrary.wiley.com/doi/abs/10.1002/cjce.25772', tag: 'Wiley↗' },
    { src: '《深部结蜡页岩油水平井涂层与电加热清防蜡技术》石油钻采工艺 (2024)', type: '区块实证', key: '庆城油田（鄂尔多斯盆地）页岩油含蜡量约 20%、析蜡点约 25 ℃；蜡卡 / 蜡堵占作业总量 30% 以上；DOI 10.13639/j.odpt.202404039', url: 'http://syzcgy.xml-journal.net/cn/article/pdf/preview/10.13639/j.odpt.202404039.pdf', tag: '原文↗' },
    { src: '中国石油网：大港采油三厂三区分类治理防蜡降耗 (2017)', type: '现场报道', key: '石蜡基高含蜡原油；热洗周期由 20 余天延长至 3 个月，单井节约药剂与热洗费用 4.6 万元', url: 'https://www.cnpc.com.cn/cnpc/xgdt/201703/dcc179ed542344a985eb9fad16a30190.shtml', tag: '报道↗' },
    { src: '中国石油网：玉门酒东采油厂高效清蜡 (2018)', type: '现场报道', key: '两年平均热洗周期延长 40 天、减少热洗 23 井次；油井免修期 247 → 425 天、减少检泵 25 井次', url: 'https://www.cnpc.com.cn/cnpc/syzbzzdt/201806/2aa5fd08922440d78ecb2f606ed7976d.shtml', tag: '报道↗' },
    { src: '《抽油机热洗周期影响因素分析及确定方法》（期刊网收录）', type: '实验报道', key: '原油含蜡量 12%→22% 时相同条件结蜡速率提升约 2.7 倍；含蜡量每 +5%，蜡晶析出量 +30% 以上，热洗周期需缩短 15–20 天', url: 'https://www.chinaqikan.com/thesis/view/9702564', tag: '来源↗' }
  ];

  function buildTable() {
    var body = $('src-body');
    if (!body) return;
    SRC.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + r.src + '</td><td>' + r.type + '</td><td>' + r.key + '</td><td><a href="' + r.url + '" target="_blank" rel="noopener">' + r.tag + '</a></td>';
      body.appendChild(tr);
    });
  }

  /* ---------- ② 含蜡量 → 相对结蜡速率（室内实验报道值） ---------- */
  var WAXD = [
    { wax: 12, rate: 1.0, note: '基准' },
    { wax: 22, rate: 2.7, note: '速率 ×2.7' }
  ];

  function drawWax() {
    var svg = $('c-wax');
    if (!svg) return;
    var W = 470, H = 230, PL = 46, PR = 20, PT = 30, PB = 34;
    var pw = W - PL - PR, ph = H - PT - PB;
    var W0 = 10, W1 = 28, R1 = 3;
    function x(w) { return PL + (w - W0) / (W1 - W0) * pw; }
    function y(r) { return PT + ph - r / R1 * ph; }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 本案例区块含蜡量范围 18–26% */
    s += '<rect x="' + x(18).toFixed(1) + '" y="' + PT + '" width="' + (x(26) - x(18)).toFixed(1) + '" height="' + ph + '" fill="#c9a15a" opacity="0.12"/>';
    s += '<text x="' + ((x(18) + x(26)) / 2).toFixed(1) + '" y="' + (PT + 11) + '" font-size="8.5" fill="#9a7a1c" text-anchor="middle">本案例区块含蜡量范围 18–26%</text>';

    /* 网格 + y 轴 */
    for (var r = 0; r <= R1; r += 0.5) {
      s += '<line x1="' + PL + '" y1="' + y(r) + '" x2="' + (PL + pw) + '" y2="' + y(r) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (y(r) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + r.toFixed(1) + '</text>';
    }
    /* x 轴 */
    for (var w = 10; w <= 28; w += 2) {
      s += '<line x1="' + x(w) + '" y1="' + PT + '" x2="' + x(w) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(w) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + w + '%</text>';
    }

    /* 连线（报道两点） */
    s += '<line x1="' + x(12) + '" y1="' + y(1.0) + '" x2="' + x(22) + '" y2="' + y(2.7) + '" stroke="#b05a51" stroke-width="1.4" stroke-dasharray="5 3" opacity="0.7"/>';

    /* 柱条 */
    WAXD.forEach(function (d, i) {
      var bw = 46;
      var bx = x(d.wax) - bw / 2, by = y(d.rate);
      s += '<rect class="wax-bar" data-i="' + i + '" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw + '" height="' + (PT + ph - by).toFixed(1) + '" rx="4" fill="#b05a51" opacity="0.85"/>';
      s += '<text x="' + x(d.wax) + '" y="' + (by - 6).toFixed(1) + '" font-size="9.5" fill="#b05a51" text-anchor="middle" font-family="monospace" font-weight="600">×' + d.rate.toFixed(1) + '</text>';
      s += '<text x="' + x(d.wax) + '" y="' + (PT + ph + 24) + '" font-size="8.5" fill="#79828a" text-anchor="middle">' + d.note + '</text>';
    });

    s += '<text x="' + (PL + pw / 2) + '" y="' + (PT - 16) + '" font-size="9" fill="#5d666d" text-anchor="middle">含蜡量 12% → 22%，相同条件结蜡速率提升约 2.7 倍（室内实验报道值）</text>';
    s += '<text x="' + (PL - 34) + '" y="' + (PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 34) + ' ' + (PT + ph / 2) + ')">相对结蜡速率（×）</text>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 2) + '" font-size="9" fill="#5d666d" text-anchor="middle">原油含蜡量</text>';

    svg.innerHTML = s;
  }

  function bindWaxHover() {
    var svg = $('c-wax'), tip = $('t-wax'), box = $('box-wax');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.classList && t.classList.contains('wax-bar')) {
        var d = WAXD[+t.getAttribute('data-i')];
        tip.innerHTML = '<b>含蜡量 ' + d.wax + '%</b><br>相对结蜡速率 <b>×' + d.rate.toFixed(1) + '</b><br><span style="color:#8a9298">室内实验报道值（期刊网收录文献）</span>';
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 64) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- ③ 清蜡周期优化效果（官方报道值） ---------- */
  var IMP = [
    { label: '大港采油三厂三区 · 热洗周期', delta: 69, detail: '由 20 余天延长至 3 个月（约 21 → 90 天）', c: '#2f7d6b' },
    { label: '玉门酒东采油厂 · 平均热洗周期', delta: 40, detail: '两年平均有效延长 40 天，减少热洗 23 井次', c: '#41699b' },
    { label: '玉门酒东采油厂 · 油井免修期', delta: 178, detail: '247 → 425 天，减少检泵 25 井次', c: '#c9a15a' }
  ];

  function drawImp() {
    var svg = $('c-imp');
    if (!svg) return;
    var W = 470, H = 180, PL = 168, PR = 56, PT = 16, PB = 28;
    var pw = W - PL - PR, ph = H - PT - PB;
    var X1 = 200;
    function x(v) { return PL + v / X1 * pw; }
    var n = IMP.length, rowH = ph / n, barH = 18;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var v = 0; v <= X1; v += 50) {
      s += '<line x1="' + x(v) + '" y1="' + PT + '" x2="' + x(v) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(v) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
    }

    IMP.forEach(function (d, i) {
      var cy = PT + rowH * (i + 0.5);
      s += '<text x="' + (PL - 8) + '" y="' + (cy + 3).toFixed(1) + '" font-size="9" fill="#2f3538" text-anchor="end">' + d.label + '</text>';
      s += '<rect class="imp-bar" data-i="' + i + '" x="' + PL + '" y="' + (cy - barH / 2).toFixed(1) + '" width="' + (x(d.delta) - PL).toFixed(1) + '" height="' + barH + '" rx="4" fill="' + d.c + '" opacity="0.85"/>';
      s += '<text x="' + (x(d.delta) + 6).toFixed(1) + '" y="' + (cy + 3).toFixed(1) + '" font-size="9" fill="' + d.c + '" font-family="monospace" font-weight="600">+' + d.delta + ' 天</text>';
    });

    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">清蜡 / 免修周期改善幅度（天）· 中国石油网官方报道</text>';
    svg.innerHTML = s;
  }

  function bindImpHover() {
    var svg = $('c-imp'), tip = $('t-imp'), box = $('box-imp');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.classList && t.classList.contains('imp-bar')) {
        var d = IMP[+t.getAttribute('data-i')];
        tip.innerHTML = '<b>' + d.label + '</b><br>改善 <b>+' + d.delta + ' 天</b><br><span style="color:#8a9298">' + d.detail + '</span>';
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 64) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 页签切换 ---------- */
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
  buildTable();
  drawWax();
  drawImp();
  bindWaxHover();
  bindImpHover();
})();
