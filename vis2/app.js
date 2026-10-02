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

  /* 语言切换 / 主题切换都会整站重绘一次，所以凡是要「记住」的东西都放这里：
     · sim    模拟器的四个滑块
     · filter 气泡图选中的行业下标（存下标而不是名字，切成英文也不会失效）
     · view   每张图当前是「图表」还是「数据表」
     · year   年份播放器停在第几个数据点 */
  var STATE = {
    sim: null,
    filter: null,
    view: {},
    year: 3,
    playTimer: 0,   /* 年份播放器的 setInterval 句柄（重绘前必须清掉，否则定时器会打向已经废弃的 SVG） */
    regionMetric: 0,  /* 地图当前看的是第几个指标 */
    regionTop: false, /* 地图是否只高亮前五名 */
    sensReady: false, /* 敏感性图表是否已经画过一轮（决定滑块是否要触发重算） */
    sensTimer: 0      /* 敏感性重算的防抖句柄 */
  };

  /* 词条插值：i18n.js 只负责取字符串，{name} / {n} 这类占位符在这里替换 */
  function TT(key, vars) {
    var s = T(key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

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

  /* =========================================================
   * 图表工具栏：视图切换（图表 / 数据表）+ 导出（PNG / SVG / CSV）
   * ---------------------------------------------------------
   * 8 张图共用同一套工具，所以统一收在 chartTools() 里。
   * 每张图渲染时只交出一份 tableSpec()（列名 + 取行函数），
   * 「数据表」和「导出 CSV」都从这一份规格生成 —— 图和表永远是同一份数据，
   * 不会出现「图改了、表没改」的经典事故。
   * ========================================================= */

  /* 由规格生成可读的表格：带 caption、列头 scope="col"、行头 scope="row" */
  function dataTable(spec) {
    var t = node('table', 'viz-table');
    add(t, 'caption', null, spec.caption);
    var hr = add(add(t, 'thead'), 'tr');
    spec.cols.forEach(function (c) {
      add(hr, 'th', null, c.label).setAttribute('scope', 'col');
    });
    var tbody = add(t, 'tbody');
    spec.rows.forEach(function (row) {
      var tr = add(tbody, 'tr');
      spec.cols.forEach(function (c, i) {
        var cell = add(tr, i === 0 ? 'th' : 'td', null, row[c.key] == null ? '' : row[c.key]);
        if (i === 0) cell.setAttribute('scope', 'row');
      });
    });
    return t;
  }

  /* 表格规格 → CSV 需要的「表头 + 二维数组」 */
  function toCSV(spec) {
    return {
      cols: spec.cols.map(function (c) { return c.label; }),
      rows: spec.rows.map(function (r) {
        return spec.cols.map(function (c) { return r[c.key]; });
      })
    };
  }

  /* 在卡片里插一条工具栏 + 一个「数据表」面板，返回句柄供调用方追加自己的控件 */
  function chartTools(host, spec) {
    var card = host.parentElement;
    if (!card) return null;

    /* 同一张图会被重绘多次（联动 setFilter、换语言、换主题都会重跑 renderXxx），
       所以先把上一轮留下的工具栏与表格面板摘掉 ——
       否则卡片里会叠出好几套控件：旧按钮照样能点、#industry-picker 出现重复 id、
       读屏重复播报，用户也会看到两份「图表 / 数据表」。
       （关系图那条 viz-toolbar--inset 由 charts.js 在渲染时插在画布后面，
         这里一并收掉，下一次渲染会重新生成。） */
    [].slice.call(card.children).forEach(function (el) {
      if (el === host) return;
      if (el.classList && (el.classList.contains('viz-toolbar') || el.classList.contains('viz-table-wrap'))) {
        card.removeChild(el);
      }
    });

    var bar = node('div', 'viz-toolbar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', T('tool.group'));
    card.insertBefore(bar, host);

    /* 数据表与图表共用一个位置：切换，而不是在下面再塞一块 */
    var panel = node('div', 'viz-table-wrap');
    panel.hidden = true;
    card.insertBefore(panel, host);

    function btn(label) {
      var b = node('button', 'viz-btn', label);
      b.type = 'button';
      return b;
    }

    /* —— 左：图表 / 数据表 —— */
    var seg = node('span', 'viz-seg');
    var chartBtn = btn(T('common.chart'));
    var tableBtn = btn(T('common.table'));
    seg.appendChild(chartBtn);
    seg.appendChild(tableBtn);
    bar.appendChild(seg);

    /* —— 右：导出 —— */
    var acts = node('span', 'viz-acts');
    var pngBtn = btn(T('tool.png'));
    var svgBtn = btn(T('tool.svg'));
    var csvBtn = btn(T('tool.csv'));
    acts.appendChild(pngBtn);
    acts.appendChild(svgBtn);
    acts.appendChild(csvBtn);
    bar.appendChild(acts);

    /* table() 允许返回一张表或多张表：流向图 / 关系图是「节点 + 关系」两张 */
    function tableSpecs() {
      var t = spec.table();
      return Object.prototype.toString.call(t) === '[object Array]' ? t : [t];
    }

    function setView(v) {
      var isTable = v === 'table';
      if (isTable) {
        clear(panel);
        tableSpecs().forEach(function (s) { panel.appendChild(dataTable(s)); });
      }
      host.hidden = isTable;
      panel.hidden = !isTable;
      chartBtn.classList.toggle('is-on', !isTable);
      tableBtn.classList.toggle('is-on', isTable);
      chartBtn.setAttribute('aria-pressed', isTable ? 'false' : 'true');
      tableBtn.setAttribute('aria-pressed', isTable ? 'true' : 'false');
      STATE.view[spec.name] = isTable ? 'table' : 'chart';
    }
    chartBtn.addEventListener('click', function () { setView('chart'); });
    tableBtn.addEventListener('click', function () { setView('table'); });

    /* 导出的一定是「图」，所以在数据表视图下先切回去，导出完再切回来 */
    function keepView(fn) {
      var wasTable = STATE.view[spec.name] === 'table';
      if (wasTable) setView('chart');
      fn(function () { if (wasTable) setView('table'); });
    }
    pngBtn.addEventListener('click', function () {
      keepView(function (restore) { C.exportPNG(host, spec.name, restore); });
    });
    svgBtn.addEventListener('click', function () {
      keepView(function (restore) { C.exportSVG(host, spec.name); restore(); });
    });
    csvBtn.addEventListener('click', function () {
      C.exportCSV(spec.name, tableSpecs().map(toCSV));
    });

    setView(STATE.view[spec.name]);

    return { bar: bar, setView: setView };
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
      anomaly: C.colorOf('--c-anomaly'),
      /* 底色系列：大面积填充专用（低彩度、安静）—— 见 tokens.css「图表两档系列色」 */
      base: C.colorOf('--s-base'),
      baseAlt: C.colorOf('--s-base-alt'),
      baseWarm: C.colorOf('--s-base-warm'),
      text: C.colorOf('--c-text'),
      onAccent: C.colorOf('--c-on-accent'),
      onPrimary: C.colorOf('--c-on-primary'),
      d1: C.colorOf('--d1'), d2: C.colorOf('--d2'), d3: C.colorOf('--d3'),
      d4: C.colorOf('--d4'), d5: C.colorOf('--d5'), d6: C.colorOf('--d6')
    };
  }

  /* =========================================================
   * 跨图联动：行业气泡 ⇄ 三次产业 ⇄ 落地场景
   * ---------------------------------------------------------
   * 三张图靠 data.js 里的稳定键串起来，不靠中文名：
   *   bubble.points[i].id      —— 行业唯一键（语言切换后不变）
   *   bubble.points[i].sector  —— 指向 industry.rows[j].id
   *   scenes.items[k].match    —— 指向 bubble.points[i].id
   * 这里只做查表，任何一个键改动都只需要在 data.js 改一处。
   * ========================================================= */

  /* 当前选中的行业对象；没选或越界时返回 null */
  function pickedPoint() {
    var i = STATE.filter;
    if (i == null || i < 0 || i >= D.bubble.points.length) return null;
    return D.bubble.points[i];
  }

  /* 选中行业对应的产业行 id（交给双条形图做行级变暗） */
  function sectorRowId() {
    var p = pickedPoint();
    return p ? p.sector : null;
  }

  /* 联动状态的一句话播报（role="status"，读屏用户也能知道「刚才点中有没有生效」） */
  function filterStatus() {
    var p = pickedPoint();
    if (!p) return T('filter.hint');
    var sector = '';
    D.industry.rows.forEach(function (r) { if (r.id === p.sector) sector = P(r.key); });
    var hit = D.scenes.items.filter(function (s) { return s.match === p.id; }).length;
    return P(p.name) + ' ｜ ' + P({ zh: '所属产业', en: 'Sector' }) + '：' + sector +
      ' ｜ ' + P(D.bubble.sizeLabel) + ' ' + C.fmt(p.size, 0) +
      ' ｜ ' + TT('filter.hit', { n: hit, total: D.scenes.items.length });
  }

  /* 联动的唯一入口：改 STATE.filter，然后重画受影响的「那三张图」——
     不整体重绘，避免 KPI 数字重新数一遍、力导向图重新抖一遍。 */
  function setFilter(i) {
    STATE.filter = (i == null || i < 0) ? null : i;
    renderBubble();
    renderIndustry();
    renderScenes();
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
      /* 窄屏（≤700px）表格改为堆叠显示，每个单元格靠 data-label 自带列名 —— 见 styles.css */
      var labelBefore = P(D.define.compare.colBefore);
      var labelAfter = P(D.define.compare.colAfter);
      D.define.compare.rows.forEach(function (r) {
        var tr = add(tbody, 'tr');
        add(tr, 'th', null, P(r.dim));
        add(tr, 'td', null, P(r.before)).setAttribute('data-label', labelBefore);
        add(tr, 'td', 'is-after', P(r.after)).setAttribute('data-label', labelAfter);
      });
    }
  }

  /* ---------------- ③ 六维雷达 + 五股作用力 ---------------- */
  function renderRadar() {
    var host = $('#chart-radar');
    if (!host) return;
    var K = palette();
    cardHead('radar', P(D.radar.caption));
    chartTools(host, {
      name: 'radar',
      table: function () {
        var cols = [{ key: 'k', label: P({ zh: '能力维度', en: 'Capability' }) }];
        var keys = D.radar.series.map(function (s) { return P(s.name); });
        D.radar.series.forEach(function (s, i) { cols.push({ key: keys[i], label: keys[i] }); });
        return {
          caption: P(D.radar.caption),
          cols: cols,
          rows: D.radar.axes.map(function (a, i) {
            var row = { k: P(a) };
            D.radar.series.forEach(function (s, j) { row[keys[j]] = s.values[i]; });
            return row;
          })
        };
      }
    });
    C.radar(host, {
      max: 100,
      axes: D.radar.axes.map(P),
      series: D.radar.series.map(function (s, i) {
        /* 第 0 条是「传统生产力」基线：只描边不填充（base），
           把填充留给要强调的 AI 系列，同时避免蓝橙两片淡彩叠成灰褐 */
        return { name: P(s.name), values: s.values, color: i === 0 ? K.info : K.accent, base: i === 0 };
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
    /* 重绘前先收掉上一轮的播放定时器：否则它会继续往已经废弃的 SVG 上写 */
    if (STATE.playTimer) { window.clearInterval(STATE.playTimer); STATE.playTimer = 0; }
    var scaleCtx = C.lineArea(host, {
      yUnit: P(D.scale.unit),
      yMax: 24000,
      series: [
        {
          /* 带动产业是「底」：只描边不填面积，把大面积淡彩留给要强调的核心产业 */
          name: P(D.scale.relatedLabel), color: K.info, fill: false, unit: '',
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
    /* —— 工具栏 + 年份播放器 ——
       播放器只调 scaleCtx.focus(i) 挪动聚焦线，不重画整张图，所以逐帧播放不会闪。 */
    var scaleTools = chartTools(host, {
      name: 'scale',
      table: function () {
        return {
          caption: P(D.scale.caption),
          cols: [
            { key: 'year', label: P({ zh: '年份', en: 'Year' }) },
            { key: 'core', label: P(D.scale.coreLabel) + '（' + P(D.scale.unit) + '）' },
            { key: 'related', label: P(D.scale.relatedLabel) + '（' + P(D.scale.unit) + '）' },
            { key: 'type', label: P({ zh: '数据性质', en: 'Data type' }) }
          ],
          rows: D.scale.series.map(function (p, i) {
            var rel = D.scale.related[i] || {};
            return {
              year: p.year,
              core: p.value,
              related: rel.value,
              type: p.forecast ? P({ zh: '预测', en: 'Forecast' }) : P({ zh: '实际', en: 'Actual' })
            };
          })
        };
      }
    });

    var playBtn = node('button', 'viz-btn is-play', '▶ ' + T('play.play'));
    playBtn.type = 'button';
    scaleTools.bar.appendChild(playBtn);

    var yearRange = document.createElement('input');
    yearRange.type = 'range';
    yearRange.className = 'viz-range';
    yearRange.min = '0';
    yearRange.max = String(scaleCtx.count - 1);
    yearRange.step = '1';
    yearRange.value = String(STATE.year);
    yearRange.setAttribute('aria-label', T('play.label'));
    scaleTools.bar.appendChild(yearRange);

    var yearOut = node('span', 'viz-year', '');
    scaleTools.bar.appendChild(yearOut);

    function paintYear(i) {
      STATE.year = scaleCtx.focus(i);
      yearRange.value = String(STATE.year);
      yearOut.textContent = scaleCtx.years[STATE.year] + ' · ' +
        P(D.scale.coreLabel) + ' ' + C.fmt(D.scale.series[STATE.year].value, 0) + ' / ' +
        P(D.scale.relatedLabel) + ' ' + C.fmt(D.scale.related[STATE.year].value, 0) +
        ' ' + P(D.scale.unit);
    }
    function stopPlay() {
      if (!STATE.playTimer) return;
      window.clearInterval(STATE.playTimer);
      STATE.playTimer = 0;
      playBtn.classList.remove('is-on');
      playBtn.textContent = '▶ ' + T('play.play');
    }
    playBtn.addEventListener('click', function () {
      if (STATE.playTimer) { stopPlay(); return; }
      playBtn.classList.add('is-on');
      playBtn.textContent = '❚❚ ' + T('play.pause');
      STATE.playTimer = window.setInterval(function () {
        paintYear(STATE.year >= scaleCtx.count - 1 ? 0 : STATE.year + 1);
      }, 900);
    });
    yearRange.addEventListener('input', function () {
      stopPlay();
      paintYear(Number(this.value));
    });
    paintYear(Math.min(STATE.year, scaleCtx.count - 1));

    cardFoot('scale', P(D.scale.note), P(D.scale.source));
  }

  /* ---------------- ⑤ 三次产业：渗透率 / 效率增益 ---------------- */
  function renderIndustry() {
    var host = $('#chart-industry');
    if (!host) return;
    var K = palette();
    cardHead('industry', P(D.industry.caption));

    /* 跨图联动（接收端）：气泡选中哪个行业，这里就把它的产业那一行点亮、其余行压暗 */
    var dimId = sectorRowId();
    chartTools(host, {
      name: 'industry',
      table: function () {
        return {
          caption: P(D.industry.caption),
          cols: [
            { key: 'sector', label: P({ zh: '产业', en: 'Sector' }) },
            { key: 'pen', label: P(D.industry.penetration) + '（%）' },
            { key: 'gain', label: P(D.industry.gain) + '（%）' },
            { key: 'size', label: P(D.industry.sizeLabel) + '（%）' },
            /* 这一列是联动算出来的，读者能顺着它去气泡矩阵里数 */
            { key: 'count', label: P({ zh: '矩阵中的行业数', en: 'Industries in matrix' }) },
            { key: 'note', label: P({ zh: '说明', en: 'Note' }) }
          ],
          rows: D.industry.rows.map(function (r) {
            var n = D.bubble.points.filter(function (p) { return p.sector === r.id; }).length;
            return {
              sector: P(r.key), pen: r.penetration, gain: r.gain,
              size: r.size, count: n, note: P(r.note)
            };
          })
        };
      }
    });

    C.dualBars(host, {
      max: 60, unit: '%',
      dimId: dimId,
      rows: D.industry.rows.map(function (r) {
        return {
          /* id 必须原样带下去：dualBars 靠 r.id === cfg.dimId 判断「哪一行被气泡选中」，
             少传这一行整张图会全部压暗（等于没命中）。 */
          id: r.id,
          key: P(r.key), note: P(r.note),
          bars: [
            /* 两条「现状」走低彩度底色（字用 --c-text），只有效率增益是重点：
               高饱和强调橙 + 深墨字 --c-on-accent（4.91:1，替代橙底白字的 3.56:1） */
            { label: P(D.industry.penetration), value: r.penetration, color: K.base, onColor: K.text },
            { label: P(D.industry.gain), value: r.gain, color: K.accent, onColor: K.onAccent },
            { label: P(D.industry.sizeLabel), value: r.size, color: K.baseWarm, onColor: K.text }
          ]
        };
      })
    });
    cardFoot('industry', P(D.industry.note), P(D.industry.source));
  }

  /* ---------------- ⑥ 15 个行业气泡矩阵（跨图联动的主控端） ---------------- */
  function renderBubble() {
    var host = $('#chart-bubble');
    if (!host) return;
    cardHead('bubble', P(D.bubble.caption));

    var tools = chartTools(host, {
      name: 'bubble',
      table: function () {
        return {
          caption: P(D.bubble.caption),
          cols: [
            { key: 'name', label: P({ zh: '行业', en: 'Industry' }) },
            { key: 'sector', label: P({ zh: '所属产业', en: 'Sector' }) },
            { key: 'x', label: P(D.bubble.xLabel) },
            { key: 'y', label: P(D.bubble.yLabel) },
            { key: 'size', label: P(D.bubble.sizeLabel) },
            { key: 'quad', label: P({ zh: '所在象限', en: 'Quadrant' }) }
          ],
          rows: D.bubble.points.map(function (p) {
            var sector = '';
            D.industry.rows.forEach(function (r) { if (r.id === p.sector) sector = P(r.key); });
            /* 象限序号与气泡图里的分割线一致：x 中位 25、y 中位 21（见下方 xMax/2、yMax/2） */
            var qi = p.x >= 25 ? (p.y >= 21 ? 0 : 3) : (p.y >= 21 ? 1 : 2);
            return {
              name: P(p.name), sector: sector,
              x: p.x + '%', y: p.y + '%', size: C.fmt(p.size, 0),
              quad: P(D.bubble.quadrants[qi])
            };
          })
        };
      }
    });

    /* —— 联动的键盘等价入口 ——
       气泡本身可以点，但它活在 role="img" 的 SVG 里，读屏和纯键盘用户够不着，
       所以必须再给一个原生 <select>：两者写的是同一个 STATE.filter。 */
    var field = add(tools.bar, 'span', 'viz-filter');
    var label = add(field, 'label', 'viz-filter-label', T('filter.label'));
    label.setAttribute('for', 'industry-picker');

    var select = document.createElement('select');
    select.className = 'viz-select';
    select.id = 'industry-picker';
    var optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = T('filter.all');
    select.appendChild(optAll);
    D.bubble.points.forEach(function (p, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = P(p.name) + ' · ' + C.fmt(p.size, 0);
      select.appendChild(o);
    });
    select.value = STATE.filter == null ? '' : String(STATE.filter);
    select.addEventListener('change', function () {
      setFilter(this.value === '' ? null : Number(this.value));
    });
    field.appendChild(select);

    var clearBtn = node('button', 'viz-btn is-ghost', T('filter.clear'));
    clearBtn.type = 'button';
    clearBtn.hidden = STATE.filter == null;
    clearBtn.addEventListener('click', function () { setFilter(null); });
    field.appendChild(clearBtn);

    var live = add(tools.bar, 'span', 'viz-live', filterStatus());
    live.setAttribute('role', 'status');

    C.bubble(host, {
      xMax: 50, yMax: 42,
      xLabel: P(D.bubble.xLabel), yLabel: P(D.bubble.yLabel), sizeLabel: P(D.bubble.sizeLabel),
      quadrants: D.bubble.quadrants.map(P),
      picked: STATE.filter,
      onPick: setFilter,
      pickHint: T('filter.pickHint'),
      points: D.bubble.points.map(function (p) {
        return { name: P(p.name), x: p.x, y: p.y, size: p.size };
      })
    });
    cardFoot('bubble', P(D.bubble.note), P(D.bubble.source));
  }

  /* ---------------- ⑥b 行业 × 指标热力矩阵（B2） ---------------- */
  function renderHeatmap() {
    var host = $('#chart-heat');
    if (!host) return;
    var H = D.heatmap;
    cardHead('heat', P(H.caption));

    var metrics = H.metrics.map(function (m) {
      return {
        id: m.id, label: P(m.label), short: m.short ? P(m.short) : null,
        unit: P(m.unit), decimals: m.decimals
      };
    });

    chartTools(host, {
      name: 'heat',
      table: function () {
        return {
          caption: P(H.caption),
          cols: [{ key: 'name', label: P({ zh: '行业', en: 'Industry' }) }].concat(metrics.map(function (m) {
            return { key: m.id, label: withUnit(m.label, m.unit) };
          })),
          rows: H.rows.map(function (r) {
            var o = { name: P(r.name) };
            metrics.forEach(function (m) { o[m.id] = r[m.id]; });
            return o;
          })
        };
      }
    });

    C.heatmap(host, {
      metrics: metrics,
      rows: H.rows.map(function (r) {
        var o = { id: r.id, name: P(r.name) };
        metrics.forEach(function (m) { o[m.id] = r[m.id]; });
        return o;
      }),
      valueLabel: T('viz.value'),
      rankLabel: T('viz.rank'),
      legendLabel: P(H.legend)
    });
    cardFoot('heat', P(H.note), P(H.source));
  }

  /* ---------------- ⑥c 三次产业小倍数图（B3） ---------------- */
  function renderMultiples() {
    var host = $('#chart-multiples');
    if (!host) return;
    var M = D.multiples;
    var K = palette();
    cardHead('multiples', P(M.caption));

    var years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
    var labels = M.seriesLabels;

    chartTools(host, {
      name: 'multiples',
      table: function () {
        return {
          caption: P(M.caption),
          cols: [
            { key: 'year', label: P({ zh: '年份', en: 'Year' }) },
            { key: 'sector', label: P({ zh: '产业', en: 'Sector' }) },
            { key: 'pen', label: withUnit(P(labels.penetration), '%') },
            { key: 'gain', label: withUnit(P(labels.gain), '%') },
            { key: 'type', label: P({ zh: '数据性质', en: 'Data type' }) }
          ],
          rows: (function () {
            var out = [];
            years.forEach(function (yr, i) {
              M.series.forEach(function (s) {
                out.push({
                  year: yr,
                  sector: P(s.key),
                  pen: s.penetration[i],
                  gain: s.gain[i],
                  type: i === years.length - 1 ? P({ zh: '预测', en: 'Forecast' }) : P({ zh: '实际', en: 'Actual' })
                });
              });
            });
            return out;
          }())
        };
      }
    });

    C.smallMultiples(host, {
      years: years,
      unit: '%',
      yMax: 45,
      panels: M.series.map(function (s) {
        return {
          id: s.id,
          label: P(s.key),
          color: C.colorOf(s.colorKey, K.primary),
          series: [
            /* 线条配色跨三格保持一致（小倍数图的可比性靠它）；产业身份交给标题前的色点 */
            { name: P(labels.penetration), values: s.penetration, decimals: 1, area: true, color: K.primary },
            { name: P(labels.gain), values: s.gain, decimals: 0, dash: true, color: K.accent }
          ]
        };
      })
    });
    cardFoot('multiples', P(M.note), P(M.source));
  }

  /* ---------------- ⑦ 全球格局排名 ---------------- */
  function renderGlobal() {
    var host = $('#chart-global');
    if (!host) return;
    cardHead('global', P(D.globalRank.caption));
    chartTools(host, {
      name: 'global',
      table: function () {
        return {
          caption: P(D.globalRank.caption),
          cols: [
            { key: 'name', label: P({ zh: '经济体', en: 'Economy' }) },
            { key: 'v', label: P(D.globalRank.metric) },
            { key: 'rank', label: P({ zh: '排名', en: 'Rank' }) }
          ],
          rows: D.globalRank.rows.map(function (r, i) {
            return { name: P(r.name), v: r.value, rank: i + 1 };
          })
        };
      }
    });
    C.hRankBars(host, {
      metric: P(D.globalRank.metric),
      max: 100, decimals: 0, labelWidth: 170, highlight: 2,
      rows: D.globalRank.rows.map(function (r) {
        return { name: P(r.name), value: r.value, flag: r.flag, note: '' };
      })
    });
    cardFoot('global', P(D.globalRank.note), P(D.globalRank.source));
  }

  /* 「标签（单位）」的写法随语言变：中文用全角括号，英文用半角 —— 
     不然英文界面上会出现 "AI penetration（%）" 这种半中半英的排版 */
  function withUnit(label, unit) {
    var u = String(unit).trim();
    if (!u) return label;
    return window.I18N.lang === 'zh' ? label + '（' + u + '）' : label + ' (' + u + ')';
  }

  /* ---------------- ⑦b 区域格局：省级分级填色地图（B1） ---------------- */
  function renderRegion() {
    var host = $('#chart-region');
    if (!host) return;
    var G = D.province;
    cardHead('region', P(G.caption));

    /* 几何由 map-china.js 提供；万一没加载出来（比如手滑删了文件），
       要给一句人话，而不是一张白屏 */
    if (!window.CN_MAP) {
      var err = add(host, 'p', 'viz-hint', T('viz.geoMissing'));
      host.classList.add('viz');
      cardFoot('region', P(G.note), P(G.source));
      return err;
    }

    if (STATE.regionMetric == null || !G.metrics[STATE.regionMetric]) STATE.regionMetric = 0;
    var mi = STATE.regionMetric;
    var metric = G.metrics[mi];
    var unit = P(metric.unit);

    /* 名次：当前指标降序（地图着色按分位数，表格按名次，两个视角互相印证） */
    var ordered = G.rows.slice().sort(function (a, b) { return b[metric.id] - a[metric.id]; });
    var rankOf = {};
    ordered.forEach(function (r, i) { rankOf[r.id] = i + 1; });

    var tools = chartTools(host, {
      name: 'region',
      table: function () {
        return {
          caption: P(G.caption) + ' · ' + P(metric.label),
          cols: [
            { key: 'rank', label: P({ zh: '排名', en: 'Rank' }) },
            { key: 'name', label: P({ zh: '省级行政区', en: 'Province-level unit' }) },
            { key: 'value', label: withUnit(P(metric.label), unit) },
            { key: 'other', label: withUnit(P(G.metrics[1 - mi].label), P(G.metrics[1 - mi].unit)) }
          ],
          rows: ordered.map(function (r) {
            return {
              rank: rankOf[r.id],
              name: P(r.name),
              value: C.fmt(r[metric.id], metric.decimals),
              other: C.fmt(r[G.metrics[1 - mi].id], G.metrics[1 - mi].decimals)
            };
          })
        };
      }
    });

    /* 指标切换：一个原生 <select>，键盘与读屏都能用（和气泡图的行业筛选同一套做法） */
    var field = add(tools.bar, 'span', 'viz-filter');
    var label = add(field, 'label', 'viz-filter-label', T('map.metric'));
    label.setAttribute('for', 'region-metric');
    var select = document.createElement('select');
    select.className = 'viz-select';
    select.id = 'region-metric';
    G.metrics.forEach(function (m, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = withUnit(P(m.label), P(m.unit));
      select.appendChild(o);
    });
    select.value = String(mi);
    select.addEventListener('change', function () { STATE.regionMetric = Number(this.value); renderRegion(); });
    field.appendChild(select);

    /* 只看前五名：地图上一共有 34 个单元，尾部很容易糊成一片。
       按钮给一个固定 id，冒烟测试/AX 都能直接指到它（相邻的「图表 / 数据表」也带 aria-pressed，
       只按类名找会误点到它们）。 */
    var topBtn = node('button', 'viz-btn is-ghost' + (STATE.regionTop ? ' is-on' : ''), P(G.leaders));
    topBtn.type = 'button';
    topBtn.id = 'region-top-btn';
    topBtn.setAttribute('aria-pressed', STATE.regionTop ? 'true' : 'false');
    topBtn.addEventListener('click', function () {
      STATE.regionTop = !STATE.regionTop;
      renderRegion();
    });
    tools.bar.appendChild(topBtn);

    var live = add(tools.bar, 'span', 'viz-live',
      TT('map.summary', { list: ordered.slice(0, 5).map(function (r) { return P(r.name); }).join(' · ') }));
    live.setAttribute('role', 'status');

    var names = {}, values = {};
    G.rows.forEach(function (r) {
      names[r.id] = P(r.name);
      values[r.id] = r[metric.id];
    });
    C.choropleth(host, {
      geo: window.CN_MAP,
      names: names,
      values: values,
      metricLabel: P(metric.label),
      unit: unit,
      decimals: metric.decimals,
      noData: P(G.noData),
      insetLabel: P(G.insetLabel),
      rankLabel: T('map.rankLabel'),
      legendLabel: P({ zh: '低 ← 分位五档 → 高', en: 'low ← 5 quantiles → high' }),
      legendHigh: P({ zh: '高', en: 'high' }),
      leadersOnly: STATE.regionTop
    });
    cardFoot('region', P(G.note), P(G.source));
    return null;
  }

  /* ---------------- ⑧ 要素重构流向图 ---------------- */
  function renderFlow() {
    var host = $('#chart-flow');
    if (!host) return;
    cardHead('flow', P(D.flow.caption));
    /* 流向图有两张表：节点（谁）和关系（谁流向谁）。两张一起给，
       否则「数据表」视图只能看见点、看不见边。 */
    chartTools(host, {
      name: 'flow',
      table: function () {
        var nodeName = {};
        D.flow.nodes.forEach(function (n) { nodeName[n.id] = P(n.label); });
        return [
          {
            caption: P(D.flow.caption) + ' · ' + P({ zh: '节点', en: 'Nodes' }),
            cols: [
              { key: 'label', label: P({ zh: '要素', en: 'Element' }) },
              { key: 'col', label: P({ zh: '阶段', en: 'Stage' }) },
              { key: 'weight', label: P({ zh: '权重', en: 'Weight' }) }
            ],
            rows: D.flow.nodes.map(function (n) {
              return { label: P(n.label), col: P(D.flow.columns[n.col]), weight: n.weight };
            })
          },
          {
            caption: P(D.flow.caption) + ' · ' + P({ zh: '关系', en: 'Relations' }),
            cols: [
              { key: 'from', label: P({ zh: '起点', en: 'From' }) },
              { key: 'to', label: P({ zh: '终点', en: 'To' }) },
              { key: 'v', label: P({ zh: '强度', en: 'Strength' }) }
            ],
            rows: D.flow.links.map(function (l) {
              return { from: nodeName[l.from] || l.from, to: nodeName[l.to] || l.to, v: l.value };
            })
          }
        ];
      }
    });
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
    /* 和流向图同理：力导向图的点与边都要能落成表，才算「可读的数据」 */
    chartTools(host, {
      name: 'graph',
      table: function () {
        var nodeName = {};
        D.graph.nodes.forEach(function (n) { nodeName[n.id] = P(n.label); });
        return [
          {
            caption: P(D.graph.caption) + ' · ' + P({ zh: '节点', en: 'Nodes' }),
            cols: [
              { key: 'label', label: P({ zh: '要素', en: 'Element' }) },
              { key: 'g', label: P({ zh: '分组', en: 'Group' }) },
              { key: 'rel', label: P({ zh: '关联数', en: 'Links' }) },
              { key: 'desc', label: P({ zh: '说明', en: 'Note' }) }
            ],
            rows: D.graph.nodes.map(function (n) {
              return {
                label: P(n.label), g: groupLabel[n.g] || n.g,
                rel: relCount(n.id), desc: P(n.desc)
              };
            })
          },
          {
            caption: P(D.graph.caption) + ' · ' + P({ zh: '关系', en: 'Relations' }),
            cols: [
              { key: 's', label: P({ zh: '起点', en: 'From' }) },
              { key: 'r', label: P({ zh: '关系', en: 'Relation' }) },
              { key: 't', label: P({ zh: '终点', en: 'To' }) }
            ],
            rows: D.graph.links.map(function (l) {
              return { s: nodeName[l.s] || l.s, r: P(l.r), t: nodeName[l.t] || l.t };
            })
          }
        ];
      }
    });
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

    function apply(init) {
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
      /* 旋钮动了，下面两张敏感性图也要跟着重算（首次渲染由 renderAll 直接跑，不重复） */
      if (!init) scheduleSens();
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
    apply(true);
  }

  /* =========================================================
   * ⑩b 敏感性分析（B4）：龙卷风图 + 蒙特卡洛分布
   * ---------------------------------------------------------
   * 两幅图都直接算 D.sim.model()，所以「旋钮位置 → 图」永远是同一份逻辑：
   *   龙卷风：一次只把一个因素从 0 拉到 100，看指数区间有多宽；
   *   蒙特卡洛：四个因素同时 ±15% 随机扰动，抽 500 次看结果分布。
   * 随机数用固定种子的 mulberry32 —— 换语言 / 换主题重绘时必须得到同一批样本，
   * 否则用户一切主题就「重新抽了一次」，图会莫名其妙地跳。
   * ========================================================= */
  function rand32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp100(v) { return Math.max(0, Math.min(100, v)); }

  /* 纯计算：龙卷风 4 行 + 蒙特卡洛直方图。不碰 DOM，便于复用与自测 */
  function sensStats() {
    var S = D.sim.sensitivity;
    var K = palette();
    var cur = STATE.sim;
    var colors = [K.primary, K.accent, K.info, K.d5];

    var rows = D.sim.sliders.map(function (s, i) {
      var lo = {}, hi = {};
      D.sim.sliders.forEach(function (o) { lo[o.id] = cur[o.id]; hi[o.id] = cur[o.id]; });
      lo[s.id] = 0;
      hi[s.id] = 100;
      return {
        id: s.id,
        label: P(s.label),
        low: D.sim.model(lo).index,
        high: D.sim.model(hi).index,
        knob: cur[s.id],
        color: colors[i % colors.length]
      };
    });
    rows.sort(function (a, b) { return (b.high - b.low) - (a.high - a.low); });

    var rnd = rand32(S.seed);
    var spread = S.perturb * 100;
    var samples = [];
    for (var d = 0; d < S.draws; d++) {
      var v = {};
      D.sim.sliders.forEach(function (s) { v[s.id] = clamp100(cur[s.id] + (rnd() * 2 - 1) * spread); });
      samples.push(D.sim.model(v).index);
    }
    samples.sort(function (a, b) { return a - b; });
    var at = function (q) { return samples[Math.min(samples.length - 1, Math.max(0, Math.floor(q * samples.length)))]; };

    /* 直方图：18 个等宽桶；范围取 5 的整数倍、且至少 10 宽，刻度才好读 */
    var lo = Math.floor(Math.min.apply(null, samples) / 5) * 5;
    var hi = Math.ceil(Math.max.apply(null, samples) / 5) * 5;
    if (hi - lo < 10) hi = lo + 10;
    var nBins = 18;
    var w = (hi - lo) / nBins;
    var bins = [];
    for (var b = 0; b < nBins; b++) bins.push({ x0: lo + b * w, x1: lo + (b + 1) * w, count: 0 });
    samples.forEach(function (v) {
      bins[Math.min(nBins - 1, Math.floor((v - lo) / w))].count++;
    });

    return {
      rows: rows,
      current: D.sim.model(cur).index,
      bins: bins,
      xMin: lo,
      xMax: hi,
      p5: at(0.05),
      p50: at(0.5),
      p95: at(0.95),
      draws: S.draws
    };
  }

  /* 重算入口：滑块连续拖动时防抖，避免每一帧都重画两张图 */
  function scheduleSens() {
    if (!STATE.sensReady) return;
    if (STATE.sensTimer) window.clearTimeout(STATE.sensTimer);
    STATE.sensTimer = window.setTimeout(function () {
      STATE.sensTimer = 0;
      renderSensitivity();
    }, 90);
  }

  function renderSensitivity() {
    var hostT = $('#chart-tornado');
    var hostM = $('#chart-mc');
    if (!hostT || !hostM) return;
    var S = D.sim.sensitivity;
    var st = sensStats();

    /* —— ① 龙卷风图：一根条 = 一个因素能影响的区间 —— */
    cardHead('tornado', P(S.tornadoTitle));
    chartTools(hostT, {
      name: 'tornado',
      table: function () {
        return {
          caption: P(S.tornadoTitle) + ' · ' + P(S.target),
          cols: [
            { key: 'factor', label: P({ zh: '因素', en: 'Factor' }) },
            { key: 'knob', label: withUnit(P({ zh: '当前设定', en: 'Current setting' }), '%') },
            { key: 'low', label: P(S.lowLabel) },
            { key: 'high', label: P(S.highLabel) },
            { key: 'swing', label: P(S.swingLabel) }
          ],
          rows: st.rows.map(function (r) {
            return { factor: r.label, knob: r.knob, low: r.low, high: r.high, swing: r.high - r.low };
          })
        };
      }
    });
    var lows = st.rows.map(function (r) { return r.low; }).concat([st.current]);
    var highs = st.rows.map(function (r) { return r.high; }).concat([st.current]);
    C.tornado(hostT, {
      rows: st.rows,
      current: st.current,
      xMin: Math.max(0, Math.floor((Math.min.apply(null, lows) - 4) / 5) * 5),
      xMax: Math.min(100, Math.ceil((Math.max.apply(null, highs) + 4) / 5) * 5),
      decimals: 0,
      xLabel: withUnit(P(S.target), '0–100'),
      rangeLabel: P(S.sweepLabel),
      currentLabel: P(S.currentLabel),
      lowLabel: P(S.lowLabel),
      highLabel: P(S.highLabel),
      swingLabel: P(S.swingLabel),
      knobLabel: P({ zh: '旋钮', en: 'knob' }),
      unit: ''
    });
    cardFoot('tornado', P(S.tornadoHint), '');

    /* —— ② 蒙特卡洛：500 次抽样落进 18 个桶 —— */
    cardHead('mc', P(S.mcTitle));
    chartTools(hostM, {
      name: 'mc',
      table: function () {
        return {
          caption: P(S.mcTitle) + ' · ' + P(S.target),
          cols: [
            { key: 'range', label: P({ zh: '区间', en: 'Interval' }) },
            { key: 'count', label: withUnit(P(S.countLabel), P({ zh: '次', en: 'draws' })) },
            { key: 'share', label: withUnit(P({ zh: '占比', en: 'Share' }), '%') }
          ],
          rows: st.bins.map(function (b) {
            return {
              range: C.fmt(b.x0, 0) + ' – ' + C.fmt(b.x1, 0),
              count: b.count,
              share: +((b.count / st.draws) * 100).toFixed(1)
            };
          })
        };
      }
    });
    C.monteCarlo(hostM, {
      bins: st.bins,
      xMin: st.xMin,
      xMax: st.xMax,
      p5: st.p5,
      p50: st.p50,
      p95: st.p95,
      current: st.current,
      draws: st.draws,
      decimals: 0,
      unit: '',
      xLabel: withUnit(P(S.target), '0–100'),
      countLabel: P(S.countLabel),
      shareLabel: P({ zh: '占比', en: 'Share' }),
      p5Label: P(S.p5Label),
      p50Label: P(S.p50Label),
      p95Label: P(S.p95Label),
      currentLabel: P(S.currentLabel)
    });
    cardFoot('mc', P(S.mcHint), '');
    STATE.sensReady = true;
  }

  /* ---------------- ⑪ 时间线 ---------------- */
  function renderTimeline() {
    var host = $('#chart-timeline');
    if (!host) return;
    var K = { world: C.colorOf('--c-info'), cn: C.colorOf('--c-accent') };
    var kindLabel = {};
    D.timeline.kinds.forEach(function (k) { kindLabel[k.id] = P(k.label); });
    cardHead('timeline', P(D.timeline.caption));
    chartTools(host, {
      name: 'timeline',
      table: function () {
        return {
          caption: P(D.timeline.caption),
          cols: [
            { key: 'year', label: P({ zh: '年份', en: 'Year' }) },
            { key: 'kind', label: P({ zh: '类型', en: 'Type' }) },
            { key: 'title', label: P({ zh: '事件', en: 'Event' }) },
            { key: 'desc', label: P({ zh: '说明', en: 'Note' }) }
          ],
          rows: D.timeline.items.map(function (it) {
            return {
              year: it.year, kind: kindLabel[it.kind] || it.kind,
              title: P(it.title), desc: P(it.desc)
            };
          })
        };
      }
    });
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

    /* 跨图联动（接收端）：只留和选中行业对得上的场景。
       match 是 data.js 里的稳定键，不是中文名。 */
    var p = pickedPoint();
    var shown = p ? D.scenes.items.filter(function (s) { return s.match === p.id; }) : D.scenes.items;

    var head = mount('scene-head');
    if (head) {
      var status = add(head, 'p', 'viz-live', p
        ? TT('filter.sceneOn', { name: P(p.name), n: shown.length, total: D.scenes.items.length })
        : TT('filter.sceneOff', { total: D.scenes.items.length }));
      status.setAttribute('role', 'status');
    }

    /* 兜底：有 7 个行业确实还没收录场景。空集要给出口，不能留白。 */
    if (!shown.length) {
      var empty = add(host, 'div', 'scene-empty');
      add(empty, 'p', null, TT('filter.noScene', { name: P(p.name) }));
      var back = node('button', 'viz-btn', T('filter.clear'));
      back.type = 'button';
      back.addEventListener('click', function () { setFilter(null); });
      empty.appendChild(back);
    }

    shown.forEach(function (s) {
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
    renderHeatmap();
    renderMultiples();
    renderGlobal();
    renderRegion();
    renderFlow();
    renderGraph();
    renderSim();
    renderSensitivity();
    renderTimeline();
    renderScenes();
    renderSources();
    renderOverview();
    describeCharts();
  }

  /* 让读屏知道「这是一张图、它在讲什么」（切语言后会重新写入） */
  function describeCharts() {
    [
      ['chart-radar', D.radar.caption],
      ['chart-scale', D.scale.caption],
      ['chart-industry', D.industry.caption],
      ['chart-bubble', D.bubble.caption],
      ['chart-heat', D.heatmap.caption],
      ['chart-multiples', D.multiples.caption],
      ['chart-global', D.globalRank.caption],
      ['chart-region', D.province.caption],
      ['chart-flow', D.flow.caption],
      ['chart-graph', D.graph.caption],
      ['sim-root', D.sim.caption],
      ['chart-tornado', D.sim.sensitivity.tornadoTitle],
      ['chart-mc', D.sim.sensitivity.mcTitle],
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

  /* ---------------- 顶栏收缩 + 阅读进度 + 回到顶部 ---------------- */
  function bindScrollUI() {
    var top = $('#to-top');
    var bar = $('.topbar');
    var readbar = $('#readbar');
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (bar) bar.classList.toggle('is-scrolled', y > 12);
      if (top) top.classList.toggle('is-on', y > 640);
      if (readbar) {
        /* 长页面（桌面约 14,000px）需要一个位置感：0 → 1 映射到整页高度 */
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        readbar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (top) {
      top.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* 图表按「容器实际宽度」出图（viewBox 与屏幕 1:1），所以宽度变化超过 24px 才重画：
       地址栏收放、桌面 1~2px 抖动都不触发，避免动画反复播放 */
    var lastW = document.documentElement.clientWidth;
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      if (Math.abs(document.documentElement.clientWidth - lastW) < 24) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        lastW = document.documentElement.clientWidth;
        renderAll();
      }, 180);
    }, { passive: true });
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

