/* ======= 单井产量智能预测 · 可运行示范（滚动预测模拟） ======= */
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

  var NDAYS = 1120, STEP = 7, NW = NDAYS / STEP + 1, FH = 90; /* 预测窗口 90 天 */

  /* ---------- 三口模拟井例（业务口径：松辽盆地某老区 118 口井中抽取） ---------- */
  var WELLS = [
    {
      id: 'N08', name: 'SL-N08', kind: '正常递减井', q0: 24, D: 0.00062, seed: 11,
      hist: [], planned: [], ramp: null,
      fwA: 0.55, fwB: 0.18, fwTau: 800
    },
    {
      id: 'F21', name: 'SL-F21', kind: '压裂井', q0: 21, D: 0.00068, seed: 23,
      hist: [{ day: 420, type: '酸化', factor: 0.55, decay: 0.004 }],
      planned: [{ off: 35, type: '压裂', factor: 1.15, decay: 0.0035 }],
      ramp: null,
      fwA: 0.62, fwB: 0.15, fwTau: 900
    },
    {
      id: 'W15', name: 'SL-W15', kind: '堵水井', q0: 27, D: 0.00055, seed: 37,
      hist: [{ day: 380, type: '压裂', factor: 0.9, decay: 0.004 }],
      planned: [{ off: 28, type: '堵水', factor: 0.45, decay: 0.002 }],
      ramp: { off: 55, g: 0.22, tau: 45 },
      fwA: 0.78, fwB: 0.14, fwTau: 700
    }
  ];

  /* 每井预生成噪声（与预测起点无关，保证切换起点时历史不变） */
  WELLS.forEach(function (w, wi) {
    var rnd = mulberry32(31000 + w.seed * 733);
    w.qn = []; w.fn = [];
    for (var k = 0; k < NW; k++) { w.qn.push((rnd() - 0.5) * 0.10); w.fn.push((rnd() - 0.5) * 0.016); }
    var rnd2 = mulberry32(77000 + w.seed * 149);
    w.qnd = []; /* 日度噪声（预测窗口用） */
    for (var d = 0; d <= FH + 2; d++) w.qnd.push((rnd2() - 0.5) * 0.10);
  });

  /* ---------- 状态 ---------- */
  var DEF = { well: 1, origin: 960, conf: 90 };
  var S = Object.assign({}, DEF);
  var STORE_KEY = 'pr2-production-forecast-v1';
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      Object.keys(DEF).forEach(function (k) { if (typeof s[k] === 'number') S[k] = s[k]; });
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------- 正演：无噪声干净趋势 + 措施脉冲 + 注水滞后见效 ---------- */
  function histMult(w, t) {
    var m = 1;
    w.hist.forEach(function (ev) {
      if (t >= ev.day) m *= 1 + ev.factor * Math.exp(-(t - ev.day) * ev.decay);
    });
    return m;
  }
  function plannedMult(w, t, T0) {
    var m = 1;
    w.planned.forEach(function (ev) {
      var te = T0 + ev.off;
      if (t >= te) m *= 1 + ev.factor * Math.exp(-(t - te) * ev.decay);
    });
    return m;
  }
  function rampMult(w, t, T0) {
    if (!w.ramp) return 1;
    var tr = T0 + w.ramp.off;
    if (t < tr) return 1;
    return 1 + w.ramp.g * (1 - Math.exp(-(t - tr) / w.ramp.tau));
  }
  /* 无措施反事实基线（干净） */
  function baseQ(w, t) { return w.q0 * Math.exp(-w.D * t) * histMult(w, t); }
  /* 真实日产油（含噪声；t 为任意日） */
  function truthQ(w, t, T0) {
    var q = baseQ(w, t) * plannedMult(w, t, T0) * rampMult(w, t, T0);
    var n;
    if (t % STEP === 0 && t / STEP < NW) n = w.qn[t / STEP];
    else n = w.qnd[clamp(Math.round(t - T0), 0, FH)] || 0;
    return q * (1 + n);
  }
  /* 含水率 */
  function truthFw(w, t, T0) {
    var f = w.fwA + w.fwB * (1 - Math.exp(-t / w.fwTau));
    if (w.id === 'F21') { var te = T0 + 35; if (t >= te) f -= 0.04 * Math.exp(-(t - te) / 90); }
    if (w.id === 'W15') {
      var td = T0 + 28; if (t >= td) f -= 0.18 * Math.exp(-(t - td) / 130);
      var tr = T0 + 55; if (t >= tr) f += 0.03 * (1 - Math.exp(-(t - tr) / 60));
    }
    if (t % STEP === 0 && t / STEP < NW) f += w.fn[t / STEP];
    return clamp(f, 0.2, 0.97);
  }

  /* ---------- 预测：模型（含事件协变量）与 Arps 基线 ---------- */
  function zOf(conf) { return 0.6745 + (conf - 50) / 45 * (1.96 - 0.6745); }

  function buildForecast(w) {
    var T0 = S.origin, kconf = zOf(S.conf) / 1.645;
    var mf = [], lo = [], hi = [], arps = [], truth = [], base = [];
    var h;
    /* Arps：对 [T0-238, T0] 含噪历史做 ln(q)~t 最小二乘 */
    var xs = [], ys = [];
    for (var t = T0 - 238; t <= T0; t += STEP) {
      var ki = Math.round(t / STEP);
      if (ki >= 0 && ki < NW) { xs.push(t); ys.push(Math.log(baseQ(w, t) * (1 + w.qn[ki]))); }
    }
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    var b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    var a = (sy - b * sx) / n;

    for (h = 0; h <= FH; h++) {
      var tt = T0 + h;
      var bq = baseQ(w, tt);
      /* 模型：措施计划协变量（低估 0.88、时移 +2 天），注水响应低估 0.85 */
      var mm = 1;
      w.planned.forEach(function (ev) {
        var te = T0 + ev.off + 2;
        if (tt >= te) mm *= 1 + 0.88 * ev.factor * Math.exp(-(tt - te) * ev.decay);
      });
      if (w.ramp) {
        var tr2 = T0 + w.ramp.off + 4;
        if (tt >= tr2) mm *= 1 + 0.85 * w.ramp.g * (1 - Math.exp(-(tt - tr2) / (w.ramp.tau * 1.1)));
      }
      var m = bq * mm * (1 + 0.018 * Math.sin(0.33 * h + 1.7)) * 1.005;
      var hw = (0.035 + 0.085 * h / FH) * kconf * (1 + 0.6 * Math.min(1.2, mm - 1)) * m;
      mf.push(m); lo.push(Math.max(0.05, m - hw)); hi.push(m + hw);
      arps.push(Math.exp(a + b * tt));
      truth.push(truthQ(w, tt, T0));
      base.push(bq);
    }

    /* 周尺度 MAPE（h=7..90，13 个点） */
    var mapeM = 0, mapeA = 0, cnt = 0;
    for (h = STEP; h <= FH; h += STEP) {
      mapeM += Math.abs(mf[h] - truth[h]) / truth[h];
      mapeA += Math.abs(arps[h] - truth[h]) / truth[h];
      cnt++;
    }
    mapeM = mapeM / cnt * 100; mapeA = mapeA / cnt * 100;

    /* 90 天累计产量误差（模型） */
    var sm = 0, st = 0;
    for (h = 1; h <= FH; h++) { sm += mf[h]; st += truth[h]; }
    var cumErr = Math.abs(sm - st) / st * 100;

    /* 归因（日度，真值口径）：基线 / 措施 / 注水 / 残差 */
    var baseMean = 0, evU = 0, rampU = 0, actMean = 0;
    for (h = 1; h <= FH; h++) {
      var tt2 = T0 + h, bq2 = base[h];
      var pm = plannedMult(w, tt2, T0), rm = rampMult(w, tt2, T0);
      baseMean += bq2;
      evU += bq2 * (pm - 1);
      rampU += bq2 * pm * (rm - 1);
      actMean += truthQ(w, tt2, T0);
    }
    baseMean /= FH; evU /= FH; rampU /= FH; actMean /= FH;
    var resid = actMean - baseMean - evU - rampU;
    var cumOil = evU * FH; /* 90 天归因增油（t） */

    return {
      mf: mf, lo: lo, hi: hi, arps: arps, truth: truth,
      mapeM: mapeM, mapeA: mapeA, cumErr: cumErr,
      attr: { base: baseMean, ev: evU, ramp: rampU, resid: resid, actual: actMean, cumOil: cumOil }
    };
  }

  /* ---------- ① 单井产量时序主图 ---------- */
  var FC_W = 920, FC_H = 300, PL = 46, PR = 64, PT = 20, H1 = 160, GAP = 30, H2 = 50, PB = 28;
  var PW = FC_W - PL - PR;
  var Y1 = PT + H1, Y2T = Y1 + GAP, Y2B = Y2T + H2;
  var HOVER_T = -1;

  function xT(t) { return PL + t / NDAYS * PW; }

  function drawFc(fc) {
    var svg = $('fc'), w = WELLS[S.well], T0 = S.origin;
    var qmax = 0, k, h;
    for (k = 0; k < NW; k++) qmax = Math.max(qmax, truthQ(w, k * STEP, T0));
    for (h = 0; h <= FH; h++) qmax = Math.max(qmax, fc.hi[h]);
    qmax = Math.ceil(qmax * 1.08 / 5) * 5;
    function yQ(q) { return PT + H1 - q / qmax * H1; }
    function yF(f) { return Y2T + H2 - (clamp(f, 0.4, 1) - 0.4) / 0.6 * H2; }

    var s = '<rect width="' + FC_W + '" height="' + FC_H + '" fill="#fdfcf9"/>';

    /* 网格 + 左轴（日产油） */
    for (var q = 0; q <= qmax; q += qmax / 4) {
      s += '<line x1="' + PL + '" y1="' + yQ(q) + '" x2="' + (PL + PW) + '" y2="' + yQ(q) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yQ(q) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + q.toFixed(0) + '</text>';
    }
    /* 下面板网格 + 含水轴（40–100%） */
    [40, 60, 80, 100].forEach(function (f) {
      s += '<line x1="' + PL + '" y1="' + yF(f / 100) + '" x2="' + (PL + PW) + '" y2="' + yF(f / 100) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yF(f / 100) + 3) + '" font-size="8.5" fill="#b39b66" text-anchor="end" font-family="monospace">' + f + '</text>';
    });
    /* 时间轴 */
    for (var t = 0; t <= NDAYS; t += 182) {
      s += '<text x="' + xT(t) + '" y="' + (Y2B + 14) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + (t / 364).toFixed(1) + '</text>';
    }
    s += '<text x="' + (PL + PW / 2) + '" y="' + (FC_H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">生产时间（年）</text>';
    s += '<text x="' + (PL - 34) + '" y="' + (PT + H1 / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 34) + ' ' + (PT + H1 / 2) + ')">日产油 (t/d)</text>';
    s += '<text x="' + (PL + 4) + '" y="' + (Y2T + 11) + '" font-size="8.5" fill="#b39b66">含水率 (%)</text>';

    /* 预测窗口背景 */
    s += '<rect x="' + xT(T0) + '" y="' + PT + '" width="' + (xT(T0 + FH) - xT(T0)) + '" height="' + H1 + '" fill="#2f7d6b" opacity="0.035"/>';

    /* 含水率：历史实线 + 未来虚线（面积填充全段） */
    var d = '', d2 = '';
    for (k = 0; k < NW; k++) {
      var tk = k * STEP, fy = yF(truthFw(w, tk, T0));
      if (tk <= T0) d += (d ? 'L' : 'M') + xT(tk).toFixed(1) + ' ' + fy.toFixed(1) + ' ';
      else d2 += (d2 ? 'L' : 'M') + xT(tk).toFixed(1) + ' ' + fy.toFixed(1) + ' ';
    }
    var dAll = d + d2.replace('M', 'L');
    s += '<path d="' + dAll + 'L' + xT(NDAYS) + ' ' + Y2B + ' L' + PL + ' ' + Y2B + ' Z" fill="#c9a15a" opacity="0.12"/>';
    s += '<path d="' + d + '" fill="none" stroke="#c9a15a" stroke-width="1.4"/>';
    if (d2) s += '<path d="M' + xT(T0) + ' ' + yF(truthFw(w, T0, T0)) + ' ' + d2.substring(1) + '" fill="none" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.8"/>';

    /* 历史日产油（深灰实线） */
    d = '';
    for (k = 0; k < NW; k++) {
      var th = k * STEP;
      if (th > T0) break;
      d += (d ? 'L' : 'M') + xT(th).toFixed(1) + ' ' + yQ(truthQ(w, th, T0)).toFixed(1) + ' ';
    }
    s += '<path d="' + d + '" fill="none" stroke="#2f3538" stroke-width="1.8"/>';

    /* 未来实际（灰虚线） */
    d = '';
    for (h = 0; h <= FH; h++) d += (h ? 'L' : 'M') + xT(T0 + h).toFixed(1) + ' ' + yQ(fc.truth[h]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#79828a" stroke-width="1.5" stroke-dasharray="3 3"/>';

    /* 预测置信带 */
    d = '';
    for (h = 0; h <= FH; h++) d += (h ? 'L' : 'M') + xT(T0 + h).toFixed(1) + ' ' + yQ(fc.hi[h]).toFixed(1) + ' ';
    for (h = FH; h >= 0; h--) d += 'L' + xT(T0 + h).toFixed(1) + ' ' + yQ(fc.lo[h]).toFixed(1) + ' ';
    s += '<path d="' + d + 'Z" fill="#2f7d6b" opacity="0.14"/>';

    /* Arps 纯递减参考（金虚线） */
    d = '';
    for (h = 0; h <= FH; h++) d += (h ? 'L' : 'M') + xT(T0 + h).toFixed(1) + ' ' + yQ(fc.arps[h]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#c9a15a" stroke-width="1.8" stroke-dasharray="5 3"/>';

    /* 模型预测（绿实线） */
    d = '';
    for (h = 0; h <= FH; h++) d += (h ? 'L' : 'M') + xT(T0 + h).toFixed(1) + ' ' + yQ(fc.mf[h]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';

    /* 措施事件竖线：历史（虚）+ 计划（实） */
    function eventMark(day, label, solid) {
      var ex = clamp(xT(day), PL + 52, PL + PW - 52);
      var r = '';
      r += '<line x1="' + xT(day) + '" y1="' + PT + '" x2="' + xT(day) + '" y2="' + Y2B + '" stroke="#b05a51" stroke-width="' + (solid ? 1.5 : 1.2) + '" stroke-dasharray="' + (solid ? 'none' : '5 3') + '"/>';
      var bw = label.length * 9 + 16;
      r += '<rect x="' + (ex - bw / 2) + '" y="' + (PT - 1) + '" width="' + bw + '" height="14" rx="3" fill="#b05a51" opacity="' + (solid ? 0.95 : 0.78) + '"/>';
      r += '<text x="' + ex + '" y="' + (PT + 9.5) + '" font-size="8.5" fill="#fff" text-anchor="middle" font-weight="600">' + label + '</text>';
      return r;
    }
    w.hist.forEach(function (ev) { s += eventMark(ev.day, ev.type + ' · 第' + ev.day + '天', false); });
    w.planned.forEach(function (ev) { s += eventMark(T0 + ev.off, '计划' + ev.type + ' · 第' + (T0 + ev.off) + '天', true); });

    /* 预测起点竖线 */
    var cx0 = xT(T0);
    s += '<line x1="' + cx0 + '" y1="' + PT + '" x2="' + cx0 + '" y2="' + Y2B + '" stroke="#5d666d" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<text x="' + (cx0 - 4) + '" y="' + (Y2B - 4) + '" font-size="8.5" fill="#5d666d" text-anchor="end" font-family="monospace">预测起点 第' + T0 + '天</text>';

    /* 曲线末端标注（y 排序后强制 ≥12px 间距） */
    var ends = [
      { c: '#2f7d6b', label: '模型 ' + fc.mf[FH].toFixed(1), y: yQ(fc.mf[FH]) },
      { c: '#c9a15a', label: 'Arps ' + fc.arps[FH].toFixed(1), y: yQ(fc.arps[FH]) },
      { c: '#79828a', label: '实际 ' + fc.truth[FH].toFixed(1), y: yQ(fc.truth[FH]) }
    ];
    ends.sort(function (a2, b2) { return a2.y - b2.y; });
    for (var k2 = 1; k2 < ends.length; k2++) {
      if (ends[k2].y - ends[k2 - 1].y < 12) ends[k2].y = ends[k2 - 1].y + 12;
    }
    ends.forEach(function (e) {
      s += '<text x="' + (PL + PW + 6) + '" y="' + clamp(e.y, PT + 4, Y1 - 2).toFixed(1) + '" font-size="8.5" fill="' + e.c + '" font-family="monospace" font-weight="600">' + e.label + '</text>';
    });

    /* hover 十字线 */
    if (HOVER_T >= 0) {
      var hx = xT(HOVER_T);
      s += '<line x1="' + hx + '" y1="' + PT + '" x2="' + hx + '" y2="' + Y2B + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="2 2"/>';
      if (HOVER_T <= T0) {
        var kk = clamp(Math.round(HOVER_T / STEP), 0, NW - 1);
        s += '<circle cx="' + xT(kk * STEP) + '" cy="' + yQ(truthQ(w, kk * STEP, T0)) + '" r="3.4" fill="#2f3538" stroke="#fff" stroke-width="1.2"/>';
      } else {
        var hh = clamp(Math.round(HOVER_T - T0), 0, FH);
        s += '<circle cx="' + hx + '" cy="' + yQ(fc.mf[hh]) + '" r="3.4" fill="#2f7d6b" stroke="#fff" stroke-width="1.2"/>';
        s += '<circle cx="' + hx + '" cy="' + yQ(fc.truth[hh]) + '" r="3" fill="#79828a" stroke="#fff" stroke-width="1"/>';
        s += '<circle cx="' + hx + '" cy="' + yQ(fc.arps[hh]) + '" r="3" fill="#c9a15a" stroke="#fff" stroke-width="1"/>';
      }
    }

    svg.innerHTML = s;
  }

  function bindFc(fc) {
    var svg = $('fc'), tip = $('fc-tip'), box = $('fc-box'), w = WELLS[S.well], T0 = S.origin;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (FC_W / r.width);
      if (vx < PL || vx > PL + PW) { HOVER_T = -1; tip.style.display = 'none'; drawFc(fc); return; }
      var t = clamp(Math.round((vx - PL) / PW * NDAYS), 0, NDAYS);
      HOVER_T = t;
      drawFc(fc);
      var rb = box.getBoundingClientRect(), html;
      if (t <= T0) {
        var kk = clamp(Math.round(t / STEP), 0, NW - 1);
        html = '第 <b>' + (kk * STEP) + '</b> 天（' + (kk * STEP / 364).toFixed(2) + ' 年）· 历史<br>' +
          '日产油 <b>' + truthQ(w, kk * STEP, T0).toFixed(1) + '</b> t/d<br>' +
          '含水 <b>' + (truthFw(w, kk * STEP, T0) * 100).toFixed(1) + '</b> %';
      } else {
        var hh = clamp(t - T0, 0, FH);
        html = '第 <b>' + (T0 + hh) + '</b> 天（预测 +' + hh + ' 天）<br>' +
          '未来实际 <b>' + fc.truth[hh].toFixed(1) + '</b> t/d<br>' +
          '模型预测 <b>' + fc.mf[hh].toFixed(1) + '</b> t/d<br>' +
          '置信带 [' + fc.lo[hh].toFixed(1) + ', ' + fc.hi[hh].toFixed(1) + ']<br>' +
          '<span style="color:#9a7a1c">Arps 参考 ' + fc.arps[hh].toFixed(1) + ' t/d</span>';
      }
      tip.innerHTML = html;
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 100) + 'px';
    });
    svg.addEventListener('mouseleave', function () { HOVER_T = -1; tip.style.display = 'none'; drawFc(fc); });
  }

  /* ---------- ② 措施增油归因瀑布 ---------- */
  var WF_W = 450, WF_H = 240, WF_PL = 46, WF_PR = 12, WF_PT = 30, WF_PB = 34;
  var WF_SEL = -1;

  function drawWf(fc) {
    var svg = $('wf'), at = fc.attr;
    var pw = WF_W - WF_PL - WF_PR, ph = WF_H - WF_PT - WF_PB;
    var cols = [
      { name: '反事实基线', v: at.base, kind: 'abs', c: '#8a9298', desc: '屏蔽事件通道后的无措施递减基线（90 天平均）' },
      { name: '措施增油', v: at.ev, kind: 'delta', c: '#2f7d6b', desc: '压裂/堵水/酸化事件协变量贡献（反事实差值）' },
      { name: '注水见效', v: at.ramp, kind: 'delta', c: '#41699b', desc: '邻井注水滞后响应贡献（注采连通协变量）' },
      { name: '拟合残差', v: at.resid, kind: 'delta', c: '#c9a15a', desc: '计量噪声与未建模扰动' },
      { name: '实际平均', v: at.actual, kind: 'abs', c: '#235f51', desc: '90 天窗口实际平均日产油' }
    ];
    var cum = 0, top = 0;
    cols.forEach(function (c2) {
      if (c2.kind === 'abs') { c2.y0 = 0; c2.y1 = c2.v; cum = c2.v; }
      else { c2.y0 = cum; c2.y1 = cum + c2.v; cum = c2.y1; }
      top = Math.max(top, c2.y0, c2.y1);
    });
    var ymax = Math.max(top, at.actual) * 1.15;
    function yV(v) { return WF_PT + ph - v / ymax * ph; }

    var s = '<rect width="' + WF_W + '" height="' + WF_H + '" fill="#fdfcf9"/>';
    var gstep = ymax / 4;
    for (var g = 0; g <= 4; g++) {
      var gv = g * gstep, gy = yV(gv);
      s += '<line x1="' + WF_PL + '" y1="' + gy + '" x2="' + (WF_PL + pw) + '" y2="' + gy + '" stroke="#efece1"/>';
      s += '<text x="' + (WF_PL - 5) + '" y="' + (gy + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gv.toFixed(0) + '</text>';
    }
    s += '<text x="' + (WF_PL - 36) + '" y="' + (WF_PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (WF_PL - 36) + ' ' + (WF_PT + ph / 2) + ')">日产油 (t/d)</text>';
    s += '<text x="' + (WF_PL + 4) + '" y="' + (WF_PT - 18) + '" font-size="9" fill="#8a9298">反事实对比：屏蔽事件通道 vs 实际（90 天平均日产）</text>';

    var bw = Math.min(52, pw / cols.length * 0.62);
    var prevTop = null;
    cols.forEach(function (c2, i) {
      var cx = WF_PL + pw * (i + 0.5) / cols.length;
      var yA = yV(Math.max(c2.y0, c2.y1)), yB = yV(Math.min(c2.y0, c2.y1));
      var sel = WF_SEL === i;
      s += '<rect data-col="' + i + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + yA.toFixed(1) + '" width="' + bw + '" height="' + Math.max(1.5, yB - yA).toFixed(1) + '" rx="3" fill="' + c2.c + '" opacity="' + (sel ? 1 : 0.82) + '" stroke="' + (sel ? '#2f3538' : 'none') + '" stroke-width="' + (sel ? 1.4 : 0) + '" style="cursor:pointer"/>';
      /* 瀑布连接虚线 */
      if (prevTop !== null) {
        var x0 = WF_PL + pw * (i - 0.5) / cols.length + bw / 2;
        s += '<line x1="' + x0.toFixed(1) + '" y1="' + prevTop.toFixed(1) + '" x2="' + (cx - bw / 2).toFixed(1) + '" y2="' + prevTop.toFixed(1) + '" stroke="#b9b2a2" stroke-width="0.8" stroke-dasharray="3 2"/>';
      }
      prevTop = yV(c2.y1);
      /* 数值标签 */
      var vl = c2.kind === 'abs' ? c2.v.toFixed(1) : ((c2.v < 0 ? '−' : '+') + Math.abs(c2.v).toFixed(1));
      s += '<text x="' + cx.toFixed(1) + '" y="' + (yA - 5).toFixed(1) + '" font-size="9.5" fill="' + c2.c + '" text-anchor="middle" font-family="monospace" font-weight="600">' + vl + '</text>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (WF_PT + ph + 14) + '" font-size="9" fill="#5d666d" text-anchor="middle">' + c2.name + '</text>';
    });
    s += '<text x="' + (WF_PL + pw / 2) + '" y="' + (WF_H - 2) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle">90 天窗口（第 ' + S.origin + '–' + (S.origin + FH) + ' 天）· 悬停柱条查看口径</text>';
    svg.innerHTML = s;

    Array.prototype.forEach.call(svg.querySelectorAll('rect[data-col]'), function (el) {
      el.addEventListener('mousemove', function (evt) {
        var i = +el.getAttribute('data-col');
        if (WF_SEL !== i) { WF_SEL = i; drawWf(fc); }
        var c2 = cols[i], tip = $('wf-tip'), box = $('wf-box'), rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + c2.name + '</b>：' + (c2.kind === 'abs' ? c2.v.toFixed(2) : f2(c2.v)) + ' t/d<br><span style="color:#8a9298">' + c2.desc + '</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 64) + 'px';
      });
      el.addEventListener('mouseleave', function () { WF_SEL = -1; $('wf-tip').style.display = 'none'; drawWf(fc); });
    });
  }

  /* ---------- ③ 分层 MAPE 对比 ---------- */
  var ER_W = 450, ER_H = 240, ER_PL = 38, ER_PR = 12, ER_PT = 26, ER_PB = 34;
  var LAYERS = [
    { name: '正常递减井', arps: 9.8, model: 6.9 },
    { name: '措施后井', arps: 27.4, model: 14.1 },
    { name: '注水受效井', arps: 18.2, model: 11.3 }
  ];

  function drawErr(fc) {
    var svg = $('err'), w = WELLS[S.well];
    var pw = ER_W - ER_PL - ER_PR, ph = ER_H - ER_PT - ER_PB;
    var ymax = 30;
    function yV(v) { return ER_PT + ph - v / ymax * ph; }

    var s = '<rect width="' + ER_W + '" height="' + ER_H + '" fill="#fdfcf9"/>';
    [0, 10, 20, 30].forEach(function (g) {
      s += '<line x1="' + ER_PL + '" y1="' + yV(g) + '" x2="' + (ER_PL + pw) + '" y2="' + yV(g) + '" stroke="#efece1"/>';
      s += '<text x="' + (ER_PL - 5) + '" y="' + (yV(g) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + g + '</text>';
    });
    s += '<text x="' + (ER_PL - 28) + '" y="' + (ER_PT + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (ER_PL - 28) + ' ' + (ER_PT + ph / 2) + ')">MAPE (%)</text>';
    s += '<text x="' + (ER_PL + 4) + '" y="' + (ER_PT - 16) + '" font-size="9" fill="#8a9298">金=Arps 基线 · 绿=TCN+事件协变量（区块 118 井口径）· ◆=本井实测</text>';

    var bw = 30;
    LAYERS.forEach(function (L, i) {
      var gx = ER_PL + pw * (i + 0.5) / LAYERS.length;
      [ { v: L.arps, c: '#c9a15a', dx: -bw / 2 - 3 },
        { v: L.model, c: '#2f7d6b', dx: bw / 2 + 3 } ].forEach(function (bar) {
        var bx = gx + bar.dx - bw / 2, by = yV(bar.v);
        s += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw + '" height="' + (yV(0) - by).toFixed(1) + '" rx="3" fill="' + bar.c + '" opacity="0.82"/>';
        s += '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by - 4).toFixed(1) + '" font-size="9" fill="' + bar.c + '" text-anchor="middle" font-family="monospace" font-weight="600">' + bar.v.toFixed(1) + '</text>';
      });
      s += '<text x="' + gx.toFixed(1) + '" y="' + (ER_PT + ph + 14) + '" font-size="9" fill="#5d666d" text-anchor="middle">' + L.name + '</text>';
    });

    /* 本井实测菱形：措施井/堵水井落在「措施后井」组 */
    var gi = w.kind === '正常递减井' ? 0 : 1;
    var gx2 = ER_PL + pw * (gi + 0.5) / LAYERS.length;
    function diamond(x, y, c) {
      return '<path d="M ' + x + ' ' + (y - 5.5) + ' L ' + (x + 5.5) + ' ' + y + ' L ' + x + ' ' + (y + 5.5) + ' L ' + (x - 5.5) + ' ' + y + ' Z" fill="' + c + '" stroke="#2f3538" stroke-width="1"/>';
    }
    var ya = yV(clamp(fc.mapeA, 0, ymax)), ym = yV(clamp(fc.mapeM, 0, ymax));
    s += diamond(gx2 - bw / 2 - 3, ya, '#e8c98a');
    s += diamond(gx2 + bw / 2 + 3, ym, '#5aa892');
    var lx = clamp(gx2 + bw + 12, ER_PL + 60, ER_PL + pw - 66);
    s += '<text x="' + lx + '" y="' + (ym - 8) + '" font-size="8.5" fill="#235f51" font-family="monospace" font-weight="600">本井 ' + fc.mapeM.toFixed(1) + '%</text>';
    s += '<text x="' + lx + '" y="' + clamp(ya + 14, ER_PT + 10, ER_PT + ph - 2) + '" font-size="8.5" fill="#9a7a1c" font-family="monospace">Arps ' + fc.mapeA.toFixed(1) + '%</text>';

    s += '<text x="' + (ER_PL + pw / 2) + '" y="' + (ER_H - 2) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle">90 天逐日 MAPE · 分层口径（评估必须分层，防平均数掩盖措施井）</text>';
    svg.innerHTML = s;
  }

  /* ---------- 指标与结论 ---------- */
  function renderMetrics(fc) {
    var w = WELLS[S.well];
    $('m-mape').innerHTML = fc.mapeM.toFixed(1) + '<small> %</small>';
    $('m-mape').parentNode.className = 'mcard' + (fc.mapeM > 15 ? ' bad' : (fc.mapeM > 8 ? ' warn' : ''));
    $('m-arps').innerHTML = fc.mapeA.toFixed(1) + '<small> %</small>';
    $('m-arps').parentNode.className = 'mcard' + (fc.mapeA > 20 ? ' bad' : (fc.mapeA > 10 ? ' warn' : ''));
    $('m-cum').innerHTML = fc.cumErr.toFixed(1) + '<small> %</small>';
    $('m-cum').parentNode.className = 'mcard' + (fc.cumErr > 10 ? ' bad' : (fc.cumErr > 6 ? ' warn' : ''));
    if (fc.attr.cumOil < 5) {
      $('m-attr').innerHTML = '≈ 0<small> 无措施</small>';
      $('m-attr').parentNode.className = 'mcard';
    } else {
      $('m-attr').innerHTML = Math.round(fc.attr.cumOil) + '<small> t</small>';
      $('m-attr').parentNode.className = 'mcard';
    }

    var v = $('verdict'), T0 = S.origin;
    if (w.kind === '正常递减井') {
      v.className = 'verdict ok';
      v.innerHTML = '井 <b>' + w.name + '</b>（正常递减井）：预测起点第 <b>' + T0 + '</b> 天，模型 90 天 MAPE <b>' + fc.mapeM.toFixed(1) + '%</b>，Arps <b>' + fc.mapeA.toFixed(1) + '%</b>——正常递减段两者都在 10% 门槛内，Arps 可作廉价基线；无措施事件，归因增油 ≈ 0。';
    } else if (w.kind === '压裂井') {
      v.className = 'verdict warn';
      v.innerHTML = '井 <b>' + w.name + '</b>（压裂井）：第 <b>' + (T0 + 35) + '</b> 天计划压裂。Arps 纯递减无法预见措施，90 天 MAPE 放大到 <b>' + fc.mapeA.toFixed(1) + '%</b>；模型把措施计划编码为事件协变量，MAPE 压到 <b>' + fc.mapeM.toFixed(1) + '%</b>（≤15% 门槛），归因措施增油 <b>' + Math.round(fc.attr.cumOil) + ' t</b>（按低估系数 0.88 留保守余量）。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = '井 <b>' + w.name + '</b>（堵水井）：第 <b>' + (T0 + 28) + '</b> 天计划堵水、第 <b>' + (T0 + 55) + '</b> 天起注水见效。Arps MAPE <b>' + fc.mapeA.toFixed(1) + '%</b> 失效；模型 MAPE <b>' + fc.mapeM.toFixed(1) + '%</b>，归因分解：措施增油 <b>' + Math.round(fc.attr.cumOil) + ' t</b>、注水见效 <b>' + (fc.attr.ramp * FH).toFixed(0) + ' t</b>——上报配产时须分列「递减规律」与「措施贡献」。';
    }
  }

  /* ---------- 绑定与渲染 ---------- */
  var OUT = {
    origin: function (v) { return '第 ' + v + ' 天'; },
    conf: function (v) { return v + ' %'; }
  };
  var KEYS = ['origin', 'conf'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function render() {
    HOVER_T = -1; WF_SEL = -1;
    var fc = buildForecast(WELLS[S.well]);
    drawFc(fc);
    bindFc(fc);
    drawWf(fc);
    drawErr(fc);
    renderMetrics(fc);
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
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      syncSliders();
      updateWellBtns();
      render();
    });
  }

  loadState();
  bindWellBtns();
  bind();
  syncSliders();
  render();
})();

/* ======= 单井产量智能预测 · 真实数据来源页 ======= */
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

  /* ① Arps 递减类型曲线（canvas，HiDPI） */
  var DC_W = 880, DC_H = 210, DC_PL = 44, DC_PR = 96, DC_PT = 16, DC_PB = 30;
  function drawDecline() {
    var cv = document.getElementById('lit-decline'); if (!cv) return;
    var ctx = setupCanvas(cv, DC_W, DC_H);
    var pw = DC_W - DC_PL - DC_PR, ph = DC_H - DC_PT - DC_PB;
    var T = 3; /* 年 */
    var D = 0.8;
    var series = [
      { fn: function (t) { return Math.exp(-D * t); }, c: '#2f7d6b', label: '指数 b=0' },
      { fn: function (t) { return Math.pow(1 + 0.5 * D * t, -2); }, c: '#c9a15a', label: '双曲 b=0.5' },
      { fn: function (t) { return 1 / (1 + D * t); }, c: '#b05a51', label: '调和 b=1' }
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
    ctx.fillText('Arps (1945) · q = q_i/(1+b·D_i·t)^(1/b) · D_i = 0.8/年（示意）', DC_PL + 4, DC_PT + 12);
  }

  /* ② 双曲指数 b 取值区间图 */
  var B_ZONES = [
    { a: 0, b: 0.5, c: '#2f7d6b', label: '0<b≤0.5 水驱/溶解气驱最常见', tip: 'Fetkovich (1980, SPE-6849-PA) 图版族：多数水驱/溶解气驱油田 BDF 段拟合 b 落在 0–0.5' },
    { a: 0.5, b: 1, c: '#c9a15a', label: '0.5<b<1 双曲段', tip: 'Arps (1945)：双曲递减 0<b<1；强非均质或重力/弹性驱动贡献偏大' },
    { a: 1, b: 1.5, c: '#b05a51', label: 'b>1 瞬态流 · 勿外推', tip: 'Ilk et al. (2008, SPE-116731)：b>1 是瞬态流段特征，按双曲外推系统性高估 EUR' }
  ];
  function drawB() {
    var svg = document.getElementById('lit-b'); if (!svg) return;
    var W = 880, H = 170, pl = 40, pr = 24, pw = W - pl - pr;
    var X0 = -0.12, X1 = 1.62;
    function xOf(v) { return pl + (v - X0) / (X1 - X0) * pw; }
    var y0 = 72, bh = 30;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);

    B_ZONES.forEach(function (z, i) {
      el('rect', { 'data-zone': i, x: xOf(z.a), y: y0, width: xOf(z.b) - xOf(z.a), height: bh, fill: z.c, opacity: 0.6, style: 'cursor:pointer' }, svg);
      txt((xOf(z.a) + xOf(z.b)) / 2, y0 + bh / 2 + 3.5, z.label, { 'font-size': 9.5, fill: '#fff', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
    });
    /* b=0 与 b=1 标志线 */
    el('line', { x1: xOf(0), y1: y0 - 8, x2: xOf(0), y2: y0 + bh, stroke: '#2f7d6b', 'stroke-width': 2 }, svg);
    txt(xOf(0), y0 - 12, 'b=0 指数', { 'font-size': 9, fill: '#235f51', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
    el('line', { x1: xOf(1), y1: y0 - 8, x2: xOf(1), y2: y0 + bh, stroke: '#b05a51', 'stroke-width': 2 }, svg);
    txt(xOf(1), y0 - 12, 'b=1 调和', { 'font-size': 9, fill: '#b05a51', 'text-anchor': 'middle', 'font-weight': 600 }, svg);

    [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5].forEach(function (v) {
      el('line', { x1: xOf(v), y1: y0 + bh, x2: xOf(v), y2: y0 + bh + 5, stroke: '#8a9298', 'stroke-width': 1 }, svg);
      txt(xOf(v), y0 + bh + 16, v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0'), { 'font-size': 9, fill: '#79828a', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    });
    txt(pl + pw / 2, H - 6, '双曲递减指数 b（—）· Arps 1945 / Fetkovich 1980 口径 · Ilk et al. 2008 瞬态流判读', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);

    /* 本案例 118 井拟合范围括线（案例口径） */
    var ax0 = xOf(0.31), ax1 = xOf(0.55), ay = y0 - 30;
    el('line', { x1: ax0, y1: ay, x2: ax1, y2: ay, stroke: '#c9a15a', 'stroke-width': 2.2 }, svg);
    el('line', { x1: ax0, y1: ay - 5, x2: ax0, y2: ay + 5, stroke: '#c9a15a', 'stroke-width': 2 }, svg);
    el('line', { x1: ax1, y1: ay - 5, x2: ax1, y2: ay + 5, stroke: '#c9a15a', 'stroke-width': 2 }, svg);
    txt((ax0 + ax1) / 2, ay - 8, '本案例 118 井拟合 b：P25–P75 = 0.31–0.55（中位 0.42）', { 'font-size': 9, fill: '#9a7a1c', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
    txt(pl + 2, 16, 'b 越接近 0 越接近指数（BDF 长期解）；b>1 提示数据仍在瞬态流段（Ilk 2008）', { 'font-size': 9, fill: '#8a9298' }, svg);

    Array.prototype.forEach.call(svg.querySelectorAll('rect[data-zone]'), function (rect) {
      rect.addEventListener('mousemove', function (evt) {
        var z = B_ZONES[+rect.getAttribute('data-zone')];
        var tip = document.getElementById('b-tip'), box = document.getElementById('b-box'), rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>b ∈ [' + z.a + ', ' + z.b + ')</b><br><span style="color:#8a9298">' + z.tip + '</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 250) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 60) + 'px';
      });
      rect.addEventListener('mouseleave', function () { document.getElementById('b-tip').style.display = 'none'; });
    });
  }

  /* ③ 公开实测 MAPE 对比 */
  var ML = [
    { name: 'Arps 递减基线 · 本案例 118 井', mape: 13.6, c: '#c9a15a', src: '案例口径', tip: '案例库业务口径：松辽盆地某老区 118 井，Arps 双曲拟合 90 天逐日 MAPE 13.6%（措施井 27.4%）' },
    { name: 'TCN + 事件协变量 · 本案例', mape: 8.2, c: '#2f7d6b', src: '案例口径', tip: '案例库业务口径：TCN+事件脉冲通道（540 天窗口、跨井 pooling），全井 MAPE 8.2%（正常井 6.9%）' },
    { name: '措施后井子集 · 本案例', mape: 14.1, c: '#b05a51', src: '案例口径', tip: '案例库业务口径：措施后井 90 天 MAPE 14.1%（≤15% 门槛），Arps 同子集 27.4%' },
    { name: 'CNN–BiLSTM · Zhang 2025（长7页岩油）', mape: 3.23, c: '#41699b', src: 'ACS Omega', tip: 'Zhang et al. (2025) ACS Omega 11(1):2206–2220：鄂尔多斯长 7 段 42 口水平井，MAPE 3.2333%、R² 0.8856，优于 SVR/RF/XGBoost/LSTM/BiLSTM' }
  ];
  function drawML() {
    var svg = document.getElementById('lit-ml'); if (!svg) return;
    var W = 880, H = 210, pl = 252, pr = 96, pt = 26, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var X1 = 16;
    function xOf(v) { return pl + v / X1 * pw; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var g = 0; g <= X1; g += 4) {
      el('line', { x1: xOf(g), y1: pt, x2: xOf(g), y2: pt + ph, stroke: g ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(xOf(g), pt + ph + 14, g + '%', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    }
    txt(pl + pw / 2, H - 4, '90 天（或文献对应窗口）逐日产量预测 MAPE（%）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    /* 15% 措施井门槛线 */
    el('line', { x1: xOf(15), y1: pt, x2: xOf(15), y2: pt + ph, stroke: '#b05a51', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }, svg);
    txt(xOf(15) + 4, pt + 10, '措施井门槛 15%', { 'font-size': 9, fill: '#b05a51' }, svg);

    var rowH = ph / ML.length, barH = Math.min(22, rowH * 0.52);
    ML.forEach(function (d, i) {
      var cy = pt + rowH * (i + 0.5);
      el('rect', { 'data-row': i, x: pl, y: cy - barH / 2, width: xOf(d.mape) - pl, height: barH, rx: 3, fill: d.c, opacity: 0.85, style: 'cursor:pointer' }, svg);
      txt(pl - 8, cy + 3.5, d.name, { 'font-size': 9.5, fill: '#4d565b', 'text-anchor': 'end' }, svg);
      txt(xOf(d.mape) + 6, cy + 3.5, d.mape.toFixed(2) + '%', { 'font-size': 10, fill: d.c, 'font-family': 'Consolas, monospace', 'font-weight': 700 }, svg);
      txt(W - 8, cy + 3.5, d.src, { 'font-size': 9, fill: '#9ba3a9', 'text-anchor': 'end' }, svg);
    });

    Array.prototype.forEach.call(svg.querySelectorAll('rect[data-row]'), function (rect) {
      rect.addEventListener('mousemove', function (evt) {
        var d = ML[+rect.getAttribute('data-row')];
        var tip = document.getElementById('ml-tip'), box = document.getElementById('ml-box'), rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + d.name + '</b>：MAPE <b>' + d.mape.toFixed(2) + '%</b><br><span style="color:#8a9298">' + d.tip + '</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 260) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 66) + 'px';
      });
      rect.addEventListener('mouseleave', function () { document.getElementById('ml-tip').style.display = 'none'; });
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
  drawDecline();
  drawB();
  drawML();
})();
