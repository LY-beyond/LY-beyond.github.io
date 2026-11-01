/* ======= 叠前弹性参数反演（AVO）· 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* HiDPI 适配：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
  function setupCanvas(cv, lw, lh) {
    var dpr = window.devicePixelRatio || 1;
    var ratio = dpr * ((cv.clientWidth || lw) / lw);
    var bw = Math.max(1, Math.round(lw * ratio));
    var bh = Math.max(1, Math.round(lh * ratio));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, lw, lh);
    return ctx;
  }

  /* ---------- 状态 ---------- */
  var DEF = {
    shvp: 4200, shvs: 2100, shrho: 2.45,
    gvp: 3900, gvs: 2400, grho: 2.28,
    wvp: 4400, wvs: 2350, wrho: 2.42,
    freq: 28
  };
  var S = Object.assign({}, DEF);
  var fluid = 'gas'; /* AVO 曲线面板的界面①下层流体 */

  var KEYS = ['shvp', 'shvs', 'shrho', 'gvp', 'gvs', 'grho', 'wvp', 'wvs', 'wrho', 'freq'];
  var OUT = {
    shvp: function (v) { return v + ' m/s'; }, shvs: function (v) { return v + ' m/s'; },
    shrho: function (v) { return v.toFixed(2) + ' g/cm³'; },
    gvp: function (v) { return v + ' m/s'; }, gvs: function (v) { return v + ' m/s'; },
    grho: function (v) { return v.toFixed(2) + ' g/cm³'; },
    wvp: function (v) { return v + ' m/s'; }, wvs: function (v) { return v + ' m/s'; },
    wrho: function (v) { return v.toFixed(2) + ' g/cm³'; },
    freq: function (v) { return v + ' Hz'; }
  };

  /* ---------- 岩石物理 / AVO 计算 ---------- */
  function layers() {
    return {
      shale: { vp: S.shvp, vs: S.shvs, rho: S.shrho },
      gas: { vp: S.gvp, vs: S.gvs, rho: S.grho },
      water: { vp: S.wvp, vs: S.wvs, rho: S.wrho }
    };
  }

  /* Zoeppritz 精确解（PP 反射系数，Aki & Richards 1980 标准形式）。
     入射角超过临界角时返回 NaN。 */
  function zoeppritzRpp(l1, l2, thetaDeg) {
    var th1 = thetaDeg * Math.PI / 180;
    var p = Math.sin(th1) / l1.vp;
    var sT2 = p * l2.vp, sP1 = p * l1.vs, sP2 = p * l2.vs;
    if (sT2 >= 1 || sP1 >= 1 || sP2 >= 1) return NaN;
    var th2 = Math.asin(sT2), ph1 = Math.asin(sP1), ph2 = Math.asin(sP2);
    var sp1 = Math.sin(ph1), sp2 = Math.sin(ph2);
    var a = l2.rho * (1 - 2 * sp2 * sp2) - l1.rho * (1 - 2 * sp1 * sp1);
    var b = l2.rho * (1 - 2 * sp2 * sp2) + 2 * l1.rho * sp1 * sp1;
    var c = l1.rho * (1 - 2 * sp1 * sp1) + 2 * l2.rho * sp2 * sp2;
    var d = 2 * (l2.rho * l2.vs * l2.vs - l1.rho * l1.vs * l1.vs);
    var E = b * Math.cos(th1) / l1.vp + c * Math.cos(th2) / l2.vp;
    var F = b * Math.cos(ph1) / l1.vs + c * Math.cos(ph2) / l2.vs;
    var G = a - d * Math.cos(th1) / l1.vp * Math.cos(ph2) / l2.vs;
    var H = a - d * Math.cos(th2) / l2.vp * Math.cos(ph1) / l1.vs;
    var D = E * F + G * H * p * p;
    return ((b * Math.cos(th1) / l1.vp - c * Math.cos(th2) / l2.vp) * F -
      (a + d * Math.cos(th1) / l1.vp * Math.cos(ph2) / l2.vs) * H * p * p) / D;
  }

  /* Shuey (1985)：截距 R0、梯度 G、曲率 F（界面上下层取平均） */
  function shueyTerms(l1, l2) {
    var vp = (l1.vp + l2.vp) / 2, vs = (l1.vs + l2.vs) / 2, rho = (l1.rho + l2.rho) / 2;
    var dvp = l2.vp - l1.vp, dvs = l2.vs - l1.vs, drho = l2.rho - l1.rho;
    var r0 = 0.5 * (dvp / vp + drho / rho);
    var g = 0.5 * dvp / vp - 2 * (vs / vp) * (vs / vp) * (drho / rho + 2 * dvs / vs);
    var f = 0.5 * dvp / vp;
    return { r0: r0, g: g, f: f };
  }
  function shuey2(t, thDeg) {
    var s = Math.sin(thDeg * Math.PI / 180);
    return t.r0 + t.g * s * s;
  }
  function shuey3(t, thDeg) {
    var r = thDeg * Math.PI / 180;
    var s = Math.sin(r), tn = Math.tan(r);
    return t.r0 + t.g * s * s + t.f * (tn * tn - s * s);
  }

  /* 派生弹性参数（Goodway 口径：λρ = Ip²−2Is²，μρ = Is²） */
  function props(l) {
    var ip = l.vp * l.rho / 1000;   /* ×10³ m/s·g/cm³ */
    var is = l.vs * l.rho / 1000;
    return {
      ai: ip,
      si: is,
      lr: ip * ip - 2 * is * is,    /* ×10⁶ (m/s·g/cm³)² */
      mr: is * is,
      sigma: (l.vp * l.vp - 2 * l.vs * l.vs) / (2 * (l.vp * l.vp - l.vs * l.vs))
    };
  }

  function classify(r0, g) {
    if (g < 0) {
      if (r0 > 0.01) return 'I 类';
      if (r0 >= -0.01) return 'II 类';
      return 'III 类';
    }
    if (r0 < 0) return 'IV 类';
    return '非典型';
  }

  /* Ricker 子波 */
  function ricker(f, t) { /* t 单位 s */
    var x = Math.PI * f * t;
    return (1 - 2 * x * x) * Math.exp(-x * x);
  }

  /* ---------- 通用绘图辅助 ---------- */
  var C = {
    ink: '#242b2e', sub: '#79828a', grid: '#e6e0d2', axis: '#b9b2a2',
    green: '#2f7d6b', gold: '#c9a15a', red: '#b05a51', blue: '#41699b', grey: '#8a9298'
  };
  function line(ctx, x1, y1, x2, y2, color, w, dash) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = w || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }
  function text(ctx, s, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.font = (opt.bold ? '600 ' : '') + (opt.size || 10) + 'px ' +
      "'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillStyle = opt.color || C.ink;
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.base || 'alphabetic';
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  /* 悬停提示 */
  function makeTip(boxId, tipId) {
    var box = $(boxId), tip = $(tipId);
    return {
      show: function (html, x, y) {
        tip.innerHTML = html;
        tip.style.display = 'block';
        var bw = box.clientWidth, bh = box.clientHeight;
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var lx = clamp(x + 12, 2, Math.max(2, bw - tw - 2));
        var ly = clamp(y - th - 10, 2, Math.max(2, bh - th - 2));
        tip.style.left = lx + 'px';
        tip.style.top = ly + 'px';
      },
      hide: function () { tip.style.display = 'none'; }
    };
  }
  function canvasPos(cv, ev) {
    var box = cv.parentNode.getBoundingClientRect();
    var r = cv.getBoundingClientRect();
    return {
      x: ev.clientX - r.left, y: ev.clientY - r.top,
      bx: ev.clientX - box.left, by: ev.clientY - box.top,
      sx: cv.__lw / r.width, sy: cv.__lh / r.height
    };
  }

  /* ---------- ① 三层介质模型（SVG） ---------- */
  function drawModel() {
    var L = layers();
    var P = { shale: props(L.shale), gas: props(L.gas), water: props(L.water) };
    var rows = [
      { key: 'shale', name: '泥岩盖层', d: L.shale, p: P.shale, y0: 12, y1: 62, fill: '#e9e5d8', edge: '#d5cfbd' },
      { key: 'gas', name: '含气砂岩（储层）', d: L.gas, p: P.gas, y0: 66, y1: 122, fill: '#f6ead0', edge: '#e0c88f' },
      { key: 'water', name: '含水砂岩', d: L.water, p: P.water, y0: 126, y1: 176, fill: '#dfe7f2', edge: '#b9c8dd' }
    ];
    var s = '';
    s += '<rect x="0" y="0" width="860" height="190" fill="#fdfcf9" rx="6"/>';
    rows.forEach(function (r) {
      var yc = (r.y0 + r.y1) / 2;
      s += '<rect x="150" y="' + r.y0 + '" width="700" height="' + (r.y1 - r.y0) +
        '" fill="' + r.fill + '" stroke="' + r.edge + '" rx="3"/>';
      s += '<text x="140" y="' + (yc + 3) + '" text-anchor="end" font-size="11" font-weight="600" fill="#3d464b">' + r.name + '</text>';
      s += '<text x="164" y="' + (yc - 4) + '" font-size="10.5" fill="#4d565b">Vp ' + r.d.vp +
        ' m/s · Vs ' + r.d.vs + ' m/s · ρ ' + r.d.rho.toFixed(2) + ' g/cm³</text>';
      s += '<text x="164" y="' + (yc + 12) + '" font-size="10" fill="#79828a">AI ' + r.p.ai.toFixed(2) +
        ' ×10³ · SI ' + r.p.si.toFixed(2) + ' ×10³ · λρ ' + r.p.lr.toFixed(1) +
        ' · μρ ' + r.p.mr.toFixed(1) + ' · σ ' + r.p.sigma.toFixed(3) + '</text>';
    });
    /* 界面标注 */
    function iface(y, no, label, color) {
      return '<line x1="150" y1="' + y + '" x2="850" y2="' + y + '" stroke="' + color +
        '" stroke-width="1.4" stroke-dasharray="5 3"/>' +
        '<circle cx="132" cy="' + y + '" r="7" fill="' + color + '"/>' +
        '<text x="132" y="' + (y + 3.5) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">' + no + '</text>' +
        '<text x="856" y="' + (y - 4) + '" text-anchor="end" font-size="9.5" fill="' + color + '">' + label + '</text>';
    }
    s += iface(64, '①', '界面① 盖层→储层（AVO 分析界面）', '#b05a51');
    s += iface(124, '②', '界面② 气砂→水砂', '#8a9298');
    /* 深度标尺 */
    s += '<line x1="20" y1="12" x2="20" y2="176" stroke="#b9b2a2" stroke-width="1"/>';
    s += '<text x="14" y="16" font-size="9" fill="#8a9298" text-anchor="middle">5.9</text>';
    s += '<text x="14" y="178" font-size="9" fill="#8a9298" text-anchor="middle">6.1</text>';
    s += '<text x="34" y="94" font-size="9" fill="#8a9298">深度 km</text>';
    $('svg-model').innerHTML = s;
  }

  /* ---------- ② AVO 曲线 ---------- */
  var AVOW = 430, AVOH = 252;
  var avoM = { l: 46, r: 10, t: 10, b: 26 };
  var avoCache = null; /* {ang:[], z:[], s2:[], s3:[], ymin, ymax, thc} */

  function computeAVO() {
    var L = layers();
    var low = fluid === 'gas' ? L.gas : L.water;
    var t = shueyTerms(L.shale, low);
    var ang = [], z = [], s2 = [], s3 = [];
    var thc = null;
    for (var a = 0; a <= 45; a += 0.5) {
      ang.push(a);
      var zz = zoeppritzRpp(L.shale, low, a);
      if (isNaN(zz)) { if (thc === null) thc = a; zz = NaN; }
      z.push(zz);
      s2.push(shuey2(t, a));
      s3.push(shuey3(t, a));
    }
    var mx = 0.12;
    [z, s2, s3].forEach(function (arr) {
      arr.forEach(function (v) { if (!isNaN(v)) mx = Math.max(mx, Math.abs(v)); });
    });
    mx *= 1.18;
    avoCache = { ang: ang, z: z, s2: s2, s3: s3, ymax: mx, thc: thc, terms: t };
  }

  function avoXY(a, v) {
    var w = AVOW - avoM.l - avoM.r, h = AVOH - avoM.t - avoM.b;
    return {
      x: avoM.l + (a / 45) * w,
      y: avoM.t + h / 2 - (v / avoCache.ymax) * (h / 2)
    };
  }

  function drawAVO() {
    computeAVO();
    var cv = $('cv-avo');
    cv.__lw = AVOW; cv.__lh = AVOH;
    var ctx = setupCanvas(cv, AVOW, AVOH);
    var w = AVOW - avoM.l - avoM.r, h = AVOH - avoM.t - avoM.b;
    /* 网格与坐标 */
    var yTicks = niceTicks(avoCache.ymax);
    yTicks.forEach(function (v) {
      var p = avoXY(0, v);
      line(ctx, avoM.l, p.y, avoM.l + w, p.y, v === 0 ? C.axis : C.grid, v === 0 ? 1 : 0.7);
      text(ctx, v.toFixed(2), avoM.l - 5, p.y + 3, { align: 'right', color: C.sub, size: 9 });
    });
    for (var a = 0; a <= 45; a += 10) {
      var px = avoXY(a, 0).x;
      line(ctx, px, avoM.t, px, avoM.t + h, C.grid, 0.7);
      text(ctx, a + '°', px, avoM.t + h + 12, { align: 'center', color: C.sub, size: 9 });
    }
    text(ctx, '入射角 θ', avoM.l + w - 4, avoM.t + h + 23, { align: 'right', color: C.sub, size: 9 });
    text(ctx, '反射系数 R(θ)', avoM.l + 2, avoM.t - 2, { color: C.sub, size: 9 });
    /* 曲线 */
    function plot(arr, color, width, dash) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      var pen = false;
      for (var i = 0; i < arr.length; i++) {
        if (isNaN(arr[i])) { pen = false; continue; }
        var p = avoXY(avoCache.ang[i], arr[i]);
        if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    plot(avoCache.s2, C.red, 1.3, [5, 3]);
    plot(avoCache.s3, C.gold, 1.3, [2, 2]);
    plot(avoCache.z, C.green, 2);
    /* 临界角标记 */
    if (avoCache.thc !== null) {
      var pc = avoXY(avoCache.thc, 0);
      line(ctx, pc.x, avoM.t, pc.x, avoM.t + h, C.grey, 1, [3, 3]);
      text(ctx, '临界角 ' + avoCache.thc.toFixed(0) + '°', pc.x - 3, avoM.t + 10,
        { align: 'right', color: C.grey, size: 9 });
    }
    /* 轴线 */
    line(ctx, avoM.l, avoM.t, avoM.l, avoM.t + h, C.axis, 1);
    line(ctx, avoM.l, avoM.t + h, avoM.l + w, avoM.t + h, C.axis, 1);
  }

  function niceTicks(mx) {
    var step = mx > 0.4 ? 0.2 : mx > 0.18 ? 0.1 : 0.05;
    var out = [], n = Math.floor(mx / step);
    for (var i = -n; i <= n; i++) out.push(+(i * step).toFixed(3));
    return out;
  }

  /* ---------- ③ I-G 交会图 ---------- */
  var IG_RANGE = { xmin: -0.34, xmax: 0.34, ymin: -0.65, ymax: 0.32 };
  var igM = { l: 46, r: 12, t: 10, b: 26 };
  function igX(v) { return igM.l + ((v - IG_RANGE.xmin) / (IG_RANGE.xmax - IG_RANGE.xmin)) * (AVOW - igM.l - igM.r); }
  function igY(v) { return igM.t + (1 - (v - IG_RANGE.ymin) / (IG_RANGE.ymax - IG_RANGE.ymin)) * (AVOH - igM.t - igM.b); }

  function drawIGFrame(ctx, W, H, m, range) {
    var w = W - m.l - m.r, h = H - m.t - m.b;
    var X = function (v) { return m.l + ((v - range.xmin) / (range.xmax - range.xmin)) * w; };
    var Y = function (v) { return m.t + (1 - (v - range.ymin) / (range.ymax - range.ymin)) * h; };
    /* 网格 */
    var xt = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
    xt.forEach(function (v) {
      line(ctx, X(v), m.t, X(v), m.t + h, v === 0 ? C.axis : C.grid, v === 0 ? 1 : 0.7);
      text(ctx, v.toFixed(1), X(v), m.t + h + 12, { align: 'center', color: C.sub, size: 9 });
    });
    var yt = [-0.6, -0.4, -0.2, 0, 0.2];
    yt.forEach(function (v) {
      line(ctx, m.l, Y(v), m.l + w, Y(v), v === 0 ? C.axis : C.grid, v === 0 ? 1 : 0.7);
      text(ctx, v.toFixed(1), m.l - 5, Y(v) + 3, { align: 'right', color: C.sub, size: 9 });
    });
    text(ctx, '截距 R0', m.l + w - 4, m.t + h + 23, { align: 'right', color: C.sub, size: 9 });
    text(ctx, '梯度 G', m.l + 2, m.t - 2, { color: C.sub, size: 9 });
    /* 类别分区标注 */
    text(ctx, 'I 类', X(0.26), Y(-0.30), { color: '#a89a78', size: 11, bold: true });
    text(ctx, '（高阻抗气砂）', X(0.26), Y(-0.37), { color: '#b4a98c', size: 8.5 });
    text(ctx, 'II 类', X(0.045), Y(-0.48), { color: '#a89a78', size: 11, bold: true });
    text(ctx, '（近零阻抗差）', X(0.045), Y(-0.55), { color: '#b4a98c', size: 8.5 });
    text(ctx, 'III 类', X(-0.28), Y(-0.55), { color: '#a89a78', size: 11, bold: true });
    text(ctx, '（低阻抗亮点）', X(-0.28), Y(-0.62), { color: '#b4a98c', size: 8.5 });
    text(ctx, 'IV 类', X(-0.28), Y(0.24), { color: '#a89a78', size: 11, bold: true });
    text(ctx, '（极性反转）', X(-0.28), Y(0.17), { color: '#b4a98c', size: 8.5 });
    /* 背景趋势线 G = -0.8·I */
    var bx = [-0.3, 0.3];
    line(ctx, X(bx[0]), Y(-0.8 * bx[0]), X(bx[1]), Y(-0.8 * bx[1]), C.grey, 1, [6, 4]);
    line(ctx, m.l, m.t, m.l, m.t + h, C.axis, 1);
    line(ctx, m.l, m.t + h, m.l + w, m.t + h, C.axis, 1);
  }

  var igCache = null;
  function drawIG() {
    var L = layers();
    var gT = shueyTerms(L.shale, L.gas);
    var wT = shueyTerms(L.shale, L.water);
    igCache = {
      gas: { x: gT.r0, y: gT.g, label: '盖层→含气砂', cls: classify(gT.r0, gT.g) },
      water: { x: wT.r0, y: wT.g, label: '盖层→含水砂', cls: classify(wT.r0, wT.g) }
    };
    var cv = $('cv-ig');
    cv.__lw = AVOW; cv.__lh = AVOH;
    var ctx = setupCanvas(cv, AVOW, AVOH);
    drawIGFrame(ctx, AVOW, AVOH, igM, IG_RANGE);
    /* 两点连线（流体替换轨迹） */
    line(ctx, igX(igCache.water.x), igY(igCache.water.y), igX(igCache.gas.x), igY(igCache.gas.y),
      '#cbb27f', 1.2, [4, 3]);
    text(ctx, '水→气 流体替换', (igX(igCache.water.x) + igX(igCache.gas.x)) / 2 + 6,
      (igY(igCache.water.y) + igY(igCache.gas.y)) / 2 - 4, { color: '#a8894a', size: 9 });
    [['water', C.blue], ['gas', C.green]].forEach(function (kv) {
      var p = igCache[kv[0]];
      var x = igX(p.x), y = igY(p.y);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = kv[1]; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
      var dx = kv[0] === 'gas' ? -8 : 8;
      text(ctx, p.label, x + dx, y - 9,
        { align: kv[0] === 'gas' ? 'right' : 'left', color: kv[1], size: 9.5, bold: true });
    });
  }

  /* ---------- ④ 合成角道集 ---------- */
  var GW = 860, GH = 238;
  var gM = { l: 46, r: 8, t: 26, b: 8 };
  var T1 = 70, T2 = 110, TMAX = 160, DT = 0.5; /* ms */
  var ANGLES = [];
  for (var ai = 2; ai <= 44; ai += 3) ANGLES.push(ai);
  var gatherCache = null;

  function computeGather() {
    var L = layers();
    var f = S.freq;
    var n = Math.round(TMAX / DT) + 1;
    var half = Math.round(1.6 / (f / 1000) / DT); /* 子波半宽采样数 */
    var traces = [];
    var maxAbs = 1e-6;
    for (var k = 0; k < ANGLES.length; k++) {
      var th = ANGLES[k];
      var r1 = zoeppritzRpp(L.shale, L.gas, th);
      if (isNaN(r1)) r1 = shuey3(shueyTerms(L.shale, L.gas), th);
      var r2 = zoeppritzRpp(L.gas, L.water, th);
      if (isNaN(r2)) r2 = shuey3(shueyTerms(L.gas, L.water), th);
      var arr = new Float64Array(n);
      var i1 = Math.round(T1 / DT), i2 = Math.round(T2 / DT);
      for (var i = 0; i < n; i++) {
        var v = 0;
        var d1 = i - i1, d2 = i - i2;
        if (Math.abs(d1) <= half) v += r1 * ricker(f, d1 * DT / 1000);
        if (Math.abs(d2) <= half) v += r2 * ricker(f, d2 * DT / 1000);
        arr[i] = v;
        if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
      }
      traces.push({ th: th, r1: r1, r2: r2, data: arr });
    }
    gatherCache = { traces: traces, n: n, maxAbs: maxAbs };
  }

  function gY(t) { return gM.t + (t / TMAX) * (GH - gM.t - gM.b); }

  function drawGather() {
    computeGather();
    var cv = $('cv-gather');
    cv.__lw = GW; cv.__lh = GH;
    var ctx = setupCanvas(cv, GW, GH);
    var w = GW - gM.l - gM.r;
    var n = gatherCache.traces.length;
    var spacing = w / n;
    /* 时间轴 */
    for (var t = 0; t <= TMAX; t += 40) {
      line(ctx, gM.l, gY(t), gM.l + w, gY(t), C.grid, 0.7);
      text(ctx, t + '', gM.l - 5, gY(t) + 3, { align: 'right', color: C.sub, size: 9 });
    }
    text(ctx, '双程时间 ms', gM.l - 2, gM.t - 16, { color: C.sub, size: 9 });
    /* 界面虚线 */
    line(ctx, gM.l, gY(T1), gM.l + w, gY(T1), C.red, 0.9, [5, 4]);
    text(ctx, '界面① ' + T1 + ' ms', gM.l + w - 4, gY(T1) - 3, { align: 'right', color: C.red, size: 9 });
    line(ctx, gM.l, gY(T2), gM.l + w, gY(T2), C.grey, 0.9, [5, 4]);
    text(ctx, '界面② ' + T2 + ' ms', gM.l + w - 4, gY(T2) - 3, { align: 'right', color: C.grey, size: 9 });
    /* 道 */
    var scale = spacing * 0.46 / gatherCache.maxAbs;
    gatherCache.traces.forEach(function (tr, k) {
      var x0 = gM.l + spacing * (k + 0.5);
      var col = tr.th <= 15 ? C.green : tr.th <= 30 ? C.gold : C.red;
      line(ctx, x0, gM.t, x0, gM.t + (GH - gM.t - gM.b), '#efece1', 0.8);
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (var i = 0; i < gatherCache.n; i++) {
        var x = x0 + tr.data[i] * scale;
        var y = gY(i * DT);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      text(ctx, tr.th + '°', x0, gM.t - 4, { align: 'center', color: col, size: 8.5 });
    });
    text(ctx, '入射角 →', gM.l + w, gM.t - 16, { align: 'right', color: C.sub, size: 9 });
  }

  /* ---------- ⑤ 弹性参数条带 ---------- */
  var SW = 860, SH = 196;
  var stripCache = null;

  function drawStrips() {
    var L = layers();
    var Ps = [props(L.shale), props(L.gas), props(L.water)];
    var layerNames = ['泥岩盖层', '含气砂岩', '含水砂岩'];
    var cols = [
      { key: 'ai', name: 'AI 波阻抗', unit: '×10³ m/s·g/cm³', fmt: function (v) { return v.toFixed(2); } },
      { key: 'si', name: 'SI 横波阻抗', unit: '×10³ m/s·g/cm³', fmt: function (v) { return v.toFixed(2); } },
      { key: 'lr', name: 'λρ（流体敏感）', unit: 'Ip²−2Is² ×10⁶', fmt: function (v) { return v.toFixed(1); } },
      { key: 'mr', name: 'μρ（骨架敏感）', unit: 'Is² ×10⁶', fmt: function (v) { return v.toFixed(1); } },
      { key: 'sigma', name: '泊松比 σ', unit: '无量纲', fmt: function (v) { return v.toFixed(3); } }
    ];
    var cv = $('cv-strip');
    cv.__lw = SW; cv.__lh = SH;
    var ctx = setupCanvas(cv, SW, SH);
    var labW = 64, headH = 26, rowH = 50, gap = 3;
    var colW = (SW - labW - 8) / cols.length;
    stripCache = { cols: [], labW: labW, headH: headH, rowH: rowH, gap: gap, colW: colW };
    cols.forEach(function (c, ci) {
      var x0 = labW + ci * colW;
      text(ctx, c.name, x0 + colW / 2, 12, { align: 'center', color: C.ink, size: 10, bold: true });
      text(ctx, c.unit, x0 + colW / 2, 23, { align: 'center', color: C.sub, size: 8 });
      var vals = Ps.map(function (p) { return p[c.key]; });
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      var cells = [];
      for (var li = 0; li < 3; li++) {
        var t = mx > mn ? (vals[li] - mn) / (mx - mn) : 0.5;
        var y0 = headH + li * (rowH + gap);
        var rr = Math.round(lerp(233, 47, t));
        var gg = Math.round(lerp(241, 125, t));
        var bb = Math.round(lerp(236, 107, t));
        ctx.save();
        ctx.fillStyle = 'rgb(' + rr + ',' + gg + ',' + bb + ')';
        ctx.fillRect(x0 + 3, y0, colW - 6, rowH);
        if (li === 1) {
          ctx.lineWidth = 2; ctx.strokeStyle = C.gold;
          ctx.strokeRect(x0 + 3, y0, colW - 6, rowH);
        }
        ctx.restore();
        text(ctx, c.fmt(vals[li]), x0 + colW / 2, y0 + rowH / 2 + 3.5,
          { align: 'center', color: t > 0.55 ? '#ffffff' : '#242b2e', size: 11, bold: true });
        cells.push({ x: x0 + 3, y: y0, w: colW - 6, h: rowH, layer: layerNames[li], name: c.name, unit: c.unit, val: c.fmt(vals[li]) });
      }
      stripCache.cols.push({ x: x0, w: colW, name: c.name, cells: cells });
    });
    for (var li2 = 0; li2 < 3; li2++) {
      var yy = headH + li2 * (rowH + gap) + rowH / 2 + 3.5;
      text(ctx, layerNames[li2], labW - 8, yy, { align: 'right', color: C.sub, size: 9.5 });
    }
  }

  /* ---------- 指标与结论 ---------- */
  function renderMetrics() {
    var L = layers();
    var gT = shueyTerms(L.shale, L.gas);
    var ps = props(L.shale), pg = props(L.gas);
    var cls = classify(gT.r0, gT.g);
    $('m-r0').textContent = gT.r0.toFixed(3);
    $('m-g').textContent = gT.g.toFixed(3);
    var mClass = $('m-class');
    mClass.textContent = cls;
    mClass.parentNode.className = 'mcard' + (cls === 'III 类' || cls === 'IV 类' ? ' warn' : '');
    var ds = pg.sigma - ps.sigma;
    $('m-dsig').textContent = (ds >= 0 ? '+' : '') + ds.toFixed(3);
    var lrDrop = (pg.lr - ps.lr) / ps.lr * 100;
    $('m-lr').textContent = lrDrop.toFixed(0) + '%';
    var mrChg = (pg.mr - ps.mr) / ps.mr * 100;
    var v = $('verdict');
    var gasLike = ds < -0.05 && lrDrop < -15 && gT.r0 < 0 && gT.g < 0;
    v.className = 'verdict ' + (gasLike ? 'ok' : (gT.g < 0 ? 'warn' : 'bad'));
    v.innerHTML = '含气砂顶界面：<b>R0 = ' + gT.r0.toFixed(3) + '，G = ' + gT.g.toFixed(3) + '</b>，判为 <b>' + cls +
      '</b>（Rutherford &amp; Williams 1989）。λρ 由盖层 ' + ps.lr.toFixed(1) + ' → 气砂 ' + pg.lr.toFixed(1) +
      '（<b>' + lrDrop.toFixed(0) + '%</b>），μρ 变化 ' + (mrChg >= 0 ? '+' : '') + mrChg.toFixed(0) +
      '%，泊松比 ' + ps.sigma.toFixed(3) + ' → ' + pg.sigma.toFixed(3) +
      '。' + (gasLike
        ? 'λρ 大降而 μρ（骨架）不降，是 Goodway et al. (1997) 含气指示的典型形态；偏离背景趋势，AVO 异常可信。'
        : '偏离「λρ 降、μρ 不降」的典型含气形态——若 AVO 曲线仍有强梯度，需警惕岩性（而非流体）造成的假异常。');
  }

  /* ---------- 数据页：文献锚点 ---------- */
  var LIT = [
    { x: 0.15, y: -0.06, c: C.blue, name: 'I 类气砂锚点', src: 'Rutherford & Williams 1989', desc: '高阻抗含气砂：R0&gt;0、G&lt;0，振幅随角度减小，常呈「暗点」。', ldx: 10, ldy: -3, align: 'left' },
    { x: 0.005, y: -0.28, c: C.blue, name: 'II 类气砂锚点', src: 'Rutherford & Williams 1989', desc: '近零阻抗差含气砂：R0≈0、G&lt;0，近道弱、远道增强。', ldx: 10, ldy: 13, align: 'left' },
    { x: -0.12, y: -0.35, c: C.green, name: 'III 类气砂锚点', src: 'Rutherford & Williams 1989', desc: '低阻抗含气砂：R0&lt;0、G&lt;0，经典「亮点」，本 demo 默认组合即此类。', ldx: 10, ldy: 5, align: 'left' },
    { x: -0.14, y: 0.14, c: C.red, name: 'IV 类气砂锚点', src: 'Rutherford & Williams 1989', desc: 'R0&lt;0、G&gt;0：远道发生极性反转，多与极低速含气砂有关。', ldx: 10, ldy: 4, align: 'left' },
    { x: 0.24, y: -0.192, c: C.grey, name: '湿相背景点', src: 'Castagna & Swan 1997', desc: '湿砂 / 泥岩落在过原点的背景趋势附近；含气砂偏离该趋势即异常。', ldx: -10, ldy: 3, align: 'right' },
    { x: -0.08, y: -0.17, c: C.gold, name: '三维工区含气砂实例', src: 'Fatti et al. 1994（Geostack）', desc: '三维资料截距 / 梯度叠加检测含气砂的工程实例（示意锚点）。', ldx: -10, ldy: -8, align: 'right' }
  ];
  var litDetail = null;

  function drawLit() {
    var cv = $('cv-lit');
    cv.__lw = GW; cv.__lh = 240;
    var ctx = setupCanvas(cv, GW, 240);
    var m = { l: 46, r: 16, t: 10, b: 26 };
    drawIGFrame(ctx, GW, 240, m, IG_RANGE);
    var X = function (v) { return m.l + ((v - IG_RANGE.xmin) / (IG_RANGE.xmax - IG_RANGE.xmin)) * (GW - m.l - m.r); };
    var Y = function (v) { return m.t + (1 - (v - IG_RANGE.ymin) / (IG_RANGE.ymax - IG_RANGE.ymin)) * (240 - m.t - m.b); };
    LIT.forEach(function (p) {
      p.__x = X(p.x); p.__y = Y(p.y);
      ctx.save();
      ctx.beginPath(); ctx.arc(p.__x, p.__y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.c; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
      var above = p.ldy < 0;
      var lx = p.__x + (p.align === 'right' ? -Math.abs(p.ldx) : Math.abs(p.ldx));
      var ly = p.__y + p.ldy;
      text(ctx, p.name, lx, ly, { align: p.align, color: p.c, size: 9.5, bold: true });
      text(ctx, p.src, lx, ly + (above ? -11 : 11), { align: p.align, color: C.sub, size: 8.5 });
    });
  }

  /* ---------- 事件绑定 ---------- */
  function bindTips() {
    var tipAVO = makeTip('cv-avo', 'tip-avo');
    $('cv-avo').addEventListener('mousemove', function (ev) {
      var p = canvasPos(this, ev);
      var lx = p.x * p.sx;
      var a = (lx - avoM.l) / (AVOW - avoM.l - avoM.r) * 45;
      if (a < 0 || a > 45) { tipAVO.hide(); return; }
      var i = Math.round(a / 0.5);
      var z = avoCache.z[i], s3 = avoCache.s3[i], s2 = avoCache.s2[i];
      tipAVO.show('θ = <b>' + avoCache.ang[i].toFixed(1) + '°</b><br>Zoeppritz：<b>' +
        (isNaN(z) ? '超临界角' : z.toFixed(4)) + '</b><br>Shuey 三项：<b>' + s3.toFixed(4) +
        '</b><br>Shuey 两项：<b>' + s2.toFixed(4) + '</b>', p.bx, p.by);
    });
    $('cv-avo').addEventListener('mouseleave', tipAVO.hide);

    var tipIG = makeTip('cv-ig', 'tip-ig');
    $('cv-ig').addEventListener('mousemove', function (ev) {
      var p = canvasPos(this, ev);
      var lx = p.x * p.sx, ly = p.y * p.sy;
      var hit = null, hd = 14;
      ['gas', 'water'].forEach(function (k) {
        var q = igCache[k];
        var d = Math.hypot(igX(q.x) - lx, igY(q.y) - ly);
        if (d < hd) { hd = d; hit = q; }
      });
      if (!hit) { tipIG.hide(); return; }
      tipIG.show('<b>' + hit.label + '</b><br>R0 = <b>' + hit.x.toFixed(3) + '</b> · G = <b>' +
        hit.y.toFixed(3) + '</b><br>AVO 类别：<b>' + hit.cls + '</b>', p.bx, p.by);
    });
    $('cv-ig').addEventListener('mouseleave', tipIG.hide);

    var tipG = makeTip('cv-gather', 'tip-gather');
    $('cv-gather').addEventListener('mousemove', function (ev) {
      var p = canvasPos(this, ev);
      var lx = p.x * p.sx;
      var w = GW - gM.l - gM.r;
      var spacing = w / gatherCache.traces.length;
      var k = Math.floor((lx - gM.l) / spacing);
      if (k < 0 || k >= gatherCache.traces.length) { tipG.hide(); return; }
      var tr = gatherCache.traces[k];
      var grp = tr.th <= 15 ? '近道' : tr.th <= 30 ? '中道' : '远道';
      tipG.show('<b>θ = ' + tr.th + '°（' + grp + '）</b><br>R① 盖层→气砂：<b>' + tr.r1.toFixed(4) +
        '</b><br>R② 气砂→水砂：<b>' + tr.r2.toFixed(4) + '</b>', p.bx, p.by);
    });
    $('cv-gather').addEventListener('mouseleave', tipG.hide);

    var tipS = makeTip('cv-strip', 'tip-strip');
    $('cv-strip').addEventListener('mousemove', function (ev) {
      var p = canvasPos(this, ev);
      var lx = p.x * p.sx, ly = p.y * p.sy;
      var hit = null;
      stripCache.cols.forEach(function (c) {
        c.cells.forEach(function (cell) {
          if (lx >= cell.x && lx <= cell.x + cell.w && ly >= cell.y && ly <= cell.y + cell.h) hit = cell;
        });
      });
      if (!hit) { tipS.hide(); return; }
      tipS.show('<b>' + hit.layer + '</b><br>' + hit.name + '：<b>' + hit.val + '</b> ' + hit.unit,
        p.bx, p.by);
    });
    $('cv-strip').addEventListener('mouseleave', tipS.hide);

    var tipL = makeTip('cv-lit', 'tip-lit');
    $('cv-lit').addEventListener('mousemove', function (ev) {
      var p = canvasPos(this, ev);
      var lx = p.x * p.sx, ly = p.y * p.sy;
      var hit = null, hd = 14;
      LIT.forEach(function (q) {
        var d = Math.hypot(q.__x - lx, q.__y - ly);
        if (d < hd) { hd = d; hit = q; }
      });
      if (!hit) { tipL.hide(); litDetail.classList.remove('active'); litDetail.textContent = '悬停锚点查看该类别 / 文献的说明；本 demo 模拟页的 I-G 交会图采用同一坐标口径。'; return; }
      tipL.show('<b>' + hit.name + '</b><br>' + hit.src + '<br>R0 = <b>' + hit.x.toFixed(3) +
        '</b> · G = <b>' + hit.y.toFixed(3) + '</b>', p.bx, p.by);
      litDetail.classList.add('active');
      litDetail.innerHTML = '<b>' + hit.name + '</b>（' + hit.src + '）：' + hit.desc;
    });
    $('cv-lit').addEventListener('mouseleave', function () { tipL.hide(); });
  }

  /* ---------- 页签 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (tb) {
      tb.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        tb.classList.add('active');
        document.querySelectorAll('.tabpane').forEach(function (pn) { pn.classList.remove('active'); });
        $('pane-' + tb.getAttribute('data-tab')).classList.add('active');
      });
    });
    /* 支持 #data 直接定位到数据来源页签 */
    if (location.hash === '#data') {
      tabs.forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-tab') === 'data'); });
      document.querySelectorAll('.tabpane').forEach(function (pn) {
        pn.classList.toggle('active', pn.id === 'pane-data');
      });
    }
  }

  /* ---------- 渲染 ---------- */
  function render() {
    drawModel();
    drawAVO();
    drawIG();
    drawGather();
    drawStrips();
    renderMetrics();
  }

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function init() {
    litDetail = $('lit-detail');
    bindTabs();
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    document.querySelectorAll('input[name="fluid"]').forEach(function (r) {
      r.addEventListener('change', function () {
        fluid = this.value;
        $('avo-note').textContent = fluid === 'gas'
          ? '含气砂：低阻抗 + 强负梯度，典型 III 类'
          : '含水砂：近零阻抗差、弱负梯度，靠近背景趋势';
        drawAVO();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      syncSliders();
      render();
    });
    var rz = null;
    window.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () { render(); drawLit(); }, 120);
    });
    syncSliders();
    render();
    drawLit();
    bindTips();
  }

  init();
})();
