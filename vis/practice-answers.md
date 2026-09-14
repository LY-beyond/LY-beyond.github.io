# 实战环节 · 各环节参考答案

> 本文件由 `node practice-answers.mjs` 从 `practice-data.js` 自动生成，**不要手改**。
> 改了案例数据后重新跑一次即可。

## 怎么用

1. 打开 `practice.html`，切到对应环节。
2. 把下面「HTML」框里的内容整段粘进左边的 HTML 编辑器，
   「CSS」框里的内容整段粘进右边的 CSS 编辑器（**每关的 CSS 都是完整累积版**，直接整体替换即可）。
3. 点「✅ 检查这一环节」，应当**全项通过**。
4. 也可以偷懒：直接点两次「查看参考答案」（第一次进入确认态，第二次才填入）。

> 想验「检查点真的会判错」：随便删掉一段（比如 CSS 里的 display: flex），再点检查，
> 对应的那一项就会变红。

---

## 总览

| 环节 | 标题 | 对应知识点 | 检查点数 |
|---|---|---|---|
| 1 | 搭出页面骨架 | 第 2 章 从需求到页面骨架 | 8 |
| 2 | 装上统一的刻度 | 第 3 章 栅格系统与间距节奏、第 1 章 对齐 | 9 |
| 3 | 顶部导航栏 | 第 6 章 Flexbox 弹性布局、第 8 章 position: sticky、第 1 章 亲密性 | 9 |
| 4 | 首屏 Hero | 第 1 章 对比与视觉层次、第 1 章 非对称平衡、第 7 章 Grid 分栏 | 7 |
| 5 | 关于我（双栏） | 第 7 章 Grid 分栏、第 1 章 亲密性与节奏、第 1 章 对齐方式选择 | 7 |
| 6 | 作品集卡片墙 | 第 7 章 auto-fit 自动填充、第 1 章 重复与统一、第 6 章 卡片内纵向 Flex | 7 |
| 7 | 数据统计区 | 第 1 章 对比与层次、第 4 章 仪表盘栅格、第 3 章 间距节奏 | 7 |
| 8 | 响应式与设计自查 | 第 8 章 媒体查询与移动优先、第 9 章 设计自查清单 | 7 |

> 共 8 个环节、61 个检查点。
> 最终成品 = 第 8 个环节的代码（也可以在页面上点「⬇️ 导出 .html」直接拿到成品文件）。

---

## 环节 1 · 搭出页面骨架

- **副标题**：先定结构，再谈样式
- **对应知识点**：第 2 章 从需求到页面骨架
- **要求**：
  - 把 6 个区块按顺序搭出来：顶部导航 → 首屏 → 关于我 → 作品集 → 数据统计 → 页脚。
  - 每个区块先只放一个标题，内部结构留到后面的环节再补。
  - 本环节不写 CSS —— 结构定下来之前，改样式是浪费。
  - 用 `<header>` / `<section>` / `<footer>` 这类语义标签，而不是一堆 `<div>`。
- **检查点**：8 项 —— 至少 4 个 <section> 区块；存在 <header class="site-header">；存在 section.hero；存在 section.about；存在 section.works；存在 section.stats；存在 <footer class="site-footer">；6 个区块自上而下的顺序正确
- **起始代码**：案例提供的空骨架（`startCode`）
- **参考答案来源**：本环节自己的 solution

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<!-- ① 在这里搭出页面的 6 个区块：导航 / 首屏 / 关于我 / 作品集 / 数据统计 / 页脚 -->
<!-- 每个区块用语义标签 + 类名，先各放一个标题即可 -->
```

```css
/* 环节 1 只搭结构，先不写样式 */
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<!-- ① 顶部导航 -->
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
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
/* 本环节只搭结构，先不写样式 */
```

---

## 环节 2 · 装上统一的刻度

- **副标题**：容器 + 12 列栅格 + 8pt 间距档位
- **对应知识点**：第 3 章 栅格系统与间距节奏、第 1 章 对齐
- **要求**：
  - 在 `:root` 里定义间距档位：`--space-sm: 8px`、`--space: 16px`、`--space-lg: 24px`、`--space-xl: 40px`。
  - 写 `.container`：内容最大宽度 1180px，两侧至少留 24px，并且水平居中。
  - 写 `.grid`：12 列栅格，列间距用 `var(--space-lg)`。
  - 给每个区块的内容套上容器：导航的 `<div class="inner">` 改成 `container inner`，其余区块的内容层加 `container`。
  - ⚠️ 不要写死 `width: 1180px` —— 那样窄屏会横向溢出。
- **检查点**：9 项 —— 定义了间距档位 --space-lg: 24px；存在 .container 容器；.container 有实际宽度（不是写死的 1180 溢出或过窄）；.container 宽度不超过 1180px；.container 水平居中；至少 5 个区块用上了容器；.grid 是 Grid 容器；.grid 正好是 12 列；.grid 的列间距 ≥ 20px
- **起始代码**：第 1 环节的参考答案
- **参考答案来源**：本环节自己的 solution

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<!-- ① 顶部导航 -->
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
```

```css
/* 本环节只搭结构，先不写样式 */
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<header class="site-header">
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
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
/* ① 间距档位：全站所有间距都从这里取值（8pt 体系） */
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
```

---

## 环节 3 · 顶部导航栏

- **副标题**：全站第一个对齐示范
- **对应知识点**：第 6 章 Flexbox 弹性布局、第 8 章 position: sticky、第 1 章 亲密性
- **要求**：
  - 先补 HTML：在 `.inner` 里加一个 `<nav>`，里面放 3 个菜单链接（作品 / 关于 / 联系），并让它们指向 `#works` `#about` `#contact`。
  - 让 `.site-header` 吸顶：`position: sticky` + `top: 0`，再加一个 `z-index` 让它盖住下面的内容。
  - 在 `.inner` 上用 Flex 让 Logo 与菜单分列两端，并让它们垂直居中，高度 60px。
  - `nav` 本身也做成 Flex，菜单项之间用 `gap` 收紧（形成一组）。
  - ⚠️ 不要用 `position: fixed` 吸顶 —— 它不保留占位，下面的内容会跳上来。
- **检查点**：9 项 —— 导航栏用 position: sticky 吸顶；导航栏 top: 0（不写 top 时 sticky 不生效）；.inner 用 Flex 排布；Logo 与菜单分列两端；.inner 交叉轴居中；导航栏高度 ≥ 56px；菜单是一组（nav 用 Flex）；菜单里至少 3 个链接；菜单项之间用 gap 收紧（≥ 4px）
- **起始代码**：第 2 环节的参考答案
- **参考答案来源**：本环节自己的 solution

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<header class="site-header">
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
```

```css
/* ① 间距档位：全站所有间距都从这里取值（8pt 体系） */
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
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<header class="site-header">
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
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
/* ① 间距档位：全站所有间距都从这里取值（8pt 体系） */
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
  height: 60px;
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
```

---

## 环节 4 · 首屏 Hero

- **副标题**：决定「访客是否留下」的一屏
- **对应知识点**：第 1 章 对比与视觉层次、第 1 章 非对称平衡、第 7 章 Grid 分栏
- **要求**：
  - 先补 HTML：在 `.hero` 的 `.grid` 里放左侧文字栏（`<h1>` + `<p class="lead">` + `<a class="cta">`）和右侧头像块 `<div class="avatar">`。
  - `.hero` 上下用最大的档位 `var(--space-xl)` 留白。
  - `.hero .grid` 改成两栏 `7fr 5fr`，并让左右两栏垂直居中。
  - 标题是唯一主角：字号 ≥ 30px（可用 `clamp()` 做响应式字号）；副标题弱化成灰色。
  - 按钮用主色背景 + 白色文字 + 胶囊圆角；头像块保持正方形（`aspect-ratio: 1 / 1`）。
- **检查点**：7 项 —— 主标题字号 ≥ 30px（全场最大）；.hero 上下留白 ≥ 40px；.hero .grid 是两栏；左栏比右栏宽（非对称平衡）；左右两栏垂直居中；按钮有实色背景（唯一的高对比元素）；头像块近似正方形
- **起始代码**：第 3 环节的参考答案
- **参考答案来源**：本环节自己的 solution

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<header class="site-header">
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
```

```css
/* ① 间距档位：全站所有间距都从这里取值（8pt 体系） */
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
  height: 60px;
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
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
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
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
}
```

---

## 环节 5 · 关于我（双栏）

- **副标题**：图文混排：比例比「均分」更重要
- **对应知识点**：第 7 章 Grid 分栏、第 1 章 亲密性与节奏、第 1 章 对齐方式选择
- **要求**：
  - 先补 HTML：把 `.about` 的内容层改成左侧头像块 `<div class="portrait">` + 右侧文字栏（`<h2>` + 两段 `<p>`）。
  - `.about .grid` 用 `4fr 8fr`（图 4 : 文 8）—— 不要用 `1fr 1fr`。
  - 长文配图用顶对齐：`align-items: start`（Hero 用的是 center，这里不同）。
  - 段落行高调到 1.8–2.0，段间距用 `var(--space)`，让「段内紧、段间松」。
  - 头像块用 `aspect-ratio: 4 / 5` 保持统一比例。
- **检查点**：7 项 —— 存在左侧头像块 .portrait；右侧至少有 2 段文字；.about .grid 是两栏；文字栏比图片栏宽（不是 1:1 均分）；双栏用顶对齐；头像块比例接近 4:5；段落行高 ≥ 28px（约 1.75 倍，长段落更好读）
- **起始代码**：第 4 环节的参考答案
- **参考答案来源**：本环节自己的 solution

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
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
```

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
}
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">照片</div>
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
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
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

.about .portrait {
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 14px;
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
```

---

## 环节 6 · 作品集卡片墙

- **副标题**：案例的核心区块：一屏展示多个作品
- **对应知识点**：第 7 章 auto-fit 自动填充、第 1 章 重复与统一、第 6 章 卡片内纵向 Flex
- **要求**：
  - 先补 HTML：把 `<h2>作品集</h2>` 移到 `.wall` 外面，然后在 `.wall` 里放 4 张 `<article class="work-card">`。
  - 每张卡片结构：缩略图 `<div class="thumb">` + 标题 `<h3>` + 说明 `<p class="meta">` + 底部链接 `<a class="more">`。
  - `.wall` 用 `repeat(auto-fit, minmax(260px, 1fr))` 自适应列数 —— 不需要写媒体查询。
  - `.work-card` 做成纵向 Flex，让底部的「查看详情」用 `margin-top: auto` 贴到卡片底部。
  - 缩略图用 `aspect-ratio: 16 / 10` 统一比例，避免整面墙高低不平。
- **检查点**：7 项 —— 卡片墙里至少 4 张作品卡片；.wall 用 Grid 排布；至少排成 2 列（没写成一列堆叠）；卡片横向并排（同一行至少 2 张）；卡片内部用 Flex；卡片内部纵向排布；缩略图比例接近 16:10
- **起始代码**：第 5 环节的参考答案
- **参考答案来源**：本环节自己的 solution

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">照片</div>
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
```

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
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

.about .portrait {
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 14px;
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
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">照片</div>
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
        <div class="thumb" aria-hidden="true"></div>
        <h3>仪表盘设计</h3>
        <p class="meta">数据可视化 · 2026</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>数据可视化</h3>
        <p class="meta">图表系统 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>移动端改版</h3>
        <p class="meta">响应式 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>设计系统</h3>
        <p class="meta">组件库 · 2024</p>
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
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
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

.about .portrait {
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 14px;
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

/* 卡片：纵向 Flex，让底部链接贴底 */
.work-card {
  display: flex;
  flex-direction: column;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--c-surface-2), #ece8e1);
}

.work-card h3 {
  font-size: 16px;
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
```

---

## 环节 7 · 数据统计区

- **副标题**：用数字强化可信度，也考验信息层级
- **对应知识点**：第 1 章 对比与层次、第 4 章 仪表盘栅格、第 3 章 间距节奏
- **要求**：
  - 先补 HTML：把 `<h2>数据统计</h2>` 移到 `.stats-grid` 外面，然后在 `.stats-grid` 里放 3 个 `.stat`。
  - 每个统计项结构：数字 `<span class="num">` + 单位 `<span class="unit">` + 说明 `<span class="label">`。
  - 三段字号形成落差：数字 24–32px 加粗并用主色，单位 14px 常规色，说明 12px 灰色。
  - `.stats-grid` 用 `repeat(auto-fit, minmax(180px, 1fr))` 横向排开。
  - 这一区整体给一个浅底色（`var(--c-surface-2)`），把它和相邻区块区分开。
- **检查点**：7 项 —— 至少 3 个统计项；.stats-grid 用 Grid 排布；统计项横向并排；数字字号 ≥ 24px（最醒目）；数字加粗（font-weight ≥ 700）；说明文字 ≤ 14px（最弱一级）；统计项有卡片底色
- **起始代码**：第 6 环节的参考答案
- **参考答案来源**：本环节自己的 solution

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">照片</div>
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
        <div class="thumb" aria-hidden="true"></div>
        <h3>仪表盘设计</h3>
        <p class="meta">数据可视化 · 2026</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>数据可视化</h3>
        <p class="meta">图表系统 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>移动端改版</h3>
        <p class="meta">响应式 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>设计系统</h3>
        <p class="meta">组件库 · 2024</p>
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
```

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
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

.about .portrait {
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 14px;
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

/* 卡片：纵向 Flex，让底部链接贴底 */
.work-card {
  display: flex;
  flex-direction: column;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--c-surface-2), #ece8e1);
}

.work-card h3 {
  font-size: 16px;
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
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">照片</div>
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
        <div class="thumb" aria-hidden="true"></div>
        <h3>仪表盘设计</h3>
        <p class="meta">数据可视化 · 2026</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>数据可视化</h3>
        <p class="meta">图表系统 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>移动端改版</h3>
        <p class="meta">响应式 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>设计系统</h3>
        <p class="meta">组件库 · 2024</p>
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

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
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

.about .portrait {
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 14px;
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

.work-card {
  display: flex;
  flex-direction: column;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--c-surface-2), #ece8e1);
}

.work-card h3 {
  font-size: 16px;
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
```

---

## 环节 8 · 响应式与设计自查

- **副标题**：把「桌面优先」重构成「移动优先」
- **对应知识点**：第 8 章 媒体查询与移动优先、第 9 章 设计自查清单
- **要求**：
  - 目前默认样式里直接写了两栏（这是"桌面优先"）。改成移动优先：默认样式里 `.hero .grid` 与 `.about .grid` 都只写 `1fr`（单列）。
  - 用 `@media (min-width: 760px)` 在平板起把 `.hero .grid` 改成 `7fr 5fr`、`.about .grid` 改成 `4fr 8fr`（`align-items` 也一起挪进去）。
  - 用 `@media (min-width: 1040px)` 在桌面起加大区块留白，例如 `padding: calc(var(--space-xl) * 1.6) 0`。
  - 验收标准：把右侧预览切到「手机 375」是单列；切到「桌面 1180」Hero 与关于我都是两栏。
  - 最后对着第 9 章那份《设计自查清单》逐条检查一遍，再点「保存到我的作品」。
- **检查点**：7 项 —— 手机宽度（375px）下 Hero 与关于我都是单列；桌面宽度（1180px）下 Hero 与关于我都是两栏；大屏下 Hero 仍然有足够留白
- **起始代码**：第 7 环节的参考答案
- **参考答案来源**：本环节只重构 CSS，HTML 沿用上一环节

<details><summary>起始代码（对照用，不用粘）</summary>

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">照片</div>
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
        <div class="thumb" aria-hidden="true"></div>
        <h3>仪表盘设计</h3>
        <p class="meta">数据可视化 · 2026</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>数据可视化</h3>
        <p class="meta">图表系统 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>移动端改版</h3>
        <p class="meta">响应式 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>设计系统</h3>
        <p class="meta">组件库 · 2024</p>
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

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
```

```css
:root {
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
  height: 60px;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
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

.about .portrait {
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 14px;
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

.work-card {
  display: flex;
  flex-direction: column;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--c-surface-2), #ece8e1);
}

.work-card h3 {
  font-size: 16px;
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
```

</details>

### ✅ 答案 · HTML（粘进左侧编辑器）

```html
<header class="site-header">
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
    <div class="avatar" aria-hidden="true">李</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">照片</div>
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
        <div class="thumb" aria-hidden="true"></div>
        <h3>仪表盘设计</h3>
        <p class="meta">数据可视化 · 2026</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>数据可视化</h3>
        <p class="meta">图表系统 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>移动端改版</h3>
        <p class="meta">响应式 · 2025</p>
        <a class="more" href="#">查看详情 →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>设计系统</h3>
        <p class="meta">组件库 · 2024</p>
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

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>一起做点什么？</h2>
  </div>
</footer>
```

### ✅ 答案 · CSS（粘进右侧编辑器）

```css
:root {
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
  height: 60px;
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

/* ---- 首屏：默认单列（手机优先） ---- */
.hero {
  padding: var(--space-xl) 0;
}

.hero .grid {
  grid-template-columns: 1fr;
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

.hero .avatar {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: linear-gradient(150deg, var(--c-primary-2), var(--c-primary));
  color: #fff;
  font-size: 48px;
  font-weight: 800;
}

/* ---- 关于我：默认单列 ---- */
.about {
  padding: var(--space-xl) 0;
}

.about .grid {
  grid-template-columns: 1fr;
  gap: var(--space-xl);
}

.about .portrait {
  aspect-ratio: 4 / 5;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
  font-size: 14px;
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

.work-card {
  display: flex;
  flex-direction: column;
  padding: var(--space);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.work-card .thumb {
  aspect-ratio: 16 / 10;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--c-surface-2), #ece8e1);
}

.work-card h3 {
  font-size: 16px;
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

/* =========================================
 * 移动优先：只用 min-width 逐级「增强」
 * 小屏样式一次都没有被覆盖，只是在被加强
 * ======================================= */

/* 平板起：双栏 */
@media (min-width: 760px) {
  .hero .grid {
    grid-template-columns: 7fr 5fr;
    align-items: center;
  }

  .about .grid {
    grid-template-columns: 4fr 8fr;
    align-items: start;
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
```


