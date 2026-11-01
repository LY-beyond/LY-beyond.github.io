/* ======= 催化裂化产物分布智能预测 · 可运行示范 ======= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* HiDPI 适配：canvas backing store 按 dpr × CSS 拉伸系数放大，绘制仍用逻辑坐标 */
  function setupCanvas(cv, lw, lh) {
    var dpr = window.devicePixelRatio || 1;
    var ratio = dpr * ((cv.clientWidth || lw) / lw);
    var bw = Math.max(1, Math.round(lw * ratio));
    var bh = Math.max(1, Math.round(lh * ratio));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  var GREEN = '#2f7d6b', GOLD = '#c9a15a', RED = '#b05a51', BLUE = '#41699b', GRAY = '#79828a', LINE = '#efece1';

  var DEF = { temp: 505, co: 6.5, rec: 0.20, ccr: 2.0, rho: 0.915, t50: 420, mat: 66 };
  var S = Object.assign({}, DEF);
  var FEED = 420; /* t/h */

  /* ---------- 代理模型（口径见页脚公式） ---------- */
  function conversionOf(st) {
    var x = 66 + 0.9 * (st.temp - 505) + 3.0 * (st.co - 6.5) - 9 * (st.rec - 0.2)
      + 0.55 * (st.mat - 66) - 1.5 * (st.ccr - 2.0) - 40 * (st.rho - 0.915) - 0.10 * (st.t50 - 420);
    return clamp(x, 50, 92);
  }

  /* 给定转化率与其余参数，返回六类收率（闭合至 99.5%，损失 0.5%） */
  function yieldsOf(X, st) {
    var yg = 1.2 * X - 0.008 * X * X;                 /* 汽油：拐点 X=75%，过裂化下降 */
    var dg = 0.07 * X - 1.6 + 0.03 * (st.temp - 505); /* 干气 */
    var lpg = 0.34 * X - 10.2 + 0.09 * (st.temp - 505);/* 液化气 */
    var u = 100 - X;                                  /* 未转化 */
    var slu = u * (0.20 + 0.03 * st.ccr);             /* 油浆 */
    var die = u - slu;                                /* 柴油 */
    var coke = 0.075 * X + 0.5 * st.ccr - 0.9 - 0.02 * (st.temp - 505); /* 焦炭 */
    var sum = dg + lpg + yg + die + slu + coke;
    var k = 99.5 / sum;
    return { dg: dg * k, lpg: lpg * k, gas: yg * k, die: die * k, slu: slu * k, coke: coke * k, loss: 0.5 };
  }

  function ronOf(st, X) {
    return clamp(88 + 0.10 * (st.temp - 505) + 0.05 * (X - 66) + 0.15 * (st.mat - 66), 84, 96);
  }

  function tregOf(st, y) {
    return 630 + 12 * y.coke + 4 * (st.co - 6.5) + 1.5 * st.ccr;
  }

  function computeAll(st) {
    var X = conversionOf(st);
    var y = yieldsOf(X, st);
    return { X: X, y: y, ron: ronOf(st, X), treg: tregOf(st, y) };
  }

  /* ---------- 面板 1：装置示意 ---------- */
  function drawUnit(m) {
    var svg = $('unit');
    var W = 460, H = 262;
    var heat = clamp((m.treg - 660) / 90, 0, 1);
    var regFill = 'rgba(176,90,81,' + (0.07 + 0.3 * heat).toFixed(2) + ')';
    var tregColor = m.treg > 715 ? RED : (m.treg > 705 ? GOLD : GREEN);

    function arrow(x1, y1, x2, y2, color, dash) {
      var ang = Math.atan2(y2 - y1, x2 - x1), s = 6;
      var ax = x2 - s * Math.cos(ang), ay = y2 - s * Math.sin(ang);
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + ax.toFixed(1) + '" y2="' + ay.toFixed(1) + '" stroke="' + color + '" stroke-width="1.6"' + (dash ? ' stroke-dasharray="4 3"' : '') + '/>' +
        '<path d="M' + x2 + ',' + y2 + ' L' + (x2 - 8 * Math.cos(ang - 0.42)).toFixed(1) + ',' + (y2 - 8 * Math.sin(ang - 0.42)).toFixed(1) + ' L' + (x2 - 8 * Math.cos(ang + 0.42)).toFixed(1) + ',' + (y2 - 8 * Math.sin(ang + 0.42)).toFixed(1) + ' Z" fill="' + color + '"/>';
    }

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fbfaf6" rx="6"/>';

    /* 提升管反应器 */
    s += '<rect x="64" y="56" width="30" height="156" rx="5" fill="rgba(47,125,107,.1)" stroke="' + GREEN + '" stroke-width="1.6"/>';
    s += '<text x="52" y="140" font-size="9.5" fill="' + GREEN + '" text-anchor="middle" transform="rotate(-90 52 140)">提升管反应器</text>';
    s += '<text x="160" y="46" font-size="9" fill="' + GREEN + '" text-anchor="end" font-family="monospace" font-weight="600">反应温度 ' + S.temp.toFixed(0) + ' ℃</text>';

    /* 原料与回炼油进料 */
    s += arrow(8, 240, 62, 208, GRAY);
    s += '<text x="6" y="255" font-size="9" fill="' + GRAY + '">新鲜原料 420 t/h</text>';
    s += arrow(136, 238, 92, 212, GOLD, true);
    s += '<text x="122" y="252" font-size="9" fill="' + GOLD + '">回炼油 ' + (S.rec * FEED).toFixed(0) + ' t/h</text>';

    /* 反应油气 → 分馏塔 */
    s += arrow(94, 58, 166, 58, GREEN);
    s += '<text x="108" y="74" font-size="9" fill="' + GRAY + '">反应油气</text>';
    s += '<rect x="168" y="36" width="52" height="60" rx="4" fill="rgba(65,105,155,.08)" stroke="' + BLUE + '" stroke-width="1.5"/>';
    s += '<text x="194" y="70" font-size="9.5" fill="' + BLUE + '" text-anchor="middle">分馏塔</text>';

    /* 产品出料 */
    var prods = [
      { n: '干气+液化气', v: (m.y.dg + m.y.lpg).toFixed(1) + '%', y: 42, c: GOLD },
      { n: '汽油', v: m.y.gas.toFixed(1) + '%', y: 58, c: GREEN },
      { n: '柴油', v: m.y.die.toFixed(1) + '%', y: 74, c: BLUE },
      { n: '油浆', v: m.y.slu.toFixed(1) + '%', y: 90, c: RED }
    ];
    prods.forEach(function (p) {
      s += arrow(220, p.y, 262, p.y, p.c);
      s += '<text x="267" y="' + (p.y + 3) + '" font-size="8.5" fill="' + p.c + '" font-family="monospace">' + p.n + ' ' + p.v + '</text>';
    });

    /* 再生器 */
    s += '<rect x="306" y="96" width="122" height="116" rx="10" fill="' + regFill + '" stroke="' + RED + '" stroke-width="1.6"/>';
    s += '<text x="367" y="146" font-size="10" fill="' + RED + '" text-anchor="middle" font-weight="600">再生器</text>';
    s += '<text x="367" y="162" font-size="9" fill="' + tregColor + '" text-anchor="middle" font-family="monospace" font-weight="600">再生温度 ' + m.treg.toFixed(0) + ' ℃</text>';
    s += '<text x="367" y="176" font-size="8.5" fill="' + GRAY + '" text-anchor="middle">烧焦放热 → 供热给反应</text>';

    /* 烟气 */
    s += arrow(367, 96, 367, 42, GRAY);
    s += '<text x="375" y="46" font-size="9" fill="' + GRAY + '">烟气</text>';

    /* 待生 / 再生催化剂循环 */
    s += '<path d="M79,92 C170,102 250,112 302,130" fill="none" stroke="' + RED + '" stroke-width="1.5" stroke-dasharray="5 3"/>';
    s += '<path d="M302,130 l-9,-1 l4,8 Z" fill="' + RED + '"/>';
    s += '<text x="300" y="106" font-size="8.5" fill="' + RED + '" text-anchor="end">待生催化剂（含焦 ' + m.y.coke.toFixed(1) + '%）</text>';

    s += '<path d="M326,212 C250,228 150,224 96,208" fill="none" stroke="' + GREEN + '" stroke-width="1.8"/>';
    s += '<path d="M96,208 l9,-4 l-1,9 Z" fill="' + GREEN + '"/>';
    s += '<text x="176" y="240" font-size="8.5" fill="' + GREEN + '">再生催化剂（热）· 剂油比 ' + S.co.toFixed(1) + '</text>';

    /* 主风 */
    s += arrow(288, 244, 326, 214, GRAY);
    s += '<text x="268" y="256" font-size="9" fill="' + GRAY + '">主风</text>';

    svg.innerHTML = s;

    $('r-treact').innerHTML = S.temp.toFixed(0) + '<small> ℃</small>';
    $('r-treg').innerHTML = m.treg.toFixed(0) + '<small> ℃</small>';
    $('r-treg').parentNode.className = 'ro' + (m.treg > 715 ? ' bad' : '');
    $('r-coke').innerHTML = (FEED * m.y.coke / 100).toFixed(1) + '<small> t/h</small>';
    $('r-gas').innerHTML = (FEED * m.y.gas / 100).toFixed(1) + '<small> t/h</small>';
  }

  /* ---------- 通用 canvas tooltip ---------- */
  function attachTip(cv, box, tip, hit) {
    cv.addEventListener('mousemove', function (evt) {
      var r = cv.getBoundingClientRect();
      var lx = (evt.clientX - r.left) * (cv._lw / r.width);
      var ly = (evt.clientY - r.top) * (cv._lh / r.height);
      var html = hit(lx, ly);
      if (html) {
        var rb = box.getBoundingClientRect();
        tip.innerHTML = html;
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 10, 4, rb.height - 60) + 'px';
      } else tip.style.display = 'none';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 面板 2：产品分布堆叠条图 ---------- */
  var SEGS = [
    { k: 'dg', n: '干气', c: 'rgba(121,130,138,.45)', tc: GRAY },
    { k: 'lpg', n: '液化气', c: GOLD, tc: GOLD },
    { k: 'gas', n: '汽油', c: GREEN, tc: GREEN },
    { k: 'die', n: '柴油', c: BLUE, tc: BLUE },
    { k: 'slu', n: '油浆', c: RED, tc: RED },
    { k: 'coke', n: '焦炭', c: GRAY, tc: GRAY }
  ];
  var STK = { x0: 16, x1: 414, y0: 18, bh: 40, y1: 96, bh2: 20 };

  function drawStack(m) {
    var cv = $('stack');
    cv._lw = 430; cv._lh = 168;
    var ctx = setupCanvas(cv, 430, 168);
    ctx.clearRect(0, 0, 430, 168);
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, 430, 168);

    var W = STK.x1 - STK.x0;
    var x = STK.x0;
    ctx.font = '9.5px Consolas, monospace';
    /* 产品分布主条 */
    SEGS.forEach(function (g) {
      var w = m.y[g.k] / 100 * W;
      ctx.fillStyle = g.c;
      ctx.fillRect(x, STK.y0, w, STK.bh);
      if (w > 30) {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(m.y[g.k].toFixed(1), x + w / 2, STK.y0 + STK.bh / 2 + 3);
      }
      /* 名称标签：主条下方，过窄段隔行防重叠 */
      g._cx = x + w / 2; g._w = w;
      x += w;
    });
    /* 段分界 */
    ctx.strokeStyle = '#fbfaf6';
    ctx.lineWidth = 1;
    x = STK.x0;
    SEGS.forEach(function (g) {
      var w = m.y[g.k] / 100 * W;
      if (x > STK.x0) { ctx.beginPath(); ctx.moveTo(x, STK.y0); ctx.lineTo(x, STK.y0 + STK.bh); ctx.stroke(); }
      x += w;
    });
    ctx.strokeStyle = GRAY;
    ctx.strokeRect(STK.x0, STK.y0, W, STK.bh);

    /* 名称标签两行防重叠 */
    var rowUsed = [[], []];
    SEGS.forEach(function (g) {
      if (g._w < 8) return;
      var row = 0;
      for (var r = 0; r < 2; r++) {
        var ok = true;
        for (var i = 0; i < rowUsed[r].length; i++) {
          if (Math.abs(rowUsed[r][i] - g._cx) < 42) { ok = false; break; }
        }
        if (ok) { row = r; break; }
        row = 1;
      }
      rowUsed[row].push(g._cx);
      ctx.fillStyle = g.tc;
      ctx.textAlign = 'center';
      ctx.font = '9px sans-serif';
      ctx.fillText(g.n, g._cx, STK.y0 + STK.bh + 12 + row * 11);
    });
    ctx.font = '9.5px Consolas, monospace';

    /* 转化率细条 */
    ctx.fillStyle = GRAY;
    ctx.textAlign = 'left';
    ctx.font = '9.5px sans-serif';
    ctx.fillText('总转化率', STK.x0, STK.y1 - 6);
    var xw = m.X / 100 * W;
    ctx.fillStyle = GREEN;
    ctx.fillRect(STK.x0, STK.y1, xw, STK.bh2);
    ctx.fillStyle = 'rgba(121,130,138,.3)';
    ctx.fillRect(STK.x0 + xw, STK.y1, W - xw, STK.bh2);
    ctx.strokeStyle = GRAY;
    ctx.strokeRect(STK.x0, STK.y1, W, STK.bh2);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText(m.X.toFixed(1) + '%', STK.x0 + xw / 2, STK.y1 + STK.bh2 / 2 + 3.5);
    ctx.fillStyle = GRAY;
    ctx.fillText('未转化 ' + (100 - m.X).toFixed(1) + '%', STK.x0 + xw + (W - xw) / 2, STK.y1 + STK.bh2 / 2 + 3.5);

    /* 底部刻度 */
    ctx.fillStyle = GRAY;
    ctx.font = '8.5px Consolas, monospace';
    [0, 25, 50, 75, 100].forEach(function (p) {
      var tx = STK.x0 + p / 100 * W;
      ctx.textAlign = 'center';
      ctx.fillText(p + '%', tx, STK.y1 + STK.bh2 + 14);
      ctx.strokeStyle = LINE;
      ctx.beginPath(); ctx.moveTo(tx, STK.y1 + STK.bh2 + 2); ctx.lineTo(tx, STK.y1 + STK.bh2 + 6); ctx.stroke();
    });
    ctx.fillStyle = GRAY;
    ctx.textAlign = 'left';
    ctx.font = '9px sans-serif';
    ctx.fillText('收率闭合校验：六类收率 + 0.5% 损失 = 100%', STK.x0, 168 - 4);
  }

  function bindStackTip() {
    attachTip($('stack'), $('stk-box'), $('stk-tip'), function (lx, ly) {
      var m = computeAll(S);
      var W = STK.x1 - STK.x0;
      if (ly >= STK.y0 && ly <= STK.y0 + STK.bh && lx >= STK.x0 && lx <= STK.x1) {
        var acc = STK.x0;
        for (var i = 0; i < SEGS.length; i++) {
          var w = m.y[SEGS[i].k] / 100 * W;
          if (lx >= acc && lx <= acc + w) {
            return '<b>' + SEGS[i].n + '</b><br>收率 <b>' + m.y[SEGS[i].k].toFixed(2) + '%</b> · 产量 <b>' + (FEED * m.y[SEGS[i].k] / 100).toFixed(1) + ' t/h</b>';
          }
          acc += w;
        }
      }
      if (ly >= STK.y1 && ly <= STK.y1 + STK.bh2 && lx >= STK.x0 && lx <= STK.x1) {
        var xw = m.X / 100 * W;
        return lx <= STK.x0 + xw
          ? '<b>已转化部分</b><br>总转化率 <b>' + m.X.toFixed(1) + '%</b>'
          : '<b>未转化部分</b><br>柴油 + 油浆 <b>' + (m.y.die + m.y.slu).toFixed(1) + '%</b>';
      }
      return null;
    });
  }

  /* ---------- 面板 3：收率-转化率曲线 ---------- */
  var CV = { pl: 40, pr: 14, pt: 12, pb: 30, W: 430, H: 230 };
  var CV_CURVES = [
    { k: 'gas', n: '汽油', c: GREEN },
    { k: 'die', n: '柴油', c: BLUE },
    { k: 'lpg', n: '液化气', c: GOLD },
    { k: 'coke', n: '焦炭', c: RED }
  ];
  function cvX(X) { return CV.pl + (X - 50) / 42 * (CV.W - CV.pl - CV.pr); }
  function cvY(v) { return CV.pt + (CV.H - CV.pt - CV.pb) * (1 - clamp(v, 0, 55) / 55); }
  function cvXinv(px) { return 50 + (px - CV.pl) / (CV.W - CV.pl - CV.pr) * 42; }

  function drawConv(m) {
    var cv = $('conv');
    cv._lw = CV.W; cv._lh = CV.H;
    var ctx = setupCanvas(cv, CV.W, CV.H);
    ctx.clearRect(0, 0, CV.W, CV.H);
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, CV.W, CV.H);

    /* 网格与坐标 */
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'right';
    for (var v = 0; v <= 55; v += 10) {
      ctx.strokeStyle = v ? LINE : GRAY;
      ctx.beginPath(); ctx.moveTo(CV.pl, cvY(v)); ctx.lineTo(CV.W - CV.pr, cvY(v)); ctx.stroke();
      ctx.fillStyle = GRAY;
      ctx.fillText(v + '', CV.pl - 5, cvY(v) + 3);
    }
    ctx.textAlign = 'center';
    for (var X = 50; X <= 90; X += 10) {
      ctx.strokeStyle = LINE;
      ctx.beginPath(); ctx.moveTo(cvX(X), CV.pt); ctx.lineTo(cvX(X), CV.H - CV.pb); ctx.stroke();
      ctx.fillStyle = GRAY;
      ctx.fillText(X + '', cvX(X), CV.H - CV.pb + 13);
    }
    ctx.fillStyle = GRAY;
    ctx.font = '9px sans-serif';
    ctx.fillText('总转化率 (%)', CV.pl + (CV.W - CV.pl - CV.pr) / 2, CV.H - 3);
    ctx.save();
    ctx.translate(11, CV.pt + (CV.H - CV.pt - CV.pb) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('收率 (%)', 0, 0);
    ctx.restore();

    /* 汽油拐点标注 */
    ctx.strokeStyle = GOLD;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(cvX(75), CV.pt); ctx.lineTo(cvX(75), CV.H - CV.pb); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = GOLD;
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('汽油拐点≈75%', cvX(75) + 3, CV.pt + 9);

    /* 四条曲线 */
    var st = Object.assign({}, S);
    var ends = [];
    CV_CURVES.forEach(function (cu) {
      ctx.strokeStyle = cu.c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var X = 50; X <= 92; X += 1) {
        var y = yieldsOf(X, st)[cu.k];
        if (X === 50) ctx.moveTo(cvX(X), cvY(y)); else ctx.lineTo(cvX(X), cvY(y));
      }
      ctx.stroke();
      ends.push({ n: cu.n, c: cu.c, y: cvY(yieldsOf(92, st)[cu.k]) - 4 });
    });
    /* 末端标注按 y 排序后强制相邻间隔 ≥11px，避免互压 */
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var e = 1; e < ends.length; e++) {
      if (ends[e].y - ends[e - 1].y < 11) ends[e].y = ends[e - 1].y + 11;
    }
    ends.forEach(function (en) {
      ctx.fillStyle = en.c;
      ctx.font = '8.5px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(en.n, cvX(92) - 3, clamp(en.y, CV.pt + 8, CV.H - CV.pb - 2));
    });

    /* 当前操作点 */
    var cx0 = cvX(m.X);
    ctx.strokeStyle = GRAY;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx0, CV.pt); ctx.lineTo(cx0, CV.H - CV.pb); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = GRAY;
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('当前 ' + m.X.toFixed(1) + '%', clamp(cx0, CV.pl + 30, CV.W - CV.pr - 30), CV.pt - 3);
    CV_CURVES.forEach(function (cu) {
      ctx.fillStyle = cu.c;
      ctx.beginPath(); ctx.arc(cx0, cvY(m.y[cu.k]), 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
    });
  }

  function bindConvTip() {
    attachTip($('conv'), $('cv-box'), $('cv-tip'), function (lx, ly) {
      if (lx < CV.pl || lx > CV.W - CV.pr || ly < CV.pt || ly > CV.H - CV.pb) return null;
      var X = clamp(cvXinv(lx), 50, 92);
      var y = yieldsOf(X, S);
      return '转化率 <b>' + X.toFixed(1) + '%</b>（其余参数取当前值）<br>' +
        '汽油 <b>' + y.gas.toFixed(1) + '%</b> · 柴油 <b>' + y.die.toFixed(1) + '%</b><br>' +
        '液化气 <b>' + y.lpg.toFixed(1) + '%</b> · 焦炭 <b>' + y.coke.toFixed(1) + '%</b>';
    });
  }

  /* ---------- 面板 4：指标卡 + 诊断 ---------- */
  function renderMetrics(m) {
    $('m-conv').innerHTML = m.X.toFixed(1) + '<small> %</small>';
    $('m-gas').innerHTML = m.y.gas.toFixed(1) + '<small> %</small>';
    $('m-die').innerHTML = m.y.die.toFixed(1) + '<small> %</small>';
    $('m-coke').innerHTML = m.y.coke.toFixed(1) + '<small> %</small>';
    $('m-ron').innerHTML = m.ron.toFixed(1);
    $('m-treg').innerHTML = m.treg.toFixed(0) + '<small> ℃</small>';
    $('m-treg').parentNode.className = 'mcard' + (m.treg > 715 ? ' bad' : (m.treg > 705 ? ' warn' : ''));
    $('m-coke').parentNode.className = 'mcard' + (m.y.coke > 6 ? ' warn' : '');
    $('m-gas').parentNode.className = 'mcard' + (m.y.gas < 40 ? ' warn' : '');
  }

  function renderVerdict(m) {
    var v = $('verdict');
    var head = '转化率 <b>' + m.X.toFixed(1) + '</b>% · 汽油 <b>' + m.y.gas.toFixed(1) + '</b>% · RON <b>' + m.ron.toFixed(1) + '</b> · 再生温度 <b>' + m.treg.toFixed(0) + '</b> ℃；';
    if (m.treg > 715) {
      v.className = 'verdict bad';
      v.innerHTML = head + '再生器超温风险（约束 ≤715 ℃）：生焦 ' + m.y.coke.toFixed(1) + '% 偏高。建议：降低剂油比至 6 以下、降低回炼比，或切换低残炭原料；勿继续提反应温度。';
      return;
    }
    if (m.treg > 705) {
      v.className = 'verdict warn';
      v.innerHTML = head + '再生温度逼近上限，热平衡裕度不足。建议：小幅降剂油比或残炭，保留超温裕度。';
      return;
    }
    if (m.X > 80 && m.y.gas < 44) {
      v.className = 'verdict warn';
      v.innerHTML = head + '转化率过高，汽油进入过裂化区（气体 ' + (m.y.dg + m.y.lpg).toFixed(1) + '%）。建议：降反应温度或剂油比，把转化率拉回 72—78%。';
      return;
    }
    if (m.y.slu > 9) {
      v.className = 'verdict warn';
      v.innerHTML = head + '油浆收率 ' + m.y.slu.toFixed(1) + '% 偏高，原料偏重或活性不足。建议：提高 MAT 活性（补 fresh 剂）或适当提回炼比压油浆。';
      return;
    }
    if (m.y.gas >= 44) {
      v.className = 'verdict ok';
      v.innerHTML = head + '汽油收率处于高效区（≥44%），热平衡可行。按 P50 口径可直接支撑排产；优化取 P10 做保守约束。';
    } else {
      v.className = 'verdict warn';
      v.innerHTML = head + '汽油收率偏低（<44%）。建议：提高反应温度 / 剂油比 / 催化剂活性，目标转化率 72—78%。';
    }
  }

  /* ---------- 面板 5：操作点寻优 ---------- */
  var CANDS = [], FRONT_ONLY = false, SEL = -1;
  var OPT = { pl: 40, pr: 14, pt: 16, pb: 32, W: 430, H: 250 };

  function genCands() {
    CANDS = [];
    var temps = [492, 498, 504, 510, 516, 522, 528];
    var cos = [4.5, 5.5, 6.5, 7.5, 8.5, 9.5];
    temps.forEach(function (t) {
      cos.forEach(function (co) {
        var st = Object.assign({}, S, { temp: t, co: co });
        var m = computeAll(st);
        CANDS.push({ t: t, co: co, gas: m.y.gas, die: m.y.die, treg: m.treg, feas: m.treg <= 715 });
      });
    });
    SEL = -1;
    drawOpt();
  }

  function paretoIdx(list) {
    var front = [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i].feas) continue;
      var dom = false;
      for (var j = 0; j < list.length; j++) {
        if (i === j || !list[j].feas) continue;
        if (list[j].gas >= list[i].gas && list[j].die >= list[i].die &&
          (list[j].gas > list[i].gas || list[j].die > list[i].die)) { dom = true; break; }
      }
      if (!dom) front.push(i);
    }
    return front;
  }

  function drawOpt() {
    var svg = $('opt');
    var W = OPT.W, H = OPT.H, pl = OPT.pl, pr = OPT.pr, pt = OPT.pt, pb = OPT.pb;
    var pw = W - pl - pr, ph = H - pt - pb;
    if (!CANDS.length) {
      svg.innerHTML = '<rect width="' + W + '" height="' + H + '" fill="#fbfaf6"/>' +
        '<text x="' + W / 2 + '" y="' + H / 2 + '" font-size="11" fill="' + GRAY + '" text-anchor="middle">点击「生成 42 个候选方案」开始对比</text>';
      return;
    }
    var gMin = 1e9, gMax = -1e9, dMin = 1e9, dMax = -1e9;
    CANDS.forEach(function (c) {
      gMin = Math.min(gMin, c.gas); gMax = Math.max(gMax, c.gas);
      dMin = Math.min(dMin, c.die); dMax = Math.max(dMax, c.die);
    });
    gMin = Math.floor(gMin - 1); gMax = Math.ceil(gMax + 1);
    dMin = Math.floor(dMin - 1); dMax = Math.ceil(dMax + 1);
    function xp(v) { return pl + (v - gMin) / (gMax - gMin) * pw; }
    function yp(v) { return pt + ph - (v - dMin) / (dMax - dMin) * ph; }

    var frontSet = {};
    paretoIdx(CANDS).forEach(function (i) { frontSet[i] = true; });

    var s = '<rect width="' + W + '" height="' + H + '" fill="#fbfaf6"/>';
    var gx;
    for (gx = Math.ceil(gMin); gx <= gMax; gx += 2) {
      s += '<line x1="' + xp(gx) + '" y1="' + pt + '" x2="' + xp(gx) + '" y2="' + (pt + ph) + '" stroke="' + LINE + '"/>';
      s += '<text x="' + xp(gx) + '" y="' + (pt + ph + 13) + '" font-size="8.5" fill="' + GRAY + '" text-anchor="middle" font-family="monospace">' + gx + '</text>';
    }
    for (var gy = Math.ceil(dMin); gy <= dMax; gy += 2) {
      s += '<line x1="' + pl + '" y1="' + yp(gy) + '" x2="' + (pl + pw) + '" y2="' + yp(gy) + '" stroke="' + LINE + '"/>';
      s += '<text x="' + (pl - 5) + '" y="' + (yp(gy) + 3) + '" font-size="8.5" fill="' + GRAY + '" text-anchor="end" font-family="monospace">' + gy + '</text>';
    }

    /* 候选点 */
    for (var i = 0; i < CANDS.length; i++) {
      var c = CANDS[i];
      if (FRONT_ONLY && !frontSet[i]) continue;
      var fill = c.feas ? GREEN : RED;
      var stroke = frontSet[i] ? GOLD : '#fff';
      var sw = frontSet[i] ? 2 : 1;
      if (i === SEL) { stroke = BLUE; sw = 2.5; }
      var tip = '反应温度 ' + c.t + ' ℃ / 剂油比 ' + c.co + '&#10;汽油 ' + c.gas.toFixed(1) + '% · 柴油 ' + c.die.toFixed(1) + '%&#10;再生温度 ' + c.treg.toFixed(0) + ' ℃' + (c.feas ? '' : '（超限）') + (frontSet[i] ? ' · 帕累托前沿' : '');
      s += '<circle data-idx="' + i + '" cx="' + xp(c.gas).toFixed(1) + '" cy="' + yp(c.die).toFixed(1) + '" r="6" fill="' + fill + '" fill-opacity="' + (c.feas ? 0.75 : 0.45) + '" stroke="' + stroke + '" stroke-width="' + sw + '" style="cursor:pointer"><title>' + tip + '</title></circle>';
    }

    /* 当前操作点 */
    var m0 = computeAll(S);
    s += '<circle cx="' + xp(m0.y.gas).toFixed(1) + '" cy="' + yp(m0.y.die).toFixed(1) + '" r="8" fill="none" stroke="' + GOLD + '" stroke-width="2.5"/>';
    s += '<text x="' + clamp(xp(m0.y.gas), pl + 34, pl + pw - 34).toFixed(1) + '" y="' + (yp(m0.y.die) - 12).toFixed(1) + '" font-size="9" fill="' + GOLD + '" text-anchor="middle" font-weight="600">当前</text>';

    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 4) + '" font-size="9" fill="' + GRAY + '" text-anchor="middle">汽油收率 (%)</text>';
    s += '<text x="' + (pl - 30) + '" y="' + (pt + ph / 2) + '" font-size="9" fill="' + GRAY + '" text-anchor="middle" transform="rotate(-90 ' + (pl - 30) + ' ' + (pt + ph / 2) + ')">柴油收率 (%)</text>';

    svg.innerHTML = s;

    Array.prototype.forEach.call(svg.querySelectorAll('circle[data-idx]'), function (el) {
      el.addEventListener('click', function () {
        var c = CANDS[+el.getAttribute('data-idx')];
        if (!c) return;
        S.temp = c.t; S.co = c.co;
        SEL = +el.getAttribute('data-idx');
        syncSlidersFromS();
        render();
        drawOpt();
      });
    });
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    temp: function (v) { return v.toFixed(0) + ' ℃'; },
    co: function (v) { return v.toFixed(1); },
    rec: function (v) { return v.toFixed(2); },
    ccr: function (v) { return v.toFixed(1) + ' %'; },
    rho: function (v) { return v.toFixed(3) + ' g/cm³'; },
    t50: function (v) { return v.toFixed(0) + ' ℃'; },
    mat: function (v) { return v.toFixed(0); }
  };
  var KEYS = ['temp', 'co', 'rec', 'ccr', 'rho', 't50', 'mat'];

  function syncSlidersFromS() {
    KEYS.forEach(function (k) {
      var el = $('s-' + k), out = $('o-' + k);
      if (el) el.value = S[k];
      if (out) out.textContent = OUT[k](S[k]);
    });
  }

  function render() {
    var m = computeAll(S);
    drawUnit(m);
    drawStack(m);
    drawConv(m);
    renderMetrics(m);
    renderVerdict(m);
    return m;
  }

  function bind() {
    KEYS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      syncSlidersFromS();
      render();
      genCands();
    });
    $('btn-gen').addEventListener('click', genCands);
    $('btn-front').addEventListener('click', function () {
      FRONT_ONLY = !FRONT_ONLY;
      this.textContent = FRONT_ONLY ? '显示全部候选' : '仅显示帕累托前沿';
      drawOpt();
    });
    $('btn-gas').addEventListener('click', function () {
      S.temp = 522; S.co = 8.5; S.rec = 0.10;
      syncSlidersFromS(); render(); genCands();
    });
    $('btn-die').addEventListener('click', function () {
      S.temp = 496; S.co = 5.0; S.rec = 0.40;
      syncSlidersFromS(); render(); genCands();
    });
  }

  /* ---------- 页签 ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
        if (id === 'real') drawReal();
      });
    });
  }

  /* ================= 真实数据来源页 ================= */
  var REAL_DRAWN = false;
  var RANGE = [
    { n: '干气', lo: 3, hi: 5, c: 'rgba(121,130,138,.45)' },
    { n: '液化气', lo: 13, hi: 18, c: GOLD },
    { n: '汽油', lo: 40, hi: 48, c: GREEN },
    { n: '柴油', lo: 20, hi: 26, c: BLUE },
    { n: '油浆', lo: 5, hi: 9, c: RED },
    { n: '焦炭', lo: 4, hi: 6, c: GRAY }
  ];
  var RG = { pl: 70, pr: 30, pt: 16, pb: 28, W: 900, H: 230 };
  function rgX(v) { return RG.pl + v / 55 * (RG.W - RG.pl - RG.pr); }

  function drawRange() {
    var cv = $('range'); if (!cv) return;
    cv._lw = RG.W; cv._lh = RG.H;
    var ctx = setupCanvas(cv, RG.W, RG.H);
    ctx.clearRect(0, 0, RG.W, RG.H);
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, RG.W, RG.H);

    var n = RANGE.length;
    var rowH = (RG.H - RG.pt - RG.pb) / n;
    ctx.font = '9px Consolas, monospace';
    for (var v = 0; v <= 50; v += 10) {
      ctx.strokeStyle = v ? LINE : GRAY;
      ctx.beginPath(); ctx.moveTo(rgX(v), RG.pt); ctx.lineTo(rgX(v), RG.H - RG.pb); ctx.stroke();
      ctx.fillStyle = GRAY;
      ctx.textAlign = 'center';
      ctx.fillText(v + '%', rgX(v), RG.H - RG.pb + 14);
    }
    RANGE.forEach(function (r, i) {
      var cy = RG.pt + rowH * (i + 0.5);
      var bh = Math.min(22, rowH * 0.5);
      ctx.fillStyle = 'rgba(121,130,138,.15)';
      ctx.fillRect(rgX(r.lo), cy - bh / 2, rgX(r.hi) - rgX(r.lo), bh);
      ctx.fillStyle = r.c;
      ctx.fillRect(rgX(r.lo), cy - bh / 2, rgX(r.hi) - rgX(r.lo), bh * 0.55);
      ctx.strokeStyle = GRAY;
      ctx.strokeRect(rgX(r.lo), cy - bh / 2, rgX(r.hi) - rgX(r.lo), bh);
      /* 中点标记 */
      var mid = (r.lo + r.hi) / 2;
      ctx.fillStyle = GRAY;
      ctx.beginPath(); ctx.arc(rgX(mid), cy - bh / 2 - 5, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = GRAY;
      ctx.textAlign = 'center';
      ctx.font = '9.5px Consolas, monospace';
      ctx.fillText(r.lo + '—' + r.hi + '%', rgX(mid), cy + bh * 0.28 + 2);
      ctx.fillStyle = GRAY;
      ctx.textAlign = 'right';
      ctx.font = '10px sans-serif';
      ctx.fillText(r.n, RG.pl - 8, cy + 3.5);
    });
    ctx.fillStyle = GRAY;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('收率 (%，对原料)', RG.pl + (RG.W - RG.pl - RG.pr) / 2, RG.H - 3);
  }

  function bindRangeTip() {
    attachTip($('range'), $('rg-box'), $('rg-tip'), function (lx, ly) {
      if (lx < RG.pl || lx > RG.W - RG.pr) return null;
      var n = RANGE.length;
      var rowH = (RG.H - RG.pt - RG.pb) / n;
      var i = Math.floor((ly - RG.pt) / rowH);
      if (i < 0 || i >= n) return null;
      var r = RANGE[i];
      return '<b>' + r.n + '</b><br>典型收率区间 <b>' + r.lo + '%—' + r.hi + '%</b><br><span style="color:' + GRAY + '">《催化裂化工艺与工程》口径</span>';
    });
  }

  var TR = { pl: 46, pr: 20, pt: 18, pb: 30, W: 900, H: 240 };
  function trX(X) { return TR.pl + (X - 50) / 40 * (TR.W - TR.pl - TR.pr); }
  function trY(v) { return TR.pt + (TR.H - TR.pt - TR.pb) * (1 - v / 50); }
  function trXinv(px) { return 50 + (px - TR.pl) / (TR.W - TR.pl - TR.pr) * 40; }

  function drawTrend() {
    var cv = $('trend'); if (!cv) return;
    cv._lw = TR.W; cv._lh = TR.H;
    var ctx = setupCanvas(cv, TR.W, TR.H);
    ctx.clearRect(0, 0, TR.W, TR.H);
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, TR.W, TR.H);

    ctx.font = '8.5px Consolas, monospace';
    for (var v = 0; v <= 50; v += 10) {
      ctx.strokeStyle = v ? LINE : GRAY;
      ctx.beginPath(); ctx.moveTo(TR.pl, trY(v)); ctx.lineTo(TR.W - TR.pr, trY(v)); ctx.stroke();
      ctx.fillStyle = GRAY;
      ctx.textAlign = 'right';
      ctx.fillText(v + '', TR.pl - 5, trY(v) + 3);
    }
    for (var X = 50; X <= 90; X += 10) {
      ctx.strokeStyle = LINE;
      ctx.beginPath(); ctx.moveTo(trX(X), TR.pt); ctx.lineTo(trX(X), TR.H - TR.pb); ctx.stroke();
      ctx.fillStyle = GRAY;
      ctx.textAlign = 'center';
      ctx.fillText(X + '', trX(X), TR.H - TR.pb + 13);
    }
    ctx.fillStyle = GRAY;
    ctx.font = '9px sans-serif';
    ctx.fillText('总转化率 (%)', TR.pl + (TR.W - TR.pl - TR.pr) / 2, TR.H - 3);
    ctx.save();
    ctx.translate(12, TR.pt + (TR.H - TR.pt - TR.pb) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('收率 (%)', 0, 0);
    ctx.restore();

    /* 三条趋势曲线：汽油（过裂化）/ 气体（单调升）/ 重油（单调降） */
    var st = Object.assign({}, DEF);
    function gasY(X) { return 1.2 * X - 0.008 * X * X; }
    function fuelGasY(X) { return 0.41 * X - 11.8; }      /* 干气+液化气 @T=505 */
    function heavyY(X) { return 100 - X; }                /* 柴油+油浆 */
    var curves = [
      { f: gasY, c: GREEN, n: '汽油（先升后降 · 过裂化）' },
      { f: fuelGasY, c: GOLD, n: '干气+液化气（随温度/转化率上升）' },
      { f: heavyY, c: GRAY, n: '柴油+油浆（未转化部分）' }
    ];
    curves.forEach(function (cu) {
      ctx.strokeStyle = cu.c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var X = 50; X <= 90; X += 1) {
        if (X === 50) ctx.moveTo(trX(X), trY(cu.f(X))); else ctx.lineTo(trX(X), trY(cu.f(X)));
      }
      ctx.stroke();
    });
    /* 汽油峰值标注（置于峰值点下方，避开图例与曲线） */
    ctx.fillStyle = GREEN;
    ctx.beginPath(); ctx.arc(trX(75), trY(gasY(75)), 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = GREEN;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('汽油收率峰值 ≈45%（转化率 ≈75%）', trX(75), trY(gasY(75)) + 18);

    /* 图例（图内右上，带底色避免与曲线相压） */
    var lx0 = TR.W - TR.pr - 268, ly0 = TR.pt + 8;
    ctx.fillStyle = 'rgba(251,250,246,.92)';
    ctx.fillRect(lx0 - 8, ly0 - 9, 276, 50);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(lx0 - 8, ly0 - 9, 276, 50);
    curves.forEach(function (cu, i) {
      ctx.strokeStyle = cu.c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx0, ly0 + i * 14); ctx.lineTo(lx0 + 16, ly0 + i * 14); ctx.stroke();
      ctx.fillStyle = cu.c;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(cu.n, lx0 + 21, ly0 + i * 14 + 3);
    });
  }

  function bindTrendTip() {
    attachTip($('trend'), $('tr-box'), $('tr-tip'), function (lx, ly) {
      if (lx < TR.pl || lx > TR.W - TR.pr || ly < TR.pt || ly > TR.H - TR.pb) return null;
      var X = clamp(trXinv(lx), 50, 90);
      var g = 1.2 * X - 0.008 * X * X, fg = 0.41 * X - 11.8, hv = 100 - X;
      return '转化率 <b>' + X.toFixed(0) + '%</b> 时（趋势示意）<br>' +
        '汽油 <b>' + g.toFixed(1) + '%</b> · 干气+液化气 <b>' + fg.toFixed(1) + '%</b><br>' +
        '柴油+油浆 <b>' + hv.toFixed(1) + '%</b>';
    });
  }

  function drawReal() {
    if (REAL_DRAWN) return;
    REAL_DRAWN = true;
    drawRange();
    drawTrend();
    bindRangeTip();
    bindTrendTip();
  }

  /* ---------- 启动 ---------- */
  bind();
  bindTabs();
  render();
  bindStackTip();
  bindConvTip();
  genCands();
  drawReal();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      var m = computeAll(S);
      drawStack(m); drawConv(m);
      if (REAL_DRAWN) { drawRange(); drawTrend(); }
    }, 120);
  });
})();
