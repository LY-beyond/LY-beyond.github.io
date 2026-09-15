// =========================================================
// graph.js —— 课程知识图谱引擎（中英共用一份，界面文案走 T 表）
// ---------------------------------------------------------
// 力导向布局用 **d3-force**（本地内置，见 vendor/d3-force.min.js），
// 渲染 / 交互 / 无障碍 / 导出仍是自己写的：
//   · 用 d3-force 的理由：速度 Verlet 积分、quadtree 多体算法（O(n log n)）、
//     collide 防重叠、alpha 衰减——都是自己写容易做糙的地方，且它是业界标准库。
//   · 渲染保持手写 SVG：颜色写成「表现属性」→ 暗色自动跟随 + 导出 PNG 不掉色；
//     节点可 Tab 聚焦、可被读屏，对比度可测（canvas 方案这些都做不到）。
//
// 依赖：vendor/ 下的 4 个 UMD 文件（d3-quadtree / d3-dispatch / d3-timer / d3-force，共 17 KB），
//       必须是本地文件而不是 CDN —— 否则断网或 file:// 打开就废了。
//
// 流程：window.KG_DATA → 视图（root/各章/运行期合并的 full）
//       → d3-force 松弛（确定性）→ SVG 渲染 → 交互（悬停/拖拽/缩放/钻取）
//
// 刻意用「普通 script」而非 ES Module：file:// 双击打开也能用（同 quiz.js）。
// =========================================================
(function () {
  'use strict';

  var root = document.getElementById('kg-root');
  if (!root) return;     // 本页没有图谱容器 → 直接退出（章节页不会加载它）

  /* =======================================================
   * 一、界面文案（默认中文；en/graph-ui.js 用 window.KG_UI 覆盖）
   *    {xxx} 是占位符，由 t() 替换
   * ===================================================== */
  var T = {
    ariaStage: '课程知识图谱交互区',
    ariaGraph: '课程知识图谱：节点代表篇章、章节或知识点，连线代表包含、前置或用于案例的关系',
    btnBack: '← 返回',
    btnRoot: '⌂ 总览',
    btnFull: '🗺 全图',
    btnZoomIn: '放大',
    btnZoomOut: '缩小',
    btnFit: '适应窗口',
    btnExport: '⬇ 导出 PNG',
    btnModeGraph: '🕸 图形',
    btnModeList: '☰ 列表',
    stats: '{nodes} 个节点 · {links} 条关系',
    legend: '关系图例',
    hint: '悬停看邻接关系 · 单击选中 · 双击（或选中后点「展开子图」）钻入下一层 · 滚轮缩放 · 空白处拖拽平移',
    detailEmpty: '点击图中任意节点，这里会显示它的说明与关联。',
    relationIn: '被这些节点指向',
    relationOut: '指向这些节点',
    noRelation: '暂无关联',
    btnOpen: '进入章节',
    btnDrill: '展开子图',
    btnNoOpen: '此节点无对应页面',
    listHead: '当前视图的节点清单（可直接跳转）',
    listHint: '列表视图便于键盘浏览与读屏，也是手机上的高效入口。',
    fullTitle: '完整图谱',
    dataError: '图谱数据加载失败：请确认 graph-data.js 已在本页面加载。',
    d3Error: 'd3-force 未加载：请确认 vendor/ 下的 d3-quadtree / d3-dispatch / d3-timer / d3-force 四个文件已按顺序引入。',
    exported: '已导出 PNG',
    exportFailed: '导出失败，请改用截图工具',
    a11yPicked: '已选中 {name}，{rel} 条关联',
    a11yView: '当前视图：{title}，{nodes} 个节点',
    a11yDrill: '已展开「{name}」的子图',
  };
  var UI = (window.KG_UI && typeof window.KG_UI === 'object') ? window.KG_UI : {};

  function t(key, vars) {
    var s = (typeof UI[key] === 'string' && UI[key]) ? UI[key] : (T[key] || key);
    if (vars) {
      Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    }
    return s;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* =======================================================
   * 二、数据与视图
   * ===================================================== */
  var DATA = window.KG_DATA;
  if (!DATA || !DATA.views) {
    root.innerHTML = '<p class="kg-error">' + esc(t('dataError')) + '</p>';
    return;
  }

  /* d3-force 必须已经加载（vendor/ 下四个文件，顺序：quadtree → dispatch → timer → force） */
  if (!window.d3 || typeof window.d3.forceSimulation !== 'function') {
    root.innerHTML = '<p class="kg-error">' + esc(t('d3Error')) + '</p>';
    return;
  }

  var VIEWS = {};
  Object.keys(DATA.views).forEach(function (id) { VIEWS[id] = DATA.views[id]; });

  /* 「完整图谱」视图在运行时由各视图合并而来：节点/边按 id 去重，
     这样不必手工维护第三份数据，也就不会出现三份数据互相不一致。 */
  (function buildFull() {
    var nodes = [], links = [], seenN = {}, seenL = {};
    Object.keys(DATA.views).forEach(function (id) {
      DATA.views[id].nodes.forEach(function (n) {
        if (seenN[n.id]) return;
        seenN[n.id] = 1;
        nodes.push(n);
      });
      DATA.views[id].links.forEach(function (l) {
        var key = l.from + '|' + l.to + '|' + l.rel;
        if (seenL[key]) return;
        seenL[key] = 1;
        links.push(l);
      });
    });
    VIEWS.full = {
      title: t('fullTitle'),
      path: [DATA.views[DATA.defaultView].path[0], t('fullTitle')],
      nodes: nodes,
      links: links,
    };
  }());

  var CAT = {};
  DATA.categories.forEach(function (c) { CAT[c.id] = c; });
  var REL = {};
  DATA.relations.forEach(function (r) { REL[r.id] = r; });

  /* =======================================================
   * 三、颜色：一律从 tokens.css 的设计令牌读
   * ===================================================== */
  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function tokens() {
    return {
      text: token('--c-text', '#111827'),
      soft: token('--c-text-soft', '#4b5563'),
      muted: token('--c-muted', '#9ca3af'),
      line: token('--c-border', '#d1d5db'),
      surface: token('--c-surface', '#ffffff'),
      surface2: token('--c-surface-2', '#f3f4f6'),
    };
  }
  var CAT_TOKEN = { part: '--c-primary', chapter: '--c-info', section: '--c-accent', step: '--c-primary', lab: '--c-accent' };
  function catColor(cat) {
    var meta = CAT[cat] || {};
    var fromData = meta.color ? '--' + meta.color : '';
    var name = /^--c-/.test(fromData) ? fromData : (CAT_TOKEN[cat] || '--c-info');
    return token(name, '#64748b');
  }
  var REL_TOKEN = { 'part-of': '--c-border', prereq: '--c-info', 'used-in': '--c-accent' };
  function relColor(rel) {
    return token(REL_TOKEN[rel] || '--c-border', '#cbd5e1');
  }
  function relDash(rel) {
    var style = (REL[rel] || {}).style;
    return style === 'dashed' ? '7 5' : style === 'dotted' ? '2 5' : '';
  }

  /* 画布坐标系：viewBox 尺寸（实际显示尺寸由 CSS 决定）。
     声明在前——界面骨架里要立刻用到它。 */
  var W = 960, H = 560;

  /* =======================================================
   * 四、界面骨架（运行时生成 → 中英两版结构天然一致，门户 HTML 里只放一个容器）
   * ===================================================== */
  var state = {
    viewId: DATA.defaultView,
    sel: null,      // 选中节点 id
    hist: [],       // 钻取历史
    k: 1, tx: 0, ty: 0,
    mode: 'graph',
    pos: null,
    drag: null,
    pan: null,
    sim: null,        // d3-force 模拟实例（拖动松手后重新平衡用）
    simNodes: null,   // 模拟里的节点（带 x/y/vx/vy/fx/fy）
  };

  root.className = 'kg';
  root.innerHTML =
    '<div class="kg-toolbar">' +
      '<nav class="kg-crumbs" id="kg-crumbs" aria-label="' + esc(t('ariaStage')) + '"></nav>' +
      '<div class="kg-actions" role="group">' +
        '<button type="button" class="kg-btn" data-kg="back">' + esc(t('btnBack')) + '</button>' +
        '<button type="button" class="kg-btn" data-kg="root">' + esc(t('btnRoot')) + '</button>' +
        '<button type="button" class="kg-btn" data-kg="full">' + esc(t('btnFull')) + '</button>' +
        '<span class="kg-gap" aria-hidden="true"></span>' +
        '<button type="button" class="kg-btn kg-btn--icon" data-kg="zoom-out" aria-label="' + esc(t('btnZoomOut')) + '">－</button>' +
        '<button type="button" class="kg-btn kg-btn--icon" data-kg="zoom-in" aria-label="' + esc(t('btnZoomIn')) + '">＋</button>' +
        '<button type="button" class="kg-btn" data-kg="fit">' + esc(t('btnFit')) + '</button>' +
        '<button type="button" class="kg-btn" data-kg="export">' + esc(t('btnExport')) + '</button>' +
        '<button type="button" class="kg-btn" data-kg="mode" aria-pressed="false">' + esc(t('btnModeList')) + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="kg-body">' +
      '<div class="kg-stage" id="kg-stage">' +
        '<svg id="kg-svg" class="kg-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('ariaGraph')) + '"></svg>' +
        '<div class="kg-list" id="kg-list" hidden></div>' +
        '<p class="kg-stats" id="kg-stats"></p>' +
      '</div>' +
      '<aside class="kg-side">' +
        '<div class="kg-legend" id="kg-legend"></div>' +
        '<div class="kg-detail" id="kg-detail"></div>' +
      '</aside>' +
    '</div>' +
    '<p class="kg-hint">' + esc(t('hint')) + '</p>' +
    '<p class="kg-live" id="kg-live" role="status" aria-live="polite"></p>';

  var el = {
    svg: document.getElementById('kg-svg'),
    world: null,
    stage: document.getElementById('kg-stage'),
    crumbs: document.getElementById('kg-crumbs'),
    stats: document.getElementById('kg-stats'),
    legend: document.getElementById('kg-legend'),
    detail: document.getElementById('kg-detail'),
    list: document.getElementById('kg-list'),
    live: document.getElementById('kg-live'),
  };

  function announce(msg) { el.live.textContent = msg; }

  /* 节点查询：视图内按 id 找节点 / 找与某节点相连的边 */
  function nodeOf(view, id) {
    for (var i = 0; i < view.nodes.length; i++) if (view.nodes[i].id === id) return view.nodes[i];
    return null;
  }
  function edgesOf(view, id) {
    return view.links.filter(function (l) { return l.from === id || l.to === id; });
  }
  function neighborIds(view, id) {
    var set = {};
    set[id] = 1;
    edgesOf(view, id).forEach(function (l) { set[l.from] = 1; set[l.to] = 1; });
    return set;
  }

  /* 面包屑 */
  function renderCrumbs(view) {
    var parts = (view.path || [view.title]).map(function (p) { return esc(p); });
    el.crumbs.innerHTML = parts.map(function (p, i) {
      return (i ? '<span class="kg-crumb-sep" aria-hidden="true">/</span>' : '') +
        '<span class="kg-crumb">' + p + '</span>';
    }).join('') + '<span class="kg-crumb-sep" aria-hidden="true">/</span><span class="kg-crumb kg-crumb--cur">' + esc(view.title) + '</span>';
  }

  /* 统计 + 图例（图例讲清三种关系的线型与颜色） */
  function renderMeta(view) {
    el.stats.textContent = t('stats', { nodes: view.nodes.length, links: view.links.length });
    el.legend.innerHTML = '<span class="kg-legend-title">' + esc(t('legend')) + '</span>' +
      DATA.relations.map(function (r) {
        var dash = relDash(r.id);
        return '<span class="kg-legend-item">' +
          '<svg viewBox="0 0 34 10" aria-hidden="true" focusable="false"><line x1="1" y1="5" x2="33" y2="5" ' +
          'stroke="' + esc(relColor(r.id)) + '" stroke-width="2"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>' +
          esc(r.label) + '</span>';
      }).join('');
  }

  /* 列表视图：图形之外的等价入口（键盘/读屏/手机都更顺手） */
  function renderList(view) {
    el.list.innerHTML = '<p class="kg-list-head">' + esc(t('listHead')) + '</p>' +
      '<p class="kg-list-hint">' + esc(t('listHint')) + '</p>' +
      '<div class="kg-list-items">' + view.nodes.map(function (n) {
        var cat = (CAT[n.cat] || {}).label || n.cat;
        var inner = '<span class="kg-list-dot" style="background:' + esc(catColor(n.cat)) + '"></span>' +
          '<span class="kg-list-name">' + esc(n.name) + '</span>' +
          '<span class="kg-list-cat">' + esc(cat) + '</span>' +
          '<span class="kg-list-rel">' + t('stats', { nodes: 1, links: edgesOf(view, n.id).length }).replace(/^\S+\s*·\s*/, '') + '</span>';
        return n.route
          ? '<a class="kg-list-item" href="' + esc(n.route) + '">' + inner + '</a>'
          : '<button type="button" class="kg-list-item" data-kg-list="' + esc(n.id) + '">' + inner + '</button>';
      }).join('') + '</div>';
  }

  /* =======================================================
   * 五、力导向布局（确定性：同一视图每次打开位置都一样）
   *   ①固定种子把节点撒在圆环上 ②跑若干轮斥力+弹簧+向心 ③归一化到画布内
   *   节点规模 ≤ 60，O(n²) 足够，不需要 Barnes-Hut。
   *   确定性带来两个好处：刷新不"跳"，截图/回归测试可复现。
   * ===================================================== */

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* d3-force 的参数（改这里就能调整图的"松紧"） */
  var SIM = {
    linkDistance: { 'part-of': 104, other: 172 },   // 结构边短一些、跨关系边长一些
    linkStrength: { 'part-of': 0.95, other: 0.32 },
    chargeBase: -330,          // 多体斥力基数
    chargePerRadius: -7,       // 节点越大推得越远
    chargeMax: 660,            // 超出这个距离不再互相推（够近才互斥，避免整图被撑散）
    /* 画布是宽的（960×560），所以让 y 方向收得更紧、x 方向更松，
       把图形压成"宽椭圆"去适配画布形状 —— 否则圆形的图只能撑满高度，
       归一化缩放被迫变小，标签字号也跟着变小。 */
    pullX: 0.022,
    pullY: 0.085,
    collidePadding: 9,         // 防重叠：半径 + 这个值
    labelCap: 44,              // 标签参与防重叠时的上限（防止把图撑得太散）
    labelBand: 132,            // 归一化时右侧给标签留的一条空白带
    labelFontSize: 13,         // 与 renderSvg 里的标签字号一致
    ticks: 320,                // 常规视图松弛轮数
    ticksLarge: 460,           // 全图（> 40 节点）多跑几轮
    settleTicks: 70,           // 拖动松手后重新平衡的轮数
  };

  function nodeRadius(n, view) {
    var deg = view.links.filter(function (l) { return l.from === n.id || l.to === n.id; }).length;
    var base = { part: 30, chapter: 26, section: 17, step: 17, lab: 19 }[n.cat] || 17;
    if (view.nodes.length > 40) base *= 0.55;      // 全图模式整体缩小
    return Math.round(base + Math.min(deg, 8) * 1.6);
  }

  /* 估算标签半宽：中日韩字符约 1 em，拉丁字符约 0.55 em。
     用于让 d3-force 的 collide 也给"标签"留出位置（否则标签会压住相邻节点）。 */
  function labelWidthOf(name) {
    var w = 0;
    for (var i = 0; i < name.length; i++) {
      w += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(name[i])
        ? SIM.labelFontSize * 1.02
        : SIM.labelFontSize * 0.56;
    }
    return Math.min(w, 230);
  }
  function labelHalfWidth(name) {
    return Math.min(labelWidthOf(name) / 2, SIM.labelCap);
  }

  /* =======================================================
   * 六、渲染：把当前视图画成 SVG
   *   样式全部写成「表现属性」（fill/stroke/opacity/…）而不是 CSS 类 ——
   *   这样导出 PNG 时序列化出来的 SVG 不会掉色（外部 CSS 不会被序列化）。
   * ===================================================== */
  function r1(v) { return Math.round(v * 10) / 10; }

  function worldTransform() {
    return 'translate(' + r1(state.tx) + ',' + r1(state.ty) + ') scale(' + (Math.round(state.k * 1000) / 1000) + ')';
  }

  function renderSvg(view) {
    var pos = state.pos;
    var tk = tokens();
    var isFull = view.nodes.length > 40;      // 全图模式：小节点 + 默认隐藏标签
    var sel = state.sel;
    var fs = Math.max(11, Math.min(14, 13 * (state.fitK || 1)));   // 字号跟随归一化缩放
    var out = ['<g id="kg-world" transform="' + worldTransform() + '">'];

    /* ① 边（先画，压在节点下面） */
    view.links.forEach(function (l, i) {
      var a = pos[l.from], b = pos[l.to];
      if (!a || !b) return;
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var gap = l.rel === 'part-of' ? 2 : 6;
      var x1 = a.x + (dx / d) * (a.r + 2), y1 = a.y + (dy / d) * (a.r + 2);
      var x2 = b.x - (dx / d) * (b.r + gap), y2 = b.y - (dy / d) * (b.r + gap);
      var dash = relDash(l.rel);
      out.push('<line data-kg-edge="' + i + '" data-rel="' + esc(l.rel) + '" data-from="' + esc(l.from) + '" data-to="' + esc(l.to) + '"' +
        ' x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '"' +
        ' stroke="' + esc(relColor(l.rel)) + '" stroke-width="' + (isFull ? 1.1 : 1.6) + '"' +
        ' stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') +
        ' opacity="' + (isFull ? 0.45 : 0.7) + '"/>');
    });

    /* ② 节点 */
    view.nodes.forEach(function (n) {
      var p = pos[n.id];
      if (!p) return;
      var c = catColor(n.cat);
      var isSel = n.id === sel;
      var deg = edgesOf(view, n.id).length;
      var catLabel = (CAT[n.cat] || {}).label || n.cat;
      var showLabel = !isFull || isSel;
      out.push('<g class="kg-node' + (isSel ? ' is-sel' : '') + '" data-kg-node="' + esc(n.id) + '"' +
        ' tabindex="0" role="button"' +
        ' aria-label="' + esc(n.name + '（' + catLabel + '，' + deg + ' 条关联）') + '">');
      /* 带子图的节点套一圈虚线环，暗示"可以展开" */
      if (n.drillTo) {
        out.push('<circle cx="' + r1(p.x) + '" cy="' + r1(p.y) + '" r="' + r1(p.r + 6) + '" fill="none"' +
          ' stroke="' + esc(c) + '" stroke-width="1.4" stroke-dasharray="3 3" opacity="0.8"/>');
      }
      out.push('<circle cx="' + r1(p.x) + '" cy="' + r1(p.y) + '" r="' + r1(p.r) + '" fill="' + esc(c) + '"' +
        ' fill-opacity="0.92" stroke="' + esc(tk.surface) + '" stroke-width="' + (isSel ? 4 : 2) + '"/>');
      if (showLabel) {
        out.push('<text x="' + r1(p.x + p.r + fs * 0.6) + '" y="' + r1(p.y + fs * 0.35) + '"' +
          ' font-size="' + r1(isSel ? fs * 1.12 : fs) + '" font-weight="' + (isSel ? 700 : 600) + '"' +
          ' fill="' + esc(isSel ? tk.text : tk.soft) + '">' + esc(n.name) + '</text>');
      }
      out.push('</g>');
    });

    out.push('</g>');
    el.svg.innerHTML = out.join('');
    applyDim(sel);
  }

  /* 邻接高亮：给定节点，淡出与它无关的节点与边
     （这就是"力导向图别变成一团毛线球"的关键手法） */
  function applyDim(activeId) {
    var view = VIEWS[state.viewId];
    var isFull = view.nodes.length > 40;
    var near = activeId ? neighborIds(view, activeId) : null;

    Array.prototype.forEach.call(el.svg.querySelectorAll('[data-kg-node]'), function (g) {
      var id = g.getAttribute('data-kg-node');
      g.setAttribute('opacity', (!near || near[id]) ? '1' : '0.22');
    });
    Array.prototype.forEach.call(el.svg.querySelectorAll('[data-kg-edge]'), function (ln) {
      var a = ln.getAttribute('data-from'), b = ln.getAttribute('data-to');
      var on = !near || (near[a] && near[b]);
      ln.setAttribute('opacity', on ? (isFull ? '0.45' : '0.7') : '0.1');
      ln.setAttribute('stroke-width', on ? (isFull ? 1.1 : 1.6) : '1');
    });
  }

  /* 详情面板：说明 + 双向关联（可点着走过去）+ 动作按钮 */
  function renderDetail(view) {
    var node = state.sel ? nodeOf(view, state.sel) : null;
    if (!node) {
      el.detail.innerHTML = '<p class="kg-detail-empty">' + esc(t('detailEmpty')) + '</p>';
      return;
    }
    var catLabel = (CAT[node.cat] || {}).label || node.cat;

    function rows(list, dir) {
      return list.map(function (l) {
        var other = nodeOf(view, dir === 'out' ? l.to : l.from);
        if (!other) return '';
        var rel = (REL[l.rel] || {}).label || l.rel;
        return '<button type="button" class="kg-rel" data-kg-pick="' + esc(other.id) + '">' +
          '<span class="kg-rel-dot" style="background:' + esc(catColor(other.cat)) + '"></span>' +
          '<span class="kg-rel-name">' + esc(other.name) + '</span>' +
          '<span class="kg-rel-tag">' + esc(rel) + (l.note ? ' ' + esc(l.note) : '') + '</span>' +
          '</button>';
      }).join('');
    }

    var outList = view.links.filter(function (l) { return l.from === node.id; });
    var inList = view.links.filter(function (l) { return l.to === node.id; });

    el.detail.innerHTML =
      '<span class="kg-badge" style="--kg-c:' + esc(catColor(node.cat)) + '">' + esc(catLabel) + '</span>' +
      '<h3 class="kg-detail-title">' + esc(node.name) + '</h3>' +
      (node.desc ? '<p class="kg-detail-desc">' + esc(node.desc) + '</p>' : '') +
      (outList.length ? '<p class="kg-detail-sub">' + esc(t('relationOut')) + '</p><div class="kg-rels">' + rows(outList, 'out') + '</div>' : '') +
      (inList.length ? '<p class="kg-detail-sub">' + esc(t('relationIn')) + '</p><div class="kg-rels">' + rows(inList, 'in') + '</div>' : '') +
      (!outList.length && !inList.length ? '<p class="kg-detail-sub">' + esc(t('noRelation')) + '</p>' : '') +
      '<div class="kg-detail-actions">' +
        (node.route
          ? '<a class="kg-btn kg-btn--primary" href="' + esc(node.route) + '">' + esc(t('btnOpen')) + '</a>'
          : '<span class="kg-btn kg-btn--flat">' + esc(t('btnNoOpen')) + '</span>') +
        (node.drillTo ? '<button type="button" class="kg-btn" data-kg="drill">' + esc(t('btnDrill')) + '</button>' : '') +
        '<button type="button" class="kg-btn" data-kg="full">' + esc(t('btnFull')) + '</button>' +
      '</div>';
  }

  function renderAll() {
    var view = VIEWS[state.viewId];
    renderCrumbs(view);
    renderMeta(view);
    renderSvg(view);
    renderDetail(view);
    renderList(view);
    el.svg.hidden = state.mode !== 'graph';
    el.list.hidden = state.mode !== 'list';
    var modeBtn = root.querySelector('[data-kg="mode"]');
    if (modeBtn) {
      modeBtn.textContent = state.mode === 'graph' ? t('btnModeList') : t('btnModeGraph');
      modeBtn.setAttribute('aria-pressed', state.mode === 'list' ? 'true' : 'false');
    }
  }

  /* =======================================================
   * 七、视图切换 / 选中 / 缩放平移
   * ===================================================== */
  function showView(id, selId) {
    if (!VIEWS[id]) return;
    state.viewId = id;
    state.sel = selId || null;
    state.pos = layout(VIEWS[id]);   // 确定性布局：同一视图每次位置一致
    state.k = 1; state.tx = 0; state.ty = 0;
    renderAll();
    announce(t('a11yView', { title: VIEWS[id].title, nodes: VIEWS[id].nodes.length }));
  }

  function drillInto(id, fromNodeId) {
    if (!VIEWS[id]) return;
    state.hist.push(state.viewId);
    showView(id, null);
    var n = fromNodeId ? nodeOf(VIEWS[id], fromNodeId) : null;
    announce(t('a11yDrill', { name: n ? n.name : id }));
  }

  function goBack() {
    var prev = state.hist.pop();
    if (prev) showView(prev, null);
  }

  function goRoot() {
    state.hist = [];
    showView(DATA.defaultView, null);
  }

  /* 选中：重画（选中环 / 标签加粗）并刷新详情面板。
     重画会替换 DOM，所以键盘用户要把焦点还给同一个节点，否则焦点会丢。 */
  function selectNode(id) {
    var view = VIEWS[state.viewId];
    var hadFocus = document.activeElement && document.activeElement.closest &&
      document.activeElement.closest('[data-kg-node]');
    state.sel = id || null;
    renderSvg(view);
    renderDetail(view);
    if (hadFocus && id) {
      var again = el.svg.querySelector('[data-kg-node="' + id + '"]');
      if (again) again.focus();
    }
    if (id) {
      var n = nodeOf(view, id);
      if (n) announce(t('a11yPicked', { name: n.name, rel: edgesOf(view, id).length }));
    }
  }

  /* 缩放/平移只改 <g transform>，不重画 DOM —— 拖拽时才不会卡 */
  function applyTransform() {
    var w = el.svg.querySelector('#kg-world');
    if (w) w.setAttribute('transform', worldTransform());
  }

  function clampK(k) { return Math.min(Math.max(k, 0.4), 3); }

  function zoomBy(factor, cx, cy) {
    var k2 = clampK(state.k * factor);
    var ratio = k2 / state.k;
    state.tx = cx - (cx - state.tx) * ratio;
    state.ty = cy - (cy - state.ty) * ratio;
    state.k = k2;
    applyTransform();
  }

  /* 客户端坐标 → viewBox 坐标（CSS 里用 aspect-ratio 锁定了两者同比例） */
  function toSvgCoords(clientX, clientY) {
    var r = el.svg.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H };
  }

  /* 适应窗口：重跑一次布局并复位缩放（等于"恢复原状"） */
  function fitView() {
    state.pos = layout(VIEWS[state.viewId]);
    state.k = 1; state.tx = 0; state.ty = 0;
    renderSvg(VIEWS[state.viewId]);
  }

  /* =======================================================
   * 八、交互
   * ===================================================== */
  var hoverId = null;

  /* 从事件目标往上找节点（手写遍历，SVG 里比 closest 更稳） */
  function nodeIdFrom(ev) {
    var n = ev.target;
    while (n && n !== el.svg) {
      if (n.getAttribute && n.getAttribute('data-kg-node')) return n.getAttribute('data-kg-node');
      n = n.parentNode;
    }
    return null;
  }

  function toWorldCoords(clientX, clientY) {
    var p = toSvgCoords(clientX, clientY);
    return { x: (p.x - state.tx) / state.k, y: (p.y - state.ty) / state.k };
  }

  function simNodeOf(id) {
    var list = state.simNodes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 拖动一个节点：更新它自己 + 相连的边（不重画整张图），
     同时把位置同步回 d3-force 的节点（fx/fy 钉住，松手后才放开重新平衡） */
  function moveNode(id, x, y) {
    var p = state.pos[id];
    if (!p) return;
    p.x = x; p.y = y;

    var sn = simNodeOf(id);
    if (sn) { sn.fx = x; sn.fy = y; sn.x = x; sn.y = y; }

    var g = el.svg.querySelector('[data-kg-node="' + id + '"]');
    if (g) {
      Array.prototype.forEach.call(g.querySelectorAll('circle'), function (c) {
        c.setAttribute('cx', r1(x)); c.setAttribute('cy', r1(y));
      });
      var txt = g.querySelector('text');
      if (txt) {
        var fs2 = parseFloat(txt.getAttribute('font-size')) || 13;
        txt.setAttribute('x', r1(x + p.r + fs2 * 0.6));
        txt.setAttribute('y', r1(y + fs2 * 0.35));
      }
    }
    Array.prototype.forEach.call(el.svg.querySelectorAll('[data-kg-edge]'), function (ln) {
      var a = ln.getAttribute('data-from'), b = ln.getAttribute('data-to');
      if (a !== id && b !== id) return;
      var pa = state.pos[a], pb = state.pos[b];
      if (!pa || !pb) return;
      var gap = ln.getAttribute('data-rel') === 'part-of' ? 2 : 6;
      var dx = pb.x - pa.x, dy = pb.y - pa.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      ln.setAttribute('x1', r1(pa.x + (dx / d) * (pa.r + 2)));
      ln.setAttribute('y1', r1(pa.y + (dy / d) * (pa.r + 2)));
      ln.setAttribute('x2', r1(pb.x - (dx / d) * (pb.r + gap)));
      ln.setAttribute('y2', r1(pb.y - (dy / d) * (pb.r + gap)));
    });
  }

  function bindEvents() {
    /* --- 指针：拖节点 / 拖空白平移 --- */
    el.svg.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var id = nodeIdFrom(ev);
      if (id) {
        var w = toWorldCoords(ev.clientX, ev.clientY);
        var p = state.pos[id];
        state.drag = { id: id, dx: p.x - w.x, dy: p.y - w.y };
      } else {
        state.drag = { pan: true, sx: ev.clientX, sy: ev.clientY, ox: state.tx, oy: state.ty };
        el.svg.classList.add('is-panning');
      }
      if (el.svg.setPointerCapture) { try { el.svg.setPointerCapture(ev.pointerId); } catch (e) {} }
    });

    el.svg.addEventListener('pointermove', function (ev) {
      if (!state.drag) {
        var id0 = nodeIdFrom(ev);
        if (id0 !== hoverId) { hoverId = id0; applyDim(id0 || state.sel); }
        return;
      }
      if (state.drag.pan) {
        state.tx = state.drag.ox + (ev.clientX - state.drag.sx);
        state.ty = state.drag.oy + (ev.clientY - state.drag.sy);
        applyTransform();
      } else {
        var w = toWorldCoords(ev.clientX, ev.clientY);
        moveNode(state.drag.id, w.x + state.drag.dx, w.y + state.drag.dy);
      }
    });

    var endDrag = function () {
      var draggedNode = state.drag && state.drag.id;
      if (state.drag && state.drag.pan) el.svg.classList.remove('is-panning');
      state.drag = null;
      if (draggedNode) settle();     // 松手后让 d3-force 重新平衡（邻居自动让开）
    };
    el.svg.addEventListener('pointerup', endDrag);
    el.svg.addEventListener('pointercancel', endDrag);
    el.svg.addEventListener('pointerleave', function () {
      hoverId = null;
      if (!state.drag) applyDim(state.sel);
    });

    /* --- 点击选中 / 双击钻取 --- */
    el.svg.addEventListener('click', function (ev) {
      selectNode(nodeIdFrom(ev));
    });
    el.svg.addEventListener('dblclick', function (ev) {
      var id = nodeIdFrom(ev);
      var n = id ? nodeOf(VIEWS[state.viewId], id) : null;
      if (n && n.drillTo) drillInto(n.drillTo, n.id);
    });

    /* --- 滚轮缩放（以指针为中心） --- */
    el.svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var p = toSvgCoords(ev.clientX, ev.clientY);
      zoomBy(ev.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    }, { passive: false });

    /* --- 键盘：节点上回车/空格选中；图上 Esc 取消、← 返回 --- */
    el.svg.addEventListener('keydown', function (ev) {
      var id = nodeIdFrom(ev);
      if (id && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        selectNode(id);
        return;
      }
      if (ev.key === 'Escape') { selectNode(null); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); goBack(); }
    });
  }

  /* 工具栏与「关联跳转」统一委托到 #kg-root（只挂一个监听） */
  function bindToolbar() {
    root.addEventListener('click', function (ev) {
      var target = ev.target;
      var btn = (target && target.closest) ? target.closest('[data-kg]') : null;
      if (btn) {
        var act = btn.getAttribute('data-kg');
        if (act === 'back') { goBack(); return; }
        if (act === 'root') { goRoot(); return; }
        if (act === 'full') {
          if (state.viewId !== 'full') { state.hist.push(state.viewId); showView('full', null); }
          return;
        }
        if (act === 'zoom-in') { zoomBy(1.2, W / 2, H / 2); return; }
        if (act === 'zoom-out') { zoomBy(1 / 1.2, W / 2, H / 2); return; }
        if (act === 'fit') { fitView(); return; }
        if (act === 'export') { exportPng(); return; }
        if (act === 'drill') {
          var n = state.sel ? nodeOf(VIEWS[state.viewId], state.sel) : null;
          if (n && n.drillTo) drillInto(n.drillTo, n.id);
          return;
        }
        if (act === 'mode') {
          state.mode = state.mode === 'graph' ? 'list' : 'graph';
          renderAll();
          return;
        }
      }
      var pick = (target && target.closest) ? target.closest('[data-kg-pick]') : null;
      if (pick) { selectNode(pick.getAttribute('data-kg-pick')); return; }

      var listPick = (target && target.closest) ? target.closest('[data-kg-list]') : null;
      if (listPick) {
        state.mode = 'graph';
        renderAll();
        selectNode(listPick.getAttribute('data-kg-list'));
      }
    });
  }

  /* 导出 PNG：序列化当前 SVG → canvas → 下载
     因为所有样式都写成了表现属性，序列化出来不会掉色；
     导出前把平移缩放复位，保证导出的是"适应画布"的整图。 */
  function exportPng() {
    try {
      var clone = el.svg.cloneNode(true);
      var world = clone.querySelector('#kg-world');
      if (world) world.setAttribute('transform', 'translate(0,0) scale(1)');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', W);
      clone.setAttribute('height', H);
      clone.setAttribute('font-family', getComputedStyle(root).fontFamily);

      var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', W);
      bg.setAttribute('height', H);
      bg.setAttribute('fill', tokens().surface);
      clone.insertBefore(bg, clone.firstChild);

      var svgText = new XMLSerializer().serializeToString(clone);
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = W * 2;
        cv.height = H * 2;
        var ctx = cv.getContext('2d');
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, W, H);
        cv.toBlob(function (blob) {
          if (!blob) { announce(t('exportFailed')); return; }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'knowledge-graph-' + state.viewId + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
          announce(t('exported'));
        });
      };
      img.onerror = function () { announce(t('exportFailed')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    } catch (e) {
      announce(t('exportFailed'));
    }
  }

  /* 初始化块放在文件末尾 —— 原因见文末说明 */

  /* 用 d3-force 松弛布局，再把结果归一化到画布内。
     d3-force 只管物理、不管画布尺寸，所以"装进画布"这一步仍由我们兜底。 */
  function layout(view) {
    var nodes = view.nodes;
    var pos = {};
    var ids = nodes.map(function (n) { return n.id; });
    var rnd = prng(hash(view.title + '|' + ids.join(',')));
    var ringR = Math.min(W, H) * 0.34;

    /* ① 确定性初值：固定种子撒在圆环上（d3-force 在此基础上松弛）
          —— 这样"同一视图每次打开位置一致"，刷新不跳、截图可复现。 */
    var showLabels = nodes.length <= 40;      // 全图不显示标签，也就不必给标签留位
    var simNodes = nodes.map(function (n, i) {
      var ang = (i / nodes.length) * Math.PI * 2 + rnd() * 0.5;
      var r = nodeRadius(n, view);
      var x = W / 2 + Math.cos(ang) * ringR * (0.65 + rnd() * 0.5);
      var y = H / 2 + Math.sin(ang) * ringR * (0.65 + rnd() * 0.5);
      pos[n.id] = { x: x, y: y, r: r };
      return {
        id: n.id, r: r, x: x, y: y,
        labelHalf: showLabels ? labelHalfWidth(n.name) : 0,
      };
    });

    /* ② d3-force：连线弹簧 + 多体斥力（quadtree）+ 向心 + 防重叠 */
    var simLinks = view.links
      .filter(function (l) { return pos[l.from] && pos[l.to]; })
      .map(function (l) { return { source: l.from, target: l.to, rel: l.rel }; });

    var sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks)
        .id(function (d) { return d.id; })
        .distance(function (l) { return SIM.linkDistance[l.rel] || SIM.linkDistance.other; })
        .strength(function (l) { return SIM.linkStrength[l.rel] || SIM.linkStrength.other; }))
      .force('charge', d3.forceManyBody()
        .strength(function (d) { return SIM.chargeBase + d.r * SIM.chargePerRadius; })
        .distanceMax(SIM.chargeMax))
      .force('x', d3.forceX(W / 2).strength(SIM.pullX))
      .force('y', d3.forceY(H / 2).strength(SIM.pullY))
      .force('collide', d3.forceCollide()
        /* 半径 + 标签半宽：标签画在节点右侧，给它留出位置就不会压住别的节点 */
        .radius(function (d) { return d.r + SIM.collidePadding + d.labelHalf; })
        .iterations(2))
      .stop();   /* 手动 tick：不跑内部定时器，结果才是确定的 */

    var ticks = nodes.length > 40 ? SIM.ticksLarge : SIM.ticks;
    for (var t = 0; t < ticks; t++) sim.tick();
    simNodes.forEach(function (n) { pos[n.id].x = n.x; pos[n.id].y = n.y; });

    /* ③ 归一化到画布内 */
    fitIntoCanvas(view, pos);

    state.sim = sim;            // 拖动松手后还要用它重新平衡
    state.simNodes = simNodes;
    return pos;
  }

  /* 把布局结果等比缩放到画布内（右侧给标签留位）。
     注意：**位置、半径、字号都乘同一个 k** —— 单位统一之后，
     d3-force 里按标签宽度算出来的间距才是准的。 */
  function fitIntoCanvas(view, pos) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    view.nodes.forEach(function (n) {
      var p = pos[n.id];
      if (!p) return;
      var pad = n.drillTo ? 6 : 0;
      /* 右侧只预留一块"标签带"（不是每条标签的完整宽度）：
         图形本身接近圆形，宽画布左右两侧本来就有余量，标签正好落进去。
         若按最长标签全宽预留，会把整个图撑开、缩放变小、字号被压小。 */
      minX = Math.min(minX, p.x - p.r - pad);
      maxX = Math.max(maxX, p.x + p.r + pad + SIM.labelBand);
      minY = Math.min(minY, p.y - p.r - pad);
      maxY = Math.max(maxY, p.y + p.r + pad);
    });
    var spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
    var k = Math.min((W - 60) / spanX, (H - 60) / spanY, 1.5);
    view.nodes.forEach(function (n) {
      var p = pos[n.id];
      if (!p) return;
      p.x = 30 + (p.x - minX) * k;
      p.y = 30 + (p.y - minY) * k;
      p.r = Math.max(9, p.r * k);
    });
    state.fitK = k;          // renderSvg 用它缩放字号（保持一致）
    return k;
  }

  /* 拖动松手：解除钉住、给一点 alpha，再松弛若干轮 —— 邻居会自动让开
     （这是用 d3-force 换来的手感；纯手写布局做不到这么自然） */
  function settle() {
    var sim = state.sim;
    if (!sim || !state.simNodes) return;
    state.simNodes.forEach(function (n) { n.fx = null; n.fy = null; });
    sim.alpha(0.6);
    for (var t = 0; t < SIM.settleTicks; t++) sim.tick();
    state.simNodes.forEach(function (n) {
      var p = state.pos[n.id];
      if (p) { p.x = n.x; p.y = n.y; }
    });
    fitIntoCanvas(VIEWS[state.viewId], state.pos);
    renderSvg(VIEWS[state.viewId]);
  }

  /* =======================================================
   * 九、初始化
   * -------------------------------------------------------
   * 放在文件末尾是有意的：layout() 等函数定义在下面，
   * 这里一执行就会用到它们（函数声明会提升，但为了可读性仍放最后）。
   * ===================================================== */
  bindEvents();
  bindToolbar();
  showView(DATA.defaultView, null);

  /* 系统深浅色切换时重画：颜色是实时从 tokens.css 读的，直接重画即可 */
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onThemeChange = function () { renderAll(); };
    if (mq.addEventListener) mq.addEventListener('change', onThemeChange);
    else if (mq.addListener) mq.addListener(onThemeChange);
  }
}());

