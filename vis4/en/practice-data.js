// =========================================================
// practice-data.js —— "D3 practice workbench" case data (English)
// ---------------------------------------------------------
// Case: draw a "new students by major" bar chart from scratch with d3 v7,
// across 8 progressive stages.
//
// Deliberately a plain script (IIFE-style assignment) rather than an ES
// Module: double-clicking the page over file:// just works (the preview
// iframe relies on contentDocument.write plus our own d3 copy — no server
// needed anywhere).
//
// Data shape:
//   window.PRACTICE_CASE = {
//     title, subtitle,
//     brief:    { goal, audience, constraints: [] },   // case brief
//     baseCss:  '…',        // base styles injected into the preview sandbox (students never write these)
//     startCode:{ js  },    // starting code of stage 1
//     assets:   [ { label, value } ],                  // one-click snippets for the editor
//     steps:    [ {
//        id, title, subtitle,
//        task:    [ 'requirement 1', … ],
//        hints:   [ 'idea', 'key API', 'fallback' ],    // ≥ 2 levels, unlocked one by one
//        syntax:  [ { code, note } ],                  // syntax cheat sheet
//        checks:  [ … ],                               // checkpoints (see below)
//        focus:   { js: 'anchor substring' },           // caret anchor
//        solution:{ js }                               // reference solution (= next stage's starting code)
//     } ]
//   }
//
// Supported check types —— all judged against "the SVG DOM actually
// rendered in the preview", never against the source text: any style of
// code passes as long as the outcome is right.
//   noError  { }                              no JS error this run
//   svgCount { n }                            <svg> count in the document ≥ n
//   exists   { selector }                     the selector matches something
//   count    { selector, min | max | eq }     matched element count meets the condition
//   attr     { selector, prop, mode, value|min|max }
//             mode = eq | min | max | contains        reads an HTML/SVG attribute
//   bbox     { selector, dim:'width'|'height', min|max }
//             SVG elements use getBBox() (user units, unaffected by preview scaling),
//             the root <svg> uses getBoundingClientRect()
//   order    { selector, by:'x'|'y'|'width'|'height', dir:'asc'|'desc' }
//             in document order the chosen geometric quantity is monotonic (1px tolerance)
//   style    { selector, prop, mode:'eq'|'min'|'max'|'set', value|min|max }
//             the getComputedStyle value; mode='set' means "not none / transparent / empty"
//   text     { selector, contains: [ … ] }    text content contains these substrings
//   vary     { selector, prop, min }          number of distinct values of that property ≥ min
//   any      { checks: [ … ] }                passes if any sub-check passes
//   atWidth  { width, checks: [ … ] }         runs the sub-checks at the given preview width
//
// ⚠️ Student code lives in a <textarea> and executes inside a sandboxed
//    iframe, so the reference solutions are user-visible (F12). This is a
//    hands-on exercise, not an exam.
// =========================================================
window.PRACTICE_CASE = {

  title: 'Practice Workbench · Draw a Bar Chart with D3',
  subtitle: 'Walk a real D3 workflow in 8 steps: canvas → data binding → axes → labels → encoding → interaction → annotation → delivery',

  /* ---------------- Case brief (mirrors "ask the task first, then look at the data, then pick the mark") ---------------- */
  brief: {
    goal: 'Produce a "new students by major" bar chart with hand-written D3 code: readers can tell at a glance which major enrolls the most students and can read the exact numbers.',
    audience: 'The college’s academic-affairs staff (needs to compare the size of each major quickly; not comfortable with code).',
    constraints: [
      'A 480 × 320 canvas, with margins left around it for the axes and labels',
      'Encode headcount with "length" (the bar height) and tell majors apart by category position — length is the most precise channel',
      'Bars must start from 0, be sorted from most to fewest students, and carry the exact values',
      'Color reinforces the sense of "magnitude" (a sequential colormap); it is not decoration',
      'The final deliverable is a .svg that opens on double-click (exported directly by the workbench)',
    ],
  },

  /* ---------------- Base styles shipped with the preview sandbox ----------------
   * The styles below run inside a standalone iframe sandbox and do NOT inherit
   * the site's tokens.css — so the colors here are site-neutral, chart-demo
   * values (common picks from the Okabe–Ito and Blues scales), chosen purely so
   * the preview stays readable. When writing the exercises, just use sandbox
   * variables such as var(--ch-1) instead of writing raw colors yourself.
   * ----------------------------------------------------- */
  baseCss: `
:root {
  --ch-1: #0072b2;
  --ch-2: #e69f00;
  --ch-6: #d55e00;
  --ink: #1b2430;
  --muted: #6b7684;
  --line: #d3d8e0;
  --paper: #ffffff;
  --bg: #f6f7fa;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 18px;
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: 14px;
}
#stage {
  padding: 8px;
  background: var(--paper);
  border-radius: 10px;
}
#stage svg { display: block; max-width: 100%; height: auto; }
`,

  /* ---------------- Starting code of stage 1 ---------------- */
  startCode: {
    js: `// ===== D3 practice: new students by major, as a bar chart =====
// The data is given; your job is to build the canvas and the scales.

// Data: 2025 first-year headcounts for 5 majors of one college (note: not sorted here)
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

// Canvas size and padding (the padding leaves room for axis ticks and labels)
const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// TODO ① append an <svg> to #stage with class set to 'chart',
//         and set viewBox / width / height together
// TODO ② define two scales:
//         x = scaleBand: categories → horizontal positions
//         y = scaleLinear: values → vertical positions (the range must be flipped upside down)
`,
  },

  /* ---------------- One-click snippets for the editor ---------------- */
  assets: [
    { label: 'Data (5 majors)', value: "const DATA = [\n  { major: 'Software Engineering', count: 22 },\n  { major: 'Data Science', count: 34 },\n  { major: 'Computer Science', count: 18 },\n  { major: 'Artificial Intelligence', count: 26 },\n  { major: 'IoT Engineering', count: 12 },\n];" },
    { label: 'Category scale (scaleBand)', value: "const x = d3.scaleBand()\n  .domain(DATA.map(d => d.major))\n  .range([PAD.l, W - PAD.r])\n  .paddingInner(0.24);" },
    { label: 'Value scale (scaleLinear)', value: "const y = d3.scaleLinear()\n  .domain([0, d3.max(DATA, d => d.count)])\n  .range([H - PAD.b, PAD.t]);" },
    { label: 'y axis + grid lines (axisLeft)', value: "d3.axisLeft(y).ticks(5).tickSize(-(W - PAD.l - PAD.r))" },
    { label: 'Sequential colormap (Blues)', value: "d3.scaleSequential(d3.interpolateBlues)" },
    { label: 'Native tooltip (title)', value: "bars.selectAll('rect.bar').append('title')\n  .text(d => d.major + ': ' + d.count + ' students');" },
  ],

  steps: [
    /* =====================================================
     * Stage 1 —— canvas and scales
     * =================================================== */
    {
      id: 's1-canvas',
      title: 'Stage 1 · Canvas and scales',
      subtitle: 'First pin down "a blank canvas" and the "data → pixel" conversion rules; every later step builds on these two.',
      task: [
        'Append an <svg> to #stage and set its class to chart',
        'Give the svg a viewBox (0 0 480 320) plus width / height, so proportions survive scaling',
        'Define x = d3.scaleBand(): map the 5 major names to horizontal positions, with range [PAD.l, W - PAD.r]',
        'Define y = d3.scaleLinear(): map headcounts to vertical positions, with the domain starting at 0 and the range flipped upside down',
      ],
      hints: [
        'The canvas is a drawing board: after d3.select(\'#stage\').append(\'svg\'), use .attr() to set class, viewBox, width and height one by one.',
        'Division of labor between the two scales: scaleBand handles "categories" (major names in the domain, a pixel interval in the range); scaleLinear handles "values" (the domain runs from 0 to the max, and the range must be written [bottom edge, top edge] to flip vertically).',
        'If you cannot get the max, use d3.max(DATA, d => d.count); a reversed range sends the bars into the sky — remember SVG’s y axis grows downward.',
      ],
      syntax: [
        { code: "d3.select('#stage').append('svg')", note: 'Selects the container and inserts an SVG element, returning a reference to the selection' },
        { code: '.attr(\'viewBox\', \'0 0 \' + W + \' \' + H)', note: 'viewBox defines the "user coordinate" viewport; the chart’s proportions survive SVG scaling' },
        { code: '.domain([…]).range([…])', note: 'domain is the data extent (input), range is the pixel extent (output)' },
        { code: '.range([H - PAD.b, PAD.t])', note: 'Written "bottom → top": larger values are drawn higher (SVG’s y grows downward)' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'Check brackets and quotes against the error line; a missing semicolon usually will not throw, a missing bracket definitely will.' },
        { type: 'svgCount', n: 1, label: '1 SVG canvas appears in the preview', hint: "Create it once with d3.select('#stage').append('svg'); appending repeatedly yields several empty svgs." },
        { type: 'exists', selector: 'svg.chart', label: 'The canvas is <svg class="chart">', hint: "Chain .attr('class', 'chart') after append('svg')." },
        { type: 'attr', selector: 'svg.chart', prop: 'viewBox', mode: 'contains', value: '0 0', label: 'The canvas has a viewBox (scales without distortion)', hint: ".attr('viewBox', '0 0 ' + W + ' ' + H)" },
        { type: 'bbox', selector: 'svg.chart', dim: 'width', min: 300, label: 'Canvas width ≥ 300px', hint: 'Set width on the svg (480 is fine); do not rely on the viewBox alone.' },
        { type: 'bbox', selector: 'svg.chart', dim: 'height', min: 200, label: 'Canvas height ≥ 200px', hint: 'Set height on the svg (320 is fine).' },
      ],
      focus: { js: '// TODO ① append an <svg> to #stage' },
      solution: {
        js: `// Stage 1 · canvas + scales
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas: a 480×320 SVG
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);
`,
      },
    },

    /* =====================================================
     * Stage 2 —— data binding (draw the bars)
     * =================================================== */
    {
      id: 's2-bars',
      title: 'Stage 2 · Bind the data into bars',
      subtitle: 'D3’s core move is not "drawing" but "binding a data array onto the DOM" — one datum grows one bar.',
      task: [
        "First create a container: svg.append('g').attr('class', 'bars')",
        "Inside it run selectAll('rect.bar').data(DATA).join('rect'), letting the number of data rows decide the number of bars",
        "Give each bar class='bar' plus x, y, width, height: x from x(d.major), width from x.bandwidth()",
        'Compute height as y(0) - y(d.count) (bar height measured from 0), and hand the fill to the sandbox variable var(--ch-1)',
      ],
      hints: [
        'This is D3’s "data join": selectAll() reserves empty slots, .data() attaches the array, and .join() creates whatever is missing.',
        'Of the five attributes, height is the easiest to get wrong: writing y(d.count) directly makes "bars stretch to the top", because that is a coordinate, not a length — write y(0) - y(d.count).',
        "You can also stash the datum on each bar: .attr('data-value', d => d.count) — handy to read back when you add interaction later.",
      ],
      syntax: [
        { code: ".selectAll('rect.bar').data(DATA).join('rect')", note: 'Data join: enter creates / update reuses / exit removes, all in one stroke' },
        { code: 'x.bandwidth()', note: 'The width of one band of a scaleBand — take it as the bar width' },
        { code: 'd => y(0) - y(d.count)', note: 'The arrow function receives the current datum; bar height = baseline − bar top' },
        { code: ".style('fill', 'var(--ch-1)')", note: 'The sandbox predefines the chart colors --ch-1…--ch-8; style() beats attr() here (it resolves CSS variables)' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'Common causes: a missing return, an unclosed bracket, or appending a second time after join.' },
        { type: 'exists', selector: 'svg g.bars', label: 'There is a <g class="bars"> holding the bars', hint: "svg.append('g').attr('class', 'bars'); start every later selectAll from it." },
        { type: 'count', selector: 'rect.bar', min: 5, label: 'One bar per major (≥ 5 rect.bar elements)', hint: "selectAll('rect.bar').data(DATA).join('rect'); do not forget .attr('class', 'bar')." },
        { type: 'attr', selector: 'rect.bar', prop: 'width', mode: 'min', min: 1, label: 'Every bar has a width (the length channel is working)', hint: "Set width with .attr('width', x.bandwidth())." },
        { type: 'attr', selector: 'rect.bar', prop: 'height', mode: 'min', min: 1, label: 'Bar heights follow the values (height > 0)', hint: "Use y(0) - y(d.count); all zeros mean y’s range is written the wrong way round." },
        { type: 'style', selector: 'rect.bar', prop: 'fill', mode: 'set', label: 'The bars have a fill (fill is not none)', hint: ".style('fill', 'var(--ch-1)')" },
        { type: 'order', selector: 'rect.bar', by: 'x', dir: 'asc', label: 'The bars line up left to right in data order', hint: 'x’s range starts at the left margin PAD.l; bandwidth assigns positions automatically.' },
        { type: 'bbox', selector: 'rect.bar', dim: 'height', min: 8, label: 'Even the shortest bar is visibly tall (the geometry is really drawn)', hint: 'Check y’s range: it should be [H - PAD.b, PAD.t] (bottom → top).' },
      ],
      focus: { js: 'const y = d3.scaleLinear()' },
      solution: {
        js: `// Stage 2 · data binding → bars
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ Data binding: one datum → one bar
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(DATA)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', 'var(--ch-1)');
`,
      },
    },

    /* =====================================================
     * Stage 3 —— the value axis
     * =================================================== */
    {
      id: 's3-axis',
      title: 'Stage 3 · The value axis',
      subtitle: 'A bar’s height needs ticks as proof. This step equips the y direction with tick values and grid lines that cross the plot area.',
      task: [
        "Before drawing the bars (above the bars block) insert a <g class='axis axis-y'>",
        'Translate it to the left margin: transform = translate(PAD.l, 0)',
        'Generate the ticks with d3.axisLeft(y).ticks(5); stretch the tick lines into grid lines with tickSize(-(W - PAD.l - PAD.r))',
        'Remove the axis line (.domain), keeping only ticks and grid; color the grid lines with var(--line)',
        'Note: the grid must be drawn "beneath" the bars, so this code goes before the bar-drawing code',
      ],
      hints: [
        'd3.axisLeft(y) returns a "generator"; use .call() to draw it into some <g>.',
        'The grid-line trick: make the tick length negative and the lines extend rightward from the axis, crossing the whole plot area.',
        "The vertical domain line is usually unwanted: .call(g => g.select('.domain').remove()) deletes it.",
      ],
      syntax: [
        { code: ".attr('transform', 'translate(' + PAD.l + ',0)')", note: 'Translates the whole group to the left margin, so tick text does not press against the canvas edge' },
        { code: 'd3.axisLeft(y).ticks(5)', note: 'The vertical-axis generator, about 5 ticks; .ticks() is only a suggestion — D3 picks tidy values' },
        { code: '.tickSize(-(W - PAD.l - PAD.r))', note: 'A negative tick length = grid lines (extending from the axis into the plot area)' },
        { code: ".call(g => g.select('.domain').remove())", note: 'The .domain selector points at the axis line itself; removing it leaves only ticks' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'If you see “g.call is not a function”, axisLeft was probably written as axisBottom, or the call is missing.' },
        { type: 'exists', selector: 'svg g.axis-y', label: 'There is a value axis <g class="axis axis-y">', hint: "svg.append('g').attr('class', 'axis axis-y').call(d3.axisLeft(y).ticks(5))" },
        { type: 'attr', selector: 'svg g.axis-y', prop: 'class', mode: 'contains', value: 'axis', label: 'The axis group carries the axis class (easy to select later)', hint: ".attr('class', 'axis axis-y')" },
        { type: 'count', selector: 'svg g.axis-y text', min: 3, label: 'At least 3 tick values on the y axis', hint: 'After .ticks(5) you should see 0, 5, 10 … and other numbers.' },
        { type: 'count', selector: 'svg g.axis-y line', min: 3, label: 'The grid lines matching the ticks are drawn too', hint: '.tickSize(-(W - PAD.l - PAD.r))' },
        { type: 'style', selector: 'svg g.axis-y text', prop: 'fill', mode: 'set', label: 'Tick labels have a color (the default black also passes)', hint: ".selectAll('text').style('fill', 'var(--muted)')" },
      ],
      focus: { js: ".style('fill', 'var(--ch-1)');" },
      solution: {
        js: `// Stage 3 · value axis (drawn beneath the bars)
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ Value axis: ticks + grid lines across the plot area (written before the bars = drawn beneath them)
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ④ Data binding: one datum → one bar
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(DATA)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', 'var(--ch-1)');
`,
      },
    },

    /* =====================================================
     * Stage 4 —— value labels and the category axis
     * =================================================== */
    {
      id: 's4-labels',
      title: 'Stage 4 · Value labels and the category axis',
      subtitle: 'Bars give shape; labels give exact readings — do not make readers "estimate" from bar height.',
      task: [
        "Give each bar a value label: selectAll('text.bar-label').data(DATA).join('text')",
        'Place each label’s x at the bar’s center: x(d.major) + x.bandwidth() / 2; y sits 6px above the bar top',
        "Set text-anchor='middle' so it is centered horizontally; the text content is simply d.count",
        'Add a category axis at the bottom: d3.axisBottom(x), placed at y = H - PAD.b',
      ],
      hints: [
        'Text is a graphical element just like a rectangle, and binds to data in exactly the same way: selectAll → data → join.',
        'You must compute the label coordinates yourself: horizontal = the bar’s left edge + half the bar width; vertical = a little above the bar top (smaller y is higher).',
        'For the category axis use axisBottom(x); do not forget .attr(\'transform\', \'translate(0,\' + (H - PAD.b) + \')\') to move it onto the bottom baseline.',
      ],
      syntax: [
        { code: ".join('text').text(d => d.count)", note: 'A text element’s content is set with .text(), not .html()' },
        { code: ".attr('text-anchor', 'middle')", note: 'Centers the text horizontally on the given coordinate (the default is start / left-aligned)' },
        { code: 'x.bandwidth() / 2', note: 'Half a bar width — aligns the label with the middle of the bar' },
        { code: 'd3.axisBottom(x)', note: 'The horizontal-axis generator: the category names in the domain become tick text automatically' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'After join(\'text\') do not write .attr(\'class\', \'bar\'), or the labels will be mistaken for bars.' },
        { type: 'count', selector: 'text.bar-label', min: 5, label: 'Every bar top carries a value (≥ 5 .bar-label elements)', hint: "selectAll('text.bar-label').data(DATA).join('text') plus .attr('class', 'bar-label')." },
        { type: 'text', selector: 'text.bar-label', contains: ['34', '12'], label: 'The labels show the real values (34 and 12 are visible)', hint: '.text(d => d.count) — a template string works too.' },
        { type: 'attr', selector: 'text.bar-label', prop: 'text-anchor', mode: 'eq', value: 'middle', label: 'Labels are centered above the bars', hint: ".attr('text-anchor', 'middle')" },
        { type: 'attr', selector: 'text.bar-label', prop: 'x', mode: 'min', min: 1, label: 'The labels’ x coordinates fall inside the plot area', hint: '.attr(\'x\', d => x(d.major) + x.bandwidth() / 2)' },
        { type: 'exists', selector: 'svg g.axis-x', label: 'A category axis sits at the bottom: <g class="axis axis-x">', hint: "svg.append('g').attr('class', 'axis axis-x').call(d3.axisBottom(x))" },
        { type: 'text', selector: 'svg g.axis-x', contains: ['Software Engineering', 'IoT Engineering'], label: 'The category axis shows the major names', hint: 'The ticks of axisBottom(x) are exactly the majors in x.domain().' },
      ],
      focus: { js: ".style('stroke', 'var(--line)');" },
      solution: {
        js: `// Stage 4 · value labels + category axis
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ Value axis (drawn beneath the bars)
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ④ Data binding: one datum → one bar
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(DATA)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', 'var(--ch-1)');

// ⑤ Value labels on top of the bars
svg.selectAll('text.bar-label')
  .data(DATA)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

// ⑥ Category labels (x axis)
svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');
`,
      },
    },

    /* =====================================================
     * Stage 5 —— sorting and color encoding
     * =================================================== */
    {
      id: 's5-sort',
      title: 'Stage 5 · Sorting and color encoding',
      subtitle: 'Sorting turns "comparing" into one clean sweep; a sequential colormap makes "magnitude" readable in color as well.',
      task: [
        'Sort the data first: const SORTED = DATA.slice().sort((a, b) => b.count - a.count)',
        'Reset x’s domain: x.domain(SORTED.map(d => d.major))',
        'Switch the data used to draw bars and labels from DATA to SORTED',
        'Define the sequential colormap COLOR = d3.scaleSequential(d3.interpolateBlues), with domain [0, max]',
        'Change the bars’ fill to d => COLOR(d.count) (more students → darker)',
      ],
      hints: [
        'Sorting only changes "who ranks where" — no pixels need writing: once the data is sorted and x.domain reset, positions follow automatically.',
        'D3’s color scales are "continuous mappings": scaleSequential wraps a 0→1 interpolator into "value → color".',
        'All three places must use SORTED: x’s domain, the bars’ data and the labels’ data. Changing only one misaligns bars and labels.',
      ],
      syntax: [
        { code: 'DATA.slice().sort((a, b) => b.count - a.count)', note: 'Descending sort; slice() copies first, so the original DATA stays untouched' },
        { code: 'x.domain(SORTED.map(d => d.major))', note: 'Resetting the domain = re-dealing the band order' },
        { code: 'd3.scaleSequential(d3.interpolateBlues)', note: 'A sequential colormap: light → dark, brightness moving with the value; fits "bigger = darker"' },
        { code: '.style(\'fill\', d => COLOR(d.count))', note: 'Maps each datum to a color string (it returns an rgb(...) string)' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'If you see “COLOR is not a function”, check whether the scale was written as scaleOrdinal.' },
        { type: 'count', selector: 'rect.bar', min: 5, label: 'There are still 5 bars', hint: 'Sorting does not change the count; if it drops, the join’s data source was clobbered.' },
        { type: 'order', selector: 'rect.bar', by: 'height', dir: 'desc', label: 'The bars are sorted from most to fewest students (tallest on the left)', hint: 'Sort the data first, then use the sorted array as x’s domain and as the join’s data.' },
        { type: 'any', label: 'Color varies with the values (colormap or opacity both count)', hint: 'd3.scaleSequential(d3.interpolateBlues).domain([0, max]); if you skip the colormap, vary fill-opacity instead.', checks: [
          { type: 'vary', selector: 'rect.bar', prop: 'fill', min: 3, label: 'The bars use at least 3 different fills', hint: 'Map the values to colors with a sequential colormap.' },
          { type: 'vary', selector: 'rect.bar', prop: 'fill-opacity', min: 2, label: 'The bars use at least 2 different fill opacities', hint: '.style(\'fill-opacity\', d => …) also encodes magnitude.' },
        ] },
        { type: 'order', selector: 'rect.bar', by: 'x', dir: 'asc', label: 'After sorting the bars still spread along x in order', hint: 'Sorting only changes the domain order; scaleBand assigns horizontal positions automatically.' },
        { type: 'text', selector: 'text.bar-label', contains: ['34', '22'], label: 'After sorting the labels still match the bars (both 34 and 22 are there)', hint: 'The labels’ data must be swapped to SORTED too, or labels and bars will mismatch.' },
      ],
      focus: { js: "const bars = svg.append('g')" },
      solution: {
        js: `// Stage 5 · sorting + color encoding
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ Sorting: larger counts go left (sort the data first, then reset x’s domain)
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

// ④ Sequential colormap: more students → darker color
const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ⑤ Value axis (drawn beneath the bars)
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑥ Data binding: one datum → one bar (using the sorted data)
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑦ Value labels on top of the bars (sorted data as well)
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

// ⑧ Category labels (x axis)
svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');
`,
      },
    },

    /* =====================================================
     * Stage 6 —— hover highlighting and tooltips
     * =================================================== */
    {
      id: 's6-hover',
      title: 'Stage 6 · Hover highlighting and tooltips',
      subtitle: 'A static chart only gives rough readings; add a little interaction and users point and read.',
      task: [
        "Add an outline while the pointer is over a bar: .on('mouseover', function () { … })",
        'Remove it when the pointer leaves: .on(\'mouseout\', …)',
        "Give each bar a native tooltip: append('title').text(d => d.major + ': ' + d.count + ' students')",
        "While you are at it, make the cursor a pointer: .style('cursor', 'pointer')",
        '⚠️ When the callback needs this to select the current element, you must write function () {}, not an arrow function',
      ],
      hints: [
        'D3 binds events with .on(eventName, callback); inside the callback, this is "the current element".',
        'The cheapest mouse tooltip is a <title> child element — the browser renders it as a native tooltip, no floating layer required.',
        'Arrow functions have no this of their own; they capture the outer this (usually window), so d3.select(this) selects nothing.',
      ],
      syntax: [
        { code: ".on('mouseover', function () { … })", note: 'Binds an event; only the function form gets the element itself as this' },
        { code: 'd3.select(this)', note: 'Inside an event callback it points at the element that fired the event (which is why arrow functions will not do)' },
        { code: ".style('stroke', 'var(--ink)')", note: 'Adds an outline for highlighting; set it back to none when the pointer leaves' },
        { code: ".append('title').text(…)", note: 'SVG’s native tooltip: just append a title child element' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'If the error mentions this, replace the arrow function with function () {}.' },
        { type: 'count', selector: 'rect.bar', min: 5, label: 'The bar count did not change when the interaction was added', hint: 'Changing styles and events never adds or removes bars; if the count changed, check whether you appended a second time.' },
        { type: 'count', selector: 'rect.bar > title', min: 5, label: 'Every bar carries a native <title> tooltip', hint: "bars.selectAll('rect.bar').append('title').text(d => …)" },
        { type: 'text', selector: 'rect.bar > title', contains: ['students'], label: 'The tooltip states the headcount (e.g. “Data Science: 34 students”)', hint: ".text(d => d.major + ': ' + d.count + ' students')" },
        { type: 'style', selector: 'rect.bar', prop: 'cursor', mode: 'eq', value: 'pointer', label: 'The cursor turns into a pointer over the bars', hint: ".style('cursor', 'pointer')" },
      ],
      focus: { js: 'x.domain(SORTED.map(d => d.major));' },
      solution: {
        js: `// Stage 6 · hover highlight + native tooltips
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ Sorting + sequential colormap
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ④ Value axis (drawn beneath the bars)
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑤ Bars
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑥ Value labels + category axis
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑦ Hover highlight + native tooltips
bars.selectAll('rect.bar')
  .style('cursor', 'pointer')
  .on('mouseover', function () {
    d3.select(this).style('stroke', 'var(--ink)').style('stroke-width', 2);
  })
  .on('mouseout', function () {
    d3.select(this).style('stroke', 'none').style('stroke-width', 0);
  });

bars.selectAll('rect.bar')
  .append('title')
  .text(d => d.major + ': ' + d.count + ' students');
`,
      },
    },

    /* =====================================================
     * Stage 7 —— reference line and annotation
     * =================================================== */
    {
      id: 's7-guide',
      title: 'Stage 7 · Reference line and annotation',
      subtitle: 'One mean line makes "who is above average" visible at a glance — that is drawing the conclusion into the chart.',
      task: [
        'First compute the mean: d3.mean(DATA, d => d.count)',
        "Draw a horizontal dashed line: svg.append('line').attr('class', 'guide'), x from PAD.l to W - PAD.r",
        'Take y1 and y2 both as y(MEAN) (one horizontal line), and use stroke-dasharray to make it dashed',
        "Then write a note: append('text').attr('class', 'annotation') reading “Mean 22.4 students”",
      ],
      hints: [
        'All reference-line coordinates come from the scales: vertical position = y(MEAN), horizontal from the left margin to the right margin.',
        'Compute the mean with d3.mean — shorter than a hand-written reduce; remember it is a "statistic", not a pixel — it still has to pass through y().',
        'Keep the note close to the reference line: take y as y(MEAN) - 6 (nudge it up a little) and text-anchor as end so it tucks against the right edge.',
      ],
      syntax: [
        { code: 'd3.mean(DATA, d => d.count)', note: 'The accessor style for the mean; siblings include d3.max / d3.min / d3.sum' },
        { code: "svg.append('line').attr('x1', …).attr('y1', …)", note: 'The four endpoint attributes of an SVG line segment: x1 y1 x2 y2' },
        { code: ".style('stroke-dasharray', '5 4')", note: 'Dash pattern: 5 on, 4 off; contrasts with the solid bars' },
        { code: "svg.append('text').attr('text-anchor', 'end')", note: 'text-anchor=end means "the coordinate is the right end" of the text' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'If you see “MEAN is not defined”, check that d3.mean runs before it is used.' },
        { type: 'exists', selector: 'svg line.guide', label: 'There is a horizontal reference line <line class="guide">', hint: "svg.append('line').attr('class', 'guide')" },
        { type: 'attr', selector: 'line.guide', prop: 'y1', mode: 'min', min: 1, label: 'The reference line sits inside the plot area (y1 > 0)', hint: 'Take y1 and y2 both as y(MEAN); the value should land between 32 and 272.' },
        { type: 'attr', selector: 'line.guide', prop: 'x2', mode: 'min', min: 200, label: 'The reference line spans the whole plot area', hint: ".attr('x1', PAD.l).attr('x2', W - PAD.r)" },
        { type: 'style', selector: 'line.guide', prop: 'stroke-dasharray', mode: 'set', label: 'The reference line is dashed (distinct from the bars)', hint: ".style('stroke-dasharray', '5 4')" },
        { type: 'exists', selector: 'svg text.annotation', label: 'A note accompanies the reference line', hint: "svg.append('text').attr('class', 'annotation')" },
        { type: 'text', selector: 'text.annotation', contains: ['Mean'], label: 'The note says what the line is (contains “Mean”)', hint: ".text('Mean ' + MEAN.toFixed(1) + ' students')" },
      ],
      focus: { js: ".style('cursor', 'pointer')" },
      solution: {
        js: `// Stage 7 · reference line + annotation
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ Sorting + sequential colormap
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ④ Value axis (drawn beneath the bars)
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑤ Bars
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑥ Value labels + category axis
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑦ Hover highlight + native tooltips
bars.selectAll('rect.bar')
  .style('cursor', 'pointer')
  .on('mouseover', function () {
    d3.select(this).style('stroke', 'var(--ink)').style('stroke-width', 2);
  })
  .on('mouseout', function () {
    d3.select(this).style('stroke', 'none').style('stroke-width', 0);
  });

bars.selectAll('rect.bar')
  .append('title')
  .text(d => d.major + ': ' + d.count + ' students');

// ⑧ Reference line: the mean
const MEAN = d3.mean(DATA, d => d.count);

svg.append('line')
  .attr('class', 'guide')
  .attr('x1', PAD.l)
  .attr('x2', W - PAD.r)
  .attr('y1', y(MEAN))
  .attr('y2', y(MEAN))
  .style('stroke', 'var(--ch-6)')
  .style('stroke-width', 1.5)
  .style('stroke-dasharray', '5 4');

svg.append('text')
  .attr('class', 'annotation')
  .attr('x', W - PAD.r)
  .attr('y', y(MEAN) - 6)
  .attr('text-anchor', 'end')
  .style('fill', 'var(--ch-6)')
  .style('font-size', '12px')
  .text('Mean ' + MEAN.toFixed(1) + ' students');
`,
      },
    },

    /* =====================================================
     * Stage 8 —— self-check and export
     * =================================================== */
    {
      id: 's8-finish',
      title: 'Stage 8 · Self-check and export',
      subtitle: 'Add a title, run every checkpoint once more, then export the chart as a .svg that opens on double-click.',
      task: [
        "Give the chart a title: append('text').attr('class', 'chart-title') reading “New Students by Major (Class of 2025)”",
        'Set the title in bold (font-weight 700) and place it in the top-left corner (x = PAD.l, y ≈ 20)',
        'Self-check from top to bottom: 1 canvas, 5 bars, 1 y axis, 1 reference line, 1 title',
        'Click “⬇ Export SVG” in the top right to save the result, then double-click the file in the browser to see if it opens correctly',
      ],
      hints: [
        'The title is an ordinary text element, written like a value label, except it needs no data binding.',
        'The self-check simply re-runs the checkpoints of all 8 stages together — clicking “✅ Check this stage” verifies them at once.',
        'What gets exported is "the SVG actually rendered in the preview", so scripts and interactions survive — but not the HTML shell.',
      ],
      syntax: [
        { code: ".style('font-weight', 700)", note: 'Numeric weight 700 ≈ bold; more precise than the string form "bold"' },
        { code: ".attr('class', 'chart-title')", note: 'Give elements stable class names — easier to locate when exporting or re-editing' },
        { code: 'new XMLSerializer().serializeToString(svg)', note: 'Turns the DOM’s SVG into a string that can be written to a file (exactly what the workbench’s export button does)' },
        { code: 'd3.mean(DATA, d => d.count).toFixed(1)', note: 'toFixed(1) keeps one decimal, so the note never shows 22.400000000000002' },
      ],
      checks: [
        { type: 'noError', label: 'The code runs without errors', hint: 'Before exporting, make sure the preview shows no red error.' },
        { type: 'exists', selector: 'svg text.chart-title', label: 'The chart has a title <text class="chart-title">', hint: "svg.append('text').attr('class', 'chart-title')" },
        { type: 'text', selector: 'text.chart-title', contains: ['Students'], label: 'The title says what the chart is about', hint: ".text('New Students by Major (Class of 2025)')" },
        { type: 'style', selector: 'text.chart-title', prop: 'font-weight', mode: 'min', min: 600, label: 'The title stands out from the tick labels (bold)', hint: ".style('font-weight', 700)" },
        { type: 'svgCount', n: 1, label: 'The page still has exactly 1 canvas (no duplicate append)', hint: 'Duplicate canvases would smuggle blank charts into the exported SVG.' },
        { type: 'count', selector: 'rect.bar', eq: 5, label: 'Exactly 5 bars (no more, no fewer)', hint: 'There are 5 data rows in total; extras usually mean the join used an array with duplicates.' },
        { type: 'exists', selector: 'svg g.axis-y', label: 'The value axis is still there', hint: 'Do not delete earlier code while wrapping up.' },
        { type: 'exists', selector: 'svg line.guide', label: 'The mean reference line is still there', hint: 'With the sorted data, line.guide should still land inside the chart.' },
        { type: 'atWidth', width: 375, label: 'At narrow width (375px) the canvas does not overflow horizontally', hint: 'Set only the width attribute on the svg; the sandbox style caps it with max-width: 100%.', checks: [
          { type: 'bbox', selector: 'svg.chart', dim: 'width', max: 400, label: 'At 375px the rendered svg width is ≤ 400px', hint: 'The svg’s width is a fixed attribute; max-width: 100% does the shrinking.' },
        ] },
      ],
      focus: { js: ".text('Mean ' + MEAN.toFixed(1) + ' students');" },
      solution: {
        js: `// Stage 8 · title + finishing touches (final chart)
const DATA = [
  { major: 'Software Engineering', count: 22 },
  { major: 'Data Science', count: 34 },
  { major: 'Computer Science', count: 18 },
  { major: 'Artificial Intelligence', count: 26 },
  { major: 'IoT Engineering', count: 12 },
];

const W = 480, H = 320;
const PAD = { t: 32, r: 24, b: 48, l: 48 };

// ① Canvas
const svg = d3.select('#stage')
  .append('svg')
  .attr('class', 'chart')
  .attr('viewBox', '0 0 ' + W + ' ' + H)
  .attr('width', W)
  .attr('height', H);

// ② Scales
const x = d3.scaleBand()
  .domain(DATA.map(d => d.major))
  .range([PAD.l, W - PAD.r])
  .paddingInner(0.24);

const y = d3.scaleLinear()
  .domain([0, d3.max(DATA, d => d.count)])
  .range([H - PAD.b, PAD.t]);

// ③ Sorting + sequential colormap
const SORTED = DATA.slice().sort((a, b) => b.count - a.count);
x.domain(SORTED.map(d => d.major));

const COLOR = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, d3.max(SORTED, d => d.count)]);

// ④ Value axis (drawn beneath the bars)
svg.append('g')
  .attr('class', 'axis axis-y')
  .attr('transform', 'translate(' + PAD.l + ',0)')
  .call(
    d3.axisLeft(y)
      .ticks(5)
      .tickSize(-(W - PAD.l - PAD.r))
  )
  .call(g => g.select('.domain').remove())
  .selectAll('line')
  .style('stroke', 'var(--line)');

svg.select('g.axis-y')
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑤ Bars
const bars = svg.append('g').attr('class', 'bars');

bars.selectAll('rect.bar')
  .data(SORTED)
  .join('rect')
  .attr('class', 'bar')
  .attr('x', d => x(d.major))
  .attr('y', d => y(d.count))
  .attr('width', x.bandwidth())
  .attr('height', d => y(0) - y(d.count))
  .style('fill', d => COLOR(d.count));

// ⑥ Value labels + category axis
svg.selectAll('text.bar-label')
  .data(SORTED)
  .join('text')
  .attr('class', 'bar-label')
  .attr('x', d => x(d.major) + x.bandwidth() / 2)
  .attr('y', d => y(d.count) - 6)
  .attr('text-anchor', 'middle')
  .style('fill', 'var(--ink)')
  .text(d => d.count);

svg.append('g')
  .attr('class', 'axis axis-x')
  .attr('transform', 'translate(0,' + (H - PAD.b) + ')')
  .call(d3.axisBottom(x).tickSizeOuter(0))
  .selectAll('text')
  .style('fill', 'var(--muted)');

// ⑦ Hover highlight + native tooltips
bars.selectAll('rect.bar')
  .style('cursor', 'pointer')
  .on('mouseover', function () {
    d3.select(this).style('stroke', 'var(--ink)').style('stroke-width', 2);
  })
  .on('mouseout', function () {
    d3.select(this).style('stroke', 'none').style('stroke-width', 0);
  });

bars.selectAll('rect.bar')
  .append('title')
  .text(d => d.major + ': ' + d.count + ' students');

// ⑧ Reference line + annotation
const MEAN = d3.mean(DATA, d => d.count);

svg.append('line')
  .attr('class', 'guide')
  .attr('x1', PAD.l)
  .attr('x2', W - PAD.r)
  .attr('y1', y(MEAN))
  .attr('y2', y(MEAN))
  .style('stroke', 'var(--ch-6)')
  .style('stroke-width', 1.5)
  .style('stroke-dasharray', '5 4');

svg.append('text')
  .attr('class', 'annotation')
  .attr('x', W - PAD.r)
  .attr('y', y(MEAN) - 6)
  .attr('text-anchor', 'end')
  .style('fill', 'var(--ch-6)')
  .style('font-size', '12px')
  .text('Mean ' + MEAN.toFixed(1) + ' students');

// ⑨ Chart title (finishing touch)
svg.append('text')
  .attr('class', 'chart-title')
  .attr('x', PAD.l)
  .attr('y', 20)
  .style('fill', 'var(--ink)')
  .style('font-size', '14px')
  .style('font-weight', 700)
  .text('New Students by Major (Class of 2025)');
`,
      },
    },
  ],
};
