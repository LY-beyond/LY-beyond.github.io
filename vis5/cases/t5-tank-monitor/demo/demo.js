/* ======= 储罐液位与泄漏智能监控 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

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

  /* 确定性伪随机（种子固定，曲线在参数不变时稳定） */
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ---------- 工况常量（API 2350 / 653 · GB 50341 口径） ---------- */
  var ALARM = { HH: 17.5, H: 16.8, L: 3.0, LL: 2.2 };   /* 液位报警 m */
  var PRES = { HI: 2.0, LO: -0.3 };                       /* 呼吸阀设定 kPa */
  var SET_LIMIT = 20.4;                                   /* 差异沉降许用 mm / 15.7 m 间距（13 mm/10 m） */
  var LEAK_TH = 4;                                        /* CUSUM 阈值 mm */

  var DEF = {
    level: 12.5, temp: 25, pres: 0.6, opmode: 'in', radar: 'ok',
    corr: 35, settle: 18, leak: 5, cursor: 10
  };
  var S = Object.assign({}, DEF);

  /* ---------- 24h 时序生成（5 min 采样，288+1 点） ---------- */
  var N = 289, TMAX = 24, DT = TMAX / (N - 1);
  var DATA = null;
  var hoverIdx = -1;

  function flowRate(t) {           /* 名义液位变化率 m/h */
    if (S.opmode === 'in' && t >= 3 && t < 9) return 0.283;
    if (S.opmode === 'out' && t >= 10 && t < 16) return -0.283;
    return 0;
  }
  function nominal(t) {            /* 0..t 液位变化积分 */
    var acc = 0;
    for (var i = 0; i < N; i++) {
      var ti = i * DT;
      if (ti > t) break;
      acc += flowRate(ti) * DT;
    }
    return acc;
  }

  function genSeries() {
    var curI = clamp(Math.round(S.cursor / DT), 0, N - 1);
    var nomCur = nominal(curI * DT);
    var lv = [], rd = [], vd = [], tp = [], pr = [], rs = [], cu = [];
    var i, t;
    for (i = 0; i < N; i++) {
      t = i * DT;
      var wave = 0.008 * Math.sin(2 * Math.PI * 4 * t) + 0.005 * Math.sin(2 * Math.PI * 7.7 * t + 1.3); /* 浮顶波浪 ±8 mm */
      lv[i] = clamp(S.level + nominal(t) - nomCur + wave, 0.5, 18.8);
      var night = (t < 6 || t > 22);
      vd[i] = lv[i] + (rnd(i + 500) - 0.5) * (night ? 0.06 : 0.03);   /* 视频 ±15/30 mm */
      var stir = (S.opmode === 'stir' && t >= 12 && t < 15) ? 1.5 * Math.sin(Math.PI * (t - 12) / 3) : 0;
      tp[i] = S.temp + 2.5 * Math.sin(2 * Math.PI * (t - 8) / 24) - 2.5 * Math.sin(2 * Math.PI * (S.cursor - 8) / 24) + stir;
    }
    for (i = 0; i < N; i++) {
      rd[i] = lv[i] + (rnd(i * 1.7 + 9) - 0.5) * 0.006;               /* 雷达 ±3 mm */
    }
    if (S.radar === 'frozen') {                                       /* 13–15.5h 冻结 */
      var i13 = Math.round(13 / DT), i155 = Math.round(15.5 / DT);
      for (i = i13; i <= i155 && i < N; i++) rd[i] = rd[i13];
    } else if (S.radar === 'spike') {                                 /* 偶发跳变 ±0.25 m */
      for (i = 0; i < N; i++) {
        if (rnd(i * 3.7 + 2) > 0.982) rd[i] += (rnd(i * 7.3 + 5) > 0.5 ? 1 : -1) * 0.25;
      }
    }
    var pfCur = flowRate(S.cursor) !== 0 ? (flowRate(S.cursor) > 0 ? 0.25 : -0.25) : 0;
    for (i = 0; i < N; i++) {
      t = i * DT;
      var pf = flowRate(t) !== 0 ? (flowRate(t) > 0 ? 0.25 : -0.25) : 0;
      pr[i] = S.pres + (pf - pfCur) + 0.10 * (tp[i] - tp[curI]) + (rnd(i + 900) - 0.5) * 0.03;
    }
    rs[0] = 0; cu[0] = 0;
    for (i = 1; i < N; i++) {
      t = i * DT;
      var leakRate = (t >= 14) ? S.leak / 100 * 4 : 0;                 /* 最大 4 mm/h 渗漏 */
      rs[i] = rs[i - 1] + leakRate * DT + (rnd(i + 300) - 0.5) * 0.12;
      cu[i] = Math.max(0, cu[i - 1] + leakRate * DT - 0.06 * DT);
    }
    var maxCu = 0, crossT = null;
    for (i = 0; i < N; i++) {
      if (cu[i] > maxCu) maxCu = cu[i];
      if (crossT === null && cu[i] > LEAK_TH) crossT = i * DT;
    }
    DATA = { lv: lv, rd: rd, vd: vd, tp: tp, pr: pr, rs: rs, cu: cu, curI: curI, maxCu: maxCu, crossT: crossT };
    return DATA;
  }

  /* ---------- ① 储罐剖面示意（SVG） ---------- */
  function tempColor(t, lighten) {
    var c;
    if (t < 22) {
      var u = clamp(t / 22, 0, 1);
      c = [65 + (47 - 65) * u, 105 + (125 - 105) * u, 155 + (107 - 155) * u];
    } else {
      var v = clamp((t - 22) / 23, 0, 1);
      c = [47 + (176 - 47) * v, 125 + (90 - 125) * v, 107 + (81 - 107) * v];
    }
    if (lighten) c = [c[0] + (255 - c[0]) * lighten, c[1] + (255 - c[1]) * lighten, c[2] + (255 - c[2]) * lighten];
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }

  function drawTank() {
    var svg = $('tank');
    var W = 460, H = 268;
    var groundY = 228, baseY = 226;
    var x0 = 100, x1 = 340;
    var k = 170 / 19.5;                       /* px/m 垂直比例 */
    function ly(lv) { return baseY - lv * k; }

    var lv = clamp(S.level, 0.8, 18.8);
    var yLv = ly(lv);
    var tilt = S.settle / 60 * 1.5;           /* 倾斜角（夸张显示，最大 1.5°） */
    var rot = 'rotate(' + (-tilt).toFixed(2) + ' ' + ((x0 + x1) / 2) + ' ' + baseY + ')';

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 地基与地面 */
    s += '<rect x="' + (x0 - 16) + '" y="' + baseY + '" width="' + (x1 - x0 + 32) + '" height="8" fill="#e6e0d2" stroke="#cfc7b6" stroke-width="0.8"/>';
    s += '<line x1="40" y1="' + groundY + '" x2="' + (W - 30) + '" y2="' + groundY + '" stroke="#cfc7b6" stroke-width="1.2"/>';
    for (var hx = 44; hx < W - 30; hx += 14) {
      s += '<line x1="' + hx + '" y1="' + groundY + '" x2="' + (hx - 5) + '" y2="' + (groundY + 6) + '" stroke="#ddd6c6" stroke-width="0.8"/>';
    }

    /* 罐体（含倾斜） */
    s += '<g transform="' + rot + '">';
    /* 液体（温度分层三段着色） */
    var yTop = ly(19.5);
    if (lv > 0.9) {
      var hL = baseY - yLv;
      s += '<rect x="' + x0 + '" y="' + yLv + '" width="' + (x1 - x0) + '" height="' + (hL * 0.4) + '" fill="' + tempColor(S.temp, 0.30) + '"/>';
      s += '<rect x="' + x0 + '" y="' + (yLv + hL * 0.4) + '" width="' + (x1 - x0) + '" height="' + (hL * 0.35) + '" fill="' + tempColor(S.temp, 0.12) + '"/>';
      s += '<rect x="' + x0 + '" y="' + (yLv + hL * 0.75) + '" width="' + (x1 - x0) + '" height="' + (hL * 0.25) + '" fill="' + tempColor(S.temp, 0) + '"/>';
    }
    /* 罐壁与罐底板 */
    s += '<line x1="' + x0 + '" y1="' + yTop + '" x2="' + x0 + '" y2="' + baseY + '" stroke="#5d666d" stroke-width="3"/>';
    s += '<line x1="' + x1 + '" y1="' + yTop + '" x2="' + x1 + '" y2="' + baseY + '" stroke="#5d666d" stroke-width="3"/>';
    s += '<line x1="' + (x0 - 2) + '" y1="' + baseY + '" x2="' + (x1 + 2) + '" y2="' + baseY + '" stroke="#5d666d" stroke-width="3.5"/>';
    /* 罐底腐蚀热点（声发射活动区） */
    var hotX = [x0 + 30, x0 + 95, x0 + 170, x0 + 212];
    for (var hi = 0; hi < hotX.length; hi++) {
      var rr = (2 + 8 * (S.corr / 100)) * (0.6 + 0.8 * rnd(hi + 40));
      var op = 0.18 + 0.62 * (S.corr / 100);
      s += '<circle cx="' + hotX[hi] + '" cy="' + (baseY - 3) + '" r="' + rr.toFixed(1) + '" fill="#b05a51" opacity="' + op.toFixed(2) + '"/>';
    }
    if (S.corr >= 5) {
      s += '<text x="' + (x1 - 8) + '" y="' + (baseY - 12) + '" font-size="8.5" fill="#fff" opacity="0.92" text-anchor="end">罐底板 AE 热点 ' + S.corr + '%</text>';
    }
    /* 浮顶（随液面） */
    s += '<rect x="' + (x0 + 3) + '" y="' + (yLv - 6) + '" width="' + (x1 - x0 - 6) + '" height="6" fill="#8a9298" stroke="#5d666d" stroke-width="0.8"/>';
    s += '<rect x="' + x0 + '" y="' + (yLv - 9) + '" width="6" height="10" fill="#6d767d"/>';   /* 一次密封 */
    s += '<rect x="' + (x1 - 6) + '" y="' + (yLv - 9) + '" width="6" height="10" fill="#6d767d"/>';
    /* 雷达液位计 */
    s += '<rect x="' + ((x0 + x1) / 2 - 5) + '" y="' + (yLv - 16) + '" width="10" height="10" fill="#41699b" stroke="#2d4a70" stroke-width="0.8"/>';
    s += '<line x1="' + ((x0 + x1) / 2) + '" y1="' + (yLv - 6) + '" x2="' + ((x0 + x1) / 2) + '" y2="' + yLv + '" stroke="#41699b" stroke-width="1" stroke-dasharray="2 2"/>';
    s += '<text x="' + ((x0 + x1) / 2 + 9) + '" y="' + (yLv - 9) + '" font-size="8.5" fill="#41699b">雷达 ±3 mm</text>';
    /* 油温标注 */
    if (baseY - yLv > 30) {
      s += '<text x="' + ((x0 + x1) / 2) + '" y="' + (yLv + 22) + '" font-size="9" fill="#fff" text-anchor="middle" opacity="0.9">油温 ' + S.temp + ' ℃（分层 ΔT≈2 ℃）</text>';
    }
    s += '</g>';

    /* 报警线（绝对标高，不随罐体倾斜） */
    var alarms = [
      { v: ALARM.HH, c: '#b05a51', lab: '高高 17.5 m · 联锁', side: 'L' },
      { v: ALARM.H, c: '#c9a15a', lab: '高 16.8 m · 预警', side: 'R' },
      { v: ALARM.L, c: '#c9a15a', lab: '低 3.0 m · 限流', side: 'L' },
      { v: ALARM.LL, c: '#b05a51', lab: '低低 2.2 m · 停泵', side: 'R' }
    ];
    alarms.forEach(function (a) {
      var y = ly(a.v);
      s += '<line x1="' + (x0 - 4) + '" y1="' + y + '" x2="' + (x1 + 4) + '" y2="' + y + '" stroke="' + a.c + '" stroke-width="1.1" stroke-dasharray="5 3"/>';
      if (a.side === 'L') {
        s += '<text x="' + (x0 - 8) + '" y="' + (y + 3) + '" font-size="8.5" fill="' + a.c + '" text-anchor="end">' + a.lab + '</text>';
      } else {
        s += '<text x="' + (x1 + 8) + '" y="' + (y + 3) + '" font-size="8.5" fill="' + a.c + '" text-anchor="start">' + a.lab + '</text>';
      }
    });

    /* 当前液位游标（右侧，避让 16.8/2.2 标注） */
    var labY = yLv + 3;
    if (Math.abs(yLv - ly(ALARM.H)) < 11) labY += 12;
    if (Math.abs(yLv - ly(ALARM.LL)) < 11) labY -= 12;
    s += '<line x1="' + (x1 + 4) + '" y1="' + yLv + '" x2="' + (x1 + 14) + '" y2="' + yLv + '" stroke="#2f7d6b" stroke-width="1.6"/>';
    s += '<path d="M ' + (x1 + 4) + ' ' + yLv + ' l -6 -3.4 l 0 6.8 Z" fill="#2f7d6b"/>';
    s += '<rect x="' + (x1 + 15) + '" y="' + (labY - 9) + '" width="64" height="13" rx="3" fill="#fff" stroke="#cfdfd6"/>';
    s += '<text x="' + (x1 + 20) + '" y="' + (labY + 1) + '" font-size="9" fill="#235f51" font-family="monospace" font-weight="600">' + S.level.toFixed(1) + ' m</text>';

    /* 视频相机图标（避开右侧 16.8 m 报警标注，置于其下方） */
    s += '<rect x="' + (x1 + 12) + '" y="' + (yTop + 38) + '" width="14" height="9" rx="2" fill="#5d666d"/>';
    s += '<circle cx="' + (x1 + 19) + '" cy="' + (yTop + 42.5) + '" r="2.4" fill="#fdfcf9"/>';
    s += '<line x1="' + (x1 + 16) + '" y1="' + (yTop + 47) + '" x2="' + (x1 + 16) + '" y2="' + (yTop + 54) + '" stroke="#5d666d" stroke-width="1.5"/>';
    s += '<text x="' + (x1 + 30) + '" y="' + (yTop + 43) + '" font-size="8.5" fill="#5d666d">视频×3</text>';
    s += '<text x="' + (x1 + 30) + '" y="' + (yTop + 53) + '" font-size="8" fill="#8a9298">（可见光+红外）</text>';

    /* 尺寸标注：罐高（左）、罐径（下） */
    s += '<line x1="' + (x0 - 34) + '" y1="' + yTop + '" x2="' + (x0 - 34) + '" y2="' + baseY + '" stroke="#9ba3a9" stroke-width="0.8"/>';
    s += '<line x1="' + (x0 - 38) + '" y1="' + yTop + '" x2="' + (x0 - 30) + '" y2="' + yTop + '" stroke="#9ba3a9" stroke-width="0.8"/>';
    s += '<line x1="' + (x0 - 38) + '" y1="' + baseY + '" x2="' + (x0 - 30) + '" y2="' + baseY + '" stroke="#9ba3a9" stroke-width="0.8"/>';
    s += '<text x="' + (x0 - 40) + '" y="' + ((yTop + baseY) / 2) + '" font-size="8.5" fill="#8a9298" text-anchor="middle" transform="rotate(-90 ' + (x0 - 40) + ' ' + ((yTop + baseY) / 2) + ')">H = 19.5 m</text>';
    s += '<line x1="' + x0 + '" y1="' + (groundY + 16) + '" x2="' + x1 + '" y2="' + (groundY + 16) + '" stroke="#9ba3a9" stroke-width="0.8"/>';
    s += '<line x1="' + x0 + '" y1="' + (groundY + 12) + '" x2="' + x0 + '" y2="' + (groundY + 20) + '" stroke="#9ba3a9" stroke-width="0.8"/>';
    s += '<line x1="' + x1 + '" y1="' + (groundY + 12) + '" x2="' + x1 + '" y2="' + (groundY + 20) + '" stroke="#9ba3a9" stroke-width="0.8"/>';
    s += '<text x="' + ((x0 + x1) / 2) + '" y="' + (groundY + 26) + '" font-size="8.5" fill="#8a9298" text-anchor="middle">D = 60 m · 5 万 m³ 外浮顶罐</text>';

    /* 沉降状态注记（顶部独占带） */
    var settleNote = S.settle > 0 ? ('罐周不均匀沉降幅值 ' + S.settle + ' mm，倾斜 ' + tilt.toFixed(2) + '°（示意放大）') : '罐周沉降均匀，无倾斜';
    s += '<text x="' + x0 + '" y="' + (yTop - 8) + '" font-size="9" fill="' + (S.settle > 35 ? '#b05a51' : '#79828a') + '">' + settleNote + '</text>';

    svg.innerHTML = s;
  }

  /* ---------- ② 三源时序（canvas，悬停 tooltip + 十字线） ---------- */
  var TS = { W: 480, H: 326, pl: 46, pr: 46, top1: 8, top2: 108, top3: 208, ph: 86, pb: 22 };

  function tsX(t) { return TS.pl + t / TMAX * (TS.W - TS.pl - TS.pr); }

  function drawSeries() {
    var cv = $('ts');
    var ctx = setupCanvas(cv, TS.W, TS.H);
    var W = TS.W, H = TS.H, pl = TS.pl, pr = TS.pr, pw = W - pl - pr;
    var p1 = { y: TS.top1, h: TS.ph }, p2 = { y: TS.top2, h: TS.ph }, p3 = { y: TS.top3, h: TS.ph };
    var d = DATA;
    var i, t;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    /* 竖向时间网格（贯通三面板） */
    ctx.strokeStyle = '#efece1';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'center';
    for (t = 0; t <= 24; t += 4) {
      var gx = tsX(t);
      ctx.beginPath(); ctx.moveTo(gx, p1.y); ctx.lineTo(gx, p3.y + p3.h); ctx.stroke();
      ctx.fillText(t + 'h', gx, H - 8);
    }

    /* 作业事件竖线 + 面板1顶部标注 */
    var events = [];
    if (S.opmode === 'in') events = [{ t: 3, lab: '收油 800 m³/h' }, { t: 9, lab: '收油结束' }];
    else if (S.opmode === 'out') events = [{ t: 10, lab: '付油 800 m³/h' }, { t: 16, lab: '付油结束' }];
    else if (S.opmode === 'stir') events = [{ t: 12, lab: '搅拌' }, { t: 15, lab: '搅拌结束' }];
    events.forEach(function (ev, k) {
      var ex = tsX(ev.t);
      ctx.strokeStyle = '#b8b09a';
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(ex, p1.y); ctx.lineTo(ex, p3.y + p3.h); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#8a9298';
      ctx.font = '8.5px sans-serif';
      ctx.textAlign = (k % 2 === 0) ? 'left' : 'right';
      ctx.fillText(ev.lab, ex + (k % 2 === 0 ? 3 : -3), p1.y + 9);
    });

    /* ===== 面板1：液位（三源） ===== */
    var lMin = 1e9, lMax = -1e9;
    for (i = 0; i < N; i++) {
      lMin = Math.min(lMin, d.lv[i], d.rd[i], d.vd[i]);
      lMax = Math.max(lMax, d.lv[i], d.rd[i], d.vd[i]);
    }
    lMin -= 0.2;
    lMax += 0.2;
    function yL(v) { return p1.y + p1.h - (v - lMin) / (lMax - lMin) * p1.h; }

    /* 雷达冻结段阴影 */
    if (S.radar === 'frozen') {
      ctx.fillStyle = 'rgba(176,90,81,0.08)';
      ctx.fillRect(tsX(13), p1.y, tsX(15.5) - tsX(13), p1.h);
      ctx.fillStyle = '#b05a51';
      ctx.font = '8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('雷达冻结段（自动降权）', tsX(14.25), p1.y + 20);
    }
    /* 高/低报警参考线（在范围内才画） */
    ctx.font = '8px Consolas, monospace';
    if (ALARM.HH > lMin && ALARM.HH < lMax) {
      ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(pl, yL(ALARM.HH)); ctx.lineTo(pl + pw, yL(ALARM.HH)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left';
      ctx.fillText('高高 17.5', pl + 3, yL(ALARM.HH) - 3);
    }
    if (ALARM.LL > lMin && ALARM.LL < lMax) {
      ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(pl, yL(ALARM.LL)); ctx.lineTo(pl + pw, yL(ALARM.LL)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left';
      ctx.fillText('低低 2.2', pl + 3, yL(ALARM.LL) - 3);
    }
    /* 三条液位曲线 */
    function plotLine(arr, color, width) {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath();
      for (var j = 0; j < N; j++) {
        var x = tsX(j * DT), y = yL(arr[j]);
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    plotLine(d.vd, '#c9a15a', 1);
    plotLine(d.rd, '#41699b', 1.2);
    plotLine(d.lv, '#2f7d6b', 1.8);
    /* 轴与刻度 */
    ctx.strokeStyle = '#cfc7b6';
    ctx.lineWidth = 1;
    ctx.strokeRect(pl, p1.y, pw, p1.h);
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'right';
    [lMin, (lMin + lMax) / 2, lMax].forEach(function (v) {
      ctx.fillText(v.toFixed(2), pl - 4, yL(v) + 3);
    });
    ctx.fillStyle = '#8a9298';
    ctx.textAlign = 'left';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('液位 m', pl + 3, p1.y + p1.h - 4);

    /* ===== 面板2：温度 + 呼吸压力 ===== */
    var tMin = 1e9, tMax = -1e9, pMin = -0.8, pMax = 2.8;
    for (i = 0; i < N; i++) {
      tMin = Math.min(tMin, d.tp[i]); tMax = Math.max(tMax, d.tp[i]);
      pMin = Math.min(pMin, d.pr[i] - 0.1); pMax = Math.max(pMax, d.pr[i] + 0.1);
    }
    tMin -= 1; tMax += 1;
    function yT(v) { return p2.y + p2.h - (v - tMin) / (tMax - tMin) * p2.h; }
    function yP(v) { return p2.y + p2.h - (v - pMin) / (pMax - pMin) * p2.h; }
    /* 压力阈值线 */
    ctx.font = '8px Consolas, monospace';
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yP(PRES.HI)); ctx.lineTo(pl + pw, yP(PRES.HI)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'left';
    ctx.fillText('呼吸阀 +2.0', pl + 3, yP(PRES.HI) - 3);
    ctx.strokeStyle = '#41699b'; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yP(PRES.LO)); ctx.lineTo(pl + pw, yP(PRES.LO)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#41699b';
    ctx.fillText('负压 −0.3', pl + 3, yP(PRES.LO) + 9);
    ctx.strokeStyle = '#e0dac8';
    ctx.beginPath(); ctx.moveTo(pl, yP(0)); ctx.lineTo(pl + pw, yP(0)); ctx.stroke();
    /* 曲线 */
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (i = 0; i < N; i++) { var x2 = tsX(i * DT), y2 = yT(d.tp[i]); if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2); }
    ctx.stroke();
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (i = 0; i < N; i++) { var x3 = tsX(i * DT), y3 = yP(d.pr[i]); if (i === 0) ctx.moveTo(x3, y3); else ctx.lineTo(x3, y3); }
    ctx.stroke();
    ctx.strokeStyle = '#cfc7b6'; ctx.lineWidth = 1;
    ctx.strokeRect(pl, p2.y, pw, p2.h);
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b05a51';
    [tMin, (tMin + tMax) / 2, tMax].forEach(function (v) { ctx.fillText(v.toFixed(1), pl - 4, yT(v) + 3); });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#41699b';
    [pMin, (pMin + pMax) / 2, pMax].forEach(function (v) { ctx.fillText(v.toFixed(2), pl + pw + 4, yP(v) + 3); });
    ctx.fillStyle = '#8a9298';
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('温度 ℃（左）/ 压力 kPa（右）', pl + pw - 3, p2.y + p2.h - 4);
    ctx.textAlign = 'left';

    /* ===== 面板3：质量平衡残差 + CUSUM ===== */
    var rMin = 0, rMax = LEAK_TH + 1;
    for (i = 0; i < N; i++) {
      rMin = Math.min(rMin, d.rs[i]); rMax = Math.max(rMax, d.rs[i], d.cu[i]);
    }
    rMin -= 1; rMax += 1;
    function yR(v) { return p3.y + p3.h - (v - rMin) / (rMax - rMin) * p3.h; }
    ctx.strokeStyle = '#e0dac8';
    ctx.beginPath(); ctx.moveTo(pl, yR(0)); ctx.lineTo(pl + pw, yR(0)); ctx.stroke();
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yR(LEAK_TH)); ctx.lineTo(pl + pw, yR(LEAK_TH)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51';
    ctx.font = '8px Consolas, monospace'; ctx.textAlign = 'left';
    ctx.fillText('CUSUM 阈值 4 mm', pl + 3, yR(LEAK_TH) - 3);
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (i = 0; i < N; i++) { var x4 = tsX(i * DT), y4 = yR(d.rs[i]); if (i === 0) ctx.moveTo(x4, y4); else ctx.lineTo(x4, y4); }
    ctx.stroke();
    ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (i = 0; i < N; i++) { var x5 = tsX(i * DT), y5 = yR(d.cu[i]); if (i === 0) ctx.moveTo(x5, y5); else ctx.lineTo(x5, y5); }
    ctx.stroke();
    ctx.strokeStyle = '#cfc7b6'; ctx.lineWidth = 1;
    ctx.strokeRect(pl, p3.y, pw, p3.h);
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'right';
    [rMin, (rMin + rMax) / 2, rMax].forEach(function (v) { ctx.fillText(v.toFixed(1), pl - 4, yR(v) + 3); });
    ctx.fillStyle = '#8a9298';
    ctx.font = '8.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('残差（蓝）/ CUSUM（红）mm', pl + 3, p3.y + p3.h - 4);

    /* 时间游标 */
    var cx0 = tsX(S.cursor);
    ctx.strokeStyle = '#8a9298';
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(cx0, p1.y); ctx.lineTo(cx0, p3.y + p3.h); ctx.stroke();
    ctx.setLineDash([]);

    /* 悬停十字线与取数点 */
    if (hoverIdx >= 0) {
      var hx = tsX(hoverIdx * DT);
      ctx.strokeStyle = 'rgba(35,95,81,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, p1.y); ctx.lineTo(hx, p3.y + p3.h); ctx.stroke();
      [[yL(d.lv[hoverIdx]), '#2f7d6b'], [yL(d.rd[hoverIdx]), '#41699b'], [yL(d.vd[hoverIdx]), '#c9a15a']].forEach(function (pp) {
        ctx.fillStyle = pp[1];
        ctx.beginPath(); ctx.arc(hx, pp[0], 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#b05a51';
      ctx.beginPath(); ctx.arc(hx, yT(d.tp[hoverIdx]), 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#41699b';
      ctx.beginPath(); ctx.arc(hx, yP(d.pr[hoverIdx]), 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b05a51';
      ctx.beginPath(); ctx.arc(hx, yR(d.cu[hoverIdx]), 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function bindSeriesTip() {
    var cv = $('ts'), tip = $('ts-tip'), box = $('ts-box');
    if (!cv || !tip || !box) return;
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      var lx = (e.clientX - r.left) * (TS.W / r.width);
      var idx = Math.round((lx - TS.pl) / (TS.W - TS.pl - TS.pr) * (N - 1));
      if (idx < 0 || idx > N - 1) { hoverIdx = -1; tip.style.display = 'none'; drawSeries(); return; }
      hoverIdx = idx;
      var t = idx * DT, d = DATA;
      var hh = Math.floor(t), mm = Math.round((t - hh) * 60);
      tip.innerHTML = '<b>' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + '</b>'
        + ' 融合 <b>' + d.lv[idx].toFixed(3) + ' m</b><br>'
        + '雷达 <b>' + d.rd[idx].toFixed(3) + ' m</b> · 视频 <b>' + d.vd[idx].toFixed(3) + ' m</b><br>'
        + '油温 <b>' + d.tp[idx].toFixed(1) + ' ℃</b> · 压力 <b>' + d.pr[idx].toFixed(2) + ' kPa</b><br>'
        + '残差 <b>' + d.rs[idx].toFixed(2) + ' mm</b> · CUSUM <b>' + d.cu[idx].toFixed(2) + ' mm</b>';
      var rb = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(e.clientX - rb.left + 12, 4, rb.width - 210) + 'px';
      tip.style.top = clamp(e.clientY - rb.top - 10, 4, rb.height - 84) + 'px';
      drawSeries();
    });
    cv.addEventListener('mouseleave', function () {
      hoverIdx = -1; tip.style.display = 'none'; drawSeries();
    });
  }

  /* ---------- ③a 罐底板声发射热力图（canvas，悬停读格） ---------- */
  var AE = { W: 440, H: 252, cx: 126, cy: 128, R: 104, rings: 6, secs: 24 };
  var AE_GRADES = [
    { g: 'I', c: '#cfe0d6', act: '不活跃，按周期复检' },
    { g: 'II', c: '#7fae9d', act: '低活跃，3 年内开罐' },
    { g: 'III', c: '#c9a15a', act: '中活跃，1 年内开罐' },
    { g: 'IV', c: '#c97b52', act: '高活跃，尽快开罐检验' },
    { g: 'V', c: '#b05a51', act: '严重活跃，立即评估停用' }
  ];
  function aeVal(r, sec) {
    var base = 0.2 + 0.8 * rnd(r * 24 + sec * 3 + 11);
    var edge = (r === 0 || r === AE.rings - 1) ? 0.15 : 0;
    var hot = (r === 2 && sec >= 5 && sec <= 7) ? 0.55 : 0;
    return clamp(base * (0.12 + S.corr / 100) * 0.9 + (edge + hot) * (S.corr / 100), 0, 1);
  }
  function aeGrade(v) {
    return v < 0.2 ? 0 : v < 0.4 ? 1 : v < 0.6 ? 2 : v < 0.8 ? 3 : 4;
  }

  function drawAE() {
    var cv = $('ae');
    var ctx = setupCanvas(cv, AE.W, AE.H);
    ctx.clearRect(0, 0, AE.W, AE.H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, AE.W, AE.H);
    var r, sec;
    var ringW = AE.R / AE.rings;
    for (r = 0; r < AE.rings; r++) {
      for (sec = 0; sec < AE.secs; sec++) {
        var a0 = -Math.PI / 2 + sec * (Math.PI * 2 / AE.secs);
        var a1 = a0 + Math.PI * 2 / AE.secs;
        var v = aeVal(r, sec);
        ctx.fillStyle = AE_GRADES[aeGrade(v)].c;
        ctx.beginPath();
        ctx.arc(AE.cx, AE.cy, (r + 1) * ringW, a0, a1);
        ctx.arc(AE.cx, AE.cy, r * ringW, a1, a0, true);
        ctx.closePath();
        ctx.fill();
      }
    }
    /* 网格线 */
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    for (r = 1; r <= AE.rings; r++) {
      ctx.beginPath(); ctx.arc(AE.cx, AE.cy, r * ringW, 0, Math.PI * 2); ctx.stroke();
    }
    for (sec = 0; sec < AE.secs; sec++) {
      var a = -Math.PI / 2 + sec * (Math.PI * 2 / AE.secs);
      ctx.beginPath();
      ctx.moveTo(AE.cx, AE.cy);
      ctx.lineTo(AE.cx + AE.R * Math.cos(a), AE.cy + AE.R * Math.sin(a));
      ctx.stroke();
    }
    ctx.strokeStyle = '#8a9298';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(AE.cx, AE.cy, AE.R, 0, Math.PI * 2); ctx.stroke();
    /* 方位标注 */
    ctx.fillStyle = '#8a9298';
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0°（北）', AE.cx, AE.cy - AE.R - 5);
    ctx.fillText('90°', AE.cx + AE.R + 14, AE.cy + 3);
    ctx.fillText('180°', AE.cx, AE.cy + AE.R + 12);
    ctx.fillText('270°', AE.cx - AE.R - 14, AE.cy + 3);
    /* 环带半径标注 */
    ctx.textAlign = 'left';
    ctx.fillText('R=30 m', AE.cx + 4, AE.cy + AE.R - 4);
    ctx.fillText('罐中心', AE.cx + 4, AE.cy - 4);

    /* 右侧评价栏 */
    var tx = 268;
    ctx.fillStyle = '#79828a';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('评价结果（JB/T 10764）', tx, 22);
    var maxV = 0, maxR = 0, maxS = 0;
    for (r = 0; r < AE.rings; r++) {
      for (sec = 0; sec < AE.secs; sec++) {
        var vv = aeVal(r, sec);
        if (vv > maxV) { maxV = vv; maxR = r; maxS = sec; }
      }
    }
    var g = aeGrade(maxV);
    ctx.fillStyle = '#242b2e';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText('最高活动度 ' + Math.round(maxV * 100) + '%', tx, 40);
    ctx.fillStyle = AE_GRADES[g].c === '#cfe0d6' ? '#7fae9d' : AE_GRADES[g].c;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('等级 ' + AE_GRADES[g].g, tx, 58);
    ctx.fillStyle = '#5d666d';
    ctx.font = '9px sans-serif';
    ctx.fillText('活跃区：环带 ' + (maxR + 1) + '（R ' + (maxR * 5) + '–' + ((maxR + 1) * 5) + ' m）', tx, 76);
    ctx.fillText('方位 ' + (maxS * 15) + '°–' + (maxS * 15 + 15) + '°', tx, 90);
    ctx.fillText(AE_GRADES[g].act, tx, 108);
    if (S.corr >= 40) {
      ctx.fillStyle = '#b05a51';
      ctx.fillText('热点簇：2 环带 75°–120°', tx, 126);
      ctx.fillText('（时差定位，Hua 2024）', tx, 139);
    }
    /* 图例 */
    ctx.font = '8.5px sans-serif';
    var lx = 268, lyv = 160;
    ctx.fillStyle = '#79828a';
    ctx.fillText('活动度分级', lx, lyv - 6);
    AE_GRADES.forEach(function (gr, k) {
      var yy = lyv + 8 + k * 16;
      ctx.fillStyle = gr.c;
      ctx.fillRect(lx, yy - 8, 12, 10);
      ctx.strokeStyle = '#c9c2b0';
      ctx.strokeRect(lx, yy - 8, 12, 10);
      ctx.fillStyle = '#5d666d';
      var band = k === 0 ? '<20%' : k === 1 ? '20–40%' : k === 2 ? '40–60%' : k === 3 ? '60–80%' : '≥80%';
      ctx.fillText(gr.g + ' 级 ' + band, lx + 17, yy + 1);
    });
  }

  function bindAETip() {
    var cv = $('ae'), tip = $('ae-tip'), box = $('ae-box');
    if (!cv || !tip || !box) return;
    cv.addEventListener('mousemove', function (e) {
      var r0 = cv.getBoundingClientRect();
      var lx = (e.clientX - r0.left) * (AE.W / r0.width);
      var lyv = (e.clientY - r0.top) * (AE.H / r0.height);
      var dx = lx - AE.cx, dy = lyv - AE.cy;
      var rr = Math.sqrt(dx * dx + dy * dy);
      var ringW = AE.R / AE.rings;
      var ring = Math.floor(rr / ringW);
      if (ring < 0 || ring >= AE.rings) { tip.style.display = 'none'; return; }
      var ang = Math.atan2(dy, dx) + Math.PI / 2;
      if (ang < 0) ang += Math.PI * 2;
      var sec = Math.floor(ang / (Math.PI * 2 / AE.secs)) % AE.secs;
      var v = aeVal(ring, sec);
      var g = aeGrade(v);
      tip.innerHTML = '<b>环带 ' + (ring + 1) + '</b>（R ' + (ring * 5) + '–' + ((ring + 1) * 5) + ' m）· 方位 <b>' + (sec * 15) + '°</b><br>'
        + '活动度 <b>' + Math.round(v * 100) + '%</b>（' + AE_GRADES[g].g + ' 级）<br>'
        + '<span style="color:#8a9298">' + AE_GRADES[g].act + '</span>';
      var rb = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(e.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(e.clientY - rb.top - 10, 4, rb.height - 76) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- ③b 罐周沉降雷达图（SVG，API 653 Annex B 口径） ---------- */
  var SET = { cx: 122, cy: 128, R: 98, tilt: 40 };
  function settleAt(k) {  /* 第 k 测点（k=0 为正北，顺时针 30° 间隔）沉降 mm */
    var th = k * 30 - 90;
    var rad = (th - SET.tilt) * Math.PI / 180;
    return Math.max(0, S.settle * (0.5 + 0.5 * Math.cos(rad)) + (rnd(k + 77) - 0.5) * 6);
  }
  function allowAt(thDeg) {
    var rad = (thDeg - SET.tilt) * Math.PI / 180;
    return 15 + 30 * (0.5 + 0.5 * Math.cos(rad));
  }

  function settleStats() {
    var vals = [];
    for (var k = 0; k < 12; k++) vals.push(settleAt(k));
    var maxV = 0, maxI = 0, maxDiff = 0;
    for (var i = 0; i < 12; i++) {
      if (vals[i] > maxV) { maxV = vals[i]; maxI = i; }
      var df = Math.abs(vals[i] - vals[(i + 1) % 12]);
      if (df > maxDiff) maxDiff = df;
    }
    return { vals: vals, maxV: maxV, maxI: maxI, maxDiff: maxDiff };
  }

  function drawSettle() {
    var svg = $('settle');
    var W = 440, H = 252;
    var sc = SET.R / 60;   /* 60 mm → R px */
    function px(thDeg, mm) {
      var a = (thDeg - 90) * Math.PI / 180;
      return [SET.cx + mm * sc * Math.cos(a), SET.cy + mm * sc * Math.sin(a)];
    }
    var st = settleStats();
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格圆 + 径向辐条 */
    [15, 30, 45, 60].forEach(function (mm) {
      s += '<circle cx="' + SET.cx + '" cy="' + SET.cy + '" r="' + (mm * sc).toFixed(1) + '" fill="none" stroke="#efece1"/>';
      var lp = px(0, mm);
      s += '<text x="' + (lp[0] + 3) + '" y="' + (lp[1] + 9) + '" font-size="8" fill="#b8b09a" font-family="monospace">' + mm + '</text>';
    });
    for (var k = 0; k < 12; k++) {
      var p = px(k * 30, 62);
      var c = px(k * 30, 0);
      s += '<line x1="' + c[0] + '" y1="' + c[1] + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#f1ebdd" stroke-width="1"/>';
    }
    s += '<text x="' + (SET.cx - 40) + '" y="' + (SET.cy - SET.R - 6) + '" font-size="8" fill="#b8b09a" font-family="monospace">沉降 mm</text>';

    /* 许用包络（API 653 Annex B 余弦曲线简化） */
    var env = '';
    for (var a = 0; a <= 360; a += 6) {
      var ep = px(a, allowAt(a));
      env += (a === 0 ? 'M' : 'L') + ep[0].toFixed(1) + ' ' + ep[1].toFixed(1) + ' ';
    }
    s += '<path d="' + env + 'Z" fill="rgba(201,161,90,0.07)" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';

    /* 实测沉降多边形 */
    var poly = '';
    for (k = 0; k < 12; k++) {
      var mp = px(k * 30, st.vals[k]);
      poly += (k === 0 ? 'M' : 'L') + mp[0].toFixed(1) + ' ' + mp[1].toFixed(1) + ' ';
    }
    s += '<path d="' + poly + 'Z" fill="rgba(47,125,107,0.13)" stroke="#2f7d6b" stroke-width="1.8"/>';
    for (k = 0; k < 12; k++) {
      var over = st.vals[k] > allowAt(k * 30);
      var pp = px(k * 30, st.vals[k]);
      s += '<circle cx="' + pp[0].toFixed(1) + '" cy="' + pp[1].toFixed(1) + '" r="3.4" fill="' + (over ? '#b05a51' : '#2f7d6b') + '" stroke="#fff" stroke-width="1.2"/>';
      var lp2 = px(k * 30, 70);
      s += '<text x="' + lp2[0].toFixed(1) + '" y="' + (lp2[1] + 3).toFixed(1) + '" font-size="8" fill="#8a9298" text-anchor="middle">P' + (k + 1) + '</text>';
    }

    /* 倾斜方位箭头 */
    var tp = px(SET.tilt, 30);
    s += '<line x1="' + SET.cx + '" y1="' + SET.cy + '" x2="' + tp[0] + '" y2="' + tp[1] + '" stroke="#b05a51" stroke-width="1.4" marker-end="url(#arr)"/>';
    s += '<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#b05a51"/></marker></defs>';
    s += '<text x="' + SET.cx + '" y="' + (SET.cy - 6) + '" font-size="8" fill="#b05a51" text-anchor="middle">倾斜 040°</text>';

    /* 右侧统计栏 */
    var tx = 262, lh = 17;
    function stat(y, lab, val, color) {
      s += '<text x="' + tx + '" y="' + y + '" font-size="9" fill="#79828a">' + lab + '</text>';
      s += '<text x="' + tx + '" y="' + (y + 12) + '" font-size="10.5" fill="' + (color || '#242b2e') + '" font-family="monospace" font-weight="600">' + val + '</text>';
    }
    var y0 = 30;
    stat(y0, '最大沉降（P' + (st.maxI + 1) + '）', st.maxV.toFixed(1) + ' mm');
    stat(y0 + lh * 2, '最大差异沉降 / 间距', st.maxDiff.toFixed(1) + ' mm / 15.7 m', st.maxDiff > SET_LIMIT ? '#b05a51' : '#242b2e');
    stat(y0 + lh * 4, '许用（13 mm/10 m 折算）', '≤ ' + SET_LIMIT + ' mm');
    stat(y0 + lh * 6, '不均匀沉降幅值', S.settle + ' mm');
    var okS = st.maxDiff <= SET_LIMIT;
    s += '<text x="' + tx + '" y="' + (y0 + lh * 8) + '" font-size="9.5" fill="' + (okS ? '#35765a' : '#a85147') + '" font-weight="600">' + (okS ? '满足 API 653 Annex B' : '超许用：安排水准测量复核') + '</text>';
    s += '<text x="' + tx + '" y="' + (y0 + lh * 8 + 14) + '" font-size="8.5" fill="#9ba3a9">红点 = 超许用包络测点</text>';
    /* 图例 */
    s += '<line x1="' + tx + '" y1="' + (H - 34) + '" x2="' + (tx + 16) + '" y2="' + (H - 34) + '" stroke="#2f7d6b" stroke-width="2"/>';
    s += '<text x="' + (tx + 20) + '" y="' + (H - 31) + '" font-size="8.5" fill="#5d666d">实测沉降（12 测点）</text>';
    s += '<line x1="' + tx + '" y1="' + (H - 18) + '" x2="' + (tx + 16) + '" y2="' + (H - 18) + '" stroke="#c9a15a" stroke-width="1.4" stroke-dasharray="4 3"/>';
    s += '<text x="' + (tx + 20) + '" y="' + (H - 15) + '" font-size="8.5" fill="#5d666d">许用包络（API 653）</text>';

    svg.innerHTML = s;
  }

  /* ---------- ④ 指标卡与综合判定 ---------- */
  function corrGrade() {
    return S.corr < 20 ? 0 : S.corr < 40 ? 1 : S.corr < 60 ? 2 : S.corr < 80 ? 3 : 4;
  }

  function renderMetrics(st) {
    var upM = ALARM.HH - S.level, dnM = S.level - ALARM.LL;
    var mLv = Math.min(upM, dnM);
    $('m-level').innerHTML = mLv.toFixed(2) + '<small> m</small>';
    $('m-level').parentNode.className = 'mcard' + (upM <= 0 || dnM <= 0 ? ' bad' : (mLv < 1 ? ' warn' : ''));

    var mPr = Math.min(PRES.HI - S.pres, S.pres - PRES.LO);
    $('m-pres').innerHTML = mPr.toFixed(2) + '<small> kPa</small>';
    $('m-pres').parentNode.className = 'mcard' + (mPr <= 0 ? ' bad' : (mPr < 0.2 ? ' warn' : ''));

    var mSt = SET_LIMIT - st.maxDiff;
    $('m-settle').innerHTML = mSt.toFixed(1) + '<small> mm</small>';
    $('m-settle').parentNode.className = 'mcard' + (mSt < 0 ? ' bad' : (mSt < 5 ? ' warn' : ''));

    var g = corrGrade();
    $('m-corr').innerHTML = AE_GRADES[g].g + '<small> 级</small>';
    $('m-corr').parentNode.className = 'mcard' + (g >= 3 ? ' bad' : (g === 2 ? ' warn' : ''));

    var conf = clamp(DATA.maxCu / 8, 0, 0.98);
    $('m-leak').innerHTML = Math.round(conf * 100) + '<small> %</small>';
    $('m-leak').parentNode.className = 'mcard' + (DATA.maxCu > LEAK_TH ? ' bad' : (conf > 0.35 ? ' warn' : ''));
  }

  function renderVerdict(st) {
    var v = $('verdict');
    var bads = [], warns = [];
    if (S.level >= ALARM.HH) bads.push('液位高高 ' + S.level.toFixed(1) + ' m（≥17.5 m）');
    else if (S.level >= ALARM.H) warns.push('液位高 ' + S.level.toFixed(1) + ' m（≥16.8 m）');
    if (S.level <= ALARM.LL) bads.push('液位低低 ' + S.level.toFixed(1) + ' m（≤2.2 m）');
    else if (S.level <= ALARM.L) warns.push('液位低 ' + S.level.toFixed(1) + ' m（≤3.0 m）');
    if (S.pres >= PRES.HI) bads.push('呼吸压力超 +2.0 kPa');
    if (S.pres <= PRES.LO) bads.push('罐内负压 ≤−0.3 kPa');
    if (st.maxDiff > SET_LIMIT) bads.push('差异沉降 ' + st.maxDiff.toFixed(1) + ' mm 超许用 ' + SET_LIMIT + ' mm');
    if (DATA.maxCu > LEAK_TH) bads.push('质量平衡 CUSUM ' + DATA.maxCu.toFixed(1) + ' mm 超阈（泄漏疑似）');
    if (S.radar !== 'ok') warns.push('雷达' + (S.radar === 'frozen' ? '冻结' : '跳变') + '已降权');
    var g = corrGrade();
    if (g >= 3) warns.push('罐底 AE ' + AE_GRADES[g].g + ' 级活跃腐蚀');

    var head = '液位 <b>' + S.level.toFixed(1) + '</b> m · 油温 <b>' + S.temp + '</b> ℃ · 压力 <b>' + S.pres.toFixed(2) + '</b> kPa；';
    if (bads.length) {
      v.className = 'verdict bad';
      v.innerHTML = head + '严重异常：<b>' + bads.join('；') + '</b>。系统按双通道确认后推送值班长，建议动作：联锁/切罐/查围堰（泄漏）、停收付油（液位）、复核呼吸阀（压力）、水准测量（沉降）。';
    } else if (warns.length) {
      v.className = 'verdict warn';
      v.innerHTML = head + '预警提示：<b>' + warns.join('；') + '</b>。三源交叉校验持续有效，偏差 ≤±10 mm，按推送清单人工复核即可。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head + '三源两两一致，交叉偏差 ≤±10 mm，罐底与沉降在许用包络内。状态正常，巡检 2 人/班 → 0.5 人（只处理推送）。';
    }
  }

  /* ---------- ⑤ 预警时间线 ---------- */
  function renderTimeline(st) {
    var items = [];
    function add(sortT, label, sev, text) { items.push({ sortT: sortT, label: label, sev: sev, text: text }); }

    add(0, '00:00', 'ok', '<b>班前校验</b>：三源偏差 6 mm ≤ ±10 mm 门限，视频/雷达/质量平衡互备可信。');
    add(130, '02:10', 'warn', '<b>视频置信度 0.58</b>（夜间红外退化）：自动切换雷达 + 质量平衡为主源，视频降为校验。');

    if (S.opmode === 'in') {
      add(180, '03:00', 'ok', '<b>收油开始</b> 800 m³/h（作业记录已绑定，液位上升不误报）。');
      add(540, '09:00', 'ok', '<b>收油结束</b>：实收 4,800 m³，液位 +1.70 m，质量平衡闭合差 0.02%。');
    } else if (S.opmode === 'out') {
      add(600, '10:00', 'ok', '<b>付油开始</b> 800 m³/h（作业记录已绑定，液位下降不误报）。');
      add(960, '16:00', 'ok', '<b>付油结束</b>：实付 4,800 m³，液位 −1.70 m，质量平衡闭合差 0.02%。');
    } else if (S.opmode === 'stir') {
      add(720, '12:00', 'ok', '<b>罐内搅拌启动</b>：罐温 +1.5 ℃，质量平衡已按 β=7×10⁻⁴/℃ 做温度体积修正。');
    }

    if (S.radar === 'frozen') {
      add(785, '13:05', 'warn', '<b>雷达输出冻结</b>：20 min 方差 0.0 mm（收付油期间液位不变），自动降权至 0.2，切换视频 + 质量平衡主源。');
    } else if (S.radar === 'spike') {
      add(920, '15:20', 'warn', '<b>雷达读数跳变</b> ±0.25 m：与视频、质量平衡双源冲突，判为不可信段并剔除，推送检修工单。');
    }
    if (DATA.crossT !== null) {
      var hh = Math.floor(DATA.crossT), mm = Math.round((DATA.crossT - hh) * 60);
      var lab = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
      add(DATA.crossT * 60, lab, 'bad', '<b>泄漏疑似（双通道确认）</b>：质量平衡残差 CUSUM 超 ' + LEAK_TH + ' mm，且视觉检出罐区油迹（置信 0.72）；较液位低报警提前约 <b>2.6 h</b>。建议：查围堰 → 复核计量 → 必要时切罐。');
    }

    if (S.level >= ALARM.HH) add(9990, '当前', 'bad', '<b>液位高高 ' + S.level.toFixed(1) + ' m</b>（API 2350）：联锁切断收油泵，电话核实调度指令，禁止继续进油。');
    else if (S.level >= ALARM.H) add(9980, '当前', 'warn', '<b>液位高 ' + S.level.toFixed(1) + ' m</b>（≥16.8 m）：通知调度减流，复核收油计划与罐容表。');
    if (S.level <= ALARM.LL) add(9970, '当前', 'bad', '<b>液位低低 ' + S.level.toFixed(1) + ' m</b>（≤2.2 m）：浮顶落地风险，停付油泵并补气。');
    else if (S.level <= ALARM.L) add(9960, '当前', 'warn', '<b>液位低 ' + S.level.toFixed(1) + ' m</b>（≤3.0 m）：付油限流，关注浮顶密封状态。');
    if (S.pres >= PRES.HI) add(9950, '当前', 'bad', '<b>呼吸压力 +' + S.pres.toFixed(2) + ' kPa</b>：超呼吸阀设定，VOC 排放与罐顶超压风险，核查呼吸阀 / 氮封。');
    if (S.pres <= PRES.LO) add(9940, '当前', 'bad', '<b>罐内负压 ' + S.pres.toFixed(2) + ' kPa</b>：浮顶密封变形与罐壁抽瘪风险，核查补气系统。');
    if (st.maxDiff > SET_LIMIT) add(9930, '当前', 'bad', '<b>罐周差异沉降 ' + st.maxDiff.toFixed(1) + ' mm/15.7 m</b>：超 API 653 Annex B 许用（13 mm/10 m），安排水准测量复核并评估浮顶导轨卡阻。');
    var g = corrGrade();
    if (g >= 4) add(9920, '当前', 'bad', '<b>罐底 AE 活动度 V 级</b>：严重活跃腐蚀（热点簇 2 环带 75°–120°），按 JB/T 10764 立即评估停用或就近开罐。');
    else if (g === 3) add(9910, '当前', 'warn', '<b>罐底 AE 活动度 IV 级</b>：高活跃腐蚀区（2 环带 75°–120°），优先安排开罐检验。');

    items.sort(function (a, b) { return a.sortT - b.sortT; });
    var html = '';
    items.forEach(function (it) {
      html += '<li class="' + it.sev + '"><span class="t">' + it.label + '</span><span>' + it.text + '</span></li>';
    });
    $('timeline').innerHTML = html;
  }

  /* ---------- 总渲染 ---------- */
  function render() {
    genSeries();
    drawTank();
    drawSeries();
    drawAE();
    var st = settleStats();
    drawSettle();
    renderMetrics(st);
    renderVerdict(st);
    renderTimeline(st);
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    level: function (v) { return v.toFixed(1) + ' m'; },
    temp: function (v) { return v + ' ℃'; },
    pres: function (v) { return v.toFixed(2) + ' kPa'; },
    corr: function (v) { return v + ' %'; },
    settle: function (v) { return v + ' mm'; },
    leak: function (v) { return v + ' %'; },
    cursor: function (v) { return v.toFixed(1) + ' h'; }
  };
  var SLIDERS = ['level', 'temp', 'pres', 'corr', 'settle', 'leak', 'cursor'];
  var SELECTS = ['opmode', 'radar'];

  function syncInputs() {
    SLIDERS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
    SELECTS.forEach(function (k) { $('s-' + k).value = S[k]; });
  }

  function bind() {
    SLIDERS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    SELECTS.forEach(function (k) {
      $('s-' + k).addEventListener('change', function () {
        S[k] = this.value;
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      syncInputs();
      render();
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

  bind();
  bindTabs();
  bindSeriesTip();
  bindAETip();
  syncInputs();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawSeries(); drawAE(); }, 120);
  });
})();
