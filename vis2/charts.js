/* =========================================================
 * charts.js —— 纯 SVG 可视化引擎（无第三方依赖，力导向除外）
 * ---------------------------------------------------------
 * 设计约定：
 *   ① 所有颜色都从 tokens.css 的计算样式里读（readTokens），
 *      因此切换亮/暗主题时只需重绘一次，图表自动换肤；
 *   ② 每张图都用 viewBox + preserveAspectRatio 自适应容器宽度；
 *   ③ 每张图内部自建一个 tooltip 节点，悬停显示数值；
 *   ④ 动画统一走 rAF + easeOutCubic，并在
 *      prefers-reduced-motion: reduce 时自动跳过。
 * ========================================================= */
window.CHARTS = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------- 基础工具 ---------------- */

  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) {
          node.setAttribute(k, String(attrs[k]));
        }
      }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function div(cls, parent, html) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    if (parent) parent.appendChild(d);
    return d;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* 从 :root 读取设计令牌，得到当前主题下的真实色值 */
  function readTokens() {
    var cs = getComputedStyle(document.documentElement);
    var keys = ['--c-primary', '--c-primary-2', '--c-accent', '--c-info', '--c-success', '--c-warn',
      '--c-danger', '--c-text', '--c-text-soft', '--c-muted', '--c-border', '--c-border-2',
      '--c-surface', '--c-surface-2', '--c-bg', '--d1', '--d2', '--d3', '--d4', '--d5', '--d6'];
    var out = {};
    for (var i = 0; i < keys.length; i++) out[keys[i]] = cs.getPropertyValue(keys[i]).trim() || '#888';
    return out;
  }

  /* 把 #0f766e 之类的十六进制色转成 rgba，用于半透明填充与光晕 */
  function alpha(color, a) {
    var c = String(color).trim();
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) {
      var n = parseInt(m[1], 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) {
      var s = m[1];
      return 'rgba(' + parseInt(s[0] + s[0], 16) + ',' + parseInt(s[1] + s[1], 16) + ',' + parseInt(s[2] + s[2], 16) + ',' + a + ')';
    }
    return c;   /* 已是 rgb()/颜色关键字时原样返回 */
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(duration, onFrame, onDone) {
    if (REDUCE) { onFrame(1); if (onDone) onDone(); return; }
    var start = null;
    function step(ts) {
      if (start == null) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      onFrame(easeOutCubic(p));
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    }
    requestAnimationFrame(step);
  }

  function fmt(n, d) {
    var v = Number(n);
    if (isNaN(v)) return String(n);
    var s = v.toFixed(d == null ? 0 : d);
    if (d) s = s.replace(/\.?0+$/, '');
    /* 千分位 */
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /* ---------------- 每个图表自带的 tooltip ---------------- */

  function stage(container, ratio) {
    container.classList.add('viz');
    clear(container);
    var svg = el('svg', {
      class: 'viz-svg',
      viewBox: '0 0 ' + ratio[0] + ' ' + ratio[1],
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img'
    });
    container.appendChild(svg);
    var tip = div('viz-tip', container);
    tip.hidden = true;
    return { svg: svg, tip: tip, w: ratio[0], h: ratio[1] };
  }

  function showTip(ctx, html, x, y) {
    ctx.tip.innerHTML = html;
    ctx.tip.hidden = false;
    var box = ctx.tip.getBoundingClientRect();
    var host = ctx.tip.parentNode.getBoundingClientRect();
    var left = x - box.width / 2;
    left = Math.max(4, Math.min(host.width - box.width - 4, left));
    var top = y - box.height - 12;
    if (top < 4) top = y + 16;
    ctx.tip.style.left = left + 'px';
    ctx.tip.style.top = top + 'px';
  }
  function hideTip(ctx) { ctx.tip.hidden = true; }

  /* 用图例（DOM）替代 SVG 内文字，便于换行与无障碍 */
  function legend(container, items) {
    var wrap = div('viz-legend', container);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var row = div('viz-legend-item', wrap);
      var swatch = div('viz-legend-swatch', row);
      if (it.shape === 'line') swatch.classList.add('is-line');
      if (it.shape === 'dash') swatch.classList.add('is-dash');
      swatch.style.background = it.color;
      div('viz-legend-label', row, it.label);
      if (it.value != null) div('viz-legend-value', row, it.value);
    }
    return wrap;
  }

  /* 坐标轴刻度格式化 */
  function niceTicks(min, max, count) {
    var span = max - min || 1;
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var ticks = [];
    for (var v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  /* =========================================================
   * ① 雷达图：传统生产力 vs AI 赋能新质生产力
   * ========================================================= */
  function radar(container, cfg) {
    var ctx = stage(container, [560, 430]);
    var T = readTokens();
    var svg = ctx.svg;
    var cx = 280, cy = 218, R = 132;
    var n = cfg.axes.length;
    var max = cfg.max || 100;
    var i;

    function pt(i, ratio) {
      var ang = -Math.PI / 2 + (i * 2 * Math.PI / n);
      return [cx + Math.cos(ang) * R * ratio, cy + Math.sin(ang) * R * ratio];
    }

    /* 网格：4 圈 + 轴线 */
    var grid = el('g', { class: 'viz-grid' }, svg);
    for (var ring = 1; ring <= 4; ring++) {
      var d = '';
      for (i = 0; i < n; i++) {
        var p = pt(i, ring / 4);
        d += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      el('path', { d: d + 'Z', fill: 'none', stroke: T['--c-border'], 'stroke-width': ring === 4 ? 1.6 : 1 }, grid);
    }
    for (i = 0; i < n; i++) {
      var o = pt(i, 1);
      el('line', { x1: cx, y1: cy, x2: o[0], y2: o[1], stroke: T['--c-border'], 'stroke-width': 1 }, grid);
    }

    /* 轴标签 */
    for (i = 0; i < n; i++) {
      var lp = pt(i, 1.24);
      var anchor = Math.abs(lp[0] - cx) < 6 ? 'middle' : (lp[0] > cx ? 'start' : 'end');
      var t = el('text', {
        x: lp[0].toFixed(1), y: (lp[1] + 4).toFixed(1), 'text-anchor': anchor,
        fill: T['--c-text-soft'], 'font-size': 12.5, 'font-weight': 700
      }, svg);
      t.textContent = cfg.axes[i];
    }
    /* 50 / 100 刻度提示 */
    [50, 100].forEach(function (v) {
      var rp = pt(0, v / max);
      el('text', { x: cx + 7, y: rp[1] + 13, fill: T['--c-muted'], 'font-size': 10.5 }, svg).textContent = v;
    });

    /* 数据多边形 */
    var recs = cfg.series.map(function (s) {
      var poly = el('path', {
        fill: alpha(s.color, 0.16), stroke: s.color, 'stroke-width': 2.4,
        'stroke-linejoin': 'round'
      }, svg);
      var dots = el('g', null, svg);
      return { s: s, poly: poly, dots: dots };
    });

    function draw(ratio) {
      recs.forEach(function (rec) {
        var d = '';
        for (var k = 0; k < n; k++) {
          var p = pt(k, (rec.s.values[k] / max) * ratio);
          d += (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        }
        rec.poly.setAttribute('d', d + 'Z');
        clear(rec.dots);
        for (var k2 = 0; k2 < n; k2++) {
          var q = pt(k2, (rec.s.values[k2] / max) * ratio);
          el('circle', {
            cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 3.6,
            fill: T['--c-surface'], stroke: rec.s.color, 'stroke-width': 2
          }, rec.dots);
        }
      });
    }
    draw(0.001);
    animate(820, draw);

    /* 悬停：显示某个维度的两组数值 */
    var hot = el('g', null, svg);
    for (i = 0; i < n; i++) {
      (function (idx) {
        var p = pt(idx, 1);
        var hit = el('circle', { cx: p[0], cy: p[1], r: 28, fill: 'transparent', style: 'cursor:pointer' }, hot);
        hit.addEventListener('mouseenter', function () {
          var rows = '<b>' + cfg.axes[idx] + '</b>';
          recs.forEach(function (rec) {
            rows += '<span class="viz-tip-row"><i style="background:' + rec.s.color + '"></i>' +
              rec.s.name + '<b>' + fmt(rec.s.values[idx], 0) + '</b></span>';
          });
          showTip(ctx, rows, (p[0] / ctx.w) * container.clientWidth, (p[1] / ctx.h) * container.clientHeight);
        });
        hit.addEventListener('mouseleave', function () { hideTip(ctx); });
      }(i));
    }

    legend(container, cfg.series.map(function (s) {
      var avg = s.values.reduce(function (a, b) { return a + b; }, 0) / s.values.length;
      return { label: s.name, color: s.color, value: fmt(avg, 0) + ' / 100' };
    }));
    return ctx;
  }


  /* =========================================================
   * ② 折线 / 面积图（支持预测段虚线、悬停十字线）
   * ========================================================= */
  function lineArea(container, cfg) {
    var ctx = stage(container, [900, 460]);
    var T = readTokens();
    var svg = ctx.svg;
    var pad = { t: 30, r: 26, b: 46, l: 66 };
    var W = ctx.w, H = ctx.h;
    var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

    var series = cfg.series;
    var n = series[0].points.length;
    var yMax = cfg.yMax || (function () {
      var m = 0;
      series.forEach(function (s) { s.points.forEach(function (p) { if (p.value > m) m = p.value; }); });
      return m * 1.14;
    }());

    function X(i) { return pad.l + (n === 1 ? pw / 2 : (i * pw) / (n - 1)); }
    function Y(v) { return pad.t + ph * (1 - v / yMax); }

    /* 横向网格 + Y 轴刻度 */
    niceTicks(0, yMax, 4).forEach(function (v) {
      var y = Y(v);
      el('line', {
        x1: pad.l, y1: y, x2: pad.l + pw, y2: y, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': v === 0 ? '' : '3 5'
      }, svg);
      el('text', { x: pad.l - 10, y: y + 4, 'text-anchor': 'end', fill: T['--c-muted'], 'font-size': 11.5 }, svg)
        .textContent = fmt(v, 0);
    });
    el('text', { x: pad.l - 10, y: pad.t - 10, 'text-anchor': 'end', fill: T['--c-muted'], 'font-size': 11 }, svg)
      .textContent = cfg.yUnit || '';

    /* X 轴刻度 */
    series[0].points.forEach(function (p, i) {
      el('text', {
        x: X(i), y: pad.t + ph + 24, 'text-anchor': 'middle',
        fill: p.forecast ? T['--c-accent'] : T['--c-text-soft'], 'font-size': 12, 'font-weight': 700
      }, svg).textContent = p.label != null ? p.label : String(p.year != null ? p.year : i + 1);
    });

    /* 平滑路径（Catmull-Rom → 三次贝塞尔） */
    function smooth(pts) {
      if (!pts.length) return '';
      if (pts.length < 3) {
        var simple = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
        for (var z = 1; z < pts.length; z++) simple += 'L' + pts[z][0].toFixed(1) + ' ' + pts[z][1].toFixed(1);
        return simple;
      }
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
          ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d;
    }

    var recs = series.map(function (s) {
      var area = s.fill ? el('path', { fill: alpha(s.color, 0.14), stroke: 'none' }, svg) : null;
      var line = el('path', {
        fill: 'none', stroke: s.color, 'stroke-width': 2.6,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }, svg);
      var dash = el('path', {
        fill: 'none', stroke: s.color, 'stroke-width': 2.6, 'stroke-dasharray': '7 6',
        'stroke-linecap': 'round', opacity: 0
      }, svg);
      return { s: s, area: area, line: line, dash: dash };
    });

    function render(ratio) {
      var upto = Math.max(1, Math.round((n - 1) * ratio));
      recs.forEach(function (rec) {
        var pts = [];
        for (var i = 0; i <= upto && i < n; i++) pts.push([X(i), Y(rec.s.points[i].value)]);
        rec.line.setAttribute('d', smooth(pts));
        if (rec.area) {
          var d = smooth(pts) + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + Y(0).toFixed(1) +
            'L' + pts[0][0].toFixed(1) + ' ' + Y(0).toFixed(1) + 'Z';
          rec.area.setAttribute('d', d);
        }
        if (rec.s.points[n - 1].forecast && upto >= n - 1) {
          rec.dash.setAttribute('d',
            'M' + X(n - 2) + ' ' + Y(rec.s.points[n - 2].value) +
            'L' + X(n - 1) + ' ' + Y(rec.s.points[n - 1].value));
          rec.dash.setAttribute('opacity', 1);
        }
      });
    }
    render(0.001);
    animate(900, render);


    /* 数据点 */
    var dots = el('g', null, svg);
    series.forEach(function (s) {
      s.points.forEach(function (p, i) {
        el('circle', {
          cx: X(i), cy: Y(p.value), r: p.forecast ? 4 : 4.6,
          fill: p.forecast ? T['--c-surface'] : s.color,
          stroke: s.color, 'stroke-width': 2.2
        }, dots);
      });
    });

    /* 悬停十字线 + 数值卡 */
    var cross = el('line', {
      y1: pad.t, y2: pad.t + ph, stroke: T['--c-primary'],
      'stroke-width': 1.4, 'stroke-dasharray': '4 4', opacity: 0
    }, svg);
    var hover = el('rect', { x: pad.l, y: pad.t, width: pw, height: ph, fill: 'transparent', style: 'cursor:crosshair' }, svg);

    hover.addEventListener('mousemove', function (e) {
      var host = container.getBoundingClientRect();
      var ratioX = Math.max(0, Math.min(1, (e.clientX - host.left) / host.width));
      var idx = Math.max(0, Math.min(n - 1, Math.round(((ratioX * W - pad.l) / pw) * (n - 1))));
      cross.setAttribute('x1', X(idx));
      cross.setAttribute('x2', X(idx));
      cross.setAttribute('opacity', 0.75);
      var p0 = series[0].points[idx];
      var rows = '<b>' + (cfg.hoverTitle ? cfg.hoverTitle(idx, p0) : (p0.year || idx)) + '</b>';
      series.forEach(function (s) {
        rows += '<span class="viz-tip-row"><i style="background:' + s.color + '"></i>' + s.name +
          '<b>' + fmt(s.points[idx].value, s.decimals || 0) + (s.unit || '') + '</b></span>';
      });
      showTip(ctx, rows, ratioX * host.width, (Y(p0.value) / H) * host.height);
    });
    hover.addEventListener('mouseleave', function () {
      cross.setAttribute('opacity', 0);
      hideTip(ctx);
    });

    legend(container, series.map(function (s) {
      return {
        label: s.name, color: s.color, shape: 'line',
        value: fmt(s.points[n - 1].value, s.decimals || 0) + (s.unit || '')
      };
    }));
    return ctx;
  }

  /* =========================================================
   * ③ 横向排名条形图（带动画与悬停）
   * ========================================================= */
  function hRankBars(container, cfg) {
    var rows = cfg.rows;
    var rowH = 34, gap = 10;
    var H = rows.length * (rowH + gap) + 34;
    var ctx = stage(container, [900, H]);
    var T = readTokens();
    var svg = ctx.svg;
    var labelW = cfg.labelWidth || 150;
    var valueW = 66;
    var barArea = ctx.w - labelW - valueW - 24;
    var max = cfg.max || Math.max.apply(null, rows.map(function (r) { return r.value; }));
    var unit = cfg.unit || '';

    rows.forEach(function (r, i) {
      var y = 16 + i * (rowH + gap);
      var isTop = i < (cfg.highlight || 2);
      var color = r.color || (isTop ? T['--c-accent'] : T['--c-primary']);

      el('text', {
        x: labelW - 12, y: y + rowH / 2 + 5, 'text-anchor': 'end',
        fill: T['--c-text'], 'font-size': 13.5, 'font-weight': 700
      }, svg).textContent = (r.flag ? r.flag + ' ' : '') + r.name;

      el('rect', { x: labelW, y: y, width: barArea, height: rowH, rx: 6, fill: T['--c-surface-2'] }, svg);

      var bar = el('rect', {
        x: labelW, y: y, width: 0, height: rowH, rx: 6,
        fill: color, opacity: isTop ? 1 : 0.82
      }, svg);
      var shine = el('rect', {
        x: labelW, y: y, width: 0, height: rowH, rx: 6,
        fill: alpha('#ffffff', 0.16)
      }, svg);

      var val = el('text', {
        x: labelW + barArea + 12, y: y + rowH / 2 + 5,
        fill: T['--c-text-soft'], 'font-size': 13, 'font-weight': 800
      }, svg);
      val.textContent = fmt(r.value, cfg.decimals || 0) + unit;

      r._bar = bar; r._shine = shine; r._y = y;
    });

    animate(900, function (p) {
      rows.forEach(function (r) {
        var w = barArea * (r.value / max) * p;
        r._bar.setAttribute('width', w.toFixed(1));
        r._shine.setAttribute('width', (w * 0.42).toFixed(1));
      });
    });

    /* 排名悬停 */
    var hot = el('g', null, svg);
    rows.forEach(function (r) {
      var rect = el('rect', {
        x: 0, y: r._y - 4, width: ctx.w, height: rowH + 8,
        fill: 'transparent', style: 'cursor:pointer'
      }, hot);
      rect.addEventListener('mouseenter', function () {
        r._bar.setAttribute('opacity', 1);
        showTip(ctx, '<b>' + r.name + '</b><span class="viz-tip-row">' + (cfg.metric || '') +
          '<b>' + fmt(r.value, cfg.decimals || 0) + unit + '</b></span>' +
          (r.note ? '<span class="viz-tip-note">' + r.note + '</span>' : ''),
          ((labelW + barArea * (r.value / max) / 2) / ctx.w) * container.clientWidth,
          (r._y / ctx.h) * container.clientHeight);
      });
      rect.addEventListener('mouseleave', function () {
        r._bar.setAttribute('opacity', r.value >= rows[0].value - 8 ? 1 : 0.82);
        hideTip(ctx);
      });
    });
    return ctx;
  }


  /* =========================================================
   * ④ 分组横向条形（每个对象两条指标）
   * ========================================================= */
  function dualBars(container, cfg) {
    var rows = cfg.rows;
    var barGap = 22, barH = 15, headH = 24, noteH = 22;
    var rowH = headH + rows[0].bars.length * barGap + noteH;
    var H = rows.length * rowH + 30;
    var ctx = stage(container, [900, H]);
    var T = readTokens();
    var svg = ctx.svg;
    var labelW = cfg.labelWidth || 150;
    var area = ctx.w - labelW - 76;
    var max = cfg.max || 100;
    var unit = cfg.unit || '%';

    var bars = [];
    rows.forEach(function (r, i) {
      var top = 18 + i * rowH;
      /* 左侧：对象名（放在条形列左侧，不会与条形重叠） */
      el('text', {
        x: labelW - 16, y: top + 10, 'text-anchor': 'end',
        fill: T['--c-text'], 'font-size': 14, 'font-weight': 800
      }, svg).textContent = r.key;

      r.bars.forEach(function (b, j) {
        var y = top + headH + j * barGap;
        el('rect', { x: labelW, y: y, width: area, height: barH, rx: 7.5, fill: T['--c-surface-2'] }, svg);
        var bar = el('rect', { x: labelW, y: y, width: 0, height: barH, rx: 7.5, fill: b.color }, svg);
        var name = el('text', {
          x: labelW + 9, y: y + 12, fill: T['--c-on-primary'],
          'font-size': 11, 'font-weight': 800, 'pointer-events': 'none'
        }, svg);
        name.textContent = b.label;
        var txt = el('text', {
          x: labelW + area + 10, y: y + 12.5, fill: T['--c-text-soft'],
          'font-size': 12, 'font-weight': 800
        }, svg);
        txt.textContent = (cfg.decimals != null ? fmt(b.value, cfg.decimals) : fmt(b.value, 0)) + unit;
        bars.push({ bar: bar, value: b.value });
      });

      /* 右侧下方：一行说明，避免挤占左侧名称列 */
      if (r.note) {
        el('text', {
          x: labelW, y: top + headH + r.bars.length * barGap + 12,
          fill: T['--c-muted'], 'font-size': 11.5
        }, svg).textContent = r.note;
      }
    });


    animate(880, function (p) {
      bars.forEach(function (rec) {
        rec.bar.setAttribute('width', (area * (rec.value / max) * p).toFixed(1));
      });
    });
    return ctx;
  }

  /* =========================================================
   * ⑤ 气泡矩阵图：渗透率 × 效率增益 × 市场规模
   * ========================================================= */
  function bubble(container, cfg) {
    var ctx = stage(container, [900, 500]);
    var T = readTokens();
    var svg = ctx.svg;
    var pad = { t: 26, r: 30, b: 52, l: 62 };
    var W = ctx.w, H = ctx.h;
    var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    var xMax = cfg.xMax || 50, yMax = cfg.yMax || 42;

    function X(v) { return pad.l + pw * (v / xMax); }
    function Y(v) { return pad.t + ph * (1 - v / yMax); }

    /* 四象限底色 */
    el('rect', { x: pad.l, y: pad.t, width: pw / 2, height: ph / 2, fill: alpha(T['--c-primary'], 0.05) }, svg);
    el('rect', { x: pad.l + pw / 2, y: pad.t, width: pw / 2, height: ph / 2, fill: alpha(T['--c-accent'], 0.06) }, svg);
    el('rect', { x: pad.l + pw / 2, y: pad.t + ph / 2, width: pw / 2, height: ph / 2, fill: alpha(T['--c-primary'], 0.03) }, svg);

    /* 网格与刻度 */
    niceTicks(0, xMax, 5).forEach(function (v) {
      el('line', { x1: X(v), y1: pad.t, x2: X(v), y2: pad.t + ph, stroke: T['--c-border'], 'stroke-width': 1, 'stroke-dasharray': '3 5' }, svg);
      el('text', { x: X(v), y: pad.t + ph + 22, 'text-anchor': 'middle', fill: T['--c-muted'], 'font-size': 11.5 }, svg)
        .textContent = fmt(v, 0);
    });
    niceTicks(0, yMax, 4).forEach(function (v) {
      el('line', { x1: pad.l, y1: Y(v), x2: pad.l + pw, y2: Y(v), stroke: T['--c-border'], 'stroke-width': 1, 'stroke-dasharray': '3 5' }, svg);
      el('text', { x: pad.l - 12, y: Y(v) + 4, 'text-anchor': 'end', fill: T['--c-muted'], 'font-size': 11.5 }, svg)
        .textContent = fmt(v, 0);
    });

    /* 中位分割线 */
    el('line', { x1: X(xMax / 2), y1: pad.t, x2: X(xMax / 2), y2: pad.t + ph, stroke: T['--c-primary'], 'stroke-width': 1.6, 'stroke-dasharray': '6 5', opacity: 0.55 }, svg);
    el('line', { x1: pad.l, y1: Y(yMax / 2), x2: pad.l + pw, y2: Y(yMax / 2), stroke: T['--c-primary'], 'stroke-width': 1.6, 'stroke-dasharray': '6 5', opacity: 0.55 }, svg);

    /* 轴标题 */
    el('text', { x: pad.l + pw / 2, y: H - 10, 'text-anchor': 'middle', fill: T['--c-text-soft'], 'font-size': 13, 'font-weight': 700 }, svg)
      .textContent = cfg.xLabel;
    el('text', {
      x: 16, y: pad.t + ph / 2, 'text-anchor': 'middle', fill: T['--c-text-soft'],
      'font-size': 13, 'font-weight': 700, transform: 'rotate(-90 16 ' + (pad.t + ph / 2) + ')'
    }, svg).textContent = cfg.yLabel;

    /* 象限标注：右上 / 左上 / 左下 / 右下 */
    var q = cfg.quadrants || [];
    if (q.length === 4) {
      [[pad.l + 14, pad.t + 22, 'start', 1], [pad.l + pw - 14, pad.t + 22, 'end', 0],
       [pad.l + 14, pad.t + ph - 12, 'start', 2], [pad.l + pw - 14, pad.t + ph - 12, 'end', 3]]
        .forEach(function (pos) {
          el('text', { x: pos[0], y: pos[1], 'text-anchor': pos[2], fill: T['--c-muted'], 'font-size': 11.5, 'font-weight': 800 }, svg)
            .textContent = q[pos[3]];
        });
    }


    /* 气泡：面积 ∝ 市场规模 */
    var sizes = cfg.points.map(function (p) { return p.size; });
    var sMin = Math.min.apply(null, sizes), sMax = Math.max.apply(null, sizes);
    var rMin = 9, rMax = 34;
    var recs = cfg.points.map(function (p) {
      var t = sMax === sMin ? 0.5 : (p.size - sMin) / (sMax - sMin);
      var r = rMin + (rMax - rMin) * Math.sqrt(t);
      var color = p.color || (p.x >= xMax / 2 ? T['--c-accent'] : T['--c-primary']);
      var c = el('circle', {
        cx: X(p.x), cy: Y(p.y), r: 0,
        fill: alpha(color, 0.32), stroke: color, 'stroke-width': 2, style: 'cursor:pointer'
      }, svg);
      return { p: p, node: c, r: r, color: color };
    });
    var labels = el('g', null, svg);
    recs.forEach(function (rec) {
      el('text', {
        x: X(rec.p.x), y: Y(rec.p.y) + 3.5, 'text-anchor': 'middle',
        fill: T['--c-text'], 'font-size': 10.5, 'font-weight': 800, 'pointer-events': 'none'
      }, labels).textContent = rec.p.name;
    });

    animate(860, function (pr) {
      recs.forEach(function (rec) { rec.node.setAttribute('r', (rec.r * pr).toFixed(2)); });
      labels.setAttribute('opacity', Math.max(0, (pr - 0.45) / 0.55).toFixed(2));
    });

    recs.forEach(function (rec) {
      rec.node.addEventListener('mouseenter', function () {
        rec.node.setAttribute('fill', alpha(rec.color, 0.62));
        showTip(ctx, '<b>' + rec.p.name + '</b>' +
          '<span class="viz-tip-row">' + cfg.xLabel + '<b>' + rec.p.x + '%</b></span>' +
          '<span class="viz-tip-row">' + cfg.yLabel + '<b>' + rec.p.y + '%</b></span>' +
          '<span class="viz-tip-row">' + cfg.sizeLabel + '<b>' + fmt(rec.p.size, 0) + '</b></span>',
          (X(rec.p.x) / W) * container.clientWidth, (Y(rec.p.y) / H) * container.clientHeight);
      });
      rec.node.addEventListener('mouseleave', function () {
        rec.node.setAttribute('fill', alpha(rec.color, 0.32));
        hideTip(ctx);
      });
    });
    return ctx;
  }

  /* =========================================================
   * ⑥ 环形仪表（模拟器用）
   * ========================================================= */
  function gauge(container, cfg) {
    var ctx = stage(container, [200, 200]);
    var T = readTokens();
    var svg = ctx.svg;
    var cx = 100, cy = 100, r = 74, sw = 16;
    var circ = 2 * Math.PI * r;

    el('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: T['--c-surface-2'], 'stroke-width': sw }, svg);
    var arc = el('circle', {
      cx: cx, cy: cy, r: r, fill: 'none', stroke: cfg.color || T['--c-primary'],
      'stroke-width': sw, 'stroke-linecap': 'round',
      'stroke-dasharray': circ, 'stroke-dashoffset': circ,
      transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
    }, svg);
    var val = el('text', {
      x: cx, y: cy + 4, 'text-anchor': 'middle', fill: T['--c-text'],
      'font-size': 34, 'font-weight': 800
    }, svg);
    el('text', {
      x: cx, y: cy + 26, 'text-anchor': 'middle', fill: T['--c-muted'], 'font-size': 12, 'font-weight': 700
    }, svg).textContent = cfg.unit || '';

    function set(v) {
      var p = Math.max(0, Math.min(1, v / (cfg.max || 100)));
      arc.setAttribute('stroke-dashoffset', (circ * (1 - p)).toFixed(2));
      val.textContent = fmt(v, cfg.decimals || 0);
    }
    set(0);
    animate(700, function (p) { set(p * (cfg.value || 0)); });
    ctx.update = set;
    return ctx;
  }


  /* =========================================================
   * ⑦ 要素流向图（桑基风格，纯贝塞尔曲线）
   * ========================================================= */
  function flowChart(container, cfg) {
    var ctx = stage(container, [900, 470]);
    var T = readTokens();
    var svg = ctx.svg;
    var H = ctx.h;
    var nodeW = 16, padY = 30, gapY = 14;
    var colX = [130, 450, 770];
    var nodeMap = {};
    cfg.nodes.forEach(function (n) { nodeMap[n.id] = n; });

    /* 每一列内部按权重分配纵向位置 */
    [0, 1, 2].forEach(function (c) {
      var list = cfg.nodes.filter(function (n) { return n.col === c; });
      var total = list.reduce(function (a, b) { return a + b.weight; }, 0);
      var usable = H - padY * 2 - (list.length - 1) * gapY;
      var y = padY;
      list.forEach(function (n) {
        n.h = Math.max(26, (n.weight / total) * usable);
        n.y = y;
        y += n.h + gapY;
      });
    });
    cfg.nodes.forEach(function (n) { n.outUsed = 0; n.inUsed = 0; });

    /* 连线端点：同一节点上的多条线依次排开，互不重叠 */
    var linkEls = cfg.links.map(function (l) {
      var a = nodeMap[l.from], b = nodeMap[l.to];
      var ah = (l.value / a.weight) * a.h;
      var bh = (l.value / b.weight) * b.h;
      var ay = a.y + a.outUsed + ah / 2;
      var by = b.y + b.inUsed + bh / 2;
      a.outUsed += ah;
      b.inUsed += bh;
      return { l: l, a: a, b: b, ay: ay, by: by, x1: colX[a.col] + nodeW, x2: colX[b.col], w: Math.max(2, l.value * 0.95) };
    });

    var gLinks = el('g', null, svg);
    linkEls.forEach(function (rec) {
      var mx = (rec.x1 + rec.x2) / 2;
      rec.path = el('path', {
        d: 'M' + rec.x1 + ' ' + rec.ay + 'C' + mx + ' ' + rec.ay + ' ' + mx + ' ' + rec.by + ' ' + rec.x2 + ' ' + rec.by,
        fill: 'none',
        stroke: rec.a.col === 0 ? T['--c-info'] : T['--c-primary'],
        'stroke-width': 0.4,
        'stroke-opacity': 0.3,
        'stroke-linecap': 'butt'
      }, gLinks);
    });
    /* 带宽由 0 生长到目标宽度：比虚线动画更贴合「流量」的直觉 */
    animate(950, function (p) {
      linkEls.forEach(function (rec) { rec.path.setAttribute('stroke-width', (rec.w * p).toFixed(2)); });
    });

    var gNodes = el('g', null, svg);
    cfg.nodes.forEach(function (n) {
      var color = n.col === 0 ? T['--c-info'] : (n.col === 1 ? T['--c-primary'] : T['--c-success']);
      var right = n.col === 2;
      var rect = el('rect', {
        x: colX[n.col], y: n.y, width: nodeW, height: n.h, rx: 5,
        fill: color, style: 'cursor:pointer'
      }, gNodes);
      el('text', {
        x: right ? colX[n.col] - 12 : colX[n.col] + nodeW + 12,
        y: n.y + n.h / 2 + (n.h > 44 ? -2 : 4),
        'text-anchor': right ? 'end' : 'start',
        fill: T['--c-text'], 'font-size': 12.5, 'font-weight': 700, 'pointer-events': 'none'
      }, gNodes).textContent = (n.icon ? n.icon + ' ' : '') + n.label;
      if (n.h > 44) {
        el('text', {
          x: right ? colX[n.col] - 12 : colX[n.col] + nodeW + 12,
          y: n.y + n.h / 2 + 15,
          'text-anchor': right ? 'end' : 'start',
          fill: T['--c-muted'], 'font-size': 10.5, 'pointer-events': 'none'
        }, gNodes).textContent = (cfg.weightLabel || '权重') + ' ' + fmt(n.weight, 0) + '%';
      }

      /* 悬停：只保留该节点相关的流向 */
      rect.addEventListener('mouseenter', function () {
        linkEls.forEach(function (rec) {
          var on = rec.a.id === n.id || rec.b.id === n.id;
          rec.path.setAttribute('stroke-opacity', on ? 0.85 : 0.06);
          rec.path.setAttribute('stroke-width', (on ? rec.w * 1.25 : rec.w).toFixed(2));
        });
        rect.setAttribute('stroke', T['--c-text']);
        rect.setAttribute('stroke-width', 2);
      });
      rect.addEventListener('mouseleave', function () {
        linkEls.forEach(function (rec) {
          rec.path.setAttribute('stroke-opacity', 0.3);
          rec.path.setAttribute('stroke-width', rec.w.toFixed(2));
        });
        rect.removeAttribute('stroke');
        rect.removeAttribute('stroke-width');
      });
    });

    /* 列标题 */
    (cfg.columns || []).forEach(function (label, i) {
      el('text', {
        x: colX[i] + nodeW / 2, y: 15, 'text-anchor': 'middle',
        fill: T['--c-text-soft'], 'font-size': 12.5, 'font-weight': 800
      }, svg).textContent = label;
    });
    return ctx;
  }


  /* =========================================================
   * ⑧ 力导向关系图谱（d3-force，本地内置）
   * ---------------------------------------------------------
   * 交互与第 1 次作业保持一致：
   *   · 按住节点拖动，松手停在放下的位置
   *   · 悬停高亮邻接
   *   · 滚轮缩放、空白处拖拽平移
   *   · 提供「适应窗口」复位
   * ========================================================= */
  function forceGraph(container, cfg) {
    var W = 960, H = 620;
    container.classList.add('viz');
    clear(container);
    var svg = el('svg', {
      class: 'viz-svg viz-svg--graph',
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img'
    });
    container.appendChild(svg);
    var tip = div('viz-tip', container);
    tip.hidden = true;
    var ctx = { svg: svg, tip: tip, w: W, h: H, container: container };

    var T = readTokens();
    if (!window.d3 || !window.d3.forceSimulation) {
      div('viz-error', container, '力导向引擎（d3-force）未加载，请确认 vendor/ 目录完整。');
      return ctx;
    }

    var root = el('g', null, svg);
    var gLink = el('g', null, root);
    var gNode = el('g', null, root);

    var nodes = cfg.nodes.map(function (n) {
      return { id: n.id, label: n.label, group: n.group, size: n.size, desc: n.desc, color: cfg.colors[n.group] };
    });
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    var links = cfg.links.map(function (l) {
      return { source: byId[l.s], target: byId[l.t], rel: l.r };
    }).filter(function (l) { return l.source && l.target; });

    var sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(function (l) {
        return 92 + (l.source.size + l.target.size) * 0.6;
      }).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-560))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide().radius(function (d) { return d.size + 16; }))
      .force('x', d3.forceX(W / 2).strength(0.04))
      .force('y', d3.forceY(H / 2).strength(0.05));

    /* 连线 */
    var linkSel = d3.select(gLink).selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', T['--c-border-2'])
      .attr('stroke-width', 1.4)
      .attr('stroke-opacity', 0.75);

    /* 节点 */
    var nodeSel = d3.select(gNode).selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'kg-node')
      .style('cursor', 'grab');

    nodeSel.append('circle')
      .attr('r', function (d) { return d.size; })
      .attr('fill', function (d) { return alpha(d.color, 0.18); })
      .attr('stroke', function (d) { return d.color; })
      .attr('stroke-width', 2.2);

    nodeSel.append('circle')
      .attr('r', function (d) { return d.size * 0.34; })
      .attr('fill', function (d) { return d.color; })
      .attr('pointer-events', 'none');

    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', function (d) { return d.size + 15; })
      .attr('fill', T['--c-text'])
      .attr('font-size', 12.5)
      .attr('font-weight', 700)
      .attr('paint-order', 'stroke')
      .attr('stroke', T['--c-surface'])
      .attr('stroke-width', 3.5)
      .attr('pointer-events', 'none')
      .text(function (d) { return d.label; });

    nodeSel.on('mouseenter', function (event, d) {
      var near = {};
      near[d.id] = true;
      links.forEach(function (l) {
        if (l.source.id === d.id) near[l.target.id] = true;
        if (l.target.id === d.id) near[l.source.id] = true;
      });
      nodeSel.attr('opacity', function (n) { return near[n.id] ? 1 : 0.22; });
      linkSel.attr('stroke-opacity', function (l) {
        return (l.source.id === d.id || l.target.id === d.id) ? 0.95 : 0.08;
      }).attr('stroke', function (l) {
        return (l.source.id === d.id || l.target.id === d.id) ? T['--c-primary'] : T['--c-border-2'];
      });
      var rows = '<b>' + d.label + '</b><span class="viz-tip-note">' + (d.desc || '') + '</span>' +
        '<span class="viz-tip-row">' + cfg.groupLabel[d.group] + '<b>' + cfg.relCount(d.id) + '</b></span>';
      showTip(ctx, rows, (d.x / W) * container.clientWidth, (d.y / H) * container.clientHeight);
    })
      .on('mouseleave', function () {
        nodeSel.attr('opacity', 1);
        linkSel.attr('stroke-opacity', 0.75).attr('stroke', T['--c-border-2']);
        hideTip(ctx);
      });


    /* ---------------- 视口：缩放 / 平移 ---------------- */
    var view = { k: 1, x: 0, y: 0 };
    function applyView() {
      root.setAttribute('transform', 'translate(' + view.x + ',' + view.y + ') scale(' + view.k + ')');
    }
    function svgPoint(evt) {
      var p = svg.createSVGPoint();
      p.x = evt.clientX; p.y = evt.clientY;
      return p.matrixTransform(root.getScreenCTM().inverse());
    }
    function scaleToScreen() {
      /* 视口单位 → 屏幕像素的换算（viewBox 与容器等比，故取宽度即可） */
      var r = svg.getBoundingClientRect();
      return r.width ? W / r.width : 1;
    }

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var before = svgPoint(e);
      view.k = Math.max(0.45, Math.min(3, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      applyView();
      var after = svgPoint(e);
      view.x += (before.x - after.x) * view.k;
      view.y += (before.y - after.y) * view.k;
      applyView();
    }, { passive: false });

    var panning = false, panStart = null;
    svg.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.kg-node')) return;
      panning = true;
      panStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      svg.setPointerCapture(e.pointerId);
      svg.style.cursor = 'grabbing';
    });
    svg.addEventListener('pointermove', function (e) {
      if (!panning) return;
      var f = scaleToScreen() / view.k;
      view.x = panStart.vx + (e.clientX - panStart.x) * f;
      view.y = panStart.vy + (e.clientY - panStart.y) * f;
      applyView();
    });
    svg.addEventListener('pointerup', function () {
      panning = false;
      svg.style.cursor = '';
    });

    /* ---------------- 节点拖拽 ---------------- */
    var dragging = null;
    nodeSel.on('pointerdown', function (event, d) {
      event.stopPropagation();
      dragging = d;
      d.fx = d.x; d.fy = d.y;
      sim.alphaTarget(0.25).restart();
      var t = event.currentTarget;
      t.style.cursor = 'grabbing';
      t.setPointerCapture(event.pointerId);
    });
    nodeSel.on('pointermove', function (event, d) {
      if (dragging !== d) return;
      var p = svgPoint(event);
      d.fx = p.x; d.fy = p.y;
    });
    nodeSel.on('pointerup', function (event, d) {
      var t = event.currentTarget;
      t.style.cursor = 'grab';
      dragging = null;
      sim.alphaTarget(0);
      /* 松手后固定在该位置，双击可释放 */
      t.addEventListener('dblclick', function () { d.fx = null; d.fy = null; sim.alphaTarget(0.2).restart(); setTimeout(function () { sim.alphaTarget(0); }, 260); });
    });

    /* ---------------- 渲染循环 ---------------- */
    function paint() {
      linkSel
        .attr('x1', function (l) { return l.source.x; })
        .attr('y1', function (l) { return l.source.y; })
        .attr('x2', function (l) { return l.target.x; })
        .attr('y2', function (l) { return l.target.y; });
      nodeSel.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    }
    sim.on('tick', paint);

    if (REDUCE) {
      sim.stop();
      for (var t = 0; t < 320; t++) sim.tick();
      paint();
    } else {
      paint();
    }

    /* ---------------- 控制条与图例 ---------------- */
    var bar = div('viz-toolbar', container);
    var fitBtn = document.createElement('button');
    fitBtn.type = 'button';
    fitBtn.className = 'viz-btn';
    fitBtn.textContent = cfg.fitLabel;
    fitBtn.addEventListener('click', function () {
      view.k = 1; view.x = 0; view.y = 0; applyView();
    });
    bar.appendChild(fitBtn);
    div('viz-hint', bar, cfg.hint);

    legend(container, Object.keys(cfg.colors).map(function (g) {
      return { label: cfg.groupLabel[g], color: cfg.colors[g], value: String(cfg.countBy(g)) };
    }));

    ctx.fit = function () { view.k = 1; view.x = 0; view.y = 0; applyView(); };
    ctx.destroy = function () { sim.stop(); };
    applyView();
    return ctx;
  }



  /* =========================================================
   * ⑨ 垂直时间线（中轴 + 交替卡片）
   * ========================================================= */
  function timelineRail(container, cfg) {
    var items = cfg.items;
    var rowH = 104, top = 58, bottom = 40;
    var H = top + items.length * rowH + bottom;
    var ctx = stage(container, [900, H]);
    var T = readTokens();
    var svg = ctx.svg;
    var W = ctx.w;
    var axis = W / 2;
    var cardW = W / 2 - 78;

    var line = el('line', {
      x1: axis, y1: top - 30, x2: axis, y2: top - 30,
      stroke: T['--c-border-2'], 'stroke-width': 2
    }, svg);
    var nodes = [];

    items.forEach(function (it, i) {
      var y = top + i * rowH;
      var right = i % 2 === 1;
      var color = cfg.colors[it.kind] || T['--c-primary'];
      var g = el('g', { opacity: 0 }, svg);
      nodes.push(g);

      el('line', {
        x1: right ? axis : axis - 26, y1: y, x2: right ? axis + 26 : axis,
        y2: y, stroke: color, 'stroke-width': 2
      }, g);
      el('circle', { cx: axis, cy: y, r: 8, fill: T['--c-surface'], stroke: color, 'stroke-width': 3 }, g);
      el('text', {
        x: right ? axis - 22 : axis + 22, y: y + 5,
        'text-anchor': right ? 'end' : 'start',
        fill: color, 'font-size': 18, 'font-weight': 800
      }, g).textContent = it.year;

      var cx = right ? axis + 26 : axis - 26 - cardW;
      el('rect', {
        x: cx, y: y - 42, width: cardW, height: 84, rx: 12,
        fill: T['--c-surface'], stroke: T['--c-border'], 'stroke-width': 1
      }, g);
      el('rect', { x: cx, y: y - 42, width: 4, height: 84, rx: 2, fill: color }, g);
      el('text', { x: cx + 18, y: y - 18, fill: T['--c-text'], 'font-size': 15, 'font-weight': 800 }, g)
        .textContent = it.title;
      el('text', {
        x: cx + cardW - 16, y: y - 18, 'text-anchor': 'end',
        fill: color, 'font-size': 11.5, 'font-weight': 700
      }, g).textContent = cfg.kindLabel[it.kind] || '';

      wrapText(g, it.desc, cx + 18, y + 4, cardW - 36, 17, 3, T['--c-text-soft']);
    });

    animate(900, function (p) {
      line.setAttribute('y2', (top - 30 + items.length * rowH * p).toFixed(1));
      nodes.forEach(function (g, i) {
        var local = Math.max(0, Math.min(1, (p - i / items.length * 0.72) / 0.28));
        g.setAttribute('opacity', local.toFixed(2));
        g.setAttribute('transform', 'translate(0,' + ((1 - local) * 14).toFixed(1) + ')');
      });
    });

    legend(container, cfg.kinds.map(function (k) {
      return {
        label: k.label, color: cfg.colors[k.id],
        value: String(items.filter(function (i) { return i.kind === k.id; }).length)
      };
    }));
    return ctx;
  }

  /* 简易自动换行：按字数估算，最多 maxLines 行，超出补省略号 */
  function wrapText(parent, text, x, y, maxW, lineH, maxLines, fill) {
    var chars = String(text).split('');
    var perLine = Math.max(6, Math.floor(maxW / 12.2));
    var lines = [];
    var cur = '';
    for (var i = 0; i < chars.length; i++) {
      cur += chars[i];
      if (cur.length >= perLine) { lines.push(cur); cur = ''; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, perLine - 1) + '…';
    }
    for (var j = 0; j < lines.length; j++) {
      el('text', { x: x, y: y + j * lineH, fill: fill, 'font-size': 12.5 }, parent).textContent = lines[j];
    }
    return lines.length;
  }

  /* =========================================================
   * 导出
   * ========================================================= */
  return {
    radar: radar,
    lineArea: lineArea,
    hRankBars: hRankBars,
    dualBars: dualBars,
    bubble: bubble,
    gauge: gauge,
    flow: flowChart,
    graph: forceGraph,
    timeline: timelineRail,
    niceTicks: niceTicks,
    alpha: alpha,
    fmt: fmt,
    /* 颜色键 → 当前主题下的真实色值 */
    colorOf: function (key, fallback) {
      var cs = getComputedStyle(document.documentElement).getPropertyValue(key);
      return (cs && cs.trim()) || fallback || '#888';
    }
  };
}());
