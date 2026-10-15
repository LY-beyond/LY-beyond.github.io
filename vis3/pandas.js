/* =========================================================
 * pandas.js —— 迷你 DataFrame 引擎(vis3 核心)
 * ---------------------------------------------------------
 * 参照 Python pandas 的语义实现一个浏览器端的轻量 DataFrame:
 *   df = { columns: [...], dtypes: {col: dtype}, rows: [[...]], name }
 *   dtype ∈ 'number' | 'string' | 'datetime' | 'boolean'
 *   缺失值一律为 null(NaN / 空串解析后都归一成 null)
 * 所有操作都是纯函数:输入 df,输出新 df 或结果对象,不改原表。
 * ========================================================= */
(function () {
  'use strict';

  /* ---------------- 基础工具 ---------------- */

  var DATE_RE = /^\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?\s*$/;

  function isNull(v) { return v === null || v === undefined || (typeof v === 'number' && isNaN(v)); }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function formatValue(v, dtype) {
    if (isNull(v)) return '';
    if (v instanceof Date) {
      return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate()) +
        ((v.getHours() || v.getMinutes() || v.getSeconds()) ?
          ' ' + pad(v.getHours()) + ':' + pad(v.getMinutes()) : '');
    }
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      var s = v.toFixed(4);
      return s.replace(/\.?0+$/, '');
    }
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    return String(v);
  }

  function parseDateLoose(s) {
    var m = String(s).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }

  /* 类型推断:看整列非空值,全部能转成同一类型才认 */
  function inferDtype(values) {
    var seen = false, allNum = true, allDate = true, allBool = true;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (isNull(v) || v === '') continue;
      seen = true;
      if (typeof v === 'boolean') { allNum = false; allDate = false; continue; }
      if (v instanceof Date) { allNum = false; allBool = false; continue; }
      if (typeof v === 'number') { allDate = false; allBool = false; continue; }
      var s = String(v).trim();
      if (allNum && isNaN(Number(s))) allNum = false;
      if (allDate && !DATE_RE.test(s)) allDate = false;
      if (allBool && !/^(true|false)$/i.test(s)) allBool = false;
    }
    if (!seen) return 'string';
    if (allNum) return 'number';
    if (allDate) return 'datetime';
    if (allBool) return 'boolean';
    return 'string';
  }

  /* 按声明 dtype 归一化一个值(解析 CSV / JSON 时用) */
  function coerce(v, dtype) {
    if (isNull(v) || v === '') return null;
    if (dtype === 'number') {
      if (typeof v === 'number') return isNaN(v) ? null : v;
      var n = Number(String(v).replace(/,/g, '').trim());
      return isNaN(n) ? null : n;
    }
    if (dtype === 'datetime') {
      if (v instanceof Date) return v;
      return parseDateLoose(v);
    }
    if (dtype === 'boolean') {
      if (typeof v === 'boolean') return v;
      return /^(true|1|yes)$/i.test(String(v).trim());
    }
    return String(v);
  }

  /* ---------------- 构造 ---------------- */

  function create(columns, rows, name) {
    var dtypes = {};
    for (var c = 0; c < columns.length; c++) {
      var colVals = [];
      for (var r = 0; r < rows.length; r++) colVals.push(rows[r][c]);
      dtypes[columns[c]] = inferDtype(colVals);
    }
    var norm = rows.map(function (row) {
      return row.map(function (v, i) { return coerce(v, dtypes[columns[i]]); });
    });
    return { columns: columns.slice(), dtypes: dtypes, rows: norm, name: name || 'df' };
  }

  function clone(df, name) {
    return { columns: df.columns.slice(), dtypes: Object.assign({}, df.dtypes),
             rows: df.rows.map(function (r) { return r.slice(); }), name: name || df.name };
  }

  function colIndex(df, col) { return df.columns.indexOf(col); }

  function colValues(df, col) {
    var i = colIndex(df, col);
    return df.rows.map(function (r) { return r[i]; });
  }

  function numericColumns(df) {
    return df.columns.filter(function (c) { return df.dtypes[c] === 'number'; });
  }

  function shape(df) { return { rows: df.rows.length, cols: df.columns.length }; }

  function head(df, n) {
    var out = clone(df); out.rows = out.rows.slice(0, n == null ? 5 : n); return out;
  }
  function tail(df, n) {
    var out = clone(df); out.rows = out.rows.slice(-(n == null ? 5 : n)); return out;
  }
  function sample(df, n) {
    var out = clone(df);
    var idx = out.rows.map(function (_, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    out.rows = idx.slice(0, Math.min(n, idx.length)).map(function (k) { return out.rows[k]; });
    return out;
  }

  /* df.info():每列的名字 / 类型 / 非空数 / 唯一值数 */
  function info(df) {
    return {
      rows: df.rows.length,
      cols: df.columns.length,
      columns: df.columns.map(function (c, i) {
        var nonNull = 0, seen = {};
        for (var r = 0; r < df.rows.length; r++) {
          var v = df.rows[r][i];
          if (!isNull(v)) {
            nonNull++;
            seen[typeof v === 'object' ? +v : String(v)] = 1;
          }
        }
        return { name: c, dtype: df.dtypes[c], nonNull: nonNull,
                 nulls: df.rows.length - nonNull, unique: Object.keys(seen).length };
      })
    };
  }

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    var pos = (sorted.length - 1) * q, base = Math.floor(pos), rest = pos - base;
    if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    return sorted[base];
  }

  function numericStats(vals) {
    var nums = vals.filter(function (v) { return typeof v === 'number' && !isNaN(v); }).sort(function (a, b) { return a - b; });
    if (!nums.length) return null;
    var sum = 0; for (var i = 0; i < nums.length; i++) sum += nums[i];
    var mean = sum / nums.length, sq = 0;
    for (i = 0; i < nums.length; i++) sq += (nums[i] - mean) * (nums[i] - mean);
    return { count: nums.length, mean: mean, std: nums.length > 1 ? Math.sqrt(sq / (nums.length - 1)) : 0,
             min: nums[0], q25: quantile(nums, .25), q50: quantile(nums, .5),
             q75: quantile(nums, .75), max: nums[nums.length - 1] };
  }

  /* df.describe():数值列给统计量,其余列给 count/unique/top/freq */
  function describe(df) {
    return df.columns.map(function (c, i) {
      var vals = df.rows.map(function (r) { return r[i]; });
      if (df.dtypes[c] === 'number') {
        return { column: c, kind: 'number', stats: numericStats(vals) };
      }
      var nonNull = vals.filter(function (v) { return !isNull(v); });
      var freq = {}, top = null, topN = 0;
      nonNull.forEach(function (v) {
        var k = formatValue(v, df.dtypes[c]);
        freq[k] = (freq[k] || 0) + 1;
        if (freq[k] > topN) { topN = freq[k]; top = k; }
      });
      return { column: c, kind: 'other',
               stats: { count: nonNull.length, unique: Object.keys(freq).length, top: top, freq: topN } };
    });
  }

  /* ---------------- 选择 / 重命名 / 类型 ---------------- */

  function selectColumns(df, cols) {
    var idx = cols.map(function (c) { return colIndex(df, c); });
    var out = { columns: cols.slice(), dtypes: {}, name: df.name,
                rows: df.rows.map(function (r) { return idx.map(function (i) { return r[i]; }); }) };
    cols.forEach(function (c) { out.dtypes[c] = df.dtypes[c]; });
    return out;
  }

  function dropColumns(df, cols) {
    return selectColumns(df, df.columns.filter(function (c) { return cols.indexOf(c) < 0; }));
  }

  function renameColumn(df, oldName, newName) {
    var out = clone(df);
    var i = colIndex(out, oldName);
    out.columns[i] = newName;
    out.dtypes[newName] = out.dtypes[oldName];
    delete out.dtypes[oldName];
    return out;
  }

  function astype(df, col, target) {
    var out = clone(df);
    var i = colIndex(out, col);
    for (var r = 0; r < out.rows.length; r++) out.rows[r][i] = coerce(out.rows[r][i], target);
    out.dtypes[col] = target;
    return out;
  }

  /* ---------------- 筛选 query ---------------- */

  function compare(op, cell, val, val2) {
    var cellNull = isNull(cell);
    if (op === 'isnull') return cellNull;
    if (op === 'notnull') return !cellNull;
    if (cellNull) return false;
    var a = cell instanceof Date ? cell.getTime() : cell;
    var b = val instanceof Date ? val.getTime() : val;
    switch (op) {
      case '==': return String(a) === String(b) || a === b;
      case '!=': return !(String(a) === String(b) || a === b);
      case '>': return a > b; case '>=': return a >= b;
      case '<': return a < b; case '<=': return a <= b;
      case 'between': return a >= b && a <= (val2 instanceof Date ? val2.getTime() : val2);
      case 'contains': return String(a).toLowerCase().indexOf(String(b).toLowerCase()) >= 0;
      case 'notcontains': return String(a).toLowerCase().indexOf(String(b).toLowerCase()) < 0;
      case 'startswith': return String(a).toLowerCase().indexOf(String(b).toLowerCase()) === 0;
      case 'endswith': var sa = String(a).toLowerCase(), sb = String(b).toLowerCase();
        return sa.slice(-sb.length) === sb;
      case 'in': return String(b).split(',').map(function (s) { return s.trim(); }).indexOf(String(a)) >= 0;
    }
    return false;
  }

  /* conditions: [{col, op, value, value2}], logic: 'and' | 'or' */
  function filter(df, conditions, logic) {
    var compiled = conditions.map(function (c) {
      var i = colIndex(df, c.col), dt = df.dtypes[c.col];
      var v = c.value, v2 = c.value2;
      if (dt === 'number') { v = v === '' || v == null ? null : Number(v); v2 = v2 === '' || v2 == null ? null : Number(v2); }
      else if (dt === 'datetime') { v = parseDateLoose(v); v2 = v2 ? parseDateLoose(v2) : v2; }
      else if (dt === 'boolean') { v = /^(true|1|yes)$/i.test(String(v)); }
      return { i: i, op: c.op, v: v, v2: v2 };
    });
    var out = clone(df);
    out.rows = out.rows.filter(function (row) {
      var results = compiled.map(function (c) { return compare(c.op, row[c.i], c.v, c.v2); });
      return logic === 'or' ? results.some(Boolean) : results.every(Boolean);
    });
    return out;
  }

  /* ---------------- 排序 / 去重 ---------------- */

  function sortBy(df, specs) {
    var compiled = specs.map(function (s) { return { i: colIndex(df, s.col), asc: s.asc !== false }; });
    var out = clone(df);
    out.rows.sort(function (a, b) {
      for (var k = 0; k < compiled.length; k++) {
        var s = compiled[k], va = a[s.i], vb = b[s.i];
        var na = isNull(va), nb = isNull(vb);
        if (na && nb) continue;
        if (na) return 1; if (nb) return -1;   /* 缺失恒排最后,与 ascending 无关(pandas 语义) */
        va = va instanceof Date ? va.getTime() : va;
        vb = vb instanceof Date ? vb.getTime() : vb;
        var cmp = (typeof va === 'string' || typeof vb === 'string')
          ? String(va).localeCompare(String(vb)) : (va < vb ? -1 : va > vb ? 1 : 0);
        if (cmp !== 0) return s.asc ? cmp : -cmp;
      }
      return 0;
    });
    return out;
  }

  function dropDuplicates(df, subset) {
    var cols = subset && subset.length ? subset : df.columns;
    var idx = cols.map(function (c) { return colIndex(df, c); });
    var seen = {}, out = clone(df);
    out.rows = out.rows.filter(function (row) {
      var key = idx.map(function (i) {
        var v = row[i]; return isNull(v) ? '∅' : (v instanceof Date ? +v : typeof v + ':' + v);
      }).join('␟');
      if (seen[key]) return false;
      seen[key] = 1; return true;
    });
    return out;
  }

  /* ---------------- 缺失值 ---------------- */

  function dropna(df, subset, how) {
    var cols = subset && subset.length ? subset : df.columns;
    var idx = cols.map(function (c) { return colIndex(df, c); });
    var out = clone(df);
    out.rows = out.rows.filter(function (row) {
      var nulls = idx.filter(function (i) { return isNull(row[i]); }).length;
      return how === 'all' ? nulls < idx.length : nulls === 0;
    });
    return out;
  }

  function fillna(df, col, method, value) {
    var out = clone(df);
    var i = colIndex(out, col), dt = out.dtypes[col];
    var fill = value;
    if (method === 'mean' || method === 'median' || method === 'mode') {
      var vals = out.rows.map(function (r) { return r[i]; }).filter(function (v) { return !isNull(v); });
      if (method === 'mean') {
        var s = numericStats(vals); fill = s ? s.mean : null;
      } else if (method === 'median') {
        var s2 = numericStats(vals); fill = s2 ? s2.q50 : null;
      } else {
        var freq = {}, best = null, bn = 0;
        vals.forEach(function (v) {
          var k = formatValue(v, dt); freq[k] = (freq[k] || 0) + 1;
          if (freq[k] > bn) { bn = freq[k]; best = v; }
        });
        fill = best;
      }
    } else if (method === 'value') {
      fill = coerce(value, dt);
    }
    if (method === 'ffill' || method === 'bfill') {
      var seq = out.rows.map(function (r) { return r[i]; });
      if (method === 'ffill') {
        var last = null;
        for (var r = 0; r < seq.length; r++) { if (isNull(seq[r])) seq[r] = last; else last = seq[r]; }
      } else {
        var next = null;
        for (var r2 = seq.length - 1; r2 >= 0; r2--) { if (isNull(seq[r2])) seq[r2] = next; else next = seq[r2]; }
      }
      for (var r3 = 0; r3 < seq.length; r3++) out.rows[r3][i] = seq[r3];
    } else {
      for (var r4 = 0; r4 < out.rows.length; r4++) {
        if (isNull(out.rows[r4][i])) out.rows[r4][i] = fill;
      }
    }
    return out;
  }

  /* ---------------- 计数 / 分组 / 透视 ---------------- */

  function valueCounts(df, col) {
    var i = colIndex(df, col), freq = {}, order = [];
    df.rows.forEach(function (row) {
      var k = isNull(row[i]) ? null : formatValue(row[i], df.dtypes[col]);
      var key = k === null ? '∅NaN' : k;
      if (!(key in freq)) { freq[key] = 0; order.push(key); }
      freq[key]++;
    });
    order.sort(function (a, b) { return freq[b] - freq[a]; });
    return order.map(function (k) {
      return { value: k === '∅NaN' ? null : k, count: freq[k],
               pct: df.rows.length ? freq[k] / df.rows.length * 100 : 0 };
    });
  }

  var AGG_FUNCS = {
    sum: function (vals) { var n = vals.filter(function (v) { return typeof v === 'number'; });
      return n.length ? n.reduce(function (a, b) { return a + b; }, 0) : null; },
    mean: function (vals) { var s = numericStats(vals); return s ? s.mean : null; },
    median: function (vals) { var s = numericStats(vals); return s ? s.q50 : null; },
    min: function (vals) { var s = numericStats(vals); return s ? s.min : null; },
    max: function (vals) { var s = numericStats(vals); return s ? s.max : null; },
    std: function (vals) { var s = numericStats(vals); return s ? s.std : null; },
    count: function (vals) { return vals.filter(function (v) { return !isNull(v); }).length; },
    size: function (vals) { return vals.length; },
    nunique: function (vals) { var s = {}; vals.forEach(function (v) { if (!isNull(v)) s[formatValue(v)] = 1; });
      return Object.keys(s).length; },
    first: function (vals) { for (var i = 0; i < vals.length; i++) if (!isNull(vals[i])) return vals[i]; return null; },
    last: function (vals) { for (var i = vals.length - 1; i >= 0; i--) if (!isNull(vals[i])) return vals[i]; return null; }
  };

  function groupBy(df, keys, aggs) {
    var keyIdx = keys.map(function (k) { return colIndex(df, k); });
    var groups = {}, order = [];
    df.rows.forEach(function (row) {
      var gk = keyIdx.map(function (i) {
        var v = row[i]; return isNull(v) ? '∅' : (v instanceof Date ? formatValue(v) : String(v));
      }).join('␟');
      if (!groups[gk]) { groups[gk] = { key: keyIdx.map(function (i) { return row[i]; }), rows: [] }; order.push(gk); }
      groups[gk].rows.push(row);
    });
    var outCols = keys.slice();
    var outDtypes = {};
    keys.forEach(function (k) { outDtypes[k] = df.dtypes[k]; });
    aggs.forEach(function (a) {
      var name = a.col ? a.col + '_' + a.func : a.func;
      outCols.push(name); outDtypes[name] = 'number';
    });
    var outRows = order.map(function (gk) {
      var g = groups[gk];
      var row = g.key.slice();
      aggs.forEach(function (a) {
        var ci = a.col ? colIndex(df, a.col) : -1;
        var vals = g.rows.map(function (r) { return ci >= 0 ? r[ci] : 1; });
        row.push(AGG_FUNCS[a.func](vals));
      });
      return row;
    });
    return { columns: outCols, dtypes: outDtypes, rows: outRows, name: df.name };
  }

  function pivotTable(df, index, columns, valueCol, aggfunc) {
    var ii = colIndex(df, index), ci = colIndex(df, columns), vi = colIndex(df, valueCol);
    var rowKeys = {}, colKeys = {}, cells = {};
    df.rows.forEach(function (row) {
      var rk = isNull(row[ii]) ? '∅' : formatValue(row[ii], df.dtypes[index]);
      var ck = isNull(row[ci]) ? '∅' : formatValue(row[ci], df.dtypes[columns]);
      rowKeys[rk] = 1; colKeys[ck] = 1;
      var k = rk + '␟' + ck;
      if (!cells[k]) cells[k] = [];
      if (!isNull(row[vi])) cells[k].push(row[vi]);
    });
    var rList = Object.keys(rowKeys).sort(), cList = Object.keys(colKeys).sort();
    var outCols = [index].concat(cList);
    var outDtypes = {}; outDtypes[index] = df.dtypes[index];
    cList.forEach(function (c) { outDtypes[c] = 'number'; });
    var outRows = rList.map(function (rk) {
      var row = [rk === '∅' ? null : rk];
      cList.forEach(function (ck) {
        var vals = cells[rk + '␟' + ck] || [];
        row.push(vals.length ? AGG_FUNCS[aggfunc](vals) : null);
      });
      return row;
    });
    return { columns: outCols, dtypes: outDtypes, rows: outRows, name: df.name };
  }

  /* 相关系数矩阵(数值列两两 Pearson) */
  function corr(df) {
    var cols = numericColumns(df);
    var data = cols.map(function (c) {
      return colValues(df, c);
    });
    var matrix = cols.map(function (_, a) {
      return cols.map(function (_, b) {
        var xs = data[a], ys = data[b], pairs = [];
        for (var i = 0; i < xs.length; i++) {
          if (!isNull(xs[i]) && !isNull(ys[i])) pairs.push([xs[i], ys[i]]);
        }
        if (pairs.length < 2) return null;
        var mx = 0, my = 0;
        pairs.forEach(function (p) { mx += p[0]; my += p[1]; });
        mx /= pairs.length; my /= pairs.length;
        var sxy = 0, sxx = 0, syy = 0;
        pairs.forEach(function (p) {
          sxy += (p[0] - mx) * (p[1] - my);
          sxx += (p[0] - mx) * (p[0] - mx);
          syy += (p[1] - my) * (p[1] - my);
        });
        return (sxx === 0 || syy === 0) ? null : sxy / Math.sqrt(sxx * syy);
      });
    });
    return { columns: cols, matrix: matrix };
  }

  /* ---------------- assign:安全的表达式求值 ----------------
   * 支持:列名(标识符或 `反引号`)、数字/字符串/true/false/null 字面量、
   * + - * / % 、比较、&& || !、括号,以及白名单函数。 */
  var EXPR_FUNCS = {
    round: function (x, n) { var p = Math.pow(10, n == null ? 0 : n); return Math.round(x * p) / p; },
    abs: Math.abs, sqrt: Math.sqrt, log: Math.log, log10: Math.log10, exp: Math.exp,
    floor: Math.floor, ceil: Math.ceil,
    pow: Math.pow, min: Math.min, max: Math.max,
    len: function (s) { return s == null ? null : String(s).length; },
    upper: function (s) { return s == null ? null : String(s).toUpperCase(); },
    lower: function (s) { return s == null ? null : String(s).toLowerCase(); },
    trim: function (s) { return s == null ? null : String(s).trim(); },
    contains: function (s, sub) { return s == null ? null : String(s).indexOf(String(sub)) >= 0; },
    replace: function (s, a, b) { return s == null ? null : String(s).split(String(a)).join(String(b)); },
    substr: function (s, a, b) { return s == null ? null : String(s).substr(a, b); },
    year: function (d) { return d instanceof Date ? d.getFullYear() : null; },
    month: function (d) { return d instanceof Date ? d.getMonth() + 1 : null; },
    day: function (d) { return d instanceof Date ? d.getDate() : null; },
    weekday: function (d) { return d instanceof Date ? d.getDay() : null; },
    hour: function (d) { return d instanceof Date ? d.getHours() : null; },
    isnull: function (v) { return isNull(v); }
  };

  function tokenize(src) {
    var tokens = [], i = 0;
    while (i < src.length) {
      var ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '`') {
        var j = src.indexOf('`', i + 1);
        if (j < 0) throw new Error('Unclosed backtick');
        tokens.push({ t: 'ident', v: src.slice(i + 1, j) }); i = j + 1; continue;
      }
      if (ch === "'" || ch === '"') {
        var q = ch, s = '', k = i + 1;
        while (k < src.length && src[k] !== q) { s += src[k]; k++; }
        if (k >= src.length) throw new Error('Unclosed string');
        tokens.push({ t: 'str', v: s }); i = k + 1; continue;
      }
      var two = src.substr(i, 2);
      if (['==', '!=', '>=', '<=', '&&', '||'].indexOf(two) >= 0) {
        tokens.push({ t: 'op', v: two }); i += 2; continue;
      }
      if ('+-*/%><()!,'.indexOf(ch) >= 0) { tokens.push({ t: 'op', v: ch }); i++; continue; }
      var num = src.slice(i).match(/^\d+(\.\d+)?([eE][+-]?\d+)?/);
      if (num) { tokens.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
      var id = src.slice(i).match(/^[A-Za-z_一-龥][\w一-龥.]*/);
      if (id) {
        var w = id[0];
        if (w === 'true') tokens.push({ t: 'bool', v: true });
        else if (w === 'false') tokens.push({ t: 'bool', v: false });
        else if (w === 'null') tokens.push({ t: 'null' });
        else if (w === 'and') tokens.push({ t: 'op', v: '&&' });
        else if (w === 'or') tokens.push({ t: 'op', v: '||' });
        else if (w === 'not') tokens.push({ t: 'op', v: '!' });
        else tokens.push({ t: 'ident', v: w });
        i += w.length; continue;
      }
      throw new Error('Bad char: ' + ch);
    }
    return tokens;
  }

  function parseExpr(tokens) {
    var pos = 0;
    function peek() { return tokens[pos]; }
    function eat(v) {
      if (!peek() || (v && peek().v !== v)) throw new Error('Expected ' + v);
      return tokens[pos++];
    }
    function parseOr() {
      var l = parseAnd();
      while (peek() && peek().v === '||') { eat(); l = { op: '||', l: l, r: parseAnd() }; }
      return l;
    }
    function parseAnd() {
      var l = parseNot();
      while (peek() && peek().v === '&&') { eat(); l = { op: '&&', l: l, r: parseNot() }; }
      return l;
    }
    function parseNot() {
      if (peek() && peek().v === '!') { eat(); return { op: '!', x: parseNot() }; }
      return parseCmp();
    }
    function parseCmp() {
      var l = parseAdd();
      while (peek() && ['==', '!=', '>', '>=', '<', '<='].indexOf(peek().v) >= 0) {
        var op = eat().v; l = { op: op, l: l, r: parseAdd() };
      }
      return l;
    }
    function parseAdd() {
      var l = parseMul();
      while (peek() && (peek().v === '+' || peek().v === '-')) {
        var op = eat().v; l = { op: op, l: l, r: parseMul() };
      }
      return l;
    }
    function parseMul() {
      var l = parseUnary();
      while (peek() && ['*', '/', '%'].indexOf(peek().v) >= 0) {
        var op = eat().v; l = { op: op, l: l, r: parseUnary() };
      }
      return l;
    }
    function parseUnary() {
      if (peek() && peek().v === '-') { eat(); return { op: 'neg', x: parseUnary() }; }
      return parseAtom();
    }
    function parseAtom() {
      var tk = eat();
      if (tk.t === 'num' || tk.t === 'str' || tk.t === 'bool') return { lit: tk.v };
      if (tk.t === 'null') return { lit: null };
      if (tk.v === '(') { var e = parseOr(); eat(')'); return e; }
      if (tk.t === 'ident') {
        if (peek() && peek().v === '(') {
          eat('(');
          var args = [];
          if (!(peek() && peek().v === ')')) {
            args.push(parseOr());
            while (peek() && peek().v === ',') { eat(); args.push(parseOr()); }
          }
          eat(')');
          return { fn: tk.v, args: args };
        }
        return { col: tk.v };
      }
      throw new Error('Unexpected token');
    }
    var ast = parseOr();
    if (pos < tokens.length) throw new Error('Trailing tokens');
    return ast;
  }

  function evalAst(ast, scope) {
    if ('lit' in ast) return ast.lit;
    if (ast.col) return ast.col in scope ? scope[ast.col] : null;
    if (ast.fn) {
      var fn = EXPR_FUNCS[ast.fn];
      if (!fn) throw new Error('Unknown function: ' + ast.fn);
      var args = ast.args.map(function (a) { return evalAst(a, scope); });
      if (args.some(isNull) && ['min', 'max', 'isnull'].indexOf(ast.fn) < 0) return null;
      return fn.apply(null, args);
    }
    if (ast.op === 'neg') { var v = evalAst(ast.x, scope); return isNull(v) ? null : -v; }
    if (ast.op === '!') return !truthy(evalAst(ast.x, scope));
    if (ast.op === '&&') return truthy(evalAst(ast.l, scope)) && truthy(evalAst(ast.r, scope));
    if (ast.op === '||') return truthy(evalAst(ast.l, scope)) || truthy(evalAst(ast.r, scope));
    var a = evalAst(ast.l, scope), b = evalAst(ast.r, scope);
    if (ast.op === '==') return eq(a, b);
    if (ast.op === '!=') return !eq(a, b);
    if (isNull(a) || isNull(b)) return null;
    a = a instanceof Date ? a.getTime() : a;
    b = b instanceof Date ? b.getTime() : b;
    switch (ast.op) {
      case '+': return (typeof a === 'string' || typeof b === 'string') ? String(a) + String(b) : a + b;
      case '-': return a - b; case '*': return a * b;
      case '/': return b === 0 ? null : a / b;
      case '%': return b === 0 ? null : a % b;
      case '>': return a > b; case '>=': return a >= b;
      case '<': return a < b; case '<=': return a <= b;
    }
    return null;
  }
  function truthy(v) { return !isNull(v) && v !== false && v !== 0 && v !== ''; }
  function eq(a, b) {
    if (isNull(a) && isNull(b)) return true;
    if (isNull(a) || isNull(b)) return false;
    a = a instanceof Date ? a.getTime() : a;
    b = b instanceof Date ? b.getTime() : b;
    return a === b || String(a) === String(b);
  }

  /* df.assign(new_col = 表达式):逐行求值,自动推断新列类型 */
  function assign(df, newCol, exprSrc) {
    var ast = parseExpr(tokenize(exprSrc));
    var out = clone(df);
    var idx = colIndex(out, newCol);
    if (idx < 0) { out.columns.push(newCol); idx = out.columns.length - 1; }
    for (var r = 0; r < out.rows.length; r++) {
      var scope = {};
      for (var c = 0; c < df.columns.length; c++) scope[df.columns[c]] = out.rows[r][c];
      var v = evalAst(ast, scope);
      if (isNull(v)) v = null;
      out.rows[r][idx] = v;
    }
    out.dtypes[newCol] = inferDtype(out.rows.map(function (row) { return row[idx]; }));
    return out;
  }

  /* ---------------- 合并 / 拼接 ---------------- */

  function merge(dfA, dfB, onA, onB, how) {
    onB = onB || onA;
    var ia = colIndex(dfA, onA), ib = colIndex(dfB, onB);
    var bCols = dfB.columns.filter(function (c) { return c !== onB; });
    var bIdx = bCols.map(function (c) { return colIndex(dfB, c); });
    var bMap = {};
    dfB.rows.forEach(function (row) {
      var k = isNull(row[ib]) ? '∅' : (row[ib] instanceof Date ? +row[ib] : typeof row[ib] + ':' + row[ib]);
      if (!bMap[k]) bMap[k] = [];
      bMap[k].push(row);
    });
    var outCols = dfA.columns.concat(bCols.map(function (c) {
      return dfA.columns.indexOf(c) >= 0 ? c + '_y' : c;
    }));
    var outDtypes = {};
    dfA.columns.forEach(function (c) { outDtypes[c] = dfA.dtypes[c]; });
    bCols.forEach(function (c, i) { outDtypes[outCols[dfA.columns.length + i]] = dfB.dtypes[c]; });
    var outRows = [];
    var keyOfA = function (row) {
      var v = row[ia]; return isNull(v) ? '∅' : (v instanceof Date ? +v : typeof v + ':' + v);
    };
    var matchedB = {};
    dfA.rows.forEach(function (ra) {
      var k = keyOfA(ra), bs = bMap[k];
      if (bs) {
        bs.forEach(function (rb) {
          matchedB[k] = 1;
          outRows.push(ra.concat(bIdx.map(function (i) { return rb[i]; })));
        });
      } else if (how === 'left' || how === 'outer') {
        outRows.push(ra.concat(bIdx.map(function () { return null; })));
      }
    });
    if (how === 'right' || how === 'outer') {
      /* 键未被任何 A 行匹配过的 B 行,逐个补上(A 侧全 null) */
      dfB.rows.forEach(function (rb) {
        var k = isNull(rb[ib]) ? '∅' : (rb[ib] instanceof Date ? +rb[ib] : typeof rb[ib] + ':' + rb[ib]);
        if (matchedB[k]) return;
        var aRow = dfA.columns.map(function (c) { return c === onA ? rb[ib] : null; });
        outRows.push(aRow.concat(bIdx.map(function (i) { return rb[i]; })));
      });
    }
    return { columns: outCols, dtypes: outDtypes, rows: outRows, name: dfA.name };
  }

  function concat(dfA, dfB) {
    var cols = dfA.columns.filter(function (c) { return dfB.columns.indexOf(c) >= 0; });
    var pickA = cols.map(function (c) { return colIndex(dfA, c); });
    var pickB = cols.map(function (c) { return colIndex(dfB, c); });
    var outDtypes = {};
    cols.forEach(function (c) { outDtypes[c] = dfA.dtypes[c]; });
    return {
      columns: cols, dtypes: outDtypes, name: dfA.name,
      rows: dfA.rows.map(function (r) { return pickA.map(function (i) { return r[i]; }); })
        .concat(dfB.rows.map(function (r) { return pickB.map(function (i) { return r[i]; }); }))
    };
  }

  /* 等宽分箱(pd.cut):返回新 df,新列 = 区间标签 */
  function cut(df, col, bins, newCol) {
    var vals = colValues(df, col).filter(function (v) { return typeof v === 'number'; });
    if (!vals.length) throw new Error('no numeric values');
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var w = (mx - mn) / bins || 1;
    var out = clone(df);
    var i = colIndex(out, col);
    out.columns.push(newCol); var ni = out.columns.length - 1;
    for (var r = 0; r < out.rows.length; r++) {
      var v = out.rows[r][i];
      if (typeof v !== 'number' || isNaN(v)) { out.rows[r][ni] = null; continue; }
      var b = Math.min(bins - 1, Math.floor((v - mn) / w));
      var lo = mn + b * w, hi = lo + w;
      out.rows[r][ni] = formatValue(Math.round(lo * 100) / 100) + ' ~ ' + formatValue(Math.round(hi * 100) / 100);
    }
    out.dtypes[newCol] = 'string';
    return out;
  }

  /* ---------------- 时序:重采样 / 滚动均值 / 环比 ---------------- */

  /* 把一个单元格值转成 Date(已是 Date 直接用,字符串走宽松解析),失败返回 null */
  function toDateLoose(v) {
    if (isNull(v)) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    return parseDateLoose(v);
  }

  /* 分桶键:'D'→YYYY-MM-DD;'W'→该周周一的 YYYY-MM-DD;'M'→YYYY-MM(字典序即时间序) */
  function bucketKey(d, rule) {
    if (rule === 'M') return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    if (rule === 'W') {
      var back = (d.getDay() + 6) % 7;   /* 距本周周一的天数(周一为一周之首) */
      var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
      return mon.getFullYear() + '-' + pad(mon.getMonth() + 1) + '-' + pad(mon.getDate());
    }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* df.resample(rule, on=dateCol)[col].agg():按周期分桶聚合,返回列 [dateCol, col] 的新表 */
  function resample(df, dateCol, rule, col, agg) {
    var di = colIndex(df, dateCol), ci = colIndex(df, col);
    var fn = AGG_FUNCS[agg];
    if (!fn) throw new Error('unknown agg: ' + agg);
    var buckets = {}, order = [];
    for (var r = 0; r < df.rows.length; r++) {
      var d = toDateLoose(df.rows[r][di]);
      if (!d) continue;   /* 日期无法解析的行跳过 */
      var key = bucketKey(d, rule);
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(df.rows[r][ci]);
    }
    if (!order.length) throw new Error('no valid dates');
    order.sort();
    var outRows = order.map(function (k) {
      var vals = buckets[k];
      /* 聚合只吃非空数值;count 例外,数非空个数 */
      var nums = vals.filter(function (v) { return typeof v === 'number' && !isNaN(v); });
      return [k, agg === 'count' ? AGG_FUNCS.count(vals) : fn(nums)];
    });
    var outDtypes = {};
    outDtypes[dateCol] = 'string';
    outDtypes[col] = 'number';
    return { columns: [dateCol, col], dtypes: outDtypes, rows: outRows, name: df.name };
  }

  /* df[newCol] = df[col].rolling(w).mean():尾部 w 期窗口均值,
     有效(非空数值)样本不足 w 的行填 null,与 pandas 默认 min_periods=w 一致 */
  function rollAdd(df, col, w, newCol) {
    w = Math.max(1, Math.floor(+w || 1));
    var out = clone(df);
    var i = colIndex(out, col);
    var ni = colIndex(out, newCol);
    if (ni < 0) { out.columns.push(newCol); ni = out.columns.length - 1; }
    out.dtypes[newCol] = 'number';
    var vals = out.rows.map(function (r) { return r[i]; });
    for (var r2 = 0; r2 < out.rows.length; r2++) {
      var sum = 0, nums = 0;
      for (var k = Math.max(0, r2 - w + 1); k <= r2; k++) {
        var v = vals[k];
        if (typeof v === 'number' && !isNaN(v)) { sum += v; nums++; }
      }
      out.rows[r2][ni] = (r2 < w - 1 || nums < w) ? null : sum / nums;
    }
    return out;
  }

  /* df[newCol] = df[col].pct_change():环比 = 本期 / 上期 − 1;
     首行、前值为 null 或 0、本期非数值的行填 null */
  function pctChange(df, col, newCol) {
    var out = clone(df);
    var i = colIndex(out, col);
    var ni = colIndex(out, newCol);
    if (ni < 0) { out.columns.push(newCol); ni = out.columns.length - 1; }
    out.dtypes[newCol] = 'number';
    var prev = null;
    for (var r = 0; r < out.rows.length; r++) {
      var v = out.rows[r][i];
      if (typeof v === 'number' && !isNaN(v) && typeof prev === 'number' && prev !== 0) {
        out.rows[r][ni] = (v - prev) / prev;
      } else {
        out.rows[r][ni] = null;
      }
      prev = (typeof v === 'number' && !isNaN(v)) ? v : null;
    }
    return out;
  }

  /* ---------------- CSV 读写 ---------------- */

  function parseCSV(text) {
    var rows = [], row = [], field = '', inQ = false;
    text = String(text).replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function dfFromCSV(text, name) {
    var grid = parseCSV(text);
    if (!grid.length) throw new Error('empty csv');
    var columns = grid[0].map(function (s, i) { return String(s).trim() || ('col_' + (i + 1)); });
    var width = columns.length;
    var rows = grid.slice(1).filter(function (r) {
      return r.some(function (c) { return String(c).trim() !== ''; });
    }).map(function (r) {
      var out = new Array(width);
      for (var i = 0; i < width; i++) {
        var v = r[i] != null ? String(r[i]).trim() : '';
        out[i] = v === '' ? null : v;
      }
      return out;
    });
    return create(columns, rows, name || 'df');
  }

  function dfFromJSON(json, name) {
    var arr = Array.isArray(json) ? json : (json.data || json.rows || []);
    if (!Array.isArray(arr) || !arr.length) throw new Error('json: expect array of objects');
    var colSet = {}, columns = [];
    arr.forEach(function (o) {
      Object.keys(o).forEach(function (k) {
        if (!colSet[k]) { colSet[k] = 1; columns.push(k); }
      });
    });
    var rows = arr.map(function (o) {
      return columns.map(function (c) { return o[c] == null ? null : o[c]; });
    });
    return create(columns, rows, name || 'df');
  }

  function toCSV(df) {
    function esc(v, dt) {
      var s = formatValue(v, dt);
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lines = [df.columns.map(function (c) { return esc(c, 'string'); }).join(',')];
    df.rows.forEach(function (row) {
      lines.push(row.map(function (v, i) { return esc(v, df.dtypes[df.columns[i]]); }).join(','));
    });
    return lines.join('\r\n');
  }

  /* ---------------- 导出 ---------------- */

  window.MiniPD = {
    create: create, clone: clone, shape: shape,
    head: head, tail: tail, sample: sample,
    info: info, describe: describe, numericStats: numericStats,
    selectColumns: selectColumns, dropColumns: dropColumns,
    renameColumn: renameColumn, astype: astype,
    filter: filter, sortBy: sortBy, dropDuplicates: dropDuplicates,
    dropna: dropna, fillna: fillna,
    valueCounts: valueCounts, groupBy: groupBy, pivotTable: pivotTable, corr: corr,
    resample: resample, rollAdd: rollAdd, pctChange: pctChange,
    assign: assign, merge: merge, concat: concat, cut: cut,
    colValues: colValues, numericColumns: numericColumns, colIndex: colIndex,
    dfFromCSV: dfFromCSV, dfFromJSON: dfFromJSON, toCSV: toCSV,
    formatValue: formatValue, isNull: isNull, parseDateLoose: parseDateLoose,
    AGG_FUNCS: Object.keys(AGG_FUNCS),
    EXPR_FUNCS: Object.keys(EXPR_FUNCS)
  };
}());
