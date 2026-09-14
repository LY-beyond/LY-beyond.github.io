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
  const items = ['A', 'B', 'C', 'D'];
  const boxes = items.map((t, i) => `<div class="box d${i + 1}">${t}</div>`).join('');

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Layout mode
          <select class="js-mode">
            <option value="block">Block — one per row</option>
            <option value="inline-block" selected>Inline-block — side by side, wraps when full</option>
            <option value="flex">Flex — side by side, never wraps</option>
          </select>
        </label>
        <label class="demo-control">Container width
          <input type="range" min="220" max="620" value="420" data-ctl="w">
          <span class="val" data-out="w">420px</span>
        </label>
      </div>

      <div class="demo-stage" style="min-height:170px;overflow-x:auto;">
        <div class="js-flow" style="width:420px;padding:10px;background:var(--c-surface);border:1px dashed var(--c-border-2);border-radius:var(--radius-sm);">
          ${boxes}
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const q = sel => mount.querySelector(sel);
  const flow  = q('.js-flow');
  const mode  = q('.js-mode');
  const width = q('[data-ctl="w"]');
  const note  = q('.js-note');
  const code  = q('.js-code');

  const NOTES = {
    block: '→ Block boxes each take a whole row: however wide the container gets, one box per row, stretched to fill it.',
    'inline-block': '→ Inline-level boxes sit side by side and wrap when the row runs out — drag the container narrower to see it.',
    flex: '→ A flex container does not wrap by default: as it narrows, the items get squeezed instead of wrapping (that is Chapter 6).',
  };

  const CODES = {
    block: `.box { display: block; margin-bottom: 8px; }          /* one per row, fills the width */`,
    'inline-block': `.box { display: inline-block; margin: 0 8px 8px 0; }   /* side by side, wraps when full */`,
    flex: `.flow { display: flex; }                            /* the container never wraps */\n.box  { flex: 1 1 0; }                            /* items split the space, squeezed */`,
  };

  function update() {
    const v = mode.value;
    const w = +width.value;

    q('[data-out="w"]').textContent = w + 'px';
    flow.style.width   = w + 'px';
    flow.style.display = v === 'flex' ? 'flex' : 'block';

    flow.querySelectorAll('.box').forEach(b => {
      // .box ships with display:grid (to centre the letter), so map the three modes to:
      //   block      → display: block
      //   inline     → display: inline-block
      //   flex child → keep grid, let flex:1 split and squeeze it
      b.style.display    = v === 'flex' ? '' : v;
      b.style.flex       = v === 'flex' ? '1 1 0' : '';
      b.style.minWidth   = v === 'flex' ? '0' : '';
      b.style.textAlign  = 'center';
      b.style.lineHeight = '30px';
      b.style.margin     = v === 'block' ? '0 0 8px 0' : '0 8px 8px 0';
    });

    note.textContent = NOTES[v];
    code.textContent = CODES[v];
  }

  mode.addEventListener('change', update);
  width.addEventListener('input', update);
  update();
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
