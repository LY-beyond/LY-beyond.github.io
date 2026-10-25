/* ======= 注水泥参数优化 · 可运行示范 ======= */
(function () {
  'use strict';

  // ---------- 状态 ----------
  let state = {
    rho: 1.60,    // 水泥浆密度 g/cm³
    Q: 12,        // 顶替排量 L/s
    mw: 1.48,     // 钻井液密度 g/cm³
    hl: 1.15      // 井眼扩大系数
  };

  // 固定井况
  const DEPTH_MAX = 4800;
  const CASING_OD = 244.5;   // mm (9 5/8")
  const HOLE_D = 311.1 * state.hl;  // mm (12 1/4" 扩大后)
  const ANN_AREA = Math.PI / 4 * (HOLE_D * HOLE_D - CASING_OD * CASING_OD) / 1e6; // m²

  // ---------- 压力剖面生成 ----------
  function genPressure() {
    const pts = [];
    for (let d = 0; d <= DEPTH_MAX; d += 50) {
      // 孔隙压力梯度随深度增加
      const ppGrad = 1.03 + d / DEPTH_MAX * 0.52 + Math.sin(d / 600) * 0.02;
      // 破裂压力梯度（孔隙压力 + 附加应力）
      const fracGrad = ppGrad + 0.08 + Math.cos(d / 400) * 0.02;
      pts.push({ d, ppGrad, fracGrad });
    }
    return pts;
  }
  const PRESSURE = genPressure();

  // ---------- 物理计算 ----------
  // 当量密度（简化版：静液柱 + 摩阻折算）
  function calcECD(depth, rho, Q) {
    const g = 9.81;
    // 环空返速 m/s
    const v = Q / 1000 / ANN_AREA;
    // 摩阻梯度估算（简化）
    const fricGrad = 0.0015 * Math.pow(v, 1.8) * state.hl / 0.01;
    return rho + fricGrad;
  }

  // 顶替效率模型（简化：密度差 + 排量 + 井径）
  function calcEta(rho, Q, mw, hl) {
    const drho = rho - mw;
    const v = Q / 1000 / ANN_AREA;
    // 基础效率：随密度差和返速增加，但有上限
    let eta = 75 + drho * 120 + Math.min(v, 1.5) * 25;
    // 井眼扩大系数降低效率
    eta -= (hl - 1) * 30;
    // 范围限制
    eta = Math.max(40, Math.min(98, eta));
    return eta;
  }

  // 密度安全裕度（最深处 ECD 与破裂压力的距离）
  function calcMargin(rho, Q) {
    const ecdMax = calcECD(DEPTH_MAX, rho, Q);
    const fracAtBottom = PRESSURE[PRESSURE.length - 1].fracGrad;
    const ppAtBottom = PRESSURE[PRESSURE.length - 1].ppGrad;
    // 裕度 = min(ECD - PP, Frac - ECD) / (Frac - PP) * 100%
    const window = fracAtBottom - ppAtBottom;
    if (window < 0.01) return 0;
    const lowSide = ecdMax - ppAtBottom;
    const highSide = fracAtBottom - ecdMax;
    const margin = Math.max(0, Math.min(lowSide, highSide)) / window;
    return { margin: margin * 100, inWindow: ecdMax >= ppAtBottom && ecdMax <= fracAtBottom, ecdMax };
  }

  // ---------- 压力剖面渲染 ----------
  function drawProfile() {
    const svg = document.getElementById('profile');
    const W = 720, H = 340, padL = 50, padR = 14, padT = 16, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    const maxGrad = 2.0, minGrad = 0.8;
    const dMax = DEPTH_MAX;

    function px(d) { return padL + d / dMax * plotW; }
    function py(g) { return padT + (1 - (g - minGrad) / (maxGrad - minGrad)) * plotH; }

    // ECD 曲线（沿深度）
    const ecdVals = [];
    for (let d = 0; d <= dMax; d += 50) {
      ecdVals.push({ d, e: calcECD(d, state.rho, state.Q) });
    }

    // 绘制
    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 网格
    for (let g = 1.0; g <= 2.0; g += 0.2) {
      const y = py(g);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#efece1"/>`;
      s += `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">${g.toFixed(1)}</text>`;
    }
    for (let d = 0; d <= dMax; d += 800) {
      const x = px(d);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#efece1"/>`;
      s += `<text x="${x}" y="${padT + plotH + 14}" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${d}m</text>`;
    }

    // 安全窗口（破裂压力 - 孔隙压力之间的区域）
    let winPath = '';
    // 上边界：破裂压力
    let topPath = '';
    for (let i = 0; i < PRESSURE.length; i++) {
      const x = px(PRESSURE[i].d);
      const yF = py(PRESSURE[i].fracGrad);
      topPath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yF.toFixed(1) + ' ';
    }
    // 下边界：孔隙压力
    let botPath = '';
    for (let i = PRESSURE.length - 1; i >= 0; i--) {
      const x = px(PRESSURE[i].d);
      const yP = py(PRESSURE[i].ppGrad);
      botPath += 'L' + x.toFixed(1) + ' ' + yP.toFixed(1) + ' ';
    }
    winPath = topPath + botPath;
    s += `<path d="${winPath}" fill="#e7f3ea" opacity="0.55"/>`;
    s += `<path d="${topPath}" fill="none" stroke="#b05a51" stroke-width="1.8" stroke-linejoin="round"/>`;

    // 孔隙压力曲线
    let ppPath = '';
    for (let i = 0; i < PRESSURE.length; i++) {
      const x = px(PRESSURE[i].d);
      const yP = py(PRESSURE[i].ppGrad);
      ppPath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yP.toFixed(1) + ' ';
    }
    s += `<path d="${ppPath}" fill="none" stroke="#41699b" stroke-width="1.8" stroke-linejoin="round"/>`;

    // ECD 曲线（当前方案）
    let ecdPath = '';
    for (let i = 0; i < ecdVals.length; i++) {
      const x = px(ecdVals[i].d);
      const yE = py(Math.min(maxGrad, ecdVals[i].e));
      ecdPath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yE.toFixed(1) + ' ';
    }
    // 根据是否安全选择颜色
    const bottomOK = calcMargin(state.rho, state.Q).inWindow;
    s += `<path d="${ecdPath}" fill="none" stroke="${bottomOK ? '#2f7d6b' : '#b05a51'}" stroke-width="2.2" stroke-linejoin="round"/>`;

    // 井底点
    const bottomEcd = ecdVals[ecdVals.length - 1].e;
    s += `<circle cx="${px(DEPTH_MAX)}" cy="${py(Math.min(maxGrad, bottomEcd))}" r="4" fill="${bottomOK ? '#2f7d6b' : '#b05a51'}"/>`;

    // 图例
    s += `<text x="${padL}" y="${padT - 4}" font-size="10" fill="#9ba3a9" font-family="monospace">压力梯度 g/cm³ →</text>`;
    s += `<text x="${padL}" y="${padT + 14}" font-size="10" fill="#41699b">— 孔隙压力</text>`;
    s += `<text x="${padL + 110}" y="${padT + 14}" font-size="10" fill="#b05a51">— 破裂压力</text>`;
    s += `<text x="${padL + 220}" y="${padT + 14}" font-size="10" fill="${bottomOK ? '#2f7d6b' : '#b05a51'}">— ECD（当前方案）</text>`;
    s += `<text x="${padL + 380}" y="${padT + 14}" font-size="10" fill="#3f8560">▮ 安全窗口</text>`;

    svg.innerHTML = s;
  }

  // ---------- 环空顶替渲染 ----------
  function drawAnnulus() {
    const svg = document.getElementById('annulus');
    const W = 320, H = 220;
    // 几何：左半套管，中间环空
    const casLeft = 130, casRight = 190;
    const annLeft = casRight, annRight = 280;
    const bottom = 220, top = 0;

    const eta = calcEta(state.rho, state.Q, state.mw, state.hl);
    const mixH = (100 - eta) / 100 * (bottom - top) * 0.5; // 混合段高度

    // ECD 和裕度
    const margin = calcMargin(state.rho, state.Q);
    const v = state.Q / 1000 / ANN_AREA;
    const drho = state.rho - state.mw;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 环空背景（钻井液）
    s += `<rect x="${annLeft}" y="${top}" width="${annRight - annLeft}" height="${bottom - top}" fill="#e7eef9"/>`;

    // 水泥浆（底部上来）
    const cementTop = mixH;
    s += `<rect x="${annLeft}" y="${cementTop}" width="${annRight - annLeft}" height="${bottom - cementTop}" fill="#e6f1ec"/>`;

    // 混合带（有颜色过渡）
    if (mixH > 1) {
      s += `<rect x="${annLeft}" y="${top}" width="${annRight - annLeft}" height="${mixH}" fill="url(#mixGrad)" opacity="0.8"/>`;
      // 虚线标注混合带
      s += `<line x1="${annLeft - 4}" y1="${mixH}" x2="${annRight + 4}" y2="${mixH}" stroke="#b26a39" stroke-width="1" stroke-dasharray="3 2"/>`;
      s += `<text x="${annRight + 6}" y="${mixH + 3}" font-size="8.5" fill="#b26a39">混合带</text>`;
    }

    // 水泥浆上升箭头
    for (let i = 0; i < 3; i++) {
      const y = cementTop + 30 + i * 50;
      if (y < bottom - 10) {
        s += `<path d="M${annLeft + 10} ${y} l0 -10 l6 5 z" fill="#2f7d6b"/>`;
        s += `<path d="M${annLeft + 30} ${y} l0 -10 l6 5 z" fill="#2f7d6b"/>`;
      }
    }

    // 钻井液下降箭头
    for (let i = 0; i < 3; i++) {
      const y = 40 + i * 50;
      if (y > mixH + 10) {
        s += `<path d="M${annRight - 20} ${y} l0 10 l-6 -5 z" fill="#41699b" opacity="0.6"/>`;
      }
    }

    // 套管
    s += `<rect x="${casLeft}" y="${top}" width="${casRight - casLeft}" height="${bottom - top}" fill="#4d565b" rx="2"/>`;
    s += `<rect x="${casLeft + 10}" y="${top}" width="${casRight - casLeft - 20}" height="${bottom - top}" fill="#242b2e"/>`;
    s += `<text x="${(casLeft + casRight) / 2}" y="${bottom / 2}" fill="#fdfcf9" font-size="10" text-anchor="middle" transform="rotate(-90 ${(casLeft + casRight) / 2} ${bottom / 2})">套管</text>`;

    // 窜槽可视化（效率低时显示）
    if (eta < 75) {
      s += `<rect x="${annLeft + 2}" y="${top + 5}" width="5" height="${bottom - top - 10}" fill="#41699b" opacity="0.55"/>`;
      s += `<text x="${annLeft + 10}" y="14" font-size="8.5" fill="#b05a51" font-family="monospace">窜槽！</text>`;
    }

    // 渐变定义
    s += `<defs><linearGradient id="mixGrad" x1="0" y1="0" x2="0" y2="1">`;
    s += `<stop offset="0" stop-color="#e7eef9"/><stop offset="1" stop-color="#e6f1ec"/>`;
    s += `</linearGradient></defs>`;

    // 标签
    s += `<text x="${annLeft}" y="${top - 4}" font-size="8.5" fill="#2f7d6b">水泥浆↑</text>`;
    s += `<text x="${annRight - 30}" y="${top - 4}" font-size="8.5" fill="#41699b">钻井液↓</text>`;
    s += `<text x="${annLeft + 10}" y="${bottom + 14}" font-size="9" fill="#9ba3a9">环空 (${HOLE_D.toFixed(0)}mm / ${CASING_OD}mm)</text>`;

    svg.innerHTML = s;

    // 更新信息
    $('ai-eta').textContent = eta.toFixed(1) + '%';
    $('ai-ecd').textContent = margin.ecdMax.toFixed(2) + ' g/cm³';
    $('ai-drho').textContent = drho.toFixed(2) + ' g/cm³';
    $('ai-v').textContent = v.toFixed(2) + ' m/s';
    const pct = calcMargin(state.rho, state.Q);
    $('ai-margin').textContent = pct.inWindow ? (pct.margin).toFixed(0) + '%' : '出界!';

    // verdict
    const vEl = $('verdict');
    if (!pct.inWindow) {
      vEl.className = 'verdict bad';
      if (pct.ecdMax > PRESSURE[PRESSURE.length - 1].fracGrad) {
        vEl.textContent = '❌ ECD 超过破裂压力！底部可能漏失，必须降低密度或排量。';
      } else {
        vEl.textContent = '❌ ECD 低于孔隙压力！底部可能气窜，必须提高密度。';
      }
    } else if (eta < 80) {
      vEl.className = 'verdict warn';
      vEl.textContent = '⚠️ 安全但顶替效率偏低（' + eta.toFixed(0) + '%）。考虑增大排量或提高密度差。';
    } else {
      vEl.className = 'verdict ok';
      vEl.textContent = '✅ 方案可行！ECD 在安全窗口内，顶替效率 ' + eta.toFixed(0) + '%，安全裕度 ' + pct.margin.toFixed(0) + '%。';
    }
  }

  // ---------- 帕累托前沿图 ----------
  let samples = [];

  function genSamples() {
    samples = [];
    for (let i = 0; i < 250; i++) {
      const rho = 1.45 + Math.random() * 0.40;
      const Q = 4 + Math.random() * 24;
      const eta = calcEta(rho, Q, state.mw, state.hl);
      const margin = calcMargin(rho, Q);
      samples.push({ rho, Q, eta, marginPct: margin.inWindow ? margin.margin : -1, feasible: margin.inWindow });
    }
    // 按 eta 降序 + margin 降序，找非支配解
    samples.sort((a, b) => (b.feasible - a.feasible) || (b.eta - a.eta) || (b.marginPct - a.marginPct));
  }

  function findParetoFront() {
    const feasible = samples.filter(s => s.feasible);
    const front = [];
    for (const p of feasible) {
      let dominated = false;
      for (const q of feasible) {
        if (q === p) continue;
        // q 支配 p：eta ≥ p.eta 且 margin ≥ p.marginPct，至少一个严格大于
        if (q.eta >= p.eta && q.marginPct >= p.marginPct && (q.eta > p.eta || q.marginPct > p.marginPct)) {
          dominated = true; break;
        }
      }
      if (!dominated) front.push(p);
    }
    return front.sort((a, b) => b.eta - a.eta);
  }

  function drawPareto() {
    const svg = document.getElementById('pareto');
    const W = 560, H = 320, padL = 50, padR = 18, padT = 20, padB = 36;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    const etaMin = 40, etaMax = 100;
    const marMin = 0, marMax = 100;

    function xOf(v) { return padL + (v - etaMin) / (etaMax - etaMin) * plotW; }
    function yOf(v) { return padT + (1 - (v - marMin) / (marMax - marMin)) * plotH; }

    const pareto = findParetoFront();

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 网格
    for (let g = 50; g <= 100; g += 10) {
      const x = xOf(g);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#efece1"/>`;
      s += `<text x="${x}" y="${padT + plotH + 14}" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${g}%</text>`;
    }
    for (let g = 0; g <= 100; g += 20) {
      const y = yOf(g);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#efece1"/>`;
      s += `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">${g}%</text>`;
    }

    // 不可行点（灰色）
    samples.filter(s => !s.feasible).forEach(p => {
      s += `<circle cx="${xOf(p.eta)}" cy="${yOf(0)}" r="2" fill="#d8d2c4" opacity="0.5"/>`;
    });

    // 可行点（浅绿）
    samples.filter(s => s.feasible).forEach(p => {
      s += `<circle cx="${xOf(p.eta)}" cy="${yOf(p.marginPct)}" r="2.5" fill="#2f7d6b" opacity="0.3"/>`;
    });

    // 帕累托前沿连线
    let frontPath = '';
    pareto.forEach((p, i) => {
      frontPath += (i ? 'L' : 'M') + xOf(p.eta).toFixed(1) + ' ' + yOf(p.marginPct).toFixed(1) + ' ';
    });
    if (pareto.length > 1) {
      s += `<path d="${frontPath}" fill="none" stroke="#b26a39" stroke-width="2" stroke-dasharray="4 3"/>`;
    }

    // 帕累托前沿点
    pareto.forEach(p => {
      s += `<circle cx="${xOf(p.eta)}" cy="${yOf(p.marginPct)}" r="4" fill="#b26a39" stroke="#fff" stroke-width="1.2"/>`;
    });

    // 当前方案点
    const curMargin = calcMargin(state.rho, state.Q);
    const curEta = calcEta(state.rho, state.Q, state.mw, state.hl);
    const curY = curMargin.inWindow ? curMargin.margin : -1;
    const curClr = curMargin.inWindow ? '#2f7d6b' : '#b05a51';
    s += `<circle cx="${xOf(curEta)}" cy="${curY >= 0 ? yOf(curY) : yOf(0)}" r="6" fill="${curClr}" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${xOf(curEta) + 10}" y="${curY >= 0 ? yOf(curY) - 8 : yOf(0) - 8}" font-size="9" fill="${curClr}" font-weight="600">当前</text>`;

    // 坐标轴标签
    s += `<text x="${padL + plotW / 2}" y="${padT + plotH + 32}" font-size="10" fill="#5d666d" text-anchor="middle">顶替效率 η</text>`;
    s += `<text x="14" y="${padT + plotH / 2}" font-size="10" fill="#5d666d" text-anchor="middle" transform="rotate(-90 14 ${padT + plotH / 2})">安全裕度</text>`;

    svg.innerHTML = s;

    // 更新统计
    document.getElementById('pnow').textContent = curEta.toFixed(0) + '% / ' + (curY >= 0 ? curY.toFixed(0) + '%' : '不可行');
    document.getElementById('pcount').textContent = pareto.length;
  }

  // ---------- 事件 ----------
  function bind() {
    const inputs = [
      ['s-rho', 'rho', 'o-rho', v => v.toFixed(2)],
      ['s-Q', 'Q', 'o-Q', v => v.toFixed(0)],
      ['s-mw', 'mw', 'o-mw', v => v.toFixed(2)],
      ['s-hl', 'hl', 'o-hl', v => v.toFixed(2)]
    ];

    inputs.forEach(([id, key, outId, fmt]) => {
      const el = document.getElementById(id);
      const out = document.getElementById(outId);
      el.value = state[key];
      out.textContent = fmt(state[key]);
      el.addEventListener('input', () => {
        state[key] = parseFloat(el.value);
        out.textContent = fmt(state[key]);
        // 更新环空面积（因为 hl 改变）
        if (key === 'hl') {
          HOLE_D_VAL = 311.1 * state.hl;
          ANN_AREA_VAL = Math.PI / 4 * (HOLE_D_VAL * HOLE_D_VAL - CASING_OD * CASING_OD) / 1e6;
        }
        drawProfile();
        drawAnnulus();
        drawPareto();
      });
    });

    document.getElementById('btn-simulate').addEventListener('click', () => {
      genSamples();
      drawPareto();
    });

    document.getElementById('btn-optimize').addEventListener('click', () => {
      // 快速优化：从当前方案出发，贪心搜索帕累托前沿上最近的点
      genSamples();
      const pareto = findParetoFront();
      // 选 eta 最高的点（或最安全的点）
      pareto.sort((a, b) => b.eta - a.eta);
      const best = pareto[0];
      state.rho = best.rho;
      state.Q = best.Q;
      document.getElementById('s-rho').value = state.rho;
      document.getElementById('s-Q').value = state.Q;
      document.getElementById('o-rho').textContent = state.rho.toFixed(2);
      document.getElementById('o-Q').textContent = state.Q.toFixed(0);
      drawProfile();
      drawAnnulus();
      drawPareto();
    });
  }

  // 可变变量
  let HOLE_D_VAL = HOLE_D;
  let ANN_AREA_VAL = ANN_AREA;

  // ---------- 初始化 ----------
  bind();
  genSamples();
  drawProfile();
  drawAnnulus();
  drawPareto();
})();
