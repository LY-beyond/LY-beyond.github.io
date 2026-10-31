/* ======= 水泥浆配方优化 ======= */
(function () {
  'use strict';

  const TVD = 2000;
  const TVD_FT = TVD * 3.28084;
  const JOB_TIME = 150;

  const PARAMS = [
    { id: 'density', label: '水泥浆密度', unit: 'g/cm³', min: 1.2, max: 2.1, step: 0.01, value: 1.89 },
    { id: 'wc', label: '水灰比', unit: '', min: 0.35, max: 0.60, step: 0.01, value: 0.44 },
    { id: 'bhct', label: '井底循环温度 BHCT', unit: '℃', min: 30, max: 180, step: 1, value: 80 },
    { id: 'bhst', label: '井底静止温度 BHST', unit: '℃', min: 40, max: 200, step: 1, value: 95 },
    { id: 'retarder', label: '缓凝剂', unit: '%BWOC', min: 0, max: 1.2, step: 0.01, value: 0.3 },
    { id: 'fluidLoss', label: '降失水剂', unit: '%BWOC', min: 0, max: 2.5, step: 0.05, value: 0.8 },
    { id: 'dispersant', label: '减阻剂', unit: '%BWOC', min: 0, max: 1.5, step: 0.05, value: 0.5 },
    { id: 'silica', label: '硅粉', unit: '%BWOC', min: 0, max: 40, step: 1, value: 20 },
    { id: 'rate', label: '排量', unit: 'm³/min', min: 0.5, max: 4.0, step: 0.1, value: 2.0 },
    { id: 'wellDia', label: '井径', unit: 'mm', min: 200, max: 450, step: 5, value: 311 },
    { id: 'casingOD', label: '套管外径', unit: 'mm', min: 140, max: 340, step: 5, value: 244 },
    { id: 'poreGrad', label: '孔隙压力梯度', unit: 'ppg', min: 9.5, max: 14, step: 0.1, value: 11.5 },
    { id: 'fracGrad', label: '破裂压力梯度', unit: 'ppg', min: 14, max: 18, step: 0.1, value: 15.5 }
  ];

  const S = {};
  PARAMS.forEach(p => { S[p.id] = p.value; });

  // ===== 邻接环节参数联动（固井工作流共享，key=cementing-shared）=====
  const SHARED_KEY = 'cementing-shared';
  const KEY_MAP = {
    density: 'density',
    wc: 'wc',
    silica: 'silica',
    retarder: 'retarder',
    flac: 'fluidLoss',
    dispersant: 'dispersant',
    bhct: 'bhct',
    bhst: 'bhst',
    flowRate: 'rate',
    holeDiameter: 'wellDia',
    casingOD: 'casingOD',
    porePPG: 'poreGrad',
    fracPPG: 'fracGrad'
  };
  const MY_KEYS = Object.keys(KEY_MAP);
  function loadShared() {
    try {
      var s = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}');
      var n = 0;
      MY_KEYS.forEach(function (k) {
        if (k in s && typeof s[k] === 'number') { S[KEY_MAP[k]] = s[k]; n++; }
      });
      return n;
    } catch (e) { return 0; }
  }
  function saveShared() {
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}'); } catch (e) {}
    MY_KEYS.forEach(function (k) {
      if (typeof S[KEY_MAP[k]] === 'number') cur[k] = S[KEY_MAP[k]];
    });
    localStorage.setItem(SHARED_KEY, JSON.stringify(cur));
  }
  function syncSlidersFromS() {
    PARAMS.forEach(function (p) {
      var el = document.getElementById('s-' + p.id);
      var out = document.getElementById('o-' + p.id);
      if (el) el.value = S[p.id];
      if (out) out.textContent = S[p.id];
    });
  }
  // 初始化：默认值 -> loadShared 覆盖 -> 同步 slider -> 渲染
  var syncedCount = 0;

  function compute(state) {
    state = state || S;
    const rho = state.density;
    const wc = state.wc;
    const bhct = state.bhct;
    const bhst = state.bhst;
    const ret = state.retarder;
    const fl = state.fluidLoss;
    const disp = state.dispersant;
    const sil = state.silica;
    const rate = state.rate;

    const t70 = 240 * Math.exp(-0.012 * (bhct - 60)) * (1 + 90 * ret) * (1 + 1.5 * (wc - 0.44));
    const apiFL = 180 * Math.exp(-0.75 * fl) * (1 + 0.006 * (bhct - 60));
    const freeWater = Math.max(0, (wc - 0.42) * 12) * (1 - 0.5 * fl);
    const settling = 0.02 + 0.06 * (wc - 0.44) - 0.002 * sil;

    const n = Math.max(0.3, 0.85 - 0.15 * (rho - 1.4) / 0.7 + 0.1 * disp);
    const K = Math.max(0.1, 1.2 * (rho / 1.89) * (1 - 0.35 * disp) * Math.exp(0.004 * (bhct - 60)));
    const tauY = 1.5 + 2 * (rho - 1.4);

    const contam = 0;
    let ucs = 20 * Math.pow(0.44 / wc, 1.2) * Math.pow(rho / 1.9, 0.8) *
      Math.exp(-0.01 * (bhst - 60)) * (1 - 0.004 * ret) * (1 + 0.003 * sil) * (1 - 0.03 * contam);
    if (bhst > 110 && sil < 30) ucs *= 0.6;
    const strengthRetro = bhst > 110 && sil < 30;

    const transition = 25 * (1 + 1.8 * (wc - 0.44)) * (1 + 0.6 * ret) * (1 - 0.3 * disp);

    const wellM = state.wellDia / 1000;
    const csgM = state.casingOD / 1000;
    const de = Math.max(0.01, wellM - csgM);
    const area = Math.PI / 4 * (wellM * wellM - csgM * csgM);
    const v = (rate / 60) / Math.max(1e-6, area);
    const dPdL = 4 * K / de * Math.pow(8 * v / de, n);
    const aplPa = dPdL * TVD;
    const aplPsi = aplPa / 6894.76;
    const rhoPpg = rho * 8.345;
    const deltaEcd = aplPsi / (0.052 * TVD_FT);
    const ecdTD = rhoPpg + deltaEcd;

    return {
      rho, wc, bhct, bhst, t70, apiFL, freeWater, settling,
      n, K, tauY, ucs, strengthRetro, transition,
      de, area, v, dPdL, aplPsi, rhoPpg, deltaEcd, ecdTD
    };
  }

  // 判断体检卡是否全项 PASS
  function allPass(c) {
    const margin = c.t70 - JOB_TIME;
    return margin >= 30 && c.apiFL <= 50 && c.freeWater <= 1.4 &&
      c.settling <= 0.01 && c.ucs >= 14 && !c.strengthRetro && c.transition <= 45;
  }

  function drawThick(c) {
    const svg = document.getElementById('thick');
    const W = 430, H = 190, padL = 36, padR = 12, padT = 14, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const tMax = c.t70 * 1.15;
    const bcMax = 100;

    function xT(t) { return padL + t / tMax * plotW; }
    function yBc(b) { return padT + (1 - b / bcMax) * plotH; }

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf8" rx="6"/>`;

    for (let b = 0; b <= bcMax; b += 20) {
      const y = yBc(b);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#ece7d8"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${b}</text>`;
    }
    for (let t = 0; t <= tMax; t += 60) {
      const x = xT(t);
      s += `<text x="${x}" y="${H - 9}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${t}</text>`;
    }

    s += `<line x1="${padL}" y1="${yBc(70)}" x2="${padL + plotW}" y2="${yBc(70)}" stroke="#b05a51" stroke-width="1" stroke-dasharray="5 3"/>`;
    s += `<text x="${padL + plotW - 4}" y="${yBc(70) - 4}" font-size="8" fill="#b05a51" text-anchor="end" font-family="monospace">70 Bc</text>`;

    const tJob = Math.min(JOB_TIME, tMax);
    s += `<line x1="${xT(tJob)}" y1="${padT}" x2="${xT(tJob)}" y2="${padT + plotH}" stroke="#c9a15a" stroke-width="1" stroke-dasharray="5 3"/>`;
    s += `<text x="${xT(tJob)}" y="${padT - 4}" font-size="8" fill="#c9a15a" text-anchor="middle" font-family="monospace">施工 ${tJob} min</text>`;

    let path = '';
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = tMax * i / steps;
      const bc = 8 + 62 * Math.pow(t / c.t70, 3.5);
      const bcc = Math.min(bcMax, Math.max(0, bc));
      path += (i ? 'L' : 'M') + xT(t).toFixed(1) + ' ' + yBc(bcc).toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#2f7d6b" stroke-width="1.8" stroke-linejoin="round"/>`;

    s += `<circle cx="${xT(c.t70)}" cy="${yBc(70)}" r="3.5" fill="#b05a51"/>`;
    s += `<text x="${xT(c.t70) + 7}" y="${yBc(70) - 5}" font-size="8.5" fill="#b05a51" font-family="monospace">t₇₀=${c.t70.toFixed(0)} min</text>`;

    s += `<text x="${padL}" y="${padT - 5}" font-size="8" fill="#9ba3a9" font-family="monospace">稠度 Bc</text>`;
    s += `<text x="${padL + plotW / 2}" y="${H - 2}" font-size="8" fill="#9ba3a9" text-anchor="middle">时间 min</text>`;
    svg.innerHTML = s;
  }

  function drawRheo(c) {
    const svg = document.getElementById('rheo');
    const W = 430, H = 190, padL = 36, padR = 12, padT = 14, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const gMax = 1000;
    const tauMax = Math.max(50, c.tauY + c.K * Math.pow(gMax, c.n) * 1.05);

    function xG(g) { return padL + g / gMax * plotW; }
    function yTau(t) { return padT + (1 - t / tauMax) * plotH; }

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf8" rx="6"/>`;

    const gTicks = [0, 200, 400, 600, 800, 1000];
    gTicks.forEach(g => {
      const x = xG(g);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#f1ede2"/>`;
      s += `<text x="${x}" y="${H - 9}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${g}</text>`;
    });
    for (let t = 0; t <= tauMax; t += Math.ceil(tauMax / 5 / 10) * 10) {
      const y = yTau(t);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#ece7d8"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${t.toFixed(0)}</text>`;
    }

    let path = '';
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const g = gMax * i / steps;
      const tau = c.tauY + c.K * Math.pow(g, c.n);
      path += (i ? 'L' : 'M') + xG(g).toFixed(1) + ' ' + yTau(tau).toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#2f7d6b" stroke-width="1.8" stroke-linejoin="round"/>`;

    s += `<text x="${padL + 10}" y="${padT + 12}" font-size="8.5" fill="#2f7d6b" font-family="monospace">n = ${c.n.toFixed(2)}</text>`;
    s += `<text x="${padL + 10}" y="${padT + 24}" font-size="8.5" fill="#2f7d6b" font-family="monospace">K = ${c.K.toFixed(2)} Pa·sⁿ</text>`;
    s += `<text x="${padL + 10}" y="${padT + 36}" font-size="8.5" fill="#2f7d6b" font-family="monospace">τy = ${c.tauY.toFixed(1)} Pa</text>`;

    s += `<text x="${padL}" y="${padT - 5}" font-size="8" fill="#9ba3a9" font-family="monospace">剪切应力 Pa</text>`;
    s += `<text x="${padL + plotW / 2}" y="${H - 2}" font-size="8" fill="#9ba3a9" text-anchor="middle">剪切率 s⁻¹</text>`;
    svg.innerHTML = s;
  }

  function drawEcd(c) {
    const svg = document.getElementById('ecd');
    const W = 430, H = 200, padL = 36, padR = 12, padT = 14, padB = 20;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    const xMin = Math.min(c.rhoPpg, S.poreGrad) - 0.5;
    const xMax = Math.max(c.ecdTD, S.fracGrad) + 0.5;

    function xPpg(p) { return padL + (p - xMin) / (xMax - xMin) * plotW; }
    function yD(d) { return padT + d / TVD * plotH; }

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf8" rx="6"/>`;

    for (let d = 0; d <= TVD; d += 400) {
      const y = yD(d);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#ece7d8"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${d}</text>`;
    }
    const pStep = Math.max(1, Math.ceil((xMax - xMin) / 10));
    for (let p = Math.ceil(xMin); p <= xMax; p += pStep) {
      const x = xPpg(p);
      s += `<text x="${x}" y="${H - 7}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${p}</text>`;
    }

    const xPore = xPpg(S.poreGrad);
    const xFrac = xPpg(S.fracGrad);
    s += `<line x1="${xPore}" y1="${padT}" x2="${xPore}" y2="${padT + plotH}" stroke="#c9a15a" stroke-width="1.5"/>`;
    s += `<text x="${xPore}" y="${padT - 4}" font-size="8" fill="#c9a15a" text-anchor="middle" font-family="monospace">孔隙 ${S.poreGrad.toFixed(1)}</text>`;
    s += `<line x1="${xFrac}" y1="${padT}" x2="${xFrac}" y2="${padT + plotH}" stroke="#b05a51" stroke-width="1.5"/>`;
    s += `<text x="${xFrac}" y="${padT - 4}" font-size="8" fill="#b05a51" text-anchor="middle" font-family="monospace">破裂 ${S.fracGrad.toFixed(1)}</text>`;

    const steps = 80;
    let pts = [];
    for (let i = 0; i <= steps; i++) {
      const d = TVD * i / steps;
      const ecd = c.rhoPpg + c.deltaEcd * (d / TVD);
      pts.push({ d, ecd });
    }
    let path = '';
    pts.forEach((p, i) => { path += (i ? 'L' : 'M') + xPpg(p.ecd).toFixed(1) + ' ' + yD(p.d).toFixed(1) + ' '; });
    s += `<path d="${path}" fill="none" stroke="#2f7d6b" stroke-width="2"/>`;

    // 越界段标红
    let inBad = false, ss = null;
    for (let i = 0; i <= pts.length; i++) {
      const p = i < pts.length ? pts[i] : null;
      const bad = p && (p.ecd < S.poreGrad || p.ecd > S.fracGrad);
      if (bad !== inBad) {
        if (inBad && ss !== null) {
          const d0 = pts[ss].d, d1 = p ? p.d : TVD;
          s += `<line x1="${xPpg(pts[ss].ecd)}" y1="${yD(d0)}" x2="${xPpg(p ? p.ecd : c.ecdTD)}" y2="${yD(d1)}" stroke="#b05a51" stroke-width="3.5" opacity="0.7"/>`;
        }
        ss = i; inBad = bad;
      }
    }

    s += `<text x="${padL}" y="${padT - 4}" font-size="8" fill="#9ba3a9" font-family="monospace">ECD ppg</text>`;
    s += `<text x="${padL - 27}" y="${padT + plotH / 2}" font-size="8" fill="#9ba3a9" text-anchor="middle" transform="rotate(-90 ${padL - 27} ${padT + plotH / 2})">井深 m</text>`;
    svg.innerHTML = s;
  }

  function drawCheck(c) {
    const grid = document.getElementById('check-grid');
    const margin = c.t70 - JOB_TIME;
    const items = [
      {
        label: '稠化时间余量', val: margin.toFixed(0) + ' min',
        pass: margin >= 30, fail: margin < 0,
        tag: margin >= 30 ? 'PASS' : (margin < 0 ? 'FAIL' : 'WARN'),
        limit: `t₇₀=${c.t70.toFixed(0)} min · 施工 ${JOB_TIME} min · 要求 ≥30 min`
      },
      {
        label: 'API 失水', val: c.apiFL.toFixed(1) + ' mL',
        pass: c.apiFL <= 50, tag: c.apiFL <= 50 ? 'PASS' : 'FAIL',
        limit: '要求 ≤ 50 mL/30min'
      },
      {
        label: '自由水', val: c.freeWater.toFixed(2) + ' %',
        pass: c.freeWater <= 1.4, tag: c.freeWater <= 1.4 ? 'PASS' : 'FAIL',
        limit: '要求 ≤ 1.4%'
      },
      {
        label: '沉降密度差', val: c.settling.toFixed(3) + ' g/cm³',
        pass: c.settling <= 0.01, tag: c.settling <= 0.01 ? 'PASS' : 'FAIL',
        limit: '要求 ≤ 0.01 g/cm³'
      },
      {
        label: '24h UCS', val: c.ucs.toFixed(1) + ' MPa',
        pass: c.ucs >= 14 && !c.strengthRetro,
        tag: c.ucs >= 14 ? (c.strengthRetro ? 'WARN' : 'PASS') : 'FAIL',
        warn: c.strengthRetro,
        limit: c.strengthRetro ? '高温倒缩警告：BHST>110℃ 且硅粉<30%' : '要求 ≥ 14 MPa'
      },
      {
        label: '静切过渡时间', val: c.transition.toFixed(0) + ' min',
        pass: c.transition <= 45, tag: c.transition <= 45 ? 'PASS' : 'FAIL',
        limit: '100→500 lbf/100ft² 要求 < 45 min'
      }
    ];

    grid.innerHTML = items.map(it => {
      const cls = it.warn ? 'warn' : (it.pass ? 'pass' : 'fail');
      return `<div class="check-item ${cls}">
        <div class="ci-label">${it.label}</div>
        <div class="ci-val">${it.val}</div>
        <div class="ci-tag">${it.tag}</div>
        <div class="ci-limit">${it.limit}</div>
      </div>`;
    }).join('');
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
        run();
      });
    });
  }

  function run() {
    const c = compute();
    drawThick(c);
    drawRheo(c);
    drawEcd(c);
    drawCheck(c);
    saveShared();
    updateSyncNote();
  }

  function updateSyncNote() {
    var n = 0;
    try {
      var s = JSON.parse(localStorage.getItem(SHARED_KEY) || '{}');
      MY_KEYS.forEach(function (k) { if (k in s && typeof s[k] === 'number') n++; });
    } catch (e) {}
    var note = document.getElementById('sync-note');
    if (note) note.firstChild.textContent = '邻接参数联动：已同步 ' + n + ' 个共享参数（密度/水灰比/硅粉/缓凝剂/温度…） ';
  }

  // ===== 帕累托方案对比 =====
  var CANDIDATES = [];          // 候选方案数组：{params, margin, ucs, cost, pass}
  var FRONT_ONLY = false;       // 是否仅显示前沿
  var SELECTED_IDX = -1;        // 当前选中候选

  // 固定种子随机数
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randParam(p, rng) {
    var span = (p.max - p.min) / p.step;
    var idx = Math.floor(rng() * (span + 1));
    return p.min + idx * p.step;
  }

  // 生成 40 个候选方案
  function generateCandidates() {
    var rng = mulberry32(20261030);
    CANDIDATES = [];
    var guard = 0;
    while (CANDIDATES.length < 40 && guard < 500) {
      guard++;
      var st = {};
      PARAMS.forEach(function (p) { st[p.id] = randParam(p, rng); });
      // 环空间隙 <20mm 无工程意义且会使摩阻压降发散（ECD 天文数字），剔除重抽
      if (st.wellDia - st.casingOD < 20) continue;
      var c = compute(st);
      var margin = st.fracGrad - c.ecdTD;
      var cost = st.density + st.retarder + st.fluidLoss + st.dispersant + st.silica * 0.1;
      CANDIDATES.push({ params: st, margin: margin, ucs: c.ucs, cost: cost, pass: allPass(c) });
    }
    SELECTED_IDX = -1;
    drawPareto();
  }

  // 计算帕累托前沿（非支配：裕度更大且强度更高）
  function paretoFront(cands) {
    var front = [];
    for (var i = 0; i < cands.length; i++) {
      var dominated = false;
      for (var j = 0; j < cands.length; j++) {
        if (i === j) continue;
        if (cands[j].margin >= cands[i].margin && cands[j].ucs >= cands[i].ucs &&
            (cands[j].margin > cands[i].margin || cands[j].ucs > cands[i].ucs)) {
          dominated = true; break;
        }
      }
      if (!dominated) front.push(i);
    }
    return front;
  }

  function drawPareto() {
    var svg = document.getElementById('pareto');
    var W = 430, H = 240, pl = 40, pr = 12, pt = 14, pb = 26;
    var pw = W - pl - pr, ph = H - pt - pb;

    if (CANDIDATES.length === 0) {
      svg.innerHTML = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>' +
        '<text x="' + (W / 2) + '" y="' + (H / 2) + '" font-size="9" fill="#9ba3a9" text-anchor="middle">点击「生成 40 个候选方案」开始对比</text>';
      return;
    }

    var frontSet = {};
    paretoFront(CANDIDATES).forEach(function (i) { frontSet[i] = true; });

    var xs = CANDIDATES.map(function (d) { return d.margin; });
    var ys = CANDIDATES.map(function (d) { return d.ucs; });
    var xMin = Math.min(0, Math.min.apply(null, xs)) - 0.2;
    var xMax = Math.max.apply(null, xs) + 0.2;
    var yMin = 0;
    var yMax = Math.max.apply(null, ys) * 1.05;

    function xP(v) { return pl + (v - xMin) / (xMax - xMin) * pw; }
    function yP(v) { return pt + ph - (v - yMin) / (yMax - yMin) * ph; }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9"/>';

    // 网格（步长有界：极端参数下 xMax 可能发散，防止循环失控卡死页面）
    var gxStep = Math.max(1, Math.ceil((xMax - xMin) / 8));
    for (var gx = Math.ceil(xMin); gx <= xMax; gx += gxStep) {
      var xx = xP(gx);
      s += '<line x1="' + xx + '" y1="' + pt + '" x2="' + xx + '" y2="' + (pt + ph) + '" stroke="#efece1"/>';
      s += '<text x="' + xx + '" y="' + (H - pb + 13) + '" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + gx.toFixed(0) + '</text>';
    }
    for (var gy = 0; gy <= yMax; gy += Math.max(2, Math.round(yMax / 6))) {
      var yy = yP(gy);
      s += '<line x1="' + pl + '" y1="' + yy + '" x2="' + (pl + pw) + '" y2="' + yy + '" stroke="#efece1"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (yy + 3) + '" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + gy.toFixed(0) + '</text>';
    }

    // 阈值线：裕度=0 竖线，强度=3.45MPa 横线
    var x0 = xP(0);
    s += '<line x1="' + x0 + '" y1="' + pt + '" x2="' + x0 + '" y2="' + (pt + ph) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + (x0 + 3) + '" y="' + (pt + 9) + '" font-size="7.5" fill="#b05a51" font-family="monospace">裕度=0</text>';
    var y345 = yP(3.45);
    s += '<line x1="' + pl + '" y1="' + y345 + '" x2="' + (pl + pw) + '" y2="' + y345 + '" stroke="#c9a15a" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + (pl + pw - 4) + '" y="' + (y345 - 3) + '" font-size="7.5" fill="#c9a15a" text-anchor="end" font-family="monospace">3.45 MPa</text>';

    // 点
    var costMax = Math.max.apply(null, CANDIDATES.map(function (d) { return d.cost; }));
    for (var i = 0; i < CANDIDATES.length; i++) {
      var d = CANDIDATES[i];
      if (FRONT_ONLY && !frontSet[i]) continue;
      var r = 2.5 + (d.cost / costMax) * 6;
      var fill = d.pass ? '#3f8560' : '#b05a51';
      var stroke = frontSet[i] ? '#c9a15a' : '#fff';
      var sw = frontSet[i] ? 2 : 1;
      if (i === SELECTED_IDX) { stroke = '#1a1a1a'; sw = 2.5; }
      var cx = xP(d.margin).toFixed(1);
      var cy = yP(d.ucs).toFixed(1);
      var tip = '裕度=' + d.margin.toFixed(2) + ' ppg\n24h UCS=' + d.ucs.toFixed(1) + ' MPa\n成本=' + d.cost.toFixed(2) + '\n' + (d.pass ? '全项 PASS' : '存在 FAIL') + (frontSet[i] ? ' · 帕累托前沿' : '');
      s += '<circle data-idx="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '" opacity="0.85" style="cursor:pointer"><title>' + tip + '</title></circle>';
    }

    // 轴标签
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 3) + '" font-size="8.5" fill="#5d666d" text-anchor="middle">ECD 安全裕度 (fracPPG − ECD) ppg</text>';
    s += '<text x="' + (pl - 30) + '" y="' + (pt + ph / 2) + '" font-size="8.5" fill="#5d666d" text-anchor="middle" transform="rotate(-90 ' + (pl - 30) + ' ' + (pt + ph / 2) + ')">24h UCS (MPa)</text>';

    svg.innerHTML = s;

    // 绑定点击
    Array.prototype.forEach.call(svg.querySelectorAll('circle[data-idx]'), function (el) {
      el.addEventListener('click', function () {
        var idx = +el.getAttribute('data-idx');
        applyCandidate(idx);
      });
    });
  }

  // 把候选参数写入 S、同步 slider、重渲染
  function applyCandidate(idx) {
    var d = CANDIDATES[idx];
    if (!d) return;
    Object.keys(d.params).forEach(function (k) { S[k] = d.params[k]; });
    syncSlidersFromS();
    SELECTED_IDX = idx;
    run();
    drawPareto();
  }

  function bindParetoButtons() {
    document.getElementById('btn-gen-cands').addEventListener('click', generateCandidates);
    document.getElementById('btn-front-only').addEventListener('click', function () {
      FRONT_ONLY = !FRONT_ONLY;
      this.textContent = FRONT_ONLY ? '显示全部候选' : '仅显示帕累托前沿';
      drawPareto();
    });
    document.getElementById('btn-reset-cur').addEventListener('click', function () {
      SELECTED_IDX = -1;
      // 重置为各参数默认值
      PARAMS.forEach(function (p) { S[p.id] = p.value; });
      syncSlidersFromS();
      run();
      drawPareto();
    });
    document.getElementById('btn-clear-shared').addEventListener('click', function () {
      localStorage.removeItem(SHARED_KEY);
      updateSyncNote();
    });
  }

  buildControls();
  bindParetoButtons();
  syncedCount = loadShared();
  syncSlidersFromS();
  updateSyncNote();
  run();
  drawPareto();
})();
