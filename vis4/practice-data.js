// =========================================================
// practice-data.js —— 「D3 实战工作台」案例数据（中文版）
// ---------------------------------------------------------
// 案例：用 d3 v7 从零画出「各专业新生人数」柱状图，共 8 个环节。
//
// 刻意用「普通 script（IIFE 风格赋值）」而不是 ES Module：
//   这样 file:// 直接双击打开也能用（预览 iframe 靠 contentDocument.write
//   与我们自己的 d3 副本配合，不需要任何服务器）。
//
// 数据结构：
//   window.PRACTICE_CASE = {
//     title, subtitle,
//     brief:    { goal, audience, constraints: [] },   // 案例要求
//     baseCss:  '…',        // 注入预览沙箱的基础样式（学生不用写）
//     startCode:{ js  },    // 第 1 个环节的起始代码
//     assets:   [ { label, value } ],                  // 可一键插入编辑器的片段
//     steps:    [ {
//        id, title, subtitle,
//        task:    [ '要求 1', … ],
//        hints:   [ '思路', '关键 API', '兜底' ],       // ≥ 2 级，逐级解锁
//        syntax:  [ { code, note } ],                  // 语法速查
//        checks:  [ … ],                               // 检查点（见下）
//        focus:   { js: '锚点子串' },                   // 光标定位锚点
//        solution:{ js }                               // 参考答案（= 下一关的起始代码）
//     } ]
//   }
//
// checks 支持的 type —— 全部基于「预览里真实渲染出来的 SVG DOM」判定，
// 不做代码文本比对：写法可以和参考答案不同，效果达标即通过。
//   noError  { }                              本次运行没有 JS 报错
//   svgCount { n }                            文档里的 <svg> 数量 ≥ n
//   exists   { selector }                     选择器存在
//   count    { selector, min | max | eq }     命中元素数满足条件
//   attr     { selector, prop, mode, value|min|max }
//             mode = eq | min | max | contains        读 HTML/SVG 属性值
//   bbox     { selector, dim:'width'|'height', min|max }
//             SVG 元素取 getBBox()（用户单位，不受预览缩放影响），
//             根 <svg> 取 getBoundingClientRect()
//   order    { selector, by:'x'|'y'|'width'|'height', dir:'asc'|'desc' }
//             在文档顺序里，所选几何量单调递增 / 递减（容差 1px）
//   style    { selector, prop, mode:'eq'|'min'|'max'|'set', value|min|max }
//             getComputedStyle 的值；mode='set' 表示「不是 none / transparent / 空」
//   text     { selector, contains: [ … ] }    文本内容包含这些子串
//   vary     { selector, prop, min }          该属性的不同取值个数 ≥ min
//   any      { checks: [ … ] }                任一子检查通过即算通过
//   atWidth  { width, checks: [ … ] }         在指定预览宽度下执行子检查
//
// ⚠️ 学生的代码写在 <textarea> 里、在沙箱 iframe 中执行，
//    因此参考答案对用户可见（F12）。本功能定位为「动手练习」，不是考试。
// =========================================================
window.PRACTICE_CASE = {

  title: '实战工作台 · 用 D3 画一张柱状图',
  subtitle: '按真实的 D3 工作流走完 8 步：建画布 → 绑数据 → 坐标轴 → 标签 → 编码 → 交互 → 注释 → 交付',

  /* ---------------- 案例要求（对应「先问任务，再看数据，最后挑图形」） ---------------- */
  brief: {
    goal: '用手写 D3 代码做出一张「各专业新生人数」柱状图：让人一眼看出哪个专业人最多，并能读到具体数值。',
    audience: '学院教务老师（要快速比较各专业规模，不熟悉代码）。',
    constraints: [
      '画布 480 × 320，四周留出坐标轴与标签的空间',
      '横向用「长度」编码人数（柱高），纵向用类别区分专业 —— 长度是最精确的通道',
      '柱子必须从 0 起算，按人数从多到少排序，并标出具体数值',
      '颜色用于加强「大小」的顺序感（顺序型色阶），不是装饰',
      '最终交付一个能双击打开的 .svg（由工作台直接导出）',
    ],
  },

  /* ---------------- 预览沙箱自带的基础样式 ----------------
   * 下面是「跑在独立 iframe 沙箱里」的样式，不继承网站的 tokens.css ——
   * 因此这里的色值是与站点无关的中性/图表演示色（沿用 Okabe–Ito 与 Blues 色阶的常见取值），
   * 只为让预览看得清。写练习时直接用 var(--ch-1) 这类沙箱变量即可，不必自己写色值。
   * ----------------------------------------------------- */
  baseCss: `
:root {
  --ch-1: #0072b2;
  --ch-2: #e69f00;
  --ch-6: #d55e00;
  --ink: #1b2430;
  --muted: #6b7684;
  --line: #d3d8e0;
  --paper: #ffffff;
  --bg: #f6f7fa;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 18px;
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: 14px;
}
#stage {
  padding: 8px;
  background: var(--paper);
  border-radius: 10px;
}
#stage svg { display: block; max-width: 100%; height: auto; }
`,

  /* ---------------- 第 1 个环节的起始代码 ---------------- */
  startCode: {
    js: `// ===== D3 实战：各专业新生人数柱状图 =====
// 数据已经给你了；你负责把画布与比例尺搭出来。

// 数据：某学院 2025 级 5 个专业的新生人数（注意：这里没有排序）
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

// 画布尺寸与内边距（内边距留给坐标轴刻度与标签）
const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// TODO ① 往 #stage 里 append 一个 <svg>，class 设为 'chart'，
//         并把 viewBox / width / height 一起设好
// TODO ② 定义两个比例尺：
//         x = scaleBand：类别 → 横向位置
//         y = scaleLinear：数值 → 纵向位置（值域要上下翻转）
`,
  },

  /* ---------------- 可一键插入编辑器的片段 ---------------- */
  assets: [
    { label: '数据（5 个专业）', value: "const DATA = [\n  { major: '软件工程', count: 22 },\n  { major: '数据科学', count: 34 },\n  { major: '计算机',   count: 18 },\n  { major: '人工智能', count: 26 },\n  { major: '物联网',   count: 12 },\n];" },
    { label: '类别比例尺（scaleBand）', value: "const x = d3.scaleBand()\n  .domain(DATA.map(d => d.major))\n  .range([PAD.l, W - PAD.r])\n  .paddingInner(0.24);" },
    { label: '数值比例尺（scaleLinear）', value: "const y = d3.scaleLinear()\n  .domain([0, d3.max(DATA, d => d.count)])\n  .range([H - PAD.b, PAD.t]);" },
    { label: 'y 轴 + 网格线（axisLeft）', value: "d3.axisLeft(y).ticks(5).tickSize(-(W - PAD.l - PAD.r))" },
    { label: '顺序色阶（Blues）', value: "d3.scaleSequential(d3.interpolateBlues)" },
    { label: '原生提示（title）', value: "bars.selectAll('rect.bar').append('title')\n  .text(d => d.major + '：' + d.count + ' 人');" },
  ],

  steps: [
    /* =====================================================
     * 环节 1 —— 画布与比例尺
     * =================================================== */
    {
      id: 's1-canvas',
      title: '环节 1 · 画布与比例尺',
      subtitle: '先把「一张空白画布」和「数据 → 像素」的换算法则定下来，后面每一步都建立在这两者之上。',
      task: [
        '在 #stage 里 append 一个 <svg>，class 设为 chart',
        '给 svg 设 viewBox（0 0 480 320）与 width / height，保证缩放后比例不变',
        '定义 x = d3.scaleBand()：把 5 个专业名映射到横向位置，range 用 [PAD.l, W - PAD.r]',
        '定义 y = d3.scaleLinear()：把人数映射到纵向位置，domain 从 0 起，range 上下翻转',
      ],
      hints: [
        '画布就是一块画板：d3.select(\'#stage\').append(\'svg\') 之后，用 .attr() 依次设 class、viewBox、width、height。',
        '两个比例尺的分工：scaleBand 处理「类别」（domain 放专业名，range 放像素区间）；scaleLinear 处理「数值」（domain 从 0 到最大值，range 要写成 [底边, 顶边] 才是上下翻转）。',
        '拿不到最大值就用 d3.max(DATA, d => d.count)；range 写反了柱子会长到天上 —— 记住 SVG 的 y 轴向下为正。',
      ],
      syntax: [
        { code: "d3.select('#stage').append('svg')", note: '选中容器并插入一个 SVG 元素，返回该选择的引用' },
        { code: '.attr(\'viewBox\', \'0 0 \' + W + \' \' + H)', note: 'viewBox 定义「用户坐标」的视野，SVG 缩放时图形比例不变' },
        { code: '.domain([…]).range([…])', note: 'domain 是数据域（输入），range 是值域（输出像素）' },
        { code: '.range([H - PAD.b, PAD.t])', note: '写成「下 → 上」，数值越大画得越高（SVG 的 y 向下为正）' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: '对着报错行检查括号、引号是否配对；分号漏了通常不会报错，括号漏了一定会。' },
        { type: 'svgCount', n: 1, label: '预览里出现了 1 块 SVG 画布', hint: "用 d3.select('#stage').append('svg') 建一次即可；重复 append 会得到多个空 svg。" },
        { type: 'exists', selector: 'svg.chart', label: '画布是 <svg class="chart">', hint: "append('svg') 之后接 .attr('class', 'chart')。" },
        { type: 'attr', selector: 'svg.chart', prop: 'viewBox', mode: 'contains', value: '0 0', label: '画布设置了 viewBox（缩放不变形）', hint: ".attr('viewBox', '0 0 ' + W + ' ' + H)" },
        { type: 'bbox', selector: 'svg.chart', dim: 'width', min: 300, label: '画布宽度 ≥ 300px', hint: '给 svg 设 width（480 就行），别只写 viewBox。' },
        { type: 'bbox', selector: 'svg.chart', dim: 'height', min: 200, label: '画布高度 ≥ 200px', hint: '给 svg 设 height（320 就行）。' },
      ],
      focus: { js: '// TODO ① 往 #stage 里 append 一个 <svg>' },
      solution: {
        js: `// 环节 1 · 画布 + 比例尺
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布：一块 480×320 的 SVG
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);
`,
      },
    },

    /* =====================================================
     * 环节 2 —— 数据绑定（画柱子）
     * =================================================== */
    {
      id: 's2-bars',
      title: '环节 2 · 把数据绑成柱子',
      subtitle: 'D3 的核心动作不是「画图」，而是「把数据数组绑到 DOM 上」—— 一份数据长出一根柱子。',
      task: [
        "先建一个容器：svg.append('g').attr('class', 'bars')",
        "在容器里 selectAll('rect.bar').data(DATA).join('rect')，让数据条数决定柱子个数",
        "给每根柱子设 class='bar'、x、y、width、height：x 用 x(d.major)，宽用 x.bandwidth()",
        "height 用 y(0) - y(d.count)（从 0 起算的柱高），fill 交给沙箱变量 var(--ch-1)",
      ],
      hints: [
        '这是 D3 的「数据连接」：selectAll() 先占一个空位，.data() 把数组挂上去，.join() 负责「没有的就新建」。',
        '五个属性里最容易错的是 height：直接写 y(d.count) 会得到「柱子顶到头」的效果，因为那是坐标不是长度，要写成 y(0) - y(d.count)。',
        "还可以给柱子存一份数据：.attr('data-value', d => d.count)，后面做交互时方便读回来。",
      ],
      syntax: [
        { code: ".selectAll('rect.bar').data(DATA).join('rect')", note: 'Data-Join：enter 新建 / update 复用 / exit 删除，一网打尽' },
        { code: "x.bandwidth()", note: 'scaleBand 的每一条带子的宽度 —— 柱宽就取它' },
        { code: "d => y(0) - y(d.count)", note: '箭头函数接收当前数据项；柱高 = 基线 − 柱顶' },
        { code: ".style('fill', 'var(--ch-1)')", note: '沙箱里预置了 --ch-1…--ch-8 图表色；style() 比 attr() 更稳（能吃到 CSS 变量）' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: '常见原因：忘记 return、括号没闭合，或 join 之后又 append 了一次。' },
        { type: 'exists', selector: 'svg g.bars', label: '有一个装柱子的 <g class="bars">', hint: "svg.append('g').attr('class', 'bars')，后面的 selectAll 都从它开始。" },
        { type: 'count', selector: 'rect.bar', min: 5, label: '5 个专业各画出一根柱子（≥ 5 个 rect.bar）', hint: "selectAll('rect.bar').data(DATA).join('rect')，别忘了 .attr('class', 'bar')。" },
        { type: 'attr', selector: 'rect.bar', prop: 'width', mode: 'min', min: 1, label: '每根柱子都有宽度（长度通道已生效）', hint: "width 取 .attr('width', x.bandwidth())。" },
        { type: 'attr', selector: 'rect.bar', prop: 'height', mode: 'min', min: 1, label: '柱高按数值算出来了（height > 0）', hint: "用 y(0) - y(d.count)；只有 0 的话说明 y 的值域写反了。" },
        { type: 'style', selector: 'rect.bar', prop: 'fill', mode: 'set', label: '柱子上了颜色（fill 不是 none）', hint: ".style('fill', 'var(--ch-1)')" },
        { type: 'order', selector: 'rect.bar', by: 'x', dir: 'asc', label: '柱子按数据顺序从左到右排开', hint: 'x 的 range 从左边距 PAD.l 开始，bandwidth 会自动分配位置。' },
        { type: 'bbox', selector: 'rect.bar', dim: 'height', min: 8, label: '最矮的柱子也有可见高度（几何真的画出来了）', hint: '检查 y 的 range：应该是 [H - PAD.b, PAD.t]（下 → 上）。' },
      ],
      focus: { js: 'const y = d3.scaleLinear()' },
      solution: {
        js: `// 环节 2 · 数据绑定 → 柱子
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ 数据绑定：一份数据 → 一根柱子
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(DATA)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', 'var(--ch-1)');
`,
      },
    },

    /* =====================================================
     * 环节 3 —— 数值坐标轴
     * =================================================== */
    {
      id: 's3-axis',
      title: '环节 3 · 数值坐标轴',
      subtitle: '柱子有多高，得有刻度作证。这一步给 y 方向配上刻度值与贯穿绘图区的网格线。',
      task: [
        "在画柱子之前（bars 那一段的上面）插入一个 <g class='axis axis-y'>",
        '把它平移到左边距：transform = translate(PAD.l, 0)',
        '用 d3.axisLeft(y).ticks(5) 生成刻度；用 tickSize(-(W - PAD.l - PAD.r)) 把刻度线拉成网格线',
        "把轴线(.domain)去掉，只留刻度与网格；网格线颜色用 var(--line)",
        '注意：网格要画在柱子「下面」，所以这段代码要写在画柱子之前',
      ],
      hints: [
        'd3.axisLeft(y) 返回的是一个「生成器」，要用 .call() 把它画进某个 <g> 里。',
        '网格线的做法很取巧：刻度线的长度取负数，就会从刻度往右延伸，形成横贯绘图区的线。',
        "轴线那根竖线一般不需要：.call(g => g.select('.domain').remove()) 把它删掉。",
      ],
      syntax: [
        { code: ".attr('transform', 'translate(' + PAD.l + ',0)')", note: '把整个组平移到左边距，刻度文字才不会压着画布边缘' },
        { code: 'd3.axisLeft(y).ticks(5)', note: '纵轴生成器，约 5 个刻度；.ticks() 只是建议，D3 会取整齐的值' },
        { code: '.tickSize(-(W - PAD.l - PAD.r))', note: '负的刻度长度 = 网格线（从轴往绘图区里延伸）' },
        { code: ".call(g => g.select('.domain').remove())", note: '选择器 .domain 指向轴线本身，删掉它只留刻度' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: '如果报 “g.call is not a function”，通常是 axisLeft 写成了 axisBottom 或少了调用。' },
        { type: 'exists', selector: 'svg g.axis-y', label: '有一条数值坐标轴 <g class="axis axis-y">', hint: "svg.append('g').attr('class', 'axis axis-y').call(d3.axisLeft(y).ticks(5))" },
        { type: 'attr', selector: 'svg g.axis-y', prop: 'class', mode: 'contains', value: 'axis', label: '坐标轴组带 axis 类名（方便后续选中）', hint: ".attr('class', 'axis axis-y')" },
        { type: 'count', selector: 'svg g.axis-y text', min: 3, label: 'y 轴上至少 3 个刻度值', hint: ".ticks(5) 之后应该能看到 0、5、10 … 若干数字。" },
        { type: 'count', selector: 'svg g.axis-y line', min: 3, label: '刻度对应的网格线也画了出来', hint: '.tickSize(-(W - PAD.l - PAD.r))' },
        { type: 'style', selector: 'svg g.axis-y text', prop: 'fill', mode: 'set', label: '刻度文字有颜色（未设置默认为黑，也算通过）', hint: ".selectAll('text').style('fill', 'var(--muted)')" },
      ],
      focus: { js: ".style('fill', 'var(--ch-1)');" },
      solution: {
        js: `// 环节 3 · 数值坐标轴（画在柱子下面）
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ 数值坐标轴：刻度 + 贯穿绘图区的网格线（写在柱子之前 = 画在下面）
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ④ 数据绑定：一份数据 → 一根柱子
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(DATA)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', 'var(--ch-1)');
`,
      },
    },

    /* =====================================================
     * 环节 4 —— 数值标签与类别轴
     * =================================================== */
    {
      id: 's4-labels',
      title: '环节 4 · 数值标签与类别轴',
      subtitle: '柱子给了形状，标签才给出准确读数 —— 别让读者从柱高去「估」。',
      task: [
        "给每根柱子配一个数值标签：selectAll('text.bar-label').data(DATA).join('text')",
        '标签的 x 要落在柱子中心：x(d.major) + x.bandwidth() / 2；y 在柱顶上方 6px',
        "设 text-anchor='middle' 让它水平居中，文字内容就是 d.count",
        '底部再加一条类别轴：d3.axisBottom(x)，放在 y = H - PAD.b 处',
      ],
      hints: [
        '文字和矩形一样是图形元素，绑定数据的方式完全一样：selectAll → data → join。',
        '标签的坐标要自己算：横向 = 柱左缘 + 半个柱宽；纵向 = 柱顶再往上挪一点（y 越小越靠上）。',
        '类别轴用 axisBottom(x)，别忘了 .attr(\'transform\', \'translate(0,\' + (H - PAD.b) + \')\') 把它挪到底部基线。',
      ],
      syntax: [
        { code: ".join('text').text(d => d.count)", note: '文本元素的内容用 .text() 设置，不是 .html()' },
        { code: ".attr('text-anchor', 'middle')", note: '让文字以给定坐标为水平中心（默认是起点/左对齐）' },
        { code: 'x.bandwidth() / 2', note: '半个柱宽 —— 把标签对到柱子正中' },
        { code: 'd3.axisBottom(x)', note: '横轴生成器：domain 里的类别名会自动变成刻度文字' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: 'join(\'text\') 之后不要写 .attr(\'class\', \'bar\')，否则标签会被当成柱子。' },
        { type: 'count', selector: 'text.bar-label', min: 5, label: '每根柱子顶上都写了数值（≥ 5 个 .bar-label）', hint: "selectAll('text.bar-label').data(DATA).join('text') 并 .attr('class', 'bar-label')。" },
        { type: 'text', selector: 'text.bar-label', contains: ['34', '12'], label: '标签写的是真实数值（能看到 34 与 12）', hint: '.text(d => d.count) —— 写成模板串也行。' },
        { type: 'attr', selector: 'text.bar-label', prop: 'text-anchor', mode: 'eq', value: 'middle', label: '标签在柱子上方水平居中', hint: ".attr('text-anchor', 'middle')" },
        { type: 'attr', selector: 'text.bar-label', prop: 'x', mode: 'min', min: 1, label: '标签的 x 坐标落在绘图区内', hint: '.attr(\'x\', d => x(d.major) + x.bandwidth() / 2)' },
        { type: 'exists', selector: 'svg g.axis-x', label: '底部有类别轴 <g class="axis axis-x">', hint: "svg.append('g').attr('class', 'axis axis-x').call(d3.axisBottom(x))" },
        { type: 'text', selector: 'svg g.axis-x', contains: ['软件工程', '物联网'], label: '类别轴上写的是专业名', hint: 'axisBottom(x) 的刻度就是 x.domain() 里的专业名。' },
      ],
      focus: { js: ".style('stroke', 'var(--line)');" },
      solution: {
        js: `// 环节 4 · 数值标签 + 类别轴
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ 数值坐标轴（画在柱子下面）
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ④ 数据绑定：一份数据 → 一根柱子
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(DATA)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', 'var(--ch-1)');

// ⑤ 柱子顶上的数值标签
svg.selectAll('text.bar-label')
  .data(DATA)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

// ⑥ 类别标签（x 轴）
svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');
`,
      },
    },

    /* =====================================================
     * 环节 5 —— 排序与颜色编码
     * =================================================== */
    {
      id: 's5-sort',
      title: '环节 5 · 排序与颜色编码',
      subtitle: '排序把「比较」变成「从上往下扫」；顺序色阶让「大小」在颜色上也读得出来。',
      task: [
        '先把数据排一遍：const SORTED = DATA.slice().sort((a, b) => b.count - a.count)',
        '重设 x 的定义域：x.domain(SORTED.map(d => d.major))',
        '把画柱子与画标签用的数据从 DATA 换成 SORTED',
        '定义顺序色阶 COLOR = d3.scaleSequential(d3.interpolateBlues)，domain 取 [0, 最大值]',
        '柱子的 fill 改成 d => COLOR(d.count)（越大人数越深）',
      ],
      hints: [
        '排序只改「谁排第几」，不用手写任何像素：数据排好、x.domain 重设，位置自动跟着变。',
        'D3 的色阶函数是「连续映射」：scaleSequential 把一个 0→1 的插值器包成「数值 → 颜色」。',
        '注意三处都要用 SORTED：x 的 domain、柱子的 data、标签的 data。只改一处会让柱子与标签错位。',
      ],
      syntax: [
        { code: 'DATA.slice().sort((a, b) => b.count - a.count)', note: '降序排序；slice() 先复制，不污染原始的 DATA' },
        { code: 'x.domain(SORTED.map(d => d.major))', note: '重设定义域 = 重新分配带子的顺序' },
        { code: 'd3.scaleSequential(d3.interpolateBlues)', note: '顺序型色阶：浅 → 深，亮度与数值同向，适合「越大越深」' },
        { code: '.style(\'fill\', d => COLOR(d.count))', note: '把数据项映射成颜色字符串（返回的是 rgb(...) 字符串）' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: '如果报 “COLOR is not a function”，检查色阶是不是写成了 scaleOrdinal。' },
        { type: 'count', selector: 'rect.bar', min: 5, label: '柱子数量还是 5 根', hint: '排序不改变条数；如果变少了，说明 join 的数据源被改没了。' },
        { type: 'order', selector: 'rect.bar', by: 'height', dir: 'desc', label: '柱子按人数从多到少排序（左边最高）', hint: '先把数据排好序，再用排序后的数组当 x 的定义域与 join 的数据。' },
        { type: 'any', label: '颜色深浅随数值变化（色阶或透明度都算）', hint: 'd3.scaleSequential(d3.interpolateBlues).domain([0, max])；不想用色阶就改 fill-opacity。', checks: [
          { type: 'vary', selector: 'rect.bar', prop: 'fill', min: 3, label: '柱子的填充色至少有 3 种', hint: '用顺序色阶把数值映射成颜色。' },
          { type: 'vary', selector: 'rect.bar', prop: 'fill-opacity', min: 2, label: '柱子的填充不透明度至少有 2 种', hint: '.style(\'fill-opacity\', d => …) 也能表达大小。' },
        ] },
        { type: 'order', selector: 'rect.bar', by: 'x', dir: 'asc', label: '排序后柱子仍按 x 依次排开', hint: '排序只影响 domain 顺序，横向位置由 scaleBand 自动分配。' },
        { type: 'text', selector: 'text.bar-label', contains: ['34', '22'], label: '排序后数值标签仍对得上（34、22 都在）', hint: '标签的 data 也要换成 SORTED，否则标签与柱子错位。' },
      ],
      focus: { js: "const bars = svg.append('g')" },
      solution: {
        js: `// 环节 5 · 排序 + 颜色编码
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ 排序：人数多的排左边（先排数据，再重设 x 的定义域）
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

// ④ 顺序色阶：人数越多颜色越深
const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ⑤ 数值坐标轴（画在柱子下面）
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑥ 数据绑定：一份数据 → 一根柱子（用排序后的数据）
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑦ 柱子顶上的数值标签（同样用排序后的数据）
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

// ⑧ 类别标签（x 轴）
svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');
`,
      },
    },

    /* =====================================================
     * 环节 6 —— 悬停高亮与提示
     * =================================================== */
    {
      id: 's6-hover',
      title: '环节 6 · 悬停高亮与提示',
      subtitle: '静态图只能读个大概；加一点交互，用户指哪读哪。',
      task: [
        "鼠标移到柱子上时加一圈描边：.on('mouseover', function () { … })",
        '移开时把描边去掉：.on(\'mouseout\', …)',
        "给每根柱子加一个原生提示：append('title').text(d => d.major + '：' + d.count + ' 人')",
        "顺手把光标变成手型：.style('cursor', 'pointer')",
        '⚠️ 回调里要用 this 选中当前元素时，必须写 function () {}，不能写箭头函数',
      ],
      hints: [
        'D3 的事件用 .on(事件名, 回调) 绑定；回调里的 this 就是「当前这个元素」。',
        '鼠标提示最省事的做法是给元素塞一个 <title> 子元素 —— 浏览器会把它渲染成原生 tooltip，不用自己写浮层。',
        '箭头函数没有自己的 this，它会拿到外层的 this（通常是 window），于是 d3.select(this) 什么也选不中。',
      ],
      syntax: [
        { code: ".on('mouseover', function () { … })", note: '绑定事件；function 写法才能拿到元素自己的 this' },
        { code: 'd3.select(this)', note: '在事件回调里指向触发事件的元素（这就是为什么不能写箭头函数）' },
        { code: ".style('stroke', 'var(--ink)')", note: '加一圈描边做高亮；移开时把值设回 none' },
        { code: ".append('title').text(…)", note: 'SVG 原生提示：塞一个 title 子元素即可' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: '如果报 this 相关错误，把箭头函数换成 function () {}。' },
        { type: 'count', selector: 'rect.bar', min: 5, label: '柱子数量没有因为加交互而改变', hint: '只改样式与事件不会增删柱子；若数量变了，检查是不是又 append 了一遍。' },
        { type: 'count', selector: 'rect.bar > title', min: 5, label: '每根柱子都带了原生提示 <title>', hint: "bars.selectAll('rect.bar').append('title').text(d => …)" },
        { type: 'text', selector: 'rect.bar > title', contains: ['人'], label: '提示里写了人数（例如「数据科学：34 人」）', hint: ".text(d => d.major + '：' + d.count + ' 人')" },
        { type: 'style', selector: 'rect.bar', prop: 'cursor', mode: 'eq', value: 'pointer', label: '鼠标移到柱子上变成手型', hint: ".style('cursor', 'pointer')" },
      ],
      focus: { js: "x.domain(SORTED.map(d => d.major));" },
      solution: {
        js: `// 环节 6 · 悬停高亮 + 原生提示
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ 排序 + 顺序色阶
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ④ 数值坐标轴（画在柱子下面）
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑤ 柱子
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑥ 数值标签 + 类别轴
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑦ 悬停高亮 + 原生提示
bars.selectAll('rect.bar')
  .style('cursor', 'pointer')
  .on('mouseover', function () {
    d3.select(this).style('stroke', 'var(--ink)').style('stroke-width', 2);
  })
  .on('mouseout', function () {
    d3.select(this).style('stroke', 'none').style('stroke-width', 0);
  });

bars.selectAll('rect.bar')
  .append('title')
  .text(d => d.major + '：' + d.count + ' 人');
`,
      },
    },

    /* =====================================================
     * 环节 7 —— 参考线与注释
     * =================================================== */
    {
      id: 's7-guide',
      title: '环节 7 · 参考线与注释',
      subtitle: '一条平均线，能让「谁在平均之上」一眼可见 —— 这就是把结论画进图里。',
      task: [
        '先用 d3.mean(DATA, d => d.count) 算出平均值',
        "画一条横向虚线：svg.append('line').attr('class', 'guide')，x 从 PAD.l 到 W - PAD.r",
        'y1 与 y2 都取 y(MEAN)（同一条水平线），用 stroke-dasharray 做成虚线',
        "再写一句注释：append('text').attr('class', 'annotation')，内容是「平均 22.4 人」",
      ],
      hints: [
        '参考线的坐标全部来自比例尺：纵向位置 = y(MEAN)，横向从左边距到右边距。',
        '平均值用 d3.mean 算，比手写 reduce 更短；记得它是「统计量」，不是像素 —— 还要过一遍 y()。',
        '注释文字要贴着参考线：y 取 y(MEAN) - 6（往上挪一点），text-anchor 取 end 让它靠右收边。',
      ],
      syntax: [
        { code: 'd3.mean(DATA, d => d.count)', note: '取平均值的访问器写法；还有 d3.max / d3.min / d3.sum' },
        { code: "svg.append('line').attr('x1', …).attr('y1', …)", note: 'SVG 线段的四个端点属性：x1 y1 x2 y2' },
        { code: ".style('stroke-dasharray', '5 4')", note: '虚线样式：5 实 4 空；与柱子的实体块形成对比' },
        { code: "svg.append('text').attr('text-anchor', 'end')", note: 'text-anchor=end 表示「以坐标为右端」收边' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: '如果报 “MEAN is not defined”，检查 d3.mean 是不是写在它前面。' },
        { type: 'exists', selector: 'svg line.guide', label: '有一条横向参考线 <line class="guide">', hint: "svg.append('line').attr('class', 'guide')" },
        { type: 'attr', selector: 'line.guide', prop: 'y1', mode: 'min', min: 1, label: '参考线落在绘图区内（y1 > 0）', hint: "y1 与 y2 都取 y(MEAN)，值应该落在 32–272 之间。" },
        { type: 'attr', selector: 'line.guide', prop: 'x2', mode: 'min', min: 200, label: '参考线横跨整个绘图区', hint: ".attr('x1', PAD.l).attr('x2', W - PAD.r)" },
        { type: 'style', selector: 'line.guide', prop: 'stroke-dasharray', mode: 'set', label: '参考线是虚线（和柱子区分开）', hint: ".style('stroke-dasharray', '5 4')" },
        { type: 'exists', selector: 'svg text.annotation', label: '参考线旁有一句注释文字', hint: "svg.append('text').attr('class', 'annotation')" },
        { type: 'text', selector: 'text.annotation', contains: ['平均'], label: '注释说清了这条线是什么（含「平均」）', hint: ".text('平均 ' + MEAN.toFixed(1) + ' 人')" },
      ],
      focus: { js: ".style('cursor', 'pointer')" },
      solution: {
        js: `// 环节 7 · 参考线 + 注释
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ 排序 + 顺序色阶
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ④ 数值坐标轴（画在柱子下面）
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑤ 柱子
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑥ 数值标签 + 类别轴
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑦ 悬停高亮 + 原生提示
bars.selectAll('rect.bar')
  .style('cursor', 'pointer')
  .on('mouseover', function () {
    d3.select(this).style('stroke', 'var(--ink)').style('stroke-width', 2);
  })
  .on('mouseout', function () {
    d3.select(this).style('stroke', 'none').style('stroke-width', 0);
  });

bars.selectAll('rect.bar')
  .append('title')
  .text(d => d.major + '：' + d.count + ' 人');

// ⑧ 参考线：平均值
const MEAN = d3.mean(DATA, d => d.count);

svg.append('line')
  .attr('class', 'guide')
  .attr('x1', PAD.l)
  .attr('x2', W - PAD.r)
  .attr('y1', y(MEAN))
  .attr('y2', y(MEAN))
  .style('stroke', 'var(--ch-6)')
  .style('stroke-width', 1.5)
  .style('stroke-dasharray', '5 4');

svg.append('text')
  .attr('class', 'annotation')
  .attr('x', W - PAD.r)
  .attr('y', y(MEAN) - 6)
  .attr('text-anchor', 'end')
  .style('fill', 'var(--ch-6)')
  .style('font-size', '12px')
  .text('平均 ' + MEAN.toFixed(1) + ' 人');
`,
      },
    },

    /* =====================================================
     * 环节 8 —— 自检与导出
     * =================================================== */
    {
      id: 's8-finish',
      title: '环节 8 · 自检与导出',
      subtitle: '加上标题、跑一遍全部检查点，然后把它导出成一个能双击打开的 .svg。',
      task: [
        "给图加一个标题：append('text').attr('class', 'chart-title')，内容是「各专业新生人数（2025 级）」",
        '标题用加粗字体（font-weight 700）、放在左上角（x = PAD.l, y ≈ 20）',
        '从上到下自查一遍：画布 1 块、柱子 5 根、y 轴 1 条、参考线 1 条、标题 1 个',
        '点右上角「⬇ 导出 SVG」把成品存下来，再用浏览器双击打开看看是否正常',
      ],
      hints: [
        '标题是普通 text 元素，写法和数值标签一样，只是不需要绑定数据。',
        '自查就是把这 8 个环节的检查点连起来重跑一遍 —— 点「✅ 检查本环节」会同时验证它们。',
        '导出的是「预览里真实渲染出来的 SVG」，所以脚本、交互都不会丢，但也不包含 HTML 外壳。',
      ],
      syntax: [
        { code: ".style('font-weight', 700)", note: '数字权重 700 ≈ bold；比字符串形式的 bold 更精确' },
        { code: ".attr('class', 'chart-title')", note: '给元素起稳定的类名，导出与二次编辑时都好定位' },
        { code: 'new XMLSerializer().serializeToString(svg)', note: '把 DOM 里的 SVG 变成可写进文件的字符串（工作台的导出按钮就这么做）' },
        { code: "d3.mean(DATA, d => d.count).toFixed(1)", note: 'toFixed(1) 保留一位小数，避免注释出现 22.400000000000002' },
      ],
      checks: [
        { type: 'noError', label: '代码运行没有报错', hint: '导出前先确认预览里没有红色报错。' },
        { type: 'exists', selector: 'svg text.chart-title', label: '图上有一个标题 <text class="chart-title">', hint: "svg.append('text').attr('class', 'chart-title')" },
        { type: 'text', selector: 'text.chart-title', contains: ['人数'], label: '标题说清了这张图在讲什么', hint: ".text('各专业新生人数（2025 级）')" },
        { type: 'style', selector: 'text.chart-title', prop: 'font-weight', mode: 'min', min: 600, label: '标题比刻度文字更醒目（加粗）', hint: ".style('font-weight', 700)" },
        { type: 'svgCount', n: 1, label: '整页仍然只有 1 块画布（没有重复 append）', hint: '重复建画布会让导出的 SVG 里混进空白画布。' },
        { type: 'count', selector: 'rect.bar', eq: 5, label: '正好 5 根柱子（不多不少）', hint: '数据一共 5 条，多出来通常是 join 用了没去重的数组。' },
        { type: 'exists', selector: 'svg g.axis-y', label: '数值坐标轴还在', hint: '别在收尾时把前面的代码删掉了。' },
        { type: 'exists', selector: 'svg line.guide', label: '平均参考线还在', hint: "line.guide 应该在排序后的数据下仍然落在图里。" },
        { type: 'atWidth', width: 375, label: '窄屏（375px）下画布不会横向溢出', hint: '给 svg 只设 attribute 宽度即可，沙箱的样式会把 max-width 限制在 100%。', checks: [
          { type: 'bbox', selector: 'svg.chart', dim: 'width', max: 400, label: '375px 下 svg 渲染宽度 ≤ 400px', hint: 'svg 的 width 是固定值，靠 max-width:100% 收窄。' },
        ] },
      ],
      focus: { js: ".text('平均 ' + MEAN.toFixed(1) + ' 人');" },
      solution: {
        js: `// 环节 8 · 标题 + 收尾（成品）
const DATA = [
  { major: '软件工程', count: 22 },
  { major: '数据科学', count: 34 },
  { major: '计算机',   count: 18 },
  { major: '人工智能', count: 26 },
  { major: '物联网',   count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① 画布
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② 比例尺
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ 排序 + 顺序色阶
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ④ 数值坐标轴（画在柱子下面）
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑤ 柱子
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑥ 数值标签 + 类别轴
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑦ 悬停高亮 + 原生提示
bars.selectAll('rect.bar')
  .style('cursor', 'pointer')
  .on('mouseover', function () {
    d3.select(this).style('stroke', 'var(--ink)').style('stroke-width', 2);
  })
  .on('mouseout', function () {
    d3.select(this).style('stroke', 'none').style('stroke-width', 0);
  });

bars.selectAll('rect.bar')
  .append('title')
  .text(d => d.major + '：' + d.count + ' 人');

// ⑧ 参考线 + 注释
const MEAN = d3.mean(DATA, d => d.count);

svg.append('line')
  .attr('class', 'guide')
  .attr('x1', PAD.l)
  .attr('x2', W - PAD.r)
  .attr('y1', y(MEAN))
  .attr('y2', y(MEAN))
  .style('stroke', 'var(--ch-6)')
  .style('stroke-width', 1.5)
  .style('stroke-dasharray', '5 4');

svg.append('text')
  .attr('class', 'annotation')
  .attr('x', W - PAD.r)
  .attr('y', y(MEAN) - 6)
  .attr('text-anchor', 'end')
  .style('fill', 'var(--ch-6)')
  .style('font-size', '12px')
  .text('平均 ' + MEAN.toFixed(1) + ' 人');

// ⑨ 图表标题（收尾）
svg.append('text')
  .attr('class', 'chart-title')
  .attr('x', PAD.l)
  .attr('y', 20)
  .style('fill', 'var(--ink)')
  .style('font-size', '14px')
  .style('font-weight', 700)
  .text('各专业新生人数（2025 级）');
`,
      },
    },
  ],
};
