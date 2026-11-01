/* ======= 气测录井异常智能识别 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* HiDPI 适配：backing store 按 dpr 放大，绘制仍用逻辑坐标 */
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

  /* ================= 合成单井数据（确定性，4800–5300 m，1 m 一点） ================= */
  var D0 = 4800, D1 = 5300, NPT = D1 - D0 + 1;
  var rnd = mulberry32(20261030);

  /* 真值异常段：s/e 深度（m），type 真值类型，peak 全烃增量峰值（%），r = C1/C2..C1/C5 */
  var SEGS = [
    { s: 4868, e: 4875, type: 'gas', peak: 4.20, r: [28, 55, 90, 130] },     // 厚气层（干气）
    { s: 4923.1, e: 4924.3, type: 'gas', peak: 0.95, r: [22, 48, 80, 115] }, // 1.2 m 薄气层
    { s: 4989, e: 4994, type: 'gas', peak: 2.60, r: [13, 26, 40, 60] },      // 湿气层
    { s: 5041, e: 5046, type: 'gaswater', peak: 1.50, r: [8, 12, 18, 28] },  // 气水同层
    { s: 5118, e: 5123, type: 'water', peak: 1.00, r: [98, 394, 700, 1000] } // 水层（低全烃纯 C1）
  ];
  /* 接单根气尖峰（泵状态置位，2–5 min） */
  var CONNSPK = [
    { s: 4901, amps: [2.40, 2.95, 2.20] },
    { s: 5068, amps: [2.60, 3.05, 2.00] }
  ];
  var BGFRAC = [0.90, 0.05, 0.025, 0.015, 0.01]; // 背景气组分

  function fracOf(r) { // 由 C1/Cn 求摩尔分数
    var h = 1 / r[0] + 1 / r[1] + 1 / r[2] + 1 / r[3], t = 1 + h;
    return [1 / t, 1 / r[0] / t, 1 / r[1] / t, 1 / r[2] / t, 1 / r[3] / t];
  }
  SEGS.forEach(function (g) { g.frac = fracOf(g.r); });

  var BG = new Array(NPT);        // 背景全烃（地层真值，%）
  var ADD = new Array(NPT);       // 异常段全烃增量（真值，%）
  var ADDCH = [];                 // 异常段各组分增量
  for (var c = 0; c < 5; c++) ADDCH.push(new Array(NPT).fill(0));
  var CONNADD = new Array(NPT).fill(0); // 接单根气增量（几乎纯 C1）
  var CONN = new Array(NPT).fill(0);
  var ROP = new Array(NPT);       // 钻速 m/h（段内减慢）
  var ROPB = new Array(NPT);      // 无储层影响的钻速基线

  function cover(i, g) {
    var d = D0 + i;
    return clamp(Math.min(d + 0.5, g.e) - Math.max(d - 0.5, g.s), 0, 1);
  }
  (function build() {
    var i, g, k;
    for (i = 0; i < NPT; i++) {
      var d = D0 + i;
      BG[i] = Math.max(0.12, 0.34 + 0.09 * Math.sin(d * 0.045) + 0.05 * Math.sin(d * 0.013 + 1.7) + (rnd() - 0.5) * 0.08);
      ROPB[i] = 8 + 1.5 * Math.sin(d * 0.02 + 2) + (rnd() - 0.5) * 0.8;
      ROP[i] = ROPB[i];
    }
    SEGS.forEach(function (g) {
      for (i = 0; i < NPT; i++) {
        var cv = cover(i, g);
        if (cv <= 0) continue;
        var d = D0 + i;
        var pos = clamp((d - g.s) / (g.e - g.s), 0, 1);
        var sh = cv * (0.55 + 0.45 * Math.sin(Math.PI * pos));
        var add = g.peak * sh;
        for (k = 0; k < 5; k++) ADDCH[k][i] += add * g.frac[k];
        ROP[i] = ROPB[i] * 0.85; // 钻时变慢
      }
    });
    CONNSPK.forEach(function (sp) {
      sp.amps.forEach(function (a, k) {
        var i = sp.s + k - D0;
        CONNADD[i] += a; CONN[i] = 1;
      });
    });
    for (i = 0; i < NPT; i++) {
      ADD[i] = 0;
      for (k = 0; k < 5; k++) ADD[i] += ADDCH[k][i];
    }
  })();

  /* ================= 状态 ================= */
  var DEF = { rho: 2.05, flow: 30, eta: 75, mode: 'corr', conn: 'on', thr: 0.55, cursor: 4890, seg: -1 };
  var S = Object.assign({}, DEF);
  var R = null;       // 每帧计算结果
  var hoverI = -1;    // 综合图悬停采样点

  function kRho() { return 1 - 0.4 * (S.rho - 1.85) / 0.35; }
  function kQ() { return 30 / S.flow; }
  function kEta() { return S.eta / 75; }

  var TYPE = {
    gas: { c: '#2f7d6b', n: '气层' },
    gaswater: { c: '#c9a15a', n: '气水同层' },
    water: { c: '#41699b', n: '水层' },
    false: { c: '#b05a51', n: '假异常(接单根气)' }
  };

  /* ================= 核心计算 ================= */
  function compute() {
    var kr = kRho(), kq = kQ(), ke = kEta();
    var i, k;
    var corTG = new Array(NPT), rawTG = new Array(NPT);
    var corC = [], rawC = [];
    for (k = 0; k < 5; k++) { corC.push(new Array(NPT)); rawC.push(new Array(NPT)); }
    for (i = 0; i < NPT; i++) {
      var ct = 0, rt = 0;
      for (k = 0; k < 5; k++) {
        var bgc = BG[i] * BGFRAC[k];
        var cc = bgc + ADDCH[k][i] + (k === 0 ? CONNADD[i] : 0);
        var rc = (bgc + (ADDCH[k][i] + (k === 0 ? CONNADD[i] : 0)) * kr) * kq * ke;
        corC[k][i] = cc; rawC[k][i] = rc;
        ct += cc; rt += rc;
      }
      corTG[i] = ct; rawTG[i] = rt;
    }
    var main = S.mode === 'corr' ? corTG : rawTG;
    var mainC = S.mode === 'corr' ? corC : rawC;

    /* 滚动基线（窗口 31 中值） */
    var base = new Array(NPT), w = 15;
    for (i = 0; i < NPT; i++) {
      var a = Math.max(0, i - w), b = Math.min(NPT - 1, i + w);
      var win = main.slice(a, b + 1).sort(function (x, y) { return x - y; });
      base[i] = win[Math.floor(win.length / 2)];
    }

    /* 异常评分 */
    var score = new Array(NPT), sync = new Array(NPT);
    for (i = 0; i < NPT; i++) {
      var elev = Math.log10(Math.max(1e-4, main[i]) / Math.max(1e-4, base[i]));
      var c2f = mainC[1][i] / Math.max(1e-5, main[i]);
      sync[i] = clamp((c2f - 0.045) / 0.10, 0, 1);
      var ropN = clamp((ROPB[i] - ROP[i]) / 2.5, 0, 1);
      var v = 3.2 * elev + 1.0 * sync[i] + 0.6 * ropN - 1.1;
      if (CONN[i] && S.conn === 'on') v = -4;
      score[i] = sigmoid(v);
    }

    /* 段提取：score ≥ 阈值，间隔 ≤2 m 合并 */
    var runs = [], st = -1;
    for (i = 0; i < NPT; i++) {
      if (score[i] >= S.thr) { if (st < 0) st = i; }
      else if (st >= 0) { runs.push([st, i - 1]); st = -1; }
    }
    if (st >= 0) runs.push([st, NPT - 1]);
    var merged = [];
    runs.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r[0] - last[1] <= 3) last[1] = r[1];
      else merged.push([r[0], r[1]]);
    });

    /* 段级判别：取校正口径全烃前 30% 点的稳定组分 */
    var segs = merged.map(function (r) {
      var idx = [];
      for (i = r[0]; i <= r[1]; i++) idx.push(i);
      idx.sort(function (a, b) { return corTG[b] - corTG[a]; });
      var top = idx.slice(0, Math.max(1, Math.ceil(idx.length * 0.3)));
      var m = [0, 0, 0, 0, 0], mt = 0, ms = 0, msc = 0, np = 0;
      top.forEach(function (i) { for (k = 0; k < 5; k++) m[k] += corC[k][i]; mt += corTG[i]; });
      var nt = top.length;
      for (k = 0; k < 5; k++) m[k] /= nt;
      mt /= nt;
      idx.forEach(function (i) { ms += score[i]; msc += sync[i]; if (CONN[i]) np++; });
      ms /= idx.length; msc /= idx.length;
      var pk = Math.max.apply(null, idx.map(function (i) { return score[i]; }));
      var pumpFrac = np / idx.length;
      var sum = m[0] + m[1] + m[2] + m[3] + m[4];
      var c1f = m[0] / sum;
      var wh = 100 * (m[1] + m[2] + m[3] + m[4]) / sum;
      var bh = (m[0] + m[1]) / Math.max(1e-6, m[2] + m[3] + m[4]);
      var type;
      if (pumpFrac >= 0.5) type = 'false';
      else if (c1f >= 0.95 && wh < 4) type = 'water'; // 全烃低、组分几乎纯 C1 → 水层
      else if (wh >= 17.5) type = 'gaswater';
      else type = 'gas';
      var conf = clamp((0.5 * ms + 0.5 * pk) * (0.85 + 0.15 * msc), 0.03, 0.99);
      return {
        s: D0 + r[0], e: D0 + r[1], i0: r[0], i1: r[1],
        peak: Math.max.apply(null, idx.map(function (i) { return corTG[i]; })),
        frac: m.map(function (v) { return v / sum; }),
        r12: m[0] / Math.max(1e-6, m[1]), r13: m[0] / Math.max(1e-6, m[2]),
        c1f: c1f, wh: wh, bh: bh, type: type, conf: conf
      };
    });

    /* 与真值匹配（±1 m 容差） */
    var matchedT = SEGS.map(function () { return -1; });
    segs.forEach(function (g, gi) {
      SEGS.forEach(function (t, ti) {
        if (g.s <= t.e + 1 && g.e >= t.s - 1 && matchedT[ti] < 0) matchedT[ti] = gi;
      });
    });
    var nMatch = matchedT.filter(function (v) { return v >= 0; }).length;
    var falseN = segs.filter(function (g, gi) { return matchedT.indexOf(gi) < 0; }).length;
    var nAcc = 0;
    matchedT.forEach(function (gi, ti) {
      if (gi >= 0 && segs[gi].type === SEGS[ti].type) nAcc++;
    });
    var thinOk = matchedT[1] >= 0;

    return {
      corTG: corTG, rawTG: rawTG, corC: corC, main: main, mainC: mainC,
      base: base, score: score, segs: segs,
      nMatch: nMatch, recall: nMatch / SEGS.length,
      acc: nMatch ? nAcc / nMatch : 0,
      falseN: falseN, thinOk: thinOk,
      reviewN: segs.filter(function (g) { return g.conf < 0.6; }).length
    };
  }

  function cursorComp() { /* 游标处校正组分与比值 */
    var i = clamp(Math.round(S.cursor) - D0, 0, NPT - 1);
    var m = [R.corC[0][i], R.corC[1][i], R.corC[2][i], R.corC[3][i], R.corC[4][i]];
    var sum = m[0] + m[1] + m[2] + m[3] + m[4];
    return {
      r12: m[0] / Math.max(1e-6, m[1]), r13: m[0] / Math.max(1e-6, m[2]),
      wh: 100 * (m[1] + m[2] + m[3] + m[4]) / sum,
      bh: (m[0] + m[1]) / Math.max(1e-6, m[2] + m[3] + m[4])
    };
  }

  /* ================= ① 综合录井图（canvas, HiDPI） ================= */
  var LW = 720, LH = 330, MT = 34, MB = 18, PH = LH - MT - MB;
  var T1 = [50, 238], T2 = [248, 436], T3 = [446, 566], T4 = [576, 712];
  var CHCOL = ['#2f7d6b', '#41699b', '#c9a15a', '#b05a51', '#79828a'];

  function yOf(d) { return MT + (d - D0) / (D1 - D0) * PH; }
  function logX(v, vmin, vmax, x0, x1) {
    return x0 + (Math.log10(Math.max(vmin, v)) - Math.log10(vmin)) / (Math.log10(vmax) - Math.log10(vmin)) * (x1 - x0);
  }
  function t1x(v) { return logX(v, 0.01, 10, T1[0], T1[1]); }
  function t2x(v) { return logX(v, 0.001, 10, T2[0], T2[1]); }
  function scx(v) { return T3[0] + clamp(v, 0, 1) * (T3[1] - T3[0]); }

  function drawLog() {
    var cv = $('log'), ctx = setupCanvas(cv, LW, LH);
    ctx.clearRect(0, 0, LW, LH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, LW, LH);
    var i, d, x, y;

    /* 异常段底纹（T1–T3） */
    R.segs.forEach(function (g) {
      var y0 = yOf(g.s) - PH / (D1 - D0) / 2, y1 = yOf(g.e) + PH / (D1 - D0) / 2;
      ctx.fillStyle = TYPE[g.type].c;
      ctx.globalAlpha = g.type === 'false' ? 0.14 : 0.10;
      ctx.fillRect(T1[0], y0, T3[1] - T1[0], Math.max(2, y1 - y0));
      ctx.globalAlpha = 1;
    });
    /* 选中段描边 */
    if (S.seg >= 0 && R.segs[S.seg]) {
      var g = R.segs[S.seg];
      ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(T1[0], yOf(g.s) - 1, T4[1] - T1[0], yOf(g.e) - yOf(g.s) + 2);
      ctx.setLineDash([]);
    }

    /* 道头 */
    ctx.font = '600 9px sans-serif'; ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.fillText('全烃 TG %（对数）', (T1[0] + T1[1]) / 2, 11);
    ctx.fillText('组分 C1–C5 %（对数）', (T2[0] + T2[1]) / 2, 11);
    ctx.fillText('异常评分', (T3[0] + T3[1]) / 2, 11);
    ctx.fillText('智能解释结论', (T4[0] + T4[1]) / 2, 11);

    /* 网格 + 刻度（道边界处的端点标签改用内对齐，避免相邻道文字相撞） */
    ctx.font = '8px Consolas, monospace'; ctx.textAlign = 'center';
    [0.01, 0.1, 1, 10].forEach(function (v, vi) {
      x = t1x(v);
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      var lab = v >= 1 ? v.toFixed(0) : v.toFixed(2);
      if (vi === 3) { ctx.textAlign = 'right'; ctx.fillText(lab, x + 4, MT - 4); ctx.textAlign = 'center'; }
      else ctx.fillText(lab, x, MT - 4);
    });
    [0.001, 0.01, 0.1, 1, 10].forEach(function (v, vi) {
      x = t2x(v);
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      var lab2 = v >= 1 ? v.toFixed(0) : v < 0.01 ? '.001' : v.toFixed(2);
      if (vi === 0) { ctx.textAlign = 'left'; ctx.fillText(lab2, x + 2, MT - 4); ctx.textAlign = 'center'; }
      else if (vi === 4) { ctx.textAlign = 'right'; ctx.fillText(lab2, x + 4, MT - 4); ctx.textAlign = 'center'; }
      else ctx.fillText(lab2, x, MT - 4);
    });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v, vi) {
      x = scx(v);
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      if (vi === 0) { ctx.textAlign = 'left'; ctx.fillText(v.toFixed(0), x + 2, MT - 4); ctx.textAlign = 'center'; }
      else if (vi === 4) { ctx.textAlign = 'right'; ctx.fillText(v.toFixed(2), x + 2, MT - 4); ctx.textAlign = 'center'; }
      else ctx.fillText(v.toFixed(2), x, MT - 4);
    });
    /* 道分隔线 */
    ctx.strokeStyle = '#d8d0bc';
    [T1, T2, T3, T4].forEach(function (t) {
      ctx.beginPath(); ctx.moveTo(t[0] - 5, MT); ctx.lineTo(t[0] - 5, MT + PH); ctx.stroke();
    });

    /* 深度轴 */
    ctx.textAlign = 'right'; ctx.fillStyle = '#79828a';
    for (d = D0; d <= D1; d += 50) {
      y = yOf(d);
      ctx.fillText(d + '', 44, y + 3);
      ctx.strokeStyle = '#e6e0d2'; ctx.beginPath(); ctx.moveTo(46, y); ctx.lineTo(T4[1], y); ctx.stroke();
    }
    ctx.save();
    ctx.translate(11, MT + PH / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.font = '9px sans-serif'; ctx.fillStyle = '#5d666d';
    ctx.fillText('深度 (m)', 0, 0); ctx.restore();

    /* 全烃：对照口径灰线 + 当前口径绿线 */
    function tseries(arr, color, lw2) {
      ctx.strokeStyle = color; ctx.lineWidth = lw2; ctx.beginPath();
      for (i = 0; i < NPT; i++) {
        x = t1x(arr[i]); y = yOf(D0 + i);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    tseries(S.mode === 'corr' ? R.rawTG : R.corTG, '#9ba3a9', 1);
    tseries(R.main, '#2f7d6b', 1.8);

    /* 组分五线 */
    for (var k = 0; k < 5; k++) {
      ctx.strokeStyle = CHCOL[k]; ctx.lineWidth = 1.1; ctx.beginPath();
      for (i = 0; i < NPT; i++) {
        x = t2x(R.mainC[k][i]); y = yOf(D0 + i);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }

    /* 评分面积 + 线 */
    ctx.beginPath();
    ctx.moveTo(scx(0), yOf(D0));
    for (i = 0; i < NPT; i++) ctx.lineTo(scx(R.score[i]), yOf(D0 + i));
    ctx.lineTo(scx(0), yOf(D1)); ctx.closePath();
    ctx.fillStyle = 'rgba(47,125,107,0.18)'; ctx.fill();
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (i = 0; i < NPT; i++) {
      x = scx(R.score[i]); y = yOf(D0 + i);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    /* 阈值线 */
    x = scx(S.thr);
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right';
    ctx.font = '8px Consolas, monospace';
    /* 阈值数值放底部留白（右侧），避开评分曲线 */
    ctx.fillText('阈值 ' + S.thr.toFixed(2), T3[1], LH - 4);

    /* 接单根标记 ▲（注记放底部留白左侧，避开曲线与阈值标签） */
    ctx.fillStyle = '#b05a51';
    for (i = 0; i < NPT; i++) {
      if (!CONN[i]) continue;
      x = T3[0] + 7; y = yOf(D0 + i);
      ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x - 3, y + 3); ctx.lineTo(x + 3, y + 3); ctx.closePath(); ctx.fill();
    }
    ctx.font = '8px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(S.conn === 'on' ? '▲接单根气·已剔除' : '▲接单根气·未剔除', T3[0] + 2, LH - 4);

    /* T4 解释结论带 + 防重叠标签 */
    var labels = R.segs.map(function (g, gi) {
      var y0 = yOf(g.s) - 0.5, y1 = yOf(g.e) + 0.5;
      if (y1 - y0 < 7) { var m = (y0 + y1) / 2; y0 = m - 3.5; y1 = m + 3.5; }
      ctx.fillStyle = TYPE[g.type].c;
      ctx.globalAlpha = gi === S.seg ? 0.95 : 0.75;
      var bw = gi === S.seg ? 16 : 12;
      ctx.fillRect(T4[0], y0, bw, y1 - y0);
      ctx.globalAlpha = 1;
      return { g: g, gi: gi, mid: (y0 + y1) / 2, y: clamp((y0 + y1) / 2, MT + 7, MT + PH - 7), bw: bw };
    });
    labels.sort(function (a, b) { return a.mid - b.mid; });
    for (i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12;
    for (i = labels.length - 1; i > 0; i--) if (labels[i].y > MT + PH - 7) { labels[i].y = MT + PH - 7; if (labels[i].y - labels[i - 1].y < 12) labels[i - 1].y = labels[i].y - 12; }
    ctx.font = '8.5px sans-serif';
    labels.forEach(function (L) {
      var g = L.g;
      if (Math.abs(L.y - L.mid) > 2) {
        ctx.strokeStyle = '#b8b0a0'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(T4[0] + L.bw, L.mid); ctx.lineTo(T4[0] + 24, L.y); ctx.stroke();
      }
      ctx.fillStyle = TYPE[g.type].c; ctx.textAlign = 'left';
      var nm = g.type === 'false' ? '假异常' : TYPE[g.type].n;
      ctx.fillText(nm + ' ' + g.conf.toFixed(2), T4[0] + 27, L.y + 3);
    });

    /* 游标 */
    var cy = yOf(S.cursor);
    ctx.strokeStyle = '#41699b'; ctx.setLineDash([3, 2]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(T1[0], cy); ctx.lineTo(T4[1], cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#41699b'; ctx.textAlign = 'left'; ctx.font = '8.5px Consolas, monospace';
    ctx.fillText(S.cursor + ' m', T4[1] - 52, cy - 4);

    /* 悬停十字线 */
    if (hoverI >= 0) {
      var hy = yOf(D0 + hoverI);
      ctx.strokeStyle = 'rgba(36,43,46,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(T1[0], hy); ctx.lineTo(T4[1], hy); ctx.stroke();
    }
  }

  function bindLog() {
    var cv = $('log'), tip = $('log-tip'), box = $('log-box');
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var ly = (evt.clientY - r.top) * (LH / r.height);
      var d = D0 + (ly - MT) / PH * (D1 - D0);
      if (d < D0 || d > D1) { hoverI = -1; tip.style.display = 'none'; drawLog(); return; }
      hoverI = clamp(Math.round(d) - D0, 0, NPT - 1);
      drawLog();
      var i = hoverI, dep = D0 + i;
      var seg = null;
      R.segs.forEach(function (g, gi) { if (dep >= g.s && dep <= g.e) seg = { g: g, gi: gi }; });
      var h = '<b>' + dep + ' m</b><br>TG 原始 <b>' + R.rawTG[i].toFixed(3) + '%</b> · 校正 <b>' + R.corTG[i].toFixed(3) + '%</b>' +
        '<br>C1–C5：' + R.corC.map(function (a) { return a[i].toFixed(3); }).join(' / ') + ' %' +
        '<br>评分 <b>' + R.score[i].toFixed(2) + '</b>' + (CONN[i] ? ' · <b style="color:#b05a51">接单根气</b>' : '') +
        (seg ? '<br>段' + (seg.gi + 1) + ' · ' + TYPE[seg.g.type].n + ' · 置信 ' + seg.g.conf.toFixed(2) : '');
      tip.innerHTML = h;
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 250) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 90) + 'px';
    });
    cv.addEventListener('mouseleave', function () {
      hoverI = -1; tip.style.display = 'none'; drawLog();
    });
  }

  /* ================= ③ 图版（SVG） ================= */
  /* 段点绘制 + 标签防重叠（垂直堆叠，右侧超限时放左侧） */
  function segDotsSVG(pts, xLimit) {
    var s = '';
    pts.forEach(function (p) {
      var sel = p.gi === S.seg;
      s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (sel ? 7 : 5) + '" fill="' + p.col + '" opacity="' + (sel ? 1 : 0.8) + '" stroke="' + (sel ? '#242b2e' : '#fff') + '" stroke-width="' + (sel ? 1.8 : 1.2) + '"/>';
    });
    var lbls = pts.map(function (p) {
      return { p: p, ly: p.ly0 != null ? p.ly0 : p.y, left: p.side ? p.side === 'left' : p.x > xLimit };
    }).sort(function (a, b) { return a.ly - b.ly; });
    /* 左右两列分别垂直堆叠（不同列互不占位） */
    [true, false].forEach(function (isLeft) {
      var col = lbls.filter(function (L) { return L.left === isLeft; });
      for (var i = 1; i < col.length; i++) if (col[i].ly - col[i - 1].ly < 11) col[i].ly = col[i - 1].ly + 11;
    });
    lbls.forEach(function (L) {
      var left = L.left;
      if (Math.abs(L.ly - L.p.y) > 2) s += '<line x1="' + L.p.x.toFixed(1) + '" y1="' + L.p.y.toFixed(1) + '" x2="' + (L.p.x + (left ? -8 : 8)).toFixed(1) + '" y2="' + (L.ly + 3).toFixed(1) + '" stroke="#b8b0a0" stroke-width="0.7"/>';
      s += '<text x="' + (L.p.x + (left ? -9 : 9)).toFixed(1) + '" y="' + (L.ly + 3).toFixed(1) + '" font-size="8" fill="' + L.p.col + '" font-family="monospace" text-anchor="' + (left ? 'end' : 'start') + '">段' + (L.p.gi + 1) + '</text>';
    });
    return s;
  }

  function drawPixler() {
    var svg = $('pixler');
    var W = 430, H = 250, pl = 44, pr = 12, pt = 24, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var X0 = 1, X1 = 200, Y0 = 1, Y1 = 500;
    function xp(v) { return pl + (Math.log10(v) - Math.log10(X0)) / (Math.log10(X1) - Math.log10(X0)) * pw; }
    function yp(v) { return pt + ph - (Math.log10(v) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0)) * ph; }
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    /* 分区 */
    s += '<rect x="' + xp(2) + '" y="' + yp(14) + '" width="' + (xp(10) - xp(2)) + '" height="' + (yp(2) - yp(14)) + '" fill="#41699b" opacity="0.10"/>';
    s += '<rect x="' + xp(10) + '" y="' + yp(82) + '" width="' + (xp(35) - xp(10)) + '" height="' + (yp(14) - yp(82)) + '" fill="#2f7d6b" opacity="0.12"/>';
    s += '<rect x="' + xp(35) + '" y="' + yp(500) + '" width="' + (xp(200) - xp(35)) + '" height="' + (yp(82) - yp(500)) + '" fill="#79828a" opacity="0.08"/>';
    /* 边界虚线 */
    [10, 35].forEach(function (v) {
      s += '<line x1="' + xp(v) + '" y1="' + pt + '" x2="' + xp(v) + '" y2="' + (pt + ph) + '" stroke="#b8b0a0" stroke-width="0.8" stroke-dasharray="4 3"/>';
      s += '<text x="' + (xp(v) + 2) + '" y="' + (pt + ph - 4) + '" font-size="7.5" fill="#9ba3a9">' + v + '</text>';
    });
    [14, 82].forEach(function (v) {
      s += '<line x1="' + pl + '" y1="' + yp(v) + '" x2="' + (pl + pw) + '" y2="' + yp(v) + '" stroke="#b8b0a0" stroke-width="0.8" stroke-dasharray="4 3"/>';
      s += '<text x="' + (pl + pw - 3) + '" y="' + (yp(v) - 3) + '" font-size="7.5" fill="#9ba3a9" text-anchor="end">' + v + '</text>';
    });
    /* 网格与轴 */
    [1, 10, 100].forEach(function (v) {
      s += '<line x1="' + xp(v) + '" y1="' + pt + '" x2="' + xp(v) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xp(v) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
      s += '<line x1="' + pl + '" y1="' + yp(v) + '" x2="' + (pl + pw) + '" y2="' + yp(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (yp(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    });
    /* 区标签（避开数据点聚集区） */
    s += '<text x="' + (xp(4.5)) + '" y="' + (yp(6.5)) + '" font-size="10" fill="#41699b" text-anchor="middle" font-weight="600">油区</text>';
    s += '<text x="' + (xp(28)) + '" y="' + (yp(22)) + '" font-size="10" fill="#2f7d6b" text-anchor="middle" font-weight="600">气区</text>';
    s += '<text x="' + (xp(110)) + '" y="' + (yp(200)) + '" font-size="10" fill="#79828a" text-anchor="middle" font-weight="600">干气/非产</text>';
    /* 段点 */
    var dots = [];
    R.pixPts = [];
    R.segs.forEach(function (g, gi) {
      var px = xp(clamp(g.r12, 1, 200)), py = yp(clamp(g.r13, 1, 500));
      R.pixPts.push({ x: px, y: py, gi: gi });
      dots.push({ x: px, y: py, gi: gi, col: TYPE[g.type].c });
    });
    /* 贴近 C1/C3=14 边界线的段：标签下移并加引线，避免压线 */
    dots.forEach(function (d) {
      if (Math.abs(d.y - yp(14)) < 8) d.ly0 = d.y + 8;
    });
    s += segDotsSVG(dots, xp(100));
    /* 游标点（灰十字） */
    var cc = cursorComp();
    var cx2 = xp(clamp(cc.r12, 1, 200)), cy2 = yp(clamp(cc.r13, 1, 500));
    s += '<path d="M' + (cx2 - 5) + ' ' + cy2 + ' L' + (cx2 + 5) + ' ' + cy2 + ' M' + cx2 + ' ' + (cy2 - 5) + ' L' + cx2 + ' ' + (cy2 + 5) + '" stroke="#5d666d" stroke-width="1.4"/>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">C1/C2（对数）</text>';
    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">C1/C3（对数）</text>';
    s += '<text x="' + (pl + 3) + '" y="' + (pt - 8) + '" font-size="8" fill="#9ba3a9">Pixler (1969) 分区</text>';
    svg.innerHTML = s;
  }

  function drawWhitt() {
    var svg = $('whitt');
    var W = 430, H = 250, pl = 44, pr = 12, pt = 24, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var X0 = 0.1, X1 = 100, Y0 = 0.1, Y1 = 1000;
    function xp(v) { return pl + (Math.log10(v) - Math.log10(X0)) / (Math.log10(X1) - Math.log10(X0)) * pw; }
    function yp(v) { return pt + ph - (Math.log10(v) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0)) * ph; }
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    /* Wh 分带 */
    var bands = [[0.1, 0.5, '#79828a', '干气/非产'], [0.5, 17.5, '#2f7d6b', '气'], [17.5, 40, '#c9a15a', '湿气·气水'], [40, 100, '#41699b', '油']];
    bands.forEach(function (b) {
      s += '<rect x="' + xp(b[0]) + '" y="' + pt + '" width="' + (xp(b[1]) - xp(b[0])) + '" height="' + ph + '" fill="' + b[2] + '" opacity="0.08"/>';
      s += '<text x="' + ((xp(b[0]) + xp(b[1])) / 2) + '" y="' + (pt + 12) + '" font-size="8.5" fill="' + b[2] + '" text-anchor="middle" font-weight="600">' + b[3] + '</text>';
    });
    /* Bh=Wh 对角线（标签放左下空旷区） */
    var l0 = Math.max(X0, Y0), l1 = Math.min(X1, 100);
    s += '<line x1="' + xp(l0) + '" y1="' + yp(l0) + '" x2="' + xp(l1) + '" y2="' + yp(l1) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + xp(0.62) + '" y="' + (yp(0.62) - 6) + '" font-size="7.5" fill="#b05a51" transform="rotate(-37 ' + xp(0.62) + ' ' + yp(0.62) + ')">Bh=Wh（下方非产）</text>';
    /* 网格与轴 */
    [[0.1, '0.1'], [1, '1'], [10, '10'], [100, '100']].forEach(function (p) {
      s += '<line x1="' + xp(p[0]) + '" y1="' + pt + '" x2="' + xp(p[0]) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xp(p[0]) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + p[1] + '</text>';
    });
    [[0.1, '0.1'], [1, '1'], [10, '10'], [100, '100'], [1000, '1000']].forEach(function (p) {
      s += '<line x1="' + pl + '" y1="' + yp(p[0]) + '" x2="' + (pl + pw) + '" y2="' + yp(p[0]) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (yp(p[0]) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + p[1] + '</text>';
    });
    /* 段点 */
    var dots2 = [];
    R.whiPts = [];
    R.segs.forEach(function (g, gi) {
      var px = xp(clamp(g.wh, 0.1, 100)), py = yp(clamp(g.bh, 0.1, 1000));
      R.whiPts.push({ x: px, y: py, gi: gi });
      dots2.push({ x: px, y: py, gi: gi, col: TYPE[g.type].c });
    });
    /* 过密段点（<15 px）：标签一律放点的左侧，避免压相邻点与游标十字 */
    for (var a = 0; a < dots2.length; a++) for (var b = a + 1; b < dots2.length; b++) {
      if (Math.hypot(dots2[a].x - dots2[b].x, dots2[a].y - dots2[b].y) < 15) { dots2[a].side = 'left'; dots2[b].side = 'left'; }
    }
    s += segDotsSVG(dots2, xp(50));
    var cc = cursorComp();
    var cx2 = xp(clamp(cc.wh, 0.1, 100)), cy2 = yp(clamp(cc.bh, 0.1, 1000));
    s += '<path d="M' + (cx2 - 5) + ' ' + cy2 + ' L' + (cx2 + 5) + ' ' + cy2 + ' M' + cx2 + ' ' + (cy2 - 5) + ' L' + cx2 + ' ' + (cy2 + 5) + '" stroke="#5d666d" stroke-width="1.4"/>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">湿度比 Wh %（对数）</text>';
    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">平衡比 Bh（对数）</text>';
    s += '<text x="' + (pl + 3) + '" y="' + (pt - 8) + '" font-size="8" fill="#9ba3a9">Haworth (1985) / Whittaker (1987)</text>';
    svg.innerHTML = s;
  }

  function segTipHTML(g, gi) {
    return '<b>段' + (gi + 1) + ' · ' + TYPE[g.type].n + '</b> · ' + g.s + '–' + g.e + ' m' +
      '<br>C1/C2=<b>' + g.r12.toFixed(1) + '</b> · C1/C3=<b>' + g.r13.toFixed(1) + '</b>' +
      '<br>Wh=<b>' + g.wh.toFixed(1) + '%</b> · Bh=<b>' + g.bh.toFixed(1) + '</b>' +
      '<br>置信度 <b>' + g.conf.toFixed(2) + '</b>' + (g.conf < 0.6 ? '（列入复核）' : '') +
      '<br><span style="color:#8a9298">点击选中该段</span>';
  }

  function bindChart(svgId, tipId, ptsKey, boxSel) {
    var svg = $(svgId), tip = $(tipId);
    var W = 430;
    function nearest(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var vy = (evt.clientY - r.top) * (250 / r.height);
      var best = -1, bd = 1e9;
      (R[ptsKey] || []).forEach(function (p, k) {
        var d = Math.hypot(p.x - vx, p.y - vy);
        if (d < bd) { bd = d; best = k; }
      });
      return { k: best, d: bd, evt: evt };
    }
    svg.addEventListener('mousemove', function (evt) {
      var n = nearest(evt);
      if (n.k >= 0 && n.d <= 16) {
        var p = R[ptsKey][n.k];
        tip.innerHTML = segTipHTML(R.segs[p.gi], p.gi);
        tip.style.display = 'block';
        var rb = svg.parentNode.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 240) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 96) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    svg.addEventListener('click', function (evt) {
      var n = nearest(evt);
      if (n.k >= 0 && n.d <= 16) selectSeg(R[ptsKey][n.k].gi);
    });
  }

  /* ================= ④ 指标与结论 ================= */
  function renderMetrics() {
    $('m-seg').innerHTML = R.segs.length + '<small> 段（假异常 ' + R.falseN + '）</small>';
    var rc = Math.round(R.recall * 100);
    $('m-recall').innerHTML = rc + '<small> %（' + R.nMatch + '/5）</small>';
    $('m-recall').parentNode.className = 'mcard' + (rc < 100 ? ' bad' : '');
    $('m-thin').innerHTML = R.thinOk ? '检出' : '漏失';
    $('m-thin').parentNode.className = 'mcard' + (R.thinOk ? '' : ' bad');
    var ac = Math.round(R.acc * 100);
    $('m-acc').innerHTML = (R.nMatch ? ac : 0) + '<small> %</small>';
    $('m-acc').parentNode.className = 'mcard' + (R.nMatch && ac < 100 ? ' warn' : '');
    $('m-review').innerHTML = R.reviewN + '<small> 段</small>';
    $('m-review').parentNode.className = 'mcard' + (R.reviewN ? ' warn' : '');
  }

  function renderVerdict() {
    var v = $('verdict');
    var supp = Math.round((1 - kRho()) * 100);
    var head = '密度 <b>' + S.rho.toFixed(2) + '</b> g/cm³（过平衡压制 <b>' + supp + '%</b>）· 排量 <b>' + S.flow.toFixed(1) + '</b> L/s · 脱气效率 <b>' + S.eta + '</b>% · ' +
      (S.mode === 'corr' ? '已折算至标准工况' : '<b>未校正原始值</b>') + ' · 阈值 <b>' + S.thr.toFixed(2) + '</b>；';
    var tail;
    if (!R.thinOk) {
      v.className = 'verdict bad';
      tail = '4923–4924 m 薄气层（1.2 m）<b>漏失</b>：' + (S.mode === 'raw' ? '高密度过平衡把薄层峰值压进了背景波动，请切换「工况校正值」或降低阈值。' : '当前阈值过高，薄层评分仅约 0.6，建议降至 0.50 左右。');
    } else if (R.falseN > 0) {
      v.className = 'verdict bad';
      tail = '检出 ' + R.segs.length + ' 段但含 <b>' + R.falseN + ' 段假异常</b>（接单根气，2–5 min 尖峰、全烃冲到 3% 但 C2–C5 不同步）——建议开启「接单根气剔除」。';
    } else if (R.reviewN > 0) {
      v.className = 'verdict warn';
      tail = '查全率 ' + Math.round(R.recall * 100) + '%，类型符合率 ' + Math.round(R.acc * 100) + '%；薄层与水层置信度低于 0.6，已列入 <b>' + R.reviewN + ' 段复核清单</b>（附曲线截图与依据组分），交解释员复核。';
    } else {
      v.className = 'verdict ok';
      tail = '查全率 100%、类型符合率 ' + Math.round(R.acc * 100) + '%、无假异常——高置信段直接进成果表，单井解释由 4 h 压缩到分钟级。';
    }
    v.innerHTML = head + tail;
  }

  function renderSegDetail() {
    var d = $('seg-detail');
    if (S.seg >= 0 && R.segs[S.seg]) {
      var g = R.segs[S.seg];
      d.className = 'r-detail active';
      d.innerHTML = '<b>段' + (S.seg + 1) + ' · ' + TYPE[g.type].n + '</b>：' + g.s + '–' + g.e + ' m，校正后峰值全烃 <b>' + g.peak.toFixed(2) + '%</b>；' +
        '稳定段组分 C1 ' + (g.frac[0] * 100).toFixed(1) + '%、C2 ' + (g.frac[1] * 100).toFixed(2) + '%、C3 ' + (g.frac[2] * 100).toFixed(2) + '%；' +
        'C1/C2=' + g.r12.toFixed(1) + '、C1/C3=' + g.r13.toFixed(1) + '、Wh=' + g.wh.toFixed(1) + '%、Bh=' + g.bh.toFixed(1) + ' → 判为<b>' + TYPE[g.type].n + '</b>，置信度 ' + g.conf.toFixed(2) + '。';
    } else {
      d.className = 'r-detail';
      d.innerHTML = '点击图版上的段点，或在右侧「选中段」下拉选择，可查看该异常段的组分依据与解释结论。';
    }
  }

  /* ================= 绑定 ================= */
  var OUT = {
    rho: function (v) { return v.toFixed(2) + ' g/cm³'; },
    flow: function (v) { return v.toFixed(1) + ' L/s'; },
    eta: function (v) { return v + ' %'; },
    thr: function (v) { return v.toFixed(2); },
    cursor: function (v) { return v + ' m'; }
  };

  function render() {
    R = compute();
    drawLog();
    drawPixler();
    drawWhitt();
    renderMetrics();
    renderVerdict();
    renderSegDetail();
    rebuildSegSelect();
  }

  function rebuildSegSelect() {
    var sel = $('s-seg');
    var cur = S.seg;
    var h = '<option value="-1">（不选中）</option>';
    R.segs.forEach(function (g, gi) {
      h += '<option value="' + gi + '"' + (gi === cur ? ' selected' : '') + '>段' + (gi + 1) + ' · ' + TYPE[g.type].n + ' · ' + g.s + '–' + g.e + ' m · ' + g.conf.toFixed(2) + '</option>';
    });
    sel.innerHTML = h;
    if (cur >= R.segs.length) { S.seg = -1; sel.value = '-1'; }
  }

  function selectSeg(gi) {
    S.seg = gi;
    $('s-seg').value = String(gi);
    render();
  }

  function bind() {
    ['rho', 'flow', 'eta', 'thr', 'cursor'].forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('s-mode').addEventListener('change', function () { S.mode = this.value; render(); });
    $('s-conn').addEventListener('change', function () { S.conn = this.value; render(); });
    $('s-seg').addEventListener('change', function () { S.seg = parseInt(this.value, 10); render(); });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      ['rho', 'flow', 'eta', 'thr', 'cursor'].forEach(function (k) {
        $('s-' + k).value = DEF[k];
        $('o-' + k).textContent = OUT[k](DEF[k]);
      });
      $('s-mode').value = DEF.mode;
      $('s-conn').value = DEF.conn;
      render();
    });
  }

  bind();
  bindLog();
  bindChart('pixler', 'pix-tip', 'pixPts');
  bindChart('whitt', 'whi-tip', 'whiPts');
  render();

  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(drawLog, 120);
  });
})();

/* ======= 真实数据来源页：判据速览 + 文献表 ======= */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* Pixler 分区（转引自 Pixler 1969；Haworth et al. 1985） */
  var PIX = [
    { label: 'C1/C2', bands: [[2, 10, '#41699b', '油区', 'C1/C2 = 2–10：油区。轻质油 C1 占优势但 C2 仍可检出。'], [10, 35, '#2f7d6b', '气区', 'C1/C2 = 10–35：气区。本 demo 三个气层段 C1/C2 ≈ 13–28 均落此区。'], [35, 200, '#79828a', '干气/非产', 'C1/C2 > 35：干气或非产层——C2 过少，多为分散气或水层气。']] },
    { label: 'C1/C3', bands: [[2, 14, '#41699b', '油区', 'C1/C3 = 2–14：油区。'], [14, 82, '#2f7d6b', '气区', 'C1/C3 = 14–82：气区。本 demo 气层段 C1/C3 ≈ 26–55 落此区。'], [82, 400, '#79828a', '干气/非产', 'C1/C3 > 82：干气或非产层。']] },
    { label: 'C1/C4', bands: [[2, 21, '#41699b', '油区', 'C1/C4 = 2–21：油区。'], [21, 200, '#2f7d6b', '气区', 'C1/C4 = 21–200：气区。'], [200, 1000, '#79828a', '干气/非产', 'C1/C4 > 200：干气或非产层。']] }
  ];
  var WHB = [
    [0.1, 0.5, '#79828a', '干气/非产', 'Wh < 0.5%：几乎纯甲烷的干气，Haworth 判为非产或生物气；本 demo 水层段（Wh≈1.5% 且全烃极低）靠近该带。'],
    [0.5, 17.5, '#2f7d6b', '气', 'Wh = 0.5–17.5%：产气区。本 demo 厚气层 Wh≈6.8%、薄气层≈8%、湿气层≈13.6%。'],
    [17.5, 40, '#c9a15a', '湿气/凝析', 'Wh = 17.5–40%：湿气、凝析或轻质油；本 demo 气水同层 Wh≈23% 落此带，判别为气水同层（湿气）。'],
    [40, 100, '#41699b', '油', 'Wh > 40%：油层（C2+ 重组分占优）。']
  ];
  var CRIT_SEL = null;

  function drawCrit() {
    var svg = $('crit');
    var W = 900, H = 250;
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';
    /* ---- 左：Pixler ---- */
    var pl = 70, pr = 20, pt = 34, rowH = 44, gap = 14;
    var pw = 360;
    function lx(v) { return pl + (Math.log10(v) - 0) / 3 * pw; } /* 1–1000 */
    s += '<text x="' + pl + '" y="16" font-size="10" fill="#235f51" font-weight="600">Pixler 比值分区（1969）· 横轴对数 1–1000</text>';
    [1, 10, 100, 1000].forEach(function (v) {
      s += '<line x1="' + lx(v) + '" y1="' + pt + '" x2="' + lx(v) + '" y2="' + (pt + 3 * rowH + 2 * gap) + '" stroke="#efece1"/>';
      s += '<text x="' + lx(v) + '" y="' + (pt + 3 * rowH + 2 * gap + 14) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
    });
    PIX.forEach(function (row, ri) {
      var y = pt + ri * (rowH + gap);
      s += '<text x="' + (pl - 8) + '" y="' + (y + rowH / 2 + 3) + '" font-size="9.5" fill="#4d565b" text-anchor="end" font-family="monospace">' + row.label + '</text>';
      row.bands.forEach(function (b, bi) {
        var id = 'p' + ri + '-' + bi;
        var sel = CRIT_SEL === id;
        s += '<rect data-crit="' + id + '" x="' + lx(b[0]) + '" y="' + y + '" width="' + (lx(b[1]) - lx(b[0])) + '" height="' + rowH + '" rx="4" fill="' + b[2] + '" opacity="' + (sel ? 0.95 : 0.68) + '" stroke="' + (sel ? '#242b2e' : 'none') + '" stroke-width="1.2" style="cursor:pointer"/>';
        s += '<text x="' + ((lx(b[0]) + lx(b[1])) / 2) + '" y="' + (y + rowH / 2 - 1) + '" font-size="9" fill="#fff" text-anchor="middle" font-weight="600" pointer-events="none">' + b[3] + '</text>';
        s += '<text x="' + ((lx(b[0]) + lx(b[1])) / 2) + '" y="' + (y + rowH / 2 + 11) + '" font-size="8" fill="#f5f2ea" text-anchor="middle" font-family="monospace" pointer-events="none">' + b[0] + '–' + b[1] + '</text>';
      });
    });
    s += '<text x="' + pl + '" y="' + (pt + 3 * rowH + 2 * gap + 26) + '" font-size="8" fill="#9ba3a9">比值 &lt; 2：多为水层/非产；三区数值为油区 / 气区 / 干气·非产区边界。</text>';

    /* ---- 右：Whittaker-Haworth ---- */
    var ql = 560, qw = 300;
    function wx(v) { return ql + (Math.log10(v) + 1) / 3 * qw; } /* 0.1–100 */
    s += '<text x="' + ql + '" y="16" font-size="10" fill="#235f51" font-weight="600">Haworth–Whittaker 判据（1985 / 1987）· Wh 对数轴</text>';
    var wy = pt + 10, wh2 = 120;
    [0.1, 1, 10, 100].forEach(function (v) {
      s += '<line x1="' + wx(v) + '" y1="' + wy + '" x2="' + wx(v) + '" y2="' + (wy + wh2) + '" stroke="#efece1"/>';
      s += '<text x="' + wx(v) + '" y="' + (wy + wh2 + 14) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
    });
    WHB.forEach(function (b, bi) {
      var id = 'w' + bi;
      var sel = CRIT_SEL === id;
      s += '<rect data-crit="' + id + '" x="' + wx(b[0]) + '" y="' + wy + '" width="' + (wx(b[1]) - wx(b[0])) + '" height="' + wh2 + '" rx="4" fill="' + b[2] + '" opacity="' + (sel ? 0.95 : 0.68) + '" stroke="' + (sel ? '#242b2e' : 'none') + '" stroke-width="1.2" style="cursor:pointer"/>';
      s += '<text x="' + ((wx(b[0]) + wx(b[1])) / 2) + '" y="' + (wy + 16) + '" font-size="9" fill="#fff" text-anchor="middle" font-weight="600" pointer-events="none">' + b[3] + '</text>';
      s += '<text x="' + ((wx(b[0]) + wx(b[1])) / 2) + '" y="' + (wy + 28) + '" font-size="8" fill="#f5f2ea" text-anchor="middle" font-family="monospace" pointer-events="none">' + b[0] + '–' + b[1] + '%</text>';
    });
    s += '<text x="' + ql + '" y="' + (wy + wh2 + 28) + '" font-size="8.5" fill="#b05a51">规则：Bh &lt; Wh → 非产层；Bh 越高越偏干气。</text>';
    s += '<text x="' + ql + '" y="' + (wy + wh2 + 40) + '" font-size="8" fill="#9ba3a9">Wh = 100·(C2+C3+C4+C5)/(C1–C5)；Bh = (C1+C2)/(C3+C4+C5)</text>';
    svg.innerHTML = s;
  }

  function critInfo(id) {
    if (id.charAt(0) === 'p') {
      var p = id.slice(1).split('-');
      var row = PIX[+p[0]], b = row.bands[+p[1]];
      return '<b>Pixler ' + row.label + ' · ' + b[3] + '（' + b[0] + '–' + b[1] + '）</b>：' + b[4] + ' 来源：Pixler (1969) JPT 21(6):665–670；分区数值经 Haworth et al. (1985) 沿用。';
    }
    var b2 = WHB[+id.slice(1)];
    return '<b>Haworth–Whittaker · ' + b2[3] + '（Wh ' + b2[0] + '–' + b2[1] + '%）</b>：' + b2[4] + ' 来源：Haworth et al. (1985) AAPG 69(8):1305–1310；Whittaker & Sellens (1987)。';
  }

  function bindCrit() {
    var svg = $('crit'), tip = $('crit-tip'), box = $('crit-box'), detail = $('crit-detail');
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.getAttribute && t.getAttribute('data-crit')) {
        var id = t.getAttribute('data-crit');
        tip.innerHTML = critInfo(id);
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 250) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 96) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    svg.addEventListener('click', function (evt) {
      var t = evt.target;
      if (t && t.getAttribute && t.getAttribute('data-crit')) {
        CRIT_SEL = t.getAttribute('data-crit');
        drawCrit();
        detail.className = 'r-detail active';
        detail.innerHTML = critInfo(CRIT_SEL);
      }
    });
  }

  /* 文献表 */
  var SRC = [
    ['SY/T 5788.2-2018《油气探井气测录井规范》', '国家能源局 2018-10-29 发布、2019-03-01 实施（代替 SY/T 5788.2-2008）',
     '规定气测录井采样间距（1 m 一点）、全烃与 C1–C5 组分检测、脱气效率标定、背景气扣除与气显示记录格式。',
     '决定 demo 的 1 m 采样、TG+C1–C5 六通道设置与「工况校正」的标准脱气效率（75%）口径。', ''],
    ['Pixler B.O. (1969) “Formation Evaluation by Analysis of Hydrocarbon Ratios”', 'JPT 21(6): 665–670 · SPE-2454-PA',
     '用 C1/C2、C1/C3、C1/C4 三个比值在图版上划分油区、气区与干气/非产区。',
     '「模拟演示」页签 Pixler 图版的分区边界（10/35、14/82、21/200）与段点落区判读。', 'https://www.onepetro.org/JPT/article-abstract/21/06/665/164530/Formation-Evaluation-by-Analysis-of-Hydrocarbon'],
    ['Haworth J.H., Sellens M., Whittaker A. (1985)', 'AAPG Bulletin 69(8): 1305–1310',
     'C1–C5 轻烃显示解释奠基文献：湿度比 Wh <0.5% 干气、0.5–17.5% 气、17.5–40% 油/凝析、>40% 残余油。',
     'Whittaker 图版 Wh 分带与流体三分类阈值；水层「低全烃+纯 C1」的联合判识规则。', 'https://doi.org/10.1306/AD462BDC-16F7-11D7-8645000102C1865D'],
    ['Whittaker A., Sellens M. (1987) Wh/Bh/Ch 比值体系', '后收入 Whittaker A. 主编《Mud Logging Handbook》(1991)',
     '定义湿度比 Wh、平衡比 Bh=(C1+C2)/(C3+C4+C5) 与特征比 Ch；Bh<Wh 判非产层。',
     'demo 流体判别的特征构造（Wh、Bh 计算）与图版上「Bh=Wh 非产线」的绘制。', ''],
    ['Hou Y. et al. (2019) “Automatic Gas Influxes Detection in Offshore Drilling Based on Machine Learning Technology”', '海洋钻井气侵智能识别（ANN，12 通道录井参数，208 起气侵 / 62 口井）',
     '用录井多参数序列 + 神经网络实现气侵自动检测，验证泵参数等工况特征的有效性。',
     '佐证 demo 把「泵状态 / 接单根标记」作为硬特征剔除假异常（未过滤时假异常可占 30%+）的设计。', ''],
    ['Frontiers in Materials (2024) “Risk assessment of abnormal pressure zones … based on surface gas logging data”', 'Front. Mater. 11:1441357',
     '基于地面气测数据与统计关系评价浅层气异常压力，仍采用 Haworth/Whittaker 的 Wh、Bh、Ch 指标判识流体界面。',
     '佐证 Wh/Bh 判据在现代气测解释中的持续有效性，支撑 demo 图版选型。', 'https://www.frontiersin.org/journals/materials/articles/10.3389/fmats.2024.1441357/full'],
    ['Analytica Chimica Acta 1259 (2023) 341200', '拉曼光谱 + CNN-LSTM-AM 混合模型在线多组分气体测量',
     '实现录井现场 C1–C5 等气体的在线多组分定量，验证 CNN-LSTM 类序列模型对气体组分信号的可行性。',
     '佐证 demo 的 C1–C5 在线检测设定与案例「TCN+BiLSTM 序列分割」技术路线的现实对应。', 'https://doi.org/10.1016/j.aca.2023.341200']
  ];

  function buildTable() {
    var body = $('src-body');
    SRC.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td><b>' + r[0] + '</b><br><span style="color:#79828a">' + r[1] + '</span>' +
        (r[4] ? ' <a href="' + r[4] + '" target="_blank" rel="noopener">链接↗</a>' : '') +
        '</td><td>' + r[2] + '</td><td>' + r[3] + '</td>';
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
      });
    });
  }

  bindTabs();
  bindCrit();
  buildTable();
  drawCrit();
})();
