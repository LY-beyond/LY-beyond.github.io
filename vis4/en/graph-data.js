// =========================================================
// graph-data.js —— 《Introduction to Visualization》knowledge-graph data (English)
// ---------------------------------------------------------
// This is the English mirror of the root graph-data.js. It is drawn from the
// site itself, not a separate set of copy:
//   · chapter / section titles & anchors  ← the h2 and data-chapter TOC of each lesson
//   · key points                          ← theory-card / key-point titles in each section
//   · cases / datasets                    ← the files and demos that really exist under data/
//   · "used-in" edges                     ← which section actually uses each dataset / case
//   · "prereq" edges                      ← manually confirmed cross-section / cross-chapter deps
// The "Complete graph" view is merged at runtime by graph.js from the 6 views
// below, so no third copy is stored here.
//
// Structure contract (identical to the Chinese file): { categories, relations, defaultView, views }
//   categories: [{id, name}]
//   relations:  [{id, name, style}]
//   views.<id>: { title, nodes:[{id,name,cat,route?,drillTo?}], links:[{from,to,rel}] }
//   · cat must come from categories; rel must come from relations
//   · from / to must be node ids within the same view (no dangling links, no duplicates)
//   · route points to a real page + anchor; drillTo points to a real view id
//   · ids, view grouping and link topology are byte-identical to the Chinese data;
//     only human-readable names / titles are translated.
//
// Plain script on purpose (not an ES module) so file:// double-click works too.
// =========================================================
window.KG_DATA = {
  "lang": "en",
  "defaultView": "overview",
  "categories": [
    { "id": "part",    "name": "Course module" },
    { "id": "chapter", "name": "Chapter" },
    { "id": "section", "name": "Section" },
    { "id": "key",     "name": "Key point" },
    { "id": "case",    "name": "Case" },
    { "id": "dataset", "name": "Dataset" },
    { "id": "tool",    "name": "Learning tool" }
  ],
  "relations": [
    { "id": "part-of", "name": "Part of",     "style": "solid"  },
    { "id": "prereq",  "name": "Prerequisite","style": "dashed" },
    { "id": "used-in", "name": "Used in",     "style": "dotted" }
  ],
  "views": {
    "overview": {
      "title": "Course overview",
      "nodes": [
        { "id": "course",   "name": "Introduction to Visualization",      "cat": "part",    "route": "./" },
        { "id": "c1",       "name": "Chapter 1 · Data",                   "cat": "chapter", "route": "lesson-01/", "drillTo": "data" },
        { "id": "c2",       "name": "Chapter 2 · The Visualization Process", "cat": "chapter", "route": "lesson-02/", "drillTo": "flow" },
        { "id": "c3",       "name": "Chapter 3 · Color",                  "cat": "chapter", "route": "lesson-03/", "drillTo": "color" },
        { "id": "c4",       "name": "Chapter 4 · Low-Dimensional Data",   "cat": "chapter", "route": "lesson-04/", "drillTo": "lowdim" },
        { "id": "c5",       "name": "Chapter 5 · Temporal Data",          "cat": "chapter", "route": "lesson-05/", "drillTo": "temporal" },
        { "id": "guide",    "name": "Special · Chart Guide",              "cat": "tool",    "route": "topic-chart-guide/" },
        { "id": "quiz",     "name": "Chapter quizzes (44)",               "cat": "tool",    "route": "quiz.html" },
        { "id": "practice", "name": "D3 practice workbench",              "cat": "tool",    "route": "practice.html" },
        { "id": "ds-hub",   "name": "Bundled datasets (6 files)",         "cat": "dataset", "route": "./#about" }
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
      "title": "Chapter 1 · Data",
      "nodes": [
        { "id": "c1",           "name": "Chapter 1 · Data",                    "cat": "chapter", "route": "lesson-01/" },
        { "id": "s11",          "name": "1.1 Data generation",                 "cat": "section", "route": "lesson-01/#ch-1-1" },
        { "id": "s12",          "name": "1.2 Data definition (DIKW)",          "cat": "section", "route": "lesson-01/#ch-1-2" },
        { "id": "s13",          "name": "1.3 Data attributes (measurement scales)", "cat": "section", "route": "lesson-01/#ch-1-3" },
        { "id": "s14",          "name": "1.4 Data transformation",             "cat": "section", "route": "lesson-01/#ch-1-4" },
        { "id": "s15",          "name": "1.5 D3 data selections",              "cat": "section", "route": "lesson-01/#ch-1-5" },
        { "id": "k-clean",      "name": "Type cleaning (trim / +)",            "cat": "key",     "route": "lesson-01/#ch-1-1" },
        { "id": "k-dikw",       "name": "The DIKW pyramid",                    "cat": "key",     "route": "lesson-01/#ch-1-2" },
        { "id": "k-stevens",    "name": "Stevens 4 measurement scales",        "cat": "key",     "route": "lesson-01/#ch-1-3" },
        { "id": "k-mackinlay",  "name": "Mackinlay visual-channel ranking",    "cat": "key",     "route": "lesson-01/#ch-1-3" },
        { "id": "k-scale",      "name": "Scale choice: Linear / Band",         "cat": "key",     "route": "lesson-01/#ch-1-3" },
        { "id": "k-array8",     "name": "D3: 8 array functions",               "cat": "key",     "route": "lesson-01/#ch-1-4" },
        { "id": "k-join",       "name": "Data-join three states",              "cat": "key",     "route": "lesson-01/#ch-1-5" },
        { "id": "k-keyfn",      "name": "Key function & transition animation", "cat": "key",     "route": "lesson-01/#ch-1-5" },
        { "id": "ds-newstudent","name": "Freshman roster newstudent.csv",      "cat": "dataset", "route": "lesson-01/#ch-1-1" }
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
      "title": "Chapter 2 · The Visualization Process",
      "nodes": [
        { "id": "c2",          "name": "Chapter 2 · The Visualization Process",    "cat": "chapter", "route": "lesson-02/" },
        { "id": "s21",         "name": "2.1 The data-visualization process",       "cat": "section", "route": "lesson-02/#ch-2-1" },
        { "id": "s22",         "name": "2.2 Data transformation: raw data → data table", "cat": "section", "route": "lesson-02/#ch-2-2" },
        { "id": "s23",         "name": "2.3 Visual mapping: data table → visual structure", "cat": "section", "route": "lesson-02/#ch-2-3" },
        { "id": "s24",         "name": "2.4 View rendering & user interaction",    "cat": "section", "route": "lesson-02/#ch-2-4" },
        { "id": "k-card",      "name": "Card data-flow model (1999)",              "cat": "key",     "route": "lesson-02/#ch-2-1" },
        { "id": "k-feedback",  "name": "van Wijk feedback model (2005)",           "cat": "key",     "route": "lesson-02/#ch-2-1" },
        { "id": "k-rollup",    "name": "d3.rollup group aggregation",              "cat": "key",     "route": "lesson-02/#ch-2-2" },
        { "id": "k-olap",      "name": "OLAP slice / drill-down",                  "cat": "key",     "route": "lesson-02/#ch-2-2" },
        { "id": "k-reingold",  "name": "Reingold–Tilford tree layout",             "cat": "key",     "route": "lesson-02/#ch-2-3" },
        { "id": "k-hierarchy", "name": "The d3-hierarchy suite",                   "cat": "key",     "route": "lesson-02/#ch-2-3" },
        { "id": "k-event",     "name": "DOM event phases / delegation",            "cat": "key",     "route": "lesson-02/#ch-2-4" },
        { "id": "k-anim",      "name": "Animation: the time axis of rendering",    "cat": "key",     "route": "lesson-02/#ch-2-4" },
        { "id": "ds-newstudent","name": "Freshman roster newstudent.csv",          "cat": "dataset", "route": "lesson-02/#ch-2-1" },
        { "id": "case-tree",   "name": "Classification tree → tree list",          "cat": "case",    "route": "lesson-02/#ch-2-3" }
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
      "title": "Chapter 3 · Color",
      "nodes": [
        { "id": "c3",          "name": "Chapter 3 · Color",                    "cat": "chapter", "route": "lesson-03/" },
        { "id": "s31",         "name": "3.1 Color model basics",               "cat": "section", "route": "lesson-03/#ch-3-1" },
        { "id": "s32",         "name": "3.2 Three families of colormaps",      "cat": "section", "route": "lesson-03/#ch-3-2" },
        { "id": "s33",         "name": "3.3 The CIE Lab gamut",                "cat": "section", "route": "lesson-03/#ch-3-3" },
        { "id": "s34",         "name": "3.4 Color-scheme rules (5 types)",     "cat": "section", "route": "lesson-03/#ch-3-4" },
        { "id": "s35",         "name": "3.5 Classic scientific palettes",      "cat": "section", "route": "lesson-03/#ch-3-5" },
        { "id": "s36",         "name": "3.6 Right vs. wrong examples",         "cat": "section", "route": "lesson-03/#ch-3-6" },
        { "id": "s37",         "name": "3.7 Vivid + low-saturation generator", "cat": "section", "route": "lesson-03/#ch-3-7" },
        { "id": "s38",         "name": "3.8 CVD checks for paper figures",     "cat": "section", "route": "lesson-03/#ch-3-8" },
        { "id": "k-space",     "name": "Four color spaces",                    "cat": "key",     "route": "lesson-03/#ch-3-1" },
        { "id": "k-cmap",      "name": "Sequential / diverging / qualitative colormaps", "cat": "key", "route": "lesson-03/#ch-3-2" },
        { "id": "k-lab",       "name": "CIE Lab perceptual uniformity",        "cat": "key",     "route": "lesson-03/#ch-3-3" },
        { "id": "k-hardspec",  "name": "Three hard rules for top-journal palettes", "cat": "key", "route": "lesson-03/#ch-3-5" },
        { "id": "k-tol",       "name": "Wong & Paul Tol palettes",             "cat": "key",     "route": "lesson-03/#ch-3-5" },
        { "id": "k-cvd",       "name": "Three CVD types & dual encoding",      "cat": "key",     "route": "lesson-03/#ch-3-8" },
        { "id": "tool-gen",    "name": "Palette generator",                    "cat": "tool",    "route": "lesson-03/#ch-3-7" },
        { "id": "case-rainbow","name": "Rainbow colormap misuse, before vs. after", "cat": "case", "route": "lesson-03/#ch-3-6" }
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
      "title": "Chapter 4 · Low-Dimensional Data Visualization",
      "nodes": [
        { "id": "c4",          "name": "Chapter 4 · Low-Dimensional Data Visualization", "cat": "chapter", "route": "lesson-04/" },
        { "id": "s41",         "name": "4.1 Data transformation",              "cat": "section", "route": "lesson-04/#ch-4-1" },
        { "id": "s42",         "name": "4.2 Axis transformation",              "cat": "section", "route": "lesson-04/#ch-4-2" },
        { "id": "s43",         "name": "4.3 Curve fitting",                    "cat": "section", "route": "lesson-04/#ch-4-3" },
        { "id": "s44",         "name": "4.4 Slope perception (the 45° golden angle)", "cat": "section", "route": "lesson-04/#ch-4-4" },
        { "id": "s45",         "name": "4.5 Contour lines (Marching Squares)", "cat": "section", "route": "lesson-04/#ch-4-5" },
        { "id": "k-wide",      "name": "Wide vs. long format",                 "cat": "key",     "route": "lesson-04/#ch-4-1" },
        { "id": "k-layer",     "name": "Three layers of coordinate change",    "cat": "key",     "route": "lesson-04/#ch-4-2" },
        { "id": "k-fit",       "name": "Interpolation vs. fitting",            "cat": "key",     "route": "lesson-04/#ch-4-3" },
        { "id": "k-cleveland", "name": "Cleveland 45° slope experiment",       "cat": "key",     "route": "lesson-04/#ch-4-4" },
        { "id": "k-marching",  "name": "How Marching Squares works",           "cat": "key",     "route": "lesson-04/#ch-4-5" },
        { "id": "ds-crime",    "name": "crime.csv (50 states × 12 columns)",   "cat": "dataset", "route": "lesson-04/#ch-4-1" },
        { "id": "ds-terrain",  "name": "terrain10.csv (10×10 grid)",           "cat": "dataset", "route": "lesson-04/#ch-4-5" }
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
      "title": "Chapter 5 · Temporal Data Visualization",
      "nodes": [
        { "id": "c5",          "name": "Chapter 5 · Temporal Data Visualization", "cat": "chapter", "route": "lesson-05/" },
        { "id": "s51",         "name": "5.1 Attributes of time",               "cat": "section", "route": "lesson-05/#ch-5-1" },
        { "id": "s52",         "name": "5.2 Standard time visualization (line charts)", "cat": "section", "route": "lesson-05/#ch-5-2" },
        { "id": "s53",         "name": "5.3 Calendar heatmap (van Wijk)",      "cat": "section", "route": "lesson-05/#ch-5-3" },
        { "id": "s54",         "name": "5.4 Cyclic time (Archimedean spiral)", "cat": "section", "route": "lesson-05/#ch-5-4" },
        { "id": "s55",         "name": "5.5 Storyline timelines",              "cat": "section", "route": "lesson-05/#ch-5-5" },
        { "id": "k-timeattr",  "name": "Five attributes of time",              "cat": "key",     "route": "lesson-05/#ch-5-1" },
        { "id": "k-line",      "name": "Standard time chart = 2-D line chart", "cat": "key",     "route": "lesson-05/#ch-5-2" },
        { "id": "k-vanwijk",   "name": "van Wijk calendar layout conventions (2008)", "cat": "key", "route": "lesson-05/#ch-5-3" },
        { "id": "k-spiral",    "name": "Spiral vs. line: two time domains",    "cat": "key",     "route": "lesson-05/#ch-5-4" },
        { "id": "k-story",     "name": "Lifeline narrative decomposition",     "cat": "key",     "route": "lesson-05/#ch-5-5" },
        { "id": "ds-weather",  "name": "weather_2024.csv (366 days)",          "cat": "dataset", "route": "lesson-05/#ch-5-3" },
        { "id": "ds-names",    "name": "french_names.json (long table)",       "cat": "dataset", "route": "lesson-05/#ch-5-2" },
        { "id": "case-jurassic","name": "Jurassic Park storylines",            "cat": "case",    "route": "lesson-05/#ch-5-5" }
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
