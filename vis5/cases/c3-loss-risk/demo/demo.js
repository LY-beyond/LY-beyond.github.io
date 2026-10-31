/* ======= 固井井漏风险预测 · 可交互示范 ======= */
(function () {
  'use strict';

  // ---------- 常量 ----------
  const G = 9.81;              // 重力加速度 m/s²
  const M2FT = 3.28084;        // 米转英尺
  const PA2PSI = 1 / 6894.76;  // Pa 转 psi
  const MP2PSI = 145.038;      // MPa 转 psi
  const GCM3_2_PPG = 8.345;    // g/cm³ 转 ppg

  // ---------- 状态 ----------
  let S = {
    tvd: 3000,     // TVD 井深 m
    rho: 1.80,     // 水泥浆密度 g/cm³
    q: 2.0,        // 排量 m³/min
    dh: 311,       // 井径 mm
    dc: 244,       // 套管外径 mm
    n: 0.60,       // 流性指数
    k: 0.80,       // 稠度系数 Pa·s^n
    pore: 11.0,    // 孔隙压力梯度 ppg
    frac: 16.0,    // 破裂压力梯度 ppg
    zloss: 70,     // 漏失层深度占比 %
    open: 1.0,     // 漏失层裂缝开度 mm
    bp: 2.0        // 井口回压 MPa
  };

  // ===== 邻接环节参数联动（固井工作流共享，key=cementing-shared）=====
  const SHARED_KEY = 'cementing-shared';
  // 共享 key -> 内部 S key 的映射（内部不改名，通过映射完成共享）
  const KEY_MAP = { density: 'rho', flowRate: 'q', holeDiameter: 'dh', casingOD: 'dc', n: 'n', k: 'k', porePPG: 'pore', fracPPG: 'frac', backPressure: 'bp' };
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
    MY_KEYS.forEach(function (k) { if (typeof S[KEY_MAP[k]] === 'number') cur[k] = S[KEY_MAP[k]]; });
    localStorage.setItem(SHARED_KEY, JSON.stringify(cur));
  }

  function $(id) { return document.getElementById(id); }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------- 物理计算 ----------
  function compute() {
    const tvd = S.tvd;
    const tvdFt = tvd * M2FT;

    const dh_m = S.dh / 1000;
    const dc_m = S.dc / 1000;
    const de_m = Math.max(0.001, dh_m - dc_m);          // 等效直径 m
    const A = Math.PI / 4 * (dh_m * dh_m - dc_m * dc_m); // 环空面积 m²
    const Q_m3s = S.q / 60;                               // m³/s
    const V = A > 0 ? Q_m3s / A : 0;                      // 环空流速 m/s

    // 幂律层流环空摩阻梯度 dP/dL (Pa/m)
    const dPdL = (4 * S.k / de_m) * Math.pow(8 * V / de_m, S.n);
    const aplPa = dPdL * tvd;            // 环空总摩阻 Pa
    const aplPsi = aplPa * PA2PSI;        // 转 psi

    // ECD 各组成
    const rhoPpg = S.rho * GCM3_2_PPG;                          // 静液柱当量 ppg
    const aplEcd = aplPsi / (0.052 * tvdFt);                    // 摩阻贡献 ppg
    const bpPsi = S.bp * MP2PSI;
    const bpEcd = bpPsi / (0.052 * tvdFt);                      // 回压贡献 ppg（在井底）
    const ecd = rhoPpg + aplEcd + bpEcd;                         // 井底 ECD ppg

    // 漏失概率
    const sigma = 0.35;
    const baseProb = 1 / (1 + Math.exp((S.frac - ecd) / sigma));
    const fracBonus = clamp((S.open / 5.0) * 0.18, 0, 0.18);
    const prob = clamp(baseProb + fracBonus, 0.01, 0.99);

    // 漏失速率（ECD > 破裂时）
    const over = Math.max(0, ecd - S.frac);
    const C = 0.025;
    const qLoss = over > 0 ? C * Math.pow(S.open, 1.5) * Math.pow(over, 1.5) : 0; // m³/min
    const loss30 = qLoss * 30; // m³

    // 扫描最大允许排量
    let qMax = S.q;
    const steps = [];
    for (let qs = 0.5; qs <= 4.0 + 1e-6; qs += 0.05) {
      const V_s = (qs / 60) / A;
      const dPdL_s = (4 * S.k / de_m) * Math.pow(8 * V_s / de_m, S.n);
      const aplEcd_s = (dPdL_s * tvd * PA2PSI) / (0.052 * tvdFt);
      const ecd_s = rhoPpg + aplEcd_s + bpEcd;
      steps.push({ q: qs, ecd: ecd_s });
      if (ecd_s <= S.frac) qMax = qs;
    }

    // 建议密度（使当前排量下 ECD 落在破裂线以下 0.3 ppg）
    const targetEcd = S.frac - 0.3;
    const rhoRecPpg = targetEcd - aplEcd - bpEcd;
    const rhoRec = clamp(rhoRecPpg / GCM3_2_PPG, 1.0, 2.2);

    // 特征贡献（归一化到安全窗口宽度）
    const window = Math.max(0.5, S.frac - S.pore);
    const hydroScore = clamp((rhoPpg - S.pore) / window, 0, 1.2) / 1.2;
    const aplScore = clamp(aplEcd / window, 0, 1);
    const bpScore = clamp(bpEcd / window, 0, 1);
    const fracScore = clamp(S.open / 5.0, 0, 1);

    return {
      tvd, tvdFt, dh_m, dc_m, de_m, A, V, dPdL, aplPsi, aplEcd,
      rhoPpg, bpEcd, ecd, prob, qLoss, loss30, qMax, rhoRec,
      steps, hydroScore, aplScore, bpScore, fracScore, over
    };
  }

  // ---------- 面板1：压力窗口剖面 ----------
  function drawWindow(r) {
    const svg = $('panel-window');
    const W = 430, H = 210, padL = 40, padR = 12, padT = 16, padB = 24;
    const pw = W - padL - padR, ph = H - padT - padB;

    // 深度采样
    const N = 60;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const z = r.tvd * (0.02 + 0.98 * t); // 避免 z=0 奇异
      const zFt = z * M2FT;
      const aplEcd_z = (r.dPdL * z * PA2PSI) / (0.052 * zFt);
      const bpEcd_z = (S.bp * MP2PSI) / (0.052 * zFt);
      const ecd_z = r.rhoPpg + aplEcd_z + bpEcd_z;
      pts.push({ z, ecd: ecd_z });
    }

    const xMin = Math.min(S.pore, r.ecd) - 1;
    const xMax = Math.max(S.frac, r.ecd) + 1;
    const xRange = xMax - xMin;

    const x2px = v => padL + ((v - xMin) / xRange) * pw;
    const y2px = z => padT + (z / r.tvd) * ph;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 安全窗口色带
    s += `<rect x="${x2px(S.pore)}" y="${padT}" width="${x2px(S.frac) - x2px(S.pore)}" height="${ph}" fill="#e7f3ea" opacity="0.55"/>`;

    // 网格
    for (let i = 0; i <= 5; i++) {
      const y = padT + i / 5 * ph;
      const z = (i / 5 * r.tvd).toFixed(0);
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${z}m</text>`;
    }
    const vStep = Math.max(1, Math.ceil((xMax - xMin) / 10));
    for (let v = Math.ceil(xMin); v <= Math.floor(xMax); v += vStep) {
      const x = x2px(v);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ph}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${x}" y="${H - padB + 12}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${v}</text>`;
    }

    // 孔隙线
    const xPore = x2px(S.pore);
    s += `<line x1="${xPore}" y1="${padT}" x2="${xPore}" y2="${padT + ph}" stroke="#2f7d6b" stroke-width="2"/>`;
    s += `<text x="${xPore}" y="${padT - 5}" font-size="8" fill="#2f7d6b" text-anchor="middle" font-weight="600">孔隙 ${S.pore.toFixed(1)}</text>`;

    // 破裂线
    const xFrac = x2px(S.frac);
    s += `<line x1="${xFrac}" y1="${padT}" x2="${xFrac}" y2="${padT + ph}" stroke="#c9a15a" stroke-width="2" stroke-dasharray="5 3"/>`;
    s += `<text x="${xFrac}" y="${padT - 5}" font-size="8" fill="#c9a15a" text-anchor="middle" font-weight="600">破裂 ${S.frac.toFixed(1)}</text>`;

    // ECD 越界段（红色）
    const lossZ = r.tvd * S.zloss / 100;
    let overStart = -1;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].ecd > S.frac && overStart < 0) overStart = i;
      if (pts[i].ecd <= S.frac && overStart >= 0) {
        s += `<rect x="${x2px(S.frac)}" y="${y2px(pts[overStart].z)}" width="${x2px(xMax) - x2px(S.frac)}" height="${y2px(pts[i].z) - y2px(pts[overStart].z)}" fill="#b05a51" opacity="0.12"/>`;
        overStart = -1;
      }
    }
    if (overStart >= 0) {
      s += `<rect x="${x2px(S.frac)}" y="${y2px(pts[overStart].z)}" width="${x2px(xMax) - x2px(S.frac)}" height="${y2px(r.tvd) - y2px(pts[overStart].z)}" fill="#b05a51" opacity="0.12"/>`;
    }

    // ECD 曲线
    let path = '';
    for (let i = 0; i < pts.length; i++) {
      const x = x2px(pts[i].ecd);
      const y = y2px(pts[i].z);
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#41699b" stroke-width="2.2" stroke-linejoin="round"/>`;

    // 漏失层标记
    const yLoss = y2px(lossZ);
    s += `<line x1="${padL}" y1="${yLoss}" x2="${W - padR}" y2="${yLoss}" stroke="#b05a51" stroke-width="1" stroke-dasharray="3 3"/>`;
    s += `<text x="${W - padR - 3}" y="${yLoss + 3}" font-size="8" fill="#b05a51" font-weight="600" text-anchor="end">漏失层 ${lossZ.toFixed(0)}m</text>`;

    // 轴标签
    s += `<text x="${(padL + W - padR) / 2}" y="${H - 4}" font-size="8.5" fill="#79828a" text-anchor="middle">压力梯度 / ECD (ppg)</text>`;
    s += `<text x="10" y="${(padT + padT + ph) / 2}" font-size="8.5" fill="#79828a" text-anchor="middle" transform="rotate(-90 10 ${(padT + padT + ph) / 2})">井深 (m)</text>`;

    // 图例
    s += `<rect x="${padL}" y="${H - 18}" width="9" height="3" fill="#41699b"/>`;
    s += `<text x="${padL + 12}" y="${H - 13}" font-size="8" fill="#5d666d">ECD</text>`;
    s += `<rect x="${padL + 42}" y="${H - 18}" width="9" height="3" fill="#2f7d6b"/>`;
    s += `<text x="${padL + 54}" y="${H - 13}" font-size="8" fill="#5d666d">孔隙</text>`;
    s += `<rect x="${padL + 86}" y="${H - 18}" width="9" height="3" fill="#c9a15a"/>`;
    s += `<text x="${padL + 98}" y="${H - 13}" font-size="8" fill="#5d666d">破裂</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板2：ECD vs 排量 ----------
  function drawEcd(r) {
    const svg = $('panel-ecd');
    const W = 430, H = 200, padL = 40, padR = 12, padT = 16, padB = 26;
    const pw = W - padL - padR, ph = H - padT - padB;

    const qMin = 0.5, qMax = 4.0;
    const ecds = r.steps.map(s => s.ecd);
    const yMin = Math.min(S.pore, Math.min.apply(null, ecds)) - 0.5;
    const yMax = Math.max(S.frac, Math.max.apply(null, ecds)) + 0.5;

    const x2px = q => padL + ((q - qMin) / (qMax - qMin)) * pw;
    const y2px = e => padT + (1 - (e - yMin) / (yMax - yMin)) * ph;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 安全窗口色带
    s += `<rect x="${padL}" y="${y2px(S.frac)}" width="${pw}" height="${y2px(S.pore) - y2px(S.frac)}" fill="#e7f3ea" opacity="0.55"/>`;

    // 网格
    for (let i = 0; i <= 5; i++) {
      const x = padL + i / 5 * pw;
      const qv = (qMin + i / 5 * (qMax - qMin)).toFixed(1);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ph}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${x}" y="${H - padB + 13}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${qv}</text>`;
    }
    for (let i = 0; i <= 6; i++) {
      const y = padT + i / 6 * ph;
      const ev = (yMax - i / 6 * (yMax - yMin)).toFixed(1);
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${ev}</text>`;
    }

    // 孔隙线
    s += `<line x1="${padL}" y1="${y2px(S.pore)}" x2="${W - padR}" y2="${y2px(S.pore)}" stroke="#2f7d6b" stroke-width="1.5"/>`;
    s += `<text x="${W - padR - 3}" y="${y2px(S.pore) - 4}" font-size="8" fill="#2f7d6b" font-weight="600" text-anchor="end">孔隙 ${S.pore.toFixed(1)}</text>`;

    // 破裂线
    s += `<line x1="${padL}" y1="${y2px(S.frac)}" x2="${W - padR}" y2="${y2px(S.frac)}" stroke="#c9a15a" stroke-width="1.8" stroke-dasharray="5 3"/>`;
    s += `<text x="${W - padR - 3}" y="${y2px(S.frac) + 10}" font-size="8" fill="#c9a15a" font-weight="600" text-anchor="end">破裂 ${S.frac.toFixed(1)}</text>`;

    // ECD 曲线
    let path = '';
    r.steps.forEach((p, i) => {
      const x = x2px(p.q);
      const y = y2px(p.ecd);
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    s += `<path d="${path}" fill="none" stroke="#41699b" stroke-width="2.2" stroke-linejoin="round"/>`;

    // 当前点
    const cx = x2px(S.q), cy = y2px(r.ecd);
    s += `<circle cx="${cx}" cy="${cy}" r="4" fill="#41699b" stroke="#fff" stroke-width="1.6"/>`;
    s += `<text x="${cx + 7}" y="${cy - 5}" font-size="8" fill="#41699b" font-weight="600" font-family="monospace">Q=${S.q.toFixed(1)} ECD=${r.ecd.toFixed(1)}</text>`;

    // 最大允许排量
    if (r.qMax > 0) {
      const xm = x2px(r.qMax);
      s += `<line x1="${xm}" y1="${padT}" x2="${xm}" y2="${padT + ph}" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      s += `<text x="${Math.min(xm, W - 34)}" y="${padT - 5}" font-size="8" fill="#b05a51" text-anchor="middle" font-weight="600">最大允许 ${r.qMax.toFixed(2)}</text>`;
    }

    s += `<text x="${(padL + W - padR) / 2}" y="${H - 4}" font-size="8.5" fill="#79828a" text-anchor="middle">排量 Q (m³/min)</text>`;
    s += `<text x="10" y="${(padT + padT + ph) / 2}" font-size="8.5" fill="#79828a" text-anchor="middle" transform="rotate(-90 10 ${(padT + padT + ph) / 2})">ECD (ppg)</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板3：漏失量随时间 ----------
  function drawLoss(r) {
    const svg = $('panel-loss');
    const W = 430, H = 170, padL = 36, padR = 12, padT = 12, padB = 20;
    const pw = W - padL - padR, ph = H - padT - padB;

    const tMax = 30;
    const vMax = Math.max(0.5, r.loss30 * 1.15);

    const x2px = t => padL + (t / tMax) * pw;
    const y2px = v => padT + (1 - v / vMax) * ph;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 网格
    for (let i = 0; i <= 5; i++) {
      const x = padL + i / 5 * pw;
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ph}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${x}" y="${H - padB + 12}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${(i * 6)}</text>`;
    }
    for (let i = 0; i <= 4; i++) {
      const y = padT + i / 4 * ph;
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="7.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${(vMax - i / 4 * vMax).toFixed(1)}</text>`;
    }

    // 曲线
    if (r.qLoss > 0) {
      const y0 = y2px(0);
      const y1 = y2px(r.loss30);
      const x1 = x2px(tMax);
      s += `<line x1="${padL}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#b05a51" stroke-width="2.2" stroke-linejoin="round"/>`;
      s += `<circle cx="${x1}" cy="${y1}" r="3.5" fill="#b05a51"/>`;
      s += `<text x="${x1 - 4}" y="${y1 - 7}" font-size="8" fill="#b05a51" text-anchor="end" font-weight="600" font-family="monospace">${r.loss30.toFixed(2)} m³</text>`;
    } else {
      s += `<line x1="${padL}" y1="${y2px(0)}" x2="${W - padR}" y2="${y2px(0)}" stroke="#2f7d6b" stroke-width="2"/>`;
      s += `<text x="${(padL + W - padR) / 2}" y="${padT + ph / 2}" font-size="9" fill="#3f8560" text-anchor="middle" font-weight="600">ECD 未越界，无漏失</text>`;
    }

    s += `<text x="${(padL + W - padR) / 2}" y="${H - 3}" font-size="8" fill="#79828a" text-anchor="middle">时间 (min)</text>`;
    s += `<text x="9" y="${(padT + padT + ph) / 2}" font-size="8" fill="#79828a" text-anchor="middle" transform="rotate(-90 9 ${(padT + padT + ph) / 2})">累计漏失 (m³)</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板4：特征贡献条形图 ----------
  function drawBars(r) {
    const svg = $('panel-bars');
    const W = 430, H = 170, padL = 62, padR = 12, padT = 8, padB = 14;
    const pw = W - padL - padR;
    const barH = 24, gap = 9;

    const items = [
      { label: '静液柱', score: r.hydroScore, val: r.rhoPpg.toFixed(1) + ' ppg' },
      { label: '环空摩阻', score: r.aplScore, val: r.aplEcd.toFixed(1) + ' ppg' },
      { label: '井口回压', score: r.bpScore, val: r.bpEcd.toFixed(1) + ' ppg' },
      { label: '漏失层裂缝', score: r.fracScore, val: S.open.toFixed(1) + ' mm' }
    ];

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    items.forEach((it, i) => {
      const y = padT + i * (barH + gap);
      const w = pw * it.score;
      const danger = it.score > 0.5;
      const color = danger ? '#b05a51' : '#2f7d6b';

      s += `<rect x="${padL}" y="${y}" width="${pw}" height="${barH}" rx="4" fill="#f5f2ea"/>`;
      s += `<rect x="${padL}" y="${y}" width="${Math.max(2, w)}" height="${barH}" rx="4" fill="${color}" opacity="0.82"/>`;
      s += `<text x="${padL - 7}" y="${y + barH / 2 + 3}" font-size="9" fill="#4d565b" text-anchor="end" font-weight="500">${it.label}</text>`;
      s += `<text x="${padL + w + 5}" y="${y + barH / 2 + 3}" font-size="8" fill="${color}" font-family="monospace" font-weight="600">${it.val}</text>`;
      s += `<text x="${padL + w - 5}" y="${y + barH / 2 + 3}" font-size="8" fill="#fff" text-anchor="end" font-family="monospace">${(it.score * 100).toFixed(0)}%</text>`;
    });

    s += `<text x="${padL}" y="${H - 3}" font-size="8" fill="#9ba3a9">相对风险贡献（红色＞50% 危险）</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板2b：漏失概率热力图 (Canvas) ----------
  function drawHeat(r) {
    const canvas = $('panel-heat');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const padL = 36, padR = 10, padT = 10, padB = 22;
    const pw = W - padL - padR, ph = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    const cols = 40, rows = 28;
    const cellW = pw / cols, cellH = ph / rows;
    const qMin = 0.5, qMax = 4.0, rhoMin = 1.0, rhoMax = 2.2;

    const tvdFt = S.tvd * M2FT;
    const dh_m = S.dh / 1000, dc_m = S.dc / 1000;
    const de_m = Math.max(0.001, dh_m - dc_m);
    const A = Math.PI / 4 * (dh_m * dh_m - dc_m * dc_m);
    const bpEcd = (S.bp * MP2PSI) / (0.052 * tvdFt);

    function colorFor(p) {
      let r, g, b;
      if (p < 0.5) {
        const t = p / 0.5;
        r = Math.round(47 + (201 - 47) * t);
        g = Math.round(125 + (161 - 125) * t);
        b = Math.round(107 + (90 - 107) * t);
      } else {
        const t = (p - 0.5) / 0.5;
        r = Math.round(201 + (176 - 201) * t);
        g = Math.round(161 + (90 - 161) * t);
        b = Math.round(90 + (81 - 90) * t);
      }
      return `rgb(${r},${g},${b})`;
    }

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const q = qMin + (i / (cols - 1)) * (qMax - qMin);
        const rho = rhoMin + (j / (rows - 1)) * (rhoMax - rhoMin);
        const V = (q / 60) / A;
        const dPdL = (4 * S.k / de_m) * Math.pow(8 * V / de_m, S.n);
        const aplEcd = (dPdL * S.tvd * PA2PSI) / (0.052 * tvdFt);
        const ecd = rho * GCM3_2_PPG + aplEcd + bpEcd;
        const sigma = 0.35;
        const baseProb = 1 / (1 + Math.exp((S.frac - ecd) / sigma));
        const prob = clamp(baseProb + clamp((S.open / 5.0) * 0.18, 0, 0.18), 0.01, 0.99);
        ctx.fillStyle = colorFor(prob);
        ctx.fillRect(padL + i * cellW, padT + j * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // 轴刻度
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const x = padL + i / 5 * pw;
      ctx.fillText((qMin + i / 5 * (qMax - qMin)).toFixed(1), x, H - padB + 11);
    }
    ctx.textAlign = 'end';
    for (let j = 0; j <= 4; j++) {
      const y = padT + j / 4 * ph;
      ctx.fillText((rhoMax - j / 4 * (rhoMax - rhoMin)).toFixed(1), padL - 4, y + 3);
    }

    // 轴标签
    ctx.fillStyle = '#79828a';
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('排量 Q (m³/min)', padL + pw / 2, H - 3);
    ctx.save();
    ctx.translate(9, padT + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('水泥浆密度 (g/cm³)', 0, 0);
    ctx.restore();

    // 当前工况红圈
    const cx = padL + ((S.q - qMin) / (qMax - qMin)) * pw;
    const cy = padT + ((S.rho - rhoMin) / (rhoMax - rhoMin)) * ph;
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---------- KPI 与结论 ----------
  function paintKpi(r) {
    const pct = (r.prob * 100).toFixed(0);
    $('kpi-prob').textContent = pct + '%';
    $('kpi-prob-sub').textContent = '含裂缝加成';
    const probEl = $('kpi-prob').parentElement;
    probEl.className = 'kpi' + (r.prob > 0.66 ? ' bad' : r.prob > 0.33 ? ' warn' : '');

    let level, sub, cls;
    if (r.prob < 0.33) { level = '低风险'; sub = '可按常规施工'; cls = 'ok'; }
    else if (r.prob < 0.66) { level = '中风险'; sub = '建议准备暂堵'; cls = 'warn'; }
    else { level = '高风险'; sub = '必须调整方案'; cls = 'bad'; }
    $('kpi-level').textContent = level;
    $('kpi-level-sub').textContent = sub;
    $('kpi-level').parentElement.className = 'kpi' + (cls === 'bad' ? ' bad' : cls === 'warn' ? ' warn' : '');

    $('kpi-ecd').textContent = r.ecd.toFixed(2);
    $('kpi-ecd').parentElement.className = 'kpi' + (r.ecd > S.frac ? ' bad' : r.ecd > S.frac - 0.5 ? ' warn' : '');
    $('kpi-qmax').textContent = r.qMax.toFixed(2);
    $('kpi-rho').textContent = r.rhoRec.toFixed(2);
    $('kpi-loss').textContent = r.loss30.toFixed(2);
    $('kpi-loss').parentElement.className = 'kpi' + (r.loss30 > 1 ? ' bad' : '');

    const v = $('verdict');
    v.className = 'verdict ' + cls;
    if (r.ecd > S.frac) {
      v.textContent = `ECD ${r.ecd.toFixed(2)} ppg 已突破破裂压力 ${S.frac.toFixed(1)} ppg，正在漏失！建议：① 降至密度 ${r.rhoRec.toFixed(2)} g/cm³；② 排量不超过 ${r.qMax.toFixed(2)} m³/min；③ 井口回压降至 0。`;
    } else if (r.ecd > S.frac - 0.5) {
      v.textContent = `ECD ${r.ecd.toFixed(2)} ppg 接近破裂线 ${S.frac.toFixed(1)} ppg，余量不足。建议密度降至 ${r.rhoRec.toFixed(2)} g/cm³ 或排量不超过 ${r.qMax.toFixed(2)} m³/min。`;
    } else {
      v.textContent = `ECD ${r.ecd.toFixed(2)} ppg 处于安全窗口内（孔隙 ${S.pore.toFixed(1)} ~ 破裂 ${S.frac.toFixed(1)} ppg），漏失概率 ${pct}%，可按当前方案施工。`;
    }
  }

  // ---------- 主刷新 ----------
  function paint() {
    const r = compute();
    drawWindow(r);
    drawEcd(r);
    drawHeat(r);
    drawLoss(r);
    drawBars(r);
    paintKpi(r);
  }

  // ---------- 事件绑定 ----------
  function bind() {
    const fields = [
      { id: 's-tvd', key: 'tvd', out: 'o-tvd', fmt: v => v.toFixed(0) },
      { id: 's-rho', key: 'rho', out: 'o-rho', fmt: v => v.toFixed(2) },
      { id: 's-q', key: 'q', out: 'o-q', fmt: v => v.toFixed(1) },
      { id: 's-dh', key: 'dh', out: 'o-dh', fmt: v => v.toFixed(0) },
      { id: 's-dc', key: 'dc', out: 'o-dc', fmt: v => v.toFixed(0) },
      { id: 's-n', key: 'n', out: 'o-n', fmt: v => v.toFixed(2) },
      { id: 's-k', key: 'k', out: 'o-k', fmt: v => v.toFixed(2) },
      { id: 's-pore', key: 'pore', out: 'o-pore', fmt: v => v.toFixed(1) },
      { id: 's-frac', key: 'frac', out: 'o-frac', fmt: v => v.toFixed(1) },
      { id: 's-zloss', key: 'zloss', out: 'o-zloss', fmt: v => v.toFixed(0) },
      { id: 's-open', key: 'open', out: 'o-open', fmt: v => v.toFixed(1) },
      { id: 's-bp', key: 'bp', out: 'o-bp', fmt: v => v.toFixed(1) }
    ];
    fields.forEach(f => {
      const el = $(f.id);
      const out = $(f.out);
      el.value = S[f.key];
      out.textContent = f.fmt(S[f.key]);
      el.addEventListener('input', () => {
        S[f.key] = parseFloat(el.value);
        out.textContent = f.fmt(S[f.key]);
        saveShared();
        paint();
      });
    });
  }

  // ===== 方案对比面板：计算指定参数状态下的关键指标 =====
  // 推荐方案：密度 1.4、排量 1.2、破裂裕度大、回压为 0
  const REC_PARAMS = { rho: 1.4, q: 1.2, frac: 17.0, bp: 0, open: 0.5 };
  function computeMetricsWith(state) {
    // 临时替换 S 中的参数，计算后恢复
    var orig = {};
    Object.keys(state).forEach(function (k) { orig[k] = S[k]; S[k] = state[k]; });
    var r = compute();
    Object.keys(orig).forEach(function (k) { S[k] = orig[k]; });
    return {
      prob: (r.prob * 100).toFixed(0) + '%',
      ecd: r.ecd.toFixed(2) + ' ppg',
      qMax: r.qMax.toFixed(2) + ' m³/min'
    };
  }

  function renderCompare() {
    var cur = computeMetricsWith({});
    var rec = computeMetricsWith(REC_PARAMS);
    $('c-cur-prob').textContent = cur.prob;
    $('c-cur-ecd').textContent = cur.ecd;
    $('c-cur-qmax').textContent = cur.qMax;
    $('c-rec-prob').textContent = rec.prob;
    $('c-rec-ecd').textContent = rec.ecd;
    $('c-rec-qmax').textContent = rec.qMax;
  }

  function updateSyncNote(n) {
    $('sync-note').innerHTML =
      '邻接参数联动：已同步 ' + n + ' 个共享参数（密度/井径/排量/套管/流性/压力窗口/回压…）' +
      '<button id="btn-clear-shared">清空共享参数</button>';
    var btn = $('btn-clear-shared');
    if (btn) btn.addEventListener('click', clearShared);
  }

  function clearShared() {
    localStorage.removeItem(SHARED_KEY);
    // 重置 S 为默认参数
    S = {
      tvd: 3000, rho: 1.80, q: 2.0, dh: 311, dc: 244, n: 0.60, k: 0.80,
      pore: 11.0, frac: 16.0, zloss: 70, open: 1.0, bp: 2.0
    };
    bind();
    updateSyncNote(0);
    paint();
    renderCompare();
  }

  function applyRecommended() {
    Object.keys(REC_PARAMS).forEach(function (k) { S[k] = REC_PARAMS[k]; });
    bind();
    saveShared();
    paint();
    renderCompare();
  }

  // ===== 初始化：先默认值，再 loadShared 覆盖，再同步 slider，再渲染 =====
  var sharedCount = loadShared();
  bind();
  updateSyncNote(sharedCount);
  saveShared();
  paint();
  renderCompare();

  $('btn-apply-rec').addEventListener('click', applyRecommended);
  $('btn-cur').addEventListener('click', renderCompare);
})();
