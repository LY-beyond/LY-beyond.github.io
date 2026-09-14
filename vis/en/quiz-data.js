// =========================================================
// en/quiz-data.js —— Knowledge check · question bank (English)
// ---------------------------------------------------------
// 中文题库见 ../quiz-data.js。两份题库**逐题对齐**：
//   同一套 id、同一套 chapter、同一个答案下标 —— 只换语言。
//   这样中英两版抽题行为一致，也能被 quiz-check.mjs 自动比对。
//
// 刻意用「普通 script」而不是 ES Module，理由同中文版：
//   这样 file:// 直接双击打开也能答题。
//
// 数据结构：
//   window.QUIZ_BANK = {
//     choice: [ { id, chapter, topic, q, options: [], answer: Number, explain } ],
//     judge:  [ { id, chapter, topic, q, answer: Boolean, explain } ]
//   }
//   answer 一律存「下标 / 布尔值」，不写 'B'、'True' 这类字面量。
// =========================================================
window.QUIZ_BANK = {

  /* =======================================================
   * Multiple choice (30)
   * Chapters: 1×4  2×3  3×3  4×3  5×3  6×3  7×3  8×4  9×4
   * ===================================================== */
  choice: [

    /* ---------------- Chapter 1 ---------------- */
    {
      id: 'c-01', chapter: 1, topic: 'Alignment',
      q: 'Which statement best matches this course’s view of alignment?',
      options: [
        'As long as the font sizes match, it counts as aligned',
        'Related elements should sit on the same shared reference line, which creates a sense of order',
        'Alignment only matters for text; images and buttons need not be aligned',
        'The more elements there are, the more each should be centred on its own',
      ],
      answer: 1,
      explain: 'Alignment means giving related content a shared reference line (left edge, centre line, baseline). Images, icons and buttons take part in it too; centring everything separately usually just leaves the page loose and hard to read.'
    },
    {
      id: 'c-02', chapter: 1, topic: 'Proximity',
      q: 'What is the most direct way to apply the principle of proximity?',
      options: [
        'Put a border around every group',
        'Make the spacing inside a group clearly smaller than the spacing between groups',
        'Set every gap to exactly 16px',
        'Give each group its own colour',
      ],
      answer: 1,
      explain: 'Proximity uses distance to express belonging: spacing inside a group is smaller than between groups, so readers see the grouping without any label. Borders and colours are extras, not requirements.'
    },
    {
      id: 'c-03', chapter: 1, topic: 'Repetition & consistency',
      q: 'Which of these violates the principle of repetition and consistency?',
      options: [
        'All cards share the same corner radius and shadow',
        'One set of spacing steps is used across the whole site',
        'Every card uses a one-off corner radius, shadow and padding value',
        'Components of the same kind keep the same internal order',
      ],
      answer: 2,
      explain: 'What should repeat is the design decisions — radius, shadow, spacing, weight, component structure. Anywhere a one-off value is typed in is a place where consistency leaks away.'
    },
    {
      id: 'c-04', chapter: 1, topic: 'Visual balance',
      q: 'Which change adds the most visual weight to an element?',
      options: [
        'Making its colour paler',
        'Increasing its size and colour saturation',
        'Moving it into a corner of the page',
        'Reducing its font size by one step',
      ],
      answer: 1,
      explain: 'Visual weight comes mainly from size, colour depth and saturation, contrast and complexity. Paler or smaller always reduces weight; moving something to a corner only changes its position.'
    },

    /* ---------------- Chapter 2 ---------------- */
    {
      id: 'c-05', chapter: 2, topic: 'Goals & priority',
      q: 'Before drawing anything you ask “what is the goal and what comes first”. Which question is NOT needed?',
      options: [
        'What is the single most important thing on this page?',
        'What is the user’s main task and path?',
        'Which content should come first?',
        'What CPU does the server run?',
      ],
      answer: 3,
      explain: 'The first three decide what goes where — they are the inputs to layout. Server hardware is a backend topic and has nothing to do with visual layout.'
    },
    {
      id: 'c-06', chapter: 2, topic: 'Reading patterns',
      q: 'Which statement about the F-shaped reading pattern is correct?',
      options: [
        'It applies to image-heavy pages that contain almost no text',
        'It is typical of text-dense pages that users skim: the eye sweeps across, then down, tracing an F',
        'It means users read every single line in full',
        'It only happens on phones',
      ],
      answer: 1,
      explain: 'F (like Z and the Gutenberg diagram) describes skimming, not close reading. Important headings and buttons belong towards the top left, where the eye passes first.'
    },
    {
      id: 'c-07', chapter: 2, topic: 'Wireframes',
      q: 'What is a wireframe for?',
      options: [
        'Choosing the final colours and typefaces',
        'Fixing the structure and information hierarchy before any visual distraction',
        'Replacing HTML',
        'Only showing the client what the result will look like',
      ],
      answer: 1,
      explain: 'Structure first, skin later: a wireframe only asks how many blocks there are, how big each one is and which matters most. Add colour too early and the discussion drifts into details.'
    },

    /* ---------------- Chapter 3 ---------------- */
    {
      id: 'c-08', chapter: 3, topic: '12-column grid',
      q: 'Why is a 12-column grid so widely used?',
      options: [
        'Because 12 is an even number',
        'Because 12 divides by 1, 2, 3, 4, 6 and 12, so halves, thirds, quarters and two-thirds are all easy',
        'Because 12 is considered a lucky number',
        'Because 12 columns exactly equal the screen width',
      ],
      answer: 1,
      explain: '12 has many factors: 6+6, 4+4+4, 3×4, 8+4 and 9+3 all work out. You can cover most layouts without touching the grid — an engineering advantage, not a matter of taste.'
    },
    {
      id: 'c-09', chapter: 3, topic: 'Grid anatomy',
      q: 'What are the four parts of a grid system?',
      options: [
        'Container, columns, gutters, margins',
        'Rows, columns, pixels, percentages',
        'Container, rows, borders, shadows',
        'Columns, spacing, radius, typeface',
      ],
      answer: 0,
      explain: 'Container (maximum width, centred), columns (usually 12), gutters (the space between columns) and margins (the space between the container and the edge of the screen).'
    },
    {
      id: 'c-10', chapter: 3, topic: '8pt spacing',
      q: 'What does an “8pt spacing scale” actually mean in practice?',
      options: [
        'Every gap must be exactly 8px',
        'Spacing is taken from a fixed set of steps (such as 4 / 8 / 16 / 24 / 40) instead of random values',
        'Font sizes must be multiples of 8',
        'The total page height must be a multiple of 8',
      ],
      answer: 1,
      explain: 'The point is to have reusable steps, so neighbouring gaps keep a perceptible relationship — that is what makes the rhythm feel consistent. This project collects the steps in tokens.css (--space-*).'
    },

    /* ---------------- Chapter 4 ---------------- */
    {
      id: 'c-11', chapter: 4, topic: 'Holy grail',
      q: 'What is the classic shape of the holy grail layout?',
      options: [
        'Just a top band and a bottom band',
        'Header + footer + left and right sidebars + a main content column in the middle',
        'Nothing but a wall of cards',
        'Three exactly equal columns',
      ],
      answer: 1,
      explain: 'The holy grail (and its cousin, the double-wing) solve the two-sidebars-plus-main problem. Today grid-template-areas does it in a few lines.'
    },
    {
      id: 'c-12', chapter: 4, topic: 'Card wall',
      q: 'A card wall suits which kind of content best?',
      options: [
        'Long articles meant to be read in sequence',
        'Large amounts of similar, independent content browsed in parallel (a portfolio, products)',
        'A detail page holding a single record',
        'A financial report where numbers must line up row by row',
      ],
      answer: 1,
      explain: 'A card wall assumes the content can be flattened into equal-weight units: similar, independent, with no fixed reading order. Long articles have a strong sequence, and chopping them into cards breaks the reading.'
    },
    {
      id: 'c-13', chapter: 4, topic: 'Dashboard',
      q: 'What is the main difference between a dashboard grid and a card wall?',
      options: [
        'A dashboard uses Grid; a card wall can only use Flex',
        'Dashboard blocks differ in size and span, sized by importance',
        'A dashboard does not need alignment',
        'A card wall cannot be responsive',
      ],
      answer: 1,
      explain: 'A card wall aims for equal-weight repetition; a dashboard aims for clear hierarchy — the key metric takes a large cell spanning columns while secondary metrics take small ones. Spanning is how importance is expressed.'
    },

    /* ---------------- Chapter 5 ---------------- */
    {
      id: 'c-14', chapter: 5, topic: 'Box model',
      q: 'What is the order of the box model, from the inside out?',
      options: [
        'content → padding → border → margin',
        'margin → border → padding → content',
        'padding → content → margin → border',
        'content → margin → border → padding',
      ],
      answer: 0,
      explain: 'The content area is innermost, then padding, border and margin. Margin has no background of its own and cannot be given one.'
    },
    {
      id: 'c-15', chapter: 5, topic: 'box-sizing',
      q: 'What does box-sizing: border-box do?',
      options: [
        'Makes width cover the content area only',
        'Makes width / height include content + padding + border',
        'Removes margin automatically',
        'Takes the element out of normal flow',
      ],
      answer: 1,
      explain: 'With the default content-box, width covers only the content area, so padding and border make the box bigger. border-box measures out to the border, so boxes stop growing as you add padding — that is why this project sets * { box-sizing: border-box }.'
    },
    {
      id: 'c-16', chapter: 5, topic: 'Normal flow',
      q: 'Which statement about normal flow is correct?',
      options: [
        'Block-level elements stack from top to bottom; inline elements run left to right',
        'All elements flow from top to bottom',
        'Block-level elements sit side by side by default',
        'Normal flow has nothing to do with display',
      ],
      answer: 0,
      explain: 'Block boxes take a line each and stack vertically; inline boxes run along the baseline and wrap only when they run out of room. Flex and Grid change how a container lays out its children, not what normal flow is.'
    },

    /* ---------------- Chapter 6 ---------------- */
    {
      id: 'c-17', chapter: 6, topic: 'Main axis',
      q: 'Which property decides the direction of the flex main axis?',
      options: ['justify-content', 'flex-direction', 'align-items', 'flex-wrap'],
      answer: 1,
      explain: 'flex-direction sets the main axis (row, column and so on). justify-content distributes along it; align-items aligns on the cross axis. Fix the axis first, then talk about alignment.'
    },
    {
      id: 'c-18', chapter: 6, topic: 'Alignment & distribution',
      q: 'With the default flex-direction: row, which value spreads the items evenly with the first and last flush to the edges?',
      options: [
        'align-items: center',
        'justify-content: space-between',
        'justify-content: center',
        'align-content: space-between',
      ],
      answer: 1,
      explain: 'space-between puts all the leftover space between the items, so the first and last touch the edges. space-around leaves half a gap at each end; space-evenly makes every gap identical.'
    },
    {
      id: 'c-19', chapter: 6, topic: 'Flexible sizing',
      q: 'What does flex: 1 usually mean?',
      options: [
        'A fixed width of 1px',
        'flex-grow: 1, flex-shrink: 1 and flex-basis: 0 — share the leftover space in proportion',
        'Only one child is allowed',
        'Turn the element into a block box',
      ],
      answer: 1,
      explain: 'flex is shorthand for grow / shrink / basis. A basis of 0 ignores content width and shares the space from the same starting point, which is what produces an even split.'
    },

    /* ---------------- Chapter 7 ---------------- */
    {
      id: 'c-20', chapter: 7, topic: 'One vs two dimensions',
      q: 'What is the fundamental difference between Grid and Flexbox?',
      options: [
        'Grid can only make one column',
        'Grid is two-dimensional (rows and columns at once); Flexbox is one-dimensional (one axis at a time)',
        'Grid is not responsive',
        'Flexbox cannot centre anything',
      ],
      answer: 1,
      explain: 'A rule of thumb: one direction only (a nav bar, a toolbar, even distribution) → Flex; rows and columns that must line up with each other (a page skeleton, a card wall) → Grid.'
    },
    {
      id: 'c-21', chapter: 7, topic: 'auto-fit',
      q: 'What does grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) do?',
      options: [
        'Creates exactly 240 columns',
        'Lets the browser choose the column count from the container width, each at least 240px and able to stretch',
        'Creates a single column 240px wide',
        'Fixes every row height at 240px',
      ],
      answer: 1,
      explain: 'minmax gives each track a floor and a ceiling; auto-fit packs in as many as will fit. Wide screens get more columns, narrow ones fewer — with no media queries at all.'
    },
    {
      id: 'c-22', chapter: 7, topic: 'fr unit',
      q: 'What does 1fr mean inside a grid?',
      options: [
        'One pixel',
        'One share of the container’s leftover space, used for proportional distribution',
        'A multiple of the current font size',
        'A fixed row height',
      ],
      answer: 1,
      explain: 'fr is a fraction unit: fixed tracks and gaps are taken out first, then the rest is split by the fr counts — which is why 1fr 2fr is naturally a 1 : 2 ratio.'
    },

    /* ---------------- Chapter 8 ---------------- */
    {
      id: 'c-23', chapter: 8, topic: 'position',
      q: 'Which position values take an element out of normal flow?',
      options: ['static, relative', 'absolute, fixed', 'relative, sticky', 'static, sticky'],
      answer: 1,
      explain: 'absolute (relative to the nearest positioned ancestor) and fixed (relative to the viewport) both leave normal flow, so their original space is not kept. relative and sticky keep it.'
    },
    {
      id: 'c-24', chapter: 8, topic: 'Absolute child, relative parent',
      q: 'What does the rule “absolute child, relative parent” mean?',
      options: [
        'The child is relative and the parent is absolute',
        'The parent gets position: relative as the reference; the child is absolute and positions against it',
        'Both parent and child are fixed',
        'The parent stays static and the child is absolute',
      ],
      answer: 1,
      explain: 'absolute positions against the nearest ancestor whose position is not static. Leave the parent unpositioned and the child walks all the way up to the initial containing block — the classic “why is my element flying across the page” bug.'
    },
    {
      id: 'c-25', chapter: 8, topic: 'z-index',
      q: 'Which statement about z-index is WRONG?',
      options: [
        'z-index only takes effect once an element is positioned or forms a stacking context',
        'Within one stacking context, a larger z-index sits on top',
        'A static element with only z-index set usually does nothing',
        'z-index can only be a positive integer',
      ],
      answer: 3,
      explain: 'z-index may be negative (the element then sits behind its parent’s background). The real trap is the stacking context: comparing z-index values across different stacking contexts means nothing.'
    },
    {
      id: 'c-26', chapter: 8, topic: 'Media queries',
      q: 'What does @media (min-width: 768px) mean?',
      options: [
        'Applies only when the viewport is narrower than 768px',
        'Applies when the viewport is 768px wide or wider',
        'Applies only when the viewport is exactly 768px',
        'Applies only when printing',
      ],
      answer: 1,
      explain: 'min-width means “from this step upwards”, which pairs with mobile-first enhancement. max-width means “from this step downwards”, the usual desktop-first approach.'
    },

    /* ---------------- Chapter 9 ---------------- */
    {
      id: 'c-27', chapter: 9, topic: 'Mobile first',
      q: 'Which is the correct mobile-first approach?',
      options: [
        'Write the desktop styles first, then override with max-width media queries',
        'Write the small-screen base styles first, then enhance upwards with min-width media queries',
        'Only write phone styles and ignore larger screens',
        'Detect the device with JavaScript and load a different CSS file',
      ],
      answer: 1,
      explain: 'Mobile first means the base styles target the smallest screen (no media query), then min-width steps add to them. Styles accumulate instead of overriding each other, so nothing breaks by surprise.'
    },
    {
      id: 'c-28', chapter: 9, topic: 'Hero section',
      q: 'In the portfolio case, what is the hero section for?',
      options: [
        'Listing every piece of work',
        'Saying who I am and what I can do in one line, with a clear visual hierarchy',
        'Holding the longest paragraph of self-introduction',
        'Showing the contact details from the footer',
      ],
      answer: 1,
      explain: 'The hero does one job: within a few seconds a visitor should know who you are and what you offer, with one clear entry point (such as “see the work”). It carries the highest visual weight on the page.'
    },
    {
      id: 'c-29', chapter: 9, topic: 'Two-column ratio',
      q: 'Why does the “about me” section use two columns that are not 1:1?',
      options: [
        'Two columns always look better than one',
        'The two parts carry different weight, so the grid ratio is used to give the text more room',
        '1:1 is impossible with Grid',
        'Two columns shorten the text',
      ],
      answer: 1,
      explain: 'The ratio is the hierarchy. Text-led content often uses 7:5 or 8:4 with the image as support; equal columns erase the hierarchy and leave the reader unsure where to look first.'
    },
    {
      id: 'c-30', chapter: 9, topic: 'Design checklist',
      q: 'What does the first item of the Chapter 9 design checklist check?',
      options: [
        'The page loading speed',
        'Whether every element lines up on the same set of edges',
        'Whether more than three typefaces are in use',
        'Whether the code is short enough',
      ],
      answer: 1,
      explain: 'The checklist runs from skeleton to detail: alignment first, then proximity (inside a group < between groups), then hierarchy, consistency, balance, spacing steps and finally small-screen readability.'
    },

  ],

  /* =======================================================
   * True / false (20)
   * Chapters: 1×2  2×2  3×2  4×2  5×2  6×2  7×2  8×3  9×3
   * answer is a boolean: true = the statement is correct
   * ===================================================== */
  judge: [

    /* ---------------- Chapter 1 ---------------- */
    {
      id: 'j-01', chapter: 1, topic: 'Alignment',
      q: 'Alignment only applies to text; images and buttons do not need to be aligned.',
      answer: false,
      explain: 'Alignment applies to every visible element. Images, icons and buttons need their edges on the reference lines too, or the page looks loose and unplanned.'
    },
    {
      id: 'j-02', chapter: 1, topic: 'Proximity',
      q: 'The spacing inside a group should be smaller than the spacing between groups — that is the principle of proximity.',
      answer: true,
      explain: 'That is exactly the test for proximity: inside a group < between groups. Distance is itself a grouping device, lighter and airier than adding borders.'
    },

    /* ---------------- Chapter 2 ---------------- */
    {
      id: 'j-03', chapter: 2, topic: 'Wireframes',
      q: 'By the wireframe stage the final colour scheme and all image assets should already be settled.',
      answer: false,
      explain: 'A wireframe deliberately has no colour and no images: it only carries structure and hierarchy. Bring visual detail in too early and the discussion follows the colours instead of the layout.'
    },
    {
      id: 'j-04', chapter: 2, topic: 'Reading patterns',
      q: 'The F-shaped reading pattern means users skim only the first few lines, so important content belongs towards the top left.',
      answer: true,
      explain: 'Skimming concentrates attention on the first horizontal band (top-left to top-right) and on the vertical scan down the left side. Put key information and entry points there.'
    },

    /* ---------------- Chapter 3 ---------------- */
    {
      id: 'j-05', chapter: 3, topic: 'Grid anatomy',
      q: 'A gutter is the space between two columns of a grid.',
      answer: true,
      explain: 'The gutter is the column gap. It usually follows the same spacing steps as everything else, which keeps the whole site consistent.'
    },
    {
      id: 'j-06', chapter: 3, topic: '8pt spacing',
      q: 'Spacing can be any value such as 13px or 27px; as long as it looks fine, the overall rhythm is unaffected.',
      answer: false,
      explain: 'Arbitrary values wreck the rhythm: once the relationship between neighbouring gaps is gone, the page reads as random and is hard to unify. Spacing should come from one set of steps.'
    },

    /* ---------------- Chapter 4 ---------------- */
    {
      id: 'j-07', chapter: 4, topic: 'Holy grail',
      q: 'The holy grail layout is typically a header and footer plus left and right sidebars with the main content in the middle.',
      answer: true,
      explain: 'The classic three-column shell with a header and footer; today grid-template-areas or Grid columns do it in a handful of lines.'
    },
    {
      id: 'j-08', chapter: 4, topic: 'Card wall',
      q: 'A card wall suits large amounts of similar, independent content.',
      answer: true,
      explain: 'A card wall flattens content into equal-weight units and relies on repetition for order, so it needs content that is similar and has no fixed reading order.'
    },

    /* ---------------- Chapter 5 ---------------- */
    {
      id: 'j-09', chapter: 5, topic: 'box-sizing',
      q: 'With box-sizing: content-box (the default), an element with width: 200px, padding: 20px and border: 5px actually occupies 250px of width.',
      answer: true,
      explain: '200 + 20×2 + 5×2 = 250px. This is exactly why content-box boxes keep growing, and why border-box is the usual global choice.'
    },
    {
      id: 'j-10', chapter: 5, topic: 'Normal flow',
      q: 'By default an inline element such as span takes a whole line unless display is changed.',
      answer: false,
      explain: 'Taking a whole line is block behaviour. Inline elements run along the baseline and wrap only when they run out of room.'
    },

    /* ---------------- Chapter 6 ---------------- */
    {
      id: 'j-11', chapter: 6, topic: 'Alignment & distribution',
      q: 'In Flexbox, justify-content handles alignment and distribution on the main axis while align-items handles the cross axis.',
      answer: true,
      explain: 'Remember “j for the main axis, a for the cross axis”; flex-direction decides which way the main axis points.'
    },
    {
      id: 'j-12', chapter: 6, topic: 'Flexible sizing',
      q: 'With everything else left at its default, setting flex: 1 on the children splits the container space evenly between them.',
      answer: true,
      explain: 'flex: 1 sets flex-basis to 0, so the children start from the same place and share the space by flex-grow — an even split.'
    },

    /* ---------------- Chapter 7 ---------------- */
    {
      id: 'j-13', chapter: 7, topic: 'One vs two dimensions',
      q: 'Grid is two-dimensional and controls rows and columns at once; Flexbox is one-dimensional and handles a single axis at a time.',
      answer: true,
      explain: 'That is the first question when choosing: rows and columns that must line up → Grid; a single direction → Flex.'
    },
    {
      id: 'j-14', chapter: 7, topic: 'fr unit',
      q: 'The fr unit in Grid is a multiple of the element’s font size.',
      answer: false,
      explain: 'fr is a fraction of the leftover grid space and has nothing to do with font size; em and rem are the font-relative units.'
    },

    /* ---------------- Chapter 8 ---------------- */
    {
      id: 'j-15', chapter: 8, topic: 'position',
      q: 'An element with position: fixed is positioned against its nearest positioned ancestor.',
      answer: false,
      explain: 'fixed is always positioned against the browser viewport and ignores its ancestors. Positioning against the nearest positioned ancestor is what absolute does.'
    },
    {
      id: 'j-16', chapter: 8, topic: 'Offsets',
      q: 'After a relative element is offset, the space it used to occupy is taken over by later elements.',
      answer: false,
      explain: 'relative stays in normal flow, so its original space is kept — which is why the element appears to move visually while the layout does not. absolute and fixed are the ones that free their space.'
    },
    {
      id: 'j-17', chapter: 8, topic: 'z-index',
      q: 'A larger z-index always means the element is displayed on top.',
      answer: false,
      explain: 'Comparing z-index only works within the same stacking context. Once a parent forms a stacking context, a child cannot escape above it however large its z-index is.'
    },

    /* ---------------- Chapter 9 ---------------- */
    {
      id: 'j-18', chapter: 9, topic: 'Mobile first',
      q: 'Mobile first means writing the small-screen base styles first and enhancing larger screens with min-width media queries.',
      answer: true,
      explain: 'The base styles serve the smallest screen and the media queries only enhance, so large-screen styles can never be overridden by small-screen ones — and there is less code.'
    },
    {
      id: 'j-19', chapter: 9, topic: 'Card wall',
      q: 'In the case study, auto-fit together with minmax adapts the card wall column count without a media query per breakpoint.',
      answer: true,
      explain: 'That is the usage from 7.2: as the container narrows, fewer columns fit, and a wide screen fits more. The portal’s own .cards class works exactly this way.'
    },
    {
      id: 'j-20', chapter: 9, topic: 'Design checklist',
      q: 'Once the design is finished you only need to check the colours; layout and alignment do not need a second look.',
      answer: false,
      explain: 'The Chapter 9 checklist goes through everything: alignment, proximity, hierarchy, consistency, balance, spacing steps and small-screen readability. Colour is only one part of it.'
    }

  ]

};
