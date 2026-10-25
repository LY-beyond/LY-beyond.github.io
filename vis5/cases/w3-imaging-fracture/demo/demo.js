/* ======= 成像测井裂缝智能识别 · 可运行示范 ======= */
(function () {
  'use strict';

  var state = { dip: 45, den: 2.5, cov: 85 };
  var D0 = 3320, D1 = 3325;
  var raf = false;

  function $(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rnd(s) {
    var v = Math.sin(s * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }
  function errAt(dip, covFrac) {
    var e = 2.2 + 4.6 * Math.exp(-dip / 10) + 3.6 * Math.exp(-(90 - dip) / 12);
    return e * (1 + (1 - covFrac) * 1.6);
  }
  function recallAt(dip) {
    return 0.95 - 0.22 * Math.pow((dip - 45) / 45, 2);
  }

  function fractureList() {
    var count = Math.max(2, Math.round(state.den * (D1 - D0)));
    var cov = state.cov / 100, rec = recallAt(state.dip), list = [];
    for (var j = 0; j < count; j++) {
      var seed = j * 3.717 + 1.3;
      list.push({
        seed: seed,
        y0: j,
        phase: (j * 137.508) % 360,
        detected: rnd(seed) < cov * rec
      });
    }
    return list;
  }

  function sinePath(y0, amp, phase, L, Wp) {
    var d = '', i, x, y, t, ang;
    for (i = 0; i <= 60; i++) {
      t = i / 60;
      x = L + t * Wp;
      ang = t * Math.PI * 2 + phase * Math.PI / 180;
      y = y0 + amp * Math.cos(ang);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    return d;
  }

  function axisMarkup(L, T, Wp, Hp) {
    var s = '', i, x, y, az, dep;
    for (i = 0; i <= 4; i++) {
      x = L + Wp * i / 4;
      az = i * 90;
      s += '<line x1="' + x + '" y1="' + T + '" x2="' + x + '" y2="' + (T + Hp) + '" stroke="var(--line)" stroke-width=".7"/>';
      s += '<text x="' + x + '" y="' + (T - 8) + '" font-size="9.5" fill="var(--tx-3)" text-anchor="middle">' + az + '°</text>';
    }
    for (i = 0; i <= 5; i++) {
      y = T + Hp * i / 5;
      dep = D0 + i;
      s += '<line x1="' + L + '" y1="' + y + '" x2="' + (L + Wp) + '" y2="' + y + '" stroke="var(--line)" stroke-width=".7"/>';
      s += '<text x="' + (L - 8) + '" y="' + (y + 3.5) + '" font-size="9" fill="var(--tx-3)" text-anchor="end">' + dep + ' m</text>';
    }
    s += '<text x="' + (L + Wp / 2) + '" y="' + (T - 22) + '" font-size="10" fill="var(--tx-2)" text-anchor="middle">方位角 (°)</text>';
    s += '<text x="' + (L - 40) + '" y="' + (T + Hp / 2) + '" font-size="10" fill="var(--tx-2)" text-anchor="middle" transform="rotate(-90 ' + (L - 40) + ' ' + (T + Hp / 2) + ')">井深 (m)</text>';
    return s;
  }

  function fractureMarkup(L, T, Wp, Hp, list) {
    var s = '', count = list.length, spacing = Hp / count;
    var dipRad = state.dip * Math.PI / 180;
    var amp = Math.min(Hp * 6, Hp * 0.30 * Math.tan(dipRad) / Math.tan(Math.PI / 3));
    var cov = state.cov / 100;
    list.forEach(function (f, j) {
      var y0 = T + spacing * (j + 0.5);
      var op = 0.55 + 0.4 * rnd(f.seed + 2.1);
      s += '<path d="' + sinePath(y0, amp, f.phase, L, Wp) + '" fill="none" stroke="var(--gold)" stroke-width="1.5" opacity="' + op.toFixed(2) + '"/>';
      if (f.detected) {
        var estAmp = Math.min(Hp * 6, Hp * 0.30 * Math.tan(clamp(state.dip + (rnd(f.seed + 4.4) - 0.5) * 4, 0, 89) * Math.PI / 180) / Math.tan(Math.PI / 3));
        s += '<path d="' + sinePath(y0, estAmp, f.phase + (rnd(f.seed + 6.2) - 0.5) * 8, L, Wp) + '" fill="none" stroke="var(--acc)" stroke-width="1" stroke-dasharray="4 3" opacity=".72"/>';
      }
    });
    var boxIdx = [Math.floor(count * 0.22), Math.floor(count * 0.52), Math.floor(count * 0.8)];
    boxIdx.forEach(function (j, k) {
      if (j >= count || !list[j].detected) return;
      var by = T + spacing * (j + 0.5) - 24;
      s += '<rect x="' + (L + Wp * 0.34) + '" y="' + by + '" width="118" height="48" rx="3" fill="none" stroke="var(--acc)" stroke-width="1" stroke-dasharray="4 3"/>';
      if (k === 0) {
        s += '<text x="' + (L + Wp * 0.34 + 4) + '" y="' + (by - 4) + '" font-size="8.5" fill="var(--acc)">检测框</text>';
      }
    });
    var missed = 0;
    list.forEach(function (f, j) {
      if (f.detected || missed >= 2 || j % 5 !== 0) return;
      missed += 1;
      s += '<text x="' + (L + 14) + '" y="' + (T + spacing * (j + 0.5) + 3) + '" font-size="8.5" fill="var(--bad)">漏检</text>';
    });
    if (cov < 0.999) {
      var x0 = L + Wp * cov;
      s += '<rect x="' + x0 + '" y="' + T + '" width="' + (L + Wp - x0) + '" height="' + Hp + '" fill="#080c08" opacity=".93"/>';
      for (var h = 0; h < 14; h++) {
        s += '<line x1="' + (x0 + h * 9) + '" y1="' + (T + Hp) + '" x2="' + (x0 + h * 9 + 24) + '" y2="' + (T + Hp - 24) + '" stroke="#39402f" stroke-width=".6" opacity=".6"/>';
      }
      s += '<text x="' + ((x0 + L + Wp) / 2) + '" y="' + (T + Hp / 2) + '" font-size="9" fill="var(--tx-3)" text-anchor="middle">无覆盖</text>';
      s += '<text x="' + ((x0 + L + Wp) / 2) + '" y="' + (T + Hp / 2 + 12) + '" font-size="8.5" fill="var(--tx-3)" text-anchor="middle">' + Math.round((1 - cov) * 360) + '°</text>';
    }
    return s;
  }

  function drawImage() {
    var svg = $('img');
    var W = 760, H = 430, L = 64, T = 44, Wp = 674, Hp = 348;
    var list = fractureList();
    var s = '<defs><clipPath id="plotClip"><rect x="' + L + '" y="' + T + '" width="' + Wp + '" height="' + Hp + '"/></clipPath></defs>';
    s += '<text x="18" y="24" font-size="10.5" fill="var(--tx-2)">电成像展开图 · 深度拉伸显示</text>';
    s += '<text x="742" y="24" font-size="9" fill="var(--tx-3)" text-anchor="end">方位 64 扇区 · 采样 0.0025 m</text>';
    s += '<rect x="' + L + '" y="' + T + '" width="' + Wp + '" height="' + Hp + '" fill="#0e1410" stroke="var(--line-2)"/>';
    var i, x, y;
    for (i = 0; i < 150; i++) {
      x = L + rnd(i * 1.7) * Wp;
      y = T + rnd(i * 2.9 + 4) * Hp;
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (0.5 + rnd(i) * 0.9).toFixed(1) + '" fill="#3b4a36" opacity=".5"/>';
    }
    for (i = 0; i < 8; i++) {
      y = T + Hp * (0.06 + i * 0.118);
      s += '<line x1="' + L + '" y1="' + y + '" x2="' + (L + Wp) + '" y2="' + y + '" stroke="#55614e" stroke-width=".7" opacity=".45"/>';
    }
    s += axisMarkup(L, T, Wp, Hp);
    s += '<g clip-path="url(#plotClip)">' + fractureMarkup(L, T, Wp, Hp, list) + '</g>';
    s += '<rect x="' + L + '" y="' + T + '" width="' + Wp + '" height="' + Hp + '" fill="none" stroke="var(--line-2)"/>';
    s += '<text x="' + (L + 8) + '" y="' + (T + Hp + 20) + '" font-size="9" fill="var(--tx-3)">检出 ' + list.filter(function (f) { return f.detected; }).length + ' / ' + list.length + ' 条</text>';
    s += '<text x="' + (L + Wp) + '" y="' + (T + Hp + 20) + '" font-size="9" fill="var(--tx-3)" text-anchor="end">盲区 ' + Math.round((1 - state.cov / 100) * 360) + '°，密度按有效覆盖归一</text>';
    svg.innerHTML = s;
  }

  function drawCurve() {
    var svg = $('curve');
    var W = 760, H = 200, L = 58, T = 30, R = 736, B = 158;
    var pw = R - L, ph = B - T;
    function xOf(d) { return L + d / 90 * pw; }
    function yOf(e) { return B - clamp(e, 0, 8) / 8 * ph; }
    var s = '<text x="14" y="18" font-size="9.5" fill="var(--tx-3)">倾角误差 (°)</text>';
    var v, d;
    for (v = 0; v <= 8.0001; v += 2) {
      s += '<line x1="' + L + '" y1="' + yOf(v) + '" x2="' + R + '" y2="' + yOf(v) + '" stroke="var(--line)"/>';
      s += '<text x="' + (L - 8) + '" y="' + (yOf(v) + 3.5) + '" font-size="9" fill="var(--tx-3)" text-anchor="end">' + v + '</text>';
    }
    for (d = 0; d <= 90; d += 15) {
      s += '<text x="' + xOf(d) + '" y="' + (B + 16) + '" font-size="9" fill="var(--tx-3)" text-anchor="middle">' + d + '</text>';
    }
    s += '<rect x="' + L + '" y="' + T + '" width="' + (xOf(10) - L) + '" height="' + ph + '" fill="var(--bad)" opacity=".07"/>';
    s += '<rect x="' + xOf(80) + '" y="' + T + '" width="' + (R - xOf(80)) + '" height="' + ph + '" fill="var(--bad)" opacity=".07"/>';
    s += '<text x="' + (xOf(5)) + '" y="' + (T + 12) + '" font-size="8.5" fill="var(--bad)" text-anchor="middle">低角度</text>';
    s += '<text x="' + (xOf(85)) + '" y="' + (T + 12) + '" font-size="8.5" fill="var(--bad)" text-anchor="middle">近垂直</text>';
    s += '<line x1="' + L + '" y1="' + yOf(4) + '" x2="' + R + '" y2="' + yOf(4) + '" stroke="var(--tx-3)" stroke-dasharray="4 3"/>';
    s += '<text x="' + (L + 6) + '" y="' + (yOf(4) - 5) + '" font-size="8.5" fill="var(--tx-3)">可用门槛 4°</text>';

    var path = '', dip;
    for (dip = 0; dip <= 90; dip += 1) {
      path += (dip === 0 ? 'M' : 'L') + xOf(dip).toFixed(1) + ' ' + yOf(errAt(dip, state.cov / 100)).toFixed(1) + ' ';
    }
    s += '<path d="' + path + '" fill="none" stroke="var(--acc)" stroke-width="2"/>';
    var e = errAt(state.dip, state.cov / 100);
    s += '<line x1="' + xOf(state.dip) + '" y1="' + T + '" x2="' + xOf(state.dip) + '" y2="' + B + '" stroke="var(--tx-3)" stroke-dasharray="3 3" opacity=".7"/>';
    s += '<circle cx="' + xOf(state.dip) + '" cy="' + yOf(e) + '" r="4.5" fill="var(--acc)" stroke="var(--card)" stroke-width="2"/>';
    s += '<text x="' + (xOf(state.dip) + 8) + '" y="' + (yOf(e) - 7) + '" font-size="9" fill="var(--acc)" font-family="var(--mono)">±' + e.toFixed(1) + '°</text>';
    s += '<text x="' + ((L + R) / 2) + '" y="' + (H - 4) + '" font-size="9.5" fill="var(--tx-3)" text-anchor="middle">真实倾角 (°)</text>';
    svg.innerHTML = s;
  }

  function updateReads() {
    var list = fractureList();
    var det = list.filter(function (f) { return f.detected; }).length;
    var err = errAt(state.dip, state.cov / 100);
    var agr = clamp(100 - err * 3.8 - (1 - state.cov / 100) * 35 - (state.dip < 12 ? 4 : 0), 40, 98);
    var ok = agr >= 82 && err <= 4;

    $('r-num').textContent = det + ' 条';
    $('r-err').textContent = '±' + err.toFixed(1) + '°';
    $('r-agr').textContent = agr.toFixed(1) + '%';
    $('r-cov').textContent = state.cov + '%';
    $('r-err').className = err > 6 ? 'bad' : (err > 4 ? 'gold' : '');
    $('r-agr').className = agr < 82 ? 'bad' : '';
    $('r-cov').className = state.cov < 70 ? 'gold' : '';
    $('cov-tag').textContent = '井壁覆盖 ' + state.cov + '%';
    $('curve-tag').textContent = '覆盖率 ' + state.cov + '%';

    var v = $('verdict');
    v.className = 'verdict ' + (ok ? 'ok' : 'bad');
    v.innerHTML = ok
      ? '<b>可用</b>倾角误差 ±' + err.toFixed(1) + '°、与人工解释一致率 ' + agr.toFixed(1) +
        '%，满足生产门限；' + Math.round((1 - state.cov / 100) * 360) + '° 盲区已单独标注，密度按有效覆盖归一。'
      : '<b>需复核</b>倾角误差 ±' + err.toFixed(1) + '°、一致率 ' + agr.toFixed(1) +
        '%；' + (state.cov < 80 ? '井壁覆盖不足，盲区外推风险高；' : '') +
        (state.dip < 12 || state.dip > 80 ? '近水平或近垂直裂缝的正弦拟合不稳定；' : '') +
        '建议逐条人工确认后再用于裂缝建模。';
  }

  function render() {
    drawImage();
    drawCurve();
    updateReads();
  }

  function schedule() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(function () { raf = false; render(); });
  }

  function bind() {
    $('s-dip').addEventListener('input', function (e) {
      state.dip = +e.target.value;
      $('o-dip').textContent = state.dip + '°';
      schedule();
    });
    $('s-den').addEventListener('input', function (e) {
      state.den = +e.target.value;
      $('o-den').textContent = state.den.toFixed(1) + ' 条/m';
      schedule();
    });
    $('s-cov').addEventListener('input', function (e) {
      state.cov = +e.target.value;
      $('o-cov').textContent = state.cov + '%';
      schedule();
    });
  }

  bind();
  render();
})();
