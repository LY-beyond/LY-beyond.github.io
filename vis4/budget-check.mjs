// =========================================================
// budget-check.mjs —— 体积预算自检
// ---------------------------------------------------------
//   ① 整站（vis4 目录全部文件）总体积 <= 5 MB
//   ② 每个页面的「首屏加载」<= 400 KB
//      （HTML 本体 + <link rel=stylesheet> 本地 CSS + <script src> 本地 JS，
//        ES Module 的本地 import 会递归计入；外链 URL 跳过）
//   ③ 不允许出现视频文件；位图（png/jpg/gif/webp）单文件 > 150 KB 即失败
//     （PDF 讲义不受位图限制，但计入总体积）
// 任一规则不满足即 exit 1。
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', '.vscode']);
const KB = 1024;
const LIMIT_TOTAL = 5 * KB * KB;
const LIMIT_PAGE  = 400 * KB;
const LIMIT_IMG   = 150 * KB;
const BITMAPS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const VIDEOS  = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi']);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).sort();
let total = 0, fails = 0;
const byExt = {};

for (const f of files) {
  const size = statSync(f).size;
  total += size;
  const ext = extname(f).toLowerCase();
  byExt[ext] = (byExt[ext] || 0) + size;
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (VIDEOS.has(ext)) { fails++; console.log('✗ 发现视频文件（站点承诺零视频）: ' + rel); }
  else if (BITMAPS.has(ext) && size > LIMIT_IMG) {
    fails++; console.log('✗ 位图超过 150 KB: ' + rel + '（' + Math.round(size / KB) + ' KB）');
  }
}

console.log('整站总体积：' + (total / KB / KB).toFixed(2) + ' MB（预算 5 MB）'
  + (total > LIMIT_TOTAL ? '  ✗ 超预算' : '  ✓'));
if (total > LIMIT_TOTAL) fails++;

/* ---------- 逐页首屏 ---------- */
const importRe = (src) => [
  ...[...src.matchAll(/(?:import|export)[^'"()]*from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ...[...src.matchAll(/(?:^|[^\w.)])import\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ...[...src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
];

function firstLoad(htmlPath) {
  const seen = new Set();
  let sum = statSync(htmlPath).size;
  const html = readFileSync(htmlPath, 'utf8');
  const refs = [
    ...[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]),
  ];
  const queue = [];
  for (const r of refs) {
    if (/^(https?:)?\/\//i.test(r) || /^(data|javascript):/i.test(r)) continue;
    queue.push([resolve(dirname(htmlPath), r.split('#')[0].split('?')[0]), r.includes('module')]);
  }
  /* module 脚本与其本地依赖递归计入 */
  while (queue.length) {
    const [abs, isModule] = queue.shift();
    if (seen.has(abs) || !existsSync(abs)) continue;
    seen.add(abs);
    sum += statSync(abs).size;
    if (extname(abs) === '.js' && (isModule || true)) {
      let src;
      try { src = readFileSync(abs, 'utf8'); } catch (e) { continue; }
      for (const spec of importRe(src)) {
        if (!spec.startsWith('.')) continue;
        queue.push([resolve(dirname(abs), spec), true]);
      }
    }
  }
  return { sum, count: seen.size, missing: refs.filter((r) => {
    if (/^(https?:)?\/\//i.test(r)) return false;
    return !existsSync(resolve(dirname(htmlPath), r.split('#')[0].split('?')[0]));
  }) };
}

console.log('\n逐页首屏（HTML + 本地 CSS/JS 及其 import 链）：');
for (const f of files) {
  if (extname(f).toLowerCase() !== '.html') continue;
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  const { sum, count, missing } = firstLoad(f);
  const ok = sum <= LIMIT_PAGE;
  if (!ok) fails++;
  if (missing.length) { fails++; console.log('  ⚠ ' + rel + ' 引用了不存在的本地资源: ' + missing.join(', ')); }
  console.log((ok ? '  ✓ ' : '  ✗ ') + rel.padEnd(42) + (sum / KB).toFixed(0).padStart(5) + ' KB · ' + count + ' 个本地依赖');
}

console.log('\n===== 汇总：' + (fails === 0 ? '全部达标 ✓' : fails + ' 项违规 ✗') + ' =====');
process.exit(fails === 0 ? 0 : 1);
