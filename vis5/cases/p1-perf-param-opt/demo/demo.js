/* ======= 射孔参数智能优化 · 可运行示范 ======= */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const PHASES = [60, 90, 120, 180];
  const DEFAULTS = { d: 16, ph: 90, dp: 450, perm: 18, optimal: false };
  let st = { d: 16, ph: 90, dp: 450, perm: 18, optimal: false };

  function calc(s) {
    s = s || st;
    const densF = Math.pow(s.d / 16, 0.35);
    const depF = Math.pow(s.dp / 450, 0.30);
    const phF = { 60: 1.07, 90: 1.00, 120: 0.95, 180: 0.87 }[s.ph];
    const permF = 0.72 + 0.18 * Math.log10(s.perm * 10);
    const skin = 4.2 + 0.11 * s.d + 0.0022 * s.dp + (s.ph === 180 ? 1.4 : 0);
    const pi = 1.25 * densF * depF * phF * permF * (1 - skin / 45);
    const cost = (800 + 55 * s.d + 1.8 * s.dp) * 10 / 10000;
    return { pi: pi, skin: skin, cost: cost };
  }

  function draw(c) {
    const W = 430, H = 256;
    const cx = 116, cy = 136;
    const len = 16 + (st.dp - 200) / 600 * 28;
    let g = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#eef2ec" rx="6"/>';
    g += '<rect x="8" y="12" width="216" height="226" rx="7" fill="#e6ece3" stroke="#d1d8cc"/>';
    g += '<text x="18" y="28" font-size="9" fill="#878374">地层 · 渗透率 ' + st.perm + ' mD</text>';
    g += '<text x="18" y="40" font-size="8" fill="#8a8f7f">横截面（俯视井眼）</text>';

    g += '<circle cx="' + cx + '" cy="' + cy + '" r="56" fill="#bfc7bd" stroke="#afb9ab" stroke-width="1"/>';
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="47" fill="#9fa79c" stroke="#84907a" stroke-width="1.2"/>';
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="40" fill="#ecf0e9" stroke="#84907a" stroke-width="1"/>';

    const n = 360 / st.ph;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + k * 2 * Math.PI / n;
      const x1 = cx + Math.cos(a) * 47, y1 = cy + Math.sin(a) * 47;
      const x2 = cx + Math.cos(a) * (47 + len), y2 = cy + Math.sin(a) * (47 + len);
      g += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + (st.optimal ? '#91680f' : '#a37b2f') + '" stroke-width="' + (st.optimal ? 3 : 2.5) + '" stroke-linecap="round" opacity=".92"/>';
      g += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="3.2" fill="' + (st.optimal ? '#91680f' : '#a37b2f') + '"/>';
    }
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (47 + len + 6) + '" fill="none" stroke="#a37b2f" stroke-width=".8" stroke-dasharray="3 4" opacity=".5"/>';
    g += '<text x="' + (cx + 62) + '" y="' + (cy + 58) + '" font-size="8" fill="#878374">套管</text>';
    g += '<text x="' + (cx + 34) + '" y="' + (cy - 54) + '" font-size="8" fill="#878374">水泥环</text>';
    g += '<text x="' + (cx + 66) + '" y="' + (cy - 76) + '" font-size="8" fill="#a37b2f">孔道</text>';
    g += '<text x="10" y="250" font-size="8.5" fill="#4b4636">相位角 ' + st.ph + '° · ' + n + ' 条孔道 · 穿深 ' + st.dp + ' mm</text>';

    const sx = 238;
    g += '<text x="' + sx + '" y="28" font-size="9" fill="#878374">1 m 井段展开</text>';
    g += '<text x="' + sx + '" y="40" font-size="8" fill="#8a8f7f">金色圆点 = 射孔孔眼</text>';
    g += '<rect x="' + sx + '" y="48" width="110" height="152" rx="6" fill="#e6ece3" stroke="#d1d8cc"/>';
    const rows = Math.ceil(st.d / 3);
    for (let i = 0; i < st.d; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const px = sx + 27 + col * 28;
      const py = 62 + row * (128 / Math.max(rows, 1));
      g += '<circle cx="' + px + '" cy="' + py.toFixed(1) + '" r="3" fill="' + (st.optimal ? '#91680f' : '#a37b2f') + '"/>';
    }
    g += '<text x="' + (sx + 4) + '" y="59" font-size="7.5" fill="#8a8f7f">0 m</text>';
    g += '<text x="' + (sx + 4) + '" y="212" font-size="7.5" fill="#8a8f7f">1.0 m</text>';
    g += '<text x="' + (sx + 55) + '" y="212" font-size="9" fill="#4b4636" text-anchor="middle">' + st.d + ' 孔 / m</text>';
    g += '<text x="' + sx + '" y="226" font-size="7.5" fill="#878374">PI ∝ 孔密^0.35 × 穿深^0.30 × 相位系数</text>';
    if (st.optimal) {
      g += '<text x="' + (sx + 55) + '" y="240" font-size="8" fill="#91680f" text-anchor="middle">★ 自动寻优组合</text>';
    }
    $('perf').innerHTML = g;
    return c;
  }

  function update() {
    const c = calc();
    draw(c);
    $('r-pi').textContent = c.pi.toFixed(2);
    $('r-skin').textContent = c.skin.toFixed(1);
    $('r-cost').innerHTML = c.cost.toFixed(2) + ' <small>万元</small>';
    const stEl = $('status');
    if (c.pi >= 1.38 && c.skin <= 8.0 && c.cost <= 3.0) {
      stEl.className = 'status ok';
      stEl.innerHTML = '<b>方案最优</b><span>产能指数 ' + c.pi.toFixed(2) + '，压实带表皮 ' + c.skin.toFixed(1) +
        '，成本 ' + c.cost.toFixed(2) + ' 万元/10 m，三项约束同时满足。</span>';
    } else if (c.pi >= 1.18) {
      stEl.className = 'status warn';
      stEl.innerHTML = '<b>可接受</b><span>产能指数 ' + c.pi.toFixed(2) +
        '，但未同时达到「指数 ≥ 1.38、表皮 ≤ 8、成本 ≤ 3.0」的最优条件，仍有优化空间。</span>';
    } else {
      stEl.className = 'status bad';
      stEl.innerHTML = '<b>不经济</b><span>产能指数仅 ' + c.pi.toFixed(2) +
        '，孔密/穿深不足以穿透污染带，或相位与储层条件不匹配。建议先做自动寻优再比选。</span>';
    }
  }

  function optimize() {
    let best = null, bestObj = -Infinity;
    for (let d = 8; d <= 24; d += 2) {
      for (let p = 0; p < PHASES.length; p++) {
        for (let dp = 200; dp <= 800; dp += 50) {
          const c = calc({ d: d, ph: PHASES[p], dp: dp, perm: st.perm });
          const obj = c.pi / Math.sqrt(c.cost) - Math.max(0, c.cost - 3) * 0.4 - Math.max(0, c.skin - 8) * 0.05;
          if (obj > bestObj) {
            bestObj = obj;
            best = { d: d, ph: PHASES[p], dp: dp };
          }
        }
      }
    }
    st.d = best.d;
    st.ph = best.ph;
    st.dp = best.dp;
    st.optimal = true;
    sync();
    update();
  }

  function sync() {
    $('s-d').value = st.d;
    $('s-ph').value = String(st.ph);
    $('s-dp').value = st.dp;
    $('s-k').value = st.perm;
    $('o-d').textContent = st.d;
    $('o-ph').textContent = st.ph + '°';
    $('o-dp').textContent = st.dp + ' mm';
    $('o-k').textContent = st.perm + ' mD';
  }

  $('s-d').addEventListener('input', function (e) {
    st.d = +e.target.value; st.optimal = false; $('o-d').textContent = st.d; update();
  });
  $('s-ph').addEventListener('change', function (e) {
    st.ph = +e.target.value; st.optimal = false; $('o-ph').textContent = st.ph + '°'; update();
  });
  $('s-dp').addEventListener('input', function (e) {
    st.dp = +e.target.value; st.optimal = false; $('o-dp').textContent = st.dp + ' mm'; update();
  });
  $('s-k').addEventListener('input', function (e) {
    st.perm = +e.target.value; st.optimal = false; $('o-k').textContent = st.perm + ' mD'; update();
  });
  $('btn-opt').addEventListener('click', optimize);
  $('btn-reset').addEventListener('click', function () {
    st = Object.assign({}, DEFAULTS);
    sync();
    update();
  });

  sync();
  update();
})();
