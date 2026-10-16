// =========================================================
// lesson-02/lesson.js —— runnable demos for Chapter 2, "The Visualization Pipeline"
// ---------------------------------------------------------
// Conventions (agreed with lesson-core.js):
//   ① register demos with window.DEMOS['d-2-x'] = fn
//   ② the page mounts them with <div class="demo-mount" data-demo="d-2-x">
//   ③ finally call initLesson('Chapter 2 · The Visualization Pipeline', { lesson: 'lesson-02' })
//
// Dependency policy: every demo in this chapter is built with "native DOM + inline
//   SVG" and pulls in no D3 runtime. Two reasons: ① the site must stay zero-build
//   and work offline, so d3 cannot be bundled into the repo; ② what this chapter
//   demonstrates is D3's "ideas" (data flow / rollup aggregation / tree layout /
//   event delegation), and a few dozen lines of equivalent code actually make the
//   mechanism clearer. The real D3 calls appear in the page's code blocks.
//
// Animation discipline: frame-by-frame animation APIs are **banned throughout**
//   (they may never fire in headless browsers / background tabs — this project has
//   been bitten before). Always use the synchronous trick "force a reflow with
//   void el.offsetWidth → toggle a class → let the CSS transition take over",
//   or step through stages with setTimeout.
// =========================================================

import { initLesson } from '../../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) Styles used only by this chapter's demos (injected once,
 *    without polluting the shared stylesheets)
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson02-styles')) return;
  const st = document.createElement('style');
  st.id = 'lesson02-styles';
  st.textContent = `
/* ---------- 2.1 Data-flow pipeline: light the stages one by one ---------- */
.l2-pipe-stage { cursor: pointer; opacity: .42;
  transition: opacity var(--dur-base) var(--ease), filter var(--dur-base) var(--ease); }
.l2-pipe-stage:hover { opacity: .78; filter: brightness(1.08); }
.l2-pipe-stage.is-on { opacity: 1; filter: brightness(1.06) saturate(1.04); }

/* ---------- 2.2 rollup folding: collapse level by level ---------- */
.l2-fold-stage { min-height: 216px; }
.l2-fold-panel { opacity: 0; transform: translateY(10px);
  transition: opacity var(--dur-base) var(--ease), transform var(--dur-base) var(--ease); }
.l2-fold-panel.is-in { opacity: 1; transform: none; }
.l2-fold-chip { opacity: 0; transform: translateY(8px);
  transition: opacity var(--dur-base) var(--ease), transform var(--dur-base) var(--ease);
  transition-delay: calc(var(--i, 0) * 20ms); }
.l2-fold-panel.is-in .l2-fold-chip { opacity: 1; transform: none; }
.l2-fold-head { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline;
  margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--c-text); }
.l2-fold-head span { font-size: 12px; font-weight: 600; color: var(--c-muted); }
.l2-bucket { padding: 9px 12px; margin-bottom: 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--c-line); background: var(--c-surface-2);
  display: flex; align-items: center; gap: 10px; }
.l2-bucket__bar { flex: 1 1 auto; height: 8px; border-radius: var(--radius-pill);
  background: var(--c-surface); overflow: hidden; }
.l2-bucket__bar i { display: block; height: 100%; border-radius: inherit;
  transition: width var(--dur-base) var(--ease); }
.l2-bucket__num { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--c-text); }
.l2-nest { padding: 10px 12px; margin-bottom: 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--c-line); background: var(--c-surface-2); }
.l2-nest__t { font-size: 12.5px; font-weight: 700; color: var(--c-text); margin-bottom: 6px; }
.l2-nest__row { display: flex; align-items: center; gap: 8px; font-size: 12px;
  color: var(--c-text-soft); font-family: var(--font-mono); }
.l2-dots { display: flex; gap: 6px; margin: 14px 0 0; align-items: center; }
.l2-dots b { font-size: 12px; color: var(--c-muted); font-weight: 600; margin-right: 4px; }
.l2-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--c-border-2);
  transition: background-color var(--dur-fast) var(--ease); }
.l2-dot.is-on { background: var(--c-primary); }

/* ---------- 2.3 Reingold–Tilford tree layout ---------- */
.l2-rt-node { transition: transform var(--dur-base) var(--ease); }
.l2-rt-node circle { transition: fill var(--dur-base) var(--ease); }
.l2-rt-node.is-hi circle { fill: var(--c-primary); }
.l2-rt-node.is-hi text { fill: var(--c-primary); font-weight: 700; }
.l2-rt-link { transition: opacity var(--dur-base) var(--ease); }

/* ---------- 2.4 Event-delegation bubble tracer ---------- */
.l2-ed-scene { display: block; }
.l2-ed-node { padding: 10px 12px; border: 1px solid var(--c-line-2);
  border-radius: var(--radius-sm); background: var(--c-surface);
  font-size: 12.5px; color: var(--c-text-soft);
  transition: background-color var(--dur-base) var(--ease),
              border-color var(--dur-base) var(--ease),
              box-shadow var(--dur-base) var(--ease); }
.l2-ed-node + .l2-ed-node, .l2-ed-node .l2-ed-node { margin-top: 8px; }
.l2-ed-node.is-hit { background: color-mix(in srgb, var(--c-primary) 16%, var(--c-surface));
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 22%, transparent); }
.l2-ed-node.is-cut { background: color-mix(in srgb, var(--c-danger) 14%, var(--c-surface));
  border-color: var(--c-danger); }
.l2-ed-target { display: inline-block; margin-top: 6px; padding: 4px 10px;
  border-radius: var(--radius-pill); cursor: pointer;
  background: color-mix(in srgb, var(--c-accent-2) 26%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-accent) 52%, transparent);
  color: var(--c-text); font-weight: 700; }
.l2-ed-tag { font-family: var(--font-mono); font-size: 10.5px; color: var(--c-muted); }
.l2-cmp-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12.5px; }
.l2-cmp-label { flex: 0 0 72px; color: var(--c-text-soft); font-weight: 600; }
.l2-cmp-track { flex: 1 1 auto; height: 12px; border-radius: var(--radius-pill);
  background: var(--c-surface-2); overflow: hidden; }
.l2-cmp-track i { display: block; height: 100%; min-width: 3px; border-radius: inherit;
  background: var(--c-primary); transition: width var(--dur-base) var(--ease); }
.l2-cmp-track.is-deleg i { background: var(--c-success); }
.l2-cmp-num { flex: 0 0 54px; text-align: right; font-family: var(--font-mono);
  font-weight: 700; color: var(--c-text); }

/* Motion fallback: an extra safety net for this page's demo areas */
@media (prefers-reduced-motion: reduce) {
  .demo-mount, .demo-mount * { transition: none !important; animation: none !important; }
}
`;
  document.head.appendChild(st);
}

/* ---------------------------------------------------------
 * 1) Small utilities: escaping / CSV parsing / mini group·rollup / data loading
 * ------------------------------------------------------- */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A tiny CSV parser: supports quoted fields and BOM (enough for this chapter's 80 rows)
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

// Derive the major from a class name: "软件工程1班" → "软件工程" (non-greedy match)
function majorFromClass(cls) {
  const m = String(cls).match(/^(.+?)(\d+班)$/);
  return m ? m[1].trim() : String(cls).trim();
}

// Minimal equivalent of d3.group / d3.rollup (for demo purposes only)
const mini = {
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

// Load + transform, equivalent to the d3.csv(url, row) callback in the page's key code
async function loadStudents() {
  const res = await fetch('../../lesson-02/data/newstudent.csv', { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const rows = toObjects(parseCSV(await res.text()));
  return rows.map((d) => {
    const cls = String(d['班级']).trim();
    return {
      id: +d['序号'],
      name: String(d['姓名']).trim(),
      gender: String(d['性别']).trim(),
      age: +d['年龄'],
      class: cls,
      major: majorFromClass(cls),
    };
  });
}

// Unified hint when loading fails (file:// gets blocked by CORS)
function corsHint(target, err) {
  if (!target) return;
  target.innerHTML = `
    <div class="callout callout--warn"><p><strong>Failed to load data:</strong>${esc(err && err.message || err)}</p></div>
    <p class="demo-note">When the page is opened directly via <code>file://</code>, the browser blocks <code>fetch</code> with CORS.
      Open it through a local http server (for example <code>python -m http.server</code>) and try again.</p>`;
}

/* =========================================================
 * Demo 2.1 —— the Card / Mackinlay / van Wijk data-flow pipeline diagram
 * ======================================================= */
DEMOS['d-2-1'] = (mount) => {
  const STAGES = [
    {
      cn: '① Raw Data', en: 'Raw Data', token: 'var(--ch-8)',
      duty: 'Data source ingestion: read records from the real world or a database into the program.',
      ops: ['Read CSV / JSON / DB', 'Field mapping (column names → variables)', 'Type coercion (unary + / new Date)'],
      card: 'Pipeline start: Raw Data — everything begins here',
      mack: 'No transformation needed; handed straight to the next mapping-pipeline step',
      wijk: 'The "dataset" users see most directly (CSV / JSON / a table)',
    },
    {
      cn: '② Data Tables', en: 'Data Tables', token: 'var(--ch-3)',
      duty: 'Data transformation: tidy the raw data into clean tables that can be aggregated on demand.',
      ops: ['filter: cleaning & filtering', 'rollup / group: grouped aggregation', 'derive: derived columns (class → major)'],
      card: 'Layer D: the first arrow, "Raw Data → Data Tables"',
      mack: 'First classify each attribute\'s data type (quantitative / ordinal / nominal)',
      wijk: 'Transformations: decide what can be seen next',
    },
    {
      cn: '③ Visual Structure', en: 'Visual Structure', token: 'var(--ch-2)',
      duty: 'Visual mapping: encode data attributes onto marks and visual channels.',
      ops: ['Pick a mark: points / lines / areas', 'Pick channels: position / color / shape', 'Scales and axes'],
      card: 'Layer T: the second arrow, "Data Tables → Visual Structure"',
      mack: 'Core: automatically pick, per data type, the channel with the highest quantitative precision',
      wijk: 'Mapping: "translate" data into readable visual marks',
    },
    {
      cn: '④ Views', en: 'Views', token: 'var(--c-success)',
      duty: 'View rendering + interaction: draw the visual structure onto the screen and take user feedback.',
      ops: ['SVG / DOM rendering', 'Events: click / hover / drag', 'transition animations'],
      card: 'Layer V: C (camera) / L (lighting) / S (screen pixels)',
      mack: 'Once the channels are chosen, rendering only has to present them faithfully',
      wijk: 'Feedback loop: View → Filter → Param → Other Views',
    },
  ];

  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--primary" data-role="play">▶ Step through</button>
      <button type="button" class="demo-btn" data-role="reset">Reset</button>
      <span class="demo-control">Current: <b class="val" data-role="cur">—</b></span>
    </div>
    <div class="demo-grid">
      <div>
        <svg viewBox="0 0 560 176" role="img" aria-label="Data-flow pipeline: Raw Data → Data Tables → Visual Structure → Views, all four stages clickable">
          <defs>
            <marker id="l2-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" style="fill: var(--c-primary);"/>
            </marker>
          </defs>
          ${STAGES.map((s, i) => {
            const bw = 112, gap = 26, x = 17 + i * (bw + gap), y = 40, h = 60;
            const mx = x + bw / 2;
            return `<g class="l2-pipe-stage" data-stage="${i}" role="button" tabindex="0"
                       aria-label="Stage ${i + 1}: ${s.cn}">
              <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="12"
                    style="fill: color-mix(in srgb, ${s.token} 18%, var(--c-surface)); stroke: ${s.token}; stroke-width: 1.6;"/>
              <text x="${mx}" y="${y + 26}" text-anchor="middle" style="fill: var(--c-text); font-size: 12.5px; font-weight: 700;">${s.cn}</text>
              <text x="${mx}" y="${y + 44}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">${s.en}</text>
            </g>`;
          }).join('')}
          <line x1="129" y1="70" x2="152" y2="70" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l2-arrow)"/>
          <line x1="267" y1="70" x2="290" y2="70" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l2-arrow)"/>
          <line x1="405" y1="70" x2="428" y2="70" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l2-arrow)"/>
          <text x="280" y="30" text-anchor="middle" style="fill: var(--c-primary); font-size: 10.5px; font-weight: 700;">Transform D→T</text>
          <text x="412" y="30" text-anchor="middle" style="fill: var(--c-primary); font-size: 10.5px; font-weight: 700;">Map T→V</text>
          <text x="472" y="30" text-anchor="middle" style="fill: var(--c-primary); font-size: 10.5px; font-weight: 700;">Render V→C/L/S</text>
          <path d="M497 106 Q497 152 280 152 Q63 152 63 106" fill="none" stroke-dasharray="4 4"
                style="stroke: var(--c-warn); stroke-width: 1.3;"/>
          <text x="280" y="168" text-anchor="middle" style="fill: var(--c-warn); font-size: 10.5px; font-weight: 700;">Interaction feedback loop · van Wijk</text>
        </svg>
      </div>
      <div class="demo-detail" data-role="detail">← Click any stage of the pipeline to see its duty, typical operations, and how it maps onto the three models.</div>
    </div>
    <p class="demo-note"><strong>How to read this diagram:</strong> Card orders the four pipeline stages, Mackinlay drives the automatic decisions of stage 3, and van Wijk loops stage 4 back to the start with a feedback loop — <strong>the three stack; they don't conflict</strong>.</p>
  `;

  const stages = [...mount.querySelectorAll('.l2-pipe-stage')];
  const detail = mount.querySelector('[data-role="detail"]');
  const cur = mount.querySelector('[data-role="cur"]');
  let timer = null;

  function showDetail(i) {
    const s = STAGES[i];
    cur.textContent = s.cn;
    detail.innerHTML = `
      <h4 style="color:${s.token}">${s.cn} (${s.en})</h4>
      <p><strong>Duty:</strong>${s.duty}</p>
      <p><strong>Typical operations:</strong>${s.ops.map((o) => esc(o)).join(' · ')}</p>
      <p><strong>Mapping onto the three models:</strong></p>
      <p>· <b>Card</b>: ${s.card}</p>
      <p>· <b>Mackinlay</b>: ${s.mack}</p>
      <p>· <b>van Wijk</b>: ${s.wijk}</p>`;
  }

  function stopPlay() { if (timer) { clearTimeout(timer); timer = null; } }

  function selectOnly(i) {
    stopPlay();
    stages.forEach((g, j) => g.classList.toggle('is-on', j === i));
    showDetail(i);
  }

  function play() {
    stopPlay();
    stages.forEach((g) => g.classList.remove('is-on'));
    let i = 0;
    const tick = () => {
      if (i >= stages.length) { timer = null; return; }
      stages[i].classList.add('is-on');
      showDetail(i);
      i++;
      timer = setTimeout(tick, 620);
    };
    tick();
  }

  stages.forEach((g) => {
    g.addEventListener('click', () => selectOnly(+g.dataset.stage));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOnly(+g.dataset.stage); }
    });
  });
  mount.querySelector('[data-role="play"]').addEventListener('click', play);
  mount.querySelector('[data-role="reset"]').addEventListener('click', () => {
    stopPlay();
    stages.forEach((g) => g.classList.remove('is-on'));
    cur.textContent = '—';
    detail.textContent = '← Click any stage of the pipeline to see its duty, typical operations, and how it maps onto the three models.';
  });

  selectOnly(0);
};

/* =========================================================
 * Demo 2.2 —— d3.rollup aggregation animation (detail table → grouped counts → nested aggregation)
 * ======================================================= */
DEMOS['d-2-2'] = async (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn" data-role="prev">Previous</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">Next →</button>
      <button type="button" class="demo-btn" data-role="replay">Replay</button>
      <span class="demo-control"><b class="val" data-role="count">—</b> records in total</span>
    </div>
    <div class="demo-stage">
      <div class="l2-fold-stage" data-role="stage"><p class="demo-note">Loading data…</p></div>
    </div>
    <div class="l2-dots" data-role="dots"><b>Steps</b></div>
    <div class="console" data-role="log"></div>
    <p class="demo-note"><strong>Key point:</strong> every extra key layer (the <code>…keys</code> rest parameter) folds the data one level deeper; the return value is always a <code>Map</code>, and nested keys give nested Maps.</p>
  `;

  const stageEl = mount.querySelector('[data-role="stage"]');
  const logEl = mount.querySelector('[data-role="log"]');
  const dotsEl = mount.querySelector('[data-role="dots"]');
  const countEl = mount.querySelector('[data-role="count"]');

  let students;
  try {
    students = await loadStudents();
  } catch (err) {
    corsHint(stageEl, err);
    return;
  }
  countEl.textContent = students.length;

  const byClass = mini.group(students, (d) => d.class);
  const countByClass = mini.rollup(students, (v) => v.length, (d) => d.class);
  const nested = new Map();
  for (const [cls, arr] of byClass) {
    nested.set(cls, mini.rollup(arr, (v) => v.length, (d) => d.gender));
  }

  const STEPS = ['① Detail table', '② Group & count', '③ Nested aggregation'];
  const CLS_TOKEN = ['var(--ch-1)', 'var(--ch-3)', 'var(--ch-2)', 'var(--ch-4)', 'var(--ch-5)', 'var(--ch-6)'];
  const classList = [...countByClass.keys()];
  const maxCount = Math.max(...countByClass.values());

  let step = 0;

  // Panel content for each of the three steps
  function panelHTML(s) {
    if (s === 0) {
      const rows = students.slice(0, 12);
      return `
        <div class="l2-fold-head">Detail table · 80 rows × 3 columns <span>(first 12 rows shown)</span></div>
        <div class="table-scroll">
          <table class="mini-table">
            <thead><tr><th>No.</th><th>Name</th><th>Class</th><th>Gender</th></tr></thead>
            <tbody>${rows.map((d, i) => `<tr class="l2-fold-chip" style="--i:${i}">
              <td>${d.id}</td><td>${esc(d.name)}</td><td>${esc(d.class)}</td><td>${esc(d.gender)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`;
    }
    if (s === 1) {
      return `
        <div class="l2-fold-head">Group &amp; count by "class" <span>d3.rollup(students, v =&gt; v.length, d =&gt; d.class)</span></div>
        ${classList.map((cls, i) => {
          const n = countByClass.get(cls);
          const pct = Math.round(n / maxCount * 100);
          return `<div class="l2-bucket l2-fold-chip" style="--i:${i}">
            <span style="flex:0 0 96px; font-size:12.5px; color:var(--c-text);">${esc(cls)}</span>
            <span class="l2-bucket__bar"><i style="width:${pct}%; background:${CLS_TOKEN[i % CLS_TOKEN.length]};"></i></span>
            <span class="l2-bucket__num">${n} students</span>
          </div>`;
        }).join('')}`;
    }
    return `
      <div class="l2-fold-head">Then nest by "gender" <span>Map(class → Map(gender → count))</span></div>
      ${classList.map((cls, i) => {
        const inner = nested.get(cls);
        return `<div class="l2-nest l2-fold-chip" style="--i:${i}">
          <div class="l2-nest__t">${esc(cls)}</div>
          ${['男', '女'].filter((g) => inner.has(g)).map((g) =>
            `<div class="l2-nest__row"><span style="color:${CLS_TOKEN[i % CLS_TOKEN.length]};">└─</span> ${esc(g)}　<b style="color:var(--c-text);">${inner.get(g)}</b> students</div>`
          ).join('')}
        </div>`;
      }).join('')}`;
  }

  function mapLines() {
    const lines = [];
    for (const [cls, inner] of nested) {
      lines.push(cls + '  →  Map(' + inner.size + ')');
      for (const [g, n] of inner) lines.push('    ' + g + ' → ' + n);
    }
    return lines.join('\n');
  }

  function render() {
    stageEl.innerHTML = `<div class="l2-fold-panel">${panelHTML(step)}</div>`;
    const panel = stageEl.querySelector('.l2-fold-panel');
    void panel.offsetWidth;            // force a reflow so the initial state is recorded
    panel.classList.add('is-in');      // then enter the final state → the transition fires

    [...dotsEl.querySelectorAll('.l2-dot')].forEach((d, i) => d.classList.toggle('is-on', i <= step));

    const logs = [
      'Step 1 / 3 · Detail table',
      '  Raw data: ' + students.length + ' freshman records (8 columns)',
      '',
      'Step 2 / 3 · Group & count',
      '  d3.rollup(students, v => v.length, d => d.class)',
      '  → Map(' + countByClass.size + '): ' + classList.map((c) => c + '=' + countByClass.get(c)).join(', '),
      '',
      'Step 3 / 3 · Nested aggregation',
      '  d3.rollup(students, v => v.length, d => d.class, d => d.gender)',
      '  → nested Map:',
      mapLines(),
    ];
    logEl.textContent = logs.slice(0, step * 6 + 1).join('\n');

    mount.querySelector('[data-role="prev"]').disabled = step === 0;
    mount.querySelector('[data-role="next"]').disabled = step === STEPS.length - 1;
  }

  function go(i) { step = Math.max(0, Math.min(STEPS.length - 1, i)); render(); }

  mount.querySelector('[data-role="next"]').addEventListener('click', () => go(step + 1));
  mount.querySelector('[data-role="prev"]').addEventListener('click', () => go(step - 1));
  mount.querySelector('[data-role="replay"]').addEventListener('click', () => {
    step = 0; render();
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i >= STEPS.length) { clearInterval(t); return; }
      go(i);
    }, 900);
  });

  // Step indicator dots
  STEPS.forEach(() => {
    const d = document.createElement('span');
    d.className = 'l2-dot';
    dotsEl.appendChild(d);
  });

  render();
};

/* =========================================================
 * Demo 2.3 —— Reingold–Tilford layout step-through
 * ======================================================= */
DEMOS['d-2-3'] = async (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn" data-role="prev">Previous</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">Next →</button>
      <button type="button" class="demo-btn" data-role="replay">Replay</button>
    </div>
    <div class="demo-stage">
      <svg viewBox="0 0 600 240" role="img" data-role="svg"
           aria-label="A small tree grouped by class and gender, demonstrating the Reingold–Tilford layout step by step"></svg>
    </div>
    <div class="l2-dots" data-role="dots"><b>Steps</b></div>
    <p class="demo-note" data-role="desc">Loading data…</p>
  `;

  const svg = mount.querySelector('[data-role="svg"]');
  const descEl = mount.querySelector('[data-role="desc"]');
  const dotsEl = mount.querySelector('[data-role="dots"]');

  let students;
  try {
    students = await loadStudents();
  } catch (err) {
    corsHint(mount.querySelector('.demo-stage'), err);
    descEl.textContent = '';
    return;
  }

  const byClass = mini.group(students, (d) => d.class);
  const classList = [...byClass.keys()];

  // Build a small tree: 2025 freshmen → class → gender
  const root = { name: '2025 Freshmen', id: 'root', children: classList.map((cls, ci) => ({
    name: cls.replace(/班$/, '班'),
    id: 'c' + ci,
    children: ['男', '女'].filter((g) => byClass.get(cls).some((s) => s.gender === g)).map((g) => ({
      name: g + ' (' + byClass.get(cls).filter((s) => s.gender === g).length + ')',
      id: 'c' + ci + g,
    })),
  }))};

  // Re-implement Reingold–Tilford's coordinate computation ourselves (equivalent to d3.tree())
  let leafCursor = 0;
  function layout(node, depth) {
    node.depth = depth;
    if (!node.children) { node.x = leafCursor; leafCursor += 1; return node.x; }
    const xs = node.children.map((c) => layout(c, depth + 1));
    node.x = (Math.min(...xs) + Math.max(...xs)) / 2;   // parent centered over its children
    return node.x;
  }
  layout(root, 0);

  const nodes = [];
  (function collect(n) { nodes.push(n); if (n.children) n.children.forEach(collect); })(root);
  (function setParent(n) { if (n.children) n.children.forEach((c) => { c.parent = n; setParent(c); }); })(root);

  const W = 600, PAD = 60;
  const maxLeaf = leafCursor - 1;
  const stepX = (W - PAD * 2) / Math.max(1, maxLeaf);
  const depthY = [40, 120, 200];
  const toX = (v) => PAD + v * stepX;
  const centerX = W / 2;

  // Which "current x" each of the three passes has reached
  function posFor(node, s) {
    if (s === 0) return centerX;                       // not laid out yet: everything squeezed on the center axis
    if (s === 1) return node.children ? centerX : toX(node.x);  // bottom-up: the leaves spread out first
    return toX(node.x);                                // top-down: everything in place
  }

  // Build the SVG: links first, nodes after
  svg.innerHTML = `
    <g data-role="links">
      ${nodes.filter((n) => n.children).map((n) => n.children.map((c) =>
        `<line class="l2-rt-link" data-a="${n.id}" data-b="${c.id}" style="stroke: var(--c-border-2); stroke-width: 1.4;"/>`
      ).join('')).join('')}
    </g>
    <g data-role="nodes">
      ${nodes.map((n) => `<g class="l2-rt-node" data-id="${n.id}">
        <circle r="6" style="fill: color-mix(in srgb, var(--c-primary) 70%, transparent);"/>
        <text y="-13" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11px;">${esc(n.name)}</text>
      </g>`).join('')}
    </g>`;

  const linkEls = [...svg.querySelectorAll('.l2-rt-link')];
  const nodeEls = new Map([...svg.querySelectorAll('.l2-rt-node')].map((g) => [g.dataset.id, g]));

  const DESCS = [
    '① Not laid out: all nodes are squeezed right below their parent — overlapping each other, no hierarchy visible. This is exactly the problem layout algorithms solve.',
    '② Pass 1 (bottom-up): measure how much horizontal space each subtree needs — the leaves spread out first by spacing.',
    '③ Pass 2 (top-down): assign each node an absolute x coordinate — a parent is centered over its children.',
    '④ Pass 3 (wrap-up): handle threads and complete the parent–child links for the final tree — the hierarchy is now encoded via the position channel.',
  ];
  let step = 0, linkTimer = null;

  function render() {
    const s = Math.min(step, 3);
    nodes.forEach((n) => {
      const g = nodeEls.get(n.id);
      g.style.transform = `translate(${posFor(n, s)}px, ${depthY[n.depth]}px)`;
      g.classList.toggle('is-hi', s === 2 && !!n.children);
    });

    // Links fade in only after pass 2 (wait until the node animation has roughly settled, avoiding brief misalignment)
    if (linkTimer) { clearTimeout(linkTimer); linkTimer = null; }
    const showLink = s >= 2;
    linkEls.forEach((l) => {
      const a = nodes.find((n) => n.id === l.dataset.a);
      const b = nodes.find((n) => n.id === l.dataset.b);
      const x1 = toX(a.x), y1 = depthY[a.depth];
      const x2 = toX(b.x), y2 = depthY[b.depth];
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.style.opacity = '0';
    });
    if (showLink) {
      linkTimer = setTimeout(() => { linkEls.forEach((l) => { l.style.opacity = '1'; }); }, 240);
    }

    descEl.textContent = DESCS[s];
    [...dotsEl.querySelectorAll('.l2-dot')].forEach((d, i) => d.classList.toggle('is-on', i <= s));
    mount.querySelector('[data-role="prev"]').disabled = step === 0;
    mount.querySelector('[data-role="next"]').disabled = step === 3;
  }

  function go(i) { step = Math.max(0, Math.min(3, i)); render(); }

  mount.querySelector('[data-role="next"]').addEventListener('click', () => go(step + 1));
  mount.querySelector('[data-role="prev"]').addEventListener('click', () => go(step - 1));
  mount.querySelector('[data-role="replay"]').addEventListener('click', () => {
    step = 0; render();
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i > 3) { clearInterval(t); return; }
      go(i);
    }, 1000);
  });

  DESCS.forEach(() => {
    const d = document.createElement('span');
    d.className = 'l2-dot';
    dotsEl.appendChild(d);
  });

  render();
};

/* =========================================================
 * Demo 2.4 —— event-delegation bubble tracer
 * ======================================================= */
DEMOS['d-2-4'] = (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--primary" data-role="sim">Simulate a click</button>
      <button type="button" class="demo-btn" data-role="reset">Reset</button>
      <label class="demo-control"><input type="checkbox" data-role="stop"> <code>stopPropagation()</code> at the li level</label>
      <label class="demo-control">List items
        <select data-role="n">
          <option value="8">8</option>
          <option value="20" selected>20</option>
          <option value="100">100</option>
        </select>
      </label>
    </div>

    <div class="demo-grid">
      <div class="l2-ed-scene" data-role="scene">
        <div class="l2-ed-node" data-node="ul">
          <span class="l2-ed-tag">ul#list · delegated listener (1)</span>
          <div class="l2-ed-node" data-node="li">
            <span class="l2-ed-tag">li · row (stopPropagation can be called at this level)</span>
            <span class="l2-ed-target" data-role="target">span.label ← click here</span>
          </div>
        </div>
      </div>
      <div class="demo-detail" data-role="log">Click the span.label on the left — the event bubbles up the DOM tree, level by level, to the delegated listener on ul.</div>
    </div>

    <div class="demo-sub">
      <h4>Listener count comparison</h4>
      <div class="l2-cmp-row">
        <span class="l2-cmp-label">One per item</span>
        <span class="l2-cmp-track" data-role="track-each"><i></i></span>
        <span class="l2-cmp-num" data-role="num-each">—</span>
      </div>
      <div class="l2-cmp-row">
        <span class="l2-cmp-label">Delegation</span>
        <span class="l2-cmp-track is-deleg" data-role="track-deleg"><i></i></span>
        <span class="l2-cmp-num" data-role="num-deleg">1</span>
      </div>
      <p class="demo-note" data-role="save"></p>
    </div>

    <p class="demo-note"><strong>Mechanism:</strong> listeners fire by default in the <strong>bubble phase</strong>; calling <code>stopPropagation()</code> on the li cuts the bubble chain short, so the delegated listener on ul never fires.</p>
  `;

  const logEl = mount.querySelector('[data-role="log"]');
  const stopCb = mount.querySelector('[data-role="stop"]');
  const nSel = mount.querySelector('[data-role="n"]');
  const scene = mount.querySelector('[data-role="scene"]');
  const nodeEls = new Map([...scene.querySelectorAll('.l2-ed-node')].map((n) => [n.dataset.node, n]));
  const target = mount.querySelector('[data-role="target"]');

  let timers = [];

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function flash(name, delay) {
    timers.push(setTimeout(() => {
      const el = nodeEls.get(name);
      el.classList.add('is-hit');
      timers.push(setTimeout(() => el.classList.remove('is-hit'), 420));
    }, delay));
  }

  // Real DOM structure + real listeners: this is how delegation and bubbling actually behave
  function onTarget() {
    clearTimers();
    nodeEls.forEach((el) => el.classList.remove('is-cut'));
    flash('ul', 200); flash('li', 520);
    if (stopCb.checked) {
      target.classList.add('is-hit');
      timers.push(setTimeout(() => target.classList.remove('is-hit'), 420));
      timers.push(setTimeout(() => {
        nodeEls.get('li').classList.add('is-cut');
        logEl.innerHTML = `<strong>Bubbling cut short:</strong>
          <p>e.target = <code>span.label</code> (the target element)</p>
          <p>· While the event bubbles from span up to <code>li</code>, li's listener calls <code>e.stopPropagation()</code></p>
          <p>· The bubble chain <strong>breaks</strong> here → the delegated listener on the parent <code>ul</code> <strong>never fires</strong></p>
          <p>This is the mechanism behind "clicking a collapse arrow shouldn't select the row".</p>`;
      }, 900));
    } else {
      target.classList.add('is-hit');
      timers.push(setTimeout(() => target.classList.remove('is-hit'), 420));
      timers.push(setTimeout(() => {
        logEl.innerHTML = `<strong>Bubble path:</strong>
          <p>e.target = <code>span.label</code> (the first element hit)</p>
          <p>· span.label → li → ul (bubbling upward level by level)</p>
          <p>· The <strong>single</strong> delegated listener on <code>ul</code> catches the event and locates the row via <code>e.target.closest("li")</code></p>
          <p>· One listener in total handles "telling which row you clicked, whether you hit span or li"</p>`;
      }, 1200));
    }
  }

  target.addEventListener('click', onTarget);
  mount.querySelector('[data-role="sim"]').addEventListener('click', onTarget);
  mount.querySelector('[data-role="reset"]').addEventListener('click', () => {
    clearTimers();
    nodeEls.forEach((el) => el.classList.remove('is-hit', 'is-cut'));
    target.classList.remove('is-hit');
    logEl.textContent = 'Click the span.label on the left — the event bubbles up the DOM tree, level by level, to the delegated listener on ul.';
  });

  function updateCompare() {
    const n = +nSel.value;
    mount.querySelector('[data-role="num-each"]').textContent = n;
    mount.querySelector('[data-role="num-deleg"]').textContent = '1';
    mount.querySelector('[data-role="track-each"] i').style.width = '100%';
    mount.querySelector('[data-role="track-deleg"] i').style.width = Math.max(2, 100 / n) + '%';
    mount.querySelector('[data-role="save"]').textContent =
      `With N = ${n}, one-per-item binding needs ${n} listeners while event delegation needs just 1 — saving ${n - 1}, and a new item #${n + 1} requires no extra binding.`;
  }
  nSel.addEventListener('change', updateCompare);
  updateCompare();
};

/* =========================================================
 * Bootstrap
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('Chapter 2 · The Visualization Pipeline', { lesson: 'lesson-02' });
