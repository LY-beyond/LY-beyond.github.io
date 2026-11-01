/* ======= 集输系统工况智能优化 · 可运行示范 ======= */
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

  /* ================= 物理模型 ================= */
  var RHO = 850, GRAV = 9.81;
  var D_LINE = 0.36, L_LINE = 18000;      // 干线 DN350（内径近似）× 18 km
  var A_LINE = Math.PI / 4 * D_LINE * D_LINE;
  var EPS = 4.6e-5;                        // 钢管绝对粗糙度 m
  var H_STATIC = 12, H_END = 72;           // 静压差 m、末站压头（0.6 MPa）
  var PMP_H0 = 217.0, PMP_K = 0.0028, Q_BEP = 130, ETA0 = 0.78;
  var GOR = 45, D_BR = 0.2, A_BR = Math.PI / 4 * D_BR * D_BR;
  var MPA_PER_M = RHO * GRAV / 1e6;

  var DEF = { ql: 16800, pumps: 4, freq: 50, valve: 60, temp: 60, shift: 0 };
  var OPT = { ql: 16800, pumps: 3, freq: 50, valve: 100, temp: 68, shift: 32 };
  var S = Object.assign({}, DEF);

  function muOf(T) { return 30 * Math.exp(-0.035 * (T - 50)) / 1000; } // Pa·s

  function frictionFactor(Re) {
    if (Re < 2300) return 64 / Math.max(Re, 1);
    var a = EPS / (3.7 * D_LINE) + 5.74 / Math.pow(Re, 0.9);
    var lg = Math.log(a) / Math.LN10;
    return 0.25 / (lg * lg);
  }

  /* 干线沿程摩阻压头损失（m），Q 单位 m³/h */
  function lineHf(Q, T) {
    var v = Q / 3600 / A_LINE;
    var Re = RHO * v * D_LINE / muOf(T);
    return frictionFactor(Re) * (L_LINE / D_LINE) * v * v / (2 * GRAV);
  }

  function pumpHead(Q, n, f) {
    var q = Q / n;
    return PMP_H0 * Math.pow(f / 50, 2) - PMP_K * q * q;
  }
  function pumpEta(Q, n) {
    var r = Q / n / Q_BEP;
    return Math.max(0.3, ETA0 * (1 - 1.6 * (r - 1) * (r - 1)));
  }
  function valveKv(v) { return 600 * Math.pow(Math.max(100 / v - 1, 0), 1.7); }
  function velHead(Q) { var v = Q / 3600 / A_LINE; return v * v / (2 * GRAV); }

  /* 泵—阀—管网平衡流量（m³/h），二分求解 */
  function solveQ(n, f, v, T) {
    var h0 = PMP_H0 * Math.pow(f / 50, 2);
    if (h0 <= H_STATIC + H_END + 1) return 0;
    function resid(Q) {
      return pumpHead(Q, n, f) - (H_STATIC + H_END + lineHf(Q, T) + valveKv(v) * velHead(Q));
    }
    var lo = 0, hi = 1400;
    if (resid(hi) > 0) return hi;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (resid(mid) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* Beggs-Brill(1973) 流型判别：0 分离流 1 过渡流 2 间歇流 3 分散流 */
  function bbClass(lam, Fr) {
    var L1 = 316 * Math.pow(lam, 0.302);
    var L2 = 0.0009252 * Math.pow(lam, -2.4684);
    var L3 = 0.1 * Math.pow(lam, -1.4516);
    var L4 = 0.5 * Math.pow(lam, -6.738);
    if ((lam < 0.01 && Fr < L1) || (lam >= 0.01 && Fr < L2)) return 0;
    if (lam >= 0.01 && Fr >= L2 && Fr < L3) return 1;
    if ((lam >= 0.01 && lam < 0.4 && Fr >= L3 && Fr <= L1) || (lam >= 0.4 && Fr > L3 && Fr <= L4)) return 2;
    return 3;
  }
  var FLOW_NAMES = ['分离流（分层/波状）', '过渡流', '间歇流（段塞）', '分散流（泡状/雾状）'];
  var FLOW_COLORS = ['#41699b', '#c9a15a', '#b05a51', '#2f7d6b'];

  /* 支线（DN200，GOR45，0.8 MPa，333 K）工况点 */
  function branchPoint(ql) {
    var qL = ql / 3 / 86400;
    var qG = ql / 3 * GOR / 86400 * (0.101325 / 0.8) * (333 / 288);
    var vsl = qL / A_BR, vsg = qG / A_BR, vm = vsl + vsg;
    return { lam: vsl / vm, fr: vm * vm / (GRAV * D_BR), vsl: vsl, vsg: vsg };
  }

  /* 分时电价：谷 23–7 时 0.35，峰 8–11、18–21 时 0.91，其余平段 0.63 */
  function priceOf(h) {
    if (h >= 23 || h <= 6) return 0.35;
    if ((h >= 8 && h <= 10) || (h >= 18 && h <= 20)) return 0.91;
    return 0.63;
  }

  /* 给定状态计算全部派生量 */
  function model(st) {
    var plan = 0.548 * st.ql / 24;                     // 计划外输 m³/h
    var qeq = solveQ(st.pumps, st.freq, st.valve, st.temp);
    var qact = Math.min(plan, qeq);
    var deficit = plan > 1 ? Math.max(0, plan - qeq) / plan : 0;
    var Hp = pumpHead(qact, st.pumps, st.freq);
    var hf = lineHf(qact, st.temp);
    var surplus = Math.max(0, Hp - (H_STATIC + H_END + hf));
    var hValve = st.valve < 99.5 ? surplus : 0;
    var pEnd = (H_END + (st.valve < 99.5 ? 0 : surplus)) * MPA_PER_M;
    var pOut = Hp * MPA_PER_M;
    var eta = pumpEta(qact, st.pumps);
    var pPump = st.pumps * RHO * GRAV * (qact / st.pumps / 3600) * Hp / eta / 1000; // kW
    var pAux = st.ql / 24 * 1.54 * (0.72 + 0.28 * Math.pow(st.freq / 50, 2));        // kW
    var eDay = (pPump + pAux) * 24;
    var cons = eDay / st.ql;
    var throttle = Hp > 1 ? hValve / Hp : 0;
    /* 加热炉燃料气成本：负荷 ∝ 液量 × 温升（进线 32℃），气价 1.6 元/m³，热值 38 MJ/m³，炉效 0.85 */
    var heatKW = RHO * (qact / 3600) * 2100 * Math.max(st.temp - 32, 5) / 1000;
    var gasDay = heatKW * 24 * 3.6 / 38 / 0.85 * 1.6 / 10000;                        // 万元/d
    /* 24h 电费（移峰保持总电量不变） */
    var pAvg = pPump + pAux;
    var base = [], cost = 0, cut = 0, i;
    for (i = 0; i < 24; i++) {
      base.push(pAvg * (1 + 0.08 * Math.sin(2 * Math.PI * (i - 6) / 24)));
      if (priceOf(i) > 0.9) cut += base[i] * st.shift / 100;
    }
    var valleyN = 0;
    for (i = 0; i < 24; i++) if (priceOf(i) < 0.4) valleyN++;
    for (i = 0; i < 24; i++) {
      var L = base[i];
      if (priceOf(i) > 0.9) L -= base[i] * st.shift / 100;
      else if (priceOf(i) < 0.4) L += cut / valleyN;
      cost += L * priceOf(i);
    }
    var bp = branchPoint(st.ql);
    return {
      plan: plan, qact: qact, deficit: deficit, Hp: Hp, hf: hf, hValve: hValve,
      pOut: pOut, pEnd: pEnd, eta: eta, pPump: pPump, pAux: pAux,
      eDay: eDay, cons: cons, throttle: throttle, gasDay: gasDay,
      costDay: cost / 10000, bp: bp, flow: bbClass(bp.lam, bp.fr)
    };
  }

  /* ================= ① 管网拓扑（SVG） ================= */
  var SEGS = [
    { id: 'w1m1', x1: 86, y1: 48, x2: 218, y2: 96, dn: 'DN200', len: 2.4, kind: 'br' },
    { id: 'w2m1', x1: 86, y1: 128, x2: 218, y2: 104, dn: 'DN200', len: 1.8, kind: 'br' },
    { id: 'w2m2', x1: 86, y1: 136, x2: 218, y2: 160, dn: 'DN200', len: 2.1, kind: 'br' },
    { id: 'w3m2', x1: 86, y1: 208, x2: 218, y2: 168, dn: 'DN200', len: 2.6, kind: 'br' },
    { id: 'm1c', x1: 262, y1: 100, x2: 352, y2: 122, dn: 'DN300', len: 3.5, kind: 'm2c' },
    { id: 'm2c', x1: 262, y1: 164, x2: 352, y2: 142, dn: 'DN300', len: 4.2, kind: 'm2c' },
    { id: 'trunk', x1: 468, y1: 132, x2: 632, y2: 132, dn: 'DN350', len: 18, kind: 'trunk' }
  ];

  function drawTopo(R) {
    var svg = $('topo');
    var st = S;
    var qBr = st.ql / 3 / 24;                    // 单井场液量 m³/h
    var bp = R.bp;
    var brCls = R.flow === 2 ? 'warn' : 'ok';    // 段塞流判警戒
    var vBr = (qBr / 3600) / A_BR;
    var qM = qBr * 2;
    var vM = (qM / 3600) / (Math.PI / 4 * 0.3 * 0.3);
    var vT = (R.qact / 3600) / A_LINE;
    var trunkCls = R.pOut > 1.6 || R.deficit > 0.02 ? 'bad' : (R.hf / 18 > 4.5 ? 'warn' : 'ok');
    var COL = { ok: '#2f7d6b', warn: '#c9a15a', bad: '#b05a51' };

    function segStatus(sg) {
      if (sg.kind === 'br') return { cls: brCls, flow: qBr, vel: vBr, note: FLOW_NAMES[R.flow] };
      if (sg.kind === 'm2c') return { cls: vM > 1.8 ? 'warn' : 'ok', flow: qM, vel: vM, note: '分离后液相' };
      return { cls: trunkCls, flow: R.qact, vel: vT, note: '压降 ' + R.hf.toFixed(0) + ' m（' + (R.hf / 18).toFixed(1) + ' m/km）' };
    }

    var s = '<rect width="740" height="262" fill="#fdfcf9" rx="6"/>';

    /* 管段 */
    SEGS.forEach(function (sg) {
      var info = segStatus(sg);
      var c = COL[info.cls];
      s += '<g data-seg="' + sg.id + '" style="cursor:pointer">'
        + '<line x1="' + sg.x1 + '" y1="' + sg.y1 + '" x2="' + sg.x2 + '" y2="' + sg.y2 + '" stroke="' + c + '" stroke-width="' + (sg.kind === 'trunk' ? 5 : 3) + '" stroke-linecap="round" opacity="0.85"/>'
        + '<line x1="' + sg.x1 + '" y1="' + sg.y1 + '" x2="' + sg.x2 + '" y2="' + sg.y2 + '" stroke="transparent" stroke-width="14"/>'
        + '</g>';
      var mx = (sg.x1 + sg.x2) / 2, my = (sg.y1 + sg.y2) / 2;
      var dy = sg.kind === 'br' ? -7 : (sg.kind === 'trunk' ? -10 : -8);
      s += '<text x="' + mx + '" y="' + (my + dy) + '" font-size="8.5" fill="#79828a" text-anchor="middle" font-family="monospace">' + sg.dn + '·' + sg.len + 'km</text>';
      if (sg.kind === 'trunk') {
        s += '<text x="' + mx + '" y="' + (my + 16) + '" font-size="8.5" fill="' + c + '" text-anchor="middle" font-family="monospace" font-weight="600">' + info.flow.toFixed(0) + ' m³/h · ' + info.vel.toFixed(2) + ' m/s</text>';
      }
    });

    /* 瓶颈标注 */
    var bad = null, warn = null;
    SEGS.forEach(function (sg) {
      var info = segStatus(sg);
      if (info.cls === 'bad' && !bad) bad = sg;
      else if (info.cls === 'warn' && !warn) warn = sg;
    });
    var bn = bad || warn;
    if (bn) {
      var info2 = segStatus(bn);
      var bx = (bn.x1 + bn.x2) / 2, by = (bn.y1 + bn.y2) / 2;
      s += '<rect x="' + (bx - 62) + '" y="' + (by + (bn.kind === 'trunk' ? 22 : 8)) + '" width="124" height="15" rx="3" fill="#faeae6" stroke="#b05a51" stroke-width="0.8"/>'
        + '<text x="' + bx + '" y="' + (by + (bn.kind === 'trunk' ? 33 : 19)) + '" font-size="9" fill="#b05a51" text-anchor="middle" font-weight="600">⚠ 瓶颈：' + (bad ? '超压/欠输' : info2.note) + '</text>';
    }

    /* 井场节点 */
    var wells = [[60, 48, '井场 W1'], [60, 128, '井场 W2'], [60, 208, '井场 W3']];
    wells.forEach(function (w) {
      s += '<rect x="' + (w[0] - 26) + '" y="' + (w[1] - 14) + '" width="52" height="28" rx="5" fill="#e9f1ec" stroke="#2f7d6b" stroke-width="1.2"/>'
        + '<text x="' + w[0] + '" y="' + (w[1] - 2) + '" font-size="9" fill="#235f51" text-anchor="middle" font-weight="600">' + w[2] + '</text>'
        + '<text x="' + w[0] + '" y="' + (w[1] + 9) + '" font-size="8" fill="#79828a" text-anchor="middle" font-family="monospace">' + qBr.toFixed(0) + ' m³/h</text>';
    });

    /* 计量站 */
    var mts = [[240, 100, '计量站 M1'], [240, 164, '计量站 M2']];
    mts.forEach(function (m) {
      s += '<rect x="' + (m[0] - 24) + '" y="' + (m[1] - 13) + '" width="48" height="26" rx="5" fill="#eef2f7" stroke="#41699b" stroke-width="1.2"/>'
        + '<text x="' + m[0] + '" y="' + (m[1] + 3) + '" font-size="9" fill="#3a5a86" text-anchor="middle" font-weight="600">' + m[2] + '</text>';
    });

    /* 联合站 CPF */
    s += '<rect x="352" y="106" width="116" height="52" rx="7" fill="#efece1" stroke="#8a9298" stroke-width="1.3"/>'
      + '<text x="410" y="126" font-size="10" fill="#4d565b" text-anchor="middle" font-weight="600">联合站 CPF</text>'
      + '<text x="410" y="139" font-size="8" fill="#79828a" text-anchor="middle">分离/脱水/加热 ' + S.temp + '℃</text>'
      + '<text x="410" y="150" font-size="8" fill="#79828a" text-anchor="middle" font-family="monospace">泵组 ' + S.pumps + ' 台 · ' + S.freq + ' Hz</text>';

    /* 末站 */
    var pCol = R.pEnd < 0.6 ? '#b05a51' : '#235f51';
    s += '<rect x="632" y="112" width="72" height="40" rx="6" fill="#e9f1ec" stroke="#2f7d6b" stroke-width="1.2"/>'
      + '<text x="668" y="128" font-size="9.5" fill="#235f51" text-anchor="middle" font-weight="600">外输末站</text>'
      + '<text x="668" y="141" font-size="8.5" fill="' + pCol + '" text-anchor="middle" font-family="monospace">' + R.pEnd.toFixed(2) + ' MPa</text>';

    /* 压力标注（蓝点） */
    s += '<circle cx="486" cy="132" r="3.5" fill="#41699b"/>'
      + '<text x="486" y="122" font-size="8.5" fill="#41699b" font-family="monospace" text-anchor="middle">' + R.pOut.toFixed(2) + ' MPa</text>';

    svg.innerHTML = s;
    bindTopoTips(R, segStatus);
  }

  function bindTopoTips(R, segStatus) {
    var svg = $('topo'), tip = $('topo-tip'), box = $('topo-box');
    Array.prototype.forEach.call(svg.querySelectorAll('g[data-seg]'), function (g) {
      var sg = null;
      SEGS.forEach(function (o) { if (o.id === g.getAttribute('data-seg')) sg = o; });
      g.addEventListener('mousemove', function (evt) {
        var info = segStatus(sg);
        var rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + sg.dn + ' × ' + sg.len + ' km</b><br>流量 <b>' + info.flow.toFixed(0) + '</b> m³/h · 流速 <b>' + info.vel.toFixed(2) + '</b> m/s<br>' + info.note;
        tip.style.display = 'block';
        tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
        tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
      });
      g.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    });
  }

  /* ================= ③a 沿程压力/温度曲线（canvas） ================= */
  var profGeom = null;
  function drawProfile(R) {
    var W = 430, H = 246;
    var cv = $('profile'), ctx = setupCanvas(cv, W, H);
    var pl = 38, pr = 40, pt = 14, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var yMax = Math.max(1.8, Math.ceil(R.pOut * 4) / 4 + 0.2);
    var T_SOIL = 8;

    function X(km) { return pl + km / 18 * pw; }
    function Y(mpa) { return pt + ph - mpa / yMax * ph; }
    function YT(t) { return pt + ph - (t - 0) / 80 * ph; }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 网格与坐标 */
    ctx.strokeStyle = '#efece1'; ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace'; ctx.lineWidth = 1;
    var gv;
    for (gv = 0; gv <= yMax + 0.01; gv += 0.4) {
      ctx.beginPath(); ctx.moveTo(pl, Y(gv)); ctx.lineTo(pl + pw, Y(gv)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(gv.toFixed(1), pl - 5, Y(gv) + 3);
    }
    for (gv = 0; gv <= 18; gv += 3) {
      ctx.beginPath(); ctx.moveTo(X(gv), pt); ctx.lineTo(X(gv), pt + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(gv + '', X(gv), pt + ph + 12);
    }
    /* 右轴温度 */
    ctx.fillStyle = '#41699b'; ctx.textAlign = 'left';
    [20, 40, 60, 80].forEach(function (t) { ctx.fillText(t + '℃', pl + pw + 5, YT(t) + 3); });

    /* 约束线 */
    function limit(mpa, col, lab) {
      if (mpa > yMax) return;
      ctx.strokeStyle = col; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(pl, Y(mpa)); ctx.lineTo(pl + pw, Y(mpa)); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = col; ctx.textAlign = 'right';
      ctx.fillText(lab, pl + pw - 3, Y(mpa) - 3);
    }
    limit(1.6, '#b05a51', '上限 1.6');
    limit(0.6, '#c9a15a', '最低进站 0.6');

    /* 沿程压力：泵出口 → 节流突降 → 线性摩阻 → 末站 */
    var pts = [];
    var pAfterValve = R.pOut - R.hValve * MPA_PER_M;
    pts.push({ km: 0, p: R.pOut });
    pts.push({ km: 0.4, p: pAfterValve });
    var i;
    for (i = 1; i <= 18; i++) {
      var p = pAfterValve - (pAfterValve - R.pEnd) * (i - 0.4) / 17.6;
      pts.push({ km: i, p: p });
    }
    ctx.strokeStyle = '#2f7d6b'; ctx.lineWidth = 2.2; ctx.beginPath();
    pts.forEach(function (o, k) {
      var x = X(o.km), y = Y(o.p);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    /* 节流损失竖向标注 */
    if (R.hValve > 2) {
      var xv = X(0.4);
      ctx.strokeStyle = '#8a9298'; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(xv, Y(R.pOut)); ctx.lineTo(xv, Y(pAfterValve)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#8a9298'; ctx.textAlign = 'left';
      ctx.fillText('节流 ' + R.hValve.toFixed(0) + ' m', xv + 4, (Y(R.pOut) + Y(pAfterValve)) / 2 + 3);
    }

    /* 温度曲线 */
    ctx.strokeStyle = '#41699b'; ctx.lineWidth = 1.6; ctx.beginPath();
    var aK = 2.0 * Math.PI * D_LINE / (RHO * (R.qact / 3600) * 2100) * 1000;
    for (i = 0; i <= 18; i++) {
      var t = T_SOIL + (S.temp - T_SOIL) * Math.exp(-aK * i);
      var x2 = X(i), y2 = YT(t);
      if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    /* 端点标注 */
    ctx.fillStyle = '#235f51'; ctx.textAlign = 'left';
    ctx.fillText(R.pOut.toFixed(2) + ' MPa', pl + 3, Y(R.pOut) - 4);
    ctx.textAlign = 'right';
    ctx.fillText(R.pEnd.toFixed(2) + ' MPa', pl + pw - 3, Y(R.pEnd) + 12);

    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.fillText('距联合站里程 (km)', pl + pw / 2, H - 4);
    ctx.save(); ctx.translate(10, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('压力 (MPa)', 0, 0); ctx.restore();

    profGeom = { pl: pl, pr: pr, pt: pt, pb: pb, pw: pw, ph: ph, yMax: yMax, pts: pts, tSoil: T_SOIL, aK: aK };
  }

  /* ================= ③b Beggs-Brill 流型图（canvas） ================= */
  var fmGeom = null;
  function drawFlowmap(R) {
    var W = 430, H = 246;
    var cv = $('flowmap'), ctx = setupCanvas(cv, W, H);
    var pl = 40, pr = 12, pt = 14, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var X0 = -3, X1 = 0, Y0 = -2, Y1 = 3;   // log10 范围
    function X(lam) { return pl + (Math.log(lam) / Math.LN10 - X0) / (X1 - X0) * pw; }
    function Y(fr) { return pt + ph - (Math.log(fr) / Math.LN10 - Y0) / (Y1 - Y0) * ph; }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 网格与刻度 */
    ctx.strokeStyle = '#efece1'; ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace'; ctx.lineWidth = 1;
    var e;
    for (e = X0; e <= X1; e++) {
      var x = pl + (e - X0) / (X1 - X0) * pw;
      ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(Math.pow(10, e) + '', x, pt + ph + 12);
    }
    for (e = Y0; e <= Y1; e++) {
      var y = pt + ph - (e - Y0) / (Y1 - Y0) * ph;
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + pw, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(Math.pow(10, e) + '', pl - 5, y + 3);
    }

    /* 边界曲线 L1–L4 */
    function boundary(fn, col) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.setLineDash([6, 3]);
      ctx.beginPath();
      var started = false;
      for (var i = 0; i <= 120; i++) {
        var lam = Math.pow(10, X0 + (X1 - X0) * i / 120);
        var fr = fn(lam);
        if (fr < Math.pow(10, Y0) || fr > Math.pow(10, Y1)) { started = false; continue; }
        var x = X(lam), y = Y(fr);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    boundary(function (l) { return 316 * Math.pow(l, 0.302); }, '#8a9298');
    boundary(function (l) { return 0.0009252 * Math.pow(l, -2.4684); }, '#8a9298');
    boundary(function (l) { return 0.1 * Math.pow(l, -1.4516); }, '#8a9298');
    boundary(function (l) { return 0.5 * Math.pow(l, -6.738); }, '#8a9298');

    /* 分区标注（位置按典型坐标，避开边界线） */
    function zone(lam, fr, cls) {
      ctx.fillStyle = FLOW_COLORS[cls]; ctx.globalAlpha = 0.75;
      ctx.textAlign = 'center'; ctx.font = '9.5px sans-serif';
      ctx.fillText(FLOW_NAMES[cls], X(lam), Y(fr));
      ctx.globalAlpha = 1; ctx.font = '8.5px Consolas, monospace';
    }
    zone(0.06, 0.04, 0);
    zone(0.07, 2.0, 1);
    zone(0.1, 30, 2);
    zone(0.4, 500, 3);

    /* 当前工况点 */
    var bp = R.bp;
    var cx = X(bp.lam), cy = Y(bp.fr);
    ctx.fillStyle = FLOW_COLORS[R.flow];
    ctx.strokeStyle = '#242b2e'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#242b2e'; ctx.textAlign = 'left'; ctx.font = '9px sans-serif';
    var labX = cx + 10, labY = cy - 8;
    if (labX > W - 118) { labX = cx - 118; }
    ctx.fillText('当前：' + FLOW_NAMES[R.flow], labX, labY);

    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.fillText('无滑脱持液率 λL（对数）', pl + pw / 2, H - 4);
    ctx.save(); ctx.translate(10, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('弗劳德数 Fr（对数）', 0, 0); ctx.restore();

    fmGeom = { pl: pl, pr: pr, pt: pt, pb: pb, pw: pw, ph: ph, X0: X0, X1: X1, Y0: Y0, Y1: Y1 };
  }

  function bindFlowmapTip() {
    var cv = $('flowmap'), tip = $('fm-tip'), box = $('fm-box');
    cv.addEventListener('mousemove', function (evt) {
      if (!fmGeom) return;
      var g = fmGeom;
      var r = cv.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (430 / r.width);
      var vy = (evt.clientY - r.top) * (246 / r.height);
      if (vx < g.pl || vx > g.pl + g.pw || vy < g.pt || vy > g.pt + g.ph) { tip.style.display = 'none'; return; }
      var lam = Math.pow(10, g.X0 + (vx - g.pl) / g.pw * (g.X1 - g.X0));
      var fr = Math.pow(10, g.Y0 + (1 - (vy - g.pt) / g.ph) * (g.Y1 - g.Y0));
      var cls = bbClass(lam, fr);
      var rb = box.getBoundingClientRect();
      tip.innerHTML = 'λL <b>' + lam.toFixed(3) + '</b> · Fr <b>' + fr.toFixed(2) + '</b><br>流型：<b style="color:' + FLOW_COLORS[cls] + '">' + FLOW_NAMES[cls] + '</b>';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 150) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= ④a 24h 负荷移峰（canvas） ================= */
  var dayGeom = null;
  function drawDay(R) {
    var W = 430, H = 222;
    var cv = $('day'), ctx = setupCanvas(cv, W, H);
    var pl = 40, pr = 12, pt = 14, pb = 28;
    var pw = W - pl - pr, ph = H - pt - pb;
    var pAvg = R.pPump + R.pAux;
    var base = [], opt = [], i, cut = 0;
    for (i = 0; i < 24; i++) {
      base.push(pAvg * (1 + 0.08 * Math.sin(2 * Math.PI * (i - 6) / 24)));
      if (priceOf(i) > 0.9) cut += base[i] * S.shift / 100;
    }
    var valleyN = 0;
    for (i = 0; i < 24; i++) if (priceOf(i) < 0.4) valleyN++;
    for (i = 0; i < 24; i++) {
      var L = base[i];
      if (priceOf(i) > 0.9) L -= base[i] * S.shift / 100;
      else if (priceOf(i) < 0.4) L += cut / valleyN;
      opt.push(L);
    }
    var yMax = Math.ceil(Math.max.apply(null, base.concat(opt)) / 200) * 200 + 100;

    function X(h) { return pl + (h + 0.5) / 24 * pw; }
    function Y(p) { return pt + ph - p / yMax * ph; }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9'; ctx.fillRect(0, 0, W, H);

    /* 分时电价背景带 */
    for (i = 0; i < 24; i++) {
      var pr2 = priceOf(i);
      ctx.fillStyle = pr2 > 0.9 ? '#f6e3df' : (pr2 < 0.4 ? '#e3efe9' : '#eef0e6');
      ctx.fillRect(pl + i / 24 * pw, pt, pw / 24, ph);
    }

    /* 网格与刻度 */
    ctx.strokeStyle = '#e2dccd'; ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace'; ctx.lineWidth = 1;
    for (i = 0; i <= 24; i += 4) {
      var x = pl + i / 24 * pw;
      ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pt + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(i + ':00', x, pt + ph + 12);
    }
    var step = Math.max(200, Math.round(yMax / 4 / 100) * 100);
    for (var v = 0; v <= yMax; v += step) {
      ctx.beginPath(); ctx.moveTo(pl, Y(v)); ctx.lineTo(pl + pw, Y(v)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(v + '', pl - 5, Y(v) + 3);
    }

    /* 负荷曲线 */
    function line(arr, col, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
      ctx.beginPath();
      arr.forEach(function (p, h) {
        var x = X(h), y = Y(p);
        if (h === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.setLineDash([]);
    }
    line(base, '#8a9298', [5, 3]);
    line(opt, '#2f7d6b');

    ctx.fillStyle = '#5d666d'; ctx.textAlign = 'center';
    ctx.fillText('时刻 (h)', pl + pw / 2, H - 4);
    ctx.save(); ctx.translate(10, pt + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('全站功率 (kW)', 0, 0); ctx.restore();

    dayGeom = { pl: pl, pr: pr, pt: pt, pb: pb, pw: pw, ph: ph, base: base, opt: opt, yMax: yMax };
  }

  function bindDayTip() {
    var cv = $('day'), tip = $('day-tip'), box = $('day-box');
    cv.addEventListener('mousemove', function (evt) {
      if (!dayGeom) return;
      var g = dayGeom;
      var r = cv.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (430 / r.width);
      var h = clamp(Math.floor((vx - g.pl) / g.pw * 24), 0, 23);
      var rb = box.getBoundingClientRect();
      tip.innerHTML = '<b>' + h + ':00–' + (h + 1) + ':00</b>（电价 ' + priceOf(h).toFixed(2) + ' 元）<br>人工 <b>' + g.base[h].toFixed(0) + '</b> kW · 当前 <b>' + g.opt[h].toFixed(0) + '</b> kW';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 170) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ================= ④b 优化前后对比（SVG） ================= */
  function drawCompare(R, B) {
    var svg = $('compare');
    var W = 430, H = 222, pl = 96, pr = 56, pt = 18, pb = 26;
    var pw = W - pl - pr;
    var rows = [
      { name: '电单耗 kWh/m³', base: B.cons, cur: R.cons, fmt: function (v) { return v.toFixed(3); }, max: 2.4 },
      { name: '日电费 万元', base: B.costDay, cur: R.costDay, fmt: function (v) { return v.toFixed(2); }, max: 2.6 },
      { name: '节流损失 %', base: B.throttle * 100, cur: R.throttle * 100, fmt: function (v) { return v.toFixed(1); }, max: 30 },
      { name: '燃料气费 万元', base: B.gasDay, cur: R.gasDay, fmt: function (v) { return v.toFixed(2); }, max: 3.2 }
    ];
    var s = '<rect width="' + W + '" height="' + H + '" fill="#fdfcf9" rx="6"/>';
    var rh = (H - pt - pb) / rows.length;
    rows.forEach(function (r, k) {
      var y0 = pt + rh * k;
      s += '<text x="' + (pl - 8) + '" y="' + (y0 + rh / 2 + 3) + '" font-size="9.5" fill="#4d565b" text-anchor="end">' + r.name + '</text>';
      var bw1 = clamp(r.base / r.max, 0, 1) * pw;
      var bw2 = clamp(r.cur / r.max, 0, 1) * pw;
      s += '<rect x="' + pl + '" y="' + (y0 + 8) + '" width="' + bw1.toFixed(1) + '" height="13" rx="3" fill="#8a9298" opacity="0.75"/>'
        + '<text x="' + (pl + bw1 + 5) + '" y="' + (y0 + 18.5) + '" font-size="8.5" fill="#79828a" font-family="monospace">' + r.fmt(r.base) + '</text>'
        + '<rect x="' + pl + '" y="' + (y0 + 25) + '" width="' + bw2.toFixed(1) + '" height="13" rx="3" fill="#2f7d6b" opacity="0.9"/>'
        + '<text x="' + (pl + bw2 + 5) + '" y="' + (y0 + 35.5) + '" font-size="8.5" fill="#235f51" font-family="monospace" font-weight="600">' + r.fmt(r.cur) + '</text>';
      var sav = r.base > 0 ? (r.base - r.cur) / r.base * 100 : 0;
      s += '<text x="' + (pl + pw + 4) + '" y="' + (y0 + 27) + '" font-size="9" fill="' + (sav >= 0 ? '#2f7d6b' : '#b05a51') + '" font-family="monospace" font-weight="600">' + (sav >= 0 ? '−' : '+') + Math.abs(sav).toFixed(1) + '%</text>';
    });
    s += '<text x="' + (pl + pw / 2) + '" y="' + (H - 6) + '" font-size="9" fill="#5d666d" text-anchor="middle">右端为相对人工基准的降幅（负值表示上升）</text>';
    svg.innerHTML = s;
  }

  /* ================= ⑤ 指标卡与诊断 ================= */
  function renderMetrics(R, B) {
    function set(id, html, cls) {
      var el = $(id);
      el.innerHTML = html;
      el.parentNode.className = 'mcard' + (cls ? ' ' + cls : '');
    }
    set('m-cons', R.cons.toFixed(3) + '<small> kWh/m³</small>', R.cons > B.cons ? 'bad' : (R.cons > 1.8 ? 'warn' : ''));
    set('m-day', (R.eDay / 10000).toFixed(2) + '<small> 万kWh</small>', '');
    set('m-cost', R.costDay.toFixed(2) + '<small> 万元</small>', R.costDay > B.costDay ? 'warn' : '');
    set('m-throttle', (R.throttle * 100).toFixed(1) + '<small> %</small>', R.throttle > 0.25 ? 'bad' : (R.throttle > 0.12 ? 'warn' : ''));
    set('m-press', R.pEnd.toFixed(2) + '<small> MPa</small>', R.pEnd < 0.6 ? 'bad' : '');
    set('m-flow', '<small style="font-size:11px;color:' + FLOW_COLORS[R.flow] + '">' + FLOW_NAMES[R.flow] + '</small>', R.flow === 2 ? 'warn' : '');
  }

  function renderVerdict(R, B) {
    var v = $('verdict');
    var dCons = (B.cons - R.cons) / B.cons * 100;
    var dCost = (B.costDay - R.costDay) / B.costDay * 100;
    var head = '电单耗较人工基准 <b>' + (dCons >= 0 ? '降 ' + dCons.toFixed(1) : '升 ' + (-dCons).toFixed(1)) + '%</b>，日电费 <b>' + (dCost >= 0 ? '省 ' + dCost.toFixed(1) : '增 ' + (-dCost).toFixed(1)) + '%</b>；';
    if (R.deficit > 0.02) {
      v.className = 'verdict bad';
      v.innerHTML = head + '欠输 <b>' + (R.deficit * 100).toFixed(1) + '%</b>：泵压头不足以克服摩阻与阀损（平衡流量 ' + R.qact.toFixed(0) + ' &lt; 计划 ' + R.plan.toFixed(0) + ' m³/h）。建议：增开外输泵、提高频率或开大节流阀。';
    } else if (R.pOut > 1.6) {
      v.className = 'verdict bad';
      v.innerHTML = head + '泵出口压力 <b>' + R.pOut.toFixed(2) + ' MPa</b> 超过外输上限 1.6 MPa，须降频或减开泵。';
    } else if (R.throttle > 0.15) {
      v.className = 'verdict warn';
      v.innerHTML = head + '节流损失 <b>' + (R.throttle * 100).toFixed(1) + '%</b> 偏高（多开泵 + 关节流的人工模式）：建议减开一台泵并把阀开到 90% 以上，用变频找工况点。';
    } else if (R.flow === 2 && S.ql < 15000) {
      v.className = 'verdict warn';
      v.innerHTML = head + '低输量下混输支线进入<b>段塞流</b>区（λL=' + R.bp.lam.toFixed(2) + '），注意段塞流捕集器液位冲击；其余指标正常。';
    } else {
      var gasNote = S.temp > 64 ? '注意：加热温度 ' + S.temp + '℃ 使燃料气费较人工基准上升 ' + ((R.gasDay / B.gasDay - 1) * 100).toFixed(0) + '%（升温降黏与燃料成本的权衡）。' : '';
      v.className = 'verdict ok';
      v.innerHTML = head + '压力合格率 100%（末站 ' + R.pEnd.toFixed(2) + ' MPa），节流损失 ' + (R.throttle * 100).toFixed(1) + '%，流型为' + FLOW_NAMES[R.flow] + '。' + gasNote + '点击「一键优化」可对照寻优方案。';
    }
  }

  /* ================= 渲染主流程 ================= */
  function render() {
    var R = model(S);
    var B = model(Object.assign({}, DEF, { ql: S.ql }));
    drawTopo(R);
    drawProfile(R);
    drawFlowmap(R);
    drawDay(R);
    drawCompare(R, B);
    renderMetrics(R, B);
    renderVerdict(R, B);
    $('r-pout').innerHTML = R.pOut.toFixed(2) + '<small> MPa</small>';
    $('r-pend').innerHTML = R.pEnd.toFixed(2) + '<small> MPa</small>';
    $('r-dp').innerHTML = (R.hf * MPA_PER_M).toFixed(2) + '<small> MPa</small>';
    $('r-qact').innerHTML = (R.qact * 24).toFixed(0) + '<small> / ' + (R.plan * 24).toFixed(0) + ' m³/d</small>';
  }

  /* ================= 参数绑定 ================= */
  var OUT = {
    ql: function (v) { return v + ' m³/d'; },
    pumps: function (v) { return v + ' 台'; },
    freq: function (v) { return v + ' Hz'; },
    valve: function (v) { return v + '%'; },
    temp: function (v) { return v + ' ℃'; },
    shift: function (v) { return v + '%'; }
  };
  var KEYS = ['ql', 'pumps', 'freq', 'valve', 'temp', 'shift'];

  function syncSliders() {
    KEYS.forEach(function (k) {
      $('s-' + k).value = S[k];
      $('o-' + k).textContent = OUT[k](S[k]);
    });
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
      syncSliders(); render();
    });
    $('btn-opt').addEventListener('click', function () {
      S = Object.assign({}, OPT, { ql: S.ql });
      syncSliders(); render();
    });
  }

  /* 页签切换 */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = this.getAttribute('data-tab');
        tabs.forEach(function (o) { o.classList.remove('active'); });
        this.classList.add('active');
        panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
        if (id === 'sim') render();   /* 切回时按实际宽度重建 canvas backing store */
      });
    });
  }

  bindTabs();
  bind();
  bindProfileTip();
  bindFlowmapTip();
  bindDayTip();
  syncSliders();
  render();

  /* 沿程曲线 tooltip（直接绑定原 canvas，每次取最新 model(S) 计算） */
  function bindProfileTip() {
    var cv = $('profile'), tip = $('prof-tip'), box = $('prof-box');
    cv.addEventListener('mousemove', function (evt) {
      if (!profGeom) return;
      var g = profGeom, RR = model(S);
      var r = cv.getBoundingClientRect();
      var vx = (evt.clientX - r.left) * (430 / r.width);
      var km = clamp((vx - g.pl) / g.pw * 18, 0, 18);
      var pAfterValve = RR.pOut - RR.hValve * MPA_PER_M;
      var p = km <= 0.4 ? RR.pOut - (RR.pOut - pAfterValve) * km / 0.4
        : pAfterValve - (pAfterValve - RR.pEnd) * (km - 0.4) / 17.6;
      var t = g.tSoil + (S.temp - g.tSoil) * Math.exp(-g.aK * km);
      var rb = box.getBoundingClientRect();
      tip.innerHTML = '<b>' + km.toFixed(1) + ' km</b><br>压力 <b>' + p.toFixed(2) + '</b> MPa<br>温度 <b>' + t.toFixed(1) + '</b> ℃';
      tip.style.display = 'block';
      tip.style.left = clamp(evt.clientX - rb.left + 12, 4, rb.width - 130) + 'px';
      tip.style.top = clamp(evt.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });
})();
