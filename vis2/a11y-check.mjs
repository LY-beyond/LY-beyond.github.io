/* =========================================================
 * a11y-check.mjs —— 无障碍静态体检（对比度 / ARIA / 结构）
 * ---------------------------------------------------------
 * 跑法：node a11y-check.mjs
 *
 * 甲、对比度（WCAG 2.1 1.4.3 / 1.4.11）—— 真正算出来的，不是凭感觉
 *   · 把 tokens.css 解析成「亮 / 暗」两张令牌表；
 *   · 支持 #hex / var() / color-mix(in srgb, …) 三种写法，带 alpha 的会先在
 *     背景上做合成，再按 WCAG 相对亮度公式算比值；
 *   · 逐条列出「站内真实出现的 前景 / 背景 组合」与各自门槛：
 *       正文与说明文字 ≥ 4.5:1、大字与图形元素 ≥ 3:1、焦点环 ≥ 3:1；
 *   · 顺带核对 tokens.css 注释里写的对比度数字 —— 注释写了 6.28:1，
 *     实测就得是 6.28:1，否则「注释即文档」也会随改色悄悄过期。
 *   · 为什么不检查 x 与 y：见文件末尾「刻意不检查的三件事」。
 *
 * 乙、ARIA 与结构
 *   · id 唯一；aria-labelledby / aria-describedby / aria-controls / for 指向的 id 存在
 *   · 每个交互控件都有可及名（文本或 aria-label）；<button> 必须写 type
 *   · 每张图都有 role="img" + aria-label（运行时注入）且配一份「数据表」等价物
 *   · 唯一 <h1>、标题层级不跳级、landmark 齐全、skip-link 是第一个可聚焦元素
 *   · tabindex 不为正数、aria-hidden 的子树里没有可聚焦元素
 *   · role 取值在白名单内（写错 role 会被读屏整块忽略）
 *
 * 纯静态：不联网、不开浏览器、毫秒级返回。
 * ========================================================= */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(join(HERE, f), 'utf8');

const problems = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) problems.push(msg); };

/* =========================================================
 * 一、颜色计算
 * ========================================================= */
const parseHex = (hex) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 1];
};

/* 从 tokens.css 里切出亮 / 暗两张表 */
function parseTokens(css) {
  const grab = (block) => {
    const map = new Map();
    const re = /(--[\w-]+):\s*([^;]+);/g;
    let m;
    while ((m = re.exec(block))) map.set(m[1], m[2].trim());
    return map;
  };
  const darkStart = css.indexOf(':root[data-theme="dark"]');
  const lightBlock = css.slice(0, darkStart);
  const darkBlock = css.slice(darkStart);
  const light = grab(lightBlock);
  /* 深色块只覆盖部分令牌，没覆盖的沿用 :root（与浏览器的级联一致） */
  const dark = new Map([...light, ...grab(darkBlock)]);
  return { light, dark };
}

/* 解析一条颜色声明：hex / var(--x) / color-mix(in srgb, <color> P%, <color> Q%) */
function resolve(decl, theme, tokens, depth) {
  if (decl == null) return null;
  let v = String(decl).trim();
  if ((depth = depth || 0) > 8) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return parseHex(v);
  const varM = v.match(/^var\((--[\w-]+)\)$/);
  if (varM) return resolve(tokens.get(varM[1]), theme, tokens, depth + 1);
  const mixM = v.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+?)(?:\s+(\d+(?:\.\d+)?)%)?\s*\)$/);
  if (mixM) {
    const a = resolve(mixM[1], theme, tokens, depth + 1);
    const b = resolve(mixM[3], theme, tokens, depth + 1);
    if (!a || !b) return null;
    const wa = Number(mixM[2]), wb = mixM[4] == null ? 100 - wa : Number(mixM[4]);
    const sum = wa + wb || 1;
    /* CSS 的 color-mix 在「预乘 alpha」空间里混合：
       color-mix(in srgb, #0f766e 72%, transparent) 得到的是 rgba(15,118,110,.72)，
       而不是把白色按 28% 掺进去 —— 这里必须按规范算，否则焦点环、半透明底全都会算错。 */
    const alpha = (a[3] * wa + b[3] * wb) / sum;
    if (alpha === 0) return [0, 0, 0, 0];
    const out = [0, 1, 2].map((i) => (a[i] * a[3] * wa + b[i] * b[3] * wb) / sum / alpha);
    return [out[0], out[1], out[2], alpha];
  }
  if (v === 'transparent') return [255, 255, 255, 0];
  return null;   /* 渐变 / 关键字色：交给「刻意不检查的三件事」 */
}

const luminance = (rgb) => {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
/* 前景带 alpha 时先与背景合成（等价于浏览器把半透明文字压在不透明底上） */
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
const contrast = (fg, bg) => {
  const f = fg[3] < 1 ? over(fg, bg) : fg;
  const a = luminance(f), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const hex = (rgb) => '#' + rgb.slice(0, 3).map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

const css = read('tokens.css');
const TOK = parseTokens(css);


/* color-mix 里的百分比可能是 var()（如 var(--mix-soft)）：先展开成字面量 */
const expandPercents = (decl, tokens) => String(decl).replace(/var\((--[\w-]+)\)/g, (m, name) => {
  const v = tokens.get(name);
  return v && /^[\d.]+%$/.test(v) ? v : m;
});
const mix = (a, p, b) => `color-mix(in srgb, var(${a}) ${p}, var(${b}))`;

/* =========================================================
 * 二、对比度矩阵：站内真实出现的前景 / 背景组合
 * ========================================================= */
const PAIRS = [
  { what: '正文 / 页面底', fg: 'var(--c-text)', bg: 'var(--c-bg)', min: 4.5, where: '整页正文' },
  { what: '正文 / 卡片', fg: 'var(--c-text)', bg: 'var(--c-surface)', min: 4.5, where: '卡片、提示气泡' },
  { what: '正文 / 次级面板', fg: 'var(--c-text)', bg: 'var(--c-surface-2)', min: 4.5, where: '对比表头、次级底色' },
  { what: '次级正文 / 卡片', fg: 'var(--c-text-soft)', bg: 'var(--c-surface)', min: 4.5, where: '气泡行、单位说明（12.5px）' },
  { what: '次级正文 / 次级面板', fg: 'var(--c-text-soft)', bg: 'var(--c-surface-2)', min: 4.5, where: '次级底色上的行内说明 / 口径徽章（.prov-badge，11.5px）' },
  { what: '说明文字 / 卡片', fg: 'var(--c-muted)', bg: 'var(--c-surface)', min: 4.5, where: '.card-note / .viz-hint（11.5–12.5px）' },
  { what: '说明文字 / 次级面板', fg: 'var(--c-muted)', bg: 'var(--c-surface-2)', min: 4.5, where: '.cmp thead th（12px）' },
  { what: '说明文字 / 页面底', fg: 'var(--c-muted)', bg: 'var(--c-bg)', min: 4.5, where: '.hero-hint（13px）、页脚' },
  { what: '主色文字 / 主色悬停底', fg: 'var(--c-primary)', bg: mix('--c-primary', 'var(--mix-soft)', '--c-surface'), min: 4.5, where: '按钮 / 预设悬停（.viz-btn:hover）' },
  { what: '主色文字 / 主色浅底', fg: 'var(--c-primary)', bg: 'var(--c-primary-weak)', min: 4.5, where: '按下态开关（.viz-btn.is-on）' },
  { what: '主色文字 / 卡片', fg: 'var(--c-primary)', bg: 'var(--c-surface)', min: 4.5, where: '.section-num / .kpi-value / .source-idx' },
  { what: '主色文字 / 主色浅底', fg: 'var(--c-primary)', bg: mix('--c-primary', 'var(--mix-soft)', '--c-surface'), min: 4.5, where: '主色徽章' },
  { what: '强调色文字 / 强调色浅底', fg: 'var(--c-accent-ink)', bg: mix('--c-accent', 'var(--mix-soft)', '--c-surface'), min: 4.5, where: '.force-tag（11px）' },
  { what: '强调色文字 / 卡片', fg: 'var(--c-accent-ink)', bg: 'var(--c-surface)', min: 4.5, where: '播放器选中态按钮' },
  { what: '强调色图形 / 卡片', fg: 'var(--c-accent)', bg: 'var(--c-surface)', min: 3, where: '按钮描边、播放器轨道（非文字）' },
  { what: '主色块上的前景', fg: 'var(--c-on-primary)', bg: 'var(--c-primary)', min: 4.5, where: '主色按钮 / 徽章' },
  { what: '强调色块上的前景', fg: 'var(--c-on-accent)', bg: 'var(--c-accent)', min: 4.5, where: '强调色徽章' },
  { what: '信息色文字 / 卡片', fg: 'var(--c-info)', bg: 'var(--c-surface)', min: 4.5, where: '语义徽章（11.5px）' },
  { what: '成功色文字 / 卡片', fg: 'var(--c-success)', bg: 'var(--c-surface)', min: 4.5, where: '.sim-out-delta.is-up（11.5px）' },
  { what: '警示色文字 / 卡片', fg: 'var(--c-warn)', bg: 'var(--c-surface)', min: 4.5, where: '语义徽章' },
  { what: '危险色文字 / 卡片', fg: 'var(--c-danger)', bg: 'var(--c-surface)', min: 4.5, where: '.viz-error（13px）' },
  { what: '焦点环 / 卡片', fg: 'var(--c-focus)', bg: 'var(--c-surface)', min: 3, where: ':focus-visible 描边（非文字）' },
  { what: '焦点环 / 页面底', fg: 'var(--c-focus)', bg: 'var(--c-bg)', min: 3, where: '顶栏按钮焦点' },
  { what: '数据底色 / 轨道', fg: 'var(--s-base)', bg: 'var(--c-surface-2)', min: 1.9, where: '条形 / 面积填充（靠标签读数，基线 1.9:1）' },
  { what: '数据底色 / 轨道（备用色）', fg: 'var(--s-base-alt)', bg: 'var(--c-surface-2)', min: 1.9, where: '第二系列填充' },
  { what: '数据底色 / 轨道（中性）', fg: 'var(--s-base-warm)', bg: 'var(--c-surface-2)', min: 1.9, where: '第三系列填充' },
  { what: '正文压在数据底色上', fg: 'var(--c-text)', bg: 'var(--s-base)', min: 4.5, where: '条形内的数值标签' },
  /* 口径徽章左边的圆点：它承载「这批数据有多硬」，不是纯装饰，
     所以按 WCAG 1.4.11「非文字对比度」卡 3:1（背景是徽章自己的次级底色） */
  { what: '口径圆点 / 徽章底', fg: 'var(--c-success)', bg: 'var(--c-surface-2)', min: 3, where: '.prov-badge[data-prov="sourced"]::before（非文字）' },
  { what: '口径圆点 / 徽章底', fg: 'var(--c-info)', bg: 'var(--c-surface-2)', min: 3, where: '.prov-badge[data-prov="modeled"]::before（非文字）' },
  { what: '口径圆点 / 徽章底', fg: 'var(--c-warn)', bg: 'var(--c-surface-2)', min: 3, where: '.prov-badge[data-prov="projected"]::before（非文字）' }
];

const rows = [];
let contrastFails = 0;
for (const theme of ['light', 'dark']) {
  const tokens = TOK[theme];
  for (const p of PAIRS) {
    const fg = resolve(expandPercents(p.fg, tokens), theme, tokens);
    const bg = resolve(expandPercents(p.bg, tokens), theme, tokens);
    if (!fg || !bg) { rows.push({ theme, ...p, ratio: null }); continue; }
    const ratio = contrast(fg, bg);
    const pass = ratio >= p.min;
    if (!pass) contrastFails++;
    rows.push({ theme, ...p, ratio, pass, fgHex: hex(fg), bgHex: hex(bg) });
  }
}

const themeName = { light: '亮色', dark: '暗色' };
console.log('对比度矩阵（WCAG 2.1）：');
for (const r of rows) {
  const tag = r.ratio == null ? '跳过' : (r.pass ? 'OK  ' : 'FAIL');
  const val = r.ratio == null ? '（含渐变/关键字色，未计算）' : `${r.ratio.toFixed(2)}:1 ≥ ${r.min}`;
  console.log(`  ${tag} [${themeName[r.theme]}] ${r.what.padEnd(24, '　')} ${val.padEnd(16)} ${r.where}`);
  if (r.ratio != null && !r.pass) {
    ok(false, `${themeName[r.theme]}主题「${r.what}」对比度只有 ${r.ratio.toFixed(2)}:1，低于门槛 ${r.min}:1（用于 ${r.where}）→ 改 tokens.css 里的相关令牌`);
  } else {
    checks++;
  }
}

/* ---------------- tokens.css 注释里写的对比度，必须与实测一致 ---------------- */
/* 注释形如「（2.09:1 / 6.28:1）」或「（对轨道 2.71:1 / 深字 4.84:1）」：把两个比值都抠出来 */
const commentRatios = [];
for (const theme of ['light', 'dark']) {
  const block = theme === 'light' ? css.slice(0, css.indexOf(':root[data-theme="dark"]')) : css.slice(css.indexOf(':root[data-theme="dark"]'));
  for (const m of block.matchAll(/--(s-[\w-]+):\s*(#[0-9a-f]{3,8});[^\n]*?（[^）]*?([\d.]+):1[^）]*?([\d.]+):1[^）]*?）/g)) {
    const tokens = TOK[theme];
    const fill = resolve('var(--' + m[1] + ')', theme, tokens);
    const track = resolve('var(--c-surface-2)', theme, tokens);
    const text = resolve('var(--c-text)', theme, tokens);
    const r1 = contrast(fill, track), r2 = contrast(text, fill);
    const want1 = Number(m[3]), want2 = Number(m[4]);
    const near = (a, b) => Math.abs(a - b) < 0.03;
    commentRatios.push(`--${m[1]}（${themeName[theme]}）注释 ${want1}:1 / ${want2}:1 ↔ 实测 ${r1.toFixed(2)}:1 / ${r2.toFixed(2)}:1`);
    ok(near(r1, want1), `tokens.css 注释过期：--${m[1]}（${themeName[theme]}）写着对轨道 ${want1}:1，实测 ${r1.toFixed(2)}:1`);
    ok(near(r2, want2), `tokens.css 注释过期：--${m[1]}（${themeName[theme]}）写着压正文 ${want2}:1，实测 ${r2.toFixed(2)}:1`);
  }
}


/* =========================================================
 * 三、ARIA 与文档结构
 * ========================================================= */
const html = read('index.html');
const app = read('app.js');
const charts = read('charts.js');

/* 页面里存在的 id：HTML 静态 + 脚本运行时注入（.id = 'x' / setAttribute('id', 'x')） */
const ids = new Set();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
for (const src of [app, charts]) {
  for (const m of src.matchAll(/\.id\s*=\s*'([\w-]+)'/g)) ids.add(m[1]);
  for (const m of src.matchAll(/setAttribute\('id',\s*'([\w-]+)'\)/g)) ids.add(m[1]);
}
/* ① id 唯一 */
const seen = new Map();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
[...seen].forEach(([id, n]) => ok(n === 1, `index.html: id="${id}" 重复出现 ${n} 次（重复 id 会让锚点与 aria 引用指错元素）`));

/* ② ARIA 引用完整性 */
for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for']) {
  for (const m of html.matchAll(new RegExp(attr + '="([^"]+)"', 'g'))) {
    for (const ref of m[1].trim().split(/\s+/)) {
      if (!ref) continue;
      ok(ids.has(ref), `index.html: ${attr}="${ref}" 指向的 id 不存在`);
    }
  }
}

/* ③ 交互元素的可及名（HTML 里的静态部分；运行时由 smoke.mjs 真机兜底） */
const nameable = (attrs, inner) => {
  /* 名字可以来自静态 aria-label，也可以来自 data-i18n-attr（运行时由 i18n.js 写进去，如「展开导航」） */
  if (/aria-label="[^"]+"/.test(attrs) || /data-i18n-attr="[^"]*aria-label:/.test(attrs)) return true;
  const text = inner.replace(/<[^>]+>/g, '').trim();
  return /[A-Za-z0-9\u4e00-\u9fff]/.test(text);
};
for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
  ok(nameable(m[2], m[3]), `index.html: <${m[1]}${m[2].slice(0, 40)}…> 没有可及名（既无文本也无 aria-label）`);
}
for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
  ok(/\salt="[^"]*"/.test(m[1]), 'index.html: <img> 缺少 alt（纯装饰请写 alt=""）');
}

/* ④ 标题层级：唯一 h1、不跳级（HTML 静态骨架） */
const heads = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
ok(heads.filter((h) => h === 1).length === 1, `index.html: <h1> 应恰好 1 个，实际 ${heads.filter((h) => h === 1).length} 个`);
let prev = 0;
for (const h of heads) {
  ok(h <= prev + 1, `index.html: 标题层级跳级（h${prev} → h${h}）`);
  prev = h;
}

/* ⑤ landmark 与跳转 */
for (const [tag, what] of [['header', '页头'], ['main', '主内容'], ['nav', '导航'], ['footer', '页脚']]) {
  ok(new RegExp('<' + tag + '\\b').test(html), `index.html: 缺少 <${tag}>（${what} landmark）`);
}
ok(/<main\b[^>]*\sid="main"/.test(html), 'index.html: <main> 应带 id="main"，否则「跳到正文」无处可去');
ok(/<nav\b[^>]*aria-label=/.test(html), 'index.html: <nav> 应带 aria-label（多个导航区时读屏要能区分）');
const firstAnchor = (html.match(/<a\b[^>]*href="#([\w-]+)"/) || [])[1];
ok(!!firstAnchor && ids.has(firstAnchor), 'index.html: 可聚焦顺序里的第一个链接应是「跳到正文」，且指向存在的 id');
ok(/<html lang="zh-CN">/.test(html), 'index.html: <html> 必须声明 lang（读屏按它选发音）');

/* ⑥ 键盘可达性 */
for (const m of html.matchAll(/tabindex="(-?\d+)"/g)) {
  ok(Number(m[1]) <= 0, `index.html: tabindex="${m[1]}" 为正数会打乱键盘顺序（>0 一律不允许）`);
}
/* 图形内可点的地方必须有键盘等价物：下拉选择器 + 数据表 */
ok(/'select'/.test(app), 'app.js: 行业联动的键盘等价物（<select>）不见了 —— 只靠点气泡，键盘与读屏用户无法筛选');
/* 时间线的键盘路径（P3）：10 个节点共用**一个** Tab 停点（容器上的 tabindex），
   方向键在 charts.js 的焦点环之间移动，当前节点由 role="status" 播报。
   注意这里查的是「有没有这条路」，真机按键由 smoke.mjs 走一遍。 */
ok(/host\.setAttribute\('tabindex',\s*'0'\)/.test(app),
  'app.js: 时间线容器应设 tabindex="0" —— 否则整条时间线只有鼠标能看（10 个节点各挂一个 tabindex 是更糟的做法，见 README）');
ok(/aria-describedby',\s*hintId/.test(app) && /timeline\.keys/.test(app),
  'app.js: 时间线要有一条「方向键怎么用」的提示，并用 aria-describedby 挂到容器上（没人知道的功能等于没有）');
ok(/role',\s*'status'/.test(app) && /timeline\.node/.test(app),
  'app.js: 时间线节点切换要有 role="status" 播报（用词表的 timeline.node），图形在 aria-hidden 里读屏读不到');


/* ⑦ 每张图：容器可及名 + 数据表等价物 + 内部 SVG 隐藏 */
const hostIds = [...html.matchAll(/id="(chart-[\w-]+|sim-root)"/g)].map((m) => m[1]);
const labelled = new Set([...app.matchAll(/\['([\w-]+)',\s*D\./g)].map((m) => m[1]));
const toolNames = new Set([...app.matchAll(/name:\s*'([\w-]+)'/g)].map((m) => m[1]));
ok(hostIds.length >= 14, `index.html: 图表容器应有 14 个（13 张图 + 模拟器），实际 ${hostIds.length}`);
for (const id of hostIds) {
  ok(labelled.has(id), `app.js: 容器 #${id} 没有进「role=img + aria-label」配对表 → 读屏只会念「图片」`);
  if (id === 'sim-root') continue;   /* 模拟器是一组控件，不是单张图，没有「数据表」视图 */
  const name = id.replace('chart-', '');
  ok(toolNames.has(name), `app.js: #${id} 没有 chartTools({name:'${name}'}) → 该图缺少「数据表」无障碍等价物`);
}
const svgBlocks = [...charts.matchAll(/el\('svg',\s*\{([\s\S]*?)\}\)/g)];
ok(svgBlocks.length >= 2, `charts.js: 只找到 ${svgBlocks.length} 处 SVG 画布创建，检查规则可能过期`);
svgBlocks.forEach((m, i) => {
  ok(/'aria-hidden':\s*'true'/.test(m[1]), `charts.js: 第 ${i + 1} 个 SVG 画布应写 aria-hidden（可及名由外层容器承载，内部图形再报一次就成了无名图片）`);
  ok(!/role:\s*'img'/.test(m[1]), `charts.js: 第 ${i + 1} 个 SVG 画布不要写 role="img"（外层容器已有），否则读屏会播报两遍`);
});
/* 引擎里的按钮：必须有 type="button"，否则放在表单语境里会触发提交 */
for (const [f, src] of [['app.js', app], ['charts.js', charts]]) {
  const btnCount = (src.match(/createElement\('button'\)|node\('button'/g) || []).length;
  const typed = (src.match(/\.type = 'button'/g) || []).length;
  ok(btnCount === typed, `${f}: 生成 ${btnCount} 个按钮，却只给 ${typed} 个设了 type="button"`);
}
/* 运行时状态播报：筛选 / 模拟器 / 地图高亮都要能「说」出来 */
ok((app.match(/setAttribute\('role', 'status'\)/g) || []).length >= 3,
  'app.js: role="status" 的实时播报区应覆盖筛选、模拟器与地图高亮三处');
ok(/setAttribute\('aria-pressed'/.test(app), 'app.js: 切换类按钮（图表/数据表、播放）应维护 aria-pressed');
ok(/aria-expanded/.test(app), 'app.js: 移动端导航抽屉应维护 aria-expanded');

/* ⑧ role 取值白名单（写错的 role 会被读屏整块当成普通 div） */
const ROLE_OK = new Set(['group', 'status', 'img', 'navigation', 'main', 'banner', 'contentinfo',
  'button', 'switch', 'list', 'listitem', 'presentation', 'none', 'region', 'toolbar', 'progressbar', 'alert']);
for (const [f, src] of [['index.html', html], ['app.js', app], ['charts.js', charts]]) {
  for (const m of src.matchAll(/role="?([\w-]+)"?/g)) {
    ok(ROLE_OK.has(m[1]), `${f}: role="${m[1]}" 不在允许清单内（打错 role 等于没写）`);
  }
}

/* =========================================================
 * 四、刻意不检查的三件事（写下来，免得以后被当成漏检）
 *   · 卡片描边、分隔线（--c-border / --c-line）不设门槛：它们不是承载信息的控件边界，
 *     加深会破坏纸感层次；真正决定可用性的是文字与数据图形色。
 *   · 渐变底（首屏光晕、进度条）不做自动判定：文字会跨越渐变的两端，
 *     静态脚本无法知道它压在哪一段上，只在改色时人工目视亮暗两档各一次。
 *   · 运行时注入的按钮文案、聚焦顺序、读屏实际发音交给 smoke.mjs 真机断言，
 *     静态脚本只守住「代码里写了什么」。
 * ========================================================= */

/* ---------------- 输出 ---------------- */
if (problems.length) {
  problems.forEach((p) => console.log('✗  ' + p));
  console.log(`\n===== SUMMARY script=a11y-check.mjs checks=${checks} failed=${problems.length} =====`);
  process.exit(1);
}
console.log(`\n✓ 对比度 ${rows.filter((r) => r.ratio != null).length} 组（亮 / 暗两档主题）全部达标`);
commentRatios.forEach((c) => console.log('✓ tokens.css 注释与实测一致：' + c));
console.log(`✓ ARIA 与结构：id 唯一、${hostIds.length} 个图表容器有可及名与数据表等价物、标题层级、landmark、焦点顺序`);
console.log(`\n===== SUMMARY script=a11y-check.mjs checks=${checks} failed=0 =====`);
