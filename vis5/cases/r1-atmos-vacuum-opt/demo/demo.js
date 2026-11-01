/* ======= 常减压装置操作智能优化 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI 适配：backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
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

  var FEED = 33000;            // 进料 t/d（1,200 万吨/年 ≈ 3.3 万 t/d）
  var PRICE = { naph: 4800, kero: 5200, dsl: 5800, vgo: 5000, res: 3200 }; // 元/t
  var ENERGY_BASE = 92.4;      // 能耗指数=100 时的燃料+蒸汽成本（万元/天）

  var DEF = { tf: 356, tvf: 398, ptop: 0.05, pvac: 3.5, steam: 1.4, reflux: 0.35, ovap: 2.5 };
  var S = Object.assign({}, DEF);
  var OPT = null;              // 寻优推荐点
  var CMP = null;              // 优化前后对比快照

  /* ---------- 代理模型（演示用降阶 surrogate） ---------- */
  function calc(s) {
    var dA = clamp((s.tf - 330) / 40, 0, 1);                    // 常压切割深度
    var vacF = clamp((8 - s.pvac) / 6.5, 0, 1);                 // 真空度因子
    var dV = clamp((s.tvf - 370) / 45, 0, 1) * vacF;            // 减压深拔
    var stF = s.steam - 1.4, rfF = s.reflux - 0.35;

    var naph = 12.4 + 1.6 * dA + 0.9 * stF + 0.6 * rfF;         // 石脑油（常顶）
    var kero = 10.8 + 1.2 * dA + 0.5 * stF - 0.2 * rfF;         // 煤油（常一）
    var dsl = 15.5 + 1.0 * dA + 0.4 * stF - 0.6 * rfF;          // 柴油（常二/三）
    var gas = 1.2;                                              // 塔顶气+损失
    var light = naph + kero + dsl;                              // 轻油收率
    var atmosRes = 100 - light - gas;                           // 常底渣油
    var vgo = 16.5 + 5.0 * dV + 1.0 * (s.ovap - 2.5);           // 减压蜡油
    vgo = Math.min(vgo, atmosRes - 12);
    var res = atmosRes - vgo;                                   // 减压渣油
    var vgoPull = vgo / atmosRes * 100;                         // 减压拔出率
    var totalPull = light + vgo;                                // 总拔

    /* TBP 切割点与分馏锐度（GB/T 17280 / GB/T 6536 口径） */
    var cutNK = 148 + 16 * (dA - 0.65) - 6 * rfF;               // 石脑油/煤油切割点
    var cutKD = 268 + 14 * (dA - 0.65) - 8 * rfF;               // 煤油/柴油切割点
    var sharp = 0.4 + 0.6 * clamp((s.reflux - 0.20) / 0.35, 0, 1) + 0.08 * stF;
    var naph95 = cutNK + 22 - 26 * sharp;                       // 常顶 D86 95% 点
    var kero5 = cutNK - 6 + 16 * (1 - sharp);                   // 常一 D86 5% 点
    var gap12 = kero5 - naph95;                                 // 常一/常二间隙(+)/重叠(-)
    var dsl95 = cutKD + 30 - 18 * sharp;                        // 柴油 D86 95% 点
    var cutAgo = 348 + 10 * (dA - 0.65);                        // 柴油/蜡油切割点
    var cutVgoEnd = 515 + 45 * dV;                              // 蜡油切割终点

    /* 能耗：炉负荷 + 汽提蒸汽（GB 30251 限额思路的指数化） */
    var fuel = 0.62 * ((s.tf - 250) / 106) + 0.38 * ((s.tvf - 330) / 68) * (atmosRes / 57.6);
    var energyIdx = 100 * (0.8 * fuel + 0.2 * (s.steam / 1.4)) * (1 + 0.06 * rfF);

    /* 产值（元/t 原油） */
    var rev = (naph * PRICE.naph + kero * PRICE.kero + dsl * PRICE.dsl +
      vgo * PRICE.vgo + res * PRICE.res) / 100;

    return {
      dA: dA, vacF: vacF, dV: dV, naph: naph, kero: kero, dsl: dsl, gas: gas,
      light: light, atmosRes: atmosRes, vgo: vgo, res: res,
      vgoPull: vgoPull, totalPull: totalPull,
      cutNK: cutNK, cutKD: cutKD, sharp: sharp, naph95: naph95, kero5: kero5,
      gap12: gap12, dsl95: dsl95, cutAgo: cutAgo, cutVgoEnd: cutVgoEnd,
      energyIdx: energyIdx, rev: rev
    };
  }

  var BASE = calc(DEF);

  function margin(s, m) {
    return (m.rev - BASE.rev) * FEED / 10000 - (m.energyIdx - BASE.energyIdx) / 100 * ENERGY_BASE;
  }

  /* ---------- 硬约束（安全包络 + 产品质量） ---------- */
  function violations(s, m) {
    var v = [];
    if (s.tf > 370.001) v.push('常压炉出口温度超 370 ℃ 安全上限');
    if (s.tvf > 412.001) v.push('减压炉出口温度超 412 ℃ 结焦上限');
    if (m.naph95 > 175) v.push('石脑油干点 ' + m.naph95.toFixed(1) + ' ℃ 超 175 ℃ 指标');
    if (m.dsl95 > 365) v.push('柴油 95% 点 ' + m.dsl95.toFixed(1) + ' ℃ 超 365 ℃ 限值');
    if (m.gap12 < -8) v.push('常一/常二重叠 ' + (-m.gap12).toFixed(1) + ' ℃ 超 8 ℃，分馏精度不可接受');
    if (m.energyIdx > 112) v.push('加热炉负荷指数 ' + m.energyIdx.toFixed(1) + ' 超 112 上限');
    if (m.res < 12.001) v.push('减压渣油收率触及 12% 下限，深拔过度、结焦风险上升');
    if (s.ptop < 0.0299 || s.ptop > 0.0801) v.push('常压塔顶压力越出 0.03–0.08 MPa(g) 窗口');
    if (s.pvac < 1.999) v.push('减压塔顶压力低于抽空器能力 2.0 kPa(a)');
    return v;
  }

  /* ---------- 工具 ---------- */
  function mixColor(c1, c2, t) {
    t = clamp(t, 0, 1);
    return 'rgb(' + Math.round(c1[0] + (c2[0] - c1[0]) * t) + ',' +
      Math.round(c1[1] + (c2[1] - c1[1]) * t) + ',' + Math.round(c1[2] + (c2[2] - c1[2]) * t) + ')';
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function star(ctx, cx, cy, r, col) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.45;
      var x = cx + rr * Math.cos(ang), y = cy + rr * Math.sin(ang);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
  }
  function fmtG(g) { return (g >= 0 ? '+' : '') + g.toFixed(1); }

  /* ---------- 面板 1：装置流程示意 ---------- */
  function drawFlow(m) {
    var defs = '<defs>' +
      '<marker id="arwK" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#79828a"/></marker>' +
      '<marker id="arwN" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#41699b"/></marker>' +
      '<marker id="arwG" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#2f7d6b"/></marker>' +
      '<marker id="arwO" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#c9a15a"/></marker>' +
      '<marker id="arwR" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#b05a51"/></marker>' +
      '</defs>';
    var g = '<rect x="0" y="0" width="470" height="246" fill="#fdfcf9" rx="6"/>' + defs;

    /* 原油进料 */
    g += '<text x="6" y="106" font-size="9" fill="#5d666d">原油 3.3 万 t/d</text>';
    g += '<line x1="8" y1="118" x2="38" y2="118" stroke="#79828a" stroke-width="2" marker-end="url(#arwK)"/>';

    /* 换热网络 */
    g += '<rect x="40" y="100" width="50" height="38" rx="4" fill="#efece1" stroke="#d8d0bc"/>';
    g += '<text x="65" y="116" font-size="9" fill="#5d666d" text-anchor="middle">换热网络</text>';
    g += '<text x="65" y="129" font-size="8" fill="#9ba3a9" text-anchor="middle" font-family="monospace">~250 ℃</text>';
    g += '<line x1="90" y1="118" x2="106" y2="118" stroke="#79828a" stroke-width="2" marker-end="url(#arwK)"/>';

    /* 常压炉 */
    g += '<rect x="108" y="98" width="46" height="42" rx="4" fill="#faf3e2" stroke="#c9a15a"/>';
    g += '<text x="131" y="113" font-size="9" fill="#9a7a1c" text-anchor="middle">常压炉</text>';
    g += '<text x="131" y="127" font-size="9" fill="#9a7a1c" text-anchor="middle" font-family="monospace" font-weight="600">' + S.tf.toFixed(0) + ' ℃</text>';
    g += '<line x1="154" y1="118" x2="184" y2="118" stroke="#79828a" stroke-width="2" marker-end="url(#arwK)"/>';

    /* 常压塔 */
    g += '<text x="217" y="14" font-size="9.5" fill="#235f51" text-anchor="middle" font-weight="600">常压塔 · P顶 ' + S.ptop.toFixed(3) + ' MPa(g)</text>';
    g += '<rect x="186" y="22" width="62" height="188" rx="5" fill="#e9f1ec" stroke="#2f7d6b"/>';

    /* 塔顶石脑油 */
    g += '<line x1="248" y1="32" x2="316" y2="32" stroke="#41699b" stroke-width="2" marker-end="url(#arwN)"/>';
    g += '<text x="252" y="24" font-size="8.5" fill="#41699b">石脑油（常顶） ' + m.naph.toFixed(1) + '%</text>';

    /* 常一线 煤油 */
    g += '<line x1="248" y1="86" x2="316" y2="86" stroke="#2f7d6b" stroke-width="2" marker-end="url(#arwG)"/>';
    g += '<text x="252" y="78" font-size="8.5" fill="#2f7d6b">煤油（常一） ' + m.kero.toFixed(1) + '%</text>';

    /* 常二/三线 柴油 */
    g += '<line x1="248" y1="140" x2="316" y2="140" stroke="#c9a15a" stroke-width="2" marker-end="url(#arwO)"/>';
    g += '<text x="252" y="132" font-size="8.5" fill="#9a7a1c">柴油（常二/三） ' + m.dsl.toFixed(1) + '%</text>';

    /* 汽提蒸汽 */
    g += '<line x1="170" y1="196" x2="194" y2="196" stroke="#79828a" stroke-width="1.6" marker-end="url(#arwK)"/>';
    g += '<text x="168" y="190" font-size="8" fill="#79828a" text-anchor="end">汽提蒸汽 ' + S.steam.toFixed(2) + '%</text>';

    /* 常底渣油 → 减压炉 */
    g += '<line x1="248" y1="196" x2="294" y2="196" stroke="#79828a" stroke-width="2" marker-end="url(#arwK)"/>';
    g += '<text x="271" y="188" font-size="8" fill="#79828a" text-anchor="middle">常底渣油</text>';

    /* 减压炉 */
    g += '<rect x="296" y="176" width="46" height="42" rx="4" fill="#faf3e2" stroke="#c9a15a"/>';
    g += '<text x="319" y="191" font-size="9" fill="#9a7a1c" text-anchor="middle">减压炉</text>';
    g += '<text x="319" y="205" font-size="9" fill="#9a7a1c" text-anchor="middle" font-family="monospace" font-weight="600">' + S.tvf.toFixed(0) + ' ℃</text>';
    g += '<path d="M319,176 L319,150 L364,150" fill="none" stroke="#79828a" stroke-width="2" marker-end="url(#arwK)"/>';

    /* 减压塔 */
    g += '<text x="397" y="14" font-size="9.5" fill="#41699b" text-anchor="middle" font-weight="600">减压塔 · P顶 ' + S.pvac.toFixed(1) + ' kPa(a)</text>';
    g += '<rect x="366" y="48" width="62" height="162" rx="5" fill="#e8edf3" stroke="#41699b"/>';

    /* 减顶气 */
    g += '<line x1="397" y1="48" x2="397" y2="28" stroke="#79828a" stroke-width="1.6" marker-end="url(#arwK)"/>';
    g += '<text x="404" y="30" font-size="8" fill="#79828a">减顶气·抽空</text>';

    /* 减线 VGO */
    g += '<line x1="366" y1="118" x2="336" y2="118" stroke="#79828a" stroke-width="2" marker-end="url(#arwK)"/>';
    g += '<text x="362" y="110" font-size="8.5" fill="#5d666d" text-anchor="end">蜡油 VGO（减一/二） ' + m.vgo.toFixed(1) + '%</text>';

    /* 减底渣油 */
    g += '<line x1="397" y1="210" x2="397" y2="230" stroke="#b05a51" stroke-width="2" marker-end="url(#arwR)"/>';
    g += '<text x="391" y="242" font-size="8.5" fill="#b05a51" text-anchor="end">减压渣油 ' + m.res.toFixed(1) + '%</text>';

    /* 过汽化率标注（置于减压塔内空白区） */
    g += '<text x="397" y="140" font-size="8" fill="#9ba3a9" text-anchor="middle">过汽化率 ' + S.ovap.toFixed(1) + '%</text>';

    $('flow').innerHTML = g;
  }

  /* ---------- 面板 2：塔内温度剖面 ---------- */
  var PROF = null;
  function drawProfile(s) {
    var cv = $('cv-profile');
    var W = 470, H = 240;
    var ctx = setupCanvas(cv, W, H);
    var pl = 66, pr = 14, pt = 14, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var T0 = 50, T1 = 420;
    function X(t) { return pl + (t - T0) / (T1 - T0) * pw; }

    var labels = ['常顶', '顶循', '常一线', '常二线', '常三线', '常底(汽化段)', '减顶', '减一线', '减二线', '减底(汽化段)'];
    var tTop = 105 + 300 * (s.ptop - 0.03);
    var tFlashA = s.tf - 22;
    var tVTop = 78 + 10 * (s.pvac - 2);
    var tVFlash = s.tvf - 35;
    var frA = [0, 0.15, 0.35, 0.58, 0.78, 1];
    var frV = [0, 0.4, 0.75, 1];
    var temps = [];
    frA.forEach(function (f) { temps.push(tTop + (tFlashA - tTop) * Math.pow(f, 1.12)); });
    frV.forEach(function (f) { temps.push(tVTop + (tVFlash - tVTop) * Math.pow(f, 1.1)); });

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 纵向温度网格 */
    ctx.font = '9px Consolas, monospace';
    for (var t = 100; t <= 400; t += 50) {
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(X(t), pt); ctx.lineTo(X(t), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center'; ctx.fillText(t + '', X(t), H - 10);
    }
    /* 370 ℃ 上限 */
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(X(370), pt); ctx.lineTo(X(370), pt + ph); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right'; ctx.font = '8.5px sans-serif';
    ctx.fillText('370℃ 上限', X(370) - 4, pt + 10);

    /* 行标签与点 */
    var rowH = ph / 10;
    PROF = { pts: [], W: W, H: H };
    ctx.font = '9px "PingFang SC", "Microsoft YaHei", sans-serif';
    labels.forEach(function (lb, i) {
      var y = pt + rowH * (i + 0.5);
      ctx.fillStyle = '#5d666d'; ctx.textAlign = 'right';
      ctx.fillText(lb, pl - 8, y + 3);
      PROF.pts.push({ x: X(temps[i]), y: y, label: lb, t: temps[i], tower: i < 6 ? '常压塔' : '减压塔' });
    });

    /* 塔间分隔 */
    var yd = pt + rowH * 6;
    ctx.strokeStyle = '#d8d0bc'; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yd); ctx.lineTo(pl + pw, yd); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'left'; ctx.font = '8.5px sans-serif';
    ctx.fillText('常压塔', pl + 4, pt + 9);
    ctx.fillText('减压塔', pl + 4, yd + 10);

    /* 剖面折线 */
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2f7d6b';
    ctx.beginPath();
    for (var i = 0; i < 6; i++) { var p = PROF.pts[i]; if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
    ctx.stroke();
    ctx.strokeStyle = '#41699b';
    ctx.beginPath();
    for (var j = 6; j < 10; j++) { var q = PROF.pts[j]; if (j > 6) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    ctx.stroke();
    ctx.lineWidth = 1;
    PROF.pts.forEach(function (p, i) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = i < 6 ? '#2f7d6b' : '#41699b'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
    });
    ctx.lineWidth = 1;

    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center'; ctx.font = '9px sans-serif';
    ctx.fillText('温度 (℃)', pl + pw / 2, H - 1);
  }

  /* ---------- 面板 3：TBP 切割与馏程重叠 ---------- */
  var CUTS = null;
  function drawCuts(m) {
    var cv = $('cv-cuts');
    var W = 470, H = 216;
    var ctx = setupCanvas(cv, W, H);
    var pl = 46, pr = 12, pt = 12, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var T0 = 0, T1 = 620;
    function X(t) { return pl + (t - T0) / (T1 - T0) * pw; }

    var rows = [
      { name: '石脑油（常顶）', a: 40, b: m.cutNK, yld: m.naph, col: '#41699b' },
      { name: '煤油（常一）', a: m.cutNK, b: m.cutKD, yld: m.kero, col: '#2f7d6b' },
      { name: '柴油（常二/三）', a: m.cutKD, b: m.cutAgo, yld: m.dsl, col: '#c9a15a' },
      { name: '蜡油 VGO', a: m.cutAgo, b: m.cutVgoEnd, yld: m.vgo, col: '#79828a' },
      { name: '减压渣油', a: m.cutVgoEnd, b: 600, yld: m.res, col: '#b05a51' }
    ];

    var n = rows.length, rowH = ph / n, barH = Math.min(18, rowH * 0.55);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 网格 */
    ctx.font = '9px Consolas, monospace';
    for (var t = 0; t <= 600; t += 100) {
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(X(t), pt); ctx.lineTo(X(t), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center'; ctx.fillText(t + '', X(t), H - 10);
    }
    /* 柴油 95% 上限 365℃ */
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(X(365), pt); ctx.lineTo(X(365), pt + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left'; ctx.font = '8.5px sans-serif';
    ctx.fillText('柴油 95% 上限 365℃', X(365) + 4, pt + 9);

    CUTS = { rows: [], W: W, H: H };
    ctx.font = '9px "PingFang SC", "Microsoft YaHei", sans-serif';
    rows.forEach(function (r, i) {
      var yc = pt + rowH * (i + 0.5);
      var y0 = yc - barH / 2;
      ctx.fillStyle = r.col; ctx.globalAlpha = 0.85;
      roundRect(ctx, X(r.a), y0, Math.max(X(r.b) - X(r.a), 2), barH, 3); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#3d464b'; ctx.textAlign = 'left';
      ctx.fillText(r.name + ' ' + r.yld.toFixed(1) + '%', X(r.a) + 4, y0 - 3);
      if (X(r.b) - X(r.a) > 58) {
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '8.5px Consolas, monospace';
        ctx.fillText(Math.round(r.a) + '–' + Math.round(r.b) + '℃', (X(r.a) + X(r.b)) / 2, yc + 3);
        ctx.font = '9px "PingFang SC", "Microsoft YaHei", sans-serif';
      }
      CUTS.rows.push({ y0: y0, y1: y0 + barH, r: r });
    });

    /* D86 刻度与重叠/间隙 */
    var yA = pt + rowH * 0.5, yB = pt + rowH * 1.5;
    function tick(x, y, col) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
      ctx.lineWidth = 1;
    }
    var xN95 = X(m.naph95), xK5 = X(m.kero5);
    tick(xN95, yA, '#41699b');
    tick(xK5, yB, '#2f7d6b');
    tick(X(m.dsl95), pt + rowH * 2.5, '#c9a15a');

    /* 重叠/间隙带：只画在两行之间的空隙，标签置于带左侧，避让馏分名 */
    var gx0 = Math.min(xN95, xK5), gx1 = Math.max(xN95, xK5);
    var bandY0 = yA + 10, bandY1 = yB - 10;
    var bandMid = (bandY0 + bandY1) / 2;
    ctx.font = '8.5px sans-serif';
    if (m.gap12 < 0) {
      ctx.fillStyle = 'rgba(176,90,81,0.15)';
      ctx.fillRect(gx0, bandY0, Math.max(gx1 - gx0, 2), bandY1 - bandY0);
      ctx.strokeStyle = '#b05a51'; ctx.setLineDash([3, 2]);
      ctx.strokeRect(gx0, bandY0, Math.max(gx1 - gx0, 2), bandY1 - bandY0); ctx.setLineDash([]);
      ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right';
      ctx.fillText('重叠 ' + (-m.gap12).toFixed(1) + '℃', gx0 - 6, bandMid + 3);
    } else {
      ctx.strokeStyle = '#2f7d6b'; ctx.setLineDash([3, 2]);
      ctx.strokeRect(gx0, bandY0, Math.max(gx1 - gx0, 2), bandY1 - bandY0); ctx.setLineDash([]);
      ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'right';
      ctx.fillText('间隙 ' + m.gap12.toFixed(1) + '℃', gx0 - 6, bandMid + 3);
    }

    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center'; ctx.font = '9px sans-serif';
    ctx.fillText('TBP 温度 (℃)', pl + pw / 2, H - 1);
  }

  /* ---------- 面板 4：指标卡 + 约束诊断 ---------- */
  function renderMetrics(m, g) {
    $('m-light').innerHTML = m.light.toFixed(1) + '<small> %</small>';
    $('m-total').innerHTML = m.totalPull.toFixed(1) + '<small> %</small>';
    $('m-vgo').innerHTML = m.vgoPull.toFixed(1) + '<small> %</small>';

    $('m-gap').innerHTML = m.gap12.toFixed(1) + '<small> ℃</small>';
    $('m-gap').parentNode.className = 'mcard' + (m.gap12 < -8 ? ' bad' : (m.gap12 < 0 ? ' warn' : ''));

    $('m-energy').innerHTML = m.energyIdx.toFixed(1) + '<small> (基线100)</small>';
    $('m-energy').parentNode.className = 'mcard' + (m.energyIdx > 112 ? ' bad' : (m.energyIdx > 105 ? ' warn' : ''));

    $('m-margin').innerHTML = fmtG(g) + '<small> 万元/天</small>';
    $('m-margin').parentNode.className = 'mcard' + (g > 5 ? ' blue' : (g < -5 ? ' warn' : ''));
  }

  function renderVerdict(viol, m, g) {
    var v = $('verdict');
    if (viol.length) {
      v.className = 'verdict bad';
      v.innerHTML = '<b>约束越限 ' + viol.length + ' 项</b>：' + viol.join('；') +
        '。该操作点不可行，RTO 不会下发——请回退滑块或点击「一键寻优」。';
      return;
    }
    if (g > 5) {
      v.className = 'verdict ok';
      v.innerHTML = '当前操作点在安全包络内且优于基线：轻油收率 <b>' + m.light.toFixed(1) + '%</b>、总拔 <b>' +
        m.totalPull.toFixed(1) + '%</b>、相对基线边际收益 <b>' + fmtG(g) + '</b> 万元/天，可作为 SP 建议下发 APC（限幅 ±3 ℃ / ±5%）。';
    } else if (g < -5) {
      v.className = 'verdict warn';
      v.innerHTML = '当前操作点可行但劣于基线（边际收益 <b>' + fmtG(g) + '</b> 万元/天）。建议点击「一键寻优」在安全包络内搜索更优 SP。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = '当前为基线操作点附近：轻油收率 <b>' + m.light.toFixed(1) + '%</b>、能耗指数 <b>' +
        m.energyIdx.toFixed(1) + '</b>。拖动滑块观察响应，或点击「一键寻优」查看 RTO 推荐方向。';
    }
  }

  /* ---------- 面板 5：可行域散点 ---------- */
  var REG = null;
  function drawRegion() {
    var cv = $('cv-region');
    var W = 470, H = 240;
    var ctx = setupCanvas(cv, W, H);
    var pl = 44, pr = 12, pt = 16, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var X0 = 340, X1 = 372, Y0 = 1.8, Y1 = 6.8;
    var NX = 56, NY = 40;
    var cw = pw / NX, ch = ph / NY;
    var tvfs = [390, 398, 406], rflx = [0.25, 0.35, 0.45], stms = [1.0, 1.4, 1.9];

    var mg = new Array(NX * NY), feas = new Array(NX * NY);
    var mn = Infinity, mx = -Infinity;
    var iy, ix, a, b, c;
    for (iy = 0; iy < NY; iy++) {
      var pv = Y0 + (iy + 0.5) / NY * (Y1 - Y0);
      for (ix = 0; ix < NX; ix++) {
        var tf = X0 + (ix + 0.5) / NX * (X1 - X0);
        var best = -Infinity, okAny = false;
        for (a = 0; a < tvfs.length; a++) for (b = 0; b < rflx.length; b++) for (c = 0; c < stms.length; c++) {
          var st = { tf: tf, tvf: tvfs[a], ptop: S.ptop, pvac: pv, steam: stms[c], reflux: rflx[b], ovap: S.ovap };
          var mm = calc(st);
          if (violations(st, mm).length) continue;
          var gg = margin(st, mm);
          if (gg > best) { best = gg; okAny = true; }
        }
        var idx = iy * NX + ix;
        feas[idx] = okAny; mg[idx] = okAny ? best : 0;
        if (okAny) { if (best < mn) mn = best; if (best > mx) mx = best; }
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);
    for (iy = 0; iy < NY; iy++) {
      for (ix = 0; ix < NX; ix++) {
        var id2 = iy * NX + ix;
        var px = pl + ix * cw, py = pt + iy * ch;
        if (!feas[id2]) { ctx.fillStyle = '#eae6da'; ctx.fillRect(px, py, cw + 0.5, ch + 0.5); continue; }
        var rr = mx > mn ? (mg[id2] - mn) / (mx - mn) : 0.5;
        ctx.fillStyle = mixColor([47, 125, 107], [201, 161, 90], rr);
        ctx.fillRect(px, py, cw + 0.5, ch + 0.5);
      }
    }

    /* 坐标轴 */
    ctx.strokeStyle = '#cfc7b6'; ctx.lineWidth = 1; ctx.strokeRect(pl, pt, pw, ph);
    ctx.font = '9px Consolas, monospace'; ctx.fillStyle = '#9ba3a9';
    [340, 348, 356, 364, 372].forEach(function (t) {
      var x = pl + (t - X0) / (X1 - X0) * pw;
      ctx.textAlign = 'center'; ctx.fillText(t + '', x, H - 14);
    });
    [2, 3, 4, 5, 6].forEach(function (p) {
      var y = pt + (p - Y0) / (Y1 - Y0) * ph;
      ctx.textAlign = 'right'; ctx.fillText(p.toFixed(0) + '', pl - 5, y + 3);
    });
    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('常压炉出口温度 (℃)', pl + pw / 2, H - 3);
    ctx.save(); ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('减压塔顶压力 (kPa(a))', 0, 0); ctx.restore();

    ctx.fillStyle = '#79828a'; ctx.textAlign = 'left'; ctx.font = '8.5px sans-serif';
    ctx.fillText('绿 → 金：边际收益升高 · 灰：越限不可行（其余变量已网格最大化）', pl, pt - 4);

    /* 当前操作点 */
    var cx0 = pl + (S.tf - X0) / (X1 - X0) * pw, cy0 = pt + (S.pvac - Y0) / (Y1 - Y0) * ph;
    ctx.beginPath(); ctx.arc(cx0, cy0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a15a'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.lineWidth = 1;
    var nearRight = cx0 > pl + pw - 52;
    ctx.fillStyle = '#9a7a1c'; ctx.font = '9px sans-serif';
    ctx.textAlign = nearRight ? 'right' : 'left';
    ctx.fillText('当前', cx0 + (nearRight ? -8 : 8), cy0 - 6);

    /* 寻优推荐点 */
    if (OPT) {
      var ox = pl + (OPT.tf - X0) / (X1 - X0) * pw, oy = pt + (OPT.pvac - Y0) / (Y1 - Y0) * ph;
      star(ctx, ox, oy, 6.5, '#b05a51');
      var oRight = ox > pl + pw - 60;
      ctx.fillStyle = '#b05a51'; ctx.textAlign = oRight ? 'right' : 'left';
      ctx.fillText('寻优 SP', ox + (oRight ? -10 : 10), oy + 4);
    }

    REG = { feas: feas, mg: mg, nx: NX, ny: NY, pl: pl, pt: pt, pw: pw, ph: ph, x0: X0, x1: X1, y0: Y0, y1: Y1, W: W, H: H };
  }

  /* ---------- 一键寻优（SQP 思路的网格搜索） ---------- */
  function optimize() {
    var tfs = [], tvfs = [], pvacs = [], rflx = [], stms = [];
    var a;
    for (a = 348; a <= 370; a += 2) tfs.push(a);
    for (a = 390; a <= 412; a += 4) tvfs.push(a);
    for (a = 22; a <= 50; a += 4) pvacs.push(a / 10);
    for (a = 25; a <= 50; a += 5) rflx.push(a / 100);
    for (a = 10; a <= 22; a += 3) stms.push(a / 10);
    var best = null, bestM = null, bestG = -Infinity;
    tfs.forEach(function (tf) {
      tvfs.forEach(function (tvf) {
        pvacs.forEach(function (pv) {
          rflx.forEach(function (rf) {
            stms.forEach(function (sm) {
              var st = { tf: tf, tvf: tvf, ptop: S.ptop, pvac: pv, steam: sm, reflux: rf, ovap: S.ovap };
              var m = calc(st);
              if (violations(st, m).length) return;
              var g = margin(st, m);
              if (g > bestG) { bestG = g; best = st; bestM = m; }
            });
          });
        });
      });
    });
    return best ? { s: best, m: bestM, g: bestG } : null;
  }

  function renderCompare() {
    var body = $('cmp-body');
    if (!CMP || !CMP.after) {
      body.innerHTML = '<tr><td colspan="4" class="muted">点击「一键寻优」后在此显示优化前后对比</td></tr>';
      return;
    }
    var s0 = CMP.before.s, m0 = CMP.before.m, s1 = CMP.after.s, m1 = CMP.after.m;
    var rows = [
      { n: '常压炉出口温度', a: s0.tf.toFixed(0) + ' ℃', b: s1.tf.toFixed(0) + ' ℃', d: s1.tf - s0.tf, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(0) + ' ℃'; }, dir: 0 },
      { n: '减压炉出口温度', a: s0.tvf.toFixed(0) + ' ℃', b: s1.tvf.toFixed(0) + ' ℃', d: s1.tvf - s0.tvf, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(0) + ' ℃'; }, dir: 0 },
      { n: '减压塔顶压力', a: s0.pvac.toFixed(1) + ' kPa(a)', b: s1.pvac.toFixed(1) + ' kPa(a)', d: s1.pvac - s0.pvac, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + ' kPa'; }, dir: 0 },
      { n: '汽提蒸汽', a: s0.steam.toFixed(2) + ' %', b: s1.steam.toFixed(2) + ' %', d: s1.steam - s0.steam, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(2); }, dir: 0 },
      { n: '中段回流取热比', a: s0.reflux.toFixed(2), b: s1.reflux.toFixed(2), d: s1.reflux - s0.reflux, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(2); }, dir: 0 },
      { n: '轻油收率', a: m0.light.toFixed(2) + ' %', b: m1.light.toFixed(2) + ' %', d: m1.light - m0.light, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(2) + ' pp'; }, dir: 1 },
      { n: '总拔（轻油+VGO）', a: m0.totalPull.toFixed(2) + ' %', b: m1.totalPull.toFixed(2) + ' %', d: m1.totalPull - m0.totalPull, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(2) + ' pp'; }, dir: 1 },
      { n: '减压拔出率', a: m0.vgoPull.toFixed(1) + ' %', b: m1.vgoPull.toFixed(1) + ' %', d: m1.vgoPull - m0.vgoPull, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + ' pp'; }, dir: 1 },
      { n: '常一/常二间隙', a: m0.gap12.toFixed(1) + ' ℃', b: m1.gap12.toFixed(1) + ' ℃', d: m1.gap12 - m0.gap12, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + ' ℃'; }, dir: 1 },
      { n: '加热炉能耗指数', a: m0.energyIdx.toFixed(1), b: m1.energyIdx.toFixed(1), d: m1.energyIdx - m0.energyIdx, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1); }, dir: -1 },
      { n: '边际收益', a: fmtG(CMP.before.g) + ' 万元/天', b: fmtG(CMP.after.g) + ' 万元/天', d: CMP.after.g - CMP.before.g, df: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + ' 万元/天'; }, dir: 1 }
    ];
    var html = '';
    rows.forEach(function (r) {
      var cls = '', dtxt = '—';
      if (Math.abs(r.d) > 1e-9) {
        dtxt = r.df(r.d);
        if (r.dir !== 0) {
          var good = (r.dir > 0 && r.d > 0) || (r.dir < 0 && r.d < 0);
          cls = good ? 'up' : 'down';
        }
      }
      html += '<tr><td>' + r.n + '</td><td class="num">' + r.a + '</td><td class="num">' + r.b +
        '</td><td class="num ' + cls + '">' + dtxt + '</td></tr>';
    });
    body.innerHTML = html;
  }

  /* ---------- 渲染总控 ---------- */
  function renderAll() {
    var m = calc(S);
    var viol = violations(S, m);
    var g = margin(S, m);
    drawFlow(m);
    drawProfile(S);
    drawCuts(m);
    renderMetrics(m, g);
    renderVerdict(viol, m, g);
    drawRegion();
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    tf: function (v) { return v.toFixed(0) + ' ℃'; },
    tvf: function (v) { return v.toFixed(0) + ' ℃'; },
    ptop: function (v) { return v.toFixed(3) + ' MPa(g)'; },
    pvac: function (v) { return v.toFixed(1) + ' kPa(a)'; },
    steam: function (v) { return v.toFixed(2) + ' %'; },
    reflux: function (v) { return v.toFixed(2); },
    ovap: function (v) { return v.toFixed(1) + ' %'; }
  };
  var KEYS = ['tf', 'tvf', 'ptop', 'pvac', 'steam', 'reflux', 'ovap'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        renderAll();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF); OPT = null; CMP = null;
      syncSliders(); renderAll(); renderCompare();
    });
    $('btn-reset2').addEventListener('click', function () {
      S = Object.assign({}, DEF); OPT = null; CMP = null;
      syncSliders(); renderAll(); renderCompare();
    });
    $('btn-opt').addEventListener('click', function () {
      var mCur = calc(S);
      CMP = { before: { s: Object.assign({}, S), m: mCur, g: margin(S, mCur) }, after: null };
      var r = optimize();
      if (r) {
        S = Object.assign({}, r.s);
        OPT = { tf: r.s.tf, pvac: r.s.pvac };
        CMP.after = { s: r.s, m: r.m, g: r.g };
        syncSliders();
      }
      renderAll(); renderCompare();
    });
  }

  /* ---------- hover tooltip ---------- */
  function placeTip(tip, box, evt, html) {
    var rb = box.getBoundingClientRect();
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = clamp(evt.clientX - rb.left + 12, 4, Math.max(rb.width - 200, 4)) + 'px';
    tip.style.top = clamp(evt.clientY - rb.top - 10, 4, Math.max(rb.height - 60, 4)) + 'px';
  }

  function bindTips() {
    /* 温度剖面 */
    var cvP = $('cv-profile'), boxP = $('box-profile'), tipP = $('tip-profile');
    cvP.addEventListener('mousemove', function (evt) {
      if (!PROF) { tipP.style.display = 'none'; return; }
      var r = cvP.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (PROF.W / r.width);
      var ly = (evt.clientY - r.top) * (PROF.H / r.height);
      var bi = -1, bd = 1e9;
      PROF.pts.forEach(function (p, i) {
        var d = Math.hypot(p.x - lx, p.y - ly);
        if (d < bd) { bd = d; bi = i; }
      });
      if (bi >= 0 && bd < 22) {
        var p = PROF.pts[bi];
        placeTip(tipP, boxP, evt, '<b>' + p.tower + ' · ' + p.label + '</b><br>温度 ≈ <b>' + p.t.toFixed(0) + ' ℃</b>');
      } else tipP.style.display = 'none';
    });
    cvP.addEventListener('mouseleave', function () { tipP.style.display = 'none'; });

    /* TBP 切割 */
    var cvC = $('cv-cuts'), boxC = $('box-cuts'), tipC = $('tip-cuts');
    cvC.addEventListener('mousemove', function (evt) {
      if (!CUTS) { tipC.style.display = 'none'; return; }
      var r = cvC.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (CUTS.W / r.width);
      var ly = (evt.clientY - r.top) * (CUTS.H / r.height);
      var hit = null;
      CUTS.rows.forEach(function (row) {
        if (ly >= row.y0 - 12 && ly <= row.y1 + 4) hit = row.r;
      });
      if (hit) {
        placeTip(tipC, boxC, evt, '<b>' + hit.name + '</b><br>TBP 区间 <b>' + Math.round(hit.a) + '–' + Math.round(hit.b) + ' ℃</b><br>收率 <b>' + hit.yld.toFixed(1) + '%</b>（对原油）');
      } else tipC.style.display = 'none';
    });
    cvC.addEventListener('mouseleave', function () { tipC.style.display = 'none'; });

    /* 可行域 */
    var cvR = $('cv-region'), boxR = $('box-region'), tipR = $('tip-region');
    cvR.addEventListener('mousemove', function (evt) {
      if (!REG) { tipR.style.display = 'none'; return; }
      var r = cvR.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (REG.W / r.width);
      var ly = (evt.clientY - r.top) * (REG.H / r.height);
      var ix = Math.floor((lx - REG.pl) / REG.pw * REG.nx);
      var iy = Math.floor((ly - REG.pt) / REG.ph * REG.ny);
      if (ix < 0 || ix >= REG.nx || iy < 0 || iy >= REG.ny) { tipR.style.display = 'none'; return; }
      var tf = REG.x0 + (ix + 0.5) / REG.nx * (REG.x1 - REG.x0);
      var pv = REG.y0 + (iy + 0.5) / REG.ny * (REG.y1 - REG.y0);
      var idx = iy * REG.nx + ix;
      var html = '常压炉出口 <b>' + tf.toFixed(1) + ' ℃</b><br>减压塔顶 <b>' + pv.toFixed(2) + ' kPa(a)</b><br>';
      html += REG.feas[idx] ? ('最优边际收益 <b>' + fmtG(REG.mg[idx]) + ' 万元/天</b>') : '<span style="color:#b05a51">不可行（越限）</span>';
      placeTip(tipR, boxR, evt, html);
    });
    cvR.addEventListener('mouseleave', function () { tipR.style.display = 'none'; });
  }

  /* ---------- 页签 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
        if (id === 'sim') renderAll();
      });
    });
    if (location.hash === '#src') {
      var srcTab = document.querySelector('.tab[data-tab="src"]');
      if (srcTab) srcTab.click();
    }
  }

  /* 尺寸变化时重建 canvas backing store */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      if ($('pane-sim').classList.contains('active')) renderAll();
    }, 120);
  });

  bind();
  bindTabs();
  bindTips();
  syncSliders();
  renderAll();
  renderCompare();
})();
