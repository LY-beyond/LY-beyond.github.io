/* ======= 水泥石抗压强度预测 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  var PSI_TO_MPA = 0.00689476;
  var MPA_TO_PSI = 145.038;

  var DEF = {
    temp: 90, wc: 0.44, rho: 1.90, si: 0, ret: 0.30,
    pres: 0, cont: 0, target: 500, tmax: 72, cursor: 24
  };
  var S = Object.assign({}, DEF);

  // ===== 邻接环节参数联动（固井工作流共享，key=cementing-shared）=====
  var SHARED_KEY = 'cementing-shared';
  var KEY_MAP = {
    density: 'rho',
    wc: 'wc',
    silica: 'si',
    retarder: 'ret',
    bhst: 'temp'
  };
  var MY_KEYS = Object.keys(KEY_MAP);
  function loadShared() {
    try {
      var s = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}');
      var n = 0;
      MY_KEYS.forEach(function (k) {
        if (k in s && typeof s[k] === 'number') { S[KEY_MAP[k]] = s[k]; n++; }
      });
      return n;
    } catch (e) { return 0; }
  }
  function saveShared() {
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}'); } catch (e) {}
    MY_KEYS.forEach(function (k) {
      if (typeof S[KEY_MAP[k]] === 'number') cur[k] = S[KEY_MAP[k]];
    });
    localStorage.setItem(SHARED_KEY, JSON.stringify(cur));
  }
  function syncSlidersFromS() {
    KEYS.forEach(function (k) {
      var el = $('s-' + k);
      var out = $('o-' + k);
      if (el) el.value = S[k];
      if (out) out.textContent = OUT[k](S[k]);
    });
  }

  /* 高温强度倒缩风险 0–1：井底温度越高、硅粉越少，风险越大
     硅粉最多把风险削减约 80%，超高温（>110℃）即使加满 40% 仍有残余风险 */
  function retroRiskOf(temp, si) {
    var tRamp = clamp((temp - 90) / 90, 0, 1);
    var sRamp = clamp((30 - si) / 30, 0, 1);
    return clamp(tRamp * (0.2 + 0.8 * sRamp), 0, 1);
  }

  // 纯函数：给定状态计算 24h UCS 与高温倒缩风险（供帕累托候选复用）
  function computeMetrics(state) {
    var rho = state.rho, wc = state.wc, si = state.si, ret = state.ret;
    var temp = state.temp, pres = state.pres, cont = state.cont;
    var risk = retroRiskOf(temp, si);
    var ult = 38 * Math.pow(0.44 / wc, 1.2) * Math.pow(rho / 1.9, 0.8)
      * (1 - 0.003 * ret) * (1 - 0.025 * cont) * (1 + 0.004 * si)
      * (1 - 0.4 * risk);
    ult = Math.max(2, ult);
    var tf = 36 * Math.exp(-0.015 * (temp - 30)) * (1 + 1.5 * ret);
    var pf = 1 + 0.004 * pres;
    var ucs24 = ult * (1 - Math.exp(-Math.pow(24 / tf, 0.7))) * pf;
    return { ucs24: ucs24, retroRisk: risk };
  }

  /* ---------- 强度模型 ---------- */
  function retroRisk() {
    return retroRiskOf(S.temp, S.si);
  }

  function ucsUlt() {
    var base = 38 * Math.pow(0.44 / S.wc, 1.2) * Math.pow(S.rho / 1.9, 0.8)
      * (1 - 0.003 * S.ret) * (1 - 0.025 * S.cont) * (1 + 0.004 * S.si)
      * (1 - 0.4 * retroRisk());   /* 高温倒缩：温度越高、硅粉越少，折减越大 */
    return Math.max(2, base);
  }

  function isRetrogression() {
    return retroRisk() >= 0.5;
  }

  function tau() {
    return 36 * Math.exp(-0.015 * (S.temp - 30)) * (1 + 1.5 * S.ret);
  }

  function pressureFactor() {
    return 1 + 0.004 * S.pres;
  }

  function ucsAt(t) {
    var ult = ucsUlt();
    var tf = tau();
    var p = 0.7;
    return ult * (1 - Math.exp(-Math.pow(t / tf, p))) * pressureFactor();
  }

  /* 达到目标强度的时间 (h)，target 单位 psi */
  function wocTime(targetPsi) {
    var targetMPa = targetPsi * PSI_TO_MPA;
    var ult = ucsUlt() * pressureFactor();
    if (targetMPa >= ult) return null; /* 极限强度内无法达到 */
    var tf = tau();
    var ratio = clamp(targetMPa / (ucsUlt() * pressureFactor()), 0.001, 0.999);
    return tf * Math.pow(-Math.log(1 - ratio), 1 / 0.7);
  }

  /* ---------- 配色 ---------- */
  function strengthColor(ratio) {
    /* ratio: 0=弱 -> 1=强 */
    var r = clamp(ratio, 0, 1);
    var lo = [42, 52, 70];       /* 深蓝：强度低 */
    var mid = [47, 125, 107];    /* 主色绿 */
    var hi = [201, 161, 90];     /* 警示橙：强度高 */
    var c;
    if (r < 0.5) {
      var t = r / 0.5;
      c = [lo[0] + (mid[0] - lo[0]) * t, lo[1] + (mid[1] - lo[1]) * t, lo[2] + (mid[2] - lo[2]) * t];
    } else {
      var u = (r - 0.5) / 0.5;
      c = [mid[0] + (hi[0] - mid[0]) * u, mid[1] + (hi[1] - mid[1]) * u, mid[2] + (hi[2] - mid[2]) * u];
    }
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }

  /* ---------- 面板 1：强度-时间曲线 ---------- */
  function drawChart() {
    var svg = $('chart');
    var W = 430, H = 220, pl = 40, pr = 46, pt = 14, pb = 32;
    var pw = W - pl - pr, ph = H - pt - pb;
    var tmax = S.tmax;
    var ult = ucsUlt() * pressureFactor();
    var yMax = Math.max(25, Math.ceil(ult / 5) * 5 + 5);
    var yMaxPsi = yMax * MPA_TO_PSI;

    var x = function (t) { return pl + t / tmax * pw; };
    var y = function (mpa) { return pt + ph - mpa / yMax * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格 + 左轴 MPa */
    var mpaSteps = [];
    for (var v = 0; v <= yMax; v += 5) mpaSteps.push(v);
    mpaSteps.forEach(function (v) {
      s += '<line x1="' + pl + '" y1="' + y(v) + '" x2="' + (pl + pw) + '" y2="' + y(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v.toFixed(0) + '</text>';
    });
    /* 右轴 psi */
    mpaSteps.forEach(function (v) {
      var psi = v * MPA_TO_PSI;
      if (psi <= yMaxPsi) {
        s += '<text x="' + (pl + pw + 5) + '" y="' + (y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="start" font-family="monospace">' + psi.toFixed(0) + '</text>';
      }
    });
    /* 时间轴 */
    var tSteps = [];
    var tInt = tmax <= 48 ? 6 : (tmax <= 96 ? 12 : 24);
    for (var tt = 0; tt <= tmax; tt += tInt) tSteps.push(tt);
    tSteps.forEach(function (t) {
      s += '<line x1="' + x(t) + '" y1="' + pt + '" x2="' + x(t) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(t) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + t + '</text>';
    });

    /* 500 psi 阈值线 */
    var y500 = y(500 * PSI_TO_MPA);
    s += '<line x1="' + pl + '" y1="' + y500 + '" x2="' + (pl + pw) + '" y2="' + y500 + '" stroke="#c9a15a" stroke-width="1.3" stroke-dasharray="5 3"/>';
    s += '<text x="' + (pl + pw - 4) + '" y="' + (y500 - 3) + '" font-size="8.5" fill="#c9a15a" text-anchor="end" font-family="monospace">500 psi</text>';

    /* 1500 psi 阈值线 */
    var y1500 = y(1500 * PSI_TO_MPA);
    s += '<line x1="' + pl + '" y1="' + y1500 + '" x2="' + (pl + pw) + '" y2="' + y1500 + '" stroke="#b05a51" stroke-width="1.3" stroke-dasharray="5 3"/>';
    s += '<text x="' + (pl + pw - 4) + '" y="' + (y1500 - 3) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">1500 psi</text>';

    /* 目标强度线 */
    var yTgt = y(S.target * PSI_TO_MPA);
    if (S.target * PSI_TO_MPA < yMax) {
      s += '<line x1="' + pl + '" y1="' + yTgt + '" x2="' + (pl + pw) + '" y2="' + yTgt + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 3"/>';
      s += '<text x="' + (pl + 4) + '" y="' + (yTgt - 4) + '" font-size="8.5" fill="#8a9298" font-family="monospace">目标 ' + S.target + ' psi</text>';
    }

    /* 主曲线 */
    var N = 200;
    var line = '';
    for (var i = 0; i <= N; i++) {
      var t = i / N * tmax;
      var str = ucsAt(t);
      line += (i ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(str).toFixed(1) + ' ';
    }
    s += '<path d="' + line + '" fill="none" stroke="#2f7d6b" stroke-width="2.5"/>';

    /* WOC 达标点 */
    var woc = wocTime(S.target);
    if (woc !== null && woc <= tmax) {
      var wx = x(woc), wy = y(S.target * PSI_TO_MPA);
      s += '<circle cx="' + wx.toFixed(1) + '" cy="' + wy.toFixed(1) + '" r="5" fill="#2f7d6b" stroke="#fff" stroke-width="1.6"/>';
      s += '<text x="' + wx.toFixed(1) + '" y="' + (wy - 8) + '" font-size="9" fill="#235f51" text-anchor="middle" font-family="monospace" font-weight="600">WOC ' + woc.toFixed(1) + ' h</text>';
    }

    /* 时间游标 */
    var cx = x(clamp(S.cursor, 0, tmax));
    var cursorStr = ucsAt(clamp(S.cursor, 0, tmax));
    var cy = y(cursorStr);
    s += '<line x1="' + cx + '" y1="' + pt + '" x2="' + cx + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4" fill="#8a9298" stroke="#fff" stroke-width="1.4"/>';
    s += '<text x="' + cx.toFixed(1) + '" y="' + (pt + 11) + '" font-size="8.5" fill="#5d666d" text-anchor="middle" font-family="monospace">' + S.cursor + ' h</text>';
    s += '<rect x="' + (cx + 6) + '" y="' + (cy - 14) + '" width="86" height="14" rx="3" fill="#fff" stroke="#ddd6c6"/>';
    s += '<text x="' + (cx + 11) + '" y="' + (cy - 4) + '" font-size="8.5" fill="#235f51" font-family="monospace">' + cursorStr.toFixed(2) + ' MPa</text>';

    /* 倒缩警告区 */
    if (isRetrogression()) {
      var rr = retroRisk();
      s += '<rect x="' + pl + '" y="' + pt + '" width="' + pw + '" height="' + ph + '" fill="#b05a51" opacity="0.04"/>';
      s += '<text x="' + (pl + pw / 2) + '" y="' + (pt + 13) + '" font-size="9.5" fill="#b05a51" text-anchor="middle" font-weight="600">高温倒缩风险 ' + rr.toFixed(2) + '：硅粉不足，极限强度折减 ' + Math.round(40 * rr) + '%</text>';
    }

    s += '<text x="' + (pl - 30) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 30) + ' ' + (pt + ph / 2) + ')">抗压强度 (MPa)</text>';
    s += '<text x="' + (pl + pw + 37) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (pl + pw + 37) + ' ' + (pt + ph / 2) + ')">抗压强度 (psi)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">候凝时间 (h)</text>';

    svg.innerHTML = s;
    return { woc: woc, cursorStr: cursorStr };
  }

  /* ---------- 面板 2a：强度-温度-时间热力图 ---------- */
  function drawHeat() {
    var cv = $('heat'), ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var pl = 40, pr = 16, pt = 12, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;

    var tmin = 30, tmax = 200;
    var nt = 120, nh = 100;
    var img = ctx.createImageData(nt, nh);

    var ultMax = 0;
    /* 用当前配方估算最高极限强度（取最高温、最佳条件） */
    var baseUlt = 38 * Math.pow(0.44 / S.wc, 1.2) * Math.pow(S.rho / 1.9, 0.8)
      * (1 - 0.003 * S.ret) * (1 - 0.025 * S.cont) * (1 + 0.004 * S.si) * pressureFactor();
    ultMax = baseUlt * 1.3;

    for (var row = 0; row < nh; row++) {
      var h = (nh - 1 - row) / (nh - 1) * S.tmax;
      for (var col = 0; col < nt; col++) {
        var temp = tmin + col / (nt - 1) * (tmax - tmin);
        var u = computeUcs(temp, h);
        var ratio = clamp(u / ultMax, 0, 1);
        var colStr = strengthColor(ratio);
        var rgb = colStr.match(/\d+/g);
        var k = (row * nt + col) * 4;
        img.data[k] = +rgb[0]; img.data[k + 1] = +rgb[1]; img.data[k + 2] = +rgb[2]; img.data[k + 3] = 255;
      }
    }

    ctx.clearRect(0, 0, W, H);
    var off = document.createElement('canvas');
    off.width = nt; off.height = nh;
    off.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, nt, nh, pl, pt, pw, ph);

    /* 坐标轴 */
    ctx.strokeStyle = '#cfc7b6';
    ctx.lineWidth = 1;
    ctx.strokeRect(pl, pt, pw, ph);
    ctx.fillStyle = '#5d666d';
    ctx.font = '10px Consolas, monospace';
    [30, 70, 110, 150, 200].forEach(function (t) {
      var tx = pl + (t - tmin) / (tmax - tmin) * pw;
      ctx.textAlign = 'center';
      ctx.fillText(t + '℃', tx, H - 10);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(tx, pt); ctx.lineTo(tx, pt + ph); ctx.stroke();
    });
    ctx.strokeStyle = '#cfc7b6';
    [0, S.tmax / 4, S.tmax / 2, S.tmax * 3 / 4, S.tmax].forEach(function (h) {
      var ty = pt + ph - h / S.tmax * ph;
      ctx.textAlign = 'right';
      ctx.fillText(h.toFixed(0) + 'h', pl - 6, ty + 3);
    });

    /* 标注当前温度 */
    var curX = pl + clamp((S.temp - tmin) / (tmax - tmin), 0, 1) * pw;
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(curX, pt); ctx.lineTo(curX, pt + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51';
    ctx.textAlign = 'center';
    ctx.fillText('当前 ' + S.temp + '℃', curX, pt - 4);

    ctx.fillStyle = '#5d666d';
    ctx.textAlign = 'center';
    ctx.fillText('井底温度 (℃)', pl + pw / 2, H - 2);
    ctx.save();
    ctx.translate(14, pt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('候凝时间 (h)', 0, 0);
    ctx.restore();
  }

  /* 给定温度和时间计算强度（用于热力图） */
  function computeUcs(temp, h) {
    var ult = 38 * Math.pow(0.44 / S.wc, 1.2) * Math.pow(S.rho / 1.9, 0.8)
      * (1 - 0.003 * S.ret) * (1 - 0.025 * S.cont) * (1 + 0.004 * S.si)
      * (1 - 0.4 * retroRiskOf(temp, S.si));
    var tf = 36 * Math.exp(-0.015 * (temp - 30)) * (1 + 1.5 * S.ret);
    return ult * (1 - Math.exp(-Math.pow(h / tf, 0.7))) * pressureFactor();
  }

  /* ---------- 面板 2b：多温对比曲线 ---------- */
  function drawMulti() {
    var svg = $('multi');
    var W = 430, H = 240, pl = 38, pr = 14, pt = 12, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var temps = [30, 90, 150];
    var colors = ['#8a9298', '#2f7d6b', '#b05a51'];
    var tmax = S.tmax;
    var yMax = Math.max(25, Math.ceil(ucsUlt() * pressureFactor() / 5) * 5 + 5);

    var x = function (t) { return pl + t / tmax * pw; };
    var y = function (mpa) { return pt + ph - mpa / yMax * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    for (var v = 0; v <= yMax; v += 10) {
      s += '<line x1="' + pl + '" y1="' + y(v) + '" x2="' + (pl + pw) + '" y2="' + y(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    }
    var tInt = tmax <= 48 ? 6 : (tmax <= 96 ? 12 : 24);
    for (var tt = 0; tt <= tmax; tt += tInt) {
      s += '<line x1="' + x(tt) + '" y1="' + pt + '" x2="' + x(tt) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(tt) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + tt + '</text>';
    }

    /* 500 psi 阈值 */
    var y500 = y(500 * PSI_TO_MPA);
    s += '<line x1="' + pl + '" y1="' + y500 + '" x2="' + (pl + pw) + '" y2="' + y500 + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="4 3"/>';

    for (var i = 0; i < temps.length; i++) {
      var temp = temps[i];
      var line = '';
      var N = 120;
      for (var j = 0; j <= N; j++) {
        var th = j / N * tmax;
        var str = computeUcs(temp, th);
        line += (j ? 'L' : 'M') + x(th).toFixed(1) + ' ' + y(str).toFixed(1) + ' ';
      }
      s += '<path d="' + line + '" fill="none" stroke="' + colors[i] + '" stroke-width="2"/>';
      var endStr = computeUcs(temp, tmax);
      s += '<text x="' + (x(tmax) - 4) + '" y="' + (y(endStr) - 5) + '" font-size="8.5" fill="' + colors[i] + '" text-anchor="end" font-family="monospace">' + temp + '℃</text>';
    }

    s += '<text x="' + (pl - 28) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 28) + ' ' + (pt + ph / 2) + ')">抗压强度 (MPa)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">候凝时间 (h)</text>';

    svg.innerHTML = s;
  }

  /* ---------- 面板 3：指标卡 + 因素贡献 ---------- */
  function renderMetrics(woc) {
    var u8 = ucsAt(8);
    var u24 = ucsAt(24);
    var u7d = ucsAt(168);

    $('m-8h').innerHTML = u8.toFixed(2) + '<small> MPa</small>';
    $('m-8h').parentNode.className = 'mcard' + (u8 < 3.45 ? ' warn' : '');

    $('m-24h').innerHTML = u24.toFixed(2) + '<small> MPa</small>';
    $('m-24h').parentNode.className = 'mcard' + (u24 < 3.45 ? ' warn' : '');

    $('m-7d').innerHTML = u7d.toFixed(2) + '<small> MPa</small>';

    if (woc === null) {
      $('m-woc').innerHTML = '极限内不达';
      $('m-woc').parentNode.className = 'mcard bad';
    } else if (woc > S.tmax) {
      $('m-woc').innerHTML = '>' + S.tmax + '<small> h</small>';
      $('m-woc').parentNode.className = 'mcard warn';
    } else {
      $('m-woc').innerHTML = woc.toFixed(1) + '<small> h</small>';
      $('m-woc').parentNode.className = 'mcard';
    }

    var rr = retroRisk();
    var loss = Math.round(40 * rr);
    if (rr < 0.02) {
      $('m-retro').innerHTML = '无';
      $('m-retro').parentNode.className = 'mcard';
    } else {
      $('m-retro').innerHTML = rr.toFixed(2) + '<small> −' + loss + '%</small>';
      $('m-retro').parentNode.className = 'mcard' + (rr >= 0.5 ? ' bad' : ' warn');
    }
  }

  function drawFactors() {
    var svg = $('factors');
    var W = 430, H = 150, pl = 80, pr = 60, pt = 14, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;

    /* 各因素的乘性因子值 */
    var fWc = Math.pow(0.44 / S.wc, 1.2);
    var fRho = Math.pow(S.rho / 1.9, 0.8);
    var fSi = 1 + 0.004 * S.si;
    var fRet = 1 - 0.003 * S.ret;
    var fCont = 1 - 0.025 * S.cont;
    /* 温度通过水化速率体现，用 exp(0.02*(T-30)) 表示相对 30℃ 的加速倍数 */
    var fTempRate = Math.exp(0.02 * (S.temp - 30));
    var fRetro = 1 - 0.4 * retroRisk();
    var fPres = pressureFactor();

    var factors = [
      { name: '温度 (水化速率)', value: fTempRate, color: '#b05a51', unit: '×' },
      { name: '高温倒缩', value: fRetro, color: '#b05a51', unit: '×' },
      { name: '水灰比', value: fWc, color: '#2f7d6b', unit: '×' },
      { name: '水泥浆密度', value: fRho, color: '#2f7d6b', unit: '×' },
      { name: '硅粉掺量', value: fSi, color: '#2f7d6b', unit: '×' },
      { name: '缓凝剂', value: fRet, color: '#c9a15a', unit: '×' },
      { name: '钻井液污染', value: fCont, color: '#c9a15a', unit: '×' },
      { name: '养护压力', value: fPres, color: '#8a9298', unit: '×' }
    ];

    var vMax = Math.max(2.5, Math.max.apply(null, factors.map(function (f) { return f.value; })) + 0.2);
    var vMin = 0;
    var barH = ph / factors.length * 0.6;
    var gap = ph / factors.length;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 基准线 = 1.0 */
    var xOne = pl + (1 - vMin) / (vMax - vMin) * pw;
    s += '<line x1="' + xOne + '" y1="' + pt + '" x2="' + xOne + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + xOne + '" y="' + (pt - 4) + '" font-size="8.5" fill="#c9a15a" text-anchor="middle" font-family="monospace">基准 1.0</text>';

    factors.forEach(function (f, i) {
      var cy = pt + gap * (i + 0.5);
      var yTop = cy - barH / 2;
      var bx = pl;
      var bw = (f.value - vMin) / (vMax - vMin) * pw;
      s += '<rect x="' + bx + '" y="' + yTop + '" width="' + bw.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="3" fill="' + f.color + '" opacity="0.8"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (cy + 3) + '" font-size="9" fill="#4d565b" text-anchor="end">' + f.name + '</text>';
      s += '<text x="' + (bx + bw + 5) + '" y="' + (cy + 3) + '" font-size="9" fill="#3a4145" font-family="monospace" font-weight="600">' + f.value.toFixed(3) + f.unit + '</text>';
    });

    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 3) + '" font-size="8.5" fill="#5d666d" text-anchor="middle">各因素对极限强度 UCS_ult / 水化速率的乘性贡献（>1 为正向，<1 为负向）</text>';

    svg.innerHTML = s;
  }

  function renderVerdict(woc, cursorStr) {
    var v = $('verdict');
    var targetMPa = S.target * PSI_TO_MPA;
    var ult = ucsUlt() * pressureFactor();
    var u24 = ucsAt(24);

    var head = '目标强度 <b>' + S.target + '</b> psi (' + targetMPa.toFixed(2) + ' MPa) · 极限强度 <b>' + ult.toFixed(2) + '</b> MPa · 24h UCS <b>' + u24.toFixed(2) + '</b> MPa；';

    var rr = retroRisk();
    if (rr >= 0.5) {
      v.className = 'verdict bad';
      v.innerHTML = head + '高温倒缩风险 <b>' + rr.toFixed(2) + '</b>：BHST=' + S.temp + '℃ 偏高而硅粉仅 ' + S.si + '%，极限强度折减 ' + Math.round(40 * rr) + '%。建议：将硅粉掺量提高至 30–40%。';
      return;
    }
    if (woc === null) {
      v.className = 'verdict bad';
      v.innerHTML = head + '当前配方极限强度无法达到目标强度，需降低水灰比或提高密度。';
      return;
    }
    if (woc <= 8) {
      v.className = 'verdict ok';
      v.innerHTML = head + 'WOC = <b>' + woc.toFixed(1) + '</b> h，8h 内即可达标，可提前钻塞。';
    } else if (woc <= 24) {
      v.className = 'verdict ok';
      v.innerHTML = head + 'WOC = <b>' + woc.toFixed(1) + '</b> h，24h 内达标，可按常规候凝。';
    } else if (woc <= S.tmax) {
      v.className = 'verdict warn';
      v.innerHTML = head + 'WOC = <b>' + woc.toFixed(1) + '</b> h，超过 24h。建议：升高井底温度、降低水灰比或减少缓凝剂。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = head + 'WOC = <b>' + woc.toFixed(1) + '</b> h，超出当前时间轴。建议：升高温度或减少缓凝剂掺量。';
    }
  }

  function render() {
    var res = drawChart();
    drawHeat();
    drawMulti();
    renderMetrics(res.woc);
    drawFactors();
    renderVerdict(res.woc, res.cursorStr);
    saveShared();
    updateSyncNote();
  }

  function updateSyncNote() {
    var n = 0;
    try {
      var s = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}');
      MY_KEYS.forEach(function (k) { if (k in s && typeof s[k] === 'number') n++; });
    } catch (e) {}
    var note = $('sync-note');
    if (note) note.firstChild.textContent = '邻接参数联动：已同步 ' + n + ' 个共享参数（密度/水灰比/硅粉/缓凝剂/温度…） ';
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    temp: function (v) { return v + ' ℃'; },
    wc: function (v) { return v.toFixed(2); },
    rho: function (v) { return v.toFixed(2) + ' g/cm³'; },
    si: function (v) { return v + ' %BWOC'; },
    ret: function (v) { return v.toFixed(2) + ' %BWOC'; },
    pres: function (v) { return v + ' MPa'; },
    cont: function (v) { return v + ' %'; },
    target: function (v) { return v + ' psi'; },
    tmax: function (v) { return v + ' h'; },
    cursor: function (v) { return v + ' h'; }
  };

  var KEYS = ['temp', 'wc', 'rho', 'si', 'ret', 'pres', 'cont', 'target', 'tmax', 'cursor'];

  function readInputs() {
    KEYS.forEach(function (k) {
      S[k] = parseFloat($('s-' + k).value);
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

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
      });
      readInputs();
      render();
    });
  }

  bind();

  // ===== 帕累托方案对比 =====
  // 40 个候选 = 8 档井底温度 × 5 档硅粉掺量，在当前配比基础上扫描「早期强度 ↔ 倒缩风险」权衡轴
  var CAND_TEMPS = [30, 55, 80, 105, 130, 155, 180, 200];
  var CAND_SILICA = [0, 10, 20, 30, 40];

  var CANDIDATES = [];     // 候选：{params, ucs24, retroRisk, cost}
  var FRONT_ONLY = false;  // 是否仅显示前沿
  var SELECTED_IDX = -1;   // 当前选中候选

  function generateCandidates() {
    CANDIDATES = [];
    CAND_TEMPS.forEach(function (T) {
      CAND_SILICA.forEach(function (si) {
        var st = Object.assign({}, S, { temp: T, si: si });
        var m = computeMetrics(st);
        var cost = st.wc + st.ret + 0.05 * si;   /* 成本折算：水灰比 + 缓凝剂 + 硅粉 */
        CANDIDATES.push({ params: st, ucs24: m.ucs24, retroRisk: m.retroRisk, cost: cost });
      });
    });
    SELECTED_IDX = -1;
    drawPareto();
  }

  // 帕累托前沿：x=强度(越大越好)，y=倒缩风险(越小越好)
  // 非支配：不存在另一点强度更高且风险更低
  function paretoFront(cands) {
    var front = [];
    for (var i = 0; i < cands.length; i++) {
      var dominated = false;
      for (var j = 0; j < cands.length; j++) {
        if (i === j) continue;
        if (cands[j].ucs24 >= cands[i].ucs24 && cands[j].retroRisk <= cands[i].retroRisk &&
            (cands[j].ucs24 > cands[i].ucs24 || cands[j].retroRisk < cands[i].retroRisk)) {
          dominated = true; break;
        }
      }
      if (!dominated) front.push(i);
    }
    return front;
  }

  function drawPareto() {
    var svg = $('pareto');
    var W = 430, H = 250, pl = 42, pr = 16, pt = 14, pb = 34;
    var pw = W - pl - pr, ph = H - pt - pb;

    if (CANDIDATES.length === 0) {
      svg.innerHTML = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>' +
        '<text x="' + (W / 2) + '" y="' + (H / 2) + '" font-size="11" fill="#9ba3a9" text-anchor="middle">点击「生成 40 个候选方案」开始对比</text>';
      return;
    }

    var frontSet = {};
    paretoFront(CANDIDATES).forEach(function (i) { frontSet[i] = true; });

    var xMin = 0;
    var xMax = Math.max.apply(null, CANDIDATES.map(function (d) { return d.ucs24; })) * 1.05;
    var yMin = -0.05;
    var yMax = 1.05;

    function xP(v) { return pl + (v - xMin) / (xMax - xMin) * pw; }
    function yP(v) { return pt + ph - (v - yMin) / (yMax - yMin) * ph; }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    // 网格
    for (var gx = 0; gx <= xMax; gx += Math.max(2, Math.round(xMax / 6))) {
      var xx = xP(gx);
      s += '<line x1="' + xx + '" y1="' + pt + '" x2="' + xx + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xx + '" y="' + (H - pb + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + gx.toFixed(0) + '</text>';
    }
    for (var gy = 0; gy <= 1; gy += 0.25) {
      var yy = yP(gy);
      s += '<line x1="' + pl + '" y1="' + yy + '" x2="' + (pl + pw) + '" y2="' + yy + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (yy + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gy.toFixed(2) + '</text>';
    }

    // 阈值线：倒缩风险=0.5 横线
    var y05 = yP(0.5);
    s += '<line x1="' + pl + '" y1="' + y05 + '" x2="' + (pl + pw) + '" y2="' + y05 + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + (pl + pw - 4) + '" y="' + (y05 - 3) + '" font-size="8.5" fill="#b05a51" text-anchor="end" font-family="monospace">风险=0.5</text>';

    // 点
    var costMax = Math.max.apply(null, CANDIDATES.map(function (d) { return d.cost; }));
    for (var i = 0; i < CANDIDATES.length; i++) {
      var d = CANDIDATES[i];
      if (FRONT_ONLY && !frontSet[i]) continue;
      var r = 3 + (d.cost / costMax) * 8;
      var fill = d.retroRisk < 0.5 ? '#3f8560' : '#b05a51';
      var stroke = frontSet[i] ? '#c9a15a' : '#fff';
      var sw = frontSet[i] ? 2 : 1;
      if (i === SELECTED_IDX) { stroke = '#1a1a1a'; sw = 2.5; }
      var cx = xP(d.ucs24).toFixed(1);
      var cy = yP(d.retroRisk).toFixed(1);
      var tip = '24h UCS=' + d.ucs24.toFixed(1) + ' MPa\n倒缩风险=' + d.retroRisk.toFixed(2) + '\n成本=' + d.cost.toFixed(2) + (frontSet[i] ? '\n帕累托前沿' : '');
      s += '<circle data-idx="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '" opacity="0.85" style="cursor:pointer"><title>' + tip + '</title></circle>';
    }

    // 轴标签
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">24h UCS (MPa)</text>';
    s += '<text x="' + (pl - 32) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 32) + ' ' + (pt + ph / 2) + ')">高温倒缩风险</text>';

    svg.innerHTML = s;

    Array.prototype.forEach.call(svg.querySelectorAll('circle[data-idx]'), function (el) {
      el.addEventListener('click', function () {
        var idx = +el.getAttribute('data-idx');
        applyCandidate(idx);
      });
    });
  }

  function applyCandidate(idx) {
    var d = CANDIDATES[idx];
    if (!d) return;
    Object.keys(d.params).forEach(function (k) { S[k] = d.params[k]; });
    syncSlidersFromS();
    SELECTED_IDX = idx;
    render();
    drawPareto();
  }

  function bindParetoButtons() {
    $('btn-gen-cands').addEventListener('click', generateCandidates);
    $('btn-front-only').addEventListener('click', function () {
      FRONT_ONLY = !FRONT_ONLY;
      this.textContent = FRONT_ONLY ? '显示全部候选' : '仅显示帕累托前沿';
      drawPareto();
    });
    $('btn-reset-cur').addEventListener('click', function () {
      SELECTED_IDX = -1;
      KEYS.forEach(function (k) { S[k] = DEF[k]; });
      syncSlidersFromS();
      render();
      drawPareto();
    });
    $('btn-clear-shared').addEventListener('click', function () {
      localStorage.removeItem(SHARED_KEY);
      updateSyncNote();
    });
  }

  bindParetoButtons();
  loadShared();
  syncSlidersFromS();
  updateSyncNote();
  render();
  drawPareto();
})();
