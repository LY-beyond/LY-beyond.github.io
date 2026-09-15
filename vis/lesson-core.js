// =========================================================
// lesson-core.js —— 所有章节页共用的交互引擎
// ---------------------------------------------------------
// 每个章节的 lesson.js 只需要做两件事：
//   1) 用 window.DEMOS['d-x-y'] = fn 注册本章的演示
//   2) 最后调用 initLesson()
//
// 本文件集中实现：Tab 切换 / 章节导航 / Demo 注入 / 顶栏高亮
// 修改这里，6 个章节同时生效
// =========================================================

/* ---------------------------------------------------------
 * Demo 注入引擎
 *   页面上放 <div class="demo-mount" data-demo="d-1-1"></div>
 *   JS 在需要时调用 window.DEMOS['d-1-1'](mount) 渲染
 * ------------------------------------------------------- */
export function renderDemo(mount) {
  if (!mount || mount.dataset.rendered) return;   // 只渲染一次
  const name = mount.dataset.demo;
  if (!name) return;
  const fn = (window.DEMOS || {})[name];
  if (typeof fn === 'function') {
    fn(mount);
    mount.dataset.rendered = '1';
  }
}

export function renderAllDemos() {
  document.querySelectorAll('.demo-mount').forEach(renderDemo);
}

/* ---------------------------------------------------------
 * 1) Tab 切换（讲解 / 代码 / 演示）
 * ------------------------------------------------------- */
export function bindTabs() {
  document.querySelectorAll('.chapter').forEach(chapter => {
    const btns   = chapter.querySelectorAll('.tab-btn');
    const panels = chapter.querySelectorAll('.tab-panel');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        btns.forEach(b   => b.classList.toggle('active', b === btn));
        panels.forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
        // 切到演示 tab 时才渲染对应 demo（懒加载）
        if (tab === 'demo') renderDemo(chapter.querySelector('.demo-mount'));
      });
    });
  });
}

/* ---------------------------------------------------------
 * 2) 左侧章节导航 + hash 锚点
 * ------------------------------------------------------- */
export function activateChapter(id) {
  if (!id) return;

  document.querySelectorAll('.chapter-nav a[data-chapter]').forEach(a => {
    a.classList.toggle('active', a.dataset.chapter === id);
  });

  document.querySelectorAll('.chapter').forEach(c => {
    c.classList.toggle('active', c.id === id);
  });

  // 保证该章节至少有一个 tab 处于激活状态
  const current = document.getElementById(id);
  if (current && !current.querySelector('.tab-panel.active')) {
    const first = current.querySelector('.tab-btn');
    if (first) first.click();
  }

  renderAllDemos();
}

export function bindNav() {
  document.querySelectorAll('.chapter-nav a[data-chapter]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.dataset.chapter;
      if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
      activateChapter(id);
    });
  });

  window.addEventListener('hashchange', () => {
    const id = location.hash.replace(/^#/, '');
    if (id) activateChapter(id);
  });
}

/* ---------------------------------------------------------
 * 3) 顶栏当前章节高亮（data-current="1" 表示第 1 章）
 * ------------------------------------------------------- */
export function highlightCurrentTab() {
  const bar = document.querySelector('.course-topbar');
  if (!bar) return;
  const cur   = parseInt(bar.dataset.current, 10);
  const links = bar.querySelectorAll('.tabs a');
  if (cur >= 1 && cur <= links.length) links[cur - 1].classList.add('current');
}

/* ---------------------------------------------------------
 * 4) 统一启动入口
 *    必须在所有 window.DEMOS 注册完成之后调用
 * ------------------------------------------------------- */
export function initLesson(label) {
  bindTabs();
  bindNav();
  highlightCurrentTab();

  const hash = location.hash.replace(/^#/, '');
  if (hash) activateChapter(hash);

  renderAllDemos();

  console.log(
    `[${label || 'lesson'}] 已就绪 · 已注册 demo:`,
    Object.keys(window.DEMOS || {}).length
  );
}
