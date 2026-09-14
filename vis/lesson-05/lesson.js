// =========================================================
// lesson-05/lesson.js —— 第 5 章 盒模型与文档流
//   公共交互逻辑（Tab / 导航 / Demo 注入）在 ../lesson-core.js
//   本文件只负责注册本章的演示：d-5-1 / d-5-2 / d-5-3
// =========================================================

import { initLesson } from '../lesson-core.js';

/* ---------------------------------------------------------
 * Demo 注册表：后续演示通过 window.DEMOS['d-x-y'] = fn 注册
 * ------------------------------------------------------- */
window.DEMOS = window.DEMOS || {};

/* =========================================================
 * 演示实现（每个 demo 接收 mount 元素，自行渲染内容）
 * ======================================================= */

/* ---------------------------------------------------------
 * 演示 1.1 —— 盒模型
 * ------------------------------------------------------- */
window.DEMOS['d-5-1'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">padding
          <input type="range" min="0" max="40" value="16" data-ctl="padding">
          <span class="val" data-out="padding">16px</span>
        </label>
        <label class="demo-control">border
          <input type="range" min="0" max="16" value="6" data-ctl="border">
          <span class="val" data-out="border">6px</span>
        </label>
        <label class="demo-control">margin
          <input type="range" min="0" max="40" value="20" data-ctl="margin">
          <span class="val" data-out="margin">20px</span>
        </label>
      </div>

      <div class="demo-stage" style="display:grid;place-items:center;min-height:250px;">
        <div class="js-margin" style="background:rgba(239,68,68,.12);border:2px dashed var(--d4);">
          <div class="js-border" style="background:var(--c-primary);">
            <div class="js-padding" style="background:#fde68a;">
              <div class="js-content" style="width:120px;height:70px;display:grid;place-items:center;background:var(--d5);color:#fff;font-weight:700;font-size:13px;">content</div>
            </div>
          </div>
        </div>
      </div>

      <p style="margin:14px 0 0;font-size:12.5px;color:var(--c-text-soft);">
        🔴 红色虚线 = margin　🟢 青绿 = border　🟡 黄色 = padding　🟣 紫色 = content
      </p>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const q = sel => mount.querySelector(sel);
  const marginBox  = q('.js-margin');
  const borderBox  = q('.js-border');
  const paddingBox = q('.js-padding');
  const code       = q('.js-code');

  function update() {
    const pad = +q('[data-ctl="padding"]').value;
    const bor = +q('[data-ctl="border"]').value;
    const mar = +q('[data-ctl="margin"]').value;

    q('[data-out="padding"]').textContent = pad + 'px';
    q('[data-out="border"]').textContent  = bor + 'px';
    q('[data-out="margin"]').textContent  = mar + 'px';

    marginBox.style.padding  = mar + 'px';   // 红色区域 = margin
    borderBox.style.padding  = bor + 'px';   // 青绿区域 = border
    paddingBox.style.padding = pad + 'px';   // 黄色区域 = padding

    code.textContent =
`.card {
  padding: ${pad}px;
  border: ${bor}px solid;
  margin: ${mar}px;
}
/* 内容宽 120px，盒子实际占宽
   = 120 + ${pad * 2} + ${bor * 2} + ${mar * 2}
   = ${120 + pad * 2 + bor * 2 + mar * 2}px */`;
  }

  mount.querySelectorAll('[data-ctl]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * 演示 1.2 —— 文档流：块级 vs 行内块
 * ------------------------------------------------------- */
window.DEMOS['d-5-2'] = function (mount) {
  const items = ['A', 'B', 'C'];
  const boxes = css => items
    .map((t, i) => `<div class="box d${i + 1}" style="${css}">${t}</div>`)
    .join('');

  mount.innerHTML = `
    <div class="demo-card">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
        <div>
          <p style="margin:0 0 8px;font-weight:700;font-size:14px;color:var(--c-text-soft);">
            块级 <code>display:block</code> —— 竖着排
          </p>
          <div class="demo-stage" style="min-height:160px;">
            ${boxes('display:block;width:100%;margin-bottom:8px;')}
          </div>
        </div>
        <div>
          <p style="margin:0 0 8px;font-weight:700;font-size:14px;color:var(--c-text-soft);">
            行内块 <code>display:inline-block</code> —— 横着排
          </p>
          <div class="demo-stage" style="min-height:160px;">
            ${boxes('display:inline-block;margin:0 6px 6px 0;')}
          </div>
        </div>
      </div>

      <p class="key-point" style="margin-top:16px;">
        <strong>⭐ 观察</strong>：同一组盒子，只改了 <code>display</code>，
        结果就完全不同——块级各占一行竖着摞，行内块挤在一行横着排。
        右边用 <code>inline-block</code> 而不是 <code>inline</code>，
        是因为 <code>inline</code> 无法设置宽高，盒子会缩成内容大小。
      </p>
    </div>`;
};

/* ---------------------------------------------------------
 * 演示 1.3 —— display 切换 + 两种隐藏方式对比
 * ------------------------------------------------------- */
window.DEMOS['d-5-3'] = function (mount) {
  const boxes = ['A', 'B', 'C']
    .map((t, i) => `<div class="box d${i + 1}" style="margin:0 0 8px 0;">${t}</div>`)
    .join('');

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">把盒子设为
          <select class="js-sel">
            <option>block</option>
            <option>inline</option>
            <option>inline-block</option>
            <option value="none">display: none</option>
            <option value="hidden">visibility: hidden</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="min-height:140px;">${boxes}</div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-sel');
  const code  = mount.querySelector('.js-code');

  function update() {
    const v = sel.value;

    stage.querySelectorAll('.box').forEach(b => {
      b.style.display    = '';
      b.style.visibility = '';
      if (v === 'none')        b.style.display = 'none';
      else if (v === 'hidden') b.style.visibility = 'hidden';
      else                     b.style.display = v;
    });

    if (v === 'none') {
      code.textContent = '.box { display: none; }        /* 完全消失，后面元素会补位上来 */';
    } else if (v === 'hidden') {
      code.textContent = '.box { visibility: hidden; }   /* 看不见，但仍然占着原来的位置 */';
    } else {
      code.textContent = `.box { display: ${v}; }`;
    }
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 启动（必须放在所有 demo 注册之后）
 * ------------------------------------------------------- */
initLesson('lesson-05');
