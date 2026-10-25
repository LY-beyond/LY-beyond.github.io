/* ======= 录井报告自动生成与要素抽取 · 可运行示范 ======= */
(function () {
  'use strict';

  var LINES = [
    { src: '班次', text: '班次 2026-10-24 08:00—20:00　井号 XX-12　井型 开发井' },
    { src: '录井仪', text: '井深 3245.0—3252.0 m，钻时 8.5 min/m，层位 三叠系。' },
    { src: '录井仪', text: '气测：全烃 3.42%，C1 2.71%，C2 0.38%，组分齐全。' },
    { src: '岩屑', text: '岩性：灰色荧光细砂岩，含油迹，泥质胶结，分选中等。' },
    { src: '钻井液', text: '钻井液密度 1.28 g/cm³，粘度 46 s，失水 4.2 mL。' },
    { src: '工程', text: '02:40 泵压由 18.6 MPa 降至 12.4 MPa，排量 28 L/s。' },
    { src: '工程', text: '循环观察见少量气泡，未见明显溢流。' },
    { src: '录井仪', text: '迟到时间 42 min，捞样 7 包，烘干后描述。' },
    { src: '工程', text: '下步建议：降低密度至 1.24 g/cm³，加强气测监控。' },
    { src: '审核', text: '值班：张　审核：李　备注：气测异常待监督确认。' }
  ];
  var TEXT = LINES.map(function (l) { return l.text; }).join('\n');
  var OFFSETS = [];
  (function () {
    var p = 0;
    LINES.forEach(function (l) { OFFSETS.push(p); p += l.text.length + 1; });
  })();

  var FIELDS = [
    { key: 'depth', name: '井深段', short: '井深段', conf: 0.98, note: '正则命中，区间格式与上一班连续',
      re: /(\d{4}\.\d)\s*[—~-]\s*(\d{4}\.\d)\s*m/,
      val: function (m) { return m[1] + '—' + m[2] + ' m'; } },
    { key: 'rop', name: '钻时', short: '钻时', conf: 0.96, note: '数值与单位完整，与钻时曲线一致',
      re: /钻时\s*([\d.]+)\s*min\/m/,
      val: function (m) { return m[1] + ' min/m'; } },
    { key: 'gas', name: '气测峰值', short: '气测', conf: 0.94, note: '全烃与 C1 分离命中，单位统一为 %',
      re: /全烃\s*([\d.]+)\s*%/,
      val: function (m) { return '全烃 ' + m[1] + '%'; } },
    { key: 'lith', name: '岩性', short: '岩性', conf: 0.68, note: '自由文本 NER；荧光与油迹术语存在歧义',
      re: /岩性[：:]\s*([^，。\n]+)/,
      val: function (m) { return m[1]; } },
    { key: 'mud', name: '钻井液密度', short: '密度', conf: 0.92, note: '单位 g/cm³ 与量程校验通过',
      re: /密度\s*([\d.]+)\s*g\/cm³/,
      val: function (m) { return m[1] + ' g/cm³'; } },
    { key: 'event', name: '工程异常', short: '异常', conf: 0.81, note: '事件句抽取；泵压降幅 33%，需判断漏失',
      re: /泵压由\s*([\d.]+)\s*MPa\s*降至\s*([\d.]+)\s*MPa/,
      val: function (m) { return '泵压 ' + m[1] + ' → ' + m[2] + ' MPa'; } }
  ];

  var state = { revealed: 6, threshold: 0.75 };
  var timer = null;
  var spans = {};

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function lineOf(pos) {
    for (var i = LINES.length - 1; i >= 0; i--) {
      if (pos >= OFFSETS[i]) return i;
    }
    return 0;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function buildSpans() {
    FIELDS.forEach(function (f) {
      var m = f.re.exec(TEXT);
      if (!m) return;
      spans[f.key] = {
        start: m.index,
        end: m.index + m[0].length,
        line: lineOf(m.index),
        value: f.val(m)
      };
    });
  }

  function shownFields() {
    return FIELDS.slice(0, state.revealed);
  }

  function markClass(f, isHot) {
    var cls = f.conf < state.threshold ? 'low' : '';
    if (isHot) cls += (cls ? ' ' : '') + 'hot';
    return cls;
  }

  function renderSource() {
    var shown = shownFields();
    var current = shown.length ? shown[shown.length - 1].key : '';
    var s = '';
    LINES.forEach(function (line, li) {
      var base = OFFSETS[li];
      var end = base + line.text.length;
      var hits = [];
      shown.forEach(function (f) {
        var sp = spans[f.key];
        if (!sp) return;
        var a = Math.max(sp.start, base), b = Math.min(sp.end, end);
        if (a < b) hits.push({ a: a - base, b: b - base, f: f });
      });
      hits.sort(function (p, q) { return p.a - q.a; });
      var body = '', cur = 0;
      hits.forEach(function (h) {
        body += esc(line.text.slice(cur, h.a));
        body += '<mark class="' + markClass(h.f, h.f.key === current) + '" title="' +
          h.f.name + ' · 置信度 ' + h.f.conf.toFixed(2) + '">' +
          esc(line.text.slice(h.a, h.b)) + '</mark>';
        cur = h.b;
      });
      body += esc(line.text.slice(cur));
      s += '<div class="line"><span class="ln">' + pad(li + 1) + '</span><span class="tx">' + body + '</span></div>';
    });
    $('src').innerHTML = s;
  }

  function renderCards() {
    var shown = shownFields();
    var s = '';
    FIELDS.forEach(function (f, i) {
      var isShown = i < shown.length;
      var low = f.conf < state.threshold;
      var hot = isShown && i === shown.length - 1;
      var cls = 'fld ' + (isShown ? 'on' : 'idle');
      if (isShown && low) cls += ' low';
      if (isShown && hot) cls += ' hot';
      var sp = spans[f.key];
      var srcTag = isShown && sp ? '来源 L' + pad(sp.line + 1) : '待抽取';
      var cf = isShown ? (f.conf * 100).toFixed(0) + '%' : '—';
      var val = isShown && sp ? sp.value : '—';
      var note = isShown ? f.note : '等待生成';
      if (isShown && low) note += ' · 低于阈值，待人工确认';
      s += '<div class="' + cls + '">' +
        '<div class="fld-top"><span class="nm">' + f.name + '</span><span class="src-badge">' + srcTag +
        '</span><span class="cf">' + cf + '</span></div>' +
        '<div class="val">' + esc(val) + '</div>' +
        '<div class="bar"><i style="width:' + (isShown ? f.conf * 100 : 0) + '%"></i></div>' +
        '<div class="note">' + esc(note) + '</div></div>';
    });
    $('cards').innerHTML = s;
  }

  function drawGate() {
    var svg = $('gate');
    var W = 760, H = 170, L = 52, R = 744, T = 30, B = 122;
    var pw = R - L, ph = B - T;
    function yOf(v) { return B - (v - 0.5) / 0.5 * ph; }
    var s = '<text x="14" y="18" font-size="9.5" fill="var(--tx-3)">字段置信度与采纳阈值（0.50—1.00）</text>';
    var v;
    for (v = 0.5; v <= 1.0001; v += 0.1) {
      s += '<line x1="' + L + '" y1="' + yOf(v) + '" x2="' + R + '" y2="' + yOf(v) + '" stroke="var(--line)" stroke-width=".7"/>';
      s += '<text x="' + (L - 8) + '" y="' + (yOf(v) + 3.5) + '" font-size="9" fill="var(--tx-3)" text-anchor="end">' + v.toFixed(1) + '</text>';
    }
    var yt = yOf(state.threshold);
    s += '<line x1="' + L + '" y1="' + yt + '" x2="' + R + '" y2="' + yt + '" stroke="var(--gold)" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += '<text x="' + (R - 4) + '" y="' + (yt - 6) + '" font-size="9" fill="var(--gold)" text-anchor="end">阈值 ' + state.threshold.toFixed(2) + '</text>';
    FIELDS.forEach(function (f, i) {
      var x = L + (i + 0.5) * pw / FIELDS.length;
      var low = f.conf < state.threshold;
      var y = yOf(f.conf);
      s += '<rect x="' + (x - 19) + '" y="' + y + '" width="38" height="' + Math.max(1, B - y) + '" rx="2" fill="' + (low ? 'var(--bad)' : 'var(--acc)') + '" opacity=".82"/>';
      s += '<text x="' + x + '" y="' + (y - 5) + '" font-size="9.5" fill="' + (low ? 'var(--bad)' : 'var(--acc)') + '" text-anchor="middle" font-family="var(--mono)">' + f.conf.toFixed(2) + '</text>';
      s += '<text x="' + x + '" y="' + (B + 17) + '" font-size="10" fill="' + (low ? 'var(--bad)' : 'var(--tx-2)') + '" text-anchor="middle">' + f.short + '</text>';
    });
    svg.innerHTML = s;
  }

  function renderReads() {
    var shown = shownFields();
    var adopted = shown.filter(function (f) { return f.conf >= state.threshold; });
    var manual = shown.length - adopted.length;
    var rec = shown.length ? (adopted.length / FIELDS.length * 100) : 0;

    $('r-rec').textContent = shown.length ? rec.toFixed(1) + '%' : '—';
    $('r-rec').className = rec >= 83 ? '' : 'bad';
    $('r-man').textContent = shown.length ? String(manual) : '—';
    $('r-man').className = manual > 0 ? 'bad' : '';
    $('r-chk').textContent = shown.length ? adopted.length + ' / ' + shown.length + ' 通过' : '—';
    $('r-chk').className = manual > 0 ? 'gold' : '';
    $('field-count').textContent = shown.length + ' / ' + FIELDS.length;
    $('gen-hint').textContent = shown.length === FIELDS.length
      ? '已生成 6 / 6 字段 · 模板：开发井 12 h 班报'
      : '正在生成 ' + shown.length + ' / 6 …';

    var v = $('verdict');
    if (!shown.length) {
      v.className = 'verdict';
      v.innerHTML = '<b>待生成</b>点击「生成报告」后，按字段逐一展示抽取来源与置信度。';
      return;
    }
    if (manual === 0) {
      v.className = 'verdict ok';
      v.innerHTML = '<b>可直接发布</b>6 个字段全部高于阈值 ' + state.threshold.toFixed(2) +
        '，来源行号齐全；结论性表述（气测异常）仍需值班签字确认。';
    } else {
      var names = shown.filter(function (f) { return f.conf < state.threshold; })
        .map(function (f) { return f.name; }).join('、');
      v.className = 'verdict bad';
      v.innerHTML = '<b>需审核</b>' + names + ' 低于阈值 ' + state.threshold.toFixed(2) +
        '，共 ' + manual + ' 个字段待人工确认；确认前不写入日报。';
    }
  }

  function render() {
    renderSource();
    renderCards();
    drawGate();
    renderReads();
  }

  function play() {
    if (timer) { clearInterval(timer); timer = null; }
    state.revealed = 0;
    render();
    timer = setInterval(function () {
      state.revealed += 1;
      if (state.revealed >= FIELDS.length) {
        state.revealed = FIELDS.length;
        clearInterval(timer);
        timer = null;
      }
      render();
    }, 360);
  }

  function bind() {
    $('btn').addEventListener('click', play);
    $('btn-reset').addEventListener('click', function () {
      if (timer) { clearInterval(timer); timer = null; }
      state.revealed = 0;
      render();
    });
    $('s-th').addEventListener('input', function (e) {
      state.threshold = +e.target.value / 100;
      $('o-th').textContent = state.threshold.toFixed(2);
      $('th-tag').textContent = '阈值 ' + state.threshold.toFixed(2);
      render();
    });
  }

  buildSpans();
  bind();
  play();
})();
