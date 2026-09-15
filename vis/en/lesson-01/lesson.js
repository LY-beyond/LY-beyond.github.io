// =========================================================
// lesson-01/lesson.js —— Chapter 1: Core Principles of Layout Design
//   Demos: d-1-1 alignment / d-1-2 proximity & whitespace / d-1-3 contrast & hierarchy
// =========================================================

import { initLesson } from '../../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * Demo 1.1 — aligned vs misaligned
 * ------------------------------------------------------- */
window.DEMOS['d-1-1'] = function (mount) {
  const ROWS = [
    { t: 'Portfolio · top nav', s: 'Nav bar · Chapter 9 STEP 3' },
    { t: 'Portfolio · hero', s: 'Hero · Chapter 9 STEP 4' },
    { t: 'Portfolio · card wall', s: 'Card wall · Chapter 9 STEP 6' },
    { t: 'Portfolio · numbers', s: 'Numbers strip · Chapter 9 STEP 7' },
  ];

  // The "eyeballed" offsets used in the misaligned state
  const OFF_PAD   = [28, 46, 16, 58];
  const OFF_GAP   = [12, 22, 8, 18];
  const OFF_ICON  = [34, 26, 40, 30];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">State
          <select class="js-mode">
            <option value="off">Misaligned (placed by feel)</option>
            <option value="on">Aligned (sharing one line)</option>
          </select>
        </label>
        <span style="font-size:12.5px;color:var(--c-text-soft);">Red dashed line = the reference alignment line</span>
      </div>

      <div class="demo-stage js-stage" style="position:relative;display:flex;flex-direction:column;background:var(--c-surface);padding:16px 0;gap:0;">
        <div class="js-guide" style="position:absolute;left:calc(16px + 28px);top:0;bottom:0;border-left:1px dashed var(--d4);opacity:.75;"></div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const guide = mount.querySelector('.js-guide');
  const sel   = mount.querySelector('.js-mode');
  const note  = mount.querySelector('.js-note');

  stage.insertAdjacentHTML('beforeend', ROWS.map((r, i) => `
    <div class="js-row" data-i="${i}"
         style="display:flex;align-items:center;padding:10px 0;">
      <div class="js-icon" style="flex:none;border-radius:8px;background:var(--d${i + 1});"></div>
      <div>
        <div style="font-weight:700;font-size:14px;">${r.t}</div>
        <div style="font-size:12.5px;color:var(--c-text-soft);">${r.s}</div>
      </div>
    </div>`).join(''));

  const rows = [...stage.querySelectorAll('.js-row')];

  function update() {
    const aligned = sel.value === 'on';

    rows.forEach((row, i) => {
      const icon = row.querySelector('.js-icon');
      row.style.paddingLeft = (aligned ? 28 : OFF_PAD[i]) + 'px';
      row.style.gap         = (aligned ? 14 : OFF_GAP[i]) + 'px';
      icon.style.width      = (aligned ? 34 : OFF_ICON[i]) + 'px';
      icon.style.height     = (aligned ? 34 : OFF_ICON[i]) + 'px';
    });

    // Once aligned: one shared spacing + clearer grouping
    stage.style.gap = aligned ? '0px' : '6px';
    rows.forEach(r => { r.style.marginBottom = aligned ? '8px' : '0px'; });

    guide.style.opacity = aligned ? '.9' : '.25';
    note.textContent = aligned
      ? '→ Every element shares the same left edge and the same spacing — a sense of order appears instantly.'
      : '→ Ragged left edges and uneven spacing: the first impression a reader gets is "messy".';
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 1.2 — proximity and whitespace (within-group / between-group spacing)
 * ------------------------------------------------------- */
window.DEMOS['d-1-2'] = function (mount) {
  const GROUPS = [
    { name: 'Basic information', items: ['Name · Alex Chen', 'Student ID · 202406', 'Class · Intelligent Science and Technology 1'] },
    { name: 'Contact details', items: ['Email · alex@example.com', 'Phone · 138****0000', 'Address · Qingdao, Shandong'] },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Within-group spacing
          <input type="range" min="2" max="28" value="6" data-c="inner">
          <span class="val" data-out="inner">6</span>
        </label>
        <label class="demo-control">Between-group spacing
          <input type="range" min="4" max="56" value="28" data-c="outer">
          <span class="val" data-out="outer">28</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const note  = mount.querySelector('.js-note');

  function update() {
    const inner = +mount.querySelector('[data-c="inner"]').value;
    const outer = +mount.querySelector('[data-c="outer"]').value;

    mount.querySelector('[data-out="inner"]').textContent = inner;
    mount.querySelector('[data-out="outer"]').textContent = outer;

    stage.innerHTML = GROUPS.map(g => `
      <div style="margin-bottom:${outer}px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-primary);letter-spacing:.06em;margin-bottom:${Math.max(4, inner / 2)}px;">
          ${g.name}
        </div>
        <div style="display:flex;flex-direction:column;gap:${inner}px;">
          ${g.items.map(t => `<div style="padding:6px 10px;border-radius:6px;background:var(--c-surface-2);font-size:13px;">${t}</div>`).join('')}
        </div>
      </div>`).join('');

    const ratio = outer / Math.max(inner, 1);
    note.textContent = ratio >= 2
      ? `→ Between / within = ${ratio.toFixed(1)}× — grouping reads clearly ✔`
      : `→ Between / within is only ${ratio.toFixed(1)}× — you cannot tell which items belong together ✘ (aim for ≥ 2×)`;
    note.style.color = ratio >= 2 ? 'var(--c-success)' : 'var(--c-danger)';
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Demo 1.3 — contrast and visual hierarchy
 * ------------------------------------------------------- */
window.DEMOS['d-1-3'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Heading size
          <input type="range" min="16" max="52" value="32" data-c="title">
          <span class="val" data-out="title">32</span>
        </label>
        <label class="demo-control">Body size
          <input type="range" min="12" max="22" value="16" data-c="body">
          <span class="val" data-out="body">16</span>
        </label>
        <label class="demo-control">Accent color
          <select class="js-acc">
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);padding:22px;"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const acc   = mount.querySelector('.js-acc');
  const note  = mount.querySelector('.js-note');

  function update() {
    const t = +mount.querySelector('[data-c="title"]').value;
    const b = +mount.querySelector('[data-c="body"]').value;
    const accentOn = acc.value === 'on';

    mount.querySelector('[data-out="title"]').textContent = t;
    mount.querySelector('[data-out="body"]').textContent  = b;

    const span = t - b;

    stage.innerHTML = `
      <div style="font-size:${t}px;font-weight:700;line-height:1.25;margin-bottom:12px;color:var(--c-text);">
        Three details that lift the quality of a layout
      </div>
      <div style="font-size:${b}px;color:var(--c-text-soft);line-height:1.85;">
        What makes a page look professional is rarely a flashy effect — it is whether
        <span style="color:${accentOn ? 'var(--c-primary)' : 'inherit'};font-weight:${accentOn ? 700 : 'inherit'};">alignment, grouping and hierarchy</span>
        these three things are done solidly.
      </div>`;

    if (span >= 12) {
      note.textContent = `→ A type-size jump of ${span}px — primary and secondary are clear ✔ readers know to look at the heading first.`;
      note.style.color = 'var(--c-success)';
    } else {
      note.textContent = `→ A type-size jump of only ${span}px — the hierarchy is almost invisible ✘ aim for 12px or more.`;
      note.style.color = 'var(--c-danger)';
    }
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  acc.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 1.4 — repetition and unity
 * ------------------------------------------------------- */
window.DEMOS['d-1-4'] = function (mount) {
  const CARDS = ['Design system', 'Component library', 'Style guide'];

  // "Every card for itself": a different radius / padding / shadow / accent per card
  const OFF = [
    { r: 4,  pad: 12, sh: 'none',                        color: 'var(--d1)' },
    { r: 20, pad: 24, sh: '0 10px 24px rgba(0,0,0,.22)',  color: 'var(--d4)' },
    { r: 8,  pad: 16, sh: '0 2px 4px rgba(0,0,0,.40)',    color: 'var(--d3)' },
  ];
  // "One shared spec": everything comes from the same tokens
  const ON = { r: 12, pad: 18, sh: '0 4px 16px rgba(30,42,50,.10)', color: 'var(--c-primary)' };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Style source
          <select class="js-mode">
            <option value="off">Every card for itself (tuned individually)</option>
            <option value="on">One shared spec (reusing the same tokens)</option>
          </select>
        </label>
      </div>

      <div class="js-stage" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const code  = mount.querySelector('.js-code');

  function update() {
    const unified = sel.value === 'on';

    stage.innerHTML = CARDS.map((t, i) => {
      const s = unified ? ON : OFF[i];
      return `
        <div style="border-radius:${s.r}px;padding:${s.pad}px;box-shadow:${s.sh};
                    background:var(--c-surface);border:1px solid var(--c-border);">
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${t}</div>
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;
                      background:${s.color};color:#fff;font-size:12px;font-weight:700;">View</div>
        </div>`;
    }).join('');

    code.textContent = unified
      ? `/* Consistent: defined once, reused everywhere */
:root { --radius: 12px; --space: 18px; }

.card { border-radius: var(--radius); padding: var(--space); }
.btn  { background: var(--c-primary); }`
      : `/* Every card for itself: one set of values per card — it will drift sooner or later */
.card-a { border-radius: 4px;  padding: 12px; }
.card-b { border-radius: 20px; padding: 24px; }
.card-c { border-radius: 8px;  padding: 16px; }`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 1.5 — Gestalt: spacing / common region / similarity
 * ------------------------------------------------------- */
window.DEMOS['d-1-5'] = function (mount) {
  const GROUPS = [
    { name: 'Front-end skills', items: ['Semantic HTML', 'CSS layout', 'JavaScript'] },
    { name: 'Design skills', items: ['Grid systems', 'Color systems', 'Interaction guidelines'] },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Grouping device
          <select class="js-mode">
            <option value="spacing">① Spacing only</option>
            <option value="region">② Add a "common region"</option>
            <option value="similar">③ Also add "similarity"</option>
          </select>
        </label>
      </div>

      <div class="js-stage" style="background:var(--c-surface);"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const note  = mount.querySelector('.js-note');

  function update() {
    const m = sel.value;
    const useRegion  = m !== 'spacing';
    const useSimilar = m === 'similar';

    stage.innerHTML = GROUPS.map((g, gi) => {
      const regionStyle = useRegion
        ? `background:${useSimilar ? (gi === 0 ? 'var(--c-primary-weak)' : 'var(--c-accent-weak)') : 'var(--c-surface-2)'};
           border:1px solid var(--c-border);border-radius:12px;padding:16px;`
        : `padding:0;`;

      return `
        <div style="margin-bottom:${useRegion ? 20 : 32}px;${regionStyle}">
          <div style="font-size:12px;font-weight:700;letter-spacing:.06em;margin-bottom:10px;
                      color:${useSimilar ? (gi === 0 ? 'var(--c-primary)' : 'var(--c-accent)') : 'var(--c-muted)'};">
            ${g.name}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${g.items.map(t => `
              <div style="padding:8px 12px;border-radius:8px;font-size:13px;
                          background:${useSimilar ? 'var(--c-surface)' : 'var(--c-surface-2)'};
                          color:var(--c-text);">${t}</div>`).join('')}
          </div>
        </div>`;
    }).join('');

    const msgs = {
      spacing: '→ Spacing alone: you can see two clusters, but the boundary is fuzzy.',
      region:  '→ Adding a "common region" (tint + radius): the grouping snaps into focus with no extra explanation needed.',
      similar: '→ Then "similarity" (a different color family per group): you know not only that there are two groups, but that they are different kinds.',
    };
    note.textContent = msgs[m];
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * Demo 1.6 — visual balance and rhythm
 * ------------------------------------------------------- */
window.DEMOS['d-1-6'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Left hero size
          <input type="range" min="90" max="260" value="180" data-c="left">
          <span class="val" data-out="left">180</span>
        </label>
        <label class="demo-control">Number of right-hand blocks
          <input type="range" min="1" max="5" value="3" data-c="right">
          <span class="val" data-out="right">3</span>
        </label>
      </div>

      <div class="demo-stage" style="background:var(--c-surface);padding:18px;">
        <div style="display:grid;grid-template-columns:7fr 5fr;gap:16px;align-items:start;">
          <div class="js-left" style="border-radius:12px;background:var(--c-primary);color:#fff;
                     display:grid;place-items:center;font-weight:700;font-size:14px;">Hero</div>
          <div class="js-right" style="display:flex;flex-direction:column;gap:10px;"></div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:700;"></p>
    </div>`;

  const left  = mount.querySelector('.js-left');
  const right = mount.querySelector('.js-right');
  const note  = mount.querySelector('.js-note');

  function update() {
    const H = +mount.querySelector('[data-c="left"]').value;
    const N = +mount.querySelector('[data-c="right"]').value;

    mount.querySelector('[data-out="left"]').textContent  = H;
    mount.querySelector('[data-out="right"]').textContent = N;

    left.style.height = H + 'px';

    right.innerHTML = Array.from({ length: N }, (_, i) => `
      <div style="height:44px;border-radius:10px;background:var(--c-surface-2);
                  border:1px solid var(--c-border);display:grid;place-items:center;
                  font-size:12.5px;font-weight:700;color:var(--c-text-soft);">Small block ${i + 1}</div>`).join('');

    const rightWeight = N * 44 + (N - 1) * 10;
    const diff = Math.abs(H - rightWeight);

    if (diff <= 40) {
      note.textContent = `→ Left ${H}px vs right ${rightWeight}px: the visual weights are close, so the page is BALANCED ✔`;
      note.style.color = 'var(--c-success)';
    } else {
      const side = H > rightWeight ? 'left-heavy, right-light' : 'left-light, right-heavy';
      note.textContent = `→ Left ${H}px vs right ${rightWeight}px, a gap of ${diff}px: ${side}, so the page is UNBALANCED ✘`;
      note.style.color = 'var(--c-danger)';
    }
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * Bootstrap
 * ------------------------------------------------------- */
initLesson('lesson-01');
