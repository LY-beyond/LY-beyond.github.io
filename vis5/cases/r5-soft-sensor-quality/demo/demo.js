/* ======= 柴油质量指标在线软测量 ======= */
(function () {
  'use strict';

  var N = 720;              // 2 min / 点
  var HOURS = 24;
  var STEP = HOURS / N;
  var FP_LOW = 55, FP_HIGH = 62;

  var PARAMS = [
    { id: 'temp', label: '反应温度', unit: '℃', min: 335, max: 375, step: 1, value: 355 },
    { id: 'h2', label: '氢分压', unit: 'MPa', min: 6.0, max: 8.5, step: 0.1, value: 7.2 },
    { id: 'cut', label: '分馏切割点', unit: '℃', min: 255, max: 285, step: 1, value: 268 },
    { id: 'load', label: '装置负荷', unit: '%', min: 70, max: 110, step: 1, value: 100 },
    { id: 'lag', label: '化验滞后', unit: 'h', min: 1, max: 6, step: 0.5, value: 4 },
    { id: 'margin', label: '控制余量', unit: '℃', min: 1, max: 6, step: 0.5, value: 5 },
    { id: 'switch', label: '工况切换', unit: '', kind: 'toggle', labels: ['稳定', '切换中'], min: 0, max: 1, step: 1, value: 0 },
    { id: 'calib', label: '保形校准', unit: '', kind: 'toggle', labels: ['关闭', '开启'], min: 0, max: 1, step: 1, value: 1 },
    { id: 'model', label: '软测量模型', unit: '', kind: 'toggle', labels: ['关闭', '开启'], min: 0, max: 1, step: 1, value: 1 }
  ];

  var DEFAULTS = {};
  PARAMS.forEach(function (p) { DEFAULTS[p.id] = p.value; });
  var S = {};
  Object.keys(DEFAULTS).forEach(function (k) { S[k] = DEFAULTS[k]; });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function hhmm(h) {
    var hh = Math.floor(h + 1e-9);
    var mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh += 1; mm = 0; }
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* ================= 仿真：过程变量 → 真值 → 软测量 ================= */
  function simulate(st) {
    var rnd = mulberry32(20261031);
    var i, h;

    var temp = new Float64Array(N), cut = new Float64Array(N);
    var fpTrue = new Float64Array(N);
    var p50 = new Float64Array(N), p10 = new Float64Array(N), p90 = new Float64Array(N);
    var hasModel = !!st.model;

    for (i = 0; i < N; i++) {
      h = i * STEP;
      temp[i] = st.temp + 2.2 * Math.sin(2 * Math.PI * h / 6.4 + 0.4) + gauss(rnd) * 0.5;
      cut[i] = st.cut + 2.6 * Math.sin(2 * Math.PI * h / 5.1 + 1.3) + gauss(rnd) * 0.4;

      var drift = 0.45 * Math.sin(2 * Math.PI * h / 9 + 0.6) + 0.30 * Math.sin(2 * Math.PI * h / 4.3 + 2.1);
      var bump = st.switch ? 2.2 * Math.exp(-Math.pow((h - 9.5) / 1.15, 2)) : 0;

      fpTrue[i] = 57 + 0.22 * (st.cut - 268) + 0.05 * (st.temp - 355) + 0.06 * (st.load - 100)
        + drift + bump + gauss(rnd) * 0.12;

      if (hasModel) {
        var sg = 0.55 + 0.18 * (st.lag - 1) + (st.switch ? 0.95 * Math.exp(-Math.pow((h - 10.5) / 1.6, 2)) : 0);
        p50[i] = fpTrue[i] + 0.25 * Math.sin(2 * Math.PI * h / 7 + 2) + gauss(rnd) * sg;
        var w = st.calib ? 1.28 * sg : 1.15;
        p10[i] = p50[i] - w;
        p90[i] = p50[i] + w;
      }
    }

    // 化验样本：每 8 h 一次，报出滞后 st.lag 小时
    var labs = [1, 9, 17].map(function (sampleH) {
      var idx = Math.round(sampleH / STEP);
      return {
        idx: idx, sampleH: sampleH, resultH: sampleH + st.lag,
        val: fpTrue[idx] + gauss(rnd) * 0.7
      };
    });

    // 指标
    var mae = null, cov = null, inCtrl = 0;
    if (hasModel) {
      var sumAbs = 0, inBand = 0;
      for (i = 0; i < N; i++) {
        sumAbs += Math.abs(p50[i] - fpTrue[i]);
        if (fpTrue[i] >= p10[i] && fpTrue[i] <= p90[i]) inBand++;
      }
      mae = sumAbs / N;
      cov = inBand / N * 100;
    }
    for (i = 0; i < N; i++) if (fpTrue[i] >= FP_LOW && fpTrue[i] <= FP_HIGH) inCtrl++;

    return {
      temp: temp, cut: cut, fpTrue: fpTrue,
      p50: p50, p10: p10, p90: p90,
      labs: labs, hasModel: hasModel,
      mae: mae, cov: cov, pass: inCtrl / N * 100,
      delay: hasModel ? 0 : st.lag
    };
  }

  /* ================= 绘图 ================= */
  function drawTrend(st, d) {
    var svg = document.getElementById('trend');
    var W = 430, H = 170, padL = 34, padR = 34, padT = 14, padB = 20;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    function xOf(h) { return padL + h / HOURS * plotW; }
    function yT(v) { return padT + (1 - (v - 335) / 40) * plotH; }
    function yC(v) { return padT + (1 - (v - 255) / 30) * plotH; }

    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';

    if (st.switch) {
      s += '<rect x="' + xOf(9) + '" y="' + padT + '" width="' + (xOf(11) - xOf(9)) + '" height="' + plotH + '" fill="rgba(201,161,90,0.12)"/>';
      s += '<text x="' + ((xOf(9) + xOf(11)) / 2) + '" y="' + (padT + 10) + '" font-size="8" fill="#a97a1c" text-anchor="middle">切换</text>';
    }

    [340, 350, 360, 370].forEach(function (v) {
      var y = yT(v);
      s += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + plotW) + '" y2="' + y + '" stroke="#ece7d8"/>';
      s += '<text x="' + (padL - 5) + '" y="' + (y + 3) + '" font-size="7.5" fill="#2f7d6b" text-anchor="end" font-family="monospace">' + v + '</text>';
    });
    [260, 270, 280].forEach(function (v) {
      var y = yC(v);
      s += '<text x="' + (padL + plotW + 5) + '" y="' + (y + 3) + '" font-size="7.5" fill="#c9a15a" text-anchor="start" font-family="monospace">' + v + '</text>';
    });
    [0, 6, 12, 18, 24].forEach(function (h) {
      var x = xOf(h);
      s += '<text x="' + x + '" y="' + (H - 7) + '" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + h + '</text>';
    });

    var pathT = '', pathC = '';
    for (var i = 0; i < N; i += 3) {
      pathT += (i ? 'L' : 'M') + xOf(i * STEP).toFixed(1) + ' ' + yT(d.temp[i]).toFixed(1) + ' ';
      pathC += (i ? 'L' : 'M') + xOf(i * STEP).toFixed(1) + ' ' + yC(d.cut[i]).toFixed(1) + ' ';
    }
    s += '<path d="' + pathT + '" fill="none" stroke="#2f7d6b" stroke-width="1.6"/>';
    s += '<path d="' + pathC + '" fill="none" stroke="#c9a15a" stroke-width="1.3" stroke-dasharray="5 3"/>';

    s += '<text x="' + padL + '" y="' + (padT - 4) + '" font-size="7.5" fill="#2f7d6b" font-family="monospace">反应温度 ℃</text>';
    s += '<text x="' + (padL + plotW) + '" y="' + (padT - 4) + '" font-size="7.5" fill="#c9a15a" text-anchor="end" font-family="monospace">切割点 ℃</text>';
    s += '<text x="' + (padL + plotW / 2) + '" y="' + (H - 1) + '" font-size="8" fill="#9ba3a9" text-anchor="middle">时刻 h</text>';

    svg.innerHTML = s;
  }

  function drawQuality(st, d) {
    var svg = document.getElementById('quality');
    var W = 430, H = 210, padL = 34, padR = 12, padT = 12, padB = 22;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    var lo = 54.5, hi = 62.5;
    for (var i = 0; i < N; i++) {
      lo = Math.min(lo, d.fpTrue[i]);
      hi = Math.max(hi, d.fpTrue[i]);
      if (d.hasModel) { lo = Math.min(lo, d.p10[i]); hi = Math.max(hi, d.p90[i]); }
    }
    lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5);
    if (hi - lo < 4) hi = lo + 4;

    function xOf(h) { return padL + h / HOURS * plotW; }
    function yOf(v) { return padT + (1 - (clamp(v, lo, hi) - lo) / (hi - lo)) * plotH; }

    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';

    // 内控窗口
    s += '<rect x="' + padL + '" y="' + yOf(FP_HIGH) + '" width="' + plotW + '" height="' + Math.max(0, yOf(FP_LOW) - yOf(FP_HIGH)) + '" fill="rgba(47,125,107,0.10)"/>';

    // 操作控制目标（下限 + 余量），余量越大越保守
    var tgt = FP_LOW + st.margin;
    if (tgt < hi) {
      s += '<line x1="' + padL + '" y1="' + yOf(tgt) + '" x2="' + (padL + plotW) + '" y2="' + yOf(tgt) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="2 3" opacity="0.85"/>';
      s += '<text x="' + (padL + 4) + '" y="' + (yOf(tgt) - 3) + '" font-size="7.5" fill="#a97a1c" font-family="monospace">控制目标 ≥' + tgt.toFixed(1) + '</text>';
    }

    // 网格与纵轴
    var step = hi - lo <= 4 ? 1 : hi - lo <= 8 ? 2 : 4;
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      var y = yOf(v);
      s += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + plotW) + '" y2="' + y + '" stroke="#ece7d8"/>';
      s += '<text x="' + (padL - 5) + '" y="' + (y + 3) + '" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    }
    [0, 6, 12, 18, 24].forEach(function (h) {
      var x = xOf(h);
      s += '<text x="' + x + '" y="' + (H - 7) + '" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + h + '</text>';
    });

    // 上下限
    s += '<line x1="' + padL + '" y1="' + yOf(FP_LOW) + '" x2="' + (padL + plotW) + '" y2="' + yOf(FP_LOW) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + (padL + plotW - 4) + '" y="' + (yOf(FP_LOW) - 3) + '" font-size="7.5" fill="#b05a51" text-anchor="end" font-family="monospace">下限 55</text>';
    s += '<line x1="' + padL + '" y1="' + yOf(FP_HIGH) + '" x2="' + (padL + plotW) + '" y2="' + yOf(FP_HIGH) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + (padL + plotW - 4) + '" y="' + (yOf(FP_HIGH) - 3) + '" font-size="7.5" fill="#a97a1c" text-anchor="end" font-family="monospace">内控 62</text>';

    // 真值
    var pathT = '';
    for (var i2 = 0; i2 < N; i2 += 3) pathT += (i2 ? 'L' : 'M') + xOf(i2 * STEP).toFixed(1) + ' ' + yOf(d.fpTrue[i2]).toFixed(1) + ' ';
    s += '<path d="' + pathT + '" fill="none" stroke="#242b2e" stroke-width="1.1" stroke-dasharray="3 2" opacity="0.75"/>';

    if (d.hasModel) {
      // P10—P90 区间
      var band = '';
      for (var i3 = 0; i3 < N; i3 += 3) band += (i3 ? 'L' : 'M') + xOf(i3 * STEP).toFixed(1) + ' ' + yOf(d.p90[i3]).toFixed(1) + ' ';
      for (var i4 = N - 1; i4 >= 0; i4 -= 3) band += 'L' + xOf(i4 * STEP).toFixed(1) + ' ' + yOf(d.p10[i4]).toFixed(1) + ' ';
      s += '<path d="' + band + 'Z" fill="rgba(47,125,107,0.18)" stroke="none"/>';

      var pathP = '';
      for (var i5 = 0; i5 < N; i5 += 3) pathP += (i5 ? 'L' : 'M') + xOf(i5 * STEP).toFixed(1) + ' ' + yOf(d.p50[i5]).toFixed(1) + ' ';
      s += '<path d="' + pathP + '" fill="none" stroke="#2f7d6b" stroke-width="1.6"/>';
    } else {
      s += '<text x="' + (padL + plotW / 2) + '" y="' + (padT + 24) + '" font-size="9.5" fill="#b05a51" text-anchor="middle">软测量关闭：只能看到滞后报出的化验点</text>';
    }

    // 化验点：采样（空心）→ 报出（实心）
    d.labs.forEach(function (lab) {
      var x0 = xOf(lab.sampleH), y0 = yOf(lab.val);
      var x1 = xOf(Math.min(HOURS, lab.resultH)), y1 = y0;
      s += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="3 2"/>';
      s += '<circle cx="' + x0 + '" cy="' + y0 + '" r="3" fill="#fdfcf8" stroke="#c9a15a" stroke-width="1.4"/>';
      s += '<circle cx="' + x1 + '" cy="' + y1 + '" r="3.2" fill="#c9a15a"/>';
      s += '<text x="' + (x0 + 5) + '" y="' + (y0 - 6) + '" font-size="7.5" fill="#a97a1c" font-family="monospace">' + lab.val.toFixed(1) + '</text>';
    });

    s += '<text x="' + (padL + plotW / 2) + '" y="' + (H - 1) + '" font-size="8" fill="#9ba3a9" text-anchor="middle">时刻 h</text>';
    s += '<text x="' + padL + '" y="' + (padT - 3) + '" font-size="7.5" fill="#9ba3a9" font-family="monospace">闪点 ℃</text>';

    svg.innerHTML = s;
  }

  function drawAttrib(st) {
    var svg = document.getElementById('attrib');
    var W = 430, H = 160, padL = 96, padR = 16, padT = 12, padB = 18;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    var items = [
      { name: '分馏切割点', v: 0.22 * (st.cut - 268) },
      { name: '反应温度', v: 0.05 * (st.temp - 355) },
      { name: '装置负荷', v: 0.06 * (st.load - 100) },
      { name: '原料切换', v: st.switch ? 0.9 : 0 },
      { name: '环境 / 催化剂漂移', v: 0.4 }
    ];
    var maxAbs = 0.5;
    items.forEach(function (it) { maxAbs = Math.max(maxAbs, Math.abs(it.v)); });

    var zeroX = padL + 8 + (plotW - 16) / 2;
    var halfW = (plotW - 16) / 2;
    var rowH = plotH / items.length;

    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';
    s += '<line x1="' + zeroX + '" y1="' + padT + '" x2="' + zeroX + '" y2="' + (padT + plotH) + '" stroke="#c9c3b4"/>';

    items.forEach(function (it, i) {
      var cy = padT + rowH * (i + 0.5);
      var w = Math.abs(it.v) / maxAbs * (halfW - 4);
      var x = it.v >= 0 ? zeroX : zeroX - w;
      var color = it.v >= 0 ? '#b05a51' : '#2f7d6b';
      s += '<rect x="' + x + '" y="' + (cy - 4) + '" width="' + Math.max(1, w) + '" height="8" rx="2" fill="' + color + '" opacity="0.82"/>';
      s += '<text x="' + (padL - 2) + '" y="' + (cy + 3) + '" font-size="8" fill="#4d565b" text-anchor="end">' + it.name + '</text>';
      s += '<text x="' + (it.v >= 0 ? x + w + 3 : x - 3) + '" y="' + (cy + 3) + '" font-size="7.5" fill="' + color + '" font-family="monospace" text-anchor="' + (it.v >= 0 ? 'start' : 'end') + '">' + (it.v >= 0 ? '+' : '') + it.v.toFixed(2) + '</text>';
    });
    s += '<text x="' + zeroX + '" y="' + (H - 4) + '" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">贡献 ℃（相对 57 ℃ 基准）</text>';

    svg.innerHTML = s;
  }

  function drawMetrics(d) {
    var maeEl = document.getElementById('m-mae');
    maeEl.textContent = d.mae === null ? '—' : d.mae.toFixed(2) + ' ℃';
    var maeW = document.getElementById('m-mae-wrap');
    maeW.className = 'metric' + (d.mae !== null && d.mae > 1.5 ? ' warn' : '');

    var covEl = document.getElementById('m-cov');
    covEl.textContent = d.cov === null ? '—' : d.cov.toFixed(0) + '%';
    var covW = document.getElementById('m-cov-wrap');
    covW.className = 'metric' + (d.cov !== null && d.cov < 75 ? ' bad' : '');

    var delEl = document.getElementById('m-delay');
    delEl.textContent = d.hasModel ? '0 min' : d.delay + ' h';
    delEl.parentElement.className = 'metric' + (d.hasModel ? '' : ' bad');

    var passEl = document.getElementById('m-pass');
    passEl.textContent = d.pass.toFixed(0) + '%';
    passEl.parentElement.className = 'metric' + (d.pass < 95 ? ' warn' : '');
  }

  function drawLabs(d) {
    var tbody = document.getElementById('lab-body');
    var html = '';
    d.labs.forEach(function (lab, i) {
      var p50 = d.hasModel ? d.p50[lab.idx] : null;
      var err = p50 === null ? null : p50 - lab.val;
      var covered = d.hasModel ? (lab.val >= d.p10[lab.idx] && lab.val <= d.p90[lab.idx]) : null;
      html += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td class="mono">' + hhmm(lab.sampleH) + '</td>' +
        '<td class="mono">' + lab.val.toFixed(1) + '</td>' +
        '<td class="mono">' + hhmm(lab.resultH) + '</td>' +
        '<td class="mono">' + (p50 === null ? '—' : p50.toFixed(1)) + '</td>' +
        '<td class="mono">' + (err === null ? '—' : (err >= 0 ? '+' : '') + err.toFixed(2)) + '</td>' +
        '<td class="' + (covered === null ? '' : covered ? 'ok' : 'no') + '">' + (covered === null ? '—' : covered ? '✓' : '✗') + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }

  /* ================= 对比面板 ================= */
  function renderCompare() {
    var rec = simulate(Object.assign({}, S, { model: 1, margin: 2 }));
    var base = 5;   // 基准：化验 + 5 ℃ 安全余量
    var tight = base - S.margin;                       // 收窄的余量
    var curYield = Math.max(0, tight * 0.25);          // 卡边多出的收率（pp）
    var curRe = 2.6 * Math.pow(base / Math.max(1, S.margin), 0.55);  // 无实时值，余量越小回炼越多
    var recYield = rec.cov !== null && rec.cov >= 75 ? 0.75 : 0;
    var recRe = recYield ? 0.9 : 2.6;

    var head = document.getElementById('c-cur-head');
    if (head) head.textContent = '当前（化验 + ' + S.margin + ' ℃ 余量）';

    document.getElementById('c-cur-delay').textContent = S.lag + ' h';
    document.getElementById('c-cur-cov').textContent = '—';
    document.getElementById('c-cur-yield').textContent = curYield.toFixed(2) + ' pp';
    document.getElementById('c-cur-re').textContent = curRe.toFixed(1) + ' 次';

    document.getElementById('c-rec-delay').textContent = '0 min';
    document.getElementById('c-rec-cov').textContent = rec.cov === null ? '—' : rec.cov.toFixed(0) + '%';
    document.getElementById('c-rec-yield').textContent = recYield.toFixed(2) + ' pp';
    document.getElementById('c-rec-re').textContent = recRe.toFixed(1) + ' 次';
  }

  /* ================= 控件与主循环 ================= */
  function outText(p) {
    if (p.kind === 'toggle') return p.labels[S[p.id] ? 1 : 0];
    return String(S[p.id]);
  }

  function buildControls() {
    var wrap = document.getElementById('controls');
    wrap.innerHTML = PARAMS.map(function (p) {
      return '<div class="ctl">' +
        '<div class="ctl-top"><label>' + p.label + (p.unit ? ' (' + p.unit + ')' : '') + '</label>' +
        '<output id="o-' + p.id + '">' + outText(p) + '</output></div>' +
        '<input type="range" id="s-' + p.id + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + p.value + '">' +
        '</div>';
    }).join('');

    PARAMS.forEach(function (p) {
      var el = document.getElementById('s-' + p.id);
      var out = document.getElementById('o-' + p.id);
      el.addEventListener('input', function (e) {
        S[p.id] = +e.target.value;
        out.textContent = outText(p);
        run();
      });
    });
  }

  function syncControls() {
    PARAMS.forEach(function (p) {
      var el = document.getElementById('s-' + p.id);
      var out = document.getElementById('o-' + p.id);
      if (el) { el.value = S[p.id]; out.textContent = outText(p); }
    });
  }

  function run() {
    var d = simulate(S);
    drawTrend(S, d);
    drawQuality(S, d);
    drawAttrib(S);
    drawMetrics(d);
    drawLabs(d);
    renderCompare();
    var lagTxt = document.getElementById('lag-txt');
    if (lagTxt) lagTxt.textContent = S.lag;
  }

  function applyRecommended() {
    S.model = 1; S.calib = 1; S.margin = 2;
    syncControls();
    run();
  }

  buildControls();
  run();

  document.getElementById('btn-apply-rec').addEventListener('click', applyRecommended);
  document.getElementById('btn-cur').addEventListener('click', renderCompare);
})();
