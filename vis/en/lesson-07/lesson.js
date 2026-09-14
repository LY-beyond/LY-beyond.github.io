// =========================================================
// lesson-07/lesson.js —— Chapter 7: CSS Grid
//   Demos: d-7-1 grid basics / d-7-2 auto-fill / d-7-3 grid placement
// =========================================================

import { initLesson } from '../../lesson-core.js';

window.DEMOS = window.DEMOS || {};

const N = 8;   // number of cells used in the demo

const makeBoxes = (n) => Array
  .from({ length: n }, (_, i) => `<div class="box d${(i % 6) + 1}" style="min-height:52px;">${i + 1}</div>`)
  .join('');

/* ---------------------------------------------------------
 * Demo 7.1 — grid basics (column count + fr ratio)
 * ------------------------------------------------------- */
window.DEMOS['d-7-1'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Columns
          <input type="range" min="1" max="4" value="3" data-c="cols">
          <span class="val" data-out="cols">3</span>
        </label>
        <label class="demo-control">First column share
          <input type="range" min="1" max="4" value="2" data-c="first">
          <span class="val" data-out="first">2</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="display:grid;gap:10px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');
  stage.innerHTML = makeBoxes(N);

  function update() {
    const cols  = +mount.querySelector('[data-c="cols"]').value;
    const first = +mount.querySelector('[data-c="first"]').value;

    const track = [first, ...Array(cols - 1).fill(1)]
      .map(v => `${v}fr`)
      .join(' ');

    mount.querySelector('[data-out="cols"]').textContent  = cols;
    mount.querySelector('[data-out="first"]').textContent = first;

    stage.style.gridTemplateColumns = track;

    code.textContent =
`.grid {
  display: grid;
  grid-template-columns: ${track};
  gap: 10px;
}`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Demo 7.2 — auto-fill (auto-fit + minmax)
 * ------------------------------------------------------- */
window.DEMOS['d-7-2'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Container width
          <input type="range" min="220" max="720" value="680" data-c="w">
          <span class="val" data-out="w">680</span>
        </label>
        <label class="demo-control">Minimum column width
          <input type="range" min="80" max="260" value="160" data-c="m">
          <span class="val" data-out="m">160</span>
        </label>
      </div>

      <div class="js-wrap" style="overflow:auto;padding-bottom:6px;">
        <div class="demo-stage js-stage" style="display:grid;gap:10px;box-sizing:border-box;transition:width .15s;"></div>
      </div>

      <p class="js-info" style="margin:12px 0 0;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const wrap  = mount.querySelector('.js-wrap');
  const stage = mount.querySelector('.js-stage');
  const info  = mount.querySelector('.js-info');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = makeBoxes(N);

  function update() {
    const w = +mount.querySelector('[data-c="w"]').value;
    const m = +mount.querySelector('[data-c="m"]').value;

    mount.querySelector('[data-out="w"]').textContent = w;
    mount.querySelector('[data-out="m"]').textContent = m;

    stage.style.width = w + 'px';
    stage.style.gridTemplateColumns = `repeat(auto-fit, minmax(${m}px, 1fr))`;

    // work out the actual column count
    const cols = Math.max(1, Math.floor((w + 10) / (m + 10)));
    info.textContent = `→ currently auto-arranged into ${cols} columns`;

    code.textContent =
`.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${m}px, 1fr));
  gap: 10px;
}`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Demo 7.3 — grid placement (spanning columns / rows)
 * ------------------------------------------------------- */
window.DEMOS['d-7-3'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">A: columns spanned
          <input type="range" min="1" max="3" value="2" data-c="span">
          <span class="val" data-out="span">2</span>
        </label>
        <label class="demo-control">
          <input type="checkbox" data-c="row"> A also spans 2 rows
        </label>
      </div>

      <div class="demo-stage js-stage"
           style="display:grid;grid-template-columns:repeat(3, 1fr);grid-auto-rows:56px;gap:10px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = makeBoxes(7);

  function update() {
    const span = +mount.querySelector('[data-c="span"]').value;
    const rowSpan = mount.querySelector('[data-c="row"]').checked;
    const first = stage.querySelector('.box');

    first.style.gridColumn = `span ${span}`;
    first.style.gridRow    = rowSpan ? 'span 2' : 'auto';

    mount.querySelector('[data-out="span"]').textContent = span;

    code.textContent =
`.item-a {
  grid-column: span ${span};${rowSpan ? '\n  grid-row: span 2;' : ''}
}`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Bootstrap
 * ------------------------------------------------------- */
initLesson('lesson-07');
