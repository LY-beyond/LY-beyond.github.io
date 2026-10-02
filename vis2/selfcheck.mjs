/* =========================================================
 * selfcheck.mjs —— 一条命令跑完所有自检，并汇总「这一站有多大 / 验了多少项」
 * ---------------------------------------------------------
 * 跑法：node selfcheck.mjs            只跑静态检查（毫秒级，不联网、不开浏览器）
 *       node selfcheck.mjs --full     连真机检查一起跑（需要本机有 Chrome，约 1–2 分钟）
 *       node selfcheck.mjs -v         把每个脚本的完整输出都打出来
 *
 * 静态（默认）：
 *   check.mjs        结构一致性（词表键 / 挂载点 / 选择器 / 双语字段 / 脚本顺序 / 新图型）
 *   link-check.mjs   站内跳转与资源引用
 *   parity-check.mjs 中英双语对齐（键 / 占位符 / 数字 / 双语文案 / 裸中文）
 *   a11y-check.mjs   对比度（WCAG 2.1，含 color-mix 计算）+ ARIA + 文档结构
 *   budget-check.mjs 体积预算 / 请求数 / 零联网承诺 / README 数字不许过期
 *   data/build.mjs --check   data.js 是否与 data/*.csv 一致（数据链路不许手改）
 * 真机（--full）：
 *   audit.mjs        11 档视口下的布局体检（溢出 / 裁切 / 触控目标 / 锚点补偿）
 *   smoke.mjs        146 条真机断言（工具栏 / 联动 / 播放器 / 导出 / 分享链接 / 双语文案 / 地图…）
 *
 * 每个脚本末尾都会打印 `SUMMARY script=… checks=N failed=M`，本脚本负责汇总，
 * 并顺带核对 README / FEATURES / HIGHLIGHTS 三份文档里写的「脚本数 / 静态断言 / 真机断言 /
 * 每个脚本各多少条断言 / 对比度组数」—— 这些数字只有本脚本算得出来，也只能由它来对。
 * （体积、词条、章节、数据集这类数字由 budget-check.mjs 核对，两边不重复。）
 * ========================================================= */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ARGS = process.argv.slice(2);
const FULL = ARGS.includes('--full');
const VERBOSE = ARGS.includes('-v') || ARGS.includes('--verbose');

const STATIC = [
  ['check.mjs', '结构一致性'],
  ['link-check.mjs', '跳转与资源引用'],
  ['parity-check.mjs', '中英双语对齐'],
  ['a11y-check.mjs', '对比度与 ARIA'],
  ['budget-check.mjs', '体积预算与零联网'],
  ['data/build.mjs', '数据链路（CSV → data.js）', '--check']
];
const BROWSER = [
  ['audit.mjs', '布局体检（11 档视口）'],
  ['smoke.mjs', '真机冒烟（交互 / 导出 / 双语）']
];

let totalChecks = 0, totalFails = 0;
const rows = [];

function run([script, what, extra]) {
  if (!existsSync(join(HERE, script))) {
    console.log(`\n──────── ${script} ── ${what}`);
    console.log(`✗ 脚本不存在（README 里承诺了它，就该跟着提交）`);
    totalFails++;
    rows.push({ script, what, checks: 0, failed: 1 });
    return;
  }
  const t0 = Date.now();
  const res = spawnSync(process.execPath, [script].concat(extra ? [extra] : []), { cwd: HERE, encoding: 'utf8' });
  const out = (res.stdout || '') + (res.stderr || '');
  const m = out.match(/SUMMARY script=\S+ checks=(\d+) failed=(\d+)/);
  const checks = m ? Number(m[1]) : 0;
  const failed = m ? Number(m[2]) : 1;
  totalChecks += checks;
  totalFails += failed;
  rows.push({ script, what, checks, failed, ms: Date.now() - t0, out });
  console.log(`\n──────── ${script} ── ${what}  ${failed ? '✗' : '✓'}  ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  if (failed || VERBOSE || !m) {
    console.log(out.trim());
  } else {
    console.log(out.trim().split('\n').filter((l) => /^[✓⚠]/.test(l) || /SUMMARY/.test(l)).join('\n'));
  }
}

console.log('===== 静态自检（零依赖 · 不联网 · 不开浏览器） =====');
for (const s of STATIC) run(s);

if (FULL) {
  console.log('\n===== 真机自检（真实 Chrome + CDP） =====');
  for (const s of BROWSER) run(s);
} else {
  console.log('\n（真机检查需要 Chrome 与 1–2 分钟，用 `node selfcheck.mjs --full` 一并跑；');
  console.log('  CI 里静态检查每次提交都跑，真机检查走 nightly —— 见 .github/workflows/selfcheck.yml）');
}

/* ---------------- 汇总 + 核对 README 的数字 ---------------- */
console.log('\n================ 汇总 ================');
const w1 = Math.max(...rows.map((r) => r.script.length));
rows.forEach((r) => console.log(`  ${r.failed ? '✗' : '✓'} ${r.script.padEnd(w1)}  ${String(r.checks).padStart(4)} 项  ${r.failed ? r.failed + ' 项失败' : '全部通过'}`));

const staticTotal = rows.filter((r) => STATIC.some((s) => s[0] === r.script)).reduce((s, r) => s + r.checks, 0);
const browserTotal = rows.filter((r) => BROWSER.some((s) => s[0] === r.script)).reduce((s, r) => s + r.checks, 0);
console.log(`  静态断言合计 ${staticTotal} 项${FULL ? ` / 真机断言合计 ${browserTotal} 项` : ''}`);

const readme = readFileSync(join(HERE, 'README.md'), 'utf8');
function claim(label) {
  /* 与 budget-check 同一套规则：只在行首第一格是标签时取值，避免命中正文里的同名表头 */
  const cell = readme.match(new RegExp('^\\|\\s*' + label + '\\s*\\|\\s*(\\d+)', 'm'));
  return cell ? Number(cell[1]) : NaN;
}
const wantStatic = claim('静态断言');
if (wantStatic === staticTotal) {
  console.log(`  ✓ README 复杂度清单「静态断言 = ${staticTotal}」与实测一致`);
} else {
  console.log(`  ✗ README 复杂度清单「静态断言」写的是 ${isNaN(wantStatic) ? '（没找到这一行）' : wantStatic}，实测 ${staticTotal}`);
  totalFails++;
}
if (FULL) {
  const wantBrowser = claim('真机断言');
  if (wantBrowser === browserTotal) {
    console.log(`  ✓ README 复杂度清单「真机断言 = ${browserTotal}」与实测一致`);
  } else {
    console.log(`  ✗ README 复杂度清单「真机断言」写的是 ${isNaN(wantBrowser) ? '（没找到这一行）' : wantBrowser}，实测 ${browserTotal}`);
    totalFails++;
  }
} else {
  console.log('  · README「真机断言」需 `--full` 才能核对（当前跳过）');
}

/* ---------------- 同一批数字在 FEATURES / HIGHLIGHTS 里也各写了一遍 ---------------- */
const feats = readFileSync(join(HERE, 'FEATURES.md'), 'utf8');
const high = readFileSync(join(HERE, 'HIGHLIGHTS.md'), 'utf8');
const scriptN = STATIC.length + BROWSER.length;
const measure = (file) => (rows.find((r) => r.script === file) || { checks: NaN }).checks;
const a11yOut = (rows.find((r) => r.script === 'a11y-check.mjs') || {}).out || '';
const contrast = Number((a11yOut.match(/对比度 (\d+) 组/) || [])[1]);
let docFails = 0, docN = 0;
function docClaim(label, text, re, want) {
  const m = text.match(re);
  const got = m ? m.slice(1).map(Number) : [];
  const pass = !!m && got.length === want.length && got.every((v, i) => v === want[i]);
  docN++;
  console.log(`  ${pass ? '✓' : '✗'} ${label}${pass ? '' : `：文档写 ${m ? got.join(' / ') : '（没匹配到）'}，实测 ${want.join(' / ')}`}`);
  if (!pass) { totalFails++; docFails++; }
}
console.log('\nFEATURES / HIGHLIGHTS 的数字核对：');
docClaim('FEATURES 亮点八：静态脚本数 + 断言数', feats,
  /静态自检 (\d+) 个[^|]*\|\s*\*\*(\d+) 条断言\*\*/, [STATIC.length, staticTotal]);
docClaim('HIGHLIGHTS 亮点⑥：「# N 个静态检查」', high, /# (\d+) 个静态检查/, [STATIC.length]);
docClaim('HIGHLIGHTS 亮点⑥：「# 再跑 N 个真机检查」', high, /# 再跑 (\d+) 个真机检查/, [BROWSER.length]);
docClaim('HIGHLIGHTS 亮点④：parity 断言数', high,
  /`parity-check\.mjs` 把「翻译不同步」变成可自动判定的规则（(\d+) 条断言）/, [measure('parity-check.mjs')]);
/* 每个脚本各多少条断言：写在 HIGHLIGHTS 亮点⑥ 的表格里（多一行「类型 | 断言数」） */
for (const [file] of STATIC.concat(BROWSER)) {
  const isBrowser = BROWSER.some((b) => b[0] === file);
  if (isBrowser && !FULL) continue;
  const docName = file === 'data/build.mjs' ? 'data/build.mjs --check' : file;
  const re = new RegExp('^\\|\\s*`' + docName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`\\s*\\|\\s*(?:静态|真机)\\s*\\|\\s*(\\d+)', 'm');
  docClaim(`HIGHLIGHTS 脚本表 ${docName}`, high, re, [measure(file)]);
}
/* 对比度组数：a11y-check 打印的实测值，三份文档里提到一次就核一次
   （「亮暗两档各 N 组」是按单档写的，要除以 2） */
if (!contrast) { console.log('  ✗ 没能从 a11y-check.mjs 的输出里读到对比度组数'); totalFails++; }
else for (const [doc, text] of [['README.md', readme], ['FEATURES.md', feats], ['HIGHLIGHTS.md', high]]) {
  text.split('\n').forEach((line, i) => {
    if (!/对比度|比值/.test(line)) return;
    const each = line.match(/各 (\d+) 组/);
    if (each) docClaim(`${doc}:${i + 1} 对比度组数（单档）`, line, /各 (\d+) 组/, [contrast / 2]);
    else if (/\d+ 组/.test(line)) docClaim(`${doc}:${i + 1} 对比度组数`, line, /(\d+) 组/, [contrast]);
  });
}
if (FULL) {
  docClaim('FEATURES 数字一览：静态 + 真机断言', feats,
    /^\|\s*\d+(?:\s*\|\s*\d+){5}\s*\|\s*(\d+) \+ (\d+)\s*\|/m, [staticTotal, browserTotal]);
  docClaim('FEATURES 亮点八：真机脚本数 + 断言数 + 拆分', feats,
    /真机自检 (\d+) 个[^|]*\|\s*\*\*(\d+) 条断言\*\*（(\d+) 条交互 \+ (\d+) 档视口）/,
    [BROWSER.length, browserTotal, measure('smoke.mjs'), measure('audit.mjs')]);
  docClaim('HIGHLIGHTS 摘要：脚本数 + 静态/真机断言', high,
    /\*\*(\d+) 个自检脚本（静态 (\d+) \+ 真机 (\d+) 条断言）\*\*/, [scriptN, staticTotal, browserTotal]);
  docClaim('HIGHLIGHTS 速览「自检」行', high,
    /\*\*(\d+) 个脚本\*\*（(\d+) 静态 \+ (\d+) 真机）\/ \*\*静态 (\d+) 条断言\*\* \/ \*\*真机 (\d+) 条断言\*\*（(\d+) 条交互 \+ (\d+) 档视口）/,
    [scriptN, STATIC.length, BROWSER.length, staticTotal, browserTotal, measure('smoke.mjs'), measure('audit.mjs')]);
  docClaim('HIGHLIGHTS 亮点⑥：真机合计 = smoke + audit（每档一条）', high,
    /真机断言合计 \*\*(\d+) 条\*\* = `smoke\.mjs` (\d+) \+ `audit\.mjs` (\d+)/,
    [browserTotal, measure('smoke.mjs'), measure('audit.mjs')]);
  docClaim('HIGHLIGHTS 速查：--full 真机断言', high,
    /# 再加真机自检（(\d+) 条：(\d+) 交互 \+ (\d+) 档视口）/,
    [browserTotal, measure('smoke.mjs'), measure('audit.mjs')]);
} else {
  console.log('  · 与真机断言相关的 8 处数字需 `--full` 才能核对（当前跳过；CI 的 nightly 任务会跑 --full）');
}
console.log(docFails ? `  ✗ 文档数字有 ${docFails} 处过期` : `  ✓ ${docN} 处文档数字与实测一致`);

console.log(totalFails
  ? `\n✗ 有 ${totalFails} 项失败 —— 见上面各脚本的输出`
  : `\n✓ 全部通过：脚本 ${rows.length} 个 / 断言 ${totalChecks} 项`);
console.log(`\n===== SUMMARY script=selfcheck.mjs checks=${totalChecks} failed=${totalFails} =====`);
process.exit(totalFails ? 1 : 0);
