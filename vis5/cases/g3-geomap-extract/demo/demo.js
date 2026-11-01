/* ======= 历史地质图要素智能提取与矢量化 · 可运行示范 ======= */
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

  /* 确定性伪随机（固定种子，保证每次打开图面一致） */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261030);

  var DEF = { thr: 0.65, wtol: 3, ctol: 32, mlen: 18 };
  var S = Object.assign({}, DEF);
  var MODE = 'overlay'; /* overlay | truth | pred */

  var MAPW = 470, MAPH = 340;

  /* ================= 合成地质图真值生成 ================= */
  /* 地层单元：C2b / J3t / K1d / K2s / E1h / Q（色块为主色调制，「越新越浅」） */
  var UNITS = [
    { code: 'C2b', fill: 'rgba(65,105,155,0.34)' },
    { code: 'J3t', fill: 'rgba(47,125,107,0.28)' },
    { code: 'K1d', fill: 'rgba(47,125,107,0.48)' },
    { code: 'K2s', fill: 'rgba(201,161,90,0.32)' },
    { code: 'E1h', fill: 'rgba(176,90,81,0.26)' },
    { code: 'Q',   fill: 'rgba(121,130,138,0.22)' }
  ];
  var NB = UNITS.length + 1; /* 7 条界线 */

  /* 断层（GB/T 958-2015 线型）：x 表为 y 的函数 */
  function f1x(y) { return 140 + 0.16 * y + 12 * Math.sin(y / 70); }
  function f2x(y) { return 285 + 0.14 * y + 10 * Math.sin(y / 55 + 1.5); }
  function f3x(y) { return 405 + 6 * Math.sin(y / 40); }
  var FAULT_DEF = [
    { name: 'F1 正断层',   kind: '正断层',   fx: f1x, y0: 8,  y1: 334, throw: 22,  teeth: 'down' },
    { name: 'F2 逆断层',   kind: '逆断层',   fx: f2x, y0: 6,  y1: 336, throw: -18, teeth: 'up' },
    { name: 'F3 走滑断层', kind: '走滑断层', fx: f3x, y0: 42, y1: 308, throw: 0,   teeth: null }
  ];

  /* 第 i 条界线的原始 y（未错动） */
  function boundRaw(i, x) {
    return 44 + 44 * i + 14 * Math.sin(x / 60 + i * 1.1) + 8 * Math.sin(x / 23 + i * 2.3);
  }

  /* 生成界线点列，并在断层穿越处错动、断开为分段 */
  function buildBoundaries() {
    var segs = [];
    for (var i = 0; i < NB; i++) {
      var pts = [];
      for (var x = 6; x <= MAPW - 6; x += 6) {
        var y = boundRaw(i, x);
        if (x > f1x(y)) y += FAULT_DEF[0].throw;
        if (x > f2x(y)) y += FAULT_DEF[1].throw;
        pts.push([x, y]);
      }
      var cur = [pts[0]];
      for (var k = 1; k < pts.length; k++) {
        if (Math.abs(pts[k][1] - pts[k - 1][1]) > 10) { segs.push({ cat: 'bound', idx: i, pts: cur }); cur = []; }
        cur.push(pts[k]);
      }
      if (cur.length > 1) segs.push({ cat: 'bound', idx: i, pts: cur });
    }
    return segs;
  }

  function polyLen(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }

  function buildFaults() {
    return FAULT_DEF.map(function (f) {
      var pts = [];
      for (var y = f.y0; y <= f.y1; y += 6) pts.push([f.fx(y), y]);
      return { cat: 'fault', name: f.name, kind: f.kind, def: f, pts: pts };
    });
  }

  /* 产状符号与钻孔：避开右上角图例框 (x>344, y<120) */
  function inLegend(x, y) { return x > 344 && y < 120; }
  function buildPoints() {
    var atts = [], bores = [];
    for (var k = 0; k < 8; k++) {
      var x = 30 + (k % 4) * 108 + rnd() * 30;
      var y = 45 + Math.floor(k / 4) * 150 + rnd() * 80;
      if (inLegend(x, y)) y += 130;
      atts.push({ cat: 'att', name: '产状 ' + (k + 1), x: x, y: y, strike: 15 + rnd() * 50, dip: 25 + Math.floor(rnd() * 35) });
    }
    for (var b = 0; b < 6; b++) {
      var bx = 60 + rnd() * 380, by = 40 + rnd() * 280;
      if (inLegend(bx, by)) by += 130;
      bores.push({ cat: 'bore', name: 'ZK' + (b + 1), x: bx, y: by });
    }
    return { atts: atts, bores: bores };
  }

  /* 置信度：约 85% 要素高置信（0.70–0.97），其余低置信（0.45–0.60），保证默认阈值下接近真实流水线表现 */
  function genConf() { return rnd() < 0.85 ? 0.70 + rnd() * 0.27 : 0.45 + rnd() * 0.15; }

  var GT = []; /* 全部真值要素 */
  buildBoundaries().forEach(function (s) {
    s.len = polyLen(s.pts);
    s.conf = genConf();
    s.name = '地层界线（' + UNITS[clamp(s.idx - 1, 0, 5)].code + ' / ' + UNITS[clamp(s.idx, 0, 5)].code + '）';
    GT.push(s);
  });
  buildFaults().forEach(function (f) {
    f.len = polyLen(f.pts);
    f.conf = genConf();
    GT.push(f);
  });
  var pts0 = buildPoints();
  pts0.atts.forEach(function (a) { a.conf = genConf(); GT.push(a); });
  pts0.bores.forEach(function (b) { b.conf = genConf(); GT.push(b); });

  /* 误检源（非真值）：等高线 2 条、图例框色块 1 处、注记笔画 1 处 */
  function curvePts(yBase, amp, per, ph, x0, x1) {
    var p = [];
    for (var x = x0; x <= x1; x += 8) p.push([x, yBase + amp * Math.sin(x / per + ph)]);
    return p;
  }
  var FPS = [
    { name: '等高线误检', conf: 0.62, pts: curvePts(105, 22, 50, 0, 20, 300) },
    { name: '等高线误检', conf: 0.45, pts: curvePts(258, 18, 40, 3, 150, 460) },
    { name: '图例框色块误检', conf: 0.55, pts: [[358, 20], [370, 20], [370, 29], [358, 29], [358, 20]] },
    { name: '注记笔画误检', conf: 0.38, pts: [[70, 78], [86, 82], [98, 80]] }
  ];
  /* 颜色容差过大时的过度分割误检（单元内部假界线） */
  var OVERSEG = [
    { name: '过度分割假界线', conf: 0.66, pts: curvePts(150, 6, 90, 1, 60, 260) },
    { name: '过度分割假界线', conf: 0.58, pts: curvePts(238, 6, 80, 2, 200, 420) }
  ];

  /* ================= 检出模型 ================= */
  /* 有效置信度：线宽容差影响断层 / 界线匹配，颜色容差影响相似单元界线，长度下限直接滤除 */
  function effConf(e) {
    var c = e.conf;
    if (e.cat === 'fault') {
      if (S.wtol < 3) c *= 0.55 + 0.15 * S.wtol;
      if (e.len < S.mlen) return -1;
    } else if (e.cat === 'bound') {
      if (S.wtol < 2) c *= 0.6 + 0.2 * S.wtol;
      if (S.ctol < 25 && (e.idx === 2 || e.idx === 4)) c *= 0.4; /* 两组相似地层单元合并丢界线 */
      if (e.len < S.mlen) return -1;
    }
    return c;
  }
  function activeFPs() {
    var list = FPS.slice();
    if (S.ctol > 45) list.push(OVERSEG[0]);
    if (S.ctol > 52) list.push(OVERSEG[1]);
    return list;
  }
  function countsAt(thr) {
    var tp = 0, fp = 0;
    GT.forEach(function (e) { if (effConf(e) >= thr) tp++; });
    activeFPs().forEach(function (f) { if (f.conf >= thr) fp++; });
    return { tp: tp, fp: fp };
  }
  function prAt(thr) {
    var c = countsAt(thr);
    var pre = c.tp + c.fp > 0 ? c.tp / (c.tp + c.fp) : 1;
    var rec = c.tp / GT.length;
    var f1 = pre + rec > 0 ? 2 * pre * rec / (pre + rec) : 0;
    return { p: pre, r: rec, f1: f1 };
  }
  /* 拓扑完整率：基线 61% + 界线长度加权召回增益 − 误检惩罚 */
  function topoRate() {
    var tot = 0, got = 0;
    GT.forEach(function (e) {
      if (e.cat !== 'bound') return;
      tot += e.len;
      if (effConf(e) >= S.thr) got += e.len;
    });
    var bRec = tot > 0 ? got / tot : 0;
    var wf = S.wtol >= 3 ? 1 : 0.85;
    var fpN = countsAt(S.thr).fp;
    return clamp(0.62 + 0.34 * bRec * wf - 0.015 * fpN, 0.40, 0.97);
  }
  /* 属性正确率：颜色容差有最优区间，阈值升高略有利 */
  function attrRate() {
    var a = 0.955 + 0.03 * (S.thr - 0.65);
    if (S.ctol < 25) a -= (25 - S.ctol) * 0.004;
    if (S.ctol > 45) a -= (S.ctol - 45) * 0.0025;
    return clamp(a, 0.80, 0.985);
  }
  function classRecalls() {
    var defs = [
      { key: 'fault', name: '断层', color: '#b05a51' },
      { key: 'bound', name: '地层界线', color: '#2f7d6b' },
      { key: 'att', name: '产状符号', color: '#c9a15a' },
      { key: 'bore', name: '钻孔', color: '#41699b' }
    ];
    return defs.map(function (d) {
      var n = 0, tp = 0;
      GT.forEach(function (e) {
        if (e.cat !== d.key) return;
        n++;
        if (effConf(e) >= S.thr) tp++;
      });
      return { name: d.name, color: d.color, n: n, tp: tp, rec: n ? tp / n : 0 };
    });
  }

  /* ================= ① 地图画布 ================= */
  var LEG = { x: 350, y: 8, w: 112, h: 106 };

  function drawPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }

  function drawFaultTeeth(ctx, f) {
    if (!f.def.teeth) { /* 走滑断层：一对箭头 */
      var p1 = f.pts[8], p2 = f.pts[f.pts.length - 9];
      ctx.fillStyle = ctx.strokeStyle;
      [[p1, 1], [p2, -1]].forEach(function (pa) {
        var p = pa[0], s = pa[1];
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0] - 7, p[1] - 4 * s);
        ctx.lineTo(p[0] - 7, p[1] + 4 * s);
        ctx.closePath(); ctx.fill();
      });
      return;
    }
    /* 正 / 逆断层：下降盘一侧画齿线（短横齿） */
    var side = f.def.teeth === 'down' ? 1 : -1;
    for (var i = 4; i < f.pts.length - 2; i += 2) {
      var a = f.pts[i], b = f.pts[i + 1];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L * side, ny = dx / L * side;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(a[0] + nx * 6, a[1] + ny * 6);
      ctx.stroke();
    }
  }

  function drawAttSymbol(ctx, a, color, lw) {
    var r = a.strike * Math.PI / 180;
    var dx = Math.cos(r), dy = Math.sin(r);
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.x - dx * 8, a.y - dy * 8);
    ctx.lineTo(a.x + dx * 8, a.y + dy * 8);
    ctx.stroke();
    /* 倾向短竖（垂直于走向，指向右下侧） */
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + dy * 5, a.y - dx * 5);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '8px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(a.dip + '°', a.x + 7, a.y + 8);
  }

  function drawMap() {
    var cv = $('mapc'), ctx = setupCanvas(cv, MAPW, MAPH);
    ctx.clearRect(0, 0, MAPW, MAPH);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, MAPW, MAPH);

    /* 地层多边形：相邻界线对 + 图幅上下缘 */
    var bounds = [];
    for (var i = 0; i < NB; i++) {
      var pts = [];
      for (var x = 6; x <= MAPW - 6; x += 6) {
        var y = boundRaw(i, x);
        if (x > f1x(y)) y += FAULT_DEF[0].throw;
        if (x > f2x(y)) y += FAULT_DEF[1].throw;
        pts.push([x, y]);
      }
      bounds.push(pts);
    }
    for (var u = 0; u < UNITS.length; u++) {
      var top = u === 0 ? [[6, 0], [MAPW - 6, 0]] : bounds[u];
      var bot = u === UNITS.length - 1 ? [[6, MAPH], [MAPW - 6, MAPH]] : bounds[u + 1];
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (var t = 1; t < top.length; t++) ctx.lineTo(top[t][0], top[t][1]);
      for (var q = bot.length - 1; q >= 0; q--) ctx.lineTo(bot[q][0], bot[q][1]);
      ctx.closePath();
      ctx.fillStyle = UNITS[u].fill;
      ctx.fill();
    }

    /* 地层代号注记（图面左列） */
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'center';
    for (var u2 = 0; u2 < UNITS.length; u2++) {
      var xt = 36;
      var yTop = u2 === 0 ? 6 : boundRaw(u2, xt) + (xt > f1x(boundRaw(u2, xt)) ? 22 : 0) + (xt > f2x(boundRaw(u2, xt)) ? -18 : 0);
      var yBot = u2 === UNITS.length - 1 ? MAPH - 6 : boundRaw(u2 + 1, xt) + (xt > f1x(boundRaw(u2 + 1, xt)) ? 22 : 0) + (xt > f2x(boundRaw(u2 + 1, xt)) ? -18 : 0);
      ctx.fillStyle = '#6d767d';
      ctx.fillText(UNITS[u2].code, xt, (yTop + yBot) / 2 + 3);
    }

    /* 真值底层（原图效果） */
    var truthCol = MODE === 'truth' ? '#5d666d' : '#c9c2b2';
    GT.forEach(function (e) {
      if (e.cat === 'bound') {
        ctx.strokeStyle = truthCol; ctx.lineWidth = MODE === 'truth' ? 1.4 : 1;
        drawPath(ctx, e.pts); ctx.stroke();
      }
    });
    GT.forEach(function (e) {
      if (e.cat === 'fault') {
        ctx.strokeStyle = MODE === 'truth' ? '#b05a51' : '#dbb9b3';
        ctx.lineWidth = 1.8;
        drawPath(ctx, e.pts); ctx.stroke();
        drawFaultTeeth(ctx, e);
      }
    });
    GT.forEach(function (e) {
      if (e.cat === 'att') drawAttSymbol(ctx, e, MODE === 'truth' ? '#3d464b' : '#b9b2a2', 1.2);
      if (e.cat === 'bore') {
        ctx.strokeStyle = MODE === 'truth' ? '#41699b' : '#b6c2d3'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 3.4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '7.5px Consolas, monospace'; ctx.textAlign = 'left';
        ctx.fillText(e.name, e.x + 5, e.y - 4);
      }
    });

    /* 识别状态叠加 */
    if (MODE !== 'truth') {
      ctx.setLineDash([4, 3]);
      GT.forEach(function (e) {
        var hit = effConf(e) >= S.thr;
        if (MODE === 'pred' && !hit) return;
        var col = hit ? '#2f7d6b' : '#b05a51';
        ctx.strokeStyle = col; ctx.lineWidth = hit ? 1.8 : 1.4;
        if (e.cat === 'bound' || e.cat === 'fault') { drawPath(ctx, e.pts); ctx.stroke(); }
        else {
          ctx.beginPath(); ctx.arc(e.x, e.y, 7, 0, Math.PI * 2); ctx.stroke();
        }
      });
      ctx.setLineDash([5, 3]);
      activeFPs().forEach(function (f) {
        if (f.conf < S.thr) return;
        ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.6;
        drawPath(ctx, f.pts); ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    /* 图例框 */
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(LEG.x, LEG.y, LEG.w, LEG.h);
    ctx.strokeStyle = '#cfc7b6'; ctx.lineWidth = 1;
    ctx.strokeRect(LEG.x, LEG.y, LEG.w, LEG.h);
    ctx.fillStyle = '#5d666d'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('图例（GB/T 958）', LEG.x + 6, LEG.y + 11);
    UNITS.forEach(function (un, k) {
      var yy = LEG.y + 18 + k * 14;
      ctx.fillStyle = un.fill;
      ctx.fillRect(LEG.x + 8, yy, 12, 9);
      ctx.strokeStyle = '#9ba3a9'; ctx.lineWidth = 0.6;
      ctx.strokeRect(LEG.x + 8, yy, 12, 9);
      ctx.fillStyle = '#5d666d'; ctx.font = '8px Consolas, monospace';
      ctx.fillText(un.code, LEG.x + 26, yy + 7.5);
    });

    /* 图名条 */
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(6, MAPH - 16, 244, 12);
    ctx.fillStyle = '#79828a'; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('二连盆地某探区 L-50-12 幅（合成示意 · 1:20 万）', 10, MAPH - 7);
  }

  /* 地图 hover：找最近要素 / 误检源 */
  function distToSeg(px, py, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var L2 = dx * dx + dy * dy;
    var t = L2 ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L2, 0, 1) : 0;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  function distToElem(px, py, e) {
    if (e.cat === 'att' || e.cat === 'bore') return Math.hypot(px - e.x, py - e.y);
    var d = 1e9;
    for (var i = 1; i < e.pts.length; i++) d = Math.min(d, distToSeg(px, py, e.pts[i - 1], e.pts[i]));
    return d;
  }
  function bindMapHover() {
    var cv = $('mapc'), tip = $('maptip'), box = $('mapbox');
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var mx = (evt.clientX - r.left) * (MAPW / r.width);
      var my = (evt.clientY - r.top) * (MAPH / r.width);
      var best = null, bd = 10, isFP = false;
      GT.forEach(function (e) {
        var d = distToElem(mx, my, e);
        if (d < bd) { bd = d; best = e; isFP = false; }
      });
      activeFPs().forEach(function (f) {
        var d = distToElem(mx, my, f);
        if (d < bd) { bd = d; best = f; isFP = true; }
      });
      if (!best) { tip.style.display = 'none'; return; }
      var html;
      if (isFP) {
        var shown = best.conf >= S.thr;
        html = '<b>' + best.name + '</b>（误检源）<br>置信度 <b>' + best.conf.toFixed(2) + '</b> · ' +
          (shown ? '<span style="color:#9a7a1c">当前被误报为要素</span>' : '<span style="color:#35765a">已被阈值滤除</span>');
      } else {
        var ec = effConf(best), hit = ec >= S.thr;
        var kind = best.cat === 'fault' ? best.kind : (best.cat === 'bound' ? '地层界线' : (best.cat === 'att' ? '产状符号' : '钻孔'));
        html = '<b>' + best.name + '</b>（' + kind + '）<br>置信度 <b>' + (ec < 0 ? '—（被滤除）' : ec.toFixed(2)) + '</b> · ' +
          (hit ? '<span style="color:#35765a">正确检出 TP</span>' : '<span style="color:#a85147">漏检 FN</span>');
        if (best.len) html += '<br>长度 <b>' + best.len.toFixed(0) + ' px</b>';
        if (best.cat === 'att') html += '<br>走向 <b>' + best.strike.toFixed(0) + '°</b> · 倾角 <b>' + best.dip + '°</b>';
      }
      var rb = box.getBoundingClientRect();
      tip.innerHTML = html;
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 80) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= ③ P-R-F1 曲线 ================= */
  function drawPR() {
    var svg = $('pr');
    var W = 470, H = 220, pl = 34, pr = 12, pt = 14, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var x = function (t) { return pl + t * pw; };
    var y = function (v) { return pt + ph - v * ph; };

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var v = 0; v <= 1.001; v += 0.25) {
      s += '<line x1="' + pl + '" y1="' + y(v) + '" x2="' + (pl + pw) + '" y2="' + y(v) + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v.toFixed(2) + '</text>';
    }
    for (var t = 0; t <= 1.001; t += 0.2) {
      s += '<line x1="' + x(t) + '" y1="' + pt + '" x2="' + x(t) + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + x(t) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + t.toFixed(1) + '</text>';
    }
    /* 验收线 F1 = 0.85 */
    s += '<line x1="' + pl + '" y1="' + y(0.85) + '" x2="' + (pl + pw) + '" y2="' + y(0.85) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (pl + 4) + '" y="' + (y(0.85) - 4) + '" font-size="8.5" fill="#b05a51" font-family="monospace">F1 验收线 0.85</text>';

    var curves = [
      { key: 'p', color: '#2f7d6b' },
      { key: 'r', color: '#41699b' },
      { key: 'f1', color: '#c9a15a' }
    ];
    curves.forEach(function (c) {
      var d = '';
      for (var i = 0; i <= 50; i++) {
        var t = i / 50;
        var v = prAt(t)[c.key];
        d += (i ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + c.color + '" stroke-width="' + (c.key === 'f1' ? 2.4 : 1.8) + '"/>';
    });

    /* 当前阈值 */
    var cur = prAt(S.thr);
    s += '<line x1="' + x(S.thr) + '" y1="' + pt + '" x2="' + x(S.thr) + '" y2="' + (pt + ph) + '" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<circle cx="' + x(S.thr) + '" cy="' + y(cur.f1) + '" r="4.5" fill="#c9a15a" stroke="#fff" stroke-width="1.5"/>';
    s += '<rect x="' + (clamp(x(S.thr), pl + 30, pl + pw - 90) - 30) + '" y="' + (pt + 2) + '" width="86" height="14" rx="3" fill="#fff" stroke="#ddd6c6"/>';
    s += '<text x="' + (clamp(x(S.thr), pl + 30, pl + pw - 90)) + '" y="' + (pt + 12) + '" font-size="8.5" fill="#235f51" text-anchor="middle" font-family="monospace">阈值 ' + S.thr.toFixed(2) + ' F1 ' + cur.f1.toFixed(2) + '</text>';

    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 3) + '" font-size="9" fill="#5d666d" text-anchor="middle">置信度阈值</text>';
    s += '<text x="' + (pl - 26) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 26) + ' ' + (pt + ph / 2) + ')">P / R / F1</text>';

    svg.innerHTML = s;
  }
  function bindPRHover() {
    var svg = $('pr'), tip = $('prtip'), box = $('prbox');
    var W = 470, pl = 34, pr = 12;
    svg.addEventListener('mousemove', function (evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var t = clamp((vx - pl) / (W - pl - pr), 0, 1);
      var v = prAt(t);
      var rb = box.getBoundingClientRect();
      tip.innerHTML = '阈值 <b>' + t.toFixed(2) + '</b><br>准确率 P <b>' + v.p.toFixed(3) + '</b><br>召回率 R <b>' + v.r.toFixed(3) + '</b><br>F1 <b>' + v.f1.toFixed(3) + '</b>';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 150) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 90) + 'px';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= ④ 分类召回条形图 ================= */
  function drawCls() {
    var svg = $('cls');
    var W = 470, H = 128, pl = 62, pr = 46, pt = 10, pb = 18;
    var pw = W - pl - pr, ph = H - pt - pb;
    var rows = classRecalls();
    var gap = ph / rows.length, bh = gap * 0.52;

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    for (var v = 0; v <= 1.001; v += 0.25) {
      var xx = pl + v * pw;
      s += '<line x1="' + xx + '" y1="' + pt + '" x2="' + xx + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xx + '" y="' + (pt + ph + 12) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + (v * 100).toFixed(0) + '%</text>';
    }
    rows.forEach(function (r, i) {
      var cy = pt + gap * (i + 0.5);
      var bw = r.rec * pw;
      s += '<rect x="' + pl + '" y="' + (cy - bh / 2) + '" width="' + Math.max(2, bw) + '" height="' + bh + '" rx="3" fill="' + r.color + '" opacity="0.82"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (cy + 3) + '" font-size="9" fill="#4d565b" text-anchor="end">' + r.name + '</text>';
      s += '<text x="' + (pl + bw + 5) + '" y="' + (cy + 3) + '" font-size="9" fill="#3a4145" font-family="monospace" font-weight="600">' + (r.rec * 100).toFixed(0) + '% (' + r.tp + '/' + r.n + ')</text>';
    });
    svg.innerHTML = s;
  }

  /* ================= 指标卡与诊断 ================= */
  function renderMetrics() {
    var m = prAt(S.thr);
    var topo = topoRate();
    var attr = attrRate();

    $('m-f1').textContent = m.f1.toFixed(3);
    $('m-f1').parentNode.className = 'mcard' + (m.f1 < 0.85 ? ' bad' : '');
    $('m-rec').textContent = (m.r * 100).toFixed(1) + '%';
    $('m-rec').parentNode.className = 'mcard' + (m.r < 0.85 ? ' warn' : '');
    $('m-pre').textContent = (m.p * 100).toFixed(1) + '%';
    $('m-pre').parentNode.className = 'mcard' + (m.p < 0.85 ? ' warn' : '');
    $('m-topo').textContent = (topo * 100).toFixed(1) + '%';
    $('m-topo').parentNode.className = 'mcard' + (topo < 0.90 ? ' bad' : '');
    $('m-attr').textContent = (attr * 100).toFixed(1) + '%';
    $('m-attr').parentNode.className = 'mcard' + (attr < 0.95 ? ' warn' : '');

    return { m: m, topo: topo, attr: attr };
  }

  function renderVerdict(m, topo, attr) {
    var v = $('verdict');
    var head = '阈值 <b>' + S.thr.toFixed(2) + '</b> · 线宽容差 <b>' + S.wtol + ' px</b> · 颜色容差 <b>' + S.ctol + '</b> · 最小图元 <b>' + S.mlen + ' px</b>；';
    var c = countsAt(S.thr);
    if (S.wtol < 2) {
      v.className = 'verdict bad';
      v.innerHTML = head + '线宽容差过小：断层整体偏移 2.5 px 无法匹配，断层 / 界线大量漏检（当前 TP ' + c.tp + '/' + GT.length + '）。建议把容差提到 ≥ 3 px，并以要素级 F1 而非像素 IoU 验收。';
      return;
    }
    if (S.mlen >= 44) {
      v.className = 'verdict bad';
      v.innerHTML = head + '最小图元长度过大：本区 40% 断层短于 2 km，短断层与短界线段被整批滤除，召回 ' + (m.m.r * 100).toFixed(1) + '% 不可接受。建议降到 20 px 以下，碎线交给拓扑重建裁决。';
      return;
    }
    if (S.ctol < 25) {
      v.className = 'verdict warn';
      v.innerHTML = head + '颜色容差过小：两组相似地层单元被合并，其间界线丢失，属性正确率降至 ' + (attr * 100).toFixed(1) + '%。建议容差 25–45，并配合图例映射表校验。';
      return;
    }
    if (S.ctol > 45) {
      v.className = 'verdict warn';
      v.innerHTML = head + '颜色容差过大：地层单元内部被过度分割，产生 ' + c.fp + ' 处假界线误检，检出准确率 ' + (m.m.p * 100).toFixed(1) + '% 下滑。建议回调至 45 以下。';
      return;
    }
    if (S.thr < 0.5) {
      v.className = 'verdict warn';
      v.innerHTML = head + '阈值过低：等高线与图例框色块混入成果（误检 ' + c.fp + ' 处），准确率 ' + (m.m.p * 100).toFixed(1) + '%。这正是「不做版面切分 + 低阈值」的典型陷阱，建议阈值 ≥ 0.6。';
      return;
    }
    if (S.thr > 0.85) {
      v.className = 'verdict warn';
      v.innerHTML = head + '阈值过高：低置信度的小符号与短界线被误杀，召回 ' + (m.m.r * 100).toFixed(1) + '%、拓扑完整率 ' + (topo * 100).toFixed(1) + '% 均低于验收线。';
      return;
    }
    if (m.m.f1 >= 0.85 && topo >= 0.90 && attr >= 0.95) {
      v.className = 'verdict ok';
      v.innerHTML = head + '要素级 F1 <b>' + m.m.f1.toFixed(3) + '</b>、拓扑完整率 <b>' + (topo * 100).toFixed(1) + '%</b>、属性正确率 <b>' + (attr * 100).toFixed(1) + '%</b>，三项均达验收口径。剩余 ' + (GT.length - c.tp) + ' 处漏检转入人工修补清单（端点相近的断线由制图人员裁决）。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = head + 'F1 <b>' + m.m.f1.toFixed(3) + '</b>、拓扑 <b>' + (topo * 100).toFixed(1) + '%</b>、属性 <b>' + (attr * 100).toFixed(1) + '%</b>，未全部达验收线（0.85 / 90% / 95%）。微调阈值至 0.6–0.75、线宽容差 ≥ 3 px 通常即可达标。';
    }
  }

  function render() {
    drawMap();
    drawPR();
    drawCls();
    var r = renderMetrics();
    renderVerdict({ m: r.m }, r.topo, r.attr);
  }

  /* ================= 参数绑定 ================= */
  var OUT = {
    thr: function (v) { return v.toFixed(2); },
    wtol: function (v) { return v + ' px'; },
    ctol: function (v) { return v + ''; },
    mlen: function (v) { return v + ' px'; }
  };
  var KEYS = ['thr', 'wtol', 'ctol', 'mlen'];

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
        S[k] = DEF[k];
        $('o-' + k).textContent = OUT[k](DEF[k]);
      });
      render();
    });
    Array.prototype.forEach.call(document.querySelectorAll('#mode-btns button'), function (btn) {
      btn.addEventListener('click', function () {
        MODE = btn.getAttribute('data-mode');
        document.querySelectorAll('#mode-btns button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        drawMap();
      });
    });
  }

  bind();
  bindMapHover();
  bindPRHover();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(drawMap, 120);
  });
})();

/* ======= 页签切换 ======= */
(function () {
  'use strict';
  var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var id = this.getAttribute('data-tab');
      tabs.forEach(function (o) { o.classList.remove('active'); });
      this.classList.add('active');
      panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
    });
  });
})();
