/* ======= 井眼轨迹智能导向控制 · 可运行示范 ======= */
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

  /* 确定性伪随机数（mulberry32），保证 3 口井轨迹可复现 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var DEG = Math.PI / 180;
  var KOP = 1200, TD = 2800, DS = 12;       /* 造斜点 / 完钻井深 / 测点间隔 */
  var BUILD = 2.2 / 30;                      /* 设计造斜率 2.2°/30 m (°/m) */
  var R_BUILD = 1 / (BUILD * DEG);           /* 造斜曲率半径 ≈ 781.7 m */
  var AZ_DES = 65;                           /* 设计方位 65° */
  var TGT_DISP = 1100;                       /* 设计水平位移 1100 m */
  var WIN_R = 8;                             /* 靶区窗口半径 8 m */
  var RED_LINE = 4.5;                        /* 防碰红线 4.5 m */

  /* ---------- 设计轨道：求解稳斜角使水平位移 = 1100 m ---------- */
  function designDispOf(thetaDeg) {
    var th = thetaDeg * DEG;
    var mdBuild = thetaDeg / BUILD;
    var rem = (TD - KOP) - mdBuild;
    /* 增斜段：dH = R(1−cosθ)；稳斜段：dH = rem·sinθ */
    return R_BUILD * (1 - Math.cos(th)) + rem * Math.sin(th);
  }
  var DESIGN_INC = (function () {
    var lo = 20, hi = 80;
    for (var k = 0; k < 60; k++) {
      var mid = (lo + hi) / 2;
      if (designDispOf(mid) < TGT_DISP) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  })();
  var MD_BUILD_END = KOP + DESIGN_INC / BUILD;

  function designIncAt(md) {
    if (md <= KOP) return 0;
    if (md <= MD_BUILD_END) return (md - KOP) * BUILD;
    return DESIGN_INC;
  }

  /* 测点网格：0–2796 m 每 12 m 一点，末段 4 m 补齐到完钻 2800 m */
  var MD_ARR = (function () {
    var a = [];
    for (var md = 0; md <= 2796; md += DS) a.push(md);
    a.push(TD);
    return a;
  })();
  var NSTA = MD_ARR.length - 1;

  /* 切线法逐步积分轨迹（演示口径；最小曲率法见「真实数据来源」页签） */
  function integrate(incArr, azArr) {
    var n = incArr.length;
    var N = 0, E = 0, TVD = 0;
    var out = [{ md: 0, tvd: 0, H: 0, lat: 0 }];
    var azR = AZ_DES * DEG, cA = Math.cos(azR), sA = Math.sin(azR);
    for (var i = 1; i < n; i++) {
      var ds = MD_ARR[i] - MD_ARR[i - 1];
      var inc = (incArr[i] + incArr[i - 1]) / 2 * DEG;
      var az = (azArr[i] + azArr[i - 1]) / 2 * DEG;
      N += ds * Math.sin(inc) * Math.cos(az);
      E += ds * Math.sin(inc) * Math.sin(az);
      TVD += ds * Math.cos(inc);
      out.push({
        md: MD_ARR[i],
        tvd: TVD,
        H: N * cA + E * sA,
        lat: -N * sA + E * cA
      });
    }
    return out;
  }

  /* 设计轨道数组 */
  var DES = (function () {
    var inc = [], az = [];
    for (var i = 0; i <= NSTA; i++) { inc.push(designIncAt(MD_ARR[i])); az.push(AZ_DES); }
    var path = integrate(inc, az);
    return { inc: inc, az: az, path: path, tvdTD: path[NSTA].tvd, hTD: path[NSTA].H };
  })();

  /* ---------- 单井实钻轨迹生成：误差随机游走 + MPC 纠偏回拉 ---------- */
  function genWell(cfg) {
    var rng = mulberry32(cfg.seed);
    var n0 = Math.round(KOP / DS);            /* 造斜点测点序号 */
    var corrIdx = cfg.corr.map(function (d) { return Math.round(d / DS); });

    /* 井斜误差 err（°）与方位误差 azErr（°） */
    var errInc = [], errAz = [], slope = [], slide = [];
    var e = 0, ea = 0, s = 0, sa = 0, holdUntil = -1, holdS = 0, pb = false;
    for (var i = 0; i <= NSTA; i++) {
      var md = MD_ARR[i];
      var inBuild = md > KOP && md <= MD_BUILD_END;
      var sMax = inBuild ? 0.008 : 0.04;      /* 随机游走斜率上限（保狗腿 ≤2.4°/30 m） */
      if (i > 0) {
        if (corrIdx.indexOf(i) >= 0) {
          /* 纠偏点：MPC 回拉，把误差在一柱（48 m）内收敛 */
          holdUntil = i + 3;
          holdS = clamp(-e / ((holdUntil - i) * DS), -0.045, 0.045);
          if (Math.abs(holdS) < 0.03) holdS = (holdS >= 0 ? 1 : -1) * 0.03;
          s = holdS;
          sa = clamp(-ea / ((holdUntil - i) * DS), -0.02, 0.02);
          pb = true;
        } else if (i <= holdUntil) {
          s = holdS;
        } else if (pb || i % 6 === 0) {
          pb = false;
          s = (rng() - 0.5) * 2 * sMax;
          sa = (rng() - 0.5) * 0.02;
        }
        e += s * DS; ea += sa * DS;
        errInc.push(e); errAz.push(ea);
      } else {
        errInc.push(0); errAz.push(0);
      }
      slope.push(s);
      /* 滑动段：纠偏回拉窗口内必定滑动，稳斜段内按概率零星滑动 */
      slide.push(md > MD_BUILD_END && i > 0 && (i <= holdUntil || rng() < cfg.slideP));
    }

    /* 首轮积分，按目标靶心偏差整体缩放误差 */
    function pathWith(k) {
      var inc = [], az = [];
      for (var i = 0; i <= NSTA; i++) {
        inc.push(designIncAt(MD_ARR[i]) + errInc[i] * k);
        az.push(AZ_DES + errAz[i] * k);
      }
      return { inc: inc, az: az, path: integrate(inc, az) };
    }
    var p0 = pathWith(1);
    var miss0 = Math.hypot(p0.path[NSTA].H - DES.hTD, p0.path[NSTA].lat);
    var k = miss0 > 0.01 ? cfg.miss / miss0 : 1;
    var P = pathWith(k);

    /* 指标统计 */
    var dlsMax = 0;
    for (var j = n0 + 1; j <= NSTA; j++) {
      var dI = (P.inc[j] - P.inc[j - 1]);
      var dA = (P.az[j] - P.az[j - 1]) * Math.sin((P.inc[j] + P.inc[j - 1]) / 2 * DEG);
      var dls = Math.sqrt(dI * dI + dA * dA) / DS * 30;
      if (dls > dlsMax) dlsMax = dls;
    }
    var slideCnt = 0;
    for (var q = n0; q <= NSTA; q++) if (slide[q]) slideCnt++;
    var miss = Math.hypot(P.path[NSTA].H - DES.hTD, P.path[NSTA].lat);

    /* 防碰扫描曲线：接近老井群时距离收窄成谷，过最近点后重新拉开 */
    var anti = [];
    var aMin = 1e9, aMinI = 0;
    for (var a = 0; a <= NSTA; a++) {
      var md2 = MD_ARR[a];
      var valley = Math.exp(-Math.pow((md2 - cfg.antiMd) / 280, 2));
      var d = 42 - 36 * valley
        + 1.5 * Math.sin(md2 / 150 + cfg.seed) * (1 - valley)
        + (rng() - 0.5) * 0.7;
      anti.push(d);
      if (md2 > 1500 && d < aMin) { aMin = d; aMinI = a; }
    }
    var shift = cfg.antiMin - aMin;
    for (var b = 0; b <= NSTA; b++) anti[b] += shift;

    return {
      name: cfg.name, inc: P.inc, az: P.az, path: P.path, anti: anti,
      corrIdx: corrIdx, slide: slide, slideRatio: slideCnt * DS / (TD - KOP),
      dlsMax: dlsMax, miss: miss, antiMin: cfg.antiMin, antiMinMd: MD_ARR[aMinI],
      errInc: errInc, errAz: errAz
    };
  }

  var WELLS = [
    genWell({
      name: 'P-1', seed: 20261001, miss: 4.2, antiMin: 5.8, antiMd: 2420, slideP: 0.04,
      corr: [2124, 2208, 2292, 2388, 2472, 2556, 2640, 2724]
    }),
    genWell({
      name: 'P-2', seed: 20261002, miss: 5.6, antiMin: 5.1, antiMd: 2350, slideP: 0.16,
      corr: [2136, 2232, 2328, 2424, 2520, 2616, 2712]
    }),
    genWell({
      name: 'P-3', seed: 20261003, miss: 6.4, antiMin: 6.3, antiMd: 2520, slideP: 0.06,
      corr: [2112, 2208, 2304, 2400, 2496, 2592, 2688, 2760]
    })
  ];

  var S = { well: 0, cursor: 2460 };

  function well() { return WELLS[S.well]; }
  function staIdx(md) {
    if (md >= (MD_ARR[NSTA - 1] + TD) / 2) return NSTA;
    return clamp(Math.round(md / DS), 0, NSTA);
  }

  /* ================= ① 轨迹垂直剖面 ================= */
  var PR = { W: 920, H: 420, pl: 56, pr: 20, pt: 30, pb: 36 };
  function drawProfile() {
    var w = well();
    var W = PR.W, H = PR.H, pl = PR.pl, pr = PR.pr, pt = PR.pt, pb = PR.pb;
    var pw = W - pl - pr, ph = H - pt - pb;
    var xMax = 1300, yMax = 2400;
    var X = function (h) { return pl + h / xMax * pw; };
    var Y = function (tvd) { return pt + tvd / yMax * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    var gx, gy;
    for (gx = 0; gx <= xMax; gx += 200) {
      s += '<line x1="' + X(gx) + '" y1="' + pt + '" x2="' + X(gx) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + X(gx) + '" y="' + (pt + ph + 14) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + gx + '</text>';
    }
    for (gy = 0; gy <= yMax; gy += 400) {
      s += '<line x1="' + pl + '" y1="' + Y(gy) + '" x2="' + (pl + pw) + '" y2="' + Y(gy) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (Y(gy) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gy + '</text>';
    }
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">水平位移 (m)</text>';
    s += '<text x="' + (pl - 42) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 42) + ' ' + (pt + ph / 2) + ')">垂深 TVD (m)</text>';

    /* 造斜段底部分界（稳斜段起点） */
    var xBE = X(DES.path[staIdx(MD_BUILD_END)].H), yBE = Y(DES.path[staIdx(MD_BUILD_END)].tvd);
    s += '<line x1="' + xBE.toFixed(1) + '" y1="' + yBE.toFixed(1) + '" x2="' + xBE.toFixed(1) + '" y2="' + (yBE - 16) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<text x="' + xBE.toFixed(1) + '" y="' + (yBE - 20) + '" font-size="8.5" fill="#9a7a1c" text-anchor="middle">造斜段结束 ' + Math.round(MD_BUILD_END) + ' m · 稳斜 ' + DESIGN_INC.toFixed(1) + '°</text>';

    /* 造斜点标注 */
    s += '<circle cx="' + X(0) + '" cy="' + Y(KOP) + '" r="4" fill="#41699b" stroke="#fff" stroke-width="1.4"/>';
    s += '<text x="' + (X(0) + 10) + '" y="' + (Y(KOP) - 6) + '" font-size="9" fill="#41699b" font-weight="600">造斜点 KOP 1200 m</text>';

    /* 靶区窗口：半径 8 m 圆柱靶（剖面为椭圆，两轴比例不同） */
    var tx = X(DES.hTD), ty = Y(DES.tvdTD);
    var rx = WIN_R / xMax * pw, ry = WIN_R / yMax * ph;
    s += '<ellipse cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" rx="' + (rx * 3).toFixed(1) + '" ry="' + (ry * 3).toFixed(1) + '" fill="#c9a15a" opacity="0.15"/>';
    s += '<ellipse cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" fill="#c9a15a" opacity="0.55" stroke="#9a7a1c" stroke-width="1"/>';
    s += '<text x="' + (tx - 8) + '" y="' + (ty - 16) + '" font-size="9" fill="#9a7a1c" text-anchor="end" font-weight="600">靶区窗口 r=8 m</text>';
    s += '<text x="' + (tx - 8) + '" y="' + (ty - 6) + '" font-size="8.5" fill="#9a7a1c" text-anchor="end">靶心 位移 1100 m · TVD ' + Math.round(DES.tvdTD) + ' m</text>';

    /* 设计轨道（虚线） */
    var dDes = '';
    for (var i = 0; i <= NSTA; i += 2) {
      dDes += (i ? 'L' : 'M') + X(DES.path[i].H).toFixed(1) + ' ' + Y(DES.path[i].tvd).toFixed(1) + ' ';
    }
    s += '<path d="' + dDes + '" fill="none" stroke="#8a9298" stroke-width="1.6" stroke-dasharray="6 4"/>';

    /* 实钻轨迹 */
    var dAct = '';
    for (var j = 0; j <= NSTA; j++) {
      dAct += (j ? 'L' : 'M') + X(w.path[j].H).toFixed(1) + ' ' + Y(w.path[j].tvd).toFixed(1) + ' ';
    }
    s += '<path d="' + dAct + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';

    /* 纠偏点 */
    w.corrIdx.forEach(function (ci) {
      var cx = X(w.path[ci].H), cy = Y(w.path[ci].tvd);
      s += '<path d="M' + cx.toFixed(1) + ' ' + (cy - 4.5).toFixed(1) + ' L' + (cx + 4.5).toFixed(1) + ' ' + cy.toFixed(1) + ' L' + cx.toFixed(1) + ' ' + (cy + 4.5).toFixed(1) + ' L' + (cx - 4.5).toFixed(1) + ' ' + cy.toFixed(1) + ' Z" fill="#b05a51" stroke="#fff" stroke-width="1"/>';
    });

    /* 测点游标 */
    var ci2 = staIdx(S.cursor);
    var cx2 = X(w.path[ci2].H), cy2 = Y(w.path[ci2].tvd);
    s += '<circle cx="' + cx2.toFixed(1) + '" cy="' + cy2.toFixed(1) + '" r="5.5" fill="none" stroke="#c9a15a" stroke-width="2"/>';
    s += '<circle cx="' + cx2.toFixed(1) + '" cy="' + cy2.toFixed(1) + '" r="2.4" fill="#c9a15a"/>';

    /* 图例文字（顶部注记带，避开曲线区） */
    s += '<text x="' + (pl + 4) + '" y="' + (pt - 8) + '" font-size="9" fill="#8a9298">P-' + (S.well + 1) + ' 井 · 设计 ' + TGT_DISP + ' m 位移 / 靶心 TVD ' + Math.round(DES.tvdTD) + ' m · 红色菱形为纠偏点（共 ' + w.corrIdx.length + ' 次）</text>';

    $('sec-profile').innerHTML = s;
  }

  function bindProfile() {
    var svg = $('sec-profile'), tip = $('tip-profile'), box = $('box-profile');
    var W = PR.W, pl = PR.pl, pr = PR.pr, pt = PR.pt, pb = PR.pb;
    var pw = W - pl - pr, ph = PR.H - pt - pb;
    var xMax = 1300, yMax = 2400;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var vy = (evt.clientY - r.top) * (PR.H / r.height);
      var w = well(), best = -1, bd = 22 * 22;
      for (var i = 0; i <= NSTA; i += 1) {
        var px = pl + w.path[i].H / xMax * pw;
        var py = pt + w.path[i].tvd / yMax * ph;
        var d2 = (px - vx) * (px - vx) + (py - vy) * (py - vy);
        if (d2 < bd) { bd = d2; best = i; }
      }
      if (best >= 0) {
        var md = MD_ARR[best];
        var dev = Math.hypot(w.path[best].H - DES.path[best].H, w.path[best].lat);
        tip.innerHTML = '<b>测深 ' + md.toFixed(0) + ' m</b>（TVD ' + w.path[best].tvd.toFixed(0) + ' m）<br>' +
          '井斜 <b>' + w.inc[best].toFixed(1) + '°</b> · 方位 <b>' + w.az[best].toFixed(1) + '°</b><br>' +
          '与设计偏差 <b>' + dev.toFixed(1) + ' m</b>' + (w.corrIdx.indexOf(best) >= 0 ? ' · <span style="color:#b05a51">纠偏点</span>' : '');
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 80) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= ② 井斜角 / 方位角沿井深 ================= */
  var AN = { W: 920, H: 260, pl: 46, pr: 46, pt: 24, pb: 30 };
  function drawAngles() {
    var w = well();
    var W = AN.W, H = AN.H, pl = AN.pl, pr = AN.pr, pt = AN.pt, pb = AN.pb;
    var pw = W - pl - pr, ph = H - pt - pb;
    var incMax = 75, azMin = 60, azMax = 70;
    var X = function (md) { return pl + md / TD * pw; };
    var YI = function (inc) { return pt + ph - inc / incMax * ph; };
    var YA = function (az) { return pt + ph - (az - azMin) / (azMax - azMin) * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    var v, t;
    for (v = 0; v <= incMax; v += 15) {
      s += '<line x1="' + pl + '" y1="' + YI(v) + '" x2="' + (pl + pw) + '" y2="' + YI(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (YI(v) + 3) + '" font-size="8.5" fill="#2f7d6b" text-anchor="end" font-family="monospace">' + v + '</text>';
    }
    for (v = azMin; v <= azMax; v += 2) {
      s += '<text x="' + (pl + pw + 6) + '" y="' + (YA(v) + 3) + '" font-size="8.5" fill="#41699b" text-anchor="start" font-family="monospace">' + v + '</text>';
    }
    for (t = 0; t <= TD; t += 400) {
      s += '<line x1="' + X(t) + '" y1="' + pt + '" x2="' + X(t) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + X(t) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + t + '</text>';
    }
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">测深 MD (m)</text>';
    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#2f7d6b" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">井斜角 (°)</text>';
    s += '<text x="' + (pl + pw + 38) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#41699b" text-anchor="middle" transform="rotate(90 ' + (pl + pw + 38) + ' ' + (pt + ph / 2) + ')">方位角 (°)</text>';

    /* 造斜点 / 地层倾角突变分界 */
    [KOP, 2400].forEach(function (md, k) {
      s += '<line x1="' + X(md) + '" y1="' + pt + '" x2="' + X(md) + '" y2="' + (pt + ph) + '" stroke="' + (k ? '#c9a15a' : '#41699b') + '" stroke-width="1" stroke-dasharray="4 3"/>';
    });
    s += '<text x="' + (X(KOP) + 4) + '" y="' + (pt + 10) + '" font-size="8.5" fill="#41699b">KOP</text>';
    s += '<text x="' + (X(2400) + 4) + '" y="' + (pt + 10) + '" font-size="8.5" fill="#9a7a1c">2400 m 倾角 6°→11°</text>';

    /* 设计井斜（虚线）与设计方位 */
    var dDes = '';
    for (var i = 0; i <= NSTA; i += 2) dDes += (i ? 'L' : 'M') + X(MD_ARR[i]).toFixed(1) + ' ' + YI(DES.inc[i]).toFixed(1) + ' ';
    s += '<path d="' + dDes + '" fill="none" stroke="#8a9298" stroke-width="1.2" stroke-dasharray="5 4"/>';
    s += '<line x1="' + pl + '" y1="' + YA(AZ_DES) + '" x2="' + (pl + pw) + '" y2="' + YA(AZ_DES) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 3"/>';

    /* 实钻井斜 / 方位 */
    var dI = '', dA = '';
    for (var j = 0; j <= NSTA; j++) {
      dI += (j ? 'L' : 'M') + X(MD_ARR[j]).toFixed(1) + ' ' + YI(w.inc[j]).toFixed(1) + ' ';
      dA += (j ? 'L' : 'M') + X(MD_ARR[j]).toFixed(1) + ' ' + YA(w.az[j]).toFixed(1) + ' ';
    }
    s += '<path d="' + dA + '" fill="none" stroke="#41699b" stroke-width="1.6"/>';
    s += '<path d="' + dI + '" fill="none" stroke="#2f7d6b" stroke-width="2"/>';

    /* 曲线末端标注（错开 ≥12px） */
    var endIncY = YI(w.inc[NSTA]) + 3, endAzY = YA(w.az[NSTA]) + 3;
    if (endAzY > endIncY && endAzY - endIncY < 12) endAzY = endIncY + 12;
    if (endIncY > endAzY && endIncY - endAzY < 12) endIncY = endAzY + 12;
    s += '<text x="' + (X(TD) - 6) + '" y="' + endIncY.toFixed(1) + '" font-size="8.5" fill="#2f7d6b" text-anchor="end" font-family="monospace" font-weight="600">井斜 ' + w.inc[NSTA].toFixed(1) + '°</text>';
    s += '<text x="' + (X(TD) - 6) + '" y="' + endAzY.toFixed(1) + '" font-size="8.5" fill="#41699b" text-anchor="end" font-family="monospace" font-weight="600">方位 ' + w.az[NSTA].toFixed(1) + '°</text>';

    /* 测点游标 */
    var cx = X(S.cursor);
    s += '<line x1="' + cx + '" y1="' + pt + '" x2="' + cx + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1.4"/>';

    $('sec-angles').innerHTML = s;
  }

  function bindAngles() {
    var svg = $('sec-angles'), tip = $('tip-angles'), box = $('box-angles');
    var W = AN.W, pl = AN.pl, pr = AN.pr;
    var pw = W - pl - pr;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var md = clamp((vx - pl) / pw * TD, 0, TD);
      var i = staIdx(md);
      var w = well();
      tip.innerHTML = '<b>测深 ' + MD_ARR[i].toFixed(0) + ' m</b><br>' +
        '井斜 <b>' + w.inc[i].toFixed(2) + '°</b>（设计 ' + DES.inc[i].toFixed(1) + '°）<br>' +
        '方位 <b>' + w.az[i].toFixed(2) + '°</b>（设计 65.0°）';
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 76) + 'px';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= ③ 防碰扫描（canvas） ================= */
  var AC = { W: 920, H: 260, pl: 46, pr: 16, pt: 24, pb: 30 };
  function drawAnti() {
    var cv = $('sec-anti');
    var ctx = setupCanvas(cv, AC.W, AC.H);
    var w = well();
    var W = AC.W, H = AC.H, pl = AC.pl, pr = AC.pr, pt = AC.pt, pb = AC.pb;
    var pw = W - pl - pr, ph = H - pt - pb;
    var dMax = Math.max(20, Math.ceil(Math.max.apply(null, w.anti) / 10) * 10);
    var X = function (md) { return pl + md / TD * pw; };
    var Y = function (d) { return pt + ph - d / dMax * ph; };

    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#efece1';
    ctx.lineWidth = 1;
    ctx.font = '8.5px Consolas, monospace';
    var t;
    for (t = 0; t <= TD; t += 400) {
      ctx.beginPath(); ctx.moveTo(X(t), pt); ctx.lineTo(X(t), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(t + '', X(t), pt + ph + 13);
    }
    for (var d = 0; d <= dMax; d += 5) {
      ctx.beginPath(); ctx.moveTo(pl, Y(d)); ctx.lineTo(pl + pw, Y(d)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(d + '', pl - 6, Y(d) + 3);
    }
    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.font = '9px sans-serif';
    ctx.fillText('测深 MD (m)', pl + pw / 2, H - 4);
    ctx.save();
    ctx.translate(pl - 34, pt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('与最近老井距离 (m)', 0, 0);
    ctx.restore();

    /* 4.5 m 防碰红线 */
    var yRed = Y(RED_LINE);
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pl, yRed); ctx.lineTo(pl + pw, yRed); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left';
    ctx.font = '9px sans-serif';
    ctx.fillText('防碰红线 4.5 m', pl + 6, yRed - 5);

    /* 6 m 关注线（只报警阈值） */
    var y6 = Y(6);
    ctx.strokeStyle = '#c9a15a';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pl, y6); ctx.lineTo(pl + pw, y6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9a7a1c';
    ctx.fillText('6 m 关注线（余量 <6 m 只报警）', pl + 6, y6 - 5);

    /* 距离曲线 */
    ctx.strokeStyle = '#2f7d6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i <= NSTA; i++) {
      var x = X(MD_ARR[i]), y = Y(w.anti[i]);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();

    /* 最近点标注 */
    var mi = staIdx(w.antiMinMd);
    var mx = X(MD_ARR[mi]), my = Y(w.anti[mi]);
    ctx.fillStyle = '#c9a15a';
    ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#9a7a1c'; ctx.textAlign = 'center';
    ctx.font = '600 9px sans-serif';
    ctx.fillText('最近点 ' + w.anti[mi].toFixed(1) + ' m @ ' + MD_ARR[mi] + ' m', mx, my - 10);

    /* 测点游标 */
    var cx = X(S.cursor);
    ctx.strokeStyle = '#c9a15a';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, pt); ctx.lineTo(cx, pt + ph); ctx.stroke();
  }

  function bindAnti() {
    var cv = $('sec-anti'), tip = $('tip-anti'), box = $('box-anti');
    var W = AC.W, pl = AC.pl, pr = AC.pr;
    var pw = W - pl - pr;
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var md = clamp((vx - pl) / pw * TD, 0, TD);
      var i = staIdx(md);
      var w = well();
      var margin = w.anti[i];
      tip.innerHTML = '<b>测深 ' + MD_ARR[i].toFixed(0) + ' m</b><br>' +
        '与最近老井距离 <b>' + margin.toFixed(1) + ' m</b><br>' +
        (margin < RED_LINE ? '<span style="color:#b05a51">越过 4.5 m 红线！</span>' :
          margin < 6 ? '<span style="color:#9a7a1c">余量 &lt;6 m：只报警不给建议</span>' : '防碰余量正常（≥6 m）');
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 80) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= ④ 工具面建议面板 ================= */
  function dipAt(md) { return md < 2400 ? 6 : 11; }

  function renderAdvice() {
    var w = well();
    var i = staIdx(S.cursor);
    var md = MD_ARR[i];
    var devH = w.path[i].H - DES.path[i].H;
    var devLat = w.path[i].lat;
    var dev = Math.hypot(devH, devLat);
    var margin = w.anti[i];
    var dip = dipAt(md);

    $('a-sta').innerHTML = md.toFixed(0) + '<small> m · </small>' + w.inc[i].toFixed(1) + '<small>° / </small>' + w.az[i].toFixed(1) + '<small>°</small>';
    $('a-dev').innerHTML = devH.toFixed(1) + '<small> / </small>' + devLat.toFixed(1) + '<small> m</small>';

    /* 工具面角：0°=增斜（高边），90°=增方位，180°=降斜，270°=降方位 */
    var incCmd = -devH * 0.9;             /* 超前设计位移 → 需要降斜 */
    var azCmd = -devLat * 0.6;
    var tf = Math.atan2(azCmd, incCmd) / DEG;
    if (tf < 0) tf += 360;
    var slideLen = clamp(1.6 * dev + (Math.abs(w.errInc[i] - (w.errInc[i - 1] || 0)) > 0.2 ? 2 : 0), 0, 12);
    var gain = 1.4 + dip / 10 + (slideLen / 12) * 0.7;   /* 响应模型：倾角段增益先验 */
    var alarm = margin < 6;

    if (alarm) {
      $('a-tf').innerHTML = '—';
      $('a-tf').parentNode.className = 'mcard bad';
      $('a-slide').innerHTML = '—';
      $('a-slide').parentNode.className = 'mcard bad';
      $('a-build').innerHTML = '—';
      $('a-build').parentNode.className = 'mcard bad';
      var v1 = $('a-verdict');
      v1.className = 'verdict bad';
      v1.innerHTML = '防碰余量 <b>' + margin.toFixed(1) + ' m &lt; 6 m</b>：系统只报警、不给指令，须定向井工程师人工确认后执行（红线 4.5 m）。';
    } else {
      $('a-tf').innerHTML = tf.toFixed(0) + '<small> °</small>';
      $('a-tf').parentNode.className = 'mcard';
      $('a-slide').innerHTML = slideLen.toFixed(1) + '<small> m / 12 m 柱</small>';
      $('a-slide').parentNode.className = 'mcard' + (slideLen > 8 ? ' warn' : '');
      $('a-build').innerHTML = gain.toFixed(1) + '<small> °/30 m</small>';
      $('a-build').parentNode.className = 'mcard';
      var v2 = $('a-verdict');
      v2.className = 'verdict ' + (dev > 6 ? 'warn' : 'ok');
      v2.innerHTML = '建议：工具面 <b>' + tf.toFixed(0) + '°</b>，滑动 <b>' + slideLen.toFixed(1) + ' m</b>，预期造斜率 <b>' + gain.toFixed(1) + '°/30 m</b>；' +
        (dev > 6 ? '偏差 ' + dev.toFixed(1) + ' m 偏大，本柱执行后下柱复测再滚动优化。' : '偏差 ' + dev.toFixed(1) + ' m 受控，维持滚动微调策略。');
    }

    $('a-reasons').innerHTML =
      '<li>当前偏差：水平 <b>' + devH.toFixed(1) + ' m</b>、横向 <b>' + devLat.toFixed(1) + ' m</b>（合计 <b>' + dev.toFixed(1) + ' m</b>，靶窗半径 8 m）</li>' +
      '<li>地层倾角段：<b>' + dip + '°</b>（' + (md < 2400 ? '2400 m 以上' : '2400 m 以下突变段') + '），响应增益先验 <b>' + gain.toFixed(1) + ' °/30 m</b>（Lubinski &amp; Woods 各向异性机理 + 邻井反演标定）</li>' +
      '<li>防碰余量：与最近老井 <b>' + margin.toFixed(1) + ' m</b>（红线 4.5 m，含 1.5 倍误差椭圆放大）' + (alarm ? '——触发只报警策略' : '') + '</li>';
  }

  /* ================= 指标卡 ================= */
  function renderMetrics() {
    var w = well();
    $('m-miss').innerHTML = w.miss.toFixed(1) + '<small> m</small>';
    $('m-miss').parentNode.className = 'mcard' + (w.miss > WIN_R ? ' bad' : '');
    $('m-dls').innerHTML = w.dlsMax.toFixed(1) + '<small> °/30 m</small>';
    $('m-dls').parentNode.className = 'mcard' + (w.dlsMax > 2.5 ? ' warn' : '');
    $('m-anti').innerHTML = w.antiMin.toFixed(1) + '<small> m</small>';
    $('m-anti').parentNode.className = 'mcard' + (w.antiMin < RED_LINE ? ' bad' : '');
    $('m-slide').innerHTML = (w.slideRatio * 100).toFixed(1) + '<small> %</small>';
    $('m-slide').parentNode.className = 'mcard' + (w.slideRatio > 0.28 ? ' warn' : '');
    $('m-corr').innerHTML = w.corrIdx.length + '<small> 次</small>';
    $('m-corr').parentNode.className = 'mcard' + (w.corrIdx.length > 8 ? ' warn' : '');
  }

  /* ================= 汇总渲染 ================= */
  function render() {
    drawProfile();
    drawAngles();
    drawAnti();
    renderAdvice();
    renderMetrics();
    $('o-cursor').textContent = S.cursor + ' m';
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    var btns = document.querySelectorAll('.well-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(btns, function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        S.well = +this.getAttribute('data-well');
        render();
      });
    });
    $('s-cursor').addEventListener('input', function () {
      S.cursor = parseInt(this.value, 10);
      $('o-cursor').textContent = S.cursor + ' m';
      drawProfile(); drawAngles(); drawAnti(); renderAdvice();
    });

    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        Array.prototype.forEach.call(tabs, function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        Array.prototype.forEach.call(panes, function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
      });
    });

    bindProfile();
    bindAngles();
    bindAnti();
  }

  /* ---------- 真实数据页：② 最小曲率半径法 RF 曲线 ---------- */
  function drawRF() {
    var svg = $('lit-rf'); if (!svg) return;
    var W = 900, H = 250, pl = 56, pr = 20, pt = 26, pb = 32;
    var pw = W - pl - pr, ph = H - pt - pb;
    var xMax = 10;                    /* 全角变化 θ (°) */
    var yMin = 0.9990, yMax = 1.00005;
    var X = function (th) { return pl + th / xMax * pw; };
    var Y = function (rf) { return pt + (yMax - rf) / (yMax - yMin) * ph; };
    function rf(thDeg) { var t = thDeg * DEG; return t === 0 ? 1 : (2 / t) * Math.tan(t / 2); }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';
    var v, t;
    for (v = 0.9990; v <= 1.00001; v += 0.0002) {
      s += '<line x1="' + pl + '" y1="' + Y(v) + '" x2="' + (pl + pw) + '" y2="' + Y(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (Y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v.toFixed(4) + '</text>';
    }
    for (t = 0; t <= xMax; t += 1) {
      s += '<line x1="' + X(t) + '" y1="' + pt + '" x2="' + X(t) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + X(t) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + t + '</text>';
    }
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">测段全角变化 θ (°)（30 m 测段上即狗腿度 °/30 m）</text>';
    s += '<text x="' + (pl - 42) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 42) + ' ' + (pt + ph / 2) + ')">比例因子 RF</text>';

    /* RF 曲线 */
    var d = '';
    for (var i = 0; i <= 200; i++) {
      var th = i / 200 * xMax;
      d += (i ? 'L' : 'M') + X(th).toFixed(1) + ' ' + Y(rf(th)).toFixed(1) + ' ';
    }
    s += '<path d="' + d + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';

    /* 关键点标注：本案例狗腿 2.4 / 历史人工 3.2 / 红线 2.5 */
    var pts = [
      { th: 2.4, label: '本案例上限 2.4°/30 m', color: '#2f7d6b', dy: -14 },
      { th: 2.5, label: '狗腿红线 2.5°/30 m', color: '#b05a51', dy: 22 },
      { th: 3.2, label: '历史人工 3.2°/30 m', color: '#9a7a1c', dy: -14 }
    ];
    pts.forEach(function (p) {
      var x = X(p.th), y = Y(rf(p.th));
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + p.color + '" stroke="#fff" stroke-width="1.3"/>';
      s += '<text x="' + x.toFixed(1) + '" y="' + (y + p.dy) + '" font-size="8.5" fill="' + p.color + '" text-anchor="middle" font-weight="600">' + p.label + ' · RF=' + rf(p.th).toFixed(5) + '</text>';
    });
    s += '<text x="' + (pl + 6) + '" y="' + (pt + 12) + '" font-size="9" fill="#8a9298">RF = (2/θ)·tan(θ/2) —— Sawaryn &amp; Thorogood (2005) SPE 84246-PA</text>';

    svg.innerHTML = s;
  }

  /* ---------- 真实数据页：③ 方位误差横向不确定度 ---------- */
  function drawUnc() {
    var svg = $('lit-unc'); if (!svg) return;
    var W = 900, H = 260, pl = 56, pr = 20, pt = 26, pb = 32;
    var pw = W - pl - pr, ph = H - pt - pb;
    var xMax = 3000, yMax = 28;
    var X = function (md) { return pl + md / xMax * pw; };
    var Y = function (u) { return pt + ph - u / yMax * ph; };
    var errs = [
      { e: 0.2, color: '#8a9298' },
      { e: 0.3, color: '#2f7d6b' },
      { e: 0.5, color: '#b05a51' }
    ];

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';
    var v, t;
    for (v = 0; v <= yMax; v += 4) {
      s += '<line x1="' + pl + '" y1="' + Y(v) + '" x2="' + (pl + pw) + '" y2="' + Y(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (Y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    }
    for (t = 0; t <= xMax; t += 500) {
      s += '<line x1="' + X(t) + '" y1="' + pt + '" x2="' + X(t) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + X(t) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + t + '</text>';
    }
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">测深 MD (m)</text>';
    s += '<text x="' + (pl - 42) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 42) + ' ' + (pt + ph / 2) + ')">横向不确定度 (m)</text>';

    var ends = [];
    errs.forEach(function (o) {
      var d = '';
      for (var i = 0; i <= 100; i++) {
        var md = i / 100 * xMax;
        var u = md * Math.tan(o.e * DEG);
        d += (i ? 'L' : 'M') + X(md).toFixed(1) + ' ' + Y(u).toFixed(1) + ' ';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + o.color + '" stroke-width="2"/>';
      ends.push({ e: o.e, color: o.color, y: Y(xMax * Math.tan(o.e * DEG)) - 4, u: xMax * Math.tan(o.e * DEG) });
    });
    /* 末端标注按 y 排序强制间隔 ≥12px */
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) {
      if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
    }
    ends.forEach(function (o) {
      s += '<text x="' + (X(xMax) - 4) + '" y="' + o.y.toFixed(1) + '" font-size="8.5" fill="' + o.color + '" text-anchor="end" font-family="monospace" font-weight="600">0.' + (o.e * 10).toFixed(0) + '° → ' + o.u.toFixed(1) + ' m</text>';
    });

    /* 本案例标注：2800 m · 0.3° → 14.7 m */
    var ux = X(2800), uy = Y(2800 * Math.tan(0.3 * DEG));
    s += '<line x1="' + ux + '" y1="' + pt + '" x2="' + ux + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<circle cx="' + ux.toFixed(1) + '" cy="' + uy.toFixed(1) + '" r="4.5" fill="#c9a15a" stroke="#fff" stroke-width="1.3"/>';
    s += '<text x="' + (ux - 8).toFixed(1) + '" y="' + (uy - 10).toFixed(1) + '" font-size="8.5" fill="#9a7a1c" text-anchor="end" font-weight="600">本案例：2800 m × tan(0.3°) ≈ 14.7 m（1σ）</text>';
    s += '<text x="' + (pl + 6) + '" y="' + (pt + 12) + '" font-size="9" fill="#8a9298">横向不确定度 = 测深 × tan(方位 1σ 误差) —— 误差源量级见 Williamson (2000) SPE 67616-PA</text>';

    svg.innerHTML = s;
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawAnti(); }, 120);
  });

  bind();
  render();
  drawRF();
  drawUnc();
})();
