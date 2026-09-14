// =========================================================
// practice-answers.mjs —— 导出「实战环节」各环节的参考答案
// ---------------------------------------------------------
// 用法：node practice-answers.mjs
// 作用：把 practice-data.js 里 8 个环节的参考答案（编辑器里该有的
//       完整 HTML + CSS）导出成 practice-answers.md，方便逐块复制粘贴
//       到工作台里手工测试（不点「查看参考答案」也能验检查点）。
//
// 说明：本文件是 practice-answers.md 的唯一来源 —— 改了 practice-data.js
//       之后重新跑一次即可，避免手写的答案文档和代码脱节。
//       生成结果是开发/测试辅助文档，不被网站加载。
// =========================================================
import { readFileSync, writeFileSync } from 'node:fs';

const sandbox = {};
new Function('window', readFileSync(new URL('./practice-data.js', import.meta.url), 'utf8'))(sandbox);
const C = sandbox.PRACTICE_CASE;

if (!C || !Array.isArray(C.steps)) {
  console.log('✗ practice-data.js 里没有找到 window.PRACTICE_CASE');
  process.exit(1);
}

/* 与 practice.js 的 solutionOf() 保持同一套规则：
   solution.html 留空 = 沿用上一环节的 HTML（只重构 CSS 的环节） */
function solutionOf(i) {
  const step = C.steps[i];
  const html = step.solution.html || (i > 0 ? solutionOf(i - 1).html : (C.startCode ? C.startCode.html : ''));
  return { html, css: step.solution.css };
}

function starterOf(i) {
  if (i === 0) {
    return {
      html: (C.startCode && C.startCode.html) || '',
      css: (C.startCode && C.startCode.css) || '',
    };
  }
  return solutionOf(i - 1);
}

const countChecks = (checks) => checks.reduce((n, c) => n + (c.type === 'atWidth' ? c.checks.length : 1), 0);

const lines = [];
const w = (s = '') => lines.push(s);

w('# 实战环节 · 各环节参考答案');
w();
w('> 本文件由 `node practice-answers.mjs` 从 `practice-data.js` 自动生成，**不要手改**。');
w('> 改了案例数据后重新跑一次即可。');
w();
w('## 怎么用');
w();
w('1. 打开 `practice.html`，切到对应环节。');
w('2. 把下面「HTML」框里的内容整段粘进左边的 HTML 编辑器，');
w('   「CSS」框里的内容整段粘进右边的 CSS 编辑器（**每关的 CSS 都是完整累积版**，直接整体替换即可）。');
w('3. 点「✅ 检查这一环节」，应当**全项通过**。');
w('4. 也可以偷懒：直接点两次「查看参考答案」（第一次进入确认态，第二次才填入）。');
w();
w('> 想验「检查点真的会判错」：随便删掉一段（比如 CSS 里的 display: flex），再点检查，');
w('> 对应的那一项就会变红。');
w();
w('---');
w();
w('## 总览');
w();
w('| 环节 | 标题 | 对应知识点 | 检查点数 |');
w('|---|---|---|---|');
C.steps.forEach((s, i) => {
  w(`| ${i + 1} | ${s.title.replace(/^环节\s*\d+\s*·\s*/, '')} | ${s.learn.join('、')} | ${countChecks(s.checks)} |`);
});
w();
w(`> 共 ${C.steps.length} 个环节、${C.steps.reduce((n, s) => n + countChecks(s.checks), 0)} 个检查点。`);
w('> 最终成品 = 第 8 个环节的代码（也可以在页面上点「⬇️ 导出 .html」直接拿到成品文件）。');
w();
w('---');
w();

C.steps.forEach((s, i) => {
  const sol = solutionOf(i);
  const start = starterOf(i);
  const isRefactor = !s.solution.html;

  w(`## 环节 ${i + 1} · ${s.title.replace(/^环节\s*\d+\s*·\s*/, '')}`);
  w();
  w(`- **副标题**：${s.subtitle}`);
  w(`- **对应知识点**：${s.learn.join('、')}`);
  w(`- **要求**：`);
  s.task.forEach((t) => w(`  - ${t}`));
  w(`- **检查点**：${countChecks(s.checks)} 项 —— ${s.checks.map((c) => c.label).join('；')}`);
  w(`- **起始代码**：${i === 0 ? '案例提供的空骨架（`startCode`）' : `第 ${i} 环节的参考答案`}`);
  w(`- **参考答案来源**：${isRefactor ? '本环节只重构 CSS，HTML 沿用上一环节' : '本环节自己的 solution'}`);
  w();
  w('<details><summary>起始代码（对照用，不用粘）</summary>');
  w();
  w('```html');
  w(start.html.trimEnd());
  w('```');
  w();
  w('```css');
  w(start.css.trimEnd());
  w('```');
  w();
  w('</details>');
  w();
  w('### ✅ 答案 · HTML（粘进左侧编辑器）');
  w();
  w('```html');
  w(sol.html.trimEnd());
  w('```');
  w();
  w('### ✅ 答案 · CSS（粘进右侧编辑器）');
  w();
  w('```css');
  w(sol.css.trimEnd());
  w('```');
  w();
  if (i < C.steps.length - 1) w('---');
  w();
});

const out = lines.join('\n') + '\n';
writeFileSync(new URL('./practice-answers.md', import.meta.url), out, 'utf8');

const totalChecks = C.steps.reduce((n, s) => n + countChecks(s.checks), 0);
console.log(`✓ 已生成 practice-answers.md（${Math.round(out.length / 1024)} KB）`);
console.log(`  案例：${C.title}`);
console.log(`  环节：${C.steps.length} 个 · 检查点合计 ${totalChecks} 项`);
C.steps.forEach((s, i) => {
  const sol = solutionOf(i);
  console.log(`  #${i + 1} ${s.id}  检查点 ${String(countChecks(s.checks)).padStart(2)} 项` +
    `  答案 ${String(sol.html.length).padStart(5)} 字 HTML / ${String(sol.css.length).padStart(5)} 字 CSS`);
});
