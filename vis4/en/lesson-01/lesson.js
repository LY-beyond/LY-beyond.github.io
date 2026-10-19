// =========================================================
// lesson-01/lesson.js —— runnable demos for Chapter 1, "Data"
// ---------------------------------------------------------
// Conventions (agreed with lesson-core.js):
//   ① register demos with window.DEMOS['d-1-x'] = fn
//   ② the page mounts them with <div class="demo-mount" data-demo="d-1-x">
//   ③ finally call initLesson('Chapter 1 · Data', { lesson: 'lesson-01' })
//
// Dependency policy: every demo in this chapter is built with "native DOM + inline
//   SVG" and pulls in no D3 runtime. Three reasons: ① the site must be zero-build
//   and work offline; ② we must not ship a 300KB d3 bundle into the repo;
//   ③ what this chapter demonstrates is precisely D3's "thinking" (data flow /
//   three states / scales), and a 40-line equivalent implementation actually makes
//   the mechanism clearer. The real D3 calls appear in the code blocks.
// =========================================================

import { initLesson } from '../../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) Styles used only by this chapter's demos (injected once)
 *    Chapter pages only pull in tokens.css + lesson.css, so the
 *    chapter-private animation / interaction styles are injected
 *    here instead of polluting the shared stylesheets.
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson01-styles')) return;
  const st = document.createElement('style');
  st.id = 'lesson01-styles';
  st.textContent = `
/* Data-flow pipe: a light dot running along a track */
.l1-flow-dot { animation: l1Flow 1.7s linear infinite; }
@keyframes l1Flow { from { transform: translateX(0); } to { transform: translateX(520px); } }

/* DIKW pyramid: highlight on hover / selection */
.l1-dikw-layer { cursor: pointer; transition: filter var(--dur-fast) var(--ease); }
.l1-dikw-layer:hover { filter: brightness(1.14) saturate(1.08); }
.l1-dikw-layer.is-on  { filter: brightness(1.2) saturate(1.1); }

/* Data-Join three-state dots (reuse lesson.css's .box base) */
.l1-join-row {
  display: flex; flex-wrap: wrap; gap: 14px; align-items: center;
  min-height: 58px; padding: 4px 2px;
}
.l1-join-dot {
  width: 52px; height: 52px; min-width: 0; min-height: 0;
  padding: 0; border-radius: 50%;
  font-family: var(--font-mono); font-size: 13px;
  transform: scale(1); opacity: 1;
  transition: transform var(--dur-base) var(--ease),
              background-color var(--dur-base) var(--ease),
              opacity var(--dur-base) var(--ease);
}
.l1-join-dot.is-enter  { background: var(--c-success); }
.l1-join-dot.is-update { background: var(--ch-1); }
.l1-join-dot.is-exit   { background: var(--c-danger); }
.l1-join-dot.is-hidden { transform: scale(0); opacity: 0; }

/* 1.x Dirty-data ER */
.l1x-status { padding: 8px 12px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--c-primary) var(--mix-soft), var(--c-surface)); font-size: 12.5px; color: var(--c-text); }
.l1x-cap { margin: 0 0 8px; font-size: 12px; font-weight: 700; color: var(--c-text-soft); }
.l1x-sick { background: color-mix(in srgb, var(--c-danger) 14%, transparent); color: var(--c-danger); font-weight: 700; }
.l1x-raw { margin-top: 10px; font-size: 12px; color: var(--c-text-soft); }
.l1x-raw summary { cursor: pointer; }
.l1x-pre { margin: 8px 0 0; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--c-surface-2); border: 1px solid var(--c-line); font-family: var(--font-mono); font-size: 11.5px; line-height: 1.7; overflow: auto; }
.l1x-badges { display: flex; flex-wrap: wrap; gap: 8px; }
.l1x-badge { display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 10px; border-radius: var(--radius-pill); font-size: 12px; border: 1px solid var(--c-line); background: var(--c-surface-2); color: var(--c-text); }
.l1x-badge b { font-size: 12px; }
.l1x-badge i { font-style: normal; font-family: var(--font-mono); font-size: 10.5px; color: var(--c-muted); }
.l1x-badge.is-ok { border-color: color-mix(in srgb, var(--c-success) 45%, transparent); }
.l1x-badge.is-warn { border-color: color-mix(in srgb, var(--c-warn) 55%, transparent); }
.l1x-fail { padding: 18px 14px; border: 1px dashed color-mix(in srgb, var(--c-danger) 55%, transparent); border-radius: var(--radius-sm); color: var(--c-danger); font-size: 12.5px; }
`;
  document.head.appendChild(st);
}

/* ---------------------------------------------------------
 * 1) Small helpers: escaping / CSV parsing / mini d3 array functions
 * ------------------------------------------------------- */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Tiny CSV parser: supports quoted fields and BOM (good enough for this chapter's 80 rows)
function parseCSV(text) {
  const s = String(text).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuote) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuote = false; }
      } else { field += c; }
    } else if (c === '"') { inQuote = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

// Turn a 2-D array into an array of objects (header → key)
function toObjects(rows) {
  const head = rows[0];
  return rows.slice(1)
    .filter((r) => r.length === head.length)
    .map((r) => {
      const o = {};
      head.forEach((h, i) => { o[h] = r[i]; });
      return o;
    });
}

// Exactly equivalent to transformRow in the page's "Key code" section
function transformRow(d) {
  return {
    id: +d['序号'],
    name: String(d['姓名']).trim(),
    gender: String(d['性别']).trim(),
    birthday: new Date(String(d['生日']).trim()),
    age: +d['年龄'],
    class: String(d['班级']).trim(),
    hometown: String(d['籍贯']).trim(),
    ethnicity: String(d['民族']).trim(),
  };
}

// Minimal equivalents of d3's 8 array functions + group / rollup (used for the demos)
const mini = {
  map: (it, f) => Array.from(it, f),
  reduce: (it, f, init) => Array.from(it).reduce(f, init),
  cross: (a, b) => Array.from(a).flatMap((x) => Array.from(b).map((y) => [x, y])),
  merge: (arrs) => Array.from(arrs).reduce((acc, a) => acc.concat(Array.from(a)), []),
  pairs: (it) => {
    const a = Array.from(it), out = [];
    for (let i = 1; i < a.length; i++) out.push([a[i - 1], a[i]]);
    return out;
  },
  transpose: (m) => {
    const a = Array.from(m, (r) => Array.from(r));
    return a[0].map((_v, i) => a.map((r) => r[i]));
  },
  zip: (...arrs) => {
    const A = arrs.map((a) => Array.from(a));
    const n = Math.min(...A.map((a) => a.length));
    return Array.from({ length: n }, (_v, i) => A.map((a) => a[i]));
  },
  filter: (it, f) => Array.from(it).filter(f),
  group: (it, key) => {
    const m = new Map();
    for (const d of it) {
      const k = key(d);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    }
    return m;
  },
  rollup: (it, reducer, key) => {
    const m = mini.group(it, key), out = new Map();
    for (const [k, v] of m) out.set(k, reducer(v));
    return out;
  },
};

/* =========================================================
 * Demo 1.1 —— data loading + field mapping + type verification
 * ======================================================= */
DEMOS['d-1-1'] = async (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--primary" data-role="reload">Reload</button>
      <span class="demo-control">Records <b class="val" data-role="count">—</b></span>
    </div>
    <div class="console" data-role="log">Waiting to load…</div>
    <div class="demo-sub">
      <h4>Transformed data (first 10 rows)</h4>
      <div class="table-scroll" data-role="table"></div>
    </div>
  `;

  const logEl = mount.querySelector('[data-role="log"]');
  const tableEl = mount.querySelector('[data-role="table"]');
  const countEl = mount.querySelector('[data-role="count"]');
  const lines = [];
  const say = (msg) => { lines.push(msg); logEl.textContent = lines.join('\n'); };

  async function run() {
    lines.length = 0;
    say('⏳ Loading ../../lesson-01/data/newstudent.csv …');
    try {
      const res = await fetch('../../lesson-01/data/newstudent.csv', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = toObjects(parseCSV(await res.text())).map(transformRow);
      countEl.textContent = data.length;

      say('✓ ' + data.length + ' records (every row converted by transformRow)');
      say('');
      say('[Type verification]');
      say('  typeof data[0].age              → ' + typeof data[0].age);
      say('  data[0].birthday instanceof Date → ' + (data[0].birthday instanceof Date));
      say('  data[0].age + 1                 → ' + (data[0].age + 1) + ' (Number can be used in calculations)');
      say('  typeof data[0].class            → ' + typeof data[0].class + ' (no trailing space after trim)');
      say('');
      say('[First 3 records]');
      say(JSON.stringify(data.slice(0, 3).map((d) => ({
        ...d, birthday: d.birthday.toISOString().slice(0, 10),
      })), null, 2));

      tableEl.innerHTML = `
        <table class="mini-table">
          <thead><tr>
            <th>id</th><th>name</th><th>gender</th><th>birthday</th>
            <th>age</th><th>class</th><th>hometown</th><th>ethnicity</th>
          </tr></thead>
          <tbody>${data.slice(0, 10).map((d) => `<tr>
            <td>${d.id}</td><td>${esc(d.name)}</td><td>${esc(d.gender)}</td>
            <td>${d.birthday.toISOString().slice(0, 10)}</td>
            <td>${d.age}</td><td>${esc(d.class)}</td>
            <td>${esc(d.hometown)}</td><td>${esc(d.ethnicity)}</td>
          </tr>`).join('')}</tbody>
        </table>`;
    } catch (err) {
      countEl.textContent = '—';
      tableEl.innerHTML = '';
      say('✗ Load failed: ' + (err && err.message || err));
      say('');
      say('Hint: when the page is opened directly via file://, the browser blocks fetch with a CORS error.');
      say('     Open it through a local static server (for example python -m http.server) and try again.');
    }
  }

  mount.querySelector('[data-role="reload"]').addEventListener('click', run);
  await run();
};

/* =========================================================
 * Demo 1.2 —— interactive DIKW pyramid
 * ======================================================= */
DEMOS['d-1-2'] = (mount) => {
  const W = 560, H = 348, cx = W / 2;
  const LAYERS = [
    { cn: '智慧', en: 'Wisdom', token: 'var(--ch-4)', topW: 70, h: 64, yTop: 14,
      desc: 'Using knowledge to make wise judgments and strategic decisions.',
      asks: 'Why / what should be done',
      viz: 'Strategic dashboards, decision trees',
      edge: '❌ Beyond the scope of visualization' },
    { cn: '知识', en: 'Knowledge', token: 'var(--ch-1)', topW: 106, h: 76, yTop: 78,
      desc: 'Refining information further into patterns, regularities and relationships.',
      asks: 'How',
      viz: 'Statistical models, machine-learning predictions',
      edge: '⚠️ Needs statistical models; graphics alone rarely suffice' },
    { cn: '信息', en: 'Information', token: 'var(--ch-3)', topW: 142, h: 88, yTop: 154,
      desc: 'Data that has been processed, organized and given context.',
      asks: 'Who / what / when / where',
      viz: 'Line charts, bar charts, heatmaps',
      edge: '✅ The main battlefield of visualization' },
    { cn: '数据', en: 'Data', token: 'var(--ch-8)', topW: 178, h: 96, yTop: 242,
      desc: 'Raw, discrete observations lacking context and meaning.',
      asks: '— (no context yet)',
      viz: 'Raw tables, CSV files',
      edge: 'The starting point: everything begins here' },
  ];

  mount.innerHTML = `
    <div class="demo-grid">
      <div>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="DIKW pyramid: from bottom to top the four layers are Data, Information, Knowledge and Wisdom">
          ${LAYERS.map((L, i) => {
            const botW = L.topW + 36;
            const yBot = L.yTop + L.h;
            const d = `M ${cx - L.topW / 2} ${L.yTop} L ${cx + L.topW / 2} ${L.yTop}`
                    + ` L ${cx + botW / 2} ${yBot} L ${cx - botW / 2} ${yBot} Z`;
            return `<g class="l1-dikw-layer" data-layer="${i}" role="button" tabindex="0"
                       aria-label="${L.en} layer">
              <path d="${d}" style="fill: ${L.token};"/>
              <text x="${cx}" y="${(L.yTop + yBot) / 2}" text-anchor="middle"
                    dominant-baseline="middle"
                    style="fill: #fff; paint-order: stroke; stroke: #0e1119; stroke-width: 3px; font-size: 14px; font-weight: 700;">${L.en}</text>
            </g>`;
          }).join('')}
        </svg>
      </div>
      <div class="demo-detail" data-role="detail">← Click any layer of the pyramid to see which question it answers and what visualization it maps to</div>
    </div>
    <p class="demo-note">From bottom to top: Data → Information → Knowledge → Wisdom. <strong>Visualization mainly lifts "Data" to "Information"</strong> (the boundary between the bottom two layers); going higher requires statistical models and decision-making judgment.</p>
  `;

  const detail = mount.querySelector('[data-role="detail"]');
  const layers = [...mount.querySelectorAll('.l1-dikw-layer')];

  function show(i) {
    const L = LAYERS[i];
    layers.forEach((g, j) => g.classList.toggle('is-on', j === i));
    detail.innerHTML = `
      <h4 style="color:${L.token}">${L.en}</h4>
      <p>${L.desc}</p>
      <p><strong>Question it answers:</strong>${L.asks}</p>
      <p><strong>Typical visualizations:</strong>${L.viz}</p>
      <p><span class="pill ${i <= 1 ? 'pill--ok' : i === 2 ? 'pill--warn' : 'pill--no'}">
        ${L.cn === '信息' ? 'Visualization main battlefield' : L.cn === '数据' ? 'Starting point' : L.cn === '知识' ? 'Needs models' : 'Out of scope'}
      </span> ${L.edge}</p>`;
  }

  layers.forEach((g) => {
    g.addEventListener('click', () => show(+g.dataset.layer));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(+g.dataset.layer); }
    });
  });
  show(1); // default to the "Information" layer to make the point right away
};

/* =========================================================
 * Demo 1.3 —— attribute × visual channel (3 correct matches + 1 mismatch)
 * ======================================================= */
DEMOS['d-1-3'] = (mount) => {
  const DATA = [
    { name: 'Zhang San', major: 'Software Engineering', age: 18 },
    { name: 'Li Si', major: 'Software Engineering', age: 19 },
    { name: 'Wang Wu', major: 'Software Engineering', age: 20 },
    { name: 'Zhao Liu', major: 'Software Engineering', age: 17 },
    { name: 'Sun Qi', major: 'Data Science', age: 21 },
    { name: 'Zhou Ba', major: 'Data Science', age: 22 },
    { name: 'Wu Jiu', major: 'Data Science', age: 19 },
  ];
  const HUE = { 'Software Engineering': 'var(--ch-1)', 'Data Science': 'var(--ch-3)' };

  mount.innerHTML = `
    <div class="demo-sub is-good">
      <h4>① Nominal → Hue (✓ correct)</h4>
      <p class="demo-note">Major is a category with no order — distinguishing by different <strong>hues</strong> fits best.</p>
      <svg viewBox="0 0 600 108" role="img" aria-label="Blocks distinguished by different colors per major">
        ${DATA.map((d, i) => {
          const x = 30 + i * 80;
          return `<rect x="${x}" y="14" width="62" height="46" rx="8" style="fill: ${HUE[d.major]};"/>
                  <text x="${x + 31}" y="80" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11.5px;">${d.name}</text>`;
        }).join('')}
        <text x="30" y="102" style="fill: var(--c-muted); font-size: 11px;">■ Software Engineering (--ch-1)&nbsp;&nbsp;■ Data Science (--ch-3)</text>
      </svg>
    </div>

    <div class="demo-sub is-good">
      <h4>② Ordinal → Lightness (✓ correct)</h4>
      <p class="demo-note">Grades 1→5 are ordered but have no fixed interval — express the order with <strong>lightness</strong> gradations.</p>
      <svg viewBox="0 0 600 74" role="img" aria-label="Five grades shown as lightness blocks from light to dark">
        ${[1, 2, 3, 4, 5].map((lv, i) => {
          const x = 30 + i * 110;
          const mix = 8 + i * 20;   // 8% → 88%; darker means a higher grade
          return `<rect x="${x}" y="14" width="92" height="40" rx="8"
                    style="fill: color-mix(in srgb, var(--c-text) ${mix}%, var(--c-surface));"/>
                  <text x="${x + 46}" y="40" text-anchor="middle"
                    style="fill: ${i >= 3 ? 'var(--c-on-primary)' : 'var(--c-text)'}; font-size: 12px; font-weight: 700;">Grade ${lv}</text>`;
        }).join('')}
      </svg>
    </div>

    <div class="demo-sub is-good">
      <h4>③ Ratio → Position (✓ correct)</h4>
      <p class="demo-note">Age is ratio data — once mapped to <strong>position</strong>, who is older and by how much is readable at a glance.</p>
      <svg viewBox="0 0 600 208" role="img" aria-label="Dot plot of seven students on a horizontal position axis by age">
        <line x1="70" y1="176" x2="576" y2="176" style="stroke: var(--c-line-2); stroke-width: 1.4;"/>
        ${[17, 18, 19, 20, 21, 22].map((t) => {
          const x = 70 + (t - 17) / 5 * 506;
          return `<line x1="${x}" y1="176" x2="${x}" y2="181" style="stroke: var(--c-line-2);"/>
                  <text x="${x}" y="196" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">${t}</text>`;
        }).join('')}
        ${DATA.map((d, i) => {
          const y = 20 + i * 22;
          const x = 70 + (d.age - 17) / 5 * 506;
          return `<path d="M ${x} ${y + 7} L 562 ${y + 7}" style="stroke: var(--c-line); stroke-width: 1;" stroke-dasharray="2 4"/>
                  <circle cx="${x}" cy="${y + 7}" r="7.5" style="fill: var(--ch-1);"/>
                  <text x="62" y="${y + 11}" text-anchor="end" style="fill: var(--c-text-soft); font-size: 11.5px;">${d.name}</text>`;
        }).join('')}
        <text x="590" y="168" text-anchor="end" style="fill: var(--c-muted); font-size: 11px;">Age →</text>
      </svg>
    </div>

    <div class="demo-sub is-bad">
      <h4>④ ❌ Ratio → Hue (mismatch: can't tell magnitude)</h4>
      <p class="demo-note">Cramming age into <strong>hue</strong> (a rainbow scale) — plenty of colors, yet readers cannot tell which age is larger, and it fails completely for readers with color-vision deficiency.</p>
      <svg viewBox="0 0 600 108" role="img" aria-label="A bad example: the same ages encoded with rainbow hues">
        ${DATA.map((d, i) => {
          const x = 30 + i * 80;
          const hue = (d.age - 17) / 5 * 300;   // deliberately using a rainbow scale: exactly the practice to avoid
          return `<rect x="${x}" y="14" width="62" height="46" rx="8" style="fill: hsl(${hue} 85% 52%);"/>
                  <text x="${x + 31}" y="80" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11.5px;">${d.name} (${d.age})</text>`;
        }).join('')}
      </svg>
    </div>

    <p class="demo-note">Conclusion: for the same dataset, <strong>choosing the right channel</strong> makes differences and order readable; choosing the wrong one leaves only "a riot of colors". That is the practical meaning of the Stevens × Mackinlay matching matrix.</p>
  `;
};

/* =========================================================
 * Demo 1.4 —— the 8 transform functions + data-flow pipe
 * ======================================================= */
DEMOS['d-1-4'] = (mount) => {
  const SAMPLE_STUDENTS = [
    { c: 'Class 1', n: 1 }, { c: 'Class 1', n: 2 }, { c: 'Class 2', n: 3 }, { c: 'Class 2', n: 4 },
  ];
  const SPECS = {
    map:        { input: '[1, 2, 3, 4]',               hint: 'Square every element',              run: () => mini.map([1, 2, 3, 4], (x) => x * x) },
    reduce:     { input: '[1, 2, 3, 4]',               hint: 'Sum all elements',                  run: () => mini.reduce([1, 2, 3, 4], (a, b) => a + b, 0) },
    cross:      { input: '["A","B"] × [1, 2]',         hint: 'Cartesian product of two sets',     run: () => mini.cross(['A', 'B'], [1, 2]) },
    merge:      { input: '[[1,2], [3,4], [5]]',        hint: 'Flatten nested arrays into one dimension', run: () => mini.merge([[1, 2], [3, 4], [5]]) },
    pairs:      { input: '[1, 2, 3, 4]',               hint: 'Pair up adjacent elements',         run: () => mini.pairs([1, 2, 3, 4]) },
    transpose:  { input: '[[1,2,3], [4,5,6]]',         hint: 'Matrix transpose (swap rows and columns)', run: () => mini.transpose([[1, 2, 3], [4, 5, 6]]) },
    zip:        { input: '["A","B","C"] + [1, 2, 3]',  hint: 'Merge multiple arrays position-wise', run: () => mini.zip(['A', 'B', 'C'], [1, 2, 3]) },
    filter:     { input: '[1, 2, 3, 4, 5]',            hint: 'Keep only values greater than 2',   run: () => mini.filter([1, 2, 3, 4, 5], (x) => x > 2) },
    group:      { input: '4 student records',          hint: 'Group by class, keeping all elements ★', run: () => mini.group(SAMPLE_STUDENTS, (d) => d.c) },
    rollup:     { input: '4 student records',          hint: 'Roll up by class, keeping only the count ★', run: () => mini.rollup(SAMPLE_STUDENTS, (v) => v.length, (d) => d.c) },
  };
  const ORDER = ['map', 'reduce', 'cross', 'merge', 'pairs', 'transpose', 'zip', 'filter', 'group', 'rollup'];

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">Select a function:
        <select data-role="sel">
          ${ORDER.map((k) => `<option value="${k}">d3.${k}</option>`).join('')}
        </select>
      </label>
      <span class="demo-control" data-role="hint"></span>
    </div>

    <svg viewBox="0 0 640 140" role="img" aria-label="Data-flow pipe: an input array passes through a transform function to produce an output array">
      <defs>
        <marker id="l1-arrow" viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" style="fill: var(--c-primary);"/>
        </marker>
      </defs>

      <rect x="2" y="34" width="122" height="58" rx="10"
            style="fill: var(--c-surface-2); stroke: var(--c-border-2);"/>
      <text x="63" y="58" text-anchor="middle" style="fill: var(--c-text); font-size: 12px; font-weight: 700;">Input</text>
      <text x="63" y="76" text-anchor="middle" data-role="in" style="fill: var(--c-muted); font-size: 11px;">—</text>

      <line x1="126" y1="63" x2="212" y2="63" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l1-arrow)"/>

      <rect x="216" y="28" width="208" height="70" rx="10"
            style="fill: color-mix(in srgb, var(--c-primary) 12%, transparent); stroke: color-mix(in srgb, var(--c-primary) 45%, transparent);"/>
      <text x="320" y="58" text-anchor="middle" data-role="fn" style="fill: var(--c-primary); font-size: 15px; font-weight: 800;">d3.map</text>
      <text x="320" y="78" text-anchor="middle" data-role="hint2" style="fill: var(--c-text-soft); font-size: 11px;">Element-wise transform</text>

      <line x1="426" y1="63" x2="512" y2="63" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l1-arrow)"/>

      <rect x="516" y="34" width="122" height="58" rx="10"
            style="fill: color-mix(in srgb, var(--c-success) 12%, transparent); stroke: color-mix(in srgb, var(--c-success) 45%, transparent);"/>
      <text x="577" y="58" text-anchor="middle" style="fill: var(--c-text); font-size: 12px; font-weight: 700;">Output</text>
      <text x="577" y="76" text-anchor="middle" data-role="out" style="fill: var(--c-muted); font-size: 11px;">—</text>

      <line x1="60" y1="124" x2="580" y2="124" style="stroke: var(--c-line); stroke-width: 1.2;"/>
      <circle class="l1-flow-dot" cx="60" cy="124" r="4"
              style="fill: var(--c-primary);"/>
    </svg>

    <div class="console" data-role="log"></div>
    <p class="demo-note"><strong>Key point:</strong> every function returns a <em>new</em> array; the input array itself stays unchanged — so chaining one layer after another is safe (that is what "data-flow pipe" means).</p>
  `;

  const sel = mount.querySelector('[data-role="sel"]');
  const hintEl = mount.querySelector('[data-role="hint"]');
  const logEl = mount.querySelector('[data-role="log"]');

  function show(name) {
    const s = SPECS[name];
    const out = s.run();
    const pretty = out instanceof Map
      ? JSON.stringify([...out], null, 2)
      : JSON.stringify(out, null, 2);
    const outLabel = out instanceof Map ? 'Map(' + out.size + ')' : (Array.isArray(out) ? 'Array(' + out.length + ')' : String(out));

    hintEl.textContent = s.hint;
    mount.querySelector('[data-role="in"]').textContent = s.input;
    mount.querySelector('[data-role="fn"]').textContent = 'd3.' + name;
    mount.querySelector('[data-role="hint2"]').textContent = s.hint;
    mount.querySelector('[data-role="out"]').textContent = outLabel;
    logEl.textContent = 'Input: ' + s.input + '\nOutput: ' + pretty;
  }

  sel.addEventListener('change', (e) => show(e.target.value));
  show('map');
};

/* =========================================================
 * Demo 1.5 —— the three states of Data-Join (enter / update / exit)
 * ======================================================= */
DEMOS['d-1-5'] = (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn" data-act="add">+ Add</button>
      <button type="button" class="demo-btn" data-act="update">⇆ Update values</button>
      <button type="button" class="demo-btn" data-act="remove">− Remove</button>
      <button type="button" class="demo-btn" data-act="reset">Reset</button>
    </div>
    <p class="demo-control">Current data:<code data-role="state">[1, 2, 3]</code></p>

    <div class="demo-stage">
      <div class="l1-join-row" data-role="row"></div>
    </div>

    <div class="demo-legend">
      <span style="color: var(--c-success)"><i></i>enter · added elements</span>
      <span style="color: var(--ch-1)"><i></i>update · existing elements</span>
      <span style="color: var(--c-danger)"><i></i>exit · elements to remove</span>
    </div>
    <p class="demo-note">Click "Add" and new elements come in <strong>green</strong>; "Update" marks existing elements <strong>blue</strong>; on "Remove" the surplus elements turn <strong>red</strong> first and then shrink away — these are the three branches of <code>.join(enter, update, exit)</code>.</p>
  `;

  const row = mount.querySelector('[data-role="row"]');
  const stateEl = mount.querySelector('[data-role="state"]');
  let data = [1, 2, 3];

  /* Simulate D3's data join with an "id → DOM element" map:
     a newly appearing id = enter, an id that still exists = update, a vanished id = exit.

     The animation startup deliberately avoids requestAnimationFrame: it may not
     fire in background tabs / headless environments, leaving elements stuck in
     their initial state (this project has been bitten by that once already).
     Instead we use a synchronous trick: "force a reflow (read offsetWidth) → then
     change the class name immediately". */
  function join() {
    // Elements that are exiting (is-exit) count as "no longer present"; otherwise
    // re-adding the same id right afterwards would be misjudged as an update and
    // reuse an element that is in the middle of disappearing.
    const exiting = new Map(
      [...row.querySelectorAll('.l1-join-dot.is-exit')].map((el) => [el.dataset.id, el])
    );
    const existing = new Map(
      [...row.querySelectorAll('.l1-join-dot:not(.is-exit)')].map((el) => [el.dataset.id, el])
    );
    const next = new Map();

    // enter: in the data but not in the DOM → create
    data.forEach((v) => {
      const id = String(v);
      if (existing.has(id)) return;
      const stale = exiting.get(id);
      if (stale) stale.remove();            // clear leftover elements with the same id to avoid two nodes with one id
      const el = document.createElement('div');
      el.className = 'box l1-join-dot is-enter is-hidden';
      el.dataset.id = id;
      el.textContent = id;
      row.appendChild(el);
      void el.offsetWidth;                  // force a reflow so the initial state is recorded
      el.classList.remove('is-hidden');     // then move to the final state → the transition takes effect
      next.set(id, el);
    });

    // update: present on both sides → change attributes (here, the color)
    data.forEach((v) => {
      const id = String(v);
      const el = existing.get(id);
      if (!el) return;
      el.classList.remove('is-enter');
      el.classList.add('is-update');
      next.set(id, el);
    });

    // exit: in the DOM but not in the data → turn red first, then shrink and remove
    existing.forEach((el, id) => {
      if (next.has(id)) return;
      el.classList.remove('is-update');
      el.classList.add('is-exit');
      void el.offsetWidth;
      el.classList.add('is-hidden');
      setTimeout(() => el.remove(), 320);
    });

    stateEl.textContent = '[' + data.join(', ') + ']';
  }

  mount.querySelector('[data-act="add"]').addEventListener('click', () => {
    const max = data.length ? Math.max(...data) : 0;
    data = [...data, max + 1];
    join();
  });
  mount.querySelector('[data-act="update"]').addEventListener('click', () => {
    data = data.map((d) => +(d + 0.5).toFixed(1));
    join();
  });
  mount.querySelector('[data-act="remove"]').addEventListener('click', () => {
    data = data.slice(0, -1);
    join();
  });
  mount.querySelector('[data-act="reset"]').addEventListener('click', () => {
    data = [1, 2, 3];
    row.innerHTML = '';
    join();
  });

  join();
};

/* =========================================================
 * Startup
 * ======================================================= */
/* =========================================================
 * Original demo 1.x —— Dirty-data ER
 *   A mini dataset carrying 5 typical illnesses: tick the
 *   "prescriptions" to treat it live and watch the type badges
 *   flip from string ⚠ to Number ✓, the chart from failure to success.
 *   Teaching point: cleaning is the first mile of visualization;
 *   autoType only digests "well-behaved" dirt.
 * ======================================================= */
DEMOS['d-1-x'] = (mount) => {
  const DIRTY_CSV = [
    'name,age,spending,enrolled',
    'Alex,18,1285,2024-09-01',
    'Ben,19yo,980,2024/9/2',
    'Chloe,20,"1,105",2024-09-03',
    'Dan,19,,2024-09-04',
    'Alex,18,1285,2024-09-01',
  ].join('\n');
  const RAW = parseCSV(DIRTY_CSV);
  const HEAD = RAW[0];
  const ROWS = toObjects(RAW);

  const FIXES = [
    { id: 'thou', label: '① Remove thousands separators ("1,105" → 1105)' },
    { id: 'miss', label: '② Drop rows with missing spending' },
    { id: 'strip', label: '③ Strip non-numeric characters ("19yo" → 19)' },
    { id: 'date', label: '④ Normalize dates to ISO' },
    { id: 'dup', label: '⑤ Remove exact duplicate rows' },
  ];

  // Simplified autoType: mirrors the three rules used by d3.autoType in the key code
  function inferType(v) {
    const s = String(v ?? '').trim();
    if (s === '') return 'null';
    if (/^-?\d+(\.\d+)?$/.test(s)) return 'number';
    const t = Date.parse(s);
    if (!isNaN(t) && /[/-]/.test(s)) return 'date';
    return 'string';
  }

  mount.innerHTML = `
    <div class="demo-controls">
      <span class="demo-control">Prescriptions (tick to treat):</span>
      ${FIXES.map((f) => `<label class="demo-control"><input type="checkbox" data-fix="${f.id}"> ${f.label}</label>`).join('')}
    </div>

    <div class="l1x-status" data-role="status"></div>

    <div class="demo-grid" style="margin-top:14px">
      <div>
        <p class="l1x-cap">📥 Admission · raw chart (sick cells in red)</p>
        <div class="table-scroll">
          <table class="mini-table" data-role="sick"></table>
        </div>
        <details class="l1x-raw">
          <summary>View the raw CSV text (note why thousands separators need quotes)</summary>
          <pre class="l1x-pre">${esc(DIRTY_CSV)}</pre>
        </details>
      </div>
      <div>
        <p class="l1x-cap">🩺 After treatment · inferred type badges</p>
        <div class="l1x-badges" data-role="badges"></div>
        <div data-role="chartWrap" style="margin-top:12px"></div>
      </div>
    </div>
    <p class="demo-note"><strong>Watch for:</strong> autoType only converts "well-behaved" numbers — <code>"1,105"</code> with a thousands separator, <code>"19yo"</code> with letters, and the empty string are all <em>refused</em> (kept as string or turned into null). Leave any single illness untreated and the chart below fails to render — in real projects, most visualization breakdowns trip on this first mile.</p>
  `;

  const statusEl = mount.querySelector('[data-role="status"]');
  const sickEl = mount.querySelector('[data-role="sick"]');
  const badgesEl = mount.querySelector('[data-role="badges"]');
  const chartWrap = mount.querySelector('[data-role="chartWrap"]');
  const boxes = [...mount.querySelectorAll('[data-fix]')];

  function sickMarks(d, r) {
    const age = String(d['age']).trim();
    const spend = String(d['spending']).trim();
    const date = String(d['enrolled']).trim();
    const dup = r > 0 && ROWS.slice(0, r).some((p) => JSON.stringify(p) === JSON.stringify(d));
    return {
      'name': dup,
      'age': inferType(age) === 'string',
      'spending': /,/.test(spend) || spend === '',
      'enrolled': !/^\d{4}-\d{2}-\d{2}$/.test(date),
    };
  }

  function renderSick() {
    sickEl.innerHTML = `<thead><tr>${HEAD.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>`
      + ROWS.map((d, r) => {
        const marks = sickMarks(d, r);
        return `<tr>${HEAD.map((h) => `<td${marks[h] ? ' class="l1x-sick"' : ''}>${esc(String(d[h]).trim() || '∅')}</td>`).join('')}</tr>`;
      }).join('') + '</tbody>';
  }

  function colBadge(name, vals) {
    const counts = {};
    vals.forEach((v) => { const t = inferType(v); counts[t] = (counts[t] || 0) + 1; });
    const bad = counts.string || counts.null;
    const detail = Object.entries(counts).map(([t, n]) => `${n}×${t}`).join(' · ');
    return `<span class="l1x-badge ${bad ? 'is-warn' : 'is-ok'}">${name}<b>${bad ? ' ⚠ ' : ' ✓ '}</b><i>${detail}</i></span>`;
  }

  function treat() {
    const fx = {};
    boxes.forEach((b) => { fx[b.dataset.fix] = b.checked; });

    let out = ROWS.map((d) => {
      let age = String(d['age'] ?? '').trim();
      let spend = String(d['spending'] ?? '').trim();
      let date = String(d['enrolled'] ?? '').trim();
      if (fx.thou) spend = spend.replace(/,/g, '');
      if (fx.strip) { age = age.replace(/[^0-9.]/g, ''); spend = spend.replace(/[^0-9.]/g, ''); }
      if (fx.date && date) { const t = Date.parse(date); if (!isNaN(t)) date = new Date(t).toISOString().slice(0, 10); }
      return { name: String(d['name'] ?? '').trim(), age, spend, date };
    });
    if (fx.miss) out = out.filter((d) => d.spend !== '');
    if (fx.dup) {
      const seen = new Set();
      out = out.filter((d) => { const k = JSON.stringify(d); if (seen.has(k)) return false; seen.add(k); return true; });
    }

    statusEl.textContent = `Treatment progress ${FIXES.filter((f) => fx[f.id]).length} / ${FIXES.length} · rows ${ROWS.length} → ${out.length}`;

    badgesEl.innerHTML =
      colBadge('Age', out.map((d) => d.age))
      + colBadge('Spending', out.map((d) => d.spend))
      + colBadge('Enrolled', out.map((d) => d.date));

    const ok = out.length >= 2 && out.every((d) => /^-?\d+(\.\d+)?$/.test(d.spend));
    if (!ok) {
      const why = out.some((d) => d.spend === '') ? 'contains missing values (null)' : 'contains non-numeric strings';
      chartWrap.innerHTML = `<div class="l1x-fail">⛔ Chart render failed: the spending column ${why} — any row that is not a Number makes the whole column unusable.</div>`;
      return;
    }
    const vals = out.map((d) => +d.spend);
    const max = Math.max(...vals);
    const W = 320, rowH = 34;
    chartWrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${out.length * rowH + 26}" role="img" aria-label="Bar chart of spending after cleaning">
        <text x="0" y="12" style="fill: var(--c-text-soft); font-size: 11px; font-weight: 700;">✅ Spending bar chart (drawable only after cleaning)</text>
        ${out.map((d, i) => {
          const w = (vals[i] / max) * (W - 96);
          return `<g transform="translate(0 ${26 + i * rowH})">
            <text x="0" y="17" style="fill: var(--c-text); font-size: 11px;">${esc(d.name)}</text>
            <rect x="52" y="4" width="${w.toFixed(1)}" height="18" rx="4" style="fill: var(--c-primary); opacity: .85;"/>
            <text x="${(54 + w).toFixed(1)}" y="17" style="fill: var(--c-text-soft); font-size: 10.5px; font-family: var(--font-mono);">${vals[i]}</text>
          </g>`;
        }).join('')}
      </svg>`;
  }

  boxes.forEach((b) => b.addEventListener('change', treat));
  renderSick();
  treat();
};

/* =========================================================
 * Startup
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('Chapter 1 · Data', { lesson: 'lesson-01' });
