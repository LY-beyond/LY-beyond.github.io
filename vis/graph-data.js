// =========================================================
// graph-data.js —— 课程知识图谱数据（中文 / English in en/graph-data.js）
// ---------------------------------------------------------
// 这份数据是【从站点自身抽出来的】，不是另写的一套文案：
//   · 章节标题 / 描述  ← 门户卡片墙
//   · 小节标题 / 描述  ← 各章 <article> 的 h2 + 讲解面板首句
//   · 「用于案例」边    ← 各章 case-note 里指向 lesson-09 / practice 的真实链接
//   · 「前置知识」边    ← 人工确认过的 6 条跨章依赖
// 所以图谱不可能和正文脱节；改完页面跑 node graph-check.mjs 复核。
//
// 「完整图谱」视图由 graph.js 运行时合并 root + 各章视图得到，此处不重复存一份。
//
// 刻意用「普通 script」而非 ES Module：file:// 双击打开也能用（同 quiz-data.js）。
// =========================================================
window.KG_DATA = {
  "lang": "zh",
  "defaultView": "root",
  "categories": [
    {
      "id": "part",
      "label": "篇章",
      "color": "c-primary"
    },
    {
      "id": "chapter",
      "label": "章节",
      "color": "c-info"
    },
    {
      "id": "section",
      "label": "知识点",
      "color": "c-accent"
    },
    {
      "id": "step",
      "label": "案例步骤",
      "color": "c-primary"
    },
    {
      "id": "lab",
      "label": "实战环节",
      "color": "c-accent"
    }
  ],
  "relations": [
    {
      "id": "part-of",
      "label": "包含",
      "style": "solid"
    },
    {
      "id": "prereq",
      "label": "前置知识",
      "style": "dashed"
    },
    {
      "id": "used-in",
      "label": "用于案例",
      "style": "dotted"
    }
  ],
  "views": {
    "root": {
      "title": "课程总览",
      "path": [
        "课程知识图谱"
      ],
      "nodes": [
        {
          "id": "p-design",
          "name": "设计篇（1–4 章）",
          "cat": "part",
          "desc": "回答\"怎么设计\"：从原则到骨架、栅格与布局模式。"
        },
        {
          "id": "p-impl",
          "name": "实现篇（5–8 章）",
          "cat": "part",
          "desc": "回答\"怎么写代码\"：盒模型、Flexbox、Grid、定位与响应式。"
        },
        {
          "id": "p-case",
          "name": "实战篇（9 章）",
          "cat": "part",
          "desc": "用一个完整的作品集网站案例，把前两部分从头串一遍。"
        },
        {
          "id": "c1",
          "name": "布局设计的基本原则",
          "cat": "chapter",
          "desc": "对齐、亲密性、重复、对比、格式塔与视觉平衡——先搞清\"什么算好的布局\"。",
          "route": "lesson-01/",
          "drillTo": "v-1"
        },
        {
          "id": "c2",
          "name": "从需求到页面骨架",
          "cat": "chapter",
          "desc": "动手画之前先想清楚：内容优先级、阅读模式、以及用线框图定下结构。",
          "route": "lesson-02/",
          "drillTo": "v-2"
        },
        {
          "id": "c3",
          "name": "栅格系统与间距节奏",
          "cat": "chapter",
          "desc": "为什么专业页面\"对得很齐\"？12 列栅格 + 8pt 间距体系给出答案。",
          "route": "lesson-03/",
          "drillTo": "v-3"
        },
        {
          "id": "c4",
          "name": "布局模式选型",
          "cat": "chapter",
          "desc": "单栏、多栏、卡片墙、仪表盘——什么场景该用哪种布局，一次讲清。",
          "route": "lesson-04/",
          "drillTo": "v-4"
        },
        {
          "id": "c5",
          "name": "盒模型与文档流",
          "cat": "chapter",
          "desc": "实现篇的地基：元素占多少空间、默认怎么排列、display 如何决定角色。",
          "route": "lesson-05/",
          "drillTo": "v-5"
        },
        {
          "id": "c6",
          "name": "Flexbox 弹性布局",
          "cat": "chapter",
          "desc": "一维弹性盒子：对齐、分布与按比例分配剩余空间。",
          "route": "lesson-06/",
          "drillTo": "v-6"
        },
        {
          "id": "c7",
          "name": "Grid 网格布局",
          "cat": "chapter",
          "desc": "二维网格系统：行列同时掌控，是页面骨架与卡片墙的利器。",
          "route": "lesson-07/",
          "drillTo": "v-7"
        },
        {
          "id": "c8",
          "name": "定位、层叠与响应式",
          "cat": "chapter",
          "desc": "让元素脱离文档流、控制层叠顺序，并让一份代码适配手机到大屏。",
          "route": "lesson-08/",
          "drillTo": "v-8"
        },
        {
          "id": "c9",
          "name": "综合案例：作品集网站",
          "cat": "chapter",
          "desc": "从需求到响应式，8 步完整做出一个个人作品集网站，理论与技术全程落地。",
          "route": "lesson-09/",
          "drillTo": "v-9"
        }
      ],
      "links": [
        {
          "from": "p-design",
          "to": "c1",
          "rel": "part-of"
        },
        {
          "from": "p-design",
          "to": "c2",
          "rel": "part-of"
        },
        {
          "from": "p-design",
          "to": "c3",
          "rel": "part-of"
        },
        {
          "from": "p-design",
          "to": "c4",
          "rel": "part-of"
        },
        {
          "from": "p-impl",
          "to": "c5",
          "rel": "part-of"
        },
        {
          "from": "p-impl",
          "to": "c6",
          "rel": "part-of"
        },
        {
          "from": "p-impl",
          "to": "c7",
          "rel": "part-of"
        },
        {
          "from": "p-impl",
          "to": "c8",
          "rel": "part-of"
        },
        {
          "from": "p-case",
          "to": "c9",
          "rel": "part-of"
        },
        {
          "from": "c1",
          "to": "c3",
          "rel": "prereq",
          "note": "栅格是对齐与间距的系统化"
        },
        {
          "from": "c3",
          "to": "c4",
          "rel": "prereq",
          "note": "选布局模式要基于栅格"
        },
        {
          "from": "c5",
          "to": "c6",
          "rel": "prereq",
          "note": "先懂盒模型再学 Flex"
        },
        {
          "from": "c6",
          "to": "c7",
          "rel": "prereq",
          "note": "先 Flex 后 Grid"
        },
        {
          "from": "c7",
          "to": "c8",
          "rel": "prereq",
          "note": "响应式本质是改布局"
        },
        {
          "from": "c2",
          "to": "c9",
          "rel": "prereq",
          "note": "先会规划优先级，再做案例"
        }
      ]
    },
    "v-1": {
      "title": "第 1 章 · 布局设计的基本原则",
      "path": [
        "课程知识图谱",
        "设计篇（1–4 章）",
        "第 1 章"
      ],
      "nodes": [
        {
          "id": "c1",
          "name": "布局设计的基本原则",
          "cat": "chapter",
          "desc": "对齐、亲密性、重复、对比、格式塔与视觉平衡——先搞清\"什么算好的布局\"。",
          "route": "lesson-01/"
        },
        {
          "id": "ch-1-1",
          "name": "1.1 对齐：建立秩序",
          "cat": "section",
          "desc": "在写任何布局代码之前，先要回答一个设计问题：这个页面的元素，靠哪条线站队？",
          "route": "lesson-01/#ch-1-1"
        },
        {
          "id": "ch-1-2",
          "name": "1.2 亲密性与留白",
          "cat": "section",
          "desc": "亲密性原则：逻辑上相关的内容，在视觉上就应该靠得更近；不相关的，就要拉开距离。",
          "route": "lesson-01/#ch-1-2"
        },
        {
          "id": "ch-1-3",
          "name": "1.3 对比与视觉层次",
          "cat": "section",
          "desc": "一个页面不可能所有内容都同等重要。",
          "route": "lesson-01/#ch-1-3"
        },
        {
          "id": "ch-1-4",
          "name": "1.4 重复与统一",
          "cat": "section",
          "desc": "到这里，四个基础原则已经讲完三个。",
          "route": "lesson-01/#ch-1-4"
        },
        {
          "id": "ch-1-5",
          "name": "1.5 格式塔原理",
          "cat": "section",
          "desc": "前面讲的原则都很\"实操\"，但它们背后有一套心理学依据——格式塔原理（Gestalt）。",
          "route": "lesson-01/#ch-1-5"
        },
        {
          "id": "ch-1-6",
          "name": "1.6 视觉平衡与节奏",
          "cat": "section",
          "desc": "最后一个理论视角：把页面想象成一个天平。",
          "route": "lesson-01/#ch-1-6"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 页面骨架与栅格",
          "cat": "step",
          "desc": "骨架有了，接下来是给页面装上刻度——这一步决定了后面所有区块能否对齐。",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 首屏 Hero",
          "cat": "step",
          "desc": "首屏（Hero）是全页视觉重量最大的区块，也是设计原则最密集的地方。",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 作品集卡片墙",
          "cat": "step",
          "desc": "作品集是整页的说服核心。",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "ch-9-7",
          "name": "9.7 数据统计区",
          "cat": "step",
          "desc": "这一区要同时放多个小指标和一个大图表——正是第 4 章讲的\"仪表盘栅格\"场景。",
          "route": "lesson-09/#ch-9-7"
        },
        {
          "id": "lab",
          "name": "实战环节",
          "cat": "lab",
          "desc": "8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。",
          "route": "practice.html"
        }
      ],
      "links": [
        {
          "from": "c1",
          "to": "ch-1-1",
          "rel": "part-of"
        },
        {
          "from": "c1",
          "to": "ch-1-2",
          "rel": "part-of"
        },
        {
          "from": "c1",
          "to": "ch-1-3",
          "rel": "part-of"
        },
        {
          "from": "c1",
          "to": "ch-1-4",
          "rel": "part-of"
        },
        {
          "from": "c1",
          "to": "ch-1-5",
          "rel": "part-of"
        },
        {
          "from": "c1",
          "to": "ch-1-6",
          "rel": "part-of"
        },
        {
          "from": "ch-1-1",
          "to": "ch-9-2",
          "rel": "used-in"
        },
        {
          "from": "ch-1-1",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-1-2",
          "to": "ch-9-6",
          "rel": "used-in"
        },
        {
          "from": "ch-1-2",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-1-3",
          "to": "ch-9-7",
          "rel": "used-in"
        },
        {
          "from": "ch-1-3",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-1-4",
          "to": "ch-9-6",
          "rel": "used-in"
        },
        {
          "from": "ch-1-5",
          "to": "ch-9-6",
          "rel": "used-in"
        },
        {
          "from": "ch-1-6",
          "to": "ch-9-4",
          "rel": "used-in"
        },
        {
          "from": "ch-1-6",
          "to": "lab",
          "rel": "used-in"
        }
      ]
    },
    "v-2": {
      "title": "第 2 章 · 从需求到页面骨架",
      "path": [
        "课程知识图谱",
        "设计篇（1–4 章）",
        "第 2 章"
      ],
      "nodes": [
        {
          "id": "c2",
          "name": "从需求到页面骨架",
          "cat": "chapter",
          "desc": "动手画之前先想清楚：内容优先级、阅读模式、以及用线框图定下结构。",
          "route": "lesson-02/"
        },
        {
          "id": "ch-2-1",
          "name": "2.1 先问目标与优先级",
          "cat": "section",
          "desc": "布局的本质是把内容按重要性排布到空间里。",
          "route": "lesson-02/#ch-2-1"
        },
        {
          "id": "ch-2-2",
          "name": "2.2 阅读模式与视线路径",
          "cat": "section",
          "desc": "人看网页不是\"逐字读\"，而是扫描。",
          "route": "lesson-02/#ch-2-2"
        },
        {
          "id": "ch-2-3",
          "name": "2.3 线框图：先骨架后皮肤",
          "cat": "section",
          "desc": "线框图（wireframe）是用灰色方块和占位文字画出的页面结构草图——只关心\"哪块放哪、占多大\"，不关心长得好不好看。",
          "route": "lesson-02/#ch-2-3"
        },
        {
          "id": "ch-9-1",
          "name": "9.1 案例规划与线框图",
          "cat": "step",
          "desc": "从这一节开始，我们要完整做出一个「个人作品集网站」。",
          "route": "lesson-09/#ch-9-1"
        },
        {
          "id": "lab",
          "name": "实战环节",
          "cat": "lab",
          "desc": "8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。",
          "route": "practice.html"
        }
      ],
      "links": [
        {
          "from": "c2",
          "to": "ch-2-1",
          "rel": "part-of"
        },
        {
          "from": "c2",
          "to": "ch-2-2",
          "rel": "part-of"
        },
        {
          "from": "c2",
          "to": "ch-2-3",
          "rel": "part-of"
        },
        {
          "from": "ch-2-1",
          "to": "ch-9-1",
          "rel": "used-in"
        },
        {
          "from": "ch-2-1",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-2-2",
          "to": "ch-9-1",
          "rel": "used-in"
        },
        {
          "from": "ch-2-3",
          "to": "ch-9-1",
          "rel": "used-in"
        },
        {
          "from": "ch-2-3",
          "to": "lab",
          "rel": "used-in"
        }
      ]
    },
    "v-3": {
      "title": "第 3 章 · 栅格系统与间距节奏",
      "path": [
        "课程知识图谱",
        "设计篇（1–4 章）",
        "第 3 章"
      ],
      "nodes": [
        {
          "id": "c3",
          "name": "栅格系统与间距节奏",
          "cat": "chapter",
          "desc": "为什么专业页面\"对得很齐\"？12 列栅格 + 8pt 间距体系给出答案。",
          "route": "lesson-03/"
        },
        {
          "id": "ch-3-1",
          "name": "3.1 12 列栅格",
          "cat": "section",
          "desc": "第 1 章讲了\"要对齐\"，但对齐到哪儿？",
          "route": "lesson-03/#ch-3-1"
        },
        {
          "id": "ch-3-2",
          "name": "3.2 8pt 间距节奏",
          "cat": "section",
          "desc": "除了横向的列，纵向也需要一套\"刻度\"——这就是间距体系。",
          "route": "lesson-03/#ch-3-2"
        },
        {
          "id": "ch-3-3",
          "name": "3.3 对齐到栅格",
          "cat": "section",
          "desc": "栅格画出来之后，还需要一个检查手段：把列线半透明地叠加在页面上，一眼就能看出哪些元素\"跑偏了\"。",
          "route": "lesson-03/#ch-3-3"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 页面骨架与栅格",
          "cat": "step",
          "desc": "骨架有了，接下来是给页面装上刻度——这一步决定了后面所有区块能否对齐。",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "lab",
          "name": "实战环节",
          "cat": "lab",
          "desc": "8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。",
          "route": "practice.html"
        }
      ],
      "links": [
        {
          "from": "c3",
          "to": "ch-3-1",
          "rel": "part-of"
        },
        {
          "from": "c3",
          "to": "ch-3-2",
          "rel": "part-of"
        },
        {
          "from": "c3",
          "to": "ch-3-3",
          "rel": "part-of"
        },
        {
          "from": "ch-3-1",
          "to": "ch-9-2",
          "rel": "used-in"
        },
        {
          "from": "ch-3-1",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-3-2",
          "to": "ch-9-2",
          "rel": "used-in"
        },
        {
          "from": "ch-3-3",
          "to": "ch-9-2",
          "rel": "used-in"
        },
        {
          "from": "ch-3-3",
          "to": "lab",
          "rel": "used-in"
        }
      ]
    },
    "v-4": {
      "title": "第 4 章 · 布局模式选型",
      "path": [
        "课程知识图谱",
        "设计篇（1–4 章）",
        "第 4 章"
      ],
      "nodes": [
        {
          "id": "c4",
          "name": "布局模式选型",
          "cat": "chapter",
          "desc": "单栏、多栏、卡片墙、仪表盘——什么场景该用哪种布局，一次讲清。",
          "route": "lesson-04/"
        },
        {
          "id": "ch-4-1",
          "name": "4.1 圣杯布局",
          "cat": "section",
          "desc": "\"圣杯布局\"是一个经典考题：页头、页脚、左右两侧栏、中间主内容区， 要求主内容区优先、两侧栏定宽、整体自适应。",
          "route": "lesson-04/#ch-4-1"
        },
        {
          "id": "ch-4-2",
          "name": "4.2 卡片墙",
          "cat": "section",
          "desc": "卡片墙（card grid）几乎是每个网站都会用到的布局：一堆等宽的方块， 随屏幕宽度自动改变列数。",
          "route": "lesson-04/#ch-4-2"
        },
        {
          "id": "ch-4-3",
          "name": "4.3 仪表盘栅格",
          "cat": "section",
          "desc": "仪表盘（dashboard）的难点在于：模块大小不一，有的大图表要跨列，有的小指标只占一格。",
          "route": "lesson-04/#ch-4-3"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 页面骨架与栅格",
          "cat": "step",
          "desc": "骨架有了，接下来是给页面装上刻度——这一步决定了后面所有区块能否对齐。",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 作品集卡片墙",
          "cat": "step",
          "desc": "作品集是整页的说服核心。",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "ch-9-7",
          "name": "9.7 数据统计区",
          "cat": "step",
          "desc": "这一区要同时放多个小指标和一个大图表——正是第 4 章讲的\"仪表盘栅格\"场景。",
          "route": "lesson-09/#ch-9-7"
        },
        {
          "id": "lab",
          "name": "实战环节",
          "cat": "lab",
          "desc": "8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。",
          "route": "practice.html"
        }
      ],
      "links": [
        {
          "from": "c4",
          "to": "ch-4-1",
          "rel": "part-of"
        },
        {
          "from": "c4",
          "to": "ch-4-2",
          "rel": "part-of"
        },
        {
          "from": "c4",
          "to": "ch-4-3",
          "rel": "part-of"
        },
        {
          "from": "ch-4-1",
          "to": "ch-9-2",
          "rel": "used-in"
        },
        {
          "from": "ch-4-1",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-4-2",
          "to": "ch-9-6",
          "rel": "used-in"
        },
        {
          "from": "ch-4-2",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-4-3",
          "to": "ch-9-7",
          "rel": "used-in"
        }
      ]
    },
    "v-5": {
      "title": "第 5 章 · 盒模型与文档流",
      "path": [
        "课程知识图谱",
        "实现篇（5–8 章）",
        "第 5 章"
      ],
      "nodes": [
        {
          "id": "c5",
          "name": "盒模型与文档流",
          "cat": "chapter",
          "desc": "实现篇的地基：元素占多少空间、默认怎么排列、display 如何决定角色。",
          "route": "lesson-05/"
        },
        {
          "id": "ch-5-1",
          "name": "5.1 盒模型",
          "cat": "section",
          "desc": "在 CSS 眼里，页面上每一个元素都是一个矩形盒子。",
          "route": "lesson-05/#ch-5-1"
        },
        {
          "id": "ch-5-2",
          "name": "5.2 文档流",
          "cat": "section",
          "desc": "正常流（Normal Flow）是浏览器默认的排版方式。",
          "route": "lesson-05/#ch-5-2"
        },
        {
          "id": "ch-5-3",
          "name": "5.3 display 属性",
          "cat": "section",
          "desc": "display 是布局中最关键的属性之一：它决定了元素是不是块级、能不能设宽高、以及内部的子元素怎么排。",
          "route": "lesson-05/#ch-5-3"
        },
        {
          "id": "ch-9-1",
          "name": "9.1 案例规划与线框图",
          "cat": "step",
          "desc": "从这一节开始，我们要完整做出一个「个人作品集网站」。",
          "route": "lesson-09/#ch-9-1"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 首屏 Hero",
          "cat": "step",
          "desc": "首屏（Hero）是全页视觉重量最大的区块，也是设计原则最密集的地方。",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 作品集卡片墙",
          "cat": "step",
          "desc": "作品集是整页的说服核心。",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "lab",
          "name": "实战环节",
          "cat": "lab",
          "desc": "8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。",
          "route": "practice.html"
        }
      ],
      "links": [
        {
          "from": "c5",
          "to": "ch-5-1",
          "rel": "part-of"
        },
        {
          "from": "c5",
          "to": "ch-5-2",
          "rel": "part-of"
        },
        {
          "from": "c5",
          "to": "ch-5-3",
          "rel": "part-of"
        },
        {
          "from": "ch-5-1",
          "to": "ch-9-4",
          "rel": "used-in"
        },
        {
          "from": "ch-5-2",
          "to": "ch-9-1",
          "rel": "used-in"
        },
        {
          "from": "ch-5-2",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-5-3",
          "to": "ch-9-6",
          "rel": "used-in"
        }
      ]
    },
    "v-6": {
      "title": "第 6 章 · Flexbox 弹性布局",
      "path": [
        "课程知识图谱",
        "实现篇（5–8 章）",
        "第 6 章"
      ],
      "nodes": [
        {
          "id": "c6",
          "name": "Flexbox 弹性布局",
          "cat": "chapter",
          "desc": "一维弹性盒子：对齐、分布与按比例分配剩余空间。",
          "route": "lesson-06/"
        },
        {
          "id": "ch-6-1",
          "name": "6.1 主轴与交叉轴",
          "cat": "section",
          "desc": "给父元素写上 display: flex，它就变成了一个 弹性容器，里面的子元素成为 弹性项目，自动按\"轴\"来排列。",
          "route": "lesson-06/#ch-6-1"
        },
        {
          "id": "ch-6-2",
          "name": "6.2 对齐与分布",
          "cat": "section",
          "desc": "Flexbox 最常用的场景就是\"把一个东西居中\"或\"把几个东西均匀分布\"，这靠两组属性完成。",
          "route": "lesson-06/#ch-6-2"
        },
        {
          "id": "ch-6-3",
          "name": "6.3 弹性伸缩",
          "cat": "section",
          "desc": "Flexbox 之所以叫\"弹性\"，是因为项目可以按比例分配容器中的剩余空间。",
          "route": "lesson-06/#ch-6-3"
        },
        {
          "id": "ch-9-3",
          "name": "9.3 顶部导航栏",
          "cat": "step",
          "desc": "导航栏是最简单的区块，却集中体现了三条原则。",
          "route": "lesson-09/#ch-9-3"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 作品集卡片墙",
          "cat": "step",
          "desc": "作品集是整页的说服核心。",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "lab",
          "name": "实战环节",
          "cat": "lab",
          "desc": "8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。",
          "route": "practice.html"
        }
      ],
      "links": [
        {
          "from": "c6",
          "to": "ch-6-1",
          "rel": "part-of"
        },
        {
          "from": "c6",
          "to": "ch-6-2",
          "rel": "part-of"
        },
        {
          "from": "c6",
          "to": "ch-6-3",
          "rel": "part-of"
        },
        {
          "from": "ch-6-1",
          "to": "ch-9-3",
          "rel": "used-in"
        },
        {
          "from": "ch-6-1",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-6-2",
          "to": "ch-9-3",
          "rel": "used-in"
        },
        {
          "from": "ch-6-3",
          "to": "ch-9-6",
          "rel": "used-in"
        }
      ]
    },
    "v-7": {
      "title": "第 7 章 · Grid 网格布局",
      "path": [
        "课程知识图谱",
        "实现篇（5–8 章）",
        "第 7 章"
      ],
      "nodes": [
        {
          "id": "c7",
          "name": "Grid 网格布局",
          "cat": "chapter",
          "desc": "二维网格系统：行列同时掌控，是页面骨架与卡片墙的利器。",
          "route": "lesson-07/"
        },
        {
          "id": "ch-7-1",
          "name": "7.1 网格基础",
          "cat": "section",
          "desc": "Flexbox 是一维的（只能管一个方向），而 Grid 是二维的——行和列可以同时定义，特别适合页面骨架和卡片墙。",
          "route": "lesson-07/#ch-7-1"
        },
        {
          "id": "ch-7-2",
          "name": "7.2 自动填充",
          "cat": "section",
          "desc": "如果每次都写死 repeat(3, 1fr)，屏幕一窄卡片就会被挤扁。",
          "route": "lesson-07/#ch-7-2"
        },
        {
          "id": "ch-7-3",
          "name": "7.3 网格定位",
          "cat": "section",
          "desc": "网格划好之后，可以让某个项目跨越若干单元格，从而做出\"大标题 + 小卡片\"的版式。",
          "route": "lesson-07/#ch-7-3"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 页面骨架与栅格",
          "cat": "step",
          "desc": "骨架有了，接下来是给页面装上刻度——这一步决定了后面所有区块能否对齐。",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 首屏 Hero",
          "cat": "step",
          "desc": "首屏（Hero）是全页视觉重量最大的区块，也是设计原则最密集的地方。",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 作品集卡片墙",
          "cat": "step",
          "desc": "作品集是整页的说服核心。",
          "route": "lesson-09/#ch-9-6"
        }
      ],
      "links": [
        {
          "from": "c7",
          "to": "ch-7-1",
          "rel": "part-of"
        },
        {
          "from": "c7",
          "to": "ch-7-2",
          "rel": "part-of"
        },
        {
          "from": "c7",
          "to": "ch-7-3",
          "rel": "part-of"
        },
        {
          "from": "ch-7-1",
          "to": "ch-9-2",
          "rel": "used-in"
        },
        {
          "from": "ch-7-1",
          "to": "ch-9-6",
          "rel": "used-in"
        },
        {
          "from": "ch-7-2",
          "to": "ch-9-6",
          "rel": "used-in"
        },
        {
          "from": "ch-7-3",
          "to": "ch-9-4",
          "rel": "used-in"
        }
      ]
    },
    "v-8": {
      "title": "第 8 章 · 定位、层叠与响应式",
      "path": [
        "课程知识图谱",
        "实现篇（5–8 章）",
        "第 8 章"
      ],
      "nodes": [
        {
          "id": "c8",
          "name": "定位、层叠与响应式",
          "cat": "chapter",
          "desc": "让元素脱离文档流、控制层叠顺序，并让一份代码适配手机到大屏。",
          "route": "lesson-08/"
        },
        {
          "id": "ch-8-1",
          "name": "8.1 position 五种取值",
          "cat": "section",
          "desc": "前面学的 Flex 和 Grid 都是在\"正常流\"里做文章。",
          "route": "lesson-08/#ch-8-1"
        },
        {
          "id": "ch-8-2",
          "name": "8.2 偏移量",
          "cat": "section",
          "desc": "元素一旦有了非 static 的定位，就可以用 top / right / bottom / left 四个属性来\"推\"它。",
          "route": "lesson-08/#ch-8-2"
        },
        {
          "id": "ch-8-3",
          "name": "8.3 z-index 与层叠",
          "cat": "section",
          "desc": "当元素互相重叠时，浏览器需要一个规则来决定谁显示在上面，这就是 z-index（z 轴坐标）。",
          "route": "lesson-08/#ch-8-3"
        },
        {
          "id": "ch-8-4",
          "name": "8.4 视口与媒体查询",
          "cat": "section",
          "desc": "响应式的第一步，是告诉浏览器\"按设备的真实宽度来渲染\"——这需要一行 meta 标签：",
          "route": "lesson-08/#ch-8-4"
        },
        {
          "id": "ch-8-5",
          "name": "8.5 移动优先",
          "cat": "section",
          "desc": "写响应式有两条路线，结果一样但维护成本差别很大：",
          "route": "lesson-08/#ch-8-5"
        },
        {
          "id": "ch-8-6",
          "name": "8.6 相对单位",
          "cat": "section",
          "desc": "响应式不只靠媒体查询，相对单位能让尺寸自动\"跟着环境走\"，很多时候可以省掉断点。",
          "route": "lesson-08/#ch-8-6"
        },
        {
          "id": "ch-9-3",
          "name": "9.3 顶部导航栏",
          "cat": "step",
          "desc": "导航栏是最简单的区块，却集中体现了三条原则。",
          "route": "lesson-09/#ch-9-3"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 首屏 Hero",
          "cat": "step",
          "desc": "首屏（Hero）是全页视觉重量最大的区块，也是设计原则最密集的地方。",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-8",
          "name": "9.8 响应式与设计自查",
          "cat": "step",
          "desc": "最后一步：让整个案例在手机上也能好好显示，并做一次系统性的自查。",
          "route": "lesson-09/#ch-9-8"
        },
        {
          "id": "lab",
          "name": "实战环节",
          "cat": "lab",
          "desc": "8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。",
          "route": "practice.html"
        }
      ],
      "links": [
        {
          "from": "c8",
          "to": "ch-8-1",
          "rel": "part-of"
        },
        {
          "from": "c8",
          "to": "ch-8-2",
          "rel": "part-of"
        },
        {
          "from": "c8",
          "to": "ch-8-3",
          "rel": "part-of"
        },
        {
          "from": "c8",
          "to": "ch-8-4",
          "rel": "part-of"
        },
        {
          "from": "c8",
          "to": "ch-8-5",
          "rel": "part-of"
        },
        {
          "from": "c8",
          "to": "ch-8-6",
          "rel": "part-of"
        },
        {
          "from": "ch-8-1",
          "to": "ch-9-3",
          "rel": "used-in"
        },
        {
          "from": "ch-8-1",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-8-2",
          "to": "ch-9-3",
          "rel": "used-in"
        },
        {
          "from": "ch-8-3",
          "to": "ch-9-3",
          "rel": "used-in"
        },
        {
          "from": "ch-8-4",
          "to": "ch-9-8",
          "rel": "used-in"
        },
        {
          "from": "ch-8-5",
          "to": "ch-9-8",
          "rel": "used-in"
        },
        {
          "from": "ch-8-5",
          "to": "lab",
          "rel": "used-in"
        },
        {
          "from": "ch-8-6",
          "to": "ch-9-4",
          "rel": "used-in"
        }
      ]
    },
    "v-9": {
      "title": "第 9 章 · 综合案例：作品集网站",
      "path": [
        "课程知识图谱",
        "实战篇（9 章）",
        "第 9 章"
      ],
      "nodes": [
        {
          "id": "c9",
          "name": "综合案例：作品集网站",
          "cat": "chapter",
          "desc": "从需求到响应式，8 步完整做出一个个人作品集网站，理论与技术全程落地。",
          "route": "lesson-09/"
        },
        {
          "id": "ch-9-1",
          "name": "9.1 案例规划与线框图",
          "cat": "step",
          "desc": "从这一节开始，我们要完整做出一个「个人作品集网站」。",
          "route": "lesson-09/#ch-9-1"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 页面骨架与栅格",
          "cat": "step",
          "desc": "骨架有了，接下来是给页面装上刻度——这一步决定了后面所有区块能否对齐。",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-3",
          "name": "9.3 顶部导航栏",
          "cat": "step",
          "desc": "导航栏是最简单的区块，却集中体现了三条原则。",
          "route": "lesson-09/#ch-9-3"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 首屏 Hero",
          "cat": "step",
          "desc": "首屏（Hero）是全页视觉重量最大的区块，也是设计原则最密集的地方。",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-5",
          "name": "9.5 关于我（双栏）",
          "cat": "step",
          "desc": "\"关于我\"是典型的图文双栏：一边是头像/名片，一边是文字介绍。",
          "route": "lesson-09/#ch-9-5"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 作品集卡片墙",
          "cat": "step",
          "desc": "作品集是整页的说服核心。",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "ch-9-7",
          "name": "9.7 数据统计区",
          "cat": "step",
          "desc": "这一区要同时放多个小指标和一个大图表——正是第 4 章讲的\"仪表盘栅格\"场景。",
          "route": "lesson-09/#ch-9-7"
        },
        {
          "id": "ch-9-8",
          "name": "9.8 响应式与设计自查",
          "cat": "step",
          "desc": "最后一步：让整个案例在手机上也能好好显示，并做一次系统性的自查。",
          "route": "lesson-09/#ch-9-8"
        },
        {
          "id": "c1",
          "name": "布局设计的基本原则",
          "cat": "chapter",
          "desc": "对齐、亲密性、重复、对比、格式塔与视觉平衡——先搞清\"什么算好的布局\"。",
          "route": "lesson-01/",
          "drillTo": "v-1"
        },
        {
          "id": "c2",
          "name": "从需求到页面骨架",
          "cat": "chapter",
          "desc": "动手画之前先想清楚：内容优先级、阅读模式、以及用线框图定下结构。",
          "route": "lesson-02/",
          "drillTo": "v-2"
        },
        {
          "id": "c3",
          "name": "栅格系统与间距节奏",
          "cat": "chapter",
          "desc": "为什么专业页面\"对得很齐\"？12 列栅格 + 8pt 间距体系给出答案。",
          "route": "lesson-03/",
          "drillTo": "v-3"
        },
        {
          "id": "c4",
          "name": "布局模式选型",
          "cat": "chapter",
          "desc": "单栏、多栏、卡片墙、仪表盘——什么场景该用哪种布局，一次讲清。",
          "route": "lesson-04/",
          "drillTo": "v-4"
        },
        {
          "id": "c5",
          "name": "盒模型与文档流",
          "cat": "chapter",
          "desc": "实现篇的地基：元素占多少空间、默认怎么排列、display 如何决定角色。",
          "route": "lesson-05/",
          "drillTo": "v-5"
        },
        {
          "id": "c6",
          "name": "Flexbox 弹性布局",
          "cat": "chapter",
          "desc": "一维弹性盒子：对齐、分布与按比例分配剩余空间。",
          "route": "lesson-06/",
          "drillTo": "v-6"
        },
        {
          "id": "c7",
          "name": "Grid 网格布局",
          "cat": "chapter",
          "desc": "二维网格系统：行列同时掌控，是页面骨架与卡片墙的利器。",
          "route": "lesson-07/",
          "drillTo": "v-7"
        },
        {
          "id": "c8",
          "name": "定位、层叠与响应式",
          "cat": "chapter",
          "desc": "让元素脱离文档流、控制层叠顺序，并让一份代码适配手机到大屏。",
          "route": "lesson-08/",
          "drillTo": "v-8"
        }
      ],
      "links": [
        {
          "from": "c9",
          "to": "ch-9-1",
          "rel": "part-of"
        },
        {
          "from": "c9",
          "to": "ch-9-2",
          "rel": "part-of"
        },
        {
          "from": "c9",
          "to": "ch-9-3",
          "rel": "part-of"
        },
        {
          "from": "c9",
          "to": "ch-9-4",
          "rel": "part-of"
        },
        {
          "from": "c9",
          "to": "ch-9-5",
          "rel": "part-of"
        },
        {
          "from": "c9",
          "to": "ch-9-6",
          "rel": "part-of"
        },
        {
          "from": "c9",
          "to": "ch-9-7",
          "rel": "part-of"
        },
        {
          "from": "c9",
          "to": "ch-9-8",
          "rel": "part-of"
        },
        {
          "from": "ch-9-1",
          "to": "c2",
          "rel": "used-in",
          "note": "小节 1、3"
        },
        {
          "from": "ch-9-1",
          "to": "c1",
          "rel": "used-in",
          "note": "小节 3"
        },
        {
          "from": "ch-9-1",
          "to": "c5",
          "rel": "used-in",
          "note": "小节 2"
        },
        {
          "from": "ch-9-2",
          "to": "c3",
          "rel": "used-in",
          "note": "小节 1、2"
        },
        {
          "from": "ch-9-2",
          "to": "c1",
          "rel": "used-in",
          "note": "小节 1"
        },
        {
          "from": "ch-9-3",
          "to": "c6",
          "rel": "used-in",
          "note": "小节 2"
        },
        {
          "from": "ch-9-3",
          "to": "c8",
          "rel": "used-in",
          "note": "小节 1、3"
        },
        {
          "from": "ch-9-3",
          "to": "c1",
          "rel": "used-in",
          "note": "小节 2"
        },
        {
          "from": "ch-9-4",
          "to": "c1",
          "rel": "used-in",
          "note": "小节 6、3"
        },
        {
          "from": "ch-9-4",
          "to": "c7",
          "rel": "used-in",
          "note": "小节 3"
        },
        {
          "from": "ch-9-4",
          "to": "c8",
          "rel": "used-in",
          "note": "小节 6"
        },
        {
          "from": "ch-9-5",
          "to": "c7",
          "rel": "used-in",
          "note": "小节 3"
        },
        {
          "from": "ch-9-5",
          "to": "c5",
          "rel": "used-in",
          "note": "小节 1"
        },
        {
          "from": "ch-9-5",
          "to": "c1",
          "rel": "used-in",
          "note": "小节 2"
        },
        {
          "from": "ch-9-6",
          "to": "c7",
          "rel": "used-in",
          "note": "小节 2"
        },
        {
          "from": "ch-9-6",
          "to": "c6",
          "rel": "used-in",
          "note": "小节 3"
        },
        {
          "from": "ch-9-6",
          "to": "c1",
          "rel": "used-in",
          "note": "小节 4、5"
        },
        {
          "from": "ch-9-6",
          "to": "c5",
          "rel": "used-in",
          "note": "小节 1"
        },
        {
          "from": "ch-9-7",
          "to": "c4",
          "rel": "used-in",
          "note": "小节 3"
        },
        {
          "from": "ch-9-7",
          "to": "c1",
          "rel": "used-in",
          "note": "小节 3"
        },
        {
          "from": "ch-9-7",
          "to": "c3",
          "rel": "used-in",
          "note": "小节 2"
        },
        {
          "from": "ch-9-8",
          "to": "c8",
          "rel": "used-in",
          "note": "小节 4、5"
        },
        {
          "from": "ch-9-8",
          "to": "c3",
          "rel": "used-in",
          "note": "小节 3"
        }
      ]
    }
  }
};
