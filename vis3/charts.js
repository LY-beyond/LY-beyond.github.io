/* =========================================================
 * charts.js —— 自绘 SVG 图表(vis3)
 * ---------------------------------------------------------
 * 零依赖:直接拼 SVG 字符串,颜色全部运行时读 tokens.css 的
 * CSS 变量,主题切换后由 app.js 重绘即可换肤。
 * 支持:histogram / bar / line / scatter / box / corr(相关系数热力)
 * 全部图表可交互:悬停图元即高亮(同系列点亮、其余淡出)并弹出自绘
 * 提示框;折线图额外提供十字准线 + 多系列读数。不引任何第三方库。
 * ========================================================= */
(function () {
  'use strict';

  var W = 720, H = 448;
  var M = { top: 28, right: 24, bottom: 92, left: 64 };

  function palette() {
    var cs = getComputedStyle(document.documentElement);
    function g(name, fallback) {
      var v = cs.getPropertyValue(name).trim();
      return v || fallback;
    }
    return {
      text: g('--c-text-soft', '#4a5763'),
      muted: g('--c-muted', '#626f7b'),
      line: g('--c-border', '#dde6f4'),
      surface: g('--c-surface', '#ffffff'),
      base: g('--s-base', '#96b0d8'),
      baseAlt: g('--s-base-alt', '#a4a8d5'),
      baseWarm: g('--s-base-warm', '#8f9599'),
      accent: g('--c-accent', '#ea580c'),
      danger: g('--c-danger', '#dc2626'),
      primary: g('--c-primary', '#1d4ed8'),
      series: [g('--d1', '#0ea5e9'), g('--d2', '#14b8a6'), g('--d3', '#f59e0b'),
               g('--d4', '#ef4444'), g('--d5', '#8b5cf6'), g('--d6', '#ec4899')]
    };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 悬停提示文本:统一挂在 data-tip 上,由 bind() 渲染成自绘 tooltip */
  function tip(text) { return ' data-tip="' + esc(text) + '"'; }

  function fmt(v) {
    if (v == null || isNaN(v)) return '';
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1) + 'k';
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 100) / 100);
  }

  /* 均匀取 ~n 个「好看」刻度 */
  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, step0 = span / (n || 5);
    var mag = Math.pow(10, Math.floor(Math.log10(step0)));
    var step = mag;
    [1, 2, 2.5, 5, 10].forEach(function (m) {
      if (step0 > mag * m * 0.999) step = mag * m;
    });
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1e10) / 1e10);
    return ticks;
  }

  function svgOpen() {
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" ' +
      'preserveAspectRatio="xMidYMid meet" role="img" font-family="inherit">';
  }

  function axes(P, xTicks, yTicks, opt) {
    opt = opt || {};
    var iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    var s = '';
    yTicks.forEach(function (t) {
      var y = M.top + ih - (t - opt.yMin) / (opt.yMax - opt.yMin) * ih;
      s += '<line x1="' + M.left + '" y1="' + y + '" x2="' + (W - M.right) + '" y2="' + y +
        '" stroke="' + P.line + '" stroke-width="1"/>';
      s += '<text x="' + (M.left - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="' +
        P.muted + '">' + esc(fmt(t)) + '</text>';
    });
    s += '<line x1="' + M.left + '" y1="' + (H - M.bottom) + '" x2="' + (W - M.right) +
      '" y2="' + (H - M.bottom) + '" stroke="' + P.muted + '" stroke-width="1"/>';
    xTicks.forEach(function (t) {
      s += '<text x="' + t.x + '" y="' + (H - M.bottom + 18) + '" text-anchor="middle" font-size="11" fill="' +
        P.muted + '"' + (t.rotate ? ' transform="rotate(-28 ' + t.x + ' ' + (H - M.bottom + 18) + ')"' : '') +
        '>' + esc(t.label) + '</text>';
    });
    if (opt.xLabel) s += '<text x="' + (M.left + iw / 2) + '" y="' + (H - M.bottom + 48) +
      '" text-anchor="middle" font-size="12" fill="' + P.text + '">' + esc(opt.xLabel) + '</text>';
    if (opt.yLabel) s += '<text x="14" y="' + (M.top + ih / 2) + '" text-anchor="middle" font-size="12" fill="' +
      P.text + '" transform="rotate(-90 14 ' + (M.top + ih / 2) + ')">' + esc(opt.yLabel) + '</text>';
    return s;
  }

  function chartTitle(P, title) {
    return title ? '<text x="' + (W / 2) + '" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="' +
      P.text + '">' + esc(title) + '</text>' : '';
  }

  /* ---------------- 图例(绘图区外底部,水平排列自动换行) ---------------- */
  function legend(P, names, colors) {
    if (!names || !names.length) return '';
    var s = '', x = M.left, y = H - 24;
    names.forEach(function (name, i) {
      var label = String(name).slice(0, 12);
      var w = 14 + label.length * 7 + 16;
      if (x + w > W - M.right && x > M.left) { x = M.left; y += 18; }
      var color = colors ? colors[i % colors.length] : P.series[i % P.series.length];
      s += '<g class="lg-item" data-ser="' + i + '">' +
        '<rect x="' + x + '" y="' + (y - 9) + '" width="10" height="10" rx="2" fill="' + color + '"/>' +
        '<text x="' + (x + 14) + '" y="' + y + '" font-size="11" fill="' + P.text + '">' + esc(label) + '</text></g>';
      x += w;
    });
    return s;
  }

  /* ---------------- 直方图 ---------------- */
  function hist(spec, P) {
    var vals = spec.values.filter(function (v) { return typeof v === 'number' && !isNaN(v); });
    if (!vals.length) return '';
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var bins = spec.bins || Math.min(20, Math.max(6, Math.round(Math.sqrt(vals.length))));
    var w = (mx - mn) / bins || 1;
    var counts = new Array(bins).fill(0);
    vals.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - mn) / w))]++; });
    var cmax = Math.max.apply(null, counts);
    var iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    var yTicks = niceTicks(0, cmax, 5);
    var s = svgOpen() + chartTitle(P, spec.title);
    s += axes(P, [], yTicks, { yMin: yTicks[0], yMax: yTicks[yTicks.length - 1], xLabel: spec.xLabel, yLabel: spec.yLabel });
    var bw = iw / bins;
    counts.forEach(function (c, i) {
      var h = (c - yTicks[0]) / (yTicks[yTicks.length - 1] - yTicks[0]) * ih;
      var x = M.left + i * bw, y = M.top + ih - h;
      s += '<rect class="mk" x="' + (x + 1) + '" y="' + y + '" width="' + Math.max(1, bw - 2) + '" height="' + h +
        '" rx="2" fill="' + P.base + '"' + tip(fmt(mn + i * w) + ' ~ ' + fmt(mn + (i + 1) * w) + ': ' + c) + '/>';
    });
    var xTicks = niceTicks(mn, mx, 6);
    xTicks.forEach(function (t) {
      var x = M.left + (t - mn) / (mx - mn || 1) * iw;
      s += '<text x="' + x + '" y="' + (H - M.bottom + 18) + '" text-anchor="middle" font-size="11" fill="' +
        P.muted + '">' + esc(fmt(t)) + '</text>';
    });
    return s + '</svg>';
  }

  /* ---------------- 条形图 ---------------- */
  function bar(spec, P) {
    var cats = spec.categories, vals = spec.values;
    var vmax = Math.max.apply(null, vals.concat([0]));
    var vmin = Math.min(0, Math.min.apply(null, vals));
    var iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    var yTicks = niceTicks(vmin, vmax, 5);
    var s = svgOpen() + chartTitle(P, spec.title);
    var rotate = cats.length > 8 || cats.some(function (c) { return String(c).length > 8; });
    s += axes(P, [], yTicks, { yMin: yTicks[0], yMax: yTicks[yTicks.length - 1], xLabel: spec.xLabel, yLabel: spec.yLabel });
    var bw = iw / cats.length;
    var zero = M.top + ih - (0 - yTicks[0]) / (yTicks[yTicks.length - 1] - yTicks[0]) * ih;
    cats.forEach(function (c, i) {
      var v = vals[i] || 0;
      var y = M.top + ih - (Math.max(v, 0) - yTicks[0]) / (yTicks[yTicks.length - 1] - yTicks[0]) * ih;
      var h = Math.abs(v) / (yTicks[yTicks.length - 1] - yTicks[0]) * ih;
      s += '<rect class="mk" x="' + (M.left + i * bw + bw * 0.15) + '" y="' + y + '" width="' + (bw * 0.7) +
        '" height="' + Math.max(0, h) + '" rx="3" fill="' + P.series[i % P.series.length] +
        '"' + tip(c + ': ' + fmt(v)) + '/>';
      s += '<text x="' + (M.left + i * bw + bw / 2) + '" y="' + (H - M.bottom + 18) +
        '" text-anchor="middle" font-size="11" fill="' + P.muted + '"' +
        (rotate ? ' transform="rotate(-28 ' + (M.left + i * bw + bw / 2) + ' ' + (H - M.bottom + 18) + ')"' : '') +
        '>' + esc(String(c).length > 14 ? String(c).slice(0, 13) + '…' : c) + '</text>';
    });
    s += '<line x1="' + M.left + '" y1="' + zero + '" x2="' + (W - M.right) + '" y2="' + zero +
      '" stroke="' + P.muted + '" stroke-width="1"/>';
    return s + '</svg>';
  }

  /* 折线图的坐标映射:绘图与十字准线共用 */
  function lineScales(spec) {
    var n = spec.x.length, all = [];
    spec.series.forEach(function (se) {
      se.values.forEach(function (v) { if (typeof v === 'number' && !isNaN(v)) all.push(v); });
    });
    if (!all.length) return null;
    var yTicks = niceTicks(Math.min.apply(null, all), Math.max.apply(null, all), 5);
    var iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    var yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
    return {
      n: n, iw: iw, ih: ih, yTicks: yTicks, yMin: yMin, yMax: yMax,
      px: function (i) { return M.left + (n === 1 ? iw / 2 : i / (n - 1) * iw); },
      py: function (v) { return M.top + ih - (v - yMin) / (yMax - yMin) * ih; }
    };
  }

  /* ---------------- 折线图 ---------------- */
  function line(spec, P) {
    var sc = lineScales(spec);
    if (!sc) return '';
    var n = sc.n, iw = sc.iw, ih = sc.ih, yTicks = sc.yTicks;
    var yMin = sc.yMin, yMax = sc.yMax, px = sc.px, py = sc.py;
    var s = svgOpen() + chartTitle(P, spec.title);
    s += axes(P, [], yTicks, { yMin: yMin, yMax: yMax, xLabel: spec.xLabel, yLabel: spec.yLabel });
    /* x 刻度:最多 8 个,均匀抽 */
    var step = Math.max(1, Math.ceil(n / 8));
    for (var i = 0; i < n; i += step) {
      s += '<text x="' + px(i) + '" y="' + (H - M.bottom + 18) + '" text-anchor="middle" font-size="11" fill="' +
        P.muted + '"' + (n > 5 ? ' transform="rotate(-28 ' + px(i) + ' ' + (H - M.bottom + 18) + ')"' : '') +
        '>' + esc(String(spec.x[i]).slice(0, 12)) + '</text>';
    }
    spec.series.forEach(function (se, si) {
      var color = P.series[si % P.series.length];
      var pts = [];
      se.values.forEach(function (v, i) {
        if (typeof v === 'number' && !isNaN(v)) pts.push([px(i), py(v), v, i]);
      });
      s += '<polyline class="mk" data-ser="' + si + '" fill="none" stroke="' + color +
        '" stroke-width="2" stroke-linejoin="round" points="' +
        pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '"/>';
      pts.forEach(function (p) {
        s += '<circle class="mk" data-ser="' + si + '" cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="' + color +
          '"' + tip(spec.x[p[3]] + ' · ' + se.name + ': ' + fmt(p[2])) + '/>';
      });
    });
    s += legend(P, spec.series.map(function (se) { return se.name; }));
    return s + '</svg>';
  }

  /* ---------------- 散点图(可按类别着色) ---------------- */
  function scatter(spec, P) {
    var pairs = [];
    for (var i = 0; i < spec.x.length; i++) {
      var xv = spec.x[i], yv = spec.y[i];
      if (typeof xv === 'number' && !isNaN(xv) && typeof yv === 'number' && !isNaN(yv)) {
        pairs.push({ x: xv, y: yv, g: spec.groups ? spec.groups[i] : null });
      }
    }
    if (!pairs.length) return '';
    var xs = pairs.map(function (p) { return p.x; }), ys = pairs.map(function (p) { return p.y; });
    var xTicks = niceTicks(Math.min.apply(null, xs), Math.max.apply(null, xs), 6);
    var yTicks = niceTicks(Math.min.apply(null, ys), Math.max.apply(null, ys), 5);
    var iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    var xMin = xTicks[0], xMax = xTicks[xTicks.length - 1];
    var yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
    var gList = [];
    pairs.forEach(function (p) {
      if (p.g != null && gList.indexOf(p.g) < 0) gList.push(p.g);
    });
    var s = svgOpen() + chartTitle(P, spec.title);
    s += axes(P, [], yTicks, { yMin: yMin, yMax: yMax, xLabel: spec.xLabel, yLabel: spec.yLabel });
    xTicks.forEach(function (t) {
      var x = M.left + (t - xMin) / (xMax - xMin) * iw;
      s += '<text x="' + x + '" y="' + (H - M.bottom + 18) + '" text-anchor="middle" font-size="11" fill="' +
        P.muted + '">' + esc(fmt(t)) + '</text>';
      s += '<line x1="' + x + '" y1="' + M.top + '" x2="' + x + '" y2="' + (H - M.bottom) +
        '" stroke="' + P.line + '" stroke-width="1"/>';
    });
    pairs.forEach(function (p) {
      var gi = gList.length ? gList.indexOf(p.g) : 0;
      var color = gList.length ? P.series[gi % P.series.length] : P.primary;
      var cx = M.left + (p.x - xMin) / (xMax - xMin) * iw;
      var cy = M.top + ih - (p.y - yMin) / (yMax - yMin) * ih;
      s += '<circle class="mk" data-ser="' + gi + '" cx="' + cx + '" cy="' + cy + '" r="3.5" fill="' + color +
        '" fill-opacity="0.75"' + tip((p.g != null ? p.g + ' · ' : '') + fmt(p.x) + ', ' + fmt(p.y)) + '/>';
    });
    /* 可选:回归直线(线性回归的拟合线) */
    if (spec.line) {
      var ly1 = spec.line.slope * xMin + spec.line.intercept;
      var ly2 = spec.line.slope * xMax + spec.line.intercept;
      var cy1 = Math.max(M.top, Math.min(M.top + ih, M.top + ih - (ly1 - yMin) / (yMax - yMin) * ih));
      var cy2 = Math.max(M.top, Math.min(M.top + ih, M.top + ih - (ly2 - yMin) / (yMax - yMin) * ih));
      s += '<line class="mk" x1="' + M.left + '" y1="' + cy1 + '" x2="' + (W - M.right) + '" y2="' + cy2 +
        '" stroke="' + P.accent + '" stroke-width="2.5" stroke-dasharray="7 5"/>';
    }
    /* 可选:簇中心标记(K-Means 的质心) */
    if (spec.centers) {
      spec.centers.forEach(function (c, i) {
        var cx = M.left + (c[0] - xMin) / (xMax - xMin) * iw;
        var cy = M.top + ih - (c[1] - yMin) / (yMax - yMin) * ih;
        var col = P.series[i % P.series.length];
        s += '<circle class="mk" cx="' + cx + '" cy="' + cy + '" r="8" fill="none" stroke="' + col +
          '" stroke-width="2.5"' + tip('C' + (i + 1) + ' (' + fmt(c[0]) + ', ' + fmt(c[1]) + ')') + '/>';
        s += '<line x1="' + (cx - 4) + '" y1="' + cy + '" x2="' + (cx + 4) + '" y2="' + cy +
          '" stroke="' + col + '" stroke-width="2"/><line x1="' + cx + '" y1="' + (cy - 4) + '" x2="' + cx +
          '" y2="' + (cy + 4) + '" stroke="' + col + '" stroke-width="2"/>';
      });
    }
    /* 坐标映射(曲线 / 箭头复用),并裁剪到绘图区 */
    function px(v) { return Math.max(M.left, Math.min(M.left + iw, M.left + (v - xMin) / (xMax - xMin) * iw)); }
    function py(v) { return Math.max(M.top, Math.min(M.top + ih, M.top + ih - (v - yMin) / (yMax - yMin) * ih)); }
    /* 可选:拟合曲线(多项式回归),在数据 x 范围内采样 80 段 */
    if (spec.curve) {
      var dMin = Math.min.apply(null, xs), dMax = Math.max.apply(null, xs);
      var ptsC = [];
      for (var ci = 0; ci <= 80; ci++) {
        var cvx = dMin + ci / 80 * (dMax - dMin);
        var cvy = spec.curve.fn(cvx);
        if (typeof cvy === 'number' && !isNaN(cvy)) ptsC.push([cvx, cvy]);
      }
      s += '<polyline class="mk" fill="none" stroke="' + P.accent + '" stroke-width="2.5" points="' +
        ptsC.map(function (q) { return px(q[0]) + ',' + py(q[1]); }).join(' ') + '"/>';
    }
    /* 可选:载荷箭头(PCA biplot),坐标即得分空间下的 loading×√λ */
    if (spec.arrows) {
      var ox = px(0), oy = py(0);
      spec.arrows.forEach(function (ar) {
        var ax = px(ar.x), ay = py(ar.y);
        s += '<line x1="' + ox + '" y1="' + oy + '" x2="' + ax + '" y2="' + ay +
          '" stroke="' + P.danger + '" stroke-width="1.8"/>';
        /* 简易箭头:沿方向画两条 7px 短边 */
        var ang = Math.atan2(ay - oy, ax - ox);
        s += '<line x1="' + ax + '" y1="' + ay + '" x2="' + (ax - 7 * Math.cos(ang - 0.42)) +
          '" y2="' + (ay - 7 * Math.sin(ang - 0.42)) + '" stroke="' + P.danger + '" stroke-width="1.8"/>' +
          '<line x1="' + ax + '" y1="' + ay + '" x2="' + (ax - 7 * Math.cos(ang + 0.42)) +
          '" y2="' + (ay - 7 * Math.sin(ang + 0.42)) + '" stroke="' + P.danger + '" stroke-width="1.8"/>';
        var lx = ax + (ar.x >= 0 ? 6 : -6);
        s += '<text x="' + lx + '" y="' + (ay + 4) + '" ' + (ar.x >= 0 ? '' : 'text-anchor="end"') +
          ' font-size="11" font-weight="600" fill="' + P.danger + '"><title>' +
          esc(ar.label) + ' (' + ar.x.toFixed(2) + ', ' + ar.y.toFixed(2) + ')</title>' + esc(ar.label) + '</text>';
      });
    }
    s += legend(P, gList.slice(0, 8));
    return s + '</svg>';
  }

  /* ---------------- 箱线图(按类别分组) ---------------- */
  function box(spec, P) {
    var groups = spec.groups.map(function (g) {
      var vals = g.values.filter(function (v) { return typeof v === 'number' && !isNaN(v); })
        .sort(function (a, b) { return a - b; });
      function q(p) {
        if (!vals.length) return null;
        var pos = (vals.length - 1) * p, b = Math.floor(pos), r = pos - b;
        return vals[b + 1] !== undefined ? vals[b] + r * (vals[b + 1] - vals[b]) : vals[b];
      }
      return { label: g.label, min: vals[0], q1: q(.25), med: q(.5), q3: q(.75), max: vals[vals.length - 1], n: vals.length };
    }).filter(function (g) { return g.n > 0; });
    if (!groups.length) return '';
    var lo = Math.min.apply(null, groups.map(function (g) { return g.min; }));
    var hi = Math.max.apply(null, groups.map(function (g) { return g.max; }));
    var yTicks = niceTicks(lo, hi, 5);
    var yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
    var iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    function py(v) { return M.top + ih - (v - yMin) / (yMax - yMin) * ih; }
    var s = svgOpen() + chartTitle(P, spec.title);
    s += axes(P, [], yTicks, { yMin: yMin, yMax: yMax, xLabel: spec.xLabel, yLabel: spec.yLabel });
    var bw = iw / groups.length;
    groups.forEach(function (g, i) {
      var cx = M.left + i * bw + bw / 2, w = Math.min(56, bw * 0.5);
      var color = P.series[i % P.series.length];
      var gs = '';
      gs += '<line x1="' + cx + '" y1="' + py(g.min) + '" x2="' + cx + '" y2="' + py(g.max) +
        '" stroke="' + P.muted + '"/>';
      gs += '<rect x="' + (cx - w / 2) + '" y="' + py(g.q3) + '" width="' + w + '" height="' +
        Math.max(1, py(g.q1) - py(g.q3)) + '" rx="3" fill="' + color + '" fill-opacity="0.45" stroke="' + color + '"/>';
      gs += '<line x1="' + (cx - w / 2) + '" y1="' + py(g.med) + '" x2="' + (cx + w / 2) + '" y2="' + py(g.med) +
        '" stroke="' + P.accent + '" stroke-width="2.5"/>';
      [g.min, g.max].forEach(function (v) {
        gs += '<line x1="' + (cx - w / 4) + '" y1="' + py(v) + '" x2="' + (cx + w / 4) + '" y2="' + py(v) +
          '" stroke="' + P.muted + '" stroke-width="2"/>';
      });
      gs += '<text x="' + cx + '" y="' + (H - M.bottom + 18) + '" text-anchor="middle" font-size="11" fill="' +
        P.muted + '">' + esc(String(g.label).slice(0, 12)) + '</text>';
      /* 整组捆绑成一个可交互图元:悬停即高亮该组并弹出五数概括 */
      s += '<g class="mk" data-ser="' + i + '"' +
        tip(g.label + ' · median ' + fmt(g.med) + ' · Q1 ' + fmt(g.q1) + ' · Q3 ' + fmt(g.q3) +
            ' · min ' + fmt(g.min) + ' · max ' + fmt(g.max) + ' · n=' + g.n) + '>' + gs + '</g>';
    });
    return s + '</svg>';
  }

  /* ---------------- 相关系数热力图 ---------------- */
  function corr(spec, P) {
    var cols = spec.columns, mx = spec.matrix, n = cols.length;
    if (!n) return '';
    var size = Math.min(W, H + 120);
    var cell = (size - 170) / n;
    var ox = 120, oy = 30;
    var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" preserveAspectRatio="xMidYMid meet" role="img" font-family="inherit">';
    s += chartTitle(P, spec.title);
    for (var a = 0; a < n; a++) {
      for (var b = 0; b < n; b++) {
        var v = mx[a][b];
        var fill;
        if (v == null) fill = P.line;
        else if (v >= 0) fill = 'color-mix(in srgb, ' + P.primary + ' ' + Math.round(Math.abs(v) * 82 + 8) + '%, ' + P.surface + ')';
        else fill = 'color-mix(in srgb, ' + P.accent + ' ' + Math.round(Math.abs(v) * 82 + 8) + '%, ' + P.surface + ')';
        s += '<rect class="mk" x="' + (ox + b * cell) + '" y="' + (oy + a * cell) + '" width="' + (cell - 2) +
          '" height="' + (cell - 2) + '" rx="4" fill="' + fill + '"' +
          tip(cols[a] + ' × ' + cols[b] + ': ' + (v == null ? '—' : v.toFixed(3))) + '/>';
        if (v != null && n <= 10) {
          s += '<text x="' + (ox + b * cell + cell / 2 - 1) + '" y="' + (oy + a * cell + cell / 2 + 4) +
            '" text-anchor="middle" font-size="11" fill="' + P.text + '">' + v.toFixed(2) + '</text>';
        }
      }
      s += '<text x="' + (ox - 8) + '" y="' + (oy + a * cell + cell / 2 + 4) + '" text-anchor="end" font-size="11" fill="' +
        P.text + '">' + esc(cols[a]) + '</text>';
      s += '<text x="' + (ox + a * cell + cell / 2) + '" y="' + (oy - 8) + '" text-anchor="middle" font-size="11" fill="' +
        P.text + '" transform="rotate(-35 ' + (ox + a * cell + cell / 2) + ' ' + (oy - 8) + ')">' + esc(cols[a]) + '</text>';
    }
    return s + '</svg>';
  }

  /* ---------------- 决策边界(逻辑回归) ---------------- */
  function boundary(spec, P) {
    var xs = [], ys = [];
    for (var i = 0; i < spec.x.length; i++) {
      if (typeof spec.x[i] === 'number' && !isNaN(spec.x[i]) &&
          typeof spec.y[i] === 'number' && !isNaN(spec.y[i])) { xs.push(spec.x[i]); ys.push(spec.y[i]); }
    }
    if (!xs.length) return '';
    var xTicks = niceTicks(Math.min.apply(null, xs), Math.max.apply(null, xs), 6);
    var yTicks = niceTicks(Math.min.apply(null, ys), Math.max.apply(null, ys), 5);
    var xMin = xTicks[0], xMax = xTicks[xTicks.length - 1];
    var yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
    var iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    var s = svgOpen() + chartTitle(P, spec.title);
    /* 背景网格逐格预测,形成两个类别区域 */
    var NX = 48, NY = 30, cw = iw / NX, ch = ih / NY;
    for (var gx = 0; gx < NX; gx++) {
      for (var gy = 0; gy < NY; gy++) {
        var dx = xMin + (gx + 0.5) / NX * (xMax - xMin);
        var dy = yMin + (1 - (gy + 0.5) / NY) * (yMax - yMin);
        var cls = spec.predict(dx, dy);
        s += '<rect x="' + (M.left + gx * cw) + '" y="' + (M.top + gy * ch) + '" width="' + (cw + 0.5) +
          '" height="' + (ch + 0.5) + '" fill="' + P.series[cls ? 3 : 0] + '" fill-opacity="0.13"/>';
      }
    }
    s += axes(P, [], yTicks, { yMin: yMin, yMax: yMax, xLabel: spec.xLabel, yLabel: spec.yLabel });
    xTicks.forEach(function (t) {
      var x = M.left + (t - xMin) / (xMax - xMin) * iw;
      s += '<text x="' + x + '" y="' + (H - M.bottom + 18) + '" text-anchor="middle" font-size="11" fill="' +
        P.muted + '">' + esc(fmt(t)) + '</text>';
    });
    for (var j = 0; j < xs.length; j++) {
      var clsj = spec.labels[j];
      var cx = M.left + (xs[j] - xMin) / (xMax - xMin) * iw;
      var cy = M.top + ih - (ys[j] - yMin) / (yMax - yMin) * ih;
      s += '<circle class="mk" data-ser="' + (clsj ? 1 : 0) + '" cx="' + cx + '" cy="' + cy +
        '" r="4" fill="' + P.series[clsj ? 3 : 0] + '" fill-opacity="0.85" stroke="' + P.surface +
        '" stroke-width="1"' + tip(spec.classNames[clsj] + ': ' + fmt(xs[j]) + ', ' + fmt(ys[j])) + '/>';
    }
    s += legend(P, spec.classNames, [P.series[0], P.series[3]]);
    return s + '</svg>';
  }

  /* ================= 交互层 =================
   * 思路:SVG 仍按字符串一次性生成,只给需要交互的图元打 class="mk"
   * (配 data-ser / data-tip),再在容器上做事件委托 —— 不逐个绑定监听。
   * 高亮只用 opacity + filter,避开 <g> 与子元素内联 stroke 的覆盖差异。
   * ========================================== */
  var NS = 'http://www.w3.org/2000/svg';

  /* 全局单例提示框,挂在 body 上,fixed 定位,pointer-events:none */
  function tipEl() {
    var el = document.querySelector('.chart-tip');
    if (!el) {
      el = document.createElement('div');
      el.className = 'chart-tip';
      document.body.appendChild(el);
    }
    return el;
  }

  function placeTip(el, x, y) {
    el.style.left = '0px'; el.style.top = '0px';
    var w = el.offsetWidth, h = el.offsetHeight;
    var lx = x + 16, ty = y + 16;
    if (lx + w > window.innerWidth - 10) lx = Math.max(8, x - w - 16);
    if (ty + h > window.innerHeight - 10) ty = Math.max(8, y - h - 16);
    el.style.left = lx + 'px';
    el.style.top = ty + 'px';
  }

  /* rows:已转义的 HTML 片段数组;多行时首行作为标题 */
  function showTip(rows, x, y) {
    var el = tipEl();
    el.innerHTML = rows.map(function (r, i) {
      return '<div class="' + (i === 0 && rows.length > 1 ? 'tip-x' : 'tip-row') + '">' + r + '</div>';
    }).join('');
    el.classList.add('is-on');
    placeTip(el, x, y);
  }

  function hideTip() {
    var el = document.querySelector('.chart-tip');
    if (el) el.classList.remove('is-on');
  }

  function clearHi(container) {
    var svg = container.querySelector('svg');
    if (!svg) return;
    var arr = svg.querySelectorAll('.is-hi, .is-dim');
    for (var i = 0; i < arr.length; i++) arr[i].classList.remove('is-hi', 'is-dim');
  }

  /* 有系列归属:同 data-ser 的图元全部点亮,其余淡出 */
  function hiSeries(svg, ser) {
    var arr = svg.querySelectorAll('.mk[data-ser], .lg-item[data-ser]');
    for (var i = 0; i < arr.length; i++) {
      var on = arr[i].getAttribute('data-ser') === ser;
      arr[i].classList.toggle('is-hi', on);
      arr[i].classList.toggle('is-dim', !on);
    }
  }

  /* 无系列归属(直方图 / 条形图 / 热力图单元格):只点亮悬停的那一个 */
  function hiSingle(svg, mk) {
    var arr = svg.querySelectorAll('.mk');
    for (var i = 0; i < arr.length; i++) {
      arr[i].classList.toggle('is-hi', arr[i] === mk);
      arr[i].classList.toggle('is-dim', arr[i] !== mk);
    }
  }

  /* 同一目标重复悬停时不做无谓的样式改写 */
  function updateHi(container, svg, el) {
    var key = '';
    if (el) {
      var ser = el.getAttribute('data-ser');
      if (ser != null) key = 's:' + ser;
      else {
        if (!el.__hid) el.__hid = 'h' + (container.__hidSeq = (container.__hidSeq || 0) + 1);
        key = 'e:' + el.__hid;
      }
    }
    if (container.__hiKey === key) return;
    container.__hiKey = key;
    clearHi(container);
    if (!el) return;
    var s2 = el.getAttribute('data-ser');
    if (s2 != null) hiSeries(svg, s2); else hiSingle(svg, el);
  }

  /* 客户端坐标 → viewBox 坐标(处理 preserveAspectRatio 的留白) */
  function toUser(svg, clientX, clientY) {
    var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    var sc = Math.min(r.width / vb.width, r.height / vb.height) || 1;
    return {
      x: (clientX - r.left - (r.width - vb.width * sc) / 2) / sc,
      y: (clientY - r.top - (r.height - vb.height * sc) / 2) / sc
    };
  }

  /* 折线图十字准线:一根竖线 + 每系列一个读数圆点,在 render 时挂到 svg 上 */
  function buildCursor(svg, spec, P) {
    var sc = lineScales(spec);
    if (!sc) return;
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'lc');
    var ln = document.createElementNS(NS, 'line');
    ln.setAttribute('class', 'lc-line');
    g.appendChild(ln);
    var dots = spec.series.map(function (se, si) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'lc-dot');
      c.setAttribute('r', '0');
      c.setAttribute('fill', P.series[si % P.series.length]);
      g.appendChild(c);
      return c;
    });
    svg.appendChild(g);
    svg.__lc = {
      g: g, line: ln, dots: dots,
      colors: spec.series.map(function (se, si) { return P.series[si % P.series.length]; })
    };
    svg.__sc = sc;
  }

  /* 按光标 x 吸附到最近的数据点,竖线 + 各系列读数一次性给出 */
  function cursorOn(svg, spec, pt, cx, cy) {
    var lc = svg.__lc, sc = svg.__sc;
    if (!lc || !sc) return;
    var n = sc.n;
    var i = n <= 1 ? 0 : Math.round((pt.x - M.left) / sc.iw * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    var ux = sc.px(i);
    lc.line.setAttribute('x1', ux); lc.line.setAttribute('x2', ux);
    lc.line.setAttribute('y1', M.top); lc.line.setAttribute('y2', H - M.bottom);
    var rows = [esc(String(spec.x[i]))];
    spec.series.forEach(function (se, si) {
      var dot = lc.dots[si], v = se.values[i];
      if (typeof v === 'number' && !isNaN(v)) {
        dot.setAttribute('cx', ux);
        dot.setAttribute('cy', sc.py(v));
        dot.setAttribute('r', '4');
        rows.push('<i style="background:' + lc.colors[si] + '"></i>' + esc(se.name) + ' · ' + esc(fmt(v)));
      } else {
        dot.setAttribute('r', '0');
      }
    });
    lc.g.classList.add('is-on');
    showTip(rows, cx, cy);
  }

  function bind(container, spec) {
    container.__spec = spec;
    if (container.__bound) return;   /* 容器只绑一次,重绘靠 __spec 更新 */
    container.__bound = true;

    container.addEventListener('mousemove', function (e) {
      var svg = container.querySelector('svg');
      if (!svg) return;
      var sp = container.__spec, t = e.target, mark = null, lg = null;
      if (t && t.closest && svg.contains(t)) {
        lg = t.closest('.lg-item');
        mark = lg || t.closest('.mk');
        if (mark && !svg.contains(mark)) { mark = null; lg = null; }
      }
      updateHi(container, svg, mark);

      /* 折线图:绘图区内任意位置都给十字准线 + 全系列读数 */
      if (sp && sp.type === 'line' && svg.__lc && !lg) {
        var pt = toUser(svg, e.clientX, e.clientY);
        if (pt.x >= M.left && pt.x <= W - M.right && pt.y >= M.top && pt.y <= H - M.bottom) {
          cursorOn(svg, sp, pt, e.clientX, e.clientY);
          return;
        }
        svg.__lc.g.classList.remove('is-on');
      }

      if (mark && !lg) {
        var txt = mark.getAttribute('data-tip');
        if (txt) { showTip([esc(txt)], e.clientX, e.clientY); return; }
      }
      hideTip();
    });

    container.addEventListener('mouseleave', function () {
      var svg = container.querySelector('svg');
      clearHi(container);
      container.__hiKey = '';
      if (svg && svg.__lc) svg.__lc.g.classList.remove('is-on');
      hideTip();
    });
  }

  /* ---------------- 入口 ---------------- */
  function render(container, spec) {
    var P = palette();
    var out = '';
    if (spec.type === 'hist') out = hist(spec, P);
    else if (spec.type === 'bar') out = bar(spec, P);
    else if (spec.type === 'line') out = line(spec, P);
    else if (spec.type === 'scatter') out = scatter(spec, P);
    else if (spec.type === 'box') out = box(spec, P);
    else if (spec.type === 'corr') out = corr(spec, P);
    else if (spec.type === 'boundary') out = boundary(spec, P);
    container.innerHTML = out ||
      '<p style="padding:24px;color:' + P.muted + '">∅</p>';
    container.__hiKey = '';
    var svg = container.querySelector('svg');
    if (svg && spec.type === 'line') buildCursor(svg, spec, P);
    bind(container, spec);
    return out;
  }

  window.MiniCharts = { render: render, bind: bind };
}());
