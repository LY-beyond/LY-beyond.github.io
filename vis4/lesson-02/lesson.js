// =========================================================
// lesson-02/lesson.js —— 第 2 章「数据可视化流程」的可运行演示
// ---------------------------------------------------------
// 约定（与 lesson-core.js 对接）：
//   ① 用 window.DEMOS['d-2-x'] = fn 注册演示
//   ② 页面用 <div class="demo-mount" data-demo="d-2-x"> 挂载
//   ③ 最后调用 initLesson('第 2 章 · 数据可视化流程', { lesson: 'lesson-02' })
//
// 依赖策略：本章演示全部用「原生 DOM + 内联 SVG」实现，不引入 D3 运行时。
//   ① 站点要求零构建、离线可用，不能把 d3 打包进仓库；
//   ② 本章要演示的是 D3 的「思想」（数据流 / rollup 聚合 / 树布局 / 事件委托），
//      用几十行的等价实现反而更能看清机制。真正的 D3 调用写在页面代码块里。
//
// 动画纪律：全程**禁用逐帧动画 API**（无头浏览器 / 后台标签页下
//   该 API 可能不触发，本项目踩过坑）。一律「强制重排 void el.offsetWidth →
//   切换 class → 交给 CSS transition」的同步手法，或用 setTimeout 分步。
// =========================================================

import { initLesson } from '../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) 本章演示专用样式（注入一次，不污染共享样式表）
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson02-styles')) return;
  const st = document.createElement('style');
  st.id = 'lesson02-styles';
  st.textContent = `
/* ---------- 2.1 数据流管道：逐段点亮 ---------- */
.l2-pipe-stage { cursor: pointer; opacity: .42;
  transition: opacity var(--dur-base) var(--ease), filter var(--dur-base) var(--ease); }
.l2-pipe-stage:hover { opacity: .78; filter: brightness(1.08); }
.l2-pipe-stage.is-on { opacity: 1; filter: brightness(1.06) saturate(1.04); }

/* ---------- 2.2 rollup 折叠：一层层收拢 ---------- */
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

/* ---------- 2.3 Reingold–Tilford 树布局 ---------- */
.l2-rt-node { transition: transform var(--dur-base) var(--ease); }
.l2-rt-node circle { transition: fill var(--dur-base) var(--ease); }
.l2-rt-node.is-hi circle { fill: var(--c-primary); }
.l2-rt-node.is-hi text { fill: var(--c-primary); font-weight: 700; }
.l2-rt-link { transition: opacity var(--dur-base) var(--ease); }

/* ---------- 2.4 事件委托冒泡示踪 ---------- */
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

/* 动效降级：本页演示区单独兜底 */
@media (prefers-reduced-motion: reduce) {
  .demo-mount, .demo-mount * { transition: none !important; animation: none !important; }
}
`;
  document.head.appendChild(st);
}

/* ---------------------------------------------------------
 * 1) 小工具：转义 / CSV 解析 / 迷你 group·rollup / 数据加载
 * ------------------------------------------------------- */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 极小 CSV 解析器：支持引号字段与 BOM（够本章 80 行数据用）
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

// 从班级名切出专业："软件工程1班" → "软件工程"（非贪婪匹配）
function majorFromClass(cls) {
  const m = String(cls).match(/^(.+?)(\d+班)$/);
  return m ? m[1].trim() : String(cls).trim();
}

// d3.group / d3.rollup 的最小等价实现（仅用于演示）
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

// 与页面关键代码里 d3.csv(url, row) 回调等价的加载 + 转换
async function loadStudents() {
  const res = await fetch('./data/newstudent.csv', { cache: 'no-store' });
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

// 加载失败时的统一提示（file:// 会被 CORS 拦截）
function corsHint(target, err) {
  if (!target) return;
  target.innerHTML = `
    <div class="callout callout--warn"><p><strong>数据加载失败：</strong>${esc(err && err.message || err)}</p></div>
    <p class="demo-note">以 <code>file://</code> 直接打开页面时，浏览器会以 CORS 拦截 <code>fetch</code>。
      请用本地 http 服务器打开（例如 <code>python -m http.server</code>）后重试。</p>`;
}

/* =========================================================
 * 演示 2.1 —— Card / Mackinlay / van Wijk 数据流管道图
 * ======================================================= */
DEMOS['d-2-1'] = (mount) => {
  const STAGES = [
    {
      cn: '① 原始数据', en: 'Raw Data', token: 'var(--ch-8)',
      duty: '数据源接入：把现实世界或数据库里的记录读进程序。',
      ops: ['读 CSV / JSON / DB', '字段映射（中文列名 → 英文变量）', '类型转换（一元 + / new Date）'],
      card: '管道起点：Raw Data —— 一切从这里开始',
      mack: '无需变换，直接交给下一步的 mapping pipeline',
      wijk: '用户最直接看到的「数据集」（CSV / JSON / 一张表）',
    },
    {
      cn: '② 数据表', en: 'Data Tables', token: 'var(--ch-3)',
      duty: '数据变换：把原始数据整理成干净、可按需聚合的数据表。',
      ops: ['filter：清洗与筛选', 'rollup / group：分组聚合', 'derive：派生新列（班级 → 专业）'],
      card: 'D 层：第一段箭头「原始数据 → 数据表」',
      mack: '先判定每个属性的数据类型（定量 / 有序 / 名义）',
      wijk: 'Transformations：决定接下来能看到什么',
    },
    {
      cn: '③ 视觉结构', en: 'Visual Structure', token: 'var(--ch-2)',
      duty: '视觉映射：把数据属性编码到图元与视觉通道上。',
      ops: ['选图元 mark：点 / 线 / 面', '选通道：位置 / 颜色 / 形状', '比例尺与坐标轴'],
      card: 'T 层：第二段箭头「数据表 → 视觉结构」',
      mack: '核心：按数据类型自动挑量化精度最高的通道',
      wijk: 'Mapping：把数据「翻译」成可读的视觉记号',
    },
    {
      cn: '④ 视图', en: 'Views', token: 'var(--c-success)',
      duty: '视图渲染 + 交互：把视觉结构画到屏幕上，并接收用户反馈。',
      ops: ['SVG / DOM 渲染', '事件：点击 / 悬停 / 拖拽', 'transition 过渡动画'],
      card: 'V 层：C（相机）/ L（光照）/ S（屏幕像素）',
      mack: '通道选定后，渲染阶段只负责忠实呈现',
      wijk: '反馈环：View → Filter → Param → Other Views',
    },
  ];

  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--primary" data-role="play">▶ 逐段点亮</button>
      <button type="button" class="demo-btn" data-role="reset">重置</button>
      <span class="demo-control">当前：<b class="val" data-role="cur">—</b></span>
    </div>
    <div class="demo-grid">
      <div>
        <svg viewBox="0 0 560 176" role="img" aria-label="数据流管道：原始数据 → 数据表 → 视觉结构 → 视图，四段可点选">
          <defs>
            <marker id="l2-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" style="fill: var(--c-primary);"/>
            </marker>
          </defs>
          ${STAGES.map((s, i) => {
            const bw = 112, gap = 26, x = 17 + i * (bw + gap), y = 40, h = 60;
            const mx = x + bw / 2;
            return `<g class="l2-pipe-stage" data-stage="${i}" role="button" tabindex="0"
                       aria-label="第 ${i + 1} 段 ${s.cn}">
              <rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="12"
                    style="fill: color-mix(in srgb, ${s.token} 18%, var(--c-surface)); stroke: ${s.token}; stroke-width: 1.6;"/>
              <text x="${mx}" y="${y + 26}" text-anchor="middle" style="fill: var(--c-text); font-size: 12.5px; font-weight: 700;">${s.cn}</text>
              <text x="${mx}" y="${y + 44}" text-anchor="middle" style="fill: var(--c-muted); font-size: 10.5px;">${s.en}</text>
            </g>`;
          }).join('')}
          <line x1="129" y1="70" x2="152" y2="70" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l2-arrow)"/>
          <line x1="267" y1="70" x2="290" y2="70" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l2-arrow)"/>
          <line x1="405" y1="70" x2="428" y2="70" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l2-arrow)"/>
          <text x="280" y="30" text-anchor="middle" style="fill: var(--c-primary); font-size: 10.5px; font-weight: 700;">变换 D→T</text>
          <text x="412" y="30" text-anchor="middle" style="fill: var(--c-primary); font-size: 10.5px; font-weight: 700;">映射 T→V</text>
          <text x="472" y="30" text-anchor="middle" style="fill: var(--c-primary); font-size: 10.5px; font-weight: 700;">渲染 V→C/L/S</text>
          <path d="M497 106 Q497 152 280 152 Q63 152 63 106" fill="none" stroke-dasharray="4 4"
                style="stroke: var(--c-warn); stroke-width: 1.3;"/>
          <text x="280" y="168" text-anchor="middle" style="fill: var(--c-warn); font-size: 10.5px; font-weight: 700;">交互反馈环 · van Wijk</text>
        </svg>
      </div>
      <div class="demo-detail" data-role="detail">← 点管道任意一段，看它的职责、典型操作，以及在三套模型里的对应。</div>
    </div>
    <p class="demo-note"><strong>怎么读这张图：</strong>管道四段由 Card 定顺序，Mackinlay 负责第 3 段的自动决策，van Wijk 用反馈环把第 4 段接回起点 —— <strong>三者叠加，不冲突</strong>。</p>
  `;

  const stages = [...mount.querySelectorAll('.l2-pipe-stage')];
  const detail = mount.querySelector('[data-role="detail"]');
  const cur = mount.querySelector('[data-role="cur"]');
  let timer = null;

  function showDetail(i) {
    const s = STAGES[i];
    cur.textContent = s.cn;
    detail.innerHTML = `
      <h4 style="color:${s.token}">${s.cn}（${s.en}）</h4>
      <p><strong>职责：</strong>${s.duty}</p>
      <p><strong>典型操作：</strong>${s.ops.map((o) => esc(o)).join(' · ')}</p>
      <p><strong>三套模型的对应：</strong></p>
      <p>· <b>Card</b>：${s.card}</p>
      <p>· <b>Mackinlay</b>：${s.mack}</p>
      <p>· <b>van Wijk</b>：${s.wijk}</p>`;
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
    detail.textContent = '← 点管道任意一段，看它的职责、典型操作，以及在三套模型里的对应。';
  });

  selectOnly(0);
};

/* =========================================================
 * 演示 2.2 —— d3.rollup 聚合动画（明细表 → 分组计数 → 嵌套聚合）
 * ======================================================= */
DEMOS['d-2-2'] = async (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn" data-role="prev">上一步</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">下一步 →</button>
      <button type="button" class="demo-btn" data-role="replay">重放</button>
      <span class="demo-control">共 <b class="val" data-role="count">—</b> 条</span>
    </div>
    <div class="demo-stage">
      <div class="l2-fold-stage" data-role="stage"><p class="demo-note">正在加载数据…</p></div>
    </div>
    <div class="l2-dots" data-role="dots"><b>步骤</b></div>
    <div class="console" data-role="log"></div>
    <p class="demo-note"><strong>要点：</strong>每加一层 key（<code>…keys</code> rest 参数），折叠就多收拢一级；返回值始终是 <code>Map</code>，嵌套 key 得到嵌套 Map。</p>
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

  const STEPS = ['① 明细表', '② 分组计数', '③ 嵌套聚合'];
  const CLS_TOKEN = ['var(--ch-1)', 'var(--ch-3)', 'var(--ch-2)', 'var(--ch-4)', 'var(--ch-5)', 'var(--ch-6)'];
  const classList = [...countByClass.keys()];
  const maxCount = Math.max(...countByClass.values());

  let step = 0;

  // 三个步骤各自的面板内容
  function panelHTML(s) {
    if (s === 0) {
      const rows = students.slice(0, 12);
      return `
        <div class="l2-fold-head">明细表 · 80 行 × 3 列 <span>（仅显示前 12 行）</span></div>
        <div class="table-scroll">
          <table class="mini-table">
            <thead><tr><th>序号</th><th>姓名</th><th>班级</th><th>性别</th></tr></thead>
            <tbody>${rows.map((d, i) => `<tr class="l2-fold-chip" style="--i:${i}">
              <td>${d.id}</td><td>${esc(d.name)}</td><td>${esc(d.class)}</td><td>${esc(d.gender)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`;
    }
    if (s === 1) {
      return `
        <div class="l2-fold-head">按「班级」分组计数 <span>d3.rollup(students, v =&gt; v.length, d =&gt; d.class)</span></div>
        ${classList.map((cls, i) => {
          const n = countByClass.get(cls);
          const pct = Math.round(n / maxCount * 100);
          return `<div class="l2-bucket l2-fold-chip" style="--i:${i}">
            <span style="flex:0 0 96px; font-size:12.5px; color:var(--c-text);">${esc(cls)}</span>
            <span class="l2-bucket__bar"><i style="width:${pct}%; background:${CLS_TOKEN[i % CLS_TOKEN.length]};"></i></span>
            <span class="l2-bucket__num">${n} 人</span>
          </div>`;
        }).join('')}`;
    }
    return `
      <div class="l2-fold-head">再按「性别」嵌套聚合 <span>Map(班级 → Map(性别 → 人数))</span></div>
      ${classList.map((cls, i) => {
        const inner = nested.get(cls);
        return `<div class="l2-nest l2-fold-chip" style="--i:${i}">
          <div class="l2-nest__t">${esc(cls)}</div>
          ${['男', '女'].filter((g) => inner.has(g)).map((g) =>
            `<div class="l2-nest__row"><span style="color:${CLS_TOKEN[i % CLS_TOKEN.length]};">└─</span> ${esc(g)}　<b style="color:var(--c-text);">${inner.get(g)}</b> 人</div>`
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
    void panel.offsetWidth;            // 强制重排，让初始态被记录
    panel.classList.add('is-in');      // 随即进入终态 → 过渡生效

    [...dotsEl.querySelectorAll('.l2-dot')].forEach((d, i) => d.classList.toggle('is-on', i <= step));

    const logs = [
      '步骤 1 / 3 · 明细表',
      '  原始数据：' + students.length + ' 条新生记录（8 列）',
      '',
      '步骤 2 / 3 · 分组计数',
      '  d3.rollup(students, v => v.length, d => d.class)',
      '  → Map(' + countByClass.size + ')：' + classList.map((c) => c + '=' + countByClass.get(c)).join('，'),
      '',
      '步骤 3 / 3 · 嵌套聚合',
      '  d3.rollup(students, v => v.length, d => d.class, d => d.gender)',
      '  → 嵌套 Map：',
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

  // 步骤指示点
  STEPS.forEach(() => {
    const d = document.createElement('span');
    d.className = 'l2-dot';
    dotsEl.appendChild(d);
  });

  render();
};

/* =========================================================
 * 演示 2.3 —— Reingold–Tilford 布局步进图
 * ======================================================= */
DEMOS['d-2-3'] = async (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn" data-role="prev">上一步</button>
      <button type="button" class="demo-btn demo-btn--primary" data-role="next">下一步 →</button>
      <button type="button" class="demo-btn" data-role="replay">重放</button>
    </div>
    <div class="demo-stage">
      <svg viewBox="0 0 600 240" role="img" data-role="svg"
           aria-label="一棵按班级与性别分组的小树，逐步演示 Reingold–Tilford 布局"></svg>
    </div>
    <div class="l2-dots" data-role="dots"><b>步骤</b></div>
    <p class="demo-note" data-role="desc">正在加载数据…</p>
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

  // 构建一棵小树：2025 级新生 → 班级 → 性别
  const root = { name: '2025 级新生', id: 'root', children: classList.map((cls, ci) => ({
    name: cls.replace(/班$/, '班'),
    id: 'c' + ci,
    children: ['男', '女'].filter((g) => byClass.get(cls).some((s) => s.gender === g)).map((g) => ({
      name: g + ' (' + byClass.get(cls).filter((s) => s.gender === g).length + ')',
      id: 'c' + ci + g,
    })),
  }))};

  // 自己实现一遍 Reingold–Tilford 的坐标计算（等价于 d3.tree()）
  let leafCursor = 0;
  function layout(node, depth) {
    node.depth = depth;
    if (!node.children) { node.x = leafCursor; leafCursor += 1; return node.x; }
    const xs = node.children.map((c) => layout(c, depth + 1));
    node.x = (Math.min(...xs) + Math.max(...xs)) / 2;   // 父节点居中于子节点
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

  // 三遍遍历对应的「当前 x 取到哪一步」
  function posFor(node, s) {
    if (s === 0) return centerX;                       // 未布局：全部挤在中轴
    if (s === 1) return node.children ? centerX : toX(node.x);  // 自底向上：叶子先铺开
    return toX(node.x);                                // 自顶向下：全部就位
  }

  // 建 SVG：先连线，后节点
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
    '① 未布局：所有节点都挤在父节点正下方 —— 互相重叠，看不出层级。这正是布局算法要解决的问题。',
    '② 第 1 遍（自底向上）：量出每棵子树需要多宽的横向空间 —— 叶子先按间距铺开。',
    '③ 第 2 遍（自顶向下）：给每个节点分配绝对 x 坐标 —— 父节点居中于它的子节点。',
    '④ 第 3 遍（收尾）：处理线程、补齐父子连线，得到最终树形 —— 用位置通道把层级编码完成。',
  ];
  let step = 0, linkTimer = null;

  function render() {
    const s = Math.min(step, 3);
    nodes.forEach((n) => {
      const g = nodeEls.get(n.id);
      g.style.transform = `translate(${posFor(n, s)}px, ${depthY[n.depth]}px)`;
      g.classList.toggle('is-hi', s === 2 && !!n.children);
      // 未就位的节点互相堆叠是教学点，但文字叠成一片不可读：只留圆点，标签等就位后再显现
      const label = g.querySelector('text');
      if (label) label.style.opacity = (s === 0 || (s === 1 && n.children)) ? '0' : '1';
    });

    // 连线：第 2 遍之后才淡入（等节点动画基本落位，避免短暂错位）
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
 * 演示 2.4 —— 事件委托冒泡示踪
 * ======================================================= */
DEMOS['d-2-4'] = (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--primary" data-role="sim">模拟一次点击</button>
      <button type="button" class="demo-btn" data-role="reset">重置</button>
      <label class="demo-control"><input type="checkbox" data-role="stop"> 在 li 层 <code>stopPropagation()</code></label>
      <label class="demo-control">列表项数
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
          <span class="l2-ed-tag">ul#list　·　事件委托监听器（1 个）</span>
          <div class="l2-ed-node" data-node="li">
            <span class="l2-ed-tag">li　·　行（可在此层 stopPropagation）</span>
            <span class="l2-ed-target" data-role="target">span.label ← 点这里</span>
          </div>
        </div>
      </div>
      <div class="demo-detail" data-role="log">点左侧的 span.label —— 事件会沿 DOM 树一层层向上冒泡到 ul 的委托监听器。</div>
    </div>

    <div class="demo-sub">
      <h4>监听器数量对比</h4>
      <div class="l2-cmp-row">
        <span class="l2-cmp-label">逐个绑定</span>
        <span class="l2-cmp-track" data-role="track-each"><i></i></span>
        <span class="l2-cmp-num" data-role="num-each">—</span>
      </div>
      <div class="l2-cmp-row">
        <span class="l2-cmp-label">事件委托</span>
        <span class="l2-cmp-track is-deleg" data-role="track-deleg"><i></i></span>
        <span class="l2-cmp-num" data-role="num-deleg">1</span>
      </div>
      <p class="demo-note" data-role="save"></p>
    </div>

    <p class="demo-note"><strong>机制：</strong>默认监听发生在<strong>冒泡阶段</strong>；在 li 上调用 <code>stopPropagation()</code> 会截断冒泡链，ul 的委托监听器就不再触发。</p>
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

  // 真实的 DOM 结构 + 真实的监听器：这才是事件委托与冒泡的实际行为
  function onTarget() {
    clearTimers();
    nodeEls.forEach((el) => el.classList.remove('is-cut'));
    flash('ul', 200); flash('li', 520);
    if (stopCb.checked) {
      target.classList.add('is-hit');
      timers.push(setTimeout(() => target.classList.remove('is-hit'), 420));
      timers.push(setTimeout(() => {
        nodeEls.get('li').classList.add('is-cut');
        logEl.innerHTML = `<strong>冒泡被截断：</strong>
          <p>e.target = <code>span.label</code>（目标元素）</p>
          <p>· 事件从 span 冒泡到 <code>li</code> 时，li 的监听器调用了 <code>e.stopPropagation()</code></p>
          <p>· 冒泡链在此<strong>断开</strong> → 上层 <code>ul</code> 的委托监听器<strong>不会触发</strong></p>
          <p>这就是「点折叠箭头不应触发选行」靠的机制。</p>`;
      }, 900));
    } else {
      target.classList.add('is-hit');
      timers.push(setTimeout(() => target.classList.remove('is-hit'), 420));
      timers.push(setTimeout(() => {
        logEl.innerHTML = `<strong>冒泡路径：</strong>
          <p>e.target = <code>span.label</code>（最先命中的目标元素）</p>
          <p>· span.label → li → ul（逐层向上冒泡）</p>
          <p>· <code>ul</code> 上的<strong>唯一</strong>委托监听器接住事件，用 <code>e.target.closest("li")</code> 定位到这一行</p>
          <p>· 全程只有 1 个监听器，就完成了「无论点 span 还是 li 都能识别是哪一行」</p>`;
      }, 1200));
    }
  }

  target.addEventListener('click', onTarget);
  mount.querySelector('[data-role="sim"]').addEventListener('click', onTarget);
  mount.querySelector('[data-role="reset"]').addEventListener('click', () => {
    clearTimers();
    nodeEls.forEach((el) => el.classList.remove('is-hit', 'is-cut'));
    target.classList.remove('is-hit');
    logEl.textContent = '点左侧的 span.label —— 事件会沿 DOM 树一层层向上冒泡到 ul 的委托监听器。';
  });

  function updateCompare() {
    const n = +nSel.value;
    mount.querySelector('[data-role="num-each"]').textContent = n;
    mount.querySelector('[data-role="num-deleg"]').textContent = '1';
    mount.querySelector('[data-role="track-each"] i').style.width = '100%';
    mount.querySelector('[data-role="track-deleg"] i').style.width = Math.max(2, 100 / n) + '%';
    mount.querySelector('[data-role="save"]').textContent =
      `N = ${n} 时，逐个绑定要 ${n} 个监听器，事件委托只要 1 个 —— 省下 ${n - 1} 个，且第 ${n + 1} 个条目新增时无需再绑。`;
  }
  nSel.addEventListener('change', updateCompare);
  updateCompare();
};

/* =========================================================
 * 启动
 * ======================================================= */
/* =========================================================
 * 原创演示 2.x —— 图形规范生成器（迷你图形语法）
 *   把字段分配到通道（X / Y / 颜色）+ 选标记类型，
 *   实时渲染图表并同步生成「图形规范 JSON」。
 *   教学点：可视化流程的本质 = 数据 → 规范 → 渲染，
 *   一次点选就是一次规范改写，正是 Vega-Lite 的思想内核。
 * ======================================================= */
DEMOS['d-2-x'] = async (mount) => {
  let students;
  try { students = await loadStudents(); } catch (e) { corsHint(mount, e); return; }

  // 私有样式（一次性注入）
  if (!document.getElementById('l2x-styles')) {
    const st = document.createElement('style');
    st.id = 'l2x-styles';
    st.textContent = `
.l2x-wrap { display: grid; grid-template-columns: 1fr 220px; gap: 14px; align-items: start; }
@media (max-width: 720px) { .l2x-wrap { grid-template-columns: 1fr; } }
.l2x-cap { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--c-text-soft); }
.l2x-spec { margin: 0; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--c-surface-2); border: 1px solid var(--c-line); font-family: var(--font-mono); font-size: 11px; line-height: 1.65; color: var(--c-text); overflow: auto; max-height: 300px; white-space: pre; }
.l2x-hint { margin: 8px 0 0; font-size: 11.5px; color: var(--c-muted); }
`;
    document.head.appendChild(st);
  }

  const PALETTE = ['var(--ch-2)', 'var(--ch-4)', 'var(--ch-6)', 'var(--ch-8)'];

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">标记
        <select data-role="mark"><option value="bar">bar · 条形</option><option value="point">point · 点</option></select>
      </label>
      <label class="demo-control">X 通道
        <select data-role="x"><option value="gender">性别</option><option value="major">专业</option><option value="class">班级</option></select>
      </label>
      <label class="demo-control">Y 聚合
        <select data-role="y"><option value="count">人数 count</option><option value="ageMean">平均年龄 mean(age)</option></select>
      </label>
      <label class="demo-control">颜色
        <select data-role="color"><option value="">（无）</option><option value="gender">性别</option><option value="major">专业</option></select>
      </label>
    </div>
    <div class="l2x-wrap" style="margin-top:12px">
      <div>
        <p class="l2x-cap">渲染结果（由规范现场驱动）</p>
        <div data-role="chart"></div>
      </div>
      <div>
        <p class="l2x-cap">图形规范 spec.json</p>
        <pre class="l2x-spec" data-role="spec"></pre>
        <p class="l2x-hint">改一个下拉 = 改一条规范 → 图形重画。图表不是「画」出来的，是「被规范描述」出来的。</p>
      </div>
    </div>
    <p class="demo-note"><strong>对应流程理论：</strong>这几十行演示 = Card 管道的后半段——「数据变换」（rollup 聚合）→「视觉映射」（字段 → 通道）→「视图生成」（SVG 现场构建）。Vega-Lite、Plot、Tableau 的拖放界面，本质都是在帮你写这份 spec。</p>
  `;

  const els = {
    mark: mount.querySelector('[data-role="mark"]'),
    x: mount.querySelector('[data-role="x"]'),
    y: mount.querySelector('[data-role="y"]'),
    color: mount.querySelector('[data-role="color"]'),
    chart: mount.querySelector('[data-role="chart"]'),
    spec: mount.querySelector('[data-role="spec"]'),
  };

  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function render() {
    const mark = els.mark.value;
    const xKey = els.x.value;
    const yKey = els.y.value;
    const colorKey = els.color.value;

    // ---- 1) 数据变换：rollup 聚合（规范里的 y.aggregate）----
    const xVals = [...new Set(students.map((d) => d[xKey]))];
    const cVals = colorKey ? [...new Set(students.map((d) => d[colorKey]))] : [null];
    const cell = new Map(); // "xVal|cVal" -> number
    let yMax = 0;
    for (const xv of xVals) {
      for (const cv of cVals) {
        const grp = students.filter((d) => d[xKey] === xv && (!colorKey || d[colorKey] === cv));
        let v = 0;
        if (yKey === 'count') v = grp.length;
        else v = grp.length ? grp.reduce((s, d) => s + d.age, 0) / grp.length : 0;
        cell.set(xv + '|' + cv, v);
        if (v > yMax) yMax = v;
      }
    }
    yMax = Math.max(yMax, 1) * 1.15;

    // ---- 2) 规范 JSON：与右侧面板同步 ----
    const spec = {
      data: 'newstudent.csv',
      mark,
      encoding: {
        x: { field: xKey, type: 'nominal' },
        y: yKey === 'count'
          ? { aggregate: 'count', type: 'quantitative' }
          : { field: 'age', aggregate: 'mean', type: 'quantitative' },
      },
    };
    if (colorKey) spec.encoding.color = { field: colorKey, type: 'nominal' };
    els.spec.textContent = JSON.stringify(spec, null, 2);

    // ---- 3) 视图生成：现场构建 SVG ----
    const W = 380, H = 250, L = 40, R = 10, T = 26, B = 40;
    const iw = W - L - R, ih = H - T - B;
    const nX = xVals.length, nC = cVals.length;
    const bandW = iw / nX;
    const cellW = bandW / nC;
    const yOf = (v) => T + ih - (v / yMax) * ih;

    let g = '';
    // Y 网格与刻度
    for (let i = 0; i <= 4; i++) {
      const v = (yMax / 4) * i;
      const y = yOf(v);
      g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" style="stroke: var(--c-line); stroke-width: 1; opacity: .55"/>`
        + `<text x="${L - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" style="fill: var(--c-muted); font-size: 9.5px; font-family: var(--font-mono);">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`;
    }
    // X 轴标签
    xVals.forEach((xv, i) => {
      g += `<text x="${(L + bandW * (i + 0.5)).toFixed(1)}" y="${H - 14}" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 10px;">${esc(truncate(String(xv), 6))}</text>`;
    });
    // 图形主体（按颜色序列分组错位）
    cVals.forEach((cv, ci) => {
      const fill = colorKey ? PALETTE[ci % PALETTE.length] : 'var(--c-primary)';
      xVals.forEach((xv, xi) => {
        const v = cell.get(xv + '|' + cv) || 0;
        const cx = L + bandW * xi + cellW * (ci + 0.5);
        if (mark === 'bar') {
          const y = yOf(v);
          g += `<rect x="${(cx - Math.min(cellW * 0.62, 22) / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.min(cellW * 0.62, 22).toFixed(1)}" height="${(T + ih - y).toFixed(1)}" rx="3" style="fill: ${fill}; opacity: .88;"/>`;
        } else {
          g += `<circle cx="${cx.toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="${Math.max(3.5, Math.min(cellW * 0.22, 7)).toFixed(1)}" style="fill: ${fill}; opacity: .88;"/>`;
        }
      });
    });
    // 图例
    if (colorKey) {
      cVals.forEach((cv, ci) => {
        g += `<rect x="${L + 4 + ci * 78}" y="6" width="9" height="9" rx="2" style="fill: ${PALETTE[ci % PALETTE.length]};"/>`
          + `<text x="${L + 17 + ci * 78}" y="14" style="fill: var(--c-text-soft); font-size: 9.5px;">${esc(truncate(String(cv), 7))}</text>`;
      });
    } else {
      g += `<text x="${L + 4}" y="14" style="fill: var(--c-muted); font-size: 9.5px;">颜色通道：未映射</text>`;
    }
    // 轴线
    g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${T + ih}" style="stroke: var(--c-text-soft); stroke-width: 1"/>`
      + `<line x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}" style="stroke: var(--c-text-soft); stroke-width: 1"/>`;
    els.chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="由图形规范驱动的${mark === 'bar' ? '条形' : '点'}图" style="width:100%;height:auto">${g}</svg>`;
  }

  [els.mark, els.x, els.y, els.color].forEach((s) => s.addEventListener('change', render));
  render();
};

/* =========================================================
 * 启动
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('第 2 章 · 数据可视化流程', { lesson: 'lesson-02' });


