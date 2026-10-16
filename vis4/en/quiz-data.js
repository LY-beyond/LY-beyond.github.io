// =========================================================
// quiz-data.js —— Chapter quiz question bank (English)
// ---------------------------------------------------------
// Structure contract (read the same way by ../quiz.js and ../quiz-check.mjs):
//   window.QUIZ_BANK = {
//     choice: [{ id, chapter, topic, q, options:[...], answer:<index>, explain }],
//     judge:  [{ id, chapter, topic, q, answer:<Boolean>, explain }],
//   }
//   · chapter: 1–5 = the five chapters; 6 = the "Chart Guide" special topic
//   · choice.answer stores only the option index; judge.answer stores
//     true / false, so option shuffling can recompute indexes reliably
//   · ids are globally unique; every question carries a topic tag
//
// Mirrors the Chinese bank item for item — same ids, order, chapters,
// answers and option counts — verified automatically by quiz-check.mjs.
// Code snippets and identifiers (d3.csv, flatMap, R², Viridis …) are
// kept verbatim; everything else is translated.
//
// Plain script (not an ES Module) so it also loads over file://.
// =========================================================
window.QUIZ_BANK = {
  /* =======================================================
   * 26 multiple-choice questions (c-01 … c-26)
   * ===================================================== */
  choice: [
    /* ---------- Chapter 1 Data · Attributes & Channels (5) ---------- */
    {
      id: 'c-01', chapter: 1, topic: 'Four dimensions of data trustworthiness',
      q: 'About the four dimensions of "data trustworthiness", which of the following statements is correct?',
      options: [
        'Consistency means whether the data comes from an authoritative source',
        'Accuracy means whether the data faithfully reflects the real-world object; synthetic data often falls short on accuracy',
        'Completeness means the data must be collected within a single day',
        'Timeliness means the data must never be updated'
      ],
      answer: 1,
      explain: 'Accuracy = whether it faithfully reflects the real-world object (simulated / synthetic data distorts most easily on this dimension); completeness = whether fields and records are all present; consistency = whether the same concept is measured the same way everywhere; timeliness = whether it is fresh enough. Mistaking consistency for "authoritative source", equating completeness with "collected in one day", or describing timeliness as "never updated" all scramble the four dimensions.'
    },
    {
      id: 'c-02', chapter: 1, topic: 'd3.csv row callback',
      q: 'In d3.csv(url, row => …), what problem does the second argument (the per-row callback) mainly solve?',
      options: [
        'It makes parsing finish synchronously, so you no longer need to await',
        'It cleans and converts fields row by row while reading (e.g. trim, unary + for numbers), saving a full pass',
        'It automatically converts wide format to long format',
        'It automatically fills in missing columns'
      ],
      answer: 1,
      explain: 'rowCallback runs as each row is parsed, so trimming and type conversion can happen in place during the read phase; but it cannot turn async into sync — d3.csv still returns a Promise and must be awaited. Wide-to-long is flatMap\'s job, and filling missing columns is not its responsibility either.'
    },
    {
      id: 'c-03', chapter: 1, topic: 'DIKW pyramid',
      q: 'According to the DIKW pyramid, which transformation is the main battleground of data visualization?',
      options: [
        'Data → Information: organizing raw data into meaningful, comparable information',
        'Information → Knowledge',
        'Knowledge → Wisdom',
        'Wisdom → Data'
      ],
      answer: 0,
      explain: 'The DIKW chain is Data → Information → Knowledge → Wisdom, and visualization\'s core contribution is organizing Data into Information (comparisons and patterns the human eye can read); Knowledge and Wisdom rely more on domain reasoning and experience. Rowley (2007) also cautions that the four layers are not strictly linear.'
    },
    {
      id: 'c-04', chapter: 1, topic: 'Stevens\' scales of measurement',
      q: 'Which of the following variables is on an interval scale rather than a ratio scale?',
      options: [
        'Height (cm)',
        'Mass (kg)',
        'Celsius temperature (°C)',
        'Annual income (yuan)'
      ],
      answer: 2,
      explain: 'An interval scale has equal units but no true zero — 0°C does not mean "no temperature", so you cannot claim 20°C is twice as hot as 10°C. Height, mass and income all have a true zero and are ratio scales, where multiples make sense. This directly determines whether a chart may draw a zero baseline and proportional encoding.'
    },
    {
      id: 'c-05', chapter: 1, topic: 'Visual channel tiers',
      q: 'According to this course\'s classification of visual channels, which group is entirely suited to encoding quantitative data?',
      options: [
        'Hue, shape',
        'Luminance, saturation',
        'Position, length',
        'Density, hue'
      ],
      answer: 2,
      explain: 'Quantitative channels are position, length and angle (area works too but with low precision); luminance, density and saturation are ordered channels; hue and shape are categorical. The other options all mix in ordered or categorical channels, which makes numbers visible but not accurately readable.'
    },

    /* ---------- Chapter 2 Process · Data Flow & Automation (5) ---------- */
    {
      id: 'c-06', chapter: 2, topic: 'Card\'s data-flow model',
      q: 'In Card\'s (1999) data-flow model, which chain does a complete visualization usually go through?',
      options: [
        'Raw data → data table → visual structure → view (D → T → V)',
        'View → data table → raw data → visual structure',
        'Data table → raw data → view → visual structure',
        'Visual structure → view → data table → raw data'
      ],
      answer: 0,
      explain: 'Card\'s model is "raw data → data table (cleaning / transformation) → visual structure (encoding mapping) → view (rendering)", i.e. D → T → V, followed by detail steps such as C / L / S. The other options reverse the direction — that amounts to drawing first and thinking about the data later.'
    },
    {
      id: 'c-07', chapter: 2, topic: 'Mackinlay\'s automation criteria',
      q: 'What is the core claim of Mackinlay (1986) about automating the design of presentations?',
      options: [
        'Chart type must be chosen manually by the user; the system should not interfere',
        'The system can decide mappings automatically from the data type (e.g. position for numbers, hue for categories), so visualizations can be generated automatically',
        'With enough colors, any data can be visualized automatically',
        'Automation harms data accuracy and should be banned entirely'
      ],
      answer: 1,
      explain: 'He proposed the expressiveness + effectiveness criteria, letting mappings be decided automatically: position / length for quantitative data, hue for categories. He neither advocates banning automation nor wins by "having many colors" — color count cannot fix a mismatched encoding type.'
    },
    {
      id: 'c-08', chapter: 2, topic: 'van Wijk\'s feedback model',
      q: 'What is the core loop emphasized by van Wijk\'s (2005) model of visualization?',
      options: [
        'A single one-way path from view to data',
        'Multi-directional feedback among View ⇆ Filter ⇆ Param ⇆ Other Views',
        'A pure computation loop of data → data → data',
        'A social loop of user → author → user'
      ],
      answer: 1,
      explain: 'van Wijk sees visualization as a multi-directional feedback loop — view ⇆ filter ⇆ parameters ⇆ other views — where the user can step in at any stage. It stacks with Card\'s data flow and Mackinlay\'s automation criteria without conflict: three complementary perspectives.'
    },
    {
      id: 'c-09', chapter: 2, topic: 'Four data-transformation operations',
      q: 'This course groups data transformation into four operations; which of the following is NOT one of them?',
      options: [
        'Cleaning',
        'Aggregation',
        'Joining',
        'Rendering'
      ],
      answer: 3,
      explain: 'The four transformations are cleaning, aggregation, joining and derivation (derive); "rendering" paints an already-decided visual structure onto the screen — the end of the pipeline, not a data transformation.'
    },    {
      id: 'c-10', chapter: 2, topic: 'd3.rollup return value',
      q: 'What does d3.rollup(data, reducer, d => key(d)) return?',
      options: [
        'A plain array',
        'A Map (a nested Map if several key functions are given)',
        'A DOM selection',
        'A Promise'
      ],
      answer: 1,
      explain: 'rollup returns a Map (group key → reducer result); with several key functions it returns nested Maps. To draw you must first spread it with [...map]. It returns neither an array, a selection, nor a Promise — the counterpart of d3.group, which keeps the raw members of each group.'
    },
    /* ---------- Chapter 3 Color · Color Spaces & Colormaps (4) ---------- */
    {
      id: 'c-11', chapter: 3, topic: 'Color spaces and Lab interpolation',
      q: 'When designing a colormap, in which color space should you interpolate to get smoother, perceptually uniform transitions?',
      options: [
        'RGB (additive / device-dependent)',
        'HSL',
        'CIE Lab (perceptually uniform)',
        'CMYK (subtractive / print)'
      ],
      answer: 2,
      explain: 'CIE Lab is perceptually uniform: d3.interpolateLab transitions more smoothly than interpolateRgb and does not sprout a jarring gray band in the middle. RGB / HSL / CMYK are not perceptually uniform interpolation spaces — equal numeric steps are not equal visual steps.'
    },
    {
      id: 'c-12', chapter: 3, topic: 'Color-vision deficiency (CVD)',
      q: 'About color-vision deficiency (CVD), which of the following statements is correct?',
      options: [
        'CVD affects only women, at a very low rate, and can be ignored',
        'About 8% of men have CVD, with red-blindness and green-blindness the most common',
        'Blue-blindness (tritanopia) is the most common type',
        'As long as colors are vivid enough, users with CVD can always tell them apart'
      ],
      answer: 1,
      explain: 'About 8% of men have CVD (about 0.5% of women); red / green deficiencies are the most common (green-blindness about 6%), and blue-blindness is the rarest. "Vivid enough" cannot compensate for a confused hue channel — the right fix is redundant encoding with a second channel such as luminance or shape.'
    },
    {
      id: 'c-13', chapter: 3, topic: 'Three colormap families',
      q: 'To encode "deviation from 0 (positive or negative)" as color, which colormap family should you choose?',
      options: [
        'Qualitative',
        'Sequential',
        'Diverging, with a true midpoint at 0',
        'Rainbow (Rainbow / Jet)'
      ],
      answer: 2,
      explain: 'Data with a true midpoint (signed deviations) calls for a diverging colormap: different colors at the two ends and a neutral midpoint, so readers see at a glance whether the deviation is positive or negative and how large. Sequential suits monotonic quantities, qualitative suits unordered categories, and rainbow scales are simply banned.'
    },
    {
      id: 'c-14', chapter: 3, topic: 'Five color-scheme rules',
      q: 'Under the course\'s five color-scheme rules, a pairing whose hues differ by about 180° belongs to which scheme?',
      options: [
        'Monochromatic',
        'Analogous',
        'Split-complementary',
        'Complementary'
      ],
      answer: 3,
      explain: 'The five stops on the hue wheel: monochromatic 0°, analogous 30°, triadic 120°, split-complementary 150°, complementary 180°. Complementary contrast is the strongest, but large side-by-side areas fatigue the eye, so neutrals usually serve as a buffer.'
    },

    /* ---------- Chapter 4 Low-dimensional · Parallel Coordinates & Scatterplot Matrices (4) ---------- */
    {
      id: 'c-15', chapter: 4, topic: 'Wide vs long format',
      q: 'After converting a wide table (50 states × 12 columns) to long format with flatMap, what usually happens to the row count, and why is it worth it?',
      options: [
        'The row count is unchanged; only the column names change',
        '50 rows → 150 rows (several variable columns are unfolded into observation records); more rows buy a tidy structure that can be grouped and mapped',
        'Fewer rows, because duplicates are removed',
        'Long format is just another layout, unrelated to later analysis'
      ],
      answer: 1,
      explain: 'Wide-to-long unfolds "one column per variable" into "one row per observation": the row count grows but the structure becomes tidy, giving d3.autoType, grouping and parallel coordinates uniform fields to read. It is neither deduplication nor meaningless re-layout — the structure decides whether later mapping can proceed smoothly.'
    },
    {
      id: 'c-16', chapter: 4, topic: 'Parallel-coordinates normalization',
      q: 'In a parallel-coordinates plot, why must every axis be normalized (given its own scale) before drawing?',
      options: [
        'Because without normalization the pixel coordinates cannot be computed',
        'Because axes have different units; only after normalization can relative positions be compared across axes on screen — at the cost of not being able to compare absolute values across axes',
        'Normalization makes all axes equal in absolute value',
        'D3 forces parallel coordinates to be normalized'
      ],
      answer: 1,
      explain: 'Axes differ in units and range (e.g. population vs crime rate); scaling each to the same height is what lets polyline shapes be compared side by side. The cost: across axes only relative positions can be read — you cannot take one line\'s heights on different axes and compare absolute values.'
    },
    {
      id: 'c-17', chapter: 4, topic: 'Coefficient of determination R²',
      q: 'About the coefficient of determination R², which statement is correct?',
      options: [
        'R² always falls between 0 and 1',
        'R² = 1 − SSres/SStot and can be negative; it is only meaningful to compare values on the same dataset, and more complex models inflate it',
        'A larger R² always means a better model, regardless of the data',
        'R² is defined only when the scatterplot shows positive correlation'
      ],
      answer: 1,
      explain: 'R² = 1 − SSres/SStot; it can go negative when the fit is worse than "just predicting the mean"; comparisons are valid only within one dataset; added model complexity (more parameters) inflates R², so other criteria must be considered as well.'
    },
    {
      id: 'c-18', chapter: 4, topic: 'Cleveland\'s slope estimation',
      q: 'What did Cleveland\'s (1984) experiment conclude about how humans estimate slopes?',
      options: [
        'Every angle is estimated equally accurately',
        'Errors are largest at horizontal (0°) and vertical (90°), best at 45°, with a stable zone of roughly 30°–60°',
        'The closer to 90°, the more accurate',
        'Angle does not matter; only line length does'
      ],
      answer: 1,
      explain: 'Slope-estimation error is U-shaped: largest at 0° and 90°, best at 45°, relatively stable across 30°–60°. That is exactly the rationale for re-plotting steep curves on log axes to pull the steepness back toward 45° — keeping lines in the angle range the eye judges best.'
    },
    /* ---------- Chapter 5 Temporal · Calendar Heatmaps & Spirals (4) ---------- */
    {
      id: 'c-19', chapter: 5, topic: 'Five temporal attributes',
      q: 'The description "from 08:00 to 12:00, 4 hours in total" corresponds to which of the 5 temporal attributes?',
      options: [
        'Instant',
        'Interval',
        'Span',
        'Cycle'
      ],
      answer: 1,
      explain: 'An interval is the difference between two instants (a duration); an instant is a single point in time; a span is one continuous stretch of coverage (a season, a term in office); a cycle returns to its start and can repeat. Which attribute you ask with decides whether to draw points, brackets, bands or loops.'
    },
    {
      id: 'c-20', chapter: 5, topic: 'Aggregation scale and line charts',
      q: 'After aggregating a 366-day daily temperature series by week and drawing a line chart, what changes most directly?',
      options: [
        'More points, revealing more detail',
        'Fewer points, day-to-day noise smoothed and the trend clearer — but within-week detail is erased',
        'The amount of data is unchanged; only the ordering changes',
        'The time axis changes from a linear domain to a cyclic one'
      ],
      answer: 1,
      explain: 'Aggregation trades detail for clarity: 366 points fold into about 53, noise is averaged out and the trend stands out, at the cost of losing per-day differences within each week. It does not turn the time domain cyclic — that is the spiral chart\'s job (5.4).'
    },
    {
      id: 'c-21', chapter: 5, topic: 'van Wijk\'s calendar heatmap',
      q: 'What are the coordinate conventions of van Wijk\'s (2008) calendar heatmap, and which tasks suit it?',
      options: [
        'x = value, y = time; suits arbitrary scatterplots',
        'x = week of year, y = day of week, color = value; suits "long series + periodicity + anomaly detection"',
        'x = weekday, y = month, area = value; suits composition analysis',
        'x = angle, y = radius; suits periodicity'
      ],
      answer: 1,
      explain: 'A calendar heatmap is "week columns × weekday rows × color". It answers "how things vary by season / weekday", complementing the line chart\'s "how things vary over time"; the colormap should be sequential, because temperature is ordered.'
    },
    {
      id: 'c-22', chapter: 5, topic: 'Spiral dynamic Δθ',
      q: 'In the Archimedean spiral, why use a dynamic angular increment (bin width / √(b² + r²)) instead of a fixed Δθ?',
      options: [
        'Because a fixed Δθ cannot compute the polar x and y',
        'Because the larger the radius, the longer the arc per unit angle; only by shrinking Δθ dynamically can every cell\'s arc length stay roughly equal',
        'Because it makes the spiral stop exactly on whole turns, aligning months',
        'Because a dynamic Δθ completes the color mapping automatically'
      ],
      answer: 1,
      explain: 'Arc length ≈ r · Δθ, so the larger the radius the longer the arc. Letting Δθ shrink inversely with r keeps each cell\'s arc length near the bin width, so inner and outer rings look consistent. The cost: one "turn" no longer equals exactly 2π — periods must be read from turn indexes, not from angles.'
    },

    /* ---------- Chapter 6 Special Topic · Chart Guide (4) ---------- */
    {
      id: 'c-23', chapter: 6, topic: 'Chart-choice decision-tree order',
      q: 'What is the correct order of the course\'s chart-choice decision tree?',
      options: [
        'Chart → data → task',
        'Task → data → chart: first ask what you want to do, then look at the data, and only then pick the chart',
        'Data → chart → task',
        'Color → chart → data'
      ],
      answer: 1,
      explain: 'First clarify the task (comparison / distribution / relationship / change over time / composition), then the data type and size, and only then pick the chart. Reverse the order and you end up forcing data into a chart type simply because you like it — the tail wagging the dog.'
    },
    {
      id: 'c-24', chapter: 6, topic: 'Channel readability ranking',
      q: 'Which ranking of channel readability best matches the course\'s view?',
      options: [
        'Volume > area > angle > position',
        'Position / length > angle > area > color luminance > volume',
        'Color luminance > position > volume > angle',
        'All channels are roughly equal in readability'
      ],
      answer: 1,
      explain: 'Length and position are judged most precisely, angle next, area worse, color luminance worse still, and volume worst. For precise comparison prefer position / length, and avoid encoding one-dimensional magnitude as area or volume.'
    },
    {
      id: 'c-25', chapter: 6, topic: 'Four chart misuses',
      q: 'Which of the following is NOT one of the four common chart misuses listed in the course?',
      options: [
        'Using angle for precise comparison (e.g. comparing adjacent small pie slices)',
        'Truncating the value axis to make differences look more dramatic',
        'Encoding one-dimensional magnitude as area',
        'Adding a legend to the chart and labeling the units'
      ],
      answer: 3,
      explain: 'Adding legends and labeling units is correct practice. The four misuses are: using angle for precise comparison, truncating the value axis, encoding one-dimensional magnitude as area, and using rainbow scales — the first two amplify or distort differences, the last two mismatch the encoding type with the nature of the data.'
    },
    {
      id: 'c-26', chapter: 6, topic: 'Five task types and the quick-reference matrix',
      q: 'To show "how parts make up a whole", which chart family does the course\'s quick-reference matrix recommend?',
      options: [
        'Simply stacking up multiple pie charts',
        'Stacked bar charts / percentage stacked area charts / treemaps (use pies sparingly beyond 4–5 categories)',
        'Scatterplots only',
        'Line charts only'
      ],
      answer: 1,
      explain: 'Composition tasks favor encodings where length / position / area can be compared: stacked bar charts, percentage stacked area charts, treemaps and so on. With many categories, pie angles become hard to distinguish, and small shares are usually merged into "Other".'
    }
  ],

  /* =======================================================
   * 18 true/false questions (j-01 … j-18), 9 true and 9 false
   * ===================================================== */
  judge: [
    /* ---------- Chapter 1 (3) ---------- */
    {
      id: 'j-01', chapter: 1, topic: 'group vs rollup',
      q: 'Both d3.group and d3.rollup can group data; the difference is that group keeps each group\'s raw records, while rollup aggregates each group down to a single result value.',
      answer: true,
      explain: 'Correct. group returns "group key → array of that group\'s raw members", while rollup returns "group key → reducer result", discarding the individuals. Keep detail with group; get summaries with rollup.'
    },
    {
      id: 'j-02', chapter: 1, topic: 'Data-Join three states',
      q: 'In the three states of Data-Join (enter / update / exit), the exit selection corresponds to the batch that "has data but no corresponding element yet".',
      answer: false,
      explain: 'That is reversed. enter is the "data without elements" batch that must be created; exit is the "leftover elements" batch that must be removed; update is the one-to-one batch updated in place. Mixing up the names means failing to delete what should go and failing to create what should exist.'
    },
    {
      id: 'j-03', chapter: 1, topic: 'scaleBand and scaleLinear',
      q: 'scaleBand suits allocating equal-width position bands to discrete categories, while scaleLinear suits mapping continuous numeric values.',
      answer: true,
      explain: 'Correct. scaleBand allocates band width to categories (with padding), the standard choice for a bar chart\'s x axis; scaleLinear handles continuous values (length, position). Laying out categories with scaleLinear is neither convenient nor correct.'
    },

    /* ---------- Chapter 2 (3) ---------- */
    {
      id: 'j-04', chapter: 2, topic: 'OLAP slice and drill-down',
      q: 'In OLAP, "slice" fixes the values of some dimensions and observes the remaining ones, while "drill-down" moves from a summary level into finer levels.',
      answer: true,
      explain: 'Correct. Slice = fixing the values of some dimensions; dice = taking ranges over multiple dimensions; drill-down = coarse to fine; roll-up = fine to coarse. Together they support viewing the same data across dimensions and granularities.'
    },
    {
      id: 'j-05', chapter: 2, topic: 'Reingold–Tilford traversal',
      q: 'The Reingold–Tilford tree layout completes in a single top-down traversal, with complexity O(n²).',
      answer: false,
      explain: 'It is three passes: bottom-up to measure subtree widths, top-down to assign coordinates, then threads (cross-subtree links); overall complexity is O(n). "One traversal + O(n²)" is wrong on both counts.'
    },
    {
      id: 'j-06', chapter: 2, topic: 'DOM event phases and delegation',
      q: 'Browser DOM events fire listeners during the capture phase by default, so event delegation only works if you explicitly pass useCapture = true.',
      answer: false,
      explain: 'The default is the bubbling phase (addEventListener\'s third argument defaults to false). Event delegation relies precisely on bubbling to hand child events to a parent container; useCapture = true is not needed. Capture runs outside-in, bubbling inside-out — opposite orders.'
    },    /* ---------- Chapter 3 (3) ---------- */
    {
      id: 'j-07', chapter: 3, topic: 'Gamut and out-of-gamut handling',
      q: 'On an sRGB display, colors outside the sRGB gamut make the browser throw an error and refuse to render.',
      answer: false,
      explain: 'No error is thrown; the value is silently clamped — out-of-gamut components are cut to the boundary, visually "the color changes without anyone telling you". Gamuts nest: sRGB ⊂ Adobe RGB ⊂ Rec.2020, and the excess can only be compressed.'
    },
    {
      id: 'j-08', chapter: 3, topic: 'WCAG contrast',
      q: 'WCAG\'s minimum contrast for body text is 4.5:1 at level AA, relaxed to 3:1 for large text, and 7:1 at level AAA.',
      answer: true,
      explain: 'Correct. Contrast = (L1 + 0.05) / (L2 + 0.05), where L is relative luminance. Body text AA 4.5:1, large text AA 3:1, AAA 7:1 — but hue difference governs whether colors can be told apart, while luminance difference governs whether text reads clearly.'
    },
    {
      id: 'j-09', chapter: 3, topic: 'Colormap type misuse',
      q: 'Using a diverging colormap (e.g. RdBu) for ordered data that has no midpoint is safe, because the colors look nice.',
      answer: false,
      explain: 'This invents a zero out of thin air, making readers believe the data has a real neutral benchmark somewhere. Conversely, plotting signed deviations with Viridis misreads dark purple as the zero point. Choosing the wrong colormap type is lying with color.'
    },

    /* ---------- Chapter 4 (3) ---------- */
    {
      id: 'j-10', chapter: 4, topic: 'True scales in scatterplot matrices',
      q: 'Every panel of a scatterplot matrix (SPLOM) should use the true data scale, not be normalized to fill its own frame.',
      answer: true,
      explain: 'Correct. Normalizing each panel to fill its frame hides unit differences between variables and manufactures false correlations. Only true scales let you compare across panels which variable pairs relate more strongly.'
    },
    {
      id: 'j-11', chapter: 4, topic: 'Marching Squares cases',
      q: 'Marching Squares has only 8 cases, because each cell only needs to distinguish 4 edges.',
      answer: false,
      explain: 'There are 16 cases — each of the four corners has two states (above / below threshold), 2⁴ = 16. The saddle cases (5 and 10) additionally need the cell-center value to decide the connection direction. Extended to 3D it becomes Marching Cubes, 2⁸ = 256.'
    },
    {
      id: 'j-12', chapter: 4, topic: 'Interpolation vs fitting',
      q: 'Interpolation requires the curve to pass through every data point and thus preserves noise, while fitting only captures the overall trend and does not need to pass through the points.',
      answer: true,
      explain: 'Correct. Interpolation passes through points and faithfully keeps noise; fitting seeks the trend and usually misses the points (e.g. a least-squares line). Mixing them up produces "smooth curves hiding real fluctuations" or "polylines forcing their way through noise".'
    },

    /* ---------- Chapter 5 (3) ---------- */
    {
      id: 'j-13', chapter: 5, topic: 'Month-divider algorithm',
      q: 'When deciding month dividers in a calendar heatmap, finding each month\'s first day one by one is simpler and less error-prone than "looking back 7 days to see whether the month changed".',
      answer: false,
      explain: 'It is the opposite. "Look back 7 days for the same month" needs a single O(n) scan and naturally covers 28 / 29 / 30 / 31-day months and leap years; hunting each month\'s first day means handling every month length and column crossing, which is easier to get wrong.'
    },
    {
      id: 'j-14', chapter: 5, topic: 'Storyline lifelines',
      q: 'In a Storyline timeline, a lifeline\'s y position expresses "how that character gathers with or parts from others" — lines converging mean meetings / conflict, diverging means separation.',
      answer: true,
      explain: 'Correct. Storyline uses y for relationships (not values). Three elements are indispensable: time-scale mapping, Catmull-Rom splines, and an event layer decoupled from the line layer — turning "who is with whom, when" into readable geometry.'
    },
    {
      id: 'j-15', chapter: 5, topic: 'Archimedean spiral r = a + bθ',
      q: 'In the Archimedean spiral r = a + bθ, setting b to 0 still yields a spiral.',
      answer: false,
      explain: 'With b = 0, r is constant at a and the spiral degenerates into an ordinary circle; the larger b is, the looser the turns and the more open the spiral. So b = 0 yields no spiral — which also shows that the circle is a special case of the spiral.'
    },

    /* ---------- Chapter 6 Special Topic (3) ---------- */
    {
      id: 'j-16', chapter: 6, topic: 'Task-to-chart mapping',
      q: 'For "change over time" tasks the line chart is usually the first choice, while for "relationship between two variables" tasks the scatterplot usually is.',
      answer: true,
      explain: 'Correct. The quick-reference matrix gives each of the five task types a first choice: comparison → bar / box plots; distribution → histogram / box plot / density; relationship → scatterplot / SPLOM; change over time → line / area; composition → stacked bars / treemap.'
    },
    {
      id: 'j-17', chapter: 6, topic: 'Decision-tree order misuse',
      q: 'When choosing a chart, you can first pick your favorite chart type and then find a way to fit the data into it — that is the most efficient approach.',
      answer: false,
      explain: 'That puts the cart before the horse. The decision tree demands "task → data → chart": clarify the intent and the data shape first, then choose. "Pick the chart, then squeeze the data in" easily leads to wrong encodings (e.g. one-dimensional magnitude as area) without you even noticing.'
    },
    {
      id: 'j-18', chapter: 6, topic: 'Rainbow colormap',
      q: 'Rainbow scales (Rainbow / Jet) make readers misjudge the order of values, so they should be avoided when encoding ordered data.',
      answer: true,
      explain: 'Correct. Rainbow scales are perceptually non-monotonic and create false boundaries — one of the four misuses the course explicitly bans. Ordered data should use a sequential colormap (e.g. Viridis) so that "darker color" maps one-to-one to "larger value".'
    }
  ]
};