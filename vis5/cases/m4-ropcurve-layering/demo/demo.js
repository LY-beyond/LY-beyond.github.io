/* ======= 钻时曲线地层智能划分 · 可运行示范 ======= */
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

  /* ---------- 配色（岩性） ---------- */
  var LITHO_COLOR = { '砂岩': '#c9a15a', '泥岩': '#79828a', '灰岩': '#41699b', '泥灰岩': '#b05a51' };
  function tint(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---------- 合成井数据（2100–2600 m，0.5 m 一点，种子确定性） ---------- */
  var D0 = 2100, D1 = 2600, STEP = 0.5;
  var N = Math.round((D1 - D0) / STEP); /* 1000 区间，1001 点 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20261030);
  function randn() {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* 真实地层：上界深度→岩性/钻时基值/伽马基值（泥岩→泥灰岩为弱界面，仅 +9%） */
  var TRUE_LAYERS = [
    { to: 2180, litho: '泥岩', rop: 8.0, gr: 105 },
    { to: 2255, litho: '砂岩', rop: 17.0, gr: 48 },
    { to: 2310, litho: '泥岩', rop: 9.0, gr: 100 },
    { to: 2365, litho: '灰岩', rop: 26.0, gr: 22 },
    { to: 2430, litho: '泥岩', rop: 10.0, gr: 110 },
    { to: 2470, litho: '泥灰岩', rop: 10.9, gr: 62 },
    { to: 2540, litho: '砂岩', rop: 16.0, gr: 50 },
    { to: 2600, litho: '灰岩', rop: 24.0, gr: 25 }
  ];
  var TRUE_BOUNDS = [2180, 2255, 2310, 2365, 2430, 2470, 2540];

  function trueLayerAt(d) {
    for (var i = 0; i < TRUE_LAYERS.length; i++) if (d < TRUE_LAYERS[i].to) return TRUE_LAYERS[i];
    return TRUE_LAYERS[TRUE_LAYERS.length - 1];
  }
  function wearAt(d) { return 1 + 0.22 * (d - D0) / (D1 - D0); } /* 钻头磨损：全井段钻时抬升 22% */
  function compactionAt(d, litho) { /* 泥岩/泥灰岩随深度压实变硬 */
    return (litho === '泥岩' || litho === '泥灰岩') ? 1 + 0.15 * (d - D0) / (D1 - D0) : 1;
  }

  var dep = [], ropRaw = [], ropNorm = [], grv = [], dcv = [];
  var wobv = [], rpmv = [];
  (function gen() {
    var ar1 = 0, ar2 = 0;
    for (var i = 0; i <= N; i++) {
      var d = D0 + i * STEP;
      var L = trueLayerAt(d);
      ar1 = 0.55 * ar1 + randn(); /* 自相关噪声 */
      var base = L.rop * compactionAt(d, L.litho) * wearAt(d);
      var rop = base * (1 + 0.055 * ar1) + 0.9 * ar1;
      rop = Math.max(2.5, rop);
      dep.push(d);
      ropRaw.push(rop);
      ropNorm.push(rop / wearAt(d));
      var wob = 100 + 8 * Math.sin(d / 97) + 2.5 * randn();
      var rpm = 75 + 6 * Math.sin(d / 63) + 2 * randn();
      wobv.push(wob); rpmv.push(rpm);
      /* dc = lg(R/60N)/lg(12W/10^6 D) · (ρn/ρe)，R 单位 m/h，W 单位 N，D = 215.9 mm */
      var R = 60 / rop;
      var dd = Math.log(R / (60 * rpm)) / Math.LN10 / (Math.log(12 * wob * 1000 / (1e6 * 215.9)) / Math.LN10);
      dcv.push(dd * (1.0 / 1.18));
      ar2 = 0.6 * ar2 + randn();
      grv.push(Math.max(5, L.gr + 7 * ar2));
    }
  })();

  /* NCT：泥岩段 dc—深度线性回归 */
  var nctA = 0, nctB = 0;
  (function fitNCT() {
    var sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    for (var i = 0; i <= N; i++) {
      var L = trueLayerAt(dep[i]);
      if (L.litho !== '泥岩') continue;
      var x = dep[i], y = dcv[i];
      sx += x; sy += y; sxx += x * x; sxy += x * y; n++;
    }
    nctB = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    nctA = (sy - nctB * sx) / n;
  })();
  function nctAt(d) { return nctA + nctB * d; }

  /* ---------- 状态 ---------- */
  var DEF = { k: 8, minlen: 12, conf: 0.55, norm: 1, cursor: 2240 };
  var S = Object.assign({}, DEF);
  var hoverDepth = null;

  /* ---------- 变点分层：1 m 重采样 + 动态规划最优 K 段划分 ---------- */
  var segs = []; /* {i0,i1 (0.5m 样本下标), mean, std, litho} */
  var bounds = []; /* {depth, conf} */

  function meanStd(arr, i0, i1) {
    var s = 0, s2 = 0, n = i1 - i0, i;
    for (i = i0; i < i1; i++) { s += arr[i]; s2 += arr[i] * arr[i]; }
    var m = s / n, v = Math.max(1e-6, s2 / n - m * m);
    return { m: m, sd: Math.sqrt(v), n: n };
  }

  function classifyLitho(meanNorm) {
    if (meanNorm < 11) return '泥岩';
    if (meanNorm < 13.5) return '泥灰岩';
    if (meanNorm < 21) return '砂岩';
    return '灰岩';
  }

  function resegment() {
    var sig = S.norm ? ropNorm : ropRaw;
    /* 1 m 重采样 */
    var n1 = Math.floor((D1 - D0) / 1); /* 500 */
    var sig1 = new Float64Array(n1);
    for (var i = 0; i < n1; i++) sig1[i] = (sig[i * 2] + sig[i * 2 + 1]) / 2;
    var K = S.k, L = Math.max(2, Math.round(S.minlen));
    var INF = Infinity;
    var S1 = new Float64Array(n1 + 1), S2 = new Float64Array(n1 + 1);
    for (i = 0; i < n1; i++) { S1[i + 1] = S1[i] + sig1[i]; S2[i + 1] = S2[i] + sig1[i] * sig1[i]; }
    function cost(a, b) { var m = b - a, s = S1[b] - S1[a]; return (S2[b] - S2[a]) - s * s / m; }
    var dp = [], par = [], k, j;
    for (k = 0; k <= K; k++) { dp.push(new Float64Array(n1 + 1)); par.push(new Int32Array(n1 + 1)); }
    for (j = 1; j <= n1; j++) dp[0][j] = INF;
    for (k = 1; k <= K; k++) {
      for (j = 0; j < k * L; j++) { dp[k][j] = INF; par[k][j] = -1; }
      for (j = k * L; j <= n1; j++) {
        var best = INF, bi = -1;
        var iMin = (k - 1) * L, iMax = j - L;
        for (var ii = iMin; ii <= iMax; ii++) {
          var prev = dp[k - 1][ii];
          if (prev === INF) continue;
          var c = prev + cost(ii, j);
          if (c < best) { best = c; bi = ii; }
        }
        dp[k][j] = best; par[k][j] = bi;
      }
    }
    /* 回溯边界（1 m 下标） */
    var cuts = [], jj = n1;
    for (k = K; k >= 1; k--) { var pp = par[k][jj]; if (pp > 0) cuts.push(pp); jj = pp; }
    cuts.reverse();

    /* 生成段（0.5 m 分辨率统计） */
    segs = [];
    var idx = [0].concat(cuts).concat([n1]);
    for (k = 0; k < idx.length - 1; k++) {
      var i0 = idx[k] * 2, i1 = Math.min(N + 1, idx[k + 1] * 2);
      if (k === idx.length - 2) i1 = N + 1;
      var st = meanStd(sig, i0, i1);
      segs.push({
        i0: i0, i1: i1,
        d0: dep[i0], d1: dep[Math.min(i1 - 1, N)],
        mean: st.m, sd: st.sd, n: st.n,
        litho: classifyLitho(st.m)
      });
    }
    /* 界面置信度：相邻段均值差的标准化统计量 */
    bounds = [];
    for (k = 0; k < segs.length - 1; k++) {
      var a = segs[k], b = segs[k + 1];
      var z = Math.abs(b.mean - a.mean) / Math.sqrt(a.sd * a.sd / a.n + b.sd * b.sd / b.n + 1e-9);
      var conf = 1 - Math.exp(-Math.pow(z / 3, 1.2));
      bounds.push({ depth: dep[b.i0], conf: clamp(conf, 0.01, 0.99), segL: k, segR: k + 1 });
    }
  }

  function liveBounds() { return bounds.filter(function (b) { return b.conf >= S.conf; }); }

  /* ±1 m 容差与真实界面匹配 */
  function matchStats() {
    var live = liveBounds();
    var usedT = {}, usedB = {}, pairs = [];
    /* 贪心：按距离升序匹配 */
    var cand = [];
    TRUE_BOUNDS.forEach(function (t, ti) {
      live.forEach(function (b, bi) {
        var d = Math.abs(b.depth - t);
        if (d <= 1.0) cand.push({ t: t, ti: ti, bi: bi, d: d });
      });
    });
    cand.sort(function (a, b) { return a.d - b.d; });
    cand.forEach(function (c) {
      if (usedT[c.ti] || usedB[c.bi]) return;
      usedT[c.ti] = usedB[c.bi] = true;
      pairs.push(c);
    });
    var hitT = Object.keys(usedT).length;
    var err = pairs.length ? pairs.reduce(function (s, p) { return s + p.d; }, 0) / pairs.length : null;
    return {
      live: live, hitT: hitT,
      rec: hitT / TRUE_BOUNDS.length,
      pre: live.length ? pairs.length / live.length : 0,
      err: err,
      meanConf: live.length ? live.reduce(function (s, b) { return s + b.conf; }, 0) / live.length : 0
    };
  }

  function segAtDepth(d) {
    for (var i = 0; i < segs.length; i++) if (d < segs[i].d1 || i === segs.length - 1) return segs[i];
    return segs[segs.length - 1];
  }
  function nearestBound(d) {
    var best = null, bd = 1e9;
    bounds.forEach(function (b) {
      var dd = Math.abs(b.depth - d);
      if (dd < bd) { bd = dd; best = b; }
    });
    return { b: best, dist: bd };
  }
  function confColor(c) { return c >= 0.75 ? '#2f7d6b' : (c >= 0.5 ? '#c9a15a' : '#b05a51'); }

  /* ---------- 通用坐标 ---------- */
  var LW = 460;
  var FONT = '10px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';
  var MONO = '10px Consolas, "Courier New", monospace';
  function xOf(d, L, W) { return L + (d - D0) / (D1 - D0) * W; }
  function depthOf(x, L, W) { return D0 + (x - L) / W * (D1 - D0); }
  var effCursor = function () { return hoverDepth != null ? hoverDepth : S.cursor; };

  function drawXAxis(ctx, L, T, W, H, yBase) {
    ctx.strokeStyle = '#d8d2c2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + H); ctx.lineTo(L + W, T + H); ctx.stroke();
    ctx.font = MONO; ctx.fillStyle = '#8a9298'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var d = D0; d <= D1; d += 100) {
      var x = xOf(d, L, W);
      ctx.strokeStyle = '#ece6d8';
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + H); ctx.stroke();
      ctx.fillText(String(d), x, yBase);
    }
    ctx.fillStyle = '#9ba3a9'; ctx.font = FONT;
    ctx.fillText('井深 (m)', L + W / 2, yBase + 11);
  }
  function drawCursor(ctx, L, T, W, H) {
    var d = effCursor();
    var x = xOf(d, L, W);
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + H); ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawBoundsOn(ctx, L, T, W, H, withLabel) {
    bounds.forEach(function (b) {
      var x = xOf(b.depth, L, W);
      ctx.strokeStyle = confColor(b.conf); ctx.lineWidth = 1;
      ctx.setLineDash(b.conf >= S.conf ? [5, 3] : [2, 3]);
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + H); ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  /* ---------- 图①：钻时曲线 + 分层 ---------- */
  var ROP_MAX = 32;
  function drawRop() {
    var cv = $('cv-rop'), LH = 232;
    var ctx = setupCanvas(cv, LW, LH);
    var L = 40, R = 8, T = 20, B = 26, W = LW - L - R, H = LH - T - B;
    function yOf(v) { return T + H * (1 - v / ROP_MAX); }
    ctx.clearRect(0, 0, LW, LH);

    /* 分层背景色带（判别岩性） */
    segs.forEach(function (sg) {
      var x0 = xOf(sg.d0, L, W), x1 = xOf(sg.d1, L, W);
      ctx.fillStyle = tint(LITHO_COLOR[sg.litho], 0.10);
      ctx.fillRect(x0, T, x1 - x0, H);
      if (x1 - x0 > 34) {
        ctx.font = FONT; ctx.fillStyle = tint(LITHO_COLOR[sg.litho], 0.85);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(sg.litho, (x0 + x1) / 2, T + H - 3);
      }
    });

    /* 层均值阶梯线 */
    ctx.strokeStyle = '#8a9298'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    segs.forEach(function (sg, i) {
      var x0 = xOf(sg.d0, L, W), x1 = xOf(sg.d1, L, W), y = yOf(sg.mean);
      if (i === 0) ctx.moveTo(x0, y); else ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
    });
    ctx.stroke();

    /* 钻时曲线 */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (var i = 0; i <= N; i++) {
      var x = xOf(dep[i], L, W), y = yOf(ropRaw[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    drawXAxis(ctx, L, T, W, H, T + H + 3);
    /* y 轴刻度 */
    ctx.font = MONO; ctx.fillStyle = '#8a9298'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var v = 0; v <= ROP_MAX; v += 8) {
      var yy = yOf(v);
      ctx.strokeStyle = '#ece6d8';
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + W, yy); ctx.stroke();
      ctx.fillText(String(v), L - 4, yy);
    }
    ctx.save();
    ctx.translate(10, T + H / 2); ctx.rotate(-Math.PI / 2);
    ctx.font = FONT; ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
    ctx.fillText('钻时 (min/m)', 0, 0);
    ctx.restore();

    /* 界面虚线 + 置信度标注（防重叠：两行轮换） */
    var lastX = [-1e9, -1e9];
    bounds.forEach(function (b) {
      var x = xOf(b.depth, L, W);
      ctx.strokeStyle = confColor(b.conf); ctx.lineWidth = 1;
      ctx.setLineDash(b.conf >= S.conf ? [5, 3] : [2, 3]);
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + H); ctx.stroke();
      ctx.setLineDash([]);
      var row = (x - lastX[0] > 26) ? 0 : (x - lastX[1] > 26 ? 1 : -1);
      if (row >= 0) {
        lastX[row] = x;
        ctx.font = MONO; ctx.fillStyle = confColor(b.conf);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(b.conf.toFixed(2), x, row === 0 ? T - 9 : T - 1);
      }
    });

    drawCursor(ctx, L, T, W, H);
  }

  /* ---------- 图②：dc 指数与 NCT ---------- */
  function drawDc() {
    var cv = $('cv-dc'), LH = 196;
    var ctx = setupCanvas(cv, LW, LH);
    var L = 40, R = 8, T = 8, B = 26, W = LW - L - R, H = LH - T - B;
    var lo = Infinity, hi = -Infinity, i;
    for (i = 0; i <= N; i += 2) { if (dcv[i] < lo) lo = dcv[i]; if (dcv[i] > hi) hi = dcv[i]; }
    lo = Math.max(0.4, Math.floor(lo * 10) / 10 - 0.05);
    hi = Math.min(2.4, Math.ceil(hi * 10) / 10 + 0.05);
    function yOf(v) { return T + H * (1 - (v - lo) / (hi - lo)); }
    ctx.clearRect(0, 0, LW, LH);

    drawXAxis(ctx, L, T, W, H, T + H + 3);
    ctx.font = MONO; ctx.fillStyle = '#8a9298'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    var step = (hi - lo) > 1 ? 0.4 : 0.2;
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      var yy = yOf(v);
      ctx.strokeStyle = '#ece6d8';
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + W, yy); ctx.stroke();
      ctx.fillText(v.toFixed(1), L - 4, yy);
    }
    ctx.save();
    ctx.translate(10, T + H / 2); ctx.rotate(-Math.PI / 2);
    ctx.font = FONT; ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
    ctx.fillText('dc 指数 (–)', 0, 0);
    ctx.restore();

    /* 检测界面 */
    drawBoundsOn(ctx, L, T, W, H, false);

    /* NCT 虚线 */
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xOf(D0, L, W), yOf(nctAt(D0)));
    ctx.lineTo(xOf(D1, L, W), yOf(nctAt(D1)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = FONT; ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('NCT', xOf(D0 + 6, L, W), yOf(nctAt(D0 + 6)) - 2);

    /* dc 曲线 */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (i = 0; i <= N; i++) {
      var x = xOf(dep[i], L, W), y = yOf(clamp(dcv[i], lo, hi));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    /* 泥岩点（用于 NCT 回归） */
    ctx.fillStyle = '#235f51';
    for (i = 0; i <= N; i += 6) {
      if (trueLayerAt(dep[i]).litho !== '泥岩') continue;
      ctx.fillRect(xOf(dep[i], L, W) - 0.8, yOf(dcv[i]) - 0.8, 1.6, 1.6);
    }

    drawCursor(ctx, L, T, W, H);
  }

  /* ---------- 图③：岩性柱 + 伽马 ---------- */
  function drawGr() {
    var cv = $('cv-gr'), LH = 196;
    var ctx = setupCanvas(cv, LW, LH);
    var L = 40, R = 8, T = 8, B = 26, W = LW - L - R;
    var stripH = 9, stripGap = 3, plotT = T + stripH * 2 + stripGap + 8, H = LH - plotT - B;
    function yOf(v) { return plotT + H * (1 - v / 150); }
    ctx.clearRect(0, 0, LW, LH);

    /* 岩性柱：上=判别，下=真实 */
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#8a9298'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('判别', 4, T + stripH / 2);
    ctx.fillText('真实', 4, T + stripH + stripGap + stripH / 2);
    segs.forEach(function (sg) {
      ctx.fillStyle = LITHO_COLOR[sg.litho];
      ctx.fillRect(xOf(sg.d0, L, W), T, xOf(sg.d1, L, W) - xOf(sg.d0, L, W), stripH);
    });
    TRUE_LAYERS.forEach(function (ly, i) {
      var d0 = i === 0 ? D0 : TRUE_LAYERS[i - 1].to, d1 = ly.to;
      ctx.fillStyle = LITHO_COLOR[ly.litho];
      ctx.fillRect(xOf(d0, L, W), T + stripH + stripGap, xOf(d1, L, W) - xOf(d0, L, W), stripH);
    });
    ctx.strokeStyle = '#d8d2c2'; ctx.lineWidth = 0.6;
    ctx.strokeRect(xOf(D0, L, W), T, W, stripH);
    ctx.strokeRect(xOf(D0, L, W), T + stripH + stripGap, W, stripH);

    drawXAxis(ctx, L, plotT, W, H, plotT + H + 3);
    ctx.font = MONO; ctx.fillStyle = '#8a9298'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var v = 0; v <= 150; v += 50) {
      var yy = yOf(v);
      ctx.strokeStyle = '#ece6d8';
      ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + W, yy); ctx.stroke();
      ctx.fillText(String(v), L - 4, yy);
    }
    ctx.save();
    ctx.translate(10, plotT + H / 2); ctx.rotate(-Math.PI / 2);
    ctx.font = FONT; ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
    ctx.fillText('伽马 (API)', 0, 0);
    ctx.restore();

    drawBoundsOn(ctx, L, T, W, plotT + H - T, false);

    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (var i = 0; i <= N; i++) {
      var x = xOf(dep[i], L, W), y = yOf(clamp(grv[i], 0, 150));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    drawCursor(ctx, L, plotT, W, H);
  }

  /* ---------- 图④：界面置信度条形 ---------- */
  function drawBnd() {
    var cv = $('cv-bnd');
    var rowH = 16, T = 6, B = 18;
    var LH = Math.max(58, bounds.length * rowH + T + B);
    var ctx = setupCanvas(cv, LW, LH);
    var L = 64, R = 12, W = LW - L - R;
    ctx.clearRect(0, 0, LW, LH);
    function xOfC(c) { return L + c * W; }

    /* 轴 */
    ctx.strokeStyle = '#d8d2c2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, LH - B); ctx.lineTo(L + W, LH - B); ctx.stroke();
    ctx.font = MONO; ctx.fillStyle = '#8a9298'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var v = 0; v <= 1.001; v += 0.25) {
      var x = xOfC(v);
      ctx.strokeStyle = '#ece6d8';
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, LH - B); ctx.stroke();
      ctx.fillText(v.toFixed(v === 0 ? 0 : 2), x, LH - B + 3);
    }

    var xt = xOfC(S.conf);

    bounds.forEach(function (b, i) {
      var y = T + i * rowH + 3, h = rowH - 6;
      var live = b.conf >= S.conf;
      ctx.fillStyle = live ? confColor(b.conf) : tint(confColor(b.conf), 0.35);
      ctx.fillRect(L, y, Math.max(1.5, b.conf * W), h);
      ctx.font = MONO; ctx.fillStyle = '#4d565b'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(b.depth.toFixed(1) + ' m', L - 5, y + h / 2);
      var label = b.conf.toFixed(2) + (live ? '' : ' 待复核');
      var bx = L + b.conf * W;
      if (bx + 4 + ctx.measureText(label).width > L + W) {
        /* 条内右对齐白字，避免超出画布 */
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(label, bx - 4, y + h / 2);
      } else {
        ctx.textAlign = 'left';
        ctx.fillStyle = live ? '#235f51' : '#b05a51';
        ctx.fillText(label, bx + 4, y + h / 2);
      }
    });
    if (!bounds.length) {
      ctx.font = FONT; ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText('无界面', LW / 2, LH / 2);
    }

    /* 阈值线（最后绘制，避免被条覆盖） */
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(xt, T); ctx.lineTo(xt, LH - B); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = FONT; ctx.fillStyle = '#b05a51'; ctx.textBaseline = 'bottom';
    ctx.textAlign = xt > LW - 90 ? 'right' : 'left';
    ctx.fillText('阈值 ' + S.conf.toFixed(2), xt + (xt > LW - 90 ? -3 : 3), LH - B - 1);
  }

  /* ---------- 指标与结论 ---------- */
  function renderMetrics() {
    var m = matchStats();
    $('m-nb').textContent = String(m.live.length);
    $('m-rec').textContent = (m.rec * 100).toFixed(0) + '%';
    $('m-pre').textContent = (m.pre * 100).toFixed(0) + '%';
    $('m-err').innerHTML = m.err == null ? '—' : m.err.toFixed(2) + '<small> m</small>';
    $('m-conf').textContent = m.live.length ? m.meanConf.toFixed(2) : '—';
    $('m-rec').parentNode.className = 'mcard' + (m.rec >= 0.85 ? '' : (m.rec >= 0.7 ? ' warn' : ' bad'));
    $('m-pre').parentNode.className = 'mcard' + (m.pre >= 0.85 ? '' : (m.pre >= 0.7 ? ' warn' : ' bad'));

    /* 结论文本 */
    var missed = TRUE_BOUNDS.filter(function (t) {
      return !m.live.some(function (b) { return Math.abs(b.depth - t) <= 1.0; });
    });
    var lowConf = bounds.filter(function (b) { return b.conf < S.conf; });
    var msgs = [];
    if (m.rec >= 0.85 && m.pre >= 0.85 && (m.err == null || m.err <= 0.8)) {
      msgs.push('分层结果达到案例目标（查全/查准 ≥85%，边界误差 ≤0.8 m）。');
    } else if (m.rec < 0.7 || m.pre < 0.7) {
      msgs.push('分层质量偏离目标：');
      if (m.rec < 0.85) msgs.push('查全率不足——');
      if (m.pre < 0.85) msgs.push('查准率不足——');
    } else {
      msgs.push('分层接近目标但仍有改进空间。');
    }
    if (missed.length) {
      msgs.push('漏检界面：' + missed.map(function (d) { return d.toFixed(0) + ' m'; }).join('、') +
        '（' + missed.map(function (d) { return trueLayerAt(d + 0.1).litho; }).join('/') + '侧）。');
    }
    if (lowConf.length) {
      msgs.push('待复核界面：' + lowConf.map(function (b) { return b.depth.toFixed(1) + ' m (' + b.conf.toFixed(2) + ')'; }).join('、') +
        '——建议对照图③伽马曲线复核。');
    }
    if (!S.norm) msgs.push('未启用归一化：钻头磨损趋势（全井 +22%）会污染界面位置与置信度。');
    var v = $('verdict');
    v.textContent = msgs.join(' ');
    v.className = 'verdict ' + (m.rec >= 0.85 && m.pre >= 0.85 ? 'ok' : (m.rec >= 0.7 && m.pre >= 0.7 ? 'warn' : 'bad'));
  }

  function renderAll() {
    drawRop(); drawDc(); drawGr(); drawBnd(); renderMetrics();
  }

  /* ---------- tooltip ---------- */
  function bindTip(boxId, tipId, cv, geomFn, contentFn) {
    var box = $(boxId), tip = $(tipId);
    cv.addEventListener('mousemove', function (e) {
      var rect = cv.getBoundingClientRect();
      var lx = (e.clientX - rect.left) * (LW / rect.width);
      var g = geomFn();
      if (lx < g.L || lx > g.L + g.W) { tip.style.display = 'none'; hoverDepth = null; renderAll(); return; }
      var d = clamp(depthOf(lx, g.L, g.W), D0, D1);
      hoverDepth = d;
      renderAll();
      tip.innerHTML = contentFn(d);
      tip.style.display = 'block';
      var bx = e.clientX - box.getBoundingClientRect().left;
      var by = e.clientY - box.getBoundingClientRect().top;
      tip.style.left = clamp(bx + 12, 4, box.clientWidth - 200) + 'px';
      tip.style.top = clamp(by - 10, 4, box.clientHeight - 70) + 'px';
    });
    cv.addEventListener('mouseleave', function () {
      tip.style.display = 'none'; hoverDepth = null; renderAll();
    });
  }

  function idxAt(d) { return clamp(Math.round((d - D0) / STEP), 0, N); }
  function fmt(n, p) { return n.toFixed(p); }

  function bindTips() {
    bindTip('box-rop', 'tip-rop', $('cv-rop'),
      function () { return { L: 40, W: LW - 48 }; },
      function (d) {
        var i = idxAt(d), sg = segAtDepth(d), nb = nearestBound(d);
        var s = '<b>' + fmt(d, 1) + ' m</b> · 钻时 <b>' + fmt(ropRaw[i], 1) + '</b> min/m' +
          '<br>归一化信号 <b>' + fmt(ropNorm[i], 1) + '</b> · 判别岩性 <b>' + sg.litho + '</b>' +
          '<br>真实岩性 ' + trueLayerAt(d).litho;
        if (nb.b && nb.dist < 6) s += '<br>邻近界面 <b>' + fmt(nb.b.depth, 1) + ' m</b>（置信度 ' + nb.b.conf.toFixed(2) + '）';
        return s;
      });
    bindTip('box-dc', 'tip-dc', $('cv-dc'),
      function () { return { L: 40, W: LW - 48 }; },
      function (d) {
        var i = idxAt(d);
        var dev = (dcv[i] - nctAt(d)) / nctAt(d) * 100;
        return '<b>' + fmt(d, 1) + ' m</b> · dc <b>' + fmt(dcv[i], 2) + '</b>' +
          '<br>NCT <b>' + fmt(nctAt(d), 2) + '</b> · 偏离 <b>' + (dev >= 0 ? '+' : '') + fmt(dev, 0) + '%</b>' +
          '<br>' + trueLayerAt(d).litho + (dev < -12 ? ' · 低于 NCT，易钻/欠压实' : '');
      });
    bindTip('box-gr', 'tip-gr', $('cv-gr'),
      function () { return { L: 40, W: LW - 48 }; },
      function (d) {
        var i = idxAt(d), sg = segAtDepth(d);
        return '<b>' + fmt(d, 1) + ' m</b> · 伽马 <b>' + fmt(grv[i], 0) + '</b> API' +
          '<br>真实岩性 <b>' + trueLayerAt(d).litho + '</b> · 判别 <b>' + sg.litho + '</b>' +
          (trueLayerAt(d).litho !== sg.litho ? '<br><span style="color:#b05a51">判别与真实不一致——弱界面段，需复核</span>' : '');
      });
  }

  /* ---------- 控件 ---------- */
  var OUT = {
    k: function (v) { return v + ' 层'; },
    minlen: function (v) { return v + ' m'; },
    conf: function (v) { return (+v).toFixed(2); },
    norm: function (v) { return +v ? '已启用' : '已关闭'; },
    cursor: function (v) { return (+v).toFixed(1) + ' m'; }
  };
  var KEYS = Object.keys(DEF);
  var segQueued = false;
  function scheduleSeg() {
    if (segQueued) return;
    segQueued = true;
    requestAnimationFrame(function () { segQueued = false; resegment(); renderAll(); });
  }
  function bindControls() {
    KEYS.forEach(function (k) {
      var el = $('s-' + k);
      el.addEventListener('input', function () {
        S[k] = +el.value;
        $('o-' + k).textContent = OUT[k](S[k]);
        if (k === 'k' || k === 'minlen' || k === 'norm') scheduleSeg();
        else renderAll();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      KEYS.forEach(function (k) {
        $('s-' + k).value = S[k];
        $('o-' + k).textContent = OUT[k](S[k]);
      });
      resegment(); renderAll();
    });
  }

  /* ---------- 页签 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.remove('active'); });
        $('pane-' + t.getAttribute('data-tab')).classList.add('active');
        if (t.getAttribute('data-tab') === 'sim') renderAll();
      });
    });
  }

  window.addEventListener('resize', function () { renderAll(); });

  bindTabs();
  bindControls();
  resegment();
  renderAll();
  bindTips();
})();
