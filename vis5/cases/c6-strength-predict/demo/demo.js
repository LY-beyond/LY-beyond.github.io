/* ======= 水泥候凝强度预测 · 可运行示范 ======= */
(function () {
  'use strict';

  let state = {
    temp: 85,      // 井底温度 ℃
    wc: 0.44,      // 水灰比
    ret: 0.3,      // 缓凝剂 %
    acc: 0         // 促凝剂 %
  };

  const T_TEST = 14;   // 试压强度 MPa
  const T_DRILL = 21;  // 钻塞强度 MPa
  const T_MAX = 48;    // 最大展示时间 h

  function $(id) { return document.getElementById(id); }

  // 水化速率常数（简化 Arrhenius：温度每升 10℃ 翻倍）
  function rateConstant() {
    const Tref = 50;
    const kRef = 0.008; // 50℃ 时的基准速率（标定为 85℃ 约 5h 达试压强度）
    let k = kRef * Math.pow(2, (state.temp - Tref) / 10);
    // 缓凝剂：指数衰减
    k *= Math.exp(-1.3 * state.ret);
    // 促凝剂：线性加速
    k *= (1 + 0.45 * state.acc);
    return k;
  }

  // 极限强度（水灰比越低越高）
  function maxStrength() {
    // 经验：w/c 0.35 → ~62 MPa, w/c 0.60 → ~32 MPa
    return Math.max(25, 62 - 120 * (state.wc - 0.35));
  }

  // t 时刻的强度
  function strengthAt(t) {
    const k = rateConstant();
    const Smax = maxStrength();
    return Smax * (1 - Math.exp(-k * t));
  }

  // 达到目标强度的时间
  function timeToReach(target) {
    const k = rateConstant();
    const Smax = maxStrength();
    if (target >= Smax) return null;
    return -Math.log(1 - target / Smax) / k;
  }

  function drawChart() {
    const svg = $('chart');
    const W = 800, H = 360, padL = 52, padR = 20, padT = 20, padB = 44;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const Smax = maxStrength();
    const yMax = Math.max(30, Smax + 5);

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="6"/>`;

    // 网格
    [0, 10, 20, 30, 40, 50, 60].forEach(v => {
      if (v > yMax + 2) return;
      const y = padT + plotH - v / yMax * plotH;
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${padL - 8}" y="${y + 3}" font-size="10" fill="#9ba3a9" text-anchor="end" font-family="monospace">${v}</text>`;
    });
    [0, 6, 12, 18, 24, 30, 36, 42, 48].forEach(t => {
      const x = padL + t / T_MAX * plotW;
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${x}" y="${padT + plotH + 16}" font-size="10" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${t}</text>`;
    });

    // 试压阈值线
    const yTest = padT + plotH - T_TEST / yMax * plotH;
    s += `<line x1="${padL}" y1="${yTest}" x2="${padL + plotW}" y2="${yTest}" stroke="#a97a1c" stroke-width="1.2" stroke-dasharray="5 3"/>`;
    s += `<text x="${padL + plotW + 4}" y="${yTest + 3}" font-size="10" fill="#a97a1c" font-family="monospace">14 MPa 试压</text>`;

    // 钻塞阈值线
    const yDrill = padT + plotH - T_DRILL / yMax * plotH;
    s += `<line x1="${padL}" y1="${yDrill}" x2="${padL + plotW}" y2="${yDrill}" stroke="#3f8560" stroke-width="1.2" stroke-dasharray="5 3"/>`;
    s += `<text x="${padL + plotW + 4}" y="${yDrill + 3}" font-size="10" fill="#3f8560" font-family="monospace">21 MPa 钻塞</text>`;

    // 经验候凝 24h 线
    const x24 = padL + 24 / T_MAX * plotW;
    s += `<line x1="${x24}" y1="${padT}" x2="${x24}" y2="${padT + plotH}" stroke="#b26a39" stroke-width="1.2" stroke-dasharray="4 2"/>`;
    s += `<text x="${x24}" y="${padT - 4}" font-size="9" fill="#b26a39" text-anchor="middle" font-family="monospace">经验 24h</text>`;

    // 置信区间带
    const N = 200;
    let upper = '', lower = '';
    for (let i = 0; i <= N; i++) {
      const t = i / N * T_MAX;
      const str = strengthAt(t);
      const up = Math.min(yMax, str * 1.15);
      const lo = Math.max(0, str * 0.85);
      const x = padL + t / T_MAX * plotW;
      const yu = padT + plotH - up / yMax * plotH;
      const yl = padT + plotH - lo / yMax * plotH;
      upper += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yu.toFixed(1) + ' ';
      lower += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yl.toFixed(1) + ' ';
    }
    // 填充带（upper 正序 + lower 逆序）
    let fillPath = upper;
    for (let i = N; i >= 0; i--) {
      const t = i / N * T_MAX;
      const str = strengthAt(t);
      const lo = Math.max(0, str * 0.85);
      const x = padL + t / T_MAX * plotW;
      const yl = padT + plotH - lo / yMax * plotH;
      fillPath += 'L' + x.toFixed(1) + ' ' + yl.toFixed(1) + ' ';
    }
    fillPath += 'Z';
    s += `<path d="${fillPath}" fill="#2f7d6b" opacity="0.15"/>`;

    // 主曲线
    let main = '';
    for (let i = 0; i <= N; i++) {
      const t = i / N * T_MAX;
      const str = strengthAt(t);
      const x = padL + t / T_MAX * plotW;
      const y = padT + plotH - str / yMax * plotH;
      main += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    s += `<path d="${main}" fill="none" stroke="#2f7d6b" stroke-width="2.5"/>`;

    // 达标时间点
    const tTest = timeToReach(T_TEST);
    const tDrill = timeToReach(T_DRILL);
    if (tTest && tTest <= T_MAX) {
      const x = padL + tTest / T_MAX * plotW;
      s += `<circle cx="${x.toFixed(1)}" cy="${yTest}" r="5" fill="#a97a1c" stroke="#fff" stroke-width="2"/>`;
      s += `<text x="${x.toFixed(1)}" y="${yTest - 10}" font-size="10" fill="#a97a1c" text-anchor="middle" font-family="monospace" font-weight="600">${tTest.toFixed(1)}h</text>`;
    }
    if (tDrill && tDrill <= T_MAX) {
      const x = padL + tDrill / T_MAX * plotW;
      s += `<circle cx="${x.toFixed(1)}" cy="${yDrill}" r="5" fill="#3f8560" stroke="#fff" stroke-width="2"/>`;
      s += `<text x="${x.toFixed(1)}" y="${yDrill - 10}" font-size="10" fill="#3f8560" text-anchor="middle" font-family="monospace" font-weight="600">${tDrill.toFixed(1)}h</text>`;
    }

    // 轴标签
    s += `<text x="${padL / 2}" y="${padT + plotH / 2}" font-size="11" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ${padL / 2} ${padT + plotH / 2})">抗压强度 (MPa)</text>`;
    s += `<text x="${padL + plotW / 2}" y="${H - 6}" font-size="11" fill="#5d666d" text-anchor="middle">候凝时间 (h)</text>`;

    svg.innerHTML = s;
    return { tTest, tDrill };
  }

  function render() {
    const { tTest, tDrill } = drawChart();

    const elTest = $('t-test');
    const elDrill = $('t-drill');
    const elRec = $('t-rec');

    if (tTest === null) {
      elTest.textContent = '>48h'; elTest.className = 'v bad';
    } else if (tTest > T_MAX) {
      elTest.textContent = tTest.toFixed(1) + 'h'; elTest.className = 'v bad';
    } else {
      elTest.textContent = tTest.toFixed(1) + 'h'; elTest.className = 'v';
    }

    if (tDrill === null || tDrill > T_MAX) {
      elDrill.textContent = tDrill ? tDrill.toFixed(1) + 'h' : '极限内不达'; elDrill.className = 'v warn';
    } else {
      elDrill.textContent = tDrill.toFixed(1) + 'h'; elDrill.className = 'v';
    }

    // 推荐候凝 = tTest 上限（+15% 置信）
    let rec = null;
    if (tTest !== null) {
      rec = tTest * 1.15;
      elRec.textContent = rec.toFixed(1) + 'h';
      elRec.className = rec <= 24 ? 'v' : 'v warn';
    } else {
      elRec.textContent = '>48h';
      elRec.className = 'v bad';
    }

    const v = $('verdict');
    if (rec === null) {
      v.className = 'verdict bad';
      v.textContent = '❌ 当前配方在 48h 内无法达到试压强度，需提高温度或减少水灰比。';
    } else if (rec <= 12) {
      v.className = 'verdict ok';
      v.textContent = `✅ 推荐候凝 ${rec.toFixed(1)}h，比经验 24h 节省 ${(24 - rec).toFixed(1)}h。温度足、配方合理。`;
    } else if (rec <= 24) {
      v.className = 'verdict ok';
      v.textContent = `✅ 推荐候凝 ${rec.toFixed(1)}h，略少于经验 24h，可节省 ${(24 - rec).toFixed(1)}h。`;
    } else {
      v.className = 'verdict warn';
      v.textContent = `⚠️ 推荐候凝 ${rec.toFixed(1)}h，超过经验 24h。低温或水灰比偏高，建议加促凝剂或降低水灰比。`;
    }
  }

  function bind() {
    $('s-temp').addEventListener('input', e => { state.temp = +e.target.value; $('o-temp').textContent = state.temp; render(); });
    $('s-wc').addEventListener('input', e => { state.wc = +e.target.value; $('o-wc').textContent = state.wc.toFixed(2); render(); });
    $('s-ret').addEventListener('input', e => { state.ret = +e.target.value; $('o-ret').textContent = state.ret.toFixed(2); render(); });
    $('s-acc').addEventListener('input', e => { state.acc = +e.target.value; $('o-acc').textContent = state.acc.toFixed(1); render(); });
  }

  bind();
  render();
})();
