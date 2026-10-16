// =========================================================
// lesson-05 · 第 5 章 时序数据可视化 —— 演示实现（vis4 版）
// ---------------------------------------------------------
// 为什么这样写：
//   1) 本站是「零构建静态站」：纯 HTML + CSS + 原生 ES Module，
//      不引任何 CDN。旧站（target_website/lesson-05/lesson.js）里的
//      d3 v7 调用全部改写成原生 DOM + 内联 SVG 路径指令。
//   2) 禁用动画帧回调：无头浏览器 / 后台标签页里它不会被调度，动画会
//      「卡死」。需要过渡时用 `void el.offsetWidth;` 强制一次重排，
//      再切 class 交给 CSS transition 完成。
//   3) 禁止硬编码色值：所有颜色都来自 tokens.css 的设计令牌。热图 / 螺旋
//      的色阶是「运行时派生」的 —— 用 color-mix(in srgb, 令牌 xx%, 令牌)
//      现场算出，不是写死的字面量。
//
// 5 个演示：
//   5.1 d-5-1 时间属性分解轮盘（极坐标布局）
//   5.2 d-5-2 折线图 + 多尺度聚合对照（原始 / 周 / 月）
//   5.3 d-5-3 van Wijk 日历热图（周 × 星期）
//   5.4 d-5-4 阿基米德螺旋日历（r = a + bθ）
//   5.5 d-5-5 Storyline 生命线（《侏罗纪公园》）
// =========================================================

import { initLesson } from '../../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) 本章私有样式（以 <style id="lesson05-styles"> 注入）
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson05-styles')) return;
  const style = document.createElement('style');
  style.id = 'lesson05-styles';
  style.textContent = `
.l5-wrap{position:relative}
.l5-svg{display:block;width:100%;height:auto;overflow:visible}
.l5-status{font-size:12px;color:var(--c-muted);line-height:1.7}
.l5-tip{
  position:absolute;left:0;top:0;transform:translate(-50%,-135%);
  background:var(--c-text);color:var(--c-bg);
  padding:3px 8px;border-radius:var(--radius-sm);
  font-size:11px;white-space:nowrap;pointer-events:none;z-index:5;
}
.l5-tip[hidden]{display:none}
.l5-legend{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;color:var(--c-text-soft)}
.l5-legend__item{
  display:inline-flex;align-items:center;gap:5px;cursor:pointer;
  padding:2px 9px;border:1px solid var(--c-line-2);border-radius:var(--radius-pill);
  transition:background var(--dur-fast) var(--ease),opacity var(--dur-base) var(--ease);
}
.l5-legend__item:hover{background:var(--c-surface-2)}
.l5-legend__item.is-on{background:color-mix(in srgb, var(--c-primary) 10%, transparent)}
.l5-legend__item.is-dim{opacity:.32}
.l5-swatch{width:12px;height:12px;border-radius:3px;display:inline-block}
.l5-strip{display:flex;height:12px;width:220px;border-radius:3px;overflow:hidden;border:1px solid var(--c-line-2)}
.l5-strip i{flex:1 1 0}
.l5-strip-row{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--c-muted)}
.l5-wheel-node{cursor:pointer;outline:none}
.l5-wheel-node .l5-halo{opacity:0;transition:opacity var(--dur-base) var(--ease)}
.l5-wheel-node.is-on .l5-halo,
.l5-wheel-node:focus-visible .l5-halo{opacity:1}
.l5-cell,.l5-seg{transition:filter var(--dur-fast) var(--ease);cursor:crosshair}
.l5-cell:hover,.l5-seg:hover{filter:brightness(1.22)}
.l5-panel{transition:opacity var(--dur-base) var(--ease)}
.l5-panel.is-dim{opacity:.22}
.l5-line{pointer-events:none;transition:opacity var(--dur-base) var(--ease),stroke-width var(--dur-base) var(--ease)}
.l5-line.is-dim{opacity:.16}
.l5-btn.is-active{
  background:color-mix(in srgb, var(--c-primary) 18%, transparent);
  border-color:var(--c-primary);color:var(--c-text);font-weight:600;
}
.l5-check{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--c-text-soft);cursor:pointer}
.l5-ctrl{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:6px 0}
.l5-ctrl input[type=range]{width:150px;accent-color:var(--c-primary)}
.l5-sub{margin:16px 0 4px;font-size:13px;font-weight:600;color:var(--c-text-soft)}
.l5-looplist{font-size:12px;color:var(--c-muted);line-height:1.9;margin-top:4px}
.l5-detail-list{margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.8;color:var(--c-text-soft)}
@media (prefers-reduced-motion: reduce){
  .demo-mount,.demo-mount *{transition:none !important;animation:none !important}
}
`;
  document.head.appendChild(style);
}

/* ---------------------------------------------------------
 * 1) 通用小工具
 * ------------------------------------------------------- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuote = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ''));
}

// 线性比例尺（含 invert：把像素反算成数据值）—— 原生实现，等价于 d3 的 scaleLinear
function lin(d0, d1, r0, r1) {
  const f = (v) => r0 + (r1 - r0) * ((v - d0) / (d1 - d0));
  f.invert = (p) => d0 + (d1 - d0) * ((p - r0) / (r1 - r0));
  return f;
}

const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

// Catmull-Rom → 三次贝塞尔：直线版与曲线版按张力 a 线性混合（0 = 直线）
function smoothPath(pts, a) {
  const f = (n) => Math.round(n * 100) / 100;
  let d = 'M ' + f(pts[0][0]) + ' ' + f(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || pts[i + 1];
    const s1x = p1[0] + (p2[0] - p1[0]) / 3, s1y = p1[1] + (p2[1] - p1[1]) / 3;
    const s2x = p2[0] - (p2[0] - p1[0]) / 3, s2y = p2[1] - (p2[1] - p1[1]) / 3;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    const q1x = s1x + (c1x - s1x) * a, q1y = s1y + (c1y - s1y) * a;
    const q2x = s2x + (c2x - s2x) * a, q2y = s2y + (c2y - s2y) * a;
    d += ' C ' + f(q1x) + ' ' + f(q1y) + ' ' + f(q2x) + ' ' + f(q2y) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
  }
  return d;
}

// 极坐标 → 笛卡尔
const polar = (theta, r) => [r * Math.cos(theta), r * Math.sin(theta)];

// 悬浮提示：由 wrap 提供定位参照
function makeTip(wrap, tip) {
  return {
    show(ev, text) {
      const box = wrap.getBoundingClientRect();
      tip.textContent = text;
      tip.style.left = (ev.clientX - box.left) + 'px';
      tip.style.top = (ev.clientY - box.top) + 'px';
      tip.hidden = false;
    },
    hide() { tip.hidden = true; }
  };
}

const CORS_NOTE = 'opened directly via file:// it is blocked by browser CORS; please use a local http server';

/* ---------------------------------------------------------
 * 2) 2024 日气温数据源
 *    fetch 优先；失败（file:// 的 CORS 拦截）时退回内联常量数组。
 *    内联的理由：本章 3 个演示都依赖这条日序列，离线双击打开也能看；
 *    CSV 文件仍然保留在 data/ 目录，作为可核对的数据源。
 * ------------------------------------------------------- */
const TEMP_LO = -5;
const TEMP_HI = 24;

const FALLBACK_TEMP = (
  '2.9 4.1 8.1 5.9 3.9 4.5 7.3 0.2 -1.3 9.3 3.8 -1.3 -0.3 5.9 2.5 -1.4 -1.0 5.1 4.9 2.3 1.6 7.0 1.3 1.3 2.8 0.8 -2.2 3.6 10.1 1.4 6.0 ' +
  '3.3 -2.3 5.2 13.5 3.7 4.2 -4.0 10.2 3.8 3.2 1.3 3.1 5.0 5.4 2.1 0.7 0.7 0.2 3.9 10.9 5.0 3.8 5.2 7.3 4.7 0.7 6.7 -0.1 1.0 ' +
  '13.9 3.4 2.9 5.3 6.3 1.9 9.7 10.6 0.3 6.5 7.5 1.0 6.9 8.4 7.5 3.2 6.3 13.2 5.5 6.3 13.4 5.5 7.1 9.7 8.2 4.0 16.8 4.8 9.0 9.7 3.0 ' +
  '4.8 6.2 7.8 5.7 12.7 6.1 5.4 6.9 6.7 6.7 7.9 19.2 9.8 11.7 11.6 12.0 5.7 9.7 9.7 4.1 11.2 9.8 14.6 8.9 15.6 8.7 11.6 10.9 7.4 14.2 ' +
  '6.0 10.0 13.5 13.5 6.2 13.4 14.5 10.2 9.8 14.8 12.4 10.0 16.4 13.3 11.7 14.1 18.7 11.3 16.0 16.0 13.2 13.4 19.9 16.3 9.6 11.4 12.2 13.3 12.8 14.3 18.7 ' +
  '12.5 20.2 17.8 14.6 16.6 12.3 9.4 15.3 17.1 12.3 9.2 16.7 17.5 12.9 20.6 16.2 16.1 19.4 18.3 12.8 15.9 16.4 14.9 15.4 22.2 17.9 12.3 22.6 14.6 11.0 ' +
  '16.5 16.6 16.8 21.0 15.1 16.3 15.3 15.3 13.8 19.0 20.1 15.0 11.4 17.1 21.5 11.1 13.1 17.6 14.7 20.9 17.3 20.0 17.5 15.7 19.7 14.6 17.0 17.4 17.2 14.3 20.4 ' +
  '17.0 18.5 14.9 15.1 12.8 19.9 19.2 17.0 12.8 15.0 17.3 10.6 15.8 17.6 13.1 21.1 15.1 15.2 12.9 15.3 21.3 11.4 19.1 17.3 14.1 15.0 16.0 20.6 12.1 15.7 11.8 ' +
  '13.5 11.0 16.7 16.0 13.1 10.2 13.9 15.9 9.4 15.0 17.6 11.7 14.7 17.6 17.6 13.1 11.0 10.5 11.9 15.5 14.5 12.4 10.6 11.9 8.6 13.2 16.1 18.2 9.3 9.3 ' +
  '12.6 13.9 12.9 12.9 16.3 7.1 12.7 8.1 8.0 6.8 9.7 12.4 10.6 13.8 13.6 6.8 13.2 10.0 11.2 3.2 6.3 9.4 10.3 5.4 5.5 6.9 11.2 10.5 6.6 6.7 6.0 ' +
  '11.4 7.7 6.1 4.9 11.7 7.9 5.6 3.3 11.5 9.4 10.4 6.8 11.2 10.7 4.4 6.5 6.7 9.6 4.7 5.4 11.4 0.5 4.8 9.7 8.0 2.1 4.4 9.8 5.9 5.1 ' +
  '0.5 0.4 4.2 5.0 9.0 0.3 0.1 5.9 6.5 7.3 0.3 7.9 2.3 8.6 5.2 4.3 9.0 3.9 -0.7 1.6 4.5 6.0 6.6 4.2 4.6 3.9 1.2 8.8 3.7 5.1 -0.3'
).trim().split(/\s+/).map(Number);

const FB_MONTH_LEN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function fallbackDays() {
  const out = [];
  let k = 0;
  FB_MONTH_LEN.forEach((len, mi) => {
    for (let d = 1; d <= len; d++) {
      out.push({ y: 2024, m: mi + 1, d, date: '2024-' + pad2(mi + 1) + '-' + pad2(d), temp: FALLBACK_TEMP[k++] });
    }
  });
  return out;
}

let weatherCache = null;
async function getWeather() {
  if (weatherCache) return weatherCache;
  try {
    const res = await fetch('../../lesson-05/data/weather_2024.csv');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const di = head.indexOf('date');
    const ti = head.indexOf('temp_max');
    const days = rows.slice(1).map((r) => {
      const p = String(r[di] || '').split('-');
      return { y: +p[0], m: +p[1], d: +p[2], date: String(r[di]), temp: +r[ti] };
    }).filter((x) => x.y && !isNaN(x.temp));
    if (!days.length) throw new Error('CSV has no valid data rows');
    weatherCache = { days, error: null };
  } catch (err) {
    weatherCache = { days: fallbackDays(), error: err };
  }
  return weatherCache;
}

// 温度 → 颜色（运行时派生：用设计令牌现场 color-mix 出蓝 → 橙 → 红的色阶）
function tempFill(v) {
  if (v == null || isNaN(v)) return 'var(--c-surface-2)';
  const t = Math.max(0, Math.min(1, (v - TEMP_LO) / (TEMP_HI - TEMP_LO)));
  if (t < 0.5) {
    const p = Math.round((t / 0.5) * 100);
    return 'color-mix(in srgb, var(--ch-1) ' + p + '%, var(--ch-2))';
  }
  const p = Math.round(((t - 0.5) / 0.5) * 100);
  return 'color-mix(in srgb, var(--c-danger) ' + p + '%, var(--ch-2))';
}

// van Wijk 月份分隔：只回看 7 天，一次 O(n) 扫描覆盖 28–31 天与闰年
function isMonthDivider(d) {
  const prev = new Date(d.getTime() - 7 * 86400000);
  return d.getFullYear() !== prev.getFullYear() || d.getMonth() !== prev.getMonth();
}

/* =========================================================
 * 5.1 · 时间属性分解轮盘（d-5-1）
 * ======================================================= */
DEMOS['d-5-1'] = function (mount) {
  const ATTRS = [
    {
      name: 'Instant', en: 'instant', icon: '·', token: 'var(--c-primary)',
      desc: 'A single instantaneous point on the time axis: it has position, not length. Subtract two timestamps and you get a "duration".',
      example: 'A train arriving at 08:12, a log timestamp, the instant a single heartbeat occurs',
      viz: 'Scatter plot / event markers (point + label): time on x, measure on y',
      tip: 'Do not draw several records at the same instant as a line implying an order — an instant has no length.'
    },
    {
      name: 'Interval', en: 'interval', icon: '↔', token: 'var(--c-accent)',
      desc: 'The length (duration) between two instants. It is the value itself, not a position.',
      example: 'A 4-minute-and-12-second call, the RR interval between two heartbeats, the gap between two visits',
      viz: 'Gantt chart / timeline brackets / duration bar chart',
      tip: 'Intervals can be added; two instants cannot — they have different dimensions.'
    },
    {
      name: 'Span', en: 'span', icon: '▭', token: 'var(--ch-1)',
      desc: 'A whole range continuously covered from start to end, often used for "range highlighting".',
      example: 'A promotion season 6/1–6/18, between the two halves of a match, a maintenance window',
      viz: 'Area chart / range shading / brush selection',
      tip: 'A span carries range semantics; drawing it as a point loses the notion of "coverage".'
    },
    {
      name: 'Frequency', en: 'frequency', icon: '≋', token: 'var(--ch-3)',
      desc: 'The number of times an event repeats per unit time (also the sampling rate, the reciprocal of the cycle count).',
      example: 'Clicks per minute (QPS), an audio sampling rate of 44.1 kHz, three trips a year',
      viz: 'Bar chart counting by time bucket / histogram / spectrogram',
      tip: 'Frequency = count ÷ duration; change the denominator and two frequencies are no longer comparable.'
    },
    {
      name: 'Cycle', en: 'cycle', icon: '↻', token: 'var(--c-success)',
      desc: 'A repeating segment that returns to its start: start and end are "equivalent", so it can be coiled head-to-tail into a ring.',
      example: 'The 24-hour day-night cycle, the wheel of the four seasons, a monthly bill, a weekly commuting pattern',
      viz: 'Spiral / calendar heatmap / polar rose chart (cyclic time domain)',
      tip: 'A cycle placed on a linear axis gets "flattened"; only coiled into a circle or spiral does it become visible.'
    }
  ];

  const W = 470, H = 400, CX = 235, CY = 200, R = 128;

  const nodes = ATTRS.map((a, i) => {
    const ang = (-90 + i * 72) * Math.PI / 180;
    const x = +polar(ang, R)[0] + CX;
    const y = +polar(ang, R)[1] + CY;
    return '<g class="l5-wheel-node" data-i="' + i + '" tabindex="0" role="button" aria-label="' + a.name + '">'
      + '<circle class="l5-halo" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="54" fill="none" style="stroke:' + a.token + ';stroke-width:3"/>'
      + '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="47" style="fill:color-mix(in srgb, ' + a.token + ' 14%, var(--c-surface));stroke:color-mix(in srgb, ' + a.token + ' 46%, var(--c-border-2));stroke-width:1.4"/>'
      + '<text x="' + x.toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" style="fill:' + a.token + ';font-size:24px;font-weight:700">' + a.icon + '</text>'
      + '<text x="' + x.toFixed(1) + '" y="' + (y + 16).toFixed(1) + '" text-anchor="middle" style="fill:var(--c-text);font-size:12px;font-weight:600">' + a.name + '</text>'
      + '</g>';
  }).join('');

  mount.innerHTML =
    '<div class="demo-grid">'
    + '<div class="demo-stage"><div class="l5-wrap">'
    + '<svg class="l5-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Temporal-attribute wheel: five nodes — instant, interval, span, frequency, cycle — evenly distributed on a circle">'
    + '<circle cx="' + CX + '" cy="' + CY + '" r="56" style="fill:color-mix(in srgb, var(--c-primary) 8%, var(--c-surface));stroke:var(--c-line-2);stroke-width:1"/>'
    + '<text id="l5-hub-name" x="' + CX + '" y="' + (CY - 2) + '" text-anchor="middle" style="fill:var(--c-text);font-size:14px;font-weight:700">—</text>'
    + '<text id="l5-hub-en" x="' + CX + '" y="' + (CY + 15) + '" text-anchor="middle" style="fill:var(--c-muted);font-size:10px">Select a node</text>'
    + nodes
    + '</svg>'
    + '</div></div>'
    + '<div class="demo-detail" data-role="detail"></div>'
    + '</div>'
    + '<p class="demo-note">The wheel\'s five nodes only answer "what is this time column asking about"; they are not five mutually exclusive data types. Fix the attribute first, then pick the chart — pick the wrong attribute and even the prettiest chart cannot answer the question.</p>';

  const groups = [...mount.querySelectorAll('.l5-wheel-node')];
  const hubName = mount.querySelector('#l5-hub-name');
  const hubEn = mount.querySelector('#l5-hub-en');
  const detail = mount.querySelector('[data-role="detail"]');

  function select(i) {
    const a = ATTRS[i];
    groups.forEach((g, k) => g.classList.toggle('is-on', k === i));
    hubName.textContent = a.name;
    hubEn.textContent = a.en;
    detail.innerHTML =
      '<h4 style="color:' + a.token + ';margin:0 0 6px">' + a.icon + ' ' + a.name
      + ' <span style="font-size:11px;color:var(--c-muted);font-weight:400">key: ' + a.en + '</span></h4>'
      + '<p style="margin:6px 0;color:var(--c-text-soft);line-height:1.75">' + a.desc + '</p>'
      + '<p style="margin:6px 0;font-size:13px"><b>Real-life example:</b> ' + a.example + '</p>'
      + '<p style="margin:6px 0;font-size:13px"><b>Typical visualizations:</b> ' + a.viz + '</p>'
      + '<p style="margin:10px 0 0"><span class="pill">Design note</span> ' + a.tip + '</p>';
  }

  groups.forEach((g) => {
    const i = +g.dataset.i;
    g.addEventListener('click', () => select(i));
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(i); }
    });
  });

  select(4); // 默认停在「周期」，正好把话题接到 5.3 / 5.4
};

/* =========================================================
 * 5.2 · 标准折线图 + 多尺度聚合对照（d-5-2）
 * ======================================================= */
DEMOS['d-5-2'] = async function (mount) {
  const FR_W = 700, FR_H = 250, FRM = { t: 18, r: 20, b: 34, l: 56 };
  const FR_Y = lin(0, 5600, FR_H - FRM.b, FRM.t);
  const FR_X = lin(1900, 2020, FRM.l, FR_W - FRM.r);
  const NAMES = [
    { key: 'Marie', token: 'var(--ch-4)' },
    { key: 'Jean', token: 'var(--ch-1)' },
    { key: 'Camille', token: 'var(--ch-3)' }
  ];

  const weather = await getWeather();
  const days = weather.days;

  mount.innerHTML =
    '<div class="l5-sub">① Original example: French-name usage frequency (1900–2020, births registered per year)</div>'
    + '<div class="l5-legend" data-role="fr-legend"></div>'
    + '<div class="l5-wrap" data-role="fr-wrap">'
    + '<svg class="l5-svg" viewBox="0 0 ' + FR_W + ' ' + FR_H + '" role="img" aria-label="Line chart of French-name usage frequency"></svg>'
    + '<div class="l5-tip" hidden></div>'
    + '</div>'
    + '<div class="l5-status" data-role="fr-status"></div>'
    + '<div class="l5-sub">② Multi-scale comparison: what happens to the same 2024 daily temperatures at a different aggregation scale</div>'
    + '<div class="l5-ctrl" data-role="ms-ctrl">'
    + '<button type="button" class="demo-btn l5-btn" data-scale="daily">Raw daily</button>'
    + '<button type="button" class="demo-btn l5-btn" data-scale="weekly">Weekly</button>'
    + '<button type="button" class="demo-btn l5-btn" data-scale="monthly">Monthly</button>'
    + '<span class="l5-status" data-role="ms-status"></span>'
    + '</div>'
    + '<div class="l5-wrap" data-role="ms-wrap">'
    + '<svg class="l5-svg" viewBox="0 0 700 240" role="img" aria-label="Daily temperatures side by side at three aggregation scales: raw, weekly, monthly"></svg>'
    + '<div class="l5-tip" hidden></div>'
    + '</div>'
    + '<p class="demo-note">The three panels draw the same data: point counts 366 → 53 → 12. Aggregation "trades detail for clarity" — the cleaner the trend, the less visible the within-week differences.</p>';

  /* ---- ① 法国人名折线 ---- */
  const frSvg = mount.querySelector('[data-role="fr-wrap"] .l5-svg');
  const frTip = makeTip(mount.querySelector('[data-role="fr-wrap"]'), mount.querySelector('[data-role="fr-wrap"] .l5-tip'));
  const frLegend = mount.querySelector('[data-role="fr-legend"]');
  const frStatus = mount.querySelector('[data-role="fr-status"]');
  const frData = { maps: {}, years: [] };
  const visibleFr = new Set(NAMES.map((n) => n.key));

  let frError = null;
  try {
    const res = await fetch('../../lesson-05/data/french_names.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    NAMES.forEach(({ key }) => {
      const arr = json.names[key] || [];
      frData.maps[key] = new Map(arr.map((d) => [d.year, d.count]));
    });
    frData.years = (json.names[NAMES[0].key] || []).map((d) => d.year);
  } catch (err) {
    frError = err;
  }

  function yAt(key, year) {
    const m = frData.maps[key];
    return m && m.has(year) ? m.get(year) : 0;
  }

  function renderFr() {
    const p = [];
    for (let v = 0; v <= 5000; v += 1000) {
      const y = FR_Y(v);
      p.push('<line x1="' + FRM.l + '" x2="' + (FR_W - FRM.r) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--c-line);stroke-width:1"/>');
      p.push('<text x="' + (FRM.l - 8) + '" y="' + (y + 3) + '" text-anchor="end" style="fill:var(--c-muted);font-size:10px">' + v + '</text>');
    }
    p.push('<line x1="' + FRM.l + '" x2="' + (FR_W - FRM.r) + '" y1="' + (FR_H - FRM.b) + '" y2="' + (FR_H - FRM.b) + '" style="stroke:var(--c-line-2);stroke-width:1"/>');
    for (let yr = 1900; yr <= 2020; yr += 20) {
      const x = FR_X(yr);
      p.push('<line x1="' + x + '" x2="' + x + '" y1="' + (FR_H - FRM.b) + '" y2="' + (FR_H - FRM.b + 4) + '" style="stroke:var(--c-line-2);stroke-width:1"/>');
      p.push('<text x="' + x + '" y="' + (FR_H - FRM.b + 16) + '" text-anchor="middle" style="fill:var(--c-muted);font-size:10px">' + yr + '</text>');
    }
    p.push('<text x="' + (FRM.l + (FR_W - FRM.l - FRM.r) / 2) + '" y="' + (FR_H - 4) + '" text-anchor="middle" style="fill:var(--c-muted);font-size:10px">Year →</text>');
    p.push('<text x="8" y="' + (FRM.t + 8) + '" style="fill:var(--c-muted);font-size:10px">Births per year</text>');

    if (frData.years.length) {
      NAMES.forEach(({ key, token }) => {
        if (!visibleFr.has(key)) return;
        const pts = frData.years.map((y) => FR_X(y).toFixed(1) + ',' + FR_Y(yAt(key, y)).toFixed(1)).join(' ');
        p.push('<polyline class="l5-line" points="' + pts + '" style="fill:none;stroke:' + token + ';stroke-width:2.2;stroke-linejoin:round"/>');
      });
    }
    p.push('<g data-role="fr-focus" style="display:none">'
      + '<line data-role="fr-hline" y1="' + FRM.t + '" y2="' + (FR_H - FRM.b) + '" style="stroke:var(--c-text);stroke-width:1;opacity:.45"/>'
      + '<g data-role="fr-dots"></g></g>');
    p.push('<rect data-role="fr-overlay" x="' + FRM.l + '" y="' + FRM.t + '" width="' + (FR_W - FRM.l - FRM.r) + '" height="' + (FR_H - FRM.t - FRM.b) + '" fill="none" pointer-events="all"/>');
    frSvg.innerHTML = p.join('');
    bindFrHover();
  }

  function bindFrHover() {
    const overlay = frSvg.querySelector('[data-role="fr-overlay"]');
    const focus = frSvg.querySelector('[data-role="fr-focus"]');
    const hline = frSvg.querySelector('[data-role="fr-hline"]');
    const dots = frSvg.querySelector('[data-role="fr-dots"]');
    if (!overlay || !frData.years.length) return;
    overlay.addEventListener('mousemove', (ev) => {
      const box = frSvg.getBoundingClientRect();
      const vbX = (ev.clientX - box.left) / box.width * FR_W;
      const year = Math.max(1900, Math.min(2020, Math.round(FR_X.invert(vbX))));
      const x = FR_X(year);
      focus.style.display = '';
      hline.setAttribute('x1', x);
      hline.setAttribute('x2', x);
      const parts = [];
      const texts = [];
      NAMES.forEach(({ key, token }) => {
        if (!visibleFr.has(key)) return;
        const v = yAt(key, year);
        parts.push('<circle cx="' + x + '" cy="' + FR_Y(v) + '" r="3.4" style="fill:' + token + ';stroke:var(--c-surface);stroke-width:1.2"/>');
        texts.push(key + ' ' + v.toLocaleString('en-US'));
      });
      dots.innerHTML = parts.join('');
      frTip.show(ev, year + ' · ' + texts.join(' · '));
    });
    overlay.addEventListener('mouseleave', () => {
      focus.style.display = 'none';
      frTip.hide();
    });
  }

  function updateFrStatus() {
    if (frError) {
      frStatus.textContent = 'Failed to load the French-name data (' + CORS_NOTE + ') — continue with the multi-scale demo below.';
      return;
    }
    frStatus.textContent = 'Currently showing: ' + [...visibleFr].join(' / ') + ' · 121 years × 3 names of data (1900–2020)';
  }

  NAMES.forEach(({ key, token }) => {
    const item = document.createElement('label');
    item.className = 'l5-legend__item is-on';
    item.innerHTML = '<span class="l5-swatch" style="background:' + token + '"></span>'
      + '<span>' + key + '</span><input type="checkbox" checked style="display:none">';
    const cb = item.querySelector('input');
    cb.addEventListener('change', () => {
      if (cb.checked) visibleFr.add(key); else visibleFr.delete(key);
      item.classList.toggle('is-on', cb.checked);
      renderFr();
      updateFrStatus();
    });
    item.addEventListener('click', (ev) => {
      if (ev.target === cb) return;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
    frLegend.appendChild(item);
  });

  renderFr();
  updateFrStatus();

  /* ---- ② 多尺度聚合对照 ---- */
  const msSvg = mount.querySelector('[data-role="ms-wrap"] .l5-svg');
  const msTip = makeTip(mount.querySelector('[data-role="ms-wrap"]'), mount.querySelector('[data-role="ms-wrap"] .l5-tip'));
  const msStatus = mount.querySelector('[data-role="ms-status"]');

  const SCALES = {
    daily: { name: 'Raw daily', note: 'All 366 days kept, the fluctuation intact, but daily noise drowns the trend.' },
    weekly: { name: 'Weekly', note: 'Averaging every 7 days washes out the noise and makes the trend clearer, at the cost of within-week detail.' },
    monthly: { name: 'Monthly', note: 'Monthly means distill the trend to its cleanest, but only 12 points remain.' }
  };

  function buildScales(list) {
    const daily = list.map((d, i) => ({ x: i, t: d.temp, label: d.date }));
    const weekly = [];
    for (let i = 0; i < list.length; i += 7) {
      const chunk = list.slice(i, i + 7);
      const t = chunk.reduce((s, d) => s + d.temp, 0) / chunk.length;
      weekly.push({ x: i + (chunk.length - 1) / 2, t, label: chunk[0].date + ' · 7-day mean' });
    }
    const byMonth = new Map();
    list.forEach((d, i) => {
      if (!byMonth.has(d.m)) byMonth.set(d.m, []);
      byMonth.get(d.m).push(i);
    });
    const monthly = [];
    byMonth.forEach((idxs, m) => {
      const t = idxs.reduce((s, i) => s + list[i].temp, 0) / idxs.length;
      monthly.push({ x: (idxs[0] + idxs[idxs.length - 1]) / 2, t, label: 'Month ' + m + ' mean' });
    });
    return { daily, weekly, monthly };
  }

  const scales = buildScales(days);

  const MS_W = 700, MS_H = 240;
  const PANEL_W = 200, GAP = 30, X0 = 20, TOP = 42, BOT = 40;
  const MS_Y = lin(-5, 24, MS_H - BOT, TOP);
  let activeScale = 'weekly';
  const panelRefs = {};

  function panelX(k) { return X0 + k * (PANEL_W + GAP); }

  function renderMs() {
    const p = [];
    ['daily', 'weekly', 'monthly'].forEach((key, k) => {
      const arr = scales[key];
      const px = panelX(k);
      const xs = arr.map((d) => d.x);
      const PX = lin(Math.min.apply(null, xs), Math.max.apply(null, xs), px + 8, px + PANEL_W - 8);

      p.push('<g class="l5-panel' + (key === activeScale ? '' : ' is-dim') + '" data-panel="' + key + '">');
      p.push('<rect x="' + px + '" y="' + (TOP - 22) + '" width="' + PANEL_W + '" height="' + (MS_H - TOP - BOT + 32) + '" rx="8" style="fill:var(--c-surface-2)"/>');
      p.push('<text x="' + (px + 10) + '" y="' + (TOP - 7) + '" style="fill:var(--c-text-soft);font-size:12px;font-weight:600">' + SCALES[key].name + '</text>');
      [-5, 5, 15, 24].forEach((v) => {
        const y = MS_Y(v);
        p.push('<line x1="' + (px + 8) + '" x2="' + (px + PANEL_W - 8) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--c-line);stroke-width:1"/>');
      });
      p.push('<line x1="' + (px + 8) + '" x2="' + (px + PANEL_W - 8) + '" y1="' + MS_Y(-5) + '" y2="' + MS_Y(-5) + '" style="stroke:var(--c-line-2);stroke-width:1"/>');
      const pts = arr.map((d) => PX(d.x).toFixed(1) + ',' + MS_Y(d.t).toFixed(1)).join(' ');
      p.push('<polyline points="' + pts + '" style="fill:none;stroke:var(--c-primary);stroke-width:' + (key === activeScale ? '2.4' : '1.6') + ';stroke-linejoin:round"/>');
      const range = key === 'monthly' ? 'Jan → Dec'
        : key === 'weekly' ? 'Week 1 → Week ' + arr.length
        : 'Day 1 → Day ' + arr.length;
      p.push('<text x="' + (px + 10) + '" y="' + (MS_H - 12) + '" style="fill:var(--c-muted);font-size:10px">' + arr.length + ' points · ' + range + '</text>');
      p.push('<rect data-role="ms-overlay" data-panel="' + key + '" x="' + (px + 8) + '" y="' + TOP + '" width="' + (PANEL_W - 16) + '" height="' + (MS_H - TOP - BOT) + '" fill="none" pointer-events="all"/>');
      p.push('</g>');

      panelRefs[key] = { arr, PX };
    });
    msSvg.innerHTML = p.join('');
    bindMsHover();
    msStatus.textContent = 'Scale: ' + SCALES[activeScale].name + ' · ' + SCALES[activeScale].note;
  }

  function bindMsHover() {
    msSvg.querySelectorAll('[data-role="ms-overlay"]').forEach((ov) => {
      ov.addEventListener('mousemove', (ev) => {
        const ref = panelRefs[ov.dataset.panel];
        const box = msSvg.getBoundingClientRect();
        const vbX = (ev.clientX - box.left) / box.width * MS_W;
        let best = ref.arr[0], bestD = Infinity;
        ref.arr.forEach((d) => {
          const dx = Math.abs(ref.PX(d.x) - vbX);
          if (dx < bestD) { bestD = dx; best = d; }
        });
        msTip.show(ev, best.label + ' · ' + best.t.toFixed(1) + '°C');
      });
      ov.addEventListener('mouseleave', () => msTip.hide());
    });
  }

  mount.querySelectorAll('[data-scale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeScale = btn.dataset.scale;
      mount.querySelectorAll('[data-scale]').forEach((b) => b.classList.toggle('is-active', b === btn));
      // 强制一次重排，让 .l5-panel 的 opacity 过渡从当前值开始（不用 rAF）
      void msSvg.offsetWidth;
      renderMs();
    });
  });
  mount.querySelector('[data-scale="weekly"]').classList.add('is-active');
  renderMs();
};

/* =========================================================
 * 5.3 · van Wijk 日历热图（d-5-3）
 * ======================================================= */
DEMOS['d-5-3'] = async function (mount) {
  const weather = await getWeather();
  const days = weather.days;
  const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  mount.innerHTML =
    '<div class="l5-ctrl">'
    + '<label class="l5-check">Week starts on: <select data-role="weekstart"><option value="1" selected>Monday</option><option value="0">Sunday</option></select></label>'
    + '<span class="l5-status" data-role="status"></span>'
    + '</div>'
    + '<div class="l5-wrap"><svg class="l5-svg" viewBox="0 0 760 140" role="img" aria-label="2024 daily maximum temperature calendar heatmap: weeks on x, weekdays on y, color for temperature"></svg><div class="l5-tip" hidden></div></div>'
    + '<div class="l5-ctrl"><div class="l5-strip-row"><span>' + TEMP_LO + '°C cold</span><span class="l5-strip" data-role="strip"></span><span>' + TEMP_HI + '°C hot</span></div></div>'
    + '<p class="demo-note">A line chart answers "how it changes over time", a calendar heatmap answers "how it changes with season / weekday": with the same data, the calendar aligns "seven cells to a week" into a column, and seasonality instantly becomes color patches you can scan at a glance.</p>';

  const svg = mount.querySelector('.l5-svg');
  const wrap = mount.querySelector('.l5-wrap');
  const tip = makeTip(wrap, mount.querySelector('.l5-tip'));
  const sel = mount.querySelector('[data-role="weekstart"]');
  const status = mount.querySelector('[data-role="status"]');
  const strip = mount.querySelector('[data-role="strip"]');

  const CELL = 13, X0 = 30, Y0 = 34;
  const jan1 = new Date(2024, 0, 1);
  const geo = days.map((d) => ({ ...d, dt: new Date(d.y, d.m - 1, d.d) }));
  const dayIdx = (dt) => Math.round((dt - jan1) / 86400000);
  let cells = [];   // 供委托监听读取，每次 render 重新赋值

  // 事件委托只绑一次：既不给 366 个格子各绑一个 handler，也不会在重绘后重复绑定
  svg.addEventListener('mousemove', (ev) => {
    const rect = ev.target.closest ? ev.target.closest('.l5-cell') : null;
    if (!rect) return;
    const c = cells[+rect.dataset.i];
    if (!c) return;
    rect.setAttribute('stroke', 'var(--c-text)');
    rect.setAttribute('stroke-width', '1.4');
    tip.show(ev, c.d.date + ' · ' + c.d.temp.toFixed(1) + '°C');
  });
  svg.addEventListener('mouseout', (ev) => {
    const rect = ev.target.closest ? ev.target.closest('.l5-cell') : null;
    if (rect) rect.removeAttribute('stroke');
  });
  svg.addEventListener('mouseleave', () => tip.hide());

  function render() {
    const weekStart = +sel.value;
    const row0 = ((jan1.getDay() - weekStart) + 7) % 7;
    const rowOf = (dt) => ((dt.getDay() - weekStart) + 7) % 7;
    const colOf = (dt) => Math.floor((dayIdx(dt) + row0) / 7);
    const cols = Math.floor((days.length + row0) / 7) + 1;
    const p = [];

    WEEKDAY.forEach((_, i) => {
      p.push('<text x="' + (X0 - 6) + '" y="' + (Y0 + i * CELL + CELL - 3) + '" text-anchor="end" style="fill:var(--c-muted);font-size:10px">' + WEEKDAY[(weekStart + i) % 7] + '</text>');
    });

    cells = geo.map((d, i) => {
      const col = colOf(d.dt);
      const row = rowOf(d.dt);
      const x = X0 + col * CELL;
      const y = Y0 + row * CELL;
      p.push('<rect class="l5-cell" data-i="' + i + '" x="' + (x + 0.8) + '" y="' + (y + 0.8) + '" width="' + (CELL - 1.6) + '" height="' + (CELL - 1.6) + '" rx="2" style="fill:' + tempFill(d.temp) + '"/>');
      return { x, y, d, col, row };
    });

    let dividers = 0;
    geo.forEach((d) => {
      if (!isMonthDivider(d.dt)) return;
      dividers++;
      p.push('<line x1="' + (X0 + colOf(d.dt) * CELL) + '" x2="' + (X0 + colOf(d.dt) * CELL) + '" y1="' + (Y0 + rowOf(d.dt) * CELL) + '" y2="' + (Y0 + rowOf(d.dt) * CELL + CELL) + '" style="stroke:var(--c-danger);stroke-width:1.4"/>');
    });
    geo.forEach((d) => {
      if (d.dt.getDate() !== 1) return;
      p.push('<text x="' + (X0 + colOf(d.dt) * CELL + 1) + '" y="' + (Y0 - 8) + '" style="fill:var(--c-text-soft);font-size:10px">' + MONTH_EN[d.dt.getMonth()] + '</text>');
    });

    svg.innerHTML = p.join('');

    const temps = days.map((d) => d.temp);
    const lo = Math.min.apply(null, temps);
    const hi = Math.max.apply(null, temps);
    status.textContent = 'Week starts on: ' + (weekStart === 1 ? 'Monday' : 'Sunday') + ' · ' + days.length + ' days · ' + cols
      + ' week columns · ' + dividers + ' month dividers · coldest ' + lo.toFixed(1) + '°C / hottest ' + hi.toFixed(1) + '°C';
  }

  let swatches = '';
  for (let i = 0; i <= 20; i++) {
    swatches += '<i style="background:' + tempFill(TEMP_LO + (i / 20) * (TEMP_HI - TEMP_LO)) + '"></i>';
  }
  strip.innerHTML = swatches;

  sel.addEventListener('change', render);
  render();
};

/* =========================================================
 * 5.4 · 阿基米德螺旋日历（d-5-4）
 * ======================================================= */
DEMOS['d-5-4'] = async function (mount) {
  const weather = await getWeather();
  const days = weather.days;

  // 与 5.4「关键代码」一致的螺旋参数
  const BOX = 22;                        // 一格的目标弧长
  const COIL_GAP = BOX * 1.4;            // 相邻两圈的径向间距
  const B = COIL_GAP / (2 * Math.PI);    // 每转一圈 r 增加的常量 b
  const START_R = 60;
  const HALF = BOX / 2;                  // 扇环的半宽

  const MODES = {
    year: { daysPerLoop: 366, name: '1 loop = 1 year' },
    season: { daysPerLoop: 91.5, name: '1 loop = 1 season' },
    month: { daysPerLoop: 30.44, name: '1 loop = 1 month' }
  };
  let mode = 'season';
  let equalArc = false;

  mount.innerHTML =
    '<div class="l5-ctrl">'
    + '<button type="button" class="demo-btn l5-btn" data-mode="year">1 loop = 1 year</button>'
    + '<button type="button" class="demo-btn l5-btn" data-mode="season">1 loop = 1 season</button>'
    + '<button type="button" class="demo-btn l5-btn" data-mode="month">1 loop = 1 month</button>'
    + '<label class="l5-check"><input type="checkbox" data-role="equal"> Equal-arc Δθ</label>'
    + '</div>'
    + '<div class="l5-wrap"><svg class="l5-svg" role="img" aria-label="2024 daily temperatures laid out as a calendar on an Archimedean spiral"></svg><div class="l5-tip" hidden></div></div>'
    + '<div class="l5-status" data-role="status"></div>'
    + '<div class="l5-looplist" data-role="loops"></div>'
    + '<p class="demo-note">With a fixed Δθ, the larger the radius, the longer the arc for the same angle — outer cells get stretched; after ticking "Equal-arc Δθ" inner and outer cells have equal width, at the cost that "one loop" no longer equals 2π, so cycles can only be read by loop index.</p>';

  const svg = mount.querySelector('.l5-svg');
  const wrap = mount.querySelector('.l5-wrap');
  const tip = makeTip(wrap, mount.querySelector('.l5-tip'));
  const status = mount.querySelector('[data-role="status"]');
  const loopList = mount.querySelector('[data-role="loops"]');
  const equalBox = mount.querySelector('[data-role="equal"]');
  let segs = [];
  let mark = 1;

  // 事件委托只绑一次：重绘（换模式 / 勾选等弧长）后不会重复绑定
  svg.addEventListener('mousemove', (ev) => {
    const el = ev.target.closest ? ev.target.closest('.l5-seg') : null;
    if (!el) return;
    const s = segs[+el.dataset.i];
    if (!s) return;
    el.setAttribute('stroke', 'var(--c-text)');
    el.setAttribute('stroke-width', (mark * 2).toFixed(2));
    tip.show(ev, s.d.date + ' · ' + s.d.temp.toFixed(1) + '°C · Loop ' + s.loop);
  });
  svg.addEventListener('mouseout', (ev) => {
    const el = ev.target.closest ? ev.target.closest('.l5-seg') : null;
    if (el) { el.setAttribute('stroke', 'var(--c-surface)'); el.setAttribute('stroke-width', (mark * 0.5).toFixed(2)); }
  });
  svg.addEventListener('mouseleave', () => tip.hide());

  function render() {
    const daysPerLoop = MODES[mode].daysPerLoop;
    const dThetaFixed = (2 * Math.PI) / daysPerLoop;
    segs = [];
    let theta = 0;            // 角度起点 0 → 半径起点恰好等于 START_R
    let prevLoop = -1;        // -1 → 第 1 天的「第 1 圈起点」也会被标记

    for (let i = 0; i < days.length; i++) {
      const r0 = START_R + B * theta;
      const dt = equalArc ? BOX / Math.sqrt(B * B + r0 * r0) : dThetaFixed;
      const t0 = theta;
      const t1 = theta + dt;
      const r1 = START_R + B * t1;
      theta = t1;
      const li = Math.floor(theta / (2 * Math.PI));
      segs.push({ t0, t1, r0, r1, d: days[i], loopStart: li > prevLoop, loop: li + 1 });
      prevLoop = li;
    }

    const rMax = segs[segs.length - 1].r1 + HALF;
    const R = rMax + 16;
    svg.setAttribute('viewBox', (-R).toFixed(1) + ' ' + (-R).toFixed(1) + ' ' + (2 * R).toFixed(1) + ' ' + (2 * R).toFixed(1));

    mark = Math.max(0.8, R * 0.008);
    const p = [];
    p.push('<circle cx="0" cy="0" r="' + START_R.toFixed(1) + '" fill="none" style="stroke:var(--c-line-2);stroke-width:' + mark.toFixed(2) + ';stroke-dasharray:' + (mark * 4).toFixed(2) + ' ' + (mark * 3).toFixed(2) + '"/>');

    segs.forEach((s, i) => {
      const at = (t, rr) => polar(t, rr).map((n) => n.toFixed(2));
      const o0 = at(s.t0, s.r0 + HALF);
      const o1 = at(s.t1, s.r1 + HALF);
      const i1 = at(s.t1, s.r1 - HALF);
      const i0 = at(s.t0, s.r0 - HALF);
      p.push('<path class="l5-seg" data-i="' + i + '" d="M ' + o0[0] + ' ' + o0[1] + ' L ' + o1[0] + ' ' + o1[1]
        + ' L ' + i1[0] + ' ' + i1[1] + ' L ' + i0[0] + ' ' + i0[1] + ' Z" style="fill:' + tempFill(s.d.temp)
        + ';stroke:var(--c-surface);stroke-width:' + (mark * 0.5).toFixed(2) + '"/>');
      if (s.loopStart) {
        const a = polar(s.t0, s.r0 + HALF);
        const b = polar(s.t0, s.r0 - HALF);
        p.push('<line x1="' + a[0].toFixed(2) + '" y1="' + a[1].toFixed(2) + '" x2="' + b[0].toFixed(2) + '" y2="' + b[1].toFixed(2) + '" style="stroke:var(--c-muted);stroke-width:' + mark.toFixed(2) + '"/>');
      }
    });
    svg.innerHTML = p.join('');

    const loops = Math.round((theta / (2 * Math.PI)) * 10) / 10;
    status.textContent = MODES[mode].name + ' · ' + (equalArc ? 'equal-arc Δθ = BOX/√(b²+r²)' : 'fixed Δθ = 2π/' + daysPerLoop)
      + ' · about ' + loops + ' loops · radius ' + START_R + ' → ' + rMax.toFixed(0);

    // 圈索引清单：等弧长模式下「每圈」由弧长目标决定，与「每圈 = X」解耦
    let list = '';
    let k = 0;
    segs.forEach((s) => {
      if (!s.loopStart) return;
      k++;
      list += '<div>Loop ' + k + ' starts at ' + s.d.date + '</div>';
    });
    loopList.innerHTML = list + (equalArc
      ? '<div>Equal-arc is on: the total loop count is decided by the arc-length target (about ' + loops + ' loops) and is independent of "' + MODES[mode].name + '" — this is the cost of a dynamic Δθ.</div>'
      : '<div>Fixed Δθ: each loop is exactly ' + daysPerLoop + ' days, so loops = 366 ÷ ' + daysPerLoop + ' ≈ ' + loops + ', and the loop count changes with "1 loop = X".</div>');
  }

  mount.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      mount.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
      void svg.offsetWidth; // 强制重排后再重绘（不用 rAF）
      render();
    });
  });
  equalBox.addEventListener('change', () => { equalArc = equalBox.checked; render(); });
  mount.querySelector('[data-mode="season"]').classList.add('is-active');
  render();
};

/* =========================================================
 * 5.5 · Storyline 生命线（d-5-5）
 * ======================================================= */
DEMOS['d-5-5'] = function (mount) {
  // 数据：《侏罗纪公园》(1993, 127 分钟) 5 个角色的生命线（内联常量）
  const DATA = {
    duration: 127,
    characters: [
      { name: 'Alan Grant & Kids', token: 'var(--ch-1)', width: 4, points: [
        { time: 5, y: 80 }, { time: 18, y: 130 }, { time: 38, y: 180 }, { time: 65, y: 150 },
        { time: 78, y: 80 }, { time: 88, y: 110 }, { time: 105, y: 60 }, { time: 125, y: 40 }
      ] },
      { name: 'T-REX', token: 'var(--c-danger)', width: 6, points: [
        { time: 75, y: 280 }, { time: 78, y: 130 }, { time: 88, y: 200 }, { time: 100, y: 250 }, { time: 120, y: 290 }
      ] },
      { name: 'Raptors', token: 'var(--ch-6)', width: 4, points: [
        { time: 50, y: 320 }, { time: 80, y: 290 }, { time: 95, y: 230 }, { time: 108, y: 180 }, { time: 118, y: 100 }
      ] },
      { name: 'Malcolm', token: 'var(--ch-4)', width: 3, points: [
        { time: 22, y: 40 }, { time: 45, y: 90 }, { time: 70, y: 120 }, { time: 82, y: 130 },
        { time: 95, y: 200 }, { time: 120, y: 240 }
      ] },
      { name: 'Dilophosaurus', token: 'var(--ch-3)', width: 3, points: [
        { time: 38, y: 350 }, { time: 48, y: 320 }, { time: 58, y: 340 }
      ] }
    ],
    events: [
      { time: 78, y: 105, name: 'T-REX Attack', desc: 'T-REX breaks out of its pen and attacks Alan & Kids\' jeep (minute 78)' },
      { time: 48, y: 335, name: 'Nedry Incident', desc: 'Dilophosaurus attacks Nedry; the park\'s security system collapses (minute 48)' }
    ]
  };

  const W = 780, H = 460, M = { t: 30, r: 30, b: 44, l: 130 };
  const X = lin(0, DATA.duration, M.l, W - M.r);
  const Y = lin(0, 400, H - M.b, M.t);

  mount.innerHTML =
    '<div class="l5-ctrl">'
    + '<label class="l5-check">Curve tension <input type="range" data-role="alpha" min="0" max="1" step="0.1" value="0.5"><span class="val" data-role="alpha-val">0.5</span></label>'
    + '<span class="l5-status" data-role="status"></span>'
    + '</div>'
    + '<div class="demo-grid">'
    + '<div class="demo-stage"><div class="l5-wrap" data-role="sl-wrap">'
    + '<svg class="l5-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Storyline lifelines of five Jurassic Park characters"></svg>'
    + '<div class="l5-tip" hidden></div>'
    + '</div>'
    + '<div class="l5-legend" data-role="legend" style="margin-top:8px"></div>'
    + '</div>'
    + '<div class="demo-detail" data-role="detail"></div>'
    + '</div>'
    + '<p class="demo-note">The x axis maps movie time strictly proportionally; the y axis is not a numeric axis but a <strong>relationship axis</strong>: two lines drawing close = encounter / conflict, drawing apart = separation. A tension of 0.5 is the rule of thumb for narrative.</p>';

  const svg = mount.querySelector('.l5-svg');
  const tip = makeTip(mount.querySelector('[data-role="sl-wrap"]'), mount.querySelector('.l5-tip'));
  const legend = mount.querySelector('[data-role="legend"]');
  const detail = mount.querySelector('[data-role="detail"]');
  const alphaInput = mount.querySelector('[data-role="alpha"]');
  const alphaVal = mount.querySelector('[data-role="alpha-val"]');
  const status = mount.querySelector('[data-role="status"]');
  let alpha = 0.5;
  let active = null;

  // 点空白处 = 取消选中（只绑一次，避免重绘后重复绑定）
  svg.addEventListener('click', () => select(null));

  function render() {
    const p = [];
    for (let t = 0; t <= DATA.duration; t += 20) {
      const x = X(t);
      p.push('<line x1="' + x + '" x2="' + x + '" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:var(--c-line);stroke-width:1"/>');
      p.push('<text x="' + x + '" y="' + (H - M.b + 16) + '" text-anchor="middle" style="fill:var(--c-muted);font-size:10px">' + t + '</text>');
    }
    p.push('<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + (H - M.b) + '" y2="' + (H - M.b) + '" style="stroke:var(--c-line-2);stroke-width:1"/>');
    p.push('<text x="' + (W / 2) + '" y="' + (H - 10) + '" text-anchor="middle" style="fill:var(--c-muted);font-size:11px">Movie time (min) →</text>');
    p.push('<text x="8" y="' + (M.t + 10) + '" style="fill:var(--c-muted);font-size:11px">Character lifelines ↓</text>');

    DATA.characters.forEach((c, i) => {
      const pts = c.points.map((pt) => [X(pt.time), Y(pt.y)]);
      const d = smoothPath(pts, alpha);
      const dim = active !== null && active !== i;
      p.push('<path class="l5-line' + (dim ? ' is-dim' : '') + '" d="' + d + '" style="fill:none;stroke:' + c.token + ';stroke-width:' + (active === i ? c.width + 3 : c.width) + ';stroke-linecap:round;stroke-opacity:.9"/>');
      // 透明「命中层」：加宽到 16px，细线也好点中
      p.push('<path data-role="hit" data-i="' + i + '" d="' + d + '" style="fill:none;stroke:transparent;stroke-width:16;pointer-events:stroke"/>');
      const first = pts[0];
      p.push('<text x="' + (M.l - 10) + '" y="' + (first[1] + 4) + '" text-anchor="end" style="fill:' + c.token + ';font-size:12px;font-weight:600' + (dim ? ';opacity:.35' : '') + '">' + c.name + '</text>');
    });

    DATA.events.forEach((ev) => {
      const ex = X(ev.time), ey = Y(ev.y);
      p.push('<g data-role="event" data-name="' + ev.name + '" data-desc="' + ev.desc + '">'
        + '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="18" style="fill:color-mix(in srgb, var(--c-danger) 16%, transparent)"/>'
        + '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="4.5" style="fill:var(--c-danger)"/>'
        + '</g>');
    });

    svg.innerHTML = p.join('');

    svg.querySelectorAll('[data-role="hit"]').forEach((path) => {
      path.addEventListener('click', (ev) => { ev.stopPropagation(); select(+path.dataset.i); });
    });
    svg.querySelectorAll('[data-role="event"]').forEach((g) => {
      g.style.cursor = 'help';
      g.addEventListener('mousemove', (ev) => tip.show(ev, g.dataset.name + ' · ' + g.dataset.desc));
      g.addEventListener('mouseleave', () => tip.hide());
    });
  }

  function select(i) {
    active = i;
    render();
    updateDetail();
    updateStatus();
  }

  function updateDetail() {
    if (active === null) {
      detail.innerHTML = '<p style="color:var(--c-muted);font-size:13px">Click any lifeline (or the character name below) — its appearance interval and key nodes will show here.</p>';
      return;
    }
    const c = DATA.characters[active];
    const times = c.points.map((pt) => pt.time);
    const from = Math.min.apply(null, times);
    const to = Math.max.apply(null, times);
    const nodes = c.points.map((pt) => '<li>Minute ' + pt.time + ' (relationship position ' + pt.y + '/400)</li>').join('');
    const related = DATA.events.filter((ev) => ev.time >= from && ev.time <= to);
    detail.innerHTML =
      '<h4 style="color:' + c.token + ';margin:0 0 6px">' + c.name + '</h4>'
      + '<p style="margin:4px 0;font-size:13px"><b>Appearance interval:</b> minute ' + from + ' – ' + to + ' (' + (to - from) + ' min total)</p>'
      + '<p style="margin:4px 0;font-size:13px"><b>Key nodes:</b></p>'
      + '<ul class="l5-detail-list">' + nodes + '</ul>'
      + '<p style="margin:8px 0 0;font-size:13px"><b>Events within the interval:</b>' + (related.length ? related.map((ev) => ev.name).join(', ') : 'none') + '</p>';
  }

  function updateStatus() {
    status.textContent = 'Total ' + DATA.characters.length + ' lifelines · duration ' + DATA.duration + ' min · 2 key events · '
      + (active === null ? 'nothing selected (click a line or a legend item)' : 'highlighting: ' + DATA.characters[active].name);
  }

  DATA.characters.forEach((c, i) => {
    const item = document.createElement('label');
    item.className = 'l5-legend__item';
    item.innerHTML = '<span class="l5-swatch" style="background:' + c.token + '"></span><span>' + c.name + '</span>';
    item.addEventListener('click', () => select(active === i ? null : i));
    legend.appendChild(item);
  });

  alphaInput.addEventListener('input', () => {
    alpha = +alphaInput.value;
    alphaVal.textContent = alpha.toFixed(1);
    render(); // 只重算路径 d，不动选中态
  });

  updateDetail();
  updateStatus();
  render();
};

/* ---------------------------------------------------------
 * 3) 启动
 * ------------------------------------------------------- */
ensureDemoStyles();
window.DEMOS = DEMOS;
initLesson('Chapter 5 · Temporal Data', { lesson: 'lesson-05' });
