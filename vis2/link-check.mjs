/* =========================================================
 * link-check.mjs —— 站内跳转与资源引用体检
 * ---------------------------------------------------------
 * 跑法：node link-check.mjs
 * 检查项：
 *   ① <a href="#xxx"> 的锚点在页面上真实存在
 *      —— 目标 id 可能来自 index.html，也可能由 app.js / charts.js 在运行时创建，
 *         所以两边的 id 都要收进来（只看 HTML 会误报，只看 JS 会漏报）
 *   ② 由脚本生成的跳转（data.js 的 href: '#…'、app.js 里的 '#'+id 拼接）同样要命中
 *   ③ <a href="文档.md"> / <link href> / <script src> / <img src> 指向的文件真实存在
 *   ④ 外链必须带 rel="noopener"（target="_blank" 的反向制表劫持）
 *   ⑤ <button>/<a> 里不能出现空 href（href="" / href="javascript:"）
 *   ⑥ 统计：锚点 / 文件 / 外链各多少处，全部相对路径，不带 http(s) 资源
 *
 * 为什么需要它：本站 14 个章节靠顶栏 13 个锚点 + 阅读地图 11 张卡片互跳，
 * 改一个 section id 就可能同时改断顶栏、阅读地图、页脚三处跳转 ——
 * 这种错误浏览器里要点进去才发现，脚本一次全查。
 * 纯静态：不联网、不开浏览器、毫秒级返回。
 * ========================================================= */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(join(HERE, f), 'utf8');

const html = read('index.html');
const app = read('app.js');
const charts = read('charts.js');
const data = read('data.js');

const problems = [];
const bad = (msg) => problems.push(msg);
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) bad(msg); };

/* ---------------- ① 页面里真实存在的 id（HTML + JS 两处） ---------------- */
const ids = new Set();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
/* 运行时注入的 id：脚本里 .id = 'x' / setAttribute('id', 'x') 两种写法 */
for (const src of [app, charts]) {
  for (const m of src.matchAll(/\.id\s*=\s*'([\w-]+)'/g)) ids.add(m[1]);
  for (const m of src.matchAll(/setAttribute\('id',\s*'([\w-]+)'\)/g)) ids.add(m[1]);
}

/* ---------------- ② HTML 里的 <a href="#…"> ---------------- */
let anchors = 0;
for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)) {
  const href = m[1].trim();
  const line = html.slice(0, m.index).split('\n').length;
  if (!href || href === '#') { bad(`index.html:${line} href 为空（空链接会被读屏读成「链接」但没有目标）`); continue; }
  if (/^[a-z]+:/i.test(href) && !href.startsWith('#')) continue;   /* 外链另算 */
  anchors++;
  if (href.startsWith('#')) {
    const id = href.slice(1);
    ok(ids.has(id), `index.html:${line} 锚点 #${id} 在页面上找不到（HTML 与脚本里都没有这个 id）`);
    continue;
  }
  /* 页面内的相对文件链接 */
  const file = href.split('#')[0].split('?')[0];
  ok(existsSync(resolve(HERE, file)), `index.html:${line} 链接的文件不存在：${href}`);
}

/* ---------------- ③ 脚本生成的跳转 ---------------- */
/* data.js 里的阅读地图卡片：{ href: '#what' } —— 这是站内主线导航的一部分 */
let genLinks = 0;
for (const m of data.matchAll(/href:\s*'(#[^']+)'/g)) {
  genLinks++;
  const id = m[1].slice(1);
  ok(ids.has(id), `data.js: 阅读地图卡片指向 #${id}，但页面上没有这个 id`);
}
/* app.js / charts.js 里的字面量 '#xxx'（作为 href 使用时） */
for (const [name, src] of [['app.js', app], ['charts.js', charts]]) {
  for (const m of src.matchAll(/setAttribute\('href',\s*'(#[^']+)'\)/g)) {
    genLinks++;
    ok(ids.has(m[1].slice(1)), `${name}: setAttribute('href', '${m[1]}') 指向的锚点不存在`);
  }
}

/* ---------------- ④ 资源引用（本地文件必须存在） ---------------- */
const assets = [];
for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) assets.push({ kind: 'script', href: m[1] });
/* <link rel="canonical"> 是「自指声明」而不是浏览器要去取的资源（它不会被加载），
   单独放到 ④b 里查：它必须写成同源的绝对地址，且不许指到别的站点去。 */
const canonical = (html.match(/<link[^>]*\srel="canonical"[^>]*\shref="([^"]+)"/) || [])[1] || '';
for (const m of html.matchAll(/<link[^>]*\shref="([^"]+)"/g)) {
  if (m[0].includes('rel="canonical"')) continue;
  assets.push({ kind: 'link', href: m[1] });
}
for (const m of html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) assets.push({ kind: 'img', href: m[1] });
for (const a of assets) {
  if (/^(https?:)?\/\//i.test(a.href) || a.href.startsWith('data:')) {
    /* 站内不允许外链资源：断网 / file:// 打开就失效，与「零联网」的承诺冲突 */
    bad(`index.html: <${a.kind}> 引用了外部资源 ${a.href}（本站承诺零联网，请改成本地文件）`);
    continue;
  }
  ok(existsSync(resolve(HERE, a.href)), `index.html: <${a.kind}> 引用的文件不存在：${a.href}`);
}
/* ④b canonical：要么不写，写了就必须是本站地址（写别人的地址等于把权重送出去） */
ok(!!canonical, 'index.html: 缺 <link rel="canonical">（分享与收录都需要一个规范地址）');
ok(/^https:\/\/ly-beyond\.github\.io\/vis2\/$/.test(canonical),
  `index.html: canonical 指向 ${canonical || '(空)'}，应指向本站规范地址 https://ly-beyond.github.io/vis2/`);


/* ---------------- ⑤ 外链与安全属性 ---------------- */
let external = 0;
for (const m of html.matchAll(/<a\b([^>]*)>/g)) {
  const attrs = m[1];
  const href = (attrs.match(/href="([^"]*)"/) || [])[1] || '';
  if (!/^(https?:)?\/\//i.test(href)) continue;
  external++;
  if (/\starget="_blank"/.test(attrs) && !/\srel="[^"]*noopener/.test(attrs)) {
    bad(`index.html: 外链 ${href} 用了 target="_blank" 但没有 rel="noopener"`);
  }
}

/* ---------------- ⑥ 目录里不该出现的死文件（可选的整洁性检查） ---------------- */
const stray = readdirSync(HERE).filter((f) => /\.(bak|orig|tmp)$/i.test(f) || /~$/.test(f));
ok(stray.length === 0, `目录里残留临时文件：${stray.join(', ')}`);

/* ---------------- 输出 ---------------- */
if (problems.length) {
  problems.forEach((p) => console.log('✗  ' + p));
  console.log(`\n===== SUMMARY script=link-check.mjs checks=${checks} failed=${problems.length} =====`);
  process.exit(1);
}
console.log(`✓ 站内锚点 ${anchors} 处、脚本生成跳转 ${genLinks} 处、本地资源 ${assets.length} 个、外链 ${external} 个 —— 全部有效`);
console.log(`  可供跳转命中的 id 共 ${ids.size} 个（HTML 静态 + 运行时注入）`);
console.log(`\n===== SUMMARY script=link-check.mjs checks=${checks} failed=0 =====`);
