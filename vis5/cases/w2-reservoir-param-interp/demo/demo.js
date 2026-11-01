/* ======= 储层参数智能解释 · 可运行示范 =======
   处理链：GR→Vsh(Larionov) → DEN/AC→Φ(Wyllie+密度) → Sw(Archie/Simandoux) → K(Timur) → 储层划分 */
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

  /* ---------- 确定性伪随机（合成井数据可复现） ---------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function boxSmooth(arr, w) {
    var n = arr.length, out = new Array(n), h = (w - 1) / 2;
    for (var i = 0; i < n; i++) {
      var s = 0, c = 0;
      for (var j = -h; j <= h; j++) {
        var k = i + j;
        if (k >= 0 && k < n) { s += arr[k]; c++; }
      }
      out[i] = s / c;
    }
    return out;
  }

  /* ---------- 合成井段 2360–2440 m，0.125 m，641 点 ---------- */
  var D0 = 2360, D1 = 2440, STEP = 0.125;
  var N = Math.round((D1 - D0) / STEP) + 1;
  /* [顶深, 底深, GR(API), AC(µs/m), DEN(g/cm³), CNL(%), RT(Ω·m)] */
  var ZONES = [
    [2360, 2366, 110, 330, 2.42, 32, 4.0],   /* 泥岩盖层 */
    [2366, 2382,  48, 300, 2.28, 22, 45],    /* 油层 SⅠ */
    [2382, 2386, 105, 325, 2.44, 30, 5.0],   /* 泥岩隔层 */
    [2386, 2394,  55, 298, 2.30, 23, 12],    /* 油层 SⅡ 上部 */
    [2394, 2402,  85, 300, 2.28, 26, 3.0],   /* 低阻油层段（泥质重） */
    [2402, 2418,  50, 298, 2.29, 22, 1.8],   /* 水层 */
    [2418, 2426,  60, 230, 2.58,  8, 60],    /* 致密夹层 */
    [2426, 2434,  52, 296, 2.30, 21, 2.2],   /* 水层 */
    [2434, 2440, 112, 335, 2.43, 33, 4.5]    /* 底界泥岩 */
  ];

  var DEP = [], GR = [], AC = [], DEN = [], CNL = [], RT = [];
  (function buildWell() {
    var rnd = mulberry32(20261030);
    var white = [];
    var i;
    for (i = 0; i < N; i++) white.push(rnd() * 2 - 1);
    var nz = boxSmooth(white, 7);
    var white2 = [];
    for (i = 0; i < N; i++) white2.push(rnd() * 2 - 1);
    var nz2 = boxSmooth(white2, 5);
    for (i = 0; i < N; i++) {
      var d = D0 + i * STEP;
      DEP.push(d);
      var z = ZONES[ZONES.length - 1];
      for (var k = 0; k < ZONES.length; k++) {
        if (d >= ZONES[k][0] && d < ZONES[k][1]) { z = ZONES[k]; break; }
      }
      GR.push(z[2] + nz[i] * 5);
      AC.push(z[3] + nz2[i] * 7);
      DEN.push(z[4] + nz[i] * 0.015);
      CNL.push(z[5] + nz2[i] * 1.6);
      RT.push(z[6] * (1 + nz2[i] * 0.10));
    }
    /* 轻度整体平滑，让层界过渡自然 */
    GR = boxSmooth(GR, 3);
    AC = boxSmooth(AC, 3);
    DEN = boxSmooth(DEN, 3);
    CNL = boxSmooth(CNL, 3);
    RT = boxSmooth(RT, 3);
  })();

  /* ---------- 静态计算道（与滑块无关，只算一次） ---------- */
  var GR_CLEAN = 45, GR_SH = 112;
  var RHO_MA = 2.65, RHO_F = 1.0, DT_MA = 182, DT_F = 620;
  var VSH = [], PHI = [], PHIE = [];
  (function computeStatics() {
    for (var i = 0; i < N; i++) {
      var igr = clamp((GR[i] - GR_CLEAN) / (GR_SH - GR_CLEAN), 0, 1);
      var vsh = 0.083 * (Math.pow(2, 3.7 * igr) - 1);       /* Larionov 1969 */
      var phid = (RHO_MA - DEN[i]) / (RHO_MA - RHO_F);      /* 密度孔隙度 */
      var phis = (AC[i] - DT_MA) / (DT_F - DT_MA);          /* Wyllie 时间平均 */
      var phi = clamp((phid + phis) / 2, 0, 0.45);
      VSH.push(clamp(vsh, 0, 1));
      PHI.push(phi);
      PHIE.push(clamp(phi * (1 - vsh), 0.002, 0.45));
    }
  })();

  /* ---------- 状态与输出 ---------- */
  var DEF = {
    model: 'archie', a: 1.00, m: 2.00, n: 2.00, rw: 0.060, rsh: 4.0,
    swirr: 25, phicut: 10, swcut: 65, cursor: 2388
  };
  var S = Object.assign({}, DEF);
  var SWA = [], SWS = [], SW = [], KK = [], CLS = [];
  var CLS_NAME = ['油层', '水层', '干层'];
  var CLS_COLOR = ['#2f7d6b', '#41699b', '#c9a15a'];

  /* Simandoux：A·Sw^n + B·Sw = C，单调递增，二分求解 */
  function solveSw(A, B, C, n) {
    var lo = 1e-4, hi = 1;
    for (var it = 0; it < 40; it++) {
      var mid = (lo + hi) / 2;
      if (A * Math.pow(mid, n) + B * mid - C > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  function compute() {
    var i;
    SWA.length = 0; SWS.length = 0; SW.length = 0; KK.length = 0; CLS.length = 0;
    for (i = 0; i < N; i++) {
      var pe = PHIE[i], rt = RT[i];
      var swa = Math.pow(S.a * S.rw / (Math.pow(pe, S.m) * rt), 1 / S.n);
      swa = clamp(swa, 0.02, 1);
      var A = Math.pow(pe, S.m) / (S.a * S.rw * (1 - VSH[i]));
      var B = VSH[i] / S.rsh;
      var sws = clamp(solveSw(A, B, 1 / rt, S.n), 0.02, 1);
      var kk = Math.pow(93 * Math.pow(pe, 2.2) / (S.swirr / 100), 2);  /* Timur 1968 */
      kk = clamp(kk, 0.001, 1e5);
      var sw = (S.model === 'sim') ? sws : swa;
      SWA.push(swa); SWS.push(sws); SW.push(sw); KK.push(kk);
      CLS.push(pe * 100 < S.phicut ? 2 : (sw * 100 <= S.swcut ? 0 : 1));
    }
  }

  /* ========== 图 1：综合测井解释成果图 ========== */
  var LW = 500, LH = 400, TOP = 26, BOT = 13, LEFT = 36, RIGHT = 6;
  var plotH = LH - TOP - BOT;
  var TW = [52, 52, 52, 52, 58, 52, 52, 56];
  var CWX = LEFT + TW.reduce(function (s, v) { return s + v; }, 0); /* 结论带左缘 */
  var CWW = LW - RIGHT - CWX;
  var hoverLog = -1;

  function yOfD(d) { return TOP + (d - D0) / (D1 - D0) * plotH; }
  function dOfY(y) { return D0 + (y - TOP) / plotH * (D1 - D0); }
  function xLin(t, v) { return t.x + clamp((v - t.min) / (t.max - t.min), 0, 1) * t.w; }
  function xLog(t, v) {
    var l0 = Math.log10(t.min), l1 = Math.log10(t.max);
    return t.x + clamp((Math.log10(Math.max(v, t.min)) - l0) / (l1 - l0), 0, 1) * t.w;
  }

  var TRACKS = [
    { name: 'GR API', scale: '0–150', min: 0, max: 150, color: '#c9a15a', data: GR },
    { name: 'AC µs/m', scale: '150–450', min: 150, max: 450, color: '#41699b', data: AC },
    { name: 'DEN g/cm³', scale: '2.1–2.8', min: 2.1, max: 2.8, color: '#b05a51', data: DEN },
    { name: 'CNL %', scale: '0–45', min: 0, max: 45, color: '#2f7d6b', data: CNL },
    { name: 'RT Ω·m', scale: '0.2–200', min: 0.2, max: 200, log: true, color: '#3d464b', data: RT },
    { name: 'Φ %', scale: '0–30', min: 0, max: 30 },
    { name: 'Sw %', scale: '0–100', min: 0, max: 100 },
    { name: 'K mD', scale: '0.01–1k', min: 0.01, max: 1000, log: true, data: KK }
  ];

  function polyline(ctx, t, data, color, dash, width) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(t.x, TOP, t.w, plotH);
    ctx.clip();
    ctx.beginPath();
    for (var i = 0; i < N; i++) {
      var x = t.log ? xLog(t, data[i]) : xLin(t, data[i]);
      var y = yOfD(DEP[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1.1;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.restore();
  }

  function drawLog() {
    var cv = $('cv-log');
    var ctx = setupCanvas(cv, LW, LH);
    ctx.clearRect(0, 0, LW, LH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, LW, LH);
    ctx.font = '8.5px "Segoe UI", "PingFang SC", sans-serif';

    /* 深度网格与标签 */
    var d, y;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (d = D0; d <= D1; d += 10) {
      y = yOfD(d);
      ctx.strokeStyle = '#ece5d6';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(LW - RIGHT, y); ctx.stroke();
      ctx.fillStyle = '#79828a';
      ctx.fillText(String(d), LEFT - 4, y);
    }

    /* 道头与道边框 */
    var x = LEFT;
    TRACKS.forEach(function (t, ti) {
      t.x = x; t.w = TW[ti];
      ctx.strokeStyle = '#e6e0d2';
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x + 0.5, TOP + 0.5, t.w - 1, plotH - 1);
      ctx.fillStyle = '#5d666d';
      ctx.textAlign = 'center';
      ctx.fillText(t.name, t.x + t.w / 2, 9);
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(t.scale, t.x + t.w / 2, 19);
      x += t.w;
    });
    /* 结论道 */
    ctx.strokeStyle = '#e6e0d2';
    ctx.strokeRect(CWX + 0.5, TOP + 0.5, CWW - 1, plotH - 1);
    ctx.fillStyle = '#5d666d';
    ctx.textAlign = 'center';
    ctx.fillText('解释', CWX + CWW / 2, 9);
    ctx.fillStyle = '#9ba3a9';
    ctx.fillText('结论', CWX + CWW / 2, 19);

    /* 常规曲线道 */
    TRACKS.forEach(function (t) {
      if (t.data) polyline(ctx, t, t.data, t.color);
    });

    /* Φ 道：总孔隙度（灰虚线）+ 有效孔隙度（绿实线 + 浅填充） */
    var tPhi = TRACKS[5];
    var phiPct = PHI.map(function (v) { return v * 100; });
    var phiePct = PHIE.map(function (v) { return v * 100; });
    ctx.save();
    ctx.beginPath(); ctx.rect(tPhi.x, TOP, tPhi.w, plotH); ctx.clip();
    ctx.beginPath();
    for (var i = 0; i < N; i++) {
      var px = xLin(tPhi, phiePct[i]), py = yOfD(DEP[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.lineTo(tPhi.x, yOfD(D1)); ctx.lineTo(tPhi.x, yOfD(D0)); ctx.closePath();
    ctx.fillStyle = 'rgba(47,125,107,0.12)';
    ctx.fill();
    ctx.restore();
    polyline(ctx, tPhi, phiPct, '#9ba3a9', [3, 2], 0.9);
    polyline(ctx, tPhi, phiePct, '#2f7d6b');

    /* Sw 道：截止竖线 + 对比模型（灰虚线）+ 当前模型（蓝实线） */
    var tSw = TRACKS[6];
    var swaPct = SWA.map(function (v) { return v * 100; });
    var swsPct = SWS.map(function (v) { return v * 100; });
    var swSel = (S.model === 'sim') ? swsPct : swaPct;
    var swAlt = (S.model === 'sim') ? swaPct : swsPct;
    var xCut = xLin(tSw, S.swcut);
    ctx.save();
    ctx.beginPath(); ctx.rect(tSw.x, TOP, tSw.w, plotH); ctx.clip();
    ctx.strokeStyle = '#b05a51';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xCut, TOP); ctx.lineTo(xCut, TOP + plotH); ctx.stroke();
    ctx.restore();
    polyline(ctx, tSw, swAlt, '#9ba3a9', [3, 2], 0.9);
    polyline(ctx, tSw, swSel, '#41699b');

    /* K 道由 TRACKS 通用绘制完成（data=KK） */

    /* 结论色带 */
    for (i = 0; i < N; i++) {
      var y0 = yOfD(DEP[i]);
      ctx.fillStyle = CLS_COLOR[CLS[i]];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(CWX + 1, y0, CWW - 2, yOfD(DEP[i] + STEP) - y0 + 0.6);
    }
    ctx.globalAlpha = 1;

    /* 深度游标（红实线 + 标签） */
    y = yOfD(S.cursor);
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(LW - RIGHT, y); ctx.stroke();
    ctx.fillStyle = '#b05a51';
    ctx.textAlign = 'left';
    ctx.fillText(S.cursor.toFixed(1) + ' m', LEFT + 3, y - 6);

    /* 悬停横线 */
    if (hoverLog >= 0) {
      y = yOfD(DEP[hoverLog]);
      ctx.strokeStyle = '#79828a';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(LW - RIGHT, y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ========== 图 2：孔隙度—渗透率交会图 ========== */
  var XW = 440, XH = 260, XL = 42, XR = 10, XT = 12, XB = 28;
  var xpW = XW - XL - XR, xpH = XH - XT - XB;
  var hoverXp = -1;

  function xOfPhi(p) { return XL + clamp(p / 0.30, 0, 1) * xpW; }
  function yOfK(k) { return XT + (3 - clamp(Math.log10(Math.max(k, 0.01)), -2, 3)) / 5 * xpH; }
  function timurK(phiFrac, swirrFrac) { return Math.pow(93 * Math.pow(phiFrac, 2.2) / swirrFrac, 2); }

  function drawXp() {
    var cv = $('cv-xp');
    var ctx = setupCanvas(cv, XW, XH);
    ctx.clearRect(0, 0, XW, XH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, XW, XH);
    ctx.font = '8.5px "Segoe UI", "PingFang SC", sans-serif';

    /* 网格与坐标轴 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var p, k;
    for (p = 0; p <= 30; p += 5) {
      var gx = xOfPhi(p / 100);
      ctx.strokeStyle = '#f0ebdf';
      ctx.beginPath(); ctx.moveTo(gx, XT); ctx.lineTo(gx, XT + xpH); ctx.stroke();
      ctx.fillStyle = '#79828a';
      ctx.fillText(String(p), gx, XT + xpH + 4);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [0.01, 0.1, 1, 10, 100, 1000].forEach(function (kv) {
      var gy = yOfK(kv);
      ctx.strokeStyle = '#f0ebdf';
      ctx.beginPath(); ctx.moveTo(XL, gy); ctx.lineTo(XL + xpW, gy); ctx.stroke();
      ctx.fillStyle = '#79828a';
      ctx.fillText(kv >= 1 ? String(kv) : kv.toFixed(2), XL - 4, gy);
    });
    ctx.strokeStyle = '#ded8c8';
    ctx.strokeRect(XL + 0.5, XT + 0.5, xpW - 1, xpH - 1);
    /* 轴标题 */
    ctx.fillStyle = '#5d666d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('有效孔隙度 Φe (%)', XL + xpW / 2, XH - 12);
    ctx.save();
    ctx.translate(9, XT + xpH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText('渗透率 K (mD)', 0, 0);
    ctx.restore();

    /* Timur 参考线：Swirr=10/40% 灰色，当前 Swirr 红色 */
    function timurLine(swirrFrac, color, width) {
      ctx.beginPath();
      var started = false;
      for (var pi = 0.05; pi <= 0.3001; pi += 0.005) {
        var kv = timurK(pi, swirrFrac);
        if (kv > 2000) break;
        var x = xOfPhi(pi), yy = yOfK(kv);
        if (!started) { ctx.moveTo(x, yy); started = true; } else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    timurLine(0.10, '#c3c9cd', 1);
    timurLine(0.40, '#c3c9cd', 1);
    timurLine(S.swirr / 100, '#b05a51', 1.4);
    /* 参考线标签（错开位置，避免相互重叠） */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    function timurLabel(swirrFrac, phiAt, txt, color, dy) {
      var kv = timurK(phiAt, swirrFrac);
      ctx.fillStyle = color;
      ctx.fillText(txt, xOfPhi(phiAt) + 6, yOfK(kv) + (dy || 0));
    }
    timurLabel(0.10, 0.12, 'Swirr 10%', '#8a9298');
    timurLabel(0.40, 0.18, 'Swirr 40%', '#8a9298');
    timurLabel(S.swirr / 100, 0.12, '当前 ' + S.swirr + '%', '#b05a51', 12);

    /* 孔隙度截止竖线 */
    var xc = xOfPhi(S.phicut / 100);
    ctx.strokeStyle = '#b05a51';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xc, XT); ctx.lineTo(xc, XT + xpH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51';
    ctx.textAlign = 'left';
    ctx.fillText('Φ 截止 ' + S.phicut + '%', xc + 3, XT + 8);

    /* 散点 */
    for (var i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.arc(xOfPhi(PHIE[i]), yOfK(KK[i]), i === hoverXp ? 3.4 : 1.7, 0, Math.PI * 2);
      ctx.fillStyle = CLS_COLOR[CLS[i]];
      ctx.globalAlpha = i === hoverXp ? 1 : 0.75;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* 深度游标对应点 */
    var ci = clamp(Math.round((S.cursor - D0) / STEP), 0, N - 1);
    ctx.beginPath();
    ctx.arc(xOfPhi(PHIE[ci]), yOfK(KK[ci]), 4.2, 0, Math.PI * 2);
    ctx.strokeStyle = '#242b2e';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  /* ========== 指标卡与结论 ========== */
  function renderMetrics() {
    var oil = 0, water = 0, net = 0, sumPhi = 0, sumLnK = 0, sumSo = 0;
    var i;
    for (i = 0; i < N; i++) {
      if (CLS[i] !== 2) { net++; sumPhi += PHIE[i]; sumLnK += Math.log(KK[i]); }
      if (CLS[i] === 0) { oil++; sumSo += 1 - SW[i]; }
      else if (CLS[i] === 1) { water++; }
    }
    /* 低阻油层段 2394–2402 m 两模型对比 */
    var loA = 0, loS = 0, loN = 0;
    for (i = 0; i < N; i++) {
      if (DEP[i] >= 2394 && DEP[i] < 2402) { loA += SWA[i]; loS += SWS[i]; loN++; }
    }
    loA = loA / loN * 100; loS = loS / loN * 100;

    $('m-oil').textContent = (oil * STEP).toFixed(1) + ' m';
    $('m-water').textContent = (water * STEP).toFixed(1) + ' m';
    $('m-phi').textContent = net ? (sumPhi / net * 100).toFixed(1) + ' %' : '—';
    $('m-k').textContent = net ? Math.exp(sumLnK / net).toFixed(1) + ' mD' : '—';
    $('m-so').textContent = oil ? (sumSo / oil * 100).toFixed(1) + ' %' : '—';

    var flip = (loA > S.swcut && loS <= S.swcut);
    $('verdict').innerHTML =
      '当前口径（' + (S.model === 'sim' ? 'Simandoux' : 'Archie') + '）：净储层 <b>' + (net * STEP).toFixed(1) +
      ' m</b>，其中油层 <b>' + (oil * STEP).toFixed(1) + ' m</b>、水层 <b>' + (water * STEP).toFixed(1) +
      ' m</b>。2394–2402 m 低阻段：Archie 平均 Sw≈<b>' + loA.toFixed(0) + '%</b>（判水层），Simandoux 校正泥质导电后 ≈<b>' +
      loS.toFixed(0) + '%</b>（' + (loS <= S.swcut ? '判油层' : '仍判水层') + '）——' +
      (flip ? '泥质导电使 Archie 系统性高估 Sw，低阻油层须用 Simandoux / Indonesia 公式复核，与本案例 3 个低阻层段的处理一致。'
            : '切换「饱和度模型」即可对比两种口径下该段的划分差异。');
  }

  /* ========== 悬停 tooltip ========== */
  function showTip(tip, html, px, py, boxW, boxH) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var lx = px + 14, ly = py + 12;
    if (lx + tw > boxW) lx = px - tw - 10;
    if (ly + th > boxH) ly = py - th - 8;
    tip.style.left = lx + 'px';
    tip.style.top = ly + 'px';
  }

  function bindLog() {
    var cv = $('cv-log'), tip = $('tip-log');
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      var ly = py * (LH / r.height);
      if (ly < TOP || ly > TOP + plotH) { hoverLog = -1; tip.style.display = 'none'; drawLog(); return; }
      var idx = clamp(Math.round((dOfY(ly) - D0) / STEP), 0, N - 1);
      hoverLog = idx;
      drawLog();
      showTip(tip,
        '<b>' + DEP[idx].toFixed(2) + ' m</b> · ' + CLS_NAME[CLS[idx]] + '<br>' +
        'GR <b>' + GR[idx].toFixed(0) + '</b> API · AC <b>' + AC[idx].toFixed(0) + '</b> µs/m<br>' +
        'DEN <b>' + DEN[idx].toFixed(2) + '</b> g/cm³ · CNL <b>' + CNL[idx].toFixed(0) + '</b> %<br>' +
        'RT <b>' + RT[idx].toFixed(1) + '</b> Ω·m · Vsh <b>' + (VSH[idx] * 100).toFixed(0) + '</b> %<br>' +
        'Φe <b>' + (PHIE[idx] * 100).toFixed(1) + '</b> % · Sw <b>' + (SW[idx] * 100).toFixed(0) + '</b> % · K <b>' + KK[idx].toFixed(1) + '</b> mD',
        px, py, r.width, r.height);
    });
    cv.addEventListener('mouseleave', function () {
      hoverLog = -1; tip.style.display = 'none'; drawLog();
    });
  }

  function bindXp() {
    var cv = $('cv-xp'), tip = $('tip-xp');
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      var lx = px * (XW / r.width), ly = py * (XH / r.height);
      var best = -1, bestD = 12;
      for (var i = 0; i < N; i++) {
        var dx = xOfPhi(PHIE[i]) - lx, dy = yOfK(KK[i]) - ly;
        var dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < bestD) { bestD = dd; best = i; }
      }
      hoverXp = best;
      drawXp();
      if (best >= 0) {
        showTip(tip,
          '<b>' + DEP[best].toFixed(2) + ' m</b> · ' + CLS_NAME[CLS[best]] + '<br>' +
          'Φe <b>' + (PHIE[best] * 100).toFixed(1) + '</b> % · K <b>' + KK[best].toFixed(1) + '</b> mD<br>' +
          'Sw <b>' + (SW[best] * 100).toFixed(0) + '</b> % · Vsh <b>' + (VSH[best] * 100).toFixed(0) + '</b> %',
          px, py, r.width, r.height);
      } else {
        tip.style.display = 'none';
      }
    });
    cv.addEventListener('mouseleave', function () {
      hoverXp = -1; tip.style.display = 'none'; drawXp();
    });
  }

  /* ========== 控件绑定 ========== */
  var KEYS = ['a', 'm', 'n', 'rw', 'rsh', 'swirr', 'phicut', 'swcut', 'cursor'];
  var OUT = {
    a: function (v) { return v.toFixed(2); },
    m: function (v) { return v.toFixed(2); },
    n: function (v) { return v.toFixed(2); },
    rw: function (v) { return v.toFixed(3) + ' Ω·m'; },
    rsh: function (v) { return v.toFixed(1) + ' Ω·m'; },
    swirr: function (v) { return v.toFixed(0) + ' %'; },
    phicut: function (v) { return v.toFixed(1) + ' %'; },
    swcut: function (v) { return v.toFixed(0) + ' %'; },
    cursor: function (v) { return v.toFixed(1) + ' m'; }
  };

  function syncUI() {
    KEYS.forEach(function (k) {
      var el = $('s-' + k), out = $('o-' + k);
      if (el) el.value = S[k];
      if (out) out.textContent = OUT[k](S[k]);
    });
    $('sel-model').value = S.model;
  }

  function update() {
    compute();
    drawLog();
    drawXp();
    renderMetrics();
  }

  KEYS.forEach(function (k) {
    var el = $('s-' + k);
    if (!el) return;
    el.addEventListener('input', function () {
      S[k] = parseFloat(el.value);
      var out = $('o-' + k);
      if (out) out.textContent = OUT[k](S[k]);
      update();
    });
  });
  $('sel-model').addEventListener('change', function () {
    S.model = this.value;
    update();
  });
  $('btn-reset').addEventListener('click', function () {
    S = Object.assign({}, DEF);
    syncUI();
    update();
  });

  /* 页签切换 */
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      $('pane-' + btn.getAttribute('data-tab')).classList.add('active');
    });
  });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { drawLog(); drawXp(); }, 120);
  });

  bindLog();
  bindXp();
  syncUI();
  update();
})();
