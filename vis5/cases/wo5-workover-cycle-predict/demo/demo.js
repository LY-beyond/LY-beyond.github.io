/* ======= 修井周期智能预测 · 可运行示范（免修期可靠性 + 检泵周期优化） ======= */
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

  /* Lanczos 近似 Γ(z)，z > 0 */
  var LG_COEF = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    var x = LG_COEF[0];
    for (var i = 1; i < 9; i++) x += LG_COEF[i] / (z + i);
    var t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  var DEF = {
    sand: 30, water: 70, depth: 2200, spm: 6, corr: 30,
    sandctrl: 0, waxctrl: 0, costwo: 9, loss: 6
  };
  var S = Object.assign({}, DEF);

  /* ---------- 影响因素 → Weibull β / η ---------- */
  function factors(p) {
    var sandF = clamp(p.sand / 100, 0, 1);
    var waterF = clamp((p.water - 40) / 58, 0, 1);
    var depthF = clamp((p.depth - 1500) / 2100, 0, 1);
    var spmF = clamp((p.spm - 2) / 8, 0, 1);
    var corrF = clamp(p.corr / 100, 0, 1);
    var H = 0.28 * sandF + 0.16 * waterF + 0.16 * depthF + 0.12 * spmF + 0.28 * corrF;
    var M = 0.55 * p.sandctrl * clamp(1.4 * sandF, 0, 1)
          + 0.45 * p.waxctrl * clamp(0.7 * (waterF + corrF), 0, 1);
    return { H: H, M: M };
  }
  function betaOf(p) { var f = factors(p); return clamp(2.3 - 1.6 * f.H + 0.4 * f.M, 0.7, 2.8); }
  function etaOf(p) { var f = factors(p); return clamp(620 * (1 - 0.58 * f.H) * (1 + 0.42 * f.M), 120, 1100); }
  function mbfOf(p) { var b = betaOf(p), e = etaOf(p); return e * gamma(1 + 1 / b); }

  function curBeta() { return betaOf(S); }
  function curEta() { return etaOf(S); }
  function curMBF() { return mbfOf(S); }
  function Rof(t) { return Math.exp(-Math.pow(t / curEta(), curBeta())); }
  function Fof(t) { return 1 - Rof(t); }
  function hof(t) { /* 每天失效率 */
    var b = curBeta(), e = curEta();
    return (b / e) * Math.pow(Math.max(t, 0.5) / e, b - 1);
  }

  /* ---------- 经济检泵周期 ---------- */
  function econCalc() {
    var f = factors(S);
    var Cp = S.costwo + 2 * S.loss;                    /* 计划检泵：作业费 + 停井 2 天损失 */
    var Cf = 1.8 * S.costwo + (6 + 8 * f.H) * S.loss;  /* 故障后更换：抢修加价 + 非计划停井更长 */
    var mbf = curMBF();
    var Cfail = Cf / mbf;                              /* 纯故障检修的成本率 万元/天 */
    var TMAX = 1500, dt = 2;
    var cum = [0], rPrev = Rof(0), pts = [];
    var integ = 0;
    for (var t = dt; t <= TMAX; t += dt) {
      var r = Rof(t);
      integ += (rPrev + r) / 2 * dt;
      rPrev = r;
      cum.push(integ);
      pts.push({ T: t, C: (Cp * r + Cf * (1 - r)) / integ });
    }
    var opt = null;
    if (curBeta() > 1.02) {
      var best = 1e9;
      pts.forEach(function (p) {
        if (p.T >= 20 && p.C < best) { best = p.C; opt = p; }
      });
      /* 边界检查：最小值在末端说明不应预防性更换 */
      if (opt && opt.T >= TMAX - dt) opt = null;
    }
    return { Cp: Cp, Cf: Cf, Cfail: Cfail, pts: pts, opt: opt, mbf: mbf };
  }

  /* ---------- 面板 1：生存曲线 R(t) / F(t) ---------- */
  var SURV = { pl: 42, pr: 14, pt: 16, pb: 30, W: 460, H: 235, tMax: 1000 };
  function drawSurv() {
    var cv = $('cv-surv'), ctx = setupCanvas(cv, SURV.W, SURV.H);
    var pl = SURV.pl, pr = SURV.pr, pt = SURV.pt, pb = SURV.pb;
    var pw = SURV.W - pl - pr, ph = SURV.H - pt - pb;
    var mbf = curMBF();
    SURV.tMax = clamp(Math.ceil(2.4 * mbf / 100) * 100, 400, 2400);
    var tMax = SURV.tMax;
    var x = function (t) { return pl + t / tMax * pw; };
    var y = function (v) { return pt + ph - v * ph; };

    ctx.clearRect(0, 0, SURV.W, SURV.H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, SURV.W, SURV.H);

    /* 网格 */
    ctx.font = '9px Consolas, monospace';
    var v;
    for (v = 0; v <= 1.001; v += 0.2) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(1), pl - 5, y(v) + 3);
    }
    var tInt = tMax / 5;
    for (var t = 0; t <= tMax + 1; t += tInt) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x(t), pt); ctx.lineTo(x(t), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(t) + '', x(t), pt + ph + 12);
    }

    /* 50% 参考线 */
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(pl, y(0.5)); ctx.lineTo(pl + pw, y(0.5)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#c9a15a'; ctx.textAlign = 'left';
    ctx.fillText('R=0.5（中位寿命）', pl + 4, y(0.5) - 4);

    /* R(t) 曲线 */
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f7d6b';
    ctx.beginPath();
    for (var i = 0; i <= 200; i++) {
      var tt = i / 200 * tMax;
      var px = x(tt), py = y(Rof(tt));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    /* F(t) 曲线 */
    ctx.lineWidth = 2; ctx.strokeStyle = '#b05a51';
    ctx.beginPath();
    for (i = 0; i <= 200; i++) {
      tt = i / 200 * tMax;
      px = x(tt); py = y(Fof(tt));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* MTBF 竖虚线 + 标注点 */
    var mx = x(mbf), my = y(Rof(mbf));
    ctx.strokeStyle = '#79828a'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(mx, pt); ctx.lineTo(mx, pt + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#2f7d6b';
    ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#235f51'; ctx.font = 'bold 9.5px Consolas, monospace';
    var nearRight = mx > pl + pw - 110;
    ctx.textAlign = nearRight ? 'right' : 'left';
    ctx.fillText('预期免修期 ' + Math.round(mbf) + ' 天', nearRight ? mx - 8 : mx + 8, my - 8);

    /* 轴标签 */
    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('投产后天数 t（天）', pl + pw / 2, SURV.H - 4);
    ctx.save();
    ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('概率（0–1）', 0, 0);
    ctx.restore();
    /* 曲线名注 */
    ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#2f7d6b'; ctx.fillText('R(t)', x(tMax * 0.92), y(Rof(tMax * 0.92)) - 6);
    ctx.fillStyle = '#b05a51'; ctx.fillText('F(t)', x(tMax * 0.92), y(Fof(tMax * 0.92)) + 12);
  }

  /* ---------- 面板 2a：失效率 h(t) ---------- */
  var HAZ = { pl: 44, pr: 14, pt: 16, pb: 30, W: 460, H: 215, tMax: 1000 };
  function drawHaz() {
    var cv = $('cv-haz'), ctx = setupCanvas(cv, HAZ.W, HAZ.H);
    var pl = HAZ.pl, pr = HAZ.pr, pt = HAZ.pt, pb = HAZ.pb;
    var pw = HAZ.W - pl - pr, ph = HAZ.H - pt - pb;
    var b = curBeta();
    HAZ.tMax = SURV.tMax;
    var tMax = HAZ.tMax;
    var hMax = (b >= 1 ? hof(tMax) : hof(5)) * 1.18;
    hMax = Math.max(hMax, hof(curMBF()) * 1.3);
    var x = function (t) { return pl + t / tMax * pw; };
    var y = function (v) { return pt + ph - v / hMax * ph; };

    ctx.clearRect(0, 0, HAZ.W, HAZ.H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, HAZ.W, HAZ.H);

    ctx.font = '9px Consolas, monospace';
    var step = hMax / 4;
    for (var k = 0; k <= 4; k++) {
      var v = k * step;
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(3), pl - 4, y(v) + 3);
    }
    var tInt = tMax / 5;
    for (var t = 0; t <= tMax + 1; t += tInt) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x(t), pt); ctx.lineTo(x(t), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(t) + '', x(t), pt + ph + 12);
    }

    /* h(t) 曲线 */
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#c9a15a';
    ctx.beginPath();
    for (var i = 0; i <= 220; i++) {
      var tt = 1 + i / 220 * (tMax - 1);
      var px = x(tt), py = y(Math.min(hof(tt), hMax));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* β 判读注记 */
    var msg, color;
    if (b < 0.95) { msg = 'β=' + b.toFixed(2) + ' < 1：早期失效主导，失效率递减 → 应排查投产质量，不宜定期预防性检泵'; color = '#b05a51'; }
    else if (b <= 1.15) { msg = 'β=' + b.toFixed(2) + ' ≈ 1：近似随机失效，失效率近恒定 → 预防性更换无收益'; color = '#79828a'; }
    else { msg = 'β=' + b.toFixed(2) + ' > 1：耗损失效主导，失效率递增 → 存在最优预防性检泵周期'; color = '#2f7d6b'; }
    ctx.fillStyle = color; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'left';
    wrapText(ctx, msg, pl + 4, pt + 12, pw - 8, 12);

    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('投产后天数 t（天）', pl + pw / 2, HAZ.H - 4);
    ctx.save();
    ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('失效率 h(t) ×100 天', 0, 0);
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    var line = '', yy = y;
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy); line = text[i]; yy += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  /* ---------- 面板 2b：经济检泵周期 ---------- */
  var ECON = { pl: 44, pr: 14, pt: 16, pb: 30, W: 460, H: 215 };
  var ECON_CACHE = null;
  function drawEcon() {
    var cv = $('cv-econ'), ctx = setupCanvas(cv, ECON.W, ECON.H);
    var pl = ECON.pl, pr = ECON.pr, pt = ECON.pt, pb = ECON.pb;
    var pw = ECON.W - pl - pr, ph = ECON.H - pt - pb;
    var ec = ECON_CACHE = econCalc();
    var cMax = 0;
    ec.pts.forEach(function (p) { if (p.T <= 1200 && p.C > cMax) cMax = p.C; });
    cMax = Math.max(cMax, ec.Cfail) * 1.05;
    /* 压缩纵轴：聚焦最优点附近 */
    var cHi = Math.min(cMax, (ec.opt ? ec.opt.C : ec.Cfail) * 2.6);
    var TMAXV = 1200;
    var x = function (t) { return pl + t / TMAXV * pw; };
    var y = function (v) { return pt + ph - clamp(v, 0, cHi) / cHi * ph; };

    ctx.clearRect(0, 0, ECON.W, ECON.H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, ECON.W, ECON.H);

    ctx.font = '9px Consolas, monospace';
    for (var k = 0; k <= 4; k++) {
      var v = k * cHi / 4;
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(3), pl - 4, y(v) + 3);
    }
    for (var t = 0; t <= TMAXV; t += 200) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x(t), pt); ctx.lineTo(x(t), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(t + '', x(t), pt + ph + 12);
    }

    /* 纯故障检修成本率参考线 */
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, y(ec.Cfail)); ctx.lineTo(pl + pw, y(ec.Cfail)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('纯故障检修 ' + ec.Cfail.toFixed(3) + ' 万/天', pl + 5, y(ec.Cfail) - 4);

    /* C(T) 曲线 */
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#41699b';
    ctx.beginPath();
    var started = false;
    ec.pts.forEach(function (p) {
      if (p.T > TMAXV) return;
      var px = x(p.T), py = y(p.C);
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    });
    ctx.stroke();

    /* 最优点 */
    if (ec.opt) {
      var ox = x(ec.opt.T), oy = y(ec.opt.C);
      ctx.fillStyle = '#2f7d6b';
      ctx.beginPath(); ctx.arc(ox, oy, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(ox, oy, 4.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#235f51'; ctx.font = 'bold 9.5px Consolas, monospace';
      var nearRight = ox > pl + pw - 150;
      ctx.textAlign = nearRight ? 'right' : 'left';
      ctx.fillText('T*=' + Math.round(ec.opt.T) + ' 天 · ' + ec.opt.C.toFixed(3) + ' 万/天', nearRight ? ox - 8 : ox + 8, oy - 8);
    } else {
      ctx.fillStyle = '#b05a51'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('β≤1：失效率不递增，预防性检泵不经济，建议按故障检修', pl + 6, pt + 12);
    }

    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('计划检泵周期 T（天）', pl + pw / 2, ECON.H - 4);
    ctx.save();
    ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('单位时间成本（万元/天）', 0, 0);
    ctx.restore();
  }

  /* ---------- 面板 3：分组对比 ---------- */
  var GROUPS = [
    { name: '出砂井组', ctrl: 'sandctrl', p: { sand: 85, water: 55, depth: 2200, spm: 5, corr: 35 }, note: '防砂泵/防砂管柱' },
    { name: '高含水井组', ctrl: 'waxctrl', p: { sand: 25, water: 95, depth: 2000, spm: 5, corr: 45 }, note: '防垢+缓蚀加药' },
    { name: '深井组', ctrl: 'waxctrl', p: { sand: 30, water: 70, depth: 3300, spm: 7, corr: 30 }, note: '防蜡+杆柱优化' },
    { name: '腐蚀井组', ctrl: 'waxctrl', p: { sand: 20, water: 75, depth: 2100, spm: 5, corr: 90 }, note: '缓蚀剂+涂层油管' }
  ];
  var GRP = { pl: 42, pr: 14, pt: 14, pb: 40, W: 460, H: 225 };
  function groupMbf(g, ctrlOn) {
    var p = { sand: g.p.sand, water: g.p.water, depth: g.p.depth, spm: g.p.spm, corr: g.p.corr, sandctrl: 0, waxctrl: 0 };
    if (ctrlOn) p[g.ctrl] = 1;
    return mbfOf(p);
  }
  function drawGroup() {
    var cv = $('cv-group'), ctx = setupCanvas(cv, GRP.W, GRP.H);
    var pl = GRP.pl, pr = GRP.pr, pt = GRP.pt, pb = GRP.pb;
    var pw = GRP.W - pl - pr, ph = GRP.H - pt - pb;
    var data = GROUPS.map(function (g) {
      return { g: g, before: groupMbf(g, false), after: groupMbf(g, true) };
    });
    var vMax = 0;
    data.forEach(function (d) { vMax = Math.max(vMax, d.after); });
    vMax = Math.ceil(vMax * 1.15 / 100) * 100;
    var y = function (v) { return pt + ph - v / vMax * ph; };

    ctx.clearRect(0, 0, GRP.W, GRP.H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, GRP.W, GRP.H);

    ctx.font = '9px Consolas, monospace';
    var step = vMax / 4;
    for (var k = 0; k <= 4; k++) {
      var v = k * step;
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(v) + '', pl - 4, y(v) + 3);
    }

    var slot = pw / data.length;
    var bw = Math.min(34, slot * 0.26);
    data.forEach(function (d, i) {
      var cx = pl + slot * (i + 0.5);
      var x1 = cx - bw - 2, x2 = cx + 2;
      /* 措施前 */
      ctx.fillStyle = '#b05a51'; ctx.globalAlpha = 0.82;
      roundRect(ctx, x1, y(d.before), bw, pt + ph - y(d.before), 3); ctx.fill();
      /* 措施后 */
      ctx.fillStyle = '#2f7d6b'; ctx.globalAlpha = 0.9;
      roundRect(ctx, x2, y(d.after), bw, pt + ph - y(d.after), 3); ctx.fill();
      ctx.globalAlpha = 1;
      /* 数值 */
      ctx.font = '8.5px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#b05a51'; ctx.fillText(Math.round(d.before) + '', x1 + bw / 2, y(d.before) - 4);
      ctx.fillStyle = '#235f51'; ctx.fillText(Math.round(d.after) + '', x2 + bw / 2, y(d.after) - 4);
      /* 增幅 */
      var gain = (d.after / d.before - 1) * 100;
      ctx.fillStyle = '#79828a'; ctx.font = '8.5px sans-serif';
      ctx.fillText('+' + gain.toFixed(0) + '%', cx, pt + 2);
      /* 组名 */
      ctx.fillStyle = '#5d666d'; ctx.font = '9.5px sans-serif';
      ctx.fillText(d.g.name, cx, pt + ph + 13);
      ctx.fillStyle = '#9ba3a9'; ctx.font = '8.5px sans-serif';
      ctx.fillText(d.g.note, cx, pt + ph + 24);
    });

    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif';
    ctx.save();
    ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('预期免修期 MTBF（天）', 0, 0);
    ctx.restore();
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

  /* ---------- 指标卡 + 结论 ---------- */
  function renderMetrics(ec) {
    var b = curBeta(), mbf = curMBF(), r90 = Rof(90);
    $('m-mbf').innerHTML = Math.round(mbf) + '<small> 天</small>';
    $('m-mbf').parentNode.className = 'mcard' + (mbf < 300 ? ' bad' : (mbf < 450 ? ' warn' : ''));

    $('m-r90').innerHTML = (r90 * 100).toFixed(1) + '<small> %</small>';
    $('m-r90').parentNode.className = 'mcard' + (r90 < 0.7 ? ' bad' : (r90 < 0.85 ? ' warn' : ''));

    if (ec.opt) {
      $('m-topt').innerHTML = Math.round(ec.opt.T) + '<small> 天</small>';
      $('m-topt').parentNode.className = 'mcard';
    } else {
      $('m-topt').innerHTML = '不建议';
      $('m-topt').parentNode.className = 'mcard warn';
    }

    var save = ec.opt ? (ec.Cfail - ec.opt.C) * 365 : 0;
    $('m-save').innerHTML = save > 0.05 ? save.toFixed(1) + '<small> 万/井·年</small>' : '—';
    $('m-save').parentNode.className = 'mcard' + (save > 3 ? '' : (save > 0.05 ? ' warn' : 'bad'));

    var v = $('verdict');
    var regime = b < 0.95 ? '早期失效主导（β&lt;1），应排查投产与作业质量'
      : (b <= 1.15 ? '近似随机失效（β≈1），定期更换无收益'
      : '耗损失效主导（β&gt;1），适合按周期预防性检泵');
    if (!ec.opt) {
      v.className = 'verdict warn';
      v.innerHTML = '当前工况 β=<b>' + b.toFixed(2) + '</b>，' + regime + '；预期免修期 <b>' + Math.round(mbf) +
        '</b> 天。纯故障检修成本率 <b>' + ec.Cfail.toFixed(3) + '</b> 万元/天，预防性检泵不经济。' +
        (S.sandctrl + S.waxctrl === 0 ? ' 实施防砂/防蜡防腐工艺可使 β 右移、转为耗损型后再评估周期优化。' : '');
      return;
    }
    var saveTxt = save > 0.05 ? '，较纯故障检修年节约 <b>' + save.toFixed(1) + '</b> 万元/井' : '';
    if (b >= 1.5 && r90 >= 0.85) {
      v.className = 'verdict ok';
    } else if (r90 < 0.7) {
      v.className = 'verdict bad';
    } else {
      v.className = 'verdict warn';
    }
    v.innerHTML = 'β=<b>' + b.toFixed(2) + '</b>，' + regime + '；预期免修期 <b>' + Math.round(mbf) +
      '</b> 天，90 天可靠度 <b>' + (r90 * 100).toFixed(1) + '%</b>。建议按 <b>T*=' + Math.round(ec.opt.T) +
      '</b> 天安排计划检泵（单位时间成本 <b>' + ec.opt.C.toFixed(3) + '</b> 万元/天）' + saveTxt + '。';
  }

  function render() {
    drawSurv();
    drawHaz();
    drawEcon();
    drawGroup();
    renderMetrics(ECON_CACHE);
  }

  /* ---------- 悬停 tooltip ---------- */
  function logicalXY(cv, evt) {
    var r = cv.getBoundingClientRect();
    var lw = +cv.getAttribute('data-lw');
    return { x: (evt.clientX - r.left) / r.width * lw, rect: r };
  }
  function showTip(tip, box, evt, html) {
    var rb = box.getBoundingClientRect();
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
    tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 64) + 'px';
  }
  function bindLineTip(cvId, tipId, boxId, geom, valFn) {
    var cv = $(cvId), tip = $(tipId), box = $(boxId);
    cv.setAttribute('data-lw', geom.W);
    cv.addEventListener('mousemove', function (evt) {
      var p = logicalXY(cv, evt);
      var pl = geom.pl, pr = geom.pr, pt = geom.pt, pb = geom.pb;
      var pw = geom.W - pl - pr, ph = geom.H - pt - pb;
      if (p.x < pl || p.x > pl + pw || evt.clientY - p.rect.top < pt / geom.H * p.rect.height * (geom.H / geom.H) - 1000) { tip.style.display = 'none'; return; }
      var t = (p.x - pl) / pw * geom.tMax;
      var html = valFn(t);
      if (!html) { tip.style.display = 'none'; return; }
      showTip(tip, box, evt, html);
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }
  function bindTips() {
    bindLineTip('cv-surv', 'tip-surv', 'box-surv', SURV, function (t) {
      if (t < 0 || t > SURV.tMax) return null;
      return '<b>t = ' + Math.round(t) + ' 天</b><br>可靠度 R(t) = <b>' + Rof(t).toFixed(3) + '</b>' +
        '<br>累积失效 F(t) = <b>' + Fof(t).toFixed(3) + '</b>' +
        '<br>失效率 h(t) = <b>' + (hof(t) * 100).toFixed(3) + '</b> /100天';
    });
    bindLineTip('cv-haz', 'tip-haz', 'box-haz', HAZ, function (t) {
      if (t < 0 || t > HAZ.tMax) return null;
      return '<b>t = ' + Math.round(t) + ' 天</b><br>失效率 h(t) = <b>' + (hof(Math.max(t, 1)) * 100).toFixed(3) + '</b> /100天' +
        '<br>β = <b>' + curBeta().toFixed(2) + '</b>（' + (curBeta() > 1.15 ? '递增·耗损型' : (curBeta() < 0.95 ? '递减·早期型' : '近恒定·随机型')) + '）';
    });
    bindLineTip('cv-econ', 'tip-econ', 'box-econ', { W: ECON.W, pl: ECON.pl, pr: ECON.pr, pt: ECON.pt, pb: ECON.pb, tMax: 1200 }, function (t) {
      if (!ECON_CACHE || t < 10 || t > 1200) return null;
      var ec = ECON_CACHE;
      var T = Math.round(t / 2) * 2;
      var idx = clamp(Math.round(T / 2) - 1, 0, ec.pts.length - 1);
      var p = ec.pts[idx];
      var html = '<b>T = ' + Math.round(p.T) + ' 天</b><br>C(T) = <b>' + p.C.toFixed(4) + '</b> 万元/天' +
        '<br>纯故障检修 = <b>' + ec.Cfail.toFixed(4) + '</b> 万元/天';
      if (ec.opt) html += '<br>最优点：T* = <b>' + Math.round(ec.opt.T) + ' 天</b>';
      return html;
    });
    /* 分组柱状图 */
    var cv = $('cv-group'), tip = $('tip-group'), box = $('box-group');
    cv.setAttribute('data-lw', GRP.W);
    cv.addEventListener('mousemove', function (evt) {
      var p = logicalXY(cv, evt);
      var pw = GRP.W - GRP.pl - GRP.pr;
      var slot = pw / GROUPS.length;
      var i = Math.floor((p.x - GRP.pl) / slot);
      if (i < 0 || i >= GROUPS.length) { tip.style.display = 'none'; return; }
      var g = GROUPS[i];
      var before = groupMbf(g, false), after = groupMbf(g, true);
      showTip(tip, box, evt, '<b>' + g.name + '</b>（' + g.note + '）<br>措施前 MTBF = <b>' + Math.round(before) + ' 天</b>' +
        '<br>措施后 MTBF = <b>' + Math.round(after) + ' 天</b>' +
        '<br>提升 <b>' + ((after / before - 1) * 100).toFixed(0) + '%</b>');
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    sand: function (v) { return v + ' %'; },
    water: function (v) { return v + ' %'; },
    depth: function (v) { return v + ' m'; },
    spm: function (v) { return v + ' 次/min'; },
    corr: function (v) { return v + ' %'; },
    sandctrl: function (v) { return v ? '已实施' : '未实施'; },
    waxctrl: function (v) { return v ? '已实施' : '未实施'; },
    costwo: function (v) { return v + ' 万元/次'; },
    loss: function (v) { return v + ' 万元/天'; }
  };
  var KEYS = ['sand', 'water', 'depth', 'spm', 'corr', 'sandctrl', 'waxctrl', 'costwo', 'loss'];

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      KEYS.forEach(function (k) {
        $('s-' + k).value = DEF[k];
        S[k] = DEF[k];
        $('o-' + k).textContent = OUT[k](S[k]);
      });
      render();
    });
  }

  bind();
  bindTips();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });
})();

/* ======= 真实数据来源页：经典形态示意 + 公开报道数据 ======= */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

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

  /* ---------- ① 浴缸曲线（通用形态示意） ---------- */
  var BATH = { pl: 52, pr: 20, pt: 30, pb: 40, W: 900, H: 255 };
  function bathH(x) { /* x∈[0,1] 定性失效率 */
    return 2.4 * Math.exp(-x / 0.075) + 0.16 + 0.16 * Math.exp((x - 0.78) / 0.075);
  }
  var BATH_REGIONS = [
    { x0: 0, x1: 0.25, name: '早期失效期', beta: 'β<1', desc: '失效率递减：制造/作业缺陷、投产质量原因，对应检泵后早期失效；对策是作业质量管控与投产试压，而非缩短检泵周期。', color: '#b05a51' },
    { x0: 0.25, x1: 0.72, name: '偶然失效期', beta: 'β≈1', desc: '失效率近似恒定：外力随机事件（异物、杆断等偶发）；此阶段预防性更换没有收益，对应 GB/T 5080.7 恒定失效率假设。', color: '#2f7d6b' },
    { x0: 0.72, x1: 1, name: '耗损失效期', beta: 'β>1', desc: '失效率递增：泵阀磨损、腐蚀疲劳、杆管偏磨累积；存在经济最优预防性检泵周期 T*（本 demo 模拟页核心场景）。', color: '#c9a15a' }
  ];
  function drawBath() {
    var cv = $('cv-bath'); if (!cv) return;
    var ctx = setupCanvas(cv, BATH.W, BATH.H);
    var pl = BATH.pl, pr = BATH.pr, pt = BATH.pt, pb = BATH.pb;
    var pw = BATH.W - pl - pr, ph = BATH.H - pt - pb;
    var hMax = 3.0;
    var x = function (u) { return pl + u * pw; };
    var y = function (v) { return pt + ph - clamp(v, 0, hMax) / hMax * ph; };

    ctx.clearRect(0, 0, BATH.W, BATH.H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, BATH.W, BATH.H);

    /* 三阶段底色 + 分隔虚线 */
    BATH_REGIONS.forEach(function (r) {
      ctx.fillStyle = r.color; ctx.globalAlpha = 0.05;
      ctx.fillRect(x(r.x0), pt, x(r.x1) - x(r.x0), ph);
      ctx.globalAlpha = 1;
    });
    [0.25, 0.72].forEach(function (u) {
      ctx.strokeStyle = '#79828a'; ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(x(u), pt); ctx.lineTo(x(u), pt + ph); ctx.stroke();
      ctx.setLineDash([]);
    });

    /* 曲线 */
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#41699b';
    ctx.beginPath();
    for (var i = 0; i <= 400; i++) {
      var u = i / 400;
      var px = x(u), py = y(bathH(u));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* 区域标签 */
    ctx.font = 'bold 10.5px sans-serif'; ctx.textAlign = 'center';
    BATH_REGIONS.forEach(function (r) {
      var cx = x((r.x0 + r.x1) / 2);
      ctx.fillStyle = r.color;
      ctx.fillText(r.name + '（' + r.beta + '）', cx, pt - 8);
    });

    /* 坐标轴 */
    ctx.strokeStyle = '#cfc7b6'; ctx.lineWidth = 1;
    ctx.strokeRect(pl, pt, pw, ph);
    ctx.fillStyle = '#5d666d'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('运行时间 →（示意，无定量刻度）', pl + pw / 2, BATH.H - 6);
    ctx.save();
    ctx.translate(14, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('失效率 h(t)', 0, 0);
    ctx.restore();
    ctx.fillStyle = '#9ba3a9'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('来源：Abernethy《The New Weibull Handbook》第 5 版 · GB/T 5080.7-1986 · 通用形态示意', pl, pt + ph + 14);
  }

  /* ---------- ② 公开报道数据柱状图 ---------- */
  var PUB_CASES = [
    {
      group: '吴起作业区 · 抗砂抽油泵', before: 128, after: 412,
      beforeTxt: '128', afterTxt: '412',
      src: '《抽油泵砂卡机理及综合防治技术研究》：20 口出砂井应用抗砂泵，平均检泵周期 128→412 天，砂卡故障率降 82%'
    },
    {
      group: '中原油田卫 305-24 · 防腐优化', before: 365, after: 600,
      beforeTxt: '<365', afterTxt: '600+',
      src: '濮阳日报（2025-11-27）：严重腐蚀井检泵周期不足一年，经「定期检测伴生气+优选缓蚀剂」免修期延长至 600 余天；柱条按 365 / 600 绘制并取下限'
    },
    {
      group: '大庆采油七厂 · 短周期井治理', before: 186, after: 1092,
      beforeTxt: '186', afterTxt: '1092*',
      src: '中国石油网（2021-06）：40 口短周期井治理前平均免修期 186 天；*1092 天为治理后全厂平均检泵周期（外围油田历史最好成绩）'
    }
  ];
  var PUB = { pl: 52, pr: 20, pt: 16, pb: 52, W: 900, H: 265 };
  function drawPub() {
    var cv = $('cv-pub'); if (!cv) return;
    var ctx = setupCanvas(cv, PUB.W, PUB.H);
    var pl = PUB.pl, pr = PUB.pr, pt = PUB.pt, pb = PUB.pb;
    var pw = PUB.W - pl - pr, ph = PUB.H - pt - pb;
    var vMax = 1200;
    var y = function (v) { return pt + ph - v / vMax * ph; };

    ctx.clearRect(0, 0, PUB.W, PUB.H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, PUB.W, PUB.H);

    ctx.font = '9px Consolas, monospace';
    for (var v = 0; v <= vMax; v += 300) {
      ctx.strokeStyle = v ? '#efece1' : '#d8d0bc';
      ctx.beginPath(); ctx.moveTo(pl, y(v)); ctx.lineTo(pl + pw, y(v)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(v + '', pl - 5, y(v) + 3);
    }

    var slot = pw / PUB_CASES.length;
    var bw = 62;
    PUB_CASES.forEach(function (c, i) {
      var cx = pl + slot * (i + 0.5);
      var x1 = cx - bw - 4, x2 = cx + 4;
      ctx.fillStyle = '#b05a51'; ctx.globalAlpha = 0.85;
      ctx.fillRect(x1, y(c.before), bw, pt + ph - y(c.before));
      ctx.fillStyle = '#2f7d6b'; ctx.globalAlpha = 0.92;
      ctx.fillRect(x2, y(c.after), bw, pt + ph - y(c.after));
      ctx.globalAlpha = 1;
      ctx.font = 'bold 10px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#b05a51'; ctx.fillText(c.beforeTxt + ' 天', x1 + bw / 2, y(c.before) - 5);
      ctx.fillStyle = '#235f51'; ctx.fillText(c.afterTxt + ' 天', x2 + bw / 2, y(c.after) - 5);
      ctx.fillStyle = '#4d565b'; ctx.font = '9.5px sans-serif';
      /* 组名允许两行 */
      var name = c.group;
      if (name.length > 16) {
        var mid = Math.ceil(name.length / 2);
        var cut = name.indexOf('·') > 0 ? name.indexOf('·') + 1 : mid;
        ctx.fillText(name.slice(0, cut), cx, pt + ph + 14);
        ctx.fillText(name.slice(cut), cx, pt + ph + 26);
      } else {
        ctx.fillText(name, cx, pt + ph + 14);
      }
    });

    ctx.fillStyle = '#5d666d'; ctx.font = '9.5px sans-serif';
    ctx.save();
    ctx.translate(14, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('免修期 / 检泵周期（天）', 0, 0);
    ctx.restore();
  }

  /* ---------- ③ 文献对照表 ---------- */
  var LIT = [
    ['Weibull, W. (1951). A Statistical Distribution Function of Wide Applicability', 'ASME J. Applied Mechanics, 18(3):293–297', 'Weibull 分布本源：β/η 两参数形式，对应模拟页 R(t)/F(t)/h(t) 全部公式'],
    ['Abernethy, R.B. The New Weibull Handbook（第 5 版，2006）', '可靠性工程经典手册', '浴缸曲线三阶段判读（β<1 / ≈1 / >1），对应本页图①与失效率注记'],
    ['GB/T 5080.7-1986 设备可靠性试验 恒定失效率假设下的失效率与平均无故障时间的验证试验方案', '国家标准（std.samr.gov.cn 可查）', '失效率与 MTBF（预期免修期）统计口径，对应指标卡与 h(t) 图'],
    ['SY/T 6126-2017 抽油机、电动潜油泵和螺杆泵油井生产指标统计方法', '石油天然气行业标准', '「免修期」定义（末次检、下泵投产之日至统计日天数），对应全站免修期口径'],
    ['SY/T 5738-2012 采油设备修理劳动定额', '石油天然气行业标准', '检泵作业工时/费用口径，对应成本参数 Cp 滑块'],
    ['《抽油机井检泵周期可靠性预测模型与实际应用》', '中文期刊（维普收录）：三参数 Weibull 建立检泵周期概率密度模型，预测可靠度与实测吻合', '检泵周期 Weibull 拟合与生存曲线模块（图① R(t)/F(t)）'],
    ['《基于威布尔分布的油田机采井故障率研究》', '中文期刊（国家科技图书文献中心收录）：FPSO-SA 参数估计故障率函数 + 模糊决策求最佳预防性检泵周期', '失效率函数与最佳预防性检泵周期模块（图② h(t) 与 C(T)）'],
    ['Drumeanu, F. & Dumea, A. (2020). Considerations regarding determination of optimal preventive maintenance periodicity for subsurface sucker rod pumps', 'IOP Conf. Ser.: Materials Science and Engineering, 724:012034', '抽油泵预防性维护周期优化（固定时间/固定年龄更换），对应经济检泵周期 C(T) 模型']
  ];
  function fillLit() {
    var body = $('lit-body'); if (!body) return;
    LIT.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td>';
      body.appendChild(tr);
    });
  }

  /* ---------- tooltip 绑定 ---------- */
  function bindRealTips() {
    /* 浴缸曲线：按 x 区域提示 */
    var cv = $('cv-bath'), tip = $('tip-bath'), box = $('box-bath');
    if (cv) {
      cv.addEventListener('mousemove', function (evt) {
        var r = cv.getBoundingClientRect();
        var lx = (evt.clientX - r.left) / r.width * BATH.W;
        var u = (lx - BATH.pl) / (BATH.W - BATH.pl - BATH.pr);
        if (u < 0 || u > 1) { tip.style.display = 'none'; return; }
        var region = BATH_REGIONS[0];
        BATH_REGIONS.forEach(function (g) { if (u >= g.x0 && u <= g.x1) region = g; });
        var rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + region.name + '（' + region.beta + '）</b><br>' + region.desc;
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 260) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 90) + 'px';
      });
      cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    }
    /* 报道柱状图 */
    var cv2 = $('cv-pub'), tip2 = $('tip-pub'), box2 = $('box-pub');
    if (cv2) {
      cv2.addEventListener('mousemove', function (evt) {
        var r = cv2.getBoundingClientRect();
        var lx = (evt.clientX - r.left) / r.width * PUB.W;
        var pw = PUB.W - PUB.pl - PUB.pr;
        var slot = pw / PUB_CASES.length;
        var i = Math.floor((lx - PUB.pl) / slot);
        if (i < 0 || i >= PUB_CASES.length) { tip2.style.display = 'none'; return; }
        var c = PUB_CASES[i];
        var rb = box2.getBoundingClientRect();
        tip2.innerHTML = '<b>' + c.group + '</b><br>治理前 <b>' + c.beforeTxt + ' 天</b> → 治理后/对标 <b>' + c.afterTxt + ' 天</b><br><span style="color:#8a9298">' + c.src + '</span>';
        tip2.style.display = 'block';
        tip2.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 270) + 'px';
        tip2.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 96) + 'px';
      });
      cv2.addEventListener('mouseleave', function () { tip2.style.display = 'none'; });
    }
  }

  /* ---------- 页签切换 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
        /* 页签显示后重绘（隐藏时 clientWidth=0） */
        if (id === 'real') { drawBath(); drawPub(); }
      });
    });
  }

  bindTabs();
  fillLit();
  bindRealTips();
  drawBath();
  drawPub();

  var rsTimer2 = null;
  window.addEventListener('resize', function () {
    if (rsTimer2) clearTimeout(rsTimer2);
    rsTimer2 = setTimeout(function () { drawBath(); drawPub(); }, 120);
  });
})();
