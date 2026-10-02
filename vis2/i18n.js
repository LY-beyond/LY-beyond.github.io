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
      'nav.global': '全球格局',
      'nav.flow': '要素重构',
      'nav.graph': '关系图谱',
      'nav.sim': '模拟器',
      'nav.timeline': '时间线',
      'nav.scene': '落地场景',
      'nav.about': '关于',
      'hero.tag': 'AI · NEW QUALITY PRODUCTIVE FORCES',
      'hero.title': '人工智能：新质生产力的核心引擎',
      'hero.sub': '11 张可视化看板 · 8 组可交互图表 · 1 台生产力模拟器',
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
      'skip': '跳到正文',
      'nav.toggle': '展开导航',
      'sec.overview.title': '这张页面讲了什么',
      'sec.overview.lead': '十三个章节，从「概念」到「产业」再到「人」，每一节都配一张可交互的图。',
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
      'sec.global.title': '全球格局：经济体的 AI 指数',
      'sec.global.lead': '综合算力、人才、论文、专利、投资与企业数量等维度，折算成 0–100 的 AI 发展指数。',
      'sec.flow.title': '要素重构：资源是怎么走的',
      'sec.flow.lead': '算力、数据、算法与人才先升级三要素，再汇聚成生产率、新业态与绿色转型——带宽就是权重。',
      'sec.graph.title': '关系图谱：把概念连起来',
      'sec.graph.lead': '可拖拽、可缩放、可双击释放节点：拖动任何一个球，看看它牵动了谁。',
      'sec.sim.title': '生产力模拟器：自己调一组参数',
      'sec.sim.lead': '四个滑块对应四项投入，右侧输出是全要素生产率的相对指数（基准 = 当前水平 100）。这是教学模型，不是预测。',
      'sec.timeline.title': '时间线：从概念到国策',
      'sec.timeline.lead': '左边是全球的技术节点，右边是政策与产业节点，两条线在近几年加速交汇。',
      'sec.scene.title': '落地场景：已经发生的事',
      'sec.scene.lead': '不谈概念，只看几个已经跑起来的场景，以及它们各自的效率与风险。',
      'sec.about.title': '数据来源与免责声明',
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
      'nav.global': 'Global',
      'nav.flow': 'Factor Flow',
      'nav.graph': 'Graph',
      'nav.sim': 'Simulator',
      'nav.timeline': 'Timeline',
      'nav.scene': 'Use Cases',
      'nav.about': 'About',
      'hero.tag': 'AI · NEW QUALITY PRODUCTIVE FORCES',
      'hero.title': 'AI: The Core Engine of New Quality Productive Forces',
      'hero.sub': '11 visual dashboards · 8 interactive charts · 1 productivity simulator',
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
      'skip': 'Skip to content',
      'nav.toggle': 'Toggle navigation',
      'sec.overview.title': 'What this page covers',
      'sec.overview.lead': 'Thirteen sections — from concept to industry to people — each paired with an interactive chart.',
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
      'sec.global.title': 'Global landscape: economy AI index',
      'sec.global.lead': 'Compute, talent, papers, patents, investment and company counts combined into a 0–100 AI development index.',
      'sec.flow.title': 'Factor flow: where the resources go',
      'sec.flow.lead': 'Compute, data, algorithms and talent upgrade the three factors, then converge into productivity, new business models and green transition — bandwidth is weight.',
      'sec.graph.title': 'Knowledge graph: concepts connected',
      'sec.graph.lead': 'Drag, zoom and double-click to release nodes: pull any bubble and see what it moves.',
      'sec.sim.title': 'Productivity simulator: set your own inputs',
      'sec.sim.lead': 'Four sliders map to four inputs; the outputs are relative total-factor-productivity indices (baseline = 100 today). A teaching model, not a forecast.',
      'sec.timeline.title': 'Timeline: from concept to national strategy',
      'sec.timeline.lead': 'Global technology milestones on one side, policy and industry milestones on the other, converging fast in recent years.',
      'sec.scene.title': 'Use cases: what is already happening',
      'sec.scene.lead': 'No concepts — just a few deployments already running, with their efficiency gains and risks.',
      'sec.about.title': 'Sources and disclaimer',
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

  function boot() { applyStatic(); bind(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
