/* ======= 射孔效果智能评估 · 可运行示范（完善度反演模拟） ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function f1(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(1); }
  function f2(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }

  /* 确定性伪随机（同一井例多次渲染一致） */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var RE = 250, RW = 0.108, LR = Math.log(RE / RW); /* ≈7.75 */
  var NDAYS = 1092, STEP = 7, NW = Math.floor(NDAYS / STEP) + 1; /* 157 周 */

  /* ---------- 三口模拟井例（业务口径：48 口普查中抽取） ---------- */
  var WELLS = [
    {
      id: 'A2', name: 'BD-A2', kind: '锚点井', anchor: true, tws: 1.2, twDay: 980,
      q0: 28, D: 0.00055,
      event: { day: 512, label: '酸化解堵（S2上/S3）', segs: [2, 3], factor: 0.45 },
      segs: [
        { name: 'S1上', kh: 2.6, s0: 0.4, drift: 0.0006 },
        { name: 'S1下', kh: 2.1, s0: 0.8, drift: 0.0009 },
        { name: 'S2上', kh: 3.4, s0: 1.4, drift: 0.0011 },
        { name: 'S3',  kh: 1.5, s0: 2.9, drift: 0.0016 },
        { name: 'S4',  kh: 2.9, s0: 1.1, drift: 0.0007 }
      ]
    },
    {
      id: 'W17', name: 'BD-W17', kind: '评估井', anchor: false, tws: null, twDay: 0,
      q0: 19, D: 0.00062,
      event: { day: 648, label: '补孔（S2下/S4）', segs: [2, 4], factor: 0.32 },
      segs: [
        { name: 'S1',  kh: 3.1, s0: 0.9, drift: 0.0008 },
        { name: 'S2上', kh: 1.2, s0: 1.6, drift: 0.0010 },
        { name: 'S2下', kh: 2.4, s0: 4.8, drift: 0.0024 },
        { name: 'S3',  kh: 1.8, s0: 2.2, drift: 0.0012 },
        { name: 'S4',  kh: 3.6, s0: 5.9, drift: 0.0028 }
      ]
    },
    {
      id: 'W32', name: 'BD-W32', kind: '评估井', anchor: false, tws: null, twDay: 0,
      q0: 33, D: 0.00045,
      event: { day: 763, label: '重复射孔（S3）', segs: [2], factor: 0.40 },
      segs: [
        { name: 'S1上', kh: 3.6, s0: -0.6, drift: 0.0004 },
        { name: 'S1下', kh: 2.8, s0: 0.2,  drift: 0.0005 },
        { name: 'S3',  kh: 2.2, s0: 2.6,  drift: 0.0018 },
        { name: 'S4上', kh: 3.0, s0: 0.5,  drift: 0.0006 }
      ]
    }
  ];

  /* 段表皮 s_i(t)：随时间污染缓增；措施日后被处理段折减后继续缓增 */
  function segSkinAt(w, i, t) {
    var sg = w.segs[i], ev = w.event;
    if (t >= ev.day && w.evSet[i]) {
      var sev = -0.2 + ev.factor * (sg.s0 + sg.drift * ev.day);
      return sev + sg.drift * (t - ev.day);
    }
    return sg.s0 + sg.drift * t;
  }
  function skinTrue(w, t) {
    var s = 0;
    for (var i = 0; i < w.segs.length; i++) s += w.segs[i].c * segSkinAt(w, i, t);
    return s;
  }

  /* ---------- 生成生产序列（确定性，仅生成一次） ---------- */
  WELLS.forEach(function (w, wi) {
    var ws = w.segs.map(function (sg) { return sg.kh / (1 + 0.25 * Math.max(0, sg.s0)); });
    var sum = ws.reduce(function (a, b) { return a + b; }, 0);
    w.segs.forEach(function (sg, i) { sg.c = ws[i] / sum; });
    w.evSet = {};
    w.event.segs.forEach(function (i) { w.evSet[i] = true; });

    var rnd = mulberry32(20260 + wi * 917);
    w.t = []; w.qo = []; w.fw = []; w.pwf = []; w.S = [];
    w.S0 = skinTrue(w, 0);
    for (var k = 0; k < NW; k++) {
      var t = k * STEP, St = skinTrue(w, t);
      var q = w.q0 * Math.exp(-w.D * t) * (LR + w.S0) / (LR + St) * (1 + (rnd() - 0.5) * 0.12);
      var fw = 0.58 + 0.30 * (1 - Math.exp(-t / 900)) + (rnd() - 0.5) * 0.02;
      var pw = 8.5 - 1.5 * (1 - Math.exp(-t / 1400)) + 0.18 * (w.S0 - St) + (rnd() - 0.5) * 0.3;
      w.t.push(t); w.qo.push(q); w.fw.push(clamp(fw, 0, 0.97)); w.pwf.push(clamp(pw, 4, 12)); w.S.push(St);
    }
  });

  /* ---------- 状态 ---------- */
  var DEF = { well: 1, cursor: 1050, lam: 0.85, sm: 5 };
  var S = Object.assign({}, DEF);
  var STORE_KEY = 'p4-perf-effect-eval-v1';
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      Object.keys(DEF).forEach(function (k) { if (typeof s[k] === 'number') S[k] = s[k]; });
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------- 反演（带缓存；λ 与平滑窗改变时重算） ---------- */
  var invCache = {};
  function invert(w) {
    var key = w.id + '|' + S.lam + '|' + S.sm;
    if (invCache[key]) return invCache[key];
    var raw = [], k, t;
    for (k = 0; k < NW; k++) {
      t = w.t[k];
      var qmod = w.q0 * Math.exp(-w.D * t);
      var sApp = (LR + w.S0) * (qmod / w.qo[k]) - LR;
      var bias = (1 - S.lam) * (w.fw[k] - 0.6) * 8; /* 高含水未校正偏差 */
      raw.push(sApp + bias);
    }
    var win = Math.round(S.sm / 2), sm = [];
    for (k = 0; k < NW; k++) {
      var a = Math.max(0, k - win), b = Math.min(NW - 1, k + win), acc = 0;
      for (var j = a; j <= b; j++) acc += raw[j];
      sm.push(acc / (b - a + 1));
    }
    var band = w.fw.map(function (f) {
      return (0.35 + 1.7 * (1 - S.lam)) * (1 + 0.9 * (f - 0.58) / 0.3);
    });
    invCache[key] = { s: sm, b: band };
    return invCache[key];
  }
  function cursorIdx() { return clamp(Math.round(S.cursor / STEP), 0, NW - 1); }

  /* ---------- ① 生产时序 ---------- */
  var PR_W = 920, PR_H = 300, PL = 46, PR = 46, PT = 18, H1 = 172, GAP = 30, H2 = 52, PB = 28;
  var PW = PR_W - PL - PR;
  var HOVER_K = -1;

  function xT(t) { return PL + t / NDAYS * PW; }

  function drawProd() {
    var svg = $('prod'), w = WELLS[S.well];
    var qmax = Math.ceil(w.q0 * 1.2 / 5) * 5;
    var y1 = PT + H1, y2t = y1 + GAP, y2b = y2t + H2;
    function yQ(q) { return PT + H1 - q / qmax * H1; }
    function yP(p) { return PT + H1 - (p - 4) / 8 * H1; }
    function yF(f) { return y2t + H2 - (f - 0.4) / 0.6 * H2; }

    var s = '<rect width="' + PR_W + '" height="' + PR_H + '" fill="#fdfcf9"/>';

    /* 网格 + 左轴（日产油） */
    for (var q = 0; q <= qmax; q += qmax / 4) {
      s += '<line x1="' + PL + '" y1="' + yQ(q) + '" x2="' + (PL + PW) + '" y2="' + yQ(q) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yQ(q) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + q.toFixed(0) + '</text>';
    }
    /* 右轴（油压 4–12 MPa） */
    [4, 6, 8, 10, 12].forEach(function (p) {
      s += '<text x="' + (PL + PW + 6) + '" y="' + (yP(p) + 3) + '" font-size="8.5" fill="#7b93b5" text-anchor="start" font-family="monospace">' + p + '</text>';
    });
    /* 下面板网格 + 含水轴（40–100%） */
    [40, 60, 80, 100].forEach(function (f) {
      s += '<line x1="' + PL + '" y1="' + yF(f / 100) + '" x2="' + (PL + PW) + '" y2="' + yF(f / 100) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yF(f / 100) + 3) + '" font-size="8.5" fill="#b39b66" text-anchor="end" font-family="monospace">' + f + '</text>';
    });
    /* 时间轴（半年刻度） */
    for (var t = 0; t <= NDAYS; t += 182) {
      s += '<text x="' + xT(t) + '" y="' + (y2b + 14) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + (t / 364).toFixed(1) + '</text>';
    }
    s += '<text x="' + (PL + PW / 2) + '" y="' + (PR_H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">生产时间（年）</text>';
    s += '<text x="' + (PL - 34) + '" y="' + (PT + H1 / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 34) + ' ' + (PT + H1 / 2) + ')">日产油 (t/d)</text>';
    s += '<text x="' + (PL + PW + 36) + '" y="' + (PT + H1 / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (PL + PW + 36) + ' ' + (PT + H1 / 2) + ')">油压 (MPa)</text>';
    s += '<text x="' + (PL + 4) + '" y="' + (y2t + 11) + '" font-size="8.5" fill="#b39b66">含水率 (%)</text>';

    /* 含水率面积线 */
    var d = '';
    for (var k = 0; k < NW; k++) d += (k ? 'L' : 'M') + xT(w.t[k]).toFixed(1) + ' ' + yF(w.fw[k]).toFixed(1) + ' ';
    s += '<path d="' + d + 'L' + xT(NDAYS) + ' ' + y2b + ' L' + PL + ' ' + y2b + ' Z" fill="#c9a15a" opacity="0.15"/>';
    s += '<path d="' + d + '" fill="none" stroke="#c9a15a" stroke-width="1.4"/>';

    /* 油压虚线 */
    d = '';
    for (k = 0; k < NW; k++) d += (k ? 'L' : 'M') + xT(w.t[k]).toFixed(1) + ' ' + yP(w.pwf[k]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#41699b" stroke-width="1.3" stroke-dasharray="4 3" opacity="0.85"/>';

    /* 日产油主线 */
    d = '';
    for (k = 0; k < NW; k++) d += (k ? 'L' : 'M') + xT(w.t[k]).toFixed(1) + ' ' + yQ(w.qo[k]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#2f7d6b" stroke-width="2"/>';

    /* 补孔/措施事件标注 */
    var ex = xT(w.event.day);
    s += '<line x1="' + ex + '" y1="' + PT + '" x2="' + ex + '" y2="' + y2b + '" stroke="#b05a51" stroke-width="1.3" stroke-dasharray="5 3"/>';
    s += '<rect x="' + (ex - 62) + '" y="' + (PT - 1) + '" width="124" height="14" rx="3" fill="#b05a51" opacity="0.92"/>';
    s += '<text x="' + ex + '" y="' + (PT + 9) + '" font-size="8.5" fill="#fff" text-anchor="middle" font-weight="600">' + w.event.label + ' · 第' + w.event.day + '天</text>';

    /* 分析时点竖线 */
    var cx = xT(S.cursor);
    s += '<line x1="' + cx + '" y1="' + PT + '" x2="' + cx + '" y2="' + y2b + '" stroke="#5d666d" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<text x="' + (cx + (cx > PL + PW - 90 ? -4 : 4)) + '" y="' + (y2b - 4) + '" font-size="8.5" fill="#5d666d" text-anchor="' + (cx > PL + PW - 90 ? 'end' : 'start') + '" font-family="monospace">分析时点 第' + S.cursor + '天</text>';

    /* hover 十字线 */
    if (HOVER_K >= 0) {
      var hx = xT(w.t[HOVER_K]);
      s += '<line x1="' + hx + '" y1="' + PT + '" x2="' + hx + '" y2="' + y2b + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="2 2"/>';
      s += '<circle cx="' + hx + '" cy="' + yQ(w.qo[HOVER_K]) + '" r="3.4" fill="#2f7d6b" stroke="#fff" stroke-width="1.2"/>';
      s += '<circle cx="' + hx + '" cy="' + yP(w.pwf[HOVER_K]) + '" r="3" fill="#41699b" stroke="#fff" stroke-width="1"/>';
      s += '<circle cx="' + hx + '" cy="' + yF(w.fw[HOVER_K]) + '" r="3" fill="#c9a15a" stroke="#fff" stroke-width="1"/>';
    }
    svg.innerHTML = s;
  }

  function bindProd() {
    var svg = $('prod'), tip = $('prod-tip'), box = $('prod-box');
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (PR_W / r.width);
      if (vx < PL || vx > PL + PW) { HOVER_K = -1; tip.style.display = 'none'; drawProd(); return; }
      var t = (vx - PL) / PW * NDAYS;
      HOVER_K = clamp(Math.round(t / STEP), 0, NW - 1);
      drawProd();
      var w = WELLS[S.well], rb = box.getBoundingClientRect();
      tip.innerHTML = '第 <b>' + w.t[HOVER_K] + '</b> 天（' + (w.t[HOVER_K] / 364).toFixed(2) + ' 年）<br>' +
        '日产油 <b>' + w.qo[HOVER_K].toFixed(1) + '</b> t/d<br>' +
        '油压 <b>' + w.pwf[HOVER_K].toFixed(2) + '</b> MPa<br>' +
        '含水 <b>' + (w.fw[HOVER_K] * 100).toFixed(1) + '</b> %';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 84) + 'px';
    });
    svg.addEventListener('mouseleave', function () { HOVER_K = -1; tip.style.display = 'none'; drawProd(); });
  }

  /* ---------- ②a 全井表皮演化 ---------- */
  var SK_W = 450, SK_H = 240, SK_PL = 40, SK_PR = 14, SK_PT = 16, SK_PB = 30;
  var SK_PW = SK_W - SK_PL - SK_PR, SK_PH = SK_H - SK_PT - SK_PB;
  var SY0 = -2.5, SY1 = 7.5;
  var HOVER_SK = -1;
  function skX(t) { return SK_PL + t / NDAYS * SK_PW; }
  function skY(v) { return SK_PT + SK_PH - (v - SY0) / (SY1 - SY0) * SK_PH; }

  function drawSkin() {
    var svg = $('skin'), w = WELLS[S.well], inv = invert(w);
    var s = '<rect width="' + SK_W + '" height="' + SK_H + '" fill="#fdfcf9"/>';

    /* 网格与刻度 */
    [-2, 0, 1, 3, 5, 7].forEach(function (v) {
      s += '<line x1="' + SK_PL + '" y1="' + skY(v) + '" x2="' + (SK_PL + SK_PW) + '" y2="' + skY(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (SK_PL - 5) + '" y="' + (skY(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    });
    for (var t = 0; t <= NDAYS; t += 364) {
      s += '<line x1="' + skX(t) + '" y1="' + SK_PT + '" x2="' + skX(t) + '" y2="' + (SK_PT + SK_PH) + '" stroke="#efece1"/>';
      s += '<text x="' + skX(t) + '" y="' + (SK_PT + SK_PH + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + (t / 364) + '年</text>';
    }
    /* S=3 低效阈值与 S=0 完善线 */
    s += '<line x1="' + SK_PL + '" y1="' + skY(3) + '" x2="' + (SK_PL + SK_PW) + '" y2="' + skY(3) + '" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + (SK_PL + SK_PW - 3) + '" y="' + (skY(3) - 3) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">S=3 低效阈值</text>';
    s += '<line x1="' + SK_PL + '" y1="' + skY(0) + '" x2="' + (SK_PL + SK_PW) + '" y2="' + skY(0) + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="3 3"/>';
    s += '<text x="' + (SK_PL + SK_PW - 3) + '" y="' + (skY(0) - 3) + '" font-size="8.5" fill="#8a9298" text-anchor="end" font-family="monospace">S=0 裸眼完善</text>';

    /* 后验区间带 */
    var d = '', k;
    for (k = 0; k < NW; k++) d += (k ? 'L' : 'M') + skX(w.t[k]).toFixed(1) + ' ' + skY(inv.s[k] + inv.b[k]).toFixed(1) + ' ';
    for (k = NW - 1; k >= 0; k--) d += 'L' + skX(w.t[k]).toFixed(1) + ' ' + skY(inv.s[k] - inv.b[k]).toFixed(1) + ' ';
    s += '<path d="' + d + 'Z" fill="#2f7d6b" opacity="0.12"/>';

    /* 正演真值参考 */
    d = '';
    for (k = 0; k < NW; k++) d += (k ? 'L' : 'M') + skX(w.t[k]).toFixed(1) + ' ' + skY(w.S[k]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#8a9298" stroke-width="1.1" stroke-dasharray="4 3"/>';

    /* 反演曲线 */
    d = '';
    for (k = 0; k < NW; k++) d += (k ? 'L' : 'M') + skX(w.t[k]).toFixed(1) + ' ' + skY(inv.s[k]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#2f7d6b" stroke-width="2"/>';

    /* 事件竖线 */
    var ex = skX(w.event.day);
    s += '<line x1="' + ex + '" y1="' + SK_PT + '" x2="' + ex + '" y2="' + (SK_PT + SK_PH) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="4 3"/>';

    /* 锚点井试井真值 */
    if (w.anchor) {
      var tx = skX(w.twDay), ty = skY(w.tws);
      s += '<path d="M ' + tx + ' ' + (ty - 6) + ' L ' + (tx + 5) + ' ' + ty + ' L ' + tx + ' ' + (ty + 6) + ' L ' + (tx - 5) + ' ' + ty + ' Z" fill="#c9a15a" stroke="#8a6d33" stroke-width="1"/>';
      s += '<text x="' + (tx - 8) + '" y="' + (ty + 3) + '" font-size="8.5" fill="#9a7a1c" text-anchor="end" font-family="monospace" font-weight="600">试井真值 S=' + f1(w.tws) + '</text>';
    }

    /* 分析时点游标 */
    var ci = cursorIdx(), cx = skX(w.t[ci]);
    s += '<line x1="' + cx + '" y1="' + SK_PT + '" x2="' + cx + '" y2="' + (SK_PT + SK_PH) + '" stroke="#5d666d" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<circle cx="' + cx + '" cy="' + skY(inv.s[ci]) + '" r="4" fill="#2f7d6b" stroke="#fff" stroke-width="1.4"/>';

    /* hover */
    if (HOVER_SK >= 0) {
      var hx = skX(w.t[HOVER_SK]);
      s += '<line x1="' + hx + '" y1="' + SK_PT + '" x2="' + hx + '" y2="' + (SK_PT + SK_PH) + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="2 2"/>';
      s += '<circle cx="' + hx + '" cy="' + skY(inv.s[HOVER_SK]) + '" r="3" fill="#2f7d6b" stroke="#fff" stroke-width="1"/>';
    }

    s += '<text x="' + (SK_PL - 30) + '" y="' + (SK_PT + SK_PH / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (SK_PL - 30) + ' ' + (SK_PT + SK_PH / 2) + ')">全井表皮 S（—）</text>';
    svg.innerHTML = s;
  }

  function bindSkin() {
    var svg = $('skin'), tip = $('skin-tip'), box = $('skin-box');
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (SK_W / r.width);
      if (vx < SK_PL || vx > SK_PL + SK_PW) { HOVER_SK = -1; tip.style.display = 'none'; drawSkin(); return; }
      var t = (vx - SK_PL) / SK_PW * NDAYS;
      HOVER_SK = clamp(Math.round(t / STEP), 0, NW - 1);
      drawSkin();
      var w = WELLS[S.well], inv = invert(w), rb = box.getBoundingClientRect();
      tip.innerHTML = '第 <b>' + w.t[HOVER_SK] + '</b> 天<br>反演 Ŝ = <b>' + f2(inv.s[HOVER_SK]) + '</b><br>' +
        '后验区间 [' + f2(inv.s[HOVER_SK] - inv.b[HOVER_SK]) + ', ' + f2(inv.s[HOVER_SK] + inv.b[HOVER_SK]) + ']<br>' +
        '<span style="color:#8a9298">正演参考 S=' + f2(w.S[HOVER_SK]) + '</span>';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 92) + 'px';
    });
    svg.addEventListener('mouseleave', function () { HOVER_SK = -1; tip.style.display = 'none'; drawSkin(); });
  }

  /* ---------- ②b 分段贡献分解 ---------- */
  var SG_W = 450, SK_PB2 = 24, SG_H0 = 16;
  var HOVER_SG = -1;

  function segClass(sv) {
    if (sv > 3) return { c: '#b05a51', label: '低效', adv: 'P 级补孔 / 重复射孔' };
    if (sv > 1) return { c: '#c9a15a', label: '一般', adv: '解堵 / 观察' };
    if (sv > 0) return { c: '#41699b', label: '良好', adv: '维持' };
    return { c: '#2f7d6b', label: '完善', adv: '保持，不措施' };
  }

  function drawSegs() {
    var svg = $('segs'), w = WELLS[S.well], ci = cursorIdx(), t = w.t[ci];
    var n = w.segs.length;
    var SG_H = SG_H0 + n * 40 + SK_PB2;
    svg.setAttribute('viewBox', '0 0 ' + SG_W + ' ' + SG_H);
    var pl = 64, pr = 96, pw = SG_W - pl - pr;
    var maxC = Math.max.apply(null, w.segs.map(function (sg) { return sg.c; }));

    var s = '<rect width="' + SG_W + '" height="' + SG_H + '" fill="#fdfcf9"/>';
    /* 贡献率网格（%） */
    var gmax = Math.ceil(maxC * 100 / 10) * 10;
    for (var g = 0; g <= gmax; g += 10) {
      var gx = pl + g / (maxC * 100) * pw;
      if (gx > pl + pw) continue;
      s += '<line x1="' + gx.toFixed(1) + '" y1="' + SG_H0 + '" x2="' + gx.toFixed(1) + '" y2="' + (SG_H - SK_PB2) + '" stroke="#efece1"/>';
      s += '<text x="' + gx.toFixed(1) + '" y="' + (SG_H - SK_PB2 + 12) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + g + '%</text>';
    }

    w.segs.forEach(function (sg, i) {
      var sv = segSkinAt(w, i, t), cls = segClass(sv);
      var cy = SG_H0 + 20 + i * 40;
      var bw = sg.c / maxC * pw;
      var sel = HOVER_SG === i;
      s += '<text x="' + (pl - 6) + '" y="' + (cy + 3) + '" font-size="9.5" fill="#4d565b" text-anchor="end">' + sg.name + '</text>';
      s += '<rect data-seg="' + i + '" x="' + pl + '" y="' + (cy - 8) + '" width="' + bw.toFixed(1) + '" height="16" rx="3" fill="' + cls.c + '" opacity="' + (sel ? 1 : 0.82) + '"' + (sv > 3 ? ' stroke="#7c352e" stroke-width="' + (sel ? 1.6 : 0.8) + '"' : '') + '/>';
      s += '<text x="' + (pl + bw + 5) + '" y="' + (cy + 3) + '" font-size="9" fill="#3a4145" font-family="monospace">' + (sg.c * 100).toFixed(0) + '%</text>';
      s += '<text x="' + (SG_W - 6) + '" y="' + (cy + 3) + '" font-size="9" fill="' + cls.c + '" font-family="monospace" text-anchor="end" font-weight="600">S=' + f1(sv) + (sv > 3 ? ' 低效' : '') + '</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (SG_H - 3) + '" font-size="8.5" fill="#5d666d" text-anchor="middle">产量贡献率（第 ' + t + ' 天 · 非负约束分解）</text>';
    svg.innerHTML = s;

    Array.prototype.forEach.call(svg.querySelectorAll('rect[data-seg]'), function (el) {
      el.addEventListener('mousemove', function (evt) {
        var i = +el.getAttribute('data-seg');
        if (HOVER_SG !== i) { HOVER_SG = i; drawSegs(); }
        var sg = w.segs[i], sv = segSkinAt(w, i, t), cls = segClass(sv);
        var tip = $('segs-tip'), box = $('segs-box'), rb = box.getBoundingClientRect();
        tip.innerHTML = '射孔段 <b>' + sg.name + '</b>（kh=' + sg.kh.toFixed(1) + ' mD·m）<br>' +
          '产量贡献 <b>' + (sg.c * 100).toFixed(1) + '%</b> · 段表皮 <b>' + f2(sv) + '</b>（' + cls.label + '）<br>' +
          '<span style="color:#8a9298">建议：' + cls.adv + '</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 220) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 88) + 'px';
      });
      el.addEventListener('mouseleave', function () {
        HOVER_SG = -1; $('segs-tip').style.display = 'none'; drawSegs();
      });
    });
  }

  /* ---------- ③ 解读标尺 ---------- */
  function drawGauge() {
    var svg = $('gauge'), w = WELLS[S.well], inv = invert(w), ci = cursorIdx();
    var cur = inv.s[ci], lo = inv.s[ci] - inv.b[ci], hi = inv.s[ci] + inv.b[ci];
    var W = 920, H = 150, pl = 50, pr = 30, pw = W - pl - pr;
    var X0 = -2.5, X1 = 7.5;
    function x(v) { return pl + (clamp(v, X0, X1) - X0) / (X1 - X0) * pw; }
    var y0 = 62, bh = 24;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    var zones = [
      { a: -2.5, b: 0, c: '#2f7d6b', label: '完善（S<0，超裸眼）' },
      { a: 0, b: 1, c: '#41699b', label: '良好（0–1）' },
      { a: 1, b: 3, c: '#c9a15a', label: '一般（1–3）' },
      { a: 3, b: 7.5, c: '#b05a51', label: '不完善（S>3，建议措施）' }
    ];
    zones.forEach(function (z) {
      s += '<rect x="' + x(z.a) + '" y="' + y0 + '" width="' + (x(z.b) - x(z.a)) + '" height="' + bh + '" fill="' + z.c + '" opacity="0.55"/>';
      s += '<text x="' + ((x(z.a) + x(z.b)) / 2) + '" y="' + (y0 + bh / 2 + 3.5) + '" font-size="9.5" fill="#fff" text-anchor="middle" font-weight="600">' + z.label + '</text>';
    });
    for (var v = -2; v <= 7; v++) {
      s += '<line x1="' + x(v) + '" y1="' + (y0 + bh) + '" x2="' + x(v) + '" y2="' + (y0 + bh + 5) + '" stroke="#8a9298" stroke-width="1"/>';
      s += '<text x="' + x(v) + '" y="' + (y0 + bh + 16) + '" font-size="8.5" fill="#79828a" text-anchor="middle" font-family="monospace">' + v + '</text>';
    }
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">全井表皮系数 S（Earlougher 1977 解读口径）</text>';

    /* 后验区间横杠 */
    s += '<line x1="' + x(lo) + '" y1="' + (y0 - 14) + '" x2="' + x(hi) + '" y2="' + (y0 - 14) + '" stroke="#2f7d6b" stroke-width="2.4"/>';
    s += '<line x1="' + x(lo) + '" y1="' + (y0 - 19) + '" x2="' + x(lo) + '" y2="' + (y0 - 9) + '" stroke="#2f7d6b" stroke-width="2"/>';
    s += '<line x1="' + x(hi) + '" y1="' + (y0 - 19) + '" x2="' + x(hi) + '" y2="' + (y0 - 9) + '" stroke="#2f7d6b" stroke-width="2"/>';
    /* 指针 */
    var px = x(cur);
    s += '<path d="M ' + px + ' ' + (y0 - 2) + ' L ' + (px - 6) + ' ' + (y0 - 12) + ' L ' + (px + 6) + ' ' + (y0 - 12) + ' Z" fill="#2f3538"/>';
    s += '<line x1="' + px + '" y1="' + (y0 - 12) + '" x2="' + px + '" y2="' + (y0 + bh) + '" stroke="#2f3538" stroke-width="1.6"/>';
    var lx = clamp(px, pl + 66, pl + pw - 66);
    s += '<rect x="' + (lx - 62) + '" y="' + (y0 - 40) + '" width="124" height="16" rx="3" fill="#fff" stroke="#cfdfd6"/>';
    s += '<text x="' + lx + '" y="' + (y0 - 28) + '" font-size="9.5" fill="#235f51" text-anchor="middle" font-family="monospace" font-weight="600">Ŝ = ' + f2(cur) + '（第' + w.t[ci] + '天）</text>';

    svg.innerHTML = s;
  }

  /* ---------- 指标与结论 ---------- */
  function renderMetrics() {
    var w = WELLS[S.well], inv = invert(w), ci = cursorIdx(), t = w.t[ci];
    var cur = inv.s[ci], b = inv.b[ci];
    $('m-skin').innerHTML = f2(cur) + '<small>（' + w.name + '）</small>';
    $('m-skin').parentNode.className = 'mcard' + (cur > 3 ? ' bad' : (cur > 1 ? ' warn' : ''));
    $('m-band').innerHTML = '±' + b.toFixed(1) + '<small>（' + (b > 1.2 ? '宽' : '窄') + '）</small>';
    $('m-band').parentNode.className = 'mcard' + (b > 1.2 ? ' warn' : '');

    var lowSegs = [];
    w.segs.forEach(function (sg, i) {
      var sv = segSkinAt(w, i, t);
      if (sv > 3) lowSegs.push({ i: i, s: sv, name: sg.name });
    });
    lowSegs.sort(function (a, b2) { return b2.s - a.s; });
    $('m-low').textContent = lowSegs.length + ' 段';
    $('m-low').parentNode.className = 'mcard' + (lowSegs.length ? ' bad' : '');
    $('m-pri').textContent = lowSegs.length ? lowSegs[0].name + '（S=' + f1(lowSegs[0].s) + '）' : '—';
    $('m-pri').parentNode.className = 'mcard' + (lowSegs.length ? ' bad' : '');

    var v = $('verdict');
    var head = '井 <b>' + w.name + '</b>（' + w.kind + '）· 第 <b>' + t + '</b> 天：反演全井表皮 <b>' + f2(cur) + '</b>，后验区间 [' + f2(cur - b) + ', ' + f2(cur + b) + ']；';
    if (w.anchor) {
      var err = Math.abs(cur - w.tws);
      v.className = 'verdict ' + (err <= 1.5 ? 'ok' : 'warn');
      v.innerHTML = head + '试井真值 <b>' + f1(w.tws) + '</b>（第 ' + w.twDay + ' 天解释），偏差 <b>' + err.toFixed(1) + '</b>' +
        (err <= 1.5 ? '，满足 ±1.5 校准要求——锚点井用于校准先验，盲区井结论以此可信度外推。' : '，超出 ±1.5，建议提高先验校准强度 λ 或加宽平滑窗。');
    } else if (lowSegs.length) {
      v.className = cur > 3 ? 'verdict bad' : 'verdict warn';
      v.innerHTML = head + '低效射孔段 ' + lowSegs.map(function (d) { return '<b>' + d.name + '</b>(S=' + f1(d.s) + ')'; }).join('、') +
        '；建议按「表皮 × 剩余油丰度 × 作业成本」排序，<b>' + lowSegs[0].name + '</b> 列补孔优先级 P1' +
        (t > w.event.day ? '（本井已于第 ' + w.event.day + ' 天措施，回弹段建议二次补孔/解堵）' : '') + '。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '各段表皮均 ≤3，无低效段；维持现有工作制度，转入年度复查队列。';
    }
  }

  /* ---------- 绑定与渲染 ---------- */
  var OUT = {
    cursor: function (v) { return '第 ' + v + ' 天'; },
    lam: function (v) { return v.toFixed(2); },
    sm: function (v) { return v + ' 周'; }
  };
  var KEYS = ['cursor', 'lam', 'sm'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function render() {
    HOVER_K = -1; HOVER_SK = -1;
    drawProd();
    drawSkin();
    drawSegs();
    drawGauge();
    renderMetrics();
    saveState();
  }

  function bindWellBtns() {
    Array.prototype.forEach.call(document.querySelectorAll('.well-btn'), function (btn) {
      btn.addEventListener('click', function () {
        S.well = +btn.getAttribute('data-well');
        updateWellBtns();
        render();
      });
    });
    updateWellBtns();
  }
  function updateWellBtns() {
    Array.prototype.forEach.call(document.querySelectorAll('.well-btn'), function (btn) {
      btn.classList.toggle('active', +btn.getAttribute('data-well') === S.well);
    });
  }

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        if (k !== 'cursor') { drawProd(); }
        drawSkin(); drawSegs(); drawGauge(); renderMetrics(); saveState();
        if (k === 'cursor') { drawProd(); }
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      syncSliders();
      updateWellBtns();
      render();
    });
    bindProd();
    bindSkin();
  }

  loadState();
  bindWellBtns();
  bind();
  syncSliders();
  render();
})();

/* ======= 射孔效果智能评估 · 真实数据来源页 ======= */
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
    t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s;
    return t;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

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

  /* Karakas & Tariq (1991) SPE 18247-PA Table 1–3（相位系数） */
  var KT_FULL = [
    { ph: '0° (360°)', alpha: 0.250, a1: -2.091, a2: 0.0453, b1: 5.1313, b2: 1.8672, c1: '1.6×10⁻¹', c2: 2.675 },
    { ph: '180°', alpha: 0.500, a1: -2.025, a2: 0.0943, b1: 3.0373, b2: 1.8115, c1: '2.6×10⁻²', c2: 4.532 },
    { ph: '120°', alpha: 0.648, a1: -2.018, a2: 0.0634, b1: 1.6136, b2: 1.7770, c1: '6.6×10⁻³', c2: 5.320 },
    { ph: '90°', alpha: 0.726, a1: -1.905, a2: 0.1038, b1: 1.5674, b2: 1.6935, c1: '1.9×10⁻⁴', c2: 6.155 },
    { ph: '60°', alpha: 0.813, a1: -1.898, a2: 0.1023, b1: 1.3654, b2: 1.6490, c1: '3.0×10⁻⁴', c2: 7.509 },
    { ph: '45°', alpha: 0.860, a1: -1.788, a2: 0.2398, b1: 1.1915, b2: 1.6392, c1: '4.6×10⁻⁵', c2: 8.791 }
  ];

  var PL = 56, PR = 16;

  /* ① 表皮解读区间图 */
  function drawRange() {
    var svg = document.getElementById('lit-range'); if (!svg) return;
    var W = 880, H = 170, pl = 40, pr = 24, pw = W - pl - pr;
    var X0 = -8, X1 = 21;
    function xOf(v) { return pl + (v - X0) / (X1 - X0) * pw; }
    var y0 = 74, bh = 30;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);

    var zones = [
      { a: -7, b: -3, c: '#41699b', label: '水力压裂井 −7~−3' },
      { a: -3, b: 0, c: '#2f7d6b', label: '完善/酸化 <0' },
      { a: 0, b: 1, c: '#6aae9c', label: '良好' },
      { a: 1, b: 3, c: '#c9a15a', label: '一般 1–3' },
      { a: 3, b: 20, c: '#b05a51', label: '不完善 / 严重伤害 S>3' }
    ];
    zones.forEach(function (z) {
      el('rect', { x: xOf(z.a), y: y0, width: xOf(z.b) - xOf(z.a), height: bh, fill: z.c, opacity: 0.6 }, svg);
      txt((xOf(z.a) + xOf(z.b)) / 2, y0 + bh / 2 + 3.5, z.label, { 'font-size': 9.5, fill: '#fff', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
    });
    [-7, -5, -3, 0, 1, 3, 5, 10, 15, 20].forEach(function (v) {
      el('line', { x1: xOf(v), y1: y0 + bh, x2: xOf(v), y2: y0 + bh + 5, stroke: '#8a9298', 'stroke-width': 1 }, svg);
      txt(xOf(v), y0 + bh + 16, v + '', { 'font-size': 9, fill: '#79828a', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    });
    txt(pl + pw / 2, H - 6, '表皮系数 S（无量纲）· van Everdingen 1953 定义 · Earlougher 1977 解读口径', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);

    /* 本案例锚点井范围括线 */
    var ax0 = xOf(-1.8), ax1 = xOf(6.4), ay = y0 - 26;
    el('line', { x1: ax0, y1: ay, x2: ax1, y2: ay, stroke: '#c9a15a', 'stroke-width': 2.2 }, svg);
    el('line', { x1: ax0, y1: ay - 5, x2: ax0, y2: ay + 5, stroke: '#c9a15a', 'stroke-width': 2 }, svg);
    el('line', { x1: ax1, y1: ay - 5, x2: ax1, y2: ay + 5, stroke: '#c9a15a', 'stroke-width': 2 }, svg);
    txt((ax0 + ax1) / 2, ay - 9, '本案例 6 口锚点井试井解释范围 −1.8 ~ +6.4', { 'font-size': 9.5, fill: '#9a7a1c', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
    txt(pl + 2, 16, 'S 为正 = 近井伤害/射孔不完善；S 为负 = 改善（酸化/压裂）；物理下限约 −7（Earlougher 1977）', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  /* ② α_θ 柱状图 */
  function drawAlpha() {
    var svg = document.getElementById('lit-alpha'); if (!svg) return;
    var W = 880, H = 210, PT = 30, PB = 40, plotW = W - PL - PR, plotH = H - PT - PB;
    var Y1 = 1.0;
    function yOf(v) { return PT + (Y1 - v) / Y1 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var v = 0; v <= Y1; v += 0.2) {
      var y = yOf(v);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: v ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, v.toFixed(1), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);
    }
    txt(14, PT + plotH / 2, '有效井径系数 α_θ（—）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (PT + plotH / 2) + ')' }, svg);
    var bw = 84;
    KT_FULL.forEach(function (d, i) {
      var cx = PL + plotW * (i + 0.5) / KT_FULL.length;
      var y = yOf(d.alpha);
      el('rect', { 'data-idx': i, x: cx - bw / 2, y: y, width: bw, height: PT + plotH - y, rx: 3, fill: '#2f7d6b', opacity: 0.82, style: 'cursor:pointer' }, svg);
      txt(cx, y - 6, d.alpha.toFixed(3), { 'font-size': 10, fill: '#235f51', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace', 'font-weight': 600 }, svg);
      txt(cx, PT + plotH + 15, d.ph, { 'font-size': 9.5, fill: '#5d666d', 'text-anchor': 'middle' }, svg);
    });
    txt(PL + 4, 16, 'Karakas & Tariq (1991) Table 1 · α_θ 越大有效井径越大、水平表皮 S_h 越小', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function fillKtTable() {
    var body = document.getElementById('kt-body'); if (!body) return;
    KT_FULL.forEach(function (d) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + d.ph + '</td><td class="num">' + d.alpha.toFixed(3) + '</td><td class="num">' + d.a1.toFixed(3) +
        '</td><td class="num">' + d.a2.toFixed(4) + '</td><td class="num">' + d.b1.toFixed(4) + '</td><td class="num">' +
        d.b2.toFixed(4) + '</td><td class="num">' + d.c1 + '</td><td class="num">' + d.c2.toFixed(3) + '</td>';
      body.appendChild(tr);
    });
  }

  function bindAlpha() {
    var svg = document.getElementById('lit-alpha'), tip = document.getElementById('kt-tip'), box = document.getElementById('kt-box');
    if (!svg || !tip || !box) return;
    var W = 880;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var k = Math.floor((vx - PL) / (W - PL - PR) * KT_FULL.length);
      if (k >= 0 && k < KT_FULL.length) {
        var d = KT_FULL[k];
        tip.innerHTML = '相位 <b>' + d.ph + '</b><br>α_θ = <b>' + d.alpha.toFixed(3) + '</b><br>c1 = ' + d.c1 + '，c2 = ' + d.c2.toFixed(3);
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 76) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ③ Arps 递减类型曲线（canvas，HiDPI） */
  var DC_W = 880, DC_H = 210, DC_PL = 44, DC_PR = 90, DC_PT = 16, DC_PB = 30;
  function drawDecline() {
    var cv = document.getElementById('lit-decline'); if (!cv) return;
    var ctx = setupCanvas(cv, DC_W, DC_H);
    var pw = DC_W - DC_PL - DC_PR, ph = DC_H - DC_PT - DC_PB;
    var T = 3; /* 年 */
    var D = 0.6;
    function qExp(t) { return Math.exp(-D * t); }
    function qHyp(t) { return Math.pow(1 + 0.5 * D * t, -2); }
    function qHar(t) { return 1 / (1 + D * t); }
    var series = [
      { fn: qExp, c: '#2f7d6b', label: '指数 b=0' },
      { fn: qHyp, c: '#c9a15a', label: '双曲 b=0.5' },
      { fn: qHar, c: '#b05a51', label: '调和 b=1' }
    ];
    function x(t) { return DC_PL + t / T * pw; }
    function y(q) { return DC_PT + ph - q * ph; }

    ctx.clearRect(0, 0, DC_W, DC_H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, DC_W, DC_H);

    ctx.strokeStyle = '#efece1'; ctx.lineWidth = 1;
    ctx.fillStyle = '#9ba3a9'; ctx.font = '9px Consolas, monospace';
    for (var g = 0; g <= 1; g += 0.2) {
      ctx.beginPath(); ctx.moveTo(DC_PL, y(g)); ctx.lineTo(DC_PL + pw, y(g)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(g.toFixed(1), DC_PL - 5, y(g) + 3);
    }
    for (var t = 0; t <= T; t += 0.5) {
      ctx.beginPath(); ctx.moveTo(x(t), DC_PT); ctx.lineTo(x(t), DC_PT + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(t.toFixed(1), x(t), DC_PT + ph + 13);
    }
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('生产时间（年）', DC_PL + pw / 2, DC_H - 3);
    ctx.save();
    ctx.translate(13, DC_PT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('归一化产量 q / q_i（—）', 0, 0);
    ctx.restore();

    var ends = [];
    series.forEach(function (sr) {
      ctx.strokeStyle = sr.c; ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (var i = 0; i <= 120; i++) {
        var tt = i / 120 * T;
        if (i === 0) ctx.moveTo(x(tt), y(sr.fn(tt)));
        else ctx.lineTo(x(tt), y(sr.fn(tt)));
      }
      ctx.stroke();
      ends.push({ c: sr.c, label: sr.label, y: y(sr.fn(T)) });
    });
    /* 末端标注按 y 排序后强制相邻间隔 ≥12px，避免互压 */
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) {
      if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
    }
    ctx.font = '9px Consolas, monospace';
    ends.forEach(function (e) {
      ctx.fillStyle = e.c; ctx.textAlign = 'left';
      ctx.fillText(e.label, DC_PL + pw + 6, e.y + 3);
    });
    ctx.fillStyle = '#8a9298'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Arps (1945) · q = q_i/(1+b·D_i·t)^(1/b) · D_i = 0.6/年（示意）', DC_PL + 4, DC_PT + 12);
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
        if (id === 'real') drawDecline(); /* 页签显示后 clientWidth 就绪，重绘 canvas */
      });
    });
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰（防抖） */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawDecline(); }, 120);
  });

  bindTabs();
  drawRange();
  drawAlpha(); fillKtTable(); bindAlpha();
  drawDecline();
})();
