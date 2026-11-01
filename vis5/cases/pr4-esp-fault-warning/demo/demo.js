/* ======= 电潜泵故障智能预警 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* 确定性伪随机（同一场景多次渲染一致） */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- 常量与场景 ---------- */
  var NDAYS = 30, NPT = 48;            /* 30 天 × 48 点/天（30min 采样） */
  var NW = NDAYS * NPT + 1;

  /* 三级预警阈值（案例库业务口径） */
  var THS = [
    { v: 60, name: '关注', c: '#c9a15a', dark: '#9a7a1c' },
    { v: 40, name: '预警', c: '#b05a51', dark: '#b05a51' },
    { v: 20, name: '紧急', c: '#7a3a33', dark: '#7a3a33' }
  ];
  var LEVELS = [
    { c: '#2f7d6b', name: '正常' },
    { c: '#c9a15a', name: '关注' },
    { c: '#b05a51', name: '预警' },
    { c: '#7a3a33', name: '紧急' }
  ];
  function lvlOf(h) { return h >= 60 ? 0 : (h >= 40 ? 1 : (h >= 20 ? 2 : 3)); }

  var SCEN = [
    {
      id: 'gas', name: '气锁', cnt: 96, shape: '锯齿波动', P0: 16, F: 26, e: 0.8,
      mech: '吸入口游离气增多 → 泵排量脉动，电流卡片呈锯齿状剧烈波动，最终气锁欠载停机。',
      act: '核实动液面与沉没度，调低频率或改间歇放气制度，检查气体分离器 / 吸入口工况'
    },
    {
      id: 'scale', name: '结垢', cnt: 118, shape: '缓慢爬升', P0: 14, F: 28, e: 0.85,
      mech: '泵内结垢使流道变窄、负荷上升，电流缓慢爬升，最终过电流保护跳闸。',
      act: '加注阻垢剂或安排热洗，跟踪电流爬升速率，7 天内安排计划内检泵'
    },
    {
      id: 'heat', name: '电机过热', cnt: 74, shape: '温流联动', P0: 11, F: 25, e: 0.85,
      mech: '泵挂处流速不足、电机冷却变差，温度持续爬升并带动电流上升，绝缘加速老化。',
      act: '核查电机冷却与环空流速，降频降载运行，连续越限则 3–5 天内检泵'
    },
    {
      id: 'short', name: '相间短路', cnt: 45, shape: '骤降跳机', P0: 22, F: 29, e: 1.1,
      mech: '绕组绝缘退化，电流不平衡与高频抖动加剧，突发相间短路、电流骤降跳机。',
      act: '核查绝缘电阻与电压不平衡度，降载运行并 3 天内停机检泵，避免烧毁扩大损失'
    }
  ];

  /* ---------- 数据生成（每场景一次，确定性） ---------- */
  var CACHE = {};
  function buildData(si) {
    if (CACHE[si]) return CACHE[si];
    var sc = SCEN[si], P0 = sc.P0, F = sc.F, e = sc.e;
    var rnd = mulberry32(9017 + si * 7919);
    var k;
    var w1 = [], w2 = [];
    for (k = 0; k < NW; k++) { w1.push(rnd() * 2 - 1); w2.push(rnd() * 2 - 1); }
    /* w2 平滑为低频漂移 */
    var w2s = [];
    for (k = 0; k < NW; k++) {
      var a = Math.max(0, k - 6), b = Math.min(NW - 1, k + 6), acc = 0;
      for (var j = a; j <= b; j++) acc += w2[j];
      w2s.push(acc / (b - a + 1));
    }

    var t = [], cur = [], tmp = [], prs = [], hl = [];
    for (k = 0; k < NW; k++) {
      var day = k / NPT;
      var p = clamp((day - P0) / (F - P0), 0, 1);   /* 前兆窗口归一化进度 */
      var after = day >= F;
      var c, tp, pr;

      if (sc.id === 'gas') {
        var amp = 0.9 + 9.5 * Math.pow(p, 1.6);
        c = 42 - 1.8 * p + w1[k] * amp + 0.4 * amp * Math.sin(2 * Math.PI * 1.8 * day);
        tp = 88 + 2.5 * p + w2s[k] * 0.8;
        pr = 2.4 - 1.0 * p + w1[k] * (0.05 + 0.45 * p);
      } else if (sc.id === 'scale') {
        c = 42 + 15 * Math.pow(p, 1.25) + w1[k] * (0.9 + 1.5 * p);
        tp = 88 + 7 * p + w2s[k] * 0.8;
        pr = 2.4 - 0.7 * p + w1[k] * 0.06;
      } else if (sc.id === 'heat') {
        tp = 88 + 30 * Math.pow(p, 1.3) + w2s[k] * 1.1;
        c = 42 + 0.42 * (tp - 88) + w1[k] * (1 + 1.2 * p);
        pr = 2.4 - 0.35 * p + w1[k] * 0.06;
      } else { /* short */
        c = 42 + 2.2 * p + w1[k] * (0.9 + 6 * Math.pow(p, 2.2));
        if (day > F - 0.12 && day < F) c += 10 * (1 - (F - day) / 0.12); /* 短路尖峰 */
        tp = 88 + 9 * p + w2s[k] * 0.8;
        pr = 2.4 - 0.25 * p + w1[k] * 0.06;
      }
      if (after) {
        c = w1[k] * 0.25;                                    /* 停机 */
        tp = 45 + (tp - 45) * Math.exp(-(day - F) / 1.2);    /* 温度回落 */
        pr = 0;
      }
      var h = after ? 4 + w1[k] * 1.2 : 92 - 84 * Math.pow(p, e) + w2s[k] * 1.0;
      t.push(day); cur.push(c); tmp.push(tp); prs.push(clamp(pr, 0, 4)); hl.push(clamp(h, 1, 98));
    }

    /* 阈值穿越时刻（用无噪声曲线求解，保证标注稳定） */
    var cross = THS.map(function (th) {
      var pth = Math.pow((92 - th.v) / 84, 1 / e);
      return P0 + pth * (F - P0);
    });

    CACHE[si] = { t: t, cur: cur, tmp: tmp, prs: prs, hl: hl, cross: cross };
    return CACHE[si];
  }

  /* ---------- 状态 ---------- */
  var DEF = { scen: 0, cursor: 21, ovTmp: true, ovPrs: true };
  var S = Object.assign({}, DEF);
  var HOVER_M = -1, HOVER_H = -1;

  /* ---------- ① 多参数时序主图 ---------- */
  var M_W = 920, M_H = 316, PL = 46, PR = 46, PT = 36, PB = 28, GAP = 26;
  var H1 = 174, H2 = 52;
  var PW = M_W - PL - PR;
  var y2t = PT + H1 + GAP, y2b = y2t + H2;

  function xT(t) { return PL + t / NDAYS * PW; }
  function yC(v) { return PT + H1 - v / 70 * H1; }          /* 电流 0–70 A */
  function yT(v) { return PT + H1 - (v - 60) / 70 * H1; }   /* 温度 60–130 ℃ */
  function yP(v) { return y2b - v / 4 * H2; }               /* 油压 0–4 MPa */

  /* 按健康度等级把序列拆成着色段 */
  function segPaths(xArr, yArr, hlArr) {
    var out = [], k = 0;
    while (k < xArr.length - 1) {
      var lv = lvlOf(hlArr[k]);
      var d = 'M' + xArr[k].toFixed(1) + ' ' + yArr[k].toFixed(1);
      k++;
      d += 'L' + xArr[k].toFixed(1) + ' ' + yArr[k].toFixed(1);
      while (k < xArr.length - 1 && lvlOf(hlArr[k + 1]) === lv) {
        k++;
        d += 'L' + xArr[k].toFixed(1) + ' ' + yArr[k].toFixed(1);
      }
      out.push({ d: d, c: LEVELS[lv].c });
    }
    return out;
  }

  function drawMain() {
    var svg = $('main'), d0 = buildData(S.scen), sc = SCEN[S.scen];
    var xs = [], yc = [], yt = [], yp = [], k;
    for (k = 0; k < NW; k++) {
      xs.push(xT(d0.t[k])); yc.push(yC(d0.cur[k])); yt.push(yT(d0.tmp[k])); yp.push(yP(d0.prs[k]));
    }

    var s = '<rect width="' + M_W + '" height="' + M_H + '" fill="#fdfcf9"/>';

    /* 前兆窗口着色（两个面板贯通） */
    s += '<rect x="' + xT(sc.P0).toFixed(1) + '" y="' + PT + '" width="' + (xT(sc.F) - xT(sc.P0)).toFixed(1) + '" height="' + (y2b - PT) + '" fill="#c9a15a" opacity="0.08"/>';

    /* 网格 + 左轴（电流） */
    for (var v = 0; v <= 70; v += 10) {
      s += '<line x1="' + PL + '" y1="' + yC(v) + '" x2="' + (PL + PW) + '" y2="' + yC(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yC(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    }
    /* 右轴（温度） */
    if (S.ovTmp) {
      [60, 80, 100, 120].forEach(function (v) {
        s += '<text x="' + (PL + PW + 6) + '" y="' + (yT(v) + 3) + '" font-size="8.5" fill="#7b93b5" text-anchor="start" font-family="monospace">' + v + '</text>';
      });
    }
    /* 下方面板网格 + 油压轴 */
    for (var g = 0; g <= 4; g += 1) {
      s += '<line x1="' + PL + '" y1="' + yP(g) + '" x2="' + (PL + PW) + '" y2="' + yP(g) + '" stroke="#efece1"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (yP(g) + 3) + '" font-size="8.5" fill="#b39b66" text-anchor="end" font-family="monospace">' + g + '</text>';
    }
    /* 时间轴 */
    for (var td = 0; td <= NDAYS; td += 5) {
      s += '<line x1="' + xT(td) + '" y1="' + PT + '" x2="' + xT(td) + '" y2="' + y2b + '" stroke="#efece1"/>';
      s += '<text x="' + xT(td) + '" y="' + (y2b + 14) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + td + '</text>';
    }
    s += '<text x="' + (PL + PW / 2) + '" y="' + (M_H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">运行时间（天，故障停机前 30 天窗口）</text>';
    s += '<text x="' + (PL - 34) + '" y="' + (PT + H1 / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (PL - 34) + ' ' + (PT + H1 / 2) + ')">电流 (A)</text>';
    if (S.ovTmp) {
      s += '<text x="' + (PL + PW + 36) + '" y="' + (PT + H1 / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(90 ' + (PL + PW + 36) + ' ' + (PT + H1 / 2) + ')">电机温度 (℃)</text>';
    }
    s += '<text x="' + (PL + 4) + '" y="' + (y2t + 11) + '" font-size="8.5" fill="#b39b66">井口油压 (MPa)</text>';

    /* 油压曲线（可关） */
    if (S.ovPrs) {
      var d = '';
      for (k = 0; k < NW; k++) d += (k ? 'L' : 'M') + xs[k].toFixed(1) + ' ' + yp[k].toFixed(1) + ' ';
      s += '<path d="' + d + '" fill="none" stroke="#c9a15a" stroke-width="1.4" opacity="0.9"/>';
    } else {
      s += '<text x="' + (PL + PW / 2) + '" y="' + (y2t + H2 / 2 + 3) + '" font-size="9" fill="#b9b2a2" text-anchor="middle">井口油压叠加已关闭（右侧勾选恢复）</text>';
    }

    /* 温度曲线（可关） */
    if (S.ovTmp) {
      d = '';
      for (k = 0; k < NW; k++) d += (k ? 'L' : 'M') + xs[k].toFixed(1) + ' ' + yt[k].toFixed(1) + ' ';
      s += '<path d="' + d + '" fill="none" stroke="#41699b" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.8"/>';
    }

    /* 电流主线（按健康度着色） */
    segPaths(xs, yc, d0.hl).forEach(function (seg) {
      s += '<path d="' + seg.d + '" fill="none" stroke="' + seg.c + '" stroke-width="1.8"/>';
    });

    /* 预警触发点 ▲（三角形贴近绘图区顶边，文字分两行置于其上，避免互压） */
    d0.cross.forEach(function (cd, i) {
      var cx = xT(cd), row = (i === 1) ? 21 : 9;
      s += '<path d="M ' + cx.toFixed(1) + ' ' + (PT - 1) + ' L ' + (cx - 4).toFixed(1) + ' ' + (PT - 8) + ' L ' + (cx + 4).toFixed(1) + ' ' + (PT - 8) + ' Z" fill="' + THS[i].c + '"/>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + row + '" font-size="8.5" fill="' + THS[i].dark + '" text-anchor="middle" font-family="monospace">' + THS[i].name + ' 第' + cd.toFixed(1) + '天</text>';
    });

    /* 前兆窗口标注（底面板，带浅色描边防压线） */
    s += '<text x="' + (xT(sc.P0) + 4) + '" y="' + (y2b - 5) + '" font-size="8.5" fill="#9a7a1c" stroke="#fdfcf9" stroke-width="3" paint-order="stroke">前兆窗口 · 第' + sc.P0 + '天起（提前 ' + (sc.F - sc.P0) + ' 天）</text>';

    /* 故障停机红线 + 竖排标注 */
    var fx = xT(sc.F);
    s += '<line x1="' + fx + '" y1="' + PT + '" x2="' + fx + '" y2="' + y2b + '" stroke="#b05a51" stroke-width="1.6" stroke-dasharray="5 3"/>';
    s += '<text x="' + (fx - 5) + '" y="' + (PT + H1 * 0.55) + '" font-size="9" fill="#b05a51" font-weight="600" text-anchor="middle" transform="rotate(-90 ' + (fx - 5) + ' ' + (PT + H1 * 0.55) + ')">故障停机 · 第' + sc.F + '天</text>';

    /* 分析时点游标 */
    var ccx = xT(clamp(S.cursor, 0, NDAYS));
    s += '<line x1="' + ccx + '" y1="' + PT + '" x2="' + ccx + '" y2="' + y2b + '" stroke="#5d666d" stroke-width="1" stroke-dasharray="3 2"/>';

    /* hover 十字线 */
    if (HOVER_M >= 0) {
      var hx = xs[HOVER_M];
      s += '<line x1="' + hx + '" y1="' + PT + '" x2="' + hx + '" y2="' + y2b + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="2 2"/>';
      s += '<circle cx="' + hx + '" cy="' + yc[HOVER_M] + '" r="3.4" fill="' + LEVELS[lvlOf(d0.hl[HOVER_M])].c + '" stroke="#fff" stroke-width="1.2"/>';
      if (S.ovTmp) s += '<circle cx="' + hx + '" cy="' + yt[HOVER_M] + '" r="3" fill="#41699b" stroke="#fff" stroke-width="1"/>';
      if (S.ovPrs) s += '<circle cx="' + hx + '" cy="' + yp[HOVER_M] + '" r="3" fill="#c9a15a" stroke="#fff" stroke-width="1"/>';
    }
    svg.innerHTML = s;
  }

  function fmtDay(d) {
    var hh = Math.floor((d % 1) * 24), mm = Math.round((((d % 1) * 24) % 1) * 60);
    return '第 ' + Math.floor(d) + ' 天 ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function bindMain() {
    var svg = $('main'), tip = $('main-tip'), box = $('main-box');
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (M_W / r.width);
      if (vx < PL || vx > PL + PW) { HOVER_M = -1; tip.style.display = 'none'; drawMain(); return; }
      var t = (vx - PL) / PW * NDAYS;
      HOVER_M = clamp(Math.round(t * NPT), 0, NW - 1);
      drawMain();
      var d0 = buildData(S.scen), rb = box.getBoundingClientRect();
      var lv = lvlOf(d0.hl[HOVER_M]);
      tip.innerHTML = fmtDay(d0.t[HOVER_M]) + '<br>' +
        '电流 <b>' + d0.cur[HOVER_M].toFixed(1) + '</b> A<br>' +
        (S.ovTmp ? '电机温度 <b>' + d0.tmp[HOVER_M].toFixed(1) + '</b> ℃<br>' : '') +
        (S.ovPrs ? '井口油压 <b>' + d0.prs[HOVER_M].toFixed(2) + '</b> MPa<br>' : '') +
        '健康度 <b>' + d0.hl[HOVER_M].toFixed(0) + '</b>（<span style="color:' + LEVELS[lv].c + '">' + LEVELS[lv].name + '</span>）';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 190) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 100) + 'px';
    });
    svg.addEventListener('mouseleave', function () { HOVER_M = -1; tip.style.display = 'none'; drawMain(); });
  }

  /* ---------- ② 健康度评分曲线 ---------- */
  var H_W = 920, H_H = 180, H_PL = 46, H_PR = 20, H_PT = 14, H_PB = 26;
  var H_PW = H_W - H_PL - H_PR, H_PH = H_H - H_PT - H_PB;
  function hX(t) { return H_PL + t / NDAYS * H_PW; }
  function hY(v) { return H_PT + H_PH - v / 100 * H_PH; }

  function drawHl() {
    var svg = $('hl'), d0 = buildData(S.scen), sc = SCEN[S.scen];
    var s = '<rect width="' + H_W + '" height="' + H_H + '" fill="#fdfcf9"/>';

    /* 三级阈值带 */
    var zones = [
      { a: 60, b: 100, c: '#2f7d6b', label: '正常区 ≥60' },
      { a: 40, b: 60, c: '#c9a15a', label: '关注区 40–60' },
      { a: 20, b: 40, c: '#b05a51', label: '预警区 20–40' },
      { a: 0, b: 20, c: '#7a3a33', label: '紧急区 <20' }
    ];
    zones.forEach(function (z) {
      s += '<rect x="' + H_PL + '" y="' + hY(z.b) + '" width="' + H_PW + '" height="' + (hY(z.a) - hY(z.b)) + '" fill="' + z.c + '" opacity="0.07"/>';
      s += '<text x="' + (H_PL + 6) + '" y="' + ((hY(z.a) + hY(z.b)) / 2 + 3) + '" font-size="8.5" fill="' + z.c + '" opacity="0.85">' + z.label + '</text>';
    });
    /* 阈值虚线 */
    THS.forEach(function (th) {
      s += '<line x1="' + H_PL + '" y1="' + hY(th.v) + '" x2="' + (H_PL + H_PW) + '" y2="' + hY(th.v) + '" stroke="' + th.c + '" stroke-width="1" stroke-dasharray="5 3" opacity="0.8"/>';
    });
    /* 网格与轴 */
    for (var v = 0; v <= 100; v += 20) {
      s += '<text x="' + (H_PL - 6) + '" y="' + (hY(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    }
    for (var td = 0; td <= NDAYS; td += 5) {
      s += '<line x1="' + hX(td) + '" y1="' + H_PT + '" x2="' + hX(td) + '" y2="' + (H_PT + H_PH) + '" stroke="#efece1"/>';
      s += '<text x="' + hX(td) + '" y="' + (H_PT + H_PH + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + td + '</text>';
    }
    s += '<text x="' + (H_PL + H_PW / 2) + '" y="' + (H_H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">运行时间（天）</text>';
    s += '<text x="' + (H_PL - 34) + '" y="' + (H_PT + H_PH / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (H_PL - 34) + ' ' + (H_PT + H_PH / 2) + ')">健康度（0–100）</text>';

    /* 健康度曲线（按等级着色） */
    var xs = [], ys = [];
    for (var k = 0; k < NW; k++) { xs.push(hX(d0.t[k])); ys.push(hY(d0.hl[k])); }
    segPaths(xs, ys, d0.hl).forEach(function (seg) {
      s += '<path d="' + seg.d + '" fill="none" stroke="' + seg.c + '" stroke-width="2"/>';
    });

    /* 触发点圆点 + 错落标注 */
    d0.cross.forEach(function (cd, i) {
      var cx = hX(cd), cy = hY(THS[i].v);
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy + '" r="3.6" fill="' + THS[i].c + '" stroke="#fff" stroke-width="1.2"/>';
      var above = (i !== 1);
      s += '<text x="' + (cx - 4).toFixed(1) + '" y="' + (cy + (above ? -8 : 16)) + '" font-size="8.5" fill="' + THS[i].dark + '" text-anchor="end" font-family="monospace">' + THS[i].name + ' 第' + cd.toFixed(1) + '天</text>';
    });

    /* 故障停机红线 */
    var fx = hX(sc.F);
    s += '<line x1="' + fx + '" y1="' + H_PT + '" x2="' + fx + '" y2="' + (H_PT + H_PH) + '" stroke="#b05a51" stroke-width="1.3" stroke-dasharray="5 3"/>';

    /* 分析时点游标 + 读数框 */
    var ci = clamp(Math.round(S.cursor * NPT), 0, NW - 1);
    var ccx = xs[ci], ccy = ys[ci], hcur = d0.hl[ci], lv = lvlOf(hcur);
    s += '<line x1="' + ccx + '" y1="' + H_PT + '" x2="' + ccx + '" y2="' + (H_PT + H_PH) + '" stroke="#5d666d" stroke-width="1" stroke-dasharray="3 2"/>';
    s += '<circle cx="' + ccx.toFixed(1) + '" cy="' + ccy.toFixed(1) + '" r="4" fill="' + LEVELS[lv].c + '" stroke="#fff" stroke-width="1.4"/>';
    var lx = clamp(ccx, H_PL + 88, H_PL + H_PW - 88);
    s += '<rect x="' + (lx - 88) + '" y="' + (H_PT + 2) + '" width="176" height="15" rx="3" fill="#fff" stroke="#ddd6c6"/>';
    s += '<text x="' + lx + '" y="' + (H_PT + 13) + '" font-size="8.5" fill="' + LEVELS[lv].c + '" text-anchor="middle" font-family="monospace" font-weight="600">第' + S.cursor.toFixed(1) + '天 · 健康度 ' + hcur.toFixed(0) + ' · ' + LEVELS[lv].name + '</text>';

    /* hover */
    if (HOVER_H >= 0) {
      var hx = xs[HOVER_H];
      s += '<line x1="' + hx + '" y1="' + H_PT + '" x2="' + hx + '" y2="' + (H_PT + H_PH) + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="2 2"/>';
      s += '<circle cx="' + hx + '" cy="' + ys[HOVER_H] + '" r="3" fill="' + LEVELS[lvlOf(d0.hl[HOVER_H])].c + '" stroke="#fff" stroke-width="1"/>';
    }
    svg.innerHTML = s;
  }

  function bindHl() {
    var svg = $('hl'), tip = $('hl-tip'), box = $('hl-box');
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (H_W / r.width);
      if (vx < H_PL || vx > H_PL + H_PW) { HOVER_H = -1; tip.style.display = 'none'; drawHl(); return; }
      var t = (vx - H_PL) / H_PW * NDAYS;
      HOVER_H = clamp(Math.round(t * NPT), 0, NW - 1);
      drawHl();
      var d0 = buildData(S.scen), rb = box.getBoundingClientRect();
      var h = d0.hl[HOVER_H], lv = lvlOf(h);
      tip.innerHTML = fmtDay(d0.t[HOVER_H]) + '<br>健康度 <b>' + h.toFixed(0) + '</b><br>' +
        '级别 <b style="color:' + LEVELS[lv].c + '">' + LEVELS[lv].name + '</b>' +
        (d0.t[HOVER_H] < SCEN[S.scen].F ? '<br><span style="color:#8a9298">距停机约 ' + (SCEN[S.scen].F - d0.t[HOVER_H]).toFixed(1) + ' 天</span>' : '<br><span style="color:#b05a51">已停机</span>');
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 92) + 'px';
    });
    svg.addEventListener('mouseleave', function () { HOVER_H = -1; tip.style.display = 'none'; drawHl(); });
  }

  /* ---------- 指标 / 状态灯 / 结论 ---------- */
  function renderMetrics() {
    var d0 = buildData(S.scen), sc = SCEN[S.scen];
    var ci = clamp(Math.round(S.cursor * NPT), 0, NW - 1);
    var h = d0.hl[ci], lv = lvlOf(h), t = d0.t[ci];

    $('m-hl').innerHTML = h.toFixed(0) + '<small> /100</small>';
    $('m-hl').parentNode.className = 'mcard' + (lv >= 2 ? ' bad' : (lv === 1 ? ' warn' : ''));

    $('m-lvl').innerHTML = LEVELS[lv].name + '<small>（' + (lv === 0 ? '≥60' : lv === 1 ? '40–60' : lv === 2 ? '20–40' : '<20') + '）</small>';
    $('m-lvl').parentNode.className = 'mcard' + (lv >= 2 ? ' bad' : (lv === 1 ? ' warn' : ''));
    $('m-lvl').style.color = LEVELS[lv].c;

    if (t >= sc.F) {
      $('m-eta').innerHTML = '已停机';
      $('m-eta').parentNode.className = 'mcard bad';
    } else {
      $('m-eta').innerHTML = (sc.F - t).toFixed(1) + '<small> 天</small>';
      $('m-eta').parentNode.className = 'mcard' + (sc.F - t <= 3 ? ' bad' : (sc.F - t <= 7 ? ' warn' : ''));
    }

    var lead60 = sc.F - d0.cross[0], lead40 = sc.F - d0.cross[1];
    $('m-lead').innerHTML = lead60.toFixed(1) + ' / ' + lead40.toFixed(1) + '<small> 天</small>';

    /* 状态灯 */
    var dot = $('lamp-dot'), txt = $('lamp-txt');
    dot.style.background = LEVELS[lv].c;
    dot.style.boxShadow = '0 0 0 3px ' + LEVELS[lv].c + '2e';
    txt.textContent = LEVELS[lv].name;
    txt.style.color = LEVELS[lv].c;

    /* 结论 */
    var v = $('verdict');
    var head = '场景 <b>' + sc.name + '</b>（' + sc.shape + '）· 第 <b>' + t.toFixed(1) + '</b> 天：' + sc.mech;
    var tail;
    if (t >= sc.F) {
      v.className = 'verdict bad';
      tail = '机组已于第 ' + sc.F + ' 天停机，进入检泵作业（单次 30–60 万元）。若在前兆窗口内介入，本次非计划停机可转为计划内检泵。';
    } else if (lv === 0) {
      v.className = 'verdict ok';
      tail = '运行正常：继续 15 min 一轮滚动监测；前兆窗口预计从第 ' + sc.P0 + ' 天开始。';
    } else if (lv === 1) {
      v.className = 'verdict warn';
      tail = '关注级：纳入 14 天跟踪清单、只跟踪不动作，复核近期工况事件（调参/停电/计量切换）排除干扰。' + sc.act + '。';
    } else if (lv === 2) {
      v.className = 'verdict warn';
      tail = '预警级：建议 7 天内处置，推送附特征归因（电流爬升速率 / 波动谱 / 温度漂移量）。' + sc.act + '。';
    } else {
      v.className = 'verdict bad';
      tail = '紧急级：距停机约 ' + (sc.F - t).toFixed(1) + ' 天，3 天内停机检泵，允许较高误报率。' + sc.act + '。';
    }
    v.innerHTML = head + '<br>' + tail;
  }

  function render() {
    HOVER_M = -1; HOVER_H = -1;
    drawMain();
    drawHl();
    renderMetrics();
  }

  /* ---------- 绑定 ---------- */
  function updateScenBtns() {
    Array.prototype.forEach.call(document.querySelectorAll('#scen-btns .well-btn'), function (btn) {
      btn.classList.toggle('active', +btn.getAttribute('data-scen') === S.scen);
    });
  }

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('#scen-btns .well-btn'), function (btn) {
      btn.addEventListener('click', function () {
        S.scen = +btn.getAttribute('data-scen');
        updateScenBtns();
        render();
      });
    });
    $('s-cursor').addEventListener('input', function () {
      S.cursor = parseFloat(this.value);
      $('o-cursor').textContent = '第 ' + S.cursor.toFixed(1) + ' 天';
      render();
    });
    $('ov-tmp').addEventListener('change', function () { S.ovTmp = this.checked; render(); });
    $('ov-prs').addEventListener('change', function () { S.ovPrs = this.checked; render(); });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      $('s-cursor').value = S.cursor;
      $('o-cursor').textContent = '第 ' + S.cursor.toFixed(1) + ' 天';
      $('ov-tmp').checked = true; $('ov-prs').checked = true;
      updateScenBtns();
      render();
    });
    bindMain();
    bindHl();
  }

  updateScenBtns();
  bind();
  render();
})();

/* ======= 真实数据来源页 ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(x, y, s, attrs, parent) {
    var t = el('text', attrs || {}, parent);
    t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s;
    return t;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

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

  /* ---------- ① 浴盆曲线（canvas，HiDPI） ---------- */
  var B_W = 880, B_H = 210, B_PL = 44, B_PR = 18, B_PT = 26, B_PB = 30;
  function bathLambda(x) {
    /* 失效率模型（示意）：早期失效递减 + 随机失效恒定 + 磨损失效递增 */
    return 0.8 + 2.8 * Math.exp(-x / 0.055) + 2.4 * Math.pow(x, 6);
  }
  function drawBath() {
    var cv = document.getElementById('lit-bath'); if (!cv) return;
    var ctx = setupCanvas(cv, B_W, B_H);
    var pw = B_W - B_PL - B_PR, ph = B_H - B_PT - B_PB;
    var Y1 = 4;
    function xOf(x) { return B_PL + x * pw; }
    function yOf(l) { return B_PT + ph - l / Y1 * ph; }

    ctx.clearRect(0, 0, B_W, B_H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, B_W, B_H);

    /* 三相区间底纹 */
    var phases = [
      { a: 0, b: 0.12, c: '#c9a15a', label: '早期失效（伯努利试验建模）' },
      { a: 0.12, b: 0.72, c: '#2f7d6b', label: '随机失效（恒定 λ）' },
      { a: 0.72, b: 1, c: '#b05a51', label: '磨损失效' }
    ];
    phases.forEach(function (p) {
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.07;
      ctx.fillRect(xOf(p.a), B_PT, xOf(p.b) - xOf(p.a), ph);
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.c;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, (xOf(p.a) + xOf(p.b)) / 2, B_PT + ph - 6);
    });

    /* 网格与轴 */
    ctx.strokeStyle = '#f1ebdd'; ctx.lineWidth = 1;
    ctx.fillStyle = '#8a9298'; ctx.font = '9px Consolas, monospace';
    for (var g = 0; g <= Y1; g += 1) {
      ctx.beginPath(); ctx.moveTo(B_PL, yOf(g)); ctx.lineTo(B_PL + pw, yOf(g)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(g + '', B_PL - 5, yOf(g) + 3);
    }
    ctx.textAlign = 'center';
    ['新装/磨合', '稳定运行', '磨损老化'].forEach(function (lab, i) {
      ctx.fillStyle = '#79828a';
      ctx.fillText(lab, xOf([0.06, 0.42, 0.9][i]), B_PT + ph + 13);
    });
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif';
    ctx.fillText('机组运行时间（归一化）→', B_PL + pw / 2, B_H - 2);
    ctx.save();
    ctx.translate(13, B_PT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('失效率 λ（相对）', 0, 0);
    ctx.restore();

    /* 浴盆曲线 */
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (var i = 0; i <= 160; i++) {
      var x = i / 160;
      if (i === 0) ctx.moveTo(xOf(x), yOf(bathLambda(x)));
      else ctx.lineTo(xOf(x), yOf(bathLambda(x)));
    }
    ctx.stroke();

    /* 退化预警窗口标注 */
    ctx.strokeStyle = '#9a7a1c'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(xOf(0.60), B_PT); ctx.lineTo(xOf(0.60), B_PT + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xOf(0.72), B_PT); ctx.lineTo(xOf(0.72), B_PT + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9a7a1c'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('预警退化窗口（本案例 5–30 天）', xOf(0.66), B_PT - 6 + 14);

    ctx.fillStyle = '#8a9298'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('模型：Sawaryn et al. 1999（SPE-56663-MS）· Milne Point 约 50 起 ESP 失效/年 · 浴盆曲线为示意', B_PL + 4, B_PT - 12);
  }

  /* ---------- ② 四种典型电流卡片形态 ---------- */
  function drawCards() {
    var svg = document.getElementById('lit-cards'); if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 880, H = 122, pw = 195, ph = 78, pt = 8;
    var panels = [
      { name: '正常 · 平稳运行', c: '#2f7d6b', gen: function (k, n, r) { return 46 + r() * 2 - 1; } },
      { name: '气锁 · 锯齿波动', c: '#b05a51', gen: function (k, n, r) { var p = k / n; return 44 + (r() * 2 - 1) * (2 + 10 * p); } },
      { name: '结垢 · 缓慢爬升', c: '#c9a15a', gen: function (k, n, r) { return 42 + 14 * k / n + r() * 2 - 1; } },
      { name: '相间短路 · 骤降', c: '#7a3a33', gen: function (k, n, r) { var p = k / n; return p < 0.72 ? 46 + (r() * 2 - 1) * (1 + 5 * p) : (p < 0.8 ? 46 + 14 * (p - 0.72) / 0.08 : 4 + r() * 1.5); } }
    ];
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    panels.forEach(function (pn, i) {
      var x0 = 15 + i * 215, y0 = pt, n = 60;
      var rnd = mulberry32(311 + i * 37);
      el('rect', { x: x0, y: y0, width: pw, height: ph, fill: '#fff', stroke: '#e9e4d8', rx: 4 }, svg);
      /* 中心线 */
      el('line', { x1: x0 + 8, y1: y0 + ph / 2, x2: x0 + pw - 8, y2: y0 + ph / 2, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      var d = '', ymin = 20, ymax = 64;
      for (var k = 0; k < n; k++) {
        var v = pn.gen(k, n, rnd);
        var px = x0 + 8 + k / (n - 1) * (pw - 16);
        var py = y0 + ph - 8 - (v - ymin) / (ymax - ymin) * (ph - 16);
        d += (k ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      }
      el('path', { d: d, fill: 'none', stroke: pn.c, 'stroke-width': 1.6 }, svg);
      txt(x0 + pw / 2, y0 + ph + 13, pn.name, { 'font-size': 9.5, fill: '#5d666d', 'text-anchor': 'middle' }, svg);
      txt(x0 + 8, y0 + 12, '电流', { 'font-size': 8, fill: '#9ba3a9' }, svg);
    });
    txt(16, H - 2, '形态归纳：Powers 电流卡片法 / API 1982 分类（据 Yang 2022、石油钻采工艺 2022）· 24h 记录卡片形态示意', { 'font-size': 8.5, fill: '#9ba3a9' }, svg);
  }

  /* ---------- 页签 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
        if (id === 'real') drawBath(); /* 页签显示后 clientWidth 就绪，重绘 canvas */
      });
    });
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰（防抖） */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawBath(); }, 120);
  });

  bindTabs();
  drawBath();
  drawCards();
})();
