/* =========================================================
 * pandas.js —— 浏览器里的「迷你 pandas」引擎
 * ---------------------------------------------------------
 * 目标：把 pandas 的核心概念（DataFrame / Series / dtype /
 *       索引 / 分组聚合）在纯前端复刻成可视化工具。
 * 约束：零依赖（不引 pandas.js / arquero / Danfo），
 *       只用原生 JS 实现，方便离线运行与教学讲解。
 *
 * 命名对齐 pandas，方便把每个操作翻译成一行代码：
 *   head / tail / shape / dtypes / describe / sort_values /
 *   query / drop / rename / astype / assign / groupby /
 *   agg / pivot_table / crosstab / corr / value_counts /
 *   dropna / fillna / drop_duplicates / merge / concat
 * ========================================================= */
window.PD = (function () {
  'use strict';

  /* ---------------- dtype 常量（键名与 pandas 打印一致） ---------------- */
  var DT = {
    INT: 'int64',
    FLOAT: 'float64',
    BOOL: 'bool',
    DATETIME: 'datetime64[ns]',
    STR: 'object',
    CATEGORY: 'category'
  };
  function isNumericType(t) { return t === DT.INT || t === DT.FLOAT; }
  function isMissing(v) {
    return v === null || v === undefined || v === '' ||
      (typeof v === 'number' && isNaN(v));
  }

  /* ---------------- 标量解析：把 CSV 字符串还原成数字 / 布尔 / 日期 ---------------- */
  var BOOL_TRUE = { 'true': 1, 'yes': 1, 'y': 1, 't': 1 };
  var BOOL_FALSE = { 'false': 1, 'no': 1, 'n': 1, 'f': 1 };
  function parseScalar(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (s === '') return null;
    if (s === 'NA' || s === 'NaN' || s === 'null' || s === 'None' || s === 'N/A') return null;
    /* 数字：整数 / 小数 / 科学计数 / 千分位 */
    if (/^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
      var n = Number(s.split(',').join(''));
      if (!isNaN(n)) return n;
    }
    var lo = s.toLowerCase();
    if (BOOL_TRUE[lo]) return true;
    if (BOOL_FALSE[lo]) return false;
    return String(raw).trim();
  }

  function isNumericStr(s) {
    if (typeof s === 'number') return true;
    return /^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?([eE][+-]?\d+)?$/.test(String(s).trim());
  }

  /* ---------------- dtype 推断：整列扫一遍，按「最弱类型」收敛 ---------------- */
  function inferType(values) {
    var seenNum = false, seenInt = false, seenBool = false, seenStr = false, seenDate = false, n = 0;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (isMissing(v)) continue;
      n++;
      if (typeof v === 'boolean') { seenBool = true; continue; }
      if (typeof v === 'number') {
        seenNum = true;
        if (Number.isInteger(v)) seenInt = true;
        continue;
      }
      var s = String(v);
      if (isNumericStr(s)) { seenNum = true; if (/^[+-]?\d+$/.test(s.trim())) seenInt = true; continue; }
      if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?/.test(s)) { seenDate = true; continue; }
      seenStr = true;
    }
    if (n === 0) return DT.STR;
    if (seenStr) return DT.STR;
    if (seenDate && !seenNum) return DT.DATETIME;
    if (seenBool && !seenNum) return DT.BOOL;
    if (seenNum) return (seenInt && !seenBool) ? DT.INT : DT.FLOAT;
    return DT.STR;
  }

  /* ---------------- CSV 解析（引号包裹 / 转义 / CRLF / 分隔符嗅探） ---------------- */
  function sniffDelimiter(text) {
    var sample = text.slice(0, 4000).split(/\r?\n/).slice(0, 5).join('\n');
    var cands = [',', '\t', ';', '|'];
    var best = ',', bestScore = -1;
    for (var i = 0; i < cands.length; i++) {
      var d = cands[i];
      var lines = sample.split(/\r?\n/).filter(function (l) { return l.length; });
      if (!lines.length) continue;
      var counts = lines.map(function (l) { return l.split(d).length; });
      var first = counts[0];
      var stable = counts.every(function (c) { return c === first; });
      var score = (stable ? 1000 : 0) + first;   /* 字段数稳定者优先 */
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  function splitCSVLine(line, delim) {
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === delim) {
        out.push(cur); cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function readCSV(text, opts) {
    opts = opts || {};
    var delim = opts.delimiter || sniffDelimiter(text);
    var lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) return DataFrame.empty();
    var header, start = 0, i, c;
    if (opts.header === false) {
      header = splitCSVLine(lines[0], delim).map(function (_, k) { return 'col' + k; });
    } else {
      header = splitCSVLine(lines[0], delim).map(function (h, k) {
        h = h.trim();
        return h === '' ? 'col' + k : h;
      });
      start = 1;
    }
    /* 重名列自动去重（pandas 也会把重复列名变成 a、a.1） */
    var seen = {}, cols = {};
    header = header.map(function (h) {
      if (seen[h]) { var k = 2; while (seen[h + '.' + k]) k++; h = h + '.' + k; }
      seen[h] = 1; cols[h] = []; return h;
    });
    for (var r = start; r < lines.length; r++) {
      if (!lines[r].trim()) continue;
      var cells = splitCSVLine(lines[r], delim);
      for (i = 0; i < header.length; i++) {
        c = cells[i];
        cols[header[i]].push(c === undefined || c === '' ? null : parseScalar(c));
      }
    }
    return new DataFrame(header, cols);
  }

  function readJSON(textOrObj) {
    var obj = typeof textOrObj === 'string' ? JSON.parse(textOrObj) : textOrObj;
    if (Array.isArray(obj)) return fromRecords(obj);
    if (obj && Array.isArray(obj.data)) return fromRecords(obj.data);
    if (obj && Array.isArray(obj.rows)) return fromRecords(obj.rows);
    if (obj && typeof obj === 'object') return fromRecords([obj]);
    return DataFrame.empty();
  }

  /* 从「对象数组」构造，列名取所有键的并集（保持首次出现顺序） */
  function fromRecords(records) {
    var cols = [], seen = {};
    records.forEach(function (rec) {
      Object.keys(rec || {}).forEach(function (k) {
        if (!seen[k]) { seen[k] = 1; cols.push(k); }
      });
    });
    var data = {};
    cols.forEach(function (k) {
      data[k] = records.map(function (rec) {
        var v = rec ? rec[k] : null;
        return (v === undefined || v === null) ? null : v;
      });
    });
    return new DataFrame(cols, data);
  }

  /* =========================================================
   * Series 级统计：与 pandas 同名，输入是一列值数组
   * 统一约定：缺失值被跳过（等价 skipna=True）
   * ========================================================= */
  function numsOf(values) {
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (isMissing(v)) continue;
      var n = typeof v === 'number' ? v : Number(v);
      if (!isNaN(n)) out.push(n);
    }
    return out;
  }
  function sCount(values) { var c = 0; for (var i = 0; i < values.length; i++) if (!isMissing(values[i])) c++; return c; }
  function sSum(values) { return numsOf(values).reduce(function (a, b) { return a + b; }, 0); }
  function sMean(values) { var n = numsOf(values); return n.length ? sSum(n) / n.length : NaN; }
  function sMin(values) { var n = numsOf(values); return n.length ? Math.min.apply(null, n) : NaN; }
  function sMax(values) { var n = numsOf(values); return n.length ? Math.max.apply(null, n) : NaN; }
  function sVar(values, ddof) {
    var n = numsOf(values); if (n.length <= (ddof || 0)) return NaN;
    var m = sMean(n);
    var ss = n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0);
    return ss / (n.length - (ddof || 0));
  }
  function sStd(values, ddof) { return Math.sqrt(sVar(values, ddof === undefined ? 1 : ddof)); }
  function sMedian(values) { return quantile(values, 0.5); }
  function quantile(values, q) {
    var n = numsOf(values).sort(function (a, b) { return a - b; });
    if (!n.length) return NaN;
    var pos = (n.length - 1) * q, base = Math.floor(pos), rest = pos - base;
    return n[base + 1] !== undefined ? n[base] + rest * (n[base + 1] - n[base]) : n[base];
  }

  /* 聚合函数表：UI 下拉、groupby、pivot 都从这里取，保证口径一致 */
  var AGG = {
    sum: function (v) { return sSum(v); },
    mean: function (v) { return sMean(v); },
    median: function (v) { return sMedian(v); },
    min: function (v) { return sMin(v); },
    max: function (v) { return sMax(v); },
    std: function (v) { return sStd(v, 1); },
    var: function (v) { return sVar(v, 1); },
    count: function (v) { return sCount(v); },
    nunique: function (v) { return sNunique(v); },
    first: function (v) { for (var i = 0; i < v.length; i++) if (!isMissing(v[i])) return v[i]; return null; },
    last: function (v) { for (var i = v.length - 1; i >= 0; i--) if (!isMissing(v[i])) return v[i]; return null; }
  };
  function aggFn(name) { return AGG[name] || AGG.count; }

  function sNunique(values) {
    var set = {}, c = 0;
    for (var i = 0; i < values.length; i++) {
      var v = values[i]; if (isMissing(v)) continue;
      var k = typeof v + ':' + String(v);
      if (!set[k]) { set[k] = 1; c++; }
    }
    return c;
  }
  function uniqueValues(values) {
    var set = {}, out = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i]; if (isMissing(v)) continue;
      var k = typeof v + ':' + String(v);
      if (!set[k]) { set[k] = 1; out.push(v); }
    }
    return out;
  }

  function compareValues(a, b) {
    var am = isMissing(a), bm = isMissing(b);
    if (am && bm) return 0;
    if (am) return 1;      /* 缺失值排最后，与 pandas na_position='last' 一致 */
    if (bm) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    var na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0);
  }
  function modeOf(values) {
    var vc = {}, best = null, bestN = 0;
    for (var i = 0; i < values.length; i++) {
      var v = values[i]; if (isMissing(v)) continue;
      var k = String(v); vc[k] = (vc[k] || 0) + 1;
      if (vc[k] > bestN) { bestN = vc[k]; best = v; }
    }
    return best;
  }
  function prevValue(values, i) {
    for (var k = i; k >= 0; k--) if (!isMissing(values[k])) return values[k];
    return null;
  }
  function castValue(v, type) {
    if (isMissing(v)) return null;
    if (type === DT.INT) { var n = Math.trunc(Number(String(v).split(',').join(''))); return isNaN(n) ? null : n; }
    if (type === DT.FLOAT) { var f = Number(String(v).split(',').join('')); return isNaN(f) ? null : f; }
    if (type === DT.BOOL) { var lo = String(v).toLowerCase(); return BOOL_TRUE[lo] ? true : (BOOL_FALSE[lo] ? false : Boolean(v)); }
    if (type === DT.STR) return String(v);
    return v;
  }
  function groupKey(rowValues) {
    return rowValues.map(function (v) { return isMissing(v) ? '\u0000NA' : typeof v + ':' + String(v); }).join('\u0001');
  }

  /* ---------------- 查询表达式：df.query("a > 1 and b == 'x'") 的迷你实现 ----------------
     支持 and / or 连接、六种比较符；列名与字面量都可带引号。不含括号与 not，够教学演示。 */
  function parseQueryTerm(raw) {
    var s = String(raw == null ? '' : raw).trim();
    var m = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(s);
    if (!m) return null;
    function unquote(x) {
      x = x.trim();
      if (x.length > 1 && ((x[0] === '"' && x[x.length - 1] === '"') || (x[0] === "'" && x[x.length - 1] === "'"))) {
        return x.slice(1, -1);
      }
      return x;
    }
    return { col: unquote(m[1]), op: m[2], want: parseScalar(unquote(m[3])) };
  }
  function testQueryTerm(term, value) {
    if (isMissing(value)) return false;
    var a = value, b = term.want;
    if (!(typeof a === 'number' && typeof b === 'number')) { a = String(a); b = (b == null ? '' : String(b)); }
    if (term.op === '==') return a === b;
    if (term.op === '!=') return a !== b;
    if (term.op === '>') return a > b;
    if (term.op === '>=') return a >= b;
    if (term.op === '<') return a < b;
    if (term.op === '<=') return a <= b;
    return false;
  }

  /* ---------------- 确定性伪随机（sample 用）：同 seed 永远抽同一批行 ---------------- */
  function seededRng(seed) {
    var s = (seed == null || seed === '' ? 42 : Number(seed)) | 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 日期解析 / 成分提取（to_datetime、resample、dt.* 共用） ---------------- */
  function toDate(v) {
    if (isMissing(v)) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getTime());
    var s = String(v).trim();
    var m = /^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] || 1),
        Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) {
    if (!d) return null;
    var base = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    var hasTime = d.getHours() || d.getMinutes() || d.getSeconds();
    return hasTime ? base + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) : base;
  }
  /* 一周从周一开始（与 pandas 的 dt.weekday 一致：Monday=0） */
  function isoWeekday(d) { return (d.getDay() + 6) % 7; }
  function isoWeek(d) {
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() - isoWeekday(t) + 3);          /* 本周周四 */
    var firstThu = new Date(t.getFullYear(), 0, 4);
    firstThu.setDate(firstThu.getDate() - isoWeekday(firstThu) + 3);
    return 1 + Math.round((t - firstThu) / 604800000);
  }
  /* 频率码 → 分桶键：D 日 / W 周 / M 月 / Q 季 / Y 年（与 pandas 的 resample 别名对应） */
  function bucketKey(d, freq) {
    if (!d) return null;
    if (freq === 'W') return d.getFullYear() + '-W' + pad2(isoWeek(d));
    if (freq === 'M') return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    if (freq === 'Q') return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
    if (freq === 'Y') return String(d.getFullYear());
    return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  function datePartValue(d, part) {
    if (!d) return null;
    if (part === 'year') return d.getFullYear();
    if (part === 'quarter') return Math.floor(d.getMonth() / 3) + 1;
    if (part === 'month') return d.getMonth() + 1;
    if (part === 'day') return d.getDate();
    if (part === 'weekday') return isoWeekday(d);
    if (part === 'week') return isoWeek(d);
    return isoDate(d);
  }

  /* ---------------- 内存估算（df.memory_usage(deep=True) 的口径，单位字节） ---------------- */
  function strBytes(v) { return isMissing(v) ? 0 : String(v).length * 2 + 8; }   /* UTF-16 字 + 对象头 */
  function colBytes(df, name, asCategory) {
    var v = df.data[name] || [], t = df.dtype(name), n = v.length, i, sum = 0;
    if (t === DT.CATEGORY) {
      var keys = {}, k = 0;
      for (i = 0; i < n; i++) { var kk = String(v[i]); if (!keys[kk]) { keys[kk] = 1; k++; } }
      return n * 8 + k * 8;                                   /* 编码数组 + 类别目录 */
    }
    if (asCategory && t !== DT.DATETIME) {
      var seen = {}, cat = 0, itemBytes = 0;
      for (i = 0; i < n; i++) {
        var key = typeof v[i] + ':' + String(v[i]);
        if (!seen[key]) { seen[key] = 1; cat++; itemBytes += (typeof v[i] === 'number' ? 8 : strBytes(v[i])); }
      }
      return n * 8 + cat * 8 + itemBytes;
    }
    if (t === DT.BOOL) return n;
    if (t === DT.INT || t === DT.FLOAT || t === DT.DATETIME) return n * 8;
    for (i = 0; i < n; i++) sum += strBytes(v[i]);
    return n * 8 + sum;
  }

  /* ---------------- HTML 表格解析（read_html）：纯正则，无 DOM 也能跑 ---------------- */
  function stripTags(s) {
    return String(s).replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
  }
  function readHTML(text, opts) {
    opts = opts || {};
    var html = String(text || '');
    var tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
    var wanted = tables[opts.tableIndex || 0];
    if (!wanted) return DataFrame.empty();
    var rows = wanted.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    var matrix = rows.map(function (tr) {
      var cells = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
      return cells.map(stripTags);
    }).filter(function (r) { return r.length; });
    if (!matrix.length) return DataFrame.empty();
    var header = matrix[0].map(function (h, i) { return h === '' ? 'col' + i : h; });
    var seen = {}, cols = {};
    header = header.map(function (h) {
      if (seen[h]) { var k = 2; while (seen[h + '.' + k]) k++; h = h + '.' + k; }
      seen[h] = 1; cols[h] = []; return h;
    });
    for (var r = 1; r < matrix.length; r++) {
      for (var c = 0; c < header.length; c++) {
        var cell = matrix[r][c];
        cols[header[c]].push(cell === undefined || cell === '' ? null : parseScalar(cell));
      }
    }
    return new DataFrame(header, cols);
  }

  /* ---------------- 分组：by 列 → {keys: [[k...]], rows: [[行号...]]}（transform / filter / rolling 共用） ---------------- */
  function groupRows(df, by) {
    var map = {}, keys = [], rows = [];
    for (var r = 0; r < df.length; r++) {
      var kv = by.map(function (c) { return df.data[c][r]; });
      var k = groupKey(kv);
      if (map[k] === undefined) { map[k] = keys.length; keys.push(kv); rows.push([]); }
      rows[map[k]].push(r);
    }
    return { keys: keys, rows: rows };
  }
  function nonMissing(nums) {
    var out = [];
    for (var i = 0; i < nums.length; i++) if (!isMissing(nums[i])) out.push(nums[i]);
    return out;
  }

  /* =========================================================
   * DataFrame —— 列存（column-major），和 pandas 的 Block 结构同理
   * ========================================================= */
  function DataFrame(columns, data) {
    this.columns = columns.slice();
    this.data = {};
    for (var i = 0; i < columns.length; i++) {
      this.data[columns[i]] = (data[columns[i]] || []).slice();
    }
    this.length = columns.length ? this.data[columns[0]].length : 0;
  }
  DataFrame.empty = function () { return new DataFrame([], {}); };

  DataFrame.prototype = {
    /* ---- 元信息：df.shape / df.dtypes / df.columns ---- */
    shape: function () { return [this.length, this.columns.length]; },
    dtype: function (name) {
      if (this._cat && this._cat[name]) return DT.CATEGORY;
      return inferType(this.data[name] || []);
    },
    dtypes: function () {
      var out = {};
      for (var i = 0; i < this.columns.length; i++) out[this.columns[i]] = this.dtype(this.columns[i]);
      return out;
    },
    numericColumns: function () {
      var self = this;
      return this.columns.filter(function (c) { return isNumericType(self.dtype(c)); });
    },
    categoryColumns: function () {
      var self = this;
      return this.columns.filter(function (c) { return !isNumericType(self.dtype(c)); });
    },
    col: function (name) { return this.data[name] || []; },
    has: function (name) { return this.columns.indexOf(name) !== -1; },
    nullCounts: function () {
      var out = {};
      for (var i = 0; i < this.columns.length; i++) {
        var v = this.data[this.columns[i]], c = 0;
        for (var r = 0; r < v.length; r++) if (isMissing(v[r])) c++;
        out[this.columns[i]] = c;
      }
      return out;
    },
    clone: function () {
      var df = new DataFrame(this.columns, this.data);
      if (this._cat) df._cat = JSON.parse(JSON.stringify(this._cat));
      if (this._indexCols) df._indexCols = this._indexCols.slice();
      return df;
    },
    /* 索引列标记：set_index 之后，工作台把索引当「不能编辑的首列」展示 */
    indexColumns: function () { return this._indexCols ? this._indexCols.slice() : []; },
    categoryMap: function () { return this._cat ? JSON.parse(JSON.stringify(this._cat)) : {}; },

    /* ---- 行：head / tail，返回新表 ---- */
    head: function (n) { return this.sliceRows(0, n == null ? 5 : n); },
    tail: function (n) { n = n == null ? 5 : n; return this.sliceRows(Math.max(0, this.length - n), this.length); },
    sliceRows: function (from, to) {
      var cols = {}, self = this;
      this.columns.forEach(function (c) {
        cols[c] = self.data[c].slice(Math.max(0, from), Math.max(0, to));
      });
      return new DataFrame(this.columns, cols);
    },

    /* ---- 列选择 / 删除 / 重命名 / 类型转换 / 新增列 ---- */
    select: function (names) {
      var self = this, picked = names.filter(function (c) { return self.has(c); }), cols = {};
      picked.forEach(function (c) { cols[c] = self.data[c].slice(); });
      return new DataFrame(picked, cols);
    },
    drop: function (names) {
      return this.select(this.columns.filter(function (c) { return names.indexOf(c) === -1; }));
    },
    rename: function (mapping) {
      var self = this, cols = {}, names = [];
      this.columns.forEach(function (c) {
        var next = (mapping[c] && mapping[c] !== c) ? String(mapping[c]) : c;
        while (cols[next] !== undefined) next = next + '_2';
        names.push(next);
        cols[next] = self.data[c].slice();
      });
      return new DataFrame(names, cols);
    },
    astype: function (name, type) {
      var df = this.clone();
      df.data[name] = (this.data[name] || []).map(function (v) { return castValue(v, type); });
      return df;
    },
    assign: function (name, values) {
      var df = this.clone();
      df.data[name] = values.slice();
      if (!this.has(name)) df.columns.push(name);
      df.length = df.columns.length ? df.data[df.columns[0]].length : 0;
      return df;
    },

    /* ---- 行筛选：predicate(rowObject, index) -> bool ---- */
    filter: function (predicate) {
      var keep = [];
      for (var r = 0; r < this.length; r++) {
        if (predicate(this.rowAt(r), r)) keep.push(r);
      }
      return this.takeRows(keep);
    },
    takeRows: function (idxList) {
      var self = this, cols = {};
      this.columns.forEach(function (c) {
        cols[c] = idxList.map(function (r) { return self.data[c][r]; });
      });
      return new DataFrame(this.columns, cols);
    },
    rowAt: function (r) {
      var row = {}, self = this;
      this.columns.forEach(function (c) { row[c] = self.data[c][r]; });
      return row;
    },
    /* 预览用：取 [from, to) 的行记录 */
    records: function (from, to) {
      from = from || 0; to = to == null ? this.length : to;
      var out = [];
      for (var r = from; r < to; r++) out.push(this.rowAt(r));
      return out;
    },

    /* ---- 排序：by 数组 + ascending 布尔数组 ---- */
    sortValues: function (by, ascending) {
      var self = this;
      var order = [];
      for (var i = 0; i < this.length; i++) order.push(i);
      order.sort(function (a, b) {
        for (var k = 0; k < by.length; k++) {
          var col = by[k], asc = ascending[k] !== false;
          var cmp = compareValues(self.data[col][a], self.data[col][b]);
          if (cmp !== 0) return asc ? cmp : -cmp;
        }
        return a - b;
      });
      return this.takeRows(order);
    },

    /* ---- 去重：subset 为空表示整行比较 ---- */
    dropDuplicates: function (subset) {
      var self = this, keys = (subset && subset.length) ? subset : this.columns;
      var seen = {}, keep = [];
      for (var r = 0; r < this.length; r++) {
        var key = groupKey(keys.map(function (c) { return self.data[c][r]; }));
        if (!seen[key]) { seen[key] = 1; keep.push(r); }
      }
      return this.takeRows(keep);
    },

    /* ---- 缺失值处理 ---- */
    dropna: function (subset, how) {
      var cols = (subset && subset.length) ? subset : this.columns;
      var keep = [];
      for (var r = 0; r < this.length; r++) {
        var miss = 0;
        for (var k = 0; k < cols.length; k++) if (isMissing(this.data[cols[k]][r])) miss++;
        var drop = how === 'all' ? (miss === cols.length) : (miss >= 1);
        if (!drop) keep.push(r);
      }
      return this.takeRows(keep);
    },
    fillna: function (cols, valueOrMethod) {
      var df = this.clone();
      (cols && cols.length ? cols : this.columns).forEach(function (c) {
        var v = df.data[c];
        var fill = valueOrMethod;
        if (valueOrMethod === 'mean') fill = sMean(v);
        else if (valueOrMethod === 'median') fill = sMedian(v);
        else if (valueOrMethod === 'mode') fill = modeOf(v);
        for (var i = 0; i < v.length; i++) {
          if (isMissing(v[i])) v[i] = (fill === 'ffill') ? prevValue(v, i) : fill;
        }
      });
      return df;
    },

    /* ---- Series：value_counts / unique / nunique ---- */
    valueCounts: function (name, normalize, top) {
      var counts = {}, order = [];
      var v = this.data[name] || [];
      for (var i = 0; i < v.length; i++) {
        var val = v[i]; if (isMissing(val)) continue;
        var k = typeof val + ':' + String(val);
        if (counts[k] === undefined) { counts[k] = { label: val, n: 0 }; order.push(k); }
        counts[k].n++;
      }
      var total = 0; order.forEach(function (k) { total += counts[k].n; });
      var arr = order.map(function (k) {
        return { label: counts[k].label, count: counts[k].n, pct: total ? counts[k].n / total : 0 };
      });
      arr.sort(function (a, b) { return (b.count - a.count) || (String(a.label) < String(b.label) ? -1 : 1); });
      if (top) arr = arr.slice(0, top);
      return {
        name: name, index: arr.map(function (d) { return d.label; }),
        values: arr.map(function (d) { return normalize ? d.pct : d.count; }),
        counts: arr.map(function (d) { return d.count; }),
        pct: arr.map(function (d) { return d.pct; }),
        total: total, normalize: !!normalize
      };
    },
    nunique: function (name) { return sNunique(this.data[name] || []); },
    unique: function (name) { return uniqueValues(this.data[name] || []); },
    nuniqueAll: function () {
      var self = this, out = {};
      this.columns.forEach(function (c) { out[c] = self.nunique(c); });
      return out;
    },

    /* ---- 汇总统计 describe ---- */
    describe: function () {
      var self = this, num = this.numericColumns(), cats = this.categoryColumns();
      /* 列 = 变量（数值列在前、类别列在后，与 pandas 的 describe() 版面一致） */
      var columns = num.concat(cats);
      /* 行 = 统计量，顺序与 pandas 一致：数值列给 count..max，类别列给 count / unique / top / freq */
      var idx = ['count'];
      if (cats.length) idx = idx.concat(['unique', 'top', 'freq']);
      if (num.length) idx = idx.concat(['mean', 'std', 'min', '25%', '50%', '75%', 'max']);
      var data = {};
      num.forEach(function (c) {
        var v = self.data[c];
        var map = {
          'count': sCount(v), 'mean': sMean(v), 'std': sStd(v, 1), 'min': sMin(v),
          '25%': quantile(v, 0.25), '50%': quantile(v, 0.5), '75%': quantile(v, 0.75),
          'max': sMax(v)
        };
        data[c] = idx.map(function (k) { return map[k] === undefined ? null : map[k]; });
      });
      cats.forEach(function (c) {
        var v = self.data[c], vc = self.valueCounts(c);
        var map = {
          'count': sCount(v), 'unique': sNunique(v),
          'top': vc.index.length ? vc.index[0] : null,
          'freq': vc.counts.length ? vc.counts[0] : 0
        };
        data[c] = idx.map(function (k) { return map[k] === undefined ? null : map[k]; });
      });
      var df = new DataFrame(columns, data);
      df._describeRows = idx.slice();
      return df;
    },
    statsIndex: function () {
      return ['count', 'unique', 'top', 'freq', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'];
    },

    /* ---- groupby + agg：aggs 形如 [{col, func}] ---- */
    groupby: function (by, aggs) {
      var self = this, groups = {}, order = [];
      for (var r = 0; r < this.length; r++) {
        var keyVals = by.map(function (c) { return self.data[c][r]; });
        var key = groupKey(keyVals);
        if (!groups[key]) { groups[key] = { keys: keyVals, rows: [] }; order.push(key); }
        groups[key].rows.push(r);
      }
      var cols = {}, names = by.slice();
      by.forEach(function (c) { cols[c] = []; });
      aggs.forEach(function (a) {
        var label = a.col + '_' + a.func;
        while (cols[label] !== undefined) label = label + '_2';
        names.push(label);
        cols[label] = [];
      });
      order.forEach(function (k) {
        var g = groups[k];
        by.forEach(function (c, i) { cols[c].push(g.keys[i]); });
        aggs.forEach(function (a, ai) {
          var label = names[by.length + ai];
          var vals = g.rows.map(function (r) { return self.data[a.col][r]; });
          cols[label].push(aggFn(a.func)(vals));
        });
      });
      return new DataFrame(names, cols);
    },

    /* ---- 透视表：index 行、columns 列、values 值 + aggfunc ---- */
    pivotTable: function (indexCol, columnsCol, valuesCol, aggfunc) {
      var self = this;
      var idxVals = uniqueValues(this.data[indexCol] || []);
      var colVals = uniqueValues(this.data[columnsCol] || []);
      var buckets = {};   /* idxKey -> colKey -> [values] */
      var idxLabel = {}, colLabel = {};
      for (var r = 0; r < this.length; r++) {
        var iv = this.data[indexCol][r], cv = this.data[columnsCol][r];
        if (isMissing(iv) || isMissing(cv)) continue;
        var ik = String(iv), ck = String(cv);
        idxLabel[ik] = iv; colLabel[ck] = cv;
        if (!buckets[ik]) { buckets[ik] = {}; }
        if (!buckets[ik][ck]) buckets[ik][ck] = [];
        buckets[ik][ck].push(this.data[valuesCol][r]);
      }
      idxVals.sort(compareValues);
      colVals.sort(compareValues);
      var names = [indexCol];
      var cols = {};
      cols[names[0]] = idxVals.slice();
      colVals.forEach(function (cv) {
        var label = valuesCol + '_' + String(cv);
        while (cols[label] !== undefined && cols[label] !== null && names.indexOf(label) !== -1) label = label + '_2';
        names.push(label);
        cols[label] = idxVals.map(function (iv) {
          var b = buckets[String(iv)] && buckets[String(iv)][String(cv)];
          return b && b.length ? aggFn(aggfunc)(b) : null;
        });
      });
      return new DataFrame(names, cols);
    },

    /* ---- 交叉表：两列的组合频数 ---- */
    crosstab: function (indexCol, columnsCol) {
      var self = this;
      var idxVals = uniqueValues(this.data[indexCol] || []).sort(compareValues);
      var colVals = uniqueValues(this.data[columnsCol] || []).sort(compareValues);
      var counts = {};
      for (var r = 0; r < this.length; r++) {
        var iv = this.data[indexCol][r], cv = this.data[columnsCol][r];
        if (isMissing(iv) || isMissing(cv)) continue;
        var k = String(iv) + '\u0001' + String(cv);
        counts[k] = (counts[k] || 0) + 1;
      }
      var names = [indexCol];
      var cols = {};
      cols[names[0]] = idxVals.slice();
      var rowTotals = idxVals.map(function () { return 0; });
      colVals.forEach(function (cv) {
        var label = String(cv);
        while (names.indexOf(label) !== -1) label = label + '_2';
        names.push(label);
        cols[label] = idxVals.map(function (iv, i) {
          var n = counts[String(iv) + '\u0001' + String(cv)] || 0;
          rowTotals[i] += n;
          return n;
        });
      });
      names.push('All');
      cols['All'] = rowTotals.slice();
      return new DataFrame(names, cols);
    },

    /* ---- 相关矩阵（皮尔逊）：只用数值列 ---- */
    corr: function () {
      var self = this, num = this.numericColumns();
      var cols = {}, matrix = [];
      num.forEach(function (a) {
        var row = [];
        num.forEach(function (b) {
          row.push(pearson(self.data[a], self.data[b]));
        });
        matrix.push(row);
      });
      num.forEach(function (a, i) { cols[a] = matrix[i]; });
      var df = new DataFrame(num.map(function (c) { return c; }), cols);
      df._corrRowLabels = num.slice();
      return df;
    },

    /* ---- 合并 merge：支持 inner / left / right / outer ---- */
    merge: function (right, leftOn, rightOn, how) {
      how = how || 'inner';
      leftOn = leftOn || [];
      rightOn = rightOn || leftOn.slice();
      var self = this;
      right = right;
      /* 建立右表索引：右键签名 -> 行号数组 */
      var rIndex = {};
      for (var rr = 0; rr < right.length; rr++) {
        var rk = groupKey(rightOn.map(function (c) { return right.data[c][rr]; }));
        (rIndex[rk] = rIndex[rk] || []).push(rr);
      }
      var lKeys = leftOn.map(function (c) { return c; });
      var outLeftCols = [], outRightCols = [];
      var sameKeys = leftOn.length === rightOn.length && leftOn.every(function (c, i) { return c === rightOn[i]; });
      this.columns.forEach(function (c) {
        if (sameKeys && rightOn.indexOf(c) !== -1) outLeftCols.push(c);
        else outLeftCols.push(c);
      });
      right.columns.forEach(function (c) {
        if (sameKeys && rightOn.indexOf(c) !== -1) return;   /* 同名键只保留一份 */
        outRightCols.push(c);
      });
      var names = outLeftCols.slice();
      outRightCols.forEach(function (c) {
        var label = c;
        while (names.indexOf(label) !== -1) label = label + '_y';
        names.push(label);
      });
      var cols = {};
      names.forEach(function (n) { cols[n] = []; });
      var rightUsed = {};
      var MAX = 50000;
      function pushRow(leftRow, rightRow) {
        outLeftCols.forEach(function (c) { cols[c].push(self.data[c][leftRow]); });
        outRightCols.forEach(function (c, i) { cols[names[outLeftCols.length + i]].push(rightRow == null ? null : right.data[c][rightRow]); });
      }
      for (var r = 0; r < this.length && cols[names[0]].length < MAX; r++) {
        var key = groupKey(leftOn.map(function (c) { return self.data[c][r]; }));
        var hit = rIndex[key];
        if (hit && hit.length) {
          for (var h = 0; h < hit.length; h++) { pushRow(r, hit[h]); rightUsed[hit[h]] = 1; }
        } else if (how === 'left' || how === 'outer') {
          pushRow(r, null);
        }
      }
      if (how === 'right' || how === 'outer') {
        for (var r2 = 0; r2 < right.length && cols[names[0]].length < MAX; r2++) {
          if (rightUsed[r2]) continue;
          /* 右表独有的行：左表列填空 */
          outLeftCols.forEach(function (c) { cols[c].push(null); });
          outRightCols.forEach(function (c, i) { cols[names[outLeftCols.length + i]].push(right.data[c][r2]); });
        }
      }
      return new DataFrame(names, cols);
    },

    /* ---- 纵向拼接 concat（axis=0）：列取并集，缺失补 null ---- */
    concat: function (others, axis) {
      axis = axis || 0;
      var frames = [this].concat(others || []);
      if (axis === 1) {
        /* 横向拼接：按位置对齐（与 pd.concat(axis=1) 的默认 RangeIndex 行为一致） */
        var n = Math.max.apply(null, frames.map(function (f) { return f.length; }));
        var names = [], cols = {};
        frames.forEach(function (f) {
          f.columns.forEach(function (c) {
            var label = c;
            while (names.indexOf(label) !== -1) label = label + '_2';
            names.push(label);
            var arr = [];
            for (var i = 0; i < n; i++) arr.push(i < f.length ? f.data[c][i] : null);
            cols[label] = arr;
          });
        });
        return new DataFrame(names, cols);
      }
      var all = [], seen = {};
      frames.forEach(function (f) {
        f.columns.forEach(function (c) { if (!seen[c]) { seen[c] = 1; all.push(c); } });
      });
      var out = {};
      all.forEach(function (c) {
        var arr = [];
        frames.forEach(function (f) {
          for (var i = 0; i < f.length; i++) arr.push(f.has(c) ? f.data[c][i] : null);
        });
        out[c] = arr;
      });
      return new DataFrame(all, out);
    },

    /* ---- 清洗：值替换 / 字符串 / 截断 / 日期 / 分类 / 重复标记 / 分箱 / 独热 ---- */
    replace: function (name, from, to) {
      var df = this.clone(), v = df.data[name] || [];
      var target = to;                              /* 目标值按「数字优先」解析，'0' → 0 */
      for (var i = 0; i < v.length; i++) {
        if (isMissing(v[i])) continue;
        var same = String(v[i]) === String(from);
        if (!same && typeof v[i] === 'number' && isNumericStr(from)) same = Number(String(from).split(',').join('')) === v[i];
        if (same) v[i] = target;
      }
      return df;
    },
    strOp: function (name, action, arg) {
      var df = this.clone(), v = (df.data[name] || []).slice();
      var out = v.map(function (x) {
        if (isMissing(x)) return null;
        var s = String(x);
        if (action === 'lower') return s.toLowerCase();
        if (action === 'upper') return s.toUpperCase();
        if (action === 'title') return s.replace(/\S+/g, function (w) { return w[0].toUpperCase() + w.slice(1).toLowerCase(); });
        if (action === 'strip') return s.trim();
        if (action === 'len') return s.length;
        if (action === 'firstword') {
          var parts = s.split(String(arg == null || arg === '' ? ' ' : arg));
          return parts.length ? parts[0] : s;
        }
        if (action === 'replace') {
          var bits = String(arg == null ? '' : arg).split('=>');
          if (bits.length < 2) return s;
          return s.split(bits[0]).join(bits[1]);   /* 等价于 str.replace(old, new, regex=False) */
        }
        return s;
      });
      df.data[name] = out;
      return df;
    },
    clip: function (name, lo, hi) {
      var df = this.clone(), v = df.data[name] || [];
      var hasLo = (lo !== '' && lo !== null && lo !== undefined && isFinite(Number(lo)));
      var hasHi = (hi !== '' && hi !== null && hi !== undefined && isFinite(Number(hi)));
      for (var i = 0; i < v.length; i++) {
        var n = Number(v[i]);
        if (isMissing(v[i]) || isNaN(n)) continue;
        if (hasLo && n < Number(lo)) v[i] = Number(lo);
        if (hasHi && n > Number(hi)) v[i] = Number(hi);
      }
      return df;
    },
    toDatetime: function (name) {
      var df = this.clone();
      df.data[name] = (df.data[name] || []).map(function (v) { return isoDate(toDate(v)); });
      if (df._cat && df._cat[name]) delete df._cat[name];
      return df;
    },
    toCategorical: function (name) {
      var df = this.clone(), v = df.data[name] || [];
      if (!df._cat) df._cat = {};
      df._cat[name] = uniqueValues(v);
      return df;
    },
    duplicatedFlag: function (subset, keep) {
      var df = this.clone();
      var keys = (subset && subset.length) ? subset : this.columns;
      var seen = {}, flags = [];
      for (var r = 0; r < this.length; r++) {
        var key = groupKey(keys.map(function (c) { return df.data[c][r]; }));
        var dup = !!seen[key];
        if (!dup) seen[key] = 1;
        else if (keep === 'last') seen[key] = 1;   /* keep='last'：仍标后面的重复（教学演示从简） */
        flags.push(dup);
      }
      return df.assign('is_duplicated', flags);
    },
    cut: function (name, bins, out) {
      var df = this.clone(), v = this.data[name] || [];
      var nums = [];
      for (var i = 0; i < v.length; i++) { var n = Number(v[i]); if (!isMissing(v[i]) && isFinite(n)) nums.push(n); }
      if (!nums.length) throw new Error('cut needs numeric values');
      var k = Math.max(1, Math.round(Number(bins) || 4));
      var mn = Math.min.apply(null, nums), mx = Math.max.apply(null, nums);
      var width = (mx - mn) / k || 1;
      var col = v.map(function (x) {
        var n = Number(x);
        if (isMissing(x) || !isFinite(n)) return null;
        var b = Math.min(k - 1, Math.max(0, Math.floor((n - mn) / width)));
        var lo = mn + width * b, hi = lo + width;
        return '(' + (Math.round(lo * 1000) / 1000) + ', ' + (Math.round(hi * 1000) / 1000) + ']';
      });
      return df.assign(out || (name + '_bin'), col);
    },
    qcut: function (name, q, out) {
      var df = this.clone(), v = this.data[name] || [];
      var nums = [];
      for (var i = 0; i < v.length; i++) { var n = Number(v[i]); if (!isMissing(v[i]) && isFinite(n)) nums.push(n); }
      if (!nums.length) throw new Error('qcut needs numeric values');
      var k = Math.max(1, Math.round(Number(q) || 4));
      var edges = [];
      for (var e = 0; e <= k; e++) edges.push(quantile(nums, e / k));
      var col = v.map(function (x) {
        var n = Number(x);
        if (isMissing(x) || !isFinite(n)) return null;
        var b = 0;
        while (b < k - 1 && n > edges[b + 1]) b++;
        return 'Q' + (b + 1) + ' (' + (Math.round(edges[b] * 1000) / 1000) + ', ' +
          (Math.round(edges[b + 1] * 1000) / 1000) + ']';
      });
      return df.assign(out || (name + '_qcut'), col);
    },
    getDummies: function (name, prefix) {
      var df = this.clone(), v = this.data[name] || [];
      var cats = uniqueValues(v);
      cats.forEach(function (c) {
        var label = (prefix || name) + '_' + String(c).replace(/[^0-9A-Za-z_\u4e00-\u9fa5]+/g, '_');
        while (df.has(label)) label = label + '_2';
        df.data[label] = v.map(function (x) { return isMissing(x) ? null : String(x) === String(c); });
        df.columns.push(label);
      });
      df.length = df.columns.length ? df.data[df.columns[0]].length : 0;
      return df;
    },

    /* ---- 查询与索引：query / isin / between / sample / nlargest / iloc / set_index ---- */
    queryExpr: function (expr) {
      var src = String(expr == null ? '' : expr).split(/\s+(and|or)\s+/i);
      var terms = [], conns = [];
      for (var i = 0; i < src.length; i += 2) {
        var term = parseQueryTerm(src[i]);
        if (!term) throw new Error('bad term: ' + src[i]);
        terms.push(term);
        if (src[i + 1]) conns.push(String(src[i + 1]).toLowerCase());
      }
      var keep = [];
      for (var r = 0; r < this.length; r++) {
        var ok = true;
        for (var k = 0; k < terms.length; k++) {
          var hit = testQueryTerm(terms[k], this.data[terms[k].col] ? this.data[terms[k].col][r] : undefined);
          if (k === 0) ok = hit;
          else ok = conns[k - 1] === 'or' ? (ok || hit) : (ok && hit);
        }
        if (ok) keep.push(r);
      }
      return this.takeRows(keep);
    },
    isin: function (name, values) {
      var self = this, keep = [];
      var want = (values || []).map(function (v) { return String(v); });
      var v = this.data[name] || [];
      for (var r = 0; r < v.length; r++) {
        if (!isMissing(v[r]) && want.indexOf(String(v[r])) !== -1) keep.push(r);
      }
      return self.takeRows(keep);
    },
    between: function (name, lo, hi, inclusive) {
      var keep = [], v = this.data[name] || [];
      var a = lo, b = hi;
      if (a > b) { var t = a; a = b; b = t; }
      var inc = (inclusive !== 'neither');
      var left = inclusive === 'right' || inclusive === 'both' || inclusive === undefined;
      var right = inclusive === 'left' || inclusive === 'both' || inclusive === undefined;
      for (var r = 0; r < v.length; r++) {
        var x = v[r];
        if (isMissing(x)) continue;
        var okL = left ? (x >= a) : (x > a);
        var okR = right ? (x <= b) : (x < b);
        if (inc ? (okL && okR) : (x > a && x < b)) keep.push(r);
      }
      return this.takeRows(keep);
    },
    sample: function (n, seed, frac) {
      var rnd = seededRng(seed), idx = [];
      for (var i = 0; i < this.length; i++) idx.push(i);
      var want = Math.max(0, Math.min(this.length, Math.round(Number(frac) ? this.length * Number(frac) : Number(n) || 0)));
      /* Fisher–Yates：固定 seed 下与 pandas 一样可复现 */
      for (var k = idx.length - 1; k > 0; k--) {
        var j = Math.floor(rnd() * (k + 1)), tmp = idx[k];
        idx[k] = idx[j]; idx[j] = tmp;
      }
      var keep = idx.slice(0, want).sort(function (a, b) { return a - b; });
      return this.takeRows(keep);
    },
    nlargest: function (name, n, which) {
      var asc = which === 'smallest';
      var sorted = this.sortValues([name], [asc]);
      return sorted.head(Math.max(1, Math.round(Number(n) || 1)));
    },
    iloc: function (from, to) {
      var a = Math.max(0, Math.round(Number(from) || 0));
      var b = (to === '' || to === null || to === undefined) ? this.length : Math.round(Number(to));
      return this.sliceRows(a, b);
    },
    setIndex: function (name) {
      var df = this.clone();
      if (!df.has(name)) return df;
      df.columns = [name].concat(df.columns.filter(function (c) { return c !== name; }));
      df._indexCols = [name];
      return df;
    },
    resetIndex: function () {
      var df = this.clone();
      df._indexCols = null;
      return df;
    },

    /* ---- 重塑 melt：宽表 → 长表（id_vars 保持，其余列堆成 variable / value） ---- */
    melt: function (idVars, valueVars) {
      var self = this;
      var ids = (idVars && idVars.length) ? idVars.filter(function (c) { return self.has(c); }) : [];
      var vals = (valueVars && valueVars.length)
        ? valueVars.filter(function (c) { return self.has(c) && ids.indexOf(c) === -1; })
        : this.columns.filter(function (c) { return ids.indexOf(c) === -1; });
      var names = ids.concat(['variable', 'value']), cols = {};
      names.forEach(function (c) { cols[c] = []; });
      for (var r = 0; r < this.length; r++) {
        vals.forEach(function (c) {
          ids.forEach(function (id) { cols[id].push(self.data[id][r]); });
          cols.variable.push(c);
          cols.value.push(self.data[c][r]);
        });
      }
      return new DataFrame(names, cols);
    },

    /* ---- 分组统计：agg 多列 / transform / filter / rank ---- */
    aggMulti: function (by, pairs) {
      var aggs = (pairs || []).filter(function (p) { return p && p.col; });
      if (!aggs.length) throw new Error('agg needs at least one pair');
      return this.groupby(by, aggs);
    },
    transform: function (by, name, fn) {
      var vals = this.data[name] || [];
      var g = groupRows(this, by), fnAgg = aggFn(fn);
      var out = [];
      for (var i = 0; i < this.length; i++) out.push(null);
      g.rows.forEach(function (rows) {
        var v = fnAgg(rows.map(function (r) { return vals[r]; }));
        rows.forEach(function (r) { out[r] = v; });
      });
      return this.assign(name + '_' + fn, out);
    },
    groupFilter: function (by, name, fn, threshold, dir) {
      var vals = this.data[name] || [];
      var g = groupRows(this, by), fnAgg = aggFn(fn);
      var lim = Number(threshold), down = (dir === 'le'), keep = [];
      g.rows.forEach(function (rows) {
        var v = fnAgg(rows.map(function (r) { return vals[r]; }));
        var ok = down ? (v <= lim) : (v >= lim);
        if (ok) keep = keep.concat(rows);
      });
      keep.sort(function (a, b) { return a - b; });
      return this.takeRows(keep);
    },
    rank: function (name, method, asc) {
      var v = this.data[name] || [], idx = [];
      for (var i = 0; i < v.length; i++) if (!isMissing(v[i])) idx.push(i);
      var desc = (asc === false || asc === 'false');
      idx.sort(function (a, b) {
        var c = compareValues(v[a], v[b]);
        return desc ? -c : c;
      });
      var out = [];
      for (var k = 0; k < v.length; k++) out.push(null);
      var dense = 0, i2 = 0;
      while (i2 < idx.length) {
        var j = i2;
        while (j + 1 < idx.length && compareValues(v[idx[j + 1]], v[idx[i2]]) === 0) j++;
        dense++;
        var first = i2 + 1, last = j + 1, rk;
        if (method === 'min') rk = first;
        else if (method === 'max') rk = last;
        else if (method === 'dense') rk = dense;
        else if (method === 'first') rk = null;      /* first 逐行给序号 */
        else rk = (first + last) / 2;                /* average */
        for (var t = i2; t <= j; t++) out[idx[t]] = (method === 'first') ? (t + 1) : rk;
        i2 = j + 1;
      }
      return this.assign(name + '_rank', out);
    },

    /* ---- 窗口：cumsum / rolling / expanding / diff / pct_change / shift ---- */
    cum: function (name, fn) {
      var df = this.clone(), v = df.data[name] || [];
      var acc = null, out = [];
      for (var i = 0; i < v.length; i++) {
        var n = Number(v[i]);
        if (isMissing(v[i]) || isNaN(n)) { out.push(null); continue; }   /* pandas：NaN 位置保持 NaN，但累加值继续 */
        if (acc === null) acc = n;
        else if (fn === 'cumprod') acc = acc * n;
        else if (fn === 'cummax') acc = Math.max(acc, n);
        else if (fn === 'cummin') acc = Math.min(acc, n);
        else acc = acc + n;
        out.push(acc);
      }
      df.data[name] = out;
      return df;
    },
    rolling: function (name, window, fn) {
      var df = this.clone(), v = df.data[name] || [];
      var w = Math.max(1, Math.round(Number(window) || 1)), fnAgg = aggFn(fn), out = [];
      for (var i = 0; i < v.length; i++) {
        if (i + 1 < w) { out.push(null); continue; }        /* min_periods = window */
        var win = nonMissing(v.slice(i + 1 - w, i + 1));
        out.push(win.length < w ? null : fnAgg(win));
      }
      df.data[name] = out;
      return df;
    },
    expanding: function (name, fn) {
      var df = this.clone(), v = df.data[name] || [];
      var fnAgg = aggFn(fn), out = [];
      for (var i = 0; i < v.length; i++) {
        var win = nonMissing(v.slice(0, i + 1));
        out.push(win.length ? fnAgg(win) : null);
      }
      df.data[name] = out;
      return df;
    },
    diff: function (name, periods, mode) {
      var df = this.clone(), v = df.data[name] || [];
      var p = Math.round(Number(periods) || 1), out = [];
      for (var i = 0; i < v.length; i++) {
        var prev = v[i - p], cur = v[i];
        if (isMissing(prev) || isMissing(cur)) { out.push(null); continue; }
        var a = Number(prev), b = Number(cur);
        if (isNaN(a) || isNaN(b)) { out.push(null); continue; }
        out.push(mode === 'pct_change' ? (a === 0 ? null : (b - a) / a) : (b - a));
      }
      df.data[name] = out;
      return df;
    },
    shift: function (name, periods) {
      var df = this.clone(), v = df.data[name] || [];
      var p = Math.round(Number(periods) || 1), out = [];
      for (var i = 0; i < v.length; i++) {
        var j = i - p;
        out.push((j < 0 || j >= v.length) ? null : v[j]);
      }
      df.data[name] = out;
      return df;
    },

    /* ---- 协方差矩阵 / 时间重采样 / 时间成分 / 时间偏移 ---- */
    cov: function () {
      var self = this, num = this.numericColumns(), cols = {}, matrix = [];
      num.forEach(function (a) {
        var row = [];
        num.forEach(function (b) {
          var xs = [], ys = [];
          for (var i = 0; i < self.length; i++) {
            var va = self.data[a][i], vb = self.data[b][i];
            if (isMissing(va) || isMissing(vb)) continue;
            xs.push(Number(va)); ys.push(Number(vb));
          }
          var n = xs.length;
          if (n < 2) { row.push(null); return; }
          var mx = sMean(xs), my = sMean(ys), acc = 0;
          for (var k = 0; k < n; k++) acc += (xs[k] - mx) * (ys[k] - my);
          row.push(acc / (n - 1));                     /* 样本协方差 ddof=1，与 pandas .cov() 一致 */
        });
        matrix.push(row);
      });
      num.forEach(function (a, i) { cols[a] = matrix[i]; });
      var df = new DataFrame(num.slice(), cols);
      df._corrRowLabels = num.slice();
      df._matrixKind = 'cov';
      return df;
    },
    resample: function (dateCol, freq, valueCol, agg) {
      var dates = this.data[dateCol] || [], vals = this.data[valueCol] || [];
      var buckets = {}, order = [];
      for (var i = 0; i < this.length; i++) {
        var d = toDate(dates[i]);
        if (!d) continue;
        var key = bucketKey(d, freq);
        if (buckets[key] === undefined) { buckets[key] = []; order.push(key); }
        buckets[key].push(vals[i]);
      }
      order.sort();
      var fn = aggFn(agg);
      var label = valueCol + '_' + String(agg), cols = {};
      cols[dateCol] = order.slice();
      cols[label] = order.map(function (k) { return fn(buckets[k]); });
      return new DataFrame([dateCol, label], cols);
    },
    datePart: function (dateCol, part) {
      var df = this.clone(), v = df.data[dateCol] || [];
      return df.assign(dateCol + '_' + part, v.map(function (x) { return datePartValue(toDate(x), part); }));
    },
    dateOffset: function (dateCol, days, months) {
      var df = this.clone(), v = df.data[dateCol] || [];
      var d0 = Math.round(Number(days) || 0), m0 = Math.round(Number(months) || 0);
      var out = v.map(function (x) {
        var d = toDate(x);
        if (!d) return null;
        var y = d.getFullYear(), m = d.getMonth() + m0, base = new Date(d.getTime());
        if (m0) {
          y += Math.floor(m / 12);
          m = ((m % 12) + 12) % 12;
          base = new Date(y, m, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
        }
        if (d0) base = new Date(base.getTime() + d0 * 86400000);
        return isoDate(base);
      });
      return df.assign(dateCol + '_offset', out);
    },

    /* ---- 合并：join（按索引连接） / combine_first（用另一张表补缺失） ---- */
    join: function (other, on, how) {
      return this.merge(other, [on], [on], how || 'left');
    },
    combineFirst: function (other, on) {
      var df = this.clone(), idx = {};
      for (var r = 0; r < other.length; r++) idx[String(other.data[on][r])] = r;
      other.columns.forEach(function (c) {
        if (c === on || df.has(c)) return;
        var arr = [];
        for (var i = 0; i < df.length; i++) arr.push(null);
        df.data[c] = arr;
        df.columns.push(c);
      });
      df.length = df.columns.length ? df.data[df.columns[0]].length : 0;
      for (var k = 0; k < this.length; k++) {
        var orow = idx[String(this.data[on][k])];
        if (orow === undefined) continue;
        other.columns.forEach(function (c) {
          if (c === on) return;
          if (isMissing(df.data[c][k]) && !isMissing(other.data[c][orow])) df.data[c][k] = other.data[c][orow];
        });
      }
      return df;
    },

    /* ---- 数据体检：memory_usage(deep=True) + astype("category") 能省多少 ---- */
    memoryUsage: function () {
      var self = this, byCol = {}, total = 0, catTotal = 0;
      this.columns.forEach(function (c) {
        var t = self.dtype(c);
        var bytes = colBytes(self, c, false);
        var asCat = (t === DT.STR || t === DT.INT || t === DT.FLOAT || t === DT.BOOL) ? colBytes(self, c, true) : bytes;
        byCol[c] = { dtype: t, bytes: bytes, categoryBytes: asCat, categories: self.nunique(c) };
        total += bytes; catTotal += asCat;
      });
      return { total: total, categoryTotal: catTotal, byCol: byCol };
    },

    /* ---- 导出：to_markdown / to_html / to_sql（read_clipboard 靠 TSV 往返） ---- */
    toTSV: function () {
      var self = this;
      function esc(v) { return isMissing(v) ? '' : String(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' '); }
      var lines = [this.columns.join('\t')];
      for (var r = 0; r < this.length; r++) {
        lines.push(this.columns.map(function (c) { return esc(self.data[c][r]); }).join('\t'));
      }
      return lines.join('\n');
    },
    toMarkdown: function () {
      var self = this;
      function esc(v) { return isMissing(v) ? '' : String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }
      var head = '| ' + this.columns.map(esc).join(' | ') + ' |';
      var sep = '| ' + this.columns.map(function () { return '---'; }).join(' | ') + ' |';
      var body = [];
      for (var r = 0; r < this.length; r++) {
        body.push('| ' + this.columns.map(function (c) { return esc(self.data[c][r]); }).join(' | ') + ' |');
      }
      return [head, sep].concat(body).join('\n');
    },
    toHTML: function () {
      var self = this;
      function esc(v) {
        return isMissing(v) ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      var head = '<tr>' + this.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
      var body = [];
      for (var r = 0; r < this.length; r++) {
        body.push('<tr>' + this.columns.map(function (c) { return '<td>' + esc(self.data[c][r]) + '</td>'; }).join('') + '</tr>');
      }
      return '<table class="pd-export">\n  <thead>' + head + '</thead>\n  <tbody>\n    ' +
        body.join('\n    ') + '\n  </tbody>\n</table>';
    },
    toSQL: function (table, limit) {
      var self = this, name = table || 'df';
      function sqlType(d) {
        if (d === DT.INT) return 'INTEGER';
        if (d === DT.FLOAT) return 'REAL';
        if (d === DT.BOOL) return 'BOOLEAN';
        if (d === DT.DATETIME) return 'TIMESTAMP';
        return 'TEXT';
      }
      function lit(v) {
        if (isMissing(v)) return 'NULL';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        return "'" + String(v).replace(/'/g, "''") + "'";
      }
      var lines = ['CREATE TABLE ' + name + ' ('];
      lines.push(this.columns.map(function (c) { return '  "' + c + '" ' + sqlType(self.dtype(c)); }).join(',\n'));
      lines.push(');', '');
      var n = limit ? Math.min(limit * 1 || limit, this.length) : this.length;
      lines.push('INSERT INTO ' + name + ' (' + this.columns.map(function (c) { return '"' + c + '"'; }).join(', ') + ') VALUES');
      var rows = [];
      for (var r = 0; r < n; r++) {
        rows.push('  (' + this.columns.map(function (c) { return lit(self.data[c][r]); }).join(', ') + ')');
      }
      lines.push(rows.join(',\n') + ';');
      if (this.length > n) lines.push('-- 只导出前 ' + n + ' 行，共 ' + this.length + ' 行');
      return lines.join('\n');
    },

    /* ---- 导出 ---- */
    toRecords: function (limit) {
      var n = limit ? Math.min(limit, this.length) : this.length;
      return this.records(0, n);
    },
    toCSV: function () {
      var self = this;
      function esc(v) {
        if (isMissing(v)) return '';
        var s = String(v);
        if (isPlainNumber(v)) return s;
        return '"' + s.replace(/"/g, '""') + '"';
      }
      var lines = [this.columns.join(',')];
      for (var r = 0; r < this.length; r++) {
        lines.push(this.columns.map(function (c) { return esc(self.data[c][r]); }).join(','));
      }
      return lines.join('\n');
    },
    toJSON: function () {
      return JSON.stringify(this.toRecords(), null, 2);
    }
  };

  /* ---------------- 相关系数 & 数字判断 ---------------- */
  function isPlainNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }
  function pearson(a, b) {
    var xs = [], ys = [], i;
    for (i = 0; i < a.length; i++) {
      var va = a[i], vb = b[i];
      if (isMissing(va) || isMissing(vb)) continue;
      var na = Number(va), nb = Number(vb);
      if (isNaN(na) || isNaN(nb)) continue;
      xs.push(na); ys.push(nb);
    }
    var n = xs.length;
    if (n < 2) return null;
    var mx = 0, my = 0;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    var num = 0, dx = 0, dy = 0;
    for (i = 0; i < n; i++) {
      var a1 = xs[i] - mx, b1 = ys[i] - my;
      num += a1 * b1; dx += a1 * a1; dy += b1 * b1;
    }
    var den = Math.sqrt(dx * dy);
    return den === 0 ? null : num / den;
  }

  /* ---------------- 静态构造函数 & 导出 ---------------- */
  DataFrame.fromRecords = function (recs) { return fromRecords(recs); };

  return {
    DT: DT,
    DataFrame: DataFrame,
    isNumericType: isNumericType,
    isMissing: isMissing,
    parseScalar: parseScalar,
    sniffDelimiter: sniffDelimiter,
    readCSV: readCSV,
    readJSON: readJSON,
    readHTML: readHTML,
    fromRecords: fromRecords,
    /* 日期工具单独暴露：时间序列卡片与代码生成都用同一套口径 */
    dateUtils: { toDate: toDate, isoDate: isoDate, bucketKey: bucketKey, datePart: datePartValue },
    /* 统计函数单独暴露：图表与「描述统计」卡片直接调用 */
    stat: {
      count: sCount, sum: sSum, mean: sMean, min: sMin, max: sMax,
      std: sStd, variance: sVar, median: sMedian, quantile: quantile,
      nunique: sNunique, unique: uniqueValues, pearson: pearson, agg: aggFn
    },
    AGG: AGG
  };
}());
