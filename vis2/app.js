/* =========================================================
 * app.js —— 渲染层：把 data.js 的内容接进 index.html 的容器
 * ---------------------------------------------------------
 * 分工：
 *   data.js   → 只放内容与数字（双语对象）
 *   charts.js → 只放 SVG 绘制与动画
 *   app.js    → 搭 DOM、组织版面、绑定交互、响应语言/主题切换
 *
 * 重绘策略：
 *   页面里每个可视化都有一个稳定容器（#chart-xxx）。
 *   切换语言或主题时整站重绘一次——数据只有一份，双语只是
 *   换一套字符串，所以重绘成本很低，却能保证中英文完全一致。
 *   模拟器的滑块状态存放在 STATE.sim 里，重绘后不会丢失。
 * ========================================================= */
(function () {
  'use strict';

  var D = window.AI_DATA;
  var C = window.CHARTS;
  var P = function (o) { return window.I18N.pick(o); };
  var T = function (k) { return window.I18N.t(k); };

  /* 语言切换后需要保留的交互状态 */
  var STATE = {
    sim: null   /* { penetration, dataFactor, talent, rd } */
  };

  /* ---------------- 迷你 DOM 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function mount(name) { return $('[data-mount="' + name + '"]'); }
  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(nodeEl) { while (nodeEl && nodeEl.firstChild) nodeEl.removeChild(nodeEl.firstChild); }
  function add(parent, tag, cls, text) {
    var n = node(tag, cls, text);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* 每张卡片的「标题行」与「注释行」都写在同一处，保证中英一致 */
  function cardHead(name, caption) {
    var el = mount(name + '-head');
    if (!el) return;
    clear(el);
    if (caption) add(el, 'p', 'card-caption', caption);
  }
  function cardFoot(name, note, source) {
    var el = mount(name + '-foot');
    if (!el) return;
    clear(el);
    if (note) add(el, 'p', 'card-note', T('common.note') + ' ｜ ' + note);
    if (source) add(el, 'p', 'card-source', T('common.source') + ' ｜ ' + source);
  }

  /* ---------------- 调色板：颜色一律从 tokens.css 取 ---------------- */
  function palette() {
    return {
      primary: C.colorOf('--c-primary'),
      primary2: C.colorOf('--c-primary-2'),
      accent: C.colorOf('--c-accent'),
      info: C.colorOf('--c-info'),
      success: C.colorOf('--c-success'),
      warn: C.colorOf('--c-warn'),
      danger: C.colorOf('--c-danger'),
      d1: C.colorOf('--d1'), d2: C.colorOf('--d2'), d3: C.colorOf('--d3'),
      d4: C.colorOf('--d4'), d5: C.colorOf('--d5'), d6: C.colorOf('--d6')
    };
  }

  /* ---------------- ① 首页 KPI 数字 ---------------- */
  function renderKpis() {
    var host = $('#kpi-row');
    if (!host) return;
    clear(host);
    D.kpis.forEach(function (k) {
      var card = add(host, 'article', 'kpi');
      var line = add(card, 'p', 'kpi-value');
      var strong = add(line, 'b', null, '0');
      add(line, 'span', 'kpi-unit', P(k.unit));
      add(card, 'p', 'kpi-label', P(k.label));
      add(card, 'p', 'kpi-sub', P(k.sub));
      countUp(strong, k.value, k.decimals);
    });
  }

  function countUp(el, target, decimals) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function paint(v) { el.textContent = C.fmt(v, decimals); }
    if (reduce) { paint(target); return; }
    var start = null, dur = 1100;
    function step(ts) {
      if (start == null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      paint(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
      else paint(target);
    }
    requestAnimationFrame(step);
  }

  /* ---------------- ② 三要素升级 ---------------- */
  function renderDefine() {
    var lead = $('#define-lead');
    if (lead) { clear(lead); add(lead, 'p', 'lead', P(D.define.lead)); }

    var host = $('#pillars');
    if (host) {
      clear(host);
      D.define.pillars.forEach(function (p) {
        var card = add(host, 'article', 'pillar');
        var top = add(card, 'div', 'pillar-top');
        add(top, 'span', 'pillar-icon', p.icon);
        add(top, 'h3', 'pillar-name', P(p.name));
        add(card, 'p', 'pillar-before', P(p.before));
        add(card, 'p', 'pillar-arrow', '↓');
        add(card, 'p', 'pillar-after', P(p.after));

        var meterWrap = add(card, 'div', 'meter');
        var fill = add(meterWrap, 'i', 'meter-fill');
        var meta = add(card, 'p', 'meter-meta');
        meta.textContent = P(p.metric);
        var num = add(meta, 'b', null, ' ' + p.value + ' / ' + p.max);
        add(card, 'p', 'pillar-source', P(p.source));
        requestAnimationFrame(function () {
          fill.style.width = Math.round((p.value / p.max) * 100) + '%';
        });
      });
    }

    /* 传统 vs 新质 对比表 */
    cardHead('compare', P(D.define.compare.caption));
    var table = $('#compare-table');
    if (table) {
      clear(table);
      var t = add(table, 'table', 'cmp');
      var thead = add(t, 'thead');
      var hr = add(thead, 'tr');
      add(hr, 'th', null, '');
      add(hr, 'th', null, P(D.define.compare.colBefore));
      add(hr, 'th', 'is-after', P(D.define.compare.colAfter));
      var tbody = add(t, 'tbody');
      D.define.compare.rows.forEach(function (r) {
        var tr = add(tbody, 'tr');
        add(tr, 'th', null, P(r.dim));
        add(tr, 'td', null, P(r.before));
        add(tr, 'td', 'is-after', P(r.after));
      });
    }
  }

  /* ---------------- ③ 六维雷达 + 五股作用力 ---------------- */
  function renderRadar() {
    var host = $('#chart-radar');
    if (!host) return;
    var K = palette();
    cardHead('radar', P(D.radar.caption));
    C.radar(host, {
      max: 100,
      axes: D.radar.axes.map(P),
      series: D.radar.series.map(function (s, i) {
        return { name: P(s.name), values: s.values, color: i === 0 ? K.info : K.accent };
      })
    });
    cardFoot('radar', P(D.radar.note), P(D.radar.source));
  }

  function renderForces() {
    var host = $('#force-cards');
    if (!host) return;
    clear(host);
    D.forces.forEach(function (f, i) {
      var card = add(host, 'article', 'force-card');
      card.style.setProperty('--i', String(i));
      var top = add(card, 'div', 'force-top');
      add(top, 'span', 'force-icon', f.icon);
      add(top, 'span', 'force-tag', P(f.tag));
      add(card, 'h3', 'force-name', P(f.name));
      add(card, 'p', 'force-desc', P(f.desc));
      var stat = add(card, 'div', 'force-stat');
      add(stat, 'b', 'force-stat-value', f.stat.value);
      add(stat, 'span', 'force-stat-unit', P(f.stat.unit));
      add(card, 'p', 'force-stat-label', P(f.stat.label));
    });
  }

  /* ---------------- ④ 产业规模双曲线 ---------------- */
  function renderScale() {
    var host = $('#chart-scale');
    if (!host) return;
    var K = palette();
    cardHead('scale', P(D.scale.caption));
    C.lineArea(host, {
      yUnit: P(D.scale.unit),
      yMax: 24000,
      series: [
        {
          name: P(D.scale.relatedLabel), color: K.info, fill: true, unit: '',
          points: D.scale.related.map(function (p) {
            return { year: p.year, label: String(p.year), value: p.value, forecast: !!p.forecast };
          })
        },
        {
          name: P(D.scale.coreLabel), color: K.accent, fill: true, unit: '',
          points: D.scale.series.map(function (p) {
            return { year: p.year, label: String(p.year), value: p.value, forecast: !!p.forecast };
          })
        }
      ],
      hoverTitle: function (i, p) { return String(p.year); }
    });
    cardFoot('scale', P(D.scale.note), P(D.scale.source));
  }

  /* ---------------- ⑤ 三次产业：渗透率 / 效率增益 ---------------- */
  function renderIndustry() {
    var host = $('#chart-industry');
    if (!host) return;
    var K = palette();
    cardHead('industry', P(D.industry.caption));
    C.dualBars(host, {
      max: 60, unit: '%',
      rows: D.industry.rows.map(function (r) {
        return {
          key: P(r.key), note: P(r.note),
          bars: [
            { label: P(D.industry.penetration), value: r.penetration, color: K.primary },
            { label: P(D.industry.gain), value: r.gain, color: K.accent },
            { label: P(D.industry.sizeLabel), value: r.size, color: K.info }
          ]
        };
      })
    });
    cardFoot('industry', P(D.industry.note), P(D.industry.source));
  }

  /* ---------------- ⑥ 15 个行业气泡矩阵 ---------------- */
  function renderBubble() {
    var host = $('#chart-bubble');
    if (!host) return;
    cardHead('bubble', P(D.bubble.caption));
    C.bubble(host, {
      xMax: 50, yMax: 42,
      xLabel: P(D.bubble.xLabel), yLabel: P(D.bubble.yLabel), sizeLabel: P(D.bubble.sizeLabel),
      quadrants: D.bubble.quadrants.map(P),
      points: D.bubble.points.map(function (p) {
        return { name: P(p.name), x: p.x, y: p.y, size: p.size };
      })
    });
    cardFoot('bubble', P(D.bubble.note), P(D.bubble.source));
  }

  /* ---------------- ⑦ 全球格局排名 ---------------- */
  function renderGlobal() {
    var host = $('#chart-global');
    if (!host) return;
    cardHead('global', P(D.globalRank.caption));
    C.hRankBars(host, {
      metric: P(D.globalRank.metric),
      max: 100, decimals: 0, labelWidth: 170, highlight: 2,
      rows: D.globalRank.rows.map(function (r) {
        return { name: P(r.name), value: r.value, flag: r.flag, note: '' };
      })
    });
    cardFoot('global', P(D.globalRank.note), P(D.globalRank.source));
  }

  /* ---------------- ⑧ 要素重构流向图 ---------------- */
  function renderFlow() {
    var host = $('#chart-flow');
    if (!host) return;
    cardHead('flow', P(D.flow.caption));
    C.flow(host, {
      columns: D.flow.columns.map(P),
      weightLabel: P({ zh: '权重', en: 'Weight' }),
      nodes: D.flow.nodes.map(function (n) {
        return { id: n.id, col: n.col, weight: n.weight, icon: n.icon, label: P(n.label) };
      }),
      links: D.flow.links.map(function (l) { return { from: l.from, to: l.to, value: l.value }; })
    });
    cardFoot('flow', P(D.flow.note), P(D.flow.source));
  }

  /* ---------------- ⑨ 关系图谱（力导向） ---------------- */
  function renderGraph() {
    var host = $('#chart-graph');
    if (!host) return;
    var K = palette();
    var colorOf = {
      core: K.accent, tech: K.info, factor: K.primary,
      effect: K.success, policy: K.d5, app: K.d6
    };
    var groupLabel = {};
    D.graph.groups.forEach(function (g) { groupLabel[g.id] = P(g.label); });

    var relCount = function (id) {
      return D.graph.links.filter(function (l) { return l.s === id || l.t === id; }).length;
    };

    cardHead('graph', P(D.graph.caption));
    C.graph(host, {
      colors: colorOf,
      groupLabel: groupLabel,
      relCount: relCount,
      countBy: function (g) {
        return D.graph.nodes.filter(function (n) { return n.g === g; }).length;
      },
      fitLabel: P({ zh: '适应窗口', en: 'Fit to view' }),
      hint: P({
        zh: '拖动节点 · 滚轮缩放 · 空白处平移 · 双击节点释放',
        en: 'Drag nodes · scroll to zoom · drag background to pan · double-click to release'
      }),
      nodes: D.graph.nodes.map(function (n) {
        return { id: n.id, label: P(n.label), group: n.g, size: n.size, desc: P(n.desc) };
      }),
      links: D.graph.links.map(function (l) { return { s: l.s, t: l.t, r: l.r }; })
    });
    cardFoot('graph', P(D.graph.note), '');
  }


  /* ---------------- ⑩ 生产力模拟器 ---------------- */
  function renderSim() {
    var host = $('#sim-root');
    if (!host) return;
    clear(host);
    var K = palette();

    if (!STATE.sim) {
      STATE.sim = {};
      D.sim.sliders.forEach(function (s) { STATE.sim[s.id] = s.value; });
    }

    var wrap = add(host, 'div', 'sim');
    var left = add(wrap, 'div', 'sim-controls');
    var right = add(wrap, 'div', 'sim-readout');

    /* —— 左：四个旋钮 —— */
    var sliders = {};
    D.sim.sliders.forEach(function (s) {
      var row = add(left, 'div', 'sim-slider');
      var head = add(row, 'div', 'sim-slider-head');
      add(head, 'label', 'sim-slider-label', P(s.label));
      var out = add(head, 'b', 'sim-slider-value', STATE.sim[s.id] + s.unit);
      var input = document.createElement('input');
      input.type = 'range';
      input.min = '0'; input.max = '100'; input.step = '1';
      input.value = String(STATE.sim[s.id]);
      input.className = 'sim-range';
      input.setAttribute('aria-label', P(s.label));
      row.appendChild(input);
      add(row, 'p', 'sim-slider-hint', P(s.hint));
      sliders[s.id] = { input: input, out: out, unit: s.unit };
    });

    /* —— 预设情景 —— */
    var presetRow = add(left, 'div', 'sim-presets');
    add(presetRow, 'span', 'sim-presets-label', P({ zh: '预设情景', en: 'Presets' }));
    function syncSliders(v) {
      Object.keys(v).forEach(function (k) {
        STATE.sim[k] = v[k];
        if (sliders[k]) {
          sliders[k].input.value = String(v[k]);
          sliders[k].out.textContent = v[k] + sliders[k].unit;
        }
      });
    }
    D.sim.presets.forEach(function (ps) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sim-preset';
      b.textContent = P(ps.name);
      b.addEventListener('click', function () { syncSliders(ps.values); apply(); });
      presetRow.appendChild(b);
    });
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'sim-preset is-ghost';
    reset.textContent = T('common.reset');
    reset.addEventListener('click', function () {
      var base = {};
      D.sim.sliders.forEach(function (s) { base[s.id] = s.value; });
      syncSliders(base);
      apply();
    });
    presetRow.appendChild(reset);


    /* —— 右：综合指数 + 五个产出 —— */
    var gaugeColors = { tfp: K.primary, gdp: K.accent, cost: K.info, green: K.success, jobs: K.d5 };

    var indexBox = add(right, 'div', 'sim-index');
    add(indexBox, 'p', 'sim-index-label', P(D.sim.index));
    var indexHost = add(indexBox, 'div', 'sim-gauge');
    var indexGauge = C.gauge(indexHost, { max: 100, value: 0, unit: '/ 100', color: K.primary });

    var grid = add(right, 'div', 'sim-outputs');
    var cards = {};
    D.sim.outputs.forEach(function (o) {
      var card = add(grid, 'div', 'sim-out');
      add(card, 'p', 'sim-out-label', P(o.label));
      var gh = add(card, 'div', 'sim-gauge');
      var g = C.gauge(gh, {
        max: o.max, decimals: o.decimals, value: 0, unit: '', color: gaugeColors[o.id] || K.primary
      });
      var delta = add(card, 'p', 'sim-out-delta');
      add(card, 'p', 'sim-out-why', P(o.why));
      cards[o.id] = { gauge: g, delta: delta, out: o };
    });
    add(right, 'p', 'sim-formula', P(D.sim.formulaNote));

    var baseline = D.sim.model({ penetration: 18, dataFactor: 25, talent: 22, rd: 20 });

    function apply() {
      var r = D.sim.model(STATE.sim);
      indexGauge.update(r.index);
      D.sim.outputs.forEach(function (o) {
        var rec = cards[o.id];
        rec.gauge.update(r[o.id]);
        var diff = r[o.id] - baseline[o.id];
        rec.delta.textContent = P(D.sim.baseline) + ' ' + (diff >= 0 ? '+' : '') +
          C.fmt(diff, o.decimals) + ' ' + P(o.unit);
        rec.delta.classList.toggle('is-up', diff >= 0);
        rec.delta.classList.toggle('is-down', diff < 0);
      });
    }

    D.sim.sliders.forEach(function (s) {
      sliders[s.id].input.addEventListener('input', function () {
        STATE.sim[s.id] = Number(this.value);
        sliders[s.id].out.textContent = this.value + s.unit;
        apply();
      });
    });

    cardHead('sim', P(D.sim.caption));
    cardFoot('sim', '', '');
    apply();
  }

  /* ---------------- ⑪ 时间线 ---------------- */
  function renderTimeline() {
    var host = $('#chart-timeline');
    if (!host) return;
    var K = { world: C.colorOf('--c-info'), cn: C.colorOf('--c-accent') };
    var kindLabel = {};
    D.timeline.kinds.forEach(function (k) { kindLabel[k.id] = P(k.label); });
    cardHead('timeline', P(D.timeline.caption));
    C.timeline(host, {
      colors: K,
      kindLabel: kindLabel,
      kinds: D.timeline.kinds.map(function (k) { return { id: k.id, label: P(k.label) }; }),
      items: D.timeline.items.map(function (it) {
        return { year: it.year, kind: it.kind, title: P(it.title), desc: P(it.desc) };
      })
    });
    cardFoot('timeline', '', '');
  }

  /* ---------------- ⑫ 落地场景 ---------------- */
  function renderScenes() {
    var host = $('#scene-grid');
    if (!host) return;
    clear(host);
    cardHead('scene', P(D.scenes.caption));
    D.scenes.items.forEach(function (s) {
      var card = add(host, 'article', 'scene');
      var top = add(card, 'div', 'scene-top');
      add(top, 'span', 'scene-icon', s.icon);
      add(top, 'h3', 'scene-name', P(s.name));
      add(card, 'p', 'scene-desc', P(s.desc));
      var list = add(card, 'ul', 'scene-metrics');
      s.metrics.forEach(function (m) {
        var li = add(list, 'li');
        add(li, 'span', 'scene-metric-k', P(m.k));
        add(li, 'b', 'scene-metric-v', m.v);
      });
    });
    cardFoot('scene', P(D.scenes.note), '');
  }

  /* ---------------- ⑬ 数据来源 ---------------- */
  function renderSources() {
    var host = $('#source-list');
    if (!host) return;
    clear(host);
    cardHead('source', P({ zh: '本节引用的公开资料', en: 'Public references cited on this page' }));
    D.sources.forEach(function (s, i) {
      var li = add(host, 'li', 'source-item');
      add(li, 'span', 'source-idx', String(i + 1).padStart(2, '0'));
      var body = add(li, 'div', 'source-body');
      add(body, 'p', 'source-name', P(s.name));
      add(body, 'p', 'source-note', P(s.note));
    });
  }

  /* ---------------- ⑭ 阅读地图 ---------------- */
  function renderOverview() {
    var host = $('#overview-grid');
    if (!host) return;
    clear(host);
    D.overview.forEach(function (o) {
      var a = document.createElement('a');
      a.className = 'ov-card';
      a.href = o.href;
      host.appendChild(a);
      add(a, 'span', 'ov-icon', o.icon);
      add(a, 'h3', 'ov-name', P(o.name));
      add(a, 'p', 'ov-desc', P(o.desc));
    });
  }

  /* ---------------- ⑮ 免责声明 ---------------- */
  function renderDisclaimer() {
    var host = $('#disclaimer');
    if (host) host.textContent = P(D.disclaimer);
  }


  /* =========================================================
   * 渲染总入口
   * ========================================================= */
  function renderAll() {
    renderKpis();
    renderDefine();
    renderRadar();
    renderForces();
    renderScale();
    renderIndustry();
    renderBubble();
    renderGlobal();
    renderFlow();
    renderGraph();
    renderSim();
    renderTimeline();
    renderScenes();
    renderSources();
    renderOverview();
    renderDisclaimer();
    describeCharts();
  }

  /* 让读屏知道「这是一张图、它在讲什么」（切语言后会重新写入） */
  function describeCharts() {
    [
      ['chart-radar', D.radar.caption],
      ['chart-scale', D.scale.caption],
      ['chart-industry', D.industry.caption],
      ['chart-bubble', D.bubble.caption],
      ['chart-global', D.globalRank.caption],
      ['chart-flow', D.flow.caption],
      ['chart-graph', D.graph.caption],
      ['sim-root', D.sim.caption],
      ['chart-timeline', D.timeline.caption]
    ].forEach(function (pair) {
      var host = document.getElementById(pair[0]);
      if (!host || !pair[1]) return;
      host.setAttribute('role', 'img');
      host.setAttribute('aria-label', P(pair[1]));
    });
  }

  /* ---------------- 目录高亮（滚动到哪一节，顶栏就亮哪一节） ---------------- */
  function bindScrollSpy() {
    var links = $$('.nav-link');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) {
      var id = (a.getAttribute('href') || '').replace('#', '');
      if (id) map[id] = a;
    });
    var sections = Object.keys(map)
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (!sections.length) return;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.remove('is-active');
          a.removeAttribute('aria-current');
        });
        var a = map[en.target.id];
        if (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { obs.observe(s); });
  }

  /* ---------------- 顶栏收缩 + 回到顶部 ---------------- */
  function bindScrollUI() {
    var top = $('#to-top');
    var bar = $('.topbar');
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (bar) bar.classList.toggle('is-scrolled', y > 12);
      if (top) top.classList.toggle('is-on', y > 640);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (top) {
      top.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ---------------- 移动端目录抽屉 ---------------- */
  function bindNavToggle() {
    var btn = $('#nav-toggle');
    var nav = $('#site-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.nav-link', nav).forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    renderAll();
    bindScrollSpy();
    bindScrollUI();
    bindNavToggle();

    /* 换语言：静态文案已由 i18n.js 处理，这里只重绘数据驱动的部分 */
    document.addEventListener('langchange', function () {
      renderAll();
      bindScrollSpy();
    });

    /* 换主题：图表颜色全部来自 CSS 变量，重绘一次即可完成换肤 */
    document.addEventListener('themechange', function () { renderAll(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());

