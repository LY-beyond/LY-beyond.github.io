/* ======= 射孔孔道形态智能预测 · 可运行示范（穿深预测模拟） ======= */
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

  /* 确定性伪随机数（47 发靶试点每次加载一致） */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var PSI_PER_MPA = 145.038;

  /* 4 种代表弹型（候选 12 种中选取）：标称穿深为 API RP 19B Section 1 混凝土靶口径 */
  var CHARGES = {
    SDP: { short: 'SDP-115', name: 'SDP-115 超深穿透型', lp0: 1150, ehd: 8.8, cz: 15, kr: 0.15, color: '#41699b', desc: '穿深优先 · 孔径较小 · 压实带厚' },
    DP:  { short: 'DP-98',   name: 'DP-98 深穿透型',     lp0: 1000, ehd: 9.8, cz: 13, kr: 0.18, color: '#2f7d6b', desc: '穿深与孔径均衡 · 默认弹型' },
    LD:  { short: 'LD-90',   name: 'LD-90 低伤害型',     lp0: 900,  ehd: 10.5, cz: 7,  kr: 0.30, color: '#c9a15a', desc: '压实带薄 · 流动效率高' },
    BH:  { short: 'BH-80',   name: 'BH-80 大孔径型',     lp0: 800,  ehd: 14.2, cz: 10, kr: 0.22, color: '#b05a51', desc: '入口孔径大 · 穿深较短' }
  };
  var CHG_ORDER = ['SDP', 'DP', 'LD', 'BH'];

  var DEF = { chg: 'DP', lp0: 1000, ucs: 78, phi: 10, sig: 30, phase: 90 };
  var S = Object.assign({}, DEF);

  var STORE_KEY = 'p2-perf-tunnel-predict-v1';
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      Object.keys(DEF).forEach(function (k) {
        if (k === 'chg') { if (typeof s.chg === 'string' && CHARGES[s.chg]) S.chg = s.chg; }
        else if (typeof s[k] === 'number') S[k] = s[k];
      });
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------- 物理模型 ---------- */
  /* Thompson (1962)：穿深随岩石抗压强度半对数折减，Berea 6500 psi 基准 */
  function fThompson(ucs) {
    return Math.pow(10, 3.7e-5 * (6500 - ucs * PSI_PER_MPA));
  }
  /* 孔隙度校正（示范关联式）：高孔隙度基质变疏松，穿深略增 */
  function fPhi(phi) { return Math.pow(10 / phi, 0.15); }
  /* 有效应力校正：按 Halleck et al. (1988) 3,000 psi(20.7 MPa) → −12% 标定 */
  function fSig(sig) { return Math.max(0.70, 1 - 0.0058 * sig); }
  /* 相位干扰（示范关联式）：小相位孔间应力干扰略增 */
  function fPhase(phase) { return 1 - (120 - phase) / 1200; }

  function lpEffective(lp0, ucs, phi, sig, phase) {
    return lp0 * fThompson(ucs) * fPhi(phi) * fSig(sig) * fPhase(phase);
  }
  function lpCur() { return lpEffective(S.lp0, S.ucs, S.phi, S.sig, S.phase); }
  function ehdCur() { return CHARGES[S.chg].ehd * (0.85 + 0.15 * fSig(S.sig)); }
  function czCur() { return CHARGES[S.chg].cz * Math.pow(S.phi / 10, 0.5); }
  function krCur() { return clamp(CHARGES[S.chg].kr * Math.pow(10 / S.phi, 0.3), 0.08, 0.35); }

  /* ---------- ① 射流侵彻与孔道形态示意 ---------- */
  function drawJet() {
    var svg = $('jet');
    var W = 500, H = 250, cy = 125;
    var lp = lpCur(), ehd = ehdCur(), cz = czCur(), kr = krCur();

    var xWell = 0, xCas = 128, xCem = 138, xForm = 150;
    var lpPx = lp * 0.25;                       /* 0.25 px/mm → 1300 mm ≈ 325 px */
    var xTip = Math.min(xForm + lpPx, 486);
    var ehPx = clamp(ehd * 3.0, 18, 46);        /* 入口孔径放大显示 */
    var czPx = clamp(cz * 0.55, 2.5, 9);        /* 压实带放大显示 */

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 分层：地层 / 水泥环 / 套管 / 井筒 */
    s += '<rect x="' + xForm + '" y="0" width="' + (W - xForm) + '" height="' + H + '" fill="#f3efe2"/>';
    s += '<rect x="' + xCem + '" y="0" width="' + (xForm - xCem) + '" height="' + H + '" fill="#d8d0bc"/>';
    s += '<rect x="' + xCas + '" y="0" width="' + (xCem - xCas) + '" height="' + H + '" fill="#8a9298"/>';

    /* 射孔弹枪身 + 药型罩 */
    s += '<rect x="30" y="92" width="75" height="66" rx="5" fill="#fff" stroke="#8a9298" stroke-width="1.5"/>';
    s += '<path d="M 55 105 L 98 125 L 55 145 Z" fill="none" stroke="#b05a51" stroke-width="1.6"/>';
    s += '<line x1="55" y1="105" x2="55" y2="145" stroke="#b05a51" stroke-width="1.2"/>';
    s += '<text x="67" y="172" font-size="8.5" fill="#5d666d" text-anchor="middle">聚能射孔弹</text>';
    s += '<text x="67" y="185" font-size="8" fill="#9ba3a9" text-anchor="middle">药型罩（锥形）</text>';

    /* 射流（弹口 → 套管） */
    s += '<defs><marker id="arrj" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#b05a51"/></marker></defs>';
    s += '<line x1="105" y1="' + cy + '" x2="' + (xCas - 2) + '" y2="' + cy + '" stroke="#b05a51" stroke-width="2" marker-end="url(#arrj)"/>';
    s += '<text x="116" y="112" font-size="8" fill="#b05a51" text-anchor="middle">金属射流</text>';

    /* 压实带（外层）与孔道（内层）：入口粗、尖端细的梯形 */
    var zonePath = 'M ' + xForm + ' ' + (cy - ehPx / 2 - czPx) +
      ' L ' + xTip + ' ' + (cy - 2.5 - czPx * 0.4) +
      ' L ' + xTip + ' ' + (cy + 2.5 + czPx * 0.4) +
      ' L ' + xForm + ' ' + (cy + ehPx / 2 + czPx) + ' Z';
    s += '<path d="' + zonePath + '" fill="#e3cfa4" opacity="0.8" stroke="#c9a15a" stroke-width="0.8"/>';
    var tunPath = 'M ' + xForm + ' ' + (cy - ehPx / 2) +
      ' L ' + xTip + ' ' + (cy - 2.5) +
      ' L ' + xTip + ' ' + (cy + 2.5) +
      ' L ' + xForm + ' ' + (cy + ehPx / 2) + ' Z';
    s += '<path d="' + tunPath + '" fill="#2f7d6b" opacity="0.9"/>';

    /* 层标签（沿层旋转） */
    s += '<text x="' + (xCas + 5) + '" y="' + cy + '" font-size="8" fill="#fdfcf9" text-anchor="middle" transform="rotate(-90 ' + (xCas + 5) + ' ' + cy + ')">套管</text>';
    s += '<text x="' + (xCem + 6) + '" y="' + cy + '" font-size="8" fill="#5d5643" text-anchor="middle" transform="rotate(-90 ' + (xCem + 6) + ' ' + cy + ')">水泥环</text>';
    s += '<text x="486" y="18" font-size="8.5" fill="#8a9298" text-anchor="end">地层（致密砂岩）</text>';

    /* 物理速览 */
    s += '<text x="18" y="20" font-size="8.5" fill="#79828a">射流头部 ≈7 km/s · 尾部 ≈1 km/s · 侵彻全程 &lt;200 μs（Halleck 1992）</text>';

    /* 参数与结果汇总（右上，两行，与下方标注错开） */
    var fTot = (lp / S.lp0);
    s += '<text x="486" y="36" font-size="8.5" fill="#79828a" text-anchor="end">Lp₀ ' + S.lp0 + ' mm · UCS ' + S.ucs + ' MPa · φ ' + S.phi + '% · σ ' + S.sig + ' MPa · θ ' + S.phase + '°</text>';
    s += '<text x="486" y="50" font-size="8.5" fill="#235f51" text-anchor="end" font-family="monospace" font-weight="600">有效穿深 ≈ ' + lp.toFixed(0) + ' mm（折减 ×' + fTot.toFixed(2) + '）</text>';

    /* 入口孔径标注（引线到上方） */
    s += '<line x1="' + (xForm + 4) + '" y1="' + (cy - ehPx / 2) + '" x2="' + (xForm + 40) + '" y2="80" stroke="#9a7a1c" stroke-width="0.8"/>';
    s += '<line x1="' + (xForm + 1) + '" y1="' + (cy - ehPx / 2) + '" x2="' + (xForm + 1) + '" y2="' + (cy + ehPx / 2) + '" stroke="#9a7a1c" stroke-width="1"/>';
    s += '<text x="' + (xForm + 44) + '" y="76" font-size="8.5" fill="#9a7a1c" font-family="monospace">入口孔径 ≈ ' + ehd.toFixed(1) + ' mm</text>';

    /* 压实带标注（引线到下方） */
    var zx = xForm + lpPx * 0.42;
    var lx = clamp(zx - 30, xForm + 10, 300);
    s += '<line x1="' + zx.toFixed(1) + '" y1="' + (cy + ehPx / 2 + czPx) + '" x2="' + lx.toFixed(1) + '" y2="172" stroke="#9a7a1c" stroke-width="0.8"/>';
    s += '<text x="' + lx.toFixed(1) + '" y="168" font-size="8.5" fill="#9a7a1c" font-family="monospace" text-anchor="middle">压实带 ≈ ' + cz.toFixed(1) + ' mm · k/k₀ ≈ ' + Math.round(kr * 100) + '%</text>';

    /* 穿深尺寸线（底部） */
    var dy = 206;
    s += '<line x1="' + xForm + '" y1="' + dy + '" x2="' + xTip.toFixed(1) + '" y2="' + dy + '" stroke="#9a7a1c" stroke-width="1"/>';
    s += '<line x1="' + xForm + '" y1="' + (dy - 4) + '" x2="' + xForm + '" y2="' + (dy + 4) + '" stroke="#9a7a1c" stroke-width="1"/>';
    s += '<line x1="' + xTip.toFixed(1) + '" y1="' + (dy - 4) + '" x2="' + xTip.toFixed(1) + '" y2="' + (dy + 4) + '" stroke="#9a7a1c" stroke-width="1"/>';
    s += '<text x="' + ((xForm + xTip) / 2).toFixed(1) + '" y="' + (dy + 14) + '" font-size="9" fill="#9a7a1c" text-anchor="middle" font-family="monospace" font-weight="600">穿深 Lp ≈ ' + lp.toFixed(0) + ' mm</text>';

    svg.innerHTML = s;
  }

  /* ---------- ② 穿深-强度曲线（SVG + 十字线 tooltip） ---------- */
  var UC_W = 480, UC_H = 250, UC_PL = 46, UC_PR = 62, UC_PT = 14, UC_PB = 30;
  var HOVER_UCS = null;
  var X0 = 55, X1 = 95;

  function lpOf(chgKey, ucs) {
    var lp0 = (chgKey === S.chg) ? S.lp0 : CHARGES[chgKey].lp0;
    return lpEffective(lp0, ucs, S.phi, S.sig, S.phase);
  }

  function ucBounds() {
    var lo = 1e9, hi = -1e9;
    CHG_ORDER.forEach(function (k) {
      for (var u = X0; u <= X1; u += 5) {
        var v = lpOf(k, u);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    });
    hi *= 1.12; /* ±10% 带上沿 */
    var pad = (hi - lo) * 0.08 + 10;
    return [Math.max(0, lo - pad), hi + pad];
  }

  function drawCurve() {
    var svg = $('ucurve');
    var W = UC_W, H = UC_H, pl = UC_PL, pr = UC_PR, pt = UC_PT, pb = UC_PB;
    var pw = W - pl - pr, ph = H - pt - pb;
    var bd = ucBounds(), y0 = bd[0], y1 = bd[1];

    function x(u) { return pl + (u - X0) / (X1 - X0) * pw; }
    function y(v) { return pt + ph - (v - y0) / (y1 - y0) * ph; }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格与刻度 */
    var yStep = (y1 - y0) > 700 ? 200 : 100;
    for (var gv = Math.ceil(y0 / yStep) * yStep; gv <= y1; gv += yStep) {
      s += '<line x1="' + pl + '" y1="' + y(gv).toFixed(1) + '" x2="' + (pl + pw) + '" y2="' + y(gv).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y(gv) + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gv.toFixed(0) + '</text>';
    }
    for (var u = X0; u <= X1; u += 5) {
      s += '<line x1="' + x(u) + '" y1="' + pt + '" x2="' + x(u) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(u) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + u + '</text>';
    }

    /* 当前弹型 ±10% 校准误差带 */
    var up = '', dn = '';
    for (var i = 0; i <= 40; i++) {
      var uu = X0 + i / 40 * (X1 - X0);
      var lpv = lpOf(S.chg, uu);
      up += (i ? 'L' : 'M') + x(uu).toFixed(1) + ' ' + y(lpv * 1.10).toFixed(1) + ' ';
      dn = 'L' + x(uu).toFixed(1) + ' ' + y(lpv * 0.90).toFixed(1) + ' ' + dn;
    }
    s += '<path d="' + up + dn + ' Z" fill="#2f7d6b" opacity="0.10"/>';

    /* 四条弹型曲线 */
    CHG_ORDER.forEach(function (k) {
      var c = CHARGES[k], cur = k === S.chg;
      var d = '';
      for (var j = 0; j <= 60; j++) {
        var uv = X0 + j / 60 * (X1 - X0);
        d += (j ? 'L' : 'M') + x(uv).toFixed(1) + ' ' + y(lpOf(k, uv)).toFixed(1) + ' ';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + c.color + '" stroke-width="' + (cur ? 2.6 : 1.3) + '"' + (cur ? '' : ' opacity="0.55"') + '/>';
    });

    /* 末端标注（按 y 排序，相邻 ≥12px） */
    var ends = CHG_ORDER.map(function (k) {
      return { k: k, color: CHARGES[k].color, y: y(lpOf(k, X1)) };
    }).sort(function (a, b) { return a.y - b.y; });
    for (var m = 1; m < ends.length; m++) {
      if (ends[m].y - ends[m - 1].y < 12) ends[m].y = ends[m - 1].y + 12;
    }
    ends.forEach(function (e) {
      s += '<text x="' + (x(X1) + 5) + '" y="' + (e.y + 3).toFixed(1) + '" font-size="8.5" fill="' + e.color + '" font-family="monospace"' + (e.k === S.chg ? ' font-weight="700"' : '') + '>' + CHARGES[e.k].short + '</text>';
    });

    /* 当前 UCS 标线 */
    s += '<line x1="' + x(S.ucs) + '" y1="' + pt + '" x2="' + x(S.ucs) + '" y2="' + (pt + ph) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<circle cx="' + x(S.ucs).toFixed(1) + '" cy="' + y(lpOf(S.chg, S.ucs)).toFixed(1) + '" r="4.5" fill="#b05a51" stroke="#fff" stroke-width="1.5"/>';
    s += '<text x="' + x(S.ucs).toFixed(1) + '" y="' + (pt + 10) + '" font-size="8.5" fill="#b05a51" text-anchor="middle" font-family="monospace">' + S.ucs + ' MPa</text>';

    /* hover 十字线 */
    if (HOVER_UCS !== null) {
      var hu = clamp(Math.round(HOVER_UCS), X0, X1);
      s += '<line x1="' + x(hu) + '" y1="' + pt + '" x2="' + x(hu) + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="2 2"/>';
      CHG_ORDER.forEach(function (k) {
        s += '<circle cx="' + x(hu).toFixed(1) + '" cy="' + y(lpOf(k, hu)).toFixed(1) + '" r="3" fill="' + CHARGES[k].color + '" stroke="#fff" stroke-width="1"/>';
      });
    }

    /* 轴标题 */
    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">有效穿深 (mm)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">地层抗压强度 UCS（MPa）</text>';

    svg.innerHTML = s;
  }

  function bindCurve() {
    var svg = $('ucurve'), tip = $('uc-tip'), box = $('uc-box');
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (UC_W / r.width);
      var pw = UC_W - UC_PL - UC_PR;
      if (vx < UC_PL || vx > UC_PL + pw) { HOVER_UCS = null; tip.style.display = 'none'; drawCurve(); return; }
      var u = X0 + (vx - UC_PL) / pw * (X1 - X0);
      HOVER_UCS = clamp(Math.round(u), X0, X1);
      drawCurve();
      var rows = CHG_ORDER.map(function (k) {
        var c = CHARGES[k];
        var mark = k === S.chg ? '（当前）' : '';
        return '<span style="color:' + c.color + '">■</span> ' + c.short + mark + '：<b>' + lpOf(k, HOVER_UCS).toFixed(0) + ' mm</b>';
      }).join('<br>');
      tip.innerHTML = 'UCS <b>' + HOVER_UCS + '</b> MPa · φ ' + S.phi + '% · σ ' + S.sig + ' MPa · θ ' + S.phase + '°<br>' + rows;
      var rb = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 96) + 'px';
    });
    svg.addEventListener('mouseleave', function () { HOVER_UCS = null; tip.style.display = 'none'; drawCurve(); });
  }

  /* ---------- ③ 仿真 vs 靶试偏差校准散点（canvas，HiDPI） ---------- */
  var SC_W = 480, SC_H = 270, SC_PL = 48, SC_PR = 14, SC_PT = 12, SC_PB = 32;
  var SHOTS = [];   /* {type:'C'|'R', true, raw, cal} */
  var CAL_MODE = 'cal';
  var SC_HOVER = -1;

  function genShots() {
    var rnd = mulberry32(20261101);
    SHOTS = [];
    var i, t, noise;
    for (i = 0; i < 34; i++) {           /* 混凝土靶 34 发 */
      t = 780 + rnd() * 400;
      noise = (rnd() * 2 - 1) * 0.045;
      SHOTS.push({ type: 'C', meas: t, raw: t * (1 + 0.096 + noise), cal: t * (1 + (rnd() * 2 - 1) * 0.058) });
    }
    for (i = 0; i < 13; i++) {           /* 岩心靶 13 发（围压靶，穿深较低） */
      t = 380 + rnd() * 400;
      noise = (rnd() * 2 - 1) * 0.045;
      SHOTS.push({ type: 'R', meas: t, raw: t * (1 + 0.132 + noise), cal: t * (1 + (rnd() * 2 - 1) * 0.058) });
    }
  }

  function medErr(key) {
    var es = SHOTS.map(function (d) { return Math.abs(d[key] / d.meas - 1); }).sort(function (a, b) { return a - b; });
    return es[Math.floor(es.length / 2)] * 100;
  }
  function inBand(key) {
    var n = 0;
    SHOTS.forEach(function (d) { if (Math.abs(d[key] / d.meas - 1) <= 0.10) n++; });
    return n;
  }

  var SC_X0 = 300, SC_X1 = 1250, SC_Y0 = 300, SC_Y1 = 1350;
  function scX(v) { return SC_PL + (v - SC_X0) / (SC_X1 - SC_X0) * (SC_W - SC_PL - SC_PR); }
  function scY(v) { return SC_PT + (SC_H - SC_PT - SC_PB) - (v - SC_Y0) / (SC_Y1 - SC_Y0) * (SC_H - SC_PT - SC_PB); }

  function drawScatter() {
    var cv = $('scatter');
    var ctx = setupCanvas(cv, SC_W, SC_H);
    var pw = SC_W - SC_PL - SC_PR, ph = SC_H - SC_PT - SC_PB;

    ctx.clearRect(0, 0, SC_W, SC_H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, SC_W, SC_H);

    /* 网格 */
    ctx.strokeStyle = '#efece1'; ctx.lineWidth = 1;
    ctx.fillStyle = '#9ba3a9'; ctx.font = '9px Consolas, monospace';
    for (var gx = 400; gx <= SC_X1; gx += 200) {
      ctx.beginPath(); ctx.moveTo(scX(gx), SC_PT); ctx.lineTo(scX(gx), SC_PT + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(gx + '', scX(gx), SC_PT + ph + 13);
    }
    for (var gy = 400; gy <= SC_Y1; gy += 200) {
      ctx.beginPath(); ctx.moveTo(SC_PL, scY(gy)); ctx.lineTo(SC_PL + pw, scY(gy)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(gy + '', SC_PL - 5, scY(gy) + 3);
    }

    /* y = x 理想线 */
    ctx.strokeStyle = '#8a9298'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(scX(SC_X0), scY(SC_X0)); ctx.lineTo(scX(SC_X1), scY(SC_X1)); ctx.stroke();
    /* ±10% 验收带 */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    var xA = SC_X0, xB = Math.min(SC_X1, SC_Y1 / 1.1);
    ctx.beginPath(); ctx.moveTo(scX(xA), scY(xA * 1.1)); ctx.lineTo(scX(xB), scY(xB * 1.1)); ctx.stroke();
    xA = Math.max(SC_X0, SC_Y0 / 0.9); xB = SC_X1;
    ctx.beginPath(); ctx.moveTo(scX(xA), scY(xA * 0.9)); ctx.lineTo(scX(xB), scY(xB * 0.9)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'right'; ctx.font = '8.5px Consolas, monospace';
    ctx.fillText('±10% 验收带', SC_PL + pw - 4, scY(Math.min(SC_X1, SC_Y1 / 1.1) * 1.1) + 12);

    /* 未校准点（raw 模式主显 / cal 模式淡显） */
    SHOTS.forEach(function (d, i) {
      if (CAL_MODE === 'raw' || CAL_MODE === 'cal') {
        var faint = CAL_MODE === 'cal';
        ctx.beginPath();
        ctx.arc(scX(d.meas), scY(d.raw), faint ? 2.6 : 3.4, 0, Math.PI * 2);
        ctx.strokeStyle = '#b05a51';
        ctx.globalAlpha = faint ? 0.30 : 0.85;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (i === SC_HOVER && CAL_MODE === 'raw') {
        ctx.beginPath(); ctx.arc(scX(d.meas), scY(d.raw), 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#2f3538'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    /* 校准后点（cal 模式） */
    if (CAL_MODE === 'cal') {
      SHOTS.forEach(function (d, i) {
        ctx.beginPath();
        ctx.arc(scX(d.meas), scY(d.cal), 3.4, 0, Math.PI * 2);
        ctx.fillStyle = d.type === 'C' ? '#41699b' : '#c9a15a';
        ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
        if (i === SC_HOVER) {
          ctx.beginPath(); ctx.arc(scX(d.meas), scY(d.cal), 6.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#2f3538'; ctx.lineWidth = 1.6; ctx.stroke();
        }
      });
    }

    /* 轴标题 */
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('靶试实测穿深（mm）', SC_PL + pw / 2, SC_H - 3);
    ctx.save();
    ctx.translate(13, SC_PT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('仿真 / 模型预测穿深（mm）', 0, 0);
    ctx.restore();
  }

  function scHit(evt) {
    var cv = $('scatter');
    var r = cv.getBoundingClientRect();
    var mx = (evt.clientX - r.left) * (SC_W / r.width);
    var my = (evt.clientY - r.top) * (SC_H / r.height);
    var bi = -1, bd = 12;
    SHOTS.forEach(function (d, i) {
      var v = CAL_MODE === 'cal' ? d.cal : d.raw;
      var dx = scX(d.meas) - mx, dy = scY(v) - my;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bd) { bd = dist; bi = i; }
    });
    return bi;
  }

  function bindScatter() {
    var cv = $('scatter'), tip = $('sc-tip'), box = $('sc-box');
    cv.addEventListener('mousemove', function (evt) {
      var i = scHit(evt);
      if (i !== SC_HOVER) { SC_HOVER = i; drawScatter(); }
      if (i >= 0) {
        var d = SHOTS[i];
        var eRaw = (d.raw / d.meas - 1) * 100, eCal = (d.cal / d.meas - 1) * 100;
        tip.innerHTML = '<b>' + (d.type === 'C' ? '混凝土靶' : '岩心靶') + ' #' + (i + 1) + '</b><br>' +
          '实测 <b>' + d.meas.toFixed(0) + ' mm</b><br>' +
          '未校准仿真 ' + d.raw.toFixed(0) + ' mm（' + (eRaw >= 0 ? '+' : '') + eRaw.toFixed(1) + '%）<br>' +
          '校准后 ' + d.cal.toFixed(0) + ' mm（' + (eCal >= 0 ? '+' : '') + eCal.toFixed(1) + '%）';
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 220) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 96) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { SC_HOVER = -1; tip.style.display = 'none'; drawScatter(); });
  }

  function updateCalStats() {
    var el = $('cal-stats');
    if (CAL_MODE === 'raw') {
      el.textContent = '未校准：偏差中位 +' + medErr('raw').toFixed(1) + '%（混凝土靶 +9.6% / 岩心靶 +13.2% 系统偏高），仅 ' + inBand('raw') + '/47 发落在 ±10% 带内';
    } else {
      el.textContent = '贝叶斯校准后：偏差中位 ≈' + medErr('cal').toFixed(1) + '%，' + inBand('cal') + '/47 发落在 ±10% 带内（案例口径 4.8%）';
    }
  }

  function bindCalSeg() {
    var seg = $('cal-seg');
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        CAL_MODE = this.getAttribute('data-mode');
        seg.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        SC_HOVER = -1;
        drawScatter();
        updateCalStats();
      });
    });
  }

  /* ---------- ④ 指标与结论 ---------- */
  function renderMetrics() {
    var lp = lpCur(), ehd = ehdCur(), cz = czCur(), kr = krCur();

    $('m-lp').innerHTML = lp.toFixed(0) + '<small> mm</small>';
    $('m-lp').parentNode.className = 'mcard' + (lp < 500 ? ' warn' : '');
    $('m-ehd').innerHTML = ehd.toFixed(1) + '<small> mm</small>';
    $('m-cz').innerHTML = cz.toFixed(1) + '<small> mm</small>';
    $('m-kr').innerHTML = Math.round(kr * 100) + '<small> %</small>';
    $('m-kr').parentNode.className = 'mcard' + (kr < 0.15 ? ' bad' : (kr < 0.20 ? ' warn' : ''));
    $('m-err').innerHTML = '≤10<small> %（校准后）</small>';

    var v = $('verdict');
    var c = CHARGES[S.chg];
    var fT = fThompson(S.ucs), fS = fSig(S.sig);
    var head = '弹型 <b>' + c.name + '</b>（标称 ' + S.lp0 + ' mm）· 强度折减 ×' + fT.toFixed(2) + ' · 应力折减 ×' + fS.toFixed(2) + ' → 有效穿深 <b>' + lp.toFixed(0) + '</b> mm；';
    if (lp < 500) {
      v.className = 'verdict warn';
      v.innerHTML = head + '穿深偏浅，致密砂岩污染带（典型 300–500 mm）可能无法完全穿透。建议：换超深穿透弹 SDP-115 或复核应力/强度输入。';
    } else if (kr < 0.15) {
      v.className = 'verdict warn';
      v.innerHTML = head + '压实带渗透率比仅 <b>' + Math.round(kr * 100) + '%</b>，孔道虽深但流动效率受损。建议：换低伤害弹 LD-90，或配合负压差射孔冲出碎屑（King 1986）。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '压实带 <b>' + cz.toFixed(1) + '</b> mm、k/k₀ <b>' + Math.round(kr * 100) + '%</b>，入口孔径 <b>' + ehd.toFixed(1) + '</b> mm；代理模型穿深误差 ≤10%（2,400 组仿真 + 47 发靶试贝叶斯校准），可进入 2,000 余套组合的方案排序候选。';
    }
  }

  /* ---------- 绑定与渲染 ---------- */
  var OUT = {
    lp0: function (v) { return v + ' mm'; },
    ucs: function (v) { return v + ' MPa'; },
    phi: function (v) { return v.toFixed(1) + ' %'; },
    sig: function (v) { return v + ' MPa'; },
    phase: function (v) { return v + '°'; }
  };
  var KEYS = ['lp0', 'ucs', 'phi', 'sig', 'phase'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
    $('o-chg').textContent = CHARGES[S.chg].short;
    Array.prototype.forEach.call($('chg-group').querySelectorAll('.chg-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-chg') === S.chg);
    });
  }

  function render() {
    drawJet();
    drawCurve();
    renderMetrics();
    saveState();
  }

  function buildChgButtons() {
    var g = $('chg-group');
    CHG_ORDER.forEach(function (k) {
      var c = CHARGES[k];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chg-btn';
      b.setAttribute('data-chg', k);
      b.innerHTML = '<b><span class="chg-dot" style="background:' + c.color + '"></span>' + c.name + '</b>' +
        '<span>标称 ' + c.lp0 + ' mm · EHD ' + c.ehd + ' mm · ' + c.desc + '</span>';
      b.addEventListener('click', function () {
        S.chg = k;
        S.lp0 = c.lp0;
        syncSliders();
        render();
      });
      g.appendChild(b);
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
      S = Object.assign({}, DEF);
      syncSliders();
      render();
    });
    bindCurve();
    bindScatter();
    bindCalSeg();
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰（防抖） */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawScatter(); }, 120);
  });

  loadState();
  buildChgButtons();
  bind();
  syncSliders();
  render();
  genShots();
  drawScatter();
  updateCalStats();
})();

/* ======= 射孔孔道形态智能预测 · 真实数据来源页 ======= */
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
  var PSI_PER_MPA = 145.038;

  /* Elsharafi & Bodi (2017) IPCSE 2(2)：2⅞ in HSD 枪 API RP 19B 混凝土靶实测 */
  var CHARGES_LIT = [
    { name: '31 J CS', exp: 'HMX', load: 10.7, penIn: 19.2, ehIn: 0.30 },
    { name: '34 J UJ (HSD)', exp: 'HSD', load: 15.2, penIn: 20.6, ehIn: 0.29 },
    { name: '34 J UJ', exp: 'HMX', load: 15.0, penIn: 22.0, ehIn: 0.30 },
    { name: 'PJ 2906', exp: 'HMX', load: 15.0, penIn: 26.0, ehIn: 0.28 }
  ];

  /* Xu et al. (2022) Front. Earth Sci. 10:783556 Fig.8：150℃ 射孔大靶损伤分区面积占比 */
  var ZONES = [
    { name: '裂缝区', pct: 8.3, color: '#b05a51', desc: '孔道壁最近侧，颗粒破碎、微裂缝发育；平均厚度 15.27 mm' },
    { name: '过渡区', pct: 8.5, color: '#c9a15a', desc: '裂缝向压实过渡，孔隙度介于两区之间' },
    { name: '压实区', pct: 24.2, color: '#41699b', desc: '孔隙被压密，渗透率显著下降（Satti 2019：40 vs 原岩 160 mD）' },
    { name: '未扰动区', pct: 59.0, color: '#ddd3ba', desc: '孔隙度 / 渗透率保持原岩水平' }
  ];

  var PL = 56, PR = 16;

  /* ① 弹型穿深柱状图 */
  function drawCharges() {
    var svg = document.getElementById('lit-charge'); if (!svg) return;
    var W = 880, H = 220, PT = 34, PB = 46, plotW = W - PL - PR, plotH = H - PT - PB;
    var Y1 = 700;
    function yOf(v) { return PT + (Y1 - v) / Y1 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var v = 0; v <= Y1; v += 100) {
      var y = yOf(v);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: v ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, v + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);
    }
    txt(14, PT + plotH / 2, 'API 穿深（mm）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (PT + plotH / 2) + ')' }, svg);
    var bw = 120;
    CHARGES_LIT.forEach(function (c, i) {
      var cx = PL + plotW * (i + 0.5) / CHARGES_LIT.length;
      var mm = c.penIn * 25.4;
      var y = yOf(mm);
      el('rect', { 'data-idx': i, x: cx - bw / 2, y: y, width: bw, height: PT + plotH - y, rx: 3, fill: '#41699b', opacity: 0.82, style: 'cursor:pointer' }, svg);
      txt(cx, y - 17, c.penIn.toFixed(1) + ' in', { 'font-size': 9, fill: '#9ba3a9', 'text-anchor': 'middle' }, svg);
      txt(cx, y - 4, mm.toFixed(0) + ' mm', { 'font-size': 10, fill: '#235f51', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace', 'font-weight': 600 }, svg);
      txt(cx, PT + plotH + 15, c.name, { 'font-size': 9.5, fill: '#5d666d', 'text-anchor': 'middle' }, svg);
      txt(cx, PT + plotH + 29, c.load.toFixed(1) + ' g ' + c.exp, { 'font-size': 8.5, fill: '#9ba3a9', 'text-anchor': 'middle' }, svg);
    });
    txt(PL + 4, 16, 'Elsharafi & Bodi (2017) · 2⅞ in HSD 枪 · API RP 19B Section 1 混凝土靶；深穿透弹行业口径 20–40 in（508–1,016 mm）', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function fillChargeTable() {
    var body = document.getElementById('charge-body'); if (!body) return;
    CHARGES_LIT.forEach(function (c) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + c.name + '</td><td>' + c.exp + '</td><td class="num">' + c.load.toFixed(1) + '</td><td class="num">' +
        c.penIn.toFixed(1) + ' in（' + (c.penIn * 25.4).toFixed(0) + ' mm）</td><td class="num">' +
        c.ehIn.toFixed(2) + ' in（' + (c.ehIn * 25.4).toFixed(1) + ' mm）</td>';
      body.appendChild(tr);
    });
  }

  /* ② Thompson 穿深-强度校正曲线 */
  function fThompson(ucs) { return Math.pow(10, 3.7e-5 * (6500 - ucs * PSI_PER_MPA)); }

  function drawThompson() {
    var svg = document.getElementById('lit-thompson'); if (!svg) return;
    var W = 880, H = 250, PT = 26, PB = 40, pr = 30;
    var plotW = W - PL - pr, plotH = H - PT - PB;
    var X1 = 100, Y0 = 0.5, Y1 = 1.05;
    function xOf(u) { return PL + u / X1 * plotW; }
    function yOf(f) { return PT + (Y1 - f) / (Y1 - Y0) * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);

    /* 本案例区间阴影 */
    el('rect', { x: xOf(60), y: PT, width: xOf(90) - xOf(60), height: plotH, fill: '#2f7d6b', opacity: 0.07 }, svg);
    el('line', { x1: xOf(60), y1: PT, x2: xOf(60), y2: PT + plotH, stroke: '#2f7d6b', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
    el('line', { x1: xOf(90), y1: PT, x2: xOf(90), y2: PT + plotH, stroke: '#2f7d6b', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
    txt((xOf(60) + xOf(90)) / 2, PT + 12, '本案例区间 60–90 MPa', { 'font-size': 9.5, fill: '#235f51', 'text-anchor': 'middle', 'font-weight': 600 }, svg);

    for (var f = 0.5; f <= 1.001; f += 0.1) {
      var y = yOf(f);
      el('line', { x1: PL, y1: y, x2: W - pr, y2: y, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, f.toFixed(1), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);
    }
    for (var u = 0; u <= X1; u += 20) {
      el('line', { x1: xOf(u), y1: PT, x2: xOf(u), y2: PT + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(xOf(u), PT + plotH + 14, u + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    }
    txt(W / 2, H - 4, '岩石抗压强度 UCS（MPa）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(14, PT + plotH / 2, '穿深折减系数 f_C（—）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (PT + plotH / 2) + ')' }, svg);

    /* f = 1.0 基准线 */
    el('line', { x1: PL, y1: yOf(1), x2: W - pr, y2: yOf(1), stroke: '#d8d0bc', 'stroke-width': 1.2 }, svg);

    /* Thompson 曲线 */
    var d = '';
    for (var j = 0; j <= 100; j++) {
      d += (j ? 'L' : 'M') + xOf(j).toFixed(1) + ' ' + yOf(fThompson(j)).toFixed(1) + ' ';
    }
    el('path', { d: d, fill: 'none', stroke: '#2f7d6b', 'stroke-width': 2.4 }, svg);

    /* Berea 基准点（6500 psi = 44.8 MPa） */
    var bx = xOf(44.8), by = yOf(1);
    el('circle', { cx: bx, cy: by, r: 4.5, fill: '#c9a15a', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    txt(bx - 7, by - 8, 'Berea 基准 6500 psi（44.8 MPa）f = 1.00', { 'font-size': 9, fill: '#9a7a1c', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);

    /* 区间端点标注 */
    var f60 = fThompson(60), f90 = fThompson(90);
    el('circle', { cx: xOf(60), cy: yOf(f60), r: 4, fill: '#2f7d6b', stroke: '#fff', 'stroke-width': 1.2 }, svg);
    txt(xOf(60) + 7, yOf(f60) - 7, '60 MPa → f ≈ ' + f60.toFixed(2), { 'font-size': 9, fill: '#235f51', 'font-family': 'Consolas, monospace' }, svg);
    el('circle', { cx: xOf(90), cy: yOf(f90), r: 4, fill: '#2f7d6b', stroke: '#fff', 'stroke-width': 1.2 }, svg);
    txt(xOf(90) - 7, yOf(f90) + 15, '90 MPa → f ≈ ' + f90.toFixed(2), { 'font-size': 9, fill: '#235f51', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);

    txt(PL + 4, 16, 'Lp = Lp₀ · 10^(3.7×10⁻⁵·(6500 − C_psi)) · Thompson (1962) 半对数校正式', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  /* ③ 损伤带分区堆叠条 */
  function drawDmg() {
    var svg = document.getElementById('lit-dmg'); if (!svg) return;
    var W = 880, H = 120, x0 = 40, x1 = 840, y0 = 30, bh = 32;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    txt(x0, 18, '孔道横截面损伤分区（自孔道壁向外 →）· Xu, Liang & Guo (2022) Fig.8 · 占 CT 扫描面积比例', { 'font-size': 9, fill: '#8a9298' }, svg);
    var x = x0, total = x1 - x0;
    ZONES.forEach(function (z, i) {
      var w = z.pct / 100 * total;
      el('rect', { 'data-idx': i, x: x, y: y0, width: w, height: bh, fill: z.color, opacity: 0.88, style: 'cursor:pointer' }, svg);
      var light = (z.color === '#ddd3ba');
      if (w > 60) {
        txt(x + w / 2, y0 + bh / 2 - 1, z.name, { 'font-size': 9.5, fill: light ? '#6d664f' : '#fff', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
        txt(x + w / 2, y0 + bh / 2 + 11, z.pct.toFixed(1) + '%', { 'font-size': 9, fill: light ? '#6d664f' : '#fff', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
      }
      z._x = x; z._w = w;
      x += w;
    });
    el('rect', { x: x0, y: y0, width: total, height: bh, fill: 'none', stroke: '#cfc7b6', 'stroke-width': 1 }, svg);
    txt(x0, y0 + bh + 18, '注：压实区渗透率降至原岩约 25%（Satti 2019：40 vs 160 mD）；工程口径为原岩的 10–30%（King et al. 1986）；裂缝区平均厚度 15.27 mm（Xu 2022）。', { 'font-size': 9, fill: '#79828a' }, svg);
    txt(x0, y0 + bh + 32, '面积占比合计 100% —— 裂缝区 8.3% + 过渡区 8.5% + 压实区 24.2% + 未扰动区 59.0%。', { 'font-size': 8.5, fill: '#9ba3a9' }, svg);
  }

  /* ---------- 交互绑定 ---------- */
  function bindBar(svgId, tipId, boxId, data, labelFn) {
    var svg = document.getElementById(svgId), tip = document.getElementById(tipId), box = document.getElementById(boxId);
    if (!svg || !tip || !box) return;
    var W = +svg.getAttribute('viewBox').split(' ')[2];
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var n = data.length;
      var k = Math.floor((vx - PL) / (W - PL - PR) * n);
      if (k >= 0 && k < n) {
        tip.innerHTML = labelFn(data[k]);
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 230) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 76) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function bindDmg() {
    var svg = document.getElementById('lit-dmg'), tip = document.getElementById('dmg-tip'), box = document.getElementById('dmg-box');
    if (!svg || !tip || !box) return;
    var W = 880, y0 = 30, bh = 32;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var vy = (evt.clientY - r.top) * (120 / r.height);
      var hit = -1;
      if (vy >= y0 && vy <= y0 + bh) {
        ZONES.forEach(function (z, i) { if (vx >= z._x && vx <= z._x + z._w) hit = i; });
      }
      if (hit >= 0) {
        var z = ZONES[hit];
        tip.innerHTML = '<b>' + z.name + '（' + z.pct.toFixed(1) + '%）</b><br>' + z.desc;
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 230) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 66) + 'px';
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
  drawCharges(); fillChargeTable();
  drawThompson();
  drawDmg();
  bindBar('lit-charge', 'chg-tip', 'chg-box', CHARGES_LIT, function (c) {
    return '弹型 <b>' + c.name + '</b>（' + c.exp + '）<br>装药 ' + c.load.toFixed(1) + ' g<br>API 穿深 <b>' + c.penIn.toFixed(1) + ' in</b>（' + (c.penIn * 25.4).toFixed(0) + ' mm）<br>入口孔径 <b>' + c.ehIn.toFixed(2) + ' in</b>（' + (c.ehIn * 25.4).toFixed(1) + ' mm）';
  });
  bindDmg();
})();
