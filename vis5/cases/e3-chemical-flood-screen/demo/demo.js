/* ======= 化学驱配方智能筛选 · 可运行示范（模拟页） ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
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

  /* ---------- 状态与方式定义（Taber 1997 SPE 35385 准则的分段函数化） ---------- */
  var MODES = {
    poly: {
      name: '聚合物驱', color: '#2f7d6b', baseE: 11,
      mu: [10, 150], temp: [75, 93], sal: [10000, 20000], perm: [50, 300], depth: [800, 2800], soi: [0.50, 0.65]
    },
    sp: {
      name: '二元复合驱', color: '#41699b', baseE: 18,
      mu: [10, 80], temp: [85, 93], sal: [8000, 15000], perm: [80, 300], depth: [900, 2600], soi: [0.52, 0.65]
    },
    asp: {
      name: '三元复合驱', color: '#b05a51', baseE: 20.5,
      mu: [5, 50], temp: [80, 90], sal: [5000, 10000], perm: [150, 400], depth: [900, 2400], soi: [0.55, 0.68]
    }
  };

  var DEF = {
    mode: 'sp',
    mu: 9.8, temp: 45, sal: 6800, perm: 500, depth: 1200, soi: 0.60,
    cs: 0.30, cp: 1500, pv: 0.35
  };
  var S = Object.assign({}, DEF);

  var OOIP = 350;           /* 示意区块地质储量，万 t（5 个注入井组） */
  var PVBLK = 160;          /* 示意控制孔隙体积，万 m³ */
  var SWEEP = 0.62;         /* 波及系数 */

  /* ---------- 评分模型 ---------- */
  function scoreDown(v, lo, hi) { return clamp((hi - v) / (hi - lo), 0, 1); }
  function scoreUp(v, lo, hi) { return clamp((v - lo) / (hi - lo), 0, 1); }

  /* 六维适配分（0–1），按当前方式取 Taber 阈值 */
  function dimScores(mode) {
    var m = MODES[mode];
    return [
      { key: 'mu',    label: '原油黏度',   val: S.mu,    unit: 'mPa·s', score: scoreDown(S.mu, m.mu[0], m.mu[1]) },
      { key: 'temp',  label: '油藏温度',   val: S.temp,  unit: '℃',     score: scoreDown(S.temp, m.temp[0], m.temp[1]) },
      { key: 'sal',   label: '矿化度',     val: S.sal,   unit: 'mg/L',  score: scoreDown(S.sal, m.sal[0], m.sal[1]) },
      { key: 'perm',  label: '渗透率',     val: S.perm,  unit: 'mD',    score: scoreUp(S.perm, m.perm[0], m.perm[1]) },
      { key: 'depth', label: '油藏深度',   val: S.depth, unit: 'm',     score: scoreUp(S.depth, m.depth[0], m.depth[1]) },
      { key: 'soi',   label: '含油饱和度', val: S.soi,   unit: '',      score: scoreUp(S.soi, m.soi[0], m.soi[1]) }
    ];
  }
  var WEIGHTS = [0.22, 0.18, 0.18, 0.16, 0.12, 0.14];
  function totalScore(mode) {
    var ds = dimScores(mode), s = 0;
    for (var i = 0; i < ds.length; i++) s += WEIGHTS[i] * ds[i].score;
    return Math.round(s * 100);
  }

  /* ---------- 界面张力（mN/m，对数尺度模型） ---------- */
  function logIFT(st) {
    var logI;
    if (st.mode === 'poly') {
      logI = Math.log10(22);                 /* 聚合物驱不改变油水界面张力 */
    } else {
      var base = Math.log10(22) - 4.2 * (1 - Math.exp(-st.cs / 0.08));
      base += 0.4 * Math.abs(Math.log10(st.sal / 6800));
      base -= 0.008 * (st.temp - 45);
      if (st.mode === 'asp') {
        base -= 0.3;                          /* 碱–表活剂协同 */
        if (st.sal > 8000) base += 0.5;       /* 高盐碱耗/沉淀惩罚 */
      }
      logI = base;
    }
    return clamp(logI, -4.5, 1.6);
  }

  /* ---------- 体系黏度 mPa·s ---------- */
  function solVis(st) {
    return 1 + 28 * Math.pow(st.cp / 1500, 1.6)
      * Math.exp(-0.028 * (st.temp - 45))
      * Math.exp(-0.9 * Math.log10(st.sal / 6800 + 0.1));
  }

  /* ---------- 驱油效率增量（百分点 OOIP） ---------- */
  function deltaE(st) {
    var m = MODES[st.mode];
    var vis = solVis(st);
    var mobility = 1 - Math.exp(-0.6 * (vis / st.mu));            /* 流度改善 */
    var pvGain = 1 - Math.exp(-st.pv / 0.18);                      /* 段塞波及 */
    var permGain = clamp((st.perm - 100) / 300, 0.2, 1);           /* 渗透率可达性：≥400 mD 完全可达 */
    var gain = 0.35 + 0.65 * mobility;
    if (st.mode !== 'poly') {
      var iftGain = clamp((Math.log10(22) - logIFT(st)) / 4.2, 0, 1);
      gain *= 0.55 + 0.45 * iftGain;
    }
    gain *= 0.6 + 0.4 * pvGain;
    return m.baseE * gain * permGain;
  }

  /* ---------- 单位增油成本（元/t） ---------- */
  function unitCost(st) {
    var slugVol = PVBLK * st.pv * 1e4;                             /* m³ */
    var polyT = slugVol * st.cp / 1e6;                             /* t（mg/L = g/m³） */
    var surfT = st.mode === 'poly' ? 0 : slugVol * st.cs * 1e4 / 1e6;
    var alkT = st.mode === 'asp' ? slugVol * 1.2 * 1e4 / 1e6 : 0;  /* Na₂CO₃ 1.2% */
    var fee = polyT * 22000 + surfT * 30000 + alkT * 2000;         /* 元 */
    var oil = OOIP * 1e4 * (deltaE(st) / 100) * SWEEP;             /* t */
    if (oil <= 0) return 1e9;
    return fee / oil;
  }

  function metricsOf(st) {
    var li = logIFT(st), de = deltaE(st);
    return { logI: li, ift: Math.pow(10, li), vis: solVis(st), de: de, cost: unitCost(st), score: totalScore(st.mode) };
  }

  function fmtIFT(ift) {
    var e = Math.floor(Math.log10(ift)), m = ift / Math.pow(10, e);
    return m.toFixed(1) + '×10^' + e;
  }

  /* ---------- 面板 1：雷达图（canvas，HiDPI） ---------- */
  var RADAR_AXES = null;   /* 供 hover 检测：[{x,y,label,val,unit,score}] */
  function drawRadar() {
    var W = 430, H = 300;
    var cv = $('radar'), ctx = setupCanvas(cv, W, H);
    var cx = 215, cy = 158, R = 102;
    var ds = dimScores(S.mode);
    var N = ds.length;
    var ang = function (i) { return -Math.PI / 2 + i * 2 * Math.PI / N; };
    var pt = function (i, r) { return [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r]; };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    /* 网格圈 0.2–1.0 */
    for (var g = 5; g >= 1; g--) {
      var rr = R * g / 5;
      ctx.beginPath();
      for (var i = 0; i <= N; i++) { var p = pt(i % N, rr); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
      ctx.strokeStyle = g === 3 ? '#e3d9be' : '#efece1';
      ctx.lineWidth = g === 3 ? 1.2 : 1;
      ctx.stroke();
    }
    /* 0.6 门槛圈（金色虚线） */
    ctx.beginPath();
    for (var j = 0; j <= N; j++) { var q = pt(j % N, R * 0.6); if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.setLineDash([5, 3]); ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.setLineDash([]);

    /* 轴线 */
    ctx.strokeStyle = '#e3ddcd';
    for (var k = 0; k < N; k++) { var a = pt(k, R); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.stroke(); }

    /* 数据多边形 */
    ctx.beginPath();
    for (var d = 0; d <= N; d++) {
      var s = Math.max(0.04, ds[d % N].score);
      var p2 = pt(d % N, R * s);
      if (d) ctx.lineTo(p2[0], p2[1]); else ctx.moveTo(p2[0], p2[1]);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(47,125,107,0.22)'; ctx.fill();
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 2; ctx.stroke();

    /* 顶点 */
    RADAR_AXES = [];
    for (var v = 0; v < N; v++) {
      var sv = Math.max(0.04, ds[v].score);
      var pv = pt(v, R * sv);
      ctx.beginPath(); ctx.arc(pv[0], pv[1], 3.5, 0, 6.3);
      ctx.fillStyle = '#2f7d6b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
      var tipP = pt(v, R);
      RADAR_AXES.push({ x: tipP[0], y: tipP[1], d: ds[v] });
    }

    /* 轴标签：名称 + 物性值，沿轴向外偏移 */
    ctx.font = '10px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    for (var t = 0; t < N; t++) {
      var lp = pt(t, R + 16);
      var vp = pt(t, R + 28);
      var dx = Math.cos(ang(t));
      var anchor = dx > 0.35 ? 'start' : (dx < -0.35 ? 'end' : 'center');
      ctx.textAlign = anchor;
      ctx.fillStyle = '#4d565b';
      ctx.fillText(ds[t].label, lp[0], lp[1]);
      ctx.fillStyle = '#9ba3a9';
      ctx.font = '9px Consolas,monospace';
      ctx.fillText(ds[t].val + ' ' + ds[t].unit, vp[0], vp[1]);
      ctx.font = '10px "PingFang SC","Microsoft YaHei",sans-serif';
    }

    /* 顶部注记 */
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a9298';
    ctx.font = '9.5px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(MODES[S.mode].name + ' · 综合适配分 ' + totalScore(S.mode) + ' / 100', 10, 14);
  }

  function bindRadar() {
    var cv = $('radar'), tip = $('radar-tip'), box = $('radar-box');
    cv.addEventListener('mousemove', function (evt) {
      if (!RADAR_AXES) { tip.style.display = 'none'; return; }
      var r = cv.getBoundingClientRect();
      var mx = (evt.clientX - r.left) * (430 / r.width);
      var my = (evt.clientY - r.top) * (300 / r.height);
      var best = -1, bd = 1e9;
      for (var i = 0; i < RADAR_AXES.length; i++) {
        var dx = RADAR_AXES[i].x - mx, dy = RADAR_AXES[i].y - my;
        var dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = i; }
      }
      if (best >= 0 && bd < 900) {
        var d = RADAR_AXES[best].d;
        var rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + d.label + '</b>：' + d.val + ' ' + d.unit +
          '<br>该维适配分 <b>' + d.score.toFixed(2) + '</b> / 1.00' +
          '<br><span style="color:#8a9298">' + MODES[S.mode].name + ' 准则</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 2：方式适配性矩阵 ---------- */
  function drawModes() {
    var svg = $('modes');
    var W = 430, H = 150, pl = 92, pr = 44, pt = 22, pb = 24;
    var pw = W - pl - pr;
    var rows = ['poly', 'sp', 'asp'];
    var rowH = (H - pt - pb) / rows.length;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    /* 网格 0–100 */
    for (var v = 0; v <= 100; v += 20) {
      var xx = pl + v / 100 * pw;
      s += '<line x1="' + xx + '" y1="' + pt + '" x2="' + xx + '" y2="' + (H - pb) + '" stroke="#efece1"/>';
      s += '<text x="' + xx + '" y="' + (H - pb + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
    }
    /* 60 分可行线 */
    var x60 = pl + 0.6 * pw;
    s += '<line x1="' + x60 + '" y1="' + (pt - 6) + '" x2="' + x60 + '" y2="' + (H - pb) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + x60 + '" y="' + (pt - 9) + '" font-size="8.5" fill="#c9a15a" text-anchor="middle" font-family="monospace">可行线 60</text>';

    rows.forEach(function (mk, i) {
      var m = MODES[mk], sc = totalScore(mk);
      var cy = pt + rowH * (i + 0.5);
      var bw = sc / 100 * pw;
      var sel = mk === S.mode;
      s += '<rect x="' + pl + '" y="' + (cy - 9) + '" width="' + bw.toFixed(1) + '" height="18" rx="4" fill="' + m.color + '" opacity="' + (sel ? 0.92 : 0.35) + '"' + (sel ? ' stroke="#235f51" stroke-width="1.4"' : '') + '/>';
      s += '<text x="' + (pl - 8) + '" y="' + (cy + 3.5) + '" font-size="10" fill="' + (sel ? '#235f51' : '#79828a') + '" text-anchor="end" font-weight="' + (sel ? '700' : '400') + '">' + m.name + '</text>';
      s += '<text x="' + (pl + bw + 6) + '" y="' + (cy + 3.5) + '" font-size="10" fill="' + m.color + '" font-family="monospace" font-weight="600">' + sc + '</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="8.5" fill="#5d666d" text-anchor="middle">Taber 六维加权适配分（0–100，越高越适合）</text>';
    svg.innerHTML = s;

    /* 方式取舍提示 */
    var cur = totalScore(S.mode);
    var best = 'poly', bestS = 0;
    rows.forEach(function (mk) { var v = totalScore(mk); if (v > bestS) { bestS = v; best = mk; } });
    var vd = $('mode-verdict');
    if (cur < 60) {
      vd.className = 'verdict bad';
      vd.innerHTML = '当前区块对 <b>' + MODES[S.mode].name + '</b> 适配分仅 <b>' + cur + '</b>（&lt;60 不可行）：' +
        (bestS >= 60 ? '建议改选 <b>' + MODES[best].name + '</b>（' + bestS + ' 分），或调整滑块检查越界维度。' : '三种方式均低于可行线，该油藏不宜化学驱。');
    } else if (best !== S.mode) {
      vd.className = 'verdict warn';
      vd.innerHTML = '<b>' + MODES[S.mode].name + '</b> 可行（<b>' + cur + '</b> 分），但 <b>' + MODES[best].name + '</b> 适配更优（<b>' + bestS + '</b> 分）——对比岩心驱油效率增量与药剂成本后再定稿。';
    } else {
      vd.className = 'verdict ok';
      vd.innerHTML = '<b>' + MODES[S.mode].name + '</b> 为当前最优方式（<b>' + cur + '</b> 分 ≥ 60）。进入配方级优化：调表活剂 / 聚合物浓度与段塞，平衡驱油效率与成本。';
    }
  }

  /* ---------- 面板 3：配方敏感性双曲线 ---------- */
  function drawSens() {
    var svg = $('sens');
    var W = 430, H = 200, pl = 44, pr = 44, pt = 16, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var LI_MIN = -5, LI_MAX = 2, DE_MAX = 25;

    var x = function (cs) { return pl + cs / 0.5 * pw; };
    var yI = function (li) { return pt + ph - (li - LI_MIN) / (LI_MAX - LI_MIN) * ph; };
    var yE = function (de) { return pt + ph - de / DE_MAX * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 左轴 log10 IFT 网格 */
    for (var li = LI_MIN; li <= LI_MAX; li++) {
      var yy = yI(li);
      s += '<line x1="' + pl + '" y1="' + yy + '" x2="' + (pl + pw) + '" y2="' + yy + '" stroke="' + (li === 0 ? '#e3ddcd' : '#efece1') + '"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (yy + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + li + '</text>';
    }
    /* 右轴 ΔE 刻度 */
    for (var de = 0; de <= DE_MAX; de += 5) {
      var ye = yE(de);
      s += '<text x="' + (pl + pw + 5) + '" y="' + (ye + 3) + '" font-size="8.5" fill="#7a8ba6" text-anchor="start" font-family="monospace">' + de + '</text>';
    }
    /* x 轴 表活剂浓度 */
    for (var cs = 0; cs <= 0.5; cs += 0.1) {
      var xx = x(cs);
      s += '<line x1="' + xx + '" y1="' + pt + '" x2="' + xx + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xx + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + cs.toFixed(1) + '</text>';
    }

    /* 阈值线 10⁻² / 10⁻³ */
    var y2 = yI(-2), y3 = yI(-3);
    s += '<line x1="' + pl + '" y1="' + y2 + '" x2="' + (pl + pw) + '" y2="' + y2 + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + (pl + 4) + '" y="' + (y2 - 3) + '" font-size="8.5" fill="#c9a15a" font-family="monospace">10⁻² 筛选线</text>';
    s += '<line x1="' + pl + '" y1="' + y3 + '" x2="' + (pl + pw) + '" y2="' + y3 + '" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<text x="' + (pl + 4) + '" y="' + (y3 - 3) + '" font-size="8.5" fill="#b05a51" font-family="monospace">10⁻³ 超低线</text>';

    /* 曲线（聚合物驱时 IFT 为水平线） */
    var lineI = '', lineE = '', n = 60;
    for (var i = 0; i <= n; i++) {
      var c = i / n * 0.5;
      var st = Object.assign({}, S, { cs: c });
      var li2 = logIFT(st), de2 = deltaE(st);
      lineI += (i ? 'L' : 'M') + x(c).toFixed(1) + ' ' + yI(li2).toFixed(1) + ' ';
      lineE += (i ? 'L' : 'M') + x(c).toFixed(1) + ' ' + yE(de2).toFixed(1) + ' ';
    }
    s += '<path d="' + lineI + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';
    s += '<path d="' + lineE + '" fill="none" stroke="#41699b" stroke-width="2.2"/>';

    /* 当前浓度点 */
    var m0 = metricsOf(S);
    var cx0 = x(S.cs);
    s += '<line x1="' + cx0 + '" y1="' + pt + '" x2="' + cx0 + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 3"/>';
    s += '<circle cx="' + cx0 + '" cy="' + yI(m0.logI).toFixed(1) + '" r="4.5" fill="#2f7d6b" stroke="#fff" stroke-width="1.4"/>';
    s += '<circle cx="' + cx0 + '" cy="' + yE(m0.de).toFixed(1) + '" r="4.5" fill="#41699b" stroke="#fff" stroke-width="1.4"/>';
    var labX = clamp(cx0 + 8, pl + 4, pl + pw - 108);
    s += '<rect x="' + labX + '" y="' + (yI(m0.logI) - 15) + '" width="104" height="13" rx="3" fill="#fff" stroke="#ddd6c6"/>';
    s += '<text x="' + (labX + 5) + '" y="' + (yI(m0.logI) - 5) + '" font-size="8.5" fill="#235f51" font-family="monospace">IFT ' + fmtIFT(m0.ift) + '</text>';

    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">log₁₀IFT (mN/m)</text>';
    s += '<text x="' + (pl + pw + 36) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (pl + pw + 36) + ' ' + (pt + ph / 2) + ')">ΔE (百分点)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">表活剂浓度 (%)</text>';

    svg.innerHTML = s;
  }

  /* ---------- 面板 4：指标卡 ---------- */
  function renderMetrics() {
    var m = metricsOf(S);

    var iftOK = m.ift <= 0.01, iftUltra = m.ift <= 0.001;
    $('m-ift').innerHTML = fmtIFT(m.ift) + '<small> mN/m</small>';
    $('m-ift').parentNode.className = 'mcard' + (S.mode === 'poly' ? '' : (iftUltra ? '' : (iftOK ? '' : ' warn')));

    $('m-vis').innerHTML = m.vis.toFixed(1) + '<small> mPa·s</small>';
    $('m-vis').parentNode.className = 'mcard' + (m.vis < 0.8 * S.mu ? ' warn' : '');

    $('m-de').innerHTML = m.de.toFixed(1) + '<small> 百分点</small>';
    $('m-de').parentNode.className = 'mcard' + (m.de < 12 ? ' warn' : '');

    var costOK = m.cost <= 180;
    $('m-cost').innerHTML = (m.cost > 9999 ? '>9999' : m.cost.toFixed(0)) + '<small> 元/t</small>';
    $('m-cost').parentNode.className = 'mcard' + (costOK ? '' : (m.cost <= 300 ? ' warn' : ' bad'));

    $('m-score').innerHTML = m.score + '<small> /100</small>';
    $('m-score').parentNode.className = 'mcard' + (m.score >= 60 ? '' : ' bad');
  }

  /* ---------- 面板 5：候选配方帕累托 ---------- */
  var CANDS = [], FRONT_ONLY = false, SEL = -1;

  function genCands() {
    CANDS = []; SEL = -1;
    var csList, cpList, pvList;
    if (S.mode === 'poly') {
      csList = [0];
      cpList = [800, 1200, 1600, 2000, 2400];
      pvList = [0.25, 0.3, 0.35, 0.45, 0.55];
    } else {
      csList = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
      cpList = [800, 1200, 1600, 2400];
      pvList = [S.pv];
    }
    csList.forEach(function (cs) {
      cpList.forEach(function (cp) {
        pvList.forEach(function (pv) {
          var st = Object.assign({}, S, { cs: cs, cp: cp, pv: pv });
          var mm = metricsOf(st);
          CANDS.push({ st: st, de: mm.de, cost: mm.cost, ift: mm.ift });
        });
      });
    });
    CANDS = CANDS.slice(0, 30);
    drawPareto();
  }

  function paretoFront(cands) {
    var front = [];
    for (var i = 0; i < cands.length; i++) {
      var dom = false;
      for (var j = 0; j < cands.length; j++) {
        if (i === j) continue;
        if (cands[j].cost <= cands[i].cost && cands[j].de >= cands[i].de &&
            (cands[j].cost < cands[i].cost || cands[j].de > cands[i].de)) { dom = true; break; }
      }
      if (!dom) front.push(i);
    }
    return front;
  }

  function drawPareto() {
    var svg = $('pareto');
    var W = 430, H = 240, pl = 46, pr = 14, pt = 16, pb = 32;
    var pw = W - pl - pr, ph = H - pt - pb;

    if (!CANDS.length) {
      svg.innerHTML = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>' +
        '<text x="' + (W / 2) + '" y="' + (H / 2) + '" font-size="11" fill="#9ba3a9" text-anchor="middle">点击「生成 24 个候选配方」开始排序对比</text>';
      return;
    }

    var frontSet = {};
    paretoFront(CANDS).forEach(function (i) { frontSet[i] = true; });

    var xMax = Math.ceil(Math.max.apply(null, CANDS.map(function (d) { return d.cost; })) / 100) * 100 + 50;
    var yMax = Math.ceil(Math.max.apply(null, CANDS.map(function (d) { return d.de; })) / 5) * 5 + 2;
    var xP = function (v) { return pl + v / xMax * pw; };
    var yP = function (v) { return pt + ph - v / yMax * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    var xStep = xMax <= 400 ? 100 : (xMax <= 1000 ? 200 : 500);
    for (var gx = 0; gx <= xMax; gx += xStep) {
      var xx = xP(gx);
      s += '<line x1="' + xx + '" y1="' + pt + '" x2="' + xx + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xx + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + gx + '</text>';
    }
    for (var gy = 0; gy <= yMax; gy += 5) {
      var yy = yP(gy);
      s += '<line x1="' + pl + '" y1="' + yy + '" x2="' + (pl + pw) + '" y2="' + yy + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (yy + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gy + '</text>';
    }
    /* 180 元/t 成本约束线 */
    if (180 <= xMax) {
      var xc = xP(180);
      s += '<line x1="' + xc + '" y1="' + pt + '" x2="' + xc + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1.1" stroke-dasharray="5 3"/>';
      s += '<text x="' + (xc + 3) + '" y="' + (pt + 9) + '" font-size="8.5" fill="#c9a15a" font-family="monospace">180 元/t 约束</text>';
    }
    /* 12 个百分点目标线 */
    var y12 = yP(12);
    s += '<line x1="' + pl + '" y1="' + y12 + '" x2="' + (pl + pw) + '" y2="' + y12 + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (pl + pw - 4) + '" y="' + (y12 - 3) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">ΔE ≥ 12 目标</text>';

    /* 候选点 */
    CANDS.forEach(function (d, i) {
      if (FRONT_ONLY && !frontSet[i]) return;
      var stroke = frontSet[i] ? '#c9a15a' : '#fff';
      var sw = frontSet[i] ? 2 : 1;
      if (i === SEL) { stroke = '#1a1a1a'; sw = 2.5; }
      var tip = 'Cs=' + d.st.cs + '% Cp=' + d.st.cp + 'mg/L PV=' + d.st.pv +
        '\nΔE=' + d.de.toFixed(1) + ' pp 成本=' + d.cost.toFixed(0) + ' 元/t' + (frontSet[i] ? '\n帕累托前沿' : '');
      s += '<circle data-idx="' + i + '" cx="' + xP(d.cost).toFixed(1) + '" cy="' + yP(d.de).toFixed(1) + '" r="5" fill="#2f7d6b" fill-opacity="0.8" stroke="' + stroke + '" stroke-width="' + sw + '" style="cursor:pointer"><title>' + tip + '</title></circle>';
    });
    /* 当前配方 */
    var cur = metricsOf(S);
    s += '<circle cx="' + xP(cur.cost).toFixed(1) + '" cy="' + yP(cur.de).toFixed(1) + '" r="6.5" fill="#41699b" stroke="#fff" stroke-width="1.6"><title>当前配方 ΔE=' + cur.de.toFixed(1) + ' pp 成本=' + cur.cost.toFixed(0) + ' 元/t</title></circle>';

    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">单位增油成本（元/t）</text>';
    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">驱油效率增量（百分点）</text>';

    svg.innerHTML = s;

    Array.prototype.forEach.call(svg.querySelectorAll('circle[data-idx]'), function (el) {
      el.addEventListener('click', function () {
        var d = CANDS[+el.getAttribute('data-idx')];
        if (!d) return;
        S.cs = d.st.cs; S.cp = d.st.cp; S.pv = d.st.pv;
        SEL = +el.getAttribute('data-idx');
        syncSliders();
        render();
        drawPareto();
      });
    });
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    mu: function (v) { return v + ' mPa·s'; },
    temp: function (v) { return v + ' ℃'; },
    sal: function (v) { return v + ' mg/L'; },
    perm: function (v) { return v + ' mD'; },
    depth: function (v) { return v + ' m'; },
    soi: function (v) { return v.toFixed(2); },
    cs: function (v) { return v.toFixed(2) + ' %'; },
    cp: function (v) { return v + ' mg/L'; },
    pv: function (v) { return v.toFixed(2) + ' PV'; }
  };
  var KEYS = ['mu', 'temp', 'sal', 'perm', 'depth', 'soi', 'cs', 'cp', 'pv'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
    $('s-mode').value = S.mode;
  }

  function render() {
    drawRadar();
    drawModes();
    drawSens();
    renderMetrics();
  }

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('s-mode').addEventListener('change', function () {
      S.mode = this.value;
      render();
      genCands();
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      syncSliders();
      render();
      genCands();
    });
    $('btn-gen').addEventListener('click', genCands);
    $('btn-front').addEventListener('click', function () {
      FRONT_ONLY = !FRONT_ONLY;
      this.textContent = FRONT_ONLY ? '显示全部候选' : '仅显示帕累托前沿';
      drawPareto();
    });
    $('btn-reset2').addEventListener('click', function () {
      S = Object.assign({}, DEF); SEL = -1;
      syncSliders();
      render();
      genCands();
    });
  }

  bind();
  bindRadar();
  syncSliders();
  render();
  genCands();

  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(drawRadar, 120);
  });
})();

/* ======= 真实数据来源页：文献与标准 ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(x, y, s, attrs, parent) { var t = el('text', attrs || {}, parent); t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s; return t; }

  /* ---------- 8 条来源 ---------- */
  var REFS = [
    {
      cite: 'Taber J.J., Martin F.D., Seright R.S. (1997). EOR Screening Criteria Revisited — Part 1: Introduction to Screening Criteria and Enhanced Recovery Field Projects. SPE Reservoir Engineering 12(3):189–198. SPE 35385.',
      link: 'https://www.osti.gov/biblio/5968800',
      use: '雷达图与评分卡的分段函数阈值：聚合物驱 μ&lt;150 mPa·s、T&lt;93 ℃；SP 二元 μ&lt;80、矿化度&lt;1.5 万 mg/L；ASP μ&lt;50、矿化度&lt;1 万。'
    },
    {
      cite: 'Taber J.J., Martin F.D., Seright R.S. (1997). EOR Screening Criteria Revisited — Part 2: Applications and Impact of Oil Prices. SPE Reservoir Engineering 12(3):199–205. SPE 35384.',
      link: 'https://www.semanticscholar.org/paper/ARTIFICIAL-INTELLIGENCE-SELECTION-WITH-CAPABILITY-A-Abass-Song/f4170e054a41cd6ddf8abaa5058d0b79678b69bf',
      use: '准则随油价修订的思路 → demo 把「单位增油成本 180 元/t」作为约束线而非固定阈值，随药剂价格联动。'
    },
    {
      cite: 'Dickson J.L., Leahy-Dios A., Wylie P.L. (2010). Development of Improved Hydrocarbon Recovery Screening Methodologies. SPE 129056, SPE Improved Oil Recovery Symposium, Tulsa.',
      link: 'https://content.scirp.org/pdf/oalibj_2016071415532981.pdf',
      use: '多指标加权评分与不确定性分级 → demo 的六维加权适配分（权重 0.22/0.18/…）与 60 分可行线设定。'
    },
    {
      cite: 'Raffa P., Broekhuis A.A., Picchioni F. (2016). Broaden the Application Window of Chemical EOR Processes. SPE-175510-MS, SPE Reservoir Characterisation and Simulation Conference, Abu Dhabi.',
      link: 'https://www.semanticscholar.org/paper/Recent-Technology-Developments-in-Surfactants-and-Lu-Liyanage/ccc3a851c3cae923e5c561e9f703d279720b192b',
      use: '耐盐表活剂把化学驱窗口推向高矿化度 → demo 矿化度滑块上限放到 30,000 mg/L，并在 IFT 模型中保留盐度惩罚项。'
    },
    {
      cite: 'Recent Advances in Polymer Flooding in China (2022). Processes / PMC 综述（大庆等油田矿场数据汇编）.',
      link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9608686/',
      use: '大庆工业化聚合物驱增油约 10–14% OOIP、高浓度聚合物岩心 IORF +10% → 驱油效率模型中聚合物驱基准 11 个百分点的校准。'
    },
    {
      cite: 'Hirasaki G.J., Pope G.A. (1974). Analysis of Factors Influencing Mobility and Adsorption in the Flow of Polymer Solution Through Porous Media. SPE 4736, SPE Journal.',
      link: 'https://onepetro.org/SPEAPOG/proceedings-abstract/04APOGCE/04APOGCE/70948',
      use: '流度比 M = μ_o/μ_溶液 控制波及效率 → demo 流度增益项 1−e^(−0.6·μ/μ_o) 与黏度模型（浓度^1.6、温度/盐度衰减）。'
    },
    {
      cite: 'SY/T 6575-2016《油田提高采收率方法筛选技术规范》（国家能源局，2016-06-01 实施）.',
      link: 'https://www.ntbiaozhun.com/standard_toStandardDeatil.do?id=C1F8CA4E9D0048DBAFB81244B52D54AE',
      use: '国内行业筛选口径：黏度/温度/矿化度/渗透率/深度/含油饱和度六维 → demo 雷达图六轴与滑块维度直接对齐该规范。'
    },
    {
      cite: 'Sheng J.J. (2011). Modern Chemical Enhanced Oil Recovery: Theory and Practice. Elsevier / Gulf Professional Publishing.',
      link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6742392/',
      use: '毛细管数 Nc 与残余油饱和度关系：IFT 须降至 10⁻³ mN/m 量级才显著动用残余油 → demo 10⁻² 筛选线与 10⁻³ 超低线的标注依据。'
    }
  ];

  /* ---------- 图 A 数据：采收率增量文献对比 ---------- */
  var EORDATA = [
    { name: '大庆聚合物驱矿场', val: 12, range: '10–14', kind: '矿场', src: 'PMC9608686 综述', note: '工业化规模，受波及不均与吸附滞留影响低于岩心' },
    { name: 'Poison Spider ASP 矿场', val: 18.1, range: '18.1', kind: '矿场', src: 'science.gov 专题汇编', note: '水驱 46.4% 后 ASP 再增 18.1% OIP，累计 64.6% OOIP' },
    { name: '高浓度 HPAM 岩心', val: 20, range: '>20', kind: '岩心', src: 'SPE 70948 (APOGCE 2004)', note: 'HPAM 浓度与黏度越高增量越大，黄原胶仅 8.6%' },
    { name: '弱碱 ASP 岩心', val: 23.4, range: '23.4', kind: '岩心', src: 'Hindawi IJPS 2017', note: 'Na₂CO₃ 0.6% 时 IFT 降至 10⁻² mN/m，EOR 18.7→23.4%' },
    { name: '天然羧酸盐 ASP 岩心', val: 26.8, range: '26.8', kind: '岩心', src: 'Chen et al. 2003', note: '正交设计筛选体系，岩心驱替 +26.8% OOIP' }
  ];
  var selA = -1;

  /* ---------- 图 B 数据：IFT 文献平台值 ---------- */
  var IFTDATA = [
    { name: 'SP 二元', val: 4.12e-3, src: 'PMC6742392 (2019)' },
    { name: '弱碱 ASP', val: 3.01e-3, src: 'PMC6742392 (2019)' },
    { name: '强碱 ASP', val: 4.76e-3, src: 'PMC6742392 (2019)' }
  ];

  var PL = 60, PR = 20;

  function drawA() {
    var svg = $('lit-chartA'); if (!svg) return;
    var W = 900, H = 260, PT = 34, PB = 58, plotW = W - PL - PR, plotH = H - PT - PB;
    var Y1 = 30;
    function yOf(v) { return PT + (Y1 - v) / Y1 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var m = 0; m <= Y1; m += 5) {
      var y = yOf(m);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: m ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, m + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    txt(16, PT + plotH / 2, '采收率增量 (%OOIP)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 16 ' + (PT + plotH / 2) + ')' }, svg);
    /* 目标带：聚合物 10–14，化学复合驱 ≥15 */
    el('rect', { x: PL, y: yOf(14), width: plotW, height: yOf(10) - yOf(14), fill: '#2f7d6b', opacity: 0.06 }, svg);
    var y12 = yOf(12);
    el('line', { x1: PL, y1: y12, x2: W - PR, y2: y12, stroke: '#b05a51', 'stroke-width': 1.1, 'stroke-dasharray': '5 3' }, svg);
    txt(W - PR - 4, PT - 8, '红虚线：本案例 ΔE ≥ 12 目标', { 'font-size': 9, fill: '#b05a51', 'text-anchor': 'end' }, svg);

    var bw = 110;
    EORDATA.forEach(function (d, i) {
      var cx = PL + plotW * (i + 0.5) / EORDATA.length;
      var y = yOf(d.val), sel = selA === i;
      var fill = d.kind === '矿场' ? '#2f7d6b' : '#41699b';
      el('rect', { x: cx - bw / 2, y: y, width: bw, height: PT + plotH - y, rx: 3, fill: fill, opacity: sel ? 1 : 0.7, stroke: sel ? '#1d4a3f' : 'none', 'stroke-width': sel ? 2 : 0 }, svg);
      txt(cx, y - 16, d.range + ' %OOIP', { 'font-size': 9, fill: '#79828a', 'text-anchor': 'middle' }, svg);
      txt(cx, y - 3, d.kind, { 'font-size': 9.5, fill: sel ? '#1d4a3f' : fill, 'text-anchor': 'middle', 'font-weight': sel ? 700 : 400 }, svg);
      var words = d.name.split(' ');
      if (words.length > 2) {
        txt(cx, PT + plotH + 14, words.slice(0, -1).join(' '), { 'font-size': 9, fill: '#79828a', 'text-anchor': 'middle' }, svg);
        txt(cx, PT + plotH + 25, words[words.length - 1], { 'font-size': 9, fill: '#79828a', 'text-anchor': 'middle' }, svg);
      } else {
        txt(cx, PT + plotH + 16, d.name, { 'font-size': 9, fill: '#79828a', 'text-anchor': 'middle' }, svg);
      }
    });
    txt(PL + 4, 16, '绿=矿场试验 · 蓝=岩心驱替 · 悬停读数 / 点击锁定', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function drawB() {
    var svg = $('lit-chartB'); if (!svg) return;
    var W = 900, H = 240, PT = 24, PB = 40, plotW = W - PL - PR, plotH = H - PT - PB;
    var LI_MIN = -3.2, LI_MAX = 1.5;
    function yOf(li) { return PT + (LI_MAX - li) / (LI_MAX - LI_MIN) * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var li = -3; li <= 1; li++) {
      var y = yOf(li);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: li === 0 ? '#d8d0bc' : '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, '10^' + li, { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    txt(16, PT + plotH / 2, '平衡界面张力 (mN/m)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 16 ' + (PT + plotH / 2) + ')' }, svg);
    /* 超低张力带 ≤10⁻² */
    el('rect', { x: PL, y: yOf(-2), width: plotW, height: PT + plotH - yOf(-2), fill: '#c9a15a', opacity: 0.08 }, svg);
    el('line', { x1: PL, y1: yOf(-2), x2: W - PR, y2: yOf(-2), stroke: '#c9a15a', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }, svg);
    txt(PL + 4, yOf(-2) - 5, '10⁻² 筛选线', { 'font-size': 9, fill: '#9a7a1c' }, svg);
    el('line', { x1: PL, y1: yOf(-3), x2: W - PR, y2: yOf(-3), stroke: '#b05a51', 'stroke-width': 1.1, 'stroke-dasharray': '4 3' }, svg);
    txt(W - PR - 4, yOf(-3) + 12, '10⁻³ 超低线', { 'font-size': 9, fill: '#b05a51', 'text-anchor': 'end' }, svg);

    /* demo 模型曲线（默认二元工况，x=表活剂浓度 0–0.5%） */
    var d = '';
    for (var i = 0; i <= 60; i++) {
      var cs = i / 60 * 0.5;
      var li2 = Math.log10(22) - 4.2 * (1 - Math.exp(-cs / 0.08));
      d += (i ? 'L' : 'M') + (PL + cs / 0.5 * plotW).toFixed(1) + ' ' + yOf(li2).toFixed(1) + ' ';
    }
    el('path', { d: d, fill: 'none', stroke: '#2f7d6b', 'stroke-width': 2.2 }, svg);
    txt(PL + 8, PT + 12, '绿线：本 demo 配方模型（默认二元工况）· 点为文献实测平台值（PMC6742392）', { 'font-size': 9, fill: '#8a9298' }, svg);

    /* 文献点：放在各自体系典型表活剂浓度位置 */
    var xs = { 'SP 二元': 0.15, '弱碱 ASP': 0.3, '强碱 ASP': 0.45 };
    IFTDATA.forEach(function (p) {
      var px = PL + xs[p.name] / 0.5 * plotW;
      var py = yOf(Math.log10(p.val));
      el('circle', { cx: px, cy: py, r: 6.5, fill: '#b05a51', opacity: 0.9, stroke: '#fdfcf8', 'stroke-width': 1.4 }, svg);
      txt(px, py - 11, p.name, { 'font-size': 9.5, fill: '#8a5a52', 'text-anchor': 'middle', 'font-weight': 600 }, svg);
      txt(px, py + 19, p.val.toExponential(2) + ' mN/m', { 'font-size': 9, fill: '#8a5a52', 'text-anchor': 'middle' }, svg);
    });

    for (var cs2 = 0; cs2 <= 0.5; cs2 += 0.1) {
      txt(PL + cs2 / 0.5 * plotW, PT + plotH + 14, cs2.toFixed(1), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 6, '表活剂浓度 (%)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
  }

  /* ---------- 交互 ---------- */
  function renderDetail() {
    var d = $('lit-detail'); if (!d) return;
    if (selA >= 0) {
      var p = EORDATA[selA];
      d.className = 'r-detail active';
      d.innerHTML = '<b>' + p.name + '</b>（' + p.src + '）：采收率增量 <b>' + p.range + '% OOIP</b>，' + p.kind + '尺度。' + p.note + '。';
    } else {
      d.className = 'r-detail';
      d.innerHTML = '悬停读取柱条；点击锁定该条文献数据；点击下表行同样联动。要点：<b>矿场增量（10–18%）系统性低于岩心（20–27%）</b>，差值来自波及不均、吸附滞留与剪切降解——demo 驱油效率模型中的波及系数 0.62 即对应这一折减。';
    }
  }

  function syncTable() {
    var rows = document.querySelectorAll('#lit-body tr');
    rows.forEach(function (r) { r.classList.remove('sel'); });
    if (selA >= 0) {
      var idx = REFS.length - 5 + 0; /* 表最后 5 行对应图 A */
      var rowIdx = rows.length - EORDATA.length + selA;
      if (rows[rowIdx]) rows[rowIdx].classList.add('sel');
    }
  }

  function selectA(i) { selA = i; drawA(); renderDetail(); syncTable(); }

  function bindChartA() {
    var svg = $('lit-chartA'), tip = $('lit-tipA'), box = $('lit-boxA');
    if (!svg || !tip || !box) return;
    var W = 900;
    function barAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var k = Math.floor((vx - PL) / (W - PL - PR) * EORDATA.length);
      return (k >= 0 && k < EORDATA.length) ? k : -1;
    }
    svg.addEventListener('mousemove', function (evt) {
      var k = barAt(evt);
      if (k >= 0) {
        var d = EORDATA[k], rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + d.name + '</b><br>增量 <b>' + d.range + ' %OOIP</b>（' + d.kind + '）<br><span style="color:#8a9298">' + d.src + ' · 点击锁定</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    svg.addEventListener('click', function (evt) { selectA(barAt(evt)); });
  }

  function renderRefs() {
    var box = $('ref-list'); if (!box) return;
    REFS.forEach(function (r, i) {
      var card = document.createElement('div');
      card.className = 'ref-card';
      card.innerHTML = '<span class="no">' + (i + 1) + '</span><div class="body"><div class="cite">' + r.cite +
        ' <a href="' + r.link + '" target="_blank" rel="noopener">链接↗</a></div><div class="use"><b>用途：</b>' + r.use + '</div></div>';
      box.appendChild(card);
    });
  }

  function bindTable() {
    var body = $('lit-body'); if (!body) return;
    var rows = [];
    REFS.forEach(function (r, i) {
      rows.push({ html: '<td class="num">' + (i + 1) + '</td><td>' + r.cite.split('.')[0].split(',')[0] + '</td><td>' + r.use.split('：')[0].substring(0, 34) + '…</td><td>' + r.use + '</td>' });
    });
    /* 追加图 A 的 5 条数据行，与柱条联动 */
    EORDATA.forEach(function (d, i) {
      rows.push({
        html: '<td class="num">' + (REFS.length + i + 1) + '</td><td>' + d.src + '</td><td>' + d.name + '：+' + d.range + ' %OOIP（' + d.kind + '）</td><td>' + d.note + '，用于校准 demo 驱油效率基准与波及折减</td>',
        click: function () { selectA(i); }
      });
    });
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = r.html;
      if (r.click) tr.addEventListener('click', r.click);
      body.appendChild(tr);
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
        if (id === 'real') { drawA(); drawB(); }
      });
    });
  }

  bindTabs(); renderRefs(); bindChartA(); bindTable();
  drawA(); drawB(); renderDetail();
})();
