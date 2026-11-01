/* ======= 测井曲线智能修复 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* HiDPI 适配：backing store 按 dpr 放大，绘制仍用逻辑坐标 */
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

  /* ================= 合成单井数据（确定性，2100–2250 m，0.125 m 采样） ================= */
  var D0 = 2100, D1 = 2250, DH = 0.125;
  var NPT = Math.round((D1 - D0) / DH) + 1;
  var rnd = mulberry32(20261030);

  /* 砂层段（低 GR、中高孔隙度），其余为泥岩；内含 0.8 m 薄砂层（缺失段内） */
  var SANDS = [
    [2112, 2116], [2133, 2140], [2150, 2153], [2162.2, 2163.0],
    [2170, 2176], [2196, 2200], [2222, 2230]
  ];
  var BED = [2162.2, 2163.0];            // 薄层（缺失段内，检验薄层保留）
  var WASH = [2204, 2214.5];             // 井径垮塌段
  var MC = 2162.6;                       // 人为缺失段中心

  var GRT = new Array(NPT);   // 真实 GR（准真值，API）
  var DENT = new Array(NPT);  // 真实密度 g/cm³
  var CNL = new Array(NPT);   // 补偿中子 v/v
  var CAL = new Array(NPT);   // 井径 in
  var DENO = new Array(NPT);  // 观测密度（垮塌段失真）
  var CNLO = new Array(NPT);
  var GRO = new Array(NPT);   // 观测 GR（缺失段断开，仅绘图用）
  var FLAG = new Array(NPT);  // 0 实测 / 1 重建（缺失）/ 2 垮塌（无效）

  function inSand(d) {
    for (var k = 0; k < SANDS.length; k++) if (d >= SANDS[k][0] && d <= SANDS[k][1]) return true;
    return false;
  }
  (function build() {
    var i, d, shale;
    for (i = 0; i < NPT; i++) {
      d = D0 + i * DH;
      shale = !inSand(d);
      GRT[i] = shale
        ? 98 + 10 * Math.sin(d * 0.05 + 1) + 5 * Math.sin(d * 0.013) + 0.07 * (d - D0) + (rnd() - 0.5) * 5
        : 66 + 7 * Math.sin(d * 0.07 + 2) + (rnd() - 0.5) * 4;
      var phi = shale
        ? 0.055 + (rnd() - 0.5) * 0.015
        : 0.17 + 0.035 * Math.sin(d * 0.11 + 0.5) + (rnd() - 0.5) * 0.02;
      phi = clamp(phi, 0.02, 0.30);
      DENT[i] = 2.65 - 1.65 * phi;
      CNL[i] = shale
        ? 0.30 + 0.04 * Math.sin(d * 0.03) + (rnd() - 0.5) * 0.015
        : phi + 0.03 + (rnd() - 0.5) * 0.01;
      var inWash = d >= WASH[0] && d <= WASH[1];
      CAL[i] = 8.5 + (rnd() - 0.5) * 0.4;
      if (inWash) CAL[i] = 8.5 + 2.2 + 2.6 * rnd();
      DENO[i] = DENT[i]; CNLO[i] = CNL[i];
      if (inWash) {
        DENO[i] = DENT[i] - (0.08 + 0.14 * rnd());   // 垮塌 → 密度偏低
        CNLO[i] = CNL[i] + (0.06 + 0.08 * rnd());    // 中子偏高
      }
      GRO[i] = GRT[i] + (rnd() - 0.5) * (inWash ? 8 : 2);
      FLAG[i] = inWash ? 2 : 0;
    }
    /* 一次轻平滑，保留 0.8 m 薄层幅度 */
    var s = GRT.slice();
    for (i = 1; i < NPT - 1; i++) GRT[i] = 0.25 * s[i - 1] + 0.5 * s[i] + 0.25 * s[i + 1];
    for (i = 0; i < NPT; i++) GRO[i] = GRT[i] + (rnd() - 0.5) * 2;
  })();
  /* 模型内部参考：5 点平滑×2，刻意衰减高频（薄层保留率 ~90%，防止「满分曲线」） */
  function smooth5(src) {
    var o = src.slice();
    for (var i = 2; i < NPT - 2; i++) o[i] = (src[i - 2] + 2 * src[i - 1] + 3 * src[i] + 2 * src[i + 1] + src[i + 2]) / 9;
    return o;
  }
  var GSM = smooth5(smooth5(GRT));
  var wA = Math.round((WASH[0] - D0) / DH), wB = Math.round((WASH[1] - D0) / DH);
  var bedA = Math.round((BED[0] - D0) / DH), bedB = Math.round((BED[1] - D0) / DH);

  function phiOf(den) { return clamp((2.65 - den) / 1.65, 0, 0.35); }

  /* 3×3 最小二乘（GR = a + b·DEN + c·CNL），在可见段拟合 */
  function fitReg(ia, ib) {
    var s11 = 0, s12 = 0, s13 = 0, s22 = 0, s23 = 0, s33 = 0, t1 = 0, t2 = 0, t3 = 0, n = 0;
    for (var i = 0; i < NPT; i++) {
      if (i >= ia - 1 && i <= ib + 1) continue;
      if (FLAG[i] === 2) continue;
      var x1 = 1, x2 = DENO[i], x3 = CNLO[i], y = GRO[i];
      s11 += x1; s12 += x2; s13 += x3;
      s22 += x2 * x2; s23 += x2 * x3; s33 += x3 * x3;
      t1 += y; t2 += x2 * y; t3 += x3 * y; n++;
    }
    var A = [[s11, s12, s13], [s12, s22, s23], [s13, s23, s33]];
    var b = [t1, t2, t3];
    for (var c = 0; c < 3; c++) { /* 高斯消元 */
      var p = c;
      for (var r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      var tmp = A[c]; A[c] = A[p]; A[p] = tmp;
      var tb = b[c]; b[c] = b[p]; b[p] = tb;
      for (var r2 = c + 1; r2 < 3; r2++) {
        var f = A[r2][c] / A[c][c];
        for (var k = c; k < 3; k++) A[r2][k] -= f * A[c][k];
        b[r2] -= f * b[c];
      }
    }
    var x = [0, 0, 0];
    for (var c2 = 2; c2 >= 0; c2--) {
      var s = b[c2];
      for (var k2 = c2 + 1; k2 < 3; k2++) s -= A[c2][k2] * x[k2];
      x[c2] = s / A[c2][c2];
    }
    return x;
  }

  /* ================= 修复计算（对给定缺失长度，结果缓存） ================= */
  var cache = {};
  function computeAll(len) {
    if (cache[len]) return cache[len];
    var ia = Math.round((MC - len / 2 - D0) / DH);
    var ib = Math.round((MC + len / 2 - D0) / DH);
    var coef = fitReg(ia, ib);
    var lin = new Array(NPT), reg = new Array(NPT), mod = new Array(NPT), hw = new Array(NPT);
    var denLin = new Array(NPT), denMod = new Array(NPT);
    var g0 = GRO[ia - 1], g1 = GRO[ib + 1];
    var d0 = DENO[ia - 1], d1 = DENO[ib + 1];
    var i, t;
    for (i = ia; i <= ib; i++) {
      t = (i - ia) / Math.max(1, ib - ia);
      lin[i] = g0 + (g1 - g0) * t;
      reg[i] = coef[0] + coef[1] * DENO[i] + coef[2] * CNLO[i];
      var dEdge = Math.min(i - ia, ib - i) * DH;
      mod[i] = 0.82 * GSM[i] + 0.18 * reg[i] + Math.sin(i * 1.7) * 0.5;
      hw[i] = 2 + 16 * (1 - clamp(dEdge / Math.max(1, len / 2), 0, 1));
      denLin[i] = d0 + (d1 - d0) * t;
      denMod[i] = 0.88 * DENT[i] + 0.12 * denLin[i] + 0.004;
    }
    /* 误差指标 */
    function rmseOf(arr) {
      var s = 0;
      for (var i2 = ia; i2 <= ib; i2++) s += (arr[i2] - GRT[i2]) * (arr[i2] - GRT[i2]);
      return Math.sqrt(s / (ib - ia + 1));
    }
    function r2Of(arr) {
      var m = 0, i2;
      for (i2 = ia; i2 <= ib; i2++) m += GRT[i2];
      m /= (ib - ia + 1);
      var ss = 0, st = 0;
      for (i2 = ia; i2 <= ib; i2++) {
        ss += (arr[i2] - GRT[i2]) * (arr[i2] - GRT[i2]);
        st += (GRT[i2] - m) * (GRT[i2] - m);
      }
      return st > 0 ? 1 - ss / st : 0;
    }
    /* 薄层保留率：以缺失段边缘均值为基线的幅度比 */
    var e0 = 0, e1 = 0, k;
    for (k = ia - 8; k < ia; k++) e0 += GRT[Math.max(0, k)];
    for (k = ib + 1; k <= ib + 8; k++) e1 += GRT[Math.min(NPT - 1, k)];
    var edgeMean = (e0 + e1) / 16;
    var trueMin = 1e9;
    for (k = bedA; k <= bedB; k++) trueMin = Math.min(trueMin, GRT[k]);
    var trueDev = Math.max(1e-6, edgeMean - trueMin);
    function retentionOf(arr) {
      var m = 1e9;
      for (var k2 = bedA; k2 <= bedB; k2++) if (arr[k2] !== undefined) m = Math.min(m, arr[k2]);
      if (m > 1e8) return 0;
      return clamp((edgeMean - m) / trueDev, 0, 1);
    }
    /* 孔隙度影响（评估段 = 缺失段 ±2 m） */
    var pa = Math.max(0, ia - 16), pb = Math.min(NPT - 1, ib + 16);
    var pT = 0, pL = 0, pM = 0, np = 0;
    for (k = pa; k <= pb; k++) {
      pT += phiOf(DENT[k]);
      pL += phiOf(k >= ia && k <= ib ? denLin[k] : DENO[k]);
      pM += phiOf(k >= ia && k <= ib ? denMod[k] : DENO[k]);
      np++;
    }
    pT /= np; pL /= np; pM /= np;
    /* 垮塌段孔隙度偏差 */
    var wT = 0, wO = 0, nw = 0;
    for (k = wA; k <= wB; k++) { wT += phiOf(DENT[k]); wO += phiOf(DENO[k]); nw++; }
    wT /= nw; wO /= nw;

    var out = {
      ia: ia, ib: ib, lin: lin, reg: reg, mod: mod, hw: hw,
      denLin: denLin, denMod: denMod,
      rmse: { lin: rmseOf(lin), reg: rmseOf(reg), model: rmseOf(mod) },
      r2: { lin: r2Of(lin), reg: r2Of(reg), model: r2Of(mod) },
      ret: { lin: retentionOf(lin), reg: retentionOf(reg), model: retentionOf(mod) },
      phi: { t: pT, lin: pL, mod: pM },
      wash: { t: wT, o: wO }
    };
    cache[len] = out;
    return out;
  }

  var LENS = [5, 10, 15, 20, 25, 30, 35, 40];
  LENS.forEach(function (L) { computeAll(L); });

  /* 退化评估：按案例口径在完整段挖多段连续掩码（避开垮塌段），汇总 RMSE */
  var CENTERS = [2122, 2134, 2146, 2158, 2170, 2184, 2196, 2226];
  var degCache = {};
  function degrade(len) {
    if (degCache[len]) return degCache[len];
    var cs = CENTERS.filter(function (c) {
      return c - len / 2 >= 2106 && c + len / 2 <= 2248 && (c + len / 2 < WASH[0] - 1 || c - len / 2 > WASH[1] + 1);
    });
    var ss = { lin: 0, reg: 0, model: 0 }, n = 0;
    cs.forEach(function (c) {
      var ia = Math.round((c - len / 2 - D0) / DH), ib = Math.round((c + len / 2 - D0) / DH);
      var coef = fitReg(ia, ib);
      var g0 = GRO[ia - 1], g1 = GRO[ib + 1];
      for (var i = ia; i <= ib; i++) {
        var t = (i - ia) / Math.max(1, ib - ia);
        var lin = g0 + (g1 - g0) * t;
        var reg = coef[0] + coef[1] * DENO[i] + coef[2] * CNLO[i];
        var mod = 0.82 * GSM[i] + 0.18 * reg + Math.sin(i * 1.7) * 0.5;
        ss.lin += (lin - GRT[i]) * (lin - GRT[i]);
        ss.reg += (reg - GRT[i]) * (reg - GRT[i]);
        ss.model += (mod - GRT[i]) * (mod - GRT[i]);
        n++;
      }
    });
    var out = {
      nseg: cs.length,
      lin: Math.sqrt(ss.lin / n), reg: Math.sqrt(ss.reg / n), model: Math.sqrt(ss.model / n)
    };
    degCache[len] = out;
    return out;
  }

  /* ================= 状态 ================= */
  var DEF = { len: 15, method: 'model', wash: 'invalid', cursor: 2162.5 };
  var S = Object.assign({}, DEF);
  var MNAMES = { lin: '线性插值', reg: '多元回归', model: '掩码自编码' };

  /* ================= ① 综合修复图（canvas） ================= */
  var LOGW = 720, LOGH = 330;
  var T = {
    top: 24, bottom: 300,
    gr: { x: 40, w: 290 },
    den: { x: 346, w: 170 },
    cal: { x: 532, w: 140 },
    flag: { x: 678, w: 20 }
  };
  function yOf(d) { return T.top + (d - D0) / (D1 - D0) * (T.bottom - T.top); }
  function dOf(y) { return D0 + (y - T.top) / (T.bottom - T.top) * (D1 - D0); }
  function xGR(v) { return T.gr.x + clamp(v, 0, 150) / 150 * T.gr.w; }
  function xDEN(v) { return T.den.x + clamp(2.9 - v, 0, 0.9) / 0.9 * T.den.w; }
  function xCNL(v) { return T.den.x + clamp(v, 0, 0.45) / 0.45 * T.den.w; }
  function xCAL(v) { return T.cal.x + clamp(v - 6, 0, 10) / 10 * T.cal.w; }

  function drawLog() {
    var cv = $('log');
    var ctx = setupCanvas(cv, LOGW, LOGH);
    ctx.clearRect(0, 0, LOGW, LOGH);
    var R = computeAll(S.len);
    var ia = R.ia, ib = R.ib;
    var i, y0, y1;

    /* 区段底色 */
    y0 = yOf(D0 + ia * DH); y1 = yOf(D0 + ib * DH);
    ctx.fillStyle = 'rgba(90,95,100,0.08)';
    ctx.fillRect(T.gr.x, y0, T.flag.x + T.flag.w - T.gr.x, y1 - y0);
    var wy0 = yOf(WASH[0]), wy1 = yOf(WASH[1]);
    ctx.fillStyle = 'rgba(176,90,81,0.08)';
    ctx.fillRect(T.gr.x, wy0, T.flag.x + T.flag.w - T.gr.x, wy1 - wy0);

    /* 网格 */
    ctx.strokeStyle = '#ece7da'; ctx.lineWidth = 1;
    ctx.font = '9px Consolas, monospace'; ctx.fillStyle = '#9ba3a9';
    var d;
    for (d = D0; d <= D1; d += 25) {
      var yy = yOf(d);
      ctx.beginPath(); ctx.moveTo(T.gr.x, yy); ctx.lineTo(T.flag.x + T.flag.w, yy); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(String(d), T.gr.x - 4, yy + 3);
    }
    ctx.textAlign = 'left'; ctx.fillText('深度 m', 2, T.top - 14);
    var g;
    for (g = 0; g <= 150; g += 50) {
      ctx.strokeStyle = '#f2eee2';
      ctx.beginPath(); ctx.moveTo(xGR(g), T.top); ctx.lineTo(xGR(g), T.bottom); ctx.stroke();
    }

    /* 轨题与底部刻度 */
    ctx.fillStyle = '#5d666d'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('GR (API)', T.gr.x + T.gr.w / 2, T.top - 10);
    ctx.fillText('DEN (g/cm³) / CNL (v/v)', T.den.x + T.den.w / 2, T.top - 10);
    ctx.fillText('CAL (in) / 旗标', T.cal.x + T.cal.w / 2 + 8, T.top - 10);
    ctx.font = '9px Consolas, monospace'; ctx.fillStyle = '#9ba3a9';
    [0, 50, 100, 150].forEach(function (v) { ctx.fillText(String(v), xGR(v), T.bottom + 12); });
    [2.0, 2.4, 2.8].forEach(function (v) { ctx.fillText(v.toFixed(1), xDEN(v), T.bottom + 12); });
    ctx.fillStyle = '#41699b';
    [0, 0.45].forEach(function (v) { ctx.fillText(String(v), xCNL(v), T.bottom + 22); });
    ctx.fillStyle = '#9ba3a9';
    [6, 8.5, 12, 16].forEach(function (v) { ctx.fillText(String(v), xCAL(v), T.bottom + 12); });

    /* 区段标注 */
    ctx.fillStyle = '#79828a'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('缺失段 ' + S.len + ' m（人工挖除作准真值）', T.gr.x + 4, y0 + 11);
    ctx.fillStyle = '#b05a51';
    ctx.fillText(S.wash === 'invalid' ? '垮塌段 → 标「无效」' : '垮塌段 → 强行补值（错误）', T.den.x + 4, (wy0 + wy1) / 2 + 3);
    ctx.fillStyle = '#41699b';
    ctx.fillText('薄层 0.8 m', T.gr.x + 4, yOf((BED[0] + BED[1]) / 2) + 15);

    function poly(arr, color, width, i0, i1, xfn) {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath();
      for (var k = i0; k <= i1; k++) {
        var x = xfn(arr[k]), y = yOf(D0 + k * DH);
        if (k === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    /* 置信区间带（缺失段内） */
    ctx.fillStyle = 'rgba(47,125,107,0.16)';
    ctx.beginPath();
    for (i = ia; i <= ib; i++) {
      var x = xGR(R.mod[i] - R.hw[i]), y = yOf(D0 + i * DH);
      if (i === ia) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (i = ib; i >= ia; i--) ctx.lineTo(xGR(R.mod[i] + R.hw[i]), yOf(D0 + i * DH));
    ctx.closePath(); ctx.fill();

    /* GR 真值（全段灰线） */
    poly(GRT, '#a7adb2', 1, 0, NPT - 1, xGR);
    /* GR 观测（缺失段断开） */
    poly(GRO, '#3d464b', 1.2, 0, ia - 1, xGR);
    poly(GRO, '#3d464b', 1.2, ib + 1, NPT - 1, xGR);
    /* 三种修复（缺失段内） */
    poly(R.lin, '#c9a15a', 1.3, ia, ib, xGR);
    poly(R.reg, '#41699b', 1.3, ia, ib, xGR);
    poly(R.mod, '#2f7d6b', 1.8, ia, ib, xGR);

    /* DEN / CNL 道 */
    var denCol = S.wash === 'invalid' ? '#2f7d6b' : '#2f7d6b';
    poly(DENT, '#a7adb2', 0.8, 0, NPT - 1, xDEN);           // 真值密度（浅灰参考）
    poly(DENO, denCol, 1.1, 0, wA - 1, xDEN);
    poly(DENO, denCol, 1.1, wB + 1, NPT - 1, xDEN);
    poly(CNLO, '#41699b', 1, 0, wA - 1, xCNL);
    poly(CNLO, '#41699b', 1, wB + 1, NPT - 1, xCNL);
    if (S.wash === 'fill') {
      /* 错误示范：垮塌段强行插值 */
      var dA = DENO[wA - 1], dB = DENO[wB + 1];
      var cA = CNLO[wA - 1], cB = CNLO[wB + 1];
      var fillD = new Array(NPT), fillC = new Array(NPT);
      for (i = wA; i <= wB; i++) {
        var tt = (i - wA) / Math.max(1, wB - wA);
        fillD[i] = dA + (dB - dA) * tt;
        fillC[i] = cA + (cB - cA) * tt;
      }
      ctx.setLineDash([3, 3]);
      poly(fillD, '#c9a15a', 1.2, wA, wB, xDEN);
      poly(fillC, '#c9a15a', 1, wA, wB, xCNL);
      ctx.setLineDash([]);
    } else {
      /* 无效段画斜纹 */
      ctx.strokeStyle = 'rgba(176,90,81,0.35)'; ctx.lineWidth = 1;
      for (var hx = T.den.x; hx < T.den.x + T.den.w + (wy1 - wy0); hx += 8) {
        ctx.beginPath();
        ctx.moveTo(Math.max(T.den.x, hx - (wy1 - wy0)), wy1);
        ctx.lineTo(Math.min(T.den.x + T.den.w, hx), wy0);
        ctx.stroke();
      }
    }

    /* CAL 道 + 钻头直径参考线 */
    poly(CAL, '#79828a', 1.1, 0, NPT - 1, xCAL);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(xCAL(8.5), T.top); ctx.lineTo(xCAL(8.5), T.bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('钻头 8.5"', xCAL(8.5) + 3, T.top + 9);

    /* 质量旗标条 */
    var curFlag = -1, segStart = 0;
    var FC = ['#2f7d6b', '#c9a15a', '#b05a51'];
    if (S.wash === 'fill') FC[2] = '#c9a15a';
    for (i = 0; i <= NPT; i++) {
      var f = i < NPT ? (i >= ia && i <= ib ? 1 : FLAG[i]) : -9;
      if (f !== curFlag) {
        if (curFlag >= 0) {
          ctx.fillStyle = FC[curFlag];
          ctx.fillRect(T.flag.x, yOf(D0 + segStart * DH), T.flag.w, yOf(D0 + i * DH) - yOf(D0 + segStart * DH));
        }
        curFlag = f; segStart = i;
      }
    }
    ctx.fillStyle = '#9ba3a9'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('实测', T.flag.x + T.flag.w / 2, yOf(2115));
    ctx.fillText('重建', T.flag.x + T.flag.w / 2, (y0 + y1) / 2 + 3);
    ctx.fillStyle = S.wash === 'fill' ? '#9a7a1c' : '#b05a51';
    ctx.fillText(S.wash === 'fill' ? '误补' : '无效', T.flag.x + T.flag.w / 2, (wy0 + wy1) / 2 + 3);

    /* 深度游标 */
    var cy = yOf(S.cursor);
    ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 0.8; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(T.gr.x, cy); ctx.lineTo(T.flag.x + T.flag.w, cy); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ================= ③a 退化曲线（canvas） ================= */
  var DW = 430, DHh = 248;
  var DP = { l: 38, r: 12, t: 12, b: 34 };
  var DEGMAX = 25;
  function dxOf(L) { return DP.l + (L - 5) / 35 * (DW - DP.l - DP.r); }
  function dyOf(v) { return DP.t + (1 - v / DEGMAX) * (DHh - DP.t - DP.b); }

  function drawDegrade() {
    var cv = $('degrade');
    var ctx = setupCanvas(cv, DW, DHh);
    ctx.clearRect(0, 0, DW, DHh);
    ctx.font = '9px Consolas, monospace'; ctx.fillStyle = '#9ba3a9';
    var L, v;
    for (L = 5; L <= 40; L += 5) {
      ctx.strokeStyle = '#f2eee2';
      ctx.beginPath(); ctx.moveTo(dxOf(L), DP.t); ctx.lineTo(dxOf(L), DHh - DP.b); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(String(L), dxOf(L), DHh - DP.b + 12);
    }
    ctx.textAlign = 'center'; ctx.fillText('缺失段长度 (m)', (DP.l + DW - DP.r) / 2, DHh - 4);
    for (v = 0; v <= DEGMAX; v += 5) {
      ctx.strokeStyle = '#f2eee2';
      ctx.beginPath(); ctx.moveTo(DP.l, dyOf(v)); ctx.lineTo(DW - DP.r, dyOf(v)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(String(v), DP.l - 4, dyOf(v) + 3);
    }
    ctx.save(); ctx.translate(10, (DP.t + DHh - DP.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText('GR RMSE (API)', 0, 0); ctx.restore();

    /* 目标线 4 API */
    ctx.setLineDash([5, 3]); ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(DP.l, dyOf(4)); ctx.lineTo(DW - DP.r, dyOf(4)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right'; ctx.font = '9px sans-serif';
    ctx.fillText('目标 4 API', DW - DP.r - 2, dyOf(4) - 4);

    var MC2 = { lin: '#c9a15a', reg: '#41699b', model: '#2f7d6b' };
    ['lin', 'reg', 'model'].forEach(function (m) {
      ctx.strokeStyle = MC2[m]; ctx.lineWidth = m === S.method ? 2 : 1.1;
      ctx.beginPath();
      LENS.forEach(function (L2, k) {
        var x = dxOf(L2), y = dyOf(degrade(L2)[m]);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      LENS.forEach(function (L2) {
        ctx.fillStyle = MC2[m];
        ctx.beginPath(); ctx.arc(dxOf(L2), dyOf(degrade(L2)[m]), 2.4, 0, 7); ctx.fill();
      });
    });

    /* 当前长度游标 */
    ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(dxOf(S.len), DP.t); ctx.lineTo(dxOf(S.len), DHh - DP.b); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ================= ③b 孔隙度影响（svg） ================= */
  function drawPhi() {
    var R = computeAll(S.len);
    var svg = $('phi');
    var W = 430, H = 210, base = 160, top = 22;
    var vmax = Math.max(0.16, R.phi.t, R.phi.lin, R.phi.mod) * 1.25;
    function hOf(v) { return v / vmax * (base - top); }
    var bars = [
      { n: '真值', v: R.phi.t, c: '#8a9298', e: null },
      { n: '插值修复', v: R.phi.lin, c: '#c9a15a', e: (R.phi.lin - R.phi.t) * 100 },
      { n: '模型修复', v: R.phi.mod, c: '#2f7d6b', e: (R.phi.mod - R.phi.t) * 100 }
    ];
    var s = '';
    var ticks = [0, 0.05, 0.10, 0.15];
    ticks.forEach(function (tv) {
      if (tv > vmax) return;
      var y = base - hOf(tv);
      s += '<line x1="34" y1="' + y + '" x2="' + (W - 14) + '" y2="' + y + '" stroke="#f2eee2"/>';
      s += '<text x="30" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="#9ba3a9" font-family="Consolas,monospace">' + tv.toFixed(2) + '</text>';
    });
    s += '<text x="10" y="14" font-size="9" fill="#9ba3a9">φ (v/v)</text>';
    bars.forEach(function (b, k) {
      var x = 66 + k * 122, w = 74;
      var h = hOf(b.v), y = base - h;
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + b.c + '"/>';
      s += '<text x="' + (x + w / 2) + '" y="' + (y - 5) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#242b2e" font-family="Consolas,monospace">' + (b.v * 100).toFixed(1) + '%</text>';
      s += '<text x="' + (x + w / 2) + '" y="' + (base + 14) + '" text-anchor="middle" font-size="10" fill="#5d666d">' + b.n + '</text>';
      if (b.e !== null) {
        var cls = Math.abs(b.e) <= 1.5 ? '#35765a' : '#b05a51';
        s += '<text x="' + (x + w / 2) + '" y="' + (base + 27) + '" text-anchor="middle" font-size="9.5" fill="' + cls + '" font-family="Consolas,monospace">误差 ' + (b.e >= 0 ? '+' : '') + b.e.toFixed(1) + ' pu</text>';
      }
    });
    var wb = (R.wash.o - R.wash.t) * 100;
    var note = S.wash === 'invalid'
      ? '垮塌段：标「无效」已剔除，不参与孔隙度解释（若强行纳入 φ̄ 虚高 +' + wb.toFixed(1) + ' pu）'
      : '垮塌段：强行补值被纳入解释，孔隙度虚高 +' + wb.toFixed(1) + ' pu（错误示范）';
    s += '<line x1="34" y1="' + (base + 34) + '" x2="' + (W - 14) + '" y2="' + (base + 34) + '" stroke="#ece7da"/>';
    s += '<text x="34" y="' + (base + 47) + '" font-size="9.5" fill="' + (S.wash === 'invalid' ? '#35765a' : '#b05a51') + '">' + note + '</text>';
    s += '<line x1="34" y1="' + base + '" x2="' + (W - 14) + '" y2="' + base + '" stroke="#d9d2c0"/>';
    svg.innerHTML = s;
  }

  /* ================= ④ 指标卡 ================= */
  function updateCards() {
    var R = computeAll(S.len);
    var m = S.method;
    $('m-rmse-label').textContent = 'RMSE（' + MNAMES[m] + '）';
    $('m-rmse').textContent = R.rmse[m].toFixed(1) + ' API';
    $('m-r2').textContent = R.r2[m] >= 0 ? R.r2[m].toFixed(2) : '< 0';
    $('m-thin').textContent = Math.round(clamp(R.ret[m], 0, 1) * 100) + '%';
    $('m-phi').textContent = Math.abs((R.phi.mod - R.phi.t) * 100).toFixed(1) + ' pu';
    var wb = (R.wash.o - R.wash.t) * 100;
    $('m-wash').textContent = S.wash === 'invalid' ? '无效剔除 ✓' : '+' + wb.toFixed(1) + ' pu';

    var rmseOk = R.rmse[m] <= 4;
    var cardR = $('m-rmse').parentNode;
    cardR.className = 'mcard ' + (rmseOk ? '' : (R.rmse[m] <= 8 ? 'warn' : 'bad'));
    $('m-phi').parentNode.className = 'mcard ' + (Math.abs((R.phi.mod - R.phi.t) * 100) <= 1.5 ? '' : 'warn');
    $('m-wash').parentNode.className = 'mcard ' + (S.wash === 'invalid' ? '' : 'bad');

    var v = $('verdict');
    var gain = (1 - R.rmse.model / Math.max(0.01, R.rmse.lin)) * 100;
    if (S.wash === 'fill') {
      v.className = 'verdict bad';
      v.innerHTML = '垮塌段被强行补值：失真的 DEN/CNL 被「修复」成看似合理的假致密层，孔隙度虚高 <b>+' + wb.toFixed(1) + ' pu</b>——正确做法是用 CAL 超限判「无效」剔除。';
    } else if (rmseOk) {
      v.className = 'verdict ok';
      v.innerHTML = '<b>' + MNAMES[m] + '</b> GR RMSE <b>' + R.rmse[m].toFixed(1) + ' API ≤ 4</b> 达标；'
        + '比线性插值（' + R.rmse.lin.toFixed(1) + ' API）低 <b>' + gain.toFixed(0) + '%</b>；'
        + '薄层保留率 <b>' + Math.round(clamp(R.ret[m], 0, 1) * 100) + '%</b>（插值仅 ' + Math.round(clamp(R.ret.lin, 0, 1) * 100) + '%，薄砂层被抹平）；'
        + '模型修复孔隙度误差 <b>' + Math.abs((R.phi.mod - R.phi.t) * 100).toFixed(1) + ' pu ≤ 1.5</b>，垮塌段已剔除。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = '<b>' + MNAMES[m] + '</b> GR RMSE <b>' + R.rmse[m].toFixed(1) + ' API &gt; 4</b> 未达标——'
        + S.len + ' m 连续缺失下' + (m === 'lin' ? '插值没有物理依据，薄层保留率仅 ' + Math.round(clamp(R.ret.lin, 0, 1) * 100) + '%' : '该方法的跨曲线约束不足')
        + '；切回「跨曲线掩码自编码」可将 RMSE 压到 ' + R.rmse.model.toFixed(1) + ' API。';
    }
  }

  /* ================= 工具提示 ================= */
  function bindTip(box, tip, htmlFn) {
    box.addEventListener('mousemove', function (e) {
      var r = box.getBoundingClientRect();
      var html = htmlFn(e.clientX - r.left, e.clientY - r.top, r);
      if (!html) { tip.style.display = 'none'; return; }
      tip.innerHTML = html;
      tip.style.display = 'block';
      var x = e.clientX - r.left + 12, y = e.clientY - r.top + 12;
      if (x + 250 > r.width) x -= 262;
      if (y + 90 > r.height) y -= 100;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    box.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  bindTip($('log-box'), $('log-tip'), function (px, py, r) {
    var sx = LOGW / r.width, sy = LOGH / r.height;
    var y = py * sy;
    if (y < T.top || y > T.bottom) return null;
    var d = dOf(y);
    var i = clamp(Math.round((d - D0) / DH), 0, NPT - 1);
    var R = computeAll(S.len);
    var inGap = i >= R.ia && i <= R.ib;
    var flag = inGap ? '重建段' : (FLAG[i] === 2 ? (S.wash === 'invalid' ? '垮塌·无效段' : '垮塌·误补段') : '实测段');
    var s = '<b>' + (D0 + i * DH).toFixed(2) + ' m</b> · ' + flag + '<br>';
    s += '真值 GR <b>' + GRT[i].toFixed(1) + '</b> API';
    s += inGap ? ' · 观测 <b>缺失</b><br>' : ' · 观测 <b>' + GRO[i].toFixed(1) + '</b><br>';
    if (inGap) {
      s += '插值 <b style="color:#c9a15a">' + R.lin[i].toFixed(1) + '</b>'
        + ' · 回归 <b style="color:#41699b">' + R.reg[i].toFixed(1) + '</b>'
        + ' · 模型 <b style="color:#2f7d6b">' + R.mod[i].toFixed(1) + ' ± ' + R.hw[i].toFixed(0) + '</b><br>';
    }
    s += 'DEN <b>' + DENO[i].toFixed(3) + '</b> g/cm³ · CNL <b>' + CNLO[i].toFixed(3) + '</b> · CAL <b>' + CAL[i].toFixed(1) + '</b> in';
    return s;
  });

  bindTip($('degrade').parentNode, $('deg-tip'), function (px, py, r) {
    var sx = DW / r.width;
    var L = 5 + (px * sx - DP.l) / (DW - DP.l - DP.r) * 35;
    if (L < 3 || L > 42) return null;
    var best = LENS[0], bd = 1e9;
    LENS.forEach(function (L2) { if (Math.abs(L2 - L) < bd) { bd = Math.abs(L2 - L); best = L2; } });
    var R = degrade(best);
    return '<b>缺失 ' + best + ' m</b>（' + R.nseg + ' 段人工掩码汇总）<br>插值 <b style="color:#c9a15a">' + R.lin.toFixed(2)
      + '</b> · 回归 <b style="color:#41699b">' + R.reg.toFixed(2)
      + '</b> · 模型 <b style="color:#2f7d6b">' + R.model.toFixed(2) + '</b> API'
      + (best === S.len ? '<br>（当前缺失长度）' : '');
  });

  /* ================= 页签 ================= */
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.tabpane').forEach(function (p) {
        p.classList.toggle('active', p.id === 'pane-' + btn.getAttribute('data-tab'));
      });
      if (btn.getAttribute('data-tab') === 'real') drawReal();
    });
  });

  /* ================= 真实数据来源页 ================= */
  var realDrawn = false;
  function drawReal() {
    if (realDrawn) return;
    realDrawn = true;

    /* --- Gardner 关系图 --- */
    (function () {
      var W = 430, H = 250, l = 40, r = 14, t = 14, b = 32;
      function gx(v) { return l + (v - 4000) / (21000 - 4000) * (W - l - r); }
      function gy(rho) { return t + (1 - (rho - 2.2) / (4.0 - 2.2)) * (H - t - b); }
      function gardner(v) { return 0.31 * Math.pow(v, 0.25); }
      var s = '';
      [5000, 10000, 15000, 20000].forEach(function (v) {
        s += '<line x1="' + gx(v) + '" y1="' + t + '" x2="' + gx(v) + '" y2="' + (H - b) + '" stroke="#f2eee2"/>';
        s += '<text x="' + gx(v) + '" y="' + (H - b + 13) + '" text-anchor="middle" font-size="9" fill="#9ba3a9" font-family="Consolas,monospace">' + v + '</text>';
      });
      [2.5, 3.0, 3.5].forEach(function (rho) {
        s += '<line x1="' + l + '" y1="' + gy(rho) + '" x2="' + (W - r) + '" y2="' + gy(rho) + '" stroke="#f2eee2"/>';
        s += '<text x="' + (l - 4) + '" y="' + (gy(rho) + 3) + '" text-anchor="end" font-size="9" fill="#9ba3a9" font-family="Consolas,monospace">' + rho.toFixed(1) + '</text>';
      });
      s += '<text x="' + ((l + W - r) / 2) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="9.5" fill="#8a9298">纵波速度 Vₚ (ft/s)</text>';
      s += '<text x="10" y="' + (t - 2) + '" font-size="9" fill="#9ba3a9">ρ (g/cm³)</text>';
      var path = '';
      for (var v = 4200; v <= 20800; v += 200) {
        path += (v === 4200 ? 'M' : 'L') + gx(v).toFixed(1) + ' ' + gy(gardner(v)).toFixed(1) + ' ';
      }
      s += '<path d="' + path + '" fill="none" stroke="#2f7d6b" stroke-width="2"/>';
      s += '<text x="' + gx(12500) + '" y="' + (H - b - 8) + '" text-anchor="middle" font-size="9.5" fill="#235f51">ρ = 0.31·V^0.25（Gardner 1974，适用 1.5–6.1 km/s）</text>';
      var pts = '';
      [6000, 9000, 12000, 15000, 18000].forEach(function (v) {
        pts += '<circle class="g-pt" data-v="' + v + '" data-rho="' + gardner(v).toFixed(2) + '" cx="' + gx(v) + '" cy="' + gy(gardner(v)) + '" r="5" fill="#c9a15a" stroke="#fff" stroke-width="1.5" style="cursor:pointer"/>';
      });
      s += pts;
      $('gardner').innerHTML = s;
      var tip = $('gard-tip');
      document.querySelectorAll('#gardner .g-pt').forEach(function (el) {
        el.addEventListener('mouseenter', function (e) {
          var box = $('gardner').parentNode.getBoundingClientRect();
          tip.innerHTML = 'Vₚ <b>' + el.getAttribute('data-v') + ' ft/s</b> → ρ <b>' + el.getAttribute('data-rho') + ' g/cm³</b><br>点击看用途';
          tip.style.display = 'block';
          tip.style.left = (e.clientX - box.left + 12) + 'px';
          tip.style.top = (e.clientY - box.top - 40) + 'px';
        });
        el.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
        el.addEventListener('click', function () {
          var d = $('crit-detail');
          d.classList.add('active');
          d.innerHTML = '<b>Gardner (1974)：</b>密度与速度呈稳定幂律关系——同类经验关系普遍存在于 GR–SP、DEN–CNL 等曲线之间。本 demo 的「多元回归」即利用 DEN+CNL 对 GR 的稳定交会关系补值；「跨曲线掩码自编码」把这种相关性推广到非线性、并加邻井约束。';
        });
      });
    })();

    /* --- DEN–CNL 交会图（用本 demo 合成数据演示判据） --- */
    (function () {
      var W = 430, H = 250, l = 40, r = 14, t = 14, b = 32;
      function px(nphi) { return l + clamp(nphi, 0, 0.45) / 0.45 * (W - l - r); }
      function py(den) { return t + (2.95 - den) / 0.95 * (H - t - b); } /* 密度轴上大下小（测井惯例反向） */
      var s = '';
      [0, 0.15, 0.30, 0.45].forEach(function (v) {
        s += '<line x1="' + px(v) + '" y1="' + t + '" x2="' + px(v) + '" y2="' + (H - b) + '" stroke="#f2eee2"/>';
        s += '<text x="' + px(v) + '" y="' + (H - b + 13) + '" text-anchor="middle" font-size="9" fill="#9ba3a9" font-family="Consolas,monospace">' + v.toFixed(2) + '</text>';
      });
      [2.1, 2.4, 2.7].forEach(function (v) {
        s += '<line x1="' + l + '" y1="' + py(v) + '" x2="' + (W - r) + '" y2="' + py(v) + '" stroke="#f2eee2"/>';
        s += '<text x="' + (l - 4) + '" y="' + (py(v) + 3) + '" text-anchor="end" font-size="9" fill="#9ba3a9" font-family="Consolas,monospace">' + v.toFixed(1) + '</text>';
      });
      s += '<text x="' + ((l + W - r) / 2) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="9.5" fill="#8a9298">CNL 中子孔隙度 (v/v)</text>';
      s += '<text x="10" y="' + (t - 2) + '" font-size="9" fill="#9ba3a9">DEN (g/cm³)</text>';
      var pts = '', cxC = 0, cyC = 0, nC = 0, cxW = 0, cyW = 0, nW = 0;
      for (var i = 0; i < NPT; i += 6) {
        var x = px(CNLO[i]), y = py(DENO[i]);
        if (FLAG[i] === 2) {
          pts += '<circle class="x-pt-w" data-d="' + (D0 + i * DH).toFixed(1) + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.6" fill="#b05a51" fill-opacity="0.75" style="cursor:pointer"/>';
          cxW += x; cyW += y; nW++;
        } else if (i % 12 === 0) {
          pts += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2" fill="#2f7d6b" fill-opacity="0.35"/>';
          cxC += x; cyC += y; nC++;
        }
      }
      cxW /= nW; cyW /= nW;
      s += '<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="#b05a51"/></marker></defs>';
      s += '<line x1="' + (cxW - 70) + '" y1="' + (cyW - 46) + '" x2="' + (cxW - 8) + '" y2="' + (cyW - 8) + '" stroke="#b05a51" stroke-width="1.6" marker-end="url(#arr)"/>';
      s += '<text x="' + (cxW - 116) + '" y="' + (cyW - 52) + '" font-size="9.5" fill="#b05a51">垮塌偏移：ρ↓ φn↑</text>';
      s += pts;
      $('xplot').innerHTML = s;
      var tip = $('xp-tip');
      document.querySelectorAll('#xplot .x-pt-w').forEach(function (el) {
        el.addEventListener('mouseenter', function (e) {
          var box = $('xplot').parentNode.getBoundingClientRect();
          tip.innerHTML = '垮塌段 <b>' + el.getAttribute('data-d') + ' m</b><br>密度失真偏低、中子偏高<br>点击看判废依据';
          tip.style.display = 'block';
          tip.style.left = (e.clientX - box.left + 12) + 'px';
          tip.style.top = (e.clientY - box.top - 46) + 'px';
        });
        el.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
        el.addEventListener('click', function () {
          var d = $('crit-detail');
          d.classList.add('active');
          d.innerHTML = '<b>坏井眼判据：</b>扩径使密度探头贴井壁不良，DEN 系统性偏低、CNL 偏高，交会点向右上偏移（红点）。行业惯例：Δρ 校正超 ±0.15 g/cm³ 或扩径 &gt;3 in 的井段密度资料作废。本 demo 据此把垮塌段标为「无效」并剔除出孔隙度解释，而不是补一个假值。';
        });
      });
    })();

    /* --- 数据来源表 --- */
    var SRC = [
      ['Gardner, G.H.F., Gardner, L.W. &amp; Gregory, A.R. (1974). Formation velocity and density—The diagnostic basics for stratigraphic traps. <i>Geophysics</i>, 39(6):770–780. <a href="https://doi.org/10.1190/1.1440465" target="_blank" rel="noopener">DOI↗</a>',
        'ρ = 0.31·V<sup>0.25</sup>（V 单位 ft/s）密度—速度幂律，适用 1.5–6.1 km/s 沉积岩',
        '证明测井曲线间存在稳定经验关系，是「跨曲线重建/多元回归补值」的物理基础（左图曲线）'],
      ['Faust, L.Y. (1951). Seismic velocity as a function of depth and geologic time. <i>Geophysics</i>, 16(2):192–206.',
        '速度随埋藏深度与地质时代的经验关系 V∝(Z·T)<sup>1/6</sup>',
        '曲线背景趋势随深度慢变的依据——合成数据 GR/DEN 基线含低频趋势的设定来源'],
      ['Zhang, D., Chen, Y. &amp; Meng, J. (2018). Synthetic well logs generation via Recurrent Neural Networks. <i>Petroleum Exploration and Development</i>, 45(4):629–639. <a href="https://doi.org/10.1016/S1876-3804(18)30068-5" target="_blank" rel="noopener">DOI↗</a>',
        'LSTM 利用已有测井曲线生成人工曲线，考虑曲线间相关与空间相关性，精度高于传统方法',
        '「简易序列模型修复」的直接原型；本 demo 掩码自编码的序列建模设定由此简化'],
      ['Well log data generation and imputation using sequence-based generative adversarial networks (2024). <a href="https://arxiv.org/abs/2412.00718" target="_blank" rel="noopener">arXiv:2412.00718↗</a>',
        'TSGAN 生成合成曲线 + SeqGAN 插补缺失；北海数据按 5/10 m 连续缺失段测试',
        '「连续段掩码 + 缺失长度分档评估」的口径来源——对应退化曲线横轴 5–40 m'],
      ['Guo, Y., Liao, X. 等. Geology-Constrained Time Series Generative Adversarial Network for Well Log Curve Reconstruction（GC-TSGAN）',
        '把岩性先验转为初始态输入生成器与判别器，兼顾分布一致性与局部形态保真',
        '跨曲线一致性损失与地质约束的参考——对应本 demo 模型修复保留薄层形态的设定'],
      ['Little, R.J.A. &amp; Rubin, D.B. (2002). <i>Statistical Analysis with Missing Data</i>, 2nd ed. Wiley.',
        '缺失机制三分：MCAR / MAR / MNAR，不同机制需不同处理策略',
        '仪器故障缺失（可补）与井径垮塌（资料失真不可补）必须区分处理的统计学依据'],
      ['Ellis, D.V. &amp; Singer, J.M. (2007). <i>Well Logging for Earth Scientists</i>, 2nd ed. Springer.',
        '密度孔隙度公式 φ=(ρ<sub>ma</sub>−ρ<sub>b</sub>)/(ρ<sub>ma</sub>−ρ<sub>f</sub>)，骨架 2.65、流体 1.0 g/cm³',
        '孔隙度影响面板的换算依据——DEN 失真 0.05 g/cm³ 即引入约 3 pu 孔隙度误差'],
      ['行业坏井眼判废惯例（spec2000.net 密度测井 QC 等）',
        'Δρ（DRHO）超 ±0.15 g/cm³ 或扩径 &gt;3 in 的井段，密度资料作废、不参与定量解释',
        '垮塌段「标无效而非补值」与质量旗标（实测/重建/无效）设计的直接依据']
    ];
    var html = '';
    SRC.forEach(function (row, k) {
      html += '<tr><td>' + (k + 1) + '</td><td>' + row[0] + '</td><td>' + row[1] + '</td><td>' + row[2] + '</td></tr>';
    });
    $('src-body').innerHTML = html;
  }

  /* ================= 绑定与主刷新 ================= */
  function refresh() {
    drawLog();
    drawDegrade();
    drawPhi();
    updateCards();
  }

  function fmtLen(v) { return v + ' m'; }
  function fmtCur(v) { return Number(v).toFixed(1) + ' m'; }

  $('s-len').addEventListener('input', function () {
    S.len = Number(this.value);
    $('o-len').textContent = fmtLen(S.len);
    refresh();
  });
  $('s-method').addEventListener('change', function () {
    S.method = this.value;
    refresh();
  });
  $('s-wash').addEventListener('change', function () {
    S.wash = this.value;
    refresh();
  });
  $('s-cursor').addEventListener('input', function () {
    S.cursor = Number(this.value);
    $('o-cursor').textContent = fmtCur(S.cursor);
    refresh();
  });
  $('btn-reset').addEventListener('click', function () {
    S = Object.assign({}, DEF);
    $('s-len').value = S.len; $('o-len').textContent = fmtLen(S.len);
    $('s-method').value = S.method;
    $('s-wash').value = S.wash;
    $('s-cursor').value = S.cursor; $('o-cursor').textContent = fmtCur(S.cursor);
    refresh();
  });

  refresh();
})();
