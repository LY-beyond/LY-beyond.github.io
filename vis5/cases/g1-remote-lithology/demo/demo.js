/* ======= 遥感地质剖面岩性解译 · 可运行示范 ======= */
(function () {
  'use strict';

  var COLS = 36, ROWS = 20, CW = 10, CH = 10, X0 = 10, Y0 = 28;
  var CLASSES = [
    { n: '砂岩', c: '#716136' },
    { n: '泥岩', c: '#717b65' },
    { n: '灰岩', c: '#4b5f60' },
    { n: '白云岩', c: '#488778' },
    { n: '玄武岩', c: '#70607c' },
    { n: '冲积层', c: '#a36d3f' }
  ];
  var CONFUSE = [0, 4, 3, 2, 1, 0];
  var cells = [];
  var state = { thr: 0.55, edge: true };

  function $(id) { return document.getElementById(id); }
  function rnd(s) {
    var v = Math.sin(s * 12.9898 + 7.233) * 43758.5453;
    return v - Math.floor(v);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function build() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var nx = x / COLS, ny = y / ROWS;
        var s = ny * 6.4 + nx * 1.9 + 0.42 * Math.sin(nx * 7.2 + 0.6);
        var t = Math.floor(((s % 6) + 6) % 6);
        var frac = ((s % 6) + 6) % 6;
        var nearEdge = Math.abs(frac - Math.round(frac)) < 0.05 ? 1 : 0;
        var veg = Math.exp(-(Math.pow((nx - 0.84) / 0.15, 2) + Math.pow((ny - 0.18) / 0.19, 2)));
        var shadow = Math.exp(-(Math.pow((nx - 0.18) / 0.19, 2) + Math.pow((ny - 0.82) / 0.15, 2)));
        var conf = 0.94 - 0.10 * Math.abs(Math.sin(nx * 21 + ny * 15))
          - 0.32 * veg - 0.27 * shadow - 0.11 * nearEdge;
        conf = clamp(conf, 0.27, 0.985);
        var w = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05];
        w[t] = conf * (1 - 0.30 * shadow);
        w[CONFUSE[t]] += (1 - conf) * 0.62 + 0.50 * shadow;
        w[(t + 3) % 6] += (1 - conf) * 0.22;
        var sum = 0, i;
        for (i = 0; i < 6; i++) sum += w[i];
        var p = [];
        for (i = 0; i < 6; i++) p.push(w[i] / sum);
        cells.push({ t: t, p: p, veg: veg, shadow: shadow, seed: x * 37 + y * 91 + 5 });
      }
    }
  }

  function predict() {
    var counts = [0, 0, 0, 0, 0, 0], un = 0, correct = 0, classified = 0;
    cells.forEach(function (c) {
      var best = 0, bi = 0, i;
      for (i = 0; i < 6; i++) if (c.p[i] > best) { best = c.p[i]; bi = i; }
      c.best = best;
      c.pred = best >= state.thr ? bi : -1;
      if (c.pred < 0) {
        un++;
      } else {
        counts[c.pred]++;
        classified++;
      }
      if (c.pred === c.t) correct++;
    });
    return {
      counts: counts, un: un, classified: classified,
      acc: correct / cells.length,
      miss: un / cells.length,
      ncls: counts.filter(function (v) { return v > 0; }).length
    };
  }

  function drawImage() {
    var s = '<rect x="0" y="0" width="380" height="244" fill="#edf2ec" rx="6"/>';
    s += '<text x="10" y="17" font-size="10" fill="#585f4f">假彩色合成 R:G:B = 7:5:3 · 10 m/像元</text>';
    cells.forEach(function (c, k) {
      var x = X0 + (k % COLS) * CW;
      var y = Y0 + Math.floor(k / COLS) * CH;
      var r1 = rnd(c.seed), r2 = rnd(c.seed + 3.1);
      s += '<rect x="' + x + '" y="' + y + '" width="' + CW + '" height="' + CH + '" fill="' + CLASSES[c.t].c + '"/>';
      s += '<rect x="' + (x + r1 * 6).toFixed(1) + '" y="' + (y + r2 * 6).toFixed(1)
        + '" width="2.6" height="2.6" fill="#f1f5f0" opacity="' + (0.16 + r1 * 0.26).toFixed(2) + '"/>';
    });
    s += '<path d="M10 228 L10 156 L120 124 L196 168 L196 228 Z" fill="#f1f5f0" opacity="0.40"/>';
    s += '<text x="24" y="214" font-size="9.5" fill="#4f4836">地形阴影</text>';
    var i, cx, cy, r;
    for (i = 0; i < 70; i++) {
      cx = 272 + rnd(i * 4.7 + 1) * 100;
      cy = 30 + rnd(i * 6.1 + 9) * 66;
      r = 0.9 + rnd(i * 2.3 + 5) * 1.5;
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1)
        + '" fill="#97b582" opacity="' + (0.32 + rnd(i + 11) * 0.3).toFixed(2) + '"/>';
    }
    s += '<text x="298" y="94" font-size="9.5" fill="#4f4836">植被</text>';
    s += '<line x1="12" y1="236" x2="62" y2="236" stroke="#4f4836" stroke-width="1.4"/>';
    s += '<text x="66" y="239" font-size="8.5" fill="#585f4f">0 — 500 m</text>';
    $('img').innerHTML = s;
  }

  function drawMask(m) {
    var s = '<rect x="0" y="0" width="380" height="244" fill="#edf2ec" rx="6"/>';
    s += '<text x="10" y="17" font-size="10" fill="#585f4f">语义分割掩膜 · 阈值 ' + state.thr.toFixed(2) + '</text>';
    s += '<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
      + '<rect width="5" height="5" fill="#e8eee5"/><line x1="0" y1="0" x2="0" y2="5" stroke="#c2ccbb" stroke-width="1.6"/></pattern></defs>';
    var k, c, x, y;
    for (k = 0; k < cells.length; k++) {
      c = cells[k];
      x = X0 + (k % COLS) * CW;
      y = Y0 + Math.floor(k / COLS) * CH;
      if (c.pred < 0) {
        s += '<rect x="' + x + '" y="' + y + '" width="' + CW + '" height="' + CH + '" fill="url(#hatch)"/>';
      } else {
        s += '<rect x="' + x + '" y="' + y + '" width="' + CW + '" height="' + CH
          + '" fill="' + CLASSES[c.pred].c + '" opacity="0.86"/>';
      }
    }
    if (state.edge) {
      for (k = 0; k < cells.length; k++) {
        c = cells[k];
        x = X0 + (k % COLS) * CW;
        y = Y0 + Math.floor(k / COLS) * CH;
        var right = (k % COLS) < COLS - 1 ? cells[k + 1] : null;
        var down = k + COLS < cells.length ? cells[k + COLS] : null;
        if (right && c.pred !== right.pred) {
          s += '<line x1="' + (x + CW) + '" y1="' + y + '" x2="' + (x + CW) + '" y2="' + (y + CH)
            + '" stroke="#f1f5f0" stroke-width="1.3"/>';
        }
        if (down && c.pred !== down.pred) {
          s += '<line x1="' + x + '" y1="' + (y + CH) + '" x2="' + (x + CW) + '" y2="' + (y + CH)
            + '" stroke="#f1f5f0" stroke-width="1.3"/>';
        }
      }
    }
    s += '<text x="10" y="236" font-size="9" fill="#838b7b">斜线格 = 置信度不足，交人工复核</text>';
    $('mask').innerHTML = s;
  }

  function drawLegend(m) {
    var html = '', i;
    for (i = 0; i < 6; i++) {
      html += '<span class="lg"><i style="background:' + CLASSES[i].c + '"></i>'
        + CLASSES[i].n + '<b>' + m.counts[i] + '</b></span>';
    }
    html += '<span class="lg"><i class="hatch"></i>未分类<b>' + m.un + '</b></span>';
    $('legend').innerHTML = html;
  }

  function updateStats(m) {
    var acc = m.acc * 100, miss = m.miss * 100;
    var ae = $('r-acc'), me = $('r-miss');
    ae.textContent = acc.toFixed(1) + '%';
    ae.className = acc >= 88 ? '' : acc >= 78 ? 'warn' : 'bad';
    me.textContent = miss.toFixed(1) + '%';
    me.className = miss <= 15 ? '' : miss <= 30 ? 'warn' : 'bad';
    $('r-cls').textContent = m.ncls + ' / 6';

    var v = $('verdict');
    if (acc >= 88 && miss <= 15) {
      v.className = 'verdict ok';
      v.innerHTML = '<b>可用于预筛</b>全图像元准确率 ' + acc.toFixed(1) + '%，未分类 '
        + miss.toFixed(1) + '%。可输出 1:5 万初稿，人工只修边界与阴影区。';
    } else if (miss > 30) {
      v.className = 'verdict bad';
      v.innerHTML = '<b>需人工复核</b>未分类像元达 ' + miss.toFixed(1)
        + '%，漏判集中在阴影与植被遮挡区，不能直接成图。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = '<b>需人工复核</b>准确率 ' + acc.toFixed(1) + '%、未分类 '
        + miss.toFixed(1) + '%。边界处仍有错分，建议叠加边界后逐图斑抽检。';
    }
  }

  var pending = false;
  function render() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var m = predict();
      drawMask(m);
      drawLegend(m);
      updateStats(m);
    });
  }

  function bind() {
    $('s-thr').addEventListener('input', function (e) {
      state.thr = +e.target.value;
      $('o-thr').textContent = state.thr.toFixed(2);
      render();
    });
    $('c-edge').addEventListener('change', function (e) {
      state.edge = e.target.checked;
      render();
    });
  }

  build();
  drawImage();
  bind();
  render();
})();
