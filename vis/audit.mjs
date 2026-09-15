// =========================================================
// audit.mjs —— 浏览器真机体检（需要本地服务器 + Chrome）
// ---------------------------------------------------------
// 用法：
//   1) 先起一个静态服务器：python -m http.server 8099
//   2) node audit.mjs
//
// 可用环境变量覆盖：
//   SITE_URL   站点地址，默认 http://127.0.0.1:8099/
//   CHROME     浏览器可执行文件路径（不填会自动探测 Chrome / Edge / Chromium）
//   CDP_PORT   DevTools 调试端口，默认 9345（与站点端口无关，不会冲突）
//
// 与其它自检脚本的分工：parity / link / quiz / practice / graph-check 都是
// **纯静态**检查（不联网、不开浏览器、毫秒级）；本脚本会真的把 22 个页面
// 在 Chrome 里打开，逐页查「只有运行时才暴露的问题」：
//   · JS 异常 / console.error / 资源 404
//   · 1440px 与 375px 两档宽度下是否横向溢出
// 代价是慢（约 1–2 分钟），所以按需运行，不必每次改动都跑。
//
// 说明：仅开发期使用，不被网站加载，不影响静态部署。
// =========================================================
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

/* ---------------- 可配置项（均可用环境变量覆盖） ---------------- */
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8099/').replace(/\/?$/, '/');
const PORT = Number(process.env.CDP_PORT || 9345);
const DEV = `http://127.0.0.1:${PORT}`;

/* 找浏览器：优先环境变量 CHROME，其次常见安装路径（Windows / macOS / Linux） */
function findChrome() {
  const env = process.env.CHROME;
  if (env && existsSync(env)) return env;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const p of candidates) if (existsSync(p)) return p;
  return '';
}
const CHROME = findChrome();
if (!CHROME) {
  console.error('✗ 找不到 Chrome / Chromium / Edge。请用环境变量指定，例如：');
  console.error('    Windows:  set CHROME=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  console.error('    其它系统: export CHROME=/usr/bin/chromium');
  process.exit(2);
}

/* ---------------- 先确认本地服务器在跑 ---------------- */
try {
  const r = await fetch(SITE);
  if (!r.ok) throw new Error('HTTP ' + r.status);
} catch (e) {
  console.error(`✗ 访问不到 ${SITE}`);
  console.error('  本脚本需要一个本地静态服务器（其它自检脚本不需要）。先在仓库目录启动：');
  console.error('    python -m http.server 8099');
  console.error('  如果你的端口不同，用环境变量指定：');
  console.error(`    SITE_URL=http://127.0.0.1:8080/ node ${basename(process.argv[1] || 'audit.mjs')}`);
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), 'audit-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
  '--window-size=1440,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map(); const evts = []; let seq = 0;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === undefined) { evts.push(m); return; }
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
    };
    ws.onerror = () => reject(new Error('ws 失败'));
    ws.onopen = () => resolve({
      evts,
      send: (method, params = {}) => new Promise((res, rej) => {
        const id = ++seq; pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      close: () => ws.close(),
    });
  });
}
async function EV(cdp, fn) {
  const r = await cdp.send('Runtime.evaluate', { expression: `(${fn.toString()})()`, returnByValue: true });
  return r.exceptionDetails ? { __err: 1 } : r.result.value;
}

const PAGES = ['index.html', 'en/index.html',
  ...Array.from({ length: 9 }, (_, i) => `lesson-0${i + 1}/index.html`),
  ...Array.from({ length: 9 }, (_, i) => `en/lesson-0${i + 1}/index.html`),
  'practice.html', 'en/practice.html'];

for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${DEV}/json/version`)).ok) break; } catch {}
  await sleep(250);
}

let bad = 0;
for (const page of PAGES) {
  const t = await (await fetch(`${DEV}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  const cdp = await connect(t.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: SITE + page });
  for (let i = 0; i < 40; i++) {
    if ((await EV(cdp, () => document.readyState)) === 'complete') break;
    await sleep(150);
  }
  await sleep(600);
  const ov = await EV(cdp, () => document.documentElement.scrollWidth - window.innerWidth);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 780, deviceScaleFactor: 2, mobile: true });
  await sleep(350);
  const mob = await EV(cdp, () => document.documentElement.scrollWidth - window.innerWidth);
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  const errs = cdp.evts.filter((e) => e.method === 'Runtime.exceptionThrown').length;
  const logs = cdp.evts.filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error').length;
  const probs = [];
  if (errs) probs.push('JS异常' + errs);
  if (logs) probs.push('资源错误' + logs);
  if (ov > 2) probs.push('1440溢出' + ov);
  if (mob > 2) probs.push('375溢出' + mob);
  if (probs.length) bad++;
  console.log(`${probs.length ? '✗' : '✓'} ${page.padEnd(24)}${probs.join('；')}`);
  cdp.close();
  await fetch(`${DEV}/json/close/${t.id}`).catch(() => {});
}
console.log(bad ? `\n✗ ${bad} 页有问题` : '\n✓ 22 页全部通过');
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(bad ? 1 : 0);
