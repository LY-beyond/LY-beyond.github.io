/* ======= 管道腐蚀缺陷智能评估 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function mulberry32(a) {
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

  /* HiDPI：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
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
  function showTip(tip, box, html, evt) {
    var rb = box.getBoundingClientRect();
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = clamp(evt.clientX - rb.left + 12, 4, Math.max(4, rb.width - 200)) + 'px';
    tip.style.top = clamp(evt.clientY - rb.top - 8, 4, Math.max(4, rb.height - 80)) + 'px';
  }

  /* ================= 管段与准则（X70 · D813 · API 5L） ================= */
  var D = 813, SMYS = 483, UTS = 565;

  function b31g(ratio, L, t) {
    ratio = clamp(ratio, 0, 0.95);
    var z = L * L / (D * t);
    var M = z <= 20 ? Math.sqrt(1 + 0.8 * z) : 0.032 * z + 3.3;
    var a = z <= 20 ? (2 / 3) * ratio : ratio;
    if (a >= 1) return 0.01;
    return 1.1 * SMYS * (2 * t / D) * (1 - a) / (1 - a / M);
  }
  function b31gMod(ratio, L, t) {
    ratio = clamp(ratio, 0, 0.95);
    var z = L * L / (D * t);
    var M = z <= 50 ? Math.sqrt(1 + 0.6275 * z - 0.003375 * z * z) : 0.032 * z + 3.3;
    var a = 0.85 * ratio;
    if (a >= 1) return 0.01;
    return (SMYS + 69) * (2 * t / D) * (1 - a) / (1 - a / M);
  }
  function dnvF(ratio, L, t) {
    ratio = clamp(ratio, 0, 0.95);
    var z = L * L / (D * t);
    var Q = Math.sqrt(1 + 0.31 * z);
    return (2 * t * UTS / (D - t)) * (1 - ratio) / (1 - ratio / Q);
  }
  /* 给定深度与目标压力，反解临界长度（P_f 随 L 单调下降） */
  function solveL(ratio, target, t) {
    function f(L) { return b31g(ratio, L, t) - target; }
    if (f(5) < 0) return 5;
    if (f(1500) > 0) return 1500;
    var lo = 5, hi = 1500;
    for (var i = 0; i < 48; i++) { var mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /* 剩余寿命：d(yr)=d0+CR·yr，退化至 P_f=target 为止（年） */
  function lifeOf(ratio0, L, cr, t, target) {
    function f(yr) { return b31g(Math.min(0.95, ratio0 + cr * yr / t), L, t) - target; }
    if (f(0) <= 0) return 0;
    if (f(80) > 0) return Infinity;
    var lo = 0, hi = 80;
    for (var i = 0; i < 48; i++) { var mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* ================= 模拟内检测缺陷数据集（K386—K396） ================= */
  function kmStr(km) {
    var k = Math.floor(km), m = Math.round((km - k) * 1000);
    return 'K' + k + '+' + ('00' + m).slice(-3);
  }
  function clockStr(deg) {
    var c = Math.round(deg / 30) % 12;
    return (c === 0 ? 12 : c) + ' 点钟';
  }
  var DEFECTS = (function () {
    var rng = mulberry32(20261030);
    var types = ['均匀腐蚀', '点蚀', '沟槽状腐蚀', '焊缝腐蚀'];
    var clusters = [
      { km: 387.3, deg: 100, n: 7, env: 0.85 },
      { km: 389.4, deg: 190, n: 8, env: 1.25 },
      { km: 391.6, deg: 210, n: 9, env: 1.45 },
      { km: 393.8, deg: 30, n: 6, env: 0.75 },
      { km: 395.3, deg: 300, n: 6, env: 1.05 }
    ];
    var list = [];
    clusters.forEach(function (c) {
      for (var i = 0; i < c.n; i++) {
        var km = clamp(c.km + gauss(rng) * 0.32, 386.05, 395.95);
        var deg = (c.deg + gauss(rng) * 26 + 360) % 360;
        var dPct = clamp(10 + rng() * 34 * c.env + gauss(rng) * 5, 6, 72);
        var L = clamp(25 + rng() * 150 * (0.7 + c.env * 0.5) + dPct * 2.1, 15, 390);
        list.push({
          km: km, deg: deg, dPct: Math.round(dPct), L: Math.round(L),
          w: Math.round(20 + rng() * 100),
          cr: clamp(0.03 + c.env * 0.09 + rng() * 0.08, 0.02, 0.55),
          type: types[Math.floor(rng() * types.length)]
        });
      }
    });
    for (var j = 0; j < 8; j++) {
      var d2 = clamp(8 + rng() * 30, 6, 45);
      list.push({
        km: 386.1 + rng() * 9.8, deg: rng() * 360, dPct: Math.round(d2),
        L: Math.round(clamp(20 + rng() * 140 + d2 * 2, 15, 300)),
        w: Math.round(20 + rng() * 90), cr: clamp(0.02 + rng() * 0.12, 0.02, 0.55),
        type: types[Math.floor(rng() * types.length)]
      });
    }
    /* 注入典型陷阱缺陷：长而浅的沟槽比短深的点蚀更接近失效 */
    list.push({ km: 391.62, deg: 205, dPct: 42, L: 305, w: 95, cr: 0.21, type: '沟槽状腐蚀' });
    list.push({ km: 387.28, deg: 98, dPct: 35, L: 340, w: 110, cr: 0.10, type: '沟槽状腐蚀' });
    list.push({ km: 389.44, deg: 188, dPct: 58, L: 60, w: 45, cr: 0.16, type: '点蚀' });
    list.push({ km: 395.32, deg: 302, dPct: 63, L: 95, w: 60, cr: 0.24, type: '点蚀群' });
    list.forEach(function (d, i) {
      d.id = 'D-' + ('00' + (i + 1)).slice(-3);
      d.wdeg = d.w / (Math.PI * D) * 360;
    });
    return list;
  })();

  /* 深度-长度分布散点（全管段 110 条匹配缺陷，模拟样本） */
  var SCAT = (function () {
    var rng = mulberry32(777), pts = [];
    for (var i = 0; i < 110; i++) {
      var L = 12 + Math.pow(rng(), 1.7) * 400;
      var d = clamp(4 + rng() * 58 + (L / 420) * 20 * rng(), 4, 80);
      pts.push({ L: L, d: d });
    }
    return pts;
  })();

  /* ================= 状态 ================= */
  var DEF = { t: 10.3, p: 7.2, sf: 1.39, d: 45, L: 180, cr: 0.12, horizon: 15 };
  var S = Object.assign({}, DEF);
  var SELECTED = -1;

  /* ================= 面板 ①：管道展开壁厚损失热力图 ================= */
  var HW = 450, HH = 198, HPL = 46, HPR = 44, HPT = 14, HPB = 26;
  var HPW = HW - HPL - HPR, HPH = HH - HPT - HPB;
  var KM0 = 386, KM1 = 396;
  function depthColor(r) {
    r = clamp(r, 0, 1);
    var a = [47, 125, 107], b = [201, 161, 90], c = [176, 90, 81], lo, hi, t;
    if (r < 0.5) { t = r / 0.5; lo = a; hi = b; } else { t = (r - 0.5) / 0.5; lo = b; hi = c; }
    return [lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t];
  }
  function drawHeat() {
    var cv = $('heat'), ctx = setupCanvas(cv, HW, HH);
    var nx = 140, ny = 56;
    var img = ctx.createImageData(nx, ny);
    var rng = mulberry32(5);
    var bgR = 240, bgG = 237, bgB = 228;
    for (var row = 0; row < ny; row++) {
      var deg = 360 - (row + 0.5) / ny * 360;
      for (var col = 0; col < nx; col++) {
        var km = KM0 + (col + 0.5) / nx * (KM1 - KM0);
        var v = 0;
        for (var i = 0; i < DEFECTS.length; i++) {
          var d = DEFECTS[i];
          var dx = km - d.km;
          var dy = Math.abs(deg - d.deg); dy = Math.min(dy, 360 - dy);
          var sx = Math.max(d.L / 2000, 0.02);
          var sy = Math.max(d.wdeg / 2.2, 4);
          var infl = (d.dPct / 80) * Math.exp(-(dx * dx / (2 * sx * sx) + dy * dy / (2 * sy * sy)));
          if (infl > v) v = infl;
        }
        var k = (row * nx + col) * 4;
        var w = clamp((v - 0.05) / 0.30, 0, 1);
        if (w <= 0.01) {
          var n = (rng() - 0.5) * 7;
          img.data[k] = bgR + n; img.data[k + 1] = bgG + n; img.data[k + 2] = bgB + n;
        } else {
          var c = depthColor(clamp(v, 0, 1));
          img.data[k] = bgR + (c[0] - bgR) * w;
          img.data[k + 1] = bgG + (c[1] - bgG) * w;
          img.data[k + 2] = bgB + (c[2] - bgB) * w;
        }
        img.data[k + 3] = 255;
      }
    }
    ctx.clearRect(0, 0, HW, HH);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, HW, HH);
    var off = document.createElement('canvas');
    off.width = nx; off.height = ny;
    off.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, nx, ny, HPL, HPT, HPW, HPH);

    /* 边框与刻度 */
    ctx.strokeStyle = '#cfc7b6'; ctx.lineWidth = 1;
    ctx.strokeRect(HPL, HPT, HPW, HPH);
    ctx.font = '9px Consolas, monospace';
    ctx.fillStyle = '#8a9298';
    for (var kk = KM0; kk <= KM1; kk += 2) {
      var tx = HPL + (kk - KM0) / (KM1 - KM0) * HPW;
      ctx.textAlign = 'center';
      ctx.fillText('K' + kk, tx, HPT + HPH + 12);
      ctx.strokeStyle = 'rgba(207,199,182,0.45)';
      ctx.beginPath(); ctx.moveTo(tx, HPT); ctx.lineTo(tx, HPT + HPH); ctx.stroke();
    }
    for (var dg = 0; dg <= 360; dg += 60) {
      var ty = HPT + HPH - dg / 360 * HPH;
      ctx.textAlign = 'right';
      ctx.fillText(dg + '°', HPL - 5, ty + 3);
      if (dg > 0 && dg < 360) {
        ctx.strokeStyle = 'rgba(207,199,182,0.45)';
        ctx.beginPath(); ctx.moveTo(HPL, ty); ctx.lineTo(HPL + HPW, ty); ctx.stroke();
      }
    }
    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.fillText('里程', HPL + HPW / 2, HH - 3);
    ctx.save(); ctx.translate(11, HPT + HPH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('环向角（0°=管顶）', 0, 0); ctx.restore();

    /* 腐蚀聚集区注记（阴保异常段，白描边防压线） */
    var ax = HPL + (391.6 - KM0) / (KM1 - KM0) * HPW;
    ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(253,252,249,0.85)';
    ctx.strokeText('K391–K392 阴保异常段 · 腐蚀聚集', ax, HPT + 10);
    ctx.fillStyle = '#8a5a52';
    ctx.fillText('K391–K392 阴保异常段 · 腐蚀聚集', ax, HPT + 10);

    /* 色标 */
    var cbx = HPL + HPW + 8, cbw = 9;
    for (var g = 0; g < 40; g++) {
      var c2 = depthColor(1 - g / 39);
      ctx.fillStyle = 'rgb(' + Math.round(c2[0]) + ',' + Math.round(c2[1]) + ',' + Math.round(c2[2]) + ')';
      ctx.fillRect(cbx, HPT + g / 40 * HPH, cbw, HPH / 40 + 1);
    }
    ctx.strokeStyle = '#cfc7b6'; ctx.strokeRect(cbx, HPT, cbw, HPH);
    ctx.fillStyle = '#8a9298'; ctx.textAlign = 'left'; ctx.font = '8.5px Consolas, monospace';
    ctx.fillText('80%t', cbx + 13, HPT + 6);
    ctx.fillText('40%t', cbx + 13, HPT + HPH / 2 + 3);
    ctx.fillText('0', cbx + 13, HPT + HPH);

    /* 选中缺陷标记 */
    if (SELECTED >= 0) {
      var sd = DEFECTS[SELECTED];
      var cx = HPL + (sd.km - KM0) / (KM1 - KM0) * HPW;
      var cy = HPT + HPH - sd.deg / 360 * HPH;
      var rw = Math.max(sd.L / 1000 / (KM1 - KM0) * HPW * 2.2, 14);
      var rh = Math.max(sd.wdeg / 360 * HPH * 2.2, 12);
      ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
      ctx.setLineDash([]);
    }
  }
  function heatDefectAt(lx, ly) {
    var km = KM0 + (lx - HPL) / HPW * (KM1 - KM0);
    var deg = (HPT + HPH - ly) / HPH * 360;
    if (km < KM0 || km > KM1 || deg < 0 || deg > 360) return -1;
    var best = -1, bd = 1e9;
    DEFECTS.forEach(function (d, i) {
      var dx = (km - d.km) / 0.18;
      var ddy = Math.abs(deg - d.deg); ddy = Math.min(ddy, 360 - ddy);
      var nd = dx * dx + (ddy / 20) * (ddy / 20);
      if (nd < bd) { bd = nd; best = i; }
    });
    return bd <= 1 ? best : -1;
  }
  function bindHeat() {
    var cv = $('heat'), tip = $('heat-tip'), box = $('heat-box');
    function logical(evt) {
      var r = cv.getBoundingClientRect();
      return { x: (evt.clientX - r.left) * (HW / r.width), y: (evt.clientY - r.top) * (HH / r.height) };
    }
    cv.addEventListener('mousemove', function (evt) {
      var p = logical(evt), i = heatDefectAt(p.x, p.y);
      if (i >= 0) {
        var d = DEFECTS[i];
        showTip(tip, box, '<b>' + d.id + '</b> · ' + d.type +
          '<br>里程 ' + kmStr(d.km) + ' · 环向 ' + Math.round(d.deg) + '°（' + clockStr(d.deg) + '）' +
          '<br>深度 <b>' + d.dPct + '%t</b> · 长度 ' + d.L + ' mm · 宽度 ' + d.w + ' mm' +
          '<br>腐蚀速率 ≈' + d.cr.toFixed(2) + ' mm/a' +
          '<br><span style="color:#8a9298">点击载入该缺陷参数</span>', evt);
        cv.style.cursor = 'pointer';
      } else { tip.style.display = 'none'; cv.style.cursor = 'crosshair'; }
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    cv.addEventListener('click', function (evt) {
      var p = logical(evt), i = heatDefectAt(p.x, p.y);
      if (i >= 0) selectDefect(i);
    });
  }

  /* ================= 面板 ③：MFL 漏磁信号与自动框选 ================= */
  var MW = 450, MH = 154, MPL = 36, MPR = 10;
  var MPW = MW - MPL - MPR;
  var B1T = 22, B1H = 44, B2T = 82, B2H = 44;
  var MIDX = 300, SIG = 14, NOISE = 3.5, THR = 5 * NOISE;
  function drawMfl() {
    var cv = $('mfl'), ctx = setupCanvas(cv, MW, MH);
    var A1 = 115 * (S.d / 100) * S.t;
    var A2 = 88 * (S.d / 100) * S.t;
    var s = Math.max(S.L / 2, 18);
    var rng = mulberry32(99);
    var n1 = [], n2 = [], xs = [], br = [], ba = [];
    for (var x = 0; x <= 600; x += 2) {
      xs.push(x);
      n1.push(gauss(rng) * NOISE); n2.push(gauss(rng) * NOISE);
      br.push(A1 * (Math.exp(-Math.pow(x - (MIDX - s), 2) / (2 * SIG * SIG)) -
                    Math.exp(-Math.pow(x - (MIDX + s), 2) / (2 * SIG * SIG))));
      ba.push(A2 * Math.exp(-Math.pow(x - MIDX, 2) / (2 * SIG * 1.4 * SIG * 1.4)));
    }
    /* AI 检出：Br 双极信号左右波瓣各自寻峰，峰间距 ≈ 缺陷长度；幅值反演深度 */
    var pkL = 0, pkR = 0, iL = 0, iR = xs.length - 1;
    for (var i = 0; i < xs.length; i++) {
      var a = Math.abs(br[i] + n1[i]);
      if (xs[i] <= MIDX) { if (a > pkL) { pkL = a; iL = i; } }
      else { if (a > pkR) { pkR = a; iR = i; } }
    }
    var peak = Math.max(pkL, pkR);
    var uEst = SIG * Math.sqrt(2 * Math.log(Math.max(peak / THR, 1.01)));
    var x1 = xs[iL] - uEst, x2 = xs[iR] + uEst;
    var Lest = Math.max(10, Math.round((xs[iR] - xs[iL]) / 5) * 5);
    var dEst = clamp(peak / (115 * S.t) * 100, 3, 95);

    var vmax1 = Math.max(40, A1 * 1.25), vmax2 = Math.max(30, A2 * 1.3);
    var mid1 = B1T + B1H / 2, mid2 = B2T + B2H / 2, amp = B1H / 2 - 2;
    function xp(x) { return MPL + x / 600 * MPW; }
    function y1(v) { return mid1 - v / vmax1 * amp; }
    function y2(v) { return mid2 - v / vmax2 * amp; }

    ctx.clearRect(0, 0, MW, MH);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, MW, MH);

    /* 检出区底色与虚线框 */
    ctx.fillStyle = 'rgba(201,161,90,0.09)';
    ctx.fillRect(xp(x1), B1T - 12, xp(x2) - xp(x1), B2T + B2H - B1T + 16);
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(xp(x1), B1T - 12, xp(x2) - xp(x1), B2T + B2H - B1T + 16);
    ctx.setLineDash([]);

    /* 信号带 */
    ctx.strokeStyle = '#d8d0bc'; ctx.lineWidth = 1;
    ctx.strokeRect(MPL, B1T, MPW, B1H);
    ctx.strokeRect(MPL, B2T, MPW, B2H);
    ctx.strokeStyle = '#e3ddcd';
    ctx.beginPath(); ctx.moveTo(MPL, mid1); ctx.lineTo(MPL + MPW, mid1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MPL, mid2); ctx.lineTo(MPL + MPW, mid2); ctx.stroke();
    /* 阈值线（Br 带） */
    ctx.strokeStyle = '#c9a15a'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(MPL, y1(THR)); ctx.lineTo(MPL + MPW, y1(THR)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MPL, y1(-THR)); ctx.lineTo(MPL + MPW, y1(-THR)); ctx.stroke();
    ctx.setLineDash([]);

    /* 波形 */
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#2f7d6b';
    ctx.beginPath();
    for (var i = 0; i < xs.length; i++) { var yy = y1(br[i] + n1[i]); if (i) ctx.lineTo(xp(xs[i]), yy); else ctx.moveTo(xp(xs[i]), yy); }
    ctx.stroke();
    ctx.strokeStyle = '#41699b';
    ctx.beginPath();
    for (var j = 0; j < xs.length; j++) { var yb = y2(ba[j] + n2[j]); if (j) ctx.lineTo(xp(xs[j]), yb); else ctx.moveTo(xp(xs[j]), yb); }
    ctx.stroke();

    /* 文字标注 */
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#5d666d'; ctx.textAlign = 'left';
    ctx.fillText('Br 径向分量', MPL + 4, B1T - 6);
    ctx.fillText('Ba 轴向分量', MPL + 4, B2T - 6);
    ctx.font = '8.5px Consolas, monospace'; ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
    ctx.fillText('±' + Math.round(vmax1) + ' mV', MPL + MPW - 4, B1T + 11);
    ctx.fillText('±' + Math.round(vmax2) + ' mV', MPL + MPW - 4, B2T + 11);
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#9a7a1c'; ctx.textAlign = 'right';
    ctx.fillText('AI 框选：L≈' + Lest + ' mm · d≈' + Math.round(dEst) + '%t（真值 ' + S.L + ' mm · ' + S.d + '%t）', MPL + MPW, B1T - 16);

    /* x 轴 */
    ctx.strokeStyle = '#cfc7b6'; ctx.fillStyle = '#8a9298';
    ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'center';
    for (var xt = 0; xt <= 600; xt += 100) {
      ctx.beginPath(); ctx.moveTo(xp(xt), B2T + B2H); ctx.lineTo(xp(xt), B2T + B2H + 4); ctx.stroke();
      ctx.fillText(xt, xp(xt), B2T + B2H + 14);
    }
    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif';
    ctx.fillText('轴向位置 (mm) · 缺陷中心 300 mm', MPL + MPW / 2, MH - 2);

    return { x1: x1, x2: x2, br: br, ba: ba, n1: n1, n2: n2, xs: xs };
  }
  function bindMfl() {
    var cv = $('mfl'), tip = $('mfl-tip'), box = $('mfl-box');
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (MW / r.width);
      var xmm = clamp((lx - MPL) / MPW * 600, 0, 600);
      var A1 = 115 * (S.d / 100) * S.t, A2 = 88 * (S.d / 100) * S.t;
      var s = Math.max(S.L / 2, 18);
      var vb = A1 * (Math.exp(-Math.pow(xmm - (MIDX - s), 2) / (2 * SIG * SIG)) -
                     Math.exp(-Math.pow(xmm - (MIDX + s), 2) / (2 * SIG * SIG)));
      var va = A2 * Math.exp(-Math.pow(xmm - MIDX, 2) / (2 * SIG * 1.4 * SIG * 1.4));
      showTip(tip, box, '轴向位置 <b>' + Math.round(xmm) + '</b> mm' +
        '<br>Br ≈ <b>' + vb.toFixed(0) + '</b> mV · Ba ≈ <b>' + va.toFixed(0) + '</b> mV' +
        '<br><span style="color:#8a9298">信号幅值 ∝ 深度 × 壁厚</span>', evt);
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= 面板 ④：深度-长度散点与 B31G 安全分区 ================= */
  var SW = 450, SH = 208, SPL = 38, SPR = 14, SPT = 10, SPB = 28;
  var SPW = SW - SPL - SPR, SPH = SH - SPT - SPB;
  function sx(L) { return SPL + L / 420 * SPW; }
  function sy(d) { return SPT + SPH - d / 85 * SPH; }
  function zoneOf(dPct, L) {
    var pf = b31g(dPct / 100, L, S.t);
    if (pf < 1.1 * S.p) return 2;
    if (pf < S.sf * S.p) return 1;
    return 0;
  }
  function drawScatter() {
    var svg = $('scatter');
    var s = '<rect width="' + SW + '" height="' + SH + '" fill="#fdfcf9"/>';
    /* 网格与刻度 */
    var xt, yt;
    for (xt = 0; xt <= 420; xt += 100) {
      s += '<line x1="' + sx(xt) + '" y1="' + SPT + '" x2="' + sx(xt) + '" y2="' + (SPT + SPH) + '" stroke="#efece1"/>';
      s += '<text x="' + sx(xt) + '" y="' + (SPT + SPH + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + xt + '</text>';
    }
    for (yt = 0; yt <= 80; yt += 20) {
      s += '<line x1="' + SPL + '" y1="' + sy(yt) + '" x2="' + (SPL + SPW) + '" y2="' + sy(yt) + '" stroke="#efece1"/>';
      s += '<text x="' + (SPL - 5) + '" y="' + (sy(yt) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + yt + '</text>';
    }
    /* 分区边界曲线 */
    var c1 = [], c2 = [], dd;
    for (dd = 3; dd <= 84; dd += 1.5) {
      c1.push([Math.min(solveL(dd / 100, S.sf * S.p, S.t), 420), dd]);
      c2.push([Math.min(solveL(dd / 100, 1.1 * S.p, S.t), 420), dd]);
    }
    function pathOf(pts, close) {
      var p = '';
      pts.forEach(function (q, i) { p += (i ? 'L' : 'M') + sx(q[0]).toFixed(1) + ' ' + sy(q[1]).toFixed(1) + ' '; });
      return p + (close || '');
    }
    /* 安全区底色 */
    s += '<rect x="' + SPL + '" y="' + SPT + '" width="' + SPW + '" height="' + SPH + '" fill="rgba(47,125,107,0.05)"/>';
    /* 监测区：c1 与 c2 之间 */
    var mon = pathOf(c1) + c2.slice().reverse().map(function (q, i) { return (i ? 'L' : 'L') + sx(q[0]).toFixed(1) + ' ' + sy(q[1]).toFixed(1) + ' '; }).join('') + 'Z';
    s += '<path d="' + mon + '" fill="rgba(201,161,90,0.13)" stroke="none"/>';
    /* 维修区：c2 右侧 */
    var rep = pathOf(c2) + 'L' + sx(420) + ' ' + sy(84) + ' L' + sx(420) + ' ' + sy(3) + ' Z';
    s += '<path d="' + rep + '" fill="rgba(176,90,81,0.10)" stroke="none"/>';
    /* 边界线 */
    s += '<path d="' + pathOf(c1) + '" fill="none" stroke="#2f7d6b" stroke-width="1.4"/>';
    s += '<path d="' + pathOf(c2) + '" fill="none" stroke="#b05a51" stroke-width="1.4"/>';
    /* 分区标签 */
    var mD = 46, xMid = (sx(c1[Math.round((mD - 3) / 1.5)][0]) + sx(c2[Math.round((mD - 3) / 1.5)][0])) / 2;
    s += '<text x="' + sx(26) + '" y="' + sy(9) + '" font-size="9.5" fill="#35765a" text-anchor="middle" font-weight="600">安全区</text>';
    s += '<text x="' + xMid.toFixed(1) + '" y="' + sy(mD) + '" font-size="9.5" fill="#9a7a1c" text-anchor="middle" font-weight="600">监测区</text>';
    var rD = 74, rX = Math.min(sx(c2[Math.round((rD - 3) / 1.5)][0]) + 34, SPL + SPW - 10);
    s += '<text x="' + rX.toFixed(1) + '" y="' + sy(rD) + '" font-size="9.5" fill="#a85147" text-anchor="middle" font-weight="600">维修区</text>';
    /* 散点 */
    var zc = ['#2f7d6b', '#c9a15a', '#b05a51'];
    SCAT.forEach(function (p, i) {
      var z = zoneOf(p.d, p.L);
      s += '<circle data-i="' + i + '" cx="' + sx(p.L).toFixed(1) + '" cy="' + sy(p.d).toFixed(1) + '" r="3" fill="' + zc[z] + '" opacity="0.7" style="cursor:pointer"/>';
    });
    /* 当前评估缺陷 */
    s += '<circle cx="' + sx(S.L) + '" cy="' + sy(S.d) + '" r="7" fill="none" stroke="#a37b2f" stroke-width="2"/>';
    s += '<circle cx="' + sx(S.L) + '" cy="' + sy(S.d) + '" r="3.4" fill="#a37b2f"/>';
    /* 轴标签 */
    s += '<text x="' + (SPL + SPW / 2) + '" y="' + (SH - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">缺陷长度 L (mm)</text>';
    s += '<text x="' + (SPL - 27) + '" y="' + (SPT + SPH / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (SPL - 27) + ' ' + (SPT + SPH / 2) + ')">缺陷深度 (%t)</text>';
    /* 边界注记（右下角安全区内，避开曲线与「维修区」标签） */
    s += '<text x="' + (SPL + SPW - 4) + '" y="' + (SPT + SPH - 19) + '" font-size="8.5" fill="#35765a" text-anchor="end" font-family="monospace">绿线 P_f = SF×P</text>';
    s += '<text x="' + (SPL + SPW - 4) + '" y="' + (SPT + SPH - 8) + '" font-size="8.5" fill="#a85147" text-anchor="end" font-family="monospace">红线 P_f = 1.1×P</text>';
    svg.innerHTML = s;
  }
  function bindScatter() {
    var svg = $('scatter'), tip = $('scat-tip'), box = $('scat-box');
    function nearest(lx, ly) {
      var best = -1, bd = 1e9;
      SCAT.forEach(function (p, i) {
        var dx = sx(p.L) - lx, dy = sy(p.d) - ly;
        var nd = dx * dx + dy * dy;
        if (nd < bd) { bd = nd; best = i; }
      });
      return bd <= 14 * 14 ? best : -1;
    }
    function logical(evt) {
      var r = svg.getBoundingClientRect();
      return { x: (evt.clientX - r.left) * (SW / r.width), y: (evt.clientY - r.top) * (SH / r.height) };
    }
    svg.addEventListener('mousemove', function (evt) {
      var p = logical(evt), i = nearest(p.x, p.y);
      if (i >= 0) {
        var d = SCAT[i], z = zoneOf(d.d, d.L);
        var zn = ['安全', '监测', '维修'][z];
        showTip(tip, box, '缺陷 L=<b>' + Math.round(d.L) + '</b> mm · d=<b>' + Math.round(d.d) + '</b>%t' +
          '<br>P_f = <b>' + b31g(d.d / 100, d.L, S.t).toFixed(2) + '</b> MPa · 判定【' + zn + '】' +
          '<br><span style="color:#8a9298">点击载入该缺陷</span>', evt);
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    svg.addEventListener('click', function (evt) {
      var p = logical(evt), i = nearest(p.x, p.y);
      if (i >= 0) {
        var d = SCAT[i];
        S.d = Math.round(d.d); S.L = clamp(Math.round(d.L / 5) * 5, 20, 400);
        SELECTED = -1;
        syncSliders(); render();
      }
    });
  }

  /* ================= 面板 ⑤：指标卡 + 剩余寿命 ================= */
  function calcCurrent() {
    var ratio = S.d / 100;
    var pf0 = b31g(ratio, S.L, S.t);
    var pfm = b31gMod(ratio, S.L, S.t);
    var pfd = dnvF(ratio, S.L, S.t);
    var life = lifeOf(ratio, S.L, S.cr, S.t, S.sf * S.p);
    return { pf0: pf0, pfm: pfm, pfd: pfd, life: life, sfAct: pf0 / S.p };
  }
  function renderMetrics(r) {
    var thr = S.sf * S.p;
    $('m-b31g').innerHTML = r.pf0.toFixed(2) + '<small> MPa</small>';
    $('m-b31g').parentNode.className = 'mcard' + (r.pf0 < 1.1 * S.p ? ' bad' : (r.pf0 < thr ? ' warn' : ''));
    $('m-mod').innerHTML = r.pfm.toFixed(2) + '<small> MPa</small>';
    $('m-dnv').innerHTML = r.pfd.toFixed(2) + '<small> MPa</small>';
    $('m-sf').innerHTML = r.sfAct.toFixed(2) + '<small> / ' + S.sf.toFixed(2) + '</small>';
    $('m-sf').parentNode.className = 'mcard' + (r.sfAct < 1.1 ? ' bad' : (r.sfAct < S.sf ? ' warn' : ''));
    if (r.life === Infinity) {
      $('m-life').innerHTML = '&gt;' + S.horizon + '<small> a</small>';
      $('m-life').parentNode.className = 'mcard';
    } else {
      $('m-life').innerHTML = r.life.toFixed(1) + '<small> a</small>';
      $('m-life').parentNode.className = 'mcard' + (r.life < 2 ? ' bad' : (r.life < 5 ? ' warn' : ''));
    }
  }
  var LW = 450, LH = 158, LPL = 46, LPR = 10, LPT = 12, LPB = 26;
  var LPW = LW - LPL - LPR, LPH = LH - LPT - LPB;
  function drawLife(r) {
    var svg = $('life');
    var horizon = S.horizon;
    var pfEnd = b31g(Math.min(0.95, S.d / 100 + S.cr * horizon / S.t), S.L, S.t);
    var yHi = Math.ceil(Math.max(r.pf0, S.sf * S.p, S.p) * 1.06 * 2) / 2;
    var yLo = Math.max(0, Math.floor(Math.min(pfEnd, S.p) * 0.88 * 2) / 2);
    function xp(yr) { return LPL + yr / horizon * LPW; }
    function yp(v) { return LPT + LPH - (v - yLo) / (yHi - yLo) * LPH; }
    var s = '<rect width="' + LW + '" height="' + LH + '" fill="#fdfcf9"/>';
    var span = yHi - yLo, step = span > 8 ? 2 : (span > 4 ? 1 : 0.5);
    var gv;
    for (gv = Math.ceil(yLo / step) * step; gv <= yHi; gv += step) {
      s += '<line x1="' + LPL + '" y1="' + yp(gv) + '" x2="' + (LPL + LPW) + '" y2="' + yp(gv) + '" stroke="#efece1"/>';
      s += '<text x="' + (LPL - 5) + '" y="' + (yp(gv) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gv.toFixed(step < 1 ? 1 : 0) + '</text>';
    }
    var xStep = horizon <= 10 ? 2 : 5;
    for (var xt = 0; xt <= horizon; xt += xStep) {
      s += '<line x1="' + xp(xt) + '" y1="' + LPT + '" x2="' + xp(xt) + '" y2="' + (LPT + LPH) + '" stroke="#efece1"/>';
      s += '<text x="' + xp(xt) + '" y="' + (LPT + LPH + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + xt + '</text>';
    }
    /* 阈值线 */
    var ySF = yp(S.sf * S.p), yP = yp(S.p);
    s += '<line x1="' + LPL + '" y1="' + ySF + '" x2="' + (LPL + LPW) + '" y2="' + ySF + '" stroke="#c9a15a" stroke-width="1.3" stroke-dasharray="5 3"/>';
    s += '<text x="' + (LPL + 6) + '" y="' + (ySF - 4) + '" font-size="8.5" fill="#9a7a1c" font-family="monospace">SF×P = ' + (S.sf * S.p).toFixed(2) + '</text>';
    s += '<line x1="' + LPL + '" y1="' + yP + '" x2="' + (LPL + LPW) + '" y2="' + yP + '" stroke="#b05a51" stroke-width="1.3" stroke-dasharray="5 3"/>';
    s += '<text x="' + (LPL + 6) + '" y="' + (yP + 12) + '" font-size="8.5" fill="#b05a51" font-family="monospace">P = ' + S.p.toFixed(2) + '</text>';
    /* 退化曲线 */
    var line = '', yr, ratio;
    for (var i = 0; i <= 60; i++) {
      yr = i / 60 * horizon;
      ratio = S.d / 100 + S.cr * yr / S.t;
      if (ratio > 0.95) break;
      line += (i ? 'L' : 'M') + xp(yr).toFixed(1) + ' ' + yp(b31g(ratio, S.L, S.t)).toFixed(1) + ' ';
    }
    s += '<path d="' + line + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';
    /* 剩余寿命交点 */
    if (r.life === 0) {
      s += '<text x="' + (LPL + LPW / 2) + '" y="' + (LPT + 12) + '" font-size="9.5" fill="#a85147" text-anchor="middle" font-weight="600">当前已不满足安全系数要求，立即维修</text>';
    } else if (r.life === Infinity || r.life > horizon) {
      s += '<text x="' + (LPL + LPW / 2) + '" y="' + (LPT + 12) + '" font-size="9.5" fill="#35765a" text-anchor="middle">预测窗口 ' + horizon + ' a 内 P_f 始终高于 SF×P</text>';
    } else {
      var cx = clamp(xp(r.life), LPL + 34, LPL + LPW - 34);
      s += '<line x1="' + xp(r.life) + '" y1="' + LPT + '" x2="' + xp(r.life) + '" y2="' + (LPT + LPH) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 3"/>';
      s += '<circle cx="' + xp(r.life) + '" cy="' + ySF + '" r="4.5" fill="#c9a15a" stroke="#fff" stroke-width="1.4"/>';
      s += '<text x="' + cx + '" y="' + (ySF - 8) + '" font-size="9" fill="#9a7a1c" text-anchor="middle" font-weight="600" font-family="monospace">剩余寿命 ' + r.life.toFixed(1) + ' a</text>';
    }
    s += '<text x="' + (LPL + LPW / 2) + '" y="' + (LH - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">年份 (a)</text>';
    s += '<text x="' + (LPL - 32) + '" y="' + (LPT + LPH / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (LPL - 32) + ' ' + (LPT + LPH / 2) + ')">失效压力 (MPa)</text>';
    svg.innerHTML = s;
  }
  function renderVerdict(r) {
    var v = $('verdict');
    var head = '当前缺陷 d=<b>' + S.d + '</b>%t · L=<b>' + S.L + '</b> mm（t=' + S.t.toFixed(1) + ' mm · P=' + S.p.toFixed(2) + ' MPa · SF=' + S.sf.toFixed(2) + '）：B31G P_f=<b>' + r.pf0.toFixed(2) + '</b> MPa，安全阈值 SF×P=<b>' + (S.sf * S.p).toFixed(2) + '</b> MPa；';
    var lifeTxt = r.life === Infinity || r.life > S.horizon ? '剩余寿命超过 ' + S.horizon + ' a 预测窗口' : '剩余寿命约 <b>' + r.life.toFixed(1) + '</b> a';
    if (r.pf0 < 1.1 * S.p) {
      v.className = 'verdict bad';
      v.innerHTML = head + '失效压力低于 1.1 倍运行压力，判定【<b>立即维修</b>】：安排补强或换管，开挖复核实测尺寸后回填模型。';
    } else if (r.pf0 < S.sf * S.p) {
      v.className = 'verdict warn';
      v.innerHTML = head + '未满足安全系数要求，' + lifeTxt + '，判定【<b>开挖复核</b>】：复核深度与长度后更新评估，按结果编维修计划。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '满足安全系数要求，' + lifeTxt + '，判定【<b>监测</b>】：纳入下次内检测比对，跟踪增长率后验。';
    }
  }

  /* ================= 面板 ⑥：维修优先级排序 ================= */
  function judgeOf(margin) {
    if (margin < 1) return ['立即维修', 'bad'];
    if (margin < 1.15) return ['开挖复核', 'warn'];
    return ['监测', 'ok'];
  }
  function renderTable() {
    var rows = DEFECTS.map(function (d, i) {
      var pf = b31g(d.dPct / 100, d.L, S.t);
      var margin = pf / (S.sf * S.p);
      var life = lifeOf(d.dPct / 100, d.L, d.cr, S.t, S.sf * S.p);
      return { i: i, d: d, pf: pf, margin: margin, life: life, key: margin + Math.min(life, 60) / 200 };
    });
    rows.sort(function (a, b) { return a.key - b.key; });
    var top = rows.slice(0, 8);
    var html = '';
    top.forEach(function (r, k) {
      var j = judgeOf(r.margin);
      var lifeTxt = r.life === Infinity || r.life > 55 ? '&gt;55' : r.life.toFixed(1);
      html += '<tr data-i="' + r.i + '"' + (r.i === SELECTED ? ' class="sel"' : '') + '>' +
        '<td class="num">' + (k + 1) + '</td>' +
        '<td class="num">' + r.d.id + '</td>' +
        '<td class="num">' + kmStr(r.d.km) + '</td>' +
        '<td>' + clockStr(r.d.deg) + '</td>' +
        '<td class="num">' + r.d.dPct + '%t</td>' +
        '<td class="num">' + r.d.L + '</td>' +
        '<td class="num">' + r.pf.toFixed(2) + '</td>' +
        '<td class="num">' + lifeTxt + '</td>' +
        '<td><span class="pri ' + j[1] + '">' + j[0] + '</span></td></tr>';
    });
    var body = $('repair-body');
    body.innerHTML = html;
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () { selectDefect(+tr.getAttribute('data-i')); });
    });
  }

  /* ================= 状态同步 ================= */
  function updateSelNote() {
    var n = $('sel-note');
    if (SELECTED >= 0) {
      var d = DEFECTS[SELECTED];
      n.innerHTML = '当前评估缺陷：<b>' + d.id + '</b> · ' + kmStr(d.km) + ' · 环向 ' + Math.round(d.deg) + '°（' + clockStr(d.deg) + '）· ' + d.type + ' · CR≈' + d.cr.toFixed(2) + ' mm/a';
    } else {
      n.textContent = '当前评估缺陷：自定义参数（点击热力图 / 散点 / 表格可载入真实缺陷）';
    }
  }
  function selectDefect(i) {
    var d = DEFECTS[i];
    S.d = clamp(Math.round(d.dPct), 5, 80);
    S.L = clamp(Math.round(d.L / 5) * 5, 20, 400);
    S.cr = clamp(Math.round(d.cr * 100) / 100, 0.02, 0.6);
    SELECTED = i;
    syncSliders(); render();
  }
  var KEYS = ['t', 'p', 'sf', 'd', 'L', 'cr', 'horizon'];
  var OUT = {
    t: function (v) { return v.toFixed(1) + ' mm'; },
    p: function (v) { return v.toFixed(2) + ' MPa'; },
    sf: function (v) { return v.toFixed(2); },
    d: function (v) { return v + ' %t'; },
    L: function (v) { return v + ' mm'; },
    cr: function (v) { return v.toFixed(2) + ' mm/a'; },
    horizon: function (v) { return v + ' a'; }
  };
  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }
  function render() {
    drawHeat();
    drawMfl();
    drawScatter();
    var r = calcCurrent();
    renderMetrics(r);
    drawLife(r);
    renderVerdict(r);
    renderTable();
    updateSelNote();
  }
  function bindControls() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        SELECTED = -1;
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      KEYS.forEach(function (k) { S[k] = DEF[k]; });
      SELECTED = -1;
      syncSliders(); render();
    });
  }

  /* ================= 真实数据页 ①：三准则对比 ================= */
  function drawLitA() {
    var svg = $('lit-chartA'); if (!svg) return;
    var W = 900, H = 240, PL = 56, PR = 16, PT = 32, PB = 42;
    var pw = W - PL - PR, ph = H - PT - PB, Y1 = 16;
    var RT = 10.3;
    var bars = [
      { name: '完好管段', v: b31g(0, 200, RT), c: '#8a9298', tip: 'P = 1.1×SMYS×2t/D = 1.1×483×20.6/813 = <b>13.47 MPa</b>' },
      { name: 'B31G-2012 原式', v: b31g(0.5, 200, RT), c: '#2f7d6b', tip: 'z=4.78 → M=2.196；a=2d/3t=0.333；P_f=1.1·SMYS·(2t/D)·(1−a)/(1−a/M) = <b>10.59 MPa</b>' },
      { name: 'RSTRENG 0.85dL', v: b31gMod(0.5, 200, RT), c: '#c9a15a', tip: 'M=1.976；流变应力 SMYS+69=552 MPa；a=0.85d/t；P_f = <b>10.25 MPa</b>' },
      { name: 'DNV RP-F101', v: dnvF(0.5, 200, RT), c: '#41699b', tip: 'Q=√(1+0.31z)=1.575；P_f=(2t·UTS/(D−t))·(1−d/t)/(1−(d/t)/Q) = <b>10.72 MPa</b>' }
    ];
    function yOf(v) { return PT + (Y1 - v) / Y1 * ph; }
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';
    for (var m = 0; m <= Y1; m += 2) {
      s += '<line x1="' + PL + '" y1="' + yOf(m) + '" x2="' + (W - PR) + '" y2="' + yOf(m) + '" stroke="' + (m ? '#f1ebdd' : '#d8d0bc') + '" stroke-width="1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yOf(m) + 3) + '" font-size="9" fill="#8a9298" text-anchor="end" font-family="monospace">' + m + '</text>';
    }
    /* 安全阈值线 */
    var yT = yOf(10.008);
    s += '<line x1="' + PL + '" y1="' + yT + '" x2="' + (W - PR) + '" y2="' + yT + '" stroke="#b05a51" stroke-width="1.3" stroke-dasharray="6 3"/>';
    s += '<text x="' + (W - PR - 2) + '" y="' + (yT - 4) + '" font-size="9" fill="#b05a51" text-anchor="end" font-family="monospace">10.0</text>';
    /* 柱条 */
    var bw = 120;
    bars.forEach(function (b, i) {
      var cx = PL + pw * (i + 0.5) / bars.length;
      var y = yOf(b.v);
      s += '<rect data-i="' + i + '" x="' + (cx - bw / 2) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + (PT + ph - y).toFixed(1) + '" rx="3" fill="' + b.c + '" opacity="0.82" style="cursor:pointer"/>';
      s += '<text x="' + cx + '" y="' + (y - 6) + '" font-size="10" fill="#3d464b" text-anchor="middle" font-family="monospace" font-weight="600">' + b.v.toFixed(2) + '</text>';
      s += '<text x="' + cx + '" y="' + (PT + ph + 16) + '" font-size="9.5" fill="#79828a" text-anchor="middle">' + b.name + '</text>';
    });
    s += '<text x="' + (PL + 4) + '" y="' + 16 + '" font-size="9" fill="#8a9298">基准缺陷：d=50%t · L=200 mm · t=10.3 mm · D=813 mm · X70（SMYS 483 / UTS 565 MPa）· 运行 7.2 MPa；红色虚线 = 安全阈值 SF×MAOP = 1.39×7.2 = 10.0 MPa</text>';
    s += '<text x="' + 14 + '" y="' + (PT + ph / 2) + '" font-size="9.5" fill="#79828a" text-anchor="middle" transform="rotate(-90 14 ' + (PT + ph / 2) + ')">失效压力 (MPa)</text>';
    svg.innerHTML = s;
    svg.__bars = bars;
  }
  function bindLitA() {
    var svg = $('lit-chartA'), tip = $('lit-tipA'), box = $('lit-boxA');
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (900 / r.width);
      var bars = svg.__bars || [];
      var k = Math.floor((vx - 56) / (900 - 56 - 16) * bars.length);
      if (k >= 0 && k < bars.length) {
        showTip(tip, box, '<b>' + bars[k].name + '</b><br>' + bars[k].tip, evt);
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= 真实数据页 ②：ILI 测深精度 parity ================= */
  function drawLitB() {
    var svg = $('lit-chartB'); if (!svg) return;
    var W = 900, H = 240, PL = 52, PR = 16, PT = 26, PB = 38;
    var pw = W - PL - PR, ph = H - PT - PB, MAX = 80;
    var rng = mulberry32(2024), pts = [], inside = 0;
    for (var i = 0; i < 40; i++) {
      var tr = 8 + rng() * 60;
      var rep = clamp(tr + gauss(rng) * 3.6, 2, 78);
      if (Math.abs(rep - tr) <= 10) inside++;
      pts.push({ tr: tr, rep: rep });
    }
    function xOf(v) { return PL + v / MAX * pw; }
    function yOf(v) { return PT + (MAX - v) / MAX * ph; }
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';
    for (var g = 0; g <= MAX; g += 10) {
      s += '<line x1="' + xOf(g) + '" y1="' + PT + '" x2="' + xOf(g) + '" y2="' + (PT + ph) + '" stroke="#f1ebdd"/>';
      s += '<text x="' + xOf(g) + '" y="' + (PT + ph + 14) + '" font-size="9" fill="#8a9298" text-anchor="middle" font-family="monospace">' + g + '</text>';
      if (g > 0) s += '<line x1="' + PL + '" y1="' + yOf(g) + '" x2="' + (W - PR) + '" y2="' + yOf(g) + '" stroke="#f1ebdd"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yOf(g) + 3) + '" font-size="9" fill="#8a9298" text-anchor="end" font-family="monospace">' + g + '</text>';
    }
    /* ±10%t 带 */
    var band = 'M' + xOf(0) + ' ' + yOf(10) + ' L' + xOf(70) + ' ' + yOf(80) + ' L' + xOf(80) + ' ' + yOf(80) +
      ' L' + xOf(80) + ' ' + yOf(70) + ' L' + xOf(10) + ' ' + yOf(0) + ' L' + xOf(0) + ' ' + yOf(0) + ' Z';
    s += '<path d="' + band + '" fill="rgba(201,161,90,0.10)" stroke="none"/>';
    s += '<line x1="' + xOf(0) + '" y1="' + yOf(0) + '" x2="' + xOf(80) + '" y2="' + yOf(80) + '" stroke="#79828a" stroke-width="1.2"/>';
    s += '<line x1="' + xOf(0) + '" y1="' + yOf(10) + '" x2="' + xOf(70) + '" y2="' + yOf(80) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<line x1="' + xOf(10) + '" y1="' + yOf(0) + '" x2="' + xOf(80) + '" y2="' + yOf(70) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + xOf(58) + '" y="' + yOf(73.5) + '" font-size="9" fill="#9a7a1c" font-family="monospace">+10%t</text>';
    s += '<text x="' + xOf(70) + '" y="' + yOf(58) + '" font-size="9" fill="#9a7a1c" font-family="monospace">−10%t</text>';
    /* 散点 */
    pts.forEach(function (p, i) {
      s += '<circle data-i="' + i + '" cx="' + xOf(p.tr).toFixed(1) + '" cy="' + yOf(p.rep).toFixed(1) + '" r="4.5" fill="#41699b" opacity="0.75" style="cursor:pointer"/>';
    });
    s += '<text x="' + (PL + 4) + '" y="' + 15 + '" font-size="9" fill="#8a9298">40 个示意开挖验证点 · ' + inside + '/40 落于 ±10%t 带内（规格引自 API 1163:2021：±10%t 容差 @ 80% 置信）</text>';
    s += '<text x="' + (PL + pw / 2) + '" y="' + (H - 4) + '" font-size="9.5" fill="#79828a" text-anchor="middle">开挖实测深度（%t，超声测厚 ±0.1 mm）</text>';
    s += '<text x="' + 13 + '" y="' + (PT + ph / 2) + '" font-size="9.5" fill="#79828a" text-anchor="middle" transform="rotate(-90 13 ' + (PT + ph / 2) + ')">ILI 报告深度 (%t)</text>';
    svg.innerHTML = s;
    svg.__pts = pts;
  }
  function bindLitB() {
    var svg = $('lit-chartB'), tip = $('lit-tipB'), box = $('lit-boxB');
    if (!svg || !tip || !box) return;
    var PL = 52, PR = 16, PT = 26, PB = 38, MAX = 80;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (900 / r.width);
      var ly = (evt.clientY - r.top) * (240 / r.height);
      var pts = svg.__pts || [];
      var best = -1, bd = 1e9;
      pts.forEach(function (p, i) {
        var px = PL + p.tr / MAX * (900 - PL - PR);
        var py = PT + (MAX - p.rep) / MAX * (240 - PT - PB);
        var nd = (px - lx) * (px - lx) + (py - ly) * (py - ly);
        if (nd < bd) { bd = nd; best = i; }
      });
      if (best >= 0 && bd <= 15 * 15) {
        var p = pts[best], diff = p.rep - p.tr;
        showTip(tip, box, '开挖实测 <b>' + p.tr.toFixed(1) + '</b>%t · ILI 报告 <b>' + p.rep.toFixed(1) + '</b>%t' +
          '<br>偏差 ' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%t · ' + (Math.abs(diff) <= 10 ? '带内' : '超出 ±10%t 带'), evt);
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= 页签 ================= */
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

  /* ================= 初始化 ================= */
  bindTabs();
  bindControls();
  bindHeat();
  bindMfl();
  bindScatter();
  syncSliders();
  render();
  drawLitA(); bindLitA();
  drawLitB(); bindLitB();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawHeat(); drawMfl(); }, 120);
  });
})();
