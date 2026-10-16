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
