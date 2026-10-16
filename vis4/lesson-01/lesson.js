// =========================================================
// lesson-01/lesson.js —— 第 1 章「数据」的可运行演示
// ---------------------------------------------------------
// 约定（与 lesson-core.js 对接）：
//   ① 用 window.DEMOS['d-1-x'] = fn 注册演示
//   ② 页面用 <div class="demo-mount" data-demo="d-1-x"> 挂载
//   ③ 最后调用 initLesson('第 1 章 · 数据', { lesson: 'lesson-01' })
//
// 依赖策略：本章演示全部用「原生 DOM + 内联 SVG」实现，不引入 D3 运行时。
//   原因有三：① 站点要求零构建、离线可用；② 不能让 300KB 的 d3 打包进仓库；
//   ③ 本章要演示的正是 D3 的「思想」（数据流 / 三态 / 比例尺），
//   用 40 行的等价实现反而更能看清机制。真正的 D3 调用写在代码块里。
// =========================================================

import { initLesson } from '../lesson-core.js';

const DEMOS = {};

/* ---------------------------------------------------------
 * 0) 本章演示专用样式（注入一次）
 *    章节页只引 tokens.css + lesson.css，所以章节私有的
 *    动画 / 交互样式在这里注入，不污染共享样式表。
 * ------------------------------------------------------- */
function ensureDemoStyles() {
  if (document.getElementById('lesson01-styles')) return;
  const st = document.createElement('style');
  st.id = 'lesson01-styles';
  st.textContent = `
/* 数据流管：一个沿轨道跑动的光点 */
.l1-flow-dot { animation: l1Flow 1.7s linear infinite; }
@keyframes l1Flow { from { transform: translateX(0); } to { transform: translateX(520px); } }

/* DIKW 金字塔：hover / 选中提亮 */
.l1-dikw-layer { cursor: pointer; transition: filter var(--dur-fast) var(--ease); }
.l1-dikw-layer:hover { filter: brightness(1.14) saturate(1.08); }
.l1-dikw-layer.is-on  { filter: brightness(1.2) saturate(1.1); }

/* Data-Join 三态圆点（复用 lesson.css 的 .box 基底） */
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
`;
  document.head.appendChild(st);
}

/* ---------------------------------------------------------
 * 1) 小工具：转义 / CSV 解析 / 迷你 d3 数组函数
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

// 把二维数组变成对象数组（表头 → key）
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

// 与页面「关键代码」里 transformRow 完全等价的实现
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

// d3 的 8 个数组函数 + group / rollup 的最小等价实现（用于演示）
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
 * 演示 1.1 —— 数据加载 + 字段映射 + 类型验证
 * ======================================================= */
DEMOS['d-1-1'] = async (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--primary" data-role="reload">重新加载</button>
      <span class="demo-control">记录数 <b class="val" data-role="count">—</b></span>
    </div>
    <div class="console" data-role="log">等待加载…</div>
    <div class="demo-sub">
      <h4>转换后数据（前 10 行）</h4>
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
    say('⏳ 加载 ./data/newstudent.csv …');
    try {
      const res = await fetch('./data/newstudent.csv', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = toObjects(parseCSV(await res.text())).map(transformRow);
      countEl.textContent = data.length;

      say('✓ 共 ' + data.length + ' 条（已按 transformRow 逐行转换）');
      say('');
      say('【类型验证】');
      say('  typeof data[0].age              → ' + typeof data[0].age);
      say('  data[0].birthday instanceof Date → ' + (data[0].birthday instanceof Date));
      say('  data[0].age + 1                 → ' + (data[0].age + 1) + '（Number 可参与计算）');
      say('  typeof data[0].class            → ' + typeof data[0].class + '（trim 后无尾随空格）');
      say('');
      say('【前 3 条】');
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
      say('✗ 加载失败：' + (err && err.message || err));
      say('');
      say('提示：用 file:// 直接打开页面时，浏览器会以 CORS 拦截 fetch。');
      say('     请用本地静态服务器打开（例如 python -m http.server）后重试。');
    }
  }

  mount.querySelector('[data-role="reload"]').addEventListener('click', run);
  await run();
};

/* =========================================================
 * 演示 1.2 —— DIKW 交互金字塔
 * ======================================================= */
DEMOS['d-1-2'] = (mount) => {
  const W = 560, H = 348, cx = W / 2;
  const LAYERS = [
    { cn: '智慧', en: 'Wisdom', token: 'var(--ch-4)', topW: 70, h: 64, yTop: 14,
      desc: '运用知识做出明智判断与战略决策。',
      asks: '为什么 / 应该怎么做',
      viz: '战略仪表盘、决策树',
      edge: '❌ 超出可视化的能力范围' },
    { cn: '知识', en: 'Knowledge', token: 'var(--ch-1)', topW: 106, h: 76, yTop: 78,
      desc: '对信息进一步提炼，形成模式、规律、关联。',
      asks: '如何',
      viz: '统计模型、机器学习预测',
      edge: '⚠️ 需要统计模型辅助，单靠图形很难到达' },
    { cn: '信息', en: 'Information', token: 'var(--ch-3)', topW: 142, h: 88, yTop: 154,
      desc: '经过处理、组织、赋予上下文的数据。',
      asks: '谁 / 什么 / 何时 / 何地',
      viz: '折线图、柱状图、热力图',
      edge: '✅ 可视化的主战场' },
    { cn: '数据', en: 'Data', token: 'var(--ch-8)', topW: 178, h: 96, yTop: 242,
      desc: '原始、离散的观察结果，缺乏上下文与意义。',
      asks: '—（还没有上下文）',
      viz: '原始表格、CSV 文件',
      edge: '起点：一切都从这里开始' },
  ];

  mount.innerHTML = `
    <div class="demo-grid">
      <div>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="DIKW 金字塔：自下而上依次是数据、信息、知识、智慧四层">
          ${LAYERS.map((L, i) => {
            const botW = L.topW + 36;
            const yBot = L.yTop + L.h;
            const d = `M ${cx - L.topW / 2} ${L.yTop} L ${cx + L.topW / 2} ${L.yTop}`
                    + ` L ${cx + botW / 2} ${yBot} L ${cx - botW / 2} ${yBot} Z`;
            return `<g class="l1-dikw-layer" data-layer="${i}" role="button" tabindex="0"
                       aria-label="${L.cn}层 ${L.en}">
              <path d="${d}" style="fill: ${L.token};"/>
              <text x="${cx}" y="${(L.yTop + yBot) / 2}" text-anchor="middle"
                    dominant-baseline="middle"
                    style="fill: var(--c-on-primary); font-size: 15px; font-weight: 700;">${L.cn} · ${L.en}</text>
            </g>`;
          }).join('')}
        </svg>
      </div>
      <div class="demo-detail" data-role="detail">← 点击金字塔任意一层，看它「回答什么问题、对应什么可视化」</div>
    </div>
    <p class="demo-note">自下而上：数据 → 信息 → 知识 → 智慧。<strong>可视化主要把「数据」升到「信息」</strong>（下方两层的交界处），再往上就要靠统计模型与决策判断。</p>
  `;

  const detail = mount.querySelector('[data-role="detail"]');
  const layers = [...mount.querySelectorAll('.l1-dikw-layer')];

  function show(i) {
    const L = LAYERS[i];
    layers.forEach((g, j) => g.classList.toggle('is-on', j === i));
    detail.innerHTML = `
      <h4 style="color:${L.token}">${L.cn}（${L.en}）</h4>
      <p>${L.desc}</p>
      <p><strong>回答的问题：</strong>${L.asks}</p>
      <p><strong>典型可视化：</strong>${L.viz}</p>
      <p><span class="pill ${i <= 1 ? 'pill--ok' : i === 2 ? 'pill--warn' : 'pill--no'}">
        ${L.cn === '信息' ? '可视化主战场' : L.cn === '数据' ? '起点' : L.cn === '知识' ? '需模型辅助' : '超出范围'}
      </span> ${L.edge}</p>`;
  }

  layers.forEach((g) => {
    g.addEventListener('click', () => show(+g.dataset.layer));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(+g.dataset.layer); }
    });
  });
  show(1); // 默认选中「信息」层，直接点题
};

/* =========================================================
 * 演示 1.3 —— 属性 × 视觉通道（3 个正确匹配 + 1 个错配）
 * ======================================================= */
DEMOS['d-1-3'] = (mount) => {
  const DATA = [
    { name: '张三', major: '软件工程', age: 18 },
    { name: '李四', major: '软件工程', age: 19 },
    { name: '王五', major: '软件工程', age: 20 },
    { name: '赵六', major: '软件工程', age: 17 },
    { name: '孙七', major: '数据科学', age: 21 },
    { name: '周八', major: '数据科学', age: 22 },
    { name: '吴九', major: '数据科学', age: 19 },
  ];
  const HUE = { '软件工程': 'var(--ch-1)', '数据科学': 'var(--ch-3)' };

  mount.innerHTML = `
    <div class="demo-sub is-good">
      <h4>① 名义 → 色相（✓ 正确）</h4>
      <p class="demo-note">专业是类别，没有顺序 —— 用不同的<strong>色相</strong>区分最合适。</p>
      <svg viewBox="0 0 600 108" role="img" aria-label="按专业用不同颜色区分的方块图">
        ${DATA.map((d, i) => {
          const x = 30 + i * 80;
          return `<rect x="${x}" y="14" width="62" height="46" rx="8" style="fill: ${HUE[d.major]};"/>
                  <text x="${x + 31}" y="80" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11.5px;">${d.name}</text>`;
        }).join('')}
        <text x="30" y="102" style="fill: var(--c-muted); font-size: 11px;">■ 软件工程（--ch-1）&nbsp;&nbsp;■ 数据科学（--ch-3）</text>
      </svg>
    </div>

    <div class="demo-sub is-good">
      <h4>② 序数 → 亮度（✓ 正确）</h4>
      <p class="demo-note">等级 1→5 有顺序但无间距 —— 用<strong>亮度</strong>的深浅表达顺序。</p>
      <svg viewBox="0 0 600 74" role="img" aria-label="五个等级用从浅到深的亮度块表示">
        ${[1, 2, 3, 4, 5].map((lv, i) => {
          const x = 30 + i * 110;
          const mix = 8 + i * 20;   // 8% → 88%，越深代表等级越高
          return `<rect x="${x}" y="14" width="92" height="40" rx="8"
                    style="fill: color-mix(in srgb, var(--c-text) ${mix}%, var(--c-surface));"/>
                  <text x="${x + 46}" y="40" text-anchor="middle"
                    style="fill: ${i >= 3 ? 'var(--c-on-primary)' : 'var(--c-text)'}; font-size: 12px; font-weight: 700;">等级 ${lv}</text>`;
        }).join('')}
      </svg>
    </div>

    <div class="demo-sub is-good">
      <h4>③ 比率 → 位置（✓ 正确）</h4>
      <p class="demo-note">年龄是比率数据 —— 映射到<strong>位置</strong>后，谁大谁小、差多少，一眼可读。</p>
      <svg viewBox="0 0 600 208" role="img" aria-label="七名学生按年龄在水平位置轴上的点图">
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
        <text x="590" y="168" text-anchor="end" style="fill: var(--c-muted); font-size: 11px;">年龄 →</text>
      </svg>
    </div>

    <div class="demo-sub is-bad">
      <h4>④ ❌ 比率 → 色相（错配：看不出大小）</h4>
      <p class="demo-note">把年龄塞进<strong>色相</strong>（彩虹色阶）—— 颜色虽多，但读者无法判断「哪个年龄更大」，且对色觉缺陷读者完全失效。</p>
      <svg viewBox="0 0 600 108" role="img" aria-label="同一组年龄用彩虹色相编码的错误示范">
        ${DATA.map((d, i) => {
          const x = 30 + i * 80;
          const hue = (d.age - 17) / 5 * 300;   // 故意用彩虹色阶：这正是要避免的做法
          return `<rect x="${x}" y="14" width="62" height="46" rx="8" style="fill: hsl(${hue} 85% 52%);"/>
                  <text x="${x + 31}" y="80" text-anchor="middle" style="fill: var(--c-text-soft); font-size: 11.5px;">${d.name}（${d.age}）</text>`;
        }).join('')}
      </svg>
    </div>

    <p class="demo-note">结论：同样一份数据，<strong>选对通道</strong>就能读出差值与顺序；选错通道则只剩「花花绿绿」。这就是 Stevens × Mackinlay 匹配矩阵的实际意义。</p>
  `;
};

/* =========================================================
 * 演示 1.4 —— 8 个变换函数 + 数据流管
 * ======================================================= */
DEMOS['d-1-4'] = (mount) => {
  const SAMPLE_STUDENTS = [
    { c: '1班', n: 1 }, { c: '1班', n: 2 }, { c: '2班', n: 3 }, { c: '2班', n: 4 },
  ];
  const SPECS = {
    map:        { input: '[1, 2, 3, 4]',               hint: '把每个元素平方',              run: () => mini.map([1, 2, 3, 4], (x) => x * x) },
    reduce:     { input: '[1, 2, 3, 4]',               hint: '把所有元素求和',              run: () => mini.reduce([1, 2, 3, 4], (a, b) => a + b, 0) },
    cross:      { input: '["A","B"] × [1, 2]',         hint: '两个集合的笛卡尔积',          run: () => mini.cross(['A', 'B'], [1, 2]) },
    merge:      { input: '[[1,2], [3,4], [5]]',        hint: '多层数组拍平成一维',          run: () => mini.merge([[1, 2], [3, 4], [5]]) },
    pairs:      { input: '[1, 2, 3, 4]',               hint: '相邻元素两两成对',            run: () => mini.pairs([1, 2, 3, 4]) },
    transpose:  { input: '[[1,2,3], [4,5,6]]',         hint: '矩阵转置（行列互换）',        run: () => mini.transpose([[1, 2, 3], [4, 5, 6]]) },
    zip:        { input: '["A","B","C"] + [1, 2, 3]',  hint: '按位把多个数组合并',          run: () => mini.zip(['A', 'B', 'C'], [1, 2, 3]) },
    filter:     { input: '[1, 2, 3, 4, 5]',            hint: '只保留大于 2 的',             run: () => mini.filter([1, 2, 3, 4, 5], (x) => x > 2) },
    group:      { input: '4 条学生记录',                hint: '按班级分组，保留所有元素 ★',  run: () => mini.group(SAMPLE_STUDENTS, (d) => d.c) },
    rollup:     { input: '4 条学生记录',                hint: '按班级聚合，只留人数 ★',      run: () => mini.rollup(SAMPLE_STUDENTS, (v) => v.length, (d) => d.c) },
  };
  const ORDER = ['map', 'reduce', 'cross', 'merge', 'pairs', 'transpose', 'zip', 'filter', 'group', 'rollup'];

  mount.innerHTML = `
    <div class="demo-controls">
      <label class="demo-control">选择函数：
        <select data-role="sel">
          ${ORDER.map((k) => `<option value="${k}">d3.${k}</option>`).join('')}
        </select>
      </label>
      <span class="demo-control" data-role="hint"></span>
    </div>

    <svg viewBox="0 0 640 140" role="img" aria-label="数据流管：输入数组经过一个变换函数后得到输出数组">
      <defs>
        <marker id="l1-arrow" viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" style="fill: var(--c-primary);"/>
        </marker>
      </defs>

      <rect x="2" y="34" width="122" height="58" rx="10"
            style="fill: var(--c-surface-2); stroke: var(--c-border-2);"/>
      <text x="63" y="58" text-anchor="middle" style="fill: var(--c-text); font-size: 12px; font-weight: 700;">输入</text>
      <text x="63" y="76" text-anchor="middle" data-role="in" style="fill: var(--c-muted); font-size: 11px;">—</text>

      <line x1="126" y1="63" x2="212" y2="63" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l1-arrow)"/>

      <rect x="216" y="28" width="208" height="70" rx="10"
            style="fill: color-mix(in srgb, var(--c-primary) 12%, transparent); stroke: color-mix(in srgb, var(--c-primary) 45%, transparent);"/>
      <text x="320" y="58" text-anchor="middle" data-role="fn" style="fill: var(--c-primary); font-size: 15px; font-weight: 800;">d3.map</text>
      <text x="320" y="78" text-anchor="middle" data-role="hint2" style="fill: var(--c-text-soft); font-size: 11px;">逐元素变换</text>

      <line x1="426" y1="63" x2="512" y2="63" style="stroke: var(--c-primary); stroke-width: 1.6;" marker-end="url(#l1-arrow)"/>

      <rect x="516" y="34" width="122" height="58" rx="10"
            style="fill: color-mix(in srgb, var(--c-success) 12%, transparent); stroke: color-mix(in srgb, var(--c-success) 45%, transparent);"/>
      <text x="577" y="58" text-anchor="middle" style="fill: var(--c-text); font-size: 12px; font-weight: 700;">输出</text>
      <text x="577" y="76" text-anchor="middle" data-role="out" style="fill: var(--c-muted); font-size: 11px;">—</text>

      <line x1="60" y1="124" x2="580" y2="124" style="stroke: var(--c-line); stroke-width: 1.2;"/>
      <circle class="l1-flow-dot" cx="60" cy="124" r="4"
              style="fill: var(--c-primary);"/>
    </svg>

    <div class="console" data-role="log"></div>
    <p class="demo-note"><strong>要点：</strong>每个函数都返回<em>新</em>数组，输入数组本身不变 —— 所以可以放心地一层层接下去（这就是「数据流管」的含义）。</p>
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
    logEl.textContent = '输入：' + s.input + '\n输出：' + pretty;
  }

  sel.addEventListener('change', (e) => show(e.target.value));
  show('map');
};

/* =========================================================
 * 演示 1.5 —— Data-Join 三态（enter / update / exit）
 * ======================================================= */
DEMOS['d-1-5'] = (mount) => {
  mount.innerHTML = `
    <div class="demo-controls">
      <button type="button" class="demo-btn" data-act="add">+ 添加</button>
      <button type="button" class="demo-btn" data-act="update">⇆ 更新数值</button>
      <button type="button" class="demo-btn" data-act="remove">− 删除</button>
      <button type="button" class="demo-btn" data-act="reset">重置</button>
    </div>
    <p class="demo-control">当前数据：<code data-role="state">[1, 2, 3]</code></p>

    <div class="demo-stage">
      <div class="l1-join-row" data-role="row"></div>
    </div>

    <div class="demo-legend">
      <span style="color: var(--c-success)"><i></i>enter · 新增元素</span>
      <span style="color: var(--ch-1)"><i></i>update · 已有元素</span>
      <span style="color: var(--c-danger)"><i></i>exit · 待删除元素</span>
    </div>
    <p class="demo-note">点「添加」新元素以<strong>绿色</strong>进入；「更新」把已有元素标为<strong>蓝色</strong>；「删除」时多余元素先变<strong>红色</strong>再收缩消失 —— 这就是 <code>.join(enter, update, exit)</code> 的三个分支。</p>
  `;

  const row = mount.querySelector('[data-role="row"]');
  const stateEl = mount.querySelector('[data-role="state"]');
  let data = [1, 2, 3];

  /* 用「id → DOM 元素」的映射模拟 D3 的 data join：
     新出现的 id = enter，仍存在的 id = update，消失的 id = exit。

     动画启动刻意不用 requestAnimationFrame：它在后台标签页 / headless
     环境里可能不触发，导致元素停在初始态（本项目已有过一次教训）。
     改用「强制重排（读 offsetWidth）→ 立刻改类名」这一同步手法。 */
  function join() {
    // 正在退出（is-exit）的元素视为「已不存在」，否则紧接着重新加入同一 id
    // 会被误判成 update，导致复用了一个正在消失的元素。
    const exiting = new Map(
      [...row.querySelectorAll('.l1-join-dot.is-exit')].map((el) => [el.dataset.id, el])
    );
    const existing = new Map(
      [...row.querySelectorAll('.l1-join-dot:not(.is-exit)')].map((el) => [el.dataset.id, el])
    );
    const next = new Map();

    // enter：数据里有、DOM 里没有 → 新建
    data.forEach((v) => {
      const id = String(v);
      if (existing.has(id)) return;
      const stale = exiting.get(id);
      if (stale) stale.remove();            // 清掉同名残留，避免出现两个同 id 节点
      const el = document.createElement('div');
      el.className = 'box l1-join-dot is-enter is-hidden';
      el.dataset.id = id;
      el.textContent = id;
      row.appendChild(el);
      void el.offsetWidth;                  // 强制重排，让初始态被记录
      el.classList.remove('is-hidden');     // 随即进入终态 → 过渡生效
      next.set(id, el);
    });

    // update：两边都有 → 改属性（这里改颜色）
    data.forEach((v) => {
      const id = String(v);
      const el = existing.get(id);
      if (!el) return;
      el.classList.remove('is-enter');
      el.classList.add('is-update');
      next.set(id, el);
    });

    // exit：DOM 里有、数据里没有 → 先变红，再收缩移除
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
 * 启动
 * ======================================================= */
ensureDemoStyles();
window.DEMOS = DEMOS;

initLesson('第 1 章 · 数据', { lesson: 'lesson-01' });
