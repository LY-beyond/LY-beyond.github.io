/* ======= 固井质量 CBL/VDL 智能评价 ======= */
(function () {
  'use strict';

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
    localStorage.setItem(SHARED_KEY, JSON.stringify(cur));
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
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
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

  function run() {
    const data = generate();
    const ai = aiClassify(data.bi);
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
})();
