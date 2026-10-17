// =========================================================
// lesson-03/lesson.js —— 第 3 章「色彩专题」的可运行演示
// ---------------------------------------------------------
// 约定（与 lesson-core.js 对接）：
//   ① 用 window.DEMOS['d-3-x'] = fn 注册演示
//   ② 页面用 <div class="demo-mount" data-demo="d-3-x"> 挂载
//   ③ 最后调用 initLesson('第 3 章 · 色彩专题', { lesson: 'lesson-03' })
//
// 依赖策略：全部用「原生 DOM + 内联 SVG」，不引 d3、不引任何 CDN。
//   颜色一律在运行时由设计令牌计算得到（可随深浅主题自动适配），
//   源码中不出现写死的色值；唯一的例外是 3.6「彩虹色阶」——
//   那段就是要演示错配，已在代码里注明。
//   动画禁用 requestAnimationFrame：用 void offsetWidth 强制重排 + CSS transition。
// =========================================================

import { initLesson } from '../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) 本章演示私有样式（注入一次，不污染共享样式表）
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
 * 1) 颜色工具：令牌取色 → 数值 → 任意空间换算
 *    一律在运行时计算，源码不写死色值。
 * ------------------------------------------------------- */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// 解析 "#rrggbb" / "#rgb" / "rgb(a, b, c)" → [r, g, b]
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

// HSL（h∈[0,360) s,l∈[0,100]）
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

// WCAG 相对亮度（0..1）
function luminance(c) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}
function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- 线性代数（3×3） ---------- */
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

/* ---------- sRGB ↔ 线性 ↔ XYZ ↔ Lab（D65） ---------- */
const WHITE_D65 = [0.3127 / 0.3290, 1, (1 - 0.3127 - 0.3290) / 0.3290];

// 由原色坐标 + 白点构造 RGB↔XYZ 矩阵（通用，可复用给 Adobe RGB / Rec.2020）
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
// Lab → 某色域下的（未钳位）RGB，0..1 三元组；用于判断是否超色域
function labToRgb01(lab, m) {
  const lin = mat3MulVec(m.fromXYZ, lab2xyz(lab));
  return [linearToSrgbRaw(lin[0]), linearToSrgbRaw(lin[1]), linearToSrgbRaw(lin[2])];
}
function inGamut01(v) { return v[0] >= -0.002 && v[0] <= 1.002 && v[1] >= -0.002 && v[1] <= 1.002 && v[2] >= -0.002 && v[2] <= 1.002; }
function labToRgbClamped(lab, m) {
  return labToRgb01(lab, m).map((v) => Math.max(0, Math.min(1, v)) * 255);
}
// 固定 L*，沿色相角二分求「最远的仍在色域内的半径」→ 多边形
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

/* ---------- CVD 模拟（Machado 2009 一类 3×3 近似） ---------- */
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
 * 2) 数据：crime.csv（fetch 失败时用内置兜底，保证 file:// 下也能跑）
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
    const res = await fetch('./data/crime.csv');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = toObjects(parseCSV(await res.text()));
    const data = rows.map((o) => ({
      state: o.state,
      population: +o.population,
      murder: +o.murder,
      robbery: +o.robbery,
    })).filter((d) => d.state && isFinite(d.murder));
    if (data.length) return data;
  } catch (e) { /* 离线 / CORS 时走兜底 */ }
  return CRIME_FALLBACK.slice();
}

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* =========================================================
 * d-3-1 · 颜色模型基础（3.1）
 *   4 大颜色空间示意（内联 SVG）+ 三滑块取色 + 四空间读数 + CVD 行
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
    <svg class="l3-svg" viewBox="0 0 640 196" role="img" aria-label="三种颜色空间的示意：RGB 加色叠加、HSL 色相环上的位置、CIE Lab 的 a*b* 平面坐标"></svg>
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

    // ---- 示意图：三段面板 ----
    let s = '';
    // 面板 1 · RGB 加色叠加
    s += '<text x="14" y="20" style="fill: var(--c-text); font-size:12px; font-weight:700;">RGB · 加色</text>';
    s += '<circle cx="60" cy="72" r="34" style="fill: var(--c-danger); fill-opacity:.55;"/>';
    s += '<circle cx="104" cy="72" r="34" style="fill: var(--c-success); fill-opacity:.55;"/>';
    s += '<circle cx="82" cy="114" r="34" style="fill: var(--c-info); fill-opacity:.55;"/>';
    s += '<text x="82" y="166" text-anchor="middle" style="fill: var(--c-text); font-size:11px;">C 处 = 三通道同时高</text>';
    s += '<text x="82" y="184" text-anchor="middle" style="fill: var(--c-muted); font-size:10.5px;">当前值 R' + r + ' G' + g + ' B' + b + '</text>';

    // 面板 2 · HSL 色相环（用 --ch-1..8 令牌铺成 8 段）
    const cx = 268, cy = 96, rr = 54;
    s += '<text x="216" y="20" style="fill: var(--c-text); font-size:12px; font-weight:700;">HSL · 色相环</text>';
    for (let i = 0; i < 8; i++) {
      s += '<path d="' + arc(cx, cy, rr, i * 45 + 2, (i + 1) * 45 - 2) + '" fill="none" style="stroke: var(--ch-' + (i + 1) + '); stroke-width:16; stroke-linecap:butt;"/>';
    }
    const ha = hsl[0];
    const hx = cx + rr * Math.sin(ha * Math.PI / 180), hy = cy - rr * Math.cos(ha * Math.PI / 180);
    s += '<circle cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" r="8" fill="' + rgbCss(rgb) + '" style="stroke: var(--c-surface); stroke-width:2.5;"/>';
    s += '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" style="fill: var(--c-text); font-size:10.5px;">H ' + Math.round(ha) + '°</text>';
    s += '<text x="216" y="172" style="fill: var(--c-muted); font-size:10.5px;">S ' + Math.round(hsl[1]) + '% · L ' + Math.round(hsl[2]) + '%</text>';
    s += '<text x="216" y="188" style="fill: var(--c-muted); font-size:10.5px;">注意：HSL 明度不是感知均匀的</text>';

    // 面板 3 · CIE Lab 的 a*b* 平面
    const ox = 470, oy = 101, sc = 0.62;
    s += '<text x="410" y="20" style="fill: var(--c-text); font-size:12px; font-weight:700;">CIE Lab · a*b*</text>';
    s += '<line x1="' + (ox - 62) + '" y1="' + oy + '" x2="' + (ox + 76) + '" y2="' + oy + '" style="stroke: var(--c-border-2);"/>';
    s += '<line x1="' + ox + '" y1="' + (oy - 72) + '" x2="' + ox + '" y2="' + (oy + 72) + '" style="stroke: var(--c-border-2);"/>';
    s += '<text x="' + (ox + 80) + '" y="' + (oy + 4) + '" style="fill: var(--c-muted); font-size:10px;">a*</text>';
    s += '<text x="' + (ox + 8) + '" y="' + (oy - 56) + '" style="fill: var(--c-muted); font-size:10px;">b*</text>';
    const px = ox + Math.max(-62, Math.min(76, lab[1] * sc)), py = oy - Math.max(-72, Math.min(72, lab[2] * sc));
    s += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="9" fill="' + rgbCss(rgb) + '" style="stroke: var(--c-surface); stroke-width:2.5;"/>';
    s += '<text x="410" y="172" style="fill: var(--c-muted); font-size:10.5px;">距离 ≈ 感知差</text>';
    s += '<text x="410" y="188" style="fill: var(--c-muted); font-size:10.5px;">设计 colormap 就在 Lab 里插值</text>';
    svg.innerHTML = s;

    // ---- 四空间读数 ----
    read.innerHTML = [
      ['RGB · 加色（设备相关）', r + ', ' + g + ', ' + b],
      ['HSL · 直觉（仍不感知均匀）', Math.round(hsl[0]) + '°, ' + Math.round(hsl[1]) + '%, ' + Math.round(hsl[2]) + '%'],
      ['CIE Lab · 感知均匀', 'L*' + lab[0].toFixed(0) + ' a*' + lab[1].toFixed(0) + ' b*' + lab[2].toFixed(0)],
      ['CMYK · 减色（印刷）', cmyk.map((v) => Math.round(v)).join(', ')],
    ].map((d) => '<div class="l3-read"><h5>' + d[0] + '</h5><code>' + d[1] + '</code></div>').join('');

    // ---- CVD 行：原色 → 模拟色 ----
    const rows = [['红色盲 protanopia', 'protanopia'], ['绿色盲 deuteranopia', 'deuteranopia'], ['蓝色盲 tritanopia', 'tritanopia']];
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
  // 初始值：取令牌主色
  rEl.value = rgb[0]; gEl.value = rgb[1]; bEl.value = rgb[2];
  render();
};

/* =========================================================
 * d-3-2 · colormap 三类选择（3.2）
 *   三条对照条（顺序 / 发散 / 定性）+ 同一份数据的柱状图
 * ======================================================= */
DEMOS['d-3-2'] = async function (mount) {
  const all = (await loadCrime()).sort((a, b) => b.murder - a.murder);
  const data = all.slice(0, 12);

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">柱状图用哪一类
        <select data-kind>
          <option value="seq">顺序型 Sequential</option>
          <option value="div">发散型 Diverging</option>
          <option value="qual">定性型 Qualitative</option>
        </select>
      </label>
    </div>
    <p class="l3-strip-label">顺序型 Sequential —— 值的大小（浅 → 深）</p>
    <div class="l3-strip" style="background:linear-gradient(90deg,${[10, 28, 46, 64, 82, 100].map((p) => 'color-mix(in srgb, var(--c-primary) ' + p + '%, var(--c-surface))').join(',')})"></div>
    <p class="l3-strip-label">发散型 Diverging —— 偏离中心（负 ← 中点 → 正）</p>
    <div class="l3-strip" style="background:linear-gradient(90deg,color-mix(in srgb, var(--c-danger) 92%, var(--c-surface)),color-mix(in srgb, var(--c-danger) 34%, var(--c-surface)),var(--c-surface-2),color-mix(in srgb, var(--c-info) 34%, var(--c-surface)),color-mix(in srgb, var(--c-info) 92%, var(--c-surface)))"></div>
    <p class="l3-strip-label">定性型 Qualitative —— 类别之间无顺序（Okabe–Ito 令牌）</p>
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
    let s = '<svg class="l3-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="按州排序的谋杀案数横向柱状图">';
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
    seq: '顺序型用在「有大小顺序」的谋杀案数上 —— 读者读得出谁多谁少。这是正确的类型选择 ✓',
    div: '发散型表达「偏离中心值」，这里硬套会暗示存在一个天然的中心 —— 数据并不支持这个暗示 ⚠',
    qual: '定性型只表达「类别」、不表达「大小」；用它画数量柱，读者读不出数值高低 —— 类型错配 ✗',
  };

  function render() {
    chart.innerHTML = barsSVG();
    note.textContent = NOTES[sel.value];
  }
  sel.addEventListener('change', render);
  render();
};

/* =========================================================
 * d-3-3 · CIE Lab 色域图（3.3）
 *   三层嵌套色域（sRGB / Adobe RGB / Rec.2020）+ L* 滑块 + 可拖动取样点
 * ======================================================= */
DEMOS['d-3-3'] = function (mount) {
  const VB = 300, C = 150, SC = 0.9;
  let L = 55, sample = [42, -34];

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">L* <input type="range" data-l min="8" max="96" value="55"><span class="val" data-vl>55</span></label>
    </div>
    <div class="l3-gamut-wrap"><svg class="l3-svg l3-svg--tight" viewBox="0 0 ${VB} ${VB}" data-gamut role="img" aria-label="CIE Lab 的 a*b* 色域图：内层 sRGB、中层 Adobe RGB、外层 Rec.2020，可拖动取样点"></svg></div>
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
    <p class="demo-note">在图上拖动灰点取样：色块是该坐标（L*a*b*）在 sRGB 下「不钳位换算」的结果，越界即为超色域。拖动时配合 L* 滑块，可看不同明度下色域的形状变化。</p>`;

  const svg = mount.querySelector('[data-gamut]');
  const lEl = mount.querySelector('[data-l]');
  const sm = mount.querySelector('[data-sm]');
  const info = mount.querySelector('[data-info]');
  const pill = mount.querySelector('[data-pill]');

  const X = (a) => C + a * SC;
  const Y = (b) => C - b * SC;

  function draw() {
    let s = '';
    // 1) 色域内部填充：逐点 Lab→sRGB，落在色域内才画（step=8，约 1000 个小色块）
    for (let a = -160; a <= 160; a += 8) {
      for (let b = -160; b <= 160; b += 8) {
        const rgb = labToRgb01([L, a, b], SRGB);
        if (!inGamut01(rgb)) continue;
        s += '<rect x="' + (X(a) - 4).toFixed(1) + '" y="' + (Y(b) - 4).toFixed(1) + '" width="7" height="7" fill="' + rgb01(rgb) + '"/>';
      }
    }
    // 2) 三层色域边界
    const outlines = [
      ['sRGB', SRGB, 'var(--c-text)', '4 3'],
      ['Adobe RGB', ADOBE, 'var(--c-info)', '1 3'],
      ['Rec.2020', REC2020, 'var(--c-danger)', ''],
    ];
    outlines.forEach((o) => {
      const pts = gamutOutline(L, o[1], 72).map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
      s += '<polygon points="' + pts + '" fill="none" style="stroke:' + o[2] + '; stroke-width:1.6;" stroke-dasharray="' + o[3] + '"/>';
    });
    // 3) 取样点
    const raw = labToRgb01([L, sample[0], sample[1]], SRGB);
    const ok = inGamut01(raw);
    const col = rgb01(raw.map((v) => Math.max(0, Math.min(1, v))));
    s += '<circle cx="' + X(sample[0]).toFixed(1) + '" cy="' + Y(sample[1]).toFixed(1) + '" r="9" fill="' + col + '" style="stroke: var(--c-text); stroke-width:2.5;"/>';
    svg.innerHTML = s;

    sm.style.background = col;
    info.textContent = 'L*' + L.toFixed(0) + '  a*' + sample[0].toFixed(0) + '  b*' + sample[1].toFixed(0);
    if (ok) { pill.className = 'pill pill--ok'; pill.textContent = '在 sRGB 色域内'; }
    else { pill.className = 'pill pill--warn'; pill.textContent = '超色域 → 会被 clamp'; }
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
 * d-3-4 · 色系搭配规则（3.4）+ 对比度检查器
 * ======================================================= */
DEMOS['d-3-4'] = function (mount) {
  const baseHue = rgb2hsl(tokRGB('--c-primary'))[0];
  const surface = tokRGB('--c-surface'), textTok = tokRGB('--c-text');
  let off = 0, S = 72, L = 52;

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">基准色相 <input type="range" data-h min="0" max="359" value="0"><span class="val" data-vh>+0°</span></label>
      <label class="demo-control">饱和度 <input type="range" data-s min="20" max="100" value="72"><span class="val" data-vs>72%</span></label>
      <label class="demo-control">亮度 <input type="range" data-l min="20" max="80" value="52"><span class="val" data-vl>52%</span></label>
    </div>
    <div class="l3-harm" data-harm></div>

    <h4 style="margin:18px 0 8px;font-size:13.5px">对比度检查器（WCAG 2.1）</h4>
    <div class="demo-controls">
      <label class="demo-control">前景 <input type="color" data-fg></label>
      <label class="demo-control">背景 <input type="color" data-bg></label>
      <div class="l3-row">
        <span class="pill" data-aa>—</span>
        <span class="pill" data-aaa>—</span>
      </div>
    </div>
    <div data-samples></div>
    <p class="demo-note">对比度 =（较亮者亮度 + 0.05）/（较暗者亮度 + 0.05）。AA 正文需 ≥ 4.5:1、大字号 ≥ 3:1；AAA 正文需 ≥ 7:1、大字号 ≥ 4.5:1。</p>`;

  const harm = mount.querySelector('[data-harm]');
  const hEl = mount.querySelector('[data-h]'), sEl = mount.querySelector('[data-s]'), lEl = mount.querySelector('[data-l]');
  const fgEl = mount.querySelector('[data-fg]'), bgEl = mount.querySelector('[data-bg]');
  const aa = mount.querySelector('[data-aa]'), aaa = mount.querySelector('[data-aaa]');
  const samples = mount.querySelector('[data-samples]');

  const RULES = [
    { name: '① 单色 Monochromatic', desc: '同一色相，只调明度 —— 最稳、最不容易出错', hues: [0, 0, 0, 0, 0], lf: [1.35, 1.15, 1.0, 0.86, 0.72] },
    { name: '② 类比 Analogous', desc: '相邻 ±30° 之内 —— 柔和、统一，适合强调「同族」', hues: [-30, -15, 0, 15, 30], lf: [1.08, 1, 1, 1, 1.08] },
    { name: '③ 三等分 Triadic', desc: '相隔 120° —— 对比强、颜色丰富，注意主次', hues: [0, 120, 240, 0, 120], lf: [1, 1, 1, 0.84, 0.84] },
    { name: '④ 分裂互补 Split', desc: '主色 + 对面两侧（±150°）—— 有对比又不刺眼', hues: [0, 150, 210, 0, 150], lf: [1, 1, 1, 0.86, 0.86] },
    { name: '⑤ 互补 Complementary', desc: '相隔 180° —— 对比最强，面积要分主次', hues: [0, 180, 0, 180, 0], lf: [1, 1, 1.22, 1.22, 0.82] },
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
    aa.textContent = 'AA 正文 4.5:1 ' + (ratio >= 4.5 ? '✓' : '✗') + '（比值 ' + ratio.toFixed(2) + '）';
    aaa.className = 'pill ' + (ratio >= 7 ? 'pill--ok' : 'pill--no');
    aaa.textContent = 'AAA 正文 7:1 ' + (ratio >= 7 ? '✓' : '✗');

    const rLight = contrastRatio(fg, surface), rDark = contrastRatio(fg, textTok);
    samples.innerHTML =
      '<div class="l3-sample" style="background:' + rgbCss(surface) + ';color:' + rgbCss(fg) + '">浅底上的文字 · 对比度 ' + rLight.toFixed(2) +
      ' <span class="pill ' + (rLight >= 4.5 ? 'pill--ok' : 'pill--no') + '">' + (rLight >= 4.5 ? '可读' : '偏弱') + '</span></div>' +
      '<div class="l3-sample" style="background:' + rgbCss(textTok) + ';color:' + rgbCss(fg) + '">深底上的文字 · 对比度 ' + rDark.toFixed(2) +
      ' <span class="pill ' + (rDark >= 4.5 ? 'pill--ok' : 'pill--no') + '">' + (rDark >= 4.5 ? '可读' : '偏弱') + '</span></div>';
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
 * d-3-5 · 科研经典配色（3.5）
 *   5 套色板卡片 + 灰度自检 / CVD 切换
 * ======================================================= */
DEMOS['d-3-5'] = function (mount) {
  const surface = tokRGB('--c-surface'), primary = tokRGB('--c-primary');
  const surface2 = tokRGB('--c-surface-2'), danger = tokRGB('--c-danger'), info = tokRGB('--c-info');

  const PALETTES = [
    {
      name: 'Okabe–Ito（CVD 友好）', note: '本站 --ch-1..8，色相与明度双重拉开，色觉缺陷下仍可分',
      colors: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => tokRGB('--ch-' + i)),
    },
    {
      name: '低饱和派生', note: 'ch 令牌与表面色混合 45%，做「配套色」用，整页更耐看',
      colors: [1, 2, 3, 4, 5, 6].map((i) => mixRGB(tokRGB('--ch-' + i), surface, 0.45)),
    },
    {
      name: '单色深浅阶', note: '主色与表面之间取 6 档 —— 顺序型，保证「越深越大」',
      colors: [100, 80, 60, 42, 26, 14].map((p) => mixRGB(surface, primary, p / 100)),
    },
    {
      name: '顺序型（青蓝系）', note: '浅 → 深单调递增，灰度打印与 CVD 下都还读得出大小',
      colors: [12, 30, 48, 66, 84, 100].map((p) => mixRGB(surface, info, p / 100)),
    },
    {
      name: '发散型（负 ↔ 正）', note: '两端对立、中点最浅 —— 只用于「偏离某个中心」的数据',
      colors: [-1, -0.6, -0.25, 0.25, 0.6, 1].map((t) => t < 0 ? mixRGB(surface2, danger, -t) : mixRGB(surface2, info, t)),
    },
  ];

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control"><input type="checkbox" data-gray> 灰度自检（黑白打印）</label>
      <label class="demo-control">色觉模拟
        <select data-cvd>
          <option value="normal">正常</option>
          <option value="deuteranopia">绿色盲</option>
          <option value="protanopia">红色盲</option>
          <option value="tritanopia">蓝色盲</option>
        </select>
      </label>
    </div>
    <div class="l3-harm" data-cards></div>
    <p class="demo-note">同一套色板，在「灰度」或「色觉缺陷」下是否还分得开，是它能不能进论文的硬指标。切到灰度后若几档并成一色，就需要形状等第二编码。</p>`;

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
      // 迷你「在用」示意：一排小柱子
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
 * d-3-6 · 对错案例对比（3.6）
 *   同一份数据 + 两种配色：彩虹（错） vs 令牌顺序型（对）
 * ======================================================= */
DEMOS['d-3-6'] = async function (mount) {
  const data = (await loadCrime()).sort((a, b) => b.murder - a.murder).slice(0, 12);
  const surface = tokRGB('--c-surface'), primary = tokRGB('--c-primary');

  // ⚠ 这里故意用彩虹色阶：色相沿 0→300° 扫一圈，就是要演示错配。
  //   它非感知均匀、CVD 不友好、打印也不友好 —— 本章唯一允许出现 hsl() 的地方。
  const rainbowAt = (t) => 'hsl(' + (t * 300).toFixed(0) + ' 85% 52%)';
  // ✅ 正确做法：令牌表面色 → 主色的单色阶，亮度单调递增
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
      <div class="demo-sub is-bad"><h4>✗ 错误：彩虹色阶（Jet 型）</h4>${vbars(rainbowAt, '彩虹色阶柱状图')}
        <p class="demo-note">色相扫一圈，蓝→绿→黄那一段明度不单调，平缓处会冒出「假亮台阶」。</p></div>
      <div class="demo-sub is-good"><h4>✓ 正确：顺序型（令牌浅 → 深）</h4>${vbars(seqAt, '顺序型柱状图')}
        <p class="demo-note">亮度单调递增，眼睛读到的高度与颜色深浅一致，不会制造数据里没有的结构。</p></div>
    </div>
    <p class="demo-note">两张图用的是<strong>同一份数据</strong>（crime.csv 谋杀案数前 12 州）。差别只在配色：彩虹让读者读出「中段突变」，而数据其实在缓慢上升。</p>`;
};

/* =========================================================
 * d-3-7 · 鲜艳 + 低饱和 哲学生成器（3.7）
 *   基准色相 / 饱和度 / 亮度 → 7 色方案 + hex + 复制全部
 * ======================================================= */
DEMOS['d-3-7'] = function (mount) {
  const baseHue = rgb2hsl(tokRGB('--c-primary'))[0];
  let off = 0, S = 75, L = 55;

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">基准色相偏移 <input type="range" data-h min="0" max="359" value="0"><span class="val" data-vh>+0°</span></label>
      <label class="demo-control">饱和度 <input type="range" data-s min="30" max="100" value="75"><span class="val" data-vs>75%</span></label>
      <label class="demo-control">亮度 <input type="range" data-l min="30" max="80" value="55"><span class="val" data-vl>55%</span></label>
    </div>
    <div class="l3-row" data-sw style="margin-bottom:12px"></div>
    <div class="l3-row">
      <button type="button" class="demo-btn demo-btn--primary l3-copybtn" data-copy>复制全部 hex</button>
      <span class="pill" data-msg hidden></span>
    </div>
    <div data-copybox></div>
    <div data-chart style="margin-top:14px"></div>`;

  const hEl = mount.querySelector('[data-h]'), sEl = mount.querySelector('[data-s]'), lEl = mount.querySelector('[data-l]');
  const sw = mount.querySelector('[data-sw]');
  const msg = mount.querySelector('[data-msg]');
  const copybox = mount.querySelector('[data-copybox]');
  const chart = mount.querySelector('[data-chart]');

  // 7 色配方：主色 + 2 类比（±30°）+ 1 类比低饱和 + 1 互补 + 1 互补低饱和 + 1 高亮
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

    // 用在真实图表上：7 根柱子
    let s = '<svg class="l3-svg" viewBox="0 0 520 150" role="img" aria-label="用生成的 7 色调色板画的柱状图">';
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
      await navigator.clipboard.writeText(text);          // 首选：异步剪贴板 API
      return '已复制 7 个 hex';
    } catch (err) {
      try {                                               // 降级 1：临时 textarea + execCommand
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) return '已复制（降级模式）';
      } catch (e) { /* 继续降级 2 */ }
      // 降级 2：给出可手动全选复制的文本框
      const box = document.createElement('textarea');
      box.className = 'l3-copybox'; box.readOnly = true; box.value = text;
      copybox.innerHTML = ''; copybox.appendChild(box); box.select();
      return '自动复制被浏览器拦截，请手动全选复制';
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
 * d-3-8 · CVD 论文图测（3.8）
 *   三张论文图 + 四种模拟模式 + 双编码
 * ======================================================= */
DEMOS['d-3-8'] = async function (mount) {
  let mode = 'normal', dual = false;

  const CLASS_COLS = ['--ch-1', '--ch-2', '--ch-3', '--ch-5', '--ch-6'];
  const centers = [[70, 46], [168, 62], [214, 138], [96, 146], [148, 100]];
  let seed = 20261016;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  function scatterSVG() {
    let s = '<svg class="l3-svg" viewBox="0 0 260 196" role="img" aria-label="5 类别散点图">';
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
    let s = '<svg class="l3-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="顺序型热图">';
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
    let s = '<svg class="l3-svg" viewBox="0 0 260 196" role="img" aria-label="红绿对比图">';
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
      <span class="demo-control">模拟：</span>
      <button type="button" class="demo-btn" data-mode="normal">正常</button>
      <button type="button" class="demo-btn" data-mode="protanopia">红色盲</button>
      <button type="button" class="demo-btn" data-mode="deuteranopia">绿色盲</button>
      <button type="button" class="demo-btn" data-mode="tritanopia">蓝色盲</button>
      <label class="demo-control"><input type="checkbox" data-dual> 颜色 + 形状双编码</label>
    </div>
    <div class="l3-paper">
      <figure data-p1>${scatterSVG()}<figcaption>图 1 · 5 类别散点（Wong / Okabe–Ito 配色）</figcaption></figure>
      <figure data-p2>${heatmapSVG()}<figcaption>图 2 · 顺序型热图（浅 → 深）</figcaption></figure>
      <figure data-p3>${redGreenSVG()}<figcaption>图 3 · 红 / 绿对比（常见错误案例）</figcaption></figure>
    </div>
    <p class="demo-note" data-note></p>`;

  const paper = [mount.querySelector('[data-p1] svg'), mount.querySelector('[data-p2] svg'), mount.querySelector('[data-p3] svg')];
  const note = mount.querySelector('[data-note]');
  const btnEls = [...mount.querySelectorAll('[data-mode]')];
  const dualEl = mount.querySelector('[data-dual]');

  const NOTES = {
    normal: '原图：三类分别用不同色相。',
    protanopia: '红色盲模拟：图 1 的各色相仍基本可分（Okabe–Ito 的亮度差在支撑）；图 3 的红 / 绿已经开始靠近。',
    deuteranopia: '绿色盲模拟（最常见）：图 1 仍可分；图 3 的红与绿几乎并成一色 —— 这就是「靠红绿区分类别」的致命伤。',
    tritanopia: '蓝色盲模拟：蓝—黄方向受影响；图 3 受影响较小，但图 1 里蓝系与其邻居需要靠亮度区分。',
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
    mount.querySelector('[data-p3]').innerHTML = redGreenSVG() + '<figcaption>图 3 · 红 / 绿对比' + (dual ? '（已加形状第二编码）' : '（常见错误案例）') + '</figcaption>';
    paper[2] = mount.querySelector('[data-p3] svg');
    applyMode();
    note.textContent = dual
      ? '已给两类各加一个形状：颜色坍缩后，圆点与三角仍能把 A、B 分开 —— 这就是「双编码」的补救。'
      : NOTES[mode];
  });

  btnEls[0].classList.add('demo-btn--primary');
  note.textContent = NOTES.normal;
  applyMode();
};

/* =========================================================
 * 启动
 * ======================================================= */
/* =========================================================
 * 原创演示 3.x —— 配色急诊室
 *   4 个「配色生病」的病例，三选一开药方：选对即治愈并复色，
 *   选错给病理分析；治愈后可用 CVD 滤镜复查全部病例。
 *   综合运用本章所有配色规则：顺序 / 定性 / 对比 / 明度 / CVD。
 * ======================================================= */
DEMOS['d-3-x'] = (mount) => {
  // 私有样式（一次性注入）
  if (!document.getElementById('l3x-styles')) {
    const st = document.createElement('style');
    st.id = 'l3x-styles';
    st.textContent = `
.l3x-score { padding: 8px 12px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--c-primary) var(--mix-soft), var(--c-surface)); font-size: 12.5px; color: var(--c-text); }
.l3x-patient { display: grid; grid-template-columns: 300px 1fr; gap: 14px; padding: 14px 0; border-top: 1px solid var(--c-line); align-items: start; }
@media (max-width: 720px) { .l3x-patient { grid-template-columns: 1fr; } }
.l3x-patient:first-of-type { border-top: 0; padding-top: 4px; }
.l3x-patient h4 { margin: 0 0 4px; font-size: 13px; color: var(--c-text); }
.l3x-patient .l3x-desc { margin: 0 0 10px; font-size: 12px; color: var(--c-muted); }
.l3x-chart { border: 1px solid var(--c-line); border-radius: var(--radius-sm); padding: 8px; background: var(--c-surface-2); }
.l3x-opts { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.l3x-opts .demo-btn { text-align: left; justify-content: flex-start; }
.l3x-opts .demo-btn.is-ok { border-color: var(--c-success); color: var(--c-success); }
.l3x-opts .demo-btn.is-bad { opacity: .45; text-decoration: line-through; }
.l3x-why { margin: 8px 0 0; font-size: 11.5px; color: var(--c-text-soft); }
.l3x-why b { color: var(--c-success); }
.l3x-why s { color: var(--c-danger); }
`;
    document.head.appendChild(st);
  }

  // 病理色板（演示主题色，独立于 UI 令牌）
  const RAINBOW = ['#e41a1c', '#ff7f00', '#ffe945', '#4daf4a', '#4575e6'];
  const SEQ_BLUE = ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5'];
  const OKABE5 = ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9'];
  const REDGREEN = ['#d7191c', '#1a9641'];
  const BLUEORANGE = ['#0072b2', '#e69f00'];
  const LOWCON = ['#a3a9b3', '#b3a9b3'];
  const DARKLIGHT = ['#2b5c8a', '#f0b429'];
  const REDWARM = ['#a63603', '#e6550d', '#fd8d3c', '#fdae6b', '#fdd0a2'];

  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  const PATIENTS = [
    {
      id: 'a', chart: 'bars',
      title: '病例 A · 用彩虹色表达顺序',
      desc: '5 个月的学习时长逐月递增 —— 这是顺序型数据，彩虹色相却毫无大小含义。',
      data: [['3 月', 4], ['4 月', 5], ['5 月', 6.5], ['6 月', 8], ['7 月', 9]],
      sick: RAINBOW,
      options: [
        { label: '药方 1：Okabe–Ito 定性五色', colors: OKABE5, ok: false, why: '定性板主张「各类平等」，不传达大小，还会反过来暗示类别无序。' },
        { label: '药方 2：单色青蓝渐变（浅 → 深）', colors: SEQ_BLUE, ok: true, why: '明度随数值单调递增，顺序一眼可读，灰度打印与 CVD 下依旧成立。' },
        { label: '药方 3：红 → 绿发散色板', colors: REDGREEN, ok: false, why: '发散板适合「有中点」的数据（如盈亏），这里没有中点，且红绿对色觉缺陷不友好。' },
      ],
    },
    {
      id: 'b', chart: 'bars',
      title: '病例 B · 红 / 绿表达「对 / 错」',
      desc: '判断题结果只有两类：正确 vs 错误 —— 需要一眼区分的两极。',
      data: [['正确', 32], ['错误', 11]],
      sick: REDGREEN,
      options: [
        { label: '药方 1：红绿都再加深', colors: ['#8b1410', '#0f5c22'], ok: false, why: '加深后明度接近，红绿色盲者看到的仍是两块几乎相同的深色。' },
        { label: '药方 2：蓝 / 橙对比对', colors: BLUEORANGE, ok: true, why: '红绿色盲下蓝橙依旧一冷一暖 —— CVD 安全对比的经典答案。' },
        { label: '药方 3：蓝 → 深蓝顺序渐变', colors: ['#dbe9f6', '#2171b5'], ok: false, why: '渐变表达「多少」，而这两个类别彼此平等，应该用对比而非渐变。' },
      ],
    },
    {
      id: 'c', chart: 'lines',
      title: '病例 C · 两条线明度太接近',
      desc: '班级 A / B 的月均成绩折线几乎融为一体 —— 线图区分靠明度，不靠色相花哨。',
      data: null,
      sick: LOWCON,
      options: [
        { label: '药方 1：两色都换更浅的粉彩', colors: ['#c9d4de', '#dcc9d4'], ok: false, why: '继续压低对比，线和网格线粘在一起，可读性更差。' },
        { label: '药方 2：深色 + 浅色拉开明度', colors: DARKLIGHT, ok: true, why: '先拉大明度差、再谈色相 —— 明度是线型图区分的第一通道。' },
        { label: '药方 3：两色都换高饱和彩虹', colors: ['#e41a1c', '#4575e6'], ok: false, why: '高饱和 ≠ 高可读：两条彩虹线明度仍可能相当，冲突没有解决。' },
      ],
    },
    {
      id: 'd', chart: 'bars',
      title: '病例 D · 用渐变色表达无序类别',
      desc: '5 门选修课的选课人数 —— 类别彼此平等，却套了深浅渐变，暗示了并不存在的顺序。',
      data: [['音乐', 24], ['影视', 31], ['摄影', 18], ['戏剧', 27], ['写作', 22]],
      sick: SEQ_BLUE,
      options: [
        { label: '药方 1：Okabe–Ito 定性五色', colors: OKABE5, ok: true, why: '类别平等 → 用色相区分，明度、饱和度保持接近，不暗示任何顺序。' },
        { label: '药方 2：单色蓝渐变继续加深', colors: ['#eff6fb', '#c6dbef', '#6baed6', '#2171b5', '#08306b'], ok: false, why: '渐变 = 顺序的误用和病例一模一样，只是颜色换了个方向。' },
        { label: '药方 3：红 → 橙 → 黄暖渐变', colors: REDWARM, ok: false, why: '换暖色仍是渐变，依然暗示「音乐 < 写作」这类并不存在的次序。' },
      ],
    },
  ];

  mount.innerHTML = `
    <div class="demo-controls">
      <span class="demo-control">CVD 复查滤镜：</span>
      <select data-cvd>
        <option value="normal">正常视觉</option>
        <option value="deuteranopia">绿色盲</option>
        <option value="protanopia">红色盲</option>
        <option value="tritanopia">蓝色盲</option>
      </select>
    </div>
    <div class="l3x-score" data-score></div>
    <div data-cards style="margin-top:6px"></div>
    <p class="demo-note"><strong>通关即复习：</strong>四个病例合起来正好是本章的四条底线 —— 顺序数据用顺序板、两极对比用 CVD 安全对、线图先拉明度差、无序类别用定性板。给真实项目配色前，先把这套「体检」在脑子里过一遍。</p>
  `;

  const cvdSel = mount.querySelector('[data-cvd]');
  const scoreEl = mount.querySelector('[data-score]');
  const cardsEl = mount.querySelector('[data-cards]');
  const cured = new Set();

  function filt(hex) {
    if (cvdSel.value === 'normal') return hex;
    return '#' + cvdSim(hex2rgb(hex), cvdSel.value).map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function svgFor(p, colors) {
    if (p.chart === 'bars') {
      const W = 284, H = 148, B = 24, T = 8;
      const max = Math.max(...p.data.map((d) => d[1]));
      const bw = (W - 16) / p.data.length;
      let g = '';
      p.data.forEach((d, i) => {
        const h = (d[1] / max) * (H - B - T - 12);
        const c = filt(colors[i % colors.length]);
        g += `<rect x="${(8 + i * bw + bw * 0.18).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3" style="fill: ${c};"/>
          <text x="${(8 + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 9.5px;">${esc(d[0])}</text>`;
      });
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(p.title)}">${g}</svg>`;
    }
    const W = 284, H = 148, L = 26, B = 22, T = 10;
    const series = [
      { pts: [72, 75, 71, 78, 80, 79], c: filt(colors[0]) },
      { pts: [64, 66, 70, 68, 73, 76], c: filt(colors[1]) },
    ];
    let g = '';
    for (let i = 0; i < 4; i++) {
      const y = T + i * ((H - B - T) / 3);
      g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - 8}" y2="${y.toFixed(1)}" style="stroke: var(--c-line); opacity: .6"/>`;
    }
    series.forEach((s) => {
      const path = s.pts.map((v, i) => {
        const x = L + i * ((W - L - 8) / 5);
        const y = T + (1 - (v - 60) / 25) * (H - B - T);
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      g += `<path d="${path}" style="fill: none; stroke: ${s.c}; stroke-width: 2.5; stroke-linecap: round;"/>`;
    });
    g += `<text x="${L}" y="${H - 6}" style="fill: var(--c-text-soft); font-size: 9.5px;">1–6 月</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(p.title)}">${g}</svg>`;
  }

  function render() {
    scoreEl.textContent = `治愈进度 ${cured.size} / ${PATIENTS.length} —— 每个病例三选一，选错会给病理分析，选对即治愈并复色。`;
    cardsEl.innerHTML = PATIENTS.map((p) => {
      const done = cured.has(p.id);
      const colors = done ? p.options.find((o) => o.ok).colors : p.sick;
      const opts = p.options.map((o, i) => {
        const cls = 'demo-btn' + (done && o.ok ? ' is-ok' : (o._bad ? ' is-bad' : ''));
        return `<button type="button" class="${cls}" data-p="${p.id}" data-i="${i}"${done ? ' disabled' : ''}>${esc(o.label)}</button>`;
      }).join('');
      return `<div class="l3x-patient">
        <div class="l3x-chart">${svgFor(p, colors)}</div>
        <div>
          <h4>${done ? '✅ ' : '🩺 '}${esc(p.title)}</h4>
          <p class="l3x-desc">${esc(p.desc)}</p>
          <div class="l3x-opts">${opts}</div>
          <p class="l3x-why" data-why="${p.id}">${done ? '<b>治愈：</b>' + esc(p.options.find((o) => o.ok).why) : (p.note ? '<s>误诊：</s>' + esc(p.note) : '')}</p>
        </div>
      </div>`;
    }).join('');

    cardsEl.querySelectorAll('[data-p]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = PATIENTS.find((x) => x.id === btn.dataset.p);
        const o = p.options[+btn.dataset.i];
        if (o.ok) { cured.add(p.id); p.note = ''; }
        else { p.note = o.why; o._bad = true; }
        render();
      });
    });
  }

  cvdSel.addEventListener('change', render);
  render();
};

/* =========================================================
 * 启动
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('第 3 章 · 色彩专题', { lesson: 'lesson-03' });
