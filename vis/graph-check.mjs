// =========================================================
// graph-check.mjs —— 校验课程知识图谱数据是否自洽
// ---------------------------------------------------------
// 用法：node graph-check.mjs
//
// 查这些「写图谱时最容易犯、又最难靠肉眼发现」的错：
//   1. 中英两份数据是否 **逐视图、逐节点、逐边** 对应（只换文案，不换结构）
//   2. 节点 id 是否重复；边是否悬空（from/to 不在本视图节点里）
//   3. 每条边的 from/to 是否真的存在；drillTo 是否指向真实视图
//   4. 每个节点的 route 是否真的能落地（文件存在 + 锚点存在）
//   5. en/graph-ui.js 的键是否与 graph.js 的 T 表**完全一致**
//      （少一个键，页面上就会直接露出 [key] 这样的原文）
//
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const problems = [];
const fail = (msg) => problems.push(msg);

/* 在沙箱里执行「普通 script」，取出它挂到 window 上的数据 */
function loadScript(rel) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) { fail(`找不到文件：${rel}`); return null; }
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  try {
    vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename: rel });
  } catch (e) {
    fail(`${rel} 执行出错：${e.message}`);
    return null;
  }
  return sandbox.window;
}

const zhWin = loadScript('graph-data.js');
const enWin = loadScript('en/graph-data.js');
if (problems.length) { report(); }

const zh = zhWin.KG_DATA;
const en = enWin.KG_DATA;

/* ---------- 1. 结构指纹：视图 / 节点 / 边 ---------- */
const fingerprint = (d) => {
  const views = {};
  Object.keys(d.views).sort().forEach((id) => {
    const v = d.views[id];
    views[id] = {
      节点: v.nodes.map((n) => n.id).sort().join(','),
      边: v.links.map((l) => `${l.from}>${l.to}>${l.rel}`).sort().join(','),
      可展开: v.nodes.filter((n) => n.drillTo).map((n) => `${n.id}->${n.drillTo}`).sort().join(','),
      可跳转: v.nodes.filter((n) => n.route).map((n) => `${n.id}=>${n.route}`).sort().join(','),
    };
  });
  return views;
};

const fz = fingerprint(zh);
const fe = fingerprint(en);
const ids = [...new Set([...Object.keys(fz), ...Object.keys(fe)])].sort();

console.log(`视图数：中文 ${Object.keys(fz).length} 个 / 英文 ${Object.keys(fe).length} 个`);
for (const id of ids) {
  if (!fz[id]) { fail(`视图 ${id} 只在英文版里有`); continue; }
  if (!fe[id]) { fail(`视图 ${id} 只在中文版里有`); continue; }
  for (const k of ['节点', '边', '可展开', '可跳转']) {
    if (fz[id][k] !== fe[id][k]) {
      fail(`视图 ${id} 的「${k}」中英不一致：\n      中 ${fz[id][k].slice(0, 120)}\n      英 ${fe[id][k].slice(0, 120)}`);
    }
  }
}

/* ---------- 2. 分类 / 关系定义 ---------- */
if (zh.categories.map((c) => c.id).join() !== en.categories.map((c) => c.id).join()) {
  fail('中英 categories 的 id 序列不一致');
}
if (zh.relations.map((r) => r.id).join() !== en.relations.map((r) => r.id).join()) {
  fail('中英 relations 的 id 序列不一致');
}
if (zh.defaultView !== en.defaultView) fail('中英 defaultView 不一致');
if (!zh.views[zh.defaultView]) fail(`defaultView「${zh.defaultView}」不是一个真实视图`);

const catIds = new Set(zh.categories.map((c) => c.id));
const relIds = new Set(zh.relations.map((r) => r.id));
const viewIds = new Set(Object.keys(zh.views));

/* ---------- 3. 逐视图做静态检查（中英各一遍） ---------- */
function checkData(label, d) {
  Object.keys(d.views).forEach((vid) => {
    const v = d.views[vid];
    const nodeIds = new Set();
    v.nodes.forEach((n) => {
      if (nodeIds.has(n.id)) fail(`[${label}] 视图 ${vid} 节点 id 重复：${n.id}`);
      nodeIds.add(n.id);
      if (!catIds.has(n.cat)) fail(`[${label}] 节点 ${n.id} 的分类「${n.cat}」未定义`);
      if (!n.name) fail(`[${label}] 节点 ${n.id} 缺少 name`);
      if (n.drillTo && !viewIds.has(n.drillTo)) fail(`[${label}] 节点 ${n.id} 的 drillTo「${n.drillTo}」不是真实视图`);
    });

    const seen = new Set();
    v.links.forEach((l) => {
      if (!nodeIds.has(l.from)) fail(`[${label}] 视图 ${vid} 的边 ${l.from}→${l.to} 悬空（from 不在本视图）`);
      if (!nodeIds.has(l.to)) fail(`[${label}] 视图 ${vid} 的边 ${l.from}→${l.to} 悬空（to 不在本视图）`);
      if (!relIds.has(l.rel)) fail(`[${label}] 视图 ${vid} 的关系「${l.rel}」未定义`);
      const key = `${l.from}|${l.to}|${l.rel}`;
      if (seen.has(key)) fail(`[${label}] 视图 ${vid} 存在重复边：${key}`);
      seen.add(key);
    });

    if (!v.title) fail(`[${label}] 视图 ${vid} 缺少 title`);
  });
}
checkData('zh', zh);
checkData('en', en);

/* ---------- 4. route 能不能真的落地（文件 + 锚点） ---------- */
const anchorCache = new Map();
function hasAnchor(file, frag) {
  let abs = resolve(ROOT, file);
  /* 指向目录的 route（如 lesson-01/）自动落到该目录的 index.html */
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = join(abs, 'index.html');
  if (!existsSync(abs)) return `文件不存在：${file}`;
  if (!frag) return '';
  if (!anchorCache.has(abs)) anchorCache.set(abs, readFileSync(abs, 'utf8'));
  const html = anchorCache.get(abs);
  return new RegExp(`id="${frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html) ? '' : `锚点不存在：${file}#${frag}`;
}

let routeCount = 0;
[['zh', zh], ['en', en]].forEach(([label, d]) => {
  Object.keys(d.views).forEach((vid) => {
    d.views[vid].nodes.forEach((n) => {
      if (!n.route) return;
      routeCount++;
      const [file, frag] = n.route.split('#');
      const err = hasAnchor(file, frag);
      if (err) fail(`[${label}] 节点 ${n.id} 的 route「${n.route}」无效 → ${err}`);
    });
  });
});

/* ---------- 5. 英文界面文案表 vs 引擎里的 T 表 ---------- */
const T_KEYS = (() => {
  const src = readFileSync(resolve(ROOT, 'graph.js'), 'utf8');
  const start = src.indexOf('var T = {');
  const end = src.indexOf('\n  };', start);
  if (start < 0 || end < 0) { fail('graph.js 里找不到 T 表'); return null; }
  return [...src.slice(start, end).matchAll(/^\s{4}([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]);
})();

const uiWin = loadScript('en/graph-ui.js');
if (T_KEYS && uiWin && uiWin.KG_UI) {
  const uiKeys = Object.keys(uiWin.KG_UI);
  const missing = T_KEYS.filter((k) => !uiKeys.includes(k));
  const extra = uiKeys.filter((k) => !T_KEYS.includes(k));
  if (missing.length) fail(`en/graph-ui.js 缺少键：${missing.join(', ')}（这些位置会露出原文）`);
  if (extra.length) fail(`en/graph-ui.js 有多余键：${extra.join(', ')}（T 表里没有）`);
  console.log(`文案表：引擎 ${T_KEYS.length} 键 / 英文覆盖 ${uiKeys.length} 键`);
}

/* ---------- 汇总 ---------- */
function report() {
  if (problems.length) {
    console.log(`\n✗ 发现 ${problems.length} 个问题：`);
    problems.forEach((p) => console.log('  · ' + p));
  } else {
    console.log('✓ 图谱校验通过：中英结构一致、无悬空边、route 均可落地、文案表逐键对齐');
  }
  console.log(`\n===== 汇总：${problems.length === 0 ? '全部通过' : problems.length + ' 个问题'} =====`);
  process.exit(problems.length ? 1 : 0);
}

const totalNodes = Object.values(zh.views).reduce((s, v) => s + v.nodes.length, 0);
const totalLinks = Object.values(zh.views).reduce((s, v) => s + v.links.length, 0);
console.log(`中文数据：${Object.keys(zh.views).length} 个视图共 ${totalNodes} 个节点 / ${totalLinks} 条边，其中 ${routeCount / 2} 个节点带 route`);
report();
