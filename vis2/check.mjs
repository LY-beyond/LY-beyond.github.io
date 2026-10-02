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
 * 不联网、不写文件、毫秒级返回。
 * ========================================================= */
import { readFileSync, existsSync } from 'node:fs';

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

/* ---------- 输出 ---------- */
warns.forEach((w) => console.log('⚠  ' + w));
if (fails.length) {
  fails.forEach((f) => console.log('✗  ' + f));
  console.log(`\n失败 ${fails.length} 项`);
  process.exit(1);
}
console.log(`✓ 全部通过（i18n 键 ${zhKeys.size} 个 / 挂载点 ${mounts.size} 个 / 容器 id ${ids.size} 个）`);
