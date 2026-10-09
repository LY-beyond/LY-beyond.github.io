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
 *   ⑦ 文档副本：README / FEATURES / HIGHLIGHTS 里同一批数字（节 / 图表 / SVG / 词条 /
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
/* 位图只有一张：首屏背景图（由来见下方 BUDGET 上方注释）。它是全站唯一的二进制资源，
   所以「行数」这类按文本处理的统计要把它排除（见下方 pageLines）。 */
const images = ['background.webp'];
const assets = [HTML, ...css, ...js, ...vendor, 'favicon.svg', ...images];

/* 预算：定在「当前值上浮一成」上下 —— 既拦得住意外膨胀，也不会天天报警。
   charts.js 于 P2 上调 30 → 32 KB：新增「跨图年份高亮带（band + 3 个高亮点 + focusYear 接口）」
   与「弱口径列标记」（热力矩阵的列底纹 + 虚线分隔），是 14 个引擎里最大的一份；实测 31.0 KB。
   charts.js 于「预测段修复」再上调 32 → 33 KB：原先实线一路画到 2025、同色虚线又压在它身上，
   虚线间隙露出实线 —— 预测段形同虚设；这次拆成「实线止于最后一个实际点 + 虚线画预测段」，
   并按页面早已写下的承诺补上预测区间（<pattern> 底纹）与区间图例。
   charts.js 于「产业规模外推」再上调 33 → 34 KB：预测区间从「±10% 比例」升级为按点带 lo/hi 的
   真实 95% 预测区间（2026–2028E 由构建期线性回归写入），并新增 playerMax（曲线画到 2028E），gzip 实测 32.8 KB。
   全站合计于 P2/P3 上调 130 → 136 KB：口径徽章（app + CSS + 词表）、时间线键盘导航
   （app 的 bindTimelineKeys + CSS 焦点环 + 提示）合计约 +3.7 KB，实测 134.4 KB；
   全站合计于「§13 结论节」再上调 136 → 140 KB：新增两张图（增速对比折线图 + 驱动力对比条形图）
   带来的 data 行、词表与渲染代码，实测 137.6 KB。
   data.js 于「去书面化改写」上调 22 → 23 KB：全站中文文案从报告腔改成大白话（新质生产力、驱动力、
   行业案例、图谱节点等 65 条改写），同样的信息用人话讲更长——中文部分普遍加长一两成，
   英文同步改写又添了一些字节，实测 22.1 KB；数据集与行列数没变（45 集 / 285 行），
   这是纯文案代价，不做数据删减来迁就预算。
   手写 JS 于「排名条形配色」上调 95 → 98 KB、charts.js 34 → 35 KB：横向排名图原来是「前 2 名橙 +
   其余同一根青绿」两色，这轮改成按名次取色的顺序色阶（暖→冷），charts.js 新增 rgbOf / mixColor /
   scaleColor 三个插值小函数与「悬停压本色」逻辑，实测 95.8 KB（charts.js 33.8 KB）。
   全站合计于「浅蓝白渐变换肤」上调 140 → 150 KB：换肤后实测 140.0 KB，140 KB 这条线只剩 34 B ——
   多写一行注释、加一层渐变都得先删功能。这一档是明确让出的「主题与装饰」余量（约 10 KB），
   其余 7 条分项维持原值；数据与功能仍按老规矩 —— 先减别处，再谈上调。
   全站合计于「首屏背景图」上调 150 → 330 KB，同时「单文件最大」35 → 180 KB：用户在页面顶部
   加了一张「AI 引擎」渲染图。原图 background.png 是 2805×1343 / 3.24 MB，还带一层胶片颗粒 ——
   PNG 压不动，gzip 第 9 级也只压掉 0.03%（3.24 MB → 3.24 MB），原样入库等于把站点从 140 KB
   变成 3.4 MB。处理方式是**不改尺寸、只换编码**：轻度降噪（gblur σ=0.6，专治颗粒，颗粒正是
   这类渲染图的压缩杀手）+ libwebp q85 → background.webp 160.5 KB（省 95%），实测全站 302.0 KB。
   这张图成了「首屏最大文件」（此前是 charts.js 33.8 KB），所以单文件最大那一条必须同步上调，
   否则它会用同一条理由连环报警；其余 6 条分项一律不动 —— 图不占 JS / CSS / 数据预算，
   代码该省还是省。位图禁令同步收敛为「只允许 background.webp 这一张」（见下方 strayRaster）。
   CSS 合计于「首屏背景图」同步 16 → 18 KB：首屏背景图的定位、遮罩（含深色与窄屏两套）实测增加 1.0 KB gzip ——
   这是「把一张外部素材接进页面」的必要样式，不是可以挪走的装饰；实测 16.7 KB。
   手写 JS 于「章节路径带」再上调 98 → 102 KB、CSS 合计 18 → 20 KB：页面「网页概览」前加了一条
   12 章流动连线（仿 vis 的「小节流动路径带」）—— app.js 新增 renderChapterPath()（读 data.js 的
   overview，现场算波浪贝塞尔轨道 + 01…12 编号节点，节点是可跳章节的 <a>，跟随顶栏高亮），
   styles.css 新增 .chapter-path* 一套（轨道 / 流动虚线 / 徽章 / 标签 / 当前章脉冲与悬停态）；
   实测手写 JS 99.0 KB、CSS 18.6 KB，全站合计 302.0 → 306.5 KB（仍在 330 KB 内）。
   styles.css 于「三要素方框底色 + 悬停」（预算不变，CSS 仍 ≤ 20 KB）：三个 .pillar 方框改用
   「上一个网站（vis）章节方框」的写法 —— 只声明一个主色，底 / 边由它派生，方框从左上
   白面斜向右下过渡到浅蓝（158deg + --mix-halo 描边），悬停再抬起 2px、描边压主色、换主色光晕；
   实测 styles.css 49.6 KB / 13.9 KB gzip、CSS 合计 19.9 KB、全站合计 307.8 KB。
   styles.css 于「五股作用力方框 + 标签配色」（CSS 合计 20 → 21 KB）：③ 节 5 张 .force-card 也用上
   同一套「章节方框」画法（渐变底 + 悬停抬起 2px / 主色描边 / 主色光晕），并按标签含义给四字标签
   上色（效率=橙 / 创新=紫 / 配置=青 / 绿色=绿 / 普惠=粉）—— 色相全部取自既有令牌，只多出几行
   color-mix 与 :nth-child 映射；实测 styles.css 51.0 KB / 14.3 KB gzip、CSS 合计 20.3 KB、
   全站合计 308.3 KB。八个方框统一到同一条画法，这一档让出的是「主题与装饰」的余量。
   app.js / charts.js 于「年份播放器覆盖外推年」：④ 节的年份播放器原来被 playerMax 卡在 2025E，
   2026–2028E 只能看、不能逐格回放；这次让播放器走全部 10 个点（scale.series + scale.forecast），
   读数与分享链接的 y= 都改读统一的年份表；跨图联动到外推年时小倍数图没有对应列（只有 7 列），
   改为清空高亮而不是夹到 2025E。实测 app.js 95.5 KB / 30.7 KB gzip、charts.js 114.1 / 34.7 KB、
   全站合计 309.1 KB（手写 JS 99.7 KB，仍在 102 KB 内）。styles.css 于「KPI 方框渐变底 + 悬停」：① 节 4 张 .kpi 也统一到同一条方框画法（只声明主色、底 / 边由它派生，悬停抬起 2px / 主色描边 / 主色光晕），各档预算上限不变；实测 styles.css 51.7 KB / 14.4 KB gzip、全站合计 309.2 KB。
   styles.css / app.js / index.html 于「② 节对比表 → 翻转对照卡」（各档预算上限一律不变，CSS 仍 ≤ 21 KB）：
   原来那张 5 行 <table>（窄屏还得横滑找「新质」那列）换成 5 张可翻面的对照卡 —— 正面「传统生产力」、
   背面「新质生产力」，两面同占一个网格单元（grid-area: 1/1，高度自动取较高者），悬停（仅 hover 设备）
   或点右上角按钮翻面；按钮维护 aria-pressed 与可及名，两面文案都留在 DOM 里，天生就是那张表的
   数据表等价物；打印时两面摊开印出来。方框沿用 .kpi / .pillar / .force-card 同一条画法，没有新色阶。
   实测 styles.css 53.9 KB / 15.0 KB gzip、app.js 96.4 KB / 31.1 KB、全站合计 310.1 KB（仍在 330 KB 内）；
   CSS 合计 20.3 → 21.0 KB：删掉旧表那 70 行 CSS 基本抵掉新增的翻面与按钮样式，21 KB 这条线只剩 49 B ——
   以后再动 CSS 得先从这一块删，别再往上调。真机断言 152 → 156（smoke.mjs 新增 4 条见下）。 */
const BUDGET = [
  { what: '全站合计（gzip）', files: assets, max: 330 * 1024, why: '18 个文件全部下载完成的总字节（首屏背景图 + 章节路径带后实测 306.5 KB；330 KB 这一档的由来见上方注释）' },
  { what: '手写 JS（gzip）', files: js.filter((f) => f !== 'map-china.js'), max: 102 * 1024, why: 'app / charts / data / i18n / theme（含章节路径带渲染，实测 99.7 KB）' },
  { what: 'charts.js（gzip）', files: ['charts.js'], max: 35 * 1024, why: '14 个自绘 SVG 引擎（含年份高亮带、弱口径列标记与预测段 95% 预测区间）' },
  { what: 'data.js（gzip）', files: ['data.js'], max: 23 * 1024, why: '全站数据与双语文案（去书面化改写后实测 22.1 KB）' },
  { what: 'map-china.js（gzip）', files: ['map-china.js'], max: 14 * 1024, why: '省级边界（抽稀后的静态几何）' },
  { what: 'CSS 合计（gzip）', files: css, max: 21 * 1024, why: '设计令牌 + 布局 + 主题 + 语言微调（含首屏背景图、章节路径带、三 / 五股方框渐变底与标签配色，实测 20.3 KB）' },
  { what: 'vendor 合计（gzip）', files: vendor, max: 12 * 1024, why: '5 个 d3 子模块（力导向图用）' },
  { what: '单文件最大（gzip）', files: assets, max: 180 * 1024, mode: 'max', why: '任何单个文件都不该拖慢首屏（当前最大是首屏背景图 background.webp 160.5 KB，其次 charts.js 33.8 KB）' }
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
  ['节', sections],
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
/* 位图禁令（收敛版）：部署目录**只允许 background.webp 这一张**。
   截图 / 取证 / 素材 / og 图一律拦下 —— 这条断言存在的意义是「别哪天又把几 MB 的 PNG 提交进来」。 */
const RASTER_OK = new Set(images);
const strayShots = readdirSync(HERE)
  .filter((f) => /\.(png|jpe?g|gif|webp|avif|bmp|tiff?)$/i.test(f))
  .filter((f) => !RASTER_OK.has(f));
ok(strayShots.length === 0, `部署目录里残留截图/证据/位图文件（只允许 ${[...RASTER_OK].join(', ')}）：${strayShots.join(', ')}`);

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
/* 位图是二进制，没有「行」的概念 —— 当文本数换行符只会把行数统计带偏 */
const textAssets = assets.filter((f) => !images.includes(f));
const pageLines = textAssets.reduce((s, f) => s + nLines(f), 0);
const handLines = pageLines - dataLines - mapLines;
const scriptLines = [...scripts, 'data/build.mjs'].reduce((s, f) => s + nLines(f), 0);
const chartCount = (html.match(/id="chart-[\w-]+"/g) || []).length;
const gaugeCount = DATA.sim.outputs.length + 1;
/* README「部署目录里另有…」那一段：自检脚本 / data/ / 文档 / 整个目录的实测值 */
const scriptsKB = scripts.reduce((s, f) => s + bytes(f), 0) / 1024;
const dataDir = dirStat('data');
const docFiles = ['README.md', 'HIGHLIGHTS.md', 'KEY-HIGHLIGHTS.md', 'FEATURES.md', 'DEPLOY-NETLIFY.md'];
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
  ['`background.webp`', bytes('background.webp') / 1024, gz('background.webp') / 1024],
  ['**合计（页面请求 18 个文件）**', diskTotalKB, gzTotalKB]
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
  { doc: 'README', label: 'SVG / 节 / 导航项',
    re: /(\d+) 个 SVG \/ (\d+) 节 \/ (\d+) 导航项/,
    want: [svgCount, sections, navCount], names: ['SVG 总数', '节', '导航项'] },
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
    re: /^\|\s*页面\s*\|\s*\*\*(\d+) 个\*\*（`index\.html`，(\d+) 节/m,
    want: [1, sections], names: ['页面', '节'] },
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
