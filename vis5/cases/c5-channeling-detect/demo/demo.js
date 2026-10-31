/* ======= 环空窜槽识别 · 顶替效率与气窜风险 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* 固定种子噪声场：保证同一参数下成像图完全可复现 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261030);
  var AZ = 360, DP = 120;
  var noise = new Float32Array(AZ * DP);
  for (var i = 0; i < noise.length; i++) noise[i] = rnd();

  var DEF = {
    ecc: 25, start: 45, len: 80, w: 8,
    contact: 12, q: 2.5, yp: 8, act: '1',
    mic: 30, pg: 28, sgs: 45, woc: 24
  };
  var S = Object.assign({}, DEF);

  /* ===== 邻接环节参数联动（固井工作流共享，key=cementing-shared）===== */
  var SHARED_KEY = 'cementing-shared';
  var KEY_MAP = {
    eccentricity: 'ecc',  // 偏心 %
    flowRate: 'q'         // 排量 m³/min
  };
  var MY_KEYS = Object.keys(KEY_MAP);
  function loadShared(){ try{ var s=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}'); var n=0; MY_KEYS.forEach(function(k){ if(k in s && typeof s[k]==='number'){ S[KEY_MAP[k]]=s[k]; n++; } }); return n; }catch(e){ return 0; } }
  function saveShared(){ var cur={}; try{ cur=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}'); }catch(e){} MY_KEYS.forEach(function(k){ if(typeof S[KEY_MAP[k]]==='number') cur[k]=S[KEY_MAP[k]]; }); localStorage.setItem(SHARED_KEY,JSON.stringify(cur)); }

  /* 固定井段参数 */
  var DEPTH_TOP = 1200, DEPTH_BOT = 1500;
  var RHO_CEMENT = 1.90; /* g/cm³ */
  var G = 9.81;
  var PH = RHO_CEMENT * G * DEPTH_BOT / 1000; /* 水泥浆静液柱压力 MPa */
  var RW_M = 0.105; /* 环空平均半径 m */

  /* ---------- 活动加成 ---------- */
  function actBonus(act) {
    if (act === '1') return 0.08;  /* 旋转 */
    if (act === '2') return 0.05;  /* 往复 */
    return 0;                      /* 静止 */
  }

  /* ---------- 顶替效率模型 ----------
     η = 0.55 + 0.3·(1−e^(−接触_eff/10)) + 0.1·(1−偏心) + 活动加成
     接触_eff 由排量与屈服值修正 */
  function etaAt(contact, q, yp, ecc, act) {
    var flowFactor = clamp(0.45 + 0.55 * q / 3.0, 0.3, 1.8);
    var yieldFactor = clamp(1 - 0.014 * Math.max(0, yp - 5), 0.35, 1.0);
    var ce = contact * flowFactor * yieldFactor;
    var eta = 0.55 + 0.3 * (1 - Math.exp(-ce / 10)) + 0.1 * (1 - ecc / 100) + actBonus(act);
    return clamp(eta, 0.1, 0.98);
  }
  function currentEta() { return etaAt(S.contact, S.q, S.yp, S.ecc, S.act); }

  /* 残留泥浆弧长 = (1−η)·360·(1+偏心/50) */
  function residualAngle(eta, ecc) {
    if (typeof ecc === 'undefined') ecc = S.ecc;
    return (1 - eta) * 360 * (1 + ecc / 50);
  }

  /* 窜槽概率 = sigmoid((残留弧长−120)/40) */
  function pChannel(ang) {
    return clamp(1 / (1 + Math.exp(-((ang - 120) / 40))), 0.01, 0.99);
  }

  /* 通道面积 (m²) */
  function channelArea(s) {
    s = s || S;
    var arcFrac = s.len / 360;
    var main = arcFrac * 2 * Math.PI * RW_M * (s.w / 1000);
    var micro = (s.mic / 1e6) * 2 * Math.PI * RW_M * (s.mic > 0 ? 1 : 0);
    return main + micro;
  }

  /* 气窜驱动力 (MPa) */
  function underbalance(s) {
    s = s || S;
    return s.pg - PH; /* >0 表示欠平衡 */
  }

  /* 气窜体积随时间累积 (m³) */
  function gasVolumeAt(s, hours) {
    s = s || S;
    var dP = underbalance(s);
    if (dP <= 0) return 0;
    var eta = etaAt(s.contact, s.q, s.yp, s.ecc, s.act);
    var ang = residualAngle(eta, s.ecc);
    var pCh = pChannel(ang);
    var A = channelArea(s);
    /* SGS 过渡期内气体可窜流，候凝超过过渡期后水泥胶结，流量衰减 */
    var sgs_h = s.sgs / 60;
    var dt = 0.25;
    var vol = 0;
    for (var t = dt; t <= hours + 1e-9; t += dt) {
      var flowFactor = 1 / (1 + Math.exp((t - sgs_h) / 0.4));
      var rate = 2.5 * A * 1e4 * Math.pow(dP, 0.85) * flowFactor * (0.3 + pCh);
      vol += rate * dt;
    }
    return vol;
  }

  /* 气窜风险指数 (0-100) */
  function gasRiskIndex(s, hours) {
    s = s || S;
    var eta = etaAt(s.contact, s.q, s.yp, s.ecc, s.act);
    var ang = residualAngle(eta, s.ecc);
    var pCh = pChannel(ang);
    var dP = underbalance(s);
    var vol = gasVolumeAt(s, hours);
    var sgs_h = s.sgs / 60;
    var inWindow = hours < sgs_h * 2 ? 1 : Math.exp(-(hours - sgs_h * 2) / 4);
    var risk = pCh * 100 * clamp(dP / 4, 0, 1) * (0.3 + 0.7 * inWindow);
    risk += clamp(vol * 8, 0, 30);
    return clamp(risk, 0, 100);
  }

  /* 统一计算入口：给定状态返回顶替效率/窜槽概率/气窜风险指数 */
  function compute(s) {
    s = s || S;
    var eta = etaAt(s.contact, s.q, s.yp, s.ecc, s.act);
    var ang = residualAngle(eta, s.ecc);
    var pCh = pChannel(ang);
    var risk = gasRiskIndex(s, s.woc);
    return { eta: eta, ang: ang, pCh: pCh, risk: risk };
  }

  /* ---------- 热力图配色：窜槽区亮、水泥区暗 ---------- */
  function heatColor(amp) {
    /* amp: 0=暗(水泥好) -> 1=亮(窜槽) */
    var a = clamp(amp, 0, 1);
    var dark = [30, 40, 55];      /* 暗蓝灰：水泥胶结好 */
    var mid = [120, 130, 110];
    var bright = [245, 225, 140]; /* 亮黄：窜槽通道 */
    var c;
    if (a < 0.5) {
      var t = a / 0.5;
      c = [dark[0] + (mid[0] - dark[0]) * t, dark[1] + (mid[1] - dark[1]) * t, dark[2] + (mid[2] - dark[2]) * t];
    } else {
      var u = (a - 0.5) / 0.5;
      c = [mid[0] + (bright[0] - mid[0]) * u, mid[1] + (bright[1] - mid[1]) * u, mid[2] + (bright[2] - mid[2]) * u];
    }
    return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
  }

  function inChannel(angleDeg, ang) {
    var a = ((angleDeg % 360) + 360) % 360;
    var d = Math.min(a, 360 - a);
    return d <= ang / 2 + 0.6;
  }

  /* ---------- 面板 1a：环空截面 ---------- */
  function drawCross() {
    var svg = $('cross');
    var RW = 112, RC = 60, off = S.ecc / 100 * 22;
    var cx = 150 + off, cy = 150;
    var eta = currentEta(), ang = residualAngle(eta);
    var effAng = Math.min(360, ang * 0.6 + S.len * 0.4);
    var s = '<rect width="300" height="300" fill="#fdfcf9"/>';
    s += '<circle cx="150" cy="150" r="' + RW + '" fill="#f1eee5" stroke="#cfc7b6" stroke-width="1.2"/>';

    function rayT(a) {
      var dx = Math.cos(a), dy = Math.sin(a);
      var ex = cx - 150, ey = cy - 150;
      var b = 2 * (ex * dx + ey * dy);
      var c = ex * ex + ey * ey - RW * RW;
      var disc = b * b - 4 * c;
      return (-b + Math.sqrt(Math.max(0, disc))) / 2;
    }

    for (var d = 0; d < 360; d += 3) {
      var a0 = (d - 1.5) * Math.PI / 180, a1 = (d + 1.5) * Math.PI / 180;
      var t0 = rayT(a0), t1 = rayT(a1);
      var thick = Math.max(0, t0 - RC);
      var ch = inChannel(d, effAng);
      var col = ch ? '#c9a15a' : '#2f7d6b';
      var op = ch ? 0.95 : clamp(0.35 + thick / 90, 0.35, 0.8);
      var p = '';
      p += (cx + RC * Math.cos(a0)).toFixed(1) + ',' + (cy + RC * Math.sin(a0)).toFixed(1) + ' ';
      p += (cx + t0 * Math.cos(a0)).toFixed(1) + ',' + (cy + t0 * Math.sin(a0)).toFixed(1) + ' ';
      p += (cx + t1 * Math.cos(a1)).toFixed(1) + ',' + (cy + t1 * Math.sin(a1)).toFixed(1) + ' ';
      p += (cx + RC * Math.cos(a1)).toFixed(1) + ',' + (cy + RC * Math.sin(a1)).toFixed(1);
      s += '<polygon points="' + p + '" fill="' + col + '" opacity="' + op.toFixed(2) + '"/>';
    }

    /* 微环隙：套管-水泥界面整圈缝隙 */
    if (S.mic > 1) {
      var mop = clamp(0.15 + 0.7 * (S.mic / 500), 0.15, 0.85);
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (RC + 1.8) + '" fill="none" stroke="#b05a51" stroke-width="2.2" stroke-dasharray="3 2" opacity="' + mop.toFixed(2) + '"/>';
    }

    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + RC + '" fill="#4d565b" stroke="#242b2e" stroke-width="1.3"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (RC * 0.86) + '" fill="#efece3"/>';

    if (off > 1) {
      s += '<line x1="150" y1="150" x2="' + cx + '" y2="150" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 2"/>';
      s += '<text x="' + ((150 + cx) / 2) + '" y="144" font-size="9" fill="#8a9298" text-anchor="middle" font-family="monospace">e=' + S.ecc + '%</text>';
    }

    [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']].forEach(function (tk) {
      var a = tk[0] * Math.PI / 180;
      var x1 = 150 + RW * Math.cos(a), y1 = 150 + RW * Math.sin(a);
      var x2 = 150 + (RW + 8) * Math.cos(a), y2 = 150 + (RW + 8) * Math.sin(a);
      s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#8a9298" stroke-width="1"/>';
      var lx = 150 + (RW + 16) * Math.cos(a), ly = 150 + (RW + 16) * Math.sin(a) + 3;
      s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" font-size="9" fill="#8a9298" text-anchor="middle" font-family="monospace">' + tk[1] + '</text>';
    });

    s += '<text x="8" y="16" font-size="10" fill="#c9a15a" font-family="monospace">通道 ' + effAng.toFixed(0) + '° · 宽 ' + S.w.toFixed(1) + ' mm</text>';
    if (S.mic > 1) s += '<text x="8" y="30" font-size="10" fill="#b05a51" font-family="monospace">微环隙 ' + S.mic + ' μm</text>';
    s += '<text x="150" y="291" font-size="9.5" fill="#8a9298" text-anchor="middle">偏心方向 0° · 井眼 Ø220 mm · 套管 Ø177.8 mm</text>';
    svg.innerHTML = s;
  }

  /* ---------- 面板 1b：展开式超声成像 ---------- */
  function drawHeat() {
    var eta = currentEta(), ang = residualAngle(eta);
    var effAng = Math.min(360, ang * 0.6 + S.len * 0.4);
    var off = document.createElement('canvas');
    off.width = AZ; off.height = DP;
    var octx = off.getContext('2d');
    var img = octx.createImageData(AZ, DP);
    var micB = S.mic / 500;
    for (var y = 0; y < DP; y++) {
      var frac = y / (DP - 1) * 100;
      var inChannelZone = frac >= S.start;
      for (var x = 0; x < AZ; x++) {
        var n = noise[y * AZ + x];
        var amp = 0.12 + (n - 0.5) * 0.06; /* 水泥区暗 */
        if (inChannelZone && inChannel(x, effAng)) {
          amp = 0.88 + (n - 0.5) * 0.10; /* 窜槽区亮 */
        }
        if (S.mic > 3 && Math.abs(frac - (S.start + 2)) < 3) {
          amp = Math.max(amp, 0.6 + 0.35 * micB); /* 微环隙横线 */
        }
        var c = heatColor(amp);
        var k = (y * AZ + x) * 4;
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);

    var cv = $('heat'), ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height, IH = H - 28;
    var mapX = function (az) { return az / 360 * W; };
    var mapY = function (frac) { return frac / 100 * IH; };

    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, AZ, DP, 0, 0, W, IH);

    /* 通道轮廓 */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 4]);
    if (effAng > 0) {
      var half = Math.min(180, effAng / 2);
      var x1 = mapX(0), x2 = mapX(half);
      ctx.strokeRect(x1, mapY(S.start), Math.max(1.5, x2 - x1), IH - mapY(S.start));
      if (half < 180) {
        ctx.strokeRect(mapX(360 - half), mapY(S.start), Math.max(1.5, mapX(360) - mapX(360 - half)), IH - mapY(S.start));
      }
    }
    if (S.mic > 3) {
      ctx.strokeStyle = 'rgba(176,90,81,0.9)';
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(2, mapY(S.start + 2), W - 4, Math.max(3, mapY(6) - mapY(0)));
    }
    ctx.restore();

    /* 坐标标注 */
    ctx.fillStyle = '#5d666d';
    ctx.font = '11px Consolas, monospace';
    [0, 90, 180, 270, 360].forEach(function (az) {
      var tx = mapX(az);
      ctx.textAlign = az === 0 ? 'left' : (az === 360 ? 'right' : 'center');
      ctx.fillText(az + '°', tx, H - 8);
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(253,252,249,0.9)';
    ctx.fillRect(4, 3, 60, 14);
    ctx.fillRect(4, IH - 17, 60, 14);
    ctx.fillStyle = '#3a4145';
    ctx.fillText('1200 m', 7, 14);
    ctx.fillText('1500 m', 7, IH - 6);
    ctx.fillStyle = '#c9a15a';
    ctx.textAlign = 'right';
    ctx.fillText('窜槽通道', W - 6, 14);
    ctx.textAlign = 'left';
  }

  /* ---------- 面板 2a：顶替效率曲线 ---------- */
  function drawEff() {
    var W = 430, H = 200, pl = 34, pr = 40, pt = 12, pb = 24;
    var pw = W - pl - pr, ph = H - pt - pb;
    var eta = currentEta();
    var x = function (t) { return pl + t / 30 * pw; };
    var y = function (v) { return pt + ph - v / 100 * ph; };
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    [0, 25, 50, 75, 100].forEach(function (v) {
      s += '<line x1="' + pl + '" y1="' + y(v) + '" x2="' + (pl + pw) + '" y2="' + y(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 7) + '" y="' + (y(v) + 3) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    });
    [0, 6, 12, 18, 24, 30].forEach(function (t) {
      s += '<line x1="' + x(t) + '" y1="' + pt + '" x2="' + x(t) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(t) + '" y="' + (pt + ph + 15) + '" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + t + '</text>';
    });

    /* 10 min 建议线 */
    s += '<line x1="' + x(10) + '" y1="' + pt + '" x2="' + x(10) + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1.3" stroke-dasharray="4 3"/>';
    s += '<text x="' + (x(10) + 3) + '" y="' + (pt + 10) + '" font-size="9" fill="#c9a15a" font-family="monospace">建议 10 min</text>';

    var qs = [0.5, S.q, 3.0];
    var seen = [];
    qs.forEach(function (q) {
      var key = q.toFixed(2);
      if (seen.indexOf(key) >= 0) return;
      seen.push(key);
      var isMain = Math.abs(q - S.q) < 0.001;
      var d = '';
      for (var k = 0; k <= 60; k++) {
        var t = k / 60 * 30;
        var v = etaAt(t, q, S.yp, S.ecc, S.act) * 100;
        d += (k ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + (isMain ? '#2f7d6b' : '#b9c8c2') + '" stroke-width="' + (isMain ? 2.4 : 1.2) + '"/>';
      var vEnd = etaAt(30, q, S.yp, S.ecc, S.act) * 100;
      s += '<text x="' + (x(30) - 2) + '" y="' + (y(vEnd) - 3) + '" font-size="9" fill="' + (isMain ? '#2f7d6b' : '#9ba3a9') + '" text-anchor="end" font-family="monospace">' + q.toFixed(1) + '</text>';
    });

    /* 当前点 */
    var cx = x(S.contact), cy = y(eta * 100);
    s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.5" fill="#2f7d6b" stroke="#fff" stroke-width="1.6"/>';
    s += '<text x="' + cx.toFixed(1) + '" y="' + (cy - 9) + '" font-size="10" fill="#235f51" text-anchor="middle" font-weight="600" font-family="monospace">' + (eta * 100).toFixed(1) + '%</text>';

    s += '<text x="' + (pl - 28) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 28) + ' ' + (pt + ph / 2) + ')">顶替效率 (%)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">隔离液接触时间 (min)</text>';
    $('eff').innerHTML = s;
  }

  /* ---------- 面板 2b：气窜风险曲线 ---------- */
  function niceMax(v) {
    var p = Math.pow(10, Math.floor(Math.log10(Math.max(0.01, v))));
    var n = v / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  function drawRisk() {
    var W = 430, H = 200, pl = 40, pr = 32, pt = 12, pb = 24;
    var pw = W - pl - pr, ph = H - pt - pb;
    var sgs_h = S.sgs / 60;
    var pts = [];
    var maxV = 0;
    for (var t = 0; t <= 72; t += 0.5) {
      var vol = gasVolumeAt(S, t);
      var risk = gasRiskIndex(S, t);
      pts.push([t, vol, risk]);
      if (vol > maxV) maxV = vol;
    }
    var vMax = Math.max(0.05, niceMax(maxV * 1.2));
    var curVol = gasVolumeAt(S, S.woc);
    var curRisk = gasRiskIndex(S, S.woc);
    var x = function (hh) { return pl + hh / 72 * pw; };
    var yV = function (v) { return pt + ph - v / vMax * ph; };
    var yR = function (r) { return pt + ph - r / 100 * ph; };
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    [0, 25, 50, 75, 100].forEach(function (r) {
      s += '<line x1="' + pl + '" y1="' + yR(r) + '" x2="' + (pl + pw) + '" y2="' + yR(r) + '" stroke="#efece1"/>';
      s += '<text x="' + (W - 3) + '" y="' + (yR(r) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + r + '</text>';
    });
    [0, 12, 24, 36, 48, 60, 72].forEach(function (hh) {
      s += '<line x1="' + x(hh) + '" y1="' + pt + '" x2="' + x(hh) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(hh) + '" y="' + (pt + ph + 15) + '" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + hh + '</text>';
    });
    [0, 0.5, 1].forEach(function (f) {
      var v = vMax * f / 2;
      s += '<text x="' + (pl - 6) + '" y="' + (yV(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v.toFixed(2) + '</text>';
    });

    /* SGS 敏感期阴影 */
    var xSgs = x(clamp(sgs_h * 2, 0, 72));
    s += '<rect x="' + pl + '" y="' + pt + '" width="' + (xSgs - pl) + '" height="' + ph + '" fill="#c9a15a" opacity="0.10"/>';
    s += '<line x1="' + xSgs + '" y1="' + pt + '" x2="' + xSgs + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + (xSgs + 3) + '" y="' + (pt + 10) + '" font-size="9" fill="#c9a15a" font-family="monospace">SGS 敏感期</text>';

    /* 累积气量曲线 */
    var area = '';
    for (var k = 0; k < pts.length; k++) area += (k ? 'L' : 'M') + x(pts[k][0]).toFixed(1) + ' ' + yV(pts[k][1]).toFixed(1) + ' ';
    area += 'L' + x(72) + ' ' + (pt + ph) + ' L' + x(0) + ' ' + (pt + ph) + ' Z';
    s += '<path d="' + area + '" fill="#2f7d6b" opacity="0.12"/>';
    var lineV = '', lineR = '';
    for (var j = 0; j < pts.length; j++) {
      lineV += (j ? 'L' : 'M') + x(pts[j][0]).toFixed(1) + ' ' + yV(pts[j][1]).toFixed(1) + ' ';
      lineR += (j ? 'L' : 'M') + x(pts[j][0]).toFixed(1) + ' ' + yR(pts[j][2]).toFixed(1) + ' ';
    }
    s += '<path d="' + lineV + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';
    s += '<path d="' + lineR + '" fill="none" stroke="#b05a51" stroke-width="1.8" stroke-dasharray="5 3"/>';

    /* 当前候凝时间 */
    var mx = x(S.woc);
    s += '<line x1="' + mx + '" y1="' + pt + '" x2="' + mx + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<circle cx="' + mx.toFixed(1) + '" cy="' + yV(curVol).toFixed(1) + '" r="3.8" fill="#2f7d6b" stroke="#fff" stroke-width="1.4"/>';
    s += '<circle cx="' + mx.toFixed(1) + '" cy="' + yR(curRisk).toFixed(1) + '" r="3.8" fill="#b05a51" stroke="#fff" stroke-width="1.4"/>';
    s += '<text x="' + mx.toFixed(1) + '" y="' + (pt + 10) + '" font-size="9" fill="#5d666d" text-anchor="middle" font-family="monospace">' + S.woc + ' h</text>';

    s += '<text x="' + (pl - 36) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 36) + ' ' + (pt + ph / 2) + ')">累积气量 (m³)</text>';
    s += '<text x="' + (W - 12) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (W - 12) + ' ' + (pt + ph / 2) + ')">风险指数</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">候凝时间 (h)</text>';
    $('risk').innerHTML = s;
  }

  /* ---------- 面板 3：指标卡 + 表格 + 判读 ---------- */
  function renderMetrics() {
    var eta = currentEta();
    var ang = residualAngle(eta);
    var pCh = pChannel(ang);
    var risk = gasRiskIndex(S, S.woc);
    var dP = underbalance();

    var etaEl = $('m-eta'), angEl = $('m-ang'), pEl = $('m-pch'), rEl = $('m-risk');
    etaEl.innerHTML = (eta * 100).toFixed(1) + '<small> %</small>';
    etaEl.parentNode.className = 'mcard' + (eta < 0.7 ? ' warn' : '');

    angEl.innerHTML = ang.toFixed(0) + '<small> °</small>';
    angEl.parentNode.className = 'mcard' + (ang > 180 ? ' bad' : ang > 120 ? ' warn' : '');

    pEl.innerHTML = (pCh * 100).toFixed(0) + '<small> %</small>';
    pEl.parentNode.className = 'mcard' + (pCh > 0.6 ? ' bad' : pCh > 0.4 ? ' warn' : '');

    rEl.innerHTML = risk.toFixed(0) + '<small> %</small>';
    rEl.parentNode.className = 'mcard' + (risk > 50 ? ' bad' : risk > 25 ? ' warn' : '');

    $('m-pch2').innerHTML = (pCh * 100).toFixed(0) + '<small> %</small>';
    $('m-pch2').parentNode.className = 'mcard' + (pCh > 0.6 ? ' bad' : pCh > 0.4 ? ' warn' : '');

    $('m-risk2').innerHTML = risk.toFixed(0) + '<small> %</small>';
    $('m-risk2').parentNode.className = 'mcard' + (risk > 50 ? ' bad' : risk > 25 ? ' warn' : '');

    $('m-ph').innerHTML = PH.toFixed(2) + '<small> MPa</small>';
    $('m-dp').innerHTML = (dP >= 0 ? '+' : '') + dP.toFixed(2) + '<small> MPa</small>';
    $('m-dp').parentNode.className = 'mcard' + (dP > 0 ? ' bad' : '');
  }

  function renderTable() {
    var eta = currentEta();
    var ang = residualAngle(eta);
    var pCh = pChannel(ang);
    var risk = gasRiskIndex(S, S.woc);
    var vol = gasVolumeAt(S, S.woc);
    var nSeg = 6, span = (DEPTH_BOT - DEPTH_TOP) / nSeg;
    var rows = [];

    for (var i = 0; i < nSeg; i++) {
      var top = DEPTH_TOP + i * span, bot = top + span;
      var frac = (i + 0.5) / nSeg * 100;
      var inZone = frac >= S.start;
      var n1 = noise[i * 47 + 7] - 0.5;
      rows.push({ top: top, bot: bot, frac: frac, inZone: inZone, n: n1 });
    }

    var html = '';
    rows.forEach(function (r) {
      var etaS = clamp(eta * (1 + r.n * 0.12), 0.1, 0.98);
      var angS = residualAngle(etaS);
      var pS = clamp(pCh * (r.inZone ? 1 : 0.12) * (1 + r.n * 0.18), 0.01, 0.99);
      var vS = vol * (r.inZone ? (0.8 + 0.3 * Math.abs(r.n)) : 0.05) / 4;

      var verdict, hot = false;
      if (r.inZone && pS > 0.55) { verdict = '窜槽通道'; hot = true; }
      else if (r.inZone) { verdict = '疑似通道'; hot = true; }
      else if (etaS < 0.7) verdict = '顶替不足';
      else verdict = '胶结良好';

      html += '<tr' + (hot ? ' class="hot"' : '') + '>';
      html += '<td class="mono">' + r.top + '—' + r.bot + '</td>';
      html += '<td class="mono">' + (etaS * 100).toFixed(1) + '%</td>';
      html += '<td class="mono">' + angS.toFixed(0) + '</td>';
      html += '<td class="mono">' + (pS * 100).toFixed(0) + '%</td>';
      html += '<td class="mono">' + vS.toFixed(3) + '</td>';
      html += '<td' + (verdict === '胶结良好' ? ' class="ok"' : '') + '>' + verdict + '</td>';
      html += '</tr>';
    });
    $('tbody').innerHTML = html;

    var v = $('verdict');
    var dP = underbalance();
    var head = '静液压力 <b>' + PH.toFixed(2) + '</b> MPa · 气层压力 <b>' + S.pg.toFixed(1) + '</b> MPa（ΔP = ' + (dP >= 0 ? '+' : '') + dP.toFixed(2) + ' MPa）；';
    var advice = '';
    if (dP <= 0) {
      v.className = 'verdict ok';
      advice = '环空压力高于气层压力，未形成欠平衡，即使存在通道气窜风险也很低。';
    } else if (pCh < 0.35) {
      v.className = 'verdict ok';
      advice = '虽处于欠平衡（+' + dP.toFixed(2) + ' MPa），但窜槽概率仅 <b>' + (pCh * 100).toFixed(0) + '%</b>，气窜风险可控。建议：可维持当前顶替方案。';
    } else if (risk >= 50) {
      v.className = 'verdict bad';
      advice = '通道与欠平衡同时成立，候凝 ' + S.woc + ' h 累积气量 <b>' + vol.toFixed(2) + ' m³</b>，风险指数 <b>' + risk.toFixed(0) + '%</b>。建议措施：① 提高顶替排量至 2.5 m³/min 以上；② 增大隔离液接触时间至 15 min 以上；③ 采用旋转套管活动；④ 降低水灰比缩短 SGS 过渡期。';
    } else {
      v.className = 'verdict warn';
      advice = '通道与欠平衡同时成立，累积气量 <b>' + vol.toFixed(2) + ' m³</b>，风险指数 <b>' + risk.toFixed(0) + '%</b>。建议：缩短 SGS 过渡期或改用旋转/往复活动套管，提高顶替效率。';
    }
    v.innerHTML = head + advice;
  }

  function render() {
    drawCross();
    drawHeat();
    drawEff();
    drawRisk();
    renderMetrics();
    renderTable();
    renderCompare();
    saveShared();
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    ecc: function (v) { return v + ' %'; },
    start: function (v) { return v + ' %'; },
    len: function (v) { return v + ' °'; },
    w: function (v) { return v.toFixed(1) + ' mm'; },
    contact: function (v) { return v + ' min'; },
    q: function (v) { return v.toFixed(1) + ' m³/min'; },
    yp: function (v) { return v.toFixed(1) + ' Pa'; },
    mic: function (v) { return v + ' μm'; },
    pg: function (v) { return v + ' MPa'; },
    sgs: function (v) { return v + ' min'; },
    woc: function (v) { return v + ' h'; }
  };

  var SLIDER_KEYS = ['ecc', 'start', 'len', 'w', 'contact', 'q', 'yp', 'mic', 'pg', 'sgs', 'woc'];

  function readInputs() {
    SLIDER_KEYS.forEach(function (k) {
      S[k] = parseFloat($('s-' + k).value);
      $('o-' + k).textContent = OUT[k](S[k]);
    });
    S.act = $('s-act').value;
    $('o-act').textContent = $('s-act').selectedOptions[0].textContent;

    /* 邻接联动：用共享值覆盖并同步滑块 */
    var n = loadShared();
    MY_KEYS.forEach(function (k) {
      var key = KEY_MAP[k];
      var el = $('s-' + key);
      if (el) {
        el.value = S[key];
        $('o-' + key).textContent = OUT[key](S[key]);
      }
    });
    var note = $('sync-note-text');
    if (note) note.textContent = '邻接参数联动：已同步 ' + n + ' 个共享参数（偏心/排量）';
  }

  function bind() {
    SLIDER_KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('s-act').addEventListener('change', function () {
      S.act = this.value;
      $('o-act').textContent = this.selectedOptions[0].textContent;
      render();
    });
    $('btn-reset').addEventListener('click', function () {
      SLIDER_KEYS.forEach(function (k) {
        $('s-' + k).value = DEF[k];
      });
      $('s-act').value = DEF.act;
      readInputs();
      render();
    });
    var btnClear = $('btn-clear-shared');
    if (btnClear) btnClear.addEventListener('click', function () {
      localStorage.removeItem(SHARED_KEY);
      var note = $('sync-note-text');
      if (note) note.textContent = '邻接参数联动：已同步 0 个共享参数（偏心/排量）';
    });
  }

  /* ---------- 方案对比：当前 vs 推荐 ---------- */
  var REC = { ecc: 10, contact: 20, q: 1.5, act: '1' }; /* 推荐：偏心10%、接触20min、排量1.5、旋转 */

  function renderCompare() {
    var cur = compute(S);
    var rec = compute(Object.assign({}, S, REC));
    var ce = $('cmp-cur-eta'), cp = $('cmp-cur-pch'), cr = $('cmp-cur-risk');
    var re = $('cmp-rec-eta'), rp = $('cmp-rec-pch'), rr = $('cmp-rec-risk');
    if (ce) ce.innerHTML = (cur.eta * 100).toFixed(1) + '<small> %</small>';
    if (cp) cp.innerHTML = (cur.pCh * 100).toFixed(0) + '<small> %</small>';
    if (cr) cr.innerHTML = cur.risk.toFixed(0) + '<small> %</small>';
    if (re) re.innerHTML = (rec.eta * 100).toFixed(1) + '<small> %</small>';
    if (rp) rp.innerHTML = (rec.pCh * 100).toFixed(0) + '<small> %</small>';
    if (rr) rr.innerHTML = rec.risk.toFixed(0) + '<small> %</small>';
  }

  function applyRec() {
    Object.keys(REC).forEach(function (k) { S[k] = REC[k]; });
    $('s-ecc').value = S.ecc; $('o-ecc').textContent = OUT.ecc(S.ecc);
    $('s-contact').value = S.contact; $('o-contact').textContent = OUT.contact(S.contact);
    $('s-q').value = S.q; $('o-q').textContent = OUT.q(S.q);
    $('s-act').value = S.act; $('o-act').textContent = $('s-act').selectedOptions[0].textContent;
    render();
  }

  function bindCompare() {
    var btn = $('btn-apply-rec');
    if (btn) btn.addEventListener('click', applyRec);
  }

  bind();
  bindCompare();
  readInputs();
  render();
})();
