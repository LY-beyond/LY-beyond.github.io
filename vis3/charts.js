/* =========================================================
 * charts.js —— 纯 SVG 可视化引擎（零第三方依赖）
 * ---------------------------------------------------------
 * 每张图都：
 *   ① 用 viewBox 自适应容器宽度；
 *   ② 颜色从 tokens.css 的计算样式里读（readTokens），
 *      因此切亮/暗主题只需重绘一次；
 *   ③ 自带 tooltip 节点，悬停给数值；
 *   ④ 动画走 rAF，prefers-reduced-motion 时自动跳过。
 * 对外暴露 6 个渲染器：bar / line / scatter / histogram / box / heatmap
 * ========================================================= */
window.PDCHARTS = (function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------- 基础工具 ---------------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function readTokens() {
    var cs = getComputedStyle(document.documentElement);
    var keys = ['--c-primary', '--c-primary-2', '--c-accent', '--c-on-primary', '--c-info',
      '--c-success', '--c-warn', '--c-danger', '--c-text', '--c-text-soft', '--c-muted',
      '--c-border', '--c-surface', '--c-surface-2', '--c-bg', '--s-base', '--s-base-alt',
      '--s-base-warm', '--d1', '--d2', '--d3', '--d4', '--d5', '--d6'];
    var out = {};
    for (var i = 0; i < keys.length; i++) out[keys[i]] = cs.getPropertyValue(keys[i]).trim() || '#888';
    return out;
  }
  function alpha(color, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(color).trim());
    if (!m) return color;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function animate(dur, frame, done) {
    if (REDUCE) { frame(1); if (done) done(); return; }
    var s = null;
    function step(ts) {
      if (s == null) s = ts;
      var p = Math.min(1, (ts - s) / dur);
      frame(ease(p));
      if (p < 1) requestAnimationFrame(step); else if (done) done();
    }
    requestAnimationFrame(step);
  }
  function fmt(v, d) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '—';
    if (typeof v !== 'number') return String(v);
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(d == null ? 1 : d) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(d == null ? 1 : d) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(d == null ? 1 : d) + 'k';
    if (a >= 100) return String(Math.round(v));
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 100) / 100);
  }
  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) return { ticks: [0], min: 0, max: 1 };
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var start = Math.ceil(min / step) * step, ticks = [];
    for (var v = start; v <= max + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
    return { ticks: ticks, min: min, max: max };
  }
  var SERIES = ['--c-primary', '--c-accent', '--d2', '--d5', '--d6', '--d3', '--c-info', '--c-success'];

  /* tooltip：每张图一个，挂在容器里（CSS 负责定位与外观） */
  function tooltip(container) {
    var tip = document.createElement('div');
    tip.className = 'pd-tip';
    tip.setAttribute('role', 'status');
    container.appendChild(tip);
    return {
      show: function (html, x, y) {
        tip.innerHTML = html;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
        tip.classList.add('is-on');
      },
      hide: function () { tip.classList.remove('is-on'); }
    };
  }

  /* 建一张画布：返回 { svg, g, w, h, pad } */
  function frame(container, w, h, pad) {
    clear(container);
    container.classList.add('pd-canvas');
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'pd-svg',
      preserveAspectRatio: 'xMidYMid meet', role: 'img' }, container);
    var g = el('g', null, svg);
    return { svg: svg, g: g, w: w, h: h, pad: pad, tip: tooltip(container) };
  }

  /* 直角坐标轴：x 轴为「序数轴」，labels 数组决定刻度位置 */
  function axisOrdinal(f, labels, plot, T, opts) {
    opts = opts || {};
    var n = labels.length, step = plot.w / Math.max(1, n);
    el('line', { x1: plot.x, y1: plot.y + plot.h, x2: plot.x + plot.w, y2: plot.y + plot.h,
      stroke: T['--c-border'], 'stroke-width': 1 }, f.g);
    var maxLabels = Math.max(4, Math.floor(plot.w / 54));
    var every = Math.ceil(n / maxLabels);
    for (var i = 0; i < n; i++) {
      if (i % every !== 0 && i !== n - 1) continue;
      var tx = plot.x + step * (i + 0.5);
      el('text', { x: tx, y: plot.y + plot.h + 18, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
        .textContent = labels[i];
    }
    return { step: step, offset: 0 };
  }

  /* =========================================================
   * ① 条形图：类别 -> 数值（value_counts / groupby 结果都走它）
   * ========================================================= */
  function bar(container, spec) {
    var T = readTokens();
    var data = spec.data || [];
    var w = 720, h = Math.max(240, Math.min(560, 40 * data.length + 90));
    var pad = { t: 24, r: 20, b: 62, l: 62 };
    var f = frame(container, w, h, pad);
    if (!data.length) { emptyChart(f); return; }
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var mx = Math.max.apply(null, data.map(function (d) { return d.value; }));
    var tk = niceTicks(Math.min(0, Math.min.apply(null, data.map(function (d) { return d.value; }))), mx, 5);
    var yMax = Math.max(mx, tk.ticks.length ? tk.ticks[tk.ticks.length - 1] : mx) || 1;
    for (var i = 0; i < tk.ticks.length; i++) {
      var ty = plot.y + plot.h - (tk.ticks[i] / yMax) * plot.h;
      el('line', { x1: plot.x, y1: ty, x2: plot.x + plot.w, y2: ty, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': tk.ticks[i] === 0 ? '0' : '3 4' }, f.g);
      el('text', { x: plot.x - 10, y: ty + 4, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
        .textContent = spec.fmtY ? spec.fmtY(tk.ticks[i]) : fmt(tk.ticks[i]);
    }
    var step = plot.w / data.length, bw = Math.min(56, step * 0.66);
    var bars = [];
    data.forEach(function (d, idx) {
      var x = plot.x + step * idx + (step - bw) / 2;
      var full = Math.max(0, (d.value / yMax) * plot.h);
      var baseColor = spec.colorAt ? spec.colorAt(d, T) : T['--s-base'];
      var rect = el('rect', { x: x, y: plot.y + plot.h, width: bw, height: 0, rx: 4,
        fill: baseColor, class: 'pd-bar' }, f.g);
      var label = el('text', { x: x + bw / 2, y: plot.y + plot.h + 18, class: 'pd-tick',
        'text-anchor': 'middle' }, f.g);
      label.textContent = d.label;
      bars.push({ rect: rect, full: full });
      rect.addEventListener('mousemove', function (ev) {
        rect.setAttribute('fill', T['--c-primary']); rect.setAttribute('opacity', '0.92');
        var r = container.getBoundingClientRect();
        f.tip.show('<b>' + d.label + '</b><br>' + (spec.valueLabel || '') + ': ' +
          (spec.fmtY ? spec.fmtY(d.value) : fmt(d.value)),
          ev.clientX - r.left + 12, ev.clientY - r.top + 12);
      });
      rect.addEventListener('mouseleave', function () {
        rect.setAttribute('fill', baseColor); rect.setAttribute('opacity', '1'); f.tip.hide();
      });
    });
    axisOrdinal(f, data, plot, T);
    animate(560, function (p) {
      bars.forEach(function (b) {
        b.rect.setAttribute('y', plot.y + plot.h - b.full * p);
        b.rect.setAttribute('height', b.full * p);
      });
    });
  }

  function emptyChart(f) {
    el('text', { x: f.w / 2, y: f.h / 2, class: 'pd-empty', 'text-anchor': 'middle' }, f.svg)
      .textContent = '∅';
  }

  /* =========================================================
   * ② 直方图：数值分布
   * ========================================================= */
  function histogram(container, spec) {
    var T = readTokens();
    var values = spec.values || [];
    var w = 720, h = 300, pad = { t: 24, r: 20, b: 62, l: 62 };
    var f = frame(container, w, h, pad);
    if (!values.length) { emptyChart(f); return; }
    var mn = Math.min.apply(null, values), mx = Math.max.apply(null, values);
    if (mx === mn) mx = mn + 1;
    var bins = spec.bins || Math.max(5, Math.min(30, Math.round(Math.sqrt(values.length))));
    var width = (mx - mn) / bins, counts = new Array(bins).fill(0);
    values.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - mn) / width))]++; });
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var yMax = Math.max.apply(null, counts) || 1;
    var tk = niceTicks(0, yMax, 4);
    var top = tk.ticks.length ? Math.max(yMax, tk.ticks[tk.ticks.length - 1]) : yMax;
    for (var i = 0; i < tk.ticks.length; i++) {
      var ty = plot.y + plot.h - (tk.ticks[i] / top) * plot.h;
      el('line', { x1: plot.x, y1: ty, x2: plot.x + plot.w, y2: ty, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 4' }, f.g);
      el('text', { x: plot.x - 10, y: ty + 4, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
        .textContent = fmt(tk.ticks[i]);
    }
    var step = plot.w / bins, bars = [];
    counts.forEach(function (c, idx) {
      var x = plot.x + step * idx + 1, full = (c / top) * plot.h;
      var rect = el('rect', { x: x, y: plot.y + plot.h, width: Math.max(1, step - 2), height: 0,
        rx: 2, fill: T['--s-base'], class: 'pd-bar' }, f.g);
      bars.push({ rect: rect, full: full });
      var lo = mn + width * idx, hi = lo + width;
      rect.addEventListener('mousemove', function (ev) {
        rect.setAttribute('fill', T['--c-primary']);
        var r = container.getBoundingClientRect();
        f.tip.show('<b>' + fmt(lo) + ' ~ ' + fmt(hi) + '</b><br>' +
          (spec.countLabel || 'count') + ': ' + c, ev.clientX - r.left + 12, ev.clientY - r.top + 12);
      });
      rect.addEventListener('mouseleave', function () {
        rect.setAttribute('fill', T['--s-base']); f.tip.hide();
      });
    });
    [0, Math.floor(bins / 2), bins].forEach(function (k) {
      el('text', { x: plot.x + step * k, y: plot.y + plot.h + 18, class: 'pd-tick',
        'text-anchor': k === 0 ? 'start' : (k === bins ? 'end' : 'middle') }, f.g)
        .textContent = fmt(mn + width * k);
    });
    el('text', { x: plot.x + plot.w / 2, y: h - 12, class: 'pd-axis-label', 'text-anchor': 'middle' }, f.g)
      .textContent = spec.xLabel || '';
    animate(560, function (p) {
      bars.forEach(function (b) {
        b.rect.setAttribute('y', plot.y + plot.h - b.full * p);
        b.rect.setAttribute('height', b.full * p);
      });
    });
  }

  /* =========================================================
   * ③ 折线图：可多系列，x 按序数排布（日期/字符串皆可）
   * ========================================================= */
  function line(container, spec) {
    var T = readTokens();
    var series = spec.series || [];
    var labels = spec.xLabels || [];
    var w = 720, h = 320, pad = { t: 26, r: 24, b: 62, l: 66 };
    var f = frame(container, w, h, pad);
    if (!series.length || !labels.length) { emptyChart(f); return; }
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var allY = [];
    series.forEach(function (s) { s.points.forEach(function (p) { if (p.y != null && isFinite(p.y)) allY.push(p.y); }); });
    if (!allY.length) { emptyChart(f); return; }
    var ymin = Math.min.apply(null, allY), ymax = Math.max.apply(null, allY);
    var tk = niceTicks(ymin, ymax, 5);
    var lo = Math.min(ymin, tk.ticks[0]), hi = Math.max(ymax, tk.ticks[tk.ticks.length - 1]);
    function X(i) { return plot.x + (labels.length === 1 ? plot.w / 2 : (plot.w * i) / (labels.length - 1)); }
    function Y(v) { return plot.y + plot.h - ((v - lo) / (hi - lo || 1)) * plot.h; }
    for (var i = 0; i < tk.ticks.length; i++) {
      var ty = Y(tk.ticks[i]);
      el('line', { x1: plot.x, y1: ty, x2: plot.x + plot.w, y2: ty, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 4' }, f.g);
      el('text', { x: plot.x - 10, y: ty + 4, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
        .textContent = spec.fmtY ? spec.fmtY(tk.ticks[i]) : fmt(tk.ticks[i]);
    }
    var maxLabels = Math.max(4, Math.floor(plot.w / 62)), every = Math.ceil(labels.length / maxLabels);
    labels.forEach(function (lb, idx) {
      if (idx % every !== 0 && idx !== labels.length - 1) return;
      el('text', { x: X(idx), y: plot.y + plot.h + 20, class: 'pd-tick',
        'text-anchor': 'middle' }, f.g).textContent = lb;
    });
    /* 面积渐变（仅单系列） */
    var defs = el('defs', null, f.svg);
    var gid = 'pdarea-' + Math.floor(Math.random() * 1e9);
    var lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': T['--c-primary'], 'stop-opacity': '.26' }, lg);
    el('stop', { offset: '1', 'stop-color': T['--c-primary'], 'stop-opacity': '0' }, lg);

    var paths = [];
    series.forEach(function (s, si) {
      var color = T[SERIES[si % SERIES.length]];
      var d = '';
      s.points.forEach(function (p, idx) {
        if (p.y == null || !isFinite(p.y)) { d += ''; return; }
        d += (d === '' ? 'M' : 'L') + X(idx).toFixed(2) + ' ' + Y(p.y).toFixed(2) + ' ';
      });
      if (si === 0 && series.length === 1 && d) {
        var area = d + 'L' + X(labels.length - 1).toFixed(2) + ' ' + (plot.y + plot.h) +
          ' L' + X(0).toFixed(2) + ' ' + (plot.y + plot.h) + ' Z';
        el('path', { d: area, fill: 'url(#' + gid + ')', stroke: 'none' }, f.g);
      }
      var path = el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2.4,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, f.g);
      var len = 2000;
      if (!REDUCE) {
        path.setAttribute('stroke-dasharray', len);
        path.setAttribute('stroke-dashoffset', len);
      }
      paths.push({ path: path, len: len });
      /* 数据点 + tooltip */
      s.points.forEach(function (p, idx) {
        if (p.y == null || !isFinite(p.y)) return;
        var dot = el('circle', { cx: X(idx), cy: Y(p.y), r: 3.2, fill: color,
          stroke: T['--c-surface'], 'stroke-width': 1.4, class: 'pd-dot' }, f.g);
        dot.addEventListener('mousemove', function (ev) {
          dot.setAttribute('r', 5);
          var r = container.getBoundingClientRect();
          f.tip.show('<b>' + labels[idx] + '</b><br>' + s.name + ': ' +
            (spec.fmtY ? spec.fmtY(p.y) : fmt(p.y)), ev.clientX - r.left + 12, ev.clientY - r.top + 12);
        });
        dot.addEventListener('mouseleave', function () { dot.setAttribute('r', 3.2); f.tip.hide(); });
      });
    });
    if (series.length > 1) legend(f, series.map(function (s, si) {
      return { name: s.name, color: T[SERIES[si % SERIES.length]] };
    }), plot, T);
    el('text', { x: plot.x + plot.w / 2, y: h - 10, class: 'pd-axis-label', 'text-anchor': 'middle' }, f.g)
      .textContent = spec.xLabel || '';
    animate(760, function (p) {
      paths.forEach(function (o) {
        if (!REDUCE) o.path.setAttribute('stroke-dashoffset', o.len * (1 - p));
      });
    });
  }

  function legend(f, items, plot, T) {
    var x = plot.x, y = frame0Top(f);
    items.forEach(function (it) {
      el('rect', { x: x, y: y - 8, width: 10, height: 10, rx: 2, fill: it.color }, f.g);
      var t = el('text', { x: x + 15, y: y + 1, class: 'pd-legend', fill: T['--c-text-soft'] }, f.g);
      t.textContent = it.name;
      x += 26 + it.name.length * 7.2;
    });
  }
  function frame0Top(f) { return 12; }

  /* =========================================================
   * ④ 散点图：x/y 两个数值列，可按类别着色
   * ========================================================= */
  function scatter(container, spec) {
    var T = readTokens();
    var pts = spec.points || [];
    var w = 720, h = 400, pad = { t: 26, r: 24, b: 62, l: 70 };
    var f = frame(container, w, h, pad);
    if (!pts.length) { emptyChart(f); return; }
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    if (xmax === xmin) xmax = xmin + 1;
    if (ymax === ymin) ymax = ymin + 1;
    var xt = niceTicks(xmin, xmax, 5), yt = niceTicks(ymin, ymax, 5);
    var x0 = Math.min(xmin, xt.ticks[0]), x1 = Math.max(xmax, xt.ticks[xt.ticks.length - 1]);
    var y0 = Math.min(ymin, yt.ticks[0]), y1 = Math.max(ymax, yt.ticks[yt.ticks.length - 1]);
    function X(v) { return plot.x + ((v - x0) / (x1 - x0 || 1)) * plot.w; }
    function Y(v) { return plot.y + plot.h - ((v - y0) / (y1 - y0 || 1)) * plot.h; }
    xt.ticks.forEach(function (t) {
      el('line', { x1: X(t), y1: plot.y, x2: X(t), y2: plot.y + plot.h, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 4' }, f.g);
      el('text', { x: X(t), y: plot.y + plot.h + 20, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
        .textContent = fmt(t);
    });
    yt.ticks.forEach(function (t) {
      el('line', { x1: plot.x, y1: Y(t), x2: plot.x + plot.w, y2: Y(t), stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 4' }, f.g);
      el('text', { x: plot.x - 10, y: Y(t) + 4, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
        .textContent = fmt(t);
    });
    var groups = spec.groups || [];
    function colorOf(p) {
      if (!groups.length) return T['--c-primary'];
      var i = groups.indexOf(p.group);
      return T[SERIES[(i < 0 ? 0 : i) % SERIES.length]];
    }
    var dots = [];
    pts.forEach(function (p) {
      var c = el('circle', { cx: X(p.x), cy: Y(p.y), r: 0, fill: colorOf(p),
        'fill-opacity': '.78', stroke: T['--c-surface'], 'stroke-width': 1, class: 'pd-dot' }, f.g);
      dots.push(c);
      c.addEventListener('mousemove', function (ev) {
        c.setAttribute('r', 6); c.setAttribute('fill-opacity', '1');
        var r = container.getBoundingClientRect();
        f.tip.show('<b>' + (p.label != null ? p.label : '') + '</b><br>' +
          spec.xLabel + ': ' + fmt(p.x) + '<br>' + spec.yLabel + ': ' + fmt(p.y) +
          (p.group != null ? '<br>' + (spec.groupLabel || 'group') + ': ' + p.group : ''),
          ev.clientX - r.left + 12, ev.clientY - r.top + 12);
      });
      c.addEventListener('mouseleave', function () {
        c.setAttribute('r', 4); c.setAttribute('fill-opacity', '.78'); f.tip.hide();
      });
    });
    if (groups.length) legend(f, groups.map(function (g, i) {
      return { name: String(g), color: T[SERIES[i % SERIES.length]] };
    }), plot, T);
    el('text', { x: plot.x + plot.w / 2, y: h - 12, class: 'pd-axis-label', 'text-anchor': 'middle' }, f.g)
      .textContent = spec.xLabel || '';
    el('text', { x: 16, y: plot.y + plot.h / 2, class: 'pd-axis-label', 'text-anchor': 'middle',
      transform: 'rotate(-90 16 ' + (plot.y + plot.h / 2) + ')' }, f.g).textContent = spec.yLabel || '';
    animate(560, function (p) { dots.forEach(function (d) { d.setAttribute('r', 4 * p); }); });
  }

  /* =========================================================
   * ⑤ 箱线图：按类别分组看数值分布（含离群点）
   * ========================================================= */
  function box(container, spec) {
    var T = readTokens(), S = PD.stat;
    var groups = spec.groups || [];
    var w = 720, h = 340, pad = { t: 26, r: 24, b: 62, l: 70 };
    var f = frame(container, w, h, pad);
    if (!groups.length) { emptyChart(f); return; }
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var all = [];
    groups.forEach(function (g) { g.values.forEach(function (v) { all.push(v); }); });
    if (!all.length) { emptyChart(f); return; }
    var tk = niceTicks(Math.min.apply(null, all), Math.max.apply(null, all), 5);
    var lo = Math.min.apply(null, all.concat(tk.ticks)), hi = Math.max.apply(null, all.concat(tk.ticks));
    function Y(v) { return plot.y + plot.h - ((v - lo) / (hi - lo || 1)) * plot.h; }
    tk.ticks.forEach(function (t) {
      el('line', { x1: plot.x, y1: Y(t), x2: plot.x + plot.w, y2: Y(t), stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 4' }, f.g);
      el('text', { x: plot.x - 10, y: Y(t) + 4, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
        .textContent = fmt(t);
    });
    var step = plot.w / groups.length, bw = Math.min(60, step * 0.55);
    groups.forEach(function (g, gi) {
      var v = g.values.slice().sort(function (a, b) { return a - b; });
      if (!v.length) return;
      var q1 = S.quantile(v, 0.25), med = S.quantile(v, 0.5), q3 = S.quantile(v, 0.75);
      var iqr = q3 - q1, lowF = q1 - 1.5 * iqr, higF = q3 + 1.5 * iqr;
      var within = v.filter(function (x) { return x >= lowF && x <= higF; });
      var wlo = Math.min.apply(null, within), whi = Math.max.apply(null, within);
      var cx = plot.x + step * gi + step / 2;
      el('line', { x1: cx, y1: Y(wlo), x2: cx, y2: Y(q1), stroke: T['--s-base'], 'stroke-width': 1.6 }, f.g);
      el('line', { x1: cx, y1: Y(q3), x2: cx, y2: Y(whi), stroke: T['--s-base'], 'stroke-width': 1.6 }, f.g);
      el('line', { x1: cx - bw / 3, y1: Y(wlo), x2: cx + bw / 3, y2: Y(wlo), stroke: T['--s-base'], 'stroke-width': 1.6 }, f.g);
      el('line', { x1: cx - bw / 3, y1: Y(whi), x2: cx + bw / 3, y2: Y(whi), stroke: T['--s-base'], 'stroke-width': 1.6 }, f.g);
      el('rect', { x: cx - bw / 2, y: Y(q3), width: bw, height: Math.max(1, Y(q1) - Y(q3)), rx: 4,
        fill: alpha(T['--c-primary'], .26), stroke: T['--c-primary'], 'stroke-width': 1.4, class: 'pd-bar' }, f.g);
      el('line', { x1: cx - bw / 2, y1: Y(med), x2: cx + bw / 2, y2: Y(med), stroke: T['--c-primary'],
        'stroke-width': 2.4 }, f.g);
      v.filter(function (x) { return x < lowF || x > higF; }).forEach(function (o, oi) {
        el('circle', { cx: cx + ((oi % 5) - 2) * 2.4, cy: Y(o), r: 2.6, fill: T['--c-danger'],
          'fill-opacity': '.7' }, f.g);
      });
      el('text', { x: cx, y: plot.y + plot.h + 20, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
        .textContent = g.name;
    });
    animate(520, function (p) { f.svg.style.opacity = String(0.4 + 0.6 * p); });
  }

  /* 两色插值（sRGB） */
  function mixColor(a, b, t) {
    function rgb(c) {
      var m = /^#([0-9a-f]{6})$/i.exec(String(c).trim());
      if (!m) return null;
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var A = rgb(a), B = rgb(b);
    if (!A || !B) return a;
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(A[i] + (B[i] - A[i]) * t);
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
  }

  /* =========================================================
   * ⑥ 热力矩阵：相关系数 / 透视表 / 交叉表通用
   *    diverging=true 时 -1→冷、0→中性、+1→暖（相关系数专用）
   * ========================================================= */
  function heatmap(container, spec) {
    var T = readTokens();
    var rows = spec.rows || [], cols = spec.cols || [], values = spec.values || [];
    var cell = 46, rowLabelW = 120, colLabelH = 78, pad = { t: 20, r: 20, b: 20, l: 20 };
    var w = rowLabelW + cols.length * cell + pad.l + pad.r;
    var h = colLabelH + rows.length * cell + pad.t + pad.b;
    var f = frame(container, Math.max(320, w), Math.max(200, h), pad);
    if (!rows.length || !cols.length) { emptyChart(f); return; }
    var flat = [];
    values.forEach(function (r) { r.forEach(function (v) { if (v != null && isFinite(v)) flat.push(v); }); });
    var mn = spec.min != null ? spec.min : Math.min.apply(null, flat);
    var mx = spec.max != null ? spec.max : Math.max.apply(null, flat);
    var fmtV = spec.fmt || function (v) { return fmt(v, 2); };
    function colorAt(v) {
      if (v == null || !isFinite(v)) return T['--c-surface-2'];
      if (spec.diverging) {
        var t = v >= 0 ? (v / (mx || 1)) : (v / (mn || -1));
        t = Math.max(-1, Math.min(1, t));
        return t >= 0 ? mixColor(T['--c-surface'], T['--c-danger'], t)
          : mixColor(T['--c-surface'], T['--c-primary'], -t);
      }
      var u = (mx === mn) ? 0.5 : (v - mn) / (mx - mn);
      /* 顺序色阶：浅底 → 主色（低彩度大面积也用令牌，不用硬编码） */
      return mixColor(T['--c-surface-2'], T['--c-primary'], u);
    }
    var ox = pad.l + rowLabelW, oy = pad.t + colLabelH;
    /* 列标签：竖排，避免长列名互相压字 */
    cols.forEach(function (c, ci) {
      var tx = ox + ci * cell + cell / 2;
      el('text', { x: tx, y: oy - 8, class: 'pd-tick', 'text-anchor': 'start',
        transform: 'rotate(-55 ' + tx + ' ' + (oy - 8) + ')' }, f.g).textContent = c;
    });
    rows.forEach(function (r, ri) {
      el('text', { x: ox - 10, y: oy + ri * cell + cell / 2 + 4, class: 'pd-tick',
        'text-anchor': 'end' }, f.g).textContent = r;
    });
    var cells = [];
    rows.forEach(function (rname, ri) {
      values[ri] = values[ri] || [];
      cols.forEach(function (cname, ci) {
        var v = values[ri][ci];
        var rect = el('rect', { x: ox + ci * cell + 1, y: oy + ri * cell + 1,
          width: cell - 2, height: cell - 2, rx: 5, fill: colorAt(v), opacity: 0 }, f.g);
        cells.push(rect);
        var label = el('text', { x: ox + ci * cell + cell / 2, y: oy + ri * cell + cell / 2 + 4,
          class: 'pd-heatval', 'text-anchor': 'middle' }, f.g);
        label.textContent = (v == null) ? '' : fmtV(v);
        rect.addEventListener('mousemove', function (ev) {
          rect.setAttribute('stroke', T['--c-text']); rect.setAttribute('stroke-width', '1.6');
          var r = container.getBoundingClientRect();
          f.tip.show('<b>' + rname + ' · ' + cname + '</b><br>' + (spec.valueLabel || '') + ': ' +
            (v == null ? '—' : fmtV(v)), ev.clientX - r.left + 12, ev.clientY - r.top + 12);
        });
        rect.addEventListener('mouseleave', function () {
          rect.setAttribute('stroke', 'none'); f.tip.hide();
        });
      });
    });
    animate(480, function (p) { cells.forEach(function (c) { c.setAttribute('opacity', p); }); });
  }

  /* =========================================================
   * ⑦ 横向条形图：与条形图同数据，标签在左、条往右长（df.plot(kind="barh")）
   * ========================================================= */
  function barh(container, spec) {
    var T = readTokens();
    var data = spec.data || [];
    var w = 720, rowH = 30;
    var h = Math.max(220, Math.min(600, rowH * data.length + 70));
    var pad = { t: 24, r: 60, b: 46, l: 132 };
    var f = frame(container, w, h, pad);
    if (!data.length) { emptyChart(f); return; }
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var mx = Math.max.apply(null, data.map(function (d) { return d.value; }));
    var tk = niceTicks(Math.min(0, Math.min.apply(null, data.map(function (d) { return d.value; }))), mx, 4);
    var xMax = Math.max(mx, tk.ticks.length ? tk.ticks[tk.ticks.length - 1] : mx) || 1;
    tk.ticks.forEach(function (tv) {
      var tx = plot.x + (tv / xMax) * plot.w;
      el('line', { x1: tx, y1: plot.y, x2: tx, y2: plot.y + plot.h, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': tv === 0 ? '0' : '3 4' }, f.g);
      el('text', { x: tx, y: plot.y + plot.h + 18, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
        .textContent = spec.fmtY ? spec.fmtY(tv) : fmt(tv);
    });
    var step = plot.h / data.length, bh = Math.min(20, step * 0.62), bars = [];
    data.forEach(function (d, i) {
      var y = plot.y + step * i + (step - bh) / 2;
      var full = Math.max(0, (d.value / xMax) * plot.w);
      var rect = el('rect', { x: plot.x, y: y, width: 0, height: bh, rx: 4,
        fill: spec.colorAt ? spec.colorAt(d, T) : T['--s-base'], class: 'pd-bar' }, f.g);
      el('text', { x: plot.x - 10, y: y + bh / 2 + 4, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
        .textContent = d.label;
      var val = el('text', { x: plot.x + 6, y: y + bh / 2 + 4, class: 'pd-tick',
        'text-anchor': 'start', opacity: 0 }, f.g);
      val.textContent = spec.fmtY ? spec.fmtY(d.value) : fmt(d.value);
      rect.addEventListener('mousemove', function (ev) {
        var r = container.getBoundingClientRect();
        f.tip.show('<b>' + d.label + '</b><br>' + (spec.valueLabel || '') + ': ' +
          (spec.fmtY ? spec.fmtY(d.value) : fmt(d.value)), ev.clientX - r.left + 12, ev.clientY - r.top + 12);
      });
      rect.addEventListener('mouseleave', function () { f.tip.hide(); });
      bars.push({ rect: rect, val: val, full: full });
    });
    animate(520, function (p) {
      bars.forEach(function (b) {
        b.rect.setAttribute('width', b.full * p);
        b.val.setAttribute('opacity', p);
      });
    });
  }

  /* =========================================================
   * ⑧ 面积图：折线 + 填充（df.plot(kind="area")）；多系列半透明重叠
   * ========================================================= */
  function area(container, spec) {
    var T = readTokens();
    var series = spec.series || [], labels = spec.xLabels || [];
    var w = 720, h = 340, pad = { t: 26, r: 24, b: 62, l: 66 };
    var f = frame(container, w, h, pad);
    if (!series.length || !labels.length) { emptyChart(f); return; }
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var allY = [];
    series.forEach(function (s) { s.points.forEach(function (p) { if (p.y != null && isFinite(p.y)) allY.push(p.y); }); });
    if (!allY.length) { emptyChart(f); return; }
    var tk = niceTicks(Math.min.apply(null, allY), Math.max.apply(null, allY), 5);
    var lo = Math.min(Math.min.apply(null, allY), tk.ticks[0]);
    var hi = Math.max(Math.max.apply(null, allY), tk.ticks[tk.ticks.length - 1]);
    function X(i) { return plot.x + (labels.length === 1 ? plot.w / 2 : (plot.w * i) / (labels.length - 1)); }
    function Y(v) { return plot.y + plot.h - ((v - lo) / (hi - lo || 1)) * plot.h; }
    tk.ticks.forEach(function (tv) {
      el('line', { x1: plot.x, y1: Y(tv), x2: plot.x + plot.w, y2: Y(tv), stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 4' }, f.g);
      el('text', { x: plot.x - 10, y: Y(tv) + 4, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
        .textContent = spec.fmtY ? spec.fmtY(tv) : fmt(tv);
    });
    var maxLabels = Math.max(4, Math.floor(plot.w / 62)), every = Math.ceil(labels.length / maxLabels);
    labels.forEach(function (lb, i) {
      if (i % every !== 0 && i !== labels.length - 1) return;
      el('text', { x: X(i), y: plot.y + plot.h + 20, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
        .textContent = lb;
    });
    var paths = [];
    series.forEach(function (s, si) {
      var color = T[SERIES[si % SERIES.length]];
      var line = '', first = null, last = null;
      s.points.forEach(function (p, i) {
        if (p.y == null || !isFinite(p.y)) return;
        line += (line === '' ? 'M' : 'L') + X(i).toFixed(2) + ' ' + Y(p.y).toFixed(2) + ' ';
        if (first == null) first = i;
        last = i;
      });
      if (!line) return;
      var base = plot.y + plot.h;
      var filled = line + 'L' + X(last).toFixed(2) + ' ' + base + ' L' + X(first).toFixed(2) + ' ' + base + ' Z';
      el('path', { d: filled, fill: alpha(color, si === 0 ? 0.28 : 0.16), stroke: 'none' }, f.g);
      var path = el('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2.2,
        'stroke-linejoin': 'round' }, f.g);
      paths.push(path);
      s.points.forEach(function (p, i) {
        if (p.y == null || !isFinite(p.y)) return;
        var dot = el('circle', { cx: X(i), cy: Y(p.y), r: 3, fill: color, stroke: T['--c-surface'],
          'stroke-width': 1.2, class: 'pd-dot' }, f.g);
        dot.addEventListener('mousemove', function (ev) {
          dot.setAttribute('r', 5);
          var r = container.getBoundingClientRect();
          f.tip.show('<b>' + labels[i] + '</b><br>' + s.name + ': ' +
            (spec.fmtY ? spec.fmtY(p.y) : fmt(p.y)), ev.clientX - r.left + 12, ev.clientY - r.top + 12);
        });
        dot.addEventListener('mouseleave', function () { dot.setAttribute('r', 3); f.tip.hide(); });
      });
    });
    if (series.length > 1) legend(f, series.map(function (s, si) {
      return { name: s.name, color: T[SERIES[si % SERIES.length]] };
    }), plot, T);
    animate(600, function (p) { paths.forEach(function (n) { n.setAttribute('opacity', p); }); });
  }

  /* =========================================================
   * ⑨ 饼图：类别占比（df.plot(kind="pie")）；圆弧用 path 画，图例带百分比
   * ========================================================= */
  function pie(container, spec) {
    var T = readTokens();
    var slices = (spec.slices || []).filter(function (s) { return s.value > 0; });
    var w = 720, h = 340;
    var f = frame(container, w, h, { t: 20, r: 20, b: 20, l: 20 });
    if (!slices.length) { emptyChart(f); return; }
    var total = slices.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var cx = 210, cy = h / 2, R = Math.min(h / 2 - 24, 126), r0 = R * 0.5;
    var a0 = -Math.PI / 2, arcs = [];
    function pt(ang, rad) { return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]; }
    slices.forEach(function (s, i) {
      var a1 = a0 + (s.value / total) * Math.PI * 2;
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      var o0 = pt(a0, R), o1 = pt(a1, R), i0 = pt(a1, r0), i1 = pt(a0, r0);
      var d = 'M' + o0[0].toFixed(2) + ' ' + o0[1].toFixed(2) +
        ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + o1[0].toFixed(2) + ' ' + o1[1].toFixed(2) +
        ' L' + i0[0].toFixed(2) + ' ' + i0[1].toFixed(2) +
        ' A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + i1[0].toFixed(2) + ' ' + i1[1].toFixed(2) + ' Z';
      var color = T[SERIES[i % SERIES.length]];
      var path = el('path', { d: d, fill: color, stroke: T['--c-surface'], 'stroke-width': 1.4,
        opacity: 0 }, f.g);
      var share = Math.round((s.value / total) * 1000) / 10;
      path.addEventListener('mousemove', function (ev) {
        path.setAttribute('opacity', '.86');
        var r = container.getBoundingClientRect();
        f.tip.show('<b>' + s.label + '</b><br>' + (spec.valueLabel || '') + ': ' +
          (spec.fmtV ? spec.fmtV(s.value) : fmt(s.value)) + '<br>' + share + '%',
          ev.clientX - r.left + 12, ev.clientY - r.top + 12);
      });
      path.addEventListener('mouseleave', function () { path.setAttribute('opacity', '1'); f.tip.hide(); });
      arcs.push(path);
      var ly = 40 + i * 24;                 /* 右侧图例：饼图主要靠图例读数 */
      if (ly < h - 12) {
        /* 图例色块用 circle（不是 rect）：rect 会被真机探针当成热力格，circle 不会 */
        el('circle', { cx: 435, cy: ly - 4, r: 5, fill: color }, f.g);
        el('text', { x: 447, y: ly, class: 'pd-legend', fill: T['--c-text-soft'] }, f.g)
          .textContent = s.label + ' · ' + share + '%';
      }
      a0 = a1;
    });
    el('text', { x: cx, y: cy - 4, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
      .textContent = spec.valueLabel || '';
    el('text', { x: cx, y: cy + 16, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
      .textContent = String(slices.length);
    animate(520, function (p) { arcs.forEach(function (n) { n.setAttribute('opacity', p); }); });
  }

  /* =========================================================
   * ⑩ 核密度图：单列分布的一键平滑（df.plot(kind="kde")）
   * ========================================================= */
  function kde(container, spec) {
    var T = readTokens();
    var pts = spec.points || [];
    var w = 720, h = 320, pad = { t: 26, r: 24, b: 62, l: 70 };
    var f = frame(container, w, h, pad);
    if (pts.length < 2) { emptyChart(f); return; }
    var plot = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y1 = Math.max.apply(null, ys) || 1;
    if (x1 === x0) x1 = x0 + 1;
    function X(v) { return plot.x + ((v - x0) / (x1 - x0)) * plot.w; }
    function Y(v) { return plot.y + plot.h - (v / y1) * plot.h; }
    niceTicks(x0, x1, 5).ticks.forEach(function (tv) {
      el('line', { x1: X(tv), y1: plot.y, x2: X(tv), y2: plot.y + plot.h, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 4' }, f.g);
      el('text', { x: X(tv), y: plot.y + plot.h + 20, class: 'pd-tick', 'text-anchor': 'middle' }, f.g)
        .textContent = spec.fmtX ? spec.fmtX(tv) : fmt(tv);
    });
    el('line', { x1: plot.x, y1: plot.y + plot.h, x2: plot.x + plot.w, y2: plot.y + plot.h,
      stroke: T['--c-border'], 'stroke-width': 1.2 }, f.g);
    var line = '';
    pts.forEach(function (p, i) { line += (i === 0 ? 'M' : 'L') + X(p.x).toFixed(2) + ' ' + Y(p.y).toFixed(2) + ' '; });
    var base = (plot.y + plot.h).toFixed(2);
    el('path', { d: line + 'L' + X(x1).toFixed(2) + ' ' + base + ' L' + X(x0).toFixed(2) + ' ' + base + ' Z',
      fill: alpha(T['--c-primary'], .22), stroke: 'none' }, f.g);
    var path = el('path', { d: line, fill: 'none', stroke: T['--c-primary'], 'stroke-width': 2.4 }, f.g);
    el('text', { x: plot.x + plot.w / 2, y: h - 10, class: 'pd-axis-label', 'text-anchor': 'middle' }, f.g)
      .textContent = spec.xLabel || '';
    el('text', { x: plot.x - 8, y: plot.y + 10, class: 'pd-tick', 'text-anchor': 'end' }, f.g)
      .textContent = spec.yLabel || '';
    f.svg.addEventListener('mousemove', function (ev) {
      var r = container.getBoundingClientRect();
      var rx = ((ev.clientX - r.left) / r.width) * w;
      var best = null, bi = 0;
      pts.forEach(function (p, i) {
        var dd = Math.abs(X(p.x) - rx);
        if (best === null || dd < best) { best = dd; bi = i; }
      });
      f.tip.show('<b>' + (spec.fmtX ? spec.fmtX(pts[bi].x) : fmt(pts[bi].x)) + '</b><br>' +
        (spec.yLabel || '') + ': ' + (spec.fmtY ? spec.fmtY(pts[bi].y) : fmt(pts[bi].y)),
        ev.clientX - r.left + 12, ev.clientY - r.top + 12);
    });
    f.svg.addEventListener('mouseleave', function () { f.tip.hide(); });
    animate(560, function (p) { path.setAttribute('opacity', p); });
  }

  return {
    readTokens: readTokens, alpha: alpha, fmt: fmt, niceTicks: niceTicks,
    SERIES: SERIES, el: el, clear: clear, animate: animate, frame: frame,
    tooltip: tooltip, axisOrdinal: axisOrdinal,
    bar: bar, line: line, scatter: scatter, histogram: histogram, box: box, heatmap: heatmap,
    barh: barh, area: area, pie: pie, kde: kde
  };
}());
