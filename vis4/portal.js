// =========================================================
// portal.js —— 门户首页交互（进度回填 / 顶栏高亮）
// ---------------------------------------------------------
// 只做两件「静态 HTML 做不到」的事：
//   ① 把 localStorage 里的学习进度回填到 Hero 按钮、章节卡片与汇总条
//   ② 滚动时高亮顶栏对应分区
// 说明：本文件是 ES Module，用 file:// 打开时会被浏览器 CORS 拦截，
//       页面不使用进度功能也能正常阅读 —— 属于刻意设计的降级。
// =========================================================

import { lessonDone, resetAll } from './progress.js';

/* 章节元数据（中英各一份标签，供 en/ 镜像复用同一脚本） */
const LESSONS = [
  { id: 'lesson-01', total: 5, zh: '第 1 章 数据',            en: 'Ch.1 Data' },
  { id: 'lesson-02', total: 4, zh: '第 2 章 数据可视化流程',  en: 'Ch.2 Pipeline' },
  { id: 'lesson-03', total: 8, zh: '第 3 章 色彩专题',        en: 'Ch.3 Color' },
  { id: 'lesson-04', total: 5, zh: '第 4 章 低维数据可视化',  en: 'Ch.4 Low-dim' },
  { id: 'lesson-05', total: 5, zh: '第 5 章 时序数据可视化',  en: 'Ch.5 Temporal' }
];

const WORD = {
  zh: { cont: '继续学习', restart: '重头开始', read: '已读', unit: '小节', reset: '重置学习进度', confirm: '确定清空全部学习进度吗？此操作不可撤销。' },
  en: { cont: 'Continue', restart: 'Start over', read: 'Read', unit: 'sections', reset: 'Reset progress', confirm: 'Clear all learning progress? This cannot be undone.' }
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
    });
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
initScrollSpy();
