// =========================================================
// practice-data.js —— 「实战环节」案例数据（中文版）
// ---------------------------------------------------------
// 内容直接复用第 9 章《综合案例：作品集网站》的 8 个步骤，
// 形成闭环：先看老师做一遍（第 9 章）→ 自己动手做一遍（本页）。
//
// 刻意用「普通 script」而不是 ES Module，理由同 quiz-data.js：
//   这样即使用 file:// 直接双击打开，实战环节也能正常工作。
//
// 数据结构：
//   window.PRACTICE_CASE = {
//     id, title, subtitle, lesson,        // lesson = 对应章节链接
//     brief:   { goal, audience, success, deliverable },
//     baseCss: '…',                        // 案例提供、注入预览、不计入学生代码
//     baseNote:'…',                        // 告诉学生"这些不用你写"
//     assets:  [ { label, value } ],        // 必要文案，可一键插入编辑器
//     steps:   [ {
//        id, title, subtitle, learn: [],   // 环节元信息（learn = 对应知识点标签）
//        task:    [ '要求 1', '要求 2' ],   // 本环节要完成的事
//        focus:   { html, css },           // 光标定位锚点（打开环节时跳到这里）
//        hints:   [ '思路', '关键属性', '兜底' ],   // 三级递进提示
//        syntax:  [ { code, note } ],      // 语法速查
//        checks:  [ … ],                   // 检查点（见下方 type 一览）
//        solution:{ html, css }            // 参考答案
//     } ]
//   }
//
// checks 支持的 type（全部基于"最终渲染结果 + 计算样式"判定，
// 不做代码文本比对 —— 学生怎么写、类名取什么，只要效果达标就算过）：
//   exists      { selector }                        元素存在
//   count       { selector, min }                   元素数量 ≥ min
//   order       { selectors: [] }                   这些区块自上而下依次排列
//   style       { selector, prop, expect }          计算样式 === expect
//   styleMin    { selector, prop, min }             计算样式数值 ≥ min
//   styleMax    { selector, prop, max }             计算样式数值 ≤ max
//   weightMin   { selector, min }                   font-weight ≥ min
//   bgSet       { selector }                        背景色不是透明
//   columns     { selector, min, max }              网格轨道数量
//   colsCompare { selector, expect }                两列宽窄：'firstGreater' | 'secondGreater'
//   sameRow     { selector, min }                   至少 min 个元素在同一行
//   ratio       { selector, expect, tolerance }     宽高比 ≈ expect
//   centered    { selector }                        水平居中（左右留白差 ≤ 4px）
//   cssVar      { name, expect }                    html 上的 CSS 变量值
//   atWidth     { width, checks: [] }               在指定预览宽度下执行子检查
//
// ⚠️ 学生代码写在 <textarea> 里、在沙箱 iframe 中渲染，
//    因此答案对用户可见（F12）。本功能定位为「动手练习」，不是考试。
// =========================================================
window.PRACTICE_CASE = {

  id: 'portfolio',
  title: '实战案例 · 个人作品集网站',
  subtitle: '按真实开发流程，把第 1–9 章的知识点一步步搭成一个能打开的页面',
  lesson: 'lesson-09/',

  /* ---------------- 案例要求（对应 9.1 的"先问目标"） ---------------- */
  brief: {
    goal: '让访客在 10 秒内知道「我是谁、我能做什么」，并愿意联系我。',
    audience: '招聘方、合作方。',
    success: '访客看完作品集后点击「联系我」。',
    deliverable: '一个完整页面：导航 + 首屏 + 关于我 + 作品集 + 数据统计 + 页脚。',
  },

  /* ---------------- 预览自带的基础样式（不用学生写） ---------------- */
  baseNote: '预览里已自带：box-sizing: border-box、body 的 margin 与字体、h1–h4/ul/a/img 的重置，'
          + '以及配色令牌（--c-primary、--c-text、--c-border、--radius…）。你不用重复写这些，专注布局即可。',

  baseCss: `
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: var(--c-text);
  background: var(--c-bg);
}

h1, h2, h3, h4 { line-height: 1.3; margin: 0; }
p { margin: 0; }
ul { margin: 0; padding: 0; list-style: none; }
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }

/* ---- 配色令牌：案例给定的设计规范，直接 var() 使用 ---- */
:root {
  --c-primary: #0f766e;
  --c-primary-2: #0d9488;
  --c-accent: #ea580c;
  --c-text: #1e2a32;
  --c-text-soft: #5b6b76;
  --c-muted: #8a97a0;
  --c-bg: #faf9f7;
  --c-surface: #ffffff;
  --c-surface-2: #f4f2ee;
  --c-border: #e6e2da;
  --radius-sm: 8px;
  --radius: 12px;
  --radius-pill: 999px;
}
`,

  /* ---------------- 必要文案数据（一键插入编辑器光标处） ---------------- */
  assets: [
    { label: '姓名 / Logo', value: '李雷' },
    { label: '主标题', value: '你好，我是李雷' },
    { label: '副标题', value: '专注页面布局与交互实现，做过 40+ 个项目。' },
    { label: '菜单项', value: '作品 / 关于 / 联系' },
    { label: '关于我 · 第 1 段', value: '5 年前端开发经验，擅长把设计稿还原成结构清晰的页面。' },
    { label: '关于我 · 第 2 段', value: '相信「布局是内容的一部分」——同一个页面换个排法，可读性完全不同。' },
    { label: '作品标题', value: '数据看板 / 图表组件库 / 校园导航 / 天气可视化' },
    { label: '统计项', value: '42 个已完成项目 / 5 年经验 / 18 位合作客户' },
    { label: '页脚标题', value: '一起做点什么？' },
    { label: '联系邮箱', value: 'lilei@example.com' },
  ],

  /* ---------------- 第 1 个环节的起始代码（学生从这里开始写） ---------------- */
  startCode: {
    html: `<!-- ① 在这里搭出页面的 6 个区块：导航 / 首屏 / 关于我 / 作品集 / 数据统计 / 页脚 -->
<!-- 每个区块用语义标签 + 类名，先各放一个标题即可 -->`,
    css: `/* 环节 1 只搭结构，先不写样式 */`,
  },

  steps: [
    /* =====================================================
     * 环节 1 —— 页面骨架（对应 9.1 / 第 2 章）
     * =================================================== */
    {
      id: 'p-1',
      title: '环节 1 · 搭出页面骨架',
      subtitle: '先定结构，再谈样式',
      learn: ['第 2 章 从需求到页面骨架'],
      task: [
        '把 6 个区块按顺序搭出来：顶部导航 → 首屏 → 关于我 → 作品集 → 数据统计 → 页脚。',
        '每个区块先只放一个标题，内部结构留到后面的环节再补。',
        '本环节不写 CSS —— 结构定下来之前，改样式是浪费。',
        '用 `<header>` / `<section>` / `<footer>` 这类语义标签，而不是一堆 `<div>`。',
      ],
      focus: { html: '<!-- ① 在这里搭出', css: '/* 环节 1' },
      hints: [
        '先想「页面上从上到下有哪些块」：导航、首屏、关于、作品、数据、页脚，一共 6 块。',
        '每块最外层用一个语义标签 + 一个类名，类名就写「它是什么」：site-header / hero / about / works / stats / site-footer。',
        '结构示例：<header class="site-header"><div class="inner">…</div></header>，其余五块都是 <section class="…">…</section>，最后一块用 <footer>。',
      ],
      syntax: [
        { code: '<header> / <section> / <footer>', note: '语义化容器，比 div 多了「这是什么」的信息' },
        { code: 'class="hero"', note: '类名用「它是什么」命名，不要用「它长什么样」（如 .blue-left）' },
      ],
      checks: [
        { type: 'count', selector: 'section', min: 4, label: '至少 4 个 <section> 区块' },
        { type: 'exists', selector: 'header.site-header', label: '存在 <header class="site-header">' },
        { type: 'exists', selector: 'section.hero', label: '存在 section.hero' },
        { type: 'exists', selector: 'section.about', label: '存在 section.about' },
        { type: 'exists', selector: 'section.works', label: '存在 section.works' },
        { type: 'exists', selector: 'section.stats', label: '存在 section.stats' },
        { type: 'exists', selector: 'footer.site-footer', label: '存在 <footer class="site-footer">' },
        {
          type: 'order',
          selectors: ['header.site-header', 'section.hero', 'section.about', 'section.works', 'section.stats', 'footer.site-footer'],
          label: '6 个区块自上而下的顺序正确',
        },
      ],
      solution: {
        html: `<!-- ① 顶部导航 -->
<header class="site-header">
  <div class="inner">
    <a class="logo" href="#">李雷</a>
  </div>
</header>

<!-- ② 首屏 -->
<section class="hero">
  <div class="grid">
    <h1>你好，我是李雷</h1>
  </div>
</section>

<!-- ③ 关于我 -->
<section class="about" id="about">
  <div class="grid">
    <h2>关于我</h2>
  </div>
</section>

<!-- ④ 作品集 -->
<section class="works" id="works">
  <div class="wall">
    <h2>作品集</h2>
  </div>
</section>

<!-- ⑤ 数据统计 -->
<section class="stats">
  <div class="stats-grid">
    <h2>数据统计</h2>
  </div>
</section>

<!-- ⑥ 页脚 / 联系方式 -->
<footer class="site-footer" id="contact">
  <h2>一起做点什么？</h2>
</footer>
`,
        css: `/* 本环节只搭结构，先不写样式 */
`,
      },
    },
    /* =====================================================
     * 环节 2 —— 容器、栅格与间距档位（对应 9.2 / 第 3 章）
     * =================================================== */
    {
      id: 'p-2',
      title: '环节 2 · 装上统一的刻度',
      subtitle: '容器 + 12 列栅格 + 8pt 间距档位',
      learn: ['第 3 章 栅格系统与间距节奏', '第 1 章 对齐'],
      task: [
        '在 `:root` 里定义间距档位：`--space-sm: 8px`、`--space: 16px`、`--space-lg: 24px`、`--space-xl: 40px`。',
        '写 `.container`：内容最大宽度 1180px，两侧至少留 24px，并且水平居中。',
        '写 `.grid`：12 列栅格，列间距用 `var(--space-lg)`。',
        '给每个区块的内容套上容器：导航的 `<div class="inner">` 改成 `container inner`，其余区块的内容层加 `container`。',
        '⚠️ 不要写死 `width: 1180px` —— 那样窄屏会横向溢出。',
      ],
      focus: { html: 'class="inner"', css: '' },
      hints: [
        '这一环节只做三件事：定间距档位、定容器、定栅格。它们一次定义、全站复用，是所有对齐的"基准"。',
        '容器要"大屏最多 1180、小屏留边距、永远居中"：`width: min(100% - 48px, 1180px)` + `margin-inline: auto`。12 列栅格就是 `display: grid` + `grid-template-columns: repeat(12, 1fr)`。',
        '兜底写法（照抄可过）：:root 里放 --space-sm: 8px / --space: 16px / --space-lg: 24px / --space-xl: 40px；.container 用 width: min(100% - 48px, 1180px) 加 margin-inline: auto；.grid 用 display: grid + grid-template-columns: repeat(12, 1fr) + gap: var(--space-lg)。',
      ],
      syntax: [
        { code: 'width: min(100% - 48px, 1180px);', note: '一行同时表达「小屏留 24px 边距、大屏最多 1180px」' },
        { code: 'margin-inline: auto;', note: '水平居中（左右外边距都是 auto）' },
        { code: 'grid-template-columns: repeat(12, 1fr);', note: '12 列等宽轨道；12 能被 2/3/4/6 整除，好拆版式' },
        { code: 'gap: var(--space-lg);', note: '列间距统一走间距档位，不写死像素' },
      ],
      checks: [
        { type: 'cssVar', name: '--space-lg', expect: '24px', label: '定义了间距档位 --space-lg: 24px' },
        { type: 'exists', selector: '.container', label: '存在 .container 容器' },
        { type: 'styleMin', selector: '.container', prop: 'width', min: 600, label: '.container 有实际宽度（不是写死的 1180 溢出或过窄）' },
        { type: 'styleMax', selector: '.container', prop: 'width', max: 1181, label: '.container 宽度不超过 1180px' },
        { type: 'centered', selector: '.container', label: '.container 水平居中' },
        { type: 'count', selector: '.container', min: 5, label: '至少 5 个区块用上了容器' },
        { type: 'style', selector: '.grid', prop: 'display', expect: 'grid', label: '.grid 是 Grid 容器' },
        { type: 'columns', selector: '.grid', min: 12, max: 12, label: '.grid 正好是 12 列' },
        { type: 'styleMin', selector: '.grid', prop: 'columnGap', min: 20, label: '.grid 的列间距 ≥ 20px' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">李雷</a>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <h1>你好，我是李雷</h1>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <h2>关于我</h2>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>作品集</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>数据统计</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
`,
        css: `/* ① 间距档位：全站所有间距都从这里取值（8pt 体系） */
:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

/* ② 容器：大屏最多 1180px，小屏两侧留 24px，永远居中 */
.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

/* ③ 12 列栅格：一次定义，全站复用 */
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}
`,
      },
    },
    /* =====================================================
     * 环节 3 —— 顶部导航栏（对应 9.3 / 第 6、8 章）
     * =================================================== */
    {
      id: 'p-3',
      title: '环节 3 · 顶部导航栏',
      subtitle: '全站第一个对齐示范',
      learn: ['第 6 章 Flexbox 弹性布局', '第 8 章 position: sticky', '第 1 章 亲密性'],
      task: [
        '先补 HTML：在 `.inner` 里加一个 `<nav>`，里面放 3 个菜单链接（作品 / 关于 / 联系），并让它们指向 `#works` `#about` `#contact`。',
        '让 `.site-header` 吸顶：`position: sticky` + `top: 0`，再加一个 `z-index` 让它盖住下面的内容。',
        '在 `.inner` 上用 Flex 让 Logo 与菜单分列两端，并让它们垂直居中，高度 60px。',
        '`nav` 本身也做成 Flex，菜单项之间用 `gap` 收紧（形成一组）。',
        '⚠️ 不要用 `position: fixed` 吸顶 —— 它不保留占位，下面的内容会跳上来。',
      ],
      focus: { html: 'container inner', css: '' },
      hints: [
        '导航栏只解决两件事：怎么排（Logo 在左、菜单在右），以及要不要吸顶。别一上来就写圆角和阴影。',
        'Logo 和 `<nav>` 是 `.inner` 的两个子元素，所以给 `.inner` 写 display: flex + justify-content: space-between + align-items: center；菜单本身也是一组，给 nav 写 display: flex + gap: 6px。',
        '吸顶三行别漏：position: sticky; top: 0; z-index: 50; —— 只写 sticky 不写 top，它不会吸附。',
      ],
      syntax: [
        { code: 'position: sticky; top: 0;', note: '吸顶，且保留原本占位（区别于 fixed）' },
        { code: 'justify-content: space-between;', note: '主轴两端对齐：第一个贴左、最后一个贴右' },
        { code: 'align-items: center;', note: '交叉轴居中，文字不会偏向顶部' },
        { code: 'gap: 6px;', note: '只控制「项与项之间」的距离，比给每个子元素写 margin 干净' },
      ],
      checks: [
        { type: 'style', selector: '.site-header', prop: 'position', expect: 'sticky', label: '导航栏用 position: sticky 吸顶' },
        { type: 'style', selector: '.site-header', prop: 'top', expect: '0px', label: '导航栏 top: 0（不写 top 时 sticky 不生效）' },
        { type: 'style', selector: '.site-header .inner', prop: 'display', expect: 'flex', label: '.inner 用 Flex 排布' },
        { type: 'style', selector: '.site-header .inner', prop: 'justifyContent', expect: 'space-between', label: 'Logo 与菜单分列两端' },
        { type: 'style', selector: '.site-header .inner', prop: 'alignItems', expect: 'center', label: '.inner 交叉轴居中' },
        { type: 'styleMin', selector: '.site-header .inner', prop: 'height', min: 56, label: '导航栏高度 ≥ 56px' },
        { type: 'style', selector: '.site-header nav', prop: 'display', expect: 'flex', label: '菜单是一组（nav 用 Flex）' },
        { type: 'count', selector: '.site-header nav a', min: 3, label: '菜单里至少 3 个链接' },
        { type: 'styleMin', selector: '.site-header nav', prop: 'gap', min: 4, label: '菜单项之间用 gap 收紧（≥ 4px）' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">李雷</a>
    <nav>
      <a href="#works">作品</a>
      <a href="#about">关于</a>
      <a href="#contact">联系</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <h1>你好，我是李雷</h1>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <h2>关于我</h2>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>作品集</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>数据统计</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
`,
        css: `/* ① 间距档位：全站所有间距都从这里取值（8pt 体系） */
:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

/* ② 容器：大屏最多 1180px，小屏两侧留 24px，永远居中 */
.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

/* ③ 12 列栅格：一次定义，全站复用 */
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}

/* ④ 导航栏：吸顶 + 两端分布（第 6、8 章） */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}

.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  height: 60px;
}

/* Logo 是品牌，比菜单更强一级：深色 + 加粗 */
.site-header .logo {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-text);
}

.site-header nav {
  display: flex;
  gap: 6px;
}

.site-header nav a {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  color: var(--c-text-soft);
  font-size: 14px;
  font-weight: 600;
}

.site-header nav a:hover {
  background: var(--c-surface-2);
  color: var(--c-text);
}
`,
      },
    },
    /* =====================================================
     * 环节 4 —— 首屏 Hero（对应 9.4 / 第 1、6、7 章）
     * =================================================== */
    {
      id: 'p-4',
      title: '环节 4 · 首屏 Hero',
      subtitle: '决定「访客是否留下」的一屏',
      learn: ['第 1 章 对比与视觉层次', '第 1 章 非对称平衡', '第 7 章 Grid 分栏'],
      task: [
        '先补 HTML：在 `.hero` 的 `.grid` 里放左侧文字栏（`<h1>` + `<p class="lead">` + `<a class="cta">`）和右侧头像块 `<div class="avatar">`。',
        '`.hero` 上下用最大的档位 `var(--space-xl)` 留白。',
        '`.hero .grid` 改成两栏 `7fr 5fr`，并让左右两栏垂直居中。',
        '标题是唯一主角：字号 ≥ 30px（可用 `clamp()` 做响应式字号）；副标题弱化成灰色。',
        '按钮用主色背景 + 白色文字 + 胶囊圆角；头像块保持正方形（`aspect-ratio: 1 / 1`），里面的图片用 `object-fit: cover` 裁切、容器加 `overflow: hidden` 收口圆角。',
      ],
      focus: { html: '<h1>', css: '' },
      hints: [
        'Hero 里只能有一个主角。如果标题、头像、按钮都在抢注意力，访客反而不知道看哪 —— 先把标题做强，再把其他元素依次减弱。',
        '两栏比例写在 `.hero .grid` 上：grid-template-columns: 7fr 5fr。它会覆盖环节 2 那套 12 列（.hero .grid 比 .grid 更具体）。左侧比右侧宽，就是非对称平衡。',
        '兜底片段：.hero { padding: var(--space-xl) 0; }；.hero .grid { grid-template-columns: 7fr 5fr; align-items: center; }；.hero h1 { font-size: clamp(30px, 4vw, 46px); }；.hero .lead { color: var(--c-text-soft); }；.hero .cta { background: var(--c-primary); color: #fff; border-radius: var(--radius-pill); }；.hero .avatar { aspect-ratio: 1 / 1; overflow: hidden; border-radius: var(--radius); }；.hero .avatar img { width: 100%; height: 100%; object-fit: cover; }',
      ],
      syntax: [
        { code: 'grid-template-columns: 7fr 5fr;', note: '左 7 右 5：非对称但视觉平衡，比 1fr 1fr 更有重点' },
        { code: 'clamp(30px, 4vw, 46px)', note: '字号随视口伸缩，但有上下限，小屏不会挤爆' },
        { code: 'aspect-ratio: 1 / 1;', note: '只需给宽度，高度按比例自动算出来' },
        { code: 'display: grid; place-items: center;', note: '一行实现「水平 + 垂直」居中' },
        { code: 'color: var(--c-text-soft);', note: '把次要信息调灰 = 主动弱化，比拼命放大主角更有效' },
      ],
      checks: [
        { type: 'styleMin', selector: '.hero h1', prop: 'fontSize', min: 30, label: '主标题字号 ≥ 30px（全场最大）' },
        { type: 'styleMin', selector: '.hero', prop: 'paddingTop', min: 40, label: '.hero 上下留白 ≥ 40px' },
        { type: 'columns', selector: '.hero .grid', min: 2, max: 2, label: '.hero .grid 是两栏' },
        { type: 'colsCompare', selector: '.hero .grid', expect: 'firstGreater', label: '左栏比右栏宽（非对称平衡）' },
        { type: 'style', selector: '.hero .grid', prop: 'alignItems', expect: 'center', label: '左右两栏垂直居中' },
        { type: 'bgSet', selector: '.hero .cta', label: '按钮有实色背景（唯一的高对比元素）' },
        { type: 'ratio', selector: '.hero .avatar', expect: 1, tolerance: 0.2, label: '头像块近似正方形' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">李雷</a>
    <nav>
      <a href="#works">作品</a>
      <a href="#about">关于</a>
      <a href="#contact">联系</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>你好，我是李雷<br />一名前端工程师</h1>
      <p class="lead">专注页面布局与交互实现，做过 40+ 个项目。</p>
      <a class="cta" href="#works">查看作品 →</a>
    </div>
    <div class="avatar" aria-hidden="true"><img src="figs/李雷证件照.png" alt=""></div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <h2>关于我</h2>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>作品集</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>数据统计</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
`,
        css: `:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}

/* 导航栏：吸顶 + 两端分布 */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}

.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  height: 60px;
}

/* Logo 是品牌，比菜单更强一级：深色 + 加粗 */
.site-header .logo {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-text);
}

.site-header nav {
  display: flex;
  gap: 6px;
}

.site-header nav a {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  color: var(--c-text-soft);
  font-size: 14px;
  font-weight: 600;
}

.site-header nav a:hover {
  background: var(--c-surface-2);
  color: var(--c-text);
}

/* 首屏 Hero：留白 + 非对称两栏 + 层次 */
.hero {
  padding: var(--space-xl) 0;
}

.hero .grid {
  grid-template-columns: 7fr 5fr;
  align-items: center;
}

.hero h1 {
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.2;
  margin-bottom: var(--space);
}

.hero .lead {
  font-size: 17px;
  color: var(--c-text-soft);
  margin-bottom: var(--space-lg);
}

.hero .cta {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  background: var(--c-primary);
  color: #fff;
  font-weight: 700;
}

.hero .cta:hover {
  background: var(--c-primary-2);
}

/* 头像：固定正方形；图片用 cover 裁切，不拉伸变形，圆角由容器统一收口 */
.hero .avatar {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  box-shadow: 0 18px 40px rgba(15, 118, 110, 0.18);
}

.hero .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
`,
      },
    },
    /* =====================================================
     * 环节 5 —— 关于我（对应 9.5 / 第 1、7 章）
     * =================================================== */
    {
      id: 'p-5',
      title: '环节 5 · 关于我（双栏）',
      subtitle: '图文混排：比例比「均分」更重要',
      learn: ['第 7 章 Grid 分栏', '第 1 章 亲密性与节奏', '第 1 章 对齐方式选择'],
      task: [
        '先补 HTML：把 `.about` 的内容层改成左侧头像块 `<div class="portrait">` + 右侧文字栏（`<h2>` + 两段 `<p>`）。',
        '`.about .grid` 用 `4fr 8fr`（图 4 : 文 8）—— 不要用 `1fr 1fr`。',
        '长文配图用顶对齐：`align-items: start`（Hero 用的是 center，这里不同）。',
        '段落行高调到 1.8–2.0，段间距用 `var(--space)`，让「段内紧、段间松」。',
        '头像块用 `aspect-ratio: 4 / 5` 保持统一比例。',
      ],
      focus: { html: '<h2>关于我</h2>', css: '' },
      hints: [
        '双栏不是「一分为二」。图片是视觉信息、文字是阅读信息，文字应该拿到更多宽度 —— 常见分法是 4:8 或 5:7。',
        '比例还是写在 `.about .grid` 上：grid-template-columns: 4fr 8fr，同时加 align-items: start。注意它与 Hero 的区别：Hero 内容短用 center，这里文字长必须顶对齐，否则读者的目光起点会乱。',
        '兜底片段：.about { padding: var(--space-xl) 0; }；.about .grid { grid-template-columns: 4fr 8fr; align-items: start; gap: var(--space-xl); }；.about .portrait { aspect-ratio: 4 / 5; display: grid; place-items: center; border-radius: var(--radius); background: var(--c-primary-2); color: #fff; }（块里放姓名首字或真实照片都可以）；.about p { color: var(--c-text-soft); line-height: 1.9; margin-bottom: var(--space); }',
      ],
      syntax: [
        { code: 'grid-template-columns: 4fr 8fr;', note: '图 4 : 文 8，让文字行不至于过长' },
        { code: 'align-items: start;', note: '顶对齐：长文字块不要被「居中」拉扯' },
        { code: 'line-height: 1.9;', note: '中文长段落行高 1.8–2.0 最舒服' },
        { code: 'aspect-ratio: 4 / 5;', note: '人像常用竖构图比例' },
      ],
      checks: [
        { type: 'exists', selector: '.about .portrait', label: '存在左侧头像块 .portrait' },
        { type: 'count', selector: '.about p', min: 2, label: '右侧至少有 2 段文字' },
        { type: 'columns', selector: '.about .grid', min: 2, max: 2, label: '.about .grid 是两栏' },
        { type: 'colsCompare', selector: '.about .grid', expect: 'secondGreater', label: '文字栏比图片栏宽（不是 1:1 均分）' },
        { type: 'style', selector: '.about .grid', prop: 'alignItems', expect: 'start', label: '双栏用顶对齐' },
        { type: 'ratio', selector: '.about .portrait', expect: 0.8, tolerance: 0.2, label: '头像块比例接近 4:5' },
        { type: 'styleMin', selector: '.about p', prop: 'lineHeight', min: 28, label: '段落行高 ≥ 28px（约 1.75 倍，长段落更好读）' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">李雷</a>
    <nav>
      <a href="#works">作品</a>
      <a href="#about">关于</a>
      <a href="#contact">联系</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>你好，我是李雷<br />一名前端工程师</h1>
      <p class="lead">专注页面布局与交互实现，做过 40+ 个项目。</p>
      <a class="cta" href="#works">查看作品 →</a>
    </div>
    <div class="avatar" aria-hidden="true"><img src="figs/李雷证件照.png" alt=""></div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true"><span class="mono">李</span></div>
    <div>
      <h2>关于我</h2>
      <p>5 年前端开发经验，擅长把设计稿还原成结构清晰的页面。</p>
      <p>相信「布局是内容的一部分」—— 同一个页面换个排法，可读性完全不同。</p>
    </div>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>作品集</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>数据统计</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
`,
        css: `:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}

/* 导航栏 */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}

.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  height: 60px;
}

/* Logo 是品牌，比菜单更强一级：深色 + 加粗 */
.site-header .logo {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-text);
}

.site-header nav {
  display: flex;
  gap: 6px;
}

.site-header nav a {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  color: var(--c-text-soft);
  font-size: 14px;
  font-weight: 600;
}

.site-header nav a:hover {
  background: var(--c-surface-2);
  color: var(--c-text);
}

/* 首屏 Hero */
.hero {
  padding: var(--space-xl) 0;
}

.hero .grid {
  grid-template-columns: 7fr 5fr;
  align-items: center;
}

.hero h1 {
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.2;
  margin-bottom: var(--space);
}

.hero .lead {
  font-size: 17px;
  color: var(--c-text-soft);
  margin-bottom: var(--space-lg);
}

.hero .cta {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  background: var(--c-primary);
  color: #fff;
  font-weight: 700;
}

.hero .cta:hover {
  background: var(--c-primary-2);
}

/* 头像：固定正方形；图片用 cover 裁切，不拉伸变形，圆角由容器统一收口 */
.hero .avatar {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  box-shadow: 0 18px 40px rgba(15, 118, 110, 0.18);
}

.hero .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 关于我：图 4 : 文 8，顶对齐 */
.about {
  padding: var(--space-xl) 0;
}

.about .grid {
  grid-template-columns: 4fr 8fr;
  align-items: start;
  gap: var(--space-xl);
}

/* 名片块：品牌色渐变 + 姓名首字 monogram，本身就是一张正式配图
   （::before 的内圈细线做出「名片」质感；放真实照片时结构同样适用） */
.about .portrait {
  aspect-ratio: 4 / 5;
  position: relative;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(160deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
}

.about .portrait::before {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: calc(var(--radius) - 4px);
}

.about .portrait .mono {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
}

.about h2 {
  font-size: 24px;
  margin-bottom: var(--space);
}

.about p {
  color: var(--c-text-soft);
  line-height: 1.9;
  margin-bottom: var(--space);
}
`,
      },
    },
    /* =====================================================
     * 环节 6 —— 作品集卡片墙（对应 9.6 / 第 1、3、5、6、7 章）
     * =================================================== */
    {
      id: 'p-6',
      title: '环节 6 · 作品集卡片墙',
      subtitle: '案例的核心区块：一屏展示多个作品',
      learn: ['第 7 章 auto-fit 自动填充', '第 1 章 重复与统一', '第 6 章 卡片内纵向 Flex'],
      task: [
        '先补 HTML：把 `<h2>作品集</h2>` 移到 `.wall` 外面，然后在 `.wall` 里放 4 张 `<article class="work-card">`。',
        '每张卡片结构：缩略图 `<div class="thumb">` + 标题 `<h3>` + 说明 `<p class="meta">` + 底部链接 `<a class="more">`。',
        '`.wall` 用 `repeat(auto-fit, minmax(260px, 1fr))` 自适应列数 —— 不需要写媒体查询。',
        '`.work-card` 做成纵向 Flex，让底部的「查看详情」用 `margin-top: auto` 贴到卡片底部。',
        '缩略图用 `aspect-ratio: 16 / 10` 统一比例，避免整面墙高低不平。',
      ],
      focus: { html: 'class="wall"', css: '' },
      hints: [
        '卡片墙的关键是「重复」：4 张卡片的圆角、内边距、边框完全一致，整面墙才有成套感。',
        '列数交给浏览器算：grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) —— 宽屏列多、窄屏列少。卡片内部用 display: flex + flex-direction: column，再给 .more 加 margin-top: auto，它就会被推到最底部。',
        '兜底片段：.wall { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-lg); }；.work-card { display: flex; flex-direction: column; min-width: 0; padding: var(--space); background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); }；.work-card .thumb { aspect-ratio: 16 / 10; border-radius: var(--radius-sm); overflow: hidden; }；.work-card .thumb img { width: 100%; height: 100%; object-fit: cover; }；.work-card .more { margin-top: auto; color: var(--c-primary); }',
      ],
      syntax: [
        { code: 'repeat(auto-fit, minmax(260px, 1fr))', note: '自动决定列数：每列不小于 260px，剩余空间等分' },
        { code: 'flex-direction: column;', note: '把横向 Flex 转成纵向' },
        { code: 'margin-top: auto;', note: '在 Flex 里吃掉剩余空间 → 把元素推到最底部' },
        { code: 'aspect-ratio: 16 / 10;', note: '缩略图统一比例，高度自动算' },
      ],
      checks: [
        { type: 'count', selector: '.wall .work-card', min: 4, label: '卡片墙里至少 4 张作品卡片' },
        { type: 'style', selector: '.wall', prop: 'display', expect: 'grid', label: '.wall 用 Grid 排布' },
        { type: 'columns', selector: '.wall', min: 2, label: '至少排成 2 列（没写成一列堆叠）' },
        { type: 'sameRow', selector: '.wall .work-card', min: 2, label: '卡片横向并排（同一行至少 2 张）' },
        { type: 'style', selector: '.wall .work-card', prop: 'display', expect: 'flex', label: '卡片内部用 Flex' },
        { type: 'style', selector: '.wall .work-card', prop: 'flexDirection', expect: 'column', label: '卡片内部纵向排布' },
        { type: 'ratio', selector: '.wall .thumb', expect: 1.6, tolerance: 0.35, label: '缩略图比例接近 16:10' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">李雷</a>
    <nav>
      <a href="#works">作品</a>
      <a href="#about">关于</a>
      <a href="#contact">联系</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>你好，我是李雷<br />一名前端工程师</h1>
      <p class="lead">专注页面布局与交互实现，做过 40+ 个项目。</p>
      <a class="cta" href="#works">查看作品 →</a>
    </div>
    <div class="avatar" aria-hidden="true"><img src="figs/李雷证件照.png" alt=""></div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true"><span class="mono">李</span></div>
    <div>
      <h2>关于我</h2>
      <p>5 年前端开发经验，擅长把设计稿还原成结构清晰的页面。</p>
      <p>相信「布局是内容的一部分」—— 同一个页面换个排法，可读性完全不同。</p>
    </div>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <h2>作品集</h2>
    <div class="wall">
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/数据看板.png" alt=""></div>
        <h3>数据看板</h3>
        <p class="meta">数据可视化 · 2026</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/图表组件库.png" alt=""></div>
        <h3>图表组件库</h3>
        <p class="meta">图表系统 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/校园导航.png" alt=""></div>
        <h3>校园导航</h3>
        <p class="meta">移动端 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/天气可视化.png" alt=""></div>
        <h3>天气可视化</h3>
        <p class="meta">Web 应用 · 2024</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>数据统计</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
`,
        css: `:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}

/* ---- 导航栏 ---- */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}

.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  height: 60px;
}

/* Logo 是品牌，比菜单更强一级：深色 + 加粗 */
.site-header .logo {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-text);
}

.site-header nav {
  display: flex;
  gap: 6px;
}

.site-header nav a {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  color: var(--c-text-soft);
  font-size: 14px;
  font-weight: 600;
}

.site-header nav a:hover {
  background: var(--c-surface-2);
  color: var(--c-text);
}

/* ---- 首屏 ---- */
.hero {
  padding: var(--space-xl) 0;
}

.hero .grid {
  grid-template-columns: 7fr 5fr;
  align-items: center;
}

.hero h1 {
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.2;
  margin-bottom: var(--space);
}

.hero .lead {
  font-size: 17px;
  color: var(--c-text-soft);
  margin-bottom: var(--space-lg);
}

.hero .cta {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  background: var(--c-primary);
  color: #fff;
  font-weight: 700;
}

.hero .cta:hover {
  background: var(--c-primary-2);
}

/* 头像：固定正方形；图片用 cover 裁切，不拉伸变形，圆角由容器统一收口 */
.hero .avatar {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  box-shadow: 0 18px 40px rgba(15, 118, 110, 0.18);
}

.hero .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---- 关于我 ---- */
.about {
  padding: var(--space-xl) 0;
}

.about .grid {
  grid-template-columns: 4fr 8fr;
  align-items: start;
  gap: var(--space-xl);
}

/* 名片块：品牌色渐变 + 姓名首字 monogram，本身就是一张正式配图
   （::before 的内圈细线做出「名片」质感；放真实照片时结构同样适用） */
.about .portrait {
  aspect-ratio: 4 / 5;
  position: relative;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(160deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
}

.about .portrait::before {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: calc(var(--radius) - 4px);
}

.about .portrait .mono {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
}

.about h2 {
  font-size: 24px;
  margin-bottom: var(--space);
}

.about p {
  color: var(--c-text-soft);
  line-height: 1.9;
  margin-bottom: var(--space);
}

/* ---- 作品集卡片墙 ---- */
.works {
  padding: var(--space-xl) 0;
}

.works h2 {
  font-size: 24px;
  margin-bottom: var(--space-lg);
}

/* 自适应列数：宽屏列多、窄屏列少，不需要媒体查询 */
.wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-lg);
}

/* 卡片：纵向 Flex，让底部链接贴底；min-width:0 防止图片把卡片撑出网格轨道 */
.work-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  overflow: hidden;                 /* 图片裁进圆角，且任何情况下都不溢出卡片 */
  background: var(--c-surface-2);  /* 图片加载完成前的兜底底色 */
}

.work-card .thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-card h3 {
  font-size: 16px;
  margin-bottom: 4px;
}

.work-card .meta {
  margin-bottom: var(--space);
  color: var(--c-muted);
  font-size: 13px;
}

.work-card .more {
  margin-top: auto;   /* ★ 吃掉剩余空间，把链接推到卡片底部 */
  color: var(--c-primary);
  font-size: 14px;
  font-weight: 600;
}
`,
      },
    },
    /* =====================================================
     * 环节 7 —— 数据统计区（对应 9.7 / 第 1、4、5 章）
     * =================================================== */
    {
      id: 'p-7',
      title: '环节 7 · 数据统计区',
      subtitle: '用数字强化可信度，也考验信息层级',
      learn: ['第 1 章 对比与层次', '第 4 章 仪表盘栅格', '第 3 章 间距节奏'],
      task: [
        '先补 HTML：把 `<h2>数据统计</h2>` 移到 `.stats-grid` 外面，然后在 `.stats-grid` 里放 3 个 `.stat`。',
        '每个统计项结构：数字 `<span class="num">` + 单位 `<span class="unit">` + 说明 `<span class="label">`。',
        '三段字号形成落差：数字 24–32px 加粗并用主色，单位 14px 常规色，说明 12px 灰色。',
        '`.stats-grid` 用 `repeat(auto-fit, minmax(180px, 1fr))` 横向排开。',
        '这一区整体给一个浅底色（`var(--c-surface-2)`），把它和相邻区块区分开。',
        '最后顺手收尾页脚：案例成功标准是「访客点击联系我」——把页脚补成真正的联系区：一句邀请文案 + 一个 `mailto:` 按钮 + 一行版权 / 链接，并用主色深底把整页收住。',
      ],
      focus: { html: 'class="stats-grid"', css: '' },
      hints: [
        '这一步考验的不是排版技巧，而是「信息层级」：同一块内容里，谁最重要、谁次要、谁只是注解，要用字号和颜色说清楚。',
        '数字用 30px + font-weight: 800 + 主色；单位 14px；说明 12px 灰色。三段落差 ≥ 2 倍时，读者一眼就知道「这个数字是什么」。',
        '兜底片段：.stats { padding: var(--space-xl) 0; background: var(--c-surface-2); }；.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-lg); }；.stat { padding: var(--space-lg) var(--space); background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); text-align: center; }；.stat .num { display: block; font-size: 30px; font-weight: 800; color: var(--c-primary); }；.stat .unit { font-size: 14px; }；.stat .label { display: block; margin-top: 6px; font-size: 12px; color: var(--c-muted); }',
        '页脚是全页的「Z 型阅读终点」：用主色深底 + 白字和上面的浅色区块形成收口，中间放全页最后一个 CTA（反色：白底主色字），底部用一条半透明分隔线放版权和链接。它不是装饰 —— 案例的成功标准就靠这个按钮完成。',
      ],
      syntax: [
        { code: 'display: block;', note: '把行内 span 变成块级，数字与单位才会各占一行' },
        { code: 'font-weight: 800;', note: '数字加粗 = 视觉重量，比单纯放更大更有效' },
        { code: 'margin-top: 6px;', note: '说明与数字之间 6px（紧），与相邻卡片 24px（松）' },
        { code: 'background: var(--c-surface-2);', note: '整块浅底：用底色区分区块，比加边框更轻' },
        { code: 'href="mailto:name@example.com"', note: '点击直接唤起邮件客户端，联系区最朴素的转化入口' },
      ],
      checks: [
        { type: 'count', selector: '.stat', min: 3, label: '至少 3 个统计项' },
        { type: 'style', selector: '.stats-grid', prop: 'display', expect: 'grid', label: '.stats-grid 用 Grid 排布' },
        { type: 'sameRow', selector: '.stat', min: 2, label: '统计项横向并排' },
        { type: 'styleMin', selector: '.stat .num', prop: 'fontSize', min: 24, label: '数字字号 ≥ 24px（最醒目）' },
        { type: 'weightMin', selector: '.stat .num', min: 700, label: '数字加粗（font-weight ≥ 700）' },
        { type: 'styleMax', selector: '.stat .label', prop: 'fontSize', max: 14, label: '说明文字 ≤ 14px（最弱一级）' },
        { type: 'bgSet', selector: '.stat', label: '统计项有卡片底色' },
        { type: 'exists', selector: '.site-footer .footer-cta', label: '页脚里有可点击的联系按钮（转化入口不能只写个标题）' },
        { type: 'bgSet', selector: '.site-footer', label: '页脚有收口底色（与浅色内容区分开）' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">李雷</a>
    <nav>
      <a href="#works">作品</a>
      <a href="#about">关于</a>
      <a href="#contact">联系</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>你好，我是李雷<br />一名前端工程师</h1>
      <p class="lead">专注页面布局与交互实现，做过 40+ 个项目。</p>
      <a class="cta" href="#works">查看作品 →</a>
    </div>
    <div class="avatar" aria-hidden="true"><img src="figs/李雷证件照.png" alt=""></div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true"><span class="mono">李</span></div>
    <div>
      <h2>关于我</h2>
      <p>5 年前端开发经验，擅长把设计稿还原成结构清晰的页面。</p>
      <p>相信「布局是内容的一部分」—— 同一个页面换个排法，可读性完全不同。</p>
    </div>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <h2>作品集</h2>
    <div class="wall">
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/数据看板.png" alt=""></div>
        <h3>数据看板</h3>
        <p class="meta">数据可视化 · 2026</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/图表组件库.png" alt=""></div>
        <h3>图表组件库</h3>
        <p class="meta">图表系统 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/校园导航.png" alt=""></div>
        <h3>校园导航</h3>
        <p class="meta">移动端 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"><img src="figs/天气可视化.png" alt=""></div>
        <h3>天气可视化</h3>
        <p class="meta">Web 应用 · 2024</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <h2>数据统计</h2>
    <div class="stats-grid">
      <div class="stat">
        <span class="num">42</span><span class="unit">个</span>
        <span class="label">已完成项目</span>
      </div>
      <div class="stat">
        <span class="num">5</span><span class="unit">年</span>
        <span class="label">前端经验</span>
      </div>
      <div class="stat">
        <span class="num">18</span><span class="unit">位</span>
        <span class="label">合作客户</span>
      </div>
    </div>
  </div>
</section>

<!-- ⑥ 页脚 / 联系区：整页的转化收口 -->
<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
    <p class="footer-lead">新的前端 / 页面布局合作都欢迎，邮件我通常当天回复。</p>
    <a class="footer-cta" href="mailto:lilei@example.com">给我写邮件 →</a>
    <div class="footer-meta">
      <span class="copy">© 2026 李雷</span>
      <nav>
        <a href="#">GitHub</a>
        <a href="mailto:lilei@example.com">邮箱</a>
        <a href="#">回到顶部 ↑</a>
      </nav>
    </div>
  </div>
</footer>
`,
        css: `:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}

/* ---- 导航栏 ---- */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}

.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  height: 60px;
}

/* Logo 是品牌，比菜单更强一级：深色 + 加粗 */
.site-header .logo {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-text);
}

.site-header nav {
  display: flex;
  gap: 6px;
}

.site-header nav a {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  color: var(--c-text-soft);
  font-size: 14px;
  font-weight: 600;
}

.site-header nav a:hover {
  background: var(--c-surface-2);
  color: var(--c-text);
}

/* ---- 首屏 ---- */
.hero {
  padding: var(--space-xl) 0;
}

.hero .grid {
  grid-template-columns: 7fr 5fr;
  align-items: center;
}

.hero h1 {
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.2;
  margin-bottom: var(--space);
}

.hero .lead {
  font-size: 17px;
  color: var(--c-text-soft);
  margin-bottom: var(--space-lg);
}

.hero .cta {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  background: var(--c-primary);
  color: #fff;
  font-weight: 700;
}

.hero .cta:hover {
  background: var(--c-primary-2);
}

/* 头像：固定正方形；图片用 cover 裁切，不拉伸变形，圆角由容器统一收口 */
.hero .avatar {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  box-shadow: 0 18px 40px rgba(15, 118, 110, 0.18);
}

.hero .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---- 关于我 ---- */
.about {
  padding: var(--space-xl) 0;
}

.about .grid {
  grid-template-columns: 4fr 8fr;
  align-items: start;
  gap: var(--space-xl);
}

/* 名片块：品牌色渐变 + 姓名首字 monogram，本身就是一张正式配图
   （::before 的内圈细线做出「名片」质感；放真实照片时结构同样适用） */
.about .portrait {
  aspect-ratio: 4 / 5;
  position: relative;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(160deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
}

.about .portrait::before {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: calc(var(--radius) - 4px);
}

.about .portrait .mono {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
}

.about h2 {
  font-size: 24px;
  margin-bottom: var(--space);
}

.about p {
  color: var(--c-text-soft);
  line-height: 1.9;
  margin-bottom: var(--space);
}

/* ---- 作品集卡片墙 ---- */
.works {
  padding: var(--space-xl) 0;
}

.works h2 {
  font-size: 24px;
  margin-bottom: var(--space-lg);
}

.wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-lg);
}

/* min-width:0 防止图片把卡片撑出网格轨道（窄屏经典坑） */
.work-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--c-surface-2);
}

.work-card .thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-card h3 {
  font-size: 16px;
  margin-bottom: 4px;
}

.work-card .meta {
  margin-bottom: var(--space);
  color: var(--c-muted);
  font-size: 13px;
}

.work-card .more {
  margin-top: auto;
  color: var(--c-primary);
  font-size: 14px;
  font-weight: 600;
}

/* ---- 数据统计：三档信息层级 ---- */
.stats {
  padding: var(--space-xl) 0;
  background: var(--c-surface-2);   /* 用底色区分区块，比加边框更轻 */
}

.stats h2 {
  font-size: 24px;
  margin-bottom: var(--space-lg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-lg);
}

.stat {
  padding: var(--space-lg) var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  text-align: center;
}

.stat .num {
  display: block;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--c-primary);   /* ① 最重要：大 + 粗 + 主色 */
}

.stat .unit {
  font-size: 14px;
  color: var(--c-text-soft); /* ② 次要：常规字号 */
}

.stat .label {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--c-muted);     /* ③ 辅助：最小 + 最灰 */
}

/* ---- 页脚 / 联系区：主色深底收口，把视线引向全页最后一个 CTA ---- */
.site-footer {
  padding: calc(var(--space-xl) * 1.4) 0 var(--space-lg);
  background: var(--c-primary);
  color: #fff;
  text-align: center;
}

.site-footer h2 {
  font-size: clamp(24px, 3.4vw, 32px);
  margin-bottom: var(--space-sm);
}

.footer-lead {
  color: rgba(255, 255, 255, 0.82);
  margin-bottom: var(--space-lg);
}

/* 深底上的 CTA 反色：白底 + 主色字，与 Hero 的主色按钮首尾呼应 */
.footer-cta {
  display: inline-block;
  padding: 12px 26px;
  border-radius: var(--radius-pill);
  background: #fff;
  color: var(--c-primary);
  font-weight: 700;
}

.footer-cta:hover {
  background: var(--c-surface-2);
}

/* 底栏：版权与链接分列两端，一条半透明分隔线把它和 CTA 分开 */
.footer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  margin-top: calc(var(--space-xl) * 1.2);
  padding-top: var(--space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

.footer-meta nav {
  display: flex;
  gap: var(--space-lg);
}

.footer-meta a {
  color: rgba(255, 255, 255, 0.9);
}

.footer-meta a:hover {
  color: #fff;
}
`,
      },
    },
    /* =====================================================
     * 环节 8 —— 响应式：移动优先重构（对应 9.8 / 第 8 章）
     * =================================================== */
    {
      id: 'p-8',
      title: '环节 8 · 响应式与设计自查',
      subtitle: '把「桌面优先」重构成「移动优先」',
      learn: ['第 8 章 媒体查询与移动优先', '第 9 章 设计自查清单'],
      task: [
        '目前默认样式里直接写了两栏（这是"桌面优先"）。改成移动优先：默认样式里 `.hero .grid` 与 `.about .grid` 都只写 `1fr`（单列）。',
        '用 `@media (min-width: 760px)` 在平板起把 `.hero .grid` 改成 `7fr 5fr`、`.about .grid` 改成 `4fr 8fr`（`align-items` 也一起挪进去）。',
        '用 `@media (min-width: 1040px)` 在桌面起加大区块留白，例如 `padding: calc(var(--space-xl) * 1.6) 0`。',
        '验收标准：把右侧预览切到「手机 375」是单列；切到「桌面 1180」Hero 与关于我都是两栏。',
        '最后对着第 9 章那份《设计自查清单》逐条检查一遍，再点「保存到我的作品」。',
      ],
      focus: { html: '', css: '.hero .grid' },
      hints: [
        '移动优先 = 先写小屏的「基础样式」（不带媒体查询），再用 min-width 逐级"增强"。所以要把环节 4/5 写在默认样式里的两栏，挪进媒体查询 —— 这是重构，不是追加。',
        '做法：默认样式里把 .hero .grid 和 .about .grid 都写成 grid-template-columns: 1fr；然后 @media (min-width: 760px) { … } 里再写两栏。注意 align-items: start 也要跟着挪进媒体查询。',
        '兜底片段：.hero .grid, .about .grid { grid-template-columns: 1fr; }；@media (min-width: 760px) { .hero .grid { grid-template-columns: 7fr 5fr; align-items: center; } .about .grid { grid-template-columns: 4fr 8fr; align-items: start; } }；@media (min-width: 1040px) { .hero { padding: calc(var(--space-xl) * 1.6) 0; } }',
      ],
      syntax: [
        { code: '@media (min-width: 760px) { … }', note: '视口 ≥ 760px 时生效，配合移动优先「向上增强」' },
        { code: 'grid-template-columns: 1fr;', note: '单列：手机上所有内容顺次堆叠，这是默认状态' },
        { code: 'calc(var(--space-xl) * 1.6)', note: '在间距档位基础上做运算，体系不破' },
      ],
      checks: [
        {
          type: 'atWidth', width: 375,
          label: '手机宽度（375px）下 Hero 与关于我都是单列',
          checks: [
            { type: 'columns', selector: '.hero .grid', min: 1, max: 1, label: '375px：Hero 单列' },
            { type: 'columns', selector: '.about .grid', min: 1, max: 1, label: '375px：关于我单列' },
          ],
        },
        {
          type: 'atWidth', width: 1180,
          label: '桌面宽度（1180px）下 Hero 与关于我都是两栏',
          checks: [
            { type: 'columns', selector: '.hero .grid', min: 2, max: 2, label: '1180px：Hero 两栏' },
            { type: 'colsCompare', selector: '.hero .grid', expect: 'firstGreater', label: '1180px：Hero 左宽右窄' },
            { type: 'columns', selector: '.about .grid', min: 2, max: 2, label: '1180px：关于我两栏' },
            { type: 'colsCompare', selector: '.about .grid', expect: 'secondGreater', label: '1180px：关于我右宽左窄' },
          ],
        },
        { type: 'styleMin', selector: '.hero', prop: 'paddingTop', min: 40, label: '大屏下 Hero 仍然有足够留白' },
      ],
      solution: {
        /* html 留空 = 沿用上一环节的 HTML（本环节只重构 CSS） */
        html: '',
        css: `:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}

/* ---- 导航栏 ---- */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}

.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  height: 60px;
}

/* Logo 是品牌，比菜单更强一级：深色 + 加粗 */
.site-header .logo {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-text);
}

.site-header nav {
  display: flex;
  gap: 6px;
}

.site-header nav a {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  color: var(--c-text-soft);
  font-size: 14px;
  font-weight: 600;
}

.site-header nav a:hover {
  background: var(--c-surface-2);
  color: var(--c-text);
}

/* ---- 首屏：默认单列（手机优先） ---- */
.hero {
  padding: var(--space-xl) 0;
}

.hero .grid {
  grid-template-columns: 1fr;
}

.hero h1 {
  font-size: clamp(30px, 5vw, 46px);
  line-height: 1.2;
  margin-bottom: var(--space);
}

.hero .lead {
  font-size: 17px;
  color: var(--c-text-soft);
  margin-bottom: var(--space-lg);
}

.hero .cta {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  background: var(--c-primary);
  color: #fff;
  font-weight: 700;
}

.hero .cta:hover {
  background: var(--c-primary-2);
}

/* 手机上头像不撑满整屏：限宽 + 居中，到平板再随两栏放开 */
.hero .avatar {
  aspect-ratio: 1 / 1;
  width: min(72%, 280px);
  margin-inline: auto;
  overflow: hidden;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  box-shadow: 0 18px 40px rgba(15, 118, 110, 0.18);
}

.hero .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---- 关于我：默认单列 ---- */
.about {
  padding: var(--space-xl) 0;
}

.about .grid {
  grid-template-columns: 1fr;
  gap: var(--space-lg);
}

/* 名片块：品牌色渐变 + 姓名首字 monogram（手机上同样限宽居中） */
.about .portrait {
  aspect-ratio: 4 / 5;
  width: min(78%, 300px);
  margin-inline: auto;
  position: relative;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(160deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
}

.about .portrait::before {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: calc(var(--radius) - 4px);
}

.about .portrait .mono {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
}

.about h2 {
  font-size: 24px;
  margin-bottom: var(--space);
}

.about p {
  color: var(--c-text-soft);
  line-height: 1.9;
  margin-bottom: var(--space);
}

/* ---- 作品集卡片墙：列数由 auto-fit 自己算，无需媒体查询 ---- */
.works {
  padding: var(--space-xl) 0;
}

.works h2 {
  font-size: 24px;
  margin-bottom: var(--space-lg);
}

.wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-lg);
}

/* min-width:0 防止图片把卡片撑出网格轨道（窄屏经典坑） */
.work-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--c-surface-2);
}

.work-card .thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-card h3 {
  font-size: 16px;
  margin-bottom: 4px;
}

.work-card .meta {
  margin-bottom: var(--space);
  color: var(--c-muted);
  font-size: 13px;
}

.work-card .more {
  margin-top: auto;
  color: var(--c-primary);
  font-size: 14px;
  font-weight: 600;
}

/* ---- 数据统计 ---- */
.stats {
  padding: var(--space-xl) 0;
  background: var(--c-surface-2);
}

.stats h2 {
  font-size: 24px;
  margin-bottom: var(--space-lg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-lg);
}

.stat {
  padding: var(--space-lg) var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  text-align: center;
}

.stat .num {
  display: block;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--c-primary);
}

.stat .unit {
  font-size: 14px;
  color: var(--c-text-soft);
}

.stat .label {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--c-muted);
}

/* ---- 页脚 / 联系区：手机上元素堆叠居中，CTA 整行宽，好点按 ---- */
.site-footer {
  padding: calc(var(--space-xl) * 1.4) 0 var(--space-lg);
  background: var(--c-primary);
  color: #fff;
  text-align: center;
}

.site-footer h2 {
  font-size: clamp(24px, 5vw, 32px);
  margin-bottom: var(--space-sm);
}

.footer-lead {
  color: rgba(255, 255, 255, 0.82);
  margin-bottom: var(--space-lg);
}

.footer-cta {
  display: block;
  padding: 12px 26px;
  border-radius: var(--radius-pill);
  background: #fff;
  color: var(--c-primary);
  font-weight: 700;
}

.footer-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: calc(var(--space-xl) * 1.2);
  padding-top: var(--space-lg);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

.footer-meta nav {
  display: flex;
  justify-content: center;
  gap: var(--space-lg);
}

.footer-meta a {
  color: rgba(255, 255, 255, 0.9);
}

/* =========================================
 * 移动优先：只用 min-width 逐级「增强」
 * 小屏样式一次都没有被覆盖，只是在被加强
 * ======================================= */

/* 平板起：双栏；放开头像/名片宽度，页脚也切回横向排布 */
@media (min-width: 760px) {
  .hero .grid {
    grid-template-columns: 7fr 5fr;
    align-items: center;
  }

  .about .grid {
    grid-template-columns: 4fr 8fr;
    align-items: start;
    gap: var(--space-xl);
  }

  .hero .avatar,
  .about .portrait {
    width: auto;
    margin-inline: 0;
  }

  .footer-cta {
    display: inline-block;
  }

  .footer-meta {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

/* 桌面起：留白更足 */
@media (min-width: 1040px) {
  .hero {
    padding: calc(var(--space-xl) * 1.6) 0;
  }

  .about,
  .works,
  .stats {
    padding: calc(var(--space-xl) * 1.2) 0;
  }
}
`,
      },
    },
  ],
};
