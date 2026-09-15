// =========================================================
// lesson-08/lesson.js —— Chapter 8: Positioning, Stacking and Responsive Design
//   Demos: d-8-1 position / d-8-2 offsets / d-8-3 z-index
// =========================================================

import { initLesson } from '../../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * Demo 8.1 — does position leave the document flow?
 * ------------------------------------------------------- */
window.DEMOS['d-8-1'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">B's position
          <select class="js-pos">
            <option>static</option>
            <option>relative</option>
            <option>absolute</option>
          </select>
        </label>
        <span style="font-size:12.5px;color:var(--c-text-soft);">
          (relative / absolute also add top:24px; left:24px)
        </span>
      </div>

      <div class="demo-stage js-stage"
           style="position:relative;display:flex;gap:10px;align-items:flex-start;min-height:190px;padding:24px;">
        <div class="box d1">A</div>
        <div class="box d2 js-target">B</div>
        <div class="box d3">C</div>
      </div>

      <p class="js-info" style="margin:12px 0 0;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const target = mount.querySelector('.js-target');
  const sel    = mount.querySelector('.js-pos');
  const info   = mount.querySelector('.js-info');
  const code   = mount.querySelector('.js-code');

  function update() {
    const v = sel.value;

    target.style.position = v;
    if (v === 'static') {
      target.style.top  = '';
      target.style.left = '';
    } else {
      target.style.top  = '24px';
      target.style.left = '24px';
    }

    info.textContent = v === 'absolute'
      ? '→ B has left the document flow: A and C move up to close the gap, and B floats above them'
      : (v === 'relative'
        ? '→ B is only visually offset; its original slot is still held and A / C do not move'
        : '→ Default state: the three boxes sit one after another in normal flow');

    code.textContent =
`.b {
  position: ${v};${v === 'static' ? '' : '\n  top: 24px;\n  left: 24px;'}
}`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 8.2 — offsets (top / left)
 * ------------------------------------------------------- */
window.DEMOS['d-8-2'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Reference mode
          <select class="js-mode">
            <option value="absolute">absolute (relative to the parent container)</option>
            <option value="relative">relative (relative to its own original position)</option>
          </select>
        </label>
        <label class="demo-control">top
          <input type="range" min="-20" max="120" value="30" data-o="top">
          <span class="val" data-out="top">30px</span>
        </label>
        <label class="demo-control">left
          <input type="range" min="-20" max="160" value="40" data-o="left">
          <span class="val" data-out="left">40px</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="position:relative;min-height:200px;">
        <span style="position:absolute;top:0;left:0;font-size:11px;color:var(--c-muted);">Parent container (relative) — top-left corner</span>
        <div class="box d5 js-target" style="display:grid;place-items:center;">B</div>
      </div>

      <pre class="demo-code js-code"></pre>
    </div>`;

  const target = mount.querySelector('.js-target');
  const mode   = mount.querySelector('.js-mode');
  const code   = mount.querySelector('.js-code');

  function update() {
    const m   = mode.value;
    const top = +mount.querySelector('[data-o="top"]').value;
    const lft = +mount.querySelector('[data-o="left"]').value;

    mount.querySelector('[data-out="top"]').textContent  = top + 'px';
    mount.querySelector('[data-out="left"]').textContent = lft + 'px';

    target.style.position = m;
    target.style.top      = top + 'px';
    target.style.left     = lft + 'px';

    code.textContent =
`.b {
  position: ${m};
  top: ${top}px;
  left: ${lft}px;
}`;
  }

  mount.querySelectorAll('[data-o]').forEach(i => i.addEventListener('input', update));
  mode.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 8.3 — z-index stacking order
 * ------------------------------------------------------- */
window.DEMOS['d-8-3'] = function (mount) {
  const colors = ['d1', 'd3', 'd4'];
  const pos = [
    { left: 40,  top: 30 },
    { left: 90,  top: 60 },
    { left: 140, top: 90 },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        ${[0, 1, 2].map(i => `
          <label class="demo-control">${'ABC'[i]} z-index
            <input type="range" min="0" max="5" value="${i + 1}" data-z="${i}">
            <span class="val" data-out="${i}">${i + 1}</span>
          </label>`).join('')}
      </div>

      <div class="demo-stage js-stage" style="position:relative;height:230px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = [0, 1, 2].map(i => `
    <div class="box ${colors[i]}"
         style="position:absolute;left:${pos[i].left}px;top:${pos[i].top}px;width:110px;height:110px;font-size:20px;">
      ${'ABC'[i]}
    </div>`).join('');

  function update() {
    const zs = [...mount.querySelectorAll('[data-z]')].map(i => +i.value);

    zs.forEach((z, i) => {
      mount.querySelector(`[data-out="${i}"]`).textContent = z;
      stage.children[i].style.zIndex = z;
    });

    code.textContent =
`.a { position: absolute; z-index: ${zs[0]}; }
.b { position: absolute; z-index: ${zs[1]}; }
.c { position: absolute; z-index: ${zs[2]}; }`;
  }

  mount.querySelectorAll('[data-z]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ------ The demos below came from the original "responsive" chapter ------ */

/* ---------------------------------------------------------
 * Demo 8.4 — media queries + a simulated viewport (an iframe carries the media queries)
 * ------------------------------------------------------- */
window.DEMOS['d-8-4'] = function (mount) {
  // media queries inside the iframe use the iframe width as the viewport, so different screens can be simulated
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { margin:0; padding:10px; background:#fff; color:#1e2a32;
         font-family: system-ui, -apple-system, "Microsoft YaHei", sans-serif; }
  .bar { padding:7px 11px; background:#0f766e; color:#fff; font-size:12px;
         border-radius:6px; text-align:center; font-weight:700; }
  .cards { display:grid; grid-template-columns:1fr; gap:8px; margin-top:10px; }
  .card { padding:12px; background:#d7f2ee; color:#0f766e; border-radius:6px;
          font-size:12px; font-weight:700; text-align:center; }
  @media (min-width:400px) { .cards { grid-template-columns:repeat(2,1fr); } }
  @media (min-width:620px) { .cards { grid-template-columns:repeat(3,1fr); } }
</style></head><body>
  <div class="bar">Simulated screen</div>
  <div class="cards">
    <div class="card">Dashboard</div>
    <div class="card">Data viz</div>
    <div class="card">Mobile</div>
    <div class="card">Design system</div>
    <div class="card">Portfolio</div>
    <div class="card">Components</div>
  </div>
</body></html>`;

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Screen width
          <input type="range" min="300" max="760" value="700" data-c="w">
          <span class="val" data-out="w">700</span>
        </label>
        <span class="js-info" style="font-size:13px;color:var(--c-primary);font-weight:700;"></span>
      </div>

      <div class="js-wrap" style="overflow:auto;padding-bottom:6px;">
        <iframe class="js-frame" title="Responsive preview"
                style="border:1px solid var(--c-border);border-radius:8px;height:220px;background:#fff;transition:width .15s;"></iframe>
      </div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const frame = mount.querySelector('.js-frame');
  const info  = mount.querySelector('.js-info');
  const code  = mount.querySelector('.js-code');

  frame.srcdoc = srcdoc;

  function update() {
    const w = +mount.querySelector('[data-c="w"]').value;
    mount.querySelector('[data-out="w"]').textContent = w;
    frame.style.width = w + 'px';

    const cols = w >= 620 ? 3 : (w >= 400 ? 2 : 1);
    const zone = w >= 620 ? 'desktop' : (w >= 400 ? 'tablet' : 'phone');
    info.textContent = `→ ${zone} range · ${cols} columns`;

    code.textContent =
`.cards { grid-template-columns: 1fr; }                       /* single column by default */

@media (min-width: 400px) { .cards { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 620px) { .cards { grid-template-columns: repeat(3, 1fr); } }`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Demo 8.5 — mobile first vs desktop first
 * ------------------------------------------------------- */
window.DEMOS['d-8-5'] = function (mount) {
  const MOBILE = `/* Default: mobile, single column */
.cards { display: grid; gap: 16px; }

@media (min-width: 640px) {          /* progressively enhanced */
  .cards { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .cards { grid-template-columns: repeat(3, 1fr); }
}`;

  const DESKTOP = `/* Default: desktop, three columns (hard-coded up front) */
.cards {
  display: grid; gap: 16px;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 1023px) {         /* progressively overridden */
  .cards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 639px) {
  .cards { grid-template-columns: 1fr; }
}`;

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Approach
          <select class="js-mode">
            <option value="mobile">Mobile first (min-width)</option>
            <option value="desktop">Desktop first (max-width)</option>
          </select>
        </label>
      </div>

      <p class="js-note" style="margin:0 0 12px;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const sel  = mount.querySelector('.js-mode');
  const note = mount.querySelector('.js-note');
  const code = mount.querySelector('.js-code');

  function update() {
    if (sel.value === 'mobile') {
      code.textContent = MOBILE;
      note.textContent = '✅ The default styles serve the small screen only; bigger screens are progressively "added to" via min-width, so the rules never fight each other.';
    } else {
      code.textContent = DESKTOP;
      note.textContent = '⚠️ The default styles fill in all three columns, so the small screen has to override them one by one, and new rules easily clash with the old ones.';
    }
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 8.6 — relative unit conversion
 * ------------------------------------------------------- */
window.DEMOS['d-8-6'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Root font size (html font-size)
          <input type="range" min="12" max="24" value="16" data-c="root">
          <span class="val" data-out="root">16px</span>
        </label>
        <label class="demo-control">Simulated viewport width
          <input type="range" min="320" max="1200" value="900" data-c="vw">
          <span class="val" data-out="vw">900</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="display:grid;gap:12px;min-height:160px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  function update() {
    const root = +mount.querySelector('[data-c="root"]').value;
    const vw   = +mount.querySelector('[data-c="vw"]').value;

    mount.querySelector('[data-out="root"]').textContent = root + 'px';
    mount.querySelector('[data-out="vw"]').textContent   = vw;

    const rows = [
      { name: '16px', px: 16,       unit: 'absolute pixels: independent of font size and viewport' },
      { name: '1rem', px: root,     unit: `= root font size (${root}px)` },
      { name: '2rem', px: root * 2, unit: `= ${root * 2}px` },
      { name: '10vw', px: vw / 10,  unit: `= viewport width ${vw} × 10% = ${(vw / 10).toFixed(0)}px` },
    ];

    stage.innerHTML = rows.map(r => {
      const barPct = Math.min(r.px, 320) / 3.2;   // 320px maps to 100% at most
      return `
        <div style="display:grid;grid-template-columns:64px 1fr 190px;gap:12px;align-items:center;font-size:12.5px;">
          <code style="color:var(--c-primary);font-weight:700;">${r.name}</code>
          <div style="height:18px;border-radius:4px;background:var(--d2);width:${barPct}%;transition:width .15s;"></div>
          <span style="color:var(--c-text-soft);">${r.unit}</span>
        </div>`;
    }).join('');

    code.textContent =
`html { font-size: ${root}px; }        /* root font size, adjustable by the user in the browser */

.title { font-size: 2rem; }          /* = ${root * 2}px */
.box   { width: 10vw; }              /* = 10% of the viewport ≈ ${(vw / 10).toFixed(0)}px */
.hero  { min-height: 100vh; }        /* fills one screen in height */`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Bootstrap
 * ------------------------------------------------------- */
initLesson('lesson-08');
