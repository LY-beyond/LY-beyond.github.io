// =========================================================
// chart-help.js —— 「选图指南」专题页的交互（中英两版共享）
// ---------------------------------------------------------
// 本页不是章节页，因此不加载 lesson-core.js；这里自备三件事：
//   ① 决策树向导：树与结果卡的数据 + 渲染 + 前进/后退
//   ② 小测判分：与章节页完全相同的 .selftest 契约，另加总分条
//   ③ 侧栏目录滚动高亮 + 学习目标勾选（复用 progress.js 记忆）
//
// 迷你示意图全部是「内联 SVG + 设计令牌」，不引 D3 运行时、
// 不引 CDN、不放任何位图 —— 与全站约束一致。
// =========================================================

import { markGoal, getGoals } from './progress.js';

/* ---------------------------------------------------------
 * 0.5) 中英文案钩子：英文指南页会先加载 chart-help-ui.js
 *      （定义 window.CHART_HELP_I18N 英文覆盖表）再加载本引擎；
 *      中文页加载的同名文件是空覆盖，以下默认值即中文文案。
 *      模式与 quiz / practice / graph 的 UI 覆盖表一致。
 * ------------------------------------------------------- */
const I18N = window.CHART_HELP_I18N || {};
const UI = Object.assign({
  diagram: '示意图',
  calDays: ['一', '四', '日'],
  catA: '大类 A',
  recommend: '推荐：',
  channel: '主视觉通道',
  fits: '最适合',
  avoid: '慎用',
  refLabel: '参考章节：',
  answered: (n, total, ok) => '已答 ' + n + ' / ' + total + ' 题 · 正确 ' + ok + ' 题',
  pickFirst: '请先选择一个答案',
  correct: '✅ 回答正确',
  wrong: (ans) => '❌ 再想想，正确答案是 ' + ans.toUpperCase()
}, I18N.ui || {});
const ARIA = Object.assign({
  bar: '垂直条形图示意', barh: '水平条形图示意', grouped: '分组条形图示意',
  stacked: '堆叠条形图示意', pie: '环形图示意', histogram: '直方图示意',
  density: '密度图示意', boxplot: '箱线图示意', strip: '抖动点图示意',
  scatter: '散点图示意', trend: '散点图与拟合线示意', smatrix: '散点矩阵示意',
  line: '折线图示意', calheat: '日历热图示意', spiral: '阿基米德螺旋示意',
  gantt: '区间时间线示意', treemap: '矩形树图示意', area100: '百分比堆叠面积示意'
}, I18N.aria || {});

/* ---------------------------------------------------------
 * 0) 小工具
 * ------------------------------------------------------- */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 极坐标 → 直角坐标（0° 指向上方，顺时针为正），饼图与螺旋共用
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/* ---------------------------------------------------------
 * 1) 迷你示意图图元（viewBox 统一 0 0 132 80）
 * ------------------------------------------------------- */
const VB = 'viewBox="0 0 132 80" width="100%"';
const AX_V = '<path class="cg-axis" d="M12 8V62H124"/>';
const AX_H = '<path class="cg-axis" d="M12 10V76M12 76H124"/>';

const svg = (inner, label) =>
  '<svg ' + VB + ' role="img" aria-label="' + esc(label || UI.diagram) + '">' + inner + '</svg>';

// 垂直条形图：值 → 高度
function bars(vals, color) {
  const base = 62, max = Math.max.apply(null, vals), k = 44 / max;
  return vals.map((v, i) =>
    '<rect x="' + (20 + i * 22) + '" y="' + (base - v * k).toFixed(1) + '" width="16" height="' +
    (v * k).toFixed(1) + '" rx="2" fill="' + color + '"/>').join('');
}

// 水平条形图：值 → 宽度
function hbars(vals, color) {
  const max = Math.max.apply(null, vals), k = 100 / max;
  return vals.map((v, i) =>
    '<rect x="12" y="' + (14 + i * 12) + '" width="' + (v * k).toFixed(1) +
    '" height="9" rx="2" fill="' + color + '"/>').join('');
}

// 分组条形图：3 个类目 × 2 个分组
function grouped() {
  const base = 62, grp = [[26, 40, 18], [34, 44, 30]], k = 44 / 46, bw = 11, gap = 4;
  let s = '';
  grp.forEach((series, si) => series.forEach((v, gi) => {
    const x = 22 + gi * 30 + si * (bw + gap), h = v * k;
    s += '<rect x="' + x + '" y="' + (base - h).toFixed(1) + '" width="' + bw + '" height="' +
      h.toFixed(1) + '" rx="1.6" fill="' + (si ? 'var(--ch-2)' : 'var(--ch-1)') + '"/>';
  }));
  return AX_V + s;
}

// 堆叠条形图：每列 3 段
function stacked() {
  const base = 62, cols = [[30, 12, 8], [20, 18, 12], [8, 16, 24]], k = 44 / 50;
  let s = '';
  cols.forEach((seg, ci) => {
    let y = base;
    seg.forEach((v, si) => {
      const h = v * k; y -= h;
      s += '<rect x="' + (24 + ci * 32) + '" y="' + y.toFixed(1) + '" width="22" height="' +
        h.toFixed(1) + '" fill="var(--ch-' + (si + 1) + ')" opacity="' + (1 - si * 0.22).toFixed(2) + '"/>';
    });
  });
  return AX_V + s;
}

// 环形图（饼图的中空版，读数更稳）
function donut(vals, colors) {
  const cx = 66, cy = 40, r = 29, ir = 15;
  const total = vals.reduce((s, v) => s + v, 0);
  let acc = 0, out = '';
  vals.forEach((v, i) => {
    const a0 = acc / total * 360, a1 = (acc + v) / total * 360; acc += v;
    const p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    const p2 = polar(cx, cy, ir, a1), p3 = polar(cx, cy, ir, a0);
    const big = (a1 - a0) > 180 ? 1 : 0;
    out += '<path d="M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + 'A' + r + ' ' + r + ' 0 ' + big +
      ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + 'L' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) +
      'A' + ir + ' ' + ir + ' 0 ' + big + ' 0 ' + p3[0].toFixed(1) + ' ' + p3[1].toFixed(1) + 'Z" fill="' +
      colors[i] + '"/>';
  });
  return out;
}

// 直方图：10 个等宽分箱，高度即计数
function hist() {
  const vals = [.14, .32, .62, .86, 1, .92, .6, .34, .18, .1];
  const w = 112 / vals.length;
  let s = '';
  vals.forEach((v, i) => {
    const h = v * 44;
    s += '<rect x="' + (12 + i * w).toFixed(1) + '" y="' + (62 - h).toFixed(1) + '" width="' +
      (w - 1.2).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="var(--ch-1)" opacity=".85"/>';
  });
  return AX_V + s;
}

// 箱线图：3 组，含须线 / 四分位箱 / 中位线
function boxplot() {
  const g = [[14, 26, 34, 44, 56], [20, 30, 38, 48, 58], [10, 22, 30, 40, 52]];
  const x0 = 26, gap = 34, w = 20;
  let s = '';
  g.forEach((v, i) => {
    const hi = v[0], q3 = v[1], med = v[2], q1 = v[3], lo = v[4], cx = x0 + i * gap;
    s += '<path class="cg-axis" d="M' + cx + ' ' + hi + 'V' + lo + '"/>';
    s += '<rect x="' + (cx - w / 2) + '" y="' + q3 + '" width="' + w + '" height="' + (q1 - q3) +
      '" rx="1.6" fill="var(--ch-1)" opacity=".5" stroke="var(--ch-1)" stroke-width="1.2"/>';
    s += '<path d="M' + (cx - w / 2) + ' ' + med + 'H' + (cx + w / 2) +
      '" stroke="var(--ch-6)" stroke-width="2"/>';
  });
  return s;
}

// 抖动点图：小样本时直接画每个观测值
function strip() {
  const groups = [[30, 34, 37, 41, 45], [24, 31, 36, 43], [33, 39, 45]];
  let s = '';
  groups.forEach((vals, gi) => vals.forEach((v, vi) => {
    const x = 30 + gi * 36 + ((vi * 7 + gi * 3) % 9) - 4;
    s += '<circle cx="' + x + '" cy="' + v + '" r="2.6" fill="var(--ch-1)" opacity=".72"/>';
  }));
  return s;
}

// 散点图 / 拟合趋势：共用一组点
const SCATTER_PTS = [[18, 52], [26, 46], [33, 48], [40, 40], [46, 36], [52, 41], [58, 30],
  [64, 33], [70, 24], [78, 27], [86, 19], [94, 22], [104, 14], [116, 12]];

function scatter() {
  return SCATTER_PTS.map(p =>
    '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.4" fill="var(--ch-1)" opacity=".72"/>').join('');
}

function trend() {
  return AX_V + scatter() +
    '<path d="M16 54 L118 12" fill="none" stroke="var(--ch-6)" stroke-width="2.2" stroke-linecap="round"/>';
}

// 散点矩阵：3 列 × 2 行小面板
function smatrix() {
  const panels = [[12, 12], [46, 12], [80, 12], [12, 44], [46, 44], [80, 44]];
  const dots = [[6, 22], [14, 10], [22, 26], [30, 6], [24, 30], [10, 24], [26, 18], [4, 14]];
  let s = '';
  panels.forEach((p, i) => {
    s += '<rect x="' + p[0] + '" y="' + p[1] + '" width="30" height="26" rx="2.4" fill="var(--c-surface-2)" stroke="var(--c-line)"/>';
    s += dots.map(d => '<circle cx="' + (p[0] + d[0]) + '" cy="' + (p[1] + d[1]) + '" r="1.6" fill="' +
      (i % 2 ? 'var(--ch-2)' : 'var(--ch-1)') + '" opacity=".75"/>').join('');
  });
  return s;
}

// 折线图：实线主序列 + 虚线副序列
function line() {
  return AX_V +
    '<polyline points="12,44 30,36 48,40 66,24 84,30 102,14 124,18" fill="none" stroke="var(--ch-1)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="12,54 30,52 48,50 66,44 84,46 102,38 124,36" fill="none" stroke="var(--ch-2)" stroke-width="1.8" stroke-dasharray="4 3" stroke-linecap="round"/>';
}

// 日历热图：7 行（星期）× 14 列（周），颜色越深值越大
function calheat() {
  const cols = 14, rows = 7, s = 6.4, gap = 1.4;
  let out = '';
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const v = ((c * 7 + r) * 37 % 11) / 10;
      out += '<rect x="' + (14 + c * (s + gap)).toFixed(1) + '" y="' + (14 + r * (s + gap)).toFixed(1) +
        '" width="' + s + '" height="' + s + '" rx="1.4" fill="var(--ch-1)" opacity="' +
        (0.12 + v * 0.88).toFixed(2) + '"/>';
    }
  }
  return out +
    '<text class="cg-lbl" x="4" y="22">' + UI.calDays[0] + '</text><text class="cg-lbl" x="4" y="48">' + UI.calDays[1] + '</text>' +
    '<text class="cg-lbl" x="4" y="70">' + UI.calDays[2] + '</text>';
}

// 阿基米德螺旋日历：半径随时间增长、角度表示周期
function spiral() {
  const pts = [];
  for (let a = 0; a <= 1080; a += 8) {
    const p = polar(66, 40, 5 + a * (28 / 1080), a);
    pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
  }
  return '<polyline points="' + pts.join(' ') +
    '" fill="none" stroke="var(--ch-1)" stroke-width="1.6" stroke-linecap="round"/>' +
    '<circle cx="66" cy="40" r="2.2" fill="var(--ch-6)"/>';
}

// 故事线 / 甘特图：有明确起止的区间
function gantt() {
  return '<path class="cg-axis" d="M12 74H124"/>' +
    '<rect x="16" y="12" width="52" height="9" rx="4.5" fill="var(--ch-1)"/>' +
    '<rect x="46" y="26" width="44" height="9" rx="4.5" fill="var(--ch-2)"/>' +
    '<rect x="30" y="40" width="66" height="9" rx="4.5" fill="var(--ch-3)"/>' +
    '<rect x="86" y="54" width="34" height="9" rx="4.5" fill="var(--ch-4)"/>';
}

// 矩形树图：面积表示层级构成
function treemap() {
  return '<rect x="12" y="12" width="66" height="56" rx="2.4" fill="var(--ch-1)" opacity=".85"/>' +
    '<rect x="80" y="12" width="44" height="30" rx="2.4" fill="var(--ch-2)" opacity=".85"/>' +
    '<rect x="80" y="44" width="26" height="24" rx="2.4" fill="var(--ch-3)" opacity=".85"/>' +
    '<rect x="108" y="44" width="16" height="24" rx="2.4" fill="var(--ch-4)" opacity=".85"/>' +
    '<text class="cg-lbl" x="18" y="42">' + UI.catA + '</text><text class="cg-lbl" x="86" y="29">B</text>' +
    '<text class="cg-lbl" x="84" y="58">C</text><text class="cg-lbl" x="110" y="58">D</text>';
}

// 百分比堆叠面积图：份额随时间演变
function area100() {
  return '<path d="M12 62L124 62L124 40C96 34 84 44 60 40C40 37 24 30 12 28Z" fill="var(--ch-3)" opacity=".8"/>' +
    '<path d="M12 28C24 30 40 37 60 40C84 44 96 34 124 40L124 22C96 18 84 26 60 22C40 19 24 12 12 10Z" fill="var(--ch-2)" opacity=".8"/>' +
    '<path d="M12 10C24 12 40 19 60 22C84 26 96 18 124 22L124 8L12 8Z" fill="var(--ch-1)" opacity=".8"/>' +
    '<path class="cg-axis" d="M12 8V62M12 62H124"/>';
}

/* ---------------------------------------------------------
 * 2) 决策树：每个节点是一道选择题，叶子是「推荐图表」
 * ------------------------------------------------------- */
const TREE = {
  root: {
    step: 1,
    q: '这张图最想让人「一眼看到」什么？',
    opts: [
      { t: '比较大小', s: '若干类别谁高谁低', go: 'cmp' },
      { t: '看分布', s: '一个变量的形状与离散程度', go: 'dst' },
      { t: '看关系', s: '两个或多个变量之间的联系', go: 'rel' },
      { t: '看变化', s: '随时间推移的趋势', go: 'tim' },
      { t: '看构成', s: '整体由哪些部分拼成', go: 'com' }
    ]
  },

  /* ---- 比较 ---- */
  cmp: {
    step: 2,
    q: '比较的是「什么」之间的大小？',
    opts: [
      { t: '若干类别在同一个变量上', s: '比如各班级平均年龄', go: 'cmp-cat' },
      { t: '类别下还要再分子类别', s: '比如「性别 × 专业」两组对比', go: 'grouped' },
      { t: '既看总量、又看内部构成', s: '比如各省总量里各犯罪类型的占比', go: 'stacked' }
    ]
  },
  'cmp-cat': {
    step: 3,
    q: '类别的数量与标签长度如何？',
    opts: [
      { t: '类别 ≤ 12 个，标签短', s: '适合竖向排列，一眼读完', go: 'bar' },
      { t: '类别 > 12 个，或标签很长', s: '例如省市全名、专业全称', go: 'barh' }
    ]
  },

  /* ---- 分布 ---- */
  dst: {
    step: 2,
    q: '想看这个分布的哪一面？',
    opts: [
      { t: '整体形状：峰值、偏态、双峰', s: '连续数值，关心分箱后的形状', go: 'histogram' },
      { t: '平滑形态，不想被分箱影响', s: '形状比精确计数更重要', go: 'density' },
      { t: '多组分布放在一起比', s: '比如各班级年龄分布', go: 'dst-multi' },
      { t: '只看每组的五个统计量', s: '中位数 / 四分位 / 极值', go: 'boxplot' }
    ]
  },
  'dst-multi': {
    step: 3,
    q: '每组大约有多少个观测？',
    opts: [
      { t: '每组样本量较大（≥ 30）', s: '箱线图能稳定地读出四分位', go: 'boxplot' },
      { t: '每组样本很少（< 10）', s: '统计量不稳，不如直接看点', go: 'strip' }
    ]
  },

  /* ---- 关系 ---- */
  rel: {
    step: 2,
    q: '手上有几个变量？',
    opts: [
      { t: '两个数值变量', s: '例如身高 vs 体重', go: 'rel-2' },
      { t: '一个类别 + 一个数值', s: '例如各班级的年龄分布', go: 'dst-multi' },
      { t: '三个以上变量', s: '想看整体结构而不只是两两关系', go: 'smatrix' }
    ]
  },
  'rel-2': {
    step: 3,
    q: '需要同时把趋势 / 拟合线画出来吗？',
    opts: [
      { t: '不需要，只看相关与离群点', s: '保持数据原貌，不引入模型', go: 'scatter' },
      { t: '需要，想直观看到趋势方向', s: '拟合线帮助读出上升或下降', go: 'trend' }
    ]
  },

  /* ---- 时间 ---- */
  tim: {
    step: 2,
    q: '时间数据属于哪一类？',
    opts: [
      { t: '等间隔的连续时间点', s: '逐日 / 逐月 / 逐年的规整序列', go: 'line' },
      { t: '按「日」发生，且要跨年比较', s: '想看出星期几、月份的模式', go: 'calheat' },
      { t: '长跨度或明显周期', s: '几十年、季节性重复', go: 'spiral' },
      { t: '有明确起止的事件 / 阶段', s: '不是「点」，而是一段区间', go: 'gantt' }
    ]
  },

  /* ---- 构成 ---- */
  com: {
    step: 2,
    q: '想看哪一层构成？',
    opts: [
      { t: '某一时刻各部分的比例', s: '一共由哪几块拼成', go: 'com-single' },
      { t: '构成随时间的变化', s: '份额怎么演变', go: 'area100' },
      { t: '大类里还套着小类', s: '层级构成，如专业 → 班级', go: 'treemap' }
    ]
  },
  'com-single': {
    step: 3,
    q: '一共有几个部分？',
    opts: [
      { t: '≤ 5 个部分', s: '环形图可以胜任，但要排序', go: 'pie' },
      { t: '> 5 个部分', s: '人眼读不出角度差值，改用条形', go: 'stacked' }
    ]
  }
};

/* ---------------------------------------------------------
 * 3) 结果卡：每张推荐图表一张（名称 / 图 / 通道 / 适合 / 慎用 / 出处）
 * ------------------------------------------------------- */
const RESULTS = {
  bar: {
    name: '条形图（垂直）',
    svg: () => svg(AX_V + bars([26, 40, 18, 48, 32], 'var(--ch-1)'), ARIA.bar),
    why: '条形图用<strong>长度</strong>编码数值，是人眼判断最精确的通道。类别不多时，竖排读值最舒服。',
    channel: '长度（位置）',
    fits: '类别 ≤ 12 个、需要精确读值、类别名短',
    avoid: '按字母排序；用面积 / 体积表示大小',
    ref: { href: '../lesson-01/#ch-1-3', text: '1.3 数据属性（测量尺度 × 视觉通道）' }
  },
  barh: {
    name: '条形图（水平，按数值排序）',
    svg: () => svg(AX_H + hbars([40, 33, 26, 19, 12], 'var(--ch-1)'), ARIA.barh),
    why: '把类别旋转到 y 轴，长标签有了完整的一行；<strong>按数值排序</strong>后，读者不用逐个比较也能排出名次。',
    channel: '长度（位置）',
    fits: '类别 > 12 个、标签很长（省市 / 专业全称）',
    avoid: '数值轴别放在顶部；排序后不要打乱顺序',
    ref: { href: '../lesson-01/#ch-1-3', text: '1.3 数据属性（测量尺度 × 视觉通道）' }
  },
  grouped: {
    name: '分组条形图',
    svg: () => svg(grouped(), ARIA.grouped),
    why: '同一个类目下并排放两组条形，既保留类目间的比较，又能读出「组内差异」。',
    channel: '长度 + 分组颜色',
    fits: '一个类别变量的 2–3 个子类别对比',
    avoid: '组数 × 类目 > 12 时改用小倍数分面',
    ref: { href: '../lesson-04/#ch-4-2', text: '4.2 坐标轴变换' }
  },
  stacked: {
    name: '堆叠条形图（含 100% 堆叠）',
    svg: () => svg(stacked(), ARIA.stacked),
    why: '一根条形同时表达<strong>总量</strong>（总长）与<strong>构成</strong>（分段），适合「既要又要」的场景。',
    channel: '长度（总长 + 分段）',
    fits: '比较总量、同时看内部构成；100% 堆叠比份额',
    avoid: '读中间段不可靠（只有最下面一段有共同基线）；段数 > 6 时归并「其他」',
    ref: { href: '../lesson-02/#ch-2-3', text: '2.3 视觉映射' }
  },
  pie: {
    name: '饼图 / 环形图',
    svg: () => svg(donut([38, 26, 20, 16], ['var(--ch-1)', 'var(--ch-2)', 'var(--ch-3)', 'var(--ch-4)']), ARIA.pie),
    why: '人眼对<strong>角度</strong>不敏感，但对「最大的是谁」很敏感。部分少、且只想看占大头的那几块时，环形图够用。',
    channel: '角度 + 面积',
    fits: '≤ 5 个部分、只想看主次、value_counts 快速概览',
    avoid: '超过 5 个扇区就读不出差值；不要用它做精确比较',
    ref: { href: '../lesson-01/#ch-1-3', text: '1.3 数据属性（测量尺度 × 视觉通道）' }
  },
  histogram: {
    name: '直方图',
    svg: () => svg(hist(), ARIA.histogram),
    why: '把连续数值分成等宽区间再计数，形状（单峰 / 双峰 / 偏态）一眼可见，是看分布的第一步。',
    channel: '长度（分箱计数）',
    fits: '单个连续变量的分布形状',
    avoid: '分箱宽度会「换一个故事」，务必标注组距；它不是时间轴',
    ref: { href: '../lesson-04/#ch-4-1', text: '4.1 数据转换（分箱）' }
  },
  density: {
    name: '密度图 / 小提琴图',
    svg: () => svg(AX_V +
      '<path d="M12 62C34 62 38 34 54 30C70 26 74 44 92 40C110 36 112 62 124 62Z" fill="var(--ch-1)" opacity=".55"/>' +
      '<path d="M12 62C40 62 44 48 62 46C80 44 84 58 100 56C114 54 116 62 124 62Z" fill="var(--ch-3)" opacity=".5"/>',
      ARIA.density),
    why: '把直方图的轮廓平滑成曲线，多组叠加比较时不会因分箱错位而互相干扰。',
    channel: '面积（平滑后的密度）',
    fits: '多组分布叠加比较、形态比精确计数更重要',
    avoid: '面积已归一化，读不出频数；组数过多会糊成一团',
    ref: { href: '../lesson-04/#ch-4-1', text: '4.1 数据转换（分箱）' }
  },
  boxplot: {
    name: '箱线图',
    svg: () => svg(boxplot(), ARIA.boxplot),
    why: '五个统计量（最小 / 四分位 / 中位 / 上四分位 / 最大）压缩成一只箱子，多组并排时差异和离群点都很直观。',
    channel: '位置 + 长度（统计量）',
    fits: '多组分布对比、找离群点；每组样本量 ≥ 30',
    avoid: '样本量很小的组别直接画点；箱线图也藏住了双峰',
    ref: { href: '../lesson-04/#ch-4-2', text: '4.2 坐标轴变换' }
  },
  strip: {
    name: '抖动点图',
    svg: () => svg(strip(), ARIA.strip),
    why: '样本很少时，统计量本身就不稳。把<strong>每一个观测值</strong>画出来（沿类别轴轻微抖动防重叠），信息一点不丢。',
    channel: '位置（抖动避免重叠）',
    fits: '每组样本量少（< 10）、要看每一个观测值',
    avoid: '抖动幅度不能大到改变分布印象',
    ref: { href: '../lesson-04/#ch-4-2', text: '4.2 坐标轴变换' }
  },
  scatter: {
    name: '散点图',
    svg: () => svg(AX_V + scatter(), ARIA.scatter),
    why: '两个数值变量直接映射到 x / y，相关方向、强度、聚簇、离群点都能看见 —— 二维数据的第一选择。',
    channel: '位置（x, y）',
    fits: '两个数值变量的关系、离群点、聚类',
    avoid: '点重叠严重时先设透明度，或改用六边形分箱',
    ref: { href: '../lesson-04/#ch-4-3', text: '4.3 曲线拟合' }
  },
  trend: {
    name: '散点图 + 拟合趋势线',
    svg: () => svg(trend(), ARIA.trend),
    why: '在散点之上叠一条拟合曲线，趋势方向立刻可读；它不替代数据，只是帮助把「趋势」与「噪声」分开看。',
    channel: '位置 + 斜率',
    fits: '强调趋势方向、对比不同拟合模型（线性 / 多项式）',
    avoid: '用拟合线掩盖离群点；在非线性数据上硬套直线',
    ref: { href: '../lesson-04/#ch-4-3', text: '4.3 曲线拟合' }
  },
  smatrix: {
    name: '散点矩阵 / 平行坐标',
    svg: () => svg(smatrix(), ARIA.smatrix),
    why: '三个以上变量时，两两一张小图排成矩阵，能一次扫出所有变量对的关联，比逐个画更省事。',
    channel: '位置（多轴）',
    fits: '3–8 个变量的整体结构、快速找相关性',
    avoid: '维度 > 8 时改用 PCA 降维（第 4 章）或分面',
    ref: { href: '../lesson-04/#ch-4-2', text: '4.2 坐标轴变换' }
  },
  line: {
    name: '折线图（单 / 多序列）',
    svg: () => svg(line(), ARIA.line),
    why: '等距的时间轴 + 连线的<strong>斜率</strong>，让「涨得多快」直接可见，是标准时间序列的主力图形。',
    channel: '位置 + 斜率',
    fits: '等间隔连续时间序列、趋势与拐点；多序列对比',
    avoid: '时间轴必须等距连续；不要给无序类别画折线；序列 > 6 条改小倍数',
    ref: { href: '../lesson-05/#ch-5-2', text: '5.2 标准时间可视化（折线图）' }
  },
  calheat: {
    name: '日历热图',
    svg: () => svg(calheat(), ARIA.calheat),
    why: '把「哪一天发生」对齐到星期 × 周的网格上，颜色深浅表示数值 —— 跨年的日粒度模式（周末效应、季节）立刻显形。',
    channel: '颜色亮度（顺序型 colormap）',
    fits: '按日发生、需跨年比较（星期几 / 月度模式）',
    avoid: '必须配颜色图例；别用彩虹色阶；缺失日要显式留白',
    ref: { href: '../lesson-05/#ch-5-3', text: '5.3 日历热图（van Wijk）' }
  },
  spiral: {
    name: '螺旋 / 极坐标日历',
    svg: () => svg(spiral(), ARIA.spiral),
    why: '把周期折到角度、把时间放到半径，一个螺旋能装下几十年的数据，周期性重复一眼可见。',
    channel: '角度（周期）+ 半径（时间）',
    fits: '长跨度、明显周期（季节、多年）的数据',
    avoid: '极坐标下比较长度不精确，只适合看模式不适合读值',
    ref: { href: '../lesson-05/#ch-5-4', text: '5.4 周期时间可视化（阿基米德螺旋）' }
  },
  gantt: {
    name: '故事线 / 甘特图',
    svg: () => svg(gantt(), ARIA.gantt),
    why: '当数据是「有起止的区间」而不是「某一时刻的点」时，用一条条区间线段表达才符合它的本质。',
    channel: '位置（区间起止）',
    fits: '事件有明确起止时间（阶段、工期、剧情线）',
    avoid: '时刻型事件不适合；交叉过多时按泳道分层',
    ref: { href: '../lesson-05/#ch-5-5', text: '5.5 Storyline 时间线（侏罗纪公园）' }
  },
  treemap: {
    name: '矩形树图',
    svg: () => svg(treemap(), ARIA.treemap),
    why: '用<strong>面积</strong>表达占比，并把层级套进同一块画布 —— 大类里的小类一眼看出谁更重。',
    channel: '面积（层级构成）',
    fits: '多层层级构成、占比悬殊（大项看总量、小项看存在）',
    avoid: '面积比较不精确；层级超过三层就很难读；小项会被压没',
    ref: { href: '../lesson-02/#ch-2-3', text: '2.3 视觉映射' }
  },
  area100: {
    name: '百分比堆叠面积图',
    svg: () => svg(area100(), ARIA.area100),
    why: '把总量归一成 100%，只看<strong>份额</strong>随时间怎么变 —— 比堆叠面积更专注于「此消彼长」。',
    channel: '面积（占比随时间）',
    fits: '构成随时间的演变、份额此消彼长',
    avoid: '中间层的趋势难读；关心绝对值时应改用堆叠面积',
    ref: { href: '../lesson-05/#ch-5-2', text: '5.2 标准时间可视化（折线图）' }
  }
};

/* ---------------------------------------------------------
 * 3.5) 应用英文覆盖表（TREE 题目与选项、RESULTS 卡片字段）
 * ------------------------------------------------------- */
if (I18N.tree) Object.keys(I18N.tree).forEach((k) => {
  const n = TREE[k], v = I18N.tree[k];
  if (!n) return;
  if (v.q) n.q = v.q;
  if (v.opts) n.opts = v.opts;
});
if (I18N.results) Object.keys(I18N.results).forEach((k) => {
  const r = RESULTS[k], v = I18N.results[k];
  if (!r) return;
  ['name', 'why', 'channel', 'fits', 'avoid'].forEach((f) => { if (v[f]) r[f] = v[f]; });
  if (v.refText) r.ref = Object.assign({}, r.ref, { text: v.refText });
});

/* ---------------------------------------------------------
 * 4) 决策树渲染（前进 / 后退 / 重来）
 * ------------------------------------------------------- */
function initWizard() {
  const stage = document.getElementById('cg-stage');
  const crumbs = document.getElementById('cg-crumbs');
  const back = document.getElementById('cg-back');
  const reset = document.getElementById('cg-reset');
  if (!stage) return;

  let stack = [{ id: 'root', pick: null }];   // 走过的问题节点 + 每次的选择

  function nodeHTML(id) {
    const n = TREE[id];
    return '<div class="cg-node"><p class="cg-q"><i>' + n.step + '</i><span>' + esc(n.q) +
      '</span></p><div class="cg-opts">' +
      n.opts.map(o => '<button type="button" class="cg-opt" data-go="' + o.go + '" data-pick="' +
        esc(o.t) + '"><b>' + esc(o.t) + '</b><span>' + esc(o.s) + '</span></button>').join('') +
      '</div></div>';
  }

  function resultHTML(id) {
    const r = RESULTS[id];
    return '<div class="cg-result">' +
      '<div class="cg-result__chart"><p class="cg-result__name">' + esc(r.name) + '</p>' + r.svg() + '</div>' +
      '<div class="cg-result__info"><h4>' + UI.recommend + esc(r.name) + '</h4>' +
      '<p class="cg-result__why">' + r.why + '</p>' +
      '<table class="mini-table"><tbody>' +
      '<tr><td>' + UI.channel + '</td><td>' + esc(r.channel) + '</td></tr>' +
      '<tr><td>' + UI.fits + '</td><td>' + esc(r.fits) + '</td></tr>' +
      '<tr><td>' + UI.avoid + '</td><td>' + esc(r.avoid) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="cg-result__ref">' + UI.refLabel + '<a href="' + r.ref.href + '">' + esc(r.ref.text) + '</a></p>' +
      '</div></div>';
  }

  function show() {
    const cur = stack[stack.length - 1];
    stage.innerHTML = TREE[cur.id] ? nodeHTML(cur.id) : resultHTML(cur.id);
    const picks = stack.slice(1).map(s => s.pick);
    crumbs.hidden = picks.length === 0;
    crumbs.innerHTML = picks.map((p, i) =>
      '<span class="cg-crumb' + (i === picks.length - 1 ? ' cg-crumb--pick' : '') + '">' + esc(p) + '</span>'
    ).join('<span class="cg-crumbs__sep">›</span>');
    back.hidden = stack.length <= 1;
  }

  stage.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    stack.push({ id: btn.dataset.go, pick: btn.dataset.pick });
    show();
  });

  if (back) back.addEventListener('click', () => {
    if (stack.length > 1) { stack.pop(); show(); }
  });

  if (reset) reset.addEventListener('click', () => {
    stack = [{ id: 'root', pick: null }];
    show();
  });

  show();
}

/* ---------------------------------------------------------
 * 5) 小测判分（契约与 lesson-core.js 完全一致）+ 得分条
 * ------------------------------------------------------- */
function initSelfTest() {
  const boxes = [...document.querySelectorAll('[data-selftest]')];
  const score = document.getElementById('cg-score-num');

  function refresh() {
    if (!score) return;
    const graded = boxes.filter(b => b.dataset.graded === '1');
    const ok = graded.filter(b => b.dataset.correct === '1').length;
    score.textContent = UI.answered(graded.length, boxes.length, ok);
  }

  boxes.forEach((box) => {
    const answer = box.dataset.answer;
    const btn = box.querySelector('.selftest__btn');
    const verdict = box.querySelector('.selftest__verdict');
    const why = box.querySelector('.selftest__why');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const picked = box.querySelector('input[type="radio"]:checked');
      if (!picked) {
        verdict.className = 'selftest__verdict is-no';
        verdict.textContent = UI.pickFirst;
        return;
      }
      const ok = picked.value === answer;
      verdict.className = 'selftest__verdict ' + (ok ? 'is-ok' : 'is-no');
      verdict.textContent = ok ? UI.correct : UI.wrong(answer);
      box.querySelectorAll('.selftest__opt').forEach((lbl) => {
        const input = lbl.querySelector('input');
        lbl.classList.toggle('is-right', input.value === answer);
        lbl.classList.toggle('is-wrong', !ok && input.checked && input.value !== answer);
      });
      if (why) why.hidden = false;
      box.dataset.graded = '1';
      box.dataset.correct = ok ? '1' : '0';
      refresh();
    });
  });

  refresh();
}

/* ---------------------------------------------------------
 * 6) 侧栏目录：点击平滑滚动 + 视口反向高亮
 * ------------------------------------------------------- */
function setActive(id) {
  document.querySelectorAll('.chapter').forEach(s => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('.chapter-nav a[data-chapter]').forEach(a =>
    a.classList.toggle('active', a.dataset.chapter === id));
}

function initSectionNav() {
  const secs = [...document.querySelectorAll('.chapter')];
  document.querySelectorAll('.chapter-nav a[data-chapter]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.dataset.chapter;
      const el = document.getElementById(id);
      if (!el) return;
      if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(id);
    });
  });
  if (!secs.length) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-96px 0px -46% 0px' });
    secs.forEach(s => io.observe(s));
  } else {
    setActive(secs[0].id);
  }
  const hash = location.hash.replace(/^#/, '');
  setActive(hash && document.getElementById(hash) ? hash : secs[0].id);
  if (hash && document.getElementById(hash)) {
    const el = document.getElementById(hash);
    el.scrollIntoView({ block: 'start' });
  }
}

/* ---------------------------------------------------------
 * 7) 本页学习目标（与章节页同一套 localStorage 记忆）
 * ------------------------------------------------------- */
function initGoals() {
  const box = document.querySelector('.learn-goals');
  if (!box) return;
  const KEY = 'topic-chart-guide';
  const saved = getGoals(KEY);
  box.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
    if (saved[i]) cb.checked = true;
    cb.addEventListener('change', () => {
      markGoal(KEY, [...box.querySelectorAll('input[type="checkbox"]')].map(x => x.checked));
    });
  });
}

/* ---------------------------------------------------------
 * 8) 启动
 * ------------------------------------------------------- */
initWizard();
initSelfTest();
initSectionNav();
initGoals();

console.log('[topic-chart-guide] 已就绪 · 决策树节点数:', Object.keys(TREE).length,
  '· 推荐图表数:', Object.keys(RESULTS).length);
