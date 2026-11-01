/* ======= 完井管柱受力智能分析 · 可运行示范 ======= */
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

  /* ---------- 常量（工程口径） ---------- */
  var E_MPA = 206800;          // 钢弹性模量 MPa
  var ALPHA = 1.24e-5;         // 钢线膨胀系数 /℃
  var NU = 0.3;                // 泊松比
  var RHO_S = 7850;            // 钢密度 kg/m³
  var RHO_F = 1100;            // 环空保护液密度 kg/m³
  var G = 9.81;
  var GAS_GRAD = 0.00294;      // 高压气柱压力梯度 MPa/m (≈0.30 g/cm³)
  var FLUID_GRAD = 0.01079;    // 环空液柱压力梯度 MPa/m (1.10 g/cm³)
  var D_TUBE = 88.9;           // 油管外径 mm
  var D_SEAL = 76.2;           // 封隔器密封腔直径 mm
  var CASING_ID = 157.1;       // 7" 套管内径 mm
  var INCL = 5 * Math.PI / 180;// 平均井斜角 rad
  var T_WH_PROD = 60;          // 生产井口温度 ℃
  var T_INSTALL = 20;          // 坐封基准平均温度 ℃
  var ETA_JOINT = 0.85;        // 接头效率折减 (API 5C3 0.8–1.0)
  var SF_DESIGN = 1.25;        // 三轴设计安全系数

  /* API 5CT 钢级（最小屈服 MPa）；110S≈C110 酸性服役，125≈Q125 */
  var GRADES = {
    'P110': { ys: 758, ymax: 965, ts: 862, note: 'P110：屈服 758–965 MPa，抗拉 ≥862 MPa（API 5CT）' },
    '110S': { ys: 758, ymax: 828, ts: 793, note: '110S≈C110：屈服 758–828 MPa，抗拉 ≥793 MPa（酸性服役，上限受控）' },
    '125':  { ys: 862, ymax: 1034, ts: 931, note: '125≈Q125：屈服 862–1034 MPa，抗拉 ≥931 MPa（API 5CT）' }
  };

  var DEF = { depth: 5800, whp: 95, bht: 152, wall: 7.34, grade: 'P110' };
  var S = Object.assign({}, DEF);
  var R = null; // 最近一次计算结果

  /* ---------- 机理模型（Lubinski et al. 1962 简化式） ---------- */
  function compute(st) {
    var D = D_TUBE, t = st.wall, d = D - 2 * t;
    var As = Math.PI / 4 * (D * D - d * d);
    var Ai = Math.PI / 4 * d * d;
    var Ao = Math.PI / 4 * D * D;
    var Ap = Math.PI / 4 * D_SEAL * D_SEAL;
    var Im = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(d, 4)); // mm⁴
    var H = st.depth;
    var w = As * 1e-6 * RHO_S * G;              // 空气中线重 N/m
    var wb = w * (1 - RHO_F / RHO_S);           // 浮重 N/m

    /* 温度效应：生产剖面 60℃→井底线性，相对坐封基准 20℃ */
    var dTbar = (T_WH_PROD + st.bht) / 2 - T_INSTALL;
    var dFT = -E_MPA * As * ALPHA * dTbar / 1000;                 // kN（压）

    /* 鼓胀效应：内压均值 vs 环空液柱均值 */
    var piAvg = st.whp + GAS_GRAD * H / 2;
    var poAvg = FLUID_GRAD * H / 2;
    var dFb = 2 * NU * (piAvg * Ai - poAvg * Ao) / 1000;          // kN（拉）

    /* 活塞效应：井口压力作用于密封腔环形面积 */
    var dFp = st.whp * (Ap - Ai) / 1000;                          // kN（拉/压）

    /* 屈曲临界载荷（Chen, Lin & Cheatham 1990） */
    var EI = E_MPA * 1e6 * Im * 1e-12;                            // N·m²
    var rc = (CASING_ID - D_TUBE) / 2 / 1000;                     // m
    var fSin = 2 * Math.sqrt(EI * wb * Math.sin(INCL) / rc) / 1000; // kN
    var fHel = Math.SQRT2 * fSin;

    var sy = GRADES[st.grade].ys;
    var N = 120, zs = [], Fe = [], Ft = [], Vm = [], Sf = [], SfJ = [], SyT = [];
    var i, z, grav, fe, pi, po, ft, sa, sh, sr, vm, Tz, kT, syT;
    for (i = 0; i <= N; i++) {
      z = i / N * H;
      grav = wb * (H - z) / 1000;                                 // kN
      fe = grav + dFT + dFb + dFp;
      pi = st.whp + GAS_GRAD * z;
      po = FLUID_GRAD * z;
      ft = fe + (pi * Ai - po * Ao) / 1000;                       // kN
      sa = ft * 1000 / As;                                        // MPa 轴向
      sh = (pi * (d / 2) - po * (D / 2)) / (D / 2 - d / 2);       // Lamé 平均环向
      sr = -(pi + po) / 2;                                        // 平均径向
      vm = Math.sqrt(0.5 * ((sa - sh) * (sa - sh) + (sh - sr) * (sh - sr) + (sr - sa) * (sr - sa)));
      Tz = T_WH_PROD + (st.bht - T_WH_PROD) * z / H;
      kT = 1 - 0.0006 * Math.max(0, Tz - 93);                     // 屈服温度折减
      syT = sy * kT;
      zs.push(z); Fe.push(fe); Ft.push(ft); Vm.push(vm);
      Sf.push(syT / Math.max(vm, 1e-6)); SfJ.push(ETA_JOINT * syT / Math.max(vm, 1e-6)); SyT.push(syT);
    }

    /* 屈曲区间 */
    var zSin = -1, zHel = -1, maxComp = 0;
    for (i = 0; i <= N; i++) {
      if (Fe[i] < -fSin && zSin < 0) zSin = zs[i];
      if (Fe[i] < -fHel && zHel < 0) zHel = zs[i];
      if (-Fe[i] > maxComp) maxComp = -Fe[i];
    }
    var buckState = maxComp <= 0 ? 'stable' : (maxComp <= fSin ? 'stable' : (maxComp <= fHel ? 'sin' : 'hel'));

    /* 自由伸缩当量（若封隔器允许移动） */
    var dL = ALPHA * dTbar * H - dFb * 1000 * H / (E_MPA * As) + dFp * 1000 * H / (E_MPA * As);

    /* 指标 */
    var vmMax = Math.max.apply(null, Vm);
    var sfMin = Math.min.apply(null, Sf);
    var sfJMin = Math.min.apply(null, SfJ);

    return {
      D: D, d: d, t: t, As: As, Ai: Ai, Ao: Ao, Ap: Ap, Im: Im, H: H,
      w: w, wb: wb, dTbar: dTbar, dFT: dFT, dFb: dFb, dFp: dFp,
      fSin: fSin, fHel: fHel, sy: sy,
      zs: zs, Fe: Fe, Ft: Ft, Vm: Vm, Sf: Sf, SfJ: SfJ, SyT: SyT,
      zSin: zSin, zHel: zHel, maxComp: maxComp, buckState: buckState,
      dL: dL, vmMax: vmMax, sfMin: sfMin, sfJMin: sfJMin
    };
  }

  /* ---------- 面板 1a：管柱示意图 ---------- */
  function drawSchem() {
    var svg = $('schem');
    var W = 430, H = 330, pl = 58, pr = 14, pt = 30, pb = 14;
    var ph = H - pt - pb;
    var wellX = pl + 76, casW = 54, tubW = 16;
    var yOf = function (z) { return pt + z / R.H * ph; };
    var packZ = R.H * 0.96;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';

    /* 深度刻度 */
    var zTicks = [0, Math.round(R.H / 2000) * 1000, R.H];
    zTicks[1] = Math.round(R.H / 2 / 100) * 100;
    zTicks.forEach(function (z, idx) {
      if (idx === 1 && Math.abs(z - R.H) < 400) return;
      s += '<line x1="' + (pl - 6) + '" y1="' + yOf(z) + '" x2="' + (pl + 150) + '" y2="' + yOf(z) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 10) + '" y="' + (yOf(z) + 3) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + (z >= 1000 ? (z / 1000).toFixed(1) + 'k' : z) + '</text>';
    });
    s += '<text x="14" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 14 ' + (pt + ph / 2) + ')">井深 (m)</text>';

    /* 套管 */
    s += '<rect x="' + (wellX - casW / 2) + '" y="' + pt + '" width="' + casW + '" height="' + ph + '" fill="#f1ede2" stroke="#d8d0bc"/>';
    /* 水泥环暗示线 */
    s += '<line x1="' + (wellX - casW / 2 - 5) + '" y1="' + pt + '" x2="' + (wellX - casW / 2 - 5) + '" y2="' + (pt + ph) + '" stroke="#e2dccb"/>';
    s += '<line x1="' + (wellX + casW / 2 + 5) + '" y1="' + pt + '" x2="' + (wellX + casW / 2 + 5) + '" y2="' + (pt + ph) + '" stroke="#e2dccb"/>';
    /* 油管 */
    s += '<rect x="' + (wellX - tubW / 2) + '" y="' + pt + '" width="' + tubW + '" height="' + (yOf(packZ) - pt) + '" fill="#e9f1ec" stroke="#2f7d6b" stroke-width="1.4"/>';
    /* 封隔器 */
    var py = yOf(packZ);
    s += '<rect x="' + (wellX - casW / 2 + 2) + '" y="' + (py - 7) + '" width="' + (casW - 4) + '" height="14" rx="2" fill="#c9a15a" stroke="#9a7a1c"/>';
    s += '<text x="' + (wellX + casW / 2 + 8) + '" y="' + (py + 3) + '" font-size="9" fill="#9a7a1c">封隔器 ' + Math.round(packZ) + ' m</text>';

    /* 井口装置 */
    s += '<rect x="' + (wellX - 22) + '" y="' + (pt - 18) + '" width="44" height="12" rx="2" fill="#2f7d6b"/>';
    s += '<text x="' + wellX + '" y="' + (pt - 9) + '" font-size="8.5" fill="#fff" text-anchor="middle" font-weight="600">井口</text>';
    s += '<text x="' + (wellX + 34) + '" y="' + (pt - 9) + '" font-size="9.5" fill="#b05a51" font-family="monospace" font-weight="600">' + S.whp + ' MPa</text>';

    /* 右列标注 */
    var ax = wellX + casW / 2 + 8;
    s += '<text x="' + ax + '" y="' + (pt + 22) + '" font-size="9" fill="#5d666d">油管 Φ88.9×' + S.wall.toFixed(2) + ' mm</text>';
    s += '<text x="' + ax + '" y="' + (pt + 36) + '" font-size="9" fill="#5d666d">钢级 ' + S.grade + '（屈服 ' + GRADES[S.grade].ys + ' MPa）</text>';
    s += '<text x="' + ax + '" y="' + (pt + 50) + '" font-size="9" fill="#5d666d">套管 7"（内径 157.1 mm）</text>';
    s += '<text x="' + ax + '" y="' + (pt + 64) + '" font-size="9" fill="#5d666d">环空保护液 1.10 g/cm³</text>';
    s += '<text x="' + ax + '" y="' + (pt + ph - 18) + '" font-size="9.5" fill="#b05a51" font-family="monospace">井底 ' + S.bht + ' ℃</text>';
    s += '<text x="' + ax + '" y="' + (pt + ph - 4) + '" font-size="9" fill="#79828a" font-family="monospace">' + S.depth + ' m</text>';

    /* 温度箭头 */
    s += '<line x1="' + (wellX - casW / 2 - 14) + '" y1="' + (pt + 10) + '" x2="' + (wellX - casW / 2 - 14) + '" y2="' + (pt + ph - 24) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#arrR)"/>';
    s += '<defs><marker id="arrR" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#b05a51"/></marker></defs>';
    s += '<text x="' + (wellX - casW / 2 - 20) + '" y="' + (pt + ph / 2) + '" font-size="8.5" fill="#b05a51" text-anchor="middle" transform="rotate(-90 ' + (wellX - casW / 2 - 20) + ' ' + (pt + ph / 2) + ')">生产温度剖面 60→' + S.bht + '℃</text>';

    svg.innerHTML = s;
  }

  /* ---------- 面板 2：轴向力沿井深分布 ---------- */
  function drawAxial() {
    var svg = $('axial');
    var W = 900, H = 320, pl = 70, pr = 30, pt = 30, pb = 40;
    var pw = W - pl - pr, ph = H - pt - pb;

    var all = R.Fe.concat(R.Ft);
    var fLo = Math.min(Math.min.apply(null, all), -R.fHel) - 40;
    var fHi = Math.max(Math.max.apply(null, all), 0) + 40;
    fLo = Math.floor(fLo / 100) * 100; fHi = Math.ceil(fHi / 100) * 100;
    var xOf = function (f) { return pl + (f - fLo) / (fHi - fLo) * pw; };
    var yOf = function (z) { return pt + z / R.H * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';

    /* 屈曲状态底色带（按深度分段） */
    var segCol = { stable: 'rgba(47,125,107,0.05)', sin: 'rgba(201,161,90,0.13)', hel: 'rgba(176,90,81,0.13)' };
    var cur = null, segStart = 0;
    function stateAt(i) {
      var f = -R.Fe[i];
      if (f <= 0 || f <= R.fSin) return 'stable';
      if (f <= R.fHel) return 'sin';
      return 'hel';
    }
    for (var i = 0; i <= R.zs.length - 1; i++) {
      var st = stateAt(i);
      if (cur === null) { cur = st; segStart = R.zs[i]; }
      if (st !== cur || i === R.zs.length - 1) {
        var zEnd = st !== cur ? R.zs[i] : R.H;
        s += '<rect x="' + pl + '" y="' + yOf(segStart).toFixed(1) + '" width="' + pw + '" height="' + (yOf(zEnd) - yOf(segStart)).toFixed(1) + '" fill="' + segCol[cur] + '"/>';
        cur = st; segStart = R.zs[i];
      }
    }

    /* 网格：深度（纵轴） */
    var zStep = 1000;
    for (var z = 0; z <= R.H; z += zStep) {
      s += '<line x1="' + pl + '" y1="' + yOf(z) + '" x2="' + (pl + pw) + '" y2="' + yOf(z) + '" stroke="' + (z ? '#efece1' : '#d8d0bc') + '"/>';
      s += '<text x="' + (pl - 8) + '" y="' + (yOf(z) + 3) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + z + '</text>';
    }
    /* 网格：力（横轴） */
    var fSpan = fHi - fLo, fStep = fSpan <= 900 ? 100 : (fSpan <= 1800 ? 200 : 400);
    for (var f = Math.ceil(fLo / fStep) * fStep; f <= fHi; f += fStep) {
      s += '<line x1="' + xOf(f) + '" y1="' + pt + '" x2="' + xOf(f) + '" y2="' + (pt + ph) + '" stroke="' + (f ? '#efece1' : '#cfc7b6') + '" stroke-width="' + (f ? 1 : 1.4) + '"/>';
      s += '<text x="' + xOf(f) + '" y="' + (pt + ph + 14) + '" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + f + '</text>';
    }
    s += '<text x="' + (xOf(0) + 5) + '" y="' + (pt + 11) + '" font-size="8.5" fill="#9ba3a9" font-family="monospace">0（拉 + / 压 −）</text>';

    /* 屈曲临界线 */
    if (-R.fSin > fLo) {
      s += '<line x1="' + xOf(-R.fSin) + '" y1="' + pt + '" x2="' + xOf(-R.fSin) + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
      s += '<text x="' + (xOf(-R.fSin) - 4) + '" y="' + (pt + 11) + '" font-size="8.5" fill="#9a7a1c" text-anchor="end" font-family="monospace">−Fsin ' + R.fSin.toFixed(0) + '</text>';
    }
    if (-R.fHel > fLo) {
      s += '<line x1="' + xOf(-R.fHel) + '" y1="' + pt + '" x2="' + xOf(-R.fHel) + '" y2="' + (pt + ph) + '" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="5 3"/>';
      s += '<text x="' + (xOf(-R.fHel) - 4) + '" y="' + (pt + 22) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">−Fhel ' + R.fHel.toFixed(0) + '</text>';
    }

    /* 曲线 */
    function pathOf(arr) {
      var d = '';
      for (var k = 0; k < arr.length; k++) d += (k ? 'L' : 'M') + xOf(arr[k]).toFixed(1) + ' ' + yOf(R.zs[k]).toFixed(1) + ' ';
      return d;
    }
    s += '<path d="' + pathOf(R.Ft) + '" fill="none" stroke="#41699b" stroke-width="1.6"/>';
    s += '<path d="' + pathOf(R.Fe) + '" fill="none" stroke="#2f7d6b" stroke-width="2.4"/>';

    /* 端点标注 */
    s += '<circle cx="' + xOf(R.Fe[0]).toFixed(1) + '" cy="' + yOf(0) + '" r="3.4" fill="#2f7d6b" stroke="#fff" stroke-width="1.2"/>';
    s += '<circle cx="' + xOf(R.Fe[R.Fe.length - 1]).toFixed(1) + '" cy="' + yOf(R.H) + '" r="3.4" fill="#2f7d6b" stroke="#fff" stroke-width="1.2"/>';

    s += '<text x="' + (pl - 46) + '" y="' + (pt + ph / 2) + '" font-size="9.5" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 46) + ' ' + (pt + ph / 2) + ')">井深 (m)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 6) + '" font-size="9.5" fill="#5d666d" text-anchor="middle">轴向力 (kN)</text>';

    svg.innerHTML = s;
  }

  /* ---------- 面板 3：三轴应力 + 安全系数 ---------- */
  function drawTriax() {
    var svg = $('triax');
    var W = 900, H = 320, pl = 70, pr = 30, pt = 34, pb = 40;
    var pw = W - pl - pr, ph = H - pt - pb;

    var vMax = Math.max(R.vmMax, Math.max.apply(null, R.SyT)) * 1.08;
    vMax = Math.ceil(vMax / 100) * 100;
    var xV = function (v) { return pl + v / vMax * pw; };
    var yOf = function (z) { return pt + z / R.H * ph; };
    /* 安全系数顶轴：0.5–3 */
    var sfLo = 0.5, sfHi = 3;
    var xS = function (sf) { return pl + clamp((sf - sfLo) / (sfHi - sfLo), 0, 1) * pw; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';

    /* 安全区底色（vm < sy 区由屈服线自然分隔） */
    for (var z = 0; z <= R.H; z += 1000) {
      s += '<line x1="' + pl + '" y1="' + yOf(z) + '" x2="' + (pl + pw) + '" y2="' + yOf(z) + '" stroke="' + (z ? '#efece1' : '#d8d0bc') + '"/>';
      s += '<text x="' + (pl - 8) + '" y="' + (yOf(z) + 3) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + z + '</text>';
    }
    var vStep = vMax <= 800 ? 100 : 200;
    for (var v = 0; v <= vMax; v += vStep) {
      s += '<line x1="' + xV(v) + '" y1="' + pt + '" x2="' + xV(v) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xV(v) + '" y="' + (pt + ph + 14) + '" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
    }
    /* SF 顶轴刻度 */
    [0.5, 1, 1.25, 1.5, 2, 2.5, 3].forEach(function (sf) {
      var x = xS(sf);
      s += '<text x="' + x + '" y="' + (pt - 8) + '" font-size="9" fill="#41699b" text-anchor="middle" font-family="monospace">' + sf + '</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (pt - 22) + '" font-size="9" fill="#41699b" text-anchor="middle">安全系数 SF（顶轴）</text>';

    /* 屈服强度（温度折减）虚线 */
    var d = '';
    for (var k = 0; k < R.SyT.length; k++) d += (k ? 'L' : 'M') + xV(R.SyT[k]).toFixed(1) + ' ' + yOf(R.zs[k]).toFixed(1) + ' ';
    s += '<path d="' + d + '" fill="none" stroke="#b05a51" stroke-width="1.4" stroke-dasharray="6 3"/>';
    var yLbl = yOf(R.H * 0.35);
    s += '<text x="' + (xV(R.SyT[Math.round(R.zs.length * 0.35)]) + 6) + '" y="' + yLbl + '" font-size="8.5" fill="#b05a51" font-family="monospace">屈服 ' + R.sy + ' MPa（温度折减）</text>';

    /* SF=1.25 设计线（顶轴） */
    var xD = xS(SF_DESIGN);
    s += '<line x1="' + xD + '" y1="' + pt + '" x2="' + xD + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + (xD + 4) + '" y="' + (pt + 34) + '" font-size="8.5" fill="#9a7a1c" font-family="monospace">SF=1.25</text>';
    /* SF=1 线 */
    var x1 = xS(1);
    s += '<line x1="' + x1 + '" y1="' + pt + '" x2="' + x1 + '" y2="' + (pt + ph) + '" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="3 3"/>';
    s += '<text x="' + (x1 - 4) + '" y="' + (pt + 34) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">SF=1</text>';

    /* Von Mises 曲线（填充至 0） */
    var dv = 'M' + xV(0) + ' ' + yOf(0) + ' ';
    for (k = 0; k < R.Vm.length; k++) dv += 'L' + xV(R.Vm[k]).toFixed(1) + ' ' + yOf(R.zs[k]).toFixed(1) + ' ';
    dv += 'L' + xV(0) + ' ' + yOf(R.H) + ' Z';
    s += '<path d="' + dv + '" fill="rgba(47,125,107,0.10)" stroke="none"/>';
    var d2 = '';
    for (k = 0; k < R.Vm.length; k++) d2 += (k ? 'L' : 'M') + xV(R.Vm[k]).toFixed(1) + ' ' + yOf(R.zs[k]).toFixed(1) + ' ';
    s += '<path d="' + d2 + '" fill="none" stroke="#2f7d6b" stroke-width="2.4"/>';

    /* SF 曲线（顶轴，蓝） */
    var d3 = '';
    for (k = 0; k < R.Sf.length; k++) d3 += (k ? 'L' : 'M') + xS(R.Sf[k]).toFixed(1) + ' ' + yOf(R.zs[k]).toFixed(1) + ' ';
    s += '<path d="' + d3 + '" fill="none" stroke="#41699b" stroke-width="1.8"/>';

    s += '<text x="' + (pl - 46) + '" y="' + (pt + ph / 2) + '" font-size="9.5" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 46) + ' ' + (pt + ph / 2) + ')">井深 (m)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 6) + '" font-size="9.5" fill="#5d666d" text-anchor="middle">Von Mises 等效应力 (MPa)</text>';

    svg.innerHTML = s;
  }

  /* ---------- 面板 4a：屈曲判定色带 ---------- */
  function drawBuckBand() {
    var svg = $('buckband');
    var W = 430, H = 200, pl = 46, pr = 14, pt = 40, pb = 40;
    var pw = W - pl - pr;
    var xOf = function (z) { return pl + z / R.H * pw; };
    var bandY = pt + 20, bandH = 30;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';

    /* 分段：稳定 / 正弦 / 螺旋 */
    var segs = [];
    var zsS = R.zSin, zsH = R.zHel;
    if (zsH >= 0) {
      if (zsS > 0) segs.push({ z0: 0, z1: zsS, c: '#e9f3ec', t: '稳定', tc: '#35765a' });
      if (zsH > zsS) segs.push({ z0: Math.max(zsS, 0), z1: zsH, c: '#faf3e2', t: '正弦屈曲', tc: '#9a7a1c' });
      segs.push({ z0: zsH, z1: R.H, c: '#faeae6', t: '螺旋屈曲', tc: '#a85147' });
    } else if (zsS >= 0) {
      if (zsS > 0) segs.push({ z0: 0, z1: zsS, c: '#e9f3ec', t: '稳定', tc: '#35765a' });
      segs.push({ z0: zsS, z1: R.H, c: '#faf3e2', t: '正弦屈曲', tc: '#9a7a1c' });
    } else {
      segs.push({ z0: 0, z1: R.H, c: '#e9f3ec', t: '稳定（全井段）', tc: '#35765a' });
    }
    segs.forEach(function (g) {
      var x0 = xOf(g.z0), x1 = xOf(g.z1);
      s += '<rect x="' + x0.toFixed(1) + '" y="' + bandY + '" width="' + Math.max(1, x1 - x0).toFixed(1) + '" height="' + bandH + '" fill="' + g.c + '" stroke="#e2dccb"/>';
      if (x1 - x0 > 46) {
        s += '<text x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (bandY + bandH / 2 + 3) + '" font-size="9" fill="' + g.tc + '" text-anchor="middle" font-weight="600">' + g.t + '</text>';
      }
    });

    /* 深度刻度 */
    for (var z = 0; z <= R.H; z += 1000) {
      s += '<line x1="' + xOf(z) + '" y1="' + (bandY + bandH) + '" x2="' + xOf(z) + '" y2="' + (bandY + bandH + 4) + '" stroke="#cfc7b6"/>';
      s += '<text x="' + xOf(z) + '" y="' + (bandY + bandH + 15) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + z + '</text>';
    }
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">井深 (m)</text>';

    /* 顶部：状态 pill + 临界载荷 */
    var pill = R.buckState === 'hel' ? ['螺旋屈曲', '#faeae6', '#a85147'] :
               R.buckState === 'sin' ? ['正弦屈曲', '#faf3e2', '#9a7a1c'] : ['未屈曲', '#e9f3ec', '#35765a'];
    s += '<rect x="' + pl + '" y="' + (pt - 12) + '" width="66" height="15" rx="7.5" fill="' + pill[1] + '"/>';
    s += '<text x="' + (pl + 33) + '" y="' + (pt - 1) + '" font-size="9.5" fill="' + pill[2] + '" text-anchor="middle" font-weight="600">' + pill[0] + '</text>';
    s += '<text x="' + (pl + 76) + '" y="' + (pt - 1) + '" font-size="8.5" fill="#79828a" font-family="monospace">Fsin=' + R.fSin.toFixed(1) + ' kN · Fhel=' + R.fHel.toFixed(1) + ' kN · 最大压缩 ' + R.maxComp.toFixed(0) + ' kN</text>';

    /* 底部结论行 */
    var line2;
    if (R.buckState === 'hel') line2 = '螺旋屈曲段 ' + Math.round(R.H - R.zHel) + ' m（' + Math.round(R.zHel) + '–' + R.H + ' m），接头承受附加弯矩，建议加伸缩节';
    else if (R.buckState === 'sin') line2 = '正弦屈曲段 ' + Math.round(R.H - R.zSin) + ' m（' + Math.round(R.zSin) + '–' + R.H + ' m），未达螺旋屈曲';
    else line2 = '全井段有效轴力未低于正弦屈曲临界载荷，管柱轴向稳定';
    s += '<text x="' + pl + '" y="' + (bandY + bandH + 30) + '" font-size="9" fill="#4d565b">' + line2 + '</text>';

    svg.innerHTML = s;
  }

  /* ---------- 面板 4b：井底载荷分解（canvas，HiDPI） ---------- */
  function drawDecomp() {
    var cv = $('decomp');
    var W = 430, H = 200;
    var ctx = setupCanvas(cv, W, H);
    var pl = 40, pr = 12, pt = 26, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;

    var items = [
      { name: '自重', v: R.wb * R.H / 1000, c: '#41699b' },
      { name: '温度', v: R.dFT, c: '#b05a51' },
      { name: '鼓胀', v: R.dFb, c: '#2f7d6b' },
      { name: '活塞', v: R.dFp, c: '#c9a15a' }
    ];
    var total = items.reduce(function (a, b) { return a + b.v; }, 0);
    var vMax = Math.max.apply(null, items.map(function (o) { return Math.abs(o.v); }).concat([Math.abs(total)])) * 1.25;
    vMax = Math.max(100, Math.ceil(vMax / 100) * 100);
    var yOf = function (v) { return pt + ph / 2 - v / vMax * (ph / 2); };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    /* 零线与网格 */
    [-1, -0.5, 0.5, 1].forEach(function (k) {
      var y = yOf(k * vMax);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + pw, y); ctx.stroke();
    });
    var y0 = yOf(0);
    ctx.strokeStyle = '#cfc7b6'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(pl, y0); ctx.lineTo(pl + pw, y0); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.font = '9px Consolas, monospace';
    ctx.fillStyle = '#9ba3a9';
    ctx.textAlign = 'right';
    [-1, -0.5, 0, 0.5, 1].forEach(function (k) {
      ctx.fillText(Math.round(k * vMax) + '', pl - 5, yOf(k * vMax) + 3);
    });

    var all = items.concat([{ name: '井底净轴力', v: total, c: total >= 0 ? '#2f7d6b' : '#b05a51', bold: true }]);
    var bw = Math.min(52, pw / all.length * 0.55);
    all.forEach(function (o, i) {
      var cx = pl + pw * (i + 0.5) / all.length;
      var yv = yOf(o.v);
      var top = Math.min(y0, yv), hh = Math.max(1.5, Math.abs(y0 - yv));
      ctx.fillStyle = o.c;
      ctx.globalAlpha = o.bold ? 1 : 0.78;
      ctx.fillRect(cx - bw / 2, top, bw, hh);
      ctx.globalAlpha = 1;
      if (o.bold) { ctx.strokeStyle = '#2f3538'; ctx.strokeRect(cx - bw / 2, top, bw, hh); }
      /* 数值标签 */
      ctx.fillStyle = o.c;
      ctx.font = '600 10px Consolas, monospace';
      ctx.textAlign = 'center';
      var ly = o.v >= 0 ? top - 5 : top + hh + 11;
      ctx.fillText((o.v >= 0 ? '+' : '') + o.v.toFixed(0), cx, ly);
      /* 名称 */
      ctx.fillStyle = '#5d666d';
      ctx.font = '9.5px sans-serif';
      ctx.fillText(o.name, cx, H - 16);
      if (o.bold) {
        ctx.fillStyle = '#9ba3a9'; ctx.font = '8.5px sans-serif';
        ctx.fillText('= Σ 四项', cx, H - 5);
      }
    });

    ctx.fillStyle = '#79828a';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('有效轴力组成（井底截面）', pl, pt - 10);
    ctx.textAlign = 'right';
    ctx.fillText('kN', pl + pw, pt - 10);
  }

  /* ---------- 指标卡 + 结论 ---------- */
  function renderMetrics() {
    var mFwh = $('m-fwh'), mFbh = $('m-fbh'), mVm = $('m-vm'), mSf = $('m-sf'), mBuck = $('m-buck'), mDl = $('m-dl');

    mFwh.innerHTML = R.Fe[0].toFixed(0) + '<small> kN（拉）</small>';
    mFwh.parentNode.className = 'mcard';

    var fbh = R.Fe[R.Fe.length - 1];
    mFbh.innerHTML = fbh.toFixed(0) + '<small> kN（' + (fbh >= 0 ? '拉' : '压') + '）</small>';
    mFbh.parentNode.className = 'mcard' + (fbh < -R.fHel ? ' bad' : (fbh < 0 ? ' warn' : ''));

    mVm.innerHTML = R.vmMax.toFixed(0) + '<small> MPa</small>';
    mVm.parentNode.className = 'mcard' + (R.vmMax > R.sy ? ' bad' : '');

    mSf.innerHTML = R.sfMin.toFixed(2) + '<small> / ' + R.sfJMin.toFixed(2) + '</small>';
    mSf.parentNode.className = 'mcard' + (R.sfJMin < 1 ? ' bad' : (R.sfJMin < SF_DESIGN ? ' warn' : ''));

    var bTxt = { stable: '未屈曲', sin: '正弦屈曲', hel: '螺旋屈曲' }[R.buckState];
    mBuck.innerHTML = bTxt;
    mBuck.parentNode.className = 'mcard' + (R.buckState === 'hel' ? ' bad' : (R.buckState === 'sin' ? ' warn' : ''));

    mDl.innerHTML = (R.dL >= 0 ? '+' : '') + R.dL.toFixed(2) + '<small> m</small>';
    mDl.parentNode.className = 'mcard';

    var v = $('verdict');
    var head = '井口有效轴力 <b>' + R.Fe[0].toFixed(0) + '</b> kN（拉），井底 <b>' + fbh.toFixed(0) + '</b> kN（' + (fbh >= 0 ? '拉' : '压') + '）；Von Mises 峰值 <b>' + R.vmMax.toFixed(0) + '</b> MPa（井口），管体 SF <b>' + R.sfMin.toFixed(2) + '</b>、接头 SF <b>' + R.sfJMin.toFixed(2) + '</b>；';
    if (R.sfJMin < 1) {
      v.className = 'verdict bad';
      v.innerHTML = head + '接头三轴安全系数 <b>&lt;1</b>：当前工况进入屈服区。建议钢级升至 125 或壁厚加档，并复核井口压力上限。';
    } else if (R.buckState === 'hel') {
      v.className = 'verdict ' + (R.sfJMin < SF_DESIGN ? 'warn' : 'bad');
      v.innerHTML = head + '井底压缩 <b>' + R.maxComp.toFixed(0) + '</b> kN 超过螺旋屈曲临界 <b>' + R.fHel.toFixed(0) + '</b> kN，屈曲段约 <b>' + Math.round(R.H - R.zHel) + '</b> m。建议加装伸缩节或提高坐封吨位预拉。';
    } else if (R.sfJMin < SF_DESIGN) {
      v.className = 'verdict warn';
      v.innerHTML = head + '接头 SF 低于设计线 <b>1.25</b>：建议壁厚加档或升钢级；当前屈曲判定为「' + bTxt + '」。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '三轴安全系数满足 ≥1.25（接头折减 0.85 后），屈曲判定「' + bTxt + '」，当前组合可用于设计下发。';
    }
  }

  function render() {
    R = compute(S);
    drawSchem();
    drawAxial();
    drawTriax();
    drawBuckBand();
    drawDecomp();
    renderMetrics();
  }

  /* ---------- 悬停 tooltip ---------- */
  function bindHover(svgId, boxId, tipId, htmlFn, ptTop) {
    var svg = $(svgId), tip = $(tipId), box = $(boxId);
    if (!svg || !tip || !box) return;
    var W = 900, pl = 70, pr = 30, vh = 320;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var vy = (evt.clientY - r.top) * (vh / r.height);
      var frac = clamp((vy - ptTop) / (vh - ptTop - 40), 0, 1);
      var idx = Math.round(frac * (R.zs.length - 1));
      idx = clamp(idx, 0, R.zs.length - 1);
      if (vx < pl - 20 || vx > W - pr + 10) { tip.style.display = 'none'; return; }
      tip.innerHTML = htmlFn(idx);
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 14, 4, rb.width - 230) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 80) + 'px';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    depth: function (v) { return v + ' m'; },
    whp: function (v) { return v + ' MPa'; },
    bht: function (v) { return v.toFixed(1) + ' ℃'; },
    wall: function (v) { return v.toFixed(2) + ' mm'; }
  };
  var KEYS = ['depth', 'whp', 'bht', 'wall'];

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#seg-grade button'), function (btn) {
      btn.addEventListener('click', function () {
        S.grade = this.getAttribute('data-g');
        Array.prototype.forEach.call(document.querySelectorAll('#seg-grade button'), function (b) {
          b.classList.toggle('active', b === btn);
        });
        $('grade-tip').textContent = GRADES[S.grade].note;
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      KEYS.forEach(function (k) {
        $('s-' + k).value = DEF[k];
        S[k] = DEF[k];
        $('o-' + k).textContent = OUT[k](S[k]);
      });
      S.grade = DEF.grade;
      Array.prototype.forEach.call(document.querySelectorAll('#seg-grade button'), function (b) {
        b.classList.toggle('active', b.getAttribute('data-g') === DEF.grade);
      });
      $('grade-tip').textContent = GRADES[S.grade].note;
      render();
    });
  }

  bind();
  render();
  bindHover('axial', 'axial-box', 'axial-tip', function (i) {
    var st = -R.Fe[i] <= 0 ? '稳定' : (-R.Fe[i] <= R.fSin ? '稳定' : (-R.Fe[i] <= R.fHel ? '正弦屈曲' : '螺旋屈曲'));
    return '<b>井深 ' + R.zs[i].toFixed(0) + ' m</b><br>有效轴力 <b>' + R.Fe[i].toFixed(1) + ' kN</b><br>真实轴力 <b>' + R.Ft[i].toFixed(1) + ' kN</b><br><span style="color:#8a9298">状态：' + st + '</span>';
  }, 30);
  bindHover('triax', 'triax-box', 'triax-tip', function (i) {
    return '<b>井深 ' + R.zs[i].toFixed(0) + ' m</b><br>Von Mises <b>' + R.Vm[i].toFixed(1) + ' MPa</b><br>屈服（折减后）<b>' + R.SyT[i].toFixed(0) + ' MPa</b><br>安全系数 <b>' + R.Sf[i].toFixed(2) + '</b>（接头 ' + R.SfJ[i].toFixed(2) + '）';
  }, 34);

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { if (R) drawDecomp(); }, 120);
  });
})();

/* ======= 真实数据来源页：API 5CT / 屈曲文献 ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(x, y, s, attrs, parent) { var t = el('text', attrs || {}, parent); t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s; return t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var KSI = 6.89476;

  /* API 5CT Table C.5（ISO 11960）钢级强度；屈服下限/上限、最小抗拉，MPa */
  var GRADE_DATA = [
    { g: 'J55',  y0: 379, y1: 552,  ts: 517, svc: '一般服役低强度' },
    { g: 'K55',  y0: 379, y1: 552,  ts: 655, svc: '一般服役，抗拉高于 J55' },
    { g: 'N80',  y0: 552, y1: 758,  ts: 689, svc: '中强度一般服役' },
    { g: 'L80',  y0: 552, y1: 655,  ts: 655, svc: '酸性服役（硬度 ≤23 HRC）' },
    { g: 'T95',  y0: 655, y1: 758,  ts: 724, svc: '酸性服役（≤25.4 HRC）' },
    { g: 'C110', y0: 758, y1: 828,  ts: 793, svc: '酸性服役 ≈ 本例 110S' },
    { g: 'P110', y0: 758, y1: 965,  ts: 862, svc: '高强度一般服役 ≈ 本例 P110' },
    { g: 'Q125', y0: 862, y1: 1034, ts: 931, svc: '超高强度 ≈ 本例 125' }
  ];
  var selG = -1;

  /* Φ88.9 mm 油管尺寸档（API 5CT 尺寸表；几何量计算值） */
  var TUBING = [
    { t: 6.45, lb: 9.20 },
    { t: 7.34, lb: 10.20 },
    { t: 9.52, lb: 12.70 }
  ];

  function drawGrades() {
    var svg = document.getElementById('gr-chart'); if (!svg) return;
    var W = 900, H = 300, PL = 64, PR = 20, PT = 30, PB = 40;
    var plotW = W - PL - PR, plotH = H - PT - PB;
    var X1 = 1100;
    function xOf(m) { return PL + m / X1 * plotW; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var m = 0; m <= X1; m += 100) {
      var x = xOf(m);
      el('line', { x1: x, y1: PT, x2: x, y2: PT + plotH, stroke: m ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(x, PT + plotH + 14, m + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
      txt(x, PT + plotH + 26, (m / KSI).toFixed(0), { 'font-size': 8, fill: '#c2b9a6', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 2, '强度 (MPa) ／ 下行灰字 ksi', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(PL + 4, 14, 'API Spec 5CT Table C.5：柱条 = 屈服强度范围，红标 = 最小抗拉强度；本例钢级 C110 / P110 / Q125', { 'font-size': 9, fill: '#8a9298' }, svg);

    var bh = plotH / GRADE_DATA.length * 0.52, gap = plotH / GRADE_DATA.length;
    GRADE_DATA.forEach(function (g, i) {
      var cy = PT + gap * (i + 0.5), sel = selG === i;
      var mine = ['C110', 'P110', 'Q125'].indexOf(g.g) >= 0;
      el('rect', {
        x: xOf(g.y0), y: cy - bh / 2, width: xOf(g.y1) - xOf(g.y0), height: bh, rx: 3,
        fill: mine ? '#2f7d6b' : '#a8b8b1', opacity: sel ? 1 : 0.75,
        stroke: sel ? '#1d4a3f' : 'none', 'stroke-width': sel ? 2 : 0, style: 'cursor:pointer', 'data-i': i
      }, svg);
      /* 最小抗拉标记 */
      el('line', { x1: xOf(g.ts), y1: cy - bh / 2 - 4, x2: xOf(g.ts), y2: cy + bh / 2 + 4, stroke: '#b05a51', 'stroke-width': 2.2 }, svg);
      txt(PL - 8, cy + 3, g.g, { 'font-size': 10, fill: sel ? '#1d4a3f' : '#4d565b', 'text-anchor': 'end', 'font-weight': sel || mine ? 700 : 400 }, svg);
      txt(xOf(g.y1) + 6, cy - 1, g.y0 + '–' + g.y1, { 'font-size': 8.5, fill: '#79828a', 'font-family': 'monospace' }, svg);
      txt(xOf(g.y1) + 6, cy + 10, '抗拉≥' + g.ts, { 'font-size': 8, fill: '#b05a51', 'font-family': 'monospace' }, svg);
    });
  }

  function renderGrDetail() {
    var d = document.getElementById('gr-detail'); if (!d) return;
    if (selG >= 0) {
      var g = GRADE_DATA[selG];
      d.className = 'r-detail active';
      d.innerHTML = '<b>API 5CT Table C.5</b>：钢级 <b>' + g.g + '</b>，屈服强度 <b>' + g.y0 + '–' + g.y1 + ' MPa</b>（' + (g.y0 / KSI).toFixed(0) + '–' + (g.y1 / KSI).toFixed(0) + ' ksi），最小抗拉 <b>' + g.ts + ' MPa</b>；定位：' + g.svc + '。三轴设计取屈服下限并做温度折减。';
    } else {
      d.className = 'r-detail';
      d.innerHTML = '悬停读取数据；点击柱条锁定该钢级。要点：本例三档钢级 P110 / 110S / 125 最小屈服分别为 <b>758 / 758 / 862 MPa</b>——110S 为酸性服役钢级，屈服上限被控制在 828 MPa 以抑制硫化物应力开裂，设计取最小屈服计算。';
    }
  }

  function bindGrades() {
    var svg = document.getElementById('gr-chart'), tip = document.getElementById('gr-tip'), box = document.getElementById('gr-box');
    if (!svg || !tip || !box) return;
    var W = 900, PL = 64, PR = 20, PT = 30, PB = 40;
    var plotH = W * 0 + 300 - PT - PB;
    function gradeAt(evt) {
      var r = svg.getBoundingClientRect();
      var vy = (evt.clientY - r.top) * (300 / r.height);
      var k = Math.floor((vy - PT) / plotH * GRADE_DATA.length);
      return (k >= 0 && k < GRADE_DATA.length) ? k : -1;
    }
    svg.addEventListener('mousemove', function (evt) {
      var k = gradeAt(evt);
      if (k >= 0) {
        var g = GRADE_DATA[k], rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + g.g + '</b><br>屈服 <b>' + g.y0 + '–' + g.y1 + ' MPa</b><br>抗拉 ≥<b>' + g.ts + ' MPa</b><br><span style="color:#8a9298">点击锁定</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    svg.addEventListener('click', function (evt) {
      selG = gradeAt(evt);
      drawGrades(); renderGrDetail();
      var rows = document.querySelectorAll('#gr-body tr');
      rows.forEach(function (r, i) { r.classList.toggle('sel', i === selG); });
    });
  }

  function buildGrTable() {
    var body = document.getElementById('gr-body'); if (!body) return;
    GRADE_DATA.forEach(function (g, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><b>' + g.g + '</b></td><td class="num">' + g.y0 + ' MPa（' + (g.y0 / KSI).toFixed(0) + ' ksi）</td>' +
        '<td class="num">' + g.y1 + ' MPa</td><td class="num">' + g.ts + ' MPa</td><td>' + g.svc + '</td>';
      tr.addEventListener('click', function () {
        selG = i; drawGrades(); renderGrDetail();
        document.querySelectorAll('#gr-body tr').forEach(function (r, j) { r.classList.toggle('sel', j === selG); });
      });
      body.appendChild(tr);
    });
  }

  function buildTubTable() {
    var body = document.getElementById('tub-body'); if (!body) return;
    TUBING.forEach(function (o) {
      var D = 88.9, d = D - 2 * o.t;
      var As = Math.PI / 4 * (D * D - d * d);
      var Im = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(d, 4));
      var kgm = As * 1e-6 * 7850;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + o.t.toFixed(2) + '</td><td class="num">' + o.lb.toFixed(2) + '</td>' +
        '<td class="num">' + kgm.toFixed(2) + '</td><td class="num">' + d.toFixed(2) + '</td>' +
        '<td class="num">' + As.toFixed(1) + '</td><td class="num">' + (Im / 1e6).toFixed(3) + '</td>';
      body.appendChild(tr);
    });
  }

  /* Chen et al. (1990) 屈曲临界载荷随井斜角变化（Φ88.9×7.34 mm） */
  function drawBuckChart() {
    var svg = document.getElementById('bk-chart'); if (!svg) return;
    var W = 900, H = 260, PL = 56, PR = 20, PT = 26, PB = 40;
    var plotW = W - PL - PR, plotH = H - PT - PB;
    var D = 88.9, d = D - 2 * 7.34;
    var As = Math.PI / 4 * (D * D - d * d);
    var Im = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(d, 4));
    var EI = 206800e6 * Im * 1e-12;
    var wb = As * 1e-6 * 7850 * 9.81 * (1 - 1100 / 7850);
    var rc = (157.1 - 88.9) / 2 / 1000;
    function fSin(th) { return 2 * Math.sqrt(EI * wb * Math.sin(th) / rc) / 1000; }
    var X0 = 1, X1 = 30, Y1 = 80;
    function xOf(a) { return PL + (a - X0) / (X1 - X0) * plotW; }
    function yOf(f) { return PT + plotH - f / Y1 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var f = 0; f <= Y1; f += 10) {
      var y = yOf(f);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: f ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, f + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    for (var a = 5; a <= X1; a += 5) {
      el('line', { x1: xOf(a), y1: PT, x2: xOf(a), y2: PT + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(xOf(a), PT + plotH + 14, a + '°', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 4, '平均井斜角 θ', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(14, PT + plotH / 2, '临界载荷 (kN)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (PT + plotH / 2) + ')' }, svg);
    txt(PL + 4, 14, 'F = 2√(EI·w·sinθ/r)，7" 套管内 Φ88.9×7.34 mm 油管（Chen, Lin & Cheatham 1990）', { 'font-size': 9, fill: '#8a9298' }, svg);

    var i, a, dS = '', dH = '';
    for (i = 0; i <= 100; i++) {
      a = X0 + (X1 - X0) * i / 100;
      dS += (i ? 'L' : 'M') + xOf(a).toFixed(1) + ' ' + yOf(fSin(a * Math.PI / 180)).toFixed(1) + ' ';
      dH += (i ? 'L' : 'M') + xOf(a).toFixed(1) + ' ' + yOf(Math.SQRT2 * fSin(a * Math.PI / 180)).toFixed(1) + ' ';
    }
    el('path', { d: dS, fill: 'none', stroke: '#c9a15a', 'stroke-width': 2.2 }, svg);
    el('path', { d: dH, fill: 'none', stroke: '#b05a51', 'stroke-width': 2.2 }, svg);
    /* 曲线末端标注 */
    var fS30 = fSin(30 * Math.PI / 180), fH30 = Math.SQRT2 * fS30;
    txt(xOf(30) - 6, yOf(fS30) - 5, 'Fsin', { 'font-size': 9.5, fill: '#9a7a1c', 'text-anchor': 'end', 'font-weight': 600 }, svg);
    txt(xOf(30) - 6, yOf(fH30) - 5, 'Fhel', { 'font-size': 9.5, fill: '#a85147', 'text-anchor': 'end', 'font-weight': 600 }, svg);
    /* 本例 5° */
    var f5 = fSin(5 * Math.PI / 180);
    el('line', { x1: xOf(5), y1: PT, x2: xOf(5), y2: PT + plotH, stroke: '#8a9298', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
    el('circle', { cx: xOf(5), cy: yOf(f5), r: 4, fill: '#c9a15a', stroke: '#fff', 'stroke-width': 1.4 }, svg);
    el('circle', { cx: xOf(5), cy: yOf(Math.SQRT2 * f5), r: 4, fill: '#b05a51', stroke: '#fff', 'stroke-width': 1.4 }, svg);
    txt(xOf(5) + 7, yOf(Math.SQRT2 * f5) - 6, '本例 5°：Fsin=' + f5.toFixed(1) + ' / Fhel=' + (Math.SQRT2 * f5).toFixed(1) + ' kN', { 'font-size': 9, fill: '#4d565b', 'font-family': 'monospace' }, svg);
  }

  function bindBuckTip() {
    var svg = document.getElementById('bk-chart'), tip = document.getElementById('bk-tip'), box = document.getElementById('bk-box');
    if (!svg || !tip || !box) return;
    var W = 900, PL = 56, PR = 20, X0 = 1, X1 = 30;
    var D = 88.9, d = D - 2 * 7.34;
    var As = Math.PI / 4 * (D * D - d * d);
    var Im = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(d, 4));
    var EI = 206800e6 * Im * 1e-12;
    var wb = As * 1e-6 * 7850 * 9.81 * (1 - 1100 / 7850);
    var rc = (157.1 - 88.9) / 2 / 1000;
    function fSin(th) { return 2 * Math.sqrt(EI * wb * Math.sin(th) / rc) / 1000; }
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      if (vx < PL - 6 || vx > W - PR + 6) { tip.style.display = 'none'; return; }
      var a = X0 + clamp((vx - PL) / (W - PL - PR), 0, 1) * (X1 - X0);
      var f = fSin(a * Math.PI / 180), rb = box.getBoundingClientRect();
      tip.innerHTML = '<b>θ = ' + a.toFixed(1) + '°</b><br>F<sub>sin</sub> = <b>' + f.toFixed(1) + ' kN</b><br>F<sub>hel</sub> = <b>' + (Math.SQRT2 * f).toFixed(1) + ' kN</b>';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 170) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 64) + 'px';
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
  buildGrTable(); buildTubTable();
  drawGrades(); renderGrDetail(); bindGrades();
  drawBuckChart(); bindBuckTip();
})();
