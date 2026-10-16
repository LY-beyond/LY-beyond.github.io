// =========================================================
// graph-data.js —— 《可视化导论》课程知识图谱数据（中文）
// ---------------------------------------------------------
// 这份数据是【从站点自身抽出来的】，不是另写的一套文案：
//   · 章节 / 小节标题与锚点  ← 各章 <article> 的 h2 与目录 data-chapter
//   · 关键点                ← 各小节 theory-card / key-point 的标题
//   · 案例 / 数据集          ← 各章 data/ 目录里真实存在的文件与演示案例
//   · 「用于」边            ← 数据集 / 案例真正被哪一小节使用
//   · 「先修」边            ← 人工确认过的跨小节 / 跨章依赖
// 所以图谱不可能和正文脱节；改完页面跑 node graph-check.mjs 复核即可。
//
// 「完整图谱」视图由 graph.js 运行时合并下面 6 个视图得到，此处不重复存一份。
//
// 结构契约：{ categories, relations, defaultView, views }
//   categories: [{id, name}]
//   relations:  [{id, name, style}]
//   views.<id>: { title, nodes:[{id,name,cat,route?,drillTo?}], links:[{from,to,rel}] }
//   · cat 必须来自 categories；rel 必须来自 relations
//   · from / to 必须是同一视图内存在的节点 id（不允许悬空边、不允许重复边）
//   · route 指向 vis4 里真实存在的页面 + 锚点；drillTo 指向真实视图 id
//
// 刻意用「普通 script」而非 ES Module：file:// 双击打开也能用（同 progress.js）。
// =========================================================
window.KG_DATA = {
  "lang": "zh",
  "defaultView": "overview",
  "categories": [
    { "id": "part",    "name": "课程模块" },
    { "id": "chapter", "name": "章节" },
    { "id": "section", "name": "小节" },
    { "id": "key",     "name": "关键点" },
    { "id": "case",    "name": "案例" },
    { "id": "dataset", "name": "数据集" },
    { "id": "tool",    "name": "学习工具" }
  ],
  "relations": [
    { "id": "part-of", "name": "包含",  "style": "solid"  },
    { "id": "prereq",  "name": "先修",  "style": "dashed" },
    { "id": "used-in", "name": "用于",  "style": "dotted" }
  ],
  "views": {
    "overview": {
      "title": "课程总览",
      "nodes": [
        { "id": "course",   "name": "《可视化导论》",        "cat": "part",    "route": "./" },
        { "id": "c1",       "name": "第 1 章 数据",          "cat": "chapter", "route": "lesson-01/", "drillTo": "data" },
        { "id": "c2",       "name": "第 2 章 数据可视化流程", "cat": "chapter", "route": "lesson-02/", "drillTo": "flow" },
        { "id": "c3",       "name": "第 3 章 色彩专题",       "cat": "chapter", "route": "lesson-03/", "drillTo": "color" },
        { "id": "c4",       "name": "第 4 章 低维数据可视化", "cat": "chapter", "route": "lesson-04/", "drillTo": "lowdim" },
        { "id": "c5",       "name": "第 5 章 时序数据可视化", "cat": "chapter", "route": "lesson-05/", "drillTo": "temporal" },
        { "id": "guide",    "name": "专题 · 选图指南",        "cat": "tool",    "route": "topic-chart-guide/" },
        { "id": "quiz",     "name": "章节测验（44 题）",      "cat": "tool",    "route": "quiz.html" },
        { "id": "practice", "name": "D3 实战工作台",         "cat": "tool",    "route": "practice.html" },
        { "id": "ds-hub",   "name": "随站数据集（6 份）",      "cat": "dataset", "route": "./#about" }
      ],
      "links": [
        { "from": "course", "to": "c1",       "rel": "part-of" },
        { "from": "course", "to": "c2",       "rel": "part-of" },
        { "from": "course", "to": "c3",       "rel": "part-of" },
        { "from": "course", "to": "c4",       "rel": "part-of" },
        { "from": "course", "to": "c5",       "rel": "part-of" },
        { "from": "course", "to": "guide",    "rel": "part-of" },
        { "from": "course", "to": "quiz",     "rel": "part-of" },
        { "from": "course", "to": "practice", "rel": "part-of" },
        { "from": "course", "to": "ds-hub",   "rel": "part-of" },
        { "from": "c1", "to": "c2", "rel": "prereq" },
        { "from": "c2", "to": "c3", "rel": "prereq" },
        { "from": "c3", "to": "c4", "rel": "prereq" },
        { "from": "c4", "to": "c5", "rel": "prereq" },
        { "from": "c1", "to": "guide", "rel": "used-in" },
        { "from": "c3", "to": "guide", "rel": "used-in" },
        { "from": "c5", "to": "guide", "rel": "used-in" },
        { "from": "c1", "to": "quiz",  "rel": "used-in" },
        { "from": "c4", "to": "quiz",  "rel": "used-in" },
        { "from": "c2", "to": "practice", "rel": "used-in" },
        { "from": "ds-hub", "to": "c1", "rel": "used-in" },
        { "from": "ds-hub", "to": "c4", "rel": "used-in" },
        { "from": "ds-hub", "to": "c5", "rel": "used-in" }
      ]
    },

    "data": {
      "title": "第 1 章 · 数据",
      "nodes": [
        { "id": "c1",           "name": "第 1 章 数据",            "cat": "chapter", "route": "lesson-01/" },
        { "id": "s11",          "name": "1.1 数据生成",            "cat": "section", "route": "lesson-01/#ch-1-1" },
        { "id": "s12",          "name": "1.2 数据定义（DIKW）",     "cat": "section", "route": "lesson-01/#ch-1-2" },
        { "id": "s13",          "name": "1.3 数据属性（测量尺度）",  "cat": "section", "route": "lesson-01/#ch-1-3" },
        { "id": "s14",          "name": "1.4 数据变换",            "cat": "section", "route": "lesson-01/#ch-1-4" },
        { "id": "s15",          "name": "1.5 D3 数据选择器",        "cat": "section", "route": "lesson-01/#ch-1-5" },
        { "id": "k-clean",      "name": "类型清洗（trim / +）",      "cat": "key",     "route": "lesson-01/#ch-1-1" },
        { "id": "k-dikw",       "name": "DIKW 金字塔",             "cat": "key",     "route": "lesson-01/#ch-1-2" },
        { "id": "k-stevens",    "name": "Stevens 4 测量尺度",       "cat": "key",     "route": "lesson-01/#ch-1-3" },
        { "id": "k-mackinlay",  "name": "Mackinlay 视觉通道排序",    "cat": "key",     "route": "lesson-01/#ch-1-3" },
        { "id": "k-scale",      "name": "比例尺选型 Linear / Band",  "cat": "key",     "route": "lesson-01/#ch-1-3" },
        { "id": "k-array8",     "name": "D3 8 个数组函数",          "cat": "key",     "route": "lesson-01/#ch-1-4" },
        { "id": "k-join",       "name": "Data-Join 三态",           "cat": "key",     "route": "lesson-01/#ch-1-5" },
        { "id": "k-keyfn",      "name": "key 函数与过渡动画",        "cat": "key",     "route": "lesson-01/#ch-1-5" },
        { "id": "ds-newstudent","name": "新生名册 newstudent.csv",   "cat": "dataset", "route": "lesson-01/#ch-1-1" }
      ],
      "links": [
        { "from": "c1", "to": "s11", "rel": "part-of" },
        { "from": "c1", "to": "s12", "rel": "part-of" },
        { "from": "c1", "to": "s13", "rel": "part-of" },
        { "from": "c1", "to": "s14", "rel": "part-of" },
        { "from": "c1", "to": "s15", "rel": "part-of" },
        { "from": "s11", "to": "k-clean",     "rel": "part-of" },
        { "from": "s12", "to": "k-dikw",      "rel": "part-of" },
        { "from": "s13", "to": "k-stevens",   "rel": "part-of" },
        { "from": "s13", "to": "k-mackinlay", "rel": "part-of" },
        { "from": "s13", "to": "k-scale",     "rel": "part-of" },
        { "from": "s14", "to": "k-array8",    "rel": "part-of" },
        { "from": "s15", "to": "k-join",      "rel": "part-of" },
        { "from": "s15", "to": "k-keyfn",     "rel": "part-of" },
        { "from": "k-stevens",   "to": "k-mackinlay", "rel": "prereq" },
        { "from": "k-mackinlay", "to": "k-scale",     "rel": "prereq" },
        { "from": "k-join",      "to": "k-keyfn",     "rel": "prereq" },
        { "from": "ds-newstudent", "to": "s11", "rel": "used-in" },
        { "from": "ds-newstudent", "to": "s14", "rel": "used-in" },
        { "from": "ds-newstudent", "to": "s15", "rel": "used-in" }
      ]
    },

    "flow": {
      "title": "第 2 章 · 数据可视化流程",
      "nodes": [
        { "id": "c2",          "name": "第 2 章 数据可视化流程",     "cat": "chapter", "route": "lesson-02/" },
        { "id": "s21",         "name": "2.1 数据可视化流程",        "cat": "section", "route": "lesson-02/#ch-2-1" },
        { "id": "s22",         "name": "2.2 数据变换：原数据→数据表", "cat": "section", "route": "lesson-02/#ch-2-2" },
        { "id": "s23",         "name": "2.3 视觉映射：数据表→视觉结构","cat": "section", "route": "lesson-02/#ch-2-3" },
        { "id": "s24",         "name": "2.4 视图渲染与用户交互",      "cat": "section", "route": "lesson-02/#ch-2-4" },
        { "id": "k-card",      "name": "Card 数据流模型（1999）",     "cat": "key",     "route": "lesson-02/#ch-2-1" },
        { "id": "k-feedback",  "name": "van Wijk 反馈模型（2005）",   "cat": "key",     "route": "lesson-02/#ch-2-1" },
        { "id": "k-rollup",    "name": "d3.rollup 分组聚合",         "cat": "key",     "route": "lesson-02/#ch-2-2" },
        { "id": "k-olap",      "name": "OLAP 切片 / 钻取",           "cat": "key",     "route": "lesson-02/#ch-2-2" },
        { "id": "k-reingold",  "name": "Reingold–Tilford 树布局",     "cat": "key",     "route": "lesson-02/#ch-2-3" },
        { "id": "k-hierarchy", "name": "d3-hierarchy 全家桶",        "cat": "key",     "route": "lesson-02/#ch-2-3" },
        { "id": "k-event",     "name": "DOM 事件三阶段 / 委托",       "cat": "key",     "route": "lesson-02/#ch-2-4" },
        { "id": "k-anim",      "name": "动画：渲染的时间维",          "cat": "key",     "route": "lesson-02/#ch-2-4" },
        { "id": "ds-newstudent","name": "新生名册 newstudent.csv",   "cat": "dataset", "route": "lesson-02/#ch-2-1" },
        { "id": "case-tree",   "name": "分类树 → 树形列表",          "cat": "case",    "route": "lesson-02/#ch-2-3" }
      ],
      "links": [
        { "from": "c2", "to": "s21", "rel": "part-of" },
        { "from": "c2", "to": "s22", "rel": "part-of" },
        { "from": "c2", "to": "s23", "rel": "part-of" },
        { "from": "c2", "to": "s24", "rel": "part-of" },
        { "from": "s21", "to": "k-card",     "rel": "part-of" },
        { "from": "s21", "to": "k-feedback", "rel": "part-of" },
        { "from": "s22", "to": "k-rollup",   "rel": "part-of" },
        { "from": "s22", "to": "k-olap",     "rel": "part-of" },
        { "from": "s23", "to": "k-reingold", "rel": "part-of" },
        { "from": "s23", "to": "k-hierarchy","rel": "part-of" },
        { "from": "s24", "to": "k-event",    "rel": "part-of" },
        { "from": "s24", "to": "k-anim",     "rel": "part-of" },
        { "from": "k-card",     "to": "k-feedback",  "rel": "prereq" },
        { "from": "k-olap",     "to": "k-rollup",    "rel": "prereq" },
        { "from": "k-reingold", "to": "k-hierarchy", "rel": "prereq" },
        { "from": "ds-newstudent", "to": "s21", "rel": "used-in" },
        { "from": "ds-newstudent", "to": "s22", "rel": "used-in" },
        { "from": "case-tree",     "to": "k-reingold", "rel": "used-in" },
        { "from": "case-tree",     "to": "k-hierarchy","rel": "used-in" }
      ]
    },

    "color": {
      "title": "第 3 章 · 色彩专题",
      "nodes": [
        { "id": "c3",          "name": "第 3 章 色彩专题",         "cat": "chapter", "route": "lesson-03/" },
        { "id": "s31",         "name": "3.1 颜色模型基础",         "cat": "section", "route": "lesson-03/#ch-3-1" },
        { "id": "s32",         "name": "3.2 colormap 三类选择",     "cat": "section", "route": "lesson-03/#ch-3-2" },
        { "id": "s33",         "name": "3.3 CIE Lab 色域图",        "cat": "section", "route": "lesson-03/#ch-3-3" },
        { "id": "s34",         "name": "3.4 色系搭配规则（5 类）",   "cat": "section", "route": "lesson-03/#ch-3-4" },
        { "id": "s35",         "name": "3.5 科研经典配色",         "cat": "section", "route": "lesson-03/#ch-3-5" },
        { "id": "s36",         "name": "3.6 对错案例对比",         "cat": "section", "route": "lesson-03/#ch-3-6" },
        { "id": "s37",         "name": "3.7 鲜艳 + 低饱和生成器",   "cat": "section", "route": "lesson-03/#ch-3-7" },
        { "id": "s38",         "name": "3.8 CVD 论文图测",          "cat": "section", "route": "lesson-03/#ch-3-8" },
        { "id": "k-space",     "name": "四种颜色空间",             "cat": "key",     "route": "lesson-03/#ch-3-1" },
        { "id": "k-cmap",      "name": "顺序 / 发散 / 定性 colormap","cat": "key",     "route": "lesson-03/#ch-3-2" },
        { "id": "k-lab",       "name": "CIE Lab 感知均匀",          "cat": "key",     "route": "lesson-03/#ch-3-3" },
        { "id": "k-hardspec",  "name": "顶刊选配色三条硬指标",       "cat": "key",     "route": "lesson-03/#ch-3-5" },
        { "id": "k-tol",       "name": "Wong & Paul Tol 色板",      "cat": "key",     "route": "lesson-03/#ch-3-5" },
        { "id": "k-cvd",       "name": "三类 CVD 与双编码",          "cat": "key",     "route": "lesson-03/#ch-3-8" },
        { "id": "tool-gen",    "name": "配色生成器",               "cat": "tool",    "route": "lesson-03/#ch-3-7" },
        { "id": "case-rainbow","name": "彩虹色阶误用对照",          "cat": "case",    "route": "lesson-03/#ch-3-6" }
      ],
      "links": [
        { "from": "c3", "to": "s31", "rel": "part-of" },
        { "from": "c3", "to": "s32", "rel": "part-of" },
        { "from": "c3", "to": "s33", "rel": "part-of" },
        { "from": "c3", "to": "s34", "rel": "part-of" },
        { "from": "c3", "to": "s35", "rel": "part-of" },
        { "from": "c3", "to": "s36", "rel": "part-of" },
        { "from": "c3", "to": "s37", "rel": "part-of" },
        { "from": "c3", "to": "s38", "rel": "part-of" },
        { "from": "s31", "to": "k-space",    "rel": "part-of" },
        { "from": "s32", "to": "k-cmap",     "rel": "part-of" },
        { "from": "s33", "to": "k-lab",      "rel": "part-of" },
        { "from": "s35", "to": "k-hardspec", "rel": "part-of" },
        { "from": "s35", "to": "k-tol",      "rel": "part-of" },
        { "from": "s38", "to": "k-cvd",      "rel": "part-of" },
        { "from": "s37", "to": "tool-gen",   "rel": "part-of" },
        { "from": "s36", "to": "case-rainbow","rel": "part-of" },
        { "from": "k-space",    "to": "k-cmap", "rel": "prereq" },
        { "from": "k-cmap",     "to": "k-lab",  "rel": "prereq" },
        { "from": "k-hardspec", "to": "k-tol",  "rel": "prereq" },
        { "from": "k-cmap",     "to": "k-cvd",  "rel": "prereq" },
        { "from": "tool-gen",     "to": "k-tol",  "rel": "used-in" },
        { "from": "case-rainbow", "to": "k-cmap", "rel": "used-in" },
        { "from": "k-tol",        "to": "k-cvd",  "rel": "used-in" }
      ]
    },

    "lowdim": {
      "title": "第 4 章 · 低维数据可视化",
      "nodes": [
        { "id": "c4",          "name": "第 4 章 低维数据可视化",      "cat": "chapter", "route": "lesson-04/" },
        { "id": "s41",         "name": "4.1 数据转换",              "cat": "section", "route": "lesson-04/#ch-4-1" },
        { "id": "s42",         "name": "4.2 坐标轴变换",            "cat": "section", "route": "lesson-04/#ch-4-2" },
        { "id": "s43",         "name": "4.3 曲线拟合",              "cat": "section", "route": "lesson-04/#ch-4-3" },
        { "id": "s44",         "name": "4.4 倾角感知（45° 黄金角）",  "cat": "section", "route": "lesson-04/#ch-4-4" },
        { "id": "s45",         "name": "4.5 等值线（Marching Squares）","cat": "section", "route": "lesson-04/#ch-4-5" },
        { "id": "k-wide",      "name": "宽格式 / 长格式",            "cat": "key",     "route": "lesson-04/#ch-4-1" },
        { "id": "k-layer",     "name": "三层坐标变换",              "cat": "key",     "route": "lesson-04/#ch-4-2" },
        { "id": "k-fit",       "name": "插值 vs 拟合",               "cat": "key",     "route": "lesson-04/#ch-4-3" },
        { "id": "k-cleveland", "name": "Cleveland 45° 倾角实验",     "cat": "key",     "route": "lesson-04/#ch-4-4" },
        { "id": "k-marching",  "name": "Marching Squares 原理",     "cat": "key",     "route": "lesson-04/#ch-4-5" },
        { "id": "ds-crime",    "name": "crime.csv（50 州 × 12 列）", "cat": "dataset", "route": "lesson-04/#ch-4-1" },
        { "id": "ds-terrain",  "name": "terrain10.csv（10×10 网格）","cat": "dataset", "route": "lesson-04/#ch-4-5" }
      ],
      "links": [
        { "from": "c4", "to": "s41", "rel": "part-of" },
        { "from": "c4", "to": "s42", "rel": "part-of" },
        { "from": "c4", "to": "s43", "rel": "part-of" },
        { "from": "c4", "to": "s44", "rel": "part-of" },
        { "from": "c4", "to": "s45", "rel": "part-of" },
        { "from": "s41", "to": "k-wide",      "rel": "part-of" },
        { "from": "s42", "to": "k-layer",     "rel": "part-of" },
        { "from": "s43", "to": "k-fit",       "rel": "part-of" },
        { "from": "s44", "to": "k-cleveland", "rel": "part-of" },
        { "from": "s45", "to": "k-marching",  "rel": "part-of" },
        { "from": "k-layer", "to": "k-fit",       "rel": "prereq" },
        { "from": "k-layer", "to": "k-cleveland", "rel": "prereq" },
        { "from": "k-fit",   "to": "k-cleveland", "rel": "prereq" },
        { "from": "ds-crime",   "to": "s41", "rel": "used-in" },
        { "from": "ds-crime",   "to": "s42", "rel": "used-in" },
        { "from": "ds-crime",   "to": "s43", "rel": "used-in" },
        { "from": "ds-crime",   "to": "s44", "rel": "used-in" },
        { "from": "ds-terrain", "to": "s45", "rel": "used-in" }
      ]
    },

    "temporal": {
      "title": "第 5 章 · 时序数据可视化",
      "nodes": [
        { "id": "c5",          "name": "第 5 章 时序数据可视化",       "cat": "chapter", "route": "lesson-05/" },
        { "id": "s51",         "name": "5.1 时间属性",               "cat": "section", "route": "lesson-05/#ch-5-1" },
        { "id": "s52",         "name": "5.2 标准时间可视化（折线图）",  "cat": "section", "route": "lesson-05/#ch-5-2" },
        { "id": "s53",         "name": "5.3 日历热图（van Wijk）",     "cat": "section", "route": "lesson-05/#ch-5-3" },
        { "id": "s54",         "name": "5.4 周期时间（阿基米德螺旋）",  "cat": "section", "route": "lesson-05/#ch-5-4" },
        { "id": "s55",         "name": "5.5 Storyline 时间线",         "cat": "section", "route": "lesson-05/#ch-5-5" },
        { "id": "k-timeattr",  "name": "时间的 5 个属性",             "cat": "key",     "route": "lesson-05/#ch-5-1" },
        { "id": "k-line",      "name": "标准时序图 = 二维线图",        "cat": "key",     "route": "lesson-05/#ch-5-2" },
        { "id": "k-vanwijk",   "name": "van Wijk 日历坐标约定（2008）", "cat": "key",     "route": "lesson-05/#ch-5-3" },
        { "id": "k-spiral",    "name": "螺旋 vs 折线：两种时间域",      "cat": "key",     "route": "lesson-05/#ch-5-4" },
        { "id": "k-story",     "name": "生命线叙事分解",              "cat": "key",     "route": "lesson-05/#ch-5-5" },
        { "id": "ds-weather",  "name": "weather_2024.csv（366 天）",  "cat": "dataset", "route": "lesson-05/#ch-5-3" },
        { "id": "ds-names",    "name": "french_names.json（长表）",    "cat": "dataset", "route": "lesson-05/#ch-5-2" },
        { "id": "case-jurassic","name": "《侏罗纪公园》故事线",        "cat": "case",    "route": "lesson-05/#ch-5-5" }
      ],
      "links": [
        { "from": "c5", "to": "s51", "rel": "part-of" },
        { "from": "c5", "to": "s52", "rel": "part-of" },
        { "from": "c5", "to": "s53", "rel": "part-of" },
        { "from": "c5", "to": "s54", "rel": "part-of" },
        { "from": "c5", "to": "s55", "rel": "part-of" },
        { "from": "s51", "to": "k-timeattr", "rel": "part-of" },
        { "from": "s52", "to": "k-line",     "rel": "part-of" },
        { "from": "s53", "to": "k-vanwijk",  "rel": "part-of" },
        { "from": "s54", "to": "k-spiral",   "rel": "part-of" },
        { "from": "s55", "to": "k-story",    "rel": "part-of" },
        { "from": "k-timeattr", "to": "k-line",    "rel": "prereq" },
        { "from": "k-line",     "to": "k-vanwijk", "rel": "prereq" },
        { "from": "k-vanwijk",  "to": "k-spiral",  "rel": "prereq" },
        { "from": "k-spiral",   "to": "k-story",   "rel": "prereq" },
        { "from": "ds-weather", "to": "k-line",     "rel": "used-in" },
        { "from": "ds-weather", "to": "k-vanwijk",  "rel": "used-in" },
        { "from": "ds-weather", "to": "k-spiral",   "rel": "used-in" },
        { "from": "ds-names",   "to": "k-line",     "rel": "used-in" },
        { "from": "ds-names",   "to": "k-story",    "rel": "used-in" },
        { "from": "case-jurassic", "to": "k-story","rel": "used-in" }
      ]
    }
  }
};
