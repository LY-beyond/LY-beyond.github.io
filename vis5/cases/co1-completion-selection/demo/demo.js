/* ======= 完井方式智能优选 · 可运行示范 ======= */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const METHODS = ['裸眼完井', '射孔完井', '筛管完井', '砾石充填'];
  const SCEN = [
    {
      name: '致密砂岩 · 直井', res: '致密砂岩', lith: '细砂岩', sand: '低', water: '低',
      depth: '3,650 m', casing: '139.7 mm', base: [38, 72, 52, 30],
      sandCoef: [-18, 4, 24, 30], waterCoef: [-10, 2, 8, 4], riskBase: 28
    },
    {
      name: '疏松砂岩 · 水平井', res: '疏松砂岩', lith: '中砂岩', sand: '高', water: '中',
      depth: '2,100 m', casing: '177.8 mm', base: [22, 44, 84, 90],
      sandCoef: [-25, -8, 20, 26], waterCoef: [-8, 2, 6, 5], riskBase: 74
    },
    {
      name: '高含水 · 定向井', res: '中砂岩', lith: '细砂岩', sand: '中', water: '高',
      depth: '2,800 m', casing: '139.7 mm', base: [30, 80, 58, 50],
      sandCoef: [-20, 0, 18, 24], waterCoef: [-12, 6, 4, -2], riskBase: 60
    }
  ];
  const COND_EDGES = [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [3, 1], [4, 2], [5, 2]];
  const RISK_EDGES = [[0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3]];
  const ACT_COND = [[0, 4], [0, 3, 4], [1, 2, 5], [1, 2, 5]];
  const ACT_RISK = [[2], [1, 2], [0, 2], [0, 2]];
  const RISK_POS = [
    { x: 272, y: 58, w: 138, h: 46 },
    { x: 272, y: 168, w: 138, h: 46 },
    { x: 272, y: 278, w: 138, h: 46 }
  ];
  const METH_POS = [
    { x: 506, y: 26, w: 194, h: 44 },
    { x: 506, y: 116, w: 194, h: 44 },
    { x: 506, y: 206, w: 194, h: 44 },
    { x: 506, y: 296, w: 194, h: 44 }
  ];
  let si = 0;
  let weight = 60;

  function condPos(i) { return { x: 10, y: 30 + i * 54, w: 158, h: 40 }; }

  function calcScores() {
    const s = SCEN[si];
    const sandF = { '低': 0.25, '中': 0.7, '高': 1 }[s.sand];
    const waterF = { '低': 0.2, '中': 0.6, '高': 1 }[s.water];
    const k = weight / 100;
    return s.base.map(function (b, i) {
      const v = b + k * sandF * s.sandCoef[i] + waterF * s.waterCoef[i];
      return Math.round(Math.max(5, Math.min(99, v)));
    });
  }

  function calcRisk(topScore) {
    const s = SCEN[si];
    const sandF = { '低': 0.25, '中': 0.7, '高': 1 }[s.sand];
    const raw = s.riskBase + (weight - 50) * 0.15 * sandF - (topScore - 70) * 0.2;
    return Math.round(Math.max(8, Math.min(96, raw)));
  }

  function edge(x1, y1, x2, y2, on) {
    const c1 = x1 + 52, c2 = x2 - 52;
    const d = 'M' + x1 + ' ' + y1 + ' C' + c1 + ' ' + y1 + ',' + c2 + ' ' + y2 + ',' + x2 + ' ' + y2;
    return '<path d="' + d + '" fill="none" stroke="' + (on ? '#78b7a8' : '#333c2c') +
      '" stroke-width="' + (on ? 2.4 : 1) + '" opacity="' + (on ? 0.95 : 0.5) + '"/>';
  }

  function node(p, on, fill) {
    return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h +
      '" rx="7" fill="' + fill + '" stroke="' + (on ? '#78b7a8' : '#333c2c') + '" stroke-width="' + (on ? 1.4 : 1) + '"/>';
  }

  function drawGraph(sc, order, risk) {
    const s = SCEN[si];
    const top = order[0];
    const risks = [
      s.sand === '高' ? '高 · 需防砂' : s.sand === '中' ? '中 · 需评估' : '低 · 可容忍',
      s.water === '高' ? '高 · 需控水' : s.water === '中' ? '中 · 需观察' : '低 · 影响小',
      s.res === '疏松砂岩' ? '差 · 易坍塌' : parseInt(s.depth.replace(/[^0-9]/g, ''), 10) > 3000 ? '中 · 深井' : '良好'
    ];
    let g = '<rect x="0" y="0" width="720" height="380" fill="#0f130d" rx="6"/>';
    COND_EDGES.forEach(function (e) {
      const a = condPos(e[0]), b = RISK_POS[e[1]];
      const on = ACT_COND[top].indexOf(e[0]) >= 0 && ACT_RISK[top].indexOf(e[1]) >= 0;
      g += edge(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, on);
    });
    RISK_EDGES.forEach(function (e) {
      const a = RISK_POS[e[0]], b = METH_POS[e[1]];
      const on = ACT_RISK[top].indexOf(e[0]) >= 0 && e[1] === top;
      g += edge(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, on);
    });

    const vals = [
      ['储层类型', s.res], ['岩性', s.lith], ['出砂倾向', s.sand],
      ['出水风险', s.water], ['井深', s.depth], ['套管尺寸', s.casing]
    ];
    vals.forEach(function (c, i) {
      const p = condPos(i);
      const on = ACT_COND[top].indexOf(i) >= 0;
      g += node(p, on, on ? '#1e2a20' : '#191f16');
      g += '<text x="' + (p.x + 11) + '" y="' + (p.y + 14) + '" font-size="9" fill="#8b8778">' + c[0] + '</text>';
      g += '<text x="' + (p.x + 11) + '" y="' + (p.y + 30) + '" font-size="11" font-weight="600" fill="#e8e3d5">' + c[1] + '</text>';
    });
    ['出砂风险', '出水风险', '井壁稳定'].forEach(function (nm, i) {
      const p = RISK_POS[i];
      const on = ACT_RISK[top].indexOf(i) >= 0;
      g += node(p, on, on ? '#2a2417' : '#1c1d15');
      g += '<text x="' + (p.x + 12) + '" y="' + (p.y + 16) + '" font-size="10" fill="#d0a85c" font-weight="600">' + nm + '</text>';
      g += '<text x="' + (p.x + 12) + '" y="' + (p.y + 33) + '" font-size="10" fill="#b8b2a1">' + risks[i] + '</text>';
    });
    METHODS.forEach(function (nm, i) {
      const p = METH_POS[i];
      const on = i === top;
      g += node(p, on, on ? '#2a2417' : '#191f16');
      g += '<text x="' + (p.x + 13) + '" y="' + (p.y + 20) + '" font-size="11.5" font-weight="600" fill="' + (on ? '#d0a85c' : '#c9c4b4') + '">' + (on ? '★ ' : '') + nm + '</text>';
      g += '<text x="' + (p.x + 13) + '" y="' + (p.y + 35) + '" font-size="9.5" fill="#8b8778">规则得分 ' + sc[i] + ' / 100</text>';
      g += '<text x="' + (p.x + p.w - 12) + '" y="' + (p.y + 27) + '" text-anchor="end" font-size="14" font-family="ui-monospace,monospace" fill="' + (on ? '#d0a85c' : '#78b7a8') + '">' + sc[i] + '</text>';
    });
    g += '<text x="10" y="374" font-size="9.5" fill="#7b8070">亮线：首选方案证据链 · 灰线：其他规则路径 · 图谱规模 420 节点 / 1,100 条边</text>';
    $('graph').innerHTML = g;
  }

  function drawRank(sc, order, gap) {
    const conf = Math.min(96, Math.round(sc[order[0]] + 4 + gap * 0.4));
    let h = '<div class="rank-head">推荐排序 · 首选置信度 ' + conf + '%</div>';
    order.forEach(function (idx, k) {
      h += '<div class="rk' + (k === 0 ? ' top' : '') + '">' +
        '<span class="no">' + (k + 1) + '</span>' +
        '<span class="nm">' + METHODS[idx] + '</span>' +
        '<span class="bar"><i style="width:' + sc[idx] + '%"></i></span>' +
        '<span class="val">' + sc[idx] + ' 分</span></div>';
    });
    $('rank').innerHTML = h;
  }

  function update() {
    const sc = calcScores();
    const order = [0, 1, 2, 3].sort(function (a, b) { return sc[b] - sc[a]; });
    const top = order[0], second = order[1];
    const gap = sc[top] - sc[second];
    const risk = calcRisk(sc[top]);
    const riskLabel = risk >= 70 ? '高' : risk >= 45 ? '中' : '低';

    drawGraph(sc, order, risk);
    drawRank(sc, order, gap);
    $('r-first').innerHTML = METHODS[top] + ' <small>' + sc[top] + ' 分</small>';
    $('r-second').innerHTML = METHODS[second] + ' <small>' + sc[second] + ' 分</small>';
    $('r-risk').innerHTML = risk + ' <small>/ 100</small>';

    const st = $('status');
    if (gap < 5) {
      st.className = 'status warn';
      st.innerHTML = '<b>存在冲突</b><span>' + METHODS[top] + ' 与 ' + METHODS[second] +
        ' 仅差 ' + gap + ' 分，防砂与控水目标可能互相牵制，风险评分 ' + risk + '（' + riskLabel + '）。建议工程师复核井壁稳定性与完井成本。</span>';
    } else if (sc[top] < 60) {
      st.className = 'status bad';
      st.innerHTML = '<b>证据不足</b><span>首选 ' + METHODS[top] + ' 仅 ' + sc[top] +
        ' 分，图谱中缺少高支持度井例。建议补充邻井生产与出砂记录后再决策。</span>';
    } else {
      st.className = 'status ok';
      st.innerHTML = '<b>推荐明确</b><span>' + METHODS[top] + ' 得分 ' + sc[top] +
        '，领先次选 ' + gap + ' 分；风险评分 ' + risk + '（' + riskLabel + '）。主要证据链来自' +
        (top >= 2 ? '出砂倾向、岩性与套管尺寸' : '储层类型、出水风险与井深') + '。</span>';
    }
  }

  function buildChips() {
    SCEN.forEach(function (s, i) {
      const b = document.createElement('button');
      b.className = 'chip' + (i === si ? ' on' : '');
      b.textContent = s.name;
      b.addEventListener('click', function () {
        si = i;
        document.querySelectorAll('#chips .chip').forEach(function (c, k) {
          c.className = 'chip' + (k === si ? ' on' : '');
        });
        update();
      });
      $('chips').appendChild(b);
    });
  }

  $('s-w').addEventListener('input', function (e) {
    weight = +e.target.value;
    $('o-w').textContent = weight;
    update();
  });

  buildChips();
  update();
})();
