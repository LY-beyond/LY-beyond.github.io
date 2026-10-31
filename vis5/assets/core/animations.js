/* ==========================================================================
   环节动画引擎 · 多色重绘版
   色板：jade(主) + clay(暖强调) + c-ts/c-cv/c-opt/c-nlp/c-kg(方法色)
   ========================================================================== */
(function () {
  'use strict';
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&quot;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function commonDefs() {
    return '' +
      '<defs>' +
      '  <filter id="stgGlow" x="-50%" y="-50%" width="200%" height="200%">' +
      '    <feGaussianBlur stdDeviation="2.5" result="blur"/>' +
      '    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '  </filter>' +
      '  <radialGradient id="jadePulse" cx=".5" cy=".5" r=".5">' +
      '    <stop offset="0%" stop-color="var(--jade)" stop-opacity=".8"/>' +
      '    <stop offset="100%" stop-color="var(--jade)" stop-opacity="0"/>' +
      '  </radialGradient>' +
      '  <radialGradient id="clayPulse" cx=".5" cy=".5" r=".5">' +
      '    <stop offset="0%" stop-color="var(--clay)" stop-opacity=".9"/>' +
      '    <stop offset="100%" stop-color="var(--clay)" stop-opacity="0"/>' +
      '  </radialGradient>' +
      '  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
      '    <stop offset="0%" stop-color="var(--c-opt)" stop-opacity=".18"/>' +
      '    <stop offset="100%" stop-color="var(--paper)" stop-opacity="0"/>' +
      '  </linearGradient>' +
      '  <linearGradient id="earthG" x1="0" y1="0" x2="0" y2="1">' +
      '    <stop offset="0%" stop-color="var(--jade)" stop-opacity=".25"/>' +
      '    <stop offset="100%" stop-color="var(--clay)" stop-opacity=".35"/>' +
      '  </linearGradient>' +
      '  <linearGradient id="hotG" x1="0" y1="0" x2="1" y2="0">' +
      '    <stop offset="0%" stop-color="var(--clay)"/>' +
      '    <stop offset="50%" stop-color="var(--warn)"/>' +
      '    <stop offset="100%" stop-color="var(--clay)"/>' +
      '  </linearGradient>' +
      '</defs>';
  }

  /* ═════════════════════════════════════════════════════════════
     通用图表辅助：折线 / 柱状 / 雷达 / 条带
     所有图表基于 viewBox 0..800×0..420，面板统一宽 230
     ═════════════════════════════════════════════════════════════ */

  // 单个图表面板外壳：返回 SVG 片段（含背景/标题/绘图区）
  function panel(x, y, title, color, chartH) {
    chartH = chartH || 72;
    return '' +
      '<g transform="translate(' + x + ',' + y + ')">' +
      '  <rect width="230" height="' + (chartH + 40) + '" rx="6" fill="var(--card)" fill-opacity=".82" stroke="' + color + '" stroke-opacity=".35"/>' +
      '  <text x="10" y="16" font-size="10" fill="' + color + '" font-weight="bold">' + title + '</text>' +
      '  <line x1="10" y1="24" x2="220" y2="24" stroke="var(--line)" stroke-width="1"/>' +
      '  <rect x="10" y="30" width="210" height="' + chartH + '" fill="var(--ink-3)" fill-opacity=".12" rx="2"/>' +
      '</g>';
  }

  // 折线图：把 values（0..1 归一化）画成 path，填充进度 p（0..1）控制显示长度
  function linePath(values, px, py, pw, ph) {
    if (!values || !values.length) return '';
    var d = '', n = values.length;
    for (var i = 0; i < n; i++) {
      var v = values[i];
      if (v === null || isNaN(v)) continue;
      var x = px + (pw * i / (n - 1));
      var y = py + ph * (1 - v);
      d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return d;
  }

  // 生成 n 个采样点（sin 波 + 噪声），用于模拟实时曲线
  function genWave(n, amp, freq, phase, bias) {
    var arr = [];
    for (var i = 0; i < n; i++) {
      var t = i / n;
      arr.push(bias + amp * Math.sin(t * Math.PI * 2 * freq + phase) + (Math.sin(t * 37 + phase) * 0.04));
    }
    return arr;
  }

  // 柱状图：values(0..1) → 多个 rect 的 SVG 片段
  function bars(values, px, py, pw, ph, color, gap) {
    gap = gap || 2;
    var bw = (pw - gap * (values.length - 1)) / values.length;
    var out = '';
    for (var i = 0; i < values.length; i++) {
      var h = ph * values[i];
      out += '<rect x="' + (px + i * (bw + gap)).toFixed(1) + '" y="' + (py + ph - h).toFixed(1) +
             '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + color + '" fill-opacity=".75" rx="1"/>';
    }
    return out;
  }

  // 雷达图：values(0..1, n 维) → path
  function radarPath(values, cx, cy, r) {
    var n = values.length, d = '';
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / n;
      var rr = r * values[i];
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return d + 'Z';
  }

  var STAGES = {


    /* ═════════════════════════════════════════════════════════════
       ① 地质勘察 — 卫星扫描 · 化探陶土橙异常点 · CV 岩性分割
       ═════════════════════════════════════════════════════════════ */
    geology: {
      title: '地质勘察', subtitle: '遥感解译 · 化探采样 · AI 地层分割 → 地下底图', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 渐变天空 + 星空 -->' +
          '  <rect width="800" height="90" fill="url(#sky)"/>' +
          '  <circle cx="80" cy="30" r="1" fill="var(--ink-3)"/><circle cx="200" cy="15" r="1.2" fill="var(--ink-3)"/>' +
          '  <circle cx="380" cy="40" r="0.8" fill="var(--ink-3)"/><circle cx="550" cy="20" r="1" fill="var(--ink-3)"/>' +
          '  <circle cx="700" cy="35" r="1.1" fill="var(--ink-3)"/>' +
          '  <!-- 太阳（c-opt 蓝+clay 橙） -->' +
          '  <circle cx="720" cy="60" r="18" fill="none" stroke="var(--clay)" stroke-width="1" stroke-dasharray="3 2"/>' +
          '  <circle cx="720" cy="60" r="10" fill="var(--clay)" fill-opacity=".25"/>' +
          '  <!-- 山脉：三层立体（ink-3 / jade / clay） -->' +
          '  <path d="M0,290 Q80,220 160,260 T320,245 T480,270 T640,240 T800,260 L800,420 L0,420Z" fill="var(--ink-3)" fill-opacity=".25"/>' +
          '  <path d="M0,320 Q100,260 200,290 T400,280 T600,300 T800,280 L800,420 L0,420Z" fill="var(--jade)" fill-opacity=".28"/>' +
          '  <path d="M0,360 Q120,310 240,340 T480,325 T720,345 T800,335 L800,420 L0,420Z" fill="var(--clay)" fill-opacity=".15"/>' +
          '  <!-- 河流（jade 主色 + clay 岸边） -->' +
          '  <path d="M0,210 Q200,240 400,200 T800,220" fill="none" stroke="var(--jade)" stroke-width="4" stroke-opacity=".6"/>' +
          '  <path d="M0,214 Q200,244 400,204 T800,224" fill="none" stroke="var(--jade-d)" stroke-width="1.5" stroke-opacity=".5"/>' +
          '  <!-- 植被覆盖带（c-kg 黄绿点缀） -->' +
          '  <g fill="var(--c-kg)" fill-opacity=".25">' +
          '    <circle cx="130" cy="330" r="4"/><circle cx="145" cy="338" r="3"/><circle cx="155" cy="328" r="3.5"/>' +
          '    <circle cx="380" cy="315" r="4"/><circle cx="395" cy="322" r="3"/><circle cx="405" cy="310" r="3.5"/>' +
          '    <circle cx="600" cy="300" r="4"/><circle cx="615" cy="308" r="3"/><circle cx="625" cy="296" r="3.5"/>' +
          '  </g>' +
          '  <!-- 卫星（jade 绿机体 + clay 橙太阳能板 + c-opt 蓝通讯天线） -->' +
          '  <g class="geo-sat">' +
          '    <rect class="sat-body" x="70" y="50" width="35" height="12" fill="var(--ink-2)" rx="2"/>' +
          '    <rect class="sat-pan-l" x="45" y="45" width="22" height="22" fill="var(--clay)" fill-opacity=".6" stroke="var(--clay)" stroke-width="0.5"/>' +
          '    <rect class="sat-pan-r" x="110" y="45" width="22" height="22" fill="var(--clay)" fill-opacity=".6" stroke="var(--clay)" stroke-width="0.5"/>' +
          '    <circle cx="87" cy="56" r="4" fill="var(--jade)"/>' +
          '    <line x1="87" y1="44" x2="87" y2="35" stroke="var(--c-opt)" stroke-width="1"/>' +
          '    <circle cx="87" cy="35" r="2" fill="var(--c-opt)"/>' +
          '  </g>' +
          '  <!-- 化探采样点（jade 普通 + clay 异常） -->' +
          '  <g class="geo-samples">' +
          '    <g class="smpl s1"><circle cx="150" cy="290" r="5" fill="var(--jade)"/><circle r="14" fill="url(#jadePulse)"/></g>' +
          '    <g class="smpl s2"><circle cx="270" cy="330" r="5" fill="var(--clay)"/><circle r="14" fill="url(#clayPulse)"/></g>' +
          '    <g class="smpl s3"><circle cx="390" cy="285" r="5" fill="var(--jade)"/><circle r="14" fill="url(#jadePulse)"/></g>' +
          '    <g class="smpl s4"><circle cx="510" cy="310" r="5" fill="var(--clay)"/><circle r="14" fill="url(#clayPulse)"/></g>' +
          '    <g class="smpl s5"><circle cx="630" cy="275" r="5" fill="var(--jade)"/><circle r="14" fill="url(#jadePulse)"/></g>' +
          '    <g class="smpl s6"><circle cx="700" cy="320" r="5" fill="var(--clay)"/><circle r="14" fill="url(#clayPulse)"/></g>' +
          '  </g>' +
          '  <!-- AI 分割多边形（c-cv 青色 + 标注） -->' +
          '  <g class="geo-ai" opacity="0">' +
          '    <polygon points="80,340 200,310 260,360 140,380" fill="var(--c-cv)" fill-opacity=".18" stroke="var(--c-cv)" stroke-width="1.5" stroke-dasharray="4 3"/>' +
          '    <polygon points="320,300 440,275 520,320 400,340" fill="var(--c-nlp)" fill-opacity=".15" stroke="var(--c-nlp)" stroke-width="1.5" stroke-dasharray="4 3"/>' +
          '    <polygon points="560,280 680,260 740,310 620,320" fill="var(--c-cv)" fill-opacity=".2" stroke="var(--c-cv)" stroke-width="1.5" stroke-dasharray="4 3"/>' +
          '    <text x="82" y="336" font-size="9" fill="var(--c-cv)">砂岩 92%</text>' +
          '    <text x="322" y="296" font-size="9" fill="var(--c-nlp)">泥岩 88%</text>' +
          '    <text x="562" y="276" font-size="9" fill="var(--c-cv)">砂岩 85%</text>' +
          '  </g>' +
          '  <!-- 数据面板1：化探元素浓度曲线（clay 橙） -->' +
          panel(540, 110, '化探浓度曲线 (ppm)', 'var(--clay)', 52) +
          '  <path class="geo-chart1" d="" fill="none" stroke="var(--clay)" stroke-width="1.4" transform="translate(540,110)"/>' +
          '  <path class="geo-chart1b" d="" fill="none" stroke="var(--jade-d)" stroke-width="1.2" transform="translate(540,110)"/>' +
          '  <!-- 数据面板2：岩性分割置信度柱状图（c-cv 青） -->' +
          panel(540, 215, '岩性分割置信度', 'var(--c-cv)', 52) +
          '  <g class="geo-chart2" transform="translate(540,215)"></g>' +
          '  <!-- HUD 面板：jade 标题 + clay 异常 + c-cv 方法色 -->' +
          '  <g transform="translate(580,20)"><rect width="200" height="82" rx="6" fill="var(--card)" fill-opacity=".7" stroke="var(--jade)" stroke-opacity=".25"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--jade-d)" font-weight="bold">CV · 遥感解译</text>' +
          '    <line x1="10" y1="24" x2="190" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="40" font-size="9" fill="var(--ink-2)">岩性区 <tspan class="hud-g1" fill="var(--c-cv)">0 / 3</tspan></text>' +
          '    <text x="10" y="55" font-size="9" fill="var(--ink-2)">化探异常 <tspan class="hud-g2" fill="var(--clay)">0</tspan></text>' +
          '    <text x="10" y="70" font-size="9" fill="var(--ink-2)">置信度 <tspan class="hud-g3" fill="var(--jade-d)">--%</tspan></text>' +
          '    <circle cx="190" cy="16" r="5" fill="none" stroke="var(--c-cv)" stroke-width="1.2"/><text x="182" y="19" font-size="7" fill="var(--c-cv)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        var sat = $('.geo-sat', svg);
        if (step === 0) {
          var sx = lerp(40, 720, sub);
          sat.setAttribute('transform', 'translate(' + (sx - 87) + ',0)');
        } else if (step === 1) {
          $all('.smpl', svg).forEach(function (el, i) {
            var t = Math.max(0, sub * 3 - i * 0.4);
            if (t > 0) { var ring = el.querySelector('circle:nth-child(2)'); ring.setAttribute('r', (5 + t * 18).toFixed(1)); ring.setAttribute('fill-opacity', Math.max(0, 0.8 - t * 0.5).toFixed(2)); }
          });
          $('.hud-g2', svg).textContent = Math.round(sub * 6);
          // 化探浓度曲线：clay 橙主曲线 + jade 绿背景值
          var n1 = 60, cut1 = Math.floor(n1 * sub);
          var w1 = genWave(n1, 0.3, 3, 1.2, 0.5);
          var w1b = genWave(n1, 0.1, 5, 0.5, 0.3);
          $('.geo-chart1', svg).setAttribute('d', linePath(w1.slice(0, cut1 + 1), 12, 32, 206, 48));
          $('.geo-chart1b', svg).setAttribute('d', linePath(w1b.slice(0, cut1 + 1), 12, 32, 206, 48));
        } else if (step === 2) {
          $('.geo-ai', svg).setAttribute('opacity', sub.toFixed(2));
          $('.hud-g1', svg).textContent = '3 / 3';
          $('.hud-g3', svg).textContent = Math.round(70 + sub * 26);
          // 岩性分割置信度柱状图（6 个采样区）
          var conf = [0.92, 0.88, 0.85, 0.78 + sub * 0.15, 0.82 + sub * 0.1, 0.75 + sub * 0.18];
          var g2 = $('.geo-chart2', svg);
          g2.innerHTML = bars(conf, 14, 32, 202, 48, 'var(--c-cv)', 3);
        } else if (step === 3) { $('.geo-ai', svg).setAttribute('opacity', '1'); $('.hud-g3', svg).textContent = '96'; }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ② 物探 — 气枪阵列 · 多色扇形波 · clay 橙断层 · 检波器闪烁
       ═════════════════════════════════════════════════════════════ */
    seismic: {
      title: '物探', subtitle: '地震采集 · 震源激发 · 波场传播 → 地下成像', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 天空 + 海面（jade 浅绿） -->' +
          '  <rect width="800" height="120" fill="url(#sky)"/>' +
          '  <rect width="800" x="0" y="120" height="110" fill="var(--jade)" fill-opacity=".1"/>' +
          '  <!-- 波浪 -->' +
          '  <g stroke="var(--jade)" stroke-width="1" stroke-opacity=".3" fill="none">' +
          '    <path class="wv" d="M0,135 Q20,130 40,135 T80,135 T120,135 T160,135 T200,135 T240,135 T280,135 T320,135 T360,135 T400,135 T440,135 T480,135 T520,135 T560,135 T600,135 T640,135 T680,135 T720,135 T760,135 T800,135"/>' +
          '    <path d="M0,155 Q20,150 40,155 T80,155 T120,155 T160,155 T200,155 T240,155 T280,155 T320,155 T360,155 T400,155 T440,155 T480,155 T520,155 T560,155 T600,155 T640,155 T680,155 T720,155 T760,155 T800,155" fill="none"/>' +
          '  </g>' +
          '  <!-- 海底分层（4 层不同色带 + clay 断层） -->' +
          '  <rect y="230" width="800" height="50" fill="var(--c-opt)" fill-opacity=".15"/>' +
          '  <rect y="280" width="800" height="50" fill="var(--ink-3)" fill-opacity=".35"/>' +
          '  <rect y="330" width="800" height="40" fill="var(--ink-2)" fill-opacity=".25"/>' +
          '  <rect y="370" width="800" height="50" fill="var(--clay)" fill-opacity=".15"/>' +
          '  <!-- 每层纹理 -->' +
          '  <g opacity=".25" fill="none" stroke="var(--jade)" stroke-width=".5">' +
          '    <path d="M0,245 Q200,235 400,250 T800,240"/><path d="M0,295 Q200,288 400,298 T800,292"/>' +
          '  </g>' +
          '  <!-- 断层线（clay 橙，醒目） -->' +
          '  <path class="fault" d="M420,230 L460,280 L430,330 L470,420" stroke="var(--clay)" stroke-width="2.5" fill="none" stroke-dasharray="6 4"/>' +
          '  <text x="472" y="280" font-size="9" fill="var(--clay)">FAULT</text>' +
          '  <!-- 地震船（完整结构：船体 + 烟囱 + 桥楼 + 雷达 + 气枪阵列） -->' +
          '  <g transform="translate(60,75)">' +
          '    <polygon points="0,0 90,0 70,20 0,20" fill="var(--ink-2)"/>' +
          '    <rect x="30" y="-20" width="30" height="20" fill="var(--jade)" fill-opacity=".7"/>' +
          '    <rect x="40" y="-28" width="6" height="8" fill="var(--ink-2)"/>' +
          '    <circle cx="43" cy="-30" r="3" fill="var(--clay)"/>' +
          '    <line x1="15" y1="0" x2="15" y2="-25" stroke="var(--ink-2)" stroke-width="1"/>' +
          '    <circle cx="15" cy="-27" r="3" fill="var(--c-opt)"/>' +
          '    <text x="45" y="28" text-anchor="middle" font-size="8" fill="var(--ink-3)">Vessel</text>' +
          '  </g>' +
          '  <!-- 气枪阵列（3 个，jade 绿） -->' +
          '  <g class="seis-guns">' +
          '    <circle class="g g1" cx="130" cy="185" r="4" fill="var(--jade)"/>' +
          '    <circle class="g g2" cx="145" cy="185" r="4" fill="var(--jade)"/>' +
          '    <circle class="g g3" cx="160" cy="185" r="4" fill="var(--jade)"/>' +
          '  </g>' +
          '  <!-- 气泡脉冲（clay 橙 + jade 绿双层） -->' +
          '  <g class="seis-bubbles">' +
          '    <circle class="bbl b1" cx="145" cy="190" r="3" fill="var(--clay)" fill-opacity=".9"/>' +
          '    <circle class="bbl b2" cx="145" cy="190" r="3" fill="none" stroke="var(--jade)" stroke-width="1.5"/>' +
          '    <circle class="bbl b3" cx="145" cy="190" r="3" fill="none" stroke="var(--clay)" stroke-width="1"/>' +
          '  </g>' +
          '  <!-- 扇形射线（每条不同色：c-cv / c-ts / c-opt / c-kg / clay / jade） -->' +
          '  <g class="seis-rays">' +
          '    <path class="ray r1" d="M145,190 L145,190" stroke="var(--c-cv)" stroke-width="1.5"/>' +
          '    <path class="ray r2" d="M145,190 L145,190" stroke="var(--c-ts)" stroke-width="1.5"/>' +
          '    <path class="ray r3" d="M145,190 L145,190" stroke="var(--c-opt)" stroke-width="1.5"/>' +
          '    <path class="ray r4" d="M145,190 L145,190" stroke="var(--c-kg)" stroke-width="1.5"/>' +
          '    <path class="ray r5" d="M145,190 L145,190" stroke="var(--clay)" stroke-width="1.5"/>' +
          '    <path class="ray r6" d="M145,190 L145,190" stroke="var(--jade-d)" stroke-width="1.5"/>' +
          '  </g>' +
          '  <!-- 检波器拖缆（5 个） -->' +
          '  <line x1="200" y1="185" x2="780" y2="185" stroke="var(--ink-2)" stroke-width="1.2" stroke-opacity=".7"/>' +
          '  <g>' +
          '    <g class="gh g1"><rect x="230" y="180" width="8" height="12" fill="var(--c-cv)"/><rect x="232" y="182" width="4" height="4" fill="var(--clay)"/></g>' +
          '    <g class="gh g2"><rect x="340" y="180" width="8" height="12" fill="var(--c-cv)" fill-opacity=".3"/><rect x="342" y="182" width="4" height="4" fill="none"/></g>' +
          '    <g class="gh g3"><rect x="450" y="180" width="8" height="12" fill="var(--c-cv)" fill-opacity=".3"/><rect x="452" y="182" width="4" height="4" fill="none"/></g>' +
          '    <g class="gh g4"><rect x="560" y="180" width="8" height="12" fill="var(--c-cv)" fill-opacity=".3"/><rect x="562" y="182" width="4" height="4" fill="none"/></g>' +
          '    <g class="gh g5"><rect x="670" y="180" width="8" height="12" fill="var(--c-cv)" fill-opacity=".3"/><rect x="672" y="182" width="4" height="4" fill="none"/></g>' +
          '  </g>' +
          '  <!-- 数据面板1：地震波振幅衰减曲线（c-cv 青） -->' +
          panel(550, 120, '地震波振幅衰减', 'var(--c-cv)', 52) +
          '  <path class="sh-chart1" d="" fill="none" stroke="var(--c-cv)" stroke-width="1.4" transform="translate(550,120)"/>' +
          '  <path class="sh-chart1b" d="" fill="none" stroke="var(--clay)" stroke-width="1.2" transform="translate(550,120)"/>' +
          '  <!-- 数据面板2：检波器信号强度（c-ts 橙） -->' +
          panel(550, 225, '检波器信号强度', 'var(--c-ts)', 52) +
          '  <g class="sh-chart2" transform="translate(550,225)"></g>' +
          '  <!-- HUD：c-ts 时序面板 + clay 断层置信度 -->' +
          '  <g transform="translate(560,20)"><rect width="220" height="92" rx="6" fill="var(--card)" fill-opacity=".7" stroke="var(--c-ts)" stroke-opacity=".25"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-ts)" font-weight="bold">CV · 断层解释</text>' +
          '    <line x1="10" y1="24" x2="210" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">炮次 <tspan class="sh-s1" fill="var(--jade-d)">0 / 120</tspan></text>' +
          '    <text x="10" y="58" font-size="9" fill="var(--ink-2)">检波器 <tspan class="sh-s2" fill="var(--c-cv)">0 激活</tspan></text>' +
          '    <text x="10" y="74" font-size="9" fill="var(--ink-2)">AI 断层 <tspan class="sh-s3" fill="var(--clay)">--</tspan></text>' +
          '    <circle cx="210" cy="16" r="5" fill="none" stroke="var(--c-ts)" stroke-width="1.2"/><text x="202" y="19" font-size="7" fill="var(--c-ts)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          var off = (-sub * 20); $('.wv', svg).setAttribute('stroke-dashoffset', off.toFixed(1));
          ['b1', 'b2', 'b3'].forEach(function (cls, i) {
            var t = Math.max(0, sub * 1.5 - i * 0.15); if (t > 0) { var el = $('.' + cls, svg); el.setAttribute('r', (3 + t * 25).toFixed(1)); }
          });
        } else if (step === 1) {
          var ang = Math.PI * 0.6, baseAng = Math.PI / 2 + ang / 2;
          [0, 1, 2, 3, 4, 5].forEach(function (i) {
            var a = baseAng - (ang / 5) * i, L = sub * 300;
            var r = $('.r' + (i + 1), svg); r.setAttribute('d', 'M145,190 L' + (145 + Math.cos(a) * L).toFixed(1) + ',' + (190 + Math.sin(a) * L).toFixed(1));
            r.setAttribute('stroke-opacity', Math.max(0, 0.85 - sub * 0.6).toFixed(2));
          });
          $all('.gh', svg).forEach(function (el, i) {
            var light = sub > i * 0.2;
            el.querySelector('rect:first-child').setAttribute('fill-opacity', light ? '1' : '.3');
            var lamp = el.querySelector('rect:nth-child(2)'); if (lamp) lamp.setAttribute('fill', light ? 'var(--clay)' : 'none');
          });
          $('.sh-s2', svg).textContent = Math.round(sub * 5) + ' 激活';
          // 地震波振幅衰减曲线：c-cv 青直达波 + clay 橙反射波
          var ns = 60, cuts = Math.floor(ns * sub);
          var decay = genWave(ns, 0.4, 2, 0, 0.7).map(function (v, i) { return v * (1 - i / ns * 0.6); });
          var reflect = genWave(ns, 0.25, 4, 2, 0.4).map(function (v, i) { return v * (i / ns); });
          $('.sh-chart1', svg).setAttribute('d', linePath(decay.slice(0, cuts + 1), 12, 32, 206, 48));
          $('.sh-chart1b', svg).setAttribute('d', linePath(reflect.slice(0, cuts + 1), 12, 32, 206, 48));
          // 检波器信号柱状图
          var sig = [0.9, 0.7, 0.5, 0.35, 0.2].map(function (v, i) { return sub > i * 0.2 ? v : 0; });
          $('.sh-chart2', svg).innerHTML = bars(sig, 14, 32, 202, 48, 'var(--c-ts)', 4);
        } else if (step === 2) {
          $('.fault', svg).setAttribute('stroke-opacity', sub.toFixed(2)); $('.fault', svg).setAttribute('filter', sub > 0.5 ? 'url(#stgGlow)' : '');
          $('.sh-s1', svg).textContent = '120 / 120';
          $('.sh-s3', svg).textContent = Math.round(60 + sub * 30) + '%';
          var sig2 = [0.9, 0.7, 0.5, 0.35, 0.2];
          $('.sh-chart2', svg).innerHTML = bars(sig2, 14, 32, 202, 48, 'var(--c-ts)', 4);
        } else if (step === 3) { $('.sh-s3', svg).textContent = '90%'; $('.fault', svg).setAttribute('stroke-opacity', '1'); }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ③ 钻井 — 完整井架桁架 + clay 泥浆管线 + 钻头 + OPT 面板
       ═════════════════════════════════════════════════════════════ */
    drilling: {
      title: '钻井', subtitle: '旋转钻进 · 钻屑循环上返 · 实时参数监测', duration: 11000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 地面 + 4 层地层（jade + clay 油气层高亮） -->' +
          '  <rect y="140" width="800" height="280" fill="url(#earthG)" fill-opacity=".5"/>' +
          '  <line x1="0" y1="140" x2="800" y2="140" stroke="var(--ink-3)" stroke-opacity=".5"/>' +
          '  <rect x="0" y="142" width="800" height="70" fill="var(--ink-3)" fill-opacity=".25"/>' +
          '  <rect x="0" y="212" width="800" height="80" fill="var(--clay)" fill-opacity=".18"/><text x="10" y="232" font-size="8" fill="var(--clay)">⚠ 油气层</text>' +
          '  <rect x="0" y="292" width="800" height="60" fill="var(--ink-2)" fill-opacity=".2"/>' +
          '  <rect x="0" y="352" width="800" height="68" fill="var(--ink-2)" fill-opacity=".3"/>' +
          '  <!-- 油气层气泡（c-cv 青色） -->' +
          '  <g class="dl-gas">' +
          '    <circle class="gs g1" cx="200" cy="245" r="2.5" fill="var(--c-cv)" fill-opacity=".5"/>' +
          '    <circle class="gs g2" cx="320" cy="255" r="2" fill="var(--c-cv)" fill-opacity=".5"/>' +
          '    <circle class="gs g3" cx="550" cy="240" r="3" fill="var(--c-cv)" fill-opacity=".5"/>' +
          '    <circle class="gs g4" cx="680" cy="250" r="2.5" fill="var(--c-cv)" fill-opacity=".5"/>' +
          '  </g>' +
          '  <!-- 井眼 + 套管 -->' +
          '  <rect x="485" y="140" width="30" height="280" fill="var(--ink-2)" fill-opacity=".25"/>' +
          '  <!-- 完整井架 Derrick（4 面 X bracing + 天车 + 游车） -->' +
          '  <g transform="translate(500,0)">' +
          '    <!-- 主柱 -->' +
          '    <line x1="-38" y1="0" x2="-28" y2="130" stroke="var(--ink-2)" stroke-width="3"/>' +
          '    <line x1="38" y1="0" x2="28" y2="130" stroke="var(--ink-2)" stroke-width="3"/>' +
          '    <line x1="-28" y1="0" x2="-38" y2="130" stroke="var(--ink-2)" stroke-width="1.2"/>' +
          '    <line x1="28" y1="0" x2="38" y2="130" stroke="var(--ink-2)" stroke-width="1.2"/>' +
          '    <!-- 水平横梁 -->' +
          '    <line x1="-34" y1="30" x2="34" y2="30" stroke="var(--ink-2)" stroke-width="1.5"/>' +
          '    <line x1="-32" y1="65" x2="32" y2="65" stroke="var(--ink-2)" stroke-width="1.5"/>' +
          '    <line x1="-30" y1="100" x2="30" y2="100" stroke="var(--ink-2)" stroke-width="1.5"/>' +
          '    <!-- 斜撑 X -->' +
          '    <line x1="-34" y1="30" x2="32" y2="65" stroke="var(--jade)" stroke-width="1" stroke-opacity=".5"/>' +
          '    <line x1="32" y1="30" x2="-34" y2="65" stroke="var(--jade)" stroke-width="1" stroke-opacity=".5"/>' +
          '    <line x1="-32" y1="65" x2="30" y2="100" stroke="var(--jade)" stroke-width="1" stroke-opacity=".5"/>' +
          '    <line x1="30" y1="65" x2="-32" y2="100" stroke="var(--jade)" stroke-width="1" stroke-opacity=".5"/>' +
          '    <!-- 天车 + 游车 -->' +
          '    <rect x="-12" y="-4" width="24" height="8" fill="var(--jade)" fill-opacity=".7"/>' +
          '    <line x1="-6" y1="4" x2="-6" y2="30" stroke="var(--ink-2)" stroke-width="1"/>' +
          '    <line x1="6" y1="4" x2="6" y2="30" stroke="var(--ink-2)" stroke-width="1"/>' +
          '    <rect x="-8" y="28" width="16" height="6" fill="var(--ink-2)"/>' +
          '  </g>' +
          '  <!-- 转盘（带旋转标记） -->' +
          '  <g class="dl-rot" transform="translate(500,145)">' +
          '    <circle cx="0" cy="0" r="16" fill="var(--jade)" fill-opacity=".3" stroke="var(--jade)" stroke-width="1.5"/>' +
          '    <circle cx="0" cy="0" r="8" fill="var(--ink-2)"/>' +
          '    <line class="rot-l1" x1="-6" y1="0" x2="6" y2="0" stroke="var(--clay)" stroke-width="2"/>' +
          '    <line class="rot-l2" x1="0" y1="-6" x2="0" y2="6" stroke="var(--clay)" stroke-width="2"/>' +
          '  </g>' +
          '  <!-- 钻杆 + 钻头 -->' +
          '  <g class="dl-pipe"><rect x="496" y="145" width="8" height="0" fill="var(--ink-2)"/></g>' +
          '  <g class="dl-bit"><polygon points="494,145 506,145 500,158" fill="var(--clay)"/><rect x="496" y="142" width="8" height="3" fill="var(--ink-2)"/></g>' +
          '  <!-- 泥浆罐（clay 陶土橙，表示泥浆） -->' +
          '  <g transform="translate(60,100)">' +
          '    <rect width="70" height="45" fill="var(--ink-2)" fill-opacity=".7" rx="2"/>' +
          '    <rect x="6" y="8" width="58" height="14" fill="var(--clay)" fill-opacity=".5"/>' +
          '    <rect x="6" y="26" width="58" height="14" fill="var(--clay)" fill-opacity=".35"/>' +
          '    <text x="35" y="62" text-anchor="middle" font-size="8" fill="var(--clay)">Mud Tank</text>' +
          '  </g>' +
          '  <!-- 泥浆管线（clay 橙流动粒子） -->' +
          '  <path d="M130,120 Q200,120 250,130 Q380,145 490,145" fill="none" stroke="var(--clay)" stroke-width="2.5" stroke-opacity=".5"/>' +
          '  <g class="dl-mudflow">' +
          '    <circle class="mf mf1" cx="160" cy="123" r="2" fill="var(--clay)"/>' +
          '    <circle class="mf mf2" cx="250" cy="130" r="2" fill="var(--clay)"/>' +
          '    <circle class="mf mf3" cx="380" cy="142" r="2" fill="var(--clay)"/>' +
          '  </g>' +
          '  <!-- 振动筛（下方，jade 绿 + clay 岩屑） -->' +
          '  <g transform="translate(620,320)"><rect width="120" height="60" fill="var(--ink-2)" fill-opacity=".5"/>' +
          '    <rect x="6" y="6" width="108" height="30" fill="none" stroke="var(--jade)" stroke-width="1"/>' +
          '    <text x="60" y="54" text-anchor="middle" font-size="8" fill="var(--jade)">Shale Shaker</text>' +
          '    <g class="dl-cuttings">' +
          '      <circle class="cut c1" cx="20" cy="15" r="1.5" fill="var(--clay)"/>' +
          '      <circle class="cut c2" cx="45" cy="20" r="1.5" fill="var(--clay)"/>' +
          '      <circle class="cut c3" cx="70" cy="12" r="1.5" fill="var(--clay)"/>' +
          '      <circle class="cut c4" cx="95" cy="22" r="1.5" fill="var(--clay)"/>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 数据面板1：ROP 机械钻速曲线（clay 橙） -->' +
          panel(300, 155, 'ROP 机械钻速 (m/h)', 'var(--clay)', 52) +
          '  <path class="dl-chart1" d="" fill="none" stroke="var(--clay)" stroke-width="1.4" transform="translate(300,155)"/>' +
          '  <!-- 数据面板2：钻压 WOB + 扭矩 Torque 双曲线 -->' +
          panel(300, 260, 'WOB & Torque', 'var(--c-ts)', 52) +
          '  <path class="dl-chart2" d="" fill="none" stroke="var(--c-ts)" stroke-width="1.4" transform="translate(300,260)"/>' +
          '  <path class="dl-chart2b" d="" fill="none" stroke="var(--c-kg)" stroke-width="1.2" transform="translate(300,260)"/>' +
          '  <!-- HUD：OPT 面板（蓝）+ 多色参数 -->' +
          '  <g transform="translate(320,30)"><rect width="170" height="115" rx="6" fill="var(--card)" fill-opacity=".7" stroke="var(--c-opt)" stroke-opacity=".3"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-opt)" font-weight="bold">OPT · Drilling Params</text>' +
          '    <line x1="10" y1="24" x2="160" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">Depth</text><text class="dl-p1" x="160" y="42" font-size="9" text-anchor="end" fill="var(--jade-d)">0 m</text>' +
          '    <text x="10" y="58" font-size="9" fill="var(--ink-2)">ROP</text><text class="dl-p2" x="160" y="58" font-size="9" text-anchor="end" fill="var(--clay)">0 m/h</text>' +
          '    <text x="10" y="74" font-size="9" fill="var(--ink-2)">WOB</text><text class="dl-p3" x="160" y="74" font-size="9" text-anchor="end" fill="var(--c-ts)">0 kN</text>' +
          '    <text x="10" y="90" font-size="9" fill="var(--ink-2)">Torque</text><text class="dl-p4" x="160" y="90" font-size="9" text-anchor="end" fill="var(--c-kg)">0 kN·m</text>' +
          '    <circle cx="160" cy="16" r="5" fill="none" stroke="var(--c-opt)" stroke-width="1.2"/><text x="152" y="19" font-size="7" fill="var(--c-opt)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          $('.rot-l1', svg).setAttribute('transform', 'rotate(' + (sub * 360) + ')');
          $('.rot-l2', svg).setAttribute('transform', 'rotate(' + (sub * 360) + ')');
        } else if (step === 1) {
          var h = sub * 200;
          $('.dl-pipe rect', svg).setAttribute('height', h.toFixed(1));
          $('.dl-bit', svg).setAttribute('transform', 'translate(0,' + h.toFixed(1) + ')');
          $('.dl-p1', svg).textContent = Math.round(h * 5);
          $('.dl-p2', svg).textContent = (10 + sub * 8).toFixed(1) + ' m/h';
          $('.dl-p3', svg).textContent = Math.round(80 + sub * 40);
          // ROP 曲线 + WOB/Torque 双曲线
          var nd = 50, cutd = Math.floor(nd * sub);
          var rop = genWave(nd, 0.2, 3, 0.5, 0.5);
          var wob = genWave(nd, 0.15, 2, 1, 0.6);
          var tor = genWave(nd, 0.12, 4, 2, 0.4);
          $('.dl-chart1', svg).setAttribute('d', linePath(rop.slice(0, cutd + 1), 12, 32, 206, 48));
          $('.dl-chart2', svg).setAttribute('d', linePath(wob.slice(0, cutd + 1), 12, 32, 206, 48));
          $('.dl-chart2b', svg).setAttribute('d', linePath(tor.slice(0, cutd + 1), 12, 32, 206, 48));
        } else if (step === 2) {
          $('.dl-pipe rect', svg).setAttribute('height', '200');
          $('.dl-bit', svg).setAttribute('transform', 'translate(0,200)');
          $('.dl-p1', svg).textContent = '1000'; $('.dl-p2', svg).textContent = '15.6 m/h';
          $('.dl-p3', svg).textContent = '112'; $('.dl-p4', svg).textContent = '8.4';
          // 持续绘制参数曲线
          var rop2 = genWave(50, 0.2, 3, 0.5, 0.55);
          var wob2 = genWave(50, 0.15, 2, 1, 0.62);
          var tor2 = genWave(50, 0.12, 4, 2, 0.42);
          $('.dl-chart1', svg).setAttribute('d', linePath(rop2, 12, 32, 206, 48));
          $('.dl-chart2', svg).setAttribute('d', linePath(wob2, 12, 32, 206, 48));
          $('.dl-chart2b', svg).setAttribute('d', linePath(tor2, 12, 32, 206, 48));
          $all('.cut', svg).forEach(function (el, i) {
            // 用正弦替代随机数，避免逐帧闪烁造成的跳动感
            var t = 0.5 + 0.5 * Math.sin(sub * Math.PI * 6 + i * 1.7);
            el.setAttribute('opacity', (0.35 + t * 0.65).toFixed(2));
            el.setAttribute('transform', 'translate(0,' + (-sub * 30 - i * 3).toFixed(1) + ')');
          });
        } else if (step === 3) {
          $('.rot-l1', svg).setAttribute('transform', 'rotate(' + (sub * 720) + ')');
          $('.rot-l2', svg).setAttribute('transform', 'rotate(' + (sub * 720) + ')');
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ④ 录井 — 振动筛 + clay 岩屑 + CV 显微识别 + NLP 报告
       ═════════════════════════════════════════════════════════════ */
    mudlogging: {
      title: '录井', subtitle: '岩屑采集 · 振动筛分选 · AI 岩性识别与报告', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 地面 + 背景 -->' +
          '  <rect y="290" width="800" height="130" fill="var(--jade)" fill-opacity=".05"/>' +
          '  <!-- 振动筛（jade 绿框 + 网格 + clay 岩屑槽） -->' +
          '  <g class="ml-shaker" transform="translate(80,160)">' +
          '    <rect width="200" height="130" fill="var(--ink-2)" fill-opacity=".45" rx="4"/>' +
          '    <!-- 筛面网格 -->' +
          '    <rect x="10" y="10" width="180" height="80" fill="var(--ink-3)" fill-opacity=".12" stroke="var(--jade)" stroke-width="1.2"/>' +
          '    <g stroke="var(--jade)" stroke-opacity=".3" stroke-width=".5">' +
          '      <line x1="30" y1="10" x2="30" y2="90"/><line x1="50" y1="10" x2="50" y2="90"/><line x1="70" y1="10" x2="70" y2="90"/>' +
          '      <line x1="90" y1="10" x2="90" y2="90"/><line x1="110" y1="10" x2="110" y2="90"/><line x1="130" y1="10" x2="130" y2="90"/>' +
          '      <line x1="150" y1="10" x2="150" y2="90"/><line x1="170" y1="10" x2="170" y2="90"/>' +
          '    </g>' +
          '    <!-- 岩屑槽（clay 橙） -->' +
          '    <rect x="10" y="100" width="180" height="24" fill="var(--clay)" fill-opacity=".25" stroke="var(--clay)" stroke-width="0.5"/>' +
          '    <text x="100" y="120" text-anchor="middle" font-size="9" fill="var(--clay)">Cuttings Trough</text>' +
          '  </g>' +
          '  <!-- 泥浆回流管线（clay 陶土橙，表示泥浆流体） -->' +
          '  <path d="M480,120 Q480,180 280,180" fill="none" stroke="var(--clay)" stroke-width="3" stroke-opacity=".55"/>' +
          '  <path class="ml-mudflow" d="M480,120 Q480,180 280,180" fill="none" stroke="var(--clay)" stroke-width="1.5" stroke-dasharray="6 3"/>' +
          '  <!-- 岩屑（clay + brown 混合，落在筛面上） -->' +
          '  <g class="ml-cuttings">' +
          '    <rect x="105" y="172" width="5" height="4" fill="var(--clay)" transform="rotate(20 107 174)"/>' +
          '    <rect x="130" y="180" width="4" height="3" fill="#8b5a20" transform="rotate(-15 132 181)"/>' +
          '    <rect x="155" y="175" width="5" height="4" fill="var(--clay)" transform="rotate(30 157 176)"/>' +
          '    <rect x="180" y="182" width="4" height="3" fill="#8b5a20" transform="rotate(-30 182 183)"/>' +
          '    <rect x="200" y="178" width="5" height="4" fill="var(--clay)" transform="rotate(10 202 179)"/>' +
          '  </g>' +
          '  <!-- AI 显微圆形视图（c-cv 青色框，砂岩岩屑 + AI 分割框） -->' +
          '  <g transform="translate(340,90)"><circle cx="80" cy="80" r="75" fill="var(--paper)" stroke="var(--c-cv)" stroke-width="2"/>' +
          '    <g class="ml-rocks" opacity="0">' +
          '      <rect x="45" y="50" width="26" height="18" fill="#b87028" fill-opacity=".85" transform="rotate(15 58 59)"/>' +
          '      <rect x="92" y="44" width="22" height="16" fill="#a06020" fill-opacity=".85" transform="rotate(-20 103 52)"/>' +
          '      <rect x="58" y="98" width="28" height="20" fill="#c08030" fill-opacity=".85" transform="rotate(25 72 108)"/>' +
          '      <rect x="100" y="96" width="20" height="14" fill="#905818" fill-opacity=".85" transform="rotate(-10 110 103)"/>' +
          '      <rect class="ai-box b1" x="43" y="48" width="30" height="22" fill="none" stroke="var(--c-cv)" stroke-width="1.5" stroke-dasharray="3 2" opacity="0"/>' +
          '      <rect class="ai-box b2" x="56" y="94" width="34" height="26" fill="none" stroke="var(--c-nlp)" stroke-width="1.5" stroke-dasharray="3 2" opacity="0"/>' +
          '    </g>' +
          '    <text x="80" y="168" text-anchor="middle" font-size="9" fill="var(--c-cv)">CV · 岩屑显微识别</text>' +
          '  </g>' +
          '  <!-- 数据面板1：气测全烃曲线（c-cv 青） -->' +
          panel(580, 20, '气测全烃 (Total HC)', 'var(--c-cv)', 52) +
          '  <path class="ml-chart1" d="" fill="none" stroke="var(--c-cv)" stroke-width="1.4" transform="translate(580,20)"/>' +
          '  <path class="ml-chart1b" d="" fill="none" stroke="var(--clay)" stroke-width="1.2" transform="translate(580,20)"/>' +
          '  <!-- 数据面板2：岩屑粒度分布（c-ts 橙） -->' +
          panel(580, 125, '岩屑粒度分布', 'var(--c-ts)', 52) +
          '  <g class="ml-chart2" transform="translate(580,125)"></g>' +
          '  <!-- NLP 报告面板（c-nlp 紫色） + 多色字段 -->' +
          '  <g transform="translate(580,250)"><rect width="200" height="165" rx="6" fill="var(--card)" fill-opacity=".7" stroke="var(--c-nlp)" stroke-opacity=".3"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-nlp)" font-weight="bold">NLP · 录井报告</text>' +
          '    <line x1="10" y1="24" x2="190" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text class="ml-rpt r1" x="10" y="42" font-size="9" fill="var(--ink-3)">岩性： --</text>' +
          '    <text class="ml-rpt r2" x="10" y="58" font-size="9" fill="var(--ink-3)">颜色： --</text>' +
          '    <text class="ml-rpt r3" x="10" y="74" font-size="9" fill="var(--ink-3)">粒度： --</text>' +
          '    <text class="ml-rpt r4" x="10" y="90" font-size="9" fill="var(--ink-3)">气测： --</text>' +
          '    <text class="ml-rpt r5" x="10" y="115" font-size="8" fill="var(--c-nlp)" opacity="0">✓ AI · 自动生成完成</text>' +
          '    <circle cx="190" cy="16" r="5" fill="none" stroke="var(--c-nlp)" stroke-width="1.2"/><text x="182" y="19" font-size="7" fill="var(--c-nlp)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) { $('.ml-mudflow', svg).setAttribute('stroke-dashoffset', (-sub * 40).toFixed(1)); }
        else if (step === 1) {
          $('.ml-shaker', svg).setAttribute('transform', 'translate(' + (80 + Math.sin(sub * Math.PI * 10) * 2).toFixed(1) + ',160)');
          $all('.ml-cuttings rect', svg).forEach(function (el, i) { el.setAttribute('opacity', Math.min(1, sub * 3 - i * 0.3).toFixed(2)); });
          // 气测全烃曲线：背景值低 + 异常峰
          var nm = 60, cutm = Math.floor(nm * sub);
          var hc = genWave(nm, 0.15, 4, 0, 0.2);
          hc[25] = 0.85; hc[26] = 0.9; // 异常峰
          var hc2 = genWave(nm, 0.1, 6, 1, 0.15);
          $('.ml-chart1', svg).setAttribute('d', linePath(hc.slice(0, cutm + 1), 12, 32, 206, 48));
          $('.ml-chart1b', svg).setAttribute('d', linePath(hc2.slice(0, cutm + 1), 12, 32, 206, 48));
        } else if (step === 2) {
          $('.ml-rocks', svg).setAttribute('opacity', sub.toFixed(2));
          $all('.ai-box', svg).forEach(function (el, i) { el.setAttribute('opacity', Math.max(0, sub * 1.5 - i).toFixed(2)); });
          $('.ml-rpt.r1', svg).textContent = '岩性： 砂岩 (92%)'; $('.ml-rpt.r1', svg).setAttribute('fill', 'var(--c-cv)');
          $('.ml-rpt.r2', svg).textContent = '颜色： 浅灰 (87%)'; $('.ml-rpt.r2', svg).setAttribute('fill', 'var(--clay)');
          // 岩屑粒度分布柱状图（细粒为主）
          var grain = [0.1, 0.25, 0.55, 0.8, 0.6, 0.35, 0.15];
          $('.ml-chart2', svg).innerHTML = bars(grain, 14, 32, 202, 48, 'var(--c-ts)', 3);
        } else if (step === 3) {
          $('.ml-rpt.r3', svg).textContent = '粒度： 细粒 0.12mm'; $('.ml-rpt.r3', svg).setAttribute('fill', 'var(--c-ts)');
          $('.ml-rpt.r4', svg).textContent = '气测： 0.8% (背景)'; $('.ml-rpt.r4', svg).setAttribute('fill', 'var(--jade-d)');
          $('.ml-rpt.r5', svg).setAttribute('opacity', sub.toFixed(2));
          var grain2 = [0.1, 0.25, 0.55, 0.8, 0.6, 0.35, 0.15];
          $('.ml-chart2', svg).innerHTML = bars(grain2, 14, 32, 202, 48, 'var(--c-ts)', 3);
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑤ 测井 — 仪器串 + 4 色曲线 + AI 分层 + OPT 面板
       ═════════════════════════════════════════════════════════════ */
    welllog: {
      title: '测井', subtitle: '井筒传感器 · 多曲线采集 · AI 地层识别与储层评价', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 背景 + 井筒骨架 -->' +
          '  <rect width="800" height="420" fill="var(--ink-1)" fill-opacity=".3"/>' +
          '  <!-- 左侧深度尺 -->' +
          '  <g font-family="monospace" font-size="8" fill="var(--ink-3)" text-anchor="end">' +
          '    <text x="28" y="30">0 m</text><text x="28" y="100">200</text><text x="28" y="170">400</text>' +
          '    <text x="28" y="240">600</text><text x="28" y="310">800</text><text x="28" y="390">1000</text>' +
          '    <g stroke="var(--ink-3)" stroke-width=".7" opacity=".5">' +
          '      <line x1="32" y1="30" x2="70" y2="30"/><line x1="32" y1="100" x2="60" y2="100"/>' +
          '      <line x1="32" y1="170" x2="60" y2="170"/><line x1="32" y1="240" x2="60" y2="240"/>' +
          '      <line x1="32" y1="310" x2="60" y2="310"/><line x1="32" y1="390" x2="60" y2="390"/>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 井眼（clay 橙柱，带阴影） -->' +
          '  <rect x="80" y="20" width="50" height="390" fill="var(--clay)" fill-opacity=".08" stroke="var(--clay)" stroke-width="0.5"/>' +
          '  <rect x="78" y="20" width="2" height="390" fill="var(--clay)" fill-opacity=".4"/>' +
          '  <rect x="130" y="20" width="2" height="390" fill="var(--clay)" fill-opacity=".4"/>' +
          '  <!-- 仪器串（jade 绿，完整结构） -->' +
          '  <g class="wl-tool">' +
          '    <rect x="88" y="20" width="34" height="28" fill="var(--jade)" fill-opacity=".65" rx="2"/>' +
          '    <circle cx="105" cy="30" r="3" fill="var(--clay)"/>' +
          '    <rect x="92" y="48" width="26" height="16" fill="var(--ink-2)" fill-opacity=".7"/>' +
          '    <rect x="88" y="64" width="34" height="40" fill="var(--jade)" fill-opacity=".5" rx="2"/>' +
          '    <rect x="90" y="104" width="30" height="6" fill="var(--clay)" fill-opacity=".4"/>' +
          '    <rect x="88" y="110" width="34" height="30" fill="var(--c-opt)" fill-opacity=".4" rx="2"/>' +
          '  </g>' +
          '  <!-- 四个 Track（测井曲线道） -->' +
          '  <!-- Track1: GR 自然伽马 (jade-d 亮绿) -->' +
          '  <rect x="150" y="20" width="140" height="390" fill="none" stroke="var(--ink-3)" stroke-width=".5"/>' +
          '  <text x="220" y="18" font-size="9" fill="var(--jade-d)" text-anchor="middle">GR</text>' +
          '  <g class="wl-gr" fill="var(--c-nlp)" fill-opacity=".22">' +
          '    <path class="gr-fill" d=""/>' +
          '  </g>' +
          '  <path class="gr-curve" d="" fill="none" stroke="var(--jade-d)" stroke-width="1.4"/>' +
          '  <!-- Track2: DT 声波 (clay 橙) -->' +
          '  <rect x="295" y="20" width="140" height="390" fill="none" stroke="var(--ink-3)" stroke-width=".5"/>' +
          '  <text x="365" y="18" font-size="9" fill="var(--clay)" text-anchor="middle">DT</text>' +
          '  <path class="dt-curve" d="" fill="none" stroke="var(--clay)" stroke-width="1.4"/>' +
          '  <!-- Track3: SP 自然电位 (c-opt 蓝) -->' +
          '  <rect x="440" y="20" width="140" height="390" fill="none" stroke="var(--ink-3)" stroke-width=".5"/>' +
          '  <text x="510" y="18" font-size="9" fill="var(--c-opt)" text-anchor="middle">SP</text>' +
          '  <path class="sp-curve" d="" fill="none" stroke="var(--c-opt)" stroke-width="1.4"/>' +
          '  <!-- Track4: RHOB 密度 (c-kg 黄绿 + clay 油气层高亮) -->' +
          '  <rect x="585" y="20" width="140" height="390" fill="none" stroke="var(--ink-3)" stroke-width=".5"/>' +
          '  <text x="655" y="18" font-size="9" fill="var(--c-kg)" text-anchor="middle">RHOB</text>' +
          '  <path class="rhob-curve" d="" fill="none" stroke="var(--c-kg)" stroke-width="1.4"/>' +
          '  <!-- AI 分层虚线 (c-nlp 紫) -->' +
          '  <g class="wl-ai" opacity="0">' +
          '    <line x1="80" y1="160" x2="725" y2="160" stroke="var(--c-nlp)" stroke-width="1" stroke-dasharray="5 3"/>' +
          '    <line x1="80" y1="235" x2="725" y2="235" stroke="var(--c-nlp)" stroke-width="1" stroke-dasharray="5 3"/>' +
          '    <line x1="80" y1="320" x2="725" y2="320" stroke="var(--c-nlp)" stroke-width="1" stroke-dasharray="5 3"/>' +
          '    <text x="730" y="163" font-size="8" fill="var(--c-nlp)">砂岩 88%</text>' +
          '    <text x="730" y="238" font-size="8" fill="var(--c-nlp)">泥岩 94%</text>' +
          '    <text x="730" y="323" font-size="8" fill="var(--c-nlp)">粉砂 82%</text>' +
          '  </g>' +
          '  <!-- 油气层高亮带 (clay 橙) -->' +
          '  <g class="wl-pay" opacity="0">' +
          '    <rect x="80" y="250" width="645" height="30" fill="var(--clay)" fill-opacity=".18"/>' +
          '    <text x="730" y="268" font-size="8" fill="var(--clay)">⌁ PAY ZONE</text>' +
          '  </g>' +
          '  <!-- 数据面板1：储层参数雷达图（c-nlp 紫） -->' +
          panel(595, 20, '储层参数雷达', 'var(--c-nlp)', 72) +
          '  <g class="wl-chart1" transform="translate(595,20)"></g>' +
          '  <!-- 数据面板2：测井响应统计（c-cv 青） -->' +
          panel(595, 145, '测井响应统计', 'var(--c-cv)', 52) +
          '  <g class="wl-chart2" transform="translate(595,145)"></g>' +
          '  <!-- HUD：OPT 蓝面板 -->' +
          '  <g transform="translate(595,340)"><rect width="195" height="70" rx="6" fill="var(--card)" fill-opacity=".75" stroke="var(--c-opt)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-opt)" font-weight="bold">OPT · Logging Summary</text>' +
          '    <line x1="10" y1="24" x2="185" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">AI 分层 <tspan class="wl-h1" fill="var(--c-nlp)">--</tspan></text>' +
          '    <text x="10" y="58" font-size="9" fill="var(--ink-2)">储层 <tspan class="wl-h2" fill="var(--clay)">--</tspan> · 孔隙度 <tspan class="wl-h3" fill="var(--jade-d)">--</tspan></text>' +
          '    <circle cx="185" cy="16" r="5" fill="none" stroke="var(--c-opt)" stroke-width="1.2"/><text x="177" y="19" font-size="7" fill="var(--c-opt)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          $('.wl-tool', svg).setAttribute('transform', 'translate(0,' + (sub * 250).toFixed(1) + ')');
        } else if (step === 1) {
          // 生成 4 条模拟测井曲线
          var pts = 40, h = 380, y0 = 20;
          function curve(fn, baseX) {
            var d = '';
            for (var i = 0; i <= pts; i++) {
              var y = y0 + (h * i / pts);
              var v = fn(i / pts);
              var x = baseX + v * 110 + 15;
              d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            }
            return d;
          }
          $('.gr-curve', svg).setAttribute('d', curve(function (t) { return lerp(0.2, 0.8, Math.abs(Math.sin(t * Math.PI * 3))); }, 150));
          $('.dt-curve', svg).setAttribute('d', curve(function (t) { return lerp(0.3, 0.7, Math.abs(Math.sin(t * Math.PI * 2 + 0.5))); }, 295));
          $('.sp-curve', svg).setAttribute('d', curve(function (t) { return lerp(0.4, 0.6, Math.abs(Math.sin(t * Math.PI * 4 + 1))); }, 440));
          $('.rhob-curve', svg).setAttribute('d', curve(function (t) { return lerp(0.25, 0.75, Math.abs(Math.sin(t * Math.PI * 2.5 + 1.2))); }, 585));
          var gr = $('.gr-curve', svg).getAttribute('d');
          $('.gr-fill', svg).setAttribute('d', gr + 'L165,410 L165,20 Z');
        } else if (step === 2) {
          $('.wl-ai', svg).setAttribute('opacity', sub.toFixed(2));
          $('.wl-pay', svg).setAttribute('opacity', sub.toFixed(2));
          $('.wl-h1', svg).textContent = '3 层';
          $('.wl-h2', svg).textContent = '30 m';
          $('.wl-h3', svg).textContent = Math.round(12 + sub * 6) + '%';
          // 储层参数雷达图：孔隙度/渗透率/含油饱和度/泥质含量/有效厚度
          var rcx = 115, rcy = 66, rr = 28;
          var rvals = [0.7 + sub * 0.1, 0.5 + sub * 0.2, 0.6 + sub * 0.15, 0.35, 0.8];
          var rgrid = '';
          for (var ri = 1; ri <= 3; ri++) {
            rgrid += '<circle cx="' + rcx + '" cy="' + rcy + '" r="' + (rr * ri / 3) + '" fill="none" stroke="var(--ink-3)" stroke-opacity=".25"/>';
          }
          var raxes = '';
          for (var ai = 0; ai < 5; ai++) {
            var aa = -Math.PI / 2 + ai * Math.PI * 2 / 5;
            raxes += '<line x1="' + rcx + '" y1="' + rcy + '" x2="' + (rcx + Math.cos(aa) * rr) + '" y2="' + (rcy + Math.sin(aa) * rr) + '" stroke="var(--ink-3)" stroke-opacity=".2"/>';
          }
          $('.wl-chart1', svg).innerHTML = rgrid + raxes + '<path d="' + radarPath(rvals, rcx, rcy, rr) + '" fill="var(--c-nlp)" fill-opacity=".25" stroke="var(--c-nlp)" stroke-width="1.5"/>';
          // 测井响应统计柱状图（4 条曲线均值）
          var logStats = [0.75, 0.6, 0.5, 0.45 + sub * 0.2];
          $('.wl-chart2', svg).innerHTML = bars(logStats, 14, 32, 202, 48, 'var(--c-cv)', 4);
        } else if (step === 3) {
          $('.wl-ai', svg).setAttribute('opacity', '1');
          $('.wl-pay', svg).setAttribute('opacity', '1');
          $('.wl-h3', svg).textContent = '18%';
          var rvals2 = [0.8, 0.7, 0.75, 0.35, 0.85];
          var rcx2 = 115, rcy2 = 66, rr2 = 28;
          var rgrid2 = '';
          for (var ri2 = 1; ri2 <= 3; ri2++) {
            rgrid2 += '<circle cx="' + rcx2 + '" cy="' + rcy2 + '" r="' + (rr2 * ri2 / 3) + '" fill="none" stroke="var(--ink-3)" stroke-opacity=".25"/>';
          }
          var raxes2 = '';
          for (var ai2 = 0; ai2 < 5; ai2++) {
            var aa2 = -Math.PI / 2 + ai2 * Math.PI * 2 / 5;
            raxes2 += '<line x1="' + rcx2 + '" y1="' + rcy2 + '" x2="' + (rcx2 + Math.cos(aa2) * rr2) + '" y2="' + (rcy2 + Math.sin(aa2) * rr2) + '" stroke="var(--ink-3)" stroke-opacity=".2"/>';
          }
          $('.wl-chart1', svg).innerHTML = rgrid2 + raxes2 + '<path d="' + radarPath(rvals2, rcx2, rcy2, rr2) + '" fill="var(--c-nlp)" fill-opacity=".25" stroke="var(--c-nlp)" stroke-width="1.5"/>';
          $('.wl-chart2', svg).innerHTML = bars([0.75, 0.6, 0.5, 0.65], 14, 32, 202, 48, 'var(--c-cv)', 4);
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑥ 固井 — clay 套管 + jade 环空水泥 + c-cv 油气层气泡 + 声波检测
       ═════════════════════════════════════════════════════════════ */
    cementing: {
      title: '固井', subtitle: '套管下入 · 双胶塞注水泥 · CBL/VDL 声波检测 → 层位隔离', duration: 12000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- ===== 背景：天空 + 地层分层 ===== -->' +
          '  <rect width="800" height="100" fill="url(#sky)"/>' +
          '  <rect y="100" width="800" height="320" fill="url(#earthG)" fill-opacity=".4"/>' +
          '  <rect y="120" width="800" height="50" fill="var(--ink-3)" fill-opacity=".22"/>' +
          '  <rect y="190" width="800" height="55" fill="var(--ink-2)" fill-opacity=".2"/>' +
          '  <rect class="cm-pay" y="280" width="800" height="42" fill="var(--clay)" fill-opacity=".18"/><text x="10" y="302" font-size="8" fill="var(--clay)">⌁ 产层 Pay Zone</text>' +
          '  <rect y="345" width="800" height="75" fill="var(--ink-2)" fill-opacity=".25"/>' +
          '  <!-- 深度标尺 -->' +
          '  <g font-family="monospace" font-size="7" fill="var(--ink-3)" text-anchor="end">' +
          '    <text x="14" y="130">0</text><text x="14" y="200">500</text><text x="14" y="270">1000</text>' +
          '    <text x="14" y="340">1500</text><text x="14" y="410">2000 m</text>' +
          '  </g>' +

          '  <!-- ===== 井口装置（clay 法兰 + jade 水泥头） ===== -->' +
          '  <g transform="translate(220,72)">' +
          '    <rect x="-34" y="0" width="68" height="24" fill="var(--ink-2)"/>' +
          '    <rect x="-40" y="-4" width="80" height="6" fill="var(--clay)" fill-opacity=".7"/>' +
          '    <rect x="-22" y="-22" width="44" height="18" fill="var(--jade)" fill-opacity=".6" rx="2"/>' +
          '    <rect x="-18" y="-32" width="36" height="10" fill="var(--clay)" fill-opacity=".5"/>' +
          '    <circle cx="-32" cy="12" r="2.5" fill="var(--clay)"/><circle cx="32" cy="12" r="2.5" fill="var(--clay)"/>' +
          '    <text x="0" y="-36" text-anchor="middle" font-size="7" fill="var(--jade-d)">Cement Head</text>' +
          '  </g>' +

          '  <!-- ===== 井筒（井眼 + 套管 + 环空） ===== -->' +
          '  <!-- 井眼边界（ink） -->' +
          '  <rect x="196" y="96" width="48" height="324" fill="var(--ink-2)" fill-opacity=".2"/>' +
          '  <rect x="196" y="96" width="3" height="324" fill="var(--ink-3)" fill-opacity=".5"/>' +
          '  <rect x="241" y="96" width="3" height="324" fill="var(--ink-3)" fill-opacity=".5"/>' +
          '  <!-- 环空水泥（jade 绿，从下往上填充） -->' +
          '  <rect class="cm-cement" x="199" y="420" width="42" height="0" fill="var(--jade)" fill-opacity=".42"/>' +
          '  <rect class="cm-cement-hot" x="199" y="420" width="42" height="0" fill="url(#hotG)" fill-opacity=".35"/>' +
          '  <!-- 套管（clay 橙双层） -->' +
          '  <rect class="cm-casing" x="208" y="96" width="24" height="0" fill="var(--clay)" fill-opacity=".72"/>' +
          '  <rect class="cm-casing-inner" x="212" y="96" width="16" height="0" fill="var(--ink-1)" fill-opacity=".92"/>' +
          '  <!-- 套管内流体色带（泥浆 c-nlp / 隔离液 c-kg / 水泥 jade / 顶替液 c-opt） -->' +
          '  <g class="cm-fluid">' +
          '    <rect class="fl-mud" x="212" y="96" width="16" height="0" fill="var(--c-nlp)" fill-opacity=".35"/>' +
          '    <rect class="fl-spacer" x="212" y="96" width="16" height="0" fill="var(--c-kg)" fill-opacity=".5"/>' +
          '    <rect class="fl-cement" x="212" y="96" width="16" height="0" fill="var(--jade)" fill-opacity=".65"/>' +
          '    <rect class="fl-disp" x="212" y="96" width="16" height="0" fill="var(--c-opt)" fill-opacity=".4"/>' +
          '  </g>' +
          '  <!-- 双胶塞 -->' +
          '  <g class="cm-plugs">' +
          '    <rect class="plug plug-bottom" x="210" y="96" width="20" height="10" fill="var(--clay)" rx="2" opacity="0"/>' +
          '    <circle class="plug-disc" cx="220" cy="101" r="2.5" fill="var(--c-opt)" opacity="0"/>' +
          '    <rect class="plug plug-top" x="210" y="96" width="20" height="10" fill="var(--c-opt)" rx="2" opacity="0"/>' +
          '  </g>' +

          '  <!-- ===== 套管下入：浮鞋 + 浮箍 + 扶正器 ===== -->' +
          '  <g class="cm-casing-gear" opacity="0">' +
          '    <!-- 浮鞋（底部圆头单向阀） -->' +
          '    <path class="float-shoe" d="M208,0 L232,0 L228,10 L212,10 Z" fill="var(--clay)" fill-opacity=".85"/>' +
          '    <circle class="float-shoe" cx="220" cy="5" r="2" fill="var(--ink-1)"/>' +
          '    <!-- 浮箍（承托胶塞） -->' +
          '    <rect class="float-collar" x="206" y="-16" width="28" height="6" fill="var(--clay)" fill-opacity=".6"/>' +
          '    <!-- 扶正器环（3 个） -->' +
          '    <g class="centralizers">' +
          '      <ellipse class="cz cz1" cx="220" cy="-40" rx="18" ry="3" fill="none" stroke="var(--c-kg)" stroke-width="1.5" opacity=".7"/>' +
          '      <ellipse class="cz cz2" cx="220" cy="-90" rx="18" ry="3" fill="none" stroke="var(--c-kg)" stroke-width="1.5" opacity=".7"/>' +
          '      <ellipse class="cz cz3" cx="220" cy="-140" rx="18" ry="3" fill="none" stroke="var(--c-kg)" stroke-width="1.5" opacity=".7"/>' +
          '    </g>' +
          '  </g>' +

          '  <!-- ===== 注水泥泵机组（左上） ===== -->' +
          '  <g class="cm-pump" transform="translate(20,30)">' +
          '    <rect width="100" height="56" fill="var(--ink-2)" fill-opacity=".75" rx="3"/>' +
          '    <rect x="6" y="6" width="88" height="20" fill="var(--clay)" fill-opacity=".55"/>' +
          '    <text x="50" y="20" text-anchor="middle" font-size="8" fill="var(--clay)">Cementing Unit</text>' +
          '    <!-- 三缸柱塞泵 -->' +
          '    <g class="pump-pistons">' +
          '      <circle class="pp pp1" cx="20" cy="40" r="6" fill="var(--c-opt)" fill-opacity=".6"/>' +
          '      <circle class="pp pp2" cx="50" cy="40" r="6" fill="var(--c-opt)" fill-opacity=".5"/>' +
          '      <circle class="pp pp3" cx="80" cy="40" r="6" fill="var(--c-opt)" fill-opacity=".5"/>' +
          '    </g>' +
          '    <text x="50" y="78" text-anchor="middle" font-size="7" fill="var(--c-kg)">Triplex Pump</text>' +
          '  </g>' +
          '  <!-- 注水泥管线（jade 绿管 + clay 流动粒子） -->' +
          '  <path d="M120,58 Q160,58 198,86" fill="none" stroke="var(--jade)" stroke-width="3.5" stroke-opacity=".6"/>' +
          '  <path class="cm-flow" d="M120,58 Q160,58 198,86" fill="none" stroke="var(--clay)" stroke-width="1.5" stroke-dasharray="6 3"/>' +

          '  <!-- ===== CBL/VDL 声波测井 ===== -->' +
          '  <!-- 声波探头（c-opt 蓝） -->' +
          '  <g class="cm-sonic" opacity="0">' +
          '    <line x1="220" y1="96" x2="220" y2="70" stroke="var(--ink-3)" stroke-width="0.8"/>' +
          '    <rect x="215" y="96" width="10" height="22" fill="var(--c-opt)" fill-opacity=".75" rx="2"/>' +
          '    <rect x="217" y="100" width="6" height="4" fill="var(--clay)" fill-opacity=".6"/>' +
          '    <circle cx="220" cy="118" r="2.5" fill="var(--jade-d)"/>' +
          '  </g>' +
          '  <!-- 声波扇形射线（套管波 clay / 水泥波 jade / 地层波 c-cv） -->' +
          '  <g class="cm-waves" opacity="0">' +
          '    <path class="w w-casing" d="" stroke="var(--clay)" stroke-width="1.1" fill="none"/>' +
          '    <path class="w w-cement" d="" stroke="var(--jade)" stroke-width="1.1" fill="none"/>' +
          '    <path class="w w-form" d="" stroke="var(--c-cv)" stroke-width="1.1" fill="none"/>' +
          '  </g>' +

          '  <!-- ===== 右侧数据面板 ===== -->' +
          '  <!-- 施工参数：泵压 / 排量 / 密度 -->' +
          '  <g class="cm-job-panel" transform="translate(290,20)" opacity="0">' +
          '    <rect width="230" height="115" rx="6" fill="var(--card)" fill-opacity=".78" stroke="var(--clay)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--clay)" font-weight="bold">Job · 施工参数</text>' +
          '    <line x1="10" y1="24" x2="220" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <!-- 泵压曲线 -->' +
          '    <text x="10" y="38" font-size="7" fill="var(--ink-3)">Pump Pressure (MPa)</text>' +
          '    <rect x="10" y="42" width="210" height="26" fill="var(--ink-3)" fill-opacity=".12" rx="2"/>' +
          '    <path class="pr-curve" d="" fill="none" stroke="var(--clay)" stroke-width="1.5"/>' +
          '    <text class="pr-val" x="218" y="38" font-size="7" fill="var(--clay)" text-anchor="end">0</text>' +
          '    <!-- 排量曲线 -->' +
          '    <text x="10" y="80" font-size="7" fill="var(--ink-3)">Flow Rate (bbl/min)</text>' +
          '    <rect x="10" y="84" width="210" height="22" fill="var(--ink-3)" fill-opacity=".12" rx="2"/>' +
          '    <path class="fr-curve" d="" fill="none" stroke="var(--jade)" stroke-width="1.5"/>' +
          '    <text class="fr-val" x="218" y="80" font-size="7" fill="var(--jade)" text-anchor="end">0</text>' +
          '  </g>' +

          '  <!-- CBL 幅度 + VDL 面板 -->' +
          '  <g class="cm-cbl-panel" transform="translate(290,145)" opacity="0">' +
          '    <rect width="230" height="120" rx="6" fill="var(--card)" fill-opacity=".78" stroke="var(--c-opt)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-opt)" font-weight="bold">CBL / VDL · 胶结测井</text>' +
          '    <line x1="10" y1="24" x2="220" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <!-- CBL 幅度曲线（jade，低幅=胶结好） -->' +
          '    <text x="10" y="38" font-size="7" fill="var(--ink-3)">CBL Amplitude (mV)</text>' +
          '    <rect x="10" y="42" width="100" height="72" fill="var(--ink-3)" fill-opacity=".12" rx="2"/>' +
          '    <path class="cbl-curve" d="" fill="none" stroke="var(--jade-d)" stroke-width="1.4"/>' +
          '    <!-- VDL 变密度条带（c-cv 青地层波） -->' +
          '    <text x="120" y="38" font-size="7" fill="var(--ink-3)">VDL Formation Wave</text>' +
          '    <rect x="120" y="42" width="100" height="72" fill="var(--ink-3)" fill-opacity=".12" rx="2"/>' +
          '    <g class="vdl-bands"></g>' +
          '    <text class="cbl-bi" x="10" y="114" font-size="8" fill="var(--jade-d)">BI: --</text>' +
          '  </g>' +

          '  <!-- ===== 失败模式叠加（气窜 / 窜槽 / 微环空） ===== -->' +
          '  <g class="cm-fail" opacity="0">' +
          '    <!-- 气窜箭头（clay 橙从产层上升） -->' +
          '    <g class="gas-mig">' +
          '      <path class="gm gm1" d="M245,300 L245,300" stroke="var(--clay)" stroke-width="1.2" fill="none" stroke-dasharray="3 2"/>' +
          '      <path class="gm gm2" d="M195,300 L195,300" stroke="var(--clay)" stroke-width="1.2" fill="none" stroke-dasharray="3 2"/>' +
          '    </g>' +
          '    <!-- 窜槽带（c-nlp 紫，高边） -->' +
          '    <rect class="channel" x="236" y="200" width="6" height="180" fill="var(--c-nlp)" fill-opacity=".5"/>' +
          '    <!-- 微环空（c-opt 蓝细缝） -->' +
          '    <rect class="microann" x="232" y="96" width="2" height="324" fill="var(--c-opt)" fill-opacity=".6"/>' +
          '  </g>' +

          '  <!-- ===== 油气层气泡（c-cv 青） ===== -->' +
          '  <g class="cm-gas">' +
          '    <circle class="gas g1" cx="216" cy="300" r="2" fill="var(--c-cv)" fill-opacity="0"/>' +
          '    <circle class="gas g2" cx="224" cy="310" r="2.5" fill="var(--c-cv)" fill-opacity="0"/>' +
          '    <circle class="gas g3" cx="218" cy="290" r="1.5" fill="var(--c-cv)" fill-opacity="0"/>' +
          '    <circle class="gas g4" cx="226" cy="305" r="2" fill="var(--c-cv)" fill-opacity="0"/>' +
          '  </g>' +

          '  <!-- ===== HUD：固井质量评价 ===== -->' +
          '  <g transform="translate(290,280)"><rect width="230" height="120" rx="6" fill="var(--card)" fill-opacity=".8" stroke="var(--jade)" stroke-opacity=".3"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--jade-d)" font-weight="bold">Cement Integrity · 固井质量</text>' +
          '    <line x1="10" y1="24" x2="220" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">阶段 <tspan class="cm-stage" fill="var(--jade-d)">--</tspan></text>' +
          '    <text x="10" y="58" font-size="9" fill="var(--ink-2)">套管下入 <tspan class="cm-h1" fill="var(--clay)">-- m</tspan></text>' +
          '    <text x="10" y="74" font-size="9" fill="var(--ink-2)">水泥返高 <tspan class="cm-h2" fill="var(--jade-d)">-- m</tspan> · 碰压 <tspan class="cm-bump" fill="var(--c-ts)">-- MPa</tspan></text>' +
          '    <text x="10" y="90" font-size="9" fill="var(--ink-2)">第一界面 BI <tspan class="cm-h3" fill="var(--c-opt)">--</tspan></text>' +
          '    <text x="10" y="106" font-size="9" fill="var(--ink-2)">第二界面 BI <tspan class="cm-h4" fill="var(--c-nlp)">--</tspan></text>' +
          '    <text class="cm-verdict" x="220" y="106" font-size="9" fill="var(--c-kg)" text-anchor="end">--</text>' +
          '    <circle cx="220" cy="16" r="5" fill="none" stroke="var(--jade)" stroke-width="1.2"/><text x="212" y="19" font-size="7" fill="var(--jade)">AI</text>' +
          '  </g>' +
          '</svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        // ===== STEP 0：套管下入（浮鞋+浮箍+扶正器） =====
        if (step === 0) {
          $('.cm-casing-gear', svg).setAttribute('opacity', '1');
          var h = sub * 324;
          $('.cm-casing', svg).setAttribute('height', h.toFixed(1));
          $('.cm-casing-inner', svg).setAttribute('height', h.toFixed(1));
          $('.cm-casing-gear', svg).setAttribute('transform', 'translate(0,' + h.toFixed(1) + ')');
          $('.cm-stage', svg).textContent = '① 套管下入';
          $('.cm-h1', svg).textContent = Math.round(sub * 2000);
        }
        // ===== STEP 1：双胶塞注水泥 =====
        else if (step === 1) {
          $('.cm-casing', svg).setAttribute('height', '324');
          $('.cm-casing-inner', svg).setAttribute('height', '324');
          $('.cm-casing-gear', svg).setAttribute('opacity', '0');
          $('.cm-job-panel', svg).setAttribute('opacity', '1');
          // 流体色带推进（泥浆→隔离液→水泥→顶替液）
          var bandH = sub * 324;
          var mudH = Math.max(0, bandH - sub * 80);
          var spacerH = sub > 0.15 ? Math.min(30, (sub - 0.15) * 100) : 0;
          var cementH = sub > 0.3 ? Math.min(bandH * 0.5, (sub - 0.3) * 400) : 0;
          var dispH = sub > 0.6 ? (sub - 0.6) * 500 : 0;
          $('.fl-mud', svg).setAttribute('height', Math.max(0, mudH).toFixed(1));
          $('.fl-spacer', svg).setAttribute('height', spacerH.toFixed(1));
          $('.fl-spacer', svg).setAttribute('y', (96 + Math.max(0, mudH - spacerH)).toFixed(1));
          $('.fl-cement', svg).setAttribute('height', cementH.toFixed(1));
          $('.fl-cement', svg).setAttribute('y', (96 + Math.max(0, mudH + spacerH - cementH)).toFixed(1));
          $('.fl-disp', svg).setAttribute('height', dispH.toFixed(1));
          // 双胶塞推进
          var plugY = 96 + sub * 314;
          $('.plug-bottom', svg).setAttribute('opacity', sub > 0.1 ? '1' : '0');
          $('.plug-bottom', svg).setAttribute('y', (96 + Math.max(0, sub * 400 - 80)).toFixed(1));
          $('.plug-disc', svg).setAttribute('opacity', sub > 0.1 ? '1' : '0');
          $('.plug-disc', svg).setAttribute('cy', (96 + Math.max(0, sub * 400 - 80) + 5).toFixed(1));
          $('.plug-top', svg).setAttribute('opacity', sub > 0.55 ? '1' : '0');
          $('.plug-top', svg).setAttribute('y', (96 + Math.max(0, (sub - 0.55) * 700)).toFixed(1));
          // 环空水泥从下往上填充
          var cementFill = sub * 324;
          $('.cm-cement', svg).setAttribute('y', (420 - cementFill).toFixed(1));
          $('.cm-cement', svg).setAttribute('height', cementFill.toFixed(1));
          $('.cm-cement-hot', svg).setAttribute('y', (420 - cementFill).toFixed(1));
          $('.cm-cement-hot', svg).setAttribute('height', cementFill.toFixed(1));
          $('.cm-cement-hot', svg).setAttribute('opacity', (0.12 + Math.sin(sub * Math.PI * 6) * 0.1).toFixed(2));
          // 管线流动
          $('.cm-flow', svg).setAttribute('stroke-dashoffset', (-sub * 60).toFixed(1));
          // 泵压曲线（平稳 → 碰压突升）
          var pts = 40, px = 12, pw = 206, py = 45, ph = 20;
          var d = '';
          for (var i = 0; i <= pts; i++) {
            var t = i / pts, x = px + pw * t, y;
            if (t < 0.7) y = py + ph * (0.3 + 0.1 * Math.sin(t * 20));
            else if (t < 0.85) y = py + ph * (0.3 - (t - 0.7) * 2.5);
            else y = py + ph * 0.05;
            d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
          }
          // 只画到当前进度
          var endPt = Math.floor(pts * sub);
          var dTrim = d.split(' ').slice(0, endPt + 1).join(' ');
          $('.pr-curve', svg).setAttribute('d', dTrim);
          // 排量曲线（平稳）
          var fd = '';
          for (var j = 0; j <= pts; j++) {
            var ft = j / pts, fx = px + pw * ft, fy = 87 + 16 * (0.5 + 0.1 * Math.sin(ft * 15));
            fd += (j === 0 ? 'M' : 'L') + fx.toFixed(1) + ',' + fy.toFixed(1) + ' ';
          }
          $('.fr-curve', svg).setAttribute('d', fd.split(' ').slice(0, endPt + 1).join(' '));
          $('.pr-val', svg).textContent = sub < 0.85 ? (13 + sub * 2).toFixed(1) : '85.5';
          $('.fr-val', svg).textContent = (4 + Math.sin(sub * 10) * 0.3).toFixed(1);
          $('.cm-stage', svg).textContent = '② 双胶塞注水泥';
          $('.cm-h1', svg).textContent = '2000';
          $('.cm-h2', svg).textContent = Math.round(sub * 1850);
          $('.cm-bump', svg).textContent = sub > 0.85 ? (8 + (sub - 0.85) * 50).toFixed(0) : '--';
        }
        // ===== STEP 2：CBL/VDL 声波检测 =====
        else if (step === 2) {
          $('.cm-cement', svg).setAttribute('height', '324');
          $('.cm-cement', svg).setAttribute('y', '96');
          $('.cm-cement-hot', svg).setAttribute('opacity', '0');
          $('.cm-plugs', svg).setAttribute('opacity', '0');
          $('.cm-fluid', svg).setAttribute('opacity', '0.3');
          $('.cm-cbl-panel', svg).setAttribute('opacity', '1');
          // 探头下放
          var ty = 96 + sub * 300;
          $('.cm-sonic', svg).setAttribute('opacity', '1');
          $('.cm-sonic', svg).setAttribute('transform', 'translate(0,' + (ty - 96).toFixed(1) + ')');
          // 声波扇形射线（套管波 clay / 水泥波 jade / 地层波 c-cv）
          var cx = 220, cy = ty + 10;
          function wavePath(amp, spread, reach) {
            var dd = '';
            for (var k = 0; k < 8; k++) {
              var rr = 5 + k * reach;
              var a1 = -Math.PI / 2 - spread, a2 = -Math.PI / 2 + spread;
              dd += ' M' + (cx + Math.cos(a1) * rr).toFixed(1) + ',' + (cy + Math.sin(a1) * rr).toFixed(1);
              dd += ' L' + (cx + Math.cos(a2) * rr).toFixed(1) + ',' + (cy + Math.sin(a2) * rr).toFixed(1);
            }
            return dd;
          }
          $('.cm-waves', svg).setAttribute('opacity', '1');
          $('.w-casing', svg).setAttribute('d', wavePath(1, 0.5, 2.5));
          $('.w-cement', svg).setAttribute('d', wavePath(1, 0.7, 4));
          $('.w-form', svg).setAttribute('d', wavePath(1, 0.9, 5.5));
          // 油气层气泡
          $all('.gas', svg).forEach(function (el, i) {
            if (sub > i * 0.2) {
              el.setAttribute('fill-opacity', '0.85');
              el.setAttribute('cy', (300 - (sub - i * 0.2) * 30).toFixed(1));
            }
          });
          // CBL 幅度曲线（低幅=胶结好）
          var cblPts = 60, bx = 14, bw = 92, by = 46, bh = 64;
          var cblD = '';
          for (var ci = 0; ci <= cblPts; ci++) {
            var ct = ci / cblPts;
            var cxx = bx + bw * ct;
            // 大部分段低幅（胶结好），产层段高幅（窜槽）
            var amp = (ct > 0.4 && ct < 0.6) ? 0.7 + 0.3 * Math.sin(ct * 40) : 0.1 + 0.05 * Math.sin(ct * 30);
            var cyy = by + bh * amp;
            cblD += (ci === 0 ? 'M' : 'L') + cxx.toFixed(1) + ',' + cyy.toFixed(1) + ' ';
          }
          $('.cbl-curve', svg).setAttribute('d', cblD.split(' ').slice(0, Math.floor(cblPts * sub) + 1).join(' '));
          // VDL 变密度条带（地层波条纹）
          var vdl = $('.vdl-bands', svg);
          vdl.innerHTML = '';
          for (var vi = 0; vi < 12; vi++) {
            var vy = 46 + vi * 5.5;
            var opacity = (vi % 3 === 0) ? 0.8 : 0.3;
            var line = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            line.setAttribute('x', '122'); line.setAttribute('y', vy.toFixed(1));
            line.setAttribute('width', '96'); line.setAttribute('height', '2');
            line.setAttribute('fill', 'var(--c-cv)');
            line.setAttribute('fill-opacity', (opacity * sub).toFixed(2));
            vdl.appendChild(line);
          }
          var bi = 1 - (0.7 + 0.3 * Math.sin(sub * 20));
          $('.cbl-bi', svg).textContent = 'BI: ' + (bi > 0.8 ? '>0.8 ✓' : bi.toFixed(2));
          $('.cm-stage', svg).textContent = '③ CBL/VDL 检测';
          $('.cm-h2', svg).textContent = '1850';
        }
        // ===== STEP 3：层位隔离评价（失败模式 + BI 结论） =====
        else if (step === 3) {
          $('.cm-fail', svg).setAttribute('opacity', sub.toFixed(2));
          // 气窜箭头
          $('.gm1', svg).setAttribute('d', 'M245,300 L245,' + (300 - sub * 60).toFixed(1));
          $('.gm2', svg).setAttribute('d', 'M195,300 L195,' + (300 - sub * 80).toFixed(1));
          // 微环空加压闭合
          $('.microann', svg).setAttribute('opacity', (1 - sub).toFixed(2));
          // 气窜气泡
          $all('.gas', svg).forEach(function (el, i) {
            el.setAttribute('fill-opacity', (0.7 + sub * 0.2).toFixed(2));
            el.setAttribute('cy', (300 - (0.5 + i * 0.15) * 60 - sub * 40).toFixed(1));
          });
          // BI 数值收敛
          var bi1 = 0.88 + sub * 0.08;
          var bi2 = 0.82 + sub * 0.1;
          $('.cm-h3', svg).textContent = bi1.toFixed(2);
          $('.cm-h4', svg).textContent = bi2.toFixed(2);
          $('.cm-verdict', svg).textContent = sub > 0.7 ? '✓ PASS' : '评价中...';
          $('.cm-verdict', svg).setAttribute('fill', sub > 0.7 ? 'var(--c-kg)' : 'var(--ink-3)');
          $('.cm-stage', svg).textContent = '④ 层位隔离评价';
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑦ 完井 — jade 射孔 / clay 筛管 / c-nlp 砾石 三色方案对比
       ═════════════════════════════════════════════════════════════ */
    completion: {
      title: '完井', subtitle: '方案选择 · 射孔 / 筛管 / 砾石 · AI 推荐与知识图谱匹配', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 地层背景 -->' +
          '  <rect y="260" width="800" height="160" fill="var(--clay)" fill-opacity=".06"/>' +
          '  <rect y="290" width="800" height="35" fill="var(--c-kg)" fill-opacity=".1"/><text x="10" y="312" font-size="8" fill="var(--c-kg)">目标储层</text>' +
          '  <line x1="0" y1="290" x2="800" y2="290" stroke="var(--c-kg)" stroke-width=".7" stroke-dasharray="4 3"/>' +
          '  <line x1="0" y1="325" x2="800" y2="325" stroke="var(--c-kg)" stroke-width=".7" stroke-dasharray="4 3"/>' +
          '  <!-- 三方案分栏（各 250px 宽） -->' +
          '  <g transform="translate(40,30)">' +
          '    <!-- 方案一：射孔完井 (jade 绿) -->' +
          '    <g class="cp-col cp-1" transform="translate(0,0)">' +
          '      <rect width="235" height="350" fill="var(--ink-2)" fill-opacity=".1" stroke="var(--jade)" stroke-width="1"/>' +
          '      <rect x="0" y="0" width="235" height="24" fill="var(--jade)" fill-opacity=".35"/>' +
          '      <text x="117" y="16" text-anchor="middle" font-size="10" fill="var(--jade-d)" font-weight="bold">① 射孔完井</text>' +
          '      <!-- 套管孔眼 -->' +
          '      <rect x="88" y="100" width="18" height="190" fill="var(--clay)" fill-opacity=".6"/>' +
          '      <rect x="91" y="100" width="12" height="190" fill="var(--ink-1)"/>' +
          '      <!-- 射孔孔眼 (jade 绿圆) -->' +
          '      <g class="cp-perfs">' +
          '        <circle class="p p1" cx="88" cy="160" r="3" fill="var(--jade)"/>' +
          '        <circle class="p p2" cx="106" cy="180" r="3" fill="var(--jade)"/>' +
          '        <circle class="p p3" cx="88" cy="200" r="3" fill="var(--jade)"/>' +
          '        <circle class="p p4" cx="106" cy="220" r="3" fill="var(--jade)"/>' +
          '        <circle class="p p5" cx="88" cy="240" r="3" fill="var(--jade)"/>' +
          '        <circle class="p p6" cx="106" cy="260" r="3" fill="var(--jade)"/>' +
          '      </g>' +
          '      <!-- 评价条（clay 高亮最优） -->' +
          '      <g class="cp-bars">' +
          '        <text x="10" y="310" font-size="8" fill="var(--ink-2)">产能</text><rect x="50" y="303" class="b b-cap" width="0" height="5" fill="var(--jade)"/>' +
          '        <text x="10" y="325" font-size="8" fill="var(--ink-2)">成本</text><rect x="50" y="318" class="b b-cost" width="0" height="5" fill="var(--clay)"/>' +
          '        <text x="10" y="340" font-size="8" fill="var(--ink-2)">风险</text><rect x="50" y="333" class="b b-risk" width="0" height="5" fill="var(--c-nlp)"/>' +
          '      </g>' +
          '    </g>' +
          '    <!-- 方案二：筛管完井 (clay 陶土橙) -->' +
          '    <g class="cp-col cp-2" transform="translate(245,0)">' +
          '      <rect width="235" height="350" fill="var(--ink-2)" fill-opacity=".1" stroke="var(--clay)" stroke-width="1"/>' +
          '      <rect x="0" y="0" width="235" height="24" fill="var(--clay)" fill-opacity=".35"/>' +
          '      <text x="117" y="16" text-anchor="middle" font-size="10" fill="var(--clay)" font-weight="bold">② 筛管完井</text>' +
          '      <rect x="85" y="100" width="24" height="190" fill="var(--clay)" fill-opacity=".55"/>' +
          '      <g stroke="var(--clay)" stroke-width=".6" stroke-opacity=".6">' +
          '        <line x1="85" y1="130" x2="109" y2="130"/><line x1="85" y1="160" x2="109" y2="160"/>' +
          '        <line x1="85" y1="190" x2="109" y2="190"/><line x1="85" y1="220" x2="109" y2="220"/>' +
          '        <line x1="85" y1="250" x2="109" y2="250"/><line x1="85" y1="280" x2="109" y2="280"/>' +
          '      </g>' +
          '      <g class="cp-bars">' +
          '        <text x="10" y="310" font-size="8" fill="var(--ink-2)">产能</text><rect x="50" y="303" class="b b-cap" width="0" height="5" fill="var(--jade)"/>' +
          '        <text x="10" y="325" font-size="8" fill="var(--ink-2)">成本</text><rect x="50" y="318" class="b b-cost" width="0" height="5" fill="var(--clay)"/>' +
          '        <text x="10" y="340" font-size="8" fill="var(--ink-2)">风险</text><rect x="50" y="333" class="b b-risk" width="0" height="5" fill="var(--c-nlp)"/>' +
          '      </g>' +
          '    </g>' +
          '    <!-- 方案三：砾石充填 (c-nlp 紫) -->' +
          '    <g class="cp-col cp-3" transform="translate(490,0)">' +
          '      <rect width="235" height="350" fill="var(--ink-2)" fill-opacity=".1" stroke="var(--c-nlp)" stroke-width="1"/>' +
          '      <rect x="0" y="0" width="235" height="24" fill="var(--c-nlp)" fill-opacity=".35"/>' +
          '      <text x="117" y="16" text-anchor="middle" font-size="10" fill="var(--c-nlp)" font-weight="bold">③ 砾石充填</text>' +
          '      <rect x="85" y="100" width="24" height="190" fill="var(--ink-1)" fill-opacity=".9"/>' +
          '      <g class="cp-gravel">' +
          '        <circle class="gr g1" cx="90" cy="170" r="2.2" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g2" cx="99" cy="175" r="2.5" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g3" cx="93" cy="190" r="2" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g4" cx="105" cy="195" r="2.3" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g5" cx="97" cy="210" r="2.1" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g6" cx="101" cy="225" r="2.4" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g7" cx="92" cy="240" r="2" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g8" cx="107" cy="255" r="2.2" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g9" cx="95" cy="270" r="2.5" fill="var(--c-nlp)"/>' +
          '        <circle class="gr g10" cx="104" cy="280" r="2" fill="var(--c-nlp)"/>' +
          '      </g>' +
          '      <g class="cp-bars">' +
          '        <text x="10" y="310" font-size="8" fill="var(--ink-2)">产能</text><rect x="50" y="303" class="b b-cap" width="0" height="5" fill="var(--jade)"/>' +
          '        <text x="10" y="325" font-size="8" fill="var(--ink-2)">成本</text><rect x="50" y="318" class="b b-cost" width="0" height="5" fill="var(--clay)"/>' +
          '        <text x="10" y="340" font-size="8" fill="var(--ink-2)">风险</text><rect x="50" y="333" class="b b-risk" width="0" height="5" fill="var(--c-nlp)"/>' +
          '      </g>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 产量递减预测曲线（浮动面板，三方案对比） -->' +
          '  <g transform="translate(555,15)"><rect width="235" height="62" rx="5" fill="var(--card)" fill-opacity=".85" stroke="var(--c-kg)" stroke-opacity=".3"/>' +
          '    <text x="8" y="14" font-size="9" fill="var(--c-kg)" font-weight="bold">产量递减预测 (bbl/d)</text>' +
          '    <rect x="8" y="20" width="219" height="34" fill="var(--ink-3)" fill-opacity=".1" rx="2"/>' +
          '    <path class="cp-fc1" d="" fill="none" stroke="var(--jade)" stroke-width="1.3"/>' +
          '    <path class="cp-fc2" d="" fill="none" stroke="var(--clay)" stroke-width="1.3"/>' +
          '    <path class="cp-fc3" d="" fill="none" stroke="var(--c-nlp)" stroke-width="1.3"/>' +
          '  </g>' +
          '  <!-- AI 推荐面板 (c-kg 黄绿) -->' +
          '  <g class="cp-rec" opacity="0" transform="translate(550,380)"><rect width="235" height="30" rx="4" fill="var(--c-kg)" fill-opacity=".25" stroke="var(--c-kg)" stroke-width="1"/>' +
          '    <text x="117" y="20" text-anchor="middle" font-size="11" fill="var(--c-kg)" font-weight="bold">✓ AI 推荐：射孔完井 · 邻井 89% 相似</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        var caps = [[80, 50, 40], [70, 70, 30], [60, 90, 60]]; // cap, cost, risk for each
        if (step === 0) {
          // 各方案套管 / 筛管 / 砾石逐步出现
          $all('.cp-col', svg).forEach(function (col, i) {
            col.setAttribute('opacity', Math.min(1, sub * 3 - i * 0.6).toFixed(2));
          });
        } else if (step === 1) {
          $all('.cp-perfs .p', svg).forEach(function (el, i) { el.setAttribute('opacity', Math.min(1, sub * 4 - i * 0.3).toFixed(2)); });
          $all('.cp-gravel .gr', svg).forEach(function (el, i) { el.setAttribute('opacity', Math.min(1, sub * 3 - i * 0.2).toFixed(2)); });
        } else if (step === 2) {
          // 三条进度条动画
          [0, 1, 2].forEach(function (ci) {
            var col = $('.cp-col.cp-' + (ci + 1), svg);
            var bars = col.querySelectorAll('.cp-bars .b');
            caps[ci].forEach(function (v, bi) {
              bars[bi].setAttribute('width', (v * sub).toFixed(1));
            });
          });
          // 产量递减预测曲线：射孔(jade) / 筛管(clay) / 砾石(c-nlp)
          var nf = 40, fx = 9, fy = 22, fw = 217, fh = 30;
          function decline(qi, D, n) {
            var arr = [];
            for (var i = 0; i < n; i++) { var t = i / n * 3; arr.push(qi * Math.exp(-D * t)); }
            return arr;
          }
          var cutf = Math.floor(nf * sub);
          $('.cp-fc1', svg).setAttribute('d', linePath(decline(0.95, 0.4, nf).slice(0, cutf + 1), fx, fy, fw, fh));
          $('.cp-fc2', svg).setAttribute('d', linePath(decline(0.7, 0.6, nf).slice(0, cutf + 1), fx, fy, fw, fh));
          $('.cp-fc3', svg).setAttribute('d', linePath(decline(0.5, 0.8, nf).slice(0, cutf + 1), fx, fy, fw, fh));
        } else if (step === 3) {
          $('.cp-rec', svg).setAttribute('opacity', sub.toFixed(2));
          var nf2 = 40, fx2 = 9, fy2 = 22, fw2 = 217, fh2 = 30;
          function decline2(qi, D, n) {
            var arr = [];
            for (var i = 0; i < n; i++) { var t = i / n * 3; arr.push(qi * Math.exp(-D * t)); }
            return arr;
          }
          $('.cp-fc1', svg).setAttribute('d', linePath(decline2(0.95, 0.4, nf2), fx2, fy2, fw2, fh2));
          $('.cp-fc2', svg).setAttribute('d', linePath(decline2(0.7, 0.6, nf2), fx2, fy2, fw2, fh2));
          $('.cp-fc3', svg).setAttribute('d', linePath(decline2(0.5, 0.8, nf2), fx2, fy2, fw2, fh2));
          [0, 1, 2].forEach(function (ci) {
            var col = $('.cp-col.cp-' + (ci + 1), svg);
            var bars = col.querySelectorAll('.cp-bars .b');
            caps[ci].forEach(function (v, bi) { bars[bi].setAttribute('width', v); });
          });
          // 推荐方案高亮（方案一射孔）
          $('.cp-col.cp-1', svg).setAttribute('stroke-width', sub > 0.5 ? '2.5' : '1');
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑧ 射孔 — clay 橙枪旋转 + jade/c-cv 冲击波双环 + 6 色射线
       ═════════════════════════════════════════════════════════════ */
    perforation: {
      title: '射孔', subtitle: '射孔枪下入 · 聚能射流 · 冲击波监测 → 打开储层', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 背景 -->' +
          '  <rect width="800" height="150" fill="url(#sky)"/>' +
          '  <rect y="150" width="800" height="270" fill="url(#earthG)" fill-opacity=".35"/>' +
          '  <!-- 射孔段地层（c-kg 黄绿 + clay 高亮） -->' +
          '  <rect y="260" width="800" height="50" fill="var(--c-kg)" fill-opacity=".12"/>' +
          '  <rect y="270" width="800" height="30" fill="var(--clay)" fill-opacity=".15"/><text x="730" y="290" font-size="8" fill="var(--clay)">射孔段 PERF ZONE</text>' +
          '  <!-- 井筒 (ink + clay) -->' +
          '  <rect x="485" y="150" width="30" height="270" fill="var(--ink-2)" fill-opacity=".3"/>' +
          '  <rect x="480" y="150" width="5" height="270" fill="var(--clay)" fill-opacity=".5"/>' +
          '  <rect x="515" y="150" width="5" height="270" fill="var(--clay)" fill-opacity=".5"/>' +
          '  <!-- 射孔枪 (clay 橙完整设备模型) -->' +
          '  <g class="pf-gun">' +
          '    <!-- 枪身（clay 橙圆柱体） -->' +
          '    <rect x="488" y="155" width="24" height="180" fill="var(--clay)" fill-opacity=".85" rx="2"/>' +
          '    <!-- 枪头 -->' +
          '    <polygon points="488,155 512,155 500,145" fill="var(--clay)"/>' +
          '    <!-- 射孔弹（4 排，6 颗） -->' +
          '    <g class="pf-shots">' +
          '      <circle class="sh sh1" cx="500" cy="190" r="2.5" fill="var(--jade)"/>' +
          '      <circle class="sh sh2" cx="500" cy="220" r="2.5" fill="var(--jade)"/>' +
          '      <circle class="sh sh3" cx="500" cy="250" r="2.5" fill="var(--jade)"/>' +
          '      <circle class="sh sh4" cx="500" cy="280" r="2.5" fill="var(--jade)"/>' +
          '      <circle class="sh sh5" cx="500" cy="310" r="2.5" fill="var(--jade)"/>' +
          '      <circle class="sh sh6" cx="500" cy="340" r="2.5" fill="var(--jade)"/>' +
          '    </g>' +
          '    <!-- 导线 -->' +
          '    <line x1="500" y1="145" x2="500" y2="110" stroke="var(--ink-2)" stroke-width="1"/>' +
          '    <circle cx="500" cy="110" r="4" fill="var(--c-opt)"/>' +
          '  </g>' +
          '  <!-- 冲击波双环 (jade 绿 + c-cv 青) -->' +
          '  <g class="pf-blast" opacity="0">' +
          '    <circle class="bl bl1" cx="500" cy="280" r="3" fill="none" stroke="var(--jade)" stroke-width="2"/>' +
          '    <circle class="bl bl2" cx="500" cy="280" r="3" fill="none" stroke="var(--c-cv)" stroke-width="1.5"/>' +
          '    <circle class="bl bl3" cx="500" cy="280" r="3" fill="var(--clay)" fill-opacity=".5"/>' +
          '  </g>' +
          '  <!-- 6 相位不同色射线 (c-cv/c-ts/c-opt/c-kg/clay/jade-d) -->' +
          '  <g class="pf-rays" opacity="0">' +
          '    <path class="pr pr1" d="M500,280 L500,280" stroke="var(--c-cv)" stroke-width="1.5"/>' +
          '    <path class="pr pr2" d="M500,280 L500,280" stroke="var(--c-ts)" stroke-width="1.5"/>' +
          '    <path class="pr pr3" d="M500,280 L500,280" stroke="var(--c-opt)" stroke-width="1.5"/>' +
          '    <path class="pr pr4" d="M500,280 L500,280" stroke="var(--c-kg)" stroke-width="1.5"/>' +
          '    <path class="pr pr5" d="M500,280 L500,280" stroke="var(--clay)" stroke-width="1.5"/>' +
          '    <path class="pr pr6" d="M500,280 L500,280" stroke="var(--jade-d)" stroke-width="1.5"/>' +
          '  </g>' +
          '  <!-- 射孔孔痕 (clay 高亮) -->' +
          '  <g class="pf-holes" opacity="0">' +
          '    <circle cx="470" cy="280" r="4" fill="var(--clay)" fill-opacity=".6"/><line x1="470" y1="276" x2="470" y2="284" stroke="var(--clay)" stroke-width="1"/>' +
          '    <circle cx="530" cy="280" r="4" fill="var(--clay)" fill-opacity=".6"/><line x1="530" y1="276" x2="530" y2="284" stroke="var(--clay)" stroke-width="1"/>' +
          '    <circle cx="490" cy="295" r="3" fill="var(--clay)" fill-opacity=".5"/>' +
          '    <circle cx="510" cy="265" r="3" fill="var(--clay)" fill-opacity=".5"/>' +
          '  </g>' +
          '  <!-- 数据面板1：射孔压力脉冲曲线（clay 橙） -->' +
          panel(575, 125, '射孔压力脉冲 (MPa)', 'var(--clay)', 52) +
          '  <path class="pf-chart1" d="" fill="none" stroke="var(--clay)" stroke-width="1.4" transform="translate(575,125)"/>' +
          '  <path class="pf-chart1b" d="" fill="none" stroke="var(--c-ts)" stroke-width="1.2" transform="translate(575,125)"/>' +
          '  <!-- 数据面板2：孔眼相位分布（c-opt 蓝极坐标） -->' +
          panel(575, 230, '孔眼相位分布', 'var(--c-opt)', 52) +
          '  <g class="pf-chart2" transform="translate(575,230)"></g>' +
          '  <!-- HUD：clay 橙面板 -->' +
          '  <g transform="translate(575,20)"><rect width="215" height="95" rx="6" fill="var(--card)" fill-opacity=".75" stroke="var(--clay)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--clay)" font-weight="bold">Perf · 射孔参数</text>' +
          '    <line x1="10" y1="24" x2="205" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">枪型 <tspan class="pf-h1" fill="var(--jade-d)">--</tspan> · 相位 <tspan class="pf-h2" fill="var(--c-opt)">--°</tspan></text>' +
          '    <text x="10" y="58" font-size="9" fill="var(--ink-2)">孔密 <tspan class="pf-h3" fill="var(--c-ts)">-- spm</tspan> · 总弹 <tspan class="pf-h4" fill="var(--c-kg)">--</tspan></text>' +
          '    <text x="10" y="78" font-size="9" fill="var(--ink-2)">监测 <tspan class="pf-h5" fill="var(--clay)">--</tspan></text>' +
          '    <circle cx="205" cy="16" r="5" fill="none" stroke="var(--clay)" stroke-width="1.2"/><text x="197" y="19" font-size="7" fill="var(--clay)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          $('.pf-gun', svg).setAttribute('transform', 'translate(0,' + (sub * 120).toFixed(1) + ')');
        } else if (step === 1) {
          // 逐颗射孔弹发射（闪烁 + 冲击波扩张）
          $('.pf-blast', svg).setAttribute('opacity', '1');
          var t = (sub - 0.3) / 0.7;
          if (t > 0) {
            $('.bl1', svg).setAttribute('r', (3 + t * 55).toFixed(1));
            $('.bl1', svg).setAttribute('stroke-opacity', Math.max(0, 1 - t).toFixed(2));
            $('.bl2', svg).setAttribute('r', (3 + t * 75).toFixed(1));
            $('.bl2', svg).setAttribute('stroke-opacity', Math.max(0, 0.8 - t).toFixed(2));
            $('.bl3', svg).setAttribute('r', (3 + t * 20).toFixed(1));
            $('.bl3', svg).setAttribute('fill-opacity', Math.max(0, 0.6 - t * 0.6).toFixed(2));
          }
          $('.pf-rays', svg).setAttribute('opacity', '1');
          var cx = 500, cy = 280, L = sub * 65;
          [0, 1, 2, 3, 4, 5].forEach(function (i) {
            var a = -Math.PI / 2 + (i - 2.5) * (Math.PI / 8);
            var r = $('.pr' + (i + 1), svg);
            r.setAttribute('d', 'M' + cx + ',' + cy + ' L' + (cx + Math.cos(a) * L).toFixed(1) + ',' + (cy + Math.sin(a) * L).toFixed(1));
            r.setAttribute('stroke-opacity', Math.max(0, 0.85 - sub * 0.6).toFixed(2));
          });
          $('.pf-holes', svg).setAttribute('opacity', Math.min(1, sub * 2).toFixed(2));
          // 射孔压力脉冲曲线：逐颗发射产生压力尖峰
          var np = 60, cutp = Math.floor(np * sub);
          var pulse = [];
          for (var pi = 0; pi < np; pi++) {
            var pt = pi / np;
            var v = 0.1 + 0.7 * Math.exp(-Math.pow((pt * 6 - Math.floor(pt * 6)) / 0.06, 2));
            pulse.push(v);
          }
          $('.pf-chart1', svg).setAttribute('d', linePath(pulse.slice(0, cutp + 1), 12, 32, 206, 48));
          $('.pf-chart1b', svg).setAttribute('d', linePath(genWave(np, 0.08, 8, 0, 0.15).slice(0, cutp + 1), 12, 32, 206, 48));
        } else if (step === 2) {
          $('.pf-holes', svg).setAttribute('opacity', '1');
          $all('.pf-shots .sh', svg).forEach(function (el, i) {
            el.setAttribute('fill-opacity', sub > i * 0.15 ? '1' : '0.3');
            el.setAttribute('fill', sub > i * 0.15 ? 'var(--clay)' : 'var(--jade)');
          });
          $('.pf-h1', svg).textContent = '51/2"';
          $('.pf-h2', svg).textContent = '60°';
          $('.pf-h3', svg).textContent = '12';
          $('.pf-h4', svg).textContent = '72';
          // 孔眼相位分布极坐标图（6 相位，60° 间隔）
          var pcx = 115, pcy = 56, prr = 20;
          var pgrid = '<circle cx="' + pcx + '" cy="' + pcy + '" r="' + prr + '" fill="none" stroke="var(--ink-3)" stroke-opacity=".2"/>';
          var paxes = '';
          for (var ai = 0; ai < 6; ai++) {
            var aa = -Math.PI / 2 + ai * Math.PI / 3;
            paxes += '<line x1="' + pcx + '" y1="' + pcy + '" x2="' + (pcx + Math.cos(aa) * prr) + '" y2="' + (pcy + Math.sin(aa) * prr) + '" stroke="var(--ink-3)" stroke-opacity=".2"/>';
          }
          var pmarks = '';
          for (var mi = 0; mi < 6; mi++) {
            var ma = -Math.PI / 2 + mi * Math.PI / 3;
            var visible = sub > mi * 0.15;
            pmarks += '<circle cx="' + (pcx + Math.cos(ma) * prr).toFixed(1) + '" cy="' + (pcy + Math.sin(ma) * prr).toFixed(1) + '" r="3" fill="var(--c-opt)" fill-opacity="' + (visible ? '.9' : '0') + '"/>';
          }
          $('.pf-chart2', svg).innerHTML = pgrid + paxes + pmarks;
        } else if (step === 3) {
          $('.pf-h5', svg).textContent = sub > 0.5 ? '成功 ✓' : '监测中...';
          $('.pf-blast', svg).setAttribute('opacity', sub < 0.3 ? sub * 3 : 0);
          $all('.pf-shots .sh', svg).forEach(function (el) { el.setAttribute('fill', 'var(--clay)'); });
          // 最终压力曲线 + 全相位点亮
          $('.pf-chart1', svg).setAttribute('d', linePath(genWave(60, 0.1, 10, 0, 0.2), 12, 32, 206, 48));
          var pcx2 = 115, pcy2 = 56, prr2 = 20;
          var pgrid2 = '<circle cx="' + pcx2 + '" cy="' + pcy2 + '" r="' + prr2 + '" fill="none" stroke="var(--ink-3)" stroke-opacity=".2"/>';
          var pmarks2 = '';
          for (var mi2 = 0; mi2 < 6; mi2++) {
            var ma2 = -Math.PI / 2 + mi2 * Math.PI / 3;
            pmarks2 += '<circle cx="' + (pcx2 + Math.cos(ma2) * prr2).toFixed(1) + '" cy="' + (pcy2 + Math.sin(ma2) * prr2).toFixed(1) + '" r="3" fill="var(--c-opt)" fill-opacity=".9"/>';
          }
          $('.pf-chart2', svg).innerHTML = pgrid2 + pmarks2;
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑨ 采油 — jade 游梁 + clay 曲柄旋转 + c-cv 示功图椭圆 + 管线
       ═════════════════════════════════════════════════════════════ */
    production: {
      title: '采油', subtitle: '游梁泵抽油 · 示功图监测 · 产量预测与工况诊断', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 背景 -->' +
          '  <rect width="800" height="100" fill="url(#sky)"/>' +
          '  <rect y="100" width="800" height="320" fill="url(#earthG)" fill-opacity=".35"/>' +
          '  <rect y="150" width="800" height="60" fill="var(--ink-3)" fill-opacity=".2"/>' +
          '  <rect y="210" width="800" height="60" fill="var(--clay)" fill-opacity=".15"/><text x="10" y="232" font-size="8" fill="var(--clay)">油藏</text>' +
          '  <!-- 抽油机底座 (ink-2) -->' +
          '  <g transform="translate(180,170)">' +
          '    <rect width="140" height="30" fill="var(--ink-2)" fill-opacity=".8" rx="2"/>' +
          '    <rect x="10" y="30" width="120" height="15" fill="var(--ink-2)" fill-opacity=".6"/>' +
          '    <!-- 支架 -->' +
          '    <rect x="62" y="-80" width="16" height="80" fill="var(--ink-2)" fill-opacity=".75"/>' +
          '    <polygon points="62,-80 78,-80 70,-100" fill="var(--jade)" fill-opacity=".7"/>' +
          '  </g>' +
          '  <!-- 曲柄箱 (clay 橙，带旋转标记) -->' +
          '  <g class="pr-crank" transform="translate(320,185)">' +
          '    <rect x="-22" y="-22" width="44" height="44" fill="var(--ink-2)" fill-opacity=".7" rx="4"/>' +
          '    <circle class="cr-disc" cx="0" cy="0" r="18" fill="var(--clay)" fill-opacity=".8"/>' +
          '    <line class="cr-arm" x1="0" y1="0" x2="16" y2="-10" stroke="var(--clay)" stroke-width="3" stroke-linecap="round"/>' +
          '    <circle cx="0" cy="0" r="4" fill="var(--ink-2)"/>' +
          '  </g>' +
          '  <!-- 连杆 (jade 绿) -->' +
          '  <line class="pr-rod" x1="330" y1="175" x2="120" y2="100" stroke="var(--jade)" stroke-width="3.5" stroke-linecap="round"/>' +
          '  <!-- 游梁 (jade 主色，大横梁) -->' +
          '  <g class="pr-beam">' +
          '    <line x1="70" y1="100" x2="200" y2="100" stroke="var(--jade)" stroke-width="6" stroke-linecap="round"/>' +
          '    <line x1="70" y1="103" x2="200" y2="103" stroke="var(--jade-d)" stroke-width="1.5"/>' +
          '    <!-- 驴头 (clay 橙，弧形) -->' +
          '    <path class="pr-donkey" d="M50,100 Q40,110 45,125 L60,125 L65,100 Z" fill="var(--clay)" fill-opacity=".8"/>' +
          '    <!-- 平衡块 (c-opt 蓝) -->' +
          '    <rect x="200" y="90" width="20" height="22" fill="var(--c-opt)" fill-opacity=".7"/>' +
          '  </g>' +
          '  <!-- 光杆 (jade 绿，井筒口) -->' +
          '  <g class="pr-sucker">' +
          '    <line class="pr-wire" x1="52" y1="125" x2="52" y2="260" stroke="var(--jade)" stroke-width="2.5"/>' +
          '    <circle cx="52" cy="260" r="6" fill="var(--clay)" fill-opacity=".5"/>' +
          '  </g>' +
          '  <!-- 井口 (ink-2 + clay 橙) -->' +
          '  <g transform="translate(40,260)">' +
          '    <rect width="24" height="18" fill="var(--ink-2)"/>' +
          '    <rect x="-4" y="0" width="32" height="3" fill="var(--clay)"/>' +
          '  </g>' +
          '  <!-- 采油管线 (jade 绿 + clay 橙流动粒子) -->' +
          '  <path d="M64,275 Q120,275 180,265 L350,265" fill="none" stroke="var(--jade)" stroke-width="4" stroke-opacity=".55"/>' +
          '  <g class="pr-pipe">' +
          '    <circle class="pp pp1" cx="100" cy="272" r="2" fill="var(--clay)"/>' +
          '    <circle class="pp pp2" cx="160" cy="268" r="2" fill="var(--clay)"/>' +
          '    <circle class="pp pp3" cx="220" cy="266" r="2" fill="var(--clay)"/>' +
          '    <circle class="pp pp4" cx="290" cy="265" r="2" fill="var(--clay)"/>' +
          '  </g>' +
          '  <!-- 储油罐 (c-kg 黄绿) -->' +
          '  <g transform="translate(520,215)">' +
          '    <rect width="80" height="55" fill="var(--ink-2)" fill-opacity=".7"/>' +
          '    <rect x="4" y="6" width="72" height="20" fill="var(--c-kg)" fill-opacity=".4"/>' +
          '    <line x1="0" y1="15" x2="80" y2="15" stroke="var(--ink-3)" stroke-width=".5" stroke-dasharray="2 2"/>' +
          '    <line x1="0" y1="30" x2="80" y2="30" stroke="var(--ink-3)" stroke-width=".5" stroke-dasharray="2 2"/>' +
          '    <text x="40" y="78" text-anchor="middle" font-size="8" fill="var(--c-kg)">Tank</text>' +
          '  </g>' +
          '  <!-- 示功图 (c-cv 青椭圆轨迹) -->' +
          '  <g transform="translate(560,40)">' +
          '    <rect width="200" height="120" fill="var(--card)" fill-opacity=".8" stroke="var(--c-cv)" stroke-width="1"/>' +
          '    <text x="10" y="16" font-size="9" fill="var(--c-cv)" font-weight="bold">示功图 · Dynamometer Card</text>' +
          '    <!-- 网格 -->' +
          '    <g stroke="var(--ink-3)" stroke-width=".5" stroke-opacity=".3">' +
          '      <line x1="30" y1="30" x2="190" y2="30"/><line x1="30" y1="50" x2="190" y2="50"/>' +
          '      <line x1="30" y1="70" x2="190" y2="70"/><line x1="30" y1="90" x2="190" y2="90"/><line x1="30" y1="108" x2="190" y2="108"/>' +
          '      <line x1="30" y1="30" x2="30" y2="108"/><line x1="70" y1="30" x2="70" y2="108"/>' +
          '      <line x1="110" y1="30" x2="110" y2="108"/><line x1="150" y1="30" x2="150" y2="108"/><line x1="190" y1="30" x2="190" y2="108"/>' +
          '    </g>' +
          '    <g class="pr-card">' +
          '      <path class="card-line" d="" fill="none" stroke="var(--c-cv)" stroke-width="1.5"/>' +
          '      <circle class="card-pt" cx="30" cy="70" r="3" fill="var(--clay)"/>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 数据面板1：日产油量曲线（clay 橙） -->' +
          panel(555, 20, '日产油量 (m³/d)', 'var(--clay)', 52) +
          '  <path class="pr-chart1" d="" fill="none" stroke="var(--clay)" stroke-width="1.4" transform="translate(555,20)"/>' +
          '  <path class="pr-chart1b" d="" fill="none" stroke="var(--jade-d)" stroke-width="1.2" transform="translate(555,20)"/>' +
          '  <!-- 数据面板2：泵效与充满系数（c-kg 黄绿） -->' +
          panel(555, 125, '泵效 & 充满系数', 'var(--c-kg)', 52) +
          '  <g class="pr-chart2" transform="translate(555,125)"></g>' +
          '  <!-- HUD：c-cv 青面板 -->' +
          '  <g transform="translate(555,340)"><rect width="240" height="75" rx="6" fill="var(--card)" fill-opacity=".75" stroke="var(--c-cv)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-cv)" font-weight="bold">CV · 示功图诊断</text>' +
          '    <line x1="10" y1="24" x2="230" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">冲程 <tspan class="pr-h1" fill="var(--jade-d)">-- m</tspan> · 冲次 <tspan class="pr-h2" fill="var(--c-ts)">-- spm</tspan></text>' +
          '    <text x="10" y="60" font-size="9" fill="var(--ink-2)">日产量 <tspan class="pr-h3" fill="var(--clay)">-- m³</tspan> · 诊断 <tspan class="pr-h4" fill="var(--c-nlp)">--</tspan></text>' +
          '    <circle cx="230" cy="16" r="5" fill="none" stroke="var(--c-cv)" stroke-width="1.2"/><text x="222" y="19" font-size="7" fill="var(--c-cv)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          var ang = sub * 720;
          $('.cr-disc', svg).setAttribute('transform', 'rotate(' + ang + ')');
          $('.cr-arm', svg).setAttribute('transform', 'rotate(' + ang + ')');
        } else if (step === 1) {
          // 游梁随曲柄同步摆动
          var ang2 = sub * 720;
          var cx = 320, cy = 185;
          var crankR = 18, offset = 30;
          var ca = ang2 * Math.PI / 180;
          var crankEndX = cx + Math.cos(ca) * crankR;
          var crankEndY = cy + Math.sin(ca) * crankR;
          // 近似驴头端点 y
          var donkeyY = 125 - (Math.sin(ca) * 14);
          $('.pr-donkey', svg).setAttribute('transform', 'translate(0,' + (donkeyY - 125).toFixed(1) + ')');
          $('.pr-beam', svg).setAttribute('transform', 'translate(0,' + (donkeyY - 125).toFixed(1) + ')');
          $('.pr-wire', svg).setAttribute('y1', (125 + donkeyY - 125).toFixed(1));
          // 管线流动粒子
          $all('.pp', svg).forEach(function (el, i) {
            var x = 100 + ((sub * 400 + i * 30) % 300);
            el.setAttribute('cx', x.toFixed(1));
          });
        } else if (step === 2) {
          // 示功图椭圆轨迹
          var W = 160, H = 78, ox = 30, oy = 30;
          var d = '';
          for (var i = 0; i <= 120; i++) {
            var t = (i / 120) * Math.PI * 2;
            var x = ox + W / 2 + Math.cos(t) * W / 2 * (0.85 + 0.15 * Math.sin(t * 2));
            var y = oy + H / 2 + Math.sin(t) * H / 2 * (0.9);
            d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
          }
          $('.card-line', svg).setAttribute('d', d);
          // 示功图上的点随曲柄移动
          var ca2 = sub * Math.PI * 2;
          var px = ox + W / 2 + Math.cos(ca2) * W / 2 * (0.85 + 0.15 * Math.sin(ca2 * 2));
          var py = oy + H / 2 + Math.sin(ca2) * H / 2 * 0.9;
          $('.card-pt', svg).setAttribute('cx', px.toFixed(1));
          $('.card-pt', svg).setAttribute('cy', py.toFixed(1));
          $('.pr-h1', svg).textContent = '3.6'; $('.pr-h2', svg).textContent = '4.2';
          $('.pr-h3', svg).textContent = Math.round(120 + sub * 30);
          // 日产油量曲线（clay 橙）+ 含水率（jade 绿）
          var npr = 50, cutpr = Math.floor(npr * sub);
          $('.pr-chart1', svg).setAttribute('d', linePath(genWave(npr, 0.15, 2, 0.5, 0.6).slice(0, cutpr + 1), 12, 32, 206, 48));
          $('.pr-chart1b', svg).setAttribute('d', linePath(genWave(npr, 0.1, 3, 1, 0.3).slice(0, cutpr + 1), 12, 32, 206, 48));
          // 泵效 & 充满系数柱状图
          var peff = [0.85, 0.72, 0.68 + sub * 0.15, 0.9, 0.78];
          $('.pr-chart2', svg).innerHTML = bars(peff, 14, 32, 202, 48, 'var(--c-kg)', 4);
        } else if (step === 3) {
          $('.cr-disc', svg).setAttribute('transform', 'rotate(' + (sub * 360) + ')');
          $('.cr-arm', svg).setAttribute('transform', 'rotate(' + (sub * 360) + ')');
          $('.pr-h4', svg).textContent = sub > 0.5 ? '正常 ✓' : '监测中...';
          $all('.pp', svg).forEach(function (el, i) {
            var x = 100 + ((sub * 400 + i * 30) % 300);
            el.setAttribute('cx', x.toFixed(1));
          });
          $('.pr-chart1', svg).setAttribute('d', linePath(genWave(50, 0.15, 2, 0.5, 0.6), 12, 32, 206, 48));
          $('.pr-chart2', svg).innerHTML = bars([0.85, 0.72, 0.83, 0.9, 0.78], 14, 32, 202, 48, 'var(--c-kg)', 4);
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑩ 修井 — clay 落鱼残骸 + jade 打捞筒 + c-nlp AI 诊断面板
       ═════════════════════════════════════════════════════════════ */
    workover: {
      title: '修井', subtitle: '落鱼打捞 · 井筒清理 · AI 诊断与方案匹配', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 背景 + 井筒 -->' +
          '  <rect width="800" height="110" fill="url(#sky)"/>' +
          '  <rect y="110" width="800" height="310" fill="url(#earthG)" fill-opacity=".35"/>' +
          '  <rect y="130" width="800" height="60" fill="var(--ink-3)" fill-opacity=".22"/>' +
          '  <rect y="190" width="800" height="50" fill="var(--ink-2)" fill-opacity=".2"/>' +
          '  <!-- 井筒 (clay 橙) -->' +
          '  <rect x="485" y="110" width="30" height="310" fill="var(--ink-2)" fill-opacity=".3"/>' +
          '  <rect x="480" y="110" width="5" height="310" fill="var(--clay)" fill-opacity=".45"/>' +
          '  <rect x="515" y="110" width="5" height="310" fill="var(--clay)" fill-opacity=".45"/>' +
          '  <!-- 井口 (jade 绿 + clay 橙) -->' +
          '  <g transform="translate(495,80)">' +
          '    <rect x="-30" y="0" width="60" height="30" fill="var(--ink-2)"/>' +
          '    <rect x="-25" y="-12" width="50" height="14" fill="var(--jade)" fill-opacity=".7"/>' +
          '    <rect x="-35" y="-2" width="70" height="4" fill="var(--clay)" fill-opacity=".6"/>' +
          '  </g>' +
          '  <!-- 修井机（简化井架 + 滚筒） -->' +
          '  <g transform="translate(120,120)">' +
          '    <polygon points="0,10 40,10 20,-80" fill="var(--ink-2)" fill-opacity=".65"/>' +
          '    <line x1="0" y1="10" x2="20" y2="-80" stroke="var(--jade)" stroke-width="1" stroke-opacity=".5"/>' +
          '    <line x1="40" y1="10" x2="20" y2="-80" stroke="var(--jade)" stroke-width="1" stroke-opacity=".5"/>' +
          '    <rect x="60" y="5" width="40" height="25" fill="var(--ink-2)" fill-opacity=".6"/>' +
          '    <circle cx="80" cy="17" r="8" fill="var(--clay)" fill-opacity=".7"/>' +
          '  </g>' +
          '  <!-- 打捞筒 (jade 绿，完整设备模型) -->' +
          '  <g class="wo-liber">' +
          '    <!-- 钢丝 -->' +
          '    <line class="wo-wire" x1="500" y1="110" x2="500" y2="110" stroke="var(--ink-2)" stroke-width="1"/>' +
          '    <!-- 打捞筒主体 -->' +
          '    <g class="wo-sleeve">' +
          '      <rect x="492" y="120" width="16" height="28" fill="var(--jade)" fill-opacity=".8"/>' +
          '      <rect x="494" y="125" width="12" height="4" fill="var(--clay)" fill-opacity=".6"/>' +
          '      <polygon points="492,148 508,148 500,156" fill="var(--jade)"/>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 落鱼残骸 (clay 橙 + ink-2 残片) -->' +
          '  <g class="wo-fish">' +
          '    <polygon class="ff f1" points="490,290 510,285 508,300 492,298" fill="var(--clay)" fill-opacity=".8"/>' +
          '    <rect class="ff f2" x="495" y="305" width="10" height="14" fill="var(--ink-2)" fill-opacity=".7" transform="rotate(15 500 312)"/>' +
          '    <circle class="ff f3" cx="500" cy="335" r="6" fill="var(--clay)" fill-opacity=".6"/>' +
          '    <polygon class="ff f4" points="488,350 512,348 510,365 490,362" fill="var(--ink-2)" fill-opacity=".8"/>' +
          '    <text x="525" y="320" font-size="8" fill="var(--clay)">⚠ 落鱼</text>' +
          '  </g>' +
          '  <!-- 打捞成功标记 (c-cv 青) -->' +
          '  <g class="wo-mark" opacity="0">' +
          '    <circle cx="500" cy="293" r="15" fill="none" stroke="var(--c-cv)" stroke-width="1.5" stroke-dasharray="3 2"/>' +
          '    <text x="500" y="278" font-size="8" fill="var(--c-cv)" text-anchor="middle">✓ 捕获</text>' +
          '  </g>' +
          '  <!-- 数据面板1：打捞张力曲线（c-cv 青） -->' +
          panel(560, 20, '打捞张力 (kN)', 'var(--c-cv)', 52) +
          '  <path class="wo-chart1" d="" fill="none" stroke="var(--c-cv)" stroke-width="1.4" transform="translate(560,20)"/>' +
          '  <path class="wo-chart1b" d="" fill="none" stroke="var(--clay)" stroke-width="1.2" transform="translate(560,20)"/>' +
          '  <!-- 数据面板2：落鱼深度 & 卡点（clay 橙） -->' +
          panel(560, 125, '落鱼深度 & 卡点', 'var(--clay)', 52) +
          '  <g class="wo-chart2" transform="translate(560,125)"></g>' +
          '  <!-- AI 诊断面板 (c-nlp 紫，4 条逐项亮起) -->' +
          '  <g transform="translate(40,215)"><rect width="260" height="195" rx="6" fill="var(--card)" fill-opacity=".78" stroke="var(--c-nlp)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-nlp)" font-weight="bold">NLP · 落鱼诊断</text>' +
          '    <line x1="10" y1="24" x2="250" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text class="wo-diag d1" x="10" y="44" font-size="9" fill="var(--ink-3)">① 落鱼类型： --</text>' +
          '    <text class="wo-diag d2" x="10" y="62" font-size="9" fill="var(--ink-3)">② 卡点深度： -- m</text>' +
          '    <text class="wo-diag d3" x="10" y="80" font-size="9" fill="var(--ink-3)">③ 打捞工具： --</text>' +
          '    <text class="wo-diag d4" x="10" y="98" font-size="9" fill="var(--ink-3)">④ 邻井案例： -- 例</text>' +
          '    <line x1="10" y1="115" x2="250" y2="115" stroke="var(--line)" stroke-width=".5"/>' +
          '    <text x="10" y="132" font-size="8" fill="var(--c-nlp)">方案匹配度</text>' +
          '    <rect x="10" y="138" width="240" height="10" fill="var(--ink-3)" fill-opacity=".25" rx="2"/>' +
          '    <rect class="wo-bar" x="10" y="138" width="0" height="10" fill="var(--c-nlp)" rx="2"/>' +
          '    <text class="wo-score" x="250" y="162" font-size="10" fill="var(--c-nlp)" text-anchor="end">0%</text>' +
          '    <circle cx="250" cy="16" r="5" fill="none" stroke="var(--c-nlp)" stroke-width="1.2"/><text x="242" y="19" font-size="7" fill="var(--c-nlp)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          var wy = 110 + sub * 180;
          $('.wo-wire', svg).setAttribute('y1', wy.toFixed(1));
          $('.wo-wire', svg).setAttribute('y2', wy.toFixed(1));
          $('.wo-sleeve', svg).setAttribute('transform', 'translate(0,' + (wy - 110).toFixed(1) + ')');
        } else if (step === 1) {
          $('.wo-mark', svg).setAttribute('opacity', sub.toFixed(2));
          $all('.wo-diag', svg).forEach(function (el, i) {
            el.setAttribute('fill', sub > i * 0.25 ? 'var(--c-nlp)' : 'var(--ink-3)');
          });
          $('.wo-diag.d1', svg).textContent = '① 落鱼类型：钻杆接头';
          $('.wo-diag.d2', svg).textContent = '② 卡点深度： ' + Math.round(2150 + sub * 20) + ' m';
          $('.wo-bar', svg).setAttribute('width', (sub * 200).toFixed(1));
          $('.wo-score', svg).textContent = Math.round(sub * 85) + '%';
          // 打捞张力曲线：捕获时张力突升
          var nwo = 50, cutwo = Math.floor(nwo * sub);
          var tens = [];
          for (var wi = 0; wi < nwo; wi++) {
            var wt = wi / nwo;
            var wv = 0.3 + 0.5 * Math.exp(-Math.pow((wt - 0.6) / 0.12, 2));
            tens.push(wv);
          }
          $('.wo-chart1', svg).setAttribute('d', linePath(tens.slice(0, cutwo + 1), 12, 32, 206, 48));
          $('.wo-chart1b', svg).setAttribute('d', linePath(genWave(nwo, 0.06, 6, 0, 0.2).slice(0, cutwo + 1), 12, 32, 206, 48));
        } else if (step === 2) {
          $all('.wo-diag', svg).forEach(function (el) { el.setAttribute('fill', 'var(--c-nlp)'); });
          $('.wo-diag.d3', svg).textContent = '③ 打捞工具：反扣捞筒 + 震击器';
          $('.wo-diag.d4', svg).textContent = '④ 邻井案例： 12 例 / 成功率 92%';
          $('.wo-bar', svg).setAttribute('width', '210');
          $('.wo-score', svg).textContent = '88%';
          // 落鱼残骸开始被向上拖（模拟打捞）
          $all('.ff', svg).forEach(function (el, i) {
            el.setAttribute('transform', 'translate(0,' + (-sub * 80 - i * 3).toFixed(1) + ')');
            el.setAttribute('opacity', (1 - sub * 0.5).toFixed(2));
          });
          // 落鱼深度 & 卡点柱状图
          $('.wo-chart2', svg).innerHTML = bars([0.95, 0.7, 0.85], 14, 32, 202, 48, 'var(--clay)', 8);
        } else if (step === 3) {
          $('.wo-wire', svg).setAttribute('y1', (290 - sub * 100).toFixed(1));
          $('.wo-wire', svg).setAttribute('y2', (290 - sub * 100).toFixed(1));
          $('.wo-sleeve', svg).setAttribute('transform', 'translate(0,' + (180 - sub * 80).toFixed(1) + ')');
          $('.wo-mark', svg).setAttribute('opacity', '1');
          $('.wo-chart2', svg).innerHTML = bars([0.95, 0.7, 0.4], 14, 32, 202, 48, 'var(--clay)', 8);
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑪ 增采 — jade 水平井筒 + c-opt 压力脉冲 + jade/clay/c-cv 三色彩虹裂缝
       ═════════════════════════════════════════════════════════════ */
    eor: {
      title: '增采', subtitle: '水平井压裂 · 多簇裂缝 · 代理模型优化施工参数', duration: 11000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 背景 + 油藏 -->' +
          '  <rect y="100" width="800" height="320" fill="url(#earthG)" fill-opacity=".4"/>' +
          '  <rect y="160" width="800" height="80" fill="var(--clay)" fill-opacity=".15"/><text x="10" y="182" font-size="8" fill="var(--clay)">目标储层 (致密油)</text>' +
          '  <rect y="240" width="800" height="60" fill="var(--ink-3)" fill-opacity=".2"/>' +
          '  <rect y="300" width="800" height="120" fill="var(--ink-2)" fill-opacity=".25"/>' +
          '  <!-- 直井 + 水平井筒 (jade 绿) -->' +
          '  <rect x="388" y="0" width="24" height="250" fill="var(--jade)" fill-opacity=".45"/>' +
          '  <rect x="60" y="240" width="328" height="20" fill="var(--jade)" fill-opacity=".55"/>' +
          '  <!-- 井口装置 -->' +
          '  <g transform="translate(400,0)">' +
          '    <rect x="-28" y="-20" width="56" height="20" fill="var(--ink-2)"/>' +
          '    <rect x="-25" y="-30" width="50" height="10" fill="var(--jade)" fill-opacity=".7"/>' +
          '    <rect x="-35" y="-2" width="70" height="4" fill="var(--clay)" fill-opacity=".6"/>' +
          '  </g>' +
          '  <!-- 压裂泵 (clay 陶土橙完整设备) -->' +
          '  <g transform="translate(40,50)">' +
          '    <rect width="90" height="50" fill="var(--ink-2)" fill-opacity=".75"/>' +
          '    <rect x="5" y="6" width="80" height="18" fill="var(--clay)" fill-opacity=".6"/>' +
          '    <circle cx="20" cy="38" r="6" fill="var(--c-opt)" fill-opacity=".7"/>' +
          '    <circle cx="45" cy="38" r="6" fill="var(--c-opt)" fill-opacity=".5"/>' +
          '    <circle cx="70" cy="38" r="6" fill="var(--c-opt)" fill-opacity=".5"/>' +
          '    <text x="45" y="70" text-anchor="middle" font-size="8" fill="var(--clay)">Frac Pump</text>' +
          '  </g>' +
          '  <!-- 压裂管线 (jade 绿 + clay 橙流体) -->' +
          '  <path d="M130,75 Q180,75 230,85 L380,85" fill="none" stroke="var(--jade)" stroke-width="3.5" stroke-opacity=".6"/>' +
          '  <path class="eor-flow" d="M130,75 Q180,75 230,85 L380,85" fill="none" stroke="var(--clay)" stroke-width="1.5" stroke-dasharray="6 3"/>' +
          '  <!-- 水平井筒压力脉冲 (c-opt 蓝) -->' +
          '  <g class="eor-pulse" opacity="0">' +
          '    <g class="pu pu1"><rect x="100" y="240" width="10" height="20" fill="var(--c-opt)" fill-opacity=".5"/><circle cx="105" cy="250" r="12" fill="none" stroke="var(--c-opt)" stroke-width="1.2"/></g>' +
          '    <g class="pu pu2"><rect x="200" y="240" width="10" height="20" fill="var(--c-opt)" fill-opacity=".5"/><circle cx="205" cy="250" r="12" fill="none" stroke="var(--c-opt)" stroke-width="1.2"/></g>' +
          '    <g class="pu pu3"><rect x="300" y="240" width="10" height="20" fill="var(--c-opt)" fill-opacity=".5"/><circle cx="305" cy="250" r="12" fill="none" stroke="var(--c-opt)" stroke-width="1.2"/></g>' +
          '  </g>' +
          '  <!-- 多簇裂缝 (3 色：jade 主裂缝 / clay 次裂缝 / c-cv 微裂缝) -->' +
          '  <g class="eor-fracs" opacity="0">' +
          '    <!-- 主裂缝 (jade 绿) -->' +
          '    <g stroke="var(--jade)" stroke-width="2" fill="none" stroke-linecap="round">' +
          '      <path class="fr f1" d="M105,250 L105,250"/>' +
          '      <path class="fr f2" d="M205,250 L205,250"/>' +
          '      <path class="fr f3" d="M305,250 L305,250"/>' +
          '    </g>' +
          '    <!-- 次裂缝 (clay 橙) -->' +
          '    <g stroke="var(--clay)" stroke-width="1.2" fill="none" stroke-linecap="round">' +
          '      <path class="sfr sf1" d="M105,250 L105,250"/>' +
          '      <path class="sfr sf2" d="M205,250 L205,250"/>' +
          '      <path class="sfr sf3" d="M305,250 L305,250"/>' +
          '    </g>' +
          '    <!-- 微裂缝 (c-cv 青) -->' +
          '    <g stroke="var(--c-cv)" stroke-width=".7" fill="none" stroke-linecap="round">' +
          '      <path class="mfr mf1" d="M105,250 L105,250"/>' +
          '      <path class="mfr mf2" d="M205,250 L205,250"/>' +
          '      <path class="mfr mf3" d="M305,250 L305,250"/>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 支撑剂砂粒 (c-kg 黄绿 + clay 橙) -->' +
          '  <g class="eor-sand" opacity="0">' +
          '    <circle class="sd sd1" cx="107" cy="260" r="1.5" fill="var(--c-kg)"/>' +
          '    <circle class="sd sd2" cx="103" cy="270" r="1.8" fill="var(--clay)"/>' +
          '    <circle class="sd sd3" cx="207" cy="262" r="1.6" fill="var(--c-kg)"/>' +
          '    <circle class="sd sd4" cx="203" cy="275" r="1.4" fill="var(--clay)"/>' +
          '    <circle class="sd sd5" cx="307" cy="258" r="1.7" fill="var(--c-kg)"/>' +
          '    <circle class="sd sd6" cx="303" cy="275" r="1.5" fill="var(--clay)"/>' +
          '  </g>' +
          '  <!-- 数据面板1：压裂施工压力曲线（clay 橙） -->' +
          panel(560, 160, '压裂施工压力 (MPa)', 'var(--clay)', 52) +
          '  <path class="er-chart1" d="" fill="none" stroke="var(--clay)" stroke-width="1.4" transform="translate(560,160)"/>' +
          '  <path class="er-chart1b" d="" fill="none" stroke="var(--jade-d)" stroke-width="1.2" transform="translate(560,160)"/>' +
          '  <!-- 数据面板2：支撑剂浓度 & 裂缝半长（c-ts 橙） -->' +
          panel(560, 265, '支撑剂浓度 & 半长', 'var(--c-ts)', 52) +
          '  <g class="er-chart2" transform="translate(560,265)"></g>' +
          '  <!-- HUD：OPT 蓝面板 + 多色参数 -->' +
          '  <g transform="translate(560,20)"><rect width="225" height="130" rx="6" fill="var(--card)" fill-opacity=".78" stroke="var(--c-opt)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--c-opt)" font-weight="bold">OPT · 压裂施工</text>' +
          '    <line x1="10" y1="24" x2="215" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">泵压 <tspan class="er-h1" fill="var(--clay)">-- MPa</tspan></text>' +
          '    <text x="10" y="58" font-size="9" fill="var(--ink-2)">排量 <tspan class="er-h2" fill="var(--jade-d)">-- m³/min</tspan></text>' +
          '    <text x="10" y="74" font-size="9" fill="var(--ink-2)">砂浓度 <tspan class="er-h3" fill="var(--c-ts)">-- kg/m³</tspan></text>' +
          '    <text x="10" y="90" font-size="9" fill="var(--ink-2)">裂缝半长 <tspan class="er-h4" fill="var(--c-nlp)">-- m</tspan></text>' +
          '    <text x="10" y="108" font-size="8" fill="var(--c-kg)">代理模型：预测产量 ↑ 28%</text>' +
          '    <circle cx="215" cy="16" r="5" fill="none" stroke="var(--c-opt)" stroke-width="1.2"/><text x="207" y="19" font-size="7" fill="var(--c-opt)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          $('.eor-flow', svg).setAttribute('stroke-dashoffset', (-sub * 30).toFixed(1));
          $all('.pu', svg).forEach(function (el, i) {
            el.setAttribute('transform', 'translate(' + (-50 + sub * 180 + i * 0) + ',0)');
            el.setAttribute('opacity', Math.min(1, sub * 3 - i * 0.4).toFixed(2));
            var ring = el.querySelector('circle');
            if (ring) ring.setAttribute('r', (12 + sub * 25).toFixed(1));
          });
          $('.eor-pulse', svg).setAttribute('opacity', '1');
        } else if (step === 1) {
          $('.eor-fracs', svg).setAttribute('opacity', sub.toFixed(2));
          // 主裂缝 (jade) 增长
          [1, 2, 3].forEach(function (i) {
            var base = 250 + (i - 1) * 100;
            var len = sub * 45;
            $('.f' + i, svg).setAttribute('d', 'M' + base + ',250 L' + base + ',' + (250 - len).toFixed(1));
            $('.f' + (i + 3), svg) || $('.sfr').length;
            // 次裂缝 (clay)
            $('.sf' + i, svg).setAttribute('d', 'M' + base + ',250 L' + (base + 12 * sub).toFixed(1) + ',' + (250 - len * 0.7).toFixed(1));
            // 微裂缝 (c-cv)
            $('.mf' + i, svg).setAttribute('d', 'M' + base + ',250 L' + (base - 15 * sub).toFixed(1) + ',' + (250 - len * 0.4).toFixed(1));
          });
          $('.eor-sand', svg).setAttribute('opacity', Math.min(1, sub * 3).toFixed(2));
        } else if (step === 2) {
          // 全部裂缝展开完整形态（多分支）
          [1, 2, 3].forEach(function (i) {
            var base = 250 + (i - 1) * 100;
            var h = 45 + sub * 25;
            $('.f' + i, svg).setAttribute('d', 'M' + base + ',250 L' + base + ',' + (250 - h).toFixed(1) + ' L' + (base + 8).toFixed(1) + ',' + (250 - h - 10).toFixed(1));
            $('.sf' + i, svg).setAttribute('d', 'M' + base + ',250 L' + (base + 18 * sub).toFixed(1) + ',' + (250 - h * 0.8).toFixed(1) + ' M' + base + ',250 L' + (base - 12 * sub).toFixed(1) + ',' + (250 - h * 0.5).toFixed(1));
            $('.mf' + i, svg).setAttribute('d', 'M' + base + ',250 L' + (base + 22).toFixed(1) + ',' + (245 - h * 0.3).toFixed(1) + ' M' + base + ',250 L' + (base - 20).toFixed(1) + ',' + (255 - h * 0.2).toFixed(1));
          });
          $('.er-h1', svg).textContent = Math.round(35 + sub * 15) + ' MPa';
          $('.er-h2', svg).textContent = (10 + sub * 8).toFixed(1);
          $('.er-h3', svg).textContent = Math.round(300 + sub * 200);
          // 压裂施工压力曲线（clay 橙）+ 排量（jade 绿）
          var ner = 50, cuter = Math.floor(ner * sub);
          $('.er-chart1', svg).setAttribute('d', linePath(genWave(ner, 0.2, 2, 0.3, 0.5).slice(0, cuter + 1), 12, 32, 206, 48));
          $('.er-chart1b', svg).setAttribute('d', linePath(genWave(ner, 0.15, 3, 1, 0.4).slice(0, cuter + 1), 12, 32, 206, 48));
          // 支撑剂浓度 & 裂缝半长柱状图
          $('.er-chart2', svg).innerHTML = bars([0.4, 0.6, 0.8 + sub * 0.15, 0.9, 0.7], 14, 32, 202, 48, 'var(--c-ts)', 4);
        } else if (step === 3) {
          $('.er-h4', svg).textContent = Math.round(80 + sub * 30);
          $all('.pu', svg).forEach(function (el, i) {
            var ring = el.querySelector('circle');
            if (ring) ring.setAttribute('r', (12 + 15).toFixed(1));
          });
          $('.er-chart1', svg).setAttribute('d', linePath(genWave(50, 0.2, 2, 0.3, 0.55), 12, 32, 206, 48));
          $('.er-chart2', svg).innerHTML = bars([0.4, 0.6, 0.95, 0.9, 0.7], 14, 32, 202, 48, 'var(--c-ts)', 4);
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑫ 运输 — clay 流动油粒子 + c-opt 压力波双环 + clay 泄漏点预警
       ═════════════════════════════════════════════════════════════ */
    transport: {
      title: '运输', subtitle: '管网输送 · 压力时序监测 · AI 小样本异常检测', duration: 10000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 背景 -->' +
          '  <rect width="800" height="420" fill="var(--ink-1)" fill-opacity=".25"/>' +
          '  <!-- 管网主管道 (jade 绿 + clay 橙内芯) -->' +
          '  <g class="tr-main">' +
          '    <rect x="20" y="150" width="760" height="30" fill="var(--ink-2)" fill-opacity=".55" rx="4"/>' +
          '    <rect x="24" y="154" width="752" height="22" fill="var(--jade)" fill-opacity=".22" rx="3"/>' +
          '    <rect x="28" y="158" width="744" height="14" fill="var(--clay)" fill-opacity=".18"/>' +
          '  </g>' +
          '  <!-- 三个站场 (clay 橙完整模型) -->' +
          '  <g class="tr-station st1" transform="translate(80,95)">' +
          '    <rect width="50" height="55" fill="var(--ink-2)" fill-opacity=".7"/>' +
          '    <rect x="5" y="5" width="40" height="25" fill="var(--clay)" fill-opacity=".6"/>' +
          '    <circle cx="25" cy="43" r="5" fill="var(--c-opt)"/>' +
          '    <text x="25" y="72" text-anchor="middle" font-size="7" fill="var(--clay)">Pump A</text>' +
          '    <line x1="25" y1="55" x2="25" y2="95" stroke="var(--clay)" stroke-width="1.5"/>' +
          '  </g>' +
          '  <g class="tr-station st2" transform="translate(360,95)">' +
          '    <rect width="50" height="55" fill="var(--ink-2)" fill-opacity=".7"/>' +
          '    <rect x="5" y="5" width="40" height="25" fill="var(--clay)" fill-opacity=".6"/>' +
          '    <circle cx="25" cy="43" r="5" fill="var(--c-opt)"/>' +
          '    <text x="25" y="72" text-anchor="middle" font-size="7" fill="var(--clay)">Mid B</text>' +
          '    <line x1="25" y1="55" x2="25" y2="95" stroke="var(--clay)" stroke-width="1.5"/>' +
          '  </g>' +
          '  <g class="tr-station st3" transform="translate(640,95)">' +
          '    <rect width="50" height="55" fill="var(--ink-2)" fill-opacity=".7"/>' +
          '    <rect x="5" y="5" width="40" height="25" fill="var(--clay)" fill-opacity=".6"/>' +
          '    <circle cx="25" cy="43" r="5" fill="var(--c-opt)"/>' +
          '    <text x="25" y="72" text-anchor="middle" font-size="7" fill="var(--clay)">End C</text>' +
          '    <line x1="25" y1="55" x2="25" y2="95" stroke="var(--clay)" stroke-width="1.5"/>' +
          '  </g>' +
          '  <!-- 流动油粒子 (clay 橙主色) -->' +
          '  <g class="tr-flow">' +
          '    <circle class="fl f1" cx="80" cy="165" r="3" fill="var(--clay)" fill-opacity=".9"/>' +
          '    <circle class="fl f2" cx="180" cy="165" r="2.5" fill="var(--clay)" fill-opacity=".85"/>' +
          '    <circle class="fl f3" cx="280" cy="165" r="3" fill="var(--clay)" fill-opacity=".9"/>' +
          '    <circle class="fl f4" cx="380" cy="165" r="2.5" fill="var(--clay)" fill-opacity=".85"/>' +
          '    <circle class="fl f5" cx="480" cy="165" r="3" fill="var(--clay)" fill-opacity=".9"/>' +
          '    <circle class="fl f6" cx="580" cy="165" r="2.5" fill="var(--clay)" fill-opacity=".85"/>' +
          '    <circle class="fl f7" cx="680" cy="165" r="3" fill="var(--clay)" fill-opacity=".9"/>' +
          '  </g>' +
          '  <!-- 压力传感器 (c-cv 青) -->' +
          '  <g>' +
          '    <g class="sen s1"><rect x="160" y="182" width="10" height="14" fill="var(--c-cv)"/><circle cx="165" cy="189" r="2" fill="var(--clay)"/></g>' +
          '    <g class="sen s2"><rect x="320" y="182" width="10" height="14" fill="var(--c-cv)"/><circle cx="325" cy="189" r="2" fill="var(--clay)"/></g>' +
          '    <g class="sen s3"><rect x="470" y="182" width="10" height="14" fill="var(--c-cv)"/><circle cx="475" cy="189" r="2" fill="var(--clay)"/></g>' +
          '    <g class="sen s4"><rect x="600" y="182" width="10" height="14" fill="var(--c-cv)"/><circle cx="605" cy="189" r="2" fill="var(--clay)"/></g>' +
          '  </g>' +
          '  <!-- 泄漏点预警 (clay 橙闪烁 + 冲击波 c-opt 蓝) -->' +
          '  <g class="tr-leak" opacity="0">' +
          '    <circle cx="475" cy="165" r="10" fill="var(--clay)" fill-opacity=".3"/>' +
          '    <circle class="lk-r1" cx="475" cy="165" r="8" fill="none" stroke="var(--clay)" stroke-width="2"/>' +
          '    <circle class="lk-r2" cx="475" cy="165" r="8" fill="none" stroke="var(--c-opt)" stroke-width="1.5"/>' +
          '    <text x="475" y="135" font-size="9" fill="var(--clay)" text-anchor="middle" font-weight="bold">⚠ LEAK DETECTED</text>' +
          '  </g>' +
          '  <!-- 管道分段健康度（c-cv 青柱状图） -->' +
          '  <g transform="translate(560,18)"><rect width="225" height="62" rx="5" fill="var(--card)" fill-opacity=".8" stroke="var(--c-cv)" stroke-opacity=".35"/>' +
          '    <text x="10" y="14" font-size="9" fill="var(--c-cv)" font-weight="bold">管道分段健康度</text>' +
          '    <rect x="10" y="20" width="205" height="34" fill="var(--ink-3)" fill-opacity=".1" rx="2"/>' +
          '    <g class="tr-health"></g>' +
          '  </g>' +
          '  <!-- 压力时序曲线 (c-ts 橙 + c-opt 蓝 + c-nlp 紫检测线) -->' +
          '  <g transform="translate(40,230)"><rect width="720" height="175" fill="var(--card)" fill-opacity=".7" stroke="var(--c-ts)" stroke-width="1"/>' +
          '    <text x="10" y="16" font-size="9" fill="var(--c-ts)" font-weight="bold">压力时序 · Pipeline Pressure</text>' +
          '    <g stroke="var(--ink-3)" stroke-width=".5" stroke-opacity=".3">' +
          '      <line x1="30" y1="30" x2="700" y2="30"/><line x1="30" y1="70" x2="700" y2="70"/>' +
          '      <line x1="30" y1="110" x2="700" y2="110"/><line x1="30" y1="150" x2="700" y2="150"/>' +
          '    </g>' +
          '    <path class="tr-pcurve" d="" fill="none" stroke="var(--c-ts)" stroke-width="1.8"/>' +
          '    <g class="tr-anom" opacity="0">' +
          '      <path class="tr-abnormal" d="" fill="none" stroke="var(--clay)" stroke-width="2.5"/>' +
          '      <line class="tr-nlp-line" x1="30" y1="110" x2="700" y2="110" stroke="var(--c-nlp)" stroke-width="1" stroke-dasharray="4 3"/>' +
          '      <text x="695" y="105" font-size="8" fill="var(--c-nlp)" text-anchor="end">AI 检测阈值</text>' +
          '    </g>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          $all('.fl', svg).forEach(function (el, i) {
            var x = 80 + ((sub * 800 + i * 100) % 700);
            el.setAttribute('cx', x.toFixed(1));
          });
        } else if (step === 1) {
          // 画完整压力时序曲线（基线平稳）
          var pts = 80, ox = 30, oy = 100, w = 670;
          var d = '';
          for (var i = 0; i <= pts; i++) {
            var x = ox + (w * i / pts);
            var y = oy + Math.sin(i * 0.2) * 3 + (i < 50 ? 0 : -5 * (i - 50) / 30); // 前段平稳，后段下倾
            d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + (y).toFixed(1) + ' ';
          }
          $('.tr-pcurve', svg).setAttribute('d', d);
          // 管道分段健康度柱状图（8 段，第 5 段对应泄漏点健康度低）
          var health = [0.95, 0.9, 0.88, 0.92, 0.95, 0.9, 0.85, 0.93];
          $('.tr-health', svg).innerHTML = bars(health, 12, 22, 201, 30, 'var(--c-cv)', 2);
          $all('.fl', svg).forEach(function (el, i) {
            var x = 80 + ((sub * 800 + i * 100) % 700);
            el.setAttribute('cx', x.toFixed(1));
          });
        } else if (step === 2) {
          // 泄漏点出现 + 压力下降段高亮
          $('.tr-leak', svg).setAttribute('opacity', sub.toFixed(2));
          $('.lk-r1', svg).setAttribute('r', (8 + sub * 30).toFixed(1));
          $('.lk-r1', svg).setAttribute('stroke-opacity', (1 - sub).toFixed(2));
          $('.lk-r2', svg).setAttribute('r', (8 + sub * 45).toFixed(1));
          $('.lk-r2', svg).setAttribute('stroke-opacity', (0.8 - sub * 0.8).toFixed(2));
          $('.tr-anom', svg).setAttribute('opacity', sub.toFixed(2));
          // 泄漏段健康度下降
          var health2 = [0.95, 0.9, 0.88, 0.92, 0.5 - sub * 0.2, 0.88, 0.85, 0.93];
          $('.tr-health', svg).innerHTML = bars(health2, 12, 22, 201, 30, 'var(--c-cv)', 2);
          // 异常段曲线（带锯齿下倾）
          var d2 = '';
          for (var j = 50; j <= 80; j++) {
            var xa = 30 + (670 * j / 80);
            var ya = 100 + Math.sin(j * 0.2) * 3 - 5 * (j - 50) / 30 + (j > 60 ? Math.sin(j) * 4 * sub : 0);
            d2 += (j === 50 ? 'M' : 'L') + xa.toFixed(1) + ',' + ya.toFixed(1) + ' ';
          }
          $('.tr-abnormal', svg).setAttribute('d', d2);
        } else if (step === 3) {
          $all('.fl', svg).forEach(function (el, i) {
            var x = 80 + ((sub * 800 + i * 100) % 700);
            el.setAttribute('cx', x.toFixed(1));
          });
          $('.tr-leak', svg).setAttribute('opacity', '1');
          $('.tr-anom', svg).setAttribute('opacity', '1');
          // 传感器亮闪
          $all('.sen', svg).forEach(function (el, i) {
            el.querySelector('rect').setAttribute('opacity', sub > i * 0.2 ? '1' : '0.6');
            var lamp = el.querySelector('circle');
            if (lamp) lamp.setAttribute('r', (2 + Math.sin(sub * Math.PI * 6 + i) * 1).toFixed(1));
          });
        }
      }
    },

    /* ═════════════════════════════════════════════════════════════
       ⑬ 加工 — clay 分馏塔 + jade/clay/c-cv/c-nlp 四层产品 + 加热炉火焰
       ═════════════════════════════════════════════════════════════ */
    refining: {
      title: '加工', subtitle: '分馏塔蒸馏 · 四层产品分离 · AI 温控与软测量优化', duration: 11000,
      frames: function () {
        return '' +
          '<svg viewBox="0 0 800 420" class="stg-svg">' + commonDefs() +
          '  <!-- 背景 (工业厂区) -->' +
          '  <rect width="800" height="130" fill="url(#sky)"/>' +
          '  <rect y="130" width="800" height="290" fill="var(--ink-1)" fill-opacity=".3"/>' +
          '  <rect y="370" width="800" height="50" fill="var(--ink-2)" fill-opacity=".5"/>' +
          '  <!-- 分馏塔 (clay 陶土橙主体 + 阶梯式塔盘) -->' +
          '  <g class="rf-tower" transform="translate(280,60)">' +
          '    <!-- 塔顶 -->' +
          '    <polygon points="40,0 80,0 60,-25" fill="var(--clay)" fill-opacity=".8"/>' +
          '    <!-- 塔主体（上窄下宽锥形） -->' +
          '    <polygon points="30,0 90,0 120,260 0,260" fill="var(--clay)" fill-opacity=".3" stroke="var(--clay)" stroke-width="1"/>' +
          '    <!-- 塔盘 (jade 绿横线) -->' +
          '    <g class="rf-trays" stroke="var(--jade)" stroke-width="1.2" stroke-opacity=".6">' +
          '      <line class="tray tr1" x1="35" y1="30" x2="85" y2="30"/>' +
          '      <line class="tray tr2" x1="38" y1="70" x2="95" y2="70"/>' +
          '      <line class="tray tr3" x1="42" y1="110" x2="105" y2="110"/>' +
          '      <line class="tray tr4" x1="48" y1="150" x2="114" y2="150"/>' +
          '      <line class="tray tr5" x1="55" y1="190" x2="125" y2="190"/>' +
          '      <line class="tray tr6" x1="62" y1="230" x2="138" y2="230"/>' +
          '    </g>' +
          '    <!-- 温度指示 (c-opt 蓝 + c-ts 橙数字) -->' +
          '    <g font-size="7">' +
          '      <text x="110" y="34" fill="var(--c-opt)">85°C</text>' +
          '      <text x="115" y="74" fill="var(--c-ts)">150°C</text>' +
          '      <text x="120" y="114" fill="var(--clay)">230°C</text>' +
          '      <text x="128" y="154" fill="var(--clay)">310°C</text>' +
          '      <text x="135" y="194" fill="var(--clay)">380°C</text>' +
          '      <text x="145" y="234" fill="var(--clay)">450°C</text>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 加热炉 (clay 橙 + jade 火焰) -->' +
          '  <g transform="translate(80,190)">' +
          '    <rect width="80" height="80" fill="var(--ink-2)" fill-opacity=".7"/>' +
          '    <rect x="5" y="10" width="70" height="50" fill="var(--clay)" fill-opacity=".25"/>' +
          '    <text x="40" y="72" text-anchor="middle" font-size="8" fill="var(--clay)">Heater</text>' +
          '    <rect x="30" y="60" width="20" height="20" fill="var(--ink-1)"/>' +
          '    <g class="rf-flame">' +
          '      <path class="fl f1" d="M40,80 Q30,70 40,60 Q50,70 40,80" fill="#d9321a" fill-opacity=".9"/>' +
          '      <path class="fl f2" d="M40,80 Q34,72 40,65 Q46,72 40,80" fill="#f06820" fill-opacity=".85"/>' +
          '      <path class="fl f3" d="M40,80 Q37,75 40,70 Q43,75 40,80" fill="#ffcf3a"/>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 进料管线 (jade 绿 + clay 橙热液) -->' +
          '  <path d="M160,230 Q220,230 280,260" fill="none" stroke="var(--jade)" stroke-width="3" stroke-opacity=".6"/>' +
          '  <path class="rf-inflow" d="M160,230 Q220,230 280,260" fill="none" stroke="var(--clay)" stroke-width="1.5" stroke-dasharray="6 3"/>' +
          '  <!-- 四层产品采出 (4 色：c-cv汽油 / jade煤油 / c-nlp柴油 / clay渣油) -->' +
          '  <g class="rf-products">' +
          '    <!-- 塔顶汽油 (c-cv 青) -->' +
          '    <g class="prod p1"><rect x="420" y="70" width="80" height="22" fill="var(--c-cv)" fill-opacity=".35" stroke="var(--c-cv)"/><text x="460" y="85" text-anchor="middle" font-size="8" fill="var(--c-cv)">汽油 C-cv</text><line x1="380" y1="80" x2="420" y2="80" stroke="var(--c-cv)" stroke-width="1"/></g>' +
          '    <!-- 煤油 (jade 绿) -->' +
          '    <g class="prod p2"><rect x="420" y="110" width="80" height="22" fill="var(--jade)" fill-opacity=".35" stroke="var(--jade)"/><text x="460" y="125" text-anchor="middle" font-size="8" fill="var(--jade-d)">煤油</text><line x1="390" y1="120" x2="420" y2="120" stroke="var(--jade)" stroke-width="1"/></g>' +
          '    <!-- 柴油 (c-nlp 紫) -->' +
          '    <g class="prod p3"><rect x="420" y="160" width="80" height="22" fill="var(--c-nlp)" fill-opacity=".35" stroke="var(--c-nlp)"/><text x="460" y="175" text-anchor="middle" font-size="8" fill="var(--c-nlp)">柴油</text><line x1="400" y1="170" x2="420" y2="170" stroke="var(--c-nlp)" stroke-width="1"/></g>' +
          '    <!-- 渣油 (clay 陶土橙) -->' +
          '    <g class="prod p4"><rect x="420" y="220" width="80" height="22" fill="var(--clay)" fill-opacity=".35" stroke="var(--clay)"/><text x="460" y="235" text-anchor="middle" font-size="8" fill="var(--clay)">渣油</text><line x1="420" y1="230" x2="440" y2="230" stroke="var(--clay)" stroke-width="1"/></g>' +
          '  </g>' +
          '  <!-- 采出管线 (jade 绿 + clay 橙流动) -->' +
          '  <g stroke="var(--jade)" stroke-width="2" fill="none" opacity=".55">' +
          '    <path d="M500,81 Q560,81 580,110"/><path d="M500,121 Q560,121 580,130"/>' +
          '    <path d="M500,171 Q560,171 580,150"/><path d="M500,231 Q560,231 580,170"/>' +
          '  </g>' +
          '  <!-- 罐区 (ink-2 + 4 色盖) -->' +
          '  <g transform="translate(580,100)">' +
          '    <g class="tk t1"><rect width="30" height="40" fill="var(--ink-2)"/><rect x="0" y="0" width="30" height="6" fill="var(--c-cv)"/></g>' +
          '    <g class="tk t2" transform="translate(40,0)"><rect width="30" height="40" fill="var(--ink-2)"/><rect x="0" y="0" width="30" height="6" fill="var(--jade)"/></g>' +
          '    <g class="tk t3" transform="translate(80,30)"><rect width="30" height="40" fill="var(--ink-2)"/><rect x="0" y="0" width="30" height="6" fill="var(--c-nlp)"/></g>' +
          '    <g class="tk t4" transform="translate(120,70)"><rect width="30" height="40" fill="var(--ink-2)"/><rect x="0" y="0" width="30" height="6" fill="var(--clay)"/></g>' +
          '    <g stroke="var(--jade)" stroke-width="1" stroke-opacity=".5" fill="none">' +
          '      <line x1="15" y1="40" x2="15" y2="100"/><line x1="55" y1="40" x2="55" y2="100"/>' +
          '      <line x1="95" y1="70" x2="95" y2="100"/><line x1="135" y1="110" x2="135" y2="100"/>' +
          '      <path d="M15,100 Q55,95 95,100 Q115,100 135,100"/>' +
          '    </g>' +
          '  </g>' +
          '  <!-- 数据面板1：分馏塔温度梯度曲线（clay 实际温度 + c-cv 设定值） -->' +
          panel(540, 20, '塔温梯度 (°C)', 'var(--clay)', 52) +
          '  <path class="rf-chart1" d="" fill="none" stroke="var(--clay)" stroke-width="1.4" transform="translate(540,20)"/>' +
          '  <path class="rf-chart1b" d="" fill="none" stroke="var(--c-cv)" stroke-width="1.2" stroke-dasharray="3 2" transform="translate(540,20)"/>' +
          '  <!-- 数据面板2：产品收率柱状图（4 色：汽油/煤油/柴油/渣油） -->' +
          panel(540, 225, '产品收率 (%)', 'var(--c-cv)', 52) +
          '  <g class="rf-chart2" transform="translate(540,225)"></g>' +
          '  <!-- HUD：clay 橙温控面板 -->' +
          '  <g transform="translate(40,350)"><rect width="200" height="60" rx="6" fill="var(--card)" fill-opacity=".8" stroke="var(--clay)" stroke-opacity=".35"/>' +
          '    <text x="10" y="16" font-size="10" fill="var(--clay)" font-weight="bold">Refine · AI 温控</text>' +
          '    <line x1="10" y1="24" x2="190" y2="24" stroke="var(--line)" stroke-width="1"/>' +
          '    <text x="10" y="42" font-size="9" fill="var(--ink-2)">进料 <tspan class="rf-h1" fill="var(--c-ts)">-- °C</tspan> · 回流比 <tspan class="rf-h2" fill="var(--jade-d)">--</tspan></text>' +
          '    <text x="10" y="56" font-size="9" fill="var(--ink-2)">塔顶 <tspan class="rf-h3" fill="var(--c-cv)">-- °C</tspan> · 塔底 <tspan class="rf-h4" fill="var(--clay)">-- °C</tspan></text>' +
          '    <circle cx="190" cy="16" r="5" fill="none" stroke="var(--clay)" stroke-width="1.2"/><text x="182" y="19" font-size="7" fill="var(--clay)">AI</text>' +
          '  </g></svg>';
      },
      update: function (svg, p) {
        var step = Math.min(4, Math.floor(p * 4.001)), sub = (p * 4) - step;
        if (step === 0) {
          $('.rf-inflow', svg).setAttribute('stroke-dashoffset', (-sub * 30).toFixed(1));
          $all('.tray', svg).forEach(function (el, i) {
            el.setAttribute('stroke-opacity', Math.min(0.6, sub * 3 - i * 0.15).toFixed(2));
          });
          // 塔温梯度：进料阶段环境温度平直基线
          var n = 60, base = [];
          for (var i = 0; i < n; i++) base.push(0.05 + Math.sin(i * 0.5) * 0.008);
          $('.rf-chart1', svg).setAttribute('d', linePath(base, 12, 32, 206, 48));
          $('.rf-chart1b', svg).setAttribute('d', linePath(base, 12, 32, 206, 48));
        } else if (step === 1) {
          // 火焰跳动
          $all('.fl', svg).forEach(function (el, i) {
            var s = 1 + Math.sin(sub * Math.PI * 8 + i) * 0.15;
            el.setAttribute('transform', 'translate(40,80) scale(1,' + s.toFixed(2) + ') translate(-40,-80)');
          });
          $('.rf-h1', svg).textContent = Math.round(350 + sub * 20);
          $('.rf-h2', svg).textContent = (2.5 + sub * 0.5).toFixed(1);
          // 塔温梯度：随加热从环境升至目标梯度（塔顶 85°C → 塔底 450°C）
          var n = 60, tgt = [0, 0.18, 0.40, 0.62, 0.81, 1.0];
          var grad = [], sp = [];
          for (var i = 0; i < n; i++) {
            var ti = i / (n - 1) * 5, ti0 = Math.floor(ti), ti1 = Math.min(5, ti0 + 1), f = ti - ti0;
            var tv = tgt[ti0] * (1 - f) + tgt[ti1] * f;
            sp.push(tv);
            grad.push(Math.max(0, Math.min(1, tv * sub + 0.05 * (1 - sub) + Math.sin(i * 1.7) * 0.012)));
          }
          $('.rf-chart1', svg).setAttribute('d', linePath(grad, 12, 32, 206, 48));
          $('.rf-chart1b', svg).setAttribute('d', linePath(sp, 12, 32, 206, 48));
        } else if (step === 2) {
          $('.rf-products', svg).setAttribute('opacity', sub.toFixed(2));
          $all('.prod', svg).forEach(function (el, i) {
            el.setAttribute('opacity', Math.min(1, sub * 3 - i * 0.2).toFixed(2));
          });
          $('.rf-h3', svg).textContent = Math.round(80 + sub * 15);
          $('.rf-h4', svg).textContent = Math.round(420 + sub * 30);
          // 塔温梯度：稳定在目标，轻微波动
          var n = 60, tgt = [0, 0.18, 0.40, 0.62, 0.81, 1.0];
          var grad = [], sp = [];
          for (var i = 0; i < n; i++) {
            var ti = i / (n - 1) * 5, ti0 = Math.floor(ti), ti1 = Math.min(5, ti0 + 1), f = ti - ti0;
            var tv = tgt[ti0] * (1 - f) + tgt[ti1] * f;
            sp.push(tv);
            grad.push(Math.max(0, Math.min(1, tv + Math.sin(i * 1.7 + sub * 6) * 0.02)));
          }
          $('.rf-chart1', svg).setAttribute('d', linePath(grad, 12, 32, 206, 48));
          $('.rf-chart1b', svg).setAttribute('d', linePath(sp, 12, 32, 206, 48));
          // 产品收率柱状图（4 色：汽油/煤油/柴油/渣油）
          var yields = [0.32 * sub, 0.22 * sub, 0.28 * sub, 0.18 * sub];
          var colors = ['var(--c-cv)', 'var(--jade)', 'var(--c-nlp)', 'var(--clay)'];
          var bpx = 12, bpy = 32, bpw = 206, bph = 48, bgap = 10;
          var bw = (bpw - bgap * (yields.length - 1)) / yields.length;
          var barHtml = '';
          for (var bi = 0; bi < yields.length; bi++) {
            var bh = bph * yields[bi];
            barHtml += '<rect x="' + (bpx + bi * (bw + bgap)).toFixed(1) + '" y="' + (bpy + bph - bh).toFixed(1) +
                       '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + colors[bi] + '" fill-opacity=".75" rx="1"/>';
          }
          $('.rf-chart2', svg).innerHTML = barHtml;
        } else if (step === 3) {
          // 罐区液位上升
          $all('.tk', svg).forEach(function (el, i) {
            var fillH = 40 * sub;
            el.querySelector('rect:first-child').setAttribute('fill-opacity', (0.3 + sub * 0.5).toFixed(2));
            // 新增液位
            var lid = el.querySelector('rect:nth-child(2)');
            if (lid) { lid.setAttribute('y', (40 - fillH).toFixed(1)); lid.setAttribute('height', fillH.toFixed(1)); }
          });
          // 塔温梯度：保持稳态波动
          var n = 60, tgt = [0, 0.18, 0.40, 0.62, 0.81, 1.0];
          var grad = [], sp = [];
          for (var i = 0; i < n; i++) {
            var ti = i / (n - 1) * 5, ti0 = Math.floor(ti), ti1 = Math.min(5, ti0 + 1), f = ti - ti0;
            var tv = tgt[ti0] * (1 - f) + tgt[ti1] * f;
            sp.push(tv);
            grad.push(Math.max(0, Math.min(1, tv + Math.sin(i * 1.7 + sub * 8) * 0.018)));
          }
          $('.rf-chart1', svg).setAttribute('d', linePath(grad, 12, 32, 206, 48));
          $('.rf-chart1b', svg).setAttribute('d', linePath(sp, 12, 32, 206, 48));
          // 产品收率满值
          var yields = [0.32, 0.22, 0.28, 0.18];
          var colors = ['var(--c-cv)', 'var(--jade)', 'var(--c-nlp)', 'var(--clay)'];
          var bpx = 12, bpy = 32, bpw = 206, bph = 48, bgap = 10;
          var bw = (bpw - bgap * (yields.length - 1)) / yields.length;
          var barHtml = '';
          for (var bi = 0; bi < yields.length; bi++) {
            var bh = bph * yields[bi];
            barHtml += '<rect x="' + (bpx + bi * (bw + bgap)).toFixed(1) + '" y="' + (bpy + bph - bh).toFixed(1) +
                       '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + colors[bi] + '" fill-opacity=".75" rx="1"/>';
          }
          $('.rf-chart2', svg).innerHTML = barHtml;
        }
      }
    },

  }; /* ← STAGES 闭合 */

  /* ========== Player ========== */
  /* 逐帧驱动属性（transform / r / cy / dashoffset 等）的元素不能挂 transition，
     否则每帧都会重启过渡，视觉上迟钝且掉帧。渲染后统一打标。 */
  var LIVE_SEL = '.smpl,.cm-cement-hot,.gas,.pu,.lk-r1,.lk-r2,.sen,.tray,.tk,.gh,.cut,.bl,.pr,.fl,.sh,.ck,.microann,.plug';

  function Player(hostEl, stageId, options) {
    options = options || {};
    this.host = hostEl; this.stageId = stageId;
    this.stage = STAGES[stageId];
    this.duration = (this.stage && this.stage.duration) || 9000;
    this.running = false; this.progress = 0; this.startTs = 0; this.rafId = null;
    this.lastP = -1;
    this.render();
  }
  Player.prototype.render = function () {
    var s = this.stage;
    if (!s) { this.host.innerHTML = '<div class="stg-empty">环节动画暂未接入</div>'; return; }
    this.host.innerHTML =
      '<div class="stg-head">' +
      '  <div class="stg-title">' + s.title + '</div>' +
      '  <div class="stg-sub">' + s.subtitle + '</div>' +
      '</div>' +
      '<div class="stg-stage">' + s.frames() +
      '  <i class="stg-grid" aria-hidden="true"></i>' +
      '  <i class="stg-scan" aria-hidden="true"></i>' +
      '</div>' +
      '<div class="stg-ctrl">' +
      '  <button class="stg-btn stg-play" title="播放/暂停">▶</button>' +
      '  <button class="stg-btn stg-replay" title="重播">↺</button>' +
      '  <div class="stg-bar" role="slider" aria-label="播放进度"><div class="stg-bar-fill"></div><i class="stg-bar-knob"></i></div>' +
      '  <div class="stg-time"><span class="stg-now">0.0</span>/<span class="stg-tot">' + (s.duration / 1000).toFixed(1) + '</span>s</div>' +
      '</div>';
    this.el = {
      stage: this.host.querySelector('.stg-stage'),
      svg: this.host.querySelector('.stg-stage svg'),
      bar: this.host.querySelector('.stg-bar'),
      now: this.host.querySelector('.stg-now'),
      play: this.host.querySelector('.stg-play'),
      time: this.host.querySelector('.stg-time')
    };
    // 打标：关闭逐帧元素的过渡
    var live = this.el.svg.querySelectorAll(LIVE_SEL);
    for (var i = 0; i < live.length; i++) live[i].classList.add('stg-live');

    var self = this;
    this.el.play.addEventListener('click', function () { self.running ? self.pause() : self.play(); });
    this.host.querySelector('.stg-replay').addEventListener('click', function () { self.replay(); });

    // 进度条：点击 / 拖拽定位
    var bar = this.el.bar;
    bar.addEventListener('pointerdown', function (e) {
      self.wasPlaying = self.running;
      if (self.running) self.pause();
      self.dragging = true; bar.classList.add('dragging');
      self.seekTo(e);
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    bar.addEventListener('pointermove', function (e) { if (self.dragging) self.seekTo(e); });
    var endDrag = function () {
      if (!self.dragging) return;
      self.dragging = false; bar.classList.remove('dragging');
      if (self.wasPlaying && self.progress < 1) self.play();
      self.wasPlaying = false;
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    this.paint(0);
  };
  /* 统一刷新：进度条走 CSS 变量 + scaleX，不触发布局 */
  Player.prototype.paint = function (p) {
    this.el.bar.style.setProperty('--p', p.toFixed(4));
    this.el.now.textContent = (p * this.duration / 1000).toFixed(1);
    if (p !== this.lastP) { this.stage.update(this.el.svg, p); this.lastP = p; }
  };
  Player.prototype.seekTo = function (e) {
    var r = this.el.bar.getBoundingClientRect();
    var p = (e.clientX - r.left) / (r.width || 1);
    p = p < 0 ? 0 : (p > 1 ? 1 : p);
    this.progress = p;
    this.paint(p);
  };
  Player.prototype.play = function () {
    if (!this.stage || this.running) return;
    if (this.progress >= 1) this.progress = 0;
    this.running = true;
    this.el.play.innerHTML = '❚❚';
    this.el.play.classList.add('is-playing');
    this.startTs = performance.now() - this.progress * this.duration;
    var self = this;
    function tick(now) {
      if (!self.running) return;
      var p = Math.min(1, (now - self.startTs) / self.duration);
      self.progress = p;
      self.paint(p);
      if (p >= 1) {
        self.running = false;
        self.el.play.innerHTML = '▶';
        self.el.play.classList.remove('is-playing');
        return;
      }
      self.rafId = requestAnimationFrame(tick);
    }
    this.rafId = requestAnimationFrame(tick);
  };
  Player.prototype.pause = function () {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.el.play.innerHTML = '▶';
    this.el.play.classList.remove('is-playing');
  };
  Player.prototype.replay = function () {
    this.pause(); this.progress = 0; this.lastP = -1;
    this.paint(0);
    this.play();
  };
  Player.prototype.destroy = function () {
    this.pause();
    this.stage = null;
  };

  /* ========== homeSection + mount ========== */
  function homeSection() {
    var stages = (window.ATLAS && window.ATLAS.stages) || [];
    if (!stages.length) return '';
    var btns = stages.map(function (st) {
      return '<button class="ap-btn" data-ap="' + st.id + '">' +
        '<span class="ap-idx">' + (st.idx < 10 ? '0' + st.idx : st.idx) + '</span>' +
        '<span class="ap-nm">' + esc(st.name) + '</span></button>';
    }).join('');
    return '' +
      '<div class="kicker jade">05 · ANIMATION STAGE</div>' +
      '<h2 class="hp-h2">环节动画平台<span class="hp-lead">点击任一环节，查看石油勘探开发专业动画演示</span></h2>' +
      '<div class="ap-grid">' + btns + '</div>' +
      '<div class="ap-stage" id="ap-stage"><div class="stg-empty">点击上方任一环节按钮开始播放动画</div></div>';
  }
  var currentPlayer = null;
  var switchTimer = null;
  function mount() {
    var caseGrid = document.querySelector('.case-grid');
    if (!caseGrid) return;
    var host = document.createElement('section');
    host.className = 'ap-section';
    host.innerHTML = homeSection();
    caseGrid.parentElement.insertBefore(host, caseGrid.nextSibling);
    var panel = document.getElementById('ap-stage');

    function activate(id, opts) {
      opts = opts || {};
      var el = STAGES[id];
      if (!el) return;
      if (currentPlayer) { currentPlayer.destroy(); currentPlayer = null; }
      if (switchTimer) clearTimeout(switchTimer);
      // 柔和过渡：先淡出，再换内容淡入
      panel.classList.add('switching');
      switchTimer = setTimeout(function () {
        switchTimer = null;
        currentPlayer = new Player(panel, id);
        panel.classList.remove('switching');
        if (opts.autoplay !== false) currentPlayer.play();
      }, 180);
    }

    var btns = document.querySelectorAll('.ap-btn');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-ap');
        if (currentPlayer && currentPlayer.stageId === id && !switchTimer) {
          currentPlayer.replay(); return;   // 重复点击同一环节 → 从头重播
        }
        btns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        activate(id);
      });
    });

    // 页面不可见时自动暂停，回来继续（省电、避免后台空跑）
    document.addEventListener('visibilitychange', function () {
      if (!currentPlayer || currentPlayer.dragging) return;
      if (document.hidden && currentPlayer.running) {
        currentPlayer.pause(); currentPlayer._resume = true;
      } else if (!document.hidden && currentPlayer._resume) {
        currentPlayer._resume = false; currentPlayer.play();
      }
    });

    var firstBtn = document.querySelector('.ap-btn[data-ap="cementing"]') || document.querySelector('.ap-btn');
    if (firstBtn) {
      firstBtn.classList.add('active');
      activate(firstBtn.getAttribute('data-ap'));
    }
  }
  window.StageAnim = { STAGES: STAGES, Player: Player, homeSection: homeSection, mount: mount };
})();
