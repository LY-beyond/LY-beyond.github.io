/* ======= 智能完井滑套控制策略 · 可运行示范 ======= */
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

  /* ---------- 页签切换 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    var panes = { sim: $('pane-sim'), real: $('pane-real') };
    Array.prototype.forEach.call(tabs, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        Object.keys(panes).forEach(function (k) {
          if (panes[k]) panes[k].classList.toggle('active', k === btn.getAttribute('data-tab'));
        });
      });
    });
  }

  /* =========================================================
     集总模型：8 段渗透率 / 见水时间各异的水平井
     ========================================================= */
  var SEG = [
    { k: 240, tb0: 34, fw0: 0.58 },
    { k: 460, tb0: 16, fw0: 0.62 },
    { k: 160, tb0: 44, fw0: 0.50 },
    { k: 640, tb0: 9,  fw0: 0.66 },
    { k: 300, tb0: 26, fw0: 0.58 },
    { k: 120, tb0: 52, fw0: 0.45 },
    { k: 720, tb0: 7,  fw0: 0.68 },
    { k: 280, tb0: 22, fw0: 0.55 }
  ];
  var STOPS = [0, 25, 50, 75, 100];
  var MONTHS = 60, DAYS = 30.4;
  var PRESETS = {
    full: [100, 100, 100, 100, 100, 100, 100, 100],
    exp:  [100, 75, 100, 50, 75, 100, 50, 100],
    rl:   [75, 50, 100, 25, 100, 100, 25, 75]
  };
  var STORE_KEY = 'co4-sleeve-openings-v1';

  var OPEN = PRESETS.rl.slice();
  (function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s && s.length === 8 && s.every(function (v) { return STOPS.indexOf(v) >= 0; })) OPEN = s;
    } catch (e) {}
  })();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(OPEN)); } catch (e) {}
  }

  function simulate(openPct) {
    var a = openPct.map(function (v) { return v / 100; });
    var w = [], tb = [], r = [], fm = [], sw = 0, abar = 0, i, t;
    for (i = 0; i < 8; i++) {
      w[i] = Math.pow(a[i], 0.7) * Math.pow(SEG[i].k, 0.85);
      sw += w[i]; abar += a[i];
      tb[i] = SEG[i].tb0 / (0.55 + 0.45 * a[i]);
      r[i] = 0.028 + SEG[i].k / 11000;
      fm[i] = 0.90 + SEG[i].k / 10000;
    }
    abar /= 8;
    var Q = 500 * (0.7 + 0.3 * abar);            /* 节流降液：关小滑套损失部分产液量 */
    var fw = new Array(MONTHS + 1), qo = new Array(MONTHS + 1), segFw = [];
    for (i = 0; i < 8; i++) segFw[i] = new Array(MONTHS + 1);
    var co = 0, cw = 0, cl = 0;
    for (t = 0; t <= MONTHS; t++) {
      var qot = 0, qwt = 0;
      for (i = 0; i < 8; i++) {
        var ql = sw > 0 ? Q * w[i] / sw : 0;
        var f = SEG[i].fw0 + (fm[i] - SEG[i].fw0) / (1 + Math.exp(-r[i] * (t - tb[i])));
        segFw[i][t] = f;
        qot += ql * (1 - f); qwt += ql * f;
      }
      fw[t] = Q > 0 && sw > 0 ? qwt / Q : 0;
      qo[t] = qot;
      if (t >= 1) { co += qot * DAYS / 1e4; cw += qwt * DAYS / 1e4; cl += Q * DAYS / 1e4; }
    }
    return { fw: fw, qo: qo, segFw: segFw, tb: tb, Q: Q, co: co, cw: cw, cl: cl, fw1: fw[1], fw60: fw[MONTHS] };
  }

  /* ---------- 配色 ---------- */
  function rampColor(t) {
    /* 0=绿(低) → 0.5=金 → 1=红(高) */
    var lo = [47, 125, 107], mid = [201, 161, 90], hi = [176, 90, 81], c;
    t = clamp(t, 0, 1);
    if (t < 0.5) {
      var u = t / 0.5;
      c = [lo[0] + (mid[0] - lo[0]) * u, lo[1] + (mid[1] - lo[1]) * u, lo[2] + (mid[2] - lo[2]) * u];
    } else {
      var v = (t - 0.5) / 0.5;
      c = [mid[0] + (hi[0] - mid[0]) * v, mid[1] + (hi[1] - mid[1]) * v, mid[2] + (hi[2] - mid[2]) * v];
    }
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }
  function riskOf(i) { return clamp((SEG[i].k - 100) / 620, 0, 1); }
  function riskWord(i) { var r = riskOf(i); return r > 0.66 ? '高' : r > 0.33 ? '中' : '低'; }

  var SIMF = simulate(PRESETS.full);
  var SIMC = simulate(OPEN);

  /* =========================================================
     ① 分段开度编辑器
     ========================================================= */
  var ED = { W: 900, H: 232, PL: 40, segW: 95, gap: 8, bandY: 30, bandH: 46, Y0: 104, Y1: 188 };

  function segX(i) { return ED.PL + i * (ED.segW + ED.gap); }
  function stopY(v) { return ED.Y1 - v / 100 * (ED.Y1 - ED.Y0); }

  function drawEditor() {
    var s = '<rect width="' + ED.W + '" height="' + ED.H + '" fill="#fdfcf9"/>';
    s += '<text x="' + ED.PL + '" y="16" font-size="9" fill="#79828a">跟端 heel</text>';
    s += '<text x="' + (ED.PL + 8 * (ED.segW + ED.gap) - ED.gap) + '" y="16" font-size="9" fill="#79828a" text-anchor="end">趾端 toe</text>';

    /* 档位刻度（左） */
    STOPS.forEach(function (v) {
      s += '<text x="' + (ED.PL - 8) + '" y="' + (stopY(v) + 2.5) + '" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + (v === 100 ? '%' : '') + '</text>';
    });

    for (var i = 0; i < 8; i++) {
      var x = segX(i), cx = x + ED.segW / 2, cur = OPEN[i];
      var rc = rampColor(riskOf(i));
      /* 井段色带 */
      s += '<rect x="' + x + '" y="' + ED.bandY + '" width="' + ED.segW + '" height="' + ED.bandH + '" rx="6" fill="' + rc + '" opacity="0.82"/>';
      s += '<text x="' + cx + '" y="' + (ED.bandY + 16) + '" font-size="9.5" fill="#fff" text-anchor="middle" font-weight="600" style="paint-order:stroke" stroke="rgba(0,0,0,0.18)" stroke-width="2">S' + (i + 1) + '</text>';
      s += '<text x="' + cx + '" y="' + (ED.bandY + 38) + '" font-size="13" fill="#fff" text-anchor="middle" font-weight="700" font-family="monospace" style="paint-order:stroke" stroke="rgba(0,0,0,0.18)" stroke-width="2.5">' + cur + '%</text>';
      /* 渗透率 + 风险 */
      s += '<text x="' + cx + '" y="' + (ED.bandY + ED.bandH + 14) + '" font-size="8" fill="#79828a" text-anchor="middle" font-family="monospace">' + SEG[i].k + ' mD·<tspan fill="' + rc + '" font-weight="700">' + riskWord(i) + '</tspan></text>';
      /* 滑轨 */
      s += '<rect x="' + (cx - 4) + '" y="' + ED.Y0 + '" width="8" height="' + (ED.Y1 - ED.Y0) + '" rx="4" fill="#f0ecdf" stroke="#e0dac8"/>';
      STOPS.forEach(function (v) {
        s += '<circle cx="' + cx + '" cy="' + stopY(v) + '" r="3.2" fill="' + (v <= cur ? '#2f7d6b' : '#d5cfbe') + '"/>';
      });
      /* 手柄 */
      var sy = stopY(cur);
      s += '<rect x="' + (cx - 24) + '" y="' + (sy - 8) + '" width="48" height="16" rx="8" fill="#fff" stroke="#2f7d6b" stroke-width="1.2"/>';
      s += '<text x="' + cx + '" y="' + (sy + 3.5) + '" font-size="9" fill="#235f51" text-anchor="middle" font-weight="700" font-family="monospace">' + cur + '%</text>';
      /* 见水时间 */
      var tb = SIMC.tb[i];
      s += '<text x="' + cx + '" y="208" font-size="8" fill="#8a9298" text-anchor="middle" font-family="monospace">见水≈' + tb.toFixed(0) + ' 月</text>';
    }
    s += '<text x="' + (ED.W / 2) + '" y="226" font-size="8.5" fill="#9ba3a9" text-anchor="middle">开度 0% = 该段关闭；开大加快该段见水（tb 缩短），全井液量随总开度下降（节流降液）</text>';
    $('seg-editor').innerHTML = s;
  }

  function bindEditor() {
    var svg = $('seg-editor');
    var dragIdx = -1;
    function toSvg(evt) {
      var r = svg.getBoundingClientRect();
      return { x: (evt.clientX - r.left) * (ED.W / r.width), y: (evt.clientY - r.top) * (ED.H / r.height) };
    }
    function applyY(y) {
      var v = clamp((ED.Y1 - y) / (ED.Y1 - ED.Y0) * 100, 0, 100);
      var stop = Math.round(v / 25) * 25;
      if (OPEN[dragIdx] !== stop) { OPEN[dragIdx] = stop; render(); }
    }
    function hitSeg(x, y) {
      if (y < ED.Y0 - 12 || y > ED.Y1 + 12) return -1;
      var i = Math.floor((x - ED.PL) / (ED.segW + ED.gap));
      if (i < 0 || i > 7) return -1;
      if (x - ED.PL - i * (ED.segW + ED.gap) > ED.segW) return -1;
      return i;
    }
    svg.addEventListener('mousedown', function (evt) {
      var p = toSvg(evt);
      var i = hitSeg(p.x, p.y);
      if (i >= 0) { dragIdx = i; applyY(p.y); evt.preventDefault(); }
    });
    document.addEventListener('mousemove', function (evt) {
      if (dragIdx < 0) return;
      applyY(toSvg(evt).y);
    });
    document.addEventListener('mouseup', function () { dragIdx = -1; });
  }

  /* =========================================================
     ② 分段含水热力图（canvas，HiDPI）
     ========================================================= */
  function drawHeat() {
    var cv = $('fw-heat');
    if (!cv) return;
    var W = 900, H = 196, pl = 36, pr = 96, pt = 8, pb = 22;
    var pw = W - pl - pr, ph = H - pt - pb;
    var ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);
    var cols = MONTHS + 1, rows = 8;
    var cw = pw / cols, ch = ph / rows;
    for (var i = 0; i < rows; i++) {
      for (var t = 0; t < cols; t++) {
        var f = SIMC.segFw[i][t];
        ctx.fillStyle = rampColor((f - 0.4) / 0.55);
        ctx.fillRect(pl + t * cw, pt + i * ch, Math.ceil(cw) + 0.5, Math.ceil(ch) + 0.5);
      }
    }
    ctx.strokeStyle = '#cfc7b6';
    ctx.lineWidth = 1;
    ctx.strokeRect(pl, pt, pw, ph);
    /* 行标签 + 当前开度 */
    ctx.font = '9px Consolas, monospace';
    for (i = 0; i < rows; i++) {
      ctx.fillStyle = '#79828a';
      ctx.textAlign = 'right';
      ctx.fillText('S' + (i + 1), pl - 5, pt + i * ch + ch / 2 + 3);
    }
    /* 月份刻度 */
    ctx.textAlign = 'center';
    for (var m = 0; m <= MONTHS; m += 12) {
      var x = pl + m / MONTHS * pw;
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(m + '', x, H - 8);
      ctx.strokeStyle = '#e8e2d2';
      ctx.beginPath(); ctx.moveTo(x, pt + ph); ctx.lineTo(x, pt + ph + 3); ctx.stroke();
    }
    ctx.fillText('生产时间（月）', pl + pw / 2, H - 0.5);
    /* 色标 */
    var gx = pl + pw + 12, gw = 10, gy = pt + 6, gh = ph - 40;
    for (var s = 0; s < 24; s++) {
      ctx.fillStyle = rampColor(1 - s / 23);
      ctx.fillRect(gx, gy + s * gh / 24, gw, gh / 24 + 0.5);
    }
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(gx, gy, gw, gh);
    ctx.fillStyle = '#79828a';
    ctx.textAlign = 'left';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('含水', gx - 2, gy - 2);
    ctx.fillText('高', gx + gw + 3, gy + 7);
    ctx.fillText('低', gx + gw + 3, gy + gh);
  }

  /* =========================================================
     ③ 含水率 / 日产油时序对比（SVG）
     ========================================================= */
  var TS = { W: 900, H: 330, PL: 52, PR: 64, PT: 18, PB: 36 };
  var tsHover = -1, tsRaf = 0;

  function drawTS(hoverM) {
    var W = TS.W, H = TS.H, pl = TS.PL, pr = TS.PR, pt = TS.PT, pb = TS.PB;
    var pw = W - pl - pr, ph = H - pt - pb;
    var x = function (m) { return pl + m / MONTHS * pw; };
    var yF = function (p) { return pt + ph - (p - 30) / 70 * ph; };   /* 含水率 30–100% */
    var yO = function (v) { return pt + ph - v / 200 * ph; };         /* 日产油 0–200 m³/d */

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格 + 双轴刻度（同一组水平线） */
    for (var v = 30; v <= 100; v += 10) {
      var y = yF(v);
      s += '<line x1="' + pl + '" y1="' + y + '" x2="' + (pl + pw) + '" y2="' + y + '" stroke="' + (v === 30 ? '#d8d0bc' : '#efece1') + '"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
      s += '<text x="' + (pl + pw + 5) + '" y="' + (y + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="start" font-family="monospace">' + Math.round((v - 30) / 70 * 200) + '</text>';
    }
    for (var m = 0; m <= MONTHS; m += 12) {
      s += '<line x1="' + x(m) + '" y1="' + pt + '" x2="' + x(m) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(m) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + m + '</text>';
    }

    function path(arr, yFn, scale) {
      var d = '';
      for (var t = 0; t <= MONTHS; t++) d += (t ? 'L' : 'M') + x(t).toFixed(1) + ' ' + yFn(arr[t] * scale).toFixed(1) + ' ';
      return d;
    }
    /* 日产油（先画，垫在下层） */
    s += '<path d="' + path(SIMF.qo, yO, 1) + '" fill="none" stroke="#9aa2a8" stroke-width="1.4" stroke-dasharray="4 3"/>';
    s += '<path d="' + path(SIMC.qo, yO, 1) + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';
    /* 含水率 */
    s += '<path d="' + path(SIMF.fw, yF, 100) + '" fill="none" stroke="#9aa2a8" stroke-width="1.6"/>';
    s += '<path d="' + path(SIMC.fw, yF, 100) + '" fill="none" stroke="#b05a51" stroke-width="2.2"/>';

    /* 末端标注：按 y 排序后强制相邻间隔 ≥12px */
    var ends = [
      { y: yF(SIMF.fw[MONTHS] * 100), txt: '含水·全开 ' + (SIMF.fw[MONTHS] * 100).toFixed(1) + '%', c: '#9aa2a8' },
      { y: yF(SIMC.fw[MONTHS] * 100), txt: '含水·当前 ' + (SIMC.fw[MONTHS] * 100).toFixed(1) + '%', c: '#b05a51' },
      { y: yO(SIMF.qo[MONTHS]), txt: '产油·全开 ' + SIMF.qo[MONTHS].toFixed(0), c: '#9aa2a8' },
      { y: yO(SIMC.qo[MONTHS]), txt: '产油·当前 ' + SIMC.qo[MONTHS].toFixed(0), c: '#2f7d6b' }
    ];
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) {
      if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
    }
    ends.forEach(function (e) {
      s += '<text x="' + (pl + pw - 6) + '" y="' + (clamp(e.y, pt + 6, pt + ph - 2) + 3) + '" font-size="8.5" fill="' + e.c + '" text-anchor="end" font-family="monospace" font-weight="600">' + e.txt + '</text>';
    });

    /* 悬停十字线 */
    if (hoverM >= 0 && hoverM <= MONTHS) {
      var hx = x(hoverM);
      s += '<line x1="' + hx + '" y1="' + pt + '" x2="' + hx + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 2"/>';
      s += '<text x="' + hx + '" y="' + (pt + 4) + '" font-size="8.5" fill="#5d666d" text-anchor="middle" font-family="monospace">' + hoverM + ' 月</text>';
      [
        { y: yF(SIMF.fw[hoverM] * 100), c: '#9aa2a8' },
        { y: yF(SIMC.fw[hoverM] * 100), c: '#b05a51' },
        { y: yO(SIMF.qo[hoverM]), c: '#9aa2a8' },
        { y: yO(SIMC.qo[hoverM]), c: '#2f7d6b' }
      ].forEach(function (p) {
        s += '<circle cx="' + hx + '" cy="' + p.y.toFixed(1) + '" r="3.4" fill="' + p.c + '" stroke="#fff" stroke-width="1.2"/>';
      });
    }

    s += '<text x="' + (pl - 40) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 40) + ' ' + (pt + ph / 2) + ')">含水率 (%)</text>';
    s += '<text x="' + (pl + pw + 46) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (pl + pw + 46) + ' ' + (pt + ph / 2) + ')">日产油 (m³/d)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">生产时间（月）</text>';

    $('ts-chart').innerHTML = s;
  }

  function bindTS() {
    var svg = $('ts-chart'), tip = $('ts-tip'), box = svg.parentNode;
    function monthAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (TS.W / r.width);
      return clamp(Math.round((vx - TS.PL) / (TS.W - TS.PL - TS.PR) * MONTHS), 0, MONTHS);
    }
    svg.addEventListener('mousemove', function (evt) {
      var m = monthAt(evt);
      if (!tsRaf) {
        tsRaf = requestAnimationFrame(function () { tsRaf = 0; drawTS(tsHover); });
      }
      tsHover = m;
      var rb = box.getBoundingClientRect();
      tip.innerHTML = '<b>第 ' + m + ' 月</b><br>'
        + '含水率：全开 <b>' + (SIMF.fw[m] * 100).toFixed(1) + '%</b> · 当前 <b>' + (SIMC.fw[m] * 100).toFixed(1) + '%</b><br>'
        + '日产油：全开 <b>' + SIMF.qo[m].toFixed(1) + '</b> · 当前 <b>' + SIMC.qo[m].toFixed(1) + '</b> m³/d';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 78) + 'px';
    });
    svg.addEventListener('mouseleave', function () {
      tsHover = -1;
      tip.style.display = 'none';
      drawTS(-1);
    });
  }

  /* =========================================================
     ④ 累产油 / 累产水对比柱状图（SVG）
     ========================================================= */
  function drawCum() {
    var W = 900, H = 250, pt = 34, pb = 40, pl = 60, pr = 30;
    var ph = H - pt - pb;
    var yMax = Math.max(20, Math.ceil(Math.max(SIMF.cw, SIMC.cw) / 10) * 10);
    var y = function (v) { return pt + ph - v / yMax * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var v = 0; v <= yMax; v += yMax / 4) {
      s += '<line x1="' + pl + '" y1="' + y(v) + '" x2="' + (W - pr) + '" y2="' + y(v) + '" stroke="' + (v ? '#efece1' : '#d8d0bc') + '"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v.toFixed(0) + '</text>';
    }

    var groups = [
      { name: '累产油', cx: 240, base: SIMF.co, cur: SIMC.co, cBase: '#9aa2a8', cCur: '#2f7d6b', goodUp: true },
      { name: '累产水', cx: 660, base: SIMF.cw, cur: SIMC.cw, cBase: '#8ba0c4', cCur: '#41699b', goodUp: false }
    ];
    var bw = 90, gap = 16;
    groups.forEach(function (g) {
      var x0 = g.cx - bw - gap / 2, x1 = g.cx + gap / 2;
      s += '<rect x="' + x0 + '" y="' + y(g.base).toFixed(1) + '" width="' + bw + '" height="' + (pt + ph - y(g.base)).toFixed(1) + '" rx="3" fill="' + g.cBase + '" opacity="0.85"/>';
      s += '<rect x="' + x1 + '" y="' + y(g.cur).toFixed(1) + '" width="' + bw + '" height="' + (pt + ph - y(g.cur)).toFixed(1) + '" rx="3" fill="' + g.cCur + '" opacity="0.92"/>';
      s += '<text x="' + (x0 + bw / 2) + '" y="' + (y(g.base) - 5) + '" font-size="9.5" fill="#79828a" text-anchor="middle" font-family="monospace">' + g.base.toFixed(1) + '</text>';
      s += '<text x="' + (x1 + bw / 2) + '" y="' + (y(g.cur) - 5) + '" font-size="9.5" fill="' + g.cCur + '" text-anchor="middle" font-family="monospace" font-weight="700">' + g.cur.toFixed(1) + '</text>';
      s += '<text x="' + (x0 + bw / 2) + '" y="' + (pt + ph + 14) + '" font-size="8.5" fill="#8a9298" text-anchor="middle">固定全开</text>';
      s += '<text x="' + (x1 + bw / 2) + '" y="' + (pt + ph + 14) + '" font-size="8.5" fill="' + g.cCur + '" text-anchor="middle">当前策略</text>';
      s += '<text x="' + g.cx + '" y="' + (pt + ph + 30) + '" font-size="10" fill="#4d565b" text-anchor="middle" font-weight="600">' + g.name + '</text>';
      var d = (g.cur / g.base - 1) * 100;
      var good = g.goodUp ? d > 0 : d < 0;
      s += '<text x="' + g.cx + '" y="' + (pt - 16) + '" font-size="11" fill="' + (good ? '#235f51' : '#b05a51') + '" text-anchor="middle" font-family="monospace" font-weight="700">' + (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '%</text>';
    });
    s += '<text x="' + (pl - 44) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 44) + ' ' + (pt + ph / 2) + ')">5 年累计（万 m³）</text>';
    $('cum-chart').innerHTML = s;
  }

  /* ---------- 指标卡与结论 ---------- */
  function renderMetrics() {
    var dO = (SIMC.co / SIMF.co - 1) * 100;
    var dW = (SIMC.cw / SIMF.cw - 1) * 100;
    var inc = (SIMC.fw60 - SIMC.fw1) * 100, incF = (SIMF.fw60 - SIMF.fw1) * 100;
    var dL = (SIMC.cl / SIMF.cl - 1) * 100;

    $('m-oil').innerHTML = SIMC.co.toFixed(1) + '<small> 万m³（' + (dO >= 0 ? '+' : '−') + Math.abs(dO).toFixed(1) + '%）</small>';
    $('m-oil').parentNode.className = 'mcard' + (dO < 0 ? ' bad' : '');
    $('m-water').innerHTML = SIMC.cw.toFixed(1) + '<small> 万m³（' + (dW >= 0 ? '+' : '−') + Math.abs(dW).toFixed(1) + '%）</small>';
    $('m-water').parentNode.className = 'mcard' + (dW > 0 ? ' bad' : '');
    $('m-fw60').innerHTML = (SIMC.fw60 * 100).toFixed(1) + '<small> %（全开 ' + (SIMF.fw60 * 100).toFixed(1) + '%）</small>';
    $('m-fwinc').innerHTML = inc.toFixed(1) + '<small> 百分点（全开 ' + incF.toFixed(1) + '）</small>';
    $('m-liq').innerHTML = (100 + dL).toFixed(1) + '<small> %（' + (dL >= 0 ? '+' : '−') + Math.abs(dL).toFixed(1) + '%）</small>';
    $('m-liq').parentNode.className = 'mcard' + (dL < -15 ? ' warn' : '');

    var v = $('verdict');
    if (dO >= 3 && dW <= -3) {
      v.className = 'verdict ok';
      v.innerHTML = '当前策略有效：5 年累产油 <b>' + (dO >= 0 ? '+' : '') + dO.toFixed(1) + '%</b>（' + SIMF.co.toFixed(1) + ' → ' + SIMC.co.toFixed(1) + ' 万m³）、累产水 <b>' + dW.toFixed(1) + '%</b>、末期含水 <b>' + (SIMC.fw60 * 100).toFixed(1) + '%</b>（全开 ' + (SIMF.fw60 * 100).toFixed(1) + '%）。收益来源：压小高渗段（S4/S7）推迟见水，把液量让给低渗低含水段。';
    } else if (dO >= -2) {
      v.className = 'verdict warn';
      v.innerHTML = '与固定全开基本持平（累产油 ' + (dO >= 0 ? '+' : '') + dO.toFixed(1) + '%、累产水 ' + dW.toFixed(1) + '%）。试试「强化学习策略」预设，或手动关小高渗段 S4 / S7。';
    } else {
      v.className = 'verdict bad';
      v.innerHTML = '累产油低于全开（' + dO.toFixed(1) + '%）：关小的段过多或关错了段——低渗段 S3/S6 被关小会白白损失液量，节流降液得不偿失。';
    }
  }

  /* ---------- 预设按钮 ---------- */
  function sameAs(p) { return OPEN.every(function (v, i) { return v === p[i]; }); }
  function updatePresetNote() {
    var btns = { full: $('btn-full'), exp: $('btn-exp'), rl: $('btn-rl') };
    Object.keys(btns).forEach(function (k) { btns[k].classList.toggle('on', sameAs(PRESETS[k])); });
    var note = $('preset-note');
    if (sameAs(PRESETS.rl)) note.innerHTML = '当前：<b>强化学习策略</b>——压小高渗段 S4/S7，放大低渗段 S3/S6';
    else if (sameAs(PRESETS.full)) note.innerHTML = '当前：<b>固定全开</b>——现场基线做法（长期全开、季度调整）';
    else if (sameAs(PRESETS.exp)) note.innerHTML = '当前：<b>经验开度</b>——凭地质认识粗略关小高渗段';
    else note.innerHTML = '当前：<b>自定义策略</b>——拖动档位柱实时重算';
  }
  function bindPresets() {
    $('btn-full').addEventListener('click', function () { OPEN = PRESETS.full.slice(); render(); });
    $('btn-exp').addEventListener('click', function () { OPEN = PRESETS.exp.slice(); render(); });
    $('btn-rl').addEventListener('click', function () { OPEN = PRESETS.rl.slice(); render(); });
  }

  function render() {
    SIMC = simulate(OPEN);
    drawEditor();
    drawHeat();
    drawTS(tsHover);
    drawCum();
    renderMetrics();
    updatePresetNote();
    save();
  }

  bindTabs();
  bindEditor();
  bindTS();
  bindPresets();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawHeat(); }, 120);
  });

  /* =========================================================
     真实数据来源页：公开文献量化结果
     ========================================================= */
  var LIT_BARS = [
    { label: '本案例 · SAC · 累产油', v: 11.4, tip: '本案例储层模拟器结果（12 口水平井 × 8 级滑套）：5 年累产油 +11.4%' },
    { label: '本案例 · SAC · 累产水', v: -8.6, tip: '本案例储层模拟器结果：累产水 −8.6%，含水上升率 2.4 → 1.2 个百分点/年' },
    { label: '李斌旺 & 汪志明 2026 · 累产油', v: 10.7, tip: '计算物理（网络首发），DOI 10.19596/j.cnki.1001-246x.9221：PER-MADDPG 滑套开度优化，累产油 +10.7%（对比 DDPG/MADDPG）' },
    { label: '李斌旺 & 汪志明 2026 · 综合含水', v: -6.4, tip: '同上：2 年后综合含水率下降 6.4%' },
    { label: 'Nasir & Durlofsky 2022 · NPV（2D）', v: 15, tip: 'JPSE 218 / arXiv:2203.13375：DRL 闭环井控，NPV 较先验模型稳健优化 +15%（2D 水驱）' },
    { label: 'Nasir & Durlofsky 2022 · NPV（3D）', v: 33, tip: '同上：+33%（3D 水驱，地质不确定）；较传统 CLRM 平均 +4%' },
    { label: 'Taghavi et al. 2024 · 累产油', v: 48.7, tip: 'SPE-218393-PA（SPE J. 29(4)）：AICV 完井累产油 +48.7%（vs ICD / 筛管，薄油环油藏 CMG 模拟）' },
    { label: 'Taghavi et al. 2024 · 累产气(vs ICD)', v: -22.5, tip: '同上：累产气 −22.5%（vs ICD）' },
    { label: 'Taghavi et al. 2024 · 累产气(vs筛管)', v: -26.7, tip: '同上：累产气 −26.7%（vs 筛管）' }
  ];

  var LIT_TABLE = [
    { src: 'Yeten, Durlofsky & Aziz (2002), SPE 79031', method: '共轭梯度优化 + 商业模拟器多段井模型', data: '智能井 ICV 开度优化奠基工作：井下传感器 + 流入控制阀，目标最大化产油 / 最小化水气产出', link: 'https://doi.org/10.2118/79031-MS', lt: 'DOI↗' },
    { src: 'Brouwer & Jansen (2004), SPE J. 9(4):391–402', method: '最优控制理论（SPE-78278-PA）', data: '定井底压力工况：智能井收益主要为「减少产水」而非增加产油；定产液工况：有大幅提速增产空间', link: 'https://doi.org/10.2118/78278-PA', lt: 'DOI↗' },
    { src: 'Nasir & Durlofsky (2022), JPSE 218 / arXiv:2203.13375', method: '深度强化学习闭环井控（2D/3D 水驱、地质不确定）', data: 'NPV 较先验模型稳健优化 +15%（2D）/ +33%（3D）；较传统闭环油藏建模（CLRM）平均 +4%', link: 'https://arxiv.org/abs/2203.13375', lt: 'arXiv↗' },
    { src: 'Taghavi et al. (2024), SPE J. 29(4)（SPE-218393-PA）', method: 'AICV 自主流入控制阀，薄油环油藏（CMG STARS 模拟）', data: '累产油 +48.7%（vs ICD / 筛管）；累产气 −22.5%（vs ICD）、−26.7%（vs 筛管）；更长时间保持有利 GOR', link: 'https://doi.org/10.2118/218393-PA', lt: 'DOI↗' },
    { src: '李斌旺、汪志明（计算物理，2026 网络首发）', method: 'PER-MADDPG 多智能体强化学习，水平井滑套开度', data: '累产油 +10.7%；2 年后综合含水率 −6.4%（对比 DDPG / MADDPG）；样本利用率显著提升', link: 'http://jswl.xml-journal.net/article/doi/10.19596/j.cnki.1001-246x.9221', lt: '期刊页↗' },
    { src: 'Haarnoja, Zhou, Abbeel & Levine (2018), ICML, PMLR 80:1861–1870', method: 'SAC 算法原始论文（本案例算法）', data: '最大熵离线策略 actor-critic，兼顾样本效率与稳定性；21 维连续动作 Humanoid 基准稳定收敛（DDPG 难以求解）', link: 'https://proceedings.mlr.press/v80/haarnoja18b.html', lt: 'PMLR↗' }
  ];

  function drawLit() {
    var svg = $('lit-chart');
    if (!svg) return;
    var W = 900, H = 300, pl = 206, pr = 86, pt = 24, pb = 32;
    var pw = W - pl - pr, ph = H - pt - pb;
    var xmin = -35, xmax = 55;
    var x = function (v) { return pl + (v - xmin) / (xmax - xmin) * pw; };
    var n = LIT_BARS.length, rowH = ph / n, barH = 14;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var v = -30; v <= 50; v += 10) {
      s += '<line x1="' + x(v) + '" y1="' + pt + '" x2="' + x(v) + '" y2="' + (pt + ph) + '" stroke="' + (v === 0 ? '#b9b1a0' : '#efece1') + '" stroke-width="' + (v === 0 ? 1.2 : 1) + '"/>';
      s += '<text x="' + x(v) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + (v > 0 ? '+' : '') + v + '</text>';
    }
    LIT_BARS.forEach(function (b, i) {
      var cy = pt + rowH * (i + 0.5);
      var x0 = x(Math.min(0, b.v)), x1 = x(Math.max(0, b.v));
      var c = b.v > 0 ? '#2f7d6b' : '#41699b';
      s += '<rect data-idx="' + i + '" x="' + x0.toFixed(1) + '" y="' + (cy - barH / 2).toFixed(1) + '" width="' + Math.max(2, x1 - x0).toFixed(1) + '" height="' + barH + '" rx="3" fill="' + c + '" opacity="0.88" style="cursor:default"/>';
      s += '<text x="' + (pl - 8) + '" y="' + (cy + 3) + '" font-size="8.5" fill="#4d565b" text-anchor="end">' + b.label + '</text>';
      var vt = (b.v > 0 ? '+' : '−') + Math.abs(b.v) + '%';
      if (b.v > 0) s += '<text x="' + (x1 + 5) + '" y="' + (cy + 3) + '" font-size="8.5" fill="' + c + '" font-family="monospace" font-weight="700">' + vt + '</text>';
      else s += '<text x="' + (x0 - 5) + '" y="' + (cy + 3) + '" font-size="8.5" fill="' + c + '" text-anchor="end" font-family="monospace" font-weight="700">' + vt + '</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">相对基线变化（%）　← 蓝：产水 / 产气下降　｜　绿：产油 / NPV 提升 →</text>';
    svg.innerHTML = s;
  }

  function bindLit() {
    var svg = $('lit-chart'), tip = $('lit-tip');
    if (!svg || !tip) return;
    var box = svg.parentNode;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (900 / r.width);
      var vy = (evt.clientY - r.top) * (300 / r.height);
      var rowH = (300 - 24 - 32) / LIT_BARS.length;
      var i = Math.floor((vy - 24) / rowH);
      if (i >= 0 && i < LIT_BARS.length && vx > 206) {
        var b = LIT_BARS[i];
        tip.innerHTML = '<b>' + b.label + '</b><br>' + b.tip;
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 240) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 76) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function buildLitTable() {
    var body = $('lit-body');
    if (!body) return;
    LIT_TABLE.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + r.src + '</td><td>' + r.method + '</td><td>' + r.data + '</td><td><a href="' + r.link + '" target="_blank" rel="noopener">' + r.lt + '</a></td>';
      body.appendChild(tr);
    });
  }

  drawLit();
  bindLit();
  buildLitTable();
})();
