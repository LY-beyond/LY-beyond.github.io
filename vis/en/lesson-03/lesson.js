// =========================================================
// lesson-03/lesson.js —— Chapter 3: Grid Systems and Spacing Rhythm
//   Demos: d-3-1 the 12-column grid / d-3-2 the 8pt scale / d-3-3 alignment check
// =========================================================

import { initLesson } from '../../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * Demo 3.1 — the 12-column grid
 * ------------------------------------------------------- */
window.DEMOS['d-3-1'] = function (mount) {
  const BLOCKS = [
    { name: 'Main content', span: 8,  color: 'var(--c-primary)' },
    { name: 'Sidebar',     span: 4,  color: 'var(--d2)' },
    { name: 'Full-width banner', span: 12, color: 'var(--d3)' },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls js-c"></div>

      <div class="demo-stage js-stage"
           style="position:relative;display:grid;grid-template-columns:repeat(12,1fr);gap:8px;background:var(--c-surface);padding:0;">
        <div class="js-guides"
             style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);gap:8px;pointer-events:none;"></div>
      </div>

      <pre class="demo-code js-code"></pre>
    </div>`;

  const wrap   = mount.querySelector('.js-c');
  const stage  = mount.querySelector('.js-stage');
  const guides = mount.querySelector('.js-guides');
  const code   = mount.querySelector('.js-code');

  guides.innerHTML = Array.from({ length: 12 }, () =>
    `<div style="background:rgba(15,118,110,.10);border-radius:3px;"></div>`).join('');

  wrap.innerHTML = BLOCKS.map((b, i) => `
    <label class="demo-control">${b.name}
      <input type="range" min="1" max="12" value="${b.span}" data-b="${i}">
      <span class="val" data-out="${i}">${b.span}</span>
    </label>`).join('');

  stage.insertAdjacentHTML('beforeend', BLOCKS.map((b, i) => `
    <div class="js-blk" data-i="${i}"
         style="position:relative;z-index:1;grid-column:span ${b.span};background:${b.color};color:#fff;
                border-radius:8px;padding:14px;font-size:13px;font-weight:700;text-align:center;">
      ${b.name}
    </div>`).join(''));

  function update() {
    const spans = [...mount.querySelectorAll('[data-b]')].map(i => +i.value);

    spans.forEach((s, i) => {
      mount.querySelector(`[data-out="${i}"]`).textContent = s;
      mount.querySelector(`.js-blk[data-i="${i}"]`).style.gridColumn = `span ${s}`;
    });

    code.textContent =
`.grid-12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; }

${BLOCKS.map((b, i) => `.col-${spans[i]} { grid-column: span ${spans[i]}; }`).join('\n')}`;
  }

  mount.querySelectorAll('[data-b]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Demo 3.2 — made-up values vs the 8pt scale
 * ------------------------------------------------------- */
window.DEMOS['d-3-2'] = function (mount) {
  // The same content, two different spacing systems
  const RANDOM  = { pad: 13, gapIn: 7,  gapOut: 19, titleGap: 11, pad2: 23, gapIn2: 9,  gapOut2: 17 };
  const SCALE   = { pad: 16, gapIn: 8,  gapOut: 24, titleGap: 8,  pad2: 24, gapIn2: 8,  gapOut2: 16 };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Spacing scheme
          <select class="js-mode">
            <option value="rand">Made-up values (13 / 7 / 19 …)</option>
            <option value="scale">8pt scale (8 / 16 / 24)</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const code  = mount.querySelector('.js-code');

  function update() {
    const isRand = sel.value === 'rand';
    const S = isRand ? RANDOM : SCALE;

    stage.innerHTML = `
      <div style="margin-bottom:${S.gapOut}px;">
        <div style="padding:${S.pad}px;background:var(--c-primary);color:#fff;border-radius:8px;font-weight:700;font-size:14px;">
          First group
        </div>
        <div style="display:flex;flex-direction:column;gap:${S.gapIn}px;margin-top:${S.titleGap}px;">
          <div style="padding:${S.pad}px;background:var(--c-surface-2);border-radius:8px;font-size:13px;">Item A</div>
          <div style="padding:${S.pad}px;background:var(--c-surface-2);border-radius:8px;font-size:13px;">Item B</div>
        </div>
      </div>

      <div style="margin-bottom:${S.gapOut2}px;">
        <div style="padding:${S.pad2}px;background:var(--c-primary-weak);color:var(--c-primary);border-radius:8px;font-weight:700;font-size:14px;">
          Second group
        </div>
        <div style="display:flex;flex-direction:column;gap:${S.gapIn2}px;margin-top:${S.titleGap}px;">
          <div style="padding:${S.pad2}px;background:var(--c-surface-2);border-radius:8px;font-size:13px;">Item C</div>
        </div>
      </div>`;

    code.textContent = isRand
      ? `/* Made-up values: no two numbers belong to a system */
padding: 13px;   gap: 7px;    margin: 19px;
padding: 23px;   gap: 9px;    margin: 17px;   /* the rhythm is broken */`
      : `/* 8pt scale: every value comes from the same set of steps */
padding: 16px;   gap: 8px;    margin: 24px;
padding: 24px;   gap: 8px;    margin: 16px;   /* tidy and reusable */`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 3.3 — checking alignment with a grid overlay
 * ------------------------------------------------------- */
window.DEMOS['d-3-3'] = function (mount) {
  const MODES = {
    ok:  { head: 12, cards: [4, 4, 4], jitter: [0, 0, 0], pads: [14, 14, 14] },
    bad: { head: 11, cards: [4, 4, 3], jitter: [0, 10, 0], pads: [14, 18, 14] },
  };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">State
          <select class="js-mode">
            <option value="ok">Aligned to the grid</option>
            <option value="bad">Off-grid (the usual suspects)</option>
          </select>
        </label>
        <label class="demo-control">
          <input type="checkbox" class="js-overlay" checked> Show the grid overlay
        </label>
      </div>

      <div class="demo-stage js-stage"
           style="position:relative;background:var(--c-surface);padding:0;overflow:hidden;">
        <div class="js-guides"
             style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);
                    gap:8px;padding:12px;box-sizing:border-box;pointer-events:none;"></div>
        <div class="js-content"
             style="position:relative;z-index:1;padding:12px;display:grid;
                    grid-template-columns:repeat(12,1fr);gap:8px;"></div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;"></p>
    </div>`;

  const guides  = mount.querySelector('.js-guides');
  const content = mount.querySelector('.js-content');
  const sel     = mount.querySelector('.js-mode');
  const over    = mount.querySelector('.js-overlay');
  const note    = mount.querySelector('.js-note');

  guides.innerHTML = Array.from({ length: 12 }, () =>
    `<div style="background:rgba(15,118,110,.10);border-radius:3px;"></div>`).join('');

  function update() {
    const m = MODES[sel.value];

    content.innerHTML = `
      <div style="grid-column:span ${m.head};background:var(--c-primary);color:#fff;border-radius:8px;
                  padding:12px;font-size:13px;font-weight:700;text-align:center;">Header</div>
      ${m.cards.map((c, i) => `
        <div style="grid-column:span ${c};margin-left:${m.jitter[i]}px;padding:${m.pads[i]}px;
                    background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:8px;
                    font-size:12.5px;text-align:center;">Card ${i + 1}</div>`).join('')}`;

    guides.style.display = over.checked ? 'grid' : 'none';

    if (sel.value === 'ok') {
      note.textContent = '→ Every element sits on the column lines: left edges flush, right edges flush, spacing consistent ✔';
      note.style.color = 'var(--c-success)';
    } else {
      note.textContent = '→ With the grid switched on it is obvious at a glance: the header is one column short, the second card is offset, and the third card is too narrow ✘';
      note.style.color = 'var(--c-danger)';
    }
  }

  sel.addEventListener('change', update);
  over.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Bootstrap
 * ------------------------------------------------------- */
initLesson('lesson-03');
