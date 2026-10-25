/* ======= 环空窜槽智能识别 · 可运行示范 ======= */
(function () {
  'use strict';

  const W = 300, H = 300, CX = 150, CY = 150;
  const R_WELL = 110;      // 井眼半径
  const R_CASING = 60;     // 套管外径半径

  let state = {
    ecc: 0,       // 套管偏心 mm（屏幕 px 近似）
    chAng: 45,    // 窜槽角度范围
    chStart: 0,   // 窜槽起始角
    mic: 0,       // 微环隙 mm
    th: 0.45,     // 分割阈值
    noise: 8      // 噪声 %
  };

  function $(id) { return document.getElementById(id); }

  // 在某角度的水泥环厚度（考虑偏心 + 窜槽 + 微环隙）
  function cementThicknessAt(angleDeg) {
    // 偏心方向设为 0°（右侧），计算该方向井壁到套管外壁的距离
    const a = angleDeg * Math.PI / 180;
    // 套管中心偏移
    const casX = CX + state.ecc;
    const casY = CY;
    // 从套管中心沿 angle 方向到井壁的距离
    // 井壁圆心在 (CX,CY) 半径 R_WELL；套管圆心 (casX,casY) 半径 R_CASING
    const dx = Math.cos(a), dy = Math.sin(a);
    // 射线从套管中心出发，与井壁交点
    // |(casX + t*dx - CX, casY + t*dy - CY)| = R_WELL
    const ex = casX - CX, ey = casY - CY;
    const b = 2 * (ex * dx + ey * dy);
    const c = ex * ex + ey * ey - R_WELL * R_WELL;
    const disc = b * b - 4 * c;
    const t1 = (-b + Math.sqrt(Math.max(0, disc))) / 2;
    const distToWell = t1; // 套管外壁到井壁的径向距离
    let thick = distToWell - R_CASING;
    if (thick < 0) thick = 0;

    // 微环隙：整圈减薄
    thick -= state.mic;
    if (thick < 0) thick = 0;

    // 窜槽：在 [chStart, chStart+chAng] 范围内厚度清零
    if (state.chAng > 0.5) {
      const s = state.chStart % 360;
      const e = (s + state.chAng) % 360;
      const inChannel = s < e ? (angleDeg >= s && angleDeg < e) : (angleDeg >= s || angleDeg < e);
      if (inChannel) thick = 0;
    }
    return thick;
  }

  // 超声回波强度：水泥越厚回波越强（胶结好）；越薄越弱
  function echoIntensity(thick) {
    const maxT = R_WELL - R_CASING - state.ecc;
    let v = maxT > 0 ? thick / maxT : 0;
    v = Math.max(0, Math.min(1, v));
    // 加噪声
    v += (Math.random() - 0.5) * state.noise / 100;
    return Math.max(0, Math.min(1, v));
  }

  // 渲染物理截面
  function drawCross() {
    const svg = $('cross');
    const casX = CX + state.ecc;
    let s = '';
    // 井眼
    s += `<circle cx="${CX}" cy="${CY}" r="${R_WELL}" fill="#f5f2ea" stroke="#c9c2b0" stroke-width="1.5"/>`;
    // 水泥环（沿角度画扇形段）
    const N = 360;
    for (let i = 0; i < N; i++) {
      const a0 = (i - 0.5) * Math.PI / 180;
      const a1 = (i + 0.5) * Math.PI / 180;
      const thick = cementThicknessAt(i);
      const intensity = thick / (R_WELL - R_CASING);
      let color;
      if (thick < 0.5) color = '#b05a51'; // 窜槽
      else if (state.mic > 0.1 && thick < R_WELL - R_CASING - state.ecc) {
        // 微环隙情况下，整圈偏薄
        color = '#a97a1c';
      } else {
        const g = Math.floor(122 + intensity * 50);
        color = `rgb(${47 + (1 - intensity) * 40}, ${g}, ${107 + (1 - intensity) * 30})`;
      }
      // 从套管外壁到井壁的扇形
      const r1 = R_CASING;
      const r2 = r1 + thick + 0.5;
      const x1 = casX + r1 * Math.cos(a0), y1 = CY + r1 * Math.sin(a0);
      const x2 = casX + r2 * Math.cos(a0), y2 = CY + r2 * Math.sin(a0);
      const x3 = casX + r2 * Math.cos(a1), y3 = CY + r2 * Math.sin(a1);
      const x4 = casX + r1 * Math.cos(a1), y4 = CY + r1 * Math.sin(a1);
      s += `<polygon points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)} ${x4.toFixed(1)},${y4.toFixed(1)}" fill="${color}" opacity="0.85"/>`;
    }
    // 套管
    s += `<circle cx="${casX}" cy="${CY}" r="${R_CASING}" fill="#4d565b" stroke="#242b2e" stroke-width="1.5"/>`;
    s += `<circle cx="${casX}" cy="${CY}" r="${R_CASING * 0.6}" fill="#242b2e"/>`;
    // 偏心线
    if (state.ecc > 1) {
      s += `<line x1="${CX}" y1="${CY}" x2="${casX}" y2="${CY}" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="3 2"/>`;
      s += `<text x="${(CX + casX) / 2}" y="${CY - 6}" font-size="9" fill="#b05a51" text-anchor="middle" font-family="monospace">e=${state.ecc}</text>`;
    }
    s += `<text x="${CX}" y="${H - 8}" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">井径 ${R_WELL * 2} · 套管 ${R_CASING * 2}</text>`;
    svg.innerHTML = s;
  }

  // 渲染模拟超声成像图（360° 展开为矩形，角度→x，径向厚度→颜色）
  function drawImage() {
    const svg = $('image');
    const pad = 8;
    const plotW = W - pad * 2, plotH = H - pad * 2;
    const N = 360;
    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#1a1d1f"/>`;
    // 逐角度画竖条
    const segW = plotW / N;
    for (let i = 0; i < N; i++) {
      const thick = cementThicknessAt(i);
      const intensity = echoIntensity(thick);
      // 颜色：暗=低强度(窜槽)，亮=高强度(胶结好)
      const v = Math.floor(intensity * 255);
      const color = `rgb(${v},${Math.floor(v * 0.95)},${Math.floor(v * 0.8)})`;
      const x = pad + i * segW;
      s += `<rect x="${x.toFixed(1)}" y="${pad}" width="${(segW + 0.5).toFixed(1)}" height="${plotH}" fill="${color}"/>`;
    }
    // 轴标
    s += `<text x="${pad}" y="${H - 2}" font-size="8" fill="#9ba3a9" font-family="monospace">0°</text>`;
    s += `<text x="${W / 2}" y="${H - 2}" font-size="8" fill="#9ba3a9" text-anchor="middle" font-family="monospace">180°</text>`;
    s += `<text x="${W - pad}" y="${H - 2}" font-size="8" fill="#9ba3a9" text-anchor="end" font-family="monospace">360°</text>`;
    s += `<text x="${pad}" y="${pad - 2}" font-size="8" fill="#9ba3a9" font-family="monospace">← 暗 = 低密度 = 可能窜槽</text>`;
    svg.innerHTML = s;
  }

  // 分割：在成像图上找低于阈值的连续区域
  function segment() {
    const N = 360;
    const mask = new Array(N).fill(false);
    for (let i = 0; i < N; i++) {
      const thick = cementThicknessAt(i);
      const intensity = echoIntensity(thick);
      mask[i] = intensity < state.th;
    }
    return mask;
  }

  function drawMask() {
    const svg = $('mask');
    const pad = 8;
    const plotW = W - pad * 2, plotH = H - pad * 2;
    const N = 360;
    const mask = segment();
    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#1a1d1f"/>`;
    const segW = plotW / N;
    for (let i = 0; i < N; i++) {
      const x = pad + i * segW;
      const color = mask[i] ? '#b05a51' : '#2a3033';
      s += `<rect x="${x.toFixed(1)}" y="${pad}" width="${(segW + 0.5).toFixed(1)}" height="${plotH}" fill="${color}" opacity="${mask[i] ? 0.85 : 0.6}"/>`;
    }
    // 圈出检测到的窜槽段
    let inSeg = false, start = 0;
    const segments = [];
    for (let i = 0; i <= N; i++) {
      const v = i < N ? mask[i] : false;
      if (v && !inSeg) { inSeg = true; start = i; }
      if (!v && inSeg) { inSeg = false; segments.push([start, i - 1]); }
    }
    segments.forEach(([a, b]) => {
      const x1 = pad + a * segW;
      const x2 = pad + (b + 1) * segW;
      s += `<rect x="${x1.toFixed(1)}" y="${pad}" width="${(x2 - x1).toFixed(1)}" height="${plotH}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 2"/>`;
    });
    s += `<text x="${pad}" y="${H - 2}" font-size="8" fill="#9ba3a9" font-family="monospace">0°</text>`;
    s += `<text x="${W - pad}" y="${H - 2}" font-size="8" fill="#9ba3a9" text-anchor="end" font-family="monospace">360°</text>`;
    svg.innerHTML = s;
    return segments;
  }

  function updateResults(segments) {
    const totalAng = segments.reduce((s, [a, b]) => s + (b - a + 1), 0);
    const nSeg = segments.length;
    const realAng = state.chAng;
    const detected = segments.map(([a, b]) => `${a}°–${b}°`).join('，') || '无';

    const html = `
      <div class="row"><span>检测到窜槽段数</span><b>${nSeg}</b></div>
      <div class="row ${totalAng > 0 ? 'bad' : ''}"><span>检测窜槽角度合计</span><b>${totalAng}°</b></div>
      <div class="row"><span>真实窜槽角度</span><b>${realAng}°</b></div>
      <div class="row"><span>检测位置</span><b style="font-size:11px">${detected}</b></div>
      <div class="row"><span>微环隙</span><b>${state.mic > 0.1 ? state.mic.toFixed(1) + ' mm（整圈）' : '无'}</b></div>
    `;
    $('results').innerHTML = html;

    const v = $('verdict');
    if (realAng < 0.5 && totalAng < 5) {
      v.className = 'verdict ok';
      v.textContent = '✅ 无窜槽，模型也未检出。胶结良好。';
    } else if (realAng > 0.5 && Math.abs(totalAng - realAng) < 15) {
      v.className = 'verdict ok';
      v.textContent = `✅ 检出窜槽 ${totalAng}°（真实 ${realAng}°），误差 < 15°，结果可信。`;
    } else if (realAng > 0.5 && totalAng === 0) {
      v.className = 'verdict bad';
      v.textContent = '❌ 漏检！真实有窜槽但模型未检出。降低阈值或检查噪声。';
    } else if (realAng < 0.5 && totalAng > 5) {
      v.className = 'verdict warn';
      v.textContent = `⚠️ 误检！真实无窜槽但检出 ${totalAng}°。可能是偏心或微环隙造成，提高阈值。`;
    } else {
      v.className = 'verdict warn';
      v.textContent = `⚠️ 检出 ${totalAng}° 与真实 ${realAng}° 偏差较大，检查偏心校正与阈值。`;
    }
  }

  function render() {
    drawCross();
    drawImage();
    const segs = drawMask();
    updateResults(segs);
  }

  function bind() {
    $('s-ecc').addEventListener('input', e => { state.ecc = +e.target.value; $('o-ecc').textContent = state.ecc; render(); });
    $('s-ch').addEventListener('input', e => { state.chAng = +e.target.value; $('o-ch').textContent = state.chAng; render(); });
    $('s-cs').addEventListener('input', e => { state.chStart = +e.target.value; $('o-cs').textContent = state.chStart; render(); });
    $('s-mic').addEventListener('input', e => { state.mic = +e.target.value; $('o-mic').textContent = state.mic; render(); });
    $('s-th').addEventListener('input', e => { state.th = +e.target.value; $('o-th').textContent = state.th.toFixed(2); render(); });
    $('s-noise').addEventListener('input', e => { state.noise = +e.target.value; $('o-noise').textContent = state.noise; render(); });
  }

  bind();
  render();
})();
