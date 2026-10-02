/* =========================================================
 * audit.mjs —— 页面「布局体检」（真实 Chrome + CDP，运行期才暴露的问题）
 * ---------------------------------------------------------
 * 跑法：node audit.mjs            （默认打开本地 index.html，file:// 即可）
 *       node audit.mjs --json     额外把完整报告写到 JSON
 *       node audit.mjs --shots    额外把问题区域的截图存到临时目录（取证用）
 *       SITE_URL=http://127.0.0.1:8099/ node audit.mjs   （改测本地服务器）
 *
 * 与其它自检脚本的分工：check / link / parity / a11y / budget 都是**纯静态**检查
 * （不联网、不开浏览器、毫秒级）；本脚本会真的在 Chrome 里把页面打开，
 * 在 11 档视口宽度下逐项量「只有运行时才暴露的问题」：
 *   ① 横向溢出：谁超了视口、是否在滚动容器里
 *   ② 每个章节的文档高度 —— 版面节奏是否均匀
 *   ③ 网格实际列数 vs 子元素数 —— 找出「最后一排只剩 1~2 个」的孤儿行
 *   ④ 图表 SVG 缩放比 —— 窄屏上 12 单位的标签实际还剩几 px
 *   ⑤ 可点元素尺寸 —— 找出 < 44px 的触控目标
 *   ⑥ 首屏高度、向下滚动提示是否落在折线以下
 *   ⑦ 锚点跳转时吸顶栏有没有盖住标题（scroll-padding 缺失会露馅）
 *   ⑧ 顶栏 13 个导航项在窄屏是否被裁切（navClipped）
 * 任何一档出现横向溢出或导航裁切，脚本以非零码退出；末尾给统一的 SUMMARY 行。
 *
 * 浏览器：默认自动探测 Chrome / Edge / Chromium，可用 CHROME 环境变量指定；
 *   CI 里若需要额外参数（容器/无沙箱环境）用 CHROME_FLAGS，例如 CHROME_FLAGS=--no-sandbox。
 * 说明：仅开发期使用，不被网站加载，不影响静态部署。
 * ========================================================= */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* ---------------- 浏览器探测 ---------------- */
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
  console.error('    其它系统: export CHROME=/usr/bin/chromium');
  process.exit(2);
}

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ARGS = process.argv.slice(2);
const WANT_JSON = ARGS.includes('--json');
const WANT_SHOTS = ARGS.includes('--shots');
/* 额外浏览器参数：CI（容器 / 无沙箱环境）常需 CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage" */
const CHROME_FLAGS = (process.env.CHROME_FLAGS || '').split(/\s+/).filter(Boolean);
const SITE = process.env.SITE_URL || pathToFileURL(join(HERE, 'index.html')).href;
const TMP = mkdtempSync(join(tmpdir(), 'vis2-audit-'));
const OUT = WANT_JSON ? join(TMP, 'audit-report.json') : null;
const SHOT_DIR = WANT_SHOTS ? TMP : null;

const PORT = 9334;
/* 11 档视口宽度：覆盖 360 → 1440 的常见断点（budget-check 会核对 README 里写的档数） */
const WIDTHS = [1440, 1280, 1180, 1100, 1024, 900, 820, 768, 600, 414, 360];
const VH = 900;


const profile = TMP;   /* 复用同一个临时目录，退出时一并清掉 */
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', `--window-size=${WIDTHS[0]},${VH}`, ...CHROME_FLAGS,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* 端口还没起来 */ }
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
      msg.error ? reject(new Error(msg.method + ': ' + msg.error.message)) : resolve(msg.result);
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

const evalJson = async (cdp, expr) =>
  JSON.parse((await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value);

/* ---------------- 探针：一次 evaluate 拿回全部布局指标 ---------------- */
const PROBE = `(() => {
  var root = document.documentElement;
  var vw = root.clientWidth, vh = window.innerHeight;
  function sel(n) {
    if (!n || n === document.body) return 'body';
    var s = n.tagName.toLowerCase();
    if (n.id) s += '#' + n.id;
    var c = (typeof n.className === 'string' ? n.className : '').trim().split(/\\s+/).filter(Boolean)[0];
    if (c) s += '.' + c;
    return s;
  }
  function visible(n) {
    var r = n.getBoundingClientRect();
    var cs = getComputedStyle(n);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function scroller(n) {
    for (var p = n.parentElement; p; p = p.parentElement) {
      var ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return sel(p);
    }
    return null;
  }
  var out = { vw: vw, vh: vh, docH: root.scrollHeight, scrollW: root.scrollWidth,
              overflowX: root.scrollWidth - vw };

  /* ① 横向溢出的元素（排除本就在滚动容器里的） */
  var bad = [];
  Array.prototype.forEach.call(document.querySelectorAll('body *'), function (n) {
    if (!visible(n)) return;
    var r = n.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      var viz = n.closest ? n.closest('.viz') : null;
      bad.push({ sel: sel(n), left: Math.round(r.left), right: Math.round(r.right),
                 inScroller: scroller(n),
                 inViz: viz ? sel(viz) : null,
                 text: (n.textContent || '').trim().slice(0, 14) || null });
    }
  });
  out.offenders = bad.slice(0, 12);

  /* ② 章节高度与节奏 */
  out.sections = Array.prototype.map.call(document.querySelectorAll('main > .section, main > .hero'),
    function (s) {
      var r = s.getBoundingClientRect();
      var cs = getComputedStyle(s);
      return { id: s.id || s.className, h: Math.round(r.height),
               padT: cs.paddingTop, padB: cs.paddingBottom };
    });

  /* ③ 网格列数 vs 子元素数（孤儿行） */
  out.grids = {};
  ['.kpi-row', '.pillars', '.force-cards', '.scene-grid', '.ov-grid', '.sim',
   '.sim-readout', '.sim-outputs', '.source-list', '.footer-inner'].forEach(function (s) {
    var el = document.querySelector(s);
    if (!el) return;
    var cols = getComputedStyle(el).gridTemplateColumns.split(' ').length;
    var n = el.children.length;
    out.grids[s] = { n: n, cols: cols, lastRow: n % cols === 0 ? cols : n % cols,
                     colW: Math.round(el.children[0].getBoundingClientRect().width) };
  });

  /* ④ 图表缩放比：viewBox 单位 → 屏幕 px */
  out.charts = {};
  Array.prototype.forEach.call(document.querySelectorAll('.viz'), function (v) {
    var svg = v.querySelector('svg');
    if (!svg) return;
    var vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
    var scale = vb.width ? r.width / vb.width : 0;
    out.charts[sel(v)] = { vbW: vb.width, vbH: vb.height, cssW: Math.round(r.width),
                           cssH: Math.round(r.height), scale: +scale.toFixed(3),
                           label12px: +(12 * scale).toFixed(1) };
  });

  /* ⑤ 触控目标 < 44px */
  var small = [];
  Array.prototype.forEach.call(document.querySelectorAll('a[href],button,input,[role="button"]'), function (n) {
    if (!visible(n)) return;
    var r = n.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      small.push({ sel: sel(n), w: Math.round(r.width), h: Math.round(r.height) });
    }
  });
  var seen = {};
  out.tapSmall = small.filter(function (o) { if (seen[o.sel]) return false; seen[o.sel] = 1; return true; });

  /* ⑥ 首屏：Hero 高度 + 提示行位置 */
  var hero = document.querySelector('.hero');
  var hint = document.querySelector('.hero-hint');
  if (hero) {
    var hr = hero.getBoundingClientRect();
    out.hero = { h: Math.round(hr.height), fill: +(hr.height / vh).toFixed(2),
                 hintBottom: hint ? Math.round(hint.getBoundingClientRect().bottom) : null,
                 hintVisible: hint ? hint.getBoundingClientRect().bottom <= vh : null };
  }

  /* ⑦ 顶栏 */
  var tb = document.querySelector('.topbar');
  var tn = document.querySelector('.topnav');
  out.topbar = { h: Math.round(tb.getBoundingClientRect().height),
                 navClient: tn.clientWidth, navScroll: tn.scrollWidth,
                 navClipped: tn.scrollWidth - tn.clientWidth,
                 kids: Array.prototype.map.call(tb.querySelector('.topbar-inner').children, function (n) {
                   var r = n.getBoundingClientRect();
                   return sel(n) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
                 }) };

  /* ⑧ 正文行宽（em）：中文 1 字/em，英文约 2 字/em */
  function emOf(s) {
    var el = document.querySelector(s);
    if (!el || !visible(el)) return null;
    var r = el.getBoundingClientRect();
    var fs = parseFloat(getComputedStyle(el).fontSize);
    return { w: Math.round(r.width), fs: fs, em: +(r.width / fs).toFixed(1) };
  }
  out.measure = {
    heroMeta: emOf('.hero-meta'), sectionLead: emOf('.section-lead'),
    cardNote: emOf('.card-note'), sourceNote: emOf('.source-note'), lead: emOf('.lead')
  };

  out.pageH = document.body.scrollHeight;
  return JSON.stringify(out);
})()`;

async function probeAt(cdp, width) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: width, height: VH, deviceScaleFactor: 1, mobile: width <= 600
  });
  await sleep(700);
  return evalJson(cdp, PROBE);
}

/* 锚点跳转是否被吸顶栏盖住 */
async function anchorTest(cdp, width) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: width, height: VH, deviceScaleFactor: 1, mobile: width <= 600
  });
  await cdp.send('Page.navigate', { url: SITE });
  await sleep(2200);
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('.nav-link[href="#scale"]').click()`
  });
  await sleep(1500);
  const r = await evalJson(cdp, `(function(){
    var s = document.getElementById('scale').getBoundingClientRect();
    var tb = document.querySelector('.topbar').getBoundingClientRect();
    var t = document.querySelector('#scale .section-title').getBoundingClientRect();
    return JSON.stringify({
      w: ${width},
      scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop,
      topbarH: Math.round(tb.height),
      sectionTop: Math.round(s.top),
      titleTop: Math.round(t.top),
      titleHiddenByBar: Math.round(t.top) < Math.round(tb.height)
    });
  })()`);
  r.kids = (await evalJson(cdp, `JSON.stringify(Array.prototype.map.call(
      document.querySelector('.topbar-inner').children, function (n) {
        var b = n.getBoundingClientRect();
        return (n.className && String(n.className).split(' ')[0] || n.tagName) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height) +
               ' shrink=' + getComputedStyle(n).flexShrink;
      }))`));
  return r;
}

/* 截图取证：给定视口宽度 + 选择器，落一张 PNG */
async function shotTo(cdp, width, sel, file, pad) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: width, height: VH, deviceScaleFactor: 1, mobile: width <= 600
  });
  await sleep(600);
  const box = await evalJson(cdp, `(function(){
    var n = document.querySelector(${JSON.stringify(sel)});
    if (!n) return JSON.stringify(null);
    var r = n.getBoundingClientRect();
    return JSON.stringify({ x: Math.max(0, r.left + scrollX), y: Math.max(0, r.top + scrollY),
                            width: r.width, height: r.height });
  })()`);
  if (!box) { console.log('skip (not found):', sel); return; }
  const p = pad || 0;
  const res = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: Math.max(0, box.x - p), y: Math.max(0, box.y - p),
            width: Math.min(width, box.width + p * 2), height: box.height + p * 2, scale: 1 }
  });
  writeFileSync(file, Buffer.from(res.data, 'base64'));
  console.log('saved', file, `${Math.round(box.width)}x${Math.round(box.height)}`);
}

try {
  const cdp = connect(await targetWs());
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: SITE });
  await sleep(2500);

  const report = { widths: {} };
  let failed = 0;
  for (const w of WIDTHS) {
    report.widths[w] = await probeAt(cdp, w);
    const p = report.widths[w];
    const bad = [];
    if (p.overflowX > 2) bad.push('横向溢出 ' + p.overflowX + 'px');
    if (p.topbar.navClipped > 2) bad.push('导航被裁 ' + p.topbar.navClipped + 'px');
    if (bad.length) failed++;
    console.log(`\n===== ${w}px =====  ${bad.length ? '✗ ' + bad.join('；') : '✓ 无溢出、导航完整'}`);
    console.log(`docH=${p.docH}  overflowX=${p.overflowX}`);
    console.log('sections:', p.sections.map((s) => `${s.id}:${s.h}`).join(' '));
    console.log('grids   :', Object.keys(p.grids)
      .map((k) => `${k} ${p.grids[k].n}/${p.grids[k].cols}c@${p.grids[k].colW}px`).join('  '));
    console.log('offenders:', p.offenders.length ? JSON.stringify(p.offenders) : 'none');
    console.log('hero    :', JSON.stringify(p.hero), 'topbar:', JSON.stringify(p.topbar));
    console.log('barKids :', p.topbar.kids.join(' | '));
    console.log('charts  :', Object.keys(p.charts)
      .map((k) => `${k} ${p.charts[k].cssW}x${p.charts[k].cssH} ${p.charts[k].label12px}px`).join('  '));
    console.log('tapSmall:', p.tapSmall.length ? JSON.stringify(p.tapSmall) : 'none');
    console.log('measure :', JSON.stringify(p.measure));
  }

  report.anchor = {};
  console.log('\n===== 锚点补偿 =====');
  let anchorBad = 0;
  for (const w of [1280, 900, 414]) {
    report.anchor[w] = await anchorTest(cdp, w);
    console.log(report.anchor[w]);
    if (report.anchor[w].titleHiddenByBar) {
      anchorBad++;
      console.log('  ✗ 吸顶栏盖住了标题（检查 scroll-padding-top / scroll-margin-top）');
    }
  }

  if (SHOT_DIR) {
    console.log('\n===== 取证截图（临时目录，不入库） =====');
    const shot = (w, sel, name) => shotTo(cdp, w, sel, join(SHOT_DIR, name));
    await shot(1440, '.topbar .topbar-inner', 'bar-1440.png');
    await shot(1024, '.topbar .topbar-inner', 'bar-1024.png');
    await shot(360, '.topbar .topbar-inner', 'bar-360.png');
    await shot(1280, '#power .force-cards', 'forces-1280.png');
    await shot(414, '#industry .card', 'industry-414.png');
    await shot(414, '#sim .card', 'sim-414.png');
    /* 整页全景（0.4 倍，一眼看整体版面节奏） */
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: VH, deviceScaleFactor: 1, mobile: false
    });
    await sleep(900);
    const doc = await evalJson(cdp, `JSON.stringify({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight })`);
    const full = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: doc.w, height: doc.h, scale: 0.4 }
    });
    writeFileSync(join(SHOT_DIR, 'full-1280.png'), Buffer.from(full.data, 'base64'));
    console.log('saved full-1280.png', doc.w + 'x' + doc.h, 'scale .4');
  }

  cdp.close();
  if (OUT) {
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log('\nreport ->', OUT);
  }

  console.log(`\n${failed || anchorBad ? '✗' : '✓'} ${WIDTHS.length} 档宽度：${failed} 档有溢出/裁切，锚点补偿 ${anchorBad ? anchorBad + ' 档被顶栏盖住' : '全部正常'}`);
  console.log(`\n===== SUMMARY script=audit.mjs checks=${WIDTHS.length} failed=${failed + anchorBad} =====`);
  process.exitCode = (failed + anchorBad) ? 1 : 0;
} finally {
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
}
