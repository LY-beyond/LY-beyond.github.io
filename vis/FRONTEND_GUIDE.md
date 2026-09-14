# CVClass 前端页面开发技术指导

> 本文档总结 CVClass 计算机视觉教学平台前端开发的既有规范与设计技巧，用于新增页面、改造页面和 Code Review 时保持一致。
>
> **所有示例均取自本仓库真实代码**，可直接复制使用。文中标注的 `文件:行号` 为撰写时的位置，改动后行号可能漂移，以类名/选择器为准。

---

## 目录

1. [技术栈与硬约束](#1-技术栈与硬约束)
2. [目录与文件组织](#2-目录与文件组织)
3. [模板层规范（Jinja2）](#3-模板层规范jinja2)
4. [CSS 设计系统](#4-css-设计系统)
5. [布局规范](#5-布局规范)
6. [视觉规范](#6-视觉规范)
7. [交互、动效与响应式](#7-交互动效与响应式)
8. [JavaScript 规范](#8-javascript-规范)
9. [计算分层规范](#9-计算分层规范)
10. [无障碍与性能](#10-无障碍与性能)
11. [新增页面标准流程](#11-新增页面标准流程)
12. [Code Review 检查清单](#12-code-review-检查清单)
13. [反面清单（Don't）](#13-反面清单dont)

---

## 1. 技术栈与硬约束

### 1.1 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 模板 | **Jinja2** | 服务端渲染，三层模板继承 |
| 样式 | **原生 CSS** | 无 Sass/Less/PostCSS |
| 脚本 | **原生 JavaScript** | 无 TypeScript、无 JSX，IIFE 模块化 |
| 服务端 | **Python Flask** | 页面路由 + JSON API |
| 数值计算 | **NumPy** | 不依赖 OpenCV |
| 端侧推理 | **ONNX Runtime Web** | WASM / WebGPU |

### 1.2 硬约束（务必遵守）

1. **禁止引入前端打包器**。项目没有 `package.json`、`node_modules`、webpack/vite/rollup。不要新增构建步骤。
2. **禁止引入前端框架**。不使用 React/Vue/Svelte/Alpine。页面由服务端渲染，交互用原生 DOM API。
3. **禁止使用 CSS 预处理器语法**。不要写 `$var`、`@mixin`、嵌套规则——那是 Sass，浏览器不认。
4. **禁止在模板中硬编码 URL**。一律用 `url_for()` 反向生成。
5. **禁止在 JS 中硬编码静态资源路径**。一律用 `window.cvclassUrl()`。
6. **禁止直接修改 `docs/` 目录**。`docs/` 是静态导出产物，源码在 `templates/`、`static/`。修改会被下次构建覆盖。

> 部署前缀说明：应用支持挂载到子路径（如 `/CVClass`）。`app.py:21-28` 读取 `CVCLASS_PREFIX` / `SCRIPT_NAME`，`base.html:18` 注入 `window.CVCLASS_BASE_PATH`。所有路径必须前缀感知，否则子路径部署必然 404。

---

## 2. 目录与文件组织

```
templates/
├─ base.html                      # 全局骨架（唯一，不要新增同级骨架）
├─ vision_tasks_base.html         # 二级骨架：视觉任务实验台
├─ feature_base.html              # 二级骨架：特征检测
├─ pages/                         # 首页、学习路径、知识图谱、算法原理
├─ vision_tasks/                  # 视觉任务子页面
├─ cnn/  edge/  feature/          # 各模块子页面
├─ convolution/  frontier/  ...
static/
├─ css/
│  ├─ core/       base.css  style.css        # 全局样式，谨慎改动
│  ├─ pages/      learning_path.css ...      # 页面级样式
│  ├─ vision_tasks/  edge/  feature/  cnn/   # 模块级样式
│  └─ vendor/                                # 第三方本地资源
├─ js/
│  ├─ core/       base.js  ai_assistant.js   # 全局脚本
│  ├─ pages/                                  # 页面级脚本
│  ├─ inference/  vision_inference_worker.js  # 推理 Worker
│  └─ ...
└─ assets/
   ├─ img/  data/  examples/  frontier/
   └─ author/
```

### 命名约定

| 类型 | 约定 | 示例 |
|---|---|---|
| 模板 | `snake_case.html`，与模块同名 | `learning_path.html` |
| 样式 | `snake_case.css`，按模块归类 | `vision_tasks/object_detection_lab.css` |
| 脚本 | `snake_case.js`，与模板同名 | `js/pages/learning_path.js` |
| CSS 类 | `kebab-case`，模块前缀 | `module-card`、`domain-card`、`edge-preview` |
| 修饰符 | `block--modifier`（双横线） | `module-card--learned`、`domain-card--basic` |
| 状态 | `is-*` 前缀 | `is-active`、`is-selected`、`is-changing` |
| 数据属性 | `data-<module>-<field>` | `data-vision-page`、`data-feature-mode` |

> 状态类统一用 `is-active`（全仓库 CSS 中 `is-active` 出现 **322 次**），不要混用 `.active`。唯一的例外是侧边栏 `.sidebar-nav a.active`（`base.css:121`）和首页导航，那是历史遗留的导航专用类，新页面请用 `is-active`。

---

## 3. 模板层规范（Jinja2）

### 3.1 三层继承模型

```
base.html                                   ← 全局骨架
 ├─ vision_tasks_base.html  → vision_tasks/*.html
 ├─ feature_base.html       → feature/*.html
 └─ pages/*.html  cnn/*.html  edge/*.html  ...
```

**规则**：新页面必须 `{% extends %}` 已有骨架，不要复制 `base.html` 另起一套。若某模块有 5 个以上结构相似的子页面，先抽一个二级骨架。

### 3.2 四个标准插槽

`base.html` 只暴露四个块：

```jinja
{% block title %}{% endblock %}         {# 页面标题 #}
{% block extra_css %}{% endblock %}     {# base.html:14  页面专属样式 #}
{% block content %}{% endblock %}       {# base.html:199 页面主体 #}
{% block extra_js %}{% endblock %}      {# base.html:205 页面专属脚本 #}
```

二级骨架通常再开一个内容块（如 `feature_base.html:94` 的 `{% block feature_content %}`），子页面填充它而不是 `content`。

**追加而非覆盖**，需要保留父级资源时写 `{{ super() }}`：

```jinja
{% extends "vision_tasks_base.html" %}
{% block extra_css %}
{{ super() }}
<link rel="stylesheet" href="{{ url_for('static', filename='css/vision_tasks/classification_lab.css') }}?v=20260626-titlescn1">
{% endblock %}
```

### 3.3 资源引入规范

静态资源一律通过 `url_for('static', ...)` 引入，并**手写缓存版本号**（本项目无文件名 hash 机制）：

```jinja
<link rel="stylesheet" href="{{ url_for('static', filename='css/core/base.css') }}?v=20260627-quest-map2">
<script src="{{ url_for('static', filename='js/core/base.js') }}?v=20260628-quest-learned-maps"></script>
```

版本号格式建议 `?v=<日期>-<简短变更标识>`，例：`?v=20260628-remove-sem-grid`、`?v=20260626-titlescn1`。
**改了 CSS/JS 就必须改版本号**，否则用户浏览器命中旧缓存。

第三方库按需引入，不要全局加载：

```jinja
{% block extra_css %}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
{% endblock %}
{% block extra_js %}
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
{% endblock %}
```

> 例外：ONNX Runtime 因需配套 WASM 文件，使用本地 `static/vendor/onnxruntime-web/`，不支持 CDN 回退的页面必须本地引入。

**条件加载**：同一骨架下不同子页面资源差异大时，用 `active_sub_page` 分流（见 `vision_tasks_base.html:5-31` 的完整写法）：

```jinja
{% block extra_css %}
{% if active_sub_page == 'detection' %}
<link rel="stylesheet" href="{{ url_for('static', filename='css/vendor/katex-lite.css') }}?v=20260625-det-sandbox1">
{% else %}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
{% endif %}
{% if active_sub_page == 'detection' %}
<link rel="stylesheet" href="{{ url_for('static', filename='css/vision_tasks/object_detection_lab.css') }}?v=20260626-yolostep2">
{% endif %}
{% endblock %}
```

这样做的好处：检测页只用轻量 KaTeX 子集 + 检测样式，不会把分割页的 150KB CSS 一起下载。

### 3.4 服务端上下文注入

页面所需数据由路由函数通过 `render_template(..., **context)` 传入，模板只做展示。路由端构造上下文的典型写法见 `page_routes.py:7-100`（`build_vision_module_context`），它按 `module_key` 生成 `active_page`、`eyebrow/title/subtitle/badge`、`nav` 等。

模板中用**默认值兜底**，避免子页面漏传导致渲染崩：

```jinja
<h1 class="station-title">{{ vision_module_title|default('视觉任务实验室') }}</h1>
<p class="station-summary">{{ vision_module_subtitle|default('默认说明文字') }}</p>
{% for item in vision_module_nav|default([]) %}
<a class="{{ 'is-active' if item.active else '' }}" href="{{ item.href }}">{{ item.label }}</a>
{% endfor %}
```

`base.html:17-23` 会把页面上下文注入 JS 全局，前端脚本据此判断当前页：

```jinja
<script>
    window.CVCLASS_BASE_PATH     = "{{ request.script_root or '' }}";
    window.CVCLASS_COMPUTE_CONFIG = {{ compute_config|tojson }};
    window.CVCLASS_ACTIVE_PAGE    = {{ active_page|default('')|tojson }};
    window.CVCLASS_ACTIVE_SUB_PAGE = {{ active_sub_page|default('')|tojson }};
    window.CVCLASS_AI_ENABLED     = {{ ai_assistant_enabled|tojson }};
</script>
```

**注意**：注入字符串必须走 `|tojson` 转义，**不要**直接写 `"{{ value }}"`，否则值含引号时会破坏脚本。

### 3.5 宏（Macro）复用重复结构

同一骨架内重复出现的结构，抽成宏放在骨架的 `{% block %}` 外：

```jinja
{# feature_base.html:2-34 #}
{% macro feature_timeline(active) -%}
<section class="feature-panel feature-flow">
    {% if active == 'corner' %}
        {% set flow_title = '角点检测计算流程' %}
        {% set steps = [('input','Input','输入图像'), ('gray','Gray','灰度化'), ...] %}
    {% endif %}
    <strong>{{ flow_title }}</strong>
    <div class="feature-flow-line">
        {% for key, en, zh in steps %}
        <span class="flow-step is-active"><i>{{ loop.index }}</i><b>{{ en }}</b><small>{{ zh }}</small></span>
        {% endfor %}
    </div>
</section>
{%- endmacro %}
```

### 3.6 页面根元素与数据属性接线

**每个页面的根元素必须带唯一 ID 或数据属性**，供 JS 定位与配置下发：

```jinja
{# feature_base.html:56-62 #}
<section
    id="featurePage"
    class="feature-page"
    data-feature-mode="{{ feature_mode }}"
    data-compute-mode="{{ compute_config.feature_detection }}"
    data-assets-base="{{ url_for('static', filename='assets/img/') }}"
>
```

模型地址、WASM 路径这类运行时配置同样用 `data-*` 下发（见 `docs/edge-detection/canny/index.html:179-183`）：

```html
<div class="edge-page"
     data-edge-mode="canny"
     data-teed-model-url="{{ url_for('static', filename='assets/data/edge/teed_debug_352.onnx') }}"
     data-ort-script-url="{{ url_for('static', filename='vendor/onnxruntime-web/ort.min.js') }}"
     data-ort-wasm-base="{{ url_for('static', filename='vendor/onnxruntime-web/') }}">
```

好处：**配置与逻辑分离**，换模型/换部署前缀只改模板，JS 不动。

### 3.7 语义化与无障碍基线

```jinja
<header class="vision-hero station-hero">                     {# 用 header 而非 div #}
<nav class="vision-tabs station-tabs" aria-label="内部导航">  {# nav 必须带 aria-label #}
<a class="... is-active" href="...">目标检测</a>
<button type="button" aria-label="查看 Input 步骤">...</button>  {# 纯图标按钮必须带 aria-label #}
```

装饰性元素加 `aria-hidden="true"`（图标、装饰图）：
```jinja
<img class="flow-icon" src="{{ url_for('static', filename='assets/img/home01.webp') }}" alt="" aria-hidden="true">
<span class="flow-arrow" aria-hidden="true">&rarr;</span>
```

---

## 4. CSS 设计系统

### 4.1 设计令牌（Design Token）

本项目采用**双层变量**：全局层放布局与中性色，页面层放品牌色。

**全局层**（`static/css/core/base.css:1-10`）：
```css
:root {
    --sidebar-width: 240px;
    --lab-shell-max: 1760px;      /* 内容最大宽度 */
    --lab-shell-gutter: 24px;     /* 内容两侧最小留白 */
    --page-bg: #f8fafc;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --line: #e2e8f0;
    --blue: #2563eb;
}
```

**页面层**（`base.css:449-455`，首页举例）：
```css
--home-blue: #1d5cff;    --home-ink: #071536;   --home-muted: #566982;
--home-border: #dce8f8;  --home-soft: #eef6ff;  --home-header-height: 74px;
```

**规则**：
1. **新增页面必须自建变量命名空间**（如 `--edge-*`、`--seg-*`），不要直接写散落的 hex。
2. 同一语义色在一处定义，全文件引用变量。`--home-blue` 在 `base.css` 被引用 38 次。
3. 中性灰阶建议沿用 slate 体系（`style.css:4-10`）：
   ```css
   --slate-50: #f8fafc;  --slate-100: #f1f5f9;  --slate-200: #e2e8f0;
   --slate-400: #94a3b8; --slate-500: #64748b;  --slate-700: #334155;  --slate-950: #020617;
   ```

### 4.2 用 `color-mix()` 派生色阶（本项目的核心技巧）

**不要**为每个状态手写 5 个色值，用 `color-mix()` 从主色派生。全仓库用了 **21 次**。

以首页"四大学习域"卡片为例（`base.css:1967-2040`）：

```css
.domain-card {
    --domain-accent: var(--home-blue);   /* 主色 */
    --domain-soft: #eff6ff;              /* 极浅底 */
    --domain-border: #cfe0ff;            /* 边框 */
    border: 1px solid var(--domain-border);
    background: linear-gradient(145deg, rgba(255,255,255,0.98) 0%, var(--domain-soft) 100%);
}

/* 每个域只覆盖三个变量，其余全部自动派生 */
.domain-card--basic    { --domain-accent: #1d5cff; --domain-soft: #f4f8ff; --domain-border: #b9d2ff; }
.domain-card--deep     { --domain-accent: #18a058; --domain-soft: #f2fff8; --domain-border: #bcebd2; }
.domain-card--geometry { --domain-accent: #7c3aed; --domain-soft: #f7f3ff; --domain-border: #dac7ff; }
.domain-card--frontier { --domain-accent: #f97316; --domain-soft: #fff8f1; --domain-border: #fed7aa; }

/* 以下全部由 --domain-accent 自动计算 */
.domain-card::after {
    border: 18px solid color-mix(in srgb, var(--domain-accent) 18%, transparent);   /* 装饰圆环 */
}
.domain-number {
    background: linear-gradient(135deg, color-mix(in srgb, var(--domain-accent) 88%, #ffffff), var(--domain-accent));
    box-shadow: 0 12px 20px color-mix(in srgb, var(--domain-accent) 18%, transparent);
}
.domain-tags span {
    color: color-mix(in srgb, var(--domain-accent) 78%, #102246);
    background: color-mix(in srgb, var(--domain-accent) 9%, #ffffff);
}
.domain-link { color: var(--domain-accent); }
```

**效果**：四张卡片蓝/绿/紫/橙各成一派，但规则完全一致——"统一中有变化"。

**语义色透明度建议**：

| 用途 | 混色比例 |
|---|---|
| 极浅背景（tag、pill 底） | 9% |
| 装饰环 / 光晕 | 16% ~ 18% |
| 悬浮阴影 | 18% ~ 22% |
| 编号徽章渐变起点 | 88% |

### 4.3 页面作用域隔离

**所有页面级样式必须以 body 类为前缀**，避免跨页面污染。`base.html:16` 通过 Jinja 动态挂类：

```jinja
<body class="cv-shell sidebar-collapsed
    {{ 'home-page-shell' if active_page|default('') in ['home','learning_path',...] else '' }}
    {{ 'knowledge-page-shell' if active_page|default('') == 'knowledge_graph' else '' }}
    ...">
```

对应 CSS：
```css
body.home-page-shell .site-nav { display: flex; gap: 38px; height: 100%; }
body.home-page-shell .site-brand-text strong { font-size: 22px; font-weight: 950; }
body.home-page-shell .sidebar-toggle { top: 86px; left: 29px; }
```

**收益**：同一个 `.site-nav` 在首页是横向大导航，在实验页是另一套展示规则，互不干扰。
**新增页面时**，若需要用 `body` 作作用域，在 `base.html:16` 的 class 表达式里加一个条件分支。

### 4.4 命名与 BEM 修饰符

```css
.module-card { }                      /* 块 */
.module-card--learned { }             /* 状态修饰：已学习 */
.module-card--clickable { }           /* 行为修饰：可点击 */
.module-card-head { }                 /* 内部元素：头部 */
.module-card-foot { }                 /* 内部元素：底部 */
```

**规则**：
- 修饰符用 `--`，元素用 `-`，不用 `__`（本项目未采用标准 BEM 的 `__`）。
- 状态修饰用 `--`（`module-card--learned`、`quest-mini-node--completed`），**交互状态用 `is-*`**（`is-active`、`is-selected`、`is-changing`、`is-hovered`）。
- 模块内元素名前缀模块名（`edge-preview-fog`、`seg-overlay-badge`），防止跨模块撞名。

### 4.5 单位与数值约定

| 属性 | 约定 | 实例 |
|---|---|---|
| 圆角 | 8 / 9 / 10 / 11 / 12 px（控件）<br>18 / 20 / 22 px（面板） | `border-radius: 12px`（卡片）<br>`border-radius: 22px`（大面板） |
| 间距 | 4 的倍数 + 少量 6/9/13 | `gap: 18px`、`padding: 13px 16px 12px` |
| 过渡时长 | 0.18s / 0.2s / 0.22s（交互）<br>0.28s ~ 0.42s（形态变化） | `transition: transform 0.18s ease` |
| 阴影模糊 | 18~28px（卡片）<br>34~46px（面板） | `box-shadow: 0 10px 21px ...` |
| 阴影透明度 | **0.045 ~ 0.11** |
| 内容最大宽 | `min(var(--lab-shell-max), calc(100% - var(--lab-shell-gutter)))` | `base.css:170` |

**关键数值纪律**：阴影透明度**不要超过 0.11**。本项目所有卡片阴影落在 `0.045 ~ 0.11` 区间，这是"轻盈不脏"的核心。写成 `rgba(0,0,0,0.25)` 会立刻显廉价。

---

## 5. 布局规范

### 5.1 内容容器：一行搞定"最大宽 + 自适应留白"

```css
/* base.css:169-173 */
.content-shell {
    width: min(var(--lab-shell-max), calc(100% - var(--lab-shell-gutter)));
    margin: 0 auto;
    padding: 28px 0 44px;
}
```

`min(1760px, 100% - 24px)` = 宽屏封顶、窄屏自动留白，**无需媒体查询**。新页面若要独立容器，沿用同一模式：

```css
.my-page-shell {
    width: min(var(--lab-shell-max), calc(100% - var(--lab-shell-gutter)));
    margin: 0 auto;
    padding: 24px 0;
}
```

### 5.2 侧边栏让位：`fixed` + `margin` + 同步过渡

```css
/* base.css:32-47 / 160-167 */
.sidebar {
    position: fixed;
    inset: 0 auto 0 0;             /* 上下 0、左 0 */
    z-index: 40;
    width: var(--sidebar-width);
    transition: transform 0.22s ease;
}
.sidebar-collapsed .sidebar { transform: translateX(calc(-1 * var(--sidebar-width))); }

.main-content { transition: margin-left 0.22s ease; }
body:not(.sidebar-collapsed) .main-content { margin-left: var(--sidebar-width); }
```

**要点**：侧栏用 `transform`（GPU 加速）而非 `left`；主内容用 `margin-left`；**两者时长必须一致**（0.22s），否则折叠动画会"撕裂"。

### 5.3 主视觉用 Grid 的**非对称比重**

```css
/* base.css:609-625 */
.home-page .home-hero {
    display: grid;
    grid-template-columns: minmax(470px, 0.88fr) minmax(760px, 1.38fr);
    align-items: stretch;
    min-height: 329px;
    padding: 30px 66px 20px 119px;   /* 左侧 119px 给折叠按钮让位 */
    overflow: hidden;
}
```

**要点**：
- 用 `minmax(min, Nfr)` 而不是纯 `1fr`——**小屏不塌、大屏按比重分**。
- 比重按视觉重心调（这里约 3.9 : 6.1），不要无脑 `1fr 1fr`。
- 带 `position: fixed` 按钮的页面，容器左内边距要预留按钮宽度。

### 5.4 栅格：`repeat(N, minmax(0, 1fr))`

```css
.domain-grid          { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.featured-module-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 18px; }
```

**必须写 `minmax(0, 1fr)`**，不要只写 `1fr`。原因：`1fr` 的隐式最小值是 `auto`，内容（长英文、长 URL、`white-space: nowrap`）会把列撑破；`minmax(0, 1fr)` 强制可收缩。

### 5.5 卡片内部纵向节奏 + 等高对齐

```css
/* base.css:1130-1141 */
.module-card {
    display: grid;
    grid-template-rows: auto auto 1fr auto;   /* 图标 / 标题 / 描述(撑开) / 页脚 */
    height: 100%;
    min-height: 142px;
}
```

`1fr` 放在"描述"行，把剩余空间吸收掉，**页脚永远贴底**。配合外层栅格（`grid` 默认 `stretch`），同行卡片自然等高。

### 5.6 长文本截断换取栅格整齐

```css
/* base.css:1188-1199  卡片描述最多 2 行 */
.module-card p {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}
/* base.css:2067-2077  学习域描述最多 1 行 */
.domain-card p { -webkit-line-clamp: 1; }
```

**行数配额约定**：
| 场景 | 行数 |
|---|---|
| 卡片摘要（模块卡、学习域卡） | 1 ~ 2 行 |
| 面板内说明段落 | 不截断，靠 `max-width` 控制 |
| 表格单元格 | 1 行 + `ellipsis` |

### 5.7 阈值下拉/长列表：滚动交给容器

```css
/* base.css:97-103 */
.sidebar-nav {
    display: grid;
    gap: 4px;
    max-height: calc(100vh - 110px);   /* 视口高度减去品牌区 */
    overflow-y: auto;
    padding-right: 2px;
}
```
用 `max-height: calc(100vh - 固定高度)` 让长导航自己滚动，**不要把滚动甩给 body**。

### 5.8 断点体系

固定 5 级，不要随意新增：

```css
@media (max-width: 1280px) { /* 4 列 → 3 列 */ }
@media (max-width: 1080px) { /* 双栏 → 单栏 */ }
@media (max-width: 900px)  { /* 顶栏换行、侧栏转抽屉 */ }
@media (max-width: 760px)  { /* 按钮竖排、字号下调 */ }
@media (max-width: 560px)  { /* 内边距压缩 */ }
```

**降列，不是全塌**。示例（`base.css:3136-3224`）：
```css
@media (max-width: 1280px) {
    .quest-stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1080px) {
    .quest-hero, .quest-workspace { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
    .quest-hero-actions { align-items: stretch; flex-direction: column; }
    .quest-hero-actions .home-primary-button,
    .quest-hero-actions .home-secondary-button { width: 100%; min-width: 0; }
    .quest-stat-grid { grid-template-columns: 1fr; }
}
```

**移动端侧栏转抽屉**：
```css
/* base.css:153-158 */
.sidebar-overlay { position: fixed; inset: 0; z-index: 30; background: rgba(15, 23, 42, 0.22); }
```
遮罩用 `hidden` 属性控制（`base.html:195`），由 `base.js:30` 绑定点击收起。

### 5.9 流体字号用 `clamp()`，不用多断点硬改

```css
/* base.css:188 */
.page-heading h1 { font-size: clamp(30px, 4vw, 48px); }
/* style.css:63 */
.app-header h1   { font-size: clamp(36px, 5.8vw, 60px); }
```
`clamp(最小值, 视口比例, 最大值)` —— 一行替代 3 个媒体查询。

### 5.10 锚点定位补偿

页面内 `#anchor` 跳转时，固定顶栏会遮挡目标。用 `scroll-padding-top` 而非 `scroll-margin-top`（一次设置，全局生效）：

```css
/* base.css:16-22 */
html { scroll-padding-top: 12px; }
body:has(.vision-lab) { scroll-padding-top: 80px; }   /* 有固定头部的实验室页 */
```

`:has()` 让"内容决定外壳"，避免再加一个 body class。本项目 `:has()` 仅此一处，属精准使用。

---

## 6. 视觉规范

本节是"界面好看"的核心，所有数值均来自本仓库实测。

### 6.1 阴影体系：三层 + 极低透明度

```css
/* ① 次要卡片：最浅  base.css:2124-2128 */
.featured-module-grid .module-card { box-shadow: 0 8px 18px rgba(15, 23, 42, 0.045); }

/* ② 主卡片    base.css:1130-1140 */
.module-card { box-shadow: 0 10px 21px rgba(15, 23, 42, 0.065); }

/* ③ 悬浮态：带主题色  base.css:1153-1157 */
.module-card--clickable:hover,
.module-card--clickable:focus-visible {
    border-color: rgba(29, 92, 255, 0.36);
    box-shadow: 0 14px 28px rgba(37, 99, 235, 0.11);
}

/* ④ 大面板    style.css:84-89 */
.hero-card { box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08); }
```

**四条纪律**：
1. **透明度 ≤ 0.11**。整个仓库无一处超过 0.11 的卡片阴影。
2. **Y 偏移 ≈ 模糊值的 0.5 倍**（`0 10px 21px`、`0 18px 46px`），这是"自然光"比例。
3. **悬浮时阴影换成主题色**（`rgba(37,99,235,...)` 而非黑色）——产生"发光"而非"变脏"。
4. **阴影与边框同步变化**，形成联动反馈，不要只动阴影。

### 6.2 边框用半透明色，不用纯灰

```css
/* base.css:179 */
border: 1px solid rgba(226, 232, 240, 0.95);
/* base.css:38 */
border-right: 1px solid rgba(226, 232, 240, 0.95);
```
半透明边框在不同底色上自动"融合"，比 `#ccc` 更高级。

### 6.3 毛玻璃（`backdrop-filter`）：模糊值越大，背景越透明

全仓库 `backdrop-filter` 用了 **100+ 次**，但严格遵循配对规律：

| 模糊值 | 配套背景透明度 | 场景 |
|---|---|---|
| `blur(6px)` | `rgba(255,255,255,0.78)` | 局部小浮层 |
| `blur(10px)` | `rgba(255,255,255,0.82)` | 提示气泡 |
| `blur(12px)` | `rgba(255,255,255,0.92)` | 弹窗 |
| `blur(18px)` | `rgba(255,255,255,0.94)` | 顶部导航（`base.css:472-475`） |
| `blur(22px)` | `rgba(255,255,255,0.72)` | 数据面板（`style.css:84-88`） |

```css
/* base.css:472-476 */
background: rgba(255, 255, 255, 0.94);
box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
backdrop-filter: blur(18px);
```

**禁止**在需要长时间阅读正文的大面积区域用毛玻璃（对比度不足）。

### 6.4 多层 `background` 叠纹理（零图片成本，本项目最值钱的技巧）

核心手法：**用 `linear-gradient` 的色带模拟 1px 线条，用 `radial-gradient` 模拟圆点**，再用 `mask-image` 渐隐。

```css
/* base.css:627-640  首页 Hero 装饰层 */
.home-page .home-hero::before {
    content: "";
    position: absolute;
    inset: 0 0 auto auto;
    width: 59%;
    height: 100%;
    opacity: 0.55;
    background:
        /* ① 一条 1% 宽的对角斜线（用色带，不用 border） */
        linear-gradient(120deg, transparent 0 54%, rgba(191, 219, 254, 0.45) 54% 55%, transparent 55%),
        /* ② 反方向斜线 */
        linear-gradient(60deg,  transparent 0 64%, rgba(219, 234, 254, 0.55) 64% 65%, transparent 65%),
        /* ③ 水平网格线，每 50px 一条 */
        repeating-linear-gradient(0deg,  rgba(147, 197, 253, 0.16) 0 1px, transparent 1px 50px),
        /* ④ 垂直网格线 */
        repeating-linear-gradient(90deg, rgba(147, 197, 253, 0.16) 0 1px, transparent 1px 50px);
    /* ⑤ 让装饰从左往右渐显，避免生硬裁切 */
    mask-image: linear-gradient(90deg, transparent 0%, #000 18%, #000 100%);
}
```

**技术要点**：
- `linear-gradient(120deg, transparent 0 54%, 色 54% 55%, transparent 55%)` → 用 **1% 色带**画线。色带太宽会糊，建议 0.8% ~ 1.2%。
- `repeating-linear-gradient` 做等距网格，间距自己定（这里 50px；`cnn_visualization.css:137-143` 用 28px）。
- `mask-image` 是"高级感"的关键一步：不加就变成一块硬边矩形。

**另一实例**（网格 + 径向光斑，`cnn_visualization.css:137-143`）：
```css
background:
    linear-gradient(rgba(37, 99, 235, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
    radial-gradient(circle at 42% 0%, rgba(96, 165, 250, 0.2), transparent 46%),
    linear-gradient(180deg, #ffffff 0%, #f5f8fd 100%);
background-size: 28px 28px, 28px 28px, auto, auto;
```

### 6.5 纯 CSS 绘制图标（禁止依赖图标字体）

**这是本项目最硬核的技巧。新增页面必须复用此方式，而不是引入 iconfont。**

#### 画"点"：`radial-gradient` + 极窄过渡

```css
/* base.css:983-999  CNN 图标的 3×4 神经元点阵 */
.flow-icon--cnn::before {
    inset: 18px 15px;
    background:
        linear-gradient(24deg,  transparent 48%, rgba(29, 92, 255, 0.7) 49% 51%, transparent 52%),
        linear-gradient(-24deg, transparent 48%, rgba(29, 92, 255, 0.55) 49% 51%, transparent 52%),
        linear-gradient(90deg,  transparent 48%, rgba(29, 92, 255, 0.5) 49% 51%, transparent 52%),
        radial-gradient(circle at 4% 15%,  var(--home-blue) 0 3.8px, transparent 4.3px),
        radial-gradient(circle at 5% 50%,  var(--home-blue) 0 3.8px, transparent 4.3px),
        /* … 共 10 个 radial-gradient 定位出点阵 */
        radial-gradient(circle at 78% 90%, var(--home-blue) 0 3.8px, transparent 4.3px);
}
```

**配方**：`radial-gradient(circle at X% Y%, 色 0 <r>px, transparent <r+0.5>px)`
- 实心圆半径 `r`，外扩 **0.5px** 做抗锯齿过渡。扩太多会糊，扩 0 会有锯齿。
- 常用 `r`：`3px`（小点）、`3.8px`（中点）、`4px`（大点）。

#### 画"线"：`linear-gradient` 色带

```css
/* base.css:972-974  用 2% 色带画连线 */
linear-gradient(36deg, transparent 48%, rgba(29,92,255,0.68) 49% 51%, transparent 52%)
```

#### 画"形状"：`clip-path` / `border`

```css
/* base.css:1289  六边形 */
clip-path: polygon(50% 0, 92% 22%, 92% 72%, 50% 100%, 8% 72%, 8% 22%);

/* base.css:1410-1412  虚线框 */
border: 1.5px dashed #2f7bff;
border-radius: 4px;

/* base.css:1343-1348  带偏移投影的框 */
inset: 6px;
border: 2px solid #2f7bff;
box-shadow: -3px -3px 0 -1px #ffffff, 5px 5px 0 -1px rgba(29, 92, 255, 0.18);
```

#### 完整图标骨架模板

```css
/* 1. 容器声明 */
.my-icon {
    position: relative;
    display: inline-block;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    overflow: hidden;
    color: var(--my-accent);     /* 便于统一换色 */
}

/* 2. 两个伪元素都铺成绝对定位层 */
.my-icon::before,
.my-icon::after {
    content: "";
    position: absolute;
    display: block;
}

/* 3. 用 inset 定义每层绘制区域，图形塞进 background 多层 */
.my-icon::before { inset: 6px; background: /* 多层渐变 */; }
.my-icon::after  { inset: 0;   background: /* 多层径向点 */; }
```

**为什么这么做**：
- 0 网络请求、0 字体加载、无 FOUC（图标字体闪烁）
- 可用 CSS 变量换色，天然适配 `color-mix()` 主题派生
- 可用 `transform` / `transition` 做动效

**可参考的完整图标族**：`base.css:1281-1420`（`mini-icon--cube` / `--kernel` / `--edge` / `--match` / `--cnn` / `--detect` / `--segment` / `--tasks` / `--pose` / `--instance`）。

### 6.6 渐变文字（少量点睛，勿滥用）

```css
/* style.css:61-70 */
.app-header h1 {
    font-size: clamp(36px, 5.8vw, 60px);
    background: linear-gradient(90deg, var(--blue), var(--indigo), var(--violet));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}
```
**必须同时写 `-webkit-background-clip` 和 `background-clip`**，并设置 `color: transparent`。只用于 1 处主标题，不要用在正文。

### 6.7 按钮体系

```css
/* base.css:692-724 */
.home-primary-button,
.home-secondary-button {
    display: inline-flex;                   /* 文字垂直居中且宽度自适 */
    align-items: center;
    justify-content: center;
    min-height: 49px;                       /* 用 min-height 而非 height，防换行截断 */
    border-radius: 11px;
    padding: 0 41px;
    font-size: 16px;
    font-weight: 900;
    text-decoration: none;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

/* 主按钮：纵向渐变底 + 主题色阴影 */
.home-primary-button {
    gap: 9px;
    color: #ffffff;
    background: linear-gradient(180deg, #236dff 0%, #1056e8 100%);
    box-shadow: 0 16px 28px rgba(29, 92, 255, 0.22);
}

/* 次按钮：描边 + 接近不透明的白底（不用渐变） */
.home-secondary-button {
    gap: 12px;
    min-width: 214px;
    color: #1055de;
    border: 1px solid #b6cff8;
    background: rgba(255, 255, 255, 0.92);
}

/* 微位移：1px，不要更多 */
.home-primary-button:hover,
.home-secondary-button:hover { transform: translateY(-1px); }
```

**要点**：
- `display: inline-flex` + `align-items: center` 保证任意文案都垂直居中。
- 用 `min-height` 而非 `height`。
- 主按钮渐变角度 **180deg（纯纵向）**，比 135deg 更沉稳。
- hover 位移 **1~2px**（`base.css:3263-3266` 的 AI 悬浮球是 2px）。多了就"飘"。

### 6.8 状态徽章（Pill）

```css
/* base.css:1209-1233 */
.module-status {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    border-radius: 6px;
    padding: 0 8px;
    font-size: 11px;
    line-height: 1;
    font-weight: 900;
}
.module-status--done    { color: #14a15b; background: #ddf8e9; }   /* 绿 = 已完成 */
.module-status--pending { color: #0f172a; background: #f1f5f9; }   /* 灰 = 待学习 */
.module-status--planned { color: #f08a17; background: #fff0d9; }   /* 橙 = 计划中 */
```

**配方**：文字用同色系深色，底色用同色系极浅色。尺寸全部一致（`min-height: 20px`），即使十几个徽章并排也不乱。

### 6.9 排版层级

| 层级 | 字号 | 字重 | 行高 | 用途 |
|---|---|---|---|---|
| 小标签 | 12~17px | 900~950 | — | `section-label`，配 `letter-spacing: 0.09~0.14em` + `uppercase` |
| 页面大标题 | `clamp(36px, 5.8vw, 60px)` | 950 | 0.94~1.06 | Hero H1 |
| 区块标题 | 16~17px | 950 | 1.25 | 卡片/面板 H3 |
| 正文 | 13~16px | 650 | 1.35~1.82 | 描述文字 |
| 次要说明 | 11~12px | 850~900 | 1 | 徽章、标签 |

**字重策略**：本项目大量使用 **850 / 900 / 950**（`base.css` 中 900+ 出现 45 次），配中等字重正文（650）。
**注意**：`Inter` 是可变字体，支持 950；若改用系统字体，「微软雅黑」只有 Regular/Bold，`font-weight: 950` 会回退为 Bold，视觉会变轻。

**中英混排纪律**：
```css
font-family: Inter, "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
```
英文用 Inter、中文用微软雅黑兜底，**避免中西文字形跳变**。不要只写 `Inter`，那样中文会退到系统默认衬线体。

### 6.10 标签云（Tag Cloud）

```css
/* base.css:2079-2099 */
.domain-tags { display: flex; flex-wrap: wrap; gap: 6px 7px; min-height: 44px; }
.domain-tags span {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    border-radius: 6px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 850;
    color: color-mix(in srgb, var(--domain-accent) 78%, #102246);
    background: color-mix(in srgb, var(--domain-accent) 9%, #ffffff);
}
```
`min-height: 44px` 预留两行高度，**保证标签数不同的卡片高度一致**。

---

## 7. 交互、动效与响应式

### 7.1 `transition` 只写具体属性，禁止 `all`

```css
/* base.css:703 — 正确 */
transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
```

```css
/* 禁止 */
transition: all 0.3s;
```

**原因**：`all` 会把 `width`/`height`/`top`/`left` 等触发布局的属性一起过渡，导致回流抖动与掉帧。只列需要动画的属性。

**时长速查**：

| 场景 | 时长 |
|---|---|
| 按钮/卡片 hover | `0.18s ease` |
| 折叠/展开（侧栏） | `0.22s ease` |
| 遮罩淡入淡出 | `0.22s` |
| 面板形态变化 | `0.28s ~ 0.42s` |
| 算法演示循环动画 | `1.8s ~ 2.4s ease-in-out infinite` |

### 7.2 焦点态：用 `:focus-visible` 而非 `:focus`

```css
/* base.css:1159-1162 */
.module-card--clickable:focus-visible {
    outline: 3px solid rgba(59, 130, 246, 0.22);
    outline-offset: 3px;
}
```

**原因**：`:focus` 会让鼠标点击也出现焦点框（观感差），`:focus-visible` 只在键盘导航时出现。
**配比**：`outline: 3px` + `outline-offset: 3px` + 透明度 0.22，既有可见性又不刺眼。

### 7.3 激活态用 `inset` 内阴影描边，不改尺寸

```css
/* base.css:121-125  侧栏一级：实心蓝底 */
.sidebar-nav a.active {
    color: #ffffff;
    background: var(--blue);
    box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
}

/* base.css:147-151  侧栏二级：浅底 + 内描边（视觉权重递减） */
.sidebar-subnav a.active {
    color: #1d4ed8;
    background: #eff6ff;
    box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.36);
}
```

**层级表达原则**：一级用实心色块，二级用浅底 + 1px 内描边。用 `inset 0 0 0 1px` 描边**不占布局尺寸**，不会因激活态导致元素跳动。

### 7.4 悬停：位移 1~2px + 阴影放大

```css
/* base.css:721-724 */
.home-primary-button:hover,
.home-secondary-button:hover { transform: translateY(-1px); }

/* base.css:3263-3266 */
.ai-assistant-fab:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 32px rgba(37, 99, 235, 0.45);
}
```
**位移必须配合阴影变化**，单独位移会显得"悬空"。

### 7.5 键盘可达性：自定义控件用按钮，不用 div

```html
<!-- 正确（feature_base.html:27） -->
<button type="button" class="flow-step is-active" data-match-step="0" aria-label="查看 Input 步骤">
    <i>1</i><b>Input</b><small>输入图像</small>
</button>
```
可交互步骤用 `<button>` 而非 `<div>`，天然支持 Tab 聚焦与 Enter/Space 触发。

### 7.6 算法过程动画的三种实现手段

本项目的特色是**把算法执行过程动画化**（`edge_detection.css` 单文件 7470 行，含几十个 `@keyframes`）。

#### 手段 A：`clip-path` 做扫描 / 揭示

```css
/* edge_detection.css:4220-4227 */
@keyframes edgePreviewTraceReveal {
    0%        { clip-path: inset(0 100% 0 0); }   /* 完全裁掉 */
    85%, 100% { clip-path: inset(0 0 0 0); }      /* 完全显示 */
}
```
`inset(上 右 下 左)` —— 从右侧裁掉 100% 即"从左往右扫出"。

#### 手段 B：`background-position` 做流光 / 扫描线

```css
/* edge_detection.css:5034-5042 */
@keyframes edgeTeedScan {
    0%   { background-position: 0 -180%; }
    /* … */
}
/* edge_detection.css:5942-5945  流动光带 */
@keyframes edgeTeedLineSheen {
    0%   { background-position: 0% 50%; }
    100% { background-position: 220% 50%; }
}
```

#### 手段 C：`transform` 做节点脉冲 / 入场

```css
/* base.css:3114-3123 */
@keyframes questPulse {
    0%, 100% { opacity: 0.32; transform: scale(0.98); }
    50%      { opacity: 0.76; transform: scale(1.035); }
}

/* base.css:3125-3134 */
@keyframes questMapIn {
    from { opacity: 0.35; transform: translateX(10px); }
    to   { opacity: 1;    transform: translateX(0); }
}
```
**尺度极小**：`scale(0.98 → 1.035)`，只动 5.5%。动画幅度小才显"精密"，大幅跳动像 PPT。

#### 手段 D：SVG 路径绘制

```css
/* cnn/conv_gradient_lab.css:509-512 */
@keyframes pathFlow {
    0%  { opacity: 0; stroke-dashoffset: 34; }
    18% { opacity: 0.9; }
}
```
配合 `stroke-dasharray` 可实现"线条生长"效果。

### 7.7 动效降级（无障碍必需）

```css
/* base.css:3226-3236 */
@media (prefers-reduced-motion: reduce) {
    .quest-link::after,
    .quest-node.is-current::after,
    .quest-map.is-changing {
        animation: none;
    }
    .quest-node { transition: none; }
}
```
**新增任何循环动画（`infinite`）时，必须把它加进这个降级块。**

### 7.8 响应式补充规则

**图片**：
```css
/* base.css:495-500 */
.site-brand-icon img { width: 45px; height: 45px; object-fit: contain; display: block; }
```
`object-fit: contain`（图标）/ `cover`（背景图），并加 `display: block` 消除行内元素的基线间隙。

**表格与横向溢出**：不要给 `body` 加横向滚动，而是给具体容器：
```css
/* base.css:3080-3083 */
.my-table-wrap { margin-top: 12px; overflow-x: auto; padding-bottom: 2px; }
```

**移动端按钮铺满**：
```css
/* base.css:3186-3195 */
@media (max-width: 760px) {
    .quest-hero-actions { align-items: stretch; flex-direction: column; }
    .quest-hero-actions .home-primary-button,
    .quest-hero-actions .home-secondary-button { width: 100%; min-width: 0; }
}
```
注意 `min-width: 0` 必须加，否则会覆盖按钮自身的 `min-width: 214px`。

---

## 8. JavaScript 规范

### 8.1 模块结构：IIFE + `"use strict"`

本项目**没有模块系统**（无 ESM 打包），页面脚本统一用 IIFE 隔离作用域，避免污染 `window`。全仓库 73 个 JS 文件中大量使用此模式。

**标准骨架**：

```js
/* my_page.js — 一句话说明页面职责 */
(function () {
    "use strict";

    /* ① DOM 引用集中声明（只查一次） */
    const $ = (id) => document.getElementById(id);
    const els = {
        drop:    $("dropZone"),
        input:   $("imageInput"),
        canvas:  $("pzCanvas"),
        msg:     $("messageBar"),
        msgTimer: null,
    };

    /* ② 状态集中管理 */
    const st = {
        img: null, w: 0, h: 0,
        sc: 1, ox: 0, oy: 0,
        grid: true, mode: "rgb",
    };

    /* ③ 常量集中声明，大写命名 */
    const MIN_S = 0.25, MAX_S = 64, GRID_S = 8;

    /* ④ 工具函数 */
    function fmtSize(n) {
        if (n < 1024) return n + " B";
        if (n < 1048576) return (n / 1024).toFixed(2) + " KB";
        return (n / 1048576).toFixed(2) + " MB";
    }

    /* ⑤ 渲染 / 逻辑函数 */
    function render() { /* ... */ }

    /* ⑥ 事件绑定 */
    els.input.addEventListener("change", onFileChange);

    /* ⑦ 初始化 */
    render();
})();
```

**参照实现**：`static/js/pages/pixel_zoom.js:1-40`（含 `els` 映射与 `st` 状态对象）、`static/js/feature/feature_common.js`。

### 8.2 路径处理必须用 `cvclassUrl()`

**禁止硬编码 `/static/...`**。`base.js:2-8` 定义了全局方法：

```js
window.cvclassUrl = function cvclassUrl(path) {
    const basePath = window.CVCLASS_BASE_PATH || "";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (basePath && normalizedPath.startsWith(basePath + "/")) return normalizedPath;
    return `${basePath}${normalizedPath}`;
};
```

**正确用法**：
```js
// static/js/pages/pixel_zoom.js:25-28
const samples = [
    { id: "lena",    name: "Lena 512", src: cvclassUrl("/static/assets/img/lena_color_512.png") },
    { id: "peppers", name: "Peppers",  src: cvclassUrl("/static/assets/img/peppers_color.png") },
];
```

```js
// static/js/vision_tasks/classification_lab.js:11-13
const localOrtScriptUrl = window.cvclassUrl("/static/vendor/onnxruntime-web/ort.min.js");
const localOrtWasmBase  = window.cvclassUrl("/static/vendor/onnxruntime-web/");
const cdnOrtScriptUrl   = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js";
```

**禁止**：
```js
const url = "/static/assets/img/a.png";   // ✗ 子路径部署会 404
const url = "{{ url_for(...) }}";          // ✗ JS 里不写 Jinja
```

### 8.3 配置从 `data-*` 读取，不硬编码

```js
/* 推荐：在页面根元素上读取配置 */
const root = document.getElementById("featurePage");
const mode        = root.dataset.featureMode;   // data-feature-mode
const computeMode = root.dataset.computeMode;   // data-compute-mode
const assetsBase  = root.dataset.assetsBase;    // data-assets-base
```

对应模板（`feature_base.html:56-62`）：
```jinja
<section id="featurePage" class="feature-page"
    data-feature-mode="{{ feature_mode }}"
    data-compute-mode="{{ compute_config.feature_detection }}"
    data-assets-base="{{ url_for('static', filename='assets/img/') }}">
```

**好处**：换模型/换部署前缀只改模板。注意 `dataset` 会把 `data-feature-mode` 转成 `featureMode`（kebab → camel）。
**坑**：`data-assets-base` 已含完整路径，**不要**再套 `cvclassUrl()`，否则双重前缀。

### 8.4 页面级变量注入的读取

`base.html:17-23` 注入的全局变量：

| 变量 | 类型 | 用途 |
|---|---|---|
| `window.CVCLASS_BASE_PATH` | string | 部署前缀（供 `cvclassUrl` 用） |
| `window.CVCLASS_ACTIVE_PAGE` | string | 当前页面 key，如 `"edge"` |
| `window.CVCLASS_ACTIVE_SUB_PAGE` | string | 当前子页 key，如 `"canny"` |
| `window.CVCLASS_COMPUTE_CONFIG` | object | 各模块计算模式配置 |
| `window.CVCLASS_AI_ENABLED` | boolean | 是否启用 AI 助手 |

**读取务必带兜底**：
```js
const ap  = window.CVCLASS_ACTIVE_PAGE || "";
const asp = window.CVCLASS_ACTIVE_SUB_PAGE || "";
if (ap === "edge" && asp === "canny") { /* ... */ }
```
（参照 `base.js:170-172` 的 `autoMarkCurrentPage`）

### 8.5 状态持久化用 `localStorage`，key 统一前缀

```js
// static/js/core/base.js:32-33
const LEARNED_MODULES_KEY = "cvclass.learnedModules";
const activePageModuleMap = {
    grayscale: ["image-basic", "level-01-image-basic", "level-02-color-space", ...],
    "convolution:visual": ["convolution-filter", "level-05-convolution"],
    // ...
};
```

**规则**：
1. key 前缀统一 `cvclass.`，避免与其他站点冲突。
2. `JSON.parse` **必须包 try/catch**（`base.js:144` 附近），localStorage 可能被禁用或存有脏数据。
3. 读取后要校验类型：`const ids = Array.isArray(moduleIds) ? moduleIds : [];`

### 8.6 与后端通信：`fetch` + JSON

后端接口在 `app.py` / `ai_routes.py` 中定义（`@app.route(..., methods=["POST"])` + `jsonify`）。

```js
async function recognize(file) {
    const form = new FormData();
    form.append("image", file);
    const resp = await fetch(cvclassUrl("/digit-recognition"), { method: "POST", body: form });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || "请求失败");
    }
    return resp.json();
}
```

**规则**：
- URL 用 `cvclassUrl()` 包装。
- **必须处理 `!resp.ok`**，后端错误响应形如 `{"success": false, "message": "..."}`（`app.py:446-452`）。
- 大文件上传有 10MB 限制（`app.py:49`），超限返回 413。

### 8.7 错误提示：用页面内提示条，不用 `alert()`

```js
els.msg.textContent = "图片过大，请选择小于 10MB 的文件";
clearTimeout(els.msgTimer);
els.msgTimer = setTimeout(() => { els.msg.textContent = ""; }, 3200);
```
用定时器自动清除，并把 timer 句柄存在 `els`/`st` 上（`pixel_zoom.js:16` 的 `msgTimer: null`），防止连续调用时提示叠加。

### 8.8 重计算节流：`requestAnimationFrame`

```js
// pixel_zoom.js:40
let raf = 0;
function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; render(); });
}
```
拖拽、滚轮、`resize` 这类高频事件**必须合并到一帧**，否则会掉帧。

### 8.9 重型计算放 Web Worker

推理类任务放在 `static/js/inference/vision_inference_worker.js`，主线程只负责收发消息。

```js
const worker = new Worker(cvclassUrl("/static/js/inference/vision_inference_worker.js"));
worker.postMessage({ type: "infer", data: tensor, dims });
worker.onmessage = (e) => { /* 更新 UI */ };
```
**注意**：Worker 是**独立作用域**，不能访问 `document` / `window.cvclassUrl`，路径必须在主线程拼好再 `postMessage` 传进去。

### 8.10 脚本引入方式

```jinja
<script src="{{ url_for('static', filename='js/vision_tasks/object_detection_lab.js') }}?v=20260626-leftfont1"></script>
```

- **默认用传统 script**（IIFE 模式），保证执行顺序与全局可见性。
- 仅在确需 `import` 时才写 `type="module"`（如 `segmentation_lab_compare.js`）。
- **不要混用**：同一页面若部分脚本是 module、部分是传统 script，加载与执行顺序会变得难以预测。

### 8.11 DOM 就绪时机

`base.js` 与页面脚本都在 `</body>` 前引入（`base.html:203-205`），**DOM 已就绪，无需 `DOMContentLoaded`**，直接执行初始化即可。

若脚本必须在 `<head>` 中执行，才用：

```js
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
```

### 8.12 数值计算的写法约定

前端做像素级运算时（如灰阶、色域转换）统一用 TypedArray + 一次性取值：

```js
// pixel_zoom.js:63-86  逐像素计算的标准写法
function pixLabelLines(px, py) {
    const i = (py * st.w + px) * 4;              // ① 预先算好索引
    const r = st.pix[i], g = st.pix[i + 1], b = st.pix[i + 2];
    switch (st.mode) {
        case "gray": {
            const gr = Math.round(0.299 * r + 0.587 * g + 0.114 * b);   // ② 标准 ITU-R BT.601 权重
            return { ls: [String(gr)], dk: gr < 128 };
        }
        // ...
    }
}
```
**要点**：
- `st.pix` 是**已缓存的 `Uint8ClampedArray`**（`getImageData().data`），不要在循环里反复调 `getImageData`。
- 亮度阈值统一用 `128`（8 位中值），色域权重用 BT.601（`0.299 / 0.587 / 0.114`）。
- 结果取整用 `Math.round`，避免浮点尾巴显示成 `127.9999`。

---

## 9. 计算分层规范

本项目有"前端推理"和"后端计算"两条轨道，选择错误会导致页面卡死或部署失败。

### 9.1 决策表

| 场景 | 放在哪 | 理由 |
|---|---|---|
| 真实模型推理（YOLO、SegFormer、SAM、ViT） | **浏览器端 ONNX Runtime Web** | 不依赖后端 GPU，静态部署也能跑 |
| 像素级图像处理演示（灰阶、阈值、直方图） | **浏览器端 Canvas / TypedArray** | 毫秒级，无需往返 |
| 需要 NumPy 特性且教学强调"手动实现"的算法 | **后端 Python** | 见 `models/` 目录 |
| 生成式模型（Diffusion 的 UNet/VAE） | 浏览器端（大文件放可选下载） | 见 `docs/build_static.py:RUNTIME_ASSETS` |

### 9.2 前端推理的标准加载模式：本地优先 + CDN 回退

```js
// static/js/vision_tasks/classification_lab.js:11-13, 824-831
const localOrtScriptUrl = window.cvclassUrl("/static/vendor/onnxruntime-web/ort.min.js");
const localOrtWasmBase  = window.cvclassUrl("/static/vendor/onnxruntime-web/");
const cdnOrtScriptUrl   = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js";

if (!window.ort) throw new Error("ONNX Runtime Web 加载失败");
const wasmEnv = window.ort.env?.wasm;
if (wasmEnv) {
    wasmEnv.wasmPaths = localOrtWasmBase;    // ① WASM 必须指向本地目录
    wasmEnv.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);  // ② 线程数有上限
}
if (window.ort.env) window.ort.env.logLevel = "error";   // ③ 生产环境只留错误日志
```

**三条纪律**：
1. **WASM 的 `wasmPaths` 必须指向本地目录**，CDN 回退只能回退 `ort.min.js`，WASM 文件很难可靠跨域加载。
2. **线程数取 `min(4, hardwareConcurrency)`**，不要无脑用满核——浏览器主线程会被饿死。
3. **`logLevel = "error"`**，否则控制台被 warning 刷屏（`docs/build_static.py:206-215` 在构建时也会强制改写它）。

### 9.3 模型文件登记

新增前端模型时，**必须同步登记到 `docs/build_static.py` 的 `RUNTIME_ASSETS`**（第 34-54 行），否则静态导出会漏文件：

```python
RUNTIME_ASSETS = (
    "static/vendor/onnxruntime-web/ort.min.js",
    "static/vendor/onnxruntime-web/ort-wasm-simd-threaded.wasm",
    "static/assets/data/classification/flowers17_cnn.onnx",
    "static/assets/data/detection/yolo_detection.onnx",
    "static/assets/data/instance/yolo11n-seg.onnx",
    # ... 新增模型加在这里
)
```

### 9.4 模型版本号

替换 ONNX 权重后，需同步更新 JS 里的版本标识，让浏览器放弃旧缓存（见 README 关于 `MODEL_REVISION` 的说明）：

```js
const MODEL_REVISION = "2026-06-28";   // 换权重必须改
```
并在 fetch 时拼到 URL 上：`/static/assets/data/.../model.onnx?rev=${MODEL_REVISION}`。

### 9.5 后端接口的延迟导入纪律

`app.py:10-13` 的注释明确了约束：

> `models.*` 子模块顶层依赖 numpy 与 numba，PIL 仅在 backend 路由内使用，waitress / DispatcherMiddleware 仅在 `__main__` 块使用，**均改为按需延迟导入**；frontend 模式下不触发这些导入，从而降低内存与启动开销。

**新增后端接口时**：不要在 `app.py` 顶部 `import numpy` / `from PIL import Image`，要在函数内部导入。

---

## 10. 无障碍与性能

### 10.1 无障碍清单

- [ ] `<nav>` / `<header>` / `<main>` / `<aside>` 用语义标签，不用 `<div class="nav">`
- [ ] 每个 `<nav>` 有 `aria-label`
- [ ] 纯图标按钮有 `aria-label`
- [ ] 装饰性 `img` 写 `alt="" aria-hidden="true"`
- [ ] 可交互元素用 `<button>` / `<a>`，不用 `<div onclick>`
- [ ] 焦点态用 `:focus-visible`，`outline` 不得为 `none`
- [ ] 循环动画在 `@media (prefers-reduced-motion: reduce)` 中关闭
- [ ] 正文对比度 ≥ 4.5:1（毛玻璃区域尤其注意）

### 10.2 性能清单

**CSS**
- [ ] 新增样式文件按模块拆分，用条件加载（`vision_tasks_base.html:5-31` 的做法）
- [ ] 避免为单个页面加载全部模块样式
- [ ] 动画只用 `transform` / `opacity` / `filter`（合成层属性），不用 `top` / `left` / `width`
- [ ] 大列表避免 `box-shadow` 叠加过多（阴影是绘制开销大户）

**JS**
- [ ] DOM 查询集中在 `els` 对象，不在循环里 `getElementById`
- [ ] 高频事件用 `requestAnimationFrame` 合并
- [ ] 大数据用 TypedArray（`Uint8ClampedArray` / `Float32Array`）
- [ ] 图像数据只 `getImageData` 一次并缓存
- [ ] 重推理放 Worker

**资源**
- [ ] 图片用 `.webp`（本项目首页图标全部为 `.webp`）
- [ ] 大模型文件不内联 base64，走独立 URL 以便缓存
- [ ] 改动静态资源后更新 `?v=` 版本号

### 10.3 委托检查：静态导出一致性

新增页面后运行静态构建，确认无引用错误：

```powershell
python docs/build_static.py --base-path /CVClass
```

该脚本会执行：
- `collect_routes` —— 遍历 `app.url_map` 收集所有 GET 路由（`build_static.py:125-130`）
- `render_routes` —— 用 `app.test_client()` 逐条渲染
- `validate_html_refs` —— 校验 HTML 内所有本地引用存在
- `validate_no_secrets` —— 扫描泄漏的 API key（`build_static.py:30-33`）
- `validate_runtime_assets` —— 校验 ONNX/WASM 是否齐全
- `validate_static_contract` —— 校验静态契约

**校验不通过说明页面里有指向不存在文件的引用，必须修掉。**

---

## 11. 新增页面标准流程

以新增"某个视觉实验页"为例，完整步骤如下。

### Step 1 — 写路由

在 `page_routes.py` 的 `register_page_routes` 内新增（参考 `page_routes.py:382-384`）：

```python
@app.route("/my-experiment", methods=["GET"])
def my_experiment_page():
    return render_template(
        "my_module/my_experiment.html",
        active_page="my_module",
        active_sub_page="my_experiment",
        my_title="我的实验",
        my_nav=[
            {"key": "basic", "label": "基础演示",
             "href": url_for("my_experiment_basic_page"), "active": True},
        ],
    )
```

**注意**：`active_page` / `active_sub_page` 是骨架与 `base.js` 依赖的 key，**必须传**。

### Step 2 — 建模板

```jinja
{% extends "base.html" %}
{% block title %}我的实验{% endblock %}

{% block extra_css %}
<link rel="stylesheet" href="{{ url_for('static', filename='css/my_module/my_experiment.css') }}?v=20260914-init">
{% endblock %}

{% block content %}
<section id="myExperimentPage" class="my-page"
         data-my-mode="{{ active_sub_page }}"
         data-assets-base="{{ url_for('static', filename='assets/img/') }}">
    <header class="my-hero station-hero">
        <div>
            <span class="section-label">STATION 99 · MY MODULE</span>
            <h1>{{ my_title }}</h1>
            <p>一句话说明这个实验做什么。</p>
        </div>
        <strong class="station-badge">DEMO · METRIC</strong>
    </header>
    <nav class="my-tabs station-tabs" aria-label="我的实验内部导航">
        {% for item in my_nav|default([]) %}
        <a class="{{ 'is-active' if item.active else '' }}" href="{{ item.href }}">{{ item.label }}</a>
        {% endfor %}
    </nav>

    <div class="my-workbench">
        <aside class="my-panel" aria-label="控制面板"><!-- 滑块 / 下拉 --></aside>
        <div class="my-stage" aria-label="可视化舞台"><!-- canvas / svg --></div>
        <aside class="my-panel" aria-label="结果面板"><!-- 指标 / 说明 --></aside>
    </div>
</section>
{% endblock %}

{% block extra_js %}
<script src="{{ url_for('static', filename='js/my_module/my_experiment.js') }}?v=20260914-init"></script>
{% endblock %}
```

### Step 3 — 写样式（自建变量命名空间）

```css
/* static/css/my_module/my_experiment.css */
.my-page {
    --my-accent: #1d5cff;
    --my-soft: #f4f8ff;
    --my-border: #cfe0ff;
    --my-ink: #071536;
    --my-muted: #566982;
}

.my-workbench {
    display: grid;
    grid-template-columns: minmax(240px, 0.26fr) minmax(0, 1fr) minmax(260px, 0.3fr);
    gap: 18px;
    align-items: start;
}

.my-panel {
    border: 1px solid var(--my-border);
    border-radius: 12px;
    padding: 13px 16px 12px;
    background: linear-gradient(145deg, rgba(255,255,255,0.98) 0%, var(--my-soft) 100%);
    box-shadow: 0 10px 21px rgba(15, 23, 42, 0.065);   /* 透明度 ≤ 0.11 */
}

.my-stage {
    min-height: 420px;
    border: 1px solid var(--my-border);
    border-radius: 12px;
    overflow: hidden;
    background:
        linear-gradient(rgba(29, 92, 255, 0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(29, 92, 255, 0.045) 1px, transparent 1px),
        linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    background-size: 28px 28px, 28px 28px, auto;
}

@media (max-width: 1080px) {
    .my-workbench { grid-template-columns: 1fr; }
}
```

### Step 4 — 写脚本（IIFE 骨架）

```js
/* static/js/my_module/my_experiment.js */
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const els = { stage: $("myStage"), msg: $("myMessage"), msgTimer: null };
    const st  = { img: null, w: 0, h: 0 };
    let raf = 0;

    const root = document.getElementById("myExperimentPage");
    const assetsBase = root.dataset.assetsBase;   // 已含完整路径，勿再包 cvclassUrl

    function scheduleRender() {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; render(); });
    }
    function render() { /* ... */ }

    render();   /* 初始化 */
})();
```

### Step 5 — 登记与自检

1. 若引入模型：把 `.onnx` 路径加入 `docs/build_static.py` 的 `RUNTIME_ASSETS`。
2. 若引入新的 body 作用域类：在 `base.html:16` 的 class 表达式加条件。
3. 跑一次 `python docs/build_static.py --base-path /CVClass` 验证引用完整。
4. 打开页面，检查键盘 Tab 是否可达、缩放到 375px 是否正常。

### 新增页面检查表

- [ ] 路由已注册，`active_page` / `active_sub_page` 已传
- [ ] 模板 `{% extends %}` 已有骨架，未复制 base.html
- [ ] 所有 URL 用 `url_for()`，所有 JS 路径用 `cvclassUrl()`
- [ ] CSS/JS 带 `?v=` 版本号
- [ ] CSS 自建变量命名空间，无散落 hex
- [ ] 布局用 Grid + `minmax(0, 1fr)`，无固定宽导致溢出
- [ ] 卡片 `grid-template-rows` 含 `1fr`，文字有行数截断
- [ ] 阴影透明度 ≤ 0.11
- [ ] `transition` 未用 `all`
- [ ] `:focus-visible` 已定义
- [ ] 新循环动画已加入 `prefers-reduced-motion` 降级块
- [ ] 5 级断点已覆盖（1280/1080/900/760/560）
- [ ] 脚本为 IIFE + `"use strict"`
- [ ] 静态构建校验通过

---

## 12. Code Review 检查清单

### 模板

- [ ] 未直接修改 `docs/` 目录
- [ ] 未硬编码 URL（全部 `url_for`）
- [ ] 注入 JS 的字符串走 `|tojson`
- [ ] 模板变量有 `|default()` 兜底
- [ ] `nav` 有 `aria-label`，装饰元素有 `aria-hidden`
- [ ] 无内联 `style="..."`（除动态计算的 CSS 变量）

### CSS

- [ ] 新样式在正确的模块目录（`css/<module>/`）而非全塞 `base.css`
- [ ] 选择器有页面作用域前缀或模块名前缀，无全局裸标签选择器
- [ ] 变量集中在文件顶部声明
- [ ] 使用 `color-mix()` 而不是为每个状态手写色值
- [ ] 无 `!important`（除非覆写第三方库且加注释说明）
- [ ] 无 `transition: all`
- [ ] 阴影透明度 ≤ 0.11
- [ ] 交互态覆盖 `:hover` / `:focus-visible` / `.is-active` 三态
- [ ] 动画只用 `transform` / `opacity` / `filter`
- [ ] 循环动画已登记到 `prefers-reduced-motion` 降级

### JavaScript

- [ ] IIFE 包裹 + `"use strict"`
- [ ] 路径用 `cvclassUrl()`
- [ ] DOM 查询集中在 `els`，状态集中在 `st`
- [ ] 无全局变量泄漏（写 `window.x = ...` 需有充分理由）
- [ ] `localStorage` 读写有 `try/catch`
- [ ] `fetch` 处理了 `!resp.ok`
- [ ] 无 `alert()` / 调试用 `console.log` 残留
- [ ] 高频事件用 `requestAnimationFrame` 合并
- [ ] 事件监听无内存泄漏（必要时用 `AbortController` 或 `removeEventListener`）

### 一致性

- [ ] 状态类用 `is-*`
- [ ] 修饰符用 `--`
- [ ] 卡片/按钮/徽章复用既有类（`module-card` / `home-primary-button` / `module-status`），未另造一套
- [ ] 间距、圆角、字号取自附录 A 的数值表
- [ ] 中文字体回退链完整

---

## 13. 反面清单（Don't）

| # | 禁止写法 | 正确做法 | 原因 |
|---|---|---|---|
| 1 | `transition: all 0.3s` | 列具体属性 | 触发布局回流，掉帧 |
| 2 | `box-shadow: 0 2px 8px rgba(0,0,0,0.3)` | 透明度 ≤ 0.11，配主题色 | 显脏、显廉价 |
| 3 | `grid-template-columns: 1fr 1fr` | `repeat(2, minmax(0, 1fr))` | `1fr` 会被长内容撑破 |
| 4 | `/static/js/a.js`（JS 内硬编码） | `cvclassUrl("/static/js/a.js")` | 子路径部署 404 |
| 5 | `href="/edge-detection"`（模板内硬编码） | `url_for('edge_detection_page')` | 路由改名即全站失效 |
| 6 | `window.X = "{{ ap }}"` | `{{ ap|tojson }}` | 含引号时脚本崩 |
| 7 | 引入 iconfont / Font Awesome | 纯 CSS 伪元素图标 | 多一次请求 + FOUC |
| 8 | 引入 jQuery / Lodash / Tailwind | 原生 API + 自建变量 | 违背无构建约束 |
| 9 | 为 4 个状态手写 4 组颜色 | `color-mix()` 从主色派生 | 改色要改 N 处 |
| 10 | 每个页面复制一份 header/sidebar | `{% extends %}` + block | 维护成本爆炸 |
| 11 | `<div class="btn" onclick="go()">` | `<a href="{{ url_for(...) }}">` | 键盘不可达、无链接预览 |
| 12 | `outline: none` 去掉焦点框 | `:focus-visible` + 柔和 outline | 键盘用户无法定位 |
| 13 | `height: 49px` 定高按钮 | `min-height: 49px` | 文案换行会截断 |
| 14 | 循环动画不写降级 | 加 `prefers-reduced-motion` 块 | 前庭障碍用户不适 |
| 15 | 循环里 `ctx.getImageData(...)` | 缓存一次 `st.pix` | 每帧复制整张图，卡死 |
| 16 | 直接改 `docs/` 下的产物 | 改 `templates/` / `static/` 源码 | 下次构建被覆盖 |
| 17 | 改了 CSS 不更新 `?v=` | 同步更新版本号 | 用户命中旧缓存 |
| 18 | 新增模型不登记 `RUNTIME_ASSETS` | 加入清单 | 静态导出漏文件 |
| 19 | `font-family: Inter`（不含中文回退） | `Inter, ..., "Microsoft YaHei", sans-serif` | 中文退到系统字体 |
| 20 | 用 `aspect-ratio` 硬撑容器高度 | `min-height` | 与既有布局约定不一致 |

---

## 附录 A：常用数值速查

```text
/* 布局 */
--sidebar-width: 240px;
--lab-shell-max: 1760px;
--lab-shell-gutter: 24px;

/* 断点（max-width, px） */
1280 / 1080 / 900 / 760 / 560

/* 圆角 */
8 / 9 / 10 / 11 / 12 px   → 控件、卡片
18 / 20 / 22 px           → 面板、弹窗

/* 阴影（透明度一律 ≤ 0.11） */
0  8px 18px rgba(15, 23, 42, 0.045)   → 次要卡片
0 10px 21px rgba(15, 23, 42, 0.065)   → 主卡片
0 14px 28px rgba(37, 99, 235, 0.11)   → 卡片悬浮（带主题色）
0 18px 46px rgba(15, 23, 42, 0.08)    → 大面板
0  8px 24px rgba(15, 23, 42, 0.04)    → 固定导航

/* 过渡时长 */
0.18s ease  → hover / 按钮
0.22s ease  → 侧栏折叠 / 遮罩
0.28s~0.42s → 形态变化

/* 字号 */
clamp(36px, 5.8vw, 60px)  → Hero H1
clamp(30px, 4vw, 48px)    → 页面标题
16 ~ 17px                 → 卡片标题
13 ~ 16px                 → 正文
11 ~ 12px                 → 徽章 / 标签

/* 字重 */
950 / 900 → 标题、标签
850       → 次级强调
650       → 正文

/* 纯 CSS 图标配方 */
radial-gradient(circle at X% Y%, 色 0 3.8px, transparent 4.3px)       → 画点
linear-gradient(Ndeg, transparent 48%, 色 49% 51%, transparent 52%)   → 画线
repeating-linear-gradient(0deg, 色 0 1px, transparent 1px 50px)       → 画网格

/* color-mix 混色比例 */
9%   → 极浅背景（tag / pill）
16~18% → 装饰环 / 光晕
18~22% → 悬浮阴影
88%  → 徽章渐变起点
```

---

## 附录 B：关键参考文件索引

| 文件 | 说明 |
|---|---|
| `templates/base.html` | 全局骨架、导航、注入变量、脚本挂载点 |
| `templates/vision_tasks_base.html` | 二级骨架 + 条件资源加载范例 |
| `templates/feature_base.html` | 宏（macro）复用范例 |
| `templates/pages/home.html` | 首页信息架构（Hero / 学习域 / 精选模块） |
| `static/css/core/base.css` | 设计令牌、布局、卡片、纯 CSS 图标族 |
| `static/css/core/style.css` | 渐变文字、毛玻璃面板 |
| `static/js/core/base.js` | `cvclassUrl`、侧栏折叠、学习进度 |
| `static/js/pages/pixel_zoom.js` | IIFE + `els`/`st` + TypedArray 范例 |
| `static/css/edge/edge_detection.css` | 算法过程动画（`@keyframes` 集中区） |
| `docs/build_static.py` | 静态导出与校验、`RUNTIME_ASSETS` |
| `page_routes.py` | 页面路由与上下文构造 |
| `app.py` | Flask 入口、后端 API、延迟导入约定 |

---

*文档基于仓库当前代码整理，若规范演进请同步更新本文件。*
