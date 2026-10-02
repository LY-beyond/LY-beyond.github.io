/* =========================================================
 * check.mjs —— 零依赖静态自检
 * ---------------------------------------------------------
 * 跑法：node check.mjs
 * 检查项：
 *   ① i18n.js 里 zh / en 两张表的键完全一致
 *   ② index.html 里用到的 data-i18n / data-i18n-attr 键都存在
 *   ③ app.js 里 cardHead/cardFoot 用到的挂载点都在 index.html 里
 *   ④ app.js 里 $('#id') / $('.class') 用到的选择器都能在 HTML 里找到
 *   ⑤ data.js 里每个内容对象的 zh / en 两个字段都在
 *   ⑥ vendor/ 里脚本齐全，且 index.html 按依赖顺序引用
 *   ⑦ 新增图型：地图几何与数据键对齐、五个新引擎已导出、序列长度与列数正确
 *   ⑧ app.js 里 T('key') 用到的词表键都存在
 * 不联网、不写文件、毫秒级返回。
 * ========================================================= */
import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = (f) => readFileSync(new URL('./' + f, import.meta.url), 'utf8');
const fails = [];
const warns = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

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

/* ---------- ⑤ data.js 双语字段 ---------- */
const zhCount = (data.match(/zh:\s*'/g) || []).length;
const enCount = (data.match(/en:\s*'/g) || []).length;
ok(zhCount > 0 && enCount > 0, 'data.js: 未发现 { zh, en } 双语对象');
warns.push(`data.js 双语对象：zh ${zhCount} 处 / en ${enCount} 处${zhCount === enCount ? '（配平）' : '（数量不等，请人工确认是否用了共享常量）'}`);
ok(/model:\s*function/.test(data), 'data.js: 缺少 sim.model 函数（模拟器模型）');
ok(/sim\s*=\s*\{/.test(data), 'data.js: 缺少 sim 定义');

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
const provinceBlock = data.slice(data.indexOf('var province = {'));
const dataIds = new Set([...provinceBlock.matchAll(/id: '(\d{6})'/g)].map((m) => m[1]));
if (CN_MAP) {
  const geoIds = new Set(CN_MAP.provinces.map((p) => p.id));
  [...geoIds].forEach((id) => ok(dataIds.has(id), `data.js province.rows 缺少几何 id ${id}`));
  [...dataIds].forEach((id) => ok(geoIds.has(id), `map-china.js 缺少 data.js 里的 id ${id}`));
}

/* 五个新引擎必须真的导出（app.js 会直接调用） */
['choropleth', 'heatmap', 'smallMultiples', 'tornado', 'monteCarlo'].forEach((fn) => {
  ok(new RegExp('\\b' + fn + ':\\s*' + fn + ',').test(charts), `charts.js: 未导出 ${fn}（app.js 会调用）`);
});

/* 热力矩阵：每一行都要有全部 5 列；小倍数：三条序列长度一致 */
const heatMetrics = [...data.matchAll(/short: \{ zh: '[^']+', en: '[^']+' \}, unit/g)].length;
ok(heatMetrics === 5, `data.js heatmap.metrics 应为 5 列，实际 ${heatMetrics}`);
const multiSeries = (data.match(/penetration: \[[^\]]+\], gain: \[[^\]]+\]/g) || []);
ok(multiSeries.length === 3, `data.js multiples.series 应为 3 条（三次产业），实际 ${multiSeries.length}`);
multiSeries.forEach((s) => {
  const lens = [...s.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].split(',').length);
  ok(lens[0] === 7 && lens[1] === 7, `data.js multiples: 序列长度应为 7 年，实际 ${lens.join('/')}`);
});
ok(/sensitivity:\s*\{/.test(data) && /draws:\s*\d+/.test(data) && /perturb:\s*0?\.\d+/.test(data),
  'data.js: 缺少 sim.sensitivity 的 draws / perturb 配置');

/* app.js 里 T('key') / TT('key') 用到的键都必须存在（手滑打错键名会显示成裸 key） */
const tKeys = new Set();
for (const m of app.matchAll(/T{1,2}\('([\w.]+)'/g)) tKeys.add(m[1]);
[...tKeys].forEach((k) => ok(zhKeys.has(k), `app.js: T('${k}') 在 i18n.js 里没有对应键`));


/* ---------- 输出 ---------- */
warns.forEach((w) => console.log('⚠  ' + w));
if (fails.length) {
  fails.forEach((f) => console.log('✗  ' + f));
  console.log(`\n失败 ${fails.length} 项`);
  process.exit(1);
}
console.log(`✓ 全部通过（i18n 键 ${zhKeys.size} 个 / 挂载点 ${mounts.size} 个 / 容器 id ${ids.size} 个）`);
