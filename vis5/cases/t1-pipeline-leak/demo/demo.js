/* ======= 输油管道泄漏智能检测与定位 · 可运行示范 ======= */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const D_KM = 96, V = 1100, T = 240, DT = 0.2, T0 = 50;
  const DEFAULTS = { thr: 0.12, pos: 48, leak: 2.0, dist: false };
  let st = { thr: 0.12, pos: 48, leak: 2.0, dist: false };

  function simulate() {
    const n = Math.round(T / DT) + 1;
    const p = new Float64Array(n), q = new Float64Array(n);
    const amp = 0.04 + 0.08 * st.leak;
    const ampUp = amp * (1 - 0.45 * st.pos / D_KM);
    const ampDown = amp * (1 - 0.20 * st.pos / D_KM);
    const tUp = T0 + st.pos * 1000 / V;
    const tDown = T0 + (D_KM - st.pos) * 1000 / V;
    for (let i = 0; i < n; i++) {
      const t = i * DT;
      let pv = 8.2 + 0.004 * Math.sin(t * 0.7) + 0.002 * Math.sin(t * 2.3);
      let qv = 1200 + 5 * Math.sin(t * 0.4 + 0.5) + 2 * Math.sin(t * 1.9);
      if (t >= tUp) pv -= ampUp * (1 - Math.exp(-(t - tUp) / 2.5));
      if (t >= tDown) qv -= ampDown * 130 * (1 - Math.exp(-(t - tDown) / 2.5));
      if (st.dist && t >= 120) {
        const d = Math.exp(-(t - 120) / 4);
        pv += 0.14 * d;
        qv += 26 * d;
      }
      p[i] = pv;
      q[i] = qv;
    }
    return { p: p, q: q, n: n };
  }

  function findCross(arr) {
    for (let i = 0; i < arr.length; i++) {
      const t = i * DT;
      if (t >= T0 && 8.2 - arr[i] >= st.thr) return t;
    }
    return null;
  }

  function px(i, n) { return 45 + i / (n - 1) * 350; }
  function py(v) { return 198 - (v - 7.6) / 0.8 * 144; }
  function qy(v) { return 198 - (v - 1080) / 180 * 144; }

  function linePath(arr, n, mapper) {
    let d = '';
    for (let i = 0; i < n; i += 2) {
      d += (i ? 'L' : 'M') + px(i, n).toFixed(1) + ' ' + mapper(arr[i]).toFixed(1);
    }
    return d;
  }

  function draw(data, tDet, est) {
    const W = 430, H = 243;
    const n = data.n;
    let g = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0f130d" rx="6"/>';

    g += '<line x1="45" y1="17" x2="396" y2="17" stroke="#5b6358" stroke-width="4" stroke-linecap="round"/>';
    g += '<circle cx="45" cy="17" r="3.5" fill="#78b7a8"/><circle cx="396" cy="17" r="3.5" fill="#78b7a8"/>';
    g += '<text x="45" y="32" font-size="8" fill="#8b8778">上游泵站 · 压力测点</text>';
    g += '<text x="396" y="32" text-anchor="end" font-size="8" fill="#8b8778">下游阀室 · 流量测点</text>';
    const lx = 45 + st.pos / D_KM * 350;
    g += '<polygon points="' + (lx - 4).toFixed(1) + ',11 ' + (lx + 4).toFixed(1) + ',11 ' + lx.toFixed(1) + ',17" fill="#d46a5c"/>';
    g += '<text x="' + lx.toFixed(1) + '" y="8" text-anchor="middle" font-size="8" fill="#d46a5c">真实泄漏 ' + st.pos + ' km</text>';
    if (est !== null) {
      const ex = 45 + est / 96000 * 350;
      g += '<circle cx="' + ex.toFixed(1) + '" cy="17" r="5" fill="none" stroke="#78b7a8" stroke-width="1.5" stroke-dasharray="3 2"/>';
      g += '<text x="' + ex.toFixed(1) + '" y="41" text-anchor="middle" font-size="8" fill="#78b7a8">估算 ' + (est / 1000).toFixed(1) + ' km</text>';
    }

    [7.6, 7.8, 8.0, 8.2, 8.4].forEach(function (v) {
      g += '<line x1="45" y1="' + py(v) + '" x2="396" y2="' + py(v) + '" stroke="#242b20"/>';
      g += '<text x="41" y="' + (py(v) + 3) + '" text-anchor="end" font-size="8" fill="#7b8070">' + v.toFixed(1) + '</text>';
    });
    [1100, 1150, 1200, 1250].forEach(function (v) {
      g += '<text x="401" y="' + (qy(v) + 3) + '" font-size="8" fill="#7b8070">' + v + '</text>';
    });
    for (let t = 0; t <= T; t += 40) {
      const x = 45 + t / T * 350;
      g += '<line x1="' + x + '" y1="54" x2="' + x + '" y2="198" stroke="#242b20"/>';
      g += '<text x="' + x + '" y="208" text-anchor="middle" font-size="8" fill="#7b8070">' + t + '</text>';
    }
    g += '<line x1="45" y1="198" x2="396" y2="198" stroke="#3a4433"/>';
    g += '<line x1="45" y1="54" x2="45" y2="198" stroke="#3a4433"/>';
    g += '<line x1="396" y1="54" x2="396" y2="198" stroke="#3a4433"/>';
    g += '<text x="45" y="221" font-size="8" fill="#8b8778">上游压力 / MPa</text>';
    g += '<text x="396" y="221" text-anchor="end" font-size="8" fill="#8b8778">下游流量 / (m³/h)</text>';
    g += '<text x="220" y="221" text-anchor="middle" font-size="8" fill="#8b8778">时间 / s</text>';

    const ty = py(8.2 - st.thr);
    g += '<line x1="45" y1="' + ty + '" x2="396" y2="' + ty + '" stroke="#d0a85c" stroke-width="1" stroke-dasharray="5 4"/>';
    g += '<text x="391" y="' + (ty - 4) + '" text-anchor="end" font-size="8" fill="#d0a85c">检测阈值</text>';
    const t0x = 45 + T0 / T * 350;
    g += '<line x1="' + t0x + '" y1="54" x2="' + t0x + '" y2="198" stroke="#d46a5c" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>';
    g += '<text x="' + (t0x + 3) + '" y="61" font-size="8" fill="#d46a5c">泄漏注入 t=50 s</text>';
    if (tDet !== null) {
      const dx = 45 + tDet / T * 350;
      g += '<line x1="' + dx + '" y1="54" x2="' + dx + '" y2="198" stroke="#78b7a8" stroke-width="1" stroke-dasharray="2 2"/>';
      g += '<polygon points="' + (dx - 3) + ',' + (ty - 2) + ' ' + (dx + 3) + ',' + (ty - 2) + ' ' + dx + ',' + (ty + 4) + '" fill="#78b7a8"/>';
      g += '<text x="' + (dx + 4) + '" y="' + (ty + 11) + '" font-size="8" fill="#78b7a8">检测 ' + tDet.toFixed(1) + ' s</text>';
    }
    if (st.dist) {
      const dxx = 45 + 120 / T * 350;
      g += '<line x1="' + dxx + '" y1="54" x2="' + dxx + '" y2="198" stroke="#d0a85c" stroke-width="1" stroke-dasharray="2 3" opacity=".8"/>';
      g += '<text x="' + (dxx + 3) + '" y="' + (py(8.4) + 9) + '" font-size="8" fill="#d0a85c">启泵扰动</text>';
    }

    g += '<path d="' + linePath(data.p, n, py) + '" fill="none" stroke="#78b7a8" stroke-width="1.8" stroke-linejoin="round"/>';
    g += '<path d="' + linePath(data.q, n, qy) + '" fill="none" stroke="#d0a85c" stroke-width="1.6" stroke-linejoin="round" opacity=".92"/>';

    g += '<line x1="45" y1="230" x2="52" y2="230" stroke="#78b7a8" stroke-width="2"/><text x="56" y="233" font-size="8" fill="#8b8778">上游压力</text>';
    g += '<line x1="91" y1="230" x2="98" y2="230" stroke="#d0a85c" stroke-width="2"/><text x="101" y="233" font-size="8" fill="#8b8778">下游流量</text>';
    g += '<line x1="136" y1="230" x2="143" y2="230" stroke="#d0a85c" stroke-width="1" stroke-dasharray="4 3"/><text x="146" y="233" font-size="8" fill="#8b8778">检测阈值</text>';
    g += '<line x1="187" y1="230" x2="194" y2="230" stroke="#d46a5c" stroke-width="1" stroke-dasharray="3 3"/><text x="197" y="233" font-size="8" fill="#8b8778">泄漏注入</text>';
    $('chart').innerHTML = g;
  }

  function update() {
    const data = simulate();
    const tDet = findCross(data.p);
    const detected = tDet !== null;
    const err = detected ? Math.round(60 + 1.8 * st.pos + 300 * Math.max(0, 0.12 - st.thr)) : null;
    const est = detected ? Math.min(96000, st.pos * 1000 + err) : null;
    const fp = Math.round(34 * Math.exp(-st.thr / 0.06)) + (st.dist ? 3 : 0);

    draw(data, tDet, est);
    $('r-delay').innerHTML = detected ? (tDet - T0).toFixed(1) + ' <small>s</small>' : '未检出';
    $('r-err').innerHTML = detected ? '±' + err + ' <small>m</small>' : '—';
    $('r-fp').innerHTML = fp + ' <small>次/年</small>';

    const stEl = $('status');
    if (!detected) {
      stEl.className = 'status ok';
      stEl.innerHTML = '<b>正常（未检出）</b><span>当前泄漏量 ' + st.leak.toFixed(1) +
        '% 与阈值 ' + st.thr.toFixed(2) + ' MPa 的组合下，压力下降未超过阈值。小泄漏需要流量平衡或长期趋势模型补充。</span>';
    } else if (st.dist && st.thr < 0.12) {
      stEl.className = 'status warn';
      stEl.innerHTML = '<b>工况扰动</b><span>启泵压力尖峰与泄漏负压波叠加，当前阈值 ' + st.thr.toFixed(2) +
        ' MPa 过低，年误报约 ' + fp + ' 次。应接入泵阀状态做工况识别，再判断是否为真实泄漏。</span>';
    } else {
      stEl.className = 'status bad';
      stEl.innerHTML = '<b>泄漏报警</b><span>检测延迟 ' + (tDet - T0).toFixed(1) +
        ' s，估算泄漏位置距上游 ' + (est / 1000).toFixed(1) + ' km，定位误差约 ±' + err +
        ' m。建议调取该管段压力波与流量平衡复核。</span>';
    }
  }

  function sync() {
    $('s-thr').value = st.thr;
    $('s-pos').value = st.pos;
    $('s-leak').value = st.leak;
    $('o-thr').textContent = st.thr.toFixed(2) + ' MPa';
    $('o-pos').textContent = st.pos + ' km';
    $('o-leak').textContent = st.leak.toFixed(1) + '%';
  }

  $('s-thr').addEventListener('input', function (e) { st.thr = +e.target.value; sync(); update(); });
  $('s-pos').addEventListener('input', function (e) { st.pos = +e.target.value; sync(); update(); });
  $('s-leak').addEventListener('input', function (e) { st.leak = +e.target.value; sync(); update(); });
  $('btn-dist').addEventListener('click', function () {
    st.dist = !st.dist;
    $('btn-dist').textContent = st.dist ? '关闭启泵扰动' : '叠加启泵扰动';
    update();
  });
  $('btn-reset').addEventListener('click', function () {
    st = Object.assign({}, DEFAULTS);
    $('btn-dist').textContent = '叠加启泵扰动';
    sync();
    update();
  });

  sync();
  update();
})();
