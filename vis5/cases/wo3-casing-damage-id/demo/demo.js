/* ======= 套管损伤智能识别 ======= */
(function () {
  'use strict';

  var R0 = 69.85;        // Φ139.7 mm 套管公称内半径
  var WALL = 7.72;       // 套管壁厚 mm
  var DEPTH = 3000;      // 井深 m
  var N = 300;           // 10 m / 样点
  var AZ = 90;           // 成像方位格
  var CORR_AZ = 205, CORR_ARC = 70;
  var TYPE_NAME = { N: '正常', D: '变形', C: '腐蚀', P: '穿孔' };

  var PARAMS = [
    { id: 'deform', label: '变形幅度', unit: '%', min: 0, max: 14, step: 0.5, value: 6 },
    { id: 'deformPos', label: '变形段起点', unit: '%', min: 10, max: 85, step: 1, value: 40 },
    { id: 'deformLen', label: '变形段长度', unit: '%', min: 2, max: 20, step: 1, value: 8 },
    { id: 'corrLoss', label: '腐蚀壁厚减薄', unit: '%', min: 0, max: 40, step: 1, value: 22 },
    { id: 'perfN', label: '穿孔数量', unit: '处', min: 0, max: 6, step: 1, value: 2 },
    { id: 'arms', label: '井径臂数', unit: '臂', min: 40, max: 60, step: 20, value: 40 },
    { id: 'noise', label: '测量噪声', unit: '', min: 0, max: 4, step: 0.1, value: 1.5 },
    { id: 'deformTh', label: '变形判定阈值', unit: '%', min: 1.5, max: 6, step: 0.5, value: 2 },
    { id: 'imgOn', label: '成像分支', unit: '', kind: 'toggle', labels: ['关闭', '开启'], min: 0, max: 1, step: 1, value: 1 }
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
  function smooth(arr, half) {
    var out = new Float64Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
      var s = 0, c = 0;
      for (var j = Math.max(0, i - half); j <= Math.min(arr.length - 1, i + half); j++) { s += arr[j]; c++; }
      out[i] = s / c;
    }
    return out;
  }

  /* ================= 仿真：真值 + 测量 + AI ================= */
  function simulate(st) {
    var rnd = mulberry32(20261031);
    var i, a, z, q, k;

    var truthType = new Array(N);
    var truthGrade = new Array(N);
    var deform = new Float64Array(N);
    var wallLoss = new Float64Array(N);
    var perfFlag = new Uint8Array(N);

    // 变形段
    var ds = Math.round(st.deformPos / 100 * N);
    var dl = Math.max(1, Math.round(st.deformLen / 100 * N));
    for (i = 0; i < N; i++) {
      if (i >= ds && i < ds + dl) {
        var rel = dl > 1 ? (i - ds) / (dl - 1) : 1;
        deform[i] = st.deform * Math.pow(Math.sin(Math.PI * clamp(rel, 0, 1)), 0.75);
      }
    }

    // 腐蚀段：固定 58%—72% 井段，局部弧面
    var cs = Math.round(0.58 * N), cl = Math.round(0.14 * N);
    for (i = cs; i < cs + cl; i++) {
      var rel2 = (i - cs) / (cl - 1);
      wallLoss[i] = st.corrLoss * Math.pow(Math.sin(Math.PI * clamp(rel2, 0, 1)), 0.7);
    }

    // 穿孔：确定性分布
    for (k = 0; k < st.perfN; k++) {
      var pd = Math.round(N * (0.26 + 0.60 * ((k * 0.37 + 0.13) % 1)));
      perfFlag[pd] = 1;
      if (pd + 1 < N) perfFlag[pd + 1] = 1;
    }

    // 真值类型与分级
    for (i = 0; i < N; i++) {
      var t = 'N', g = 0;
      if (deform[i] >= 2.0) { t = 'D'; g = deform[i] >= 10 ? 3 : deform[i] >= 5 ? 2 : 1; }
      var wl = wallLoss[i];
      var cg = wl >= 10 ? (wl >= 30 ? 3 : wl >= 20 ? 2 : 1) : 0;
      if (cg > g) { t = 'C'; g = cg; }
      if (perfFlag[i]) { t = 'P'; g = 3; }
      truthType[i] = t; truthGrade[i] = g;
    }

    // 多臂井径测量
    var armN = st.arms;
    var sigmaCal = 0.05 + st.noise * 0.055 + (60 / armN - 1) * 0.05;
    var cal = new Array(N);
    for (i = 0; i < N; i++) {
      var row = new Float64Array(armN);
      var e = deform[i] / 200;
      for (a = 0; a < armN; a++) {
        var th = a / armN * Math.PI * 2 + 0.08;
        var r = R0 * (1 + e * Math.cos(2 * (th - 0.7)));
        r += gauss(rnd) * sigmaCal;
        row[a] = Math.round(r * 100) / 100;
      }
      cal[i] = row;
    }

    // 超声成像：壁厚 + 局部腐蚀弧 + 穿孔白斑
    var sigmaImg = 0.06 + st.noise * 0.05;
    var img = new Array(N);
    for (i = 0; i < N; i++) {
      var wrow = new Float64Array(AZ);
      for (z = 0; z < AZ; z++) {
        var azDeg = z / AZ * 360;
        var loss = 0;
        if (wallLoss[i] > 0) {
          var dAz = Math.abs(((azDeg - CORR_AZ + 540) % 360) - 180);
          if (dAz < CORR_ARC / 2) loss = wallLoss[i] / 100 * WALL * (1 - 0.35 * Math.pow(dAz / (CORR_ARC / 2), 2));
        }
        var w = WALL - loss + gauss(rnd) * sigmaImg;
        wrow[z] = Math.max(0.3, w);
      }
      if (perfFlag[i]) {
        var pz = Math.round((8 + (i % 31) * 9) % AZ);
        for (q = -2; q <= 2; q++) wrow[(pz + q + AZ) % AZ] = Math.max(0.2, 1.1 + gauss(rnd) * 0.35);
      }
      img[i] = wrow;
    }

    // 曲线分支：逐深度最大/最小井径
    var maxR = new Float64Array(N), minR = new Float64Array(N), rawDeform = new Float64Array(N);
    for (i = 0; i < N; i++) {
      var mx = 0, mn = 1e9;
      for (a = 0; a < armN; a++) {
        var v = cal[i][a];
        if (v > mx) mx = v;
        if (v < mn) mn = v;
      }
      maxR[i] = mx; minR[i] = mn;
      // 角分辨率：用 8%—92% 分位代替极值，40 臂取样点偏离长短轴时系统性低估
      var sorted = Array.prototype.slice.call(cal[i]).sort(function (x, y) { return x - y; });
      var pLo = sorted[Math.max(0, Math.floor(armN * 0.08))];
      var pHi = sorted[Math.min(armN - 1, Math.ceil(armN * 0.92))];
      rawDeform[i] = (pHi - pLo) / R0 * 100;
    }
    var defMeas = smooth(rawDeform, 1);

    // 图像分支：腐蚀（平滑后最大壁厚减薄）与穿孔（原始最小壁厚）
    var lossMeas = new Float64Array(N), perfMeas = new Uint8Array(N);
    for (i = 0; i < N; i++) {
      var maxLoss = 0, rawMin = 1e9;
      for (z = 0; z < AZ; z++) {
        if (img[i][z] < rawMin) rawMin = img[i][z];
        var sum = 0, cnt = 0;
        for (var da = -2; da <= 2; da++) {
          sum += img[i][(z + da + AZ) % AZ]; cnt++;
        }
        var wv = sum / cnt;
        var lo = (WALL - wv) / WALL * 100;
        if (lo > maxLoss) maxLoss = lo;
      }
      lossMeas[i] = maxLoss;
      perfMeas[i] = rawMin < 2.0 ? 1 : 0;
    }

    // 决策级融合：曲线判变形、图像判腐蚀与穿孔
    var aiType = new Array(N), aiGrade = new Array(N), aiConf = new Float64Array(N);
    for (i = 0; i < N; i++) {
      var hasD = defMeas[i] >= st.deformTh;
      var dG = hasD ? (defMeas[i] >= 10 ? 3 : defMeas[i] >= 5 ? 2 : 1) : 0;
      var hasC = st.imgOn && lossMeas[i] >= 9;
      var cG = hasC ? (lossMeas[i] >= 28 ? 3 : lossMeas[i] >= 18 ? 2 : 1) : 0;
      var hasP = st.imgOn && perfMeas[i];

      var type = 'N', grade = 0, conf = 0.95;
      if (hasP) {
        type = 'P'; grade = 3; conf = 0.92;
      } else if (hasC && hasD) {
        type = cG >= dG ? 'C' : 'D';
        grade = Math.max(cG, dG);
        conf = 0.55;  // 两分支冲突，转人工
      } else if (hasC) {
        type = 'C'; grade = cG;
        conf = clamp(0.55 + (lossMeas[i] - 9) / 9 * 0.4 - st.noise * 0.03, 0.3, 0.98);
      } else if (hasD) {
        type = 'D'; grade = dG;
        conf = clamp(0.55 + (defMeas[i] - st.deformTh) / st.deformTh * 0.5 - st.noise * 0.04, 0.3, 0.99);
      }
      aiType[i] = type; aiGrade[i] = grade; aiConf[i] = conf;
    }

    return {
      truthType: truthType, truthGrade: truthGrade,
      deform: deform, wallLoss: wallLoss, perfFlag: perfFlag,
      cal: cal, img: img, maxR: maxR, minR: minR, defMeas: defMeas, lossMeas: lossMeas,
      aiType: aiType, aiGrade: aiGrade, aiConf: aiConf
    };
  }

  function computeMetrics(d) {
    var trueD = 0, hitD = 0, trueC = 0, hitC = 0, predC = 0, trueP = 0, hitP = 0;
    var damage = 0, miss = 0, union = 0, agree = 0;
    for (var i = 0; i < N; i++) {
      if (d.truthType[i] === 'D') { trueD++; if (d.aiType[i] === 'D') hitD++; }
      if (d.truthType[i] === 'C') { trueC++; }
      if (d.aiType[i] === 'C') { predC++; if (d.truthType[i] === 'C') hitC++; }
      if (d.truthType[i] === 'P') { trueP++; if (d.aiType[i] === 'P') hitP++; }
      if (d.truthType[i] !== 'N') { damage++; if (d.aiType[i] === 'N') miss++; }
      if (d.truthGrade[i] > 0 || d.aiGrade[i] > 0) {
        union++;
        if (d.truthGrade[i] === d.aiGrade[i]) agree++;
      }
    }
    return {
      recallD: trueD ? hitD / trueD * 100 : null,
      precC: predC ? hitC / predC * 100 : null,
      recallP: trueP ? hitP / trueP * 100 : null,
      agree: union ? agree / union * 100 : null,
      miss: damage ? miss / damage * 100 : null,
      trueC: trueC
    };
  }

  /* ================= 绘图 ================= */
  function drawWell(d, st) {
    var svg = document.getElementById('well');
    var W = 400, H = 200, padL = 42, padR = 12, padT = 14, padB = 16;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var cx = padL + plotW / 2, wellW = 30;

    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';

    // 真值色带
    var last = null, start = 0;
    for (var i = 0; i <= N; i++) {
      var t = i < N ? d.truthType[i] : null;
      if (t !== last) {
        if (last !== null && last !== 'N') {
          var y0 = padT + start / N * plotH;
          var y1 = padT + i / N * plotH;
          var fill = last === 'C' ? 'rgba(201,161,90,0.32)' : last === 'P' ? 'rgba(176,90,81,0.70)' : 'rgba(176,90,81,0.32)';
          s += '<rect x="' + (cx - wellW / 2) + '" y="' + y0 + '" width="' + wellW + '" height="' + Math.max(1, y1 - y0) + '" fill="' + fill + '"/>';
        }
        start = i; last = t;
      }
    }

    // 套管壁
    s += '<rect x="' + (cx - wellW / 2 - 3) + '" y="' + padT + '" width="3" height="' + plotH + '" fill="#8a8578"/>';
    s += '<rect x="' + (cx + wellW / 2) + '" y="' + padT + '" width="3" height="' + plotH + '" fill="#8a8578"/>';

    // 穿孔标记（左侧）
    for (var j = 0; j < N; j++) {
      if (d.perfFlag[j]) {
        var yy = padT + (j + 0.5) / N * plotH;
        s += '<circle cx="' + (cx - wellW / 2 - 10) + '" cy="' + yy + '" r="2.2" fill="#b05a51"/>';
      }
    }

    // 深度刻度
    for (var dep = 0; dep <= DEPTH; dep += 600) {
      var y = padT + dep / DEPTH * plotH;
      s += '<line x1="' + padL + '" y1="' + y + '" x2="' + (cx - wellW / 2 - 4) + '" y2="' + y + '" stroke="#e2ddd0"/>';
      s += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" font-size="8" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + dep + '</text>';
    }
    s += '<text x="' + (padL - 6) + '" y="' + (padT - 4) + '" font-size="8" fill="#9ba3a9" text-anchor="end">深度 m</text>';

    // 类型标注
    var labX = cx + wellW / 2 + 8;
    if (st.deform >= 2) {
      var dy = padT + (Math.round(st.deformPos / 100 * N) + Math.round(st.deformLen / 100 * N) / 2) / N * plotH;
      s += '<text x="' + labX + '" y="' + (dy - 2) + '" font-size="8.5" fill="#b05a51" font-family="monospace">变形 ' + st.deform.toFixed(1) + '%</text>';
    }
    if (st.corrLoss >= 10) {
      var cy = padT + (0.58 + 0.07) * plotH;
      s += '<text x="' + labX + '" y="' + cy + '" font-size="8.5" fill="#a97a1c" font-family="monospace">腐蚀 −' + st.corrLoss + '%</text>';
    }
    if (st.perfN > 0) {
      s += '<text x="' + labX + '" y="' + (padT + 0.9 * plotH) + '" font-size="8.5" fill="#8e3f37" font-family="monospace">穿孔 ' + st.perfN + ' 处</text>';
    }

    svg.innerHTML = s;
  }

  function drawCross(st) {
    var svg = document.getElementById('cross');
    var W = 400, H = 170, cx = W / 2, cy = H / 2;
    var R = 60;
    var e = st.deform / 100;

    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';
    // 井眼
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 7) + '" fill="none" stroke="#c9c3b4" stroke-width="1.2" stroke-dasharray="4 3"/>';

    // 套管椭圆（放大 4 倍显示椭圆化）
    if (e > 0.001) {
      s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (R * (1 + e * 2)) + '" ry="' + (R * (1 - e * 2)) + '" fill="none" stroke="#5a554a" stroke-width="2"/>';
    } else {
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#5a554a" stroke-width="2"/>';
    }

    // 腐蚀弧
    if (st.corrLoss >= 10) {
      var a0 = (CORR_AZ - CORR_ARC / 2) * Math.PI / 180;
      var a1 = (CORR_AZ + CORR_ARC / 2) * Math.PI / 180;
      var ar = R + 2;
      s += '<path d="M ' + (cx + ar * Math.cos(a0)) + ' ' + (cy + ar * Math.sin(a0)) +
        ' A ' + ar + ' ' + ar + ' 0 0 1 ' + (cx + ar * Math.cos(a1)) + ' ' + (cy + ar * Math.sin(a1)) +
        '" fill="none" stroke="#c9a15a" stroke-width="' + (2 + st.corrLoss * 0.16) + '" stroke-linecap="round"/>';
    }

    // 穿孔
    for (var k = 0; k < st.perfN; k++) {
      var ang = (120 + k * 37) * Math.PI / 180;
      s += '<circle cx="' + (cx + R * Math.cos(ang)) + '" cy="' + (cy + R * Math.sin(ang)) + '" r="3" fill="#b05a51"/>';
    }

    // 标签
    s += '<text x="' + cx + '" y="14" font-size="9" fill="#79828a" text-anchor="middle">横截面（椭圆化放大 4×）</text>';
    s += '<text x="18" y="' + (H - 10) + '" font-size="8.5" fill="#b05a51" font-family="monospace">变形 ' + st.deform.toFixed(1) + '%</text>';
    s += '<text x="150" y="' + (H - 10) + '" font-size="8.5" fill="#a97a1c" font-family="monospace">腐蚀 −' + st.corrLoss + '%</text>';
    s += '<text x="270" y="' + (H - 10) + '" font-size="8.5" fill="#8e3f37" font-family="monospace">穿孔 ' + st.perfN + ' 处</text>';

    svg.innerHTML = s;
  }

  function drawCaliper(d, st) {
    var canvas = document.getElementById('caliper');
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var padL = 34, padR = 10, padT = 12, padB = 20;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var RMIN = 65.5, RMAX = 74.5;

    ctx.fillStyle = '#fdfcf8';
    ctx.fillRect(0, 0, W, H);

    function xOf(r) { return padL + (clamp(r, RMIN, RMAX) - RMIN) / (RMAX - RMIN) * plotW; }
    function yOf(i) { return padT + i / (N - 1) * plotH; }

    // 网格
    ctx.strokeStyle = '#ece7d8';
    ctx.lineWidth = 1;
    for (var r = 66; r <= 74; r += 2) {
      var x = xOf(r);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.font = '7.5px ui-monospace, Consolas, monospace';
      ctx.fillText(String(r), x - 4, H - 8);
    }
    for (var dep = 0; dep <= DEPTH; dep += 500) {
      var y = padT + dep / DEPTH * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.fillText(String(dep), 4, y + 3);
    }

    // 公称半径
    ctx.strokeStyle = '#c9c3b4';
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(xOf(R0), padT); ctx.lineTo(xOf(R0), padT + plotH); ctx.stroke();
    ctx.setLineDash([]);

    // 全部臂曲线
    var armN = d.cal[0].length;
    ctx.strokeStyle = 'rgba(47,125,107,0.18)';
    ctx.lineWidth = 0.7;
    for (var a = 0; a < armN; a++) {
      ctx.beginPath();
      for (var i = 0; i < N; i++) {
        var px = xOf(d.cal[i][a]);
        var py = yOf(i);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 包络
    function envelope(key) {
      ctx.beginPath();
      for (var i = 0; i < N; i++) {
        var px = xOf(d[key][i]);
        var py = yOf(i);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#2f7d6b';
    ctx.lineWidth = 1.4;
    envelope('maxR');
    envelope('minR');

    // 变形标注
    if (st.deform >= 2) {
      var ds2 = Math.round(st.deformPos / 100 * N);
      var dl2 = Math.round(st.deformLen / 100 * N);
      var y0 = yOf(Math.min(N - 1, ds2));
      var y1 = yOf(Math.min(N - 1, ds2 + dl2));
      ctx.strokeStyle = '#b05a51';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(padL + plotW - 2, y0);
      ctx.lineTo(padL + plotW - 6, y0);
      ctx.lineTo(padL + plotW - 6, y1);
      ctx.lineTo(padL + plotW - 2, y1);
      ctx.stroke();
      ctx.fillStyle = '#b05a51';
      ctx.font = '8.5px ui-monospace, Consolas, monospace';
      ctx.fillText('变形 ' + st.deform.toFixed(1) + '%', padL + 4, (y0 + y1) / 2 + 3);
    }

    ctx.fillStyle = '#9ba3a9';
    ctx.font = '8px ui-monospace, Consolas, monospace';
    ctx.fillText('内径半径 mm', padL + plotW / 2 - 26, H - 1);
    ctx.fillText('深度 m', 3, padT - 2);
  }

  function drawImaging(d) {
    var canvas = document.getElementById('imaging');
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var COLS = 120, ROWS = 190;
    var imageData = ctx.createImageData(W, H);
    var px = imageData.data;

    for (var yy = 0; yy < H; yy++) {
      var di = Math.round(yy / (H - 1) * (N - 1));
      for (var xx = 0; xx < W; xx++) {
        var zi = Math.round(xx / (W - 1) * (AZ - 1)) % AZ;
        var wv = d.img[di][zi];
        var t = clamp((wv - 0.8) / 7.0, 0, 1);
        var cr, cg, cb;
        if (wv < 2.2) {
          cr = 248; cg = 246; cb = 240;
        } else {
          cr = 118 + t * 116;
          cg = 62 + t * 168;
          cb = 52 + t * 166;
        }
        var o = (yy * W + xx) * 4;
        px[o] = cr; px[o + 1] = cg; px[o + 2] = cb; px[o + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // 方位刻度
    ctx.fillStyle = 'rgba(253,252,248,0.82)';
    ctx.fillRect(0, 0, W, 12);
    ctx.fillStyle = '#4d565b';
    ctx.font = '8px ui-monospace, Consolas, monospace';
    [0, 90, 180, 270, 360].forEach(function (deg) {
      var x = deg / 360 * (W - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = '#4d565b';
      ctx.fillText(deg + '°', deg === 360 ? x - 12 : x + 1, 9);
    });

    // 深度刻度
    for (var dep = 0; dep <= DEPTH; dep += 600) {
      var y = dep / DEPTH * (H - 1);
      ctx.fillStyle = 'rgba(253,252,248,0.86)';
      ctx.fillRect(0, y - 5, 24, 10);
      ctx.fillStyle = '#5d666d';
      ctx.fillText(String(dep), 1, y + 3);
    }
    ctx.fillStyle = 'rgba(253,252,248,0.86)';
    ctx.fillRect(0, H - 10, 46, 10);
    ctx.fillStyle = '#5d666d';
    ctx.fillText('深度 m', 1, H - 2);
  }

  function drawMetrics(m) {
    function fmt(v) { return v === null ? '—' : v.toFixed(0) + '%'; }

    var dEl = document.getElementById('m-d');
    dEl.textContent = fmt(m.recallD);
    var dd = document.getElementById('m-d-wrap');
    dd.className = 'metric' + (m.recallD !== null && m.recallD < 85 ? ' warn' : '');

    var cEl = document.getElementById('m-c');
    cEl.textContent = fmt(m.precC);
    var cc = document.getElementById('m-c-wrap');
    cc.className = 'metric' + (m.precC !== null && m.precC < 80 ? ' warn' : '');

    var pEl = document.getElementById('m-p');
    pEl.textContent = fmt(m.recallP);
    pEl.parentElement.className = 'metric' + (m.recallP !== null && m.recallP < 90 ? ' warn' : '');

    var gEl = document.getElementById('m-g');
    gEl.textContent = fmt(m.agree);
    gEl.parentElement.className = 'metric' + (m.agree !== null && m.agree < 80 ? ' warn' : '');

    var meEl = document.getElementById('m-miss');
    meEl.textContent = fmt(m.miss);
    var meW = document.getElementById('m-miss-wrap');
    meW.className = 'metric' + (m.miss !== null && m.miss > 5 ? ' bad' : '');
  }

  function drawTable(d) {
    var tbody = document.getElementById('seg-body');
    var segs = [];
    var cur = null;
    for (var i = 0; i < N; i++) {
      var key = d.aiType[i] + d.aiGrade[i];
      if (!cur || cur.key !== key) {
        if (cur) { cur.end = i; segs.push(cur); }
        cur = { start: i, end: i + 1, key: key, type: d.aiType[i], grade: d.aiGrade[i], conf: d.aiConf[i] };
      } else {
        cur.end = i + 1;
        if (d.aiConf[i] > cur.conf) cur.conf = d.aiConf[i];
      }
    }
    if (cur) { cur.end = N; segs.push(cur); }

    var html = '';
    segs.forEach(function (seg, idx) {
      var mid = Math.floor((seg.start + seg.end - 1) / 2);
      var g = seg.grade > 0 ? String(seg.grade) : '—';
      var tg = d.truthGrade[mid] > 0 ? d.truthGrade[mid] : 0;
      var truth = TYPE_NAME[d.truthType[mid]] + (tg ? ' ' + tg : '');
      html += '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td class="mono">' + (seg.start * 10) + '–' + (seg.end * 10) + '</td>' +
        '<td class="mono">' + ((seg.end - seg.start) * 10) + '</td>' +
        '<td><span class="type ' + seg.type + '">' + TYPE_NAME[seg.type] + '</span></td>' +
        '<td class="mono">' + g + '</td>' +
        '<td><span class="type ' + d.truthType[mid] + '">' + truth + '</span></td>' +
        '<td class="mono">' + (seg.type === 'N' ? '—' : seg.conf.toFixed(2)) + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }

  /* ================= 对比面板 ================= */
  function compareMetrics(st) {
    var d = simulate(st);
    return computeMetrics(d);
  }

  function renderCompare() {
    var cur = compareMetrics(Object.assign({}, S, { imgOn: 0, arms: 40, noise: 1.5 }));
    var rec = compareMetrics(Object.assign({}, S, { imgOn: 1, arms: 60, noise: 0.4, deformTh: 2 }));

    function put(id, v) { document.getElementById(id).textContent = v === null ? '—' : v.toFixed(0) + '%'; }

    put('c-cur-d', cur.recallD);
    put('c-cur-p', cur.recallP);
    put('c-cur-g', cur.agree);
    put('c-cur-miss', cur.miss);
    put('c-rec-d', rec.recallD);
    put('c-rec-p', rec.recallP);
    put('c-rec-g', rec.agree);
    put('c-rec-miss', rec.miss);
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
    var m = computeMetrics(d);
    drawWell(d, S);
    drawCross(S);
    drawCaliper(d, S);
    drawImaging(d);
    drawMetrics(m);
    drawTable(d);
    renderCompare();
    var st = document.getElementById('img-state');
    if (st) st.textContent = S.imgOn ? '开启' : '关闭（腐蚀与穿孔不参与判定）';
  }

  function applyRecommended() {
    S.imgOn = 1; S.arms = 60; S.noise = 0.4; S.deformTh = 2;
    syncControls();
    run();
  }

  buildControls();
  run();

  document.getElementById('btn-apply-rec').addEventListener('click', applyRecommended);
  document.getElementById('btn-cur').addEventListener('click', renderCompare);
})();
