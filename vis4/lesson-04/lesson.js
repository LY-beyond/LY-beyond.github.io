// =========================================================
// lesson-04/lesson.js —— 第 4 章「低维数据可视化」的可运行演示
// ---------------------------------------------------------
// 约定（与 lesson-core.js 对接）：
//   ① 用 window.DEMOS['d-4-x'] = fn 注册演示
//   ② 页面用 <div class="demo-mount" data-demo="d-4-x"> 挂载
//   ③ 最后调用 initLesson('第 4 章 · 低维数据可视化', { lesson: 'lesson-04' })
//
// 依赖策略：全部用「原生 DOM + 内联 SVG」实现，不引入 D3 运行时、不连 CDN。
//   原因：① 站点要求零构建、离线可用；② 不能让 300KB 的 d3 进仓库；
//   ③ 本章要演示的正是「数据转换 / 坐标变换 / 拟合 / 等值线」这些机制本身，
//   用几十行等价实现反而看得更清。真正的 D3 调用都写在页面的代码块里。
//
// 动画策略：**禁用 requestAnimationFrame**（本项目在后台标签页 / 无头浏览器
//   下 rAF 不触发，曾导致元素停在初始态）。改用「强制重排 + classList 切换 +
//   CSS transition」，播放类演示一律用 setInterval / setTimeout 驱动。
// =========================================================

import { initLesson } from '../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) 本章演示专用样式（注入一次，不污染共享样式表）
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson04-styles')) return;
  const st = document.createElement('style');
  st.id = 'lesson04-styles';
  st.textContent = `
/* 通用：演示里的 SVG 跟随主题 */
.l4-scroll { overflow-x: auto; }
.l4-svg { display: block; width: 100%; height: auto; }

/* 4.1 平行坐标曲线（刷选时高亮/淡出） */
.l4-pc { transition: stroke var(--dur-fast) var(--ease),
                     stroke-width var(--dur-fast) var(--ease),
                     opacity var(--dur-fast) var(--ease); }
.l4-mtx-pt { transition: fill var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease); }

/* 4.2 三层坐标：点用 CSS transform 位移，transition 让它自己飞过去 */
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

/* 4.3 模型按钮与 R² 排序条 */
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

/* 4.4 / 4.5 逐步揭示的元素 */
.l4-reveal { opacity: 0; transition: opacity var(--dur-base) var(--ease); }
.l4-reveal.is-on { opacity: 1; }

/* 4.5 网格节点 */
.l4-ms-cell { transition: fill var(--dur-base) var(--ease); }
.l4-ms-val { font-family: var(--font-mono); }
.l4-ms-seg { stroke-linecap: round; }

/* 演示里的只读表格（沿用 .mini-table，这里补一点内边距） */
.l4-mono { font-family: var(--font-mono); }

/* 4.1b 宽/长格式对照面板 */
.l4-io-cap { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; color: var(--c-text-soft); }
.l4-io-cap b { margin-left: 8px; color: var(--c-primary); font-family: var(--font-mono); font-weight: 700; }
.l4-io {
  margin: 0; padding: 10px 12px; border-radius: var(--radius-sm);
  background: var(--c-surface-2); border: 1px solid var(--c-line);
  font-family: var(--font-mono); font-size: 11.5px; line-height: 1.75;
  color: var(--c-text); overflow: auto; max-height: 236px; white-space: pre;
}

@media (prefers-reduced-motion: reduce) {
  .demo-mount, .demo-mount * { transition: none !important; animation: none !important; }
}
`;
  document.head.appendChild(st);
}

/* ---------------------------------------------------------
 * 1) 小工具：转义 / CSV 解析 / 最小二乘 / 数字格式
 * ------------------------------------------------------- */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 极小 CSV 解析器：支持引号字段与 BOM（够 crime.csv 用）
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

// 一元线性回归（最小二乘）：返回截距与斜率
function ols(xs, ys) {
  const n = xs.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return { slope: 0, intercept: sy / (n || 1) };
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n };
}

// 高斯消元（列主元）解 A·x = b
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

// 用一组基函数做最小二乘（基长度 1 → 过原点拟合）
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

// 决定系数 R²（在原空间评估，可以为负）
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

// 短数字：3.1k / 27.1M
function short(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  if (a === 0) return '0';
  return a < 1 ? v.toFixed(2) : String(Math.round(v));
}

// 公式里的系数：小数太多就科学计数
function coef(v) {
  if (!isFinite(v)) return '∞';
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 10000)) return v.toExponential(2).replace('e+', 'e');
  return String(+v.toFixed(3));
}

/* ---------------------------------------------------------
 * 2) crime.csv 加载：失败时回退到内置样本（file:// 会被 CORS 拦截）
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
    const res = await fetch('./data/crime.csv', { cache: 'no-store' });
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
    if (!rows.length) throw new Error('crime.csv 解析后为空');
    return { rows, ok: true };
  } catch (err) {
    return { rows: fallbackRows(), ok: false, err };
  }
}

function dataNote(ok) {
  if (ok) return '';
  return '<p class="demo-note">⚠️ 未能读取 <code>./data/crime.csv</code>'
    + '（用 file:// 直接打开页面时会被浏览器 CORS 拦截），演示已切换到内置的 12 州样本。'
    + '请用本地静态服务器打开（例如 <code>python -m http.server</code>）以载入全部 50 个州。</p>';
}

/* =========================================================
 * 演示 4.1 —— 平行坐标 + 散点矩阵（联动刷选）
 * ======================================================= */
DEMOS['d-4-1'] = async (mount) => {
  const { rows, ok } = await loadCrime();

  const METRICS = [
    { key: 'murder', label: '谋杀' },
    { key: 'robbery', label: '抢劫' },
    { key: 'burglary', label: '入室盗窃' },
    { key: 'larceny_theft', label: '普通盗窃' },
    { key: 'motor_vehicle_theft', label: '车辆盗窃' },
  ];
  const ext = METRICS.map((m) => {
    const vs = rows.map((d) => d[m.key]);
    return { lo: Math.min(...vs), hi: Math.max(...vs) };
  });
  const normOf = (i, v) => {
    const e = ext[i], span = (e.hi - e.lo) || 1;
    return (v - e.lo) / span;
  };

  // ---- 平行坐标布局 ----
  const PC_W = 640, PC_TOP = 44, PC_BOT = 196;
  const axisX = (i) => 56 + i * 132;
  const pcY = (n) => PC_TOP + (1 - n) * (PC_BOT - PC_TOP);

  // ---- 散点矩阵布局（取 3 个指标）----
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
    // 列标题
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
      // 第 i 行用 MI[i] 作 y 轴、第 j 列用 MI[j] 作 x 轴
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
      <label class="demo-control">刷选轴：
        <select data-role="axis">${METRICS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('')}</select>
      </label>
      <label class="demo-control">下界 <input type="range" data-role="lo" min="0" max="100" value="0"><b class="val" data-role="loVal">最低</b></label>
      <label class="demo-control">上界 <input type="range" data-role="hi" min="0" max="100" value="100"><b class="val" data-role="hiVal">最高</b></label>
      <span class="demo-control">选中 <b class="val" data-role="cnt">0</b> / ${rows.length} 州</span>
      <button type="button" class="demo-btn" data-role="reset">重置刷选</button>
    </div>

    <div class="l4-scroll">
      <svg class="l4-svg" viewBox="0 0 ${PC_W} 234" role="img" aria-label="平行坐标：50 个州在谋杀、抢劫、入室盗窃、普通盗窃、车辆盗窃五个指标上的轮廓">
        <text x="8" y="14" style="fill: var(--c-text-soft); font-size: 12px; font-weight: 700;">平行坐标 · 5 根轴各自归一化</text>
        ${pcAxes}
        ${pcLines}
      </svg>
    </div>

    <div class="demo-grid" style="margin-top:18px">
      <div class="l4-scroll">
        <svg class="l4-svg" viewBox="0 0 434 400" role="img" aria-label="散点矩阵：谋杀、抢劫、入室盗窃三个指标两两对比">
          ${matrix}
        </svg>
      </div>
      <div class="demo-detail" data-role="detail"></div>
    </div>

    <p class="demo-note"><strong>联动刷选（linked brushing）：</strong>在一根轴上框出一段范围，被选中的州在平行坐标（连成<span style="color: var(--c-primary)">加粗蓝线</span>）与散点矩阵（点变<span style="color: var(--c-primary)">蓝色</span>）里<strong>同步</strong>亮起来 —— 于是你能追问「这些州在其他指标上也有共同点吗」。</p>
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
      <h4>刷选：${METRICS[axis].label} ∈ [${short(loRaw)}, ${short(hiRaw)}]</h4>
      <p>命中 <strong>${n}</strong> 个州（共 ${rows.length} 个）。</p>
      <p><strong>在别的指标上怎样？</strong>看上图里这些加粗蓝线的走向 —— 它们是否整体偏高或偏低，就是「联动」要帮你发现的东西。</p>
      <p class="l4-mono" style="font-size: 12px;">${picked.slice(0, 12).join(' · ') || '（没有州落在区间内）'}${picked.length > 12 ? ' …' : ''}</p>`;
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
 * 演示 4.1b —— 宽格式 → 长格式（flatMap 实时展开）
 *   对应目标站同名演示：运行时真实加载 crime.csv，
 *   左右并排展示两种形状，行数变化来自现场计算而非写死。
 * ======================================================= */
DEMOS['d-4-1b'] = async (mount) => {
  const { rows, ok } = await loadCrime();

  // 真实列数：直接读 CSV 表头（file:// 被 CORS 拦截时退回对象键数）
  let csvCols = 0;
  try {
    const res = await fetch('./data/crime.csv', { cache: 'no-store' });
    if (res.ok) csvCols = (await res.text()).split(/\r?\n/)[0].split(',').length;
  } catch (e) { /* 忽略，走回退 */ }
  const wideCols = csvCols || Object.keys(rows[0]).length;

  const METRICS = [
    { key: 'murder', label: '谋杀' },
    { key: 'robbery', label: '抢劫' },
    { key: 'burglary', label: '入室盗窃' },
    { key: 'larceny_theft', label: '普通盗窃' },
    { key: 'motor_vehicle_theft', label: '车辆盗窃' },
  ];

  const q = (s) => '"' + s + '"';
  const fmtWide = (d) => '{ ' + Object.entries(d)
    .map(([k, v]) => k + ': ' + (typeof v === 'string' ? q(v) : v)).join(', ') + ' }';
  const fmtLong = (o) => '{ state: ' + q(o.state) + ', metric: ' + q(o.metric) + ', value: ' + o.value + ' }';

  mount.innerHTML = `
    <div class="demo-controls">
      <span class="demo-control">保留的指标：</span>
      ${METRICS.map((m, i) => `<label class="demo-control"><input type="checkbox" data-metric="${i}"${i < 3 ? ' checked' : ''}> ${m.label}</label>`).join('')}
    </div>

    <div class="l4-formula" data-role="shape"></div>

    <div class="demo-grid">
      <div>
        <p class="l4-io-cap">宽格式 · raw（前 3 行）<b data-role="wideBadge"></b></p>
        <pre class="l4-io">${rows.slice(0, 3).map(fmtWide).join('\n')}
…</pre>
      </div>
      <div>
        <p class="l4-io-cap">长格式 · flatMap 展开（前 9 行）<b data-role="longBadge"></b></p>
        <pre class="l4-io" data-role="longPre"></pre>
      </div>
    </div>

    <div class="demo-sub" style="margin-top:16px">
      <h4>宽格式原表（前 10 行）· 勾选的指标列会高亮 —— 它们正被展开成长格式的一行行观测</h4>
      <div class="table-scroll">
        <table class="mini-table">
          <thead><tr>
            <th>州</th><th>population</th>
            ${METRICS.map((m) => `<th class="l4-cell" data-col="${m.key}">${m.label}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.slice(0, 10).map((d) => `<tr>
              <td>${esc(d.state)}</td><td>${d.population}</td>
              ${METRICS.map((m) => `<td class="l4-cell" data-col="${m.key}">${d[m.key]}</td>`).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <p class="demo-note"><strong>行数不是写死的：</strong>长格式行数 = 州数 × 勾选的指标数，全部由运行时加载的 crime.csv 现场算出。勾掉一个指标，长格式立刻少 50 行 —— 这就是「指标降级成一列数据」的直接后果。演示只把 7 个字段载入内存（state、population 与 5 项指标），列数以 CSV 原表 12 列为准。</p>
    ${dataNote(ok)}
  `;

  const shapeEl = mount.querySelector('[data-role="shape"]');
  const longPre = mount.querySelector('[data-role="longPre"]');
  const wideBadge = mount.querySelector('[data-role="wideBadge"]');
  const longBadge = mount.querySelector('[data-role="longBadge"]');
  const boxes = [...mount.querySelectorAll('[data-metric]')];

  function convert() {
    const keys = METRICS.filter((_, i) => boxes[i].checked);
    const long = rows.flatMap((d) => keys.map((m) => ({ state: d.state, metric: m.key, value: d[m.key] })));
    longPre.textContent = (long.slice(0, 9).map(fmtLong).join('\n') || '（至少勾选一个指标）') + '\n…';
    shapeEl.textContent = `CSV 原表：${rows.length} 行 × ${wideCols} 列 → flatMap → 长格式：${long.length} 行 × 3 列 · {state, metric, value}`;
    wideBadge.textContent = `${rows.length} 行`;
    longBadge.textContent = `${long.length} 行`;
    mount.querySelectorAll('[data-col]').forEach((el) => {
      el.classList.toggle('is-on', keys.some((m) => m.key === el.dataset.col));
    });
  }

  boxes.forEach((b) => b.addEventListener('change', convert));
  convert();
};

/* =========================================================
 * 演示 4.2 —— 三层坐标变换（数据空间 → 归一化 → 屏幕像素）
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

  // 第一层：数据空间 → 归一化空间（把原始值压到 [0,1]）
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

  // 三层各自给出像素坐标
  const posOf = (d) => {
    if (step === 0) return { x: d.murder, y: d.robbery };                       // 原始数值直接当像素
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
      <span class="demo-control">第一步的 scale：
        <select data-role="scale">
          <option value="linear">scaleLinear</option>
          <option value="log">scaleLog</option>
          <option value="sqrt">scaleSqrt</option>
        </select>
      </span>
      <button type="button" class="demo-btn" data-role="prev">← 上一步</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">下一步 →</button>
      <button type="button" class="demo-btn" data-role="play">▶ 播放</button>
      <button type="button" class="demo-btn" data-role="replay">↻ 重放</button>
    </div>

    <div class="l4-steps" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
      <div class="l4-step" data-step="0"><b>① 数据空间</b>原始数值（murder / robbery）</div>
      <div class="l4-step" data-step="1"><b>② 归一化空间</b>压到 0..innerW</div>
      <div class="l4-step" data-step="2"><b>③ 屏幕像素空间</b>再加 margin 偏移</div>
    </div>

    <div class="l4-formula" data-role="formula"></div>

    <div class="l4-scroll">
      <svg class="l4-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="同一组州在数据空间、归一化空间、屏幕像素空间三层里的坐标位置">
        <rect x="${M.l}" y="${M.t}" width="${innerW}" height="${innerH}" rx="10" style="fill: var(--c-surface-2); stroke: var(--c-line);"/>
        <text x="${M.l}" y="${M.t - 14}" style="fill: var(--c-text-soft); font-size: 11.5px; font-weight: 700;">开采区：x = murder ，y = robbery</text>
        <text x="${W - M.r}" y="${H - 24}" text-anchor="end" style="fill: var(--c-muted); font-size: 11px;">灰底 = 屏幕像素空间的画布（margin 之内）</text>
        ${pts}
      </svg>
    </div>

    <div class="demo-sub" style="margin-top:16px">
      <h4>同一组点的三套坐标</h4>
      <div class="table-scroll">
        <table class="mini-table" data-role="table">
          <thead><tr><th>州</th><th>murder</th><th>robbery</th><th class="l4-cell" data-col="1">x′（归一化）</th><th class="l4-cell" data-col="2">X（像素）</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    <p class="demo-note">第 ① 层最直观地说明了「为什么不能拿原始值当像素」：把 murder / robbery 直接当像素坐标，大部分州会飞出画布。第 ② 层先归一化，第 ③ 层才加 margin —— 三层分开，换画布尺寸就只影响第 ③ 层。</p>
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

    if (step === 0) formulaEl.textContent = '第①层：x = murder（原始数值直接当像素）· y = robbery —— 数值远大于画布尺寸，点会飞出去';
    else if (step === 1) formulaEl.textContent = '第②层：' + FORMULA() + ' · y′ = ' + (scaleType === 'log' ? '(ln robbery − ln ' + short(minY) + ') / (ln ' + short(maxY) + ' − ln ' + short(minY) + ')' : 'robbery / ' + short(maxY)) + ' × innerH';
    else formulaEl.textContent = '第③层：X = margin.left(' + M.l + ') + x′ · Y = margin.top(' + M.t + ') + (1 − y′) × innerH';

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
    void mount.offsetWidth;                      // 强制重排，让归位动效被记录
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
 * 演示 4.3 —— 10 种曲线拟合对照（方程 + R² + 排序）
 * ======================================================= */
DEMOS['d-4-3'] = async (mount) => {
  const { rows, ok } = await loadCrime();
  const data = rows.filter((d) => d.population > 0).map((d) => ({
    x: d.population / 1e6,          // 百万为单位，数值更稳
    y: d.murder,
    state: d.state,
  }));
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);

  const MODELS = [
    { id: 'ols', label: '线性 a+bx', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => x]);
        return { predict: (x) => c[0] + c[1] * x, eq: `y = ${coef(c[1])}·x + ${coef(c[0])}` };
      } },
    { id: 'origin', label: '过原点 y=bx', fit: () => {
        const c = basisOLS(xs, ys, [(x) => x]);
        return { predict: (x) => c[0] * x, eq: `y = ${coef(c[0])}·x` };
      } },
    { id: 'log', label: '对数 a+b·ln x', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => Math.log(x)]);
        return { predict: (x) => c[0] + c[1] * Math.log(x), eq: `y = ${coef(c[0])} + ${coef(c[1])}·ln x` };
      } },
    { id: 'pow', label: '幂 a·x^b', fit: () => {
        const lx = xs.map(Math.log), ly = ys.map(Math.log);
        const c = basisOLS(lx, ly, [() => 1, (v) => v]);
        const a = Math.exp(c[0]), b = c[1];
        return { predict: (x) => a * Math.pow(x, b), eq: `y = ${coef(a)}·x^${coef(b)}` };
      } },
    { id: 'exp', label: '指数 a·e^bx', fit: () => {
        const ly = ys.map(Math.log);
        const c = basisOLS(xs, ly, [() => 1, (v) => v]);
        const a = Math.exp(c[0]), b = c[1];
        return { predict: (x) => a * Math.exp(b * x), eq: `y = ${coef(a)}·e^(${coef(b)}x)` };
      } },
    { id: 'p2', label: '二次多项式', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => x, (x) => x * x]);
        return { predict: (x) => c[0] + c[1] * x + c[2] * x * x, eq: `y = ${coef(c[2])}x² + ${coef(c[1])}x + ${coef(c[0])}` };
      } },
    { id: 'p3', label: '三次多项式', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => x, (x) => x * x, (x) => x * x * x]);
        return { predict: (x) => c[0] + c[1] * x + c[2] * x * x + c[3] * x * x * x, eq: `y = ${coef(c[3])}x³ + ${coef(c[2])}x² + ${coef(c[1])}x + ${coef(c[0])}` };
      } },
    { id: 'inv', label: '反比 a+b/x', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => 1 / x]);
        return { predict: (x) => c[0] + c[1] / x, eq: `y = ${coef(c[0])} + ${coef(c[1])}/x` };
      } },
    { id: 'sqrt', label: '平方根 a+b√x', fit: () => {
        const c = basisOLS(xs, ys, [() => 1, (x) => Math.sqrt(x)]);
        return { predict: (x) => c[0] + c[1] * Math.sqrt(x), eq: `y = ${coef(c[0])} + ${coef(c[1])}·√x` };
      } },
    { id: 'sig', label: 'S 形（logistic）', fit: () => {
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

  // ---- 图幅布局：x 用 log 轴（人口跨 50 倍），y 线性 ----
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
    <text x="${M.l + innerW / 2}" y="${H - 8}" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11.5px;">人口（百万，log 轴）→</text>
    <text x="${M.l - 40}" y="${M.t + 12}" style="fill: var(--c-text-soft); font-size: 11.5px;">谋杀数 ↑</text>
    ${data.map((d) => `<circle cx="${xOf(d.x).toFixed(1)}" cy="${yOf(d.y).toFixed(1)}" r="2.6" style="fill: color-mix(in srgb, var(--c-text) 26%, transparent);"/>`).join('')}
    <path class="l4-curve" data-role="curve" fill="none" style="stroke: var(--c-primary); stroke-width: 2.4;"/>
  `;

  mount.innerHTML = `
    <div class="demo-grid">
      <div>
        <div class="l4-scroll">
          <svg class="l4-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="同一组人口与谋杀数的散点，上面叠加当前选中模型的拟合曲线">${axisSvg}</svg>
        </div>
        <div class="l4-models" style="margin-top:14px">
          ${MODELS.map((m, i) => `<button type="button" class="demo-btn${i === 0 ? ' is-on' : ''}" data-model="${i}">${m.label}</button>`).join('')}
        </div>
        <div class="l4-formula" style="margin-top:14px" data-role="eq"></div>
      </div>
      <div>
        <h4 style="margin:0 0 8px; font-size:13px; color: var(--c-text-soft);">按 R² 排序（点一行可切换模型）</h4>
        <div class="l4-rank" data-role="rank"></div>
        <div class="demo-detail" style="margin-top:14px" data-role="detail"></div>
      </div>
    </div>
    <p class="demo-note"><strong>怎么看：</strong>R² 是「相对均值基线的改进」。三次多项式几乎总比直线高一点，但多出来的那点往往只是把噪声拟合了一遍 —— 所以<strong>比 R² 时要一起看参数量</strong>。注意指数 / 幂 / 对数这三个模型是在<em>取对数后的空间</em>里最小化误差的，回到原空间算 R² 时可能并不占优。</p>
    ${dataNote(ok)}
  `;

  const curveEl = mount.querySelector('[data-role="curve"]');
  const eqEl = mount.querySelector('[data-role="eq"]');
  const rankEl = mount.querySelector('[data-role="rank"]');
  const detailEl = mount.querySelector('[data-role="detail"]');
  const btns = [...mount.querySelectorAll('[data-model]')];

  // 预计算 10 个模型的参数、预测与 R²
  const fits = MODELS.map((m) => {
    const f = m.fit();
    const yhat = xs.map((x) => f.predict(x));
    return { ...f, r2: r2of(ys, yhat) };
  });

  // 排序条（R² 从高到低）
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
    // 曲线：在 log-x 上均匀采样 240 个点
    const seg = [];
    for (let k = 0; k <= 240; k++) {
      const lx = lmin + (k / 240) * (lmax - lmin);
      const x = Math.pow(10, lx);
      const y = f.predict(x);
      const py = Math.max(M.t, Math.min(M.t + innerH, yOf(y)));   // 超出画布就贴着边界走
      seg.push(`${k ? 'L' : 'M'}${xOf(x).toFixed(1)},${py.toFixed(1)}`);
    }
    curveEl.setAttribute('d', seg.join(' '));
    eqEl.textContent = MODELS[i].label + '：' + f.eq;
    btns.forEach((b, k) => b.classList.toggle('is-on', k === i));
    rankEl.querySelectorAll('[data-rank]').forEach((row) => row.classList.toggle('is-on', +row.dataset.rank === i));
    detailEl.innerHTML = `<h4>${MODELS[i].label}</h4>
      <p class="l4-mono" style="font-size:12px;">${f.eq}</p>
      <p><strong>R² = ${f.r2.toFixed(4)}</strong>${f.r2 < 0 ? '（为负：还不如直接用平均值）' : ''}</p>
      <p>当前 R² 排名第 <strong>${order.indexOf(i) + 1}</strong> / ${MODELS.length}。</p>`;
  }

  btns.forEach((b) => b.addEventListener('click', () => select(+b.dataset.model)));
  rankEl.querySelectorAll('[data-rank]').forEach((row) => row.addEventListener('click', () => select(+row.dataset.rank)));
  select(0);
};

/* =========================================================
 * 演示 4.4 —— Cleveland 45° 倾角感知
 * ======================================================= */
DEMOS['d-4-4'] = async (mount) => {
  const { rows, ok } = await loadCrime();

  // Cleveland 的 U 型误差：|ln(tan θ)| 在 45° 取 0，向两端发散
  const err = (deg) => {
    if (deg <= 0.5 || deg >= 89.5) return 1;
    return 1 - Math.exp(-Math.abs(Math.log(Math.tan(deg * Math.PI / 180))));
  };
  // Stevens 幂律：感知斜率 ≈ 真实斜率^1.2（在 45° 处 tan=1，故不产生偏移）
  const percDeg = (deg) => {
    const t = Math.tan(Math.max(0.6, Math.min(89.4, deg)) * Math.PI / 180);
    return Math.atan(Math.pow(t, 1.2)) * 180 / Math.PI;
  };

  // 数据侧：crime.csv 的趋势倾角随 x 轴 scale 变化
  const pop = rows.map((d) => d.population);
  const mur = rows.map((d) => d.murder);
  const pmin = Math.min(...pop), pmax = Math.max(...pop);
  const mmin = Math.min(...mur), mmax = Math.max(...mur);
  const scaleMap = {
    linear: (v) => (v - pmin) / ((pmax - pmin) || 1),
    log: (v) => (Math.log(Math.max(1, v)) - Math.log(Math.max(1, pmin))) / ((Math.log(Math.max(1, pmax)) - Math.log(Math.max(1, pmin))) || 1),
    sqrt: (v) => (Math.sqrt(v) - Math.sqrt(pmin)) / ((Math.sqrt(pmax) - Math.sqrt(pmin)) || 1),
  };
  const SCALE_LABEL = { linear: 'scaleLinear', log: 'scaleLog（等比变等距）', sqrt: 'scaleSqrt' };

  let angle = 45;
  let xScale = 'linear';

  // ---- 图 A：直线本身 + 45° 参考 + 感知线 ----
  const AX = 70, AY = 210, LEN = 175;
  const ray = (deg, len, color, dash, w) => {
    const r = deg * Math.PI / 180;
    return `<line x1="${AX}" y1="${AY}" x2="${(AX + len * Math.cos(r)).toFixed(1)}" y2="${(AY - len * Math.sin(r)).toFixed(1)}"
      style="stroke: ${color}; stroke-width: ${w};"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  };

  // ---- 图 B：U 型误差曲线（采样成 polyline）----
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
      <label class="demo-control">视倾角：<input type="range" data-role="angle" min="0" max="90" value="45"><b class="val" data-role="angleVal">45°</b></label>
      <span class="demo-control" data-role="verdict"></span>
    </div>

    <div class="demo-grid">
      <div>
        <svg class="l4-svg" viewBox="0 0 320 250" role="img" aria-label="一条可变倾角的直线，与 45 度参考线、人眼感知线对照">
          <line x1="${AX}" y1="${AY - 4}" x2="${AX}" y2="24" style="stroke: var(--c-line-2);"/>
          <line x1="${AX - 4}" y1="${AY}" x2="290" y2="${AY}" style="stroke: var(--c-line-2);"/>
          <text x="${AX}" y="${AY + 18}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">0°</text>
          <text x="286" y="${AY + 18}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">90°</text>
          ${ray(45, LEN * 1.12, 'color-mix(in srgb, var(--c-muted) 60%, transparent)', '5 5', 1.4)}
          <text x="${(AX + LEN * 1.12 * Math.SQRT1_2).toFixed(0)}" y="${(AY - LEN * 1.12 * Math.SQRT1_2 - 6).toFixed(0)}" style="fill: var(--c-muted); font-size: 10.5px;">45° 参考</text>
          <path data-role="arc" fill="none" style="stroke: var(--c-warn); stroke-width: 2;"/>
          ${ray(45, LEN, 'var(--c-primary)', '', 3)}
          <g data-role="line"><line x1="${AX}" y1="${AY}" x2="${AX}" y2="${AY}" style="stroke: var(--c-primary); stroke-width: 3;"/></g>
          <g data-role="perceived"><line x1="${AX}" y1="${AY}" x2="${AX}" y2="${AY}" style="stroke: var(--c-warn); stroke-width: 2;" stroke-dasharray="6 4"/></g>
          <circle cx="${AX}" cy="${AY}" r="4" style="fill: var(--c-text-soft);"/>
          <text x="${AX - 8}" y="${AY + 4}" text-anchor="end" style="fill: var(--c-text-soft); font-size: 10.5px;">起点</text>
          <text x="10" y="16" style="fill: var(--c-muted); font-size: 10.5px;">蓝实线 = 真实倾角 · 橙虚线 = 人眼感知的倾角</text>
        </svg>
        <div class="demo-detail" style="margin-top:12px" data-role="readout"></div>
      </div>

      <div>
        <svg class="l4-svg" viewBox="0 0 640 220" role="img" aria-label="Cleveland 的 U 型误差曲线，游标随滑块移动，45 度处误差最小">
          <rect x="${bxOf(30)}" y="30" width="${(bxOf(60) - bxOf(30)).toFixed(1)}" height="150" rx="8" style="fill: color-mix(in srgb, var(--c-success) 12%, transparent);"/>
          <text x="${(bxOf(45)).toFixed(1)}" y="24" text-anchor="middle" style="fill: var(--c-success); font-size: 11.5px; font-weight: 700;">稳定区 30°–60°</text>
          <line x1="${B.x0}" y1="${B.yBot + 10}" x2="${B.x1}" y2="${B.yBot + 10}" style="stroke: var(--c-line-2); stroke-width: 1.4;"/>
          <text x="${B.x0 - 10}" y="${B.yTop + 4}" text-anchor="end" style="fill: var(--c-muted); font-size: 10.5px;">误差大</text>
          <text x="${B.x0 - 10}" y="${B.yBot}" text-anchor="end" style="fill: var(--c-muted); font-size: 10.5px;">误差小</text>
          ${[0, 30, 45, 60, 90].map((d) => `<text x="${bxOf(d).toFixed(1)}" y="${B.yBot + 26}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">${d}°</text>`).join('')}
          <path d="${uPath}" fill="none" style="stroke: var(--c-primary); stroke-width: 2.6;"/>
          <line data-role="cursor" x1="0" y1="30" x2="0" y2="${B.yBot}" stroke-dasharray="4 4" style="stroke: var(--c-danger); stroke-width: 1.4;"/>
          <circle data-role="marker" cx="0" cy="0" r="5" style="fill: var(--c-danger);"/>
          <text x="${bxOf(45).toFixed(1)}" y="${(byOf(0) - 8).toFixed(1)}" text-anchor="middle" style="fill: var(--c-danger); font-size: 11px; font-weight: 700;">45° 误差最小</text>
          <text x="320" y="216" text-anchor="middle" style="fill: var(--c-muted); font-size: 11px;">视倾角 →（|ln tan θ| 型误差：两端最大、45° 为零）</text>
        </svg>
      </div>
    </div>

    <div class="demo-sub" style="margin-top:18px">
      <h4>同一份 crime.csv：换 x 轴 scale，趋势倾角就变了</h4>
      <div class="demo-controls" style="border-bottom:none; padding-bottom:0; margin-bottom:10px;">
        <label class="demo-control">x 轴：
          <select data-role="xs">
            <option value="linear">scaleLinear</option>
            <option value="log">scaleLog</option>
            <option value="sqrt">scaleSqrt</option>
          </select>
        </label>
        <span class="demo-control">回归趋势倾角 <b class="val" data-role="slope">—</b></span>
        <span class="demo-control" data-role="band"></span>
      </div>
      <svg class="l4-svg" style="max-width:320px" viewBox="0 0 250 250" role="img" aria-label="crime 数据归一化后的散点与回归趋势线，用于量出趋势的倾角">
        <rect x="20" y="14" width="212" height="212" rx="8" style="fill: var(--c-surface-2); stroke: var(--c-line);"/>
        <g data-role="crimePts"></g>
        <line data-role="trend" x1="20" y1="226" x2="232" y2="14" style="stroke: var(--c-success); stroke-width: 2.2;"/>
        <text x="126" y="244" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">两轴各自归一化到 0..1（正方形画布）→ 倾角 = atan(斜率)</text>
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
    if (deg >= 30 && deg <= 60) return { cls: 'pill--ok', text: '落在 30°–60° 稳定区 ✓' };
    if (deg < 5 || deg > 85) return { cls: 'pill--no', text: '在 5° 以下或 85° 以上 → 感知误差太大 ✗' };
    return { cls: 'pill--warn', text: '偏离黄金角，趋势对比要谨慎' };
  }

  function drawAngle() {
    angleVal.textContent = angle + '°';
    const r = angle * Math.PI / 180;
    lineEl.setAttribute('x2', (AX + LEN * Math.cos(r)).toFixed(1));
    lineEl.setAttribute('y2', (AY - LEN * Math.sin(r)).toFixed(1));
    const pr = percDeg(angle) * Math.PI / 180;
    perceivedEl.setAttribute('x2', (AX + LEN * Math.cos(pr)).toFixed(1));
    perceivedEl.setAttribute('y2', (AY - LEN * Math.sin(pr)).toFixed(1));
    // 角度弧：从 x 轴正向扫到当前角度（SVG 的 y 向下，弧的 sweep 取 0）
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
    readout.innerHTML = `<h4>感知偏移档案</h4>
      <p>真实倾角 <strong>${angle}°</strong> → 人眼感知约 <strong>${pd.toFixed(1)}°</strong>
         （${pd > angle + 0.4 ? '被夸张' : pd < angle - 0.4 ? '被压缩' : '几乎无偏差'}）。</p>
      <p>相对误差（U 型曲线读数）<strong>${(e * 100).toFixed(1)}%</strong>。</p>
      <p><strong>Stevens 幂律：</strong>感知斜率 ≈ 真实斜率<sup>1.2</sup>，人眼整体把「陡度」夸张约 30%；只有在 45°（tan = 1）附近，夸张与压缩恰好互相抵消。</p>`;
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
 * 演示 4.5 —— Marching Squares 逐步追踪
 * ======================================================= */
DEMOS['d-4-5'] = async (mount) => {
  const { rows, ok } = await loadCrime();

  // ---- 标量场：把 crime 数据当 (谋杀, 抢劫) 平面上的点，用核密度估计铺成连续场 ----
  const N = 9;                       // 9×9 个格点 → 8×8 个 cell
  const CELL = 42, PAD = 32;
  const logN = (v, lo, hi) => (Math.log(Math.max(1, v)) - Math.log(lo)) / ((Math.log(hi) - Math.log(lo)) || 1);
  const mlo = Math.min(...rows.map((d) => d.murder)), mhi = Math.max(...rows.map((d) => d.murder));
  const rlo = Math.min(...rows.map((d) => d.robbery)), rhi = Math.max(...rows.map((d) => d.robbery));
  const samples = rows.map((d) => ({ x: logN(d.murder, mlo, mhi), y: logN(d.robbery, rlo, rhi) }));
  const H = 0.11;    // 核带宽
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

  // 边编号：0 = 左中(上→下), 1 = 下中(左→右), 2 = 右中(上→下), 3 = 上中(左→右)
  const EDGE_TABLE = [
    [], [[3, 0]], [[0, 1]], [[3, 1]],
    [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
    [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]],
    [[1, 3]], [[1, 0]], [[0, 3]], [],
  ];

  const nodes = [];    // 所有格点：{r,c,x,y,v}
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    nodes.push({ r, c, x: PAD + c * CELL, y: PAD + r * CELL, v: grid[r][c] });
  }

  const EDGES = [];    // 每个 cell 的 4 条边（格坐标下的两端点）
  function edgePoints(r, c, th) {
    const tl = grid[r][c], tr = grid[r][c + 1], bl = grid[r + 1][c], br = grid[r + 1][c + 1];
    const lerp = (a, b, va, vb) => {
      const d = vb - va;
      const t = Math.abs(d) < 1e-9 ? 0.5 : Math.max(0, Math.min(1, (th - va) / d));
      return a + (b - a) * t;
    };
    return [
      { x: c, y: lerp(r, r + 1, tl, bl) },                    // 0 左
      { x: lerp(c, c + 1, bl, br), y: r + 1 },                // 1 下
      { x: c + 1, y: lerp(r, r + 1, tr, br) },                // 2 右
      { x: lerp(c, c + 1, tl, tr), y: r },                    // 3 上
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
      // 鞍点：靠格心值判方向
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
    { name: '① 格点取值', note: '把连续标量场离散成 9×9 个格点，并按值给格子着色。颜色越深 = 该处「密度」越高。' },
    { name: '② 标记大于阈值的格点', note: '逐格点与阈值比较，大于阈值的标成实心绿点 —— 它就是下面拼 case 编号的 4 个 bit。' },
    { name: '③ 在边上求交点', note: '每个 cell 的四条边上做线性插值 t = (阈值 − a)/(b − a)，红点就是「值 = 阈值」的落点。' },
    { name: '④ 连接成折线', note: '按 case 查表把交点两两相连，得到等值线 —— 它把「超过阈值」与「未超过阈值」两片区域分开。' },
  ];

  let th = 0.35;
  let step = 0;
  let timer = null;

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">阈值：<input type="range" data-role="th" min="5" max="95" step="1" value="35"><b class="val" data-role="thVal">0.35</b></label>
      <button type="button" class="demo-btn" data-role="prev">← 上一步</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">下一步 →</button>
      <button type="button" class="demo-btn" data-role="play">▶ 播放</button>
      <button type="button" class="demo-btn" data-role="reset">↻ 重置</button>
    </div>

    <div class="l4-steps" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
      ${STEPS.map((s, i) => `<div class="l4-step" data-step="${i}"><b>${s.name}</b></div>`).join('')}
    </div>

    <div class="demo-grid">
      <div>
        <svg class="l4-svg" style="max-width:420px" viewBox="0 0 400 400" role="img" aria-label="Marching Squares 逐步演示：网格标量场、阈值标记、边交点与等值线">
          <g data-role="cells"></g>
          <g data-role="gridlines"></g>
          <g data-role="nodeMarks" class="l4-reveal"></g>
          <g data-role="nodeVals" class="l4-reveal"></g>
          <g data-role="inter" class="l4-reveal"></g>
          <g data-role="segs" class="l4-reveal"></g>
          <text x="${PAD}" y="20" style="fill: var(--c-text-soft); font-size: 11px;">← 抢劫率（log 归一化）</text>
          <text transform="translate(16 200) rotate(-90)" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11px;">谋杀率 →</text>
        </svg>
      </div>
      <div>
        <div class="demo-detail" data-role="detail" style="min-height:100px"></div>
        <div class="l4-formula" style="margin:12px 0 0" data-role="stats"></div>
        <p class="demo-note" style="margin-top:10px">case 编号 = <span class="l4-mono">bit0 BL | bit1 BR | bit2 TR | bit3 TL</span>；查 <code>EDGE_TABLE</code> 得到 0 / 1 / 2 条线段。鞍点（case 5 / 10）用格心值判方向。</p>
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

  // 静态网格线（一次画好）
  gridG.innerHTML = nodes.map((n) => `<line x1="${n.x}" y1="${n.y}" x2="${n.x}" y2="${n.y}" style="stroke: var(--c-line);"/>`).join('')
    + Array.from({ length: N }, (_, i) => `<line x1="${PAD + i * CELL}" y1="${PAD}" x2="${PAD + i * CELL}" y2="${PAD + (N - 1) * CELL}" style="stroke: var(--c-line);"/>
        <line x1="${PAD}" y1="${PAD + i * CELL}" x2="${PAD + (N - 1) * CELL}" y2="${PAD + i * CELL}" style="stroke: var(--c-line);"/>`).join('');

  function render(thValue) {
    // 格子按值着色
    let html = '';
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
      const v = (grid[r][c] + grid[r + 1][c] + grid[r][c + 1] + grid[r + 1][c + 1]) / 4;
      const mix = Math.round(6 + v * 72);
      html += `<rect class="l4-ms-cell" x="${PAD + c * CELL}" y="${PAD + r * CELL}" width="${CELL}" height="${CELL}"
        style="fill: color-mix(in srgb, var(--c-primary) ${mix}%, var(--c-surface));"/>`;
    }
    cellsG.innerHTML = html;

    // 格点数值 + 阈值标记
    valsG.innerHTML = nodes.map((n) => `<text class="l4-ms-val" x="${n.x}" y="${n.y + 11}" text-anchor="middle" style="fill: var(--c-text); font-size: 8.5px;">${n.v.toFixed(2)}</text>`).join('');
    marksG.innerHTML = nodes.map((n) => n.v > thValue
      ? `<circle cx="${n.x}" cy="${n.y}" r="4" style="fill: var(--c-success);"/>`
      : `<circle cx="${n.x}" cy="${n.y}" r="3.4" style="fill: var(--c-surface); stroke: var(--c-line-2);"/>`).join('');

    // 交点 + 线段
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
    statsEl.textContent = `格点 ${N * N} 个 · 大于阈值 ${info.above} 个 · 交点 ${info.interCount} 个 · 线段 ${info.segCount} 条（cell 共 ${(N - 1) * (N - 1)} 个）`;
    mount.querySelector('[data-role="prev"]').disabled = step === 0;
    mount.querySelector('[data-role="next"]').disabled = step === 3;
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function goto(s) { step = Math.max(0, Math.min(3, s)); apply(); }

  mount.querySelector('[data-role="th"]').addEventListener('input', (e) => {
    th = +e.target.value / 100;
    mount.querySelector('[data-role="thVal"]').textContent = th.toFixed(2);
    render(th);
    void mount.offsetWidth;                 // 强制重排，让揭示动效被记录
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
 * 启动
 * ======================================================= */
/* =========================================================
 * 原创演示 4.x —— 图表谎言放大镜
 *   同一份真实数据（crime.csv 谋杀率前两名州），拖两个滑块：
 *   ① y 轴起点从 0 抬高 ② 纵横比拉伸。左侧「画面版」随滑块变形，
 *   右侧「诚实版」始终从零画起，中间实时读出「差异被夸大 N 倍」。
 *   教学点：条形图的长度是定量通道，必须从零起 —— 否则就是谎言。
 * ======================================================= */
DEMOS['d-4-x'] = async (mount) => {
  const { rows, ok } = await loadCrime();
  const ranked = rows
    .map((d) => ({ state: d.state, rate: d.population ? (d.murder / d.population) * 100000 : 0 }))
    .sort((a, b) => b.rate - a.rate);
  const A = ranked[0], Bv = ranked[1];

  // 私有样式（一次性注入）
  if (!document.getElementById('l4x-styles')) {
    const st = document.createElement('style');
    st.id = 'l4x-styles';
    st.textContent = `
.l4x-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
@media (max-width: 720px) { .l4x-grid { grid-template-columns: 1fr; } }
.l4x-cap { margin: 0 0 6px; font-size: 12px; font-weight: 700; }
.l4x-cap.is-lie { color: var(--c-danger); }
.l4x-cap.is-honest { color: var(--c-success); }
.l4x-read { padding: 10px 12px; border-radius: var(--radius-sm); background: var(--c-surface-2); border: 1px solid var(--c-line); font-family: var(--font-mono); font-size: 12px; line-height: 1.8; color: var(--c-text); }
.l4x-read b { color: var(--c-danger); }
.l4x-read u { color: var(--c-success); text-decoration: none; }
`;
    document.head.appendChild(st);
  }

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">y 轴起点
        <input type="range" min="0" max="92" value="0" step="1" data-role="base">
        <span class="l4-mono" data-baseVal>0%</span>
      </label>
      <label class="demo-control">纵横比拉伸
        <input type="range" min="1" max="3" value="1" step="0.1" data-role="stretch">
        <span class="l4-mono" data-stretchVal>1.0×</span>
      </label>
    </div>
    <div class="l4x-grid">
      <div>
        <p class="l4x-cap is-lie">😱 画面版（随滑块变形）</p>
        <div data-role="lie"></div>
      </div>
      <div>
        <p class="l4x-cap is-honest">😇 诚实版（从零起、1×）</p>
        <div data-role="honest"></div>
      </div>
    </div>
    <div class="l4x-read" data-role="read" style="margin-top:12px"></div>
    <p class="demo-note"><strong>规则只有一条：</strong>条形图编码的是<strong>长度</strong>，而长度是定量通道 —— 必须从零画起。折线图编码的是<strong>位置/斜率</strong>，截断轴可以接受（但要标注）。媒体上 90% 的「图表谎言」就是把条形图的轴抬高，再配一个夸张的纵横比。数据：${esc(A.state)} vs ${esc(Bv.state)} 每 10 万人谋杀率（crime.csv）。</p>
    ${dataNote(ok)}
  `;

  const baseEl = mount.querySelector('[data-role="base"]');
  const stretchEl = mount.querySelector('[data-role="stretch"]');
  const baseVal = mount.querySelector('[data-baseVal]');
  const stretchVal = mount.querySelector('[data-stretchVal]');
  const lieEl = mount.querySelector('[data-role="lie"]');
  const honestEl = mount.querySelector('[data-role="honest"]');
  const readEl = mount.querySelector('[data-role="read"]');

  function barSvg(va, vb, y0, H) {
    const W = 240;
    const pad = 30, bot = 26;
    const ih = H - bot - 14;
    const vmax = va.rate;
    const yOf = (v) => 14 + ih - ((v - y0) / (vmax - y0)) * ih;
    let g = '';
    // 基线与刻度
    g += `<line x1="10" y1="${(14 + ih).toFixed(1)}" x2="${W - 10}" y2="${(14 + ih).toFixed(1)}" style="stroke: var(--c-text-soft); stroke-width: 1"/>`;
    [0, 0.5, 1].forEach((f) => {
      const v = y0 + (vmax - y0) * f;
      const y = yOf(v);
      g += `<line x1="10" y1="${y.toFixed(1)}" x2="${W - 10}" y2="${y.toFixed(1)}" style="stroke: var(--c-line); opacity: .5"/>`
        + `<text x="8" y="${(y + 3).toFixed(1)}" text-anchor="end" style="fill: var(--c-muted); font-size: 9px; font-family: var(--font-mono);">${v.toFixed(v < 10 ? 1 : 0)}</text>`;
    });
    [[A, 'var(--c-danger)'], [Bv, 'var(--c-text-soft)']].forEach(([s, c], i) => {
      const x = pad + 30 + i * 90;
      const y = yOf(s.rate);
      const h = (14 + ih) - y;
      g += `<rect x="${x}" y="${y.toFixed(1)}" width="52" height="${Math.max(h, 0.5).toFixed(1)}" rx="3" style="fill: ${c}; opacity: .85;"/>`
        + `<text x="${x + 26}" y="${(14 + ih + 14).toFixed(1)}" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 9.5px;">${esc(s.state)}</text>`
        + `<text x="${x + 26}" y="${(y - 5).toFixed(1)}" text-anchor="middle" style="fill: var(--c-text); font-size: 9.5px; font-family: var(--font-mono);">${s.rate.toFixed(1)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="谋杀率对比条形图" style="width:100%;height:auto">${g}</svg>`;
  }

  function render() {
    const f = +baseEl.value / 100;
    const stretch = +stretchEl.value;
    const y0 = Bv.rate * f;
    baseVal.textContent = `${Math.round(f * 100)}%`;
    stretchVal.textContent = `${stretch.toFixed(1)}×`;

    lieEl.innerHTML = barSvg(A, Bv, y0, Math.round(190 * stretch));
    honestEl.innerHTML = barSvg(A, Bv, 0, 190);

    const trueRatio = A.rate / Bv.rate;
    const seenRatio = (A.rate - y0) / (Bv.rate - y0);
    const factor = seenRatio / trueRatio;
    readEl.innerHTML =
      `真实差异：${esc(A.state)} 只比 ${esc(Bv.state)} 高 <u>${((trueRatio - 1) * 100).toFixed(0)}%</u><br>`
      + `画面差异：看起来高了 <b>${((seenRatio - 1) * 100).toFixed(0)}%</b>（视觉比例被放大 <b>${factor.toFixed(1)}×</b>）`
      + (stretch > 1.05 ? `，叠加纵横比拉伸 ${stretch.toFixed(1)}× 后面积感再被扭曲` : '')
      + (factor < 1.15 && stretch <= 1.05 ? ' —— 目前还算诚实 🙂' : '');
  }

  baseEl.addEventListener('input', render);
  stretchEl.addEventListener('input', render);
  render();
};

/* =========================================================
 * 启动
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('第 4 章 · 低维数据可视化', { lesson: 'lesson-04' });
