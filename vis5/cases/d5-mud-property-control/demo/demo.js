/* ======= 钻井液性能智能调控 · 可运行示范 ======= */
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

  /* 可复现伪随机数（固定种子，滑块不变时曲线稳定） */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 参数状态 ---------- */
  var DEF = { flow: 31, rho: 1.26, solids: 8, temp: 50 };
  var S = Object.assign({}, DEF);
  var SCN = 'manual';   /* manual | smart | both */
  var N = 145, DT = 0.5, TMAX = 72, TARGET = 55, VLO = 45, VHI = 65;

  var SIM = null;       /* 模拟结果 */
  var tsHover = -1, tsRaf = 0;

  /* =========================================================
     简化演示模型：72 h 黏度时序（两种调控策略共享同一扰动）
     ========================================================= */
  function simulate() {
    var rng = mulberry32(20261031);
    var t = [], base = [], n = 0, i;
    for (i = 0; i < N; i++) {
      var ti = i * DT;
      t.push(ti);
      n = 0.9 * n + (rng() * 2 - 1) * 1.0;
      var b = TARGET + 4 * Math.sin(2 * Math.PI * ti / 24 + 0.6) + n;
      b += -(S.temp - 50) * 0.55;          /* 返出温度升 → 黏度自然降 */
      b += (S.solids - 8) * 1.1;           /* 固相升 → 黏度升 */
      b += (S.rho - 1.26) * 30;            /* 密度微扰（±1.8 s） */
      if (ti >= 30 && ti <= 46) {          /* 盐膏层污染段隆起 +10 s */
        var up = clamp((ti - 30) / 2, 0, 1), dn = clamp((46 - ti) / 3, 0, 1);
        b += 10 * Math.min(up, dn);
      }
      base.push(b);
    }

    function doseResp(v, td, kg, tau) {
      for (var j = 0; j < N; j++) {
        var dt = t[j] - td;
        if (dt <= 0) continue;
        v[j] += 6 * kg * (1 - Math.exp(-dt / tau)) * Math.exp(-dt / 72);
      }
    }

    /* ---- 人工调控：班报实测（12 h）驱动，约 5 h 一次足量加药，过调因子 1.9 ---- */
    var MT = [6, 12, 24, 36, 48, 60, 72];      /* 班报实测时刻（每班 1–2 次） */
    var vM = base.slice(), dosesM = [], measM = [];
    var events = [];
    MT.forEach(function (m) { events.push({ t: m, kind: 'm' }); });
    for (var td = 6; td <= 71; td += 5) events.push({ t: td, kind: 'd' });
    events.sort(function (a, b) { return a.t - b.t || (a.kind === 'm' ? -1 : 1); });
    var lastMeas = TARGET, prevKg = 0;
    events.forEach(function (ev) {
      var idx = Math.round(ev.t / DT);
      if (ev.kind === 'm') { lastMeas = vM[idx]; return; }
      var kg = clamp(1.9 * (TARGET - lastMeas) / 6 + (rng() * 0.5 - 0.25), -1.4, 1.4);
      if (Math.abs(kg) < 0.05) kg = 0.05;
      var rb = prevKg !== 0 && kg * prevKg < 0;   /* 与上次反向 = 回调 */
      dosesM.push({ t: ev.t, kg: kg, rollback: rb });
      prevKg = kg;
      doseResp(vM, ev.t, kg, 1.0);
    });
    MT.forEach(function (m) {
      var idx = Math.round(m / DT);
      measM.push({ t: m, v: vM[idx] + (rng() * 2 - 1) * 1.2 });
    });

    /* ---- 智能调控：30 min 软测量 + 4 h 小剂量执行（单次 ≤0.5 kg/m³） ---- */
    var vS = base.slice(), vSoft = new Array(N), dosesS = [];
    var errB = 2.6 + 0.3 * Math.abs(S.solids - 8);   /* 软测量误差界（≤4 s） */
    var pending = 0, lastExec = -99;
    for (i = 0; i < N; i++) {
      var est = vS[i] + (rng() * 2 - 1) * errB;
      vSoft[i] = est;
      if (Math.abs(TARGET - est) > 2) pending += clamp(0.45 * (TARGET - est) / 6, -0.3, 0.3);
      var ti2 = t[i];
      if (ti2 >= 2 && ti2 - lastExec >= 4 && Math.abs(pending) >= 0.12) {
        var kg2 = clamp(pending, -0.5, 0.5);
        dosesS.push({ t: ti2, kg: kg2 });
        pending = 0; lastExec = ti2;
        doseResp(vS, ti2, kg2, 0.9);
      }
    }
    var measS = MT.map(function (m) {
      var idx = Math.round(m / DT);
      return { t: m, v: vS[idx] + (rng() * 2 - 1) * 1.2 };
    });

    function statOf(v) {
      var mx = -1e9, mn = 1e9, oob = 0, cnt = 0;
      for (var k = 24; k < N; k++) {
        if (v[k] > mx) mx = v[k];
        if (v[k] < mn) mn = v[k];
        cnt++;
        if (v[k] < VLO || v[k] > VHI) oob++;
      }
      return { amp: (mx - mn) / 2, oob: oob / cnt * 100 };
    }

    return {
      t: t, vM: vM, vS: vS, vSoft: vSoft,
      measM: measM, measS: measS, dosesM: dosesM, dosesS: dosesS,
      statM: statOf(vM), statS: statOf(vS),
      rbM: dosesM.filter(function (d) { return d.rollback; }).length,
      errB: errB
    };
  }

  /* ---------- 软测量误差 / 滤失估计 / ECD ---------- */
  function softErr() { return 3.2 + 0.35 * Math.abs(S.solids - 8) + 0.05 * Math.abs(S.temp - 50); }
  function filtEst() { return 3.0 + 0.28 * (S.solids - 8) + 0.06 * (S.temp - 50); }
  function ecdEst() { return S.rho + 0.07 + (S.flow - 28) * 0.012 + (S.solids - 8) * 0.004; }

  /* ---------- 加量推荐（约束优化口径） ---------- */
  function recommend() {
    var cur = SCN === 'smart' ? SIM.vSoft[N - 1] : SIM.vM[N - 1];
    var dv = cur - TARGET;
    var visc = dv < -2 ? clamp(-dv / 6 * 1.05, 0.3, 0.8) : 0;   /* 增黏剂 0.3–0.8 */
    var thin = dv > 2 ? clamp(dv / 6 * 1.05, 0.5, 1.5) : 0;     /* 稀释剂 0.5–1.5 */
    var filt = filtEst();
    var floc = filt > 4.5 ? clamp((filt - 3.8) * 1.2, 1.0, 2.0) : 0; /* 降滤失 1.0–2.0 */
    var lf = 30 / S.flow;   /* 排量折算循环周期 */
    return {
      cur: cur, visc: visc, thin: thin, floc: floc, filt: filt,
      lagVisc: Math.round(30 * lf / 5) * 5,
      lagFloc: Math.round(60 * lf / 5) * 5,
      lagThin: Math.round(90 * lf / 5) * 5
    };
  }

  /* =========================================================
     ① 黏度时序主图（SVG）
     ========================================================= */
  var TS = { W: 900, H: 330, PL: 46, PR: 64, PT: 26, PB: 36 };

  function drawTS(hoverI) {
    var W = TS.W, H = TS.H, pl = TS.PL, pr = TS.PR, pt = TS.PT, pb = TS.PB;
    var pw = W - pl - pr, ph = H - pt - pb;
    var Y0 = 30, Y1 = 80;
    var x = function (t) { return pl + t / TMAX * pw; };
    var y = function (v) { return pt + ph - (v - Y0) / (Y1 - Y0) * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    /* 网格与刻度 */
    for (var v = Y0; v <= Y1; v += 10) {
      s += '<line x1="' + pl + '" y1="' + y(v) + '" x2="' + (pl + pw) + '" y2="' + y(v) + '" stroke="' + (v === Y0 ? '#d8d0bc' : '#efece1') + '"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    }
    for (var tt = 0; tt <= TMAX; tt += 12) {
      s += '<line x1="' + x(tt) + '" y1="' + pt + '" x2="' + x(tt) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(tt) + '" y="' + (pt + ph + 24) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + tt + '</text>';
    }

    /* 目标区间 45–65 s 色带 */
    s += '<rect x="' + pl + '" y="' + y(VHI) + '" width="' + pw + '" height="' + (y(VLO) - y(VHI)) + '" fill="#2f7d6b" opacity="0.07"/>';
    s += '<line x1="' + pl + '" y1="' + y(VHI) + '" x2="' + (pl + pw) + '" y2="' + y(VHI) + '" stroke="#2f7d6b" stroke-width="1" stroke-dasharray="5 3" opacity="0.55"/>';
    s += '<line x1="' + pl + '" y1="' + y(VLO) + '" x2="' + (pl + pw) + '" y2="' + y(VLO) + '" stroke="#2f7d6b" stroke-width="1" stroke-dasharray="5 3" opacity="0.55"/>';
    s += '<text x="' + (pl + pw + 5) + '" y="' + (y(VHI) + 3) + '" font-size="8.5" fill="#235f51" font-family="monospace">65 s</text>';
    s += '<text x="' + (pl + pw + 5) + '" y="' + (y(VLO) + 3) + '" font-size="8.5" fill="#235f51" font-family="monospace">45 s</text>';

    /* 盐膏层污染段 */
    s += '<rect x="' + x(30) + '" y="' + pt + '" width="' + (x(46) - x(30)) + '" height="' + ph + '" fill="#b05a51" opacity="0.05"/>';
    s += '<text x="' + (x(38)) + '" y="' + (pt + 24) + '" font-size="8.5" fill="#b05a51" text-anchor="middle" opacity="0.85">盐膏层污染段</text>';

    function path(arr) {
      var d = '';
      for (var i = 0; i < N; i++) d += (i ? 'L' : 'M') + x(SIM.t[i]).toFixed(1) + ' ' + y(arr[i]).toFixed(1) + ' ';
      return d;
    }
    function diamonds(meas, color) {
      var d = '';
      meas.forEach(function (m) {
        var cx = x(m.t), cy = y(m.v);
        d += '<polygon points="' + cx.toFixed(1) + ',' + (cy - 4.6).toFixed(1) + ' ' + (cx + 4.6).toFixed(1) + ',' + cy.toFixed(1) + ' ' + cx.toFixed(1) + ',' + (cy + 4.6).toFixed(1) + ' ' + (cx - 4.6).toFixed(1) + ',' + cy.toFixed(1) + '" fill="' + color + '" stroke="#fff" stroke-width="1.2"/>';
      });
      return d;
    }
    /* 加药事件：人工 = 底部大三角（向上）；智能 = 顶部小三角（向下） */
    function doseMarks() {
      var d = '';
      if (SCN !== 'smart') {
        SIM.dosesM.forEach(function (dd) {
          var cx = x(dd.t), c = dd.kg > 0 ? '#2f7d6b' : '#b05a51';
          var r = 3 + Math.min(3, Math.abs(dd.kg) * 2);
          d += '<polygon points="' + cx.toFixed(1) + ',' + (pt + ph) + ' ' + (cx - r).toFixed(1) + ',' + (pt + ph + r + 2).toFixed(1) + ' ' + (cx + r).toFixed(1) + ',' + (pt + ph + r + 2).toFixed(1) + '" fill="' + c + '" opacity="0.85"' + (dd.rollback ? ' stroke="#c9a15a" stroke-width="1.4"' : '') + '/>';
        });
      }
      if (SCN !== 'manual') {
        SIM.dosesS.forEach(function (dd) {
          var cx = x(dd.t), c = dd.kg > 0 ? '#2f7d6b' : '#b05a51';
          d += '<polygon points="' + cx.toFixed(1) + ',' + pt + ' ' + (cx - 3).toFixed(1) + ',' + (pt - 5.5).toFixed(1) + ' ' + (cx + 3).toFixed(1) + ',' + (pt - 5.5).toFixed(1) + '" fill="' + c + '" opacity="0.8"/>';
        });
      }
      return d;
    }

    /* 统计注记（顶部左侧，避开盐膏段标注） */
    if (SCN !== 'smart') {
      s += '<text x="' + (pl + 4) + '" y="' + (pt - 10) + '" font-size="8.5" fill="#b05a51" font-family="monospace">人工：波动 ±' + SIM.statM.amp.toFixed(1) + ' s · 越界 ' + SIM.statM.oob.toFixed(1) + '% · 加药 ' + SIM.dosesM.length + ' 次（回调 ' + SIM.rbM + '）</text>';
    }
    if (SCN !== 'manual') {
      s += '<text x="' + (pl + (SCN === 'both' ? 340 : 4)) + '" y="' + (pt - 10) + '" font-size="8.5" fill="#235f51" font-family="monospace">智能：波动 ±' + SIM.statS.amp.toFixed(1) + ' s · 越界 ' + SIM.statS.oob.toFixed(1) + '% · 加药 ' + SIM.dosesS.length + ' 次（小剂量）</text>';
    }

    /* 曲线与实测点 */
    var ends = [];
    if (SCN !== 'smart') {
      s += '<path d="' + path(SIM.vM) + '" fill="none" stroke="#b05a51" stroke-width="2"/>';
      ends.push({ y: y(SIM.vM[N - 1]), txt: '人工 ' + SIM.vM[N - 1].toFixed(1) + ' s', c: '#b05a51' });
    }
    if (SCN !== 'manual') {
      s += '<path d="' + path(SIM.vS) + '" fill="none" stroke="#2f7d6b" stroke-width="2.2"/>';
      s += '<path d="' + path(SIM.vSoft) + '" fill="none" stroke="#41699b" stroke-width="1.4" stroke-dasharray="5 3" opacity="0.9"/>';
      ends.push({ y: y(SIM.vS[N - 1]), txt: '智能 ' + SIM.vS[N - 1].toFixed(1) + ' s', c: '#2f7d6b' });
      ends.push({ y: y(SIM.vSoft[N - 1]), txt: '软测量 ' + SIM.vSoft[N - 1].toFixed(1) + ' s', c: '#41699b' });
    }
    if (SCN === 'manual') s += diamonds(SIM.measM, '#c9a15a');
    else if (SCN === 'smart') s += diamonds(SIM.measS, '#c9a15a');
    else s += diamonds(SIM.measM, '#c9a15a');
    s += doseMarks();

    /* 末端标注：按 y 排序后强制相邻间隔 ≥12px */
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) {
      if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
    }
    ends.forEach(function (e) {
      s += '<text x="' + (pl + pw - 6) + '" y="' + (clamp(e.y, pt + 6, pt + ph - 2) + 3) + '" font-size="8.5" fill="' + e.c + '" text-anchor="end" font-family="monospace" font-weight="600">' + e.txt + '</text>';
    });

    /* 悬停十字线 */
    if (hoverI >= 0 && hoverI < N) {
      var hx = x(SIM.t[hoverI]);
      s += '<line x1="' + hx + '" y1="' + pt + '" x2="' + hx + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 2"/>';
      s += '<text x="' + hx + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#5d666d" text-anchor="middle" font-family="monospace">' + SIM.t[hoverI].toFixed(1) + ' h</text>';
      if (SCN !== 'smart') s += '<circle cx="' + hx + '" cy="' + y(SIM.vM[hoverI]).toFixed(1) + '" r="3.6" fill="#b05a51" stroke="#fff" stroke-width="1.2"/>';
      if (SCN !== 'manual') {
        s += '<circle cx="' + hx + '" cy="' + y(SIM.vS[hoverI]).toFixed(1) + '" r="3.6" fill="#2f7d6b" stroke="#fff" stroke-width="1.2"/>';
        s += '<circle cx="' + hx + '" cy="' + y(SIM.vSoft[hoverI]).toFixed(1) + '" r="3" fill="#41699b" stroke="#fff" stroke-width="1.2"/>';
      }
    }

    s += '<text x="' + (pl - 34) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 34) + ' ' + (pt + ph / 2) + ')">漏斗黏度 (s)</text>';
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 2) + '" font-size="9" fill="#5d666d" text-anchor="middle">时间（h，连续 72 h）</text>';

    $('ts-chart').innerHTML = s;
  }

  function bindTS() {
    var svg = $('ts-chart'), tip = $('ts-tip'), box = svg.parentNode;
    function idxAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (TS.W / r.width);
      return clamp(Math.round((vx - TS.PL) / (TS.W - TS.PL - TS.PR) * (TMAX / DT)), 0, N - 1);
    }
    svg.addEventListener('mousemove', function (evt) {
      var i = idxAt(evt);
      if (!tsRaf) {
        tsRaf = requestAnimationFrame(function () { tsRaf = 0; drawTS(tsHover); });
      }
      tsHover = i;
      var th = SIM.t[i];
      var lines = '<b>t = ' + th.toFixed(1) + ' h</b>';
      if (SCN !== 'smart') lines += '<br>人工调控 · 黏度 <b>' + SIM.vM[i].toFixed(1) + ' s</b>' + (SIM.vM[i] < VLO || SIM.vM[i] > VHI ? ' <span style="color:#b05a51">（越界）</span>' : '');
      if (SCN !== 'manual') {
        var err = SIM.vSoft[i] - SIM.vS[i];
        lines += '<br>智能调控 · 黏度 <b>' + SIM.vS[i].toFixed(1) + ' s</b>'
          + '<br>软测量 <b>' + SIM.vSoft[i].toFixed(1) + ' s</b>（误差 ' + (err >= 0 ? '+' : '') + err.toFixed(1) + ' s）';
      }
      /* 最近加药事件 */
      var evs = SCN === 'smart' ? SIM.dosesS : SIM.dosesM, last = null;
      evs.forEach(function (d) { if (d.t <= th + 0.01 && (!last || d.t > last.t)) last = d; });
      if (last && th - last.t <= 6) {
        lines += '<br><span style="color:#8a9298">最近加药：t=' + last.t.toFixed(0) + ' h，' + (last.kg > 0 ? '增黏' : '稀释') + ' ' + Math.abs(last.kg).toFixed(2) + ' kg/m³' + (last.rollback ? '（回调）' : '') + '</span>';
      }
      if (th >= 30 && th <= 46) lines += '<br><span style="color:#b05a51">盐膏层污染段：黏度自然隆起</span>';
      tip.innerHTML = lines;
      tip.style.display = 'block';
      var rb2 = box.getBoundingClientRect();
      tip.style.left = clamp(evt.clientX - rb2.left + 12, 4, rb2.width - 240) + 'px';
      tip.style.top = clamp(evt.clientY - rb2.top - 10, 4, rb2.height - 92) + 'px';
    });
    svg.addEventListener('mouseleave', function () {
      tsHover = -1;
      tip.style.display = 'none';
      drawTS(-1);
    });
  }

  /* =========================================================
     ②a 建议加量条形图（SVG）
     ========================================================= */
  function drawDoseBars(rec) {
    var W = 430, H = 210, pl = 108, pr = 96, pt = 16, pb = 26;
    var pw = W - pl - pr;
    var rows = [
      { name: '增黏剂', sub: 'PAC-HV / XC', min: 0.3, max: 0.8, dose: rec.visc, lag: rec.lagVisc, c: '#2f7d6b' },
      { name: '稀释剂', sub: '褐煤 / 木质素磺酸盐', min: 0.5, max: 1.5, dose: rec.thin, lag: rec.lagThin, c: '#b05a51' },
      { name: '降滤失剂', sub: 'PAC-LV / 淀粉', min: 1.0, max: 2.0, dose: rec.floc, lag: rec.lagFloc, c: '#c9a15a' }
    ];
    var VMAX = 2.0;
    var rowH = (H - pt - pb) / 3, barH = 15;
    var xp = function (kg) { return pl + kg / VMAX * pw; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    [0, 0.5, 1.0, 1.5, 2.0].forEach(function (g) {
      s += '<line x1="' + xp(g) + '" y1="' + pt + '" x2="' + xp(g) + '" y2="' + (H - pb) + '" stroke="#efece1"/>';
      s += '<text x="' + xp(g) + '" y="' + (H - pb + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + g.toFixed(1) + '</text>';
    });
    rows.forEach(function (r, i) {
      var cy = pt + rowH * (i + 0.5), yTop = cy - barH / 2;
      s += '<text x="' + (pl - 8) + '" y="' + (cy - 2) + '" font-size="10" fill="#4d565b" text-anchor="end" font-weight="600">' + r.name + '</text>';
      s += '<text x="' + (pl - 8) + '" y="' + (cy + 10) + '" font-size="8" fill="#9ba3a9" text-anchor="end">' + r.sub + '</text>';
      /* 允许区间轨道 */
      s += '<rect x="' + pl + '" y="' + yTop + '" width="' + pw + '" height="' + barH + '" rx="3" fill="#f0ecdf"/>';
      s += '<rect x="' + xp(r.min) + '" y="' + yTop + '" width="' + (xp(r.max) - xp(r.min)) + '" height="' + barH + '" fill="#e3dcc9"/>';
      if (r.dose > 0) {
        s += '<rect x="' + pl + '" y="' + yTop + '" width="' + (xp(r.dose) - pl) + '" height="' + barH + '" rx="3" fill="' + r.c + '" opacity="0.9"/>';
        s += '<text x="' + (xp(r.dose) + 5) + '" y="' + (cy + 3.5) + '" font-size="9.5" fill="' + r.c + '" font-family="monospace" font-weight="700">' + r.dose.toFixed(2) + ' kg/m³</text>';
        s += '<text x="' + (xp(r.dose) + 5) + '" y="' + (cy + 14) + '" font-size="8" fill="#8a9298">见效 ≈' + r.lag + ' min</text>';
      } else {
        s += '<text x="' + (pl + 6) + '" y="' + (cy + 3.5) + '" font-size="9" fill="#8a9298">维持（本周期不加）</text>';
      }
      /* 区间标注 */
      s += '<text x="' + xp(r.min) + '" y="' + (yTop - 3) + '" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + r.min.toFixed(1) + '</text>';
      s += '<text x="' + xp(r.max) + '" y="' + (yTop - 3) + '" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + r.max.toFixed(1) + '</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 2) + '" font-size="8.5" fill="#5d666d" text-anchor="middle">建议加量（kg/m³）· 灰段 = 允许搜索区间 · 目标含单耗与频次惩罚</text>';
    $('dose-bars').innerHTML = s;
  }

  /* =========================================================
     ②b 加量—响应示意（canvas，HiDPI）
     ========================================================= */
  function drawResp(rec) {
    var cv = $('dose-resp');
    if (!cv) return;
    var W = 430, H = 210, pl = 34, pr = 66, pt = 14, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var Y0 = 30, Y1 = 80, TH = 4;
    var ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);
    var x = function (h) { return pl + h / TH * pw; };
    var y = function (v) { return pt + ph - (v - Y0) / (Y1 - Y0) * ph; };

    /* 目标区间色带 */
    ctx.fillStyle = 'rgba(47,125,107,0.07)';
    ctx.fillRect(pl, y(VHI), pw, y(VLO) - y(VHI));
    ctx.strokeStyle = 'rgba(47,125,107,0.5)';
    ctx.setLineDash([5, 3]);
    [VHI, VLO].forEach(function (vv) {
      ctx.beginPath(); ctx.moveTo(pl, y(vv)); ctx.lineTo(pl + pw, y(vv)); ctx.stroke();
    });
    ctx.setLineDash([]);

    /* 网格 + 刻度 */
    ctx.font = '8.5px Consolas, monospace';
    for (var vv = 40; vv <= 80; vv += 10) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, y(vv)); ctx.lineTo(pl + pw, y(vv)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.textAlign = 'right';
      ctx.fillText(vv + '', pl - 5, y(vv) + 3);
    }
    for (var hh = 0; hh <= TH; hh++) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(x(hh), pt); ctx.lineTo(x(hh), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9';
      ctx.textAlign = 'center';
      ctx.fillText(hh + ' h', x(hh), pt + ph + 13);
    }

    /* 不执行：沿当前趋势漂移；执行：叠加加药响应（按各自见效滞后） */
    var cur = rec.cur;
    var trend = (SIM.vM[N - 1] - SIM.vM[N - 9]) / 4;   /* 每 h 漂移速率 */
    if (SCN === 'smart') trend = (SIM.vS[N - 1] - SIM.vS[N - 9]) / 4;
    var lagV = rec.lagVisc / 60, lagT = rec.lagThin / 60;
    function vNo(h) { return clamp(cur + trend * h, 26, 84); }
    function vDo(h) {
      var v = vNo(h);
      if (rec.visc > 0 && h > lagV) v += 6 * rec.visc * (1 - Math.exp(-(h - lagV) / 1));
      if (rec.thin > 0 && h > lagT) v -= 6 * rec.thin * (1 - Math.exp(-(h - lagT) / 1));
      return v;
    }
    function stroke(fn, color, width, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (var i = 0; i <= 80; i++) {
        var h = i / 80 * TH;
        if (i === 0) ctx.moveTo(x(h), y(fn(h))); else ctx.lineTo(x(h), y(fn(h)));
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    stroke(vNo, '#b05a51', 1.6, [5, 3]);
    stroke(vDo, '#2f7d6b', 2.4);

    /* 见效时间标记 */
    var lags = [];
    if (rec.visc > 0) lags.push({ h: lagV, c: '#2f7d6b', txt: '增黏见效' });
    if (rec.thin > 0) lags.push({ h: lagT, c: '#b05a51', txt: '稀释见效' });
    lags.forEach(function (L, i) {
      ctx.strokeStyle = L.c; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x(L.h), pt); ctx.lineTo(x(L.h), pt + ph); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = L.c; ctx.textAlign = 'left';
      ctx.font = '8px sans-serif';
      ctx.fillText(L.txt + ' ≈' + Math.round(L.h * 60) + ' min', x(L.h) + 3, pt + 10 + i * 10);
    });

    /* 末端标注（错开 ≥12px） */
    var e1 = y(vDo(TH)), e2 = y(vNo(TH));
    if (Math.abs(e1 - e2) < 12) { var m = (e1 + e2) / 2; e1 = m - 6; e2 = m + 6; }
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2f7d6b';
    ctx.fillText('执行建议 ' + vDo(TH).toFixed(1) + ' s', pl + pw + 5, clamp(e1, pt + 4, pt + ph) + 3);
    ctx.fillStyle = '#b05a51';
    ctx.fillText('不处理 ' + vNo(TH).toFixed(1) + ' s', pl + pw + 5, clamp(e2, pt + 4, pt + ph) + 3);

    ctx.fillStyle = '#5d666d';
    ctx.textAlign = 'center';
    ctx.font = '9px sans-serif';
    ctx.fillText('未来时间（h）', pl + pw / 2, H - 2);
    ctx.save();
    ctx.translate(11, pt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('黏度 (s)', 0, 0);
    ctx.restore();
  }

  /* =========================================================
     ③ 人工 vs 智能指标对比（案例实测口径）
     ========================================================= */
  function drawCmp() {
    var svg = $('cmp-chart');
    var W = 900, H = 240, pt = 40, pb = 42, pl = 60, pr = 30;
    var ph = H - pt - pb;
    var groups = [
      { name: '黏度波动幅度', a: 18, b: 9, fmt: function (v) { return '±' + v + ' s'; }, delta: '收窄 50%' },
      { name: '处理剂单耗（设计=100）', a: 127, b: 115, fmt: function (v) { return v + ''; }, delta: '−12 个百分点' },
      { name: '加药频次（次/班）', a: 2.4, b: 1.3, fmt: function (v) { return v.toFixed(1); }, delta: '−46%' },
      { name: '性能越界时长（%）', a: 11, b: 4.2, fmt: function (v) { return v.toFixed(1) + '%'; }, delta: '−62%' }
    ];
    var bw = 62, gap = 14;
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    s += '<line x1="' + pl + '" y1="' + (pt + ph) + '" x2="' + (W - pr) + '" y2="' + (pt + ph) + '" stroke="#d8d0bc"/>';
    groups.forEach(function (g, i) {
      var cx = 150 + i * 210;
      var hMax = ph - 8;
      var hA = g.a / g.a * hMax, hB = g.b / g.a * hMax;
      var xA = cx - bw - gap / 2, xB = cx + gap / 2;
      s += '<rect x="' + xA + '" y="' + (pt + ph - hA) + '" width="' + bw + '" height="' + hA + '" rx="3" fill="#9aa2a8" opacity="0.85"/>';
      s += '<rect x="' + xB + '" y="' + (pt + ph - hB).toFixed(1) + '" width="' + bw + '" height="' + hB.toFixed(1) + '" rx="3" fill="#2f7d6b" opacity="0.92"/>';
      s += '<text x="' + (xA + bw / 2) + '" y="' + (pt + ph - hA - 5) + '" font-size="10" fill="#79828a" text-anchor="middle" font-family="monospace">' + g.fmt(g.a) + '</text>';
      s += '<text x="' + (xB + bw / 2) + '" y="' + (pt + ph - hB - 5).toFixed(1) + '" font-size="10" fill="#235f51" text-anchor="middle" font-family="monospace" font-weight="700">' + g.fmt(g.b) + '</text>';
      s += '<text x="' + (xA + bw / 2) + '" y="' + (pt + ph + 14) + '" font-size="8.5" fill="#8a9298" text-anchor="middle">人工调控</text>';
      s += '<text x="' + (xB + bw / 2) + '" y="' + (pt + ph + 14) + '" font-size="8.5" fill="#235f51" text-anchor="middle">智能调控</text>';
      s += '<text x="' + cx + '" y="' + (pt + ph + 31) + '" font-size="10" fill="#4d565b" text-anchor="middle" font-weight="600">' + g.name + '</text>';
      s += '<text x="' + cx + '" y="' + (pt - 14) + '" font-size="11" fill="#235f51" text-anchor="middle" font-family="monospace" font-weight="700">' + g.delta + '</text>';
    });
    s += '<text x="' + (pl + 4) + '" y="' + (pt - 14) + '" font-size="8.5" fill="#9ba3a9">各组按组内最大值归一，柱上为原始值（案例实测）</text>';
    svg.innerHTML = s;
  }

  /* ---------- 指标卡 / 约束校核 / 结论 ---------- */
  function renderMetrics(rec) {
    var err = softErr(), filt = rec.filt, ecd = ecdEst(), cur = rec.cur;
    var oob = cur < VLO || cur > VHI;

    $('m-vis').innerHTML = cur.toFixed(1) + '<small> s</small>';
    $('m-vis').parentNode.className = 'mcard' + (oob ? ' bad' : '');

    $('m-err').innerHTML = err.toFixed(1) + '<small> s（目标 ≤4）</small>';
    $('m-err').parentNode.className = 'mcard' + (err > 4 ? ' bad' : err > 3.8 ? ' warn' : '');

    $('m-filt').innerHTML = filt.toFixed(1) + '<small> mL/30min</small>';
    $('m-filt').parentNode.className = 'mcard' + (filt > 5 ? ' bad' : filt > 4.5 ? ' warn' : '');

    $('m-ecd').innerHTML = ecd.toFixed(3) + '<small> g/cm³</small>';
    $('m-ecd').parentNode.className = 'mcard' + (ecd > 1.42 ? ' bad' : ecd > 1.40 ? ' warn' : '');

    var tot = rec.visc + rec.thin + rec.floc;
    $('m-dose').innerHTML = tot > 0 ? tot.toFixed(2) + '<small> kg/m³</small>' : '维持';
    $('m-dose').parentNode.className = 'mcard';
  }

  function renderChecks(rec) {
    var ecd = ecdEst(), cur = rec.cur;
    function set(id, ok, warn, val) {
      var el = $(id);
      el.className = 'chk-item' + (ok ? (warn ? ' warn' : '') : ' bad');
      el.querySelector('b').textContent = val;
    }
    set('chk-rho', S.rho >= 1.18, false, S.rho.toFixed(2) + ' ✓');
    set('chk-ecd', ecd <= 1.42, ecd > 1.40, ecd.toFixed(3) + (ecd <= 1.42 ? ' ✓' : ' ✗'));
    set('chk-filt', rec.filt <= 5, rec.filt > 4.5, rec.filt.toFixed(1) + (rec.filt <= 5 ? ' ✓' : ' ✗'));
    set('chk-vis', cur >= VLO && cur <= VHI, false, cur.toFixed(1) + (cur >= VLO && cur <= VHI ? ' ✓' : ' ✗'));
  }

  function renderVerdict(rec) {
    var v = $('verdict');
    var parts = [];
    if (rec.visc > 0) parts.push('增黏剂 <b>' + rec.visc.toFixed(2) + '</b> kg/m³（≈' + rec.lagVisc + ' min 见效）');
    if (rec.thin > 0) parts.push('稀释剂 <b>' + rec.thin.toFixed(2) + '</b> kg/m³（≈' + rec.lagThin + ' min 见效）');
    if (rec.floc > 0) parts.push('降滤失剂 <b>' + rec.floc.toFixed(2) + '</b> kg/m³（≈' + rec.lagFloc + ' min 见效）');
    var head = '当前估计黏度 <b>' + rec.cur.toFixed(1) + '</b> s、滤失估计 <b>' + rec.filt.toFixed(1) + '</b> mL/30min；';
    var ecd = ecdEst();
    if (ecd > 1.42) {
      v.className = 'verdict bad';
      v.innerHTML = head + 'ECD = <b>' + ecd.toFixed(3) + '</b> g/cm³ 越过 1.42 上限：冻结全部加量建议，升级人工处置（先降排量或密度）。';
      return;
    }
    if (parts.length === 0) {
      v.className = 'verdict ok';
      v.innerHTML = head + '性能落在目标区间内，本周期<b>维持不加药</b>——频次惩罚抑制了「手痒式」小幅调整，这正是单耗下降 12% 的来源之一。';
      return;
    }
    var oob = rec.cur < VLO || rec.cur > VHI;
    v.className = oob ? 'warn' : 'ok';
    v.innerHTML = head + '建议：' + parts.join('；') + '。单次加量 ≤0.5 kg/m³、含单耗与频次惩罚，避免「一次给足再回调」的过调振荡。';
  }

  function render() {
    SIM = simulate();
    var rec = recommend();
    drawTS(tsHover);
    drawDoseBars(rec);
    drawResp(rec);
    drawCmp();
    renderMetrics(rec);
    renderChecks(rec);
    renderVerdict(rec);
    updateScnNote();
  }

  /* ---------- 场景切换 ---------- */
  function updateScnNote() {
    ['manual', 'smart', 'both'].forEach(function (m) {
      $('btn-scn-' + m).classList.toggle('on', SCN === m);
    });
    var note = $('scn-note');
    if (SCN === 'manual') note.innerHTML = '当前：<b>人工调控</b>——班报 12 h 实测驱动，足量加药造成过调—回调振荡（底部三角 = 加药事件，金边 = 回调）';
    else if (SCN === 'smart') note.innerHTML = '当前：<b>智能调控</b>——30 min 软测量 + 小剂量执行（顶部小三角 = 加药事件），波动明显收窄';
    else note.innerHTML = '当前：<b>双场景叠加</b>——同一扰动下两种策略对比，蓝色虚线为软测量估计';
  }
  function bindScn() {
    ['manual', 'smart', 'both'].forEach(function (m) {
      $('btn-scn-' + m).addEventListener('click', function () { SCN = m; tsHover = -1; render(); });
    });
  }

  /* ---------- 滑块绑定 ---------- */
  var OUT = {
    flow: function (v) { return v.toFixed(1) + ' L/s'; },
    rho: function (v) { return v.toFixed(2) + ' g/cm³'; },
    solids: function (v) { return v.toFixed(1) + ' %'; },
    temp: function (v) { return v + ' ℃'; }
  };
  var KEYS = ['flow', 'rho', 'solids', 'temp'];
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
        $('o-' + k).textContent = OUT[k](DEF[k]);
        S[k] = DEF[k];
      });
      render();
    });
  }

  bind();
  bindScn();
  bindTS();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰（防抖） */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { if (SIM) drawResp(recommend()); }, 120);
  });
})();

/* ======= 真实数据来源页：API 标准 / 软测量文献 / 处理剂资料 ======= */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- 页签切换 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    var panes = { sim: $('pane-sim'), real: $('pane-real') };
    Array.prototype.forEach.call(tabs, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        Object.keys(panes).forEach(function (k) {
          if (panes[k]) panes[k].classList.toggle('active', k === btn.getAttribute('data-tab'));
        });
      });
    });
  }

  /* ---------- ① API 测试标准表 ---------- */
  var STD_ROWS = [
    ['漏斗黏度（马氏漏斗）', '946 mL（1 夸脱）流出时间；清水标定 26 ± 0.5 s（21 ± 3 ℃）；漏管孔径 4.76 mm（3/16 in）', '45–65 s（本案例目标区间）'],
    ['API 滤失量', '100 psi（690 kPa）× 30 min；Whatman No.50 滤纸（7.5 in²，2.7 μm）；室温；报告值 = 2 × V30', '≤ 5 mL/30 min'],
    ['密度', '泥浆密度计（mud balance）现场测定，班报记录', '1.20–1.32 g/cm³；下限 1.18（防气侵）'],
    ['含砂量', '200 目筛 + 洗砂含量管，按体积分数（vol%）读数', '低密度固相受控（软测量输入）'],
    ['油基 / 流变学', '油基钻井液测试 API RP 13B-2；PV / YP 等流变参数测定 API RP 13D', '参考标准']
  ];

  /* ---------- ③ 处理剂类型表 ---------- */
  var ADD_ROWS = [
    ['增黏剂', 'XC 生物聚合物（黄原胶）、膨润土、PHPA', 'XC：聚合物体系 0.25–1.0 lbm/bbl ≈ 0.71–2.85 kg/m³；清水体系 1–3 lbm/bbl ≈ 2.85–8.6 kg/m³', '0.3–0.8 kg/m³', 'World Oil 2014 / 厂商资料'],
    ['降滤失剂', 'PAC（聚阴离子纤维素）、CMC、淀粉类聚合物', 'POLYPAC UL：0.25–1 lbm/bbl [0.71–2.85 kg/m³]；盐水体系 1–3 lbm/bbl [2.85–8.6 kg/m³]', '1.0–2.0 kg/m³', 'SLB 产品数据'],
    ['稀释剂（降黏）', '单宁（栲胶）、多聚磷酸盐、褐煤、木质素磺酸盐', '分散黏土片层、降低切力；少量多次以防「过调—回调」', '0.5–1.5 kg/m³', 'World Oil 2014']
  ];

  /* ---------- ② 软测量文献精度（可查证报告值） ---------- */
  var LIT_BARS = [
    { label: 'Abdelgawad 2020 · 流变参数', v: 0.90, disp: 'R > 0.90', tip: 'Sensors 20(10):2787（DOI 10.3390/s20102787）：高膨润土水基浆 PV/YP/AV 神经网络关联式；200 个现场数据点，70:30 划分；报告 R > 0.90、AAPE ≤ 6%；输入为每 15–20 min 测得的密度与马氏漏斗黏度' },
    { label: 'ECD 模型（ACS Omega 2025 综述引）', v: 0.98, disp: 'R² = 0.98', tip: 'ACS Omega 10(18):19157《Artificial Intelligence Approaches to Modeling ECD》综述所列 Abdelgawad et al. ECD 模型：2,367 数据点，AAPRE 0.22%，RMSE 0.00562，R² = 0.98' },
    { label: 'SPE-231830-PA · 表观黏度', v: 0.9884, disp: 'R = 0.9884', tip: 'SPE J. 31(3):1547–1562（2026，DOI 10.2118/231830-PA）：多环侧链降滤失剂实验评价 + ANN 表观黏度预测；五折交叉验证，测试集 Pearson R = 0.9884' }
  ];

  /* ---------- ④ 来源汇总表 ---------- */
  var LIT_TABLE = [
    { src: 'API RP 13B-1 / ISO 10414-1:2008', method: '水基钻井液现场测试标准', data: '马氏漏斗（946 mL，清水标定 26 ± 0.5 s）、API 滤失（100 psi / 30 min / No.50 滤纸）、密度、含砂测定规程', link: 'https://www.iso.org/obp/ui/en/#!iso:std:41939:en', lt: 'ISO↗' },
    { src: 'AADE《Deciphering the Daily Mud Report》（Fann Instrument 资料）', method: '钻井液班报表项目解读', data: 'API 滤失试验：100 psi、30 min、7.5 in² Whatman No.50 滤纸（2.7 μm）、室温', link: 'https://www.aade.org/application/files/1515/7365/8636/Deciphering_The_Daily_Mud_Report.pdf', lt: 'PDF↗' },
    { src: 'Elkatatny, Tariq, Mahmoud et al. (2016), JPSE 146:1202–1210', method: 'ANN「白箱」软测量（可见数学模型）', data: '以马氏漏斗黏度 + 固相含量 + 密度实时预测表观/塑性黏度与屈服点（AV/PV/YP）', link: 'https://scholar.google.com/scholar?q=Real+time+prediction+of+drilling+fluid+rheological+properties+using+Artificial+Neural+Networks+visible+mathematical+model', lt: '检索↗' },
    { src: 'Abdelgawad et al. (2020), Sensors 20(10):2787', method: 'ANN 流变参数关联式（高膨润土浆）', data: '200 个现场数据点，70:30 划分；R > 0.90，AAPE ≤ 6%；输入为每 15–20 min 的密度与漏斗黏度', link: 'https://doi.org/10.3390/s20102787', lt: 'DOI↗' },
    { src: 'Liu, Zhang, Gao, Hu & Duan (2021), Sensors 21(11):3592', method: '实时流变测量技术综述', data: '对比马氏漏斗法、旋转黏度计、在线管式黏度计与 AI 软测量路线（本案例方法归类依据）', link: 'https://doi.org/10.3390/s21113592', lt: 'DOI↗' },
    { src: 'Abdelaal, Ibrahim & Elkatatny (2023), ACS Omega', method: '随机森林 / 决策树实时流变（合成基平流变）', data: '先预测 R600 / R300 转数读数，再推导 PV / YP 等其余流变参数', link: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10134475/', lt: 'PMC↗' },
    { src: 'ACS Omega (2025) 10(18):19157（ECD 智能建模）', method: 'ECD 人工智能建模综述与对比', data: '所列 Abdelgawad et al. 模型：2,367 数据点、AAPRE 0.22%、RMSE 0.00562、R² 0.98', link: 'https://pubs.acs.org/acsodf/article/10/18/19157/3653891/Artificial-Intelligence-Approaches-to-Modeling', lt: 'ACS↗' },
    { src: 'SPE-231830-PA, SPE J. 31(3):1547–1562 (2026)', method: '多环侧链降滤失剂实验 + ANN 表观黏度预测', data: '五折交叉验证，测试集 Pearson R = 0.9884，预测与实验值高度一致', link: 'https://doi.org/10.2118/231830-PA', lt: 'DOI↗' },
    { src: 'World Oil (2014) Drilling, Completion & Workover Fluids 增刊', method: '处理剂分类表', data: '稀释剂 / 分散剂：单宁（栲胶）、多聚磷酸盐、褐煤、木质素磺酸盐；增黏剂：膨润土、PHPA、黄原胶', link: 'http://mdr-mud.com/Fluids-2014.pdf', lt: 'PDF↗' },
    { src: 'SLB POLYPAC UL 产品数据页', method: '超低黏聚阴离子纤维素（PAC）降滤失剂', data: '控滤失常规加量 0.25–1 lbm/bbl [0.71–2.85 kg/m³]；盐水 / PAC-聚合物体系 1–3 lbm/bbl [2.85–8.6 kg/m³]', link: 'https://www.slb.com/products-and-services/innovating-in-oil-and-gas/well-construction/drilling-fluids/drilling-fluid-additives/filtration-reducers/polypac-ul-ultralow-viscosity-cellulose', lt: 'SLB↗' }
  ];

  function drawLit() {
    var svg = $('lit-chart');
    if (!svg) return;
    var W = 900, H = 240, pl = 240, pr = 96, pt = 20, pb = 34;
    var pw = W - pl - pr, ph = H - pt - pb;
    var x0 = 0.85, x1 = 1.0;
    var x = function (v) { return pl + (v - x0) / (x1 - x0) * pw; };
    var n = LIT_BARS.length, rowH = ph / n, barH = 26;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var g = 0.85; g <= 1.001; g += 0.05) {
      var gx = x(g);
      s += '<line x1="' + gx + '" y1="' + pt + '" x2="' + gx + '" y2="' + (pt + ph) + '" stroke="' + (Math.abs(g - 0.85) < 1e-6 ? '#d8d0bc' : '#efece1') + '"/>';
      s += '<text x="' + gx + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + g.toFixed(2) + '</text>';
    }
    LIT_BARS.forEach(function (b, i) {
      var cy = pt + rowH * (i + 0.5);
      s += '<rect x="' + pl + '" y="' + (cy - barH / 2) + '" width="' + (x(b.v) - pl).toFixed(1) + '" height="' + barH + '" rx="3" fill="#2f7d6b" opacity="0.88"/>';
      s += '<text x="' + (pl - 8) + '" y="' + (cy + 3) + '" font-size="9.5" fill="#4d565b" text-anchor="end">' + b.label + '</text>';
      s += '<text x="' + (x(b.v) + 6).toFixed(1) + '" y="' + (cy + 3) + '" font-size="9.5" fill="#235f51" font-family="monospace" font-weight="700">' + b.disp + '</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="#5d666d" text-anchor="middle">文献报告的软测量模型精度（相关系数 R / 决定系数 R²，越高越好）</text>';
    svg.innerHTML = s;
  }

  function bindLit() {
    var svg = $('lit-chart'), tip = $('lit-tip');
    if (!svg || !tip) return;
    var box = svg.parentNode;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vy = (evt.clientY - r.top) * (240 / r.height);
      var rowH = (240 - 20 - 34) / LIT_BARS.length;
      var i = Math.floor((vy - 20) / rowH);
      if (i >= 0 && i < LIT_BARS.length) {
        tip.innerHTML = '<b>' + LIT_BARS[i].label + '</b><br>' + LIT_BARS[i].tip;
        tip.style.display = 'block';
        var rb = box.getBoundingClientRect();
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 260) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 92) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function buildTables() {
    var sb = $('std-body');
    STD_ROWS.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td>';
      sb.appendChild(tr);
    });
    var ab = $('add-body');
    ADD_ROWS.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td class="num" style="white-space:normal">' + r[2] + '</td><td class="num">' + r[3] + '</td><td>' + r[4] + '</td>';
      ab.appendChild(tr);
    });
    var lb = $('lit-body');
    LIT_TABLE.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + r.src + '</td><td>' + r.method + '</td><td>' + r.data + '</td><td><a href="' + r.link + '" target="_blank" rel="noopener">' + r.lt + '</a></td>';
      lb.appendChild(tr);
    });
  }

  bindTabs();
  drawLit();
  bindLit();
  buildTables();
})();
