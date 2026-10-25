/* ======= 固井质量 CBL/VDL 智能评价 · 可运行示范 ======= */
(function () {
  'use strict';

  // ---------- 状态 ----------
  let S = { gapS: 55, gapL: 8, noise: 2, microGap: false };

  const N = 800;       // 采样点数
  const DEPTH = 3000;  // 总深度 m
  const STEP = DEPTH / N;

  // 等级颜色
  const GRADE = {
    A: { color: '#3f8560', bg: 'rgba(63,133,96,0.18)', label: '好' },
    B: { color: '#7ab890', bg: 'rgba(122,184,144,0.18)', label: '中' },
    C: { color: '#c9a15a', bg: 'rgba(201,161,90,0.18)', label: '差' },
    D: { color: '#b05a51', bg: 'rgba(176,90,81,0.20)', label: '窜槽' }
  };

  // ---------- 随机数 ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- 合成 CBL ----------
  // 基准分级：A 低幅度 / B 中低 / C 高 / D 极高
  // 基础构造：几段 A + B + C + D
  function generateWell() {
    const rnd = mulberry32(20261023);
    const gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = rnd();
      while (v === 0) v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    // 基础真实等级（沿井深）
    const truth = new Array(N).fill(null);

    // 主体：交替的好胶结段
    let pos = 0;
    while (pos < N) {
      // 随机段长和等级
      const segLen = Math.floor(N * (0.04 + rnd() * 0.08)); // 4-12%
      const r = rnd();
      let grade;
      if (r < 0.45) grade = 'A';
      else if (r < 0.75) grade = 'B';
      else if (r < 0.92) grade = 'C';
      else grade = 'D';
      for (let i = 0; i < segLen && pos + i < N; i++) truth[pos + i] = grade;
      pos += segLen;
    }

    // 用户指定的窜槽段（覆盖）
    const gs = Math.floor(S.gapS / 100 * N);
    const gl = Math.floor(S.gapL / 100 * N);
    for (let i = gs; i < gs + gl && i < N; i++) truth[i] = 'D';

    // 微环隙（假弱胶结）
    if (S.microGap) {
      const ms = Math.floor(0.35 * N);
      const ml = Math.floor(N * 0.03);
      for (let i = ms; i < ms + ml && i < N; i++) truth[i] = truth[i] === 'A' ? 'B' : truth[i];
    }

    // 合成 CBL 幅度：不同等级 + 噪声
    const cbl = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let base;
      if (truth[i] === 'A') base = 80 + gauss() * 12;
      else if (truth[i] === 'B') base = 115 + gauss() * 15;
      else if (truth[i] === 'C') base = 165 + gauss() * 18;
      else base = 240 + gauss() * 25;
      cbl[i] = Math.max(20, base + gauss() * S.noise * 5);
    }

    return { truth, cbl };
  }

  // ---------- AI 分类（简化版 1D CNN 逻辑）----------
  function aiClassify(cbl) {
    const N = cbl.length;
    // 1. 滑窗特征（均值 + 方差）
    const W = 12; // 窗宽（~ 1.5 m）
    const mean = new Float64Array(N), var_ = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0, count = 0;
      for (let j = Math.max(0, i - W); j <= Math.min(N - 1, i + W); j++) { s += cbl[j]; count++; }
      mean[i] = s / count;
      let sv = 0;
      for (let j = Math.max(0, i - W); j <= Math.min(N - 1, i + W); j++) sv += Math.pow(cbl[j] - mean[i], 2);
      var_[i] = sv / count;
    }

    // 2. 基于均值阈值的概率分布（模拟 softmax 输出）
    // 阈值：A<95, B 95-140, C 140-200, D>200
    const probs = new Array(N).fill(null);
    for (let i = 0; i < N; i++) {
      const m = mean[i];
      const v = Math.sqrt(var_[i]);
      // 用高斯分布计算每个等级的 logit
      const pA = Math.exp(-Math.pow((m - 80) / 30, 2));
      const pB = Math.exp(-Math.pow((m - 120) / 35, 2));
      const pC = Math.exp(-Math.pow((m - 175) / 45, 2));
      const pD = Math.exp(-Math.pow((m - 240) / 55, 2));
      const sum = pA + pB + pC + pD + 1e-9;
      probs[i] = {
        A: Math.max(0.05, pA / sum),
        B: Math.max(0.05, pB / sum),
        C: Math.max(0.05, pC / sum),
        D: Math.max(0.05, pD / sum)
      };
      // 归一化
      const s2 = probs[i].A + probs[i].B + probs[i].C + probs[i].D;
      probs[i].A /= s2; probs[i].B /= s2; probs[i].C /= s2; probs[i].D /= s2;
    }

    // 3. CRF-like 平滑：相邻点不能差太远
    const smooth = probs.map(p => ({ ...p }));
    for (let iter = 0; iter < 3; iter++) {
      const old = smooth.map(p => ({ ...p }));
      for (let i = 2; i < N - 2; i++) {
        ['A', 'B', 'C', 'D'].forEach(g => {
          smooth[i][g] = old[i][g] * 0.6 + (old[i-1][g] + old[i+1][g]) * 0.2;
        });
        const s = smooth[i].A + smooth[i].B + smooth[i].C + smooth[i].D;
        smooth[i].A /= s; smooth[i].B /= s; smooth[i].C /= s; smooth[i].D /= s;
      }
    }

    // 4. 取 argmax
    const pred = new Array(N);
    for (let i = 0; i < N; i++) {
      const p = smooth[i];
      let best = 'A', bv = 0;
      ['A', 'B', 'C', 'D'].forEach(g => { if (p[g] > bv) { bv = p[g]; best = g; } });
      pred[i] = { grade: best, prob: smooth[i] };
    }

    // 5. 后处理：合并短段（< 10 点 = ~ 0.1125 m 的段合并）
    const MERGE_THRESH = 12;
    const segs = [];
    let cur = { start: 0, grade: pred[0].grade };
    for (let i = 1; i < N; i++) {
      if (pred[i].grade !== cur.grade) {
        cur.end = i;
        segs.push(cur);
        cur = { start: i, grade: pred[i].grade };
      }
    }
    cur.end = N; segs.push(cur);

    // 合并短段到相邻长段
    const merged = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.end - seg.start < MERGE_THRESH && merged.length > 0) {
        // 合并到前一段
        merged[merged.length - 1].end = seg.end;
      } else {
        merged.push({ ...seg });
      }
    }

    return { probs: smooth, pred, segs: merged };
  }

  // ---------- CBL 曲线渲染 ----------
  function drawCBL(data, ai) {
    const svg = document.getElementById('cbl');
    const W = 760, H = 300, padL = 54, padR = 14, padT = 20, padB = 32;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const YMAX = 300;

    function xOf(i) { return padL + i / (N - 1) * plotW; }
    function yOf(v) { return padT + (1 - v / YMAX) * plotH; }
    function depthOf(i) { return (i / N * DEPTH).toFixed(0); }

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 背景：真实等级段
    for (let g of ['A', 'B', 'C', 'D']) {
      let inSeg = false, ss = 0;
      for (let i = 0; i < N; i++) {
        if (data.truth[i] === g && !inSeg) { inSeg = true; ss = i; }
        if (data.truth[i] !== g && inSeg) {
          s += `<rect x="${xOf(ss)}" y="${padT}" width="${xOf(i) - xOf(ss)}" height="${plotH}" fill="${GRADE[g].bg}"/>`;
          inSeg = false;
        }
      }
      if (inSeg) s += `<rect x="${xOf(ss)}" y="${padT}" width="${xOf(N - 1) - xOf(ss)}" height="${plotH}" fill="${GRADE[g].bg}"/>`;
    }

    // 网格
    [0, 100, 200, 300].forEach(v => {
      const y = yOf(v);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#efece1"/>`;
      s += `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">${v}</text>`;
    });
    for (let d = 0; d <= DEPTH; d += 600) {
      const x = padL + d / DEPTH * plotW;
      s += `<text x="${x}" y="${H - 10}" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${d}m</text>`;
    }

    // AI 分段边界
    ai.segs.forEach(seg => {
      s += `<line x1="${xOf(seg.start)}" y1="${padT}" x2="${xOf(seg.start)}" y2="${padT + plotH}" stroke="#235f51" stroke-width="1" stroke-dasharray="4 3"/>`;
      // 等级标签
      const mid = Math.floor((seg.start + seg.end) / 2);
      s += `<text x="${xOf(mid)}" y="${padT + 14}" font-size="11" font-weight="600" fill="${GRADE[seg.grade].color}" text-anchor="middle">${seg.grade}</text>`;
    });
    // 最后一条边界
    if (ai.segs.length > 0) {
      s += `<line x1="${xOf(ai.segs[ai.segs.length - 1].end)}" y1="${padT}" x2="${xOf(ai.segs[ai.segs.length - 1].end)}" y2="${padT + plotH}" stroke="#235f51" stroke-width="1" stroke-dasharray="4 3"/>`;
    }

    // CBL 曲线
    let path = '';
    for (let i = 0; i < N; i++) path += (i ? 'L' : 'M') + xOf(i).toFixed(1) + ' ' + yOf(Math.min(YMAX, data.cbl[i])).toFixed(1) + ' ';
    s += `<path d="${path}" fill="none" stroke="#242b2e" stroke-width="1.1" stroke-linejoin="round"/>`;

    // 真实边界（红色虚线）
    let inSeg = false, ss = 0, lastGrade = null;
    for (let i = 0; i < N; i++) {
      if (!inSeg || data.truth[i] !== lastGrade) {
        if (inSeg) {
          s += `<line x1="${xOf(ss)}" y1="${padT}" x2="${xOf(ss)}" y2="${padT + plotH}" stroke="#b05a51" stroke-width="1" stroke-dasharray="2 2"/>`;
        }
        ss = i; inSeg = true; lastGrade = data.truth[i];
      }
    }
    if (inSeg) s += `<line x1="${xOf(N - 1)}" y1="${padT}" x2="${xOf(N - 1)}" y2="${padT + plotH}" stroke="#b05a51" stroke-width="1" stroke-dasharray="2 2"/>`;

    s += `<text x="${padL}" y="${padT - 6}" font-size="10" fill="#9ba3a9" font-family="monospace">CBL 幅度 (mV) →</text>`;
    svg.innerHTML = s;

    return { xOf, depthOf };
  }

  // ---------- VDL 渲染（简化）----------
  function drawVDL(data, ai) {
    const canvas = document.getElementById('vdl');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const Nt = 80;   // 时间采样
    const Nd = N;    // 深度采样

    // 清空
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    const cellW = W / Nd, cellH = H / Nt;

    // 每个深度点生成简化的 VDL 图像
    for (let d = 0; d < Nd; d++) {
      const grade = ai.pred[d].grade;
      let casingStrong, formationStrong;
      if (grade === 'A') { casingStrong = 0.3; formationStrong = 0.9; }
      else if (grade === 'B') { casingStrong = 0.5; formationStrong = 0.7; }
      else if (grade === 'C') { casingStrong = 0.8; formationStrong = 0.3; }
      else { casingStrong = 0.95; formationStrong = 0.1; }

      // 时间上：套管波早（t < 25），地层波晚（t > 30）
      for (let t = 0; t < Nt; t++) {
        let intensity;
        if (t < 25) intensity = casingStrong * Math.exp(-Math.pow((t - 12) / 6, 2));
        else if (t > 30) intensity = formationStrong * Math.exp(-Math.pow((t - 55) / 15, 2));
        else intensity = 0;
        intensity = Math.min(1, intensity + (Math.random() - 0.5) * S.noise * 0.08);

        // 颜色：灰度 + 胶结等级轻微色调
        let r, g, b;
        const base = Math.floor(intensity * 255);
        if (grade === 'A') { r = base * 0.7; g = base; b = base * 0.85; }
        else if (grade === 'B') { r = base * 0.9; g = base; b = base * 0.8; }
        else if (grade === 'C') { r = base; g = base * 0.92; b = base * 0.7; }
        else { r = base; g = base * 0.78; b = base * 0.72; }

        ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
        ctx.fillRect(d * cellW, t * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    // 套管波 / 地层波 标注
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '9px monospace';
    ctx.fillText('← 套管波早', 2, 12);
    ctx.fillText('地层波晚 →', W - 60, 12);
  }

  // ---------- 结果表格 ----------
  function drawTable(data, ai) {
    const tbody = document.querySelector('#seg-table tbody');
    const xOf = (i) => (i / N * DEPTH);

    let html = '';
    let tp = 0, fp = 0, fn = 0, tn = 0;

    ai.segs.forEach((seg, idx) => {
      // 真实等级（取段内多数）
      const counts = {};
      for (let i = seg.start; i < seg.end; i++) {
        counts[data.truth[i]] = (counts[data.truth[i]] || 0) + 1;
      }
      let trueGrade = 'A', maxC = 0;
      ['A', 'B', 'C', 'D'].forEach(g => { if ((counts[g] || 0) > maxC) { maxC = counts[g]; trueGrade = g; } });

      const meanCBL = (() => {
        let s = 0, c = 0;
        for (let i = seg.start; i < seg.end; i++) { s += data.cbl[i]; c++; }
        return (s / c).toFixed(1);
      })();

      // 段中点概率
      const mid = Math.floor((seg.start + seg.end) / 2);
      const p = ai.probs[mid];

      // 统计
      if (seg.grade === trueGrade) {
        if (trueGrade === 'D' || trueGrade === 'C') tp++; else tn++;
      } else {
        if (seg.grade === 'D' || seg.grade === 'C') fp++; else fn++;
      }

      // 概率条颜色
      const gColors = { A: '#3f8560', B: '#7ab890', C: '#c9a15a', D: '#b05a51' };

      html += `<tr>
        <td>${idx + 1}</td>
        <td>${xOf(seg.start).toFixed(0)} – ${xOf(seg.end).toFixed(0)}</td>
        <td>${(xOf(seg.end) - xOf(seg.start)).toFixed(0)} m</td>
        <td>${meanCBL}</td>
        <td><span class="grade ${seg.grade.toLowerCase()}">${seg.grade}</span></td>
        <td>
          <div class="prob-cell">
            ${['A', 'B', 'C', 'D'].map(g => `<div class="pb" style="width:${(p[g] * 40).toFixed(1)}px;background:${gColors[g]}"></div>`).join('')}
          </div>
        </td>
        <td><span class="grade ${trueGrade.toLowerCase()}">${trueGrade}</span></td>
      </tr>`;
    });

    tbody.innerHTML = html;

    // 统计
    const total = ai.segs.length;
    const correct = tp + tn;
    const acc = (correct / total * 100).toFixed(0);
    document.getElementById('result-stat').innerHTML =
      `共 ${total} 段 · 一致 ${correct} 段 · <b>段级一致率 ${acc}%</b>`;
  }

  // ---------- 主流程 ----------
  function run() {
    const data = generateWell();
    const ai = aiClassify(data.cbl);
    drawCBL(data, ai);
    drawVDL(data, ai);
    drawTable(data, ai);
  }

  // ---------- 事件 ----------
  function bind() {
    document.getElementById('s-gap-s').addEventListener('input', e => {
      S.gapS = +e.target.value;
      document.getElementById('o-gap-s').textContent = S.gapS;
    });
    document.getElementById('s-gap-l').addEventListener('input', e => {
      S.gapL = +e.target.value;
      document.getElementById('o-gap-l').textContent = S.gapL;
    });
    document.getElementById('s-noise').addEventListener('input', e => {
      S.noise = +e.target.value;
      document.getElementById('o-noise').textContent = ['低', '较低', '中', '较高', '高'][S.noise - 1];
    });
    document.getElementById('c-micro').addEventListener('change', e => {
      S.microGap = e.target.checked;
      document.getElementById('o-micro').textContent = S.microGap ? '开' : '关';
    });
    document.getElementById('btn-run').addEventListener('click', run);
  }

  bind();
  run();
})();
