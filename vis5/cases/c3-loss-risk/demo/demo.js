/* ======= 固井漏失风险预测 · 可运行示范 ======= */
(function () {
  'use strict';

  // ---------- 状态 ----------
  let S = {
    margin: 0.08,   // 窗口裕度 g/cm³
    frac: 0.3,      // 裂缝密度 条/m
    safety: 0.95,   // ECD / 破裂压力
    v: 1.2,         // 环空返速 m/s
    k: 250          // 渗透率 mD
  };

  // ---------- 简化的 LightGBM 预测模型 ----------
  // 模拟一个已经训练好的 LightGBM：用一系列 if-else 分裂条件（阈值参考真实训练结果）
  // 输出 0-1 概率

  function predictRisk() {
    // 归一化各特征到 0-1 区间（越高越危险）
    const f_margin = 1 - Math.min(1, Math.max(0, (S.margin - 0.01) / 0.19)); // 裕度越小越危险
    const f_frac = Math.min(1, Math.max(0, S.frac / 2.5));
    const f_safety = Math.min(1.2, Math.max(0.85, S.safety - 0.85)) / 0.2;
    const f_v = Math.min(1, Math.max(0, (S.v - 0.5) / 2));
    const f_k = Math.min(1, Math.max(0, Math.log(S.k + 1) / Math.log(5001)));

    // LightGBM 分裂树：模拟一个 3 层的树（主分裂 + 两个次分裂）
    // 主分裂：安全系数是否 >= 0.97
    let prob;
    if (S.safety >= 0.97) {
      // 高安全系数 → 低基线，但裕度和返速仍有影响
      prob = 0.08;
      prob += f_frac * 0.12;
      prob += (1 - f_margin) * -0.05;  // 裕度大 → 概率更低
    } else if (S.safety >= 0.93) {
      // 中等安全
      prob = 0.30;
      prob += f_frac * 0.20;
      prob += f_v * 0.10;
      prob += f_k * 0.05;
      prob += (1 - f_margin) * -0.08;
    } else if (S.safety >= 0.89) {
      // 接近危险区
      prob = 0.55;
      prob += f_frac * 0.20;
      prob += f_v * 0.12;
      prob += f_k * 0.08;
      prob += (1 - f_margin) * -0.10;
    } else {
      // 非常危险
      prob = 0.82;
      prob += f_frac * 0.12;
      prob += f_v * 0.05;
    }

    // 额外规则：裂缝 + 低裕度双红 → 概率额外上升
    if (S.frac >= 1.2 && S.margin <= 0.04) {
      prob += 0.10;
    }

    prob = Math.max(0.02, Math.min(0.99, prob));

    // 贡献度计算（用 SHAP-like 简化版：每个特征偏离均值多少 × 权重）
    const contribs = {
      margin: { val: S.margin, weight: 0.38, dir: f_margin > 0.5 ? 'up' : 'down', abs: f_margin },
      frac: { val: S.frac, weight: 0.22, dir: f_frac > 0.5 ? 'up' : 'down', abs: f_frac },
      safety: { val: S.safety, weight: 0.18, dir: f_safety > 0.5 ? 'up' : 'down', abs: f_safety },
      v:     { val: S.v, weight: 0.15, dir: f_v > 0.5 ? 'up' : 'down', abs: f_v },
      k:     { val: S.k, weight: 0.07, dir: f_k > 0.5 ? 'up' : 'down', abs: f_k }
    };

    return { prob, contribs };
  }

  // ---------- 仪表盘 ----------
  function drawGauge(prob) {
    const svg = document.getElementById('gauge');
    const W = 260, H = 160;
    const cx = 130, cy = 130, r = 100;

    // 颜色分段
    let color;
    if (prob < 0.33) color = '#3f8560';
    else if (prob < 0.66) color = '#a97a1c';
    else color = '#b05a51';

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 背景弧
    s += `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#efece1" stroke-width="22" stroke-linecap="round"/>`;

    // 三段颜色标记
    const angles = [
      { a1: Math.PI, a2: Math.PI + 0.33 * Math.PI, c: '#3f8560' },
      { a1: Math.PI + 0.33 * Math.PI, a2: Math.PI + 0.66 * Math.PI, c: '#a97a1c' },
      { a1: Math.PI + 0.66 * Math.PI, a2: 2 * Math.PI, c: '#b05a51' }
    ];
    angles.forEach(a => {
      const x1 = cx + r * Math.cos(a.a1);
      const y1 = cy + r * Math.sin(a.a1);
      const x2 = cx + r * Math.cos(a.a2);
      const y2 = cy + r * Math.sin(a.a2);
      const large = (a.a2 - a.a1) > Math.PI ? 1 : 0;
      s += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${a.c}" stroke-width="22" stroke-linecap="round" opacity="0.2"/>`;
    });

    // 指针
    const angle = Math.PI + prob * Math.PI;
    const px = cx + (r - 15) * Math.cos(angle);
    const py = cy + (r - 15) * Math.sin(angle);
    s += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="7" fill="${color}"/>`;

    // 中心数值
    s += `<text x="${cx}" y="${cy - 18}" font-size="38" font-weight="700" text-anchor="middle" fill="${color}" font-family="monospace">${(prob * 100).toFixed(0)}%</text>`;
    s += `<text x="${cx}" y="${cy + 12}" font-size="11" fill="#79828a" text-anchor="middle" letter-spacing="1">LOSS PROBABILITY</text>`;

    // 刻度
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + i / 10 * Math.PI;
      const x1 = cx + (r - 30) * Math.cos(a);
      const y1 = cy + (r - 30) * Math.sin(a);
      const x2 = cx + r * Math.cos(a);
      const y2 = cy + r * Math.sin(a);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c9c2b0" stroke-width="1"/>`;
    }

    svg.innerHTML = s;
  }

  // ---------- 因素贡献条形图 ----------
  function drawBars(contribs) {
    const svg = document.getElementById('bars');
    const W = 600, H = 220, padL = 120, padR = 40, padT = 10, padB = 10;
    const barH = 28, gap = 8;

    const keys = [
      { k: 'margin', label: '窗口裕度 Δ', unit: 'g/cm³' },
      { k: 'frac', label: '裂缝密度', unit: '条/m' },
      { k: 'safety', label: 'ECD 安全系数', unit: '' },
      { k: 'v', label: '环空返速', unit: 'm/s' },
      { k: 'k', label: '渗透率', unit: 'mD' }
    ];

    // 按绝对贡献排序
    keys.sort((a, b) => contribs[b.k].weight * contribs[b.k].abs - contribs[a.k].weight * contribs[a.k].abs);

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    keys.forEach((key, i) => {
      const c = contribs[key.k];
      const y = padT + i * (barH + gap);
      const totalContrib = c.weight * c.abs;
      const pct = Math.min(1, totalContrib / 0.25); // 归一化到 0-1（约 25% 最大单项贡献）

      // 背景条
      s += `<rect x="${padL}" y="${y + 4}" width="${W - padL - padR}" height="${barH - 8}" rx="4" fill="#f5f2ea"/>`;

      // 贡献条
      const br = (W - padL - padR) * pct;
      const barColor = c.dir === 'up' ? '#b05a51' : '#2f7d6b';
      s += `<rect x="${padL}" y="${y + 4}" width="${br}" height="${barH - 8}" rx="4" fill="${barColor}" opacity="0.8"/>`;

      // 标签
      s += `<text x="${padL - 8}" y="${y + barH / 2 + 4}" font-size="12" fill="#4d565b" text-anchor="end" font-weight="500">${key.label}</text>`;

      // 当前值
      const valStr = key.unit === 'mD' ? c.val.toFixed(0) : c.val.toFixed(2);
      s += `<text x="${padL + br + 6}" y="${y + barH / 2 + 4}" font-size="11" fill="${barColor}" font-family="monospace" font-weight="600">${valStr}${key.unit}</text>`;

      // 权重
      s += `<text x="${W - padR + 6}" y="${y + barH / 2 + 4}" font-size="10" fill="#9ba3a9" font-family="monospace">${(c.weight * 100).toFixed(0)}%</text>`;
    });

    // 底部说明
    s += `<text x="${padL}" y="${H - 4}" font-size="9.5" fill="#9ba3a9">← 贡献度 →     <tspan fill="#b05a51">红色 = 当前值朝危险方向</tspan>  <tspan fill="#2f7d6b">绿色 = 安全方向</tspan></text>`;

    svg.innerHTML = s;
  }

  // ---------- 沿井深风险曲线 ----------
  function drawDepthRisk() {
    const svg = document.getElementById('depth-risk');
    const W = 720, H = 200, padL = 40, padR = 14, padT = 14, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const N = 100, DEPTH_MAX = 4800;

    // 模拟沿井深的因素变化
    const risks = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const depth = t * DEPTH_MAX;
      // 模拟：沿深度安全系数下降（压力升高），裂缝密度在中间段高，返速先增后减
      const locSafety = Math.max(0.85, S.safety + (1 - t) * 0.04 - Math.sin(t * 6) * 0.02);
      const locFrac = S.frac * (0.5 + 0.7 * Math.exp(-Math.pow((t - 0.45) * 4, 2)) + 0.1 * Math.random());
      const locMargin = Math.max(0.01, S.margin * (0.6 + 0.5 * (1 - t)));

      // 简化的逐点风险
      let r = 0.1 + (1 - locSafety / 1.05) * 0.6 + locFrac * 0.15 + (1 - locMargin / 0.15) * 0.25;
      r = Math.max(0.02, Math.min(0.99, r));
      risks[i] = r;
    }

    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fdfcf9" rx="4"/>`;

    // 风险热图（渐变色带）
    let bandW = plotW / N;
    for (let i = 0; i < N; i++) {
      const x = padL + i * bandW;
      let col;
      if (risks[i] < 0.33) col = '#3f8560';
      else if (risks[i] < 0.66) col = '#a97a1c';
      else col = '#b05a51';
      s += `<rect x="${x}" y="${padT}" width="${bandW + 0.5}" height="${plotH}" fill="${col}" opacity="${0.3 + risks[i] * 0.7}"/>`;
    }

    // 风险曲线
    let path = '';
    for (let i = 0; i < N; i++) {
      const x = padL + i * bandW;
      const y = padT + (1 - risks[i]) * plotH;
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    s += `<path d="${path}" fill="none" stroke="#242b2e" stroke-width="1.5" stroke-linejoin="round"/>`;

    // 高风险段（>66%）标注
    let inHigh = false, hs = 0;
    for (let i = 0; i < N; i++) {
      if (risks[i] > 0.66 && !inHigh) { inHigh = true; hs = i; }
      if (risks[i] <= 0.66 && inHigh) {
        const x1 = padL + hs * bandW;
        const x2 = padL + i * bandW;
        const y = padT - 2;
        s += `<text x="${(x1 + x2) / 2}" y="${y - 2}" font-size="9" fill="#b05a51" text-anchor="middle" font-weight="600">⚠ ${((hs + i) / 2 / N * DEPTH_MAX).toFixed(0)}m 附近</text>`;
        inHigh = false;
      }
    }
    if (inHigh) {
      const x1 = padL + hs * bandW;
      const x2 = padL + N * bandW;
      s += `<text x="${(x1 + x2) / 2}" y="${padT - 2}" font-size="9" fill="#b05a51" text-anchor="middle" font-weight="600">⚠ 井底高风险</text>`;
    }

    // 坐标轴
    for (let i = 0; i <= 6; i++) {
      const x = padL + i / 6 * plotW;
      const d = (i / 6 * DEPTH_MAX).toFixed(0);
      s += `<text x="${x}" y="${H - 8}" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">${d}m</text>`;
    }
    s += `<text x="${padL - 6}" y="${padT + 5}" font-size="9" fill="#3f8560" text-anchor="end">低</text>`;
    s += `<text x="${padL - 6}" y="${padT + plotH}" font-size="9" fill="#b05a51" text-anchor="end">高</text>`;

    svg.innerHTML = s;
  }

  // ---------- 事件绑定 ----------
  function bind() {
    const fields = [
      { id: 's-margin', key: 'margin', out: 'o-margin', fmt: v => v.toFixed(2) },
      { id: 's-frac', key: 'frac', out: 'o-frac', fmt: v => v.toFixed(1) },
      { id: 's-safety', key: 'safety', out: 'o-safety', fmt: v => v.toFixed(2) },
      { id: 's-v', key: 'v', out: 'o-v', fmt: v => v.toFixed(1) },
      { id: 's-k', key: 'k', out: 'o-k', fmt: v => v.toFixed(0) }
    ];

    fields.forEach(f => {
      const el = document.getElementById(f.id);
      const out = document.getElementById(f.out);
      el.value = S[f.key];
      out.textContent = f.fmt(S[f.key]);
      el.addEventListener('input', () => {
        S[f.key] = parseFloat(el.value);
        out.textContent = f.fmt(S[f.key]);
        paint();
      });
    });

    // 快捷场景
    document.querySelectorAll('.preset-btns button').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.p;
        let vals;
        if (p === 'safe') vals = { margin: 0.15, frac: 0.2, safety: 0.90, v: 0.9, k: 150 };
        else if (p === 'warn') vals = { margin: 0.05, frac: 0.8, safety: 0.96, v: 1.6, k: 800 };
        else if (p === 'risk') vals = { margin: 0.03, frac: 1.5, safety: 0.99, v: 2.2, k: 2000 };
        else vals = { margin: 0.04, frac: 2.5, safety: 0.94, v: 1.2, k: 3500 };

        Object.assign(S, vals);
        fields.forEach(f => {
          const el = document.getElementById(f.id);
          const out = document.getElementById(f.out);
          el.value = S[f.key];
          out.textContent = f.fmt(S[f.key]);
        });
        paint();
      });
    });
  }

  function paint() {
    const { prob, contribs } = predictRisk();
    drawGauge(prob);
    drawBars(contribs);
    drawDepthRisk();

    // 风险等级和建议
    const pct = (prob * 100).toFixed(0);
    let level, advice, detail, cls;
    if (prob < 0.33) {
      level = '低风险'; advice = '按常规方案施工'; cls = 'ok';
      detail = '当前参数组合的漏失概率 < 30%，属于"通常不会出问题"的区间。可以按经验方案施工，只需保留常规监控。';
    } else if (prob < 0.66) {
      level = '中风险'; advice = '建议提前准备暂堵剂'; cls = 'warn';
      detail = '概率 30—65%，属于"临界"区间。建议：① 降低密度或排量 5—10%；② 提前准备随钻暂堵剂；③ 加密漏失监测点（每 10 秒一个）。';
    } else {
      level = '高风险'; advice = '必须调整方案！'; cls = 'bad';
      detail = '概率 > 65%，强烈建议重新设计注水泥方案：① 降低密度 0.05—0.10 g/cm³；② 降低排量或分阶段施工；③ 改用低密度水泥浆体系。不建议"硬上"。';
    }

    const rrP = document.getElementById('rr-p');
    rrP.textContent = pct + '%';
    rrP.className = cls;
    document.getElementById('rr-level').textContent = level;
    document.getElementById('rr-level').className = cls;
    document.getElementById('rr-advice').textContent = advice;
    document.getElementById('rr-advice').className = cls;
    document.getElementById('rr-detail').textContent = detail;
    document.getElementById('rr-detail').className = 'rr-detail ' + cls;
  }

  bind();
  paint();
})();
