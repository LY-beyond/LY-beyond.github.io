// =========================================================
// lesson-09/lesson.js —— Chapter 9: Capstone — A Portfolio Website
//   8 demos, built up step by step: d-9-1 … d-9-8
// =========================================================

import { initLesson } from '../../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* =========================================================
 * 9.1 Planning the case study and the wireframe
 * ======================================================= */
window.DEMOS['d-9-1'] = function (mount) {
  const BLOCKS = [
    { name: 'site-header', desc: 'Navigation' },
    { name: 'hero',        desc: 'Hero intro' },
    { name: 'about',       desc: 'About me' },
    { name: 'works',       desc: 'Portfolio' },
    { name: 'stats',       desc: 'Statistics' },
    { name: 'site-footer', desc: 'Contact + footer' },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Stage
          <select class="js-mode">
            <option value="wire">① Wireframe (skeleton only)</option>
            <option value="fill">② Content filled in</option>
          </select>
        </label>
      </div>

      <div class="js-stage" style="display:flex;flex-direction:column;gap:8px;background:var(--c-surface);padding:14px;"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const note  = mount.querySelector('.js-note');

  function update() {
    const wire = sel.value === 'wire';

    stage.innerHTML = BLOCKS.map((b, i) => {
      if (wire) {
        return `<div style="height:38px;border:1px dashed #b8b2a8;background:#e8e6e1;
                    border-radius:6px;display:grid;place-items:center;color:#8b8578;font-size:12px;">
                  ${b.name}
                </div>`;
      }
      const colors = ['var(--c-surface-2)', 'var(--c-primary-weak)', 'var(--c-surface-2)',
                      'var(--c-surface-2)', 'var(--c-surface-2)', 'var(--c-surface-2)'];
      return `<div style="height:38px;background:${colors[i]};border:1px solid var(--c-border);
                  border-radius:6px;display:flex;align-items:center;justify-content:space-between;
                  padding:0 14px;font-size:12.5px;">
                <span style="font-family:var(--font-mono);color:var(--c-muted);">${b.name}</span>
                <span style="font-weight:700;color:var(--c-primary);">${b.desc}</span>
              </div>`;
    }).join('');

    note.textContent = wire
      ? '→ Wireframe stage: only section names and their order, no agonising over color or copy — this is the cheapest moment to change the structure.'
      : '→ Content filled in: the skeleton (order, heights, positions) is completely unchanged — real content has simply been dropped into it.';
  }

  sel.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.2 Page skeleton and grid
 * ======================================================= */
window.DEMOS['d-9-2'] = function (mount) {
  const BLOCKS = ['nav', 'hero', 'about', 'works', 'stats', 'footer'];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Container max width
          <input type="range" min="520" max="1000" value="820" data-c="w">
          <span class="val" data-out="w">820</span>
        </label>
        <label class="demo-control">Gutter gap
          <input type="range" min="4" max="40" value="16" data-c="g">
          <span class="val" data-out="g">16</span>
        </label>
      </div>

      <div class="js-wrap" style="overflow:auto;padding-bottom:6px;">
        <div class="js-container" style="margin:0 auto;position:relative;transition:width .15s;">
          <div class="js-guides"
               style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);pointer-events:none;"></div>
          <div class="js-content" style="position:relative;z-index:1;display:grid;grid-template-columns:repeat(12,1fr);"></div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const wrap = mount.querySelector('.js-container');
  const guides = mount.querySelector('.js-guides');
  const content = mount.querySelector('.js-content');
  const note = mount.querySelector('.js-note');

  guides.innerHTML = Array.from({ length: 12 }, () =>
    `<div style="background:rgba(15,118,110,.09);border-radius:3px;"></div>`).join('');

  function update() {
    const w = +mount.querySelector('[data-c="w"]').value;
    const g = +mount.querySelector('[data-c="g"]').value;

    mount.querySelector('[data-out="w"]').textContent = w;
    mount.querySelector('[data-out="g"]').textContent = g;

    wrap.style.width = w + 'px';
    guides.style.gap = g + 'px';
    content.style.gap = g + 'px';

    content.innerHTML = BLOCKS.map((b, i) => `
      <div style="grid-column:span 12;height:32px;border-radius:6px;margin-bottom:${g}px;
                  background:${i === 1 ? 'var(--c-primary)' : 'var(--c-surface-2)'};
                  color:${i === 1 ? '#fff' : 'var(--c-text-soft)'};
                  border:1px solid var(--c-border);display:grid;place-items:center;font-size:12px;font-weight:700;">
        ${b}
      </div>`).join('');

    note.textContent = '→ Whatever the container width or the gap, the six sections always share the same left and right edges — because they all use the same container and the same grid.';
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* =========================================================
 * 9.3 The top navigation bar
 * ======================================================= */
window.DEMOS['d-9-3'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Number of menu items
          <input type="range" min="2" max="6" value="4" data-c="n">
          <span class="val" data-out="n">4</span>
        </label>
        <label class="demo-control">Distribution
          <select class="js-justify">
            <option value="space-between">space-between (recommended)</option>
            <option value="center">center</option>
            <option value="flex-start">flex-start</option>
          </select>
        </label>
      </div>

      <div class="demo-stage" style="padding:0;overflow:hidden;background:var(--c-surface);">
        <div class="js-bar" style="display:flex;align-items:center;height:56px;padding:0 18px;
                    border-bottom:1px solid var(--c-border);background:var(--c-surface-2);">
          <div style="font-weight:800;color:var(--c-primary);font-family:var(--font-mono);">LX.</div>
          <nav class="js-menu" style="display:flex;gap:6px;"></nav>
        </div>
      </div>

      <pre class="demo-code js-code"></pre>
    </div>`;

  const bar  = mount.querySelector('.js-bar');
  const menu = mount.querySelector('.js-menu');
  const jus  = mount.querySelector('.js-justify');
  const code = mount.querySelector('.js-code');

  const ITEMS = ['Home', 'Works', 'About', 'Blog', 'Contact', 'More'];

  function update() {
    const n = +mount.querySelector('[data-c="n"]').value;
    mount.querySelector('[data-out="n"]').textContent = n;

    menu.innerHTML = ITEMS.slice(0, n)
      .map(t => `<a style="padding:6px 10px;border-radius:6px;font-size:13px;
                     font-weight:600;color:var(--c-text-soft);background:var(--c-surface);">${t}</a>`)
      .join('');

    bar.style.justifyContent = jus.value;

    code.textContent =
`.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: ${jus.value};
  height: 56px;
}
nav { display: flex; gap: 6px; }   /* between menu items: tight */`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  jus.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.4 The hero section
 * ======================================================= */
window.DEMOS['d-9-4'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Heading size
          <input type="range" min="22" max="52" value="38" data-c="fs">
          <span class="val" data-out="fs">38</span>
        </label>
        <label class="demo-control">Vertical whitespace
          <input type="range" min="10" max="64" value="36" data-c="pad">
          <span class="val" data-out="pad">36</span>
        </label>
        <label class="demo-control">Left / right ratio
          <select class="js-ratio">
            <option value="7fr 5fr">7 : 5 (recommended)</option>
            <option value="1fr 1fr">1 : 1</option>
            <option value="5fr 7fr">5 : 7</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);padding:0;overflow:hidden;">
        <div class="js-grid" style="display:grid;gap:20px;align-items:center;padding:0 18px;">
          <div>
            <h4 class="js-title" style="margin:0 0 10px;line-height:1.2;">Hi, I’m Alex Chen</h4>
            <p style="margin:0 0 16px;font-size:14px;color:var(--c-text-soft);">
              Focused on web front-end and data visualization; I enjoy turning complex information into something clear and good-looking.
            </p>
            <span class="js-cta" style="display:inline-block;background:var(--c-primary);color:#fff;
                         padding:10px 20px;border-radius:999px;font-size:13px;font-weight:700;">Contact me</span>
          </div>
          <div style="aspect-ratio:1/1;border-radius:16px;overflow:hidden;background:var(--c-primary-weak);">
            <img src="../../figs/李雷证件照.png" alt="Portrait of Alex Chen"
                 style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const grid  = mount.querySelector('.js-grid');
  const title = mount.querySelector('.js-title');
  const ratio = mount.querySelector('.js-ratio');
  const note  = mount.querySelector('.js-note');

  function update() {
    const fs  = +mount.querySelector('[data-c="fs"]').value;
    const pad = +mount.querySelector('[data-c="pad"]').value;

    mount.querySelector('[data-out="fs"]').textContent  = fs;
    mount.querySelector('[data-out="pad"]').textContent = pad;

    title.style.fontSize = fs + 'px';
    grid.style.paddingTop = pad + 'px';
    grid.style.paddingBottom = pad + 'px';
    grid.style.gridTemplateColumns = ratio.value;

    const span = fs - 14;   // the type-size jump between the heading and the body text
    note.textContent = span >= 18
      ? `→ Heading ${fs}px / body 14px, a jump of ${span}px: the hierarchy is clear and the protagonist is obvious ✔`
      : `→ Heading ${fs}px / body 14px, a jump of only ${span}px: primary and secondary are not distinct enough, and the visitor "cannot find the point" ✘`;
    note.style.color = span >= 18 ? 'var(--c-success)' : 'var(--c-danger)';
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  ratio.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.5 About me (two columns)
 * ======================================================= */
window.DEMOS['d-9-5'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Image / text ratio
          <select class="js-ratio">
            <option value="3fr 9fr">3 : 9</option>
            <option value="4fr 8fr" selected>4 : 8 (recommended)</option>
            <option value="5fr 7fr">5 : 7</option>
            <option value="6fr 6fr">6 : 6 (even split)</option>
          </select>
        </label>
        <label class="demo-control">Alignment
          <select class="js-align">
            <option value="start">start (recommended for long text)</option>
            <option value="center">center (short text)</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);padding:18px;">
        <div class="js-grid" style="display:grid;gap:22px;">
          <div style="aspect-ratio:4/5;border-radius:14px;overflow:hidden;background:var(--c-primary-weak);">
            <img src="../../figs/李雷证件照.png" alt="Photo of Alex Chen"
                 style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>
          <div>
            <h4 style="margin:0 0 10px;font-size:19px;">About me</h4>
            <p style="margin:0 0 12px;font-size:13.5px;line-height:1.9;color:var(--c-text-soft);">
              I am a student majoring in software engineering. Over the past two years I have worked on several course projects and small products,
              and gradually narrowed my interest down to <b>front-end layout and information design</b>.
            </p>
            <p style="margin:0;font-size:13.5px;line-height:1.9;color:var(--c-text-soft);">
              I believe that "explaining something complex clearly" is itself a skill,
              so I also enjoy writing tutorials and building teaching pages.
            </p>
          </div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const grid  = mount.querySelector('.js-grid');
  const ratio = mount.querySelector('.js-ratio');
  const align = mount.querySelector('.js-align');
  const note  = mount.querySelector('.js-note');

  function update() {
    grid.style.gridTemplateColumns = ratio.value;
    grid.style.alignItems = align.value;

    const even = ratio.value.startsWith('6fr');
    note.textContent = even
      ? '→ A 1:1 even split: the image is too large and the lines too long — both sides feel uncomfortable ✘'
      : `→ A smaller image column and a wider text column (${ratio.value.replace('fr', ' : ').replace(' ', '')}) read more smoothly ✔`;
    note.style.color = even ? 'var(--c-danger)' : 'var(--c-success)';
  }

  ratio.addEventListener('change', update);
  align.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.6 The portfolio card wall
 * ======================================================= */
window.DEMOS['d-9-6'] = function (mount) {
  const TITLES = ['Course project: weather visualization', 'Campus navigation mini-app', 'Dashboard prototype',
                  'Personal blog template', 'Chart component library', 'Online résumé builder',
                  'Reading-notes system', 'Travel footprint map'];
  const SHOTS  = ['天气可视化.png', '校园导航.png', '数据看板.png',
                  '个人博客.png', '图表组件库.png', '在线简历生成器.png'];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Minimum card width
          <input type="range" min="150" max="320" value="220" data-c="m">
          <span class="val" data-out="m">220</span>
        </label>
        <label class="demo-control">Card gap
          <input type="range" min="8" max="40" value="20" data-c="g">
          <span class="val" data-out="g">20</span>
        </label>
        <label class="demo-control">Card count
          <input type="range" min="2" max="8" value="6" data-c="n">
          <span class="val" data-out="n">6</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface-2);padding:16px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  function update() {
    const m = +mount.querySelector('[data-c="m"]').value;
    const g = +mount.querySelector('[data-c="g"]').value;
    const n = +mount.querySelector('[data-c="n"]').value;

    mount.querySelector('[data-out="m"]').textContent = m;
    mount.querySelector('[data-out="g"]').textContent = g;
    mount.querySelector('[data-out="n"]').textContent = n;

    stage.style.gridTemplateColumns = `repeat(auto-fit, minmax(${m}px, 1fr))`;
    stage.style.gap = g + 'px';
    stage.style.display = 'grid';

    stage.innerHTML = TITLES.slice(0, n).map((t, i) => `
      <div style="display:flex;flex-direction:column;padding:14px;background:var(--c-surface);
                  border:1px solid var(--c-border);border-radius:12px;">
        <div style="aspect-ratio:16/10;border-radius:8px;margin-bottom:10px;overflow:hidden;
                    background:linear-gradient(135deg, var(--d${(i % 6) + 1}), var(--c-primary-weak));">
          ${i < SHOTS.length ? `<img src="../../figs/${SHOTS[i]}" alt="${t} preview"
             style="width:100%;height:100%;object-fit:cover;display:block;">` : ''}
        </div>
        <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;">${t}</div>
        <div style="font-size:11.5px;color:var(--c-muted);">Web · 2026</div>
        <div style="margin-top:auto;padding-top:10px;border-top:1px dashed var(--c-border);
                    font-size:12.5px;font-weight:700;color:var(--c-primary);">View details →</div>
      </div>`).join('');

    code.textContent =
`.wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${m}px, 1fr));
  gap: ${g}px;
}
/* Cards + aspect-ratio give every thumbnail the same height → the whole wall lines up */`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* =========================================================
 * 9.7 The statistics section
 * ======================================================= */
window.DEMOS['d-9-7'] = function (mount) {
  const PRESETS = {
    'Standard (4 columns + full-width chart)': { cols: 4, chart: 4 },
    'Chart-first (large chart takes half a row)':  { cols: 4, chart: 2 },
    'Narrow screen (2 columns + full width)':     { cols: 2, chart: 2 },
  };

  const STATS = [
    { num: '24',  lbl: 'Projects completed' },
    { num: '6',   lbl: 'A+ grades' },
    { num: '380', lbl: 'Commits' },
    { num: '2',   lbl: 'Internships' },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Spanning scheme
          <select class="js-p">
            ${Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="display:grid;gap:12px;background:var(--c-surface-2);padding:16px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-p');
  const code  = mount.querySelector('.js-code');

  function update() {
    const p = PRESETS[sel.value];
    stage.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;

    stage.innerHTML = STATS.map(s => `
      <div style="display:flex;flex-direction:column;gap:4px;padding:14px;
                  background:var(--c-surface);border:1px solid var(--c-border);border-radius:10px;">
        <span style="font-size:26px;font-weight:700;color:var(--c-primary);line-height:1.1;">${s.num}</span>
        <span style="font-size:12px;color:var(--c-muted);">${s.lbl}</span>
      </div>`).join('') + `
      <div style="grid-column:span ${p.chart};min-height:120px;border-radius:10px;
                  background:var(--c-surface);border:1px dashed var(--c-border-2);
                  display:grid;place-items:center;color:var(--c-muted);font-size:13px;font-weight:700;">
        Large chart (trend)
      </div>`;

    code.textContent =
`.stats .grid { display: grid; grid-template-columns: repeat(${p.cols}, 1fr); gap: 12px; }

.stat        { display: flex; flex-direction: column; gap: 4px; }  /* number and caption: tight */
.stat .num   { font-size: 26px; font-weight: 700; }
.stat .lbl   { font-size: 12px; color: var(--c-muted); }

.chart       { grid-column: span ${p.chart}; }   /* spans columns → room for the large chart */`;
  }

  sel.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.8 Responsive design and self-check
 * ======================================================= */
window.DEMOS['d-9-8'] = function (mount) {
  const CHECKLIST = [
    'Every element aligned to the same line',
    'within-group spacing < between-group spacing',
    'the key content has a type-size jump of ≥ 18px',
    'similar elements share the same radius / shadow',
    'grouping is clear enough to need no text',
    'left and right visual weight is roughly balanced',
    'all spacing comes from the same scale',
    'still readable at phone width',
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">Screen width
          <input type="range" min="320" max="900" value="860" data-c="w">
          <span class="val" data-out="w">860</span>
        </label>
        <span class="js-bp" style="font-size:12.5px;font-weight:700;color:var(--c-primary);"></span>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:16px;align-items:start;">
        <div style="overflow:auto;">
          <div class="js-frame" style="margin:0 auto;border:1px solid var(--c-border);border-radius:10px;
                      overflow:hidden;background:var(--c-surface);transition:width .15s;"></div>
        </div>
        <div class="js-check" style="font-size:12px;color:var(--c-text-soft);"></div>
      </div>
    </div>`;

  const frame = mount.querySelector('.js-frame');
  const bp    = mount.querySelector('.js-bp');
  const check = mount.querySelector('.js-check');

  function render(w) {
    const narrow = w < 520;
    const mid    = w < 760;
    const pad    = narrow ? 12 : 20;

    frame.innerHTML = `
      <div style="height:34px;display:flex;align-items:center;justify-content:space-between;
                  padding:0 ${pad}px;border-bottom:1px solid var(--c-border);background:var(--c-surface-2);">
        <span style="font-weight:800;font-family:var(--font-mono);color:var(--c-primary);font-size:12px;">LX.</span>
        <span style="font-size:11px;color:var(--c-text-soft);">${narrow ? '☰' : 'Home · Works · About · Contact'}</span>
      </div>

      <div style="display:grid;gap:14px;padding:${pad}px;
                  grid-template-columns:${narrow ? '1fr' : '7fr 5fr'};align-items:center;">
        <div>
          <div style="font-size:${narrow ? 18 : 24}px;font-weight:700;line-height:1.25;margin-bottom:6px;">
            Hi, I’m Alex Chen
          </div>
          <div style="font-size:11.5px;color:var(--c-text-soft);margin-bottom:10px;">
            Focused on web front-end and data visualization
          </div>
          <span style="display:inline-block;background:var(--c-primary);color:#fff;padding:6px 14px;
                       border-radius:999px;font-size:11px;font-weight:700;">Contact me</span>
        </div>
        <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:var(--c-primary-weak);">
          <img src="../../figs/李雷证件照.png" alt="Alex Chen avatar"
               style="width:100%;height:100%;object-fit:cover;display:block;">
        </div>
      </div>

      <div style="display:grid;gap:14px;padding:0 ${pad}px ${pad}px;
                  grid-template-columns:${narrow ? '1fr' : '4fr 8fr'};">
        <div style="aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:var(--c-surface-2);">
          <img src="../../figs/李雷证件照.png" alt="Alex Chen photo"
               style="width:100%;height:100%;object-fit:cover;display:block;">
        </div>
        <div style="font-size:11.5px;line-height:1.9;color:var(--c-text-soft);">
          I am a student majoring in software engineering. Over the past two years I have worked on several course projects and small products,
          and gradually narrowed my interest down to front-end layout and information design.
        </div>
      </div>

      <div style="padding:0 ${pad}px ${pad}px;">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Portfolio</div>
        <div style="display:grid;gap:10px;
                    grid-template-columns:repeat(auto-fit, minmax(${narrow ? 110 : 130}px, 1fr));">
          ${['天气可视化.png', '校园导航.png', '数据看板.png', '个人博客.png'].map((shot, i) => `
            <div style="padding:8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:8px;">
              <div style="aspect-ratio:16/10;border-radius:5px;margin-bottom:6px;overflow:hidden;
                          background:linear-gradient(135deg, var(--d${i + 1}), var(--c-primary-weak));">
                <img src="../../figs/${shot}" alt="Project ${i + 1} thumbnail"
                     style="width:100%;height:100%;object-fit:cover;display:block;">
              </div>
              <div style="font-size:10.5px;font-weight:700;color:var(--c-text-soft);">Project ${i + 1}</div>
            </div>`).join('')}
        </div>
      </div>

      <div style="background:var(--c-surface-2);padding:14px ${pad}px;border-top:1px solid var(--c-border);
                  text-align:center;font-size:10.5px;color:var(--c-muted);">
        © 2026 Alex Chen · Get in touch
      </div>`;

    frame.style.width = w + 'px';
    bp.textContent = narrow ? '→ Phone layout (single column)' : (mid ? '→ Tablet layout' : '→ Desktop layout (two columns)');

    check.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;color:var(--c-text);">✅ Design self-check list</div>
      ${CHECKLIST.map(t => `
        <div style="display:flex;gap:6px;padding:3px 0;line-height:1.5;">
          <span style="color:var(--c-success);">✓</span><span>${t}</span>
        </div>`).join('')}`;
  }

  function update() {
    const w = +mount.querySelector('[data-c="w"]').value;
    mount.querySelector('[data-out="w"]').textContent = w;
    render(w);
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* =========================================================
 * Bootstrap
 * ======================================================= */
initLesson('lesson-09');
