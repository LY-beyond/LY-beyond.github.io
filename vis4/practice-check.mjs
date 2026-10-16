// =========================================================
// practice-check.mjs —— 「D3 实战工作台」案例数据一致性校验
// ---------------------------------------------------------
// 改造自源站 vis/practice-check.mjs（原脚本校验纯 HTML/CSS 练手案例）。
// 现在校验的是 D3 案例：8 个环节、solution.js / startCode.js、
// SVG 结构 token、检查点类型、focus 锚点可定位。
//
// 用法：node practice-check.mjs       （退出码 0 = 全部通过）
//
// 中英对照：en/practice-data.js 不存在时跳过（P8 再做），不算失败。
// =========================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WANT_STEPS = 8;

/* 最终成品必须出现的 SVG 结构（以「引号里的 token」形式出现在 solution.js 中） */
const REQUIRED_BLOCKS = ['svg', 'g', 'rect', 'text', 'line'];

/* 环节之间不允许丢掉的稳定类名（后一关不丢前一关用到的类名） */
const CSS_TOKENS = [
  'chart', 'bars', 'bar', 'bar-label',
  'axis', 'axis-x', 'axis-y',
  'guide', 'annotation', 'chart-title',
];

/* 检查点类型表：类型 → 必填字段校验 */
const TYPES = {
  noError: () => null,
  svgCount: (c) => (typeof c.n === 'number' && c.n >= 1 ? null : 'svgCount 需要 n ≥ 1'),
  exists: (c) => (sel(c.selector) ? null : 'exists 需要 selector'),
  count: (c) =>
    sel(c.selector) && (hasNum(c.eq) || hasNum(c.min) || hasNum(c.max))
      ? null
      : 'count 需要 selector 以及 eq / min / max 之一',
  attr: (c) => {
    if (!sel(c.selector)) return 'attr 需要 selector';
    if (typeof c.prop !== 'string' || !c.prop) return 'attr 需要 prop';
    if (!['eq', 'min', 'max', 'contains'].includes(c.mode)) return 'attr 的 mode 应为 eq|min|max|contains';
    if (c.mode === 'eq' || c.mode === 'contains') {
      return c.value === undefined ? 'attr 在 ' + c.mode + ' 模式下需要 value' : null;
    }
    return hasNum(c.min) || hasNum(c.max) ? null : 'attr 在 ' + c.mode + ' 模式下需要 min / max';
  },
  bbox: (c) => {
    if (!sel(c.selector)) return 'bbox 需要 selector';
    if (!['width', 'height'].includes(c.dim)) return 'bbox 的 dim 应为 width|height';
    return hasNum(c.min) || hasNum(c.max) ? null : 'bbox 需要 min / max';
  },
  order: (c) => {
    if (!sel(c.selector)) return 'order 需要 selector';
    if (!['x', 'y', 'width', 'height'].includes(c.by)) return 'order 的 by 应为 x|y|width|height';
    if (!['asc', 'desc'].includes(c.dir)) return 'order 的 dir 应为 asc|desc';
    return null;
  },
  style: (c) => {
    if (!sel(c.selector)) return 'style 需要 selector';
    if (typeof c.prop !== 'string' || !c.prop) return 'style 需要 prop';
    return ['eq', 'min', 'max', 'set'].includes(c.mode) ? null : 'style 的 mode 应为 eq|min|max|set';
  },
  text: (c) =>
    sel(c.selector) && Array.isArray(c.contains) && c.contains.length
      ? null
      : 'text 需要 selector 与 contains[]',
  vary: (c) =>
    sel(c.selector) && typeof c.prop === 'string' && c.prop && hasNum(c.min)
      ? null
      : 'vary 需要 selector、prop 与 min',
  any: (c) => (Array.isArray(c.checks) && c.checks.length ? null : 'any 需要非空 checks[]'),
  atWidth: (c) =>
    hasNum(c.width) && Array.isArray(c.checks) && c.checks.length
      ? null
      : 'atWidth 需要 width 与非空 checks[]',
};

const NESTED_TYPES = ['any', 'atWidth'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZH_FILE = path.join(__dirname, 'practice-data.js');
const EN_FILE = path.join(__dirname, 'en', 'practice-data.js');

let passCount = 0;
let problems = [];

function check(label, ok, detail) {
  if (ok) {
    passCount++;
    console.log('  ✓ ' + label + (detail ? '（' + detail + '）' : ''));
  } else {
    problems.push(label + (detail ? '：' + detail : ''));
    console.log('  ✗ ' + label + (detail ? '（' + detail + '）' : ''));
  }
}

function warn(msg) {
  console.log('  • ' + msg);
}

function section(title) {
  console.log('\n' + title);
}

function sel(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function hasNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function isStr(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

/* ---------- 从源码里抽「引号中的 token」（用于静态可达性检查） ---------- */
function quotedTokens(src) {
  const out = new Set();
  const re = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const words = m[2].match(/[A-Za-z_][\w-]*/g) || [];
    words.forEach((w) => out.add(w));
  }
  return out;
}

/* ---------- 选择器 → token 列表（去伪类，拆组合子） ---------- */
function tokensOf(selector) {
  const cleaned = String(selector)
    .replace(/:{1,2}[A-Za-z-]+(\([^()]*\))?/g, '')
    .replace(/\([^()]*\)/g, ' ');
  const parts = cleaned.split(/[\s>+~,]+/).filter(Boolean);
  const toks = [];
  parts.forEach((p) => {
    (p.match(/[.#]?[A-Za-z_][\w-]*/g) || []).forEach((x) => toks.push(x.replace(/^[.#]/, '')));
  });
  return toks.filter(Boolean);
}

/* ---------- 静态可达性：选择器里的每个 token 都要能在 JS 源码里找到 ---------- */
function selectorReachable(selector, src) {
  const avail = quotedTokens(src);
  const missing = tokensOf(selector).filter((tk) => !avail.has(tk));
  return { ok: missing.length === 0, missing };
}

/* ---------- 检查点递归校验 ---------- */
function walkChecks(checks, ctx, depth, prefix) {
  checks.forEach((c, i) => {
    const at = prefix + ' 检查点 ' + (i + 1) + (depth ? '（子级）' : '');
    if (!c || typeof c !== 'object') {
      check(at, false, '不是一个对象');
      return;
    }
    const typeCheck = TYPES[c.type];
    if (!typeCheck) {
      check(at, false, '未知 type：' + c.type);
      return;
    }
    const err = typeCheck(c);
    if (err) {
      check(at, false, err);
      return;
    }
    if (!isStr(c.label)) {
      check(at, false, '缺少 label（人话描述该达到什么效果）');
      return;
    }
    if (!isStr(c.hint)) {
      check(at, false, '缺少 hint（失败时给学生的提示）');
      return;
    }

    let ok = true;
    let detail = c.type;

    if (sel(c.selector) && !NESTED_TYPES.includes(c.type)) {
      const r = selectorReachable(c.selector, ctx.src);
      ok = r.ok;
      detail = c.type + ' ' + c.selector + (r.ok ? '' : '，源码里找不到：' + r.missing.join('、'));
    } else if (NESTED_TYPES.includes(c.type)) {
      const subs = c.checks;
      ok = subs.every((s) =>
        !sel(s.selector) ? true : selectorReachable(s.selector, ctx.src).ok
      );
      detail = c.type + '（' + subs.length + ' 个子检查）';
      walkChecks(subs, ctx, depth + 1, prefix + ' 检查点 ' + (i + 1) + ' →');
    }
    check(at, ok, detail);
  });
}

/* ---------- 载入案例 ---------- */
function loadCase(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = {};
  new Function('window', src)(sandbox);
  return sandbox.PRACTICE_CASE;
}

/* ================= 主流程 ================= */
console.log('practice-check · D3 实战工作台案例数据校验');
console.log('数据文件：' + ZH_FILE);

if (!fs.existsSync(ZH_FILE)) {
  console.log('\n✗ 找不到 practice-data.js，校验无法进行。');
  process.exit(1);
}

let C;
try {
  C = loadCase(ZH_FILE);
} catch (e) {
  console.log('\n✗ practice-data.js 执行失败：' + e.message);
  process.exit(1);
}

/* ---------- 1. 顶层字段 ---------- */
section('1. 顶层字段');
check('window.PRACTICE_CASE 已定义', !!C && typeof C === 'object');
check('title 非空', isStr(C.title));
check('subtitle 非空', isStr(C.subtitle));
check('brief 存在', !!C.brief && typeof C.brief === 'object');
check('brief.goal 非空', C.brief && isStr(C.brief.goal));
check(
  'brief.constraints 是非空字符串数组',
  C.brief && Array.isArray(C.brief.constraints) && C.brief.constraints.length > 0 && C.brief.constraints.every(isStr)
);
check('baseCss 非空', isStr(C.baseCss));
check('startCode.js 非空', C.startCode && isStr(C.startCode.js));
check(
  'assets 是非空 {label,value} 数组',
  Array.isArray(C.assets) && C.assets.length > 0 && C.assets.every((a) => isStr(a.label) && isStr(a.value))
);

/* ---------- 2. 环节数量与 id 唯一 ---------- */
section('2. 环节数量与 id 唯一');
check('steps 是数组', Array.isArray(C.steps));
check('共 ' + WANT_STEPS + ' 个环节', C.steps.length === WANT_STEPS, '实际 ' + C.steps.length);

const ids = C.steps.map((s) => s.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
check('id 全部唯一', dup.length === 0, dup.length ? '重复：' + dup.join('、') : ids.join(', '));

/* ---------- 3. 逐关字段与检查点 ---------- */
section('3. 逐关字段 / 提示 / 语法 / 检查点 / focus 锚点');
C.steps.forEach((s, i) => {
  const name = (i + 1) + '. ' + (s.title || '(无标题)');
  console.log('\n— ' + name);
  check('id 非空', isStr(s.id));
  check('title 非空', isStr(s.title));
  check('subtitle 非空', isStr(s.subtitle));
  check('task 是非空字符串数组', Array.isArray(s.task) && s.task.length > 0 && s.task.every(isStr));
  check('hints ≥ 2 级', Array.isArray(s.hints) && s.hints.length >= 2, '实际 ' + (s.hints ? s.hints.length : 0) + ' 级');
  check(
    'syntax 速查非空（{code,note}）',
    Array.isArray(s.syntax) && s.syntax.length > 0 && s.syntax.every((x) => isStr(x.code) && isStr(x.note))
  );
  check('checks 非空', Array.isArray(s.checks) && s.checks.length > 0, '实际 ' + (s.checks ? s.checks.length : 0) + ' 个');
  check('focus.js 非空', s.focus && isStr(s.focus.js));
  check('solution.js 非空', s.solution && isStr(s.solution.js));

  // focus 锚点必须能在「本关起始代码」里定位到
  const starter = i === 0 ? C.startCode.js : C.steps[i - 1].solution.js;
  const anchor = s.focus && s.focus.js;
  if (isStr(anchor)) {
    const at = starter.indexOf(anchor);
    check('focus 锚点在起始代码里找得到', at >= 0, at < 0 ? '找不到：' + JSON.stringify(anchor.slice(0, 40)) : 'offset ' + at);
    if (at >= 0 && starter.indexOf(anchor, at + 1) >= 0) {
      check('focus 锚点在起始代码里唯一', false, '出现多次，定位会歧义');
    } else if (at >= 0) {
      check('focus 锚点在起始代码里唯一', true);
    }
  }

  if (Array.isArray(s.checks) && s.checks.length) {
    walkChecks(s.checks, { src: s.solution.js }, 0, '第 ' + (i + 1) + ' 关');
  }
});

/* ---------- 4. 逐关递进：不丢前一关的稳定类名 ---------- */
section('4. 逐关递进（后一关不丢前一关用到的类名）');
C.steps.forEach((s, i) => {
  if (i === 0) return;
  const prev = quotedTokens(C.steps[i - 1].solution.js);
  const cur = quotedTokens(s.solution.js);
  const lost = CSS_TOKENS.filter((tk) => prev.has(tk) && !cur.has(tk));
  check('第 ' + (i + 1) + ' 关保留了第 ' + i + ' 关的类名', lost.length === 0, lost.length ? '丢了：' + lost.join('、') : '');
});

/* ---------- 5. 最终产物必须出现的 SVG 结构 ---------- */
section('5. 最终成品的 SVG 结构');
const finalSrc = C.steps[C.steps.length - 1].solution.js;
const finalTokens = quotedTokens(finalSrc);
REQUIRED_BLOCKS.forEach((tk) => {
  check('最终 solution.js 里出现 <' + tk + '>', finalTokens.has(tk));
});

/* ---------- 6. 中英对照（en/ 未创建则跳过） ---------- */
section('6. 中英对照');
if (!fs.existsSync(EN_FILE)) {
  warn('（en/ 尚未创建，P8 再做）跳过中英对照');
} else {
  let E;
  try {
    E = loadCase(EN_FILE);
  } catch (e) {
    E = null;
    check('en/practice-data.js 可执行', false, e.message);
  }
  if (E) {
    check('中英 steps 数量一致', E.steps && E.steps.length === C.steps.length, 'en ' + (E.steps ? E.steps.length : 0) + ' / zh ' + C.steps.length);
    C.steps.forEach((s, i) => {
      const e = E.steps[i] || {};
      check('第 ' + (i + 1) + ' 关 id 一致', e.id === s.id, 'en ' + e.id + ' / zh ' + s.id);
      check('第 ' + (i + 1) + ' 关 hints 数量一致', Array.isArray(e.hints) && e.hints.length === s.hints.length);
      check('第 ' + (i + 1) + ' 关 checks 数量一致', Array.isArray(e.checks) && e.checks.length === s.checks.length);
      check('第 ' + (i + 1) + ' 关 title 非空', isStr(e.title));
      check('第 ' + (i + 1) + ' 关 solution.js 非空', e.solution && isStr(e.solution.js));
    });
    check('en baseCss 非空', isStr(E.baseCss));
  }
}

/* ---------- 汇总 ---------- */
console.log('\n' + '─'.repeat(56));
console.log('通过：' + passCount + ' 项 · 失败：' + problems.length + ' 项');
if (problems.length) {
  console.log('\n失败清单：');
  problems.forEach((p, i) => console.log('  ' + (i + 1) + '. ' + p));
  process.exit(1);
}
console.log('✓ 全部通过（' + C.steps.length + ' 个环节，最终产物含 ' + REQUIRED_BLOCKS.join('/') + '）');
process.exit(0);
