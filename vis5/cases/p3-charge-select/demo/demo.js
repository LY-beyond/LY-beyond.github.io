/* ======= 射孔弹型智能选型 · 可运行示范（智能选型模拟） ======= */
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

  var PSI_PER_MPA = 145.038;
  var WALLS = [7.72, 9.17, 10.54, 12.09];           /* 5½″ 17#/20#/23#/26# */
  var WALL_NAMES = ['17# · 7.72 mm', '20# · 9.17 mm', '23# · 10.54 mm', '26# · 12.09 mm'];

  /* ---------- 演示弹型库（33 个型号样本，性能区间对齐真实口径） ----------
     pen: 岩心靶等效穿深 mm；eh: 入口孔径 mm；dmg: 套管损伤深度 mm；
     phaseOk: 相位补偿/定向兼容；minWall: 最小适用壁厚；hist: 历史效果分；disc: 停产 */
  var CHARGES = [
    { id: 'SDP-114', type: '深穿透', pen: 1180, eh: 8.2, dmg: 4.6, phaseOk: true,  minWall: 10.54, hist: 0.93, disc: false },
    { id: 'SDP-108', type: '深穿透', pen: 1080, eh: 8.6, dmg: 4.3, phaseOk: true,  minWall: 10.54, hist: 0.90, disc: false },
    { id: 'SDP-102', type: '深穿透', pen: 1020, eh: 8.9, dmg: 4.0, phaseOk: false, minWall: 9.17,  hist: 0.88, disc: false },
    { id: 'SDP-95',  type: '深穿透', pen: 950,  eh: 9.2, dmg: 3.8, phaseOk: true,  minWall: 9.17,  hist: 0.86, disc: false },
    { id: 'SDP-89',  type: '深穿透', pen: 890,  eh: 9.4, dmg: 3.5, phaseOk: false, minWall: 7.72,  hist: 0.82, disc: false },
    { id: 'SDP-84',  type: '深穿透', pen: 840,  eh: 9.6, dmg: 3.3, phaseOk: true,  minWall: 7.72,  hist: 0.79, disc: false },
    { id: 'SDP-78',  type: '深穿透', pen: 780,  eh: 9.0, dmg: 3.4, phaseOk: false, minWall: 7.72,  hist: 0.70, disc: true  },
    { id: 'SDP-73',  type: '深穿透', pen: 730,  eh: 9.8, dmg: 3.1, phaseOk: true,  minWall: 7.72,  hist: 0.74, disc: false },
    { id: 'SDP-68',  type: '深穿透', pen: 680,  eh: 9.5, dmg: 2.9, phaseOk: false, minWall: 7.72,  hist: 0.71, disc: false },
    { id: 'BH-14',   type: '大孔径', pen: 430,  eh: 13.8, dmg: 3.3, phaseOk: true,  minWall: 9.17,  hist: 0.84, disc: false },
    { id: 'BH-13',   type: '大孔径', pen: 470,  eh: 13.2, dmg: 3.1, phaseOk: false, minWall: 9.17,  hist: 0.86, disc: false },
    { id: 'BH-125',  type: '大孔径', pen: 510,  eh: 12.6, dmg: 2.9, phaseOk: true,  minWall: 7.72,  hist: 0.89, disc: false },
    { id: 'BH-12',   type: '大孔径', pen: 550,  eh: 12.1, dmg: 2.7, phaseOk: true,  minWall: 7.72,  hist: 0.87, disc: false },
    { id: 'BH-115',  type: '大孔径', pen: 580,  eh: 11.6, dmg: 2.6, phaseOk: false, minWall: 7.72,  hist: 0.80, disc: false },
    { id: 'BH-11',   type: '大孔径', pen: 520,  eh: 11.2, dmg: 2.6, phaseOk: false, minWall: 7.72,  hist: 0.68, disc: true  },
    { id: 'BH-105',  type: '大孔径', pen: 610,  eh: 10.8, dmg: 2.5, phaseOk: true,  minWall: 7.72,  hist: 0.76, disc: false },
    { id: 'BH-102',  type: '大孔径', pen: 450,  eh: 10.3, dmg: 2.4, phaseOk: false, minWall: 7.72,  hist: 0.72, disc: true  },
    { id: 'LD-90',   type: '低伤害', pen: 820,  eh: 9.3,  dmg: 1.9, phaseOk: true,  minWall: 7.72,  hist: 0.91, disc: false },
    { id: 'LD-78',   type: '低伤害', pen: 780,  eh: 10.4, dmg: 1.7, phaseOk: true,  minWall: 7.72,  hist: 0.92, disc: false },
    { id: 'LD-72',   type: '低伤害', pen: 720,  eh: 11.1, dmg: 1.6, phaseOk: false, minWall: 7.72,  hist: 0.88, disc: false },
    { id: 'LD-66',   type: '低伤害', pen: 660,  eh: 11.8, dmg: 1.5, phaseOk: true,  minWall: 7.72,  hist: 0.85, disc: false },
    { id: 'LD-60',   type: '低伤害', pen: 600,  eh: 12.4, dmg: 1.4, phaseOk: false, minWall: 7.72,  hist: 0.81, disc: false },
    { id: 'LD-54',   type: '低伤害', pen: 540,  eh: 10.9, dmg: 1.3, phaseOk: false, minWall: 7.72,  hist: 0.66, disc: true  },
    { id: 'LD-48',   type: '低伤害', pen: 500,  eh: 9.6,  dmg: 1.2, phaseOk: true,  minWall: 7.72,  hist: 0.70, disc: false },
    { id: 'GH-88',   type: '常规',   pen: 880,  eh: 9.4,  dmg: 3.0, phaseOk: true,  minWall: 9.17,  hist: 0.83, disc: false },
    { id: 'GH-82',   type: '常规',   pen: 820,  eh: 9.9,  dmg: 2.8, phaseOk: false, minWall: 7.72,  hist: 0.85, disc: false },
    { id: 'GH-76',   type: '常规',   pen: 760,  eh: 10.3, dmg: 2.6, phaseOk: true,  minWall: 7.72,  hist: 0.87, disc: false },
    { id: 'GH-70',   type: '常规',   pen: 700,  eh: 10.7, dmg: 2.4, phaseOk: true,  minWall: 7.72,  hist: 0.84, disc: false },
    { id: 'GH-64',   type: '常规',   pen: 640,  eh: 10.1, dmg: 2.3, phaseOk: false, minWall: 7.72,  hist: 0.69, disc: true  },
    { id: 'GH-58',   type: '常规',   pen: 620,  eh: 9.7,  dmg: 2.2, phaseOk: false, minWall: 7.72,  hist: 0.75, disc: false },
    { id: 'GH-52',   type: '常规',   pen: 560,  eh: 9.2,  dmg: 2.1, phaseOk: false, minWall: 7.72,  hist: 0.64, disc: true  },
    { id: 'GH-46',   type: '常规',   pen: 460,  eh: 10.9, dmg: 2.0, phaseOk: true,  minWall: 7.72,  hist: 0.73, disc: false },
    { id: 'GH-42',   type: '常规',   pen: 420,  eh: 11.4, dmg: 2.0, phaseOk: true,  minWall: 7.72,  hist: 0.77, disc: false }
  ];

  var RULES = [
    { id: 'R1', name: '停产/替代型号一律拦截', test: function (c) { return c.disc; } },
    { id: 'R2', name: '套管损伤阈值（N80 55% / P110 45% 壁厚）',
      test: function (c) { return c.dmg > wall() * (S.grade === 'N80' ? 0.55 : 0.45); } },
    { id: 'R3', name: '井斜 >45° 须相位补偿兼容',
      test: function (c) { return S.dev > 45 && !c.phaseOk; } },
    { id: 'R4', name: '出砂层孔径下限 10 mm',
      test: function (c) { return S.sand === 1 && c.eh < 10; } },
    { id: 'R5', name: '薄壁套管装药限制（壁厚 < ' + '弹型下限）',
      test: function (c) { return wall() < c.minWall; } },
    { id: 'R6', name: '高强度地层穿深下限（灰岩≥600 / 致密 UCS≥75 时≥550 mm）',
      test: function (c) {
        if (S.litho === 'carb') return c.pen < 600;
        if (S.litho === 'tight' && S.ucs >= 75) return c.pen < 550;
        return false;
      } }
  ];

  var DEF = { litho: 'loose', ucs: 20, grade: 'N80', wallIdx: 0, dev: 12, sand: 0 };
  var S = Object.assign({}, DEF);
  function wall() { return WALLS[S.wallIdx]; }

  /* ---------- 物理 / 评分模型 ---------- */
  /* Thompson (1962)：穿深随岩石强度折减，Berea 基准 6500 psi */
  function penEff(c) {
    return c.pen * Math.pow(10, 3.7e-5 * (6500 - S.ucs * PSI_PER_MPA));
  }
  function penTarget() {
    if (S.litho === 'loose') return clamp(430 + 2.5 * (S.ucs - 10), 380, 900);
    if (S.litho === 'tight') return clamp(560 + 3.5 * (S.ucs - 45), 500, 1050);
    return clamp(620 + 2.8 * (S.ucs - 60), 560, 1150);
  }
  function penScore(c) { return clamp(penEff(c) / penTarget(), 0, 1); }
  function ehScore(c) {
    var t = clamp((c.eh - 8) / 6, 0, 1);
    return S.sand === 1 ? t : clamp(0.55 + 0.45 * t, 0, 1);
  }
  function casScore(c) { return clamp(1 - c.dmg / wall(), 0, 1); }
  function scoreOf(c) {
    return 0.4 * penScore(c) + 0.25 * ehScore(c) + 0.2 * casScore(c) + 0.15 * c.hist;
  }

  /* 过滤：返回 {pass:[], blocked:[{c, rule}]} */
  function filterCharges() {
    var pass = [], blocked = [];
    CHARGES.forEach(function (c) {
      var hit = null;
      for (var i = 0; i < RULES.length; i++) {
        if (RULES[i].test(c)) { hit = RULES[i]; break; }
      }
      if (hit) blocked.push({ c: c, rule: hit });
      else pass.push(c);
    });
    pass.sort(function (a, b) { return scoreOf(b) - scoreOf(a); });
    return { pass: pass, blocked: blocked };
  }

  /* 适配度配色：低→红，中→金，高→绿 */
  function scoreColor(s) {
    var lo = [176, 90, 81], mid = [201, 161, 90], hi = [47, 125, 107];
    var r = clamp(s, 0, 1), c;
    if (r < 0.5) {
      var t = r / 0.5;
      c = [lo[0] + (mid[0] - lo[0]) * t, lo[1] + (mid[1] - lo[1]) * t, lo[2] + (mid[2] - lo[2]) * t];
    } else {
      var u = (r - 0.5) / 0.5;
      c = [mid[0] + (hi[0] - mid[0]) * u, mid[1] + (hi[1] - mid[1]) * u, mid[2] + (hi[2] - mid[2]) * u];
    }
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }

  /* ---------- ② 候选散点（canvas，HiDPI + hover） ---------- */
  var SC_W = 470, SC_H = 268, SC_PL = 44, SC_PR = 12, SC_PT = 14, SC_PB = 32;
  var PTS = [];      /* 本帧散点位置缓存（含被拦截点） */
  var HOVER = -1;
  var RES = null;    /* 最近过滤结果 */

  function scX(pen) { return SC_PL + (pen - 380) / (1220 - 380) * (SC_W - SC_PL - SC_PR); }
  function scY(eh) { return SC_PT + (SC_H - SC_PT - SC_PB) - (eh - 7.5) / (14.5 - 7.5) * (SC_H - SC_PT - SC_PB); }

  function drawScatter() {
    var cv = $('scatter');
    var ctx = setupCanvas(cv, SC_W, SC_H);
    var pw = SC_W - SC_PL - SC_PR, ph = SC_H - SC_PT - SC_PB;
    ctx.clearRect(0, 0, SC_W, SC_H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, SC_W, SC_H);

    /* 网格 */
    ctx.strokeStyle = '#efece1'; ctx.lineWidth = 1;
    ctx.fillStyle = '#9ba3a9'; ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'center';
    [400, 600, 800, 1000, 1200].forEach(function (v) {
      var x = scX(v);
      ctx.beginPath(); ctx.moveTo(x, SC_PT); ctx.lineTo(x, SC_PT + ph); ctx.stroke();
      ctx.fillText(v + '', x, SC_PT + ph + 13);
    });
    ctx.textAlign = 'right';
    [8, 10, 12, 14].forEach(function (v) {
      var y = scY(v);
      ctx.beginPath(); ctx.moveTo(SC_PL, y); ctx.lineTo(SC_PL + pw, y); ctx.stroke();
      ctx.fillText(v + '', SC_PL - 5, y + 3);
    });

    /* 穿深目标竖线 */
    var tx = scX(clamp(penTarget(), 380, 1220));
    ctx.strokeStyle = '#c9a15a'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(tx, SC_PT); ctx.lineTo(tx, SC_PT + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9a7a1c'; ctx.textAlign = 'left'; ctx.font = '9px Consolas, monospace';
    ctx.fillText('穿深目标 ' + Math.round(penTarget()) + ' mm', Math.min(tx + 4, SC_W - 96), SC_PT + 10);

    /* 出砂层孔径下限横线 */
    if (S.sand === 1) {
      var sy = scY(10);
      ctx.strokeStyle = '#b05a51'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(SC_PL, sy); ctx.lineTo(SC_PL + pw, sy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b05a51'; ctx.textAlign = 'right';
      ctx.fillText('出砂层孔径下限 10 mm', SC_PL + pw - 3, sy - 4);
    }

    /* 散点：先画被拦截（灰），再画候选 */
    PTS = [];
    var topMap = {};
    if (RES) RES.pass.slice(0, 3).forEach(function (c, i) { topMap[c.id] = i + 1; });

    if (RES) {
      RES.blocked.forEach(function (b, i) {
        var x = scX(b.c.pen), y = scY(b.c.eh);
        PTS.push({ x: x, y: y, kind: 'blocked', ref: b });
        ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = '#c9c4b6'; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#b05a51'; ctx.setLineDash([2, 2]); ctx.lineWidth = 0.9; ctx.stroke();
        ctx.setLineDash([]);
      });
      RES.pass.forEach(function (c, i) {
        var x = scX(c.pen), y = scY(c.eh);
        var sc = scoreOf(c);
        PTS.push({ x: x, y: y, kind: 'pass', ref: c, rank: i });
        ctx.beginPath(); ctx.arc(x, y, topMap[c.id] ? 6 : 5, 0, Math.PI * 2);
        ctx.fillStyle = scoreColor(sc); ctx.globalAlpha = 0.88; ctx.fill(); ctx.globalAlpha = 1;
        if (topMap[c.id]) {
          ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#7a5f21'; ctx.font = 'bold 9px Consolas, monospace';
          ctx.textAlign = 'left';
          ctx.fillText('Top' + topMap[c.id], x + 8, y - 7);
        }
      });
      /* hover 高亮 */
      if (HOVER >= 0 && PTS[HOVER]) {
        ctx.beginPath(); ctx.arc(PTS[HOVER].x, PTS[HOVER].y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#2f3538'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    }

    /* 轴标题 */
    ctx.fillStyle = '#5d666d'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('岩心靶等效穿深（mm）', SC_PL + pw / 2, SC_H - 3);
    ctx.save();
    ctx.translate(11, SC_PT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('入口孔径（mm）', 0, 0);
    ctx.restore();
  }

  function bindScatter() {
    var cv = $('scatter'), tip = $('sc-tip'), box = $('sc-box');
    function hit(evt) {
      var r = cv.getBoundingClientRect();
      var mx = (evt.clientX - r.left) * (SC_W / r.width);
      var my = (evt.clientY - r.top) * (SC_H / r.height);
      var bi = -1, bd = 15;
      PTS.forEach(function (p, i) {
        var dx = p.x - mx, dy = p.y - my, d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; bi = i; }
      });
      return bi;
    }
    cv.addEventListener('mousemove', function (evt) {
      var i = hit(evt);
      if (i !== HOVER) { HOVER = i; drawScatter(); }
      if (i < 0 || !PTS[i]) { tip.style.display = 'none'; return; }
      var p = PTS[i], html;
      if (p.kind === 'blocked') {
        html = '<b>' + p.ref.c.id + '</b>（' + p.ref.c.type + '）<br>' +
          '穿深 ' + p.ref.c.pen + ' mm · 孔径 ' + p.ref.c.eh + ' mm<br>' +
          '<span style="color:#b05a51">被 ' + p.ref.rule.id + ' 拦截：' + p.ref.rule.name + '</span>';
      } else {
        var c = p.ref;
        html = '<b>' + c.id + '</b>（' + c.type + '）' + (p.rank < 3 ? ' · <span style="color:#9a7a1c">Top-' + (p.rank + 1) + '</span>' : '') + '<br>' +
          '等效穿深 ' + c.pen + ' mm → 有效 <b>' + Math.round(penEff(c)) + ' mm</b><br>' +
          '孔径 ' + c.eh + ' mm · 损伤 ' + c.dmg.toFixed(1) + ' mm · 历史 ' + c.hist.toFixed(2) + '<br>' +
          '适配度 <b>' + scoreOf(c).toFixed(3) + '</b>';
      }
      tip.innerHTML = html;
      var rb = box.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 236) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 92) + 'px';
    });
    cv.addEventListener('mouseleave', function () { HOVER = -1; tip.style.display = 'none'; drawScatter(); });
  }

  /* ---------- ① 过滤面板 ---------- */
  function renderFilter() {
    $('m-total').innerHTML = CHARGES.length + '<small> 个（在用 27）</small>';
    $('m-blocked').innerHTML = RES.blocked.length + '<small> 个</small>';
    $('m-blocked').parentNode.className = 'mcard' + (RES.blocked.length > 12 ? ' bad' : (RES.blocked.length > 6 ? ' warn' : ''));
    $('m-pass').innerHTML = RES.pass.length + '<small> 个</small>';
    var top1 = RES.pass[0];
    $('m-top1').innerHTML = top1 ? scoreOf(top1).toFixed(3) : '—';

    /* 规则卡片：当前有拦截的规则高亮并计数 */
    var counts = {};
    RES.blocked.forEach(function (b) { counts[b.rule.id] = (counts[b.rule.id] || 0) + 1; });
    $('rule-list').innerHTML = RULES.map(function (r) {
      var n = counts[r.id] || 0;
      return '<span class="rule-chip' + (n ? ' hot' : '') + '"><b>' + r.id + '</b> ' + r.name + (n ? ' ×' + n : '') + '</span>';
    }).join('');

    /* 被拦截弹型灰显 + 规则标注 */
    $('blocked-chips').innerHTML = RES.blocked.length
      ? RES.blocked.map(function (b) {
          return '<span class="b-chip">' + b.c.id + ' <b>' + b.rule.id + '</b></span>';
        }).join('')
      : '<span class="b-chip ok">当前井况下无弹型被拦截</span>';
  }

  /* ---------- ③ 排序表 ---------- */
  function renderRank() {
    var body = $('rank-body');
    var rows = RES.pass.slice(0, 8);
    body.innerHTML = rows.map(function (c, i) {
      var cls = i === 0 ? ' class="top1"' : (i === 1 ? ' class="top2"' : (i === 2 ? ' class="top3"' : ''));
      var badge = i < 3 ? '<span class="rank-badge">' + (i + 1) + '</span>' : (i + 1);
      return '<tr' + cls + '><td class="num">' + badge + '</td><td><b>' + c.id + '</b></td><td>' + c.type + '</td>' +
        '<td class="num">' + Math.round(penEff(c)) + ' mm</td><td class="num">' + c.eh.toFixed(1) + ' mm</td>' +
        '<td class="num">' + penScore(c).toFixed(2) + '</td><td class="num">' + ehScore(c).toFixed(2) + '</td>' +
        '<td class="num">' + casScore(c).toFixed(2) + '</td><td class="num">' + c.hist.toFixed(2) + '</td>' +
        '<td class="num"><b>' + scoreOf(c).toFixed(3) + '</b></td></tr>';
    }).join('');
  }

  /* ---------- ④ Top-3 对比条形图（SVG） ---------- */
  function drawCmp() {
    var svg = $('cmp');
    var W = 470, H = 190, pl = 40, pr = 12, pt = 16, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    var top3 = RES.pass.slice(0, 3);
    var colors = ['#2f7d6b', '#41699b', '#c9a15a'];
    var groups = [
      { name: '有效穿深', unit: 'mm', vals: top3.map(function (c) { return penEff(c); }), norm: 1200, fmt: function (v) { return Math.round(v) + ''; } },
      { name: '入口孔径', unit: 'mm', vals: top3.map(function (c) { return c.eh; }), norm: 14, fmt: function (v) { return v.toFixed(1); } },
      { name: '适配度', unit: '', vals: top3.map(function (c) { return scoreOf(c); }), norm: 1, fmt: function (v) { return v.toFixed(3); } }
    ];
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
      var y = pt + ph - g * ph;
      s += '<line x1="' + pl + '" y1="' + y + '" x2="' + (pl + pw) + '" y2="' + y + '" stroke="' + (g ? '#efece1' : '#d8d0bc') + '"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (y + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + (g * 100).toFixed(0) + '%</text>';
    });
    var gw = pw / groups.length, bw = 30;
    groups.forEach(function (g, gi) {
      var gx = pl + gw * gi + gw / 2;
      top3.forEach(function (c, ci) {
        var v = g.vals[ci], hgt = clamp(v / g.norm, 0, 1) * ph;
        var x = gx + (ci - 1) * (bw + 5) - bw / 2;
        var y = pt + ph - hgt;
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + hgt.toFixed(1) + '" rx="3" fill="' + colors[ci] + '" opacity="0.85"/>';
        s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" font-size="9" fill="#235f51" text-anchor="middle" font-family="monospace" font-weight="600">' + g.fmt(v) + '</text>';
      });
      s += '<text x="' + gx + '" y="' + (pt + ph + 14) + '" font-size="9.5" fill="#5d666d" text-anchor="middle">' + g.name + (g.unit ? '（' + g.unit + '）' : '') + '</text>';
    });
    s += '<text x="' + (pl - 30) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 30) + ' ' + (pt + ph / 2) + ')">归一化占比</text>';
    svg.innerHTML = s;

    $('cmp-legend').innerHTML = top3.map(function (c, i) {
      return '<span><i style="background:' + colors[i] + ';height:4px"></i>Top-' + (i + 1) + ' ' + c.id + '（' + c.type + '）</span>';
    }).join('');
  }

  /* ---------- 结论 ---------- */
  function renderVerdict() {
    var v = $('verdict');
    if (!RES.pass.length) {
      v.className = 'verdict bad';
      v.innerHTML = '当前井况下全部弹型被规则拦截，请放宽井况约束或联系专家复核规则库。';
      return;
    }
    var t1 = RES.pass[0];
    var counts = {};
    RES.blocked.forEach(function (b) { counts[b.rule.id] = (counts[b.rule.id] || 0) + 1; });
    var hot = RULES.filter(function (r) { return counts[r.id]; })
      .map(function (r) { return r.id + '（' + counts[r.id] + ' 个）'; }).join('、');
    var lithoName = { loose: '疏松砂岩', tight: '致密砂岩', carb: '灰岩' }[S.litho];
    var head = lithoName + ' UCS <b>' + S.ucs + '</b> MPa · ' + S.grade + ' 壁厚 <b>' + wall() + '</b> mm · 井斜 <b>' + S.dev + '°</b>' +
      (S.sand ? ' · 有出砂倾向' : '') + '：穿深目标 <b>' + Math.round(penTarget()) + '</b> mm，' +
      RES.pass.length + '/' + CHARGES.length + ' 个弹型进入候选' + (hot ? '，拦截触发 ' + hot : '') + '。';
    if (scoreOf(t1) >= 0.75) {
      v.className = 'verdict ok';
      v.innerHTML = head + '推荐 <b>' + t1.id + '</b>（' + t1.type + '）：有效穿深 <b>' + Math.round(penEff(t1)) + '</b> mm、孔径 <b>' + t1.eh.toFixed(1) + '</b> mm、套管损伤 <b>' + t1.dmg.toFixed(1) + '</b> mm，适配度 <b>' + scoreOf(t1).toFixed(3) + '</b>，可下发复核。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = head + '首选 <b>' + t1.id + '</b> 适配度仅 <b>' + scoreOf(t1).toFixed(3) + '</b>（<0.75）：当前约束偏苛刻（薄壁 / 高斜 / 出砂 / 高强度），建议复核规则命中情况或考虑低伤害弹型折中。';
    }
  }

  /* ---------- 渲染与绑定 ---------- */
  function render() {
    RES = filterCharges();
    HOVER = -1;
    renderFilter();
    drawScatter();
    renderRank();
    drawCmp();
    renderVerdict();
  }

  function bindSeg(id, key, cb) {
    var seg = $(id);
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (o) { o.classList.remove('on'); });
        btn.classList.add('on');
        var v = btn.getAttribute('data-v');
        if (key === 'litho') {
          S.litho = v;
          /* 切换岩性时把 UCS 落到该岩性典型区间中值 */
          var defUcs = { loose: 20, tight: 75, carb: 95 };
          S.ucs = defUcs[v];
          $('s-ucs').value = S.ucs;
          $('o-ucs').textContent = S.ucs + ' MPa';
        } else if (key === 'grade') S.grade = v;
        else if (key === 'sand') S.sand = +v;
        render();
        if (cb) cb();
      });
    });
  }

  function bind() {
    bindSeg('seg-litho', 'litho');
    bindSeg('seg-grade', 'grade');
    bindSeg('seg-sand', 'sand');
    $('s-ucs').addEventListener('input', function () {
      S.ucs = parseFloat(this.value);
      $('o-ucs').textContent = S.ucs + ' MPa';
      render();
    });
    $('s-wall').addEventListener('input', function () {
      S.wallIdx = +this.value;
      $('o-wall').textContent = WALLS[S.wallIdx] + ' mm';
      render();
    });
    $('s-dev').addEventListener('input', function () {
      S.dev = +this.value;
      $('o-dev').textContent = S.dev + '°';
      render();
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      $('s-ucs').value = S.ucs; $('o-ucs').textContent = S.ucs + ' MPa';
      $('s-wall').value = S.wallIdx; $('o-wall').textContent = WALLS[S.wallIdx] + ' mm';
      $('s-dev').value = S.dev; $('o-dev').textContent = S.dev + '°';
      [['seg-litho', S.litho], ['seg-grade', S.grade], ['seg-sand', '' + S.sand]].forEach(function (p) {
        Array.prototype.forEach.call($(p[0]).querySelectorAll('button'), function (b) {
          b.classList.toggle('on', b.getAttribute('data-v') === p[1]);
        });
      });
      render();
    });
    bindScatter();
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰（防抖） */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { drawScatter(); }, 120);
  });

  bind();
  render();
})();

/* ======= 射孔弹型智能选型 · 真实数据来源页 ======= */
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
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* Hansen B. (Devon Energy) "Casing Perforating Overview"（EPA 档案公开 PDF）：
     某公司 API-RP 43 Section I（第 5 版）混凝土靶性能表摘录 */
  var REAL = [
    { gun: '1-9/16″', name: 'AJ',       expl: 'HMX', g: 3.0,  eh: 0.24, pen: 8.4,  psi: 7025, casing: '4½″ 11.6# L-80', fam: '大孔径类' },
    { gun: '2″',      name: 'Predator', expl: 'HMX', g: 6.5,  eh: 0.24, pen: 21.4, psi: 6287, casing: '4½″ 11.6# L-80', fam: '深穿透类' },
    { gun: '2¾″',     name: 'AJ',       expl: 'HMX', g: 10.5, eh: 0.30, pen: 18.1, psi: 7040, casing: '4½″ 11.6# L-80', fam: '大孔径类' },
    { gun: '2¾″',     name: 'Predator', expl: 'HMX', g: 15.0, eh: 0.28, pen: 23.2, psi: 8698, casing: '4½″ 11.6# L-80', fam: '深穿透类' },
    { gun: '2⅞″',     name: 'X-Jet',    expl: 'HMX', g: 16.0, eh: 0.28, pen: 27.2, psi: 7476, casing: '4½″ 11.6# L-80', fam: '深穿透类' },
    { gun: '2⅞″',     name: 'DP',       expl: 'HMX', g: 16.0, eh: 0.33, pen: 12.7, psi: 5350, casing: '4½″ 11.6# L-80', fam: '深穿透类' },
    { gun: '3⅜″',     name: 'AJ',       expl: 'HMX', g: 21.0, eh: 0.46, pen: 23.7, psi: 8400, casing: '4½″ 11.6# L-80', fam: '大孔径类' },
    { gun: '3⅜″',     name: 'DP',       expl: 'RDX', g: 23.0, eh: 0.39, pen: 22.1, psi: 7030, casing: '5½″ 17# L-80',   fam: '深穿透类' },
    { gun: '3⅜″',     name: 'Predator', expl: 'HMX', g: 22.0, eh: 0.47, pen: 33.9, psi: 7288, casing: '4½″ 11.6# L-80', fam: '深穿透类' },
    { gun: '3⅜″',     name: 'Predator', expl: 'HMX', g: 32.0, eh: 0.47, pen: 36.5, psi: 7037, casing: '4½″ 11.6# L-80', fam: '深穿透类' },
    { gun: '3½″',     name: 'Predator', expl: 'HMX', g: 32.0, eh: 0.40, pen: 39.4, psi: 5385, casing: '5″ 15# L-80',    fam: '深穿透类' },
    { gun: '4″',      name: 'Predator', expl: 'HMX', g: 38.5, eh: 0.49, pen: 36.9, psi: 7620, casing: '5½″ 17# L-80',   fam: '深穿透类' },
    { gun: '4″',      name: 'AJ',       expl: 'HMX', g: 32.0, eh: 0.49, pen: 42.5, psi: 7776, casing: '5½″ 17# L-80',   fam: '大孔径类' }
  ];

  /* API 5CT 钢级（ksi→MPa） */
  var GRADES = [
    { g: 'N80',  yMin: 552, yMax: 758, ts: 689, color: '#2f7d6b' },
    { g: 'P110', yMin: 758, yMax: 965, ts: 862, color: '#41699b' }
  ];

  /* API 5CT 5½″（139.7 mm）套管壁厚规格 */
  var WALLS = [
    { ppf: '17#', inch: 0.304, mm: 7.72 },
    { ppf: '20#', inch: 0.361, mm: 9.17 },
    { ppf: '23#', inch: 0.415, mm: 10.54 },
    { ppf: '26#', inch: 0.476, mm: 12.09 }
  ];

  /* ---------- ① 真实弹型散点（SVG + tooltip） ---------- */
  var RS_W = 880, RS_H = 250, RS_PL = 52, RS_PR = 16, RS_PT = 24, RS_PB = 36;
  function drawRealScatter() {
    var svg = document.getElementById('lit-scatter'); if (!svg) return;
    var plotW = RS_W - RS_PL - RS_PR, plotH = RS_H - RS_PT - RS_PB;
    function xOf(v) { return RS_PL + (v - 5) / 40 * plotW; }
    function yOf(v) { return RS_PT + plotH - (v - 0.2) / 0.35 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: RS_W, height: RS_H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var p = 10; p <= 40; p += 10) {
      var x = xOf(p);
      el('line', { x1: x, y1: RS_PT, x2: x, y2: RS_PT + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, RS_PT + plotH + 14, p + '″', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    }
    [0.2, 0.3, 0.4, 0.5].forEach(function (v) {
      var y = yOf(v);
      el('line', { x1: RS_PL, y1: y, x2: RS_W - RS_PR, y2: y, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(RS_PL - 6, y + 3, v.toFixed(1) + '″', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);
    });
    txt(RS_PL + plotW / 2, RS_H - 4, 'API 混凝土靶穿深（in）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(13, RS_PT + plotH / 2, '入口孔径（in）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 13 ' + (RS_PT + plotH / 2) + ')' }, svg);
    /* 分区注释带 */
    txt(xOf(36), yOf(0.24) - 4, '深穿透区（穿深长 · 孔径小）', { 'font-size': 9, fill: '#41699b', 'text-anchor': 'middle' }, svg);
    txt(xOf(12), yOf(0.50) + 12, '大孔径区', { 'font-size': 9, fill: '#9a7a1c', 'text-anchor': 'middle' }, svg);
    REAL.forEach(function (d, i) {
      var col = d.fam === '深穿透类' ? '#41699b' : '#c9a15a';
      el('circle', { 'data-idx': i, cx: xOf(d.pen), cy: yOf(d.eh), r: 6.5, fill: col, opacity: 0.82, stroke: '#fff', 'stroke-width': 1.2, style: 'cursor:pointer' }, svg);
      /* 弹型标签：错开避免与相邻点文字重叠 */
      var dy = (i % 2 === 0) ? -10 : 16;
      txt(xOf(d.pen), yOf(d.eh) + dy, d.gun + ' ' + d.name, { 'font-size': 8.5, fill: '#79828a', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    });
    txt(RS_PL + 2, 13, 'Hansen (Devon Energy) · API-RP 43 Section I 混凝土靶 · L-80 套管 · 悬停读数', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function fillRealTable() {
    var body = document.getElementById('lit-bodyA'); if (!body) return;
    REAL.forEach(function (d) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + d.gun + '</td><td>' + d.name + ' / ' + d.expl + '</td><td class="num">' + d.g.toFixed(1) + '</td>' +
        '<td class="num">' + d.eh.toFixed(2) + '</td><td class="num">' + d.pen.toFixed(1) + '</td>' +
        '<td class="num">' + Math.round(d.pen * 25.4) + '</td><td class="num">' + (d.eh * 25.4).toFixed(1) + '</td>' +
        '<td class="num">' + d.psi + '</td><td>' + d.casing + '</td>';
      body.appendChild(tr);
    });
  }

  /* ---------- ②a 钢级强度区间图 ---------- */
  function drawGrade() {
    var svg = document.getElementById('lit-grade'); if (!svg) return;
    var W = 430, H = 190, pl = 46, pr = 14, pt = 20, pb = 30;
    var plotW = W - pl - pr, plotH = H - pt - pb;
    function xOf(v) { return pl + (v - 400) / 600 * plotW; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var v = 400; v <= 1000; v += 100) {
      var x = xOf(v);
      el('line', { x1: x, y1: pt, x2: x, y2: pt + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, pt + plotH + 14, v + '', { 'font-size': 8.5, fill: '#8a9298', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    }
    txt(pl + plotW / 2, H - 3, '强度（MPa）', { 'font-size': 9, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    GRADES.forEach(function (d, i) {
      var cy = pt + plotH * (i + 0.5) / GRADES.length;
      var bh = 22;
      el('rect', { 'data-row': i, x: xOf(d.yMin), y: cy - bh / 2, width: xOf(d.yMax) - xOf(d.yMin), height: bh, rx: 4, fill: d.color, opacity: 0.8, style: 'cursor:pointer' }, svg);
      txt(xOf(d.yMin) - 5, cy + 3, d.yMin + '', { 'font-size': 8.5, fill: '#8a9298', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);
      txt(xOf(d.yMax) + 5, cy + 3, d.yMax + '', { 'font-size': 8.5, fill: '#8a9298', 'text-anchor': 'start', 'font-family': 'Consolas, monospace' }, svg);
      /* 抗拉强度刻度线 */
      el('line', { x1: xOf(d.ts), y1: cy - bh / 2 - 5, x2: xOf(d.ts), y2: cy + bh / 2 + 5, stroke: '#2f3538', 'stroke-width': 1.4 }, svg);
      txt(xOf(d.ts), cy - bh / 2 - 8, '抗拉 ≥' + d.ts, { 'font-size': 8.5, fill: '#2f3538', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
      txt(pl - 38, cy + 3.5, d.g, { 'font-size': 10, fill: '#2f3538', 'font-weight': 600 }, svg);
    });
    txt(pl + 2, 12, 'API 5CT 屈服强度区间（实心带）与最小抗拉强度（竖刻度）', { 'font-size': 8.5, fill: '#8a9298' }, svg);
  }

  /* ---------- ②b 套管壁厚柱状图 ---------- */
  function drawWall() {
    var svg = document.getElementById('lit-wall'); if (!svg) return;
    var W = 430, H = 190, pl = 36, pr = 10, pt = 22, pb = 34;
    var plotW = W - pl - pr, plotH = H - pt - pb;
    var Y1 = 14;
    function yOf(v) { return pt + (Y1 - v) / Y1 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var v = 0; v <= Y1; v += 2) {
      var y = yOf(v);
      el('line', { x1: pl, y1: y, x2: W - pr, y2: y, stroke: v ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(pl - 5, y + 3, v + '', { 'font-size': 8.5, fill: '#8a9298', 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }, svg);
    }
    var bw = 56;
    WALLS.forEach(function (d, i) {
      var cx = pl + plotW * (i + 0.5) / WALLS.length;
      var y = yOf(d.mm);
      el('rect', { 'data-idx': i, x: cx - bw / 2, y: y, width: bw, height: pt + plotH - y, rx: 3, fill: '#c9a15a', opacity: 0.85, style: 'cursor:pointer' }, svg);
      txt(cx, y - 5, d.mm.toFixed(2) + ' mm', { 'font-size': 9, fill: '#7a5f21', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace', 'font-weight': 600 }, svg);
      txt(cx, pt + plotH + 14, '5½″ ' + d.ppf, { 'font-size': 9, fill: '#5d666d', 'text-anchor': 'middle' }, svg);
      txt(cx, pt + plotH + 26, d.inch.toFixed(3) + ' in', { 'font-size': 8.5, fill: '#9ba3a9', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    });
    txt(pl + 2, 12, 'API 5CT · 5½″（139.7 mm）套管壁厚规格', { 'font-size': 8.5, fill: '#8a9298' }, svg);
  }

  /* ---------- ③ 穿深基准折算示意 ---------- */
  function drawConv() {
    var svg = document.getElementById('lit-conv'); if (!svg) return;
    var W = 880, H = 170, pl = 150, pr = 30, pt = 24, pb = 30;
    var plotW = W - pl - pr, plotH = H - pt - pb;
    var X1 = 1100;
    function xOf(v) { return pl + v / X1 * plotW; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var v = 0; v <= X1; v += 200) {
      var x = xOf(v);
      el('line', { x1: x, y1: pt - 6, x2: x, y2: pt + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, pt + plotH + 16, v + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }, svg);
    }
    txt(pl + plotW / 2, H - 3, '穿深（mm）', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    var rows = [
      { name: '① 厂商手册标称（混凝土靶）', a: 0, b: 1000, color: '#8a9298', note: '1000 mm · API RP 19B Section 1 基准', nb: 1000 },
      { name: '② 岩心靶等效（×0.55–0.65）', a: 550, b: 650, color: '#2f7d6b', note: '550–650 mm · 本案例库入库基准', nb: 650 },
      { name: '③ 原地有效（致密层再低 35–60%）', a: 220, b: 423, color: '#b05a51', note: '≈220–420 mm · Oil Authority / Thompson 口径', nb: 423 }
    ];
    rows.forEach(function (r, i) {
      var cy = pt + plotH * (i + 0.5) / rows.length;
      var bh = 20;
      el('rect', { 'data-row': i, x: xOf(r.a), y: cy - bh / 2, width: xOf(r.b) - xOf(r.a), height: bh, rx: 4, fill: r.color, opacity: 0.75, style: 'cursor:pointer' }, svg);
      txt(pl - 8, cy + 3.5, r.name, { 'font-size': 9.5, fill: '#2f3538', 'text-anchor': 'end' }, svg);
      txt(xOf(r.b) + 6, cy + 3.5, r.note, { 'font-size': 9, fill: '#79828a', 'font-family': 'Consolas, monospace' }, svg);
    });
    txt(pl + 2, 12, '同一发弹：三个口径下的「穿深」相差可达 4 倍——跨品牌比较必须统一基准', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  /* ---------- tooltip 绑定（通用：按 data-idx / data-row 命中） ---------- */
  function bindTip(svgId, tipId, boxId, labelFn) {
    var svg = document.getElementById(svgId), tip = document.getElementById(tipId), box = document.getElementById(boxId);
    if (!svg || !tip || !box) return;
    svg.addEventListener('mousemove', function (evt) {
      var t = evt.target;
      var idx = t.getAttribute && (t.getAttribute('data-idx') || t.getAttribute('data-row'));
      if (idx !== null && idx !== undefined && idx !== false) {
        tip.innerHTML = labelFn(+idx);
        var rb = box.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 250) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 84) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
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

  bindTabs();
  drawRealScatter(); fillRealTable();
  drawGrade(); drawWall(); drawConv();
  bindTip('lit-scatter', 'lit-tipA', 'lit-boxA', function (i) {
    var d = REAL[i];
    return '<b>' + d.gun + ' ' + d.name + '</b>（' + d.expl + ' ' + d.g.toFixed(1) + ' g）<br>' +
      '穿深 <b>' + d.pen.toFixed(1) + ' in</b>（' + Math.round(d.pen * 25.4) + ' mm）· 孔径 <b>' + d.eh.toFixed(2) + ' in</b>（' + (d.eh * 25.4).toFixed(1) + ' mm）<br>' +
      '靶强度 ' + d.psi + ' psi · ' + d.casing + ' · ' + d.fam;
  });
  bindTip('lit-grade', 'lit-tipB', 'lit-boxB', function (i) {
    var d = GRADES[i];
    return '<b>' + d.g + '</b>（API 5CT）<br>屈服 <b>' + d.yMin + '–' + d.yMax + ' MPa</b><br>最小抗拉 <b>' + d.ts + ' MPa</b>';
  });
  bindTip('lit-wall', 'lit-tipC', 'lit-boxC', function (i) {
    var d = WALLS[i];
    return '5½″ <b>' + d.ppf + '</b> 套管<br>壁厚 <b>' + d.mm.toFixed(2) + ' mm</b>（' + d.inch.toFixed(3) + ' in）';
  });
  bindTip('lit-conv', 'lit-tipD', 'lit-boxD', function (i) {
    var msgs = [
      '厂商手册标称穿深（API RP 19B 混凝土靶）：<b>1000 mm</b>。各品牌基准不同，直接横向比较会虚高 40% 以上。',
      '岩心靶等效：<b>550–650 mm</b>（混凝土靶 ×0.55–0.65，按弹型类别标定）——本案例库入库统一基准。',
      '原地有效穿深（致密层高应力地层）：约 <b>220–420 mm</b>，较岩心靶再低 35–60%（Oil Authority 术语库；Thompson 1962 强度校正）。'
    ];
    return msgs[i];
  });
})();
