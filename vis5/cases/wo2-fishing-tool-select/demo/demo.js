/* ======= 落物打捞工具智能选型 · 可运行示范 =======
   规则口径：SY/T 5572-2012 工具分类、SY/T 5587.12-2018 解卡打捞流程、
   SY/T 5827-2005 震击器管柱组合、API RP 7G 抗拉 80% 安全线 */
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

  /* ---------- 领域数据 ---------- */
  var FISH = {
    tubing: { name: '油管',       lenD: 9,   odD: 73, wPer: 0.74, stuckBase: 20 },
    rod:    { name: '抽油杆',     lenD: 8,   odD: 25, wPer: 0.38, stuckBase: 18 },
    cable:  { name: '电缆/钢丝',  lenD: 6,   odD: 12, wPer: 0.06, stuckBase: 15 },
    junk:   { name: '小件落物',   lenD: 0.4, odD: 40, wPer: 0.30, stuckBase: 10 },
    stuck:  { name: '卡钻管柱',   lenD: 9,   odD: 89, wPer: 1.60, stuckBase: 70 }
  };
  var TOP_NAMES = { ok: '完好', deformed: '变形', broken: '碎裂' };
  var STRINGS = {
    tubing: { name: 'Φ73×5.51 N80 油管', w: 9.67, yld: 490 },
    dp:     { name: 'Φ88.9 G105 钻杆',   w: 19.8, yld: 1560 }
  };
  var BUOY = 0.872; /* 修井液浮力系数 */

  /* 工具库（46 种中取常用 8 种）；base = 对 5 类落物的基准命中分 */
  var TOOLS = [
    { id: 'overshot', name: '可退式卡瓦打捞筒', od: 114, cMin: 38, cMax: 95, extra: 10, needLen: 1.2,
      base: { tubing: 90, rod: 78, cable: 12, junk: 30, stuck: 76 },
      desc: '外抓：卡瓦咬合落物外壁；内径须 ≥ 落物外径 + 10 mm' },
    { id: 'spear', name: '滑块打捞矛', od: 95, cMin: 48, cMax: 108, extra: 0, needLen: 1.2,
      base: { tubing: 84, rod: 55, cable: 6, junk: 10, stuck: 70 },
      desc: '内捞：滑块卡瓦锚定落物内腔，落物须有通畅内孔' },
    { id: 'boxtap', name: '母锥', od: 118, cMin: 38, cMax: 100, extra: 8, needLen: 0.8,
      base: { tubing: 80, rod: 70, cable: 4, junk: 8, stuck: 62 },
      desc: '造扣外捞：锥面螺纹在落物外壁造扣，适应变形鱼顶' },
    { id: 'taper', name: '公锥', od: 96, cMin: 42, cMax: 104, extra: 0, needLen: 0.8,
      base: { tubing: 78, rod: 62, cable: 4, junk: 8, stuck: 66 },
      desc: '造扣内捞：在落物内孔造扣，管类落物变形鱼顶适用' },
    { id: 'magnet', name: '强磁打捞器', od: 100, cMin: 15, cMax: 80, extra: 0, needLen: 0,
      base: { tubing: 8, rod: 15, cable: 32, junk: 85, stuck: 4 },
      desc: '磁吸：吸附铁磁性碎屑与小件，对大长管柱无效' },
    { id: 'grab', name: '一把抓', od: 108, cMin: 20, cMax: 95, extra: 0, needLen: 0,
      base: { tubing: 10, rod: 22, cable: 46, junk: 74, stuck: 5 },
      desc: '抓齿合拢：小件与散碎落物一把抓捞出' },
    { id: 'basket', name: '反循环打捞篮', od: 112, cMin: 25, cMax: 90, extra: 0, needLen: 0,
      base: { tubing: 6, rod: 12, cable: 34, junk: 66, stuck: 4 },
      desc: '反循环冲洗携带，碎屑收入篮内' },
    { id: 'jar', name: '震击器+加速器组合', od: 108, cMin: 0, cMax: 110, extra: 0, needLen: 0,
      base: { tubing: 18, rod: 12, cable: 8, junk: 6, stuck: 86 },
      desc: '解卡专用：与安全接头、打捞工具组配，震击解卡' }
  ];

  var DEF = { type: 'tubing', top: 'ok', depth: 2200, casing: 124, dev: 25, len: 9, od: 73, string: 'tubing' };
  var S = Object.assign({}, DEF);

  /* ---------- 选型评分 ---------- */
  function evalTools() {
    var ft = S.type, list = [];
    TOOLS.forEach(function (t) {
      var score = t.base[ft];
      var why = [], fail = null;

      /* 规则：工具外径与套管间隙 ≥ 8 mm */
      var gap = S.casing - t.od;
      if (gap < 8) {
        fail = '间隙 ' + gap.toFixed(0) + ' mm < 8 mm';
        why.push('工具外径 Φ' + t.od + ' 与套管内径 Φ' + S.casing + ' 间隙不足，遇阻风险高（硬规则淘汰）');
      }
      /* 规则：打捞筒类内径 ≥ 落物外径 + 10 mm */
      var need = S.od + t.extra;
      if (need > t.cMax || S.od < t.cMin) {
        score -= 55;
        why.push('落物外径 Φ' + S.od + ' 超出适用区间 Φ' + t.cMin + '–Φ' + (t.cMax - t.extra) + ' mm');
      }
      /* 鱼顶状态 */
      if (S.top === 'deformed') {
        if (t.id === 'overshot' || t.id === 'spear') { score -= 20; why.push('变形鱼顶抓捞困难，宜造扣'); }
        if (t.id === 'boxtap' || t.id === 'taper') { score += 10; why.push('造扣工具适应变形鱼顶'); }
        if (t.id === 'magnet') { score -= 8; }
      } else if (S.top === 'broken') {
        if (t.id === 'overshot' || t.id === 'spear') { score -= 32; why.push('碎裂鱼顶无法抓捞'); }
        if (t.id === 'boxtap' || t.id === 'taper') { score -= 24; why.push('碎裂断口造扣困难'); }
        if (t.id === 'magnet' || t.id === 'grab' || t.id === 'basket') { score += 10; why.push('碎裂落物宜磁吸 / 抓捞'); }
      }
      /* 可抓长度 */
      if (t.needLen > 0 && S.len < t.needLen) {
        score -= 22;
        why.push('可抓长度 ' + S.len.toFixed(1) + ' m < ' + t.needLen + ' m，锚定不足');
      }
      /* 井斜 */
      if (S.dev > 45) {
        if (t.id === 'jar') { score += 8; why.push('大井斜解卡须震击器 + 加速器'); }
        else { score -= 16; why.push('井斜 >45°，下入摩阻大，需加长引鞋与加重'); }
      } else if (S.dev > 30 && t.id !== 'jar') {
        score -= 6;
      }
      /* 卡钻管柱：非震击类大幅降分，震击组合为首选 */
      if (ft === 'stuck' && t.id !== 'jar') {
        score -= 25;
        why.push('管柱被卡，须先震击解卡再打捞');
      }
      score = clamp(Math.round(score), 0, 98);
      list.push({ tool: t, score: score, fail: fail, why: why, gap: gap });
    });
    list.sort(function (a, b) {
      if ((a.fail ? 1 : 0) !== (b.fail ? 1 : 0)) return a.fail ? 1 : -1;
      return b.score - a.score;
    });
    return list;
  }

  /* ---------- 载荷校核 ---------- */
  function loadModel() {
    var st = STRINGS[S.string];
    var ft = FISH[S.type];
    var devRad = S.dev * Math.PI / 180;
    var stringW = st.w * 9.8 * BUOY * S.depth / 1000 * (1 + 0.35 * Math.sin(devRad)); /* kN */
    var fishW = S.len * ft.wPer * 9.8;                                              /* kN */
    var staticLoad = stringW + fishW;
    var overpull = ft.stuckBase + S.dev * (S.type === 'stuck' ? 1.2 : 0.5);         /* kN */
    if (S.top === 'broken') overpull += 15;
    var jarMult = S.dev > 45 ? 1.6 : 2.2;                                            /* 加速器放大，大井斜衰减 */
    var jarPeak = staticLoad + overpull * jarMult;
    var limit = 0.8 * st.yld;
    var pullLoad = staticLoad + overpull;
    var status, note;
    if (pullLoad <= limit) { status = 'ok'; note = '常规上提即可解卡'; }
    else if (jarPeak <= limit) { status = 'ok'; note = '需震击器辅助解卡，冲击载荷仍在安全线内'; }
    else if (pullLoad <= st.yld) { status = 'warn'; note = '超过 80% 安全线，须控制过提吨位并密切观察指重表'; }
    else { status = 'bad'; note = '超过抗拉屈服，禁止硬拔，改用倒扣 / 震击或换高强度管柱'; }
    return {
      stringW: stringW, fishW: fishW, staticLoad: staticLoad, overpull: overpull,
      jarMult: jarMult, jarPeak: jarPeak, pullLoad: pullLoad, yld: st.yld, limit: limit,
      status: status, note: note
    };
  }

  /* ---------- 成功率与费用 ---------- */
  function outcome(ranked) {
    var top = ranked[0];
    var p = clamp(top.score * 0.0088, 0.02, 0.90);
    if (top.fail) p = Math.min(p, 0.22); /* 硬规则淘汰：成功率大幅下调，须改小工具或先修套 */
    var trips = 1 / p;
    var cost = 3.2 + S.depth / 1000 * 1.1; /* 单趟 3—8 万元口径 */
    return { top: top, p: p, trips: trips, cost: cost };
  }

  /* ================= 面板 ① 井筒示意 ================= */
  var wellHot = []; /* 悬停热区 */
  function drawWell(ranked) {
    var W = 430, H = 330;
    var cv = $('well'), ctx = setupCanvas(cv, W, H);
    wellHot = [];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    var surfY = 46, botY = 300;
    var kinkY = surfY + (botY - surfY) * 0.45;          /* 造斜点 */
    var cx0 = 108;                                       /* 井口 x */
    var tilt = Math.tan(S.dev * Math.PI / 180) * (botY - kinkY);
    var maxTilt = 120;
    if (Math.abs(tilt) > maxTilt) tilt = maxTilt * (tilt < 0 ? -1 : 1);
    var cx1 = cx0 + tilt;                                /* 井底 x */
    var casHalf = clamp(S.casing / 6.2, 16, 26);         /* 套管半宽（视觉比例） */

    function wellX(y) {
      if (y <= kinkY) return cx0;
      return cx0 + (y - kinkY) / (botY - kinkY) * tilt;
    }

    /* 地层底色 */
    ctx.fillStyle = 'rgba(239,236,225,.5)';
    ctx.fillRect(0, surfY, W, botY - surfY);

    /* 套管（两壁） */
    ctx.strokeStyle = '#79828a';
    ctx.lineWidth = 2;
    [[-1, 'l'], [1, 'r']].forEach(function (side) {
      ctx.beginPath();
      ctx.moveTo(wellX(surfY) + side[0] * casHalf, surfY);
      ctx.lineTo(wellX(kinkY) + side[0] * casHalf, kinkY);
      ctx.lineTo(wellX(botY) + side[0] * casHalf, botY);
      ctx.stroke();
    });
    /* 套管接箍短线 */
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(121,130,138,.45)';
    for (var yy = surfY + 34; yy < botY - 10; yy += 34) {
      var wx = wellX(yy);
      ctx.beginPath();
      ctx.moveTo(wx - casHalf - 3, yy); ctx.lineTo(wx - casHalf, yy);
      ctx.moveTo(wx + casHalf, yy); ctx.lineTo(wx + casHalf + 3, yy);
      ctx.stroke();
    }
    ctx.fillStyle = '#5d666d';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('套管内径 Φ' + S.casing + ' mm', cx0 - casHalf - 2, surfY - 6);

    /* 井口 */
    ctx.fillStyle = '#79828a';
    ctx.fillRect(cx0 - casHalf - 8, surfY - 3, casHalf * 2 + 16, 4);
    ctx.fillStyle = '#5d666d';
    ctx.textAlign = 'center';
    ctx.fillText('井口', cx0, surfY - 6 - 9);

    /* 深度标尺 */
    ctx.strokeStyle = '#d8d0bc';
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace';
    ctx.textAlign = 'right';
    [0, 0.5, 1].forEach(function (f) {
      var y = surfY + (botY - surfY) * f;
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(26, y); ctx.stroke();
      ctx.fillText(Math.round(S.depth * f) + ' m', 18, y + 3);
    });
    ctx.save();
    ctx.translate(9, (surfY + botY) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#79828a';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('井深', 0, 0);
    ctx.restore();

    /* 井斜标注 */
    if (S.dev > 2) {
      ctx.strokeStyle = '#c9a15a';
      ctx.fillStyle = '#c9a15a';
      ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(cx0, kinkY); ctx.lineTo(cx0, botY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      var arcX = cx0, arcY = kinkY;
      ctx.beginPath();
      ctx.arc(arcX, arcY, 26, Math.PI / 2, Math.PI / 2 + Math.atan2(tilt, botY - kinkY));
      ctx.stroke();
      ctx.fillText('井斜 ' + S.dev + '°' + (S.dev > 45 ? '（大井斜）' : ''), Math.max(arcX, cx1) + casHalf + 8, kinkY + 24);
    }

    /* 鱼顶位置（井底附近按比例） */
    var fishTopY = botY - 30;
    var fx = wellX(fishTopY);
    var fishWpx = clamp(S.od / 4.5, 5, casHalf - 3);
    var fishHpx = clamp(S.len * 2.6, 6, 26);

    /* 落物 */
    ctx.fillStyle = '#b05a51';
    if (S.type === 'junk' || S.top === 'broken') {
      /* 碎裂：锯齿块 */
      ctx.beginPath();
      ctx.moveTo(fx - fishWpx, fishTopY);
      ctx.lineTo(fx - fishWpx * 0.4, fishTopY + 3);
      ctx.lineTo(fx, fishTopY - 1);
      ctx.lineTo(fx + fishWpx * 0.5, fishTopY + 2.5);
      ctx.lineTo(fx + fishWpx, fishTopY);
      ctx.lineTo(fx + fishWpx * 0.8, fishTopY + fishHpx);
      ctx.lineTo(fx - fishWpx * 0.7, fishTopY + fishHpx);
      ctx.closePath(); ctx.fill();
    } else if (S.type === 'cable') {
      /* 电缆：缠绕线团 */
      ctx.strokeStyle = '#b05a51';
      ctx.lineWidth = 1.6;
      for (var ci = 0; ci < 3; ci++) {
        ctx.beginPath();
        ctx.arc(fx, fishTopY + 5 + ci * 3.5, fishWpx - ci, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillRect(fx - fishWpx, fishTopY, fishWpx * 2, fishHpx);
      if (S.top === 'deformed') {
        /* 变形：顶部压扁斜口 */
        ctx.beginPath();
        ctx.moveTo(fx - fishWpx, fishTopY);
        ctx.lineTo(fx + fishWpx, fishTopY - 3);
        ctx.lineTo(fx + fishWpx, fishTopY + 3);
        ctx.lineTo(fx - fishWpx, fishTopY + 3);
        ctx.closePath(); ctx.fill();
      }
    }
    wellHot.push({ x: fx - fishWpx - 4, y: fishTopY - 4, w: fishWpx * 2 + 8, h: fishHpx + 8,
      html: '<b>落物：' + FISH[S.type].name + '</b><br>鱼顶深度 <b>' + S.depth + ' m</b> · 外径 Φ' + S.od + ' mm · 长度 ' + S.len.toFixed(1) + ' m<br>鱼顶状态：' + TOP_NAMES[S.top] });

    /* 鱼顶标注线 */
    ctx.strokeStyle = '#b05a51';
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(fx + fishWpx + 2, fishTopY); ctx.lineTo(388, fishTopY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51';
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('鱼顶 ' + S.depth + ' m · ' + FISH[S.type].name + ' Φ' + S.od, 264, fishTopY - 4);

    /* 打捞管柱 */
    var top1 = ranked[0];
    var toolY = fishTopY - 26;
    var tx = wellX(toolY);
    ctx.strokeStyle = '#2f7d6b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wellX(surfY), surfY);
    ctx.lineTo(wellX(kinkY), kinkY);
    ctx.lineTo(wellX(toolY), toolY);
    ctx.stroke();
    wellHot.push({ x: Math.min(cx0, wellX(toolY)) - 6, y: surfY, w: Math.abs(wellX(toolY) - cx0) + 12, h: toolY - surfY - 20,
      html: '<b>打捞管柱：' + STRINGS[S.string].name + '</b><br>悬重 <b>' + loadModel().stringW.toFixed(0) + ' kN</b>（含摩阻，井斜 ' + S.dev + '°）' });

    /* 工具符号 */
    var toolW = clamp(top1.tool.od / 4.5, 8, casHalf - 4);
    ctx.fillStyle = '#2f7d6b';
    ctx.strokeStyle = '#2f7d6b';
    if (top1.tool.id === 'overshot' || top1.tool.id === 'basket') {
      /* 钟形罩 */
      ctx.beginPath();
      ctx.moveTo(tx - 3, toolY - 12);
      ctx.lineTo(tx - toolW, toolY + 8);
      ctx.lineTo(tx + toolW, toolY + 8);
      ctx.lineTo(tx + 3, toolY - 12);
      ctx.closePath(); ctx.fill();
    } else if (top1.tool.id === 'spear' || top1.tool.id === 'taper') {
      /* 锥矛 */
      ctx.beginPath();
      ctx.moveTo(tx, toolY + 10);
      ctx.lineTo(tx - toolW * 0.7, toolY - 12);
      ctx.lineTo(tx + toolW * 0.7, toolY - 12);
      ctx.closePath(); ctx.fill();
    } else if (top1.tool.id === 'boxtap') {
      /* 母锥 */
      ctx.beginPath();
      ctx.moveTo(tx - toolW, toolY + 8);
      ctx.lineTo(tx - 4, toolY - 12);
      ctx.lineTo(tx + 4, toolY - 12);
      ctx.lineTo(tx + toolW, toolY + 8);
      ctx.closePath(); ctx.fill();
    } else if (top1.tool.id === 'magnet') {
      ctx.fillRect(tx - toolW, toolY - 12, toolW * 2, 14);
      ctx.fillStyle = '#fdfcf9';
      ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('N', tx - toolW / 2, toolY - 2);
      ctx.fillText('S', tx + toolW / 2, toolY - 2);
    } else if (top1.tool.id === 'grab') {
      ctx.fillRect(tx - 4, toolY - 12, 8, 8);
      ctx.lineWidth = 2;
      for (var gi = -1; gi <= 1; gi++) {
        ctx.beginPath();
        ctx.moveTo(tx + gi * 4, toolY - 4);
        ctx.quadraticCurveTo(tx + gi * toolW, toolY + 4, tx + gi * toolW * 0.6, toolY + 9);
        ctx.stroke();
      }
    } else { /* jar */
      ctx.fillRect(tx - 4, toolY - 16, 8, 18);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx - 7, toolY - 8); ctx.lineTo(tx + 7, toolY - 4);
      ctx.moveTo(tx - 7, toolY - 2); ctx.lineTo(tx + 7, toolY + 2);
      ctx.stroke();
    }
    wellHot.push({ x: tx - toolW - 4, y: toolY - 18, w: toolW * 2 + 8, h: 32,
      html: '<b>首选：' + top1.tool.name + '</b><br>外径 Φ' + top1.tool.od + ' mm · 评分 <b>' + top1.score + '</b><br>' + top1.tool.desc });

    /* 工具名称标注 */
    ctx.fillStyle = '#2f7d6b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('首选：' + top1.tool.name + '（Φ' + top1.tool.od + '）', Math.max(tx, cx1) + casHalf + 8, toolY - 6);

    /* 间隙标注 */
    var gap = S.casing - top1.tool.od;
    var gapOk = gap >= 8;
    ctx.fillStyle = gapOk ? '#2f7d6b' : '#b05a51';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('间隙 ' + gap.toFixed(0) + ' mm' + (gapOk ? ' ≥8 ✓' : ' <8 ✗'), Math.max(tx, cx1) + casHalf + 8, toolY + 6);

    /* 大井斜警示 */
    if (S.dev > 45) {
      ctx.fillStyle = 'rgba(176,90,81,.08)';
      ctx.fillRect(0, kinkY, W, botY - kinkY);
      ctx.fillStyle = '#b05a51';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('井斜 >45°：工具需加长引鞋，震击效率下降', W / 2, botY - 8);
    }
    wellHot.push({ x: cx0 - casHalf - 6, y: surfY - 6, w: casHalf * 2 + 12, h: 12,
      html: '<b>套管</b><br>内径 Φ' + S.casing + ' mm；规则：工具外径间隙 ≥ 8 mm（SY/T 5572 通用技术条件）' });
  }

  /* ================= 面板 ③ 载荷校核 ================= */
  var loadGeom = null;
  function drawLoad(lm) {
    var W = 430, H = 250;
    var cv = $('load'), ctx = setupCanvas(cv, W, H);
    var pl = 46, pr = 14, pt = 16, pb = 30;
    var pw = W - pl - pr, ph = H - pt - pb;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    var xMax = Math.max(lm.overpull * 1.7, 80);
    var yMax = Math.max(lm.jarPeak, lm.yld) * 1.12;
    function X(v) { return pl + v / xMax * pw; }
    function Y(v) { return pt + ph - v / yMax * ph; }
    loadGeom = { X: X, Y: Y, xMax: xMax, pl: pl, pw: pw, pt: pt, ph: ph, lm: lm };

    /* 网格 */
    ctx.strokeStyle = '#efece1';
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace';
    ctx.lineWidth = 1;
    var yStep = yMax > 1000 ? 500 : (yMax > 400 ? 100 : 50);
    for (var gy = 0; gy <= yMax; gy += yStep) {
      ctx.beginPath(); ctx.moveTo(pl, Y(gy)); ctx.lineTo(pl + pw, Y(gy)); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(gy + '', pl - 5, Y(gy) + 3);
    }
    var xStep = xMax > 200 ? 50 : 20;
    for (var gx = 0; gx <= xMax; gx += xStep) {
      ctx.beginPath(); ctx.moveTo(X(gx), pt); ctx.lineTo(X(gx), pt + ph); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(gx + '', X(gx), pt + ph + 12);
    }

    /* 80% 安全线 + 屈服线 */
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#b05a51';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(pl, Y(lm.limit)); ctx.lineTo(pl + pw, Y(lm.limit)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b05a51';
    ctx.textAlign = 'right';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('80% 安全线 ' + lm.limit.toFixed(0) + ' kN', pl + pw - 4, Y(lm.limit) - 4);
    ctx.strokeStyle = '#79828a';
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(pl, Y(lm.yld)); ctx.lineTo(pl + pw, Y(lm.yld)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#79828a';
    ctx.fillText('抗拉屈服 ' + lm.yld + ' kN', pl + pw - 4, Y(lm.yld) - 4);

    /* 超限红区 */
    ctx.fillStyle = 'rgba(176,90,81,.06)';
    ctx.fillRect(pl, pt, pw, Y(lm.limit) - pt);

    /* 大钩载荷曲线（绿）与震击冲击（金） */
    ctx.strokeStyle = '#2f7d6b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(lm.staticLoad));
    ctx.lineTo(X(xMax), Y(lm.staticLoad + xMax));
    ctx.stroke();
    ctx.strokeStyle = '#c9a15a';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(lm.staticLoad));
    ctx.lineTo(X(Math.min(xMax, (yMax - lm.staticLoad) / lm.jarMult)), Y(Math.min(yMax, lm.staticLoad + xMax * lm.jarMult)));
    ctx.stroke();
    ctx.setLineDash([]);

    /* 静悬重点 */
    ctx.fillStyle = '#2f7d6b';
    ctx.beginPath(); ctx.arc(X(0), Y(lm.staticLoad), 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('静悬重+落物 ' + lm.staticLoad.toFixed(0) + ' kN', X(0) + 7, Y(lm.staticLoad) + 15);

    /* 所需过提点与震击峰值点：标注强制最小垂直间距，避免互压 */
    var px = X(lm.overpull), py = Y(lm.pullLoad);
    var jx = px, jy = Y(Math.min(lm.jarPeak, yMax));
    var nearRight = lm.overpull > xMax * 0.6;
    var lbls = [
      { y: py, txt: '所需过提 ' + lm.overpull.toFixed(0) + ' kN → ' + lm.pullLoad.toFixed(0) + ' kN', color: '#41699b' },
      { y: jy, txt: '震击峰值 ' + lm.jarPeak.toFixed(0) + ' kN', color: '#c9a15a' }
    ];
    lbls.sort(function (a, b) { return a.y - b.y; });
    if (lbls[1].y - lbls[0].y < 14) {
      var mid = (lbls[0].y + lbls[1].y) / 2;
      lbls[0].y = mid - 7; lbls[1].y = mid + 7;
    }
    ctx.fillStyle = '#41699b';
    ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#41699b';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(px, pt + ph); ctx.lineTo(px, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#c9a15a';
    ctx.beginPath(); ctx.arc(jx, jy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = nearRight ? 'right' : 'left';
    var lx = px + (nearRight ? -8 : 8);
    lbls.forEach(function (lb) {
      ctx.fillStyle = lb.color;
      ctx.fillText(lb.txt, lx, lb.y + 3);
    });

    /* 轴标签 */
    ctx.fillStyle = '#5d666d';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('附加过提力 (kN)', pl + pw / 2, H - 4);
    ctx.save();
    ctx.translate(11, pt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('大钩载荷 (kN)', 0, 0);
    ctx.restore();
  }

  /* ================= 面板 ④ 工具评分 ================= */
  var scoreGeom = null;
  function drawScore(ranked) {
    var W = 430, H = 220;
    var cv = $('score'), ctx = setupCanvas(cv, W, H);
    var pl = 108, pr = 40, pt = 12, pb = 22;
    var pw = W - pl - pr;
    var show = ranked.slice(0, 6);
    var rowH = (H - pt - pb) / show.length;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);
    scoreGeom = { pl: pl, pw: pw, pt: pt, rowH: rowH, show: show };

    /* 网格 */
    ctx.strokeStyle = '#efece1';
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '8.5px Consolas, monospace';
    ctx.lineWidth = 1;
    for (var v = 0; v <= 100; v += 20) {
      var x = pl + v / 100 * pw;
      ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, H - pb); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(v + '', x, H - pb + 12);
    }

    show.forEach(function (r, i) {
      var yTop = pt + rowH * i + rowH * 0.18;
      var bh = rowH * 0.64;
      var bw = Math.max(2, r.score / 100 * pw);
      var color = '#79828a';
      if (!r.fail) {
        if (i === 0) color = '#2f7d6b';
        else if (i === 1 || i === 2) color = '#c9a15a';
      } else color = '#b05a51';
      if (r.fail) {
        /* 斜线底 + 细实条 */
        ctx.save();
        ctx.beginPath(); ctx.rect(pl, yTop, pw, bh); ctx.clip();
        ctx.strokeStyle = 'rgba(176,90,81,.35)';
        ctx.lineWidth = 1;
        for (var hx = -rowH; hx < pw + rowH; hx += 6) {
          ctx.beginPath(); ctx.moveTo(pl + hx, yTop + bh); ctx.lineTo(pl + hx + bh, yTop); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#b05a51';
        ctx.fillRect(pl, yTop, 3, bh);
      } else {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.88;
        roundRect(ctx, pl, yTop, bw, bh, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#3d464b';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(r.tool.name, pl - 6, yTop + bh / 2 + 3);
      ctx.font = '9px Consolas, monospace';
      if (r.fail) {
        ctx.fillStyle = '#b05a51';
        ctx.textAlign = 'left';
        ctx.fillText('✗ ' + r.fail, pl + 8, yTop + bh / 2 + 3);
      } else {
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        var tag = i === 0 ? ' ← 首选' : (i <= 2 ? ' ← 备选' + i : '');
        ctx.fillText(r.score + ' 分' + tag, pl + bw + 5, yTop + bh / 2 + 3);
      }
    });

    ctx.fillStyle = '#5d666d';
    ctx.font = '8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('知识图谱规则评分（0–100）', pl + pw / 2, H - 4);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ================= 指标卡 / 结论 / 流程 ================= */
  function renderOutcome(ranked, oc, lm) {
    var top = oc.top;
    var combo = top.tool.name;
    if (S.type === 'stuck' && top.tool.id !== 'jar') combo = '震击器 + ' + top.tool.name;
    else if (top.tool.id === 'jar') combo = top.tool.name + ' + 安全接头';

    $('m-tool').innerHTML = '<small>' + combo + '</small>';
    $('m-prob').innerHTML = (oc.p * 100).toFixed(0) + '<small> %</small>';
    $('m-prob').parentNode.className = 'mcard' + (oc.p < 0.5 ? ' bad' : (oc.p < 0.7 ? ' warn' : ''));
    $('m-trips').innerHTML = oc.trips.toFixed(1) + '<small> 趟</small>';
    $('m-cost').innerHTML = oc.cost.toFixed(1) + '<small> 万元</small>';

    var gap = S.casing - top.tool.od;
    $('m-gap').innerHTML = gap.toFixed(0) + '<small> mm</small>' + (gap >= 8 ? '<small> ✓</small>' : '<small> ✗</small>');
    $('m-gap').parentNode.className = 'mcard' + (gap >= 8 ? '' : ' bad');

    $('m-load').innerHTML = lm.pullLoad.toFixed(0) + '<small> /' + lm.limit.toFixed(0) + ' kN</small>';
    $('m-load').parentNode.className = 'mcard' + (lm.status === 'bad' ? ' bad' : (lm.status === 'warn' ? ' warn' : ''));

    /* 结论 */
    var v = $('verdict');
    var alts = ranked.filter(function (r, i) { return i > 0 && !r.fail; }).slice(0, 2);
    var altTxt = alts.map(function (r) { return r.tool.name + '（' + r.score + ' 分）'; }).join('、') || '无（其余均被规则淘汰）';
    var reasons = top.why.length ? '关键因素：' + top.why.join('；') + '。' : '';
    var head = '落物 <b>' + FISH[S.type].name + '</b>（Φ' + S.od + ' mm × ' + S.len.toFixed(1) + ' m，鱼顶' + TOP_NAMES[S.top] + '），' +
      '首选 <b>' + combo + '</b>（评分 <b>' + top.score + '</b>，预测一次成功率 <b>' + (oc.p * 100).toFixed(0) + '%</b>）；备选：' + altTxt + '。';
    var risk = [];
    if (gap < 8) risk.push('间隙不足 8 mm，首选工具遇阻风险高，建议改小一级工具或先修套');
    if (S.dev > 45) risk.push('井斜 >45°，启用加长引鞋与加重杆，造扣类工具成功率下调');
    if (lm.status !== 'ok') risk.push(lm.note);
    if (oc.p < 0.6 || S.top === 'broken') risk.push('落物形态存疑：必须先下铅印或井下电视确认鱼顶，再组配工具');
    var riskTxt = risk.length ? '风险提示：' + risk.join('；') + '。' : '';
    v.className = 'verdict' + (top.fail || lm.status === 'bad' ? ' bad' : (risk.length ? ' warn' : ' ok'));
    v.innerHTML = head + reasons + riskTxt;

    /* 流程 */
    var needConfirm = S.top === 'broken' || oc.p < 0.6;
    var steps = [];
    steps.push({ t: '资料核实', d: '井史 + 落物描述结构化，补齐尺寸', extra: false });
    if (needConfirm) steps.push({ t: '下铅印 / 井下电视', d: '确认鱼顶形态与尺寸（存疑强制）', extra: true });
    steps.push({ t: '工具组配', d: '首选 + 2 备选一次带齐，含安全接头', extra: false });
    steps.push({ t: '下探鱼顶', d: '管柱下至鱼顶上方 1—2 m，循环冲洗', extra: false });
    steps.push({ t: '造扣 / 抓捞', d: top.tool.id === 'magnet' || top.tool.id === 'grab' ? '下放抓捞，试提确认载荷增加' : '加压造扣或下放抓捞，试提确认', extra: false });
    steps.push({ t: '试提 / 震击解卡', d: S.type === 'stuck' || lm.status !== 'ok' ? '震击器解卡，控制吨位 ≤80% 安全线' : '匀速上提，观察指重表', extra: false });
    steps.push({ t: '起出回写', d: '起出落物，结果与失败原因回写图谱', extra: false });
    var html = '';
    steps.forEach(function (st, i) {
      html += '<div class="step' + (st.extra ? ' extra' : '') + '">' +
        '<span class="s-no">' + (i + 1) + '</span>' +
        '<span class="s-t">' + st.t + '</span>' +
        '<span class="s-d">' + st.d + '</span></div>';
    });
    $('steps').innerHTML = html;
  }

  /* ================= 渲染主流程 ================= */
  function render() {
    var ranked = evalTools();
    var oc = outcome(ranked);
    var lm = loadModel();
    drawWell(ranked);
    drawLoad(lm);
    drawScore(ranked);
    renderOutcome(ranked, oc, lm);
  }

  /* ---------- 悬停 tooltip ---------- */
  function bindTip(boxId, tipId, hitFn) {
    var box = $(boxId), tip = $(tipId);
    var cv = box.querySelector('canvas');
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      var lw = parseFloat(cv.getAttribute('width'));
      var lh = parseFloat(cv.getAttribute('height'));
      var x = (e.clientX - r.left) * (lw / r.width);
      var y = (e.clientY - r.top) * (lh / r.height);
      var html = hitFn(x, y);
      if (html) {
        var rb = box.getBoundingClientRect();
        tip.innerHTML = html;
        tip.style.display = 'block';
        tip.style.left = clamp(e.clientX - rb.left + 12, 4, rb.width - 200) + 'px';
        tip.style.top = clamp(e.clientY - rb.top - 8, 4, rb.height - 80) + 'px';
      } else {
        tip.style.display = 'none';
      }
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  function bindAllTips() {
    bindTip('well-box', 'well-tip', function (x, y) {
      for (var i = 0; i < wellHot.length; i++) {
        var h = wellHot[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.html;
      }
      return null;
    });
    bindTip('load-box', 'load-tip', function (x, y) {
      if (!loadGeom) return null;
      var g = loadGeom, lm = g.lm;
      if (x < g.pl || x > g.pl + g.pw || y < g.pt || y > g.pt + g.ph) return null;
      var ov = (x - g.pl) / g.pw * g.xMax;
      var hook = lm.staticLoad + ov;
      var jar = lm.staticLoad + ov * lm.jarMult;
      return '过提 <b>' + ov.toFixed(0) + ' kN</b><br>大钩载荷 <b>' + hook.toFixed(0) + ' kN</b>（余量 ' +
        (lm.limit - hook).toFixed(0) + '）<br>震击冲击 <b>' + jar.toFixed(0) + ' kN</b>（余量 ' + (lm.limit - jar).toFixed(0) + '）';
    });
    bindTip('score-box', 'score-tip', function (x, y) {
      if (!scoreGeom) return null;
      var g = scoreGeom;
      var i = Math.floor((y - g.pt) / g.rowH);
      if (i < 0 || i >= g.show.length || x < g.pl) return null;
      var r = g.show[i];
      var html = '<b>' + r.tool.name + '</b><br>外径 Φ' + r.tool.od + ' mm · 评分 <b>' + r.score + '</b>';
      if (r.fail) html += '<br><span style="color:#b05a51">规则淘汰：' + r.fail + '</span>';
      if (r.why.length) html += '<br>' + r.why.join('<br>');
      html += '<br><span style="color:#8a9298">' + r.tool.desc + '</span>';
      return html;
    });
  }

  /* ---------- 参数绑定 ---------- */
  var OUT = {
    depth: function (v) { return v + ' m'; },
    casing: function (v) { return v + ' mm'; },
    dev: function (v) { return v + ' °'; },
    len: function (v) { return (+v).toFixed(1) + ' m'; },
    od: function (v) { return v + ' mm'; }
  };
  var SLIDERS = ['depth', 'casing', 'dev', 'len', 'od'];

  function bind() {
    SLIDERS.forEach(function (k) {
      $('s-' + k).addEventListener('input', function () {
        S[k] = parseFloat(this.value);
        $('o-' + k).textContent = OUT[k](S[k]);
        render();
      });
    });
    $('s-type').addEventListener('change', function () {
      S.type = this.value;
      var d = FISH[S.type];
      S.len = d.lenD; S.od = d.odD;
      $('s-len').value = S.len; $('s-od').value = S.od;
      $('o-len').textContent = OUT.len(S.len); $('o-od').textContent = OUT.od(S.od);
      render();
    });
    $('s-top').addEventListener('change', function () { S.top = this.value; render(); });
    $('s-string').addEventListener('change', function () { S.string = this.value; render(); });
    $('btn-reset').addEventListener('click', function () {
      S = Object.assign({}, DEF);
      $('s-type').value = S.type; $('s-top').value = S.top; $('s-string').value = S.string;
      SLIDERS.forEach(function (k) {
        $('s-' + k).value = S[k];
        $('o-' + k).textContent = OUT[k](S[k]);
      });
      render();
    });
  }

  bind();
  bindAllTips();
  render();

  /* 尺寸变化时重建 canvas backing store，保持清晰 */
  var rsTimer = null;
  window.addEventListener('resize', function () {
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(render, 120);
  });
})();

/* ======= 真实数据来源页 ======= */
(function () {
  'use strict';

  var SOURCES = [
    { name: 'SY/T 5572-2012《钻井和修井用打捞工具分类与通用技术条件》', mod: '工具库 / 评分规则',
      desc: '国家能源局石油天然气行业标准（代替 SY/T 5572-1993）：规定钻井和修井用打捞工具的分类、型号表示方法与通用技术条件，是本 demo 工具库 46 种工具分类与外径 / 适用区间字段的行业口径。',
      url: 'https://std.samr.gov.cn/hb/search/stdHBDetailedCNF?id=8B1827F23339BB19E05397BE0A0AB44A', link: '标准全文公开系统↗' },
    { name: 'SY/T 5587.12-2018《常规修井作业规程 第12部分：解卡打捞》', mod: '作业流程步骤',
      desc: '国家能源局行业标准（代替 SY/T 5587.12-2004 等）：规定解卡打捞的作业准备、施工程序、安全与质量控制，对应本 demo「推荐结论与作业流程」的 6—7 步工序编排。',
      url: 'https://std.samr.gov.cn/hb/search/stdHBDetailed?id=8B1827F267F8BB19E05397BE0A0AB44A', link: '标准全文公开系统↗' },
    { name: 'SY/T 5827-2005《解卡打捞工艺作法》', mod: '震击器组合 / 管柱组配',
      desc: '石油天然气行业标准：规定活动管柱法、震击法、倒扣法、切割法、铣磨钻法等解卡打捞工艺；明确管柱组合「钻具 + 液压加速器 + 钻杆 / 钻铤 + 液压震击器 + 开式震击器 + 安全接头 + 打捞工具」，对应震击器 + 加速器组合模块。',
      url: 'https://sgy.cqust.edu.cn/syjxsmzx/images/17/11/29/4t7ragi4i1/8B11CB9D2D889B33D45474CCA09B97CC.pdf', link: '标准 PDF↗' },
    { name: 'API Spec 7-1 / ISO 10424-1 Rotary Drill Stem Elements', mod: '管柱构件 / 扣型折减',
      desc: 'API Spec 7-1（第 2 版，含 Errata 1 (2023)、Addendum 1 (2025)），技术内容等同 ISO 10424-1：规定方钻杆、钻杆、钻铤、加重钻杆、转换接头等旋转钻柱构件的技术交货条件，对应打捞管柱参数与「扭矩上限按扣型折减」规则。',
      url: 'https://www.iso.org/obp/ui/es/#iso:std:iso:10424:-1:en', link: 'ISO OBP↗' },
    { name: 'API RP 7G《Drill Stem Design and Operating Limits》', mod: '大钩载荷 80% 安全校核',
      desc: 'API 推荐做法：给出钻杆与接头组合的抗拉 / 抗扭强度表（Tables 2–10）与使用极限；工程上普遍按抗拉屈服的 80% 设定大钩载荷安全线，对应本 demo 载荷校核曲线的红色安全线。',
      url: 'https://www.osti.gov/biblio/611556', link: 'OSTI 文献页↗' },
    { name: 'SPE-130673-MS：Application of Heavy-Duty Wireline Fishing Tools and Techniques', mod: '电缆落物打捞',
      desc: 'SPE/ICoTA 连续油管与井筒干预会议论文（2010）：重型电缆打捞工具（加重震击器 / 加速器、重型 GS 拉拔工具、钢丝抓捞器组合）解决复杂井下落物恢复生产，对应电缆 / 钢丝落物的工具评分与震击加速参数。',
      url: 'https://doi.org/10.2118/130673-MS', link: 'OnePetro DOI↗' },
    { name: 'Saudi Aramco Instructor Guide 3300：Fishing Tools Applications', mod: '公锥 / 母锥造扣评分',
      desc: '沙特阿美培训教材：系统讲解母锥（die collar）、公锥（taper tap）、打捞筒（overshot）、打捞矛（spear）的操作程序与适用条件——「施加小于一点钻压并旋转至锥面螺纹咬合落物」，对应造扣类工具的适用区间与鱼顶状态加减分。',
      url: 'https://www.sadaacademy.edu.sa/ar/_files/ugd/11a26f_1107c06f10164ad899ca38c461a4a93a.pdf', link: '培训教材 PDF↗' },
    { name: 'SWP Short Course (2012)：Extraction of Stuck Oil Field Tubulars', mod: '时效风险提示',
      desc: 'Southwestern Petroleum 短课程论文：统计表明卡管 24 h 内解卡成功率约 85%，超过 72 h 降至约 20%——对应本 demo 风险提示中「先下铅印确认但不得延误解卡窗口」的时效逻辑。',
      url: 'https://www.swpshortcourse.org/sites/default/files/papers/2012034.pdf', link: '会议论文 PDF↗' }
  ];

  var DIST = [
    { name: '油管', n: 268 },
    { name: '抽油杆', n: 197 },
    { name: '工具落物', n: 121 },
    { name: '电缆/钢丝', n: 63 },
    { name: '碎屑', n: 35 }
  ];

  var MAP = [
    ['SY/T 5572-2012', '打捞工具分类、型号与通用技术条件', '工具知识图谱', '工具评分对比'],
    ['SY/T 5587.12-2018', '解卡打捞作业程序与安全质量控制', '作业流程步骤'],
    ['SY/T 5827-2005', '震击法管柱组合：加速器 + 震击器 + 安全接头 + 打捞工具', '震击器组合', '流程步骤 5'],
    ['API Spec 7-1 / ISO 10424-1', '旋转钻柱构件技术条件（钻杆、接头、扣型）', '打捞管柱参数', '扣型折减规则'],
    ['API RP 7G', '钻柱抗拉 / 抗扭强度与使用极限；80% 安全线口径', '载荷校核曲线', '载荷校核指标卡'],
    ['SPE-130673-MS', '重型电缆打捞工具与震击加速技术', '电缆落物评分', '震击放大系数'],
    ['Aramco Guide 3300', '母锥 / 公锥 / 打捞筒 / 打捞矛操作与适用条件', '鱼顶状态加减分', '工具适用区间'],
    ['SWP Short Course 2012', '卡管解卡时效统计：24 h 内 85% → 72 h 后约 20%', '风险提示文案', '流程步骤 1']
  ];

  function renderSources() {
    var html = '';
    SOURCES.forEach(function (s, i) {
      html += '<div class="src-item">' +
        '<div class="s-head"><span class="s-name">' + (i + 1) + '. ' + s.name + '</span>' +
        '<span class="s-mod">→ ' + s.mod + '</span></div>' +
        '<div class="s-desc">' + s.desc + ' <a href="' + s.url + '" target="_blank" rel="noopener">' + s.link + '</a></div>' +
        '</div>';
    });
    document.getElementById('src-list').innerHTML = html;

    var tb = '';
    MAP.forEach(function (r, i) {
      var tags = '';
      for (var k = 2; k < r.length; k++) tags += '<span class="m-tag">' + r[k] + '</span>';
      tb += '<tr><td class="num">' + (i + 1) + '</td><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + tags + '</td></tr>';
    });
    document.getElementById('map-body').innerHTML = tb;
  }

  /* ---------- 684 井次分布柱状图 ---------- */
  function setupCanvas(cv, lw, lh) {
    var dpr = window.devicePixelRatio || 1;
    var ratio = dpr * ((cv.clientWidth || lw) / lw);
    cv.width = Math.max(1, Math.round(lw * ratio));
    cv.height = Math.max(1, Math.round(lh * ratio));
    var ctx = cv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  var distGeom = null;
  function drawDist() {
    var cv = document.getElementById('dist');
    var W = 860, H = 250;
    var ctx = setupCanvas(cv, W, H);
    var pl = 50, pr = 20, pt = 18, pb = 34;
    var pw = W - pl - pr, ph = H - pt - pb;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdfcf9';
    ctx.fillRect(0, 0, W, H);

    var yMax = 300;
    ctx.strokeStyle = '#efece1';
    ctx.fillStyle = '#9ba3a9';
    ctx.font = '9px Consolas, monospace';
    ctx.lineWidth = 1;
    for (var v = 0; v <= yMax; v += 50) {
      var y = pt + ph - v / yMax * ph;
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + pw, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(v + '', pl - 6, y + 3);
    }

    var total = 684;
    var slot = pw / DIST.length;
    var bw = Math.min(120, slot * 0.55);
    distGeom = { bars: [] };
    DIST.forEach(function (d, i) {
      var cx = pl + slot * (i + 0.5);
      var bh = d.n / yMax * ph;
      var yTop = pt + ph - bh;
      ctx.fillStyle = i === 0 ? '#2f7d6b' : 'rgba(47,125,107,.62)';
      ctx.beginPath();
      ctx.rect(cx - bw / 2, yTop, bw, bh);
      ctx.fill();
      ctx.fillStyle = '#2f7d6b';
      ctx.font = '10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.n + ' 井次', cx, yTop - 14);
      ctx.fillStyle = '#79828a';
      ctx.font = '9px sans-serif';
      ctx.fillText((d.n / total * 100).toFixed(1) + '%', cx, yTop - 3);
      ctx.fillStyle = '#3d464b';
      ctx.font = '10px sans-serif';
      ctx.fillText(d.name, cx, pt + ph + 15);
      distGeom.bars.push({ x0: cx - bw / 2, x1: cx + bw / 2, y0: yTop, y1: pt + ph, d: d });
    });

    ctx.fillStyle = '#5d666d';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('落物类型（684 井次合计，某采油厂 5 年打捞记录）', pl + pw / 2, H - 4);
    ctx.save();
    ctx.translate(12, pt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('井次', 0, 0);
    ctx.restore();
  }

  function bindDistTip() {
    var box = document.getElementById('dist-box'), tip = document.getElementById('dist-tip');
    var cv = document.getElementById('dist');
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      var x = (e.clientX - r.left) * (860 / r.width);
      var y = (e.clientY - r.top) * (250 / r.height);
      var hit = null;
      if (distGeom) {
        distGeom.bars.forEach(function (b) {
          if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) hit = b;
        });
      }
      if (hit) {
        var rb = box.getBoundingClientRect();
        tip.innerHTML = '<b>' + hit.d.name + '</b>：' + hit.d.n + ' 井次（' + (hit.d.n / 684 * 100).toFixed(1) + '%）';
        tip.style.display = 'block';
        tip.style.left = clamp(e.clientX - rb.left + 12, 4, rb.width - 180) + 'px';
        tip.style.top = clamp(e.clientY - rb.top - 8, 4, rb.height - 60) + 'px';
      } else {
        tip.style.display = 'none';
      }
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  }

  /* ---------- 页签切换（支持 #real / #sim 哈希直达） ---------- */
  function bindTabs() {
    var tabs = document.querySelectorAll('.tab'), panes = document.querySelectorAll('.tabpane');
    function activate(btn) {
      var id = btn.getAttribute('data-tab');
      tabs.forEach(function (o) { o.classList.remove('active'); });
      btn.classList.add('active');
      panes.forEach(function (p) { p.classList.toggle('active', p.id === 'pane-' + id); });
      if (id === 'real') drawDist();
    }
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { activate(this); });
    });
    if (location.hash === '#real') {
      tabs.forEach(function (tab) {
        if (tab.getAttribute('data-tab') === 'real') activate(tab);
      });
    }
  }

  renderSources();
  bindTabs();
  bindDistTip();
  drawDist();
})();
