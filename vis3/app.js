/* =========================================================
 * app.js —— 工作台交互层（数据 → 变换 → 图表 → 代码）
 * ---------------------------------------------------------
 * 分工：
 *   pandas.js  迷你 DataFrame 引擎（window.PD）
 *   charts.js  纯 SVG 图表渲染器（window.PDCHARTS）
 *   data.js    内置数据集（window.PD_DATA）
 *   i18n.js    中英字典与切换（window.I18N）
 *   本文件      把上面四块粘成一个可视化工作台：状态、流水线、
 *              表格、图表编码、pandas 代码生成、导出。
 * 约定：列名与 pandas API 一律英文（代码可直接复制运行）；
 *       界面文案与代码注释走 I18N（data-i18n / t() / pick()）。
 * ========================================================= */
(function () {
  'use strict';

  var PD = window.PD, C = window.PDCHARTS, DATA = window.PD_DATA, I = window.I18N;

  /* ---------------- 文案 ---------------- */
  function t(key) { return I.t(key); }
  function tf(key, vars) { return I.tf(key, vars); }
  /* 界面外的临时文案（代码注释 / 校验提示）：不进字典，直接给中英两份 */
  function L(zh, en) { return I.pick({ zh: zh, en: en }); }

  /* ---------------- 常量 ---------------- */
  var PREVIEW_ROWS = 12;      /* 预览 / 结果表默认每页行数 */
  var MAX_CHART_ROWS = 60;    /* 图表最多吃多少行原始数据 */
  var PIPE_LIMIT = 20000;     /* 变换结果超过它就不再自动重算图表（防卡） */
  var CSV_HEAD_BYTES = 4000;
  var PAGE_SIZES = [12, 25, 50, 100];   /* 结果表每页行数选项（12 = 与预览一致，默认值） */
  var HIST_LIMIT = 60;        /* 撤销栈上限：够长，又不至于把快照堆在内存里 */
  var HIST_MERGE_MS = 700;    /* 连续拖同一个参数时，这段窗口内的改动合并成一条历史 */
  var SHARE_LIMIT = 2400;     /* 分享链接里塞得下的最大 JSON 长度，再长就劝退 */

  /* ---------------- DOM 小工具 ---------------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function txt(node, s) { if (node) node.textContent = s == null ? '' : String(s); return node; }
  function opt(parent, value, label) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    parent.appendChild(o);
    return o;
  }

  /* ---------------- 格式化 ---------------- */
  function isNA(v) { return PD.isMissing(v); }
  function fmtNum(v) {
    if (typeof v !== 'number' || !isFinite(v)) return String(v);
    if (Number.isInteger(v)) return v.toLocaleString();
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-4 || a >= 1e7)) return v.toExponential(2);
    var p = Math.pow(10, S.display.precision);      /* pd.set_option("display.precision") */
    return String(Math.round(v * p) / p);
  }
  /* 单元格文本：缺失值显示成 pandas 的 NaN（不是空白，避免与空字符串混淆） */
  function fmtCell(v) {
    if (isNA(v)) return 'NaN';
    if (typeof v === 'number') return fmtNum(v);
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
  }
  function quote(name) { return JSON.stringify(String(name)); }
  function list(names) { return '[' + names.map(quote).join(', ') + ']'; }
  /* 变量名安全化：内置 id / 文件名 → python 标识符 */
  function safeName(s) {
    var n = String(s || 'x').replace(/[^0-9A-Za-z_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n) n = 'data';
    if (/^[0-9]/.test(n)) n = 'd_' + n;
    return n;
  }

  /* ---------------- 下载 / 状态 ---------------- */
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return name;
  }
  /* 已经是 Blob 的内容（PNG）走这个口 */
  function downloadBlob(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return name;
  }
  function setStatus(id, message, kind) {
    var node = $(id);
    if (!node) return;
    node.textContent = message || '';
    node.className = 'status-line' + (kind ? ' is-' + kind : '');
  }

  /* ---------------- 状态 ---------------- */
  var S = {
    sources: [],      /* {key, kind, name, tag, df, text, url, fileName} */
    active: 0,
    steps: [],        /* {uid, op, params, error, rows, cols} */
    seq: 0,
    result: null,     /* 当前流水线结果 DataFrame */
    stages: [],       /* 每步之后的 shape/columns，供「形状轨迹」用 */
    matrix: null,     /* 结果是否为矩阵（corr / pivot / crosstab / describe） */
    chart: { type: 'bar', x: null, y: [], color: '__none__', agg: 'sum', top: 12, bins: 20, order: 'value' },
    chartData: null,  /* {columns, rows} 图表数据表 */
    chartName: '',    /* 导出文件名前缀 */
    page: 0,          /* 结果表当前页（0 起） */
    pageSize: PREVIEW_ROWS,  /* 结果表每页行数：默认与预览一致，可切 25 / 50 / 100 */
    /* pd.set_option("display.*") 的可视化：预览行数 + 数字精度 */
    display: { maxRows: PREVIEW_ROWS, precision: 3 }
  };

  function activeSource() { return S.sources[S.active] || null; }
  function baseFrame() { var s = activeSource(); return s ? s.df : PD.DataFrame.empty(); }
  function resultFrame() { return S.result || baseFrame(); }

  /* =========================================================
   * 变换操作表（19 种）
   * 每个 op：fields 参数表单 / defaults 默认值 / apply 执行 / code 翻译成 pandas
   * 字段 kind：col 单列 · cols 多列 · num 数字 · text 文本 · sel 选项 · check 勾选 · source 另一张表
   * 选项 label 三种写法：label 用字典键 · text 直接给中英 · raw 字面量（如 dtype）
   * ========================================================= */
  function keysToOptions(list, prefix) {
    return list.map(function (k) { return { value: k, label: prefix + k }; });
  }
  function optLabel(o) {
    if (o.raw != null) return o.raw;
    return o.text ? I.pick(o.text) : t(o.label);
  }
  var FILTER_OPS = keysToOptions(['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'contains', 'startswith', 'in', 'isna', 'notna'], 'opt.');
  var FILL_METHODS = keysToOptions(['mean', 'median', 'mode', 'zero', 'emptyStr', 'ffill'], 'opt.');
  var AGGS = keysToOptions(['sum', 'mean', 'median', 'min', 'max', 'std', 'var', 'count', 'nunique', 'first', 'last'], 'agg.');
  var JOINS = keysToOptions(['inner', 'left', 'right', 'outer'], 'opt.');
  var OPERANDS = keysToOptions(['add', 'sub', 'mul', 'div'], 'opval.');
  var DTYPES = ['int64', 'float64', 'bool', 'object', 'datetime64[ns]'].map(function (d) {
    return { value: d, raw: d };
  });
  var DROPNA_HOW = [
    { value: 'any', text: { zh: '任一列缺失就删（how="any"）', en: 'drop if any column is null (how="any")' } },
    { value: 'all', text: { zh: '所有列都缺失才删（how="all"）', en: 'drop only if all columns are null (how="all")' } }
  ];
  var AXES = [
    { value: '0', label: 'opt.axis0' },
    { value: '1', label: 'opt.axis1' }
  ];
  /* 增强功能用的选项表：词条前缀统一走 opt./agg.，与已有键复用（同义词不重复翻译） */
  var STR_ACTIONS = keysToOptions(['lower', 'upper', 'title', 'strip', 'len', 'firstword', 'replace'], 'opt.');
  var RANK_METHODS = keysToOptions(['average', 'min', 'max', 'dense', 'first'], 'opt.');
  var CUM_FUNCS = keysToOptions(['cumsum', 'cumprod', 'cummax', 'cummin'], 'opt.');
  var WINDOW_FUNCS = AGGS.filter(function (o) {
    return ['mean', 'sum', 'min', 'max', 'std', 'median', 'count'].indexOf(o.value) !== -1;
  });
  var DIFF_MODES = keysToOptions(['diff', 'pct_change'], 'opt.');
  var FREQS = keysToOptions(['D', 'W', 'M', 'Q', 'Y'], 'opt.');
  var DATE_PARTS = keysToOptions(['year', 'quarter', 'month', 'day', 'weekday', 'week'], 'opt.');
  var KEEP_OPTS = keysToOptions(['first', 'last'], 'opt.');
  var DIRECTIONS = keysToOptions(['ge', 'le'], 'opt.');
  var BIGSMALL = keysToOptions(['largest', 'smallest'], 'opt.');
  /* 算子分组（下拉里用 <optgroup> 归堆，顺序 = 通用 → 清洗 → 重塑 → 分组 → 合并） */
  var OP_GROUPS = ['pick', 'clean', 'shape', 'group', 'join'];
  /* op id → 分组：下拉的 <optgroup>、自检都读这一张表（新增算子必须登记） */
  var OP_GROUP_OF = {
    filter: 'pick', select: 'pick', drop: 'pick', rename: 'pick', sort: 'pick', head: 'pick',
    query: 'pick', isin: 'pick', between: 'pick', sample: 'pick', nlargest: 'pick', iloc: 'pick',
    set_index: 'pick', reset_index: 'pick',
    astype: 'clean', assign: 'clean', dropna: 'clean', fillna: 'clean', drop_duplicates: 'clean',
    replace: 'clean', str_op: 'clean', clip: 'clean', to_datetime: 'clean', cut: 'clean', qcut: 'clean',
    get_dummies: 'clean', duplicated: 'clean', categorical: 'clean',
    melt: 'shape',
    groupby: 'group', value_counts: 'group', pivot: 'group', crosstab: 'group', corr: 'group',
    describe: 'group', cov: 'group', agg_multi: 'group', transform: 'group', group_filter: 'group',
    rank: 'group', cumsum: 'group', rolling: 'group', expanding: 'group', diff: 'group', shift: 'group',
    resample: 'group', date_part: 'group', date_offset: 'group',
    merge: 'join', concat: 'join', join: 'join', combine_first: 'join'
  };
  function groupOf(op) { return op.group || OP_GROUP_OF[op.id] || 'pick'; }

  function firstCol(df) { return df.columns.length ? df.columns[0] : null; }
  /* 另一张已载入的表：merge / concat 的右操作数 */
  function sourceFrame(key) {
    for (var i = 0; i < S.sources.length; i++) if (S.sources[i].key === key) return S.sources[i].df;
    return null;
  }
  function sourceOptions(excludeKey) {
    return S.sources.filter(function (s) { return s.key !== excludeKey; })
      .map(function (s) { return { value: s.key, raw: s.name }; });
  }
  function firstOtherSource() {
    var cur = activeSource();
    var other = S.sources.filter(function (s) { return !cur || s.key !== cur.key; });
    return other.length ? other[0].key : null;
  }
  function firstNum(df) { var n = df.numericColumns(); return n.length ? n[0] : null; }
  function need(df, col) {
    if (!col || !df.has(col)) throw new Error(t('transform.needCol'));
    return col;
  }
  function numOf(v) {
    if (isNA(v)) return NaN;
    return typeof v === 'number' ? v : Number(String(v).split(',').join(''));
  }
  function inParts(raw) {
    return String(raw == null ? '' : raw).split(',')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; });
  }
  function picked(v) { return (v && v.length) ? v : []; }
  /* 数值与数值文本按数字比，其余按字符串比（与 pandas 的隐式比较一致） */
  function cmpRow(x, op, raw) {
    if (op === 'isna') return isNA(x);
    if (op === 'notna') return !isNA(x);
    if (op === 'contains' || op === 'startswith') {
      if (isNA(x)) return false;
      var s = String(x).toLowerCase(), w = String(raw).toLowerCase();
      return op === 'contains' ? s.indexOf(w) >= 0 : s.indexOf(w) === 0;
    }
    if (op === 'in') {
      var parts = inParts(raw);
      for (var i = 0; i < parts.length; i++) {
        if (String(x) === parts[i]) return true;
        if (typeof x === 'number' && Number(parts[i]) === x) return true;
      }
      return false;
    }
    if (isNA(x)) return false;
    var want = PD.parseScalar(raw);
    var a = (typeof x === 'number' && typeof want === 'number') ? x : String(x);
    var b = (typeof a === 'number') ? want : String(want == null ? '' : want);
    if (op === 'eq') return a === b;
    if (op === 'ne') return a !== b;
    if (op === 'gt') return a > b;
    if (op === 'ge') return a >= b;
    if (op === 'lt') return a < b;
    if (op === 'le') return a <= b;
    return false;
  }
  function pyVal(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s !== '' && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return s;
    if (/^true$/i.test(s)) return 'True';
    if (/^false$/i.test(s)) return 'False';
    return quote(raw);
  }

  var OPS = [
    /* ---------- 选列与排序 ---------- */
    {
      id: 'filter',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'op', label: 'field.op', kind: 'sel', options: FILTER_OPS },
        { key: 'value', label: 'field.value', kind: 'text',
          visible: function (p) { return p.op !== 'isna' && p.op !== 'notna'; } }
      ],
      defaults: function (df) { return { col: firstCol(df), op: 'eq', value: '' }; },
      apply: function (df, p) {
        need(df, p.col);
        var vals = df.col(p.col), keep = [];
        for (var i = 0; i < vals.length; i++) if (cmpRow(vals[i], p.op, p.value)) keep.push(i);
        return df.takeRows(keep);
      },
      code: function (p) {
        var c = 'df[' + quote(p.col) + ']';
        if (p.op === 'isna') return ['df = df[' + c + '.isna()]'];
        if (p.op === 'notna') return ['df = df[' + c + '.notna()]'];
        if (p.op === 'contains') return ['df = df[' + c + '.astype(str).str.contains(' + quote(p.value) + ', case=False, na=False)]'];
        if (p.op === 'startswith') return ['df = df[' + c + '.astype(str).str.startswith(' + quote(p.value) + ')]'];
        if (p.op === 'in') return ['df = df[' + c + '.isin(' + list(inParts(p.value)) + ')]'];
        var sym = { eq: '==', ne: '!=', gt: '>', ge: '>=', lt: '<', le: '<=' }[p.op] || '==';
        return ['df = df[' + c + ' ' + sym + ' ' + pyVal(p.value) + ']'];
      }
    },
    {
      id: 'select',
      fields: [{ key: 'cols', label: 'field.cols', kind: 'cols' }],
      defaults: function (df) { return { cols: df.columns.slice(0, Math.min(3, df.columns.length)) }; },
      apply: function (df, p) {
        var cols = picked(p.cols);
        if (!cols.length) throw new Error(t('transform.needCol'));
        return df.select(cols);
      },
      code: function (p) { return ['df = df[' + list(picked(p.cols)) + ']']; }
    },
    {
      id: 'drop',
      fields: [{ key: 'cols', label: 'field.cols', kind: 'cols' }],
      defaults: function () { return { cols: [] }; },
      apply: function (df, p) {
        var cols = picked(p.cols);
        if (!cols.length) throw new Error(t('transform.needCol'));
        return df.drop(cols);
      },
      code: function (p) { return ['df = df.drop(columns=' + list(picked(p.cols)) + ')']; }
    },
    {
      id: 'rename',
      fields: [
        { key: 'from', label: 'field.from', kind: 'col' },
        { key: 'to', label: 'field.to', kind: 'text' }
      ],
      defaults: function (df) { return { from: firstCol(df), to: '' }; },
      apply: function (df, p) {
        need(df, p.from);
        var to = String(p.to || '').trim();
        if (!to) throw new Error(t('transform.needCol'));
        var m = {}; m[p.from] = to;
        return df.rename(m);
      },
      code: function (p) {
        var to = String(p.to || '').trim();
        return ['df = df.rename(columns={' + quote(p.from) + ': ' + quote(to) + '})'];
      }
    },
    {
      id: 'sort',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'desc', label: 'field.desc', kind: 'check' }
      ],
      defaults: function (df) { return { col: firstCol(df), desc: true }; },
      apply: function (df, p) {
        need(df, p.col);
        return df.sortValues([p.col], [!p.desc]);
      },
      code: function (p) {
        return ['df = df.sort_values(' + quote(p.col) + ', ascending=' + (p.desc ? 'False' : 'True') + ')'];
      }
    },
    {
      id: 'head',
      fields: [{ key: 'n', label: 'field.n', kind: 'num', min: 1, step: 1 }],
      defaults: function () { return { n: 20 }; },
      apply: function (df, p) { return df.head(Math.max(1, Math.round(Number(p.n) || 1))); },
      code: function (p) { return ['df = df.head(' + Math.max(1, Math.round(Number(p.n) || 1)) + ')']; }
    },

    /* ---------- 清洗与派生 ---------- */
    {
      id: 'astype',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'type', label: 'field.type', kind: 'sel', options: DTYPES }
      ],
      defaults: function (df) { return { col: firstCol(df), type: 'float64' }; },
      apply: function (df, p) {
        need(df, p.col);
        return df.astype(p.col, p.type);
      },
      code: function (p) {
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].astype(' + quote(p.type) + ')'];
      }
    },
    {
      id: 'assign',
      fields: [
        { key: 'name', label: 'field.name', kind: 'text' },
        { key: 'left', label: 'field.left', kind: 'col' },
        { key: 'operand', label: 'field.operand', kind: 'sel', options: OPERANDS },
        { key: 'rightKind', label: 'field.rightKind', kind: 'sel',
          options: [{ value: 'col', label: 'field.rightCol' }, { value: 'const', label: 'field.const' }] },
        { key: 'rightCol', label: 'field.rightCol', kind: 'col',
          visible: function (p) { return p.rightKind === 'col'; } },
        { key: 'const', label: 'field.const', kind: 'num', step: 'any',
          visible: function (p) { return p.rightKind === 'const'; } }
      ],
      defaults: function (df) {
        var nums = df.numericColumns();
        return {
          name: (firstNum(df) || 'col') + '_' + 'new', left: firstNum(df) || firstCol(df),
          operand: 'mul', rightKind: nums.length > 1 ? 'col' : 'const',
          rightCol: nums.length > 1 ? nums[1] : null, const: 1
        };
      },
      apply: function (df, p) {
        need(df, p.left);
        var name = String(p.name || '').trim();
        if (!name) throw new Error(t('transform.needCol'));
        var left = df.col(p.left);
        var right = p.rightKind === 'col' ? df.col(need(df, p.rightCol)) : null;
        var out = [];
        for (var i = 0; i < df.length; i++) {
          var a = numOf(left[i]);
          var b = right ? numOf(right[i]) : numOf(p.const);
          if (isNaN(a) || isNaN(b)) { out.push(null); continue; }
          if (p.operand === 'add') out.push(a + b);
          else if (p.operand === 'sub') out.push(a - b);
          else if (p.operand === 'div') out.push(b === 0 ? null : a / b);
          else out.push(a * b);
        }
        return df.assign(name, out);
      },
      code: function (p) {
        var sym = { add: '+', sub: '-', mul: '*', div: '/' }[p.operand] || '*';
        var right = p.rightKind === 'col'
          ? 'df[' + quote(p.rightCol) + ']'
          : pyVal(p.const);
        var expr = 'df[' + quote(p.left) + '] ' + sym + ' ' + right;
        var lines = ['df[' + quote(String(p.name).trim()) + '] = ' + expr];
        if (p.operand === 'div') lines.push('# 除数为 0 时 pandas 得到 inf，可加 df.replace([float("inf")], None) 抹平');
        return lines;
      }
    },
    {
      id: 'dropna',
      fields: [
        { key: 'cols', label: 'field.cols', kind: 'cols' },
        { key: 'how', label: 'field.method', kind: 'sel', options: DROPNA_HOW }
      ],
      defaults: function () { return { cols: [], how: 'any' }; },
      apply: function (df, p) { return df.dropna(picked(p.cols), p.how); },
      code: function (p) {
        var cols = picked(p.cols), args = [];
        if (cols.length) args.push('subset=' + list(cols));
        if (p.how === 'all') args.push('how="all"');
        return ['df = df.dropna(' + args.join(', ') + ')'];
      }
    },
    {
      id: 'fillna',
      fields: [
        { key: 'cols', label: 'field.cols', kind: 'cols' },
        { key: 'method', label: 'field.method', kind: 'sel', options: FILL_METHODS }
      ],
      defaults: function () { return { cols: [], method: 'mean' }; },
      apply: function (df, p) {
        var arg = p.method === 'zero' ? 0 : (p.method === 'emptyStr' ? '' : p.method);
        return df.fillna(picked(p.cols), arg);
      },
      code: function (p) {
        var cols = picked(p.cols);
        var lines = [];
        if (!cols.length) {
          lines.push('# 未指定列 → 逐列填充（数值列用统计量，字符串列用 "" 或前值）');
          cols = ['<每列占位>'];
        }
        cols.forEach(function (c) {
          var single = c === '<每列占位>';
          var ref = single ? 'df[' + quote('列名') + ']' : 'df[' + quote(c) + ']';
          if (p.method === 'ffill') lines.push(ref + ' = ' + ref + '.ffill()');
          else if (p.method === 'zero') lines.push(ref + ' = ' + ref + '.fillna(0)');
          else if (p.method === 'emptyStr') lines.push(ref + ' = ' + ref + '.fillna("")');
          else {
            var tail = p.method === 'mode' ? '.mode().iloc[0]' : '.' + p.method + '()';
            lines.push(ref + ' = ' + ref + '.fillna(' + ref + tail + ')');
          }
        });
        return lines;
      }
    },
    {
      id: 'drop_duplicates',
      fields: [{ key: 'cols', label: 'field.cols', kind: 'cols' }],
      defaults: function () { return { cols: [] }; },
      apply: function (df, p) { return df.dropDuplicates(picked(p.cols)); },
      code: function (p) {
        var cols = picked(p.cols);
        return ['df = df.drop_duplicates(' + (cols.length ? 'subset=' + list(cols) : '') + ')'];
      }
    },

    /* ---------- 汇总：分组 / 频数 / 透视 / 相关 ---------- */
    {
      id: 'groupby',
      fields: [
        { key: 'by', label: 'field.by', kind: 'cols' },
        { key: 'aggCol', label: 'field.aggCol', kind: 'col' },
        { key: 'aggFunc', label: 'field.aggFunc', kind: 'sel', options: AGGS }
      ],
      defaults: function (df) {
        var cats = df.categoryColumns();
        return {
          by: cats.length ? [cats[0]] : (df.columns.length ? [df.columns[0]] : []),
          aggCol: firstNum(df), aggFunc: 'sum'
        };
      },
      apply: function (df, p) {
        var by = picked(p.by);
        if (!by.length) throw new Error(t('transform.needCol'));
        by.forEach(function (c) { need(df, c); });
        need(df, p.aggCol);
        return df.groupby(by, [{ col: p.aggCol, func: p.aggFunc }]);
      },
      code: function (p) {
        return ['df = df.groupby(' + list(picked(p.by)) + ').agg({' +
          quote(p.aggCol) + ': ' + quote(p.aggFunc) + '}).reset_index()'];
      }
    },
    {
      id: 'value_counts',
      fields: [{ key: 'col', label: 'field.col', kind: 'col' }],
      defaults: function (df) {
        var cats = df.categoryColumns();
        return { col: cats.length ? cats[0] : firstCol(df) };
      },
      apply: function (df, p) {
        need(df, p.col);
        var vc = df.valueCounts(p.col);
        var cols = {};
        cols[p.col] = vc.index.slice();
        cols.count = vc.counts.slice();
        cols.pct = vc.pct.map(function (v) { return Math.round(v * 10000) / 10000; });
        return new PD.DataFrame([p.col, 'count', 'pct'], cols);
      },
      code: function (p) {
        var c = 'df[' + quote(p.col) + ']';
        return [
          'vc = ' + c + '.value_counts()',
          'df = pd.DataFrame({' + quote(p.col) + ': vc.index, "count": vc.values, ' +
            '"pct": (vc / vc.sum()).values})'
        ];
      }
    },

    {
      id: 'pivot',
      matrix: true,
      fields: [
        { key: 'index', label: 'field.index', kind: 'col' },
        { key: 'columns', label: 'field.columns', kind: 'col' },
        { key: 'values', label: 'field.values', kind: 'col' },
        { key: 'aggfunc', label: 'field.aggfunc', kind: 'sel', options: AGGS }
      ],
      defaults: function (df) {
        var cats = df.categoryColumns(), num = df.numericColumns();
        return {
          index: cats.length ? cats[0] : firstCol(df),
          columns: cats.length > 1 ? cats[1] : (cats.length ? cats[0] : firstCol(df)),
          values: num.length ? num[0] : firstCol(df), aggfunc: 'sum'
        };
      },
      apply: function (df, p) {
        need(df, p.index); need(df, p.columns); need(df, p.values);
        if (p.index === p.columns) throw new Error(L('行与列不能是同一列', 'Index and columns must differ'));
        return df.pivotTable(p.index, p.columns, p.values, p.aggfunc);
      },
      code: function (p) {
        return ['df = df.pivot_table(index=' + quote(p.index) + ', columns=' + quote(p.columns) +
          ', values=' + quote(p.values) + ', aggfunc=' + quote(p.aggfunc) +
          ', observed=False).reset_index()   # 列名变成 值_列值 形式'];
      }
    },
    {
      id: 'crosstab',
      matrix: true,
      fields: [
        { key: 'index', label: 'field.index', kind: 'col' },
        { key: 'columns', label: 'field.columns', kind: 'col' }
      ],
      defaults: function (df) {
        var cats = df.categoryColumns();
        return {
          index: cats.length ? cats[0] : firstCol(df),
          columns: cats.length > 1 ? cats[1] : (cats.length ? cats[0] : firstCol(df))
        };
      },
      apply: function (df, p) {
        need(df, p.index); need(df, p.columns);
        if (p.index === p.columns) throw new Error(L('行与列不能是同一列', 'Index and columns must differ'));
        return df.crosstab(p.index, p.columns);
      },
      code: function (p) {
        return ['df = pd.crosstab(df[' + quote(p.index) + '], df[' + quote(p.columns) +
          '], margins=True, margins_name="All").reset_index()   # All = 行合计'];
      }
    },

    {
      id: 'corr',
      matrix: true,
      fields: [{ key: 'cols', label: 'field.cols', kind: 'cols' }],
      defaults: function (df) { return { cols: [] }; },   /* 留空 = 全部数值列 */
      apply: function (df, p) {
        var cols = picked(p.cols);
        var scope = df;
        if (cols.length) {
          cols.forEach(function (c) { need(df, c); });
          scope = df.select(cols);
        }
        if (!scope.numericColumns().length) throw new Error(t('chart.needNumeric'));
        return scope.corr();
      },
      code: function (p) {
        var cols = picked(p.cols);
        if (!cols.length) return ['df = df.corr(numeric_only=True)   # 全部数值列的皮尔逊相关矩阵'];
        return ['df = df[' + list(cols) + '].corr(numeric_only=True)   # 皮尔逊相关矩阵'];
      }
    },
    {
      id: 'describe',
      matrix: true,
      fields: [],
      defaults: function () { return {}; },
      apply: function (df) {
        if (!df.columns.length) throw new Error(t('transform.noCols'));
        return df.describe();
      },
      code: function () {
        return ['df = df.describe(include="all")   # 行=统计量，列=变量（数值给四分位，类别给 unique/top/freq）'];
      }
    },

    {
      id: 'merge',
      fields: [
        { key: 'source', label: 'field.source', kind: 'source' },
        { key: 'leftOn', label: 'field.leftOn', kind: 'cols' },
        { key: 'rightOn', label: 'field.rightOn', kind: 'cols' },
        { key: 'how', label: 'field.how', kind: 'sel', options: JOINS }
      ],
      defaults: function (df) {
        var key = firstOtherSource(), other = key ? sourceFrame(key) : null;
        var common = df.columns.filter(function (c) { return other && other.has(c); });
        var lk = common.length ? [common[0]] : (df.columns.length ? [df.columns[0]] : []);
        var rk = other && lk.length && other.has(lk[0]) ? lk.slice() : (other && other.columns.length ? [other.columns[0]] : []);
        return { source: key, leftOn: lk, rightOn: rk, how: 'inner' };
      },
      apply: function (df, p) {
        var other = sourceFrame(p.source);
        if (!other) throw new Error(L('请选择另一张表（先在 01 数据里载入两张表）', 'Pick another table (load two tables in section 01 first)'));
        var lk = picked(p.leftOn), rk = picked(p.rightOn);
        if (!lk.length || !rk.length) throw new Error(t('transform.needCol'));
        if (lk.length !== rk.length) throw new Error(L('左右键的数量要一致', 'Left and right keys must have the same count'));
        lk.forEach(function (c) { need(df, c); });
        rk.forEach(function (c) { need(other, c); });
        return df.merge(other, lk, rk, p.how);
      },
      code: function (p) {
        var lk = picked(p.leftOn), rk = picked(p.rightOn);
        return [
          'other = pd.read_csv("other.csv")   # 换成右表的读取代码',
          'df = df.merge(other, left_on=' + list(lk) + ', right_on=' + list(rk) +
            ', how=' + quote(p.how) + ')   # 同名非键列会带上 _x / _y 后缀'
        ];
      }
    },
    {
      id: 'concat',
      fields: [
        { key: 'source', label: 'field.source', kind: 'source' },
        { key: 'axis', label: 'field.axis', kind: 'sel', options: AXES }
      ],
      defaults: function () { return { source: firstOtherSource(), axis: '0' }; },
      apply: function (df, p) {
        var other = sourceFrame(p.source);
        if (!other) throw new Error(L('请选择另一张表（先在 01 数据里载入两张表）', 'Pick another table (load two tables in section 01 first)'));
        return df.concat([other], Number(p.axis) || 0);
      },
      code: function (p) {
        var axis = Number(p.axis) || 0;
        return axis === 1
          ? ['df = pd.concat([df, other], axis=1)   # 横向拼接：按行位置对齐']
          : ['df = pd.concat([df, other], axis=0, ignore_index=True)   # 纵向拼接：列取并集，缺失补 NaN'];
      }
    },

    /* ---------- 清洗：值替换 / 字符串 / 截断 / 日期 / 分类 / 分箱 / 独热 ---------- */
    {
      id: 'replace',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'from', label: 'field.value', kind: 'text' },
        { key: 'to', label: 'field.to', kind: 'text' }
      ],
      defaults: function (df) {
        var cats = df.categoryColumns(), v = cats.length ? df.unique(cats[0]) : [];
        return { col: cats.length ? cats[0] : firstCol(df), from: v.length ? String(v[0]) : '', to: '' };
      },
      apply: function (df, p) {
        need(df, p.col);
        var from = String(p.from == null ? '' : p.from);
        if (!from) throw new Error(L('请填写要被替换的值', 'Enter the value to replace'));
        return df.replace(p.col, PD.parseScalar(from), PD.parseScalar(String(p.to == null ? '' : p.to)));
      },
      code: function (p) {
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].replace(' +
          pyVal(p.from) + ', ' + pyVal(p.to) + ')   # 整格精确替换'];
      }
    },
    {
      id: 'str_op',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'action', label: 'field.action', kind: 'sel', options: STR_ACTIONS },
        { key: 'arg', label: 'field.arg', kind: 'text',
          visible: function (p) { return p.action === 'replace' || p.action === 'firstword'; } }
      ],
      defaults: function (df) {
        var cats = df.categoryColumns();
        return { col: cats.length ? cats[0] : firstCol(df), action: 'lower', arg: '' };
      },
      apply: function (df, p) { need(df, p.col); return df.strOp(p.col, p.action, p.arg); },
      code: function (p) {
        var c = 'df[' + quote(p.col) + ']';
        var call = {
          lower: c + '.str.lower()', upper: c + '.str.upper()', title: c + '.str.title()',
          strip: c + '.str.strip()', len: c + '.str.len()',
          firstword: c + '.str.split(' + quote(p.arg || ' ') + ').str[0]'
        }[p.action];
        if (p.action === 'replace') {
          var bits = String(p.arg || '').split('=>');
          call = c + '.str.replace(' + pyVal(bits[0] || '') + ', ' + pyVal(bits[1] || '') + ', regex=False)';
        }
        return ['df[' + quote(p.col) + '] = ' + (call || c + '.str.lower()') +
          '   # 向量化字符串：不用写 for 循环'];
      }
    },
    {
      id: 'clip',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'lo', label: 'field.lo', kind: 'num', step: 'any' },
        { key: 'hi', label: 'field.hi', kind: 'num', step: 'any' }
      ],
      defaults: function (df) {
        var c = firstNum(df) || firstCol(df);
        var v = df.col(c).filter(function (x) { return !isNA(x); }).map(Number);
        return {
          col: c,
          lo: v.length ? Math.round(Math.min.apply(null, v) * 10) / 10 : 0,
          hi: v.length ? Math.round(Math.max.apply(null, v) * 10) / 10 : 1
        };
      },
      apply: function (df, p) {
        need(df, p.col);
        if (p.lo === '' && p.hi === '') throw new Error(L('下界与上界至少填一个', 'Set at least one bound'));
        return df.clip(p.col, p.lo, p.hi);
      },
      code: function (p) {
        var args = [];
        if (p.lo !== '') args.push('lower=' + pyVal(p.lo));
        if (p.hi !== '') args.push('upper=' + pyVal(p.hi));
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].clip(' + args.join(', ') +
          ')   # 异常值截断到区间内'];
      }
    },
    {
      id: 'to_datetime',
      fields: [{ key: 'col', label: 'field.col', kind: 'col' }],
      defaults: function (df) { return { col: dateCol(df) }; },
      apply: function (df, p) { need(df, p.col); return df.toDatetime(p.col); },
      code: function (p) {
        return ['df[' + quote(p.col) + '] = pd.to_datetime(df[' + quote(p.col) + '])' +
          '   # object → datetime64[ns]，之后才能用 .dt 与 resample'];
      }
    },
    {
      id: 'categorical',
      fields: [{ key: 'col', label: 'field.col', kind: 'col' }],
      defaults: function (df) {
        var cats = df.categoryColumns();
        return { col: cats.length ? cats[0] : firstCol(df) };
      },
      apply: function (df, p) { need(df, p.col); return df.toCategorical(p.col); },
      code: function (p) {
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].astype("category")' +
          '   # 类目编码：内存显著下降（见「数据体检」一栏）'];
      }
    },
    {
      id: 'duplicated',
      fields: [
        { key: 'cols', label: 'field.cols', kind: 'cols' },
        { key: 'keep', label: 'field.keep', kind: 'sel', options: KEEP_OPTS }
      ],
      defaults: function () { return { cols: [], keep: 'first' }; },
      apply: function (df, p) { return df.duplicatedFlag(picked(p.cols), p.keep); },
      code: function (p) {
        var cols = picked(p.cols);
        return ['df["is_duplicated"] = df.duplicated(' +
          (cols.length ? 'subset=' + list(cols) + ', ' : '') + 'keep=' + quote(p.keep) +
          ')   # 只标记不删除；再配 df[~df["is_duplicated"]] 过滤'];
      }
    },
    {
      id: 'cut',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'bins', label: 'field.bins', kind: 'num', min: 1, step: 1 }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), bins: 4 }; },
      apply: function (df, p) { need(df, p.col); return df.cut(p.col, p.bins); },
      code: function (p) {
        return ['df[' + quote(p.col + '_bin') + '] = pd.cut(df[' + quote(p.col) + '], bins=' +
          Math.max(1, Math.round(Number(p.bins) || 4)) + ')   # 等距分箱：连续值 → 区间类别'];
      }
    },
    {
      id: 'qcut',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'q', label: 'field.bins', kind: 'num', min: 1, step: 1 }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), q: 4 }; },
      apply: function (df, p) { need(df, p.col); return df.qcut(p.col, p.q); },
      code: function (p) {
        return ['df[' + quote(p.col + '_qcut') + '] = pd.qcut(df[' + quote(p.col) + '], q=' +
          Math.max(1, Math.round(Number(p.q) || 4)) + ', duplicates="drop")   # 等频分箱：每箱行数接近'];
      }
    },
    {
      id: 'get_dummies',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'prefix', label: 'field.prefix', kind: 'text' }
      ],
      defaults: function (df) {
        var cats = df.categoryColumns();
        return { col: cats.length ? cats[0] : firstCol(df), prefix: '' };
      },
      apply: function (df, p) {
        need(df, p.col);
        return df.getDummies(p.col, String(p.prefix || '').trim() || p.col);
      },
      code: function (p) {
        var pre = String(p.prefix || '').trim() || p.col;
        return ['df = pd.get_dummies(df, columns=' + list([p.col]) + ', prefix=' + quote(pre) +
          ')   # 独热编码：一个类别一列 True / False'];
      }
    },

    /* ---------- 查询与索引：query / isin / between / sample / nlargest / iloc / set_index ---------- */
    {
      id: 'query',
      fields: [{ key: 'expr', label: 'field.expr', kind: 'text' }],
      defaults: function (df) {
        var n = firstNum(df);
        return { expr: n ? n + ' > 0' : '' };
      },
      apply: function (df, p) {
        var expr = String(p.expr || '').trim();
        if (!expr) throw new Error(L('请填写查询表达式', 'Enter a query expression'));
        return df.queryExpr(expr);
      },
      code: function (p) {
        return ['df = df.query(' + quote(String(p.expr || '').trim()) +
          ')   # 列名直接写、字符串加引号，条件用 and / or 连接'];
      }
    },
    {
      id: 'isin',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'values', label: 'field.value', kind: 'text' }
      ],
      defaults: function (df) {
        var cats = df.categoryColumns(), v = cats.length ? df.unique(cats[0]) : [];
        return { col: cats.length ? cats[0] : firstCol(df), values: v.slice(0, 2).join(',') };
      },
      apply: function (df, p) {
        need(df, p.col);
        var vals = inParts(p.values);
        if (!vals.length) throw new Error(L('请填写候选值（逗号分隔）', 'Enter candidate values, comma separated'));
        return df.isin(p.col, vals);
      },
      code: function (p) {
        return ['df = df[df[' + quote(p.col) + '].isin(' + list(inParts(p.values)) + ')]   # 成员筛选'];
      }
    },
    {
      id: 'between',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'lo', label: 'field.lo', kind: 'num', step: 'any' },
        { key: 'hi', label: 'field.hi', kind: 'num', step: 'any' }
      ],
      defaults: function (df) {
        var c = firstNum(df) || firstCol(df);
        var v = df.col(c).filter(function (x) { return !isNA(x); }).map(Number);
        return { col: c, lo: v.length ? Math.min.apply(null, v) : 0, hi: v.length ? Math.max.apply(null, v) : 1 };
      },
      apply: function (df, p) {
        need(df, p.col);
        return df.between(p.col, PD.parseScalar(p.lo), PD.parseScalar(p.hi), 'both');
      },
      code: function (p) {
        return ['df = df[df[' + quote(p.col) + '].between(' + pyVal(p.lo) + ', ' + pyVal(p.hi) +
          ', inclusive="both")]   # 闭区间筛选'];
      }
    },
    {
      id: 'sample',
      fields: [
        { key: 'n', label: 'field.n', kind: 'num', min: 1, step: 1 },
        { key: 'seed', label: 'field.seed', kind: 'num', step: 1 }
      ],
      defaults: function (df) { return { n: Math.min(50, Math.max(1, Math.round(df.length / 10))), seed: 42 }; },
      apply: function (df, p) { return df.sample(p.n, p.seed); },
      code: function (p) {
        return ['df = df.sample(n=' + Math.max(1, Math.round(Number(p.n) || 1)) + ', random_state=' +
          Math.round(Number(p.seed) || 0) + ')   # 随机抽样；固定 random_state 才可复现'];
      }
    },
    {
      id: 'nlargest',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'n', label: 'field.n', kind: 'num', min: 1, step: 1 },
        { key: 'which', label: 'field.dir', kind: 'sel', options: BIGSMALL }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), n: 10, which: 'largest' }; },
      apply: function (df, p) { need(df, p.col); return df.nlargest(p.col, p.n, p.which); },
      code: function (p) {
        var fn = p.which === 'smallest' ? 'nsmallest' : 'nlargest';
        return ['df = df.' + fn + '(' + Math.max(1, Math.round(Number(p.n) || 1)) + ', ' + quote(p.col) +
          ')   # 排行榜：按该列排序后取前 N 行'];
      }
    },
    {
      id: 'iloc',
      fields: [
        { key: 'from', label: 'field.lo', kind: 'num', min: 0, step: 1 },
        { key: 'to', label: 'field.hi', kind: 'num', min: 0, step: 1 }
      ],
      defaults: function (df) { return { from: 0, to: Math.min(30, df.length) }; },
      apply: function (df, p) { return df.iloc(p.from, p.to); },
      code: function (p) {
        var a = Math.max(0, Math.round(Number(p.from) || 0));
        var b = (p.to === '' || p.to == null) ? '' : String(Math.round(Number(p.to)));
        return ['df = df.iloc[' + a + ':' + b + ']   # 按行号切片（含头不含尾）；loc 则按标签切'];
      }
    },
    {
      id: 'set_index',
      fields: [{ key: 'col', label: 'field.col', kind: 'col' }],
      defaults: function (df) { return { col: cat0(df) }; },
      apply: function (df, p) { need(df, p.col); return df.setIndex(p.col); },
      code: function (p) {
        return ['df = df.set_index(' + quote(p.col) + ')   # 该列变索引（工作台里固定在首列展示）'];
      }
    },
    {
      id: 'reset_index',
      fields: [],
      defaults: function () { return {}; },
      apply: function (df) { return df.resetIndex(); },
      code: function () {
        return ['df = df.reset_index()   # 索引回到普通列，换成 0..n-1 的 RangeIndex'];
      }
    },

    /* ---------- 重塑：melt（宽表 → 长表） ---------- */
    {
      id: 'melt',
      fields: [
        { key: 'idVars', label: 'field.index', kind: 'cols' },
        { key: 'valueVars', label: 'field.values', kind: 'cols' }
      ],
      defaults: function (df) {
        var nums = df.numericColumns();
        return { idVars: [cat0(df)], valueVars: nums.slice(0, 2) };
      },
      apply: function (df, p) {
        var vals = picked(p.valueVars);
        if (!vals.length) throw new Error(L('请至少选一个要堆叠的数值列', 'Pick at least one value column to stack'));
        return df.melt(picked(p.idVars), vals);
      },
      code: function (p) {
        return ['df = df.melt(id_vars=' + list(picked(p.idVars)) + ', value_vars=' + list(picked(p.valueVars)) +
          ', var_name="variable", value_name="value")   # 逆透视：列名变成一列数据'];
      }
    },

    /* ---------- 分组统计：cov / 多列 agg / transform / filter / rank ---------- */
    {
      id: 'cov',
      matrix: true,
      fields: [{ key: 'cols', label: 'field.cols', kind: 'cols' }],
      defaults: function () { return { cols: [] }; },
      apply: function (df, p) {
        var cols = picked(p.cols);
        if (cols.length) {
          cols.forEach(function (c) { need(df, c); });
          return df.select(cols).cov();
        }
        return df.cov();
      },
      code: function (p) {
        var cols = picked(p.cols);
        var scope = cols.length ? 'df[' + list(cols) + ']' : 'df';
        return [scope + '.cov(numeric_only=True)   # 协方差矩阵（对角线是各列方差）'];
      }
    },
    {
      id: 'agg_multi',
      fields: [
        { key: 'by', label: 'field.by', kind: 'cols' },
        { key: 'aggCol', label: 'field.aggCol', kind: 'col' },
        { key: 'aggFunc', label: 'field.aggFunc', kind: 'sel', options: AGGS },
        { key: 'aggCol2', label: 'field.aggCol2', kind: 'col' },
        { key: 'aggFunc2', label: 'field.aggFunc2', kind: 'sel', options: AGGS }
      ],
      defaults: function (df) {
        var nums = df.numericColumns();
        return {
          by: [cat0(df)], aggCol: nums[0] || firstCol(df), aggFunc: 'sum',
          aggCol2: nums[1] || nums[0] || '', aggFunc2: 'mean'
        };
      },
      apply: function (df, p) {
        var by = picked(p.by);
        if (!by.length) throw new Error(t('transform.needCol'));
        by.forEach(function (c) { need(df, c); });
        var pairs = [];
        if (p.aggCol) pairs.push({ col: need(df, p.aggCol), func: p.aggFunc });
        if (p.aggCol2) pairs.push({ col: need(df, p.aggCol2), func: p.aggFunc2 });
        if (!pairs.length) throw new Error(t('transform.needCol'));
        return df.aggMulti(by, pairs);
      },
      code: function (p) {
        var pairs = [];
        if (p.aggCol) pairs.push(quote(p.aggCol + '_' + p.aggFunc) + ': (' + quote(p.aggCol) + ', ' + quote(p.aggFunc) + ')');
        if (p.aggCol2) pairs.push(quote(p.aggCol2 + '_' + p.aggFunc2) + ': (' + quote(p.aggCol2) + ', ' + quote(p.aggFunc2) + ')');
        return ['df = df.groupby(' + list(picked(p.by)) + ').agg({' + pairs.join(', ') +
          '}).reset_index()   # 一次给多列配不同聚合函数'];
      }
    },
    {
      id: 'transform',
      fields: [
        { key: 'by', label: 'field.by', kind: 'cols' },
        { key: 'aggCol', label: 'field.aggCol', kind: 'col' },
        { key: 'aggFunc', label: 'field.aggFunc', kind: 'sel', options: WINDOW_FUNCS }
      ],
      defaults: function (df) { return { by: [cat0(df)], aggCol: firstNum(df) || firstCol(df), aggFunc: 'mean' }; },
      apply: function (df, p) {
        var by = picked(p.by);
        if (!by.length) throw new Error(t('transform.needCol'));
        by.forEach(function (c) { need(df, c); });
        return df.transform(by, need(df, p.aggCol), p.aggFunc);
      },
      code: function (p) {
        return ['df[' + quote(p.aggCol + '_' + p.aggFunc) + '] = df.groupby(' + list(picked(p.by)) + ')[' +
          quote(p.aggCol) + '].transform(' + quote(p.aggFunc) +
          ')   # 组内统计量广播回每一行（长度不变，常见于组内标准化）'];
      }
    },
    {
      id: 'group_filter',
      fields: [
        { key: 'by', label: 'field.by', kind: 'cols' },
        { key: 'aggCol', label: 'field.aggCol', kind: 'col' },
        { key: 'aggFunc', label: 'field.aggFunc', kind: 'sel', options: WINDOW_FUNCS },
        { key: 'dir', label: 'field.dir', kind: 'sel', options: DIRECTIONS },
        { key: 'threshold', label: 'field.threshold', kind: 'num', step: 'any' }
      ],
      defaults: function (df) {
        var c = firstNum(df) || firstCol(df), v = df.col(c).filter(function (x) { return !isNA(x); }).map(Number);
        return { by: [cat0(df)], aggCol: c, aggFunc: 'mean', dir: 'ge',
          threshold: v.length ? Math.round(PD.stat.mean(v)) : 0 };
      },
      apply: function (df, p) {
        var by = picked(p.by);
        if (!by.length) throw new Error(t('transform.needCol'));
        by.forEach(function (c) { need(df, c); });
        return df.groupFilter(by, need(df, p.aggCol), p.aggFunc, p.threshold, p.dir);
      },
      code: function (p) {
        var op = p.dir === 'le' ? '<=' : '>=';
        return ['df = df.groupby(' + list(picked(p.by)) + ').filter(lambda g: g[' + quote(p.aggCol) + '].' +
          p.aggFunc + '() ' + op + ' ' + pyVal(p.threshold) + ')   # 整组保留 / 整组丢弃'];
      }
    },
    {
      id: 'rank',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'method', label: 'field.method', kind: 'sel', options: RANK_METHODS },
        { key: 'desc', label: 'field.desc', kind: 'check' }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), method: 'average', desc: true }; },
      apply: function (df, p) { need(df, p.col); return df.rank(p.col, p.method, !p.desc); },
      code: function (p) {
        return ['df[' + quote(p.col + '_rank') + '] = df[' + quote(p.col) + '].rank(method=' +
          quote(p.method) + ', ascending=' + (p.desc ? 'False' : 'True') + ')   # 并列值处理方式可选'];
      }
    },

    /* ---------- 窗口：cumsum / rolling / expanding / diff / shift ---------- */
    {
      id: 'cumsum',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'fn', label: 'field.aggFunc', kind: 'sel', options: CUM_FUNCS }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), fn: 'cumsum' }; },
      apply: function (df, p) { need(df, p.col); return df.cum(p.col, p.fn); },
      code: function (p) {
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].' + p.fn +
          '()   # 累计计算（原列就地更新；NaN 位置保持 NaN）'];
      }
    },
    {
      id: 'rolling',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'window', label: 'field.window', kind: 'num', min: 1, step: 1 },
        { key: 'fn', label: 'field.aggFunc', kind: 'sel', options: WINDOW_FUNCS }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), window: 5, fn: 'mean' }; },
      apply: function (df, p) { need(df, p.col); return df.rolling(p.col, p.window, p.fn); },
      code: function (p) {
        var w = Math.max(1, Math.round(Number(p.window) || 1));
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].rolling(window=' + w + ').' + p.fn +
          '()   # 滚动窗口；前 ' + (w - 1) + ' 行不足窗口 → NaN'];
      }
    },
    {
      id: 'expanding',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'fn', label: 'field.aggFunc', kind: 'sel', options: WINDOW_FUNCS }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), fn: 'mean' }; },
      apply: function (df, p) { need(df, p.col); return df.expanding(p.col, p.fn); },
      code: function (p) {
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].expanding().' + p.fn +
          '()   # 扩展窗口：从第 1 行累加到当前行'];
      }
    },
    {
      id: 'diff',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'periods', label: 'field.n', kind: 'num', min: 1, step: 1 },
        { key: 'mode', label: 'field.method', kind: 'sel', options: DIFF_MODES }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), periods: 1, mode: 'diff' }; },
      apply: function (df, p) { need(df, p.col); return df.diff(p.col, p.periods, p.mode); },
      code: function (p) {
        var k = Math.max(1, Math.round(Number(p.periods) || 1));
        return p.mode === 'pct_change'
          ? ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].pct_change(periods=' + k + ')' +
            '   # 环比变化率，常用于时间序列']
          : ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].diff(periods=' + k +
            ')   # k 阶差分：消趋势'];
      }
    },
    {
      id: 'shift',
      fields: [
        { key: 'col', label: 'field.col', kind: 'col' },
        { key: 'periods', label: 'field.n', kind: 'num', step: 1 }
      ],
      defaults: function (df) { return { col: firstNum(df) || firstCol(df), periods: 1 }; },
      apply: function (df, p) { need(df, p.col); return df.shift(p.col, p.periods); },
      code: function (p) {
        var k = Math.round(Number(p.periods) || 1);
        return ['df[' + quote(p.col) + '] = df[' + quote(p.col) + '].shift(' + k +
          ')   # 上下平移（滞后 ' + k + ' 期；负数 = 提前），空出来的位置是 NaN'];
      }
    },

    /* ---------- 时间序列：resample / dt 成分 / DateOffset ---------- */
    {
      id: 'resample',
      fields: [
        { key: 'dateCol', label: 'field.col', kind: 'col' },
        { key: 'freq', label: 'field.freq', kind: 'sel', options: FREQS },
        { key: 'aggCol', label: 'field.aggCol', kind: 'col' },
        { key: 'aggFunc', label: 'field.aggFunc', kind: 'sel', options: AGGS }
      ],
      defaults: function (df) {
        var nums = df.numericColumns();
        return { dateCol: dateCol(df), freq: 'M', aggCol: nums[0] || firstCol(df), aggFunc: 'sum' };
      },
      apply: function (df, p) {
        need(df, p.dateCol);
        need(df, p.aggCol);
        return df.toDatetime(p.dateCol).resample(p.dateCol, p.freq, p.aggCol, p.aggFunc);
      },
      code: function (p) {
        return [
          'df[' + quote(p.dateCol) + '] = pd.to_datetime(df[' + quote(p.dateCol) + '])',
          'df = (df.set_index(' + quote(p.dateCol) + ').resample(' + quote(p.freq) + ')[' + quote(p.aggCol) + ']' +
            '.' + p.aggFunc + '().reset_index())   # 时间粒度转换：日 → ' + p.freq
        ];
      }
    },
    {
      id: 'date_part',
      fields: [
        { key: 'dateCol', label: 'field.col', kind: 'col' },
        { key: 'part', label: 'field.part', kind: 'sel', options: DATE_PARTS }
      ],
      defaults: function (df) { return { dateCol: dateCol(df), part: 'month' }; },
      apply: function (df, p) { need(df, p.dateCol); return df.datePart(p.dateCol, p.part); },
      code: function (p) {
        return ['df[' + quote(p.dateCol + '_' + p.part) + '] = pd.to_datetime(df[' + quote(p.dateCol) +
          ']).dt.' + p.part + '   # 时间成分提取（year / quarter / month / day / weekday / week）'];
      }
    },
    {
      id: 'date_offset',
      fields: [
        { key: 'dateCol', label: 'field.col', kind: 'col' },
        { key: 'days', label: 'field.days', kind: 'num', step: 1 },
        { key: 'months', label: 'field.months', kind: 'num', step: 1 }
      ],
      defaults: function (df) { return { dateCol: dateCol(df), days: 7, months: 0 }; },
      apply: function (df, p) { need(df, p.dateCol); return df.dateOffset(p.dateCol, p.days, p.months); },
      code: function (p) {
        var args = [];
        if (Number(p.days)) args.push('days=' + Math.round(Number(p.days)));
        if (Number(p.months)) args.push('months=' + Math.round(Number(p.months)));
        return ['df[' + quote(p.dateCol + '_offset') + '] = pd.to_datetime(df[' + quote(p.dateCol) +
          ']) + pd.DateOffset(' + (args.length ? args.join(', ') : 'days=0') +
          ')   # 日期偏移：跨月自动进位'];
      }
    },

    /* ---------- 合并：join（按索引）/ combine_first（补缺失） ---------- */
    {
      id: 'join',
      fields: [
        { key: 'source', label: 'field.source', kind: 'source' },
        { key: 'on', label: 'field.leftOn', kind: 'col' },
        { key: 'how', label: 'field.how', kind: 'sel', options: JOINS }
      ],
      defaults: function (df) {
        var key = firstOtherSource(), other = key ? sourceFrame(key) : null;
        var common = df.columns.filter(function (c) { return other && other.has(c); });
        return { source: key, on: common.length ? common[0] : firstCol(df), how: 'left' };
      },
      apply: function (df, p) {
        var other = sourceFrame(p.source);
        if (!other) throw new Error(L('请选择另一张表（先在 01 数据里载入两张表）', 'Pick another table (load two tables in section 01 first)'));
        need(df, p.on);
        need(other, p.on);
        return df.join(other, p.on, p.how);
      },
      code: function (p) {
        return [
          'other = pd.read_csv("other.csv")   # 换成右表的读取代码',
          'df = df.join(other.set_index(' + quote(p.on) + '), on=' + quote(p.on) + ', how=' + quote(p.how) +
            ', rsuffix="_r")   # 按索引/键关联，等价于 merge 的便捷写法'
        ];
      }
    },
    {
      id: 'combine_first',
      fields: [
        { key: 'source', label: 'field.source', kind: 'source' },
        { key: 'on', label: 'field.leftOn', kind: 'col' }
      ],
      defaults: function (df) {
        var key = firstOtherSource(), other = key ? sourceFrame(key) : null;
        var common = df.columns.filter(function (c) { return other && other.has(c); });
        return { source: key, on: common.length ? common[0] : firstCol(df) };
      },
      apply: function (df, p) {
        var other = sourceFrame(p.source);
        if (!other) throw new Error(L('请选择另一张表（先在 01 数据里载入两张表）', 'Pick another table (load two tables in section 01 first)'));
        need(df, p.on);
        need(other, p.on);
        return df.combineFirst(other, p.on);
      },
      code: function (p) {
        return [
          'other = pd.read_csv("other.csv")   # 换成右表的读取代码',
          'df = (df.set_index(' + quote(p.on) + ').combine_first(other.set_index(' + quote(p.on) +
            ')).reset_index())   # 用右表补齐左表的缺失值（同名列合并，不新增 _x / _y）'
        ];
      }
    }
  ];

  /* op id → op 定义 */
  var OP_BY_ID = {};
  OPS.forEach(function (o) { OP_BY_ID[o.id] = o; });

  /* =========================================================
   * 一键预设：把「常见分析」编译成「步骤 + 图表编码」
   * 参数按当前表的列现算（换数据集照样能套），套完还能继续手动改。
   * ========================================================= */
  function cat0(df) { var c = df.categoryColumns(); return c.length ? c[0] : firstCol(df); }
  function cat1(df) { var c = df.categoryColumns(); return c.length > 1 ? c[1] : cat0(df); }
  function num0(df) { var n = df.numericColumns(); return n.length ? n[0] : firstCol(df); }
  function dateCol(df) {
    var hit = df.columns.filter(function (c) {
      return df.dtype(c) === 'datetime64[ns]' || /date|time|month|day/i.test(String(c));
    });
    return hit.length ? hit[0] : cat0(df);
  }
  var PRESETS = [
    {
      id: 'regionTop', chart: { type: 'bar', top: 8, order: 'value' },
      steps: [
        { op: 'groupby', params: function (df) { return { by: [cat0(df)], aggCol: num0(df), aggFunc: 'sum' }; } },
        { op: 'sort', params: function (df) { return { col: num0(df), desc: true }; } }
      ]
    },
    {
      id: 'trend', chart: { type: 'line', top: 12, agg: 'mean' },
      steps: [
        { op: 'groupby', params: function (df) { return { by: [dateCol(df)], aggCol: num0(df), aggFunc: 'mean' }; } }
      ]
    },
    {
      id: 'pivot', chart: { type: 'heatmap', agg: 'mean' },
      steps: [
        { op: 'pivot', params: function (df) {
          return { index: cat0(df), columns: cat1(df), values: num0(df), aggfunc: 'mean' };
        } }
      ]
    },
    {
      id: 'corr', chart: { type: 'heatmap' },
      steps: [{ op: 'corr', params: function () { return { cols: [] }; } }]
    },
    {
      id: 'topN', chart: { type: 'bar', top: 10, order: 'value' },
      steps: [
        { op: 'sort', params: function (df) { return { col: num0(df), desc: true }; } },
        { op: 'head', params: function () { return { n: 10 }; } }
      ]
    },
    {
      id: 'clean', chart: { type: 'histogram', bins: 20 },
      steps: [
        { op: 'dropna', params: function () { return { cols: [], how: 'any' }; } },
        { op: 'drop_duplicates', params: function () { return { cols: [] }; } }
      ]
    }
  ];
  function presetById(id) {
    var hit = null;
    PRESETS.forEach(function (p) { if (p.id === id) hit = p; });
    return hit;
  }
  /* 预设下拉：标签走词表，切语言时重建 */
  function renderPresetList() {
    var sel = $('preset-select');
    if (!sel) return;
    var cur = sel.value;
    clear(sel);
    PRESETS.forEach(function (p) { opt(sel, p.id, t('transform.preset.' + p.id)); });
    if (cur) sel.value = cur;
  }
  /* 套用预设：逐步算参数（每一步拿上一步的结果当输入），算不出的参数留给流水线标红 */
  function applyPreset(id) {
    var p = presetById(id);
    if (!p) return null;
    var frame = baseFrame();
    if (!frame.columns.length) { setStatus('pipe-status', t('transform.presetNoData'), 'warn'); return null; }
    var steps = [];
    p.steps.forEach(function (spec) {
      if (!OP_BY_ID[spec.op]) return;
      var st = newStep(spec.op, frame);
      if (spec.params) st.params = spec.params(frame) || st.params;
      steps.push(st);
      try {
        var after = OP_BY_ID[spec.op].apply(frame, st.params);
        if (after && after.columns) frame = after;
      } catch (e) { /* 参数不合法：交给 runPipeline 去标红，别在这里崩 */ }
    });
    S.steps = steps;
    if (p.chart) Object.keys(p.chart).forEach(function (k) { S.chart[k] = p.chart[k]; });
    S.page = 0;
    refreshAll();
    histPush('preset', true);
    setStatus('pipe-status', tf('transform.presetOk', { name: t('transform.preset.' + id) }), 'ok');
    return id;
  }
  function applyPresetFromSelect() {
    var sel = $('preset-select');
    return applyPreset(sel ? sel.value : '');
  }

  /* =========================================================
   * 流水线：步骤列表 → 依次 apply → S.result / S.stages
   * 某一步出错只把这一步标红，后面的步骤继续在上一个成功结果上算。
   * ========================================================= */
  function newStep(opId, frame) {
    var op = OP_BY_ID[opId];
    S.seq += 1;
    return { uid: 's' + S.seq, op: opId, params: op.defaults(frame || baseFrame()),
      error: null, rows: null, cols: null };
  }
  function runPipeline() {
    var frame = baseFrame(), stages = [];
    for (var i = 0; i < S.steps.length; i++) {
      var st = S.steps[i], op = OP_BY_ID[st.op];
      var before = frame, after = null;
      st.error = null;
      try {
        after = op.apply(before, st.params);
        if (!after || !after.columns) throw new Error(L('这一步没有返回表格', 'This step returned no table'));
      } catch (e) {
        st.error = (e && e.message) ? e.message : String(e);
      }
      if (st.error) { st.rows = null; st.cols = null; }
      else { st.rows = after.length; st.cols = after.columns.length; frame = after; }
      stages.push({ before: before, after: st.error ? null : after, error: st.error });
    }
    S.stages = stages;
    S.result = frame;
    /* 矩阵口径：cov 自带 _matrixKind，corr / describe 沿用各自的标记 */
    S.matrix = (frame && frame._matrixKind) ? frame._matrixKind
      : ((frame && frame._corrRowLabels) ? 'corr' : ((frame && frame._describeRows) ? 'describe' : null));
    return frame;
  }
  /* 第 i 步的输入帧（用于给新步骤算默认参数） */
  function stepInput(i) {
    if (i <= 0) return baseFrame();
    var s = S.stages[i - 1];
    return (s && (s.after || s.before)) || baseFrame();
  }

  /* =========================================================
   * 撤销 / 重做：给「步骤 + 图表编码 + 当前数据源」拍快照
   * 只在真的改了东西时入栈；连续拖同一个参数按 HIST_MERGE_MS 合并成一条。
   * ========================================================= */
  var HIST = { stack: [], pos: -1, kind: '', at: 0 };
  function stateOf() {
    var src = activeSource();
    return {
      key: src ? src.key : null,
      steps: JSON.parse(JSON.stringify(S.steps)),
      chart: JSON.parse(JSON.stringify(S.chart))
    };
  }
  function syncHistButtons() {
    var u = $('undo-btn'), r = $('redo-btn');
    if (u) u.disabled = HIST.pos <= 0;
    if (r) r.disabled = HIST.pos < 0 || HIST.pos >= HIST.stack.length - 1;
  }
  function histPush(kind, force) {
    kind = kind || 'edit';
    var now = Date.now();
    if (!force && HIST.pos >= 0 && kind === HIST.kind && now - HIST.at < HIST_MERGE_MS) {
      HIST.stack[HIST.pos] = stateOf();   /* 同一串连续改动只保留最后一份 */
      HIST.at = now;
      syncHistButtons();
      return;
    }
    HIST.stack = HIST.stack.slice(0, HIST.pos + 1);   /* 新的分支：砍掉旧的重做 */
    HIST.stack.push(stateOf());
    if (HIST.stack.length > HIST_LIMIT) HIST.stack.shift();
    HIST.pos = HIST.stack.length - 1;
    HIST.kind = kind;
    HIST.at = now;
    syncHistButtons();
  }
  function histReset() {
    HIST.stack = [];
    HIST.pos = -1;
    HIST.kind = '';
    HIST.at = 0;
    histPush('boot', true);
  }
  function histApply(st) {
    if (!st) return;
    S.steps = JSON.parse(JSON.stringify(st.steps));
    S.chart = JSON.parse(JSON.stringify(st.chart));
    if (st.key) {
      for (var i = 0; i < S.sources.length; i++) if (S.sources[i].key === st.key) S.active = i;
    }
    S.page = 0;
    refreshAll();
    syncHistButtons();   /* 撤销 / 重做后按钮的可用态要跟着栈位走 */
  }
  function undo() {
    if (HIST.pos <= 0) return 0;
    HIST.pos -= 1;
    histApply(HIST.stack[HIST.pos]);
    HIST.kind = '';
    HIST.at = 0;
    setStatus('pipe-status', tf('status.undo', { n: S.steps.length }), 'ok');
    return S.steps.length;
  }
  function redo() {
    if (HIST.pos < 0 || HIST.pos >= HIST.stack.length - 1) return 0;
    HIST.pos += 1;
    histApply(HIST.stack[HIST.pos]);
    HIST.kind = '';
    HIST.at = 0;
    setStatus('pipe-status', tf('status.redo', { n: S.steps.length }), 'ok');
    return S.steps.length;
  }

  /* =========================================================
   * 表格：columns + 行数组 → <table>
   * opts = { rowNo, limit, headCol }
   * ========================================================= */
  function tableFor(wrap, columns, rows, opts) {
    opts = opts || {};
    clear(wrap);
    if (!columns.length) {
      var e = el('p', 'card-note', wrap);
      e.textContent = t('table.empty');
      return null;
    }
    var table = el('table', 'table', wrap);
    var htr = el('tr', null, el('thead', null, table));
    if (opts.rowNo) {
      var th0 = el('th', 'table-idx', htr);
      th0.textContent = t('table.rowNo');
    }
    columns.forEach(function (c) {
      var th = el('th', null, htr);
      th.textContent = String(c);
      th.title = String(c);
    });
    var body = el('tbody', null, table);
    var limit = opts.limit == null ? rows.length : opts.limit;
    /* rows 是「要显示的那一段」，offset 只用来算行号（分页时第 2 页从 13 起） */
    var offset = opts.offset || 0;
    for (var r = 0; r < rows.length && r < limit; r++) {
      var tr = el('tr', null, body);
      if (opts.rowNo) {
        var td0 = el('td', 'table-idx', tr);
        td0.textContent = String(offset + r + 1);
      }
      for (var c2 = 0; c2 < columns.length; c2++) {
        var v = rows[r][c2];
        var td = el('td', null, tr);
        if (typeof v === 'number' && isFinite(v)) td.className = 'num';
        else if (typeof v === 'string' && v.length > 24) td.className = 'table-cell--wide';
        td.textContent = fmtCell(v);
      }
    }
    if (!opts.noNote && rows.length > limit) {
      var n = el('p', 'card-note', wrap);
      n.textContent = tf('table.truncated', { n: limit });
    }
    return table;
  }
  /* DataFrame → 行数组（[start, start+count) 区间）；records() 给的是行对象，表格要的是行数组 */
  function frameRowsAt(df, start, count) {
    if (!df || !df.columns.length) return [];
    var cols = df.columns.map(function (c) { return df.col(c); });
    var from = Math.max(0, start || 0);
    var to = count == null ? df.length : Math.min(df.length, from + count);
    var out = [];
    for (var r = from; r < to; r++) {
      var row = new Array(cols.length);
      for (var c = 0; c < cols.length; c++) row[c] = cols[c][r];
      out.push(row);
    }
    return out;
  }
  function frameRows(df, limit) { return frameRowsAt(df, 0, limit); }

  /* =========================================================
   * 数据源：内置数据集 / 文件 / 粘贴 / 网址
   * 载入新表会清空流水线（列名对不上时旧步骤没有意义）。
   * ========================================================= */
  var srcSeq = 0;
  function msgOf(e) { return (e && e.message) ? e.message : String(e); }
  function delimChar(v) { return { comma: ',', tab: '\t', semi: ';', pipe: '|' }[v] || null; }
  function currentDelim() {
    var sel = $('delim-select');
    return delimChar(sel ? sel.value : 'auto');
  }
  /* 只往列表里放一张表（不动步骤）：分享链接还原时要用 */
  function pushSource(kind, name, df, extra) {
    srcSeq += 1;
    var s = { key: 'src' + srcSeq, kind: kind, name: name, df: df, tag: '' };
    if (extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) s[k] = extra[k]; }
    S.sources.push(s);
    S.active = S.sources.length - 1;
    return s;
  }
  /* 换数据源：流水线清空（列名对不上时旧步骤没有意义），并记一条历史 */
  function addSource(kind, name, df, extra) {
    var s = pushSource(kind, name, df, extra);
    S.steps = [];
    S.chart.x = null; S.chart.y = []; S.chart.color = '__none__';
    S.page = 0;
    refreshAll();
    histPush('source', true);
    return s;
  }
  /* 内置数据集的显示名随语言变：切语言后按 id 重新取一次词条 */
  function sourceName(s) {
    if (!s) return '';
    if (s.kind === 'builtin' && s.id) {
      var d = null;
      DATA.lists.forEach(function (x) { if (x.id === s.id) d = x; });
      if (d) return I.pick(d.name);
    }
    return s.name;
  }

  /* 文本 → DataFrame（JSON 走 readJSON，其余按分隔符读 CSV/TSV） */
  function loadText(text, name, extra) {
    var raw = String(text == null ? '' : text).replace(/^\uFEFF/, '').trim();
    if (!raw) { setStatus('data-status', t('data.err.empty'), 'error'); return null; }
    var isJSON = /^[[{]/.test(raw);
    var df = null;
    try {
      df = isJSON ? PD.readJSON(raw) : PD.readCSV(raw, { delimiter: currentDelim() });
    } catch (e) {
      setStatus('data-status', tf('data.err.parse', { msg: msgOf(e) }), 'error');
      return null;
    }
    if (!df.columns.length) { setStatus('data-status', t('data.err.empty'), 'error'); return null; }
    /* 原始文本一并留下：分享链接要把它带回另一台机器 */
    var info = { kind: (extra && extra.kind) || 'paste' };
    if (extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) info[k] = extra[k]; }
    info.text = raw;
    var s = addSource(info.kind, name, df, info);
    setStatus('data-status', tf('data.ok', { name: name, rows: df.length, cols: df.columns.length }), 'ok');
    return s;
  }
  function loadBuiltin(id) {
    var d = null;
    DATA.lists.forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return;
    var df = null;
    try {
      df = PD.readCSV(d.build(), { delimiter: d.format === 'tsv' ? '\t' : ',' });
    } catch (e) {
      setStatus('data-status', tf('data.err.parse', { msg: msgOf(e) }), 'error');
      return;
    }
    var name = I.pick(d.name);
    addSource('builtin', name, df, { id: d.id, tag: name, fileName: d.id + (d.format === 'tsv' ? '.tsv' : '.csv') });
    setStatus('data-status', tf('data.ok', { name: name, rows: df.length, cols: df.columns.length }), 'ok');
  }
  function kindLabel(kind) {
    return { builtin: L('内置', 'built-in'), file: L('文件', 'file'),
      paste: L('粘贴', 'paste'), url: L('网址', 'url') }[kind] || kind;
  }
  function removeSource(i) {
    S.sources.splice(i, 1);
    if (S.active >= S.sources.length) S.active = S.sources.length - 1;
    if (S.active < 0) S.active = 0;
    S.steps = [];
    S.page = 0;
    refreshAll();
    histPush('source', true);
  }

  function renderDsList() {
    var wrap = $('ds-list');
    clear(wrap);
    var cur = activeSource();
    DATA.lists.forEach(function (d) {
      var b = el('button', 'ds-card', wrap);
      b.type = 'button';
      if (cur && cur.id === d.id) b.classList.add('is-on');
      b.appendChild(el('span', 'ds-name', null)).textContent = I.pick(d.name);
      b.appendChild(el('span', 'ds-desc', null)).textContent = I.pick(d.desc);
      b.addEventListener('click', function () { loadBuiltin(d.id); });
    });
  }

  function renderSources() {
    var wrap = $('src-list');
    clear(wrap);
    if (!S.sources.length) {
      var e = el('li', 'src-empty', wrap);
      e.textContent = t('data.sourcesEmpty');
      return;
    }
    S.sources.forEach(function (s, i) {
      var li = el('li', 'src-item', wrap);
      if (i === S.active) li.classList.add('is-on');
      var main = el('div', 'src-main', li);
      main.appendChild(el('span', 'src-name', null)).textContent = sourceName(s);
      var meta = el('span', 'src-meta', null);
      meta.textContent = s.df.length + ' × ' + s.df.shape()[1] + ' · ' + kindLabel(s.kind);
      main.appendChild(meta);
      var acts = el('div', 'src-acts', li);
      if (i === S.active) {
        var chip = el('span', 'chip chip--on', acts);
        chip.textContent = t('data.active');
      } else {
        var use = el('button', 'btn btn-ghost btn-sm', acts);
        use.type = 'button';
        use.textContent = t('data.use');
        use.addEventListener('click', function () {
          S.active = i; S.steps = [];
          S.chart.x = null; S.chart.y = []; S.chart.color = '__none__';
          S.page = 0;
          refreshAll();
          histPush('source', true);
        });
      }
      var rm = el('button', 'btn btn-ghost btn-sm', acts);
      rm.type = 'button';
      rm.textContent = t('common.remove');
      rm.addEventListener('click', function () { removeSource(i); });
    });
  }

  /* 预览（原始表）+ 列概览 */
  function renderPreview() {
    var df = baseFrame(), n = Math.min(S.display.maxRows, df.length);
    txt($('preview-chip'), df.length + ' × ' + df.shape()[1]);
    tableFor($('data-table'), df.columns, frameRows(df, S.display.maxRows), { rowNo: true });
    txt($('preview-note'), df.columns.length ? tf('data.previewNote', { n: n, total: df.length }) : '');
  }
  function fmtBytes(n) {
    var v = Number(n) || 0;
    if (v >= 1048576) return (v / 1048576).toFixed(2) + ' MB';
    if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
    return v + ' B';
  }
  /* =========================================================
   * 数据体检：dtypes + 缺失 + 唯一值 + 内存（memory_usage(deep=True)）
   * 对应 df.info() / df.memory_usage() / astype("category") 的省内存效果
   * ========================================================= */
  function renderHealth() {
    var wrap = $('health-table');
    if (!wrap) return;
    var df = baseFrame();
    var cols = [t('data.th.col'), t('data.th.dtype'), t('data.th.missing'), t('data.th.unique'),
      t('health.th.bytes'), t('health.th.catBytes')];
    if (!df.columns.length) {
      tableFor(wrap, cols, [], {});
      txt($('health-note'), '');
      return;
    }
    var mem = df.memoryUsage(), nulls = df.nullCounts();
    var rows = df.columns.map(function (c) {
      var m = mem.byCol[c] || { bytes: 0, categoryBytes: 0 };
      return [c, df.dtype(c), nulls[c] == null ? 0 : nulls[c], df.nunique(c),
        fmtBytes(m.bytes), fmtBytes(m.categoryBytes)];
    });
    tableFor(wrap, cols, rows, {});
    txt($('health-note'), tf('health.total', {
      total: fmtBytes(mem.total),
      saved: fmtBytes(Math.max(0, mem.total - mem.categoryTotal))
    }));
    var sel = $('health-maxrows'), prec = $('health-precision');
    if (sel) sel.value = String(S.display.maxRows);
    if (prec) prec.value = String(S.display.precision);
    txt($('health-option'), tf('health.setoption', { n: S.display.maxRows, p: S.display.precision }));
  }
  /* 显示设置 = pd.set_option("display.max_rows" / "display.precision", ...)：
     改完立刻反映到预览行数与数字精度（图表 / 表格 / 代码一起刷新） */
  function applyDisplay() {
    var sel = $('health-maxrows'), prec = $('health-precision');
    if (sel) S.display.maxRows = Math.max(5, Math.min(100, Number(sel.value) || PREVIEW_ROWS));
    if (prec) S.display.precision = Math.max(0, Math.min(6, Number(prec.value) || 3));
    renderPreview();
    renderHealth();
    renderResult();
    setStatus('data-status', tf('health.applied', { n: S.display.maxRows, p: S.display.precision }), 'ok');
    histPush('display', true);
  }
  function bindHealth() {
    var sel = $('health-maxrows'), prec = $('health-precision');
    if (sel) sel.addEventListener('change', applyDisplay);
    if (prec) prec.addEventListener('change', applyDisplay);
  }
  function renderProfile() {
    var df = baseFrame();
    var cols = [t('data.th.col'), t('data.th.dtype'), t('data.th.missing'), t('data.th.unique'),
      t('data.th.min'), t('data.th.max'), t('data.th.mean')];
    var nulls = df.nullCounts();
    var rows = df.columns.map(function (c) {
      var v = df.col(c), num = PD.isNumericType(df.dtype(c));
      return [
        c, df.dtype(c), nulls[c] == null ? 0 : nulls[c], df.nunique(c),
        num ? PD.stat.min(v) : '—', num ? PD.stat.max(v) : '—', num ? PD.stat.mean(v) : '—'
      ];
    });
    tableFor($('profile-table'), cols, rows, {});
  }

  /* 首屏实时指标：当前结果的行 / 列 / 步骤 / 数值列 / 类别列 / 缺失值 */
  function renderHeroStats() {
    var df = resultFrame();
    var nulls = df.nullCounts(), miss = 0;
    Object.keys(nulls).forEach(function (k) { miss += nulls[k]; });
    txt($('st-rows'), fmtNum(df.length));
    txt($('st-cols'), fmtNum(df.columns.length));
    txt($('st-steps'), fmtNum(S.steps.length));
    txt($('st-numeric'), fmtNum(df.numericColumns().length));
    txt($('st-category'), fmtNum(df.categoryColumns().length));
    txt($('st-missing'), fmtNum(miss));
    txt($('workbench-status'), S.steps.length ? tf('status.steps', { n: S.steps.length }) : t('status.ready'));
  }

  /* 数据面板整块刷新：数据集卡片 / 已载入列表 / 预览 / 列概览 / 数据体检 */
  function refreshData() {
    renderDsList();
    renderSources();
    renderPreview();
    renderProfile();
    renderHealth();
  }

  /* =========================================================
   * 变换面板：参数表单（按 op.fields 动态生成）+ 步骤卡片
   * field.kind：col 单列 · cols 多列 · num 数字 · text 文本 · sel 选项 · check 勾选 · source 另一张表
   * ========================================================= */
  function optionsFor(f, frame) {
    if (f.kind === 'source') return sourceOptions();
    if (f.kind === 'sel') return f.options || [];
    var cols = frame ? frame.columns.slice() : [];
    var out = cols.map(function (c) { return { value: c, raw: c }; });
    if (f.kind === 'col') out.unshift({ value: '', raw: t('transform.none') });
    return out;
  }
  function selectedValues(ctrl) {
    var out = [];
    for (var i = 0; i < ctrl.options.length; i++) if (ctrl.options[i].selected) out.push(ctrl.options[i].value);
    return out;
  }
  function renderFields(host, op, params, frame, onChange) {
    clear(host);
    if (!op.fields.length) {
      var e = el('p', 'field-hint', host);
      e.textContent = L('这个操作不需要参数：直接作用于整张表。', 'This operation takes no parameters: it applies to the whole table.');
      return;
    }
    op.fields.forEach(function (f) {
      if (f.visible && !f.visible(params)) return;
      var wrap = el('div', 'field', host);
      var id = 'f-' + op.id + '-' + f.key;
      var lab = el('label', 'field-label', wrap);
      lab.setAttribute('for', id);
      lab.textContent = t(f.label);
      var ctrl;
      if (f.kind === 'check') {
        var box = el('label', 'field-check', wrap);
        ctrl = el('input', null, box);
        ctrl.type = 'checkbox';
        ctrl.id = id;
        ctrl.checked = !!params[f.key];
        ctrl.addEventListener('change', function () { onChange(f.key, ctrl.checked, false); });
        return;
      }
      if (f.kind === 'num' || f.kind === 'text') {
        ctrl = el('input', 'field-input', wrap);
        ctrl.type = f.kind === 'num' ? 'number' : 'text';
        ctrl.id = id;
        if (f.min != null) ctrl.min = f.min;
        if (f.step != null) ctrl.step = f.step;
        ctrl.value = params[f.key] == null ? '' : String(params[f.key]);
        ctrl.addEventListener('input', function () { onChange(f.key, ctrl.value, false); });
        return;
      }
      ctrl = el('select', 'field-select', wrap);
      ctrl.id = id;
      if (f.kind === 'cols') {
        ctrl.multiple = true;
        ctrl.size = Math.max(4, Math.min(8, (frame ? frame.columns.length : 4) || 4));
        ctrl.setAttribute('aria-multiselectable', 'true');
      }
      optionsFor(f, frame).forEach(function (o) { opt(ctrl, o.value, optLabel(o)); });
      if (f.kind === 'cols') {
        var cur = picked(params[f.key]);
        for (var i = 0; i < ctrl.options.length; i++) {
          ctrl.options[i].selected = cur.indexOf(ctrl.options[i].value) !== -1;
        }
        ctrl.addEventListener('change', function () { onChange(f.key, selectedValues(ctrl), true); });
        var hint = el('p', 'field-hint', wrap);
        hint.textContent = t('field.multiselectHint');
        return;
      }
      ctrl.value = params[f.key] == null ? '' : String(params[f.key]);
      ctrl.addEventListener('change', function () { onChange(f.key, ctrl.value, true); });
    });
  }

  var pendingOp = 'filter';      /* 下拉框里当前选中的操作 */
  /* 下拉按 5 组归堆：<optgroup> 的 label 走词表（切语言时整体重建） */
  function renderOpSelect() {
    var sel = $('op-select');
    if (!sel) return;
    clear(sel);
    OP_GROUPS.forEach(function (g) {
      var list = OPS.filter(function (o) { return groupOf(o) === g; });
      if (!list.length) return;
      var box = document.createElement('optgroup');
      box.label = t('transform.group.' + g);
      list.forEach(function (o) { opt(box, o.id, t('op.' + o.id)); });
      sel.appendChild(box);
    });
    if (sel.querySelector('option[value="' + pendingOp + '"]')) sel.value = pendingOp;
    else pendingOp = sel.options.length ? sel.options[0].value : pendingOp;
    /* 下拉的 title 报出总数：52 种变换，一眼可见（自检与真机也按这个数字对齐） */
    sel.title = tf('transform.opCount', { n: OPS.length });
    renderOpDesc();
  }
  /* change 只绑一次（renderOpSelect 会重建选项，但 select 元素本身不变） */
  function bindOpSelect() {
    var sel = $('op-select');
    if (sel) sel.addEventListener('change', function () { pendingOp = sel.value; renderOpDesc(); });
  }
  function renderOpDesc() {
    var d = $('op-desc');
    if (!d) return;
    var desc = t('op.' + pendingOp + '.desc');
    d.textContent = desc;
  }

  /* ---------------- 步骤卡片 ---------------- */
  function syncNote(node, i) {
    var st = S.steps[i], stage = S.stages[i];
    if (!st || !stage) { txt(node, ''); return; }
    node.className = 'step-note';
    if (st.error) {
      node.classList.add('is-error');
      txt(node, tf('transform.error', { msg: st.error }));
      return;
    }
    var cols = stage.after ? stage.after.columns : [];
    var shown = cols.length > 8 ? cols.slice(0, 8).join(', ') + ' …' : cols.join(', ');
    var parts = [tf('transform.stepOk', { rows: st.rows, cols: st.cols })];
    if (cols.length) parts.push(tf('transform.colsOut', { cols: shown }));
    var dropped = (stage.before ? stage.before.length : 0) - (stage.after ? stage.after.length : 0);
    if (dropped > 0) parts.push(tf('transform.filtered', { n: dropped }));
    txt(node, parts.join(' · '));
  }
  function updateStepNotes() {
    var wrap = $('steps');
    if (!wrap) return;
    var nodes = wrap.querySelectorAll('.step-note');
    for (var i = 0; i < nodes.length; i++) syncNote(nodes[i], i);
  }
  function moveStep(i, d) {
    var j = i + d;
    if (j < 0 || j >= S.steps.length) return;
    var tmp = S.steps[i];
    S.steps[i] = S.steps[j];
    S.steps[j] = tmp;
    refreshPipe(true);
    histPush('steps', true);
  }
  function renderSteps() {
    var wrap = $('steps');
    clear(wrap);
    if (!S.steps.length) {
      var e = el('p', 'card-note steps-empty', wrap);
      e.textContent = t('transform.empty');
      return;
    }
    S.steps.forEach(function (st, i) {
      var op = OP_BY_ID[st.op];
      var card = el('div', 'step', wrap);
      card.setAttribute('data-uid', st.uid);
      if (st.error) card.classList.add('is-error');
      var head = el('div', 'step-head', card);
      txt(el('span', 'step-no', head), String(i + 1));
      txt(el('span', 'step-op', head), t('op.' + st.op));
      var acts = el('div', 'step-acts', head);
      var up = el('button', 'btn btn-ghost btn-sm', acts);
      up.type = 'button';
      up.textContent = '↑ ' + t('transform.up');
      up.disabled = i === 0;
      up.addEventListener('click', function () { moveStep(i, -1); });
      var down = el('button', 'btn btn-ghost btn-sm', acts);
      down.type = 'button';
      down.textContent = '↓ ' + t('transform.down');
      down.disabled = i === S.steps.length - 1;
      down.addEventListener('click', function () { moveStep(i, 1); });
      var rm = el('button', 'btn btn-ghost btn-sm', acts);
      rm.type = 'button';
      rm.textContent = '✕ ' + t('transform.remove');
      rm.addEventListener('click', function () {
        S.steps.splice(i, 1);
        refreshPipe(true);
        histPush('steps', true);
      });

      var body = el('div', 'step-body', card);
      renderFields(body, op, st.params, stepInput(i), function (key, value, rebuild) {
        st.params[key] = value;
        refreshPipe(!!rebuild);
        histPush('param');
      });
      syncNote(el('p', 'step-note', card), i);
    });
  }

  /* =========================================================
   * 结果：形状轨迹 + 表格
   * corr / describe 是「矩阵」：第一列放行标签（列名 / 统计量名）
   * ========================================================= */
  function matrixLabels(df) { return df._corrRowLabels || df._describeRows || null; }
  function matrixColumns(df) {
    var labels = matrixLabels(df);
    return labels ? [''].concat(df.columns.slice()) : df.columns.slice();
  }
  function matrixRowsAt(df, start, count) {
    var labels = matrixLabels(df);
    var rows = frameRowsAt(df, start, count);
    if (!labels) return rows;
    return rows.map(function (row, i) { return [labels[start + i]].concat(row); });
  }
  function matrixRows(df, limit) { return matrixRowsAt(df, 0, limit); }

  /* 结果表分页：总行数 > 每页行数时才露面（小表不占用界面） */
  function renderPager(total, pages, size, start) {
    var host = $('result-pager');
    if (!host) return;
    clear(host);
    if (pages <= 1) { host.classList.add('is-hidden'); return; }
    host.classList.remove('is-hidden');
    var prev = el('button', 'btn btn-ghost btn-sm pager-btn', host);
    prev.type = 'button';
    prev.id = 'result-prev';
    prev.textContent = '← ' + t('table.prev');
    prev.disabled = S.page <= 0;
    prev.addEventListener('click', function () { S.page -= 1; renderResult(); });
    var info = el('span', 'pager-info', host);
    info.textContent = tf('table.pageOf', { page: S.page + 1, total: pages }) + ' · ' +
      tf('table.rowsRange', { from: total ? start + 1 : 0, to: Math.min(total, start + size), total: total });
    var next = el('button', 'btn btn-ghost btn-sm pager-btn', host);
    next.type = 'button';
    next.id = 'result-next';
    next.textContent = t('table.next') + ' →';
    next.disabled = S.page >= pages - 1;
    next.addEventListener('click', function () { S.page += 1; renderResult(); });
    var sizeSel = el('select', 'field-select pager-select', host);
    sizeSel.id = 'result-page-size';
    sizeSel.setAttribute('aria-label', t('table.pageSize'));
    PAGE_SIZES.forEach(function (n) { opt(sizeSel, String(n), tf('table.pageSizeOption', { n: n })); });
    sizeSel.value = String(size);
    sizeSel.addEventListener('change', function () {
      S.pageSize = Number(sizeSel.value) || PREVIEW_ROWS;
      S.page = 0;
      renderResult();
    });
  }
  function renderResult() {
    var df = S.result || baseFrame();
    var labels = matrixLabels(df);
    txt($('result-shape'), tf('transform.shape', { rows: df.length, cols: df.columns.length }));
    renderShapeBox(df);
    var size = S.pageSize > 0 ? S.pageSize : PREVIEW_ROWS;
    var pages = Math.max(1, Math.ceil(df.length / size));
    if (S.page > pages - 1) S.page = pages - 1;
    if (S.page < 0) S.page = 0;
    var start = S.page * size;
    tableFor($('result-table'), matrixColumns(df), matrixRowsAt(df, start, size),
      { rowNo: true, offset: start, noNote: pages > 1 });
    renderPager(df.length, pages, size, start);
    var err = null;
    S.steps.forEach(function (st) { if (st.error && !err) err = st.error; });
    var note = '';
    if (err) note = tf('transform.error', { msg: err });
    else if (labels) note = t('chart.matrixNote');
    else if (df.columns.length) note = tf('transform.colsOut', { cols: df.columns.join(', ') });
    var idxCols = df.indexColumns ? df.indexColumns() : [];
    if (idxCols.length) note = (note ? note + ' · ' : '') + tf('transform.indexCols', { cols: idxCols.join(', ') });
    txt($('result-note'), note);
  }
  function renderShapeBox(df) {
    var wrap = $('shape-box');
    clear(wrap);
    var base = baseFrame();
    txt(el('p', 'shape-line', wrap), tf('transform.raw', { rows: base.length, cols: base.columns.length }));
    S.steps.forEach(function (st, i) {
      var p = el('p', 'shape-line', wrap);
      var head = (i + 1) + '. ' + t('op.' + st.op) + ' → ';
      if (st.error) {
        p.classList.add('is-error');
        txt(p, head + tf('transform.error', { msg: st.error }));
      } else {
        txt(p, head + tf('transform.stepOk', { rows: st.rows, cols: st.cols }));
      }
    });
    txt(el('p', 'shape-line shape-line--last', wrap),
      tf('transform.shape', { rows: df.length, cols: df.columns.length }));
  }

  /* 变换面板整块刷新（步骤列表重建 + 下面三块联动） */
  function refreshPipe(rebuild) {
    runPipeline();
    if (rebuild) renderSteps(); else updateStepNotes();
    renderResult();
    renderChart();
    renderStats();
    renderCode();
    renderHeroStats();
  }
  /* 数据 / 变换都变了的场合：全量重绘 */
  function refreshAll() {
    renderDataSafe();
    refreshPipe(true);
  }
  function renderDataSafe() {
    try { refreshData(); } catch (e) { /* 面板异常不影响主流程 */ }
  }
  /* 数据状态行也要跟着语言走：图表 / 代码状态在重绘时已刷新，这行得单独重写 */
  function renderDataStatus() {
    var s = activeSource();
    if (!s) { setStatus('data-status', t('status.ready')); return; }
    if (S.steps.length) { setStatus('data-status', tf('status.steps', { n: S.steps.length }), 'ok'); return; }
    setStatus('data-status', tf('data.ok', { name: sourceName(s), rows: s.df.length, cols: s.df.shape()[1] }), 'ok');
  }

  /* =========================================================
   * 图表：编码选项（按类型显示 / 隐藏）→ 数据 → PDCHARTS 渲染
   * 图表数据同时落到 S.chartData，供「图表数据」表与 CSV 导出复用。
   * ========================================================= */
  var CHART_WRAPS = {
    bar: ['chart-x-wrap', 'chart-y-wrap', 'chart-color-wrap', 'chart-agg-wrap', 'chart-top-wrap', 'chart-order-wrap'],
    line: ['chart-x-wrap', 'chart-y-wrap', 'chart-agg-wrap', 'chart-top-wrap', 'chart-order-wrap'],
    scatter: ['chart-x-wrap', 'chart-y-wrap', 'chart-color-wrap', 'chart-top-wrap'],
    histogram: ['chart-y-wrap', 'chart-bins-wrap'],
    box: ['chart-x-wrap', 'chart-y-wrap', 'chart-top-wrap'],
    heatmap: ['chart-x-wrap', 'chart-y-wrap', 'chart-agg-wrap', 'chart-order-wrap'],
    /* 新增 4 类：横向条形 / 面积 / 饼 / 核密度（df.plot 的 kind 全集补完） */
    barh: ['chart-x-wrap', 'chart-y-wrap', 'chart-color-wrap', 'chart-agg-wrap', 'chart-top-wrap', 'chart-order-wrap'],
    area: ['chart-x-wrap', 'chart-y-wrap', 'chart-agg-wrap', 'chart-top-wrap', 'chart-order-wrap'],
    pie: ['chart-x-wrap', 'chart-y-wrap', 'chart-agg-wrap', 'chart-top-wrap', 'chart-order-wrap'],
    kde: ['chart-y-wrap']
  };
  function allWraps() {
    return ['chart-x-wrap', 'chart-y-wrap', 'chart-color-wrap', 'chart-agg-wrap',
      'chart-top-wrap', 'chart-bins-wrap', 'chart-order-wrap'];
  }
  function safeNum(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function cmpLabel(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }
  function optList(values, noneLabel) {
    var out = values.map(function (v) { return { value: v, raw: v }; });
    if (noneLabel != null) out.unshift({ value: '__none__', raw: noneLabel });
    return out;
  }
  function fillSelect(sel, list, current, multiple) {
    clear(sel);
    list.forEach(function (o) { opt(sel, o.value, o.raw != null ? o.raw : optLabel(o)); });
    if (multiple) {
      var cur = picked(current);
      var any = false;
      for (var i = 0; i < sel.options.length; i++) {
        sel.options[i].selected = cur.indexOf(sel.options[i].value) !== -1;
        if (sel.options[i].selected) any = true;
      }
      if (!any && sel.options.length) sel.options[0].selected = true;
    } else {
      sel.value = current == null ? '' : String(current);
      if (sel.selectedIndex < 0 && sel.options.length) sel.selectedIndex = 0;
    }
  }
  function renderChartOptions() {
    var df = S.result || baseFrame();
    var cats = df.categoryColumns(), nums = df.numericColumns();
    var type = S.chart.type;
    allWraps().forEach(function (id) {
      var node = $(id);
      if (node) node.classList.toggle('is-hidden', CHART_WRAPS[type].indexOf(id) === -1);
    });
    txt($('chart-desc'), t('chart.desc.' + type));
    if (S.chart.x == null || df.columns.indexOf(S.chart.x) === -1) {
      S.chart.x = (type === 'scatter' ? (nums[0] || firstCol(df)) : (cats[0] || firstCol(df)));
    }
    var xs = type === 'scatter' ? optList(nums) : optList(cats.length ? cats : df.columns.slice(), null);
    fillSelect($('chart-x'), xs, S.chart.x, false);
    S.chart.x = $('chart-x').value;
    var ys = picked(S.chart.y).filter(function (c) { return df.columns.indexOf(c) !== -1; });
    S.chart.y = ys.length ? ys : (nums.length ? [nums[0]] : []);
    fillSelect($('chart-y'), optList(nums), S.chart.y, true);
    S.chart.y = selectedValues($('chart-y'));
    fillSelect($('chart-color'), optList(cats, t('transform.none')), S.chart.color, false);
    S.chart.color = $('chart-color').value;
    fillSelect($('chart-agg'), AGGS, S.chart.agg, false);
    S.chart.agg = $('chart-agg').value;
    fillSelect($('chart-order'), [
      { value: 'value', label: 'chart.orderValue' },
      { value: 'label', label: 'chart.orderLabel' },
      { value: 'raw', label: 'chart.orderRaw' }
    ], S.chart.order, false);
    S.chart.order = $('chart-order').value;
    var btns = $('chart-types') ? $('chart-types').querySelectorAll('button[data-type]') : [];
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-type') === type;
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      btns[i].classList.toggle('is-on', on);
    }
  }

  /* 按 x 分组聚合 → [{label, value}]（bar / line / heatmap 共用） */
  function groupAgg(df, xCol, yCol, agg, order, top) {
    var xv = df.col(xCol), yv = df.col(yCol);
    var keys = [], buckets = {}, seen = {};
    for (var i = 0; i < df.length; i++) {
      var k = isNA(xv[i]) ? '' : String(xv[i]);
      if (!seen[k]) { seen[k] = 1; keys.push(k); buckets[k] = []; }
      buckets[k].push(yv[i]);
    }
    var fn = PD.stat.agg(agg);
    var rows = keys.map(function (k) { return { label: k, value: fn(buckets[k]) }; });
    if (order === 'label') rows.sort(function (a, b) { return cmpLabel(a.label, b.label); });
    else if (order !== 'raw') rows.sort(function (a, b) { return safeNum(b.value) - safeNum(a.value); });
    var topN = Math.max(1, Number(top) || rows.length);
    if (rows.length > topN) rows = rows.slice(0, topN);
    return rows;
  }
  /* 类别 → 调色板序号（条形图按「着色列」上色） */
  function colorMapFor(df, xCol, colorCol) {
    var map = {}, paletteIdx = {}, n = 0;
    var xv = df.col(xCol), cv = df.col(colorCol);
    for (var i = 0; i < df.length; i++) {
      var k = isNA(xv[i]) ? '' : String(xv[i]);
      var v = isNA(cv[i]) ? null : String(cv[i]);
      if (v != null && paletteIdx[v] === undefined) paletteIdx[v] = n++;
      if (v != null && map[k] === undefined) map[k] = paletteIdx[v];
    }
    return { map: map, count: n };
  }
  function seriesColors() {
    var T = C.readTokens();
    return C.SERIES.map(function (k) { return T[k]; });
  }

  function buildSeries(type, df) {
    var nums = df.numericColumns();
    if (!nums.length) return { need: t('chart.needNumeric') };
    var x = S.chart.x;
    if (x == null || df.columns.indexOf(x) === -1) return { need: t('chart.needCategory') };
    var ys = picked(S.chart.y).filter(function (c) { return df.columns.indexOf(c) !== -1; });
    if (!ys.length) return { need: t('chart.needY') };
    ys = type === 'line' ? ys.slice(0, 3) : ys.slice(0, 1);
    var groups = groupAgg(df, x, ys[0], S.chart.agg, S.chart.order, S.chart.top);
    if (!groups.length) return { need: t('chart.empty') };

    if (type === 'bar') {
      var color = S.chart.color && S.chart.color !== '__none__' && df.has(S.chart.color)
        ? colorMapFor(df, x, S.chart.color) : null;
      var pal = color ? seriesColors() : null;
      var data = groups.map(function (g) {
        var idx = color && color.map[g.label] !== undefined ? color.map[g.label] : -1;
        return { label: g.label, value: safeNum(g.value),
          color: idx >= 0 && pal ? pal[idx % pal.length] : null };
      });
      return {
        type: 'bar',
        spec: { data: data, valueLabel: ys[0], fmtY: fmtNum,
          colorAt: function (d, T) { return d.color || T['--s-base']; } },
        data: { columns: [x, ys[0]], rows: groups.map(function (g) { return [g.label, g.value]; }) },
        note: tf('transform.shape', { rows: data.length, cols: 2 })
      };
    }
    /* line：每个 y 列一条线，共用同一批类别标签 */
    var keys = groups.map(function (g) { return g.label; });
    var series = ys.map(function (c) {
      var map = {};
      groupAgg(df, x, c, S.chart.agg, S.chart.order, S.chart.top)
        .forEach(function (g) { map[g.label] = g.value; });
      return { name: c, points: keys.map(function (k) {
        return { y: map[k] == null ? null : safeNum(map[k]) };
      }) };
    });
    var rows = keys.map(function (k, i) {
      var r = [k];
      series.forEach(function (s) { r.push(s.points[i].y); });
      return r;
    });
    return {
      type: 'line',
      spec: { series: series, xLabels: keys, xLabel: x, fmtY: fmtNum },
      data: { columns: [x].concat(ys), rows: rows },
      note: tf('transform.shape', { rows: rows.length, cols: ys.length + 1 })
    };
  }

  function buildScatter(df) {
    var nums = df.numericColumns();
    if (!nums.length) return { need: t('chart.needNumeric') };
    var x = S.chart.x;
    if (!x || df.columns.indexOf(x) === -1 || nums.indexOf(x) === -1) return { need: t('chart.needNumeric') };
    var ys = picked(S.chart.y).filter(function (c) { return nums.indexOf(c) !== -1; });
    var y = ys[0];
    if (!y) return { need: t('chart.needY') };
    var colorCol = (S.chart.color && S.chart.color !== '__none__' && df.categoryColumns().indexOf(S.chart.color) !== -1)
      ? S.chart.color : null;
    var topN = Math.max(1, Number(S.chart.top) || df.length);
    var xv = df.col(x), yv = df.col(y), cv = colorCol ? df.col(colorCol) : null;
    var groups = [], seen = {}, pts = [], rows = [];
    for (var i = 0; i < df.length; i++) {
      if (pts.length >= topN) break;
      if (isNA(xv[i]) || isNA(yv[i])) continue;
      var px = Number(xv[i]), py = Number(yv[i]);
      if (!isFinite(px) || !isFinite(py)) continue;
      var g = null;
      if (cv) {
        g = isNA(cv[i]) ? null : String(cv[i]);
        if (g != null && !seen[g]) { seen[g] = 1; groups.push(g); }
      }
      pts.push({ x: px, y: py, group: g, label: String(i + 1) });
      rows.push(cv ? [px, py, g] : [px, py]);
    }
    if (!pts.length) return { need: t('chart.empty') };
    return {
      type: 'scatter',
      spec: { points: pts, groups: groups, xLabel: x, yLabel: y, groupLabel: colorCol || '' },
      data: { columns: cv ? [x, y, colorCol] : [x, y], rows: rows },
      note: tf('transform.shape', { rows: rows.length, cols: cv ? 3 : 2 })
    };
  }

  function buildHistogram(df) {
    var nums = df.numericColumns();
    if (!nums.length) return { need: t('chart.needNumeric') };
    var ys = picked(S.chart.y).filter(function (c) { return nums.indexOf(c) !== -1; });
    var col = ys.length ? ys[0] : nums[0];
    if (!col) return { need: t('chart.needY') };
    var raw = df.col(col), vals = [];
    for (var i = 0; i < df.length; i++) {
      if (isNA(raw[i])) continue;
      var n = Number(raw[i]);
      if (isFinite(n)) vals.push(n);
    }
    if (!vals.length) return { need: t('chart.empty') };
    var bins = Math.max(3, Math.min(60, Math.round(Number(S.chart.bins) || 20)));
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx === mn) mx = mn + 1;
    var width = (mx - mn) / bins, counts = [];
    for (var b = 0; b < bins; b++) counts.push(0);
    vals.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - mn) / width))] += 1; });
    var rows = counts.map(function (c, k) {
      var lo = mn + width * k;
      return [fmtNum(lo) + ' ~ ' + fmtNum(lo + width), c];
    });
    return {
      type: 'histogram',
      spec: { values: vals, bins: bins, xLabel: col, countLabel: L('频数', 'count') },
      data: { columns: [L('区间', 'bin'), L('频数', 'count')], rows: rows },
      note: tf('transform.shape', { rows: vals.length, cols: 1 })
    };
  }

  function buildBox(df) {
    var nums = df.numericColumns();
    if (!nums.length) return { need: t('chart.needNumeric') };
    var ys = picked(S.chart.y).filter(function (c) { return nums.indexOf(c) !== -1; });
    var col = ys.length ? ys[0] : nums[0];
    if (!col) return { need: t('chart.needY') };
    var x = S.chart.x;
    var cat = (x && df.categoryColumns().indexOf(x) !== -1) ? x : null;
    var vals = df.col(col), cv = cat ? df.col(cat) : null;
    var order = [], buckets = {}, seen = {};
    for (var i = 0; i < df.length; i++) {
      if (isNA(vals[i])) continue;
      var n = Number(vals[i]);
      if (!isFinite(n)) continue;
      var k = cat ? (isNA(cv[i]) ? '' : String(cv[i])) : col;
      if (!seen[k]) { seen[k] = 1; order.push(k); buckets[k] = []; }
      buckets[k].push(n);
    }
    var st = PD.stat;
    var groups = order.map(function (k) { return { name: k, values: buckets[k] }; });
    if (S.chart.order === 'label') groups.sort(function (a, b) { return cmpLabel(a.name, b.name); });
    else if (S.chart.order === 'value') {
      groups.sort(function (a, b) { return st.quantile(b.values, 0.5) - st.quantile(a.values, 0.5); });
    }
    var topN = Math.max(1, Number(S.chart.top) || groups.length);
    if (groups.length > topN) groups = groups.slice(0, topN);
    if (!groups.length) return { need: t('chart.empty') };
    var rows = groups.map(function (g) {
      var v = g.values.slice().sort(function (a, b) { return a - b; });
      return [g.name, v.length, v[0], st.quantile(v, 0.25), st.quantile(v, 0.5), st.quantile(v, 0.75), v[v.length - 1]];
    });
    return {
      type: 'box',
      spec: { groups: groups },
      data: { columns: [cat || t('chart.series'), L('数量', 'n'), L('最小值', 'min'), 'Q1',
        L('中位数', 'median'), 'Q3', L('最大值', 'max')], rows: rows },
      note: tf('transform.shape', { rows: groups.length, cols: 7 })
    };
  }

  function buildHeatmap(df) {
    var labels = matrixLabels(df);
    if (labels) {
      var cols = df.columns.slice(), rows = labels.slice();
      var values = frameRows(df, df.length).map(function (r) {
        return r.map(function (v) {
          var n = Number(v);
          return (v == null || !isFinite(n)) ? null : n;
        });
      });
      var isCorr = S.matrix === 'corr';
      var out = rows.map(function (name, i) { return [name].concat(values[i]); });
      return {
        type: 'heatmap',
        spec: { rows: rows, cols: cols, values: values, valueLabel: L('值', 'value'),
          diverging: isCorr, min: isCorr ? -1 : null, max: isCorr ? 1 : null },
        data: { columns: [''].concat(cols), rows: out },
        note: isCorr ? t('chart.corrNote') : t('chart.matrixNote')
      };
    }
    var nums = df.numericColumns();
    if (!nums.length) return { need: t('chart.needNumeric') };
    var x = S.chart.x;
    if (!x || df.columns.indexOf(x) === -1) return { need: t('chart.needCategory') };
    var ys = picked(S.chart.y).filter(function (c) { return nums.indexOf(c) !== -1; }).slice(0, 8);
    if (!ys.length) return { need: t('chart.needY') };
    var keys = groupAgg(df, x, ys[0], S.chart.agg, S.chart.order, S.chart.top)
      .map(function (g) { return g.label; });
    if (!keys.length) return { need: t('chart.empty') };
    var maps = ys.map(function (c) {
      var m = {};
      groupAgg(df, x, c, S.chart.agg, S.chart.order, S.chart.top)
        .forEach(function (g) { m[g.label] = g.value; });
      return m;
    });
    var values = keys.map(function (k) {
      return maps.map(function (m) {
        var v = m[k];
        return (v == null || !isFinite(Number(v))) ? null : Number(v);
      });
    });
    return {
      type: 'heatmap',
      spec: { rows: keys, cols: ys, values: values, valueLabel: L('值', 'value') },
      data: { columns: [''].concat(ys), rows: keys.map(function (k, i) { return [k].concat(values[i]); }) },
      note: tf('transform.shape', { rows: keys.length, cols: ys.length })
    };
  }

  /* 横向条形 / 面积：与条形 / 折线共用同一份「图表数据」，只是画法不同 */
  function buildBarh(df) {
    var built = buildSeries('bar', df);
    if (built.need) return built;
    built.type = 'barh';
    return built;
  }
  function buildArea(df) {
    var built = buildSeries('line', df);
    if (built.need) return built;
    built.type = 'area';
    return built;
  }

  /* 饼图：类别 → 占比（df.plot(kind="pie")） */
  function buildPie(df) {
    var nums = df.numericColumns();
    if (!nums.length) return { need: t('chart.needNumeric') };
    var x = S.chart.x;
    if (!x || df.columns.indexOf(x) === -1) return { need: t('chart.needCategory') };
    var ys = picked(S.chart.y).filter(function (c) { return nums.indexOf(c) !== -1; });
    var col = ys.length ? ys[0] : nums[0];
    var rows = groupAgg(df, x, col, S.chart.agg, S.chart.order, S.chart.top)
      .filter(function (g) { return isFinite(safeNum(g.value)) && safeNum(g.value) > 0; });
    if (!rows.length) return { need: t('chart.empty') };
    var total = rows.reduce(function (a, g) { return a + safeNum(g.value); }, 0) || 1;
    return {
      type: 'pie',
      spec: { slices: rows.map(function (g) { return { label: g.label, value: safeNum(g.value) }; }),
        valueLabel: col, fmtV: fmtNum },
      data: { columns: [x, col, L('占比', 'share')],
        rows: rows.map(function (g) {
          return [g.label, g.value, (Math.round((safeNum(g.value) / total) * 1000) / 10) + '%'];
        }) },
      note: tf('transform.shape', { rows: rows.length, cols: 2 })
    };
  }

  /* 核密度：单列分布的平滑曲线（df.plot(kind="kde")，Silverman 带宽） */
  function buildKde(df) {
    var nums = df.numericColumns();
    if (!nums.length) return { need: t('chart.needNumeric') };
    var ys = picked(S.chart.y).filter(function (c) { return nums.indexOf(c) !== -1; });
    var col = ys.length ? ys[0] : nums[0];
    var raw = df.col(col), vals = [];
    for (var i = 0; i < df.length; i++) {
      if (isNA(raw[i])) continue;
      var n = Number(raw[i]);
      if (isFinite(n)) vals.push(n);
    }
    if (vals.length < 2) return { need: t('chart.empty') };
    var sd = PD.stat.std(vals, 1) || 1;
    var h = 1.06 * sd * Math.pow(vals.length, -0.2) || 1;
    var mn = Math.min.apply(null, vals) - h, mx = Math.max.apply(null, vals) + h;
    var steps = 60, grid = [], dens = [];
    for (var k = 0; k <= steps; k++) {
      var x = mn + (mx - mn) * (k / steps), sum = 0;
      for (var j = 0; j < vals.length; j++) {
        var u = (x - vals[j]) / h;
        sum += Math.exp(-0.5 * u * u);
      }
      grid.push(x);
      dens.push(sum / (vals.length * h * Math.sqrt(2 * Math.PI)));
    }
    return {
      type: 'kde',
      spec: { points: grid.map(function (gx, gi) { return { x: gx, y: dens[gi] }; }),
        xLabel: col, yLabel: L('密度', 'density'), fmtX: fmtNum, fmtY: fmtNum },
      data: { columns: [col, L('密度', 'density')],
        rows: grid.map(function (gx, gi) { return [gx, dens[gi]]; }) },
      note: tf('transform.shape', { rows: grid.length, cols: 2 })
    };
  }

  function buildChart(df) {
    var type = S.chart.type;
    if (type === 'heatmap') return buildHeatmap(df);
    if (type === 'histogram') return buildHistogram(df);
    if (type === 'scatter') return buildScatter(df);
    if (type === 'box') return buildBox(df);
    if (type === 'barh') return buildBarh(df);
    if (type === 'area') return buildArea(df);
    if (type === 'pie') return buildPie(df);
    if (type === 'kde') return buildKde(df);
    return buildSeries(type, df);
  }

  function renderChart() {
    var box = $('chart-box');
    if (!box) return;
    var df = S.result || baseFrame();
    renderChartOptions();
    if (df.length > PIPE_LIMIT) {
      clear(box);
      txt(el('p', 'card-note chart-empty', box), t('chart.noChart'));
      S.chartData = null;
      tableFor($('chart-table'), [], []);
      txt($('chart-note'), '');
      setStatus('chart-status', t('chart.noChart'), 'warn');
      return;
    }
    var built;
    try { built = buildChart(df); }
    catch (e) { built = { need: tf('chart.renderError', { msg: msgOf(e) }) }; }
    clear(box);
    if (built.need) {
      txt(el('p', 'card-note chart-empty', box), built.need);
      S.chartData = null;
      tableFor($('chart-table'), [], []);
      txt($('chart-note'), '');
      setStatus('chart-status', built.need, 'warn');
      return;
    }
    try {
      C[built.type](box, built.spec);
    } catch (e) {
      var msg = tf('chart.renderError', { msg: msgOf(e) });
      txt(el('p', 'card-note chart-empty', box), msg);
      setStatus('chart-status', msg, 'error');
      return;
    }
    S.chartData = built.data || null;
    if (S.chartData) {
      tableFor($('chart-table'), S.chartData.columns, S.chartData.rows, { rowNo: true, limit: PREVIEW_ROWS });
    } else {
      tableFor($('chart-table'), [], []);
    }
    txt($('chart-note'), built.note || '');
    setStatus('chart-status', built.note ? built.note : t('chart.out'));
  }

  /* =========================================================
   * 描述统计（第 ④ 节下方）：对「当前结果」跑一次 df.describe()
   * ========================================================= */
  function renderStats() {
    var wrap = $('stats-table');
    if (!wrap) return;
    var df = S.result || baseFrame();
    if (!df.columns.length) { tableFor(wrap, [], []); return; }
    var out = null;
    try { out = df.describe(); } catch (e) { out = null; }
    if (!out || !out.columns.length) { tableFor(wrap, [], []); return; }
    tableFor(wrap, matrixColumns(out), matrixRows(out, out.length), {});
  }

  /* =========================================================
   * pandas 代码生成：读取 → 变换（逐步对应）→ 绘图 → 导出
   * 列名 / API 一律英文；注释跟着语言走。
   * ========================================================= */
  var codeCache = '';
  function sourcePyLines(src) {
    var out = [];
    if (!src) return ['df = pd.DataFrame()'];
    /* 内置数据集在代码里用「与数据集 id 同名」的 CSV：前端也是按 id + 扩展名导出的 */
    var base = (src.kind === 'builtin' && src.id) ? src.id : String(src.name || 'data');
    var file = safeName(base.replace(/\.(csv|tsv|txt|json)$/i, '')) + '.csv';
    if (src.kind === 'url' && src.url) {
      out.push('df = pd.read_csv(' + quote(src.url) + ')');
    } else if (src.kind === 'builtin') {
      out.push('# ' + L('内置数据集在前端按固定随机种子生成；此处假定已导出为同名 CSV。',
        'the built-in dataset is generated in the browser from a fixed seed; assumed exported as CSV with the same name.'));
      out.push('df = pd.read_csv(' + quote(file) + ')');
    } else {
      var sep = src.delim && src.delim !== ',' ? ', sep=' + quote(src.delim) : '';
      out.push('df = pd.read_csv(' + quote(src.fileName || file) + sep + ')');
    }
    return out;
  }
  /* 图：与页面上那张图读同一份「图表数据」，能直接跑 */
  function chartCodeLines() {
    var c = S.chart, d = S.chartData;
    var out = [];
    out.push('fig, ax = plt.subplots(figsize=(9, 5))');
    if (!d || !d.columns.length) {
      out.push('# ' + t('chart.noChart'));
      out.push('plt.close(fig)');
      return out;
    }
    var x = c.x, y = picked(c.y), agg = c.agg;
    var aggMethod = agg === 'nunique' ? 'nunique' : agg;
    if (c.type === 'bar') {
      var y0 = y.length ? y[0] : (resultFrame().columns[resultFrame().columns.length - 1] || '');
      out.push('ax = df.groupby(' + quote(x) + ')' + '[' + quote(y0) + ']' + '.' + aggMethod + '()' +
        '.sort_values(ascending=False).head(' + (Number(c.top) || 12) + ').plot(kind="bar", ax=ax)');
      out.push('ax.set_xlabel(' + quote(x) + '); ax.set_ylabel(' + quote(y0) + ')');
    } else if (c.type === 'line') {
      out.push('ax = df.groupby(' + quote(x) + ')' + list(y.slice(0, 3)) + '.' + aggMethod + '()' +
        '.head(' + (Number(c.top) || 12) + ').plot(kind="line", ax=ax)');
      out.push('ax.set_xlabel(' + quote(x) + ')');
    } else if (c.type === 'scatter') {
      out.push('ax.scatter(df[' + quote(x) + '], df[' + quote(y[0]) + '], alpha=0.75)');
      out.push('ax.set_xlabel(' + quote(x) + '); ax.set_ylabel(' + quote(y[0]) + ')');
    } else if (c.type === 'histogram') {
      out.push('df[' + quote(y[0] || d.columns[0]) + '].plot(kind="hist", bins=' +
        (Number(c.bins) || 20) + ', ax=ax)');
    } else if (c.type === 'box') {
      if (x) out.push('df.boxplot(column=' + quote(y[0]) + ', by=' + quote(x) + ', ax=ax)');
      else out.push('df[' + quote(y[0]) + '].plot(kind="box", ax=ax)');
      out.push('ax.set_title(' + quote((x || '') + ' · ' + y[0]) + ')');
    } else {
      out.push('piv = df.corr(numeric_only=True)');
      out.push('im = ax.imshow(piv, cmap="coolwarm", vmin=-1, vmax=1)');
      out.push('ax.set_xticks(range(len(piv.columns))); ax.set_xticklabels(piv.columns, rotation=45, ha="right")');
      out.push('ax.set_yticks(range(len(piv.index))); ax.set_yticklabels(piv.index)');
      out.push('fig.colorbar(im, ax=ax)');
    }
    out.push('fig.tight_layout()');
    out.push('fig.savefig(' + quote(S.chartName + '-chart.png') + ', dpi=150)');
    return out;
  }
  function buildCode() {
    var lines = [];
    lines.push('# ' + t('code.read'));
    lines.push('import pandas as pd');
    lines.push('import matplotlib.pyplot as plt');
    sourcePyLines(activeSource()).forEach(function (l) { lines.push(l); });
    lines.push('');
    lines.push('# ' + t('code.transform'));
    if (!S.steps.length) {
      lines.push('# ' + t('code.noSteps'));
    } else {
      S.steps.forEach(function (st, i) {
        var op = OP_BY_ID[st.op];
        lines.push('# [' + (i + 1) + '] ' + t('op.' + st.op));
        var body = [];
        try { body = op.code(st.params) || []; } catch (e) { body = ['# ' + msgOf(e)]; }
        body.forEach(function (l) { lines.push(l); });
        if (st.error) lines.push('# ' + tf('transform.error', { msg: st.error }));
      });
    }
    lines.push('');
    lines.push('# ' + t('code.chart'));
    chartCodeLines().forEach(function (l) { lines.push(l); });
    lines.push('');
    lines.push('# ' + t('code.export'));
    lines.push('df.to_csv(' + quote(S.chartName + '-result.csv') + ', index=False)');
    return lines.join('\n');
  }
  function renderCode() {
    var src = activeSource();
    /* 导出文件名前缀：内置数据集用数据集 id（与代码里 pd.read_csv("sales.csv") 同名），
       其余用数据源文件名去掉扩展名。 */
    var base = (src && src.kind === 'builtin' && src.id) ? src.id : (src ? (src.fileName || src.name) : 'result');
    S.chartName = safeName(String(base).replace(/\.(csv|tsv|txt|json)$/i, '')) || 'result';
    codeCache = buildCode();
    txt($('code-text'), codeCache);
    var errs = 0;
    S.steps.forEach(function (st) { if (st.error) errs += 1; });
    setStatus('code-status', errs
      ? tf('transform.error', { msg: L(errs + ' 个步骤有错，已在代码里用注释标出', errs + ' step(s) failed; marked with comments') })
      : (S.steps.length ? tf('status.steps', { n: S.steps.length }) : t('code.noSteps')));
  }

  /* =========================================================
   * 导出：结果 CSV / JSON、图表数据 CSV、图 PNG / SVG
   * 全部在本地拼字符串与 Blob，不经过任何服务器。
   * ========================================================= */
  function csvCell(v) {
    if (v == null) return '';
    var s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(columns, rows) {
    var lines = [columns.map(csvCell).join(',')];
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }
  /* 当前结果 → {columns, rows}（矩阵结果带上第一列行标签） */
  function resultTable() {
    var df = S.result || baseFrame();
    var labels = matrixLabels(df);
    return {
      columns: labels ? matrixColumns(df) : df.columns.slice(),
      rows: labels ? matrixRows(df, df.length) : frameRows(df, df.length)
    };
  }
  function exportResultCSV() {
    var tb = resultTable();
    if (!tb.columns.length) { setStatus('data-status', t('table.empty'), 'warn'); return; }
    var name = S.chartName + '-result.csv';
    download(name, toCSV(tb.columns, tb.rows), 'text/csv;charset=utf-8');
    setStatus('data-status', tf('data.ok', { name: name, rows: tb.rows.length, cols: tb.columns.length }), 'ok');
  }
  function exportResultJSON() {
    var tb = resultTable();
    if (!tb.columns.length) { setStatus('data-status', t('table.empty'), 'warn'); return; }
    var out = tb.rows.map(function (r) {
      var o = {};
      tb.columns.forEach(function (c, i) {
        o[String(c) === '' ? 'index' : String(c)] = isNA(r[i]) ? null : r[i];
      });
      return o;
    });
    var name = S.chartName + '-result.json';
    download(name, JSON.stringify(out, null, 2), 'application/json;charset=utf-8');
    setStatus('data-status', tf('data.ok', { name: name, rows: out.length, cols: tb.columns.length }), 'ok');
  }
  /* 结果 → HTML 表格（df.to_html() 的产物，可直接贴进网页 / Word / 邮件） */
  function exportResultHTML() {
    var df = resultFrame();
    if (!df.columns.length) { setStatus('data-status', t('table.empty'), 'warn'); return; }
    var name = S.chartName + '-result.html';
    var doc = '<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="utf-8">\n<title>' +
      S.chartName + ' · to_html()</title>\n<style>table{border-collapse:collapse}' +
      'th,td{border:1px solid #ccc;padding:4px 8px;font:13px/1.5 ui-sans-serif,sans-serif}</style>' +
      '\n</head><body>\n' + df.toHTML() + '\n</body></html>\n';
    download(name, doc, 'text/html;charset=utf-8');
    setStatus('data-status', tf('data.ok', { name: name, rows: df.length, cols: df.columns.length }), 'ok');
  }
  /* 结果 → SQL 建表 + INSERT（df.to_sql 的等价物，可贴进数据库客户端） */
  function exportResultSQL() {
    var df = resultFrame();
    if (!df.columns.length) { setStatus('data-status', t('table.empty'), 'warn'); return; }
    var name = S.chartName + '-result.sql';
    download(name, df.toSQL(safeName(S.chartName), 100), 'text/plain;charset=utf-8');
    setStatus('data-status', tf('data.ok', { name: name, rows: df.length, cols: df.columns.length }), 'ok');
  }
  /* 结果 → TSV 复制到剪贴板（与 pd.read_clipboard() / read_csv(sep="\t") 配对） */
  function copyResultTsv() {
    var df = resultFrame();
    if (!df.columns.length) { setStatus('data-status', t('table.empty'), 'warn'); return; }
    copyText(df.toTSV(), 'data-status', 'data.copied', 'data.copyFail');
  }
  function exportChartCSV() {
    var d = S.chartData;
    if (!d || !d.columns.length) { setStatus('chart-status', t('chart.noChart'), 'warn'); return; }
    var cols = d.columns.map(function (c) { return c === '' ? L('索引', 'index') : c; });
    var name = S.chartName + '-chart-' + S.chart.type + '.csv';
    download(name, toCSV(cols, d.rows), 'text/csv;charset=utf-8');
    setStatus('chart-status', tf('chart.exported', { name: name }), 'ok');
  }

  /* 图表导出用的内联样式：SVG 脱离页面后仍保留配色与字号 */
  function exportCss() {
    var T = C.readTokens();
    return 'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      '.pd-tick{font-size:11px;fill:' + T['--c-text-soft'] + '}' +
      '.pd-legend{font-size:11px;fill:' + T['--c-text-soft'] + '}' +
      '.pd-axis-label{font-size:12px;fill:' + T['--c-text-soft'] + '}' +
      '.pd-heatval{font-size:10px;fill:' + T['--c-text'] + '}' +
      '.pd-empty{font-size:28px;fill:' + T['--c-muted'] + '}';
  }
  function chartSVG() {
    var box = $('chart-box');
    var svg = box ? box.querySelector('svg') : null;
    if (!svg) return null;
    var vb = String(svg.getAttribute('viewBox') || '0 0 720 400').split(/[\s,]+/);
    var w = Math.round(parseFloat(vb[2]) || 720), h = Math.round(parseFloat(vb[3]) || 400);
    var clone = svg.cloneNode(true);
    var T = C.readTokens();
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    clone.setAttribute('style', 'background:' + T['--c-surface']);
    var style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = exportCss();
    clone.insertBefore(style, clone.firstChild);
    return {
      markup: '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone),
      w: w, h: h
    };
  }
  function exportChartSVG() {
    var info = chartSVG();
    if (!info) { setStatus('chart-status', t('chart.noChart'), 'warn'); return; }
    var name = S.chartName + '-chart.svg';
    download(name, info.markup, 'image/svg+xml;charset=utf-8');
    setStatus('chart-status', tf('chart.exported', { name: name }), 'ok');
  }

  function exportChartPNG() {
    var info = chartSVG();
    if (!info) { setStatus('chart-status', t('chart.noChart'), 'warn'); return; }
    var T = C.readTokens();
    var name = S.chartName + '-chart.png';
    var url = URL.createObjectURL(new Blob([info.markup], { type: 'image/svg+xml;charset=utf-8' }));
    var img = new Image();
    img.onload = function () {
      var scale = 2, canvas = document.createElement('canvas');
      canvas.width = info.w * scale;
      canvas.height = info.h * scale;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = T['--c-surface'];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      if (canvas.toBlob) {
        canvas.toBlob(function (b) {
          if (b) { downloadBlob(name, b); setStatus('chart-status', tf('chart.exported', { name: name }), 'ok'); }
          else setStatus('chart-status', t('chart.exportFail'), 'error');
        }, 'image/png');
      } else {
        setStatus('chart-status', t('chart.exportFail'), 'error');
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus('chart-status', t('chart.exportFail'), 'error');
    };
    img.src = url;
  }
  /* .py：与代码框里的内容完全一致 */
  function exportCode() {
    if (!codeCache) renderCode();
    var name = S.chartName + '-pandas.py';
    download(name, codeCache, 'text/x-python;charset=utf-8');
    setStatus('code-status', tf('code.exported', { name: name }));
  }
  function copyCode() {
    if (!codeCache) renderCode();
    function done() { setStatus('code-status', t('code.copied'), 'ok'); }
    function fail() { setStatus('code-status', t('code.copyFail'), 'error'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codeCache).then(done, fail);
      return;
    }
    /* 老浏览器兜底：选中 <pre> 里的文本再 execCommand */
    try {
      var range = document.createRange();
      range.selectNodeContents($('code-text'));
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      if (document.execCommand('copy')) done(); else fail();
      sel.removeAllRanges();
    } catch (e) { fail(); }
  }

  /* =========================================================
   * 剪贴板：结果 CSV / Markdown 表格 / 分享链接共用一套写入逻辑
   * 先试 navigator.clipboard；被拒绝（老浏览器 / http / 无权限）再退回 execCommand。
   * ========================================================= */
  function legacyCopy(text, done, fail) {
    try {
      var ta = el('textarea', 'sr-only', document.body);
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      if (ok) done(); else fail();
    } catch (e) { fail(); }
  }
  function clipboardWrite(text, done, fail) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done, fail); });
      return;
    }
    legacyCopy(text, done, fail);
  }
  /* 复制反馈：一定会有结论（剪贴板 Promise 万一不回，800ms 后按失败处理） */
  function copyText(text, statusId, okKey, failKey) {
    var settled = false;
    function done() { if (settled) return; settled = true; setStatus(statusId, t(okKey), 'ok'); }
    function fail() { if (settled) return; settled = true; setStatus(statusId, t(failKey || 'data.copyFail'), 'error'); }
    setTimeout(fail, 800);
    clipboardWrite(text, done, fail);
  }
  /* 结果 → Markdown 表格（竖线转义；单元格格式与页面上那张表一致） */
  function toMarkdown(columns, rows) {
    function cell(v) { return fmtCell(v).replace(/\|/g, '\\|'); }
    var lines = [];
    lines.push('| ' + columns.map(cell).join(' | ') + ' |');
    lines.push('| ' + columns.map(function () { return '---'; }).join(' | ') + ' |');
    rows.forEach(function (r) { lines.push('| ' + r.map(cell).join(' | ') + ' |'); });
    return lines.join('\n') + '\n';
  }
  function copyResultCSV() {
    var tb = resultTable();
    if (!tb.columns.length) { setStatus('data-status', t('table.empty'), 'warn'); return; }
    copyText(toCSV(tb.columns, tb.rows), 'data-status', 'data.copied', 'data.copyFail');
  }
  function copyResultMarkdown() {
    var tb = resultTable();
    if (!tb.columns.length) { setStatus('data-status', t('table.empty'), 'warn'); return; }
    copyText(toMarkdown(tb.columns, tb.rows), 'data-status', 'data.copied', 'data.copyFail');
  }

  /* =========================================================
   * 分享链接：#pd=<base64(JSON)>，只装「还原得出来」的最小信息
   *   内置数据集记 id；自建数据连原始文本一起带走（太长就不给链接，劝去导出 CSV）
   * ========================================================= */
  function shareData() {
    var src = activeSource();
    var out = {
      v: 1, lang: I.lang, chart: S.chart,
      steps: S.steps.map(function (st) { return { op: st.op, params: st.params }; })
    };
    if (src) {
      if (src.kind === 'builtin' && src.id) out.src = { kind: 'builtin', id: src.id };
      else out.src = { kind: src.kind, name: src.name, fileName: src.fileName, url: src.url, text: src.text };
    }
    return out;
  }
  function b64enc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/=+$/, ''); }
  function b64dec(s) { return decodeURIComponent(escape(atob(s))); }
  function shareLink() {
    var json = JSON.stringify(shareData());
    if (json.length > SHARE_LIMIT) {
      setStatus('pipe-status', tf('transform.shareTooBig', { n: SHARE_LIMIT }), 'warn');
      return '';
    }
    var frag = '#pd=' + b64enc(json);
    var url = location.href.split('#')[0] + frag;
    try { history.replaceState(null, '', frag); } catch (e) { /* file:// 下被拒也没关系 */ }
    copyText(url, 'pipe-status', 'transform.shareOk', 'transform.shareFail');
    return url;
  }
  /* 打开带 #pd= 的链接时还原：数据源 + 步骤 + 图表编码（+ 语言） */
  function restoreShared() {
    var m = /(?:^#|&)pd=([A-Za-z0-9+/=_-]+)/.exec(location.hash || '');
    if (!m) return false;
    var data = null;
    try { data = JSON.parse(b64dec(m[1])); } catch (e) { data = null; }
    if (!data || !data.steps) { setStatus('data-status', t('transform.shareBroken'), 'warn'); return false; }
    var src = data.src, df = null;
    if (src && src.kind === 'builtin' && src.id) {
      DATA.lists.forEach(function (x) {
        if (x.id !== src.id) return;
        try { df = PD.readCSV(x.build(), { delimiter: x.format === 'tsv' ? '\t' : ',' }); } catch (e) { df = null; }
        if (df) pushSource('builtin', I.pick(x.name), df,
          { id: x.id, tag: I.pick(x.name), fileName: x.id + (x.format === 'tsv' ? '.tsv' : '.csv') });
      });
    } else if (src && src.text) {
      try {
        df = /^[[{]/.test(src.text) ? PD.readJSON(src.text) : PD.readCSV(src.text, { delimiter: currentDelim() });
      } catch (e) { df = null; }
      if (df) pushSource(src.kind || 'paste', src.name || 'shared', df,
        { fileName: src.fileName, url: src.url, text: src.text });
    }
    if (!df || !df.columns.length) { setStatus('data-status', t('transform.shareNoData'), 'warn'); return false; }
    S.steps = (data.steps || []).filter(function (st) { return !!OP_BY_ID[st.op]; }).map(function (st) {
      S.seq += 1;
      return { uid: 's' + S.seq, op: st.op, params: st.params || {}, error: null, rows: null, cols: null };
    });
    if (data.chart) Object.keys(data.chart).forEach(function (k) { S.chart[k] = data.chart[k]; });
    if (data.lang === 'zh' || data.lang === 'en') I.setLang(data.lang, true);
    S.page = 0;
    refreshAll();
    setStatus('data-status', tf('transform.shareRestored', { rows: df.length, cols: df.columns.length }), 'ok');
    return true;
  }

  /* =========================================================
   * 交互装配：把控件挂上事件，再灌入默认数据集
   * 数据源四口（内置 / 文件 / 粘贴 / 网址）→ 变换 → 图表 → 导出，
   * 任一处改动都重算一下游，保证「表格 / 图 / 代码」三处始终一致。
   * ========================================================= */
  var MAX_PASTE_CHARS = 4000000;   /* 粘贴框上限：约 4MB 文本，挡住误贴大文件 */

  /* ---------- 数据源 · 本地文件 ---------- */
  function loadFile(file) {
    if (!file) return;
    var name = file.name || 'data.csv';
    txt($('file-name'), name);
    if (name.toLowerCase().indexOf('.json') < 0 && /\.(csv|tsv|txt)$/i.test(name)) {
      /* 有扩展名时顺手把分隔符选择器对齐，用户仍可手动改回「自动嗅探」 */
      var sel = $('delim-select');
      if (sel && sel.value === 'auto') {
        sel.value = /\.tsv$/i.test(name) ? 'tab' : 'auto';
      }
    }
    var reader = new FileReader();
    reader.onload = function () {
      loadText(String(reader.result || ''), name, { kind: 'file', fileName: name });
    };
    reader.onerror = function () {
      setStatus('data-status', tf('data.err.fetch',
        { msg: L('浏览器读不出这个文件', 'the browser could not read this file') }), 'error');
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ---------- 数据源 · 网址（fetch + CORS） ---------- */
  function loadURL() {
    var input = $('url-input');
    var url = input ? String(input.value || '').trim() : '';
    if (!url) { setStatus('data-status', t('data.err.urlEmpty'), 'error'); if (input) input.focus(); return; }
    setStatus('data-status', t('status.busy'));
    fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
        return res.text();
      })
      .then(function (text) {
        var tail = url.split('#')[0].split('?')[0].split('/').pop() || 'remote.csv';
        var name = tail;
        try { name = decodeURIComponent(tail); } catch (e) { name = tail; }
        loadText(text, name, { kind: 'url', url: url, fileName: name });
      })
      ['catch'](function (e) {
        setStatus('data-status', tf('data.err.fetch', { msg: msgOf(e) }), 'error');
      });
  }

  /* ---------- 数据源 · 粘贴 ---------- */
  function loadPaste() {
    var area = $('paste-area');
    var text = area ? area.value : '';
    if (!String(text).trim()) { setStatus('data-status', t('data.err.empty'), 'error'); return; }
    if (text.length > MAX_PASTE_CHARS) { setStatus('data-status', t('data.err.empty'), 'error'); return; }
    loadText(text, L('粘贴的数据', 'pasted data'), { kind: 'paste', fileName: 'pasted.csv' });
  }

  function bindSourceIO() {
    var fileInput = $('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        loadFile(fileInput.files && fileInput.files[0]);
        /* 同一个文件再选一次也要触发 change */
        fileInput.value = '';
      });
    }
    var pasteBtn = $('paste-btn');
    if (pasteBtn) pasteBtn.addEventListener('click', loadPaste);
    var urlBtn = $('url-btn');
    if (urlBtn) urlBtn.addEventListener('click', loadURL);
    var urlInput = $('url-input');
    if (urlInput) {
      urlInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); loadURL(); }
      });
    }
    /* 「粘贴」里的 Ctrl/⌘+Enter 直接解析，省一次鼠标 */
    var area = $('paste-area');
    if (area) {
      area.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.keyCode === 13)) {
          e.preventDefault();
          loadPaste();
        }
      });
    }
    var delim = $('delim-select');
    if (delim) {
      delim.addEventListener('change', function () {
        var o = delim.options[delim.selectedIndex];
        setStatus('data-status', t('data.delimiter') + '：' + (o ? o.textContent : ''));
      });
    }
  }

  /* ---------- 变换：添加 / 清空步骤 ---------- */
  function addStep() {
    var opId = pendingOp || (OPS.length ? OPS[0].id : null);
    if (!opId || !OP_BY_ID[opId]) return;
    S.steps.push(newStep(opId, stepInput(S.steps.length)));
    refreshPipe(true);
    histPush('steps', true);
    var last = $('steps') ? $('steps').querySelectorAll('.step') : [];
    if (last.length) {
      var node = last[last.length - 1];
      if (node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
      var first = node.querySelector('.field-select, .field-input');
      if (first && first.focus) first.focus();
    }
  }
  function resetSteps() {
    if (!S.steps.length) { setStatus('data-status', t('transform.empty')); return; }
    S.steps = [];
    S.page = 0;
    refreshPipe(true);
    histPush('steps', true);
  }

  /* ---------- 图表：类型按钮 + 编码控件 ---------- */
  function bindChart() {
    var types = $('chart-types');
    if (types) {
      types.addEventListener('click', function (e) {
        var t2 = e.target;
        while (t2 && t2 !== types && !(t2.getAttribute && t2.getAttribute('data-type'))) t2 = t2.parentNode;
        if (!t2 || t2 === types) return;
        var type = t2.getAttribute('data-type');
        if (!type || !CHART_WRAPS[type] || type === S.chart.type) return;
        S.chart.type = type;
        renderChart();
        histPush('chart', true);
      });
    }
    /* 每个编码控件：改值 → 写回 S.chart → 重画（图表数据表 / 代码同步刷新） */
    var setters = {
      'chart-x': function (v) { S.chart.x = v; },
      'chart-y': function () { S.chart.y = selectedValues($('chart-y')); },
      'chart-color': function (v) { S.chart.color = v; },
      'chart-agg': function (v) { S.chart.agg = v; },
      'chart-order': function (v) { S.chart.order = v; },
      'chart-top': function (v) { S.chart.top = Math.max(1, Math.min(MAX_CHART_ROWS, Number(v) || 12)); },
      'chart-bins': function (v) { S.chart.bins = Math.max(3, Math.min(MAX_CHART_ROWS, Number(v) || 20)); }
    };
    Object.keys(setters).forEach(function (id) {
      var node = $(id);
      if (!node) return;
      var fire = function () { setters[id](node.value); renderChart(); renderCode(); histPush('chart'); };
      node.addEventListener('change', fire);
      if (node.type === 'number') node.addEventListener('input', fire);
    });
  }

  /* ---------- 导出 / 复制 / 下载 ---------- */
  function bindActions() {
    var clicks = {
      'export-csv': exportResultCSV,
      'export-json': exportResultJSON,
      'export-html': exportResultHTML,
      'export-sql': exportResultSQL,
      'export-chart-csv': exportChartCSV,
      'export-svg': exportChartSVG,
      'export-png': exportChartPNG,
      'code-copy': copyCode,
      'code-download': exportCode,
      'copy-csv': copyResultCSV,
      'copy-md': copyResultMarkdown,
      'copy-tsv': copyResultTsv,
      'undo-btn': undo,
      'redo-btn': redo,
      'share-btn': shareLink,
      'preset-apply': applyPresetFromSelect
    };
    Object.keys(clicks).forEach(function (id) {
      var node = $(id);
      if (node) node.addEventListener('click', clicks[id]);
    });
    var add = $('op-add');
    if (add) add.addEventListener('click', addStep);
    var reset = $('steps-reset');
    if (reset) reset.addEventListener('click', resetSteps);
    syncHistButtons();
  }

  /* ---------- 顶栏：移动端导航 / 阅读进度 / 回到顶部 ---------- */
  function closeNav(nav, btn) {
    if (!nav) return;
    nav.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function bindChrome() {
    var nav = $('site-nav'), navBtn = $('nav-toggle');
    if (navBtn && nav) {
      navBtn.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.addEventListener('click', function (e) {
        var n = e.target;
        while (n && n !== nav && !(n.className && String(n.className).indexOf('nav-link') >= 0)) n = n.parentNode;
        if (n && n !== nav) closeNav(nav, navBtn);
      });
      /* Esc 收起（键盘用户） */
      document.addEventListener('keydown', function (e) {
        if ((e.key === 'Escape' || e.keyCode === 27) && nav.classList.contains('is-open')) {
          closeNav(nav, navBtn);
          navBtn.focus();
        }
      });
    }
    /* 撤销 / 重做的键盘入口：Ctrl/⌘+Z 撤销、Ctrl/⌘+Shift+Z（或 Ctrl+Y）重做。
       光标在输入框里时让浏览器自己处理，别抢用户正在打的字。 */
    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var key = String(e.key || '').toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      var node = e.target;
      var tag = (node && node.tagName) ? String(node.tagName).toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (key === 'y' || e.shiftKey) redo(); else undo();
    });
    var top = $('to-top');
    if (top) {
      top.addEventListener('click', function () {
        if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
        else window.scrollTo(0, 0);
      });
    }
    var bar = $('readbar'), ticking = false;
    function paint() {
      ticking = false;
      if (!bar) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      if (window.requestAnimationFrame) window.requestAnimationFrame(paint);
      else paint();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    paint();
  }

  function seed() {
    var first = null;
    DATA.lists.forEach(function (d) { if (first === null && d.default) first = d; });
    if (first) loadBuiltin(first.id);
    else refreshAll();
  }
  function init() {
    bindOpSelect();      /* change 只绑一次：选项之后会被 renderOpSelect 重建 */
    renderOpSelect();
    renderPresetList();  /* 预设下拉的文案走词表：切语言时会重建 */
    bindSourceIO();
    bindChart();
    bindActions();
    bindChrome();
    bindHealth();        /* 数据体检里的两个显示选项 */
    /* 切语言：i18n.js 已把静态文案刷成本地语言，这里把动态面板整体重绘 */
    document.addEventListener('langchange', function () {
      renderOpSelect();
      renderPresetList();
      refreshAll();
      renderDataStatus();
    });
    if (!restoreShared()) seed();   /* 带 #pd= 的链接优先：先还原，没有再灌默认数据集 */
    histReset();                    /* 起点单独记一条：撤销按钮一开始必须是灰的 */
    syncHistButtons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

}());
