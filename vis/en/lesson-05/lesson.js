// =========================================================
// lesson-05/lesson.js —— Chapter 5: Box Model and Document Flow
//   Shared interactions (tabs / outline / demo injection) live in ../../lesson-core.js
//   This file only registers this chapter's demos: d-5-1 / d-5-2 / d-5-3
// =========================================================

import { initLesson } from '../../lesson-core.js';

/* ---------------------------------------------------------
 * Demo registry: demos register themselves via window.DEMOS['d-x-y'] = fn
 * ------------------------------------------------------- */
window.DEMOS = window.DEMOS || {};

/* =========================================================
 * Demo implementations (each demo receives a mount element and renders itself)
 * ======================================================= */

/* ---------------------------------------------------------
 * Demo 5.1 — the box model
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
        🔴 red dashed = margin　🟢 teal = border　🟡 yellow = padding　🟣 purple = content
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

    marginBox.style.padding  = mar + 'px';   // red area = margin
    borderBox.style.padding  = bor + 'px';   // teal area = border
    paddingBox.style.padding = pad + 'px';   // yellow area = padding

    code.textContent =
`.card {
  padding: ${pad}px;
  border: ${bor}px solid;
  margin: ${mar}px;
}
/* content width 120px, so the box actually occupies
   = 120 + ${pad * 2} + ${bor * 2} + ${mar * 2}
   = ${120 + pad * 2 + bor * 2 + mar * 2}px */`;
  }

  mount.querySelectorAll('[data-ctl]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Demo 5.2 — document flow: block vs inline-block
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
            Block <code>display:block</code> — stacks vertically
          </p>
          <div class="demo-stage" style="min-height:160px;">
            ${boxes('display:block;width:100%;margin-bottom:8px;')}
          </div>
        </div>
        <div>
          <p style="margin:0 0 8px;font-weight:700;font-size:14px;color:var(--c-text-soft);">
            Inline-block <code>display:inline-block</code> — flows horizontally
          </p>
          <div class="demo-stage" style="min-height:160px;">
            ${boxes('display:inline-block;margin:0 6px 6px 0;')}
          </div>
        </div>
      </div>

      <p class="key-point" style="margin-top:16px;">
        <strong>⭐ Observe</strong>: the same set of boxes, with only <code>display</code> changed,
        behave completely differently — block boxes each take a row and pile up, while inline-blocks crowd onto a single row.
        The right-hand side uses <code>inline-block</code> rather than <code>inline</code>
        because <code>inline</code> cannot take a width or height — the box shrinks to fit its content.
      </p>
    </div>`;
};

/* ---------------------------------------------------------
 * Demo 5.3 — switching display, and two ways to hide an element
 * ------------------------------------------------------- */
window.DEMOS['d-5-3'] = function (mount) {
  const boxes = ['A', 'B', 'C']
    .map((t, i) => `<div class="box d${i + 1}" style="margin:0 0 8px 0;">${t}</div>`)
    .join('');

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Set the boxes to
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
      code.textContent = '.box { display: none; }        /* gone entirely; later elements move up to fill the gap */';
    } else if (v === 'hidden') {
      code.textContent = '.box { visibility: hidden; }   /* invisible, but still holds its original space */';
    } else {
      code.textContent = `.box { display: ${v}; }`;
    }
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Bootstrap (must come after every demo has been registered)
 * ------------------------------------------------------- */
initLesson('lesson-05');
