# 「如何进行页面布局」教学站 —— 开发计划（工作备忘）

> 本文件是仿写作业的完整计划书。切换到你自己的工作区后，第一步把它复制为仓库里的 `PLAN.md`。
> 参考对象（老师的站）：`https://github.com/cinger007/vis`（本地克隆曾位于 `d:\reference\vis`）

---

## 0. 背景与目标

- **性质**：课程作业 —— 仿写老师的一个教学 Web（照猫画虎）。
- **要求**：**功能一致**；**布局与配色自己发挥**（不得照抄）；**内容主题换成「如何进行页面布局」**；**分不同章节展示**。
- **交付**：一个纯静态教学站，部署到 GitHub Pages（`https://<用户名>.github.io/<仓库名>/`）。
- **参考站的主题是「可视化导论 + D3.js」**，我们只复刻它的**功能形态与交互结构**，不搬它的内容和视觉。

---

## 1. 作业硬指标（打分点）

1. 功能与参考站一致（见第 2 节清单，至少 F1–F8 全部具备）。
2. 布局与配色**自主设计**，不可照抄参考站。
3. 内容围绕「如何进行页面布局」，**分章节**组织。
4. 每章具备「讲解 / 关键代码 / 演示」三类内容。
5. 能静态部署、浏览器直接打开可用。

---

## 2. 功能一致性清单（复刻目标）

| 编号 | 功能 | 实现手法（参考站做法） | 我们的做法 |
|---|---|---|---|
| **F1** | 门户首页卡片墙 | 网格卡片：章节号/标题/简介/标签/进入按钮 | 同结构，视觉自主设计 |
| **F2** | 章节页三段式布局 | 顶栏 + 左目录 + 右正文 | 同结构 |
| **F3** | 三 Tab：📖讲解 / ⌨️关键代码 / ▶️演示 | `.tab-btn` + `.tab-panel`，JS 切 `active` 类 | 同机制 |
| **F4** | 章节内锚点导航 | `#ch-x-y` + `hashchange` + 侧栏高亮 | 同机制 |
| **F5** | Demo 注入系统 | `.demo-mount[data-demo]` 占位 + `DEMOS` 注册表按需渲染 | 同机制 |
| **F6** | 上一章/下一章 pager | 底部翻页组件 | 同结构 |
| **F7** | 关键代码高亮 + 「⭐关键点解释」段落 | 代码块着色 + 讲解块 | 同结构 |
| **F8** | 每章一个可交互演示 | 独立 demo | 同结构（用 CSS 盒子交互，不用 D3） |
| **F9** | （可选/加分）中英双语切换 | `data-i18n` + 语言按钮 | 可选 |
| **F10** | 纯静态部署 | 相对路径 + GitHub Pages | 同方式 |

> **注意**：参考站的 D3.js 图表**不需要复刻**。「页面布局」主题的演示 = 若干彩色盒子 + 滑块/下拉实时调参，比画图表更简单、更容易出效果。

---

## 3. 技术选型与理由

**结论：原生 HTML + CSS + JavaScript，零构建。**

理由：
1. **形态一致** —— 参考站本就是原生三件套，同技术最不容易跑偏。
2. **老师能看懂** —— 原生代码评审门槛低。
3. **部署零配置** —— 相对路径可直接上 GitHub Pages，无需配 `base`、无需 Node。
4. **时间短** —— 有参考实现可对照，不必边学框架边做。
5. **「配色自己发挥」正好落到 CSS 自定义属性**，既是加分项又不复杂。

**不使用**：Astro / Vue / React / 任何打包器（个人短期作业，收益不足，成本过高）。

---

## 4. 内容大纲（6 章，每章三 Tab + 一个交互演示）

| 章 | 标题 | 讲解要点 | 交互演示设计 |
|---|---|---|---|
| 1 | **布局基础** | 盒模型（content/padding/border/margin）、文档流、`display`（block/inline/inline-block/none） | 滑块实时调 padding/margin/border；切换 `display` 看排布变化 |
| 2 | **Flexbox 弹性布局** | 主轴/交叉轴、`flex-direction`、`justify-content`、`align-items`、`flex` 简写、`gap` | 下拉选择各属性，实时看一排盒子的排列变化 |
| 3 | **Grid 网格布局** | 网格线、`grid-template-columns/rows`、`fr`、`auto-fit` + `minmax`、`grid-area` | 调整列数与 `minmax`，实时看网格重排 |
| 4 | **定位与层叠** | `position` 五种取值、`top/left` 偏移、`z-index` 与层叠上下文 | 切换 `position`，观察元素脱离文档流与覆盖关系 |
| 5 | **响应式布局** | 视口 meta、媒体查询、移动优先、相对单位（`rem`/`%`/`vw`） | 拖动「屏幕宽度」滑杆，看断点触发布局切换 |
| 6 | **综合实战：经典布局模式** | 圣杯/双飞翼、两栏布局、卡片墙、仪表盘栅格 | 一键切换多种经典布局，对照同一份内容 |

---

## 5. 目录结构（目标形态）

```
layout-course/                    ← 你的仓库（工作区根）
├── index.html                    # 门户：6 张章节卡片
├── styles.css                    # 门户样式
├── tokens.css                    # ★ 主题令牌（配色集中处）
├── i18n.js / i18n.css            # （可选）中英切换
├── lesson-01/                    # 第 1 章 布局基础
│   ├── index.html                #   顶栏 + 左目录 + 右正文（三 tab）
│   ├── lesson.js                 #   tab 切换 + 章节锚点 + demo 注入
│   └── styles.css
├── lesson-02/ … lesson-06/       # 其余各章，结构一致
└── lesson-0X/demo/               # （可选）每章独立 demo 目录
```

---

## 6. 设计规范

### 6.1 配色：集中到 `tokens.css`（自主发挥的落点）

```css
:root {
  --c-bg: #f8fafc;  --c-surface: #ffffff;  --c-text: #1e293b;
  --c-muted: #64748b;  --c-border: #e2e8f0;
  --c-primary: #4338ca;  --c-primary-weak: #eef2ff;
  --c-accent: #10b981;  --c-warn: #0ea5e9;  --c-danger: #ef4444;
  --radius: 10px;  --space: 16px;
  --font-sans: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  --font-mono: "JetBrains Mono", Consolas, monospace;
}
```

- **全站禁止硬编码色值**，一律 `var(--c-*)`。
- 可顺便支持深色模式：`@media (prefers-color-scheme: dark) { :root { ... } }`。
- 参考站有 **1013 处硬编码色值**，是它的短板；我们一开始就变量化，是**显式优势**，答辩可讲。

### 6.2 布局（自主发挥）

- 门户：CSS Grid 卡片墙（`repeat(auto-fit, minmax(...))`），移动端单列。
- 章节页：`grid-template-columns: 240px 1fr`（移动端折叠为单列）。
- 顶部导航：sticky 定位。
- 三 Tab 面板：同一容器内绝对/隐藏切换。

### 6.3 代码规范

- 每个 `<script type="module">`，无打包。
- demo 注册表写法沿用参考站思路：
  ```js
  window.DEMOS = window.DEMOS || {};
  window.DEMOS['d-1-1'] = function (mount) { /* 渲染演示 */ };
  ```
- 章节 HTML 里只放占位：`<div class="demo-mount" data-demo="d-1-1"></div>`。

---

## 7. 实施步骤（建议顺序）

1. **定主题**：写 `tokens.css`（主色/背景/文字/边框/圆角/间距/字体）。
2. **搭门户**：`index.html` 卡片墙，6 张卡片。
3. **搭第 1 章骨架**：顶栏 + 左目录 + 三 tab（这是可复用的模板）。
4. **写 `lesson.js`**：tab 切换 + 章节锚点/hash + demo 注入。
5. **逐章填内容**：讲解 + 关键代码 + ⭐关键点解释 + 1 个交互 demo。
6. **补 pager 翻页 + 页脚**。
7. **（可选）加中英切换**。
8. **本地起服务器验证**：`python -m http.server 8080`。
9. **部署**：git push → Settings → Pages → Deploy from a branch → `main` / `(root)`。
10. **验收**：对照第 8 节清单逐项自查。

---

## 8. 验收清单

- [ ] F1 门户卡片墙可点击进入各章
- [ ] F2 章节页 顶栏 + 左目录 + 右正文 布局正常
- [ ] F3 三个 tab 可切换且内容正确
- [ ] F4 点击左目录跳转到对应小节，URL 有 `#hash`，侧栏高亮
- [ ] F5 每章的 demo 能正确注入并渲染
- [ ] F6 底部「上一章 / 下一章」可用
- [ ] F7 代码块有高亮，且有「⭐关键点解释」
- [ ] F8 每章至少一个可交互演示（可操作、有反馈）
- [ ] 配色全部走 CSS 变量；无硬编码色值
- [ ] 移动端（≤640px）布局不塌
- [ ] 浏览器控制台无报错
- [ ] `github.io` 上在线可访问，且资源无 404
- [ ] 布局与配色**明显区别于**参考站（原创性）

---

## 9. 注意事项与红线

1. **不要照抄参考站的 CSS / 配色 / 版式** —— 作业明确说可自行发挥，照抄反而可能失分。**功能对齐、视觉重做**。
2. **每章必须有能动手的演示** —— 这是参考站的灵魂（「代码可运行」），也最易得分。
3. **不要把主题色硬编码** —— 集中到 `tokens.css`，讲得清「配色体系」。
4. **路径一律用相对路径** —— 保证 GitHub Pages 子路径下可用（参考站正是这样做的）。
5. **不引入不必要的依赖** —— 布局主题用不到 D3，别为了像参考站而硬上。
6. **GitHub Pages 大小写敏感**（Linux），文件名统一小写，避免在 Windows 上不报错、上线 404。
7. 若含中文/空格文件名，链接需 URL 编码或重命名。

---

## 10. 参考站的实现手法（供对照，勿抄视觉）

- **门户**：`index.html` 卡片墙 → `<a href="lesson-01/">`
- **章节页**：`.course-topbar` 顶栏 + `.chapter-nav` 左目录 + `.chapter` 区块（内含 `.tab-btn` / `.tab-panel`）；末尾 `.chapter-pager` 翻页
- **tab 逻辑**：点击 `.tab-btn` → 切换同级 `.tab-btn.active` 与 `.tab-panel.active`
- **章节锚点**：`.chapter-nav a[data-chapter]` → `__activateChapter(id)` → `hashchange`
- **demo 注入**：`.demo-mount[data-demo]` → 查 `window.DEMOS[name]` → 渲染并标记 `data-rendered`
- **启动时序**：`queueMicrotask(() => __renderAllDemos())`（等 `DEMOS` 注册完）
- **i18n（参考站自研）**：`data-i18n` key 词典 + `data-lang` 双 DOM + `localStorage` + `?lang=`
- **部署**：全站相对路径，免配置上静态托管

---

## 11. 待确认项（下次继续时确认）

- [ ] 站点名称 / 品牌名
- [ ] 是否要做中英双语（F9）？工作量不小，可选
- [ ] 是否要每章独立的 `demo/` 子目录（F8 的加强版）
- [ ] 章节数是否就定 6 章
- [ ] 目标仓库名（决定线上路径）
