// =========================================================
// quiz-check.mjs —— 校验答题系统（中英两份题库）
// ---------------------------------------------------------
// 用法：node quiz-check.mjs
//
// 查三件事：
//   A. 每份题库自身是否合法：id 唯一、chapter 合法、答案下标有效、字段齐全
//   B. 中英两份是否**逐题对齐**：同一套 id、同一个 chapter、同一个答案下标、同样多的选项
//      —— 这是「两种语言内容一致」在题库层面的自动化保证
//   C. en/quiz-ui.js 的键与 quiz.js 的 T 表是否完全对应
//      —— 漏一个键，英文页面就会把 [key] 直接显示出来
// 另外打印章节分布与判断题对错比例，方便肉眼确认覆盖是否均衡。
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync } from 'node:fs';

const WANT_CHOICE = 30;
const WANT_JUDGE = 20;
const CHAPTERS = 9;

function load(file) {
  const sandbox = {};
  new Function('window', readFileSync(new URL(file, import.meta.url), 'utf8'))(sandbox);
  return sandbox;
}

const problems = [];
const zh = load('./quiz-data.js').QUIZ_BANK;
const en = load('./en/quiz-data.js').QUIZ_BANK;

if (!zh || !zh.choice || !en || !en.choice) {
  console.log('✗ 找不到 window.QUIZ_BANK —— 请检查 quiz-data.js / en/quiz-data.js');
  process.exit(1);
}

/* ---------------- A. 单份题库合法性 ---------------- */
function checkBank(bank, label) {
  const ids = new Set();
  const bad = (msg) => problems.push(`[${label}] ${msg}`);

  function checkList(list, kind) {
    const what = kind === 'choice' ? '选择题' : '判断题';
    list.forEach((q, i) => {
      const at = `${what}第 ${i + 1} 条`;
      if (!q.id) bad(`${at}：缺少 id`);
      else if (ids.has(q.id)) bad(`${at}（${q.id}）：id 重复`);
      else ids.add(q.id);

      if (!(Number.isInteger(q.chapter) && q.chapter >= 1 && q.chapter <= CHAPTERS)) {
        bad(`${at}（${q.id}）：chapter 必须是 1–${CHAPTERS} 的整数`);
      }
      if (!q.q) bad(`${at}（${q.id}）：缺少题干 q`);
      if (!q.explain) bad(`${at}（${q.id}）：缺少解析 explain`);
      if (!q.topic) bad(`${at}（${q.id}）：缺少知识点 topic`);

      if (kind === 'choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          bad(`${at}（${q.id}）：options 至少 2 个`);
        } else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)) {
          bad(`${at}（${q.id}）：answer 必须是 options 的有效下标`);
        }
      } else if (typeof q.answer !== 'boolean') {
        bad(`${at}（${q.id}）：判断题 answer 必须是 true / false`);
      }
    });
  }

  checkList(bank.choice, 'choice');
  checkList(bank.judge, 'judge');

  if (bank.choice.length < WANT_CHOICE) bad(`选择题只有 ${bank.choice.length} 道，少于 ${WANT_CHOICE}`);
  if (bank.judge.length < WANT_JUDGE) bad(`判断题只有 ${bank.judge.length} 道，少于 ${WANT_JUDGE}`);

  const dist = {};
  [...bank.choice, ...bank.judge].forEach((q) => { dist[q.chapter] = (dist[q.chapter] || 0) + 1; });
  return { ids, dist, count: ids.size };
}

const zhInfo = checkBank(zh, 'zh');
const enInfo = checkBank(en, 'en');

/* ---------------- B. 中英逐题对齐 ---------------- */
function compare(kind) {
  const a = zh[kind];
  const b = en[kind];
  const what = kind === 'choice' ? '选择题' : '判断题';
  if (a.length !== b.length) {
    problems.push(`[对照] ${what}数量不一致：zh=${a.length}，en=${b.length}`);
    return;
  }
  a.forEach((qa, i) => {
    const qb = b[i];
    if (qa.id !== qb.id) problems.push(`[对照] ${what}第 ${i + 1} 条 id 不一致：zh=${qa.id}，en=${qb.id}`);
    if (qa.chapter !== qb.chapter) {
      problems.push(`[对照] ${qa.id} 的 chapter 不一致：zh=${qa.chapter}，en=${qb.chapter}`);
    }
    if (String(qa.answer) !== String(qb.answer)) {
      problems.push(`[对照] ${qa.id} 的 answer 不一致：zh=${qa.answer}，en=${qb.answer}`);
    }
    if (kind === 'choice' && qa.options.length !== qb.options.length) {
      problems.push(`[对照] ${qa.id} 的选项数不一致：zh=${qa.options.length}，en=${qb.options.length}`);
    }
  });
}
compare('choice');
compare('judge');

/* ---------------- C. 英文文案表与 T 表对齐 ---------------- */
const quizSrc = readFileSync(new URL('./quiz.js', import.meta.url), 'utf8');
const tBlock = quizSrc.match(/var T = \{([\s\S]*?)\n  \};/);
const tKeys = tBlock
  ? [...tBlock[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map((m) => m[1])
  : [];
const uiKeys = Object.keys(load('./en/quiz-ui.js').QUIZ_UI || {});

if (!tKeys.length) {
  problems.push('[文案] 没能从 quiz.js 里解析出 T 表（正则可能失效）');
} else {
  const missing = tKeys.filter((k) => !uiKeys.includes(k));
  const extra = uiKeys.filter((k) => !tKeys.includes(k));
  if (missing.length) problems.push(`[文案] en/quiz-ui.js 缺少键：${missing.join(', ')}`);
  if (extra.length) problems.push(`[文案] en/quiz-ui.js 多出无效键：${extra.join(', ')}`);
}

/* ---------------- 输出 ---------------- */
const fmt = (info) => Array.from({ length: CHAPTERS }, (_, i) => `第${i + 1}章 ${info.dist[i + 1] || 0}`).join(' · ');

console.log('中文题库：选择题 ' + zh.choice.length + ' · 判断题 ' + zh.judge.length + ' · 合计 ' + zhInfo.count + '（id 唯一）');
console.log('  章节分布：' + fmt(zhInfo));
console.log('  判断题对错：正确 ' + zh.judge.filter((q) => q.answer).length + ' · 错误 ' + zh.judge.filter((q) => !q.answer).length);
console.log('英文题库：选择题 ' + en.choice.length + ' · 判断题 ' + en.judge.length + ' · 合计 ' + enInfo.count + '（id 唯一）');
console.log('  章节分布：' + fmt(enInfo));
console.log('  判断题对错：正确 ' + en.judge.filter((q) => q.answer).length + ' · 错误 ' + en.judge.filter((q) => !q.answer).length);
console.log('文案表：T 表 ' + tKeys.length + ' 键 · en/quiz-ui.js ' + uiKeys.length + ' 键');

if (problems.length === 0) {
  console.log('\n✓ 校验通过：两份题库各自合法，且逐题一一对应；英文文案表与 T 表完全对齐');
} else {
  console.log(`\n✗ 发现 ${problems.length} 个问题：`);
  problems.forEach((p) => console.log('     ' + p));
}

process.exit(problems.length === 0 ? 0 : 1);
