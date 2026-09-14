// =========================================================
// en/practice-data.js —— Hands-on case (English)
// ---------------------------------------------------------
// 中文案例见 ../practice-data.js。两份案例**逐环节对齐**：
//   同一套 id、同一套检查点（类型/选择器/数值完全相同，只换提示文案）、
//   同一套 focus 锚点 —— 只换语言。practice-check.mjs 会自动比对。
//
// 刻意用「普通 script」而不是 ES Module，理由同中文版：
//   这样 file:// 直接双击打开也能用。
//
// 数据结构与检查点 type 一览，见 ../practice-data.js 的头部注释。
// =========================================================
window.PRACTICE_CASE = {

  id: 'portfolio',
  title: 'Hands-on case · Portfolio website',
  subtitle: 'Following the real development flow, build the Chapter 1–9 ideas into one page you can open',
  lesson: '../lesson-09/',

  /* ---------------- The brief (mirrors 9.1: ask the goal first) ---------------- */
  brief: {
    goal: 'Let a visitor know who I am and what I can do within 10 seconds — and want to get in touch.',
    audience: 'Recruiters and potential collaborators.',
    success: 'The visitor looks through the work and clicks “Get in touch”.',
    deliverable: 'One complete page: nav + hero + about + works + stats + footer.',
  },

  /* ---------------- Base styles the preview provides (not the student's job) ---------------- */
  baseNote: 'The preview already ships: box-sizing: border-box, the body margin and font, resets for '
          + 'h1–h4 / ul / a / img, and the colour tokens (--c-primary, --c-text, --c-border, --radius…). '
          + 'You do not need to repeat any of that — focus on the layout.',

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

/* ---- Colour tokens: the design spec the case hands you — just var() them ---- */
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

  /* ---------------- Case copy (one click inserts it into the editor) ---------------- */
  /* ---------------- Case copy (one click inserts it into the editor) ---------------- */
  assets: [
    { label: 'Name / logo', value: 'Alex Chen' },
    { label: 'Headline', value: 'Hi, I’m Alex Chen' },
    { label: 'Sub-headline', value: 'I focus on page layout and interaction — 40+ projects shipped.' },
    { label: 'Nav items', value: 'Work / About / Contact' },
    { label: 'About · paragraph 1', value: 'Five years of front-end experience, good at turning a design into a clearly structured page.' },
    { label: 'About · paragraph 2', value: 'I believe layout is part of the content — the same page reads completely differently when it is arranged differently.' },
    { label: 'Work titles', value: 'Dashboard design / Data visualisation / Mobile redesign / Design system' },
    { label: 'Stats', value: '42 projects shipped / 5 years / 18 clients' },
    { label: 'Footer heading', value: 'Shall we build something?' },
  ],

  /* ---------------- Starting code for step 1 (where the student begins) ---------------- */
  startCode: {
    html: `<!-- ① Build the page's 6 blocks here: nav / hero / about / works / stats / footer -->
<!-- Give each block a semantic tag and a class name; a single heading each is enough -->`,
    css: `/* Step 1 is structure only — no styles yet */`,
  },

  steps: [

    /* =====================================================
     * Step 1 — page skeleton (mirrors 9.1 / Chapter 2)
     * =================================================== */
    {
      id: 'p-1',
      title: 'Step 1 · Build the page skeleton',
      subtitle: 'Fix the structure before any styling',
      learn: ['Ch. 2 From requirements to page skeleton'],
      task: [
        'Build the 6 blocks in order: top nav → hero → about → works → stats → footer.',
        'One heading per block for now; the inner structure arrives in later steps.',
        'No CSS in this step — restyling before the structure settles is wasted work.',
        'Prefer semantic tags (`<header>` / `<section>` / `<footer>`) over a pile of `<div>`s.',
      ],
      focus: { html: '<!-- ① Build the page', css: '/* Step 1 is' },
      hints: [
        'Start by asking “what blocks does this page have, top to bottom”: nav, hero, about, works, stats, footer — six in total.',
        'Give each block one semantic tag plus a class name that says what it IS: site-header / hero / about / works / stats / site-footer.',
        'Shape: <header class="site-header"><div class="inner">…</div></header>, the other five are <section class="…">…</section>, and the last one is a <footer>.',
      ],
      syntax: [
        { code: '<header> / <section> / <footer>', note: 'Semantic containers — they carry “what this is”, unlike a bare div' },
        { code: 'class="hero"', note: 'Name classes after what they ARE, not what they look like (avoid .blue-left)' },
      ],
      checks: [
        { type: 'count', selector: 'section', min: 4, label: 'at least 4 <section> blocks' },
        { type: 'exists', selector: 'header.site-header', label: '<header class="site-header"> exists' },
        { type: 'exists', selector: 'section.hero', label: 'section.hero exists' },
        { type: 'exists', selector: 'section.about', label: 'section.about exists' },
        { type: 'exists', selector: 'section.works', label: 'section.works exists' },
        { type: 'exists', selector: 'section.stats', label: 'section.stats exists' },
        { type: 'exists', selector: 'footer.site-footer', label: '<footer class="site-footer"> exists' },
        {
          type: 'order',
          selectors: ['header.site-header', 'section.hero', 'section.about', 'section.works', 'section.stats', 'footer.site-footer'],
          label: 'the 6 blocks are stacked in the right order',
        },
      ],
      solution: {
        html: `<!-- ① top nav -->
<header class="site-header">
  <div class="inner">
    <a class="logo" href="#">Alex Chen</a>
  </div>
</header>

<!-- ② hero -->
<section class="hero">
  <div class="grid">
    <h1>Hi, I’m Alex Chen</h1>
  </div>
</section>

<!-- ③ about -->
<section class="about" id="about">
  <div class="grid">
    <h2>About me</h2>
  </div>
</section>

<!-- ④ works -->
<section class="works" id="works">
  <div class="wall">
    <h2>Selected work</h2>
  </div>
</section>

<!-- ⑤ stats -->
<section class="stats">
  <div class="stats-grid">
    <h2>By the numbers</h2>
  </div>
</section>

<!-- ⑥ footer / contact -->
<footer class="site-footer" id="contact">
  <h2>Shall we build something?</h2>
</footer>
`,
        css: `/* Step 1 is structure only — no styles yet */
`,
      },
    },

    /* =====================================================
     * Step 2 — container, grid and spacing steps (mirrors 9.2 / Chapter 3)
     * =================================================== */
    {
      id: 'p-2',
      title: 'Step 2 · Fit the shared ruler',
      subtitle: 'Container + 12-column grid + 8pt spacing steps',
      learn: ['Ch. 3 Grid systems and spacing rhythm', 'Ch. 1 Alignment'],
      task: [
        'Define the spacing steps in `:root`: `--space-sm: 8px`, `--space: 16px`, `--space-lg: 24px`, `--space-xl: 40px`.',
        'Write `.container`: content max width 1180px, at least 24px of air on each side, centred horizontally.',
        'Write `.grid`: 12 columns, with the column gap taken from `var(--space-lg)`.',
        'Wrap each block in a container: change the nav’s `<div class="inner">` to `container inner`, and add `container` to the other blocks’ content layer.',
        '⚠️ Do not hard-code `width: 1180px` — that overflows on narrow screens.',
      ],
      focus: { html: 'class="inner"', css: '' },
      hints: [
        'This step is just three things: the spacing steps, the container, the grid. Defined once and reused everywhere, they become the baseline every alignment hangs off.',
        'The container has to be “at most 1180px when there is room, some air when there is not, always centred”: `width: min(100% - 48px, 1180px)` plus `margin-inline: auto`. The 12-column grid is `display: grid` plus `grid-template-columns: repeat(12, 1fr)`.',
        'Fallback (copy this and it passes): in :root put --space-sm: 8px / --space: 16px / --space-lg: 24px / --space-xl: 40px; .container uses width: min(100% - 48px, 1180px) with margin-inline: auto; .grid uses display: grid + grid-template-columns: repeat(12, 1fr) + gap: var(--space-lg).',
      ],
      syntax: [
        { code: 'width: min(100% - 48px, 1180px);', note: 'One line expressing “24px of air on a small screen, at most 1180px on a large one”' },
        { code: 'margin-inline: auto;', note: 'Centres horizontally (both inline margins are auto)' },
        { code: 'grid-template-columns: repeat(12, 1fr);', note: 'Twelve equal tracks; 12 divides by 2, 3, 4 and 6, so layouts split easily' },
        { code: 'gap: var(--space-lg);', note: 'The column gap follows the spacing steps instead of a magic pixel value' },
      ],
      checks: [
        { type: 'cssVar', name: '--space-lg', expect: '24px', label: 'the spacing step --space-lg: 24px is defined' },
        { type: 'exists', selector: '.container', label: '.container exists' },
        { type: 'styleMin', selector: '.container', prop: 'width', min: 600, label: '.container has a real width (neither overflowing nor cramped)' },
        { type: 'styleMax', selector: '.container', prop: 'width', max: 1181, label: '.container is no wider than 1180px' },
        { type: 'centered', selector: '.container', label: '.container is centred horizontally' },
        { type: 'count', selector: '.container', min: 5, label: 'at least 5 blocks use the container' },
        { type: 'style', selector: '.grid', prop: 'display', expect: 'grid', label: '.grid is a grid container' },
        { type: 'columns', selector: '.grid', min: 12, max: 12, label: '.grid is exactly 12 columns' },
        { type: 'styleMin', selector: '.grid', prop: 'columnGap', min: 20, label: 'the .grid column gap is ≥ 20px' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">Alex Chen</a>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <h1>Hi, I’m Alex Chen</h1>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <h2>About me</h2>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>Selected work</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>By the numbers</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>Shall we build something?</h2>
  </div>
</footer>
`,
        css: `/* ① Spacing steps: every gap on the site comes from here (the 8pt scale) */
:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

/* ② Container: at most 1180px when there is room, 24px of air on a small screen, always centred */
.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

/* ③ 12-column grid: defined once, reused everywhere */
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}
`,
      },
    },

    /* =====================================================
     * Step 3 — top navigation bar (mirrors 9.3 / Chapters 6, 8)
     * =================================================== */
    {
      id: 'p-3',
      title: 'Step 3 · Top navigation bar',
      subtitle: 'The page’s first alignment lesson',
      learn: ['Ch. 6 Flexbox', 'Ch. 8 position: sticky', 'Ch. 1 Proximity'],
      task: [
        'Add the HTML first: inside `.inner`, add a `<nav>` holding 3 links (Work / About / Contact) pointing at `#works`, `#about`, `#contact`.',
        'Make `.site-header` stick: `position: sticky` + `top: 0`, plus a `z-index` so it covers whatever scrolls underneath.',
        'Use Flex on `.inner` to push the logo and the menu to opposite ends, vertically centred, 60px tall.',
        'Make `nav` a flex container too, with a small `gap` between the items so they read as one group.',
        '⚠️ Do not use `position: fixed` for a sticky bar — it keeps no space, so the content below jumps up.',
      ],
      focus: { html: 'container inner', css: '' },
      hints: [
        'The nav bar solves two things: how it is arranged (logo left, menu right) and whether it sticks. Do not start with corner radii and shadows.',
        'The logo and the `<nav>` are the two children of `.inner`, so give `.inner` display: flex + justify-content: space-between + align-items: center; the menu itself is a group, so give nav display: flex + gap: 6px.',
        'Three lines for the sticky bar, none of them optional: position: sticky; top: 0; z-index: 50; — sticky without top never sticks.',
      ],
      syntax: [
        { code: 'position: sticky; top: 0;', note: 'Sticks while keeping its original space (unlike fixed)' },
        { code: 'justify-content: space-between;', note: 'First child flush left, last flush right, the rest spread between' },
        { code: 'align-items: center;', note: 'Centres on the cross axis, so text does not drift to the top' },
        { code: 'gap: 6px;', note: 'Only the space between items — cleaner than a margin on every child' },
      ],
      checks: [
        { type: 'style', selector: '.site-header', prop: 'position', expect: 'sticky', label: 'the nav uses position: sticky' },
        { type: 'style', selector: '.site-header', prop: 'top', expect: '0px', label: 'the nav has top: 0 (without it sticky does nothing)' },
        { type: 'style', selector: '.site-header .inner', prop: 'display', expect: 'flex', label: '.inner lays out with Flex' },
        { type: 'style', selector: '.site-header .inner', prop: 'justifyContent', expect: 'space-between', label: 'logo and menu sit at opposite ends' },
        { type: 'style', selector: '.site-header .inner', prop: 'alignItems', expect: 'center', label: '.inner is centred on the cross axis' },
        { type: 'styleMin', selector: '.site-header .inner', prop: 'height', min: 56, label: 'the nav bar is at least 56px tall' },
        { type: 'style', selector: '.site-header nav', prop: 'display', expect: 'flex', label: 'the menu is one group (nav is a flex container)' },
        { type: 'count', selector: '.site-header nav a', min: 3, label: 'the menu holds at least 3 links' },
        { type: 'styleMin', selector: '.site-header nav', prop: 'gap', min: 4, label: 'the menu items are tightened with a gap (≥ 4px)' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">Alex Chen</a>
    <nav>
      <a href="#works">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <h1>Hi, I’m Alex Chen</h1>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <h2>About me</h2>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>Selected work</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>By the numbers</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>Shall we build something?</h2>
  </div>
</footer>
`,
        css: `/* ① Spacing steps: every gap on the site comes from here (the 8pt scale) */
:root {
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
}

/* ② Container: at most 1180px when there is room, 24px of air on a small screen, always centred */
.container {
  width: min(100% - 48px, 1180px);
  margin-inline: auto;
}

/* ③ 12-column grid: defined once, reused everywhere */
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-lg);
}

/* ④ Nav bar: sticky, with the two ends pushed apart (Chapters 6 and 8) */
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
`,
      },
    },

    /* =====================================================
     * Step 4 — hero section (mirrors 9.4 / Chapters 1, 6, 7)
     * =================================================== */
    {
      id: 'p-4',
      title: 'Step 4 · Hero section',
      subtitle: 'The one screen that decides whether a visitor stays',
      learn: ['Ch. 1 Contrast & hierarchy', 'Ch. 1 Asymmetric balance', 'Ch. 7 Grid columns'],
      task: [
        'Add the HTML first: inside `.hero`’s `.grid` put a text column (`<h1>` + `<p class="lead">` + `<a class="cta">`) and an avatar block `<div class="avatar">` on the right.',
        'Give `.hero` its whitespace from the largest step, `var(--space-xl)`.',
        'Turn `.hero .grid` into two columns, `7fr 5fr`, and centre both columns vertically.',
        'The heading is the one hero: at least 30px (a `clamp()` works well for responsive type); push the sub-headline back with a softer colour.',
        'Give the button a primary background, white text and a pill radius; keep the avatar square with `aspect-ratio: 1 / 1`.',
      ],
      focus: { html: '<h1>', css: '' },
      hints: [
        'A hero allows exactly one hero. If the heading, the avatar and the button all compete, the visitor does not know where to look — make the heading strong first, then weaken the rest in turn.',
        'The column ratio goes on `.hero .grid`: grid-template-columns: 7fr 5fr. It overrides the 12-column set from step 2, because .hero .grid is more specific than .grid. A wider left column is asymmetric balance.',
        'Fallback: .hero { padding: var(--space-xl) 0; }; .hero .grid { grid-template-columns: 7fr 5fr; align-items: center; }; .hero h1 { font-size: clamp(30px, 4vw, 46px); }; .hero .lead { color: var(--c-text-soft); }; .hero .cta { background: var(--c-primary); color: #fff; border-radius: var(--radius-pill); }; .hero .avatar { aspect-ratio: 1 / 1; background: var(--c-primary-2); }',
      ],
      syntax: [
        { code: 'grid-template-columns: 7fr 5fr;', note: 'Left 7, right 5: asymmetric yet balanced, with a clear focus' },
        { code: 'clamp(30px, 4vw, 46px)', note: 'Type that scales with the viewport but keeps a floor and a ceiling' },
        { code: 'aspect-ratio: 1 / 1;', note: 'Give the width, get the height for free' },
        { code: 'display: grid; place-items: center;', note: 'One line for horizontal + vertical centring' },
        { code: 'color: var(--c-text-soft);', note: 'Grey back the secondary text = deliberate weakening' },
      ],
      checks: [
        { type: 'styleMin', selector: '.hero h1', prop: 'fontSize', min: 30, label: 'the h1 is at least 30px (the largest thing on the page)' },
        { type: 'styleMin', selector: '.hero', prop: 'paddingTop', min: 40, label: '.hero has at least 40px of whitespace' },
        { type: 'columns', selector: '.hero .grid', min: 2, max: 2, label: '.hero .grid is two columns' },
        { type: 'colsCompare', selector: '.hero .grid', expect: 'firstGreater', label: 'the left column is wider (asymmetric balance)' },
        { type: 'style', selector: '.hero .grid', prop: 'alignItems', expect: 'center', label: 'the two columns are vertically centred' },
        { type: 'bgSet', selector: '.hero .cta', label: 'the button has a solid background (the one high-contrast element)' },
        { type: 'ratio', selector: '.hero .avatar', expect: 1, tolerance: 0.2, label: 'the avatar block is roughly square' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">Alex Chen</a>
    <nav>
      <a href="#works">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>Hi, I’m Alex Chen<br />a front-end developer</h1>
      <p class="lead">I focus on page layout and interaction — 40+ projects shipped.</p>
      <a class="cta" href="#works">See the work →</a>
    </div>
    <div class="avatar" aria-hidden="true">A</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <h2>About me</h2>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>Selected work</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>By the numbers</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>Shall we build something?</h2>
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

/* Nav bar: sticky, with the two ends pushed apart */
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

/* Hero: whitespace + an asymmetric two-column split + hierarchy */
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
`,
      },
    },

    /* =====================================================
     * Step 5 — about me, two columns (mirrors 9.5 / Chapters 1, 7)
     * =================================================== */
    {
      id: 'p-5',
      title: 'Step 5 · About me (two columns)',
      subtitle: 'Text and image: the ratio matters more than an even split',
      learn: ['Ch. 7 Grid columns', 'Ch. 1 Proximity & rhythm', 'Ch. 1 Choosing an alignment'],
      task: [
        'Add the HTML first: turn `.about`’s content layer into a portrait block `<div class="portrait">` on the left and a text column (`<h2>` + two `<p>`) on the right.',
        'Give `.about .grid` `4fr 8fr` (image 4 : text 8) — never `1fr 1fr`.',
        'Long text beside an image wants top alignment: `align-items: start` (the hero used center — different case).',
        'Raise the paragraph line-height to 1.8–2.0 and space paragraphs with `var(--space)`, so it reads “tight inside a group, loose between groups”.',
        'Keep the portrait at a consistent `aspect-ratio: 4 / 5`.',
      ],
      focus: { html: '<h2>About me</h2>', css: '' },
      hints: [
        'Two columns is not “cut in half”. The image is visual information and the text is reading information, so the text deserves more width — 4:8 or 5:7 are the usual splits.',
        'The ratio again lives on `.about .grid`: grid-template-columns: 4fr 8fr, plus align-items: start. Note how it differs from the hero: short content centres nicely, but a long paragraph must be top-aligned or the reader’s starting point drifts.',
        'Fallback: .about { padding: var(--space-xl) 0; }; .about .grid { grid-template-columns: 4fr 8fr; align-items: start; gap: var(--space-xl); }; .about .portrait { aspect-ratio: 4 / 5; background: var(--c-surface-2); border-radius: var(--radius); }; .about p { color: var(--c-text-soft); line-height: 1.9; margin-bottom: var(--space); }',
      ],
      syntax: [
        { code: 'grid-template-columns: 4fr 8fr;', note: 'Image 4 : text 8, so lines do not run absurdly long' },
        { code: 'align-items: start;', note: 'Top alignment: a long block of text should not be “centred”' },
        { code: 'line-height: 1.9;', note: 'Long paragraphs read best around 1.8–2.0' },
        { code: 'aspect-ratio: 4 / 5;', note: 'The classic portrait ratio' },
      ],
      checks: [
        { type: 'exists', selector: '.about .portrait', label: 'the left portrait block .portrait exists' },
        { type: 'count', selector: '.about p', min: 2, label: 'the right column holds at least 2 paragraphs' },
        { type: 'columns', selector: '.about .grid', min: 2, max: 2, label: '.about .grid is two columns' },
        { type: 'colsCompare', selector: '.about .grid', expect: 'secondGreater', label: 'the text column is wider than the image column (not an even split)' },
        { type: 'style', selector: '.about .grid', prop: 'alignItems', expect: 'start', label: 'the two columns are top-aligned' },
        { type: 'ratio', selector: '.about .portrait', expect: 0.8, tolerance: 0.2, label: 'the portrait is close to 4:5' },
        { type: 'styleMin', selector: '.about p', prop: 'lineHeight', min: 28, label: 'the paragraph line-height is ≥ 28px (about 1.75×)' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">Alex Chen</a>
    <nav>
      <a href="#works">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>Hi, I’m Alex Chen<br />a front-end developer</h1>
      <p class="lead">I focus on page layout and interaction — 40+ projects shipped.</p>
      <a class="cta" href="#works">See the work →</a>
    </div>
    <div class="avatar" aria-hidden="true">A</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">Photo</div>
    <div>
      <h2>About me</h2>
      <p>Five years of front-end experience, good at turning a design into a clearly structured page.</p>
      <p>I believe layout is part of the content — the same page reads completely differently when it is arranged differently.</p>
    </div>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <div class="wall">
      <h2>Selected work</h2>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>By the numbers</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>Shall we build something?</h2>
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

/* Nav bar */
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

/* Hero */
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

/* About me: image 4 : text 8, top-aligned */
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
`,
      },
    },

    /* =====================================================
     * Step 6 — the portfolio card wall (mirrors 9.6 / Chapters 1, 5, 6, 7)
     * =================================================== */
    {
      id: 'p-6',
      title: 'Step 6 · The portfolio card wall',
      subtitle: 'The heart of the case: several pieces of work on one screen',
      learn: ['Ch. 7 auto-fit filling', 'Ch. 1 Repetition & consistency', 'Ch. 6 Vertical Flex inside a card'],
      task: [
        'Add the HTML first: move `<h2>Selected work</h2>` out of `.wall`, then put 4 `<article class="work-card">` inside it.',
        'Each card: thumbnail `<div class="thumb">` + `<h3>` + caption `<p class="meta">` + bottom link `<a class="more">`.',
        'Give `.wall` `repeat(auto-fit, minmax(260px, 1fr))` so the column count adapts on its own — no media queries.',
        'Make `.work-card` a vertical flex container and push the bottom link down with `margin-top: auto`.',
        'Give thumbnails `aspect-ratio: 16 / 10` so the wall does not end up ragged.',
      ],
      focus: { html: 'class="wall"', css: '' },
      hints: [
        'The point of a card wall is repetition: the same radius, padding and border on all four cards is what makes it read as one set.',
        'Let the browser work out the columns: grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)). Inside a card use display: flex + flex-direction: column, then give .more margin-top: auto to push it to the bottom.',
        'Fallback: .wall { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-lg); }; .work-card { display: flex; flex-direction: column; padding: var(--space); background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); }; .work-card .thumb { aspect-ratio: 16 / 10; border-radius: var(--radius-sm); }; .work-card .more { margin-top: auto; color: var(--c-primary); }',
      ],
      syntax: [
        { code: 'repeat(auto-fit, minmax(260px, 1fr))', note: 'Column count decided automatically: never below 260px, leftover space shared' },
        { code: 'flex-direction: column;', note: 'Turns a row flex container into a vertical one' },
        { code: 'margin-top: auto;', note: 'Eats the leftover space in a flex container → pins the element to the bottom' },
        { code: 'aspect-ratio: 16 / 10;', note: 'One consistent ratio for every thumbnail, height included' },
      ],
      checks: [
        { type: 'count', selector: '.wall .work-card', min: 4, label: 'the wall holds at least 4 work cards' },
        { type: 'style', selector: '.wall', prop: 'display', expect: 'grid', label: '.wall lays out with Grid' },
        { type: 'columns', selector: '.wall', min: 2, label: 'at least 2 columns (not one tall stack)' },
        { type: 'sameRow', selector: '.wall .work-card', min: 2, label: 'cards sit side by side (at least 2 on one row)' },
        { type: 'style', selector: '.wall .work-card', prop: 'display', expect: 'flex', label: 'a card is a flex container' },
        { type: 'style', selector: '.wall .work-card', prop: 'flexDirection', expect: 'column', label: 'a card lays out vertically' },
        { type: 'ratio', selector: '.wall .thumb', expect: 1.6, tolerance: 0.35, label: 'thumbnails are close to 16:10' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">Alex Chen</a>
    <nav>
      <a href="#works">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>Hi, I’m Alex Chen<br />a front-end developer</h1>
      <p class="lead">I focus on page layout and interaction — 40+ projects shipped.</p>
      <a class="cta" href="#works">See the work →</a>
    </div>
    <div class="avatar" aria-hidden="true">A</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">Photo</div>
    <div>
      <h2>About me</h2>
      <p>Five years of front-end experience, good at turning a design into a clearly structured page.</p>
      <p>I believe layout is part of the content — the same page reads completely differently when it is arranged differently.</p>
    </div>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <h2>Selected work</h2>
    <div class="wall">
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Dashboard design</h3>
        <p class="meta">Data visualisation · 2026</p>
        <a class="more" href="#">View details →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Data visualisation</h3>
        <p class="meta">Charting system · 2025</p>
        <a class="more" href="#">View details →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Mobile redesign</h3>
        <p class="meta">Responsive · 2025</p>
        <a class="more" href="#">View details →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Design system</h3>
        <p class="meta">Component library · 2024</p>
        <a class="more" href="#">View details →</a>
      </article>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <div class="stats-grid">
      <h2>By the numbers</h2>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>Shall we build something?</h2>
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

/* Nav bar */
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

/* Hero */
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

/* About me */
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

/* Card wall: an adaptive column count, so no media queries are needed */
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

/* A card is a column flex container, so the bottom link can be pinned */
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
`,
      },
    },

    /* =====================================================
     * Step 7 — the numbers strip (mirrors 9.7 / Chapters 1, 3, 4)
     * =================================================== */
    {
      id: 'p-7',
      title: 'Step 7 · The numbers strip',
      subtitle: 'Numbers build credibility — and they test your information hierarchy',
      learn: ['Ch. 1 Contrast & hierarchy', 'Ch. 4 Dashboard grid', 'Ch. 3 Spacing rhythm'],
      task: [
        'Add the HTML first: move `<h2>By the numbers</h2>` out of `.stats-grid`, then put 3 `.stat` blocks inside it.',
        'Each stat: number `<span class="num">` + unit `<span class="unit">` + label `<span class="label">`.',
        'Build a three-step type scale: the number 24–32px bold in the primary colour, the unit 14px, the label 12px grey.',
        'Lay `.stats-grid` out with `repeat(auto-fit, minmax(180px, 1fr))` so the stats sit in a row.',
        'Give the whole block a soft background (`var(--c-surface-2)`) to separate it from its neighbours.',
      ],
      focus: { html: 'class="stats-grid"', css: '' },
      hints: [
        'What this step really tests is hierarchy: within one block, what matters most, what is secondary and what is just a note — said with size and colour.',
        'The number is 30px + font-weight: 800 + the primary colour; the unit is 14px; the label is 12px grey. Three steps differing by roughly 2× and the reader instantly knows what the number means.',
        'Fallback: .stats { padding: var(--space-xl) 0; background: var(--c-surface-2); }; .stat { padding: var(--space-lg) var(--space); background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); text-align: center; }; .stat .num { display: block; font-size: 30px; font-weight: 800; color: var(--c-primary); }; .stat .label { display: block; margin-top: 6px; font-size: 12px; color: var(--c-muted); }',
      ],
      syntax: [
        { code: 'display: block;', note: 'Turns an inline span into a block, so the number and the unit each get their own line' },
        { code: 'font-weight: 800;', note: 'Weight is visual weight — often stronger than size alone' },
        { code: 'margin-top: 6px;', note: 'Tight (6px) inside a stat, loose (24px) between cards' },
        { code: 'background: var(--c-surface-2);', note: 'A soft background separates sections more lightly than a border' },
      ],
      checks: [
        { type: 'count', selector: '.stat', min: 3, label: 'at least 3 stats' },
        { type: 'style', selector: '.stats-grid', prop: 'display', expect: 'grid', label: '.stats-grid lays out with Grid' },
        { type: 'sameRow', selector: '.stat', min: 2, label: 'the stats sit side by side' },
        { type: 'styleMin', selector: '.stat .num', prop: 'fontSize', min: 24, label: 'the number is at least 24px (the loudest element)' },
        { type: 'weightMin', selector: '.stat .num', min: 700, label: 'the number is bold (font-weight ≥ 700)' },
        { type: 'styleMax', selector: '.stat .label', prop: 'fontSize', max: 14, label: 'the label is ≤ 14px (the quietest level)' },
        { type: 'bgSet', selector: '.stat', label: 'a stat has a card background' },
      ],
      solution: {
        html: `<header class="site-header">
  <div class="container inner">
    <a class="logo" href="#">Alex Chen</a>
    <nav>
      <a href="#works">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="container grid">
    <div>
      <h1>Hi, I’m Alex Chen<br />a front-end developer</h1>
      <p class="lead">I focus on page layout and interaction — 40+ projects shipped.</p>
      <a class="cta" href="#works">See the work →</a>
    </div>
    <div class="avatar" aria-hidden="true">A</div>
  </div>
</section>

<section class="about" id="about">
  <div class="container grid">
    <div class="portrait" aria-hidden="true">Photo</div>
    <div>
      <h2>About me</h2>
      <p>Five years of front-end experience, good at turning a design into a clearly structured page.</p>
      <p>I believe layout is part of the content — the same page reads completely differently when it is arranged differently.</p>
    </div>
  </div>
</section>

<section class="works" id="works">
  <div class="container">
    <h2>Selected work</h2>
    <div class="wall">
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Dashboard design</h3>
        <p class="meta">Data visualisation · 2026</p>
        <a class="more" href="#">View details →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Data visualisation</h3>
        <p class="meta">Charting system · 2025</p>
        <a class="more" href="#">View details →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Mobile redesign</h3>
        <p class="meta">Responsive · 2025</p>
        <a class="more" href="#">View details →</a>
      </article>
      <article class="work-card">
        <div class="thumb" aria-hidden="true"></div>
        <h3>Design system</h3>
        <p class="meta">Component library · 2024</p>
        <a class="more" href="#">View details →</a>
      </article>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container">
    <h2>By the numbers</h2>
    <div class="stats-grid">
      <div class="stat">
        <span class="num">42</span><span class="unit">projects</span>
        <span class="label">shipped</span>
      </div>
      <div class="stat">
        <span class="num">5</span><span class="unit">years</span>
        <span class="label">of front-end work</span>
      </div>
      <div class="stat">
        <span class="num">18</span><span class="unit">clients</span>
        <span class="label">worked with</span>
      </div>
    </div>
  </div>
</section>

<footer class="site-footer" id="contact">
  <div class="container">
    <h2>Shall we build something?</h2>
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

/* Nav bar */
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

/* Hero */
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

/* About me */
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

/* Card wall */
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

/* Numbers: a three-step hierarchy */
.stats {
  padding: var(--space-xl) 0;
  background: var(--c-surface-2);   /* a background separates sections more lightly than a border */
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
  color: var(--c-primary);   /* ① loudest: large, bold, primary colour */
}

.stat .unit {
  font-size: 14px;
  color: var(--c-text-soft); /* ② secondary: regular size */
}

.stat .label {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--c-muted);     /* ③ supporting: smallest and quietest */
}
`,
      },
    },

    /* =====================================================
     * Step 8 — responsive: mobile-first refactor (mirrors 9.8 / Chapter 8)
     * =================================================== */
    {
      id: 'p-8',
      title: 'Step 8 · Responsive and the final check',
      subtitle: 'Refactor from desktop-first to mobile-first',
      learn: ['Ch. 8 Media queries & mobile first', 'Ch. 9 The design checklist'],
      task: [
        'The base styles currently hard-code two columns (that is desktop-first). Switch to mobile-first: in the base styles, `.hero .grid` and `.about .grid` should only be `1fr` (a single column).',
        'Use `@media (min-width: 760px)` to make `.hero .grid` `7fr 5fr` and `.about .grid` `4fr 8fr` again — move their `align-items` inside the query too.',
        'Use `@media (min-width: 1040px)` to increase the section whitespace, for example `padding: calc(var(--space-xl) * 1.6) 0`.',
        'Acceptance: with the preview on “Phone 375” the page is a single column; on “Desktop 1180” the hero and about are two columns.',
        'Finally walk the Chapter 9 design checklist, then hit “Save to my work”.',
      ],
      focus: { html: '', css: '.hero .grid' },
      hints: [
        'Mobile first means writing the small-screen base styles first (with no media query) and enhancing upwards with min-width. So the two-column rules written in steps 4 and 5 have to be *moved into* a media query — this is a refactor, not an append.',
        'Do it like this: in the base styles write .hero .grid and .about .grid with grid-template-columns: 1fr; then inside @media (min-width: 760px) { … } write the two-column versions again. Note that align-items: start has to move inside the query as well.',
        'Fallback: .hero .grid, .about .grid { grid-template-columns: 1fr; }; @media (min-width: 760px) { .hero .grid { grid-template-columns: 7fr 5fr; align-items: center; } .about .grid { grid-template-columns: 4fr 8fr; align-items: start; } }; @media (min-width: 1040px) { .hero { padding: calc(var(--space-xl) * 1.6) 0; } }',
      ],
      syntax: [
        { code: '@media (min-width: 760px) { … }', note: 'Applies from 760px upwards — the “enhance upwards” half of mobile first' },
        { code: 'grid-template-columns: 1fr;', note: 'A single column: everything stacks in order on a phone' },
        { code: 'calc(var(--space-xl) * 1.6)', note: 'Maths on top of a spacing step, so the scale still holds' },
      ],
      checks: [
        {
          type: 'atWidth', width: 375,
          label: 'at phone width (375px) the hero and about are single columns',
          checks: [
            { type: 'columns', selector: '.hero .grid', min: 1, max: 1, label: '375px: the hero is a single column' },
            { type: 'columns', selector: '.about .grid', min: 1, max: 1, label: '375px: about me is a single column' },
          ],
        },
        {
          type: 'atWidth', width: 1180,
          label: 'at desktop width (1180px) the hero and about are two columns',
          checks: [
            { type: 'columns', selector: '.hero .grid', min: 2, max: 2, label: '1180px: the hero is two columns' },
            { type: 'colsCompare', selector: '.hero .grid', expect: 'firstGreater', label: '1180px: the hero is wider on the left' },
            { type: 'columns', selector: '.about .grid', min: 2, max: 2, label: '1180px: about me is two columns' },
            { type: 'colsCompare', selector: '.about .grid', expect: 'secondGreater', label: '1180px: about me is wider on the right' },
          ],
        },
        { type: 'styleMin', selector: '.hero', prop: 'paddingTop', min: 40, label: 'the hero still has enough whitespace on a big screen' },
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

/* Nav bar */
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

/* Hero: a single column by default (mobile first) */
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

/* About me: a single column by default */
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

/* Card wall: the column count works itself out, so no media query is needed */
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

/* Numbers */
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
 * Mobile first: only min-width, enhancing upwards.
 * The small-screen styles are never overridden, only built on.
 * ======================================= */

/* From tablet up: two columns */
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

/* From desktop up: more generous whitespace */
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
