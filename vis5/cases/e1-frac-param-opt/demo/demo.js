/* ======= 压裂参数智能优化 · 可运行示范 ======= */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const LATERAL = 1200;
  const DEFAULTS = { q: 12, sand: 18, seg: 16 };
  let st = { q: 12, sand: 18, seg: 16 };
  let showPareto = false;

  function calc(s) {
    s = s || st;
    const qF = Math.pow(s.q / 10, 0.45);
    const sandF = Math.pow(s.sand / 15, 0.25);
    const segF = Math.pow(16 / s.seg, 0.18);
    const xf = 152 * qF * sandF * segF;
    const cond = 24 * Math.pow(s.sand / 15, 0.9) * Math.pow(s.q / 10, 0.2) * Math.pow(16 / s.seg, 0.08);
    const cost = 380 + s.seg * 38 + s.q * 9 + s.sand * 10;
    const prod = 100 * Math.pow(xf / 152, 0.7) * Math.pow(cond / 24, 0.3) * Math.pow(s.seg / 16, 0.14);
    const spacing = LATERAL / (s.seg * 3);
    const risk = Math.max(0, Math.min(60, 8 + (s.sand - 15) * 1.5 + Math.max(0, 8 - s.q) * 5 +
      Math.max(0, spacing - 30) * 0.6 - (s.seg - 10) * 0.25));
    return { xf: xf, cond: cond, cost: cost, prod: prod, risk: risk, spacing: spacing };
  }

  function drawGeom(c) {
    const W = 720, H = 300;
    let g = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0f130d" rx="6"/>';
    g += '<rect x="40" y="62" width="640" height="188" rx="8" fill="#161c13" stroke="#2c3327"/>';
    g += '<text x="52" y="80" font-size="9.5" fill="#8b8778">储层段 · 水平段 ' + LATERAL + ' m</text>';
    g += '<line x1="60" y1="160" x2="680" y2="160" stroke="#5b6358" stroke-width="6" stroke-linecap="round"/>';
    g += '<line x1="60" y1="160" x2="680" y2="160" stroke="#161c13" stroke-width="2"/>';
    g += '<text x="678" y="186" text-anchor="end" font-size="9" fill="#8b8778">水平井筒</text>';
    const len = Math.min(100, c.xf * 0.5);
    for (let i = 0; i < st.seg; i++) {
      const x = 82 + (i + 0.5) / st.seg * 596;
      g += '<line x1="' + x.toFixed(1) + '" y1="' + (160 - len).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + (160 + len).toFixed(1) + '" stroke="#d0a85c" stroke-width="2.4" opacity=".85"/>';
      g += '<circle cx="' + x.toFixed(1) + '" cy="' + (160 - len).toFixed(1) + '" r="2.2" fill="#d0a85c"/>';
      g += '<circle cx="' + x.toFixed(1) + '" cy="' + (160 + len).toFixed(1) + '" r="2.2" fill="#d0a85c"/>';
    }
    const x0 = 82 + 0.5 / st.seg * 596;
    g += '<line x1="' + (x0 - 14) + '" y1="' + (160 - len) + '" x2="' + (x0 - 14) + '" y2="' + (160 + len) + '" stroke="#78b7a8" stroke-width="1" stroke-dasharray="3 3"/>';
    g += '<text x="' + (x0 - 18) + '" y="' + (160 - len - 7) + '" font-size="9.5" fill="#78b7a8" text-anchor="end">半长 xf = ' + c.xf.toFixed(0) + ' m</text>';
    g += '<text x="52" y="238" font-size="10" fill="#c9c4b4">段数 ' + st.seg + ' · 每段 3 簇 · 簇间距 ' + c.spacing.toFixed(1) + ' m</text>';
    g += '<text x="52" y="254" font-size="9.5" fill="#8b8778">排量 ' + st.q.toFixed(1) + ' m³/min · 砂比 ' + st.sand + '%</text>';
    g += '<circle cx="610" cy="84" r="3" fill="#d0a85c"/><text x="620" y="87" font-size="9" fill="#8b8778">裂缝（示意）</text>';
    $('geom').innerHTML = g;
  }

  function mapX(v) { return 58 + (v - 650) / 1000 * 630; }
  function mapY(v) { return 250 - (v - 40) / 130 * 220; }

  function candidates() {
    const list = [];
    for (let q = 4; q <= 16; q += 2) {
      for (let sand = 5; sand <= 30; sand += 5) {
        for (let seg = 5; seg <= 20; seg += 3) {
          list.push(calc({ q: q, sand: sand, seg: seg }));
        }
      }
    }
    return list;
  }

  function frontier(list) {
    const sorted = list.slice().sort(function (a, b) { return a.cost - b.cost || b.prod - a.prod; });
    const front = [];
    let best = -Infinity;
    sorted.forEach(function (p) {
      if (p.prod > best + 0.01) { front.push(p); best = p.prod; }
    });
    return front;
  }

  function drawScatter(c) {
    const W = 720, H = 300;
    let g = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0f130d" rx="6"/>';
    [700, 900, 1100, 1300, 1500].forEach(function (v) {
      const x = mapX(v);
      g += '<line x1="' + x + '" y1="30" x2="' + x + '" y2="250" stroke="#242b20" stroke-width="1"/>';
      g += '<text x="' + x + '" y="266" text-anchor="middle" font-size="9" fill="#7b8070">' + v + '</text>';
    });
    [40, 60, 80, 100, 120, 140, 160].forEach(function (v) {
      const y = mapY(v);
      g += '<line x1="58" y1="' + y + '" x2="688" y2="' + y + '" stroke="#242b20" stroke-width="1"/>';
      g += '<text x="50" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="#7b8070">' + v + '</text>';
    });
    g += '<line x1="58" y1="250" x2="688" y2="250" stroke="#3a4433"/>';
    g += '<line x1="58" y1="30" x2="58" y2="250" stroke="#3a4433"/>';
    g += '<text x="688" y="286" text-anchor="end" font-size="9.5" fill="#8b8778">压裂成本 / 万元</text>';
    g += '<text x="58" y="20" font-size="9.5" fill="#8b8778">90 天累产（相对基准 / %）</text>';

    const list = candidates();
    list.forEach(function (p) {
      g += '<circle cx="' + mapX(p.cost).toFixed(1) + '" cy="' + mapY(p.prod).toFixed(1) + '" r="2" fill="#5e8f83" opacity=".38"/>';
    });
    if (showPareto) {
      const fr = frontier(list);
      let pts = '';
      fr.forEach(function (p) {
        const x = mapX(p.cost).toFixed(1), y = mapY(p.prod).toFixed(1);
        pts += x + ',' + y + ' ';
        g += '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="#78b7a8"/>';
      });
      g += '<polyline points="' + pts.trim() + '" fill="none" stroke="#78b7a8" stroke-width="1.4" opacity=".75"/>';
      g += '<text x="' + (mapX(fr[fr.length - 1].cost) - 8) + '" y="' + (mapY(fr[fr.length - 1].prod) - 10) + '" text-anchor="end" font-size="9" fill="#78b7a8">帕累托前沿</text>';
    }
    g += '<circle cx="' + mapX(c.cost).toFixed(1) + '" cy="' + mapY(c.prod).toFixed(1) + '" r="5.5" fill="#d0a85c" stroke="#0f130d" stroke-width="1.5"/>';
    g += '<text x="' + (mapX(c.cost) + 9) + '" y="' + (mapY(c.prod) - 8) + '" font-size="9" fill="#d0a85c">当前</text>';
    $('scatter').innerHTML = g;
  }

  function update() {
    const c = calc();
    drawGeom(c);
    drawScatter(c);
    $('r-xf').textContent = c.xf.toFixed(0) + ' m';
    $('r-cond').textContent = c.cond.toFixed(1) + ' D·cm';
    $('r-cost').textContent = c.cost.toFixed(0) + ' 万元';
    $('r-risk').textContent = c.risk.toFixed(1) + '%';
    const stEl = $('status');
    if (c.risk >= 20) {
      stEl.className = 'status bad';
      stEl.innerHTML = '<b>砂堵风险高</b><span>砂堵概率 ' + c.risk.toFixed(1) +
        '%，当前砂比 ' + st.sand + '% 与排量 ' + st.q.toFixed(1) + ' m³/min 的组合携砂能力不足，建议降低砂比或提高排量。</span>';
    } else if (c.cost > 1350) {
      stEl.className = 'status warn';
      stEl.innerHTML = '<b>成本超限</b><span>压裂成本 ' + c.cost.toFixed(0) +
        ' 万元，超过 1,350 万元上限。可减少段数或优化单段规模，先用帕累托前沿找可接受的产量损失。</span>';
    } else {
      stEl.className = 'status ok';
      stEl.innerHTML = '<b>推荐方案</b><span>半长 ' + c.xf.toFixed(0) + ' m、导流能力 ' + c.cond.toFixed(1) +
        ' D·cm、成本 ' + c.cost.toFixed(0) + ' 万元、砂堵概率 ' + c.risk.toFixed(1) + '%，处于推荐区间。</span>';
    }
  }

  function sync() {
    $('s-q').value = st.q;
    $('s-sand').value = st.sand;
    $('s-seg').value = st.seg;
    $('o-q').textContent = st.q.toFixed(1) + ' m³/min';
    $('o-sand').textContent = st.sand + '%';
    $('o-seg').textContent = st.seg;
  }

  $('s-q').addEventListener('input', function (e) { st.q = +e.target.value; sync(); update(); });
  $('s-sand').addEventListener('input', function (e) { st.sand = +e.target.value; sync(); update(); });
  $('s-seg').addEventListener('input', function (e) { st.seg = +e.target.value; sync(); update(); });
  $('btn-pareto').addEventListener('click', function () {
    showPareto = !showPareto;
    $('btn-pareto').textContent = showPareto ? '隐藏帕累托前沿' : '帕累托寻优';
    drawScatter(calc());
  });
  $('btn-reset').addEventListener('click', function () {
    st = Object.assign({}, DEFAULTS);
    showPareto = false;
    $('btn-pareto').textContent = '帕累托寻优';
    sync();
    update();
  });

  sync();
  update();
})();
