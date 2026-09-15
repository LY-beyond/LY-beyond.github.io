// =========================================================
// graph-data.js —— 课程知识图谱数据（英文 / Chinese in ../graph-data.js）
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
  "lang": "en",
  "defaultView": "root",
  "categories": [
    {
      "id": "part",
      "label": "Part",
      "color": "c-primary"
    },
    {
      "id": "chapter",
      "label": "Chapter",
      "color": "c-info"
    },
    {
      "id": "section",
      "label": "Concept",
      "color": "c-accent"
    },
    {
      "id": "step",
      "label": "Case step",
      "color": "c-primary"
    },
    {
      "id": "lab",
      "label": "Lab",
      "color": "c-accent"
    }
  ],
  "relations": [
    {
      "id": "part-of",
      "label": "Part of",
      "style": "solid"
    },
    {
      "id": "prereq",
      "label": "Prerequisite",
      "style": "dashed"
    },
    {
      "id": "used-in",
      "label": "Used in case",
      "style": "dotted"
    }
  ],
  "views": {
    "root": {
      "title": "Course overview",
      "path": [
        "Knowledge graph"
      ],
      "nodes": [
        {
          "id": "p-design",
          "name": "Design (Ch. 1–4)",
          "cat": "part",
          "desc": "How to design: principles, skeleton, grid, and layout patterns."
        },
        {
          "id": "p-impl",
          "name": "Implementation (Ch. 5–8)",
          "cat": "part",
          "desc": "How to code it: box model, Flexbox, Grid, positioning, responsive."
        },
        {
          "id": "p-case",
          "name": "Capstone (Ch. 9)",
          "cat": "part",
          "desc": "One complete portfolio site case that ties everything together."
        },
        {
          "id": "c1",
          "name": "Core Principles of Layout Design",
          "cat": "chapter",
          "desc": "Alignment, proximity, repetition, contrast, Gestalt and visual balance — first pin down what “a good layout” actually means.",
          "route": "lesson-01/",
          "drillTo": "v-1"
        },
        {
          "id": "c2",
          "name": "From Requirements to Page Skeleton",
          "cat": "chapter",
          "desc": "Think it through before you draw: content priority, reading patterns, and nailing the structure down with a wireframe.",
          "route": "lesson-02/",
          "drillTo": "v-2"
        },
        {
          "id": "c3",
          "name": "Grid Systems and Spacing Rhythm",
          "cat": "chapter",
          "desc": "Why do professional pages line up so perfectly? A 12-column grid plus an 8pt spacing scale supplies the answer.",
          "route": "lesson-03/",
          "drillTo": "v-3"
        },
        {
          "id": "c4",
          "name": "Choosing a Layout Pattern",
          "cat": "chapter",
          "desc": "Single column, multi-column, card wall, dashboard — which pattern suits which scenario, explained once and for all.",
          "route": "lesson-04/",
          "drillTo": "v-4"
        },
        {
          "id": "c5",
          "name": "Box Model and Document Flow",
          "cat": "chapter",
          "desc": "The foundation of the Implementation track: how much space an element takes up, how it flows by default, and how display decides its role.",
          "route": "lesson-05/",
          "drillTo": "v-5"
        },
        {
          "id": "c6",
          "name": "Flexbox",
          "cat": "chapter",
          "desc": "One-dimensional flexible boxes: aligning, distributing, and sharing the leftover space in proportion.",
          "route": "lesson-06/",
          "drillTo": "v-6"
        },
        {
          "id": "c7",
          "name": "CSS Grid",
          "cat": "chapter",
          "desc": "A two-dimensional grid system with rows and columns under your control — the go-to tool for page skeletons and card walls.",
          "route": "lesson-07/",
          "drillTo": "v-7"
        },
        {
          "id": "c8",
          "name": "Positioning, Stacking & Responsive Design",
          "cat": "chapter",
          "desc": "Take elements out of the document flow, control stacking order, and make one codebase fit everything from phones to large screens.",
          "route": "lesson-08/",
          "drillTo": "v-8"
        },
        {
          "id": "c9",
          "name": "Capstone: A Portfolio Website",
          "cat": "chapter",
          "desc": "From requirements to responsive layout, build a personal portfolio site in 8 complete steps — theory and technique applied end to end.",
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
          "note": "Grid systematises alignment and spacing"
        },
        {
          "from": "c3",
          "to": "c4",
          "rel": "prereq",
          "note": "Choosing a layout pattern builds on the grid"
        },
        {
          "from": "c5",
          "to": "c6",
          "rel": "prereq",
          "note": "Understand the box model before Flexbox"
        },
        {
          "from": "c6",
          "to": "c7",
          "rel": "prereq",
          "note": "Flexbox before Grid"
        },
        {
          "from": "c7",
          "to": "c8",
          "rel": "prereq",
          "note": "Responsive design is layout, rewritten"
        },
        {
          "from": "c2",
          "to": "c9",
          "rel": "prereq",
          "note": "Plan priorities before the case study"
        }
      ]
    },
    "v-1": {
      "title": "Core Principles of Layout Design",
      "path": [
        "Knowledge graph",
        "Design (Ch. 1–4)",
        "Ch. 1"
      ],
      "nodes": [
        {
          "id": "c1",
          "name": "Core Principles of Layout Design",
          "cat": "chapter",
          "desc": "Alignment, proximity, repetition, contrast, Gestalt and visual balance — first pin down what “a good layout” actually means.",
          "route": "lesson-01/"
        },
        {
          "id": "ch-1-1",
          "name": "1.1 Alignment: Creating Order",
          "cat": "section",
          "desc": "Before writing a single line of layout code, answer one design question: which line do the elem…",
          "route": "lesson-01/#ch-1-1"
        },
        {
          "id": "ch-1-2",
          "name": "1.2 Proximity and Whitespace",
          "cat": "section",
          "desc": "Proximity: content that is logically related should sit closer together visually, and unrelated…",
          "route": "lesson-01/#ch-1-2"
        },
        {
          "id": "ch-1-3",
          "name": "1.3 Contrast and Visual Hierarchy",
          "cat": "section",
          "desc": "Not everything on a page can matter equally.",
          "route": "lesson-01/#ch-1-3"
        },
        {
          "id": "ch-1-4",
          "name": "1.4 Repetition and Unity",
          "cat": "section",
          "desc": "We have covered three of the four foundational principles.",
          "route": "lesson-01/#ch-1-4"
        },
        {
          "id": "ch-1-5",
          "name": "1.5 Gestalt Principles",
          "cat": "section",
          "desc": "The principles so far are very hands-on, but there is a body of psychology behind them — the Ge…",
          "route": "lesson-01/#ch-1-5"
        },
        {
          "id": "ch-1-6",
          "name": "1.6 Visual Balance and Rhythm",
          "cat": "section",
          "desc": "One last theoretical lens: picture the page as a balance scale.",
          "route": "lesson-01/#ch-1-6"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 Page Skeleton and Grid",
          "cat": "step",
          "desc": "The skeleton is in place; next we give the page a ruler — and this step decides whether every s…",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 The Hero Section",
          "cat": "step",
          "desc": "The hero is the section with the greatest visual weight on the page, and the place where the de…",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 The Portfolio Card Wall",
          "cat": "step",
          "desc": "The portfolio is the persuasive core of the whole page.",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "ch-9-7",
          "name": "9.7 The Statistics Section",
          "cat": "step",
          "desc": "This section has to hold several small metrics and one large chart at the same time — exactly t…",
          "route": "lesson-09/#ch-9-7"
        },
        {
          "id": "lab",
          "name": "Practice lab",
          "cat": "lab",
          "desc": "Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.",
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
      "title": "From Requirements to Page Skeleton",
      "path": [
        "Knowledge graph",
        "Design (Ch. 1–4)",
        "Ch. 2"
      ],
      "nodes": [
        {
          "id": "c2",
          "name": "From Requirements to Page Skeleton",
          "cat": "chapter",
          "desc": "Think it through before you draw: content priority, reading patterns, and nailing the structure down with a wireframe.",
          "route": "lesson-02/"
        },
        {
          "id": "ch-2-1",
          "name": "2.1 Start with Goals and Priority",
          "cat": "section",
          "desc": "Layout is fundamentally about arranging content in space according to how much it matters.",
          "route": "lesson-02/#ch-2-1"
        },
        {
          "id": "ch-2-2",
          "name": "2.2 Reading Patterns and Eye Paths",
          "cat": "section",
          "desc": "People do not read a web page word by word — they scan it.",
          "route": "lesson-02/#ch-2-2"
        },
        {
          "id": "ch-2-3",
          "name": "2.3 Wireframes: Skeleton Before Skin",
          "cat": "section",
          "desc": "A wireframe is a sketch of the page structure drawn with grey blocks and placeholder text — it …",
          "route": "lesson-02/#ch-2-3"
        },
        {
          "id": "ch-9-1",
          "name": "9.1 Planning the Case Study and the Wireframe",
          "cat": "step",
          "desc": "From this section on we are going to build a complete \"personal portfolio website\".",
          "route": "lesson-09/#ch-9-1"
        },
        {
          "id": "lab",
          "name": "Practice lab",
          "cat": "lab",
          "desc": "Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.",
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
      "title": "Grid Systems and Spacing Rhythm",
      "path": [
        "Knowledge graph",
        "Design (Ch. 1–4)",
        "Ch. 3"
      ],
      "nodes": [
        {
          "id": "c3",
          "name": "Grid Systems and Spacing Rhythm",
          "cat": "chapter",
          "desc": "Why do professional pages line up so perfectly? A 12-column grid plus an 8pt spacing scale supplies the answer.",
          "route": "lesson-03/"
        },
        {
          "id": "ch-3-1",
          "name": "3.1 The 12-Column Grid",
          "cat": "section",
          "desc": "Chapter 1 said \"align things\" — but align them to what?",
          "route": "lesson-03/#ch-3-1"
        },
        {
          "id": "ch-3-2",
          "name": "3.2 The 8pt Spacing Rhythm",
          "cat": "section",
          "desc": "Besides horizontal columns, the vertical axis needs a ruler too — that is the spacing scale.",
          "route": "lesson-03/#ch-3-2"
        },
        {
          "id": "ch-3-3",
          "name": "3.3 Snapping to the Grid",
          "cat": "section",
          "desc": "Once the grid is drawn you still need a way to check it: overlay the column lines semi-transpar…",
          "route": "lesson-03/#ch-3-3"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 Page Skeleton and Grid",
          "cat": "step",
          "desc": "The skeleton is in place; next we give the page a ruler — and this step decides whether every s…",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "lab",
          "name": "Practice lab",
          "cat": "lab",
          "desc": "Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.",
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
      "title": "Choosing a Layout Pattern",
      "path": [
        "Knowledge graph",
        "Design (Ch. 1–4)",
        "Ch. 4"
      ],
      "nodes": [
        {
          "id": "c4",
          "name": "Choosing a Layout Pattern",
          "cat": "chapter",
          "desc": "Single column, multi-column, card wall, dashboard — which pattern suits which scenario, explained once and for all.",
          "route": "lesson-04/"
        },
        {
          "id": "ch-4-1",
          "name": "4.1 The Holy Grail Layout",
          "cat": "section",
          "desc": "\"Holy grail layout\" is a classic exercise: a header, a footer, a sidebar on each side, and the …",
          "route": "lesson-04/#ch-4-1"
        },
        {
          "id": "ch-4-2",
          "name": "4.2 The Card Wall",
          "cat": "section",
          "desc": "The card wall (card grid) appears on almost every website: a set of equal-width blocks whose co…",
          "route": "lesson-04/#ch-4-2"
        },
        {
          "id": "ch-4-3",
          "name": "4.3 The Dashboard Grid",
          "cat": "section",
          "desc": "The hard part of a dashboard is that its modules come in different sizes: a large chart needs t…",
          "route": "lesson-04/#ch-4-3"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 Page Skeleton and Grid",
          "cat": "step",
          "desc": "The skeleton is in place; next we give the page a ruler — and this step decides whether every s…",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 The Portfolio Card Wall",
          "cat": "step",
          "desc": "The portfolio is the persuasive core of the whole page.",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "ch-9-7",
          "name": "9.7 The Statistics Section",
          "cat": "step",
          "desc": "This section has to hold several small metrics and one large chart at the same time — exactly t…",
          "route": "lesson-09/#ch-9-7"
        },
        {
          "id": "lab",
          "name": "Practice lab",
          "cat": "lab",
          "desc": "Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.",
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
      "title": "Box Model and Document Flow",
      "path": [
        "Knowledge graph",
        "Implementation (Ch. 5–8)",
        "Ch. 5"
      ],
      "nodes": [
        {
          "id": "c5",
          "name": "Box Model and Document Flow",
          "cat": "chapter",
          "desc": "The foundation of the Implementation track: how much space an element takes up, how it flows by default, and how display decides its role.",
          "route": "lesson-05/"
        },
        {
          "id": "ch-5-1",
          "name": "5.1 The Box Model",
          "cat": "section",
          "desc": "To CSS, every element on a page is a rectangular box.",
          "route": "lesson-05/#ch-5-1"
        },
        {
          "id": "ch-5-2",
          "name": "5.2 Document Flow",
          "cat": "section",
          "desc": "Normal flow is the browser's default typesetting behaviour.",
          "route": "lesson-05/#ch-5-2"
        },
        {
          "id": "ch-5-3",
          "name": "5.3 The display Property",
          "cat": "section",
          "desc": "display is one of the most important properties in layout: it decides whether an element is blo…",
          "route": "lesson-05/#ch-5-3"
        },
        {
          "id": "ch-9-1",
          "name": "9.1 Planning the Case Study and the Wireframe",
          "cat": "step",
          "desc": "From this section on we are going to build a complete \"personal portfolio website\".",
          "route": "lesson-09/#ch-9-1"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 The Hero Section",
          "cat": "step",
          "desc": "The hero is the section with the greatest visual weight on the page, and the place where the de…",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 The Portfolio Card Wall",
          "cat": "step",
          "desc": "The portfolio is the persuasive core of the whole page.",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "lab",
          "name": "Practice lab",
          "cat": "lab",
          "desc": "Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.",
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
      "title": "Flexbox",
      "path": [
        "Knowledge graph",
        "Implementation (Ch. 5–8)",
        "Ch. 6"
      ],
      "nodes": [
        {
          "id": "c6",
          "name": "Flexbox",
          "cat": "chapter",
          "desc": "One-dimensional flexible boxes: aligning, distributing, and sharing the leftover space in proportion.",
          "route": "lesson-06/"
        },
        {
          "id": "ch-6-1",
          "name": "6.1 The Main Axis and the Cross Axis",
          "cat": "section",
          "desc": "Put display: flex on a parent and it becomes a flex container; its children become flex items a…",
          "route": "lesson-06/#ch-6-1"
        },
        {
          "id": "ch-6-2",
          "name": "6.2 Alignment and Distribution",
          "cat": "section",
          "desc": "The most common Flexbox scenario is \"center one thing\" or \"distribute several things evenly\", a…",
          "route": "lesson-06/#ch-6-2"
        },
        {
          "id": "ch-6-3",
          "name": "6.3 Flexing",
          "cat": "section",
          "desc": "Flexbox is called \"flexible\" because items can share the container's leftover space in proporti…",
          "route": "lesson-06/#ch-6-3"
        },
        {
          "id": "ch-9-3",
          "name": "9.3 The Top Navigation Bar",
          "cat": "step",
          "desc": "The nav bar is the simplest section, yet it concentrates three principles.",
          "route": "lesson-09/#ch-9-3"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 The Portfolio Card Wall",
          "cat": "step",
          "desc": "The portfolio is the persuasive core of the whole page.",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "lab",
          "name": "Practice lab",
          "cat": "lab",
          "desc": "Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.",
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
      "title": "CSS Grid",
      "path": [
        "Knowledge graph",
        "Implementation (Ch. 5–8)",
        "Ch. 7"
      ],
      "nodes": [
        {
          "id": "c7",
          "name": "CSS Grid",
          "cat": "chapter",
          "desc": "A two-dimensional grid system with rows and columns under your control — the go-to tool for page skeletons and card walls.",
          "route": "lesson-07/"
        },
        {
          "id": "ch-7-1",
          "name": "7.1 Grid Basics",
          "cat": "section",
          "desc": "Flexbox is one-dimensional — it can only govern one direction at a time.",
          "route": "lesson-07/#ch-7-1"
        },
        {
          "id": "ch-7-2",
          "name": "7.2 Auto-Fill",
          "cat": "section",
          "desc": "If you hard-code repeat(3, 1fr) every time, the cards get squashed as soon as the screen narrow…",
          "route": "lesson-07/#ch-7-2"
        },
        {
          "id": "ch-7-3",
          "name": "7.3 Grid Placement",
          "cat": "section",
          "desc": "Once the grid is drawn, you can make an item span a number of cells, which is how \"a big headli…",
          "route": "lesson-07/#ch-7-3"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 Page Skeleton and Grid",
          "cat": "step",
          "desc": "The skeleton is in place; next we give the page a ruler — and this step decides whether every s…",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 The Hero Section",
          "cat": "step",
          "desc": "The hero is the section with the greatest visual weight on the page, and the place where the de…",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 The Portfolio Card Wall",
          "cat": "step",
          "desc": "The portfolio is the persuasive core of the whole page.",
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
      "title": "Positioning, Stacking & Responsive Design",
      "path": [
        "Knowledge graph",
        "Implementation (Ch. 5–8)",
        "Ch. 8"
      ],
      "nodes": [
        {
          "id": "c8",
          "name": "Positioning, Stacking & Responsive Design",
          "cat": "chapter",
          "desc": "Take elements out of the document flow, control stacking order, and make one codebase fit everything from phones to large screens.",
          "route": "lesson-08/"
        },
        {
          "id": "ch-8-1",
          "name": "8.1 The Five position Values",
          "cat": "section",
          "desc": "The Flex and Grid we met earlier all work inside \"normal flow\".",
          "route": "lesson-08/#ch-8-1"
        },
        {
          "id": "ch-8-2",
          "name": "8.2 Offsets",
          "cat": "section",
          "desc": "Once an element has a position other than static, you can \"push\" it around with the four proper…",
          "route": "lesson-08/#ch-8-2"
        },
        {
          "id": "ch-8-3",
          "name": "8.3 z-index and Stacking",
          "cat": "section",
          "desc": "When elements overlap, the browser needs a rule to decide which one is painted on top — that is…",
          "route": "lesson-08/#ch-8-3"
        },
        {
          "id": "ch-8-4",
          "name": "8.4 Viewport and Media Queries",
          "cat": "section",
          "desc": "The first step of responsive design is telling the browser \"render at the device's real width\" …",
          "route": "lesson-08/#ch-8-4"
        },
        {
          "id": "ch-8-5",
          "name": "8.5 Mobile First",
          "cat": "section",
          "desc": "There are two routes for writing responsive CSS.",
          "route": "lesson-08/#ch-8-5"
        },
        {
          "id": "ch-8-6",
          "name": "8.6 Relative Units",
          "cat": "section",
          "desc": "Responsiveness is not only about media queries — relative units let sizes \"follow the environme…",
          "route": "lesson-08/#ch-8-6"
        },
        {
          "id": "ch-9-3",
          "name": "9.3 The Top Navigation Bar",
          "cat": "step",
          "desc": "The nav bar is the simplest section, yet it concentrates three principles.",
          "route": "lesson-09/#ch-9-3"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 The Hero Section",
          "cat": "step",
          "desc": "The hero is the section with the greatest visual weight on the page, and the place where the de…",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-8",
          "name": "9.8 Responsive Design and Self-Check",
          "cat": "step",
          "desc": "The last step: make the whole case study display properly on a phone too, and run a systematic …",
          "route": "lesson-09/#ch-9-8"
        },
        {
          "id": "lab",
          "name": "Practice lab",
          "cat": "lab",
          "desc": "Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.",
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
      "title": "Capstone: A Portfolio Website",
      "path": [
        "Knowledge graph",
        "Capstone (Ch. 9)",
        "Ch. 9"
      ],
      "nodes": [
        {
          "id": "c9",
          "name": "Capstone: A Portfolio Website",
          "cat": "chapter",
          "desc": "From requirements to responsive layout, build a personal portfolio site in 8 complete steps — theory and technique applied end to end.",
          "route": "lesson-09/"
        },
        {
          "id": "ch-9-1",
          "name": "9.1 Planning the Case Study and the Wireframe",
          "cat": "step",
          "desc": "From this section on we are going to build a complete \"personal portfolio website\".",
          "route": "lesson-09/#ch-9-1"
        },
        {
          "id": "ch-9-2",
          "name": "9.2 Page Skeleton and Grid",
          "cat": "step",
          "desc": "The skeleton is in place; next we give the page a ruler — and this step decides whether every s…",
          "route": "lesson-09/#ch-9-2"
        },
        {
          "id": "ch-9-3",
          "name": "9.3 The Top Navigation Bar",
          "cat": "step",
          "desc": "The nav bar is the simplest section, yet it concentrates three principles.",
          "route": "lesson-09/#ch-9-3"
        },
        {
          "id": "ch-9-4",
          "name": "9.4 The Hero Section",
          "cat": "step",
          "desc": "The hero is the section with the greatest visual weight on the page, and the place where the de…",
          "route": "lesson-09/#ch-9-4"
        },
        {
          "id": "ch-9-5",
          "name": "9.5 About Me (two columns)",
          "cat": "step",
          "desc": "\"About me\" is the classic image-plus-text two-column block: an avatar or name card on one side,…",
          "route": "lesson-09/#ch-9-5"
        },
        {
          "id": "ch-9-6",
          "name": "9.6 The Portfolio Card Wall",
          "cat": "step",
          "desc": "The portfolio is the persuasive core of the whole page.",
          "route": "lesson-09/#ch-9-6"
        },
        {
          "id": "ch-9-7",
          "name": "9.7 The Statistics Section",
          "cat": "step",
          "desc": "This section has to hold several small metrics and one large chart at the same time — exactly t…",
          "route": "lesson-09/#ch-9-7"
        },
        {
          "id": "ch-9-8",
          "name": "9.8 Responsive Design and Self-Check",
          "cat": "step",
          "desc": "The last step: make the whole case study display properly on a phone too, and run a systematic …",
          "route": "lesson-09/#ch-9-8"
        },
        {
          "id": "c1",
          "name": "Core Principles of Layout Design",
          "cat": "chapter",
          "desc": "Alignment, proximity, repetition, contrast, Gestalt and visual balance — first pin down what “a good layout” actually means.",
          "route": "lesson-01/",
          "drillTo": "v-1"
        },
        {
          "id": "c2",
          "name": "From Requirements to Page Skeleton",
          "cat": "chapter",
          "desc": "Think it through before you draw: content priority, reading patterns, and nailing the structure down with a wireframe.",
          "route": "lesson-02/",
          "drillTo": "v-2"
        },
        {
          "id": "c3",
          "name": "Grid Systems and Spacing Rhythm",
          "cat": "chapter",
          "desc": "Why do professional pages line up so perfectly? A 12-column grid plus an 8pt spacing scale supplies the answer.",
          "route": "lesson-03/",
          "drillTo": "v-3"
        },
        {
          "id": "c4",
          "name": "Choosing a Layout Pattern",
          "cat": "chapter",
          "desc": "Single column, multi-column, card wall, dashboard — which pattern suits which scenario, explained once and for all.",
          "route": "lesson-04/",
          "drillTo": "v-4"
        },
        {
          "id": "c5",
          "name": "Box Model and Document Flow",
          "cat": "chapter",
          "desc": "The foundation of the Implementation track: how much space an element takes up, how it flows by default, and how display decides its role.",
          "route": "lesson-05/",
          "drillTo": "v-5"
        },
        {
          "id": "c6",
          "name": "Flexbox",
          "cat": "chapter",
          "desc": "One-dimensional flexible boxes: aligning, distributing, and sharing the leftover space in proportion.",
          "route": "lesson-06/",
          "drillTo": "v-6"
        },
        {
          "id": "c7",
          "name": "CSS Grid",
          "cat": "chapter",
          "desc": "A two-dimensional grid system with rows and columns under your control — the go-to tool for page skeletons and card walls.",
          "route": "lesson-07/",
          "drillTo": "v-7"
        },
        {
          "id": "c8",
          "name": "Positioning, Stacking & Responsive Design",
          "cat": "chapter",
          "desc": "Take elements out of the document flow, control stacking order, and make one codebase fit everything from phones to large screens.",
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
          "note": "§1, 3"
        },
        {
          "from": "ch-9-1",
          "to": "c1",
          "rel": "used-in",
          "note": "§3"
        },
        {
          "from": "ch-9-1",
          "to": "c5",
          "rel": "used-in",
          "note": "§2"
        },
        {
          "from": "ch-9-2",
          "to": "c3",
          "rel": "used-in",
          "note": "§1, 2"
        },
        {
          "from": "ch-9-2",
          "to": "c1",
          "rel": "used-in",
          "note": "§1"
        },
        {
          "from": "ch-9-3",
          "to": "c6",
          "rel": "used-in",
          "note": "§2"
        },
        {
          "from": "ch-9-3",
          "to": "c8",
          "rel": "used-in",
          "note": "§1, 3"
        },
        {
          "from": "ch-9-3",
          "to": "c1",
          "rel": "used-in",
          "note": "§2"
        },
        {
          "from": "ch-9-4",
          "to": "c1",
          "rel": "used-in",
          "note": "§6, 3"
        },
        {
          "from": "ch-9-4",
          "to": "c7",
          "rel": "used-in",
          "note": "§3"
        },
        {
          "from": "ch-9-4",
          "to": "c8",
          "rel": "used-in",
          "note": "§6"
        },
        {
          "from": "ch-9-5",
          "to": "c7",
          "rel": "used-in",
          "note": "§3"
        },
        {
          "from": "ch-9-5",
          "to": "c5",
          "rel": "used-in",
          "note": "§1"
        },
        {
          "from": "ch-9-5",
          "to": "c1",
          "rel": "used-in",
          "note": "§2"
        },
        {
          "from": "ch-9-6",
          "to": "c7",
          "rel": "used-in",
          "note": "§2"
        },
        {
          "from": "ch-9-6",
          "to": "c6",
          "rel": "used-in",
          "note": "§3"
        },
        {
          "from": "ch-9-6",
          "to": "c1",
          "rel": "used-in",
          "note": "§4, 5"
        },
        {
          "from": "ch-9-6",
          "to": "c5",
          "rel": "used-in",
          "note": "§1"
        },
        {
          "from": "ch-9-7",
          "to": "c4",
          "rel": "used-in",
          "note": "§3"
        },
        {
          "from": "ch-9-7",
          "to": "c1",
          "rel": "used-in",
          "note": "§3"
        },
        {
          "from": "ch-9-7",
          "to": "c3",
          "rel": "used-in",
          "note": "§2"
        },
        {
          "from": "ch-9-8",
          "to": "c8",
          "rel": "used-in",
          "note": "§4, 5"
        },
        {
          "from": "ch-9-8",
          "to": "c3",
          "rel": "used-in",
          "note": "§3"
        }
      ]
    }
  }
};
