// =========================================================
// quiz-check.mjs —— 校验答题系统题库的数据正确性
// ---------------------------------------------------------
// 用法：node quiz-check.mjs
// 作用：读写题库时最容易犯的四类错误，这里一次全查出来
//   ① 题目数量不足（选择题 30 / 判断题 20）
//   ② id 重复（错题本 / 历史成绩都按 id 认题，重复会串题）
//   ③ answer 下标越界（选择题）、answer 不是布尔值（判断题）
//   ④ chapter 越界或字段缺失
// 另外打印章节分布与判断题的对错比例，方便肉眼确认覆盖是否均衡。
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync } from 'node:fs';

const WANT_CHOICE = 30;
const WANT_JUDGE = 20;
const CHAPTERS = 9;

// quiz-data.js 是普通脚本（window.QUIZ_BANK = ...），这里给它一个假的 window 沙箱
const sandbox = {};
new Function('window', readFileSync(new URL('./quiz-data.js', import.meta.url), 'utf8'))(sandbox);
const BANK = sandbox.QUIZ_BANK;

if (!BANK || !Array.isArray(BANK.choice) || !Array.isArray(BANK.judge)) {
  console.log('✗ quiz-data.js 里没有找到 window.QUIZ_BANK = { choice: [...], judge: [...] }');
  process.exit(1);
}

const problems = [];
const ids = new Set();

function checkList(list, kind) {
  const label = kind === 'choice' ? '选择题' : '判断题';
  list.forEach((q, i) => {
    const at = `${label}第 ${i + 1} 条`;
    if (!q.id) problems.push(`${at}：缺少 id`);
    else if (ids.has(q.id)) problems.push(`${at}（${q.id}）：id 与前面重复`);
    else ids.add(q.id);

    if (!(Number.isInteger(q.chapter) && q.chapter >= 1 && q.chapter <= CHAPTERS)) {
      problems.push(`${at}（${q.id}）：chapter 必须是 1–${CHAPTERS} 的整数`);
    }
    if (!q.q) problems.push(`${at}（${q.id}）：缺少题干 q`);
    if (!q.explain) problems.push(`${at}（${q.id}）：缺少解析 explain`);
    if (!q.topic) problems.push(`${at}（${q.id}）：缺少知识点 topic`);

    if (kind === 'choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        problems.push(`${at}（${q.id}）：options 至少要有 2 个选项`);
      } else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)) {
        problems.push(`${at}（${q.id}）：answer 必须是 options 的有效下标（0–${q.options.length - 1}）`);
      }
    } else if (typeof q.answer !== 'boolean') {
      problems.push(`${at}（${q.id}）：判断题的 answer 必须是 true / false`);
    }
  });
}

checkList(BANK.choice, 'choice');
checkList(BANK.judge, 'judge');

const dist = {};
[...BANK.choice, ...BANK.judge].forEach((q) => {
  dist[q.chapter] = (dist[q.chapter] || 0) + 1;
});

console.log(`题库规模：选择题 ${BANK.choice.length} 道 · 判断题 ${BANK.judge.length} 道 · 合计 ${ids.size} 道（id 唯一）`);
console.log('章节分布：' + Array.from({ length: CHAPTERS }, (_, i) =>
  `第${i + 1}章 ${dist[i + 1] || 0}`).join(' · '));
console.log(`判断题对错比例：正确 ${BANK.judge.filter((q) => q.answer).length} · 错误 ${BANK.judge.filter((q) => !q.answer).length}`);

if (BANK.choice.length < WANT_CHOICE) problems.push(`选择题只有 ${BANK.choice.length} 道，少于预期的 ${WANT_CHOICE} 道`);
if (BANK.judge.length < WANT_JUDGE) problems.push(`判断题只有 ${BANK.judge.length} 道，少于预期的 ${WANT_JUDGE} 道`);

if (problems.length === 0) {
  console.log('\n✓ 题库校验通过：id 唯一、章节合法、答案下标有效、字段齐全');
} else {
  console.log(`\n✗ 发现 ${problems.length} 个问题：`);
  problems.forEach((p) => console.log('     ' + p));
}

process.exit(problems.length === 0 ? 0 : 1);
