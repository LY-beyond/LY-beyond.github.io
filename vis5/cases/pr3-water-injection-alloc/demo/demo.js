/* ======= 分层注水智能调配 · 可运行示范 ======= */
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
     集总代理模型：4 个开发层系，效率 η 按渗透率分级
     ========================================================= */
  var LAYERS = [
    { id: 'ed1', name: '东一段 Ed1', k: 180, color: '#c9a15a', q0: 650,  opt: 700, eta: 0.62, cap: 1e9, tag: '吸水正常' },
    { id: 'ed2', name: '东二段 Ed2', k: 680, color: '#b05a51', q0: 1100, opt: 820, eta: 0.30, cap: 1e9, tag: '水窜优势通道' },
    { id: 'ed3', name: '东三段 Ed3', k: 45,  color: '#41699b', q0: 380,  opt: 560, eta: 0.95, cap: 640, tag: '吸水差 · 剩余油富集' },
    { id: 'ed4', name: '东四段 Ed4', k: 120, color: '#2f7d6b', q0: 470,  opt: 520, eta: 0.70, cap: 1e9, tag: '吸水正常' }
  ];
  var Q0_TOT = 2600;          /* 现状总配注 m³/d */
  var QO0 = 465;              /* 基线日产油 t/d */
  var DECL = 0.008;           /* 月自然递减率 */
  var FW0 = 81.3;             /* 综合含水 % */
  var MONTHS = 6;             /* 预测窗口：未来 2 个季度 */

  var Q = LAYERS.map(function (l) { return l.q0; });

  /* 实注量：低渗东三段超过吸水能力上限（640）的部分按 75% 折算（配注≠实注） */
  function realInj(i, q) {
    var cap = LAYERS[i].cap;
    return q <= cap ? q : cap + (q - cap) * 0.75;
  }

  function simulate() {
    var qr = Q.map(function (q, i) { return realInj(i, q); });
    var dE = 0, dQr = 0, i;
    for (i = 0; i < 4; i++) {
      dE += (qr[i] - LAYERS[i].q0) * LAYERS[i].eta;
      dQr += qr[i] - LAYERS[i].q0;
    }
    var oilGain = dE * 0.000275;                                   /* 稳态产油增量（比例） */
    var cWater = (LAYERS[1].q0 - qr[1]) * 0.0025 + (qr[2] - LAYERS[2].q0) * 0.0011;
    var fwRate = clamp(2.8 - cWater, 0.3, 6);                      /* 含水上升率 %/年 */
    var es = 41 + (LAYERS[1].q0 - qr[1]) * 0.0095
               + (qr[2] - LAYERS[2].q0) * 0.004 + dQr * 0.0004;    /* 存水率 % */
    var qoBase = [], qoCur = [], fwBase = [], fwCur = [];
    for (var t = 0; t <= MONTHS; t++) {
      qoBase[t] = QO0 * (1 - DECL * t);
      qoCur[t] = qoBase[t] * (1 + oilGain * (1 - Math.exp(-t / 1.8)));
      fwBase[t] = FW0 + 2.8 * t / 12;
      fwCur[t] = FW0 + fwRate * t / 12;
    }
    var qtot = Q.reduce(function (a, b) { return a + b; }, 0);
    return { qr: qr, oilGain: oilGain, fwRate: fwRate, es: es,
             qoBase: qoBase, qoCur: qoCur, fwBase: fwBase, fwCur: fwCur, qtot: qtot };
  }

  var SIM = simulate();

  /* =========================================================
     ① 分层配注对比条（SVG）
     ========================================================= */
  function drawAllocBars() {
    var W = 900, H = 190, x0 = 170, x1 = 860, vmax = 1400;
    var x = function (v) { return x0 + v / vmax * (x1 - x0); };
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    [0, 350, 700, 1050, 1400].forEach(function (v) {
      s += '<line x1="' + x(v) + '" y1="14" x2="' + x(v) + '" y2="168" stroke="' + (v ? '#efece1' : '#d8d0bc') + '"/>';
      s += '<text x="' + x(v) + '" y="182" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
    });
    LAYERS.forEach(function (l, i) {
      var yc = 34 + i * 40;
      s += '<rect x="8" y="' + (yc - 16) + '" width="10" height="26" rx="2" fill="' + l.color + '"/>';
      s += '<text x="24" y="' + (yc - 4) + '" font-size="9.5" fill="#2f3538" font-weight="600">' + l.name + '</text>';
      s += '<text x="24" y="' + (yc + 10) + '" font-size="8" fill="#8a9298" font-family="monospace">' + l.k + ' mD · η=' + l.eta.toFixed(2) + '</text>';
      /* 当前配注条 */
      var wc = x(Q[i]) - x0;
      s += '<rect x="' + x0 + '" y="' + (yc - 14) + '" width="' + wc.toFixed(1) + '" height="10" rx="2.5" fill="' + l.color + '" opacity="0.88"/>';
      s += '<text x="' + (x(Q[i]) + 5) + '" y="' + (yc - 5) + '" font-size="9" fill="#2f3538" font-family="monospace" font-weight="600">' + Q[i] + '</text>';
      /* 建议配注条 */
      var wo = x(l.opt) - x0;
      s += '<rect x="' + x0 + '" y="' + (yc + 2) + '" width="' + wo.toFixed(1) + '" height="10" rx="2.5" fill="#c9a15a" opacity="0.55" stroke="#c9a15a" stroke-width="0.8"/>';
      s += '<text x="' + (x(l.opt) + 5) + '" y="' + (yc + 11) + '" font-size="9" fill="#9a7a1c" font-family="monospace">建议 ' + l.opt + '</text>';
      /* 变化量标注 */
      var d = Q[i] - l.q0;
      if (d !== 0) {
        s += '<text x="' + (x1 + 4) + '" y="' + (yc - 5) + '" font-size="8.5" fill="' + (d > 0 ? '#235f51' : '#b05a51') + '" font-family="monospace" text-anchor="start">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</text>';
      }
    });
    $('alloc-bars').innerHTML = s;
  }

  /* =========================================================
     ② 井组连通与层系剖面示意（canvas，HiDPI）
     ========================================================= */
  var seed = 20261101;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var INJ = [], PROD = [];
  (function layoutWells() {
    var c, r;
    for (r = 0; r < 4; r++) {
      for (c = 0; c < 6; c++) {
        INJ.push({ x: 62 + c * 64 + (rnd() - 0.5) * 20, y: 58 + r * 60 + (rnd() - 0.5) * 18 });
      }
    }
    for (var i = 0; i < 58; i++) {
      PROD.push({ x: 36 + rnd() * 400, y: 34 + rnd() * 236 });
    }
  })();
  var CHANNELS = [[8, 5], [15, 23], [21, 41]];   /* 水窜优势通道：注水井 → 油井 */
  var REMAIN = [{ x: 150, y: 215 }, { x: 365, y: 95 }]; /* 剩余油富集区 */

  function drawMap() {
    var cv = $('map-canvas');
    if (!cv) return;
    var W = 900, H = 300;
    var ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);
    var qr = SIM.qr;

    /* ---- 左：区块井位 ---- */
    ctx.fillStyle = '#5d666d';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('井组连通示意（24 注水井 / 58 油井）', 24, 16);
    ctx.strokeStyle = '#e0dac8';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, 422, 254);

    /* 弱连通线：每口注水井连最近的 2 口油井 */
    ctx.strokeStyle = '#8a9298';
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.14;
    INJ.forEach(function (iw) {
      var ds = PROD.map(function (p, j) { return { j: j, d: (p.x - iw.x) * (p.x - iw.x) + (p.y - iw.y) * (p.y - iw.y) }; });
      ds.sort(function (a, b) { return a.d - b.d; });
      for (var k = 0; k < 2; k++) {
        var p = PROD[ds[k].j];
        ctx.beginPath(); ctx.moveTo(iw.x, iw.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;

    /* 油井 */
    PROD.forEach(function (p) {
      ctx.fillStyle = '#41699b';
      ctx.globalAlpha = 0.72;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    /* 水窜优势通道（线宽 ∝ 东二段实注） */
    var cw = 1.5 + 5 * (qr[1] / 1100);
    CHANNELS.forEach(function (ch, k) {
      var a = INJ[ch[0]], b = PROD[ch[1]];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var off = (k % 2 ? -1 : 1) * 26;
      var cx = mx - dy / len * off, cy = my + dx / len * off;
      ctx.strokeStyle = '#b05a51';
      ctx.lineWidth = cw;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke();
      ctx.globalAlpha = 1;
      if (k === 0) {
        var t = 0.5, qx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x;
        var qy = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(253,252,249,0.92)';
        ctx.strokeText('水窜通道', qx, qy - 8);
        ctx.fillStyle = '#b05a51';
        ctx.fillText('水窜通道', qx, qy - 8);
      }
    });

    /* 剩余油富集区（半径随东三段实注接近建议值而收缩） */
    var rr = clamp(24 + 16 * (1 - qr[2] / 560), 12, 44);
    REMAIN.forEach(function (z) {
      ctx.strokeStyle = '#41699b';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(z.x, z.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#41699b';
      ctx.globalAlpha = 0.05;
      ctx.beginPath(); ctx.arc(z.x, z.y, rr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(253,252,249,0.92)';
      ctx.strokeText('剩余油富集', z.x, z.y + rr + 11);
      ctx.fillStyle = '#41699b';
      ctx.fillText('剩余油富集', z.x, z.y + rr + 11);
    });

    /* 注水井 */
    INJ.forEach(function (w) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#2f7d6b';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(w.x, w.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });

    /* ---- 分隔线 ---- */
    ctx.strokeStyle = '#e0dac8';
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(480, 20); ctx.lineTo(480, 284); ctx.stroke();
    ctx.setLineDash([]);

    /* ---- 右：层系剖面 ---- */
    ctx.fillStyle = '#5d666d';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('层系剖面与当前配注（垂向示意）', 494, 16);
    ctx.font = '8.5px sans-serif';
    ctx.fillStyle = '#8a9298';
    ctx.textAlign = 'center';
    ctx.fillText('当前配注', 548, 30);

    LAYERS.forEach(function (l, i) {
      var y = 34 + i * 62, lh = 52;
      /* 配注箭头 */
      var aw = 1.5 + 12 * (qr[i] / 1100);
      var ay = y + lh / 2;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = aw;
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.moveTo(510, ay); ctx.lineTo(592, ay); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(600, ay); ctx.lineTo(590, ay - 5); ctx.lineTo(590, ay + 5);
      ctx.closePath(); ctx.fill();
      ctx.font = '9px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(qr[i]) + '', 550, y + 12);
      /* 层矩形 */
      ctx.fillStyle = l.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(600, y, 260, lh, 5); } else { ctx.rect(600, y, 260, lh); }
      ctx.fill();
      ctx.globalAlpha = 1;
      /* 层内文字 */
      ctx.fillStyle = '#fff';
      ctx.font = '600 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(l.name + ' · ' + l.k + ' mD', 610, y + 21);
      ctx.font = '8.5px sans-serif';
      ctx.globalAlpha = 0.88;
      ctx.fillText('η=' + l.eta.toFixed(2) + ' · ' + l.tag, 610, y + 38);
      ctx.textAlign = 'right';
      ctx.font = '9px Consolas, monospace';
      ctx.fillText('实注 ' + Math.round(qr[i]), 850, y + 21);
      ctx.fillText('建议 ' + l.opt, 850, y + 38);
      ctx.globalAlpha = 1;
    });
  }

  /* =========================================================
     ③ 产油 / 含水时序对比（SVG，双轴）
     ========================================================= */
  var TS = { W: 900, H: 330, PL: 52, PR: 64, PT: 18, PB: 36 };
  var tsHover = -1, tsRaf = 0;

  function drawTS(hoverM) {
    var W = TS.W, H = TS.H, pl = TS.PL, pr = TS.PR, pt = TS.PT, pb = TS.PB;
    var pw = W - pl - pr, ph = H - pt - pb;
    var x = function (m) { return pl + m / MONTHS * pw; };
    var yO = function (v) { return pt + ph - (v - 360) / 160 * ph; };   /* 日产油 360–520 t/d */
    var yF = function (v) { return pt + ph - (v - 80.5) / 4 * ph; };    /* 含水率 80.5–84.5 % */

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格 + 双轴刻度（同一组水平线） */
    for (var k = 0; k <= 8; k++) {
      var vo = 360 + k * 20, vf = 80.5 + k * 0.5;
      var y = yO(vo);
      s += '<line x1="' + pl + '" y1="' + y + '" x2="' + (pl + pw) + '" y2="' + y + '" stroke="' + (k ? '#efece1' : '#d8d0bc') + '"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + vo + '</text>';
      s += '<text x="' + (pl + pw + 5) + '" y="' + (y + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="start" font-family="monospace">' + vf.toFixed(1) + '</text>';
    }
    for (var m = 0; m <= MONTHS; m++) {
      s += '<line x1="' + x(m) + '" y1="' + pt + '" x2="' + x(m) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(m) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + m + '</text>';
    }
    /* 季度分隔 */
    s += '<line x1="' + x(3) + '" y1="' + pt + '" x2="' + x(3) + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + x(1.5) + '" y="' + (pt + 10) + '" font-size="9" fill="#9a7a1c" text-anchor="middle">第 1 季度</text>';
    s += '<text x="' + x(4.5) + '" y="' + (pt + 10) + '" font-size="9" fill="#9a7a1c" text-anchor="middle">第 2 季度</text>';

    function path(arr, yFn) {
      var d = '';
      for (var t = 0; t <= MONTHS; t++) d += (t ? 'L' : 'M') + x(t).toFixed(1) + ' ' + yFn(arr[t]).toFixed(1) + ' ';
      return d;
    }
    /* 日产油（先画，垫在下层） */
    s += '<path d="' + path(SIM.qoBase, yO) + '" fill="none" stroke="#9aa2a8" stroke-width="1.4" stroke-dasharray="4 3"/>';
    s += '<path d="' + path(SIM.qoCur, yO) + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';
    /* 含水率 */
    s += '<path d="' + path(SIM.fwBase, yF) + '" fill="none" stroke="#9aa2a8" stroke-width="1.6"/>';
    s += '<path d="' + path(SIM.fwCur, yF) + '" fill="none" stroke="#b05a51" stroke-width="2.2"/>';

    /* 末端标注：按 y 排序后强制相邻间隔 ≥12px */
    var ends = [
      { y: yF(SIM.fwBase[MONTHS]), txt: '含水·现状 ' + SIM.fwBase[MONTHS].toFixed(1) + '%', c: '#9aa2a8' },
      { y: yF(SIM.fwCur[MONTHS]), txt: '含水·当前 ' + SIM.fwCur[MONTHS].toFixed(1) + '%', c: '#b05a51' },
      { y: yO(SIM.qoBase[MONTHS]), txt: '产油·现状 ' + SIM.qoBase[MONTHS].toFixed(0), c: '#9aa2a8' },
      { y: yO(SIM.qoCur[MONTHS]), txt: '产油·当前 ' + SIM.qoCur[MONTHS].toFixed(0), c: '#2f7d6b' }
    ];
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var e = 1; e < ends.length; e++) {
      if (ends[e].y - ends[e - 1].y < 12) ends[e].y = ends[e - 1].y + 12;
    }
    ends.forEach(function (en) {
      s += '<text x="' + (pl + pw - 6) + '" y="' + (clamp(en.y, pt + 6, pt + ph - 2) + 3) + '" font-size="8.5" fill="' + en.c + '" text-anchor="end" font-family="monospace" font-weight="600" style="paint-order:stroke" stroke="#fdfcf9" stroke-width="3">' + en.txt + '</text>';
    });

    /* 悬停十字线 */
    if (hoverM >= 0 && hoverM <= MONTHS) {
      var hx = x(hoverM);
      s += '<line x1="' + hx + '" y1="' + pt + '" x2="' + hx + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 2"/>';
      s += '<text x="' + hx + '" y="' + (pt + ph + 26) + '" font-size="8.5" fill="#5d666d" text-anchor="middle" font-family="monospace">' + hoverM + ' 月</text>';
      [
        { y: yF(SIM.fwBase[hoverM]), c: '#9aa2a8' },
        { y: yF(SIM.fwCur[hoverM]), c: '#b05a51' },
        { y: yO(SIM.qoBase[hoverM]), c: '#9aa2a8' },
        { y: yO(SIM.qoCur[hoverM]), c: '#2f7d6b' }
      ].forEach(function (p) {
        s += '<circle cx="' + hx + '" cy="' + p.y.toFixed(1) + '" r="3.4" fill="' + p.c + '" stroke="#fff" stroke-width="1.2"/>';
      });
    }

    s += '<text x="' + (pl - 40) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 40) + ' ' + (pt + ph / 2) + ')">日产油 (t/d)</text>';
    s += '<text x="' + (pl + pw + 46) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (pl + pw + 46) + ' ' + (pt + ph / 2) + ')">含水率 (%)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">预测时间（月，未来 2 个季度）</text>';

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
        + '日产油：现状 <b>' + SIM.qoBase[m].toFixed(1) + '</b> · 当前 <b>' + SIM.qoCur[m].toFixed(1) + '</b> t/d<br>'
        + '含水率：现状 <b>' + SIM.fwBase[m].toFixed(1) + '%</b> · 当前 <b>' + SIM.fwCur[m].toFixed(1) + '%</b>';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 220) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 78) + 'px';
    });
    svg.addEventListener('mouseleave', function () {
      tsHover = -1;
      tip.style.display = 'none';
      drawTS(-1);
    });
  }

  /* ---------- 指标卡与结论 ---------- */
  function renderMetrics() {
    var gainPct = SIM.oilGain * 100;
    var dev = (SIM.qtot / Q0_TOT - 1) * 100;

    $('m-oil').innerHTML = (gainPct >= 0 ? '+' : '−') + Math.abs(gainPct).toFixed(1) + '<small> %（稳态）</small>';
    $('m-oil').parentNode.className = 'mcard' + (gainPct < 0 ? ' bad' : (gainPct < 2 ? ' warn' : ''));

    $('m-fwrate').innerHTML = SIM.fwRate.toFixed(2) + '<small> %/年（现状 2.8）</small>';
    $('m-fwrate').parentNode.className = 'mcard' + (SIM.fwRate > 2.8 ? ' bad' : (SIM.fwRate > 2.0 ? ' warn' : ''));

    $('m-es').innerHTML = SIM.es.toFixed(1) + '<small> %（现状 41.0）</small>';
    $('m-es').parentNode.className = 'mcard' + (SIM.es < 41 ? ' bad' : '');

    $('m-fw6').innerHTML = SIM.fwCur[MONTHS].toFixed(1) + '<small> %（外推 ' + SIM.fwBase[MONTHS].toFixed(1) + '%）</small>';

    $('m-qtot').innerHTML = SIM.qtot + '<small> m³/d（' + (dev >= 0 ? '+' : '−') + Math.abs(dev).toFixed(1) + '%）</small>';
    $('m-qtot').parentNode.className = 'mcard' + (Math.abs(dev) > 5 ? ' bad' : '');

    var v = $('verdict');
    var head = 'ΔE = <b>' + (SIM.oilGain / 0.000275).toFixed(0) + '</b> m³/d（效率加权）· 稳态产油 <b>' + (gainPct >= 0 ? '+' : '') + gainPct.toFixed(1) + '%</b> · 含水上升率 <b>' + SIM.fwRate.toFixed(2) + '%/年</b>；';
    var capNote = (Q[2] > LAYERS[2].cap) ? '东三段配注 ' + Q[2] + ' 超吸水能力上限 640 m³/d，超出部分实注按 75% 折算（实注 ' + Math.round(SIM.qr[2]) + '）。' : '';
    if (Math.abs(dev) > 5) {
      v.className = 'verdict bad';
      v.innerHTML = head + '总配注 ' + SIM.qtot + ' m³/d 偏离现状 <b>' + Math.abs(dev).toFixed(1) + '%</b>，违反总水量 ±5% 硬约束，优化器不会采纳该方案——请把总水量调回 ' + (Q0_TOT * 0.95) + '–' + (Q0_TOT * 1.05) + ' m³/d。' + capNote;
    } else if (gainPct >= 3.5 && SIM.fwRate <= 2.0) {
      v.className = 'verdict ok';
      v.innerHTML = head + '接近推荐方案：压减高渗东二段（水窜层）补水给低渗东三段（剩余油层），达成「季度增油 ≥+4%、含水上升率 ≤2.0%/年」的案例验收口径。' + capNote;
    } else if (gainPct < 0 || SIM.fwRate > 2.8) {
      v.className = 'verdict bad';
      v.innerHTML = head + '不如维持现状：' + (gainPct < 0 ? '有效注水增量为负（油可能被「越注越少」——多半是把水从高效低渗层挪去了低效高渗层）' : '含水上升加快（多半是东二段高渗层加注水窜加剧）') + '。点「一键优化」恢复建议值。' + capNote;
    } else {
      v.className = 'verdict warn';
      v.innerHTML = head + '方向正确但幅度不足：继续压减东二段（建议 820 m³/d）、增补东三段（建议 560 m³/d）可到推荐方案；验收须同时看产油增量、含水上升率与存水率。' + capNote;
    }
  }

  function sameAs(arr) { return Q.every(function (v, i) { return v === arr[i]; }); }
  function updatePresetNote() {
    var note = $('preset-note');
    $('btn-opt').classList.toggle('on', sameAs(LAYERS.map(function (l) { return l.opt; })));
    $('btn-cur').classList.toggle('on', sameAs(LAYERS.map(function (l) { return l.q0; })));
    if (sameAs(LAYERS.map(function (l) { return l.opt; }))) {
      note.innerHTML = '当前：<b>优化建议方案</b>——东二段 −280、东三段 +180，总水量不变';
    } else if (sameAs(LAYERS.map(function (l) { return l.q0; }))) {
      note.innerHTML = '当前：<b>现状配注</b>——高渗东二段超注、低渗东三段欠注';
    } else {
      note.innerHTML = '当前：<b>自定义方案</b>——拖动滑块实时重算';
    }
  }

  function syncSliders() {
    LAYERS.forEach(function (l, i) {
      $('s-' + l.id).value = Q[i];
      $('o-' + l.id).textContent = Q[i] + ' m³/d';
    });
  }

  function render() {
    SIM = simulate();
    drawAllocBars();
    drawMap();
    drawTS(tsHover);
    renderMetrics();
    updatePresetNote();
  }

  function bindControls() {
    LAYERS.forEach(function (l, i) {
      $('s-' + l.id).addEventListener('input', function () {
        Q[i] = parseInt(this.value, 10);
        $('o-' + l.id).textContent = Q[i] + ' m³/d';
        render();
      });
    });
    $('btn-opt').addEventListener('click', function () {
      Q = LAYERS.map(function (l) { return l.opt; });
      syncSliders();
      render();
    });
    $('btn-cur').addEventListener('click', function () {
      Q = LAYERS.map(function (l) { return l.q0; });
      syncSliders();
      render();
    });
  }

  bindTabs();
  bindControls();
  bindTS();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawMap(); }, 120);
  });

  /* =========================================================
     真实数据来源页：公开文献 / 报道量化结果
     ========================================================= */
  var LIT_BARS = [
    { label: '本案例 · 季度增油（验收）', v: 4.2, tip: '本案例验收口径：执行后 2 个季度对比无调整外推，季度增油 +4.2%；含水上升率 2.8%→1.9%/年；存水率 41%→44.4%' },
    { label: '新疆L9油藏 · 累产油（2年）', v: 4.6, tip: '中国科技论文：强非均质多层系双高油藏智能分注调控，实施典型井组调整 2 年，累产油 +4.6%、累注水 −3.3%、井区含水率 −2.6 个百分点' },
    { label: '红18井区 · 日产油', v: 28, tip: '中国石油新闻（2025-12）：新疆油田采油一厂克下组智能分注，区块日产油量提升超 28%、综合含水率下降 2.8%' },
    { label: 'JPT 流线调配 · 日产油', v: 2, tip: 'JPT：流线监测更新配注目标可带来全油田日产 +1%–10%（超出自然递减基线）；图中取阿曼稠油水驱 +2% 报道值' },
    { label: 'MDPI 2023 · 年产油', v: 1.3, tip: 'Processes 11(10):2816：基于连通性方法的强非均质砂岩多层油藏注采实时优化，年产油 +1.3%' },
    { label: '本案例 · 含水上升率（相对）', v: -32.1, tip: '本案例验收口径：含水上升率 2.8%→1.9%/年，相对下降约 32%' },
    { label: '红18井区 · 含水上升率（相对）', v: -30, tip: '中国石油新闻（2025-12）：智能分注后含水上升率下降超 30%' },
    { label: '新疆L9油藏 · 累注水（2年）', v: -3.3, tip: '中国科技论文：2 年累计注水量 −3.3%（少注水、多产油，无效水循环减少）' }
  ];

  var LIT_TABLE = [
    { src: 'SY/T 6366-2005《油田开发主要生产技术指标及计算方法》', method: '石油天然气行业标准（2005-11-01 实施）', data: '存水率、水驱指数、注采比、含水上升率等开发指标的定义与计算方法；全部代替 SY/T 6287-1997、SY/T 6366-1998', link: 'https://std.samr.gov.cn/hb/search/stdHBDetailed?id=8B1827F1762FBB19E05397BE0A0AB44A', lt: '标准信息↗' },
    { src: '《常用水驱特征曲线理论研究》（石油学报）', method: '理论推导（结合 Welge 方程）', data: '统一导出甲型（马克西莫夫-童宪章）、乙型（沙卓洛夫）、广义丙型（西帕切夫）、广义丁型（纳扎洛夫 / 俞启泰）4 类水驱特征曲线', link: 'https://www.syxb-cps.com.cn/CN/article/downloadArticleFile.do?attachType=PDF&id=415', lt: 'PDF↗' },
    { src: '《对水驱特征曲线的正确理解与使用》石油勘探与开发 2019, 46(4):755', method: '方法评述', data: '丙型（西帕切夫 1981）Lp/Np=a₃+b₃·Lp、丁型（纳扎洛夫 1972）关系式与适用条件辨析；纳扎洛夫曲线斜率倒数为可动油储量', link: 'https://www.cpedm.com/article/2019/1000-0747-46-4-755.html', lt: '期刊页↗' },
    { src: '《萨北开发区阶段存水率和水驱指数变化特征研究》（石油地质与工程）', method: '矿场统计分析（大庆萨北开发区）', data: '存水率 =（累计注水量 − 累计产水量）÷ 注水量；水驱指数 = 地下存水量 ÷ 产油量；高含水期注水效果评价核心指标', link: 'https://sydzygc.hnyt.sinopec.com/cn/article/pdf/preview/68814f23-3fef-4616-b02d-5fdac157d995.pdf', lt: 'PDF↗' },
    { src: 'Sayarpour, Kabir & Lake (2009), SPE REE 12(6):853–864', method: '电容-电阻模型（CRM）矿场应用', data: '仅用注采速率历史反演井间连通性（增益 / 时间常数），为配注优化提供数据驱动代理（SPE-114983-PA）', link: 'https://doi.org/10.2118/114983-PA', lt: 'DOI↗' },
    { src: 'JPT《Mature Flood Surveillance Using Streamlines》', method: '流线监测 + 配注目标动态更新', data: '全油田日产量较自然递减基线 +1%–10%；阿曼稠油水驱 +2%；OMV（奥地利）同类实践', link: 'https://jpt.spe.org/mature-flood-surveillance-using-streamlines', lt: 'JPT↗' },
    { src: 'Processes 2023, 11(10):2816（MDPI）', method: '多层砂岩井间连通性建模 + 注采实时优化', data: '强非均质砂岩油藏矿场应用：年产油 +1.3%', link: 'https://www.mdpi.com/2227-9717/11/10/2816', lt: '期刊页↗' },
    { src: '中国科技论文（新疆 L9 油藏智能分注调控）', method: '注采连通值均衡调配（双高多层系油藏）', data: '实施 2 年：累产油 +4.6%、累注水 −3.3%、井区含水率 −2.6 个百分点', link: 'http://zkzx.cbpt.cnki.net/portal/journal/portal/client/paper/4be2268627b671d75e251627bf6e9183', lt: '期刊页↗' },
    { src: '中国石油新闻中心（2025-12）：新疆油田采油一厂智能分注', method: '第 4 代缆控分注 + 远程动态调控（红18井区克下组）', data: '日产油量提升超 28%、综合含水率下降 2.8 个百分点、含水上升率下降超 30%', link: 'https://www.cnpc.com.cn/cnpc/xgdt/202512/13374b97445547a98fe82aaae738ea8d.shtml', lt: '报道↗' },
    { src: 'SLB 案例：Enhancing Waterflooding Efficiency（截至 2024）', method: '一体化注采工作流 + 高级分析', data: '分析效率 +85%；首年增油 7,300 bbl，至 2024 年再增 15,000 bbl（超预期目标）', link: 'https://www.slb.com/resource-library/case-study-with-navigation/di/enhancing-waterflooding-efficiency-through-integrated-workflows-and-advanced-analytics', lt: '案例↗' }
  ];

  function drawLit() {
    var svg = $('lit-chart');
    if (!svg) return;
    var W = 900, H = 300, pl = 206, pr = 60, pt = 24, pb = 32;
    var pw = W - pl - pr, ph = H - pt - pb;
    var xmin = -40, xmax = 30;
    var x = function (v) { return pl + (v - xmin) / (xmax - xmin) * pw; };
    var n = LIT_BARS.length, rowH = ph / n, barH = 14;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var v = -30; v <= 30; v += 10) {
      s += '<line x1="' + x(v) + '" y1="' + pt + '" x2="' + x(v) + '" y2="' + (pt + ph) + '" stroke="' + (v === 0 ? '#b9b1a0' : '#efece1') + '" stroke-width="' + (v === 0 ? 1.2 : 1) + '"/>';
      s += '<text x="' + x(v) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + (v > 0 ? '+' : '') + v + '</text>';
    }
    LIT_BARS.forEach(function (b, i) {
      var cy = pt + rowH * (i + 0.5);
      var x0 = x(Math.min(0, b.v)), x1 = x(Math.max(0, b.v));
      var c = b.v > 0 ? '#2f7d6b' : '#41699b';
      s += '<rect data-idx="' + i + '" x="' + x0.toFixed(1) + '" y="' + (cy - barH / 2).toFixed(1) + '" width="' + Math.max(2, x1 - x0).toFixed(1) + '" height="' + barH + '" rx="3" fill="' + c + '" opacity="0.88"/>';
      s += '<text x="' + (pl - 8) + '" y="' + (cy + 3) + '" font-size="8.5" fill="#4d565b" text-anchor="end">' + b.label + '</text>';
      var vt = (b.v > 0 ? '+' : '−') + Math.abs(b.v) + '%';
      if (b.v > 0) s += '<text x="' + (x1 + 5) + '" y="' + (cy + 3) + '" font-size="8.5" fill="' + c + '" font-family="monospace" font-weight="700">' + vt + '</text>';
      else s += '<text x="' + (x0 - 5) + '" y="' + (cy + 3) + '" font-size="8.5" fill="' + c + '" text-anchor="end" font-family="monospace" font-weight="700">' + vt + '</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">相对基线变化（%）　← 蓝：注水 / 含水上升率下降　｜　绿：产油提升 →</text>';
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
