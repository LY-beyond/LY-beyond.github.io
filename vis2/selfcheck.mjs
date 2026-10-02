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
 *   smoke.mjs        124 条真机断言（工具栏 / 联动 / 播放器 / 导出 / 双语文案 / 地图…）
 *
 * 每个脚本末尾都会打印 `SUMMARY script=… checks=N failed=M`，本脚本负责汇总，
 * 并顺带核对 README「复杂度清单」里写的「静态断言 / 真机断言」两个数字。
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
  rows.push({ script, what, checks, failed, ms: Date.now() - t0 });
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
  console.log('\n（真机检查需要 Chrome 与 1–2 分钟，用 `node selfcheck.mjs --full` 一并跑）');
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

console.log(totalFails
  ? `\n✗ 有 ${totalFails} 项失败 —— 见上面各脚本的输出`
  : `\n✓ 全部通过：脚本 ${rows.length} 个 / 断言 ${totalChecks} 项`);
console.log(`\n===== SUMMARY script=selfcheck.mjs checks=${totalChecks} failed=${totalFails} =====`);
process.exit(totalFails ? 1 : 0);
