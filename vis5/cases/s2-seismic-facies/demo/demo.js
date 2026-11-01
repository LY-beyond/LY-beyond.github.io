/* ======= 地震相智能分类 · 可运行示范 =======
   合成深水扇地震剖面（Ricker 子波褶积）→ 逐道波形特征 → k-means 聚类 → 相带着色 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI：backing store 按 dpr 放大，绘制仍用逻辑坐标 */
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

  /* 确定性随机数：同一组参数得到同一张剖面，便于滑块对比 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- 参数 ---------- */
  var DEF = { k: 4, noise: 15, freq: 28, ntr: 128, win: 3, disp: 'va' };
  var S = Object.assign({}, DEF);

  var NS = 450;          // 每道采样点数
  var DT = 2;            // 采样间隔 ms
  var T_MS = (NS - 1) * DT;

  /* 真值相带：0 半深海泥 1 水道砂 2 朵叶砂 3 滑塌带 */
  var TRUE_NAME = ['半深海泥', '水道砂', '朵叶砂', '滑塌带'];
  var TRUE_COLOR = ['#2f7d6b', '#b05a51', '#c9a15a', '#41699b'];

  /* 地质模型：深水扇椭圆几何体（u: 0-1 横向, tn: 0-1 时间向） */
  function zoneAt(u, tn) {
    function inEll(cx, cy, rx, ry) {
      var dx = (u - cx) / rx, dy = (tn - cy) / ry;
      return dx * dx + dy * dy <= 1;
    }
    if (inEll(0.25, 0.68, 0.13, 0.10) || inEll(0.36, 0.75, 0.08, 0.07)) return 1;
    if (inEll(0.74, 0.52, 0.22, 0.14)) return 2;
    if (inEll(0.48, 0.22, 0.14, 0.11)) return 3;
    return 0;
  }

  /* ---------- 合成剖面 ---------- */
  function ricker(tSec, fHz) {
    var x = Math.PI * fHz * tSec;
    return (1 - 2 * x * x) * Math.exp(-x * x);
  }

  function buildModel(ntr, fHz, noisePct) {
    var rng = mulberry32(20261030);
    var NI = 15;
    var base = [], dip = [], undA = [], undL = [], undP = [];
    for (var k = 0; k < NI; k++) {
      base.push(90 + k * 55 + (rng() - 0.5) * 22);
      dip.push((rng() - 0.5) * 70);
      undA.push(5 + rng() * 9);
      undL.push(0.4 + rng() * 1.2);
      undP.push(rng());
    }
    var traces = new Array(ntr);
    var trueFac = new Array(ntr);
    var maxAbs = 1e-6;
    var M = Math.ceil(1500 / fHz / DT);   // 子波半长（采样点）
    for (var i = 0; i < ntr; i++) {
      var u = i / (ntr - 1);
      var tr = new Float32Array(NS);
      var cnt = [0, 0, 0, 0];
      for (var j = 0; j < NI; j++) {
        var t = base[j] + dip[j] * (u - 0.5) + undA[j] * Math.sin(2 * Math.PI * (undL[j] * u + undP[j]));
        var zone = zoneAt(u, t / T_MS);
        if (zone === 3) t += (rng() - 0.5) * 16;              // 滑塌带：反射面道间抖动
        var s0 = Math.round(t / DT);
        if (s0 < 1 || s0 >= NS - 1) continue;
        var mult = zone === 1 ? 1.9 : zone === 2 ? 1.55 : zone === 3 ? 0.55 : 0.85;
        var amp = (j % 2 ? -1 : 1) * mult * (0.7 + 0.6 * rng());
        for (var m = -M; m <= M; m++) {
          var s = s0 + m;
          if (s < 0 || s >= NS) continue;
          tr[s] += amp * ricker(m * DT / 1000, fHz);
        }
      }
      for (var q = 0; q < NS; q++) cnt[zoneAt(u, q / (NS - 1))]++;
      /* 真值相带：非背景相占比超过 10% 即标注（否则半深海泥恒占多数票） */
      var best = 0, bestCnt = 0;
      for (var z = 1; z < 4; z++) if (cnt[z] > bestCnt) { bestCnt = cnt[z]; best = z; }
      trueFac[i] = bestCnt > NS * 0.10 ? best : 0;
      /* 噪声（相对全局信号 RMS）在褶积后统一加 */
      traces[i] = tr;
    }
    var sumSq = 0, n = 0;
    for (var a = 0; a < ntr; a++) for (var b = 0; b < NS; b++) { sumSq += traces[a][b] * traces[a][b]; n++; }
    var sigRms = Math.sqrt(sumSq / n);
    var nrng = mulberry32(777);
    for (var c = 0; c < ntr; c++) {
      for (var d = 0; d < NS; d++) {
        traces[c][d] += gauss(nrng) * sigRms * (noisePct / 100) * 0.6;
        var v = Math.abs(traces[c][d]);
        if (v > maxAbs) maxAbs = v;
      }
    }
    return { traces: traces, trueFac: trueFac, maxAbs: maxAbs };
  }

  /* ---------- 波形特征 ---------- */
  function extractFeatures(traces, ntr, win) {
    var rms = new Array(ntr), freq = new Array(ntr), cont = new Array(ntr);
    var i, s;
    for (i = 0; i < ntr; i++) {
      var tr = traces[i];
      var ss = 0, zc = 0;
      for (s = 0; s < NS; s++) {
        ss += tr[s] * tr[s];
        if (s > 0 && ((tr[s - 1] < 0 && tr[s] >= 0) || (tr[s - 1] >= 0 && tr[s] < 0))) zc++;
      }
      rms[i] = Math.sqrt(ss / NS);
      freq[i] = zc / (2 * T_MS / 1000);   // Hz，由过零率估计
      /* 横向连续性：与左右邻道均值的最大归一化相关（时移 ±3 样点） */
      if (i === 0 || i === ntr - 1) { cont[i] = 0.5; continue; }
      var la = traces[i - 1], lb = traces[i + 1];
      var e0 = 0, e1 = 0;
      for (s = 0; s < NS; s++) {
        var av = (la[s] + lb[s]) / 2;
        e0 += tr[s] * tr[s]; e1 += av * av;
      }
      var bestC = 0;
      for (var lag = -3; lag <= 3; lag++) {
        var num = 0;
        for (s = 4; s < NS - 4; s++) {
          var a2 = (la[s + lag] + lb[s + lag]) / 2;
          num += tr[s] * a2;
        }
        var cc = num / Math.sqrt(e0 * e1 + 1e-12);
        if (cc > bestC) bestC = cc;
      }
      cont[i] = clamp(bestC, 0, 1);
    }
    /* 横向平滑（窗长 win，奇数） */
    function smooth(arr) {
      var h = (win - 1) / 2, out = new Array(ntr);
      for (var i2 = 0; i2 < ntr; i2++) {
        var acc = 0, nn = 0;
        for (var d = -h; d <= h; d++) {
          var j2 = i2 + d;
          if (j2 >= 0 && j2 < ntr) { acc += arr[j2]; nn++; }
        }
        out[i2] = acc / nn;
      }
      return out;
    }
    rms = smooth(rms); freq = smooth(freq); cont = smooth(cont);
    /* min-max 归一化 */
    function norm(arr) {
      var mn = Infinity, mx = -Infinity;
      arr.forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; });
      var sp = mx - mn || 1;
      return arr.map(function (v) { return (v - mn) / sp; });
    }
    return { rms: rms, freq: freq, cont: cont, rmsN: norm(rms), freqN: norm(freq), contN: norm(cont) };
  }

  /* ---------- k-means 聚类 ---------- */
  function kmeans(feat, ntr, K) {
    var rng = mulberry32(99);
    var cents = [];
    var used = {};
    var first = Math.floor(rng() * ntr);
    cents.push([feat.rmsN[first], feat.freqN[first], feat.contN[first]]);
    used[first] = true;
    while (cents.length < K) {   // k-means++
      var d2 = new Array(ntr), tot = 0;
      for (var i = 0; i < ntr; i++) {
        var best = Infinity;
        for (var c = 0; c < cents.length; c++) {
          var dx = feat.rmsN[i] - cents[c][0], dy = feat.freqN[i] - cents[c][1], dz = feat.contN[i] - cents[c][2];
          var dd = dx * dx + dy * dy + dz * dz;
          if (dd < best) best = dd;
        }
        d2[i] = best; tot += best;
      }
      var r = rng() * tot, pick = 0;
      for (var j = 0; j < ntr; j++) { r -= d2[j]; if (r <= 0) { pick = j; break; } pick = j; }
      cents.push([feat.rmsN[pick], feat.freqN[pick], feat.contN[pick]]);
    }
    var lab = new Array(ntr);
    for (var it = 0; it < 30; it++) {
      var moved = 0;
      for (var a = 0; a < ntr; a++) {
        var bi = 0, bd = Infinity;
        for (var b = 0; b < K; b++) {
          var ddx = feat.rmsN[a] - cents[b][0], ddy = feat.freqN[a] - cents[b][1], ddz = feat.contN[a] - cents[b][2];
          var ddd = ddx * ddx + ddy * ddy + ddz * ddz;
          if (ddd < bd) { bd = ddd; bi = b; }
        }
        if (lab[a] !== bi) { lab[a] = bi; moved++; }
      }
      var sum = [], cnt = [];
      for (var q = 0; q < K; q++) { sum.push([0, 0, 0]); cnt.push(0); }
      for (var w = 0; w < ntr; w++) {
        var L = lab[w];
        sum[L][0] += feat.rmsN[w]; sum[L][1] += feat.freqN[w]; sum[L][2] += feat.contN[w];
        cnt[L]++;
      }
      for (var e = 0; e < K; e++) {
        if (cnt[e] === 0) {   // 空类：重置到离现有质心最远的道
          var fi = 0, fd = -1;
          for (var g = 0; g < ntr; g++) {
            var mb = Infinity;
            for (var h = 0; h < K; h++) {
              if (cnt[h] === 0) continue;
              var ex = feat.rmsN[g] - cents[h][0], ey = feat.freqN[g] - cents[h][1], ez = feat.contN[g] - cents[h][2];
              var ed = ex * ex + ey * ey + ez * ez;
              if (ed < mb) mb = ed;
            }
            if (mb > fd) { fd = mb; fi = g; }
          }
          cents[e] = [feat.rmsN[fi], feat.freqN[fi], feat.contN[fi]];
        } else {
          cents[e] = [sum[e][0] / cnt[e], sum[e][1] / cnt[e], sum[e][2] / cnt[e]];
        }
      }
      if (moved === 0) break;
    }
    return { lab: lab, cents: cents, cnt: cnt };
  }

  /* 类命名：按质心 RMS 降序映射到相带字典 */
  var DICT = {
    2: [['高能砂质相', '#b05a51'], ['低能泥质相', '#2f7d6b']],
    3: [['水道砂', '#b05a51'], ['朵叶砂', '#c9a15a'], ['半深海泥', '#2f7d6b']],
    4: [['水道砂', '#b05a51'], ['朵叶砂', '#c9a15a'], ['半深海泥', '#2f7d6b'], ['滑塌带', '#41699b']],
    5: [['水道砂', '#b05a51'], ['朵叶砂', '#c9a15a'], ['过渡相', '#79828a'], ['半深海泥', '#2f7d6b'], ['滑塌带', '#41699b']]
  };

  function nameClusters(km, feat, K) {
    var order = [];
    for (var c = 0; c < K; c++) order.push(c);
    order.sort(function (a, b) { return km.cents[b][0] - km.cents[a][0]; });
    var names = new Array(K), colors = new Array(K);
    order.forEach(function (cl, rank) {
      names[cl] = DICT[K][rank][0];
      colors[cl] = DICT[K][rank][1];
    });
    return { names: names, colors: colors };
  }

  /* 逐道置信度 + 指标 */
  function confidence(km, feat, ntr, K) {
    var conf = new Array(ntr);
    for (var i = 0; i < ntr; i++) {
      var dOwn = Math.sqrt(
        Math.pow(feat.rmsN[i] - km.cents[km.lab[i]][0], 2) +
        Math.pow(feat.freqN[i] - km.cents[km.lab[i]][1], 2) +
        Math.pow(feat.contN[i] - km.cents[km.lab[i]][2], 2));
      var dOther = Infinity;
      for (var c = 0; c < K; c++) {
        if (c === km.lab[i]) continue;
        var d = Math.sqrt(
          Math.pow(feat.rmsN[i] - km.cents[c][0], 2) +
          Math.pow(feat.freqN[i] - km.cents[c][1], 2) +
          Math.pow(feat.contN[i] - km.cents[c][2], 2));
        if (d < dOther) dOther = d;
      }
      conf[i] = dOther === Infinity ? 1 : clamp((dOther - dOwn) / (dOther + dOwn + 1e-9), 0, 1);
    }
    return conf;
  }

  function separability(km, feat, ntr, K) {
    var mR = 0, mF = 0, mC = 0;
    for (var i = 0; i < ntr; i++) { mR += feat.rmsN[i]; mF += feat.freqN[i]; mC += feat.contN[i]; }
    mR /= ntr; mF /= ntr; mC /= ntr;
    var within = 0, between = 0;
    for (var c = 0; c < K; c++) {
      between += km.cnt[c] * (Math.pow(km.cents[c][0] - mR, 2) + Math.pow(km.cents[c][1] - mF, 2) + Math.pow(km.cents[c][2] - mC, 2));
    }
    for (var a = 0; a < ntr; a++) {
      var L = km.lab[a];
      within += Math.pow(feat.rmsN[a] - km.cents[L][0], 2) + Math.pow(feat.freqN[a] - km.cents[L][1], 2) + Math.pow(feat.contN[a] - km.cents[L][2], 2);
    }
    return between / (within + 1e-9);
  }

  /* 聚类 → 真值：按重叠数贪心配对，算逐道符合率 */
  function matchAccuracy(km, trueFac, ntr, K) {
    var overlap = [];
    for (var c = 0; c < K; c++) { overlap.push([0, 0, 0, 0]); }
    for (var i = 0; i < ntr; i++) overlap[km.lab[i]][trueFac[i]]++;
    var pairs = [];
    for (var a = 0; a < K; a++) for (var b = 0; b < 4; b++) pairs.push([overlap[a][b], a, b]);
    pairs.sort(function (x, y) { return y[0] - x[0]; });
    var usedC = {}, usedT = {}, hit = 0;
    pairs.forEach(function (p) {
      if (!usedC[p[1]] && !usedT[p[2]]) { usedC[p[1]] = true; usedT[p[2]] = true; hit += p[0]; }
    });
    return { acc: hit / ntr, map: usedC, overlap: overlap };
  }

  /* ---------- 全局状态缓存 ---------- */
  var M = null;   // {traces, trueFac, maxAbs, feat, km, conf, names, colors, metrics}

  /* 剖面绘图几何（seis / facies 共用，便于 hover 换算一致） */
  var SW = 880, SH = 240, SPL = 46, SPR = 10, SPT = 24, SPB = 20;
  var FW = 880, FH = 210, FPT = 14;

  function traceGeom(ntr) {
    var pw = SW - SPL - SPR;
    return { pw: pw, tw: pw / ntr };
  }

  /* ---------- 面板 ①：合成地震剖面 ---------- */
  function drawSeis() {
    var cv = $('cv-seis');
    var ctx = setupCanvas(cv, SW, SH);
    var ntr = S.ntr, g = traceGeom(ntr);
    var ph = SH - SPT - SPB;
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, SW, SH);

    /* 顶部真值相带条 */
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8a9298';
    ctx.fillText('真值', SPL - 6, 11);
    for (var i = 0; i < ntr; i++) {
      ctx.fillStyle = TRUE_COLOR[M.trueFac[i]];
      ctx.fillRect(SPL + i * g.tw, 4, Math.ceil(g.tw), 8);
    }
    ctx.strokeStyle = '#d8d0bc';
    ctx.lineWidth = 1;
    ctx.strokeRect(SPL, 4, g.pw, 8);

    var yOf = function (s) { return SPT + s / (NS - 1) * ph; };
    var xBase = function (i) { return SPL + (i + 0.5) * g.tw; };
    var gain = g.tw * 0.9 / M.maxAbs;

    if (S.disp === 'vd') {
      /* 变密度：ImageData 逐样点着色 */
      var off = document.createElement('canvas');
      off.width = ntr; off.height = NS;
      var octx = off.getContext('2d');
      var img = octx.createImageData(ntr, NS);
      for (var s2 = 0; s2 < NS; s2++) {
        for (var i2 = 0; i2 < ntr; i2++) {
          var v = M.traces[i2][s2] / M.maxAbs;
          var k = (s2 * ntr + i2) * 4;
          if (v >= 0) {   // 正振幅 → 深墨
            img.data[k] = 253 - 222 * v; img.data[k + 1] = 252 - 207 * v; img.data[k + 2] = 249 - 198 * v;
          } else {        // 负振幅 → 灰蓝
            var u = -v;
            img.data[k] = 253 - 119 * u; img.data[k + 1] = 252 - 86 * u; img.data[k + 2] = 249 - 65 * u;
          }
          img.data[k + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, ntr, NS, SPL, SPT, g.pw, ph);
    } else {
      /* 波形 + 变面积 */
      ctx.strokeStyle = '#3a4145';
      ctx.lineWidth = 0.5;
      ctx.fillStyle = '#242b2e';
      for (var t = 0; t < ntr; t++) {
        var tr = M.traces[t];
        var x0 = xBase(t);
        ctx.beginPath();
        for (var s3 = 0; s3 < NS; s3 += 2) {
          var x = x0 + tr[s3] * gain, y = yOf(s3);
          if (s3 === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        /* 正振幅充填 */
        ctx.beginPath();
        var started = false, lastY = yOf(0);
        for (var s4 = 0; s4 < NS; s4 += 2) {
          var a = tr[s4], y2 = yOf(s4);
          if (a > 0) {
            if (!started) { ctx.moveTo(x0, y2); started = true; }
            ctx.lineTo(x0 + a * gain, y2);
          } else if (started) {
            ctx.lineTo(x0, y2); ctx.closePath(); ctx.fill();
            ctx.beginPath(); started = false;
          }
          lastY = y2;
        }
        if (started) { ctx.lineTo(x0, lastY); ctx.closePath(); ctx.fill(); }
      }
    }

    /* 坐标轴 */
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(SPL, SPT, g.pw, ph);
    ctx.fillStyle = '#8a9298';
    ctx.font = '9px Consolas, monospace';
    for (var tm = 0; tm <= T_MS; tm += 150) {
      var yy = SPT + tm / T_MS * ph;
      ctx.strokeStyle = tm ? '#efece1' : '#cfc7b6';
      ctx.beginPath(); ctx.moveTo(SPL, yy); ctx.lineTo(SPL + g.pw, yy); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(tm, SPL - 5, yy + 3);
    }
    ctx.textAlign = 'center';
    var step = ntr > 128 ? 32 : 16;
    for (var cdp = 0; cdp < ntr; cdp += step) {
      ctx.fillText(cdp + 1, SPL + (cdp + 0.5) * g.tw, SH - 7);
    }
    /* 轴名 */
    ctx.textAlign = 'end';
    ctx.fillStyle = '#5d666d';
    ctx.font = '10px sans-serif';
    ctx.fillText('道号', SPL + g.pw, SPT - 6);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a9298';
    ctx.font = '9px Consolas, monospace';
    ctx.fillText('ms', 4, SPT - 2);
  }

  /* ---------- 面板 ③：聚类相带剖面 ---------- */
  function drawFacies() {
    var cv = $('cv-fac');
    var ctx = setupCanvas(cv, FW, FH);
    var ntr = S.ntr, g = traceGeom(ntr);
    var ph = FH - FPT - SPB;
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, FW, FH);

    for (var i = 0; i < ntr; i++) {
      var cl = M.km.lab[i];
      ctx.globalAlpha = 0.45 + 0.45 * M.conf[i];   // 置信度 → 色块浓淡
      ctx.fillStyle = M.colors[cl];
      ctx.fillRect(SPL + i * g.tw, FPT, Math.ceil(g.tw), ph);
    }
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#1f2d33';
    ctx.lineWidth = 0.5;
    var gain = g.tw * 0.9 / M.maxAbs;
    for (var t = 0; t < ntr; t++) {
      var tr = M.traces[t];
      var x0 = SPL + (t + 0.5) * g.tw;
      ctx.beginPath();
      for (var s = 0; s < NS; s += 3) {
        var x = x0 + tr[s] * gain, y = FPT + s / (NS - 1) * ph;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(SPL, FPT, g.pw, ph);
    ctx.fillStyle = '#8a9298';
    ctx.font = '9px Consolas, monospace';
    for (var tm = 0; tm <= T_MS; tm += 150) {
      var yy = FPT + tm / T_MS * ph;
      ctx.textAlign = 'right';
      ctx.fillText(tm, SPL - 5, yy + 3);
    }
    ctx.textAlign = 'center';
    var step = ntr > 128 ? 32 : 16;
    for (var cdp = 0; cdp < ntr; cdp += step) {
      ctx.fillText(cdp + 1, SPL + (cdp + 0.5) * g.tw, FH - 7);
    }
    ctx.textAlign = 'left';
    ctx.fillText('ms', 4, FPT - 2);

    /* 图例：按字典顺序输出 */
    var lg = $('fac-legend');
    var html = '';
    var printed = {};
    for (var r = 0; r < S.k; r++) {
      var nm = DICT[S.k][r][0], col = DICT[S.k][r][1];
      if (printed[nm]) continue;
      printed[nm] = true;
      html += '<span><i class="chip" style="background:' + col + '"></i>' + nm + '</span>';
    }
    html += '<span style="color:#79828a">色块浓淡 = 逐道置信度</span>';
    lg.innerHTML = html;
  }

  /* ---------- 面板 ②a：特征散点 ---------- */
  var SCW = 430, SCH = 228, SCPL = 42, SCPR = 12, SCPT = 12, SCPB = 30;
  function drawScatter() {
    var cv = $('cv-scat');
    var ctx = setupCanvas(cv, SCW, SCH);
    var pw = SCW - SCPL - SCPR, ph = SCH - SCPT - SCPB;
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, SCW, SCH);
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(SCPL, SCPT, pw, ph);
    ctx.font = '9px Consolas, monospace';
    ctx.fillStyle = '#8a9298';
    for (var g = 0; g <= 4; g++) {
      var v = g / 4;
      var x = SCPL + v * pw, y = SCPT + ph - v * ph;
      ctx.strokeStyle = g ? '#efece1' : '#cfc7b6';
      ctx.beginPath(); ctx.moveTo(x, SCPT); ctx.lineTo(x, SCPT + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(SCPL, y); ctx.lineTo(SCPL + pw, y); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(v.toFixed(2), x, SCPT + ph + 12);
      ctx.textAlign = 'right'; ctx.fillText(v.toFixed(2), SCPL - 5, y + 3);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5d666d';
    ctx.font = '10px sans-serif';
    ctx.fillText('RMS 振幅（归一化）', SCPL + pw / 2, SCH - 3);
    ctx.save();
    ctx.translate(10, SCPT + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('主频（归一化）', 0, 0);
    ctx.restore();

    var ntr = S.ntr;
    for (var i = 0; i < ntr; i++) {
      var px = SCPL + M.feat.rmsN[i] * pw;
      var py = SCPT + ph - M.feat.freqN[i] * ph;
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = M.colors[M.km.lab[i]];
      ctx.globalAlpha = 0.8;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* 质心 */
    for (var c = 0; c < S.k; c++) {
      var cx = SCPL + M.km.cents[c][0] * pw;
      var cy = SCPT + ph - M.km.cents[c][1] * ph;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = M.colors[c];
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#242b2e';
      ctx.fill();
    }
  }

  /* ---------- 面板 ②b：占比对比 ---------- */
  function drawProp() {
    var svg = $('sv-prop');
    var W = 430, H = 228, pl = 64, pr = 44, pt = 26, pb = 26;
    var pw = W - pl - pr;
    var K = S.k, ntr = S.ntr;
    /* 类占比 */
    var propC = new Array(K).fill(0);
    for (var i = 0; i < ntr; i++) propC[M.km.lab[i]]++;
    /* 真值占比 */
    var propT = [0, 0, 0, 0];
    for (var j = 0; j < ntr; j++) propT[M.trueFac[j]]++;
    /* 类 → 真值配对名 */
    var pairTrue = new Array(K).fill(-1);
    var ov = M.match.overlap;
    var pairs = [];
    for (var a = 0; a < K; a++) for (var b = 0; b < 4; b++) pairs.push([ov[a][b], a, b]);
    pairs.sort(function (x, y) { return y[0] - x[0]; });
    var uC = {}, uT = {};
    pairs.forEach(function (p) {
      if (!uC[p[1]] && !uT[p[2]]) { uC[p[1]] = true; uT[p[2]] = true; pairTrue[p[1]] = p[2]; }
    });
    /* 类按字典 rank 排序展示 */
    var rows = [];
    for (var r = 0; r < K; r++) {
      for (var c = 0; c < K; c++) {
        if (M.names[c] === DICT[K][r][0]) rows.push(c);
      }
    }
    var rowH = (H - pt - pb) / rows.length;
    var xMax = 1.0;
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var x = pl + v * pw;
      s += '<line x1="' + x + '" y1="' + pt + '" x2="' + x + '" y2="' + (H - pb) + '" stroke="' + (v ? '#efece1' : '#cfc7b6') + '"/>';
      s += '<text x="' + x + '" y="' + (H - pb + 13) + '" font-size="8.5" fill="#8a9298" text-anchor="middle" font-family="monospace">' + Math.round(v * 100) + '%</text>';
    });
    rows.forEach(function (c, ri) {
      var y0 = pt + ri * rowH;
      var bh = Math.min(11, rowH * 0.3);
      var pc = propC[c] / ntr;
      var tf = pairTrue[c];
      var ptv = tf >= 0 ? propT[tf] / ntr : 0;
      s += '<text x="' + (pl - 6) + '" y="' + (y0 + rowH / 2 + 3) + '" font-size="9" fill="#4d565b" text-anchor="end">' + M.names[c] + '</text>';
      /* 聚类占比条 */
      s += '<rect x="' + pl + '" y="' + (y0 + rowH / 2 - bh - 1.5) + '" width="' + (pc / xMax * pw).toFixed(1) + '" height="' + bh + '" rx="2" fill="' + M.colors[c] + '" opacity="0.85"/>';
      s += '<text x="' + (pl + pc / xMax * pw + 4) + '" y="' + (y0 + rowH / 2 - bh / 2 + 1.5) + '" font-size="8.5" fill="#3d464b" font-family="monospace">' + (pc * 100).toFixed(0) + '%</text>';
      /* 真值占比条 */
      s += '<rect x="' + pl + '" y="' + (y0 + rowH / 2 + 1.5) + '" width="' + (ptv / xMax * pw).toFixed(1) + '" height="' + bh + '" rx="2" fill="#9ba3a9" opacity="0.7"/>';
      s += '<text x="' + (pl + ptv / xMax * pw + 4) + '" y="' + (y0 + rowH / 2 + bh / 2 + 3) + '" font-size="8.5" fill="#79828a" font-family="monospace">' + (tf >= 0 ? (ptv * 100).toFixed(0) + '% ≈' + TRUE_NAME[tf] : '—') + '</text>';
    });
    s += '<text x="' + pl + '" y="14" font-size="9" fill="#8a9298">彩色=聚类占比 · 灰色=配对真值占比（案例：半深海泥约占 71%）</text>';
    svg.innerHTML = s;
  }

  /* ---------- 面板 ④：典型道波形 ---------- */
  function drawWave() {
    var svg = $('sv-wave');
    var W = 880, H = 150, pt = 24, pb = 22;
    var K = S.k, ntr = S.ntr;
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';
    /* 找各类 medoid（特征空间距质心最近的道） */
    var panels = [];
    for (var r = 0; r < K; r++) {
      for (var c = 0; c < K; c++) if (M.names[c] === DICT[K][r][0]) panels.push(c);
    }
    var pw = (W - 20) / panels.length;
    panels.forEach(function (c, pi) {
      var bi = -1, bd = Infinity;
      for (var i = 0; i < ntr; i++) {
        if (M.km.lab[i] !== c) continue;
        var d = Math.pow(M.feat.rmsN[i] - M.km.cents[c][0], 2) + Math.pow(M.feat.freqN[i] - M.km.cents[c][1], 2) + Math.pow(M.feat.contN[i] - M.km.cents[c][2], 2);
        if (d < bd) { bd = d; bi = i; }
      }
      var x0 = 10 + pi * pw;
      s += '<rect x="' + x0 + '" y="' + (pt - 16) + '" width="' + (pw - 8) + '" height="' + (H - pt - pb + 16) + '" rx="5" fill="#faf8f2" stroke="#ece5d6"/>';
      s += '<rect x="' + (x0 + 6) + '" y="' + (pt - 10) + '" width="8" height="8" rx="2" fill="' + M.colors[c] + '"/>';
      s += '<text x="' + (x0 + 18) + '" y="' + (pt - 2) + '" font-size="9.5" fill="#235f51" font-weight="600">' + M.names[c] + '</text>';
      if (bi < 0) return;
      var tr = M.traces[bi];
      var cx = x0 + pw / 2 - 4;
      var ph = H - pt - pb;
      var gain = (pw * 0.32) / M.maxAbs;
      var dPath = '';
      for (var q = 0; q < NS; q += 3) {
        var x = cx + tr[q] * gain, y = pt + q / (NS - 1) * ph;
        dPath += (q === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      }
      s += '<line x1="' + cx + '" y1="' + pt + '" x2="' + cx + '" y2="' + (pt + ph) + '" stroke="#d8d0bc" stroke-width="0.8"/>';
      s += '<path d="' + dPath + '" fill="none" stroke="#242b2e" stroke-width="1.1"/>';
      s += '<text x="' + cx + '" y="' + (H - 8) + '" font-size="8.5" fill="#79828a" text-anchor="middle" font-family="monospace">CDP ' + (bi + 1) + ' · RMS ' + M.feat.rms[bi].toFixed(2) + ' · ' + M.feat.freq[bi].toFixed(0) + ' Hz</text>';
      if (pi === 0) {
        s += '<text x="' + (x0 + 6) + '" y="' + (pt + 8) + '" font-size="8" fill="#9ba3a9" font-family="monospace">0</text>';
        s += '<text x="' + (x0 + 6) + '" y="' + (pt + ph - 2) + '" font-size="8" fill="#9ba3a9" font-family="monospace">' + T_MS + '</text>';
      }
    });
    svg.innerHTML = s;
  }

  /* ---------- 面板 ⑤：指标 + 映射表 + 结论 ---------- */
  function renderMetrics() {
    var ntr = S.ntr;
    $('m-ntr').innerHTML = ntr + '<small> 道</small>';
    var sep = M.sep;
    $('m-sep').textContent = sep.toFixed(2);
    $('m-sep').parentNode.className = 'mcard' + (sep < 0.6 ? ' bad' : sep < 1.2 ? ' warn' : '');
    var hi = 0;
    for (var i = 0; i < ntr; i++) if (M.conf[i] >= 0.2) hi++;
    $('m-conf').innerHTML = (hi / ntr * 100).toFixed(0) + '<small> %</small>';
    $('m-conf').parentNode.className = 'mcard' + (hi / ntr < 0.55 ? ' warn' : '');
    var acc = M.match.acc;
    $('m-acc').innerHTML = (acc * 100).toFixed(0) + '<small> %</small>';
    $('m-acc').parentNode.className = 'mcard' + (acc < 0.5 ? ' bad' : acc < 0.72 ? ' warn' : '');
    var dom = 0;
    for (var c = 0; c < S.k; c++) if (M.km.cnt[c] > dom) dom = M.km.cnt[c];
    $('m-dom').innerHTML = (dom / ntr * 100).toFixed(0) + '<small> %</small>';

    /* 映射表 */
    var rows = [
      ['水道砂', '高振幅、中等连续、透镜状外形、底面侵蚀', '深水水道砂体充填', '首选储层，厚度大、连通好'],
      ['朵叶砂', '高振幅、连续席状、丘状外形', '朵叶（叶状体）砂', '重要储层，侧向稳定'],
      ['过渡相', '振幅与连续性居中、渐变边界', '水道-朵叶过渡 / 天然堤', '物性不均，需井标定'],
      ['半深海泥', '中低振幅、平行高连续', '半深海背景泥', '隔层 / 盖层'],
      ['滑塌带', '弱振幅、杂乱、低连续', '滑塌 / 碎屑流沉积', '封堵或非储层']
    ];
    var cur = {};
    for (var q = 0; q < S.k; q++) cur[M.names[q]] = true;
    var tb = document.querySelector('#map-table tbody');
    var html = '';
    rows.forEach(function (r) {
      var on = cur[r[0]];
      var col = '#79828a';
      DICT[5].concat(DICT[4], DICT[3], DICT[2]).forEach(function (d) { if (d[0] === r[0]) col = d[1]; });
      html += '<tr class="' + (on ? '' : 'off') + '"><td><span class="sw" style="background:' + col + '"></span>' + r[0] +
        (on ? '' : '（未分出）') + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
    });
    tb.innerHTML = html;

    /* 结论 */
    var v = $('verdict');
    var head = 'K=<b>' + S.k + '</b> · 噪声 <b>' + S.noise + '%</b> · 分离度 <b>' + sep.toFixed(2) + '</b> · 符合率 <b>' + (acc * 100).toFixed(0) + '%</b>；';
    if (S.noise >= 40) {
      v.className = 'verdict bad';
      v.innerHTML = head + '噪声 ≥40% 已淹没波形差异，低置信道显著增多——对应案例中熵 >0.6 的低置信区扩大，需先提高信噪比或加大平滑窗。';
    } else if (S.k < 4) {
      v.className = 'verdict warn';
      v.innerHTML = head + '分类数小于相带字典（4 类），部分相被合并（见映射表灰行）。这正是不统一定义字典就开训的后果：模型学不到约定之外的相。';
    } else if (acc >= 0.72) {
      v.className = 'verdict ok';
      v.innerHTML = head + '分类与真值吻合良好，达到案例留出井符合率 ≥75% 附近的水平。可尝试提高噪声或减小平滑窗，观察窄水道边界先被抹平。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = head + '分类中等。可尝试：加大平滑窗增强横向一致性，或提高子波主频改善垂向分辨率，或降低噪声。';
    }
  }

  /* ---------- hover tooltip ---------- */
  function bindSeisHover() {
    var box = $('box-seis'), cv = $('cv-seis'), tip = $('tip-seis');
    cv.addEventListener('mousemove', function (evt) {
      var rc = cv.getBoundingClientRect();
      var lx = (evt.clientX - rc.left) * (SW / rc.width);
      var ly = (evt.clientY - rc.top) * (SH / rc.height);
      var g = traceGeom(S.ntr);
      var i = Math.floor((lx - SPL) / g.tw);
      if (i < 0 || i >= S.ntr || ly < SPT || ly > SH - SPB) { tip.style.display = 'none'; return; }
      var tms = (ly - SPT) / (SH - SPT - SPB) * T_MS;
      var si = clamp(Math.round(tms / DT), 0, NS - 1);
      tip.innerHTML = '<b>CDP ' + (i + 1) + '</b> · t=' + tms.toFixed(0) + ' ms<br>振幅 <b>' + M.traces[i][si].toFixed(2) + '</b> · 真值 <b>' + TRUE_NAME[M.trueFac[i]] + '</b>';
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 6, 4, rb.height - 64) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function bindFacHover() {
    var box = $('box-fac'), cv = $('cv-fac'), tip = $('tip-fac');
    cv.addEventListener('mousemove', function (evt) {
      var rc = cv.getBoundingClientRect();
      var lx = (evt.clientX - rc.left) * (FW / rc.width);
      var g = traceGeom(S.ntr);
      var i = Math.floor((lx - SPL) / g.tw);
      if (i < 0 || i >= S.ntr) { tip.style.display = 'none'; return; }
      var cl = M.km.lab[i];
      tip.innerHTML = '<b>CDP ' + (i + 1) + '</b> · 类别 <b>' + M.names[cl] + '</b><br>置信度 <b>' + M.conf[i].toFixed(2) + '</b> · 真值 ' + TRUE_NAME[M.trueFac[i]];
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 6, 4, rb.height - 64) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function bindScatHover() {
    var box = $('box-scat'), cv = $('cv-scat'), tip = $('tip-scat');
    cv.addEventListener('mousemove', function (evt) {
      var rc = cv.getBoundingClientRect();
      var lx = (evt.clientX - rc.left) * (SCW / rc.width);
      var ly = (evt.clientY - rc.top) * (SCH / rc.height);
      var pw = SCW - SCPL - SCPR, ph = SCH - SCPT - SCPB;
      var bi = -1, bd = 100;   // 10px 捕捉半径
      for (var i = 0; i < S.ntr; i++) {
        var px = SCPL + M.feat.rmsN[i] * pw;
        var py = SCPT + ph - M.feat.freqN[i] * ph;
        var d = (px - lx) * (px - lx) + (py - ly) * (py - ly);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0) { tip.style.display = 'none'; return; }
      tip.innerHTML = '<b>CDP ' + (bi + 1) + '</b> · ' + M.names[M.km.lab[bi]] + '<br>RMS <b>' + M.feat.rms[bi].toFixed(2) + '</b> · 主频 <b>' + M.feat.freq[bi].toFixed(0) + ' Hz</b> · 连续性 <b>' + M.feat.cont[bi].toFixed(2) + '</b>';
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 6, 4, rb.height - 76) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    var model = buildModel(S.ntr, S.freq, S.noise);
    var feat = extractFeatures(model.traces, S.ntr, S.win);
    var km = kmeans(feat, S.ntr, S.k);
    var nc = nameClusters(km, feat, S.k);
    var conf = confidence(km, feat, S.ntr, S.k);
    var match = matchAccuracy(km, model.trueFac, S.ntr, S.k);
    M = {
      traces: model.traces, trueFac: model.trueFac, maxAbs: model.maxAbs,
      feat: feat, km: km, names: nc.names, colors: nc.colors,
      conf: conf, match: match, sep: separability(km, feat, S.ntr, S.k)
    };
    drawSeis();
    drawScatter();
    drawProp();
    drawFacies();
    drawWave();
    renderMetrics();
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    k: function (v) { return v; },
    noise: function (v) { return v + ' %'; },
    freq: function (v) { return v + ' Hz'; },
    ntr: function (v) { return v + ' 道'; },
    win: function (v) { return v + ' 道'; }
  };
  var KEYS = ['k', 'noise', 'freq', 'ntr', 'win'];

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('s-disp').addEventListener('change', function () {
      S.disp = this.value;
      drawSeis();
    });
    $('btn-reset').addEventListener('click', function () {
      KEYS.forEach(function (k) {
        $('s-' + k).value = DEF[k];
        $('o-' + k).textContent = OUT[k](DEF[k]);
        S[k] = DEF[k];
      });
      $('s-disp').value = DEF.disp;
      S.disp = DEF.disp;
      render();
    });
  }

  bind();
  bindSeisHover();
  bindFacHover();
  bindScatHover();
  render();

  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });
})();

/* ======= 页签切换 ======= */
(function () {
  'use strict';
  var tabs = document.querySelectorAll('.tab');
  var panes = document.querySelectorAll('.tabpane');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var id = this.getAttribute('data-tab');
      tabs.forEach(function (o) { o.classList.remove('active'); });
      this.classList.add('active');
      panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
    });
  });
})();
