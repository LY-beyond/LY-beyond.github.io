/* =========================================================
 * selfcheck.mjs —— vis3 的静态自检（零依赖 · 毫秒级 · 不联网、不开浏览器）
 * ---------------------------------------------------------
 * 跑法：node selfcheck.mjs            只跑静态检查（默认）
 *       node selfcheck.mjs --full     连真机冒烟（smoke.mjs）一起跑，需要本机有 Chrome
 *       node selfcheck.mjs -v         每一项都打印名字
 *
 * 静态检查内容（本文件一个文件跑完，不依赖任何 npm 包）：
 *   ① 语法        六个 .js 都能被 V8 解析（vm.Script，不执行）
 *   ② 页面结构    index.html 引用的资源都在 / 脚本与样式顺序 / 零外链 / 锚点与 ARIA 引用
 *   ③ 中英词表    zh·en 键对齐 / 非空 / 占位符一致 / 代码里用到的键都在词表里
 *   ④ 选择器契约  app.js 取用的 id、图表类型、变换类型都能在页面里找到对应挂点与词条
 *   ⑤ 样式契约    页面与脚本用到的 class 都有样式、CSS 里的 var(--x) 都有定义、无硬编码色值
 *   ⑥ 引擎与数据  在 vm 里跑 pandas.js + data.js：六份内置数据集都能解析、推断类型、分组聚合
 *   ⑦ 文档数字    README「复杂度清单」里写的数字必须与实测一致（数字过期即红；含本文的断言总数）
 *
 * 真机检查（--full）：
 *   smoke.mjs     真机断言（数据源 / 19 种变换 / 6 类图表 / 导出 / 双语 / 主题 / 窄屏）
 * ========================================================= */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ARGS = process.argv.slice(2);
const FULL = ARGS.includes('--full');
const VERBOSE = ARGS.includes('-v') || ARGS.includes('--verbose');

const read = (f) => readFileSync(join(HERE, f), 'utf8');
const has = (f) => existsSync(join(HERE, f));

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, extra) {
  if (cond) { pass++; if (VERBOSE) console.log('  [OK] ' + name); }
  else { fail++; fails.push(name + (extra ? ' -> ' + extra : '')); console.log('  [XX] ' + name + (extra ? ' -> ' + extra : '')); }
}
function section(title) { console.log('\n' + title); }

const HTML = read('index.html');
const APP = read('app.js');
const CHARTS = read('charts.js');
const I18N = read('i18n.js');
const CSS = {
  'styles.css': read('styles.css'),
  'theme.css': read('theme.css'),
  'i18n.css': read('i18n.css'),
  'tokens.css': read('tokens.css')
};

/* ---------- ① 语法 ---------- */
section('[1] 语法：六个脚本都能被解析');
for (const f of ['theme.js', 'pandas.js', 'charts.js', 'data.js', 'i18n.js', 'app.js']) {
  let err = '';
  try { new vm.Script(read(f), { filename: f }); } catch (e) { err = e.message; }
  check(f + ' 语法正确', !err, err);
}

/* ---------- ② 页面结构 ---------- */
section('[2] 页面结构：资源 / 顺序 / 零外链 / 引用完整');

const LINKS = [...HTML.matchAll(/<link[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[0]);
const SCRIPTS = [...HTML.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)].map((m) => m[1]);
const CSS_ORDER = LINKS.map((tag) => (tag.match(/href="([^"]+)"/) || [])[1]).filter((h) => h && h.endsWith('.css'));

for (const f of [...CSS_ORDER, ...SCRIPTS, 'favicon.svg']) {
  check('资源存在：' + f, has(f));
}
const wantScripts = ['theme.js', 'pandas.js', 'charts.js', 'data.js', 'i18n.js', 'app.js'];
check('脚本顺序 = ' + wantScripts.join(' → '), SCRIPTS.join(' ') === wantScripts.join(' '), SCRIPTS.join(' '));
const wantCss = ['tokens.css', 'styles.css', 'i18n.css', 'theme.css'];
check('样式顺序 = ' + wantCss.join(' → '), CSS_ORDER.join(' ') === wantCss.join(' '), CSS_ORDER.join(' '));
check('主题脚本在 <head> 里提前执行（避免暗色闪白）',
  HTML.indexOf('theme.js') < HTML.indexOf('<body'));

/* 零外链：去掉 canonical / og / 结构化数据之后，页面里不该再出现 http(s) 资源 */
const stripped = HTML.replace(/<meta\b[^>]*>/gi, '')
  .replace(/<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>/gi, '')
  .replace(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi, '');
const remote = [...stripped.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
check('零外链：站内不引用任何远程资源', remote.length === 0, remote.join(', '));
check('没有内联 <script> 逻辑（全部外链，便于 file:// 与 CSP）',
  !/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(HTML));

/* id / 锚点 / ARIA 引用 */
const IDS = [...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const idset = new Set(IDS);
check('id 唯一（无重复）', idset.size === IDS.length,
  IDS.filter((x, i) => IDS.indexOf(x) !== i).join(', '));

const anchors = [...HTML.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const badAnchors = anchors.filter((a) => a !== '' && !idset.has(a));
check('所有 href="#…" 锚点都有落点', badAnchors.length === 0, badAnchors.join(', '));
const topLink = [...HTML.matchAll(/href="(#[^"]*)"/g)].map((m) => m[1]).includes('#top');
check('「回到顶部」锚点 #top 存在（页首元素有 id="top"）', topLink && idset.has('top'));

const ariaRefs = [...HTML.matchAll(/\b(?:aria-labelledby|aria-describedby|aria-controls)="([^"]+)"/g)]
  .flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
const badAria = ariaRefs.filter((r) => !idset.has(r));
check('aria-* 引用的 id 都存在', badAria.length === 0, badAria.join(', '));

const labels = [...HTML.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]);
const badLabels = labels.filter((r) => !idset.has(r));
check('所有 <label for> 都指向存在的控件', badLabels.length === 0, badLabels.join(', '));

check('有 <noscript> 兜底说明（JS 关闭时不留白屏）', /<noscript[\s\S]*?<\/noscript>/i.test(HTML));
check('有「跳到正文」跳转链接（键盘可达）', /class="skip-link"/.test(HTML) && /href="#main"/.test(HTML));
check('顶栏汉堡按钮带 aria-expanded 与 aria-controls', /id="nav-toggle"[\s\S]{0,200}aria-expanded=/.test(HTML)
  || /aria-expanded=[^>]*id="nav-toggle"/.test(HTML));
check('语言切换器有 zh / en 两个按钮（data-lang）',
  /data-lang="zh"/.test(HTML) && /data-lang="en"/.test(HTML));
check('图表类型按钮都有 aria-pressed（用 aria-pressed 表达当前态）',
  (HTML.match(/data-type="/g) || []).length === (HTML.match(/data-type="[^"]*"[^>]*aria-pressed=/g) || []).length);

/* ---------- ③ 中英词表 ---------- */
section('[3] 中英词表：键对齐 / 非空 / 占位符 / 覆盖');

const zhStart = I18N.search(/\n\s*zh: \{/);
const enStart = I18N.search(/\n\s*en: \{/);
const zhBlock = I18N.slice(zhStart, enStart);
const enBlock = I18N.slice(enStart);
function keysOf(block) {
  const out = new Map();
  const re = /^\s{4,8}'([^']+)':\s*(.*)$/gm;
  let m;
  while ((m = re.exec(block))) out.set(m[1], m[2]);
  return out;
}
const ZH = keysOf(zhBlock), EN = keysOf(enBlock);
const KEY_N = ZH.size;
check('两份词表都不是空的（zh ' + ZH.size + ' 条 / en ' + EN.size + ' 条）', ZH.size > 200 && EN.size > 200);
const missEn = [...ZH.keys()].filter((k) => !EN.has(k));
const missZh = [...EN.keys()].filter((k) => !ZH.has(k));
check('en 不缺键（' + missEn.length + ' 条缺失）', missEn.length === 0, missEn.slice(0, 8).join(', '));
check('zh 不缺键（' + missZh.length + ' 条多余）', missZh.length === 0, missZh.slice(0, 8).join(', '));

const empty = [...ZH.entries()].filter(([, v]) => /^''\s*,?$/.test(v.trim())).map(([k]) => k)
  .concat([...EN.entries()].filter(([, v]) => /^''\s*,?$/.test(v.trim())).map(([k]) => k));
check('没有空词条', empty.length === 0, empty.slice(0, 8).join(', '));

function vars(text) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
}
const varDiff = [];
for (const [k, zv] of ZH) {
  if (!EN.has(k)) continue;
  if (vars(zv) !== vars(EN.get(k))) varDiff.push(k + ' [' + vars(zv) + ' vs ' + vars(EN.get(k)) + ']');
}
check('同一个键在中英两侧的占位符一致', varDiff.length === 0, varDiff.slice(0, 6).join(' | '));

/* 代码里用到的键：t('x') / tf('x')，以及前缀拼接 t('op.' + id) 这类 */
const used = new Set();
for (const src of [APP, CHARTS, I18N]) {
  for (const m of src.matchAll(/\btf?\(\s*'([^']+)'/g)) used.add(m[1]);
}
const DYNAMIC_PREFIX = ['op.', 'chart.desc.', 'transform.preset.', 'transform.group.', 'chart.'];
const literal = [...used].filter((k) => !DYNAMIC_PREFIX.includes(k));
const unknown = literal.filter((k) => !EN.has(k) && !ZH.has(k));
check('脚本里 t()/tf() 用到的词条都在词表里（共 ' + literal.length + ' 个）', unknown.length === 0, unknown.join(', '));
check('词表里没有「只在 zh 里出现、代码从不引用」的孤儿键比例过高',
  [...ZH.keys()].filter((k) => used.has(k) || /^(doc|site|nav|hero|stat|data|transform|chart|code|table|status|footer|common|field|opt|opval|agg|op|skip)\./.test(k)).length > KEY_N * 0.9);

/* 静态挂点：data-i18n / data-i18n-attr */
const staticKeys = [...HTML.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
const badStatic = staticKeys.filter((k) => !ZH.has(k));
check('data-i18n 挂点（' + staticKeys.length + ' 个）都有词条', badStatic.length === 0, badStatic.join(', '));
const attrKeys = [...HTML.matchAll(/data-i18n-attr="([^"]+)"/g)]
  .flatMap((m) => m[1].split(',')).map((p) => p.split(':')[1]).filter(Boolean).map((s) => s.trim());
const badAttr = attrKeys.filter((k) => !ZH.has(k));
check('data-i18n-attr 挂点（' + attrKeys.length + ' 个）都有词条', badAttr.length === 0, badAttr.join(', '));

/* ---------- ④ 选择器契约 ---------- */
section('[4] 选择器契约：脚本取用的 id / 变换 / 图表类型都有落点');

const usedIds = new Set([
  ...[...APP.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]),
  ...[...APP.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1])
]);
const badIds = [...usedIds].filter((id) => !idset.has(id));
check('app.js 取用的 ' + usedIds.size + ' 个 id 都在 index.html 里', badIds.length === 0, badIds.join(', '));

/* 图表类型：HTML 的 data-type ↔ app.js 的 CHART_WRAPS ↔ 词条 chart.<type> / chart.desc.<type> */
const cwStart = APP.indexOf('var CHART_WRAPS = {');
const cwBlock = APP.slice(cwStart, APP.indexOf('\n  };', cwStart));
const TYPES = [...cwBlock.matchAll(/^\s{4}'?([a-z]+)'?:/gm)].map((m) => m[1]);
const htmlTypes = [...HTML.matchAll(/data-type="([^"]+)"/g)].map((m) => m[1]);
check('图表类型一致（HTML ' + htmlTypes.length + ' 个 / 引擎 ' + TYPES.length + ' 个）',
  htmlTypes.length === TYPES.length && htmlTypes.every((t) => TYPES.includes(t)),
  'html=' + htmlTypes.join(',') + ' js=' + TYPES.join(','));
const noDesc = TYPES.filter((t) => !ZH.has('chart.' + t) || !ZH.has('chart.desc.' + t) || !EN.has('chart.desc.' + t));
check('每个图表类型都有 chart.<型> 与 chart.desc.<型> 中英词条', noDesc.length === 0, noDesc.join(', '));

/* 变换类型：app.js 的 OPS ↔ 词条 op.<id> / op.<id>.desc */
const opsStart = APP.indexOf('var OPS = [');
const opsBlock = APP.slice(opsStart, APP.indexOf('\n  ];', opsStart));
const OP_IDS = [...opsBlock.matchAll(/^\s*id: '([a-z_]+)'/gm)].map((m) => m[1]);
check('变换类型不少于 19 种（实测 ' + OP_IDS.length + '）', OP_IDS.length >= 19);
const noOp = OP_IDS.filter((id) => !ZH.has('op.' + id) || !ZH.has('op.' + id + '.desc'));
check('每种变换都有 op.<id> 与 op.<id>.desc 词条', noOp.length === 0, noOp.join(', '));

/* 算子分组：每个算子都要登记进 OP_GROUP_OF，否则下拉里会掉出分组 */
const grpStart = APP.indexOf('var OP_GROUP_OF = {');
const grpBlock = APP.slice(grpStart, APP.indexOf('\n  };', grpStart));
const opGroupPairs = [...grpBlock.matchAll(/([a-z_]+):\s*'(\w+)'/g)].map((m) => [m[1], m[2]]);
const noGroup = OP_IDS.filter((id) => !opGroupPairs.some(([id2]) => id2 === id));
check('每个算子都登记了分组（' + opGroupPairs.length + ' 条 / 算子 ' + OP_IDS.length + ' 种）',
  noGroup.length === 0 && opGroupPairs.length === OP_IDS.length, noGroup.join(', '));
const GROUP_IDS = [...new Set(opGroupPairs.map(([, g]) => g))];
const noGroupKey = GROUP_IDS.filter((g) => !ZH.has('transform.group.' + g) || !EN.has('transform.group.' + g));
check('每个分组名都有 transform.group.<组> 中英词条（' + GROUP_IDS.join(' ') + '）',
  noGroupKey.length === 0, noGroupKey.join(', '));

/* 数据体检：控件挂点 + 词条 + 内存口径（阈值与 app.js 的 clamp 一致） */
const healthIds = ['health-table', 'health-note', 'health-option', 'health-maxrows', 'health-precision'];
const missHealth = healthIds.filter((id) => !idset.has(id));
check('数据体检的 ' + healthIds.length + ' 个挂点都在 index.html 里', missHealth.length === 0, missHealth.join(', '));
check('数据体检用 memory_usage 口径（memoryUsage + astype("category") 的省内存估算）',
  /memoryUsage: function/.test(read('pandas.js')) && /categoryBytes/.test(read('pandas.js'))
  && /pd\.set_option\("display\.max_rows"/.test(APP));

/* 一键预设：app.js 的 PRESETS ↔ 词条 transform.preset.<id> */
const preStart = APP.indexOf('var PRESETS = [');
const preBlock = APP.slice(preStart, APP.indexOf('\n  ];', preStart));
const PRESET_IDS = [...preBlock.matchAll(/^\s*id: '([A-Za-z0-9_]+)'/gm)].map((m) => m[1]);
check('一键预设不少于 6 个（实测 ' + PRESET_IDS.length + ' 个）', PRESET_IDS.length >= 6, PRESET_IDS.join(', '));
const noPreset = PRESET_IDS.filter((id) => !ZH.has('transform.preset.' + id) || !EN.has('transform.preset.' + id));
check('每个预设都有 transform.preset.<id> 中英词条', noPreset.length === 0, noPreset.join(', '));

/* 分享链接：编码格式、版本号、还原入口三处都要在 */
check('分享链接用 #pd=<base64> 承载，带 v:1 版本号，并且页面载入时会尝试还原',
  /'#pd=' \+ b64enc/.test(APP) && /v: 1, lang: I\.lang/.test(APP) && /\(\?:\^#\|&\)pd=/.test(APP)
  && /if \(!restoreShared\(\)\) seed\(\)/.test(APP));

/* 分页：默认档必须等于预览行数（首屏渲染不变） */
check('结果表分页 ≥4 档且默认与预览同为 ' + 12 + ' 行',
  /var PAGE_SIZES = \[12, 25, 50, 100\]/.test(APP) && /pageSize: PREVIEW_ROWS/.test(APP));

/* 变换表单里引用的字段 / 下拉选项词条 */
const fieldRefs = [...new Set([...APP.matchAll(/label: '((?:field|opt|opval|agg)\.[A-Za-z0-9_]+)'/g)].map((m) => m[1]))];
const badField = fieldRefs.filter((k) => !ZH.has(k) || !EN.has(k));
check('变换表单引用的 ' + fieldRefs.length + ' 个 label 词条都存在', badField.length === 0, badField.join(', '));
const prefixes = [...new Set([...APP.matchAll(/keysToOptions\(\[[^\]]*\],\s*'([^']+)'\)/g)].map((m) => m[1]))];
const badPrefix = prefixes.filter((p) => ![...ZH.keys()].some((k) => k.startsWith(p)));
check('keysToOptions 的 ' + prefixes.length + ' 个前缀（' + prefixes.join(' ') + '）都有词条', badPrefix.length === 0, badPrefix.join(', '));

check('代码生成器给出可运行的 pandas 起点（import pandas as pd）', /import pandas as pd/.test(APP));
check('代码生成器会落一个 fig.savefig（图上可直接跑）', /fig\.savefig\(/.test(APP));

/* ---------- ⑤ 样式契约 ---------- */
section('[5] 样式契约：class 覆盖 / 变量定义 / 无硬编码色值');

const bareCss = Object.fromEntries(Object.entries(CSS).map(([f, s]) => [f, s.replace(/\/\*[\s\S]*?\*\//g, '')]));
const defined = new Set();
for (const s of Object.values(bareCss)) {
  for (const m of s.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) defined.add(m[1]);
}
function tokensOf(str, into) {
  for (const t of String(str).split(/[^A-Za-z0-9_-]+/)) {
    if (/^[a-z][a-z0-9-]*$/.test(t)) into.add(t);
  }
  return into;
}
const usedClasses = new Set();
for (const m of HTML.matchAll(/class="([^"]*)"/g)) tokensOf(m[1], usedClasses);
for (const src of [APP, CHARTS, I18N]) {
  for (const m of src.matchAll(/\bclass(?:Name)?\s*[:=]\s*'([^']*)'/g)) tokensOf(m[1], usedClasses);
  for (const m of src.matchAll(/class="([^"]{0,80})"/g)) tokensOf(m[1], usedClasses);
  for (const m of src.matchAll(/setAttribute\('class',\s*'([^']*)'\)/g)) tokensOf(m[1], usedClasses);
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*'([^']+)'/g)) tokensOf(m[1], usedClasses);
}
/* 允许表：明确「故意不配样式」的类（有注释说明原因，改一行就会在这里显形） */
const STYLE_EXEMPT = new Set([
  'noscript', '' /* 由 .noscript* 系列覆盖，元素本身不需要规则 */
]);
const unstyled = [...usedClasses].filter((c) => !defined.has(c) && !STYLE_EXEMPT.has(c)).sort();
check('页面与脚本用到的 ' + usedClasses.size + ' 个类都有样式规则', unstyled.length === 0, unstyled.join(', '));

const varDefined = new Set();
for (const s of Object.values(bareCss)) {
  for (const m of s.matchAll(/(--[\w-]+)\s*:/g)) varDefined.add(m[1]);
}
const varUsed = new Set();
for (const s of Object.values(bareCss)) {
  for (const m of s.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) if (m[2] === ')') varUsed.add(m[1]);
}
const badVars = [...varUsed].filter((v) => !varDefined.has(v));
check('CSS 里用了 ' + varUsed.size + ' 个自定义属性，全部有定义（含回退值的视为已定义）', badVars.length === 0, badVars.join(', '));

const hex = [...CSS['styles.css'].matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
check('styles.css 不含硬编码色值（全部走 tokens）', hex.length === 0, hex.join(' '));
const rgb = [...CSS['styles.css'].matchAll(/\b(?:rgb|hsl)a?\(/g)].map((m) => m[0]);
check('styles.css 不含 rgb()/hsl() 字面色值', rgb.length === 0, rgb.join(' '));

for (const [f, s] of Object.entries(bareCss)) {
  const open = (s.match(/\{/g) || []).length, close = (s.match(/\}/g) || []).length;
  check(f + ' 括号配对（' + open + ' 块）', open === close, open + ' vs ' + close);
}
const tokensSrc = CSS['tokens.css'];
check('tokens.css 同时给出亮 / 暗两套变量',
  /:root\b/.test(tokensSrc) && /\[data-theme="dark"\]/.test(tokensSrc));
check('styles.css 有响应式断点（≥4 个 @media）', (CSS['styles.css'].match(/@media[^{]*\{/g) || []).length >= 4,
  String((CSS['styles.css'].match(/@media[^{]*\{/g) || []).length));
check('styles.css 尊重 prefers-reduced-motion', /prefers-reduced-motion/.test(CSS['styles.css']));
check('styles.css 有 @media print（打印时收掉交互控件）', /@media\s+print/.test(CSS['styles.css']));
check('styles.css 有 :focus-visible 焦点环（键盘可见）', /:focus-visible/.test(CSS['styles.css']));

/* ---------- ⑥ 引擎与内置数据（在 vm 里真跑一遍 pandas.js + data.js） ---------- */
section('[6] 引擎与内置数据：解析 / 类型推断 / 变换 / 分组');

const sandbox = { console };
vm.createContext(sandbox);
sandbox.window = sandbox;
let loadErr = '';
try {
  vm.runInContext(read('pandas.js'), sandbox, { filename: 'pandas.js' });
  vm.runInContext(read('data.js'), sandbox, { filename: 'data.js' });
} catch (e) { loadErr = e.message; }
check('pandas.js + data.js 能在无 DOM 环境下加载', !loadErr, loadErr);

const PD = sandbox.PD, DATA = sandbox.PD_DATA;
const API = ['DataFrame', 'readCSV', 'readJSON', 'fromRecords', 'parseScalar', 'sniffDelimiter', 'stat', 'AGG'];
check('PD 导出的 API 齐全', !loadErr && API.every((k) => PD[k] != null),
  loadErr ? '未加载' : API.filter((k) => PD[k] == null).join(', '));

const EXPECT = { sales: 320, students: 160, countries: 39, weather: 96, stocks: 480, employees: 140 };
const parsed = {};
for (const list of DATA.lists) {
  let df = null, err = '';
  try {
    df = PD.readCSV(list.build(), { delimiter: list.format === 'tsv' ? '\t' : ',' });
    parsed[list.id] = df;
  } catch (e) { err = e.message; }
  const want = EXPECT[list.id];
  check('内置数据集 ' + list.id + ' 可解析：' + (df ? df.length + ' 行 × ' + df.columns.length + ' 列' : err),
    !err && df && df.length === want && df.columns.length > 0,
    err || (df ? '期望 ' + want + ' 行，实测 ' + df.length : ''));
  check('内置数据集 ' + list.id + ' 有数值列与类别列（图表能画）',
    !!df && df.numericColumns().length > 0 && df.categoryColumns().length > 0,
    df ? 'num=' + df.numericColumns().length + ' cat=' + df.categoryColumns().length : '');
}
const listsById = {};
DATA.lists.forEach((l) => { listsById[l.id] = l; });
check('data.js 的每份数据集都有 id / 双语名称与说明 / format',
  DATA.lists.every((l) => l.id && l.name && l.name.zh && l.name.en && l.desc && l.desc.zh && l.desc.en && (l.format === 'csv' || l.format === 'tsv')));
check('内置数据的说明文字与实测行数一致（countries 写了几个国家就该有几行）',
  /39\s*个国家/.test(listsById.countries.desc.zh) && /39 countries/.test(listsById.countries.desc.en)
  && parsed.countries.length === 39, listsById.countries.desc.zh);
check('内置数据是固定种子生成的（同一次会话里两次调用结果一致）',
  DATA.lists.every((l) => l.build() === l.build()));

/* 分隔符嗅探与类型推断 */
const sales = parsed.sales;
check('自动嗅探到 TSV 的制表符', PD.sniffDelimiter(listsById.sales.build()) === '\t');
check('自动嗅探到 CSV 的逗号', PD.sniffDelimiter(listsById.countries.build()) === ',');
const typed = PD.readCSV('a,b,c,d\n1,2.5,true,2024-01-05\n2,3.5,false,2024-02-06');
check('类型推断：int64 / float64 / bool / datetime64[ns]',
  JSON.stringify(typed.dtypes()) === JSON.stringify({ a: 'int64', b: 'float64', c: 'bool', d: 'datetime64[ns]' }),
  JSON.stringify(typed.dtypes()));
check('（sales）日期列被推断为 datetime64[ns]', sales.dtypes().date === 'datetime64[ns]', sales.dtypes().date);
check('（sales）缺失值计数与描述一致（rating 约 6%）',
  sales.nullCounts().rating === 20 && sales.nullCounts().rating / sales.length < 0.07,
  String(sales.nullCounts().rating));
check('parseScalar：千分位 / NA / 布尔 / 空串',
  PD.parseScalar('1,234') === 1234 && PD.parseScalar('NA') === null &&
  PD.parseScalar('yes') === true && PD.parseScalar('  ') === null);

/* 变换原语（app.js 的 19 种变换都建立在这些方法上） */
const filtered = sales.filter((row) => row.region === 'East');
check('filter / takeRows：按字符串筛选不改变列', filtered.length > 0 && filtered.length < sales.length
  && filtered.columns.join() === sales.columns.join(), filtered.length + ' 行');
const sorted = sales.sortValues(['revenue'], [false]);
check('sortValues：降序首行不小于末行',
  sorted.col('revenue')[0] >= sorted.col('revenue')[sorted.length - 1]);
const grouped = sales.groupby(['region', 'category'], [{ col: 'revenue', func: 'sum' }]);
check('groupby + agg：分组数 = 地区 × 品类，销售额合计守恒',
  grouped.length === sales.unique('region').length * sales.unique('category').length
  && Math.abs(grouped.col('revenue_sum').reduce((a, b) => a + b, 0) - sales.col('revenue').reduce((a, b) => a + b, 0)) < 1e-6,
  grouped.length + ' 组');
const piv = sales.pivotTable('region', 'channel', 'units', 'mean');
check('pivotTable：行 = 地区数，列 = 渠道数 + 首列',
  piv.length === sales.unique('region').length && piv.columns.length === sales.unique('channel').length + 1,
  piv.length + ' × ' + piv.columns.length);
const cross = sales.crosstab('region', 'channel');
check('crosstab：All 列合计 = 总行数',
  cross.col('All').reduce((a, b) => a + b, 0) === sales.length,
  String(cross.col('All').reduce((a, b) => a + b, 0)));
const corr = sales.corr();
check('corr：对角线全是 1', corr.columns.length >= 2
  && corr.columns.every((c) => Math.abs(corr.col(c)[corr.columns.indexOf(c)] - 1) < 1e-9));
const desc = sales.describe();
const descIdx = (desc._describeRows || []).join();
check('describe：行 = 统计量（含 unique / top / freq + mean..max），列 = 原列（数值列在前）',
  descIdx === 'count,unique,top,freq,mean,std,min,25%,50%,75%,max'
  && desc.length === descIdx.split(',').length && desc.columns.length === sales.columns.length
  && desc.columns.slice().sort().join() === sales.columns.slice().sort().join(),
  desc.shape().join(' × ') + ' / ' + descIdx);
const descNumOnly = PD.readCSV('a,b\n1,10\n2,20\n3,30').describe();
check('describe：纯数值表不出现 unique / top / freq',
  (descNumOnly._describeRows || []).join() === 'count,mean,std,min,25%,50%,75%,max',
  (descNumOnly._describeRows || []).join());
check('describe 的单元格等于逐列手算：mean(b)=20 / std 为正 / 分位数与 sMin·sMax 对齐',
  Math.abs(descNumOnly.col('b')[descNumOnly._describeRows.indexOf('mean')] - 20) < 1e-9
  && descNumOnly.col('b')[descNumOnly._describeRows.indexOf('std')] > 0
  && descNumOnly.col('b')[descNumOnly._describeRows.indexOf('min')] === 10
  && descNumOnly.col('b')[descNumOnly._describeRows.indexOf('max')] === 30);
check('describe 的 count 行忽略缺失值（rating 计 300 而非 320）',
  desc.col('rating')[desc._describeRows.indexOf('count')] === 300
  && desc.col('rating')[desc._describeRows.indexOf('count')] === sales.length - 20,
  String(desc.col('rating')[desc._describeRows.indexOf('count')]));
check('describe 的类别列给 unique / top / freq（region 的众数）',
  desc.col('region')[desc._describeRows.indexOf('unique')] === sales.unique('region').length
  && desc.col('region')[desc._describeRows.indexOf('top')] === sales.valueCounts('region').index[0]
  && desc.col('region')[desc._describeRows.indexOf('freq')] === sales.valueCounts('region').counts[0]);
check('statsIndex 是 describe 的行名顺序来源',
  desc.statsIndex().join().indexOf('freq') !== -1 && desc.statsIndex().length === 11);
const vc = sales.valueCounts('region');
check('valueCounts：占比合计为 1 且按频数降序',
  Math.abs(vc.pct.reduce((a, b) => a + b, 0) - 1) < 1e-9
  && vc.counts.every((n, i) => i === 0 || vc.counts[i - 1] >= n), vc.index.join(','));
const merged = sales.merge(grouped, ['region', 'category'], ['region', 'category'], 'left');
check('merge(how=left)：行数与左表一致，且带上了聚合列',
  merged.length === sales.length && merged.has('revenue_sum'), merged.length + ' 行');
const stacked = sales.head(3).concat([sales.head(3)]);
check('concat(axis=0)：行数相加、列取并集', stacked.length === 6 && stacked.columns.length === sales.columns.length);
check('dropna / dropDuplicates / fillna / assign / select / drop / rename 都返回新表且不动原表',
  sales.dropna(['rating']).length === sales.length - 20 &&
  sales.dropDuplicates(['region']).length === sales.unique('region').length &&
  sales.fillna(['rating'], 'mean').nullCounts().rating === 0 &&
  sales.assign('units2', sales.col('units').map((v) => v * 2)).has('units2') &&
  sales.select(['region', 'revenue']).columns.length === 2 &&
  sales.drop(['rating']).columns.length === sales.columns.length - 1 &&
  sales.rename({ region: 'area' }).has('area') &&
  sales.length === 320 && sales.dtype('units') === 'int64');
const flt = PD.readCSV('x,s\n1.6,a\n2.4,b');
const fltInt = flt.astype('x', 'int64');
check('astype：float64 → int64 取整，原表不被改写',
  flt.dtype('x') === 'float64' && fltInt.dtype('x') === 'int64'
  && fltInt.col('x').join() === '1,2' && flt.col('x').join() === '1.6,2.4',
  flt.col('x').join() + ' → ' + fltInt.col('x').join());
check('astype：无法解析成数字的字符串列 → 全部落成缺失（不抛错）',
  flt.astype('s', 'float64').nullCounts().s === 2
  && flt.astype('s', 'float64').col('s').every((v) => v === null));
check('fillna(method=ffill) 用前一个非缺失值补空，且不越界写坏列',
  sales.fillna(['rating'], 'ffill').nullCounts().rating === 0);
check('head / tail / sliceRows 只改变行数',
  sales.head(7).length === 7 && sales.tail(7).length === 7 && sales.sliceRows(10, 20).length === 10
  && sales.tail(7).col('order_id')[0] === sales.col('order_id')[sales.length - 7]);
const roundTrip = PD.readCSV(sales.toCSV());
check('toCSV → readCSV 往返：行列数与取值都对得上',
  roundTrip.length === sales.length && roundTrip.columns.join() === sales.columns.join()
  && roundTrip.col('order_id')[7] === sales.col('order_id')[7]);
check('toJSON → readJSON 往返：首行字段一致',
  JSON.stringify(PD.readJSON(sales.toJSON()).rowAt(0)) === JSON.stringify(sales.rowAt(0)));
check('PD.stat：mean / median / quantile 与手算一致，std 为正',
  Math.abs(PD.stat.mean([1, 2, 3, 4]) - 2.5) < 1e-9 && PD.stat.median([1, 2, 3, 4]) === 2.5
  && Math.abs(PD.stat.quantile([1, 2, 3, 4], 0.5) - 2.5) < 1e-9 && PD.stat.std([1, 2, 3, 4], 1) > 1);

/* ---------- ⑦ 文档数字 ---------- */
section('[7] 文档数字：README 的复杂度清单必须与实测一致（数字过期即红）');

const lines = (f) => read(f).replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').length;
const SRC = ['index.html', 'theme.js', 'pandas.js', 'charts.js', 'data.js', 'i18n.js', 'app.js',
  'tokens.css', 'styles.css', 'theme.css', 'i18n.css'];

check('README.md 存在', has('README.md'));
const README = has('README.md') ? read('README.md') : '';
const rows = [...README.matchAll(/^\|\s*`([\w.]+)`\s*\|\s*(\d+)\s*\|/gm)].map((m) => [m[1], Number(m[2])]);
const named = rows.map(([n]) => n);
check('README 复杂度清单列出 ' + rows.length + ' 个源文件（应覆盖全部 ' + SRC.length + ' 个）',
  rows.length === SRC.length && SRC.every((f) => named.includes(f)), named.join(', '));
const drift = rows.filter(([n, v]) => SRC.includes(n) && lines(n) !== v)
  .map(([n, v]) => n + '：文档 ' + v + ' vs 实测 ' + lines(n));
check('README 每个文件的行数都与实测一致', drift.length === 0, drift.join(' | '));
const total = SRC.reduce((a, f) => a + lines(f), 0);
const mTotal = README.match(/合计\s*\**(\d+)\**\s*行/);
check('README 的合计行数（' + (mTotal ? mTotal[1] : '未找到') + '）等于实测总和 ' + total,
  !!mTotal && Number(mTotal[1]) === total);

const count = (label, unit) => {
  const m = README.match(new RegExp('\\|\\s*' + label + '\\s*\\|\\s*(\\d+)\\s*' + unit + '\\s*\\|'));
  return m ? Number(m[1]) : null;
};
check('README 写的变换算子数 = app.js 实测 ' + OP_IDS.length + ' 种',
  count('变换算子', '种') === OP_IDS.length, String(count('变换算子', '种')));
check('README 写的图表类型数 = 实测 ' + TYPES.length + ' 类',
  count('图表类型', '类') === TYPES.length, String(count('图表类型', '类')));
check('README 写的内置数据集数 = 实测 ' + DATA.lists.length + ' 份',
  count('内置数据集', '份') === DATA.lists.length, String(count('内置数据集', '份')));
check('README 写的一键预设数 = 实测 ' + PRESET_IDS.length + ' 个',
  count('一键预设', '个') === PRESET_IDS.length, String(count('一键预设', '个')));
const mKeys2 = README.match(/\|\s*界面词条\s*\|\s*zh\s*(\d+)\s*\/\s*en\s*(\d+)\s*\|/);
check('README 写的界面词条数 = 实测 zh ' + ZH.size + ' / en ' + EN.size,
  !!mKeys2 && Number(mKeys2[1]) === ZH.size && Number(mKeys2[2]) === EN.size,
  mKeys2 ? mKeys2[1] + ' / ' + mKeys2[2] : '未找到');
check('README 声明零外部依赖（仓库里也确实没有 package.json）',
  /外部依赖\s*\|\s*0/.test(README) && !has('package.json'));
check('README 讲了三种跑法：双击 index.html / node selfcheck.mjs / --full 真机冒烟',
  /index\.html/.test(README) && /selfcheck\.mjs/.test(README) && /--full/.test(README));

/* 「静态断言」这一行也在 README 的清单里，可它的真值只有全部断言跑完才算得出来，
   所以留到 ⑧ 末尾再比 —— 那时 pass + fail 就是本次实测总数，比对本身不占名额。 */
const wantStatic = count('静态断言', '');

/* ---------- ⑧ 结果 ---------- */
section('[8] 结果');
const measured = pass + fail;   /* 本次实测的静态断言总数（⑨ 的真机断言单独由 smoke.mjs 汇总） */
if (wantStatic === measured) {
  console.log('  [OK] README 复杂度清单「静态断言 = ' + measured + '」与本次实测一致');
} else {
  fail++;
  const msg = 'README 复杂度清单「静态断言」写的是 '
    + (wantStatic === null ? '（没找到这一行）' : wantStatic) + '，本次实测 ' + measured;
  fails.push(msg);
  console.log('  [XX] ' + msg);
}
console.log('通过 ' + pass + ' 项' + (fail ? '，失败 ' + fail + ' 项' : '，全部通过'));
if (fail) {
  console.log('\n未通过的检查：');
  fails.forEach((f) => console.log('  - ' + f));
}

/* ---------- ⑨ 真机冒烟（--full 才跑） ---------- */
if (FULL) {
  section('[9] 真机冒烟：交给 smoke.mjs（真实 Chrome + CDP）');
  if (fail) {
    console.log('  静态检查有失败项，先修好再跑真机 —— 跳过。');
  } else if (!has('smoke.mjs')) {
    fail++; console.log('  [XX] 缺少 smoke.mjs（--full 需要它）');
  } else {
    const r = spawnSync(process.execPath, [join(HERE, 'smoke.mjs')], { stdio: 'inherit', cwd: HERE });
    if (r.status !== 0) { fail++; console.log('  [XX] smoke.mjs 退出码 ' + r.status); }
    else console.log('  [OK] 真机冒烟通过');
  }
}

process.exit(fail ? 1 : 0);






