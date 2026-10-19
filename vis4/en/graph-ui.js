// =========================================================
// graph-ui.js —— English UI strings for the knowledge-graph engine
// ---------------------------------------------------------
// graph.js ships a built-in Chinese T table; when this file is loaded before
// the engine, window.KG_UI overrides every string below (1:1 with the T table,
// same 38 keys — one less would leak the Chinese fallback, one more is dead weight).
// Load order on the page: graph-ui.js → graph-data.js → ../graph.js
// Plain script on purpose (not an ES module) so file:// double-click works too.
// =========================================================
window.KG_UI = {
  ariaStage: 'Course knowledge graph interactive area',
  ariaGraph: 'Course knowledge graph: nodes are chapters, sections, key points, cases or datasets; links are part-of, prerequisite or used-in relations',
  btnBack: '← Back',
  btnOverview: '⌂ Overview',
  btnFull: '🗺 Full graph',
  btnZoomIn: 'Zoom in',
  btnZoomOut: 'Zoom out',
  btnFit: 'Fit to window',
  btnExport: '⬇ Export PNG',
  btnModeGraph: '🕸 Graph',
  btnModeList: '☰ Table',
  stats: '{nodes} nodes · {links} links',
  legend: 'Relation legend',
  filterTitle: 'Filter by category',
  filterAll: 'All',
  hint: 'Press and hold a node to drag it freely (it stops where released, and the position is remembered) · hover to highlight neighbors · scroll to zoom · drag empty space to pan · clicking a node does not navigate — use the side panel instead',
  listHead: 'Node list of the current view',
  listHint: 'The table view is easy to browse with a keyboard or a screen reader, and is the most efficient entry point on phones; clicking a node never navigates — all actions live in the side-panel buttons.',
  colNode: 'Node',
  colCat: 'Category',
  colDeg: 'Links',
  colAct: 'Action',
  fullTitle: 'Complete graph',
  dataError: 'Failed to load the graph data: make sure graph-data.js is loaded on this page.',
  d3Error: 'd3-force is not loaded: make sure the four files d3-quadtree / d3-dispatch / d3-timer / d3-force under vendor/ are included in this order.',
  exported: 'PNG exported',
  exportFailed: 'Export failed — take a screenshot instead',
  a11yView: 'Current view: {title}, {nodes} nodes',
  detailHead: 'Node details',
  detailEmpty: 'Click "Select" in the table below and this panel will show the relations and actions available for that node.',
  detailDeg: '{n} links',
  detailAnd: ' · ',
  btnDrill: 'Expand this module',
  btnGo: 'Open this section',
  btnClear: 'Clear selection',
  selBtn: 'Select',
  selected: 'Selected: {name}',
  listSelect: 'Select',
};
