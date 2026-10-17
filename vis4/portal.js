// =========================================================
// portal.js —— 门户首页交互（进度回填 / 顶栏高亮）
// ---------------------------------------------------------
// 只做三件「静态 HTML 做不到」的事：
//   ① 把 localStorage 里的学习进度回填到 Hero 按钮、章节卡片与汇总条
//   ② 滚动时高亮顶栏对应分区
//   ③ 学习画像：章节掌握度雷达 + 学习热力图 + 错题深链（数据全部来自 localStorage）
// 说明：本文件是 ES Module，用 file:// 打开时会被浏览器 CORS 拦截，
//       页面不使用进度功能也能正常阅读 —— 属于刻意设计的降级。
// =========================================================

import { lessonDone, resetAll, getGoals, readActivity } from './progress.js';

/* 章节元数据（中英各一份标签，供 en/ 镜像复用同一脚本） */
const LESSONS = [
  { id: 'lesson-01', total: 5, zh: '第 1 章 数据',            en: 'Ch.1 Data' },
  { id: 'lesson-02', total: 4, zh: '第 2 章 数据可视化流程',  en: 'Ch.2 Pipeline' },
  { id: 'lesson-03', total: 8, zh: '第 3 章 色彩专题',        en: 'Ch.3 Color' },
  { id: 'lesson-04', total: 5, zh: '第 4 章 低维数据可视化',  en: 'Ch.4 Low-dim' },
  { id: 'lesson-05', total: 5, zh: '第 5 章 时序数据可视化',  en: 'Ch.5 Temporal' }
];

const WORD = {
  zh: { cont: '继续学习', restart: '重头开始', read: '已读', unit: '小节', reset: '重置学习进度', confirm: '确定清空全部学习进度吗？此操作不可撤销。',
    reviewBtn: '重练错题', profileEmpty: '还没有学习记录 —— 从第 1 章开始阅读，或去做一次章节测验，这里会长出你的专属画像。' },
  en: { cont: 'Continue', restart: 'Start over', read: 'Read', unit: 'sections', reset: 'Reset progress', confirm: 'Clear all learning progress? This cannot be undone.',
    reviewBtn: 'Redo wrong answers', profileEmpty: 'No study records yet — start with Chapter 1 or take a quiz, and your profile will grow here.' }
};

const SITE_TOTAL = LESSONS.reduce((sum, l) => sum + l.total, 0);
const lang = /^en/i.test(document.documentElement.lang || '') ? 'en' : 'zh';
const W = WORD[lang];

/* ---------------------------------------------------------
 * ① 进度回填
 * ------------------------------------------------------- */
function fillCards() {
  document.querySelectorAll('.card[data-lesson]').forEach((card) => {
    const meta = LESSONS.find((l) => l.id === card.dataset.lesson);
    if (!meta) return;
    const done = Math.min(lessonDone(meta.id), meta.total);
    const fill = card.querySelector('.card__progfill');
    const text = card.querySelector('.card__progtext');
    if (fill) fill.style.width = (meta.total ? Math.round(done / meta.total * 100) : 0) + '%';
    if (text) text.textContent = done + ' / ' + meta.total;
  });
}

function fillHero() {
  const btn = document.getElementById('hero-start');
  if (!btn) return;
  // 找到第一个「开了头但没读完」的章节
  const next = LESSONS.find((l) => {
    const done = lessonDone(l.id);
    return done > 0 && done < l.total;
  });
  if (next) {
    btn.textContent = W.cont + ' · ' + next[lang];
    btn.href = next.id + '/';
  } else {
    const allDone = LESSONS.every((l) => lessonDone(l.id) >= l.total);
    if (allDone) {
      btn.textContent = W.restart + ' · ' + LESSONS[0][lang];
      btn.href = LESSONS[0].id + '/';
    }
  }
}

function fillSummary() {
  const line = document.getElementById('progress-line');
  if (!line) return;
  const done = LESSONS.reduce((sum, l) => sum + Math.min(lessonDone(l.id), l.total), 0);
  if (!done) { line.hidden = true; return; }      // 还没开始读，不显示汇总条
  line.hidden = false;

  const pct = Math.round(done / SITE_TOTAL * 100);
  const text = line.querySelector('.progress-line__text');
  const fill = document.getElementById('progress-fill');
  const reset = document.getElementById('progress-reset');
  if (text) text.innerHTML = W.read + ' <b>' + done + '</b> / ' + SITE_TOTAL + ' ' + W.unit + '（' + pct + '%）';
  if (fill) fill.style.width = pct + '%';

  if (reset) {
    reset.textContent = W.reset;
    reset.addEventListener('click', () => {
      if (!window.confirm(W.confirm)) return;
      resetAll();
      fillCards();
      fillSummary();
      fillHero();
      renderProfile();
    });
  }
}

/* ---------------------------------------------------------
 * ③ 学习画像（章节掌握度雷达 + 学习热力图 + 错题深链）
 * ------------------------------------------------------- */
const DAY_MS = 86400000;
// 每章题库题数（与 quiz-data.js 同步，en/quiz-data.js 结构一致）
const BANK_PER_CH = { 1: 8, 2: 8, 3: 7, 4: 7, 5: 7 };

function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function wrongBook() {
  const b = readJSON('vis4-quiz-wrong', {});
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}

function dayKeyOf(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// 该章测验分量（0–1）；该章没有可用的测验数据时返回 null（权重折算到前两项）。
// 依据：错题本里仍挂着的错题 = 尚未补上的漏洞，按占该章题库的比例扣分。
function chapterQuizScore(ch) {
  const book = wrongBook();
  const history = readJSON('vis4-quiz-history', []);
  const hasData = (Array.isArray(history) && history.length > 0) ||
    Object.keys(book).some((id) => book[id] && book[id].chapter === ch);
  if (!hasData) return null;
  let bad = 0;
  Object.keys(book).forEach((id) => {
    if (book[id] && book[id].chapter === ch) bad++;
  });
  return Math.max(0, 1 - bad / BANK_PER_CH[ch]);
}

// 掌握度 = 小节阅读 50% + 学习目标 30% + 测验表现 20%（未测时前两项加权折算）
function chapterMastery(meta, ch) {
  const sec = meta.total ? Math.min(lessonDone(meta.id), meta.total) / meta.total : 0;
  const goals = getGoals(meta.id);
  const goal = goals.length ? goals.filter(Boolean).length / goals.length : 0;
  const q = chapterQuizScore(ch);
  if (q === null) return (0.5 * sec + 0.3 * goal) / 0.8;
  return 0.5 * sec + 0.3 * goal + 0.2 * q;
}

function renderRadar() {
  const svg = document.getElementById('profile-radar');
  if (!svg) return;
  const CX = 160, CY = 118, R = 78;
  const N = LESSONS.length;
  const ang = (i) => -Math.PI / 2 + i * 2 * Math.PI / N;
  const pt = (i, r) => [CX + r * Math.cos(ang(i)), CY + r * Math.sin(ang(i))];
  const P = (arr) => arr.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

  let s = '';
  [0.25, 0.5, 0.75, 1].forEach((k) => {
    s += '<polygon class="pr-ring" points="' + P(LESSONS.map((x, i) => pt(i, R * k))) + '"/>';
  });
  LESSONS.forEach((x, i) => {
    const e = pt(i, R);
    s += '<line class="pr-axis" x1="' + CX + '" y1="' + CY + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '"/>';
  });

  const vals = LESSONS.map((m, i) => chapterMastery(m, i + 1));
  s += '<polygon class="pr-data" points="' + P(vals.map((v, i) => pt(i, R * Math.max(0.02, v)))) + '"/>';
  vals.forEach((v, i) => {
    const p = pt(i, R * Math.max(0.02, v));
    s += '<circle class="pr-dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3"/>';
  });

  // 轴标签：按角度选择对齐方向，附当前掌握度百分比
  LESSONS.forEach((m, i) => {
    const a = ang(i);
    const lp = pt(i, R + 12);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    const dy = Math.sin(a) < -0.3 ? -3 : (Math.sin(a) > 0.3 ? 9 : 4);
    const label = (lang === 'en' ? 'Ch.' + (i + 1) : '第 ' + (i + 1) + ' 章') + ' ' + Math.round(vals[i] * 100) + '%';
    s += '<text class="pr-chlabel" x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + dy).toFixed(1) +
      '" text-anchor="' + anchor + '">' + label + '</text>';
  });
  svg.innerHTML = s;
}

function renderHeat() {
  const svg = document.getElementById('profile-heat');
  if (!svg) return;
  const act = readActivity();
  const WEEKS = 18, CELL = 13, GAP = 3, TOP = 16, LEFT = 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;   // 周一 = 0
  // 最后一列到本周日为止，向前铺满 18 周
  const start = new Date(today.getTime() + (6 - dow) * DAY_MS - (WEEKS * 7 - 1) * DAY_MS);
  const EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let s = '';
  // 月份标签：某列首格的月份与前一列不同时标注一次
  let lastMon = -1;
  for (let j = 0; j < WEEKS; j++) {
    const d = new Date(start.getTime() + j * 7 * DAY_MS);
    if (d.getMonth() !== lastMon) {
      lastMon = d.getMonth();
      const name = lang === 'en' ? EN_MON[lastMon] : (lastMon + 1) + '月';
      s += '<text class="ph-month" x="' + (LEFT + j * (CELL + GAP)) + '" y="10">' + name + '</text>';
    }
  }
  const WD = lang === 'en' ? ['Mon', 'Wed', 'Fri'] : ['一', '三', '五'];
  [0, 2, 4].forEach((i, k) => {
    s += '<text class="ph-wday" x="0" y="' + (TOP + i * (CELL + GAP) + CELL - 3) + '">' + WD[k] + '</text>';
  });
  for (let j = 0; j < WEEKS; j++) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + (j * 7 + i) * DAY_MS);
      const n = act[dayKeyOf(d)] || 0;
      const lvl = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
      const tip = lang === 'en'
        ? dayKeyOf(d) + ' · ' + n + (n === 1 ? ' action' : ' actions')
        : dayKeyOf(d) + ' · 学习动作 ' + n + ' 次';
      s += '<rect class="ph-l' + lvl + (d > today ? ' ph-future' : '') + '" rx="3" ry="3"' +
        ' x="' + (LEFT + j * (CELL + GAP)) + '" y="' + (TOP + i * (CELL + GAP)) + '"' +
        ' width="' + CELL + '" height="' + CELL + '"><title>' + tip + '</title></rect>';
    }
  }
  svg.innerHTML = s;
}

function activitySummary(act) {
  let total = 0, active = 0;
  Object.keys(act).forEach((k) => {
    if (act[k] > 0) { active++; total += act[k]; }
  });
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  let cursor = new Date(t.getTime());
  if (!act[dayKeyOf(cursor)]) cursor = new Date(cursor.getTime() - DAY_MS); // 今天还没学则从昨天起算
  let streak = 0;
  while (act[dayKeyOf(cursor)]) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return { total, active, streak };
}

function renderProfile() {
  const card = document.getElementById('profile-card');
  if (!card) return;
  renderRadar();
  renderHeat();

  const sum = activitySummary(readActivity());
  const wrong = Object.keys(wrongBook()).length;
  const meta = document.getElementById('profile-meta');
  if (meta) {
    const noProgress = LESSONS.every((l) => lessonDone(l.id) === 0);
    if (!sum.total && noProgress && !wrong) {
      meta.textContent = W.profileEmpty;
      meta.classList.add('is-empty');
    } else {
      meta.classList.remove('is-empty');
      meta.textContent = lang === 'en'
        ? sum.total + ' actions · ' + sum.streak + '-day streak · ' + sum.active +
          ' active day' + (sum.active === 1 ? '' : 's') + ' · ' + wrong + ' wrong answers to redo'
        : '学习动作 ' + sum.total + ' 次 · 连续学习 ' + sum.streak + ' 天 · 活跃 ' + sum.active +
          ' 天 · 待重练错题 ' + wrong + ' 题';
    }
  }

  // 错题深链：有错题时显示「重练错题」，直达 quiz 页的重做模式
  const btn = document.getElementById('profile-review');
  if (btn) {
    if (wrong > 0) {
      btn.hidden = false;
      btn.textContent = lang === 'en' ? W.reviewBtn + ' (' + wrong + ')' : W.reviewBtn + '（' + wrong + '）';
      btn.href = 'quiz.html#review';
    } else {
      btn.hidden = true;
    }
  }
}

/* ---------------------------------------------------------
 * ② 顶栏分区高亮（滚动到哪个分区，哪个导航项变实心）
 * ------------------------------------------------------- */
function initScrollSpy() {
  const links = [...document.querySelectorAll('.topnav a[href^="#"]')];
  const targets = links
    .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);
  if (!targets.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => {
        a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id);
      });
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  targets.forEach((t) => io.observe(t));
}

/* ---------------------------------------------------------
 * 启动
 * ------------------------------------------------------- */
fillCards();
fillHero();
fillSummary();
renderProfile();
initScrollSpy();
