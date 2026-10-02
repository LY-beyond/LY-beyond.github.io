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
 *   ⑦ 文档副本：README / FEATURES / HIGHLIGHTS 里同一批数字（章节 / 图表 / SVG / 词条 /
 *      文案 / 数据集与行列 / 体积 / 代码量）逐个核对 —— 三份文档各写一遍，最容易各自漂移；
 *      断言条数不在这儿对：那是 selfcheck.mjs 算出来的，也由它核对（本文件自己也在被统计的名单里）。
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

/* 递归统计一个目录（文件数 + 磁盘字节）：README「部署目录里另有…」那一段要的就是这个量，
   不写死数字 —— 加一个截图或一个数据文件都会让它过期。 */
const dirStat = (rel) => {
  const out = { files: 0, bytes: 0 };
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(p, e.name));
      else { out.files++; out.bytes += statSync(join(p, e.name)).size; }
    }
  };
  walk(join(HERE, rel));
  return out;
};

/* ---------------- 站点文件（部署目录里真正会被下载的东西） ---------------- */
const HTML = 'index.html';
const css = ['tokens.css', 'styles.css', 'theme.css', 'i18n.css'];
const js = ['theme.js', 'i18n.js', 'data.js', 'map-china.js', 'charts.js', 'app.js'];
const vendor = ['vendor/d3-dispatch.min.js', 'vendor/d3-selection.min.js', 'vendor/d3-quadtree.min.js',
  'vendor/d3-timer.min.js', 'vendor/d3-force.min.js'];
const assets = [HTML, ...css, ...js, ...vendor, 'favicon.svg'];

/* 预算：定在「当前值上浮一成」上下 —— 既拦得住意外膨胀，也不会天天报警。
   charts.js 于 P2 上调 30 → 32 KB：新增「跨图年份高亮带（band + 3 个高亮点 + focusYear 接口）」
   与「弱口径列标记」（热力矩阵的列底纹 + 虚线分隔），是 14 个引擎里最大的一份；实测 31.0 KB。
   全站合计于 P2/P3 上调 130 → 136 KB：口径徽章（app + CSS + 词表）、时间线键盘导航
   （app 的 bindTimelineKeys + CSS 焦点环 + 提示）合计约 +3.7 KB，实测 131.8 KB；
   只留约 3% 余量是有意的 —— 再加功能应当先减别处，而不是顺手把这行数字往上推。 */
const BUDGET = [
  { what: '全站合计（gzip）', files: assets, max: 136 * 1024, why: '17 个文件全部下载完成的总字节（P2/P3 后实测 131.8 KB）' },
  { what: '手写 JS（gzip）', files: js.filter((f) => f !== 'map-china.js'), max: 95 * 1024, why: 'app / charts / data / i18n / theme' },
  { what: 'charts.js（gzip）', files: ['charts.js'], max: 32 * 1024, why: '14 个自绘 SVG 引擎（含年份高亮带与弱口径列标记）' },
  { what: 'data.js（gzip）', files: ['data.js'], max: 22 * 1024, why: '全站数据与双语文案' },
  { what: 'map-china.js（gzip）', files: ['map-china.js'], max: 14 * 1024, why: '省级边界（抽稀后的静态几何）' },
  { what: 'CSS 合计（gzip）', files: css, max: 16 * 1024, why: '设计令牌 + 布局 + 主题 + 语言微调' },
  { what: 'vendor 合计（gzip）', files: vendor, max: 12 * 1024, why: '5 个 d3 子模块（力导向图用）' },
  { what: '单文件最大（gzip）', files: assets, max: 32 * 1024, mode: 'max', why: '任何单个文件都不该拖慢首屏（当前最大是 charts.js 31.0 KB）' }
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
  /* canonical 不进这里：它不是浏览器要去取的资源（写 www.ly-beyond.github.io 也不会多一次请求），
     存在性与安全性由 link-check.mjs 的 ④b 负责 */
  ...[...html.matchAll(/<link[^>]*\shref="([^"]+)"/g)].filter((m) => !m[0].includes('rel="canonical"')).map((m) => ({ kind: 'link', href: m[1] })),
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
  /* <link rel="canonical"> 是「自指声明」：它告诉爬虫规范地址，浏览器并不会去取它，
     所以扫描外链资源时把它剔掉 —— 代价是下面那条「只许出现本站地址」的断言把它看得更紧。 */
  const scan = f === 'index.html' ? src.replace(/<link[^>]*\srel="canonical"[^>]*>/gi, '') : src;
  for (const [re, what] of NET_PATTERNS) {
    ok(!re.test(scan), `${f}: 出现 ${what} —— 与「零联网」的承诺冲突（断网 / file:// 会失效）`);
  }
}
/* 自指声明白名单：HTML 里出现的每个 http(s) 地址都必须是本站规范地址
   （canonical / og:url 属于「说自己是谁」，出现第二个域名就说明混进了外部依赖） */
const absUrls = [...html.matchAll(/https?:\/\/[^"'\s<>)]+/g)].map((m) => m[0]);
ok(absUrls.length >= 2, `index.html: 只有 ${absUrls.length} 个绝对地址 —— canonical / og:url 是不是漏了`);
for (const u of absUrls) {
  ok(u === 'https://ly-beyond.github.io/vis2/', `index.html: 出现外部地址 ${u}（本站只允许指向自己的规范地址）`);
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

/* ---------------- 文档副本：README / FEATURES / HIGHLIGHTS 里的数字逐个核对 ----------------
   三份文档各自把同一批数字写了一遍（章节 / 图表 / SVG / 词条 / 文案 / 数据集 / 体积 / 行数），
   最容易「改了一处忘了另外两处」。这里只核对本脚本算得出来的量；断言条数由 selfcheck.mjs 核对。 */
const docs = { README: readme, FEATURES: read('FEATURES.md'), HIGHLIGHTS: read('HIGHLIGHTS.md') };
const manifest = JSON.parse(read('data/manifest.json'));
const rowsInManifest = manifest.datasets.reduce((s, d) => s + d.rows, 0);
const colsInManifest = manifest.datasets.reduce((s, d) => s + d.columns.length, 0);
const csvFiles = readdirSync(join(HERE, 'data')).filter((f) => f.endsWith('.csv'));
const csvLines = csvFiles.reduce((s, f) => s + read(join('data', f)).split('\n').filter((l) => l.trim()).length, 0);
const nLines = (f) => read(f).replace(/\n$/, '').split('\n').length;
const dataLines = nLines('data.js'), mapLines = nLines('map-china.js');
const pageLines = assets.reduce((s, f) => s + nLines(f), 0);
const handLines = pageLines - dataLines - mapLines;
const scriptLines = [...scripts, 'data/build.mjs'].reduce((s, f) => s + nLines(f), 0);
const chartCount = (html.match(/id="chart-[\w-]+"/g) || []).length;
const gaugeCount = DATA.sim.outputs.length + 1;
/* README「部署目录里另有…」那一段：自检脚本 / data/ / 文档 / 整个目录的实测值 */
const scriptsKB = scripts.reduce((s, f) => s + bytes(f), 0) / 1024;
const dataDir = dirStat('data');
const docFiles = ['README.md', 'HIGHLIGHTS.md', 'FEATURES.md', 'DEPLOY-NETLIFY.md'];
const docKB = docFiles.reduce((s, f) => s + bytes(f), 0) / 1024;
const siteAll = dirStat('.');
const svgCount = chartCount + gaugeCount;
const navCount = (html.match(/class="nav-link"/g) || []).length;
const engineCount = (read('charts.js').match(/function \w+\(container, cfg\)/g) || []).length;
const dataKB = bytes('data.js') / 1024;
const diskTotalKB = rawAll / 1024, gzTotalKB = gzAll / 1024;
const vendorKB = vendor.reduce((s, f) => s + bytes(f), 0) / 1024;
const vendorGzKB = vendor.reduce((s, f) => s + gz(f), 0) / 1024;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const volRe = (name) => '^\\|\\s*[`*]*' + esc(name) +
  '[`*]*\\s*\\|\\s*[`*]*(\\d+(?:\\.\\d+)?) KB\\s*[`*]*\\s*\\|\\s*[`*]*(\\d+(?:\\.\\d+)?) KB';
const volTable = [
  ['`index.html`', bytes(HTML) / 1024, gz(HTML) / 1024],
  ['`styles.css`', bytes('styles.css') / 1024, gz('styles.css') / 1024],
  ['`charts.js`', bytes('charts.js') / 1024, gz('charts.js') / 1024],
  ['`app.js`', bytes('app.js') / 1024, gz('app.js') / 1024],
  ['`data.js`', dataKB, gz('data.js') / 1024],
  ['`map-china.js`', bytes('map-china.js') / 1024, gz('map-china.js') / 1024],
  ['`i18n.js`', bytes('i18n.js') / 1024, gz('i18n.js') / 1024],
  ['5 个 d3 子模块', vendorKB, vendorGzKB],
  ['**合计（页面请求 17 个文件）**', diskTotalKB, gzTotalKB]
];
const DOC_CLAIMS = [
  { doc: 'README', label: '页面只请求…磁盘…gzip 后',
    re: /页面只请求 (\d+) 个文件 \/ 磁盘 (\d+) KB \/ gzip 后 (\d+) KB/,
    want: [assets.length, Math.round(diskTotalKB), Math.round(gzTotalKB)], names: ['文件数', '磁盘 KB', 'gzip KB'] },
  { doc: 'README', label: 'vendor / map / data 体积说明',
    re: /`vendor\/` 的 (\d+) 个 d3 脚本累计约 (\d+) KB gzip，[\s\S]{0,40}?`map-china\.js` (\d+) KB，生成的 `data\.js` (\d+) KB/,
    want: [vendor.length, Math.round(vendorGzKB), Math.round(bytes('map-china.js') / 1024), Math.round(dataKB)],
    names: ['d3 子模块数', 'd3 gzip KB', 'map 磁盘 KB', 'data 磁盘 KB'] },
  { doc: 'README', label: '构建注释里 data.js 体积',
    re: /生成（(\d+) 个数据集 → (\d+) KB 的 data\.js）/,
    want: [manifest.datasets.length, Math.round(dataKB)], names: ['数据集', 'data.js KB'] },
  { doc: 'README', label: '部署目录里不参与加载的部分（脚本 / data / 文档 / 目录总量）',
    re: /(\d+) 个自检脚本（(\d+) KB）、`data\/` 数据源与构建脚本（(\d+) KB）、[\s\S]{0,80}?文档（(\d+) KB），整个目录 (\d+) 个文件 \/ (\d+) KB/,
    want: [scripts.length, Math.round(scriptsKB), Math.round(dataDir.bytes / 1024), Math.round(docKB), siteAll.files, Math.round(siteAll.bytes / 1024)],
    names: ['自检脚本数', '自检脚本 KB', 'data KB', '文档 KB', '目录文件数', '目录 KB'] },
  { doc: 'README', label: '双语文案条数',
    re: /(\d+) 个双语文案两侧都在/, want: [biLeaves], names: ['双语文案'] },
  { doc: 'README', label: 'SVG / 章节 / 导航项',
    re: /(\d+) 个 SVG \/ (\d+) 章节 \/ (\d+) 导航项/,
    want: [svgCount, sections, navCount], names: ['SVG 总数', '章节', '导航项'] },
  { doc: 'FEATURES', label: '数字一览表',
    re: /^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|[^|]*\|\s*(\d+) KB\s*\|/m,
    want: [sections, chartCount, svgCount, zhKeys, biLeaves, manifest.datasets.length, Math.round(gzTotalKB)],
    names: ['章节', '自绘图表', 'SVG 总数', '中英词条', '双语文案', 'CSV 数据集', 'gzip KB'] },
  { doc: 'FEATURES', label: '数据源个数',
    re: /(\d+) 个 CSV 数据源（公开报告整理/, want: [manifest.datasets.length], names: ['CSV 数据集'] },
  { doc: 'FEATURES', label: '亮点五 文案表键数',
    re: /多一张 (\d+) 键的文案表/, want: [zhKeys], names: ['中英词条'] },
  { doc: 'FEATURES', label: '亮点七 体积',
    re: /全站 (\d+) 个文件、磁盘 (\d+) KB、\*\*gzip 后 (\d+) KB\*\*/,
    want: [assets.length, Math.round(diskTotalKB), Math.round(gzTotalKB)], names: ['文件数', '磁盘 KB', 'gzip KB'] },
  { doc: 'HIGHLIGHTS', label: '摘要 数据源',
    re: /数据由 \*\*(\d+) 个 CSV 构建而来\*\*/, want: [manifest.datasets.length], names: ['CSV 数据集'] },
  { doc: 'HIGHLIGHTS', label: '数据速览 页面行',
    re: /^\|\s*页面\s*\|\s*\*\*(\d+) 个\*\*（`index\.html`，(\d+) 个章节/m,
    want: [1, sections], names: ['页面', '章节'] },
  { doc: 'HIGHLIGHTS', label: '数据速览 图表行',
    re: /\*\*(\d+) 张自绘 SVG\*\*.*?\*\*(\d+) 个 SVG\*\*（含模拟器内 (\d+) 个环形仪表）/,
    want: [chartCount, svgCount, gaugeCount], names: ['自绘图表', 'SVG 总数', '仪表'] },
  { doc: 'HIGHLIGHTS', label: '数据速览 数据源行',
    re: /\*\*(\d+) 个 CSV\*\*（(\d+) 行数据表 \/ (\d+) 行含表头 \/ (\d+) 列）→ 生成 \*\*(\d+) KB 的 `data\.js`\*\*（(\d+) 行）/,
    want: [manifest.datasets.length, rowsInManifest, csvLines, colsInManifest, Math.round(dataKB), dataLines],
    names: ['CSV 数据集', '数据行', '含表头行', '列合计', 'data.js KB', 'data.js 行'] },
  { doc: 'HIGHLIGHTS', label: '数据速览 词条行',
    re: /\*\*(\d+) 键\*\*（zh \/ en 两表逐键一致），双语文案 \*\*(\d+) 条\*\*/,
    want: [zhKeys, biLeaves], names: ['中英词条', '双语文案'] },
  { doc: 'HIGHLIGHTS', label: '数据速览 代码量行',
    re: /页面侧 \*\*(\d+) 行\*\*（其中 `data\.js` (\d+) 行、`map-china\.js` (\d+) 行是构建产物，手写约 (\d+) 行）；自检与构建脚本 \*\*(\d+) 行\*\*/,
    want: [pageLines, dataLines, mapLines, handLines, scriptLines],
    names: ['页面行数', 'data.js 行', 'map-china.js 行', '手写行数', '脚本行数'] },
  { doc: 'HIGHLIGHTS', label: '数据速览 依赖行',
    re: /\*\*(\d+) 个 d3 子模块\*\*/, want: [vendor.length], names: ['d3 子模块数'] },
  { doc: 'HIGHLIGHTS', label: '数据速览 传输体积行',
    re: /\|\s*传输体积\s*\|\s*页面请求 \*\*(\d+) 个文件 \/ 磁盘 (\d+) KB \/ gzip (\d+) KB\*\*/,
    want: [assets.length, Math.round(diskTotalKB), Math.round(gzTotalKB)], names: ['文件数', '磁盘 KB', 'gzip KB'] },
  { doc: 'HIGHLIGHTS', label: '亮点② 引擎数与 charts.js 行数',
    re: /`charts\.js`（(\d+) 行）里有 (\d+) 个引擎函数/,
    want: [nLines('charts.js'), engineCount], names: ['charts.js 行', '引擎函数'] },
  { doc: 'HIGHLIGHTS', label: '亮点⑦ 数据摊销',
    re: /`data\.js` 里 (\d+) 个数组元素 ≈ (\d+) B\/条/,
    want: [records, Math.round(gz('data.js') / records)], names: ['数组元素', 'B/条'] },
  { doc: 'HIGHLIGHTS', label: '亮点⑦ 预算条数',
    re: /# (\d+) 条 gzip 预算/, want: [BUDGET.length], names: ['预算条数'] },
  { doc: 'HIGHLIGHTS', label: '性能段 SVG 总数',
    re: /总量只有 (\d+) 个 SVG/, want: [svgCount], names: ['SVG 总数'] }
];
console.log('\n文档副本核对（README / FEATURES / HIGHLIGHTS 的同一批数字）：');
let docClaimN = 0;
for (const c of DOC_CLAIMS) {
  const m = docs[c.doc].match(c.re);
  if (!m) {
    ok(false, `${c.doc}: 找不到「${c.label}」那一行 —— 文档被改写过，就同步这里的正则`);
    console.log(`  FAIL ${c.doc.padEnd(10)} ${c.label}（没匹配到）`);
    continue;
  }
  const off = [];
  c.want.forEach((want, i) => {
    docClaimN++;
    if (Number(m[i + 1]) !== want) off.push(`${c.names[i]} 写 ${Number(m[i + 1])} ≠ 实测 ${want}`);
  });
  ok(off.length === 0, `${c.doc}: 「${c.label}」与实测不一致 —— ${off.join('；')}`);
  console.log(`  ${off.length ? 'FAIL' : 'OK  '} ${c.doc.padEnd(10)} ${c.label}　${c.want.join(' / ')}`);
}
const near = (a, b) => Math.abs(a - b) <= 0.05;
for (const [name, diskW, gzW] of volTable) {
  const m = docs.HIGHLIGHTS.match(new RegExp(volRe(name), 'm'));
  const got = m ? [Number(m[1]), Number(m[2])] : null;
  const pass = !!got && near(got[0], diskW) && near(got[1], gzW);
  ok(pass, `HIGHLIGHTS 体积明细表「${name}」写的是 ${got ? got.join(' / ') + ' KB' : '（没找到这一行）'}，实测 ${diskW.toFixed(1)} / ${gzW.toFixed(1)} KB`);
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} HIGHLIGHTS 体积明细 ${name.padEnd(32)} ${diskW.toFixed(1)} / ${gzW.toFixed(1)} KB`);
}

/* ---------------- 输出 ---------------- */
if (problems.length) {
  problems.forEach((p) => console.log('✗  ' + p));
  console.log(`\n===== SUMMARY script=budget-check.mjs checks=${checks} failed=${problems.length} =====`);
  process.exit(1);
}
console.log(`\n✓ 全站 ${assets.length} 个文件 / 传输 ${KB(gzAll)}（gzip 第 9 级）/ ${reqs.length + 1} 个请求 / 零联网 / 无构建`);
console.log(`✓ README 复杂度清单 ${CLAIMS.length} 项数字与实测一致`);
console.log(`✓ 文档副本 ${DOC_CLAIMS.length} 处 + 体积明细 ${volTable.length} 行数字与实测一致（共 ${docClaimN} 个数）`);
console.log(`\n===== SUMMARY script=budget-check.mjs checks=${checks} failed=0 =====`);
