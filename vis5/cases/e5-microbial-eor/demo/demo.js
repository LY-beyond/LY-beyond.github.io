/* ======= 微生物采油菌群活性智能预测 · 可运行示范 ======= */
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

  var DEF = { temp: 65, sal: 30000, perm: 300, ph: 7.0, vol: 500, conc: 2.2, period: 45 };
  var S = Object.assign({}, DEF);
  var WEEKS = 26;
  var N_WELLS = 9;          /* 注入井数 */
  var Q_BASE = 25;          /* 井组平均日产油基线 t/d */
  var F_BASE = 91;          /* 综合含水基线 % */
  var OIL_PRICE = 0.26;     /* 万元/t（2,600 元/t） */

  /* ---------- 适应性评分（筛选准则锚定 SPE 145054 / DuPont / Lazar） ---------- */
  function sTemp(t) {
    if (t <= 35) return clamp(1 - (35 - t) / 20, 0, 1);
    if (t <= 70) return 1;
    return clamp(1 - (t - 70) / 25, 0, 1);
  }
  function sSal(s) { return clamp((120000 - s) / 60000, 0, 1); }
  function sPerm(k) {
    return clamp((Math.log10(k) - Math.log10(20)) / (Math.log10(300) - Math.log10(20)), 0, 1);
  }
  function sPh(p) {
    if (p >= 6 && p <= 8) return 1;
    return clamp(1 - Math.max((6 - p) / 1.5, (p - 8) / 1.5), 0, 1);
  }
  function adaptIndex() {
    return 0.30 * sTemp(S.temp) + 0.25 * sSal(S.sal) + 0.25 * sPerm(S.perm) + 0.20 * sPh(S.ph);
  }
  function dose() { return (S.vol / 500) * (S.conc / 2.2); }

  /* ---------- 时序模拟：两轮补注，步长 0.25 周 ---------- */
  function simulate() {
    var A = adaptIndex();
    var d = dose();
    var dc = Math.min(d, 1.6);
    var w2 = Math.round(S.period / 7);
    var inj = [0, w2];
    var lagN = 1.2, tauRise = 2.0;
    var Np = 4.2 + 1.6 * A * Math.pow(dc, 0.6);
    var tauFall = 5 + 3 * A;
    var tauNut = 3.5 + 3 * Math.pow(dc, 0.6);
    var Mp = A * Math.pow(dc, 0.5);
    var lagM = 2.0, tauM = 6 + 3 * A;
    var L = 3 + 2 * (1 - A);            /* 增油滞后 3–8 周 */
    var dqMax = 0.35 * A * Math.pow(dc, 0.5);
    var fdMax = 4.0 * A * Math.pow(dc, 0.5);

    var pts = [];
    var oil = 0, nPeak = 3.8, step = 0.25;
    for (var t = 0; t <= WEEKS + 1e-9; t += step) {
      var N = 3.8, R = 0, M = 0, dq = 0, fd = 0;
      for (var k = 0; k < inj.length; k++) {
        var t0 = inj[k];
        var uN = t - t0 - lagN;
        if (uN > 0) {
          var rise = 1 - Math.exp(-Math.pow(uN / tauRise, 1.4));
          var fall = Math.exp(-Math.max(0, uN - 2.5) / tauFall);
          N += (Np - 3.8) * rise * fall;
        }
        var uR = t - t0;
        if (uR >= 0) R += 100 * Math.exp(-uR / tauNut);
        var uM = t - t0 - lagM;
        if (uM > 0) {
          var riseM = 1 - Math.exp(-Math.pow(uM / 2.5, 1.4));
          var fallM = Math.exp(-Math.max(0, uM - 4) / tauM);
          M += Mp * riseM * fallM;
        }
        var uQ = t - t0 - L;
        if (uQ > 0) {
          var g = (1 - Math.exp(-Math.pow(uQ / 3, 1.5))) * Math.exp(-Math.max(0, uQ - 10) / 12);
          dq += dqMax * g;
          fd += fdMax * g;
        }
      }
      N = Math.min(N, 7.2);
      R = Math.min(R, 100);
      M = Math.min(M, 1);
      if (N > nPeak) nPeak = N;
      oil += dq * step * 7 * N_WELLS;   /* t，试验区单轮口径 */
      pts.push({ t: t, N: N, R: R, M: M, q: Q_BASE + dq, f: F_BASE - fd });
    }
    return { A: A, dose: d, w2: w2, pts: pts, nPeak: nPeak, oil: oil, tauNut: tauNut };
  }

  function fmtCfu(logN) {
    var e = Math.floor(logN), m = Math.pow(10, logN - e);
    return m.toFixed(1) + '×10' + toSup(e);
  }
  function toSup(n) {
    var sup = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷' };
    return String(n).split('').map(function (c) { return sup[c] || c; }).join('');
  }

  /* ---------- 图① 适应性筛选 ---------- */
  var FACTORS = [
    { key: 'temp', name: '油藏温度', unit: '℃', lo: 15, hi: 100, log: false,
      bands: [[25, 35, '#e9d9a8'], [35, 70, '#bcd6c6'], [70, 85, '#e9d9a8']],
      crit: '适宜 35–70℃；>80℃ 失活',
      val: function () { return S.temp; },
      score: function () { return sTemp(S.temp); },
      txt: function () { return S.temp + ' ℃'; } },
    { key: 'sal', name: '矿化度', unit: 'mg/L', lo: 0, hi: 150000, log: false,
      bands: [[0, 60000, '#bcd6c6'], [60000, 100000, '#e9d9a8']],
      crit: '适宜 <6×10⁴ mg/L；上限 10⁵',
      val: function () { return S.sal; },
      score: function () { return sSal(S.sal); },
      txt: function () { return (S.sal / 10000).toFixed(1) + '×10⁴ mg/L'; } },
    { key: 'perm', name: '渗透率', unit: 'mD', lo: 10, hi: 2000, log: true,
      bands: [[30, 150, '#e9d9a8'], [150, 2000, '#bcd6c6']],
      crit: '适宜 ≥150 mD；下限 30 mD',
      val: function () { return S.perm; },
      score: function () { return sPerm(S.perm); },
      txt: function () { return S.perm + ' mD'; } },
    { key: 'ph', name: 'pH', unit: '', lo: 4, hi: 10, log: false,
      bands: [[5, 6, '#e9d9a8'], [6, 8, '#bcd6c6'], [8, 9, '#e9d9a8']],
      crit: '中性 6–8 最佳',
      val: function () { return S.ph; },
      score: function () { return sPh(S.ph); },
      txt: function () { return S.ph.toFixed(1); } }
  ];

  function drawSuit(hoverRow) {
    var W = 430, H = 212;
    var ctx = setupCanvas($('cv-suit'), W, H);
    var pl = 78, pr = 96, rowH = 34, y0 = 16;
    var pw = W - pl - pr;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    function xOf(f, v) {
      var r = f.log
        ? (Math.log10(Math.max(v, f.lo)) - Math.log10(f.lo)) / (Math.log10(f.hi) - Math.log10(f.lo))
        : (v - f.lo) / (f.hi - f.lo);
      return pl + clamp(r, 0, 1) * pw;
    }

    FACTORS.forEach(function (f, i) {
      var cy = y0 + i * rowH + rowH / 2;
      if (hoverRow === i) {
        ctx.fillStyle = '#f5f2ea';
        ctx.fillRect(0, cy - rowH / 2 + 2, W, rowH - 4);
      }
      ctx.fillStyle = '#4d565b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(f.name, 8, cy + 3);
      /* 轨道与适宜带 */
      ctx.fillStyle = '#f1ede2';
      ctx.fillRect(pl, cy - 6, pw, 12);
      f.bands.forEach(function (b) {
        var x1 = xOf(f, b[0]), x2 = xOf(f, b[1]);
        ctx.fillStyle = b[2];
        ctx.fillRect(x1, cy - 6, x2 - x1, 12);
      });
      ctx.strokeStyle = '#cfc7b6';
      ctx.lineWidth = 1;
      ctx.strokeRect(pl + 0.5, cy - 5.5, pw - 1, 11);
      /* 当前值标记 */
      var vx = xOf(f, f.val());
      var sc = f.score();
      var mc = sc >= 0.75 ? '#2f7d6b' : (sc >= 0.4 ? '#c9a15a' : '#b05a51');
      ctx.strokeStyle = mc;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(vx, cy - 8); ctx.lineTo(vx, cy + 8); ctx.stroke();
      ctx.fillStyle = mc;
      ctx.beginPath();
      ctx.moveTo(vx - 4, cy - 12); ctx.lineTo(vx + 4, cy - 12); ctx.lineTo(vx, cy - 6); ctx.closePath();
      ctx.fill();
      /* 右侧数值与评分 */
      ctx.textAlign = 'left';
      ctx.font = '10px Consolas, monospace';
      ctx.fillStyle = '#235f51';
      ctx.fillText(f.txt(), pl + pw + 6, cy - 1);
      ctx.fillStyle = sc >= 0.75 ? '#2f7d6b' : (sc >= 0.4 ? '#9a7a1c' : '#b05a51');
      ctx.fillText('评分 ' + sc.toFixed(2), pl + pw + 6, cy + 10);
    });

    /* 综合适应性指数 */
    var A = adaptIndex();
    var ay = y0 + 4 * rowH + 20;
    ctx.fillStyle = '#4d565b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('综合适应性 A', 8, ay + 3);
    ctx.fillStyle = '#f1ede2';
    ctx.fillRect(pl, ay - 6, pw, 12);
    var ag = ctx.createLinearGradient(pl, 0, pl + pw, 0);
    ag.addColorStop(0, '#b05a51');
    ag.addColorStop(0.5, '#c9a15a');
    ag.addColorStop(0.8, '#2f7d6b');
    ctx.fillStyle = ag;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(pl, ay - 6, pw, 12);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(pl + 0.5, ay - 5.5, pw - 1, 11);
    var ax = pl + A * pw;
    ctx.strokeStyle = '#235f51';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, ay - 8); ctx.lineTo(ax, ay + 8); ctx.stroke();
    var ac = A >= 0.75 ? '#2f7d6b' : (A >= 0.4 ? '#9a7a1c' : '#b05a51');
    var alab = A >= 0.75 ? '适宜' : (A >= 0.4 ? '边缘' : '不适宜');
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillStyle = ac;
    ctx.fillText(A.toFixed(2) + ' · ' + alab, pl + pw + 6, ay + 3);
  }

  /* ---------- 图② 菌浓-代谢时序 ---------- */
  var GW = 430, GH = 216, GPL = 34, GPR = 36, GPT = 22, GPB = 26;
  function gx(t) { return GPL + t / WEEKS * (GW - GPL - GPR); }
  function gyN(n) { return GPT + (8 - n) / (8 - 3) * (GH - GPT - GPB); }
  function gyR(v) { return GPT + (100 - v) / 100 * (GH - GPT - GPB); }

  function drawGrow(sim, hover) {
    var ctx = setupCanvas($('cv-grow'), GW, GH);
    ctx.clearRect(0, 0, GW, GH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, GW, GH);
    var pw = GW - GPL - GPR, ph = GH - GPT - GPB;

    /* 网格与轴 */
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'right';
    for (var n = 3; n <= 8; n++) {
      var y = gyN(n);
      ctx.strokeStyle = n === 3 ? '#cfc7b6' : '#efece1';
      ctx.beginPath(); ctx.moveTo(GPL, y); ctx.lineTo(GPL + pw, y); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(String(n), GPL - 4, y + 3);
    }
    ctx.textAlign = 'left';
    for (var rp = 0; rp <= 100; rp += 20) {
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(String(rp), GPL + pw + 4, gyR(rp) + 3);
    }
    ctx.textAlign = 'right';
    ctx.textAlign = 'center';
    for (var t = 0; t <= WEEKS; t += 4) {
      var x = gx(t);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x, GPT); ctx.lineTo(x, GPT + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(String(t), x, GPT + ph + 12);
    }
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(GPL + 0.5, GPT + 0.5, pw - 1, ph - 1);
    ctx.fillStyle = '#5d666d';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('时间（周）', GPL + pw / 2, GH - 3);
    ctx.save(); ctx.translate(10, GPT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('log₁₀(CFU/mL)', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(GW - 4, GPT + ph / 2); ctx.rotate(Math.PI / 2);
    ctx.fillText('指数 / %', 0, 0); ctx.restore();

    /* 补注标记 */
    [0, sim.w2].forEach(function (w, i) {
      var x = gx(w);
      ctx.strokeStyle = '#8a9298';
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, GPT); ctx.lineTo(x, GPT + ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#79828a';
      ctx.font = '8.5px sans-serif';
      ctx.textAlign = w > WEEKS - 6 ? 'end' : 'left';
      var lx = w > WEEKS - 6 ? x - 3 : x + 3;
      if (i === 0) lx = x + 3;
      ctx.fillText('第' + (i + 1) + '轮注入', lx, GPT + 9);
    });

    function pathOf(getY, getV) {
      ctx.beginPath();
      sim.pts.forEach(function (p, i) {
        var x = gx(p.t), y = getY(getV(p));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
    }
    /* 营养余量（虚线） */
    pathOf(gyR, function (p) { return p.R; });
    ctx.strokeStyle = '#c9a15a';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    /* 代谢产物 */
    pathOf(gyR, function (p) { return p.M * 100; });
    ctx.strokeStyle = '#41699b';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    /* 菌浓 */
    pathOf(gyN, function (p) { return p.N; });
    ctx.strokeStyle = '#2f7d6b';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    /* 悬停十字与取值点 */
    if (hover !== null) {
      var p = nearestPt(sim, hover);
      var hx = gx(p.t);
      ctx.strokeStyle = '#8a9298';
      ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(hx, GPT); ctx.lineTo(hx, GPT + ph); ctx.stroke();
      ctx.setLineDash([]);
      dot(ctx, hx, gyN(p.N), '#2f7d6b');
      dot(ctx, hx, gyR(p.M * 100), '#41699b');
      dot(ctx, hx, gyR(p.R), '#c9a15a');
    }
  }
  function dot(ctx, x, y, c) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.stroke();
  }
  function nearestPt(sim, t) {
    var best = sim.pts[0], bd = 1e9;
    sim.pts.forEach(function (p) {
      var d = Math.abs(p.t - t);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  /* ---------- 图③ 产油-含水响应 ---------- */
  var PW = 430, PH = 216, PPL = 34, PPR = 36, PPT = 22, PPB = 26;
  function drawProd(sim, hover) {
    var ctx = setupCanvas($('cv-prod'), PW, PH);
    ctx.clearRect(0, 0, PW, PH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, PW, PH);
    var pw = PW - PPL - PPR, ph = PH - PPT - PPB;
    var qMax = 0;
    sim.pts.forEach(function (p) { if (p.q > qMax) qMax = p.q; });
    var yHi = Math.max(26.5, qMax + 0.4);
    var yLo = 23;
    var fHi = 92, fLo = 84;

    function px(t) { return PPL + t / WEEKS * pw; }
    function pyQ(q) { return PPT + (yHi - q) / (yHi - yLo) * ph; }
    function pyF(f) { return PPT + (fHi - f) / (fHi - fLo) * ph; }

    ctx.font = '8.5px Consolas, monospace';
    var qStep = 1;
    for (var q = Math.ceil(yLo); q <= yHi; q += qStep) {
      var y = pyQ(q);
      ctx.strokeStyle = q === Q_BASE ? '#d8d0bc' : '#efece1';
      ctx.beginPath(); ctx.moveTo(PPL, y); ctx.lineTo(PPL + pw, y); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.textAlign = 'right';
      ctx.fillText(String(q), PPL - 4, y + 3);
    }
    for (var f = fHi; f >= fLo; f -= 2) {
      ctx.fillStyle = '#c99a92';
      ctx.textAlign = 'left';
      ctx.fillText(String(f), PPL + pw + 4, pyF(f) + 3);
    }
    ctx.textAlign = 'center';
    for (var t = 0; t <= WEEKS; t += 4) {
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(String(t), px(t), PPT + ph + 12);
    }
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(PPL + 0.5, PPT + 0.5, pw - 1, ph - 1);
    ctx.fillStyle = '#5d666d';
    ctx.font = '9px sans-serif';
    ctx.fillText('时间（周）', PPL + pw / 2, PH - 3);
    ctx.save(); ctx.translate(10, PPT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('日产油 (t/d)', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(PW - 4, PPT + ph / 2); ctx.rotate(Math.PI / 2);
    ctx.fillText('含水率 (%)', 0, 0); ctx.restore();

    /* 基线 */
    ctx.strokeStyle = '#8a9298';
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(PPL, pyQ(Q_BASE)); ctx.lineTo(PPL + pw, pyQ(Q_BASE)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8a9298';
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('基线 ' + Q_BASE + ' t/d', PPL + 5, pyQ(Q_BASE) + 10);

    /* 含水率 */
    ctx.beginPath();
    sim.pts.forEach(function (p, i) {
      var x = px(p.t), y = pyF(p.f);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    /* 日产油（含填充） */
    ctx.beginPath();
    sim.pts.forEach(function (p, i) {
      var x = px(p.t), y = pyQ(p.q);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#2f7d6b';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.lineTo(px(WEEKS), pyQ(Q_BASE));
    ctx.lineTo(px(0), pyQ(Q_BASE));
    ctx.closePath();
    ctx.fillStyle = 'rgba(47,125,107,0.12)';
    ctx.fill();

    if (hover !== null) {
      var p = nearestPt(sim, hover);
      var hx = px(p.t);
      ctx.strokeStyle = '#8a9298';
      ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(hx, PPT); ctx.lineTo(hx, PPT + ph); ctx.stroke();
      ctx.setLineDash([]);
      dot(ctx, hx, pyQ(p.q), '#2f7d6b');
      dot(ctx, hx, pyF(p.f), '#b05a51');
    }
  }

  /* ---------- 指标卡与决策 ---------- */
  function renderMetrics(sim) {
    var A = sim.A;
    var cost = N_WELLS * 7.5 * Math.pow(S.vol / 500, 0.85) * Math.pow(S.conc / 2.2, 0.6);
    var rev = sim.oil * OIL_PRICE;
    var roi = rev / cost;

    var mA = $('m-adapt');
    mA.innerHTML = A.toFixed(2);
    mA.parentNode.className = 'mcard' + (A < 0.4 ? ' bad' : (A < 0.75 ? ' warn' : ''));

    $('m-npeak').innerHTML = fmtCfu(sim.nPeak) + '<small> CFU/mL</small>';

    $('m-oil').innerHTML = sim.oil.toFixed(0) + '<small> t</small>';
    $('m-cost').innerHTML = cost.toFixed(0) + '<small> 万元</small>';

    var mR = $('m-roi');
    mR.innerHTML = roi.toFixed(2) + '<small> :1</small>';
    mR.parentNode.className = 'mcard' + (roi < 1 ? ' bad' : (roi < 1.3 ? ' warn' : ''));

    /* 决策提示 */
    var v = $('verdict');
    var weak = [['温度', sTemp(S.temp)], ['矿化度', sSal(S.sal)], ['渗透率', sPerm(S.perm)], ['pH', sPh(S.ph)]]
      .sort(function (a, b) { return a[1] - b[1]; })[0];
    var ineff = clamp(31 - 26 * A * Math.exp(-Math.pow(Math.log(Math.max(sim.dose, 0.2)), 2) / 0.9), 4, 48);
    var head = '适应性 <b>' + A.toFixed(2) + '</b> · 峰值菌浓 <b>' + fmtCfu(sim.nPeak) + '</b> CFU/mL · 单轮增油 <b>' + sim.oil.toFixed(0) + '</b> t · 成本 <b>' + cost.toFixed(0) + '</b> 万元；';

    if (A < 0.35) {
      v.className = 'verdict bad';
      v.innerHTML = head + '油藏条件不适宜 MEOR：限制因素为<b>' + weak[0] + '</b>（评分 ' + weak[1].toFixed(2) + '）。按筛选准则（T&lt;80℃、TDS&lt;10⁵ mg/L、pH 6–8、k&gt;30 mD）应先调剖或换层位，而非注入。';
      return;
    }
    if (sim.dose > 1.9) {
      v.className = 'verdict warn';
      v.innerHTML = head + '剂量 dose=<b>' + sim.dose.toFixed(2) + '</b> 偏高：营养过量将养出「只长菌不产油」的菌群，菌体与代谢物可能堵塞近井地带（单井处理 20–50 万元）。建议把单井次用量或浓度降回 400–600 m³ / 1.5%–3% 区间。';
      return;
    }
    if (roi < 1) {
      v.className = 'verdict warn';
      v.innerHTML = head + '投入产出比 <b>' + roi.toFixed(2) + '</b> &lt; 1，增油收入盖不住注入成本。建议提高适应性（换适配菌种/层位）或优化剂量后再补注。';
      return;
    }
    if (S.period > sim.tauNut * 7 * 1.15) {
      v.className = 'verdict warn';
      v.innerHTML = head + '补注周期 <b>' + S.period + '</b> 天偏长：营养余量约 ' + (sim.tauNut * 7).toFixed(0) + ' 天后耗尽，衰亡窗口内菌群活性快速下滑，无效注入率将升至约 <b>' + ineff.toFixed(0) + '%</b>。建议把周期压到 ' + Math.round(sim.tauNut * 7 / 5) * 5 + ' 天量级。';
      return;
    }
    v.className = 'verdict ok';
    v.innerHTML = head + '方案处于推荐区间：菌浓于注后 1–2 周起跳、增油响应滞后约 ' + (3 + 2 * (1 - A)).toFixed(1) + ' 周出现，预估无效注入率约 <b>' + ineff.toFixed(0) + '%</b>（人工盲补基线 31%）。建议按营养余量 &lt;15% 触发补注，而非固定周期。';
  }

  /* ---------- 悬停 tooltip ---------- */
  function bindHover(canvasId, boxId, tipId, geom, fmt, redraw) {
    var cv = $(canvasId), box = $(boxId), tip = $(tipId);
    function weekAt(evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (geom.W / r.width);
      return clamp((lx - geom.pl) / (geom.W - geom.pl - geom.pr), 0, 1) * WEEKS;
    }
    cv.addEventListener('mousemove', function (evt) {
      var w = weekAt(evt);
      redraw(w);
      var rb = box.getBoundingClientRect();
      tip.innerHTML = fmt(w);
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 64) + 'px';
    });
    cv.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      redraw(null);
    });
  }

  /* ---------- 数据来源页 ---------- */
  var SRC = [
    { tag: '综述', cite: 'Lazar, I., Petrisor, I.G., Yen, T.F. (2007). Microbial Enhanced Oil Recovery (MEOR). <i>Petroleum Science and Technology</i> 25(11):1353–1366.',
      data: '系统回顾 40 年全球 MEOR 矿场试验：成功案例集中于中低温、中低矿化度水驱油藏，增油幅度多为个位数采收率增量。',
      use: '适应性筛选的整体框架与增油量级上限' },
    { tag: '矿场试验', cite: 'Lazar, I. et al. (1993). MEOR recent field trials in Romania. In: <i>Microbial Enhancement of Oil Recovery—Recent Advances</i>, Developments in Petroleum Science 39, Elsevier.',
      data: '罗马尼亚矿场适应混菌（AMEC）口径：温度 ≤55–60℃、盐度 ≤70–100 g NaCl/L、孔隙度 &gt;20%、渗透率 150–300 mD。',
      use: '图① 筛选滑块区间与绿色适宜带边界' },
    { tag: 'SPE 论文', cite: 'Zahner, R.L., Tapper, S.J., Marcotte, B.W.G., Govreau, B.R. (2011). SPE 145054-MS, <i>What Has Been Learned From A Hundred MEOR Applications</i>.',
      data: '100 个矿场应用统计：初筛准则为油藏温度 &lt;80℃、TDS &lt;100,000 ppm、pH 6–8；处理后平均产量提升约 127%。',
      use: '温度/矿化度/pH 阈值与增油响应量级' },
    { tag: '机理综述', cite: 'Brown, L.R. (2010). Microbial enhanced oil recovery (MEOR). <i>Current Opinion in Microbiology</i> 13(3):316–320.',
      data: 'MEOR 机理：生物表面活性剂、气体、有机酸、聚合物与选择性堵塞共同作用；效果强依赖营养配方与油藏适配。',
      use: '代谢产物强度曲线构成与「营养过量堵塞」判定' },
    { tag: '矿场试验', cite: 'Li, Q., Kang, C., Wang, H. et al. (2002). Application of microbial enhanced oil recovery technique to Daqing Oilfield. <i>Biochemical Engineering Journal</i> 11(2–3):197–199.',
      data: '大庆先导：60 余口生产井注入菌液，约 80% 井见效，关井约 1 个月后含水率下降、产油上升。',
      use: '图③ 含水率响应形态与见效滞后期设定' },
    { tag: '数学模型', cite: '《石油学报》：考虑油藏环境因素和微生物因子的微生物采油数学模型（syxb-cps.com.cn）。',
      data: '以 Monod 方程描述微生物生长，耦合营养消耗与产物生成；最大比生长速率显著影响含水与采收率曲线形态。',
      use: '图② 菌浓—营养—代谢产物时序的模型形式' },
    { tag: '筛选准则', cite: 'DuPont MEOR 筛选准则（见 MEOR 综述文献转引）。',
      data: '油藏温度 &lt;160℉（≈71℃）、矿化度 ≤100,000 ppm、渗透率 &gt;30 mD、油藏处于水驱开发阶段。',
      use: '渗透率下限与水驱基线（综合含水 91%）设定' }
  ];

  function renderSrc() {
    var list = $('src-list'), body = $('src-body');
    SRC.forEach(function (s, i) {
      var card = document.createElement('div');
      card.className = 'src-card';
      card.innerHTML = '<span class="tag">' + s.tag + '</span><span><b>' + s.cite + '</b><br>' + s.data +
        '<span class="use"><b>用途：</b>' + s.use + '</span></span>';
      list.appendChild(card);
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + s.tag + ' · ' + s.cite + '</td><td>' + s.data + '</td><td>' + s.use + '</td>';
      body.appendChild(tr);
    });
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    temp: function (v) { return v + ' ℃'; },
    sal: function (v) { return v.toLocaleString('en-US') + ' mg/L'; },
    perm: function (v) { return v + ' mD'; },
    ph: function (v) { return (+v).toFixed(1); },
    vol: function (v) { return v + ' m³'; },
    conc: function (v) { return (+v).toFixed(1) + ' %'; },
    period: function (v) { return v + ' 天'; }
  };
  var KEYS = ['temp', 'sal', 'perm', 'ph', 'vol', 'conc', 'period'];
  var SIM = null;

  function render() {
    SIM = simulate();
    drawSuit(null);
    drawGrow(SIM, null);
    drawProd(SIM, null);
    renderMetrics(SIM);
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
      KEYS.forEach(function (k) {
        S[k] = DEF[k];
        $('s-' + k).value = DEF[k];
        $('o-' + k).textContent = OUT[k](DEF[k]);
      });
      render();
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
        if (id === 'sim') render();
      });
    });
  }

  bind();
  bindTabs();
  renderSrc();
  render();

  bindHover('cv-grow', 'boxB', 'tipB',
    { W: GW, pl: GPL, pr: GPR },
    function (w) {
      var p = nearestPt(SIM, w);
      return '<b>第 ' + p.t.toFixed(1) + ' 周</b><br>菌浓 <b>' + p.N.toFixed(2) + '</b>（≈' + fmtCfu(p.N) + ' CFU/mL）<br>代谢产物 <b>' + p.M.toFixed(2) + '</b> · 营养余量 <b>' + p.R.toFixed(0) + '%</b>';
    },
    function (w) { drawGrow(SIM, w); });

  bindHover('cv-prod', 'boxC', 'tipC',
    { W: PW, pl: PPL, pr: PPR },
    function (w) {
      var p = nearestPt(SIM, w);
      return '<b>第 ' + p.t.toFixed(1) + ' 周</b><br>日产油 <b>' + p.q.toFixed(2) + ' t/d</b>（增 ' + (p.q - Q_BASE).toFixed(2) + '）<br>综合含水 <b>' + p.f.toFixed(1) + '%</b>';
    },
    function (w) { drawProd(SIM, w); });

  /* 图① 行悬停 */
  (function () {
    var cv = $('cv-suit'), box = $('boxA'), tip = $('tipA');
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var ly = (evt.clientY - r.top) * (212 / r.height);
      var row = Math.floor((ly - 16) / 34);
      if (row >= 0 && row < FACTORS.length) {
        var f = FACTORS[row];
        drawSuit(row);
        var rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + f.name + '</b> ' + f.txt() + '<br>评分 <b>' + f.score().toFixed(2) + '</b> · ' + f.crit;
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 60) + 'px';
      } else {
        tip.style.display = 'none';
        drawSuit(null);
      }
    });
    cv.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      drawSuit(null);
    });
  })();

  /* 尺寸变化时重建 canvas backing store */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });
})();
