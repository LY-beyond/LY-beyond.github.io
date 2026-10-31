/* ======= 抽油机井示功图工况诊断 · 可运行示范 ======= */
(function () {
  'use strict';

  // ---------- 状态 ----------
  let S = {
    case: 'normal',
    S: 3.0,     // 冲程 m
    N: 6,       // 冲次 次/分
    d: 56,      // 泵径 mm
    noise: 1    // 噪声 1-4
  };

  const CASES = [
    { key: 'normal', label: '正常' },
    { key: 'underfill', label: '供液不足' },
    { key: 'gaslock', label: '气锁' },
    { key: 'pumploss', label: '泵漏' },
    { key: 'rodbreak', label: '断脱' },
    { key: 'ballleak', label: '游动阀漏' }
  ];

  // ---------- 随机数 ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- 示功图生成 ----------
  function generateDyn(caseKey, params, seed) {
    const rnd = mulberry32(seed || 42);
    const gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = rnd();
      while (v === 0) v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const N = 200; // 采样点（整个冲程）
    const stroke = params.S; // m
    const maxLoad = params.d * params.S * 0.18 + 30; // kN（简化估算）

    // 载荷随位移的函数（0→stroke→0，上冲程 + 下冲程）
    const points = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let x, load;
      const noiseAmp = params.noise * 4;

      if (t < 0.5) {
        // 上冲程：位移 0 → stroke
        x = t * 2 * stroke;
        // 基本加载曲线（从最小载荷开始）
        const base = 0.4 + t * 0.6; // 0.4 → 1.0
        load = base;

        if (caseKey === 'normal') {
          // 正常：平滑上升
          load = 0.35 + Math.sin(t * Math.PI) * 0.65;
        } else if (caseKey === 'underfill') {
          // 供液不足：上冲程正常，但泵未充满
          load = 0.4 + Math.sin(t * Math.PI) * 0.55;
        } else if (caseKey === 'gaslock') {
          // 气锁：上冲程顶部平段（气体先被压缩）
          if (t < 0.3) load = 0.35 + (t / 0.3) * 0.25;
          else if (t < 0.6) load = 0.6 + Math.sin((t - 0.3) / 0.3 * Math.PI) * 0.25;
          else load = 0.85; // 平段
        } else if (caseKey === 'pumploss') {
          // 泵漏：上冲程基本正常
          load = 0.4 + Math.sin(t * Math.PI) * 0.55;
        } else if (caseKey === 'rodbreak') {
          // 断脱：上冲程到一半载荷突然掉
          if (t < 0.35) load = 0.35 + (t / 0.35) * 0.55;
          else load = 0.05; // 掉为 0
        } else if (caseKey === 'ballleak') {
          // 游动阀漏：上冲程载荷缓慢上升（液体漏回）
          load = 0.35 + Math.pow(t, 0.6) * 0.55; // 缓上升
        }
      } else {
        // 下冲程：位移 stroke → 0
        const t2 = t - 0.5;
        x = stroke - t2 * 2 * stroke;

        if (caseKey === 'normal') {
          load = 0.85 - Math.sin(t2 * Math.PI) * 0.55;
        } else if (caseKey === 'underfill') {
          // 供液不足：下冲程前半段载荷很低（空段）
          if (t2 < 0.35) load = 0.25 + t2 * 0.3; // 低载荷段
          else load = 0.35 + Math.sin((t2 - 0.35) / 0.65 * Math.PI) * 0.55;
        } else if (caseKey === 'gaslock') {
          load = 0.85 - Math.sin(t2 * Math.PI) * 0.55;
        } else if (caseKey === 'pumploss') {
          // 泵漏：回程载荷下不去（液体漏失）
          load = 0.85 - Math.pow(t2, 1.5) * 0.35; // 缓下降，末端仍高
        } else if (caseKey === 'rodbreak') {
          load = 0.05; // 全程 0
        } else if (caseKey === 'ballleak') {
          load = 0.85 - Math.sin(t2 * Math.PI) * 0.55;
        }
      }

      // 噪声
      load += gauss() * noiseAmp / maxLoad;
      load = Math.max(0.02, Math.min(1, load));

      points.push({ x, y: load * maxLoad });
    }

    return { points, stroke, maxLoad };
  }

  // ---------- AI 分类（基于形态特征的规则引擎）----------
  function aiClassify(dyn) {
    const pts = dyn.points;
    const N = pts.length;
    const half = Math.floor(N / 2);

    // 特征提取
    const up = pts.slice(0, half);     // 上冲程
    const down = pts.slice(half);      // 下冲程

    // F1: 上冲程顶部是否有平段（气锁特征）
    let flatTop = 0;
    for (let i = half - 20; i < half; i++) {
      flatTop += Math.abs(pts[i].y - pts[i-1].y);
    }
    flatTop = flatTop / 20;

    // F2: 最大载荷位置（断脱特征）
    const maxY = Math.max(...pts.map(p => p.y));
    const maxYIdx = pts.findIndex(p => p.y === maxY);
    const loadDrop = pts.slice(maxYIdx + 1).reduce((a, p) => a + (p.y < maxY * 0.3 ? 1 : 0), 0);

    // F3: 下冲程起始段载荷（供液不足）
    const downFirstY = down.slice(0, 15).reduce((a, p) => a + p.y, 0) / 15;

    // F4: 下冲程末端载荷（泵漏特征）
    const downEndY = down.slice(-15).reduce((a, p) => a + p.y, 0) / 15;

    // F5: 上冲程开头载荷上升速度（游动阀漏）
    const upSlope = (up[10].y - up[0].y) / 10;

    // F6: 闭合度（正常 vs 异常）
    const closeDiff = Math.abs(pts[0].y - pts[N-1].y);

    // 规则分类（带置信度）
    let probs = { normal: 0.15, underfill: 0.1, gaslock: 0.1, pumploss: 0.1, rodbreak: 0.1, ballleak: 0.1 };

    // 断脱：载荷突然掉到很低
    if (maxYIdx < half * 0.6 && loadDrop > half) {
      probs.rodbreak += 0.55;
    }

    // 气锁：顶部有明显平段
    if (flatTop < 2 && up[half-1].y > maxY * 0.8) {
      probs.gaslock += 0.45;
    }

    // 供液不足：下冲程起始载荷低
    if (downFirstY < maxY * 0.38) {
      probs.underfill += 0.45;
    }

    // 泵漏：下冲程末端载荷仍高（回程下不去）
    if (downEndY > maxY * 0.55) {
      probs.pumploss += 0.35;
    }

    // 游动阀漏：上冲程开头斜率小（缓慢上升）
    if (upSlope < 1.5 && pts[half * 0.7].y < maxY * 0.6) {
      probs.ballleak += 0.30;
    }

    // 正常：没有明显异常特征
    const abnormalScore = probs.rodbreak + probs.gaslock + probs.underfill + probs.pumploss + probs.ballleak - 0.5;
    if (abnormalScore < 0.2) {
      probs.normal += 0.55;
    } else {
      probs.normal += Math.max(0, 0.35 - abnormalScore * 0.3);
    }

    // 归一化
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    Object.keys(probs).forEach(k => probs[k] = probs[k] / sum);

    // 特征描述
    const features = [];
    if (flatTop < 2) features.push({ k: '顶部平段', v: '明显（气锁）' });
    if (maxYIdx < half * 0.6) features.push({ k: '载荷突变', v: '上冲程中部掉载（疑似断脱）' });
    if (downFirstY < maxY * 0.38) features.push({ k: '下冲程起始', v: '载荷偏低（泵未充满）' });
    if (downEndY > maxY * 0.55) features.push({ k: '下冲程末端', v: '载荷仍高（泵漏液）' });
    if (upSlope < 1.5) features.push({ k: '上冲程加载', v: '缓慢（游动阀漏）' });
    if (features.length === 0) features.push({ k: '整体形态', v: '饱满四边形，上下对称' });

    return { probs, features };
  }

  // ---------- 主示功图渲染 ----------
  function drawDyn(dyn) {
    const svg = document.getElementById('dyn');
    const W = 360, H = 216;
    const padL = 36, padR = 8, padT = 16, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    const XMAX = dyn.stroke * 1.1;
    const YMAX = dyn.maxLoad * 1.15;

    function xOf(v) { return padL + v / XMAX * plotW; }
    function yOf(v) { return padT + (1 - v / YMAX) * plotH; }

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 网格
    for (let v = 0; v <= XMAX; v += 1) {
      s += `<line x1="${xOf(v)}" y1="${padT}" x2="${xOf(v)}" y2="${padT + plotH}" stroke="#efece1"/>`;
      s += `<text x="${xOf(v)}" y="${H - 16}" font-size="8" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${v.toFixed(0)}</text>`;
    }
    for (let v = 0; v <= YMAX; v += Math.round(YMAX / 5)) {
      const y = yOf(v);
      s += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#efece1"/>`;
      s += `<text x="${padL - 6}" y="${y + 3}" font-size="8" fill="#9ba3a9" text-anchor="end" font-family="monospace">${v.toFixed(0)}</text>`;
    }

    // 冲程中心线
    s += `<line x1="${xOf(dyn.stroke / 2)}" y1="${padT}" x2="${xOf(dyn.stroke / 2)}" y2="${padT + plotH}" stroke="#ddd7c8" stroke-width="1" stroke-dasharray="2 2"/>`;

    // 示功图路径
    let path = '';
    for (let i = 0; i < dyn.points.length; i++) {
      const p = dyn.points[i];
      path += (i ? 'L' : 'M') + xOf(p.x).toFixed(1) + ' ' + yOf(p.y).toFixed(1) + ' ';
    }
    path += 'Z';

    // 填充（半透明）
    s += `<path d="${path}" fill="rgba(47,125,107,0.18)" stroke="none"/>`;
    s += `<path d="${path}" fill="none" stroke="#235f51" stroke-width="2" stroke-linejoin="round"/>`;

    // 冲程起止点标注
    s += `<circle cx="${xOf(0)}" cy="${yOf(dyn.points[0].y)}" r="3" fill="#2f7d6b"/>`;
    s += `<text x="${xOf(0) - 5}" y="${yOf(dyn.points[0].y) - 5}" font-size="8" fill="#2f7d6b" font-family="monospace" text-anchor="end">起</text>`;
    const midPt = dyn.points[Math.floor(dyn.points.length / 2)];
    s += `<circle cx="${xOf(midPt.x)}" cy="${yOf(midPt.y)}" r="3" fill="#b26a39"/>`;
    s += `<text x="${xOf(midPt.x) + 5}" y="${yOf(midPt.y) - 5}" font-size="8" fill="#b26a39" font-family="monospace">满</text>`;

    // 轴标签
    s += `<text x="${padL}" y="${padT - 6}" font-size="8.5" fill="#9ba3a9" font-family="monospace">载荷 kN ↑</text>`;
    s += `<text x="${padL + plotW / 2}" y="${padT + plotH + 20}" font-size="8.5" fill="#9ba3a9" text-anchor="middle">位移 m →</text>`;

    svg.innerHTML = s;
  }

  // ---------- AI 结果渲染 ----------
  function drawAI(probs, features) {
    const labels = {
      normal: '正常',
      underfill: '供液不足',
      gaslock: '气锁',
      pumploss: '泵漏',
      rodbreak: '断脱',
      ballleak: '游动阀漏'
    };

    // 概率条
    const order = Object.keys(probs).sort((a, b) => probs[b] - probs[a]);
    const probEl = document.getElementById('probs');
    probEl.innerHTML = order.map(k => `
      <div class="prob-row">
        <span class="pl">${labels[k]}</span>
        <div class="pb"><div class="pf" style="width:${(probs[k] * 100).toFixed(1)}%;background:${k === order[0] ? '#235f51' : '#b26a39'}"></div></div>
        <span class="pv">${(probs[k] * 100).toFixed(0)}%</span>
      </div>
    `).join('');

    // 判定
    const best = order[0];
    const conf = probs[best];
    document.getElementById('ai-verdict').textContent = labels[best];
    document.getElementById('ai-confidence').textContent = `置信度 ${(conf * 100).toFixed(0)}% · 次选 ${labels[order[1]]} ${(probs[order[1]] * 100).toFixed(0)}%`;

    // 描述
    const descs = {
      normal: '示功图形态饱满，上下冲程载荷对称，无明显异常特征。当前井工况正常，可继续按制度生产。',
      underfill: '下冲程前半段载荷偏低，说明泵未被液体充满。可能原因：供液能力不足、油井缺液。建议排查液面。',
      gaslock: '上冲程顶部出现明显平段，是气体被压缩后不传递压力的典型特征。建议：提高泵深或增加放气频率。',
      pumploss: '下冲程末端载荷仍偏高，回程压力下不去——活塞与缸套之间存在漏失。建议安排检泵作业。',
      rodbreak: '载荷在上冲程中部突然掉到 0，典型的光杆断脱特征。需要立即停机检泵，更换光杆或打捞断杆。',
      ballleak: '上冲程载荷缓慢上升，游动阀关闭滞后。可能是游动阀磨损或有杂质卡滞，影响泵效。'
    };
    document.getElementById('ai-desc').textContent = descs[best] || '';

    // 特征
    document.getElementById('features').innerHTML = features.map(f =>
      `<div class="feat"><b>${f.k}</b>: ${f.v}</div>`
    ).join('');
  }

  // ---------- 典型工况一览 ----------
  function drawGallery() {
    const svg = document.getElementById('gallery');
    const W = 430, H = 230;
    const cols = 3, rows = 2;
    const pad = 8, margin = 12;
    const cellW = (W - margin * 2 - pad * (cols - 1)) / cols;
    const cellH = (H - margin * 2 - pad * (rows - 1)) / rows;

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    CASES.forEach((c, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const cx = margin + col * (cellW + pad);
      const cy = margin + row * (cellH + pad);
      const innerPad = 10;
      const iW = cellW - innerPad * 2;
      const iH = cellH - innerPad * 2;

      const dyn = generateDyn(c.key, { S: 3.0, d: 56, noise: 1 }, idx * 7 + 1);
      const XMAX = 3.5, YMAX = dyn.maxLoad * 1.15;

      // 背景
      s += `<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="6" fill="#f5f2ea"/>`;

      // 小网格
      for (let v = 0; v <= XMAX; v += 1) {
        s += `<line x1="${cx + innerPad + v / XMAX * iW}" y1="${cy + innerPad}" x2="${cx + innerPad + v / XMAX * iW}" y2="${cy + innerPad + iH}" stroke="#e9e4d8"/>`;
      }
      for (let v = 0; v <= YMAX; v += Math.round(YMAX / 3)) {
        s += `<line x1="${cx + innerPad}" y1="${cy + innerPad + (1 - v / YMAX) * iH}" x2="${cx + innerPad + iW}" y2="${cy + innerPad + (1 - v / YMAX) * iH}" stroke="#e9e4d8"/>`;
      }

      // 路径
      let path = '';
      for (let i = 0; i < dyn.points.length; i++) {
        const p = dyn.points[i];
        const x = cx + innerPad + (p.x / XMAX) * iW;
        const y = cy + innerPad + (1 - p.y / YMAX) * iH;
        path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      }
      path += 'Z';
      s += `<path d="${path}" fill="rgba(47,125,107,0.18)" stroke="#235f51" stroke-width="1.4" stroke-linejoin="round"/>`;

      // 标签
      s += `<text x="${cx + cellW / 2}" y="${cy + cellH - 4}" font-size="8.5" font-weight="600" text-anchor="middle" fill="#235f51">${c.label}</text>`;
    });

    svg.innerHTML = s;
  }

  // ---------- 主流程 ----------
  function paint() {
    const dyn = generateDyn(S.case, { S: S.S, d: S.d, noise: S.noise }, 20261023);
    drawDyn(dyn);
    const { probs, features } = aiClassify(dyn);
    drawAI(probs, features);
  }

  // ---------- 事件 ----------
  function bind() {
    // 工况按钮
    document.querySelectorAll('.case-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.case-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        S.case = btn.dataset.c;
        paint();
      });
    });

    // 参数滑块
    document.getElementById('s-S').addEventListener('input', e => {
      S.S = parseFloat(e.target.value);
      document.getElementById('o-S').textContent = S.S.toFixed(1);
      paint();
    });
    document.getElementById('s-N').addEventListener('input', e => {
      S.N = +e.target.value;
      document.getElementById('o-N').textContent = S.N;
      paint();
    });
    document.getElementById('s-d').addEventListener('input', e => {
      S.d = +e.target.value;
      document.getElementById('o-d').textContent = S.d;
      paint();
    });
    document.getElementById('s-noise').addEventListener('input', e => {
      S.noise = +e.target.value;
      document.getElementById('o-noise').textContent = ['低', '中', '较高', '高'][S.noise - 1];
      paint();
    });
  }

  bind();
  paint();
  drawGallery();
})();
