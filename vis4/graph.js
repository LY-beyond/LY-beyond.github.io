// =========================================================
// graph.js —— 《可视化导论》课程知识图谱引擎（界面文案走 T 表）
// ---------------------------------------------------------
// 力导向布局用 **d3-force**（本地内置，见 vendor/d3-force.min.js），
// 渲染 / 交互 / 无障碍 / 导出仍是自己写的：
//   · d3-force 只负责物理：速度 Verlet 积分、quadtree 多体、collide 防重叠。
//   · 渲染保持手写 SVG：颜色写成「表现属性」→ 暗色自动跟随 + 导出 PNG 不掉色。
//
// 依赖：vendor/ 下的 4 个 UMD 文件（d3-quadtree / d3-dispatch / d3-timer / d3-force），
//       必须按此顺序加载，且是本地文件而不是 CDN —— 否则断网或 file:// 打开就废了。
//
// ⚠️ 刻意【不使用 requestAnimationFrame】：
//   d3-force 的 forceSimulation 默认会用内部计时器（基于 rAF）自动 tick。
//   本项目已实测「rAF 在无头浏览器 / 后台标签页里不触发」，会让图谱卡死或空白。
//   因此这里的做法是：
//     ① 构造 simulation 后立刻 .stop()，关掉内部计时器；
//     ② 首屏用同步循环跑固定次数 simulation.tick()，让布局一次性落定再渲染；
//     ③ 拖动后用 setTimeout（防抖）再跑几轮 tick 让邻接点跟随，同理不用 rAF。
//
// 刻意用「普通 script」而非 ES Module：file:// 双击打开也能用（同 progress.js）。
// =========================================================
(function () {
  'use strict';

  var root = document.getElementById('kg-root');
  if (!root) return;     // 本页没有图谱容器 → 直接退出

  /* =======================================================
   * 一、界面文案（默认中文；P8 的 en/graph-ui.js 用 window.KG_UI 覆盖）
   *    {xxx} 是占位符，由 t() 替换
   * ===================================================== */
  var T = {
    ariaStage: '课程知识图谱交互区',
    ariaGraph: '课程知识图谱：节点代表章节、小节、关键点、案例或数据集，连线代表包含、先修或使用关系',
    btnBack: '← 返回',
    btnOverview: '⌂ 总览',
    btnFull: '🗺 全图',
    btnZoomIn: '放大',
    btnZoomOut: '缩小',
    btnFit: '适应窗口',
    btnExport: '⬇ 导出 PNG',
    btnModeGraph: '🕸 图形',
    btnModeList: '☰ 表格',
    stats: '{nodes} 个节点 · {links} 条关系',
    legend: '关系图例',
    filterTitle: '按分类筛选',
    filterAll: '全部',
    hint: '按住节点可自由拖动（松手即停，位置会记住）· 悬停看邻接关系 · 滚轮缩放 · 空白处拖拽平移 · 单击节点不会跳转，请用右侧面板操作',
    listHead: '当前视图的节点清单',
    listHint: '表格视图便于键盘浏览与读屏，也是手机上的高效入口；节点单击不含跳转，统一由右侧面板按钮完成。',
    colNode: '节点',
    colCat: '分类',
    colDeg: '关联',
    colAct: '操作',
    fullTitle: '完整图谱',
    dataError: '图谱数据加载失败：请确认 graph-data.js 已在本页面加载。',
    d3Error: 'd3-force 未加载：请确认 vendor/ 下的 d3-quadtree / d3-dispatch / d3-timer / d3-force 四个文件已按顺序引入。',
    exported: '已导出 PNG',
    exportFailed: '导出失败，请改用截图工具',
    a11yView: '当前视图：{title}，{nodes} 个节点',
    detailHead: '节点详情',
    detailEmpty: '在下方表格里点「选中」，这里会显示该节点的关系与可用操作。',
    detailDeg: '关联 {n} 条',
    detailAnd: ' · ',
    btnDrill: '展开这个模块',
    btnGo: '去看这一节',
    btnClear: '取消选中',
    selBtn: '选中',
    selected: '已选中：{name}',
    listSelect: '选中',
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

  /* d3-force 必须已加载（vendor/ 下四个文件，顺序：quadtree → dispatch → timer → force） */
  if (!window.d3 || typeof window.d3.forceSimulation !== 'function') {
    root.innerHTML = '<p class="kg-error">' + esc(t('d3Error')) + '</p>';
    return;
  }

  var VIEWS = {};
  Object.keys(DATA.views).forEach(function (id) { VIEWS[id] = DATA.views[id]; });

  /* 「完整图谱」视图在运行时由各视图合并而来：节点 / 边按 id 去重，
     这样不必手工维护第三份数据，也就不会出现多份数据互相不一致。 */
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
    VIEWS.full = { title: t('fullTitle'), nodes: nodes, links: links };
  }());

  var CAT = {};
  DATA.categories.forEach(function (c) { CAT[c.id] = c; });
  var REL = {};
  DATA.relations.forEach(function (r) { REL[r.id] = r; });

  /* =======================================================
   * 三、颜色：一律从 tokens.css 的设计令牌读
   * ===================================================== */
  var _cs = null;
  function cs() {
    if (!_cs) _cs = getComputedStyle(document.documentElement);
    return _cs;
  }
  function token(name, fallback) {
    var v = cs().getPropertyValue(name).trim();
    return v || fallback;
  }
  function tokens() {
    return {
      text: token('--c-text', '#111827'),
      soft: token('--c-text-soft', '#525c72'),
      muted: token('--c-muted', '#8b93a7'),
      line: token('--c-border', '#e3e5ee'),
      bg: token('--c-bg', '#fbfbfd'),
      surface: token('--c-surface', '#ffffff'),
      surface2: token('--c-surface-2', '#f3f4f9'),
      primary: token('--c-primary', '#4338ca'),
    };
  }
  /* 分类 → 令牌（每个类别只解析一次，缓存进 palette） */
  var CAT_TOKEN = {
    part: '--c-primary', chapter: '--c-info', section: '--ch-3',
    key: '--c-accent', case: '--ch-4', dataset: '--ch-2', tool: '--ch-8',
  };
  var REL_TOKEN = { 'part-of': '--c-border-2', prereq: '--c-info', 'used-in': '--c-accent' };

  var paletteCache = null;
  function palette() {
    if (paletteCache) return paletteCache;
    var cats = {}, rels = {};
    DATA.categories.forEach(function (c) {
      cats[c.id] = token(CAT_TOKEN[c.id] || '--c-info', '#64748b');
    });
    DATA.relations.forEach(function (r) {
      rels[r.id] = token(REL_TOKEN[r.id] || '--c-border-2', '#cbd5e1');
    });
    paletteCache = { tk: tokens(), cats: cats, rels: rels };
    return paletteCache;
  }
  function catColor(cat) { return palette().cats[cat] || token('--c-info', '#64748b'); }
  function relColor(rel) { return palette().rels[rel] || token('--c-border-2', '#cbd5e1'); }
  function resetPalette() { paletteCache = null; _cs = null; }
  function relDash(rel) {
    var style = (REL[rel] || {}).style;
    return style === 'dashed' ? '7 5' : style === 'dotted' ? '2 5' : '';
  }
  function catName(cat) { return (CAT[cat] || {}).name || cat; }

  /* 画布坐标系：viewBox 尺寸（实际显示尺寸由 CSS 的 aspect-ratio 决定） */
  var W = 960, H = 560;

  /* =======================================================
   * 四、界面骨架（运行时生成 → 门户 HTML 里只放一个容器）
   * ===================================================== */
  var state = {
    viewId: DATA.defaultView,
    hist: [],
    k: 1, tx: 0, ty: 0,
    mode: 'graph',
    pos: null,
    drag: null,
    pan: null,
    hoverId: null,
    selId: null,
    filterCat: null,
    sim: null,
    simNodes: null,
    nodeEls: null,
    edgeEls: null,
    fitK: 1,
    settleTimer: null,
  };

  root.className = 'kg';
  root.innerHTML =
    '<div class="kg-toolbar">' +
      '<nav class="kg-crumbs" id="kg-crumbs" aria-label="' + esc(t('ariaStage')) + '"></nav>' +
      '<div class="kg-actions" role="group">' +
        '<button type="button" class="kg-btn" data-kg="back">' + esc(t('btnBack')) + '</button>' +
        '<button type="button" class="kg-btn" data-kg="overview">' + esc(t('btnOverview')) + '</button>' +
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
        '<div class="kg-filter" id="kg-filter"></div>' +
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
    filter: document.getElementById('kg-filter'),
    detail: document.getElementById('kg-detail'),
    list: document.getElementById('kg-list'),
    live: document.getElementById('kg-live'),
  };

  function announce(msg) { el.live.textContent = msg; }

  /* 视图内按 id 找节点（≤80 个，线性查找足够） */
  function nodeOf(view, id) {
    for (var i = 0; i < view.nodes.length; i++) if (view.nodes[i].id === id) return view.nodes[i];
    return null;
  }

  /* 每视图只建一次的邻接索引：度数 + 「节点 → 相邻边在 view.links 里的下标」。 */
  function viewIndex(view) {
    if (view._idx) return view._idx;
    var deg = {}, adj = {};
    view.nodes.forEach(function (n) { deg[n.id] = 0; adj[n.id] = []; });
    view.links.forEach(function (l, i) {
      if (adj[l.from] && adj[l.to]) {
        deg[l.from]++;
        deg[l.to]++;
        adj[l.from].push(i);
        adj[l.to].push(i);
      }
    });
    return (view._idx = { deg: deg, adj: adj });
  }
  function degOf(view, id) { return viewIndex(view).deg[id] || 0; }
  function neighborIds(view, id) {
    var set = {}, adj = viewIndex(view).adj[id] || [];
    set[id] = 1;
    for (var i = 0; i < adj.length; i++) {
      var l = view.links[adj[i]];
      set[l.from] = 1;
      set[l.to] = 1;
    }
    return set;
  }

  /* ---------------- 面包屑 ---------------- */
  function renderCrumbs(view) {
    var home = VIEWS[DATA.defaultView].title;
    var cur = view.title;
    el.crumbs.innerHTML =
      '<span class="kg-crumb">' + esc(home) + '</span>' +
      (cur === home ? '' :
        '<span class="kg-crumb-sep" aria-hidden="true">/</span>' +
        '<span class="kg-crumb kg-crumb--cur">' + esc(cur) + '</span>');
  }

  /* ---------------- 统计 + 图例 ---------------- */
  function renderMeta(view) {
    el.stats.textContent = t('stats', { nodes: view.nodes.length, links: view.links.length });
    el.legend.innerHTML = '<span class="kg-legend-title">' + esc(t('legend')) + '</span>' +
      DATA.relations.map(function (r) {
        var dash = relDash(r.id);
        return '<span class="kg-legend-item">' +
          '<svg viewBox="0 0 34 10" aria-hidden="true" focusable="false"><line x1="1" y1="5" x2="33" y2="5" ' +
          'stroke="' + esc(relColor(r.id)) + '" stroke-width="2"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>' +
          esc(r.name) + '</span>';
      }).join('');
  }

  /* ---------------- 分类筛选（可聚焦按钮） ---------------- */
  function renderFilter(view) {
    var present = {};
    view.nodes.forEach(function (n) { present[n.cat] = 1; });
    var chips = DATA.categories.filter(function (c) { return present[c.id]; }).map(function (c) {
      var on = state.filterCat === c.id;
      return '<button type="button" class="kg-chip" data-kg-cat="' + esc(c.id) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(c.name) + '</button>';
    }).join('');
    el.filter.innerHTML = '<p class="kg-filter-title">' + esc(t('filterTitle')) + '</p>' +
      '<div class="kg-filter-chips">' +
        '<button type="button" class="kg-chip" data-kg-cat="" aria-pressed="' +
          (state.filterCat ? 'false' : 'true') + '">' + esc(t('filterAll')) + '</button>' +
        chips +
      '</div>';
  }

  /* ---------------- 表格视图（图形之外的等价入口，支持键盘 / 读屏） ---------------- */
  function renderList(view) {
    var rows = view.nodes.map(function (n) {
      var sel = state.selId === n.id;
      return '<tr class="' + (sel ? 'is-sel' : '') + '">' +
        '<td class="kg-table-name">' +
          '<span class="kg-dot" style="background:' + esc(catColor(n.cat)) + '"></span>' +
          esc(n.name) + '</td>' +
        '<td class="kg-table-cat">' + esc(catName(n.cat)) + '</td>' +
        '<td class="kg-table-num">' + degOf(view, n.id) + '</td>' +
        '<td><button type="button" class="kg-row-btn" data-kg-sel="' + esc(n.id) + '"' +
          ' aria-pressed="' + (sel ? 'true' : 'false') + '">' + esc(t('listSelect')) + '</button></td>' +
      '</tr>';
    }).join('');
    el.list.innerHTML =
      '<p class="kg-list-head">' + esc(t('listHead')) + '</p>' +
      '<p class="kg-list-hint">' + esc(t('listHint')) + '</p>' +
      '<table class="kg-table"><thead><tr>' +
        '<th scope="col">' + esc(t('colNode')) + '</th>' +
        '<th scope="col">' + esc(t('colCat')) + '</th>' +
        '<th scope="col">' + esc(t('colDeg')) + '</th>' +
        '<th scope="col">' + esc(t('colAct')) + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------------- 侧栏详情：选中节点后在这里做 drillTo / route ---------------- */
  function renderDetail() {
    var view = VIEWS[state.viewId];
    if (!state.selId || !nodeOf(view, state.selId)) {
      el.detail.innerHTML = '<p class="kg-detail-head">' + esc(t('detailHead')) + '</p>' +
        '<p class="kg-detail-empty">' + esc(t('detailEmpty')) + '</p>';
      return;
    }
    var n = nodeOf(view, state.selId);
    var meta = catName(n.cat) + t('detailAnd') + t('detailDeg', { n: degOf(view, n.id) });
    var acts = [];
    if (n.drillTo) {
      acts.push('<button type="button" class="kg-btn" data-kg-drill="' + esc(n.drillTo) + '">' + esc(t('btnDrill')) + '</button>');
    }
    if (n.route) {
      acts.push('<button type="button" class="kg-btn" data-kg-go="' + esc(n.route) + '">' + esc(t('btnGo')) + '</button>');
    }
    acts.push('<button type="button" class="kg-btn" data-kg-act="clear">' + esc(t('btnClear')) + '</button>');
    el.detail.innerHTML =
      '<p class="kg-detail-head">' + esc(t('detailHead')) + '</p>' +
      '<p class="kg-detail-name">' +
        '<span class="kg-dot" style="background:' + esc(catColor(n.cat)) + '"></span>' + esc(n.name) + '</p>' +
      '<p class="kg-detail-meta">' + esc(meta) + '</p>' +
      '<div class="kg-detail-actions">' + acts.join('') + '</div>';
  }

  /* =======================================================
   * 五、渲染：把当前视图画成 SVG
   *   样式全部写成「表现属性」（fill / stroke / opacity …）而不是 CSS 类 ——
   *   这样导出 PNG 时序列化出来的 SVG 不会掉色（外部 CSS 不会被序列化）。
   *   节点文字用 <text> 而不是 foreignObject（后者无法被 canvas 导出）。
   * ===================================================== */
  function r1(v) { return Math.round(v * 10) / 10; }

  function worldTransform() {
    return 'translate(' + r1(state.tx) + ',' + r1(state.ty) + ') scale(' + (Math.round(state.k * 1000) / 1000) + ')';
  }

  function labelFs() {
    return Math.max(11, Math.min(14, 13 * (state.fitK || 1)));
  }
  function fullLabelFs(big) {
    var base = big ? SIM.fullLabelFsBig : SIM.fullLabelFsSmall;
    var lo = big ? 9.5 : 8.5, hi = big ? 11.5 : 10;
    return Math.max(lo, Math.min(hi, base * (state.fitK || 1)));
  }

  function renderSvg(view) {
    var pos = state.pos;
    var tk = palette().tk;
    var isFull = view.nodes.length > 40;      // 全图模式：小节点 + 下方紧凑标签
    var fs = labelFs();
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

    /* ② 节点。节点只负责被拖动，没有 click / dblclick 语义：不加点击监听。
       普通视图标签在节点右侧；全图标签在节点正下方。 */
    view.nodes.forEach(function (n) {
      var p = pos[n.id];
      if (!p) return;
      var c = catColor(n.cat);
      var deg = degOf(view, n.id);
      out.push('<g class="kg-node" data-kg-node="' + esc(n.id) + '"' +
        ' aria-label="' + esc(n.name + '（' + catName(n.cat) + '，' + deg + ' 条关联）') + '">');
      out.push('<circle class="kg-node-main" cx="' + r1(p.x) + '" cy="' + r1(p.y) + '" r="' + r1(p.r) + '" fill="' + esc(c) + '"' +
        ' fill-opacity="0.92" stroke="' + esc(tk.surface) + '" stroke-width="2"/>');
      if (isFull) {
        var big = isBackboneCat(n.cat);
        var ffs = fullLabelFs(big);
        out.push('<text x="' + r1(p.x) + '" y="' + r1(p.y + p.r + ffs + 2) + '"' +
          ' text-anchor="middle" font-size="' + r1(ffs) + '" font-weight="' + (big ? 700 : 600) + '"' +
          ' paint-order="stroke" stroke="' + esc(tk.bg) + '" stroke-width="' + (big ? 3.4 : 2.8) + '"' +
          ' stroke-linejoin="round" fill="' + esc(big ? tk.text : tk.soft) + '">' + esc(n.name) + '</text>');
      } else {
        out.push('<text x="' + r1(p.x + p.r + fs * 0.6) + '" y="' + r1(p.y + fs * 0.35) + '"' +
          ' font-size="' + r1(fs) + '" font-weight="600"' +
          ' fill="' + esc(tk.soft) + '">' + esc(n.name) + '</text>');
      }
      out.push('</g>');
    });

    out.push('</g>');
    el.svg.innerHTML = out.join('');

    /* ③ 建一次渲染引用表：之后悬停高亮 / 拖拽全部走引用，不重复 querySelectorAll。 */
    cacheEls(view);
    applyDim();
  }

  function cacheEls(view) {
    el.world = el.svg.querySelector('#kg-world');
    var nodeEls = {};
    Array.prototype.forEach.call(el.svg.querySelectorAll('[data-kg-node]'), function (g) {
      var id = g.getAttribute('data-kg-node');
      nodeEls[id] = { g: g, main: g.querySelector('.kg-node-main'), text: g.querySelector('text') };
    });
    var edgeEls = new Array(view.links.length);
    Array.prototype.forEach.call(el.svg.querySelectorAll('[data-kg-edge]'), function (ln) {
      edgeEls[+ln.getAttribute('data-kg-edge')] = {
        el: ln,
        from: ln.getAttribute('data-from'),
        to: ln.getAttribute('data-to'),
        rel: ln.getAttribute('data-rel'),
      };
    });
    state.nodeEls = nodeEls;
    state.edgeEls = edgeEls;
  }

  /* 邻接高亮 + 分类筛选 + 选中描边：只改表现属性，绝不触碰布局。 */
  function applyDim() {
    var view = VIEWS[state.viewId];
    var isFull = view.nodes.length > 40;
    var active = state.hoverId || state.selId;
    var near = active ? neighborIds(view, active) : null;
    var fc = state.filterCat;
    var catOf = {};
    view.nodes.forEach(function (n) { catOf[n.id] = n.cat; });
    var tk = palette().tk;

    var nodeEls = state.nodeEls || {};
    Object.keys(nodeEls).forEach(function (id) {
      var ref = nodeEls[id];
      var on = (!near || near[id]) && (!fc || catOf[id] === fc);
      ref.g.setAttribute('opacity', on ? '1' : '0.2');
      if (ref.main) {
        var isSel = state.selId === id;
        ref.main.setAttribute('stroke', isSel ? tk.primary : tk.surface);
        ref.main.setAttribute('stroke-width', isSel ? '3' : '2');
      }
    });

    var edgeEls = state.edgeEls || [];
    for (var i = 0; i < edgeEls.length; i++) {
      var e = edgeEls[i];
      if (!e) continue;
      var on2 = (!near || (near[e.from] && near[e.to])) && (!fc || (catOf[e.from] === fc && catOf[e.to] === fc));
      e.el.setAttribute('opacity', on2 ? (isFull ? '0.45' : '0.7') : '0.1');
      e.el.setAttribute('stroke-width', on2 ? (isFull ? 1.1 : 1.6) : '1');
    }
  }

  function renderAll() {
    var view = VIEWS[state.viewId];
    renderCrumbs(view);
    renderMeta(view);
    renderFilter(view);
    renderSvg(view);
    renderList(view);
    renderDetail();
    el.svg.hidden = state.mode !== 'graph';
    el.list.hidden = state.mode !== 'list';
    var modeBtn = root.querySelector('[data-kg="mode"]');
    if (modeBtn) {
      modeBtn.textContent = state.mode === 'graph' ? t('btnModeList') : t('btnModeGraph');
      modeBtn.setAttribute('aria-pressed', state.mode === 'list' ? 'true' : 'false');
    }
  }

  /* 仅重画坐标（拖动 / 邻接松弛后用）：不重建 DOM，只改表现属性。 */
  function redrawPositions() {
    var view = VIEWS[state.viewId];
    var isFull = view.nodes.length > 40;
    var nodeEls = state.nodeEls || {};
    Object.keys(nodeEls).forEach(function (id) {
      var p = state.pos[id], ref = nodeEls[id];
      if (!p || !ref || !ref.main) return;
      ref.main.setAttribute('cx', r1(p.x));
      ref.main.setAttribute('cy', r1(p.y));
      if (ref.text) {
        var fs = parseFloat(ref.text.getAttribute('font-size')) || 13;
        if (isFull) {
          ref.text.setAttribute('x', r1(p.x));
          ref.text.setAttribute('y', r1(p.y + p.r + fs + 2));
        } else {
          ref.text.setAttribute('x', r1(p.x + p.r + fs * 0.6));
          ref.text.setAttribute('y', r1(p.y + fs * 0.35));
        }
      }
    });
    var edgeEls = state.edgeEls || [];
    for (var i = 0; i < edgeEls.length; i++) {
      var e = edgeEls[i];
      if (!e) continue;
      var pa = state.pos[e.from], pb = state.pos[e.to];
      if (!pa || !pb) continue;
      var gap = e.rel === 'part-of' ? 2 : 6;
      var dx = pb.x - pa.x, dy = pb.y - pa.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.el.setAttribute('x1', r1(pa.x + (dx / d) * (pa.r + 2)));
      e.el.setAttribute('y1', r1(pa.y + (dy / d) * (pa.r + 2)));
      e.el.setAttribute('x2', r1(pb.x - (dx / d) * (pb.r + gap)));
      e.el.setAttribute('y2', r1(pb.y - (dy / d) * (pb.r + gap)));
    }
  }

  /* =======================================================
   * 六、力导向布局（确定性：同一视图每次打开位置都一样）
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

  var SIM = {
    linkDistance: { 'part-of': 96, other: 168 },
    linkStrength: { 'part-of': 0.95, other: 0.3 },
    chargeBase: -300,
    chargePerRadius: -7,
    chargeMax: 640,
    pullX: 0.022,
    pullY: 0.085,
    collidePadding: 9,
    labelCap: 44,
    labelBand: 132,
    labelFontSize: 13,
    ticks: 300,
    ticksLarge: 460,
    fullLabelFsBig: 11,
    fullLabelFsSmall: 9.5,
    fullLabelHalfCap: 24,
    fullLabelBandX: 44,
    fullLabelBandY: 22,
    settleTicks: 22,
  };

  var CAT_RADIUS = { part: 30, chapter: 26, section: 15, key: 12, case: 15, dataset: 17, tool: 19 };
  function nodeRadius(n, view) {
    var deg = degOf(view, n.id);
    var base = CAT_RADIUS[n.cat] || 15;
    if (view.nodes.length > 40) base *= 0.55;      // 全图模式整体缩小
    return Math.round(base + Math.min(deg, 8) * 1.6);
  }

  /* 估算标签半宽：中日韩字符约 1 em，拉丁字符约 0.56 em。 */
  function labelWidthOf(name, fs) {
    fs = fs || SIM.labelFontSize;
    var w = 0;
    for (var i = 0; i < name.length; i++) {
      w += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(name[i]) ? fs * 1.02 : fs * 0.56;
    }
    return Math.min(w, 230);
  }
  function labelHalfWidth(name) { return Math.min(labelWidthOf(name) / 2, SIM.labelCap); }
  function fullLabelHalfWidth(name) { return Math.min(labelWidthOf(name, SIM.fullLabelFsSmall) / 2, SIM.fullLabelHalfCap); }
  function isBackboneCat(cat) { return cat === 'part' || cat === 'chapter'; }

  /* 布局快照缓存：布局是确定性的（固定种子 + 定数 tick），
     同一视图第二次进入时直接从快照复原，省掉 300–460 轮物理迭代。 */
  var layoutCache = {};
  function clonePos(pos) {
    var out = {};
    Object.keys(pos).forEach(function (id) { out[id] = { x: pos[id].x, y: pos[id].y, r: pos[id].r }; });
    return out;
  }
  function activateLayout(viewId) {
    var view = VIEWS[viewId];
    var snap = layoutCache[viewId];
    if (!snap) {
      var firstPos = computeLayout(view);
      snap = layoutCache[viewId] = {
        fitK: state.fitK,
        sim: state.sim,
        simNodes: state.simNodes,
        simXY: state.simNodes.map(function (n) { return { x: n.x, y: n.y }; }),
        pos: clonePos(firstPos),
      };
    }
    state.fitK = snap.fitK;
    state.sim = snap.sim;
    state.simNodes = snap.simNodes;
    snap.simNodes.forEach(function (n, i) {
      n.x = snap.simXY[i].x;
      n.y = snap.simXY[i].y;
      n.fx = null;
      n.fy = null;
    });
    return clonePos(snap.pos);
  }

  /* 用 d3-force 松弛布局，再归一化到画布内（d3-force 不管画布尺寸，这步自己兜底）。 */
  function computeLayout(view) {
    var nodes = view.nodes;
    var pos = {};
    var ids = nodes.map(function (n) { return n.id; });
    var rnd = prng(hash(view.title + '|' + ids.join(',')));
    var ringR = Math.min(W, H) * 0.34;
    var fullLayout = nodes.length > 40;

    var simNodes = nodes.map(function (n, i) {
      var ang = (i / nodes.length) * Math.PI * 2 + rnd() * 0.5;
      var r = nodeRadius(n, view);
      var x = W / 2 + Math.cos(ang) * ringR * (0.65 + rnd() * 0.5);
      var y = H / 2 + Math.sin(ang) * ringR * (0.65 + rnd() * 0.5);
      pos[n.id] = { x: x, y: y, r: r };
      return {
        id: n.id, r: r, x: x, y: y,
        labelHalf: fullLayout ? fullLabelHalfWidth(n.name) : labelHalfWidth(n.name),
      };
    });

    var simLinks = view.links
      .filter(function (l) { return pos[l.from] && pos[l.to]; })
      .map(function (l) { return { source: l.from, target: l.to, rel: l.rel }; });

    /* 构造后立刻 .stop()：关掉 d3-force 的内部计时器（它基于 d3-timer → rAF），
       之后全部用同步 tick() 驱动，不依赖任何动画帧。 */
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
        .radius(function (d) { return d.r + SIM.collidePadding + d.labelHalf; })
        .iterations(2))
      .stop();

    var ticks = nodes.length > 40 ? SIM.ticksLarge : SIM.ticks;
    for (var t = 0; t < ticks; t++) sim.tick();
    simNodes.forEach(function (n) { pos[n.id].x = n.x; pos[n.id].y = n.y; });

    fitIntoCanvas(view, pos);

    state.sim = sim;            // 已 stop()；保留引用只为拖拽时把坐标钉到 fx/fy
    state.simNodes = simNodes;
    return pos;
  }

  function fitIntoCanvas(view, pos) {
    var isFull = view.nodes.length > 40;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    view.nodes.forEach(function (n) {
      var p = pos[n.id];
      if (!p) return;
      var pad = n.drillTo ? 6 : 0;
      minX = Math.min(minX, p.x - p.r - pad);
      maxX = Math.max(maxX, p.x + p.r + pad + (isFull ? SIM.fullLabelBandX : SIM.labelBand));
      minY = Math.min(minY, p.y - p.r - pad);
      maxY = Math.max(maxY, p.y + p.r + pad + (isFull ? SIM.fullLabelBandY : 0));
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
    state.fitK = k;
    return k;
  }

  /* 把 simulation 的坐标同步回 pos（拖动 / 松弛后） */
  function syncPosFromSim() {
    var list = state.simNodes || [];
    for (var i = 0; i < list.length; i++) {
      var n = list[i], p = state.pos[n.id];
      if (p) { p.x = n.x; p.y = n.y; }
    }
  }

  /* 拖动后的邻接松弛：手动 tick（setTimeout 防抖），绝不用 rAF。 */
  function settle() {
    if (!state.sim || !state.simNodes) return;
    state.sim.alpha(0.32);
    for (var i = 0; i < SIM.settleTicks; i++) state.sim.tick();
    state.sim.stop();
    syncPosFromSim();
    redrawPositions();
  }
  function scheduleSettle() {
    if (state.settleTimer) clearTimeout(state.settleTimer);
    state.settleTimer = setTimeout(function () {
      state.settleTimer = null;
      settle();
    }, 40);
  }

  /* =======================================================
   * 七、视图切换 / 缩放平移 / 位置持久化
   * ===================================================== */
  var LS_POS = 'vis4-graph-pos';
  var LS_VIEW = 'vis4-graph-view';

  function readPosAll() {
    try { return JSON.parse(localStorage.getItem(LS_POS) || '{}') || {}; } catch (e) { return {}; }
  }
  function readPos(viewId) { var all = readPosAll(); return all[viewId] || null; }
  function savePos(viewId, pos) {
    try {
      var all = readPosAll();
      var one = {};
      Object.keys(pos).forEach(function (id) { one[id] = { x: r1(pos[id].x), y: r1(pos[id].y) }; });
      all[viewId] = one;
      localStorage.setItem(LS_POS, JSON.stringify(all));
    } catch (e) { /* 隐私模式等场景降级 */ }
  }
  function clearPos(viewId) {
    try {
      var all = readPosAll();
      if (all[viewId]) { delete all[viewId]; localStorage.setItem(LS_POS, JSON.stringify(all)); }
    } catch (e) { /* 忽略 */ }
  }
  function readMode() { try { return localStorage.getItem(LS_VIEW) === 'list' ? 'list' : 'graph'; } catch (e) { return 'graph'; } }
  function saveMode(m) { try { localStorage.setItem(LS_VIEW, m); } catch (e) { /* 忽略 */ } }

  /* 把持久化的坐标套回当前布局（并钉住 fx/fy，使其在松弛中保持不动） */
  function applySaved(view, saved) {
    view.nodes.forEach(function (n) {
      var s = saved[n.id];
      if (!s || !state.pos[n.id]) return;
      state.pos[n.id].x = s.x;
      state.pos[n.id].y = s.y;
      var sn = simNodeOf(n.id);
      if (sn) { sn.x = s.x; sn.y = s.y; sn.fx = s.x; sn.fy = s.y; }
    });
  }

  function showView(id, restore) {
    if (!VIEWS[id]) return;
    state.viewId = id;
    state.selId = null;
    state.hoverId = null;
    state.filterCat = null;
    if (!restore) clearPos(id);
    state.pos = activateLayout(id);
    state.k = 1; state.tx = 0; state.ty = 0;
    if (restore) { var saved = readPos(id); if (saved) applySaved(VIEWS[id], saved); }
    renderAll();
    announce(t('a11yView', { title: VIEWS[id].title, nodes: VIEWS[id].nodes.length }));
  }

  function goBack() {
    var prev = state.hist.pop();
    if (prev) showView(prev, false);
    else showView(DATA.defaultView, false);
  }
  function goOverview() {
    state.hist = [];
    showView(DATA.defaultView, false);
  }
  function goFull() {
    if (state.viewId === 'full') return;
    state.hist.push(state.viewId);
    showView('full', false);
  }
  function drillTo(id) {
    if (!VIEWS[id]) return;
    state.hist.push(state.viewId);
    showView(id, false);
  }

  /* 缩放 / 平移只改 <g transform>，不重画 DOM */
  function applyTransform() { if (el.world) el.world.setAttribute('transform', worldTransform()); }
  function clampK(k) { return Math.min(Math.max(k, 0.4), 3); }
  function zoomBy(factor, cx, cy) {
    var k2 = clampK(state.k * factor);
    var ratio = k2 / state.k;
    state.tx = cx - (cx - state.tx) * ratio;
    state.ty = cy - (cy - state.ty) * ratio;
    state.k = k2;
    applyTransform();
  }
  function toSvgCoords(clientX, clientY) {
    var r = el.svg.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H };
  }
  function toWorldCoords(clientX, clientY) {
    var p = toSvgCoords(clientX, clientY);
    return { x: (p.x - state.tx) / state.k, y: (p.y - state.ty) / state.k };
  }

  /* 适应窗口：清掉本视图的持久化位置，从快照复原初始布局并复位缩放 */
  function fitView() {
    clearPos(state.viewId);
    state.pos = activateLayout(state.viewId);
    state.selId = null;
    state.filterCat = null;
    state.k = 1; state.tx = 0; state.ty = 0;
    renderAll();
    announce(t('a11yView', { title: VIEWS[state.viewId].title, nodes: VIEWS[state.viewId].nodes.length }));
  }

  /* =======================================================
   * 八、交互
   * ===================================================== */
  function nodeIdFrom(ev) {
    var n = ev.target;
    while (n && n !== el.svg) {
      if (n.getAttribute && n.getAttribute('data-kg-node')) return n.getAttribute('data-kg-node');
      n = n.parentNode;
    }
    return null;
  }
  function simNodeOf(id) {
    var list = state.simNodes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 拖动一个节点：更新它自己 + 相邻的边；位置同步回 d3-force 节点并用 fx/fy 钉住。
     全部走渲染时建好的缓存引用，没有一次 querySelectorAll / getAttribute。 */
  function moveNode(id, x, y) {
    var p = state.pos[id];
    if (!p) return;
    p.x = x; p.y = y;
    var sn = simNodeOf(id);
    if (sn) { sn.fx = x; sn.fy = y; sn.x = x; sn.y = y; }

    var ref = state.nodeEls && state.nodeEls[id];
    var isFull = VIEWS[state.viewId].nodes.length > 40;
    if (ref && ref.main) {
      ref.main.setAttribute('cx', r1(x));
      ref.main.setAttribute('cy', r1(y));
      if (ref.text) {
        var fs = parseFloat(ref.text.getAttribute('font-size')) || 13;
        if (isFull) {
          ref.text.setAttribute('x', r1(x));
          ref.text.setAttribute('y', r1(y + p.r + fs + 2));
        } else {
          ref.text.setAttribute('x', r1(x + p.r + fs * 0.6));
          ref.text.setAttribute('y', r1(y + fs * 0.35));
        }
      }
    }
    var adj = viewIndex(VIEWS[state.viewId]).adj[id] || [];
    var edgeEls = state.edgeEls || [];
    for (var i = 0; i < adj.length; i++) {
      var e = edgeEls[adj[i]];
      if (!e) continue;
      var pa = state.pos[e.from], pb = state.pos[e.to];
      if (!pa || !pb) continue;
      var gap = e.rel === 'part-of' ? 2 : 6;
      var dx = pb.x - pa.x, dy = pb.y - pa.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.el.setAttribute('x1', r1(pa.x + (dx / d) * (pa.r + 2)));
      e.el.setAttribute('y1', r1(pa.y + (dy / d) * (pa.r + 2)));
      e.el.setAttribute('x2', r1(pb.x - (dx / d) * (pb.r + gap)));
      e.el.setAttribute('y2', r1(pb.y - (dy / d) * (pb.r + gap)));
    }
  }

  function bindEvents() {
    /* --- 指针：拖节点 / 拖空白平移。节点没有点击动作，按下即开始拖。 --- */
    el.svg.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var id = nodeIdFrom(ev);
      if (id) {
        var w = toWorldCoords(ev.clientX, ev.clientY);
        var p = state.pos[id];
        state.drag = { id: id, dx: p.x - w.x, dy: p.y - w.y };
        el.svg.classList.add('is-dragging-node');
      } else {
        state.drag = { pan: true, sx: ev.clientX, sy: ev.clientY, ox: state.tx, oy: state.ty };
        el.svg.classList.add('is-panning');
      }
      if (el.svg.setPointerCapture) { try { el.svg.setPointerCapture(ev.pointerId); } catch (e) {} }
    });

    el.svg.addEventListener('pointermove', function (ev) {
      if (!state.drag) {
        var id0 = nodeIdFrom(ev);
        if (id0 !== state.hoverId) { state.hoverId = id0; applyDim(); }
        return;
      }
      if (state.drag.pan) {
        state.tx = state.drag.ox + (ev.clientX - state.drag.sx);
        state.ty = state.drag.oy + (ev.clientY - state.drag.sy);
        applyTransform();
      } else {
        var w = toWorldCoords(ev.clientX, ev.clientY);
        moveNode(state.drag.id, w.x + state.drag.dx, w.y + state.drag.dy);
        scheduleSettle();   /* 防抖：稍后手动 tick 让邻接点跟随 */
      }
    });

    var endDrag = function () {
      var wasNode = state.drag && !state.drag.pan;
      if (state.drag && state.drag.pan) el.svg.classList.remove('is-panning');
      el.svg.classList.remove('is-dragging-node');
      state.drag = null;
      if (wasNode) {
        if (state.settleTimer) { clearTimeout(state.settleTimer); state.settleTimer = null; }
        settle();                       /* 立即跑一轮，位置确定性落定 */
        savePos(state.viewId, state.pos); /* 松开即持久化 */
      }
    };
    el.svg.addEventListener('pointerup', endDrag);
    el.svg.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    el.svg.addEventListener('pointerleave', function () {
      state.hoverId = null;
      if (!state.drag) applyDim();
    });

    /* --- 滚轮缩放（以指针为中心） --- */
    el.svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var p = toSvgCoords(ev.clientX, ev.clientY);
      zoomBy(ev.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    }, { passive: false });
  }

  /* 工具栏事件统一委托到 #kg-root（只挂一个监听） */
  function bindToolbar() {
    root.addEventListener('click', function (ev) {
      var tgt = ev.target;
      if (!tgt || !tgt.closest) return;

      var btn = tgt.closest('[data-kg]');
      if (btn) {
        var act = btn.getAttribute('data-kg');
        if (act === 'back') { goBack(); return; }
        if (act === 'overview') { goOverview(); return; }
        if (act === 'full') { goFull(); return; }
        if (act === 'zoom-in') { zoomBy(1.2, W / 2, H / 2); return; }
        if (act === 'zoom-out') { zoomBy(1 / 1.2, W / 2, H / 2); return; }
        if (act === 'fit') { fitView(); return; }
        if (act === 'export') { exportPng(); return; }
        if (act === 'mode') {
          state.mode = state.mode === 'graph' ? 'list' : 'graph';
          saveMode(state.mode);
          renderAll();
          return;
        }
      }

      var selBtn = tgt.closest('[data-kg-sel]');
      if (selBtn) {
        var id = selBtn.getAttribute('data-kg-sel');
        state.selId = (state.selId === id) ? null : id;
        renderList(VIEWS[state.viewId]);
        renderDetail();
        applyDim();
        if (state.selId) {
          var n = nodeOf(VIEWS[state.viewId], state.selId);
          announce(t('selected', { name: n ? n.name : state.selId }));
        }
        return;
      }

      var chip = tgt.closest('[data-kg-cat]');
      if (chip) {
        var c = chip.getAttribute('data-kg-cat') || null;
        state.filterCat = (c && state.filterCat !== c) ? c : null;
        renderFilter(VIEWS[state.viewId]);
        applyDim();
        return;
      }

      var drillBtn = tgt.closest('[data-kg-drill]');
      if (drillBtn) { drillTo(drillBtn.getAttribute('data-kg-drill')); return; }

      var goBtn = tgt.closest('[data-kg-go]');
      if (goBtn) { window.location.href = goBtn.getAttribute('data-kg-go'); return; }

      var clearBtn = tgt.closest('[data-kg-act="clear"]');
      if (clearBtn) {
        state.selId = null;
        renderList(VIEWS[state.viewId]);
        renderDetail();
        applyDim();
        return;
      }
    });
  }

  /* 导出 PNG：序列化当前 SVG → canvas → 下载。
     所有样式都写成了表现属性，序列化出来不会掉色；
     导出前把平移缩放复位，保证导出的是「适应画布」的整图。 */
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

  /* =======================================================
   * 九、初始化
   * ===================================================== */
  bindEvents();
  bindToolbar();
  state.mode = readMode();
  showView(DATA.defaultView, true);   /* 首次进入：恢复上次拖动过的位置 */

  /* 深浅色变化时重画：颜色是实时从 tokens.css 读的，重画即可。
     来源：① 系统主题变化 ② 顶栏手动切换（theme.js 派发 themechange）。 */
  var onThemeChange = function () { resetPalette(); renderAll(); };
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', onThemeChange);
    else if (mq.addListener) mq.addListener(onThemeChange);
  }
  document.addEventListener('themechange', onThemeChange);
}());
