/* ======= 修井作业风险智能预警 · 可运行示范 ======= */
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

  /* ---------- 常量与状态 ---------- */
  var WELL_H = 3200;                 /* 作业井深 m（案例口径 1,800–4,200 m 区间取值） */
  var GH = 0.00981 * WELL_H;         /* 每单位当量密度对应的井底压力 MPa */
  var T0 = 0, T1 = 300;              /* 模拟窗口 300 s，1 s 采样 */
  var LOAD_LIMIT = 1200;             /* 大钩载荷上限 kN */
  var ECD = 0.8;                     /* 循环当量循环压耗附加 MPa */

  var DEF = { rho: 1.18, vel: 0.60, kp: 1.14, leak: 0.30, swab: 1.0 };
  var S = Object.assign({}, DEF);

  var PHASES = ['循环压井', '起下管柱', '循环观察'];
  var PHASE_BOUNDS = [0, 90, 240, 300];
  var LEVELS = ['正常', '关注（黄）', '预警（橙）', '紧急（红）'];
  var LVCOL = ['#2f7d6b', '#c9a15a', '#b05a51', '#b05a51'];

  /* 确定性伪噪声（保证渲染可复现） */
  function nz(i, s) { return Math.sin(i * 0.7 + s) * 0.5 + Math.sin(i * 0.137 + s * 2.3) * 0.5; }

  function fmtT(t) {
    var m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- 秒级过程仿真 ---------- */
  function simulate() {
    var Pform = S.kp * GH;
    var Pstatic = S.rho * GH;
    var kf = 1.72 - 0.35 * S.leak;   /* 破裂压力当量密度系数 */
    var Pfrac = kf * GH;
    var rows = [], pitDev = 0, fd = 0;
    for (var t = T0; t <= T1; t++) {
      var phase = t < 90 ? 0 : (t < 240 ? 1 : 2);
      var circ = phase !== 1;
      var vInst = 0;
      if (phase === 1) {             /* 起下管柱：30 s 一柱的周期速度剖面 */
        var tt = (t - 90) % 30;
        vInst = S.vel * Math.sin(Math.PI * tt / 30);
      }
      var pSwab = 1.6 * S.swab * vInst * vInst;          /* 抽汲压降 ∝ k·v² */
      var Pbh = Pstatic + (circ ? ECD : 0) - pSwab + 0.06 * nz(t, 3);
      var under = Pform - Pbh;       /* >0 欠平衡 → 溢流 */
      var over = Pbh - Pfrac;        /* >0 超破裂 → 井漏 */
      var tgt = 0;
      if (under > 0) tgt = Math.min(25, under * 10);
      else if (over > 0) tgt = -Math.min(20, over * 8 * (0.4 + S.leak));
      fd = fd * 0.88 + tgt * 0.12;   /* 出口-入口流量差 L/s，带惯性 */
      pitDev += fd / 1000;           /* 池液面累计偏差 m³ */
      var spp = circ ? Math.max(0, 9.5 + 0.6 * nz(t, 1) - Math.max(0, under) * 0.7 - Math.max(0, over) * 1.5 * S.leak) : 0;
      var hook;
      if (phase === 1) {
        var prog = (t - 90) / 150;
        hook = 900 - prog * 380 + 320 * S.swab * vInst * vInst + 8 * nz(t, 5);
      } else {
        hook = (phase === 0 ? 900 : 520) + 8 * nz(t, 5);
      }
      var margin = Pbh - Pform;      /* 井控余量 */
      var lv = 0;
      if (under > 0 || over > 0 || Math.abs(pitDev) > 1.5 || hook > LOAD_LIMIT) lv = 3;
      else if (margin < 0.3 || Math.abs(pitDev) > 0.8 || hook > LOAD_LIMIT * 0.97) lv = 2;
      else if (margin < 0.7 || Math.abs(pitDev) > 0.3 || hook > LOAD_LIMIT * 0.9) lv = 1;
      rows.push({ t: t, phase: phase, hook: hook, spp: spp, Pbh: Pbh, margin: margin, fd: fd, pit: pitDev, under: under, over: over, lv: lv, pSwab: pSwab });
    }
    var tKick = -1, tLoss = -1, tStuck = -1, firstOrange = -1, maxLv = 0, minMargin = 1e9, maxSwab = 0, pitNet = pitDev, pitMax = 0;
    rows.forEach(function (r) {
      if (r.under > 0 && tKick < 0) tKick = r.t;
      if (r.over > 0 && tLoss < 0) tLoss = r.t;
      if (r.hook > LOAD_LIMIT && tStuck < 0) tStuck = r.t;
      if (r.lv >= 2 && firstOrange < 0) firstOrange = r.t;
      if (r.lv > maxLv) maxLv = r.lv;
      if (r.margin < minMargin) minMargin = r.margin;
      if (r.pSwab > maxSwab) maxSwab = r.pSwab;
      if (Math.abs(r.pit) > pitMax) pitMax = Math.abs(r.pit);
    });
    var evStart = -1;
    [tKick, tLoss, tStuck].forEach(function (x) { if (x >= 0 && (evStart < 0 || x < evStart)) evStart = x; });
    var lead = null;
    if (evStart >= 0) lead = (firstOrange >= 0 && firstOrange <= evStart) ? (evStart - firstOrange) : 0;
    return {
      rows: rows, Pform: Pform, Pfrac: Pfrac, kf: kf,
      tKick: tKick, tLoss: tLoss, tStuck: tStuck, firstOrange: firstOrange, evStart: evStart, lead: lead,
      maxLv: maxLv, minMargin: minMargin, maxSwab: maxSwab, pitNet: pitNet, pitMax: pitMax
    };
  }

  /* ---------- 面板 1：实时风险监测曲线 ---------- */
  var MON = { W: 860, H: 352, pl: 46, pr: 46, hover: null };
  var S1 = { y: 20, h: 88 }, S2 = { y: 120, h: 106 }, S3 = { y: 238, h: 74 };

  function monX(t) { return MON.pl + (t - T0) / (T1 - T0) * (MON.W - MON.pl - MON.pr); }

  function drawMon(sim) {
    var cv = $('mon'), ctx = setupCanvas(cv, MON.W, MON.H);
    var W = MON.W, H = MON.H, pl = MON.pl, pr = MON.pr;
    var pw = W - pl - pr;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    /* 量程 */
    var hMin = 400, hMax = 1300;
    var pMax = Math.max(sim.Pfrac, sim.Pform, 45) + 4;
    pMax = Math.ceil(pMax / 5) * 5;
    var pitMax = Math.max(2, sim.pitMax * 1.15);
    var fdMax = 25;

    function yHook(v) { return S1.y + S1.h - (v - hMin) / (hMax - hMin) * S1.h; }
    function yPres(v) { return S2.y + S2.h - v / pMax * S2.h; }
    function yPit(v) { return S3.y + S3.h / 2 - v / pitMax * (S3.h / 2); }
    function yFd(v) { return S3.y + S3.h / 2 - v / fdMax * (S3.h / 2); }

    /* 风险背景色带（跨三条子图） */
    sim.rows.forEach(function (r) {
      if (r.lv < 1) return;
      var x0 = monX(r.t), x1 = monX(r.t + 1);
      ctx.fillStyle = LVCOL[r.lv];
      ctx.globalAlpha = r.lv === 1 ? 0.08 : (r.lv === 2 ? 0.14 : 0.22);
      ctx.fillRect(x0, S1.y, Math.max(0.6, x1 - x0), S3.y + S3.h - S1.y);
      ctx.globalAlpha = 1;
    });

    /* 网格与子图边框 */
    ctx.font = '9px Consolas, monospace';
    ctx.strokeStyle = '#cfc7b6';
    [S1, S2, S3].forEach(function (sp) {
      ctx.strokeRect(pl, sp.y, pw, sp.h);
    });
    ctx.fillStyle = '#9ba3a9';
    ctx.textAlign = 'right';
    [400, 700, 1000, 1300].forEach(function (v) {
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(pl, yHook(v)); ctx.lineTo(pl + pw, yHook(v)); ctx.stroke();
      ctx.fillText(v + '', pl - 5, yHook(v) + 3);
    });
    for (var v = 0; v <= pMax; v += 10) {
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(pl, yPres(v)); ctx.lineTo(pl + pw, yPres(v)); ctx.stroke();
      ctx.fillText(v + '', pl - 5, yPres(v) + 3);
    }
    [-1, -0.5, 0, 0.5, 1].forEach(function (f) {
      var vv = f * pitMax;
      var yy = yPit(vv);
      ctx.strokeStyle = f === 0 ? '#d8d0bc' : '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, yy); ctx.lineTo(pl + pw, yy); ctx.stroke();
      ctx.fillText(vv.toFixed(1), pl - 5, yy + 3);
    });
    /* 子图 3 右轴：流量差 */
    ctx.textAlign = 'left';
    [-25, 0, 25].forEach(function (v) {
      ctx.fillText(v + '', pl + pw + 5, yFd(v) + 3);
    });

    /* 子图标题 */
    ctx.textAlign = 'left';
    ctx.fillStyle = '#79828a';
    ctx.font = '9px sans-serif';
    ctx.fillText('大钩载荷 (kN)', pl + 5, S1.y + 11);
    ctx.fillText('压力 (MPa)', pl + 5, S2.y + 11);
    ctx.fillText('池液面偏差 (m³) / 出口-入口流量差 (L/s，右轴)', pl + 5, S3.y + 11);

    /* 工序分隔 */
    ctx.strokeStyle = '#cfc7b6';
    ctx.setLineDash([4, 3]);
    [90, 240].forEach(function (t) {
      ctx.beginPath(); ctx.moveTo(monX(t), S1.y); ctx.lineTo(monX(t), S3.y + S3.h); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.fillStyle = '#79828a';
    ctx.textAlign = 'center';
    ctx.font = '9px sans-serif';
    for (var p = 0; p < 3; p++) {
      var cxp = (monX(PHASE_BOUNDS[p]) + monX(PHASE_BOUNDS[p + 1])) / 2;
      ctx.fillText(PHASES[p], cxp, S1.y - 6);
    }

    function plot(getY, color, width, dash) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1.5;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      sim.rows.forEach(function (r, i) {
        var x = monX(r.t), y = getY(r);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    /* 子图 1：大钩载荷 + 上限 */
    plot(function (r) { return yHook(r.hook); }, '#41699b', 1.8);
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yHook(LOAD_LIMIT)); ctx.lineTo(pl + pw, yHook(LOAD_LIMIT)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right'; ctx.font = '8.5px Consolas, monospace';
    ctx.fillText('上限 1200 kN', pl + pw - 4, yHook(LOAD_LIMIT) - 3);

    /* 子图 2：井底压力 / 地层压力 / 破裂压力 / 立管压力 */
    plot(function (r) { return yPres(r.Pbh); }, '#2f7d6b', 2);
    ctx.strokeStyle = '#b05a51'; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yPres(sim.Pform)); ctx.lineTo(pl + pw, yPres(sim.Pform)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right';
    ctx.fillText('地层压力 ' + sim.Pform.toFixed(1) + ' MPa', pl + pw - 4, yPres(sim.Pform) - 3);
    ctx.strokeStyle = '#79828a'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pl, yPres(sim.Pfrac)); ctx.lineTo(pl + pw, yPres(sim.Pfrac)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#79828a'; ctx.textAlign = 'right';
    ctx.fillText('破裂压力当量 ' + sim.Pfrac.toFixed(1) + ' MPa', pl + pw - 4, yPres(sim.Pfrac) - 3);
    plot(function (r) { return yPres(r.spp); }, '#c9a15a', 1.3);

    /* 子图 3：池液面偏差（面积）+ 流量差（线） */
    ctx.fillStyle = 'rgba(65,105,155,0.22)';
    ctx.beginPath();
    ctx.moveTo(monX(T0), yPit(0));
    sim.rows.forEach(function (r) { ctx.lineTo(monX(r.t), yPit(clamp(r.pit, -pitMax, pitMax))); });
    ctx.lineTo(monX(T1), yPit(0));
    ctx.closePath(); ctx.fill();
    plot(function (r) { return yPit(clamp(r.pit, -pitMax, pitMax)); }, '#41699b', 1.6);
    plot(function (r) { return yFd(r.fd); }, '#b05a51', 1.3);

    /* 时间轴 */
    ctx.fillStyle = '#9ba3a9';
    ctx.textAlign = 'center';
    ctx.font = '9px Consolas, monospace';
    for (var t = 0; t <= T1; t += 60) {
      ctx.fillText(fmtT(t), monX(t), S3.y + S3.h + 13);
    }
    ctx.fillStyle = '#5d666d';
    ctx.font = '9px sans-serif';
    ctx.fillText('作业时间 (mm:ss) · 循环压井 → 起下管柱 → 循环观察', pl + pw / 2, H - 4);

    /* 悬停十字线 */
    if (MON.hover !== null) {
      var ht = clamp(MON.hover, T0, T1);
      var hx = monX(ht);
      ctx.strokeStyle = '#79828a';
      ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(hx, S1.y); ctx.lineTo(hx, S3.y + S3.h); ctx.stroke();
      ctx.setLineDash([]);
      var row = sim.rows[ht];
      [[yHook(row.hook), '#41699b'], [yPres(row.Pbh), '#2f7d6b'], [yPit(clamp(row.pit, -pitMax, pitMax)), '#41699b']].forEach(function (pt) {
        ctx.fillStyle = pt[1];
        ctx.beginPath(); ctx.arc(hx, pt[0], 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.stroke();
      });
    }
  }

  /* ---------- 面板 2：井控安全窗口图 ---------- */
  var WIN = { W: 430, H: 300, pl: 44, pr: 12, pt: 24, pb: 30, hover: null };
  var WIN_X0 = 0.95, WIN_X1 = 1.50, WIN_Y0 = 1.00, WIN_Y1 = 1.60;

  function winX(kp) { return WIN.pl + (kp - WIN_X0) / (WIN_X1 - WIN_X0) * (WIN.W - WIN.pl - WIN.pr); }
  function winY(rho) { return 24 + (WIN_Y1 - rho) / (WIN_Y1 - WIN_Y0) * (WIN.H - 24 - 30); }
  function winInvX(px) { return WIN_X0 + (px - WIN.pl) / (WIN.W - WIN.pl - WIN.pr) * (WIN_X1 - WIN_X0); }
  function winInvY(py) { return WIN_Y1 - (py - 24) / (WIN.H - 24 - 30) * (WIN_Y1 - WIN_Y0); }

  function drawWin(sim) {
    var cv = $('win'), ctx = setupCanvas(cv, WIN.W, WIN.H);
    var W = WIN.W, H = WIN.H, pl = WIN.pl, pr = WIN.pr, pt = 24, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var kf = sim.kf;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    function poly(pts, color, alpha) {
      ctx.fillStyle = color; ctx.globalAlpha = alpha;
      ctx.beginPath();
      pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }

    /* 溢流区（ρ < Kp） */
    poly([[winX(WIN_X0), winY(WIN_Y0)], [winX(WIN_X1), winY(WIN_Y0)], [winX(WIN_X1), winY(WIN_X1)]], '#b05a51', 0.07);
    /* 余量不足带（Kp ≤ ρ < Kp+0.05） */
    poly([[winX(WIN_X0), winY(WIN_X0)], [winX(WIN_X1), winY(WIN_X1)], [winX(WIN_X1), winY(WIN_X1 + 0.05)], [winX(WIN_X0), winY(WIN_X0 + 0.05)]], '#c9a15a', 0.10);
    /* 推荐区（Kp+0.05 ≤ ρ ≤ Kp+0.10，SY/T 6426 油水井附加值） */
    poly([[winX(WIN_X0), winY(WIN_X0 + 0.05)], [winX(WIN_X1), winY(WIN_X1 + 0.05)], [winX(WIN_X1), winY(WIN_X1 + 0.10)], [winX(WIN_X0), winY(WIN_X0 + 0.10)]], '#2f7d6b', 0.14);
    /* 漏失区（ρ > 破裂当量 kf） */
    if (kf < WIN_Y1) poly([[pl, pt], [pl + pw, pt], [pl + pw, winY(kf)], [pl, winY(kf)]], '#b05a51', 0.07);

    /* 网格与刻度 */
    ctx.font = '8.5px Consolas, monospace';
    for (var gx = 1.0; gx <= WIN_X1 + 1e-6; gx += 0.1) {
      var xx = winX(gx);
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(xx, pt); ctx.lineTo(xx, pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(gx.toFixed(1), xx, pt + ph + 12);
    }
    for (var gy = 1.0; gy <= WIN_Y1 + 1e-6; gy += 0.1) {
      var yy = winY(gy);
      ctx.strokeStyle = '#efece1'; ctx.beginPath(); ctx.moveTo(pl, yy); ctx.lineTo(pl + pw, yy); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(gy.toFixed(1), pl - 5, yy + 3);
    }
    ctx.strokeStyle = '#cfc7b6'; ctx.strokeRect(pl, pt, pw, ph);

    /* 边界线 */
    function line(x0, y0, x1, y1, color, dash, w) {
      ctx.strokeStyle = color; ctx.lineWidth = w || 1.3;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    line(winX(WIN_X0), winY(WIN_X0), winX(WIN_X1), winY(WIN_X1), '#b05a51', [5, 3]);
    line(winX(WIN_X0), winY(WIN_X0 + 0.05), winX(WIN_X1), winY(WIN_X1 + 0.05), '#2f7d6b', [4, 3], 1);
    line(winX(WIN_X0), winY(WIN_X0 + 0.10), winX(WIN_X1), winY(WIN_X1 + 0.10), '#2f7d6b', [4, 3], 1);
    var kfInView = kf <= WIN_Y1;
    if (kfInView) line(pl, winY(kf), pl + pw, winY(kf), '#c9a15a', [5, 3]);

    /* 标注（避开边界相互重叠） */
    ctx.font = '8.5px sans-serif';
    ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right';
    ctx.fillText('溢流线 ρ=Kp', winX(1.42), winY(1.42) + 11);
    ctx.fillStyle = '#c9a15a'; ctx.textAlign = 'left';
    if (kfInView) ctx.fillText('漏失线 ρ=' + kf.toFixed(2), pl + 6, winY(kf) - 4);
    else ctx.fillText('漏失线 ρ=' + kf.toFixed(2) + '（超出图上范围）', pl + 6, pt + 10);
    ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'center';
    ctx.fillText('推荐安全区（附加 0.05–0.10）', winX(1.18), winY(1.18 + 0.075) + 3);

    /* 当前工况点 */
    var cx = winX(clamp(S.kp, WIN_X0, WIN_X1)), cy = winY(clamp(S.rho, WIN_Y0, WIN_Y1));
    var safe = S.rho >= S.kp + 0.05 && S.rho <= kf;
    ctx.strokeStyle = '#79828a'; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(cx, pt); ctx.lineTo(cx, pt + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pl, cy); ctx.lineTo(pl + pw, cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = safe ? '#c9a15a' : '#b05a51';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#5d666d'; ctx.textAlign = cx > pl + pw - 90 ? 'right' : 'left';
    ctx.font = '8.5px Consolas, monospace';
    ctx.fillText('当前 (' + S.kp.toFixed(2) + ', ' + S.rho.toFixed(2) + ')', cx + (cx > pl + pw - 90 ? -8 : 8), cy - 7);

    /* 悬停点 */
    if (WIN.hover) {
      var hx = clamp(WIN.hover.x, pl, pl + pw), hy = clamp(WIN.hover.y, pt, pt + ph);
      ctx.strokeStyle = '#41699b';
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.stroke();
    }

    /* 轴标题 */
    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center'; ctx.font = '9px sans-serif';
    ctx.fillText('地层压力系数 Kp', pl + pw / 2, H - 4);
    ctx.save();
    ctx.translate(12, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('压井液密度 (g/cm³)', 0, 0);
    ctx.restore();
  }

  /* ---------- 面板 3：风险分级预警时间线 ---------- */
  var TL = { W: 860, H: 140, pl: 46, pr: 20, hover: null };

  function tlX(t) { return TL.pl + (t - T0) / (T1 - T0) * (TL.W - TL.pl - TL.pr); }

  function drawTl(sim) {
    var cv = $('tl'), ctx = setupCanvas(cv, TL.W, TL.H);
    var W = TL.W, H = TL.H, pl = TL.pl, pr = TL.pr;
    var pw = W - pl - pr;
    var barY = 48, barH = 26;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    /* 标题行 */
    ctx.fillStyle = '#79828a'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('逐秒风险等级（滑窗复核：残差能量 × 变化率 × 持续时长，三条件同时满足才升级）', pl, 14);

    /* 逐秒着色 */
    sim.rows.forEach(function (r) {
      var x0 = tlX(r.t), x1 = tlX(r.t + 1);
      ctx.fillStyle = LVCOL[r.lv];
      ctx.globalAlpha = r.lv === 0 ? 0.28 : (r.lv === 1 ? 0.75 : (r.lv === 2 ? 0.6 : 1));
      ctx.fillRect(x0, barY, Math.max(0.6, x1 - x0), barH);
      ctx.globalAlpha = 1;
    });
    ctx.strokeStyle = '#cfc7b6';
    ctx.strokeRect(pl, barY, pw, barH);

    /* 时间刻度 */
    ctx.fillStyle = '#9ba3a9'; ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'center';
    for (var t = 0; t <= T1; t += 60) {
      ctx.fillText(fmtT(t), tlX(t), barY + barH + 13);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(tlX(t), barY + barH); ctx.lineTo(tlX(t), barY + barH + 5); ctx.stroke();
    }

    /* 事件标记 */
    function marker(t, label, color, above) {
      if (t < 0) return;
      var x = tlX(t);
      ctx.fillStyle = color;
      ctx.beginPath();
      if (above) { ctx.moveTo(x, barY - 3); ctx.lineTo(x - 4, barY - 10); ctx.lineTo(x + 4, barY - 10); }
      else { ctx.moveTo(x, barY + barH + 3); ctx.lineTo(x - 4, barY + barH + 10); ctx.lineTo(x + 4, barY + barH + 10); }
      ctx.closePath(); ctx.fill();
      ctx.font = '8.5px sans-serif';
      ctx.textAlign = x > pl + pw - 110 ? 'right' : (x < pl + 60 ? 'left' : 'center');
      var ty = above ? barY - 13 : barY + barH + 24;
      ctx.fillText(label + ' ' + fmtT(t), x + (ctx.textAlign === 'right' ? -5 : (ctx.textAlign === 'left' ? 5 : 0)), ty);
    }
    marker(sim.tKick, '溢流开始', '#b05a51', true);
    marker(sim.tLoss, '井漏开始', '#c9a15a', false);
    marker(sim.tStuck, '卡钻·载荷超限', '#41699b', true);

    /* 预警提前量标注 */
    ctx.font = '8.5px sans-serif';
    if (sim.evStart >= 0 && sim.lead !== null && sim.lead > 0) {
      var xa = tlX(sim.firstOrange), xb = tlX(sim.evStart), ay = H - 14;
      ctx.strokeStyle = '#2f7d6b';
      ctx.beginPath(); ctx.moveTo(xa, ay); ctx.lineTo(xb, ay); ctx.stroke();
      [[xa, 1], [xb, -1]].forEach(function (e) {
        ctx.beginPath(); ctx.moveTo(e[0], ay); ctx.lineTo(e[0] + 5 * e[1], ay - 3); ctx.lineTo(e[0] + 5 * e[1], ay + 3); ctx.closePath();
        ctx.fillStyle = '#2f7d6b'; ctx.fill();
      });
      ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'center';
      ctx.fillText('提前 ' + sim.lead + ' s 预警', (xa + xb) / 2, ay - 4);
    } else if (sim.evStart >= 0) {
      ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right';
      ctx.fillText('事件先于橙级预警出现：未提前', pl + pw, H - 12);
    } else {
      ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'right';
      ctx.fillText('本窗口内无紧急事件', pl + pw, H - 12);
    }

    /* 悬停 */
    if (TL.hover !== null) {
      var ht = clamp(TL.hover, T0, T1);
      ctx.strokeStyle = '#79828a';
      ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(tlX(ht), barY - 12); ctx.lineTo(tlX(ht), barY + barH + 4); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ---------- 指标卡与结论 ---------- */
  function renderMetrics(sim) {
    var mm = sim.minMargin;
    $('m-margin').innerHTML = mm.toFixed(2) + '<small> MPa</small>';
    $('m-margin').parentNode.className = 'mcard' + (mm < 0 ? ' bad' : (mm < 0.7 ? ' warn' : ''));

    $('m-swab').innerHTML = sim.maxSwab.toFixed(2) + '<small> MPa</small>';
    $('m-swab').parentNode.className = 'mcard' + (sim.maxSwab > 1.5 ? ' warn' : '');

    var pn = sim.pitNet;
    $('m-pit').innerHTML = (pn >= 0 ? '+' : '') + pn.toFixed(2) + '<small> m³</small>';
    $('m-pit').parentNode.className = 'mcard' + (Math.abs(pn) > 1.5 ? ' bad' : (Math.abs(pn) > 0.3 ? ' warn' : ''));

    $('m-level').textContent = LEVELS[sim.maxLv];
    $('m-level').parentNode.className = 'mcard' + (sim.maxLv >= 3 ? ' bad' : (sim.maxLv >= 1 ? ' warn' : ''));

    if (sim.lead === null) {
      $('m-lead').textContent = '—';
      $('m-lead').parentNode.className = 'mcard';
    } else if (sim.lead > 0) {
      $('m-lead').innerHTML = sim.lead + '<small> s</small>';
      $('m-lead').parentNode.className = 'mcard';
    } else {
      $('m-lead').textContent = '未提前';
      $('m-lead').parentNode.className = 'mcard bad';
    }
  }

  function renderVerdict(sim) {
    var v = $('verdict');
    var head = '井底压力 ' + (S.rho * GH).toFixed(1) + ' MPa（密度 ' + S.rho.toFixed(2) + ' g/cm³ × 井深 3,200 m）· 地层压力 ' + sim.Pform.toFixed(1) + ' MPa · 破裂压力当量 ' + sim.Pfrac.toFixed(1) + ' MPa；';
    var events = [];
    if (sim.tKick >= 0) events.push('溢流（' + fmtT(sim.tKick) + ' 起，欠平衡 ' + Math.max(0, -sim.minMargin).toFixed(2) + ' MPa）');
    if (sim.tLoss >= 0) events.push('井漏（' + fmtT(sim.tLoss) + ' 起）');
    if (sim.tStuck >= 0) events.push('卡钻·载荷超限（' + fmtT(sim.tStuck) + ' 起）');

    if (sim.maxLv >= 3) {
      v.className = 'verdict bad';
      var advice = [];
      if (sim.tKick >= 0) advice.push('提高压井液密度或降低起钻速度以恢复井控余量');
      if (sim.tLoss >= 0) advice.push('降低密度 / 控压循环，必要时桥接堵漏');
      if (sim.tStuck >= 0) advice.push('降低起钻速度与抽汲系数，活动管柱解卡');
      v.innerHTML = head + '<b>紧急（红）</b>：' + events.join('、') + '。处置建议：立即停泵 / 停止起下，' + advice.join('；') + '。';
      return;
    }
    if (sim.maxLv === 2) {
      v.className = 'verdict warn';
      v.innerHTML = head + '<b>预警（橙）</b>：井控余量最低 ' + sim.minMargin.toFixed(2) + ' MPa 或池液面 / 载荷逼近阈值，3 min 内须处置：校核密度附加值、将起钻速度压至抽汲临界速度以下。';
      return;
    }
    if (sim.maxLv === 1) {
      v.className = 'verdict warn';
      v.innerHTML = head + '<b>关注（黄）</b>：起下管柱段抽汲使井控余量收窄至 ' + sim.minMargin.toFixed(2) + ' MPa（<0.7 MPa），10 min 内复查密度与速度匹配即可，暂不需停钻。';
      return;
    }
    v.className = 'verdict ok';
    v.innerHTML = head + '<b>正常</b>：全程井控余量 ≥0.7 MPa，池液面与大钩载荷均在基线包络内，可按当前参数继续作业。';
  }

  /* ---------- 模拟页渲染总入口 ---------- */
  var SIM = null;
  function renderSim() {
    SIM = simulate();
    drawMon(SIM);
    drawWin(SIM);
    drawTl(SIM);
    renderMetrics(SIM);
    renderVerdict(SIM);
  }

  /* ---------- 悬停 tooltip 绑定 ---------- */
  function bindHover(cvId, tipId, toData, makeHtml, onMove) {
    var cv = $(cvId), tip = $(tipId);
    if (!cv || !tip) return;
    var box = cv.parentNode.parentNode; /* .chart-box */
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (cv === $('mon') ? MON.W : (cv === $('tl') ? TL.W : WIN.W)) / r.width;
      var ly = (evt.clientY - r.top) * (cv === $('mon') ? MON.H : (cv === $('tl') ? TL.H : WIN.H)) / r.height;
      var d = toData(lx, ly);
      if (d === null) { tip.style.display = 'none'; onHover(cvId, null); return; }
      onHover(cvId, d);
      tip.innerHTML = makeHtml(d);
      tip.style.display = 'block';
      var rb = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 250) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 90) + 'px';
    });
    cv.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      onHover(cvId, null);
    });
  }

  function onHover(id, d) {
    if (!SIM) return;
    if (id === 'mon') { MON.hover = d === null ? null : d.t; drawMon(SIM); }
    else if (id === 'win') { WIN.hover = d === null ? null : { x: d.px, y: d.py }; drawWin(SIM); }
    else if (id === 'tl') { TL.hover = d === null ? null : d.t; drawTl(SIM); }
  }

  function bindSimHovers() {
    bindHover('mon', 'mon-tip', function (lx, ly) {
      if (ly < S1.y || ly > S3.y + S3.h) return null;
      var t = Math.round((lx - MON.pl) / (MON.W - MON.pl - MON.pr) * (T1 - T0));
      t = clamp(t, T0, T1);
      return { t: t };
    }, function (d) {
      var r = SIM.rows[d.t];
      var h = '<b>' + fmtT(r.t) + '</b> · ' + PHASES[r.phase] + '<br>' +
        '大钩载荷 <b>' + r.hook.toFixed(0) + ' kN</b> · 立管压力 <b>' + r.spp.toFixed(1) + ' MPa</b><br>' +
        '井底压力 <b>' + r.Pbh.toFixed(2) + ' MPa</b> · 井控余量 <b>' + (r.margin >= 0 ? '+' : '') + r.margin.toFixed(2) + ' MPa</b><br>' +
        '流量差 <b>' + (r.fd >= 0 ? '+' : '') + r.fd.toFixed(1) + ' L/s</b> · 池液面 <b>' + (r.pit >= 0 ? '+' : '') + r.pit.toFixed(2) + ' m³</b><br>' +
        '风险等级：<b style="color:' + LVCOL[r.lv] + '">' + LEVELS[r.lv] + '</b>';
      return h;
    }, null);

    bindHover('win', 'win-tip', function (lx, ly) {
      if (lx < WIN.pl || lx > WIN.W - WIN.pr || ly < 24 || ly > WIN.H - 30) return null;
      return { px: lx, py: ly, kp: winInvX(lx), rho: winInvY(ly) };
    }, function (d) {
      var mU = (d.rho - d.kp) * GH;          /* 溢流余量 */
      var mF = (SIM.kf - d.rho) * GH;        /* 漏失余量 */
      var zone;
      if (d.rho < d.kp) zone = '<span style="color:#b05a51">溢流区（欠平衡）</span>';
      else if (d.rho > SIM.kf) zone = '<span style="color:#b05a51">漏失区（超破裂压力）</span>';
      else if (d.rho < d.kp + 0.05) zone = '<span style="color:#c9a15a">余量不足（附加 <0.05）</span>';
      else if (d.rho <= d.kp + 0.10) zone = '<span style="color:#2f7d6b">推荐安全区</span>';
      else zone = '<span style="color:#79828a">安全偏高（密度偏大，接近漏失）</span>';
      return 'Kp <b>' + d.kp.toFixed(2) + '</b> · ρ <b>' + d.rho.toFixed(2) + ' g/cm³</b><br>' +
        '溢流余量 <b>' + (mU >= 0 ? '+' : '') + mU.toFixed(2) + ' MPa</b><br>' +
        '漏失余量 <b>' + (mF >= 0 ? '+' : '') + mF.toFixed(2) + ' MPa</b><br>' + zone;
    }, null);

    bindHover('tl', 'tl-tip', function (lx, ly) {
      if (ly < 34 || ly > 78) return null;
      var t = Math.round((lx - TL.pl) / (TL.W - TL.pl - TL.pr) * (T1 - T0));
      t = clamp(t, T0, T1);
      return { t: t };
    }, function (d) {
      var r = SIM.rows[d.t];
      return '<b>' + fmtT(r.t) + '</b> · ' + PHASES[r.phase] + '<br>风险等级：<b style="color:' + LVCOL[r.lv] + '">' + LEVELS[r.lv] + '</b><br>井控余量 <b>' + (r.margin >= 0 ? '+' : '') + r.margin.toFixed(2) + ' MPa</b>';
    }, null);
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    rho: function (v) { return v.toFixed(2) + ' g/cm³'; },
    vel: function (v) { return v.toFixed(2) + ' m/s'; },
    kp: function (v) { return v.toFixed(2); },
    leak: function (v) { return v.toFixed(2); },
    swab: function (v) { return v.toFixed(1) + ' ×'; }
  };
  var KEYS = ['rho', 'vel', 'kp', 'leak', 'swab'];

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
        renderSim();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      KEYS.forEach(function (k) { $('s-' + k).value = DEF[k]; });
      readInputs();
      renderSim();
    });
  }

  /* ---------- 真实数据页：密度安全附加值标准对比 ---------- */
  var REF = { W: 860, H: 196, pl: 200, pr: 60, hover: null };
  var REF_ROWS = [
    { name: 'SY/T 6426-2005 油水井', lo: 0.05, hi: 0.10, note: '密度安全附加值 0.05–0.10 g/cm³（修井压井液参照）' },
    { name: 'SY/T 6426-2005 气井', lo: 0.07, hi: 0.15, note: '气井附加值 0.07–0.15 g/cm³，取更高' },
    { name: 'AQ/T 2076-2020 页岩气', lo: 0.07, hi: 0.15, note: '附加值 0.07–0.15 g/cm³ 或井底压差 3–5 MPa，含硫取上限' }
  ];
  var REF_X1 = 0.20;

  function refX(v) { return REF.pl + v / REF_X1 * (REF.W - REF.pl - REF.pr); }

  function drawRef() {
    var cv = $('refc'); if (!cv) return;
    var ctx = setupCanvas(cv, REF.W, REF.H);
    var W = REF.W, H = REF.H, pl = REF.pl, pr = REF.pr;
    var pw = W - pl - pr;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#79828a'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('钻井液 / 压井液密度安全附加值标准规定（g/cm³，以最高地层孔隙压力当量密度为基准附加）', pl - 150, 14);

    /* 刻度 */
    ctx.font = '9px Consolas, monospace';
    for (var v = 0; v <= REF_X1 + 1e-6; v += 0.05) {
      var x = refX(v);
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x, H - 30); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(v.toFixed(2), x, H - 16);
    }
    ctx.fillStyle = '#5d666d'; ctx.font = '9px sans-serif';
    ctx.fillText('安全附加值 (g/cm³)', pl + pw / 2, H - 3);

    /* 推荐带 0.05–0.10（油水井，本 demo 推荐区口径） */
    ctx.fillStyle = '#2f7d6b'; ctx.globalAlpha = 0.08;
    ctx.fillRect(refX(0.05), 26, refX(0.10) - refX(0.05), H - 56);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'center'; ctx.font = '8.5px sans-serif';
    ctx.fillText('demo 推荐区', (refX(0.05) + refX(0.10)) / 2, 34);

    REF_ROWS.forEach(function (r, i) {
      var y = 52 + i * 44, bh = 20;
      ctx.fillStyle = '#4d565b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(r.name, pl - 8, y + bh / 2 + 3);
      var sel = REF.hover === i;
      ctx.fillStyle = '#2f7d6b'; ctx.globalAlpha = sel ? 1 : 0.75;
      ctx.beginPath();
      ctx.fillRect(refX(r.lo), y, refX(r.hi) - refX(r.lo), bh);
      ctx.globalAlpha = 1;
      if (sel) { ctx.strokeStyle = '#1d4a3f'; ctx.lineWidth = 2; ctx.strokeRect(refX(r.lo), y, refX(r.hi) - refX(r.lo), bh); ctx.lineWidth = 1; }
      ctx.fillStyle = '#235f51'; ctx.font = '9px Consolas, monospace';
      ctx.textAlign = 'right'; ctx.fillText(r.lo.toFixed(2), refX(r.lo) - 5, y + bh / 2 + 3);
      ctx.textAlign = 'left'; ctx.fillText(r.hi.toFixed(2), refX(r.hi) + 5, y + bh / 2 + 3);
    });
  }

  function bindRefHover() {
    var cv = $('refc'), tip = $('ref-tip');
    if (!cv || !tip) return;
    var box = cv.parentNode.parentNode;
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var ly = (evt.clientY - r.top) * (REF.H / r.height);
      var idx = -1;
      REF_ROWS.forEach(function (row, i) {
        var y = 52 + i * 44;
        if (ly >= y - 4 && ly <= y + 24) REF.hover = i, idx = i;
      });
      if (idx < 0) REF.hover = null;
      drawRef();
      if (idx >= 0) {
        var row = REF_ROWS[idx];
        var rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + row.name + '</b><br>附加值区间 <b>' + row.lo.toFixed(2) + '–' + row.hi.toFixed(2) + ' g/cm³</b><br><span style="color:#8a9298">' + row.note + '</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 250) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { REF.hover = null; drawRef(); tip.style.display = 'none'; });
  }

  /* ---------- 页签切换 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    function activate(id) {
      tabs.forEach(function (o) { o.classList.toggle('active', o.getAttribute('data-tab') === id); });
      panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
      if (id === 'real') drawRef();
      if (id === 'sim') renderSim();
    }
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { activate(this.getAttribute('data-tab')); });
    });
    if (location.hash === '#real') activate('real');
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      renderSim();
      if ($('pane-real').classList.contains('active')) drawRef();
    }, 120);
  });

  bind();
  bindTabs();
  readInputs();
  renderSim();
  bindSimHovers();
  bindRefHover();
  drawRef();
})();
