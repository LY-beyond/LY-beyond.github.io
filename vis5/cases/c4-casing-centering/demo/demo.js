/* ======= 套管居中度优化 · 可交互示范 ======= */
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
  const G = 9.81;
  const RHO_STEEL = 7.85;    // 钢密度 g/cm³
  const WELL_LEN = 3000;     // 模拟井深 m
  const N = 120;             // 沿深采样点数

  // ---------- 状态 ----------
  let S = {
    dh: 311,       // 井径 mm
    dc: 244,       // 套管外径 mm
    theta: 60,     // 井斜角 °
    dog: 3.0,      // 狗腿度 °/30m
    nc: 12,        // 扶正器数量
    fr: 2500,      // 扶正器恢复力 N
    mu: 0.30,      // 摩阻系数
    w: 80,         // 套管线重 kg/m
    rhom: 1.40,    // 钻井液密度 g/cm³
    t: 11          // 套管壁厚 mm
  };

  // ===== 邻接环节参数联动（固井工作流共享，key=cementing-shared）=====
  const SHARED_KEY = 'cementing-shared';
  const KEY_MAP = {
    holeDiameter: 'dh',    // 井径 mm
    casingOD: 'dc',        // 套管外径 mm
    inclination: 'theta',  // 井斜 °
    density: 'rhom'        // 钻井液密度 g/cm³
  };
  const MY_KEYS = Object.keys(KEY_MAP);
  function loadShared(){ try{ var s=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}'); var n=0; MY_KEYS.forEach(function(k){ if(k in s && typeof s[k]==='number'){ S[KEY_MAP[k]]=s[k]; n++; } }); return n; }catch(e){ return 0; } }
  function saveShared(){ var cur={}; try{ cur=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}'); }catch(e){} MY_KEYS.forEach(function(k){ if(typeof S[KEY_MAP[k]]==='number') cur[k]=S[KEY_MAP[k]]; }); localStorage.setItem(SHARED_KEY,JSON.stringify(cur)); }

  function $(id) { return document.getElementById(id); }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const deg2rad = d => d * Math.PI / 180;

  // ---------- 物理计算 ----------
  function compute(state) {
    const s = state || S;
    const emax = Math.max(0.1, (s.dh - s.dc) / 2);        // 最大偏心 mm
    const thetaR = deg2rad(s.theta);

    // 裸管偏心
    let e0 = emax * (0.3 + 0.7 * (1 - 1 / (1 + s.theta / 30))) * (1 + s.dog / 5);
    e0 = clamp(e0, 0, emax);
    const srBare = 1 - e0 / emax;

    // 浮重 N/m
    const wSub = s.w * (1 - s.rhom / RHO_STEEL) * G;

    // 跨距
    const span = s.nc > 0 ? WELL_LEN / (s.nc + 1) : WELL_LEN;

    // 单跨法向力 Fn = 线重*(1-液密/钢密)*sinθ*L + 狗腿弯力
    const fnGrav = wSub * Math.sin(thetaR) * span;
    const fnDog = wSub * span * (s.dog / 8);
    const fn = fnGrav + fnDog;

    // 扶正器处居中度
    const srC = clamp(1 - s.fr / (s.fr + fn), 0, 1);
    const eC = emax * (1 - srC);

    // 沿深居中度曲线
    const srArr = new Float64Array(N);
    const srBareArr = new Float64Array(N);
    const zArr = new Float64Array(N);
    let srMin = 1, worstZ = 0, worstE = 0;

    for (let i = 0; i < N; i++) {
      const z = (i / (N - 1)) * WELL_LEN;
      zArr[i] = z;
      srBareArr[i] = srBare;

      if (s.nc === 0) {
        srArr[i] = srBare;
      } else {
        // 到最近扶正器的距离
        let dMin = span;
        for (let j = 1; j <= s.nc; j++) {
          const zj = WELL_LEN * j / (s.nc + 1);
          dMin = Math.min(dMin, Math.abs(z - zj));
        }
        const u = clamp(dMin / (span / 2), 0, 1); // 0 扶正器处, 1 跨中
        const e = eC + (e0 - eC) * (1 - Math.cos(Math.PI * u)) / 2;
        srArr[i] = clamp(1 - e / emax, 0, 1);
        if (srArr[i] < srMin) { srMin = srArr[i]; worstZ = z; worstE = e; }
      }
    }
    if (s.nc === 0) { srMin = srBare; worstZ = WELL_LEN / 2; worstE = e0; }

    // 扶正器位置
    const cenPos = [];
    for (let j = 1; j <= s.nc; j++) cenPos.push(WELL_LEN * j / (s.nc + 1));

    // 下入阻力
    const fDrag = s.mu * wSub * WELL_LEN * (Math.sin(thetaR) + s.dog / 8); // N

    // 大钩载荷（浮重）
    const hook = wSub * WELL_LEN; // N

    // 下入性判定
    const canRun = s.mu * Math.sin(thetaR) <= Math.cos(thetaR);

    return {
      emax, e0, srBare, wSub, span, fn, srC, eC,
      srArr, srBareArr, zArr, srMin, worstZ, worstE,
      cenPos, fDrag, hook, canRun
    };
  }

  // ---------- 面板1a：井筒剖面 ----------
  function drawProfile(r) {
    const svg = $('panel-profile');
    const W = 300, H = 340, padL = 70, padR = 30, padT = 20, padB = 30;
    const pw = W - padL - padR, ph = H - padT - padB;
    const wellPx = 70; // 井眼宽度 px
    const cx = padL + pw / 2;
    const y2px = z => padT + (z / WELL_LEN) * ph;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 井眼
    s += `<rect x="${cx - wellPx / 2}" y="${padT}" width="${wellPx}" height="${ph}" fill="#f5f2ea" stroke="#c9c2b0" stroke-width="1.5" rx="4"/>`;

    // 套管（偏心，沿井斜方向偏移）
    const offset = 12; // 示意偏心 px
    s += `<rect x="${cx - wellPx / 2 + 6 + offset}" y="${padT + 4}" width="${wellPx - 12}" height="${ph - 8}" fill="none" stroke="#4d565b" stroke-width="2.5" rx="3"/>`;

    // 扶正器
    r.cenPos.forEach(z => {
      const y = y2px(z);
      s += `<rect x="${cx - wellPx / 2 + 2}" y="${y - 4}" width="${wellPx - 4}" height="8" rx="2" fill="#c9a15a" opacity="0.85"/>`;
      s += `<line x1="${cx - wellPx / 2 - 6}" y1="${y}" x2="${cx + wellPx / 2 + 6}" y2="${y}" stroke="#c9a15a" stroke-width="1" stroke-dasharray="2 2"/>`;
    });

    // 最差点标记
    const wy = y2px(r.worstZ);
    s += `<circle cx="${cx + offset + 4}" cy="${wy}" r="5" fill="#b05a51" stroke="#fff" stroke-width="1.5"/>`;
    s += `<text x="${cx + wellPx / 2 + 8}" y="${wy + 3}" font-size="10" fill="#b05a51" font-weight="600">最差点 ${r.worstZ.toFixed(0)}m</text>`;

    // 深度刻度
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const y = padT + f * ph;
      s += `<text x="${padL - 8}" y="${y + 3}" font-size="10" fill="#9ba3a9" text-anchor="end" font-family="monospace">${(f * WELL_LEN).toFixed(0)}m</text>`;
    });

    s += `<text x="${cx}" y="${H - 8}" font-size="11" fill="#79828a" text-anchor="middle">井筒剖面（扶正器 ${S.nc} 个）</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板1b：最差点截面 ----------
  function drawCross(r) {
    const svg = $('panel-cross');
    const W = 300, H = 300;
    const cx = W / 2, cy = H / 2;
    const R = 100; // 井眼半径 px
    const scale = R / (S.dh / 2); // mm→px
    const rCasing = (S.dc / 2) * scale; // 套管半径 px
    const e = clamp(r.worstE * scale, 0, R - rCasing - 1); // 偏心 px

    // 重力方向（沿井斜向下）
    const ang = deg2rad(S.theta);
    const dx = Math.sin(ang), dy = Math.cos(ang);

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 井眼
    s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#f5f2ea" stroke="#c9c2b0" stroke-width="1.5"/>`;

    // 水泥环（偏心后的环形区域）：画井眼再挖套管
    s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#e7f3ea" opacity="0.6"/>`;

    // 套管
    const casCx = cx + e * dx;
    const casCy = cy + e * dy;
    s += `<circle cx="${casCx}" cy="${casCy}" r="${rCasing}" fill="#4d565b" stroke="#242b2e" stroke-width="1.5"/>`;
    // 套管内孔
    const innerR = Math.max(2, rCasing - S.t * scale);
    s += `<circle cx="${casCx}" cy="${casCy}" r="${innerR}" fill="#242b2e"/>`;

    // 偏心线
    if (e > 1) {
      s += `<line x1="${cx}" y1="${cy}" x2="${casCx}" y2="${casCy}" stroke="#b05a51" stroke-width="1.5" stroke-dasharray="3 2"/>`;
      s += `<text x="${(cx + casCx) / 2 + 6}" y="${(cy + casCy) / 2 - 6}" font-size="10" fill="#b05a51" font-family="monospace">e=${r.worstE.toFixed(1)}mm</text>`;
    }

    // 中心标记
    s += `<circle cx="${cx}" cy="${cy}" r="2" fill="#9ba3a9"/>`;

    s += `<text x="${cx}" y="20" font-size="11" fill="#4d565b" text-anchor="middle" font-weight="600">最差点截面</text>`;
    s += `<text x="${cx}" y="${H - 10}" font-size="10" fill="#9ba3a9" text-anchor="middle" font-family="monospace">SR=${(r.srMin * 100).toFixed(1)}%  D=${S.dh} d=${S.dc}</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板2：居中度沿深度曲线 ----------
  function drawSr(r) {
    const svg = $('panel-sr');
    const W = 430, H = 220, padL = 40, padR = 14, padT = 14, padB = 34;
    const pw = W - padL - padR, ph = H - padT - padB;

    const x2px = z => padL + (z / WELL_LEN) * pw;
    const y2px = sr => padT + (1 - sr) * ph;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 网格
    for (let i = 0; i <= 5; i++) {
      const x = padL + i / 5 * pw;
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ph}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${x}" y="${H - padB + 12}" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${(i / 5 * WELL_LEN).toFixed(0)}</text>`;
    }
    [0, 0.25, 0.5, 0.67, 0.8, 1].forEach(v => {
      const y = y2px(v);
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${(v * 100).toFixed(0)}</text>`;
    });

    // 67% 阈值
    const y67 = y2px(0.67);
    s += `<line x1="${padL}" y1="${y67}" x2="${W - padR}" y2="${y67}" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>`;
    s += `<text x="${W - padR - 2}" y="${y67 - 3}" font-size="8.5" fill="#c9a15a" font-weight="600" text-anchor="end">67%</text>`;

    // 80% 阈值
    const y80 = y2px(0.80);
    s += `<line x1="${padL}" y1="${y80}" x2="${W - padR}" y2="${y80}" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="5 3"/>`;
    s += `<text x="${W - padR - 2}" y="${y80 - 3}" font-size="8.5" fill="#b05a51" font-weight="600" text-anchor="end">80%</text>`;

    // 裸管线
    let path = '';
    for (let i = 0; i < N; i++) {
      const x = x2px(r.zArr[i]);
      const y = y2px(r.srBareArr[i]);
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#9ba3a9" stroke-width="1.5" stroke-dasharray="4 3"/>`;

    // 加扶正器线
    path = '';
    for (let i = 0; i < N; i++) {
      const x = x2px(r.zArr[i]);
      const y = y2px(r.srArr[i]);
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#2f7d6b" stroke-width="2.2" stroke-linejoin="round"/>`;

    // 扶正器位置
    r.cenPos.forEach(z => {
      const x = x2px(z);
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ph}" stroke="#c9a15a" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>`;
    });

    // 最差点
    const wx = x2px(r.worstZ), wy = y2px(r.srMin);
    s += `<circle cx="${wx}" cy="${wy}" r="4" fill="#b05a51" stroke="#fff" stroke-width="1.5"/>`;

    // 图例
    s += `<rect x="${padL}" y="${H - 17}" width="9" height="2" fill="#2f7d6b"/>`;
    s += `<text x="${padL + 12}" y="${H - 13}" font-size="8.5" fill="#5d666d">加扶正器</text>`;
    s += `<rect x="${padL + 66}" y="${H - 17}" width="9" height="2" fill="#9ba3a9" stroke-dasharray="2 2"/>`;
    s += `<text x="${padL + 78}" y="${H - 13}" font-size="8.5" fill="#5d666d">裸管</text>`;
    s += `<rect x="${padL + 116}" y="${H - 17}" width="9" height="2" fill="#c9a15a"/>`;
    s += `<text x="${padL + 128}" y="${H - 13}" font-size="8.5" fill="#5d666d">67% 阈值</text>`;

    s += `<text x="${(padL + W - padR) / 2}" y="${H - 3}" font-size="9" fill="#79828a" text-anchor="middle">井深 (m)</text>`;
    s += `<text x="10" y="${(padT + padT + ph) / 2}" font-size="9" fill="#79828a" text-anchor="middle" transform="rotate(-90 10 ${(padT + padT + ph) / 2})">居中度 SR (%)</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板3：下入阻力 vs 井斜角 ----------
  function drawDrag(r) {
    const svg = $('panel-drag');
    const W = 430, H = 220, padL = 40, padR = 14, padT = 14, padB = 32;
    const pw = W - padL - padR, ph = H - padT - padB;

    // 扫井斜 0..90
    const M = 40;
    const curve = [];
    let maxDrag = 0;
    for (let i = 0; i <= M; i++) {
      const th = i / M * 90;
      const tr = deg2rad(th);
      const fd = S.mu * r.wSub * WELL_LEN * (Math.sin(tr) + S.dog / 8);
      curve.push({ th, fd });
      if (fd > maxDrag) maxDrag = fd;
    }
    const yMax = maxDrag * 1.15;

    const x2px = th => padL + (th / 90) * pw;
    const y2px = fd => padT + (1 - fd / yMax) * ph;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    for (let i = 0; i <= 5; i++) {
      const x = padL + i / 5 * pw;
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ph}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${x}" y="${H - padB + 12}" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${(i * 18)}</text>`;
    }
    for (let i = 0; i <= 4; i++) {
      const y = padT + i / 4 * ph;
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#efece1" stroke-width="1"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${((yMax - i / 4 * yMax) / 1000).toFixed(0)}</text>`;
    }

    let path = '';
    curve.forEach((p, i) => {
      const x = x2px(p.th), y = y2px(p.fd);
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    s += `<path d="${path}" fill="none" stroke="#41699b" stroke-width="2.2" stroke-linejoin="round"/>`;

    // 当前井斜
    const cx = x2px(S.theta), cy = y2px(r.fDrag);
    s += `<line x1="${cx}" y1="${padT}" x2="${cx}" y2="${padT + ph}" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="#b05a51" stroke="#fff" stroke-width="1.5"/>`;
    s += `<text x="${cx + 6}" y="${cy - 6}" font-size="8.5" fill="#b05a51" font-family="monospace" font-weight="600">${(r.fDrag / 1000).toFixed(1)} kN</text>`;

    s += `<text x="${(padL + W - padR) / 2}" y="${H - 3}" font-size="9" fill="#79828a" text-anchor="middle">井斜角 θ (°)</text>`;
    s += `<text x="10" y="${(padT + padT + ph) / 2}" font-size="9" fill="#79828a" text-anchor="middle" transform="rotate(-90 10 ${(padT + padT + ph) / 2})">下入阻力 (kN)</text>`;

    svg.innerHTML = s;
  }

  // ---------- 面板4：居中度热力图 (Canvas) ----------
  function drawHeat() {
    const canvas = $('panel-heat');
    const W = 430, H = 220;
    const ctx = setupCanvas(canvas, W, H);
    const padL = 36, padR = 12, padT = 12, padB = 26;
    const pw = W - padL - padR, ph = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    const cols = 36, rows = 26;
    const cellW = pw / cols, cellH = ph / rows;

    // 颜色映射: 红(#b05a51) -> 橙(#c9a15a) -> 绿(#2f7d6b)
    function colorFor(sr) {
      let r, g, b;
      if (sr < 0.67) {
        const t = sr / 0.67;
        r = Math.round(176 + (201 - 176) * t);
        g = Math.round(90 + (161 - 90) * t);
        b = Math.round(81 + (90 - 81) * t);
      } else {
        const t = (sr - 0.67) / 0.33;
        r = Math.round(201 + (47 - 201) * t);
        g = Math.round(161 + (125 - 161) * t);
        b = Math.round(90 + (107 - 90) * t);
      }
      return `rgb(${r},${g},${b})`;
    }

    const thetaR = deg2rad(S.theta);
    const wSub = S.w * (1 - S.rhom / RHO_STEEL) * G;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const th = (i / (cols - 1)) * 90;
        const nc = Math.round((j / (rows - 1)) * 60);
        const tr = deg2rad(th);
        const emax = Math.max(0.1, (S.dh - S.dc) / 2);
        let e0 = emax * (0.3 + 0.7 * (1 - 1 / (1 + th / 30))) * (1 + S.dog / 5);
        e0 = clamp(e0, 0, emax);
        const srBare = 1 - e0 / emax;
        let srMin;
        if (nc === 0) {
          srMin = srBare;
        } else {
          const span = WELL_LEN / (nc + 1);
          const fn = wSub * span * (Math.sin(tr) + S.dog / 8);
          const srC = clamp(1 - S.fr / (S.fr + fn), 0, 1);
          srMin = Math.min(srBare, srC);
        }
        ctx.fillStyle = colorFor(srMin);
        ctx.fillRect(padL + i * cellW, padT + j * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // 轴刻度
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const x = padL + i / 5 * pw;
      ctx.fillText((i * 18).toFixed(0), x, H - padB + 12);
    }
    ctx.textAlign = 'end';
    for (let j = 0; j <= 5; j++) {
      const y = padT + j / 5 * ph;
      ctx.fillText((60 - j * 12).toFixed(0), padL - 4, y + 3);
    }

    // 轴标签
    ctx.fillStyle = '#79828a';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('井斜角 θ (°)', padL + pw / 2, H - 4);
    ctx.save();
    ctx.translate(12, padT + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('扶正器数量', 0, 0);
    ctx.restore();

    // 当前工况红圈
    const cx = padL + (S.theta / 90) * pw;
    const cy = padT + (S.nc / 60) * ph;
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---------- 扶正器布置表 ----------
  function drawTable(r) {
    const tbody = $('tbl-cen').querySelector('tbody');
    if (S.nc === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9ba3a9;padding:16px;">未布置扶正器（裸管），全井居中度 ${(r.srBare * 100).toFixed(1)}%</td></tr>`;
      return;
    }
    let rows = '';
    r.cenPos.forEach((z, i) => {
      const sr = r.srC * 100;
      const tag = sr >= 80 ? '<span class="tag ok">优良</span>' : sr >= 67 ? '<span class="tag warn">合格</span>' : '<span class="tag bad">不合格</span>';
      rows += `<tr><td>${i + 1}</td><td>${z.toFixed(0)}</td><td>${r.span.toFixed(0)}</td><td>${sr.toFixed(1)}</td><td>${tag}</td></tr>`;
    });
    tbody.innerHTML = rows;
  }

  // ---------- KPI ----------
  function paintKpi(r) {
    const srMinPct = (r.srMin * 100).toFixed(1);
    $('kpi-srmin').textContent = srMinPct;
    const srEl = $('kpi-srmin').parentElement;
    srEl.className = 'kpi' + (r.srMin < 0.67 ? ' bad' : r.srMin < 0.8 ? ' warn' : '');

    $('kpi-nc').textContent = S.nc;
    $('kpi-hook').textContent = (r.hook / 1000).toFixed(1);
    $('kpi-drag').textContent = (r.fDrag / 1000).toFixed(1);
    $('kpi-drag').parentElement.className = 'kpi' + (r.fDrag > r.hook ? ' bad' : '');

    const pass = r.srMin >= 0.67;
    $('kpi-pass').textContent = pass ? '是' : '否';
    $('kpi-pass-sub').textContent = pass ? '满足 API 67%' : '不满足 67%';
    $('kpi-pass').parentElement.className = 'kpi' + (pass ? '' : ' bad');

    $('kpi-run').textContent = r.canRun ? '可下入' : '困难';
    $('kpi-run-sub').textContent = r.canRun ? 'μ·sinθ ≤ cosθ' : 'μ·sinθ ＞ cosθ';
    $('kpi-run').parentElement.className = 'kpi' + (r.canRun ? '' : ' bad');

    const v = $('verdict');
    if (!pass) {
      v.className = 'verdict bad';
      v.textContent = `全井最小居中度 ${srMinPct}% 低于 API 67% 阈值。建议：增加扶正器数量（当前 ${S.nc} 个）或提高恢复力至 ${Math.round(S.fr)} N 以上，或降低狗腿度影响。`;
    } else if (r.srMin < 0.8) {
      v.className = 'verdict warn';
      v.textContent = `最小居中度 ${srMinPct}% 满足 67% 但低于 80%，尾管/关键层需补强。建议再增加 ${Math.max(1, Math.ceil((0.8 - r.srMin) * 30))} 个扶正器。`;
    } else if (!r.canRun) {
      v.className = 'verdict bad';
      v.textContent = `居中度达标，但 μ·sinθ(${S.mu}×${Math.sin(deg2rad(S.theta)).toFixed(2)}=${(S.mu * Math.sin(deg2rad(S.theta))).toFixed(2)}) ＞ cosθ(${Math.cos(deg2rad(S.theta)).toFixed(2)})，套管可能无法靠自重下入，需降低摩阻或增加下压。`;
    } else {
      v.className = 'verdict ok';
      v.textContent = `最小居中度 ${srMinPct}% ≥ 80%，下入阻力 ${(r.fDrag / 1000).toFixed(1)} kN 小于大钩载荷 ${(r.hook / 1000).toFixed(1)} kN，方案可行。`;
    }
  }

  // ---------- 主刷新 ----------
  function paint() {
    const r = compute();
    drawProfile(r);
    drawCross(r);
    drawSr(r);
    drawDrag(r);
    drawHeat();
    drawTable(r);
    paintKpi(r);
    saveShared();
  }

  // ---------- 事件绑定 ----------
  function bind() {
    const syncN = loadShared();
    const noteText = $('sync-note-text');
    if (noteText) noteText.textContent = '邻接参数联动：已同步 ' + syncN + ' 个共享参数（井径/套管外径/井斜/钻井液密度）';
    const btnClear = $('btn-clear-shared');
    if (btnClear) btnClear.addEventListener('click', () => {
      localStorage.removeItem(SHARED_KEY);
      if (noteText) noteText.textContent = '邻接参数联动：已同步 0 个共享参数（井径/套管外径/井斜/钻井液密度）';
    });
    const fields = [
      { id: 's-dh', key: 'dh', out: 'o-dh', fmt: v => v.toFixed(0) },
      { id: 's-dc', key: 'dc', out: 'o-dc', fmt: v => v.toFixed(0) },
      { id: 's-theta', key: 'theta', out: 'o-theta', fmt: v => v.toFixed(0) },
      { id: 's-dog', key: 'dog', out: 'o-dog', fmt: v => v.toFixed(1) },
      { id: 's-nc', key: 'nc', out: 'o-nc', fmt: v => v.toFixed(0) },
      { id: 's-fr', key: 'fr', out: 'o-fr', fmt: v => v.toFixed(0) },
      { id: 's-mu', key: 'mu', out: 'o-mu', fmt: v => v.toFixed(2) },
      { id: 's-w', key: 'w', out: 'o-w', fmt: v => v.toFixed(0) },
      { id: 's-rhom', key: 'rhom', out: 'o-rhom', fmt: v => v.toFixed(2) },
      { id: 's-t', key: 't', out: 'o-t', fmt: v => v.toFixed(1) }
    ];
    fields.forEach(f => {
      const el = $(f.id);
      const out = $(f.out);
      el.value = S[f.key];
      out.textContent = f.fmt(S[f.key]);
      el.addEventListener('input', () => {
        S[f.key] = parseFloat(el.value);
        out.textContent = f.fmt(S[f.key]);
        paint();
      });
    });
  }

  // ---------- 方案对比：帕累托前沿 ----------
  let paretoCands = [];
  let paretoFrontOnly = false;

  function genPareto() {
    paretoCands = [];
    for (let i = 0; i < 30; i++) {
      // 随机采样：扶正器数量 0-60、恢复力 500-5000 N、井斜 0-90°
      const c = {
        nc: Math.round(Math.random() * 60),
        fr: 500 + Math.random() * 4500,
        theta: Math.random() * 90,
        dh: S.dh, dc: S.dc, dog: S.dog, mu: S.mu, w: S.w, rhom: S.rhom, t: S.t
      };
      const r = compute(c);
      c.srMin = r.srMin;          // 最小居中度 0-1
      c.fDrag = r.fDrag / 1000;   // 下入阻力 kN
      paretoCands.push(c);
    }
    // 帕累托前沿：不存在另一点居中度更大且阻力更小
    paretoCands.forEach(c => {
      c.front = !paretoCands.some(o => o.srMin > c.srMin + 1e-9 && o.fDrag < c.fDrag - 1e-9);
    });
    drawPareto();
  }

  function drawPareto() {
    const svg = $('pareto');
    if (!svg) return;
    const W = 430, H = 250, padL = 40, padR = 16, padT = 14, padB = 38;
    const pw = W - padL - padR, ph = H - padT - padB;
    const yMax = Math.max(1, ...paretoCands.map(c => c.fDrag)) * 1.1;
    const x2px = sr => padL + sr * pw;
    const y2px = fd => padT + (1 - fd / yMax) * ph;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9"/>`;

    // 网格与刻度
    for (let i = 0; i <= 4; i++) {
      const y = padT + i / 4 * ph;
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#efece1"/>`;
      s += `<text x="${padL - 5}" y="${y + 3}" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">${((yMax - i / 4 * yMax)).toFixed(0)}</text>`;
    }
    for (let i = 0; i <= 5; i++) {
      const x = padL + i / 5 * pw;
      s += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ph}" stroke="#efece1"/>`;
      s += `<text x="${x}" y="${padT + ph + 12}" font-size="8.5" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${(i / 5 * 100).toFixed(0)}</text>`;
    }

    // 67% 阈值线
    const x67 = x2px(0.67);
    s += `<line x1="${x67}" y1="${padT}" x2="${x67}" y2="${padT + ph}" stroke="#c9a15a" stroke-width="1.2" stroke-dasharray="5 3"/>`;
    s += `<text x="${x67}" y="${padT + ph + 26}" font-size="8.5" fill="#c9a15a" text-anchor="middle" font-weight="600">67% 阈值</text>`;

    // 散点：大小=扶正器数量；颜色=是否满足67%
    paretoCands.forEach((c, i) => {
      if (paretoFrontOnly && !c.front) return;
      const cx = x2px(c.srMin), cy = y2px(c.fDrag);
      const r = 3 + c.nc / 60 * 8;
      const col = c.srMin >= 0.67 ? '#3f8560' : '#b05a51';
      const stroke = c.front ? '#235f51' : col;
      const sw = c.front ? 2 : 1;
      s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${col}" fill-opacity="0.6" stroke="${stroke}" stroke-width="${sw}" data-i="${i}" style="cursor:pointer"><title>居中度 ${(c.srMin * 100).toFixed(1)}% · 阻力 ${c.fDrag.toFixed(1)} kN · 扶正器 ${c.nc} 个 · 恢复力 ${c.fr.toFixed(0)} N · 井斜 ${c.theta.toFixed(0)}°${c.front ? ' · 前沿' : ''}</title></circle>`;
    });

    // 轴标签
    s += `<text x="${(padL + W - padR) / 2}" y="${H - 4}" font-size="9" fill="#79828a" text-anchor="middle">最小居中度 SR (%)</text>`;
    s += `<text x="10" y="${(padT + padT + ph) / 2}" font-size="9" fill="#79828a" text-anchor="middle" transform="rotate(-90 10 ${(padT + padT + ph) / 2})">下入阻力 (kN)</text>`;

    svg.innerHTML = s;

    // 点击散点写入参数并重渲染
    svg.onclick = function (e) {
      const t = e.target.closest('circle[data-i]');
      if (!t) return;
      const i = parseInt(t.getAttribute('data-i'), 10);
      const c = paretoCands[i];
      S.nc = c.nc; S.fr = c.fr; S.theta = c.theta;
      $('s-nc').value = S.nc; $('o-nc').textContent = S.nc.toFixed(0);
      $('s-fr').value = S.fr; $('o-fr').textContent = S.fr.toFixed(0);
      $('s-theta').value = S.theta; $('o-theta').textContent = S.theta.toFixed(0);
      paint();
    };
  }

  function bindPareto() {
    const btnGen = $('btn-pareto-gen');
    const btnFront = $('btn-pareto-front');
    const btnReset = $('btn-pareto-reset');
    if (btnGen) btnGen.addEventListener('click', genPareto);
    if (btnFront) btnFront.addEventListener('click', () => {
      paretoFrontOnly = !paretoFrontOnly;
      btnFront.textContent = paretoFrontOnly ? '显示全部' : '仅显示前沿';
      drawPareto();
    });
    if (btnReset) btnReset.addEventListener('click', () => {
      S.nc = 12; S.fr = 2500; S.theta = 60;
      $('s-nc').value = S.nc; $('o-nc').textContent = S.nc.toFixed(0);
      $('s-fr').value = S.fr; $('o-fr').textContent = S.fr.toFixed(0);
      $('s-theta').value = S.theta; $('o-theta').textContent = S.theta.toFixed(0);
      paint();
    });
  }

  bind();
  bindPareto();
  genPareto();
  paint();

  // 尺寸变化时重建 canvas backing store，保持清晰
  let rsTimer = null;
  window.addEventListener('resize', () => {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(() => drawHeat(), 120);
  });
})();

/* ======= 文献数据页：居中度与顶替效率（真实/文献数据） ======= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // 元坝 11 井 FLUENT 数值模拟（《石油钻探技术》2010, 38(4), DOI 10.3969/j.issn.1001-0890.2010.04.011）
  var YB = [
    { sr: 80, q: 0.8, eff: 91.30 }, { sr: 60, q: 0.8, eff: 85.04 }, { sr: 40, q: 0.8, eff: 83.57 },
    { sr: 80, q: 1.4, eff: 92.75 }, { sr: 60, q: 1.4, eff: 86.26 }, { sr: 40, q: 1.4, eff: 84.88 }
  ];
  // PVI CentraDesign 2015（无扶正器，居中度随井斜衰减，文献数字化）
  var PVI = [ { ang: 0, sr: 100 }, { ang: 30, sr: 70 }, { ang: 90, sr: 20 } ];
  // Adesanya 2018 扶正器间距设计计算（仅入表）
  var ADE = [
    { src: 'Adesanya 2018', cond: '扶正器间距 40 ft (≈12.2 m)', sr: 52, res: '52%（低于 67%，不合格）' },
    { src: 'Adesanya 2018', cond: '扶正器间距 20 ft (≈6.1 m)', sr: 70, res: '70%（满足 67%）' },
    { src: 'Adesanya 2018', cond: '冲蚀扩径井段', sr: 30, res: '30%（严重偏心，易窜槽）' }
  ];
  var X0 = 30, X1 = 90, MINSPAN = 10;
  var Z = { x0: X0, x1: X1, sel: -1 };   // sel 为 YB 索引
  var selB = -1, selT = -1;              // chartB / 表格行（Adesanya）
  var PL = 52, PR = 16;

  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(x, y, s, attrs, parent) { var t = el('text', attrs || {}, parent); t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s; return t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function xOf(sr, plotW) { return PL + (sr - Z.x0) / (Z.x1 - Z.x0) * plotW; }

  function drawA() {
    var svg = document.getElementById('lit-chartA'); if (!svg) return;
    var W = 900, H = 300, PT = 24, PB = 38, plotW = W - PL - PR, plotH = H - PT - PB;
    var E0 = 80, E1 = 96;
    function yOf(e) { return PT + (E1 - e) / (E1 - E0) * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var e = E0; e <= E1; e += 2) {
      var y = yOf(e);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: e % 4 ? '#f1ebdd' : '#eae2d0', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, e + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    var span = Z.x1 - Z.x0, step = span <= 20 ? 5 : span <= 40 ? 10 : 20;
    for (var s = Math.ceil(Z.x0 / step) * step; s <= Z.x1; s += step) {
      var x = xOf(s, plotW);
      el('line', { x1: x, y1: PT, x2: x, y2: PT + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, PT + plotH + 14, s + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 4, '居中度 (%)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(12, PT + plotH / 2, '顶替效率 (%)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (PT + plotH / 2) + ')' }, svg);
    // API 67% 居中度参考竖线
    if (Z.x0 <= 67 && 67 <= Z.x1) {
      var xa = xOf(67, plotW);
      el('line', { x1: xa, y1: PT, x2: xa, y2: PT + plotH, stroke: '#c9a15a', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }, svg);
      txt(xa + 4, PT + 12, 'API RP 10D-2 ≥67%', { 'font-size': 9, fill: '#9a7a1c' }, svg);
    }
    // 两条排量系列
    [{ q: 0.8, c: '#2f7d6b', lb: '0.8 m³/min' }, { q: 1.4, c: '#b05a51', lb: '1.4 m³/min' }].forEach(function (se) {
      var pts = YB.map(function (p, i) { return { p: p, i: i }; }).filter(function (o) { return o.p.q === se.q && o.p.sr >= Z.x0 && o.p.sr <= Z.x1; });
      pts.sort(function (a, b) { return a.p.sr - b.p.sr; });
      var d = pts.map(function (o, k) { return (k ? 'L' : 'M') + xOf(o.p.sr, plotW) + ' ' + yOf(o.p.eff); }).join(' ');
      if (pts.length > 1) el('path', { d: d, fill: 'none', stroke: se.c, 'stroke-width': 1.8, opacity: 0.55 }, svg);
      pts.forEach(function (o) {
        var sel = Z.sel === o.i;
        el('circle', { cx: xOf(o.p.sr, plotW), cy: yOf(o.p.eff), r: sel ? 8 : 5.5, fill: se.c, opacity: sel ? 1 : 0.8, stroke: sel ? '#242b2e' : '#fdfcf8', 'stroke-width': sel ? 2 : 1.2 }, svg);
        txt(xOf(o.p.sr, plotW), yOf(o.p.eff) - 9, o.p.eff.toFixed(2), { 'font-size': 9, fill: se.c, 'text-anchor': 'middle', 'font-weight': sel ? 700 : 400 }, svg);
      });
      // 图例
      var lx = W - PR - 150, ly = se.q === 0.8 ? PT + 8 : PT + 22;
      el('line', { x1: lx, y1: ly - 3, x2: lx + 16, y2: ly - 3, stroke: se.c, 'stroke-width': 2 }, svg);
      txt(lx + 20, ly, '排量 ' + se.lb, { 'font-size': 9, fill: se.c }, svg);
    });
    txt(PL + 4, PT + 12, '视窗 ' + Z.x0.toFixed(0) + '–' + Z.x1.toFixed(0) + ' %', { 'font-size': 9, fill: '#8a9298' }, svg);
  }

  function drawB() {
    var svg = document.getElementById('lit-chartB'); if (!svg) return;
    var W = 900, H = 240, PT = 22, PB = 34, plotW = W - PL - PR, plotH = H - PT - PB;
    function xA(a) { return PL + a / 90 * plotW; }
    function yS(s) { return PT + (110 - s) / 110 * plotH; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fdfcf8', rx: 6 }, svg);
    for (var s = 0; s <= 110; s += 20) {
      var y = yS(s);
      el('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(PL - 6, y + 3, s + '', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'end' }, svg);
    }
    for (var a = 0; a <= 90; a += 15) {
      var x = xA(a);
      el('line', { x1: x, y1: PT, x2: x, y2: PT + plotH, stroke: '#f1ebdd', 'stroke-width': 1 }, svg);
      txt(x, PT + plotH + 14, a + '°', { 'font-size': 9, fill: '#8a9298', 'text-anchor': 'middle' }, svg);
    }
    txt(W / 2, H - 4, '井斜角 (°)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle' }, svg);
    txt(12, PT + plotH / 2, '居中度 (%)', { 'font-size': 9.5, fill: '#79828a', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (PT + plotH / 2) + ')' }, svg);
    // API 阈值
    var y67 = yS(67), y80 = yS(80);
    el('line', { x1: PL, y1: y67, x2: W - PR, y2: y67, stroke: '#c9a15a', 'stroke-width': 1.4, 'stroke-dasharray': '6 3' }, svg);
    txt(W - PR - 4, y67 - 5, 'API ≥67%', { 'font-size': 9, fill: '#9a7a1c', 'text-anchor': 'end' }, svg);
    el('line', { x1: PL, y1: y80, x2: W - PR, y2: y80, stroke: '#b05a51', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }, svg);
    txt(W - PR - 4, y80 - 5, '关键段 ≥80%', { 'font-size': 9, fill: '#b05a51', 'text-anchor': 'end' }, svg);
    // 拟合曲线（过三点，二次插值形态：用平滑 path）
    var d = 'M' + xA(0) + ' ' + yS(100) + ' Q ' + xA(22.5) + ' ' + yS(82) + ' ' + xA(30) + ' ' + yS(70) + ' T ' + xA(90) + ' ' + yS(20);
    el('path', { d: d, fill: 'none', stroke: '#3a6ea5', 'stroke-width': 2.2, opacity: 0.7 }, svg);
    PVI.forEach(function (p, i) {
      var sel = selB === i;
      el('circle', { cx: xA(p.ang), cy: yS(p.sr), r: sel ? 8 : 6, fill: '#3a6ea5', opacity: sel ? 1 : 0.85, stroke: sel ? '#242b2e' : '#fdfcf8', 'stroke-width': sel ? 2 : 1.2 }, svg);
      txt(xA(p.ang), yS(p.sr) - 10, p.sr + '%', { 'font-size': 9.5, fill: '#2c567f', 'text-anchor': 'middle', 'font-weight': sel ? 700 : 400 }, svg);
    });
  }

  function drawAll() { drawA(); drawB(); updateLabel(); }
  function updateLabel() { var l = document.getElementById('z-label'); if (l) l.textContent = '视窗 ' + Z.x0.toFixed(0) + '–' + Z.x1.toFixed(0) + ' %'; }

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
      var p = YB[Z.sel];
      d.className = 'r-detail active';
      d.innerHTML = '<b>元坝 11 井 FLUENT 模拟</b>：居中度 <b>' + p.sr + '%</b>、排量 <b>' + p.q + ' m³/min</b> 时顶替效率 <b>' + p.eff.toFixed(2) + '%</b>。' +
        (p.sr < 67 ? '居中度低于 API RP 10D-2 的 67% 下限，顶替效率明显受损。' : '满足 API RP 10D-2 的 67% 居中度要求。') +
        ' 对比可见：居中度 80%→40%，顶替效率下降 7–8 个百分点；提高排量可部分补偿低居中度损失。';
    } else if (selB >= 0) {
      var q = PVI[selB];
      d.className = 'r-detail active';
      d.innerHTML = '<b>PVI CentraDesign 2015</b>：井斜 <b>' + q.ang + '°</b> 时无扶正器居中度约 <b>' + q.sr + '%</b>。' +
        (q.sr < 67 ? '低于 67% 阈值——必须加装扶正器，否则窄边泥浆无法替净，形成窜槽通道。' : '高于 67% 阈值，直井段居中度天然较好。');
    } else if (selT >= 0) {
      var a = ADE[selT];
      d.className = 'r-detail active';
      d.innerHTML = '<b>' + a.src + '</b>：' + a.cond + '，居中度 <b>' + a.sr + '%</b> → ' + a.res + '。扶正器间距减半可把居中度从 52% 提到 70%；冲蚀扩径段是最薄弱环节。';
    } else {
      d.className = 'r-detail';
      d.innerHTML = '悬停读取数据点；点击散点锁定该条文献数据；点击下表行同样联动。要点：<b>居中度每降 10%，顶替效率约降 2–4 个百分点</b>；水平井无扶正器时居中度仅约 20%。';
    }
  }

  function syncTable() {
    var rows = document.querySelectorAll('#lit-body tr');
    rows.forEach(function (r) { r.classList.remove('sel'); });
    if (Z.sel >= 0 && rows[Z.sel]) rows[Z.sel].classList.add('sel');
    else if (selB >= 0 && rows[YB.length + selB]) rows[YB.length + selB].classList.add('sel');
    else if (selT >= 0 && rows[YB.length + PVI.length + selT]) rows[YB.length + PVI.length + selT].classList.add('sel');
  }

  function selectA(i, pan) {
    Z.sel = i; selB = -1; selT = -1;
    if (pan && i >= 0) {
      var p = YB[i];
      if (p.sr < Z.x0 || p.sr > Z.x1) { var s = Z.x1 - Z.x0; setView(p.sr - s / 2, p.sr + s / 2); }
    }
    drawAll(); renderDetail(); syncTable();
  }
  function selectB(i) { selB = i; Z.sel = -1; selT = -1; drawAll(); renderDetail(); syncTable(); }
  function selectT(i) { selT = i; Z.sel = -1; selB = -1; drawAll(); renderDetail(); syncTable(); }

  function bindChartA() {
    var svg = document.getElementById('lit-chartA'), tip = document.getElementById('lit-tipA'), box = document.getElementById('lit-boxA');
    if (!svg || !tip || !box) return;
    var W = 900;
    function srAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      return Z.x0 + clamp((vx - PL) / (W - PL - PR), 0, 1) * (Z.x1 - Z.x0);
    }
    function nearest(sr) {
      var bi = -1, bd = 1e9;
      YB.forEach(function (p, i) { var d = Math.abs(p.sr - sr); if (d < bd) { bd = d; bi = i; } });
      return { i: bi, d: bd };
    }
    var drag = null, moved = 0;
    svg.addEventListener('wheel', function (evt) {
      evt.preventDefault();
      var s = srAt(evt), f = evt.deltaY > 0 ? 1.25 : 0.8;
      setView(s - (s - Z.x0) * f, s + (Z.x1 - s) * f);
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
      var s = srAt(evt), n = nearest(s);
      if (n.i >= 0 && n.d <= 8) {
        var p = YB[n.i], rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>居中度 ' + p.sr + '%</b><br>排量 ' + p.q + ' m³/min<br>顶替效率 <b>' + p.eff.toFixed(2) + '%</b><br><span style="color:#8a9298">点击锁定</span>';
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
      var n = nearest(srAt(evt));
      selectA(n.i >= 0 && n.d <= 8 ? n.i : -1, false);
    });
  }

  function bindChartB() {
    var svg = document.getElementById('lit-chartB'), tip = document.getElementById('lit-tipB'), box = document.getElementById('lit-boxB');
    if (!svg || !tip || !box) return;
    var W = 900;
    function angAt(evt) {
      var r = svg.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (W / r.width);
      return clamp((vx - PL) / (W - PL - PR), 0, 1) * 90;
    }
    function nearest(a) {
      var bi = -1, bd = 1e9;
      PVI.forEach(function (p, i) { var d = Math.abs(p.ang - a); if (d < bd) { bd = d; bi = i; } });
      return { i: bi, d: bd };
    }
    svg.addEventListener('mousemove', function (evt) {
      var a = angAt(evt), n = nearest(a);
      if (n.i >= 0 && n.d <= 10) {
        var p = PVI[n.i], rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>井斜 ' + p.ang + '°</b><br>无扶正器居中度约 <b>' + p.sr + '%</b><br><span style="color:#8a9298">点击锁定</span>';
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 70) + 'px';
      } else tip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    svg.addEventListener('click', function (evt) {
      var n = nearest(angAt(evt));
      selectB(n.i >= 0 && n.d <= 10 ? n.i : -1);
    });
  }

  function bindTable() {
    var body = document.getElementById('lit-body'); if (!body) return;
    var rows = [];
    YB.forEach(function (p, i) {
      rows.push({ html: '<td class="num">' + (rows.length + 1) + '</td><td>元坝11井 2010</td><td>排量 ' + p.q + ' m³/min</td><td class="num">' + p.sr + '</td><td class="num">η = ' + p.eff.toFixed(2) + '%</td>', click: function () { selectA(i, true); } });
    });
    PVI.forEach(function (p, i) {
      rows.push({ html: '<td class="num">' + (rows.length + 1) + '</td><td>PVI 2015</td><td>井斜 ' + p.ang + '°，无扶正器</td><td class="num">' + p.sr + '</td><td>' + (p.sr >= 67 ? '满足 67%' : '低于 67%，需加扶正器') + '</td>', click: function () { selectB(i); } });
    });
    ADE.forEach(function (a, i) {
      rows.push({ html: '<td class="num">' + (rows.length + 1) + '</td><td>' + a.src + '</td><td>' + a.cond + '</td><td class="num">' + a.sr + '</td><td>' + a.res + '</td>', click: function () { selectT(i); } });
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
