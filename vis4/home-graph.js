// =========================================================
// home-graph.js —— 门户首页「课程知识图谱」渲染器
// ---------------------------------------------------------
// 复用 graph-data.js 的全站知识数据（5 章全部小节 / 关键点 / 案例 / 数据集），
// 用与 vis2「关系图谱」相同的 d3-force 力导向技术在首页直接呈现完整关系网。
//
// 技术要点（与本站 graph.js 保持一致，遵守工程约束）：
//   · d3-force 只负责物理；渲染 / 交互 / 持久化均手写 SVG
//   · 构造 simulation 后立刻 .stop()，再用同步 tick 循环落定布局——
//     禁用 d3-force 基于 rAF 的内部计时器（rAF 在后台标签/无头浏览器不触发）
//   · 节点拖动松手即把位置写入 localStorage，刷新后恢复
//   · 颜色一律从 tokens.css 设计令牌读取（getComputedStyle），深浅主题自动跟随
//   · 普通 script（非 ESM），file:// 双击打开也能运行
// =========================================================
(function () {
  'use strict';

  var root = document.getElementById('home-kg-root');
  if (!root) return;

  var lang = (document.documentElement.lang || 'zh').toLowerCase();
  var EN = lang.indexOf('en') === 0;
  var L = EN ? {
    stats: '{n} nodes · {l} relations',
    fit: 'Fit',
    reset: 'Reset layout',
    open: 'Open full graph →',
    noData: 'Knowledge graph data not loaded (graph-data.js).',
    noD3: 'd3-force not loaded: make sure the four vendor/ files are included in order.',
    aria: 'Course knowledge graph'
  } : {
    stats: '{n} 节点 · {l} 关系',
    fit: '适应窗口',
    reset: '重置布局',
    open: '打开完整图谱 →',
    noData: '知识图谱数据未加载（graph-data.js）。',
    noD3: 'd3-force 未加载：请确认 vendor/ 下四个文件已按顺序引入。',
    aria: '课程知识图谱'
  };
  function tr(s, v) { if (v) Object.keys(v).forEach(function (k) { s = s.split('{' + k + '}').join(v[k]); }); return s; }

  var DATA = window.KG_DATA;
  if (!DATA || !DATA.views) {
    root.innerHTML = '<p class="hkg-error">' + L.noData + '</p>';
    return;
  }
  if (!window.d3 || typeof window.d3.forceSimulation !== 'function') {
    root.innerHTML = '<p class="hkg-error">' + L.noD3 + '</p>';
    return;
  }

  /* ---------- 1. 合并所有视图为完整图谱（节点/边去重） ---------- */
  // 章节 → 令牌色映射（与门户章节卡 / Hero 关系图一致）
  var CH_COLOR = {
    overview: 'var(--c-primary)',
    data:     'var(--ch-1)',
    flow:     'var(--ch-2)',
    color:    'var(--ch-4)',
    lowdim:   'var(--ch-3)',
    temporal: 'var(--ch-6)'
  };

  var nodes = [], links = [], seenN = {}, seenL = {}, chOf = {};
  Object.keys(DATA.views).forEach(function (vid) {
    var v = DATA.views[vid];
    v.nodes.forEach(function (n) {
      if (seenN[n.id]) return;
      seenN[n.id] = 1;
      chOf[n.id] = vid;
      nodes.push(Object.assign({}, n, { ch: vid }));
    });
    v.links.forEach(function (l) {
      var key = l.from + '|' + l.to + '|' + l.rel;
      if (seenL[key]) return;
      seenL[key] = 1;
      // d3-force 默认读 source / target，graph-data 里是 from / to，需映射
      links.push({ source: l.from, target: l.to, rel: l.rel });
    });
  });

  var CAT = {};
  DATA.categories.forEach(function (c) { CAT[c.id] = c; });
  var REL = {};
  DATA.relations.forEach(function (r) { REL[r.id] = r; });

  /* ---------- 2. 章节 → 令牌色映射 ---------- */
  function colByCh(ch) { return CH_COLOR[ch] || CH_COLOR.overview; }

  /* ---------- 3. 节点尺寸 / 标签策略 ---------- */
  function radiusOf(n) {
    switch (n.cat) {
      case 'part':    return 26;
      case 'chapter': return 20;
      case 'tool':    return 16;
      case 'section': return 12;
      case 'dataset':
      case 'case':    return 9;
      default:        return 7;   // key
    }
  }
  function showLabel(n) {
    return n.cat === 'part' || n.cat === 'chapter' || n.cat === 'section' || n.cat === 'tool';
  }

  /* ---------- 4. 持久化位置 ---------- */
  var LS_KEY = 'vis4-home-kg-pos';
  function loadPos() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function savePos(pos) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(pos)); } catch (e) { /* ignore */ }
  }

  /* ---------- 5. 布局：力导向 + 同步 tick 落定 ---------- */
  var W = 960, H = 560;
  var saved = loadPos();

  var sim = window.d3.forceSimulation(nodes)
    .force('link', window.d3.forceLink(links).id(function (d) { return d.id; })
      .distance(function (l) {
        if (!l.source || !l.target) return 60;
        var a = radiusOf(l.source), b = radiusOf(l.target);
        return (a + b + 46);
      }).strength(0.45))
    .force('charge', window.d3.forceManyBody().strength(-240))
    .force('center', window.d3.forceCenter(W / 2, H / 2))
    .force('collide', window.d3.forceCollide().radius(function (d) { return radiusOf(d) + 6; }))
    .force('x', window.d3.forceX(W / 2).strength(0.05))
    .force('y', window.d3.forceY(H / 2).strength(0.05))
    .stop();

  // 已保存位置作为初始坐标（不钉 fx/fy，让所有节点都能参与力导向，
  // 这样拖动任一节点时相邻节点会被吸引/排斥而跟随——与 vis2 一致）
  nodes.forEach(function (n) {
    if (saved[n.id]) { n.x = saved[n.id].x; n.y = saved[n.id].y; }
  });

  // 同步跑若干次让布局一次性落定
  for (var i = 0; i < 320; i++) sim.tick();
  sim.stop();

  /* ---------- 6. 渲染 SVG ---------- */
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', L.aria + '：' + nodes.length + ' ' + (EN ? 'nodes' : '节点') + ', ' + links.length + ' ' + (EN ? 'links' : '关系'));
  svg.classList.add('hkg-svg');

  // 计算边界用于 fit
  function bounds() {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      var r = radiusOf(n);
      minX = Math.min(minX, n.x - r); minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r); maxY = Math.max(maxY, n.y + r);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function fitView() {
    var b = bounds();
    var pad = 24;
    var scale = Math.min(W / (b.w + pad * 2), H / (b.h + pad * 2));
    scale = Math.min(scale, 1.4);
    var tx = W / 2 - (b.x + b.w / 2) * scale;
    var ty = H / 2 - (b.y + b.h / 2) * scale;
    world.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
  }

  var world = document.createElementNS(svgNS, 'g');
  svg.appendChild(world);

  // 连线
  var linkEls = links.map(function (l) {
    var line = document.createElementNS(svgNS, 'line');
    line.setAttribute('class', 'hkg-link hkg-link--' + (REL[l.rel] ? REL[l.rel].style : 'solid'));
    line.dataset.from = l.source;
    line.dataset.to = l.target;
    world.appendChild(line);
    return { line: line, link: l };
  });

  // 节点
  var nodeEls = nodes.map(function (n) {
    var g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'hkg-node hkg-cat-' + n.cat);
    g.dataset.id = n.id;

    var c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('r', radiusOf(n));
    c.setAttribute('fill', colByCh(n.ch));
    c.setAttribute('stroke', 'var(--c-surface)');
    c.setAttribute('stroke-width', '2');
    g.appendChild(c);

    if (showLabel(n)) {
      var t = document.createElementNS(svgNS, 'text');
      t.setAttribute('class', 'hkg-label');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dy', radiusOf(n) + 13);
      t.textContent = n.name;
      g.appendChild(t);
    }

    var title = document.createElementNS(svgNS, 'title');
    title.textContent = n.name + ' · ' + (CAT[n.cat] ? CAT[n.cat].name : n.cat) +
      (n.route ? (EN ? '\nClick to open: ' : '\n点击前往：') + n.route : '');
    g.appendChild(title);

    world.appendChild(g);
    return { g: g, node: n };
  });

  function tickRender() {
    linkEls.forEach(function (e) {
      var s = e.link.source, t = e.link.target;
      e.line.setAttribute('x1', s.x); e.line.setAttribute('y1', s.y);
      e.line.setAttribute('x2', t.x); e.line.setAttribute('y2', t.y);
    });
    nodeEls.forEach(function (e) {
      e.g.setAttribute('transform', 'translate(' + e.node.x + ',' + e.node.y + ')');
    });
  }
  tickRender();
  fitView();

  root.appendChild(svg);

  /* ---------- 7. 拖动（无 rAF，松手持久化） ---------- */
  var dragging = null;
  function getPt(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var ctm = world.getScreenCTM();
    if (!ctm) return null;
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  nodeEls.forEach(function (e) {
    // 点击与拖动的区分：累计位移超过阈值才算拖动，避免手部微抖挡住点击跳转
    var downPt = null, movedFar = false;
    e.g.addEventListener('pointerdown', function (evt) {
      if (evt.button !== undefined && evt.button !== 0) return;
      evt.preventDefault();
      e.g.setPointerCapture && (function () { try { e.g.setPointerCapture(evt.pointerId); } catch (err) {} })();
      dragging = e;
      downPt = { x: evt.clientX, y: evt.clientY };
      movedFar = false;
      e.node.fx = e.node.x; e.node.fy = e.node.y;
    });
    e.g.addEventListener('pointermove', function (evt) {
      if (downPt && Math.hypot(evt.clientX - downPt.x, evt.clientY - downPt.y) > 4) movedFar = true;
      if (dragging !== e) return;
      var p = getPt(evt);
      if (!p) return;
      e.node.fx = p.x; e.node.fy = p.y;
      e.node.x = p.x; e.node.y = p.y;
      // 跑足够多 tick 让连接的节点被吸引/排斥而跟随（vis2 同款物理效果）。
      // 只设 alpha + 手动 tick：绝不调 restart()，避免 d3 内部 rAF 定时器。
      sim.alpha(0.3);
      for (var k = 0; k < 22; k++) sim.tick();
      sim.stop();
      tickRender();
    });
    function endDrag(evt) {
      if (dragging !== e) { downPt = null; return; }
      dragging = null;
      var wasClick = !movedFar;
      downPt = null;
      // 松手解除固定，让邻接点围绕最终位置松弛几轮再持久化
      e.node.fx = null; e.node.fy = null;
      sim.alpha(0.3);
      for (var k = 0; k < 40; k++) sim.tick();
      sim.stop();
      var pos = {};
      nodes.forEach(function (n) { pos[n.id] = { x: n.x, y: n.y }; });
      savePos(pos);
      tickRender();
      // 纯点击（未拖远）：跳转该节点路由
      if (wasClick && evt && evt.type === 'pointerup' && e.node.route) {
        window.location.href = e.node.route;
      }
    }
    e.g.addEventListener('pointerup', endDrag);
    e.g.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', function () {
      // 拖动中途窗口失焦：按松手处理，避免节点卡在 fx/fy 钉死状态
      if (dragging === e) endDrag(null);
    });
  });

  /* ---------- 8. 工具栏：重置位置 / 适应窗口 / 进入图谱页 ---------- */
  var bar = document.createElement('div');
  bar.className = 'hkg-bar';
  bar.innerHTML =
    '<span class="hkg-stats">' + tr(L.stats, { n: nodes.length, l: links.length }) + '</span>' +
    '<button type="button" class="hkg-btn" data-act="fit">' + L.fit + '</button>' +
    '<button type="button" class="hkg-btn" data-act="reset">' + L.reset + '</button>' +
    '<a class="hkg-btn hkg-btn--link" href="graph.html">' + L.open + '</a>';
  // 工具栏放在 stage 之外（与 .home-kg__hint 一样作为 .home-kg 的普通流子元素），
  // 否则会溢出固定高 stage、与提示文字重叠
  root.parentNode.insertBefore(bar, root.nextSibling);

  bar.addEventListener('click', function (evt) {
    var act = evt.target && evt.target.dataset && evt.target.dataset.act;
    if (act === 'fit') {
      // 只重新缩放/平移视口以容纳所有节点，不改动节点位置
      sim.alpha(0.08);
      for (var k = 0; k < 20; k++) sim.tick();
      sim.stop();
      tickRender(); fitView();
    } else if (act === 'reset') {
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      nodes.forEach(function (n) { n.fx = null; n.fy = null; n.x = W/2; n.y = H/2; });
      sim.alpha(1);
      for (var k = 0; k < 320; k++) sim.tick();
      sim.stop();
      tickRender(); fitView();
    }
  });

  /* ---------- 9. 响应式：重算 fit ---------- */
  var ro = new ResizeObserver(function () { fitView(); });
  ro.observe(root);

  /* 主题切换：颜色令牌写在表现属性 var() 上，浏览器自动重算，无需处理；
     theme.js 派发的是 document 上的 'themechange'（不是 window 的 colorschemechange） */
  document.addEventListener('themechange', function () { tickRender(); });
})();
