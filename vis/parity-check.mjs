// =========================================================
// parity-check.mjs —— 校验中英文两版「内容一致」
// ---------------------------------------------------------
// 用法：node parity-check.mjs
// 作用：逐页比对中英两版的「结构指纹」（章节数 / 小节 id / 三个 tab 面板数 /
//       demo 挂载点与 id / 代码块数 / 理论卡片数 / 关键点数 / 表格数 / 翻页链接数 /
//       侧栏条目数 / 门户卡片与标签数），任何一项不对等即报错退出。
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync, existsSync } from 'node:fs';

const count = (s, re) => (s.match(re) || []).length;
// 自动补 g 标志，避免调用方漏写导致 matchAll 抛错
const grab = (s, re) => [...s.matchAll(re.global ? re : new RegExp(re.source, re.flags + 'g'))].map((m) => m[1]);

/* 通用结构指纹（门户页与章节页共用，用不到的项会都是 0） */
function fingerprint(html) {
  return {
    'html lang': grab(html, /<html lang="([^"]+)"/)[0] || '(缺失)',
    '顶栏 tabs 条目': count(html, /<li><a href="[^"]*">/g),
    '门户导航项': count(html, /<a href="#[a-z]+">/g),
    '列表项 li 总数': count(html, /<li>/g),
    '章节 article 数': count(html, /<article class="chapter/g),
    '章节 id': grab(html, /<article class="chapter[^"]*" id="([^"]+)"/).join(' '),
    '侧栏条目': count(html, /data-chapter="/g),
    '侧栏指向': grab(html, /data-chapter="([^"]+)"/).join(' '),
    'tab 按钮数': count(html, /class="tab-btn/g),
    '讲解面板': count(html, /data-panel="explain"/g),
    '代码面板': count(html, /data-panel="code"/g),
    '演示面板': count(html, /data-panel="demo"/g),
    'demo 挂载点': count(html, /class="demo-mount"/g),
    'demo id': grab(html, /data-demo="([^"]+)"/g).join(' '),
    '代码块': count(html, /class="code-block"/g),
    '理论卡片': count(html, /class="theory-card"/g),
    '关键点': count(html, /class="key-point"/g),
    '理论表格': count(html, /class="theory-table"/g),
    '表格行': count(html, /<tr>/g),
    '翻页链接': count(html, /class="pager-(?:prev|next|portal)/g),
    '演示提示条': count(html, /class="demo-hint"/g),
    '门户卡片': count(html, /class="card card--/g),
    '页面 section': count(html, /<section /g),
    'howto 卡': count(html, /class="howto-card"/g),
    'about 条': count(html, /class="about-item"/g),
    '语言切换器': count(html, /data-lang-link=/g),
  };
}

/* 这些项本来就「应该不同」，不参与一致性判定 */
const EXPECTED_DIFF = new Set(['html lang']);

const pairs = [
  ['index.html', 'en/index.html'],
  ...Array.from({ length: 9 }, (_, i) => [
    `lesson-0${i + 1}/index.html`,
    `en/lesson-0${i + 1}/index.html`,
  ]),
];

let problems = 0;
let done = 0;

for (const [zh, en] of pairs) {
  if (!existsSync(zh)) { console.log(`\n?  ${zh} 不存在，跳过`); continue; }
  if (!existsSync(en)) {
    console.log(`\n✗  ${en} 尚不存在 —— 英文版缺失`);
    problems++;
    continue;
  }
  const a = fingerprint(readFileSync(zh, 'utf8'));
  const b = fingerprint(readFileSync(en, 'utf8'));
  const diffs = Object.keys(a).filter(
    (k) => String(a[k]) !== String(b[k]) && !EXPECTED_DIFF.has(k)
  );

  if (diffs.length === 0) {
    done++;
    console.log(`\n✓  ${zh}  ↔  ${en}   结构完全一致`);
  } else {
    problems++;
    console.log(`\n✗  ${zh}  ↔  ${en}   有 ${diffs.length} 项不一致`);
    for (const k of diffs) console.log(`     ${k}: 中文=${a[k]}   英文=${b[k]}`);
  }
}

console.log(`\n===== 汇总：${done} 对一致，${problems} 对有问题 =====`);
process.exit(problems === 0 ? 0 : 1);
