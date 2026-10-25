/* ======= 套管居中度智能评估 · 可运行示范 ======= */
(function () {
  'use strict';

  // ---------- 常量 ----------
  const CASING_OD = 178;      // 套管外径 mm
  const MAX_OFF = 60;         // 屏幕上最大半径 px
  const CROSS_CENTER = 200;   // 横截面中心

  // ---------- 状态 ----------
  let state = {
    d: 216,        // 井径 mm
    theta: 60,     // 井斜角 deg
    wt: 260,       // 套管线重 N/m
    f: 196,        // 扶正器外径 mm
    hasF: true     // 是否考虑扶正器
  };

  // 沿井段数据（模拟井）
  const N = 200;   // 采样点数
  const K = 0.045; // 偏心系数
  let boosters = []; // 扶正器位置（索引）

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }
  function mm2px(v) { return v / state.d * MAX_OFF; }

  // 无扶正器偏心距（mm）
  function eccNoBoost() {
    const sin = Math.sin(state.theta * Math.PI / 180);
    return Math.min(state.d - CASING_OD, K * state.wt * sin * 10);
  }
  // 居中度 %
  function centering(ecc, boosterOut) {
    if (state.theta < 1) return 100;
    let eff = ecc;
    if (boosterOut) {
      // 有扶正器，偏心距被扶正器外径限制
      eff = Math.min(ecc, Math.max(0, (state.d - state.f) / 2));
    }
    const maxEcc = (state.d - CASING_OD) / 2;
    return Math.max(0, Math.min(100, 100 * (1 - eff / maxEcc)));
  }

  // ---------- 横截面渲染 ----------
  function drawCross() {
    const svg = $('cross');
    const R = MAX_OFF;
    const r = CASING_OD / state.d * R;  // 套管半径 px
    const ecc = mm2px(eccNoBoost());     // 偏心距 px

    // 扶正器位置（沿井斜方向）
    const ang = state.theta * Math.PI / 180;
    const dirX = Math.sin(ang);  // 向下方向（重力）
    const dirY = Math.cos(ang);

    // 实际套管位置（被扶正器限制）
    let effEccPx = Math.min(ecc, Math.max(0, (state.d - state.f) / 2) / state.d * R);

    let s = '';
    // 井眼（大圆）
    s += `<circle cx="${CROSS_CENTER}" cy="${CROSS_CENTER}" r="${R}" fill="#f5f2ea" stroke="#c9c2b0" stroke-width="1.5"/>`;

    // 水泥环（环形，根据居中度改变显示）
    const clNow = centering(eccNoBoost(), true);
    // 水泥环：从套管外壁到井眼内壁，但减去偏心部分
    // 简化画两段弧：上半部分（厚的一侧）和下半部分（薄的一侧）
    const casCx = CROSS_CENTER + effEccPx * dirX;
    const casCy = CROSS_CENTER + effEccPx * dirY;

    // 水泥环用路径画：井眼内圆 到 套管外圆 之间的部分
    if (effEccPx < 0.5) {
      // 完全居中，画完整环形
      s += `<circle cx="${CROSS_CENTER}" cy="${CROSS_CENTER}" r="${R}" fill="none" stroke="#2f7d6b" stroke-width="${R - r}" opacity="0.55"/>`;
    } else {
      // 偏心：画井眼和套管之间的区域
      // 用更简洁的方式：井眼减去套管，填绿色
      s += `<path d="M ${CROSS_CENTER - R} ${CROSS_CENTER} A ${R} ${R} 0 1 0 ${CROSS_CENTER + R} ${CROSS_CENTER} A ${R} ${R} 0 1 0 ${CROSS_CENTER - R} ${CROSS_CENTER} Z" fill="#e6f1ec" opacity="0.7"/>`;
      s += `<path d="M ${casCx - r} ${casCy} A ${r} ${r} 0 1 0 ${casCx + r} ${casCy} A ${r} ${r} 0 1 0 ${casCx - r} ${casCy} Z" fill="#fbfaf6"/>`;
    }

    // 井眼描边
    s += `<circle cx="${CROSS_CENTER}" cy="${CROSS_CENTER}" r="${R}" fill="none" stroke="#c9c2b0" stroke-width="1.5"/>`;

    // 扶正器（画在套管外壁上方，沿重力反方向）
    const boostCx = casCx - (state.f - CASING_OD) / state.d * R / 2 * dirX;
    const boostCy = casCy - (state.f - CASING_OD) / state.d * R / 2 * dirY;
    const boostR = state.f / state.d * R / 2;
    s += `<circle cx="${boostCx}" cy="${boostCy}" r="${boostR}" fill="none" stroke="#b26a39" stroke-width="2" stroke-dasharray="3 2" opacity="0.7"/>`;

    // 套管
    s += `<circle cx="${casCx}" cy="${casCy}" r="${r}" fill="#4d565b" stroke="#242b2e" stroke-width="1.5"/>`;
    // 套管内孔
    s += `<circle cx="${casCx}" cy="${casCy}" r="${r * 0.6}" fill="#242b2e"/>`;

    // 偏心线
    if (effEccPx > 1) {
      s += `<line x1="${CROSS_CENTER}" y1="${CROSS_CENTER}" x2="${casCx}" y2="${casCy}" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="3 2"/>`;
      const midX = (CROSS_CENTER + casCx) / 2;
      const midY = (CROSS_CENTER + casCy) / 2;
      s += `<text x="${midX + 4}" y="${midY - 4}" font-size="10" fill="#b05a51" font-family="monospace">e=${((CROSS_CENTER - casCx) * state.d / R).toFixed(1)}mm</text>`;
    }

    // 图例
    s += `<text x="12" y="20" font-size="10" fill="#9ba3a9" font-family="monospace">D=${state.d}mm  d=${CASING_OD}mm  θ=${state.theta}°</text>`;

    svg.innerHTML = s;

    // 更新信息
    const eccMm = eccNoBoost();
    const cl = centering(eccMm, true);
    $('ci-d').textContent = state.d + ' mm';
    $('ci-do').textContent = CASING_OD + ' mm';
    $('ci-f').textContent = state.f + ' mm';
    $('ci-theta').textContent = state.theta + '°';
    $('ci-e').textContent = eccMm.toFixed(1) + ' mm';
    $('ci-cl').textContent = cl.toFixed(0) + '%';

    const v = $('verdict');
    v.className = 'verdict ' + (cl >= 80 ? 'ok' : cl >= 67 ? 'warn' : 'bad');
    v.textContent = cl >= 80 ? '✅ 居 ≥ 80%，优良。水泥环均匀，窜槽风险极低。'
                  : cl >= 67 ? '⚠️ 67%—80%，合格。仍有薄层水泥环，注意工程风险。'
                  : '❌ < 67%，不合格！套管严重偏心，水泥环太薄，强烈建议增大扶正器外径。';
  }

  // ---------- 沿井段数据生成 ----------
  function genWell() {
    // 生成井斜角曲线：0 → 90 → 90（垂直 → 增斜 → 水平）
    const thetaArr = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / N;
      if (t < 0.3) thetaArr[i] = t / 0.3 * 45;
      else if (t < 0.5) thetaArr[i] = 45 + (t - 0.3) / 0.2 * 45;
      else thetaArr[i] = 90 - (Math.random() - 0.5) * 6;
    }
    // 井径曲线（加一些起伏）
    const dArr = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const base = 216 + Math.sin(i * 0.15) * 6 + Math.sin(i * 0.03) * 4;
      dArr[i] = base;
    }
    return { theta: thetaArr, d: dArr };
  }

  const well = genWell();

  // 计算沿井段居中度曲线（考虑扶正器位置）
  function computeCL() {
    const cl = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const localD = well.d[i];
      const localTheta = well.theta[i];
      // 临时用当前井径和井斜
      const ecc = Math.min(localD - CASING_OD, K * state.wt * Math.sin(localTheta * Math.PI / 180) * 10);
      // 检查附近是否有扶正器（±5 点范围）
      let near = false;
      for (const b of boosters) {
        if (Math.abs(b - i) <= 5) { near = true; break; }
      }
      let effEcc = ecc;
      if (near) {
        effEcc = Math.min(ecc, Math.max(0, (localD - state.f) / 2));
      }
      const maxEcc = (localD - CASING_OD) / 2;
      cl[i] = Math.max(0, Math.min(100, 100 * (1 - effEcc / maxEcc)));
    }
    return cl;
  }

  // ---------- 井段曲线渲染 ----------
  function drawWell() {
    const svg = $('well');
    const W = 760, H = 280, padL = 40, padR = 14, padT = 22, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    const cl = computeCL();

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 背景区域（达标/不达标）
    const yAxis = padT + plotH;
    // 水平段标注
    s += `<rect x="${padL + 0.5 * plotW}" y="${padT}" width="${0.5 * plotW}" height="${plotH}" fill="#f5f2ea" opacity="0.5"/>`;
    s += `<text x="${padL + 0.25 * plotW}" y="${padT + 14}" font-size="10" fill="#9ba3a9" font-family="monospace" text-anchor="middle">增斜段</text>`;
    s += `<text x="${padL + 0.75 * plotW}" y="${padT + 14}" font-size="10" fill="#9ba3a9" font-family="monospace" text-anchor="middle">水平段 (θ≈90°)</text>`;

    // 网格
    [0, 20, 40, 60, 67, 80, 100].forEach(v => {
      const y = yAxis - v / 100 * plotH;
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">${v}</text>`;
    });

    // 67% 达标线
    const y67 = yAxis - 0.67 * plotH;
    s += `<line x1="${padL}" y1="${y67}" x2="${padL + plotW}" y2="${y67}" stroke="#a97a1c" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += `<text x="${padL + plotW + 2}" y="${y67 + 3}" font-size="9" fill="#a97a1c" font-family="monospace">67%</text>`;

    // 低居中度区域（红色填充）
    let inLow = false, lowStart = 0;
    for (let i = 0; i < N; i++) {
      if (cl[i] < 67 && !inLow) { inLow = true; lowStart = i; }
      if (cl[i] >= 67 && inLow) {
        const x1 = padL + lowStart / N * plotW;
        const x2 = padL + i / N * plotW;
        s += `<rect x="${x1}" y="${padT}" width="${x2 - x1}" height="${plotH}" fill="#b05a51" opacity="0.08"/>`;
        inLow = false;
      }
    }
    if (inLow) {
      const x1 = padL + lowStart / N * plotW;
      const x2 = padL + plotW;
      s += `<rect x="${x1}" y="${padT}" width="${x2 - x1}" height="${plotH}" fill="#b05a51" opacity="0.08"/>`;
    }

    // 居中度曲线
    let path = '';
    for (let i = 0; i < N; i++) {
      const x = padL + i / N * plotW;
      const y = yAxis - cl[i] / 100 * plotH;
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#2f7d6b" stroke-width="2" stroke-linejoin="round"/>`;

    // 扶正器位置
    boosters.forEach(b => {
      const x = padL + b / N * plotW;
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#b26a39" stroke-width="1.5" stroke-dasharray="2 2"/>`;
      s += `<circle cx="${x}" cy="${padT + plotH + 4}" r="4" fill="#b26a39"/>`;
    });

    // 井斜角曲线（细线）
    let tpath = '';
    for (let i = 0; i < N; i++) {
      const x = padL + i / N * plotW;
      const y = yAxis - well.theta[i] / 100 * plotH;
      tpath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    s += `<path d="${tpath}" fill="none" stroke="#41699b" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`;

    // 图例
    s += `<rect x="${padL}" y="${H - 20}" width="10" height="2" fill="#2f7d6b"/>`;
    s += `<text x="${padL + 14}" y="${H - 15}" font-size="9" fill="#5d666d">居中度 %</text>`;
    s += `<rect x="${padL + 90}" y="${H - 20}" width="10" height="2" fill="#41699b"/>`;
    s += `<text x="${padL + 104}" y="${H - 15}" font-size="9" fill="#5d666d">井斜角 θ</text>`;
    s += `<rect x="${padL + 190}" y="${H - 20}" width="10" height="2" fill="#b26a39"/>`;
    s += `<text x="${padL + 204}" y="${H - 15}" font-size="9" fill="#5d666d">扶正器</text>`;

    svg.innerHTML = s;

    // 统计
    let minCL = 100;
    for (let i = 0; i < N; i++) if (cl[i] < minCL) minCL = cl[i];
    $('fcount').textContent = boosters.length;
    $('fmin').textContent = minCL.toFixed(1) + '%';
  }

  // ---------- 扶正器操作 ----------
  function addBoosterAt(idx) {
    if (boosters.some(b => Math.abs(b - idx) < 8)) return;
    boosters.push(idx);
    boosters.sort((a, b) => a - b);
  }

  // 找最低居中度位置
  function findWorst() {
    const cl = computeCL();
    let minVal = 100, minIdx = 0;
    for (let i = 10; i < N - 10; i++) {
      if (cl[i] < minVal) { minVal = cl[i]; minIdx = i; }
    }
    return minIdx;
  }

  // 一键优化（贪心）
  function optimize() {
    boosters = [];
    for (let iter = 0; iter < 30; iter++) {
      const worstIdx = findWorst();
      const cl = computeCL();
      if (cl[worstIdx] >= 67) break;
      addBoosterAt(worstIdx);
    }
    // 局部搜索：尝试移除冗余扶正器
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = boosters.length - 1; i >= 0; i--) {
        const saved = boosters[i];
        boosters.splice(i, 1);
        const cl = computeCL();
        let minV = 100;
        for (let j = 0; j < N; j++) if (cl[j] < minV) minV = cl[j];
        if (minV >= 65) {
          improved = true;
        } else {
          boosters.splice(i, 0, saved);
        }
      }
    }
  }

  // ---------- 事件绑定 ----------
  function bind() {
    $('s-d').addEventListener('input', e => {
      state.d = +e.target.value;
      $('o-d').textContent = state.d;
      drawCross();
      drawWell();
    });
    $('s-theta').addEventListener('input', e => {
      state.theta = +e.target.value;
      $('o-theta').textContent = state.theta;
      drawCross();
      drawWell();
    });
    $('s-wt').addEventListener('input', e => {
      state.wt = +e.target.value;
      $('o-wt').textContent = state.wt;
      drawCross();
      drawWell();
    });
    $('s-f').addEventListener('input', e => {
      state.f = +e.target.value;
      $('o-f').textContent = state.f;
      drawCross();
      drawWell();
    });
    $('btn-add').addEventListener('click', () => {
      addBoosterAt(findWorst());
      drawWell();
    });
    $('btn-auto').addEventListener('click', () => {
      optimize();
      drawWell();
    });
    $('btn-reset').addEventListener('click', () => {
      boosters = [];
      drawWell();
    });
  }

  // ---------- 初始化 ----------
  bind();
  drawCross();
  drawWell();
})();
