/* ======= 初至波智能拾取与静校正闭环 · 可运行示范 ======= */
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

  /* ---------- 随机数 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gaussOf(rnd) {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- 物理模型常量（对标案例口径） ---------- */
  var NT = 2200;                  // 采样点数，1 ms
  var NTR = 24;                   // 道数
  var X0 = 300, DX = 120;         // 偏移距 300–3060 m
  var T0 = 150;                   // 折射截距时间 ms
  var VREF = 2200;                // 折射速度 m/s（案例范围 800–2600）
  var VDIR = 850;                 // 直达波速度 m/s
  var F0 = 32;                    // 初至子波主频 Hz

  var X = [];
  for (var xi = 0; xi < NTR; xi++) X.push(X0 + xi * DX);

  function tPred(x) { return T0 + x / VREF * 1000; }   // 理论折射时距 ms
  function tSw(x) { return tPred(x) + 95; }            // 面波/多次波列：与初至近平行、落后约 95 ms

  /* ---------- 状态 ---------- */
  var DEF = { snr: 1.0, sta: 20, lta: 160, thr: 2.0, surf: 1.0, seed: 7, post: true };
  var S = Object.assign({}, DEF);
  var selTrace = 20;
  var hoverTrace = -1;

  var shot = null;        // {clean, noise, tfb, manual, statics}
  var picks = null;       // 每道 {tRaw, tAic, tFinal, peak, conf, wA, wB, isOut, resid, trace}
  var stats = null;
  var scanData = null, scanKey = '';
  var lastRatio = null, lastAic = null;

  /* ---------- 波形生成 ---------- */
  function ricker(tauMs, fHz) {
    var p = Math.PI * fHz * tauMs / 1000;
    return (1 - 2 * p * p) * Math.exp(-p * p);
  }
  /* 因果子波：t₀ 起振的指数衰减正弦（起跳点即能量突变点） */
  function causal(t, t0, f, tau) {
    return t >= t0 ? Math.exp(-(t - t0) / tau) * Math.sin(2 * Math.PI * f * (t - t0) / 1000) : 0;
  }

  /* clean 信号（不含噪声，SNR 只缩放噪声） */
  function genClean(seed) {
    var rnd = mulberry32(seed * 7919 + 13);
    var st = [], s = 0, i, t;
    for (i = 0; i < NTR; i++) {
      s = clamp(s + (rnd() - 0.5) * 6, -6, 6);   // 静态扰动：道间连续随机游走
      st.push(s);
    }
    var clean = [], tfb = [], manual = [];
    for (i = 0; i < NTR; i++) {
      var x = X[i];
      var tr = new Float32Array(NT);
      var fb = tPred(x) + st[i];
      var tdir = x / VDIR * 1000;
      var tsw = tSw(x);
      var tref = 900 + x / 3500 * 1000;
      for (t = 0; t < NT; t++) {
        var v = causal(t, fb, F0, 110);
        v += 0.35 * causal(t, tdir, 28, 70);
        v += S.surf * (1.9 * causal(t, tsw, 12, 300) + 1.3 * causal(t, tsw + 120, 9, 380));
        v += 0.28 * ricker(t - tref - 20, 25) * Math.exp(-Math.max(0, t - tref) / 260);
        tr[t] = v;
      }
      clean.push(tr);
      tfb.push(fb);
    }
    var rnd2 = mulberry32(seed * 104729 + 7);   // 人工拾取对照流：均值 +3.5 ms、σ 3 ms
    for (i = 0; i < NTR; i++) manual.push(tfb[i] + 3.5 + gaussOf(rnd2) * 3);
    return { clean: clean, tfb: tfb, manual: manual, statics: st };
  }

  function genNoise(nseed) {
    var rnd = mulberry32(nseed * 2654435761 % 2147483647 + 1);
    var noise = [];
    for (var i = 0; i < NTR; i++) {
      var nz = new Float32Array(NT);
      for (var t = 0; t < NT; t++) nz[t] = gaussOf(rnd);
      noise.push(nz);
    }
    return noise;
  }

  function genShot(seed) {
    var c = genClean(seed);
    c.noise = genNoise(seed * 3 + 1);
    return c;
  }

  function synthN(cleanTr, noiseTr, snr) {
    var sig = 0.25 / snr;
    var out = new Float32Array(NT);
    for (var t = 0; t < NT; t++) out[t] = cleanTr[t] + sig * noiseTr[t];
    return out;
  }

  /* ---------- STA/LTA ---------- */
  var csBuf = new Float64Array(NT + 1);
  var ratioBuf = new Float32Array(NT);

  function staltaRatio(tr, Ws, Wl) {
    var t;
    csBuf[0] = 0;
    for (t = 0; t < NT; t++) csBuf[t + 1] = csBuf[t] + tr[t] * tr[t];
    for (t = 0; t < NT; t++) {
      var a0 = Math.max(0, t - Ws + 1), a1 = t + 1;
      var b0 = Math.max(0, t - Wl + 1), b1 = t + 1;
      var sta = (csBuf[a1] - csBuf[a0]) / (a1 - a0);
      var lta = (csBuf[b1] - csBuf[b0]) / (b1 - b0);
      ratioBuf[t] = sta / (lta + 1e-9);
    }
    return ratioBuf;
  }

  function pickTrace(tr, tCenter, Ws, Wl, thr) {
    var ratio = staltaRatio(tr, Ws, Wl);
    var wA = clamp(Math.round(tCenter - 140), Wl, NT - 2);
    var wB = clamp(Math.round(tCenter + 170), Wl + 1, NT - 2);
    var peak = -1, peakT = wA, firstT = -1, run = 0;
    for (var t = wA; t <= wB; t++) {
      if (ratio[t] > peak) { peak = ratio[t]; peakT = t; }
      if (ratio[t] >= thr) { run++; if (firstT < 0 && run >= 3) firstT = t - 2; }
      else run = 0;
    }
    /* 连续 3 采样超阈值才触发（抑制噪声瞬时假触发）；
       STA 窗使触发时刻系统性滞后约 Ws/2，作延迟补偿 */
    var tRaw0 = firstT >= 0 ? firstT : peakT;
    return { tRaw: Math.max(wA, tRaw0 - Math.round(Ws / 2)), peak: peak, wA: wA, wB: wB };
  }

  /* ---------- AIC 精修 ---------- */
  var ps1 = new Float64Array(NT + 1);
  var ps2 = new Float64Array(NT + 1);

  function aicRefine(tr, tRaw) {
    var a = Math.max(2, Math.round(tRaw - 55));
    var b = Math.min(NT - 3, Math.round(tRaw + 25));
    var n = b - a + 1, i, k;
    ps1[0] = 0; ps2[0] = 0;
    for (i = 0; i < NT; i++) { ps1[i + 1] = ps1[i] + tr[i]; ps2[i + 1] = ps2[i] + tr[i] * tr[i]; }
    var curve = new Float32Array(n);
    var best = Infinity, bestK = Math.round(n / 2);
    for (k = 2; k < n - 2; k++) {
      var m1 = (ps1[a + k] - ps1[a]) / k;
      var v1 = (ps2[a + k] - ps2[a]) / k - m1 * m1;
      var m2 = (ps1[a + n] - ps1[a + k]) / (n - k);
      var v2 = (ps2[a + n] - ps2[a + k]) / (n - k) - m2 * m2;
      var val = k * Math.log(Math.max(v1, 1e-12)) + (n - k) * Math.log(Math.max(v2, 1e-12));
      curve[k] = val;
      if (val < best) { best = val; bestK = k; }
    }
    return { t: a + bestK, a: a, b: b, curve: curve };
  }

  /* ---------- 折射时距约束后处理 ---------- */
  function applyPost(picks) {
    var act = [], i;
    for (i = 0; i < NTR; i++) act.push(true);
    var a = 0, b = 0;
    for (var iter = 0; iter < 2; iter++) {
      var n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (i = 0; i < NTR; i++) {
        if (!act[i]) continue;
        n++; sx += X[i]; sy += picks[i].tAic; sxx += X[i] * X[i]; sxy += X[i] * picks[i].tAic;
      }
      b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      a = (sy - b * sx) / n;
      var m = 0, cnt = 0;
      for (i = 0; i < NTR; i++) if (act[i]) { m += picks[i].tAic - (a + b * X[i]); cnt++; }
      m /= cnt;
      var sd = 0;
      for (i = 0; i < NTR; i++) if (act[i]) { var r = picks[i].tAic - (a + b * X[i]) - m; sd += r * r; }
      sd = Math.sqrt(sd / cnt);
      var lim = Math.max(3 * sd, 8);
      var changed = false;
      for (i = 0; i < NTR; i++) {
        if (!act[i]) continue;
        if (Math.abs(picks[i].tAic - (a + b * X[i])) > lim) { act[i] = false; changed = true; }
      }
      if (!changed) break;
    }
    for (i = 0; i < NTR; i++) {
      picks[i].resid = picks[i].tAic - (a + b * X[i]);
      if (!act[i]) { picks[i].isOut = true; picks[i].tFinal = a + b * X[i]; }
    }
  }

  /* ---------- 统计 ---------- */
  function computeStats(picks, tfb, manual) {
    var p2 = 0, p4 = 0, mae = 0, out = 0, rev = 0, maeM = 0;
    var errs = [];
    for (var i = 0; i < NTR; i++) {
      var e = picks[i].tFinal - tfb[i];
      errs.push(e);
      var ae = Math.abs(e);
      if (ae <= 2) p2++;
      if (ae <= 4) p4++;
      mae += ae;
      if (picks[i].isOut) out++;
      if (picks[i].conf < 1.3 || picks[i].isOut) rev++;
      maeM += Math.abs(manual[i] - tfb[i]);
    }
    return {
      errs: errs, p2: p2 / NTR * 100, p4: p4 / NTR * 100, mae: mae / NTR,
      out: out / NTR * 100, rev: rev / NTR * 100, maeM: maeM / NTR
    };
  }

  /* ---------- SNR 扫描（5 种子 × 24 道 / 网格点） ---------- */
  function snrScan() {
    var base = genClean(S.seed);
    var Wl = Math.max(S.lta, S.sta + 10);
    var out = [];
    for (var g = 0; g <= 14; g++) {
      var snr = 0.2 + g * 0.2;
      var good = 0, tot = 0;
      for (var rep = 0; rep < 5; rep++) {
        var noise = genNoise(S.seed * 97 + rep * 131 + 5);
        var pkList = [];
        for (var i = 0; i < NTR; i++) {
          var tr = synthN(base.clean[i], noise[i], snr);
          var pk = pickTrace(tr, tPred(X[i]), S.sta, Wl, S.thr);
          var aic = aicRefine(tr, pk.tRaw);
          pkList.push({ tAic: aic.t - 2, tFinal: aic.t - 2, isOut: false });
        }
        if (S.post) applyPost(pkList);
        for (i = 0; i < NTR; i++) {
          tot++;
          if (Math.abs(pkList[i].tFinal - base.tfb[i]) <= 2) good++;
        }
      }
      out.push({ snr: snr, rate: good / tot * 100 });
    }
    return out;
  }

  /* ---------- 重算 ---------- */
  function recompute() {
    shot = genShot(S.seed);
    var Wl = Math.max(S.lta, S.sta + 10);
    picks = [];
    for (var i = 0; i < NTR; i++) {
      var tr = synthN(shot.clean[i], shot.noise[i], S.snr);
      var pk = pickTrace(tr, tPred(X[i]), S.sta, Wl, S.thr);
      var aic = aicRefine(tr, pk.tRaw);
      aic.t -= 2;   /* AIC 分割点系统性滞后约 2 ms（信号段需建立方差），固定补偿 */
      picks.push({
        tRaw: pk.tRaw, tAic: aic.t, tFinal: aic.t, peak: pk.peak,
        conf: pk.peak / S.thr, wA: pk.wA, wB: pk.wB, isOut: false, resid: 0, trace: tr
      });
    }
    if (S.post) applyPost(picks);
    stats = computeStats(picks, shot.tfb, shot.manual);
    refreshSelDerived();
    var key = [S.seed, S.surf, S.sta, S.lta, S.thr, S.post].join('|');
    if (key !== scanKey) { scanData = snrScan(); scanKey = key; }
  }

  /* 选中道派生数据（ratio 曲线 / AIC 曲线） */
  function refreshSelDerived() {
    var Wl = Math.max(S.lta, S.sta + 10);
    lastRatio = staltaRatio(picks[selTrace].trace, S.sta, Wl).slice(0);
    lastAic = aicRefine(picks[selTrace].trace, picks[selTrace].tRaw);
  }

  /* ==================== 绘图 ==================== */
  var COL = {
    ink: '#3d464b', grid: '#e6e0d0', axis: '#c9c2b0', txt: '#79828a',
    green: '#2f7d6b', gold: '#c9a15a', red: '#b05a51', blue: '#41699b', gray: '#8a9298'
  };

  function vline(ctx, x, y0, y1, color, dash, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 1;
    ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.setLineDash([]);
  }
  function txt(ctx, s, x, y, align, color, size) {
    ctx.fillStyle = color || COL.txt;
    ctx.font = (size || 9) + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  /* ---------- ① 共炮点道集 ---------- */
  var GW = 520, GH = 312;
  var G = { L: 50, R: 10, T: 18, B: 34 };
  function gx(t) { return G.L + t / NT * (GW - G.L - G.R); }
  function gy(i) { return G.T + (i + 0.5) * (GH - G.T - G.B) / NTR; }
  var gatherGap = (GH - G.T - G.B) / NTR;

  function drawGather() {
    var cv = $('cv-gather');
    var ctx = setupCanvas(cv, GW, GH);
    ctx.clearRect(0, 0, GW, GH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, GW, GH);

    /* 网格：时间轴 */
    for (var tg = 0; tg <= NT; tg += 300) {
      vline(ctx, gx(tg), G.T, GH - G.B, COL.grid, null, 0.7);
      txt(ctx, String(tg), gx(tg), GH - G.B + 11, 'center');
    }
    txt(ctx, '时间 / ms', GW - G.R - 2, GH - G.B + 24, 'right', COL.txt, 9);
    /* 道标签（每 4 道标偏移距） */
    for (var i = 0; i < NTR; i += 4) {
      txt(ctx, X[i] + '', G.L - 6, gy(i), 'right', COL.txt, 8.5);
    }
    txt(ctx, '偏移距/m', G.L - 6, G.T - 9, 'right', COL.txt, 8.5);

    /* 选中道高亮 */
    ctx.fillStyle = 'rgba(47,125,107,.07)';
    ctx.fillRect(G.L, gy(selTrace) - gatherGap / 2, GW - G.L - G.R, gatherGap);
    if (hoverTrace >= 0 && hoverTrace !== selTrace) {
      ctx.fillStyle = 'rgba(201,161,90,.10)';
      ctx.fillRect(G.L, gy(hoverTrace) - gatherGap / 2, GW - G.L - G.R, gatherGap);
    }

    /* wiggle 道 */
    for (i = 0; i < NTR; i++) {
      var tr = picks[i].trace;
      var ma = 1e-9;
      for (var t = 0; t < NT; t += 2) { var av = Math.abs(tr[t]); if (av > ma) ma = av; }
      var sc = gatherGap * 0.42 / ma;
      var y0 = gy(i);
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (t = 0; t < NT; t += 2) {
        var px = gx(t), py = y0 - tr[t] * sc;
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      /* 正半周填充 */
      ctx.fillStyle = 'rgba(47,125,107,.22)';
      ctx.beginPath();
      var started = false;
      for (t = 0; t < NT; t += 2) {
        if (tr[t] > 0) {
          var px2 = gx(t), py2 = y0 - tr[t] * sc;
          if (!started) { ctx.moveTo(px2, y0); started = true; }
          ctx.lineTo(px2, py2);
        } else if (started) { ctx.lineTo(gx(t), y0); started = false; }
      }
      ctx.fill();
    }

    /* 理论折射时距（绿虚线） */
    ctx.strokeStyle = COL.green; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(gx(tPred(X[0])), gy(0));
    ctx.lineTo(gx(tPred(X[NTR - 1])), gy(NTR - 1));
    ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, 't₀+x/v', gx(tPred(X[5])) - 4, gy(5), 'right', COL.green, 8.5);

    /* 面波时距（灰点线） */
    ctx.strokeStyle = COL.gray; ctx.lineWidth = 0.9; ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(gx(tSw(X[0])), gy(0));
    ctx.lineTo(gx(tSw(X[NTR - 1])), gy(NTR - 1));
    ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, '面波', gx(tSw(X[21])) + 3, gy(21), 'left', COL.gray, 8.5);

    /* 拾取点 */
    for (i = 0; i < NTR; i++) {
      var p = picks[i];
      if (p.isOut) {
        /* 原拾取：金色叉 */
        var ox = gx(p.tAic), oy = gy(i);
        ctx.strokeStyle = COL.gold; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ox - 3, oy - 3); ctx.lineTo(ox + 3, oy + 3);
        ctx.moveTo(ox + 3, oy - 3); ctx.lineTo(ox - 3, oy + 3);
        ctx.stroke();
        /* 重拾值：空心红圈 */
        ctx.strokeStyle = COL.red; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(gx(p.tFinal), oy, 2.6, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = COL.red;
        ctx.beginPath(); ctx.arc(gx(p.tFinal), gy(i), 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* 边框 */
    ctx.strokeStyle = COL.axis; ctx.lineWidth = 1;
    ctx.strokeRect(G.L, G.T, GW - G.L - G.R, GH - G.T - G.B);
  }

  /* ---------- ②a 单道波形 ---------- */
  var TW = 436, TH = 240;
  var T = { L: 34, R: 8, T: 14, B: 32 };
  function tx(t) { return T.L + t / NT * (TW - T.L - T.R); }
  function ty(a) { return T.T + (1.15 - a) / 2.3 * (TH - T.T - T.B); }

  function drawTrace() {
    var cv = $('cv-trace');
    var ctx = setupCanvas(cv, TW, TH);
    ctx.clearRect(0, 0, TW, TH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, TW, TH);

    var p = picks[selTrace];
    var tr = p.trace, ma = 1e-9, t;
    for (t = 0; t < NT; t++) { var av = Math.abs(tr[t]); if (av > ma) ma = av; }

    /* 搜索窗阴影 */
    ctx.fillStyle = 'rgba(201,161,90,.08)';
    ctx.fillRect(tx(p.wA), T.T, tx(p.wB) - tx(p.wA), TH - T.T - T.B);

    /* 网格 */
    for (var tg = 0; tg <= NT; tg += 300) {
      vline(ctx, tx(tg), T.T, TH - T.B, COL.grid, null, 0.7);
      txt(ctx, String(tg), tx(tg), TH - T.B + 11, 'center');
    }
    [-1, -0.5, 0, 0.5, 1].forEach(function (a) {
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(T.L, ty(a)); ctx.lineTo(TW - T.R, ty(a)); ctx.stroke();
      txt(ctx, a.toFixed(1), T.L - 4, ty(a), 'right', COL.txt, 8);
    });
    txt(ctx, '时间 / ms', TW - T.R - 2, TH - T.B + 24, 'right', COL.txt, 9);
    txt(ctx, '归一化振幅', T.L + 2, T.T - 6, 'left', COL.txt, 8.5);

    /* 波形 */
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (t = 0; t < NT; t++) {
      var px = tx(t), py = ty(tr[t] / ma);
      if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* 竖线标注（错层 + 左右锚点分离，避免文字互相压盖） */
    var yT = T.T, yB = TH - T.B;
    vline(ctx, tx(p.wA), yT, yB, COL.gold, [2, 3], 0.8);
    vline(ctx, tx(p.wB), yT, yB, COL.gold, [2, 3], 0.8);
    vline(ctx, tx(tSw(X[selTrace])), yT, yB, COL.gray, [3, 3], 1);
    txt(ctx, '面波列', tx(tSw(X[selTrace])) + 3, yT + 8, 'left', COL.gray, 8.5);
    vline(ctx, tx(shot.tfb[selTrace]), yT, yB, COL.green, null, 1.4);
    txt(ctx, '真初至 ' + shot.tfb[selTrace].toFixed(0) + ' ms', tx(shot.tfb[selTrace]) - 3, yT + 8, 'right', COL.green, 8.5);
    vline(ctx, tx(shot.manual[selTrace]), yT, yB, COL.blue, [4, 3], 1.2);
    txt(ctx, '人工 ' + shot.manual[selTrace].toFixed(0), tx(shot.manual[selTrace]) + 3, yT + 50, 'left', COL.blue, 8.5);
    vline(ctx, tx(p.tRaw), yT, yB, COL.gold, null, 1.2);
    txt(ctx, '粗拾 ' + p.tRaw.toFixed(0), tx(p.tRaw) - 3, yT + 22, 'right', COL.gold, 8.5);
    vline(ctx, tx(p.tFinal), yT, yB, COL.red, null, 1.4);
    txt(ctx, (p.isOut ? '重拾 ' : '精修 ') + p.tFinal.toFixed(0), tx(p.tFinal) + 3, yT + 36, 'left', COL.red, 8.5);

    ctx.strokeStyle = COL.axis; ctx.lineWidth = 1;
    ctx.strokeRect(T.L, T.T, TW - T.L - T.R, TH - T.T - T.B);
  }

  /* ---------- ②b STA/LTA 特征曲线 ---------- */
  var RW = 436, RH = 240;
  var R = { L: 34, R: 8, T: 14, B: 32 };
  function rx(t) { return R.L + t / NT * (RW - R.L - R.R); }

  function drawRatio() {
    var cv = $('cv-ratio');
    var ctx = setupCanvas(cv, RW, RH);
    ctx.clearRect(0, 0, RW, RH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, RW, RH);

    var p = picks[selTrace];
    var maxR = Math.max(6, S.thr * 1.9);
    var peakInView = 0, t;
    for (t = 0; t < NT; t++) if (lastRatio[t] > peakInView) peakInView = lastRatio[t];
    maxR = Math.max(maxR, Math.min(peakInView * 1.1, 15));   /* 上限 15，保证阈值线可读 */
    function ry(v) { return R.T + (1 - v / maxR) * (RH - R.T - R.B); }

    /* 搜索窗阴影 */
    ctx.fillStyle = 'rgba(201,161,90,.08)';
    ctx.fillRect(rx(p.wA), R.T, rx(p.wB) - rx(p.wA), RH - R.T - R.B);

    /* 网格与轴 */
    for (var tg = 0; tg <= NT; tg += 300) {
      vline(ctx, rx(tg), R.T, RH - R.B, COL.grid, null, 0.7);
      txt(ctx, String(tg), rx(tg), RH - R.B + 11, 'center');
    }
    var yStep = maxR > 10 ? 5 : 2;
    for (var yv = 0; yv <= maxR; yv += yStep) {
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(R.L, ry(yv)); ctx.lineTo(RW - R.R, ry(yv)); ctx.stroke();
      txt(ctx, String(yv), R.L - 4, ry(yv), 'right', COL.txt, 8);
    }
    txt(ctx, '时间 / ms', RW - R.R - 2, RH - R.B + 24, 'right', COL.txt, 9);
    txt(ctx, 'STA/LTA 比值', R.L + 2, R.T - 6, 'left', COL.txt, 8.5);

    /* 阈值 */
    ctx.strokeStyle = COL.gold; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(R.L, ry(S.thr)); ctx.lineTo(RW - R.R, ry(S.thr)); ctx.stroke();
    ctx.setLineDash([]);
    txt(ctx, '阈值 ' + S.thr.toFixed(1), RW - R.R - 4, ry(S.thr) - 6, 'right', COL.gold, 8.5);

    /* ratio 曲线 */
    ctx.strokeStyle = COL.green; ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (t = 0; t < NT; t++) {
      var px = rx(t), py = ry(Math.min(lastRatio[t], maxR));
      if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* AIC 曲线（反向归一化叠画在搜索窗内） */
    if (lastAic && lastAic.curve) {
      var c = lastAic.curve, mn = Infinity, mx = -Infinity, k;
      for (k = 2; k < c.length - 2; k++) { if (c[k] < mn) mn = c[k]; if (c[k] > mx) mx = c[k]; }
      if (mx > mn) {
        ctx.strokeStyle = COL.blue; ctx.lineWidth = 1.1;
        ctx.beginPath();
        var started = false;
        for (k = 2; k < c.length - 2; k++) {
          var norm = 1 - (c[k] - mn) / (mx - mn);   /* 反向：AIC 最小值 → 峰值 */
          var px2 = rx(lastAic.a + k), py2 = ry(norm * maxR * 0.32 + maxR * 0.04);
          if (!started) { ctx.moveTo(px2, py2); started = true; } else ctx.lineTo(px2, py2);
        }
        ctx.stroke();
        txt(ctx, 'AIC（反向）', rx(lastAic.a) + 2, ry(maxR * 0.40), 'left', COL.blue, 8);
      }
    }

    /* 竖线：真值 / 粗拾 / 精修（错层防压盖） */
    var yT = R.T, yB = RH - R.B;
    vline(ctx, rx(shot.tfb[selTrace]), yT, yB, COL.green, null, 1.3);
    vline(ctx, rx(p.tRaw), yT, yB, COL.gold, null, 1.2);
    vline(ctx, rx(p.tFinal), yT, yB, COL.red, null, 1.3);
    txt(ctx, '真 ' + shot.tfb[selTrace].toFixed(0), rx(shot.tfb[selTrace]) - 3, yT + 8, 'right', COL.green, 8.5);
    txt(ctx, '粗 ' + p.tRaw.toFixed(0), rx(p.tRaw) - 3, yT + 22, 'right', COL.gold, 8.5);
    txt(ctx, '精 ' + p.tFinal.toFixed(0), rx(p.tFinal) + 3, yT + 36, 'left', COL.red, 8.5);

    ctx.strokeStyle = COL.axis; ctx.lineWidth = 1;
    ctx.strokeRect(R.L, R.T, RW - R.L - R.R, RH - R.T - R.B);
  }

  /* ---------- ③a 误差直方图 ---------- */
  var HW = 436, HH = 208;
  var H = { L: 34, R: 8, T: 14, B: 32 };
  var HMIN = -16, HMAX = 18, HBIN = 2;
  var HN = (HMAX - HMIN) / HBIN;

  function drawHist() {
    var cv = $('cv-hist');
    var ctx = setupCanvas(cv, HW, HH);
    ctx.clearRect(0, 0, HW, HH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, HW, HH);

    var bins = [], i;
    for (i = 0; i < HN; i++) bins.push(0);
    stats.errs.forEach(function (e) {
      var k = clamp(Math.floor((e - HMIN) / HBIN), 0, HN - 1);
      bins[k]++;
    });
    var maxC = 1;
    bins.forEach(function (c) { if (c > maxC) maxC = c; });
    maxC = Math.ceil(maxC * 1.15);

    var bw = (HW - H.L - H.R) / HN;
    function hy(c) { return H.T + (1 - c / maxC) * (HH - H.T - H.B); }

    /* 网格 */
    for (var c = 0; c <= maxC; c += (maxC > 10 ? 4 : 2)) {
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(H.L, hy(c)); ctx.lineTo(HW - H.R, hy(c)); ctx.stroke();
      txt(ctx, String(c), H.L - 4, hy(c), 'right', COL.txt, 8);
    }
    txt(ctx, '道数', H.L + 2, H.T - 6, 'left', COL.txt, 8.5);
    txt(ctx, '拾取误差 / ms', HW - H.R - 2, HH - H.B + 24, 'right', COL.txt, 9);

    /* 柱 */
    for (i = 0; i < HN; i++) {
      var x0 = H.L + i * bw;
      var center = HMIN + (i + 0.5) * HBIN;
      var ac = Math.abs(center);
      ctx.fillStyle = ac <= 2 ? COL.green : ac <= 4 ? COL.gold : COL.red;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x0 + 0.5, hy(bins[i]), bw - 1, HH - H.B - hy(bins[i]));
      ctx.globalAlpha = 1;
    }

    /* x 轴刻度 */
    for (var v = -16; v <= 16; v += 8) {
      var xv = H.L + (v - HMIN) / (HMAX - HMIN) * (HW - H.L - H.R);
      txt(ctx, String(v), xv, HH - H.B + 11, 'center');
    }
    /* ±2 / ±4 参考线 */
    [-2, 2].forEach(function (v) {
      var xv = H.L + (v - HMIN) / (HMAX - HMIN) * (HW - H.L - H.R);
      vline(ctx, xv, H.T, HH - H.B, COL.green, [4, 3], 1);
    });
    [-4, 4].forEach(function (v) {
      var xv = H.L + (v - HMIN) / (HMAX - HMIN) * (HW - H.L - H.R);
      vline(ctx, xv, H.T, HH - H.B, COL.gold, [4, 3], 1);
    });
    var x2 = H.L + (2 - HMIN) / (HMAX - HMIN) * (HW - H.L - H.R);
    txt(ctx, '±2 ms', x2 + 3, H.T + 8, 'left', COL.green, 8.5);

    ctx.strokeStyle = COL.axis; ctx.lineWidth = 1;
    ctx.strokeRect(H.L, H.T, HW - H.L - H.R, HH - H.T - H.B);
  }

  /* ---------- ③b SNR–合格率曲线 ---------- */
  var SW = 436, SH = 208;
  var SN = { L: 40, R: 10, T: 14, B: 32 };
  function sx(snr) { return SN.L + (snr - 0.2) / 2.8 * (SW - SN.L - SN.R); }
  function sy(rate) { return SN.T + (1 - rate / 100) * (SH - SN.T - SN.B); }

  function drawSnr() {
    var cv = $('cv-snr');
    var ctx = setupCanvas(cv, SW, SH);
    ctx.clearRect(0, 0, SW, SH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, SW, SH);

    /* 网格 */
    [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].forEach(function (v) {
      vline(ctx, sx(v), SN.T, SH - SN.B, COL.grid, null, 0.7);
      txt(ctx, v.toFixed(1), sx(v), SH - SN.B + 11, 'center');
    });
    [0, 25, 50, 75, 100].forEach(function (v) {
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(SN.L, sy(v)); ctx.lineTo(SW - SN.R, sy(v)); ctx.stroke();
      txt(ctx, String(v), SN.L - 4, sy(v), 'right', COL.txt, 8);
    });
    txt(ctx, 'SNR', SW - SN.R - 2, SH - SN.B + 24, 'right', COL.txt, 9);
    txt(ctx, '±2 ms 合格率 / %', SN.L + 2, SN.T - 6, 'left', COL.txt, 8.5);

    /* 85% 参考虚线 */
    ctx.strokeStyle = COL.gray; ctx.lineWidth = 0.9; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(SN.L, sy(85)); ctx.lineTo(SW - SN.R, sy(85)); ctx.stroke();
    ctx.setLineDash([]);
    txt(ctx, '85% 参考', SW - SN.R - 3, sy(85) - 6, 'right', COL.gray, 8);

    /* 扫描曲线 */
    if (scanData && scanData.length) {
      ctx.strokeStyle = COL.green; ctx.lineWidth = 1.4;
      ctx.beginPath();
      scanData.forEach(function (d, i) {
        var px = sx(d.snr), py = sy(d.rate);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.fillStyle = COL.green;
      scanData.forEach(function (d) {
        ctx.beginPath(); ctx.arc(sx(d.snr), sy(d.rate), 2, 0, Math.PI * 2); ctx.fill();
      });
    }

    /* 当前点（用当前 24 道实测合格率） */
    ctx.strokeStyle = COL.gold; ctx.lineWidth = 1;
    vline(ctx, sx(S.snr), SN.T, SH - SN.B, COL.gold, [3, 3], 0.9);
    ctx.fillStyle = COL.gold;
    ctx.beginPath(); ctx.arc(sx(S.snr), sy(stats.p2), 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(sx(S.snr), sy(stats.p2), 4, 0, Math.PI * 2); ctx.stroke();
    txt(ctx, '当前', sx(S.snr) + 6, sy(stats.p2) - 8, 'left', COL.gold, 8.5);

    ctx.strokeStyle = COL.axis; ctx.lineWidth = 1;
    ctx.strokeRect(SN.L, SN.T, SW - SN.L - SN.R, SH - SN.T - SN.B);
  }

  /* ---------- 指标卡与结论 ---------- */
  function fmtPct(v) { return v.toFixed(1) + ' %'; }

  function renderStats() {
    $('m-p2').textContent = fmtPct(stats.p2);
    $('m-p4').textContent = fmtPct(stats.p4);
    $('m-mae').textContent = stats.mae.toFixed(2) + ' ms';
    $('m-out').textContent = fmtPct(stats.out);
    $('m-rev').textContent = fmtPct(stats.rev);
    $('m-p2').parentNode.className = 'mcard' + (stats.p2 >= 85 ? '' : stats.p2 >= 60 ? ' warn' : ' bad');
    $('m-out').parentNode.className = 'mcard' + (stats.out <= 4 ? '' : stats.out <= 12 ? ' warn' : ' bad');

    var el = $('verdict');
    var head, cls, extra = '';
    if (stats.p2 >= 85) {
      cls = 'ok';
      head = '拾取质量达标：±2 ms 合格率 ' + fmtPct(stats.p2) + '，可进入层析静校正闭环。';
    } else if (stats.p2 >= 60) {
      cls = 'warn';
      head = '拾取质量临界：±2 ms 合格率 ' + fmtPct(stats.p2) + '，低信噪比道需人工复核。';
    } else {
      cls = 'bad';
      head = '低信噪比陷阱：±2 ms 合格率仅 ' + fmtPct(stats.p2) + '，噪声与面波误触发主导误差。';
    }
    if (stats.mae > 15 && stats.out < 5) {
      extra = ' 注意：跳点率仅 ' + fmtPct(stats.out) + ' 但误差巨大——大量道整段追到与初至平行的面波列上，' +
        '相邻道「错得非常一致」，时距约束识别不出来，正对应案例失败模式①（须靠训练集加入面波干扰道解决）。';
    }
    el.className = 'verdict ' + cls;
    el.innerHTML = '<b>' + head + '</b> 自动 MAE <b>' + stats.mae.toFixed(2) +
      ' ms</b>，人工对照 MAE <b>' + stats.maeM.toFixed(2) + ' ms</b>（本炮模拟）；跳点 ' +
      picks.filter(function (p) { return p.isOut; }).length + ' 道' +
      (S.post ? '已被时距约束重拾' : '（后处理关闭，未重拾）') +
      '，复核队列 ' + fmtPct(stats.rev) + '（案例口径 ≈6.8%）。' + extra +
      '提示：' + (S.snr < 0.8 ? '当前为远偏移距低信噪比情景，可增大 LTA 窗长或提高触发阈值抑制误拾。' :
        '把 SNR 拖到 0.4 附近，观察面波与噪声如何让 STA/LTA 误触发、AIC 与时距约束如何兜底。');
  }

  /* ---------- tooltip 绑定 ---------- */
  /* 道集交互（含纵向→道号换算与点击选道） */
  function bindGather() {
    var cv = $('cv-gather'), tip = $('tip-gather'), box = cv.parentNode;
    function locate(e) {
      var rect = cv.getBoundingClientRect();
      var lx = (e.clientX - rect.left) * (GW / rect.width);
      var ly = (e.clientY - rect.top) * (GH / rect.height);
      return { lx: lx, ly: ly, rect: rect };
    }
    cv.addEventListener('mousemove', function (e) {
      var p = locate(e);
      if (p.lx < G.L || p.lx > GW - G.R || p.ly < G.T || p.ly > GH - G.B) {
        tip.style.display = 'none';
        if (hoverTrace >= 0) { hoverTrace = -1; drawGather(); }
        return;
      }
      var i = clamp(Math.round((p.ly - G.T) / (GH - G.T - G.B) * NTR - 0.5), 0, NTR - 1);
      if (i !== hoverTrace) { hoverTrace = i; drawGather(); }
      var pk = picks[i];
      var err = pk.tFinal - shot.tfb[i];
      var html = '<b>第 ' + (i + 1) + ' 道</b> · 偏移距 <b>' + X[i] + ' m</b>' +
        '<br>真初至 <b>' + shot.tfb[i].toFixed(1) + ' ms</b> · 自动拾取 <b>' + pk.tFinal.toFixed(1) + ' ms</b>' +
        '<br>误差 <b>' + (err >= 0 ? '+' : '') + err.toFixed(1) + ' ms</b> · 置信 <b>' + pk.conf.toFixed(2) + '</b>' +
        (pk.isOut ? '<br><span style="color:#b05a51">跳点：时距残差 ' + pk.resid.toFixed(1) + ' ms，已按拟合时距重拾</span>' : '') +
        '<br><span style="color:#8a9298">点击选为该道联动分析</span>';
      tip.innerHTML = html;
      tip.style.display = 'block';
      var bx = e.clientX - box.getBoundingClientRect().left;
      var by = e.clientY - box.getBoundingClientRect().top;
      tip.style.left = clamp(bx + 12, 4, box.clientWidth - 230) + 'px';
      tip.style.top = clamp(by - 10, 4, box.clientHeight - 96) + 'px';
    });
    cv.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      hoverTrace = -1; drawGather();
    });
    cv.addEventListener('click', function (e) {
      var p = locate(e);
      if (p.ly < G.T || p.ly > GH - G.B) return;
      selTrace = clamp(Math.round((p.ly - G.T) / (GH - G.T - G.B) * NTR - 0.5), 0, NTR - 1);
      refreshSelDerived();
      drawGather(); drawTrace(); drawRatio(); renderSelInfo();
    });
  }

  /* 单道波形 tooltip */
  function bindTrace() {
    var cv = $('cv-trace'), tip = $('tip-trace'), box = cv.parentNode;
    cv.addEventListener('mousemove', function (e) {
      var rect = cv.getBoundingClientRect();
      var lx = (e.clientX - rect.left) * (TW / rect.width);
      if (lx < T.L || lx > TW - T.R) { tip.style.display = 'none'; return; }
      var t = clamp(Math.round((lx - T.L) / (TW - T.L - T.R) * NT), 0, NT - 1);
      var tr = picks[selTrace].trace, ma = 1e-9;
      for (var i = 0; i < NT; i++) { var av = Math.abs(tr[i]); if (av > ma) ma = av; }
      tip.innerHTML = 't = <b>' + t + ' ms</b> · 振幅 <b>' + (tr[t] / ma).toFixed(3) + '</b>' +
        '<br>真初至 <b>' + shot.tfb[selTrace].toFixed(0) + '</b> · 精修 <b>' + picks[selTrace].tFinal.toFixed(0) + ' ms</b>';
      tip.style.display = 'block';
      var bx = e.clientX - box.getBoundingClientRect().left;
      var by = e.clientY - box.getBoundingClientRect().top;
      tip.style.left = clamp(bx + 12, 4, box.clientWidth - 190) + 'px';
      tip.style.top = clamp(by - 10, 4, box.clientHeight - 64) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* 特征曲线 tooltip */
  function bindRatio() {
    var cv = $('cv-ratio'), tip = $('tip-ratio'), box = cv.parentNode;
    cv.addEventListener('mousemove', function (e) {
      var rect = cv.getBoundingClientRect();
      var lx = (e.clientX - rect.left) * (RW / rect.width);
      if (lx < R.L || lx > RW - R.R) { tip.style.display = 'none'; return; }
      var t = clamp(Math.round((lx - R.L) / (RW - R.L - R.R) * NT), 0, NT - 1);
      var p = picks[selTrace];
      var inWin = t >= p.wA && t <= p.wB;
      tip.innerHTML = 't = <b>' + t + ' ms</b> · STA/LTA = <b>' + lastRatio[t].toFixed(2) + '</b>' +
        (inWin ? '' : '<br><span style="color:#8a9298">搜索窗外（不参与拾取）</span>') +
        '<br>阈值 <b>' + S.thr.toFixed(1) + '</b> · 粗拾 <b>' + p.tRaw + '</b> · 精修 <b>' + p.tFinal.toFixed(0) + ' ms</b>';
      tip.style.display = 'block';
      var bx = e.clientX - box.getBoundingClientRect().left;
      var by = e.clientY - box.getBoundingClientRect().top;
      tip.style.left = clamp(bx + 12, 4, box.clientWidth - 200) + 'px';
      tip.style.top = clamp(by - 10, 4, box.clientHeight - 70) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* 直方图 tooltip */
  function bindHist() {
    var cv = $('cv-hist'), tip = $('tip-hist'), box = cv.parentNode;
    cv.addEventListener('mousemove', function (e) {
      var rect = cv.getBoundingClientRect();
      var lx = (e.clientX - rect.left) * (HW / rect.width);
      if (lx < H.L || lx > HW - H.R) { tip.style.display = 'none'; return; }
      var k = clamp(Math.floor((lx - H.L) / (HW - H.L - H.R) * HN), 0, HN - 1);
      var a = HMIN + k * HBIN, b = a + HBIN;
      var cnt = 0;
      stats.errs.forEach(function (er) {
        var kk = clamp(Math.floor((er - HMIN) / HBIN), 0, HN - 1);
        if (kk === k) cnt++;
      });
      tip.innerHTML = '误差区间 <b>[' + a + ', ' + b + ') ms</b><br>道数 <b>' + cnt + '</b> · 占比 <b>' + (cnt / NTR * 100).toFixed(0) + '%</b>';
      tip.style.display = 'block';
      var bx = e.clientX - box.getBoundingClientRect().left;
      var by = e.clientY - box.getBoundingClientRect().top;
      tip.style.left = clamp(bx + 12, 4, box.clientWidth - 170) + 'px';
      tip.style.top = clamp(by - 10, 4, box.clientHeight - 60) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* SNR 曲线 tooltip */
  function bindSnr() {
    var cv = $('cv-snr'), tip = $('tip-snr'), box = cv.parentNode;
    cv.addEventListener('mousemove', function (e) {
      var rect = cv.getBoundingClientRect();
      var lx = (e.clientX - rect.left) * (SW / rect.width);
      if (lx < SN.L || lx > SW - SN.R || !scanData) { tip.style.display = 'none'; return; }
      var snr = 0.2 + (lx - SN.L) / (SW - SN.L - SN.R) * 2.8;
      var best = null, bd = Infinity;
      scanData.forEach(function (d) {
        var dd = Math.abs(d.snr - snr);
        if (dd < bd) { bd = dd; best = d; }
      });
      if (!best || bd > 0.12) { tip.style.display = 'none'; return; }
      tip.innerHTML = 'SNR = <b>' + best.snr.toFixed(1) + '</b><br>±2 ms 合格率 <b>' + best.rate.toFixed(1) + '%</b>' +
        '<br><span style="color:#8a9298">5 种子 × 24 道蒙特卡洛</span>';
      tip.style.display = 'block';
      var bx = e.clientX - box.getBoundingClientRect().left;
      var by = e.clientY - box.getBoundingClientRect().top;
      tip.style.left = clamp(bx + 12, 4, box.clientWidth - 180) + 'px';
      tip.style.top = clamp(by - 10, 4, box.clientHeight - 66) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 控制与联动 ---------- */
  var OUT = {
    snr: function (v) { return v.toFixed(2); },
    sta: function (v) { return v + ' ms'; },
    lta: function (v) { return v + ' ms'; },
    thr: function (v) { return v.toFixed(1); },
    surf: function (v) { return v.toFixed(1) + '×'; },
    seed: function (v) { return String(v); }
  };
  var KEYS = ['snr', 'sta', 'lta', 'thr', 'surf', 'seed'];

  function syncUI() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
    $('chk-post').checked = S.post;
  }

  function renderSelInfo() {
    $('sel-info').textContent = '· 第 ' + (selTrace + 1) + ' 道 · 偏移距 ' + X[selTrace] + ' m';
  }

  function drawAll() {
    drawGather(); drawTrace(); drawRatio(); drawHist(); drawSnr(); renderStats();
  }

  function update() {
    recompute();
    drawAll();
  }

  KEYS.forEach(function (k) {
    $('s-' + k).addEventListener('input', function (e) {
      S[k] = +e.target.value;
      $('o-' + k).textContent = OUT[k](S[k]);
      update();
    });
  });
  $('chk-post').addEventListener('change', function (e) {
    S.post = e.target.checked;
    update();
  });
  $('btn-reset').addEventListener('click', function () {
    S = Object.assign({}, DEF);
    selTrace = 20;
    syncUI(); renderSelInfo(); update();
  });

  /* 页签切换 */
  var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var id = this.getAttribute('data-tab');
      tabs.forEach(function (o) { o.classList.remove('active'); });
      this.classList.add('active');
      panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
      if (id === 'sim') drawAll();   /* 回到模拟页时按实际尺寸重绘 */
    });
  });

  /* ---------- 启动 ---------- */
  syncUI();
  renderSelInfo();
  recompute();
  drawAll();
  bindGather(); bindTrace(); bindRatio(); bindHist(); bindSnr();

  /* 尺寸变化重绘（HiDPI 重算） */
  var rzTimer = null;
  window.addEventListener('resize', function () {
    if (rzTimer) clearTimeout(rzTimer);
    rzTimer = setTimeout(drawAll, 120);
  });
})();
