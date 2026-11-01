/* ======= 测井岩性智能识别 · 可运行示范 ======= */
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

  /* 确定性伪随机（mulberry32），保证每次重算噪声一致 */
  function rng32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------------- 岩性定义 ---------------- */
  var LITH = ['玄武岩', '安山岩', '凝灰岩', '砂砾岩', '泥岩'];
  var KEYS = ['basalt', 'andesite', 'tuff', 'conglom', 'mud'];
  var COLOR = { basalt: '#b05a51', andesite: '#c9a15a', tuff: '#41699b', conglom: '#8c7bb0', mud: '#9aa35f' };

  /* 五类岩性响应均值（合成，区间锚定文献，见数据页签） */
  var BASE = {
    basalt:   { GR: 30,  DEN: 2.78, CNL: 10, RT: 120, K: 0.7, Th: 1.8,  U: 0.6 },
    andesite: { GR: 55,  DEN: 2.62, CNL: 14, RT: 60,  K: 1.3, Th: 4.0,  U: 1.2 },
    tuff:     { GR: 85,  DEN: 2.30, CNL: 24, RT: 18,  K: 3.2, Th: 9.0,  U: 2.6 },
    conglom:  { GR: 48,  DEN: 2.45, CNL: 18, RT: 35,  K: 1.6, Th: 5.5,  U: 1.8 },
    mud:      { GR: 110, DEN: 2.35, CNL: 32, RT: 4,   K: 2.5, Th: 11.0, U: 3.5 }
  };
  var SIGMA = { GR: 6, DEN: 0.05, CNL: 2.5, K: 0.3, Th: 1.2, U: 0.6 };

  /* ---------------- 合成井（0.125 m，480 点，层序含 3 个凝灰岩薄层） ---------------- */
  var D0 = 2250, STEP = 0.125, N = 480;
  var LAYERS = [
    ['mud', 6.0], ['basalt', 4.0], ['mud', 3.0], ['tuff', 0.375], ['basalt', 5.0],
    ['andesite', 3.0], ['mud', 5.0], ['conglom', 2.5], ['mud', 4.0], ['tuff', 0.5],
    ['andesite', 2.5], ['basalt', 3.5], ['mud', 6.0], ['conglom', 2.75], ['tuff', 0.375],
    ['basalt', 4.5], ['mud', 7.0]
  ];
  var trueLith = [];   /* 每点真实岩性 key */
  var thinFlag = [];   /* 是否位于 <0.5 m 薄层 */
  (function buildLayers() {
    LAYERS.forEach(function (L) {
      var nPts = Math.round(L[1] / STEP);
      var thin = L[1] < 0.5;
      for (var i = 0; i < nPts; i++) { trueLith.push(L[0]); thinFlag.push(thin); }
    });
    while (trueLith.length < N) { trueLith.push('mud'); thinFlag.push(false); }
    trueLith.length = N; thinFlag.length = N;
  })();

  var FREQ = {};
  (function () {
    KEYS.forEach(function (k) { FREQ[k] = 0; });
    trueLith.forEach(function (k) { FREQ[k]++; });
    KEYS.forEach(function (k) { FREQ[k] /= N; });
  })();

  /* 特征与尺度 */
  var FEATS_ALL = ['GR', 'DEN', 'CNL', 'K', 'Th', 'U'];
  var SCALE = { GR: 40, DEN: 0.25, CNL: 12, K: 1.2, Th: 4, U: 1.2 };
  var FEAT_LABEL = { GR: 'GR', DEN: 'DEN', CNL: 'CNL', K: 'K', Th: 'Th', U: 'U' };

  /* ---------------- 状态 ---------------- */
  var DEF = { clf: 'knn', weight: 1, spec: 1, smooth: 30, protect: 1, alter: 25, shift: 0, cursor: 2272.5 };
  var S = Object.assign({}, DEF);

  /* ---------------- 数据生成 ---------------- */
  var obs = [];        /* 每点 {depth, GR,DEN,CNL,RT,K,Th,U, altered} */
  function genData() {
    var rnd = rng32(20261030);
    var rndA = rng32(777);
    obs = [];
    /* 层内缓变成分：随机游走 */
    var drift = { GR: 0, DEN: 0, CNL: 0, K: 0, Th: 0, U: 0 };
    for (var i = 0; i < N; i++) {
      var k = trueLith[i], b = BASE[k];
      var altered = (k === 'andesite') && (rndA() < S.alter / 100);
      ['GR', 'DEN', 'CNL', 'K', 'Th', 'U'].forEach(function (f) {
        drift[f] = clamp(drift[f] + gauss(rnd) * 0.35, -1.2, 1.2);
      });
      var gr = b.GR + (altered ? 20 : 0) + drift.GR * SIGMA.GR + gauss(rnd) * SIGMA.GR * 0.8 + S.shift;
      var den = b.DEN + (altered ? -0.15 : 0) + drift.DEN * SIGMA.DEN + gauss(rnd) * SIGMA.DEN * 0.8;
      var cnl = b.CNL + drift.CNL * SIGMA.CNL + gauss(rnd) * SIGMA.CNL * 0.8;
      var rt = b.RT * Math.exp(gauss(rnd) * 0.22);
      var kk = Math.max(0.05, b.K + drift.K * SIGMA.K + gauss(rnd) * SIGMA.K * 0.8);
      var th = Math.max(0.1, b.Th + drift.Th * SIGMA.Th + gauss(rnd) * SIGMA.Th * 0.8);
      var uu = Math.max(0.05, b.U + drift.U * SIGMA.U + gauss(rnd) * SIGMA.U * 0.8);
      obs.push({ depth: D0 + i * STEP, GR: gr, DEN: den, CNL: cnl, RT: rt, K: kk, Th: th, U: uu, altered: altered });
    }
  }

  /* ---------------- 分类器 ---------------- */
  function feats() { return S.spec ? FEATS_ALL : FEATS_ALL.slice(0, 3); }
  function classWeight(k) {
    if (!S.weight) return 1;
    return Math.pow(FREQ[k], -0.5);
  }
  function normVec(o) {
    var fs = feats(), v = {};
    fs.forEach(function (f) { v[f] = o[f] / SCALE[f]; });
    return v;
  }

  /* 最近邻：每类 40 个模板样本（固定种子），k=5 平均距离 → softmax */
  var TRAIN = null;
  function trainSet() {
    if (TRAIN) return TRAIN;
    var rnd = rng32(424242);
    TRAIN = {};
    KEYS.forEach(function (k) {
      TRAIN[k] = [];
      for (var i = 0; i < 40; i++) {
        var s = {};
        FEATS_ALL.forEach(function (f) {
          s[f] = (BASE[k][f] + gauss(rnd) * SIGMA[f]) / SCALE[f];
        });
        TRAIN[k].push(s);
      }
    });
    return TRAIN;
  }

  function classify(o) {
    var fs = feats(), x = normVec(o);
    var scores = {};
    if (S.clf === 'knn') {
      var T = trainSet(), ds = [];
      KEYS.forEach(function (k) {
        T[k].forEach(function (s) {
          var d = 0;
          fs.forEach(function (f) { var t = x[f] - s[f]; d += t * t; });
          ds.push({ k: k, d: Math.sqrt(d) });
        });
      });
      ds.sort(function (a, b) { return a.d - b.d; });
      var per = {};
      ds.slice(0, 5).forEach(function (e) {
        if (!per[e.k]) per[e.k] = { n: 0, s: 0 };
        per[e.k].n++; per[e.k].s += e.d;
      });
      KEYS.forEach(function (k) {
        var davg = per[k] ? per[k].s / per[k].n : 9;
        /* 类权重只作温和先验（×0.6），避免稀有类奖励吞掉边界样本 */
        scores[k] = -davg * davg * 6 + Math.log(classWeight(k)) * 0.6;
      });
    } else if (S.clf === 'bayes') {
      KEYS.forEach(function (k) {
        var s = 0;
        fs.forEach(function (f) {
          var sd = SIGMA[f] / SCALE[f] * 1.15;
          var t = (x[f] - BASE[k][f] / SCALE[f]) / sd;
          s += -0.5 * t * t;
        });
        scores[k] = s + Math.log(FREQ[k] * classWeight(k) + 1e-9);
      });
    } else { /* net：线性 Softmax（最近类质心的可微近似），概率更平滑 */
      KEYS.forEach(function (k) {
        var s = 0;
        fs.forEach(function (f) {
          var mu = BASE[k][f] / SCALE[f];
          var sd = SIGMA[f] / SCALE[f] * 1.4;
          s += (x[f] * mu) / (sd * sd);
          s -= 0.5 * (mu * mu) / (sd * sd);
        });
        scores[k] = s * 0.55 + Math.log(classWeight(k));
      });
    }
    /* softmax */
    var mx = -Infinity;
    KEYS.forEach(function (k) { mx = Math.max(mx, scores[k]); });
    var p = {}, sum = 0;
    KEYS.forEach(function (k) { p[k] = Math.exp(scores[k] - mx); sum += p[k]; });
    KEYS.forEach(function (k) { p[k] /= sum; });
    return p;
  }

  /* ---------------- 层序平滑 + 薄层保护 ---------------- */
  var probs = [], pred = [], conf = [], probsRaw = [];
  function classifyAll() {
    probsRaw = obs.map(classify);
    probs = probsRaw.map(function (p) { return Object.assign({}, p); });
    var lam = S.smooth / 100 * 0.85;
    for (var it = 0; it < 4 && lam > 0; it++) {
      var next = probs.map(function (p) { return Object.assign({}, p); });
      for (var i = 1; i < N - 1; i++) {
        KEYS.forEach(function (k) {
          var nb = (probs[i - 1][k] + probs[i + 1][k]) / 2;
          next[i][k] = (1 - lam) * probs[i][k] + lam * nb;
        });
      }
      probs = next;
    }
    pred = []; conf = [];
    for (var j = 0; j < N; j++) {
      var rawTop = 0;
      KEYS.forEach(function (k) { rawTop = Math.max(rawTop, probsRaw[j][k]); });
      /* 薄层保护：原始置信 ≥0.7 的点不参与平滑改写 */
      var useP = (S.protect && rawTop >= 0.7) ? probsRaw[j] : probs[j];
      var bk = KEYS[0], bp = -1;
      KEYS.forEach(function (k) { if (useP[k] > bp) { bp = useP[k]; bk = k; } });
      pred.push(bk); conf.push(bp);
    }
  }

  /* ---------------- 指标与混淆矩阵 ---------------- */
  function metrics() {
    var cm = {}; /* cm[true][pred] */
    KEYS.forEach(function (a) { cm[a] = {}; KEYS.forEach(function (b) { cm[a][b] = 0; }); });
    var correct = 0, thinTot = 0, thinHit = 0, lowCnt = 0;
    for (var i = 0; i < N; i++) {
      cm[trueLith[i]][pred[i]]++;
      if (pred[i] === trueLith[i]) correct++;
      if (thinFlag[i]) { thinTot++; if (pred[i] === trueLith[i]) thinHit++; }
      if (conf[i] < 0.6) lowCnt++;
    }
    var f1s = [], perClass = {};
    KEYS.forEach(function (k) {
      var tp = cm[k][k], fp = 0, fn = 0;
      KEYS.forEach(function (o) { if (o !== k) { fp += cm[o][k]; fn += cm[k][o]; } });
      var prec = tp + fp ? tp / (tp + fp) : 0;
      var rec = tp + fn ? tp / (tp + fn) : 0;
      var f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
      f1s.push(f1);
      perClass[k] = { prec: prec, rec: rec, f1: f1 };
    });
    var macro = f1s.reduce(function (a, b) { return a + b; }, 0) / f1s.length;
    return {
      acc: correct / N, macro: macro, perClass: perClass, cm: cm,
      tuffF1: perClass.tuff.f1,
      thinRec: thinTot ? thinHit / thinTot : 1,
      lowFrac: lowCnt / N
    };
  }

  /* ---------------- 渲染通用 ---------------- */
  var INK = '#242b2e', MUT = '#79828a', GRID = '#ece5d6', AXC = '#9ba3a9';
  function axisText(ctx, t, x, y, align, color) {
    ctx.fillStyle = color || MUT;
    ctx.font = '9px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
  }

  /* ================= 面板①：中子—密度交会图 ================= */
  var CROSS = { x0: 46, y0: 10, w: 368, h: 258 };
  function cx(cnl) { return CROSS.x0 + (cnl / 42) * CROSS.w; }
  function cy(den) { return CROSS.y0 + (1 - (den - 1.9) / (2.95 - 1.9)) * CROSS.h; }

  /* 骨架线（φ: DEN, CNL 近似数字化自 Schlumberger CP-2） */
  var MATRIX = [
    { name: '砂岩 2.65', color: '#235f51', pts: [[2.65, -2], [2.485, 8], [2.32, 17.5], [2.155, 27.5], [1.99, 38]] },
    { name: '灰岩 2.71', color: '#79828a', pts: [[2.71, 0], [2.54, 10], [2.37, 20], [2.20, 30], [2.02, 40]] },
    { name: '白云岩 2.87', color: '#b05a51', pts: [[2.87, 1], [2.70, 9], [2.53, 16.5], [2.36, 24], [2.185, 32]] }
  ];

  function renderCross(hoverIdx) {
    var cv = $('cv-cross');
    var ctx = setupCanvas(cv, 430, 300);
    ctx.clearRect(0, 0, 430, 300);
    /* 网格与坐标轴 */
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    var g;
    for (g = 0; g <= 40; g += 10) {
      ctx.beginPath(); ctx.moveTo(cx(g), CROSS.y0); ctx.lineTo(cx(g), CROSS.y0 + CROSS.h); ctx.stroke();
    }
    for (var d = 1.9; d <= 2.95; d += 0.2) {
      var dd = Math.round(d * 100) / 100;
      ctx.beginPath(); ctx.moveTo(CROSS.x0, cy(dd)); ctx.lineTo(CROSS.x0 + CROSS.w, cy(dd)); ctx.stroke();
    }
    for (g = 0; g <= 40; g += 10) axisText(ctx, String(g), cx(g), CROSS.y0 + CROSS.h + 12);
    [1.9, 2.1, 2.3, 2.5, 2.7, 2.9].forEach(function (v) {
      axisText(ctx, v.toFixed(1), CROSS.x0 - 8, cy(v), 'right');
    });
    axisText(ctx, 'CNL 中子孔隙度（pu，石灰岩刻度）', CROSS.x0 + CROSS.w / 2, CROSS.y0 + CROSS.h + 24);
    ctx.save();
    ctx.translate(12, CROSS.y0 + CROSS.h / 2); ctx.rotate(-Math.PI / 2);
    axisText(ctx, 'DEN 体积密度（g/cm³）', 0, 0);
    ctx.restore();

    /* 骨架线 */
    MATRIX.forEach(function (m) {
      ctx.strokeStyle = m.color; ctx.lineWidth = 1.4; ctx.setLineDash([5, 3]);
      ctx.beginPath();
      m.pts.forEach(function (p, i) {
        var X = cx(p[1]), Y = cy(p[0]);
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke(); ctx.setLineDash([]);
      var lp = m.pts[m.pts.length - 1];
      var lx = cx(lp[1]), lyv = cy(lp[0]);
      if (m.name.indexOf('砂岩') === 0) axisText(ctx, m.name, lx - 5, lyv + 1, 'right', m.color);
      else if (m.name.indexOf('灰岩') === 0) axisText(ctx, m.name, lx - 2, lyv + 10, 'right', m.color);
      else axisText(ctx, m.name, lx + 6, lyv - 9, 'left', m.color);
    });
    /* 孔隙度标注（沿灰岩线） */
    ctx.fillStyle = MUT;
    [[2.71, 0], [2.37, 20], [2.02, 40]].forEach(function (p) {
      var phi = p[1] === 0 ? 'φ=0' : (p[1] === 20 ? 'φ=20' : 'φ=40');
      axisText(ctx, phi, cx(p[1]) - 4, cy(p[0]) + 9, 'right', AXC);
    });

    /* 气 / 泥岩偏移方向箭头 */
    function arrow(x1, y1, x2, y2, label, color) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      var a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 6 * Math.cos(a - 0.4), y2 - 6 * Math.sin(a - 0.4));
      ctx.lineTo(x2 - 6 * Math.cos(a + 0.4), y2 - 6 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
      axisText(ctx, label, x2 + (x2 > x1 ? 8 : -8), y2 - 8, x2 > x1 ? 'left' : 'right', color);
    }
    arrow(cx(18), cy(2.42), cx(8), cy(2.12), '含气偏移方向', '#41699b');
    arrow(cx(24), cy(2.38), cx(36), cy(2.52), '泥质偏移方向', '#9aa35f');

    /* 样本点 */
    var ci = Math.round((S.cursor - D0) / STEP);
    for (var i = 0; i < N; i++) {
      var o = obs[i];
      ctx.fillStyle = COLOR[pred[i]];
      ctx.globalAlpha = (i === hoverIdx) ? 1 : 0.5;
      ctx.beginPath();
      ctx.arc(cx(o.CNL), cy(o.DEN), i === hoverIdx ? 3.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* 当前深度游标点 */
    if (ci >= 0 && ci < N) {
      var oc = obs[ci];
      ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx(oc.CNL), cy(oc.DEN), 5, 0, Math.PI * 2); ctx.stroke();
    }
    if (hoverIdx != null && hoverIdx >= 0) {
      var oh = obs[hoverIdx];
      ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx(oh.CNL), cy(oh.DEN), 6, 0, Math.PI * 2); ctx.stroke();
    }
  }

  /* ================= 面板②：随深多道测井图 ================= */
  var LOG = {
    top: 16, h: 396,
    tracks: [
      { name: 'GR', unit: '0–150 API', x: 34, w: 74 },
      { name: 'DEN/CNL', unit: '1.9–2.95 / 0–45', x: 116, w: 74 },
      { name: 'RT', unit: '0.1–1000 Ω·m', x: 198, w: 66 },
      { name: '预测岩性', unit: '', x: 272, w: 52 },
      { name: '录井真值', unit: '', x: 332, w: 52 }
    ],
    depthX: 4
  };
  function ly(depth) { return LOG.top + ((depth - D0) / (N * STEP)) * LOG.h; }
  function grX(v) { var t = LOG.tracks[0]; return t.x + clamp(v / 150, 0, 1) * t.w; }
  function denX(v) { var t = LOG.tracks[1]; return t.x + clamp((v - 1.9) / 1.05, 0, 1) * t.w; }
  function cnlX(v) { var t = LOG.tracks[1]; return t.x + clamp(v / 45, 0, 1) * t.w; }
  function rtX(v) { var t = LOG.tracks[2]; var l = Math.log10(clamp(v, 0.1, 1000)); return t.x + ((l + 1) / 4) * t.w; }

  function renderLog(hoverDepth) {
    var cv = $('cv-log');
    var ctx = setupCanvas(cv, 430, 440);
    ctx.clearRect(0, 0, 430, 440);

    /* 道头与分隔 */
    LOG.tracks.forEach(function (t) {
      axisText(ctx, t.name, t.x + t.w / 2, 7, 'center', '#235f51');
      ctx.strokeStyle = '#ded8c8'; ctx.lineWidth = 1;
      ctx.strokeRect(t.x, LOG.top, t.w, LOG.h);
    });
    /* 深度刻度（每 5 m） */
    ctx.strokeStyle = GRID;
    for (var d = D0; d <= D0 + N * STEP; d += 5) {
      var Y = ly(d);
      ctx.beginPath(); ctx.moveTo(LOG.tracks[0].x, Y); ctx.lineTo(LOG.tracks[2].x + LOG.tracks[2].w, Y); ctx.stroke();
      axisText(ctx, d.toFixed(0), LOG.depthX + 13, Y, 'center', AXC);
    }

    /* 曲线 */
    function polyline(getX, color, width) {
      ctx.strokeStyle = color; ctx.lineWidth = width || 1.1;
      ctx.beginPath();
      for (var i = 0; i < N; i++) {
        var X = getX(obs[i]), Y = ly(obs[i].depth);
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
    polyline(function (o) { return grX(o.GR); }, '#2f7d6b');
    polyline(function (o) { return denX(o.DEN); }, '#b05a51');
    polyline(function (o) { return cnlX(o.CNL); }, '#41699b');
    polyline(function (o) { return rtX(o.RT); }, '#c9a15a');

    /* 岩性柱 */
    var pt = LOG.tracks[3], tt = LOG.tracks[4];
    var rowH = LOG.h / N;
    for (var j = 0; j < N; j++) {
      var Y0 = ly(obs[j].depth), Y1 = ly(obs[j].depth + STEP);
      ctx.fillStyle = COLOR[pred[j]];
      ctx.globalAlpha = 0.25 + 0.75 * conf[j];
      ctx.fillRect(pt.x, Y0, pt.w, Math.max(0.8, Y1 - Y0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR[trueLith[j]];
      ctx.fillRect(tt.x, Y0, tt.w, Math.max(0.8, Y1 - Y0));
      /* 误判标记 */
      if (pred[j] !== trueLith[j]) {
        ctx.fillStyle = 'rgba(176,90,81,0.9)';
        ctx.fillRect(tt.x + tt.w + 2, Y0, 3, Math.max(0.8, Y1 - Y0));
      }
    }
    /* 低置信描边段 */
    ctx.strokeStyle = 'rgba(36,43,46,0.35)'; ctx.lineWidth = 1;
    for (var m = 0; m < N; m++) {
      if (conf[m] < 0.6) {
        var Ym = ly(obs[m].depth);
        ctx.beginPath(); ctx.moveTo(pt.x, Ym); ctx.lineTo(pt.x + pt.w, Ym); ctx.stroke();
      }
    }
    axisText(ctx, '红刻线=误判', tt.x + tt.w + 4, LOG.top + LOG.h + 8, 'left', '#b05a51');
    axisText(ctx, '透明度=置信度', pt.x, LOG.top + LOG.h + 8, 'left', MUT);

    /* 深度游标 */
    var ci = Math.round((S.cursor - D0) / STEP);
    if (ci >= 0 && ci < N) {
      var Yc = ly(S.cursor);
      ctx.strokeStyle = '#242b2e'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(LOG.tracks[0].x, Yc); ctx.lineTo(tt.x + tt.w, Yc); ctx.stroke();
      ctx.setLineDash([]);
    }
    /* 悬停深度 */
    if (hoverDepth != null) {
      var Yh = ly(hoverDepth);
      ctx.strokeStyle = '#41699b'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(LOG.tracks[0].x, Yh); ctx.lineTo(tt.x + tt.w, Yh); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ================= 面板③：指标与混淆矩阵 ================= */
  function fmtPct(v) { return (v * 100).toFixed(1) + '%'; }
  function renderMetrics(m) {
    $('m-acc').textContent = fmtPct(m.acc);
    $('m-f1').textContent = m.macro.toFixed(3);
    $('m-tuff').textContent = m.tuffF1.toFixed(2);
    $('m-thin').textContent = fmtPct(m.thinRec);
    $('m-low').textContent = fmtPct(m.lowFrac);
    $('mc-acc').className = 'mcard' + (m.acc >= 0.85 ? '' : m.acc >= 0.68 ? ' warn' : ' bad');
    $('mc-f1').className = 'mcard' + (m.macro >= 0.75 ? '' : ' warn');
    $('mc-tuff').className = 'mcard' + (m.tuffF1 >= 0.55 ? '' : ' bad');
    $('mc-thin').className = 'mcard' + (m.thinRec >= 0.7 ? '' : ' warn');
    $('mc-low').className = 'mcard';

    var tb = $('conf-body');
    var html = '';
    KEYS.forEach(function (a, ai) {
      var rowTot = 0;
      KEYS.forEach(function (b) { rowTot += m.cm[a][b]; });
      html += '<tr><td class="rlab"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' +
        COLOR[a] + ';margin-right:4px"></span>' + LITH[ai] + '</td>';
      KEYS.forEach(function (b, bi) {
        var v = rowTot ? m.cm[a][b] / rowTot : 0;
        var bg, fg = INK;
        if (a === b) {
          bg = 'rgba(47,125,107,' + (0.12 + 0.55 * v).toFixed(2) + ')';
        } else {
          bg = 'rgba(176,90,81,' + (v > 0.005 ? (0.08 + 0.5 * v).toFixed(2) : '0') + ')';
          if (v < 0.005) fg = AXC;
        }
        html += '<td class="num" style="background:' + bg + ';color:' + fg + '">' +
          (v > 0.005 ? (v * 100).toFixed(0) : '·') + '</td>';
      });
      var rec = m.perClass[a].rec;
      html += '<td class="num" style="font-weight:600;color:' + (rec >= 0.7 ? '#235f51' : '#b05a51') + '">' +
        (rec * 100).toFixed(0) + '%</td></tr>';
    });
    tb.innerHTML = html;

    /* 结论文案：与案例目标（准确率 ≥88%、宏 F1 ≥0.75、凝灰岩 F1 ≥0.55、薄层召回 ≥70%）对齐 */
    var v = $('verdict');
    var msgs = [];
    if (!S.spec) msgs.push('未使用能谱曲线：凝灰岩与泥岩在 GR—DEN 空间重叠，凝灰岩 F1 掉到 ' + m.tuffF1.toFixed(2));
    if (!S.weight) msgs.push('未做类别加权：模型偏向占约半数的泥岩，宏平均 F1 仅 ' + m.macro.toFixed(2));
    if (S.alter > 0 && m.perClass.andesite.rec < 0.7) msgs.push('蚀变安山岩 ' + S.alter + '%：GR/DEN 漂移使安山岩召回降至 ' + fmtPct(m.perClass.andesite.rec) + '，落点混入凝灰岩区');
    if (S.shift > 8) msgs.push('老井 GR 偏移 +' + S.shift + ' API：刻度差异被学成岩性差异，玄武岩/安山岩被高估为泥质类');
    if (S.smooth >= 70 && !S.protect) msgs.push('平滑过强且未开薄层保护：薄层召回降至 ' + fmtPct(m.thinRec) + '，凝灰岩夹层被抹掉');
    var goals = [];
    if (m.acc < 0.88) goals.push('总体准确率 ' + fmtPct(m.acc) + '（目标 ≥88%）');
    if (m.macro < 0.75) goals.push('宏平均 F1 ' + m.macro.toFixed(2) + '（目标 ≥0.75）');
    if (m.tuffF1 < 0.55) goals.push('凝灰岩 F1 ' + m.tuffF1.toFixed(2) + '（目标 ≥0.55）');
    if (m.thinRec < 0.7) goals.push('薄层召回 ' + fmtPct(m.thinRec) + '（目标 ≥70%）');
    if (!msgs.length && !goals.length) {
      v.className = 'verdict ok';
      v.innerHTML = '当前配置达到案例目标区：总体准确率 <b>' + fmtPct(m.acc) + '</b>（人工交会图基线 68%）、宏平均 F1 <b>' +
        m.macro.toFixed(2) + '</b>、凝灰岩 F1 <b>' + m.tuffF1.toFixed(2) + '</b>、薄层召回 <b>' + fmtPct(m.thinRec) + '</b>。';
    } else {
      v.className = 'verdict warn';
      var parts = msgs.slice();
      if (goals.length) parts.push('未达标项：' + goals.join('、') + '——可尝试开启类别加权/能谱曲线、降低平滑或减小刻度偏移');
      v.innerHTML = '<b>注意：</b>' + parts.join('；') + '。';
    }
  }

  /* ================= 单点判读依据 ================= */
  function evidence(i) {
    var o = obs[i];
    var p = probs[i], useP = (S.protect && topProb(probsRaw[i]) >= 0.7) ? probsRaw[i] : p;
    var order = KEYS.slice().sort(function (a, b) { return useP[b] - useP[a]; });
    var k1 = order[0], k2 = order[1];
    var fs = feats(), x = normVec(o);
    var contrib = fs.map(function (f) {
      var sd = SIGMA[f] / SCALE[f] * 1.15;
      var n1 = Math.pow((x[f] - BASE[k1][f] / SCALE[f]) / sd, 2);
      var n2 = Math.pow((x[f] - BASE[k2][f] / SCALE[f]) / sd, 2);
      var dir = o[f] > (BASE[k1][f] + BASE[k2][f]) / 2 ? '偏高' : '偏低';
      return { f: f, gain: n2 - n1, dir: dir };
    }).filter(function (c) { return c.gain > 0; })
      .sort(function (a, b) { return b.gain - a.gain; });
    return { k1: k1, k2: k2, p1: useP[k1], p2: useP[k2], contrib: contrib.slice(0, 2) };
  }
  function topProb(p) {
    var m = 0;
    KEYS.forEach(function (k) { m = Math.max(m, p[k]); });
    return m;
  }
  function lithName(k) { return LITH[KEYS.indexOf(k)]; }

  function updateDetail(i, locked) {
    var o = obs[i], ev = evidence(i);
    var d = $('log-detail');
    d.className = 'detail active';
    var evTxt = ev.contrib.length
      ? ev.contrib.map(function (c) { return FEAT_LABEL[c.f] + ' ' + c.dir; }).join('、')
      : '各曲线与次优类差异小';
    d.innerHTML = '<b>' + o.depth.toFixed(3) + ' m</b>　真值 <b style="color:' + COLOR[trueLith[i]] + '">' +
      lithName(trueLith[i]) + '</b>　判为 <b style="color:' + COLOR[ev.k1] + '">' + lithName(ev.k1) + '</b>' +
      '（<span class="mono">' + (ev.p1 * 100).toFixed(0) + '%</span>，次选 ' + lithName(ev.k2) + ' ' +
      '<span class="mono">' + (ev.p2 * 100).toFixed(0) + '%</span>）' +
      (o.altered ? '　<span style="color:#b05a51">蚀变</span>' : '') +
      '<br>GR <span class="mono">' + o.GR.toFixed(0) + '</span> API · DEN <span class="mono">' + o.DEN.toFixed(2) +
      '</span> g/cm³ · CNL <span class="mono">' + o.CNL.toFixed(0) + '</span> pu · RT <span class="mono">' +
      o.RT.toFixed(1) + '</span> Ω·m · K <span class="mono">' + o.K.toFixed(1) + '</span>% · Th <span class="mono">' +
      o.Th.toFixed(1) + '</span> ppm　判读依据：<b>' + evTxt + '</b>' + (locked ? '（已锁定）' : '');
  }

  /* ================= 数据页：U—Th 交会图版 ================= */
  var UT = { x0: 46, y0: 10, w: 368, h: 214 };
  function ux(u) { return UT.x0 + (u / 5) * UT.w; }
  function uy(th) { return UT.y0 + (1 - th / 16) * UT.h; }
  var UT_ZONES = [
    { k: 'basalt', u: 0.7, th: 1.9, ru: 0.45, rth: 1.2, label: '玄武岩（基性）' },
    { k: 'andesite', u: 1.3, th: 4.2, ru: 0.55, rth: 1.6, label: '安山岩（中性）' },
    { k: 'tuff', u: 2.8, th: 9.5, ru: 0.9, rth: 2.8, label: '凝灰质（偏酸性）' },
    { k: 'mud', u: 3.4, th: 11.8, ru: 0.7, rth: 2.2, label: '泥岩（富 Th）' }
  ];
  function renderUT(hoverIdx) {
    var cv = $('cv-ut');
    if (!cv) return;
    var ctx = setupCanvas(cv, 430, 260);
    ctx.clearRect(0, 0, 430, 260);
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    var g;
    for (g = 0; g <= 5; g += 1) {
      ctx.beginPath(); ctx.moveTo(ux(g), UT.y0); ctx.lineTo(ux(g), UT.y0 + UT.h); ctx.stroke();
      axisText(ctx, String(g), ux(g), UT.y0 + UT.h + 12);
    }
    for (g = 0; g <= 16; g += 4) {
      ctx.beginPath(); ctx.moveTo(UT.x0, uy(g)); ctx.lineTo(UT.x0 + UT.w, uy(g)); ctx.stroke();
      axisText(ctx, String(g), UT.x0 - 8, uy(g), 'right');
    }
    axisText(ctx, 'U 铀含量（ppm）', UT.x0 + UT.w / 2, UT.y0 + UT.h + 24);
    ctx.save();
    ctx.translate(12, UT.y0 + UT.h / 2); ctx.rotate(-Math.PI / 2);
    axisText(ctx, 'Th 钍含量（ppm）', 0, 0);
    ctx.restore();
    /* 文献分区 */
    UT_ZONES.forEach(function (z) {
      ctx.strokeStyle = COLOR[z.k]; ctx.fillStyle = COLOR[z.k];
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.ellipse(ux(z.u), uy(z.th), (z.ru / 5) * UT.w, (z.rth / 16) * UT.h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(ux(z.u), uy(z.th), (z.ru / 5) * UT.w, (z.rth / 16) * UT.h, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      axisText(ctx, z.label, ux(z.u), uy(z.th), 'center', COLOR[z.k]);
    });
    /* 本井样本（每 4 点取 1 个） */
    for (var i = 0; i < N; i += 4) {
      var o = obs[i];
      ctx.fillStyle = COLOR[trueLith[i]];
      ctx.globalAlpha = (i === hoverIdx) ? 1 : 0.75;
      ctx.beginPath();
      ctx.arc(ux(o.U), uy(o.Th), i === hoverIdx ? 3.6 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function renderRespTable() {
    var rows = [
      ['basalt', '基性火成岩：低放射性、高密度（JGE 2004；松辽营城组识别模式）'],
      ['andesite', '中性火成岩：响应居中，蚀变后漂向凝灰岩区（案例给定）'],
      ['tuff', '凝灰质富 K、强放射性、低密度（JGE 2004；松科二井凝灰岩特征）'],
      ['conglom', '碎屑岩经验范围：中 GR、中孔隙度（CP-2 图版砂岩骨架）'],
      ['mud', '泥岩富 Th、高 CNL、低 RT（CP-2 泥质点方向；IODP HNGS 说明）']
    ];
    var html = '';
    rows.forEach(function (r, i) {
      var b = BASE[r[0]];
      html += '<tr><td><i class="chip" style="background:' + COLOR[r[0]] + '"></i>' + LITH[i] + '</td>' +
        '<td class="num">' + b.GR + '</td><td class="num">' + b.DEN.toFixed(2) + '</td><td class="num">' + b.CNL +
        '</td><td class="num">' + b.RT + '</td><td class="num">' + b.K.toFixed(1) + '</td><td class="num">' +
        b.Th.toFixed(1) + '</td><td class="num">' + b.U.toFixed(1) + '</td><td>' + r[1] + '</td></tr>';
    });
    $('resp-body').innerHTML = html;
  }

  /* ================= 交互绑定 ================= */
  var lockIdx = null;
  var hoverLogIdx = null;

  function fullRender() {
    genData();
    classifyAll();
    var m = metrics();
    renderCross(null);
    renderLog(null);
    renderMetrics(m);
    renderUT(null);
    var ci = clamp(Math.round((S.cursor - D0) / STEP), 0, N - 1);
    updateDetail(lockIdx != null ? lockIdx : ci, lockIdx != null);
  }

  function bindRange(id, outId, fmt, apply) {
    var el = $(id);
    el.addEventListener('input', function () {
      var v = parseFloat(el.value);
      $(outId).textContent = fmt(v);
      apply(v);
      fullRender();
    });
  }

  bindRange('s-smooth', 'o-smooth', function (v) { return v.toFixed(0); }, function (v) { S.smooth = v; });
  bindRange('s-alter', 'o-alter', function (v) { return v.toFixed(0) + ' %'; }, function (v) { S.alter = v; });
  bindRange('s-shift', 'o-shift', function (v) { return v.toFixed(0) + ' API'; }, function (v) { S.shift = v; });
  bindRange('s-cursor', 'o-cursor', function (v) { return v.toFixed(1) + ' m'; }, function (v) { S.cursor = v; lockIdx = null; });

  $('s-clf').addEventListener('change', function () { S.clf = this.value; fullRender(); });
  $('s-weight').addEventListener('change', function () { S.weight = this.checked ? 1 : 0; fullRender(); });
  $('s-spec').addEventListener('change', function () { S.spec = this.checked ? 1 : 0; fullRender(); });
  $('s-protect').addEventListener('change', function () { S.protect = this.checked ? 1 : 0; fullRender(); });
  $('btn-reset').addEventListener('click', function () {
    S = Object.assign({}, DEF);
    $('s-clf').value = S.clf;
    $('s-weight').checked = !!S.weight;
    $('s-spec').checked = !!S.spec;
    $('s-protect').checked = !!S.protect;
    $('s-smooth').value = S.smooth; $('o-smooth').textContent = String(S.smooth);
    $('s-alter').value = S.alter; $('o-alter').textContent = S.alter + ' %';
    $('s-shift').value = S.shift; $('o-shift').textContent = S.shift + ' API';
    $('s-cursor').value = S.cursor; $('o-cursor').textContent = S.cursor.toFixed(1) + ' m';
    lockIdx = null;
    fullRender();
  });

  /* 页签 */
  function activateTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tabpane').forEach(function (p) {
      p.classList.toggle('active', p.id === 'pane-' + name);
    });
    if (name === 'real') renderUT(null);
  }
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.getAttribute('data-tab')); });
  });

  /* tooltip 工具 */
  function showTip(tip, html, x, y, box) {
    tip.innerHTML = html;
    tip.style.display = 'block';
    var bw = box.clientWidth, bh = box.clientHeight;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var L = x + 12, T = y + 12;
    if (L + tw > bw - 4) L = x - tw - 10;
    if (T + th > bh - 4) T = y - th - 10;
    tip.style.left = L + 'px';
    tip.style.top = T + 'px';
  }
  function canvasPos(cv, e) {
    var r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (430 / r.width),
      y: (e.clientY - r.top) * (cv.getAttribute('height') / r.height),
      cssX: e.clientX - r.left, cssY: e.clientY - r.top
    };
  }

  /* 交会图悬停：最近样本点 */
  var crossCv = $('cv-cross'), crossTip = $('tip-cross'), crossBox = $('box-cross');
  function crossNearest(mx, my) {
    var best = -1, bd = 10;
    for (var i = 0; i < N; i++) {
      var dx = cx(obs[i].CNL) - mx, dy = cy(obs[i].DEN) - my;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  crossCv.addEventListener('mousemove', function (e) {
    var p = canvasPos(crossCv, e);
    var i = crossNearest(p.x, p.y);
    renderCross(i);
    if (i < 0) { crossTip.style.display = 'none'; return; }
    var o = obs[i];
    showTip(crossTip,
      '<b>' + o.depth.toFixed(3) + ' m</b> · 真值 ' + lithName(trueLith[i]) +
      '<br>DEN <b>' + o.DEN.toFixed(2) + '</b> g/cm³ · CNL <b>' + o.CNL.toFixed(0) + '</b> pu' +
      '<br>判为 <b>' + lithName(pred[i]) + '</b>（' + (conf[i] * 100).toFixed(0) + '%）',
      p.cssX, p.cssY, crossBox);
  });
  crossCv.addEventListener('mouseleave', function () {
    crossTip.style.display = 'none';
    renderCross(null);
  });

  /* 随深图悬停/点击 */
  var logCv = $('cv-log'), logTip = $('tip-log'), logBox = $('box-log');
  function depthFromY(y) {
    var d = D0 + ((y - LOG.top) / LOG.h) * N * STEP;
    return clamp(d, D0, D0 + (N - 1) * STEP);
  }
  logCv.addEventListener('mousemove', function (e) {
    var p = canvasPos(logCv, e);
    var d = depthFromY(p.y);
    var i = Math.round((d - D0) / STEP);
    hoverLogIdx = i;
    renderLog(d);
    var o = obs[i];
    var ev = evidence(i);
    showTip(logTip,
      '<b>' + o.depth.toFixed(3) + ' m</b> · 真值 ' + lithName(trueLith[i]) + ' → ' + lithName(pred[i]) +
      '<br>GR <b>' + o.GR.toFixed(0) + '</b> · DEN <b>' + o.DEN.toFixed(2) + '</b> · CNL <b>' + o.CNL.toFixed(0) +
      '</b> · RT <b>' + o.RT.toFixed(0) + '</b>' +
      '<br>top-2：' + lithName(ev.k1) + ' <b>' + (ev.p1 * 100).toFixed(0) + '%</b> / ' + lithName(ev.k2) +
      ' ' + (ev.p2 * 100).toFixed(0) + '%',
      p.cssX, p.cssY, logBox);
    updateDetail(i, false);
  });
  logCv.addEventListener('mouseleave', function () {
    logTip.style.display = 'none';
    hoverLogIdx = null;
    renderLog(null);
    var ci = clamp(Math.round((S.cursor - D0) / STEP), 0, N - 1);
    updateDetail(lockIdx != null ? lockIdx : ci, lockIdx != null);
  });
  logCv.addEventListener('click', function (e) {
    var p = canvasPos(logCv, e);
    var i = Math.round((depthFromY(p.y) - D0) / STEP);
    lockIdx = (lockIdx === i) ? null : i;
    if (lockIdx != null) {
      S.cursor = obs[lockIdx].depth;
      $('s-cursor').value = S.cursor;
      $('o-cursor').textContent = S.cursor.toFixed(1) + ' m';
      renderCross(null);
    }
    updateDetail(lockIdx != null ? lockIdx : i, lockIdx != null);
  });

  /* U—Th 图悬停 */
  var utCv = $('cv-ut'), utTip = $('tip-ut'), utBox = $('box-ut');
  utCv.addEventListener('mousemove', function (e) {
    var p = canvasPos(utCv, e);
    var best = -1, bd = 10;
    for (var i = 0; i < N; i += 4) {
      var dx = ux(obs[i].U) - p.x, dy = uy(obs[i].Th) - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd) { bd = d; best = i; }
    }
    renderUT(best);
    if (best < 0) { utTip.style.display = 'none'; return; }
    var o = obs[best];
    showTip(utTip,
      '<b>' + o.depth.toFixed(3) + ' m</b> · ' + lithName(trueLith[best]) +
      '<br>U <b>' + o.U.toFixed(2) + '</b> ppm · Th <b>' + o.Th.toFixed(2) + '</b> ppm · K <b>' + o.K.toFixed(2) + '</b> %',
      p.cssX, p.cssY, utBox);
  });
  utCv.addEventListener('mouseleave', function () {
    utTip.style.display = 'none';
    renderUT(null);
  });

  /* 初始化 */
  renderRespTable();
  fullRender();
  if (window.location.hash === '#real') activateTab('real');
})();
