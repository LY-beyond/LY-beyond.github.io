// =========================================================
// lesson-06/lesson.js —— 第 6 章 Flexbox 弹性布局
//   演示：d-6-1 主轴方向 / d-6-2 对齐分布 / d-6-3 弹性伸缩
// =========================================================

import { initLesson } from '../lesson-core.js';

window.DEMOS = window.DEMOS || {};

const ITEMS = ['A', 'B', 'C'];

/* ---------------------------------------------------------
 * 演示 2.1 —— 主轴与交叉轴
 * ------------------------------------------------------- */
window.DEMOS['d-6-1'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">flex-direction
          <select class="js-dir">
            <option>row</option>
            <option>row-reverse</option>
            <option>column</option>
            <option>column-reverse</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="display:flex;gap:10px;min-height:150px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-dir');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = ITEMS
    .map((t, i) => `<div class="box d${i + 1}">${t}</div>`)
    .join('');

  function update() {
    const v = sel.value;
    stage.style.flexDirection = v;
    code.textContent =
`.container {
  display: flex;
  flex-direction: ${v};
}`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 2.2 —— justify-content / align-items
 * ------------------------------------------------------- */
window.DEMOS['d-6-2'] = function (mount) {
  const jc = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
  const ai = ['stretch', 'flex-start', 'center', 'flex-end'];

  const opt = (list, cur) => list
    .map(v => `<option${v === cur ? ' selected' : ''}>${v}</option>`)
    .join('');

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">justify-content
          <select class="js-jc">${opt(jc, 'flex-start')}</select>
        </label>
        <label class="demo-control">align-items
          <select class="js-ai">${opt(ai, 'stretch')}</select>
        </label>
      </div>

      <div class="demo-stage js-stage"
           style="display:flex;gap:10px;height:170px;overflow:auto;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const selJc = mount.querySelector('.js-jc');
  const selAi = mount.querySelector('.js-ai');
  const code  = mount.querySelector('.js-code');

  // 给不同盒子不同的高度，方便观察 align-items
  stage.innerHTML = ITEMS
    .map((t, i) => `<div class="box d${i + 1}" style="height:${52 + i * 22}px;">${t}</div>`)
    .join('');

  function update() {
    stage.style.justifyContent = selJc.value;
    stage.style.alignItems     = selAi.value;
    code.textContent =
`.container {
  display: flex;
  justify-content: ${selJc.value};
  align-items: ${selAi.value};
}`;
  }

  selJc.addEventListener('change', update);
  selAi.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 2.3 —— 弹性伸缩（flex-grow）
 * ------------------------------------------------------- */
window.DEMOS['d-6-3'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">A grow
          <input type="range" min="0" max="5" value="1" data-g="0">
          <span class="val" data-out="0">1</span>
        </label>
        <label class="demo-control">B grow
          <input type="range" min="0" max="5" value="2" data-g="1">
          <span class="val" data-out="1">2</span>
        </label>
        <label class="demo-control">C grow
          <input type="range" min="0" max="5" value="3" data-g="2">
          <span class="val" data-out="2">3</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="display:flex;gap:10px;min-height:110px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = ITEMS
    .map((t, i) => `<div class="box d${i + 1}" data-i="${i}">${t}</div>`)
    .join('');

  function update() {
    const grows = [...mount.querySelectorAll('[data-g]')].map(i => +i.value);

    grows.forEach((g, i) => {
      mount.querySelector(`[data-out="${i}"]`).textContent = g;
      stage.querySelector(`[data-i="${i}"]`).style.flexGrow = g;
    });

    code.textContent =
`/* 剩余空间按 ${grows.join(' : ')} 的比例分配 */
.A { flex-grow: ${grows[0]}; }
.B { flex-grow: ${grows[1]}; }
.C { flex-grow: ${grows[2]}; }`;
  }

  mount.querySelectorAll('[data-g]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * 启动
 * ------------------------------------------------------- */
initLesson('lesson-06');
