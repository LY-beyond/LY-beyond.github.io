// =========================================================
// link-check.mjs —— 校验站内链接与锚点是否有效
// ---------------------------------------------------------
// 用法：node link-check.mjs
// 作用：扫描全部 .html，检查每一处 <a href="…">：
//   · 相对路径的目标文件是否存在（含 "../" 与同页 "#frag"）
//   · 带 #片段 的，目标文件里是否真有该 id
//   http(s) / mailto: / tel: / 空链接一律跳过（不联网）。
//
// 为什么需要它：本课程用「交叉引用」把知识点与案例串起来 ——
//   .case-note（指到第 9 章 / 实战环节）、.code-source（指到前面各章）、
//   门户 #storyline（指到第 9 章各步），加 portal 侧栏等，合计近 300 处跳转。
//   改动某一章的小节 id，很容易把别处的链接改断，而这种错误在编辑器里
//   看不出来、在浏览器里要点进去才发现。这个脚本一次全查。
//
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', '.vscode']);

/* 收集全部 html（中文版 / 英文版 / 各章 一并扫） */
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = walk(ROOT).sort();
const cache = new Map();
const read = (f) => {
  if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8'));
  return cache.get(f);
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const broken = [];
let total = 0, external = 0, withFrag = 0;

for (const file of files) {
  const html = read(file);
  const re = /<a\b[^>]*\shref="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].trim();
    if (!href || href === '#') { continue; }
    if (/^([a-z]+:)?\/\//i.test(href) || /^(mailto|tel|data|javascript):/i.test(href)) { external++; continue; }

    total++;
    const [pathPart, frag] = href.split('#');
    let target = pathPart ? resolve(dirname(file), pathPart.split('?')[0]) : file;
    /* 指向目录的链接（如 href="../lesson-02/"）自动落到该目录的 index.html */
    if (pathPart && existsSync(target) && statSync(target).isDirectory()) {
      target = join(target, 'index.html');
    }
    const where = `${relative(ROOT, file).replace(/\\/g, '/')}:${html.slice(0, m.index).split('\n').length}`;

    if (pathPart && !existsSync(target)) {
      broken.push(`${where}  →  文件不存在：${href}`);
      continue;
    }
    if (frag) {
      withFrag++;
      const targetHtml = existsSync(target) ? read(target) : '';
      if (!new RegExp(`id="${esc(frag)}"`).test(targetHtml)) {
        broken.push(`${where}  →  锚点不存在：${href}`);
      }
    }
  }
}

/* 按文件统计，方便定位 */
const perFile = new Map();
for (const [f, html] of cache) {
  perFile.set(
    relative(ROOT, f).replace(/\\/g, '/'),
    (html.match(/<a\b[^>]*\shref="[^"]*"/g) || []).length
  );
}

console.log(`共扫描 ${files.length} 个页面，站内链接 ${total} 处（其中带锚点 ${withFrag} 处，外部链接 ${external} 处）`);
if (broken.length) {
  console.log(`\n✗ 发现 ${broken.length} 处失效链接：`);
  for (const b of broken) console.log('  ' + b);
} else {
  console.log('✓ 全部站内链接有效：目标文件存在、锚点均能命中');
}
console.log(`\n===== 汇总：${broken.length === 0 ? '链接全部有效' : broken.length + ' 处失效'} =====`);
process.exit(broken.length ? 1 : 0);
