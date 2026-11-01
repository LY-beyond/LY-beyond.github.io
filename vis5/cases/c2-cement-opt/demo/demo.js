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
    // 时间轴步长随稠化时间自适应，避免刻度标签互相压叠
    const tStep = tMax <= 300 ? 60 : tMax <= 720 ? 120 : tMax <= 1800 ? 300 : 600;
    for (let t = 0; t <= tMax; t += tStep) {
      const x = xT(t);
      // 与底部轴标题"时间 min"同一列的刻度不画，避免压字
      if (Math.abs(x - (padL + plotW / 2)) < 34) continue;
      s += `<text x="${x}" y="${H - 9}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${t}</text>`;
    }

    s += `<line x1="${padL}" y1="${yBc(70)}" x2="${padL + plotW}" y2="${yBc(70)}" stroke="#b05a51" stroke-width="1" stroke-dasharray="5 3"/>`;
    // 70 Bc 注记放左侧，右侧留给 t₇₀ 标注
    s += `<text x="${padL + 4}" y="${yBc(70) - 4}" font-size="8" fill="#b05a51" font-family="monospace">70 Bc</text>`;

    const tJob = Math.min(JOB_TIME, tMax);
    s += `<line x1="${xT(tJob)}" y1="${padT}" x2="${xT(tJob)}" y2="${padT + plotH}" stroke="#c9a15a" stroke-width="1" stroke-dasharray="5 3"/>`;
    // 施工窗口注记放在绘图区顶部内，避开左上角的"稠度 Bc"轴标题
    const jobNearRight = xT(tJob) > padL + plotW - 72;
    s += `<text x="${jobNearRight ? xT(tJob) - 4 : xT(tJob) + 4}" y="${padT + 11}" font-size="8" fill="#c9a15a" text-anchor="${jobNearRight ? 'end' : 'start'}" font-family="monospace">施工 ${tJob} min</text>`;

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
    // t₇₀ 标注靠左侧/右侧自动避让，避免越出绘图区或压住 70 Bc 注记
    const t70NearRight = xT(c.t70) > padL + plotW * 0.55;
    s += `<text x="${t70NearRight ? xT(c.t70) - 7 : xT(c.t70) + 7}" y="${yBc(70) - 5}" font-size="8.5" fill="#b05a51" text-anchor="${t70NearRight ? 'end' : 'start'}" font-family="monospace">t₇₀=${c.t70.toFixed(0)} min</text>`;

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
    // 线注记放绘图区内侧，避开左上角"ECD ppg"轴标题
    s += `<text x="${xPore}" y="${padT + 11}" font-size="8" fill="#c9a15a" text-anchor="middle" font-family="monospace">孔隙 ${S.poreGrad.toFixed(1)}</text>`;
    s += `<line x1="${xFrac}" y1="${padT}" x2="${xFrac}" y2="${padT + plotH}" stroke="#b05a51" stroke-width="1.5"/>`;
    s += `<text x="${xFrac}" y="${padT + 11}" font-size="8" fill="#b05a51" text-anchor="middle" font-family="monospace">破裂 ${S.fracGrad.toFixed(1)}</text>`;

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

/* ======= 实验数据页：稠化时间与早期强度（真实实验数据） ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // Joel O. F. (2009) ARPN JEAS 4(9)：木质素磺酸盐缓凝剂，Dyckerhoff G 级，BHCT 121℉/2980 psi，70 Bc
  var TT = [
    { dose: 0.01, min: 163,  txt: '2:43' },
    { dose: 0.05, min: 233,  txt: '3:53' },
    { dose: 0.07, min: 302,  txt: '5:02' },
    { dose: 0.09, min: 720,  txt: '12:00' },
    { dose: 0.11, min: 1008, txt: '16:48' }
  ];
  // 谢云媚等 2025《钻井液与完井液》42(3)：AMND 3%，150℃/75 MPa 稠化 316 min；60℃ 养护强度
  var AMND_TT = { dose: 3.0, min: 316, cond: '150℃/75 MPa，3% BWOC' };
  var STR = [
    { d: 1, mpa: 6.34 }, { d: 2, mpa: 8.24 }, { d: 3, mpa: 14.66 }
  ];
  var X0 = 0, X1 = 0.12, MINSPAN = 0.02;
  var Z = { x0: X0, x1: X1, sel: -1 };
  var selB = -1, selT = -1;
  var PL = 56, PR = 16;

  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(x, y, s, attrs, parent) { var t = el('text', attrs || {}, parent); t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s; return t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function xOf(d, plotW) { return PL + (d - Z.x0) / (Z.x1 - Z.x0) * plotW; }
  function fmtMin(m) { var h = Math.floor(m / 60), mm = Math.round(m % 60); return h + ':' + (mm < 10 ? '0' : '') + mm; }

  function drawA() {
    var svg = document.getElementById('lit-chartA'); if (!svg) return;
    var W = 900, H = 300, PT = 24, PB = 38, plotW = W - PL - PR, plotH = H - PT - PB;
    var Y1 = 1100;
    function yOf(m) { return PT + (Y1 - m) / Y1 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var m = 0; m <= Y1; m += 200) {
      var y = yOf(m);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: m ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, fmtMin(m), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    var span = Z.x1 - Z.x0, step = span <= 0.04 ? 0.01 : span <= 0.08 ? 0.02 : 0.05;
    for (var d = Math.ceil(Z.x0 / step) * step; d <= Z.x1 + 1e-9; d += step) {
      var x = xOf(Math.round(d * 100) / 100, plotW);
      el('line', { x1: x, y1: PT, x2: x, y2: PT + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, PT + plotH + 14, (Math.round(d * 100) / 100).toFixed(2), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 4, '缓凝剂加量 (gal/sk)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(12, PT + plotH / 2, '稠化时间 h:mm (70 Bc)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (PT + plotH / 2) + ')' }, svg);
    // 常见施工要求参考带：稠化时间 4–8 h
    var y4 = yOf(240), y8 = yOf(480);
    el('rect', { x: PL, y: y8, width: plotW, height: y4 - y8, fill: '#2f7d6b', opacity: 0.07 }, svg);
    txt(PL + 6, y8 + 12, '常见施工窗口 4:00–8:00', { 'font-size': 9, fill: '#2f7d6b' }, svg);
    // 折线 + 数据点
    var pts = TT.filter(function (p) { return p.dose >= Z.x0 && p.dose <= Z.x1; });
    var dPath = pts.map(function (p, k) { return (k ? 'L' : 'M') + xOf(p.dose, plotW) + ' ' + yOf(p.min); }).join(' ');
    if (pts.length > 1) el('path', { d: dPath, fill: 'none', stroke: '#2f7d6b', 'stroke-width': 2, opacity: 0.55 }, svg);
    pts.forEach(function (p) {
      var i = TT.indexOf(p), sel = Z.sel === i;
      el('circle', { cx: xOf(p.dose, plotW), cy: yOf(p.min), r: sel ? 8 : 6, fill: '#2f7d6b', opacity: sel ? 1 : 0.85, stroke: sel ? '#242b2e' : '#fdfcf8', 'stroke-width': sel ? 2 : 1.2 }, svg);
      txt(xOf(p.dose, plotW), yOf(p.min) - 10, p.txt, { 'font-size': 9.5, fill: '#235f51', 'text-anchor': 'middle', 'font-weight': sel ? 700 : 400 }, svg);
    });
    txt(PL + 4, PT + 12, '视窗 ' + Z.x0.toFixed(2) + '–' + Z.x1.toFixed(2) + ' gal/sk', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function drawB() {
    var svg = document.getElementById('lit-chartB'); if (!svg) return;
    var W = 900, H = 250, PT = 24, PB = 34, plotW = W - PL - PR, plotH = H - PT - PB;
    var Y1 = 16;
    function yOf(m) { return PT + (Y1 - m) / Y1 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var m = 0; m <= Y1; m += 2) {
      var y = yOf(m);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: m ? '#f1ebdd' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, m + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    txt(12, PT + plotH / 2, '抗压强度 (MPa)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (PT + plotH / 2) + ')' }, svg);
    // API WOC 500 psi = 3.45 MPa
    var yw = yOf(3.45);
    el('line', { x1: PL, y1: yw, x2: W - PR, y2: yw, stroke: '#c9a15a', 'stroke-width': 1.4, 'stroke-dasharray': '6 3' }, svg);
    txt(W - PR - 4, yw - 5, 'WOC 钻塞阈值 500 psi (3.45 MPa)', { 'font-size': 9, fill: '#9a7a1c', 'text-anchor': 'end' }, svg);
    var bw = 110;
    STR.forEach(function (s, i) {
      var cx = PL + plotW * (i + 0.5) / STR.length;
      var y = yOf(s.mpa), sel = selB === i;
      el('rect', { x: cx - bw / 2, y: y, width: bw, height: PT + plotH - y, rx: 3, fill: '#3a6ea5', opacity: sel ? 1 : 0.72, stroke: sel ? '#223d58' : 'none', 'stroke-width': sel ? 2 : 0 }, svg);
      txt(cx, y - 6, s.mpa.toFixed(2), { 'font-size': 10, fill: sel ? '#223d58' : '#3a6ea5', 'text-anchor': 'middle', 'font-weight': sel ? 700 : 400 }, svg);
      txt(cx, PT + plotH + 14, s.d + ' d', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    });
    txt(PL + 4, PT + 12, 'AMND 3%，150℃ 循环 / 60℃ 养护，稠化 316 min', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function drawAll() { drawA(); drawB(); updateLabel(); }
  function updateLabel() { var l = document.getElementById('z-label'); if (l) l.textContent = '视窗 ' + Z.x0.toFixed(2) + '–' + Z.x1.toFixed(2) + ' gal/sk'; }

  function setView(a, b) {
    var span = b - a;
    if (span < MINSPAN) { var c = (a + b) / 2; a = c - MINSPAN / 2; b = a + MINSPAN; }
    if (a < X0) { b -= (a - X0); a = X0; }
    if (b > X1) { a -= (b - X1); b = X1; }
    a = clamp(a, X0, X1); b = clamp(b, a, X1);
    if (b - a < MINSPAN) { b = X1; a = X1 - MINSPAN; }
    Z.x0 = a; Z.x1 = b; drawAll();
  }

  function renderDetail() {
    var d = document.getElementById('lit-detail'); if (!d) return;
    if (Z.sel >= 0) {
      var p = TT[Z.sel];
      d.className = 'r-detail active';
      d.innerHTML = '<b>Joel 2009 稠化实验</b>：缓凝剂加量 <b>' + p.dose + ' gal/sk</b>，稠化时间 <b>' + p.txt + '</b>（' + p.min + ' min，70 Bc，BHCT 121℉/2980 psi）。' +
        (p.min < 240 ? '低于常见 4:00 施工窗口下限，存在提前稠化、憋泵风险，需增加缓凝剂。' :
         p.min > 480 ? '超过 8:00，候凝时间过长、早期强度发展慢，影响下步作业。' :
         '落在 4:00–8:00 常见施工窗口内，兼顾泵送安全与候凝时间。') +
        ' 注意加量 0.07→0.09 时稠化时间跃升 5:02→12:00，敏感性极强，现场须精确计量。';
    } else if (selT === 0) {
      d.className = 'r-detail active';
      d.innerHTML = '<b>谢云媚等 2025</b>：AMND 缓凝剂 <b>3% BWOC</b>，150℃ / 75 MPa 下稠化时间 <b>316 min</b>（嘉华 G 级水泥）。AMND 温度与加量敏感性低，适用于 110–150℃ 长封固段大温差井，高温缓凝而井口低温段不超缓凝。';
    } else if (selB >= 0) {
      var s = STR[selB];
      d.className = 'r-detail active';
      d.innerHTML = '<b>谢云媚等 2025</b>：60℃ 养护 <b>' + s.d + ' d</b> 抗压强度 <b>' + s.mpa.toFixed(2) + ' MPa</b>（150℃ 循环 / AMND 3%）。' +
        (s.mpa >= 3.45 ? '已超过 500 psi (3.45 MPa) 钻塞阈值，满足该龄期作业要求。' : '低于 500 psi (3.45 MPa) 钻塞阈值。') +
        ' 3d 强度达 14.66 MPa，说明 AMND 在保证高温缓凝的同时不损害井口低温段强度发展。';
    } else {
      d.className = 'r-detail';
      d.innerHTML = '悬停读取数据点；点击散点 / 柱条锁定该条实验数据；点击下表行同样联动。要点：木质素磺酸盐在 0.07→0.09 gal/sk 间稠化时间跃升（5:02→12:00），<b>加量敏感性极强</b>；AMND 类合成缓凝剂敏感性低且早强。';
    }
  }

  function syncTable() {
    var rows = document.querySelectorAll('#lit-body tr');
    rows.forEach(function (r) { r.classList.remove('sel'); });
    if (Z.sel >= 0 && rows[Z.sel]) rows[Z.sel].classList.add('sel');
    else if (selT === 0 && rows[TT.length]) rows[TT.length].classList.add('sel');
    else if (selB >= 0 && rows[TT.length + 1 + selB]) rows[TT.length + 1 + selB].classList.add('sel');
  }

  function selectA(i, pan) {
    Z.sel = i; selB = -1; selT = -1;
    if (pan && i >= 0) {
      var p = TT[i];
      if (p.dose < Z.x0 || p.dose > Z.x1) { var s = Z.x1 - Z.x0; setView(p.dose - s / 2, p.dose + s / 2); }
    }
    drawAll(); renderDetail(); syncTable();
  }
  function selectB(i) { selB = i; Z.sel = -1; selT = -1; drawAll(); renderDetail(); syncTable(); }
  function selectT(i) { selT = i; Z.sel = -1; selB = -1; drawAll(); renderDetail(); syncTable(); }

  function bindChartA() {
    var svg = document.getElementById('lit-chartA'), tip = document.getElementById('lit-tipA'), box = document.getElementById('lit-boxA');
    if (!svg || !tip || !box) return;
    var W = 900;
    function doseAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      return Z.x0 + clamp((vx - PL) / (W - PL - PR), 0, 1) * (Z.x1 - Z.x0);
    }
    function nearest(d) {
      var bi = -1, bd = 1e9;
      TT.forEach(function (p, i) { var dd = Math.abs(p.dose - d); if (dd < bd) { bd = dd; bi = i; } });
      return { i: bi, d: bd };
    }
    var drag = null, moved = 0;
    svg.addEventListener('wheel', function (evt) {
      evt.preventDefault();
      var d0 = doseAt(evt), f = evt.deltaY > 0 ? 1.25 : 0.8;
      setView(d0 - (d0 - Z.x0) * f, d0 + (Z.x1 - d0) * f);
    }, { passive: false });
    svg.addEventListener('mousedown', function (evt) { drag = { x: evt.clientX, a: Z.x0, b: Z.x1 }; moved = 0; evt.preventDefault(); });
    window.addEventListener('mousemove', function (evt) {
      if (drag) {
        var r = svg.getBoundingClientRect();
        var dx = (evt.clientX - drag.x) * (W / r.width);
        moved = Math.max(moved, Math.abs(dx));
        if (moved > 3) { var dz = dx / (W - PL - PR) * (drag.b - drag.a); setView(drag.a - dz, drag.b - dz); }
        return;
      }
      var d0 = doseAt(evt), n = nearest(d0), tol = (Z.x1 - Z.x0) / 12;
      if (n.i >= 0 && n.d <= tol) {
        var p = TT[n.i], rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>加量 ' + p.dose + ' gal/sk</b><br>稠化时间 <b>' + p.txt + '</b> (' + p.min + ' min)<br><span style="color:#8a9298">点击锁定</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    window.addEventListener('mouseup', function () { drag = null; });
    svg.addEventListener('dblclick', function () { setView(X0, X1); });
    svg.addEventListener('click', function (evt) {
      if (moved > 3) return;
      var n = nearest(doseAt(evt)), tol = (Z.x1 - Z.x0) / 12;
      selectA(n.i >= 0 && n.d <= tol ? n.i : -1, false);
    });
  }

  function bindChartB() {
    var svg = document.getElementById('lit-chartB'), tip = document.getElementById('lit-tipB'), box = document.getElementById('lit-boxB');
    if (!svg || !tip || !box) return;
    var W = 900;
    function barAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var plotW = W - PL - PR;
      var k = Math.floor((vx - PL) / plotW * STR.length);
      return (k >= 0 && k < STR.length) ? k : -1;
    }
    svg.addEventListener('mousemove', function (evt) {
      var k = barAt(evt);
      if (k >= 0) {
        var s = STR[k], rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + s.d + ' d 龄期</b><br>抗压强度 <b>' + s.mpa.toFixed(2) + ' MPa</b><br><span style="color:#8a9298">点击锁定</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    svg.addEventListener('click', function (evt) { selectB(barAt(evt)); });
  }

  function bindTable() {
    var body = document.getElementById('lit-body'); if (!body) return;
    var rows = [];
    TT.forEach(function (p, i) {
      rows.push({ html: '<td class="num">' + (rows.length + 1) + '</td><td>Joel 2009</td><td>BHCT 121℉ / 2980 psi</td><td class="num">' + p.dose + ' gal/sk</td><td class="num">' + p.txt + '</td><td>' + (p.min < 240 ? '偏短，有早凝风险' : p.min > 480 ? '过长，候凝慢' : '施工窗口内') + '</td>', click: function () { selectA(i, true); } });
    });
    rows.push({ html: '<td class="num">' + (rows.length + 1) + '</td><td>谢云媚 2025</td><td>150℃ / 75 MPa</td><td class="num">3 %BWOC</td><td class="num">5:16 (316 min)</td><td>AMND，大温差井适用</td>', click: function () { selectT(0); } });
    STR.forEach(function (s, i) {
      rows.push({ html: '<td class="num">' + (rows.length + 1) + '</td><td>谢云媚 2025</td><td>150℃ 循环 / 60℃ 养护</td><td class="num">3 %BWOC</td><td class="num">' + s.d + ' d：' + s.mpa.toFixed(2) + ' MPa</td><td>' + (s.mpa >= 3.45 ? '超 500 psi 阈值' : '低于钻塞阈值') + '</td>', click: function () { selectB(i); } });
    });
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = r.html;
      tr.addEventListener('click', r.click);
      body.appendChild(tr);
    });
  }

  function bindZoomBtns() {
    var zi = document.getElementById('z-in'), zo = document.getElementById('z-out'), zr = document.getElementById('z-reset');
    if (zi) zi.addEventListener('click', function () { var c = (Z.x0 + Z.x1) / 2, s = (Z.x1 - Z.x0) * 0.7; setView(c - s / 2, c + s / 2); });
    if (zo) zo.addEventListener('click', function () { var c = (Z.x0 + Z.x1) / 2, s = (Z.x1 - Z.x0) * 1.4; setView(c - s / 2, c + s / 2); });
    if (zr) zr.addEventListener('click', function () { setView(X0, X1); });
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
      });
    });
  }

  bindTabs(); bindChartA(); bindChartB(); bindTable(); bindZoomBtns();
  drawAll(); renderDetail();
})();
