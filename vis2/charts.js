/* =========================================================
 * charts.js —— 纯 SVG 可视化引擎（无第三方依赖，力导向除外）
 * ---------------------------------------------------------
 * 设计约定：
 *   ① 所有颜色都从 tokens.css 的计算样式里读（readTokens），
 *      因此切换亮/暗主题时只需重绘一次，图表自动换肤；
 *   ①′ 颜色分两档（见 tokens.css「图表两档系列色」）：
 *      · 大面积填充（条形 / 面积 / 节点默认态）用 --s-base* —— 低彩度、安静；
 *      · 线条、数据点、悬停高亮、异常点用 --c-accent / --c-primary / --c-anomaly
 *        —— 高彩度、抢眼。不要在 fill 上直接用强调色铺大面积。
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

  /* 词表兜底：charts.js 排在 i18n.js 之后加载，可以借 window.I18N 取词；
     万一词表缺失则回退英文（而不是中文），保证英文界面不会冒出中文。
     （命名用 tk，避免和下面各引擎里 T = readTokens() 的局部变量撞车。） */
  function tk(key, fallback) {
    try { return (window.I18N && window.I18N.t) ? window.I18N.t(key) : fallback; } catch (e) { return fallback; }
  }

  /* 从 :root 读取设计令牌，得到当前主题下的真实色值 */
  function readTokens() {
    var cs = getComputedStyle(document.documentElement);
    var keys = ['--c-primary', '--c-primary-2', '--c-accent', '--c-accent-ink', '--c-info', '--c-success', '--c-warn',
      '--c-danger', '--c-anomaly', '--c-text', '--c-text-soft', '--c-muted', '--c-border', '--c-border-2',
      '--c-surface', '--c-surface-2', '--c-bg', '--s-base', '--s-base-alt', '--s-base-warm',
      '--d1', '--d2', '--d3', '--d4', '--d5', '--d6'];
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

  /* ---------------- 画布宽度：viewBox 与屏幕 1:1 ----------------
   * 老做法是固定 viewBox（900 / 560 / 960）+ CSS 拉满容器宽度，于是同一张图
   *   宽屏被放大到 1082px（雷达标签 23px，比正文还大）、
   *   窄屏被压到 316px（12 单位的标签只剩 3.5px，等于不可读）。
   * 现在按「容器实际宽度」（上限 = 设计宽度）出图：字号即像素，宽窄屏都稳定在 11~13px，
   * 同时 SVG 不会被放大超过设计尺寸（CSS 的 max-width 由 stage 写入）。
   * 容器宽度跨档时 app.js 会重画一次（见 app.js layoutBucket）。 */
  function canvasW(container, design, min) {
    var cw = container.clientWidth || design;
    return Math.round(Math.max(min || 280, Math.min(cw, design)));
  }

  function stage(container, ratio, cap) {
    container.classList.add('viz');
    clear(container);
    var svg = el('svg', {
      class: 'viz-svg',
      viewBox: '0 0 ' + ratio[0] + ' ' + ratio[1],
      preserveAspectRatio: 'xMidYMid meet',
      /* 上限锁在设计宽度：宽屏不再把整张图（含字号）等比放大 */
      style: cap ? ('max-width:' + cap + 'px;margin:0 auto') : null,
      /* 可及名由外层容器承载（app.js 给 .viz 挂 role="img" + 图题 aria-label，
         并配一份「数据表」等价物）；内部 SVG 是纯绘制，对读屏隐藏，避免重复播报无名图形。 */
      'aria-hidden': 'true'
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

  /* =========================================================
   * 导出：把屏幕上的 SVG 变成可交作业的 PNG / SVG / CSV
   * ---------------------------------------------------------
   * 为什么不用 html2canvas 之类的库：本页所有图表本来就是原生 SVG，
   * 序列化之后本身就是一张合法图片，零依赖就能无损导出。
   * PNG 走「SVG → <img> → <canvas>」的浏览器原生光栅化（2 倍像素密度，
   * 放大也不糊）；若某个浏览器因画布污染拒绝 toDataURL，会**自动降级**为
   * 导出 SVG，保证「导出」按钮在任何浏览器里都不会失灵。
   * ========================================================= */

  function svgEl(container) {
    return container ? container.querySelector('svg.viz-svg') : null;
  }

  /* 当前主题的画布底色：导出时铺底，避免透明背景在阅读器 / 暗色 Word 里发黑 */
  function surfaceColor() {
    var cs = getComputedStyle(document.documentElement).getPropertyValue('--c-surface');
    return (cs && cs.trim()) || '#ffffff';
  }

  /* 克隆一份 SVG，补上 xmlns / 宽高 / 底色矩形 —— 脱离本页也自洽 */
  function standaloneSVG(svg, bg) {
    var clone = svg.cloneNode(true);
    var vb = String(svg.getAttribute('viewBox') || '0 0 900 560').split(/\s+/);
    var w = Math.round(+vb[2]) || 900, h = Math.round(+vb[3]) || 560;
    clone.setAttribute('xmlns', NS);
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    /* 页面里用来限宽的 max-width 要去掉，否则部分阅读器按 0 宽渲染 */
    clone.removeAttribute('style');
    clone.setAttribute('style', 'background:' + bg);
    var rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', 0);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', bg);
    clone.insertBefore(rect, clone.firstChild);
    return { node: clone, w: w, h: h };
  }

  function download(filename, content, mime) {
    var blob = content instanceof Blob ? content
      : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* 文件名统一成 ai-nqpf-<图名>-<主题>.<后缀>，避免下载一堆同名 chart.png */
  function fileName(name, ext) {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    return 'ai-nqpf-' + name + '-' + theme + '.' + ext;
  }

  function exportSVG(container, name) {
    var svg = svgEl(container);
    if (!svg) return false;
    var pack = standaloneSVG(svg, surfaceColor());
    download(fileName(name, 'svg'),
      '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(pack.node),
      'image/svg+xml;charset=utf-8');
    return true;
  }

  function exportPNG(container, name, done) {
    var svg = svgEl(container);
    if (!svg) { if (done) done(false, 'no-svg'); return; }
    var bg = surfaceColor();
    var pack = standaloneSVG(svg, bg);
    var url = 'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(new XMLSerializer().serializeToString(pack.node));
    var scale = 2;
    var img = new Image();
    img.onload = function () {
      try {
        var cv = document.createElement('canvas');
        cv.width = pack.w * scale;
        cv.height = pack.h * scale;
        var cx = cv.getContext('2d');
        cx.fillStyle = bg;
        cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        var data = cv.toDataURL('image/png');     /* 画布被污染时这里会抛异常 */
        var bin = atob(data.split(',')[1]);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        download(fileName(name, 'png'), new Blob([bytes], { type: 'image/png' }));
        if (done) done(true, 'png');
      } catch (e) {
        exportSVG(container, name);                /* 降级：至少能拿到矢量图 */
        if (done) done(false, 'fallback-svg');
      }
    };
    img.onerror = function () {
      exportSVG(container, name);
      if (done) done(false, 'fallback-svg');
    };
    img.src = url;
  }

  /* CSV：给「数据表」视图配一个可再加工的出口（Excel / Python 直接打开）。
     参数是「小节数组」：每节 { cols: [列名...], rows: [[单元格...], ...] }。
     流向图 / 关系图有「节点 + 关系」两张表，多节之间留一个空行，一次导出全带走。 */
  function exportCSV(name, sections) {
    function cell(v) {
      var s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var blocks = sections.map(function (sec) {
      var out = [sec.cols.map(cell).join(',')];
      for (var i = 0; i < sec.rows.length; i++) out.push(sec.rows[i].map(cell).join(','));
      return out.join('\r\n');
    });
    /* 前置 BOM：Excel 打开中文 CSV 才不会乱码 */
    download(fileName(name, 'csv'), '\ufeff' + blocks.join('\r\n\r\n'), 'text/csv;charset=utf-8');
  }

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
    /* 设计宽 560；宽屏最多放大到 700（再宽只是空白），窄屏随容器收窄 */
    var W = canvasW(container, 700, 300);
    var H = Math.round(W * 0.82);
    var ctx = stage(container, [W, H], 700);
    var T = readTokens();
    var svg = ctx.svg;
    var cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) * 0.3;
    /* 窄屏：轴标签折成两行（「规模化复制能力」7 个字横着放不下），半径也要留出标签的位置 */
    var twoLine = W < 620;
    var axisMaxW = Math.max(38, cx - R * (twoLine ? 1.34 : 1.24) - 4);
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

    /* 轴标签：窄屏折成两行，避免横向超出画布 */
    for (i = 0; i < n; i++) {
      var lp = pt(i, twoLine ? 1.34 : 1.24);
      var anchor = Math.abs(lp[0] - cx) < 6 ? 'middle' : (lp[0] > cx ? 'start' : 'end');
      if (twoLine) {
        wrapText(svg, cfg.axes[i], lp[0].toFixed(1), (lp[1] - 2).toFixed(1),
          axisMaxW, 12, 2, T['--c-text-soft'], 11, anchor);
      } else {
        el('text', {
          x: lp[0].toFixed(1), y: (lp[1] + 4).toFixed(1), 'text-anchor': anchor,
          fill: T['--c-text-soft'], 'font-size': 12.5, 'font-weight': 700
        }, svg).textContent = cfg.axes[i];
      }
    }
    /* 50 / 100 刻度提示 */
    [50, 100].forEach(function (v) {
      var rp = pt(0, v / max);
      el('text', { x: cx + 7, y: rp[1] + 13, fill: T['--c-muted'], 'font-size': 10.5 }, svg).textContent = v;
    });

    /* 数据多边形：底系列（s.base）只描边不填充 ——
       两片高饱和淡彩（蓝 + 橙，近互补）叠在一起会中和成灰褐色，且抢走主次 */
    var recs = cfg.series.map(function (s) {
      var isBase = s.base === true;
      var poly = el('path', {
        fill: isBase ? 'none' : alpha(s.color, s.fillAlpha != null ? s.fillAlpha : 0.16),
        stroke: s.color, 'stroke-width': isBase ? 2 : 2.8,
        'stroke-linejoin': 'round',
        'stroke-dasharray': isBase ? '7 5' : null
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
    var W = canvasW(container, 900, 280);
    var H = Math.round(W * 0.51);                 /* 与设计稿 900×460 同比例 */
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var narrow = W < 520;
    var pad = narrow ? { t: 22, r: 12, b: 36, l: 48 } : { t: 30, r: 26, b: 46, l: 66 };
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
        /* 预测年份的刻度用「强调色当文字」的深阶：浅色主题下 --c-accent 只有 3.35:1，不够小字 */
        fill: p.forecast ? T['--c-accent-ink'] : T['--c-text-soft'],
        'font-size': narrow ? 11 : 12, 'font-weight': 700
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
      var area = s.fill ? el('path', {
        fill: alpha(s.color, s.fillAlpha != null ? s.fillAlpha : 0.14), stroke: 'none'
      }, svg) : null;
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

    /* 悬停高亮：命中处临时放大数据点并用本色实心填充（高饱和聚焦点），
       移出即清空；原来的静态点保持不动 */
    var hotDots = el('g', null, svg);
    function clearHotDots() { clear(hotDots); }
    function markHotDots(idx) {
      clear(hotDots);
      series.forEach(function (s) {
        var p = s.points[idx];
        if (!p) return;
        el('circle', {
          cx: X(idx), cy: Y(p.value), r: 7,
          fill: s.color, stroke: T['--c-surface'], 'stroke-width': 2.2
        }, hotDots);
      });
    }

    hover.addEventListener('mousemove', function (e) {
      var host = container.getBoundingClientRect();
      var ratioX = Math.max(0, Math.min(1, (e.clientX - host.left) / host.width));
      var idx = Math.max(0, Math.min(n - 1, Math.round(((ratioX * W - pad.l) / pw) * (n - 1))));
      cross.setAttribute('x1', X(idx));
      cross.setAttribute('x2', X(idx));
      cross.setAttribute('opacity', 0.75);
      markHotDots(idx);
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
      /* 播放器正停在某一年上时，移开鼠标不能把那一年一起擦掉 */
      if (ctx.focusIndex >= 0) markHotDots(ctx.focusIndex); else clearHotDots();
      hideTip(ctx);
    });

    /* —— 年份聚焦：工具栏的播放器每前进一帧就调一次 ctx.focus(i) ——
       只改线的位置和两颗高亮点，不重画整张图，所以逐帧播放不会闪。
       徽标固定在绘图区右上角，避免和 X 轴刻度、Y 轴标题打架。 */
    var focusLine = el('line', {
      y1: pad.t, y2: pad.t + ph, stroke: T['--c-accent'],
      'stroke-width': 1.6, 'stroke-dasharray': '4 4', opacity: 0, 'pointer-events': 'none'
    }, svg);
    var badge = el('g', { opacity: 0, 'pointer-events': 'none' }, svg);
    var badgeBox = el('rect', { rx: 9, y: pad.t + 8, height: 22, fill: T['--c-accent'] }, badge);
    var badgeTxt = el('text', {
      'text-anchor': 'middle', y: pad.t + 23, fill: T['--c-on-accent'],
      'font-size': 12, 'font-weight': 800
    }, badge);

    var years = series[0].points.map(function (p, i) {
      return p.label != null ? p.label : String(p.year != null ? p.year : i + 1);
    });

    function focus(idx) {
      if (idx == null || idx < 0) {
        focusLine.setAttribute('opacity', 0);
        badge.setAttribute('opacity', 0);
        clearHotDots();
        ctx.focusIndex = -1;
        return -1;
      }
      idx = Math.max(0, Math.min(n - 1, idx));
      focusLine.setAttribute('x1', X(idx));
      focusLine.setAttribute('x2', X(idx));
      focusLine.setAttribute('opacity', 0.9);
      markHotDots(idx);
      var bw = Math.max(48, years[idx].length * 8 + 22);
      var bx = Math.min(pad.l + pw - bw - 6, Math.max(pad.l + 6, X(idx) - bw / 2));
      badgeBox.setAttribute('x', bx);
      badgeBox.setAttribute('width', bw);
      badgeTxt.setAttribute('x', bx + bw / 2);
      badgeTxt.textContent = (cfg.yearPrefix || '') + years[idx];
      badge.setAttribute('opacity', 1);
      ctx.focusIndex = idx;
      return idx;
    }

    ctx.focus = focus;
    ctx.years = years;
    ctx.count = n;
    ctx.focusIndex = -1;

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
    var W = canvasW(container, 900, 280);
    var narrow = W < 560;
    var rowH = narrow ? 28 : 34, gap = narrow ? 8 : 10;
    var H = rows.length * (rowH + gap) + 34;
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    /* 窄屏不沿用调用方传的 170px 标签列，否则条形只剩几十像素 */
    var labelW = narrow ? Math.max(88, Math.round(W * 0.36)) : (cfg.labelWidth || 150);
    var valueW = narrow ? 54 : 66;
    var barArea = W - labelW - valueW - 24;
    var max = cfg.max || Math.max.apply(null, rows.map(function (r) { return r.value; }));
    var unit = cfg.unit || '';

    rows.forEach(function (r, i) {
      var y = 16 + i * (rowH + gap);
      var isTop = i < (cfg.highlight || 2);
      /* 重点条（默认前 2 名）= 高饱和强调橙；其余 = 低彩度底色系列，
         不再用「同一个主色 + opacity .82」的廉价做法 */
      var color = r.color || (isTop ? T['--c-accent'] : T['--s-base']);

      el('text', {
        x: labelW - 12, y: y + rowH / 2 + 5, 'text-anchor': 'end',
        fill: T['--c-text'], 'font-size': narrow ? 12 : 13.5, 'font-weight': 700
      }, svg).textContent = (r.flag ? r.flag + ' ' : '') + r.name;

      el('rect', { x: labelW, y: y, width: barArea, height: rowH, rx: 6, fill: T['--c-surface-2'] }, svg);

      var bar = el('rect', {
        x: labelW, y: y, width: 0, height: rowH, rx: 6,
        fill: color
      }, svg);
      var shine = el('rect', {
        x: labelW, y: y, width: 0, height: rowH, rx: 6,
        fill: alpha('#ffffff', 0.16)
      }, svg);

      var val = el('text', {
        x: labelW + barArea + 12, y: y + rowH / 2 + 5,
        fill: T['--c-text-soft'], 'font-size': narrow ? 11.5 : 13, 'font-weight': 800
      }, svg);
      val.textContent = fmt(r.value, cfg.decimals || 0) + unit;

      r._bar = bar; r._shine = shine; r._y = y; r._color = color;
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
        /* 悬停 = 高饱和强调：底色条翻成强调橙 + 主色描边，与「底色」拉开距离 */
        r._bar.setAttribute('fill', T['--c-accent']);
        r._bar.setAttribute('stroke', T['--c-primary']);
        r._bar.setAttribute('stroke-width', 2);
        showTip(ctx, '<b>' + r.name + '</b><span class="viz-tip-row">' + (cfg.metric || '') +
          '<b>' + fmt(r.value, cfg.decimals || 0) + unit + '</b></span>' +
          (r.note ? '<span class="viz-tip-note">' + r.note + '</span>' : ''),
          ((labelW + barArea * (r.value / max) / 2) / ctx.w) * container.clientWidth,
          (r._y / ctx.h) * container.clientHeight);
      });
      rect.addEventListener('mouseleave', function () {
        r._bar.setAttribute('fill', r._color);
        r._bar.removeAttribute('stroke');
        r._bar.removeAttribute('stroke-width');
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
    var W = canvasW(container, 900, 280);
    var narrow = W < 560;
    var barGap = narrow ? 19 : 22, barH = narrow ? 14 : 15, headH = narrow ? 22 : 24;
    var labelW = narrow ? Math.max(86, Math.round(W * 0.34)) : (cfg.labelWidth || 150);
    var noteH = narrow ? 30 : 22;                 /* 窄屏注释折两行 */
    var rowH = headH + rows[0].bars.length * barGap + noteH;
    var H = rows.length * rowH + 30;
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var area = W - labelW - (narrow ? 58 : 76);
    var max = cfg.max || 100;
    var unit = cfg.unit || '%';

    var bars = [];
    rows.forEach(function (r, i) {
      var top = 18 + i * rowH;
      /* 每行一个 <g>：跨图联动筛选时，整行（名称 + 条形 + 注释）一起淡出 */
      var g = el('g', null, svg);
      var hit = !!(cfg.dimId && r.id === cfg.dimId);
      if (cfg.dimId && !hit) g.setAttribute('opacity', 0.22);
      if (hit) {
        /* 左侧强调条：明示「这一行是被气泡图选中联动的」 */
        el('rect', { x: labelW - 9, y: top, width: 3, height: rowH - noteH, rx: 1.5, fill: T['--c-accent'] }, svg);
      }

      /* 左侧：对象名（放在条形列左侧，不会与条形重叠） */
      el('text', {
        x: labelW - 16, y: top + 10, 'text-anchor': 'end',
        fill: hit ? T['--c-accent-ink'] : T['--c-text'], 'font-size': narrow ? 12.5 : 14, 'font-weight': 800
      }, g).textContent = r.key;

      r.bars.forEach(function (b, j) {
        var y = top + headH + j * barGap;
        el('rect', { x: labelW, y: y, width: area, height: barH, rx: 7.5, fill: T['--c-surface-2'] }, g);
        var bar = el('rect', { x: labelW, y: y, width: 0, height: barH, rx: 7.5, fill: b.color }, g);
        /* 条形内的标签底色随条形走：深色底系列配 --c-text，强调橙配 --c-on-accent，
           避免「白字压在浅底上」或「橙底白字 3.56:1 不达标」 */
        var name = el('text', {
          x: labelW + 9, y: y + 12, fill: b.onColor || T['--c-on-primary'],
          'font-size': narrow ? 10.5 : 11, 'font-weight': 800, 'pointer-events': 'none'
        }, g);
        name.textContent = b.label;
        var txt = el('text', {
          x: labelW + area + 10, y: y + 12.5, fill: T['--c-text-soft'],
          'font-size': narrow ? 11.5 : 12, 'font-weight': 800
        }, g);
        txt.textContent = (cfg.decimals != null ? fmt(b.value, cfg.decimals) : fmt(b.value, 0)) + unit;
        bars.push({ bar: bar, value: b.value });
      });

      /* 右侧下方：一行说明，避免挤占左侧名称列 */
      if (r.note) {
        var noteY = top + headH + r.bars.length * barGap + 12;
        if (narrow) {
          wrapText(g, r.note, labelW, noteY, area + 50, 13, 2, T['--c-muted'], 11);
        } else {
          el('text', {
            x: labelW, y: noteY, fill: T['--c-muted'], 'font-size': 11.5
          }, g).textContent = r.note;
        }
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
    var W = canvasW(container, 900, 280);
    var H = Math.round(W * 0.56);
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var narrow = W < 560;
    var pad = narrow ? { t: 18, r: 12, b: 44, l: 42 } : { t: 26, r: 30, b: 52, l: 62 };
    var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    var xMax = cfg.xMax || 50, yMax = cfg.yMax || 42;

    function X(v) { return pad.l + pw * (v / xMax); }
    function Y(v) { return pad.t + ph * (1 - v / yMax); }

    /* 四象限底色 */
    el('rect', { x: pad.l, y: pad.t, width: pw / 2, height: ph / 2, fill: alpha(T['--c-primary'], 0.05) }, svg);
    el('rect', { x: pad.l + pw / 2, y: pad.t, width: pw / 2, height: ph / 2, fill: alpha(T['--c-accent'], 0.06) }, svg);
    el('rect', { x: pad.l + pw / 2, y: pad.t + ph / 2, width: pw / 2, height: ph / 2, fill: alpha(T['--c-primary'], 0.03) }, svg);

    /* 网格与刻度 */
    niceTicks(0, xMax, narrow ? 4 : 5).forEach(function (v) {
      el('line', { x1: X(v), y1: pad.t, x2: X(v), y2: pad.t + ph, stroke: T['--c-border'], 'stroke-width': 1, 'stroke-dasharray': '3 5' }, svg);
      el('text', { x: X(v), y: pad.t + ph + 22, 'text-anchor': 'middle', fill: T['--c-muted'], 'font-size': narrow ? 11 : 11.5 }, svg)
        .textContent = fmt(v, 0);
    });
    niceTicks(0, yMax, narrow ? 3 : 4).forEach(function (v) {
      el('line', { x1: pad.l, y1: Y(v), x2: pad.l + pw, y2: Y(v), stroke: T['--c-border'], 'stroke-width': 1, 'stroke-dasharray': '3 5' }, svg);
      el('text', { x: pad.l - 10, y: Y(v) + 4, 'text-anchor': 'end', fill: T['--c-muted'], 'font-size': narrow ? 11 : 11.5 }, svg)
        .textContent = fmt(v, 0);
    });

    /* 中位分割线 */
    el('line', { x1: X(xMax / 2), y1: pad.t, x2: X(xMax / 2), y2: pad.t + ph, stroke: T['--c-primary'], 'stroke-width': 1.6, 'stroke-dasharray': '6 5', opacity: 0.55 }, svg);
    el('line', { x1: pad.l, y1: Y(yMax / 2), x2: pad.l + pw, y2: Y(yMax / 2), stroke: T['--c-primary'], 'stroke-width': 1.6, 'stroke-dasharray': '6 5', opacity: 0.55 }, svg);

    /* 轴标题 */
    el('text', { x: pad.l + pw / 2, y: H - 10, 'text-anchor': 'middle', fill: T['--c-text-soft'], 'font-size': narrow ? 12 : 13, 'font-weight': 700 }, svg)
      .textContent = cfg.xLabel;
    el('text', {
      x: 14, y: pad.t + ph / 2, 'text-anchor': 'middle', fill: T['--c-text-soft'],
      'font-size': narrow ? 12 : 13, 'font-weight': 700, transform: 'rotate(-90 14 ' + (pad.t + ph / 2) + ')'
    }, svg).textContent = cfg.yLabel;

    /* 象限标注：右上 / 左上 / 左下 / 右下 */
    var q = cfg.quadrants || [];
    if (q.length === 4) {
      [[pad.l + 12, pad.t + 18, 'start', 1], [pad.l + pw - 12, pad.t + 18, 'end', 0],
       [pad.l + 12, pad.t + ph - 10, 'start', 2], [pad.l + pw - 12, pad.t + ph - 10, 'end', 3]]
        .forEach(function (pos) {
          el('text', { x: pos[0], y: pos[1], 'text-anchor': pos[2], fill: T['--c-muted'], 'font-size': narrow ? 10.5 : 11.5, 'font-weight': 800 }, svg)
            .textContent = q[pos[3]];
        });
    }


    /* 气泡：面积 ∝ 市场规模 */
    var sizes = cfg.points.map(function (p) { return p.size; });
    var sMin = Math.min.apply(null, sizes), sMax = Math.max.apply(null, sizes);
    var rMin = narrow ? 7 : 9, rMax = narrow ? 21 : 34;
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
      rec.label = el('text', {
        x: X(rec.p.x), y: Y(rec.p.y) + 3.5, 'text-anchor': 'middle',
        fill: T['--c-text'], 'font-size': narrow ? 9.5 : 10.5, 'font-weight': 800, 'pointer-events': 'none'
      }, labels);
      rec.label.textContent = rec.p.name;
    });

    animate(860, function (pr) {
      recs.forEach(function (rec) { rec.node.setAttribute('r', (rec.r * pr).toFixed(2)); });
      labels.setAttribute('opacity', Math.max(0, (pr - 0.45) / 0.55).toFixed(2));
    });

    /* —— 选中态（跨图联动的「主控端」）——
       app.js 把当前选中的行业下标放进 cfg.picked，这里只负责把它画出来：
       命中的气泡加粗描边并翻成强调色，其余整颗淡下去。
       鼠标移出时必须调用 paintSelection() 复位，否则 hover 的临时填充会盖住选中态。 */
    function paintSelection() {
      var pick = cfg.picked == null ? -1 : cfg.picked;
      recs.forEach(function (rec, i) {
        var on = pick < 0 || i === pick;
        rec.node.setAttribute('opacity', on ? 1 : 0.16);
        rec.label.setAttribute('opacity', on ? 1 : 0.16);
        if (i === pick) {
          rec.node.setAttribute('fill', alpha(T['--c-accent'], 0.5));
          rec.node.setAttribute('stroke', T['--c-accent']);
          rec.node.setAttribute('stroke-width', 3.4);
        } else {
          rec.node.setAttribute('fill', alpha(rec.color, 0.32));
          rec.node.setAttribute('stroke', rec.color);
          rec.node.setAttribute('stroke-width', 2);
        }
      });
    }
    paintSelection();

    recs.forEach(function (rec, i) {
      /* 键盘 / 读屏走工具栏里的行业下拉框（见 index.html 的 aria 说明），
         这里只补一个 title，鼠标用户悬停时也能看到提示 */
      if (cfg.onPick) {
        rec.node.setAttribute('title', rec.p.name);
        rec.node.addEventListener('click', function () {
          cfg.onPick(cfg.picked === i ? null : i);
        });
      }
      rec.node.addEventListener('mouseenter', function () {
        if (cfg.picked !== i) rec.node.setAttribute('fill', alpha(rec.color, 0.62));
        showTip(ctx, '<b>' + rec.p.name + '</b>' +
          '<span class="viz-tip-row">' + cfg.xLabel + '<b>' + rec.p.x + '%</b></span>' +
          '<span class="viz-tip-row">' + cfg.yLabel + '<b>' + rec.p.y + '%</b></span>' +
          '<span class="viz-tip-row">' + cfg.sizeLabel + '<b>' + fmt(rec.p.size, 0) + '</b></span>' +
          (cfg.pickHint ? '<span class="viz-tip-note">' + cfg.pickHint + '</span>' : ''),
          (X(rec.p.x) / W) * container.clientWidth, (Y(rec.p.y) / H) * container.clientHeight);
      });
      rec.node.addEventListener('mouseleave', function () {
        paintSelection();
        hideTip(ctx);
      });
    });
    ctx.recs = recs;
    return ctx;
  }

  /* =========================================================
   * ⑥ 环形仪表（模拟器用）
   * ========================================================= */
  function gauge(container, cfg) {
    /* 设计 200×200；容器多宽就画多宽（上限 200）。
       原来 CSS 把 200×200 压到 125px 渲染，12 单位的文字只剩 7.5px —— 比手机上还小 */
    var S = canvasW(container, 200, 110);
    var ctx = stage(container, [S, S], 200);
    var T = readTokens();
    var svg = ctx.svg;
    var cx = S / 2, cy = S / 2, r = S * 0.37, sw = S * 0.08;
    var circ = 2 * Math.PI * r;

    el('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: T['--c-surface-2'], 'stroke-width': sw }, svg);
    var arc = el('circle', {
      cx: cx, cy: cy, r: r, fill: 'none', stroke: cfg.color || T['--c-primary'],
      'stroke-width': sw, 'stroke-linecap': 'round',
      'stroke-dasharray': circ, 'stroke-dashoffset': circ,
      transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
    }, svg);
    var val = el('text', {
      x: cx, y: cy + S * 0.02, 'text-anchor': 'middle', fill: T['--c-text'],
      'font-size': Math.round(S * 0.17), 'font-weight': 800
    }, svg);
    el('text', {
      x: cx, y: cy + S * 0.13, 'text-anchor': 'middle', fill: T['--c-muted'],
      'font-size': Math.max(9, Math.round(S * 0.06)), 'font-weight': 700
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
    var W = canvasW(container, 900, 300);
    var narrow = W < 560;
    /* 窄屏三列会挤在一起，改成竖长画布：靠高度换空间 */
    var H = narrow ? Math.max(Math.round(W * 0.95), 340) : Math.round(W * 0.52);
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var nodeW = narrow ? 12 : 16, padY = 30, gapY = narrow ? 10 : 14;
    /* 三列横坐标按画布宽度取比例（900 宽时正好回到 130 / 450 / 770） */
    var colX = [Math.round(W * 0.145), Math.round(W * 0.5), Math.round(W * 0.855)];
    var labelGap = narrow ? 8 : 12;
    var minNodeH = narrow ? 30 : 26;
    var nodeMap = {};
    cfg.nodes.forEach(function (n) { nodeMap[n.id] = n; });

    /* 每一列内部按权重分配纵向位置 */
    [0, 1, 2].forEach(function (c) {
      var list = cfg.nodes.filter(function (n) { return n.col === c; });
      var total = list.reduce(function (a, b) { return a + b.weight; }, 0);
      var usable = H - padY * 2 - (list.length - 1) * gapY;
      var y = padY;
      list.forEach(function (n) {
        n.h = Math.max(minNodeH, (n.weight / total) * usable);
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
      /* 节点是纵向大色块：默认填低彩度「底色系列」+ 高饱和描边表达分组，
         悬停时再升温为高饱和填充 —— 大面积要安静、交互才高饱和 */
      var color = n.col === 0 ? T['--c-info'] : (n.col === 1 ? T['--c-primary'] : T['--c-success']);
      var base = n.col === 0 ? T['--s-base-alt'] : (n.col === 1 ? T['--s-base'] : T['--s-base-warm']);
      var right = n.col === 2;
      var rect = el('rect', {
        x: colX[n.col], y: n.y, width: nodeW, height: n.h, rx: 5,
        fill: base, stroke: color, 'stroke-width': 1.6, style: 'cursor:pointer'
      }, gNodes);
      el('text', {
        x: right ? colX[n.col] - labelGap : colX[n.col] + nodeW + labelGap,
        y: n.y + n.h / 2 + (n.h > 44 ? -2 : 4),
        'text-anchor': right ? 'end' : 'start',
        fill: T['--c-text'], 'font-size': narrow ? 11.5 : 12.5, 'font-weight': 700, 'pointer-events': 'none'
      }, gNodes).textContent = (n.icon ? n.icon + ' ' : '') + n.label;
      if (n.h > 44) {
        el('text', {
          x: right ? colX[n.col] - labelGap : colX[n.col] + nodeW + labelGap,
          y: n.y + n.h / 2 + 15,
          'text-anchor': right ? 'end' : 'start',
          fill: T['--c-muted'], 'font-size': narrow ? 10 : 10.5, 'pointer-events': 'none'
        }, gNodes).textContent = (cfg.weightLabel || tk('graph.weight', 'Weight')) + ' ' + fmt(n.weight, 0) + '%';
      }

      /* 悬停：只保留该节点相关的流向 */
      rect.addEventListener('mouseenter', function () {
        linkEls.forEach(function (rec) {
          var on = rec.a.id === n.id || rec.b.id === n.id;
          rec.path.setAttribute('stroke-opacity', on ? 0.85 : 0.06);
          rec.path.setAttribute('stroke-width', (on ? rec.w * 1.25 : rec.w).toFixed(2));
        });
        rect.setAttribute('fill', alpha(color, 0.62));
        rect.setAttribute('stroke', T['--c-accent']);
        rect.setAttribute('stroke-width', 2.4);
      });
      rect.addEventListener('mouseleave', function () {
        linkEls.forEach(function (rec) {
          rec.path.setAttribute('stroke-opacity', 0.3);
          rec.path.setAttribute('stroke-width', rec.w.toFixed(2));
        });
        rect.setAttribute('fill', base);
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', 1.6);
      });
    });

    /* 列标题 */
    (cfg.columns || []).forEach(function (label, i) {
      el('text', {
        x: colX[i] + nodeW / 2, y: 15, 'text-anchor': 'middle',
        fill: T['--c-text-soft'], 'font-size': narrow ? 11.5 : 12.5, 'font-weight': 800
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
    /* 画布随容器宽度（上限 960）：窄屏字号即像素，不再被压到 4px */
    var W = canvasW(container, 960, 320);
    var H = W < 560 ? Math.max(Math.round(W * 1.15), 380) : Math.round(W * 0.646);
    var k = W / 960;                       /* 力参数 / 半径随画布缩放 */
    var ks = Math.max(k, 0.5);             /* 缩放下限：再小节点就点不到了 */
    var narrow = W < 560;
    container.classList.add('viz');
    clear(container);
    var svg = el('svg', {
      class: 'viz-svg viz-svg--graph',
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      style: 'max-width:960px;margin:0 auto',
      /* 同 stage()：可及名在容器上，画布对读屏隐藏（十字方向的「适应窗口」按钮在容器外，仍可聚焦） */
      'aria-hidden': 'true'
    });
    container.appendChild(svg);
    var tip = div('viz-tip', container);
    tip.hidden = true;
    var ctx = { svg: svg, tip: tip, w: W, h: H, container: container };

    var T = readTokens();
    if (!window.d3 || !window.d3.forceSimulation) {
      div('viz-error', container, tk('graph.engineMissing', 'Force engine (d3-force) not loaded — please check that the vendor/ folder is complete.'));
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

    /* 边界力：把节点夹在画布内 —— 否则贴边节点的文字会溢出卡片
       （SVG 是 overflow:visible，力导向的位置又不可预测） */
    function boundaryForce(pad) {
      return function () {
        nodes.forEach(function (d) {
          if (d.x < pad) d.x = pad;
          if (d.x > W - pad) d.x = W - pad;
          if (d.y < pad) d.y = pad;
          if (d.y > H - pad) d.y = H - pad;
        });
      };
    }

    var sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(function (l) {
        return (92 + (l.source.size + l.target.size) * 0.6) * ks;
      }).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-560 * ks))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide().radius(function (d) { return (d.size + 16) * ks; }))
      .force('x', d3.forceX(W / 2).strength(0.04))
      .force('y', d3.forceY(H / 2).strength(0.05))
      .force('bounds', boundaryForce(narrow ? 34 : 26));

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
      .attr('r', function (d) { return Math.max(6, d.size * ks); })
      .attr('fill', function (d) { return alpha(d.color, 0.18); })
      .attr('stroke', function (d) { return d.color; })
      .attr('stroke-width', 2.2);

    nodeSel.append('circle')
      .attr('r', function (d) { return Math.max(6, d.size * ks) * 0.34; })
      .attr('fill', function (d) { return d.color; })
      .attr('pointer-events', 'none');

    /* 节点标签：窄屏折两行（长标签如「「数据要素×」行动」单行 88px，会顶出画布） */
    if (narrow) {
      nodeSel.each(function (d) {
        var r = Math.max(6, d.size * ks);
        wrapText(this, d.label, 0, r + 12, 68, 12, 2, T['--c-text'], 11, 'middle');
        Array.prototype.forEach.call(this.querySelectorAll('text'), function (t) {
          t.setAttribute('paint-order', 'stroke');
          t.setAttribute('stroke', T['--c-surface']);
          t.setAttribute('stroke-width', 3);
          t.setAttribute('font-weight', 700);
          t.setAttribute('pointer-events', 'none');
        });
      });
    } else {
      nodeSel.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', function (d) { return Math.max(6, d.size * ks) + 13; })
        .attr('fill', T['--c-text'])
        .attr('font-size', 12.5)
        .attr('font-weight', 700)
        .attr('paint-order', 'stroke')
        .attr('stroke', T['--c-surface'])
        .attr('stroke-width', 3.5)
        .attr('pointer-events', 'none')
        .text(function (d) { return d.label; });
    }

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

    /* ---------------- 控制条与图例 ----------------
       控制条挂在画布「外面」：container 上带 role="img"，
       里面塞可聚焦按钮会被读屏当图片内容直接吞掉，按钮就成了摆设。 */
    var bar = div('viz-toolbar viz-toolbar--inset', null);
    var barHost = container.parentElement || container;
    barHost.insertBefore(bar, container.nextSibling);
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
    var W = canvasW(container, 900, 300);
    /* 窄屏：中轴挪到左边、卡片全部靠右 —— 左右交替时半屏宽只剩 80px，标题都放不下 */
    var narrow = W < 640;
    var rowH = narrow ? 100 : 104, top = 58, bottom = 40;
    var H = top + items.length * rowH + bottom;
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var axis = narrow ? 24 : W / 2;
    var cardW = narrow ? W - axis - 16 : W / 2 - 78;

    var line = el('line', {
      x1: axis, y1: top - 30, x2: axis, y2: top - 30,
      stroke: T['--c-border-2'], 'stroke-width': 2
    }, svg);
    var nodes = [];
    var rings = [];   /* 每个节点一枚焦点环，供 app.js 的方向键移动（见文件末尾 ctx.focusIndex） */

    items.forEach(function (it, i) {
      var y = top + i * rowH;
      var right = narrow ? true : i % 2 === 1;
      var color = cfg.colors[it.kind] || T['--c-primary'];
      var g = el('g', { opacity: 0 }, svg);
      nodes.push(g);

      el('line', {
        x1: narrow ? axis : (right ? axis : axis - 26), y1: y,
        x2: right ? axis + (narrow ? 14 : 26) : axis,
        y2: y, stroke: color, 'stroke-width': 2
      }, g);
      el('circle', {
        cx: axis, cy: y, r: narrow ? 6 : 8,
        fill: T['--c-surface'], stroke: color, 'stroke-width': 3
      }, g);
      if (!narrow) {
        el('text', {
          x: right ? axis - 22 : axis + 22, y: y + 5,
          'text-anchor': right ? 'end' : 'start',
          fill: color, 'font-size': 18, 'font-weight': 800
        }, g).textContent = it.year;
      }

      var cx = right ? axis + (narrow ? 14 : 26) : axis - 26 - cardW;
      var cardH = narrow ? 88 : 84;
      var top0 = y - (narrow ? 34 : 42);
      el('rect', {
        x: cx, y: top0, width: cardW, height: cardH, rx: 12,
        fill: T['--c-surface'], stroke: T['--c-border'], 'stroke-width': 1
      }, g);
      el('rect', { x: cx, y: top0, width: 4, height: cardH, rx: 2, fill: color }, g);

      if (narrow) {
        /* 窄屏：年份占第一行（中轴左侧放不下），标题第二行，正文两行 */
        el('text', {
          x: cx + 16, y: top0 + 20, fill: color, 'font-size': 13, 'font-weight': 800
        }, g).textContent = it.year;
        el('text', {
          x: cx + cardW - 14, y: top0 + 20, 'text-anchor': 'end',
          fill: color, 'font-size': 11, 'font-weight': 700
        }, g).textContent = cfg.kindLabel[it.kind] || '';
        el('text', {
          x: cx + 16, y: top0 + 38, fill: T['--c-text'], 'font-size': 13.5, 'font-weight': 800
        }, g).textContent = it.title;
        wrapText(g, it.desc, cx + 16, top0 + 56, cardW - 32, 15, 2, T['--c-text-soft'], 11);
      } else {
        el('text', { x: cx + 18, y: y - 18, fill: T['--c-text'], 'font-size': 15, 'font-weight': 800 }, g)
          .textContent = it.title;
        el('text', {
          x: cx + cardW - 16, y: y - 18, 'text-anchor': 'end',
          fill: color, 'font-size': 11.5, 'font-weight': 700
        }, g).textContent = cfg.kindLabel[it.kind] || '';
        wrapText(g, it.desc, cx + 18, y + 4, cardW - 36, 17, 3, T['--c-text-soft']);
      }

      /* 键盘导航的焦点环：默认不可见，方向键移到哪个节点就亮哪一个。
         用表现属性画（stroke 走 --c-focus，与全站焦点环同一把尺），
         class 只当选择器用（smoke.mjs 靠它断言「环真的挪了」）——
         图形本身仍在 aria-hidden 的画布里，读屏靠 app.js 的 role="status" 播报。 */
      rings.push(el('rect', {
        class: 'tl-focus',
        x: cx - 3, y: top0 - 3, width: cardW + 6, height: cardH + 6, rx: 14,
        fill: 'none', stroke: T['--c-focus'], 'stroke-width': 2, opacity: 0
      }, g));
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
    /* 键盘导航（P3）：把「第几个节点」变成一个能被方向键移动的光标。
       10 个节点只有这一个 Tab 停点（容器上的 tabindex），方向键在这里移动 ——
       不是给 10 个 <g> 各挂一个 tabindex（那会把键盘用户丢进 Tab 里）。
       按键与播报在 app.js（那里有词表），这里只管把焦点环挪过去、并把这一行点亮。
       传 null = 焦点离开，环消失；返回值是钳位后的下标，调用方据此播报。 */
    var activeIdx = -1;
    ctx.count = items.length;
    ctx.focusIndex = function (i) {
      if (i === null || i === undefined) {
        if (activeIdx > -1) rings[activeIdx].setAttribute('opacity', 0);
        activeIdx = -1;
        return -1;
      }
      var n = Math.max(0, Math.min(items.length - 1, Number(i) || 0));
      if (n === activeIdx) return activeIdx;
      if (activeIdx > -1) rings[activeIdx].setAttribute('opacity', 0);
      activeIdx = n;
      rings[n].setAttribute('opacity', 1);
      /* 动画可能还在跑（900ms），把这一行直接落到位，免得环亮了字还是虚的 */
      nodes[n].setAttribute('opacity', 1);
      nodes[n].setAttribute('transform', 'translate(0,0)');
      return activeIdx;
    };
    return ctx;
  }

  /* 简易自动换行：按字数估算，最多 maxLines 行，超出补省略号
     fontSize / anchor 可选（窄屏用得到的两种排版：居中折行、右对齐折行） */
  function wrapText(parent, text, x, y, maxW, lineH, maxLines, fill, fontSize, anchor) {
    var fs = fontSize || 12.5;
    var chars = String(text).split('');
    var perLine = Math.max(6, Math.floor(maxW / (fs * 0.98)));
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
      el('text', {
        x: x, y: y + j * lineH, fill: fill, 'font-size': fs, 'text-anchor': anchor || null
      }, parent).textContent = lines[j];
    }
    return lines.length;
  }

  /* =========================================================
   * ⑩ 省级分级填色地图（choropleth）
   * ---------------------------------------------------------
   * 几何来自 window.CN_MAP（开发期由 D:/Vis/_map.mjs 抽稀生成，见该文件头注释），
   * 这里只做三件事：等比缩放、按分位数分五档填色、悬停读数。
   * 颜色用「主色的五个透明度档」而不是五个色相：单色顺序色阶的深浅与数值同序，
   * 切主题时也自动跟着换（浅色主题叠在白底、深色主题叠在深底）。
   * ========================================================= */
  function choropleth(container, cfg) {
    var geo = cfg.geo;
    var W = canvasW(container, 900, 300);
    var H = Math.round(W * 0.74);
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var narrow = W < 560;
    var pad = { t: narrow ? 8 : 12, r: narrow ? 8 : 16, b: narrow ? 8 : 12, l: narrow ? 14 : 16 };
    var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

    /* 等比缩放到画布内并居中：地图一旦被拉伸，比画得粗更糟糕 */
    var s = Math.min(pw / geo.w, ph / geo.h);
    var ox = pad.l + (pw - geo.w * s) / 2;
    var oy = pad.t + (ph - geo.h * s) / 2;
    var PX = function (x) { return (ox + x * s).toFixed(2); };
    var PY = function (y) { return (oy + y * s).toFixed(2); };
    function pathOf(polys) {
      var d = '';
      polys.forEach(function (flat) {
        for (var i = 0; i < flat.length; i += 2) {
          d += (i ? 'L' : 'M') + PX(flat[i]) + ' ' + PY(flat[i + 1]);
        }
        d += 'Z';
      });
      return d;
    }
    function centerOf(polys) {
      var big = polys[0], best = -1;
      polys.forEach(function (flat) {                       /* 取最大的那个环当定位锚 */
        if (flat.length > best) { best = flat.length; big = flat; }
      });
      var x = 0, y = 0, n = big.length / 2;
      for (var i = 0; i < big.length; i += 2) { x += big[i]; y += big[i + 1]; }
      return [(x / n) * s + ox, (y / n) * s + oy];
    }

    /* —— 五档分位数：比线性分档更能看清尾部，也不会被一个极端值压扁 —— */
    var vals = [];
    geo.provinces.forEach(function (p) { if (cfg.values[p.id] != null) vals.push(cfg.values[p.id]); });
    vals.sort(function (a, b) { return a - b; });
    var cuts = [];
    for (var q = 1; q <= 4; q++) cuts.push(vals[Math.min(vals.length - 1, Math.floor((vals.length * q) / 5))]);
    function classOf(v) {
      for (var i = 0; i < cuts.length; i++) if (v <= cuts[i]) return i;
      return cuts.length;
    }
    var ALPHA = [0.14, 0.3, 0.46, 0.64, 0.86];
    var ramp = null;
    function fillFor(v) {
      if (v == null) return T['--c-surface-2'];
      if (!ramp) ramp = ALPHA.map(function (a) { return alpha(T['--c-primary'], a); });
      return ramp[classOf(v)];
    }

    /* —— 排名（用于「前五名」高亮与悬停读数）—— */
    var rank = {};
    vals.slice().sort(function (a, b) { return b - a; }).forEach(function (v, i) { if (rank[v] == null) rank[v] = i + 1; });
    var top = geo.provinces
      .filter(function (p) { return cfg.values[p.id] != null; })
      .sort(function (a, b) { return cfg.values[b.id] - cfg.values[a.id]; })
      .slice(0, 5)
      .map(function (p) { return p.id; });

    ctx.count = vals.length;
    ctx.top = top;

    /* —— 面：一个省一个 <path>，配色 + 悬停读数 —— */
    var shapes = [];
    geo.provinces.forEach(function (p) {
      var v = cfg.values[p.id];
      var dim = !!(cfg.leadersOnly && top.indexOf(p.id) < 0);
      var path = el('path', {
        d: pathOf(p.polys),
        fill: fillFor(v),
        stroke: T['--c-surface'],
        'stroke-width': 1.1,
        opacity: 0,
        style: 'cursor:pointer'
      }, svg);
      var rec = { node: path, value: v, dim: dim };
      shapes.push(rec);
      if (dim) { path.setAttribute('opacity', 0.26); path.setAttribute('stroke', T['--c-border']); }
      path.addEventListener('mousemove', function (e) {
        if (!dim) path.setAttribute('stroke', T['--c-accent']);
        var rows = '<b>' + (cfg.names[p.id] || p.id) + '</b>';
        if (v == null) rows += '<span class="viz-tip-row">' + cfg.noData + '</span>';
        else {
          rows += '<span class="viz-tip-row">' + cfg.metricLabel +
            '<b>' + fmt(v, cfg.decimals) + cfg.unit + '</b></span>' +
            '<span class="viz-tip-row">' + cfg.rankLabel +
            '<b>' + rank[v] + ' / ' + vals.length + '</b></span>';
        }
        var box = container.getBoundingClientRect();
        showTip(ctx, rows, e.clientX - box.left, e.clientY - box.top);
      });
      path.addEventListener('mouseleave', function () {
        path.setAttribute('stroke', dim ? T['--c-border'] : T['--c-surface']);
        hideTip(ctx);
      });
    });
    animate(620, function (pr) {
      shapes.forEach(function (rec) {
        if (!rec.dim) rec.node.setAttribute('opacity', pr.toFixed(2));
      });
    });

    /* —— 省名：只标前五名，34 个名字全画会糊成一片 —— */
    var labels = el('g', { 'pointer-events': 'none' }, svg);
    geo.provinces.forEach(function (p) {
      if (top.indexOf(p.id) < 0) return;
      var c = centerOf(p.polys);
      var name = cfg.names[p.id] || '';
      var size = narrow ? 9 : 10.5;
      /* 先画一层描边（底色）再画文字：名字压在深色块上也看得清，
         而且描边是 SVG 属性而不是 CSS 阴影，导出 PNG/SVG 不会掉效果 */
      el('text', {
        x: c[0].toFixed(1), y: c[1].toFixed(1), 'text-anchor': 'middle', fill: 'none',
        stroke: T['--c-surface'], 'stroke-width': 2.6, 'font-size': size, 'font-weight': 800
      }, labels).textContent = name;
      el('text', {
        x: c[0].toFixed(1), y: c[1].toFixed(1), 'text-anchor': 'middle',
        fill: T['--c-text'], 'font-size': size, 'font-weight': 800
      }, labels).textContent = name;
    });

    /* —— 南海诸岛插图（右下角小框，官方地图的常规做法）—— */
    var ins = geo.inset;
    if (ins) {
      var iw = Math.max(44, Math.min(96, W * 0.1));
      var is = iw / ins.w;
      var ih = ins.h * is;
      var ix = W - pad.r - iw - 4;
      var iy = H - pad.b - ih - 4;
      var frame = el('g', null, svg);
      el('rect', {
        x: ix.toFixed(1), y: iy.toFixed(1), width: iw.toFixed(1), height: ih.toFixed(1),
        rx: 4, fill: T['--c-surface-2'], stroke: T['--c-border'], 'stroke-width': 0.9
      }, frame);
      /* 岛礁：抽稀后的形状只有零点几个像素宽，直接画圆点才看得见 */
      ins.dots.forEach(function (flat) {
        var cx = 0, cy = 0, n2 = flat.length / 2;
        for (var i = 0; i < flat.length; i += 2) { cx += flat[i]; cy += flat[i + 1]; }
        el('circle', {
          cx: (ix + (cx / n2) * is).toFixed(2), cy: (iy + (cy / n2) * is).toFixed(2),
          r: iw > 60 ? 1.4 : 1.1, fill: T['--c-text-soft']
        }, frame);
      });
      /* 十段线：原几何是细长条，抽稀后常退化成「A-B-A」三个点，
         所以取距离最远的一对点连成短划线，才像地图上的虚线 */
      ins.lines.forEach(function (flat) {
        var n2 = flat.length / 2, bi = 0, bj = 1, best = -1;
        for (var i = 0; i < n2; i++) {
          for (var j = i + 1; j < n2; j++) {
            var dx = flat[i * 2] - flat[j * 2], dy = flat[i * 2 + 1] - flat[j * 2 + 1];
            var d = dx * dx + dy * dy;
            if (d > best) { best = d; bi = i; bj = j; }
          }
        }
        if (best <= 0.05) return;                       /* 退化成一个点，跳过 */
        el('line', {
          x1: (ix + flat[bi * 2] * is).toFixed(2), y1: (iy + flat[bi * 2 + 1] * is).toFixed(2),
          x2: (ix + flat[bj * 2] * is).toFixed(2), y2: (iy + flat[bj * 2 + 1] * is).toFixed(2),
          stroke: T['--c-accent'], 'stroke-width': 1.5, 'stroke-linecap': 'round'
        }, frame);
      });
      el('text', {
        x: (ix + 4).toFixed(1), y: (iy + ih - 4).toFixed(1),
        fill: T['--c-muted'], 'font-size': narrow ? 8 : 9, 'font-weight': 700
      }, frame).textContent = cfg.insetLabel || '';
    }

    /* —— 图例：五档色带 + 低/高 —— */
    if (!narrow) {
      var lx = pad.l + 2, ly = H - pad.b - 14, sw = 18, sh = 9;
      ALPHA.forEach(function (a, i) {
        el('rect', {
          x: (lx + i * sw).toFixed(1), y: ly, width: sw - 1.5, height: sh, rx: 2,
          fill: alpha(T['--c-primary'], a), stroke: T['--c-border'], 'stroke-width': 0.6
        }, svg);
      });
      el('text', { x: lx, y: ly - 4, fill: T['--c-muted'], 'font-size': 10, 'font-weight': 700 }, svg)
        .textContent = cfg.legendLabel || '';
      el('text', { x: lx + ALPHA.length * sw + 4, y: ly + 8, fill: T['--c-muted'], 'font-size': 10 }, svg)
        .textContent = cfg.legendHigh || '';
    }

    return ctx;
  }

  /* =========================================================
   * 导出
   * ========================================================= */
  /* =========================================================
   * ⑪ 热力矩阵（行 = 行业，列 = 指标）
   * ---------------------------------------------------------
   * 每一列单独做 min→max 归一化：同一行里的 5 个数不同量纲
   * （渗透率 %、市场规模亿元、人才指数 /100），只有列内比较才有意义。
   * 所以颜色深浅 = 「在这一列里排第几」，原始数值照实写在格子里，
   * 数据表与 CSV 导出的也是原始值 —— 图不给数字打折。
   * ========================================================= */
  function heatmap(container, cfg) {
    var rows = cfg.rows, metrics = cfg.metrics;
    var W = canvasW(container, 900, 300);
    var narrow = W < 620;
    var labelW = narrow ? Math.max(74, Math.round(W * 0.26)) : 118;
    var headH = narrow ? 44 : 38;
    var rowH = narrow ? 21 : 25;
    var cellW = (W - labelW - (narrow ? 6 : 10)) / metrics.length;
    var H = headH + rows.length * rowH + (narrow ? 26 : 22);
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;

    /* 每列的取值上下界：归一化 + 表头注脚都用它 */
    var bounds = metrics.map(function (m) {
      var vs = rows.map(function (r) { return r[m.id]; });
      return { min: Math.min.apply(null, vs), max: Math.max.apply(null, vs) };
    });
    function norm(v, b) { return b.max === b.min ? 0.5 : (v - b.min) / (b.max - b.min); }

    /* 弱口径列（后两列是间接代理指标，见 app.js 的 WEAK_METRICS）：
       整列铺一层很浅的底 + 与强口径列之间打一条虚线分隔 + 列头文字后面挂一个小尾巴 ——
       三重提示，读者就不会把两把不同的尺子并排着比深浅。
       底色用 rx:0 的矩形，免得被冒烟测试数成「格子」（它按 rx=4 && 高>10 数 75 个格子）。 */
    var weakIdx = [];
    metrics.forEach(function (m, j) { if (m.weak) weakIdx.push(j); });
    if (weakIdx.length) {
      var bodyTop = headH - 4;
      var bodyH = rows.length * rowH + 4;
      weakIdx.forEach(function (j) {
        el('rect', {
          x: (labelW + j * cellW).toFixed(1), y: bodyTop.toFixed(1),
          width: cellW.toFixed(1), height: bodyH.toFixed(1),
          rx: 0, fill: alpha(T['--c-warn'], 0.07)
        }, svg);
      });
      el('line', {
        x1: (labelW + weakIdx[0] * cellW).toFixed(1), x2: (labelW + weakIdx[0] * cellW).toFixed(1),
        y1: 2, y2: (bodyTop + bodyH).toFixed(1),
        stroke: T['--c-warn'], 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0.55
      }, svg);
    }

    /* 表头：指标名（窄屏用短名 + 折行）+ 这一列的范围 */
    metrics.forEach(function (m, j) {
      var cx = labelW + j * cellW + cellW / 2;
      var fs = narrow ? 10 : 11.5;
      var label = (narrow && m.short ? m.short : String(m.label)) + (m.weak && m.weakLabel ? ' · ' + m.weakLabel : '');
      wrapText(svg, label, cx, 14, cellW - 4, fs + 1.5, 2, T['--c-text-soft'], fs, 'middle');
      /* 窄屏列宽只有 40 多像素，范围只写「最小–最大」，单位留给数据表 */
      el('text', {
        x: cx, y: headH - 5, 'text-anchor': 'middle', fill: T['--c-muted'], 'font-size': narrow ? 8.5 : 9.5
      }, svg).textContent = fmt(bounds[j].min, m.decimals) + '–' + fmt(bounds[j].max, m.decimals) +
        (narrow ? '' : m.unit);
    });

    /* 行 + 格子 */
    var cells = [];
    rows.forEach(function (r, i) {
      var y = headH + i * rowH;
      /* 隔行浅底：25 行 × 5 列不放隔行底纹很容易看串行 */
      if (i % 2) {
        el('rect', { x: 0, y: y, width: W, height: rowH, fill: alpha(T['--c-text'], 0.035) }, svg);
      }
      el('text', {
        x: labelW - 9, y: y + rowH / 2 + 4, 'text-anchor': 'end',
        fill: T['--c-text'], 'font-size': narrow ? 11 : 12.5, 'font-weight': 700
      }, svg).textContent = String(r.name);

      metrics.forEach(function (m, j) {
        var t = norm(r[m.id], bounds[j]);
        var cx = labelW + j * cellW + cellW / 2;
        var rect = el('rect', {
          x: (labelW + j * cellW + 1).toFixed(1), y: y + 1, width: (cellW - 2).toFixed(1), height: rowH - 3,
          rx: 4, fill: alpha(T['--c-primary'], 0.07 + 0.78 * t), opacity: 0, style: 'cursor:pointer'
        }, svg);
        var txt = el('text', {
          x: cx, y: y + rowH / 2 + 4, 'text-anchor': 'middle',
          fill: t > 0.55 ? T['--c-on-primary'] : T['--c-text'],
          'font-size': narrow ? 10 : 11, 'font-weight': 800, opacity: 0, 'pointer-events': 'none'
        }, svg);
        txt.textContent = fmt(r[m.id], m.decimals);
        cells.push({ rect: rect, txt: txt });
        var colRank = rows.map(function (x) { return x[m.id]; })
          .sort(function (a, b) { return b - a; }).indexOf(r[m.id]) + 1;
        rect.addEventListener('mousemove', function (e) {
          rect.setAttribute('stroke', T['--c-accent']);
          rect.setAttribute('stroke-width', '1.6');
          var box = container.getBoundingClientRect();
          showTip(ctx, '<b>' + r.name + ' · ' + m.label + '</b>' +
            '<span class="viz-tip-row">' + cfg.valueLabel + '<b>' + fmt(r[m.id], m.decimals) + m.unit + '</b></span>' +
            '<span class="viz-tip-row">' + cfg.rankLabel + '<b>' + colRank + ' / ' + rows.length + '</b></span>',
            e.clientX - box.left, e.clientY - box.top);
        });
        rect.addEventListener('mouseleave', function () {
          rect.removeAttribute('stroke');
          rect.removeAttribute('stroke-width');
          hideTip(ctx);
        });
      });
    });
    animate(560, function (pr) {
      cells.forEach(function (c, i) {
        var p = Math.max(0, Math.min(1, (pr - i * 0.004) * 1.6)).toFixed(2);
        c.rect.setAttribute('opacity', p);
        c.txt.setAttribute('opacity', p);
      });
    });

    /* 色带图例：说明「深 = 在这一列里靠前」 */
    var lx = pad3(), ly = H - 10;
    function pad3() { return labelW - 60 > 4 ? labelW - 60 : 4; }
    var sw = 16;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t, i) {
      el('rect', {
        x: (lx + i * sw).toFixed(1), y: ly - 8, width: sw - 1.5, height: 8, rx: 2,
        fill: alpha(T['--c-primary'], 0.07 + 0.78 * t), stroke: T['--c-border'], 'stroke-width': 0.6
      }, svg);
    });
    el('text', {
      x: lx + 5 * sw + 4, y: ly, fill: T['--c-muted'], 'font-size': narrow ? 9 : 10
    }, svg).textContent = cfg.legendLabel || '';

    ctx.rows = rows.length;
    ctx.metrics = metrics.length;
    return ctx;
  }

  /* =========================================================
   * ⑫ 小倍数图（small multiples）
   * ---------------------------------------------------------
   * 三次产业各占一格，三格共用同一套纵轴刻度 —— 这是小倍数图的全部意义：
   * 「谁涨得更快」可以直接比高度，不需要读者换算。
   * 每格结构完全一致（同样的网格、同样的刻度、同样的两条线），
   * 宽屏三列并排，窄屏竖着摞起来。
   * ========================================================= */
  function smallMultiples(container, cfg) {
    var W = canvasW(container, 900, 300);
    var panels = cfg.panels, n = panels.length;
    var wide = W >= 660;
    var gap = wide ? 14 : 10;
    var headH = 24;
    var footH = wide ? 34 : 30;
    var panelW = wide ? (W - gap * (n - 1)) / n : W;
    var chartH = wide ? Math.max(120, Math.min(215, panelW * 0.76)) : Math.max(96, Math.min(160, W * 0.36));
    /* 宽屏：三格横向并排（一行）；窄屏：竖着摞（一列） */
    var H = wide ? (headH + chartH + footH + 4)
      : (n * (headH + chartH) + (n - 1) * gap + footH + 4);
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var pad = { t: 20, r: 12, b: 18, l: wide ? 32 : 30 };
    var pw = panelW - pad.l - pad.r, ph = chartH - pad.t - pad.b;
    var years = cfg.years;
    var m = years.length;
    var yMax = cfg.yMax || 1;
    var lastIdx = m - 1;                     /* 最后一个点是预测值 */
    var X = function (i) { return pad.l + (m === 1 ? pw / 2 : (i * pw) / (m - 1)); };
    var Y = function (v) { return pad.t + ph * (1 - Math.min(1, v / yMax)); };
    var ticks = niceTicks(0, yMax, wide ? 4 : 3);
    var seriesLines = [];
    var focusRecs = [];                      /* 跨图联动的高亮列（每格一条带子 + 每条线一个圆点） */

    panels.forEach(function (p, pi) {
      /* 并排时往右挪，摞起来时往下挪 —— 两种排版共用同一套格内坐标 */
      var top = wide ? 0 : pi * (headH + chartH + gap);
      var left = wide ? pi * (panelW + gap) : 0;
      var g = el('g', { transform: 'translate(' + left.toFixed(1) + ',' + top.toFixed(1) + ')' }, svg);

      /* 格子底 + 网格（三格完全一致，眼睛才能横向比） */
      el('rect', {
        x: 0, y: 0, width: panelW.toFixed(1), height: chartH.toFixed(1), rx: 8,
        fill: alpha(T['--c-text'], 0.03)
      }, g);
      ticks.forEach(function (v) {
        el('line', {
          x1: pad.l, y1: Y(v).toFixed(1), x2: (pad.l + pw).toFixed(1), y2: Y(v).toFixed(1),
          stroke: T['--c-border'], 'stroke-width': 1, 'stroke-dasharray': v === 0 ? '' : '3 5'
        }, g);
        el('text', {
          x: pad.l - 7, y: (Y(v) + 3.5).toFixed(1), 'text-anchor': 'end',
          fill: T['--c-muted'], 'font-size': wide ? 9.5 : 9
        }, g).textContent = fmt(v, 0) + (cfg.unit || '');
      });

      /* 面板标题 + 产业色标 + 末值
         线条用统一的「渗透率 / 增益」配色（三格才可比），产业身份由标题前的色点表示 */
      var last = p.series[0].values[lastIdx];
      if (p.color) el('circle', { cx: 6, cy: 9, r: 3.2, fill: p.color }, g);
      el('text', {
        x: p.color ? 14 : 2, y: 13, fill: T['--c-text'], 'font-size': wide ? 12 : 11.5, 'font-weight': 800
      }, g).textContent = p.label;
      el('text', {
        x: (panelW - 2).toFixed(1), y: 13, 'text-anchor': 'end', fill: p.series[0].color,
        'font-size': wide ? 12.5 : 12, 'font-weight': 800
      }, g).textContent = fmt(last, p.series[0].decimals || 0) + (cfg.unit || '');

      /* 年份刻度：并排时每格都标，摞起来时只标最下面一块（省地方也更干净） */
      if (wide || pi === n - 1) {
        years.forEach(function (yr, i) {
          el('text', {
            x: X(i).toFixed(1), y: chartH + 13, 'text-anchor': 'middle',
            fill: i === lastIdx ? T['--c-accent-ink'] : T['--c-muted'],
            'font-size': wide ? 9 : 10, 'font-weight': 700
          }, g).textContent = String(yr);
        });
      }

      /* 跨图联动的接收端：把「当前年份」那一列点亮（年份由 ③ 的播放器 / 分享链接驱动）。
         高亮带先画在方格最底层，线压在上面 —— 带子只当作「一列」的背景色。
         只用 rect / line / circle，不加 <text>、也不新增带 transform 的 <g>：
         smoke.mjs 数的是「每格 7 个年份标签 / 总共 3 个带 transform 的格」，
         多一个元素就会把那两条断言弄红。 */
      var bandW = m > 1 ? pw / (m - 1) : pw;
      var band = el('rect', {
        x: 0, y: (pad.t - 6).toFixed(1), width: bandW.toFixed(1), height: (ph + 12).toFixed(1),
        rx: 4, 'class': 'viz-focus-band', fill: alpha(T['--c-primary'], 0.14),
        opacity: 0, 'pointer-events': 'none'
      }, g);
      var mark = el('line', {
        x1: 0, x2: 0, y1: pad.t, y2: pad.t + ph, stroke: T['--c-primary'],
        'class': 'viz-focus-mark', 'stroke-width': 1.2, opacity: 0, 'pointer-events': 'none'
      }, g);

      /* 两条线：实线 = 到 2024，虚线 = 2025 预测段 */
      p.series.forEach(function (s) {
        var pts = s.values.map(function (v, i) { return [X(i), Y(v)]; });
        function segPath(from, to) {
          var d = 'M' + pts[from][0].toFixed(1) + ' ' + pts[from][1].toFixed(1);
          for (var i = from + 1; i <= to; i++) {
            var a = pts[i - 1], b = pts[i];
            var c1 = a[0] + (b[0] - a[0]) / 3, c2 = a[0] + (2 * (b[0] - a[0])) / 3;
            d += 'C' + c1.toFixed(1) + ' ' + a[1].toFixed(1) + ' ' + c2.toFixed(1) + ' ' + b[1].toFixed(1) +
              ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
          }
          return d;
        }
        if (s.area) {
          var area = el('path', {
            d: segPath(0, lastIdx - 1) + 'L' + pts[lastIdx - 1][0].toFixed(1) + ' ' + Y(0).toFixed(1) +
              'L' + pts[0][0].toFixed(1) + ' ' + Y(0).toFixed(1) + 'Z',
            fill: alpha(s.color, 0.13), stroke: 'none', opacity: 0
          }, g);
          seriesLines.push({ node: area });
        }
        var solid = el('path', {
          d: segPath(0, lastIdx - 1), fill: 'none', stroke: s.color,
          'stroke-width': s.width || 2.4, 'stroke-linecap': 'round', opacity: 0
        }, g);
        var dashed = el('path', {
          d: segPath(lastIdx - 1, lastIdx), fill: 'none', stroke: s.color,
          'stroke-width': s.width || 2.4, 'stroke-dasharray': '6 5', 'stroke-linecap': 'round', opacity: 0
        }, g);
        var dot = el('circle', {
          cx: pts[lastIdx][0].toFixed(1), cy: pts[lastIdx][1].toFixed(1), r: 0,
          fill: s.color, stroke: T['--c-surface'], 'stroke-width': 1.6
        }, g);
        seriesLines.push({ node: solid }, { node: dashed }, { node: dot, dot: true });
      });

      /* 悬停：一格一格地读数，十字线只在本格内移动 */
      var cross = el('line', {
        y1: pad.t, y2: pad.t + ph, stroke: T['--c-accent'], 'stroke-width': 1.3,
        'stroke-dasharray': '3 4', opacity: 0, 'pointer-events': 'none'
      }, g);
      var hot = el('g', { 'pointer-events': 'none' }, g);
      var hit = el('rect', {
        x: pad.l, y: pad.t, width: pw, height: ph, fill: 'transparent', style: 'cursor:crosshair'
      }, g);

      /* 联动高亮的「圆点」放在最后画：要压在折线上面才看得见 */
      focusRecs.push({
        band: band, mark: mark, bandW: bandW,
        dots: p.series.map(function (s) {
          return {
            s: s,
            node: el('circle', {
              cx: 0, cy: 0, r: 4, fill: s.color, stroke: T['--c-surface'],
              'class': 'viz-focus-dot', 'stroke-width': 1.6, opacity: 0, 'pointer-events': 'none'
            }, g)
          };
        })
      });

      hit.addEventListener('mousemove', function (e) {
        var box = container.getBoundingClientRect();
        /* 容器的坐标系 = SVG 坐标系（viewBox 与屏幕 1:1），并排时再减去前面几格的宽度 */
        var lx = e.clientX - box.left - (wide ? (panelW + gap) * pi : 0);
        var idx = Math.max(0, Math.min(lastIdx, Math.round(((lx - pad.l) / pw) * (m - 1))));
        clear(hot);
        cross.setAttribute('x1', X(idx).toFixed(1));
        cross.setAttribute('x2', X(idx).toFixed(1));
        cross.setAttribute('opacity', 0.8);
        p.series.forEach(function (s) {
          el('circle', {
            cx: X(idx).toFixed(1), cy: Y(s.values[idx]).toFixed(1), r: 4.5,
            fill: s.color, stroke: T['--c-surface'], 'stroke-width': 1.6
          }, hot);
        });
        var rows = '<b>' + p.label + ' · ' + years[idx] + (idx === lastIdx ? 'E' : '') + '</b>';
        p.series.forEach(function (s) {
          rows += '<span class="viz-tip-row"><i style="background:' + s.color + '"></i>' + s.name +
            '<b>' + fmt(s.values[idx], s.decimals || 0) + (cfg.unit || '') + '</b></span>';
        });
        showTip(ctx, rows, e.clientX - box.left, e.clientY - box.top);
      });
      hit.addEventListener('mouseleave', function () {
        cross.setAttribute('opacity', 0);
        clear(hot);
        hideTip(ctx);
      });
    });

    animate(760, function (pr) {
      seriesLines.forEach(function (rec) {
        rec.node.setAttribute('opacity', pr.toFixed(2));
        if (rec.dot) rec.node.setAttribute('r', (3.2 * pr).toFixed(2));
      });
    });

    /* 图例：两条线（渗透率 / 效率增益）三格共用 */
    legend(container, panels[0].series.map(function (s) {
      return { label: s.name, color: s.color, shape: s.dash ? 'dash' : 'line' };
    }));

    ctx.panels = n;
    ctx.years = years.slice();

    /* 联动入口：外部（年份播放器 / 分享链接）只调这一个函数，不必知道格内坐标。
       index 是年份在 cfg.years 里的下标，越界会夹住。 */
    ctx.focusYear = function (index) {
      var idx = Math.max(0, Math.min(lastIdx, Math.round(Number(index) || 0)));
      focusRecs.forEach(function (rec) {
        rec.band.setAttribute('x', (X(idx) - rec.bandW / 2).toFixed(1));
        rec.band.setAttribute('opacity', '1');
        rec.mark.setAttribute('x1', X(idx).toFixed(1));
        rec.mark.setAttribute('x2', X(idx).toFixed(1));
        rec.mark.setAttribute('opacity', '0.7');
        rec.dots.forEach(function (d) {
          d.node.setAttribute('cx', X(idx).toFixed(1));
          d.node.setAttribute('cy', Y(d.s.values[idx]).toFixed(1));
          d.node.setAttribute('opacity', '1');
        });
      });
      return idx;
    };
    /* 首帧就按 cfg.focusYear（= STATE.year）亮起来：链接里的年份一打开就是对的 */
    if (cfg.focusYear != null) ctx.focusYear(cfg.focusYear);
    return ctx;
  }

  /* =========================================================
   * ⑬ 龙卷风图（单因素敏感性）
   * ---------------------------------------------------------
   * 每根条 = 「只让这一个旋钮从最小走到最大」时指数能覆盖的区间，
   * 条越长 → 这个因素越关键。所有条共用一个「当前设定」的竖直基准线，
   * 条从中轴线向两侧生长：一眼看出谁把结果推得最远。
   * ========================================================= */
  function tornado(container, cfg) {
    var rows = cfg.rows;
    var W = canvasW(container, 900, 300);
    var narrow = W < 560;
    var labelW = narrow ? Math.max(96, Math.round(W * 0.32)) : 132;
    var rowH = narrow ? 34 : 40;
    var headH = narrow ? 42 : 30;
    var axisH = narrow ? 30 : 32;
    var H = headH + rows.length * rowH + axisH;
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var plotW = W - labelW - (narrow ? 14 : 26);
    var xMin = cfg.xMin, xMax = cfg.xMax;
    var X = function (v) { return labelW + plotW * ((v - xMin) / (xMax - xMin)); };

    /* 轴 + 刻度（先画轴，条形压在上面） */
    niceTicks(xMin, xMax, narrow ? 4 : 6).forEach(function (v) {
      var x = X(v).toFixed(1);
      el('line', {
        x1: x, y1: headH - 6, x2: x, y2: headH + rows.length * rowH, stroke: T['--c-border'],
        'stroke-width': 1, 'stroke-dasharray': '3 5'
      }, svg);
      el('text', {
        x: x, y: H - 8, 'text-anchor': 'middle', fill: T['--c-muted'], 'font-size': narrow ? 9.5 : 11
      }, svg).textContent = fmt(v, cfg.decimals || 0);
    });
    el('text', {
      x: labelW, y: 14, fill: T['--c-text-soft'], 'font-size': narrow ? 10 : 11.5, 'font-weight': 700
    }, svg).textContent = cfg.xLabel;
    el('text', {
      x: labelW + plotW, y: 14, 'text-anchor': 'end', fill: T['--c-muted'], 'font-size': narrow ? 9.5 : 10.5
    }, svg).textContent = cfg.rangeLabel;

    /* 「当前设定」基准线：所有条都从这条线长出去 */
    var cx = X(cfg.current).toFixed(1);
    el('line', {
      x1: cx, y1: headH - 6, x2: cx, y2: headH + rows.length * rowH,
      stroke: T['--c-accent'], 'stroke-width': 1.8, 'stroke-dasharray': '5 4', opacity: 0.9
    }, svg);
    el('text', {
      x: cx, y: narrow ? 30 : headH - 10, 'text-anchor': 'middle', fill: T['--c-accent-ink'],
      'font-size': narrow ? 9.5 : 10.5, 'font-weight': 800
    }, svg).textContent = cfg.currentLabel + ' ' + fmt(cfg.current, cfg.decimals || 0);

    /* 条形：从基准线向 low / high 两端生长 */
    var bars = [];
    rows.forEach(function (r, i) {
      var top = headH + i * rowH + (narrow ? 5 : 6);
      var h = narrow ? 13 : 15;
      el('text', {
        x: labelW - 10, y: top + h + 1, 'text-anchor': 'end', fill: T['--c-text'],
        'font-size': narrow ? 11 : 12.5, 'font-weight': 800
      }, svg).textContent = r.label;
      if (narrow && r.knob != null) {
        el('text', {
          x: labelW - 10, y: top + h + 12, 'text-anchor': 'end', fill: T['--c-muted'], 'font-size': 9
        }, svg).textContent = cfg.knobLabel + ' ' + r.knob + '%';
      }
      var bar = el('rect', {
        x: cx, y: top, width: 0, height: h, rx: h / 2,
        fill: alpha(r.color, 0.5), stroke: r.color, 'stroke-width': 1.2, style: 'cursor:pointer'
      }, svg);
      el('rect', {
        x: (X(r.low) - 1.2).toFixed(1), y: (top - 3).toFixed(1), width: 2.4, height: h + 6,
        rx: 1.2, fill: r.color
      }, svg);
      el('rect', {
        x: (X(r.high) - 1.2).toFixed(1), y: (top - 3).toFixed(1), width: 2.4, height: h + 6,
        rx: 1.2, fill: r.color
      }, svg);
      if (!narrow) {
        el('text', {
          x: (X(r.low) - 6).toFixed(1), y: top + h - 3, 'text-anchor': 'end',
          fill: T['--c-muted'], 'font-size': 10, 'font-weight': 700
        }, svg).textContent = fmt(r.low, cfg.decimals || 0);
        el('text', {
          x: (X(r.high) + 6).toFixed(1), y: top + h - 3,
          fill: T['--c-muted'], 'font-size': 10, 'font-weight': 700
        }, svg).textContent = fmt(r.high, cfg.decimals || 0);
      }
      bars.push({ node: bar, low: X(r.low), high: X(r.high) });
      bar.addEventListener('mousemove', function (e) {
        bar.setAttribute('fill', alpha(r.color, 0.78));
        var box = container.getBoundingClientRect();
        showTip(ctx, '<b>' + r.label + '</b>' +
          '<span class="viz-tip-row">' + cfg.lowLabel + '<b>' + fmt(r.low, cfg.decimals || 0) + cfg.unit + '</b></span>' +
          '<span class="viz-tip-row">' + cfg.highLabel + '<b>' + fmt(r.high, cfg.decimals || 0) + cfg.unit + '</b></span>' +
          '<span class="viz-tip-row">' + cfg.swingLabel + '<b>' + fmt(r.high - r.low, cfg.decimals || 0) + cfg.unit + '</b></span>',
          e.clientX - box.left, e.clientY - box.top);
      });
      bar.addEventListener('mouseleave', function () {
        bar.setAttribute('fill', alpha(r.color, 0.5));
        hideTip(ctx);
      });
    });
    animate(720, function (pr) {
      var base = X(cfg.current);
      bars.forEach(function (rec) {
        var left = base + (rec.low - base) * pr;
        var right = base + (rec.high - base) * pr;
        rec.node.setAttribute('x', Math.min(left, right).toFixed(1));
        rec.node.setAttribute('width', Math.abs(right - left).toFixed(1));
      });
    });

    ctx.rows = rows.length;
    return ctx;
  }

  /* =========================================================
   * ⑭ 蒙特卡洛分布图（直方图 + P5 / 中位数 / P95）
   * ---------------------------------------------------------
   * 把 N 次抽样的结果装进直方图，再用三条竖线标出区间 ——
   * 它回答的不是「结果是多少」，而是「结果有多不确定」：
   * 柱子的胖瘦 = 风险，中位数和当前设定差多远 = 现在的参数离典型情形有多偏。
   * ========================================================= */
  function monteCarlo(container, cfg) {
    var bins = cfg.bins;
    var W = canvasW(container, 900, 300);
    var narrow = W < 560;
    var H = Math.round(W * (narrow ? 0.46 : 0.4));
    var ctx = stage(container, [W, H], 900);
    var T = readTokens();
    var svg = ctx.svg;
    var pad = narrow ? { t: 34, r: 10, b: 34, l: 34 } : { t: 34, r: 18, b: 40, l: 44 };
    var pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    var xMin = cfg.xMin, xMax = cfg.xMax;
    var maxCount = Math.max.apply(null, bins.map(function (b) { return b.count; }));
    var X = function (v) { return pad.l + pw * ((v - xMin) / (xMax - xMin)); };
    var Y = function (c) { return pad.t + ph * (1 - c / maxCount); };

    /* Y 轴：抽样频次 */
    niceTicks(0, maxCount, 3).forEach(function (v) {
      el('line', {
        x1: pad.l, y1: Y(v).toFixed(1), x2: pad.l + pw, y2: Y(v).toFixed(1),
        stroke: T['--c-border'], 'stroke-width': 1, 'stroke-dasharray': v === 0 ? '' : '3 5'
      }, svg);
      el('text', {
        x: pad.l - 8, y: (Y(v) + 3.5).toFixed(1), 'text-anchor': 'end', fill: T['--c-muted'], 'font-size': narrow ? 9.5 : 11
      }, svg).textContent = fmt(v, 0);
    });
    /* 纵轴标题：宽屏竖排在轴左上方，窄屏挪到顶行最左（否则会被左边界裁掉） */
    el('text', {
      x: narrow ? pad.l : pad.l - 8, y: narrow ? pad.t - 24 : pad.t - 10,
      'text-anchor': narrow ? 'start' : 'end', fill: T['--c-muted'], 'font-size': narrow ? 9.5 : 10.5
    }, svg).textContent = cfg.countLabel;

    /* X 轴：指数刻度 */
    niceTicks(xMin, xMax, narrow ? 4 : 6).forEach(function (v) {
      el('text', {
        x: X(v).toFixed(1), y: pad.t + ph + 18, 'text-anchor': 'middle', fill: T['--c-muted'], 'font-size': narrow ? 9.5 : 11
      }, svg).textContent = fmt(v, 0);
    });
    el('text', {
      x: pad.l + pw / 2, y: H - 6, 'text-anchor': 'middle', fill: T['--c-text-soft'],
      'font-size': narrow ? 10.5 : 12, 'font-weight': 700
    }, svg).textContent = cfg.xLabel;

    /* 直方图：柱子从底部长上来 */
    var bw = pw / bins.length;
    var bars = [];
    bins.forEach(function (b, i) {
      var rect = el('rect', {
        x: (X(b.x0) + 0.6).toFixed(1), y: Y(0).toFixed(1), width: (bw - 1.2).toFixed(1), height: 0,
        rx: Math.min(3, bw / 4), fill: alpha(T['--c-primary'], 0.5), stroke: 'none', style: 'cursor:pointer'
      }, svg);
      bars.push({ node: rect, count: b.count, y: Y(b.count) });
      rect.addEventListener('mousemove', function (e) {
        rect.setAttribute('fill', alpha(T['--c-primary'], 0.85));
        var box = container.getBoundingClientRect();
        showTip(ctx, '<b>' + fmt(b.x0, 0) + ' – ' + fmt(b.x1, 0) + cfg.unit + '</b>' +
          '<span class="viz-tip-row">' + cfg.countLabel + '<b>' + b.count + '</b></span>' +
          '<span class="viz-tip-row">' + cfg.shareLabel + '<b>' +
          fmt((b.count / cfg.draws) * 100, 1) + '%</b></span>',
          e.clientX - box.left, e.clientY - box.top);
      });
      rect.addEventListener('mouseleave', function () {
        rect.setAttribute('fill', alpha(T['--c-primary'], 0.5));
        hideTip(ctx);
      });
    });
    animate(700, function (pr) {
      bars.forEach(function (rec) {
        var y = Y(0) + (rec.y - Y(0)) * pr;
        rec.node.setAttribute('y', y.toFixed(1));
        rec.node.setAttribute('height', Math.max(0, Y(0) - y).toFixed(1));
      });
    });

    /* P5 / 中位数 / P95 三条竖线 + 顶部标签 */
    [
      { v: cfg.p5, label: cfg.p5Label, color: T['--c-info'] },
      { v: cfg.p50, label: cfg.p50Label, color: T['--c-accent'], strong: true },
      { v: cfg.p95, label: cfg.p95Label, color: T['--c-info'] }
    ].forEach(function (m) {
      el('line', {
        x1: X(m.v).toFixed(1), y1: pad.t - 6, x2: X(m.v).toFixed(1), y2: pad.t + ph,
        stroke: m.color, 'stroke-width': m.strong ? 1.8 : 1.3,
        'stroke-dasharray': m.strong ? '5 4' : '3 4', opacity: 0.9
      }, svg);
      el('text', {
        x: X(m.v).toFixed(1), y: pad.t - 12, 'text-anchor': 'middle', fill: m.color,
        'font-size': narrow ? 9.5 : 10.5, 'font-weight': 800
      }, svg).textContent = m.label + ' ' + fmt(m.v, cfg.decimals || 0);
    });

    /* 当前设定：轴上钉一个小三角 + 图内上方一条说明
       （文字不能放在轴下方，会和横轴标题压在一起；窄屏只留数字，避免和 P95 标签撞车） */
    var cx = X(cfg.current);
    el('path', {
      d: 'M' + cx.toFixed(1) + ' ' + (pad.t + ph + 2) + 'l6 9h-12z', fill: T['--c-text']
    }, svg);
    var leftFree = !narrow && X(cfg.p5) > pad.l + 116;
    el('text', {
      x: (narrow || !leftFree ? pad.l + pw : pad.l).toFixed(1), y: narrow ? pad.t - 24 : pad.t - 16,
      'text-anchor': (narrow || !leftFree) ? 'end' : 'start', fill: T['--c-text'],
      'font-size': narrow ? 9.5 : 10.5, 'font-weight': 800
    }, svg).textContent = '▲ ' + (narrow ? '' : cfg.currentLabel + ' ') + fmt(cfg.current, cfg.decimals || 0);

    ctx.bins = bins.length;
    ctx.maxCount = maxCount;
    return ctx;
  }

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
    /* 第二次作业新增的四种图型：地图 / 热力矩阵 / 小倍数 / 敏感性 */
    choropleth: choropleth,
    heatmap: heatmap,
    smallMultiples: smallMultiples,
    tornado: tornado,
    monteCarlo: monteCarlo,
    niceTicks: niceTicks,
    alpha: alpha,
    fmt: fmt,
    /* 导出：PNG / SVG / CSV —— 见文件开头的「导出」小节 */
    exportPNG: exportPNG,
    exportSVG: exportSVG,
    exportCSV: exportCSV,
    /* 颜色键 → 当前主题下的真实色值 */
    colorOf: function (key, fallback) {
      var cs = getComputedStyle(document.documentElement).getPropertyValue(key);
      return (cs && cs.trim()) || fallback || '#888';
    }
  };
}());
