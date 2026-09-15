// =========================================================
// en/graph-ui.js —— 知识图谱的英文界面文案（覆盖 graph.js 里的 T 表）
// ---------------------------------------------------------
// 引擎只有一份（../graph.js），界面文案默认中文，这里用 window.KG_UI 覆盖成英文。
// ⚠️ 键必须与 graph.js 里的 T 表**完全一致**（多一个少一个都会被 graph-check.mjs 抓出来），
//    否则页面上会直接露出 [key] 这样的原文。
//
// 图谱的**内容**（章节名、知识点名、描述）不在这里 —— 那些在 en/graph-data.js 里，
// 因为它属于数据，不属于界面文案。
//
// 刻意用「普通 script」而不是 ES Module：file:// 双击打开也能用（同 en/quiz-ui.js）。
// =========================================================
window.KG_UI = {
  ariaStage: 'Course knowledge graph workspace',
  ariaGraph: 'Course knowledge graph: nodes are parts, chapters or concepts; lines are part-of, prerequisite or used-in-case relations',
  btnBack: '← Back',
  btnRoot: '⌂ Overview',
  btnFull: '🗺 Full map',
  btnZoomIn: 'Zoom in',
  btnZoomOut: 'Zoom out',
  btnFit: 'Fit view',
  btnExport: '⬇ Export PNG',
  btnModeGraph: '🕸 Graph',
  btnModeList: '☰ List',
  stats: '{nodes} nodes · {links} relations',
  legend: 'Relation types',
  hint: 'Press and hold a node to drag it freely (it stays where you drop it) · hover to see adjacency · wheel to zoom · drag the background to pan',
  listHead: 'Nodes in this view (links open their pages)',
  listHint: 'The list is easier for keyboard and screen-reader users, and on phones.',
  fullTitle: 'Full graph',
  dataError: 'Failed to load the graph data: make sure graph-data.js is loaded on this page.',
  d3Error: 'd3-force is not loaded: make sure the four files under vendor/ (d3-quadtree, d3-dispatch, d3-timer, d3-force) are included in that order.',
  exported: 'PNG exported',
  exportFailed: 'Export failed — please use a screenshot tool instead',
  a11yView: 'Current view: {title}, {nodes} nodes',
};
