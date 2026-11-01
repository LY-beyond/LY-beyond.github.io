/* ======= 蒸汽吞吐注采参数智能优化 · 可运行示范 =======
   模型为示意级简化物理模型，结构参照 Marx-Langenheim (1959) 加热模型
   与 Boberg-Lantz (1966, SPE-1294-PA) 三段式热损失方法 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI：backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
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

  var DEF = { V: 2000, qi: 10, xw: 72, soak: 6, qo: 70, n0: 5 };
  var S = Object.assign({}, DEF);
  var N_SHOW = 8;               /* 递减图展示的周期数 */
  var OIL_PRICE = 0.3;          /* 万元/t（3000 元/t） */
  var STEAM_COST = 0.02;        /* 万元/t（200 元/t） */
  var FIXED_COST = 10;          /* 万元/周期（作业+电费等） */

  /* ---------- 模型 ---------- */
  function xbh() { return clamp((S.xw - 10) / 100, 0.3, 0.75); }   /* 井底干度 */
  function heatIndex() { return S.V * xbh(); }                     /* 注入热量指数 */

  function heatRadius() {                                        /* Marx-Langenheim 平方根律 */
    var rh = 14 * Math.sqrt(heatIndex() / 1000) * (1 + 0.04 * (S.soak - 6));
    return clamp(rh, 6, 40);
  }
  function hotRadius() {                                         /* 焖井末 T≥100℃ 边界 */
    return clamp(1.332 * heatRadius(), 6, 40);
  }

  function decayFactor() {                                       /* 周期递减因子：强采/大注汽透支 */
    return clamp(0.90 - 0.006 * (S.qo - 70) / 10 - 0.005 * (S.V - 2000) / 200, 0.78, 0.95);
  }

  function cycleOil(n, V) {                                      /* 第 n 周期产油 (t) */
    var v = (typeof V === 'number') ? V : S.V;
    var fV = Math.pow(v / 2000, 0.55);
    var fq = Math.pow(S.qi / 10, 0.15);
    var fx = Math.pow(xbh() / 0.62, 0.8);
    var fsoak = (1 - Math.exp(-S.soak / 4.2)) / (1 - Math.exp(-6 / 4.2));
    var fdraw = Math.pow(S.qo / 70, 0.35);
    var d = (typeof V === 'number')
      ? clamp(0.90 - 0.006 * (S.qo - 70) / 10 - 0.005 * (v - 2000) / 200, 0.78, 0.95)
      : decayFactor();
    return 1300 * fV * fq * fx * fsoak * fdraw * Math.pow(d, n - 1);
  }
  function cycleNet(n, V) {
    var v = (typeof V === 'number') ? V : S.V;
    return OIL_PRICE * cycleOil(n, v) - STEAM_COST * v - FIXED_COST;
  }
  function cum3(V) {                                             /* 未来 3 周期累计 */
    var v = (typeof V === 'number') ? V : S.V;
    var oil = 0, net = 0;
    for (var k = 0; k < 3; k++) {
      oil += cycleOil(S.n0 + k, v);
      net += cycleNet(S.n0 + k, v);
    }
    return { oil: oil, cost: 3 * (STEAM_COST * v + FIXED_COST), net: net, osr: oil / (3 * v) };
  }
  function optV() {                                              /* 3 周期累计净收益最优注汽量 */
    var best = 1200, bestNet = -1e9;
    for (var v = 1200; v <= 3000; v += 25) {
      var net = cum3(v).net;
      if (net > bestNet) { bestNet = net; best = v; }
    }
    return best;
  }
  function osrLimV(target) {                                     /* 满足累计 OSR ≥ target 的最大注汽量 */
    for (var v = 3000; v >= 1200; v -= 25) {
      if (cum3(v).osr >= target) return v;
    }
    return null;
  }

  /* 地层温度剖面：T(r) 三阶段 */
  var T_RES = 45, T_STEAM = 250;
  function tempProfile(r, stage) {
    var rh = heatRadius();
    if (stage === 0) return T_RES + (T_STEAM - T_RES) * Math.exp(-Math.pow(r / (0.85 * rh), 2));
    if (stage === 1) return T_RES + (T_STEAM - T_RES) * 0.92 * Math.exp(-Math.pow(r / (1.2 * rh), 2));
    return T_RES + (T_STEAM - T_RES) * 0.55 * Math.exp(-Math.pow(r / (1.45 * rh), 2));
  }

  /* ---------- 通用 canvas 工具 ---------- */
  function axisText(ctx, s, x, y, align, color) {
    ctx.fillStyle = color || '#9ba3a9';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function grid(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = '#efece1';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  /* ---------- 面板 1：多周期产油 + OSR ---------- */
  var hitA = [];
  function drawCycles() {
    var W = 460, H = 252, pl = 46, pr = 46, pt = 18, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var cv = $('cv-cycles'), ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);
    ctx.font = '10px Consolas, monospace';

    var cycles = [];
    for (var k = 0; k < N_SHOW; k++) {
      var n = S.n0 + k;
      var o = cycleOil(n);
      cycles.push({ n: n, oil: o, osr: o / S.V, net: cycleNet(n) });
    }
    var oMax = Math.max.apply(null, cycles.map(function (c) { return c.oil; }));
    var yMax = Math.max(400, Math.ceil(oMax / 400) * 400);
    var x = function (i) { return pl + (i + 0.5) / N_SHOW * pw; };
    var yO = function (o) { return pt + ph - o / yMax * ph; };
    var yR = function (r) { return pt + ph - r / 0.9 * ph; };

    /* 网格与双轴 */
    for (var g = 0; g <= yMax; g += 400) {
      grid(ctx, pl, yO(g), pl + pw, yO(g));
      axisText(ctx, g + '', pl - 6, yO(g) + 3, 'end');
    }
    for (var r2 = 0; r2 <= 0.9; r2 += 0.3) {
      axisText(ctx, r2.toFixed(1), pl + pw + 6, yR(r2) + 3, 'start', '#b08d4f');
    }
    hitA = [];
    var bw = pw / N_SHOW * 0.56;
    cycles.forEach(function (c, i) {
      var bx = x(i) - bw / 2, by = yO(c.oil);
      ctx.fillStyle = 'rgba(47,125,107,0.78)';
      ctx.fillRect(bx, by, bw, pt + ph - by);
      ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, pt + ph - by);
      axisText(ctx, 'P' + c.n, x(i), pt + ph + 13, 'center', '#79828a');
      hitA.push({ cx: x(i), data: c });
    });

    /* OSR 折线 */
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 2;
    ctx.beginPath();
    cycles.forEach(function (c, i) {
      var px = x(i), py = yR(c.osr);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    cycles.forEach(function (c, i) {
      ctx.fillStyle = '#c9a15a';
      ctx.beginPath(); ctx.arc(x(i), yR(c.osr), 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fdfcf9'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x(i), yR(c.osr), 3, 0, Math.PI * 2); ctx.stroke();
    });
    /* 首末周期 OSR 数值标签（错层防重叠） */
    ctx.font = '10px Consolas, monospace';
    axisText(ctx, cycles[0].osr.toFixed(2), x(0), yR(cycles[0].osr) - 7, 'center', '#8a6a1f');
    var li = cycles.length - 1;
    axisText(ctx, cycles[li].osr.toFixed(2), x(li), yR(cycles[li].osr) - 7, 'center', '#8a6a1f');

    /* 目标 OSR 0.48 线 */
    var yT = yR(0.48);
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yT); ctx.lineTo(pl + pw, yT); ctx.stroke();
    ctx.setLineDash([]);
    axisText(ctx, '目标 0.48', pl + pw - 2, yT - 4, 'end', '#b05a51');

    /* 轴标题 */
    ctx.save();
    ctx.translate(12, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    axisText(ctx, '周期产油 (t)', 0, 0, 'center', '#5d666d');
    ctx.restore();
    ctx.save();
    ctx.translate(W - 8, pt + ph / 2); ctx.rotate(Math.PI / 2);
    axisText(ctx, '油汽比 (t/t)', 0, 0, 'center', '#b08d4f');
    ctx.restore();
    axisText(ctx, '吞吐周期序号（当前井已至第 ' + S.n0 + ' 周期）', pl + pw / 2, H - 3, 'center', '#5d666d');
    return cycles;
  }

  function bindCycles(cycles) {
    var cv = $('cv-cycles'), tip = $('tipA'), box = $('boxA');
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (460 / r.width);
      var best = null, bd = 1e9;
      hitA.forEach(function (h) {
        var d = Math.abs(h.cx - lx);
        if (d < bd) { bd = d; best = h; }
      });
      if (best && bd < 40) {
        var c = best.data, rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>第 ' + c.n + ' 周期</b><br>产油 <b>' + c.oil.toFixed(0) + ' t</b> · 油汽比 <b>' + c.osr.toFixed(3) + '</b><br>周期净收益 <b>' + c.net.toFixed(0) + ' 万元</b>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 64) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 2：地层温度剖面 ---------- */
  function drawTemp() {
    var W = 460, H = 238, pl = 42, pr = 14, pt = 16, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var cv = $('cv-temp'), ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);
    ctx.font = '10px Consolas, monospace';
    var R1 = 40;
    var x = function (r) { return pl + r / R1 * pw; };
    var y = function (t) { return pt + ph - (t - 40) / 220 * ph; };

    for (var t = 40; t <= 260; t += 55) {
      grid(ctx, pl, y(t), pl + pw, y(t));
      axisText(ctx, t + '', pl - 6, y(t) + 3, 'end');
    }
    for (var r0 = 0; r0 <= 40; r0 += 10) {
      grid(ctx, x(r0), pt, x(r0), pt + ph);
      axisText(ctx, r0 + '', x(r0), pt + ph + 13, 'center');
    }

    /* 油层原始温度线 */
    ctx.strokeStyle = '#79828a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(pl, y(T_RES)); ctx.lineTo(pl + pw, y(T_RES)); ctx.stroke();
    ctx.setLineDash([]);
    axisText(ctx, '原始 45℃', pl + pw - 2, y(T_RES) - 4, 'end', '#79828a');
    /* 100℃ 参考线 */
    ctx.strokeStyle = '#e2d7bd'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(pl, y(100)); ctx.lineTo(pl + pw, y(100)); ctx.stroke();
    ctx.setLineDash([]);
    axisText(ctx, '100℃', pl + 3, y(100) - 4, 'start', '#a89a78');

    var cols = ['#b05a51', '#c9a15a', '#41699b'];
    for (var st = 0; st < 3; st++) {
      ctx.strokeStyle = cols[st]; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i <= 120; i++) {
        var r = i / 120 * R1;
        var px = x(r), py = y(tempProfile(r, st));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    /* 曲线右端在 r=32 处标注（此处三曲线已充分分离，且带引线避免压线） */
    var names = ['注汽末', '焖井末', '生产30天'];
    var ends = [0, 1, 2].map(function (st) {
      return { st: st, y: y(tempProfile(32, st)) };
    }).sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) {
      if (ends[k].y - ends[k - 1].y < 13) ends[k].y = ends[k - 1].y + 13;
    }
    /* 整体钳制在绘图区内：最低标注不压底轴，最高不压顶边 */
    var over = ends[ends.length - 1].y - (pt + ph - 12);
    if (over > 0) ends.forEach(function (e) { e.y -= over; });
    if (ends[0].y < pt + 10) { var up = pt + 10 - ends[0].y; ends.forEach(function (e) { e.y += up; }); }
    ends.forEach(function (e) {
      var cy = y(tempProfile(32, e.st));
      ctx.strokeStyle = cols[e.st]; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x(32), cy); ctx.lineTo(x(32) + 6, e.y - 3); ctx.stroke();
      axisText(ctx, names[e.st], x(32) + 8, e.y, 'start', cols[e.st]);
    });

    /* 加热半径标注 */
    var rh = hotRadius();
    var xr = x(Math.min(rh, R1));
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(xr, pt); ctx.lineTo(xr, pt + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#2f7d6b';
    ctx.textAlign = rh > 33 ? 'end' : 'center';
    ctx.fillText('加热半径 ≈ ' + rh.toFixed(1) + ' m', xr + (rh > 33 ? -4 : 0), pt - 4);

    ctx.save();
    ctx.translate(12, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    axisText(ctx, '地层温度 (℃)', 0, 0, 'center', '#5d666d');
    ctx.restore();
    axisText(ctx, '距井筒径向距离 (m)', pl + pw / 2, H - 3, 'center', '#5d666d');
  }

  function bindTemp() {
    var cv = $('cv-temp'), tip = $('tipB'), box = $('boxB');
    var pl = 42, pr = 14;
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (460 / r.width);
      var pw = 460 - pl - pr;
      if (lx < pl || lx > pl + pw) { tip.style.display = 'none'; return; }
      var rr = (lx - pl) / pw * 40;
      var rb = box.getBoundingClientRect();
      tip.innerHTML = '<b>距井 ' + rr.toFixed(1) + ' m</b><br>注汽末 <b>' + tempProfile(rr, 0).toFixed(0) + '℃</b> · 焖井末 <b>' +
        tempProfile(rr, 1).toFixed(0) + '℃</b><br>生产 30 天 <b>' + tempProfile(rr, 2).toFixed(0) + '℃</b>（原始 45℃）';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 66) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 3：注汽量—净收益权衡 ---------- */
  function drawTrade() {
    var W = 460, H = 238, pl = 48, pr = 14, pt = 16, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var cv = $('cv-trade'), ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);
    ctx.font = '10px Consolas, monospace';

    var V0 = 1200, V1 = 3000;
    var pts = [];
    var yMax = 0;
    for (var v = V0; v <= V1; v += 25) {
      var c = cum3(v);
      pts.push({ v: v, rev: OIL_PRICE * c.oil, cost: c.cost, net: c.net });
      yMax = Math.max(yMax, OIL_PRICE * c.oil);
    }
    yMax = Math.ceil(yMax / 200) * 200;
    var x = function (v) { return pl + (v - V0) / (V1 - V0) * pw; };
    var y = function (m) { return pt + ph - m / yMax * ph; };

    for (var g = 0; g <= yMax; g += 200) {
      grid(ctx, pl, y(g), pl + pw, y(g));
      axisText(ctx, g + '', pl - 6, y(g) + 3, 'end');
    }
    for (var tv = V0; tv <= V1; tv += 300) {
      grid(ctx, x(tv), pt, x(tv), pt + ph);
      axisText(ctx, tv + '', x(tv), pt + ph + 13, 'center');
    }

    function line(key, color, wd) {
      ctx.strokeStyle = color; ctx.lineWidth = wd || 2;
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var px = x(p.v), py = y(p[key]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    line('rev', '#2f7d6b');
    line('cost', '#79828a', 1.5);
    line('net', '#b05a51');

    /* 右端标注防重叠 */
    var last = pts[pts.length - 1];
    var ends = [
      { k: '收入', y: y(last.rev), c: '#2f7d6b' },
      { k: '成本', y: y(last.cost), c: '#79828a' },
      { k: '净收益', y: y(last.net), c: '#b05a51' }
    ].sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) {
      if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
    }
    ends.forEach(function (e) {
      axisText(ctx, e.k, pl + pw - 2, clamp(e.y, pt + 8, pt + ph) - 2, 'end', e.c);
    });

    /* 当前方案 */
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(x(S.V), pt); ctx.lineTo(x(S.V), pt + ph); ctx.stroke();
    ctx.setLineDash([]);
    axisText(ctx, '当前 ' + S.V + ' t', x(S.V), pt - 4, S.V > 2700 ? 'end' : 'center', '#41699b');

    /* 最优方案 */
    var vStar = optV();
    var netStar = cum3(vStar).net;
    ctx.fillStyle = '#c9a15a';
    ctx.beginPath(); ctx.arc(x(vStar), y(netStar), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a1f'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x(vStar), y(netStar), 5, 0, Math.PI * 2); ctx.stroke();
    var lblOpt = '最优 ' + vStar + ' t（净 ' + netStar.toFixed(0) + ' 万）';
    var optAnchor = vStar > 2500 ? 'end' : (vStar < 1500 ? 'start' : 'center');
    axisText(ctx, lblOpt, x(vStar), y(netStar) - 9, optAnchor, '#8a6a1f');

    ctx.save();
    ctx.translate(12, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    axisText(ctx, '3 周期累计金额 (万元)', 0, 0, 'center', '#5d666d');
    ctx.restore();
    axisText(ctx, '周期注汽量 (t)', pl + pw / 2, H - 3, 'center', '#5d666d');
    return vStar;
  }

  function bindTrade() {
    var cv = $('cv-trade'), tip = $('tipC'), box = $('boxC');
    var pl = 48, pr = 14;
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (460 / r.width);
      var pw = 460 - pl - pr;
      if (lx < pl || lx > pl + pw) { tip.style.display = 'none'; return; }
      var v = Math.round((1200 + (lx - pl) / pw * 1800) / 25) * 25;
      var c = cum3(v), rb = box.getBoundingClientRect();
      tip.innerHTML = '<b>注汽量 ' + v + ' t</b>（3 周期累计）<br>产油收入 <b>' + (OIL_PRICE * c.oil).toFixed(0) + '</b> · 成本 <b>' + c.cost.toFixed(0) + '</b> 万元<br>净收益 <b>' + c.net.toFixed(0) + ' 万元</b> · 累计 OSR <b>' + c.osr.toFixed(3) + '</b>';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 215) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 70) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 指标卡 + 结论 ---------- */
  function renderMetrics(vStar) {
    var o0 = cycleOil(S.n0);
    var osr0 = o0 / S.V;
    var c3 = cum3();
    var net0 = cycleNet(S.n0);

    $('m-oil').innerHTML = o0.toFixed(0) + '<small> t</small>';
    $('m-osr').innerHTML = osr0.toFixed(3) + '<small> t/t</small>';
    $('m-osr').parentNode.className = 'mcard' + (osr0 < 0.35 ? ' bad' : (osr0 < 0.48 ? ' warn' : ''));
    $('m-osr3').innerHTML = c3.osr.toFixed(3) + '<small> t/t</small>';
    $('m-osr3').parentNode.className = 'mcard' + (c3.osr < 0.38 ? ' bad' : (c3.osr < 0.45 ? ' warn' : ''));
    $('m-rh').innerHTML = hotRadius().toFixed(1) + '<small> m</small>';
    $('m-net3').innerHTML = c3.net.toFixed(0) + '<small> 万元</small>';
    $('m-net3').parentNode.className = 'mcard' + (c3.net < 0 ? ' bad' : '');

    var v = $('verdict');
    var c3s = cum3(vStar);
    var head = '当前方案（第 ' + S.n0 + ' 周期起）：本周期产油 <b>' + o0.toFixed(0) + '</b> t、油汽比 <b>' + osr0.toFixed(3) + '</b>、周期净收益 <b>' + net0.toFixed(0) + '</b> 万元；';
    if (S.qi > 12) {
      v.className = 'verdict bad';
      v.innerHTML = head + '注汽速度 <b>' + S.qi + '</b> t/h 超出管网硬约束上限 12 t/h（锅炉额定蒸发量与管网压力限制），且高速注汽加剧蒸汽指进。建议回落至 12 t/h 以下。';
      return;
    }
    if (S.soak < 4) {
      v.className = 'verdict warn';
      v.innerHTML = head + '焖井仅 <b>' + S.soak + '</b> 天，热量未充分扩散，加热半径偏小。建议焖井 ≥ 4 天（工程窗口 4–10 天）。';
      return;
    }
    if (S.soak > 10) {
      v.className = 'verdict warn';
      v.innerHTML = head + '焖井 <b>' + S.soak + '</b> 天超出排产窗口（4–10 天），注汽队与作业井次排不开，且热损失增大。';
      return;
    }
    if (c3.osr < 0.38) {
      v.className = 'verdict warn';
      v.innerHTML = head + '3 周期累计油汽比 <b>' + c3.osr.toFixed(3) + '</b> 明显低于人工经验水平 0.39——注汽效率偏低或强采透支。建议降低注汽量 / 采液速度以减缓递减；若按累计净收益最优则建议注汽量 <b>' + vStar + '</b> t（累计 OSR <b>' + c3s.osr.toFixed(3) + '</b>、净收益 <b>' + c3s.net.toFixed(0) + '</b> 万元）。';
      return;
    }
    var delta = vStar - S.V;
    var dir = delta > 0 ? '提高 ' + delta : (delta < 0 ? '降低 ' + (-delta) : '维持');
    var reach = c3.osr >= 0.45 ? '已达方案目标（3 周期累计 OSR ≥ 0.45）。' : '与人工经验水平（0.39）相当，距方案目标 0.45 仍有提升空间。';
    var v45 = osrLimV(0.45);
    var osrAdvice = (v45 === null)
      ? '当前参数下即使注汽量降至 1200 t，累计 OSR 仍达不到 0.45，需先改善干度 / 焖井 / 采液匹配。'
      : (c3.osr >= 0.45
        ? '保持 OSR ≥ 0.45 前提下注汽量上限约 <b>' + v45 + '</b> t。'
        : '若考核口径要求累计 OSR ≥ 0.45，注汽量需降至 <b>' + v45 + '</b> t 以下（净收益 <b>' + cum3(v45).net.toFixed(0) + '</b> 万元）。');
    v.className = 'verdict ok';
    v.innerHTML = head + '3 周期累计 OSR <b>' + c3.osr.toFixed(3) + '</b>、净收益 <b>' + c3.net.toFixed(0) + '</b> 万元，' + reach +
      '按未来 3 周期累计净收益扫描，净收益最优为注汽量 <b>' + vStar + '</b> t（较当前' + dir + '，对应累计 OSR <b>' + c3s.osr.toFixed(3) + '</b>、净收益 <b>' + c3s.net.toFixed(0) + '</b> 万元）；' + osrAdvice +
      '——净收益与油汽比存在权衡，且目标应为多周期累计最优而非单周期产量最大。';
  }

  function render() {
    drawCycles();
    drawTemp();
    var vStar = drawTrade();
    renderMetrics(vStar);
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    V: function (v) { return v + ' t'; },
    qi: function (v) { return v + ' t/h'; },
    xw: function (v) { return v + ' %'; },
    soak: function (v) { return v + ' d'; },
    qo: function (v) { return v + ' t/d'; },
    n0: function (v) { return '第 ' + v + ' 周期'; }
  };
  var KEYS = ['V', 'qi', 'xw', 'soak', 'qo', 'n0'];

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
        $('o-' + k).textContent = OUT[k](DEF[k]);
      });
      render();
    });
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        document.querySelectorAll('.tab').forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        document.querySelectorAll('.tabpane').forEach(function (p) {
          p.classList.toggle('active', p.id === 'pane-' + id);
        });
        if (id === 'sim') render();   /* 回到模拟页时重建 backing store */
      });
    });
  }

  bind();
  bindCycles();
  bindTemp();
  bindTrade();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });
})();
