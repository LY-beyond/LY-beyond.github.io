/* =========================================================
 * i18n.js —— 中英双语（本页原位切换，全站共享）
 * ---------------------------------------------------------
 * 与第 1 次作业的差别：第 1 次作业是「两个语言各一套页面」，
 * 本站是「同一个页面里的文案原位切换」——交互逻辑只有一份，
 * 英文只提供一张文案表。这样图表、模拟器、图谱只需实现一次，
 * 点击 EN 时整站（含所有可视化）会整体重绘为英文。
 *
 * 约定：
 *   ① 静态文案：HTML 上写 data-i18n="key"（文本）
 *              或 data-i18n-attr="title:key,aria-label:key2"
 *   ② 动态内容：data.js 里的内容对象一律写成 { zh: '', en: '' }，
 *              渲染时用 I18N.pick(obj) 取值。
 *   ③ 切换语言时派发 document 级 'langchange' 事件，app.js 据此重绘。
 *   ④ 支持 ?lang=zh / ?lang=en 强制指定（分享链接用）。
 * ========================================================= */
(function () {
  'use strict';

  var KEY = 'ai-prod-lang';

  var DICT = {
    zh: {
      'site.name': '人工智能 · 新质生产力',
      'site.short': 'AI · 新质生产力',
      'nav.overview': '概览',
      'nav.what': '内涵',
      'nav.power': '作用力',
      'nav.scale': '产业规模',
      'nav.industry': '行业赋能',
      'nav.region': '区域格局',
      'nav.global': '全球格局',
      'nav.flow': '要素重构',
      'nav.graph': '关系图谱',
      'nav.sim': '模拟器',
      'nav.timeline': '时间线',
      'nav.scene': '落地场景',
      'nav.about': '关于',
      'nav.label': '站点导航',
      'common.sep': ' ｜ ',
      /* 分享 / 无 JS 兜底 / 数据整包导出：给「视图状态可分享」与「关掉 JS 也能读结论」配的词条 */
      'share.copy': '复制当前视图链接',
      'share.copied': '链接已复制：筛选、年份、地图指标都在里面',
      'share.fail': '复制失败，请手动复制地址栏里的地址',
      'share.hint': '地址栏会跟着筛选、年份与地图指标变化：复制出去，别人打开就是同一个视图。',
      'noscript.title': '本页的图表需要 JavaScript 才能绘制',
      'noscript.lead': '打开 JavaScript 即得完整交互（13 张图 + 1 台模拟器）；下面是第 01 节的四个数字，全部数据与 12 条来源也能离线打开。',
      'noscript.kpi1': '2024 年中国人工智能核心产业规模 6964 亿元',
      'noscript.kpi2': '2030 年 AI 对全球 GDP 的增量贡献 15.7 万亿美元',
      'noscript.kpi3': '其中中国预计可获得的份额 26%',
      'noscript.kpi4': '我国算力总规模近五年年均增速 30%',
      'noscript.data': '全部数据与 12 条来源都是纯文本，离线可开：data/sources.csv 与 data/ 目录下的 CSV。',
      'data.all': '打包下载全部数据（CSV）',
      'data.saved': '已开始下载：一个 CSV，按卡片分节，Excel 可直接打开',
      'data.section': '表：{name}',
      'doc.title': '人工智能 · 新质生产力｜数据可视化',
      'doc.desc': '用 14 个章节、13 张自绘 SVG 图表（含地图、热力矩阵、小倍数图）与 1 台带敏感性分析的模拟器，讲清人工智能如何成为新质生产力的核心引擎。',
      'hero.tag': 'AI · NEW QUALITY PRODUCTIVE FORCES',
      'hero.title': '人工智能：新质生产力的核心引擎',
      'hero.sub': '14 个章节 · 13 张自绘 SVG 图表 · 1 台带敏感性分析的模拟器',
      'hero.meta': '从「三要素升级」到「全要素生产率」，用数据看清 AI 如何重塑生产方式',
      'hero.hint': '向下滚动开始 · 图表均可交互',
      'footer.line1': '© 2026 人工智能 · 新质生产力数据可视化',
      'footer.line2': '纯静态站点 · HTML + CSS + JavaScript · 可部署于 GitHub Pages',
      'common.source': '数据来源',
      'common.note': '注',
      'common.reset': '复位',
      'common.chart': '图表',
      'common.table': '数据表',
      'common.top': '回到顶部',
      'tool.group': '视图与导出',
      'tool.png': '导出 PNG',
      'tool.svg': '导出 SVG',
      'tool.csv': '导出 CSV',
      'filter.label': '按行业筛选',
      'filter.all': '全部行业（不筛选）',
      'filter.clear': '清除筛选',
      'filter.hint': '选中一个行业后，下面的三次产业条形图与落地场景会同步响应。',
      'filter.sceneOn': '已按「{name}」筛选：显示 {n} / {total} 个场景',
      'filter.sceneOff': '当前显示全部 {total} 个落地场景',
      'filter.pickHint': '点击气泡即可联动下方图表',
      'filter.hit': '命中 {n} / {total} 个落地场景',
      'filter.noScene': '「{name}」暂未收录落地场景 —— 换个行业，或清除筛选。',
      /* 读屏播报的一句话：把「选中了什么、影响了什么」讲清楚（用词表插值，标点也就跟着语言走） */
      'filter.status': '{name} ｜ 所属产业：{sector} ｜ {sizeLabel} {size} ｜ {hit}',
      'play.play': '播放年份',
      'play.pause': '暂停播放',
      'play.label': '年份',
      'play.link': '年份同时驱动「行业赋能」一节的小倍数图（跨图联动）',
      'viz.band': '预测段 95% 预测区间（两条线）',
      'viz.bandNote': '2026–2028E 由 2019–2024 实际值做线性回归外推，两条线各自带一层锥形底纹 = 95% 预测区间（含参数与外推不确定性），不是机构预测。',
      'viz.weak': '弱口径',
      'viz.weakNote': '「人才密度指数」「市场五年增速」是间接代理指标，只表示相对强弱，不与前三列同口径比较。',
      'viz.value': '数值',
      'viz.rank': '列内排名',
      'viz.geoMissing': '地图几何未加载：缺少 map-china.js（可由 _map.mjs 重新生成）。',
      /* 口径徽章（P2）：一枚徽章只回答一个问题 —— 这批数据有多「硬」 */
      'prov.sourced': '公开统计',
      'prov.modeled': '测算整理',
      'prov.projected': '含预测',
      'prov.list': '公开统计 → 测算整理 → 含预测',
      'prov.rule': '口径取这一组数据里最弱的一环：只要含测算或预测，就按更弱的那类标（{list}）',
      'timeline.keys': '键盘：Tab 到这里后，左右方向键逐个浏览节点（Home / End 跳到首尾，Esc 退出）',
      'timeline.node': '第 {i} / {n} 个节点：{year} 年 · {kind} · {title}',
      'graph.weight': '权重',
      'graph.engineMissing': '力导向引擎（d3-force）未加载，请确认 vendor/ 目录完整。',
      'map.metric': '指标',
      'map.rankLabel': '全国排名',
      'map.summary': '前五名：{list}',
      'skip': '跳到正文',
      'nav.toggle': '展开导航',
      'sec.overview.title': '这张页面讲了什么',
      'sec.overview.lead': '十四个章节，从「概念」到「产业」再到「区域」，每一节都配一张可交互的图。',
      'sec.kpi.title': '先看四个数字',
      'sec.kpi.lead': '规模、增量、份额、算力——四个数字概括了 AI 作为新质生产力的体量。',
      'sec.what.title': '内涵：AI 把三要素各改了一遍',
      'sec.what.lead': '新质生产力的核心，是生产要素从「量的堆叠」转向「质的跃迁」。',
      'sec.power.title': '作用力：六维对比 + 五股力量',
      'sec.power.lead': '把六项能力指数化，看清 AI 赋能前后差在哪里；再拆成五股可以观察、可以验证的力量。',
      'sec.scale.title': '产业规模：两条曲线',
      'sec.scale.lead': '核心产业一路走高，带动的相关产业规模更是它的三倍以上；预测年份用虚线表示。',
      'sec.industry.title': '行业赋能：谁先被改写',
      'sec.industry.lead': '三次产业中服务业的渗透率最高；把各个行业放进矩阵，就能看出「高渗透 · 高增益」的象限在哪。',
      'sec.region.title': '区域格局：算力与企业的地理分布',
      'sec.region.lead': '把 34 个省级单元按算力规模与企业数量着色，能看出 AI 的「高地」在哪里——以及它和人口、产业分布的错位。',
      'sec.region.tip': '提示：地图上悬停可看单省数值；工具栏可切换指标与数据表，也能导出 PNG / SVG / CSV。',
      'sec.global.title': '全球格局：经济体的 AI 指数',
      'sec.global.lead': '综合算力、人才、论文、专利、投资与企业数量等维度，折算成 0–100 的 AI 发展指数。',
      'sec.flow.title': '要素重构：资源是怎么走的',
      'sec.flow.lead': '算力、数据、算法与人才先升级三要素，再汇聚成生产率、新业态与绿色转型——带宽就是权重。',
      'sec.graph.title': '关系图谱：把概念连起来',
      'sec.graph.lead': '可拖拽、可缩放、可双击释放节点：拖动任何一个球，看看它牵动了谁。',
      'sec.sim.title': '生产力模拟器：自己调一组参数',
      'sec.sim.lead': '四个滑块对应四项投入，右侧输出是全要素生产率的相对指数（基准 = 当前水平 100）。调完旋钮，下面两张图会立刻跟着更新：龙卷风图回答「先调哪个」，蒙特卡洛分布回答「结果有多不确定」。这是教学模型，不是预测。',
      'sec.timeline.title': '时间线：从概念到国策',
      'sec.timeline.lead': '左边是全球的技术节点，右边是政策与产业节点，两条线在近几年加速交汇。',
      'sec.scene.title': '落地场景：已经发生的事',
      'sec.scene.lead': '不谈概念，只看几个已经跑起来的场景，以及它们各自的效率与风险。',
      'sec.about.title': '数据来源',
      'sec.about.lead': '所有数字都标注了出处；口径不同、年份不同，横向对比请以趋势为准。'
    },
    en: {
      'site.name': 'AI · New Quality Productive Forces',
      'site.short': 'AI · NQPF',
      'nav.overview': 'Overview',
      'nav.what': 'Concept',
      'nav.power': 'Forces',
      'nav.scale': 'Scale',
      'nav.industry': 'Industries',
      'nav.region': 'Regions',
      'nav.global': 'Global',
      'nav.flow': 'Factor Flow',
      'nav.graph': 'Graph',
      'nav.sim': 'Simulator',
      'nav.timeline': 'Timeline',
      'nav.scene': 'Use Cases',
      'nav.about': 'About',
      'nav.label': 'Site navigation',
      'common.sep': ' | ',
      'share.copy': 'Copy link to this view',
      'share.copied': 'Link copied — filter, year and map metric included',
      'share.fail': 'Copy failed — please copy the address bar manually',
      'share.hint': 'The address bar tracks your filter, year and map metric: copy it and others reopen the very same view.',
      'noscript.title': 'This page needs JavaScript to draw its charts',
      'noscript.lead': 'With JavaScript you get the full interactive version (13 charts + 1 simulator). Below are four headline numbers from section 01; all data and the 12 sources also open offline.',
      'noscript.kpi1': 'China AI core industry scale, 2024: CNY 6964 hundred-million',
      'noscript.kpi2': 'AI incremental contribution to global GDP by 2030: USD 15.7 trillion',
      'noscript.kpi3': 'Share expected to be captured by China: 26%',
      'noscript.kpi4': 'China computing capacity: 30% five-year CAGR',
      'noscript.data': 'All data and the 12 sources are plain text and open offline: data/sources.csv plus the CSVs under data/.',
      'data.all': 'Download the whole dataset (CSV)',
      'data.saved': 'Download started: one CSV, sectioned per card, opens straight in Excel',
      'data.section': 'Table: {name}',
      'doc.title': 'AI · New Quality Productive Forces | Data Visualization',
      'doc.desc': '14 sections, 13 hand-drawn SVG charts (map, heat matrix, small multiples) and 1 simulator with sensitivity analysis: how AI becomes the core engine of new quality productive forces.',
      'hero.tag': 'AI · NEW QUALITY PRODUCTIVE FORCES',
      'hero.title': 'AI: The Core Engine of New Quality Productive Forces',
      'hero.sub': '14 sections · 13 hand-drawn SVG charts · 1 simulator with sensitivity analysis',
      'hero.meta': 'From the upgrade of the three factors to total factor productivity — see in data how AI reshapes production',
      'hero.hint': 'Scroll down to begin · every chart is interactive',
      'footer.line1': '© 2026 AI · New Quality Productive Forces — Data Visualization',
      'footer.line2': 'Fully static · HTML + CSS + JavaScript · Deployable on GitHub Pages',
      'common.source': 'Source',
      'common.note': 'Note',
      'common.reset': 'Reset',
      'common.chart': 'Chart',
      'common.table': 'Data table',
      'common.top': 'Back to top',
      'tool.group': 'View and export',
      'tool.png': 'Export PNG',
      'tool.svg': 'Export SVG',
      'tool.csv': 'Export CSV',
      'filter.label': 'Filter by industry',
      'filter.all': 'All industries (no filter)',
      'filter.clear': 'Clear filter',
      'filter.hint': 'Pick an industry and the sector bars and use cases below respond together.',
      'filter.sceneOn': 'Filtered by "{name}": showing {n} / {total} use cases',
      'filter.sceneOff': 'Showing all {total} use cases',
      'filter.pickHint': 'Click a bubble to link the charts below',
      'filter.hit': '{n} / {total} use cases matched',
      'filter.noScene': 'No use case recorded for "{name}" yet — pick another industry or clear the filter.',
      'filter.status': '{name} | Sector: {sector} | {sizeLabel} {size} | {hit}',
      'play.play': 'Play years',
      'play.pause': 'Pause',
      'play.label': 'Year',
      'play.link': 'The year also drives the small multiples in the Industries section (linked views)',
      'viz.band': 'forecast segment 95% prediction intervals (both lines)',
      'viz.bandNote': '2026–2028E are extrapolated by a linear regression on the 2019–2024 actuals; each line carries its own cone = 95% prediction interval (parameter + extrapolation uncertainty), not an institutional forecast.',
      'viz.weak': 'weak proxy',
      'viz.weakNote': '"Talent density index" and "5-year CAGR" are indirect proxies: read them as relative strength, not on the same footing as the first three columns.',
      'viz.value': 'Value',
      'viz.rank': 'Rank in column',
      'viz.geoMissing': 'Map geometry missing: map-china.js was not found (regenerate it with _map.mjs).',
      'prov.sourced': 'Reported',
      'prov.modeled': 'Modeled',
      'prov.projected': 'Projected',
      'prov.list': 'reported → modeled → projected',
      'prov.rule': 'The badge shows the weakest link in that dataset: any modeled or projected value drags the whole group down ({list})',
      'timeline.keys': 'Keyboard: focus the chart, then use arrow keys to walk the nodes (Home / End jump to the ends, Esc to leave)',
      'timeline.node': 'Node {i} of {n}: {year} | {kind} | {title}',
      'graph.weight': 'Weight',
      'graph.engineMissing': 'Force engine (d3-force) not loaded — please check that the vendor/ folder is complete.',
      'map.metric': 'Metric',
      'map.rankLabel': 'National rank',
      'map.summary': 'Top five: {list}',
      'skip': 'Skip to content',
      'nav.toggle': 'Toggle navigation',
      'sec.overview.title': 'What this page covers',
      'sec.overview.lead': 'Fourteen sections — from concept to industry to geography — each paired with an interactive chart.',
      'sec.kpi.title': 'Four numbers first',
      'sec.kpi.lead': 'Market size, growth, share and compute: four numbers that size up AI as a productive force.',
      'sec.what.title': 'Concept: AI rewrites all three factors',
      'sec.what.lead': 'New quality productive forces are about moving from piling up inputs to jumping in quality.',
      'sec.power.title': 'Forces: six-axis contrast plus five forces',
      'sec.power.lead': 'Index six capabilities to see the gap before and after AI, then break it into five observable forces.',
      'sec.scale.title': 'Scale: two curves',
      'sec.scale.lead': 'The core industry keeps climbing, and the related-industry scale it drives is more than three times larger; forecast years are dashed.',
      'sec.industry.title': 'Industries: who gets rewritten first',
      'sec.industry.lead': 'Services show the deepest penetration; put industries on a matrix to find the high-penetration, high-gain quadrant.',
      'sec.region.title': 'Regional pattern: where compute and firms are',
      'sec.region.lead': 'Colour all 34 province-level units by compute capacity and AI firm counts to see where the AI highlands are — and how they differ from population or industry.',
      'sec.region.tip': 'Hover a province for its values; the toolbar switches metric, data table and PNG / SVG / CSV export.',
      'sec.global.title': 'Global landscape: economy AI index',
      'sec.global.lead': 'Compute, talent, papers, patents, investment and company counts combined into a 0–100 AI development index.',
      'sec.flow.title': 'Factor flow: where the resources go',
      'sec.flow.lead': 'Compute, data, algorithms and talent upgrade the three factors, then converge into productivity, new business models and green transition — bandwidth is weight.',
      'sec.graph.title': 'Knowledge graph: concepts connected',
      'sec.graph.lead': 'Drag, zoom and double-click to release nodes: pull any bubble and see what it moves.',
      'sec.sim.title': 'Productivity simulator: set your own inputs',
      'sec.sim.lead': 'Four sliders map to four inputs; the outputs are relative total-factor-productivity indices (baseline = 100 today). Move a slider and both charts below update instantly: the tornado answers “what to tune first”, the Monte Carlo shows how uncertain the outcome is. A teaching model, not a forecast.',
      'sec.timeline.title': 'Timeline: from concept to national strategy',
      'sec.timeline.lead': 'Global technology milestones on one side, policy and industry milestones on the other, converging fast in recent years.',
      'sec.scene.title': 'Use cases: what is already happening',
      'sec.scene.lead': 'No concepts — just a few deployments already running, with their efficiency gains and risks.',
      'sec.about.title': 'Sources',
      'sec.about.lead': 'Every number is attributed; definitions and years differ, so read the trends rather than absolute levels.'
    }
  };

  var html = document.documentElement;
  var lang = 'zh';
  var listeners = [];

  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 隐私模式忽略 */ } }
  function recall() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  /* ---------- 初始语言：?lang= > 本地记忆 > 浏览器语言 > 中文 ---------- */
  (function init() {
    var forced = '';
    try { forced = new URLSearchParams(location.search).get('lang') || ''; } catch (e) { /* 老浏览器 */ }
    if (forced === 'zh' || forced === 'en') { lang = forced; store(forced); return; }
    var saved = recall();
    if (saved === 'zh' || saved === 'en') { lang = saved; return; }
    var nav = (navigator.language || navigator.userLanguage || 'zh').toLowerCase();
    lang = nav.indexOf('zh') === 0 ? 'zh' : (nav.indexOf('en') === 0 ? 'en' : 'zh');
  }());

  function t(key) {
    var table = DICT[lang] || DICT.zh;
    if (table[key] != null) return table[key];
    if (DICT.zh[key] != null) return DICT.zh[key];   /* 缺词回退中文，不显示裸 key */
    return key;
  }

  /* 取内容对象：pick({zh:'', en:''}) → 当前语言的字符串 */
  function pick(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string' || typeof obj === 'number') return String(obj);
    return obj[lang] != null ? String(obj[lang]) : (obj.zh != null ? String(obj.zh) : '');
  }

  /* 把 HTML 里所有 data-i18n / data-i18n-attr 的静态文案刷一遍 */
  function applyStatic() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-i18n');
      var txt = t(k);
      if (nodes[i].getAttribute('data-i18n-html') === 'true') nodes[i].innerHTML = txt;
      else nodes[i].textContent = txt;
    }
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var spec = attrNodes[j].getAttribute('data-i18n-attr').split(',');
      for (var s = 0; s < spec.length; s++) {
        var pair = spec[s].split(':');
        if (pair.length === 2) attrNodes[j].setAttribute(pair[0].trim(), t(pair[1].trim()));
      }
    }
  }

  /* 标题与描述跟着语言走：document.title + <meta name="description">
     以及 og:title / og:description / twitter:title / twitter:description
     （index.html 里带 data-meta="title|desc" 的就是给它们的挂点）。
     不这么做的话：英文界面分享出去，卡片和标签页还写着中文标题。 */
  function applyMeta() {
    document.title = t('doc.title');
    var metas = document.querySelectorAll('meta[data-meta]');
    for (var i = 0; i < metas.length; i++) {
      metas[i].setAttribute('content', t(metas[i].getAttribute('data-meta') === 'title' ? 'doc.title' : 'doc.desc'));
    }
  }

  function syncSwitch() {
    var items = document.querySelectorAll('.lang-switch-item');
    for (var i = 0; i < items.length; i++) {
      var isCur = items[i].getAttribute('data-lang') === lang;
      items[i].classList.toggle('is-active', isCur);
      items[i].setAttribute('aria-pressed', isCur ? 'true' : 'false');
    }
  }

  function setLang(next, silent) {
    if (next !== 'zh' && next !== 'en') return;
    var changed = next !== lang;
    lang = next;
    store(lang);
    html.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    applyStatic();
    applyMeta();
    syncSwitch();
    if (changed && !silent) {
      for (var i = 0; i < listeners.length; i++) listeners[i](lang);
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
    }
  }

  function bind() {
    var items = document.querySelectorAll('.lang-switch-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        setLang(this.getAttribute('data-lang'));
      });
    }
    syncSwitch();
  }

  window.I18N = {
    get lang() { return lang; },
    t: t,
    pick: pick,
    setLang: setLang,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };

  /* 渲染前先定语言与 <html lang>，避免中英混杂的闪烁 */
  html.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');

  function boot() { applyStatic(); applyMeta(); bind(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
