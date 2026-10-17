// =========================================================
// progress.js —— 学习进度记忆（localStorage）
// ---------------------------------------------------------
// 存一份结构化的进度对象：
//   {
//     "lesson-01": { "sections": ["ch-1-1","ch-1-2"], "goals": [true,false,...] },
//     ...
//   }
// 只记「小节是否读过 / 学习目标是否勾选」，不记分数 —— 分数由 quiz.js 单独存。
// 隐私模式（localStorage 抛错）下全部降级为「不记忆」，功能不中断。
// =========================================================

const KEY = 'vis4-progress';
const KEY_ACT = 'vis4-activity';   // 每日活动计数（首页学习热力图数据源）

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}

function writeAll(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { /* 忽略写入失败 */ }
}

function bucket(lesson, create) {
  const all = readAll();
  if (!all[lesson]) {
    if (!create) return null;
    all[lesson] = { sections: [], goals: [] };
  }
  return { all, data: all[lesson] };
}

/* ---------- 小节已读 ---------- */
export function markSection(lesson, id) {
  const b = bucket(lesson, true);
  if (!b.data.sections.includes(id)) {
    b.data.sections.push(id);
    writeAll(b.all);
    bumpActivity(1);   // 首次读完一个小节 = 记一次学习动作
  }
}

export function isSection(lesson, id) {
  const b = bucket(lesson, false);
  return !!(b && b.data.sections.includes(id));
}

/* ---------- 学习目标勾选 ---------- */
export function markGoal(lesson, values) {
  const b = bucket(lesson, true);
  b.data.goals = values;
  writeAll(b.all);
  bumpActivity(1);   // 勾 / 取消学习目标也算一次学习动作
}

export function getGoals(lesson) {
  const b = bucket(lesson, false);
  return (b && b.data.goals) || [];
}

/* ---------- 汇总 ---------- */
export function chapterProgress(lesson, ids) {
  const b = bucket(lesson, false);
  const done = b ? ids.filter((id) => b.data.sections.includes(id)).length : 0;
  return { done, total: ids.length };
}

/* ---------- 单章已读小节数（门户卡片进度用） ---------- */
export function lessonDone(lesson) {
  const b = bucket(lesson, false);
  return b ? b.data.sections.length : 0;
}

/* ---------- 全站进度（门户用） ---------- */
export function siteProgress(lessonIds) {
  const all = readAll();
  let done = 0;
  lessonIds.forEach((id) => {
    const b = all[id];
    if (b && b.sections) done += b.sections.length;
  });
  return { lessons: Object.keys(all).length, sectionsRead: done };
}

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
}

/* ---------- 每日活动（首页学习热力图数据源） ----------
 * 结构：{ "2026-10-17": 3, ... } —— 只增不减，与学习进度解耦：
 * 「重置学习进度」只清 vis4-progress，不抹掉历史热力图。
 * quiz.js（普通脚本）按同键同格式写入，两边互不依赖。 */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function readActivity() {
  try {
    const obj = JSON.parse(localStorage.getItem(KEY_ACT) || '{}');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

export function bumpActivity(n = 1) {
  try {
    const all = readActivity();
    const day = todayKey();
    all[day] = (all[day] || 0) + n;
    localStorage.setItem(KEY_ACT, JSON.stringify(all));
  } catch (e) { /* 隐私模式等场景降级为不记录 */ }
}
