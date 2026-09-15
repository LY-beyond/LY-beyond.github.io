// =========================================================
// graph-verify.mjs —— 课程知识图谱的真机验证（需要本地服务器 + Chrome）
// ---------------------------------------------------------
// 用法：
//   1) 先起一个静态服务器：python -m http.server 8099
//   2) node graph-verify.mjs
//
// 可用环境变量覆盖：
//   SITE_URL   站点地址，默认 http://127.0.0.1:8099/
//   CHROME     浏览器可执行文件路径（不填会自动探测）
//   CDP_PORT   DevTools 调试端口，默认 9346
//
// 它验的是「静态检查查不到、但一眼就能看出来」的东西：
//   · d3-force 是否真的加载了（力导向布局依赖它）
//   · 布局是否**确定**：两次独立加载的节点坐标是否完全一致（刷新不跳）
//   · 几何是否健康：节点最小间隙（防重叠）、包围盒是否落在画布内
//   · 交互：单击节点不应有跳转/选中面板；全图 / 列表视图 / 回到总览正常
//   · 拖拽：真实鼠标事件拖动节点，拖动时跟随，松手后停在放下的位置（不回弹）
//
// ⚠️ 踩过的坑：站点设了 scroll-behavior: smooth，滚动是动画的，
//    拖拽测试前必须把它改成 auto，否则量到的是滚动前的坐标（事件会落空）。
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
const PORT = Number(process.env.CDP_PORT || 9346);
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
  console.error(`    SITE_URL=http://127.0.0.1:8080/ node ${basename(process.argv[1] || 'graph-verify.mjs')}`);
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), 'graph-verify-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1440,900',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

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

async function EV(cdp, fn, ...args) {
  const r = await cdp.send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`,
    returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || '').split('\n')[0] };
  return r.result.value;
}

async function open(page) {
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
  await sleep(700);
  return { cdp, t };
}

const snapshot = () => Array.prototype.map.call(
  document.querySelectorAll('#kg-svg [data-kg-node]'),
  (g) => {
    const c = g.querySelector('circle');
    return g.getAttribute('data-kg-node') + ':' + Math.round(+c.getAttribute('cx')) + ',' + Math.round(+c.getAttribute('cy'));
  }
).join(' ');

const geometry = () => {
  const nodes = Array.prototype.map.call(document.querySelectorAll('#kg-svg [data-kg-node]'), (g) => {
    const c = g.querySelector('circle');
    return { id: g.getAttribute('data-kg-node'), x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') };
  });
  let minGap = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) - nodes[i].r - nodes[j].r;
      if (d < minGap) minGap = d;
    }
  }
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  return {
    节点数: nodes.length,
    最小间隙: Math.round(minGap),
    包围盒: `${Math.round(Math.min(...xs))},${Math.round(Math.min(...ys))} → ${Math.round(Math.max(...xs))},${Math.round(Math.max(...ys))}`,
  };
};

for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${DEV}/json/version`)).ok) break; } catch {}
  await sleep(250);
}

const problems = [];

for (const page of ['index.html', 'en/index.html']) {
  console.log(`\n########## ${page} ##########`);

  /* ① 两次独立加载：位置是否完全一致（确定性） */
  const a = await open(page);
  const snapA = await EV(a.cdp, snapshot);
  const geoA = await EV(a.cdp, geometry);
  const errsA = a.cdp.evts.filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => (e.params.exceptionDetails.exception?.description || '').split('\n')[0]);
  const logsA = a.cdp.evts.filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error').length;
  const d3ok = await EV(a.cdp, () => typeof window.d3 === 'object' && typeof window.d3.forceSimulation === 'function');

  const b = await open(page);
  const snapB = await EV(b.cdp, snapshot);

  console.log('  d3 已加载：', d3ok);
  console.log('  几何：', JSON.stringify(geoA));
  console.log('  两次加载位置一致（确定性）：', snapA === snapB);
  console.log('  JS 异常：', errsA.length ? errsA.slice(0, 3) : '无', ' | 资源错误：', logsA || '无');
  if (!d3ok) problems.push(`${page}: d3-force 未加载`);
  if (snapA !== snapB) problems.push(`${page}: 两次加载位置不一致（布局不再确定）`);
  if (errsA.length) problems.push(`${page}: JS 异常 ${errsA.length} 条`);
  if (logsA) problems.push(`${page}: 资源错误 ${logsA} 条`);
  if (geoA.最小间隙 < 0) problems.push(`${page}: 节点重叠（最小间隙 ${geoA.最小间隙}）`);
  if (geoA.节点数 !== 12) problems.push(`${page}: 总览视图应有 12 个节点，实测 ${geoA.节点数}`);

  /* ② 交互：单击节点什么都不发生（无跳转、无详情面板）；全图 / 列表 / 回总览正常 */
  const inter = await EV(a.cdp, async () => {
    const sleep2 = (ms) => new Promise((z) => setTimeout(z, ms));
    const out = {};
    const crumbBefore = document.querySelector('.kg-crumb--cur').textContent;

    document.querySelector('[data-kg-node="c1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('[data-kg-node="c1"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await sleep2(300);
    out.单击无跳转 = document.querySelectorAll('#kg-svg [data-kg-node]').length === 12 &&
      document.querySelector('.kg-crumb--cur').textContent === crumbBefore;
    out.无详情面板 = !document.querySelector('.kg-detail');
    out.节点无按钮语义 = !document.querySelector('#kg-svg [data-kg-node][role]') &&
      !document.querySelector('#kg-svg [data-kg-node][tabindex]');

    document.querySelector('[data-kg="full"]').click();
    await sleep2(600);
    out.全图节点 = document.querySelectorAll('#kg-svg [data-kg-node]').length;

    document.querySelector('[data-kg="mode"]').click();
    await sleep2(250);
    out.列表条目 = document.querySelectorAll('.kg-list-item').length;
    out.列表含静态项 = !!document.querySelector('.kg-list-item--static');
    document.querySelector('[data-kg="mode"]').click();
    await sleep2(200);

    document.querySelector('[data-kg="root"]').click();
    await sleep2(400);
    out.回总览节点 = document.querySelectorAll('#kg-svg [data-kg-node]').length;
    return out;
  });
  console.log('  交互：', JSON.stringify(inter));

  /* ③ 拖拽一个节点：用 CDP 真实鼠标事件（落在节点屏幕坐标上，与真人操作一致） */
  /*    注意：站点有 scroll-behavior: smooth，必须先改成 auto，否则滚动是动画、坐标测不准 */
  await EV(a.cdp, () => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.getElementById('kg-svg').scrollIntoView({ block: 'start' });
  });
  await sleep(400);
  const box = await EV(a.cdp, () => {
    const c = document.querySelector('[data-kg-node="c1"] circle');
    const svg = document.getElementById('kg-svg');
    const r = svg.getBoundingClientRect();
    return {
      x: r.left + (+c.getAttribute('cx') / 960) * r.width,
      y: r.top + (+c.getAttribute('cy') / 560) * r.height,
      拖动前: [Math.round(+c.getAttribute('cx')), Math.round(+c.getAttribute('cy'))],
    };
  });
  const send = (type, x, y) => a.cdp.send('Input.dispatchMouseEvent', {
    type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1,
  });
  await send('mousePressed', box.x, box.y);
  await send('mouseMoved', box.x + 70, box.y + 40);
  await sleep(60);
  await send('mouseMoved', box.x + 140, box.y + 80);
  await sleep(60);
  const mid = await EV(a.cdp, () => {
    const c = document.querySelector('[data-kg-node="c1"] circle');
    return [Math.round(+c.getAttribute('cx')), Math.round(+c.getAttribute('cy'))];
  });
  await send('mouseReleased', box.x + 140, box.y + 80);
  await sleep(300);
  const after = await EV(a.cdp, () => {
    const c = document.querySelector('[data-kg-node="c1"] circle');
    return [Math.round(+c.getAttribute('cx')), Math.round(+c.getAttribute('cy'))];
  });
  /* 自由拖动的关键断言：松手后节点必须停在拖动结束的位置（不再被力导向拉回去） */
  const stayed = String(mid) === String(after);
  console.log('  拖拽（真实鼠标事件）：', JSON.stringify({
    拖动前: box.拖动前, 拖动中: mid, 松手后: after,
    拖动时跟随了: String(box.拖动前) !== String(mid),
    松手后停住了: stayed,
  }));
  if (String(box.拖动前) === String(mid)) problems.push(`${page}: 拖拽没有跟随（事件是否落在节点上？）`);
  if (!stayed) problems.push(`${page}: 松手后节点回弹了（应停在放下的位置，实测 mid=${mid} after=${after}）`);

  const errsAfter = a.cdp.evts.filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => (e.params.exceptionDetails.exception?.description || '').split('\n')[0]);
  console.log('  交互后 JS 异常：', errsAfter.length ? errsAfter.slice(0, 3) : '无');
  if (errsAfter.length) problems.push(`${page}: 交互过程中出现 JS 异常`);

  /* ④ 点「适应窗口」应从快照复位，几何重新健康（防重叠） */
  await EV(a.cdp, () => document.querySelector('[data-kg="fit"]').click());
  await sleep(300);
  const geoAfter = await EV(a.cdp, geometry);
  console.log('  适应窗口复位后几何：', JSON.stringify(geoAfter));
  if (geoAfter.最小间隙 < 0) problems.push(`${page}: 复位后节点重叠（最小间隙 ${geoAfter.最小间隙}）`);
  if (geoAfter.节点数 !== 12) problems.push(`${page}: 复位后总览应仍为 12 个节点，实测 ${geoAfter.节点数}`);

  /* ⑤ 交互断言 */
  if (!inter.单击无跳转) problems.push(`${page}: 单击/双击节点不应改变视图`);
  if (!inter.无详情面板) problems.push(`${page}: 详情面板应该已移除`);
  if (!inter.节点无按钮语义) problems.push(`${page}: 节点不应再带 role/tabindex`);
  if (inter.全图节点 !== 51) problems.push(`${page}: 全图应为 51 个节点，实测 ${inter.全图节点}`);
  if (inter.列表条目 !== 51) problems.push(`${page}: 列表视图应为 51 条，实测 ${inter.列表条目}`);
  if (!inter.列表含静态项) problems.push(`${page}: 列表中无页面的节点应为静态项`);
  if (inter.回总览节点 !== 12) problems.push(`${page}: 回到总览应为 12 个节点，实测 ${inter.回总览节点}`);

  a.cdp.close(); b.cdp.close();
  await fetch(`${DEV}/json/close/${a.t.id}`).catch(() => {});
  await fetch(`${DEV}/json/close/${b.t.id}`).catch(() => {});
}

/* ---------------- 汇总 ---------------- */
console.log('\n================ 汇总 ================');
if (problems.length) {
  console.log(`✗ 发现 ${problems.length} 个问题：`);
  problems.forEach((p) => console.log('  · ' + p));
} else {
  console.log('✓ 图谱全部通过：d3-force 已加载 · 布局确定 · 无节点重叠 · 交互与拖拽正常');
}
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(problems.length ? 1 : 0);
