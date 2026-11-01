/* ======= 岩屑岩性细粒度识别 · 可运行示范 ======= */
(function () {
  'use strict';

  var CLASSES = [
    { name: '砂岩', color: 'var(--clay)' },
    { name: '泥岩', color: 'var(--violet)' },
    { name: '灰岩', color: 'var(--blue)' },
    { name: '白云岩', color: 'var(--acc)' },
    { name: '过渡岩性', color: 'var(--gold)' }
  ];
  var FILL = ['#866e46', '#87906f', '#515c5c', '#474430', '#95925c'];
  var EDGE = ['#645027', '#636c4c', '#323c3c', '#2d2a17', '#76733b'];

  var GROUP_DEF = [
    { key: 'A', name: '细砂岩', classes: [0, 0, 0, 0, 4, 0, 1, 0], hard: 0.25, pair: [0, 4] },
    { key: 'B', name: '灰质泥岩', classes: [1, 1, 4, 1, 2, 1, 4, 1], hard: 0.30, pair: [1, 4] },
    { key: 'C', name: '白云岩', classes: [3, 2, 3, 3, 2, 3, 4, 3], hard: 0.38, pair: [2, 3] }
  ];

  var state = { g: 0, i: 0, n: 800 };
  var groups = [];
  var raf = false;

  function $(id) { return document.getElementById(id); }
  function rnd(s) {
    var v = Math.sin(s * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function buildGroups() {
    GROUP_DEF.forEach(function (def, gi) {
      var list = [];
      for (var i = 0; i < 8; i++) {
        var seed = gi * 100 + i * 7.13 + 3.7;
        var r = rnd(seed);
        list.push({
          seed: seed,
          trueCls: def.classes[i],
          confused: def.pair[1] === def.classes[i] ? def.pair[0] : def.pair[1],
          size: 23 + r * 9,
          sides: 5 + Math.floor(rnd(seed + 1.9) * 3),
          rot: rnd(seed + 4.4) * 180,
          oil: rnd(seed + 8.2) > 0.55 ? '中' : '轻',
          mm: (1.4 + r * 2.6).toFixed(1)
        });
      }
      groups.push({ def: def, parts: list });
    });
  }

  function metricsFor(n, g) {
    var acc = 0.50 + 0.37 * (1 - Math.exp(-n / 900)) - GROUP_DEF[g].hard * 0.02;
    var minor = acc - 0.17 - 0.08 * Math.exp(-n / 700);
    return { acc: clamp(acc, 0.05, 0.965), minor: clamp(minor, 0.03, 0.95) };
  }

  function probsFor(p, n) {
    var conf = 0.30 + 0.55 * (1 - Math.exp(-n / 1200));
    var diff = GROUP_DEF[state.g].hard;
    var w = [0.09, 0.09, 0.09, 0.09, 0.09];
    w[p.trueCls] = 0.35 + 0.62 * conf - diff * 0.16;
    w[p.confused] += 0.14 + 0.24 * (1 - conf) + diff * 0.10;
    for (var i = 0; i < 5; i++) {
      if (i !== p.trueCls && i !== p.confused) {
        w[i] += 0.05 * Math.abs(Math.sin(p.seed * 1.7 + i));
      }
    }
    var sum = w.reduce(function (a, b) { return a + b; }, 0);
    return w.map(function (v) { return v / sum; });
  }

  function texture(p, r) {
    var cls = p.trueCls, s = '', k, x, y;
    for (k = 0; k < 5; k++) {
      x = (rnd(p.seed + k * 2.3) - 0.5) * r * 1.05;
      y = (rnd(p.seed + k * 3.1 + 5) - 0.5) * r * 1.05;
      if (cls === 0 || cls === 4) {
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.4" fill="#d5d3c3" opacity=".55"/>';
      } else if (cls === 1) {
        s += '<path d="M' + (x - 4).toFixed(1) + ' ' + y.toFixed(1) + ' L' + (x + 4).toFixed(1) + ' ' + y.toFixed(1) + '" stroke="#d1d5ca" stroke-width="1.1" opacity=".55"/>';
      } else {
        s += '<path d="M' + x.toFixed(1) + ' ' + (y - 2.6).toFixed(1) + ' L' + (x + 2.6).toFixed(1) + ' ' + y.toFixed(1) + ' L' + x.toFixed(1) + ' ' + (y + 2.6).toFixed(1) + ' L' + (x - 2.6).toFixed(1) + ' ' + y.toFixed(1) + ' Z" fill="#c5d0d0" opacity=".42"/>';
      }
    }
    if (cls === 4) {
      s += '<path d="M' + (-r * 0.5) + ' ' + (r * 0.2) + ' L' + (r * 0.5) + ' ' + (r * 0.2) + '" stroke="#d1d5ca" stroke-width="1" opacity=".4"/>';
    }
    return s;
  }

  function particleShape(p, idx) {
    var r = p.size, pts = [], k, a, rad;
    if (p.trueCls === 1) {
      return '<ellipse rx="' + (r * 1.06).toFixed(1) + '" ry="' + (r * 0.82).toFixed(1) + '" transform="rotate(' + p.rot.toFixed(0) + ')" fill="' + FILL[p.trueCls] + '" stroke="' + EDGE[p.trueCls] + '" stroke-width="1.4"/>';
    }
    for (k = 0; k < p.sides; k++) {
      a = (k / p.sides) * Math.PI * 2 + p.rot * Math.PI / 180;
      rad = r * (0.82 + 0.26 * rnd(p.seed + k * 2.7));
      pts.push((Math.cos(a) * rad).toFixed(1) + ',' + (Math.sin(a) * rad).toFixed(1));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + FILL[p.trueCls] + '" stroke="' + EDGE[p.trueCls] + '" stroke-width="1.4"/>';
  }

  function drawSamples() {
    var svg = $('samples');
    var grp = groups[state.g], s = '';
    s += '<text x="16" y="16" font-size="9" fill="var(--tx-3)">颗粒缩略图（点击选择）· 40× 显微</text>';
    for (var i = 0; i < grp.parts.length; i++) {
      var p = grp.parts[i];
      var cx = 60 + (i % 4) * 100, cy = 62 + Math.floor(i / 4) * 84;
      var sel = i === state.i;
      s += '<g class="particle" data-i="' + i + '" transform="translate(' + cx + ',' + cy + ')">';
      if (sel) {
        s += '<circle r="' + (p.size + 8) + '" fill="none" stroke="var(--acc)" stroke-width="1.4" stroke-dasharray="4 3"/>';
      }
      s += '<circle r="' + (p.size + 3) + '" fill="#f2f6f1" opacity=".55"/>';
      s += '<g transform="rotate(' + (i * 9 - 20) + ')">' + particleShape(p, i) + texture(p, p.size) + '</g>';
      if (p.oil === '中') {
        s += '<path d="M' + (-p.size * 0.7) + ' ' + (-p.size * 0.6) + ' Q0 ' + (-p.size * 0.95) + ' ' + (p.size * 0.6) + ' ' + (-p.size * 0.55) + '" fill="none" stroke="#c5a575" stroke-width="1.1" opacity=".55"/>';
      }
      s += '<text x="0" y="' + (p.size + 18) + '" font-size="9" fill="' + (sel ? 'var(--acc)' : 'var(--tx-3)') + '" text-anchor="middle">' + grp.def.key + '-0' + (i + 1) + '</text>';
      s += '</g>';
    }
    s += '<text x="16" y="212" font-size="9" fill="var(--tx-3)">颗粒 1—5 mm；油膜与泥饼会遮蔽表面纹理</text>';
    svg.innerHTML = s;
    var p2 = grp.parts[state.i];
    $('sample-hint').textContent = '当前 ' + grp.def.key + '-0' + (state.i + 1) + ' · 粒径 ' + p2.mm +
      ' mm · 油膜' + p2.oil + ' · 人工标注：' + CLASSES[p2.trueCls].name;
  }

  function drawProbs() {
    var svg = $('probs');
    var grp = groups[state.g], p = grp.parts[state.i];
    var probs = probsFor(p, state.n);
    var top = probs.indexOf(Math.max.apply(null, probs));
    var s = '<text x="14" y="16" font-size="9" fill="var(--tx-3)">类别概率（%）· 单颗粒</text>';
    for (var i = 0; i < 5; i++) {
      var y = 36 + i * 34, w = probs[i] * 235;
      s += '<text x="96" y="' + (y + 11) + '" font-size="10" fill="' + (i === top ? 'var(--tx)' : 'var(--tx-2)') + '" text-anchor="end">' + CLASSES[i].name + '</text>';
      s += '<rect x="104" y="' + y + '" width="235" height="14" rx="3" fill="var(--line)"/>';
      s += '<rect x="104" y="' + y + '" width="' + w.toFixed(1) + '" height="14" rx="3" fill="' + CLASSES[i].color + '" opacity="' + (i === top ? '.95' : '.5') + '"/>';
      s += '<text x="347" y="' + (y + 11) + '" font-size="9.5" fill="' + (i === top ? 'var(--tx)' : 'var(--tx-3)') + '" font-family="var(--mono)">' + (probs[i] * 100).toFixed(1) + '</text>';
    }
    s += '<line x1="104" y1="196" x2="339" y2="196" stroke="var(--line)"/>';
    s += '<text x="14" y="208" font-size="9" fill="var(--tx-3)">预测：' + CLASSES[top].name + '　真值：' + CLASSES[p.trueCls].name;
    s += (top === p.trueCls ? '　判对' : '　判错，全部转人工') + '</text>';
    if (top !== p.trueCls) {
      s += '<text x="352" y="208" font-size="9" fill="var(--bad)" text-anchor="end">低置信</text>';
    }
    svg.innerHTML = s;
  }

  function drawCurve() {
    var svg = $('curve');
    var padL = 36, padR = 14, padT = 22, padB = 30;
    var W = 430, H = 180, pw = W - padL - padR, ph = H - padT - padB;
    var lo = Math.log(50), hi = Math.log(5000);
    function xOf(n) { return padL + (Math.log(n) - lo) / (hi - lo) * pw; }
    function yOf(v) { return padT + ph - v * ph; }
    var s = '<text x="14" y="14" font-size="9" fill="var(--tx-3)">准确率 (%)</text>';
    for (var v = 0; v <= 1.0001; v += 0.2) {
      s += '<line x1="' + padL + '" y1="' + yOf(v) + '" x2="' + (padL + pw) + '" y2="' + yOf(v) + '" stroke="var(--line)"/>';
      s += '<text x="' + (padL - 8) + '" y="' + (yOf(v) + 3) + '" font-size="8" fill="var(--tx-3)" text-anchor="end">' + Math.round(v * 100) + '</text>';
    }
    var ticks = [50, 100, 200, 500, 1000, 2000, 5000];
    ticks.forEach(function (t) {
      s += '<text x="' + xOf(t) + '" y="' + (padT + ph + 14) + '" font-size="8" fill="var(--tx-3)" text-anchor="middle">' + t + '</text>';
    });
    s += '<text x="' + (padL + pw / 2) + '" y="' + (H - 3) + '" font-size="8.5" fill="var(--tx-3)" text-anchor="middle">训练样本数（对数刻度）</text>';
    s += '<line x1="' + padL + '" y1="' + yOf(0.65) + '" x2="' + (padL + pw) + '" y2="' + yOf(0.65) + '" stroke="var(--tx-3)" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (padL + 4) + '" y="' + (yOf(0.65) - 4) + '" font-size="8" fill="var(--tx-3)">少数类可用线 65%</text>';

    var accPath = '', minPath = '', n, m, x, y1, y2;
    for (n = 50; n <= 5000; n += 50) {
      m = metricsFor(n, state.g);
      x = xOf(n); y1 = yOf(m.acc); y2 = yOf(m.minor);
      accPath += (n === 50 ? 'M' : 'L') + x.toFixed(1) + ' ' + y1.toFixed(1) + ' ';
      minPath += (n === 50 ? 'M' : 'L') + x.toFixed(1) + ' ' + y2.toFixed(1) + ' ';
    }
    s += '<path d="' + accPath + '" fill="none" stroke="var(--acc)" stroke-width="2"/>';
    s += '<path d="' + minPath + '" fill="none" stroke="var(--gold)" stroke-width="2"/>';

    var cur = metricsFor(state.n, state.g), xc = xOf(state.n);
    s += '<line x1="' + xc + '" y1="' + padT + '" x2="' + xc + '" y2="' + (padT + ph) + '" stroke="var(--tx-3)" stroke-dasharray="3 3" opacity=".7"/>';
    s += '<circle cx="' + xc + '" cy="' + yOf(cur.acc) + '" r="4" fill="var(--acc)" stroke="var(--card)" stroke-width="2"/>';
    s += '<circle cx="' + xc + '" cy="' + yOf(cur.minor) + '" r="4" fill="var(--gold)" stroke="var(--card)" stroke-width="2"/>';
    s += '<text x="' + (padL + 8) + '" y="' + (padT + 10) + '" font-size="8" fill="var(--acc)">■ 总准确率</text>';
    s += '<text x="' + (padL + 78) + '" y="' + (padT + 10) + '" font-size="8" fill="var(--gold)">■ 少数类召回</text>';
    svg.innerHTML = s;
  }

  function updateReads() {
    var m = metricsFor(state.n, state.g);
    var conf = probsFor(groups[state.g].parts[state.i], state.n);
    var confMax = Math.max.apply(null, conf);
    var pair = GROUP_DEF[state.g].pair;
    var gap = (1.4 + 10 * (1 - m.acc)).toFixed(1);

    $('r-acc').textContent = (m.acc * 100).toFixed(1) + '%';
    $('r-min').textContent = (m.minor * 100).toFixed(1) + '%';
    $('r-min').className = m.minor >= 0.65 ? '' : 'bad';
    $('r-conf').textContent = CLASSES[pair[0]].name + ' ↔ ' + CLASSES[pair[1]].name + ' · 差 ' + gap + ' 个百分点';
    $('r-conf').style.fontSize = '12px';
    $('n-tag').textContent = 'N = ' + state.n + ' 张';

    var v = $('verdict');
    var ok = m.acc >= 0.80 && m.minor >= 0.65;
    v.className = 'verdict ' + (ok ? 'ok' : 'bad');
    v.innerHTML = ok
      ? '<b>可辅助</b>总准确率 ' + (m.acc * 100).toFixed(1) + '%、少数类召回 ' + (m.minor * 100).toFixed(1) +
        '%，达到上线门槛。单颗粒置信度低于 ' + (confMax * 100).toFixed(0) + '% 的样本仍应转人工复核。'
      : '<b>需人工复核</b>总准确率 ' + (m.acc * 100).toFixed(1) + '%、少数类召回 ' + (m.minor * 100).toFixed(1) +
        '%，白云岩仅占样本 3% 左右，建议补采 800—1,500 颗白云岩与过渡岩性颗粒后再上线。';
  }

  function render() {
    drawSamples();
    drawProbs();
    drawCurve();
    updateReads();
  }

  function schedule() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(function () { raf = false; render(); });
  }

  function bind() {
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      state.g = +b.getAttribute('data-g');
      state.i = 0;
      [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.remove('on'); });
      b.classList.add('on');
      render();
    });
    $('samples').addEventListener('click', function (e) {
      var g = e.target.closest('g[data-i]');
      if (!g) return;
      state.i = +g.getAttribute('data-i');
      render();
    });
    $('s-n').addEventListener('input', function (e) {
      state.n = +e.target.value;
      $('o-n').textContent = state.n;
      schedule();
    });
  }

  buildGroups();
  bind();
  render();
})();
