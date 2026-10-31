/* ======= 三维地震断层自动解释 · 可运行示范 ======= */
(function () {
  'use strict';

  var X0 = 26, X1 = 407, Y0 = 16, Y1 = 182;
  var FAULTS = [
    { id: 'F1', x: 144, score: 0.92, th: 42, manual: true },
    { id: 'F2', x: 244, score: 0.79, th: 26, manual: true },
    { id: 'F3', x: 315, score: 0.63, th: 14, manual: true },
    { id: 'F4', x: 368, score: 0.46, th: 8, manual: false }
  ];
  var state = { thr: 0.60, minThrow: 12 };

  function $(id) { return document.getElementById(id); }
  function rnd(s) {
    var v = Math.sin(s * 12.9898 + 3.71) * 43758.5453;
    return v - Math.floor(v);
  }

  function evaluate() {
    var det = [];
    FAULTS.forEach(function (f, i) {
      if (f.score < state.thr || f.th < state.minThrow) return;
      var dx = (rnd(i * 13.7 + 2.4) - 0.5) * 10;
      det.push({
        f: f, dx: dx,
        err: 3 + (1 - f.score) * 38 + Math.abs(dx) * 0.7,
        manual: f.manual
      });
    });
    var matched = det.filter(function (d) { return d.manual; });
    var fp = det.length - matched.length;
    var missed = 3 - matched.length;
    var overlap = det.length ? matched.length / (3 + fp) * 100 : 0;
    var err = matched.length
      ? matched.reduce(function (a, d) { return a + d.err; }, 0) / matched.length
      : null;
    return { det: det, matched: matched.length, fp: fp, missed: missed, overlap: overlap, err: err };
  }

  function drawSeis(m) {
    var s = '<rect x="0" y="0" width="430" height="210" fill="#0e130d" rx="6"/>';
    s += '<defs><clipPath id="plotclip"><rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0)
      + '" height="' + (Y1 - Y0) + '"/></clipPath>'
      + '<pattern id="traces" width="9" height="9" patternUnits="userSpaceOnUse">'
      + '<line x1="4" y1="0" x2="4" y2="9" stroke="#1c2318" stroke-width="2"/></pattern></defs>';
    s += '<text x="8" y="11" font-size="8.5" fill="#a9b0a0">振幅剖面 · Inline 方向 · 红蓝条带为同相轴</text>';
    s += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0)
      + '" fill="url(#traces)" clip-path="url(#plotclip)"/>';

    var i, t;
    for (i = 0; i < 4; i++) {
      t = Y0 + i / 3 * (Y1 - Y0);
      s += '<line x1="' + X0 + '" y1="' + t.toFixed(1) + '" x2="' + X1 + '" y2="' + t.toFixed(1)
        + '" stroke="#20261b" stroke-width="1"/>';
      s += '<text x="' + (X0 - 4) + '" y="' + (t + 2.5).toFixed(1)
        + '" font-size="8" fill="#7c8474" text-anchor="end">' + (i * 1000) + '</text>';
    }
    s += '<text x="7" y="' + (Y0 + 22) + '" font-size="8" fill="#7c8474" transform="rotate(-90 7 ' + (Y0 + 22) + ')">TWT (ms)</text>';

    for (i = 0; i <= 3; i++) {
      t = X0 + i / 3 * (X1 - X0) - (i === 3 ? 8 : 0);
      s += '<text x="' + t.toFixed(1) + '" y="' + (Y1 + 11) + '" font-size="8" fill="#7c8474" text-anchor="middle">'
        + (i * 2) + ' km</text>';
    }

    FAULTS.forEach(function (f) {
      var w = 6 + f.score * 7;
      s += '<rect x="' + (f.x - w / 2) + '" y="' + Y0 + '" width="' + w + '" height="' + (Y1 - Y0)
        + '" fill="#d0a85c" opacity="' + (0.03 + f.score * 0.05).toFixed(3) + '" clip-path="url(#plotclip)"/>';
    });

    s += '<g clip-path="url(#plotclip)">';
    for (i = 0; i < 24; i++) {
      var pts = [];
      for (var x = X0; x <= X1; x += 2.5) {
        var y = Y0 + 8 + i * 6.1 + 1.5 * Math.sin(x * 0.052 + i * 0.85)
          + 0.55 * Math.sin(x * 0.13 + i * 1.7);
        FAULTS.forEach(function (f) {
          if (x > f.x) y += f.th / 4.25;
        });
        pts.push(x.toFixed(1) + ',' + y.toFixed(1));
      }
      var op = i % 4 === 0 ? 0.50 : 0.30;
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#c3cdb9" stroke-width="'
        + (i % 4 === 0 ? 1.2 : 0.8) + '" opacity="' + op + '"/>';
    }
    s += '</g>';

    FAULTS.forEach(function (f) {
      if (!f.manual) return;
      s += '<line x1="' + f.x + '" y1="' + Y0 + '" x2="' + f.x + '" y2="' + Y1
        + '" stroke="#7fa7cf" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.85"/>';
      s += '<text x="' + (f.x + 3) + '" y="' + (Y0 + 8) + '" font-size="8" fill="#7fa7cf">' + f.th + ' m</text>';
    });

    m.det.forEach(function (d) {
      var x = d.f.x + d.dx;
      var col = d.manual ? '#d0a85c' : '#cf7466';
      s += '<line x1="' + x.toFixed(1) + '" y1="' + Y0 + '" x2="' + x.toFixed(1) + '" y2="' + Y1
        + '" stroke="' + col + '" stroke-width="2"/>';
      s += '<path d="M' + (x - 3).toFixed(1) + ' ' + (Y0 + 2.5) + ' L' + x.toFixed(1) + ' ' + Y0
        + ' L' + (x + 3).toFixed(1) + ' ' + (Y0 + 2.5) + ' Z" fill="' + col + '"/>';
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + (Y1 - 4) + '" r="2.4" fill="' + col + '"/>';
    });

    if (!m.det.length) {
      s += '<text x="' + ((X0 + X1) / 2) + '" y="' + ((Y0 + Y1) / 2)
        + '" font-size="9.5" fill="#cf7466" text-anchor="middle">无断层线通过当前阈值与最小断距</text>';
    }

    s += '<line x1="' + X0 + '" y1="' + (Y1 + 19) + '" x2="' + (X0 + 15) + '" y2="' + (Y1 + 19)
      + '" stroke="#7fa7cf" stroke-width="1.4" stroke-dasharray="4 3"/>';
    s += '<text x="' + (X0 + 20) + '" y="' + (Y1 + 23) + '" font-size="8" fill="#a9b0a0">人工解释</text>';
    s += '<line x1="' + (X0 + 63) + '" y1="' + (Y1 + 19) + '" x2="' + (X0 + 77) + '" y2="' + (Y1 + 19)
      + '" stroke="#d0a85c" stroke-width="2"/>';
    s += '<text x="' + (X0 + 82) + '" y="' + (Y1 + 23) + '" font-size="8" fill="#a9b0a0">模型检出</text>';
    s += '<line x1="' + (X0 + 126) + '" y1="' + (Y1 + 19) + '" x2="' + (X0 + 140) + '" y2="' + (Y1 + 19)
      + '" stroke="#c3cdb9" stroke-width="1.4" opacity="0.6"/>';
    s += '<text x="' + (X0 + 145) + '" y="' + (Y1 + 23) + '" font-size="8" fill="#a9b0a0">同相轴</text>';
    s += '<text x="' + X1 + '" y="' + (Y1 + 23) + '" font-size="8" fill="#7c8474" text-anchor="end">'
      + '阈值 ' + state.thr.toFixed(2) + ' · 最小断距 ' + state.minThrow + ' m</text>';

    $('seis').innerHTML = s;
  }

  function updateStats(m) {
    var n = $('r-n'), e = $('r-err'), o = $('r-ov');
    n.textContent = m.det.length + ' 条';
    n.className = m.det.length >= 3 ? '' : 'warn';
    e.textContent = m.err === null ? '—' : m.err.toFixed(0) + ' m';
    e.className = m.err === null ? 'bad' : m.err <= 20 ? '' : 'warn';
    o.textContent = m.overlap.toFixed(0) + '%';
    o.className = m.overlap === 100 ? '' : m.overlap >= 67 ? 'warn' : 'bad';

    var v = $('verdict');
    if (m.det.length === 0) {
      v.className = 'verdict bad';
      v.innerHTML = '<b>漏检</b>当前阈值下没有断层线通过筛选，三条人工解释断层全部丢失。';
    } else if (m.missed > 0) {
      v.className = 'verdict bad';
      v.innerHTML = '<b>漏检</b>漏掉 ' + m.missed + ' 条人工解释断层（共 3 条），重合率 '
        + m.overlap.toFixed(0) + '%。建议降低检测阈值或放宽最小断距。';
    } else if (m.fp > 0) {
      v.className = 'verdict warn';
      v.innerHTML = '<b>误检</b>在无人工解释处多检出 ' + m.fp
        + ' 条线（多为断距小于地震调谐厚度的小断层），重合率 ' + m.overlap.toFixed(0) + '%。';
    } else {
      v.className = 'verdict ok';
      v.innerHTML = '<b>可用</b>三条人工解释断层全部检出，无多余断层线；平均位置误差 '
        + (m.err === null ? '—' : m.err.toFixed(0) + ' m') + '，可进入人工质检。';
    }
  }

  var pending = false;
  function render() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var m = evaluate();
      drawSeis(m);
      updateStats(m);
      $('o-thr').textContent = state.thr.toFixed(2);
      $('o-throw').textContent = state.minThrow + ' m';
      $('mode-tag').textContent = '概率阈值 ' + state.thr.toFixed(2);
    });
  }

  function bind() {
    $('s-thr').addEventListener('input', function (e) {
      state.thr = +e.target.value;
      render();
    });
    $('s-throw').addEventListener('input', function (e) {
      state.minThrow = +e.target.value;
      render();
    });
  }

  bind();
  render();
})();
