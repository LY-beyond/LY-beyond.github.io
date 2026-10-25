/* ======= 井下复杂事故前兆智能预警 · 可运行示范 ======= */
(function () {
  'use strict';

  var N = 241, EVENT = 150, PRE = 128, BASE_FROM = 20, BASE_TO = 100, SCAN_FROM = 110;
  var CH = [
    { key: 'spp', name: '立压', unit: 'MPa', color: '#78b7a8' },
    { key: 'tor', name: '扭矩', unit: 'kN·m', color: '#d0a85c' },
    { key: 'flow', name: '出口流量', unit: 'L/s', color: '#7fa7cf' }
  ];
  var raw = [];
  var score = [];
  var base = {};
  var state = { thr: 3.2, lead: 12 };

  function $(id) { return document.getElementById(id); }
  function rnd(s) {
    var v = Math.sin(s * 12.9898 + 4.117) * 43758.5453;
    return v - Math.floor(v);
  }
  function gauss(s) {
    return (rnd(s) + rnd(s + 0.7) + rnd(s + 1.9) + rnd(s + 3.3) - 2) / 1.2;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function build() {
    for (var t = 0; t < N; t++) {
      var spp = 18.2 + 0.22 * Math.sin(t / 9) + 0.16 * gauss(t * 1.13);
      var tor = 8.1 + 0.12 * Math.sin(t / 7 + 1) + 0.10 * gauss(t * 2.31);
      var flow = 32.2 + 0.20 * Math.sin(t / 11 + 2) + 0.22 * gauss(t * 3.73);
      if (t >= 38 && t <= 40) { tor += 0.38; flow -= 0.18; }
      if (t >= 74 && t <= 76) { tor += 0.33; flow -= 0.15; }
      if (t >= 96 && t <= 98) { tor += 0.42; flow -= 0.20; }
      if (t >= PRE) {
        var r = Math.min(1, (t - PRE) / 14);
        tor += 0.65 * r + 0.035 * (t - PRE);
        spp += 0.45 * r;
        flow -= 0.55 * r;
      }
      if (t >= EVENT) {
        var d = t - EVENT;
        tor += 4.2 * (1 - Math.exp(-d / 4));
        spp += 1.8 * (1 - Math.exp(-d / 6));
        flow -= 4.6 * (1 - Math.exp(-d / 5));
      }
      raw.push({ spp: spp, tor: tor, flow: flow });
    }
    CH.forEach(function (c) {
      var sum = 0, sum2 = 0, n = 0, t;
      for (t = BASE_FROM; t <= BASE_TO; t++) { sum += raw[t][c.key]; sum2 += raw[t][c.key] * raw[t][c.key]; n++; }
      var mean = sum / n;
      var std = Math.sqrt(Math.max(1e-6, sum2 / n - mean * mean));
      base[c.key] = { mean: mean, std: std };
    });
    for (t = 0; t < N; t++) {
      var z2 = 0;
      CH.forEach(function (c) {
        var z = clamp((raw[t][c.key] - base[c.key].mean) / base[c.key].std, -8, 8);
        z2 += z * z;
      });
      score.push(Math.sqrt(z2 / CH.length));
    }
    var smooth = score.slice();
    for (t = 1; t < N - 1; t++) smooth[t] = (score[t - 1] + score[t] + score[t + 1]) / 3;
    score = smooth;
  }

  function scan(from, to, thr) {
    var out = [], above = false, start = 0, t;
    for (t = from; t < to; t++) {
      if (!above && score[t] >= thr) { above = true; start = t; }
      else if (above && score[t] < thr - 0.35) {
        above = false;
        if (t - start >= 2) out.push(start);
      }
    }
    if (above && to - start >= 2) out.push(start);
    return out;
  }

  function evaluate() {
    var episodes = scan(SCAN_FROM, N, state.thr);
    var falseAlarms = scan(20, SCAN_FROM, state.thr).length;
    var first = episodes.length ? episodes[0] : null;
    var lead = first === null ? null : EVENT - first;
    var timely = lead !== null && lead >= state.lead;
    return { first: first, lead: lead, timely: timely, fa: falseAlarms, episodes: episodes };
  }

  function yOf(v) {
    return 28 + (100 - v) / 100 * 272;
  }
  function xOf(t) {
    return 44 + t / 240 * 686;
  }

  function drawChart(m) {
    var s = '<rect x="0" y="0" width="760" height="360" fill="#0e130d" rx="6"/>';
    s += '<text x="14" y="18" font-size="10" fill="#a9b0a0">三通道归一化幅值（基线 ±4σ → 0—100）· 时间 min</text>';

    var i, v, y;
    for (i = 0; i <= 5; i++) {
      v = i * 20;
      y = yOf(v);
      s += '<line x1="44" y1="' + y.toFixed(1) + '" x2="730" y2="' + y.toFixed(1) + '" stroke="#20261b"/>';
      s += '<text x="38" y="' + (y + 3).toFixed(1) + '" font-size="9" fill="#7c8474" text-anchor="end">' + v + '</text>';
    }
    s += '<rect x="44" y="' + yOf(75).toFixed(1) + '" width="686" height="' + (yOf(25) - yOf(75)).toFixed(1)
      + '" fill="#20261b" opacity="0.55"/>';
    s += '<line x1="44" y1="' + yOf(75).toFixed(1) + '" x2="730" y2="' + yOf(75).toFixed(1)
      + '" stroke="#7c8474" stroke-width="0.8" stroke-dasharray="4 4" opacity="0.6"/>';
    s += '<text x="50" y="' + (yOf(75) - 4).toFixed(1) + '" font-size="8.5" fill="#7c8474">基线 ±2σ</text>';

    for (i = 0; i <= 8; i++) {
      s += '<text x="' + xOf(i * 30).toFixed(1) + '" y="' + (300 + 16) + '" font-size="9" fill="#7c8474" text-anchor="middle">'
        + (i * 30) + '</text>';
    }
    s += '<text x="730" y="' + (300 + 30) + '" font-size="9" fill="#7c8474" text-anchor="end">时间 (min)</text>';

    if (m.lead !== null && m.lead > 0) {
      var xa = xOf(EVENT - state.lead), xb = xOf(EVENT);
      s += '<rect x="' + xa.toFixed(1) + '" y="28" width="' + (xb - xa).toFixed(1) + '" height="272" fill="#d0a85c" opacity="0.07"/>';
      s += '<text x="' + ((xa + xb) / 2).toFixed(1) + '" y="42" font-size="8.5" fill="#d0a85c" text-anchor="middle">目标预警窗口</text>';
    }

    CH.forEach(function (c) {
      var pts = [], t;
      for (t = 0; t < N; t++) {
        var val = clamp(50 + (raw[t][c.key] - base[c.key].mean) / base[c.key].std * 12.5, 3, 97);
        pts.push(xOf(t).toFixed(1) + ',' + yOf(val).toFixed(1));
      }
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + c.color + '" stroke-width="1.5" opacity="0.9"/>';
    });

    s += '<line x1="' + xOf(PRE).toFixed(1) + '" y1="28" x2="' + xOf(PRE).toFixed(1) + '" y2="300" stroke="#d0a85c" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<text x="' + (xOf(PRE) + 4).toFixed(1) + '" y="' + (28 + 30) + '" font-size="9" fill="#d0a85c">前兆 128</text>';
    s += '<line x1="' + xOf(EVENT).toFixed(1) + '" y1="28" x2="' + xOf(EVENT).toFixed(1) + '" y2="300" stroke="#cf7466" stroke-width="1.8"/>';
    s += '<text x="' + (xOf(EVENT) + 5).toFixed(1) + '" y="' + (28 + 46) + '" font-size="9" fill="#cf7466">卡钻 150</text>';

    if (m.first !== null) {
      s += '<line x1="' + xOf(m.first).toFixed(1) + '" y1="28" x2="' + xOf(m.first).toFixed(1) + '" y2="300" stroke="#e8e3d5" stroke-width="1.5" opacity="0.9"/>';
      s += '<circle cx="' + xOf(m.first).toFixed(1) + '" cy="28" r="3.5" fill="#e8e3d5"/>';
      s += '<text x="' + (xOf(m.first) + 5).toFixed(1) + '" y="' + (28 + 62) + '" font-size="9" fill="#e8e3d5">'
        + (m.first <= EVENT ? '首次报警 ' + m.first : '报警 ' + m.first) + '</text>';
    }

    var lx = 50, ly = 300 + 32;
    CH.forEach(function (c, k) {
      s += '<line x1="' + (lx + k * 128) + '" y1="' + ly + '" x2="' + (lx + 20 + k * 128) + '" y2="' + ly
        + '" stroke="' + c.color + '" stroke-width="2"/>';
      s += '<text x="' + (lx + 25 + k * 128) + '" y="' + (ly + 4) + '" font-size="9.5" fill="#a9b0a0">' + c.name + '</text>';
    });
    s += '<line x1="50" y1="' + (ly + 18) + '" x2="70" y2="' + (ly + 18) + '" stroke="#cf7466" stroke-width="1.8"/>';
    s += '<text x="75" y="' + (ly + 22) + '" font-size="9.5" fill="#a9b0a0">事故时刻</text>';
    s += '<line x1="150" y1="' + (ly + 18) + '" x2="170" y2="' + (ly + 18) + '" stroke="#e8e3d5" stroke-width="1.5"/>';
    s += '<text x="175" y="' + (ly + 22) + '" font-size="9.5" fill="#a9b0a0">首次报警</text>';

    $('chart').innerHTML = s;
  }

  function updateStats(m) {
    var f = $('r-first'), l = $('r-lead'), fa = $('r-fa');
    f.textContent = m.first === null ? '—' : m.first + ' min';
    f.className = m.first === null ? 'bad' : '';
    if (m.lead === null) {
      l.textContent = '—';
      l.className = 'bad';
    } else if (m.lead >= 0) {
      l.textContent = m.lead + ' min';
      l.className = m.timely ? '' : 'warn';
    } else {
      l.textContent = '事故后 ' + (-m.lead) + ' min';
      l.className = 'bad';
    }
    fa.textContent = m.fa + ' 次';
    fa.className = m.fa === 0 ? '' : m.fa <= 2 ? 'warn' : 'bad';

    var v = $('verdict');
    if (m.first === null) {
      v.className = 'verdict warn';
      v.innerHTML = '<b>安全</b>当前阈值下未触发任何报警；本次卡钻前兆未被检出（漏报），建议把阈值下调到 3.0 以下再评估。';
    } else if (m.timely) {
      v.className = 'verdict warn';
      v.innerHTML = '<b>预警</b>提前 ' + m.lead + ' 分钟报警，满足 ' + state.lead
        + ' 分钟目标；120 min 前累计误报 ' + m.fa + ' 次' + (m.fa > 2 ? '，偏高，需检查传感器零点。' : '。');
    } else {
      v.className = 'verdict bad';
      v.innerHTML = '<b>报警</b>首次报警' + (m.lead >= 0 ? '仅提前 ' + m.lead : '晚于事故 ' + (-m.lead))
        + ' 分钟，未达到 ' + state.lead + ' 分钟目标，司钻来不及处置。';
    }
  }

  var pending = false;
  function render() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var m = evaluate();
      drawChart(m);
      updateStats(m);
      $('o-thr').textContent = state.thr.toFixed(1);
      $('o-lead').textContent = state.lead + ' min';
      $('mode-tag').textContent = '阈值 ' + state.thr.toFixed(1) + 'σ';
    });
  }

  function bind() {
    $('s-thr').addEventListener('input', function (e) {
      state.thr = +e.target.value;
      render();
    });
    $('s-lead').addEventListener('input', function (e) {
      state.lead = +e.target.value;
      render();
    });
  }

  build();
  bind();
  render();
})();
