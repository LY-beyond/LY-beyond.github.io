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
    hint: '按住节点可自由拖动（松手即停在放下的位置）· 悬停看邻接关系 · 滚轮缩放 · 空白处拖拽平移',
    listHead: '当前视图的节点清单（可直接跳转）',
    listHint: '列表视图便于键盘浏览与读屏，也是手机上的高效入口。',
    fullTitle: '完整图谱',
    dataError: '图谱数据加载失败：请确认 graph-data.js 已在本页面加载。',
    d3Error: 'd3-force 未加载：请确认 vendor/ 下的 d3-quadtree / d3-dispatch / d3-timer / d3-force 四个文件已按顺序引入。',
    exported: '已导出 PNG',
    exportFailed: '导出失败，请改用截图工具',
    a11yView: '当前视图：{title}，{nodes} 个节点',
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
  /* getComputedStyle 本身不便宜：整次会话只取一次，主题切换时清缓存重取 */
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
      soft: token('--c-text-soft', '#4b5563'),
      muted: token('--c-muted', '#9ca3af'),
      line: token('--c-border', '#d1d5db'),
      bg: token('--c-bg', '#faf9f7'),
      surface: token('--c-surface', '#ffffff'),
      surface2: token('--c-surface-2', '#f3f4f6'),
    };
  }
  var CAT_TOKEN = { part: '--c-primary', chapter: '--c-info', section: '--c-accent', step: '--c-primary', lab: '--c-accent' };
  function resolveCatColor(cat) {
    var meta = CAT[cat] || {};
    var fromData = meta.color ? '--' + meta.color : '';
    var name = /^--c-/.test(fromData) ? fromData : (CAT_TOKEN[cat] || '--c-info');
    return token(name, '#64748b');
  }
  var REL_TOKEN = { 'part-of': '--c-border', prereq: '--c-info', 'used-in': '--c-accent' };

  /* 调色板缓存：一次渲染里每个类别（≤5 个）/ 关系（3 种）只解析一次令牌。
     若不缓存，全图视图每帧要对 51 个节点 + 121 条边各调一次
     getComputedStyle().getPropertyValue() —— 那是渲染里最贵的调用之一。 */
  var paletteCache = null;
  function palette() {
    if (paletteCache) return paletteCache;
    var cats = {}, rels = {};
    DATA.categories.forEach(function (c) { cats[c.id] = resolveCatColor(c.id); });
    DATA.relations.forEach(function (r) { rels[r.id] = token(REL_TOKEN[r.id] || '--c-border', '#cbd5e1'); });
    paletteCache = { tk: tokens(), cats: cats, rels: rels };
    return paletteCache;
  }
  function catColor(cat) { return palette().cats[cat] || token('--c-info', '#64748b'); }
  function relColor(rel) { return palette().rels[rel] || token('--c-border', '#cbd5e1'); }
  function resetPalette() { paletteCache = null; _cs = null; }
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
    hist: [],
    k: 1, tx: 0, ty: 0,
    mode: 'graph',
    pos: null,
    drag: null,
    pan: null,
    sim: null,        // d3-force 模拟实例（仅初始布局时跑一次；拖动后节点钉住，不再重平衡）
    simNodes: null,   // 模拟里的节点（带 x/y/vx/vy/fx/fy）
    nodeEls: null,    // 渲染引用表：id → { g, main, text }
    edgeEls: null,    // 渲染引用表：边索引（对应 view.links）→ { el, from, to, rel }
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
      '</aside>' +
    '</div>' +
    '<p class="kg-hint">' + esc(t('hint')) + '</p>' +
    '<p class="kg-live" id="kg-live" role="status" aria-live="polite"></p>';

  var el = {
    svg: document.getElementById('kg-svg'),
    world: null,       // 当前 #kg-world 元素（每次重渲染后刷新引用）
    stage: document.getElementById('kg-stage'),
    crumbs: document.getElementById('kg-crumbs'),
    stats: document.getElementById('kg-stats'),
    legend: document.getElementById('kg-legend'),
    list: document.getElementById('kg-list'),
    live: document.getElementById('kg-live'),
  };

  function announce(msg) { el.live.textContent = msg; }

  /* 节点查询：视图内按 id 找节点（≤51 个，线性查找足够；加缓存反而增加失配成本） */
  function nodeOf(view, id) {
    for (var i = 0; i < view.nodes.length; i++) if (view.nodes[i].id === id) return view.nodes[i];
    return null;
  }

  /* 每视图只建一次的邻接索引：度数 + 「节点 → 相邻边在 view.links 里的下标」。
     渲染度数、悬停高亮、拖拽更新都走它，避免每次对全部边做 filter ——
     否则光渲染一张全图就是 O(节点数 × 边数) 次比较，拖拽时每一帧还要再来一遍。 */
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
          '<span class="kg-list-rel">' + t('stats', { nodes: 1, links: degOf(view, n.id) }).replace(/^\S+\s*·\s*/, '') + '</span>';
        return n.route
          ? '<a class="kg-list-item" href="' + esc(n.route) + '">' + inner + '</a>'
          : '<span class="kg-list-item kg-list-item--static" aria-disabled="true">' + inner + '</span>';
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
    /* 全图标签画在节点「正下方」，51 个长名字不可能完全不碰，
       策略是：小字号 + 底色描边保证叠住也能读 + 碰撞只给部分宽度、
       不把整图撑散；初始 fit 下偏紧凑，滚轮放大后清晰。 */
    fullLabelFsBig: 11,        // 骨架节点（篇章/章节）字号基数
    fullLabelFsSmall: 9.5,     // 叶节点（知识点/步骤/实战）字号基数
    fullLabelHalfCap: 24,      // 全图标签参与碰撞的半宽上限
    fullLabelBandX: 44,        // 全图归一化时右侧留白（标签在下方，只需防贴边）
    fullLabelBandY: 22,        // 全图归一化时下方给标签留的空白带
  };

  function nodeRadius(n, view) {
    var deg = degOf(view, n.id);
    var base = { part: 30, chapter: 26, section: 17, step: 17, lab: 19 }[n.cat] || 17;
    if (view.nodes.length > 40) base *= 0.55;      // 全图模式整体缩小
    return Math.round(base + Math.min(deg, 8) * 1.6);
  }

  /* 估算标签半宽：中日韩字符约 1 em，拉丁字符约 0.55 em。
     用于让 d3-force 的 collide 也给"标签"留出位置（否则标签会压住相邻节点）。 */
  function labelWidthOf(name, fs) {
    fs = fs || SIM.labelFontSize;
    var w = 0;
    for (var i = 0; i < name.length; i++) {
      w += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(name[i])
        ? fs * 1.02
        : fs * 0.56;
    }
    return Math.min(w, 230);
  }
  function labelHalfWidth(name) {
    return Math.min(labelWidthOf(name) / 2, SIM.labelCap);
  }

  /* 全图标签宽度：按全图小字号估算，只取一个有上限的半宽参与碰撞
     （给足全宽会把 51 节点撑到极小；部分宽度足以让同排节点错开）。 */
  function fullLabelHalfWidth(name) {
    return Math.min(labelWidthOf(name, SIM.fullLabelFsSmall) / 2, SIM.fullLabelHalfCap);
  }

  /* 全图标签是否为骨架节点：篇章 / 章节名字短、节点大，用大字加粗 */
  function isBackboneCat(cat) { return cat === 'part' || cat === 'chapter'; }

  /* 全图标签字号：骨架 9.5–11.5，叶节点 8.5–10，跟随归一化缩放 */
  function fullLabelFs(big) {
    var base = big ? SIM.fullLabelFsBig : SIM.fullLabelFsSmall;
    var lo = big ? 9.5 : 8.5, hi = big ? 11.5 : 10;
    return Math.max(lo, Math.min(hi, base * (state.fitK || 1)));
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

  /* 标签字号跟随归一化缩放 */
  function labelFs() {
    return Math.max(11, Math.min(14, 13 * (state.fitK || 1)));
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

    /* ② 节点。节点只负责被拖动，没有点击/选中语义：不加 role/tabindex。
       普通视图标签在节点右侧；全图标签在节点正下方——小字号分层（篇章/章节
       加粗加大），并给文字描一圈底色（paint-order: stroke），即使压着连线或
       彼此轻微重叠也读得清；悬停时无关节点整体淡出，局部关系一目了然。 */
    view.nodes.forEach(function (n) {
      var p = pos[n.id];
      if (!p) return;
      var c = catColor(n.cat);
      var deg = degOf(view, n.id);
      var catLabel = (CAT[n.cat] || {}).label || n.cat;
      out.push('<g class="kg-node" data-kg-node="' + esc(n.id) + '"' +
        ' aria-label="' + esc(n.name + '（' + catLabel + '，' + deg + ' 条关联）') + '">');
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

    /* ③ 建一次渲染引用表：之后悬停高亮 / 拖拽全部走引用，
          不 querySelectorAll 全图、不逐个 getAttribute 读 from/to/rel。 */
    cacheEls(view);
    applyDim(null);
  }

  /* innerHTML 之后收集 DOM 引用（一次 QSA，摊薄到后续所有交互上） */
  function cacheEls(view) {
    el.world = el.svg.querySelector('#kg-world');
    var nodeEls = {};
    Array.prototype.forEach.call(el.svg.querySelectorAll('[data-kg-node]'), function (g) {
      var id = g.getAttribute('data-kg-node');
      var main = g.querySelector('.kg-node-main');
      nodeEls[id] = { g: g, main: main, text: g.querySelector('text') };
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

  /* 邻接高亮：给定节点，淡出与它无关的节点与边
     （这就是"力导向图别变成一团毛线球"的关键手法）。
     只改 opacity / stroke-width 两个表现属性，且直接用缓存引用 —— 不触碰布局。 */
  function applyDim(activeId) {
    var view = VIEWS[state.viewId];
    var isFull = view.nodes.length > 40;
    var near = activeId ? neighborIds(view, activeId) : null;
    var nodeEls = state.nodeEls || {};
    var edgeEls = state.edgeEls || [];

    Object.keys(nodeEls).forEach(function (id) {
      nodeEls[id].g.setAttribute('opacity', (!near || near[id]) ? '1' : '0.22');
    });
    for (var i = 0; i < edgeEls.length; i++) {
      var e = edgeEls[i];
      if (!e) continue;
      var on = !near || (near[e.from] && near[e.to]);
      e.el.setAttribute('opacity', on ? (isFull ? '0.45' : '0.7') : '0.1');
      e.el.setAttribute('stroke-width', on ? (isFull ? 1.1 : 1.6) : '1');
    }
  }

  function renderAll() {
    var view = VIEWS[state.viewId];
    renderCrumbs(view);
    renderMeta(view);
    renderSvg(view);
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
   * 七、视图切换 / 缩放平移
   * ===================================================== */
  function showView(id) {
    if (!VIEWS[id]) return;
    state.viewId = id;
    state.pos = activateLayout(id);   // 确定性布局：同一视图每次位置一致（二次进入走快照）
    state.k = 1; state.tx = 0; state.ty = 0;
    renderAll();
    announce(t('a11yView', { title: VIEWS[id].title, nodes: VIEWS[id].nodes.length }));
  }

  function goBack() {
    var prev = state.hist.pop();
    if (prev) showView(prev);
  }

  function goRoot() {
    state.hist = [];
    showView(DATA.defaultView);
  }

  /* 缩放/平移只改 <g transform>，不重画 DOM —— 拖拽时才不会卡 */
  function applyTransform() {
    if (el.world) el.world.setAttribute('transform', worldTransform());
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

  /* 适应窗口：从快照复原初始布局并复位缩放（等于"恢复原状"，不重跑物理迭代） */
  function fitView() {
    state.pos = activateLayout(state.viewId);
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

  /* 拖动一个节点：更新它自己 + **仅相邻的边**（典型 2–5 条，不扫全部边）。
     位置同时同步回 d3-force 节点并用 fx/fy 永久钉住 —— 松手后节点就停在放下的位置，
     不会被弹簧拉回去；「适应窗口」或重新进入视图时才从初始快照复位。
     所有 DOM 引用都来自渲染时建好的缓存表，没有一次 querySelectorAll / getAttribute。 */
  function moveNode(id, x, y) {
    var p = state.pos[id];
    if (!p) return;
    p.x = x; p.y = y;

    var sn = simNodeOf(id);
    if (sn) { sn.fx = x; sn.fy = y; sn.x = x; sn.y = y; }

    var ref = state.nodeEls && state.nodeEls[id];
    if (ref) {
      ref.main.setAttribute('cx', r1(x));
      ref.main.setAttribute('cy', r1(y));
      if (ref.text) {
        var fs2 = parseFloat(ref.text.getAttribute('font-size')) || 13;
        if (VIEWS[state.viewId].nodes.length > 40) {
          /* 全图标签：节点正下方居中 */
          ref.text.setAttribute('x', r1(x));
          ref.text.setAttribute('y', r1(y + p.r + fs2 + 2));
        } else {
          ref.text.setAttribute('x', r1(x + p.r + fs2 * 0.6));
          ref.text.setAttribute('y', r1(y + fs2 * 0.35));
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
    /* --- 指针：拖节点 / 拖空白平移（节点没有点击动作，按下即开始拖） --- */
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
        /* 未拖拽时：只做悬停邻接高亮 */
        var id0 = nodeIdFrom(ev);
        if (id0 !== hoverId) { hoverId = id0; applyDim(id0); }
        return;
      }
      if (state.drag.pan) {
        /* 平移只写一个 transform 属性，开销极小，保持跟手不延迟 */
        state.tx = state.drag.ox + (ev.clientX - state.drag.sx);
        state.ty = state.drag.oy + (ev.clientY - state.drag.sy);
        applyTransform();
      } else {
        /* 直接同步更新：moveNode 只动被拖节点 + 相邻几条边（走缓存引用），
           单次开销已经极小；同步还能保证无头浏览器 / 后台标签节流时照样跟手。 */
        var w = toWorldCoords(ev.clientX, ev.clientY);
        moveNode(state.drag.id, w.x + state.drag.dx, w.y + state.drag.dy);
      }
    });

    /* 松手 / 取消 / 窗口失焦：统一清理。节点位置在 moveNode 里已钉住，
       这里什么都不用做 —— 节点自然停在放下的位置。 */
    var endDrag = function () {
      if (state.drag && state.drag.pan) el.svg.classList.remove('is-panning');
      el.svg.classList.remove('is-dragging-node');
      state.drag = null;
    };
    el.svg.addEventListener('pointerup', endDrag);
    el.svg.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    el.svg.addEventListener('pointerleave', function () {
      hoverId = null;
      if (!state.drag) applyDim(null);
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
      var btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-kg]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-kg');
      if (act === 'back') { goBack(); return; }
      if (act === 'root') { goRoot(); return; }
      if (act === 'full') {
        if (state.viewId !== 'full') { state.hist.push(state.viewId); showView('full'); }
        return;
      }
      if (act === 'zoom-in') { zoomBy(1.2, W / 2, H / 2); return; }
      if (act === 'zoom-out') { zoomBy(1 / 1.2, W / 2, H / 2); return; }
      if (act === 'fit') { fitView(); return; }
      if (act === 'export') { exportPng(); return; }
      if (act === 'mode') {
        state.mode = state.mode === 'graph' ? 'list' : 'graph';
        renderAll();
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

  /* 布局快照缓存：布局是**确定性**的（固定种子 + 定数 tick），同一视图第二次进入时，
     直接从快照复原即可，省掉 320–460 轮物理迭代（全图视图是最贵的一笔）。
     缓存的是「初始快照」：自由拖动只在当前 pos/simNodes 上钉位置（fx/fy），
     不会污染快照 —— 所以再进入该视图（或点「适应窗口」）仍精确回到初始布局。 */
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
    /* 从快照复原：新的 pos 对象 + 把 d3-force 节点也搬回初始坐标并解除钉住 */
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

  /* 用 d3-force 松弛布局，再把结果归一化到画布内。
     d3-force 只管物理、不管画布尺寸，所以"装进画布"这一步仍由我们兜底。 */
  function computeLayout(view) {
    var nodes = view.nodes;
    var pos = {};
    var ids = nodes.map(function (n) { return n.id; });
    var rnd = prng(hash(view.title + '|' + ids.join(',')));
    var ringR = Math.min(W, H) * 0.34;

    /* ① 确定性初值：固定种子撒在圆环上（d3-force 在此基础上松弛）
          —— 这样"同一视图每次打开位置一致"，刷新不跳、截图可复现。 */
    /* 普通视图标签在节点右侧、给全半宽；全图标签在节点下方、只给有上限的部分半宽 */
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

    state.sim = sim;            // 已 stop()；保留引用只为拖拽时把坐标钉到 fx/fy
    state.simNodes = simNodes;
    return pos;
  }

  /* 把布局结果等比缩放到画布内（普通视图右侧给标签留位；全图标签在节点下方，
     给下方留位、右侧只防贴边）。
     注意：**位置、半径、字号都乘同一个 k** —— 单位统一之后，
     d3-force 里按标签宽度算出来的间距才是准的。 */
  function fitIntoCanvas(view, pos) {
    var isFull = view.nodes.length > 40;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    view.nodes.forEach(function (n) {
      var p = pos[n.id];
      if (!p) return;
      var pad = n.drillTo ? 6 : 0;
      /* 只预留一块"标签带"（不是每条标签的完整宽度）：
         图形本身接近圆形，宽画布左右两侧本来就有余量，标签正好落进去。
         若按最长标签全宽预留，会把整个图撑开、缩放变小、字号被压小。 */
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
    state.fitK = k;          // renderSvg 用它缩放字号（保持一致）
    return k;
  }

  /* =======================================================
   * 九、初始化
   * -------------------------------------------------------
   * 放在文件末尾是有意的：computeLayout() 等函数定义在下面，
   * 这里一执行就会用到它们（函数声明会提升，但为了可读性仍放最后）。
   * ===================================================== */
  bindEvents();
  bindToolbar();
  showView(DATA.defaultView);

  /* 深浅色变化时重画：颜色是实时从 tokens.css 读的，直接重画即可。
     来源有两个：① 系统主题变化（未手动选择时）② 顶栏手动切换（theme.js 派发） */
  var onThemeChange = function () { resetPalette(); renderAll(); };
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', onThemeChange);
    else if (mq.addListener) mq.addListener(onThemeChange);
  }
  document.addEventListener('themechange', onThemeChange);
}());

