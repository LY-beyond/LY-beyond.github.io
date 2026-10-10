/* =========================================================
 * smoke.mjs —— 真机冒烟：把「人点一遍」变成一堆断言
 * ---------------------------------------------------------
 * 跑法：node smoke.mjs                                  （默认 file:// 打开本地 index.html）
 *       SITE_URL=http://127.0.0.1:8099/ node smoke.mjs   （改测本地服务器）
 * 用真实 Chrome（CDP）加载页面，只断言「只有跑起来才可能对/错」的东西：
 *   ① 启动：全局对象 / 样式表 / 标签 / 报错收集器
 *   ② 内置数据：6 份数据集、预览表（单元格真值、缺失不乱）、列概览
 *   ③ 变换面板：19 个算子清单、空态、形状轨迹、描述统计表、代码框
 *   ④ 单步筛选：默认参数 → region == East（形状 / 图表 / 代码三处同步）
 *   ⑤ 六类图表：控件显隐、图元计数、图表数据表、aria-pressed、图注
 *   ⑥ 矩阵结果：相关矩阵 6×6（形状轨迹 + 表格 + 36 格热力 + 中文图注）
 *   ⑦ 19 个算子逐个添加：字段 id 齐、错误被捕获成图注、代码不为空
 *   ⑧ 导出：结果 CSV / JSON、图表 CSV / SVG / PNG、代码 .py 共 6 份真下载
 *   ⑨ 双语：zh → en → zh（文案 / 代码注释 / 状态行都跟着换）
 *   ⑩ 主题切换 / 顶栏阅读进度 / 窄屏抽屉导航 / Esc 收起 / 无横向溢出 / 无报错
 * 末尾打印通过/失败计数与非零退出码，并给统一的 SUMMARY 行。
 * 浏览器：默认自动探测 Chrome / Edge / Chromium，可用 CHROME 环境变量指定；
 *   CI 里若需要额外参数（容器 / 无沙箱环境）用 CHROME_FLAGS，例如 CHROME_FLAGS=--no-sandbox。
 * 说明：仅开发期使用，不被网站加载，不影响静态部署。
 * ========================================================= */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync, readdirSync, statSync, readFileSync } from 'node:fs';
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
/* 端口随进程号漂移：上一轮崩掉的 Chrome 常常还占着固定端口，会连到「僵尸」调试端口上 */
const PORT = 9400 + (process.pid % 400);
/* 额外浏览器参数：CI（容器 / 无沙箱环境）常需 CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage" */
const CHROME_FLAGS = (process.env.CHROME_FLAGS || '').split(/\s+/).filter(Boolean);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const URL_PAGE = process.env.SITE_URL || pathToFileURL(join(HERE, 'index.html')).href;

const profile = mkdtempSync(join(tmpdir(), 'vis3-smoke-'));
/* 导出下载目录：⑧ 里真的点下载按钮，再回读磁盘上的文件 */
const DL_DIR = mkdtempSync(join(tmpdir(), 'vis3-dl-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--window-size=1440,1200', ...CHROME_FLAGS,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });

function cleanup(code) {
  try { chrome.kill(); } catch (e) { /* 已经退出 */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 文件被占用 */ }
  try { rmSync(DL_DIR, { recursive: true, force: true }); } catch (e) { /* 文件被占用 */ }
  process.exit(code);
}
/* 看门狗：任何一步卡住都别把终端吊死在这儿 */
const watchdog = setTimeout(() => {
  console.error('\n[!!] 超时 600s：冒烟脚本卡住，强制退出');
  cleanup(1);
}, 300000);

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
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    /* 只带 text 时常常只有 "Uncaught"，把真正的描述也带出来便于定位 */
    const detail = (d.exception && (d.exception.description || d.exception.value)) || '';
    throw new Error('页面异常: ' + (d.text || '') + (detail ? ' | ' + String(detail).split('\n')[0] : ''));
  }
  return r.result.value;
};
const jv = async (expr) => JSON.parse(await ev(expr));

/* 报错收集器必须注册成「新文档脚本」：file:// 页面一导航就换了 window，
   挂在 about:blank 上的 __errs 会一起消失。 */
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__errs = [];
    window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });
    window.addEventListener('unhandledrejection', function (e) { window.__errs.push('rejection: ' + e.reason); });
    var _ce = console.error;
    console.error = function () { window.__errs.push([].join.call(arguments, ' ')); _ce.apply(console, arguments); };`
});

await cdp.send('Page.navigate', { url: URL_PAGE });
await sleep(3000);

/* 页面内的小工具：只做 DOM 读写 / 事件派发；
   正则与期望值一律留在 Node 侧断言，避免字符串转义踩坑。 */
async function injectProbe() {
  await ev(`window.h = (function () {
  function q(sel) { return document.querySelector(sel); }
  function byId(id) { return document.getElementById(id); }
  function t(id) { var n = byId(id); return n ? n.textContent.trim() : null; }
  function cnt(sel) { return document.querySelectorAll(sel).length; }
  function txt(n) { return n ? n.textContent.trim() : null; }
  function fire(n, type) { n.dispatchEvent(new Event(type, { bubbles: true })); }
  return {
    q: q, byId: byId, t: t, cnt: cnt, txt: txt, fire: fire,
    num: function (id) { var n = byId(id); return n ? String(n.value) : null; },
    vals: function (id) {
      var n = byId(id); if (!n) return null;
      return [].map.call(n.options, function (o) { return o.value; });
    },
    labels: function (id) {
      var n = byId(id); if (!n) return null;
      return [].map.call(n.options, function (o) { return o.textContent.trim(); });
    },
    table: function (id) {
      var n = byId(id); if (!n) return null;
      var heads = [].map.call(n.querySelectorAll('thead th'), function (x) { return x.textContent.trim(); });
      var rows = [].map.call(n.querySelectorAll('tbody tr'), function (tr) {
        return [].map.call(tr.querySelectorAll('td'), function (td) { return td.textContent.trim(); });
      });
      return { head: heads, n: rows.length, rows: rows.slice(0, 3), all: rows };
    },
    cells: function (id) {
      var n = byId(id); if (!n) return null;
      return [].map.call(n.querySelectorAll('tbody td'), function (td) { return td.textContent.trim(); });
    },
    hidden: function (id) { var n = byId(id); return n ? n.classList.contains('is-hidden') : null; },
    classes: function (id) { var n = byId(id); return n ? String(n.className) : null; },
    shown: function (id) {
      var n = byId(id);
      if (!n) return null;
      return !n.classList.contains('is-hidden') && n.getBoundingClientRect().height > 0;
    },
    svgs: function () { return [].map.call(document.querySelectorAll('#chart-box svg'), function (s) { return String(s.getAttribute('viewBox')); }); },
    marks: function () {
      return {
        bars: cnt('#chart-box rect.pd-bar'),
        dots: cnt('#chart-box circle.pd-dot'),
        paths: cnt('#chart-box path'),
        heat: cnt('#chart-box rect:not(.pd-bar)'),
        heatval: cnt('#chart-box text.pd-heatval'),
        ticks: cnt('#chart-box text.pd-tick')
      };
    },
    setSel: function (id, v) { var n = byId(id); n.value = v; fire(n, 'change'); },
    setVals: function (id, vs) {
      var n = byId(id);
      [].forEach.call(n.options, function (o) { o.selected = vs.indexOf(o.value) >= 0; });
      fire(n, 'change');
    },
    setInput: function (id, v) { var n = byId(id); n.value = v; fire(n, 'input'); },
    setCheck: function (id, v) { var n = byId(id); n.checked = !!v; fire(n, 'change'); },
    click: function (id) { byId(id).click(); },
    clickSel: function (sel) { q(sel).click(); },
    lang: function (v) { q('.lang-switch-item[data-lang="' + v + '"]').click(); },
    fieldIds: function (host) {
      return [].map.call((host || byId('steps')).querySelectorAll('[id^="f-"]'), function (n) { return n.id; });
    },
    step: function () {
      var it = q('#steps .step');
      if (!it) return null;
      var btns = [].map.call(it.querySelectorAll('.step-acts button'), function (b) { return { text: b.textContent.trim(), disabled: !!b.disabled }; });
      return {
        no: txt(it.querySelector('.step-no')),
        op: txt(it.querySelector('.step-op')),
        error: it.classList.contains('is-error'),
        note: txt(it.querySelector('.step-note')),
        btns: btns,
        fields: [].map.call(it.querySelectorAll('[id^="f-"]'), function (n) { return n.id; }),
        labelFor: [].map.call(it.querySelectorAll('label[for]'), function (l) { return l.getAttribute('for'); }),
        hint: txt(it.querySelector('.field-hint'))
      };
    },
    typeButtons: function () {
      return [].map.call(document.querySelectorAll('#chart-types button'), function (b) {
        return { type: b.getAttribute('data-type'), pressed: b.getAttribute('aria-pressed'), text: b.textContent.trim() };
      });
    },
    theme: function () { return document.documentElement.getAttribute('data-theme'); },
    langAttr: function () { return document.documentElement.getAttribute('lang'); },
    hOverflow: function () { return document.documentElement.scrollWidth - window.innerWidth; },
    textOf: function (sel) { return txt(q(sel)); }
  };
})()`);
}
await injectProbe();
check('页面加载后注入的探针可用', (await jv('JSON.stringify(!!window.h && typeof window.h.table === "function")')) === true);

const DS_NAMES = ['销售流水', '学生成绩', '国家指标', '城市月度气候', '股票日线', '员工信息'];
const PREVIEW_ROWS = 12;

console.log('\n[1] 启动 / 骨架');
const boot = await jv(`JSON.stringify((function () {
  var navLinks = [].map.call(document.querySelectorAll('#site-nav .nav-link'), function (a) {
    return { text: a.textContent.trim(), href: a.getAttribute('href') };
  });
  return {
    kinds: {
      data: typeof window.PD_DATA, pd: typeof window.PD,
      charts: typeof window.PDCHARTS, i18n: typeof window.I18N
    },
    datasets: (window.PD_DATA && window.PD_DATA.lists ? window.PD_DATA.lists.length : 0),
    langs: [].map.call(document.querySelectorAll('.lang-switch-item'), function (b) {
      return { lang: b.getAttribute('data-lang'), pressed: b.getAttribute('aria-pressed'), text: b.textContent.trim() };
    }),
    langAttr: document.documentElement.getAttribute('lang'),
    theme: document.documentElement.getAttribute('data-theme'),
    sheets: document.styleSheets.length,
    errs: (window.__errs || []).length,
    navLinks: navLinks,
    targets: navLinks.map(function (l) { return !!document.querySelector(l.href); }),
    toTop: !!document.getElementById('to-top'),
    readbar: !!document.getElementById('readbar'),
    themeBtn: !!document.querySelector('.theme-toggle'),
    heroStatus: h.t('workbench-status'),
    title: document.title
  };
})())`);
check('四个脚本都挂上了全局（PD_DATA / PD / PDCHARTS / I18N）',
  boot.kinds.data === 'object' && boot.kinds.pd === 'object' && boot.kinds.charts === 'object' && boot.kinds.i18n === 'object',
  JSON.stringify(boot.kinds));
check('内置数据集 6 份', boot.datasets === 6, String(boot.datasets));
check('语言切换默认中文（html lang=zh-CN，中键 aria-pressed=true）',
  boot.langAttr === 'zh-CN' && boot.langs.length === 2 && boot.langs[0].pressed === 'true' && boot.langs[1].pressed === 'false',
  JSON.stringify(boot.langs));
check('主题已落到 <html data-theme>（light / dark 之一）',
  boot.theme === 'light' || boot.theme === 'dark', String(boot.theme));
check('四张样式表都加载了（tokens / theme / styles / i18n）', boot.sheets >= 4, String(boot.sheets));
check('加载期无 console 报错 / 未捕获异常', boot.errs === 0, JSON.stringify(boot.errs));
check('顶栏 4 个导航项，锚点都指向真实节点',
  boot.navLinks.length === 4 && boot.targets.every(Boolean) && boot.navLinks[0].href === '#p-data',
  JSON.stringify(boot.navLinks));
check('顶栏有回到顶部 / 阅读进度 / 主题切换', boot.toTop && boot.readbar && boot.themeBtn);
check('启动状态是「就绪」', boot.heroStatus === '就绪', String(boot.heroStatus));
check('中文标题带中文（后面切英文时再看是否换掉）', /[\u4e00-\u9fff]/.test(boot.title), String(boot.title));

console.log('\n[2] 内置数据：数据集 / 预览表 / 列概览');
const dataView = await jv(`JSON.stringify((function () {
  var cards = [].map.call(document.querySelectorAll('#ds-list .ds-card'), function (b) {
    return { name: h.txt(b.querySelector('.ds-name')), desc: h.txt(b.querySelector('.ds-desc')), on: b.classList.contains('is-on') };
  });
  var srcs = [].map.call(document.querySelectorAll('#src-list .src-item'), function (li) {
    return {
      name: h.txt(li.querySelector('.src-name')),
      meta: h.txt(li.querySelector('.src-meta')),
      on: li.classList.contains('is-on'),
      acts: [].map.call(li.querySelectorAll('.src-acts button, .src-acts .chip'), function (n) { return n.textContent.trim(); })
    };
  });
  var st = {};
  ['st-rows', 'st-cols', 'st-steps', 'st-numeric', 'st-category', 'st-missing'].forEach(function (id) { st[id] = h.t(id); });
  return {
    cards: cards, srcs: srcs, st: st,
    chip: h.t('preview-chip'), note: h.t('preview-note'), status: h.t('data-status'),
    delim: h.num('delim-select'),
    fileInput: !!document.getElementById('file-input'),
    paste: !!document.getElementById('paste-area') && !!document.getElementById('paste-btn'),
    url: !!document.getElementById('url-input') && !!document.getElementById('url-btn'),
    table: h.table('data-table'),
    profile: h.table('profile-table')
  };
})())`);
check('数据集列表 6 张卡，第一张默认选中，名称顺序固定',
  dataView.cards.length === 6 && dataView.cards[0].on === true &&
  dataView.cards.map((c) => c.name).join('|') === DS_NAMES.join('|') &&
  dataView.cards.every((c) => c.desc && c.desc.length > 0),
  JSON.stringify(dataView.cards));
check('数据源列表 1 张、处于选中态、显示 320 × 11',
  dataView.srcs.length === 1 && dataView.srcs[0].on === true && /320 × 11/.test(dataView.srcs[0].meta),
  JSON.stringify(dataView.srcs));
check('数据源名随语言（当前中文「销售流水」）', dataView.srcs[0].name === '销售流水', String(dataView.srcs[0].name));
check('英雄区 6 个指标：320 行 / 11 列 / 0 步 / 6 数值 / 5 类别 / 20 缺失',
  dataView.st['st-rows'] === '320' && dataView.st['st-cols'] === '11' && dataView.st['st-steps'] === '0' &&
  dataView.st['st-numeric'] === '6' && dataView.st['st-category'] === '5' && dataView.st['st-missing'] === '20',
  JSON.stringify(dataView.st));
check('状态行 = 已载入「销售流水」：320 行 × 11 列',
  dataView.status === '已载入「销售流水」：320 行 × 11 列', String(dataView.status));
check('预览徽标 320 × 11，注释说明只显示前 12 行',
  dataView.chip === '320 × 11' && dataView.note === '只显示前 12 行，共 320 行；导出时用完整数据。',
  dataView.chip + ' / ' + dataView.note);
check('数据预览表表头 12 列（# + 11 个字段）',
  !!dataView.table && dataView.table.head.length === 12 && dataView.table.head[1] === 'order_id' &&
  dataView.table.head[11] === 'rating', JSON.stringify(dataView.table && dataView.table.head));
check('预览表正好 12 行（PREVIEW_ROWS）', !!dataView.table && dataView.table.n === PREVIEW_ROWS, String(dataView.table && dataView.table.n));
check('列概览表 11 行，表头固定',
  !!dataView.profile && dataView.profile.n === 11 &&
  dataView.profile.head.join('|') === ['列名', '类型', '缺失', '唯一值', '最小', '最大', '均值'].join('|'),
  JSON.stringify(dataView.profile && dataView.profile.head));
check('导入控件齐全（分隔符 / 文件 / 粘贴 / 网址）',
  dataView.delim === 'auto' && dataView.fileInput && dataView.paste && dataView.url, JSON.stringify(dataView.delim));

/* 单元格真值：vis3 曾经把 records() 的行对象直接塞进 <td>，表格会整片 NaN —— 这里逐列钉死 */
const colIdx = {};
(dataView.table ? dataView.table.head : []).forEach((name, i) => { colIdx[name] = i; });
const cellRows = dataView.table ? dataView.table.all : [];
const NUMERIC_COLS = ['units', 'unit_price', 'discount', 'revenue', 'cost'];
/* 数值列在表里带千分位（14,399），比较前先去掉逗号 */
const isNum = (v) => { const s = String(v).replace(/,/g, ''); return s !== '' && isFinite(Number(s)); };
const badCells = [];
cellRows.forEach((row, r) => {
  if (row.length !== 12) { badCells.push('r' + r + ' 列数=' + row.length); return; }
  if (!/^\d+$/.test(row[colIdx['#']])) badCells.push('r' + r + ' #=' + row[colIdx['#']]);
  if (!/^SO-\d{4}$/.test(row[colIdx['order_id']])) badCells.push('r' + r + ' order_id=' + row[colIdx['order_id']]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row[colIdx['date']])) badCells.push('r' + r + ' date=' + row[colIdx['date']]);
  ['region', 'category', 'channel'].forEach((c) => {
    const v = row[colIdx[c]];
    if (!v || v === 'NaN' || v === 'undefined') badCells.push('r' + r + ' ' + c + '=' + v);
  });
  NUMERIC_COLS.forEach((c) => { if (!isNum(row[colIdx[c]])) badCells.push('r' + r + ' ' + c + '=' + row[colIdx[c]]); });
  const rating = row[colIdx['rating']];
  if (rating !== 'NaN' && !isNum(rating)) badCells.push('r' + r + ' rating=' + rating);
});
check('预览表每格都是真值（序号 / 单号 / 日期 / 文本列 / 数值列各按各的格式）',
  cellRows.length === PREVIEW_ROWS && badCells.length === 0, badCells.slice(0, 6).join(' ; '));
const nanRows = cellRows.filter((row) => row.indexOf('NaN') >= 0).length;
check('缺失值显示成 pandas 的 NaN，但不是整片 NaN', nanRows <= 4, 'NaN 行数 ' + nanRows);
const undefRows = cellRows.concat(dataView.profile ? dataView.profile.all : [])
  .filter((row) => row.some((v) => v === 'undefined' || v === 'null'));
check('表格里不出现 undefined / null', undefRows.length === 0, JSON.stringify(undefRows.slice(0, 3)));
const ratingRow = (dataView.profile ? dataView.profile.all : []).find((row) => row[0] === 'rating');
check('列概览里 rating 缺失 20（与英雄区一致）', !!ratingRow && ratingRow[2] === '20', JSON.stringify(ratingRow));
const unitsRow = (dataView.profile ? dataView.profile.all : []).find((row) => row[0] === 'units');
check('列概览里 units 是数值列且无缺失', !!unitsRow && unitsRow[1] === 'int64' && unitsRow[2] === '0', JSON.stringify(unitsRow));

console.log('\n[3] 变换面板：52 个算子 / 空态 / 形状轨迹 / 描述统计 / 代码框');
const OPS_IDS = ['filter', 'select', 'drop', 'rename', 'sort', 'head', 'astype', 'assign', 'dropna',
  'fillna', 'drop_duplicates', 'groupby', 'value_counts', 'pivot', 'crosstab', 'corr', 'describe', 'merge', 'concat'];
const OPS_ZH = ['按条件筛选', '选择列', '删除列', '重命名列', '排序', '取前 N 行', '类型转换', '新增计算列',
  '删除缺失行', '填充缺失值', '去除重复行', '分组聚合', '频数统计', '透视表', '交叉表', '相关矩阵', '描述统计',
  '两表连接', '纵向拼接'];
const panel = await jv(`JSON.stringify((function () {
  var shapes = [].map.call(document.querySelectorAll('#shape-box .shape-line'), function (n) { return n.textContent.trim(); });
  var sel = document.getElementById('op-select');
  var idOpts = [].map.call(sel.options, function (o) { return o.value; });
  var idLabels = [].map.call(sel.options, function (o) { return o.textContent.trim(); });
  var descs = [];
  idOpts.forEach(function (v) {
    sel.value = v; h.fire(sel, 'change');
    descs.push(h.t('op-desc'));
  });
  sel.value = 'filter'; h.fire(sel, 'change');
  return {
    idOpts: idOpts, idLabels: idLabels, descs: descs,
    firstDesc: h.t('op-desc'),
    empty: h.cnt('#steps .steps-empty'),
    emptyText: h.textOf('#steps .steps-empty'),
    cardCount: h.cnt('#steps .step'),
    shapes: shapes, resultShape: h.t('result-shape'), resultNote: h.t('result-note'),
    result: h.table('result-table'), stats: h.table('stats-table'),
    codePre: !!document.querySelector('#code-block') && document.querySelector('#code-block').tagName,
    codeCopy: !!document.getElementById('code-copy'),
    code: h.t('code-text'), codeStatus: h.t('code-status'),
    codeLines: (h.t('code-text') || '').split('\\n').length
  };
})())`);
const legacyOpts = panel.idOpts.filter((id) => OPS_IDS.indexOf(id) >= 0);
const legacyLabels = panel.idOpts.map((id, i) => (OPS_IDS.indexOf(id) >= 0 ? panel.idLabels[i] : null))
  .filter((x) => x !== null);
check('算子下拉扩充到 ' + panel.idOpts.length + ' 项（原有 19 项保持相对顺序与文案）',
  panel.idOpts.length === 52 && legacyOpts.join('|') === OPS_IDS.join('|') &&
  legacyLabels.join('|') === OPS_ZH.join('|'),
  panel.idOpts.length + ' / ' + legacyOpts.join('|'));
check('下拉按 5 组归堆（<optgroup>）',
  (await jv(`document.querySelectorAll('#op-select optgroup').length`)) === 5,
  String(await jv(`document.querySelectorAll('#op-select optgroup').length`)));
check('每个算子都有说明文案，且各不相同',
  panel.descs.length === panel.idOpts.length && panel.descs.every((d) => d && d.length > 4) &&
  new Set(panel.descs).size === panel.descs.length,
  JSON.stringify(panel.descs.slice(0, 3)));
check('步骤区空态：一条提示，没有步骤卡',
  panel.empty === 1 && panel.cardCount === 0 && /选一个操作/.test(panel.emptyText || ''), String(panel.emptyText));
check('形状轨迹两条：原始数据 / 当前结果',
  panel.shapes.join(' | ') === ['原始数据：320 行 × 11 列', '当前结果：320 行 × 11 列'].join(' | '),
  panel.shapes.join(' | '));
check('结果形状行与之一致', panel.resultShape === '当前结果：320 行 × 11 列', String(panel.resultShape));
check('结果表 12 行，首列仍是 order_id，且没有 undefined / null',
  !!panel.result && panel.result.n === PREVIEW_ROWS && panel.result.head[1] === 'order_id' &&
  !panel.result.all.some((r) => r.some((v) => v === 'undefined' || v === 'null')),
  JSON.stringify(panel.result && panel.result.head));
check('描述统计表：11 个统计量 × 11 列（首列放统计量名）',
  !!panel.stats && panel.stats.n === 11 && panel.stats.head.length === 12 && panel.stats.head[0] === '' &&
  panel.stats.head[1] === 'units', JSON.stringify(panel.stats && panel.stats.head));
const statRow = (panel.stats ? panel.stats.all : []).find((r) => r[0] === 'count');
const statsHead = panel.stats ? panel.stats.head : [];
check('描述统计：count 行 units=320、rating=300（20 个缺失）',
  !!statRow && statRow[1] === '320' && statRow[statsHead.indexOf('rating')] === '300', JSON.stringify(statRow));
const codeText = panel.code || '';
const codeLines = codeText.split('\n');
const wants = [
  '# 读取数据',
  'import pandas as pd',
  'import matplotlib.pyplot as plt',
  'df = pd.read_csv("sales.csv")',
  'fig, ax = plt.subplots(figsize=(9, 5))'
];
check('代码框有 <pre><code> 与复制按钮，代码首段正确',
  panel.codePre === 'PRE' && panel.codeCopy && codeLines.length > 12 && panel.codeLines === codeLines.length &&
  wants.every((w) => codeLines.indexOf(w) >= 0), JSON.stringify(codeLines.slice(0, 8)));
check('代码里没有 undefined / NaN 残渣',
  !/undefined/.test(codeText) && !/NaN/.test(codeText), codeText.slice(0, 200));
check('代码末段含绘图与导出文件名（与数据集 id 同名 sales）',
  codeText.indexOf('fig.savefig("sales-chart.png", dpi=150)') >= 0 &&
  codeText.indexOf('df.to_csv("sales-result.csv", index=False)') >= 0 &&
  codeText.indexOf('ax = df.groupby("order_id")["units"]') >= 0,
  codeLines.slice(-4).join(' / '));

console.log('\n[4] 单步筛选：默认参数 → region == East');
/* 添加一步：filter 的默认参数是 第一列 == 空串，必然过滤掉全部 320 行 —— 正好测空结果兜底 */
await ev(`h.click('op-add')`);
await sleep(250);
const stepDefault = await jv(`JSON.stringify((function () {
  var shapes = [].map.call(document.querySelectorAll('#shape-box .shape-line'), function (n) { return { text: n.textContent.trim(), error: n.classList.contains('is-error') }; });
  return {
    count: h.cnt('#steps .step'), step: h.step(), shapes: shapes,
    resultShape: h.t('result-shape'), resultNote: h.t('result-note'),
    resultRows: h.table('result-table').n,
    heroSteps: h.t('st-steps'), heroRows: h.t('st-rows'), workbench: h.t('workbench-status'),
    svgs: h.svgs().length, chartNote: h.t('chart-note'), chartRows: h.table('chart-table').n,
    code: h.t('code-text')
  };
})())`);
check('步骤卡出现，编号 1、名字「按条件筛选」、不是错误态',
  stepDefault.count === 1 && stepDefault.step.no === '1' && stepDefault.step.op === '按条件筛选' &&
  stepDefault.step.error === false, JSON.stringify(stepDefault.step));
check('筛选三个字段 id 齐全且 <label for> 一一对应',
  stepDefault.step.fields.join('|') === ['f-filter-col', 'f-filter-op', 'f-filter-value'].join('|') &&
  stepDefault.step.labelFor.join('|') === ['f-filter-col', 'f-filter-op', 'f-filter-value'].join('|'),
  JSON.stringify(stepDefault.step.fields) + ' / ' + JSON.stringify(stepDefault.step.labelFor));
check('步骤卡三枚按钮：上移 / 下移（单步时禁用）/ 删除（可用）',
  stepDefault.step.btns.length === 3 && stepDefault.step.btns[0].disabled === true &&
  stepDefault.step.btns[1].disabled === true && stepDefault.step.btns[2].disabled === false &&
  /上移/.test(stepDefault.step.btns[0].text) && /下移/.test(stepDefault.step.btns[1].text) && /删除/.test(stepDefault.step.btns[2].text),
  JSON.stringify(stepDefault.step.btns));
check('默认筛选（order_id == ""）结果 0 行，图注写明过滤掉 320 行',
  /^这一步之后：0 行 × 11 列/.test(stepDefault.step.note || '') && /过滤掉 320 行/.test(stepDefault.step.note || ''),
  String(stepDefault.step.note));
check('形状轨迹三条：原始 320 → 步骤后 0 → 当前结果 0',
  stepDefault.shapes.map((s) => s.text).join(' | ') ===
  ['原始数据：320 行 × 11 列', '1. 按条件筛选 → 这一步之后：0 行 × 11 列', '当前结果：0 行 × 11 列'].join(' | '),
  JSON.stringify(stepDefault.shapes));
check('结果形状 / 结果表 / 英雄区都同步到 0 行',
  stepDefault.resultShape === '当前结果：0 行 × 11 列' && stepDefault.resultRows === 0 && stepDefault.heroRows === '0',
  stepDefault.resultShape + ' / ' + stepDefault.resultRows);
check('结果列注释跟随（输出列：order_id, …）', /^输出列：order_id/.test(stepDefault.resultNote || ''), String(stepDefault.resultNote));
check('空结果时图表不画（0 个 SVG）且图表数据表 0 行',
  stepDefault.svgs === 0 && stepDefault.chartRows === 0, stepDefault.svgs + ' / ' + stepDefault.chartRows);
check('步骤计数同步到英雄区与工作台状态', stepDefault.heroSteps === '1' && stepDefault.workbench === '1 个步骤',
  stepDefault.heroSteps + ' / ' + stepDefault.workbench);
check('代码同步出筛选那一行', (stepDefault.code || '').indexOf('df = df[df["order_id"] == ""]') >= 0,
  (stepDefault.code || '').split('\n').filter((l) => /df = df\[/.test(l)).join(' / '));

/* 把参数改成 region == East：74 行，图表应从 0 恢复到 12 根柱 */
await ev(`h.setSel('f-filter-col', 'region')`);
await ev(`h.setSel('f-filter-op', 'eq')`);
await ev(`h.setInput('f-filter-value', 'East')`);
await sleep(300);
const stepEast = await jv(`JSON.stringify((function () {
  var t = h.table('chart-table');
  var shapes = [].map.call(document.querySelectorAll('#shape-box .shape-line'), function (n) { return n.textContent.trim(); });
  return {
    note: h.step().note, resultShape: h.t('result-shape'), resultRows: h.table('result-table').n,
    heroRows: h.t('st-rows'), shapes: shapes,
    fieldValues: { col: h.num('f-filter-col'), op: h.num('f-filter-op'), value: h.num('f-filter-value') },
    chartNote: h.t('chart-note'), chartRows: t.n, chartHead: t.head, chartRow0: t.rows[0],
    marks: h.marks(), svgs: h.svgs(), code: h.t('code-text')
  };
})())`);
check('参数真改到了 region / eq / East',
  stepEast.fieldValues.col === 'region' && stepEast.fieldValues.op === 'eq' && stepEast.fieldValues.value === 'East',
  JSON.stringify(stepEast.fieldValues));
check('筛选后 74 行 × 11 列，图注写明过滤掉 246 行',
  /^这一步之后：74 行 × 11 列/.test(stepEast.note || '') && /过滤掉 246 行/.test(stepEast.note || ''),
  String(stepEast.note));
check('形状轨迹 / 结果形状 / 英雄区 / 结果表四处同步',
  stepEast.shapes.join(' | ') === ['原始数据：320 行 × 11 列', '1. 按条件筛选 → 这一步之后：74 行 × 11 列', '当前结果：74 行 × 11 列'].join(' | ') &&
  stepEast.resultShape === '当前结果：74 行 × 11 列' && stepEast.heroRows === '74' && stepEast.resultRows === 12,
  stepEast.resultShape + ' / ' + stepEast.heroRows + ' / ' + stepEast.resultRows);
check('图表数据表 = 图表用的 12 行 × [编号, order_id, units]',
  stepEast.chartRows === 12 && stepEast.chartHead.join('|') === ['#', 'order_id', 'units'].join('|') &&
  /^SO-\d{4}$/.test(stepEast.chartRow0[1]) && Number(stepEast.chartRow0[2]) > 0,
  JSON.stringify(stepEast.chartHead) + ' / ' + JSON.stringify(stepEast.chartRow0));
check('条形图恢复成 12 根柱，坐标轴刻度在', stepEast.marks.bars === 12 && stepEast.marks.ticks > 0 && stepEast.svgs.length === 1,
  JSON.stringify(stepEast.marks));
check('代码里换成 region == East', (stepEast.code || '').indexOf('df = df[df["region"] == "East"]') >= 0,
  (stepEast.code || '').split('\n').filter((l) => /df = df\[/.test(l)).join(' / '));

console.log('\n[5] 六类图表：控件显隐 / 图元计数 / 图表数据表 / aria-pressed');
const chartCtl = await jv(`JSON.stringify({
  x: h.num('chart-x'), y: [].filter.call(h.byId('chart-y').options, function (o) { return o.selected; }).map(function (o) { return o.value; }),
  color: h.num('chart-color'), agg: h.num('chart-agg'), top: h.num('chart-top'),
  bins: h.num('chart-bins'), order: h.num('chart-order'), desc: h.t('chart-desc')
})`);
check('图表控件默认值：x=order_id / y=[units] / 无配色 / sum / 前 12 / 20 箱 / 降序',
  chartCtl.x === 'order_id' && chartCtl.y.join('|') === 'units' && chartCtl.color === '__none__' &&
  chartCtl.agg === 'sum' && chartCtl.top === '12' && chartCtl.bins === '20' && chartCtl.order === 'value',
  JSON.stringify(chartCtl));
check('图表类型按钮 10 个，初始只有条形图 aria-pressed=true',
  (await jv(`JSON.stringify(h.typeButtons())`)).map((b) => b.type + ':' + b.pressed).join(' ') ===
  'bar:true barh:false line:false area:false scatter:false histogram:false kde:false box:false pie:false heatmap:false',
  JSON.stringify(await jv(`JSON.stringify(h.typeButtons())`)));

/* rows/cols = 图注里报的「当前结果」形状；tableRows/tableCols = 图下那张数据表的尺寸
   （表最多显示 PREVIEW_ROWS 行，列也按图表自己的口径，不一定等于图注的 cols） */
const CHART_TYPES = [
  { type: 'bar', show: ['x', 'y', 'color', 'agg', 'top', 'order'], rows: 12, cols: 2, tableRows: 12, tableCols: 2, marks: { bars: 12, dots: 0, paths: 0, heat: 0 } },
  { type: 'barh', show: ['x', 'y', 'color', 'agg', 'top', 'order'], rows: 12, cols: 2, tableRows: 12, tableCols: 2, marks: { bars: 12, dots: 0, paths: 0, heat: 0 } },
  { type: 'line', show: ['x', 'y', 'agg', 'top', 'order'], rows: 12, cols: 2, tableRows: 12, tableCols: 2, marks: { bars: 0, dots: 12, paths: 2, heat: 0 } },
  { type: 'area', show: ['x', 'y', 'agg', 'top', 'order'], rows: 12, cols: 2, tableRows: 12, tableCols: 2, marks: { bars: 0, dots: 12, paths: 2, heat: 0 } },
  { type: 'scatter', show: ['x', 'y', 'color', 'top'], rows: 12, cols: 2, tableRows: 12, tableCols: 2, marks: { bars: 0, dots: 12, paths: 0, heat: 0 } },
  { type: 'histogram', show: ['y', 'bins'], rows: 74, cols: 1, tableRows: 12, tableCols: 2, marks: { bars: 20, dots: 0, paths: 0, heat: 0 } },
  { type: 'kde', show: ['y'], rows: 61, cols: 2, tableRows: 12, tableCols: 2, marks: { bars: 0, dots: 0, paths: 2, heat: 0 } },
  { type: 'box', show: ['x', 'y', 'top'], rows: 12, cols: 7, tableRows: 12, tableCols: 7, marks: { bars: 12, dots: 0, paths: 0, heat: 0 } },
  { type: 'pie', show: ['x', 'y', 'agg', 'top', 'order'], rows: 12, cols: 2, tableRows: 12, tableCols: 3, marks: { bars: 0, dots: 0, paths: 12, heat: 0 } },
  { type: 'heatmap', show: ['x', 'y', 'agg', 'order'], rows: 12, cols: 1, tableRows: 12, tableCols: 2, marks: { bars: 0, dots: 0, paths: 0, heat: 12 } }
];
const CHART_WRAP_KEYS = ['x', 'y', 'color', 'agg', 'bins', 'top', 'order'];
const chartSweep = await jv(`(async function () {
  var out = {};
  var types = ${JSON.stringify(CHART_TYPES.map((t) => t.type))};
  var keys = ${JSON.stringify(CHART_WRAP_KEYS)};
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
    h.clickSel('#chart-types button[data-type="' + type + '"]');
    await new Promise(function (r) { setTimeout(r, 180); });
    var tb = h.table('chart-table');
    var wraps = {};
    keys.forEach(function (k) { wraps[k] = h.shown('chart-' + k + '-wrap'); });
    out[type] = {
      wraps: wraps, marks: h.marks(), svgs: h.svgs(), note: h.t('chart-note'),
      desc: h.t('chart-desc'), status: h.t('chart-status'),
      tableHead: tb.head, tableRows: tb.n,
      pressed: [].map.call(document.querySelectorAll('#chart-types button'), function (b) { return b.getAttribute('data-type') + ':' + b.getAttribute('aria-pressed'); }).join(' ')
    };
  }
  /* 收回条形图，方便后面的导出断言 */
  h.clickSel('#chart-types button[data-type="bar"]');
  await new Promise(function (r) { setTimeout(r, 180); });
  return JSON.stringify(out);
})()`);

CHART_TYPES.forEach((spec) => {
  const got = chartSweep[spec.type];
  const wantShown = spec.show;
  const visOk = CHART_WRAP_KEYS.every((k) => got.wraps[k] === (wantShown.indexOf(k) >= 0));
  const marksOk = Object.keys(spec.marks).every((k) => got.marks[k] === spec.marks[k]);
  check(`[${spec.type}] 控件显隐正确（${wantShown.join('/')}）`, visOk, JSON.stringify(got.wraps));
  check(`[${spec.type}] 图元计数符合预期 ${JSON.stringify(spec.marks)}`, marksOk, JSON.stringify(got.marks));
  check(`[${spec.type}] 画出 1 个 SVG 且 viewBox 合法`,
    got.svgs.length === 1 && /^0 0 \d+(\.\d+)? \d+(\.\d+)?$/.test(got.svgs[0]), JSON.stringify(got.svgs));
  check(`[${spec.type}] 图表数据表 ${spec.tableRows} 行 × ${spec.tableCols + 1} 列（首列 #）`,
    got.tableRows === spec.tableRows && got.tableHead.length === spec.tableCols + 1 && got.tableHead[0] === '#',
    got.tableRows + ' / ' + got.tableHead.length + ' / ' + JSON.stringify(got.tableHead));
  check(`[${spec.type}] 图注 = 当前结果：${spec.rows} 行 × ${spec.cols} 列`,
    got.note === `当前结果：${spec.rows} 行 × ${spec.cols} 列`, String(got.note));
  check(`[${spec.type}] aria-pressed 只有一个 true 且是这个类型`,
    got.pressed.split(' ').filter((p) => /:true$/.test(p)).length === 1 && got.pressed.indexOf(spec.type + ':true') >= 0,
    got.pressed);
  check(`[${spec.type}] 类型说明文案非空`, !!got.desc && got.desc.length > 4, String(got.desc));
});
check('10 种图表类型的说明文案各不相同',
  new Set(CHART_TYPES.map((t) => chartSweep[t.type].desc)).size === CHART_TYPES.length,
  JSON.stringify(CHART_TYPES.map((t) => chartSweep[t.type].desc)));

console.log('\n[6] 矩阵结果：相关矩阵 6×6');
await ev(`h.clickSel('#chart-types button[data-type="heatmap"]')`);
await sleep(200);
await ev(`h.setSel('op-select', 'corr')`);
await ev(`h.click('op-add')`);
await sleep(300);
const corr = await jv(`JSON.stringify((function () {
  var steps = [].map.call(document.querySelectorAll('#steps .step'), function (it) {
    return { no: h.txt(it.querySelector('.step-no')), op: h.txt(it.querySelector('.step-op')), note: h.txt(it.querySelector('.step-note')) };
  });
  var shapes = [].map.call(document.querySelectorAll('#shape-box .shape-line'), function (n) { return n.textContent.trim(); });
  var rt = h.table('result-table');
  var ct = h.table('chart-table');
  return {
    steps: steps, cardCount: h.cnt('#steps .step'), fields2: h.fieldIds(document.querySelectorAll('#steps .step')[1]),
    shapes: shapes, resultShape: h.t('result-shape'), resultNote: h.t('result-note'),
    resultHead: rt.head, resultRows: rt.n, resultAll: rt.all,
    statsRows: h.table('stats-table').n,
    chartRows: ct.n, chartHead: ct.head, marks: h.marks(), chartNote: h.t('chart-note'),
    heroRows: h.t('st-rows'), heroCols: h.t('st-cols'), code: h.t('code-text')
  };
})())`);
check('第二个步骤卡是相关矩阵，字段只有一列多选',
  corr.cardCount === 2 && corr.steps[1].op === '相关矩阵' &&
  corr.fields2.join('|') === 'f-corr-cols', JSON.stringify(corr.fields2));
check('相关矩阵步骤注：6 行 × 6 列，过滤掉 68 行（74 - 6）',
  /^这一步之后：6 行 × 6 列/.test(corr.steps[1].note || '') && /过滤掉 68 行/.test(corr.steps[1].note || ''),
  String(corr.steps[1].note));
check('形状轨迹 4 行：原始 320 → 筛选 74 → 矩阵 6 → 当前 6',
  corr.shapes.join(' | ') === ['原始数据：320 行 × 11 列', '1. 按条件筛选 → 这一步之后：74 行 × 11 列',
    '2. 相关矩阵 → 这一步之后：6 行 × 6 列', '当前结果：6 行 × 6 列'].join(' | '), corr.shapes.join(' | '));
check('矩阵结果表：6 行 × 8 列（# + 行标签 + 6 个数值列）',
  corr.resultRows === 6 && corr.resultHead.join('|') === ['#', '', 'units', 'unit_price', 'discount', 'revenue', 'cost', 'rating'].join('|'),
  JSON.stringify(corr.resultHead));
check('左上到右下的对角线都是 1（自相关）',
  corr.resultAll.every((row, i) => Math.abs(Number(row[i + 2]) - 1) < 1e-9),
  JSON.stringify(corr.resultAll.map((row, i) => row[i + 2])));
check('相关系数都在 [-1, 1] 且不是 NaN（vis3 曾整表错位）',
  corr.resultAll.every((row) => row.slice(2).every((v) => v !== '' && Math.abs(Number(v)) <= 1 && v !== 'undefined')),
  JSON.stringify(corr.resultAll[0]));
check('矩阵提示改写成「直接按矩阵渲染」', /矩阵/.test(corr.resultNote || '') && /渲染/.test(corr.resultNote || ''),
  String(corr.resultNote));
check('结果形状行 = 当前结果：6 行 × 6 列', corr.resultShape === '当前结果：6 行 × 6 列', String(corr.resultShape));
check('英雄区跟着变（6 行 / 6 列）', corr.heroRows === '6' && corr.heroCols === '6', corr.heroRows + ' / ' + corr.heroCols);
check('描述统计表对矩阵结果重算（8 个统计量）', corr.statsRows === 8, String(corr.statsRows));
check('热力图把 6×6 矩阵画成 36 格，格子里带读数',
  corr.marks.heat === 36 && corr.marks.heatval === 36, JSON.stringify(corr.marks));
check('图表数据表 = 6 行矩阵（# + 6 列 + 行标签）',
  corr.chartRows === 6 && corr.chartHead.length === 8, corr.chartRows + ' / ' + corr.chartHead.length);
check('热力图图注讲皮尔逊系数（暖色正相关）',
  /皮尔逊/.test(corr.chartNote || '') && /暖色/.test(corr.chartNote || ''), String(corr.chartNote));
check('代码里出现 df.corr(numeric_only=True)', (corr.code || '').indexOf('df.corr(numeric_only=True)') >= 0,
  (corr.code || '').split('\n').filter((l) => /corr/.test(l)).join(' / '));

console.log('\n[7] 19 个原有算子逐个添加：字段 id / 错误捕获 / 形状 / 代码');
const OP_EXPECT = {
  filter: { fields: ['f-filter-col', 'f-filter-op', 'f-filter-value'], note: /^这一步之后：0 行 × 11 列/ },
  select: { fields: ['f-select-cols'], note: /^这一步之后：320 行 × 3 列/ },
  drop: { fields: ['f-drop-cols'], error: /请选择列/ },
  rename: { fields: ['f-rename-from', 'f-rename-to'], error: /请选择列/ },
  sort: { fields: ['f-sort-col', 'f-sort-desc'], note: /^这一步之后：320 行 × 11 列/ },
  head: { fields: ['f-head-n'], note: /^这一步之后：20 行 × 11 列[\s\S]*过滤掉 300 行/ },
  astype: { fields: ['f-astype-col', 'f-astype-type'], note: /^这一步之后：320 行 × 11 列/ },
  assign: { fields: ['f-assign-name', 'f-assign-left', 'f-assign-operand', 'f-assign-rightKind', 'f-assign-rightCol'], note: /^这一步之后：320 行 × 12 列/ },
  dropna: { fields: ['f-dropna-cols', 'f-dropna-how'], note: /^这一步之后：300 行 × 11 列[\s\S]*过滤掉 20 行/ },
  fillna: { fields: ['f-fillna-cols', 'f-fillna-method'], note: /^这一步之后：320 行 × 11 列/ },
  drop_duplicates: { fields: ['f-drop_duplicates-cols'], note: /^这一步之后：320 行 × 11 列/ },
  groupby: { fields: ['f-groupby-by', 'f-groupby-aggCol', 'f-groupby-aggFunc'], note: /^这一步之后：320 行 × 2 列/ },
  value_counts: { fields: ['f-value_counts-col'], note: /^这一步之后：320 行 × 3 列/ },
  pivot: { fields: ['f-pivot-index', 'f-pivot-columns', 'f-pivot-values', 'f-pivot-aggfunc'], note: /^这一步之后：320 行 × 199 列/ },
  crosstab: { fields: ['f-crosstab-index', 'f-crosstab-columns'], note: /^这一步之后：320 行 × 200 列/ },
  corr: { fields: ['f-corr-cols'], note: /^这一步之后：6 行 × 6 列[\s\S]*过滤掉 314 行/ },
  describe: { fields: [], note: /^这一步之后：11 行 × 11 列[\s\S]*过滤掉 309 行/ },
  merge: { fields: ['f-merge-source', 'f-merge-leftOn', 'f-merge-rightOn', 'f-merge-how'], error: /请选择另一张表/ },
  concat: { fields: ['f-concat-source', 'f-concat-axis'], error: /请选择另一张表/ }
};
const opSweep = await jv(`(async function () {
  var ids = ${JSON.stringify(OPS_IDS)};
  var out = {};
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    h.click('steps-reset');
    await new Promise(function (r) { setTimeout(r, 60); });
    h.setSel('op-select', id);
    await new Promise(function (r) { setTimeout(r, 30); });
    h.click('op-add');
    await new Promise(function (r) { setTimeout(r, 90); });
    var st = h.step() || {};
    var code = h.t('code-text') || '';
    out[id] = {
      cardCount: h.cnt('#steps .step'), op: st.op, desc: h.t('op-desc'),
      fields: st.fields, isError: st.error, note: st.note, hint: st.hint,
      resultShape: h.t('result-shape'), heroRows: h.t('st-rows'),
      codeLen: code.length, codeUndef: code.indexOf('undefined') >= 0, codeNaN: code.indexOf('NaN') >= 0,
      errs: (window.__errs || []).slice(-2)
    };
  }
  /* 收尾：清空步骤，回到干净的空态（后面 ⑧ 导出、⑨ 双语都从这里开始） */
  h.click('steps-reset');
  await new Promise(function (r) { setTimeout(r, 80); });
  return JSON.stringify(out);
})()`);
OPS_IDS.forEach((id, i) => {
  const got = opSweep[id];
  const spec = OP_EXPECT[id];
  const fieldsOk = (got.fields || []).join('|') === spec.fields.join('|');
  check(`[${id}] 步骤卡 = 第 ${i + 1} 号「${OPS_ZH[i]}」，字段 id 齐全`,
    got.cardCount === 1 && got.op === OPS_ZH[i] && fieldsOk,
    got.op + ' / ' + JSON.stringify(got.fields));
  check(`[${id}] 下拉说明与 ③ 里登记的一致`, got.desc === panel.descs[panel.idOpts.indexOf(id)], String(got.desc));
  if (spec.error) {
    check(`[${id}] 参数不合法 → 步骤标红并把错误写成图注`,
      got.isError === true && spec.error.test(got.note || ''), String(got.note));
    check(`[${id}] 出错时结果回落到原始 320 行 × 11 列`,
      got.resultShape === '当前结果：320 行 × 11 列' && got.heroRows === '320',
      got.resultShape + ' / ' + got.heroRows);
  } else {
    const m = /^这一步之后：(\d+) 行 × (\d+) 列/.exec(got.note || '');
    check(`[${id}] 步骤注与形状轨迹一致（${m ? m[1] + '×' + m[2] : '???'}）`,
      !!m && spec.note.test(got.note) && got.resultShape === `当前结果：${m[1]} 行 × ${m[2]} 列` &&
      got.heroRows === m[1], String(got.note) + ' / ' + got.resultShape);
  }
  check(`[${id}] 代码非空且不含 undefined`, got.codeLen > 200 && !got.codeUndef, got.codeLen + ' / ' + got.codeUndef);
  check(`[${id}] 加这一步没有引发页面报错`, got.errs.length === 0, JSON.stringify(got.errs));
});
const resetState = await jv(`JSON.stringify({
  empty: h.cnt('#steps .steps-empty'), cards: h.cnt('#steps .step'), hero: h.t('st-steps'),
  shapes: [].map.call(document.querySelectorAll('#shape-box .shape-line'), function (n) { return n.textContent.trim(); })
})`);
check('清空全部步骤后回到空态（提示回来 / 0 张卡 / 形状轨迹回到 2 行）',
  resetState.empty === 1 && resetState.cards === 0 && resetState.hero === '0' &&
  resetState.shapes.join(' | ') === ['原始数据：320 行 × 11 列', '当前结果：320 行 × 11 列'].join(' | '),
  JSON.stringify(resetState));

console.log('\n[7b] 新增 33 种算子逐个添加：卡片 / 形状 / 代码 / 无报错');
const NEW_OPS = ['replace', 'str_op', 'clip', 'to_datetime', 'categorical', 'duplicated', 'cut', 'qcut',
  'get_dummies', 'query', 'isin', 'between', 'sample', 'nlargest', 'iloc', 'set_index', 'reset_index',
  'melt', 'cov', 'agg_multi', 'transform', 'group_filter', 'rank', 'cumsum', 'rolling', 'expanding',
  'diff', 'shift', 'resample', 'date_part', 'date_offset', 'join', 'combine_first'];
const opSweep2 = await jv(`(async function () {
  var ids = ${JSON.stringify(NEW_OPS)};
  var out = {};
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    h.click('steps-reset');
    await new Promise(function (r) { setTimeout(r, 60); });
    h.setSel('op-select', id);
    await new Promise(function (r) { setTimeout(r, 30); });
    h.click('op-add');
    await new Promise(function (r) { setTimeout(r, 90); });
    var st = h.step() || {};
    var sel = document.getElementById('op-select');
    var chose = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].textContent.trim() : '';
    var code = h.t('code-text') || '';
    out[id] = {
      cardCount: h.cnt('#steps .step'), op: st.op, chose: chose, fields: st.fields,
      isError: st.error, note: st.note,
      resultShape: h.t('result-shape'), heroRows: h.t('st-rows'),
      codeLen: code.length, codeUndef: code.indexOf('undefined') >= 0, codeNaN: code.indexOf('NaN') >= 0,
      errs: (window.__errs || []).slice(-1)
    };
  }
  h.click('steps-reset');
  await new Promise(function (r) { setTimeout(r, 80); });
  /* 复位图表编码：有些算子（resample / melt / cov…）会临时换掉列，
     渲染器会把 chart.x 顺手改成当时还在的列；点回 order_id，后面的导出断言才稳定 */
  h.setSel('chart-x', 'order_id');
  await new Promise(function (r) { setTimeout(r, 80); });
  return JSON.stringify(out);
})()`);
NEW_OPS.forEach((id) => {
  const got = opSweep2[id] || {};
  const missTable = /请选择另一张表/.test(String(got.note));
  check(`[新增 ${id}] 卡片是这一步（卡片名 = 下拉选中的名字），且不是错误态`,
    got.cardCount === 1 && got.op === got.chose && (!got.isError || missTable),
    JSON.stringify({ op: got.op, chose: got.chose, note: got.note }));
  const shape = /这一步之后：(\d+) 行 × (\d+) 列/.exec(got.note || '');
  check(`[新增 ${id}] 形状轨迹 / 结果行 / 首屏行数三处一致`,
    missTable || (!!shape && got.resultShape === `当前结果：${shape[1]} 行 × ${shape[2]} 列` && got.heroRows === shape[1]),
    String(got.note) + ' / ' + got.resultShape);
  check(`[新增 ${id}] 代码非空且不含 undefined`,
    got.codeLen > 200 && !got.codeUndef, got.codeLen + ' / ' + got.codeUndef);
  check(`[新增 ${id}] 加这一步没有引发页面报错`, (got.errs || []).length === 0, JSON.stringify(got.errs));
});

console.log('\n[8] 导出：结果 CSV / JSON / HTML / SQL、图表 CSV / SVG / PNG、代码 .py');
await ev(`h.clickSel('#chart-types button[data-type="bar"]')`);
await sleep(250);
try {
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR, eventsEnabled: true });
} catch (e) {
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
}
/* 真下载照走（落盘到 DL_DIR），只是顺手把 a[download] 的名字与 blob 留档 */
await ev(`(function () {
  window.__dlName = null; window.__blobs = [];
  var oc = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { window.__dlName = this.download; return oc.call(this); };
  var cu = URL.createObjectURL;
  URL.createObjectURL = function (b) { window.__blobs.push(b); return cu.call(URL, b); };
})()`);
/* 等文件落盘：Chrome 先写 .crdownload，写完才改回真名 */
async function onDisk(name) {
  const p = join(DL_DIR, name);
  for (let i = 0; i < 40; i++) {
    try { if (existsSync(p) && statSync(p).size > 0) return statSync(p).size; } catch (e) { /* 还没落盘 */ }
    await sleep(150);
  }
  return -1;
}
async function fireExport(id, waitMs) {
  await ev(`window.__dlName = null; window.__blobs = []; h.click(${JSON.stringify(id)})`);
  await sleep(waitMs || 900);
  return jv(`JSON.stringify({
    name: window.__dlName, blobCount: window.__blobs.length,
    lastType: window.__blobs.length ? window.__blobs[window.__blobs.length - 1].type : '',
    lastSize: window.__blobs.length ? window.__blobs[window.__blobs.length - 1].size : 0,
    dataStatus: h.t('data-status'), chartStatus: h.t('chart-status'), codeStatus: h.t('code-status')
  })`);
}
const bText = (i) => ev(`(function () { var b = window.__blobs[${i}]; return b ? b.text() : 'no-blob'; })()`);

const expCSV = await fireExport('export-csv');
const csvText = await bText(0);
const csvSize = await onDisk('sales-result.csv');
check('结果 CSV：下载名 sales-result.csv，状态行报出文件名与形状',
  expCSV.name === 'sales-result.csv' && expCSV.blobCount === 1 &&
  expCSV.dataStatus === '已载入「sales-result.csv」：320 行 × 11 列',
  expCSV.name + ' / ' + expCSV.dataStatus);
/* BOM 判定必须走磁盘字节：Blob.text() 按 UTF-8 解码时会把开头的 BOM 吃掉，读回来永远「没 BOM」 */
const csvRaw = existsSync(join(DL_DIR, 'sales-result.csv')) ? readFileSync(join(DL_DIR, 'sales-result.csv')) : Buffer.alloc(0);
const csvLines = csvRaw.toString('utf8').split('\r\n');

check('结果 CSV：BOM（EF BB BF）+ CRLF，321 行 = 表头 + 全量 320 行（导出用完整数据）',
  csvRaw[0] === 0xef && csvRaw[1] === 0xbb && csvRaw[2] === 0xbf && csvLines.length - 1 === 321 &&
  /order_id/.test(csvLines[0]) && /units/.test(csvLines[0]) && /SO-\d{4}/.test(csvLines[1]),
  csvRaw.slice(0, 3).toString('hex') + ' / 行数 ' + (csvLines.length - 1) + ' / 表头 ' + csvLines[0].replace(/^\uFEFF/, '').slice(0, 40));
check('结果 CSV：Blob 文本与磁盘内容一致（开头的 BOM 被 UTF-8 解码吃掉）',
  String(csvText).replace(/^\uFEFF/, '') === csvRaw.toString('utf8').replace(/^\uFEFF/, ''),
  String(csvText).slice(0, 40));
check('结果 CSV 真的落盘（> 5KB）', csvSize > 5000, String(csvSize));

const expJSON = await fireExport('export-json');
const jsonText = await bText(0);
const jsonSize = await onDisk('sales-result.json');
let jsonArr = null;
try { jsonArr = JSON.parse(jsonText); } catch (e) { jsonArr = null; }
check('结果 JSON：下载名 sales-result.json，解析成 320 条对象 × 11 个字段',
  expJSON.name === 'sales-result.json' && Array.isArray(jsonArr) && jsonArr.length === 320 &&
  Object.keys(jsonArr[0]).length === 11 && /^SO-\d{4}$/.test(jsonArr[0].order_id),
  expJSON.name + ' / ' + (jsonArr ? jsonArr.length + ' 条 / ' + JSON.stringify(jsonArr[0]).slice(0, 80) : '解析失败'));
check('结果 JSON：20 个缺失的 rating 写成 null，数值列保持 number',
  Array.isArray(jsonArr) && jsonArr.filter((o) => o.rating === null).length === 20 &&
  jsonArr.every((o) => typeof o.units === 'number'),
  Array.isArray(jsonArr) ? String(jsonArr.filter((o) => o.rating === null).length) : 'n/a');
check('结果 JSON 真的落盘（> 20KB）', jsonSize > 20000, String(jsonSize));

const expHTML = await fireExport('export-html');
const htmlText = await bText(0);
const htmlSize = await onDisk('sales-result.html');
check('结果 HTML：下载名 sales-result.html，含 <table> / thead 与 11 列表头',
  expHTML.name === 'sales-result.html' && htmlText.indexOf('<table') > 0 && htmlText.indexOf('<thead>') > 0 &&
  (htmlText.match(/<th>/g) || []).length === 11 && /order_id/.test(htmlText) &&
  expHTML.dataStatus === '已载入「sales-result.html」：320 行 × 11 列',
  expHTML.name + ' / ' + expHTML.dataStatus);
check('结果 HTML 真的落盘（> 20KB）', htmlSize > 20000, String(htmlSize));

const expSQL = await fireExport('export-sql');
const sqlText = await bText(0);
const sqlSize = await onDisk('sales-result.sql');
check('结果 SQL：下载名 sales-result.sql，CREATE TABLE 按 dtype 建列 + INSERT',
  expSQL.name === 'sales-result.sql' && /CREATE TABLE sales/.test(sqlText) && /INSERT INTO sales/.test(sqlText) &&
  /"units" INTEGER/.test(sqlText) && /"date" TIMESTAMP/.test(sqlText) && /"region" TEXT/.test(sqlText),
  expSQL.name + ' / ' + sqlText.split('\n').slice(0, 2).join(' '));
check('结果 SQL 真的落盘（> 5KB）', sqlSize > 5000, String(sqlSize));

const expChartCSV = await fireExport('export-chart-csv');
const chartCsvText = await bText(0);
const chartCsvSize = await onDisk('sales-chart-bar.csv');
check('图表 CSV：名字带上图表类型（sales-chart-bar.csv），状态行提示开始下载',
  expChartCSV.name === 'sales-chart-bar.csv' && expChartCSV.chartStatus === '已开始下载：sales-chart-bar.csv',
  expChartCSV.name + ' / ' + expChartCSV.chartStatus);
check('图表 CSV：表头「索引,order_id,units」+ 12 行（与图表上的柱一一对应）',
  /order_id/.test(chartCsvText.split('\r\n')[0]) && /units/.test(chartCsvText.split('\r\n')[0]) &&
  chartCsvText.split('\r\n').length - 1 === 13, chartCsvText.split('\r\n')[0] + ' / 行数 ' + (chartCsvText.split('\r\n').length - 1));
check('图表 CSV 真的落盘（> 100B）', chartCsvSize > 100, String(chartCsvSize));

const expSVG = await fireExport('export-svg');
const svgText = await bText(0);
const svgSize = await onDisk('sales-chart.svg');
check('图表 SVG：名字 sales-chart.svg，状态行提示开始下载',
  expSVG.name === 'sales-chart.svg' && expSVG.chartStatus === '已开始下载：sales-chart.svg',
  expSVG.name + ' / ' + expSVG.chartStatus);
check('图表 SVG：带 XML 声明 / xmlns / 宽高 / 内联样式表（脱离页面也能看）',
  svgText.indexOf('<?xml') === 0 && svgText.indexOf('http://www.w3.org/2000/svg') > 0 &&
  svgText.indexOf('<style') > 0 && /width="\d+"/.test(svgText) && /height="\d+"/.test(svgText),
  svgText.slice(0, 120));
check('图表 SVG：12 根柱都在（class="pd-bar"）',
  (svgText.match(/pd-bar/g) || []).length >= 12, String((svgText.match(/pd-bar/g) || []).length));
check('图表 SVG 真的落盘（> 2KB）', svgSize > 2000, String(svgSize));

const expPNG = await fireExport('export-png', 2000);
const pngSize = await onDisk('sales-chart.png');
check('图表 PNG：名字 sales-chart.png，blob 类型是 image/png 且体积像真图（> 1KB）',
  expPNG.name === 'sales-chart.png' && expPNG.lastType === 'image/png' && expPNG.lastSize > 1000,
  expPNG.name + ' / ' + expPNG.lastType + ' / ' + expPNG.lastSize);
check('图表 PNG：状态行提示开始下载（没有走到导出失败分支）',
  expPNG.chartStatus === '已开始下载：sales-chart.png', String(expPNG.chartStatus));
check('图表 PNG 真的落盘（> 1KB）', pngSize > 1000, String(pngSize));

const expPy = await fireExport('code-download');
const pyText = await bText(0);
const pySize = await onDisk('sales-pandas.py');
const codeBoxText = await ev(`h.t('code-text')`);
check('代码 .py：名字 sales-pandas.py，状态行「已下载」',
  expPy.name === 'sales-pandas.py' && expPy.codeStatus === '已下载 sales-pandas.py',
  expPy.name + ' / ' + expPy.codeStatus);
check('.py 内容与代码框逐字一致（同一份 codeCache）',
  pyText === codeBoxText && pyText.indexOf('import pandas as pd') > 0 && pyText.indexOf('plt') > 0,
  pyText.slice(0, 60).replace(/\n/g, '|'));
check('代码 .py 真的落盘（> 500B，内容完整不是空壳）', pySize > 500, String(pySize));

const dlFiles = readdirSync(DL_DIR).filter((f) => !/\.crdownload$/.test(f)).sort();
check('下载目录里正好 8 份文件，名字与预期一一对应',
  dlFiles.join('|') === ['sales-chart-bar.csv', 'sales-chart.svg', 'sales-chart.png', 'sales-pandas.py',
    'sales-result.csv', 'sales-result.json', 'sales-result.html', 'sales-result.sql'].sort().join('|'),
  JSON.stringify(readdirSync(DL_DIR)));
check('整段导出过程没有页面报错', (await ev('(window.__errs || []).length')) === 0,
  JSON.stringify(await jv(`JSON.stringify((window.__errs || []).slice(0, 3))`)));

console.log('\n[9] 双语：zh → en → zh（文案 / 代码注释 / 状态行都要跟着换）');
async function takeSnap() {
  return jv(`JSON.stringify((function () {
    function texts(sel) { return [].map.call(document.querySelectorAll(sel), function (n) { return n.textContent.trim(); }); }
    var code = h.t('code-text') || '';
    return {
      lang: h.langAttr(), title: document.title,
      langBtns: [].map.call(document.querySelectorAll('.lang-switch-item'), function (b) {
        return b.getAttribute('data-lang') + ':' + b.getAttribute('aria-pressed');
      }),
      nav: texts('#site-nav .nav-link'), heroTitle: h.textOf('.hero-title'), heroStatus: h.t('workbench-status'),
      dsNames: texts('#ds-list .ds-name'), srcName: h.textOf('#src-list .src-name'),
      dataStatus: h.t('data-status'), previewChip: h.t('preview-chip'), previewNote: h.t('preview-note'),
      profileHead: h.table('profile-table').head, profileRows: h.table('profile-table').n,
      dataTableHead: h.table('data-table').head,
      opLabels: h.labels('op-select'), opDesc: h.t('op-desc'),
      chartTypes: h.typeButtons().map(function (b) { return b.text; }),
      chartDesc: h.t('chart-desc'), chartNote: h.t('chart-note'),
      shapes: texts('#shape-box .shape-line'), resultShape: h.t('result-shape'),
      exportLabels: ['export-csv', 'export-json', 'export-png', 'export-svg', 'export-chart-csv',
        'code-download', 'steps-reset', 'op-add'].map(function (id) { return h.t(id); }),
      statsHead: h.table('stats-table').head,
      codeHead: code.split(String.fromCharCode(10)).slice(0, 3), codeLen: code.length,
      errs: (window.__errs || []).length
    };
  })())`);
}
/* 先让语言流程空跑一次：把 ⑧ 导出留下的状态行刷回常规文案，zh→en→zh 才能逐字对比 */
await ev(`document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: 'zh' } }))`);
await sleep(400);
const zh1 = await takeSnap();
await ev(`h.lang('en')`);
await sleep(700);
const en = await takeSnap();
await ev(`h.lang('zh')`);
await sleep(700);
const zh2 = await takeSnap();
const CJK = /[\u4e00-\u9fff]/;
const DS_EN = ['Sales Orders', 'Student Scores', 'Country Indicators', 'City Climate', 'Stock Daily', 'Employees'];

check('语言开关真的换语言（html lang + aria-pressed + 文档标题）',
  zh1.lang === 'zh-CN' && en.lang === 'en' && zh2.lang === 'zh-CN' &&
  zh1.langBtns.join(' ') === 'zh:true en:false' && en.langBtns.join(' ') === 'zh:false en:true' &&
  CJK.test(zh1.title) && en.title === 'Visual Pandas Workbench | Data Visualization Assignment 03',
  zh1.lang + '→' + en.lang + '→' + zh2.lang + ' / ' + en.title);
check('导航 / 主标题 / 图表类型 / 导出按钮全套换成英文',
  en.nav.join('|') === ['Data', 'Transform', 'Charts', 'Code'].join('|') &&
  en.heroTitle === 'Make pandas visible' &&
  en.chartTypes.join('|') === ['Bar', 'Horizontal bar', 'Line', 'Area', 'Scatter', 'Histogram', 'KDE',
    'Box', 'Pie', 'Heatmap'].join('|') &&
  en.exportLabels[0] === 'Export CSV' && en.exportLabels[5] === 'Download .py' &&
  en.exportLabels[6] === 'Clear all steps' && en.exportLabels[7] === 'Add step',
  en.nav.join('|') + ' / ' + en.chartTypes.join('|'));
check('52 个算子名字换成英文（抽查首尾 + 无中文残留）',
  en.opLabels.length === 52 && en.opLabels[0] === 'Filter rows' &&
  en.opLabels[en.opLabels.length - 1] === 'Combine first' &&
  !en.opLabels.some((s) => CJK.test(s)), en.opLabels.slice(0, 3).join('|') + ' … ' + en.opLabels[51]);
check('数据集名称 / 数据源名 / 状态行随语言切换（src-name 不再是中文残留）',
  en.dsNames.join('|') === DS_EN.join('|') && en.srcName === 'Sales Orders' &&
  en.dataStatus === 'Loaded "Sales Orders": 320 rows x 11 columns',
  en.dsNames.join('|') + ' / ' + en.srcName + ' / ' + en.dataStatus);
check('表格表头与注释行跟着换（列概览 / 形状轨迹 / 预览注释）',
  en.profileHead.join('|') === ['Column', 'dtype', 'Missing', 'Unique', 'Min', 'Max', 'Mean'].join('|') &&
  en.dataTableHead.join('|') === zh1.dataTableHead.join('|') &&
  en.shapes.join(' | ') === ['Source data: 320 rows x 11 columns', 'Current result: 320 rows x 11 columns'].join(' | ') &&
  en.resultShape === 'Current result: 320 rows x 11 columns' &&
  en.previewNote === 'Showing the first 12 of 320 rows; exports always use every row.',
  en.profileHead.join('|') + ' / ' + en.resultShape);
check('英文界面里没有中文残留（算子说明 / 图表说明 / 图注 / 状态）',
  ![en.opDesc, en.chartDesc, en.chartNote, en.heroStatus].some((s) => CJK.test(s || '')) &&
  !en.dsNames.some((s) => CJK.test(s)),
  [en.opDesc, en.chartDesc, en.chartNote].join(' | ').slice(0, 160));
check('代码注释换英文、pandas API 与列名保持英文',
  en.codeHead[0] === '# Read the data' && en.codeHead[1] === 'import pandas as pd' &&
  (await ev(`h.t('code-text')`)).indexOf('df = pd.read_csv("sales.csv")') >= 0 && zh1.codeHead[0] === '# 读取数据',
  en.codeHead.join(' / '));
const zh2diffs = Object.keys(zh1).filter((k) => JSON.stringify(zh1[k]) !== JSON.stringify(zh2[k]));
check('切回中文后逐字还原（zh → en → zh 无残留、无错位）', zh2diffs.length === 0,
  '差异键：' + zh2diffs.join(', ') + ' / ' + zh2diffs.map((k) => k + '=' + JSON.stringify(zh2[k])).join(' ; '));
check('切语言不产生页面报错', zh2.errs === 0, String(zh2.errs));

console.log('\n[10] 主题 / 阅读进度 / 窄屏抽屉 / Esc / 横向溢出');
/* 主题：点一下 → data-theme 翻转、aria-pressed 与 aria-label 同步、写进 localStorage */
const theme0 = await ev('h.theme()');
await ev(`h.clickSel('.theme-toggle')`);
await sleep(250);
const theme1 = await jv(`JSON.stringify({
  theme: h.theme(),
  pressed: h.q('.theme-toggle').getAttribute('aria-pressed'),
  label: h.q('.theme-toggle').getAttribute('aria-label'),
  stored: localStorage.getItem('theme-preference')
})`);
check('主题按钮：data-theme 翻转 + aria-pressed 同步 + 记住偏好',
  (theme0 === 'light' || theme0 === 'dark') && theme1.theme !== theme0 &&
  theme1.pressed === (theme1.theme === 'dark' ? 'true' : 'false') &&
  (theme1.label === '切换到亮色模式' || theme1.label === '切换到暗色模式') &&
  theme1.stored === theme1.theme,
  JSON.stringify([theme0, theme1]));
await ev(`h.clickSel('.theme-toggle')`);
await sleep(250);
const theme2 = await ev('h.theme()');
check('再点一次回到原主题（可逆、不残留）', theme2 === theme0, theme0 + ' → ' + theme2);

/* 阅读进度条：滚到底 scaleX ≈ 1；点「回到顶部」归零 */
const sc0 = await jv(`JSON.stringify((function () {
  var max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, document.documentElement.scrollHeight);
  return { max: max, scrollable: max > 200 };
})())`);
await sleep(600);
const atBottom = await jv(`JSON.stringify({ y: window.pageYOffset, tf: document.getElementById('readbar').style.transform })`);
const pxBottom = Number((atBottom.tf.match(/scaleX\(([\d.]+)\)/) || [0, '0'])[1]);
check('长页面：滚到底时阅读进度条 scaleX 接近 1', sc0.scrollable && pxBottom > 0.9 && pxBottom <= 1,
  JSON.stringify([sc0, atBottom]));
await ev(`h.click('to-top')`);
let topY = -1, smoothOK = false;
for (let i = 0; i < 12; i++) { await sleep(200); topY = await ev('window.pageYOffset'); if (topY === 0) { smoothOK = true; break; } }
if (!smoothOK) { await ev('window.scrollTo(0, 0)'); await sleep(500); topY = await ev('window.pageYOffset'); }
check('「回到顶部」把滚动位置归零（无头环境平滑滚动可能退化，故允许兜底）', topY === 0,
  'smooth=' + smoothOK + ' y=' + topY);
await sleep(400);
const pxTop = Number(((await ev(`document.getElementById('readbar').style.transform`)).match(/scaleX\(([\d.]+)\)/) || [0, '0'])[1]);
check('回顶后阅读进度条归零', pxTop === 0, String(pxTop));

/* 抽屉导航只在窄屏出现（宽屏下 .nav-toggle 是 display:none，focus() 会静默失败、焦点留在 body），
   所以先把视口压到 480px：开 → Esc 收起并还焦点 → 再开 → 点导航项自动收起 */
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(400);
await ev(`h.click('nav-toggle')`);
await sleep(250);
const dr1 = await jv(`JSON.stringify({
  open: h.q('#site-nav').classList.contains('is-open'),
  expanded: h.q('#nav-toggle').getAttribute('aria-expanded')
})`);
check('点汉堡按钮展开导航（is-open 与 aria-expanded 同步）', dr1.open === true && dr1.expanded === 'true', JSON.stringify(dr1));
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await sleep(250);
const dr2 = await jv(`JSON.stringify({
  open: h.q('#site-nav').classList.contains('is-open'),
  expanded: h.q('#nav-toggle').getAttribute('aria-expanded'),
  focused: document.activeElement && document.activeElement.id,
  toggleDisplay: getComputedStyle(h.q('#nav-toggle')).display
})`);
check('Esc 收起导航并把焦点还给汉堡按钮', dr2.open === false && dr2.expanded === 'false' && dr2.focused === 'nav-toggle',
  JSON.stringify(dr2));
await ev(`h.click('nav-toggle')`);
await sleep(200);
await ev(`h.clickSel('#site-nav .nav-link')`);
await sleep(300);
const dr3 = await jv(`JSON.stringify({
  open: h.q('#site-nav').classList.contains('is-open'),
  expanded: h.q('#nav-toggle').getAttribute('aria-expanded')
})`);
check('点导航项后抽屉自动收起', dr3.open === false && dr3.expanded === 'false', JSON.stringify(dr3));
await cdp.send('Emulation.clearDeviceMetricsOverride');
await sleep(400);

/* 三种宽度都没有横向溢出；窄屏下汉堡按钮可见 */
const widths = [1440, 1024, 480];
const overflow = [];
for (const w of widths) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  const o = await jv(`JSON.stringify({
    w: window.innerWidth, over: h.hOverflow(),
    burger: (function (b) {
      var cs = getComputedStyle(b);
      return { display: cs.display, w: Math.round(b.getBoundingClientRect().width) };
    })(h.q('#nav-toggle'))
  })`);
  overflow.push(o);
}
await cdp.send('Emulation.clearDeviceMetricsOverride');
await sleep(400);
check('1440 / 1024 / 480 三种宽度都没有横向溢出（scrollWidth ≤ innerWidth + 1）',
  overflow.every((o) => o.over <= 1), JSON.stringify(overflow));
check('窄屏（480px）下汉堡按钮仍然可见可点',
  overflow[2].burger.display !== 'none' && overflow[2].burger.w > 0, JSON.stringify(overflow[2].burger));

console.log('\n[11] 增强功能：一键预设 / 撤销重做 / 分页 / 剪贴板 / 分享链接');

/* 先把状态弄成确定的：加一步（保证历史里有东西）→ 清空（栈顶一定是「0 步」那一份） */
await ev(`h.click('op-add')`);
await sleep(300);
await ev(`h.click('steps-reset')`);
await sleep(300);

const enh0 = await jv(`JSON.stringify({
  opts: h.vals('preset-select'),
  labels: h.labels('preset-select'),
  steps: h.cnt('#steps .step'),
  undoDisabled: !!h.byId('undo-btn').disabled,
  redoDisabled: !!h.byId('redo-btn').disabled
})`);
check('预设下拉 6 项、每项都有文案；清空步骤后撤销可用、重做灰掉',
  enh0.opts.length === 6 && enh0.labels.every((s) => s && s.length > 1) &&
  enh0.steps === 0 && enh0.undoDisabled === false && enh0.redoDisabled === true,
  JSON.stringify(enh0));

await ev(`h.setSel('preset-select', 'corr')`);
await ev(`h.click('preset-apply')`);
await sleep(500);
const enh1 = await jv(`JSON.stringify({
  steps: h.cnt('#steps .step'), shape: h.t('result-shape'), rows: h.table('result-table').n,
  heat: h.marks().heat, status: h.t('pipe-status'),
  types: h.typeButtons().filter(function (b) { return b.pressed === 'true'; }).map(function (b) { return b.type; }).join(),
  code: (h.t('code-text') || '').indexOf('df.corr(numeric_only=True)') >= 0,
  undoDisabled: !!h.byId('undo-btn').disabled
})`);
check('套「相关矩阵」预设：1 步 / 6 行 × 6 列 / 36 格热力 / 代码同步 / 状态行报出预设名',
  enh1.steps === 1 && enh1.shape === '当前结果：6 行 × 6 列' && enh1.rows === 6 && enh1.heat === 36 &&
  enh1.types === 'heatmap' && enh1.code === true && /相关矩阵/.test(enh1.status || '') &&
  enh1.undoDisabled === false, JSON.stringify(enh1));

await ev(`h.click('undo-btn')`);
await sleep(400);
const enh2 = await jv(`JSON.stringify({
  steps: h.cnt('#steps .step'), shape: h.t('result-shape'), status: h.t('pipe-status'),
  redoDisabled: !!h.byId('redo-btn').disabled
})`);
check('撤销：回到空流水线的 320 行原表，状态行说明「已撤销」，重做按钮亮起',
  enh2.steps === 0 && enh2.shape === '当前结果：320 行 × 11 列' &&
  /已撤销/.test(enh2.status || '') && enh2.redoDisabled === false, JSON.stringify(enh2));

await ev(`h.click('redo-btn')`);
await sleep(400);
const enh3 = await jv(`JSON.stringify({
  steps: h.cnt('#steps .step'), shape: h.t('result-shape'), status: h.t('pipe-status'),
  undoDisabled: !!h.byId('undo-btn').disabled
})`);
check('重做：预设那一步装回来（6 行 × 6 列），状态行说明「已重做」',
  enh3.steps === 1 && enh3.shape === '当前结果：6 行 × 6 列' &&
  /已重做/.test(enh3.status || '') && enh3.undoDisabled === false, JSON.stringify(enh3));

/* 分页：回到 320 行的原表 —— 12 行/页 → 27 页 */
await ev(`h.click('undo-btn')`);
await sleep(400);
const enh4 = await jv(`JSON.stringify({
  hidden: h.hidden('result-pager'), rows: h.table('result-table').n,
  first: h.table('result-table').rows[0][0],
  info: (h.t('result-pager') || '').replace(/\\s+/g, ' '),
  prevDisabled: !!h.byId('result-prev').disabled,
  sizes: h.vals('result-page-size')
})`);
check('320 行结果露出分页条：12 行/页、第 1/27 页、行区间 1–12、上一页禁用、4 档页长可选',
  enh4.hidden === false && enh4.rows === 12 && enh4.first === '1' &&
  /第 1 \/ 27 页/.test(enh4.info) && /第 1–12 行/.test(enh4.info) &&
  enh4.prevDisabled === true && enh4.sizes.join(',') === '12,25,50,100', JSON.stringify(enh4));

await ev(`h.click('result-next')`);
await sleep(300);
const enh5 = await jv(`JSON.stringify({
  rows: h.table('result-table').n, first: h.table('result-table').rows[0][0],
  info: (h.t('result-pager') || '').replace(/\\s+/g, ' ')
})`);
check('下一页：行号从 13 开始（不是从 1 重排），页码与行区间同步',
  enh5.rows === 12 && enh5.first === '13' &&
  /第 2 \/ 27 页/.test(enh5.info) && /第 13–24 行/.test(enh5.info), JSON.stringify(enh5));

await ev(`h.setSel('result-page-size', '100')`);
await sleep(300);
const enh6 = await jv(`JSON.stringify({
  rows: h.table('result-table').n, info: (h.t('result-pager') || '').replace(/\\s+/g, ' '),
  prevDisabled: !!h.byId('result-prev').disabled
})`);
check('切到 100 行/页：自动回第 1 页、表里 100 行、页数变 4',
  enh6.rows === 100 && /第 1 \/ 4 页/.test(enh6.info) && /第 1–100 行/.test(enh6.info) &&
  enh6.prevDisabled === true, JSON.stringify(enh6));

/* 剪贴板：两枚按钮都要给出结论（成功或失败都算，静默才算错） */
const COPY_FB = /已复制|复制失败|Copied|Copy failed/;
await ev(`h.click('copy-csv')`);
await sleep(900);
const copyCsv = await ev(`h.t('data-status')`);
await ev(`h.click('copy-md')`);
await sleep(900);
const copyMd = await ev(`h.t('data-status')`);
check('复制结果 CSV / Markdown 表格都给出明确反馈（不静默、不报错）',
  COPY_FB.test(copyCsv || '') && COPY_FB.test(copyMd || ''),
  JSON.stringify([copyCsv, copyMd]));

/* 分享链接：套一个两步预设 → 生成链接（地址栏出现 #pd=）→ 真刷新页面 → 载入时应自己还原 */
await ev(`h.setSel('preset-select', 'topN')`);
await ev(`h.click('preset-apply')`);
await sleep(400);
const before = await jv(`JSON.stringify({
  steps: h.cnt('#steps .step'), shape: h.t('result-shape'),
  ops: [].map.call(document.querySelectorAll('#steps .step-op'), function (n) { return n.textContent.trim(); }),
  errs: (window.__errs || []).length
})`);
check('分享前：套用「排行榜」预设得到 2 步 / 10 行 × 11 列，且页面无报错',
  before.steps === 2 && /^当前结果：10 行 × 11 列/.test(before.shape) && before.errs === 0,
  JSON.stringify(before));

await ev(`h.click('share-btn')`);
await sleep(500);
const share = await jv(`JSON.stringify({
  head: location.hash.slice(0, 3), len: location.hash.length, status: h.t('pipe-status')
})`);
check('分享链接写进地址栏（#pd= 且带内容），状态行给出复制结果（成功或在地址栏里）',
  share.head === '#pd' && share.len > 60 && /分享链接|地址栏/.test(share.status || ''), JSON.stringify(share));

/* 真刷新一次：新文档里 window.h 会消失，所以刷新后要重新注入探针再断言 */
await cdp.send('Page.reload', {});
await sleep(2500);
await injectProbe();
const after = await jv(`JSON.stringify({
  steps: h.cnt('#steps .step'), shape: h.t('result-shape'),
  ops: [].map.call(document.querySelectorAll('#steps .step-op'), function (n) { return n.textContent.trim(); }),
  status: h.t('data-status'), sourceName: h.textOf('#src-list .src-name'),
  tab: h.typeButtons().filter(function (b) { return b.pressed === 'true'; }).map(function (b) { return b.type; }).join(),
  errs: (window.__errs || []).length
})`);
check('打开分享链接（真刷新）能还原：步骤数 / 算子名 / 结果形状 / 图表类型 / 数据源全部对上',
  after.steps === before.steps && after.shape === before.shape && after.ops.join('|') === before.ops.join('|') &&
  after.tab === 'bar' && /还原/.test(after.status || '') && /销售流水/.test(after.sourceName || '') &&
  after.errs === 0, JSON.stringify([before, after]));

console.log('\n[11b] 数据体检：内存口径 + 显示设置即时生效');
const health = await jv(`JSON.stringify((function () {
  function rows(sel) {
    return [].map.call(document.querySelectorAll(sel + ' tbody tr'), function (tr) {
      return [].map.call(tr.children, function (td) { return td.textContent.trim(); });
    });
  }
  return {
    head: h.table('health-table').head, rows: rows('#health-table'), n: h.table('health-table').n,
    note: h.t('health-note'), option: h.t('health-option'),
    errs: (window.__errs || []).length
  };
})())`);
check('数据体检表：11 列 × 6 栏（列名 / dtype / 缺失 / 唯一值 / 内存 / 转 category 后）',
  health.n === 11 && health.head.join('|') === ['列名', '类型', '缺失', '唯一值', '内存', '转 category 后'].join('|'),
  health.n + ' / ' + JSON.stringify(health.head));
const ratingHealth = health.rows.find((r) => r[0] === 'rating');
const regionHealth = health.rows.find((r) => r[0] === 'region');
check('数据体检：rating 缺失 20、内存是 B/KB/MB 文本；region 转 category 后更省',
  !!ratingHealth && ratingHealth[2] === '20' && /(B|KB|MB)$/.test(ratingHealth[4]) && !!regionHealth &&
  parseFloat(regionHealth[5]) < parseFloat(regionHealth[4]),
  JSON.stringify([ratingHealth, regionHealth]));
check('数据体检注脚：合计内存 + 可省量，并给出 pd.set_option 代码',
  /合计/.test(health.note || '') && /可省约/.test(health.note || '') &&
  /pd\.set_option\("display\.max_rows"/.test(health.option || ''), health.note + ' / ' + health.option);
await ev(`h.setSel('health-maxrows', '30')`);
await sleep(200);
const shown = await jv(`JSON.stringify({ rows: h.table('data-table').n, note: h.t('preview-note'), status: h.t('data-status') })`);
check('显示设置（display.max_rows 改到 30）立刻反映到预览表与注释',
  shown.rows === 30 && /30/.test(shown.note || '') && /显示设置/.test(shown.status || ''), JSON.stringify(shown));
await ev(`h.setSel('health-maxrows', '12')`);
await sleep(150);
check('体检渲染期间没有页面报错', health.errs === 0, String(health.errs));

console.log('\n[12] 收尾');
check('全程零 console 报错 / 未捕获异常 / 未处理的 Promise',
  (await ev('(window.__errs || []).length')) === 0,
  JSON.stringify(await jv('JSON.stringify((window.__errs || []).slice(0, 3))')));
check('导出留下的 8 个文件仍在磁盘上（临时目录没被提前清掉）',
  readdirSync(DL_DIR).filter((f) => statSync(join(DL_DIR, f)).size > 0).length === 8,
  JSON.stringify(readdirSync(DL_DIR)));

console.log('\n================ SUMMARY ================');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项，共 ' + (pass + fail) + ' 项');
if (fail) {
  console.log('  未通过：');
  fails.forEach((f) => console.log('   ✗ ' + f));
}
console.log('  页面：' + URL_PAGE);
console.log('  浏览器：' + CHROME);
console.log('  结果：' + (fail ? 'FAIL' : 'PASS'));
console.log('=========================================');
cleanup(fail ? 1 : 0);

