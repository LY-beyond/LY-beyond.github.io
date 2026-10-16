// =========================================================
// chart-help-ui.js —— 英文版「选图指南」文案覆盖表
// ---------------------------------------------------------
// 加载顺序必须先于 ../chart-help.js（引擎）。引擎读取
// window.CHART_HELP_I18N，把决策树、结果卡、判分提示与
// SVG aria 标签整体替换为英文；结构与中文版逐键对应。
// =========================================================
window.CHART_HELP_I18N = {

  /* ---------- 固定 UI 串 ---------- */
  ui: {
    diagram: 'Diagram',
    calDays: ['Mon', 'Thu', 'Sun'],
    catA: 'Category A',
    recommend: 'Recommended: ',
    channel: 'Primary visual channel',
    fits: 'Best for',
    avoid: 'Use with care',
    refLabel: 'Reference: ',
    answered: (n, total, ok) => 'Answered ' + n + ' / ' + total + ' questions · ' + ok + ' correct',
    pickFirst: 'Pick an answer first',
    correct: '✅ Correct',
    wrong: (ans) => '❌ Not quite — the answer is ' + ans.toUpperCase()
  },

  /* ---------- 迷你示意图 aria 标签 ---------- */
  aria: {
    bar: 'Vertical bar chart', barh: 'Horizontal bar chart', grouped: 'Grouped bar chart',
    stacked: 'Stacked bar chart', pie: 'Donut chart', histogram: 'Histogram',
    density: 'Density chart', boxplot: 'Box plot', strip: 'Jittered strip plot',
    scatter: 'Scatter plot', trend: 'Scatter plot with fitted line', smatrix: 'Scatterplot matrix',
    line: 'Line chart', calheat: 'Calendar heatmap', spiral: 'Archimedean spiral',
    gantt: 'Interval timeline', treemap: 'Treemap', area100: '100% stacked area chart'
  },

  /* ---------- 决策树（与中文 TREE 同构，id 不变） ---------- */
  tree: {
    root: {
      q: 'What should a viewer take away from this chart at first glance?',
      opts: [
        { t: 'Compare values', s: 'Which categories rank higher or lower' },
        { t: 'See a distribution', s: 'The shape and spread of one variable' },
        { t: 'See relationships', s: 'How two or more variables relate' },
        { t: 'See change over time', s: 'Trends as time goes by' },
        { t: 'See composition', s: 'Which parts make up the whole' }
      ]
    },
    cmp: {
      q: 'What exactly are you comparing?',
      opts: [
        { t: 'Several categories on one variable', s: 'e.g. average age by class' },
        { t: 'Categories split into subcategories', s: 'e.g. gender × major, two groups side by side' },
        { t: 'Totals plus their inner breakdown', s: 'e.g. crime-type shares within each province' }
      ]
    },
    'cmp-cat': {
      q: 'How many categories, and how long are the labels?',
      opts: [
        { t: '≤ 12 categories, short labels', s: 'Vertical bars read at a glance' },
        { t: '> 12 categories, or long labels', s: 'e.g. full province or major names' }
      ]
    },
    dst: {
      q: 'Which side of the distribution do you want to see?',
      opts: [
        { t: 'Overall shape: peaks, skew, bimodality', s: 'Continuous values, the shape after binning' },
        { t: 'A smooth outline, unaffected by binning', s: 'Shape matters more than exact counts' },
        { t: 'Several groups side by side', s: 'e.g. age distribution per class' },
        { t: 'Just the five-number summary per group', s: 'Median / quartiles / extremes' }
      ]
    },
    'dst-multi': {
      q: 'Roughly how many observations per group?',
      opts: [
        { t: 'Large samples (≥ 30)', s: 'Box plots read quartiles stably' },
        { t: 'Very few samples (< 10)', s: 'Statistics wobble — plot the points instead' }
      ]
    },
    rel: {
      q: 'How many variables do you have?',
      opts: [
        { t: 'Two numeric variables', s: 'e.g. height vs weight' },
        { t: 'One category + one numeric', s: 'e.g. age distribution by class' },
        { t: 'Three or more variables', s: 'Overall structure, not just pairwise links' }
      ]
    },
    'rel-2': {
      q: 'Do you also want a trend / fitted line?',
      opts: [
        { t: 'No, just correlation and outliers', s: 'Keep the data as-is, no model' },
        { t: 'Yes, show the trend direction', s: 'A fitted line reveals rise or fall' }
      ]
    },
    tim: {
      q: 'What kind of time data do you have?',
      opts: [
        { t: 'Evenly spaced continuous time points', s: 'Regular daily / monthly / yearly series' },
        { t: 'Daily events, compared across years', s: 'Weekday and monthly patterns' },
        { t: 'Long span or strong cycles', s: 'Decades, seasonal repetition' },
        { t: 'Events / phases with explicit start and end', s: 'Intervals, not points' }
      ]
    },
    com: {
      q: 'Which layer of composition?',
      opts: [
        { t: 'Parts of a whole at one moment', s: 'Which blocks add up to the total' },
        { t: 'Composition changing over time', s: 'How shares evolve' },
        { t: 'Categories nested in categories', s: 'Hierarchies, e.g. major → class' }
      ]
    },
    'com-single': {
      q: 'How many parts in total?',
      opts: [
        { t: '≤ 5 parts', s: 'A donut chart works — but sort the slices' },
        { t: '> 5 parts', s: 'Angle differences become unreadable; switch to bars' }
      ]
    }
  },

  /* ---------- 结果卡（与中文 RESULTS 同构，id 不变） ---------- */
  results: {
    bar: {
      name: 'Bar chart (vertical)',
      why: 'Bar charts encode values with <strong>length</strong>, the channel human vision judges most precisely. With few categories, vertical bars read most comfortably.',
      channel: 'Length (position)',
      fits: '≤ 12 categories, precise reading, short labels',
      avoid: 'Sorting alphabetically; encoding size as area / volume',
      refText: '1.3 Data Attributes'
    },
    barh: {
      name: 'Bar chart (horizontal, sorted by value)',
      why: 'Rotating categories onto the y axis gives long labels a full row; once <strong>sorted by value</strong>, readers get the ranking without comparing bars one by one.',
      channel: 'Length (position)',
      fits: '> 12 categories, long labels (full province / major names)',
      avoid: 'Never put the value axis on top; keep the sorted order intact',
      refText: '1.3 Data Attributes'
    },
    grouped: {
      name: 'Grouped bar chart',
      why: 'Two series sit side by side within each category: the between-category comparison survives, and within-group differences become readable.',
      channel: 'Length + grouping color',
      fits: 'Comparing 2–3 subcategories of one categorical variable',
      avoid: 'Switch to small multiples when groups × categories > 12',
      refText: '4.2 Coordinate Transforms'
    },
    stacked: {
      name: 'Stacked bar chart (incl. 100% stacked)',
      why: 'One bar expresses both the <strong>total</strong> (full length) and the <strong>composition</strong> (segments) — the chart for "I want both".',
      channel: 'Length (total + segments)',
      fits: 'Comparing totals while seeing composition; 100% stacked for shares',
      avoid: 'Middle segments are unreliable (only the bottom segment has a shared baseline); merge into "Other" beyond 6 segments',
      refText: '2.3 Visual Mapping: Data Tables → Visual Structure'
    },
    pie: {
      name: 'Pie / donut chart',
      why: 'Human eyes are poor at <strong>angles</strong> but excellent at spotting "which slice is biggest". With few parts and only the dominant ones in mind, a donut is enough.',
      channel: 'Angle + area',
      fits: '≤ 5 parts, main vs minor only, quick value_counts overview',
      avoid: 'Beyond 5 slices the differences become unreadable; never use it for precise comparison',
      refText: '1.3 Data Attributes'
    },
    histogram: {
      name: 'Histogram',
      why: 'Bin continuous values into equal-width intervals and count: the shape (unimodal / bimodal / skewed) is visible at a glance — the first step for distributions.',
      channel: 'Length (binned counts)',
      fits: 'The distribution shape of a single continuous variable',
      avoid: 'Bin width "changes the story" — always state the bin size; it is not a time axis',
      refText: '4.1 Data Reshaping'
    },
    density: {
      name: 'Density / violin plot',
      why: 'Smooths the histogram outline into curves, so overlaid groups no longer interfere with each other through bin misalignment.',
      channel: 'Area (smoothed density)',
      fits: 'Overlaying several group distributions when shape beats exact counts',
      avoid: 'Areas are normalized — frequencies are unreadable; too many groups blur into mush',
      refText: '4.1 Data Reshaping'
    },
    boxplot: {
      name: 'Box plot',
      why: 'Five statistics (min / quartiles / median / max) compress into one box; differences and outliers across groups are immediate.',
      channel: 'Position + length (statistics)',
      fits: 'Comparing group distributions, spotting outliers; ≥ 30 samples per group',
      avoid: 'Plot the points directly for very small groups; box plots also hide bimodality',
      refText: '4.2 Coordinate Transforms'
    },
    strip: {
      name: 'Jittered strip plot',
      why: 'With few samples the statistics themselves are unstable. Plotting <strong>every observation</strong> (lightly jittered along the category axis) loses no information.',
      channel: 'Position (jitter avoids overlap)',
      fits: 'Few samples per group (< 10), when every observation matters',
      avoid: 'The jitter must not get large enough to distort the impression of the distribution',
      refText: '4.2 Coordinate Transforms'
    },
    scatter: {
      name: 'Scatter plot',
      why: 'Two numeric variables map straight onto x / y — direction, strength, clusters and outliers are all visible. The first choice for two-dimensional data.',
      channel: 'Position (x, y)',
      fits: 'Relationships, outliers and clusters of two numeric variables',
      avoid: 'With heavy overplotting, add transparency first or switch to hexbinning',
      refText: '4.3 Curve Fitting'
    },
    trend: {
      name: 'Scatter plot + fitted trend line',
      why: 'Overlay a fitted curve on the scatter and the trend direction becomes readable; it does not replace the data — it helps separate <strong>trend</strong> from <strong>noise</strong>.',
      channel: 'Position + slope',
      fits: 'Emphasizing trend direction; comparing fitted models (linear / polynomial)',
      avoid: 'Using the fit to hide outliers; forcing a straight line onto non-linear data',
      refText: '4.3 Curve Fitting'
    },
    smatrix: {
      name: 'Scatterplot matrix / parallel coordinates',
      why: 'With three or more variables, a matrix of pairwise panels sweeps every variable pair at once — cheaper than plotting them one by one.',
      channel: 'Position (multiple axes)',
      fits: 'Overall structure of 3–8 variables, quick correlation hunting',
      avoid: 'Beyond 8 dimensions switch to PCA (Chapter 4) or faceting',
      refText: '4.2 Coordinate Transforms'
    },
    line: {
      name: 'Line chart (single / multi-series)',
      why: 'An evenly spaced time axis plus the <strong>slope</strong> of the connecting lines makes "how fast it rises" directly visible — the workhorse of standard time series.',
      channel: 'Position + slope',
      fits: 'Evenly spaced continuous series, trends and turning points; multi-series comparison',
      avoid: 'The time axis must be evenly spaced and continuous; never draw lines for unordered categories; beyond 6 series use small multiples',
      refText: '5.2 Standard time visualization (line charts)'
    },
    calheat: {
      name: 'Calendar heatmap',
      why: 'Aligns "which day" onto a weekday × week grid with color for value — year-spanning daily patterns (weekend effects, seasons) appear instantly.',
      channel: 'Color luminance (sequential colormap)',
      fits: 'Daily events compared across years (weekday / monthly patterns)',
      avoid: 'Always pair it with a color legend; never use rainbow scales; leave missing days explicitly blank',
      refText: '5.3 Calendar heatmap (van Wijk)'
    },
    spiral: {
      name: 'Spiral / polar calendar',
      why: 'Folds cycles into angle and time into radius: one spiral holds decades of data, and periodic repetition is plain to see.',
      channel: 'Angle (cycle) + radius (time)',
      fits: 'Long spans with obvious cycles (seasons, multi-year patterns)',
      avoid: 'Comparing lengths in polar coordinates is imprecise — read patterns, not values',
      refText: '5.4 Cyclic time visualization (Archimedean spiral)'
    },
    gantt: {
      name: 'Storyline / Gantt chart',
      why: 'When the data is "intervals with a start and an end" rather than "points in time", one segment per interval matches its nature.',
      channel: 'Position (interval start / end)',
      fits: 'Events with explicit start and end times (phases, durations, storylines)',
      avoid: 'Not for point-in-time events; layer into swimlanes when crossings pile up',
      refText: '5.5 Storyline timeline (Jurassic Park)'
    },
    treemap: {
      name: 'Treemap',
      why: 'Encodes shares with <strong>area</strong> and nests hierarchy onto one canvas — within a big category, which small category weighs more is immediate.',
      channel: 'Area (hierarchical composition)',
      fits: 'Multi-level hierarchies with lopsided shares (big items for totals, small items for presence)',
      avoid: 'Area comparison is imprecise; beyond three levels it gets hard to read; small items get squeezed away',
      refText: '2.3 Visual Mapping: Data Tables → Visual Structure'
    },
    area100: {
      name: '100% stacked area chart',
      why: 'Normalizes the total to 100% and tracks only the <strong>shares</strong> over time — more focused on ebb and flow than a plain stacked area.',
      channel: 'Area (share over time)',
      fits: 'Evolving composition, shares rising and falling',
      avoid: 'Middle bands are hard to read; use a stacked area chart when absolute values matter',
      refText: '5.2 Standard time visualization (line charts)'
    }
  }
};
