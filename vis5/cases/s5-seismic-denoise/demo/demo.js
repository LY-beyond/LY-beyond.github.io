/* ======= 地震资料噪声智能压制 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* 可复现随机数 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* HiDPI 适配：backing store 按 dpr 放大，绘制仍用 CSS 逻辑坐标 */
  function setupCanvas(cv, lh) {
    var lw = cv.clientWidth || 320;
    cv.style.height = lh + 'px';
    var dpr = window.devicePixelRatio || 1;
    var bw = Math.max(1, Math.round(lw * dpr));
    var bh = Math.max(1, Math.round(lh * dpr));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lw, lh);
    return { ctx: ctx, lw: lw, lh: lh };
  }

  /* ---------- 合成参数 ---------- */
  var NX = 96, NT = 240, DT = 0.004, DX = 25;   /* 道数 / 采样点数 / 采样间隔 s / 道距 m */
  var TMAX = NT * DT;                             /* 0.96 s */
  var F0 = 28;                                    /* 主频 Hz */

  var DEF = { noise: 0.28, roll: 1.2, dip: 1.2, seed: 7 };
  var S = Object.assign({}, DEF);
  var METHOD = 'nlm';
  var METHOD_NAME = { mean: '均值滤波', fx: 'f-x 预测滤波', nlm: 'DnCNN 式' };

  var D = null;        /* 全部数据场 */
  var specCache = {};  /* 各方法振幅谱缓存 */

  /* ---------- 正演：干净信号 ---------- */
  function ricker(f, t) {
    var u = Math.PI * f * t;
    return (1 - 2 * u * u) * Math.exp(-u * u);
  }

  /* 4 条同相轴：t0 s、dipK（相对滑块倾角的比例）、amp；第 4 条为深部弱反射 */
  var EVENTS = [
    { t: 0.12, k: 1.00, a: 1.00 },
    { t: 0.30, k: 0.55, a: -0.72 },
    { t: 0.50, k: 1.20, a: 0.55 },
    { t: 0.80, k: 0.40, a: 0.40 }
  ];

  function eventTime(e, x, dipS) { return e.t + e.k * dipS * x; }

  function genClean(dipS) {
    var d = new Float32Array(NX * NT);
    var hw = Math.ceil(2.4 / (Math.PI * F0) / DT);
    var x, it, e, te, i0, i1, amp;
    function inject(te, amp) {
      i0 = Math.max(0, Math.floor(te / DT) - hw);
      i1 = Math.min(NT - 1, Math.ceil(te / DT) + hw);
      for (it = i0; it <= i1; it++) {
        d[x * NT + it] += amp * ricker(F0, it * DT - te);
      }
    }
    for (x = 0; x < NX; x++) {
      var avo = 1 + 0.25 * (x / (NX - 1));   /* 随偏移距缓变的振幅（AVO 式） */
      for (e = 0; e < EVENTS.length; e++) {
        inject(eventTime(EVENTS[e], x, dipS), EVENTS[e].a * avo);
      }
      /* 多次波：前两条轴按 2 倍时间、反极性重演 */
      for (e = 0; e < 2; e++) {
        te = 2 * eventTime(EVENTS[e], x, dipS);
        if (te < TMAX - 0.05) inject(te, -0.30 * EVENTS[e].a * avo);
      }
    }
    return d;
  }

  /* ---------- 噪声场 ---------- */
  function genNoise(rnd) {
    var roll = new Float32Array(NX * NT);
    var hum = new Float32Array(NX * NT);
    var rand = new Float32Array(NX * NT);
    var comps = [
      { v: 300, f: 9, a: 1.0 },
      { v: 380, f: 12, a: 0.7 },
      { v: 480, f: 10, a: 0.5 }
    ];
    var x, it, c, t0, tt;
    for (x = 0; x < NX; x++) {
      var lat = clamp(x / 10, 0.15, 1);   /* 近道渐强 */
      for (c = 0; c < comps.length; c++) {
        t0 = 0.05 + (x * DX) / comps[c].v;
        if (t0 > TMAX) continue;
        for (it = 0; it < NT; it++) {
          tt = it * DT - t0;
          if (tt < -0.12 || tt > 0.25) continue;
          roll[x * NT + it] += comps[c].a * lat * Math.exp(-Math.max(0, it * DT) / 0.45) * ricker(comps[c].f, tt);
        }
      }
    }
    for (x = 0; x < NX; x++) {
      for (it = 0; it < NT; it++) {
        hum[x * NT + it] = 0.12 * Math.sin(2 * Math.PI * 50 * it * DT);  /* 50 Hz 工业干扰 */
      }
    }
    /* 高斯随机噪声（Box-Muller） */
    var spare = null;
    for (var i = 0; i < NX * NT; i++) {
      var g;
      if (spare !== null) { g = spare; spare = null; }
      else {
        var u = 0, v = 0;
        while (u === 0) u = rnd();
        v = rnd();
        var r = Math.sqrt(-2 * Math.log(u));
        g = r * Math.cos(2 * Math.PI * v);
        spare = r * Math.sin(2 * Math.PI * v);
      }
      rand[i] = g;
    }
    return { roll: roll, hum: hum, rand: rand };
  }

  /* ---------- 去噪器 ---------- */

  /* 5 道 × 5 采样点滑动平均 */
  function meanFilter(d) {
    var out = new Float32Array(NX * NT);
    var x, it, dx, dt, xx, tt, s, n;
    for (x = 0; x < NX; x++) {
      for (it = 0; it < NT; it++) {
        s = 0; n = 0;
        for (dx = -2; dx <= 2; dx++) {
          xx = x + dx; if (xx < 0 || xx >= NX) continue;
          for (dt = -2; dt <= 2; dt++) {
            tt = it + dt; if (tt < 0 || tt >= NT) continue;
            s += d[xx * NT + tt]; n++;
          }
        }
        out[x * NT + it] = s / n;
      }
    }
    return out;
  }

  /* f-x 预测滤波近似：逐点扫描倾角（semblance 最大），沿最优倾角叠加平均 */
  function fxFilter(d) {
    var out = new Float32Array(NX * NT);
    var dips = [];
    var p;
    for (p = -4; p <= 4; p += 0.5) dips.push(p);   /* 采样点/道 */
    var HALF = 3;                                   /* ±3 道 */
    var x, it, k, xx, tt;
    for (x = 0; x < NX; x++) {
      for (it = 0; it < NT; it++) {
        var bestScore = -1, bestSum = 0, bestN = 1;
        for (var di = 0; di < dips.length; di++) {
          var s = 0, s2 = 0, n = 0;
          for (k = -HALF; k <= HALF; k++) {
            xx = x + k; if (xx < 0 || xx >= NX) continue;
            tt = it + Math.round(dips[di] * k);
            if (tt < 0) tt = 0; if (tt >= NT) tt = NT - 1;
            var v = d[xx * NT + tt];
            s += v; s2 += v * v; n++;
          }
          var score = (s * s) / (n * (s2 + 1e-9));
          if (score > bestScore) { bestScore = score; bestSum = s; bestN = n; }
        }
        out[x * NT + it] = bestSum / bestN;
      }
    }
    return out;
  }

  /* DnCNN 式代理：非局部均值（块匹配加权）。块距离在 pilot（预滤波结果）上计算，
     加权平均作用于含噪数据——比照残差学习「先估结构、再压噪声」的两步思想 */
  function nlmFilter(d, pilot, h) {
    var out = new Float32Array(NX * NT);
    var R = 3, PR = 1;                 /* 搜索半径 / 块半径 */
    var h2 = h * h;
    var x, it, dx, dy, px, py, xx, yy, qx, qy;
    var spat = [];
    for (dy = -R; dy <= R; dy++) for (dx = -R; dx <= R; dx++) {
      spat.push({ dx: dx, dy: dy, w: Math.exp(-(dx * dx + dy * dy) / 4.5) });
    }
    for (x = 0; x < NX; x++) {
      for (it = 0; it < NT; it++) {
        var ws = 0, vs = 0;
        for (var si = 0; si < spat.length; si++) {
          xx = x + spat[si].dx; yy = it + spat[si].dy;
          if (xx < 0 || xx >= NX || yy < 0 || yy >= NT) continue;
          var dist = 0, np = 0;
          for (px = -PR; px <= PR; px++) {
            qx = x + px; if (qx < 0 || qx >= NX) continue;
            var qx2 = xx + px; if (qx2 < 0 || qx2 >= NX) continue;
            for (py = -PR; py <= PR; py++) {
              qy = it + py; if (qy < 0 || qy >= NT) continue;
              var qy2 = yy + py; if (qy2 < 0 || qy2 >= NT) continue;
              var dv = pilot[qx * NT + qy] - pilot[qx2 * NT + qy2];
              dist += dv * dv; np++;
            }
          }
          var w = Math.exp(-(dist / Math.max(1, np)) / h2) * spat[si].w;
          ws += w; vs += w * d[xx * NT + yy];
        }
        out[x * NT + it] = vs / (ws + 1e-9);
      }
    }
    return out;
  }

  /* ---------- 指标 ---------- */
  function power(d) {
    var s = 0;
    for (var i = 0; i < d.length; i++) s += d[i] * d[i];
    return s / d.length;
  }

  function residual(a, b) {
    var r = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) r[i] = a[i] - b[i];
    return r;
  }

  /* 沿时间滑动平均（近似低通，分离 8–15 Hz 面波残余） */
  function lowpass(d, len) {
    var out = new Float32Array(d.length);
    var h = (len - 1) / 2, x, it, k, tt;
    for (x = 0; x < NX; x++) {
      var acc = 0;
      for (it = 0; it < NT; it++) {
        var add = it + h, sub = it - h - 1;
        if (add < NT) acc += d[x * NT + add];
        if (sub >= 0) acc -= d[x * NT + sub];
        var n = Math.min(NT - 1, it + h) - Math.max(0, it - h) + 1;
        out[x * NT + it] = acc / n;
      }
    }
    return out;
  }

  /* 指定同相轴时窗内的投影系数（≈1 表示信号被完整保留） */
  function projCoeff(clean, out, evIdx, dipS, halfWin) {
    var e = EVENTS[evIdx];
    var sc = 0, so = 0;
    for (var x = 0; x < NX; x++) {
      var te = eventTime(e, x, dipS);
      var i0 = Math.max(0, Math.round((te - halfWin) / DT));
      var i1 = Math.min(NT - 1, Math.round((te + halfWin) / DT));
      for (var it = i0; it <= i1; it++) {
        sc += clean[x * NT + it] * clean[x * NT + it];
        so += clean[x * NT + it] * out[x * NT + it];
      }
    }
    return so / (sc + 1e-12);
  }

  /* 面波扇锥区掩膜：t ≤ 0.05 + x·dx/300 + 0.15（最慢面波 + 子波尾巴） */
  function conePower(d) {
    var s = 0, n = 0;
    for (var x = 0; x < NX; x++) {
      var itMax = Math.min(NT - 1, Math.round((0.05 + (x * DX) / 300 + 0.15) / DT));
      for (var it = 0; it <= itMax; it++) { s += d[x * NT + it] * d[x * NT + it]; n++; }
    }
    return s / Math.max(1, n);
  }

  function evalMethod(out) {
    var res = residual(out, D.clean);
    var snrOut = 10 * Math.log10(power(D.clean) / (power(res) + 1e-12));
    /* 面波锥区内低频（≤~15 Hz）残余噪声能量占输入的比例 */
    var rollResid = conePower(lowpass(res, 13)) / (D.lbIn + 1e-12);
    var weak = projCoeff(D.clean, out, 3, D.dipS, 0.055);
    var avoErr = Math.abs(1 - projCoeff(D.clean, out, 0, D.dipS, 0.05)) * 100;
    return { snr: snrOut, rollResid: rollResid, weak: weak * 100, avoErr: avoErr };
  }

  /* ---------- 频谱（FFT） ---------- */
  function fft(re, im) {
    var n = re.length, i, j, len, tr, ti;
    for (i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { tr = re[i]; re[i] = re[j]; re[j] = tr; ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (i = 0; i < n; i += len) {
        var ur = 1, ui = 0;
        for (j = 0; j < half; j++) {
          var k = i + j, m = k + half;
          tr = re[m] * ur - im[m] * ui;
          ti = re[m] * ui + im[m] * ur;
          re[m] = re[k] - tr; im[m] = im[k] - ti;
          re[k] += tr; im[k] += ti;
          var t = ur * wr - ui * wi; ui = ur * wi + ui * wr; ur = t;
        }
      }
    }
  }

  var NF = 256;
  function avgSpectrum(d) {
    var acc = new Float64Array(NF / 2);
    var re = new Float64Array(NF), im = new Float64Array(NF);
    var win = new Float64Array(NT);
    for (var i = 0; i < NT; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (NT - 1));
    for (var x = 0; x < NX; x++) {
      for (i = 0; i < NF; i++) { re[i] = 0; im[i] = 0; }
      for (i = 0; i < NT; i++) re[i] = d[x * NT + i] * win[i];
      fft(re, im);
      for (i = 0; i < NF / 2; i++) acc[i] += Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    }
    for (i = 0; i < NF / 2; i++) acc[i] /= NX;
    return acc;
  }

  /* ---------- 图像渲染 ---------- */
  var off = document.createElement('canvas');
  off.width = NX; off.height = NT;
  var offCtx = off.getContext('2d');

  function toImage(data, vmax) {
    var img = offCtx.createImageData(NX, NT);
    var px = img.data;
    for (var x = 0; x < NX; x++) {
      for (var it = 0; it < NT; it++) {
        var v = clamp(data[x * NT + it] / vmax, -1, 1);
        var s = Math.pow(Math.abs(v), 0.65);
        var r, g, b;
        if (v >= 0) {           /* 正：白 → #b05a51 */
          r = 255 - (255 - 176) * s; g = 255 - (255 - 90) * s; b = 255 - (255 - 81) * s;
        } else {                /* 负：白 → #41699b */
          r = 255 - (255 - 65) * s; g = 255 - (255 - 105) * s; b = 255 - (255 - 155) * s;
        }
        var o = (it * NX + x) * 4;
        px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
      }
    }
    return img;
  }

  var M = { l: 34, r: 6, t: 6, b: 16 };

  function drawWig(cv, data, vmax) {
    var c = setupCanvas(cv, 240);
    var ctx = c.ctx;
    var pw = c.lw - M.l - M.r, ph = c.lh - M.t - M.b;
    offCtx.putImageData(toImage(data, vmax), 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, M.l, M.t, pw, ph);
    ctx.strokeStyle = '#ded8c8'; ctx.lineWidth = 1;
    ctx.strokeRect(M.l + 0.5, M.t + 0.5, pw - 1, ph - 1);
    /* 时间轴（左） */
    ctx.fillStyle = '#79828a'; ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var ts = 0; ts <= 0.81; ts += 0.2) {
      var y = M.t + (ts / TMAX) * ph;
      ctx.fillText(ts.toFixed(1), M.l - 4, y);
      ctx.strokeStyle = '#e6e0d2';
      ctx.beginPath(); ctx.moveTo(M.l - 2, y); ctx.lineTo(M.l, y); ctx.stroke();
    }
    ctx.save();
    ctx.translate(9, M.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('时间 s', 0, 0);
    ctx.restore();
    /* 道号轴（下） */
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var trs = [1, 25, 50, 75, 96];
    for (var i = 0; i < trs.length; i++) {
      var xx = M.l + ((trs[i] - 1) / (NX - 1)) * pw;
      ctx.fillText(String(trs[i]), xx, M.t + ph + 4);
    }
    ctx.textBaseline = 'alphabetic';
    return { pw: pw, ph: ph };
  }

  /* ---------- 频谱图 ---------- */
  var SPEC_FMAX = 80;
  var specGeom = null;
  function drawSpectrum() {
    var cv = $('cv-spec');
    var c = setupCanvas(cv, 240);
    var ctx = c.ctx;
    var m = { l: 38, r: 8, t: 13, b: 22 };
    var pw = c.lw - m.l - m.r, ph = c.lh - m.t - m.b;
    specGeom = { m: m, pw: pw, ph: ph, lh: c.lh };

    var noisyS = D.specNoisy, cleanS = D.specClean;
    var denS = specCache[METHOD] || (specCache[METHOD] = avgSpectrum(D[METHOD]));
    var kmax = Math.floor(SPEC_FMAX * NF * DT);
    var ymax = 0;
    for (var k = 0; k <= kmax; k++) ymax = Math.max(ymax, noisyS[k], cleanS[k]);
    ymax *= 1.08;

    /* 网格与坐标 */
    ctx.strokeStyle = '#e6e0d2'; ctx.fillStyle = '#79828a';
    ctx.font = '9px Consolas, monospace'; ctx.lineWidth = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var f, xx;
    for (f = 0; f <= SPEC_FMAX; f += 20) {
      xx = m.l + (f / SPEC_FMAX) * pw;
      ctx.beginPath(); ctx.moveTo(xx, m.t); ctx.lineTo(xx, m.t + ph); ctx.stroke();
      ctx.fillText(String(f), xx, m.t + ph + 4);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var gy = 0; gy <= 4; gy++) {
      var yy = m.t + ph - (gy / 4) * ph;
      ctx.fillText((ymax * gy / 4).toFixed(2), m.l - 4, yy);
      if (gy > 0) {
        ctx.beginPath(); ctx.moveTo(m.l, yy); ctx.lineTo(m.l + pw, yy); ctx.stroke();
      }
    }
    ctx.fillText('Hz', m.l + pw, m.t + ph + 14);
    ctx.save();
    ctx.translate(9, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('振幅', 0, 0);
    ctx.restore();

    /* 50 Hz 工业干扰标记 */
    xx = m.l + (50 / SPEC_FMAX) * pw;
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(xx, m.t); ctx.lineTo(xx, m.t + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('50Hz', xx + 3, m.t + 2);

    function plot(spec, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (var k = 0; k <= kmax; k++) {
        var x2 = m.l + (k / kmax) * pw;
        var y2 = m.t + ph - (spec[k] / ymax) * ph;
        if (k === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    plot(cleanS, '#2f7d6b');
    plot(noisyS, '#8a9298');
    plot(denS, '#c9a15a');
    specGeom.ymax = ymax; specGeom.kmax = kmax;
    specGeom.vals = { clean: cleanS, noisy: noisyS, den: denS };
  }

  /* ---------- 数据生成与全量更新 ---------- */
  function regen() {
    var dipS = S.dip / 1000;
    var rnd = mulberry32(S.seed * 7919 + 13);
    var clean = genClean(dipS);
    var nz = genNoise(rnd);
    var noisy = new Float32Array(NX * NT);
    var rollRaw = new Float32Array(NX * NT);
    var i;
    for (i = 0; i < NX * NT; i++) {
      rollRaw[i] = nz.roll[i] * S.roll * 0.85;
      noisy[i] = clean[i] + rollRaw[i] + nz.hum[i] + nz.rand[i] * S.noise;
    }
    var mean = meanFilter(noisy);
    var fx = fxFilter(noisy);
    /* DnCNN 式代理（两阶段）：f-x 结构估计作 pilot → NLM 精修 → 与结构支路加权融合（残差补偿） */
    var nlmRaw = nlmFilter(noisy, fx, Math.max(0.14, S.noise * 0.95 + 0.05 * S.roll));
    var nlm = new Float32Array(NX * NT);
    for (i = 0; i < NX * NT; i++) nlm[i] = 0.75 * nlmRaw[i] + 0.25 * fx[i];
    D = {
      clean: clean, noisy: noisy, rollRaw: rollRaw, dipS: dipS,
      mean: mean, fx: fx, nlm: nlm
    };
    /* 统一色标：含噪输入 98 分位 */
    var abs = [];
    for (i = 0; i < noisy.length; i += 7) abs.push(Math.abs(noisy[i]));
    abs.sort(function (a, b) { return a - b; });
    D.vmax = abs[Math.floor(abs.length * 0.98)] * 1.05 || 1;
    /* 输入 SNR 与输入低频噪声能量（面波残留口径的分母） */
    var noiseOnly = residual(noisy, clean);
    D.snrIn = 10 * Math.log10(power(clean) / (power(noiseOnly) + 1e-12));
    D.lbIn = conePower(lowpass(noiseOnly, 13));
    D.specClean = avgSpectrum(clean);
    D.specNoisy = avgSpectrum(noisy);
    D.metrics = { mean: evalMethod(D.mean), fx: evalMethod(D.fx), nlm: evalMethod(D.nlm) };
    specCache = {};
    drawAll();
  }

  function drawAll() {
    drawWig($('cv-noisy'), D.noisy, D.vmax);
    drawWig($('cv-mean'), D.mean, D.vmax);
    drawWig($('cv-fx'), D.fx, D.vmax);
    drawWig($('cv-nlm'), D.nlm, D.vmax);
    drawMethodViews();
  }

  /* 差值 + 频谱 + 指标（随当前方法刷新） */
  function drawMethodViews() {
    $('diff-title').textContent = '差值剖面 · ' + METHOD_NAME[METHOD];
    D.diff = residual(D.noisy, D[METHOD]);
    drawWig($('cv-diff'), D.diff, D.vmax * 0.6);
    drawSpectrum();
    updateMetrics();
    document.querySelectorAll('.cbox[data-m]').forEach(function (b) {
      b.classList.toggle('sel', b.getAttribute('data-m') === METHOD);
    });
    document.querySelectorAll('.mchip').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-m') === METHOD);
    });
  }

  function updateMetrics() {
    var mt = D.metrics[METHOD];
    $('m-snrin').innerHTML = D.snrIn.toFixed(1) + ' <small>dB</small>';
    $('m-gain').innerHTML = '+' + (mt.snr - D.snrIn).toFixed(1) + ' <small>dB</small>';
    $('m-roll').textContent = (mt.rollResid * 100).toFixed(1) + '%';
    $('m-weak').textContent = mt.weak.toFixed(0) + '%';
    $('m-avo').textContent = mt.avoErr.toFixed(1) + '%';

    var gain = mt.snr - D.snrIn;
    function card(id, ok, mid) {
      var el = $(id);
      el.classList.remove('warn', 'bad');
      if (!ok) el.classList.add(mid ? 'warn' : 'bad');
    }
    card('c-gain', gain >= 6, gain >= 3);
    card('c-roll', mt.rollResid <= 0.30, mt.rollResid <= 0.45);
    card('c-weak', mt.weak >= 80, mt.weak >= 70);
    card('c-avo', mt.avoErr <= 8, mt.avoErr <= 15);

    /* 三方法横向对比 + 判定 */
    var best = 'mean';
    ['fx', 'nlm'].forEach(function (k) {
      if (D.metrics[k].snr > D.metrics[best].snr) best = k;
    });
    var pass = (gain >= 6 ? 1 : 0) + (mt.rollResid <= 0.30 ? 1 : 0) +
      (mt.weak >= 80 ? 1 : 0) + (mt.avoErr <= 8 ? 1 : 0);
    var v = $('verdict');
    v.className = 'verdict ' + (pass === 4 ? 'ok' : pass >= 2 ? 'warn' : 'bad');
    v.innerHTML = '<b>' + METHOD_NAME[METHOD] + '</b>：SNR 提升 <b>' + gain.toFixed(1) + ' dB</b>（合格 ≥6）· ' +
      '面波残留 <b>' + (mt.rollResid * 100).toFixed(1) + '%</b>（≤30%）· ' +
      '弱反射保全 <b>' + mt.weak.toFixed(0) + '%</b>（≥80%）· ' +
      '振幅误差 <b>' + mt.avoErr.toFixed(1) + '%</b>（≤8%）。' +
      (pass === 4
        ? '四项全部达标；差值剖面中应看不到连续同相轴。'
        : '未全达标——压低噪声与保真信号存在权衡，可换方法或调参数对比。') +
      ' 当前噪声水平下 SNR 提升最高的是 <b>' + METHOD_NAME[best] + '</b>。' +
      (best !== METHOD
        ? '注意：' + METHOD_NAME[best] + '的 SNR 优势来自更强的整体平滑，其弱反射保全率与振幅保真往往更差——「干净」不等于「信号保住」，正是案例警示的验收陷阱。'
        : '');
  }

  /* ---------- 悬浮提示 ---------- */
  function bindWigTip(boxId, cvId, getData) {
    var box = $(boxId), cv = $(cvId), tip = box.querySelector('.chart-tip');
    cv.addEventListener('mousemove', function (e) {
      var rect = cv.getBoundingClientRect();
      var lw = rect.width, lh = 240;
      var lx = e.clientX - rect.left, ly = e.clientY - rect.top;
      var pw = lw - M.l - M.r, ph = lh - M.t - M.b;
      if (lx < M.l || lx > M.l + pw || ly < M.t || ly > M.t + ph) { tip.style.display = 'none'; return; }
      var x = clamp(Math.round(((lx - M.l) / pw) * (NX - 1)), 0, NX - 1);
      var it = clamp(Math.round(((ly - M.t) / ph) * (NT - 1)), 0, NT - 1);
      var v = getData()[x * NT + it];
      tip.innerHTML = '道 <b>' + (x + 1) + '</b> · 时间 <b>' + (it * DT).toFixed(3) + ' s</b><br>振幅 <b>' + v.toFixed(3) + '</b>';
      var brect = box.getBoundingClientRect();
      tip.style.left = (e.clientX - brect.left + 12) + 'px';
      tip.style.top = (e.clientY - brect.top + 10) + 'px';
      tip.style.display = 'block';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function bindSpecTip() {
    var box = $('box-spec'), cv = $('cv-spec'), tip = box.querySelector('.chart-tip');
    cv.addEventListener('mousemove', function (e) {
      if (!specGeom) return;
      var rect = cv.getBoundingClientRect();
      var lx = e.clientX - rect.left, ly = e.clientY - rect.top;
      var m = specGeom.m;
      if (lx < m.l || lx > m.l + specGeom.pw || ly < m.t || ly > m.t + specGeom.ph) { tip.style.display = 'none'; return; }
      var f = ((lx - m.l) / specGeom.pw) * SPEC_FMAX;
      var k = clamp(Math.round(f * NF * DT), 0, specGeom.kmax);
      tip.innerHTML = '频率 <b>' + (k / (NF * DT)).toFixed(1) + ' Hz</b><br>' +
        '干净 <b>' + specGeom.vals.clean[k].toFixed(3) + '</b> · ' +
        '含噪 <b>' + specGeom.vals.noisy[k].toFixed(3) + '</b><br>' +
        '去噪 <b>' + specGeom.vals.den[k].toFixed(3) + '</b>';
      var brect = box.getBoundingClientRect();
      tip.style.left = (e.clientX - brect.left + 12) + 'px';
      tip.style.top = (e.clientY - brect.top + 10) + 'px';
      tip.style.display = 'block';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 交互 ---------- */
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; regen(); });
  }

  function bindSlider(id, outId, key, fmt) {
    var el = $(id), out = $(outId);
    el.addEventListener('input', function () {
      S[key] = parseFloat(el.value);
      out.textContent = fmt(S[key]);
      schedule();
    });
  }

  function syncUI() {
    $('s-noise').value = S.noise; $('o-noise').textContent = S.noise.toFixed(2);
    $('s-roll').value = S.roll; $('o-roll').textContent = S.roll.toFixed(1);
    $('s-dip').value = S.dip; $('o-dip').textContent = S.dip.toFixed(1) + ' ms/道';
  }

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      document.querySelectorAll('.tabpane').forEach(function (p) {
        p.classList.toggle('active', p.id === 'pane-' + tab.getAttribute('data-tab'));
      });
    });
  });

  document.querySelectorAll('.mchip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      METHOD = chip.getAttribute('data-m');
      drawMethodViews();
    });
  });

  bindSlider('s-noise', 'o-noise', 'noise', function (v) { return v.toFixed(2); });
  bindSlider('s-roll', 'o-roll', 'roll', function (v) { return v.toFixed(1); });
  bindSlider('s-dip', 'o-dip', 'dip', function (v) { return v.toFixed(1) + ' ms/道'; });
  $('btn-seed').addEventListener('click', function () { S.seed = (S.seed * 1664525 + 1013904223) % 100000; schedule(); });
  $('btn-reset').addEventListener('click', function () {
    S = Object.assign({}, DEF);
    syncUI();
    schedule();
  });

  window.addEventListener('resize', function () {
    if (D) drawAll();
  });

  bindWigTip('box-noisy', 'cv-noisy', function () { return D.noisy; });
  bindWigTip('box-mean', 'cv-mean', function () { return D.mean; });
  bindWigTip('box-fx', 'cv-fx', function () { return D.fx; });
  bindWigTip('box-nlm', 'cv-nlm', function () { return D.nlm; });
  bindWigTip('box-diff', 'cv-diff', function () { return D.diff; });
  bindSpecTip();

  syncUI();
  regen();
})();
