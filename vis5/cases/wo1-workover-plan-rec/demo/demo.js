/* ======= 修井作业方案智能推荐 · 可运行示范 ======= */
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

  /* ---------- 故障井画像状态 ---------- */
  var DEF = { fault: 'sand', wtype: 'v', depth: 2200, rate: 18, wc: 82, subm: 300, hist: 3, csg: 0 };
  var S = Object.assign({}, DEF);
  var SELECTED = null;   /* 手动指定的方案 id；null = 按综合得分自动推荐 */

  var FAULT_NAMES = {
    sand: '砂卡', wax: '结蜡', rod: '杆断', pump: '泵漏失',
    junk: '落物（油管落井）', casing: '套管变形', water: '出水'
  };
  var SCALE_COLOR = { '小修': '#2f7d6b', '中修': '#c9a15a', '大修': '#b05a51' };
  var WTYPE_FAC = { v: 1.0, d: 0.95, h: 0.88 };
  var WTYPE_NAMES = { v: '直井', d: '定向井', h: '水平井' };

  /* ---------- 候选方案池：21 个，按故障硬匹配，含大/中/小修梯度 ----------
     gain=预期增油基值(t/月) succ=一次成功率基值 cost=费用基值(万元) days=工期基值(天)
     tag: plug=堵水类随含水增益；pump=泵杆类随低沉没度增益                              */
  var PLANS = [
    { id: 'sand-1', fault: 'sand', name: '冲砂解卡', scale: '小修', gain: 4, succ: 0.86, cost: 8, days: 4, tag: '',
      steps: [['压井', .14], ['起原井管柱', .18], ['冲砂解卡', .42], ['下泵完井', .20], ['诱喷投产', .06]] },
    { id: 'sand-2', fault: 'sand', name: '液压解卡+冲砂', scale: '中修', gain: 6, succ: 0.78, cost: 22, days: 7, tag: '',
      steps: [['压井', .12], ['起原井管柱', .15], ['液压解卡', .30], ['冲砂', .25], ['完井投产', .18]] },
    { id: 'sand-3', fault: 'sand', name: '套铣解卡+打捞', scale: '大修', gain: 8, succ: 0.65, cost: 48, days: 13, tag: '',
      steps: [['压井', .10], ['起原井管柱', .12], ['套铣', .34], ['打捞', .24], ['完井投产', .20]] },

    { id: 'wax-1', fault: 'wax', name: '热洗清蜡', scale: '小修', gain: 2.5, succ: 0.90, cost: 3, days: 1.5, tag: 'pump',
      steps: [['压井（热油）', .20], ['热洗清蜡', .45], ['替喷', .20], ['投产', .15]] },
    { id: 'wax-2', fault: 'wax', name: '检泵+清蜡', scale: '小修', gain: 4, succ: 0.85, cost: 9, days: 4, tag: 'pump',
      steps: [['压井', .15], ['起泵管柱', .25], ['清蜡检泵', .35], ['下泵完井', .20], ['投产', .05]] },
    { id: 'wax-3', fault: 'wax', name: '电热清蜡+换泵', scale: '中修', gain: 5.5, succ: 0.76, cost: 20, days: 6, tag: 'pump',
      steps: [['压井', .12], ['起管柱', .20], ['电热清蜡', .30], ['换泵下入', .25], ['完井投产', .13]] },

    { id: 'rod-1', fault: 'rod', name: '捞杆对扣', scale: '小修', gain: 3, succ: 0.88, cost: 5, days: 2, tag: 'pump',
      steps: [['压井', .15], ['起抽油杆柱', .20], ['打捞对扣', .40], ['复产', .25]] },
    { id: 'rod-2', fault: 'rod', name: '检泵换杆', scale: '小修', gain: 4.5, succ: 0.84, cost: 9, days: 4, tag: 'pump',
      steps: [['压井', .15], ['起杆管', .25], ['检泵换杆', .35], ['下泵完井', .20], ['投产', .05]] },
    { id: 'rod-3', fault: 'rod', name: '打捞+杆柱升级', scale: '中修', gain: 6, succ: 0.75, cost: 21, days: 7, tag: 'pump',
      steps: [['压井', .12], ['起杆管', .18], ['打捞落杆', .35], ['杆柱升级下入', .22], ['完井投产', .13]] },

    { id: 'pump-1', fault: 'pump', name: '检泵', scale: '小修', gain: 5, succ: 0.87, cost: 8, days: 3.5, tag: 'pump',
      steps: [['压井', .15], ['起原井管柱', .25], ['检泵（更换泵件）', .30], ['下泵完井', .22], ['投产', .08]] },
    { id: 'pump-2', fault: 'pump', name: '换大泵/泵型升级', scale: '中修', gain: 7, succ: 0.80, cost: 19, days: 6, tag: 'pump',
      steps: [['压井', .13], ['起管柱', .22], ['换泵升级', .33], ['下入完井', .24], ['投产', .08]] },
    { id: 'pump-3', fault: 'pump', name: '电泵转抽', scale: '大修', gain: 12, succ: 0.70, cost: 65, days: 12, tag: 'esp',
      steps: [['压井', .10], ['起有杆泵管柱', .15], ['电潜泵机组下入', .40], ['电缆敷设', .20], ['联调投产', .15]] },

    { id: 'junk-1', fault: 'junk', name: '卡瓦打捞筒打捞', scale: '中修', gain: 6, succ: 0.82, cost: 24, days: 7, tag: '',
      steps: [['压井', .12], ['起管柱', .15], ['下铅印确认鱼顶', .12], ['打捞', .40], ['完井投产', .21]] },
    { id: 'junk-2', fault: 'junk', name: '打捞+磨铣联作', scale: '中修', gain: 7.5, succ: 0.74, cost: 30, days: 9, tag: '',
      steps: [['压井', .10], ['起管柱', .13], ['下铅印', .10], ['打捞', .30], ['磨铣', .22], ['完井投产', .15]] },
    { id: 'junk-3', fault: 'junk', name: '侧钻', scale: '大修', gain: 10, succ: 0.62, cost: 90, days: 22, tag: '',
      steps: [['压井封井', .12], ['侧钻开窗', .30], ['钻进完井', .34], ['下泵投产', .24]] },

    { id: 'cas-1', fault: 'casing', name: '机械整形', scale: '中修', gain: 5, succ: 0.72, cost: 28, days: 9, tag: '',
      steps: [['压井', .12], ['起管柱', .13], ['铅印/多臂井径测井', .15], ['整形器整形', .40], ['完井投产', .20]] },
    { id: 'cas-2', fault: 'casing', name: '补贴加固', scale: '中修', gain: 6.5, succ: 0.78, cost: 35, days: 11, tag: '',
      steps: [['压井', .11], ['起管柱', .12], ['测井定位', .15], ['补贴管下入加固', .42], ['完井投产', .20]] },
    { id: 'cas-3', fault: 'casing', name: '侧钻', scale: '大修', gain: 11, succ: 0.66, cost: 95, days: 24, tag: '',
      steps: [['压井封井', .12], ['侧钻开窗', .30], ['钻进完井', .34], ['下泵投产', .24]] },

    { id: 'wat-1', fault: 'water', name: '化学堵水', scale: '中修', gain: 6, succ: 0.75, cost: 26, days: 8, tag: 'plug',
      steps: [['压井', .13], ['起管柱', .15], ['找水测井', .17], ['挤堵剂', .35], ['候凝投产', .20]] },
    { id: 'wat-2', fault: 'water', name: '机械卡封堵水', scale: '中修', gain: 5.5, succ: 0.80, cost: 24, days: 7, tag: 'plug',
      steps: [['压井', .13], ['起管柱', .16], ['找水测井', .16], ['卡封管柱下入', .35], ['投产', .20]] },
    { id: 'wat-3', fault: 'water', name: '调堵联作', scale: '大修', gain: 9, succ: 0.68, cost: 55, days: 14, tag: 'plug',
      steps: [['压井', .10], ['起管柱', .12], ['调剖', .30], ['堵水', .30], ['候凝投产', .18]] }
  ];

  /* ---------- 方案评价模型 ---------- */
  function evalPlan(p) {
    /* 预期增油 t/月 */
    var g = p.gain * (0.5 + 0.5 * S.rate / 18);
    if (p.tag === 'plug') g *= clamp((S.wc - 45) / 45, 0.2, 1.25);
    if (p.tag === 'pump') g *= clamp(1.25 - S.subm / 1000, 0.5, 1.15);
    if (p.tag === 'esp') g *= 0.6 + S.rate / 30;
    /* 一次成功率 */
    var s = p.succ * (1 - 0.025 * S.hist) * WTYPE_FAC[S.wtype] * (1 - (S.depth - 2000) / 8000);
    /* 井身结构硬过滤：Φ139.7 小套管限制大修工具下入 */
    if (S.csg === 0 && p.scale === '大修') s *= 0.95;
    s = clamp(s, 0.30, 0.97);
    /* 费用 万元 / 工期 天 */
    var c = p.cost * (0.8 + 0.2 * S.depth / 2000);
    var d50 = p.days * Math.sqrt(S.depth / 2000) * (S.hist > 5 ? 1.1 : 1);
    var d80 = d50 * 1.3 + 0.5;   /* 等停系数：等工具/等压井/候凝 */
    var eff = g * 12 / c;        /* 增油费效比 t/万元 */
    return { gain: g, succ: s, cost: c, d50: d50, d80: d80, eff: eff };
  }

  /* 适用候选 + 归一化综合得分 */
  function scoredCandidates() {
    var cands = PLANS.filter(function (p) { return p.fault === S.fault; });
    var arr = cands.map(function (p) { return { p: p, m: evalPlan(p) }; });
    function norm(fn) {
      var vs = arr.map(fn);
      var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
      return function (v) { return hi > lo ? (v - lo) / (hi - lo) : 0.5; };
    }
    var nGain = norm(function (a) { return a.m.gain; });
    var nEff = norm(function (a) { return a.m.eff; });
    var nCost = norm(function (a) { return a.m.cost; });
    var nDays = norm(function (a) { return a.m.d50; });
    arr.forEach(function (a) {
      a.dims = {
        gain: nGain(a.m.gain), succ: (a.m.succ - 0.3) / 0.67, eff: nEff(a.m.eff),
        cost: 1 - nCost(a.m.cost), days: 1 - nDays(a.m.d50)
      };
      a.score = 100 * (0.30 * a.dims.gain + 0.25 * clamp(a.dims.succ, 0, 1) + 0.20 * a.dims.eff
        + 0.15 * a.dims.cost + 0.10 * a.dims.days);
    });
    arr.sort(function (x, y) { return y.score - x.score; });
    return arr;
  }

  function currentRec(cands) {
    if (SELECTED) {
      for (var i = 0; i < cands.length; i++) {
        if (cands[i].p.id === SELECTED) return cands[i];
      }
    }
    return cands[0];
  }

  /* 伪随机（按方案 id 定死）：依据链 Top-8 平均成功率 */
  function caseChain(p) {
    var h = 0;
    for (var i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) % 997;
    var avg = clamp(evalPlan(p).succ + ((h % 7) - 3) * 0.01 + 0.02, 0.5, 0.95);
    return { n: 8, avg: avg };
  }

  /* ---------- canvas tooltip 通用绑定 ---------- */
  function attachTip(cvId, tipId, boxId, getRegions, tipHtml, onClick) {
    var cv = $(cvId), tip = $(tipId), box = $(boxId);
    function logical(evt) {
      var r = cv.getBoundingClientRect();
      var lw = +cv.getAttribute('width') || r.width;
      return { x: (evt.clientX - r.left) * ((+cv.getAttribute('data-lw') || lw) / r.width), y: (evt.clientY - r.top) * ((+cv.getAttribute('data-lh') || r.height) / r.height), rb: box.getBoundingClientRect(), evt: evt };
    }
    function hit(pt) {
      var regs = getRegions();
      for (var i = regs.length - 1; i >= 0; i--) {
        var g = regs[i];
        if (g.type === 'rect' && pt.x >= g.x && pt.x <= g.x + g.w && pt.y >= g.y && pt.y <= g.y + g.h) return g;
        if (g.type === 'circle') {
          var dx = pt.x - g.cx, dy = pt.y - g.cy;
          if (dx * dx + dy * dy <= g.r * g.r) return g;
        }
      }
      return null;
    }
    cv.addEventListener('mousemove', function (evt) {
      var pt = logical(evt), g = hit(pt);
      if (g) {
        tip.innerHTML = tipHtml(g.data);
        tip.style.display = 'block';
        var rb = pt.rb;
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 76) + 'px';
        cv.style.cursor = onClick ? 'pointer' : 'default';
      } else {
        tip.style.display = 'none';
        cv.style.cursor = 'default';
      }
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    if (onClick) {
      cv.addEventListener('click', function (evt) {
        var g = hit(logical(evt));
        if (g) onClick(g.data);
      });
    }
  }

  var REG = { score: [], pareto: [], gantt: [], cmp: [] };

  /* ---------- ② 候选方案综合打分排序条形图 ---------- */
  function drawScores(cands, rec) {
    var cv = $('cv-score');
    var W = 640, H = 200;
    cv.setAttribute('data-lw', W); cv.setAttribute('data-lh', H);
    var ctx = setupCanvas(cv, W, H);
    var pl = 168, pr = 66, pt = 18, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;
    var n = cands.length;
    var gap = ph / n, barH = Math.min(30, gap * 0.52);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);
    ctx.font = '10px Consolas, monospace';

    /* 网格与刻度 0–100 */
    for (var v = 0; v <= 100; v += 20) {
      var gx = pl + v / 100 * pw;
      ctx.strokeStyle = v ? '#efece1' : '#d8d0bc';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx, pt); ctx.lineTo(gx, pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(v + '', gx, pt + ph + 14);
    }
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('综合得分（满分 100）', pl + pw / 2, H - 2);
    ctx.font = '10px Consolas, monospace';

    REG.score = [];
    cands.forEach(function (a, i) {
      var cy = pt + gap * (i + 0.5);
      var bw = a.score / 100 * pw;
      var isRec = a.p.id === rec.p.id;
      var col = SCALE_COLOR[a.p.scale];
      /* 条柱 */
      ctx.fillStyle = col; ctx.globalAlpha = isRec ? 1 : 0.72;
      roundRect(ctx, pl, cy - barH / 2, Math.max(2, bw), barH, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isRec) {
        ctx.strokeStyle = '#41699b'; ctx.lineWidth = 2;
        roundRect(ctx, pl, cy - barH / 2, Math.max(2, bw), barH, 3); ctx.stroke();
      }
      /* 左侧方案名 */
      ctx.fillStyle = isRec ? '#235f51' : '#4d565b';
      ctx.font = (isRec ? 'bold ' : '') + '10.5px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(a.p.name, pl - 52, cy + 3.5);
      /* 规模徽标 */
      ctx.fillStyle = col;
      ctx.textAlign = 'right';
      ctx.font = '9.5px sans-serif';
      ctx.fillText(a.p.scale, pl - 8, cy + 3);
      /* 右侧得分 */
      ctx.fillStyle = '#235f51'; ctx.font = 'bold 10.5px Consolas, monospace'; ctx.textAlign = 'left';
      ctx.fillText(a.score.toFixed(1) + ' 分', pl + bw + 6, cy + 3.5);
      if (isRec) {
        /* 得分过高时标注收入条柱内部右端，避免溢出画布右缘 */
        if (bw > pw * 0.78) {
          ctx.fillStyle = '#fff'; ctx.font = 'bold 9.5px sans-serif'; ctx.textAlign = 'right';
          ctx.fillText('推荐 ◀', pl + bw - 8, cy + 3);
        } else {
          ctx.fillStyle = '#41699b'; ctx.font = '9.5px sans-serif';
          ctx.fillText('◀ 推荐', pl + bw + 52, cy + 3);
        }
      }
      REG.score.push({ type: 'rect', x: pl, y: cy - barH / 2 - 4, w: Math.max(30, bw), h: barH + 8, data: a });
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- ③ 成功率—费用帕累托散点 ---------- */
  function drawPareto(cands, rec) {
    var cv = $('cv-pareto');
    var W = 640, H = 280;
    cv.setAttribute('data-lw', W); cv.setAttribute('data-lh', H);
    var ctx = setupCanvas(cv, W, H);
    var pl = 46, pr = 18, pt = 18, pb = 36;
    var pw = W - pl - pr, ph = H - pt - pb;

    var all = PLANS.map(function (p) { return { p: p, m: evalPlan(p) }; });
    var costMax = Math.max.apply(null, all.map(function (a) { return a.m.cost; })) * 1.12;
    var y0 = 0.5, y1 = 1.0;
    function X(c) { return pl + c / costMax * pw; }
    function Y(s) { return pt + ph - (s - y0) / (y1 - y0) * ph; }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 网格 */
    ctx.font = '10px Consolas, monospace';
    for (var c = 0; c <= costMax; c += 20) {
      ctx.strokeStyle = c ? '#efece1' : '#d8d0bc';
      ctx.beginPath(); ctx.moveTo(X(c), pt); ctx.lineTo(X(c), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(c + '', X(c), pt + ph + 14);
    }
    for (var sv = 0.5; sv <= 1.001; sv += 0.1) {
      ctx.strokeStyle = '#efece1';
      ctx.beginPath(); ctx.moveTo(pl, Y(sv)); ctx.lineTo(pl + pw, Y(sv)); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(sv * 100) + '%', pl - 6, Y(sv) + 3);
    }
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('作业费用（万元）', pl + pw / 2, H - 4);
    ctx.save();
    ctx.translate(12, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('一次成功率', 0, 0);
    ctx.restore();
    ctx.font = '10px Consolas, monospace';

    /* 目标线：一次成功率 85%（项目目标） */
    ctx.strokeStyle = '#2f7d6b'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pl, Y(0.85)); ctx.lineTo(pl + pw, Y(0.85)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#2f7d6b'; ctx.textAlign = 'right'; ctx.font = '9.5px sans-serif';
    ctx.fillText('目标 ≥85%', pl + pw - 4, Y(0.85) - 4);
    /* 人工基线 76% */
    ctx.strokeStyle = '#79828a'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pl, Y(0.76)); ctx.lineTo(pl + pw, Y(0.76)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#79828a'; ctx.textAlign = 'right';
    ctx.fillText('人工基线 76%', pl + pw - 4, Y(0.76) + 12);

    /* 帕累托前沿（适用候选：成功率越高越好、费用越低越好） */
    var frontSet = {};
    for (var i = 0; i < cands.length; i++) {
      var dom = false;
      for (var j = 0; j < cands.length; j++) {
        if (i === j) continue;
        if (cands[j].m.succ >= cands[i].m.succ && cands[j].m.cost <= cands[i].m.cost &&
            (cands[j].m.succ > cands[i].m.succ || cands[j].m.cost < cands[i].m.cost)) { dom = true; break; }
      }
      if (!dom) frontSet[cands[i].p.id] = true;
    }
    var front = cands.filter(function (a) { return frontSet[a.p.id]; })
      .sort(function (a, b) { return a.m.cost - b.m.cost; });
    if (front.length > 1) {
      ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 3]);
      ctx.beginPath();
      front.forEach(function (a, k) {
        var x = X(a.m.cost), y = Y(a.m.succ);
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke(); ctx.setLineDash([]);
    }

    REG.pareto = [];
    /* 不适用候选（其他故障）灰色底点 */
    all.forEach(function (a) {
      if (a.p.fault === S.fault) return;
      ctx.fillStyle = '#79828a'; ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(X(a.m.cost), Y(a.m.succ), 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      REG.pareto.push({ type: 'circle', cx: X(a.m.cost), cy: Y(a.m.succ), r: 6, data: { a: a, applicable: false } });
    });
    /* 适用候选 */
    var gainMax = Math.max.apply(null, cands.map(function (a) { return a.m.gain; }));
    cands.forEach(function (a) {
      var x = X(a.m.cost), y = Y(a.m.succ);
      var r = 5 + a.m.gain / gainMax * 7;
      var isRec = a.p.id === rec.p.id;
      ctx.fillStyle = SCALE_COLOR[a.p.scale]; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (frontSet[a.p.id]) {
        ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.stroke();
      }
      if (isRec) {
        ctx.strokeStyle = '#41699b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, r + 5.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#41699b'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(a.p.name, x + r + 8, y + 3.5);
      }
      REG.pareto.push({ type: 'circle', cx: x, cy: y, r: r + 6, data: { a: a, applicable: true, front: !!frontSet[a.p.id] } });
    });

    ctx.fillStyle = '#9ba3a9'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('灰点 = 其他故障方案（故障硬匹配过滤，不参与推荐）', pl + 4, pt + 12);
  }

  /* ---------- ④ 推荐方案工序甘特 ---------- */
  function drawGantt(rec) {
    var cv = $('cv-gantt');
    var steps = rec.p.steps;
    var W = 640, H = 44 + steps.length * 32 + 30;
    cv.setAttribute('data-lw', W); cv.setAttribute('data-lh', H);
    var ctx = setupCanvas(cv, W, H);
    var pl = 118, pr = 20, pt = 26, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var m = rec.m;

    /* 各工序 P50 / P80：P80 = P50×1.3 + 等停摊派 0.5/工序数 */
    var list = [], t0 = 0;
    steps.forEach(function (st) {
      var d50 = st[1] * m.d50;
      var d80 = d50 * 1.3 + 0.5 / steps.length;
      list.push({ name: st[0], s50: t0, d50: d50, d80: d80 });
      t0 += d50;
    });
    var total = t0 * 1.3 + 0.5;
    function X(t) { return pl + t / total * pw; }
    var STEP_COLORS = ['#2f7d6b', '#c9a15a', '#41699b', '#79828a', '#b05a51', '#2f7d6b'];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 网格 */
    var tInt = total <= 6 ? 1 : total <= 14 ? 2 : 5;
    ctx.font = '10px Consolas, monospace';
    for (var t = 0; t <= total + 0.001; t += tInt) {
      ctx.strokeStyle = t ? '#efece1' : '#d8d0bc';
      ctx.beginPath(); ctx.moveTo(X(t), pt); ctx.lineTo(X(t), pt + ph); ctx.stroke();
      ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'center';
      ctx.fillText(t + '', X(t), pt + ph + 14);
    }
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('作业时间（天）· 方案：' + rec.p.name + '（' + rec.p.scale + '）', pl + pw / 2, H - 4);
    ctx.font = '10px Consolas, monospace';

    REG.gantt = [];
    list.forEach(function (st, i) {
      var cy = pt + (ph / list.length) * (i + 0.5);
      var bh = Math.min(20, ph / list.length * 0.56);
      var col = STEP_COLORS[i % STEP_COLORS.length];
      /* P80 浅色延伸（含等停）：与 P50 同起点，向后延伸 */
      ctx.fillStyle = col; ctx.globalAlpha = 0.25;
      roundRect(ctx, X(st.s50), cy - bh / 2, Math.max(2, X(st.s50 + st.d80) - X(st.s50)), bh, 3); ctx.fill();
      /* P50 实段 */
      ctx.globalAlpha = 0.95;
      roundRect(ctx, X(st.s50), cy - bh / 2, Math.max(2, X(st.s50 + st.d50) - X(st.s50)), bh, 3); ctx.fill();
      ctx.globalAlpha = 1;
      /* 工序名与时长 */
      ctx.fillStyle = '#4d565b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(st.name, pl - 8, cy + 3.5);
      ctx.fillStyle = '#235f51'; ctx.font = '9.5px Consolas, monospace'; ctx.textAlign = 'left';
      var lx = X(st.s50 + st.d80) + 5;
      if (lx < pl + pw - 60) ctx.fillText(st.d50.toFixed(1) + 'd', lx, cy + 3);
      REG.gantt.push({ type: 'rect', x: X(st.s50), y: cy - bh / 2 - 3, w: Math.max(8, X(st.s50 + st.d80) - X(st.s50)), h: bh + 6, data: st });
    });

    /* 累计标注 */
    ctx.fillStyle = '#79828a'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('合计 P50 ' + t0.toFixed(1) + ' 天 / P80 ' + total.toFixed(1) + ' 天（含等工具、等压井、候凝等停）', pl + 2, pt - 10);
  }

  /* ---------- ⑤ 与人工经验对比 ---------- */
  function drawCmp(rec) {
    var cv = $('cv-cmp');
    var W = 640, H = 180;
    cv.setAttribute('data-lw', W); cv.setAttribute('data-lh', H);
    var ctx = setupCanvas(cv, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);
    REG.cmp = [];

    /* 两个子面板：左=编制周期(天) max 1.6；右=一次成功率(%) 0–100 */
    var panels = [
      { x0: 40, x1: 300, title: '方案编制周期（天）', max: 1.6, unit: ' 天',
        bars: [['人工编制', 1.5, '#79828a'], ['本系统', 0.65, '#2f7d6b']] },
      { x0: 370, x1: 622, title: '一次成功率（%）', max: 100, unit: '%',
        bars: [['人工基线', 76, '#79828a'], ['本系统推荐', +(rec.m.succ * 100).toFixed(1), '#2f7d6b']] }
    ];
    var pt = 30, pb = 34, ph = H - pt - pb;
    panels.forEach(function (pn) {
      var pw = pn.x1 - pn.x0;
      /* 网格 4 档 */
      ctx.font = '9.5px Consolas, monospace';
      for (var k = 0; k <= 4; k++) {
        var vv = pn.max * k / 4;
        var yy = pt + ph - vv / pn.max * ph;
        ctx.strokeStyle = k ? '#efece1' : '#d8d0bc';
        ctx.beginPath(); ctx.moveTo(pn.x0, yy); ctx.lineTo(pn.x1, yy); ctx.stroke();
        ctx.fillStyle = '#9ba3a9'; ctx.textAlign = 'right';
        ctx.fillText(pn.max >= 10 ? vv.toFixed(0) : vv.toFixed(1), pn.x0 - 4, yy + 3);
      }
      ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(pn.title, pn.x0 + pw / 2, pt - 14);
      var bw = 56;
      pn.bars.forEach(function (b, i) {
        var cx = pn.x0 + pw * (i + 0.5) / 2;
        var bh2 = b[1] / pn.max * ph;
        var yTop = pt + ph - bh2;
        ctx.fillStyle = b[2]; ctx.globalAlpha = 0.9;
        roundRect(ctx, cx - bw / 2, yTop, bw, bh2, 3); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#242b2e'; ctx.font = 'bold 10.5px Consolas, monospace'; ctx.textAlign = 'center';
        ctx.fillText(b[1] + pn.unit, cx, yTop - 5);
        ctx.fillStyle = '#79828a'; ctx.font = '10px sans-serif';
        ctx.fillText(b[0], cx, pt + ph + 16);
        REG.cmp.push({ type: 'rect', x: cx - bw / 2, y: yTop, w: bw, h: bh2, data: { title: pn.title, label: b[0], val: b[1] + pn.unit } });
      });
    });
    /* 系统口径注释 */
    ctx.fillStyle = '#9ba3a9'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('系统周期 = 模型出草稿 3 h + 半天会审（≈0.65 天）；成功率取当前推荐方案预测值', 40, H - 6);
  }

  /* ---------- 指标卡 + 推荐理由 ---------- */
  function renderCards(cands, rec) {
    var m = rec.m;
    $('m-score').textContent = rec.score.toFixed(1);
    $('m-gain').innerHTML = m.gain.toFixed(1) + '<small> t/月</small>';
    $('m-succ').innerHTML = (m.succ * 100).toFixed(1) + '<small> %</small>';
    $('m-succ').parentNode.className = 'mcard' + (m.succ < 0.70 ? ' bad' : m.succ < 0.80 ? ' warn' : '');
    $('m-cost').innerHTML = m.cost.toFixed(0) + '<small> 万元</small>';
    $('m-cost').parentNode.className = 'mcard' + (m.cost > 50 ? ' warn' : '');
    $('m-days').innerHTML = m.d50.toFixed(1) + '<small> / </small>' + m.d80.toFixed(1) + '<small> 天</small>';
    $('m-eff').innerHTML = m.eff.toFixed(1) + '<small> t/万元</small>';
    $('m-eff').parentNode.className = 'mcard' + (m.eff < 2 ? ' warn' : '');

    var chain = caseChain(rec.p);
    var v = $('verdict');
    var head = '推荐「<b>' + rec.p.name + '</b>」（' + rec.p.scale + '）：故障「' + FAULT_NAMES[S.fault] +
      '」硬匹配命中 Top-' + chain.n + ' 相似案例（平均成功率 ' + (chain.avg * 100).toFixed(0) + '%），井身结构 Φ' +
      (S.csg === 0 ? '139.7' : '177.8') + ' mm 约束通过；综合得分 <b>' + rec.score.toFixed(1) + '</b> 分（预期增油 ' +
      m.gain.toFixed(1) + ' t/月、成功率 ' + (m.succ * 100).toFixed(1) + '%、费用 ' + m.cost.toFixed(0) +
      ' 万元、工期 P50 ' + m.d50.toFixed(1) + ' 天、费效比 ' + m.eff.toFixed(1) + ' t/万元）。编制时长 1—2 天 → <b>3 h</b>，依据链随方案提交会审。';
    if (S.hist >= 6) {
      v.className = 'verdict warn';
      v.innerHTML = head + '<br>风险提示：该井历史作业 ' + S.hist + ' 次，井况复杂、成功率已折减；建议首趟下铅印确认鱼顶/井筒状况后再定工具组合（同类井曾在此步失败）。';
    } else if (m.succ < 0.75) {
      v.className = 'verdict warn';
      v.innerHTML = head + '<br>风险提示：预测一次成功率低于 75%，建议提高方案保守度或并站评估相邻候选「' + (cands[1] ? cands[1].p.name : '—') + '」。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = head;
    }
  }

  /* ---------- 渲染主流程 ---------- */
  function render() {
    var cands = scoredCandidates();
    var rec = currentRec(cands);
    renderCards(cands, rec);
    drawScores(cands, rec);
    drawPareto(cands, rec);
    drawGantt(rec);
    drawCmp(rec);
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    depth: function (v) { return v + ' m'; },
    rate: function (v) { return v + ' t/d'; },
    wc: function (v) { return v + ' %'; },
    subm: function (v) { return v + ' m'; },
    hist: function (v) { return v + ' 次'; },
    csg: function (v) { return (+v === 0 ? '139.7' : '177.8') + ' mm'; }
  };
  var KEYS = ['depth', 'rate', 'wc', 'subm', 'hist', 'csg'];

  function syncInputs() {
    $('s-fault').value = S.fault;
    $('s-wtype').value = S.wtype;
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
  }

  function bind() {
    $('s-fault').addEventListener('change', function () {
      S.fault = this.value; SELECTED = null; render();
    });
    $('s-wtype').addEventListener('change', function () {
      S.wtype = this.value; render();
    });
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      SELECTED = null;
      syncInputs();
      render();
    });
  }

  /* ---------- tooltip 内容 ---------- */
  function tipScore(a) {
    var d = a.dims, m = a.m;
    return '<b>' + a.p.name + '</b>（' + a.p.scale + '）得分 <b>' + a.score.toFixed(1) + '</b><br>' +
      '预期增油 <b>' + m.gain.toFixed(1) + ' t/月</b>（维度 ' + d.gain.toFixed(2) + '）<br>' +
      '成功率 <b>' + (m.succ * 100).toFixed(1) + '%</b>（' + clamp(d.succ, 0, 1).toFixed(2) + '）<br>' +
      '费用 <b>' + m.cost.toFixed(0) + ' 万元</b>（' + d.cost.toFixed(2) + '）<br>' +
      '工期 P50 <b>' + m.d50.toFixed(1) + ' 天</b>（' + d.days.toFixed(2) + '）<br>' +
      '费效比 <b>' + m.eff.toFixed(1) + ' t/万元</b>（' + d.eff.toFixed(2) + '）<br>' +
      '<span style="color:#8a9298">点击指定为推荐方案</span>';
  }
  function tipPareto(g) {
    var a = g.a, m = a.m;
    if (!g.applicable) {
      return '<b>' + a.p.name + '</b>（' + FAULT_NAMES[a.p.fault] + ' · ' + a.p.scale + '）<br>' +
        '<span style="color:#8a9298">非本故障方案，硬匹配过滤</span>';
    }
    return '<b>' + a.p.name + '</b>（' + a.p.scale + '）<br>' +
      '费用 <b>' + m.cost.toFixed(0) + ' 万元</b> · 成功率 <b>' + (m.succ * 100).toFixed(1) + '%</b><br>' +
      '预期增油 <b>' + m.gain.toFixed(1) + ' t/月</b> · 费效比 <b>' + m.eff.toFixed(1) + ' t/万元</b>' +
      (g.front ? '<br><span style="color:#9a7a1c">帕累托前沿（成功率—费用非支配）</span>' : '') +
      '<br><span style="color:#8a9298">点击指定为推荐方案</span>';
  }
  function tipGantt(st) {
    return '<b>' + st.name + '</b><br>P50 <b>' + st.d50.toFixed(1) + ' 天</b> · P80 <b>' + st.d80.toFixed(1) + ' 天</b><br>' +
      '<span style="color:#8a9298">浅色段 = P50→P80 等停余量</span>';
  }
  function tipCmp(d) {
    return '<b>' + d.title + '</b><br>' + d.label + '：<b>' + d.val + '</b>';
  }

  attachTip('cv-score', 'tip-score', 'box-score', function () { return REG.score; }, tipScore, function (a) {
    SELECTED = a.p.id; render();
  });
  attachTip('cv-pareto', 'tip-pareto', 'box-pareto', function () { return REG.pareto; }, tipPareto, function (g) {
    if (g.applicable) { SELECTED = g.a.p.id; render(); }
  });
  attachTip('cv-gantt', 'tip-gantt', 'box-gantt', function () { return REG.gantt; }, tipGantt, null);
  attachTip('cv-cmp', 'tip-cmp', 'box-cmp', function () { return REG.cmp; }, tipCmp, null);

  /* ---------- 页签 ---------- */
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
    /* 支持 #real / #sim 深链直接打开对应页签 */
    var hash = (location.hash || '').replace('#', '');
    if (hash === 'real' || hash === 'sim') {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === hash;
        t.classList.toggle('active', on);
      });
      panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + hash); });
    }
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });

  bind();
  bindTabs();
  syncInputs();
  render();
})();

/* ======= 真实数据来源页：来源—模块对照表 ======= */
(function () {
  'use strict';
  var SOURCES = [
    ['SY/T 5587.12—2018《常规修井作业规程 第12部分：解卡打捞》', '行业标准 · 2018', '解卡打捞施工设计、工具选择与操作要求', '砂卡/杆断/落物类候选方案与成功率基值'],
    ['SY/T 5587.3—2024《常规修井作业规程 第3部分：压井、替喷、诱喷》', '行业标准 · 2024', '压井液选择、压井方式、诱喷作业程序', '甘特图「压井/诱喷投产」工序与时长'],
    ['SY/T 5587.5—2018《常规修井作业规程 第5部分：井下作业井筒准备》', '行业标准 · 2018', '通井、刮削、洗井等井筒准备要求', '井身结构硬过滤（套管尺寸）与通井工序'],
    ['Popa et al., SPE 114229, CBR for Well Failure Diagnostics and Planning', 'SPE 会议 · 2008', '案例推理检索最相似井推荐清砂/修井方案', '故障硬匹配→加权相似度→Top-8 推荐主框架'],
    ['SPE-570431-MS, ML to Enhance Workover Program Success Ratio (Pertamina)', 'SPE 会议 · 2024', '决策树预测修井方案 FLOW/NO FLOW 成功率', '一次成功率预测与历史作业/井型/井深折减'],
    ['Petro-KG, Geoscience Frontiers 13(3):101426', '期刊 · 2022', '本体驱动的石油领域知识图谱构建与智能检索', '「故障—工艺—工具—效果」图谱构建'],
    ['《油田开发中后期措施投入经济效益预测及后评价研究》天然气地球科学 23(5):973—980', '期刊 · 2012', '措施增油量×措施费用盈亏平衡、最低增油界限', '增油费效比指标与方案经济排序'],
    ['《探讨油井措施经济评价的方法与程序》（中国石油）', '方法综述', '措施收益、增量投入产出比、投入回收期指标体系', '指标卡费用口径与费效比（t/万元）']
  ];
  var body = document.getElementById('src-body');
  if (!body) return;
  SOURCES.forEach(function (r, i) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td>';
    body.appendChild(tr);
  });
})();
