/* ======= 钻具失效预测与起钻决策 · 可运行示范（寿命预测模拟页签） ======= */
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

  /* 确定性伪随机（同一钻具多次渲染一致） */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- 5 套钻具（柴达木盆地深井区块设定） ---------- */
  var RIGS = [
    { id: 'ZJ-01', grade: 'S135', footage: 32000, dls: 3.2, ss: 0.55, wob: 9,  wall: 8, rate: 260, update: 10 },
    { id: 'ZJ-02', grade: 'G105', footage: 24000, dls: 2.4, ss: 0.35, wob: 7,  wall: 5, rate: 300, update: 9 },
    { id: 'ZJ-03', grade: 'S135', footage: 21000, dls: 1.8, ss: 0.25, wob: 5,  wall: 3, rate: 320, update: 8 },
    { id: 'ZJ-04', grade: 'G105', footage: 16000, dls: 1.2, ss: 0.15, wob: 4,  wall: 2, rate: 350, update: 7 },
    { id: 'ZJ-05', grade: 'S135', footage: 12000, dls: 0.8, ss: 0.10, wob: 3,  wall: 1, rate: 380, update: 6 }
  ];
  var ETA0 = { 'S135': 44000, 'G105': 40000 };   /* 温和工况特征寿命进尺 (m) */

  var S = { rig: 1, footage: 24000, dls: 2.4, ss: 0.35, wob: 7, wall: 5, rate: 300, update: 9 };

  /* ---------- 损伤模型：Miner 线性累积（Weibull 口径） + LSTM 残差 ---------- */
  function ampHybrid() {
    return (1 + 0.09 * S.dls) * (1 + 0.28 * S.ss) * (1 + 0.008 * S.wob) / (1 - 0.9 * S.wall / 100);
  }
  function ampTheory() { return 1 + 0.09 * S.dls; }   /* 纯机理：仅狗腿度放大 */
  function etaHybrid() { return ETA0[RIGS[S.rig].grade] / ampHybrid(); }
  function etaTheory() { return ETA0[RIGS[S.rig].grade] / ampTheory(); }
  function dmg(x, eta) { return Math.pow(Math.max(0, x) / eta, 1.9); }

  function rulNow() { return Math.max(0, etaHybrid() - S.footage); }
  function daysNow() { return rulNow() / S.rate; }
  /* 90% 区间半宽：随已更新批次收窄，上限收窄 78% */
  function halfWidth(k) {
    var eta = etaHybrid();
    var rul0 = Math.max(0, eta - (S.footage - S.update * 7 * S.rate));
    var w0 = clamp(0.32 * rul0 + 1200, 1500, 9000);
    return w0 * (1 - 0.78 * Math.min(k, S.update) / 12);
  }
  function levelOf(days) {
    if (days < 7) return { t: '建议起钻', c: '#b05a51', cls: 'bad' };
    if (days <= 14) return { t: '关注', c: '#c9a15a', cls: 'warn' };
    return { t: '正常', c: '#2f7d6b', cls: '' };
  }

  /* 历史失效事件（3 年 46 口井 fleet 统计，独立于当前钻具参数） */
  var WASHOUT = [   /* 刺漏 15 起：x=累计进尺 m，y=损伤 D */
    [8600, 0.74], [10200, 0.78], [11800, 0.71], [13500, 0.83], [15100, 0.76],
    [16900, 0.80], [18700, 0.85], [20500, 0.78], [22400, 0.88], [24300, 0.82],
    [26100, 0.86], [27900, 0.79], [29800, 0.90], [31500, 0.84], [33400, 0.91]
  ];
  var TWISTOFF = [  /* 断裂 8 起：5 起早于 2.5 万 m 强制线，3 起在强制线后 */
    [13600], [16200], [18900], [21300], [23700], [26600], [29700], [33200]
  ];

  /* ---------- ① 累积损伤曲线 ---------- */
  var DG = { W: 470, H: 256, PL: 44, PR: 14, PT: 26, PB: 32, XMAX: 40000, YMAX: 1.2 };
  var dmgGeom = null;

  function drawDmg() {
    var svg = $('c-dmg');
    var W = DG.W, H = DG.H, PL = DG.PL, PR = DG.PR, PT = DG.PT, PB = DG.PB, XMAX = DG.XMAX, YMAX = DG.YMAX;
    var pw = W - PL - PR, ph = H - PT - PB;
    var eta = etaHybrid(), etaT = etaTheory();
    function x(m) { return PL + m / XMAX * pw; }
    function y(d) { return PT + ph - d / YMAX * ph; }
    dmgGeom = { PL: PL, pw: pw, PT: PT, ph: ph };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格 + 左轴（损伤 D） */
    [0, 0.3, 0.6, 0.9, 1.2].forEach(function (g) {
      var yy = y(g);
      s += '<line x1="' + PL + '" y1="' + yy.toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + yy.toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yy + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + g.toFixed(1) + '</text>';
    });
    /* x 轴（万 m） */
    for (var m = 0; m <= XMAX; m += 5000) {
      s += '<line x1="' + x(m).toFixed(1) + '" y1="' + PT + '" x2="' + x(m).toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(m).toFixed(1) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + (m / 10000).toFixed(1) + '</text>';
    }

    /* D=1 失效阈值线 */
    var y1 = y(1.0);
    s += '<line x1="' + PL + '" y1="' + y1.toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + y1.toFixed(1) + '" stroke="#b05a51" stroke-width="1.3" stroke-dasharray="5 3"/>';
    s += '<text x="' + (PL + 4) + '" y="' + (y1 - 4).toFixed(1) + '" font-size="8.5" fill="#b05a51" font-family="monospace" font-weight="600">失效阈值 D = 1</text>';

    /* 强制起钻线 2.5 万 m（标签放图内底部线左侧，避开 x 轴刻度行） */
    var xF = x(25000);
    s += '<line x1="' + xF.toFixed(1) + '" y1="' + PT + '" x2="' + xF.toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#c9a15a" stroke-width="1.4" stroke-dasharray="6 3"/>';
    s += '<text x="' + (xF - 6).toFixed(1) + '" y="' + (PT + ph - 8) + '" font-size="8.5" fill="#9a7a1c" text-anchor="end" font-family="monospace" font-weight="600">强制起钻 2.5 万 m</text>';

    /* 历史失效事件（先画点，曲线在上层） */
    WASHOUT.forEach(function (p, i) {
      var cy = y(p[1]);
      s += '<circle cx="' + x(p[0]).toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3" fill="#c9a15a" stroke="#fff" stroke-width="1" opacity="0.85"/>';
      if (i === 0) s += '<text x="' + (x(p[0]) - 2).toFixed(1) + '" y="' + (cy - 7).toFixed(1) + '" font-size="8" fill="#9a7a1c">刺漏×15</text>';
    });
    TWISTOFF.forEach(function (p, i) {
      var cx = x(p[0]), cy = y(1.0);
      var d = 'M' + cx.toFixed(1) + ' ' + (cy - 4.5).toFixed(1) + ' L' + (cx + 4).toFixed(1) + ' ' + cy.toFixed(1) +
        ' L' + cx.toFixed(1) + ' ' + (cy + 4.5).toFixed(1) + ' L' + (cx - 4).toFixed(1) + ' ' + cy.toFixed(1) + ' Z';
      s += '<path d="' + d + '" fill="#b05a51" stroke="#fff" stroke-width="1" opacity="0.9"/>';
      if (i === 2) s += '<text x="' + (cx + 6).toFixed(1) + '" y="' + (cy - 7).toFixed(1) + '" font-size="8" fill="#b05a51">断裂×8（5 起在强制线前）</text>';
    });

    /* 纯机理曲线（绿虚线） */
    var line = '';
    for (var i = 0; i <= 160; i++) {
      var xm = i / 160 * XMAX;
      line += (i ? 'L' : 'M') + x(xm).toFixed(1) + ' ' + y(dmg(xm, etaT)).toFixed(1) + ' ';
    }
    s += '<path d="' + line + '" fill="none" stroke="#2f7d6b" stroke-width="1.4" stroke-dasharray="5 3" opacity="0.85"/>';

    /* 混合模型曲线（蓝实线） */
    line = '';
    for (i = 0; i <= 160; i++) {
      xm = i / 160 * XMAX;
      line += (i ? 'L' : 'M') + x(xm).toFixed(1) + ' ' + y(dmg(xm, eta)).toFixed(1) + ' ';
    }
    s += '<path d="' + line + '" fill="none" stroke="#41699b" stroke-width="2.2"/>';

    /* 残差标注（两曲线在 0.8·XMAX 处的差距） */
    var xmA = 0.8 * XMAX;
    var yA = y(dmg(xmA, etaT)), yB = y(dmg(xmA, eta));
    if (Math.abs(yA - yB) > 8) {
      s += '<line x1="' + x(xmA).toFixed(1) + '" y1="' + yA.toFixed(1) + '" x2="' + x(xmA).toFixed(1) + '" y2="' + yB.toFixed(1) + '" stroke="#79828a" stroke-width="0.9" stroke-dasharray="2 2"/>';
      s += '<text x="' + (x(xmA) + 4).toFixed(1) + '" y="' + ((yA + yB) / 2 + 3).toFixed(1) + '" font-size="8" fill="#79828a">LSTM 残差</text>';
    }

    /* 当前点高亮 */
    var cf = clamp(S.footage, 0, XMAX);
    var cd = dmg(cf, eta);
    var cxd = x(cf), cyd = y(cd);
    s += '<line x1="' + cxd.toFixed(1) + '" y1="' + PT + '" x2="' + cxd.toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#41699b" stroke-width="1" stroke-dasharray="3 2" opacity="0.6"/>';
    s += '<circle cx="' + cxd.toFixed(1) + '" cy="' + cyd.toFixed(1) + '" r="5.5" fill="#41699b" stroke="#fff" stroke-width="1.6"/>';
    var nearR = cxd > PL + pw - 118;
    s += '<text x="' + (nearR ? cxd - 9 : cxd + 9).toFixed(1) + '" y="' + (cyd - 9).toFixed(1) + '" font-size="9" fill="#41699b" text-anchor="' + (nearR ? 'end' : 'start') + '" font-family="monospace" font-weight="600">当前 ' + (S.footage / 10000).toFixed(2) + ' 万 m · D=' + cd.toFixed(2) + '</text>';

    /* 轴标题 */
    s += '<text x="' + (PL - 32) + '" y="' + (PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 32) + ' ' + (PT + ph / 2) + ')">Miner 累积损伤 D</text>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">累计进尺（万 m）</text>';

    s += '<g id="dmg-hov" style="display:none"></g>';
    s += '<rect id="dmg-cap" x="' + PL + '" y="' + PT + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
    svg.innerHTML = s;
  }

  function bindDmgHover() {
    var svg = $('c-dmg'), tip = $('t-dmg'), box = $('box-dmg');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      if (!dmgGeom) return;
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (DG.W / r.width);
      var m = clamp((vx - dmgGeom.PL) / dmgGeom.pw, 0, 1) * DG.XMAX;
      var dH = dmg(m, etaHybrid()), dT = dmg(m, etaTheory());
      var hov = document.getElementById('dmg-hov');
      if (hov) {
        var gx = dmgGeom.PL + m / DG.XMAX * dmgGeom.pw;
        var gy = dmgGeom.PT + dmgGeom.ph - dH / DG.YMAX * dmgGeom.ph;
        hov.setAttribute('style', 'display:block');
        hov.innerHTML = '<line x1="' + gx.toFixed(1) + '" y1="' + dmgGeom.PT + '" x2="' + gx.toFixed(1) + '" y2="' + (dmgGeom.PT + dmgGeom.ph) + '" stroke="#79828a" stroke-width="0.8" stroke-dasharray="2 2"/>' +
          '<circle cx="' + gx.toFixed(1) + '" cy="' + gy.toFixed(1) + '" r="3.5" fill="#41699b" stroke="#fff" stroke-width="1"/>';
      }
      tip.innerHTML = '<b>累计进尺 ' + (m / 10000).toFixed(2) + ' 万 m</b><br>混合模型 D = <b>' + dH.toFixed(3) + '</b> · 纯机理 D = <b>' + dT.toFixed(3) + '</b><br>' +
        (dH < 1 ? '剩余进尺 ≈ <b>' + Math.round(Math.max(0, etaHybrid() - m)) + ' m</b>（约 ' + (Math.max(0, etaHybrid() - m) / S.rate).toFixed(1) + ' 天）'
                : '<span style="color:#b05a51">已越过失效阈值</span>');
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 205) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 84) + 'px';
    });
    svg.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      var hov = document.getElementById('dmg-hov');
      if (hov) hov.setAttribute('style', 'display:none');
    });
  }

  /* ---------- ② 剩余进尺（RUL）预测带 ---------- */
  var RG = { W: 470, H: 256, PL: 46, PR: 44, PT: 20, PB: 30, KMAX: 12 };
  var rulGeom = null;

  function rulAt(k) {
    var footageK = S.footage - (S.update - k) * 7 * S.rate;
    return Math.max(0, etaHybrid() - footageK);
  }

  function drawRul() {
    var svg = $('c-rul');
    var W = RG.W, H = RG.H, PL = RG.PL, PR = RG.PR, PT = RG.PT, PB = RG.PB, KMAX = RG.KMAX;
    var pw = W - PL - PR, ph = H - PT - PB;
    var f7 = 7 * S.rate, f14 = 14 * S.rate;
    var yMax = Math.max(rulAt(0) + halfWidth(0), f14 * 1.3, 4000) * 1.1;
    function x(k) { return PL + k / KMAX * pw; }
    function y(m) { return PT + ph - m / yMax * ph; }
    rulGeom = { PL: PL, pw: pw, PT: PT, ph: ph, yMax: yMax };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 三级预警阈值带（按剩余天数折算进尺） */
    s += '<rect x="' + PL + '" y="' + y(f14).toFixed(1) + '" width="' + pw + '" height="' + (PT + ph - y(f14)).toFixed(1) + '" fill="#2f7d6b" opacity="0.07"/>';
    s += '<rect x="' + PL + '" y="' + y(f7).toFixed(1) + '" width="' + pw + '" height="' + (y(f14) - y(f7)).toFixed(1) + '" fill="#c9a15a" opacity="0.13"/>';
    s += '<rect x="' + PL + '" y="' + y(0).toFixed(1) + '" width="' + pw + '" height="' + (y(f7) - y(0)).toFixed(1) + '" fill="#b05a51" opacity="0.12"/>';
    /* 阈值带标签放右缘外侧（PR 留白），避免与区间带重叠 */
    s += '<text x="' + (PL + pw + 5) + '" y="' + (y((f14 + yMax) / 2)).toFixed(1) + '" font-size="8" fill="#2f7d6b">&gt;14 天</text>';
    s += '<text x="' + (PL + pw + 5) + '" y="' + (y((f7 + f14) / 2) + 3).toFixed(1) + '" font-size="8" fill="#9a7a1c">7–14 天</text>';
    s += '<text x="' + (PL + pw + 5) + '" y="' + (y(f7 / 2) + 3).toFixed(1) + '" font-size="8" fill="#b05a51">&lt;7 天</text>';

    /* 网格 + 左轴 */
    var step = yMax > 20000 ? 5000 : yMax > 8000 ? 2000 : 1000;
    for (var g = 0; g <= yMax; g += step) {
      var yy = y(g);
      s += '<line x1="' + PL + '" y1="' + yy.toFixed(1) + '" x2="' + (PL + pw) + '" y2="' + yy.toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yy + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + (g >= 1000 ? (g / 1000).toFixed(0) + 'k' : g) + '</text>';
    }
    /* x 轴（更新批次） */
    for (var k = 0; k <= KMAX; k += 2) {
      s += '<line x1="' + x(k).toFixed(1) + '" y1="' + PT + '" x2="' + x(k).toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(k).toFixed(1) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + k + '</text>';
    }

    /* 90% 区间带：已更新段（实色） + 未更新投影段（灰色虚线边） */
    var up = S.update;
    var band = '', lo = '';
    for (k = 0; k <= up; k++) band += (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(rulAt(k) + halfWidth(k)).toFixed(1) + ' ';
    for (k = up; k >= 0; k--) band += 'L' + x(k).toFixed(1) + ' ' + y(Math.max(0, rulAt(k) - halfWidth(k))).toFixed(1) + ' ';
    s += '<path d="' + band + ' Z" fill="#41699b" opacity="0.13"/>';
    if (up < KMAX) {
      var band2 = '';
      for (k = up; k <= KMAX; k++) band2 += (k === up ? 'M' : 'L') + x(k).toFixed(1) + ' ' + y(rulAt(k) + halfWidth(up)).toFixed(1) + ' ';
      for (k = KMAX; k >= up; k--) band2 += 'L' + x(k).toFixed(1) + ' ' + y(Math.max(0, rulAt(k) - halfWidth(up))).toFixed(1) + ' ';
      s += '<path d="' + band2 + ' Z" fill="#79828a" opacity="0.10"/>';
    }

    /* 中值线：已更新段实线，投影段虚线 */
    var mid1 = '', mid2 = '';
    for (k = 0; k <= up; k++) mid1 += (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(rulAt(k)).toFixed(1) + ' ';
    for (k = up; k <= KMAX; k++) mid2 += (k === up ? 'M' : 'L') + x(k).toFixed(1) + ' ' + y(rulAt(k)).toFixed(1) + ' ';
    s += '<path d="' + mid1 + '" fill="none" stroke="#41699b" stroke-width="2.2"/>';
    if (up < KMAX) s += '<path d="' + mid2 + '" fill="none" stroke="#79828a" stroke-width="1.4" stroke-dasharray="4 3"/>';

    /* 当前批次（今天） */
    var cu = x(up), cyu = y(rulAt(up));
    s += '<line x1="' + cu.toFixed(1) + '" y1="' + PT + '" x2="' + cu.toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#41699b" stroke-width="1" stroke-dasharray="3 2" opacity="0.6"/>';
    s += '<circle cx="' + cu.toFixed(1) + '" cy="' + cyu.toFixed(1) + '" r="5.5" fill="#41699b" stroke="#fff" stroke-width="1.6"/>';
    var lv = levelOf(daysNow());
    var nearR2 = cu > PL + pw - 128;
    s += '<text x="' + (nearR2 ? cu - 9 : cu + 9).toFixed(1) + '" y="' + (cyu - 9).toFixed(1) + '" font-size="9" fill="' + lv.c + '" text-anchor="' + (nearR2 ? 'end' : 'start') + '" font-family="monospace" font-weight="600">今天：剩余 ' + Math.round(rulNow()) + ' m（' + daysNow().toFixed(1) + ' 天）</text>';

    /* 轴标题 */
    s += '<text x="' + (PL - 34) + '" y="' + (PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 34) + ' ' + (PT + ph / 2) + ')">剩余可用进尺 (m)</text>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">数据更新批次（每批 = 7 天新振动/探伤数据）</text>';

    s += '<g id="rul-hov" style="display:none"></g>';
    s += '<rect id="rul-cap" x="' + PL + '" y="' + PT + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
    svg.innerHTML = s;
  }

  function bindRulHover() {
    var svg = $('c-rul'), tip = $('t-rul'), box = $('box-rul');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      if (!rulGeom) return;
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (RG.W / r.width);
      var k = clamp(Math.round((vx - rulGeom.PL) / rulGeom.pw * RG.KMAX), 0, RG.KMAX);
      var med = rulAt(k), hw = halfWidth(k);
      var hov = document.getElementById('rul-hov');
      if (hov) {
        var gx = rulGeom.PL + k / RG.KMAX * rulGeom.pw;
        var gy = rulGeom.PT + rulGeom.ph - med / rulGeom.yMax * rulGeom.ph;
        hov.setAttribute('style', 'display:block');
        hov.innerHTML = '<line x1="' + gx.toFixed(1) + '" y1="' + rulGeom.PT + '" x2="' + gx.toFixed(1) + '" y2="' + (rulGeom.PT + rulGeom.ph) + '" stroke="#79828a" stroke-width="0.8" stroke-dasharray="2 2"/>' +
          '<circle cx="' + gx.toFixed(1) + '" cy="' + gy.toFixed(1) + '" r="3.5" fill="#41699b" stroke="#fff" stroke-width="1"/>';
      }
      tip.innerHTML = '<b>第 ' + k + ' 批</b>' + (k <= S.update ? '（已更新）' : '（未更新投影）') +
        '<br>剩余进尺中值 <b>' + Math.round(med) + ' m</b><br>90% 区间 <b>' + Math.round(Math.max(0, med - hw)) + ' – ' + Math.round(med + hw) + ' m</b><br>半宽 ±' + Math.round(hw) + ' m（随更新收窄）';
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 92) + 'px';
    });
    svg.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      var hov = document.getElementById('rul-hov');
      if (hov) hov.setAttribute('style', 'display:none');
    });
  }

  /* ---------- ③ 振动/扭矩特征时序（canvas · HiDPI） ---------- */
  var FG = { W: 470, H: 212, PL: 40, PR: 40, PT: 16, PB: 26, N: 150, VMAX: 6 };
  var featData = null;

  function genFeat() {
    var rnd = mulberry32(20261101 + S.rig * 733);
    var driftStart = 92 + (S.rig * 11) % 28;
    featData = { raw: [], rms: [], ss: [], driftStart: driftStart };
    var base = 1.4 + 0.28 * S.dls + 0.35 * S.wob / 15;
    for (var k = 0; k < FG.N; k++) {
      var inDrift = k >= driftStart && k < driftStart + 24;
      var ramp = inDrift ? 1 + 1.3 * Math.sin(Math.PI * (k - driftStart) / 24) : 1;
      var rms = base * ramp * (1 + 0.18 * (rnd() - 0.5));
      var ss = clamp(S.ss * (1 + 0.3 * (rnd() - 0.5)) + (inDrift ? 0.28 * Math.sin(Math.PI * (k - driftStart) / 24) : 0), 0, 1);
      featData.rms.push(rms);
      featData.ss.push(ss);
      /* 每段 3 个原始包络采样点，呈现 50 Hz 粗糙感 */
      for (var j = 0; j < 3; j++) featData.raw.push(rms * (0.55 + 1.1 * rnd()));
    }
  }

  function drawFeat() {
    var cv = $('c-feat');
    if (!cv) return;
    var W = FG.W, H = FG.H, PL = FG.PL, PR = FG.PR, PT = FG.PT, PB = FG.PB, N = FG.N, VMAX = FG.VMAX;
    var pw = W - PL - PR, ph = H - PT - PB;
    var ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);
    function x(k) { return PL + k / (N - 1) * pw; }
    function yV(v) { return PT + ph - v / VMAX * ph; }
    function yS(v) { return PT + ph - v * ph; }

    /* 网格 + 左轴（振动 g） */
    ctx.font = '8.5px Consolas, monospace';
    [0, 1.5, 3, 4.5, 6].forEach(function (g) {
      ctx.strokeStyle = '#efece1'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL, yV(g)); ctx.lineTo(PL + pw, yV(g)); ctx.stroke();
      ctx.fillStyle = '#7b93b5'; ctx.textAlign = 'right';
      ctx.fillText(g.toFixed(1), PL - 5, yV(g) + 3);
    });
    /* 右轴（粘滑指数） */
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      ctx.fillStyle = '#b39b66'; ctx.textAlign = 'left';
      ctx.fillText(v.toFixed(2), PL + pw + 5, yS(v) + 3);
    });
    /* x 轴（段号，每段 10 m） */
    for (var k = 0; k < N; k += 30) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x(k), PT); ctx.lineTo(x(k), PT + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(k + '', x(k), PT + ph + 12);
    }

    /* 特征漂移段着色 */
    var d0 = featData.driftStart, d1 = Math.min(N - 1, d0 + 24);
    ctx.fillStyle = 'rgba(176,90,81,0.08)';
    ctx.fillRect(x(d0), PT, x(d1) - x(d0), ph);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'center';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('特征漂移段', (x(d0) + x(d1)) / 2, PT + 9);

    /* 原始包络（灰） */
    ctx.strokeStyle = '#9ba3a9'; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (var i = 0; i < featData.raw.length; i++) {
      var px = PL + i / (featData.raw.length - 1) * pw;
      var py = yV(featData.raw[i]);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* 粘滑指数（金，右轴） */
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (k = 0; k < N; k++) {
      if (k) ctx.lineTo(x(k), yS(featData.ss[k])); else ctx.moveTo(x(k), yS(featData.ss[k]));
    }
    ctx.stroke();

    /* 横向振动 RMS（蓝，左轴） */
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (k = 0; k < N; k++) {
      if (k) ctx.lineTo(x(k), yV(featData.rms[k])); else ctx.moveTo(x(k), yV(featData.rms[k]));
    }
    ctx.stroke();

    /* 轴标题 */
    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('井段序号（每段 10 m，近 1500 m）', PL + pw / 2, H - 3);
    ctx.save(); ctx.translate(9, PT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('横向振动 RMS (g)', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(W - 3, PT + ph / 2); ctx.rotate(Math.PI / 2);
    ctx.fillText('粘滑指数', 0, 0); ctx.restore();
  }

  function bindFeatHover() {
    var cv = $('c-feat'), tip = $('t-feat'), box = $('box-feat');
    if (!cv || !tip || !box) return;
    cv.addEventListener('mousemove', function (evt) {
      if (!featData) return;
      var r = cv.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (FG.W / r.width);
      var k = clamp(Math.round((vx - FG.PL) / (FG.W - FG.PL - FG.PR) * (FG.N - 1)), 0, FG.N - 1);
      var inDrift = k >= featData.driftStart && k < featData.driftStart + 24;
      tip.innerHTML = '<b>第 ' + k + ' 段</b>（10 m 段）' + (inDrift ? ' <span style="color:#b05a51">漂移段</span>' : '') +
        '<br>横向振动 RMS <b>' + featData.rms[k].toFixed(2) + ' g</b><br>粘滑指数 <b>' + featData.ss[k].toFixed(2) + '</b>' +
        '<br><span style="color:#8a9298">雨流计数输入 → Miner 损伤累积</span>';
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 88) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- ④ 指标卡 + 起钻建议 ---------- */
  function renderMetrics() {
    var eta = etaHybrid();
    var d = dmg(S.footage, eta);
    var rul = rulNow(), days = daysNow();
    var hw = halfWidth(S.update);
    var lv = levelOf(days);

    $('m-d').innerHTML = d.toFixed(3);
    $('m-d').parentNode.className = 'mcard' + (d >= 0.9 ? ' bad' : d >= 0.7 ? ' warn' : '');

    $('m-rul').innerHTML = Math.round(rul) + '<small> m</small>';
    $('m-rul').parentNode.className = 'mcard' + (days < 7 ? ' bad' : days <= 14 ? ' warn' : '');

    $('m-ci').innerHTML = Math.round(Math.max(0, rul - hw)) + '–' + Math.round(rul + hw) + '<small> m</small>';

    $('m-days').innerHTML = days.toFixed(1) + '<small> 天</small>';
    $('m-days').parentNode.className = 'mcard' + (days < 7 ? ' bad' : days <= 14 ? ' warn' : '');

    $('m-level').textContent = lv.t;
    $('m-level').parentNode.className = 'mcard' + (lv.cls ? ' ' + lv.cls : '');

    /* 决策建议：与 2.5 万 m 强制规则对照 */
    var v = $('verdict');
    var ruleTrip = S.footage >= 25000;
    var head = '当前钻具 <b>' + RIGS[S.rig].id + '</b>（' + RIGS[S.rig].grade + ' 钢级）· 损伤 D = <b>' + d.toFixed(3) + '</b> · 剩余 <b>' + Math.round(rul) + '</b> m（约 <b>' + days.toFixed(1) + '</b> 天）；';
    if (ruleTrip && d < 0.55) {
      v.className = 'verdict warn';
      v.innerHTML = head + '已越 2.5 万 m 强制线但损伤尚低，模型判定可继续钻进 <b>' + Math.round(rul) + '</b> m 再探伤——历史上 <b>60%</b>（89/148 次）强制起钻探伤未见超标，属此类「白查」，单次省 8–12 万元。';
    } else if (ruleTrip && d < 0.9) {
      v.className = 'verdict warn';
      v.innerHTML = head + '已过强制起钻线且损伤进入 0.55–0.9 区间：建议本井打完即起钻探伤，勿再带伤打新井。';
    } else if (ruleTrip) {
      v.className = 'verdict bad';
      v.innerHTML = head + '已过强制起钻线且损伤 D ≥ 0.9：<b>立即起钻探伤</b>，按剩余 ' + days.toFixed(1) + ' 天计已不足 7 天预警窗口。';
    } else if (d >= 0.85 || days < 7) {
      v.className = 'verdict bad';
      v.innerHTML = head + '未到强制线但模型判定高危（剩余 &lt;7 天）：建议<b>提前起钻</b>——历史上 8 起断裂有 <b>5 起发生在强制线之前</b>，单次断裂打捞 5–8 天、损失 40–120 万元。';
    } else if (d >= 0.7 || days <= 14) {
      v.className = 'verdict warn';
      v.innerHTML = head + '进入 7–14 天关注窗口：加密振动监测，把起钻计划纳入本周排产，定位到具体单根与井深段。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '剩余寿命充裕（&gt;14 天），按日滚动更新损伤曲线即可，无需提前起钻。';
    }
  }

  /* ---------- 渲染与绑定 ---------- */
  function render() {
    drawDmg();
    drawRul();
    genFeat();
    drawFeat();
    renderMetrics();
  }

  var OUT = {
    footage: function (v) { return v + ' m'; },
    dls: function (v) { return v.toFixed(1) + ' °/30m'; },
    ss: function (v) { return v.toFixed(2); },
    wob: function (v) { return v.toFixed(1) + ' %'; },
    wall: function (v) { return v.toFixed(1) + ' %'; },
    rate: function (v) { return v + ' m/d'; },
    update: function (v) { return v + ' 批'; }
  };
  var KEYS = ['footage', 'dls', 'ss', 'wob', 'wall', 'rate', 'update'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function buildRigBtns() {
    var box = $('rig-btns');
    box.innerHTML = '';
    RIGS.forEach(function (r, i) {
      var b = document.createElement('button');
      b.className = 'rig-btn' + (i === S.rig ? ' active' : '');
      b.textContent = r.id;
      b.title = r.grade + ' 钢级 · 累计进尺 ' + (r.footage / 10000).toFixed(1) + ' 万 m';
      b.addEventListener('click', function () {
        S.rig = i;
        S.footage = r.footage; S.dls = r.dls; S.ss = r.ss; S.wob = r.wob;
        S.wall = r.wall; S.rate = r.rate; S.update = r.update;
        syncSliders();
        buildRigBtns();
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
      var r = RIGS[S.rig];
      S.footage = r.footage; S.dls = r.dls; S.ss = r.ss; S.wob = r.wob;
      S.wall = r.wall; S.rate = r.rate; S.update = r.update;
      syncSliders();
      render();
    });
  }

  bind();
  buildRigBtns();
  syncSliders();
  render();
  bindDmgHover();
  bindRulHover();
  bindFeatHover();

  /* 尺寸变化时重建 canvas backing store（防抖），SVG 随布局自适应 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawFeat(); }, 120);
  });
})();

/* ======= 真实数据来源页签（公开标准 / 文献 / 官方资料） ======= */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- ① 来源汇总表（Web 检索整理，可点击溯源） ---------- */
  var SRC = [
    { src: 'Miner, M.A. (1945), "Cumulative Damage in Fatigue", J. Appl. Mech. 12(3): A159–A164', type: '疲劳累积准则', key: 'Miner 线性累积损伤准则原始文献：D = Σnᵢ/Nᵢ，D≥1 判失效；DOI 10.1115/1.4009458', url: 'https://doi.org/10.1115/1.4009458', tag: 'DOI↗' },
    { src: 'Palmgren, A. (1924), "Die Lebensdauer von Kugellagern", VDI-Z. 68(14): 339–341', type: '疲劳累积准则', key: '线性准则最早由 Palmgren 为轴承寿命提出，Miner 于 1945 年数学化（Palmgren-Miner 法则）', url: 'https://www.quadco.engineering/en/know-how/an-overview-of-the-palmgren-miner-rule.htm', tag: '综述↗' },
    { src: 'ASTM E1049-85(2017)《Standard Practices for Cycle Counting in Fatigue Analysis》', type: '计数标准', key: '雨流计数 / 幅对计数等变幅循环计数标准实践；适用于力、应力、应变、扭矩、加速度时程', url: 'https://www.astm.org/standards/e1049', tag: '标准页↗' },
    { src: 'API Spec 5DP《钻杆规范》', type: '钻杆标准', key: '钢级分 Group 1（E-75，浅中深井）与 Group 3（X-95 / G-105 / S-135，深井大扭矩）；管体调质处理', url: 'https://www.eastern-steels.com/attached/file/20261026/20261026155512881288.pdf', tag: '标准手册↗' },
    { src: 'API RP 7G-2《旧钻杆检验与分级推荐作法》', type: '分级标准', key: 'Premium 级管体最小壁厚 ≥ 新杆名义壁厚 80%，Class 2 ≥ 70%；探伤测壁厚按此降级', url: 'https://drillpipe.com/wp-content/uploads/2025/05/500IEUx1950ppfxTSC95RBW_6250x3625xPTech50_R3.pdf', tag: '数据表↗' },
    { src: 'Lubinski, A. (1961), "Maximum Permissible Dog-Legs in Rotary Boreholes", JPT, SPE-73-PA', type: '弯曲应力奠基', key: '旋转钻杆在狗腿中的交变弯曲应力经典解，狗腿度疲劳评估的理论源头；DOI 10.2118/73-PA', url: 'https://doi.org/10.2118/73-PA', tag: 'DOI↗' },
    { src: 'Raap, Craig & Graham (2011), SPE-145910-MS（Denney 2012 JPT 摘要）', type: '井下实测', key: '井下动态记录仪（DDR）实测：3 起钻杆失效均位于 4°/30 m 浅层大狗腿处；DOI 10.2118/0212-0051-JPT', url: 'https://doi.org/10.2118/0212-0051-JPT', tag: 'DOI↗' },
    { src: 'JPT《A Holistic Approach To Controlling Torsional Dynamics in the Drillstring》', type: '行业统计', key: '引用 SPE 127413 / SPE 98150 统计：20–30% 井下失效与不良钻井动力学（粘滑/振动）相关', url: 'https://jpt.spe.org/holistic-approach-controlling-torsional-dynamics-drillstring', tag: 'JPT↗' },
    { src: '《深井超深井大尺寸井眼钻具疲劳失效分析与防控》（维普收录）', type: '失效实证', key: '深井超深井钻具失效（断钻具、刺漏）逐年递增；横向振动诱发高频弯曲应力是疲劳失效主因', url: 'https://qikan.cqvip.com/Qikan/Article/Detail?id=7112395946', tag: '摘要↗' },
    { src: '《φ139.7 mm×10.54 mm G105 钻杆刺穿失效分析》理化检验-物理分册', type: '失效实证', key: 'G105 钻杆刺穿本质为早期疲劳失效：跳钻等振动交变应力 + 泥浆溶解氧点蚀加速裂纹萌生', url: 'https://lhjywlfc.mat-test.com/cn/article/pdf/preview/72637d73-f032-4696-bb25-e4c85a776e9c.pdf', tag: '原文↗' },
    { src: '《S135 钻杆失效分析》理化检验-物理分册', type: '失效实证', key: 'S135 钻杆失效性质为腐蚀疲劳：氯离子点蚀 → 应力下成裂纹 → 腐蚀疲劳断裂', url: 'https://lhjywlfc.mat-test.com/cn/article/pdf/preview/6ac860cd-adb6-44be-b1f4-3ffb3f3b0015.pdf', tag: '原文↗' },
    { src: 'Weibull, W. (1951), J. Appl. Mech. 18(3): 293–297', type: '生存分析', key: 'Weibull 分布原始文献，右删失寿命数据建模基础（Weibull AFT）；DOI 10.1115/1.4010337', url: 'https://doi.org/10.1115/1.4010337', tag: 'DOI↗' },
    { src: 'Hochreiter & Schmidhuber (1997), Neural Comput. 9(8): 1735–1780', type: '深度模型', key: 'LSTM 原始文献，本案例残差学习网络；DOI 10.1162/neco.1997.9.8.1735', url: 'https://doi.org/10.1162/neco.1997.9.8.1735', tag: 'DOI↗' },
    { src: 'Saxena et al. (2008), NASA C-MAPSS 涡扇退化数据集（PHM08 挑战赛）', type: 'RUL 基准', key: 'RUL 预测领域公认基准数据集，多元时序 run-to-failure；NASA Ames PCOE 数据仓库公开', url: 'https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/', tag: 'NASA↗' }
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

  /* ---------- ② API 5DP 钢级最小屈服强度 ---------- */
  var GRADES = [
    { g: 'E-75',  ksi: 75,  mpa: 517, grp: 'Group 1 · 浅中深井', mine: false },
    { g: 'X-95',  ksi: 95,  mpa: 655, grp: 'Group 3 · 高强度', mine: false },
    { g: 'G-105', ksi: 105, mpa: 724, grp: 'Group 3 · 本案例用钢', mine: true },
    { g: 'S-135', ksi: 135, mpa: 931, grp: 'Group 3 · 本案例用钢', mine: true }
  ];

  function drawGrade() {
    var svg = $('c-grade');
    if (!svg) return;
    var W = 470, H = 232, PL = 46, PR = 20, PT = 26, PB = 40;
    var pw = W - PL - PR, ph = H - PT - PB;
    var Y1 = 1000;
    function y(v) { return PT + ph - v / Y1 * ph; }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    for (var v = 0; v <= Y1; v += 200) {
      s += '<line x1="' + PL + '" y1="' + y(v) + '" x2="' + (PL + pw) + '" y2="' + y(v) + '" stroke="' + (v ? '#efece1' : '#d8d0bc') + '"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    }

    var bw = 56;
    GRADES.forEach(function (d, i) {
      var cx = PL + pw * (i + 0.5) / GRADES.length;
      var by = y(d.mpa);
      s += '<rect class="grade-bar" data-i="' + i + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw + '" height="' + (PT + ph - by).toFixed(1) + '" rx="4" fill="' + (d.mine ? '#2f7d6b' : '#79828a') + '" opacity="0.85"/>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (by - 15).toFixed(1) + '" font-size="9" fill="#79828a" text-anchor="middle" font-family="monospace">' + d.ksi + ' ksi</text>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (by - 4).toFixed(1) + '" font-size="9.5" fill="' + (d.mine ? '#235f51' : '#5d666d') + '" text-anchor="middle" font-family="monospace" font-weight="600">' + d.mpa + ' MPa</text>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (PT + ph + 14) + '" font-size="10" fill="#2f3538" text-anchor="middle" font-family="monospace" font-weight="600">' + d.g + '</text>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (PT + ph + 26) + '" font-size="8" fill="' + (d.mine ? '#9a7a1c' : '#9ba3a9') + '" text-anchor="middle">' + d.grp + '</text>';
    });

    s += '<text x="' + (PL - 34) + '" y="' + (PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 34) + ' ' + (PT + ph / 2) + ')">最小屈服强度 (MPa)</text>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (PT - 14) + '" font-size="9" fill="#5d666d" text-anchor="middle">API Spec 5DP 钻杆钢级（1 ksi = 6.895 MPa；绿 = 本案例深井用钢）</text>';

    svg.innerHTML = s;
  }

  function bindGradeHover() {
    var svg = $('c-grade'), tip = $('t-grade'), box = $('box-grade');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.classList && t.classList.contains('grade-bar')) {
        var d = GRADES[+t.getAttribute('data-i')];
        tip.innerHTML = '<b>' + d.g + ' 钢级</b><br>最小屈服强度 <b>' + d.ksi + ' ksi（' + d.mpa + ' MPa）</b><br><span style="color:#8a9298">' + d.grp + ' · API Spec 5DP</span>';
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 64) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- ③ API RP 7G-2 旧钻杆分级壁厚下限 ---------- */
  var CLASS = [
    { label: '新钻杆（Class 1）', pct: 100, detail: '无磨损，按 API Spec 5DP 供货', c: '#2f7d6b' },
    { label: 'Premium 级', pct: 80, detail: '管体最小壁厚 ≥ 名义壁厚 80%；5" 19.5 lb/ft（名义 0.362 in）下限 0.290 in', c: '#c9a15a' },
    { label: 'Class 2', pct: 70, detail: '管体最小壁厚 ≥ 名义壁厚 70%；低于此应降级或报废', c: '#b05a51' }
  ];

  function drawWall() {
    var svg = $('c-wall');
    if (!svg) return;
    var W = 470, H = 176, PL = 128, PR = 64, PT = 16, PB = 28;
    var pw = W - PL - PR, ph = H - PT - PB;
    function x(v) { return PL + v / 100 * pw; }
    var n = CLASS.length, rowH = ph / n, barH = 18;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var v = 0; v <= 100; v += 25) {
      s += '<line x1="' + x(v).toFixed(1) + '" y1="' + PT + '" x2="' + x(v).toFixed(1) + '" y2="' + (PT + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(v).toFixed(1) + '" y="' + (PT + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '%</text>';
    }

    CLASS.forEach(function (d, i) {
      var cy = PT + rowH * (i + 0.5);
      s += '<text x="' + (PL - 8) + '" y="' + (cy + 3).toFixed(1) + '" font-size="9.5" fill="#2f3538" text-anchor="end" font-weight="600">' + d.label + '</text>';
      s += '<rect class="wall-bar" data-i="' + i + '" x="' + PL + '" y="' + (cy - barH / 2).toFixed(1) + '" width="' + (x(d.pct) - PL).toFixed(1) + '" height="' + barH + '" rx="4" fill="' + d.c + '" opacity="0.85"/>';
      s += '<text x="' + (x(d.pct) + 6).toFixed(1) + '" y="' + (cy + 3).toFixed(1) + '" font-size="9" fill="' + d.c + '" font-family="monospace" font-weight="600">≥' + d.pct + '%</text>';
    });

    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">管体最小壁厚 / 新杆名义壁厚（API RP 7G-2 口径）</text>';
    svg.innerHTML = s;
  }

  function bindWallHover() {
    var svg = $('c-wall'), tip = $('t-wall'), box = $('box-wall');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.classList && t.classList.contains('wall-bar')) {
        var d = CLASS[+t.getAttribute('data-i')];
        tip.innerHTML = '<b>' + d.label + '</b><br>壁厚下限 <b>≥' + d.pct + '%</b><br><span style="color:#8a9298">' + d.detail + '</span>';
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 230) + 'px';
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
  drawGrade();
  drawWall();
  bindGradeHover();
  bindWallHover();
})();
