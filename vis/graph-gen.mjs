// =========================================================
// graph-gen.mjs —— 开发工具：从站点自身生成知识图谱数据
// ---------------------------------------------------------
// 用法：node graph-gen.mjs
// 产物：graph-data.js（中文）与 en/graph-data.js（英文），**会覆盖原文件**。
//
// 为什么用生成而不是手写：
//   · 章节标题/描述  ← 门户卡片墙
//   · 小节标题/描述  ← 各章 <article> 的 h2 + 讲解面板首句
//   · 「用于案例」边  ← 各章 case-note 里指向 lesson-09 / practice 的真实链接
//   这样图谱不可能与正文脱节；中英各自从对应语言的页面抽取，天然逐项对应。
//   「前置知识」边是人工确认的 6 条跨章依赖（在下面的 PREREQ 里维护）。
//
// ⚠️ 改完页面（标题/小节/交叉引用）后跑一次本脚本，再跑 node graph-check.mjs 复核。
// ⚠️ 本脚本只做开发期生成，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VIS = fileURLToPath(new URL('.', import.meta.url));
/* 去标签 + 解码常见 HTML 实体（门户卡片标题里可能写 &amp; 等，
   不做解码的话数据里会带上字面 &amp;，图谱上就显示成 "&amp;"）。 */
const decodeEntities = (s) => s
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');   // &amp; 必须最后解，避免二次解码
const strip = (s) => decodeEntities(s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
const firstSentence = (s, cap = 96) => {
  const m = s.match(/^[\s\S]*?[。！？.!?]/);
  const t = (m ? m[0] : s).trim();
  return t.length > cap ? t.slice(0, cap - 1) + '…' : t;
};

const PARTS = {
  zh: {
    design: { name: '设计篇（1–4 章）', desc: '回答"怎么设计"：从原则到骨架、栅格与布局模式。' },
    impl: { name: '实现篇（5–8 章）', desc: '回答"怎么写代码"：盒模型、Flexbox、Grid、定位与响应式。' },
    cs: { name: '实战篇（9 章）', desc: '用一个完整的作品集网站案例，把前两部分从头串一遍。' },
    lab: { name: '实战环节', desc: '8 关闯关式工作台：自己手写 HTML / CSS，每关自动检查。' },
  },
  en: {
    design: { name: 'Design (Ch. 1–4)', desc: 'How to design: principles, skeleton, grid, and layout patterns.' },
    impl: { name: 'Implementation (Ch. 5–8)', desc: 'How to code it: box model, Flexbox, Grid, positioning, responsive.' },
    cs: { name: 'Capstone (Ch. 9)', desc: 'One complete portfolio site case that ties everything together.' },
    lab: { name: 'Practice lab', desc: 'Eight hands-on stages: write the HTML/CSS yourself, each stage auto-checked.' },
  },
};

const RELATIONS = [
  { id: 'part-of', zh: '包含', en: 'Part of', style: 'solid' },
  { id: 'prereq', zh: '前置知识', en: 'Prerequisite', style: 'dashed' },
  { id: 'used-in', zh: '用于案例', en: 'Used in case', style: 'dotted' },
];

/* 真实的前置依赖（人工确认，不编造）：[from, to, 中文说明, 英文说明] */
const PREREQ = [
  ['c1', 'c3', '栅格是对齐与间距的系统化', 'Grid systematises alignment and spacing'],
  ['c3', 'c4', '选布局模式要基于栅格', 'Choosing a layout pattern builds on the grid'],
  ['c5', 'c6', '先懂盒模型再学 Flex', 'Understand the box model before Flexbox'],
  ['c6', 'c7', '先 Flex 后 Grid', 'Flexbox before Grid'],
  ['c7', 'c8', '响应式本质是改布局', 'Responsive design is layout, rewritten'],
  ['c2', 'c9', '先会规划优先级，再做案例', 'Plan priorities before the case study'],
];

const CATS = [
  { id: 'part', zh: '篇章', en: 'Part', color: 'c-primary' },
  { id: 'chapter', zh: '章节', en: 'Chapter', color: 'c-info' },
  { id: 'section', zh: '知识点', en: 'Concept', color: 'c-accent' },
  { id: 'step', zh: '案例步骤', en: 'Case step', color: 'c-primary' },
  { id: 'lab', zh: '实战环节', en: 'Lab', color: 'c-accent' },
];

/* ===== 数据抽取 ===== */

function parseLessons(lang) {
  const dir = lang === 'zh' ? '' : 'en\\';
  const chapters = {};   // cN -> { title, desc }
  const sections = {};   // ch-N-M -> { title, desc, chapter }
  const steps = {};      // ch-9-Y -> { title, desc }

  // 章节标题/描述 ← 门户卡片墙
  const portal = readFileSync(`${VIS}${dir}index.html`, 'utf8');
  for (const [, numRaw, body] of portal.matchAll(/<a class="card card--(?:design|impl|capstone)" href="lesson-(\d+)\/\/?">([\s\S]*?)<\/a>/g)) {
    const num = String(parseInt(numRaw, 10));
    chapters['c' + num] = {
      title: strip((body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || ''),
      desc: strip((body.match(/<p class="card-desc">([\s\S]*?)<\/p>/) || [])[1] || ''),
    };
  }

  // 小节与步骤 ← 各章 article
  for (let n = 1; n <= 9; n++) {
    const html = readFileSync(`${VIS}${dir}lesson-0${n}\\index.html`, 'utf8');
    const arts = [...html.matchAll(/<article class="chapter[^"]*" id="(ch-\d+-\d+)">([\s\S]*?)(?=<article class="chapter|<\/main>)/g)];
    for (const [, id, body] of arts) {
      const title = strip((body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || id);
      const explain = (body.match(/<div class="tab-panel[^"]*" data-panel="explain">([\s\S]*?)<div class="tab-panel/) || [])[1] || '';
      const p = (explain.match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '';
      const desc = firstSentence(strip(p));
      if (n === 9) steps[id] = { title, desc };
      else sections[id] = { title, desc, chapter: 'c' + n };
    }
  }

  // 「用于案例」映射 ← case-note 里的真实链接
  const usedIn = {};
  for (let n = 1; n <= 8; n++) {
    const html = readFileSync(`${VIS}${dir}lesson-0${n}\\index.html`, 'utf8');
    const arts = [...html.matchAll(/<article class="chapter[^"]*" id="(ch-\d+-\d+)">([\s\S]*?)(?=<article class="chapter|<\/main>)/g)];
    for (const [, id, body] of arts) {
      const notes = body.match(/<div class="case-note">[\s\S]*?<\/div>\s*<\/div>/g) || [];
      const targets = new Set();
      for (const note of notes) {
        for (const m of note.matchAll(/href="\.\.\/lesson-09\/#(ch-9-\d+)"/g)) targets.add(m[1]);
        if (/href="\.\.\/practice\.html"/.test(note)) targets.add('lab');
      }
      usedIn[id] = [...targets];
    }
  }

  // 第 9 章：步骤 → 引用的前面小节（用于给边加 note）
  const stepUses = {};
  {
    const html = readFileSync(`${VIS}${dir}lesson-09\\index.html`, 'utf8');
    const arts = [...html.matchAll(/<article class="chapter[^"]*" id="(ch-9-\d+)">([\s\S]*?)(?=<article class="chapter|<\/main>)/g)];
    for (const [, id, body] of arts) {
      const notes = body.match(/<div class="case-note">[\s\S]*?<\/div>\s*<\/div>/g) || [];
      const secs = [];
      for (const note of notes) {
        for (const m of note.matchAll(/href="\.\.\/lesson-0(\d)\/#(ch-\d+-\d+)"/g)) {
          if (!secs.includes(m[2])) secs.push(m[2]);
        }
      }
      stepUses[id] = secs;
    }
  }
  return { chapters, sections, steps, usedIn, stepUses };
}

/* ===== 构建图谱 ===== */

function build(lang) {
  const L = parseLessons(lang);
  const P = PARTS[lang];
  const T = (zh, en) => (lang === 'zh' ? zh : en);
  const NUMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const partOf = (n) => (n <= 4 ? 'p-design' : n <= 8 ? 'p-impl' : 'p-case');
  const N = (id, name, cat, extra = {}) => ({ id, name, cat, ...extra });

  /* --- root：3 篇 + 9 章 --- */
  const rootNodes = [
    N('p-design', P.design.name, 'part', { desc: P.design.desc }),
    N('p-impl', P.impl.name, 'part', { desc: P.impl.desc }),
    N('p-case', P.cs.name, 'part', { desc: P.cs.desc }),
    ...NUMS.map((n) => N('c' + n, L.chapters['c' + n].title, 'chapter', {
      desc: L.chapters['c' + n].desc,
      route: `lesson-0${n}/`,
      drillTo: 'v-' + n,
    })),
  ];
  const rootLinks = [
    ...NUMS.map((n) => ({ from: partOf(+n), to: 'c' + n, rel: 'part-of' })),
    ...PREREQ.map(([a, b, zhNote, enNote]) => ({
      from: a, to: b, rel: 'prereq', note: T(zhNote, enNote),
    })),
  ];

  const views = {
    root: {
      title: T('课程总览', 'Course overview'),
      path: [T('课程知识图谱', 'Knowledge graph')],
      nodes: rootNodes,
      links: rootLinks,
    },
  };

  /* --- v-1..v-8：章 + 小节 + 用到的案例步骤 + 实战环节 --- */
  for (const n of NUMS.slice(0, 8)) {
    const cid = 'c' + n;
    const secIds = Object.keys(L.sections).filter((s) => L.sections[s].chapter === cid);
    const stepIds = [...new Set(secIds.flatMap((s) => (L.usedIn[s] || []).filter((t) => t !== 'lab')))].sort();
    const hasLab = secIds.some((s) => (L.usedIn[s] || []).includes('lab'));

    views['v-' + n] = {
      title: T(`第 ${n} 章 · ${L.chapters[cid].title}`, L.chapters[cid].title),
      path: [T('课程知识图谱', 'Knowledge graph'), P[partOf(+n) === 'p-design' ? 'design' : partOf(+n) === 'p-impl' ? 'impl' : 'cs'].name, T(`第 ${n} 章`, `Ch. ${n}`)],
      nodes: [
        N(cid, L.chapters[cid].title, 'chapter', { desc: L.chapters[cid].desc, route: `lesson-0${n}/` }),
        ...secIds.map((s) => N(s, L.sections[s].title, 'section', { desc: L.sections[s].desc, route: `lesson-0${n}/#${s}` })),
        ...stepIds.map((s) => N(s, L.steps[s].title, 'step', { desc: L.steps[s].desc, route: `lesson-09/#${s}` })),
        ...(hasLab ? [N('lab', P.lab.name, 'lab', { desc: P.lab.desc, route: 'practice.html' })] : []),
      ],
      links: [
        ...secIds.map((s) => ({ from: cid, to: s, rel: 'part-of' })),
        ...secIds.flatMap((s) => (L.usedIn[s] || []).map((t) => ({ from: s, to: t, rel: 'used-in' }))),
      ],
    };
  }

  /* --- v-9：第 9 章 + 8 个步骤 + 被引用的章（note 标明具体小节）--- */
  {
    const stepIds = Object.keys(L.steps).sort();
    const chapRef = [...new Set(stepIds.flatMap((s) => (L.stepUses[s] || []).map((x) => 'c' + x.match(/ch-(\d+)-/)[1])))].sort();
    views['v-9'] = {
      title: T('第 9 章 · ' + L.chapters.c9.title, L.chapters.c9.title),
      path: [T('课程知识图谱', 'Knowledge graph'), P.cs.name, T('第 9 章', 'Ch. 9')],
      nodes: [
        N('c9', L.chapters.c9.title, 'chapter', { desc: L.chapters.c9.desc, route: 'lesson-09/' }),
        ...stepIds.map((s) => N(s, L.steps[s].title, 'step', { desc: L.steps[s].desc, route: `lesson-09/#${s}` })),
        ...chapRef.map((c) => N(c, L.chapters[c].title, 'chapter', {
          desc: L.chapters[c].desc,
          route: `lesson-0${c.slice(1)}/`,
          drillTo: 'v-' + c.slice(1),
        })),
      ],
      links: [
        ...stepIds.map((s) => ({ from: 'c9', to: s, rel: 'part-of' })),
        ...stepIds.flatMap((s) => {
          const byChap = {};
          for (const sec of L.stepUses[s] || []) {
            const c = 'c' + sec.match(/ch-(\d+)-/)[1];
            (byChap[c] = byChap[c] || []).push(sec.replace(/ch-\d+-/, ''));
          }
          return Object.entries(byChap).map(([c, nums]) => ({
            from: s,
            to: c,
            rel: 'used-in',
            note: lang === 'zh' ? '小节 ' + nums.join('、') : '§' + nums.join(', '),
          }));
        }),
      ],
    };
  }

  return {
    lang,
    defaultView: 'root',
    categories: CATS.map((c) => ({ id: c.id, label: c[lang], color: c.color })),
    relations: RELATIONS.map((r) => ({ id: r.id, label: r[lang], style: r.style })),
    views,
  };
}

/* ===== 写出文件 ===== */

const banner = (lang) => `// =========================================================
// graph-data.js —— 课程知识图谱数据（${lang === 'zh' ? '中文' : '英文'} / ${lang === 'zh' ? 'English in en/graph-data.js' : 'Chinese in ../graph-data.js'}）
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
`;

const zh = build('zh');
const en = build('en');
writeFileSync(VIS + 'graph-data.js', banner('zh') + 'window.KG_DATA = ' + JSON.stringify(zh, null, 2) + ';\n', 'utf8');
writeFileSync(VIS + 'en\\graph-data.js', banner('en') + 'window.KG_DATA = ' + JSON.stringify(en, null, 2) + ';\n', 'utf8');

/* 摘要（打印到终端，便于确认生成结果） */
const sum = (d) => Object.entries(d.views).map(([k, v]) => `${k}:${v.nodes.length}/${v.links.length}`).join(' ');
console.log('已生成 graph-data.js（中）与 en/graph-data.js（英）');
console.log('  中文视图（节点/边）：', sum(zh));
console.log('  英文视图（节点/边）：', sum(en));
console.log('  ⚠️ 接着跑一次 node graph-check.mjs 复核中英一致性与 route 可达性');
