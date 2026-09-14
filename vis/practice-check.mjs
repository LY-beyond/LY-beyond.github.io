// =========================================================
// practice-check.mjs —— 校验「实战环节」案例数据是否自洽
// ---------------------------------------------------------
// 用法：node practice-check.mjs
//
// 这几类是编写实战案例时最容易犯、又最难靠肉眼发现的错误：
//   ① id 重复 / 环节缺字段（提示、检查点、参考答案）
//   ② 检查点里的 selector 在参考答案 HTML 里根本不存在（类名拼错）
//      —— 学生照答案写也永远过不了，是教学事故
//   ③ 光标定位锚点在本环节的"起始代码"里找不到
//      —— 打开环节时光标跳不到该改的地方
//   ④ 后面环节的参考答案丢掉了前面环节用到的类名
//      —— 学生做完前几关，后面的检查点反而开始报错
//
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
//      真正的"渲染结果"校验（计算样式 / 尺寸）必须靠浏览器，
//      这里只做「静态可达性」检查，两者互补。
// =========================================================
import { readFileSync } from 'node:fs';

const WANT_STEPS = 8;
const REQUIRED_BLOCKS = ['site-header', 'hero', 'about', 'works', 'stats', 'site-footer'];

const sandbox = {};
new Function('window', readFileSync(new URL('./practice-data.js', import.meta.url), 'utf8'))(sandbox);
const C = sandbox.PRACTICE_CASE;

if (!C || !Array.isArray(C.steps)) {
  console.log('✗ practice-data.js 里没有找到 window.PRACTICE_CASE = { …, steps: [...] }');
  process.exit(1);
}

const problems = [];
const warnings = [];
const ids = new Set();

/* ---------------- 工具 ---------------- */
const classesOf = (html) => new Set((html.match(/class="([^"]+)"/g) || [])
  .flatMap((m) => m.replace(/class="|"/g, '').trim().split(/\s+/)).filter(Boolean));
const idsOf = (html) => new Set((html.match(/id="([^"]+)"/g) || [])
  .map((m) => m.replace(/id="|"/g, '').trim()));
const tagsOf = (html) => new Set((html.match(/<([a-z][a-z0-9]*)[\s>]/gi) || [])
  .map((m) => m.replace(/[<\s>]/g, '').toLowerCase()));

// 判断一个（简单）选择器的各个片段能否在 HTML 里找到：只看类名 / id / 标签是否存在
function selectorReachable(selector, html) {
  const cls = classesOf(html);
  const idSet = idsOf(html);
  const tags = tagsOf(html);
  const parts = selector.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    const bare = part.replace(/\[[^\]]*\]/g, '').replace(/::?[a-z-]+(\([^)]*\))?/g, '');
    if (!bare) continue;
    const tokens = bare.match(/[.#]?[A-Za-z][\w-]*/g) || [];
    for (const tok of tokens) {
      if (tok.startsWith('.')) {
        if (!cls.has(tok.slice(1))) return false;
      } else if (tok.startsWith('#')) {
        if (!idSet.has(tok.slice(1))) return false;
      } else if (!tags.has(tok.toLowerCase())) {
        return false;
      }
    }
  }
  return true;
}

/* ---------------- 检查点递归校验 ---------------- */
function walkChecks(checks, html, stepTitle, path) {
  checks.forEach((c, i) => {
    const at = `${stepTitle} · 检查点 ${path}${i + 1}`;
    if (!c.label) problems.push(`${at}：缺少 label`);
    if (!c.type) problems.push(`${at}：缺少 type`);

    if (c.type === 'atWidth') {
      if (!(c.width > 0)) problems.push(`${at}：atWidth 缺少 width`);
      if (!Array.isArray(c.checks) || !c.checks.length) problems.push(`${at}：atWidth 缺少子检查`);
      else walkChecks(c.checks, html, stepTitle, `${path}${i + 1}.`);
      return;
    }
    if (c.type === 'cssVar') {
      if (!c.name) problems.push(`${at}：cssVar 缺少 name`);
      return;
    }
    if (c.type === 'order') {
      if (!Array.isArray(c.selectors) || c.selectors.length < 2) {
        problems.push(`${at}：order 需要 selectors 数组（至少 2 项）`);
        return;
      }
      c.selectors.forEach((sel, k) => {
        if (!selectorReachable(sel, html)) {
          problems.push(`${at}：order 第 ${k + 1} 个 selector "${sel}" 找不到对应元素`);
        }
      });
      return;
    }
    if (!c.selector) {
      problems.push(`${at}：缺少 selector`);
      return;
    }
    if (!selectorReachable(c.selector, html)) {
      problems.push(`${at}：selector "${c.selector}" 在参考答案 HTML 里找不到对应元素`);
    }
  });
}

/* ---------------- 逐环节检查 ---------------- */
const solutionHtml = [];

C.steps.forEach((s, i) => {
  const title = `环节 ${i + 1}(${s.id})`;

  if (!s.id) problems.push(`${title}：缺少 id`);
  else if (ids.has(s.id)) problems.push(`${title}：id 重复`);
  else ids.add(s.id);

  ['title', 'subtitle'].forEach((k) => { if (!s[k]) problems.push(`${title}：缺少 ${k}`); });
  if (!Array.isArray(s.task) || !s.task.length) problems.push(`${title}：缺少 task 要求`);
  if (!Array.isArray(s.hints) || s.hints.length < 2) problems.push(`${title}：提示少于 2 级`);
  if (!Array.isArray(s.syntax) || !s.syntax.length) problems.push(`${title}：缺少语法速查`);
  if (!Array.isArray(s.checks) || !s.checks.length) problems.push(`${title}：缺少检查点`);
  if (!s.solution || typeof s.solution.css !== 'string' || !s.solution.css.trim()) {
    problems.push(`${title}：参考答案缺少 css`);
  }

  // 本环节的参考答案 HTML：留空 = 沿用上一环节（只重构 CSS 的环节可以省掉重复的 HTML）
  const html = (s.solution && s.solution.html) ? s.solution.html : (solutionHtml[i - 1] || '');
  if (!html) problems.push(`${title}：参考答案 HTML 为空，且没有上一环节可继承`);
  solutionHtml.push(html);

  // 本环节的"起始代码" = 上一环节的参考答案（第 1 个环节用案例的 startCode）
  const starterHtml = i === 0
    ? ((C.startCode && C.startCode.html) || '')
    : (solutionHtml[i - 1] || '');
  const starterCss = i === 0
    ? ((C.startCode && C.startCode.css) || '')
    : C.steps[i - 1].solution.css;

  // ① 检查点的选择器必须能在参考答案里找到
  walkChecks(s.checks || [], html, title, '');

  // ② 光标锚点：找不到不致命（引擎会退化成"定位到末尾"），但会降低体验，这里提示出来
  const focus = s.focus || {};
  if (focus.html && !starterHtml.includes(focus.html)) {
    warnings.push(`${title}：focus.html 锚点 "${focus.html}" 在起始代码里找不到，光标会退到末尾`);
  }
  if (focus.css && !starterCss.includes(focus.css)) {
    warnings.push(`${title}：focus.css 锚点 "${focus.css}" 在起始 CSS 里找不到，光标会退到末尾`);
  }

  // ③ 后面环节不能丢掉前面已经用到的类名
  if (i > 0) {
    const now = classesOf(html);
    const before = classesOf(solutionHtml[i - 1]);
    const lost = [...before].filter((c) => !now.has(c));
    if (lost.length) problems.push(`${title}：参考答案丢掉了前面环节用到的类名：${lost.join(', ')}`);
  }
});

/* ---------------- 整体检查 ---------------- */
if (C.steps.length !== WANT_STEPS) problems.push(`环节数应为 ${WANT_STEPS}，实际 ${C.steps.length}`);
if (!C.baseCss || !C.baseCss.trim()) problems.push('缺少 baseCss（预览自带的基础样式）');
if (!C.startCode || !C.startCode.html || !C.startCode.css) problems.push('缺少 startCode（第 1 个环节的起始代码）');
if (!Array.isArray(C.assets) || !C.assets.length) problems.push('缺少 assets（必要文案数据）');
if (!C.brief || !C.brief.goal) problems.push('缺少 brief.goal（案例目标）');

/* =========================================================
 * D. 中英两份案例逐环节对齐
 * ---------------------------------------------------------
 * 只比对「结构」：id / 检查点（类型 + 选择器 + 数值）/ 光标锚点 / 参考答案 HTML 是否复用。
 * 文案当然不同，属于预期差异。
 * ======================================================= */
const CE = (() => {
  try {
    const s = {};
    new Function('window', readFileSync(new URL('./en/practice-data.js', import.meta.url), 'utf8'))(s);
    return s.PRACTICE_CASE;
  } catch (e) {
    problems.push('[对照] 英文案例加载失败：' + (e && e.message));
    return null;
  }
})();

// 把一个检查点压成一行签名，便于逐项比对
function sig(checks) {
  return checks.map((c) => {
    if (c.type === 'atWidth') return `atWidth:${c.width}[${sig(c.checks)}]`;
    if (c.type === 'cssVar') return `cssVar:${c.name}=${c.expect}`;
    return [c.type, c.selector, c.prop || '', c.expect || '', c.min ?? '', c.max ?? '', c.tolerance ?? ''].join('|');
  }).join(' ／ ');
}

if (!CE) {
  problems.push('[对照] 找不到 en/practice-data.js 的 window.PRACTICE_CASE');
} else {
  if (CE.steps.length !== C.steps.length) {
    problems.push(`[对照] 环节数不一致：zh=${C.steps.length}，en=${CE.steps.length}`);
  } else {
    C.steps.forEach((zhStep, i) => {
      const enStep = CE.steps[i];
      const at = `[对照] 环节 ${i + 1}`;
      if (enStep.id !== zhStep.id) problems.push(`${at} id 不一致：zh=${zhStep.id}，en=${enStep.id}`);
      if (sig(enStep.checks || []) !== sig(zhStep.checks || [])) {
        problems.push(`${at}（${zhStep.id}）的检查点结构不一致 —— 中英必须一一对应`);
      }
      const zf = zhStep.focus || {};
      const ef = enStep.focus || {};
      if (!!zf.html !== !!ef.html) problems.push(`${at}（${zhStep.id}）focus.html 有无不一致`);
      if (!!zf.css !== !!ef.css) problems.push(`${at}（${zhStep.id}）focus.css 有无不一致`);
      if (!!(zhStep.solution.html) !== !!(enStep.solution.html)) {
        problems.push(`${at}（${zhStep.id}）「是否复用上一环节 HTML」不一致`);
      }
    });
  }
  if (CE.steps.length !== WANT_STEPS) problems.push(`[对照] 英文案例环节数应为 ${WANT_STEPS}，实际 ${CE.steps.length}`);
  if (!CE.startCode || !CE.startCode.html) problems.push('[对照] 英文案例缺少 startCode');
  if (!Array.isArray(CE.assets) || !CE.assets.length) problems.push('[对照] 英文案例缺少 assets');
}

// 英文案例也要过一遍「字段齐全 + 选择器可达 + 没留占位符」
const enSolutionHtml = [];
if (CE && Array.isArray(CE.steps)) {
  CE.steps.forEach((s, i) => {
    const title = `[en] 环节 ${i + 1}(${s.id})`;
    if (!Array.isArray(s.task) || !s.task.length) problems.push(`${title}：缺少 task`);
    if (!Array.isArray(s.hints) || s.hints.length < 2) problems.push(`${title}：提示少于 2 级`);
    if (!Array.isArray(s.syntax) || !s.syntax.length) problems.push(`${title}：缺少语法速查`);
    if (!Array.isArray(s.checks) || !s.checks.length) problems.push(`${title}：缺少检查点`);

    const html = s.solution.html || (enSolutionHtml[i - 1] || '');
    enSolutionHtml.push(html);

    if (/__CSS__|__HTML__/.test(s.solution.css) || /__CSS__|__HTML__/.test(html)) {
      problems.push(`${title}：参考答案里还留着 __CSS__ / __HTML__ 占位符`);
    }
    walkChecks(s.checks || [], html, title, '');
  });
  const finalEn = enSolutionHtml[enSolutionHtml.length - 1] || '';
  const missedEn = REQUIRED_BLOCKS.filter((c) => !classesOf(finalEn).has(c));
  if (missedEn.length) problems.push(`[en] 最终成品缺少区块：${missedEn.join(', ')}`);
}

const finalHtml = solutionHtml[solutionHtml.length - 1] || '';
const missed = REQUIRED_BLOCKS.filter((c) => !classesOf(finalHtml).has(c));
if (missed.length) problems.push(`最终成品缺少区块：${missed.join(', ')}`);

/* ---------------- 输出 ---------------- */
console.log(`案例：${C.title}`);
console.log(`环节数：${C.steps.length} · 素材 ${C.assets.length} 条 · 基础样式 ${C.baseCss.length} 字符`);
console.log('各环节检查点数：' + C.steps.map((s, i) => {
  const n = (s.checks || []).reduce((acc, c) => acc + (c.type === 'atWidth' ? c.checks.length : 1), 0);
  return `#${i + 1}:${n}`;
}).join(' '));

if (problems.length === 0) {
  console.log('\n✓ 案例校验通过：字段齐全、选择器可达、锚点可定位、类名未丢失');
} else {
  console.log(`\n✗ 发现 ${problems.length} 个问题：`);
  problems.forEach((p) => console.log('     ' + p));
}

if (warnings.length) {
  console.log(`\n△ ${warnings.length} 条提示（不阻断）：`);
  warnings.forEach((w) => console.log('     ' + w));
}

process.exit(problems.length === 0 ? 0 : 1);
