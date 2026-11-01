/* ======= 射孔参数智能设计 · 可运行示范（参数优化模拟） ======= */
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

  var PSI_PER_MPA = 145.038;

  /* Karakas & Tariq (1991) SPE 18247-PA 相位系数（仅取本案例允许的 60/90/120°） */
  var KT = {
    60:  { alpha: 0.813, a1: -1.898, a2: 0.1023, b1: 1.3654, b2: 1.6490, c1: 3.0e-4, c2: 7.509 },
    90:  { alpha: 0.726, a1: -1.905, a2: 0.1038, b1: 1.5674, b2: 1.6935, c1: 1.9e-4, c2: 6.155 },
    120: { alpha: 0.648, a1: -2.018, a2: 0.0634, b1: 1.6136, b2: 1.7770, c1: 6.6e-3, c2: 5.320 }
  };

  var DEF = { sd: 16, phase: 90, lp: 700, k: 8, ucs: 78, dd: 6 };
  var S = Object.assign({}, DEF);

  var STORE_KEY = 'co2-perf-param-design-v1';
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      Object.keys(DEF).forEach(function (k) {
        if (typeof s[k] === 'number') S[k] = s[k];
      });
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------- 物理模型 ---------- */
  var RW = 0.108, RP = 0.005, RE = 250, ANI = Math.sqrt(10); /* kh/kv = 10 */

  /* Thompson (1962)：穿深随岩石强度折减，Berea 基准 6500 psi */
  function lpEff(lpMm, ucs) {
    var cPsi = ucs * PSI_PER_MPA;
    return (lpMm / 1000) * Math.pow(10, 3.7e-5 * (6500 - cPsi));
  }

  /* Karakas–Tariq 半解析产能比：S_p = S_h + S_v + S_wb（垂井简化口径） */
  function prOf(sd, phase, lpMm, ucs) {
    var cf = KT[phase] || KT[90];
    var lp = lpEff(lpMm, ucs);
    var h = 1 / sd;
    var rwp = cf.alpha * (RW + lp);
    var sh = Math.log(RW / rwp);
    var hD = (h / lp) * ANI;
    var rpD = (RP / (2 * h)) * (1 + 1 / ANI);
    var rwD = RW / (lp + RW);
    var a = cf.a1 * (Math.log(rpD) / Math.LN10) + cf.a2;
    var b = cf.b1 * rpD + cf.b2;
    var sv = Math.pow(10, a) * Math.pow(hD_clamp(hD), b - 1) * Math.pow(rpD, b);
    var swb = cf.c1 * Math.exp(cf.c2 * rwD);
    var sp = sh + sv + swb;
    var lr = Math.log(RE / RW);
    return { pr: lr / (lr + sp), sp: sp, lp: lp };
  }
  function hD_clamp(v) { return Math.max(0.02, v); }

  /* 出砂指数：压差/临界压差 × 孔密放大 × 低渗放大 × 相位修正；≥1.0 高风险 */
  function sandRisk(sd, phase, k, ucs, dd) {
    var cdp = 0.32 * Math.pow(ucs, 0.85);
    var r = (dd / cdp) * Math.pow(sd / 16, 0.85) * Math.pow(10 / k, 0.25) * (1 + (120 - phase) / 500);
    return clamp(r, 0, 1.3);
  }

  /* 孔眼应力集中指数：以 16 孔/m、700 mm、90° 为基准 1.0 */
  function dmgIndex(sd, phase, lpMm) {
    return Math.pow(sd / 16, 1.2) * Math.pow(lpMm / 700, 0.5) * (1 + (120 - phase) / 400);
  }

  /* 相对成本：弹药 + 作业 */
  function costOf(sd, lpMm) { return 0.6 * (sd / 16) + 0.3 * (lpMm / 700) + 0.1; }

  /* ---------- ① 孔眼几何示意 ---------- */
  function drawGeo() {
    var svg = $('geo');
    var W = 500, H = 250;
    var lpPx = 34 + (S.lp - 500) / 400 * 34;      /* 500–900 mm → 34–68 px */
    var lpEffPx = lpEff(S.lp, S.ucs) * 1000 / 900 * 68 * 0.9; /* 折减后穿深 */
    var cx = 120, cy = 128;
    var rForm = 100, rCemO = 84, rCasO = 76, rCasI = 68;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 横截面：地层 / 水泥环 / 套管 / 井筒 */
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rForm + '" fill="#f3efe2" stroke="#e3dcc6"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rCemO + '" fill="#d8d0bc"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rCasO + '" fill="#8a9298"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rCasI + '" fill="#fdfcf9"/>';

    /* 孔眼：相位角 θ → 每平面 360/θ 个孔，从套管外壁画到折减穿深处 */
    var nShots = Math.round(360 / S.phase);
    for (var i = 0; i < nShots; i++) {
      var ang = -90 + i * S.phase;
      var rad = ang * Math.PI / 180;
      var x1 = cx + rCasO * Math.cos(rad), y1 = cy + rCasO * Math.sin(rad);
      var x2 = cx + (rCasO + lpEffPx) * Math.cos(rad), y2 = cy + (rCasO + lpEffPx) * Math.sin(rad);
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#2f7d6b" stroke-width="4" stroke-linecap="round"/>';
      s += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="2.6" fill="#235f51"/>';
    }

    /* 相位角弧标注（第 1、2 孔之间） */
    var a0 = -90, a1 = -90 + S.phase;
    var arcR = rCasI - 12;
    var p0x = cx + arcR * Math.cos(a0 * Math.PI / 180), p0y = cy + arcR * Math.sin(a0 * Math.PI / 180);
    var p1x = cx + arcR * Math.cos(a1 * Math.PI / 180), p1y = cy + arcR * Math.sin(a1 * Math.PI / 180);
    s += '<path d="M ' + p0x.toFixed(1) + ' ' + p0y.toFixed(1) + ' A ' + arcR + ' ' + arcR + ' 0 0 1 ' + p1x.toFixed(1) + ' ' + p1y.toFixed(1) + '" fill="none" stroke="#c9a15a" stroke-width="1.6"/>';
    var midR = rCasI - 26, midA = (a0 + a1) / 2 * Math.PI / 180;
    s += '<text x="' + (cx + midR * Math.cos(midA)).toFixed(1) + '" y="' + (cy + midR * Math.sin(midA) + 3).toFixed(1) + '" font-size="10" fill="#9a7a1c" text-anchor="middle" font-weight="600">θ=' + S.phase + '°</text>';
    s += '<text x="' + cx + '" y="' + (cy + rForm + 14) + '" font-size="9" fill="#8a9298" text-anchor="middle">井筒横截面 · 每平面 ' + nShots + ' 孔</text>';

    /* 纵向展开（1 m 井段） */
    var gx0 = 262, gx1 = 476, gy0 = 66, gy1 = 118; /* 井筒矩形 */
    s += '<rect x="' + gx0 + '" y="' + (gy0 - 22) + '" width="' + (gx1 - gx0) + '" height="' + (gy1 - gy0 + 44) + '" fill="#f3efe2" stroke="#e3dcc6"/>';
    s += '<rect x="' + gx0 + '" y="' + gy0 + '" width="' + (gx1 - gx0) + '" height="' + (gy1 - gy0) + '" fill="#fdfcf9" stroke="#8a9298" stroke-width="2.5"/>';
    var gyMid = (gy0 + gy1) / 2;
    for (var j = 0; j < S.sd; j++) {
      var sx = gx0 + (j + 0.5) / S.sd * (gx1 - gx0);
      var sy = gyMid + ((j % 2 === 0) ? -11 : 11); /* 交替上下示意螺旋相位 */
      s += '<line x1="' + sx.toFixed(1) + '" y1="' + sy.toFixed(1) + '" x2="' + sx.toFixed(1) + '" y2="' + (sy + (j % 2 === 0 ? -1 : 1) * lpEffPx * 0.55).toFixed(1) + '" stroke="#2f7d6b" stroke-width="2.6" stroke-linecap="round"/>';
      s += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="2.2" fill="#235f51"/>';
    }
    /* 1 m 标尺 */
    s += '<line x1="' + gx0 + '" y1="' + (gy1 + 34) + '" x2="' + gx1 + '" y2="' + (gy1 + 34) + '" stroke="#79828a" stroke-width="1"/>';
    s += '<line x1="' + gx0 + '" y1="' + (gy1 + 30) + '" x2="' + gx0 + '" y2="' + (gy1 + 38) + '" stroke="#79828a" stroke-width="1"/>';
    s += '<line x1="' + gx1 + '" y1="' + (gy1 + 30) + '" x2="' + gx1 + '" y2="' + (gy1 + 38) + '" stroke="#79828a" stroke-width="1"/>';
    s += '<text x="' + ((gx0 + gx1) / 2) + '" y="' + (gy1 + 47) + '" font-size="9" fill="#5d666d" text-anchor="middle">水平段 1 m · ' + S.sd + ' 孔</text>';

    /* 穿深标尺 */
    var ax = gx0 - 14;
    s += '<line x1="' + ax + '" y1="' + gyMid + '" x2="' + ax + '" y2="' + (gyMid + lpEffPx * 0.55) + '" stroke="#b05a51" stroke-width="1.4" marker-end="url(#arrp)"/>';
    s += '<defs><marker id="arrp" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#b05a51"/></marker></defs>';
    s += '<text x="' + (ax - 4) + '" y="' + (gyMid + lpEffPx * 0.28 + 3) + '" font-size="9" fill="#b05a51" text-anchor="end" font-family="monospace">Lp ' + (lpEff(S.lp, S.ucs) * 1000).toFixed(0) + ' mm</text>';

    /* 参数汇总行 */
    s += '<text x="16" y="22" font-size="10" fill="#235f51" font-weight="600" font-family="monospace">孔密 ' + S.sd + ' 孔/m · 相位 ' + S.phase + '° · 标称穿深 ' + S.lp + ' mm</text>';
    s += '<text x="16" y="37" font-size="9" fill="#79828a">UCS ' + S.ucs + ' MPa 下有效穿深折减为 ' + (lpEff(S.lp, S.ucs) * 1000).toFixed(0) + ' mm（Thompson 1962）</text>';

    svg.innerHTML = s;
  }

  /* ---------- ② 产能比曲线（SVG + 十字线 tooltip） ---------- */
  var PR_W = 460, PR_H = 240, PR_PL = 46, PR_PR = 14, PR_PT = 16, PR_PB = 34;
  var HOVER_SD = null;
  var REF_LPS = [500, 900];

  function prBounds() {
    var lo = 1e9, hi = -1e9, sd, lp;
    var lps = REF_LPS.concat([S.lp]);
    for (var i = 0; i < lps.length; i++) {
      for (sd = 12; sd <= 24; sd += 2) {
        var v = prOf(sd, S.phase, lps[i], S.ucs).pr;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    var pad = (hi - lo) * 0.18 + 0.005;
    return [lo - pad, hi + pad];
  }

  function drawPr() {
    var svg = $('prchart');
    var W = PR_W, H = PR_H, pl = PR_PL, pr = PR_PR, pt = PR_PT, pb = PR_PB;
    var pw = W - pl - pr, ph = H - pt - pb;
    var bd = prBounds(), y0 = bd[0], y1 = bd[1];

    function x(sd) { return pl + (sd - 12) / 12 * pw; }
    function y(v) { return pt + ph - (v - y0) / (y1 - y0) * ph; }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* y 网格（5 条） */
    for (var g = 0; g <= 4; g++) {
      var gv = y0 + g / 4 * (y1 - y0);
      s += '<line x1="' + pl + '" y1="' + y(gv).toFixed(1) + '" x2="' + (pl + pw) + '" y2="' + y(gv).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y(gv) + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gv.toFixed(2) + '</text>';
    }
    /* PR = 1 基准线 */
    if (y0 < 1 && 1 < y1) {
      s += '<line x1="' + pl + '" y1="' + y(1).toFixed(1) + '" x2="' + (pl + pw) + '" y2="' + y(1).toFixed(1) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="4 3"/>';
      s += '<text x="' + (pl + pw - 3) + '" y="' + (y(1) - 3).toFixed(1) + '" font-size="8.5" fill="#c9a15a" text-anchor="end" font-family="monospace">PR=1 裸眼基准</text>';
    }
    /* x 网格与刻度 */
    for (var sd = 12; sd <= 24; sd += 2) {
      s += '<line x1="' + x(sd) + '" y1="' + pt + '" x2="' + x(sd) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(sd) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + sd + '</text>';
    }

    /* 三条曲线：500 / 当前 / 900 mm */
    var lines = [
      { lp: 500, color: '#41699b', w: 1.4, dash: '5 3', cur: S.lp === 500 },
      { lp: S.lp, color: '#2f7d6b', w: 2.6, dash: '', cur: true },
      { lp: 900, color: '#c9a15a', w: 1.4, dash: '5 3', cur: S.lp === 900 }
    ];
    lines.forEach(function (L) {
      var d = '';
      for (var i2 = 0; i2 <= 60; i2++) {
        var sdv = 12 + i2 / 60 * 12;
        d += (i2 ? 'L' : 'M') + x(sdv).toFixed(1) + ' ' + y(prOf(sdv, S.phase, L.lp, S.ucs).pr).toFixed(1) + ' ';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + L.color + '" stroke-width="' + L.w + '"' + (L.dash ? ' stroke-dasharray="' + L.dash + '"' : '') + '/>';
    });

    /* 当前孔密竖线与当前点 */
    s += '<line x1="' + x(S.sd) + '" y1="' + pt + '" x2="' + x(S.sd) + '" y2="' + (pt + ph) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="3 2"/>';
    var curPr = prOf(S.sd, S.phase, S.lp, S.ucs).pr;
    s += '<circle cx="' + x(S.sd).toFixed(1) + '" cy="' + y(curPr).toFixed(1) + '" r="4.5" fill="#b05a51" stroke="#fff" stroke-width="1.5"/>';

    /* hover 十字线 */
    if (HOVER_SD !== null) {
      var hsd = clamp(Math.round(HOVER_SD / 2) * 2, 12, 24);
      s += '<line x1="' + x(hsd) + '" y1="' + pt + '" x2="' + x(hsd) + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="2 2"/>';
      [500, S.lp, 900].forEach(function (lpv, ii) {
        var col = ['#41699b', '#2f7d6b', '#c9a15a'][ii];
        var pv = prOf(hsd, S.phase, lpv, S.ucs).pr;
        s += '<circle cx="' + x(hsd).toFixed(1) + '" cy="' + y(pv).toFixed(1) + '" r="3" fill="' + col + '" stroke="#fff" stroke-width="1"/>';
      });
    }

    /* 轴标题（刻度与标题间距 ≥4px） */
    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">产能比 PR（—）</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">孔密（孔/m）</text>';

    svg.innerHTML = s;
  }

  function bindPr() {
    var svg = $('prchart'), tip = $('pr-tip'), box = $('pr-box');
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (PR_W / r.width);
      var pw = PR_W - PR_PL - PR_PR;
      if (vx < PR_PL || vx > PR_PL + pw) { HOVER_SD = null; tip.style.display = 'none'; drawPr(); return; }
      var sd = 12 + (vx - PR_PL) / pw * 12;
      HOVER_SD = clamp(Math.round(sd / 2) * 2, 12, 24);
      drawPr();
      var rows = [500, S.lp, 900].map(function (lpv) {
        var col = lpv === 500 ? '#41699b' : (lpv === 900 ? '#c9a15a' : '#2f7d6b');
        var mark = lpv === S.lp ? '（当前）' : '';
        return '<span style="color:' + col + '">■</span> 穿深 ' + lpv + ' mm' + mark + '：<b>' + prOf(HOVER_SD, S.phase, lpv, S.ucs).pr.toFixed(3) + '</b>';
      }).join('<br>');
      tip.innerHTML = '孔密 <b>' + HOVER_SD + '</b> 孔/m · 相位 ' + S.phase + '°<br>' + rows;
      var rb = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 86) + 'px';
    });
    svg.addEventListener('mouseleave', function () { HOVER_SD = null; tip.style.display = 'none'; drawPr(); });
  }

  /* ---------- ③ 帕累托散点（canvas，HiDPI） ---------- */
  var PF_W = 460, PF_H = 260, PF_PL = 44, PF_PR = 14, PF_PT = 14, PF_PB = 32;
  var CANDS = [];
  var HOVER_IDX = -1;

  function genCands() {
    CANDS = [];
    var sds = [12, 14, 16, 18, 20, 22, 24];
    var phases = [60, 90, 120];
    var lp, sd, ph;
    for (var a = 0; a < sds.length; a++) {
      for (var b = 0; b < phases.length; b++) {
        for (lp = 500; lp <= 900; lp += 50) {
          sd = sds[a]; ph = phases[b];
          var pr = prOf(sd, ph, lp, S.ucs).pr;
          var rk = sandRisk(sd, ph, S.k, S.ucs, S.dd);
          CANDS.push({ sd: sd, phase: ph, lp: lp, pr: pr, risk: rk, cost: costOf(sd, lp) });
        }
      }
    }
  }

  function paretoIdx(cands) {
    var front = [];
    for (var i = 0; i < cands.length; i++) {
      var dom = false;
      for (var j = 0; j < cands.length; j++) {
        if (i === j) continue;
        if (cands[j].pr >= cands[i].pr && cands[j].risk <= cands[i].risk &&
            (cands[j].pr > cands[i].pr || cands[j].risk < cands[i].risk)) { dom = true; break; }
      }
      if (!dom) front.push(i);
    }
    return front;
  }

  function pfScales() {
    var x0 = 1e9, x1 = -1e9, y1 = -1e9;
    CANDS.forEach(function (d) {
      if (d.pr < x0) x0 = d.pr;
      if (d.pr > x1) x1 = d.pr;
      if (d.risk > y1) y1 = d.risk;
    });
    var xp = (x1 - x0) * 0.12 + 0.002;
    y1 = Math.min(1.3, Math.max(1.1, y1 * 1.08));
    return {
      x: function (v) { return PF_PL + (v - (x0 - xp)) / ((x1 + xp) - (x0 - xp)) * (PF_W - PF_PL - PF_PR); },
      y: function (v) { return PF_PT + (PF_H - PF_PT - PF_PB) - v / y1 * (PF_H - PF_PT - PF_PB); },
      x0: x0 - xp, x1: x1 + xp, y1: y1
    };
  }

  function drawPareto() {
    var cv = $('pareto');
    var ctx = setupCanvas(cv, PF_W, PF_H);
    var sc = pfScales();
    var front = paretoIdx(CANDS);
    var inFront = {};
    front.forEach(function (i) { inFront[i] = true; });

    ctx.clearRect(0, 0, PF_W, PF_H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, PF_W, PF_H);

    var ph = PF_H - PF_PT - PF_PB, pw = PF_W - PF_PL - PF_PR;

    /* 网格 */
    ctx.strokeStyle = '#efece1'; ctx.lineWidth = 1;
    ctx.fillStyle = '#9ba3a9'; ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'center';
    var xt0 = Math.ceil(sc.x0 / 0.02) * 0.02;
    for (var gx = xt0; gx <= sc.x1; gx += 0.02) {
      var xx = sc.x(gx);
      ctx.beginPath(); ctx.moveTo(xx, PF_PT); ctx.lineTo(xx, PF_PT + ph); ctx.stroke();
      ctx.fillText(gx.toFixed(2), xx, PF_PT + ph + 13);
    }
    ctx.textAlign = 'right';
    for (var gy = 0; gy <= sc.y1; gy += 0.2) {
      var yy = sc.y(gy);
      ctx.beginPath(); ctx.moveTo(PF_PL, yy); ctx.lineTo(PF_PL + pw, yy); ctx.stroke();
      ctx.fillText(gy.toFixed(1), PF_PL - 5, yy + 3);
    }

    /* 风险 = 1.0 高风险线 */
    if (sc.y1 > 1) {
      ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(PF_PL, sc.y(1)); ctx.lineTo(PF_PL + pw, sc.y(1)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right';
      ctx.fillText('出砂指数 = 1.0', PF_PL + pw - 3, sc.y(1) - 4);
    }

    /* 帕累托前沿连线（按 PR 升序） */
    var fs = front.slice().sort(function (a, b) { return CANDS[a].pr - CANDS[b].pr; });
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
    ctx.beginPath();
    fs.forEach(function (i, k) {
      var d = CANDS[i];
      if (k === 0) ctx.moveTo(sc.x(d.pr), sc.y(d.risk));
      else ctx.lineTo(sc.x(d.pr), sc.y(d.risk));
    });
    ctx.stroke(); ctx.setLineDash([]);

    /* 散点 */
    var cMax = 0;
    CANDS.forEach(function (d) { if (d.cost > cMax) cMax = d.cost; });
    CANDS.forEach(function (d, i) {
      var r = 2.5 + d.cost / cMax * 6.5;
      ctx.beginPath();
      ctx.arc(sc.x(d.pr), sc.y(d.risk), r, 0, Math.PI * 2);
      ctx.fillStyle = d.risk < 0.7 ? '#3f8560' : (d.risk < 1.0 ? '#c9a15a' : '#b05a51');
      ctx.globalAlpha = 0.78;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (inFront[i]) { ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.8; ctx.stroke(); }
      if (i === HOVER_IDX) { ctx.strokeStyle = '#2f3538'; ctx.lineWidth = 2; ctx.stroke(); }
    });

    /* 当前方案点（红圈高亮） */
    var curPr = prOf(S.sd, S.phase, S.lp, S.ucs).pr;
    var curRk = sandRisk(S.sd, S.phase, S.k, S.ucs, S.dd);
    ctx.beginPath();
    ctx.arc(sc.x(curPr), sc.y(curRk), 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath();
    ctx.arc(sc.x(curPr), sc.y(curRk), 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#b05a51'; ctx.fill();

    /* 轴标题 */
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('产能比 PR（→ 越大越好）', PF_PL + pw / 2, PF_H - 3);
    ctx.save();
    ctx.translate(12, PF_PT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('出砂指数（→ 越小越好）', 0, 0);
    ctx.restore();
  }

  function pfHit(evt) {
    var cv = $('pareto');
    var r = cv.getBoundingClientRect();
    var mx = (evt.clientX - r.left) * (PF_W / r.width);
    var my = (evt.clientY - r.top) * (PF_H / r.height);
    var sc = pfScales();
    var bi = -1, bd = 14;
    CANDS.forEach(function (d, i) {
      var dx = sc.x(d.pr) - mx, dy = sc.y(d.risk) - my;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bd) { bd = dist; bi = i; }
    });
    return bi;
  }

  function bindPareto() {
    var cv = $('pareto'), tip = $('pf-tip'), box = $('pf-box');
    cv.addEventListener('mousemove', function (evt) {
      var i = pfHit(evt);
      if (i !== HOVER_IDX) { HOVER_IDX = i; drawPareto(); }
      if (i >= 0) {
        var d = CANDS[i];
        tip.innerHTML = '孔密 <b>' + d.sd + '</b> 孔/m · 相位 <b>' + d.phase + '°</b> · 穿深 <b>' + d.lp + '</b> mm<br>' +
          'PR <b>' + d.pr.toFixed(3) + '</b> · 出砂指数 <b>' + d.risk.toFixed(2) + '</b> · 成本 <b>' + d.cost.toFixed(2) + '</b><br>' +
          '<span style="color:#8a9298">点击载入该方案</span>';
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 230) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 92) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { HOVER_IDX = -1; tip.style.display = 'none'; drawPareto(); });
    cv.addEventListener('click', function (evt) {
      var i = pfHit(evt);
      if (i < 0) return;
      var d = CANDS[i];
      S.sd = d.sd; S.phase = d.phase; S.lp = d.lp;
      syncSliders();
      render();
    });
  }

  /* ---------- ④ 指标与结论 ---------- */
  function renderMetrics() {
    var pr = prOf(S.sd, S.phase, S.lp, S.ucs).pr;
    var rk = sandRisk(S.sd, S.phase, S.k, S.ucs, S.dd);
    var dg = dmgIndex(S.sd, S.phase, S.lp);

    $('m-pr').textContent = pr.toFixed(3);
    $('m-sand').textContent = rk.toFixed(2);
    $('m-sand').parentNode.className = 'mcard' + (rk >= 1.0 ? ' bad' : (rk >= 0.7 ? ' warn' : ''));
    $('m-dmg').textContent = dg.toFixed(2) + ' ×';
    $('m-dmg').parentNode.className = 'mcard' + (dg >= 1.35 ? ' warn' : '');

    var v = $('verdict');
    var head = '孔密 <b>' + S.sd + '</b> 孔/m · 相位 <b>' + S.phase + '°</b> · 穿深 <b>' + S.lp + '</b> mm（有效 ' + (lpEff(S.lp, S.ucs) * 1000).toFixed(0) + ' mm）· 产能比 <b>' + pr.toFixed(3) + '</b>；';
    if (rk >= 1.0) {
      v.className = 'verdict bad';
      v.innerHTML = head + '出砂指数 <b>' + rk.toFixed(2) + '</b> ≥ 1.0，高风险。建议：降低生产压差或孔密；16→24 孔/m 出砂指数约 +40%，须用全生命周期临界压差校核。';
    } else if (rk >= 0.7) {
      v.className = 'verdict warn';
      v.innerHTML = head + '出砂指数 <b>' + rk.toFixed(2) + '</b>，接近风险线。若投产后含水上升 25%–35%，临界压差同步下降，建议预留余量或降低孔密。';
    } else if (pr >= 1.0) {
      v.className = 'verdict ok';
      v.innerHTML = head + '穿深已越过污染带，产能比超过裸眼基准（PR&gt;1），出砂指数 <b>' + rk.toFixed(2) + '</b> 安全，可进入 NSGA-II 前沿候选。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '出砂指数 <b>' + rk.toFixed(2) + '</b> 安全；提高孔密或穿深可进一步提升产能比（参见帕累托前沿）。';
    }
  }

  /* ---------- 绑定与渲染 ---------- */
  var OUT = {
    sd: function (v) { return v + ' 孔/m'; },
    phase: function (v) { return v + '°'; },
    lp: function (v) { return v + ' mm'; },
    k: function (v) { return v + ' mD'; },
    ucs: function (v) { return v + ' MPa'; },
    dd: function (v) { return v + ' MPa'; }
  };
  var KEYS = ['sd', 'phase', 'lp', 'k', 'ucs', 'dd'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function render() {
    drawGeo();
    drawPr();
    genCands();
    HOVER_IDX = -1;
    drawPareto();
    renderMetrics();
    saveState();
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
      S = Object.assign({}, DEF);
      syncSliders();
      render();
    });
    bindPr();
    bindPareto();
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰（防抖） */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawPareto(); }, 120);
  });

  loadState();
  bind();
  syncSliders();
  render();
})();

/* ======= 射孔参数智能设计 · 真实数据来源页 ======= */
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

  /* Karakas & Tariq (1991) SPE 18247-PA Table 1–3（相位系数） */
  var KT_FULL = [
    { ph: '0° (360°)', alpha: 0.250, a1: -2.091, a2: 0.0453, b1: 5.1313, b2: 1.8672, c1: '1.6×10⁻¹', c2: 2.675 },
    { ph: '180°', alpha: 0.500, a1: -2.025, a2: 0.0943, b1: 3.0373, b2: 1.8115, c1: '2.6×10⁻²', c2: 4.532 },
    { ph: '120°', alpha: 0.648, a1: -2.018, a2: 0.0634, b1: 1.6136, b2: 1.7770, c1: '6.6×10⁻³', c2: 5.320 },
    { ph: '90°', alpha: 0.726, a1: -1.905, a2: 0.1038, b1: 1.5674, b2: 1.6935, c1: '1.9×10⁻⁴', c2: 6.155 },
    { ph: '60°', alpha: 0.813, a1: -1.898, a2: 0.1023, b1: 1.3654, b2: 1.6490, c1: '3.0×10⁻⁴', c2: 7.509 },
    { ph: '45°', alpha: 0.860, a1: -1.788, a2: 0.2398, b1: 1.1915, b2: 1.6392, c1: '4.6×10⁻⁵', c2: 8.791 }
  ];

  /* Elsharafi & Bodi (2017) IPCSE 2(2): 2⅞ in HSD 枪 API RP 19B 数据 */
  var CHARGES = [
    { name: '31 J CS', exp: 'HMX', load: 10.7, pen: 19.2, eh: 0.30 },
    { name: '34 J UJ (HSD)', exp: 'HSD', load: 15.2, pen: 20.6, eh: 0.29 },
    { name: '34 J UJ', exp: 'HMX', load: 15.0, pen: 22.0, eh: 0.30 },
    { name: 'PJ 2906', exp: 'HMX', load: 15.0, pen: 26.0, eh: 0.28 }
  ];

  var PL = 56, PR = 16;

  /* ① α_θ 柱状图 */
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
    var used = { '120°': 1, '90°': 1, '60°': 1 };
    KT_FULL.forEach(function (d, i) {
      var cx = PL + plotW * (i + 0.5) / KT_FULL.length;
      var y = yOf(d.alpha);
      var ok = used[d.ph];
      el('rect', { 'data-idx': i, x: cx - bw / 2, y: y, width: bw, height: PT + plotH - y, rx: 3, fill: ok ? '#2f7d6b' : '#a8c5b8', opacity: 0.85, style: 'cursor:pointer' }, svg);
      txt(cx, y - 6, d.alpha.toFixed(3), { 'font-size': 10, fill: '#235f51', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace', 'font-weight': 600 }, svg);
      txt(cx, PT + plotH + 15, d.ph, { 'font-size': 9.5, fill: '#5d666d', 'text-anchor': 'middle' }, svg);
      if (ok) txt(cx, PT + plotH + 29, '本案例候选', { 'font-size': 8.5, fill: '#2f7d6b', 'text-anchor': 'middle' }, svg);
    });
    txt(PL + 4, 16, 'Karakas & Tariq (1991) Table 1 · α_θ 越大有效井径越大、水平表皮 S_h 越小（负表皮越深）', { 'font-size': 9, fill: '#8a9298' }, svg);
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

  /* ② 射孔弹穿深 / 孔径柱状图（通用绘制） */
  function drawCharge(svgId, key, unit, yMax, color, fmt) {
    var svg = document.getElementById(svgId); if (!svg) return;
    var W = 430, H = 210, PT = 26, PB = 52, pl = 42, pr = 10;
    var plotW = W - pl - pr, plotH = H - PT - PB;
    function yOf(v) { return PT + (yMax - v) / yMax * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    var step = yMax / 4;
    for (var v = 0; v <= yMax + 1e-9; v += step) {
      var y = yOf(v);
      el('line', { x1: pl, y1: y, x2: W - pr, y2: y, stroke: v ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(pl - 5, y + 3, fmt(v), { 'font-size': 8.5, fill: '#8a9298', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);
    }
    CHARGES.forEach(function (c, i) {
      var cx = pl + plotW * (i + 0.5) / CHARGES.length;
      var y = yOf(c[key]);
      el('rect', { 'data-idx': i, x: cx - 30, y: y, width: 60, height: PT + plotH - y, rx: 3, fill: color, opacity: 0.85, style: 'cursor:pointer' }, svg);
      txt(cx, y - 5, fmt(c[key]), { 'font-size': 9.5, fill: '#235f51', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace', 'font-weight': 600 }, svg);
      txt(cx, PT + plotH + 14, c.name, { 'font-size': 9, fill: '#5d666d', 'text-anchor': 'middle' }, svg);
      txt(cx, PT + plotH + 27, c.load.toFixed(1) + ' g ' + c.exp, { 'font-size': 8.5, fill: '#9ba3a9', 'text-anchor': 'middle' }, svg);
    });
    txt(pl + 2, 14, 'Elsharafi & Bodi (2017) · 2⅞ in HSD 枪 · API RP 19B 混凝土靶（' + unit + '）', { 'font-size': 8.5, fill: '#8a9298' }, svg);
  }

  function fillChargeTable() {
    var body = document.getElementById('charge-body'); if (!body) return;
    CHARGES.forEach(function (c) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + c.name + '</td><td>' + c.exp + '</td><td class="num">' + c.load.toFixed(1) + '</td><td class="num">' +
        c.pen.toFixed(1) + '（' + (c.pen * 25.4).toFixed(0) + ' mm）</td><td class="num">' + c.eh.toFixed(2) + '（' + (c.eh * 25.4).toFixed(1) + ' mm）</td>';
      body.appendChild(tr);
    });
  }

  /* ③ UCS 区间 vs 出砂阈值 */
  function drawUcs() {
    var svg = document.getElementById('lit-ucs'); if (!svg) return;
    var W = 880, H = 120, pl = 60, pr = 30, y0 = 46, bh = 26;
    var X1 = 100;
    function xOf(v) { return pl + v / X1 * (W - pl - pr); }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var v = 0; v <= X1; v += 20) {
      el('line', { x1: xOf(v), y1: y0 - 14, x2: xOf(v), y2: y0 + bh + 10, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(xOf(v), y0 + bh + 26, v + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    }
    /* 本案例区间条 */
    el('rect', { x: xOf(62), y: y0, width: xOf(95) - xOf(62), height: bh, rx: 5, fill: '#2f7d6b', opacity: 0.8 }, svg);
    txt(xOf(78.5), y0 + bh / 2 + 3.5, '本案例储层 UCS 62–95 MPa', { 'font-size': 10, fill: '#fff', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
    /* 阈值线 */
    var xt = xOf(29.0);
    el('line', { x1: xt, y1: y0 - 14, x2: xt, y2: y0 + bh + 14, stroke: '#b05a51', 'stroke-width': 1.6, 'stroke-dasharray': '5 3' }, svg);
    txt(xt + 5, y0 - 18, '出砂阈值 29.0 MPa（4,200 psi，Mohammed et al. 2025）', { 'font-size': 9.5, fill: '#b05a51' }, svg);
    el('rect', { x: xOf(0), y: y0, width: xt - xOf(0), height: bh, fill: '#b05a51', opacity: 0.08 }, svg);
    txt(xOf(0) + 4, y0 + bh / 2 + 3.5, '易出砂区', { 'font-size': 9, fill: '#b05a51' }, svg);
    txt((W - pr) / 2, H - 4, '单轴抗压强度 UCS（MPa）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
  }

  /* 柱状图 hover tooltip（通用绑定） */
  function bindBar(svgId, tipId, boxId, data, labelFn) {
    var svg = document.getElementById(svgId), tip = document.getElementById(tipId), box = document.getElementById(boxId);
    if (!svg || !tip || !box) return;
    var W = +svg.getAttribute('viewBox').split(' ')[2];
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var n = data.length;
      var plx = (svgId === 'lit-alpha') ? PL : 42;
      var prx = (svgId === 'lit-alpha') ? PR : 10;
      var k = Math.floor((vx - plx) / (W - plx - prx) * n);
      if (k >= 0 && k < n) {
        tip.innerHTML = labelFn(data[k]);
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 220) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 76) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
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
  drawAlpha(); fillKtTable();
  drawCharge('lit-pen', 'pen', '穿深 in', 28, '#41699b', function (v) { return v.toFixed(0); });
  drawCharge('lit-eh', 'eh', '入口孔径 in', 0.4, '#c9a15a', function (v) { return v.toFixed(1); });
  fillChargeTable();
  drawUcs();
  bindBar('lit-alpha', 'kt-tip', 'kt-box', KT_FULL, function (d) {
    return '相位 <b>' + d.ph + '</b><br>α_θ = <b>' + d.alpha.toFixed(3) + '</b><br>c1 = ' + d.c1 + '，c2 = ' + d.c2.toFixed(3);
  });
  bindBar('lit-pen', 'pen-tip', 'pen-box', CHARGES, function (c) {
    return '弹型 <b>' + c.name + '</b>（' + c.exp + '）<br>装药 ' + c.load.toFixed(1) + ' g<br>API 穿深 <b>' + c.pen.toFixed(1) + ' in</b>（' + (c.pen * 25.4).toFixed(0) + ' mm）';
  });
  bindBar('lit-eh', 'eh-tip', 'eh-box', CHARGES, function (c) {
    return '弹型 <b>' + c.name + '</b><br>入口孔径 <b>' + c.eh.toFixed(2) + ' in</b>（' + (c.eh * 25.4).toFixed(1) + ' mm）';
  });
})();
