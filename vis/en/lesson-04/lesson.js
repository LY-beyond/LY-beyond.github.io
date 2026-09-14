// =========================================================
// lesson-04/lesson.js —— Chapter 4: Choosing a Layout Pattern
//   Demos: d-4-1 holy grail layout / d-4-2 card wall / d-4-3 dashboard grid
// =========================================================

import { initLesson } from '../../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * Demo 4.1 — holy grail layout variants
 * ------------------------------------------------------- */
window.DEMOS['d-4-1'] = function (mount) {
  const VARIANTS = {
    'Classic three-column': {
      cols: '80px 1fr 70px',
      areas: ['header header header', 'left main right', 'footer footer footer'],
    },
    'No right sidebar': {
      cols: '80px 1fr',
      areas: ['header header', 'left main', 'footer footer'],
    },
    'Single-column stack': {
      cols: '1fr',
      areas: ['header', 'left', 'main', 'right', 'footer'],
    },
  };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Layout variant
          <select class="js-v">
            ${Object.keys(VARIANTS).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="js-stage"
           style="display:grid;gap:8px;padding:10px;background:var(--c-surface-2);border-radius:8px;min-height:230px;font-size:12px;font-weight:700;">
        <div style="grid-area:header;background:var(--d1);color:#fff;padding:10px;border-radius:6px;">header</div>
        <div style="grid-area:left;background:var(--d2);color:#fff;padding:10px;border-radius:6px;">left<br>sidebar</div>
        <div style="grid-area:main;background:var(--d3);color:#fff;padding:10px;border-radius:6px;">main</div>
        <div style="grid-area:right;background:var(--d5);color:#fff;padding:10px;border-radius:6px;">right<br>sidebar</div>
        <div style="grid-area:footer;background:var(--d4);color:#fff;padding:10px;border-radius:6px;">footer</div>
      </div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-v');
  const code  = mount.querySelector('.js-code');

  function update() {
    const v = VARIANTS[sel.value];
    const areasCss = v.areas.map(a => `"${a}"`).join(' ');

    stage.style.gridTemplateColumns = v.cols;
    stage.style.gridTemplateAreas   = areasCss;

    code.textContent =
`.layout {
  display: grid;
  grid-template-columns: ${v.cols};
  grid-template-areas:
${v.areas.map(a => `    "${a}"`).join('\n')};
}`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 4.2 — the card wall
 * ------------------------------------------------------- */
window.DEMOS['d-4-2'] = function (mount) {
  const N = 9;

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Minimum column width
          <input type="range" min="120" max="320" value="200" data-c="min">
          <span class="val" data-out="min">200</span>
        </label>
        <label class="demo-control">Gap
          <input type="range" min="4" max="40" value="20" data-c="gap">
          <span class="val" data-out="gap">20</span>
        </label>
      </div>

      <div class="js-stage" style="display:grid;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = Array.from({ length: N }, (_, i) => `
    <div style="padding:16px;border-radius:8px;background:var(--c-surface);border:1px solid var(--c-border);font-size:12.5px;font-weight:700;color:var(--c-primary);">
      Card ${i + 1}
    </div>`).join('');

  function update() {
    const min = +mount.querySelector('[data-c="min"]').value;
    const gap = +mount.querySelector('[data-c="gap"]').value;

    mount.querySelector('[data-out="min"]').textContent = min;
    mount.querySelector('[data-out="gap"]').textContent = gap;

    stage.style.gridTemplateColumns = `repeat(auto-fit, minmax(${min}px, 1fr))`;
    stage.style.gap = gap + 'px';

    code.textContent =
`.wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${min}px, 1fr));
  gap: ${gap}px;
}`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Demo 4.3 — the dashboard grid
 * ------------------------------------------------------- */
window.DEMOS['d-4-3'] = function (mount) {
  const MODULES = ['Metric A', 'Metric B', 'Metric C', 'Trend chart', 'Distribution chart', 'Detail table'];

  const PRESETS = {
    'Standard (4 columns)':     { cols: 4, spans: [1, 1, 1, 1, 2, 2] },
    'Chart-first (4 columns)': { cols: 4, spans: [2, 2, 4, 4, 2, 2] },
    'Narrow stack (2 columns)': { cols: 2, spans: [1, 1, 2, 2, 2, 2] },
  };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Layout preset
          <select class="js-p">
            ${Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="js-stage" style="display:grid;gap:10px;min-height:230px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-p');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = MODULES.map((m, i) => `
    <div data-i="${i}"
         style="padding:16px;border-radius:8px;background:var(--d${(i % 6) + 1});color:#fff;
                font-weight:700;font-size:12.5px;display:grid;place-items:center;min-height:54px;">
      ${m}
    </div>`).join('');

  function update() {
    const p = PRESETS[sel.value];

    stage.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;
    stage.querySelectorAll('[data-i]').forEach((el, i) => {
      el.style.gridColumn = `span ${p.spans[i]}`;
    });

    code.textContent =
`.dashboard {
  display: grid;
  grid-template-columns: repeat(${p.cols}, 1fr);
  gap: 10px;
}
/* Module spans: ${p.spans.map((s, i) => `module ${i + 1} = span ${s}`).join(', ')} */`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Bootstrap
 * ------------------------------------------------------- */
initLesson('lesson-04');
