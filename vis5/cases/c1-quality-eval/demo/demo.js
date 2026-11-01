/* ======= 固井质量 CBL/VDL 智能评价 ======= */
(function () {
  'use strict';

  /* HiDPI 适配：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
  function setupCanvas(cv, lw, lh) {
    const dpr = window.devicePixelRatio || 1;
    const ratio = dpr * ((cv.clientWidth || lw) / lw);
    const bw = Math.max(1, Math.round(lw * ratio));
    const bh = Math.max(1, Math.round(lh * ratio));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  const FPA = 320;
  const N = 600;
  const DEPTH = 3000;
  const STEP = DEPTH / N;

  const GRADE_COLOR = { A: '#2f7d6b', B: '#5fa88a', C: '#c9a15a', D: '#b05a51' };
  const GRADE_BG = { A: 'rgba(47,125,107,0.16)', B: 'rgba(95,168,138,0.16)', C: 'rgba(201,161,90,0.16)', D: 'rgba(176,90,81,0.20)' };
  const BI_MEAN = { A: 0.88, B: 0.68, C: 0.48, D: 0.28 };
  const BI_STD = { A: 0.04, B: 0.05, C: 0.06, D: 0.07 };

  const PARAMS = [
    { id: 'gapStart', label: '窜槽起始位置', unit: '%', min: 10, max: 90, step: 1, value: 40 },
    { id: 'gapLen', label: '窜槽长度', unit: '%', min: 1, max: 25, step: 1, value: 8 },
    { id: 'gapAz', label: '窜槽方位角', unit: '°', min: 0, max: 360, step: 5, value: 90 },
    { id: 'gapWidth', label: '窜槽弧宽', unit: '°', min: 15, max: 180, step: 5, value: 90 },
    { id: 'freeLen', label: '自由套管段长度', unit: '%', min: 0, max: 30, step: 1, value: 5 },
    { id: 'density', label: '水泥密度', unit: 'g/cm³', min: 1.2, max: 2.2, step: 0.01, value: 1.89 },
    { id: 'noise', label: '背景噪声', unit: '', min: 0, max: 5, step: 0.1, value: 1.5 },
    { id: 'microGap', label: '微环隙', unit: 'µm', min: 0, max: 300, step: 10, value: 100 },
    { id: 'formation', label: '地层耦合强度', unit: '%', min: 0, max: 100, step: 1, value: 70 },
    { id: 'minSeg', label: '最小段长', unit: 'm', min: 0.25, max: 2.0, step: 0.05, value: 0.5 },
    { id: 'biThresh', label: 'BI 合格阈值', unit: '', min: 0.5, max: 0.9, step: 0.01, value: 0.8 }
  ];

  const S = {};
  PARAMS.forEach(p => { S[p.id] = p.value; });

  // ===== 邻接环节参数联动（固井工作流共享，key=cementing-shared）=====
  const SHARED_KEY = 'cementing-shared';
  const MY_KEYS = ['density']; // c1 仅共享水泥密度（噪声/微环隙/窜槽等不共享）
  function loadShared() {
    try {
      var s = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}');
      var n = 0;
      MY_KEYS.forEach(function (k) {
        if (k in s && typeof s[k] === 'number') { S[k] = s[k]; n++; }
      });
      return n;
    } catch (e) { return 0; }
  }
  function saveShared() {
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}'); } catch (e) {}
    MY_KEYS.forEach(function (k) { if (typeof S[k] === 'number') cur[k] = S[k]; });
    try { localStorage.setItem(SHARED_KEY, JSON.stringify(cur)); } catch (e) {}
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function generate() {
    const rnd = mulberry32(20261030);
    const truth = new Array(N);
    const bi = new Float64Array(N);

    let pos = 0;
    while (pos < N) {
      const segLen = Math.floor(N * (0.05 + rnd() * 0.10));
      const r = rnd();
      let grade;
      if (r < 0.5) grade = 'A';
      else if (r < 0.8) grade = 'B';
      else grade = 'C';
      for (let i = 0; i < segLen && pos + i < N; i++) truth[pos + i] = grade;
      pos += segLen;
    }

    const freeN = Math.floor(S.freeLen / 100 * N);
    for (let i = 0; i < freeN && i < N; i++) truth[i] = 'D';

    const gs = Math.floor(S.gapStart / 100 * N);
    const gl = Math.floor(S.gapLen / 100 * N);
    for (let i = gs; i < gs + gl && i < N; i++) truth[i] = 'D';

    for (let i = 0; i < N; i++) {
      let b = BI_MEAN[truth[i]] + gauss(rnd) * BI_STD[truth[i]];
      b -= (S.microGap / 300) * 0.15;
      b += gauss(rnd) * S.noise * 0.02;
      b = Math.max(0, Math.min(1, b));
      bi[i] = b;
    }

    const amp = new Float64Array(N);
    const att = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      amp[i] = FPA * (1 - bi[i]);
      att[i] = -20 * Math.log10(Math.max(0.001, amp[i] / FPA));
    }
    return { truth, bi, amp, att };
  }

  function aiClassify(bi) {
    const W = 8;
    const mean = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - W); j <= Math.min(N - 1, i + W); j++) { s += bi[j]; c++; }
      mean[i] = s / c;
    }

    const centers = { A: 0.88, B: 0.68, C: 0.48, D: 0.28 };
    const widths = { A: 0.06, B: 0.07, C: 0.08, D: 0.10 };
    const probs = new Array(N);
    for (let i = 0; i < N; i++) {
      const p = {};
      let sum = 0;
      ['A', 'B', 'C', 'D'].forEach(g => {
        p[g] = Math.exp(-Math.pow((mean[i] - centers[g]) / widths[g], 2));
        sum += p[g];
      });
      ['A', 'B', 'C', 'D'].forEach(g => p[g] /= sum);
      probs[i] = p;
    }

    const smooth = probs.map(p => ({ A: p.A, B: p.B, C: p.C, D: p.D }));
    for (let iter = 0; iter < 3; iter++) {
      const old = smooth.map(p => ({ A: p.A, B: p.B, C: p.C, D: p.D }));
      for (let i = 1; i < N - 1; i++) {
        ['A', 'B', 'C', 'D'].forEach(g => {
          smooth[i][g] = old[i][g] * 0.5 + (old[i - 1][g] + old[i + 1][g]) * 0.25;
        });
        const s = smooth[i].A + smooth[i].B + smooth[i].C + smooth[i].D;
        ['A', 'B', 'C', 'D'].forEach(g => smooth[i][g] /= s);
      }
    }

    const pred = new Array(N);
    for (let i = 0; i < N; i++) {
      const p = smooth[i];
      let best = 'A', bv = 0;
      ['A', 'B', 'C', 'D'].forEach(g => { if (p[g] > bv) { bv = p[g]; best = g; } });
      pred[i] = { grade: best, prob: smooth[i] };
    }

    const minSegN = Math.max(1, Math.floor(S.minSeg / STEP));
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

    const merged = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.end - seg.start < minSegN && merged.length > 0) {
        merged[merged.length - 1].end = seg.end;
      } else {
        merged.push({ start: seg.start, end: seg.end, grade: seg.grade });
      }
    }
    return { mean, probs: smooth, pred, segs: merged };
  }

  function drawWell(data) {
    const svg = document.getElementById('well');
    const W = 400, H = 200, padL = 40, padR = 14, padT = 12, padB = 14;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const wellW = 40;
    const cx = padL + plotW / 2;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf8" rx="6"/>`;

    // 纵剖面彩色条
    let inSeg = false, ss = 0, last = null;
    for (let i = 0; i <= N; i++) {
      const g = i < N ? data.truth[i] : null;
      if (g !== last) {
        if (inSeg) {
          const y0 = padT + ss / N * plotH;
          const y1 = padT + i / N * plotH;
          const fill = last === 'D' && ss < Math.floor(S.freeLen / 100 * N) ? '#d8d4c8' : GRADE_BG[last];
          s += `<rect x="${cx - wellW / 2}" y="${y0}" width="${wellW}" height="${y1 - y0}" fill="${fill}"/>`;
        }
        ss = i; inSeg = true; last = g;
      }
    }

    // 套管壁
    s += `<rect x="${cx - wellW / 2 - 4}" y="${padT}" width="4" height="${plotH}" fill="#8a8578"/>`;
    s += `<rect x="${cx + wellW / 2}" y="${padT}" width="4" height="${plotH}" fill="#8a8578"/>`;

    // 窜槽标记
    const gs = Math.floor(S.gapStart / 100 * N);
    const gl = Math.floor(S.gapLen / 100 * N);
    if (gl > 0) {
      const y0 = padT + gs / N * plotH;
      const y1 = padT + (gs + gl) / N * plotH;
      s += `<rect x="${cx - wellW / 2 - 14}" y="${y0}" width="10" height="${y1 - y0}" fill="#b05a51" opacity="0.7"/>`;
      s += `<text x="${cx - wellW / 2 - 18}" y="${(y0 + y1) / 2 + 3}" font-size="8" fill="#b05a51" text-anchor="end" font-family="monospace">窜槽</text>`;
    }

    // 深度刻度
    for (let d = 0; d <= DEPTH; d += 600) {
      const y = padT + d / DEPTH * plotH;
      s += `<line x1="${padL}" y1="${y}" x2="${cx - wellW / 2 - 4}" y2="${y}" stroke="#e2ddd0"/>`;
      s += `<text x="${padL - 6}" y="${y + 3}" font-size="8" fill="#9ba3a9" text-anchor="end" font-family="monospace">${d}</text>`;
    }
    s += `<text x="${padL - 6}" y="${padT - 4}" font-size="8" fill="#9ba3a9" text-anchor="end">深度 m</text>`;

    svg.innerHTML = s;
  }

  function drawCross() {
    const svg = document.getElementById('cross');
    const W = 400, H = 170, cx = W / 2, cy = H / 2;
    const R = 62, r = 38;
    const ecc = (S.microGap / 300) * 8;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf8" rx="6"/>`;
    // 井眼
    s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#8a8578" stroke-width="2"/>`;
    // 套管（偏心）
    s += `<circle cx="${cx + ecc}" cy="${cy}" r="${r}" fill="none" stroke="#5a554a" stroke-width="2"/>`;

    // 窜槽弧
    const az = S.gapAz * Math.PI / 180;
    const hw = S.gapWidth * Math.PI / 360;
    const a0 = az - hw, a1 = az + hw;
    const x0 = cx + (R + r) / 2 * Math.cos(a0);
    const y0 = cy + (R + r) / 2 * Math.sin(a0);
    const x1 = cx + (R + r) / 2 * Math.cos(a1);
    const y1 = cy + (R + r) / 2 * Math.sin(a1);
    const large = S.gapWidth > 180 ? 1 : 0;
    s += `<path d="M ${x0} ${y0} A ${(R + r) / 2} ${(R + r) / 2} 0 ${large} 1 ${x1} ${y1}" fill="none" stroke="#b05a51" stroke-width="10" stroke-linecap="round"/>`;

    // 方位标注
    s += `<line x1="${cx}" y1="${cy}" x2="${cx + R * 0.6 * Math.cos(az)}" y2="${cy + R * 0.6 * Math.sin(az)}" stroke="#b05a51" stroke-width="1" stroke-dasharray="3 2"/>`;
    s += `<text x="${cx}" y="${cy - R - 8}" font-size="8.5" fill="#79828a" text-anchor="middle">方位 ${S.gapAz}°</text>`;
    s += `<text x="${cx}" y="${cy + R + 15}" font-size="8.5" fill="#79828a" text-anchor="middle">弧宽 ${S.gapWidth}°</text>`;
    svg.innerHTML = s;
  }

  function drawCBL(data, ai) {
    const svg = document.getElementById('cbl');
    const W = 430, H = 190, padL = 34, padR = 34, padT = 12, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const AMAX = FPA;
    const ATMAX = 40;

    function xOf(i) { return padL + i / (N - 1) * plotW; }
    function yAmp(v) { return padT + (1 - v / AMAX) * plotH; }
    function yAtt(v) { return padT + (1 - v / ATMAX) * plotH; }

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf8" rx="6"/>`;

    // 真值底色
    let inSeg = false, ss = 0, last = null;
    for (let i = 0; i <= N; i++) {
      const g = i < N ? data.truth[i] : null;
      if (g !== last) {
        if (inSeg) {
          const freeN = Math.floor(S.freeLen / 100 * N);
          const fill = last === 'D' && ss < freeN ? 'rgba(216,212,200,0.5)' : GRADE_BG[last];
          s += `<rect x="${xOf(ss)}" y="${padT}" width="${xOf(i) - xOf(ss)}" height="${plotH}" fill="${fill}"/>`;
        }
        ss = i; inSeg = true; last = g;
      }
    }

    // 网格 + 左轴(幅度)
    [0, 80, 160, 240, 320].forEach(v => {
      const y = yAmp(v);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#ece7d8"/>`;
      s += `<text x="${padL - 6}" y="${y + 3}" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${v}</text>`;
    });
    // 右轴(衰减)
    [0, 10, 20, 30, 40].forEach(v => {
      const y = yAtt(v);
      s += `<text x="${padL + plotW + 6}" y="${y + 3}" font-size="7.5" fill="#c9a15a" text-anchor="start" font-family="monospace">${v}</text>`;
    });
    // 深度轴
    for (let d = 0; d <= DEPTH; d += 500) {
      const x = padL + d / DEPTH * plotW;
      // 与底部轴标题"井深 m"同一列的刻度不画，避免压字
      if (Math.abs(x - (padL + plotW / 2)) < 40) continue;
      s += `<text x="${x}" y="${H - 7}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${d}</text>`;
    }

    // BI 阈值线 → 对应幅度
    const threshAmp = FPA * (1 - S.biThresh);
    s += `<line x1="${padL}" y1="${yAmp(threshAmp)}" x2="${padL + plotW}" y2="${yAmp(threshAmp)}" stroke="#2f7d6b" stroke-width="1" stroke-dasharray="5 3"/>`;
    s += `<text x="${padL + plotW - 4}" y="${yAmp(threshAmp) - 4}" font-size="8" fill="#2f7d6b" text-anchor="end" font-family="monospace">BI=${S.biThresh.toFixed(2)}</text>`;

    // AI 分段边界
    ai.segs.forEach(seg => {
      s += `<line x1="${xOf(seg.start)}" y1="${padT}" x2="${xOf(seg.start)}" y2="${padT + plotH}" stroke="#2f7d6b" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.6"/>`;
    });

    // 衰减率曲线（右轴，橙虚线）
    let path = '';
    for (let i = 0; i < N; i++) path += (i ? 'L' : 'M') + xOf(i).toFixed(1) + ' ' + yAtt(Math.min(ATMAX, data.att[i])).toFixed(1) + ' ';
    s += `<path d="${path}" fill="none" stroke="#c9a15a" stroke-width="1" stroke-dasharray="4 2" opacity="0.85"/>`;

    // CBL 幅度曲线（左轴，深色实线）
    path = '';
    for (let i = 0; i < N; i++) path += (i ? 'L' : 'M') + xOf(i).toFixed(1) + ' ' + yAmp(Math.min(AMAX, data.amp[i])).toFixed(1) + ' ';
    s += `<path d="${path}" fill="none" stroke="#242b2e" stroke-width="1.1" stroke-linejoin="round"/>`;

    // 轴标签
    s += `<text x="${padL}" y="${padT - 4}" font-size="8" fill="#9ba3a9" font-family="monospace">幅度 mV</text>`;
    s += `<text x="${padL + plotW}" y="${padT - 4}" font-size="8" fill="#c9a15a" text-anchor="end" font-family="monospace">衰减 dB/ft</text>`;
    s += `<text x="${padL + plotW / 2}" y="${H - 1}" font-size="8" fill="#9ba3a9" text-anchor="middle">井深 m</text>`;

    svg.innerHTML = s;
  }

  function drawVDL(data, ai) {
    const canvas = document.getElementById('vdl');
    const W = 430, H = 150;
    const ctx = setupCanvas(canvas, W, H);
    const Nt = 80;
    const cellW = W / N, cellH = H / Nt;

    ctx.fillStyle = '#fdfcf8';
    ctx.fillRect(0, 0, W, H);

    const formFactor = S.formation / 100;
    for (let d = 0; d < N; d++) {
      const grade = ai.pred[d].grade;
      let casingStrong, formationStrong;
      if (grade === 'A') { casingStrong = 0.25; formationStrong = 0.9 * formFactor; }
      else if (grade === 'B') { casingStrong = 0.45; formationStrong = 0.7 * formFactor; }
      else if (grade === 'C') { casingStrong = 0.75; formationStrong = 0.35 * formFactor; }
      else { casingStrong = 0.95; formationStrong = 0.12 * formFactor; }

      for (let t = 0; t < Nt; t++) {
        let intensity;
        if (t < 28) intensity = casingStrong * Math.exp(-Math.pow((t - 13) / 6, 2));
        else if (t > 34) intensity = formationStrong * Math.exp(-Math.pow((t - 56) / 14, 2));
        else intensity = 0;
        intensity = Math.max(0, Math.min(1, intensity + (Math.random() - 0.5) * S.noise * 0.06));

        const base = Math.floor(intensity * 255);
        let r, g, b;
        if (grade === 'A') { r = base * 0.7; g = base; b = base * 0.85; }
        else if (grade === 'B') { r = base * 0.88; g = base; b = base * 0.82; }
        else if (grade === 'C') { r = base; g = base * 0.92; b = base * 0.72; }
        else { r = base; g = base * 0.78; b = base * 0.72; }

        ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
        ctx.fillRect(d * cellW, t * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    ctx.fillStyle = '#79828a';
    ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.fillText('套管波', 5, 12);
    ctx.fillText('地层波', 5, H - 6);
  }

  function drawMetrics(data, ai) {
    let agree = 0;
    let dTotal = 0, dHit = 0;
    ai.segs.forEach(seg => {
      const counts = {};
      for (let i = seg.start; i < seg.end; i++) counts[data.truth[i]] = (counts[data.truth[i]] || 0) + 1;
      let trueGrade = 'A', maxC = 0;
      ['A', 'B', 'C', 'D'].forEach(g => { if ((counts[g] || 0) > maxC) { maxC = counts[g]; trueGrade = g; } });
      if (seg.grade === trueGrade) agree++;
      if (trueGrade === 'D') { dTotal++; if (seg.grade === 'D') dHit++; }
    });
    const agreeRate = ai.segs.length ? (agree / ai.segs.length * 100).toFixed(0) : 0;
    const recall = dTotal ? (dHit / dTotal * 100).toFixed(0) : '—';

    let pass = 0;
    for (let i = 0; i < N; i++) if (data.bi[i] >= S.biThresh) pass++;
    const passRate = (pass / N * 100).toFixed(0);

    document.getElementById('m-seg').textContent = ai.segs.length;
    const agreeEl = document.getElementById('m-agree');
    agreeEl.textContent = agreeRate + '%';
    agreeEl.parentElement.className = 'metric' + (+agreeRate < 70 ? ' bad' : '');

    const recallEl = document.getElementById('m-recall');
    recallEl.textContent = recall + '%';
    recallEl.parentElement.className = 'metric' + (recall !== '—' && +recall < 70 ? ' warn' : '');

    const passEl = document.getElementById('m-pass');
    passEl.textContent = passRate + '%';
    passEl.parentElement.className = 'metric' + (+passRate < 60 ? ' warn' : '');
  }

  function drawTable(data, ai) {
    const tbody = document.getElementById('seg-body');
    let html = '';
    ai.segs.forEach((seg, idx) => {
      const counts = {};
      let cblSum = 0, biSum = 0;
      for (let i = seg.start; i < seg.end; i++) {
        counts[data.truth[i]] = (counts[data.truth[i]] || 0) + 1;
        cblSum += data.amp[i];
        biSum += data.bi[i];
      }
      const len = seg.end - seg.start;
      let trueGrade = 'A', maxC = 0;
      ['A', 'B', 'C', 'D'].forEach(g => { if ((counts[g] || 0) > maxC) { maxC = counts[g]; trueGrade = g; } });

      const mid = Math.floor((seg.start + seg.end) / 2);
      const p = ai.probs[mid];
      const dStart = (seg.start / N * DEPTH).toFixed(0);
      const dEnd = (seg.end / N * DEPTH).toFixed(0);

      const probBars = ['A', 'B', 'C', 'D'].map(g =>
        `<i style="width:${(p[g] * 100).toFixed(0)}%;background:${GRADE_COLOR[g]}"></i>`
      ).join('');

      html += `<tr>
        <td>${idx + 1}</td>
        <td class="mono">${dStart}–${dEnd}</td>
        <td class="mono">${(dEnd - dStart)}</td>
        <td class="mono">${(cblSum / len).toFixed(1)}</td>
        <td class="mono">${(biSum / len).toFixed(3)}</td>
        <td><span class="grade ${seg.grade.toLowerCase()}">${seg.grade}</span></td>
        <td><div class="prob-bar">${probBars}</div></td>
        <td><span class="grade ${trueGrade.toLowerCase()}">${trueGrade}</span></td>
      </tr>`;
    });
    tbody.innerHTML = html;
  }

  function buildControls() {
    const wrap = document.getElementById('controls');
    wrap.innerHTML = PARAMS.map(p => `
      <div class="ctl">
        <div class="ctl-top">
          <label>${p.label}${p.unit ? ' (' + p.unit + ')' : ''}</label>
          <output id="o-${p.id}">${p.value}</output>
        </div>
        <input type="range" id="s-${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">
      </div>
    `).join('');
    PARAMS.forEach(p => {
      const el = document.getElementById('s-' + p.id);
      const out = document.getElementById('o-' + p.id);
      el.addEventListener('input', e => {
        const v = +e.target.value;
        S[p.id] = v;
        out.textContent = v;
        saveShared();
        run();
      });
    });
  }

  var LAST_SIM = null;
  function run() {
    const data = generate();
    const ai = aiClassify(data.bi);
    LAST_SIM = { data: data, ai: ai };
    drawWell(data);
    drawCross();
    drawCBL(data, ai);
    drawVDL(data, ai);
    drawMetrics(data, ai);
    drawTable(data, ai);
  }

  // ===== 方案对比面板：计算指定参数状态下的关键指标 =====
  // 推荐方案：低噪声、无窜槽、BI 阈值 0.8
  const REC_PARAMS = { noise: 0.5, microGap: 0, gapLen: 0, biThresh: 0.8, density: 1.89 };
  function computeMetricsWith(state) {
    // 临时替换 S 中的参数，计算后恢复
    var orig = {};
    Object.keys(state).forEach(function (k) { orig[k] = S[k]; S[k] = state[k]; });
    var data = generate();
    var ai = aiClassify(data.bi);
    var agree = 0, dTotal = 0, dHit = 0;
    ai.segs.forEach(function (seg) {
      var counts = {};
      for (var i = seg.start; i < seg.end; i++) counts[data.truth[i]] = (counts[data.truth[i]] || 0) + 1;
      var tg = 'A', mx = 0;
      ['A', 'B', 'C', 'D'].forEach(function (g) { if ((counts[g] || 0) > mx) { mx = counts[g]; tg = g; } });
      if (seg.grade === tg) agree++;
      if (tg === 'D') { dTotal++; if (seg.grade === 'D') dHit++; }
    });
    var agreeRate = ai.segs.length ? (agree / ai.segs.length * 100).toFixed(0) : '0';
    var recall = dTotal ? (dHit / dTotal * 100).toFixed(0) : '—';
    var pass = 0;
    for (var j = 0; j < N; j++) if (data.bi[j] >= S.biThresh) pass++;
    var passRate = (pass / N * 100).toFixed(0);
    Object.keys(orig).forEach(function (k) { S[k] = orig[k]; });
    return { agree: agreeRate, recall: recall, pass: passRate };
  }

  function renderCompare() {
    var cur = computeMetricsWith({});
    var rec = computeMetricsWith(REC_PARAMS);
    document.getElementById('c-cur-agree').textContent = cur.agree + '%';
    document.getElementById('c-cur-recall').textContent = cur.recall + '%';
    document.getElementById('c-cur-pass').textContent = cur.pass + '%';
    document.getElementById('c-rec-agree').textContent = rec.agree + '%';
    document.getElementById('c-rec-recall').textContent = rec.recall + '%';
    document.getElementById('c-rec-pass').textContent = rec.pass + '%';
  }

  function updateSyncNote(n) {
    var note = document.getElementById('sync-note');
    note.innerHTML =
      '邻接参数联动：已同步 ' + n + ' 个共享参数（水泥密度…）' +
      '<button id="btn-clear-shared">清空共享参数</button>';
    var btn = document.getElementById('btn-clear-shared');
    if (btn) btn.addEventListener('click', clearShared);
  }

  function clearShared() {
    localStorage.removeItem(SHARED_KEY);
    PARAMS.forEach(function (p) { S[p.id] = p.value; });
    PARAMS.forEach(function (p) {
      var el = document.getElementById('s-' + p.id);
      var out = document.getElementById('o-' + p.id);
      if (el) { el.value = S[p.id]; out.textContent = S[p.id]; }
    });
    updateSyncNote(0);
    run();
    renderCompare();
  }

  function applyRecommended() {
    Object.keys(REC_PARAMS).forEach(function (k) { S[k] = REC_PARAMS[k]; });
    PARAMS.forEach(function (p) {
      var el = document.getElementById('s-' + p.id);
      var out = document.getElementById('o-' + p.id);
      if (el) { el.value = S[p.id]; out.textContent = S[p.id]; }
    });
    saveShared();
    run();
    renderCompare();
  }

  // ===== 初始化：先默认值，再 loadShared 覆盖，再同步 slider，再渲染 =====
  buildControls();
  var sharedCount = loadShared();
  // 同步 slider 值为 S（可能被 loadShared 覆盖）
  PARAMS.forEach(function (p) {
    var el = document.getElementById('s-' + p.id);
    var out = document.getElementById('o-' + p.id);
    if (el) { el.value = S[p.id]; out.textContent = S[p.id]; }
  });
  updateSyncNote(sharedCount);
  saveShared();
  run();
  renderCompare();

  document.getElementById('btn-apply-rec').addEventListener('click', applyRecommended);
  document.getElementById('btn-cur').addEventListener('click', renderCompare);

  /* =========================================================
     真实井段：Utah FORGE 56-32（CBL/TT，不含 VDL 原始波形）
     ========================================================= */
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  var REAL = window.__C1_REAL__;

  function gradeOfRel(r) {
    return r <= 20 ? 'A' : r <= 30 ? 'B' : r <= 40 ? 'C' : 'D';
  }

  function analyzeReal() {
    var d = REAL;
    var n = d.cbl.length;
    var fpa = d.fpa;
    var rel = new Float64Array(n);
    var bi = new Float64Array(n);
    var form = new Float64Array(n);
    var ref = new Array(n);

    for (var i = 0; i < n; i++) {
      rel[i] = d.cbl[i] / fpa * 100;
      bi[i] = clamp01(1 - d.cbl[i] / fpa);
      /* 第二界面耦合代理：无 VDL 原始波形，用相对幅度与声波时差的单调映射，
         仅作教学演示，不代表独立测量。 */
      form[i] = clamp01(0.98 - rel[i] / 100 * 1.05 + (d.tt[i] - 290) * 0.0025);
      ref[i] = gradeOfRel(rel[i]);
    }

    /* 平滑 + 高斯类概率（演示用规则分类器，非训练模型）
       按拼接段分别平滑与分段，避免人工拼接边界产生跨段伪影。 */
    var W = 8;
    var centers = { A: 0.90, B: 0.75, C: 0.65, D: 0.35 };
    var widths = { A: 0.10, B: 0.07, C: 0.08, D: 0.13 };
    var mean = new Float64Array(n);
    var probs = new Array(n);
    var pred = new Array(n);
    var merged = [];
    var minLen = 4;

    REAL.blocks.forEach(function (b) {
      var s0 = b.start, s1 = b.end;

      /* 段内滑动平均，窗口在拼接边界处截断 */
      for (var k = s0; k < s1; k++) {
        var sum = 0, cnt = 0;
        for (var j = Math.max(s0, k - W); j <= Math.min(s1 - 1, k + W); j++) { sum += bi[j]; cnt++; }
        mean[k] = sum / cnt;
      }

      var localProbs = [];
      for (var p = s0; p < s1; p++) {
        var pr = {}, tot = 0;
        ['A', 'B', 'C', 'D'].forEach(function (g) {
          pr[g] = Math.exp(-Math.pow((mean[p] - centers[g]) / widths[g], 2));
          tot += pr[g];
        });
        ['A', 'B', 'C', 'D'].forEach(function (g) { pr[g] /= tot; });
        localProbs.push(pr);
      }

      var smooth = localProbs.map(function (q) { return { A: q.A, B: q.B, C: q.C, D: q.D }; });
      var len = s1 - s0;
      for (var it = 0; it < 3; it++) {
        var old = smooth.map(function (q) { return { A: q.A, B: q.B, C: q.C, D: q.D }; });
        for (var m = 1; m < len - 1; m++) {
          ['A', 'B', 'C', 'D'].forEach(function (g) {
            smooth[m][g] = old[m][g] * 0.5 + (old[m - 1][g] + old[m + 1][g]) * 0.25;
          });
          var tt2 = smooth[m].A + smooth[m].B + smooth[m].C + smooth[m].D;
          ['A', 'B', 'C', 'D'].forEach(function (g) { smooth[m][g] /= tt2; });
        }
      }

      for (var q = 0; q < len; q++) {
        var pp = smooth[q];
        var best = 'A', bv = 0;
        ['A', 'B', 'C', 'D'].forEach(function (g) {
          if (pp[g] > bv) { bv = pp[g]; best = g; }
        });
        pred[s0 + q] = { grade: best, conf: bv, prob: pp };
        probs[s0 + q] = pp;
      }

      var segs = [];
      var cur = { start: s0, grade: pred[s0].grade };
      for (var t = s0 + 1; t < s1; t++) {
        if (pred[t].grade !== cur.grade) { cur.end = t; segs.push(cur); cur = { start: t, grade: pred[t].grade }; }
      }
      cur.end = s1; segs.push(cur);

      var localMerged = [];
      for (var u = 0; u < segs.length; u++) {
        var g = segs[u];
        if (g.end - g.start < minLen && localMerged.length > 0) {
          localMerged[localMerged.length - 1].end = g.end;
        } else {
          localMerged.push({ start: g.start, end: g.end, grade: g.grade });
        }
      }
      merged = merged.concat(localMerged);
    });

    merged.forEach(function (g) {
      var counts = { A: 0, B: 0, C: 0, D: 0 };
      var confSum = 0;
      for (var x = g.start; x < g.end; x++) { counts[ref[x]]++; confSum += pred[x].conf; }
      var tg = 'A', mx = 0;
      ['A', 'B', 'C', 'D'].forEach(function (gg) { if (counts[gg] > mx) { mx = counts[gg]; tg = gg; } });
      g.refMajor = tg;
      g.conf = confSum / (g.end - g.start);
    });

    return { n: n, rel: rel, bi: bi, form: form, ref: ref, mean: mean, probs: probs, pred: pred, segs: merged, fpa: fpa };
  }

  function blockOfIndex(idx) {
    var bs = REAL.blocks;
    for (var i = 0; i < bs.length; i++) if (idx >= bs[i].start && idx < bs[i].end) return i;
    return bs.length - 1;
  }

  function segDepthLabel(g) {
    var d0 = REAL.depth[g.start], d1 = REAL.depth[g.end - 1];
    var b0 = blockOfIndex(g.start), b1 = blockOfIndex(g.end - 1);
    if (b0 === b1) return d0 + '–' + d1;
    return d0 + '–' + d1 + ' *';
  }

  var RA = null;
  var RI = { hover: -1, seg: -1, gain: 1.0, z0: 0, z1: 1 };
  var VDL_OFF = null;
  var MINSPAN = 40; // 最小视窗（1 ft/点），避免放大到失去参考意义
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function zoomDepthLabel(a, b) {
    var d0 = REAL.depth[clamp(a, 0, REAL.depth.length - 1)];
    var d1 = REAL.depth[clamp(b - 1, 0, REAL.depth.length - 1)];
    return d0 + '–' + d1 + ' ft';
  }
  function updateZoomLabel() {
    var el = document.getElementById('z-label');
    if (!el) return;
    if (!RA) { el.textContent = '视窗 —'; return; }
    var full = (RI.z0 === 0 && RI.z1 === RA.n);
    el.textContent = '视窗 ' + zoomDepthLabel(RI.z0, RI.z1) + (full ? '（全段）' : ' · 跨度 ' + (RI.z1 - RI.z0) + ' ft');
  }

  var zoomRaf = 0;
  function setZoom(a, b) {
    if (!RA) return;
    var n = RA.n;
    a = Math.round(a); b = Math.round(b);
    var span = b - a;
    if (span < MINSPAN) {
      var c = (a + b) / 2;
      a = Math.round(c - MINSPAN / 2); b = a + MINSPAN;
    }
    if (a < 0) { b -= a; a = 0; }
    if (b > n) { a -= (b - n); b = n; }
    a = clamp(a, 0, n); b = clamp(b, a, n);
    if (b - a < MINSPAN) { b = n; a = Math.max(0, n - MINSPAN); }
    RI.z0 = a; RI.z1 = b;
    if (RI.hover >= 0 && (RI.hover < a || RI.hover >= b)) RI.hover = -1;
    if (zoomRaf) return;
    zoomRaf = requestAnimationFrame(function () {
      zoomRaf = 0;
      if (!RA) return;
      drawRealCBL(RA);
      buildVDLOff(RA);
      paintVDL(RA);
      applyCrosshair();
      updateZoomLabel();
    });
  }

  function resetZoom() {
    if (!RA) return;
    RI.hover = -1;
    setZoom(0, RA.n);
    hideTip('r-cbl-tip');
    hideTip('r-vdl-tip');
  }

  function drawRealCBL(ra) {
    var svg = document.getElementById('r-cbl');
    if (!svg) return;
    var W = 900, H = 300, pl = 52, pr = 62, pt = 32, pb = 34;
    var pw = W - pl - pr, ph = H - pt - pb;
    var a = RI.z0, b = RI.z1, m = Math.max(2, b - a);
    var AMAX = 65;

    function xOf(i) { return pl + (i - a) / (m - 1) * pw; }
    function yAmp(v) { return pt + (1 - Math.min(AMAX, v) / AMAX) * ph; }
    function yR(v) { return pt + (1 - v) * ph; }

    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfcf8" rx="6"/>';

    /* 分段底色 + 顶部标签（仅绘制与视窗相交的部分） */
    REAL.blocks.forEach(function (blk, idx) {
      var s0 = Math.max(blk.start, a), s1 = Math.min(blk.end, b);
      if (s1 <= s0) return;
      var x0 = xOf(s0), x1 = xOf(s1 - 1);
      if (idx % 2 === 1) s += '<rect x="' + x0 + '" y="' + pt + '" width="' + Math.max(1, x1 - x0) + '" height="' + ph + '" fill="#f4f1e7"/>';
      if (x1 - x0 > 96) {
        s += '<text x="' + ((x0 + x1) / 2) + '" y="' + (pt - 15) + '" font-size="9.5" fill="#4d565b" text-anchor="middle" font-weight="600">' + blk.label + '</text>';
        s += '<text x="' + ((x0 + x1) / 2) + '" y="' + (pt - 4) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + blk.top + '–' + blk.bottom + ' ft</text>';
      }
    });
    REAL.blocks.forEach(function (blk, idx) {
      if (idx === 0 || blk.start < a || blk.start >= b) return;
      var x = xOf(blk.start);
      s += '<line x1="' + x + '" y1="' + pt + '" x2="' + x + '" y2="' + (pt + ph) + '" stroke="#b9b1a0" stroke-width="1.2"/>';
    });

    /* 网格：左轴幅度；右轴 BI */
    [0, 20, 40, 60].forEach(function (v) {
      var y = yAmp(v);
      s += '<line x1="' + pl + '" y1="' + y + '" x2="' + (pl + pw) + '" y2="' + y + '" stroke="#ece7d8"/>';
      s += '<text x="' + (pl - 6) + '" y="' + (y + 3) + '" font-size="8" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var y = yR(v);
      s += '<text x="' + (pl + pw + 6) + '" y="' + (y + 3) + '" font-size="8" fill="#2f7d6b" text-anchor="start" font-family="monospace">' + v.toFixed(2) + '</text>';
    });

    /* FPA 基准 */
    var yFpa = yAmp(ra.fpa);
    s += '<line x1="' + pl + '" y1="' + yFpa + '" x2="' + (pl + pw) + '" y2="' + yFpa + '" stroke="#9a9486" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + (pl + pw - 3) + '" y="' + (yFpa - 4) + '" font-size="8.5" fill="#7d776a" text-anchor="end" font-family="monospace">FPA ' + ra.fpa.toFixed(1) + ' mV</text>';

    /* AI 分段边界（仅视窗内） */
    ra.segs.forEach(function (g) {
      if (g.start === 0 || g.start < a || g.start >= b) return;
      var x = xOf(g.start);
      s += '<line x1="' + x + '" y1="' + pt + '" x2="' + x + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.65"/>';
    });

    /* 曲线：按视窗重采样，放大后自动加密 */
    var step = Math.max(1, Math.round(m / 360));
    var path = '';
    var lastI = -1;
    for (var i = a; i < b; i += step) {
      path += (i === a ? 'M' : 'L') + xOf(i).toFixed(1) + ' ' + yAmp(REAL.cbl[i]).toFixed(1) + ' ';
      lastI = i;
    }
    if (lastI !== b - 1) path += 'L' + xOf(b - 1).toFixed(1) + ' ' + yAmp(REAL.cbl[b - 1]).toFixed(1);
    s += '<path d="' + path + '" fill="none" stroke="#242b2e" stroke-width="1.1" stroke-linejoin="round"/>';

    /* BI 曲线 */
    path = ''; lastI = -1;
    for (var j = a; j < b; j += step) {
      path += (j === a ? 'M' : 'L') + xOf(j).toFixed(1) + ' ' + yR(ra.bi[j]).toFixed(1) + ' ';
      lastI = j;
    }
    if (lastI !== b - 1) path += 'L' + xOf(b - 1).toFixed(1) + ' ' + yR(ra.bi[b - 1]).toFixed(1);
    s += '<path d="' + path + '" fill="none" stroke="#2f7d6b" stroke-width="1.4" opacity="0.9"/>';

    /* 第二界面代理评分 */
    path = ''; lastI = -1;
    for (var q = a; q < b; q += step) {
      path += (q === a ? 'M' : 'L') + xOf(q).toFixed(1) + ' ' + yR(ra.form[q]).toFixed(1) + ' ';
      lastI = q;
    }
    if (lastI !== b - 1) path += 'L' + xOf(b - 1).toFixed(1) + ' ' + yR(ra.form[b - 1]).toFixed(1);
    s += '<path d="' + path + '" fill="none" stroke="#c9a15a" stroke-width="1" stroke-dasharray="4 2" opacity="0.9"/>';

    /* 参考评级色带（仅视窗内） */
    var stripY = pt + ph + 8, stripH = 8;
    s += '<text x="' + (pl - 6) + '" y="' + (stripY + 7) + '" font-size="8" fill="#9ba3a9" text-anchor="end">参考</text>';
    var runStart = a;
    for (var r2 = a + 1; r2 <= b; r2++) {
      if (r2 === b || ra.ref[r2] !== ra.ref[runStart]) {
        s += '<rect x="' + xOf(runStart) + '" y="' + stripY + '" width="' + Math.max(1, xOf(r2 - 1) - xOf(runStart) + 1) + '" height="' + stripH + '" fill="' + GRADE_COLOR[ra.ref[runStart]] + '"/>';
        runStart = r2;
      }
    }
    s += '<rect x="' + pl + '" y="' + stripY + '" width="' + pw + '" height="' + stripH + '" fill="none" stroke="#e0d9c8"/>';

    /* 轴标题：显示当前深度视窗 */
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle">深度视窗 ' + zoomDepthLabel(a, b) + '（1 ft/点）</text>';

    /* 选中分段高亮（裁剪到视窗） */
    if (RI.seg >= 0 && ra.segs[RI.seg]) {
      var sg = ra.segs[RI.seg];
      var hs = Math.max(sg.start, a), he = Math.min(sg.end, b);
      if (he > hs) {
        var hx0 = xOf(hs), hx1 = xOf(he - 1);
        s += '<rect x="' + hx0 + '" y="' + pt + '" width="' + Math.max(2, hx1 - hx0) + '" height="' + ph + '" fill="rgba(201,161,90,0.10)" stroke="#b05a51" stroke-width="1.3"/>';
      }
    }

    /* 悬停十字线 */
    s += '<g id="r-cross" style="display:none">'
      + '<line id="r-cross-line" y1="' + pt + '" y2="' + (pt + ph) + '" stroke="#8a9298" stroke-width="1" stroke-dasharray="3 2"/>'
      + '<circle id="r-cross-cbl" r="3.2" fill="#242b2e" stroke="#fff" stroke-width="1.2"/>'
      + '<circle id="r-cross-bi" r="3" fill="#2f7d6b" stroke="#fff" stroke-width="1.2"/>'
      + '</g>';

    svg.innerHTML = s;
  }

  function vdlAmps(grade) {
    if (grade === 'A') return { casing: 0.22, formation: 0.92 };
    if (grade === 'B') return { casing: 0.42, formation: 0.72 };
    if (grade === 'C') return { casing: 0.72, formation: 0.38 };
    return { casing: 0.95, formation: 0.10 };
  }

  function buildVDLOff(ra) {
    var cv = document.getElementById('r-vdl');
    if (!cv) return;
    var W = 900, H = 160, Nt = 60;
    var z0 = RI.z0, z1 = RI.z1, m = Math.max(1, z1 - z0);
    var cellW = W / m, cellH = H / Nt;
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    var ctx = off.getContext('2d');
    ctx.fillStyle = '#fdfcf8';
    ctx.fillRect(0, 0, W, H);

    for (var d = z0; d < z1; d++) {
      var grade = ra.pred[d].grade;
      var amps = vdlAmps(grade);
      for (var t = 0; t < Nt; t++) {
        var intensity;
        if (t < 20) intensity = amps.casing * Math.exp(-Math.pow((t - 9) / 4.5, 2));
        else if (t > 25) intensity = amps.formation * Math.exp(-Math.pow((t - 41) / 10, 2));
        else intensity = 0;
        var base = Math.floor(clamp01(intensity * RI.gain) * 255);
        var rr, gg, bb;
        if (grade === 'A') { rr = base * 0.7; gg = base; bb = base * 0.85; }
        else if (grade === 'B') { rr = base * 0.88; gg = base; bb = base * 0.82; }
        else if (grade === 'C') { rr = base; gg = base * 0.92; bb = base * 0.72; }
        else { rr = base; gg = base * 0.78; bb = base * 0.72; }
        ctx.fillStyle = 'rgb(' + Math.floor(rr) + ',' + Math.floor(gg) + ',' + Math.floor(bb) + ')';
        ctx.fillRect((d - z0) * cellW, t * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    VDL_OFF = off;
  }

  function paintVDL(ra) {
    var cv = document.getElementById('r-vdl');
    if (!cv || !VDL_OFF) return;
    var W = 900, H = 160;
    var ctx = setupCanvas(cv, W, H);
    var z0 = RI.z0, z1 = RI.z1, m = Math.max(1, z1 - z0);
    function px(i) { return (i - z0) / m * W; }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(VDL_OFF, 0, 0);

    /* 选中分段范围（裁剪到视窗） */
    if (RI.seg >= 0 && ra.segs[RI.seg]) {
      var sg = ra.segs[RI.seg];
      var s0 = Math.max(sg.start, z0), s1 = Math.min(sg.end, z1);
      if (s1 > s0) {
        var sx0 = px(s0), sx1 = px(s1);
        ctx.fillStyle = 'rgba(201,161,90,0.16)';
        ctx.fillRect(sx0, 0, Math.max(2, sx1 - sx0), H);
        ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1.4;
        ctx.strokeRect(sx0 + 0.7, 0.7, Math.max(2, sx1 - sx0) - 1.4, H - 1.4);
      }
    }

    /* 分段边界（仅视窗内） */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    REAL.blocks.forEach(function (blk, idx) {
      if (idx === 0 || blk.start <= z0 || blk.start >= z1) return;
      var x = px(blk.start);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    });
    ctx.restore();

    /* 分段标签：只保留视窗内且足够宽的块 */
    ctx.font = '10px Consolas, monospace';
    REAL.blocks.forEach(function (blk) {
      var s0 = Math.max(blk.start, z0), s1 = Math.min(blk.end, z1);
      if (s1 <= s0) return;
      var x0 = px(s0), x1 = px(s1);
      if (x1 - x0 < 150) return;
      var cx = (x0 + x1) / 2;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(253,252,248,0.85)';
      ctx.fillRect(cx - 62, 2, 124, 14);
      ctx.fillStyle = '#4d565b';
      ctx.fillText(blk.label + ' · ' + blk.top + '–' + blk.bottom + ' ft', cx, 13);
    });

    /* 视窗角标（右下角，避开顶部分段标签） */
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9ba3a9';
    ctx.fillText('视窗 ' + zoomDepthLabel(z0, z1), W - 6, H - 6);

    /* 角标 */
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9a7a1c';
    ctx.fillText('模拟 VDL（非原始波形）', 6, H - 6);
    ctx.fillStyle = '#79828a';
    ctx.fillText('套管波 ↑', 6, 26);
    ctx.fillText('地层波 ↓', 6, H - 20);

    /* 悬停深度线 */
    if (RI.hover >= 0 && RI.hover >= z0 && RI.hover < z1) {
      var hx = (RI.hover - z0 + 0.5) / m * W;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, H); ctx.stroke();
      ctx.strokeStyle = '#b05a51'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, H); ctx.stroke();
    }
  }

  function drawRealVDL(ra) {
    buildVDLOff(ra);
    paintVDL(ra);
  }

  function drawRealMetrics(ra) {
    var agree = 0, dTotal = 0, dHit = 0, confSum = 0, lenSum = 0;
    ra.segs.forEach(function (g) {
      var len = g.end - g.start;
      if (g.grade === g.refMajor) agree++;
      confSum += g.conf * len; lenSum += len;
    });
    /* D 级召回按样本统计，与下方混淆矩阵同一口径 */
    for (var i = 0; i < ra.n; i++) {
      if (ra.ref[i] === 'D') { dTotal++; if (ra.pred[i].grade === 'D') dHit++; }
    }
    var agreeRate = ra.segs.length ? (agree / ra.segs.length * 100) : 0;
    var recall = dTotal ? (dHit / dTotal * 100) : NaN;
    var conf = lenSum ? confSum / lenSum : 0;

    document.getElementById('r-fpa').textContent = ra.fpa.toFixed(1) + ' mV';

    var el = document.getElementById('r-agree');
    el.textContent = agreeRate.toFixed(0) + '%';
    el.parentElement.className = 'metric' + (agreeRate < 70 ? ' bad' : '');

    var rc = document.getElementById('r-recall');
    rc.textContent = isNaN(recall) ? '—' : recall.toFixed(0) + '%';
    rc.parentElement.className = 'metric' + (!isNaN(recall) && recall < 70 ? ' warn' : '');

    var cf = document.getElementById('r-conf');
    cf.textContent = conf.toFixed(2);
    cf.parentElement.className = 'metric' + (conf < 0.6 ? ' warn' : '');
  }

  function drawRealTable(ra) {
    var tbody = document.getElementById('r-seg-body');
    if (!tbody) return;
    var html = '';
    ra.segs.forEach(function (g, idx) {
      var len = g.end - g.start;
      var cblSum = 0, biSum = 0, formSum = 0, relSum = 0;
      for (var i = g.start; i < g.end; i++) {
        cblSum += REAL.cbl[i];
        biSum += ra.bi[i];
        formSum += ra.form[i];
        relSum += ra.rel[i];
      }
      var confLow = g.conf < 0.6;
      html += '<tr data-seg="' + idx + '"' + (RI.seg === idx ? ' class="sel"' : '') + '>'
        + '<td>' + (idx + 1) + '</td>'
        + '<td class="mono">' + segDepthLabel(g) + '</td>'
        + '<td class="mono">' + len + ' ft</td>'
        + '<td class="mono">' + (cblSum / len).toFixed(1) + '</td>'
        + '<td class="mono">' + (relSum / len).toFixed(0) + '%</td>'
        + '<td class="mono">' + (biSum / len).toFixed(3) + '</td>'
        + '<td class="mono">' + (formSum / len).toFixed(2) + '</td>'
        + '<td><span class="grade ' + g.grade.toLowerCase() + '">' + g.grade + '</span></td>'
        + '<td class="mono"' + (confLow ? ' style="color:#b05a51;font-weight:600"' : '') + '>' + g.conf.toFixed(2) + (confLow ? ' 待复核' : '') + '</td>'
        + '<td><span class="grade ' + g.refMajor.toLowerCase() + '">' + g.refMajor + '</span></td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
    tbody.onclick = function (e) {
      var tr = e.target.closest('tr');
      if (!tr) return;
      var k = parseInt(tr.getAttribute('data-seg'), 10);
      if (!isNaN(k)) selectSeg(k);
    };
  }

  function drawRealConfmat(ra) {
    var box = document.getElementById('r-confmat');
    if (!box) return;
    var G = ['A', 'B', 'C', 'D'];
    var mat = { A: {}, B: {}, C: {}, D: {} };
    G.forEach(function (a) { G.forEach(function (b) { mat[a][b] = 0; }); });
    for (var i = 0; i < ra.n; i++) mat[ra.ref[i]][ra.pred[i].grade]++;

    var html = '<div class="cm-corner">参考↓ / AI→</div>';
    G.forEach(function (g) { html += '<div class="cm-head">' + g + '</div>'; });

    G.forEach(function (row) {
      var rowSum = 0;
      G.forEach(function (col) { rowSum += mat[row][col]; });
      html += '<div class="cm-lab">' + row + '</div>';
      G.forEach(function (col) {
        var v = mat[row][col];
        var ratio = rowSum ? v / rowSum : 0;
        var diag = row === col;
        var color = diag ? '47,125,107' : '176,90,81';
        var alpha = v ? 0.10 + ratio * 0.55 : 0;
        html += '<div class="cm-cell' + (diag ? ' cm-diag' : '') + '" style="background:rgba(' + color + ',' + alpha.toFixed(2) + ');'
          + (v === 0 ? 'color:#c3bdb0' : 'color:#242b2e') + '">' + v
          + '<small>' + (rowSum ? (ratio * 100).toFixed(0) + '%' : '—') + '</small></div>';
      });
    });
    box.innerHTML = html;
    if (!box.parentElement.querySelector('.confmat-legend')) {
      var legend = document.createElement('div');
      legend.className = 'confmat-legend';
      legend.textContent = '对角线（绿色）= 与参考一致；非对角线（红色）= 分歧。数值为 1 ft 样本数，百分比为行内占比。';
      box.parentElement.appendChild(legend);
    }
  }

  /* ---------- 图表交互：悬停联动 + 分段选择 ---------- */
  function segIndexOf(i) {
    for (var k = 0; k < RA.segs.length; k++) {
      var g = RA.segs[k];
      if (i >= g.start && i < g.end) return k;
    }
    return -1;
  }

  function applyCrosshair() {
    var svg = document.getElementById('r-cbl');
    if (!svg) return;
    var g = svg.querySelector('#r-cross');
    if (!g) return;
    var i = RI.hover;
    if (i < 0) { g.style.display = 'none'; return; }
    var pl = 52, pr = 62, pt = 32, pb = 34;
    var pw = 900 - pl - pr, ph = 300 - pt - pb;
    var x = pl + (i - RI.z0) / Math.max(1, RI.z1 - RI.z0 - 1) * pw;
    g.style.display = '';
    var line = g.querySelector('#r-cross-line');
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    var c1 = g.querySelector('#r-cross-cbl');
    c1.setAttribute('cx', x);
    c1.setAttribute('cy', pt + (1 - Math.min(65, REAL.cbl[i]) / 65) * ph);
    var c2 = g.querySelector('#r-cross-bi');
    c2.setAttribute('cx', x);
    c2.setAttribute('cy', pt + (1 - RA.bi[i]) * ph);
  }

  function setHover(i) {
    if (!RA) return;
    RI.hover = i;
    applyCrosshair();
    paintVDL(RA);
  }

  function showTip(id, html, evt, boxId) {
    var tip = document.getElementById(id), box = document.getElementById(boxId);
    if (!tip || !box) return;
    tip.innerHTML = html;
    tip.style.display = 'block';
    var r = box.getBoundingClientRect();
    var x = evt.clientX - r.left + 14;
    if (x + 190 > r.width) x = evt.clientX - r.left - 190;
    tip.style.left = Math.max(6, x) + 'px';
    tip.style.top = '8px';
  }

  function hideTip(id) {
    var tip = document.getElementById(id);
    if (tip) tip.style.display = 'none';
  }

  function selectSeg(k) {
    if (!RA) return;
    if (k < 0 && RI.seg < 0) return;
    RI.seg = (k === RI.seg) ? -1 : k;
    if (RI.seg >= 0 && RA.segs[RI.seg]) {
      var g = RA.segs[RI.seg];
      /* 从明细表选中视窗外分段时，自动把视窗移过去 */
      if (g.end <= RI.z0 || g.start >= RI.z1) {
        var span = Math.min(RI.z1 - RI.z0, Math.max(MINSPAN, g.end - g.start));
        var c = (g.start + g.end) / 2;
        setZoom(c - span / 2, c + span / 2);
      }
    }
    drawRealCBL(RA);
    applyCrosshair();
    paintVDL(RA);
    renderDetail();
  }

  function segAvg(g) {
    var len = g.end - g.start;
    var cbl = 0, bi = 0, form = 0, rel = 0;
    for (var i = g.start; i < g.end; i++) {
      cbl += REAL.cbl[i]; bi += RA.bi[i]; form += RA.form[i]; rel += RA.rel[i];
    }
    return { len: len, cbl: cbl / len, bi: bi / len, form: form / len, rel: rel / len };
  }

  function renderDetail() {
    var box = document.getElementById('r-detail');
    if (!box) return;
    Array.prototype.forEach.call(document.querySelectorAll('#r-seg-body tr'), function (tr) {
      var k = parseInt(tr.getAttribute('data-seg'), 10);
      tr.classList.toggle('sel', k === RI.seg);
    });
    if (!RA || RI.seg < 0 || !RA.segs[RI.seg]) {
      box.className = 'r-detail';
      box.textContent = '悬停曲线查看采样点；滚轮缩放深度视窗；点击曲线或 VDL 选区可选中分段，查看平均值并与明细表联动。';
      return;
    }
    var g = RA.segs[RI.seg], m = segAvg(g);
    var ok = g.grade === g.refMajor;
    box.className = 'r-detail active';
    box.innerHTML = '已选分段 <b>#' + (RI.seg + 1) + '</b> · <b>' + segDepthLabel(g) + '</b> ft · 厚 ' + m.len + ' ft'
      + ' ｜ 平均 CBL <b>' + m.cbl.toFixed(1) + '</b> mV（相对 ' + m.rel.toFixed(0) + '%）'
      + ' ｜ BI <b>' + m.bi.toFixed(3) + '</b> ｜ 二界面 <b>' + m.form.toFixed(2) + '</b>'
      + ' ｜ AI <b>' + g.grade + '</b>（置信 ' + g.conf.toFixed(2) + '） ｜ 参考 <b>' + g.refMajor + '</b> ｜ '
      + (ok ? '<b class="ok-txt">评级一致</b>' : '<b class="bad-txt">分歧，建议复核</b>');
  }

  function initRealCharts() {
    var svg = document.getElementById('r-cbl');
    var cv = document.getElementById('r-vdl');
    if (!svg || !cv || !RA) return;
    var drag = null, suppressClick = false;

    function plotFrac(clientX, r) {
      var sx = (clientX - r.left) / r.width * 900;
      return clamp((sx - 52) / (900 - 52 - 62), 0, 1);
    }
    function cblIndex(e) {
      var r = svg.getBoundingClientRect();
      var span = RI.z1 - RI.z0;
      return clamp(RI.z0 + Math.round(plotFrac(e.clientX, r) * (span - 1)), RI.z0, RI.z1 - 1);
    }
    function vdlIndex(e) {
      var r = cv.getBoundingClientRect();
      var span = RI.z1 - RI.z0;
      return clamp(RI.z0 + Math.floor(clamp((e.clientX - r.left) / r.width, 0, 1) * span), RI.z0, RI.z1 - 1);
    }

    function zoomFromWheel(e, chart, isCbl) {
      e.preventDefault();
      if (!e.deltaY) return;
      var r = chart.getBoundingClientRect();
      var frac = isCbl ? plotFrac(e.clientX, r) : clamp((e.clientX - r.left) / r.width, 0, 1);
      var span = RI.z1 - RI.z0;
      var cur = RI.z0 + frac * span;
      var ns = span * (e.deltaY < 0 ? 0.8 : 1.25);
      setZoom(cur - frac * ns, cur - frac * ns + ns);
    }
    function panFromDrag(e, chart, isCbl) {
      var r = chart.getBoundingClientRect();
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 3) suppressClick = true;
      var span = drag.z1 - drag.z0;
      var shift = isCbl ? -dx / r.width * 900 / 786 * span : -dx / r.width * span;
      setZoom(drag.z0 + shift, drag.z1 + shift);
    }

    svg.addEventListener('mousemove', function (e) {
      if (drag) { panFromDrag(e, svg, true); hideTip('r-cbl-tip'); return; }
      var i = cblIndex(e);
      setHover(i);
      var b = REAL.blocks[blockOfIndex(i)], pr = RA.pred[i];
      showTip('r-cbl-tip',
        '<b>' + REAL.depth[i] + ' ft</b> · ' + b.label + '<br>'
        + 'CBL <b>' + REAL.cbl[i].toFixed(1) + '</b> mV · 相对 ' + RA.rel[i].toFixed(0) + '%<br>'
        + 'BI <b>' + RA.bi[i].toFixed(3) + '</b> · 二界面 ' + RA.form[i].toFixed(2) + '<br>'
        + 'AI <b>' + pr.grade + '</b>（置信 ' + pr.conf.toFixed(2) + '） · 参考 <b>' + RA.ref[i] + '</b>',
        e, 'r-cbl-box');
    });
    svg.addEventListener('mouseleave', function () {
      setHover(-1); hideTip('r-cbl-tip');
    });
    svg.addEventListener('mousedown', function (e) {
      if (RI.z1 - RI.z0 >= RA.n) return;
      drag = { x: e.clientX, z0: RI.z0, z1: RI.z1 };
      suppressClick = false;
      e.preventDefault();
    });
    svg.addEventListener('wheel', function (e) { zoomFromWheel(e, svg, true); }, { passive: false });
    svg.addEventListener('dblclick', resetZoom);
    svg.addEventListener('click', function (e) {
      if (suppressClick) { suppressClick = false; return; }
      selectSeg(segIndexOf(cblIndex(e)));
    });

    cv.addEventListener('mousemove', function (e) {
      if (drag) { panFromDrag(e, cv, false); hideTip('r-vdl-tip'); return; }
      var i = vdlIndex(e);
      setHover(i);
      var grade = RA.pred[i].grade, a = vdlAmps(grade);
      showTip('r-vdl-tip',
        '<b>' + REAL.depth[i] + ' ft</b><br>AI 评级 <b>' + grade + '</b>（置信 ' + RA.pred[i].conf.toFixed(2) + '）<br>'
        + '套管波 ' + (a.casing * 100).toFixed(0) + '% · 地层波 ' + (a.formation * 100).toFixed(0) + '%',
        e, 'r-vdl-box');
    });
    cv.addEventListener('mouseleave', function () {
      setHover(-1); hideTip('r-vdl-tip');
    });
    cv.addEventListener('mousedown', function (e) {
      if (RI.z1 - RI.z0 >= RA.n) return;
      drag = { x: e.clientX, z0: RI.z0, z1: RI.z1 };
      suppressClick = false;
      e.preventDefault();
    });
    cv.addEventListener('wheel', function (e) { zoomFromWheel(e, cv, false); }, { passive: false });
    cv.addEventListener('dblclick', resetZoom);
    cv.addEventListener('click', function (e) {
      if (suppressClick) { suppressClick = false; return; }
      selectSeg(segIndexOf(vdlIndex(e)));
    });
    window.addEventListener('mouseup', function () {
      drag = null;
      setTimeout(function () { suppressClick = false; }, 0);
    });

    function zoomCenter(factor) {
      var span = RI.z1 - RI.z0;
      var c = RI.hover >= 0 ? RI.hover : (RI.z0 + RI.z1) / 2;
      var ns = Math.max(MINSPAN, span * factor);
      setZoom(c - ns / 2, c + ns / 2);
    }
    var zin = document.getElementById('z-in');
    if (zin) zin.addEventListener('click', function () { zoomCenter(0.7); });
    var zout = document.getElementById('z-out');
    if (zout) zout.addEventListener('click', function () { zoomCenter(1.4); });
    var zreset = document.getElementById('z-reset');
    if (zreset) zreset.addEventListener('click', resetZoom);

    var gain = document.getElementById('vd-gain');
    if (gain) gain.addEventListener('input', function () {
      RI.gain = parseInt(this.value, 10) / 100;
      var lab = document.getElementById('vd-gain-val');
      if (lab) lab.textContent = this.value + '%';
      buildVDLOff(RA);
      paintVDL(RA);
    });
    var reset = document.getElementById('vd-reset');
    if (reset) reset.addEventListener('click', function () { selectSeg(-1); });
    updateZoomLabel();
  }

  function renderReal() {
    if (!REAL) return;
    RA = analyzeReal();
    RI.z0 = 0; RI.z1 = RA.n; RI.hover = -1; RI.seg = -1;
    drawRealCBL(RA);
    drawRealVDL(RA);
    drawRealMetrics(RA);
    drawRealTable(RA);
    drawRealConfmat(RA);
    initRealCharts();
    renderDetail();
  }

  /* 页签切换 */
  (function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    var panes = { real: document.getElementById('pane-real'), synth: document.getElementById('pane-synth') };
    Array.prototype.forEach.call(tabs, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        Object.keys(panes).forEach(function (k) {
          if (panes[k]) panes[k].classList.toggle('active', k === btn.getAttribute('data-tab'));
        });
      });
    });
  })();

  if (REAL) {
    renderReal();
  } else {
    var pane = document.getElementById('pane-real');
    if (pane) pane.innerHTML = '<div class="section">真实测井切片未加载（缺少 demo/data.js）。</div>';
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      if (LAST_SIM) drawVDL(LAST_SIM.data, LAST_SIM.ai);
      if (RA) drawRealVDL(RA);
    }, 120);
  });
})();
