/* =========================================================
 * check.mjs —— 零依赖静态自检
 * ---------------------------------------------------------
 * 跑法：node check.mjs
 * 检查项：
 *   ① i18n.js 里 zh / en 两张表的键完全一致
 *   ② index.html 里用到的 data-i18n / data-i18n-attr 键都存在
 *   ③ app.js 里 cardHead/cardFoot 用到的挂载点都在 index.html 里
 *   ④ app.js 里 $('#id') / $('.class') 用到的选择器都能在 HTML 里找到
 *   ⑤ data.js 把数据读成对象来检查：双语叶子齐全、sim.model 是函数、sensitivity 配置在
 *      （数据是 data/*.csv 生成的产物，所以只读对象、不依赖源码排版）
 *   ⑥ vendor/ 里脚本齐全，且 index.html 按依赖顺序引用
 *   ⑦ 新增图型：地图几何与数据键双向对齐、五个新引擎已导出、
 *      热力矩阵 15×5 每行都不缺列、小倍数 3×7 且 2024 端点与产业表一致、
 *      地图 34 行 / 全球 12 行且降序 / 图谱 21 节点 36 边且连线端点存在 / 模拟器 4 滑块 3 预设
 *   ⑧ app.js 里 T('key') 用到的词表键都存在
 *   ⑨ 需要「数据与 CSV 是否一致」时看 `node data/build.mjs --check`（selfcheck.mjs 已包含）
 * 末尾打印 `SUMMARY script=check.mjs checks=N failed=M`，供 selfcheck.mjs 汇总。
 * 不联网、不写文件、毫秒级返回。
 * ========================================================= */
import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = (f) => readFileSync(new URL('./' + f, import.meta.url), 'utf8');
const fails = [];
const warns = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };

const html = read('index.html');
const app = read('app.js');
const i18n = read('i18n.js');
const data = read('data.js');
const charts = read('charts.js');

/* ---------- ① 中英词表键一致 ---------- */
const dict = i18n.slice(i18n.indexOf('var DICT'));
const zhBlock = dict.split(/^\s{4}zh:\s*\{/m)[1].split(/^\s{4}en:/m)[0];
const enBlock = dict.split(/^\s{4}en:\s*\{/m)[1];
const keysOf = (src) => {
  const set = new Set();
  const re = /^\s*'([^']+)':/gm;
  let m;
  while ((m = re.exec(src))) set.add(m[1]);
  return set;
};
const zhKeys = keysOf(zhBlock);
const enKeys = keysOf(enBlock);
[...zhKeys].forEach((k) => ok(enKeys.has(k), `i18n: en 表缺少键 '${k}'`));
[...enKeys].forEach((k) => ok(zhKeys.has(k), `i18n: zh 表缺少键 '${k}'`));
ok(zhKeys.size > 20, `i18n: zh 表只解析到 ${zhKeys.size} 个键，DICT 结构可能变了`);

/* ---------- ② HTML 里的 i18n 键都存在 ---------- */
const usedKeys = new Set();
for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
  m[1].split(',').forEach((pair) => {
    const k = pair.split(':')[1];
    if (k) usedKeys.add(k.trim());
  });
}
for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) usedKeys.add(m[1].trim());
[...usedKeys].forEach((k) => ok(zhKeys.has(k), `index.html: data-i18n 键 '${k}' 在 i18n.js 里不存在`));

/* ---------- ③ 图表卡片的挂载点 ---------- */
const cardNames = new Set();
for (const m of app.matchAll(/card(?:Head|Foot)\('([a-zA-Z]+)'/g)) cardNames.add(m[1]);
for (const m of app.matchAll(/mount\('([a-zA-Z-]+)'\)/g)) cardNames.add(m[1].replace(/-head$|-foot$/, ''));
const mounts = new Set([...html.matchAll(/data-mount="([^"]+)"/g)].map((m) => m[1]));
[...cardNames].forEach((n) => {
  ok(mounts.has(n + '-head'), `index.html: 缺少挂载点 data-mount="${n}-head"`);
});
[...mounts].forEach((m) => {
  ok(cardNames.has(m.replace(/-head|-foot$/, '')), `index.html: 挂载点 data-mount="${m}" 没有任何脚本写入`);
});

/* ---------- ④ 选择器 ---------- */
const ids = new Set([...app.matchAll(/\$\('#([\w-]+)'\)/g)].map((m) => m[1]));
[...ids].forEach((id) => ok(html.includes(`id="${id}"`), `index.html: 缺少 id="${id}"`));
const classes = new Set([...app.matchAll(/\$\$?\('\.([\w-]+)'/g)].map((m) => m[1]));
[...classes].forEach((c) => {
  if (c === 'nav-link' || c === 'topbar' || c === 'lang-switch-item') return; /* 由别的脚本/样式表提供 */
  ok(html.includes(`class="${c}`) || html.includes(c), `index.html: 选择器 .${c} 找不到`);
});

/* ---------- ⑤ data.js：把数据真正读出来检查（不依赖源码排版） ---------- */
/* 数据现在是构建产物（data/*.csv → data.js），排版会变，所以检查一律读对象；
   源码文本只用来做「键名/挂载点」这类结构检查。 */
function loadData() {
  const sandbox = {
    window: {}, console,
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), body: {}, readyState: 'complete' },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: {}, setTimeout, clearTimeout, addEventListener() {}, dispatchEvent() {}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  runInContext(data, createContext(sandbox), { filename: 'data.js' });
  return sandbox.AI_DATA;
}
const DATA = loadData();
ok(!!DATA, 'data.js: 没有导出 window.AI_DATA');
const biLeaves = [];
(function walkBi(o, p) {
  if (o == null || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((v, i) => walkBi(v, p + '[' + i + ']')); return; }
  if ('zh' in o && 'en' in o) { biLeaves.push(p); return; }
  for (const k of Object.keys(o)) walkBi(o[k], p ? p + '.' + k : k);
})(DATA, '');
warns.push(`data.js 双语叶子：${biLeaves.length} 个（每个都有 zh / en 两侧）`);
ok(biLeaves.length > 300, `data.js: 只读到 ${biLeaves.length} 个双语叶子，数据可能没加载成功`);
ok(typeof DATA.sim.model === 'function', 'data.js: 缺少 sim.model 函数（模拟器模型）');
ok(!!DATA.sim.sensitivity, 'data.js: 缺少 sim.sensitivity 定义');
ok(typeof DATA.sim.sensitivity.draws === 'number' && typeof DATA.sim.sensitivity.perturb === 'number',
  'data.js: sim.sensitivity 应含 draws / perturb 两个数值配置');

/* ---------- ⑥ vendor 与脚本顺序 ---------- */
const vendor = ['d3-dispatch.min.js', 'd3-selection.min.js', 'd3-quadtree.min.js', 'd3-timer.min.js', 'd3-force.min.js'];
vendor.forEach((f) => ok(existsSync(new URL('./vendor/' + f, import.meta.url)), `vendor/${f} 不存在`));
let last = -1;
vendor.forEach((f, i) => {
  const at = html.indexOf(f);
  ok(at > -1, `index.html: 未引用 vendor/${f}`);
  if (at > -1) { ok(at > last, `index.html: vendor/${f} 的引用顺序不对（应在第 ${i + 1} 位）`); last = at; }
});
['data.js', 'charts.js', 'app.js'].forEach((f) => {
  const at = html.indexOf(`<script src="${f}"`);
  ok(at > -1, `index.html: 未引用 ${f}`);
});

/* ---------- ⑦ charts.js 用了 selection API 时必须加载 d3-selection ---------- */
if (/\.selectAll\(|d3\.select\(/.test(charts)) {
  ok(html.includes('d3-selection.min.js'), 'charts.js 使用了 d3-selection，但 index.html 未加载它');
}

/* ---------- ⑧ B 档新增图型（地图 / 热力矩阵 / 小倍数 / 敏感性） ---------- */
/* 地图几何必须先于 charts.js 加载，否则首帧画不出地图 */
const geoAt = html.indexOf('<script src="map-china.js"');
ok(geoAt > -1, 'index.html: 未引用 map-china.js（省级地图几何）');
ok(geoAt > -1 && geoAt > html.indexOf('<script src="data.js"') && geoAt < html.indexOf('<script src="charts.js"'),
  'index.html: map-china.js 应在 data.js 之后、charts.js 之前');

const mapFile = new URL('./map-china.js', import.meta.url);
ok(existsSync(mapFile), 'map-china.js 不存在（跑 node ../_map.mjs 生成）');

/* 把几何真正读出来检查：坐标出现 NaN 时地图会整块消失，必须在静态检查里拦住 */
let CN_MAP = null;
if (existsSync(mapFile)) {
  const ctx = createContext({ window: {} });
  runInContext(readFileSync(mapFile, 'utf8'), ctx);
  CN_MAP = ctx.window.CN_MAP;
}
ok(!!CN_MAP, 'map-china.js: 没有导出 window.CN_MAP');
if (CN_MAP) {
  const provinces = CN_MAP.provinces || [];
  ok(provinces.length === 34, `map-china.js: 省级单元应为 34 个，实际 ${provinces.length}`);
  ok(provinces.every((p) => (p.polys || []).length > 0), 'map-china.js: 有省级单元没有多边形');
  const flat = [];
  provinces.forEach((p) => p.polys.forEach((ring) => flat.push(ring)));
  (CN_MAP.inset ? (CN_MAP.inset.dots || []).concat(CN_MAP.inset.lines || []) : []).forEach((r) => flat.push(r));
  const badPts = flat.filter((r) => r.length < 6 || r.length % 2 || r.some((v) => !isFinite(v)));
  ok(badPts.length === 0, `map-china.js: ${badPts.length} 个环点数不足或含 NaN（重新跑 _map.mjs）`);
  ok(!!CN_MAP.inset && (CN_MAP.inset.dots || []).length > 0, 'map-china.js: 缺少南海诸岛插图几何');
}

/* 数据键 === 几何键：少一个省地图上就会出现「有轮廓没颜色」，多一个键则永远画不出来 */
const provinceRows = (DATA.province && DATA.province.rows) || [];
const dataIds = new Set(provinceRows.map((r) => r.id));
if (CN_MAP) {
  const geoIds = new Set(CN_MAP.provinces.map((p) => p.id));
  [...geoIds].forEach((id) => ok(dataIds.has(id), `data.js province.rows 缺少几何 id ${id}`));
  [...dataIds].forEach((id) => ok(geoIds.has(id), `map-china.js 缺少 data.js 里的 id ${id}`));
}

/* 五个新引擎必须真的导出（app.js 会直接调用） */
['choropleth', 'heatmap', 'smallMultiples', 'tornado', 'monteCarlo'].forEach((fn) => {
  ok(new RegExp('\\b' + fn + ':\\s*' + fn + ',').test(charts), `charts.js: 未导出 ${fn}（app.js 会调用）`);
});

/* 热力矩阵：每一行都要有全部 5 列；小倍数：三条序列长度一致（读对象，不看排版） */
const heatMetrics = (DATA.heatmap && DATA.heatmap.metrics) || [];
ok(heatMetrics.length === 5, `data.js heatmap.metrics 应为 5 列，实际 ${heatMetrics.length}`);
const heatRows = (DATA.heatmap && DATA.heatmap.rows) || [];
ok(heatRows.length === 15, `data.js heatmap.rows 应为 15 行，实际 ${heatRows.length}`);
const heatIds = new Set(heatMetrics.map((m) => m.id));
const heatMiss = heatRows.filter((r) => [...heatIds].some((id) => !(id in r)));
ok(heatMiss.length === 0, `data.js heatmap.rows 有 ${heatMiss.length} 行缺列（每行都要有 ${[...heatIds].join('/')}）`);

const multiSeries = (DATA.multiples && DATA.multiples.series) || [];
ok(multiSeries.length === 3, `data.js multiples.series 应为 3 条（三次产业），实际 ${multiSeries.length}`);
multiSeries.forEach((s) => {
  ok(s.penetration.length === 7 && s.gain.length === 7,
    `data.js multiples[${s.id}]: 序列长度应为 7 年，实际 ${s.penetration.length}/${s.gain.length}`);
});
/* 跨图一致性：小倍数 2024 年的端点必须与三次产业条形图完全一致（页面上写着这条承诺） */
const sectorById = {};
((DATA.industry && DATA.industry.rows) || []).forEach((r) => { sectorById[r.id] = r; });
multiSeries.forEach((s) => {
  const row = sectorById[s.id];
  if (!row) { ok(false, `data.js: multiples 里的产业 ${s.id} 在 industry.rows 里找不到`); return; }
  ok(s.penetration[5] === row.penetration && s.gain[5] === row.gain,
    `data.js: ${s.id} 的 2024 端点与 industry.rows 不一致（${s.penetration[5]}/${s.gain[5]} ≠ ${row.penetration}/${row.gain}）`);
});
/* 跨图联动（P2）：年份播放器用「下标」驱动小倍数图的高亮列，
   所以两边的年份序列必须等长、逐年一一对应 —— 哪天有一边加/减了一年，这里必须立刻失败。 */
const scaleSeries = (DATA.scale && DATA.scale.series) || [];
ok(scaleSeries.length === 7 && scaleSeries[0].year === 2019 && scaleSeries[6].year === 2025,
  `data.js scale.series 应为 2019–2025 共 7 个点，实际 ${scaleSeries.length}（${scaleSeries[0] && scaleSeries[0].year}–${scaleSeries[scaleSeries.length - 1] && scaleSeries[scaleSeries.length - 1].year}）`);
ok(multiSeries.every((s) => s.penetration.length === scaleSeries.length),
  'data.js: 年份播放器（scale.series）与小倍数图必须等长，否则跨图高亮会错位');
/* 地图：34 个省级单元 + 两个指标（与几何 id 的对齐在上面已查） */
ok(provinceRows.length === 34, `data.js province.rows 应为 34 行，实际 ${provinceRows.length}`);
ok(((DATA.province && DATA.province.metrics) || []).length === 2, 'data.js province.metrics 应为 2 个（算力 / 企业数）');
/* 全球排名：12 个经济体，数值降序（页面承诺「排名」） */
const gRows = (DATA.globalRank && DATA.globalRank.rows) || [];
ok(gRows.length === 12, `data.js globalRank.rows 应为 12 行，实际 ${gRows.length}`);
ok(gRows.every((r, i) => i === 0 || gRows[i - 1].value >= r.value), 'data.js globalRank.rows 应按数值降序排列');
/* 图谱：21 个节点 / 36 条边，且每条边的两端都能找到节点 */
const gNodes = (DATA.graph && DATA.graph.nodes) || [];
const gLinks = (DATA.graph && DATA.graph.links) || [];
ok(gNodes.length === 21 && gLinks.length === 36, `data.js graph: 应为 21 节点 / 36 边，实际 ${gNodes.length} / ${gLinks.length}`);
const nodeIds = new Set(gNodes.map((n) => n.id));
ok(gLinks.every((l) => nodeIds.has(l.s) && nodeIds.has(l.t)), 'data.js graph.links: 有连线的端点找不到节点');
/* 模拟器：四个滑块 / 三套预设（预设必须给全四个键） */
const sliders = (DATA.sim && DATA.sim.sliders) || [];
ok(sliders.length === 4, `data.js sim.sliders 应为 4 个，实际 ${sliders.length}`);
((DATA.sim && DATA.sim.presets) || []).forEach((p) => {
  sliders.forEach((s) => ok(p.values[s.id] != null, `data.js sim.presets['${p.id}'] 缺少滑块 ${s.id} 的取值`));
});

/* app.js 里 T('key') / TT('key') 用到的键都必须存在（手滑打错键名会显示成裸 key） */
const tKeys = new Set();
/* T('prov.' + prov) 这类拼接键拿不到字面量（那一支在下面单独核对），这里跳过以「.」结尾的残片 */
for (const m of app.matchAll(/T{1,2}\('([\w.]+)'/g)) if (!m[1].endsWith('.')) tKeys.add(m[1]);
[...tKeys].forEach((k) => ok(zhKeys.has(k), `app.js: T('${k}') 在 i18n.js 里没有对应键`));


/* ---------- ⑨ 口径标注（P2）：每张图一枚徽章，值必须合法且覆盖全部卡片 ---------- */
/* 徽章文字 = 词表里的 prov.sourced / modeled / projected，取值只有这三种（见 data/README.md）。 */
const PROV_KINDS = ['sourced', 'modeled', 'projected'];
const PROV = (DATA.provenance) || {};
const provBad = Object.keys(PROV).filter((k) => PROV_KINDS.indexOf(PROV[k]) === -1);
ok(provBad.length === 0, `data.js provenance: ${provBad.length} 处取值不合法（应为 ${PROV_KINDS.join(' / ')}）—— 见 data/manifest.json`);
/* cardHead(name, caption, provKey) 的第三个参数就是要查的口径键：
   写错 / 漏登记时页面会静默地少一枚徽章，所以静态就把它拦下来。 */
const provRefs = [...app.matchAll(/cardHead\('[a-z]+',\s*[^;]*?,\s*'([A-Za-z]+)'\)/g)].map((m) => m[1]);
const provMiss = [...new Set(provRefs)].filter((k) => !PROV[k]);
ok(provMiss.length === 0, `app.js: cardHead 引用了没有登记口径的键 '${provMiss.join("', '")}'（在 data/manifest.json 里补 provenance）`);
ok(provRefs.length >= 17, `app.js: 只有 ${provRefs.length} 处 cardHead 带口径徽章，应覆盖 17 张卡片（13 张图 + 模拟器 + 2 张敏感性 + 时间线 + 场景 + 来源）`);
/* 徽章文字与悬停说明都从词表取：T('prov.' + prov) 是拼接键，静态脚本拿不到字面量，这里逐条点名 */
PROV_KINDS.concat(['list', 'rule']).forEach((k) =>
  ok(zhKeys.has('prov.' + k), `i18n.js: 缺少词条 prov.${k}（口径徽章的文字 / 悬停说明 / 规则列出处的出处）`));

/* ---------- ⑩ 时间线的键盘路径（P3）---------- */
/* 10 个节点只允许一个 Tab 停点：容器上 tabindex + 方向键，焦点环由 charts.js 的 focusIndex 移动。
   charts.js 里出现 tabindex 就说明有人又给图元逐个挂了停点（README 里专门解释过为什么不这么做）。 */
ok(/ctx\.focusIndex\s*=/.test(charts) && /bindTimelineKeys\(host, rail/.test(app),
  'app.js / charts.js: 时间线的键盘路径不见了（charts.js 的 ctx.focusIndex + app.js 的 bindTimelineKeys）');
ok(!/setAttribute\('tabindex'|\.tabIndex\s*=/.test(charts), 'charts.js: 图形里不该出现 tabindex —— 键盘停点只留在容器上（见 README「为什么不给每个图元加 tabindex」）');
ok(/setAttribute\('aria-describedby', hintId\)/.test(app) && /mount\('timeline-head'\)/.test(app),
  'app.js: 时间线的键盘提示（aria-describedby → 提示段落）不见了，方向键会变成没人知道的隐藏功能');


/* ---------- 输出 ---------- */
warns.forEach((w) => console.log('⚠  ' + w));
if (fails.length) {
  fails.forEach((f) => console.log('✗  ' + f));
  console.log(`\n失败 ${fails.length} 项`);
  console.log(`\n===== SUMMARY script=check.mjs checks=${checks} failed=${fails.length} =====`);
  process.exit(1);
}
console.log(`✓ 全部通过（i18n 键 ${zhKeys.size} 个 / 挂载点 ${mounts.size} 个 / 容器 id ${ids.size} 个 / 双语叶子 ${biLeaves.length} 个）`);
console.log(`\n===== SUMMARY script=check.mjs checks=${checks} failed=0 =====`);
