/* ======= 机械钻速预测与参数智能优化 · 可运行示范（参数优化模拟） ======= */
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

  /* ---------- 物理代理模型（示范口径，见页脚公式说明） ---------- */
  var KL = [14.25, 17.8];   /* K_页岩, K_泥岩：ROP = K·fW^0.22·fN^0.16·fQ^0.22 */
  var MU = [1.00, 1.15];    /* 扭矩岩性系数 */
  var TQ_MAX = 14, SPP_MAX = 28, ECD_LO = 1.42, ECD_HI = 1.52;
  var BASE_ROP = 11.4;

  function rop(w, n, q, lith) {
    return KL[lith] * Math.pow((w - 40) / 100, 0.22) * Math.pow(n / 80, 0.16) * Math.pow(q / 30, 0.22);
  }
  function torque(w, n, lith) {
    return 3.2 + 0.075 * w * MU[lith] * (0.7 + n / 160);
  }
  function ecd(q, r) {
    return 1.40 + 0.014 * (q - 28) + 0.004 * (r - 11);
  }
  function spp(q) {
    var dq = q - 28;
    return 8 + 1.5 * dq + 0.09 * dq * dq;
  }
  /* 返回 null（安全）或越界原因列表 */
  function violations(w, n, q, lith) {
    var v = [];
    var t = torque(w, n, lith);
    var r = rop(w, n, q, lith);
    var e = ecd(q, r);
    if (t > TQ_MAX) v.push('扭矩 ' + t.toFixed(1) + ' > ' + TQ_MAX + ' kN·m');
    if (spp(q) > SPP_MAX) v.push('立压 ' + spp(q).toFixed(1) + ' > ' + SPP_MAX + ' MPa');
    if (e > ECD_HI) v.push('ECD ' + e.toFixed(2) + ' > ' + ECD_HI + '（井漏风险）');
    if (e < ECD_LO) v.push('ECD ' + e.toFixed(2) + ' < ' + ECD_LO + '（气侵风险）');
    return v.length ? v : null;
  }

  /* 约束网格寻优（工程口径 = 贝叶斯优化 ≤40 次评估的等效结果），按岩性缓存 */
  var optCache = [null, null];
  function optimize(lith) {
    if (optCache[lith]) return optCache[lith];
    var best = { w: 80, n: 70, q: 30, rop: -1 };
    for (var w = 60; w <= 140; w += 2) {
      for (var n = 60; n <= 120; n += 2) {
        if (torque(w, n, lith) > TQ_MAX) continue;
        for (var q = 28; q <= 36; q += 0.5) {
          var r = rop(w, n, q, lith);
          if (r <= best.rop) continue;
          var e = ecd(q, r);
          if (e > ECD_HI || e < ECD_LO || spp(q) > SPP_MAX) continue;
          best = { w: w, n: n, q: q, rop: r };
        }
      }
    }
    optCache[lith] = best;
    return best;
  }

  /* ---------- 状态 ---------- */
  var DEF = { wob: 80, rpm: 70, flow: 30, lith: 0 };
  var S = Object.assign({}, DEF);
  var STORE_KEY = 'd1-rop-optimize-v1';
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      ['wob', 'rpm', 'flow', 'lith'].forEach(function (k) {
        if (typeof s[k] === 'number') S[k] = s[k];
      });
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------- ① ROP 响应热图（canvas） ---------- */
  var LW = 520, LH = 340, PL = 48, PR = 14, PT = 10, PB = 32;
  var PW = LW - PL - PR, PH = LH - PT - PB;
  var NX = 80, NY = 60;
  var ROP_LO = 6, ROP_HI = 20;
  var C0 = [241, 236, 221], C1 = [188, 214, 200], C2 = [47, 125, 107];

  function xOfW(w) { return PL + (w - 60) / 80 * PW; }
  function yOfN(n) { return PT + (120 - n) / 60 * PH; }
  function wOfX(x) { return 60 + (x - PL) / PW * 80; }
  function nOfY(y) { return 120 - (y - PT) / PH * 60; }

  function ropColor(r) {
    var t = clamp((r - ROP_LO) / (ROP_HI - ROP_LO), 0, 1);
    var a, b, u;
    if (t < 0.5) { a = C0; b = C1; u = t / 0.5; } else { a = C1; b = C2; u = (t - 0.5) / 0.5; }
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * u) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * u) + ',' + Math.round(a[2] + (b[2] - a[2]) * u) + ')';
  }

  function star(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = (i % 2) ? r * 0.45 : r;
      var x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function drawHeatmap() {
    var cv = $('heatmap');
    var ctx = setupCanvas(cv, LW, LH);
    var q = S.flow, lith = S.lith;
    var sp = spp(q);
    var opt = optimize(lith);
    var goldMin = opt.rop * 0.95;

    ctx.clearRect(0, 0, LW, LH);

    /* 逐格填充 */
    var cw = PW / NX, ch = PH / NY;
    for (var i = 0; i < NX; i++) {
      for (var j = 0; j < NY; j++) {
        var w = 60 + (i + 0.5) / NX * 80;
        var n = 60 + (j + 0.5) / NY * 60;
        var r = rop(w, n, q, lith);
        var x = PL + i * cw, y = PT + j * ch;
        ctx.fillStyle = ropColor(r);
        ctx.fillRect(x, y, cw + 0.5, ch + 0.5);
        var badT = torque(w, n, lith) > TQ_MAX;
        var e = ecd(q, r);
        var badE = e > ECD_HI || e < ECD_LO || sp > SPP_MAX;
        if (badE) { ctx.fillStyle = 'rgba(65,105,155,0.42)'; ctx.fillRect(x, y, cw + 0.5, ch + 0.5); }
        if (badT) { ctx.fillStyle = 'rgba(176,90,81,0.48)'; ctx.fillRect(x, y, cw + 0.5, ch + 0.5); }
        if (!badT && !badE && r >= goldMin) {
          ctx.fillStyle = 'rgba(201,161,90,0.42)';
          ctx.fillRect(x, y, cw + 0.5, ch + 0.5);
        }
      }
    }

    /* 网格与刻度 */
    ctx.strokeStyle = '#e6e0d2';
    ctx.lineWidth = 1;
    ctx.strokeRect(PL, PT, PW, PH);
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'center';
    [60, 80, 100, 120, 140].forEach(function (w) {
      var x = xOfW(w);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + PH); ctx.stroke();
      ctx.fillText(String(w), x, PT + PH + 11);
    });
    ctx.textAlign = 'right';
    [60, 80, 100, 120].forEach(function (n) {
      var y = yOfN(n);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + PW, y); ctx.stroke();
      ctx.fillText(String(n), PL - 4, y + 3);
    });
    ctx.fillStyle = '#79828a';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('钻压 WOB (kN)', PL + PW / 2, LH - 4);
    ctx.save();
    ctx.translate(9, PT + PH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('转速 RPM', 0, 0);
    ctx.restore();

    /* 扭矩 T = 14 kN·m 解析等值线：N = 160·(10.8/(0.075·W·μ) − 0.7) */
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    var started = false;
    for (var wl = 60; wl <= 140; wl += 1) {
      var nl = 160 * (10.8 / (0.075 * wl * MU[lith]) - 0.7);
      if (nl < 60 || nl > 120) { started = false; continue; }
      var xl = xOfW(wl), yl = yOfN(nl);
      if (started) ctx.lineTo(xl, yl); else { ctx.moveTo(xl, yl); started = true; }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    /* 等值线标注 */
    var labW = 118, labN = 160 * (10.8 / (0.075 * labW * MU[lith]) - 0.7);
    if (labN >= 62 && labN <= 118) {
      ctx.fillStyle = '#b05a51';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('扭矩=14', xOfW(labW) - 40, yOfN(labN) - 5);
    }

    /* 最优点（金星） */
    star(ctx, xOfW(opt.w), yOfN(opt.n), 7);
    ctx.fillStyle = '#c9a15a';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#8a6d24';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('最优 ' + opt.rop.toFixed(1), xOfW(opt.w) + 9, yOfN(opt.n) - 7);

    /* 当前点（白圈） */
    ctx.beginPath();
    ctx.arc(xOfW(S.wob), yOfN(S.rpm), 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#2f3538';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function bindHeatmapTip() {
    var box = $('hm-box'), cv = $('heatmap'), tip = $('hm-tip');
    cv.addEventListener('mousemove', function (ev) {
      var rect = cv.getBoundingClientRect();
      var lx = (ev.clientX - rect.left) / rect.width * LW;
      var ly = (ev.clientY - rect.top) / rect.height * LH;
      if (lx < PL || lx > PL + PW || ly < PT || ly > PT + PH) { tip.style.display = 'none'; return; }
      var w = wOfX(lx), n = nOfY(ly);
      var r = rop(w, n, S.flow, S.lith);
      var t = torque(w, n, S.lith);
      var e = ecd(S.flow, r);
      var v = violations(w, n, S.flow, S.lith);
      tip.innerHTML = 'WOB <b>' + w.toFixed(0) + ' kN</b> · RPM <b>' + n.toFixed(0) + '</b><br>' +
        '预测 ROP <b>' + r.toFixed(1) + ' m/h</b>（' + (r / BASE_ROP >= 1 ? '+' : '') + ((r / BASE_ROP - 1) * 100).toFixed(0) + '%）<br>' +
        '扭矩 <b>' + t.toFixed(1) + '</b> kN·m · ECD <b>' + e.toFixed(2) + '</b><br>' +
        (v ? '<span style="color:#b05a51">✗ ' + v[0] + '</span>' : '<span style="color:#35765a">✓ 全部约束满足</span>');
      var bx = box.getBoundingClientRect();
      var px = ev.clientX - bx.left + 14, py = ev.clientY - bx.top + 12;
      if (px > bx.width - 190) px -= 200;
      if (py > bx.height - 90) py -= 96;
      tip.style.left = px + 'px';
      tip.style.top = py + 'px';
      tip.style.display = 'block';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- ② 沿井深钻速对比（SVG 双折线） ---------- */
  var TR_W = 880, TR_H = 260, TPL = 46, TPR = 64, TPT = 10, TPB = 26;
  var TPW = TR_W - TPL - TPR, TPH = TR_H - TPT - TPB;
  var D0 = 3980, D1 = 4076, NSEG = 32;           /* 96 m 窗口，每 3 m 一段 */
  var ROP_MIN = 10.5, ROP_MAX = 17.5;
  var BOUNDS = [                                 /* 岩性段：[起, 止, 0页岩/1泥岩] */
    [3980, 3990, 0], [3990, 3998, 1], [3998, 4012, 0], [4012, 4018, 1],
    [4018, 4030, 0], [4030, 4040, 1], [4040, 4048, 0], [4048, 4060, 1], [4060, 4076, 0]
  ];
  var trackData = [];

  function n32(i) { var x = Math.sin(i * 127.1 + 11.3) * 43758.5453; return x - Math.floor(x); }

  function buildTrackData() {
    var optS = optimize(0), optM = optimize(1);
    trackData = [];
    for (var i = 0; i < NSEG; i++) {
      var d = D0 + i * 3;
      var lith = 0;
      for (var b = 0; b < BOUNDS.length; b++) {
        if (d >= BOUNDS[b][0] && d < BOUNDS[b][1]) { lith = BOUNDS[b][2]; break; }
      }
      var noise = (n32(i) - 0.5) * 0.36;
      trackData.push({
        d0: d, d1: d + 3, lith: lith,
        base: rop(80, 70, 30, lith) + noise,
        opt: (lith ? optM : optS).rop + noise * 0.5,
        rec: lith ? optM : optS
      });
    }
  }

  function txOfD(d) { return TPL + (d - D0) / (D1 - D0) * TPW; }
  function tyOfR(r) { return TPT + (ROP_MAX - r) / (ROP_MAX - ROP_MIN) * TPH; }

  function drawTrack() {
    var s = '';
    /* 岩性背景带 */
    BOUNDS.forEach(function (bd) {
      s += '<rect x="' + txOfD(bd[0]).toFixed(1) + '" y="' + TPT + '" width="' +
        (txOfD(bd[1]) - txOfD(bd[0])).toFixed(1) + '" height="' + TPH +
        '" fill="' + (bd[2] ? '#f6efdd' : '#eef2ef') + '"/>';
    });
    /* 网格与刻度 */
    for (var r = 11; r <= 17; r++) {
      var y = tyOfR(r);
      s += '<line x1="' + TPL + '" y1="' + y + '" x2="' + (TPL + TPW) + '" y2="' + y + '" stroke="#efece1"/>' +
        '<text x="' + (TPL - 5) + '" y="' + (y + 3) + '" text-anchor="end" font-size="8.5" fill="#9ba3a9" font-family="Consolas,monospace">' + r + '</text>';
    }
    for (var d = D0; d <= D1; d += 24) {
      var x = txOfD(d);
      s += '<line x1="' + x + '" y1="' + TPT + '" x2="' + x + '" y2="' + (TPT + TPH) + '" stroke="#efece1"/>' +
        '<text x="' + x + '" y="' + (TPT + TPH + 11) + '" text-anchor="middle" font-size="8.5" fill="#9ba3a9" font-family="Consolas,monospace">' + d + '</text>';
    }
    s += '<text x="' + (TPL + TPW / 2) + '" y="' + (TR_H - 2) + '" text-anchor="middle" font-size="10" fill="#79828a">测深 MD (m) · 水平段窗口（岩性：页岩 / 泥岩交替）</text>' +
      '<text x="12" y="' + (TPT + TPH / 2) + '" text-anchor="middle" font-size="10" fill="#79828a" transform="rotate(-90 12 ' + (TPT + TPH / 2) + ')">ROP (m/h)</text>';

    /* 折线 */
    function pathOf(key) {
      var p = '';
      trackData.forEach(function (pt, i) {
        p += (i ? 'L' : 'M') + txOfD(pt.d0 + 1.5).toFixed(1) + ' ' + tyOfR(pt[key]).toFixed(1) + ' ';
      });
      return p;
    }
    s += '<path d="' + pathOf('base') + '" fill="none" stroke="#9ba3a9" stroke-width="1.4"/>' +
      '<path d="' + pathOf('opt') + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';
    trackData.forEach(function (pt) {
      s += '<circle cx="' + txOfD(pt.d0 + 1.5).toFixed(1) + '" cy="' + tyOfR(pt.opt).toFixed(1) + '" r="1.8" fill="#2f7d6b"/>';
    });

    /* 末端标注（强制间隔 ≥12px 防重叠） */
    var last = trackData[NSEG - 1];
    var labels = [
      { y: tyOfR(last.base), txt: '基线 ' + last.base.toFixed(1), color: '#79828a' },
      { y: tyOfR(last.opt), txt: '优化 ' + last.opt.toFixed(1), color: '#235f51' }
    ];
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var i2 = 1; i2 < labels.length; i2++) {
      if (labels[i2].y - labels[i2 - 1].y < 12) labels[i2].y = labels[i2 - 1].y + 12;
    }
    labels.forEach(function (lb) {
      s += '<text x="' + (TPL + TPW + 6) + '" y="' + (lb.y + 3).toFixed(1) + '" font-size="9.5" fill="' + lb.color + '">' + lb.txt + '</text>';
    });

    /* hover 热区 */
    trackData.forEach(function (pt, i) {
      s += '<rect class="hz" data-i="' + i + '" x="' + txOfD(pt.d0).toFixed(1) + '" y="' + TPT +
        '" width="' + (txOfD(pt.d1) - txOfD(pt.d0)).toFixed(1) + '" height="' + TPH + '" fill="transparent"/>';
    });
    $('track').innerHTML = s;
  }

  function bindTrackTip() {
    var box = $('tr-box'), svg = $('track'), tip = $('tr-tip');
    svg.addEventListener('mousemove', function (ev) {
      var rect = svg.getBoundingClientRect();
      var lx = (ev.clientX - rect.left) / rect.width * TR_W;
      var ly = (ev.clientY - rect.top) / rect.height * TR_H;
      if (lx < TPL || lx > TPL + TPW || ly < TPT || ly > TPT + TPH) { tip.style.display = 'none'; return; }
      var i = clamp(Math.floor((lx - TPL) / TPW * NSEG), 0, NSEG - 1);
      var pt = trackData[i];
      var gain = ((pt.opt / pt.base - 1) * 100).toFixed(0);
      tip.innerHTML = '井段 <b>' + pt.d0 + '–' + pt.d1 + ' m</b> · ' + (pt.lith ? '泥岩' : '页岩') + '<br>' +
        '基线 ROP <b>' + pt.base.toFixed(1) + '</b> m/h → 优化 <b>' + pt.opt.toFixed(1) + '</b> m/h（+' + gain + '%）<br>' +
        '建议：WOB <b>' + pt.rec.w + '</b> kN · RPM <b>' + pt.rec.n + '</b> · Q <b>' + pt.rec.q + '</b> L/s';
      var bx = box.getBoundingClientRect();
      var px = ev.clientX - bx.left + 14, py = ev.clientY - bx.top + 12;
      if (px > bx.width - 230) px -= 244;
      if (py > bx.height - 80) py -= 92;
      tip.style.left = px + 'px';
      tip.style.top = py + 'px';
      tip.style.display = 'block';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- ③ 参数安全走廊（SVG） ---------- */
  var CR_W = 880, CR_H = 210, CX0 = 92, CX1 = 836;
  var ROWS = [
    { key: 'wob', label: '钻压 WOB', unit: 'kN', min: 60, max: 140, cy: 38 },
    { key: 'rpm', label: '转速 RPM', unit: 'rpm', min: 60, max: 120, cy: 105 },
    { key: 'flow', label: '排量 Q', unit: 'L/s', min: 28, max: 36, cy: 172 }
  ];

  function cxOf(row, v) { return CX0 + (v - row.min) / (row.max - row.min) * (CX1 - CX0); }

  /* 固定其余参数为当前值，扫描该参数的合法连续区间（取含当前值的最长连续段） */
  function safeRange(row) {
    var M = 320, segs = [], cur = null;
    for (var i = 0; i <= M; i++) {
      var v = row.min + (row.max - row.min) * i / M;
      var w = S.wob, n = S.rpm, q = S.flow;
      if (row.key === 'wob') w = v; else if (row.key === 'rpm') n = v; else q = v;
      var ok = !violations(w, n, q, S.lith);
      if (ok && !cur) cur = { a: v, b: v };
      else if (ok) cur.b = v;
      else if (cur) { segs.push(cur); cur = null; }
    }
    if (cur) segs.push(cur);
    if (!segs.length) return null;
    segs.sort(function (a, b) { return (b.b - b.a) - (a.b - a.a); });
    return segs[0];
  }

  function drawCorridor() {
    var opt = optimize(S.lith);
    var recVal = { wob: opt.w, rpm: opt.n, flow: opt.q };
    var s = '';
    ROWS.forEach(function (row) {
      var cy = row.cy;
      s += '<text x="8" y="' + (cy + 3) + '" font-size="10.5" fill="#5d666d">' + row.label + '</text>';
      /* 全量程灰带 */
      s += '<rect x="' + CX0 + '" y="' + (cy - 7) + '" width="' + (CX1 - CX0) + '" height="14" rx="3" fill="#f0ede3"/>';
      /* 网格刻度（min/max） */
      s += '<text x="' + CX0 + '" y="' + (cy + 13) + '" text-anchor="start" font-size="8.5" fill="#9ba3a9" font-family="Consolas,monospace">' + row.min + '</text>' +
        '<text x="' + CX1 + '" y="' + (cy + 13) + '" text-anchor="end" font-size="8.5" fill="#9ba3a9" font-family="Consolas,monospace">' + row.max + ' ' + row.unit + '</text>';
      /* 安全区间绿带 */
      var sr = safeRange(row);
      if (sr) {
        s += '<rect x="' + cxOf(row, sr.a).toFixed(1) + '" y="' + (cy - 7) + '" width="' +
          (cxOf(row, sr.b) - cxOf(row, sr.a)).toFixed(1) + '" height="14" fill="#dcebe2" stroke="#b9d4c7"/>';
      }
      /* 推荐值金线 */
      var rv = recVal[row.key];
      s += '<line x1="' + cxOf(row, rv).toFixed(1) + '" y1="' + (cy - 9) + '" x2="' + cxOf(row, rv).toFixed(1) +
        '" y2="' + (cy + 9) + '" stroke="#c9a15a" stroke-width="2"/>' +
        '<text x="' + cxOf(row, rv).toFixed(1) + '" y="' + (cy + 23) + '" text-anchor="middle" font-size="9" fill="#8a6d24">推荐 ' + rv + '</text>';
      /* 当前值红针 + 标签 */
      var cv2 = S[row.key];
      var cx = cxOf(row, cv2);
      var labX = clamp(cx, CX0 + 16, CX1 - 16);
      s += '<polygon points="' + cx.toFixed(1) + ',' + (cy - 9) + ' ' + (cx - 4).toFixed(1) + ',' + (cy - 16) +
        ' ' + (cx + 4).toFixed(1) + ',' + (cy - 16) + '" fill="#b05a51"/>' +
        '<line x1="' + cx.toFixed(1) + '" y1="' + (cy - 9) + '" x2="' + cx.toFixed(1) + '" y2="' + (cy + 9) +
        '" stroke="#b05a51" stroke-width="2"/>' +
        '<text x="' + labX.toFixed(1) + '" y="' + (cy - 20) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#b05a51">' + cv2 + '</text>';
    });
    $('corridor').innerHTML = s;
  }

  /* ---------- ④ 指标卡与判定 ---------- */
  function updateMetrics() {
    var w = S.wob, n = S.rpm, q = S.flow, lith = S.lith;
    var r = rop(w, n, q, lith);
    var t = torque(w, n, lith);
    var e = ecd(q, r);
    var v = violations(w, n, q, lith);
    var opt = optimize(lith);
    var gain = (r / BASE_ROP - 1) * 100;

    $('m-rop').innerHTML = r.toFixed(1) + '<small> m/h</small>';
    $('m-gain').innerHTML = (gain >= 0 ? '+' : '') + gain.toFixed(1) + '<small> %</small>';
    $('m-torque').innerHTML = t.toFixed(1) + '<small> kN·m</small>';
    $('m-ecd').innerHTML = e.toFixed(2) + '<small> g/cm³</small>';
    $('mc-tq').className = 'mcard' + (t > TQ_MAX ? ' bad' : (t > 12.6 ? ' warn' : ''));
    $('mc-ecd').className = 'mcard' + ((e > ECD_HI || e < ECD_LO) ? ' bad' : '');

    var vd = $('verdict');
    var optTxt = '寻优建议：<b>WOB ' + opt.w + ' kN / RPM ' + opt.n + ' / Q ' + opt.q + ' L/s</b> → <b>' +
      opt.rop.toFixed(1) + ' m/h</b>（+' + ((opt.rop / BASE_ROP - 1) * 100).toFixed(0) + '%）';
    if (v) {
      vd.className = 'verdict bad';
      vd.innerHTML = '⚠ 约束越界：' + v.join('；') + '。请参照安全走廊回调参数。' + optTxt;
    } else if (r >= 13.1) {
      vd.className = 'verdict ok';
      vd.innerHTML = '✓ 当前参数位于安全区且增益达标（目标 +15%）：预测 ROP <b>' + r.toFixed(1) +
        ' m/h（+' + gain.toFixed(1) + '%）</b>，全部硬约束满足。' + optTxt;
    } else {
      vd.className = 'verdict warn';
      vd.innerHTML = '参数安全但偏保守（现场 25% 余量口径）：ROP <b>' + r.toFixed(1) + ' m/h（+' +
        gain.toFixed(1) + '%）</b>，低于 +15% 目标。' + optTxt;
    }
  }

  /* ---------- 控件与联动 ---------- */
  function syncCtl() {
    $('s-wob').value = S.wob;
    $('s-rpm').value = S.rpm;
    $('s-flow').value = S.flow;
    $('o-wob').textContent = S.wob + ' kN';
    $('o-rpm').textContent = S.rpm + ' rpm';
    $('o-flow').textContent = S.flow + ' L/s';
    $('lith-shale').className = S.lith === 0 ? 'on' : '';
    $('lith-mud').className = S.lith === 1 ? 'on' : '';
  }

  function render() {
    drawHeatmap();
    drawCorridor();
    updateMetrics();
    saveState();
  }

  function bind(id, key, fmt) {
    $(id).addEventListener('input', function () {
      S[key] = parseFloat(this.value);
      syncCtl();
      render();
    });
  }

  /* ---------- 页签切换 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.remove('active'); });
        $('pane-' + t.getAttribute('data-tab')).classList.add('active');
      });
    });
  }

  /* ---------- 初始化 ---------- */
  loadState();
  bindTabs();
  syncCtl();
  bind('s-wob', 'wob');
  bind('s-rpm', 'rpm');
  bind('s-flow', 'flow');
  $('lith-shale').addEventListener('click', function () { S.lith = 0; syncCtl(); render(); });
  $('lith-mud').addEventListener('click', function () { S.lith = 1; syncCtl(); render(); });
  $('btn-reset').addEventListener('click', function () {
    S = Object.assign({}, DEF);
    syncCtl();
    render();
  });

  buildTrackData();
  drawTrack();
  bindTrackTip();
  bindHeatmapTip();
  render();

  /* resize 防抖重绘 canvas（SVG 随 viewBox 自适应无需重绘） */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(drawHeatmap, 120);
  });
})();

/* ======= 真实数据来源页（文献图表） ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- ① B-Y 八子函数表 ---------- */
  var BY_FUNCS = [
    ['f1', '地层强度', 'e^(2.303·a1)', '地层可钻性常数项（含钻井液性能综合影响）'],
    ['f2', '压实效应', 'e^(2.303·a2·(10000−D))', '埋深增加、压实程度升高的正常趋势修正'],
    ['f3', '孔隙压力', 'e^(2.303·a3·D^0.69·(gp−9.0))', '欠压实高压地层中钻速显著升高'],
    ['f4', '压差', 'e^(2.303·a4·D·(gp−ρc))', '过平衡压差压持岩屑、抑制钻速'],
    ['f5', '钻压', '((W/db − Wt)/(4 − Wt))^a5', '归一化钻压项，Wt 为门限钻压'],
    ['f6', '转速', '(N/60)^a6', '转速对钻速的次线性放大'],
    ['f7', '牙齿磨损', 'e^(−a7·h)', '钻头钝化磨损导致的降效'],
    ['f8', '水力净化', '(Fj/1000)^a8', '射流冲击力改善井底净化、提升钻速']
  ];
  var rows = '';
  BY_FUNCS.forEach(function (f) {
    rows += '<tr><td class="mono">' + f[0] + '</td><td>' + f[1] + '</td><td class="mono">' + f[2] + '</td><td>' + f[3] + '</td></tr>';
  });
  $('by-body').innerHTML = rows;

  /* ---------- ① B-Y 系数推荐区间图 ---------- */
  var RANGES = [
    { sym: 'a5', name: '钻压指数', lo: 0.5, hi: 2.0 },
    { sym: 'a6', name: '转速指数', lo: 0.4, hi: 1.0 },
    { sym: 'a7', name: '齿损指数', lo: 0.3, hi: 1.5 },
    { sym: 'a8', name: '水力指数', lo: 0.3, hi: 0.6 }
  ];
  var RG_W = 460, RG_H = 190, RX0 = 70, RX1 = 430, RG_MAX = 2.2;
  function rxOf(v) { return RX0 + v / RG_MAX * (RX1 - RX0); }
  function drawRanges() {
    var s = '';
    for (var g = 0; g <= 2.0; g += 0.5) {
      var x = rxOf(g);
      s += '<line x1="' + x + '" y1="14" x2="' + x + '" y2="166" stroke="#efece1"/>' +
        '<text x="' + x + '" y="178" text-anchor="middle" font-size="8.5" fill="#9ba3a9" font-family="Consolas,monospace">' + g.toFixed(1) + '</text>';
    }
    RANGES.forEach(function (rg, i) {
      var cy = 34 + i * 42;
      s += '<text x="8" y="' + (cy - 4) + '" font-size="10" font-weight="600" fill="#235f51" font-family="Consolas,monospace">' + rg.sym + '</text>' +
        '<text x="8" y="' + (cy + 9) + '" font-size="9" fill="#8a9298">' + rg.name + '</text>' +
        '<rect class="rg" data-i="' + i + '" x="' + rxOf(rg.lo).toFixed(1) + '" y="' + (cy - 8) + '" width="' +
        (rxOf(rg.hi) - rxOf(rg.lo)).toFixed(1) + '" height="16" rx="3" fill="#dcebe2" stroke="#b9d4c7"/>' +
        '<text x="' + (rxOf(rg.lo) - 4).toFixed(1) + '" y="' + (cy + 3) + '" text-anchor="end" font-size="8.5" fill="#5d666d" font-family="Consolas,monospace">' + rg.lo.toFixed(1) + '</text>' +
        '<text x="' + (rxOf(rg.hi) + 4).toFixed(1) + '" y="' + (cy + 3) + '" text-anchor="start" font-size="8.5" fill="#5d666d" font-family="Consolas,monospace">' + rg.hi.toFixed(1) + '</text>';
    });
    $('by-ranges').innerHTML = s;
    var tip = $('by-tip'), box = $('by-box'), svg = $('by-ranges');
    svg.addEventListener('mousemove', function (ev) {
      var t = ev.target;
      if (!t.getAttribute || t.getAttribute('class') !== 'rg') { tip.style.display = 'none'; return; }
      var rg = RANGES[parseInt(t.getAttribute('data-i'), 10)];
      tip.innerHTML = '<b>' + rg.sym + '</b> ' + rg.name + '：推荐区间 <b>' + rg.lo.toFixed(1) + ' – ' + rg.hi.toFixed(1) + '</b><br>Bahari &amp; Seyed (2009) 信赖域回归汇总（牙轮钻头）';
      var bx = box.getBoundingClientRect();
      tip.style.left = (ev.clientX - bx.left + 14) + 'px';
      tip.style.top = (ev.clientY - bx.top - 8) + 'px';
      tip.style.display = 'block';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }
  drawRanges();

  /* ---------- ② Maurer 完全净化理论曲线 ---------- */
  var M_W = 460, M_H = 240, MPL = 40, MPR = 66, MPT = 10, MPB = 28;
  var MPW = M_W - MPL - MPR, MPH = M_H - MPT - MPB;
  var MW_MIN = 60, MW_MAX = 140, MR_MAX = 45;
  var CURVES = [
    { S: 80, color: '#c9a15a' },
    { S: 110, color: '#2f7d6b' },
    { S: 140, color: '#41699b' }
  ];
  function maurerR(w, s) { return 13 * Math.pow(w / 100, 2) * Math.pow(105 / s, 2); }
  function mxOf(w) { return MPL + (w - MW_MIN) / (MW_MAX - MW_MIN) * MPW; }
  function myOf(r) { return MPT + (MR_MAX - r) / MR_MAX * MPH; }

  function drawMaurer() {
    var s = '';
    for (var r = 0; r <= 40; r += 10) {
      var y = myOf(r);
      s += '<line x1="' + MPL + '" y1="' + y + '" x2="' + (MPL + MPW) + '" y2="' + y + '" stroke="#efece1"/>' +
        '<text x="' + (MPL - 4) + '" y="' + (y + 3) + '" text-anchor="end" font-size="8.5" fill="#9ba3a9" font-family="Consolas,monospace">' + r + '</text>';
    }
    for (var w = 60; w <= 140; w += 20) {
      var x = mxOf(w);
      s += '<line x1="' + x + '" y1="' + MPT + '" x2="' + x + '" y2="' + (MPT + MPH) + '" stroke="#efece1"/>' +
        '<text x="' + x + '" y="' + (MPT + MPH + 11) + '" text-anchor="middle" font-size="8.5" fill="#9ba3a9" font-family="Consolas,monospace">' + w + '</text>';
    }
    s += '<text x="' + (MPL + MPW / 2) + '" y="' + (M_H - 2) + '" text-anchor="middle" font-size="10" fill="#79828a">钻压 WOB (kN)</text>' +
      '<text x="11" y="' + (MPT + MPH / 2) + '" text-anchor="middle" font-size="10" fill="#79828a" transform="rotate(-90 11 ' + (MPT + MPH / 2) + ')">ROP (m/h)</text>';

    CURVES.forEach(function (c) {
      var p = '';
      for (var w = MW_MIN; w <= MW_MAX; w += 2) {
        p += (w === MW_MIN ? 'M' : 'L') + mxOf(w).toFixed(1) + ' ' + myOf(maurerR(w, c.S)).toFixed(1) + ' ';
      }
      s += '<path d="' + p + '" fill="none" stroke="' + c.color + '" stroke-width="2"/>';
    });

    /* 末端标注（按 y 排序，强制相邻间隔 ≥12px） */
    var labels = CURVES.map(function (c) {
      return { y: myOf(maurerR(MW_MAX, c.S)), txt: 'S = ' + c.S + ' MPa', color: c.color };
    });
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12;
    }
    labels.forEach(function (lb) {
      s += '<text x="' + (MPL + MPW + 5) + '" y="' + (lb.y + 3).toFixed(1) + '" font-size="9" fill="' + lb.color + '">' + lb.txt + '</text>';
    });

    /* 十字线（hover 动态） */
    s += '<line id="mh-line" x1="0" y1="' + MPT + '" x2="0" y2="' + (MPT + MPH) + '" stroke="#b9b3a2" stroke-dasharray="3 3" visibility="hidden"/>';
    CURVES.forEach(function (c, i) {
      s += '<circle id="mh-pt' + i + '" r="3" fill="' + c.color + '" visibility="hidden"/>';
    });
    $('maurer').innerHTML = s;

    var tip = $('maurer-tip'), box = $('maurer-box'), svg = $('maurer');
    svg.addEventListener('mousemove', function (ev) {
      var rect = svg.getBoundingClientRect();
      var lx = (ev.clientX - rect.left) / rect.width * M_W;
      var ly = (ev.clientY - rect.top) / rect.height * M_H;
      if (lx < MPL || lx > MPL + MPW || ly < MPT || ly > MPT + MPH) {
        tip.style.display = 'none';
        $('mh-line').setAttribute('visibility', 'hidden');
        CURVES.forEach(function (c, i) { $('mh-pt' + i).setAttribute('visibility', 'hidden'); });
        return;
      }
      var w = MW_MIN + (lx - MPL) / MPW * (MW_MAX - MW_MIN);
      var x = mxOf(w);
      var line = $('mh-line');
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      line.setAttribute('visibility', 'visible');
      var html = 'WOB <b>' + w.toFixed(0) + ' kN</b>（N=90 rpm）';
      CURVES.forEach(function (c, i) {
        var r2 = maurerR(w, c.S);
        var pt = $('mh-pt' + i);
        pt.setAttribute('cx', x);
        pt.setAttribute('cy', myOf(r2));
        pt.setAttribute('visibility', 'visible');
        html += '<br><span style="color:' + c.color + '">●</span> S=' + c.S + ' MPa：<b>' + r2.toFixed(1) + '</b> m/h';
      });
      tip.innerHTML = html;
      var bx = box.getBoundingClientRect();
      var px = ev.clientX - bx.left + 14, py = ev.clientY - bx.top + 12;
      if (px > bx.width - 170) px -= 184;
      tip.style.left = px + 'px';
      tip.style.top = py + 'px';
      tip.style.display = 'block';
    });
    svg.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      var line = $('mh-line');
      if (line) line.setAttribute('visibility', 'hidden');
      CURVES.forEach(function (c, i) {
        var pt = $('mh-pt' + i);
        if (pt) pt.setAttribute('visibility', 'hidden');
      });
    });
  }
  drawMaurer();

  /* ---------- ⑤ 文献汇总表 ---------- */
  var SUMMARY = [
    ['Bourgoyne & Young (1974)', 'SPE J. 14(4):371–384 · SPE-4238-PA', '八子函数乘积 ROP 回归模型，行业基准形式', '热图代理模型的乘积函数结构'],
    ['Maurer (1962)', 'JPT 14(11):1270–1274 · SPE-408-PA', '完全净化理论：ROP ∝ N·W²/(db²·S²)', '排量纳入联合优化的理论依据'],
    ['Teale (1965)', 'Int. J. Rock Mech. Min. Sci. 2(1):57–73', '机械比功 MSE 概念：最小 MSE ≈ 岩石强度', '憋钻 / 低效钻进的判别指标'],
    ['Hareland & Rampersad (1994)', 'SPE-26957-MS', 'PDC 钻头含磨损钻速方程与水力因子', 'PDC 载荷响应饱和（指数 0.22）口径'],
    ['Dupriest & Koederitz (2005)', 'SPE/IADC-92194-MS', 'MSE 实时监测指导调参，现场钻速显著提升', '"每 3 m 滚动参数建议"业务原型'],
    ['Bahari & Seyed (2009)', 'Energy Sources Part A · 10.1080/10916460903452009', '信赖域法辨识 B-Y 系数并给出推荐区间', '系数区间图数据'],
    ['数据-知识双驱动 ROP 预测 (2023)', 'Appl. Sci. 13(20):11396 · 四川 A1–A4 井', '物理嵌入神经网络，预测精度较纯数据驱动 +30%', '与本案 TCN 代理模型同一路线']
  ];
  var srows = '';
  SUMMARY.forEach(function (r) {
    srows += '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
  });
  $('sum-body').innerHTML = srows;
})();
