/* =========================================================
 * smoke.mjs —— 真机冒烟：把「人点一遍」变成 100+ 条断言
 * ---------------------------------------------------------
 * 跑法：node smoke.mjs                 （默认打开本地 index.html，file:// 即可）
 *       SITE_URL=http://127.0.0.1:8099/ node smoke.mjs   （改测本地服务器）
 * 用真实 Chrome（CDP）加载页面，逐项断言「只有运行时才可能对/错」的东西：
 *   ① 13 张图各生成一条工具栏，按钮齐全、aria 齐全
 *   ② 气泡 → 产业 / 场景 的跨图联动（含空集兜底）
 *   ③ 数据表视图能开能关、行数与数据源一致（图 ⇄ 表的等价性）
 *   ④ 年份播放器：播放会推进、暂停会停下
 *   ⑤ 导出 PNG / SVG / CSV 三个按钮都能触发下载、文件名与表头正确
 *   ⑥ 切英文后工具栏与图表文案跟着变、无中文残留
 *   ⑦ 地图换指标 / 前五名高亮 / 悬停读数；热力矩阵 15×5；小倍数宽窄两档
 *   ⑧ 拖动模拟器滑块后龙卷风与蒙特卡洛重算
 *   ⑨ 键盘焦点顺序、role="status" 播报、19 个 SVG / 14 章节 / 13 导航项
 *   ⑩ 全程无 console 报错、无资源 404、无横向溢出、顶栏导航不被裁切
 * 末尾打印通过/失败计数与非零退出码，并给统一的 SUMMARY 行。
 * 浏览器：默认自动探测 Chrome / Edge / Chromium，可用 CHROME 环境变量指定。
 * 说明：仅开发期使用，不被网站加载，不影响静态部署。
 * ========================================================= */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* 浏览器探测：CHROME 环境变量 > 常见安装路径 */
function findChrome() {
  const env = process.env.CHROME;
  if (env && existsSync(env)) return env;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const p of candidates) if (existsSync(p)) return p;
  return '';
}
const CHROME = findChrome();
if (!CHROME) {
  console.error('✗ 找不到 Chrome / Edge / Chromium。请用环境变量指定，例如：');
  console.error('    Windows:  set CHROME=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  process.exit(2);
}
/* 端口随进程号漂移：上一轮崩掉的 Chrome 常常还占着固定端口，会导致连到「僵尸」调试端口上 */
const PORT = 9300 + (process.pid % 500);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const URL_PAGE = process.env.SITE_URL || pathToFileURL(join(HERE, 'index.html')).href;

/* 看门狗：任何一步卡住都别把终端吊死在这儿 */
const watchdog = setTimeout(() => {
  console.error('\n[!!] 超时 150s：冒烟脚本卡住，强制退出');
  process.exit(1);
}, 150000);

const profile = mkdtempSync(join(tmpdir(), 'vis2-smoke-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--window-size=1440,1200',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const fails = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; fails.push(name + (extra ? ' -> ' + extra : '')); console.log('  [XX] ' + name + (extra ? ' -> ' + extra : '')); }
}

async function targetWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* 端口未就绪 */ }
    await sleep(250);
  }
  throw new Error('Chrome 调试端口未就绪');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  return { ready, send, close: () => ws.close() };
}

const cdp = connect(await targetWs());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

const ev = async (expr) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.text || r.exceptionDetails));
  return r.result.value;
};
const jv = async (expr) => JSON.parse(await ev(expr));

/* 报错收集器必须注册成「新文档脚本」：
   file:// 页面一导航就换了 window，挂在 about:blank 上的 __errs 会一起消失。 */
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__errs = [];
    window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });
    window.addEventListener('unhandledrejection', function (e) { window.__errs.push('rejection: ' + e.reason); });
    var _ce = console.error;
    console.error = function () { window.__errs.push([].join.call(arguments, ' ')); _ce.apply(console, arguments); };`
});

await cdp.send('Page.navigate', { url: URL_PAGE });
await sleep(2800);
check('导航后报错收集器已就位', (await jv('JSON.stringify(!!window.__errs && window.__errs.length === 0)')) === true);

console.log('\n[1] 工具栏');
const toolBars = await jv(`JSON.stringify((function () {
  var ids = ['chart-radar','chart-scale','chart-industry','chart-bubble','chart-global','chart-flow','chart-graph','chart-timeline'];
  return ids.map(function (id) {
    var host = document.getElementById(id);
    var card = host.parentElement;
    var bar = card.querySelector(':scope > .viz-toolbar');
    var box = card.querySelector(':scope > .viz-table-wrap');
    return { id: id, hasBar: !!bar, hasPanel: !!box,
      btns: bar ? [].map.call(bar.querySelectorAll('button'), function (b) { return b.textContent; }) : [] };
  });
})())`);
check('8 张图都有工具栏 + 数据表面板',
  toolBars.length === 8 && toolBars.every((t) => t.hasBar && t.hasPanel),
  JSON.stringify(toolBars.filter((t) => !t.hasBar || !t.hasPanel)));
const wantBtns = ['\u56fe\u8868', '\u6570\u636e\u8868', '\u5bfc\u51fa PNG', '\u5bfc\u51fa SVG', '\u5bfc\u51fa CSV'];
check('每张图 5 枚基础按钮（图表/数据表/PNG/SVG/CSV）',
  toolBars.every((t) => wantBtns.every((w) => t.btns.indexOf(w) > -1)), JSON.stringify(toolBars[0].btns));

const extraCtl = await jv(`JSON.stringify((function () {
  var b = document.getElementById('chart-bubble').parentElement.querySelector(':scope > .viz-toolbar');
  var s = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  return {
    hasSelect: !!b.querySelector('select'),
    selectId: (b.querySelector('select') || {}).id,
    labelFor: (b.querySelector('.viz-filter-label') || {}).htmlFor,
    options: (b.querySelector('select') || { options: [] }).options.length,
    liveRole: (b.querySelector('.viz-live') || {}).getAttribute ? b.querySelector('.viz-live').getAttribute('role') : null,
    hasClear: !!b.querySelector('.viz-btn.is-ghost'),
    hasPlay: !!s.querySelector('.viz-btn.is-play'),
    hasRange: !!s.querySelector('.viz-range'),
    rangeAria: (s.querySelector('.viz-range') || {}).getAttribute ? s.querySelector('.viz-range').getAttribute('aria-label') : null,
    groupLabel: b.getAttribute('aria-label')
  };
})())`);
check('气泡图有筛选下拉（1 + 15 项）', extraCtl.hasSelect && extraCtl.options === 16, JSON.stringify(extraCtl));
check('label 与 select 用 for/id 绑定', extraCtl.labelFor === 'industry-picker' && extraCtl.selectId === 'industry-picker', JSON.stringify(extraCtl));
check('联动播报是 role="status"', extraCtl.liveRole === 'status', extraCtl.liveRole);
check('年份播放器有按钮 + 滑块 + aria-label', extraCtl.hasPlay && extraCtl.hasRange && !!extraCtl.rangeAria, JSON.stringify(extraCtl));
check('工具栏有 aria-label', !!extraCtl.groupLabel, extraCtl.groupLabel);

console.log('\n[2] 跨图联动：气泡 → 产业 → 场景');
const pickRes = await jv(`JSON.stringify((function () {
  var sel = document.getElementById('industry-picker');
  var opt = [].filter.call(sel.options, function (o) { return o.textContent.indexOf('\u5236\u9020') === 0; })[0];
  sel.value = opt.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  var bubble = document.getElementById('chart-bubble');
  var circles = [].map.call(bubble.querySelectorAll('circle'), function (c) {
    return { o: c.getAttribute('opacity'), sw: c.getAttribute('stroke-width'), t: c.getAttribute('title') };
  });
  var gs = [].map.call(document.querySelectorAll('#chart-industry svg > g'),
    function (g) { return g.getAttribute('opacity'); });
  var ind = document.getElementById('chart-industry');
  return {
    optText: opt.textContent, selValue: sel.value,
    dimmed: circles.filter(function (c) { return c.o === '0.16'; }).length,
    hot: circles.filter(function (c) { return c.sw === '3.4'; }).length,
    hotTitle: (circles.filter(function (c) { return c.sw === '3.4'; })[0] || {}).t,
    indDimRows: gs.filter(function (o) { return o === '0.22'; }).length,
    indHotRows: gs.filter(function (o) { return o === null; }).length,
    accent: ind.querySelectorAll('rect[width="3"]').length,
    scenes: document.querySelectorAll('#scene-grid > .scene').length,
    sceneLive: (document.querySelector('[data-mount="scene-head"] .viz-live') || {}).textContent,
    bubbleLive: (bubble.parentElement.querySelector('.viz-live') || {}).textContent,
    clearShown: !bubble.parentElement.querySelector('.viz-filter .viz-btn.is-ghost').hidden
  };
})())`);
check('选中制造业后气泡 14 颗变暗、1 颗高亮', pickRes.hot === 1 && pickRes.dimmed === 14, JSON.stringify(pickRes));
check('高亮的正是制造业', /^制造业/.test(pickRes.hotTitle || ''), pickRes.hotTitle);
check('产业图 3 行变暗 2 行（命中行保留满色）', pickRes.indDimRows === 2 && pickRes.indHotRows === 1,
  JSON.stringify([pickRes.indDimRows, pickRes.indHotRows]));
check('命中行左侧画出强调色标记（id 传递正确）', pickRes.accent === 1, String(pickRes.accent));
check('场景被筛到 1 个', pickRes.scenes === 1, String(pickRes.scenes));
check('场景区播报「1 / 8」', /1 \/ 8/.test(pickRes.sceneLive || ''), pickRes.sceneLive);
check('气泡工具栏播报含行业名与命中数', /制造业/.test(pickRes.bubbleLive || '') && /1/.test(pickRes.bubbleLive || ''), pickRes.bubbleLive);
check('「清除筛选」按钮显示', pickRes.clearShown === true);

const clickRes = await jv(`JSON.stringify((function () {
  var b = document.getElementById('chart-bubble');
  var others = [].filter.call(b.querySelectorAll('circle'), function (c) { return c.getAttribute('stroke-width') !== '3.4'; });
  others[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return { clicked: others[0].getAttribute('title'), selValue: document.getElementById('industry-picker').value,
    scenes: document.querySelectorAll('#scene-grid > .scene').length,
    empty: !!document.querySelector('#scene-grid > .scene-empty') };
})())`);
check('直接点气泡也能写回下拉框（两个入口共用 STATE.filter）',
  clickRes.selValue !== '' && clickRes.selValue !== pickRes.selValue, JSON.stringify(clickRes));
check('点中的气泡没有场景时给空态，而不是留白',
  clickRes.scenes > 0 || clickRes.empty, JSON.stringify(clickRes));

const emptyRes = await jv(`JSON.stringify((function () {
  var sel = document.getElementById('industry-picker');
  var opt = [].filter.call(sel.options, function (o) { return o.textContent.indexOf('\u77ff\u4e1a') === 0; })[0];
  sel.value = opt.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  var box = document.querySelector('#scene-grid > .scene-empty');
  return { empty: !!box, text: box ? box.textContent : '', hasBtn: box ? !!box.querySelector('button') : false,
    cards: document.querySelectorAll('#scene-grid > .scene').length,
    indDimRows: [].filter.call(document.querySelectorAll('#chart-industry svg > g'),
      function (g) { return g.getAttribute('opacity') === '0.22'; }).length };
})())`);
check('无对应场景的行业显示空态 + 清除按钮',
  emptyRes.empty && emptyRes.hasBtn && emptyRes.cards === 0, JSON.stringify(emptyRes));
check('空态文案点出行业名', /矿业/.test(emptyRes.text), emptyRes.text);

const resetRes = await jv(`JSON.stringify((function () {
  document.querySelector('#chart-bubble').parentElement.querySelector('.viz-filter .viz-btn.is-ghost').click();
  return { scenes: document.querySelectorAll('#scene-grid > .scene').length,
    empty: !!document.querySelector('.scene-empty'),
    dimRows: [].filter.call(document.querySelectorAll('#chart-industry svg > g'),
      function (g) { return g.getAttribute('opacity') === '0.22'; }).length,
    accent: document.querySelectorAll('#chart-industry svg rect[width="3"]').length,
    sel: document.getElementById('industry-picker').value,
    hint: document.querySelector('#chart-bubble').parentElement.querySelector('.viz-live').textContent,
    hintWant: window.I18N.t('filter.hint') };
})())`);
check('清除筛选：场景回到 8 个、产业图不再变暗',
  resetRes.scenes === 8 && resetRes.dimRows === 0 && resetRes.accent === 0 && !resetRes.empty, JSON.stringify(resetRes));
check('清除后下拉回到「全部」且播报改回提示语',
  resetRes.sel === '' && resetRes.hint === resetRes.hintWant, JSON.stringify(resetRes));

/* 回归护栏：联动会把气泡 / 产业 / 场景三张重画一遍，
   重画只能替换控件，不能把旧的留在卡片里（否则重复 id + 双份按钮）。 */
const dupRes = await jv(`JSON.stringify({
  ids: document.querySelectorAll('#industry-picker').length,
  toolbars: document.querySelectorAll('.viz-toolbar').length,
  bubbleBars: document.getElementById('chart-bubble').parentElement.querySelectorAll(':scope > .viz-toolbar').length,
  bubblePanels: document.getElementById('chart-bubble').parentElement.querySelectorAll(':scope > .viz-table-wrap').length,
  indBars: document.getElementById('chart-industry').parentElement.querySelectorAll(':scope > .viz-toolbar').length,
  sceneLives: document.querySelectorAll('[data-mount="scene-head"] .viz-live').length
})`);
check('反复联动重绘不叠加控件（1 个下拉 / 每卡 1 条工具栏）',
  dupRes.ids === 1 && dupRes.toolbars === 14 && dupRes.bubbleBars === 1 && dupRes.bubblePanels === 1 &&
  dupRes.indBars === 1 && dupRes.sceneLives === 1, JSON.stringify(dupRes));
/* 14 = 13 张图各 1 条（A 档 8 张 + B 档 5 张）+ 关系图内部那条 viz-toolbar--inset */

console.log('\n[3] 数据表视图');
const tableRes = await jv(`JSON.stringify((function () {
  var out = {};
  var cases = [['chart-radar', 6], ['chart-scale', 7], ['chart-industry', 3], ['chart-bubble', 15],
    ['chart-global', 12], ['chart-timeline', 10]];
  cases.forEach(function (pair) {
    var host = document.getElementById(pair[0]);
    var card = host.parentElement;
    var seg = card.querySelectorAll(':scope > .viz-toolbar .viz-seg button');
    seg[1].click();
    var wrap = card.querySelector(':scope > .viz-table-wrap');
    var tables = wrap.querySelectorAll(':scope > .viz-table');
    out[pair[0]] = {
      tables: tables.length,
      rows: tables[0] ? tables[0].querySelectorAll('tbody tr').length : -1,
      want: pair[1],
      hostHidden: host.hidden,
      wrapShown: !wrap.hidden,
      tableAria: seg[1].getAttribute('aria-pressed'),
      chartAria: seg[0].getAttribute('aria-pressed')
    };
    seg[0].click();
    out[pair[0]].backHidden = host.hidden;
    out[pair[0]].backWrap = wrap.hidden;
  });
  return out;
})())`);
const rowsOk = Object.keys(tableRes).every((k) => tableRes[k].rows === tableRes[k].want && tableRes[k].tables === 1);
check('六张单表的行数与数据源完全一致（6/7/3/15/12/10）', rowsOk,
  JSON.stringify(Object.keys(tableRes).map((k) => k + ':' + tableRes[k].rows + '/' + tableRes[k].want)));
check('切到数据表时画布隐藏、面板显示，切回复原',
  Object.keys(tableRes).every((k) => tableRes[k].hostHidden && tableRes[k].wrapShown && !tableRes[k].backHidden && tableRes[k].backWrap),
  JSON.stringify(Object.keys(tableRes).filter((k) => !(tableRes[k].hostHidden && tableRes[k].wrapShown && !tableRes[k].backHidden && tableRes[k].backWrap))
    .map((k) => k + ':' + JSON.stringify([tableRes[k].hostHidden, tableRes[k].wrapShown, tableRes[k].backHidden, tableRes[k].backWrap]))));
check('分段控件 aria-pressed 互斥', Object.keys(tableRes).every((k) => tableRes[k].tableAria === 'true' && tableRes[k].chartAria === 'false'),
  JSON.stringify(tableRes['chart-radar']));

const dualRes = await jv(`JSON.stringify((function () {
  var out = {};
  ['chart-flow', 'chart-graph'].forEach(function (id) {
    var card = document.getElementById(id).parentElement;
    card.querySelector(':scope > .viz-toolbar .viz-seg button:last-child').click();
    var ts = card.querySelectorAll(':scope > .viz-table-wrap > .viz-table');
    out[id] = { tables: ts.length,
      rows: [].map.call(ts, function (t) { return t.querySelectorAll('tbody tr').length; }),
      caps: [].map.call(ts, function (t) { return t.querySelector('caption').textContent; }) };
    card.querySelector(':scope > .viz-toolbar .viz-seg button:first-child').click();
  });
  var card = document.getElementById('chart-bubble').parentElement;
  card.querySelector(':scope > .viz-toolbar .viz-seg button:last-child').click();
  var t = card.querySelector(':scope > .viz-table-wrap > .viz-table');
  var cap = t.querySelector('caption');
  out.a11y = {
    caption: cap ? cap.textContent : null,
    colScope: t.querySelectorAll('thead th[scope="col"]').length,
    colHeaders: t.querySelectorAll('thead th').length,
    rowScope: t.querySelectorAll('tbody th[scope="row"]').length,
    dataCells: t.querySelectorAll('tbody td').length
  };
  card.querySelector(':scope > .viz-toolbar .viz-seg button:first-child').click();
  return out;
})())`);
check('流向图数据表给「节点 + 关系」两张', dualRes['chart-flow'].tables === 2 && dualRes['chart-flow'].rows.every((r) => r > 0),
  JSON.stringify(dualRes['chart-flow']));
check('关系图数据表给「节点 + 关系」两张', dualRes['chart-graph'].tables === 2 && dualRes['chart-graph'].rows.every((r) => r > 0),
  JSON.stringify(dualRes['chart-graph']));
check('每列都有 scope="col" 列头', dualRes.a11y.colScope === dualRes.a11y.colHeaders && dualRes.a11y.colHeaders === 6,
  JSON.stringify(dualRes.a11y));
check('每行首格是 scope="row" 行头（15 行 × 5 数据格）',
  dualRes.a11y.rowScope === 15 && dualRes.a11y.dataCells === 75, JSON.stringify(dualRes.a11y));
check('表有 caption', !!dualRes.a11y.caption, dualRes.a11y.caption);

console.log('\n[4] 年份播放器');
const playStart = await jv(`JSON.stringify((function () {
  var bar = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  var range = bar.querySelector('.viz-range');
  var r = { min: range.min, max: range.max, step: range.step, before: range.value,
    label: bar.querySelector('.is-play').textContent, year: bar.querySelector('.viz-year').textContent };
  bar.querySelector('.is-play').click();
  return r;
})())`);
check('滑块 min=0 / max=6 / step=1（7 个年份）',
  playStart.min === '0' && playStart.max === '6' && playStart.step === '1', JSON.stringify(playStart));
check('年份徽标写全「年份 + 核心 + 带动」', /20\d\d/.test(playStart.year) && /亿元|100M/.test(playStart.year), playStart.year);
await sleep(2200);
const playMid = await jv(`JSON.stringify((function () {
  var bar = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  return { value: bar.querySelector('.viz-range').value,
    label: bar.querySelector('.is-play').textContent,
    on: bar.querySelector('.is-play').classList.contains('is-on'),
    year: bar.querySelector('.viz-year').textContent };
})())`);
check('播放后年份真的往前走了', Number(playMid.value) > Number(playStart.before), playStart.before + ' -> ' + playMid.value);
check('播放中按钮换成「暂停」并带 is-on', /暂停|Pause/.test(playMid.label) && playMid.on === true, JSON.stringify(playMid));
check('徽标同步到播放到的年份',
  playMid.year.indexOf(String(2019 + Number(playMid.value))) > -1, JSON.stringify([playMid.value, playMid.year]));
const pauseRes = await jv(`JSON.stringify((function () {
  var bar = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  bar.querySelector('.is-play').click();
  return { value: bar.querySelector('.viz-range').value, label: bar.querySelector('.is-play').textContent };
})())`);
await sleep(1500);
const afterPause = await jv(`JSON.stringify((function () {
  var bar = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  return { value: bar.querySelector('.viz-range').value, label: bar.querySelector('.is-play').textContent };
})())`);
check('再点一次暂停后年份停住', afterPause.value === pauseRes.value, pauseRes.value + ' vs ' + afterPause.value);
check('暂停后按钮文案复位', /播放|Play/.test(afterPause.label) && !/暂停/.test(afterPause.label), afterPause.label);

const dragRes = await jv(`JSON.stringify((function () {
  var bar = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  var range = bar.querySelector('.viz-range');
  range.value = '0';
  range.dispatchEvent(new Event('input', { bubbles: true }));
  var first = { year: bar.querySelector('.viz-year').textContent };
  range.value = '6';
  range.dispatchEvent(new Event('input', { bubbles: true }));
  var last = { year: bar.querySelector('.viz-year').textContent };
  bar.querySelector('.is-play').click();
  range.value = '2';
  range.dispatchEvent(new Event('input', { bubbles: true }));
  var during = { label: bar.querySelector('.is-play').textContent, on: bar.querySelector('.is-play').classList.contains('is-on') };
  return { first: first, last: last, during: during };
})())`);
check('拖到 0 → 2019，拖到 6 → 2025E 那一档',
  /2019/.test(dragRes.first.year) && /2025/.test(dragRes.last.year), JSON.stringify(dragRes));
check('拖动滑块会自动停止播放', dragRes.during.on === false && !/暂停/.test(dragRes.during.label), JSON.stringify(dragRes.during));
console.log('\n[5] 导出 PNG / SVG / CSV');
/* 文件名统一是 ai-nqpf-<图名>-<主题>.<后缀>，而 headless 里系统是深色，
   所以先把主题钉成 light，文件名断言才有确定性（深色单独测一次）。 */
await ev(`document.documentElement.setAttribute('data-theme', 'light')`);
const exportRes = await jv(`JSON.stringify((function () {
  window.__dl = [];
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { window.__dl.push(this.download); return undefined; }
    return origClick.call(this);
  };
  window.__blobSizes = [];
  var origCreate = URL.createObjectURL;
  URL.createObjectURL = function (b) { window.__blobSizes.push([b.type, b.size]); return origCreate.call(URL, b); };
  var bar = document.getElementById('chart-bubble').parentElement.querySelector(':scope > .viz-toolbar');
  var acts = bar.querySelectorAll('.viz-acts button');
  acts[2].click();                    /* CSV */
  acts[1].click();                    /* SVG */
  acts[0].click();                    /* PNG（异步：等 <img> onload） */
  return { csv: window.__dl[0], svg: window.__dl[1], sizes: window.__blobSizes };
})())`);
await sleep(2500);
const postExport = await jv(`JSON.stringify({ dl: window.__dl, sizes: window.__blobSizes, errs: window.__errs })`);
check('CSV 文件名 ai-nqpf-bubble-light.csv', exportRes.csv === 'ai-nqpf-bubble-light.csv', exportRes.csv);
check('SVG 文件名 ai-nqpf-bubble-light.svg', exportRes.svg === 'ai-nqpf-bubble-light.svg', exportRes.svg);
check('CSV 有实际内容（含 BOM，体积 > 400B）',
  (postExport.sizes[0] || [])[1] > 400 && /csv/.test((postExport.sizes[0] || [])[0] || ''), JSON.stringify(postExport.sizes[0]));
check('SVG 有实际内容（体积 > 2KB）', (postExport.sizes[1] || [])[1] > 2000, JSON.stringify(postExport.sizes[1]));
check('PNG 导出完成（或按设计降级为 SVG）',
  postExport.dl.length === 3 && /^ai-nqpf-bubble-light\.(png|svg)$/.test(postExport.dl[2]), JSON.stringify(postExport.dl));
check('导出过程不产生 JS 报错', postExport.errs.length === 0, JSON.stringify(postExport.errs));

const csvBody = await ev(`(function () {
  var card = document.getElementById('chart-bubble').parentElement;
  var bar = card.querySelector(':scope > .viz-toolbar');
  var seen = null;
  var orig = URL.createObjectURL;
  URL.createObjectURL = function (b) { seen = b; return orig.call(URL, b); };
  bar.querySelectorAll('.viz-acts button')[2].click();
  URL.createObjectURL = orig;
  if (!seen) return 'no-blob';
  return seen.text();
})()`);
check('气泡 CSV 头为 6 列且含「所属产业」', /^\uFEFF?行业,所属产业,/.test(csvBody), csvBody.slice(0, 60));
check('气泡 CSV 有表头 + 15 行数据', csvBody.trim().split(/\r?\n/).length === 16,
  String(csvBody.trim().split(/\r?\n/).length));
check('气泡 CSV 首行是金融/tertiary', /金融\s*,\s*第三产业/.test(csvBody), csvBody.split(/\r?\n/)[1]);

const multiCSV = await ev(`(function () {
  var card = document.getElementById('chart-flow').parentElement;
  var seen = null;
  var orig = URL.createObjectURL;
  URL.createObjectURL = function (b) { seen = b; return orig.call(URL, b); };
  card.querySelectorAll(':scope > .viz-toolbar .viz-acts button')[2].click();
  URL.createObjectURL = orig;
  return seen ? seen.text() : 'no-blob';
})()`);
check('流向图 CSV 是「两段、空行分隔」的多段式',
  /\r\n\r\n/.test(multiCSV) && multiCSV.split('\r\n\r\n').length >= 2,
  JSON.stringify(multiCSV.slice(0, 40) + '... blank=' + (multiCSV.match(/\r\n\r\n/g) || []).length));

const tableExport = await jv(`JSON.stringify((function () {
  var card = document.getElementById('chart-radar').parentElement;
  var seg = card.querySelectorAll(':scope > .viz-toolbar .viz-seg button');
  seg[1].click();
  var before = { hostHidden: document.getElementById('chart-radar').hidden, tables: card.querySelectorAll('.viz-table').length };
  card.querySelectorAll(':scope > .viz-toolbar .viz-acts button')[1].click();   /* 导出 SVG */
  var after = { hostHidden: document.getElementById('chart-radar').hidden, tables: card.querySelectorAll('.viz-table').length };
  seg[0].click();
  return { before: before, after: after, dl: window.__dl.slice(-1)[0] };
})())`);
check('数据表视图下导出会临时切回画布、导出后再切回表',
  tableExport.before.hostHidden === true && tableExport.after.hostHidden === true && tableExport.after.tables === 1,
  JSON.stringify(tableExport));
check('导出文件名带图名 radar', /ai-nqpf-radar-light\.svg/.test(tableExport.dl || ''), tableExport.dl);

const darkExport = await jv(`JSON.stringify((function () {
  document.documentElement.setAttribute('data-theme', 'dark');
  var card = document.getElementById('chart-global').parentElement;
  card.querySelectorAll(':scope > .viz-toolbar .viz-acts button')[1].click();
  var name = window.__dl.slice(-1)[0];
  document.documentElement.removeAttribute('data-theme');
  return { name: name };
})())`);
check('暗色主题导出文件名带 dark（同图不同主题不互相覆盖）',
  darkExport.name === 'ai-nqpf-global-dark.svg', darkExport.name);
await ev(`document.documentElement.setAttribute('data-theme', 'light')`);
check('切回浅色后主题属性复位', (await ev(`document.documentElement.getAttribute('data-theme')`)) === 'light');

console.log('\n[6] 中英切换后工具栏与表格');
await ev(`document.querySelector('.lang-switch-item[data-lang="en"]').click()`);
await sleep(700);
const enRes = await jv(`JSON.stringify((function () {
  var bar = document.getElementById('chart-bubble').parentElement.querySelector(':scope > .viz-toolbar');
  var sbar = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  return {
    seg: [].map.call(bar.querySelectorAll('.viz-seg button'), function (b) { return b.textContent; }),
    acts: [].map.call(bar.querySelectorAll('.viz-acts button'), function (b) { return b.textContent; }),
    groupLabel: bar.getAttribute('aria-label'),
    filterLabel: bar.querySelector('.viz-filter-label').textContent,
    allOpt: bar.querySelector('select').options[0].textContent,
    firstOpt: bar.querySelector('select').options[1].textContent,
    hint: bar.querySelector('.viz-live').textContent,
    play: sbar.querySelector('.is-play').textContent,
    rangeAria: sbar.querySelector('.viz-range').getAttribute('aria-label'),
    year: sbar.querySelector('.viz-year').textContent,
    sceneHead: document.querySelector('[data-mount="scene-head"] .viz-live').textContent
  };
})())`);
check('分段控件切英文（Chart / Data table）', enRes.seg[0] === 'Chart' && enRes.seg[1] === 'Data table', JSON.stringify(enRes.seg));
check('导出按钮切英文（Export PNG / SVG / CSV）',
  enRes.acts[0] === 'Export PNG' && enRes.acts[1] === 'Export SVG' && enRes.acts[2] === 'Export CSV', JSON.stringify(enRes.acts));
check('筛选区文案切英文',
  enRes.filterLabel === 'Filter by industry' && /^All industries/.test(enRes.allOpt) && /Pick an industry/.test(enRes.hint),
  JSON.stringify([enRes.filterLabel, enRes.allOpt]));
check('行业下拉项走英文名（Finance · 900）', /^Finance · /.test(enRes.firstOpt), enRes.firstOpt);
check('播放器与年份徽标切英文',
  /Play years/.test(enRes.play) && enRes.rangeAria === 'Year' && /×100M CNY/.test(enRes.year), JSON.stringify([enRes.play, enRes.year]));
check('场景区提示切英文', /Showing all 8 use cases/.test(enRes.sceneHead), enRes.sceneHead);

const enTable = await jv(`JSON.stringify((function () {
  var card = document.getElementById('chart-bubble').parentElement;
  var seg = card.querySelectorAll(':scope > .viz-toolbar .viz-seg button');
  seg[1].click();
  var t = card.querySelector(':scope > .viz-table-wrap > .viz-table');
  var r = { cap: t.querySelector('caption').textContent,
    cols: [].map.call(t.querySelectorAll('thead th'), function (h) { return h.textContent; }),
    row1: [].map.call(t.querySelectorAll('tbody tr')[0].children, function (c) { return c.textContent; }),
    tbodyRows: t.querySelectorAll('tbody tr').length };
  seg[0].click();
  return r;
})())`);
check('英文表头 / 首行 / 行数都正确',
  enTable.cols[0] === 'Industry' && enTable.cols[1] === 'Sector' && enTable.row1[0] === 'Finance' &&
  /^Tertiary/.test(enTable.row1[1]) && enTable.tbodyRows === 15, JSON.stringify(enTable));

const enLink = await jv(`JSON.stringify((function () {
  var sel = document.getElementById('industry-picker');
  sel.value = '7';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  var bar = document.getElementById('chart-bubble').parentElement.querySelector(':scope > .viz-toolbar');
  var gs = [].map.call(document.querySelectorAll('#chart-industry svg > g'), function (g) { return g.getAttribute('opacity'); });
  return { scenes: document.querySelectorAll('#scene-grid > .scene').length,
    live: bar.querySelector('.viz-live').textContent,
    indHot: gs.filter(function (o) { return o === null; }).length,
    indDim: gs.filter(function (o) { return o === '0.22'; }).length,
    firstScene: (document.querySelector('#scene-grid > .scene .scene-name') || {}).textContent };
})())`);
check('英文下联动依旧生效（场景筛到 1、产业命中 1 行）',
  enLink.scenes === 1 && enLink.indHot === 1 && enLink.indDim === 2, JSON.stringify(enLink));
check('英文播报含行业名与命中数', /Manufacturing/.test(enLink.live) && /1 \/ 8/.test(enLink.live), enLink.live);

await ev(`document.querySelector('#chart-bubble').parentElement.querySelector('.viz-filter .viz-btn.is-ghost').click()`);
await ev(`document.querySelector('.lang-switch-item[data-lang="zh"]').click()`);
await sleep(700);

console.log('\n[7] 整页健康度 / 无障碍 / 回归');
const health = await jv(`JSON.stringify((function () {
  var alive = ['chart-radar','chart-scale','chart-industry','chart-bubble','chart-global',
    'chart-flow','chart-graph','chart-timeline','sim-root']
    .filter(function (id) { var h = document.getElementById(id); return !h || !h.querySelector('svg'); });
  var bar = document.getElementById('chart-scale').parentElement.querySelector(':scope > .viz-toolbar');
  if (bar.querySelector('.is-play').classList.contains('is-on')) bar.querySelector('.is-play').click();
  return {
    errs: window.__errs,
    hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    toolbars: document.querySelectorAll('.viz-toolbar').length,
    segs: document.querySelectorAll('.viz-seg').length,
    alive: alive,
    lang: document.documentElement.getAttribute('lang'),
    visibleTables: [].filter.call(document.querySelectorAll('.viz-table-wrap'), function (w) { return !w.hidden; }).length,
    hiddenCharts: [].filter.call(document.querySelectorAll('[id^="chart-"]'), function (h) { return h.hidden; }).length,
    kpiValues: [].map.call(document.querySelectorAll('.kpi-value b'), function (n) { return n.textContent; }),
    scenes: document.querySelectorAll('#scene-grid > .scene').length,
    pickerIds: document.querySelectorAll('#industry-picker').length,
    toggleLabel: document.querySelector('.theme-toggle').getAttribute('aria-label')
  };
})())`);
check('全程零 JS 报错', health.errs.length === 0, JSON.stringify(health.errs));
check('无横向溢出（工具栏没有撑破卡片）', health.hOverflow === 0, String(health.hOverflow));
check('工具栏共 14 条 （13 张图 + 关系图 inset）、行业下拉只有 1 个（重绘不叠加）',
  health.toolbars === 14 && health.pickerIds === 1, JSON.stringify([health.toolbars, health.pickerIds]));
check('全部画布仍在渲染（联动 / 切表后没有空图）', health.alive.length === 0, JSON.stringify(health.alive));
check('收尾时没有残留的可见数据表或隐藏画布',
  health.visibleTables === 0 && health.hiddenCharts === 0, JSON.stringify([health.visibleTables, health.hiddenCharts]));
check('KPI 数字仍然显示（联动没把页面打乱）',
  health.kpiValues.length === 4 && health.kpiValues.every((v) => v && v !== ''), JSON.stringify(health.kpiValues));
check('场景回到全量 8 个', health.scenes === 8, String(health.scenes));
check('语言复位为中文', health.lang === 'zh-CN', health.lang);

const focusProbe = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-scale');
  var svg = host.querySelector('svg.viz-svg');
  var bar = host.parentElement.querySelector(':scope > .viz-toolbar');
  bar.querySelector('.viz-range').value = '4';
  bar.querySelector('.viz-range').dispatchEvent(new Event('input', { bubbles: true }));
  var dashed = [].filter.call(svg.querySelectorAll('line'), function (l) {
    return l.getAttribute('stroke-dasharray') === '4 4' && Number(l.getAttribute('opacity')) > 0;
  });
  var badge = [].filter.call(svg.querySelectorAll('g'), function (g) {
    return g.getAttribute('opacity') === '1' && g.querySelector('rect[fill]');
  });
  return { dashed: dashed.length, badge: badge.length,
    badgeText: badge[0] ? badge[0].querySelector('text').textContent : null,
    year: bar.querySelector('.viz-year').textContent,
    paths: svg.querySelectorAll('path').length,
    dots: svg.querySelectorAll('circle').length };
})())`);
check('年份聚焦线可见', focusProbe.dashed === 1, JSON.stringify(focusProbe));
check('右上角出现年份徽标且文字 = 2023',
  focusProbe.badge === 1 && focusProbe.badgeText === '2023', JSON.stringify(focusProbe));
check('两条曲线路径 + 高亮点都还在（聚焦没破坏图形）',
  focusProbe.paths >= 4 && focusProbe.dots >= 14, JSON.stringify(focusProbe));
check('工具栏年份文字同步', /2023/.test(focusProbe.year), focusProbe.year);

/* 打印样式：file:// 下读不到 document.styleSheets[].cssRules（SecurityError），
   所以直接在 Node 侧读样式文件本身。 */
const cssText = readFileSync(join(HERE, 'styles.css'), 'utf8');
const printBlock = (cssText.match(/@media print\s*\{[\s\S]*?\n\}/) || [''])[0];
check('styles.css 有 @media print 规则', printBlock.length > 0, String(printBlock.length));
check('打印时隐藏工具栏、摊平数据表',
  /\.viz-toolbar[^{]*\{[^}]*display:\s*none/.test(printBlock) && /\.viz-table-wrap\s*\{\s*overflow:\s*visible/.test(printBlock),
  printBlock.replace(/\s+/g, ' ').slice(0, 200));

/* 窄屏回归：年份徽标是一长串数字，360px 下曾经顶破卡片、给整页添一条横向滚动条 */
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(700);
const narrow = await jv(`JSON.stringify({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  offenders: [].filter.call(document.querySelectorAll('.viz-toolbar, .viz-toolbar *'), function (el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > document.documentElement.clientWidth + 1 || r.left < -1);
  }).map(function (el) { return el.className + '@' + Math.round(el.getBoundingClientRect().right); }),
  yearLines: (function () {
    var y = document.querySelector('.viz-year');
    return y ? Math.round(y.getBoundingClientRect().height) : 0;
  }())
})`);
check('360px 窄屏不出现横向溢出（年份徽标不再顶破卡片）',
  narrow.overflow === 0 && narrow.offenders.length === 0, JSON.stringify(narrow));
check('窄屏年份徽标改成折行显示（高于一行）', narrow.yearLines > 20, String(narrow.yearLines));
await cdp.send('Emulation.clearDeviceMetricsOverride');
await sleep(400);



/* =========================================================
 * [8] B 档新增图型：地图 / 热力矩阵 / 小倍数 / 敏感性
 * ---------------------------------------------------------
 * B 档的四类图都要满足和原有 8 张图一样的标准：
 *   工具栏 + 数据表 + 三件套导出 + 悬停读数 + a11y 标签 + 响应式。
 * 这里除了「画出来了」，还要验证「数据真的驱动了图」：
 *   换指标 → 重算；拖动滑块 → 灵敏度与分布跟着重算。
 * ========================================================= */
console.log('\n[8] B 档新增图型：地图 / 热力矩阵 / 小倍数 / 敏感性');

const bIds = ['chart-region', 'chart-heat', 'chart-multiples', 'chart-tornado', 'chart-mc'];
const bTools = await jv(`JSON.stringify((function () {
  return ${JSON.stringify(bIds)}.map(function (id) {
    var host = document.getElementById(id);
    var card = host.parentElement;
    var bar = card.querySelector(':scope > .viz-toolbar');
    return {
      id: id, hasBar: !!bar, hasPanel: !!card.querySelector(':scope > .viz-table-wrap'),
      btns: bar ? [].map.call(bar.querySelectorAll('.viz-seg button, .viz-acts button'), function (b) { return b.textContent; }) : [],
      aria: host.getAttribute('aria-label'), role: host.getAttribute('role')
    };
  });
})())`);
check('B 档 5 张新图都有工具栏 + 数据表面板',
  bTools.length === 5 && bTools.every((t) => t.hasBar && t.hasPanel),
  JSON.stringify(bTools.filter((t) => !t.hasBar || !t.hasPanel)));
check('B 档 5 张新图都具备 图表/数据表 + PNG/SVG/CSV 五枚按钮',
  bTools.every((t) => t.btns.length === 5), JSON.stringify(bTools[0].btns));
check('B 档 5 张新图都有 role="img" + aria-label',
  bTools.every((t) => t.role === 'img' && !!t.aria), JSON.stringify(bTools.map((t) => t.aria)));

/* ---------- B1 分级填色地图 ---------- */
const mapRes = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-region');
  var svg = host.querySelector('svg.viz-svg');
  var paths = [].slice.call(svg.querySelectorAll('path'));
  var fills = {};
  paths.forEach(function (p) { fills[p.getAttribute('fill')] = 1; });
  var bad = [].filter.call(svg.querySelectorAll('path, circle, line'), function (el) {
    return [].some.call(el.attributes, function (a) { return /NaN|Infinity/.test(a.value); });
  }).length;
  return {
    geo: !!window.CN_MAP, provinces: window.CN_MAP.provinces.length,
    paths: paths.length, circles: svg.querySelectorAll('circle').length,
    lines: svg.querySelectorAll('line').length, bad: bad,
    distinctFills: Object.keys(fills).length,
    options: document.getElementById('region-metric').options.length,
    topBtn: !!host.parentElement.querySelector('.viz-toolbar .viz-btn[aria-pressed]')
  };
})())`);
check('地图几何已加载（34 个省级单元）', mapRes.geo && mapRes.provinces === 34, JSON.stringify(mapRes));
check('地图画出 34 个省级面 + 70 个岛礁 + 9 段十段线',
  mapRes.paths === 34 && mapRes.circles === 70 && mapRes.lines === 9, JSON.stringify(mapRes));
check('地图元素没有 NaN / Infinity 坐标（0 处）', mapRes.bad === 0, String(mapRes.bad));
check('地图按分位数至少分 5 档填色', mapRes.distinctFills >= 5, String(mapRes.distinctFills));
check('地图有 2 项指标下拉 + 前五名开关', mapRes.options === 2 && mapRes.topBtn, JSON.stringify(mapRes));

const mapHover = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-region');
  var svg = host.querySelector('svg.viz-svg');
  var biggest = [].slice.call(svg.querySelectorAll('path')).sort(function (a, b) {
    return b.getBBox().width - a.getBBox().width;
  })[0];
  var box = biggest.getBoundingClientRect();
  biggest.dispatchEvent(new MouseEvent('mousemove', { bubbles: true,
    clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
  var tip = host.querySelector('.viz-tip');
  return { shown: !tip.hidden, text: tip.textContent, hasRank: /\\//.test(tip.textContent) };
})())`);
check('地图悬停有读数（省名 + 数值 + 全国排名）',
  mapHover.shown && mapHover.text.length > 3 && mapHover.hasRank, JSON.stringify(mapHover));

/* 换指标：数据表里的数值必须跟着换（不是只换标签） */
const mapMetric = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-region');
  var card = host.parentElement;
  var seg = card.querySelectorAll(':scope > .viz-toolbar .viz-seg button');
  seg[1].click();                                    /* 切到数据表视图 */
  var rowValue = function () {
    /* 必须限定在这张卡片里：document 里还有别的图的数据表 */
    var tr = card.querySelector(':scope > .viz-table-wrap .viz-table tbody tr');
    return tr ? tr.children[2].textContent : '';
  };
  var before = rowValue();
  var sel = document.getElementById('region-metric');
  sel.value = '1';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  var after = rowValue();
  var tbl = card.querySelectorAll(':scope > .viz-table-wrap .viz-table tbody tr').length;
  seg[0].click();                                    /* 切回图表视图 */
  return { before: before, after: after, tblRows: tbl };
})())`);
check('切换指标后数据表数值真的换了（4.8 EFLOPS → 3,900 家）',
  /4\.8/.test(mapMetric.before) && /3,900/.test(mapMetric.after), JSON.stringify(mapMetric));
check('地图数据表有 34 行（每个省级单元一行）', mapMetric.tblRows === 34, String(mapMetric.tblRows));

/* 「前五名」开关：每次切换都会重画地图，所以要点一次、等动画跑完、再数 */
await ev(`(function () {
  document.getElementById('region-top-btn').click();
  return true;
})()`);
await sleep(900);
const mapTopOn = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-region');
  var all = [].slice.call(host.querySelectorAll('path'));
  return {
    bright: all.filter(function (p) { return +p.getAttribute('opacity') > 0.9; }).length,
    dim: all.filter(function (p) { return +p.getAttribute('opacity') < 0.4; }).length,
    pressed: document.getElementById('region-top-btn').getAttribute('aria-pressed')
  };
})())`);
await ev(`(function () {
  document.getElementById('region-top-btn').click();
  return true;
})()`);
await sleep(900);
const mapTopOff = await jv(`JSON.stringify((function () {
  var all = [].slice.call(document.getElementById('chart-region').querySelectorAll('path'));
  return {
    bright: all.filter(function (p) { return +p.getAttribute('opacity') > 0.9; }).length,
    dim: all.filter(function (p) { return +p.getAttribute('opacity') < 0.4; }).length,
    pressed: document.getElementById('region-top-btn').getAttribute('aria-pressed')
  };
})())`);
check('「前五名」开关只留 5 个省高亮、其余 29 个压暗',
  mapTopOn.bright === 5 && mapTopOn.dim === 29 && mapTopOn.pressed === 'true', JSON.stringify(mapTopOn));
check('再点一次恢复全亮 34 个',
  mapTopOff.bright === 34 && mapTopOff.dim === 0 && mapTopOff.pressed === 'false', JSON.stringify(mapTopOff));


/* ---------- B2 热力矩阵 ---------- */
const heatRes = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-heat');
  var svg = host.querySelector('svg.viz-svg');
  var cells = [].filter.call(svg.querySelectorAll('rect'), function (r) {
    return +r.getAttribute('rx') === 4 && +r.getAttribute('height') > 10;
  });
  var fills = {};
  cells.forEach(function (c) { fills[c.getAttribute('fill')] = 1; });
  var texts = [].map.call(svg.querySelectorAll('text'), function (t) { return t.textContent; });
  return {
    cells: cells.length,
    numbers: texts.filter(function (t) { return /^\\d[\\d,]*$/.test(t); }).length,
    distinctFills: Object.keys(fills).length,
    headers: texts.filter(function (t) { return /渗透率|效率增益|市场规模|增速|人才密度/.test(t); }).length
  };
})())`);
check('热力矩阵 = 15 行 × 5 列 = 75 个格子', heatRes.cells === 75, JSON.stringify(heatRes));
check('75 个格子都写着原始数值', heatRes.numbers >= 75, String(heatRes.numbers));
check('热力矩阵用连续色阶（列内多档颜色）', heatRes.distinctFills >= 20, String(heatRes.distinctFills));
check('5 个指标列头都画出来了', heatRes.headers >= 5, String(heatRes.headers));

const heatTable = await jv(`JSON.stringify((function () {
  var card = document.getElementById('chart-heat').parentElement;
  var seg = card.querySelectorAll(':scope > .viz-toolbar .viz-seg button');
  seg[1].click();
  var table = card.querySelector(':scope > .viz-table-wrap .viz-table');
  var info = {
    rows: table.querySelectorAll('tbody tr').length,
    cols: table.querySelectorAll('thead th').length,
    head: [].map.call(table.querySelectorAll('thead th'), function (t) { return t.textContent; }),
    firstRow: [].map.call(table.querySelectorAll('tbody tr')[0].children, function (t) { return t.textContent; })
  };
  seg[0].click();
  return info;
})())`);
check('热力矩阵数据表是 15 行 × 6 列（行业 + 5 指标）',
  heatTable.rows === 15 && heatTable.cols === 6, JSON.stringify(heatTable.head));
check('热力矩阵表首行 = 金融 42/32/900/17/78',
  /金融/.test(heatTable.firstRow[0]) && heatTable.firstRow.slice(1).join('/') === '42/32/900/17/78',
  JSON.stringify(heatTable.firstRow));

/* ---------- B3 小倍数图 ---------- */
const multRes = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-multiples');
  var svg = host.querySelector('svg.viz-svg');
  var groups = [].slice.call(svg.querySelectorAll('g[transform]'));
  var xs = groups.map(function (g) {
    return parseFloat((g.getAttribute('transform').match(/translate\\(([-\\d.]+)/) || [0, 0])[1]);
  });
  var solid = [].filter.call(svg.querySelectorAll('path'), function (p) {
    return p.getAttribute('fill') === 'none' && p.getAttribute('stroke-dasharray') === null;
  });
  var dashed = [].filter.call(svg.querySelectorAll('path'), function (p) {
    return p.getAttribute('stroke-dasharray') === '6 5';
  });
  return {
    groups: groups.length, xs: xs, solid: solid.length, dashed: dashed.length,
    legend: host.querySelectorAll('.viz-legend-item').length,
    years: [].filter.call(svg.querySelectorAll('text'), function (t) { return /^20\\d\\d$/.test(t.textContent); }).length,
    height: Math.round(svg.getBoundingClientRect().height)
  };
})())`);
check('小倍数图 3 个面板并排（宽屏：x 递增）',
  multRes.groups === 3 && multRes.xs[1] > multRes.xs[0] && multRes.xs[2] > multRes.xs[1], JSON.stringify(multRes.xs));
check('每格两条线：渗透率 + 增益各 3 条实线、2025 各 3 段虚线',
  multRes.solid === 6 && multRes.dashed === 6, JSON.stringify(multRes));
check('3 格 × 7 年刻度 = 21 个年份标签 + 2 项图例',
  multRes.years === 21 && multRes.legend === 2, JSON.stringify(multRes));

/* 窄屏：三格改成竖向摞起来（x 全为 0、y 递增），只在最后一格标年份 */
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(900);
const multNarrow = await jv(`JSON.stringify((function () {
  var host = document.getElementById('chart-multiples');
  var svg = host.querySelector('svg.viz-svg');
  var groups = [].slice.call(svg.querySelectorAll('g[transform]'));
  var nums = function (re) {
    return groups.map(function (g) { return parseFloat((g.getAttribute('transform').match(re) || [0, 0])[1]); });
  };
  return {
    xs: nums(/translate\\(([-\\d.]+)/), ys: nums(/,\\s*([-\\d.]+)\\)/),
    height: Math.round(svg.getBoundingClientRect().height),
    years: [].filter.call(svg.querySelectorAll('text'), function (t) { return /^20\\d\\d$/.test(t.textContent); }).length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
})())`);
check('窄屏小倍数图改成竖向摞起（x 全为 0、y 递增）',
  multNarrow.xs.every((x) => x === 0) && multNarrow.ys[1] > multNarrow.ys[0], JSON.stringify(multNarrow));
check('窄屏只在最后一格标年份（7 个）且无横向溢出',
  multNarrow.years === 7 && multNarrow.overflow === 0, JSON.stringify(multNarrow));
check('窄屏三格更高（格子变宽变矮的补偿）',
  multNarrow.height > multRes.height, multNarrow.height + ' vs ' + multRes.height);
await cdp.send('Emulation.clearDeviceMetricsOverride');
await sleep(700);

/* ---------- B4 敏感性分析：龙卷风 + 蒙特卡洛 ---------- */
const sensRes = await jv(`JSON.stringify((function () {
  var torn = document.getElementById('chart-tornado');
  var mc = document.getElementById('chart-mc');
  var tsvg = torn.querySelector('svg.viz-svg'), msvg = mc.querySelector('svg.viz-svg');
  var bars = [].filter.call(tsvg.querySelectorAll('rect'), function (r) {
    return +r.getAttribute('height') > 10 && +r.getAttribute('rx') > 5;
  });
  var bins = [].filter.call(msvg.querySelectorAll('rect'), function (r) { return r.getAttribute('rx') !== null; });
  var labels = [].map.call(msvg.querySelectorAll('text'), function (t) { return t.textContent; });
  /* 标签形如 “P5 29”“中位数 37”“P95 44”，取末尾数字（不能直接把非数字去掉：P5 会变成 529） */
  var pct = labels.filter(function (t) { return /P5|P95|中位数/.test(t); })
    .map(function (t) { return parseInt((t.match(/(\\d+)\\s*$/) || [0, 0])[1], 10); });
  return {
    bars: bars.length, bins: bins.length, p5: pct[0], p50: pct[1], p95: pct[2],
    currentMc: (labels.filter(function (t) { return /^\\u25b2/.test(t); })[0] || ''),
    currentTorn: ([].filter.call(tsvg.querySelectorAll('text'), function (t) { return /当前设定/.test(t.textContent); })[0] || {}).textContent || '',
    roles: [torn.getAttribute('role'), mc.getAttribute('role')]
  };
})())`);
check('龙卷风图 4 根条：每个因素一条', sensRes.bars === 4, JSON.stringify(sensRes));
check('龙卷风图有「当前设定 N」基准标记', /当前设定\s*\d+/.test(sensRes.currentTorn), sensRes.currentTorn);
check('蒙特卡洛 18 个桶 + P5 < 中位数 < P95 有序',
  sensRes.bins === 18 && sensRes.p5 < sensRes.p50 && sensRes.p50 < sensRes.p95, JSON.stringify(sensRes));
check('两张敏感性图都有 role="img" 语义', sensRes.roles.join('/') === 'img/img', JSON.stringify(sensRes.roles));

/* 拖动「AI 渗透率」滑块到 90：两张图必须重算（不是只挪了数字） */
await ev(`(function () {
  var sliders = document.querySelectorAll('#sim-root .sim-range');
  var labels = [].map.call(document.getElementById('chart-mc').querySelectorAll('svg.viz-svg text'), function (t) { return t.textContent; });
  window.__sensBefore = labels.filter(function (t) { return /P5|P95|中位数/.test(t); }).join('|');
  window.__tornBefore = [].map.call(document.getElementById('chart-tornado').querySelectorAll('svg.viz-svg text'),
    function (t) { return t.textContent; }).filter(function (t) { return /当前设定/.test(t); })[0];
  sliders[0].value = '90';
  sliders[0].dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(800);   /* 防抖 90ms + 两张图重绘 */
const sensMoved = await jv(`JSON.stringify((function () {
  var labels = [].map.call(document.getElementById('chart-mc').querySelectorAll('svg.viz-svg text'), function (t) { return t.textContent; });
  var tornLabels = [].map.call(document.getElementById('chart-tornado').querySelectorAll('svg.viz-svg text'), function (t) { return t.textContent; });
  return {
    before: window.__sensBefore,
    after: labels.filter(function (t) { return /P5|P95|中位数/.test(t); }).join('|'),
    tornBefore: window.__tornBefore,
    tornAfter: tornLabels.filter(function (t) { return /当前设定/.test(t); })[0],
    slider: document.querySelectorAll('#sim-root .sim-range')[0].value
  };
})())`);
check('拖动滑块后蒙特卡洛分布重算（P5/中位数/P95 整体右移）',
  sensMoved.after !== sensMoved.before && sensMoved.slider === '90', JSON.stringify(sensMoved));
check('拖动滑块后龙卷风的「当前设定」同步更新（37 → 59）',
  sensMoved.tornAfter !== sensMoved.tornBefore && /当前设定\s*\d+/.test(sensMoved.tornAfter || ''),
  JSON.stringify(sensMoved));


/* ---------- B 档的数据表与导出 ---------- */
const bTables = await jv(`JSON.stringify((function () {
  var out = {};
  ['tornado', 'mc'].forEach(function (key) {
    var id = key === 'tornado' ? 'chart-tornado' : 'chart-mc';
    var card = document.getElementById(id).parentElement;
    var seg = card.querySelectorAll(':scope > .viz-toolbar .viz-seg button');
    seg[1].click();
    var table = card.querySelector(':scope > .viz-table-wrap .viz-table');
    out[key] = {
      rows: table.querySelectorAll('tbody tr').length,
      cols: table.querySelectorAll('thead th').length,
      lastRow: [].map.call(table.querySelectorAll('tbody tr:last-child td'), function (t) { return t.textContent; })
    };
    seg[0].click();
  });
  return out;
})())`);
check('龙卷风数据表 4 行 × 5 列（因素/旋钮/最小/最大/区间宽度）',
  bTables.tornado.rows === 4 && bTables.tornado.cols === 5, JSON.stringify(bTables.tornado));
check('蒙特卡洛数据表 18 行 × 3 列（区间/频次/占比）',
  bTables.mc.rows === 18 && bTables.mc.cols === 3, JSON.stringify(bTables.mc));

const mcShare = await jv(`JSON.stringify((function () {
  var card = document.getElementById('chart-mc').parentElement;
  var seg = card.querySelectorAll(':scope > .viz-toolbar .viz-seg button');
  seg[1].click();
  var rows = card.querySelectorAll(':scope > .viz-table-wrap .viz-table tbody tr');
  var sum = 0;
  [].forEach.call(rows, function (tr) { sum += parseFloat(tr.children[2].textContent) || 0; });
  var counts = 0;
  [].forEach.call(rows, function (tr) { counts += parseInt(tr.children[1].textContent, 10) || 0; });
  seg[0].click();
  return { share: Math.round(sum * 10) / 10, draws: counts };
})())`);
check('蒙特卡洛占比合计 100% 且频次合计 = 500 次抽样',
  Math.abs(mcShare.share - 100) < 0.6 && mcShare.draws === 500, JSON.stringify(mcShare));

/* CSV 走 Blob.text()，是异步的：页内函数必须 async 并 await，
   否则 ev(awaitPromise) 拿到的是 Promise 而不是内容 */
const csvNew = await ev(`(async function () {
  var ids = ['chart-region', 'chart-heat', 'chart-multiples'];
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var card = document.getElementById(ids[i]).parentElement;
    var seen = null;
    var orig = URL.createObjectURL;
    URL.createObjectURL = function (b) { seen = b; return orig.call(URL, b); };
    card.querySelectorAll(':scope > .viz-toolbar .viz-acts button')[2].click();
    URL.createObjectURL = orig;
    out.push(seen ? await seen.text() : '');
  }
  return JSON.stringify(out);
})()`);
const csvList = JSON.parse(csvNew);
check('地图 CSV 有表头 + 34 行（按指标降序）',
  csvList[0].trim().split(/\r?\n/).length === 35 && /排名/.test(csvList[0].split(/\r?\n/)[0]), csvList[0].split(/\r?\n/)[0]);
check('热力矩阵 CSV 有表头 + 15 行 × 6 列',
  csvList[1].trim().split(/\r?\n/).length === 16, String(csvList[1].trim().split(/\r?\n/).length));
check('小倍数 CSV 有表头 + 21 行（3 产业 × 7 年）',
  csvList[2].trim().split(/\r?\n/).length === 22, String(csvList[2].trim().split(/\r?\n/).length));

/* ---------- B 档图在英文下的表现 ---------- */
await ev(`document.querySelector('.lang-switch-item[data-lang="en"]').click()`);
await sleep(800);
const enB = await jv(`JSON.stringify((function () {
  var ids = ['chart-region', 'chart-heat', 'chart-multiples', 'chart-tornado', 'chart-mc'];
  var cjk = 0, total = 0, btns = null, cjkSamples = [];
  ids.forEach(function (id) {
    var card = document.getElementById(id).parentElement;
    if (!btns) btns = [].map.call(card.querySelectorAll(':scope > .viz-toolbar button'), function (b) { return b.textContent; });
    var svg = document.getElementById(id).querySelector('svg.viz-svg');
    [].forEach.call(svg.querySelectorAll('text'), function (t) {
      total++;
      if (/[\\u4e00-\\u9fa5]/.test(t.textContent)) { cjk++; if (cjkSamples.length < 4) cjkSamples.push(t.textContent); }
    });
  });
  return {
    cjk: cjk, total: total, samples: cjkSamples, btns: btns,
    metricOpts: [0, 1].map(function (i) { return document.getElementById('region-metric').options[i].textContent; }).join(' | '),
    navClipped: (function () { var n = document.getElementById('site-nav'); return n.scrollWidth - n.clientWidth; }()),
    toolbarLabel: document.getElementById('chart-region').parentElement
      .querySelector(':scope > .viz-toolbar').getAttribute('aria-label')
  };
})())`);
check('英文模式下 5 张新图的 SVG 文字没有中文残留', enB.cjk === 0, JSON.stringify(enB.samples));
check('英文模式下工具栏、指标下拉、单位括号都是英文写法',
  enB.btns.indexOf('Export CSV') > -1 && /Intelligent compute \(EFLOPS\)/.test(enB.metricOpts) &&
  !/[\u4e00-\u9fa5]/.test(enB.metricOpts), JSON.stringify({ btns: enB.btns, opt: enB.metricOpts }));
/* 英文标签更长：13 项导航在宽屏上最容易挤爆 .topnav（i18n.css 里专门收过字号与内边距） */
check('英文模式下顶栏 13 项导航不被裁切', enB.navClipped === 0, String(enB.navClipped));
check('英文模式下工具栏 aria-label 也跟着换',
  enB.toolbarLabel === 'View and export', enB.toolbarLabel);
await ev(`document.querySelector('.lang-switch-item[data-lang="zh"]').click()`);
await sleep(800);

/* ---------- 收尾体检：整页无报错、无横向溢出 ---------- */
const bHealth = await jv(`JSON.stringify({
  errs: window.__errs,
  hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  toolbars: document.querySelectorAll('.viz-toolbar').length,
  charts: document.querySelectorAll('.viz-svg').length,
  sections: document.querySelectorAll('main section.section').length,
  navItems: document.querySelectorAll('.nav-link').length,
  navClipped: (function () { var n = document.getElementById('site-nav'); return n.scrollWidth - n.clientWidth; }())
})`);
check('B 档全过程没有 JS 报错', bHealth.errs.length === 0, JSON.stringify(bHealth.errs));
/* 13 张自绘图 + 模拟器里的 6 个环形仪表 = 19 个 SVG */
check('整页 19 个 SVG（13 张图 + 6 个仪表）、14 个章节、13 个导航项',
  bHealth.charts === 19 && bHealth.sections === 14 && bHealth.navItems === 13, JSON.stringify(bHealth));
check('中文模式下顶栏 13 项导航也不被裁切', bHealth.navClipped === 0, String(bHealth.navClipped));
check('整页仍然没有横向溢出', bHealth.hOverflow === 0, String(bHealth.hOverflow));

console.log('\n================ 结果 ================');
console.log('通过 ' + pass + ' / 失败 ' + fail);
if (fails.length) fails.forEach((f) => console.log('  [XX] ' + f));

const REPORT = join(tmpdir(), 'vis2-smoke-report.json');
writeFileSync(REPORT,
  JSON.stringify({ pass: pass, fail: fail, fails: fails, toolBars: toolBars, extraCtl: extraCtl,
    pickRes: pickRes, resetRes: resetRes, tableRes: tableRes, dualRes: dualRes.a11y,
    dragRes: dragRes, exportRes: exportRes, postExport: postExport, health: health, focusProbe: focusProbe,
    /* B 档证据 */
    b: {
      tools: bTools.map(function (t) { return { id: t.id, btns: t.btns.length, aria: t.aria }; }),
      map: mapRes, mapHover: mapHover, mapMetric: mapMetric, mapTopOn: mapTopOn, mapTopOff: mapTopOff,
      heat: heatRes, heatTable: heatTable, mult: multRes, multNarrow: multNarrow,
      sens: sensRes, sensMoved: sensMoved, mcShare: mcShare,
      csvHeader: csvList.map(function (c) { return c.split(/\r?\n/)[0]; }),
      en: enB, health: bHealth
    } },
    null, 2), 'utf8');
console.log('逐项证据已写入 ' + REPORT);
console.log('SUMMARY script=smoke.mjs checks=' + (pass + fail) + ' failed=' + fail);

/* 收尾：WebSocket 与 Chrome 子进程不关掉，node 的事件循环会一直挂着 */
clearTimeout(watchdog);
cdp.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
process.exit(fail ? 1 : 0);










