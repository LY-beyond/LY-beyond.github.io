/* =========================================================
 * budget-check.mjs —— 体积预算 / 零联网承诺体检
 * ---------------------------------------------------------
 * 跑法：node budget-check.mjs
 * 检查项：
 *   ① 传输体积（gzip，node:zlib 现算）：全站总量、每个文件、vendor 合计、四份 CSS 合计
 *      —— 读的是「用户真实要下载多少字节」，不是磁盘上的原始大小
 *   ② 请求数：index.html 一共发多少个请求（HTML + CSS + JS + 图标），逐条列出
 *   ③ 零联网承诺：全站不得出现 fetch / XMLHttpRequest / 动态 import / @import /
 *      url(http…) / 外链资源标签 —— 断网或 file:// 打开也必须完整可用
 *   ④ 无构建承诺：不得出现 type="module"（file:// 下会被 CORS 拦掉）
 *   ⑤ 数据摊销：每条数据记录 / 每个几何点平均占多少传输字节
 *   ⑥ README「复杂度清单」里的数字必须与实测一致（数字会过期，脚本会拦下来）
 *
 * 纯静态：不联网、不开浏览器、毫秒级返回。
 * ========================================================= */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(join(HERE, f), 'utf8');
const bytes = (f) => statSync(join(HERE, f)).size;
const gz = (f) => gzipSync(readFileSync(join(HERE, f)), { level: 9 }).length;

const problems = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) problems.push(msg); };
const KB = (n) => (n / 1024).toFixed(1) + ' KB';

/* ---------------- 站点文件（部署目录里真正会被下载的东西） ---------------- */
const HTML = 'index.html';
const css = ['tokens.css', 'styles.css', 'theme.css', 'i18n.css'];
const js = ['theme.js', 'i18n.js', 'data.js', 'map-china.js', 'charts.js', 'app.js'];
const vendor = ['vendor/d3-dispatch.min.js', 'vendor/d3-selection.min.js', 'vendor/d3-quadtree.min.js',
  'vendor/d3-timer.min.js', 'vendor/d3-force.min.js'];
const assets = [HTML, ...css, ...js, ...vendor, 'favicon.svg'];

/* 预算：定在「当前值上浮一成」上下 —— 既拦得住意外膨胀，也不会天天报警 */
const BUDGET = [
  { what: '全站合计（gzip）', files: assets, max: 130 * 1024, why: '17 个文件全部下载完成的总字节' },
  { what: '手写 JS（gzip）', files: js.filter((f) => f !== 'map-china.js'), max: 95 * 1024, why: 'app / charts / data / i18n / theme' },
  { what: 'charts.js（gzip）', files: ['charts.js'], max: 30 * 1024, why: '14 个自绘 SVG 引擎' },
  { what: 'data.js（gzip）', files: ['data.js'], max: 22 * 1024, why: '全站数据与双语文案' },
  { what: 'map-china.js（gzip）', files: ['map-china.js'], max: 14 * 1024, why: '省级边界（抽稀后的静态几何）' },
  { what: 'CSS 合计（gzip）', files: css, max: 16 * 1024, why: '设计令牌 + 布局 + 主题 + 语言微调' },
  { what: 'vendor 合计（gzip）', files: vendor, max: 12 * 1024, why: '5 个 d3 子模块（力导向图用）' },
  { what: '单文件最大（gzip）', files: assets, max: 30 * 1024, mode: 'max', why: '任何单个文件都不该拖慢首屏' }
];

console.log('体积预算（gzip，第 9 级压缩）：');
for (const b of BUDGET) {
  const sizes = b.files.map(gz);
  const total = b.mode === 'max' ? Math.max(...sizes) : sizes.reduce((s, n) => s + n, 0);
  const pass = total <= b.max;
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${b.what.padEnd(20, '　')} ${KB(total).padStart(9)} / ${KB(b.max).padStart(9)}   ${b.why}`);
  ok(pass, `${b.what} 已到 ${KB(total)}，超过预算 ${KB(b.max)}（${b.why}）—— 要么瘦身，要么在 BUDGET 里写明理由再上调`);
}

/* 逐文件明细：磁盘大小 → 传输大小 */
console.log('\n逐文件（磁盘 → gzip）：');
let rawAll = 0, gzAll = 0;
for (const f of assets) {
  const r = bytes(f), g = gz(f);
  rawAll += r; gzAll += g;
  console.log(`  ${f.padEnd(28)} ${KB(r).padStart(9)} → ${KB(g).padStart(9)}   （省 ${(100 - (g / r) * 100).toFixed(0)}%）`);
}
console.log(`  ${'合计'.padEnd(26)} ${KB(rawAll).padStart(9)} → ${KB(gzAll).padStart(9)}`);


/* ---------------- 请求数 ---------------- */
const html = read(HTML);
const reqs = [
  ...[...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => ({ kind: 'script', href: m[1] })),
  ...[...html.matchAll(/<link[^>]*\shref="([^"]+)"/g)].map((m) => ({ kind: 'link', href: m[1] })),
  ...[...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => ({ kind: 'img', href: m[1] }))
];
console.log(`\n请求数：index.html 自身 1 个 + 资源 ${reqs.length} 个 = ${reqs.length + 1} 个`);
ok(reqs.length + 1 <= 22, `首屏请求数 ${reqs.length + 1} 个，超过 22 个的预算（每多一个请求都是一次往返）`);
for (const r of reqs) ok(existsSync(join(HERE, r.href)), `index.html 引用的 ${r.href} 不存在`);

/* ---------------- 零联网 / 无构建承诺 ---------------- */
const siteCode = [HTML, ...css, ...js, ...vendor].map((f) => ({ f, src: read(f) }));
const NET_PATTERNS = [
  [/\bfetch\s*\(/, 'fetch('],
  [/new\s+XMLHttpRequest/, 'XMLHttpRequest'],
  [/\bimport\s*\(/, '动态 import()'],
  [/@import\b/, '@import'],
  [/url\(\s*['"]?https?:/i, 'CSS url(http…)'],
  [/<(?:script|img|link|iframe)[^>]*(?:src|href)="https?:/i, '外链资源标签']
];
for (const { f, src } of siteCode) {
  for (const [re, what] of NET_PATTERNS) {
    ok(!re.test(src), `${f}: 出现 ${what} —— 与「零联网」的承诺冲突（断网 / file:// 会失效）`);
  }
}
ok(!/type="module"/.test(html), 'index.html: 出现 type="module"（file:// 下会被 CORS 拦掉，双击打开就白屏）');

/* ---------------- 数据摊销 ---------------- */
const sandbox = {
  window: {}, console,
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), body: {}, readyState: 'complete' },
  localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }),
  navigator: {}, setTimeout, clearTimeout, addEventListener() {}, dispatchEvent() {}
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
runInContext(read('data.js'), createContext(sandbox));
const DATA = sandbox.AI_DATA;
const arrays = [];
(function walk(o, p) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { arrays.push({ path: p, n: o.length }); return; }
  if ('zh' in o && 'en' in o) return;
  for (const k of Object.keys(o)) walk(o[k], p ? p + '.' + k : k);
})(DATA, '');
const records = arrays.reduce((s, a) => s + a.n, 0);
const geoPts = (read('map-china.js').match(/-?\d+(?:\.\d+)?/g) || []).length;
console.log(`\n数据摊销：${arrays.length} 个数组 / ${records} 条记录 → data.js gzip ${KB(gz('data.js'))}（约 ${(gz('data.js') / records).toFixed(0)} B/条）`);
console.log(`几何摊销：省级边界 ${geoPts} 个数值 → gzip ${KB(gz('map-china.js'))}（约 ${(gz('map-china.js') / geoPts).toFixed(2)} B/数值）`);
ok(gz('data.js') / records < 90, `data.js 每条记录摊销 ${(gz('data.js') / records).toFixed(0)} B，超过 90 B/条`);


/* ---------------- README 的「复杂度清单」不许过期 ---------------- */
const readme = read('README.md');
const i18n = read('i18n.js');
const dict = i18n.slice(i18n.indexOf('var DICT'));
const zhKeys = (dict.split(/^\s{4}zh:\s*\{/m)[1].split(/^\s{4}en:/m)[0].match(/^\s*'([^']+)':/gm) || []).length;
let biLeaves = 0;
(function walkBi(o) {
  if (o == null || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(walkBi); return; }
  if ('zh' in o && 'en' in o) { biLeaves++; return; }
  for (const k of Object.keys(o)) walkBi(o[k]);
})(DATA);
const auditWidthList = (read('audit.mjs').match(/const WIDTHS = \[([^\]]+)\]/) || [])[1];
const widths = auditWidthList ? auditWidthList.split(',').length : 0;
const sections = (html.match(/<section class="section" id="/g) || []).length;
const chartHosts = (html.match(/id="(chart-[\w-]+|sim-root)"/g) || []).length;
const scripts = ['check.mjs', 'link-check.mjs', 'parity-check.mjs', 'a11y-check.mjs',
  'budget-check.mjs', 'audit.mjs', 'smoke.mjs', 'selfcheck.mjs'];

const CLAIMS = [
  ['章节', sections],
  ['图表', chartHosts],
  ['自检脚本', scripts.filter((f) => existsSync(join(HERE, f))).length],
  ['i18n 词条', zhKeys],
  ['双语文案', biLeaves],
  ['站点体积', Math.round(gzAll / 1024)],
  ['覆盖视口', widths],
  ['数据记录', records]
];
console.log('\nREADME「复杂度清单」核对：');
for (const [label, actual] of CLAIMS) {
  /* 只在「复杂度清单」表格里找：行首第一格就是标签，第二格是数字（避免命中正文里的同名表头） */
  const cell = readme.match(new RegExp('^\\|\\s*' + label + '\\s*\\|\\s*(\\d+)', 'm'));
  const shown = cell ? Number(cell[1]) : NaN;
  const pass = shown === actual;
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${label.padEnd(9, '　')} README ${isNaN(shown) ? '（未找到该行）' : shown} ↔ 实测 ${actual}`);
  if (!pass) ok(false, `README 复杂度清单里「${label}」写的是 ${isNaN(shown) ? '（没找到这一行）' : shown}，实测 ${actual} —— 改了内容就要同步这张表`);
  else checks++;
}
ok(scripts.every((f) => existsSync(join(HERE, f))), `自检脚本不齐：缺少 ${scripts.filter((f) => !existsSync(join(HERE, f))).join(', ')}`);
ok(existsSync(join(HERE, 'data', 'build.mjs')), 'data/build.mjs 不存在（数据链路：CSV → data.js）');
const strayShots = readdirSync(HERE).filter((f) => /\.png$/i.test(f));
ok(strayShots.length === 0, `部署目录里残留截图/证据文件：${strayShots.join(', ')}`);

/* ---------------- 输出 ---------------- */
if (problems.length) {
  problems.forEach((p) => console.log('✗  ' + p));
  console.log(`\n===== SUMMARY script=budget-check.mjs checks=${checks} failed=${problems.length} =====`);
  process.exit(1);
}
console.log(`\n✓ 全站 ${assets.length} 个文件 / 传输 ${KB(gzAll)}（gzip 第 9 级）/ ${reqs.length + 1} 个请求 / 零联网 / 无构建`);
console.log(`✓ README 复杂度清单 ${CLAIMS.length} 项数字与实测一致`);
console.log(`\n===== SUMMARY script=budget-check.mjs checks=${checks} failed=0 =====`);
