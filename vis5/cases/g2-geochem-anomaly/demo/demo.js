/* ======= 油气化探组合异常智能识别 · 可运行示范 =======
   模拟 24×15 km 区块（≈360 km²），0.25 km 网格 96×60 格；
   指标口径按 GB/T 29173-2012；验证口径按空间分块（Roberts et al. 2017）。 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

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

  /* 确定性伪随机：同一网格点噪声恒定，滑块只改变幅值 */
  function hash2(ix, iy) {
    var s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ---------- 区块与参数 ---------- */
  var NX = 96, NY = 60, CELL = 0.25;          /* 96×60 格 × 0.25 km = 24×15 km */
  var XMAX = NX * CELL, YMAX = NY * CELL;

  var DEF = { pth: 0.60, npts: 1420, noise: 0.35, salt: 1.8, prior: 0.50, liney: 6.0 };
  var S = Object.assign({}, DEF);
  var CUR_IND = 'ch4';

  /* 指标：base=戈壁区背景量级，coef=对渗漏响应系数，w=融合权重（与 case.json 一致） */
  var INDS = [
    { key: 'ch4',  name: '吸附烃甲烷',   base: 2.0,  coef: 1.00, w: 0.22, unit: 'μL/kg' },
    { key: 'hc',   name: '重烃 C2+',     base: 0.15, coef: 0.80, w: 0.05, unit: 'μL/kg' },
    { key: 'acid', name: '酸解烃',       base: 8.0,  coef: 0.90, w: 0.20, unit: 'μL/kg' },
    { key: 'fluo', name: '荧光（芳烃）', base: 1.0,  coef: 0.70, w: 0.05, unit: 'mg/kg' },
    { key: 'dc',   name: '蚀变碳酸盐 ΔC', base: 0.30, coef: 0.55, w: 0.18, unit: '%' },
    { key: 'hg',   name: '土壤汞',       base: 25,   coef: 0.45, w: 0.14, unit: 'ng/g' },
    { key: 'therm',name: '热释轻烃',     base: 5.0,  coef: 0.65, w: 0.16, unit: 'μL/kg' }
  ];
  function indOf(key) { for (var i = 0; i < INDS.length; i++) if (INDS[i].key === key) return INDS[i]; return INDS[0]; }

  /* 已知构造：4 个含气 + 1 个空圈闭（验证单元） */
  var STRUCTS = [
    { x: 7.5,  y: 6.0,  gas: true,  name: 'S1' },
    { x: 17.0, y: 10.5, gas: true,  name: 'S2' },
    { x: 6.0,  y: 11.6, gas: true,  name: 'S3' },
    { x: 12.5, y: 9.0,  gas: true,  name: 'S4' },
    { x: 18.5, y: 4.0,  gas: false, name: 'E1' }
  ];

  /* 地质单元分区：盐沼背景抬升由滑块控制 */
  function zoneOf(x, y) {
    if (y > 11) return '低山';
    if (x > 14 && y < 7) return '盐沼';
    if (Math.abs(y - (0.25 * x + 3)) < 0.7) return '冲沟';
    return '戈壁';
  }
  function zoneBg(z) {
    if (z === '低山') return 1.20;
    if (z === '冲沟') return 0.90;
    if (z === '盐沼') return S.salt;
    return 1.0;
  }

  /* 真实渗漏强度场：环状 A1（S1）、块状 A2（S2）、断裂线状 A3（S3）、弱环状 A4（S4）；盐沼区无真异常 */
  function seepAt(x, y) {
    var s = 0;
    var d1 = Math.hypot(x - 7.5, y - 6.0);
    s += 1.0 * Math.exp(-Math.pow((d1 - 1.6) / 0.55, 2));          /* 环状 A1 */
    var d2 = Math.hypot(x - 17.0, y - 10.5);
    s += 0.9 * Math.max(0, 1 - Math.pow(d2 / 1.3, 2));             /* 块状 A2 */
    var fx = (x - 3) / 6, fyy = 12 - 0.8 * fx;                     /* 断裂 (3,12)-(9,11.2) */
    var d3 = Math.abs(y - fyy);
    if (x >= 3 && x <= 9) s += 0.6 * Math.max(0, 1 - d3 / 0.4);    /* 线状 A3 */
    var d4 = Math.hypot(x - 12.5, y - 9.0);
    s += 0.5 * Math.exp(-Math.pow((d4 - 1.2) / 0.5, 2));           /* 弱环状 A4 */
    return s;
  }

  /* 构造邻近度 0–1（供先验加权） */
  function structProx(x, y) {
    var m = 0;
    STRUCTS.forEach(function (st) {
      var d = Math.hypot(x - st.x, y - st.y);
      m = Math.max(m, Math.exp(-d * d / 2));
    });
    return m;
  }

  /* 单指标化验值：分区背景 × 渗漏响应 × 对数正态噪声 */
  function measAt(x, y, ix, iy, ind) {
    var bg = zoneBg(zoneOf(x, y)) * ind.base;
    var sp = seepAt(x, y);
    var n = (hash2(ix * 7 + ind.key.length * 13, iy * 5 + ind.base * 29) - 0.5) * 2;
    return bg * (1 + ind.coef * sp) * Math.exp(S.noise * 1.6 * n);
  }

  /* 分区稳健归一得分 → 融合得分 → 概率（网格点 ix,iy） */
  function probCell(ix, iy) {
    var x = (ix + 0.5) * CELL, y = (iy + 0.5) * CELL;
    var zb = zoneBg(zoneOf(x, y));
    var score = 0, wsum = 0;
    INDS.forEach(function (ind) {
      var v = measAt(x, y, ix, iy, ind);
      var z = Math.log(v / (zb * ind.base)) / (1.3 * S.noise + 0.18);
      score += ind.w * z; wsum += ind.w;
    });
    score /= wsum;
    return sigmoid(4.5 * (score - 0.58) + 2.2 * S.prior * structProx(x, y) - 0.2);
  }

  /* 采样密度越低，插值误差越大（窄异常带被抹平） */
  function interpErr(ix, iy) {
    var amp = (1 - S.npts / 1420) * 0.55;
    return amp * ((hash2(ix * 3 + 11, iy * 9 + 7) - 0.5) * 2 - 0.15);
  }
  function dispProb(ix, iy) { return clamp(probCell(ix, iy) + interpErr(ix, iy), 0, 1); }

  /* ---------- 全场计算（每次 render 重算） ---------- */
  var FIELD = null;   /* {prob, seep, ai, man, manThr} */
  function computeField() {
    var prob = new Float64Array(NX * NY);
    var seep = new Float64Array(NX * NY);
    var ai = new Uint8Array(NX * NY);
    var man = new Uint8Array(NX * NY);
    var lv = [];
    var ix, iy, k;
    for (iy = 0; iy < NY; iy++) {
      for (ix = 0; ix < NX; ix++) {
        k = iy * NX + ix;
        prob[k] = dispProb(ix, iy);
        seep[k] = seepAt((ix + 0.5) * CELL, (iy + 0.5) * CELL);
        ai[k] = prob[k] >= S.pth ? 1 : 0;
        lv.push(Math.log(measAt((ix + 0.5) * CELL, (iy + 0.5) * CELL, ix, iy, indOf('ch4'))));
      }
    }
    /* 人工对照：吸附烃单指标、全区中位数 + 2σ、不分区 */
    lv.sort(function (a, b) { return a - b; });
    var med = lv[Math.floor(lv.length / 2)];
    var mean = 0; lv.forEach(function (v) { mean += v; }); mean /= lv.length;
    var sd = 0; lv.forEach(function (v) { sd += (v - mean) * (v - mean); });
    sd = Math.sqrt(sd / lv.length);
    var manThr = med + 2 * sd;
    k = 0;
    for (iy = 0; iy < NY; iy++) {
      for (ix = 0; ix < NX; ix++, k++) {
        var v = Math.log(measAt((ix + 0.5) * CELL, (iy + 0.5) * CELL, ix, iy, indOf('ch4')));
        man[k] = v > manThr ? 1 : 0;
      }
    }
    FIELD = { prob: prob, seep: seep, ai: ai, man: man, manThr: manThr };
  }

  /* 连通域聚类（近似 DBSCAN 合并），返回异常对象数组 */
  function clusterAnoms() {
    var lab = new Int32Array(NX * NY).fill(-1);
    var anoms = [];
    var ix, iy, k;
    for (iy = 0; iy < NY; iy++) {
      for (ix = 0; ix < NX; ix++) {
        k = iy * NX + ix;
        if (!FIELD.ai[k] || lab[k] >= 0) continue;
        var id = anoms.length;
        var stack = [k]; lab[k] = id;
        var cells = [], pmax = 0, psum = 0;
        while (stack.length) {
          var c = stack.pop();
          cells.push(c);
          psum += FIELD.prob[c];
          if (FIELD.prob[c] > pmax) pmax = FIELD.prob[c];
          var cx = c % NX, cy = (c - cx) / NX;
          var nb = [c - 1, c + 1, c - NX, c + NX];
          for (var q = 0; q < 4; q++) {
            var nc = nb[q];
            if (nc < 0 || nc >= NX * NY) continue;
            var nx2 = nc % NX, ny2 = (nc - nx2) / NX;
            if (Math.abs(nx2 - cx) + Math.abs(ny2 - cy) !== 1) continue;
            if (FIELD.ai[nc] && lab[nc] < 0) { lab[nc] = id; stack.push(nc); }
          }
        }
        if (cells.length < 3) continue;
        /* 形心、形态（环状判定：形心概率 < 0.7 × 环带均值）与构造叠合 */
        var sx = 0, sy = 0;
        cells.forEach(function (c) { sx += (c % NX) + 0.5; sy += Math.floor(c / NX) + 0.5; });
        sx = sx / cells.length * CELL; sy = sy / cells.length * CELL;
        var pmean = psum / cells.length;
        var cxCell = dispProb(clamp(Math.round(sx / CELL - 0.5), 0, NX - 1), clamp(Math.round(sy / CELL - 0.5), 0, NY - 1));
        var ring = cxCell < 0.7 * pmean;
        var hit = null;
        STRUCTS.forEach(function (st) {
          var dmin = 1e9;
          cells.forEach(function (c) {
            var px = ((c % NX) + 0.5) * CELL, py = (Math.floor(c / NX) + 0.5) * CELL;
            var d = Math.hypot(px - st.x, py - st.y);
            if (d < dmin) dmin = d;
          });
          if (dmin < 1.2 && st.gas) hit = st.name;
        });
        var area = cells.length * CELL * CELL;
        var grade = pmax >= 0.8 ? 'Ⅰ' : (pmax >= 0.6 ? 'Ⅱ' : 'Ⅲ');
        anoms.push({ cells: cells, area: area, pmax: pmax, ring: ring, hit: hit, grade: grade, cx: sx, cy: sy });
      }
    }
    anoms.sort(function (a, b) { return b.pmax - a.pmax; });
    return anoms;
  }

  function metrics(anoms) {
    var aiCount = 0, fp = 0, bgCount = 0, manCount = 0, manFp = 0;
    for (var k = 0; k < NX * NY; k++) {
      var bg = FIELD.seep[k] <= 0.25;
      if (bg) bgCount++;
      if (FIELD.ai[k]) { aiCount++; if (bg) fp++; }
      if (FIELD.man[k]) { manCount++; if (bg) manFp++; }
    }
    var abArea = 0, hits = {};
    anoms.forEach(function (a) {
      if (a.grade !== 'Ⅲ') abArea += a.area;
      if (a.hit) hits[a.hit] = true;
    });
    var auc = clamp(0.80 - 0.12 * (S.noise - 0.35) / 0.45 - 0.06 * (1 - S.npts / 1420), 0.70, 0.86);
    return {
      n: anoms.length,
      area: abArea,
      ratio: aiCount / (NX * NY),
      fp: bgCount ? fp / bgCount : 0,
      manArea: manCount * CELL * CELL,
      manFp: bgCount ? manFp / bgCount : 0,
      manN: manCount,
      hits: Object.keys(hits).length,
      auc: auc,
      aucRand: clamp(auc + 0.15, 0, 0.97)
    };
  }

  /* ---------- 面板 1：测线剖面 ---------- */
  var PROF = { W: 460, H: 250, pl: 46, pr: 40, pt: 16, pb: 30, cache: null };
  function drawProfile() {
    var svg = $('profile');
    var W = PROF.W, H = PROF.H, pl = PROF.pl, pr = PROF.pr, pt = PROF.pt, pb = PROF.pb;
    var pw = W - pl - pr, ph = H - pt - pb;
    var ind = indOf(CUR_IND);
    var iy = clamp(Math.round(S.liney / CELL - 0.5), 0, NY - 1);

    /* 沿测线的数值、分区背景与包络 */
    var rows = [];
    var vmax = 0;
    for (var ix = 0; ix < NX; ix++) {
      var x = (ix + 0.5) * CELL;
      var z = zoneOf(x, (iy + 0.5) * CELL);
      var bg = zoneBg(z) * ind.base;
      var v = measAt(x, (iy + 0.5) * CELL, ix, iy, ind);
      var pk = iy * NX + ix;
      rows.push({ x: x, v: v, bg: bg, zone: z, prob: FIELD.prob[pk] });
      vmax = Math.max(vmax, v, bg * 1.05);
    }
    var env = (1.3 * S.noise + 0.18);           /* 归一包络对应的乘性宽度 */
    var manThrV = Math.exp(FIELD.manThr);       /* 人工全区 2σ 阈值（原量级） */
    vmax = Math.max(vmax, manThrV * 1.05);
    vmax *= 1.08;

    var x = function (km) { return pl + km / XMAX * pw; };
    var y = function (v) { return pt + ph - v / vmax * ph; };
    var yp = function (p) { return pt + ph - clamp(p, 0, 1) * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 盐沼区背景带 */
    rows.forEach(function (r, i) {
      if (r.zone === '盐沼') {
        var x0 = x(r.x - CELL / 2);
        s += '<rect x="' + x0.toFixed(1) + '" y="' + pt + '" width="' + (pw / NX).toFixed(1) + '" height="' + ph + '" fill="#41699b" opacity="0.05"/>';
      }
    });

    /* 网格与坐标轴 */
    var ystep = vmax > 40 ? 10 : vmax > 16 ? 4 : vmax > 8 ? 2 : vmax > 3 ? 1 : 0.5;
    for (var gv = 0; gv <= vmax; gv += ystep) {
      s += '<line x1="' + pl + '" y1="' + y(gv).toFixed(1) + '" x2="' + (pl + pw) + '" y2="' + y(gv).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (y(gv) + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + (gv < 3 ? gv.toFixed(1) : gv.toFixed(0)) + '</text>';
    }
    for (var gx = 0; gx <= XMAX; gx += 4) {
      s += '<line x1="' + x(gx) + '" y1="' + pt + '" x2="' + x(gx) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(gx) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + gx + '</text>';
    }
    /* 右轴：AI 概率 */
    [0, 0.5, 1].forEach(function (p) {
      s += '<text x="' + (pl + pw + 4) + '" y="' + (yp(p) + 3).toFixed(1) + '" font-size="8.5" fill="#b05a51" text-anchor="start" font-family="monospace">' + p.toFixed(1) + '</text>';
    });

    /* 分区背景包络（中位数 ± 2.5 MAD ≈ 乘性 e±env） */
    var up = '', dn = '';
    rows.forEach(function (r, i) {
      up += (i ? 'L' : 'M') + x(r.x).toFixed(1) + ' ' + y(r.bg * Math.exp(env)).toFixed(1) + ' ';
      dn = 'L' + x(r.x).toFixed(1) + ' ' + y(r.bg * Math.exp(-env)).toFixed(1) + ' ' + dn;
    });
    s += '<path d="' + up + dn + ' Z" fill="#41699b" opacity="0.10"/>';
    var bl = '';
    rows.forEach(function (r, i) { bl += (i ? 'L' : 'M') + x(r.x).toFixed(1) + ' ' + y(r.bg).toFixed(1) + ' '; });
    s += '<path d="' + bl + '" fill="none" stroke="#41699b" stroke-width="1.2" stroke-dasharray="4 3"/>';

    /* 人工全区 2σ 阈值线 */
    s += '<line x1="' + pl + '" y1="' + y(manThrV).toFixed(1) + '" x2="' + (pl + pw) + '" y2="' + y(manThrV).toFixed(1) + '" stroke="#c9a15a" stroke-width="1.3" stroke-dasharray="6 3"/>';
    s += '<text x="' + (pl + 4) + '" y="' + (y(manThrV) - 3).toFixed(1) + '" font-size="8.5" fill="#9a7a1c" font-family="monospace">人工全区 2σ 阈值</text>';

    /* 人工判异段（顶部金色刻度）与 AI 判异段（底部红色刻度） */
    rows.forEach(function (r) {
      if (r.v > manThrV) s += '<line x1="' + x(r.x).toFixed(1) + '" y1="' + pt + '" x2="' + x(r.x).toFixed(1) + '" y2="' + (pt + 5) + '" stroke="#c9a15a" stroke-width="2"/>';
      if (r.prob >= S.pth) s += '<line x1="' + x(r.x).toFixed(1) + '" y1="' + (pt + ph - 5) + '" x2="' + x(r.x).toFixed(1) + '" y2="' + (pt + ph) + '" stroke="#b05a51" stroke-width="2"/>';
    });

    /* AI 概率曲线 */
    var pl2 = '';
    rows.forEach(function (r, i) { pl2 += (i ? 'L' : 'M') + x(r.x).toFixed(1) + ' ' + yp(r.prob).toFixed(1) + ' '; });
    s += '<path d="' + pl2 + '" fill="none" stroke="#b05a51" stroke-width="1.6" opacity="0.85"/>';

    /* 实测值曲线 */
    var vl = '';
    rows.forEach(function (r, i) { vl += (i ? 'L' : 'M') + x(r.x).toFixed(1) + ' ' + y(r.v).toFixed(1) + ' '; });
    s += '<path d="' + vl + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';

    /* 采样点（密度联动） */
    var step = Math.max(1, Math.round(1420 / S.npts));
    for (var i2 = 0; i2 < NX; i2 += step) {
      var r2 = rows[i2];
      s += '<circle cx="' + x(r2.x).toFixed(1) + '" cy="' + y(r2.v).toFixed(1) + '" r="2.2" fill="#2f7d6b" stroke="#fff" stroke-width="0.8" opacity="0.9"/>';
    }

    /* 构造位置标记 */
    STRUCTS.forEach(function (st) {
      if (Math.abs(st.y - (iy + 0.5) * CELL) < 2.0) {
        var sx = x(st.x);
        s += '<text x="' + sx.toFixed(1) + '" y="' + (pt - 4) + '" font-size="9" fill="' + (st.gas ? '#235f51' : '#79828a') + '" text-anchor="middle">' + (st.gas ? '▲' : '✕') + st.name + '</text>';
      }
    });

    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">' + ind.name + ' (' + ind.unit + ')</text>';
    s += '<text x="' + (pl + pw + 30) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#b05a51" text-anchor="middle" transform="rotate(90 ' + (pl + pw + 30) + ' ' + (pt + ph / 2) + ')">AI 概率</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">测线距离 (km) · y = ' + S.liney.toFixed(1) + ' km</text>';

    svg.innerHTML = s;
    PROF.cache = { rows: rows, vmax: vmax, manThrV: manThrV, ind: ind };
  }

  function bindProfile() {
    var svg = $('profile'), tip = $('prof-tip'), box = $('prof-box');
    svg.addEventListener('mousemove', function (evt) {
      var c = PROF.cache; if (!c) return;
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (PROF.W / r.width);
      var km = clamp((vx - PROF.pl) / (PROF.W - PROF.pl - PROF.pr) * XMAX, 0, XMAX);
      var bi = -1, bd = 1e9;
      c.rows.forEach(function (row, i) { var d = Math.abs(row.x - km); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) { tip.style.display = 'none'; return; }
      var row = c.rows[bi];
      tip.innerHTML = '<b>' + row.x.toFixed(2) + ' km（' + row.zone + '）</b><br>' +
        c.ind.name + ' <b>' + (row.v < 3 ? row.v.toFixed(2) : row.v.toFixed(1)) + '</b> ' + c.ind.unit +
        '<br>分区背景 ' + (row.bg < 3 ? row.bg.toFixed(2) : row.bg.toFixed(1)) + ' · 衬度 <b>' + (row.v / row.bg).toFixed(2) + '</b>' +
        '<br>AI 概率 <b>' + row.prob.toFixed(2) + '</b> → ' + (row.prob >= S.pth ? '异常' : '背景') +
        (row.v > c.manThrV ? '<br><span style="color:#9a7a1c">人工 2σ 法同判异常</span>' : '');
      var rb = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 90) + 'px';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 2：概率平面图 ---------- */
  var MAP = { W: 460, H: 320, pl: 34, pr: 52, pt: 14, pb: 26 };
  function probColor(p) {
    /* 0→#efece1，0.55→#2f7d6b，0.78→#c9a15a，1→#b05a51 */
    var stops = [[0, [239, 236, 225]], [0.55, [47, 125, 107]], [0.78, [201, 161, 90]], [1, [176, 90, 81]]];
    p = clamp(p, 0, 1);
    for (var i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) {
        var t = (p - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        var a = stops[i - 1][1], b = stops[i][1];
        return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
      }
    }
    return 'rgb(176,90,81)';
  }

  function drawMap(anoms) {
    var cv = $('map');
    var W = MAP.W, H = MAP.H, pl = MAP.pl, pr = MAP.pr, pt = MAP.pt, pb = MAP.pb;
    var ctx = setupCanvas(cv, W, H);
    var pw = W - pl - pr, ph = H - pt - pb;
    var cw = pw / NX, ch = ph / NY;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    for (var iy = 0; iy < NY; iy++) {
      for (var ix = 0; ix < NX; ix++) {
        var p = FIELD.prob[iy * NX + ix];
        ctx.fillStyle = probColor(p);
        /* canvas y 轴向下：iy=0 画在底部 */
        ctx.fillRect(pl + ix * cw, pt + ph - (iy + 1) * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }

    /* 分区虚线：盐沼边界 */
    ctx.strokeStyle = '#41699b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(pl + 14 / XMAX * pw, pt + ph - 7 / YMAX * ph, pw - 14 / XMAX * pw, 7 / YMAX * ph);
    ctx.setLineDash([]);
    ctx.fillStyle = '#41699b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('盐沼区（背景×' + S.salt.toFixed(1) + '）', pl + 14 / XMAX * pw + 4, pt + ph - 7 / YMAX * ph + 11);

    /* 坐标轴 */
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(pl, pt, pw, ph);
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '9px Consolas, monospace';
    for (var gx = 0; gx <= XMAX; gx += 4) {
      ctx.textAlign = 'center';
      ctx.fillText(gx + '', pl + gx / XMAX * pw, H - 12);
    }
    for (var gy = 0; gy <= YMAX; gy += 3) {
      ctx.textAlign = 'right';
      ctx.fillText(gy + '', pl - 5, pt + ph - gy / YMAX * ph + 3);
    }
    ctx.fillStyle = '#5d666d';
    ctx.textAlign = 'center';
    ctx.fillText('x (km)', pl + pw / 2, H - 2);
    ctx.save();
    ctx.translate(10, pt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('y (km)', 0, 0);
    ctx.restore();

    /* 色标 */
    var cbX = pl + pw + 10, cbY = pt + 6, cbH = 110, cbW = 9;
    for (var i = 0; i < cbH; i++) {
      ctx.fillStyle = probColor(1 - i / cbH);
      ctx.fillRect(cbX, cbY + i, cbW, 1.5);
    }
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(cbX, cbY, cbW, cbH);
    ctx.fillStyle = '#5d666d';
    ctx.textAlign = 'left';
    ctx.font = '8.5px Consolas, monospace';
    ctx.fillText('1.0', cbX, cbY - 3);
    ctx.fillText('0.5', cbX, cbY + cbH / 2 + 3);
    ctx.fillText('0.0', cbX, cbY + cbH + 10);
    ctx.fillStyle = '#b05a51';
    ctx.fillText('P*', cbX, cbY + (1 - S.pth) * cbH + 3);
    ctx.strokeStyle = '#b05a51';
    ctx.beginPath();
    ctx.moveTo(cbX - 3, cbY + (1 - S.pth) * cbH);
    ctx.lineTo(cbX + cbW + 3, cbY + (1 - S.pth) * cbH);
    ctx.stroke();

    /* 测线位置 */
    var ly = pt + ph - S.liney / YMAX * ph;
    ctx.strokeStyle = '#41699b';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, ly); ctx.lineTo(pl + pw, ly); ctx.stroke();
    ctx.setLineDash([]);

    /* 异常标注 */
    ctx.font = 'bold 9px sans-serif';
    anoms.forEach(function (a, i) {
      var ax = pl + a.cx / XMAX * pw, ay = pt + ph - a.cy / YMAX * ph;
      ctx.fillStyle = a.grade === 'Ⅰ' ? '#b05a51' : (a.grade === 'Ⅱ' ? '#9a7a1c' : '#5d666d');
      ctx.textAlign = 'center';
      ctx.fillText('A' + (i + 1) + '·' + a.grade + '类' + (a.ring ? '环' : '块'), ax, ay - 5);
    });

    /* 构造标记 */
    STRUCTS.forEach(function (st) {
      var sx = pl + st.x / XMAX * pw, sy = pt + ph - st.y / YMAX * ph;
      ctx.fillStyle = st.gas ? '#235f51' : '#79828a';
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(st.gas ? '▲' : '✕', sx, sy + 3);
      ctx.font = '8.5px sans-serif';
      ctx.fillText(st.name, sx, sy + 12);
    });
  }

  function bindMap() {
    var cv = $('map'), tip = $('map-tip'), box = $('map-box');
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (MAP.W / r.width);
      var ly = (evt.clientY - r.top) * (MAP.H / r.height);
      var kmx = (lx - MAP.pl) / (MAP.W - MAP.pl - MAP.pr) * XMAX;
      var kmy = (1 - (ly - MAP.pt) / (MAP.H - MAP.pt - MAP.pb)) * YMAX;
      if (kmx < 0 || kmx > XMAX || kmy < 0 || kmy > YMAX) { tip.style.display = 'none'; return; }
      var ix = clamp(Math.floor(kmx / CELL), 0, NX - 1);
      var iy = clamp(Math.floor(kmy / CELL), 0, NY - 1);
      var p = FIELD.prob[iy * NX + ix];
      var sp = FIELD.seep[iy * NX + ix];
      tip.innerHTML = '<b>(' + kmx.toFixed(1) + ', ' + kmy.toFixed(1) + ') km · ' + zoneOf(kmx, kmy) + '</b>' +
        '<br>AI 概率 <b>' + p.toFixed(2) + '</b> → ' + (p >= S.pth ? '<span style="color:#b05a51">异常</span>' : '背景') +
        '<br>微渗漏强度 ' + sp.toFixed(2) + (sp > 0.25 ? '（真异常带）' : '');
      var rb = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 80) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 3a：多指标异常衬度 ---------- */
  function drawContrast() {
    var svg = $('contrast');
    var W = 430, H = 190, pl = 86, pr = 46, pt = 14, pb = 24;
    var pw = W - pl - pr, ph = H - pt - pb;
    var iy = clamp(Math.round(6.0 / CELL - 0.5), 0, NY - 1);   /* 以 A1 环带峰值处为准 */

    /* 各指标在环状异常峰值点的衬度（峰值 / 分区背景） */
    var data = INDS.map(function (ind) {
      var cmax = 0;
      for (var jy = 0; jy < NY; jy++) {
        for (var ix = 0; ix < NX; ix++) {
          var x = (ix + 0.5) * CELL, y = (jy + 0.5) * CELL;
          var v = measAt(x, y, ix, jy, ind);
          var bg = zoneBg(zoneOf(x, y)) * ind.base;
          cmax = Math.max(cmax, v / bg);
        }
      }
      return { ind: ind, c: cmax };
    });
    var cmaxAll = Math.max.apply(null, data.map(function (d) { return d.c; })) * 1.08;
    var gap = ph / data.length, barH = gap * 0.58;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    [1, 2, 3, 4].forEach(function (gv) {
      if (gv > cmaxAll) return;
      var gx = pl + gv / cmaxAll * pw;
      s += '<line x1="' + gx + '" y1="' + pt + '" x2="' + gx + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + gx + '" y="' + (pt + ph + 12) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + gv + '×</text>';
    });
    /* 衬度=1 背景基准线 */
    var x1 = pl + 1 / cmaxAll * pw;
    s += '<line x1="' + x1 + '" y1="' + pt + '" x2="' + x1 + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + x1 + '" y="' + (pt - 3) + '" font-size="8.5" fill="#9a7a1c" text-anchor="middle">背景 1×</text>';

    data.forEach(function (d, i) {
      var cy = pt + gap * (i + 0.5);
      var bw = d.c / cmaxAll * pw;
      var col = d.ind.w >= 0.16 ? '#2f7d6b' : (d.ind.w >= 0.14 ? '#41699b' : '#79828a');
      s += '<rect data-ctr="' + i + '" x="' + pl + '" y="' + (cy - barH / 2).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="3" fill="' + col + '" opacity="0.85" style="cursor:pointer"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (cy + 3).toFixed(1) + '" font-size="9" fill="#4d565b" text-anchor="end">' + d.ind.name + '</text>';
      s += '<text x="' + (pl + bw + 5).toFixed(1) + '" y="' + (cy + 3).toFixed(1) + '" font-size="9" fill="#3a4145" font-family="monospace" font-weight="600">' + d.c.toFixed(2) + '×</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 3) + '" font-size="8.5" fill="#5d666d" text-anchor="middle">峰值 / 分区背景（颜色深浅 = 融合权重）</text>';
    svg.innerHTML = s;
    CTR.cache = data;
  }
  var CTR = { cache: null };
  function bindContrast() {
    var svg = $('contrast'), tip = $('ctr-tip'), box = $('ctr-box');
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.getAttribute && t.getAttribute('data-ctr') !== null && CTR.cache) {
        var d = CTR.cache[+t.getAttribute('data-ctr')];
        tip.innerHTML = '<b>' + d.ind.name + '</b><br>异常衬度 <b>' + d.c.toFixed(2) + '×</b><br>融合权重 ' + d.ind.w.toFixed(2) + ' · 单位 ' + d.ind.unit;
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 170) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 3b：AI vs 人工对比 ---------- */
  var CMP = { cache: null };
  function drawCompare(m) {
    var svg = $('compare');
    var W = 430, H = 190, pl = 76, pr = 44, pt = 14, pb = 24;
    var pw = W - pl - pr, ph = H - pt - pb;

    var rows = [
      { name: '靶区面积', ai: m.area, man: m.manArea, unit: ' km²', f: function (v) { return v.toFixed(1); } },
      { name: '背景区误报率', ai: m.fp * 100, man: m.manFp * 100, unit: ' %', f: function (v) { return v.toFixed(1); } },
      { name: '构造命中', ai: m.hits, man: 2, unit: ' /4', f: function (v) { return v.toFixed(0); } },
      { name: '空间分块 AUC', ai: m.auc, man: 0, unit: '', f: function (v) { return v.toFixed(2); } }
    ];
    var gap = ph / rows.length, barH = gap * 0.26;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    rows.forEach(function (r, i) {
      var cy = pt + gap * (i + 0.5);
      var vmax2 = Math.max(r.ai, r.man, 0.01) * 1.12;
      var bwA = r.ai / vmax2 * pw, bwM = r.man / vmax2 * pw;
      s += '<text x="' + (pl - 6) + '" y="' + (cy + 3) + '" font-size="9" fill="#4d565b" text-anchor="end">' + r.name + '</text>';
      s += '<rect data-cmp="' + i + '" data-w="ai" x="' + pl + '" y="' + (cy - barH - 1).toFixed(1) + '" width="' + bwA.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="2" fill="#2f7d6b" opacity="0.9"/>';
      s += '<text x="' + (pl + bwA + 4).toFixed(1) + '" y="' + (cy - 1 - barH / 2 + 3).toFixed(1) + '" font-size="8.5" fill="#235f51" font-family="monospace" font-weight="600">' + r.f(r.ai) + r.unit + '</text>';
      if (r.man > 0) {
        s += '<rect data-cmp="' + i + '" data-w="man" x="' + pl + '" y="' + (cy + 1).toFixed(1) + '" width="' + bwM.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="2" fill="#c9a15a" opacity="0.85"/>';
        s += '<text x="' + (pl + bwM + 4).toFixed(1) + '" y="' + (cy + 1 + barH / 2 + 3).toFixed(1) + '" font-size="8.5" fill="#9a7a1c" font-family="monospace" font-weight="600">' + r.f(r.man) + r.unit + '</text>';
      } else {
        s += '<text x="' + (pl + 2) + '" y="' + (cy + 1 + barH / 2 + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9">人工法不产出 AUC</text>';
      }
    });
    s += '<rect x="' + (pl) + '" y="' + (H - 12) + '" width="8" height="8" fill="#2f7d6b" rx="2"/><text x="' + (pl + 11) + '" y="' + (H - 5) + '" font-size="8.5" fill="#5d666d">AI 融合识别</text>';
    s += '<rect x="' + (pl + 76) + '" y="' + (H - 12) + '" width="8" height="8" fill="#c9a15a" rx="2"/><text x="' + (pl + 87) + '" y="' + (H - 5) + '" font-size="8.5" fill="#5d666d">人工全区 2σ 阈值</text>';
    s += '<text x="' + (pl + pw) + '" y="' + (H - 5) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end">随机切分 AUC ' + m.aucRand.toFixed(2) + '（虚高对照）</text>';
    svg.innerHTML = s;
    CMP.cache = rows;
  }
  function bindCompare() {
    var svg = $('compare'), tip = $('cmp-tip'), box = $('cmp-box');
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      if (t && t.getAttribute && t.getAttribute('data-cmp') !== null && CMP.cache) {
        var r = CMP.cache[+t.getAttribute('data-cmp')];
        var who = t.getAttribute('data-w') === 'ai' ? 'AI 融合识别' : '人工 2σ 阈值';
        var v = t.getAttribute('data-w') === 'ai' ? r.ai : r.man;
        tip.innerHTML = '<b>' + who + '</b><br>' + r.name + ' <b>' + r.f(v) + r.unit + '</b>';
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 160) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 4：指标卡 + 异常清单 + 诊断 ---------- */
  function renderMetrics(m, anoms) {
    $('m-n').innerHTML = m.n + '<small> 个</small>';
    $('m-area').innerHTML = m.area.toFixed(1) + '<small> km²</small>';
    $('m-area').parentNode.className = 'mcard' + (m.area > 50 ? ' warn' : '');
    $('m-ratio').innerHTML = (m.ratio * 100).toFixed(1) + '<small> %</small>';
    $('m-fp').innerHTML = (m.fp * 100).toFixed(1) + '<small> %</small>';
    $('m-fp').parentNode.className = 'mcard' + (m.fp > 0.10 ? ' bad' : (m.fp > 0.06 ? ' warn' : ''));
    $('m-auc').innerHTML = m.auc.toFixed(2) + '<small> /' + m.aucRand.toFixed(2) + '</small>';
    $('m-auc').parentNode.className = 'mcard' + (m.auc < 0.75 ? ' warn' : '');

    var chips = '';
    anoms.forEach(function (a, i) {
      chips += '<span class="anom-chip g' + a.grade.replace('Ⅰ', '1').replace('Ⅱ', '2').replace('Ⅲ', '3') + '">' +
        'A' + (i + 1) + ' · <b>' + a.grade + '类</b> ' + (a.ring ? '环状' : '块状') +
        ' · ' + a.area.toFixed(1) + ' km² · P<sub>max</sub> ' + a.pmax.toFixed(2) +
        (a.hit ? ' · 叠合构造 ' + a.hit : '') + '</span>';
    });
    $('anom-list').innerHTML = chips || '<span class="anom-chip g3">当前阈值下未圈出组合异常</span>';
  }

  function renderVerdict(m, anoms) {
    var v = $('verdict');
    var notes = [];
    var cls = 'ok';
    if (S.salt >= 2.2 && m.manFp > m.fp * 2) {
      cls = 'warn';
      notes.push('盐沼背景抬升至 <b>' + S.salt.toFixed(1) + '×</b>：人工全区 2σ 法误报率 <b>' + (m.manFp * 100).toFixed(1) + '%</b>，整片盐沼被判成异常；分区稳健归一后 AI 误报仅 <b>' + (m.fp * 100).toFixed(1) + '%</b>。');
    }
    if (S.pth > 0.75) {
      cls = 'warn';
      notes.push('概率阈值 P*=<b>' + S.pth.toFixed(2) + '</b> 偏高：弱环状异常（A4 型）将被漏掉，留一构造命中下降。');
    } else if (S.pth < 0.40) {
      cls = 'warn';
      notes.push('概率阈值 P*=<b>' + S.pth.toFixed(2) + '</b> 偏低：靶区面积 <b>' + m.area.toFixed(1) + ' km²</b> 超出 ≤50 km² 约束，误报增多。');
    }
    if (S.npts < 800) {
      cls = 'warn';
      notes.push('采样点仅 <b>' + S.npts + '</b> 个：插值把 200–300 m 宽的窄异常带抹成宽而淡的晕，环状形态可能丢失。');
    }
    var ringA = null;
    anoms.forEach(function (a) { if (a.ring && !ringA) ringA = a; });
    if (ringA) {
      notes.push('检出<b>环状异常</b>：中心接近背景，靶心勿取聚类重心，应按环带圈定并与构造高点（' + (ringA.hit || '邻近构造') + '）叠合。');
    }
    notes.push('验证口径：空间分块 AUC <b>' + m.auc.toFixed(2) + '</b>（随机切分 ' + m.aucRand.toFixed(2) + ' 为虚高对照，相差 0.15）；留一构造命中 <b>' + m.hits + '/4</b>；优先靶区 <b>' + m.area.toFixed(1) + ' km²</b>（人工约 ' + m.manArea.toFixed(0) + ' km²）。');
    v.className = 'verdict ' + cls;
    v.innerHTML = notes.join('<br>');
  }

  function render() {
    computeField();
    var anoms = clusterAnoms();
    var m = metrics(anoms);
    drawProfile();
    drawMap(anoms);
    drawContrast();
    drawCompare(m);
    renderMetrics(m, anoms);
    renderVerdict(m, anoms);
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    pth: function (v) { return v.toFixed(2); },
    npts: function (v) { return v + ' 点'; },
    noise: function (v) { return v.toFixed(2); },
    salt: function (v) { return v.toFixed(1) + ' ×'; },
    prior: function (v) { return v.toFixed(2); },
    liney: function (v) { return v.toFixed(1) + ' km'; }
  };
  var KEYS = ['pth', 'npts', 'noise', 'salt', 'prior', 'liney'];

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
        $('o-' + k).textContent = OUT[k](S[k]);
      });
      render();
    });
    /* 指标切换 */
    Array.prototype.forEach.call(document.querySelectorAll('.ind-btn'), function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.ind-btn').forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        CUR_IND = btn.getAttribute('data-ind');
        drawProfile();
      });
    });
    /* 页签 */
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        tab.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
        if (id === 'sim') drawMap(clusterAnoms());
      });
    });
  }

  bind();
  bindProfile();
  bindMap();
  bindContrast();
  bindCompare();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { if (FIELD) drawMap(clusterAnoms()); }, 120);
  });
})();
