// =========================================================
// lesson-04/lesson.js —— runnable demos for Chapter 4 "Low-Dimensional Data"
// ---------------------------------------------------------
// Conventions (matching lesson-core.js):
//   ① Register a demo with window.DEMOS['d-4-x'] = fn
//   ② The page mounts it with <div class="demo-mount" data-demo="d-4-x">
//   ③ Finally call initLesson('Chapter 4 · Low-Dimensional Data', { lesson: 'lesson-04' })
//
// Dependency policy: everything is built with "native DOM + inline SVG" — no D3 runtime,
//   no CDN. Reasons: ① the site must be zero-build and offline-capable; ② we must not put
//   300KB of d3 into the repo; ③ this chapter demonstrates precisely the mechanisms
//   themselves (data reshaping / coordinate transforms / fitting / contours), and an
//   equivalent few-dozen-line implementation reads more clearly. The real D3 calls live in
//   the page's code blocks.
//
// Animation policy: requestAnimationFrame is **disabled** (in this project rAF does not fire
//   in background tabs / headless browsers, which once left elements stuck in their initial
//   state). Instead we use "force reflow + classList toggling + CSS transition", and every
//   play-style demo is driven by setInterval / setTimeout.
// =========================================================

import { initLesson } from '../../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) Styles exclusive to this chapter's demos (injected once, don't pollute the shared sheet)
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson04-styles')) return;
  const st = document.createElement('style');
  st.id = 'lesson04-styles';
  st.textContent = `
/* Shared: the demo SVGs follow the theme */
.l4-scroll { overflow-x: auto; }
.l4-svg { display: block; width: 100%; height: auto; }

/* 4.1 parallel-coordinate curves (highlight / fade during brushing) */
.l4-pc { transition: stroke var(--dur-fast) var(--ease),
                     stroke-width var(--dur-fast) var(--ease),
                     opacity var(--dur-fast) var(--ease); }
.l4-mtx-pt { transition: fill var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease); }

/* 4.2 three layers of coordinates: points move via CSS transform, transition flies them over */
.l4-pt { transition: transform .55s var(--ease); }
.l4-step {
  flex: 1 1 0; min-width: 116px;
  padding: 8px 10px;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
  font-size: 12px; line-height: 1.6; color: var(--c-text-soft);
  transition: var(--t-control);
}
.l4-step b { display: block; font-size: 12.5px; color: var(--c-text); }
.l4-step.is-on {
  border-color: color-mix(in srgb, var(--c-primary) 55%, transparent);
  background: color-mix(in srgb, var(--c-primary) var(--mix-soft), var(--c-surface));
  color: var(--c-text);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-primary) 30%, transparent);
}
.l4-formula {
  margin: 0 0 12px; padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-primary) var(--mix-soft), var(--c-surface));
  border-left: 3px solid color-mix(in srgb, var(--c-primary) 55%, var(--c-border));
  font-family: var(--font-mono); font-size: 12.5px; line-height: 1.8;
  color: color-mix(in srgb, var(--c-primary) var(--mix-ink), var(--c-text));
}
.l4-tr.is-on { background: color-mix(in srgb, var(--c-primary) var(--mix-soft), transparent); }
.l4-cell.is-on { background: color-mix(in srgb, var(--c-primary) 16%, transparent); font-weight: 700; }

/* 4.3 model buttons and the R² ranking bar */
.l4-models { display: flex; flex-wrap: wrap; gap: 8px; }
.l4-models .demo-btn.is-on {
  background: var(--c-primary); border-color: transparent; color: var(--c-on-primary);
}
.l4-rank { margin-top: 4px; }
.l4-rank-row {
  display: grid; grid-template-columns: 92px 1fr 46px;
  align-items: center; gap: 8px;
  padding: 3px 6px; border-radius: 6px; cursor: pointer;
  font-size: 11.5px; color: var(--c-text-soft);
  transition: var(--t-control);
}
.l4-rank-row:hover { background: var(--c-surface-2); }
.l4-rank-row.is-on { background: color-mix(in srgb, var(--c-primary) var(--mix-soft), transparent); color: var(--c-text); font-weight: 700; }
.l4-rank-track { height: 10px; border-radius: var(--radius-pill); background: var(--c-surface-2); overflow: hidden; }
.l4-rank-bar { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--c-primary-2), var(--c-primary)); transition: width var(--dur-base) var(--ease); }
.l4-rank-row.is-neg .l4-rank-bar { background: var(--c-danger); }
.l4-rank-val { font-family: var(--font-mono); text-align: right; }

/* Elements revealed step by step in 4.4 / 4.5 */
.l4-reveal { opacity: 0; transition: opacity var(--dur-base) var(--ease); }
.l4-reveal.is-on { opacity: 1; }

/* 4.5 grid nodes */
.l4-ms-cell { transition: fill var(--dur-base) var(--ease); }
.l4-ms-val { font-family: var(--font-mono); }
.l4-ms-seg { stroke-linecap: round; }

/* Read-only tables inside demos (reuse .mini-table, adding a little padding here) */
.l4-mono { font-family: var(--font-mono); }

@media (prefers-reduced-motion: reduce) {
  .demo-mount, .demo-mount * { transition: none !important; animation: none !important; }
}
`;
  document.head.appendChild(st);
}

/* ---------------------------------------------------------
 * 1) Small helpers: escaping / CSV parsing / least squares / number formatting
 * ------------------------------------------------------- */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A tiny CSV parser: supports quoted fields and BOM (enough for crime.csv)
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
    .map((r) => { const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); return o; });
}

// Simple linear regression (least squares): returns the intercept and slope
function ols(xs, ys) {
  const n = xs.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return { slope: 0, intercept: sy / (n || 1) };
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n };
}

// Gaussian elimination (partial pivoting) to solve A·x = b
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    const t = M[c]; M[c] = M[p]; M[p] = t;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

// Least squares over a set of basis functions (basis length 1 → fit through the origin)
function basisOLS(xs, ys, basis) {
  const cols = basis.map((f) => xs.map(f));
  const n = cols.length;
  if (n === 1) {
    const num = cols[0].reduce((s, v, k) => s + v * ys[k], 0);
    const den = cols[0].reduce((s, v) => s + v * v, 0);
    return [num / (den || 1e-12)];
  }
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) A[i][j] = cols[i].reduce((s, v, k) => s + v * cols[j][k], 0);
    b[i] = cols[i].reduce((s, v, k) => s + v * ys[k], 0);
  }
  return solve(A, b);
}

// Coefficient of determination R² (evaluated in the original space; can be negative)
function r2of(ys, yhat) {
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < ys.length; i++) {
    ssTot += (ys[i] - mean) ** 2;
    ssRes += (ys[i] - (yhat[i] || 0)) ** 2;
  }
  if (Math.abs(ssTot) < 1e-12) return 0;
  return 1 - ssRes / ssTot;
}

// Short number: 3.1k / 27.1M
function short(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  if (a === 0) return '0';
  return a < 1 ? v.toFixed(2) : String(Math.round(v));
}

// Coefficients in formulas: fall back to scientific notation when there are too many decimals
function coef(v) {
  if (!isFinite(v)) return '∞';
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 10000)) return v.toExponential(2).replace('e+', 'e');
  return String(+v.toFixed(3));
}

/* ---------------------------------------------------------
 * 2) crime.csv loading: fall back to a built-in sample on failure (file:// is blocked by CORS)
 * ------------------------------------------------------- */
const CRIME_FALLBACK = [
  ['Alabama', 3979000, 10670, 95380, 156432, 28830, 350],
  ['Alaska', 534000, 1729, 6567, 24719, 9261, 65],
  ['California', 27058000, 254707, 1069909, 2052571, 704240, 3082],
  ['Colorado', 3308000, 7487, 84435, 177896, 27330, 200],
  ['Florida', 11366000, 75868, 441467, 950036, 169436, 1883],
  ['Idaho', 1005000, 1726, 20914, 40647, 6729, 69],
  ['Iowa', 2837000, 4621, 54866, 103961, 21005, 121],
  ['Maine', 1165000, 1526, 26352, 49808, 8415, 77],
  ['Montana', 826000, 869, 16838, 33813, 6046, 55],
  ['New York', 17783000, 162221, 363572, 925836, 131545, 2479],
  ['Texas', 16370000, 54546, 495991, 1013883, 225444, 2606],
  ['Wyoming', 510000, 489, 8900, 21112, 4032, 49],
];

function fallbackRows() {
  return CRIME_FALLBACK.map((a) => ({
    state: a[0], population: a[1], robbery: a[2], burglary: a[3],
    larceny_theft: a[4], motor_vehicle_theft: a[5], murder: a[6],
  }));
}

async function loadCrime() {
  try {
    const res = await fetch('../../lesson-04/data/crime.csv', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = toObjects(parseCSV(await res.text())).map((d) => ({
      state: String(d.state).trim(),
      population: +d.population,
      murder: +d.murder,
      robbery: +d.robbery,
      burglary: +d.burglary,
      larceny_theft: +d.larceny_theft,
      motor_vehicle_theft: +d.motor_vehicle_theft,
    })).filter((d) => d.state && isFinite(d.population) && d.population > 0);
    if (!rows.length) throw new Error('crime.csv parsed to zero rows');
    return { rows, ok: true };
  } catch (err) {
    return { rows: fallbackRows(), ok: false, err };
  }
}

function dataNote(ok) {
  if (ok) return '';
  return '<p class="demo-note">⚠️ Could not read <code>../../lesson-04/data/crime.csv</code>'
    + ' (opening the page directly over file:// is blocked by browser CORS), so the demo fell back to a built-in 12-state sample.'
    + ' Please open it via a local static server (e.g. <code>python -m http.server</code>) to load all 50 states.</p>';
}

/* =========================================================
 * Demo 4.1 —— parallel coordinates + scatterplot matrix (linked brushing)
 * ======================================================= */
DEMOS['d-4-1'] = async (mount) => {
  const { rows, ok } = await loadCrime();

  const METRICS = [
    { key: 'murder', label: 'Murder' },
    { key: 'robbery', label: 'Robbery' },
    { key: 'burglary', label: 'Burglary' },
    { key: 'larceny_theft', label: 'Larceny theft' },
    { key: 'motor_vehicle_theft', label: 'Motor vehicle theft' },
  ];
  const ext = METRICS.map((m) => {
    const vs = rows.map((d) => d[m.key]);
    return { lo: Math.min(...vs), hi: Math.max(...vs) };
  });
  const normOf = (i, v) => {
    const e = ext[i], span = (e.hi - e.lo) || 1;
    return (v - e.lo) / span;
  };

  // ---- Parallel-coordinate layout ----
  const PC_W = 640, PC_TOP = 44, PC_BOT = 196;
  const axisX = (i) => 56 + i * 132;
  const pcY = (n) => PC_TOP + (1 - n) * (PC_BOT - PC_TOP);

  // ---- Scatterplot-matrix layout (using 3 metrics) ----
  const MI = [0, 1, 2];
  const M_CELL = 124, M_INNER = 96, M_PAD = 14, M_X0 = 56, M_Y0 = 26;

  const pcLines = rows.map((d) => {
    const pts = METRICS.map((m, i) => `${axisX(i)},${pcY(normOf(i, d[m.key]))}`).join(' ');
    return `<polyline class="l4-pc" points="${pts}" fill="none" style="stroke: color-mix(in srgb, var(--c-muted) 42%, transparent); stroke-width: 1;"/>`;
  }).join('');

  const pcAxes = METRICS.map((m, i) => {
    const x = axisX(i);
    return `<line x1="${x}" y1="${PC_TOP}" x2="${x}" y2="${PC_BOT}" style="stroke: var(--c-line-2); stroke-width: 1.2;"/>
      <text x="${x}" y="${PC_TOP - 8}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10px;">${short(ext[i].hi)}</text>
      <text x="${x}" y="${PC_BOT + 14}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10px;">${short(ext[i].lo)}</text>
      <text x="${x}" y="${PC_BOT + 32}" text-anchor="middle" style="fill: var(--c-text); font-size: 11.5px; font-weight: 700;">${m.label}</text>`;
  }).join('');

  const matrix = (() => {
    let out = '';
    // Column headers
    MI.forEach((mi, j) => {
      out += `<text x="${M_X0 + j * M_CELL + M_CELL / 2}" y="18" text-anchor="middle" style="fill: var(--c-text); font-size: 11.5px; font-weight: 700;">${METRICS[mi].label} →</text>`;
    });
    MI.forEach((mi, i) => {
      out += `<text transform="translate(46 ${M_Y0 + i * M_CELL + M_CELL / 2}) rotate(-90)" text-anchor="middle" style="fill: var(--c-text); font-size: 11.5px; font-weight: 700;">${METRICS[mi].label} →</text>`;
    });
    MI.forEach((_, i) => MI.forEach((__, j) => {
      const cx = M_X0 + j * M_CELL, cy = M_Y0 + i * M_CELL;
      const px0 = cx + M_PAD, py0 = cy + M_PAD;
      out += `<rect x="${cx}" y="${cy}" width="${M_CELL}" height="${M_CELL}" rx="8" style="fill: var(--c-surface-2); stroke: var(--c-line);"/>`;
      if (i === j) {
        out += `<line x1="${px0}" y1="${py0 + M_INNER}" x2="${px0 + M_INNER}" y2="${py0}" style="stroke: var(--c-line-2); stroke-width: 1;"/>
          <text x="${px0 + M_INNER / 2}" y="${py0 + M_INNER / 2}" text-anchor="middle" style="fill: var(--c-muted); font-size: 11px;">${METRICS[MI[i]].label}</text>`;
        return;
      }
      // Row i uses MI[i] as the y axis, column j uses MI[j] as the x axis
      rows.forEach((d, r) => {
        const nx = normOf(MI[j], d[METRICS[MI[j]].key]);
        const ny = normOf(MI[i], d[METRICS[MI[i]].key]);
        const x = px0 + nx * M_INNER;
        const y = py0 + (1 - ny) * M_INNER;
        out += `<circle class="l4-mtx-pt" data-state="${r}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4"
          style="fill: color-mix(in srgb, var(--c-text) 22%, transparent);"/>`;
      });
    }));
    return out;
  })();

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">Brush axis:
        <select data-role="axis">${METRICS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('')}</select>
      </label>
      <label class="demo-control">Lower bound <input type="range" data-role="lo" min="0" max="100" value="0"><b class="val" data-role="loVal">min</b></label>
      <label class="demo-control">Upper bound <input type="range" data-role="hi" min="0" max="100" value="100"><b class="val" data-role="hiVal">max</b></label>
      <span class="demo-control">Selected <b class="val" data-role="cnt">0</b> / ${rows.length} states</span>
      <button type="button" class="demo-btn" data-role="reset">Reset brush</button>
    </div>

    <div class="l4-scroll">
      <svg class="l4-svg" viewBox="0 0 ${PC_W} 234" role="img" aria-label="Parallel coordinates: the profile of 50 states across the five metrics murder, robbery, burglary, larceny theft and motor vehicle theft">
        <text x="8" y="14" style="fill: var(--c-text-soft); font-size: 12px; font-weight: 700;">Parallel coordinates · 5 axes each normalized</text>
        ${pcAxes}
        ${pcLines}
      </svg>
    </div>

    <div class="demo-grid" style="margin-top:18px">
      <div class="l4-scroll">
        <svg class="l4-svg" viewBox="0 0 434 400" role="img" aria-label="Scatterplot matrix: pairwise comparison of the three metrics murder, robbery and burglary">
          ${matrix}
        </svg>
      </div>
      <div class="demo-detail" data-role="detail"></div>
    </div>

    <p class="demo-note"><strong>Linked brushing:</strong> draw a range on one axis and the selected states light up <strong>in sync</strong> in the parallel coordinates (joined by <span style="color: var(--c-primary)">bold blue lines</span>) and in the scatterplot matrix (points turn <span style="color: var(--c-primary)">blue</span>) — so you can then ask "do these states also agree on the other metrics?".</p>
    ${dataNote(ok)}
  `;

  const axisSel = mount.querySelector('[data-role="axis"]');
  const loEl = mount.querySelector('[data-role="lo"]');
  const hiEl = mount.querySelector('[data-role="hi"]');
  const cntEl = mount.querySelector('[data-role="cnt"]');
  const detail = mount.querySelector('[data-role="detail"]');
  const lineEls = [...mount.querySelectorAll('.l4-pc')];
  const ptEls = [...mount.querySelectorAll('.l4-mtx-pt')];

  let axis = 0;

  function update() {
    const e = ext[axis];
    let lo = +loEl.value / 100, hi = +hiEl.value / 100;
    if (lo > hi) { if (document.activeElement === loEl) { hi = lo; hiEl.value = Math.round(lo * 100); } else { lo = hi; loEl.value = Math.round(hi * 100); } }
    const loRaw = e.lo + lo * (e.hi - e.lo);
    const hiRaw = e.lo + hi * (e.hi - e.lo);
    mount.querySelector('[data-role="loVal"]').textContent = short(loRaw);
    mount.querySelector('[data-role="hiVal"]').textContent = short(hiRaw);

    const key = METRICS[axis].key;
    const hit = rows.map((d) => d[key] >= loRaw - 1e-9 && d[key] <= hiRaw + 1e-9);
    const n = hit.filter(Boolean).length;
    cntEl.textContent = n;

    lineEls.forEach((el, r) => {
      el.style.stroke = hit[r] ? 'var(--c-primary)' : 'color-mix(in srgb, var(--c-muted) 42%, transparent)';
      el.style.strokeWidth = hit[r] ? '1.9' : '1';
      el.style.opacity = hit[r] ? '1' : '0.5';
    });
    ptEls.forEach((el) => {
      const r = +el.dataset.state;
      el.style.fill = hit[r] ? 'var(--c-primary)' : 'color-mix(in srgb, var(--c-text) 22%, transparent)';
      el.style.opacity = hit[r] ? '1' : '0.45';
    });

    const picked = rows.filter((_, r) => hit[r]).map((d) => esc(d.state));
    detail.innerHTML = `
      <h4>Brush: ${METRICS[axis].label} ∈ [${short(loRaw)}, ${short(hiRaw)}]</h4>
      <p>Matched <strong>${n}</strong> states (of ${rows.length}).</p>
      <p><strong>How do they look on the other metrics?</strong>Follow the path of those bold blue lines in the chart above — whether they run high or low overall is exactly what "linking" is meant to reveal.</p>
      <p class="l4-mono" style="font-size: 12px;">${picked.slice(0, 12).join(' · ') || '(no states fall within the interval)'}${picked.length > 12 ? ' …' : ''}</p>`;
  }

  axisSel.addEventListener('change', () => { axis = +axisSel.value; update(); });
  loEl.addEventListener('input', update);
  hiEl.addEventListener('input', update);
  mount.querySelector('[data-role="reset"]').addEventListener('click', () => {
    loEl.value = 0; hiEl.value = 100; update();
  });

  update();
};

/* =========================================================
 * Demo 4.2 —— three-layer coordinate transform (data space → normalized → screen pixels)
 * ======================================================= */
DEMOS['d-4-2'] = async (mount) => {
  const { rows, ok } = await loadCrime();
  const n = 7;
  const step0 = Array.from({ length: n }, (_, k) => rows[Math.round(k * (rows.length - 1) / (n - 1))]);

  const W = 640, H = 380;
  const M = { t: 44, r: 24, b: 56, l: 56 };
  const innerW = W - M.l - M.r, innerH = H - M.t - M.b;

  const maxX = Math.max(...rows.map((d) => d.murder));
  const minX = Math.min(...rows.map((d) => d.murder));
  const maxY = Math.max(...rows.map((d) => d.robbery));
  const minY = Math.min(...rows.map((d) => d.robbery));

  let scaleType = 'linear';
  let step = 0;
  let timer = null;

  // First layer: data space → normalized space (squeeze the raw values into [0,1])
  const nx = (v) => {
    if (scaleType === 'log') {
      const a = Math.log(Math.max(1, minX)), b = Math.log(Math.max(1, maxX));
      return (Math.log(Math.max(1, v)) - a) / ((b - a) || 1);
    }
    if (scaleType === 'sqrt') return Math.sqrt(v) / (Math.sqrt(maxX) || 1);
    return v / (maxX || 1);
  };
  const ny = (v) => {
    if (scaleType === 'log') {
      const a = Math.log(Math.max(1, minY)), b = Math.log(Math.max(1, maxY));
      return (Math.log(Math.max(1, v)) - a) / ((b - a) || 1);
    }
    if (scaleType === 'sqrt') return Math.sqrt(v) / (Math.sqrt(maxY) || 1);
    return v / (maxY || 1);
  };

  // Each of the three layers produces its own pixel coordinates
  const posOf = (d) => {
    if (step === 0) return { x: d.murder, y: d.robbery };                       // raw values used directly as pixels
    if (step === 1) return { x: nx(d.murder) * innerW, y: (1 - ny(d.robbery)) * innerH };
    return { x: M.l + nx(d.murder) * innerW, y: M.t + (1 - ny(d.robbery)) * innerH };
  };

  const pts = step0.map((d, i) => `
    <g class="l4-pt" data-i="${i}">
      <circle r="6" style="fill: var(--c-primary); opacity: .85;"/>
      <text y="-11" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 10px;">${esc(d.state)}</text>
    </g>`).join('');

  mount.innerHTML = `
    <div class="demo-controls">
      <span class="demo-control">scale of the first step:
        <select data-role="scale">
          <option value="linear">scaleLinear</option>
          <option value="log">scaleLog</option>
          <option value="sqrt">scaleSqrt</option>
        </select>
      </span>
      <button type="button" class="demo-btn" data-role="prev">← Previous</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">Next →</button>
      <button type="button" class="demo-btn" data-role="play">▶ Play</button>
      <button type="button" class="demo-btn" data-role="replay">↻ Replay</button>
    </div>

    <div class="l4-steps" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
      <div class="l4-step" data-step="0"><b>① Data space</b>raw values (murder / robbery)</div>
      <div class="l4-step" data-step="1"><b>② Normalized space</b>squeezed into 0..innerW</div>
      <div class="l4-step" data-step="2"><b>③ Screen-pixel space</b>plus the margin offset</div>
    </div>

    <div class="l4-formula" data-role="formula"></div>

    <div class="l4-scroll">
      <svg class="l4-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="The coordinates of the same set of states across the three layers: data space, normalized space and screen-pixel space">
        <rect x="${M.l}" y="${M.t}" width="${innerW}" height="${innerH}" rx="10" style="fill: var(--c-surface-2); stroke: var(--c-line);"/>
        <text x="${M.l}" y="${M.t - 14}" style="fill: var(--c-text-soft); font-size: 11.5px; font-weight: 700;">Plot area: x = murder , y = robbery</text>
        <text x="${W - M.r}" y="${H - 24}" text-anchor="end" style="fill: var(--c-muted); font-size: 11px;">grey area = the canvas of screen-pixel space (inside the margin)</text>
        ${pts}
      </svg>
    </div>

    <div class="demo-sub" style="margin-top:16px">
      <h4>Three sets of coordinates for the same points</h4>
      <div class="table-scroll">
        <table class="mini-table" data-role="table">
          <thead><tr><th>State</th><th>murder</th><th>robbery</th><th class="l4-cell" data-col="1">x′ (normalized)</th><th class="l4-cell" data-col="2">X (pixels)</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    <p class="demo-note">Layer ① most directly shows "why raw values cannot be used as pixels": if murder / robbery are taken straight as pixel coordinates, most states fly off the canvas. Layer ② normalizes first, and only layer ③ adds the margin — with the three layers separated, changing the canvas size affects only layer ③.</p>
    ${dataNote(ok)}
  `;

  const svgPts = [...mount.querySelectorAll('.l4-pt')];
  const formulaEl = mount.querySelector('[data-role="formula"]');
  const tbody = mount.querySelector('[data-role="table"] tbody');
  const stepEls = [...mount.querySelectorAll('.l4-step')];
  const scaleSel = mount.querySelector('[data-role="scale"]');

  tbody.innerHTML = step0.map((d) => `
    <tr class="l4-tr">
      <td>${esc(d.state)}</td>
      <td class="l4-cell" data-col="0">${d.murder}</td>
      <td>${d.robbery}</td>
      <td class="l4-cell" data-col="1">—</td>
      <td class="l4-cell" data-col="2">—</td>
    </tr>`).join('');
  const rowEls = [...tbody.querySelectorAll('tr')];

  const FORMULA = () => {
    if (scaleType === 'log') return 'x′ = (ln murder − ln ' + short(minX) + ') / (ln ' + short(maxX) + ' − ln ' + short(minX) + ') × innerW';
    if (scaleType === 'sqrt') return 'x′ = √murder / √' + short(maxX) + ' × innerW';
    return 'x′ = murder / ' + short(maxX) + ' × innerW';
  };

  function apply() {
    svgPts.forEach((g, i) => {
      const p = posOf(step0[i]);
      g.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    });
    stepEls.forEach((el) => el.classList.toggle('is-on', +el.dataset.step === step));

    if (step === 0) formulaEl.textContent = 'Layer ①: x = murder (raw values used directly as pixels) · y = robbery — the values are far larger than the canvas, so the points fly off';
    else if (step === 1) formulaEl.textContent = 'Layer ②: ' + FORMULA() + ' · y′ = ' + (scaleType === 'log' ? '(ln robbery − ln ' + short(minY) + ') / (ln ' + short(maxY) + ' − ln ' + short(minY) + ')' : 'robbery / ' + short(maxY)) + ' × innerH';
    else formulaEl.textContent = 'Layer ③: X = margin.left(' + M.l + ') + x′ · Y = margin.top(' + M.t + ') + (1 − y′) × innerH';

    step0.forEach((d, r) => {
      const cells = rowEls[r].querySelectorAll('.l4-cell');
      const gx = +nx(d.murder), gy = +ny(d.robbery);
      const px = M.l + gx * innerW, py = M.t + (1 - gy) * innerH;
      cells[1].textContent = gx.toFixed(3);
      cells[2].textContent = px.toFixed(1) + ', ' + py.toFixed(1);
      cells.forEach((c) => c.classList.toggle('is-on',
        step === 0 ? c.dataset.col === '0' : +c.dataset.col === step));
    });

    mount.querySelector('[data-role="prev"]').disabled = step === 0;
    mount.querySelector('[data-role="next"]').disabled = step === 2;
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function goto(s) { step = Math.max(0, Math.min(2, s)); apply(); }

  mount.querySelector('[data-role="next"]').addEventListener('click', () => { stop(); goto(step + 1); });
  mount.querySelector('[data-role="prev"]').addEventListener('click', () => { stop(); goto(step - 1); });
  mount.querySelector('[data-role="replay"]').addEventListener('click', () => {
    stop(); step = 0; apply();
    void mount.offsetWidth;                      // force a reflow so the return animation gets recorded
    timer = setInterval(() => {
      if (step >= 2) { stop(); return; }
      goto(step + 1);
    }, 1300);
  });
  mount.querySelector('[data-role="play"]').addEventListener('click', () => {
    stop();
    if (step >= 2) { step = 0; apply(); void mount.offsetWidth; }
    timer = setInterval(() => {
      if (step >= 2) { stop(); return; }
      goto(step + 1);
    }, 1300);
  });
  scaleSel.addEventListener('change', () => {
    scaleType = scaleSel.value;
    stop();
    apply();
  });

  apply();
};

/* =========================================================
 * Demo 4.3 —— 10 curve-fitting models compared (equation + R² + ranking)
 * ======================================================= */
DEMOS['d-4-3'] = async (mount) => {
  const { rows, ok } = await loadCrime();
  const data = rows.filter((d) => d.population > 0).map((d) => ({
    x: d.population / 1e6,          // in millions, which keeps the numbers more stable
    y: d.murder,
    state: d.state,
  }));
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);

  const MODELS = [
    { id: 'ols', label: 'Linear a+bx', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => x]);
        return { predict: (x) => c[0] + c[1] * x, eq: `y = ${coef(c[1])}·x + ${coef(c[0])}` };
      } },
    { id: 'origin', label: 'Through origin y=bx', fit: () => {
        const c = basisOLS(xs, ys, [(x) => x]);
        return { predict: (x) => c[0] * x, eq: `y = ${coef(c[0])}·x` };
      } },
    { id: 'log', label: 'Logarithmic a+b·ln x', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => Math.log(x)]);
        return { predict: (x) => c[0] + c[1] * Math.log(x), eq: `y = ${coef(c[0])} + ${coef(c[1])}·ln x` };
      } },
    { id: 'pow', label: 'Power a·x^b', fit: () => {
        const lx = xs.map(Math.log), ly = ys.map(Math.log);
        const c = basisOLS(lx, ly, [() => 1, (v) => v]);
        const a = Math.exp(c[0]), b = c[1];
        return { predict: (x) => a * Math.pow(x, b), eq: `y = ${coef(a)}·x^${coef(b)}` };
      } },
    { id: 'exp', label: 'Exponential a·e^bx', fit: () => {
        const ly = ys.map(Math.log);
        const c = basisOLS(xs, ly, [() => 1, (v) => v]);
        const a = Math.exp(c[0]), b = c[1];
        return { predict: (x) => a * Math.exp(b * x), eq: `y = ${coef(a)}·e^(${coef(b)}x)` };
      } },
    { id: 'p2', label: 'Quadratic polynomial', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => x, (x) => x * x]);
        return { predict: (x) => c[0] + c[1] * x + c[2] * x * x, eq: `y = ${coef(c[2])}x² + ${coef(c[1])}x + ${coef(c[0])}` };
      } },
    { id: 'p3', label: 'Cubic polynomial', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => x, (x) => x * x, (x) => x * x * x]);
        return { predict: (x) => c[0] + c[1] * x + c[2] * x * x + c[3] * x * x * x, eq: `y = ${coef(c[3])}x³ + ${coef(c[2])}x² + ${coef(c[1])}x + ${coef(c[0])}` };
      } },
    { id: 'inv', label: 'Inverse a+b/x', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => 1 / x]);
        return { predict: (x) => c[0] + c[1] / x, eq: `y = ${coef(c[0])} + ${coef(c[1])}/x` };
      } },
    { id: 'sqrt', label: 'Square root a+b√x', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => Math.sqrt(x)]);
        return { predict: (x) => c[0] + c[1] * Math.sqrt(x), eq: `y = ${coef(c[0])} + ${coef(c[1])}·√x` };
      } },
    { id: 'sig', label: 'Sigmoid (logistic)', fit: () => {
        const L = Math.max(...ys) * 1.02;
        const xmin = Math.min(...xs), xmax = Math.max(...xs);
        let best = { sse: Infinity, k: 0.3, x0: (xmin + xmax) / 2 };
        for (let k = 0.05; k <= 0.8; k += 0.01) {
          for (let x0 = xmin; x0 <= xmax; x0 += (xmax - xmin) / 36) {
            let sse = 0;
            for (let i = 0; i < xs.length; i++) {
              const yh = L / (1 + Math.exp(-k * (xs[i] - x0)));
              sse += (ys[i] - yh) ** 2;
            }
            if (sse < best.sse) best = { sse, k, x0 };
          }
        }
        return {
          predict: (x) => L / (1 + Math.exp(-best.k * (x - best.x0))),
          eq: `y = ${coef(L)} / (1 + e^(−${coef(best.k)}·(x − ${coef(best.x0)})))`,
        };
      } },
  ];

  // ---- Figure layout: x uses a log axis (population spans 50×), y is linear ----
  const W = 640, H = 340;
  const M = { t: 24, r: 24, b: 44, l: 56 };
  const innerW = W - M.l - M.r, innerH = H - M.t - M.b;
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const lmin = Math.log10(xmin), lmax = Math.log10(xmax);
  const xOf = (v) => M.l + (Math.log10(Math.max(xmin, v)) - lmin) / ((lmax - lmin) || 1) * innerW;
  const ymax = Math.max(...ys) * 1.08;
  const yOf = (v) => M.t + (1 - v / ymax) * innerH;

  const xTicks = [1, 2, 5, 10, 20].filter((t) => t >= xmin && t <= xmax);
  const yTicks = [0, 1000, 2000, 3000].filter((t) => t <= ymax);

  const axisSvg = `
    ${yTicks.map((t) => `<line x1="${M.l}" y1="${yOf(t)}" x2="${M.l + innerW}" y2="${yOf(t)}" style="stroke: var(--c-line);"/>
      <text x="${M.l - 8}" y="${yOf(t) + 4}" text-anchor="end" style="fill: var(--c-muted); font-size: 10.5px;">${t}</text>`).join('')}
    ${xTicks.map((t) => `<line x1="${xOf(t)}" y1="${M.t}" x2="${xOf(t)}" y2="${M.t + innerH}" style="stroke: var(--c-line);"/>
      <text x="${xOf(t)}" y="${M.t + innerH + 17}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">${t}M</text>`).join('')}
    <line x1="${M.l}" y1="${M.t + innerH}" x2="${M.l + innerW}" y2="${M.t + innerH}" style="stroke: var(--c-line-2); stroke-width: 1.2;"/>
    <text x="${M.l + innerW / 2}" y="${H - 8}" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11.5px;">Population (millions, log axis) →</text>
    <text x="${M.l - 40}" y="${M.t + 12}" style="fill: var(--c-text-soft); font-size: 11.5px;">Murders ↑</text>
    ${data.map((d) => `<circle cx="${xOf(d.x).toFixed(1)}" cy="${yOf(d.y).toFixed(1)}" r="2.6" style="fill: color-mix(in srgb, var(--c-text) 26%, transparent);"/>`).join('')}
    <path class="l4-curve" data-role="curve" fill="none" style="stroke: var(--c-primary); stroke-width: 2.4;"/>
  `;

  mount.innerHTML = `
    <div class="demo-grid">
      <div>
        <div class="l4-scroll">
          <svg class="l4-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="The same scatter of population versus murders, overlaid with the fitted curve of the currently selected model">${axisSvg}</svg>
        </div>
        <div class="l4-models" style="margin-top:14px">
          ${MODELS.map((m, i) => `<button type="button" class="demo-btn${i === 0 ? ' is-on' : ''}" data-model="${i}">${m.label}</button>`).join('')}
        </div>
        <div class="l4-formula" style="margin-top:14px" data-role="eq"></div>
      </div>
      <div>
        <h4 style="margin:0 0 8px; font-size:13px; color: var(--c-text-soft);">Sorted by R² (click a row to switch models)</h4>
        <div class="l4-rank" data-role="rank"></div>
        <div class="demo-detail" style="margin-top:14px" data-role="detail"></div>
      </div>
    </div>
    <p class="demo-note"><strong>How to read it:</strong> R² is "the improvement over the mean baseline". A cubic polynomial is almost always a little higher than a straight line, but the extra bit is usually just fitting the noise once more — so <strong>look at the parameter count when comparing R²</strong>. Note that the exponential / power / logarithmic models minimize error in the <em>log-transformed space</em>, so their R² computed back in the original space may not win.</p>
    ${dataNote(ok)}
  `;

  const curveEl = mount.querySelector('[data-role="curve"]');
  const eqEl = mount.querySelector('[data-role="eq"]');
  const rankEl = mount.querySelector('[data-role="rank"]');
  const detailEl = mount.querySelector('[data-role="detail"]');
  const btns = [...mount.querySelectorAll('[data-model]')];

  // Pre-compute the parameters, predictions and R² of all 10 models
  const fits = MODELS.map((m) => {
    const f = m.fit();
    const yhat = xs.map((x) => f.predict(x));
    return { ...f, r2: r2of(ys, yhat) };
  });

  // Ranking bar (R² from high to low)
  const order = fits.map((f, i) => i).sort((a, b) => fits[b].r2 - fits[a].r2);
  rankEl.innerHTML = order.map((i) => {
    const f = fits[i], v = f.r2;
    const w = Math.max(0, Math.min(1, v)) * 100;
    return `<div class="l4-rank-row${v < 0 ? ' is-neg' : ''}" data-rank="${i}">
      <span>${MODELS[i].label}</span>
      <span class="l4-rank-track"><i class="l4-rank-bar" style="width:${w.toFixed(1)}%"></i></span>
      <span class="l4-rank-val">${v.toFixed(3)}</span>
    </div>`;
  }).join('');

  let cur = 0;
  function select(i) {
    cur = i;
    const f = fits[i];
    // Curve: sample 240 evenly spaced points on the log-x axis
    const seg = [];
    for (let k = 0; k <= 240; k++) {
      const lx = lmin + (k / 240) * (lmax - lmin);
      const x = Math.pow(10, lx);
      const y = f.predict(x);
      const py = Math.max(M.t, Math.min(M.t + innerH, yOf(y)));   // clamp to the edge when it exceeds the canvas
      seg.push(`${k ? 'L' : 'M'}${xOf(x).toFixed(1)},${py.toFixed(1)}`);
    }
    curveEl.setAttribute('d', seg.join(' '));
    eqEl.textContent = MODELS[i].label + ': ' + f.eq;
    btns.forEach((b, k) => b.classList.toggle('is-on', k === i));
    rankEl.querySelectorAll('[data-rank]').forEach((row) => row.classList.toggle('is-on', +row.dataset.rank === i));
    detailEl.innerHTML = `<h4>${MODELS[i].label}</h4>
      <p class="l4-mono" style="font-size:12px;">${f.eq}</p>
      <p><strong>R² = ${f.r2.toFixed(4)}</strong>${f.r2 < 0 ? ' (negative: worse than just using the mean)' : ''}</p>
      <p>Currently ranked <strong>${order.indexOf(i) + 1}</strong> / ${MODELS.length} by R².</p>`;
  }

  btns.forEach((b) => b.addEventListener('click', () => select(+b.dataset.model)));
  rankEl.querySelectorAll('[data-rank]').forEach((row) => row.addEventListener('click', () => select(+row.dataset.rank)));
  select(0);
};

/* =========================================================
 * Demo 4.4 —— Cleveland's 45° angle perception
 * ======================================================= */
DEMOS['d-4-4'] = async (mount) => {
  const { rows, ok } = await loadCrime();

  // Cleveland's U-shaped error: |ln(tan θ)| is 0 at 45° and diverges toward both ends
  const err = (deg) => {
    if (deg <= 0.5 || deg >= 89.5) return 1;
    return 1 - Math.exp(-Math.abs(Math.log(Math.tan(deg * Math.PI / 180))));
  };
  // Stevens' power law: perceived slope ≈ true slope^1.2 (tan = 1 at 45°, so no shift there)
  const percDeg = (deg) => {
    const t = Math.tan(Math.max(0.6, Math.min(89.4, deg)) * Math.PI / 180);
    return Math.atan(Math.pow(t, 1.2)) * 180 / Math.PI;
  };

  // Data side: the trend angle of crime.csv changes with the x-axis scale
  const pop = rows.map((d) => d.population);
  const mur = rows.map((d) => d.murder);
  const pmin = Math.min(...pop), pmax = Math.max(...pop);
  const mmin = Math.min(...mur), mmax = Math.max(...mur);
  const scaleMap = {
    linear: (v) => (v - pmin) / ((pmax - pmin) || 1),
    log: (v) => (Math.log(Math.max(1, v)) - Math.log(Math.max(1, pmin))) / ((Math.log(Math.max(1, pmax)) - Math.log(Math.max(1, pmin))) || 1),
    sqrt: (v) => (Math.sqrt(v) - Math.sqrt(pmin)) / ((Math.sqrt(pmax) - Math.sqrt(pmin)) || 1),
  };
  const SCALE_LABEL = { linear: 'scaleLinear', log: 'scaleLog (equal ratios become equal spacing)', sqrt: 'scaleSqrt' };

  let angle = 45;
  let xScale = 'linear';

  // ---- Panel A: the line itself + 45° reference + perceived line ----
  const AX = 70, AY = 210, LEN = 175;
  const ray = (deg, len, color, dash, w) => {
    const r = deg * Math.PI / 180;
    return `<line x1="${AX}" y1="${AY}" x2="${(AX + len * Math.cos(r)).toFixed(1)}" y2="${(AY - len * Math.sin(r)).toFixed(1)}"
      style="stroke: ${color}; stroke-width: ${w};"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  };

  // ---- Panel B: U-shaped error curve (sampled into a polyline) ----
  const B = { x0: 56, x1: 600, yTop: 40, yBot: 170 };
  const bxOf = (deg) => B.x0 + deg / 90 * (B.x1 - B.x0);
  const byOf = (e) => B.yBot - e * (B.yBot - B.yTop);
  const uPath = (() => {
    const seg = [];
    for (let d = 0; d <= 90; d += 1.5) seg.push(`${d ? 'L' : 'M'}${bxOf(d).toFixed(1)},${byOf(err(d)).toFixed(1)}`);
    return seg.join(' ');
  })();

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">Apparent angle: <input type="range" data-role="angle" min="0" max="90" value="45"><b class="val" data-role="angleVal">45°</b></label>
      <span class="demo-control" data-role="verdict"></span>
    </div>

    <div class="demo-grid">
      <div>
        <svg class="l4-svg" viewBox="0 0 320 250" role="img" aria-label="A line whose tilt can be varied, compared against a 45-degree reference line and the line the eye perceives">
          <line x1="${AX}" y1="${AY - 4}" x2="${AX}" y2="24" style="stroke: var(--c-line-2);"/>
          <line x1="${AX - 4}" y1="${AY}" x2="290" y2="${AY}" style="stroke: var(--c-line-2);"/>
          <text x="${AX}" y="${AY + 18}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">0°</text>
          <text x="286" y="${AY + 18}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">90°</text>
          ${ray(45, LEN * 1.12, 'color-mix(in srgb, var(--c-muted) 60%, transparent)', '5 5', 1.4)}
          <text x="${(AX + LEN * 1.12 * Math.SQRT1_2).toFixed(0)}" y="${(AY - LEN * 1.12 * Math.SQRT1_2 - 6).toFixed(0)}" style="fill: var(--c-muted); font-size: 10.5px;">45° reference</text>
          <path data-role="arc" fill="none" style="stroke: var(--c-warn); stroke-width: 2;"/>
          ${ray(45, LEN, 'var(--c-primary)', '', 3)}
          <g data-role="line"><line x1="${AX}" y1="${AY}" x2="${AX}" y2="${AY}" style="stroke: var(--c-primary); stroke-width: 3;"/></g>
          <g data-role="perceived"><line x1="${AX}" y1="${AY}" x2="${AX}" y2="${AY}" style="stroke: var(--c-warn); stroke-width: 2;" stroke-dasharray="6 4"/></g>
          <circle cx="${AX}" cy="${AY}" r="4" style="fill: var(--c-text-soft);"/>
          <text x="${AX - 8}" y="${AY + 4}" text-anchor="end" style="fill: var(--c-text-soft); font-size: 10.5px;">Start</text>
          <text x="10" y="16" style="fill: var(--c-muted); font-size: 10.5px;">Blue solid = true angle · orange dashed = perceived</text>
        </svg>
        <div class="demo-detail" style="margin-top:12px" data-role="readout"></div>
      </div>

      <div>
        <svg class="l4-svg" viewBox="0 0 640 220" role="img" aria-label="Cleveland's U-shaped error curve; the cursor follows the slider and the error is minimal at 45 degrees">
          <rect x="${bxOf(30)}" y="30" width="${(bxOf(60) - bxOf(30)).toFixed(1)}" height="150" rx="8" style="fill: color-mix(in srgb, var(--c-success) 12%, transparent);"/>
          <text x="${(bxOf(45)).toFixed(1)}" y="24" text-anchor="middle" style="fill: var(--c-success); font-size: 11.5px; font-weight: 700;">Stable zone 30°–60°</text>
          <line x1="${B.x0}" y1="${B.yBot + 10}" x2="${B.x1}" y2="${B.yBot + 10}" style="stroke: var(--c-line-2); stroke-width: 1.4;"/>
          <text x="${B.x0 - 10}" y="${B.yTop + 4}" text-anchor="end" style="fill: var(--c-muted); font-size: 10.5px;">Large error</text>
          <text x="${B.x0 - 10}" y="${B.yBot}" text-anchor="end" style="fill: var(--c-muted); font-size: 10.5px;">Small error</text>
          ${[0, 30, 45, 60, 90].map((d) => `<text x="${bxOf(d).toFixed(1)}" y="${B.yBot + 26}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">${d}°</text>`).join('')}
          <path d="${uPath}" fill="none" style="stroke: var(--c-primary); stroke-width: 2.6;"/>
          <line data-role="cursor" x1="0" y1="30" x2="0" y2="${B.yBot}" stroke-dasharray="4 4" style="stroke: var(--c-danger); stroke-width: 1.4;"/>
          <circle data-role="marker" cx="0" cy="0" r="5" style="fill: var(--c-danger);"/>
          <text x="${bxOf(45).toFixed(1)}" y="${(byOf(0) - 8).toFixed(1)}" text-anchor="middle" style="fill: var(--c-danger); font-size: 11px; font-weight: 700;">45°: minimal error</text>
          <text x="320" y="216" text-anchor="middle" style="fill: var(--c-muted); font-size: 11px;">Apparent angle → (|ln tan θ|-type error: largest at both ends, zero at 45°)</text>
        </svg>
      </div>
    </div>

    <div class="demo-sub" style="margin-top:18px">
      <h4>Same crime.csv: change the x-axis scale and the trend angle changes</h4>
      <div class="demo-controls" style="border-bottom:none; padding-bottom:0; margin-bottom:10px;">
        <label class="demo-control">x-axis:
          <select data-role="xs">
            <option value="linear">scaleLinear</option>
            <option value="log">scaleLog</option>
            <option value="sqrt">scaleSqrt</option>
          </select>
        </label>
        <span class="demo-control">Regression trend angle <b class="val" data-role="slope">—</b></span>
        <span class="demo-control" data-role="band"></span>
      </div>
      <svg class="l4-svg" style="max-width:320px" viewBox="0 0 250 250" role="img" aria-label="Scatter of the normalized crime data with the regression trend line, used to measure the trend's tilt angle">
        <rect x="20" y="14" width="212" height="212" rx="8" style="fill: var(--c-surface-2); stroke: var(--c-line);"/>
        <g data-role="crimePts"></g>
        <line data-role="trend" x1="20" y1="226" x2="232" y2="14" style="stroke: var(--c-success); stroke-width: 2.2;"/>
        <text x="126" y="244" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">Both axes normalized to 0..1 (square canvas) → tilt angle = atan(slope)</text>
      </svg>
    </div>
    ${dataNote(ok)}
  `;

  const slider = mount.querySelector('[data-role="angle"]');
  const angleVal = mount.querySelector('[data-role="angleVal"]');
  const verdict = mount.querySelector('[data-role="verdict"]');
  const readout = mount.querySelector('[data-role="readout"]');
  const lineEl = mount.querySelector('[data-role="line"] line');
  const perceivedEl = mount.querySelector('[data-role="perceived"] line');
  const arcEl = mount.querySelector('[data-role="arc"]');
  const cursorEl = mount.querySelector('[data-role="cursor"]');
  const markerEl = mount.querySelector('[data-role="marker"]');
  const xsSel = mount.querySelector('[data-role="xs"]');
  const slopeEl = mount.querySelector('[data-role="slope"]');
  const bandEl = mount.querySelector('[data-role="band"]');
  const crimePts = mount.querySelector('[data-role="crimePts"]');
  const trendEl = mount.querySelector('[data-role="trend"]');

  function band(deg) {
    if (deg >= 30 && deg <= 60) return { cls: 'pill--ok', text: 'Falls inside the 30°–60° stable zone ✓' };
    if (deg < 5 || deg > 85) return { cls: 'pill--no', text: 'Below 5° or above 85° → perceptual error is too large ✗' };
    return { cls: 'pill--warn', text: 'Off the golden angle — be careful when comparing trends' };
  }

  function drawAngle() {
    angleVal.textContent = angle + '°';
    const r = angle * Math.PI / 180;
    lineEl.setAttribute('x2', (AX + LEN * Math.cos(r)).toFixed(1));
    lineEl.setAttribute('y2', (AY - LEN * Math.sin(r)).toFixed(1));
    const pr = percDeg(angle) * Math.PI / 180;
    perceivedEl.setAttribute('x2', (AX + LEN * Math.cos(pr)).toFixed(1));
    perceivedEl.setAttribute('y2', (AY - LEN * Math.sin(pr)).toFixed(1));
    // Angle arc: sweeps from the positive x-axis up to the current angle (SVG's y points down, so the arc sweep flag is 0)
    const R = 54;
    const ex = AX + R * Math.cos(r), ey = AY - R * Math.sin(r);
    arcEl.setAttribute('d', `M ${AX + R} ${AY} A ${R} ${R} 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)}`);

    const e = err(angle), pd = percDeg(angle);
    cursorEl.setAttribute('x1', bxOf(angle).toFixed(1));
    cursorEl.setAttribute('x2', bxOf(angle).toFixed(1));
    markerEl.setAttribute('cx', bxOf(angle).toFixed(1));
    markerEl.setAttribute('cy', byOf(e).toFixed(1));

    const b = band(angle);
    verdict.innerHTML = `<span class="pill ${b.cls}">${b.text}</span>`;
    readout.innerHTML = `<h4>Perception offset profile</h4>
      <p>True angle <strong>${angle}°</strong> → perceived by the eye as about <strong>${pd.toFixed(1)}°</strong>
         (${pd > angle + 0.4 ? 'exaggerated' : pd < angle - 0.4 ? 'compressed' : 'almost no bias'}).</p>
      <p>Relative error (reading of the U-shaped curve) <strong>${(e * 100).toFixed(1)}%</strong>.</p>
      <p><strong>Stevens' power law:</strong> perceived slope ≈ true slope<sup>1.2</sup>; overall the eye exaggerates "steepness" by about 30%. Only near 45° (tan = 1) do the exaggeration and compression cancel each other out exactly.</p>`;
  }

  function drawCrime() {
    const nxv = pop.map(scaleMap[xScale]);
    const nyv = mur.map((v) => (v - mmin) / ((mmax - mmin) || 1));
    const { slope } = ols(nxv, nyv);
    const deg = Math.atan(slope) * 180 / Math.PI;
    const px = (n) => 20 + n * 212;
    crimePts.innerHTML = nxv.map((v, i) => `<circle cx="${px(v).toFixed(1)}" cy="${(226 - nyv[i] * 212).toFixed(1)}" r="2.4" style="fill: color-mix(in srgb, var(--c-text) 26%, transparent);"/>`).join('');
    trendEl.setAttribute('x1', px(0).toFixed(1));
    trendEl.setAttribute('y1', (226 - (slope * 0 + (0)) * 212).toFixed(1));
    trendEl.setAttribute('x2', px(1).toFixed(1));
    trendEl.setAttribute('y2', (226 - slope * 212).toFixed(1));
    slopeEl.textContent = deg.toFixed(1) + '°';
    const b = band(deg);
    bandEl.innerHTML = `<span class="pill ${b.cls}">${b.text}</span>`;
  }

  slider.addEventListener('input', () => { angle = +slider.value; drawAngle(); });
  xsSel.addEventListener('change', () => { xScale = xsSel.value; drawCrime(); });

  drawAngle();
  drawCrime();
};

/* =========================================================
 * Demo 4.5 —— Marching Squares step-by-step tracing
 * ======================================================= */
DEMOS['d-4-5'] = async (mount) => {
  const { rows, ok } = await loadCrime();

  // ---- Scalar field: treat the crime data as points on a (murder, robbery) plane and build a continuous field via kernel density estimation ----
  const N = 9;                       // 9×9 grid points → 8×8 cells
  const CELL = 42, PAD = 32;
  const logN = (v, lo, hi) => (Math.log(Math.max(1, v)) - Math.log(lo)) / ((Math.log(hi) - Math.log(lo)) || 1);
  const mlo = Math.min(...rows.map((d) => d.murder)), mhi = Math.max(...rows.map((d) => d.murder));
  const rlo = Math.min(...rows.map((d) => d.robbery)), rhi = Math.max(...rows.map((d) => d.robbery));
  const samples = rows.map((d) => ({ x: logN(d.murder, mlo, mhi), y: logN(d.robbery, rlo, rhi) }));
  const H = 0.11;    // kernel bandwidth
  const grid = [];
  for (let r = 0; r < N; r++) {
    grid.push([]);
    for (let c = 0; c < N; c++) {
      const u = c / (N - 1), v = r / (N - 1);
      let s = 0;
      for (const p of samples) {
        const dx = u - p.x, dy = v - p.y;
        s += Math.exp(-(dx * dx + dy * dy) / (2 * H * H));
      }
      grid[r].push(s / samples.length);
    }
  }
  const gMax = Math.max(...grid.flat());
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) grid[r][c] /= gMax;

  // Edge numbering: 0 = left-middle (top→bottom), 1 = bottom-middle (left→right), 2 = right-middle (top→bottom), 3 = top-middle (left→right)
  const EDGE_TABLE = [
    [], [[3, 0]], [[0, 1]], [[3, 1]],
    [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
    [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]],
    [[1, 3]], [[1, 0]], [[0, 3]], [],
  ];

  const nodes = [];    // all grid points: {r,c,x,y,v}
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    nodes.push({ r, c, x: PAD + c * CELL, y: PAD + r * CELL, v: grid[r][c] });
  }

  const EDGES = [];    // the 4 edges of each cell (endpoints in grid coordinates)
  function edgePoints(r, c, th) {
    const tl = grid[r][c], tr = grid[r][c + 1], bl = grid[r + 1][c], br = grid[r + 1][c + 1];
    const lerp = (a, b, va, vb) => {
      const d = vb - va;
      const t = Math.abs(d) < 1e-9 ? 0.5 : Math.max(0, Math.min(1, (th - va) / d));
      return a + (b - a) * t;
    };
    return [
      { x: c, y: lerp(r, r + 1, tl, bl) },                    // 0 left
      { x: lerp(c, c + 1, bl, br), y: r + 1 },                // 1 bottom
      { x: c + 1, y: lerp(r, r + 1, tr, br) },                // 2 right
      { x: lerp(c, c + 1, tl, tr), y: r },                    // 3 top
    ];
  }

  function marching(th) {
    const segs = [], inter = [];
    let above = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] > th) above++;
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
      const tl = grid[r][c], tr = grid[r][c + 1], bl = grid[r + 1][c], br = grid[r + 1][c + 1];
      let code = 0;
      if (bl > th) code |= 1;
      if (br > th) code |= 2;
      if (tr > th) code |= 4;
      if (tl > th) code |= 8;
      let table = EDGE_TABLE[code];
      // Saddle point: decide the orientation from the cell-center value
      if (code === 5 || code === 10) {
        const centerAbove = (tl + tr + bl + br) / 4 > th;
        if (code === 5) table = centerAbove ? [[3, 0]] : [[1, 2]];
        else table = centerAbove ? [[2, 3]] : [[0, 1]];
      }
      if (!table.length) continue;
      const p = edgePoints(r, c, th).map((q) => ({ x: PAD + q.x * CELL, y: PAD + q.y * CELL }));
      table.forEach(([a, b]) => {
        segs.push({ x1: p[a].x, y1: p[a].y, x2: p[b].x, y2: p[b].y });
        inter.push(p[a], p[b]);
      });
    }
    return { segs, inter, above };
  }

  const STEPS = [
    { name: '① Grid values', note: 'Discretize the continuous scalar field into 9×9 grid points and color the cells by value. Darker = higher "density" at that spot.' },
    { name: '② Mark the grid points above the threshold', note: 'Compare each grid point with the threshold; those above it become solid green dots — they are the 4 bits that make up the case code below.' },
    { name: '③ Intersect the cell edges', note: 'Linearly interpolate along the four edges of each cell with t = (threshold − a)/(b − a); the red dots land where "value = threshold".' },
    { name: '④ Connect into polylines', note: 'Look up the table per case and connect the intersections pairwise to get the isoline — it separates the "above threshold" region from the "below threshold" one.' },
  ];

  let th = 0.35;
  let step = 0;
  let timer = null;

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">Threshold: <input type="range" data-role="th" min="5" max="95" step="1" value="35"><b class="val" data-role="thVal">0.35</b></label>
      <button type="button" class="demo-btn" data-role="prev">← Previous</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">Next →</button>
      <button type="button" class="demo-btn" data-role="play">▶ Play</button>
      <button type="button" class="demo-btn" data-role="reset">↻ Reset</button>
    </div>

    <div class="l4-steps" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
      ${STEPS.map((s, i) => `<div class="l4-step" data-step="${i}"><b>${s.name}</b></div>`).join('')}
    </div>

    <div class="demo-grid">
      <div>
        <svg class="l4-svg" style="max-width:420px" viewBox="0 0 400 400" role="img" aria-label="Marching Squares step-by-step demo: grid scalar field, threshold marks, edge intersections and isolines">
          <g data-role="cells"></g>
          <g data-role="gridlines"></g>
          <g data-role="nodeMarks" class="l4-reveal"></g>
          <g data-role="nodeVals" class="l4-reveal"></g>
          <g data-role="inter" class="l4-reveal"></g>
          <g data-role="segs" class="l4-reveal"></g>
          <text x="${PAD}" y="20" style="fill: var(--c-text-soft); font-size: 11px;">← Robbery rate (log-normalized)</text>
          <text transform="translate(16 200) rotate(-90)" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11px;">Murder rate →</text>
        </svg>
      </div>
      <div>
        <div class="demo-detail" data-role="detail" style="min-height:100px"></div>
        <div class="l4-formula" style="margin:12px 0 0" data-role="stats"></div>
        <p class="demo-note" style="margin-top:10px">The case code = <span class="l4-mono">bit0 BL | bit1 BR | bit2 TR | bit3 TL</span>; look up <code>EDGE_TABLE</code> to get 0 / 1 / 2 segments. Saddle cases (5 / 10) use the cell-center value to decide the orientation.</p>
      </div>
    </div>
    ${dataNote(ok)}
  `;

  const cellsG = mount.querySelector('[data-role="cells"]');
  const gridG = mount.querySelector('[data-role="gridlines"]');
  const marksG = mount.querySelector('[data-role="nodeMarks"]');
  const valsG = mount.querySelector('[data-role="nodeVals"]');
  const interG = mount.querySelector('[data-role="inter"]');
  const segsG = mount.querySelector('[data-role="segs"]');
  const detail = mount.querySelector('[data-role="detail"]');
  const statsEl = mount.querySelector('[data-role="stats"]');
  const stepEls = [...mount.querySelectorAll('.l4-step')];

  // Static grid lines (drawn once)
  gridG.innerHTML = nodes.map((n) => `<line x1="${n.x}" y1="${n.y}" x2="${n.x}" y2="${n.y}" style="stroke: var(--c-line);"/>`).join('')
    + Array.from({ length: N }, (_, i) => `<line x1="${PAD + i * CELL}" y1="${PAD}" x2="${PAD + i * CELL}" y2="${PAD + (N - 1) * CELL}" style="stroke: var(--c-line);"/>
        <line x1="${PAD}" y1="${PAD + i * CELL}" x2="${PAD + (N - 1) * CELL}" y2="${PAD + i * CELL}" style="stroke: var(--c-line);"/>`).join('');

  function render(thValue) {
    // Color the cells by value
    let html = '';
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
      const v = (grid[r][c] + grid[r + 1][c] + grid[r][c + 1] + grid[r + 1][c + 1]) / 4;
      const mix = Math.round(6 + v * 72);
      html += `<rect class="l4-ms-cell" x="${PAD + c * CELL}" y="${PAD + r * CELL}" width="${CELL}" height="${CELL}"
        style="fill: color-mix(in srgb, var(--c-primary) ${mix}%, var(--c-surface));"/>`;
    }
    cellsG.innerHTML = html;

    // Grid-point values + threshold marks
    valsG.innerHTML = nodes.map((n) => `<text class="l4-ms-val" x="${n.x}" y="${n.y + 11}" text-anchor="middle" style="fill: var(--c-text); font-size: 8.5px;">${n.v.toFixed(2)}</text>`).join('');
    marksG.innerHTML = nodes.map((n) => n.v > thValue
      ? `<circle cx="${n.x}" cy="${n.y}" r="4" style="fill: var(--c-success);"/>`
      : `<circle cx="${n.x}" cy="${n.y}" r="3.4" style="fill: var(--c-surface); stroke: var(--c-line-2);"/>`).join('');

    // Intersections + segments
    const { segs, inter, above } = marching(thValue);
    interG.innerHTML = inter.map((p) => `<rect x="${(p.x - 2.6).toFixed(1)}" y="${(p.y - 2.6).toFixed(1)}" width="5.2" height="5.2"
      style="fill: var(--c-danger);"/>`).join('');
    segsG.innerHTML = segs.map((s) => `<line class="l4-ms-seg" x1="${s.x1.toFixed(1)}" y1="${s.y1.toFixed(1)}" x2="${s.x2.toFixed(1)}" y2="${s.y2.toFixed(1)}"
      style="stroke: var(--c-primary); stroke-width: 2.6;"/>`).join('');

    return { above, interCount: inter.length, segCount: segs.length };
  }

  function apply() {
    const info = render(th);
    stepEls.forEach((el) => el.classList.toggle('is-on', +el.dataset.step === step));
    marksG.classList.toggle('is-on', step >= 1);
    valsG.classList.toggle('is-on', step >= 1);
    interG.classList.toggle('is-on', step >= 2);
    segsG.classList.toggle('is-on', step >= 3);
    detail.innerHTML = `<h4>${STEPS[step].name}</h4><p>${STEPS[step].note}</p>`;
    statsEl.textContent = `${N * N} grid points · ${info.above} above the threshold · ${info.interCount} intersections · ${info.segCount} segments (${(N - 1) * (N - 1)} cells in total)`;
    mount.querySelector('[data-role="prev"]').disabled = step === 0;
    mount.querySelector('[data-role="next"]').disabled = step === 3;
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function goto(s) { step = Math.max(0, Math.min(3, s)); apply(); }

  mount.querySelector('[data-role="th"]').addEventListener('input', (e) => {
    th = +e.target.value / 100;
    mount.querySelector('[data-role="thVal"]').textContent = th.toFixed(2);
    render(th);
    void mount.offsetWidth;                 // force a reflow so the reveal transition gets registered
    apply();
  });
  mount.querySelector('[data-role="next"]').addEventListener('click', () => { stop(); goto(step + 1); });
  mount.querySelector('[data-role="prev"]').addEventListener('click', () => { stop(); goto(step - 1); });
  mount.querySelector('[data-role="reset"]').addEventListener('click', () => {
    stop(); step = 0; th = 0.35;
    mount.querySelector('[data-role="th"]').value = 35;
    mount.querySelector('[data-role="thVal"]').textContent = '0.35';
    render(th); void mount.offsetWidth; apply();
  });
  mount.querySelector('[data-role="play"]').addEventListener('click', () => {
    stop();
    if (step >= 3) { step = 0; apply(); void mount.offsetWidth; }
    timer = setInterval(() => {
      if (step >= 3) { stop(); return; }
      goto(step + 1);
    }, 1200);
  });

  apply();
};

/* =========================================================
 * Boot
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('Chapter 4 · Low-Dimensional Data', { lesson: 'lesson-04' });
