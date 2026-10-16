// =========================================================
// lesson-03/lesson.js — runnable demos for Chapter 3 "Color"
// ---------------------------------------------------------
// Conventions (contract with lesson-core.js):
//   ① register a demo with window.DEMOS['d-3-x'] = fn
//   ② the page mounts it via <div class="demo-mount" data-demo="d-3-x">
//   ③ finally call initLesson('Chapter 3 · Color', { lesson: 'lesson-03' })
//
// Dependency policy: everything uses "native DOM + inline SVG"; no d3, no CDN.
//   Colors are always computed from design tokens at runtime (so they adapt to light/dark themes);
//   no hard-coded color values appear in the source. The only exception is 3.6 "rainbow colormap" —
//   the point there is to demonstrate a mismatch, and it is noted in the code.
//   Animations avoid requestAnimationFrame: use void offsetWidth to force reflow + CSS transition.
// =========================================================

import { initLesson } from '../../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) Chapter-private demo styles (injected once; does not pollute the shared stylesheet)
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson03-styles')) return;
  const st = document.createElement('style');
  st.id = 'lesson03-styles';
  st.textContent = `
.l3-svg { width: 100%; height: auto; display: block; }
.l3-svg--tight { max-width: 520px; }
.l3-swatch-big {
  height: 62px; margin-bottom: 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--c-line-2);
  transition: background-color var(--dur-fast) var(--ease);
}
.l3-row { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
.l3-sw {
  width: 36px; height: 36px; flex: none; border-radius: 6px;
  border: 1px solid var(--c-line-2);
}
.l3-chip { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.l3-strip {
  height: 22px; margin: 0 0 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--c-line-2);
}
.l3-strip-label { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--c-text-soft); }
.l3-readout {
  display: grid; gap: 10px; margin-top: 12px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
.l3-read {
  padding: 10px 12px; border: 1px solid var(--c-line);
  border-radius: var(--radius-sm); background: var(--c-surface-2);
}
.l3-read h5 { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; color: var(--c-muted); }
.l3-read code { font-family: var(--font-mono); font-size: 12px; color: var(--c-text); }
.l3-harm { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(212px, 1fr)); }
.l3-harm-card {
  padding: 12px; border: 1px solid var(--c-line);
  border-radius: var(--radius-sm); background: var(--c-surface-2);
}
.l3-harm-card h5 { margin: 0 0 4px; font-size: 12.5px; color: var(--c-text); }
.l3-harm-card p { margin: 0 0 10px; font-size: 11.5px; line-height: 1.6; color: var(--c-muted); }
.l3-cvd { display: grid; gap: 8px; margin-top: 12px; }
.l3-cvd-row { display: grid; grid-template-columns: 84px 1fr; gap: 10px; align-items: center; }
.l3-cvd-row > span { font-size: 12px; color: var(--c-text-soft); }
.l3-hex { font-family: var(--font-mono); font-size: 10.5px; color: var(--c-text-soft); }
.l3-copybox {
  display: block; width: 100%; margin-top: 10px; padding: 8px;
  border: 1px solid var(--c-line-2); border-radius: var(--radius-sm);
  background: var(--c-surface); color: var(--c-text);
  font-family: var(--font-mono); font-size: 12px;
}
.l3-gamut-wrap { touch-action: none; }
.l3-gamut-wrap svg { cursor: crosshair; }
.l3-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; font-size: 12px; color: var(--c-text-soft); }
.l3-legend i {
  display: inline-block; width: 22px; height: 10px; margin-right: 6px;
  border-radius: 3px; border: 1px solid var(--c-line-2); vertical-align: middle;
}
.l3-paper { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
.l3-paper figure {
  margin: 0; padding: 10px; border: 1px solid var(--c-line);
  border-radius: var(--radius-sm); background: var(--c-surface-2);
}
.l3-paper figcaption { margin-top: 8px; font-size: 11.5px; line-height: 1.55; color: var(--c-text-soft); }
.l3-sample {
  padding: 12px 14px; margin-bottom: 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--c-line-2); font-size: 14px; font-weight: 700;
}
.l3-flash { transform: translateY(-2px); }
.l3-copybtn { transition: transform var(--dur-fast) var(--ease); }
@media (prefers-reduced-motion: reduce) {
  .demo-mount, .demo-mount * { transition: none !important; animation: none !important; }
}
`;
  document.head.appendChild(st);
}

/* ---------------------------------------------------------
 * 1) Color utilities: token → numeric → conversion between arbitrary spaces
 *    Always computed at runtime; no hard-coded colors in the source.
 * ------------------------------------------------------- */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// parse "#rrggbb" / "#rgb" / "rgb(a, b, c)" → [r, g, b]
function parseColorCss(v) {
  const s = String(v || '').trim();
  let m = s.match(/^#([0-9a-fA-F]{6})$/);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = s.match(/^#([0-9a-fA-F]{3})$/);
  if (m) { const h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]; }
  m = s.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return [p[0] || 0, p[1] || 0, p[2] || 0]; }
  return [0, 0, 0];
}

function tokRGB(name) { return parseColorCss(cssVar(name)); }
function rgbCss(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
function rgb01(c) { return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')'; }
function hexOf(c) {
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function mixRGB(a, b, t) { return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t); }

// HSL (h∈[0,360), s,l∈[0,100])
function rgb2hsl(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// WCAG relative luminance (0..1)
function luminance(c) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}
function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- Linear algebra (3×3) ---------- */
function mat3MulVec(m, v) {
  return [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2]);
}
function mat3Inv(m) {
  const a = m[0][0], b = m[0][1], c = m[0][2];
  const d = m[1][0], e = m[1][1], f = m[1][2];
  const g = m[2][0], h = m[2][1], i = m[2][2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

/* ---------- sRGB ↔ linear ↔ XYZ ↔ Lab (D65) ---------- */
const WHITE_D65 = [0.3127 / 0.3290, 1, (1 - 0.3127 - 0.3290) / 0.3290];

// build an RGB↔XYZ matrix from primary chromaticities + white point (generic; reused for Adobe RGB / Rec.2020)
function gamutMatrix(primaries, white) {
  const M = [[], [], []];
  for (let i = 0; i < 3; i++) {
    const x = primaries[i][0], y = primaries[i][1];
    M[0][i] = x / y; M[1][i] = 1; M[2][i] = (1 - x - y) / y;
  }
  const S = mat3MulVec(mat3Inv(M), white);
  const toXYZ = [[], [], []];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) toXYZ[r][c] = M[r][c] * S[c];
  return { toXYZ: toXYZ, fromXYZ: mat3Inv(toXYZ) };
}

const SRGB = gamutMatrix([[0.640, 0.330], [0.300, 0.600], [0.150, 0.060]], WHITE_D65);
const ADOBE = gamutMatrix([[0.640, 0.330], [0.210, 0.710], [0.150, 0.060]], WHITE_D65);
const REC2020 = gamutMatrix([[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]], WHITE_D65);

function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgbRaw(v) { return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }

function xyz2lab(xyz) {
  const e = 216 / 24389, k = 24389 / 27;
  const f = (t) => (t > e ? Math.cbrt(t) : (k * t + 16) / 116);
  const fx = f(xyz[0] / WHITE_D65[0]), fy = f(xyz[1] / WHITE_D65[1]), fz = f(xyz[2] / WHITE_D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function lab2xyz(lab) {
  const e = 216 / 24389, k = 24389 / 27;
  const fy = (lab[0] + 16) / 116, fx = fy + lab[1] / 500, fz = fy - lab[2] / 200;
  const g = (t) => (t * t * t > e ? t * t * t : (116 * t - 16) / k);
  return [WHITE_D65[0] * g(fx), WHITE_D65[1] * g(fy), WHITE_D65[2] * g(fz)];
}
function rgb2lab(c) {
  const R = srgbToLinear(c[0]), G = srgbToLinear(c[1]), B = srgbToLinear(c[2]);
  return xyz2lab(mat3MulVec(SRGB.toXYZ, [R, G, B]));
}
// Lab → (unclamped) RGB in a given gamut, as a 0..1 triple; used to detect out-of-gamut colors
function labToRgb01(lab, m) {
  const lin = mat3MulVec(m.fromXYZ, lab2xyz(lab));
  return [linearToSrgbRaw(lin[0]), linearToSrgbRaw(lin[1]), linearToSrgbRaw(lin[2])];
}
function inGamut01(v) { return v[0] >= -0.002 && v[0] <= 1.002 && v[1] >= -0.002 && v[1] <= 1.002 && v[2] >= -0.002 && v[2] <= 1.002; }
function labToRgbClamped(lab, m) {
  return labToRgb01(lab, m).map((v) => Math.max(0, Math.min(1, v)) * 255);
}
// fix L*, then binary-search along each hue angle for "the farthest radius still inside the gamut" → polygon
function gamutOutline(L, m, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const th = i / steps * Math.PI * 2;
    let lo = 0, hi = 320;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2;
      if (inGamut01(labToRgb01([L, mid * Math.cos(th), mid * Math.sin(th)], m))) lo = mid; else hi = mid;
    }
    pts.push([lo * Math.cos(th), lo * Math.sin(th)]);
  }
  return pts;
}

/* ---------- CVD simulation (Machado-2009-style 3×3 approximations) ---------- */
const CVD_MATRICES = {
  protanopia: [[0.567, 0.433, 0.000], [0.558, 0.442, 0.000], [0.000, 0.242, 0.758]],
  deuteranopia: [[0.625, 0.375, 0.000], [0.700, 0.300, 0.000], [0.000, 0.300, 0.700]],
  tritanopia: [[0.950, 0.050, 0.000], [0.000, 0.433, 0.567], [0.000, 0.475, 0.525]],
};
function cvdSim(c, type) {
  const m = CVD_MATRICES[type];
  if (!m) return c;
  return [0, 1, 2].map((r) =>
    Math.max(0, Math.min(255, Math.round(m[r][0] * c[0] + m[r][1] * c[1] + m[r][2] * c[2]))));
}

/* ---------------------------------------------------------
 * 2) Data: crime.csv (built-in fallback if fetch fails, so file:// still works)
 * ------------------------------------------------------- */
const CRIME_FALLBACK = [
  { state: 'California', population: 27058000, murder: 3082, robbery: 254707 },
  { state: 'Texas', population: 16370000, murder: 2606, robbery: 54546 },
  { state: 'New York', population: 17783000, murder: 2479, robbery: 162221 },
  { state: 'Florida', population: 11366000, murder: 1883, robbery: 75868 },
  { state: 'Illinois', population: 11508000, murder: 1762, robbery: 70311 },
  { state: 'Michigan', population: 9091000, murder: 1168, robbery: 36734 },
  { state: 'Pennsylvania', population: 11794000, murder: 1148, robbery: 42280 },
  { state: 'Ohio', population: 10744000, murder: 1034, robbery: 37520 },
  { state: 'Georgia', population: 5972000, murder: 775, robbery: 24764 },
  { state: 'North Carolina', population: 6347000, murder: 684, robbery: 16499 },
  { state: 'New Jersey', population: 7561000, murder: 557, robbery: 27580 },
  { state: 'Maryland', population: 4392000, murder: 536, robbery: 17853 },
  { state: 'Tennessee', population: 4768000, murder: 531, robbery: 12255 },
  { state: 'Missouri', population: 5029000, murder: 495, robbery: 14830 },
  { state: 'Louisiana', population: 4497000, murder: 484, robbery: 16355 },
  { state: 'Virginia', population: 5805000, murder: 475, robbery: 12327 },
  { state: 'Indiana', population: 5490000, murder: 398, robbery: 15521 },
  { state: 'Kentucky', population: 3726000, murder: 395, robbery: 5547 },
  { state: 'Massachusetts', population: 5843000, murder: 388, robbery: 25307 },
  { state: 'South Carolina', population: 3307000, murder: 377, robbery: 7427 },
];

function parseCSV(text) {
  const s = String(text).replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}
function toObjects(rows) {
  const head = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

async function loadCrime() {
  try {
    const res = await fetch('../../lesson-03/data/crime.csv');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = toObjects(parseCSV(await res.text()));
    const data = rows.map((o) => ({
      state: o.state,
      population: +o.population,
      murder: +o.murder,
      robbery: +o.robbery,
    })).filter((d) => d.state && isFinite(d.murder));
    if (data.length) return data;
  } catch (e) { /* offline / CORS → use the fallback */ }
  return CRIME_FALLBACK.slice();
}

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* =========================================================
 * d-3-1 · Color model basics (3.1)
 *   4 color-space sketch (inline SVG) + three sliders + four-space readouts + CVD row
 * ======================================================= */
DEMOS['d-3-1'] = function (mount) {
  let rgb = tokRGB('--c-primary');

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">R <input type="range" data-r min="0" max="255"><span class="val" data-vr></span></label>
      <label class="demo-control">G <input type="range" data-g min="0" max="255"><span class="val" data-vg></span></label>
      <label class="demo-control">B <input type="range" data-b min="0" max="255"><span class="val" data-vb></span></label>
    </div>
    <div class="l3-swatch-big" data-big></div>
    <svg class="l3-svg" viewBox="0 0 640 196" role="img" aria-label="Sketch of three color spaces: additive RGB overlap, position on the HSL hue wheel, and the CIE Lab a*b* plane"></svg>
    <div class="l3-readout" data-read></div>
    <div class="l3-cvd" data-cvd></div>`;

  const rEl = mount.querySelector('[data-r]'), gEl = mount.querySelector('[data-g]'), bEl = mount.querySelector('[data-b]');
  const big = mount.querySelector('[data-big]');
  const svg = mount.querySelector('.l3-svg');
  const read = mount.querySelector('[data-read]');
  const cvd = mount.querySelector('[data-cvd]');

  const arc = (cx, cy, rr, a0, a1) => {
    const p = (a) => [cx + rr * Math.sin(a * Math.PI / 180), cy - rr * Math.cos(a * Math.PI / 180)];
    const s = p(a0), e = p(a1), large = (a1 - a0) > 180 ? 1 : 0;
    return 'M ' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + ' A ' + rr + ' ' + rr + ' 0 ' + large + ' 1 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1);
  };

  function render() {
    const [r, g, b] = rgb;
    big.style.background = rgbCss(rgb);
    rEl.value = r; gEl.value = g; bEl.value = b;
    mount.querySelector('[data-vr]').textContent = r;
    mount.querySelector('[data-vg]').textContent = g;
    mount.querySelector('[data-vb]').textContent = b;

    const hsl = rgb2hsl(rgb);
    const lab = rgb2lab(rgb);
    const R = r / 255, G = g / 255, B = b / 255;
    const k = 1 - Math.max(R, G, B);
    const cmyk = k >= 0.999 ? [0, 0, 0, 100] : [
      (1 - R - k) / (1 - k) * 100, (1 - G - k) / (1 - k) * 100, (1 - B - k) / (1 - k) * 100, k * 100,
    ];

    // ---- sketch: three panels ----
    let s = '';
    // panel 1 · additive RGB
    s += '<text x="14" y="20" style="fill: var(--c-text); font-size:12px; font-weight:700;">RGB · additive</text>';
    s += '<circle cx="60" cy="72" r="34" style="fill: var(--c-danger); fill-opacity:.55;"/>';
    s += '<circle cx="104" cy="72" r="34" style="fill: var(--c-success); fill-opacity:.55;"/>';
    s += '<circle cx="82" cy="114" r="34" style="fill: var(--c-info); fill-opacity:.55;"/>';
    s += '<text x="82" y="166" text-anchor="middle" style="fill: var(--c-text); font-size:11px;">at C all three channels are high</text>';
    s += '<text x="82" y="184" text-anchor="middle" style="fill: var(--c-muted); font-size:10.5px;">current values R' + r + ' G' + g + ' B' + b + '</text>';

    // panel 2 · HSL hue wheel (8 segments built from the --ch-1..8 tokens)
    const cx = 268, cy = 96, rr = 54;
    s += '<text x="216" y="20" style="fill: var(--c-text); font-size:12px; font-weight:700;">HSL · hue wheel</text>';
    for (let i = 0; i < 8; i++) {
      s += '<path d="' + arc(cx, cy, rr, i * 45 + 2, (i + 1) * 45 - 2) + '" fill="none" style="stroke: var(--ch-' + (i + 1) + '); stroke-width:16; stroke-linecap:butt;"/>';
    }
    const ha = hsl[0];
    const hx = cx + rr * Math.sin(ha * Math.PI / 180), hy = cy - rr * Math.cos(ha * Math.PI / 180);
    s += '<circle cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" r="8" fill="' + rgbCss(rgb) + '" style="stroke: var(--c-surface); stroke-width:2.5;"/>';
    s += '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" style="fill: var(--c-text); font-size:10.5px;">H ' + Math.round(ha) + '°</text>';
    s += '<text x="216" y="172" style="fill: var(--c-muted); font-size:10.5px;">S ' + Math.round(hsl[1]) + '% · L ' + Math.round(hsl[2]) + '%</text>';
    s += '<text x="216" y="188" style="fill: var(--c-muted); font-size:10.5px;">note: HSL lightness is not perceptually uniform</text>';

    // panel 3 · the CIE Lab a*b* plane
    const ox = 470, oy = 101, sc = 0.62;
    s += '<text x="410" y="20" style="fill: var(--c-text); font-size:12px; font-weight:700;">CIE Lab · a*b*</text>';
    s += '<line x1="' + (ox - 62) + '" y1="' + oy + '" x2="' + (ox + 76) + '" y2="' + oy + '" style="stroke: var(--c-border-2);"/>';
    s += '<line x1="' + ox + '" y1="' + (oy - 72) + '" x2="' + ox + '" y2="' + (oy + 72) + '" style="stroke: var(--c-border-2);"/>';
    s += '<text x="' + (ox + 80) + '" y="' + (oy + 4) + '" style="fill: var(--c-muted); font-size:10px;">a*</text>';
    s += '<text x="' + (ox + 5) + '" y="' + (oy - 76) + '" style="fill: var(--c-muted); font-size:10px;">b*</text>';
    const px = ox + Math.max(-62, Math.min(76, lab[1] * sc)), py = oy - Math.max(-72, Math.min(72, lab[2] * sc));
    s += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="9" fill="' + rgbCss(rgb) + '" style="stroke: var(--c-surface); stroke-width:2.5;"/>';
    s += '<text x="410" y="172" style="fill: var(--c-muted); font-size:10.5px;">distance ≈ perceived difference</text>';
    s += '<text x="410" y="188" style="fill: var(--c-muted); font-size:10.5px;">design colormaps by interpolating in Lab</text>';
    svg.innerHTML = s;

    // ---- four-space readouts ----
    read.innerHTML = [
      ['RGB · additive (device-dependent)', r + ', ' + g + ', ' + b],
      ['HSL · intuitive (still not perceptually uniform)', Math.round(hsl[0]) + '°, ' + Math.round(hsl[1]) + '%, ' + Math.round(hsl[2]) + '%'],
      ['CIE Lab · perceptually uniform', 'L*' + lab[0].toFixed(0) + ' a*' + lab[1].toFixed(0) + ' b*' + lab[2].toFixed(0)],
      ['CMYK · subtractive (print)', cmyk.map((v) => Math.round(v)).join(', ')],
    ].map((d) => '<div class="l3-read"><h5>' + d[0] + '</h5><code>' + d[1] + '</code></div>').join('');

    // ---- CVD row: original → simulated ----
    const rows = [['Protanopia', 'protanopia'], ['Deuteranopia', 'deuteranopia'], ['Tritanopia', 'tritanopia']];
    cvd.innerHTML = rows.map((rw) => {
      const sim = cvdSim(rgb, rw[1]);
      return '<div class="l3-cvd-row"><span>' + rw[0] + '</span>' +
        '<div class="l3-row"><div class="l3-sw" style="background:' + rgbCss(rgb) + '"></div>' +
        '<span style="color:var(--c-muted)">→</span>' +
        '<div class="l3-sw" style="background:' + rgbCss(sim) + '"></div>' +
        '<span class="l3-hex">' + hexOf(sim) + '</span></div></div>';
    }).join('');
  }

  [rEl, gEl, bEl].forEach((el) => el.addEventListener('input', () => {
    rgb = [+rEl.value, +gEl.value, +bEl.value];
    render();
  }));
  // initial values: from the primary token
  rEl.value = rgb[0]; gEl.value = rgb[1]; bEl.value = rgb[2];
  render();
};

/* =========================================================
 * d-3-2 · Choosing among the three colormap families (3.2)
 *   three reference strips (sequential / diverging / qualitative) + a bar chart of the same data
 * ======================================================= */
DEMOS['d-3-2'] = async function (mount) {
  const all = (await loadCrime()).sort((a, b) => b.murder - a.murder);
  const data = all.slice(0, 12);

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">Colormap family for the bars
        <select data-kind>
          <option value="seq">Sequential</option>
          <option value="div">Diverging</option>
          <option value="qual">Qualitative</option>
        </select>
      </label>
    </div>
    <p class="l3-strip-label">Sequential — magnitude of the value (light → dark)</p>
    <div class="l3-strip" style="background:linear-gradient(90deg,${[10, 28, 46, 64, 82, 100].map((p) => 'color-mix(in srgb, var(--c-primary) ' + p + '%, var(--c-surface))').join(',')})"></div>
    <p class="l3-strip-label">Diverging — deviation from a center (negative ← midpoint → positive)</p>
    <div class="l3-strip" style="background:linear-gradient(90deg,color-mix(in srgb, var(--c-danger) 92%, var(--c-surface)),color-mix(in srgb, var(--c-danger) 34%, var(--c-surface)),var(--c-surface-2),color-mix(in srgb, var(--c-info) 34%, var(--c-surface)),color-mix(in srgb, var(--c-info) 92%, var(--c-surface)))"></div>
    <p class="l3-strip-label">Qualitative — no order between classes (Okabe–Ito tokens)</p>
    <div class="l3-strip" style="background:linear-gradient(90deg,var(--ch-1),var(--ch-2),var(--ch-3),var(--ch-4),var(--ch-5),var(--ch-6))"></div>
    <div data-chart></div>
    <p class="demo-note" data-note></p>`;

  const sel = mount.querySelector('[data-kind]');
  const chart = mount.querySelector('[data-chart]');
  const note = mount.querySelector('[data-note]');
  const surface = tokRGB('--c-surface'), surface2 = tokRGB('--c-surface-2');
  const primary = tokRGB('--c-primary'), danger = tokRGB('--c-danger'), info = tokRGB('--c-info');
  const max = Math.max(...data.map((d) => d.murder));
  const mean = data.reduce((s, d) => s + d.murder, 0) / data.length;

  function barsSVG() {
    const kind = sel.value;
    const left = 150, rowH = 22, top = 14, w = 640;
    const h = top * 2 + data.length * rowH;
    let s = '<svg class="l3-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Horizontal bar chart of murder counts, states sorted">';
    data.forEach((d, i) => {
      const y = top + i * rowH + 3;
      const bw = Math.max(2, (d.murder / max) * 400);
      let col;
      if (kind === 'seq') col = rgbCss(mixRGB(surface, primary, d.murder / max));
      else if (kind === 'div') {
        const dev = Math.max(-1, Math.min(1, (d.murder - mean) / (max - mean)));
        col = rgbCss(dev < 0 ? mixRGB(surface2, danger, Math.abs(dev)) : mixRGB(surface2, info, dev));
      } else col = rgbCss(tokRGB('--ch-' + (i % 6 + 1)));
      s += '<rect x="' + left + '" y="' + y + '" width="' + bw.toFixed(1) + '" height="' + (rowH - 8) + '" rx="3" fill="' + col + '"/>';
      s += '<text x="' + (left - 8) + '" y="' + (y + rowH - 11) + '" text-anchor="end" style="fill: var(--c-text-soft); font-size:11px;">' + esc(d.state) + '</text>';
      s += '<text x="' + (left + bw + 6).toFixed(1) + '" y="' + (y + rowH - 11) + '" style="fill: var(--c-muted); font-size:10.5px;">' + d.murder + '</text>';
    });
    s += '</svg>';
    return s;
  }

  const NOTES = {
    seq: 'Sequential applied to a quantity that has an order (murder counts) — readers can tell who has more. The right family choice ✓',
    div: 'Diverging expresses “deviation from a center”; forcing it here implies a natural center the data does not support ⚠',
    qual: 'Qualitative encodes classes only, never magnitude; with it the count bars lose their ordering — a family mismatch ✗',
  };

  function render() {
    chart.innerHTML = barsSVG();
    note.textContent = NOTES[sel.value];
  }
  sel.addEventListener('change', render);
  render();
};

/* =========================================================
 * d-3-3 · CIE Lab gamut diagram (3.3)
 *   three nested gamuts (sRGB / Adobe RGB / Rec.2020) + L* slider + draggable sample point
 * ======================================================= */
DEMOS['d-3-3'] = function (mount) {
  const VB = 300, C = 150, SC = 0.9;
  let L = 55, sample = [42, -34];

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">L* <input type="range" data-l min="8" max="96" value="55"><span class="val" data-vl>55</span></label>
    </div>
    <div class="l3-gamut-wrap"><svg class="l3-svg l3-svg--tight" viewBox="0 0 ${VB} ${VB}" data-gamut role="img" aria-label="CIE Lab a*b* gamut diagram: inner sRGB, middle Adobe RGB, outer Rec.2020; the sample point is draggable"></svg></div>
    <div class="l3-legend">
      <span><i style="background:transparent;border-style:dashed"></i>sRGB</span>
      <span><i style="background:transparent;border-style:dotted"></i>Adobe RGB</span>
      <span><i style="background:transparent"></i>Rec.2020</span>
    </div>
    <div class="l3-row" style="margin-top:12px">
      <div class="l3-sw" data-sm style="width:48px;height:48px"></div>
      <code data-info style="font-family:var(--font-mono);font-size:12px;color:var(--c-text)"></code>
      <span class="pill" data-pill></span>
    </div>
    <p class="demo-note">Drag the grey point on the diagram to sample: the swatch is the unclamped sRGB conversion of that (L*a*b*) coordinate — out of bounds means out of gamut. Combine dragging with the L* slider to see how the gamut shape changes with lightness.</p>`;

  const svg = mount.querySelector('[data-gamut]');
  const lEl = mount.querySelector('[data-l]');
  const sm = mount.querySelector('[data-sm]');
  const info = mount.querySelector('[data-info]');
  const pill = mount.querySelector('[data-pill]');

  const X = (a) => C + a * SC;
  const Y = (b) => C - b * SC;

  function draw() {
    let s = '';
    // 1) gamut fill: per-point Lab→sRGB, drawn only if inside the gamut (step=8, ~1000 small patches)
    for (let a = -160; a <= 160; a += 8) {
      for (let b = -160; b <= 160; b += 8) {
        const rgb = labToRgb01([L, a, b], SRGB);
        if (!inGamut01(rgb)) continue;
        s += '<rect x="' + (X(a) - 4).toFixed(1) + '" y="' + (Y(b) - 4).toFixed(1) + '" width="7" height="7" fill="' + rgb01(rgb) + '"/>';
      }
    }
    // 2) three gamut outlines
    const outlines = [
      ['sRGB', SRGB, 'var(--c-text)', '4 3'],
      ['Adobe RGB', ADOBE, 'var(--c-info)', '1 3'],
      ['Rec.2020', REC2020, 'var(--c-danger)', ''],
    ];
    outlines.forEach((o) => {
      const pts = gamutOutline(L, o[1], 72).map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
      s += '<polygon points="' + pts + '" fill="none" style="stroke:' + o[2] + '; stroke-width:1.6;" stroke-dasharray="' + o[3] + '"/>';
    });
    // 3) sample point
    const raw = labToRgb01([L, sample[0], sample[1]], SRGB);
    const ok = inGamut01(raw);
    const col = rgb01(raw.map((v) => Math.max(0, Math.min(1, v))));
    s += '<circle cx="' + X(sample[0]).toFixed(1) + '" cy="' + Y(sample[1]).toFixed(1) + '" r="9" fill="' + col + '" style="stroke: var(--c-text); stroke-width:2.5;"/>';
    svg.innerHTML = s;

    sm.style.background = col;
    info.textContent = 'L*' + L.toFixed(0) + '  a*' + sample[0].toFixed(0) + '  b*' + sample[1].toFixed(0);
    if (ok) { pill.className = 'pill pill--ok'; pill.textContent = 'Inside the sRGB gamut'; }
    else { pill.className = 'pill pill--warn'; pill.textContent = 'Out of gamut → will be clamped'; }
  }

  function toLab(ev) {
    const rect = svg.getBoundingClientRect();
    const vx = (ev.clientX - rect.left) / rect.width * VB;
    const vy = (ev.clientY - rect.top) / rect.height * VB;
    const a = Math.max(-160, Math.min(160, (vx - C) / SC));
    const b = Math.max(-160, Math.min(160, (C - vy) / SC));
    return [a, b];
  }

  let dragging = false;
  svg.addEventListener('pointerdown', (ev) => { dragging = true; sample = toLab(ev); svg.setPointerCapture(ev.pointerId); draw(); });
  svg.addEventListener('pointermove', (ev) => { if (dragging) { sample = toLab(ev); draw(); } });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });
  lEl.addEventListener('input', () => { L = +lEl.value; mount.querySelector('[data-vl]').textContent = L; draw(); });

  draw();
};

/* =========================================================
 * d-3-4 · Color-harmony rules (3.4) + contrast checker
 * ======================================================= */
DEMOS['d-3-4'] = function (mount) {
  const baseHue = rgb2hsl(tokRGB('--c-primary'))[0];
  const surface = tokRGB('--c-surface'), textTok = tokRGB('--c-text');
  let off = 0, S = 72, L = 52;

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">Base hue <input type="range" data-h min="0" max="359" value="0"><span class="val" data-vh>+0°</span></label>
      <label class="demo-control">Saturation <input type="range" data-s min="20" max="100" value="72"><span class="val" data-vs>72%</span></label>
      <label class="demo-control">Lightness <input type="range" data-l min="20" max="80" value="52"><span class="val" data-vl>52%</span></label>
    </div>
    <div class="l3-harm" data-harm></div>

    <h4 style="margin:18px 0 8px;font-size:13.5px">Contrast checker (WCAG 2.1)</h4>
    <div class="demo-controls">
      <label class="demo-control">Foreground <input type="color" data-fg></label>
      <label class="demo-control">Background <input type="color" data-bg></label>
      <div class="l3-row">
        <span class="pill" data-aa>—</span>
        <span class="pill" data-aaa>—</span>
      </div>
    </div>
    <div data-samples></div>
    <p class="demo-note">Contrast = (lighter luminance + 0.05) / (darker luminance + 0.05). AA body text needs ≥ 4.5:1 and large text ≥ 3:1; AAA body text needs ≥ 7:1 and large text ≥ 4.5:1.</p>`;

  const harm = mount.querySelector('[data-harm]');
  const hEl = mount.querySelector('[data-h]'), sEl = mount.querySelector('[data-s]'), lEl = mount.querySelector('[data-l]');
  const fgEl = mount.querySelector('[data-fg]'), bgEl = mount.querySelector('[data-bg]');
  const aa = mount.querySelector('[data-aa]'), aaa = mount.querySelector('[data-aaa]');
  const samples = mount.querySelector('[data-samples]');

  const RULES = [
    { name: '① Monochromatic', desc: 'One hue, only lightness varies — the safest, hardest to get wrong', hues: [0, 0, 0, 0, 0], lf: [1.35, 1.15, 1.0, 0.86, 0.72] },
    { name: '② Analogous', desc: 'Within ±30° of each other — soft and unified, good for a “same family” feel', hues: [-30, -15, 0, 15, 30], lf: [1.08, 1, 1, 1, 1.08] },
    { name: '③ Triadic', desc: '120° apart — strong contrast and rich color; mind the hierarchy', hues: [0, 120, 240, 0, 120], lf: [1, 1, 1, 0.84, 0.84] },
    { name: '④ Split-complementary', desc: 'Primary plus the two flanks opposite (±150°) — contrast without the glare', hues: [0, 150, 210, 0, 150], lf: [1, 1, 1, 0.86, 0.86] },
    { name: '⑤ Complementary', desc: '180° apart — the strongest contrast; split the areas into primary and secondary', hues: [0, 180, 0, 180, 0], lf: [1, 1, 1.22, 1.22, 0.82] },
  ];

  function renderHarm() {
    harm.innerHTML = RULES.map((rule) => {
      const sw = rule.hues.map((hue, i) => {
        const c = hsl2rgb(baseHue + off + hue, S, Math.max(0, Math.min(100, L * rule.lf[i])));
        return '<div class="l3-sw" style="background:' + rgbCss(c) + '"></div>';
      }).join('');
      return '<div class="l3-harm-card"><h5>' + rule.name + '</h5><p>' + rule.desc + '</p><div class="l3-row">' + sw + '</div></div>';
    }).join('');
  }

  function renderContrast() {
    const fg = parseColorCss(fgEl.value), bg = parseColorCss(bgEl.value);
    const ratio = contrastRatio(fg, bg);
    aa.className = 'pill ' + (ratio >= 4.5 ? 'pill--ok' : ratio >= 3 ? 'pill--warn' : 'pill--no');
    aa.textContent = 'AA body 4.5:1 ' + (ratio >= 4.5 ? '✓' : '✗') + ' (ratio ' + ratio.toFixed(2) + ')';
    aaa.className = 'pill ' + (ratio >= 7 ? 'pill--ok' : 'pill--no');
    aaa.textContent = 'AAA body 7:1 ' + (ratio >= 7 ? '✓' : '✗');

    const rLight = contrastRatio(fg, surface), rDark = contrastRatio(fg, textTok);
    samples.innerHTML =
      '<div class="l3-sample" style="background:' + rgbCss(surface) + ';color:' + rgbCss(fg) + '">Text on a light background · contrast ' + rLight.toFixed(2) +
      ' <span class="pill ' + (rLight >= 4.5 ? 'pill--ok' : 'pill--no') + '">' + (rLight >= 4.5 ? 'readable' : 'weak') + '</span></div>' +
      '<div class="l3-sample" style="background:' + rgbCss(textTok) + ';color:' + rgbCss(fg) + '">Text on a dark background · contrast ' + rDark.toFixed(2) +
      ' <span class="pill ' + (rDark >= 4.5 ? 'pill--ok' : 'pill--no') + '">' + (rDark >= 4.5 ? 'readable' : 'weak') + '</span></div>';
  }

  hEl.addEventListener('input', () => { off = +hEl.value; mount.querySelector('[data-vh]').textContent = '+' + off + '°'; renderHarm(); });
  sEl.addEventListener('input', () => { S = +sEl.value; mount.querySelector('[data-vs]').textContent = S + '%'; renderHarm(); });
  lEl.addEventListener('input', () => { L = +lEl.value; mount.querySelector('[data-vl]').textContent = L + '%'; renderHarm(); });
  fgEl.addEventListener('input', renderContrast);
  bgEl.addEventListener('input', renderContrast);

  fgEl.value = hexOf(tokRGB('--c-primary'));
  bgEl.value = hexOf(surface);
  renderHarm();
  renderContrast();
};

/* =========================================================
 * d-3-5 · Classic scientific palettes (3.5)
 *   5 palette cards + grayscale check / CVD switch
 * ======================================================= */
DEMOS['d-3-5'] = function (mount) {
  const surface = tokRGB('--c-surface'), primary = tokRGB('--c-primary');
  const surface2 = tokRGB('--c-surface-2'), danger = tokRGB('--c-danger'), info = tokRGB('--c-info');

  const PALETTES = [
    {
      name: 'Okabe–Ito (CVD-friendly)', note: 'this site’s --ch-1..8, separated in both hue and lightness; still distinguishable under CVD',
      colors: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => tokRGB('--ch-' + i)),
    },
    {
      name: 'Low-saturation derivatives', note: 'ch tokens mixed 45% with the surface color, used as supporting colors so the whole page wears better',
      colors: [1, 2, 3, 4, 5, 6].map((i) => mixRGB(tokRGB('--ch-' + i), surface, 0.45)),
    },
    {
      name: 'Monochromatic depth ramp', note: '6 steps between surface and primary — sequential, guaranteeing “darker means more”',
      colors: [100, 80, 60, 42, 26, 14].map((p) => mixRGB(surface, primary, p / 100)),
    },
    {
      name: 'Sequential (blue-cyan)', note: 'monotonically increasing light → dark; magnitude stays readable in grayscale print and under CVD',
      colors: [12, 30, 48, 66, 84, 100].map((p) => mixRGB(surface, info, p / 100)),
    },
    {
      name: 'Diverging (negative ↔ positive)', note: 'opposing ends, lightest midpoint — only for data that deviates from a center',
      colors: [-1, -0.6, -0.25, 0.25, 0.6, 1].map((t) => t < 0 ? mixRGB(surface2, danger, -t) : mixRGB(surface2, info, t)),
    },
  ];

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control"><input type="checkbox" data-gray> Grayscale check (B/W printing)</label>
      <label class="demo-control">CVD simulation
        <select data-cvd>
          <option value="normal">Normal</option>
          <option value="deuteranopia">Deuteranopia</option>
          <option value="protanopia">Protanopia</option>
          <option value="tritanopia">Tritanopia</option>
        </select>
      </label>
    </div>
    <div class="l3-harm" data-cards></div>
    <p class="demo-note">Whether a palette still separates under “grayscale” or “color vision deficiency” is a hard requirement for getting into a paper. If several steps merge into one color in grayscale, you need a second encoding such as shape.</p>`;

  const cards = mount.querySelector('[data-cards]');
  const grayEl = mount.querySelector('[data-gray]');
  const cvdEl = mount.querySelector('[data-cvd]');

  function style(c) {
    let out = c;
    if (cvdEl.value !== 'normal') out = cvdSim(out, cvdEl.value);
    if (grayEl.checked) { const v = luminance(out) * 255; out = [v, v, v]; }
    return rgbCss(out);
  }

  function render() {
    cards.innerHTML = PALETTES.map((p) => {
      const sw = p.colors.map((c) => '<div class="l3-sw" style="background:' + style(c) + '"></div>').join('');
      // mini “in use” sketch: a row of small bars
      const bars = p.colors.map((c, i) => {
        const h = 16 + (i % 3) * 10 + 8;
        return '<rect x="' + (2 + i * 22) + '" y="' + (52 - h) + '" width="16" height="' + h + '" rx="2" fill="' + style(c) + '"/>';
      }).join('');
      return '<div class="l3-harm-card"><h5>' + p.name + '</h5><p>' + p.note + '</p>' +
        '<div class="l3-row" style="margin-bottom:10px">' + sw + '</div>' +
        '<svg viewBox="0 0 150 56" style="width:150px;height:56px;display:block">' + bars +
        '<line x1="0" y1="52" x2="150" y2="52" style="stroke: var(--c-border-2)"/></svg></div>';
    }).join('');
  }

  grayEl.addEventListener('change', render);
  cvdEl.addEventListener('change', render);
  render();
};

/* =========================================================
 * d-3-6 · Right-vs-wrong case study (3.6)
 *   same data + two palettes: rainbow (wrong) vs token sequential (right)
 * ======================================================= */
DEMOS['d-3-6'] = async function (mount) {
  const data = (await loadCrime()).sort((a, b) => b.murder - a.murder).slice(0, 12);
  const surface = tokRGB('--c-surface'), primary = tokRGB('--c-primary');

  // ⚠ a rainbow colormap is used deliberately here: hue sweeps a full 0→300°, to demonstrate the mismatch.
  //   It is not perceptually uniform, CVD-hostile and print-hostile — the only place hsl() is allowed in this chapter.
  const rainbowAt = (t) => 'hsl(' + (t * 300).toFixed(0) + ' 85% 52%)';
  // ✅ the right way: a monochrome ramp from token surface → primary, lightness monotonically increasing
  const seqAt = (t) => rgbCss(mixRGB(surface, primary, t));

  function vbars(colorFn, label) {
    const w = 520, h = 190, pad = 26, gap = 5;
    const max = Math.max(...data.map((d) => d.murder));
    const bw = (w - pad * 2 - gap * (data.length - 1)) / data.length;
    let s = '<svg class="l3-svg" viewBox="0 0 ' + w + ' ' + (h + 26) + '" role="img" aria-label="' + label + '">';
    s += '<line x1="' + pad + '" y1="' + (h + 12) + '" x2="' + (w - pad) + '" y2="' + (h + 12) + '" style="stroke: var(--c-border-2)"/>';
    data.forEach((d, i) => {
      const bh = (d.murder / max) * h;
      const x = pad + i * (bw + gap), y = h - bh + 12;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2" fill="' + colorFn(i / (data.length - 1)) + '"/>';
    });
    s += '</svg>';
    return s;
  }

  mount.innerHTML = `
    <div class="demo-grid">
      <div class="demo-sub is-bad"><h4>✗ Wrong: rainbow colormap (Jet-style)</h4>${vbars(rainbowAt, 'Bar chart with a rainbow colormap')}
        <p class="demo-note">As the hue sweeps around, the blue→green→yellow stretch is not monotonic in lightness, so flat regions sprout “fake bright steps”.</p></div>
      <div class="demo-sub is-good"><h4>✓ Right: sequential (token light → dark)</h4>${vbars(seqAt, 'Bar chart with a sequential colormap')}
        <p class="demo-note">Lightness increases monotonically, so the height the eye reads matches the color depth — no structure absent from the data is invented.</p></div>
    </div>
    <p class="demo-note">Both charts use <strong>the same data</strong> (top 12 states by murders in crime.csv). Only the palette differs: the rainbow makes readers see “a jump in the middle”, while the data in fact rises slowly.</p>`;
};

/* =========================================================
 * d-3-7 · “Vivid + low-saturation” philosophy generator (3.7)
 *   base hue / saturation / lightness → 7-color scheme + hex + copy all
 * ======================================================= */
DEMOS['d-3-7'] = function (mount) {
  const baseHue = rgb2hsl(tokRGB('--c-primary'))[0];
  let off = 0, S = 75, L = 55;

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">Base hue offset <input type="range" data-h min="0" max="359" value="0"><span class="val" data-vh>+0°</span></label>
      <label class="demo-control">Saturation <input type="range" data-s min="30" max="100" value="75"><span class="val" data-vs>75%</span></label>
      <label class="demo-control">Lightness <input type="range" data-l min="30" max="80" value="55"><span class="val" data-vl>55%</span></label>
    </div>
    <div class="l3-row" data-sw style="margin-bottom:12px"></div>
    <div class="l3-row">
      <button type="button" class="demo-btn demo-btn--primary l3-copybtn" data-copy>Copy all hex</button>
      <span class="pill" data-msg hidden></span>
    </div>
    <div data-copybox></div>
    <div data-chart style="margin-top:14px"></div>`;

  const hEl = mount.querySelector('[data-h]'), sEl = mount.querySelector('[data-s]'), lEl = mount.querySelector('[data-l]');
  const sw = mount.querySelector('[data-sw]');
  const msg = mount.querySelector('[data-msg]');
  const copybox = mount.querySelector('[data-copybox]');
  const chart = mount.querySelector('[data-chart]');

  // 7-color recipe: primary + 2 analogous (±30°) + 1 analogous low-sat + 1 complementary + 1 complementary low-sat + 1 highlight
  function genPalette(H, s, l) {
    const rot = (d) => H + d;
    const cs = (k) => Math.max(0, Math.min(100, s * k));
    const cl = (k) => Math.max(0, Math.min(100, l * k));
    return [
      hsl2rgb(rot(-30), cs(0.6), cl(1.10)),
      hsl2rgb(rot(-30), cs(1.0), cl(1.00)),
      hsl2rgb(H, cs(1.0), cl(1.00)),
      hsl2rgb(rot(30), cs(1.0), cl(1.00)),
      hsl2rgb(rot(30), cs(0.6), cl(1.10)),
      hsl2rgb(rot(180), cs(0.8), cl(0.95)),
      hsl2rgb(H, cs(0.2), cl(1.40)),
    ];
  }

  function render() {
    const H = baseHue + off;
    const cols = genPalette(H, S, L);
    sw.innerHTML = cols.map((c) =>
      '<div class="l3-chip"><div class="l3-sw" style="background:' + rgbCss(c) + '"></div><span class="l3-hex">' + hexOf(c) + '</span></div>').join('');

    // applied to a real chart: 7 bars
    let s = '<svg class="l3-svg" viewBox="0 0 520 150" role="img" aria-label="Bar chart drawn with the generated 7-color palette">';
    s += '<line x1="20" y1="120" x2="500" y2="120" style="stroke: var(--c-border-2)"/>';
    cols.forEach((c, i) => {
      const h = 28 + ((i * 37) % 80);
      s += '<rect x="' + (30 + i * 66) + '" y="' + (120 - h) + '" width="44" height="' + h + '" rx="4" fill="' + rgbCss(c) + '"/>';
    });
    s += '</svg>';
    chart.innerHTML = s;

    mount._hexes = cols.map(hexOf);
  }

  async function copyAll(hexes) {
    const text = hexes.join(', ');
    try {
      await navigator.clipboard.writeText(text);          // first choice: the async clipboard API
      return '7 hex values copied';
    } catch (err) {
      try {                                               // fallback 1: temporary textarea + execCommand
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) return 'copied (fallback mode)';
      } catch (e) { /* fall through to fallback 2 */ }
      // fallback 2: provide a text box that can be selected and copied manually
      const box = document.createElement('textarea');
      box.className = 'l3-copybox'; box.readOnly = true; box.value = text;
      copybox.innerHTML = ''; copybox.appendChild(box); box.select();
      return 'auto-copy was blocked by the browser; please select all and copy manually';
    }
  }

  hEl.addEventListener('input', () => { off = +hEl.value; mount.querySelector('[data-vh]').textContent = '+' + off + '°'; render(); });
  sEl.addEventListener('input', () => { S = +sEl.value; mount.querySelector('[data-vs]').textContent = S + '%'; render(); });
  lEl.addEventListener('input', () => { L = +lEl.value; mount.querySelector('[data-vl]').textContent = L + '%'; render(); });

  const btn = mount.querySelector('[data-copy]');
  btn.addEventListener('click', () => {
    copyAll(mount._hexes || []).then((m) => {
      msg.hidden = false; msg.className = 'pill pill--ok'; msg.textContent = m;
      btn.classList.remove('l3-flash'); void btn.offsetWidth; btn.classList.add('l3-flash');
      setTimeout(() => btn.classList.remove('l3-flash'), 220);
    });
  });

  render();
};

/* =========================================================
 * d-3-8 · CVD paper-figure test (3.8)
 *   three paper figures + four simulation modes + dual encoding
 * ======================================================= */
DEMOS['d-3-8'] = async function (mount) {
  let mode = 'normal', dual = false;

  const CLASS_COLS = ['--ch-1', '--ch-2', '--ch-3', '--ch-5', '--ch-6'];
  const centers = [[70, 46], [168, 62], [214, 138], [96, 146], [148, 100]];
  let seed = 20261016;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  function scatterSVG() {
    let s = '<svg class="l3-svg" viewBox="0 0 260 196" role="img" aria-label="5-class scatter plot">';
    s += '<line x1="20" y1="172" x2="248" y2="172" style="stroke: var(--c-border-2)"/>';
    s += '<line x1="20" y1="12" x2="20" y2="172" style="stroke: var(--c-border-2)"/>';
    CLASS_COLS.forEach((tok, ci) => {
      const c = rgbCss(tokRGB(tok));
      for (let k = 0; k < 13; k++) {
        const x = centers[ci][0] + (rnd() - 0.5) * 56;
        const y = centers[ci][1] + (rnd() - 0.5) * 52;
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.6" fill="' + c + '"/>';
      }
      s += '<circle cx="' + (34 + ci * 22) + '" cy="184" r="4" fill="' + c + '"/>';
      s += '<text x="' + (44 + ci * 22) + '" y="188" style="fill: var(--c-muted); font-size:10px">' + String.fromCharCode(65 + ci) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  function heatmapSVG() {
    const n = 12, cell = 17, pad = 14, w = pad * 2 + n * cell, h = pad * 2 + n * cell;
    const surface2 = tokRGB('--c-surface-2'), primary = tokRGB('--c-primary');
    let s = '<svg class="l3-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Sequential heatmap">';
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const t = 0.5 + 0.5 * Math.sin(i * 0.62) * Math.cos(j * 0.48);
        const c = rgbCss(mixRGB(surface2, primary, Math.max(0, Math.min(1, t))));
        s += '<rect x="' + (pad + i * cell) + '" y="' + (pad + j * cell) + '" width="' + (cell - 1) + '" height="' + (cell - 1) + '" rx="1.5" fill="' + c + '"/>';
      }
    }
    s += '</svg>';
    return s;
  }

  function redGreenSVG() {
    const red = rgbCss(tokRGB('--c-danger'));
    const green = rgbCss(tokRGB('--c-success'));
    let s = '<svg class="l3-svg" viewBox="0 0 260 196" role="img" aria-label="Red/green contrast chart">';
    s += '<line x1="20" y1="172" x2="248" y2="172" style="stroke: var(--c-border-2)"/>';
    s += '<line x1="20" y1="12" x2="20" y2="172" style="stroke: var(--c-border-2)"/>';
    for (let i = 0; i < 14; i++) {
      const x = 44 + i * 14, ya = 150 - ((i * 29 + 40) % 120), yb = 150 - ((i * 47 + 20) % 110);
      s += '<circle cx="' + x + '" cy="' + ya + '" r="4.2" fill="' + red + '"/>';
      if (dual) s += '<polygon points="' + x + ',' + (yb - 5) + ' ' + (x + 5) + ',' + (yb + 4) + ' ' + (x - 5) + ',' + (yb + 4) + '" fill="' + green + '"/>';
      else s += '<circle cx="' + x + '" cy="' + yb + '" r="4.2" fill="' + green + '"/>';
    }
    s += '<circle cx="34" cy="185" r="4.2" fill="' + red + '"/><text x="44" y="189" style="fill: var(--c-muted); font-size:10px">A</text>';
    if (dual) s += '<polygon points="72,180 77,189 67,189" fill="' + green + '"/><text x="84" y="189" style="fill: var(--c-muted); font-size:10px">B</text>';
    else s += '<circle cx="72" cy="185" r="4.2" fill="' + green + '"/><text x="82" y="189" style="fill: var(--c-muted); font-size:10px">B</text>';
    s += '</svg>';
    return s;
  }

  mount.innerHTML = `
    <div class="demo-controls">
      <span class="demo-control">Simulate:</span>
      <button type="button" class="demo-btn" data-mode="normal">Normal</button>
      <button type="button" class="demo-btn" data-mode="protanopia">Protanopia</button>
      <button type="button" class="demo-btn" data-mode="deuteranopia">Deuteranopia</button>
      <button type="button" class="demo-btn" data-mode="tritanopia">Tritanopia</button>
      <label class="demo-control"><input type="checkbox" data-dual> Color + shape dual encoding</label>
    </div>
    <div class="l3-paper">
      <figure data-p1>${scatterSVG()}<figcaption>Fig. 1 · 5-class scatter (Wong / Okabe–Ito palette)</figcaption></figure>
      <figure data-p2>${heatmapSVG()}<figcaption>Fig. 2 · Sequential heatmap (light → dark)</figcaption></figure>
      <figure data-p3>${redGreenSVG()}<figcaption>Fig. 3 · Red/green contrast (common wrong case)</figcaption></figure>
    </div>
    <p class="demo-note" data-note></p>`;

  const paper = [mount.querySelector('[data-p1] svg'), mount.querySelector('[data-p2] svg'), mount.querySelector('[data-p3] svg')];
  const note = mount.querySelector('[data-note]');
  const btnEls = [...mount.querySelectorAll('[data-mode]')];
  const dualEl = mount.querySelector('[data-dual]');

  const NOTES = {
    normal: 'Original: the three classes use different hues.',
    protanopia: 'Protanopia simulation: Fig. 1’s hues remain mostly separable (the Okabe–Ito lightness differences carry it); Fig. 3’s red / green are already converging.',
    deuteranopia: 'Deuteranopia simulation (the most common): Fig. 1 still separates; in Fig. 3 red and green nearly merge into one color — the fatal flaw of “telling classes apart by red vs green”.',
    tritanopia: 'Tritanopia simulation: the blue—yellow axis is affected; Fig. 3 suffers less, but in Fig. 1 the blue family and its neighbor must rely on lightness to separate.',
  };

  function applyMode() {
    paper.forEach((svg) => {
      if (!svg) return;
      svg.querySelectorAll('[fill]').forEach((el) => {
        const cur = el.getAttribute('fill');
        if (!cur || cur === 'none') return;
        if (!el.dataset.orig) el.dataset.orig = cur;
        el.setAttribute('fill', mode === 'normal' ? el.dataset.orig : rgbCss(cvdSim(parseColorCss(el.dataset.orig), mode)));
      });
    });
  }

  btnEls.forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    btnEls.forEach((x) => x.classList.toggle('demo-btn--primary', x === b));
    applyMode();
    note.textContent = NOTES[mode];
  }));

  dualEl.addEventListener('change', () => {
    dual = dualEl.checked;
    mount.querySelector('[data-p3]').innerHTML = redGreenSVG() + '<figcaption>Fig. 3 · Red/green contrast' + (dual ? ' (shape second encoding added)' : ' (common wrong case)') + '</figcaption>';
    paper[2] = mount.querySelector('[data-p3] svg');
    applyMode();
    note.textContent = dual
      ? 'A shape has been added to each class: after the colors collapse, the circles and triangles still separate A and B — that is the “dual encoding” remedy.'
      : NOTES[mode];
  });

  btnEls[0].classList.add('demo-btn--primary');
  note.textContent = NOTES.normal;
  applyMode();
};

/* =========================================================
 * Boot
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('Chapter 3 · Color', { lesson: 'lesson-03' });
