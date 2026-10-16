// =========================================================
// lesson-core.js —— 章节页共用的阅读引擎（vis4 版）
// ---------------------------------------------------------
// 每个章节的 lesson.js 只需要做两件事：
//   1) 用 window.DEMOS['d-x-y'] = fn 注册本章的演示
//   2) 最后调用 initLesson('第 x 章')
//
// 与旧站（vis/lesson-core.js）的关键区别：
//   旧：一次只显示一个小节（.chapter 互斥），三 Tab 来回切
//   新：**全章连续滚动**，每个小节固定六段（原案例/理论/代码/演示/小结/自测）
//       代码就地折叠 <details>、演示就地懒渲染，另给「只看代码」快速复习开关。
//
// 本文件集中实现：演示注入 / 小节导航 / 目录高亮 / 进度条 / 只看代码 / 自测
// =========================================================

import { initLessonPath } from './lesson-path.js';
import { markSection, isSection, markGoal, getGoals, chapterProgress } from './progress.js';

/* ---------------------------------------------------------
 * 1) 演示注入（懒渲染）
 *   页面上放 <div class="demo-mount" data-demo="d-1-1"></div>
 *   JS 用 window.DEMOS['d-1-1'](mount) 渲染，只渲染一次
 * ------------------------------------------------------- */
export function renderDemo(mount) {
  if (!mount || mount.dataset.rendered) return;
  const name = mount.dataset.demo;
  if (!name) return;
  const fn = (window.DEMOS || {})[name];
  if (typeof fn === 'function') {
    try {
      fn(mount);
      mount.dataset.rendered = '1';
    } catch (err) {
      mount.dataset.rendered = '1';
      mount.innerHTML = '<p class="demo-note">演示加载失败：' + (err && err.message || err) + '</p>';
      console.error('[demo] ' + name, err);
    }
  }
}

// 视口内的演示才渲染：首屏只跑可见的 1~2 个，长章节打开不卡
export function renderAllDemos() {
  const mounts = [...document.querySelectorAll('.demo-mount')];
  if (!mounts.length) return;
  if (!('IntersectionObserver' in window)) { mounts.forEach(renderDemo); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      renderDemo(en.target);
      io.unobserve(en.target);          // 渲染过就不再观察
    });
  }, { rootMargin: '160px 0px' });
  mounts.forEach((m) => io.observe(m));
  // 兜底：页面已可见但仍未触发的（如锚点直达）
  setTimeout(() => mounts.forEach((m) => { if (!m.dataset.rendered) renderDemo(m); }), 2200);
}

/* ---------------------------------------------------------
 * 2) 小节导航：点目录平滑滚动 + 视口反向高亮 + 写入进度
 * ------------------------------------------------------- */
function sections() {
  return [...document.querySelectorAll('.chapter')];
}

export function activateSection(id, opts = {}) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  if (opts.scroll !== false) {
    el.scrollIntoView({ behavior: opts.instant ? 'auto' : 'smooth', block: 'start' });
  }
  setCurrent(id);
}

function setCurrent(id) {
  sections().forEach((s) => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('.chapter-nav a[data-chapter]').forEach((a) => {
    a.classList.toggle('active', a.dataset.chapter === id);
  });
}

function initSectionNav(context) {
  document.querySelectorAll('.chapter-nav a[data-chapter]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.dataset.chapter;
      if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
      activateSection(id);
    });
    // 目录里的「已完成」勾自动恢复
    if (isSection(context.lesson, a.dataset.chapter)) a.classList.add('is-done');
  });

  const list = sections();
  if (!list.length) return;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        setCurrent(id);
        // 读到这一节 3/4 高度以上，即记「已读」
        if (en.intersectionRatio > 0.25) {
          markSection(context.lesson, id);
          const link = document.querySelector('.chapter-nav a[data-chapter="' + id + '"]');
          if (link) link.classList.add('is-done');
          renderProgress(context);
        }
      });
    }, { rootMargin: '-96px 0px -46% 0px', threshold: [0, .25, .5, .75] });
    list.forEach((s) => io.observe(s));
  } else {
    setCurrent(list[0].id);
  }
}

/* ---------------------------------------------------------
 * 3) 学习目标勾选（章首清单 → localStorage）
 * ------------------------------------------------------- */
function initGoals(context) {
  const box = document.querySelector('.learn-goals');
  if (!box) return;
  const saved = getGoals(context.lesson);
  box.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
    if (saved[i]) cb.checked = true;
    cb.addEventListener('change', () => {
      const vals = [...box.querySelectorAll('input[type="checkbox"]')].map((x) => x.checked);
      markGoal(context.lesson, vals);
    });
  });
}

/* ---------------------------------------------------------
 * 4) 本章进度条（左侧目录顶部）
 * ------------------------------------------------------- */
function renderProgress(context) {
  const ids = sections().map((s) => s.id);
  const { done, total } = chapterProgress(context.lesson, ids);
  const fill = document.querySelector('.chapter-progress__fill');
  const text = document.querySelector('.chapter-progress__text');
  if (fill) fill.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  if (text) text.innerHTML = '<span>' + done + ' / ' + total + ' 小节</span><span>' + (total ? Math.round(done / total * 100) : 0) + '%</span>';
}

/* ---------------------------------------------------------
 * 5) 「只看代码」快速复习开关
 * ------------------------------------------------------- */
function initCodeOnly() {
  const btn = document.querySelector('.code-only-toggle');
  if (!btn) return;
  const root = document.documentElement;
  const sync = () => btn.setAttribute('aria-pressed', root.classList.contains('code-only') ? 'true' : 'false');
  sync();
  btn.addEventListener('click', () => {
    root.classList.toggle('code-only');
    sync();
  });
}

/* ---------------------------------------------------------
 * 6) 自测（即时判分，无需联网、不跳页）
 *   结构：
 *   <div class="selftest" data-selftest data-answer="b">
 *     .selftest__q  题干
 *     .selftest__opts > li > label.selftest__opt > input[radio][value] + span
 *     .selftest__actions > button.selftest__btn + span.selftest__verdict
 *     .selftest__why（解析，默认 hidden）
 *   </div>
 * ------------------------------------------------------- */
function initSelfTest() {
  document.querySelectorAll('[data-selftest]').forEach((box) => {
    const answer = box.dataset.answer;
    const btn = box.querySelector('.selftest__btn');
    const verdict = box.querySelector('.selftest__verdict');
    const why = box.querySelector('.selftest__why');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const picked = box.querySelector('input[type="radio"]:checked');
      if (verdict) {
        if (!picked) {
          verdict.className = 'selftest__verdict is-no';
          verdict.textContent = '请先选择一个答案';
          return;
        }
        const ok = picked.value === answer;
        verdict.className = 'selftest__verdict ' + (ok ? 'is-ok' : 'is-no');
        verdict.textContent = ok ? '✅ 回答正确' : '❌ 再想想，正确答案是 ' + answer.toUpperCase();
        box.querySelectorAll('.selftest__opt').forEach((lbl) => {
          const input = lbl.querySelector('input');
          lbl.classList.toggle('is-right', input.value === answer);
          lbl.classList.toggle('is-wrong', !ok && input.checked && input.value !== answer);
        });
        if (why) why.hidden = false;
      }
    });
  });
}

/* ---------------------------------------------------------
 * 7) 顶栏当前章节高亮（data-current="1" 表示第 1 章）
 * ------------------------------------------------------- */
function highlightCurrentTab() {
  const bar = document.querySelector('.course-topbar');
  if (!bar) return;
  const cur = parseInt(bar.dataset.current, 10);
  const links = bar.querySelectorAll('.tabs a');
  if (cur >= 1 && cur <= links.length) links[cur - 1].classList.add('current');
}

/* ---------------------------------------------------------
 * 8) 统一启动入口（必须在所有 window.DEMOS 注册之后调用）
 * ------------------------------------------------------- */
export function initLesson(label, opts = {}) {
  const context = { lesson: opts.lesson || label || 'lesson' };

  highlightCurrentTab();
  initSectionNav(context);
  initGoals(context);
  initCodeOnly();
  initSelfTest();
  initLessonPath();          // 章节头下方的「小节流动路径带」（读左侧目录自动生成）
  renderProgress(context);
  renderAllDemos();

  // 首次进入带 hash：直达该小节（即时跳，避免从顶部滚一大段）
  const hash = location.hash.replace(/^#/, '');
  if (hash && document.getElementById(hash)) {
    // 用 setTimeout 而非 requestAnimationFrame：后台标签页 / 无头浏览器下更可靠
    window.setTimeout(() => activateSection(hash, { instant: true }), 0);
  } else {
    const first = sections()[0];
    if (first) setCurrent(first.id);
  }

  console.log('[' + context.lesson + '] 已就绪 · demo 数:',
    Object.keys(window.DEMOS || {}).length);
}
