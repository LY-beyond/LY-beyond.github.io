/* ======= LIMS 化验数据智能审核 · 可运行示范 ======= */
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

  /* ---------- 伪随机数（可复现，换批按钮换种子） ---------- */
  var SEED = 20261101;
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(SEED);
  function randn() {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function normCdf(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x));
    var d = 0.3989422804 * Math.exp(-x * x / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.8212560 + t * 1.3302744))));
    return x > 0 ? 1 - p : p;
  }

  /* ---------- 方法精密度（按标准口径折算，σ = r / 2.77） ---------- */
  var R_LIM = { dens: 0.6, dist: 3.5, sulf: 1.5, pour: 2.0, flash: 2.5 }; /* r */
  var QC_NOMINAL = 837.5;                    /* 柴油 QC 标样密度标称值 kg/m³ */
  var QC_SIGMA = R_LIM.dens / 2.77;

  var DEF = { dup: 1.0, drift: 1.2, noise: 1.0, thr: 3.0, err: 3 };
  var S = Object.assign({}, DEF);
  var DAILY = 2400, BATCH = 12, SCALE = DAILY / BATCH, QC_N = 30;

  /* ---------- 批次数据生成 ---------- */
  /* QC 控制图：连续 30 批质控样密度，含线性漂移与随机噪声 */
  function genQC() {
    var pts = [];
    for (var i = 0; i < QC_N; i++) {
      var drift = S.drift * QC_SIGMA * (i / (QC_N - 1));
      var x = QC_NOMINAL + drift + S.noise * QC_SIGMA * randn();
      pts.push({ i: i + 1, x: x, z: (x - QC_NOMINAL) / QC_SIGMA });
    }
    return pts;
  }

  /* 平行样：40 对密度平行测定，偏差以 r 归一化 */
  function genDup() {
    var arr = [];
    for (var i = 0; i < 40; i++) {
      var d = (S.dup * R_LIM.dens * randn() + S.noise * 0.3 * R_LIM.dens * randn());
      arr.push(Math.abs(d) / R_LIM.dens);
    }
    return arr;
  }

  /* 化验单：12 单车用柴油，含录入错误与逻辑矛盾注入 */
  function genSheet() {
    var rows = [];
    for (var i = 0; i < BATCH; i++) {
      var r = {
        id: 'CY-' + (101 + i),
        dens: 830 + rnd() * 8,
        dist: 282 + rnd() * 10,
        sulf: 5 + rnd() * 4,
        pour: -9 + rnd() * 5,
        flash: 62 + rnd() * 8,
        dupD: Math.abs(S.dup * R_LIM.dens * randn())
      };
      rows.push(r);
    }
    /* 录入错误：按混入率注入小数点错位 / 指标串行 */
    for (var j = 0; j < BATCH; j++) {
      if (rnd() < S.err / 100) {
        if (rnd() < 0.5) { rows[j].dens = rows[j].dens / 10; rows[j]._err = 'dens'; }
        else { rows[j].sulf = rows[j].sulf * 10 + 3; rows[j]._err = 'sulf'; }
      }
    }
    /* 逻辑矛盾注入：闪点被录低（对应案例中「62 录成 26」场景），密度-硫失配 */
    rows[3].flash = 26;                 /* 闪点 26 ℃ 与 50% 点 >285 ℃ 物理矛盾 */
    if (S.err >= 4) { rows[8].flash = 44; }
    if (rows[9].dens > 833) { rows[9].dens = 847.2; rows[9].sulf = 2.4; } /* 密度-硫失配 */
    return rows;
  }

  /* ---------- 审核规则 ---------- */
  function auditRow(r) {
    var hits = [];
    var red = false, gold = false, resample = false;

    /* ① 量程 / 有效数字（规则引擎） */
    if (r.dens < 800 || r.dens > 870) { hits.push('量程拦截：密度 ' + r.dens.toFixed(1) + ' kg/m³ 超柴油量程'); red = true; }
    if (r.sulf > 10) { hits.push('内控超限：硫含量 ' + r.sulf.toFixed(1) + ' > 10 mg/kg（国 VI 限值）'); red = true; }
    /* ② 物理一致性校验 */
    if (r.flash < 50 && r.dist > 285) { hits.push('一致性矛盾：闪点 ' + r.flash.toFixed(0) + ' ℃ 与馏程50%点 ' + r.dist.toFixed(0) + ' ℃ 不符'); gold = true; }
    if (r.dens > 845 && r.sulf < 3) { hits.push('一致性存疑：密度 ' + r.dens.toFixed(1) + ' 偏高而硫含量 ' + r.sulf.toFixed(1) + ' 过低'); gold = true; }
    /* ③ 平行样重复性 */
    if (r.dupD > R_LIM.dens * 2) { hits.push('平行样 |Δ|=' + r.dupD.toFixed(2) + ' > 2r，疑样品污染'); resample = true; }
    else if (r.dupD > R_LIM.dens) { hits.push('平行样 |Δ|=' + r.dupD.toFixed(2) + ' > r=' + R_LIM.dens + ' kg/m³（GB/T 1884）'); red = true; }

    var concl, cls;
    if (resample) { concl = '重采'; cls = 'r-grey'; }
    else if (red) { concl = '复测'; cls = 'r-red'; }
    else if (gold) { concl = '待确认'; cls = 'r-gold'; }
    else { concl = '通过'; cls = ''; }
    return { hits: hits, concl: concl, cls: cls, red: red, gold: gold, resample: resample };
  }

  /* ---------- 面板 1：审核流水线 ---------- */
  function drawPipe(cnt) {
    var svg = $('pipe');
    var W = 480, H = 148;
    var stages = [
      { t: '全量化验数据', n: DAILY + ' 条/日', c: '#79828a' },
      { t: '① 规则引擎', n: '拦 ' + cnt.rule + ' 条', c: '#2f7d6b' },
      { t: '② 一致性校验', n: '拦 ' + cnt.logic + ' 条', c: '#c9a15a' },
      { t: '③ 统计检测', n: '拦 ' + cnt.stat + ' 条', c: '#41699b' },
      { t: '待确认清单', n: cnt.list + ' 条', c: '#b05a51' }
    ];
    var bw = 86, bh = 46, gap = (W - 20 - bw * 5) / 4, y0 = 30;
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    var prevX = 10;
    stages.forEach(function (st, i) {
      var x = 10 + i * (bw + gap);
      if (i > 0) {
        var ax = prevX + bw;
        s += '<line x1="' + ax + '" y1="' + (y0 + bh / 2) + '" x2="' + x + '" y2="' + (y0 + bh / 2) + '" stroke="#c9c2b0" stroke-width="1.5"/>';
        s += '<path d="M' + (x - 5) + ' ' + (y0 + bh / 2 - 4) + ' L' + x + ' ' + (y0 + bh / 2) + ' L' + (x - 5) + ' ' + (y0 + bh / 2 + 4) + '" fill="none" stroke="#c9c2b0" stroke-width="1.5"/>';
      }
      s += '<rect x="' + x + '" y="' + y0 + '" width="' + bw + '" height="' + bh + '" rx="7" fill="#fff" stroke="' + st.c + '" stroke-width="1.4"/>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (y0 + 18) + '" font-size="9" fill="#4d565b" text-anchor="middle" font-weight="600">' + st.t + '</text>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (y0 + 34) + '" font-size="10" fill="' + st.c + '" text-anchor="middle" font-family="monospace" font-weight="700">' + st.n + '</text>';
      prevX = x;
    });
    /* 放行分支 */
    var lastX = 10 + 4 * (bw + gap) + bw / 2;
    var pass = DAILY - cnt.list;
    s += '<line x1="' + lastX + '" y1="' + (y0 + bh) + '" x2="' + lastX + '" y2="' + (y0 + bh + 16) + '" stroke="#2f7d6b" stroke-width="1.4"/>';
    s += '<rect x="' + (lastX - 52) + '" y="' + (y0 + bh + 16) + '" width="104" height="24" rx="6" fill="#e9f3ec" stroke="#2f7d6b" stroke-width="1.2"/>';
    s += '<text x="' + lastX + '" y="' + (y0 + bh + 32) + '" font-size="9.5" fill="#235f51" text-anchor="middle" font-weight="600">预筛放行 ' + pass + ' 条</text>';
    s += '<text x="10" y="16" font-size="9.5" fill="#79828a">四级过滤：规则引擎（量程/有效数字/重复性限）→ 物理一致性 → 控制图/平行样 → 人工确认清单（质检员签字放行）</text>';
    s += '<text x="10" y="' + (H - 8) + '" font-size="9" fill="#9ba3a9">折算口径：本批 ' + BATCH + ' 单审核结果 × ' + SCALE + ' ≈ 全厂 ' + DAILY + ' 条/日；清单采纳率目标 ≥89%（案例口径）</text>';
    svg.innerHTML = s;
  }

  /* ---------- 面板 2：Z-score 控制图 ---------- */
  var qcPts = [];
  function drawQC() {
    var cv = $('qc-chart');
    var W = 480, H = 232;
    var ctx = setupCanvas(cv, W, H);
    var pl = 40, pr = 14, pt = 16, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var zMax = Math.max(4, S.thr + 1, Math.max.apply(null, qcPts.map(function (p) { return Math.abs(p.z); })) + 0.5);
    zMax = Math.ceil(zMax);

    function xOf(i) { return pl + (i - 0.5) / QC_N * pw; }
    function yOf(z) { return pt + ph / 2 - z / zMax * (ph / 2); }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    /* 水平带：±2σ 警告、±thr 行动 */
    var bands = [
      { z: S.thr, c: '#b05a51', lab: '行动限 ±' + S.thr.toFixed(1) },
      { z: 2, c: '#c9a15a', lab: '警告限 ±2' },
      { z: 0, c: '#2f7d6b', lab: 'CL' }
    ];
    /* 网格与 y 轴 */
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'right';
    for (var g = -zMax; g <= zMax; g += 1) {
      var gy = yOf(g);
      ctx.strokeStyle = g === 0 ? '#d8d0bc' : '#efece1';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, gy); ctx.lineTo(pl + pw, gy); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(g + '', pl - 6, gy + 3);
    }
    /* 限值线 */
    bands.forEach(function (b) {
      if (b.z > 0) {
        [b.z, -b.z].forEach(function (zz) {
          var yy = yOf(zz);
          ctx.strokeStyle = b.c; ctx.lineWidth = 1.1; ctx.setLineDash([5, 3]);
          ctx.beginPath(); ctx.moveTo(pl, yy); ctx.lineTo(pl + pw, yy); ctx.stroke();
          ctx.setLineDash([]);
        });
        ctx.fillStyle = b.c; ctx.textAlign = 'left'; ctx.font = '8.5px Consolas, monospace';
        ctx.fillText(b.lab, pl + pw - 78, yOf(b.z) - 3);
      }
    });

    /* 连续同向游程（Western Electric 精简：≥7 点同侧判漂移） */
    var runStart = -1, runLen = 0, runSign = 0;
    for (var i = 0; i < qcPts.length; i++) {
      var sgn = qcPts[i].z > 0 ? 1 : (qcPts[i].z < 0 ? -1 : 0);
      if (sgn !== 0 && sgn === runSign) { runLen++; } else { runSign = sgn; runLen = sgn !== 0 ? 1 : 0; runStart = i; }
      if (runLen === 7) {
        var rx = xOf(runStart), rw = xOf(i) - rx;
        ctx.fillStyle = 'rgba(176,90,81,0.07)';
        ctx.fillRect(rx - 6, pt, rw + 12, ph);
        ctx.fillStyle = '#b05a51'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('连续7点同向·漂移', rx + rw / 2, pt + 10);
      }
    }

    /* 数据点连线与散点 */
    ctx.strokeStyle = '#b9c2c8'; ctx.lineWidth = 1;
    ctx.beginPath();
    qcPts.forEach(function (p, i) { var X = xOf(i), Y = yOf(p.z); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
    ctx.stroke();
    qcPts.forEach(function (p, i) {
      var X = xOf(i), Y = yOf(p.z);
      var az = Math.abs(p.z);
      var col = az > S.thr ? '#b05a51' : (az > 2 ? '#c9a15a' : '#41699b');
      ctx.beginPath(); ctx.arc(X, Y, az > S.thr ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#fdfcf9'; ctx.lineWidth = 1; ctx.stroke();
    });

    /* 轴标签 */
    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    for (var t = 5; t <= QC_N; t += 5) ctx.fillText(t + '', xOf(t - 1), H - 12);
    ctx.fillText('连续批次（QC 样 · 每日 1 批）', pl + pw / 2, H - 2);
    ctx.save(); ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('Z = (x − 标称值) / σ', 0, 0); ctx.restore();
    ctx.fillStyle = '#79828a'; ctx.textAlign = 'left'; ctx.font = '9px sans-serif';
    ctx.fillText('QC 标称 ' + QC_NOMINAL.toFixed(1) + ' kg/m³ · σ = r/2.77 = ' + QC_SIGMA.toFixed(3) + ' kg/m³（GB/T 1884 r=0.6）', pl + 4, pt + 9);
  }

  function bindQCTip() {
    var cv = $('qc-chart'), tip = $('qc-tip'), box = $('qc-box');
    var W = 480, pl = 40, pr = 14, pw = W - pl - pr;
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (W / r.width);
      var idx = Math.round((lx - pl) / pw * QC_N - 0.5);
      if (idx >= 0 && idx < qcPts.length) {
        var p = qcPts[idx], az = Math.abs(p.z);
        var judge = az > S.thr ? '超行动限 → 复测（红）' : (az > 2 ? '超警告限 → 关注（金）' : '受控');
        $('qc-tip').innerHTML = '<b>第 ' + p.i + ' 批 QC</b><br>密度 <b>' + p.x.toFixed(2) + '</b> kg/m³<br>Z = <b>' + p.z.toFixed(2) + '</b><br>' + judge;
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 84) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 3：平行样偏差分布 ---------- */
  var dupArr = [];
  function drawDup() {
    var cv = $('dup-chart');
    var W = 480, H = 190;
    var ctx = setupCanvas(cv, W, H);
    var pl = 38, pr = 14, pt = 14, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var step = 0.25, nBin = Math.ceil(3 / step);
    var bins = [];
    for (var b = 0; b < nBin; b++) bins.push(0);
    dupArr.forEach(function (d) { var k = Math.min(nBin - 1, Math.floor(d / step)); bins[k]++; });
    var yMax = Math.max.apply(null, bins.concat([4]));
    yMax = Math.ceil(yMax * 1.15);

    function xOf(v) { return pl + v / 3 * pw; }
    function yOf(c) { return pt + ph - c / yMax * ph; }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);
    ctx.font = '9px Consolas, monospace';

    /* 网格 */
    ctx.textAlign = 'right';
    for (var g = 0; g <= yMax; g += Math.max(1, Math.round(yMax / 5))) {
      var gy = yOf(g);
      ctx.strokeStyle = g === 0 ? '#d8d0bc' : '#efece1'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pl, gy); ctx.lineTo(pl + pw, gy); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.fillText(g + '', pl - 6, gy + 3);
    }
    /* 超限区 */
    ctx.fillStyle = 'rgba(176,90,81,0.06)';
    ctx.fillRect(xOf(1), pt, xOf(3) - xOf(1), ph);
    /* 柱条 */
    var bw = pw / nBin;
    for (var k = 0; k < nBin; k++) {
      if (bins[k] === 0) continue;
      var bx = xOf(k * step) + 1.5;
      var over = (k + 0.5) * step > 1;
      ctx.fillStyle = over ? '#b05a51' : '#41699b';
      ctx.globalAlpha = over ? 0.85 : 0.7;
      ctx.fillRect(bx, yOf(bins[k]), bw - 3, yOf(0) - yOf(bins[k]));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
      if (bins[k] >= 2) ctx.fillText(bins[k] + '', bx + (bw - 3) / 2, yOf(bins[k]) - 3);
    }
    /* 重复性限 r */
    var xr = xOf(1);
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(xr, pt); ctx.lineTo(xr, pt + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left'; ctx.font = '8.5px sans-serif';
    ctx.fillText('|Δ| = r（GB/T 1884 重复性限）', xr + 4, pt + 10);

    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center'; ctx.font = '9px sans-serif';
    for (var xv = 0; xv <= 3; xv += 0.5) ctx.fillText(xv.toFixed(1), xOf(xv), H - 12);
    ctx.fillText('平行样绝对偏差 |Δ| / r（归一化）', pl + pw / 2, H - 2);
    ctx.save(); ctx.translate(11, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('频数（共 40 对）', 0, 0); ctx.restore();
  }

  function bindDupTip() {
    var cv = $('dup-chart'), tip = $('dup-tip'), box = $('dup-box');
    var W = 480, pl = 38, pr = 14, pw = W - pl - pr;
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (W / r.width);
      var ratio = (lx - pl) / pw * 3;
      if (ratio >= 0 && ratio <= 3) {
        var over = ratio > 1;
        var n = dupArr.filter(function (d) { return Math.floor(d / 0.25) === Math.min(11, Math.floor(ratio / 0.25)); }).length;
        tip.innerHTML = '<b>|Δ|/r ∈ [' + (Math.floor(ratio / 0.25) * 0.25).toFixed(2) + ', ' + (Math.floor(ratio / 0.25) * 0.25 + 0.25).toFixed(2) + ')</b><br>频数 <b>' + n + '</b> 对<br>' + (over ? '超重复性限 → 复测' : '重复性受控');
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 76) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 4：化验单表 + 指标卡 + 结论 ---------- */
  function renderSheet(rows) {
    var body = $('lab-body');
    body.innerHTML = '';
    var cnt = { rule: 0, logic: 0, stat: 0, pass: 0, retest: 0, resample: 0, confirm: 0 };
    rows.forEach(function (r) {
      var a = auditRow(r);
      if (a.red && (r._err || r.dens < 800 || r.dens > 870 || r.sulf > 10)) cnt.rule++;
      if (a.gold) { cnt.logic++; cnt.confirm++; }
      if (a.red && r.dupD > R_LIM.dens) cnt.stat++;
      if (a.resample) cnt.resample++;
      if (a.concl === '复测') cnt.retest++;
      if (a.concl === '通过') cnt.pass++;
      var tr = document.createElement('tr');
      if (a.cls) tr.className = a.cls;
      tr.innerHTML =
        '<td class="num">' + r.id + '</td>' +
        '<td class="num">' + r.dens.toFixed(1) + '</td>' +
        '<td class="num">' + r.dist.toFixed(1) + '</td>' +
        '<td class="num">' + r.sulf.toFixed(1) + '</td>' +
        '<td class="num">' + r.pour.toFixed(1) + '</td>' +
        '<td class="num">' + r.flash.toFixed(0) + '</td>' +
        '<td class="num">' + r.dupD.toFixed(2) + '</td>' +
        '<td style="white-space:normal;font-size:10px;color:#5d666d">' + (a.hits.join('；') || '—') + '</td>' +
        '<td>' + a.concl + '</td>';
      body.appendChild(tr);
    });
    return cnt;
  }

  function renderMetrics(rows, cnt, qcRed, fpRate) {
    $('m-total').innerHTML = BATCH + '<small> 单</small>';
    $('m-rule').innerHTML = cnt.rule + '<small> 单</small>';
    $('m-rule').parentNode.className = 'mcard' + (cnt.rule > 0 ? ' bad' : '');
    $('m-logic').innerHTML = cnt.logic + '<small> 单</small>';
    $('m-logic').parentNode.className = 'mcard' + (cnt.logic > 0 ? ' warn' : '');
    var statN = cnt.stat + qcPts.filter(function (p) { return Math.abs(p.z) > S.thr; }).length;
    $('m-stat').innerHTML = statN + '<small> 处</small>';
    $('m-stat').parentNode.className = 'mcard' + (statN > 0 ? ' bad' : '');
    $('m-fp').innerHTML = fpRate.toFixed(1) + '<small> %</small>';
    $('m-fp').parentNode.className = 'mcard' + (fpRate > 5 ? ' bad' : (fpRate > 3 ? ' warn' : ''));
    return statN;
  }

  function renderVerdict(cnt, fpRate, qcRed) {
    var v = $('verdict');
    var head = '本批 <b>' + BATCH + '</b> 单：通过 <b>' + cnt.pass + '</b> · 复测 <b>' + cnt.retest + '</b> · 重采 <b>' + cnt.resample + '</b> · 逻辑待确认 <b>' + cnt.confirm + '</b>；QC 控制图超限批次 <b>' + qcRed + '</b> / ' + QC_N + '；';
    if (fpRate > 5) {
      v.className = 'verdict bad';
      v.innerHTML = head + '预估误报率 <b>' + fpRate.toFixed(1) + '%</b> 已超 5% 弃用线——审核阈值过严或随机噪声过大，质检员将淹没在无效复测单中。建议放宽阈值至 |Z|=3 或排查噪声源。';
    } else if (cnt.resample > 0) {
      v.className = 'verdict bad';
      v.innerHTML = head + '检出 <b>' + cnt.resample + '</b> 单平行样偏差 &gt; 2r，疑采样/制样污染（GB/T 4756 环节），建议重采；其余可疑单按复测流程处置。';
    } else if (qcRed > 0) {
      v.className = 'verdict warn';
      v.innerHTML = head + '控制图显示仪器存在系统性漂移（连续批次同向偏移），单条看均在合理范围、组合看已失控——此类「连续偏移」正是人工抽审的盲区，建议停用该仪器并重新标定后复测关联批次。';
    } else if (cnt.logic > 0 || cnt.retest > 0) {
      v.className = 'verdict warn';
      v.innerHTML = head + '检出逻辑矛盾与超重复性限记录，已列入待确认清单；误报率 ' + fpRate.toFixed(1) + '% 处于可接受区间。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '全部指标受控，平行样重复性、物理一致性与控制图均无异常，批次审核通过。误报率 ' + fpRate.toFixed(1) + '%。';
    }
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    qcPts = genQC();
    dupArr = genDup();
    var rows = genSheet();
    var cnt = renderSheet(rows);
    var qcRed = qcPts.filter(function (p) { return Math.abs(p.z) > S.thr; }).length;
    /* 误报率：正态假设下 P(|Z|>thr)，噪声放大抬升误报 */
    var fpRate = 2 * (1 - normCdf(S.thr / S.noise)) * 100;
    var statN = renderMetrics(rows, cnt, qcRed, fpRate);
    var pipeCnt = {
      rule: Math.round(cnt.rule * SCALE),
      logic: Math.round(cnt.logic * SCALE),
      stat: Math.round(statN * SCALE / 2),
      list: 0
    };
    pipeCnt.list = pipeCnt.rule + pipeCnt.logic + pipeCnt.stat;
    drawPipe(pipeCnt);
    drawQC();
    drawDup();
    renderVerdict(cnt, fpRate, qcRed);
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    dup: function (v) { return v.toFixed(1) + ' ×r'; },
    drift: function (v) { return v.toFixed(1) + ' σ'; },
    noise: function (v) { return v.toFixed(1) + ' σ'; },
    thr: function (v) { return v.toFixed(1); },
    err: function (v) { return v + ' %'; }
  };
  var KEYS = ['dup', 'drift', 'noise', 'thr', 'err'];

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
    $('btn-reseed').addEventListener('click', function () {
      SEED = (SEED * 9301 + 49297) % 233280;
      rnd = mulberry32(SEED);
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
      });
    });
  }

  bind();
  bindTabs();
  bindQCTip();
  bindDupTip();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawQC(); drawDup(); }, 120);
  });
})();
