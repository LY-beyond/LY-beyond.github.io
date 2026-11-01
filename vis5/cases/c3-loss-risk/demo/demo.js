/* ======= 固井井漏风险预测 · 可交互示范 ======= */
(function () {
  'use strict';

  // HiDPI 适配：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标
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
      s += `<text x="${x}" y="${H - 16}" font-size="7.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${v}</text>`;
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

    // 图例（移到绘图区内左上角，避开底部刻度与轴标题）
    const lgY = padT + 12;
    s += `<rect x="${padL + 4}" y="${lgY - 4}" width="9" height="3" fill="#41699b"/>`;
    s += `<text x="${padL + 16}" y="${lgY}" font-size="8" fill="#5d666d">ECD</text>`;
    s += `<rect x="${padL + 46}" y="${lgY - 4}" width="9" height="3" fill="#2f7d6b"/>`;
    s += `<text x="${padL + 58}" y="${lgY}" font-size="8" fill="#5d666d">孔隙</text>`;
    s += `<rect x="${padL + 90}" y="${lgY - 4}" width="9" height="3" fill="#c9a15a"/>`;
    s += `<text x="${padL + 102}" y="${lgY}" font-size="8" fill="#5d666d">破裂</text>`;

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
    const W = 430, H = 170;
    const ctx = setupCanvas(canvas, W, H);
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

  // 尺寸变化时重建 canvas backing store，保持清晰
  let rsTimer = null;
  window.addEventListener('resize', () => {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(() => drawHeat(compute()), 120);
  });
})();

/* ======= 现场数据页：IODP 348 C0002P 漏失事件（真实数据） ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // 数据来源：IODP Exp. 348, Site C0002, Hole C0002P（DOI 10.2204/iodp.proc.348.103.2015, CC BY）
  var MUD = 9.43, ECD = 9.70;               // 泥浆当量 / 实测漏失阈值 ECD（ppg）
  var EV = [
    { z: 1954.5, rate: 40,   txt: '40',   desc: '明显漏失，漏速约 40 m³/h' },
    { z: 1994.5, rate: 7.5,  txt: '5–10', desc: '渗漏，漏速 5–10 m³/h' },
    { z: 2036.5, rate: 48,   txt: '48',   desc: '严重漏失，漏速约 48 m³/h' },
    { z: 2041.5, rate: 50,   txt: '50',   desc: '完全漏失，漏速约 50 m³/h（本段最大）' },
    { z: 2117.5, rate: 27,   txt: '27',   desc: '漏速约 27 m³/h' }
  ];
  var ZMIN = 1900, ZMAX = 2140, MINSPAN = 20, RMAX = 60;
  var Z = { z0: ZMIN, z1: ZMAX, sel: -1 };
  var PL = 52, PR = 14;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(x, y, s, attrs, parent) {
    var t = el('text', attrs || {}, parent);
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.textContent = s; return t;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function xOf(z, plotW) { return PL + (z - Z.z0) / (Z.z1 - Z.z0) * plotW; }

  function pickStep(span, target) {
    var cand = [2, 5, 10, 20, 40, 80];
    for (var i = 0; i < cand.length; i++) if (span / cand[i] <= target) return cand[i];
    return 160;
  }

  function drawA() {
    var svg = document.getElementById('lit-chartA');
    if (!svg) return;
    var W = 900, H = 300, PT = 24, PB = 36;
    var plotW = W - PL - PR, plotH = H - PT - PB;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    // 网格与刻度
    for (var r = 0; r <= RMAX; r += 10) {
      var y = PT + plotH - r / RMAX * plotH;
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: r ? '#eee7d8' : '#d8d0bc', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, String(r), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    var span = Z.z1 - Z.z0, step = pickStep(span, 8);
    for (var z = Math.ceil(Z.z0 / step) * step; z <= Z.z1; z += step) {
      var x = xOf(z, plotW);
      el('line', { x1: x, y1: PT, x2: x, y2: PT + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, PT + plotH + 14, String(z), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 4, '深度 (mbsf)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(12, PT + plotH / 2, '漏失速率 (m³/h)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (PT + plotH / 2) + ')' }, svg);
    // 严重漏失参考线
    var ys = PT + plotH - 30 / RMAX * plotH;
    el('line', { x1: PL, y1: ys, x2: W - PR, y2: ys, stroke: '#c9a15a', 'stroke-width': 1, 'stroke-dasharray': '5 3' }, svg);
    txt(W - PR - 4, ys - 4, '严重漏失 ≥30 m³/h', { 'font-size': 9, fill: '#9a7a1c', 'text-anchor': 'end' }, svg);
    // 事件柱
    var bw = Math.max(8, Math.min(46, plotW / span * 4));
    EV.forEach(function (e, i) {
      if (e.z < Z.z0 || e.z > Z.z1) return;
      var x = xOf(e.z, plotW), h = e.rate / RMAX * plotH, y = PT + plotH - h;
      el('rect', {
        x: x - bw / 2, y: y, width: bw, height: h, rx: 2,
        fill: '#b05a51', opacity: Z.sel === i ? 1 : 0.72,
        stroke: Z.sel === i ? '#7d3a33' : 'none', 'stroke-width': Z.sel === i ? 2 : 0
      }, svg);
      txt(x, y - 4, e.txt, { 'font-size': 9.5, fill: Z.sel === i ? '#7d3a33' : '#8a5a52', 'text-anchor': 'middle', 'font-weight': Z.sel === i ? 700 : 400 }, svg);
    });
    txt(PL + 4, PT + 12, '视窗 ' + Z.z0.toFixed(0) + '–' + Z.z1.toFixed(0) + ' mbsf', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function drawB() {
    var svg = document.getElementById('lit-chartB');
    if (!svg) return;
    var W = 900, H = 200, PT = 20, PB = 30;
    var plotW = W - PL - PR, plotH = H - PT - PB;
    var G0 = 9.2, G1 = 10.0;
    function yOf(g) { return PT + (G1 - g) / (G1 - G0) * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var g = G0; g <= G1 + 1e-9; g += 0.2) {
      var gv = Math.round(g * 10) / 10;
      var y = yOf(gv);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, gv.toFixed(1), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    var span = Z.z1 - Z.z0, step = pickStep(span, 8);
    for (var z = Math.ceil(Z.z0 / step) * step; z <= Z.z1; z += step) {
      txt(xOf(z, plotW), PT + plotH + 14, String(z), { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 4, '深度 (mbsf)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(12, PT + plotH / 2, '当量密度 (ppg)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (PT + plotH / 2) + ')' }, svg);
    // 泥浆线 / 漏失阈值线
    var ym = yOf(MUD), ye = yOf(ECD);
    el('line', { x1: PL, y1: ym, x2: W - PR, y2: ym, stroke: '#2f7d6b', 'stroke-width': 2 }, svg);
    txt(W - PR - 4, ym + 12, '随钻泥浆 9.43 ppg', { 'font-size': 9, fill: '#2f7d6b', 'text-anchor': 'end' }, svg);
    el('line', { x1: PL, y1: ye, x2: W - PR, y2: ye, stroke: '#b05a51', 'stroke-width': 2, 'stroke-dasharray': '6 3' }, svg);
    /* 说明放在阈值线下方，避免与事件数值标签（dot 上方）相撞 */
    txt(W - PR - 4, ye + 12, '实测漏失阈值 ECD ≈ 9.70 ppg', { 'font-size': 9, fill: '#b05a51', 'text-anchor': 'end' }, svg);
    // 事件点：漏失发生时环空当量触及阈值
    EV.forEach(function (e, i) {
      if (e.z < Z.z0 || e.z > Z.z1) return;
      var x = xOf(e.z, plotW);
      el('circle', {
        cx: x, cy: ye, r: Z.sel === i ? 8 : 5.5,
        fill: '#b05a51', opacity: Z.sel === i ? 1 : 0.75,
        stroke: Z.sel === i ? '#7d3a33' : '#fdfcf8', 'stroke-width': Z.sel === i ? 2 : 1.2
      }, svg);
      txt(x, ye - 10, e.txt, { 'font-size': 9, fill: '#8a5a52', 'text-anchor': 'middle' }, svg);
    });
  }

  function drawAll() { drawA(); drawB(); updateLabel(); }

  function updateLabel() {
    var l = document.getElementById('z-label');
    if (l) l.textContent = '视窗 ' + Z.z0.toFixed(0) + '–' + Z.z1.toFixed(0) + ' mbsf';
  }

  function setView(a, b) {
    var span = b - a;
    if (span < MINSPAN) { var c = (a + b) / 2; a = c - MINSPAN / 2; b = a + MINSPAN; }
    if (a < ZMIN) { b -= (a - ZMIN); a = ZMIN; }
    if (b > ZMAX) { a -= (b - ZMAX); b = ZMAX; }
    a = clamp(a, ZMIN, ZMAX); b = clamp(b, a, ZMAX);
    if (b - a < MINSPAN) { b = ZMAX; a = ZMAX - MINSPAN; }
    Z.z0 = a; Z.z1 = b;
    drawAll();
  }

  function renderDetail() {
    var d = document.getElementById('lit-detail');
    if (!d) return;
    if (Z.sel < 0) {
      d.className = 'r-detail';
      d.innerHTML = '悬停读取事件读数；点击柱状或圆点锁定该次漏失事件；点击下表行同样联动。共 5 次事件，漏速 5–50 m³/h，阈值裕度仅 Δ = 9.70 − 9.43 = <b>0.27 ppg</b>。';
      return;
    }
    var e = EV[Z.sel];
    d.className = 'r-detail active';
    d.innerHTML = '<b>事件 #' + (Z.sel + 1) + ' · ' + e.z.toFixed(1) + ' mbsf</b>：漏失速率 <b>' + e.txt + ' m³/h</b>；' + e.desc +
      '。当量密度触及漏失阈值 <b>≈9.70 ppg</b>（随钻泥浆 9.43 ppg，环空摩阻增量 ≈0.27 ppg）。' +
      (e.rate >= 30 ? '漏速 ≥30 m³/h，属严重漏失，需立即降排量/降密度并考虑堵漏材料。' : '漏速较低，属渗漏，可通过降排量与随钻堵漏控制。');
  }

  function select(i, pan) {
    Z.sel = i;
    if (pan && i >= 0) {
      var e = EV[i];
      if (e.z < Z.z0 || e.z > Z.z1) {
        var span = Z.z1 - Z.z0;
        setView(e.z - span / 2, e.z + span / 2);
      }
    }
    drawAll(); renderDetail();
    var rows = document.querySelectorAll('#lit-body tr');
    rows.forEach(function (r, k) { r.classList.toggle('sel', k === Z.sel); });
  }

  function bindChart(svgId, tipId, boxId) {
    var svg = document.getElementById(svgId);
    var tip = document.getElementById(tipId);
    var box = document.getElementById(boxId);
    if (!svg || !tip || !box) return;
    var W = svgId === 'lit-chartA' ? 900 : 900;
    function vxz(evt) {
      var r = svg.getBoundingClientRect();
      return { vx: (evt.clientX - r.left) * (W / r.width), z: 0, rect: r };
    }
    function zAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      var plotW = W - PL - PR;
      return Z.z0 + clamp((vx - PL) / plotW, 0, 1) * (Z.z1 - Z.z0);
    }
    function nearest(z) {
      var best = -1, bd = 1e9;
      EV.forEach(function (e, i) {
        var d = Math.abs(e.z - z);
        if (d < bd) { bd = d; best = i; }
      });
      return { i: best, d: bd };
    }
    function showTip(html, evt) {
      var r = box.getBoundingClientRect();
      tip.innerHTML = html;
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - r.left + 12, 4, r.width - 170) + 'px';
      tip.style.top = clamp(evt.clientY - r.top - 8, 4, r.height - 70) + 'px';
    }
    function hideTip() { tip.style.display = 'none'; }
    var drag = null, moved = 0;
    svg.addEventListener('wheel', function (evt) {
      evt.preventDefault();
      var z = zAt(evt);
      var f = evt.deltaY > 0 ? 1.25 : 0.8;
      var a = z - (z - Z.z0) * f, b = z + (Z.z1 - z) * f;
      setView(a, b);
    }, { passive: false });
    svg.addEventListener('mousedown', function (evt) {
      drag = { x: evt.clientX, a: Z.z0, b: Z.z1 }; moved = 0;
      evt.preventDefault();
    });
    window.addEventListener('mousemove', function (evt) {
      if (drag) {
        var r = svg.getBoundingClientRect();
        var dx = (evt.clientX - drag.x) * (W / r.width);
        moved = Math.max(moved, Math.abs(dx));
        if (moved > 3) {
          var plotW = W - PL - PR;
          var dz = dx / plotW * (drag.b - drag.a);
          setView(drag.a - dz, drag.b - dz);
        }
        return;
      }
      // 悬停读数
      var z = zAt(evt);
      var n = nearest(z);
      var tol = (Z.z1 - Z.z0) / 40 + 1;
      if (n.i >= 0 && n.d <= tol) {
        var e = EV[n.i];
        showTip('<b>#' + (n.i + 1) + ' · ' + e.z.toFixed(1) + ' mbsf</b><br>漏速 ' + e.txt + ' m³/h<br><span style="color:#8a9298">点击锁定</span>', evt);
      } else hideTip();
    });
    svg.addEventListener('mouseleave', hideTip);
    window.addEventListener('mouseup', function () { drag = null; });
    svg.addEventListener('dblclick', function () { setView(ZMIN, ZMAX); });
    svg.addEventListener('click', function (evt) {
      if (moved > 3) return;
      var z = zAt(evt);
      var n = nearest(z);
      var tol = (Z.z1 - Z.z0) / 40 + 1;
      select(n.i >= 0 && n.d <= tol ? n.i : -1, false);
    });
  }

  function bindTable() {
    var body = document.getElementById('lit-body');
    if (!body) return;
    EV.forEach(function (e, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td class="num">' + e.z.toFixed(1) + '</td><td class="num">' + e.txt + '</td><td>' + e.desc + '</td>';
      tr.addEventListener('click', function () { select(i, true); });
      body.appendChild(tr);
    });
  }

  function bindZoomBtns() {
    var zi = document.getElementById('z-in'), zo = document.getElementById('z-out'), zr = document.getElementById('z-reset');
    if (zi) zi.addEventListener('click', function () {
      var c = (Z.z0 + Z.z1) / 2, s = (Z.z1 - Z.z0) * 0.7;
      setView(c - s / 2, c + s / 2);
    });
    if (zo) zo.addEventListener('click', function () {
      var c = (Z.z0 + Z.z1) / 2, s = (Z.z1 - Z.z0) * 1.4;
      setView(c - s / 2, c + s / 2);
    });
    if (zr) zr.addEventListener('click', function () { setView(ZMIN, ZMAX); });
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.tab');
    var panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
      });
    });
  }

  bindTabs();
  bindChart('lit-chartA', 'lit-tipA', 'lit-boxA');
  bindChart('lit-chartB', 'lit-tipB', 'lit-boxB');
  bindTable();
  bindZoomBtns();
  drawAll();
  renderDetail();
})();
