/* =========================================================
 * app.js —— Vis3 应用主逻辑
 * ---------------------------------------------------------
 * 状态模型(对齐 pandas 的工作方式):
 *   每个数据集 = { original, steps, redoStack, codeLog, page }
 *   steps:会改变 df 的操作(可撤销 / 重做,逐步重放得到当前表)
 *   codeLog:所有操作(含 head / 图表等只读操作)对应的 pandas 代码
 * 左侧点操作 → 弹窗配参数 → 应用 → 表格 / 结果 / 图表 / 代码四处联动刷新。
 * ========================================================= */
(function () {
  'use strict';

  var PD = window.MiniPD;
  var CH = window.MiniCharts;
  var DATA = window.VIS3_DATA;
  var ML = window.MiniML;

  /* ================= 小工具 ================= */

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function t(key, vars) { return window.I18N.t(key, vars); }

  var toastTimer = null;
  function toast(msg, isErr) {
    var box = $('toast');
    box.textContent = msg;
    box.classList.toggle('toast-err', !!isErr);
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 2600);
  }

  /* ================= 数据集状态 ================= */

  var datasets = {};      /* name -> state */
  var activeName = null;

  function cur() { return datasets[activeName]; }

  function dfOf(state) {
    var df = state.original;
    for (var i = 0; i < state.steps.length; i++) df = state.steps[i].apply(df);
    return df;
  }
  function currentDf() { return dfOf(cur()); }

  function registerDataset(name, df) {
    var base = name, i = 2;
    while (datasets[name]) { name = base + '_' + i; i++; }
    df.name = name;
    datasets[name] = {
      original: df, steps: [], redoStack: [], page: 1,
      codeLog: [{ code: "df = pd.read_csv('" + name + ".csv')", comment: null }]
    };
    return name;
  }

  function switchDataset(name, silent) {
    activeName = name;
    mainFilter = null;   /* 筛选条件属于旧数据集,切表时还原 */
    renderAll();
    if (!silent) toast(t('msg.switched', { name: name }));
  }

  /* ================= 操作注册表 =================
   * 每个操作:
   *   group    侧边栏分组
   *   mutating 是否改变当前表(进入 steps,可撤销)
   *   dialog   (body, params) => 构建表单;params 供控件初值
   *   collect  (body) => params | 抛错
   *   apply    (df, params) => 新 df                (mutating)
   *   run      (df, params) => {result|chart} 渲染   (只读)
   *   code     (params) => python 代码行
   *   cmt      代码注释的 i18n key
   */

  var AGGS = ['sum', 'mean', 'median', 'min', 'max', 'std', 'count', 'nunique', 'first', 'last', 'size'];
  var FILTER_OPS = ['==', '!=', '>', '>=', '<', '<=', 'between', 'contains', 'notcontains',
                    'startswith', 'endswith', 'in', 'isnull', 'notnull'];
  var FOP_KEYS = { '==': 'fop.eq', '!=': 'fop.ne', '>': 'fop.gt', '>=': 'fop.ge', '<': 'fop.lt',
    '<=': 'fop.le', 'between': 'fop.between', 'contains': 'fop.contains',
    'notcontains': 'fop.notcontains', 'startswith': 'fop.startswith', 'endswith': 'fop.endswith',
    'in': 'fop.in', 'isnull': 'fop.isnull', 'notnull': 'fop.notnull' };

  function pyVal(v, dtype) {
    if (v == null) return '';
    if (dtype === 'number') return String(v);
    if (dtype === 'datetime') return "'" + v + "'";
    return "'" + String(v).replace(/'/g, "\\'") + "'";
  }

  /* 把表达式里的裸列名替换成 df['列名'],用于生成 pandas 代码 */
  function pyExpr(expr, df) {
    var out = expr;
    var cols = df.columns.slice().sort(function (a, b) { return b.length - a.length; });
    cols.forEach(function (c) {
      if (!/^[A-Za-z_一-龥][\w一-龥]*$/.test(c)) return;
      out = out.replace(new RegExp('(^|[^\\w一-龥\'\\]])' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w一-龥]*\\()', 'g'),
        function (m, p1) { return p1 + "df['" + c + "']"; });
    });
    return out.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ')
      .replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None');
  }

  function condCode(df, c) {
    var ref = "df['" + c.col + "']";
    var dt = df.dtypes[c.col];
    switch (c.op) {
      case 'isnull': return ref + '.isna()';
      case 'notnull': return ref + '.notna()';
      case 'contains': return ref + '.str.contains(' + pyVal(c.value) + ', na=False)';
      case 'notcontains': return '~' + ref + '.str.contains(' + pyVal(c.value) + ', na=False)';
      case 'startswith': return ref + '.str.startswith(' + pyVal(c.value) + ', na=False)';
      case 'endswith': return ref + '.str.endswith(' + pyVal(c.value) + ', na=False)';
      case 'in':
        return ref + '.isin([' + String(c.value).split(',').map(function (s) {
          return pyVal(s.trim(), dt);
        }).join(', ') + '])';
      case 'between':
        return ref + '.between(' + pyVal(c.value, dt) + ', ' + pyVal(c.value2, dt) + ')';
      default: return ref + ' ' + c.op + ' ' + pyVal(c.value, dt);
    }
  }

  var OPS = {
    /* ---------- 查看(只读,结果面板) ---------- */
    head: {
      group: 'inspect', cmt: 'op.head',
      dialog: function (b) { b.appendChild(numberField('n', t('f.n'), 5, 1, 9999)); },
      collect: function (b) { return { n: +val(b, 'n') || 5 }; },
      run: function (df, p) { return resultDf(t('op.head'), PD.head(df, p.n)); },
      code: function (p) { return 'df.head(' + p.n + ')'; }
    },
    tail: {
      group: 'inspect', cmt: 'op.tail',
      dialog: function (b) { b.appendChild(numberField('n', t('f.n'), 5, 1, 9999)); },
      collect: function (b) { return { n: +val(b, 'n') || 5 }; },
      run: function (df, p) { return resultDf(t('op.tail'), PD.tail(df, p.n)); },
      code: function (p) { return 'df.tail(' + p.n + ')'; }
    },
    sample: {
      group: 'inspect', cmt: 'op.sample',
      dialog: function (b) { b.appendChild(numberField('n', t('f.n'), 5, 1, 9999)); },
      collect: function (b) { return { n: +val(b, 'n') || 5 }; },
      run: function (df, p) { return resultDf(t('op.sample'), PD.sample(df, p.n)); },
      code: function (p) { return 'df.sample(' + p.n + ')'; }
    },
    info: {
      group: 'inspect', cmt: 'op.info',
      dialog: null,
      run: function (df) { return resultInfo(df); },
      code: function () { return 'df.info()'; }
    },
    describe: {
      group: 'inspect', cmt: 'op.describe',
      dialog: null,
      run: function (df) { return resultDescribe(df); },
      code: function () { return 'df.describe(include=\'all\')'; }
    },
    missingmap: {
      group: 'inspect', cmt: 'op.missingmap',
      dialog: null,
      run: function (df) { return resultMissingMap(df); },
      chart: function (df) {
        var stats = missingStats(df);
        var total = 0;
        stats.forEach(function (s) { total += s.cnt; });
        if (!total) return null;   /* 全表无缺失:不出图(结果面板已给提示文案) */
        return { type: 'bar',
                 categories: stats.map(function (s) { return s.col; }),
                 values: stats.map(function (s) { return s.cnt; }),
                 title: t('op.missingmap'), yLabel: t('res.missCnt') };
      },
      code: function () { return 'missing = df.isna().sum().sort_values(ascending=False)'; }
    },

    /* ---------- 行列 ---------- */
    select: {
      group: 'select', mutating: true, cmt: 'op.select',
      dialog: function (b, df) { b.appendChild(checkList('cols', t('f.columns'), df.columns, true)); },
      collect: function (b) {
        var cols = checkedVals(b, 'cols');
        if (!cols.length) throw new Error(t('f.columns'));
        return { cols: cols };
      },
      apply: function (df, p) { return PD.selectColumns(df, p.cols); },
      code: function (p) { return 'df = df[[' + p.cols.map(function (c) { return "'" + c + "'"; }).join(', ') + ']]'; }
    },
    drop: {
      group: 'select', mutating: true, cmt: 'op.drop',
      dialog: function (b, df) { b.appendChild(checkList('cols', t('f.columns'), df.columns, false)); },
      collect: function (b) {
        var cols = checkedVals(b, 'cols');
        if (!cols.length) throw new Error(t('f.columns'));
        return { cols: cols };
      },
      apply: function (df, p) { return PD.dropColumns(df, p.cols); },
      code: function (p) { return 'df = df.drop(columns=[' + p.cols.map(function (c) { return "'" + c + "'"; }).join(', ') + '])'; }
    },
    rename: {
      group: 'select', mutating: true, cmt: 'op.rename',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.column'), df.columns));
        b.appendChild(textField('name', t('f.newname'), ''));
      },
      collect: function (b) {
        var name = val(b, 'name').trim();
        if (!name) throw new Error(t('f.newname'));
        return { col: val(b, 'col'), name: name };
      },
      apply: function (df, p) { return PD.renameColumn(df, p.col, p.name); },
      code: function (p) { return "df = df.rename(columns={'" + p.col + "': '" + p.name + "'})"; }
    },
    astype: {
      group: 'select', mutating: true, cmt: 'op.astype',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.column'), df.columns));
        b.appendChild(selectField('type', t('f.type'),
          ['number', 'string', 'datetime', 'boolean'].map(function (d) {
            return { v: d, label: t('type.' + d) };
          })));
      },
      collect: function (b) { return { col: val(b, 'col'), type: val(b, 'type') }; },
      apply: function (df, p) { return PD.astype(df, p.col, p.type); },
      code: function (p) {
        if (p.type === 'datetime') return "df['" + p.col + "'] = pd.to_datetime(df['" + p.col + "'])";
        if (p.type === 'number') return "df['" + p.col + "'] = pd.to_numeric(df['" + p.col + "'], errors='coerce')";
        return "df['" + p.col + "'] = df['" + p.col + "'].astype('" + (p.type === 'boolean' ? 'bool' : 'str') + "')";
      }
    },

    /* ---------- 清洗 ---------- */
    filter: {
      group: 'clean', mutating: true, cmt: 'op.filter',
      dialog: function (b, df) {
        b.appendChild(dynConditions(df));
        b.appendChild(selectField('logic', t('f.logic'), [
          { v: 'and', label: t('f.and') }, { v: 'or', label: t('f.or') }
        ]));
      },
      collect: function (b) { return { conds: collectConds(b), logic: val(b, 'logic') }; },
      apply: function (df, p) { return PD.filter(df, p.conds, p.logic); },
      code: function (p, df) {
        var parts = p.conds.map(function (c) { return condCode(df, c); });
        var joiner = p.logic === 'or' ? ' | ' : ' & ';
        return 'df = df[' + parts.map(function (s) { return '(' + s + ')'; }).join(joiner) + ']';
      }
    },
    sort: {
      group: 'clean', mutating: true, cmt: 'op.sort',
      dialog: function (b, df) { b.appendChild(dynSorts(df)); },
      collect: function (b) { return { specs: collectSorts(b) }; },
      apply: function (df, p) { return PD.sortBy(df, p.specs); },
      code: function (p) {
        return 'df = df.sort_values([' + p.specs.map(function (s) { return "'" + s.col + "'"; }).join(', ') +
          '], ascending=[' + p.specs.map(function (s) { return s.asc ? 'True' : 'False'; }).join(', ') + '])';
      }
    },
    dedup: {
      group: 'clean', mutating: true, cmt: 'op.dedup',
      dialog: function (b, df) {
        b.appendChild(checkList('subset', t('f.subset'), df.columns, false));
      },
      collect: function (b) { return { subset: checkedVals(b, 'subset') }; },
      apply: function (df, p) { return PD.dropDuplicates(df, p.subset); },
      code: function (p) {
        return 'df = df.drop_duplicates(' + (p.subset.length ?
          'subset=[' + p.subset.map(function (c) { return "'" + c + "'"; }).join(', ') + ']' : '') + ')';
      }
    },
    dropna: {
      group: 'clean', mutating: true, cmt: 'op.dropna',
      dialog: function (b, df) {
        b.appendChild(checkList('subset', t('f.subset'), df.columns, false));
        b.appendChild(selectField('how', t('f.how'), [
          { v: 'any', label: t('f.howAny') }, { v: 'all', label: t('f.howAll') }
        ]));
      },
      collect: function (b) { return { subset: checkedVals(b, 'subset'), how: val(b, 'how') }; },
      apply: function (df, p) { return PD.dropna(df, p.subset, p.how); },
      code: function (p) {
        return 'df = df.dropna(how=\'' + p.how + '\'' + (p.subset.length ?
          ', subset=[' + p.subset.map(function (c) { return "'" + c + "'"; }).join(', ') + ']' : '') + ')';
      }
    },
    fillna: {
      group: 'clean', mutating: true, cmt: 'op.fillna',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.column'), df.columns));
        b.appendChild(selectField('method', t('f.method'),
          ['value', 'mean', 'median', 'mode', 'ffill', 'bfill'].map(function (m) {
            return { v: m, label: t('fill.' + m) };
          })));
        b.appendChild(textField('value', t('f.value') + ' (' + t('fill.value') + ')', '0'));
      },
      collect: function (b) {
        return { col: val(b, 'col'), method: val(b, 'method'), value: val(b, 'value') };
      },
      apply: function (df, p) { return PD.fillna(df, p.col, p.method, p.value); },
      code: function (p) {
        var ref = "df['" + p.col + "']";
        if (p.method === 'value') return ref + ' = ' + ref + '.fillna(' + pyVal(p.value) + ')';
        if (p.method === 'mean' || p.method === 'median' || p.method === 'mode') {
          return ref + ' = ' + ref + '.fillna(' + ref + '.' + (p.method === 'mode' ? 'mode()[0]' : p.method + '()') + ')';
        }
        return ref + ' = ' + ref + '.' + p.method + '()';
      }
    },

    /* ---------- 变换 ---------- */
    assign: {
      group: 'transform', mutating: true, cmt: 'op.assign',
      dialog: function (b, df) {
        b.appendChild(textField('newcol', t('f.newcol'), 'new_col'));
        b.appendChild(textField('expr', t('f.expr'), ''));
        b.appendChild(el('p', { class: 'modal-note', text: t('f.exprHint') }));
      },
      collect: function (b) {
        var name = val(b, 'newcol').trim(), expr = val(b, 'expr').trim();
        if (!name || !expr) throw new Error(t('f.expr'));
        return { newcol: name, expr: expr };
      },
      apply: function (df, p) { return PD.assign(df, p.newcol, p.expr); },
      code: function (p, df) { return "df['" + p.newcol + "'] = " + pyExpr(p.expr, df); }
    },
    cut: {
      group: 'transform', mutating: true, cmt: 'op.cut',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.column'), PD.numericColumns(df)));
        b.appendChild(numberField('bins', t('f.bins'), 5, 2, 50));
        b.appendChild(textField('newcol', t('f.newcol'), val(b, 'col') ? val(b, 'col') + '_bin' : 'bin'));
      },
      collect: function (b) {
        return { col: val(b, 'col'), bins: +val(b, 'bins') || 5,
                 newcol: val(b, 'newcol').trim() || val(b, 'col') + '_bin' };
      },
      apply: function (df, p) { return PD.cut(df, p.col, p.bins, p.newcol); },
      code: function (p) { return "df['" + p.newcol + "'] = pd.cut(df['" + p.col + "'], bins=" + p.bins + ')'; }
    },
    merge: {
      group: 'transform', mutating: true, cmt: 'op.merge', needOther: true,
      dialog: function (b, df) {
        var others = otherDatasets();
        b.appendChild(selectField('other', t('f.other'), others.map(function (o) {
          return { v: o, label: o };
        })));
        b.appendChild(columnField('on', t('f.on'), df.columns));
        b.appendChild(textField('onOther', t('f.onOther'), ''));
        b.appendChild(selectField('how', t('f.howJoin'),
          ['inner', 'left', 'right', 'outer'].map(function (h) {
            return { v: h, label: t('join.' + h) };
          })));
      },
      collect: function (b) {
        return { other: val(b, 'other'), on: val(b, 'on'),
                 onOther: val(b, 'onOther').trim(), how: val(b, 'how') };
      },
      apply: function (df, p) {
        var other = dfOf(datasets[p.other]);
        return PD.merge(df, other, p.on, p.onOther || p.on, p.how);
      },
      code: function (p) {
        return "df = df.merge(" + p.other + ", left_on='" + p.on + "', right_on='" +
          (p.onOther || p.on) + "', how='" + p.how + "')";
      }
    },
    concat: {
      group: 'transform', mutating: true, cmt: 'op.concat', needOther: true,
      dialog: function (b) {
        b.appendChild(selectField('other', t('f.other'), otherDatasets().map(function (o) {
          return { v: o, label: o };
        })));
      },
      collect: function (b) { return { other: val(b, 'other') }; },
      apply: function (df, p) { return PD.concat(df, dfOf(datasets[p.other])); },
      code: function (p) { return 'df = pd.concat([df, ' + p.other + '], ignore_index=True)'; }
    },

    /* ---------- 汇总 ---------- */
    groupby: {
      group: 'agg', mutating: true, cmt: 'op.groupby',
      dialog: function (b, df) {
        b.appendChild(checkList('keys', t('f.keys'), df.columns, false));
        b.appendChild(dynAggs(df));
      },
      collect: function (b) {
        var keys = checkedVals(b, 'keys');
        if (!keys.length) throw new Error(t('f.keys'));
        return { keys: keys, aggs: collectAggs(b) };
      },
      apply: function (df, p) { return PD.groupBy(df, p.keys, p.aggs); },
      code: function (p) {
        var aggs = p.aggs.map(function (a) {
          if (a.func === 'size') return "size=('" + (p.keys[0]) + "', 'size')";
          return (a.col + '_' + a.func) + "=('" + a.col + "', '" + a.func + "')";
        });
        return 'df = df.groupby([' + p.keys.map(function (k) { return "'" + k + "'"; }).join(', ') +
          ']).agg(' + aggs.join(', ') + ').reset_index()';
      }
    },
    pivot: {
      group: 'agg', mutating: true, cmt: 'op.pivot',
      dialog: function (b, df) {
        b.appendChild(columnField('index', t('f.index'), df.columns));
        b.appendChild(columnField('pivotCols', t('f.pivotCols'), df.columns));
        b.appendChild(columnField('values', t('f.values'), PD.numericColumns(df)));
        b.appendChild(selectField('aggfunc', t('f.aggfunc'),
          ['sum', 'mean', 'count', 'min', 'max', 'median'].map(function (f) {
            return { v: f, label: f };
          })));
      },
      collect: function (b) {
        return { index: val(b, 'index'), columns: val(b, 'pivotCols'),
                 values: val(b, 'values'), aggfunc: val(b, 'aggfunc') };
      },
      apply: function (df, p) { return PD.pivotTable(df, p.index, p.columns, p.values, p.aggfunc); },
      code: function (p) {
        return "df = df.pivot_table(index='" + p.index + "', columns='" + p.columns +
          "', values='" + p.values + "', aggfunc='" + p.aggfunc + "')";
      }
    },
    valuecounts: {
      group: 'agg', cmt: 'op.valuecounts',
      dialog: function (b, df) { b.appendChild(columnField('col', t('f.column'), df.columns)); },
      collect: function (b) { return { col: val(b, 'col') }; },
      run: function (df, p) { return resultValueCounts(df, p.col); },
      /* value_counts 的天然搭档:计数完成即自动联动环形图 */
      chart: function (df, p) {
        return pieSpecOf(df, p.col, '', 0.55, 'value_counts · ' + p.col);
      },
      code: function (p) { return "df['" + p.col + "'].value_counts()"; }
    },
    corr: {
      group: 'agg', cmt: 'op.corr',
      dialog: null,
      run: function (df) { return resultCorr(df); },
      code: function () { return 'df.corr(numeric_only=True)'; }
    },

    /* ---------- 时序(mutating:应用后新表进 steps,同时联动结果与图表) ---------- */
    resample: {
      group: 'ts', mutating: true, cmt: 'op.resample',
      dialog: function (b, df) {
        var dateCols = df.columns.filter(function (c) { return df.dtypes[c] === 'datetime'; });
        b.appendChild(columnField('date', t('f.dateCol'), dateCols));
        b.appendChild(selectField('rule', t('f.rule'), [
          { v: 'D', label: t('f.ruleD') },
          { v: 'W', label: t('f.ruleW') },
          { v: 'M', label: t('f.ruleM') }
        ]));
        b.appendChild(columnField('col', t('f.y'), PD.numericColumns(df)));
        b.appendChild(selectField('agg', t('f.aggfunc'),
          ['mean', 'sum', 'min', 'max', 'count'].map(function (f) {
            return { v: f, label: f };
          })));
      },
      collect: function (b) {
        return { date: val(b, 'date'), rule: val(b, 'rule') || 'D',
                 col: val(b, 'col'), agg: val(b, 'agg') || 'mean' };
      },
      apply: function (df, p) { return PD.resample(df, p.date, p.rule, p.col, p.agg); },
      run: function (ndf) { return resultDf(t('op.resample'), ndf); },
      chart: function (ndf, p) {
        return { type: 'line',
                 x: ndf.rows.map(function (r) { return PD.formatValue(r[0]); }),
                 series: [{ name: p.col, values: ndf.rows.map(function (r) { return r[1]; }) }],
                 title: p.agg + '(' + p.col + ') by ' + p.date + ' · ' + p.rule,
                 xLabel: p.date, yLabel: p.col };
      },
      code: function (p) {
        return "df = df.resample('" + p.rule + "', on='" + p.date + "')['" + p.col + "']." +
          p.agg + '().reset_index()';
      }
    },
    rolling: {
      group: 'ts', mutating: true, cmt: 'op.rolling',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.y'), PD.numericColumns(df)));
        b.appendChild(numberField('w', t('f.window'), 7, 2, 365));
      },
      collect: function (b) {
        var w = Math.max(2, +val(b, 'w') || 7);
        return { col: val(b, 'col'), w: w, newcol: val(b, 'col') + '_ma' + w };
      },
      apply: function (df, p) { return PD.rollAdd(df, p.col, p.w, p.newcol); },
      run: function (ndf, p) {
        var node = el('div');
        node.appendChild(el('p', { class: 'result-note', text: t('res.newCol', { col: p.newcol }) }));
        return { title: t('op.rolling') + ' · ' + p.col, node: node };
      },
      chart: function (ndf, p) {
        return { type: 'line', x: tsXLabels(ndf),
                 series: [
                   { name: p.col, values: PD.colValues(ndf, p.col) },
                   { name: p.newcol, values: PD.colValues(ndf, p.newcol) }
                 ],
                 title: t('op.rolling') + ' · w=' + p.w, xLabel: tsXName(ndf), yLabel: p.col };
      },
      code: function (p) {
        return "df['" + p.newcol + "'] = df['" + p.col + "'].rolling(" + p.w + ').mean()';
      }
    },
    pctchange: {
      group: 'ts', mutating: true, cmt: 'op.pctchange',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.y'), PD.numericColumns(df)));
      },
      collect: function (b) {
        return { col: val(b, 'col'), newcol: val(b, 'col') + '_pct' };
      },
      apply: function (df, p) { return PD.pctChange(df, p.col, p.newcol); },
      run: function (ndf, p) {
        var node = el('div');
        node.appendChild(el('p', { class: 'result-note', text: t('res.newCol', { col: p.newcol }) }));
        return { title: t('op.pctchange') + ' · ' + p.col, node: node };
      },
      chart: function (ndf, p) {
        return { type: 'line', x: tsXLabels(ndf),
                 series: [{ name: p.newcol, values: PD.colValues(ndf, p.newcol) }],
                 title: t('op.pctchange') + ' · ' + p.newcol, xLabel: tsXName(ndf), yLabel: p.newcol };
      },
      code: function (p) {
        return "df['" + p.newcol + "'] = df['" + p.col + "'].pct_change()";
      }
    },

    /* ---------- 可视化(只读,图表面板) ---------- */
    hist: {
      group: 'viz', cmt: 'op.hist',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.column'), PD.numericColumns(df)));
        b.appendChild(numberField('bins', t('f.bins'), 12, 3, 60));
      },
      collect: function (b) { return { col: val(b, 'col'), bins: +val(b, 'bins') || 12 }; },
      chart: function (df, p) {
        return { type: 'hist', values: PD.colValues(df, p.col), bins: p.bins,
                 title: t('op.hist') + ' · ' + p.col, xLabel: p.col, yLabel: t('res.count') };
      },
      code: function (p) { return "df['" + p.col + "'].plot(kind='hist', bins=" + p.bins + ')'; }
    },
    bar: {
      group: 'viz', cmt: 'op.bar',
      dialog: function (b, df) {
        b.appendChild(columnField('x', t('f.x'), df.columns));
        b.appendChild(columnField('y', t('f.y'), PD.numericColumns(df)));
        b.appendChild(selectField('func', t('f.aggfunc'),
          ['sum', 'mean', 'count', 'min', 'max', 'median'].map(function (f) {
            return { v: f, label: f };
          })));
      },
      collect: function (b) { return { x: val(b, 'x'), y: val(b, 'y'), func: val(b, 'func') }; },
      chart: function (df, p) {
        var g = PD.groupBy(df, [p.x], [{ col: p.y, func: p.func }]);
        g = PD.sortBy(g, [{ col: g.columns[1], asc: false }]).rows.slice(0, 20);
        return { type: 'bar',
                 categories: g.map(function (r) { return PD.formatValue(r[0]); }),
                 values: g.map(function (r) { return r[1] || 0; }),
                 title: p.func + '(' + p.y + ') by ' + p.x, xLabel: p.x, yLabel: p.y };
      },
      code: function (p) {
        return "df.groupby('" + p.x + "')['" + p.y + "']." + p.func + "().plot(kind='bar')";
      }
    },
    pie: {
      group: 'viz', cmt: 'op.pie',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.catCol'), df.columns));
        var numOpts = [{ v: '', label: t('f.pieCount') }].concat(PD.numericColumns(df).map(function (c) {
          return { v: c, label: c + ' (sum)' };
        }));
        b.appendChild(selectField('size', t('f.sizeCol'), numOpts));
        b.appendChild(selectField('style', t('f.pieStyle'), [
          { v: 'pie', label: t('f.pie') },
          { v: 'donut', label: t('f.donut') }
        ]));
      },
      collect: function (b) {
        return { col: val(b, 'col'), size: val(b, 'size'), style: val(b, 'style') };
      },
      chart: function (df, p) {
        return pieSpecOf(df, p.col, p.size, p.style === 'donut' ? 0.55 : 0,
          (p.size ? 'sum(' + p.size + ')' : 'count') + ' by ' + p.col);
      },
      code: function (p) {
        var plot = p.style === 'donut' ? "plot(kind='pie', wedgeprops=dict(width=0.45))" : "plot(kind='pie')";
        return p.size
          ? "df.groupby('" + p.col + "')['" + p.size + "'].sum()." + plot
          : "df['" + p.col + "'].value_counts()." + plot;
      }
    },
    line: {
      group: 'viz', cmt: 'op.line',
      dialog: function (b, df) {
        b.appendChild(columnField('x', t('f.x'), df.columns));
        b.appendChild(columnField('y', t('f.y'), PD.numericColumns(df)));
        var opts = [{ v: '', label: '—' }].concat(df.columns.map(function (c) {
          return { v: c, label: c };
        }));
        b.appendChild(selectField('series', t('f.series'), opts));
      },
      collect: function (b) {
        return { x: val(b, 'x'), y: val(b, 'y'), series: val(b, 'series') || null };
      },
      chart: function (df, p) {
        if (p.series) {
          var pv = PD.pivotTable(df, p.x, p.series, p.y, 'sum');
          var xLabels = pv.rows.map(function (r) { return PD.formatValue(r[0]); });
          return { type: 'line', x: xLabels,
                   series: pv.columns.slice(1).map(function (c, i) {
                     return { name: c, values: pv.rows.map(function (r) { return r[i + 1]; }) };
                   }),
                   title: 'sum(' + p.y + ') by ' + p.x + ' / ' + p.series, xLabel: p.x, yLabel: p.y };
        }
        var g = PD.groupBy(df, [p.x], [{ col: p.y, func: 'sum' }]);
        g = PD.sortBy(g, [{ col: p.x, asc: true }]);
        return { type: 'line',
                 x: g.rows.map(function (r) { return PD.formatValue(r[0]); }),
                 series: [{ name: 'sum(' + p.y + ')', values: g.rows.map(function (r) { return r[1]; }) }],
                 title: 'sum(' + p.y + ') by ' + p.x, xLabel: p.x, yLabel: p.y };
      },
      code: function (p) {
        if (p.series) {
          return "df.pivot_table(index='" + p.x + "', columns='" + p.series + "', values='" + p.y +
            "', aggfunc='sum').plot()";
        }
        return "df.groupby('" + p.x + "')['" + p.y + "'].sum().plot()";
      }
    },
    scatter: {
      group: 'viz', cmt: 'op.scatter',
      dialog: function (b, df) {
        b.appendChild(columnField('x', t('f.x'), PD.numericColumns(df)));
        b.appendChild(columnField('y', t('f.y'), PD.numericColumns(df)));
        var opts = [{ v: '', label: '—' }].concat(df.columns.filter(function (c) {
          return df.dtypes[c] !== 'number';
        }).map(function (c) { return { v: c, label: c }; }));
        b.appendChild(selectField('group', t('f.group'), opts));
      },
      collect: function (b) {
        return { x: val(b, 'x'), y: val(b, 'y'), group: val(b, 'group') || null };
      },
      chart: function (df, p) {
        var d = df.rows.length > 2000 ? PD.sample(df, 2000) : df;
        return { type: 'scatter',
                 x: PD.colValues(d, p.x), y: PD.colValues(d, p.y),
                 groups: p.group ? PD.colValues(d, p.group).map(function (v) {
                   return PD.isNull(v) ? null : PD.formatValue(v);
                 }) : null,
                 title: p.y + ' vs ' + p.x, xLabel: p.x, yLabel: p.y };
      },
      code: function (p) {
        return "df.plot(kind='scatter', x='" + p.x + "', y='" + p.y + "')";
      }
    },
    box: {
      group: 'viz', cmt: 'op.box',
      dialog: function (b, df) {
        b.appendChild(columnField('col', t('f.y'), PD.numericColumns(df)));
        b.appendChild(columnField('group', t('f.groupByCat'), df.columns.filter(function (c) {
          return df.dtypes[c] !== 'number';
        })));
      },
      collect: function (b) { return { col: val(b, 'col'), group: val(b, 'group') }; },
      chart: function (df, p) {
        var counts = PD.valueCounts(df, p.group).slice(0, 10);
        var gi = PD.colIndex(df, p.group), vi = PD.colIndex(df, p.col);
        var groups = counts.map(function (c) {
          var vals = [];
          df.rows.forEach(function (row) {
            var k = PD.isNull(row[gi]) ? null : PD.formatValue(row[gi]);
            if ((k === null && c.value === null) || k === c.value) {
              if (typeof row[vi] === 'number') vals.push(row[vi]);
            }
          });
          return { label: c.value == null ? 'NaN' : c.value, values: vals };
        });
        return { type: 'box', groups: groups,
                 title: p.col + ' by ' + p.group, xLabel: p.group, yLabel: p.col };
      },
      code: function (p) {
        return "df.boxplot(column='" + p.col + "', by='" + p.group + "')";
      }
    },
    heatmap: {
      group: 'viz', cmt: 'op.heatmap',
      dialog: null,
      chart: function (df) {
        var m = PD.corr(df);
        return { type: 'corr', columns: m.columns, matrix: m.matrix, title: t('op.heatmap') };
      },
      code: function () { return "df.corr(numeric_only=True).style.background_gradient(cmap='coolwarm')"; }
    },

    /* ---------- 机器学习(只读:结果 + 图表联动) ---------- */
    linreg: {
      group: 'ml', cmt: 'op.linreg',
      dialog: function (b, df) {
        var nums = PD.numericColumns(df);
        b.appendChild(columnField('x', t('f.x'), nums));
        b.appendChild(columnField('y', t('f.y'), nums));
        presetDistinct(b, ['x', 'y']);   /* Y 默认取第二个数值列,避免 X=Y 的退化演示 */
      },
      collect: function (b) { return { x: val(b, 'x'), y: val(b, 'y') }; },
      run: function (df, p) {
        var r = ML.linreg(PD.colValues(df, p.x), PD.colValues(df, p.y));
        var html = '<table><tbody>' +
          '<tr><td>' + esc(t('res.equation')) + '</td><td><code>' + esc(p.y) + ' = ' +
            r.slope.toFixed(4) + ' × ' + esc(p.x) + (r.intercept >= 0 ? ' + ' : ' − ') +
            Math.abs(r.intercept).toFixed(4) + '</code></td></tr>' +
          '<tr><td>' + esc(t('res.r2Train')) + '</td><td class="num">' + r.r2.toFixed(4) + '</td></tr>' +
          '<tr><td>' + esc(t('res.r2Test')) + '</td><td class="num">' +
            (r.r2Test == null ? '—' : r.r2Test.toFixed(4)) + '</td></tr>' +
          '<tr><td>' + esc(t('res.split')) + '</td><td class="num">' + r.nTrain + ' / ' + r.nTest + '</td></tr>' +
          '<tr><td>' + esc(t('res.n')) + '</td><td class="num">' + r.n + '</td></tr>' +
          '</tbody></table>';
        var node = el('div'); node.innerHTML = html;
        return { title: t('op.linreg'), node: node };
      },
      chart: function (df, p) {
        var r = ML.linreg(PD.colValues(df, p.x), PD.colValues(df, p.y));
        return { type: 'scatter', x: r.xs, y: r.ys,
                 groups: r.isTest.map(function (b) { return t(b ? 'lg.test' : 'lg.train'); }),
                 line: { slope: r.slope, intercept: r.intercept },
                 title: t('op.linreg') + ' · R² = ' + r.r2.toFixed(3),
                 xLabel: p.x, yLabel: p.y };
      },
      code: function (p) {
        return 'from sklearn.model_selection import train_test_split\n' +
          'from sklearn.linear_model import LinearRegression\n' +
          "X_tr, X_te, y_tr, y_te = train_test_split(df[['" + p.x + "']], df['" + p.y + "'], test_size=0.3, random_state=42)\n" +
          'reg = LinearRegression().fit(X_tr, y_tr)\n' +
          "print('train R2:', reg.score(X_tr, y_tr), '· test R2:', reg.score(X_te, y_te))";
      }
    },
    kmeans: {
      group: 'ml', cmt: 'op.kmeans',
      dialog: function (b, df) {
        var nums = PD.numericColumns(df);
        b.appendChild(columnField('f1', t('f.feat1'), nums));
        b.appendChild(columnField('f2', t('f.feat2'), nums));
        presetDistinct(b, ['f1', 'f2']);
        b.appendChild(numberField('k', t('f.k'), 3, 2, 8));
      },
      collect: function (b) {
        var k = Math.max(2, Math.min(8, +val(b, 'k') || 3));
        if (val(b, 'f1') === val(b, 'f2')) throw new Error(t('f.feat1') + ' ≠ ' + t('f.feat2'));
        return { f1: val(b, 'f1'), f2: val(b, 'f2'), k: k };
      },
      run: function (df, p) {
        var r = ML.kmeans(PD.colValues(df, p.f1), PD.colValues(df, p.f2), p.k);
        var html = '<table><thead><tr><th>' + esc(t('res.centers')) + '</th><th>' + esc(p.f1) +
          '</th><th>' + esc(p.f2) + '</th><th>' + esc(t('res.counts')) + '</th></tr></thead><tbody>';
        r.centers.forEach(function (c, i) {
          html += '<tr><td>C' + (i + 1) + '</td><td class="num">' + (Math.round(c[0] * 100) / 100) +
            '</td><td class="num">' + (Math.round(c[1] * 100) / 100) + '</td><td class="num">' +
            r.counts[i] + '</td></tr>';
        });
        html += '</tbody></table><p class="result-note">' + esc(t('res.iterations')) + ': ' +
          r.iterations + '</p>';
        var node = el('div'); node.innerHTML = html;
        return { title: t('op.kmeans'), node: node };
      },
      chart: function (df, p) {
        var r = ML.kmeans(PD.colValues(df, p.f1), PD.colValues(df, p.f2), p.k);
        return { type: 'scatter', x: r.xs, y: r.ys,
                 groups: r.labels.map(function (l) { return 'C' + (l + 1); }),
                 centers: r.centers,
                 title: 'K-Means · k = ' + p.k, xLabel: p.f1, yLabel: p.f2 };
      },
      code: function (p) {
        return 'from sklearn.cluster import KMeans\n' +
          "km = KMeans(n_clusters=" + p.k + ", n_init=10).fit(df[['" + p.f1 + "', '" + p.f2 + "']])\n" +
          "km.cluster_centers_, pd.Series(km.labels_).value_counts()";
      }
    },
    logreg: {
      group: 'ml', cmt: 'op.logreg',
      dialog: function (b, df) {
        var nums = PD.numericColumns(df);
        b.appendChild(columnField('f1', t('f.feat1'), nums));
        b.appendChild(columnField('f2', t('f.feat2'), nums));
        presetDistinct(b, ['f1', 'f2']);
        var binCols = binaryColumns(df);
        b.appendChild(columnField('target', t('f.target'), binCols));
      },
      collect: function (b) {
        var tg = val(b, 'target');
        if (!tg) throw new Error(t('msg.needBinary'));
        if (val(b, 'f1') === val(b, 'f2')) throw new Error(t('f.feat1') + ' ≠ ' + t('f.feat2'));
        return { f1: val(b, 'f1'), f2: val(b, 'f2'), target: tg };
      },
      run: function (df, p) {
        var bt = binTarget(df, p.target);
        var r = ML.logreg(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target);
        var html = '<table><tbody>' +
          '<tr><td>' + esc(t('res.accTrain')) + '</td><td class="num">' +
            (r.accuracy * 100).toFixed(1) + '%</td></tr>' +
          '<tr><td>' + esc(t('res.accTest')) + '</td><td class="num">' +
            (r.accuracyTest == null ? '—' : (r.accuracyTest * 100).toFixed(1) + '%') + '</td></tr>' +
          '<tr><td>' + esc(t('res.split')) + '</td><td class="num">' + r.nTrain + ' / ' + r.nTest + '</td></tr>' +
          '</tbody></table>';
        html += confusionHtml(r);   /* 测试集混淆矩阵(nTest=0 时自动跳过) */
        html += '<table style="margin-top:10px"><tbody>' +
          '<tr><td>' + esc(t('res.weights')) + '</td><td><code>w₁=' + r.w[0].toFixed(3) +
            ', w₂=' + r.w[1].toFixed(3) + ', b=' + r.b.toFixed(3) + '</code></td></tr>' +
          '<tr><td>' + esc(t('res.n')) + '</td><td class="num">' + r.n + '</td></tr>' +
          '<tr><td>' + esc(t('res.mapInfo')) + '</td><td><code>' + esc(bt.classNames[0]) +
            ' → 0,' + esc(bt.classNames[1]) + ' → 1</code></td></tr>' +
          '</tbody></table>';
        var node = el('div'); node.innerHTML = html;
        return { title: t('op.logreg'), node: node };
      },
      chart: function (df, p) {
        var bt = binTarget(df, p.target);
        var r = ML.logreg(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target);
        return { type: 'boundary', x: r.xs, y: r.ys, labels: r.labels,
                 predict: r.predictOrig, classNames: bt.classNames,
                 title: t('op.logreg') + ' · ' + (r.accuracy * 100).toFixed(1) + '%',
                 xLabel: p.f1, yLabel: p.f2 };
      },
      code: function (p) {
        return 'from sklearn.model_selection import train_test_split\n' +
          'from sklearn.linear_model import LogisticRegression\n' +
          "X_tr, X_te, y_tr, y_te = train_test_split(df[['" + p.f1 + "', '" + p.f2 +
          "']], df['" + p.target + "'], test_size=0.3, random_state=42)\n" +
          'clf = LogisticRegression().fit(X_tr, y_tr)\n' +
          "print('train acc:', clf.score(X_tr, y_tr), '· test acc:', clf.score(X_te, y_te))";
      }
    },

    /* ---------- 多项式回归(非线性回归) ---------- */
    polyreg: {
      group: 'ml', cmt: 'op.polyreg',
      dialog: function (b, df) {
        var nums = PD.numericColumns(df);
        b.appendChild(columnField('x', t('f.x'), nums));
        b.appendChild(columnField('y', t('f.y'), nums));
        presetDistinct(b, ['x', 'y']);
        b.appendChild(selectField('degree', t('f.degree'), [
          { v: '2', label: '2 (' + t('f.degQuad') + ')' },
          { v: '3', label: '3 (' + t('f.degCubic') + ')' }
        ]));
      },
      collect: function (b) {
        return { x: val(b, 'x'), y: val(b, 'y'), degree: +val(b, 'degree') === 3 ? 3 : 2 };
      },
      run: function (df, p) {
        var r = ML.polyreg(PD.colValues(df, p.x), PD.colValues(df, p.y), p.degree);
        var eq = r.coef.map(function (c, i) {
          var sign = c >= 0 ? (i ? ' + ' : '') : ' − ';
          var tail = i === 0 ? '' : '·z' + (i > 1 ? '<sup>' + i + '</sup>' : '');
          return (i ? sign : '') + Math.abs(c).toFixed(3) + tail;
        }).join('');
        var html = '<table><tbody>' +
          '<tr><td>' + esc(t('res.degree')) + '</td><td class="num">' + r.degree + '</td></tr>' +
          '<tr><td>' + esc(t('res.polyEq')) + '</td><td><code>' + eq + '</code></td></tr>' +
          '<tr><td colspan="2"><code>' + esc(t('res.zstd', { x: p.x, mean: r.mean.toFixed(3), std: r.std.toFixed(3) })) +
          '</code></td></tr>' +
          '<tr><td>' + esc(t('res.r2Train')) + '</td><td class="num">' + r.r2.toFixed(4) + '</td></tr>' +
          '<tr><td>' + esc(t('res.r2Test')) + '</td><td class="num">' +
            (r.r2Test == null ? '—' : r.r2Test.toFixed(4)) + '</td></tr>' +
          '<tr><td>' + esc(t('res.split')) + '</td><td class="num">' + r.nTrain + ' / ' + r.nTest + '</td></tr>' +
          '<tr><td>' + esc(t('res.n')) + '</td><td class="num">' + r.n + '</td></tr>' +
          '</tbody></table>';
        var node = el('div'); node.innerHTML = html;
        return { title: t('op.polyreg'), node: node };
      },
      chart: function (df, p) {
        var r = ML.polyreg(PD.colValues(df, p.x), PD.colValues(df, p.y), p.degree);
        return { type: 'scatter', x: r.xs, y: r.ys,
                 groups: r.isTest.map(function (b) { return t(b ? 'lg.test' : 'lg.train'); }),
                 curve: { fn: r.predictOrig },
                 title: t('op.polyreg') + ' · R² = ' + r.r2.toFixed(3),
                 xLabel: p.x, yLabel: p.y };
      },
      code: function (p) {
        return 'from sklearn.model_selection import train_test_split\n' +
          'from sklearn.preprocessing import PolynomialFeatures, StandardScaler\n' +
          'from sklearn.pipeline import make_pipeline\n' +
          'from sklearn.linear_model import LinearRegression\n' +
          "X_tr, X_te, y_tr, y_te = train_test_split(df[['" + p.x + "']], df['" + p.y + "'], test_size=0.3, random_state=42)\n" +
          'pipe = make_pipeline(StandardScaler(), PolynomialFeatures(degree=' + p.degree + '), LinearRegression()).fit(X_tr, y_tr)\n' +
          "print('train R2:', pipe.score(X_tr, y_tr), '· test R2:', pipe.score(X_te, y_te))";
      }
    },

    /* ---------- K 近邻分类(惰性学习) ---------- */
    knn: {
      group: 'ml', cmt: 'op.knn',
      dialog: function (b, df) {
        var nums = PD.numericColumns(df);
        b.appendChild(columnField('f1', t('f.feat1'), nums));
        b.appendChild(columnField('f2', t('f.feat2'), nums));
        presetDistinct(b, ['f1', 'f2']);
        b.appendChild(columnField('target', t('f.target'), binaryColumns(df)));
        b.appendChild(numberField('k', t('f.neighbors'), 5, 1, 25));
      },
      collect: function (b) {
        var tg = val(b, 'target');
        if (!tg) throw new Error(t('msg.needBinary'));
        if (val(b, 'f1') === val(b, 'f2')) throw new Error(t('f.feat1') + ' ≠ ' + t('f.feat2'));
        return { f1: val(b, 'f1'), f2: val(b, 'f2'), target: tg, k: Math.max(1, Math.min(25, +val(b, 'k') || 5)) };
      },
      run: function (df, p) {
        var bt = binTarget(df, p.target);
        var r = ML.knn(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target, p.k);
        var html = '<table><tbody>' +
          '<tr><td>' + esc(t('res.accTrain')) + '</td><td class="num">' + (r.accuracy * 100).toFixed(1) + '%</td></tr>' +
          '<tr><td>' + esc(t('res.accTest')) + '</td><td class="num">' +
            (r.accuracyTest == null ? '—' : (r.accuracyTest * 100).toFixed(1) + '%') + '</td></tr>' +
          '<tr><td>' + esc(t('res.split')) + '</td><td class="num">' + r.nTrain + ' / ' + r.nTest + '</td></tr>' +
          '</tbody></table>';
        html += confusionHtml(r);   /* 测试集混淆矩阵(nTest=0 时自动跳过) */
        html += '<table style="margin-top:10px"><tbody>' +
          '<tr><td>' + esc(t('f.neighbors')) + '</td><td class="num">' + r.k + '</td></tr>' +
          '<tr><td>' + esc(t('res.n')) + '</td><td class="num">' + r.n + '</td></tr>' +
          '<tr><td>' + esc(t('res.mapInfo')) + '</td><td><code>' + esc(bt.classNames[0]) + ' → 0,' +
          esc(bt.classNames[1]) + ' → 1</code></td></tr>' +
          '</tbody></table>';
        var node = el('div'); node.innerHTML = html;
        return { title: t('op.knn'), node: node };
      },
      chart: function (df, p) {
        var bt = binTarget(df, p.target);
        var r = ML.knn(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target, p.k);
        return { type: 'boundary', x: r.xs, y: r.ys, labels: r.labels,
                 predict: r.predictOrig, classNames: bt.classNames,
                 title: t('op.knn') + ' · k=' + r.k + ' · ' + (r.accuracy * 100).toFixed(1) + '%',
                 xLabel: p.f1, yLabel: p.f2 };
      },
      code: function (p) {
        return 'from sklearn.model_selection import train_test_split\n' +
          'from sklearn.neighbors import KNeighborsClassifier\n' +
          "X_tr, X_te, y_tr, y_te = train_test_split(df[['" + p.f1 + "', '" + p.f2 +
          "']], df['" + p.target + "'], test_size=0.3, random_state=42)\n" +
          "clf = KNeighborsClassifier(n_neighbors=" + p.k + ", weights='distance').fit(X_tr, y_tr)\n" +
          "print('train acc:', clf.score(X_tr, y_tr), '· test acc:', clf.score(X_te, y_te))";
      }
    },

    /* ---------- 决策树分类(CART) ---------- */
    dtree: {
      group: 'ml', cmt: 'op.dtree',
      dialog: function (b, df) {
        var nums = PD.numericColumns(df);
        b.appendChild(columnField('f1', t('f.feat1'), nums));
        b.appendChild(columnField('f2', t('f.feat2'), nums));
        presetDistinct(b, ['f1', 'f2']);
        b.appendChild(columnField('target', t('f.target'), binaryColumns(df)));
        b.appendChild(numberField('maxDepth', t('f.maxDepth'), 3, 1, 8));
      },
      collect: function (b) {
        var tg = val(b, 'target');
        if (!tg) throw new Error(t('msg.needBinary'));
        if (val(b, 'f1') === val(b, 'f2')) throw new Error(t('f.feat1') + ' ≠ ' + t('f.feat2'));
        return { f1: val(b, 'f1'), f2: val(b, 'f2'), target: tg,
                 maxDepth: Math.max(1, Math.min(8, +val(b, 'maxDepth') || 3)) };
      },
      run: function (df, p) {
        var bt = binTarget(df, p.target);
        var r = ML.dtree(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target, p.maxDepth);
        var html = '<table><tbody>' +
          '<tr><td>' + esc(t('res.accTrain')) + '</td><td class="num">' + (r.accuracy * 100).toFixed(1) + '%</td></tr>' +
          '<tr><td>' + esc(t('res.accTest')) + '</td><td class="num">' +
            (r.accuracyTest == null ? '—' : (r.accuracyTest * 100).toFixed(1) + '%') + '</td></tr>' +
          '<tr><td>' + esc(t('res.split')) + '</td><td class="num">' + r.nTrain + ' / ' + r.nTest + '</td></tr>' +
          '</tbody></table>';
        html += confusionHtml(r);   /* 测试集混淆矩阵(nTest=0 时自动跳过) */
        html += '<table style="margin-top:10px"><tbody>' +
          '<tr><td>' + esc(t('res.depth')) + ' / ' + esc(t('res.leaves')) + '</td><td class="num">' +
          r.depth + ' / ' + r.leaves + '</td></tr>' +
          '<tr><td>' + esc(t('res.importance')) + '</td><td><code>' + esc(p.f1) + ' ' +
          (r.importance[0] * 100).toFixed(0) + '% · ' + esc(p.f2) + ' ' + (r.importance[1] * 100).toFixed(0) +
          '%</code></td></tr>' +
          '<tr><td>' + esc(t('res.n')) + '</td><td class="num">' + r.n + '</td></tr>' +
          '</tbody></table>';
        html += '<p class="result-note" style="margin-top:10px">' + esc(t('res.rules')) + '</p>';
        html += '<table><thead><tr><th>' + esc(t('res.when')) + '</th><th>' + esc(t('res.predict')) +
          '</th><th>n</th><th>' + esc(t('res.purity')) + '</th></tr></thead><tbody>';
        r.rules.forEach(function (ru) {
          var conds = ru.conds.map(function (c) {
            return esc(c.f === 0 ? p.f1 : p.f2) + ' ' + c.op + ' ' + (Math.round(c.th * 100) / 100);
          }).join('<br>') || '—';
          html += '<tr><td>' + conds + '</td><td>' + esc(bt.classNames[ru.cls]) + '</td><td class="num">' +
            ru.n + '</td><td class="num">' + (ru.ratio * 100).toFixed(0) + '%</td></tr>';
        });
        html += '</tbody></table>';
        var node = el('div'); node.innerHTML = html;
        return { title: t('op.dtree'), node: node };
      },
      chart: function (df, p) {
        var bt = binTarget(df, p.target);
        var r = ML.dtree(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target, p.maxDepth);
        return { type: 'boundary', x: r.xs, y: r.ys, labels: r.labels,
                 predict: r.predictOrig, classNames: bt.classNames,
                 title: t('op.dtree') + ' · depth=' + r.depth + ' · ' + (r.accuracy * 100).toFixed(1) + '%',
                 xLabel: p.f1, yLabel: p.f2 };
      },
      code: function (p) {
        return 'from sklearn.model_selection import train_test_split\n' +
          'from sklearn.tree import DecisionTreeClassifier, export_text\n' +
          "X_tr, X_te, y_tr, y_te = train_test_split(df[['" + p.f1 + "', '" + p.f2 +
          "']], df['" + p.target + "'], test_size=0.3, random_state=42)\n" +
          'clf = DecisionTreeClassifier(max_depth=' + p.maxDepth + ', min_samples_leaf=5).fit(X_tr, y_tr)\n' +
          "print('train acc:', clf.score(X_tr, y_tr), '· test acc:', clf.score(X_te, y_te))\n" +
          "print(export_text(clf, feature_names=['" + p.f1 + "', '" + p.f2 + "']))";
      }
    },

    /* ---------- PCA 主成分分析(无监督降维) ---------- */
    pca: {
      group: 'ml', cmt: 'op.pca',
      dialog: function (b, df) {
        var nums = PD.numericColumns(df);
        var list = checkList('cols', t('f.features'), nums, false);
        /* 默认勾选:排除 id 类列后的前 4 个数值列 */
        var preferred = nums.filter(function (c) { return !/id$/i.test(c); }).slice(0, 4);
        if (preferred.length < 2) preferred = nums.slice(0, Math.min(4, nums.length));
        list.querySelectorAll('input').forEach(function (cb) {
          if (preferred.indexOf(cb.value) >= 0) cb.checked = true;
        });
        b.appendChild(list);
      },
      collect: function (b) {
        var cols = checkedVals(b, 'cols');
        if (cols.length < 2) throw new Error(t('msg.need2cols'));
        return { cols: cols };
      },
      run: function (df, p) {
        var r = ML.pca(p.cols, p.cols.map(function (c) { return PD.colValues(df, c); }));
        var html = '<table><thead><tr><th>' + esc(t('res.pc')) + '</th><th>' + esc(t('res.eigvalue')) +
          '</th><th>' + esc(t('res.variance')) + '</th><th>' + esc(t('res.cum')) + '</th></tr></thead><tbody>';
        var cum = 0;
        r.explained.forEach(function (v, i) {
          cum += v;
          html += '<tr><td>PC' + (i + 1) + '</td><td class="num">' + r.eigVals[i].toFixed(3) +
            '</td><td class="num">' + (v * 100).toFixed(1) + '%</td><td class="num">' +
            (cum * 100).toFixed(1) + '%</td></tr>';
        });
        html += '</tbody></table>';
        html += '<p class="result-note" style="margin-top:10px">' + esc(t('res.loadings')) + '</p>';
        html += '<table><thead><tr><th></th><th>PC1</th><th>PC2</th></tr></thead><tbody>';
        r.loadings.forEach(function (l) {
          html += '<tr><th>' + esc(l.name) + '</th><td class="num">' + l.v[0].toFixed(3) +
            '</td><td class="num">' + l.v[1].toFixed(3) + '</td></tr>';
        });
        html += '</tbody></table>';
        var node = el('div'); node.innerHTML = html;
        return { title: t('op.pca'), node: node };
      },
      chart: function (df, p) {
        var r = ML.pca(p.cols, p.cols.map(function (c) { return PD.colValues(df, c); }));
        return {
          type: 'scatter', x: r.pc1, y: r.pc2,
          arrows: r.loadings.map(function (l) { return { x: l.v[0], y: l.v[1], label: l.name }; }),
          title: t('op.pca') + ' · PC1 ' + (r.explained[0] * 100).toFixed(0) + '% / PC2 ' +
                 (r.explained[1] * 100).toFixed(0) + '%',
          xLabel: 'PC1 (' + (r.explained[0] * 100).toFixed(1) + '%)',
          yLabel: 'PC2 (' + (r.explained[1] * 100).toFixed(1) + '%)'
        };
      },
      code: function (p) {
        var cols = '[' + p.cols.map(function (c) { return "'" + c + "'"; }).join(', ') + ']';
        return 'from sklearn.preprocessing import StandardScaler\n' +
          'from sklearn.decomposition import PCA\n' +
          'Z = StandardScaler().fit_transform(df[' + cols + '])\n' +
          'pcs = PCA(n_components=2).fit(Z)\n' +
          'pcs.explained_variance_ratio_, pcs.components_';
      }
    }
  };

  /* 恰好两个取值的列(逻辑回归的目标列候选) */
  function binaryColumns(df) {
    return df.columns.filter(function (c) {
      var seen = {};
      PD.colValues(df, c).forEach(function (v) {
        if (!PD.isNull(v)) seen[PD.formatValue(v)] = 1;
      });
      return Object.keys(seen).length === 2;
    });
  }
  /* 把二值列映射成 0/1 数组(缺失保持 null) */
  function binTarget(df, col) {
    var vals = PD.colValues(df, col);
    var uniq = [];
    vals.forEach(function (v) {
      if (PD.isNull(v)) return;
      var k = PD.formatValue(v);
      if (uniq.indexOf(k) < 0) uniq.push(k);
    });
    uniq.sort();
    var map = {}; map[uniq[0]] = 0; map[uniq[1]] = 1;
    return {
      target: vals.map(function (v) { return PD.isNull(v) ? null : map[PD.formatValue(v)]; }),
      classNames: [uniq[0], uniq[1]]
    };
  }

  /* 测试集 2×2 混淆矩阵 HTML(行=实际 0/1,列=预测 0/1,只统计 isTest 样本);
     测试集为空(nTest=0)或返回值没有 pred 时返回空串,整段跳过 */
  function confusionHtml(r) {
    if (!r.nTest || !r.pred) return '';
    var cnt = [[0, 0], [0, 0]], i;
    for (i = 0; i < r.labels.length; i++) {
      if (r.isTest[i] && (r.labels[i] === 0 || r.labels[i] === 1) &&
          (r.pred[i] === 0 || r.pred[i] === 1)) {
        cnt[r.labels[i]][r.pred[i]]++;
      }
    }
    var html = '<p class="result-note" style="margin-top:10px">' + esc(t('res.confusion')) + '</p>';
    html += '<table><thead><tr><th>' + esc(t('res.actualLabel')) + '＼' + esc(t('res.predLabel')) +
      '</th><th>0</th><th>1</th></tr></thead><tbody>';
    for (i = 0; i < 2; i++) {
      html += '<tr><th>' + i + '</th><td class="num">' + cnt[i][0] +
        '</td><td class="num">' + cnt[i][1] + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  /* 时序图表的 x 轴:优先用表里第一个 datetime 列,否则退回行号 1..n */
  function tsDateCol(df) {
    for (var i = 0; i < df.columns.length; i++) {
      if (df.dtypes[df.columns[i]] === 'datetime') return df.columns[i];
    }
    return null;
  }
  function tsXLabels(df) {
    var dc = tsDateCol(df);
    if (dc) return PD.colValues(df, dc).map(function (v) { return PD.formatValue(v); });
    return df.rows.map(function (_, i) { return i + 1; });
  }
  function tsXName(df) { return tsDateCol(df) || '#'; }

  /* 饼图/环形图数据源:sizeCol 为空 → value_counts 计数;否则按类别列 sum 数值列。
   * 按值降序,超过 10 项合并为「其他」,避免扇区过多难以辨认。 */
  function pieSpecOf(df, col, sizeCol, hole, title) {
    var rows;
    if (sizeCol) {
      var g = PD.groupBy(df, [col], [{ col: sizeCol, func: 'sum' }]);
      rows = PD.sortBy(g, [{ col: g.columns[1], asc: false }]).rows.map(function (r) {
        return { value: r[0], count: (typeof r[1] === 'number' && !isNaN(r[1])) ? r[1] : 0 };
      });
    } else {
      rows = PD.valueCounts(df, col).map(function (d) {
        return { value: d.value, count: d.count };
      });
    }
    rows = rows.filter(function (d) { return d.count > 0; });
    if (rows.length > 10) {
      var rest = rows.slice(9).reduce(function (a, d) { return a + d.count; }, 0);
      rows = rows.slice(0, 9);
      rows.push({ value: t('f.pieOther'), count: rest });
    }
    return { type: 'pie', hole: hole, title: title,
             labels: rows.map(function (d) { return d.value == null ? 'NaN' : PD.formatValue(d.value); }),
             values: rows.map(function (d) { return d.count; }) };
  }

  var GROUPS = [
    { key: 'inspect', ops: ['head', 'tail', 'sample', 'info', 'describe', 'missingmap'] },
    { key: 'select', ops: ['select', 'drop', 'rename', 'astype'] },
    { key: 'clean', ops: ['filter', 'sort', 'dedup', 'dropna', 'fillna'] },
    { key: 'transform', ops: ['assign', 'cut', 'merge', 'concat'] },
    { key: 'ts', ops: ['resample', 'rolling', 'pctchange'] },
    { key: 'agg', ops: ['groupby', 'pivot', 'valuecounts', 'corr'] },
    { key: 'ml', ops: ['linreg', 'polyreg', 'logreg', 'knn', 'dtree', 'kmeans', 'pca'] },
    { key: 'viz', ops: ['hist', 'bar', 'pie', 'line', 'scatter', 'box', 'heatmap'] }
  ];

  function otherDatasets() {
    return Object.keys(datasets).filter(function (n) { return n !== activeName; });
  }

  /* ================= 表单控件 ================= */

  function val(body, name) {
    var n = body.querySelector('[name="' + name + '"]');
    return n ? n.value : '';
  }
  function fieldWrap(labelText, input) {
    return el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: labelText }), input]);
  }
  function selectField(name, label, options) {
    var sel = el('select', { name: name });
    options.forEach(function (o) {
      sel.appendChild(el('option', { value: o.v != null ? o.v : o, text: o.label || o }));
    });
    return fieldWrap(label, sel);
  }
  function columnField(name, label, columns) {
    return selectField(name, label, columns.map(function (c) { return { v: c, label: c }; }));
  }
  /* 多个列选择器依次错开默认值(第 i 个选第 i 项),避免 X=Y 的退化选择 */
  function presetDistinct(body, names) {
    for (var i = 1; i < names.length; i++) {
      var sel = body.querySelector('[name="' + names[i] + '"]');
      if (sel && sel.options.length > i) sel.selectedIndex = i;
    }
  }

  /* ================= 图表解读 =================
     每个图表操作可附一个 insight(df, params) → string[] (数据要点)。
     渲染时末尾统一追加一条「pandas 的角色」说明(词条 ins.pd.<op>)。 */

  /* 数值缩写:大数用千分位,小数保留两位 */
  function nfmt(v) {
    if (v == null || isNaN(v)) return '—';
    var a = Math.abs(v);
    if (a >= 10000) return Math.round(v).toLocaleString('en-US');
    if (a >= 100) return v.toFixed(1);
    if (a >= 1) return v.toFixed(2);
    return v.toPrecision(3);
  }
  function pearson(xs, ys) {
    var pairs = [];
    for (var i = 0; i < xs.length; i++) {
      if (typeof xs[i] === 'number' && !isNaN(xs[i]) && typeof ys[i] === 'number' && !isNaN(ys[i])) {
        pairs.push([xs[i], ys[i]]);
      }
    }
    var n = pairs.length;
    if (n < 3) return null;
    var mx = 0, my = 0;
    pairs.forEach(function (p) { mx += p[0]; my += p[1]; });
    mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0;
    pairs.forEach(function (p) {
      var dx = p[0] - mx, dy = p[1] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    });
    return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  var INSIGHTS = {
    hist: function (df, p) {
      var s = PD.numericStats(PD.colValues(df, p.col));
      if (!s) return [];
      var lines = [t('ins.hist.shape', { n: s.count, mean: nfmt(s.mean), median: nfmt(s.q50), std: nfmt(s.std) })];
      var tol = s.std * 0.05;
      if (s.mean > s.q50 + tol) lines.push(t('ins.hist.skewPos'));
      else if (s.mean < s.q50 - tol) lines.push(t('ins.hist.skewNeg'));
      else lines.push(t('ins.hist.skewNone'));
      var iqr = s.q75 - s.q25, lo = s.q25 - 1.5 * iqr, hi = s.q75 + 1.5 * iqr;
      var out = PD.colValues(df, p.col).filter(function (v) {
        return typeof v === 'number' && (v < lo || v > hi);
      }).length;
      lines.push(out ? t('ins.hist.outlier', { n: out, lo: nfmt(lo), hi: nfmt(hi) }) : t('ins.hist.noOutlier'));
      return lines;
    },
    bar: function (df, p) {
      var g = PD.groupBy(df, [p.x], [{ col: p.y, func: p.func }]);
      var rows = PD.sortBy(g, [{ col: g.columns[1], asc: false }]).rows;
      if (!rows.length) return [];
      var total = 0;
      rows.forEach(function (r) { total += (typeof r[1] === 'number' ? r[1] : 0); });
      var lines = [];
      if (total) {
        lines.push(t('ins.bar.top', { cat: PD.formatValue(rows[0][0]), val: nfmt(rows[0][1]),
                                      pct: (rows[0][1] / total * 100).toFixed(1) }));
        if (rows.length > 3) {
          var top3 = rows.slice(0, 3).reduce(function (a, r) { return a + (r[1] || 0); }, 0);
          lines.push(t('ins.bar.top3', { pct: (top3 / total * 100).toFixed(1), n: rows.length }));
        }
      }
      return lines;
    },
    valuecounts: function (df, p) { return INSIGHTS.pie(df, { col: p.col }); },
    pie: function (df, p) {
      /* 与 chart() 同源:value_counts 或 groupby sum,取最大扇区与前 3 占比 */
      var rows;
      if (p.size) {
        var g = PD.groupBy(df, [p.col], [{ col: p.size, func: 'sum' }]);
        rows = PD.sortBy(g, [{ col: g.columns[1], asc: false }]).rows.map(function (r) {
          return [r[0], (typeof r[1] === 'number' && !isNaN(r[1])) ? r[1] : 0];
        });
      } else {
        rows = PD.valueCounts(df, p.col).map(function (d) { return [d.value, d.count]; });
      }
      rows = rows.filter(function (d) { return d[1] > 0; });
      if (!rows.length) return [];
      var total = rows.reduce(function (a, d) { return a + d[1]; }, 0);
      if (!total) return [];
      var lines = [t('ins.pie.top', { cat: rows[0][0] == null ? 'NaN' : PD.formatValue(rows[0][0]),
                                      pct: (rows[0][1] / total * 100).toFixed(1) })];
      if (rows.length > 3) {
        var top3 = rows.slice(0, 3).reduce(function (a, d) { return a + d[1]; }, 0);
        lines.push(t('ins.bar.top3', { pct: (top3 / total * 100).toFixed(1), n: rows.length }));
      }
      return lines;
    },
    line: function (df, p) {
      /* 与 chart() 同源:series 时按透视表的首个系列看趋势 */
      var xs, ys;
      if (p.series) {
        var pv = PD.pivotTable(df, p.x, p.series, p.y, 'sum');
        xs = pv.rows.map(function (r) { return r[0]; });
        ys = pv.rows.map(function (r) { return r[1]; });
      } else {
        var g = PD.sortBy(PD.groupBy(df, [p.x], [{ col: p.y, func: 'sum' }]), [{ col: p.x, asc: true }]);
        xs = g.rows.map(function (r) { return r[0]; });
        ys = g.rows.map(function (r) { return r[1]; });
      }
      var valid = [];
      for (var i = 0; i < ys.length; i++) {
        if (typeof ys[i] === 'number' && !isNaN(ys[i])) valid.push({ x: xs[i], y: ys[i] });
      }
      if (valid.length < 2) return [];
      var first = valid[0].y, last = valid[valid.length - 1].y;
      var pct = first ? Math.abs((last - first) / first * 100) : 0;
      var lines = [];
      if (pct < 5) {
        lines.push(t('ins.line.trendFlat', { first: nfmt(first), last: nfmt(last), pct: pct.toFixed(1) }));
      } else {
        lines.push(t('ins.line.trend', { first: nfmt(first), last: nfmt(last),
                                         dir: t(last > first ? 'ins.line.up' : 'ins.line.down'),
                                         pct: pct.toFixed(1) }));
      }
      var peak = valid[0];
      valid.forEach(function (v) { if (v.y > peak.y) peak = v; });
      lines.push(t('ins.line.peak', { x: PD.formatValue(peak.x), v: nfmt(peak.y) }));
      return lines;
    },
    scatter: function (df, p) {
      var d = df.rows.length > 2000 ? PD.sample(df, 2000) : df;
      var r = pearson(PD.colValues(d, p.x), PD.colValues(d, p.y));
      if (r == null) return [];
      var ar = Math.abs(r), lines = [];
      if (ar < 0.2) {
        lines.push(t('ins.scatter.corrNone', { r: r.toFixed(3), x: p.x, y: p.y }));
      } else {
        lines.push(t('ins.scatter.corr', {
          r: r.toFixed(3), x: p.x, y: p.y,
          a: t(ar > 0.7 ? 'ins.scatter.strong' : ar > 0.4 ? 'ins.scatter.mid' : 'ins.scatter.weak'),
          b: t(r > 0 ? 'ins.scatter.pos' : 'ins.scatter.neg')
        }));
      }
      if (df.rows.length > 2000) lines.push(t('ins.scatter.sampled', { n: 2000 }));
      return lines;
    },
    box: function (df, p) {
      var counts = PD.valueCounts(df, p.group).slice(0, 10);
      var gi = PD.colIndex(df, p.group), vi = PD.colIndex(df, p.col);
      var stats = [];
      counts.forEach(function (c) {
        var vals = [];
        df.rows.forEach(function (row) {
          var k = PD.isNull(row[gi]) ? null : PD.formatValue(row[gi]);
          if ((k === null && c.value === null) || k === c.value) {
            if (typeof row[vi] === 'number') vals.push(row[vi]);
          }
        });
        var s = PD.numericStats(vals);
        if (s) stats.push({ label: c.value == null ? 'NaN' : c.value, s: s });
      });
      if (stats.length < 2) return [];
      var hi = stats[0], lo = stats[0], wide = stats[0];
      stats.forEach(function (g) {
        if (g.s.q50 > hi.s.q50) hi = g;
        if (g.s.q50 < lo.s.q50) lo = g;
        if (g.s.q75 - g.s.q25 > wide.s.q75 - wide.s.q25) wide = g;
      });
      var lines = [t('ins.box.med', { g: hi.label, v: nfmt(hi.s.q50), g2: lo.label, v2: nfmt(lo.s.q50) })];
      if (wide !== hi && wide !== lo) {
        lines.push(t('ins.box.spread', { g: wide.label, v: nfmt(wide.s.q75 - wide.s.q25) }));
      }
      return lines;
    },
    heatmap: function (df) {
      var m = PD.corr(df);
      var best = null, worst = null;
      for (var i = 0; i < m.columns.length; i++) {
        for (var j = i + 1; j < m.columns.length; j++) {
          var v = m.matrix[i][j];
          if (v == null) continue;
          if (!best || v > best.v) best = { a: m.columns[i], b: m.columns[j], v: v };
          if (!worst || v < worst.v) worst = { a: m.columns[i], b: m.columns[j], v: v };
        }
      }
      if (!best) return [];
      if (Math.abs(best.v) < 0.2 && Math.abs(worst.v) < 0.2) return [t('ins.heatmap.none')];
      var lines = [];
      if (best.v > 0) lines.push(t('ins.heatmap.pos', { a: best.a, b: best.b, r: best.v.toFixed(3) }));
      if (worst.v < 0) lines.push(t('ins.heatmap.neg', { a: worst.a, b: worst.b, r: worst.v.toFixed(3) }));
      return lines;
    },
    missingmap: function (df) {
      var stats = missingStats(df);
      var total = 0, worst = null;
      stats.forEach(function (s) {
        total += s.cnt;
        if (s.cnt && (!worst || s.cnt > worst.cnt)) worst = s;
      });
      if (!total || !worst) return [];
      return [t('ins.missingmap.worst', { col: worst.col, n: worst.cnt, pct: worst.rate.toFixed(1) })];
    },
    resample: function (df, p) {
      /* df 为重采样后的新表:第 0 列是周期桶键,第 1 列是聚合值 */
      var pts = [];
      df.rows.forEach(function (r) {
        if (typeof r[1] === 'number' && !isNaN(r[1])) pts.push({ x: PD.formatValue(r[0]), y: r[1] });
      });
      if (!pts.length) return [];
      var mean = pts.reduce(function (a, v) { return a + v.y; }, 0) / pts.length;
      var lines = [t('ins.resample.n', { n: pts.length, rule: p.rule, mean: nfmt(mean) })];
      var first = pts[0].y, last = pts[pts.length - 1].y;
      var pct = first ? Math.abs((last - first) / first * 100) : 0;
      if (pct < 5) {
        lines.push(t('ins.line.trendFlat', { first: nfmt(first), last: nfmt(last), pct: pct.toFixed(1) }));
      } else {
        lines.push(t('ins.line.trend', { first: nfmt(first), last: nfmt(last),
                                         dir: t(last > first ? 'ins.line.up' : 'ins.line.down'),
                                         pct: pct.toFixed(1) }));
      }
      var peak = pts[0];
      pts.forEach(function (v) { if (v.y > peak.y) peak = v; });
      lines.push(t('ins.line.peak', { x: peak.x, v: nfmt(peak.y) }));
      return lines;
    },
    rolling: function (df, p) {
      return [t('ins.rolling.win', { col: p.newcol, src: p.col, w: p.w })];
    },
    pctchange: function (df, p) {
      var vals = PD.colValues(df, p.newcol);
      var up = 0, down = 0;
      vals.forEach(function (v) {
        if (typeof v !== 'number' || isNaN(v)) return;
        if (v > 0) up++; else if (v < 0) down++;
      });
      if (!up && !down) return [];
      return [
        t('ins.pctchange.dir', { col: p.newcol, up: up, down: down }),
        t('ins.pctchange.base')
      ];
    },
    linreg: function (df, p) {
      var r = ML.linreg(PD.colValues(df, p.x), PD.colValues(df, p.y));
      var pct = Math.round(r.r2 * 100);
      return [
        t('ins.linreg.slope', { slope: nfmt(r.slope), x: p.x, y: p.y }),
        t(r.r2 >= 0.5 ? 'ins.linreg.r2good' : r.r2 >= 0.2 ? 'ins.linreg.r2mid' : 'ins.linreg.r2bad',
          { r2: r.r2.toFixed(4), x: p.x, y: p.y, pct: pct }),
        t('ins.split.r2', { tr: r.r2.toFixed(3), te: r.r2Test == null ? '—' : r.r2Test.toFixed(3) })
      ];
    },
    kmeans: function (df, p) {
      var r = ML.kmeans(PD.colValues(df, p.f1), PD.colValues(df, p.f2), p.k);
      var maxC = Math.max.apply(null, r.counts), minC = Math.min.apply(null, r.counts);
      var lines = [t('ins.kmeans.sizes', {
        sizes: r.counts.join(' / '),
        balance: t(maxC >= minC * 2 ? 'ins.kmeans.uneven' : 'ins.kmeans.balanced')
      })];
      [p.f1, p.f2].forEach(function (f, fi) {
        var bestI = 0;
        r.centers.forEach(function (c, i) { if (c[fi] > r.centers[bestI][fi]) bestI = i; });
        lines.push(t('ins.kmeans.center', { f: f, i: bestI + 1, v: nfmt(r.centers[bestI][fi]) }));
      });
      lines.push(t('ins.kmeans.iter', { n: r.iterations }));
      return lines;
    },
    logreg: function (df, p) {
      var bt = binTarget(df, p.target);
      var r = ML.logreg(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target);
      var pos = bt.target.filter(function (v) { return v === 1; }).length;
      var base = Math.max(pos, bt.target.length - pos) / bt.target.length * 100;
      var acc = r.accuracy * 100;
      return [
        t('ins.logreg.acc', { pct: acc.toFixed(1), base: base.toFixed(1),
                              cmp: t(acc >= base + 5 ? 'ins.logreg.better' : 'ins.logreg.close') }),
        t('ins.split.acc', { tr: (r.accuracy * 100).toFixed(1),
                             te: r.accuracyTest == null ? '—' : (r.accuracyTest * 100).toFixed(1) }),
        t('ins.logreg.w', { f1: p.f1, w1: r.w[0].toFixed(3), f2: p.f2, w2: r.w[1].toFixed(3),
                            cls: bt.classNames[1] }),
        t('ins.logreg.grid')
      ];
    },
    polyreg: function (df, p) {
      var r = ML.polyreg(PD.colValues(df, p.x), PD.colValues(df, p.y), p.degree);
      var pct = Math.round(r.r2 * 100);
      var lines = [];
      if (r.vertex) {
        lines.push(t(r.vertex.kind === 'max' ? 'ins.poly.vertexMax' : 'ins.poly.vertexMin',
          { x: nfmt(r.vertex.x), y: nfmt(r.vertex.y) }));
      }
      lines.push(t(r.r2 >= 0.5 ? 'ins.linreg.r2good' : r.r2 >= 0.2 ? 'ins.linreg.r2mid' : 'ins.linreg.r2bad',
        { r2: r.r2.toFixed(4), x: p.x, y: p.y, pct: pct }));
      lines.push(t('ins.split.r2', { tr: r.r2.toFixed(3), te: r.r2Test == null ? '—' : r.r2Test.toFixed(3) }));
      if (r.degree === 3) lines.push(t('ins.poly.deg3'));
      return lines;
    },
    knn: function (df, p) {
      var bt = binTarget(df, p.target);
      var r = ML.knn(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target, p.k);
      var pos = bt.target.filter(function (v) { return v === 1; }).length;
      var valid = bt.target.filter(function (v) { return v === 0 || v === 1; }).length;
      var base = Math.max(pos, valid - pos) / valid * 100;
      var acc = r.accuracy * 100;
      return [
        t('ins.logreg.acc', { pct: acc.toFixed(1), base: base.toFixed(1),
                              cmp: t(acc >= base + 5 ? 'ins.logreg.better' : 'ins.logreg.close') }),
        t('ins.split.acc', { tr: (r.accuracy * 100).toFixed(1),
                             te: r.accuracyTest == null ? '—' : (r.accuracyTest * 100).toFixed(1) }),
        t('ins.knn.k', { k: r.k }),
        t('ins.logreg.grid')
      ];
    },
    dtree: function (df, p) {
      var bt = binTarget(df, p.target);
      var r = ML.dtree(PD.colValues(df, p.f1), PD.colValues(df, p.f2), bt.target, p.maxDepth);
      var pos = bt.target.filter(function (v) { return v === 1; }).length;
      var valid = bt.target.filter(function (v) { return v === 0 || v === 1; }).length;
      var base = Math.max(pos, valid - pos) / valid * 100;
      var acc = r.accuracy * 100;
      var topF = r.importance[0] >= r.importance[1] ? p.f1 : p.f2;
      var topV = Math.max(r.importance[0], r.importance[1]) * 100;
      return [
        t('ins.logreg.acc', { pct: acc.toFixed(1), base: base.toFixed(1),
                              cmp: t(acc >= base + 5 ? 'ins.logreg.better' : 'ins.logreg.close') }),
        t('ins.split.acc', { tr: (r.accuracy * 100).toFixed(1),
                             te: r.accuracyTest == null ? '—' : (r.accuracyTest * 100).toFixed(1) }),
        t('ins.dtree.size', { d: r.depth, leaves: r.leaves }),
        t('ins.dtree.imp', { f: topF, pct: topV.toFixed(0) }),
        t('ins.dtree.boundary')
      ];
    },
    pca: function (df, p) {
      var r = ML.pca(p.cols, p.cols.map(function (c) { return PD.colValues(df, c); }));
      function topLoad(idx) {
        var best = r.loadings[0];
        r.loadings.forEach(function (l) {
          if (Math.abs(l.v[idx]) > Math.abs(best.v[idx])) best = l;
        });
        return { name: best.name, v: best.v[idx] };
      }
      var l1 = topLoad(0), l2 = topLoad(1);
      var cum = (r.explained[0] + r.explained[1]) * 100;
      var lines = [
        t('ins.pca.pc1', { pct: (r.explained[0] * 100).toFixed(1), f: l1.name, v: l1.v.toFixed(2) }),
        t('ins.pca.pc2', { pct: (r.explained[1] * 100).toFixed(1), f: l2.name, v: l2.v.toFixed(2) }),
        t('ins.pca.cum', { pct: cum.toFixed(1), d: r.d }),
        t('ins.pca.biplot')
      ];
      return lines;
    }
  };

  function renderInsight(opKey, df, params) {
    var box = $('chart-insight');
    var fn = INSIGHTS[opKey];
    if (!fn) { box.hidden = true; box.innerHTML = ''; return; }
    var lines;
    try { lines = fn(df, params); } catch (e) { lines = []; }
    if (!lines || !lines.length) { box.hidden = true; box.innerHTML = ''; return; }
    var html = '<p class="insight-title">' + esc(t('ins.title')) + '</p><ul class="insight-list">';
    lines.forEach(function (ln) { html += '<li>' + esc(ln) + '</li>'; });
    html += '</ul><p class="insight-pd"><span class="insight-pd-tag">pandas</span>' +
      esc(t('ins.pd.role', { text: t('ins.pd.' + opKey) })) + '</p>';
    box.innerHTML = html;
    box.hidden = false;
  }
  function textField(name, label, init) {
    var inp = el('input', { name: name, type: 'text', value: init });
    return fieldWrap(label, inp);
  }
  function numberField(name, label, init, min, max) {
    var inp = el('input', { name: name, type: 'number', value: init,
                            min: min != null ? min : 0, max: max != null ? max : 9999 });
    return fieldWrap(label, inp);
  }
  function checkList(name, label, options, defaultAll) {
    var box = el('div', { class: 'check-list' });
    options.forEach(function (c) {
      var cb = el('input', { type: 'checkbox', name: name, value: c });
      if (defaultAll) cb.checked = true;
      box.appendChild(el('label', null, [cb, el('span', { text: c })]));
    });
    return fieldWrap(label, box);
  }
  function checkedVals(body, name) {
    var nodes = body.querySelectorAll('input[name="' + name + '"]:checked');
    return Array.prototype.map.call(nodes, function (n) { return n.value; });
  }

  /* 筛选条件动态行 */
  function dynConditions(df) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(el('label', { class: 'field-label', text: t('f.cond') }));
    var rows = el('div', { class: 'dyn-rows', 'data-kind': 'cond' });
    var add = el('button', { class: 'add-row-btn', type: 'button', text: t('f.addCond') });
    function addRow() {
      var row = el('div', { class: 'dyn-row dyn-row-cond' });
      var colSel = el('select', { name: 'cond-col' });
      df.columns.forEach(function (c) { colSel.appendChild(el('option', { value: c, text: c })); });
      var opSel = el('select', { name: 'cond-op' });
      FILTER_OPS.forEach(function (o) { opSel.appendChild(el('option', { value: o, text: t(FOP_KEYS[o]) })); });
      var v1 = el('input', { name: 'cond-v1', type: 'text', placeholder: t('f.value') });
      var v2 = el('input', { name: 'cond-v2', type: 'text', placeholder: t('f.value2'), style: 'display:none' });
      var del = el('button', { class: 'row-del', type: 'button', text: '×', title: t('act.close') });
      function sync() {
        var op = opSel.value;
        var noVal = op === 'isnull' || op === 'notnull';
        v1.style.display = noVal ? 'none' : '';
        v2.style.display = op === 'between' ? '' : 'none';
        row.classList.toggle('has-v2', op === 'between');
      }
      opSel.addEventListener('change', sync);
      del.addEventListener('click', function () { row.remove(); });
      row.appendChild(colSel); row.appendChild(opSel); row.appendChild(v1); row.appendChild(v2); row.appendChild(del);
      rows.appendChild(row);
      sync();
    }
    add.addEventListener('click', addRow);
    addRow();
    wrap.appendChild(rows); wrap.appendChild(add);
    return wrap;
  }
  function collectConds(body) {
    var rows = body.querySelectorAll('.dyn-row-cond');
    var out = [];
    rows.forEach(function (r) {
      var op = r.querySelector('[name="cond-op"]').value;
      out.push({
        col: r.querySelector('[name="cond-col"]').value, op: op,
        value: r.querySelector('[name="cond-v1"]').value,
        value2: r.querySelector('[name="cond-v2"]').value
      });
    });
    if (!out.length) throw new Error(t('f.cond'));
    return out;
  }

  /* 排序动态行 */
  function dynSorts(df) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(el('label', { class: 'field-label', text: t('f.sortBy') }));
    var rows = el('div', { class: 'dyn-rows', 'data-kind': 'sort' });
    var add = el('button', { class: 'add-row-btn', type: 'button', text: t('f.addSort') });
    function addRow() {
      var row = el('div', { class: 'dyn-row dyn-row-sort' });
      var colSel = el('select', { name: 'sort-col' });
      df.columns.forEach(function (c) { colSel.appendChild(el('option', { value: c, text: c })); });
      var dirSel = el('select', { name: 'sort-dir' });
      dirSel.appendChild(el('option', { value: 'asc', text: t('f.asc') }));
      dirSel.appendChild(el('option', { value: 'desc', text: t('f.desc') }));
      var del = el('button', { class: 'row-del', type: 'button', text: '×' });
      del.addEventListener('click', function () { row.remove(); });
      row.appendChild(colSel); row.appendChild(dirSel); row.appendChild(del);
      rows.appendChild(row);
    }
    add.addEventListener('click', addRow);
    addRow();
    wrap.appendChild(rows); wrap.appendChild(add);
    return wrap;
  }
  function collectSorts(body) {
    var rows = body.querySelectorAll('.dyn-row-sort');
    var out = [];
    rows.forEach(function (r) {
      out.push({ col: r.querySelector('[name="sort-col"]').value,
                 asc: r.querySelector('[name="sort-dir"]').value === 'asc' });
    });
    if (!out.length) throw new Error(t('f.sortBy'));
    return out;
  }

  /* 聚合动态行 */
  function dynAggs(df) {
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(el('label', { class: 'field-label', text: t('f.aggs') }));
    var rows = el('div', { class: 'dyn-rows', 'data-kind': 'agg' });
    var add = el('button', { class: 'add-row-btn', type: 'button', text: t('f.addAgg') });
    function addRow() {
      var row = el('div', { class: 'dyn-row dyn-row-agg' });
      var colSel = el('select', { name: 'agg-col' });
      df.columns.forEach(function (c) { colSel.appendChild(el('option', { value: c, text: c })); });
      var fnSel = el('select', { name: 'agg-fn' });
      AGGS.forEach(function (f) { fnSel.appendChild(el('option', { value: f, text: f })); });
      fnSel.value = 'sum';
      var del = el('button', { class: 'row-del', type: 'button', text: '×' });
      fnSel.addEventListener('change', function () {
        colSel.disabled = fnSel.value === 'size';
      });
      del.addEventListener('click', function () { row.remove(); });
      row.appendChild(colSel); row.appendChild(fnSel); row.appendChild(del);
      rows.appendChild(row);
    }
    add.addEventListener('click', addRow);
    addRow();
    wrap.appendChild(rows); wrap.appendChild(add);
    return wrap;
  }
  function collectAggs(body) {
    var rows = body.querySelectorAll('.dyn-row-agg');
    var out = [];
    rows.forEach(function (r) {
      var fn = r.querySelector('[name="agg-fn"]').value;
      out.push({ col: fn === 'size' ? null : r.querySelector('[name="agg-col"]').value, func: fn });
    });
    if (!out.length) throw new Error(t('f.aggs'));
    return out;
  }

  /* ================= 模态框 ================= */

  var modalMask = $('modal-mask'), modalBox = $('modal');

  function closeModal() { modalMask.hidden = true; modalBox.innerHTML = ''; }
  modalMask.addEventListener('click', function (e) { if (e.target === modalMask) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalMask.hidden) closeModal();
  });

  function openOpDialog(opKey) {
    var op = OPS[opKey];
    var df = currentDf();
    if (op.needOther && !otherDatasets().length) {
      toast(t('msg.needOther'), true);
      return;
    }
    if (op.group === 'viz' && opKey !== 'heatmap' && !PD.numericColumns(df).length &&
        (opKey === 'hist' || opKey === 'scatter' || opKey === 'box')) {
      toast(t('msg.noNumCol'), true);
      return;
    }
    if (op.group === 'ml' && PD.numericColumns(df).length < 2) {
      toast(t('msg.noNumCol'), true);
      return;
    }
    /* 时序操作需要数值列;resample 还需要 datetime 列 */
    if (op.group === 'ts') {
      if (!PD.numericColumns(df).length) {
        toast(t('msg.noNumCol'), true);
        return;
      }
      if (opKey === 'resample' && !df.columns.some(function (c) { return df.dtypes[c] === 'datetime'; })) {
        toast(t('msg.needDateCol'), true);
        return;
      }
    }

    var body = el('div', { class: 'modal-body' });
    if (op.dialog) op.dialog(body, df);
    var err = el('p', { class: 'field-error' });

    modalBox.innerHTML = '';
    modalBox.appendChild(el('h3', { class: 'modal-title', text: t('op.' + opKey) }));
    modalBox.appendChild(body);
    modalBox.appendChild(err);
    var actions = el('div', { class: 'modal-actions' });
    var cancel = el('button', { class: 'btn', type: 'button', text: t('act.cancel') });
    var ok = el('button', { class: 'btn btn-primary', type: 'button', text: t('act.apply') });
    cancel.addEventListener('click', closeModal);
    ok.addEventListener('click', function () {
      var params = {};
      try {
        if (op.collect) params = op.collect(body);
        applyOp(opKey, params);
        closeModal();
      } catch (e) {
        err.textContent = String(e.message || e);
      }
    });
    actions.appendChild(cancel); actions.appendChild(ok);
    modalBox.appendChild(actions);
    modalMask.hidden = false;
    var first = modalBox.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  /* 无参数操作直接执行 */
  function runOp(opKey) {
    if (OPS[opKey].dialog) openOpDialog(opKey);
    else {
      try { applyOp(opKey, {}); }
      catch (e) { toast(t('msg.opFail', { err: e.message || e }), true); }
    }
  }

  /* ================= 应用操作 ================= */

  function applyOp(opKey, params) {
    var op = OPS[opKey];
    var st = cur();
    var dfBefore = dfOf(st);
    var codeLine = op.code(params, dfBefore);
    var entry = { code: codeLine, cmt: op.cmt, mut: !!op.mutating };

    if (op.mutating) {
      var next = op.apply(dfBefore, params);
      st.steps.push({ key: opKey, params: params, apply: function (d) { return op.apply(d, params); } });
      st.redoStack = [];
      st.codeLog.push(entry);
      st.page = 1;
      toast(t('msg.applied', { op: t('op.' + opKey) }));
      /* 带 run / chart 的 mutating 操作(时序三件套):基于应用后的新表渲染联动面板 */
      if (op.run) { resultState = { opKey: opKey, params: params }; showResult(op.run(next, params)); }
      if (op.chart) showChart(opKey, params, op.chart(next, params));
    } else {
      st.codeLog.push(entry);
      if (op.run) { resultState = { opKey: opKey, params: params }; showResult(op.run(dfBefore, params)); }
      if (op.chart) showChart(opKey, params, op.chart(dfBefore, params));
    }
    renderAll();
  }

  /* 表头点击排序 → 记为一次 sort 操作 */
  function headerSort(col) {
    var st = cur();
    var last = st.steps.length ? st.steps[st.steps.length - 1] : null;
    var asc = true;
    if (last && last.key === 'sort' && last.params.specs.length === 1 &&
        last.params.specs[0].col === col) {
      asc = !last.params.specs[0].asc;
    }
    try { applyOp('sort', { specs: [{ col: col, asc: asc }] }); }
    catch (e) { toast(t('msg.opFail', { err: e.message || e }), true); }
  }

  /* ================= 撤销 / 重做 / 复位 ================= */

  function undo() {
    var st = cur();
    if (!st.steps.length) { toast(t('msg.nothing')); return; }
    var step = st.steps.pop();
    st.redoStack.push(step);
    /* 从 codeLog 里删掉这一步对应的那一条(倒序找 mutating 的 entry) */
    for (var i = st.codeLog.length - 1; i >= 0; i--) {
      if (st.codeLog[i].mut) { st.codeLog.splice(i, 1); break; }
    }
    renderAll();
    toast(t('msg.undone'));
  }
  function redo() {
    var st = cur();
    if (!st.redoStack.length) { toast(t('msg.nothingRedo')); return; }
    var step = st.redoStack.pop();
    st.steps.push(step);
    var op = OPS[step.key];
    st.codeLog.push({ code: op.code(step.params, dfOf(st)), cmt: op.cmt });
    renderAll();
    toast(t('msg.redone'));
  }
  function resetAll() {
    var st = cur();
    st.steps = [];
    st.redoStack = [];
    st.codeLog = st.codeLog.slice(0, 1);
    st.page = 1;
    renderAll();
    toast(t('msg.resetDone'));
  }

  /* ================= 渲染:状态栏 / 历史 / 代码 ================= */

  /* 内置数据集的简介 i18n key;不在此名单的(上传/粘贴/URL 导入)走通用文案 */
  var DS_DESC_KEYS = ['sales', 'products', 'tips', 'iris', 'titanic', 'weather'];

  function renderStatus(df) {
    var st = cur();
    $('ds-name').textContent = activeName;
    $('ds-shape').textContent = df.rows.length + ' × ' + df.columns.length;
    $('ds-desc').textContent = DS_DESC_KEYS.indexOf(activeName) >= 0
      ? t('ds.' + activeName) : t('ds.generic');
    var nulls = 0;
    df.rows.forEach(function (r) {
      r.forEach(function (v) { if (PD.isNull(v)) nulls++; });
    });
    var miss = $('ds-missing');
    miss.textContent = nulls ? t('stat.missing', { n: nulls }) : t('stat.none');
    miss.className = 'badge ' + (nulls ? 'badge-warn' : 'badge-ok');
    $('ds-mem').textContent = t('stat.mem', {
      n: Math.max(1, Math.round(JSON.stringify(df.rows).length / 1024))
    });
    $('undo-btn').disabled = !st.steps.length;
    $('redo-btn').disabled = !st.redoStack.length;
    $('reset-btn').disabled = !st.steps.length;
  }

  function renderHistory() {
    var st = cur();
    var box = $('history-chips');
    box.innerHTML = '';
    box.appendChild(el('span', {
      class: 'chip' + (st.steps.length ? '' : ' chip-current'),
      text: t('hist.original')
    }));
    st.steps.forEach(function (s, i) {
      var isCur = i === st.steps.length - 1;
      var chip = el('span', { class: 'chip' + (isCur ? ' chip-current' : '') });
      chip.appendChild(el('span', { text: t('op.' + s.key) }));
      box.appendChild(chip);
    });
    st.redoStack.slice().reverse().forEach(function (s) {
      box.appendChild(el('span', { class: 'chip chip-redo', text: t('op.' + s.key) }));
    });
    if (!st.steps.length && !st.redoStack.length) {
      box.appendChild(el('span', { class: 'chip', text: t('hist.empty') }));
    }
  }

  function renderCode() {
    var st = cur();
    var lines = [t('code.header'), ''];
    st.codeLog.forEach(function (e) {
      var cmt = e.cmt ? '  # ' + t(e.cmt) : '';
      lines.push(e.code + cmt);
    });
    var codeEl = $('code-block');
    codeEl.textContent = lines.join('\n');
  }

  /* ================= 表格筛选条 =================
   * 每张表格上方一行筛选条:每列一个多选下拉(选项 = 该列去重值,可输关键字搜索),
   * 各列条件取交集;末尾「筛选」按钮应用、「清除」恢复。
   * 主数据表按数据过滤(联动分页),结果面板表格按 DOM 行显隐,都不改数据本身。 */

  var mainFilter = null;   /* 主数据表筛选状态:列名(或 '#') -> 选中值数组;切数据集时重置 */
  var TF_MAX_OPTS = 1000;  /* 单列下拉最多列出的选项数 */

  function sortTfVals(list) {
    return list.slice().sort(function (a, b) {
      if (a === 'NaN') return -1;
      if (b === 'NaN') return 1;
      var na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }

  /* 某列在整表中的去重展示值(与单元格渲染同源:缺失显示 NaN) */
  function tfDistinctCol(df, col) {
    var ci = df.columns.indexOf(col), dt = df.dtypes[col];
    var seen = {}, out = [];
    for (var r = 0; r < df.rows.length; r++) {
      var v = df.rows[r][ci];
      var txt = PD.isNull(v) ? 'NaN' : PD.formatValue(v, dt);
      if (!seen[txt]) { seen[txt] = 1; out.push(txt); if (out.length >= TF_MAX_OPTS) break; }
    }
    return sortTfVals(out);
  }

  /* 构建筛选条:headers/valuesPerCol/checkedByCol 均按列下标对齐;
   * onApply(checked) 的 checked 是「每列勾选值数组」 */
  function buildTfBar(headers, valuesPerCol, checkedByCol, onApply) {
    var bar = el('div', { 'class': 'tf-bar' });
    var items = [];   /* { item, btn, badge, panel, search, allBox, boxes } */

    function closeOthers(except) {
      items.forEach(function (it) {
        if (it.item !== except) {
          it.item.classList.remove('open');
          it.panel.hidden = true;
        }
      });
    }

    headers.forEach(function (h, ci) {
      var vals = sortTfVals(valuesPerCol[ci] || []).slice(0, TF_MAX_OPTS);
      var checked = {};
      ((checkedByCol && checkedByCol[ci]) || []).forEach(function (v) { checked[v] = 1; });

      var item = el('div', { 'class': 'tf-item' });
      var btn = el('button', { 'class': 'tf-btn', type: 'button', title: h });
      var badge = el('span', { 'class': 'tf-badge' });
      btn.appendChild(el('span', { 'class': 'tf-btn-name', text: h }));
      btn.appendChild(badge);
      btn.appendChild(el('span', { 'class': 'tf-caret', text: '▾' }));

      var panel = el('div', { 'class': 'tf-panel' });
      panel.hidden = true;
      var search = el('input', { 'class': 'tf-search', type: 'text', placeholder: t('tf.search') });
      var allRow = el('label', { 'class': 'tf-all' });
      var allBox = el('input', { type: 'checkbox' });
      allRow.appendChild(allBox);
      allRow.appendChild(el('span', { text: t('tf.all') }));
      var opts = el('div', { 'class': 'tf-opts' });
      var boxes = [];

      vals.forEach(function (v) {
        var lab = el('label', { 'class': 'tf-opt' });
        var cb = el('input', { type: 'checkbox' });
        cb.checked = !!checked[v];
        lab.appendChild(cb);
        lab.appendChild(el('span', { 'class': 'tf-opt-txt', text: v }));
        opts.appendChild(lab);
        boxes.push({ v: v, cb: cb, lab: lab });
      });

      function visibleBoxes() {
        return boxes.filter(function (b) { return b.lab.style.display !== 'none'; });
      }
      function syncBtn() {
        var n = boxes.filter(function (b) { return b.cb.checked; }).length;
        badge.textContent = String(n);
        badge.hidden = n === 0;
        item.classList.toggle('has-sel', n > 0);
      }
      function syncAll() {
        var vis = visibleBoxes();
        var n = vis.filter(function (b) { return b.cb.checked; }).length;
        allBox.checked = vis.length > 0 && n === vis.length;
        allBox.indeterminate = n > 0 && n < vis.length;
      }
      allBox.addEventListener('change', function () {
        var on = allBox.checked;
        visibleBoxes().forEach(function (b) { b.cb.checked = on; });
        syncBtn();
      });
      boxes.forEach(function (b) {
        b.cb.addEventListener('change', function () { syncBtn(); syncAll(); });
      });
      search.addEventListener('input', function () {
        var kw = search.value.trim().toLowerCase();
        boxes.forEach(function (b) {
          b.lab.style.display = !kw || b.v.toLowerCase().indexOf(kw) >= 0 ? '' : 'none';
        });
        syncAll();
      });
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = panel.hidden;
        closeOthers(null);
        panel.hidden = !willOpen;
        item.classList.toggle('open', willOpen);
        if (willOpen) {
          search.value = '';
          boxes.forEach(function (b) { b.lab.style.display = ''; });
          /* 靠近右缘时面板向左展开,避免被容器裁掉 */
          panel.classList.toggle('flip',
            btn.getBoundingClientRect().right + 224 > bar.getBoundingClientRect().right);
          syncAll();
        }
      });

      item.appendChild(btn);
      panel.appendChild(search);
      panel.appendChild(allRow);
      panel.appendChild(opts);
      item.appendChild(panel);
      bar.appendChild(item);
      items.push({ item: item, btn: btn, badge: badge, panel: panel, search: search, allBox: allBox, boxes: boxes });
      syncBtn();
    });

    var applyBtn = el('button', { 'class': 'tf-apply', type: 'button', text: t('tf.apply') });
    var clearBtn = el('button', { 'class': 'tf-clear', type: 'button', text: t('tf.clear') });
    applyBtn.addEventListener('click', function () {
      closeOthers(null);
      onApply(items.map(function (it) {
        return it.boxes.filter(function (b) { return b.cb.checked; }).map(function (b) { return b.v; });
      }));
    });
    clearBtn.addEventListener('click', function () {
      closeOthers(null);
      items.forEach(function (it) {
        it.boxes.forEach(function (b) { b.cb.checked = false; });
        it.item.classList.remove('has-sel');
        it.badge.hidden = true;
        it.search.value = '';
        it.boxes.forEach(function (b) { b.lab.style.display = ''; });
      });
      onApply(items.map(function () { return []; }));
    });
    bar.appendChild(applyBtn);
    bar.appendChild(clearBtn);
    return bar;
  }

  /* 点击下拉以外区域收起已展开的面板(整页只绑一次) */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && !e.target.closest('.tf-item')) {
      Array.prototype.forEach.call(document.querySelectorAll('.tf-item.open'), function (it) {
        it.classList.remove('open');
        var p = it.querySelector('.tf-panel');
        if (p) p.hidden = true;
      });
    }
  });

  /* 结果面板:给节点里的每张表挂筛选条(按 DOM 行显隐,不改数据) */
  function attachResultFilters(node) {
    Array.prototype.forEach.call(node.querySelectorAll('table'), function (tb) {
      var head = tb.tHead && tb.tHead.rows[0];
      var body = tb.tBodies[0];
      if (!head || !body || !body.rows.length) return;
      var n = head.cells.length;
      var headers = [], lists = [], seen = [];
      for (var c = 0; c < n; c++) {
        headers.push(head.cells[c].textContent.trim() || '#');
        seen.push({});
        lists.push([]);
      }
      Array.prototype.forEach.call(body.rows, function (tr) {
        for (var c = 0; c < n; c++) {
          var cell = tr.cells[c];
          if (!cell) continue;
          var txt = cell.textContent.trim();
          if (!seen[c][txt]) { seen[c][txt] = 1; lists[c].push(txt); }
        }
      });
      var bar = buildTfBar(headers, lists, null, function (checked) {
        var any = checked.some(function (a) { return a.length > 0; });
        Array.prototype.forEach.call(body.rows, function (tr) {
          var show = true;
          if (any) {
            for (var c = 0; c < n; c++) {
              if (!checked[c].length) continue;
              var cell = tr.cells[c];
              var txt = cell ? cell.textContent.trim() : '';
              if (checked[c].indexOf(txt) < 0) { show = false; break; }
            }
          }
          tr.style.display = show ? '' : 'none';
        });
      });
      tb.parentNode.insertBefore(bar, tb);
    });
  }

  /* ================= 渲染:数据表 ================= */

  function renderTable(df) {
    var st = cur();
    var wrap = $('table-wrap');
    var size = +$('page-size').value || 50;

    /* 应用筛选条:各列条件取交集(视图级,不改数据);'#' 对过滤后的行号生效 */
    var keep = df.rows;
    if (mainFilter) {
      var pre = df.rows.filter(function (row) {
        for (var col in mainFilter) {
          if (col === '#') continue;
          var ci = df.columns.indexOf(col);
          if (ci < 0) continue;   /* 列已被后续操作删掉时忽略该条件 */
          var v = row[ci];
          var txt = PD.isNull(v) ? 'NaN' : PD.formatValue(v, df.dtypes[col]);
          if (mainFilter[col].indexOf(txt) < 0) return false;
        }
        return true;
      });
      if (mainFilter['#']) {
        var posSet = {};
        mainFilter['#'].forEach(function (p) { posSet[p] = 1; });
        keep = pre.filter(function (_, pos) { return !!posSet[String(pos)]; });
      } else {
        keep = pre;
      }
    }

    var pages = Math.max(1, Math.ceil(keep.length / size));
    if (st.page > pages) st.page = pages;
    if (st.page < 1) st.page = 1;

    if (!keep.length) {
      wrap.innerHTML = '<div class="table-empty">' +
        esc(mainFilter ? t('tf.noMatch') : t('tbl.empty')) + '</div>';
    } else {
      var start = (st.page - 1) * size;
      var rows = keep.slice(start, start + size);
      var html = '<table class="data-table"><thead><tr><th class="cell-idx">#</th>';
      /* 表头排序状态:最后一步是单列 sort 时显示箭头 */
      var last = st.steps.length ? st.steps[st.steps.length - 1] : null;
      var sortCol = last && last.key === 'sort' && last.params.specs.length === 1 ? last.params.specs[0] : null;
      df.columns.forEach(function (c) {
        var arrow = sortCol && sortCol.col === c ? (sortCol.asc ? ' ▲' : ' ▼') : '';
        html += '<th data-col="' + esc(c) + '" tabindex="0"><span class="th-name">' + esc(c) +
          '<span class="th-dtype dt-' + df.dtypes[c] + '">' + df.dtypes[c] + '</span>' +
          (arrow ? '<span class="th-sort">' + arrow + '</span>' : '') + '</span></th>';
      });
      html += '</tr></thead><tbody>';
      rows.forEach(function (row, r) {
        html += '<tr><td class="cell-idx">' + (start + r) + '</td>';
        row.forEach(function (v, i) {
          var dt = df.dtypes[df.columns[i]];
          if (PD.isNull(v)) html += '<td class="cell-null">NaN</td>';
          else if (dt === 'number') html += '<td class="cell-num">' + esc(PD.formatValue(v, dt)) + '</td>';
          else html += '<td>' + esc(PD.formatValue(v, dt)) + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;
    }

    /* 挂筛选条(重建以同步勾选状态;空表且无筛选时不显示) */
    var panelBox = wrap.parentNode;
    var oldBar = panelBox.querySelector('.tf-bar');
    if (oldBar) oldBar.parentNode.removeChild(oldBar);
    if (df.rows.length || mainFilter) {
      var headers = ['#'].concat(df.columns);
      var valuesPer = [df.rows.map(function (_, i) { return String(i); })];
      df.columns.forEach(function (c) { valuesPer.push(tfDistinctCol(df, c)); });
      var checkedByCol = mainFilter
        ? headers.map(function (h) { return (mainFilter[h] || []).slice(); })
        : null;
      var tfBar = buildTfBar(headers, valuesPer, checkedByCol, function (checked) {
        var f = null;
        headers.forEach(function (h, i) {
          if (checked[i] && checked[i].length) { (f || (f = {}))[h] = checked[i]; }
        });
        mainFilter = f;
        st.page = 1;
        renderTable(df);
      });
      panelBox.insertBefore(tfBar, wrap);
    }

    $('page-info').textContent = t('tbl.page', { p: st.page, n: pages });
    $('page-prev').disabled = st.page <= 1;
    $('page-next').disabled = st.page >= pages;

    /* 表头点击排序(事件委托,每次重绘重新绑) */
    wrap.querySelectorAll('th[data-col]').forEach(function (th) {
      function go() { headerSort(th.getAttribute('data-col')); }
      th.addEventListener('click', go);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
  }

  /* ================= 结果面板(只读操作) ================= */

  var resultState = null;  /* { opKey, params } —— 语言切换后重建 */

  function showResult(res) {
    var panel = $('result-panel');
    $('result-title').textContent = res.title;
    var body = $('result-body');
    body.innerHTML = '';
    body.appendChild(res.node);
    attachResultFilters(res.node);
    panel.hidden = false;
  }

  function dfToTableNode(df, maxRows) {
    var limit = Math.min(df.rows.length, maxRows || 200);
    var html = '<table><thead><tr><th>#</th>';
    df.columns.forEach(function (c) { html += '<th>' + esc(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    for (var r = 0; r < limit; r++) {
      html += '<tr><td>' + r + '</td>';
      df.rows[r].forEach(function (v, i) {
        var dt = df.dtypes[df.columns[i]];
        html += PD.isNull(v) ? '<td class="cell-null">NaN</td>'
          : '<td class="' + (dt === 'number' ? 'num' : '') + '">' + esc(PD.formatValue(v, dt)) + '</td>';
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    var node = el('div');
    node.innerHTML = html;
    return node;
  }

  function resultDf(title, df) { return { title: title, node: dfToTableNode(df) }; }

  function resultInfo(df) {
    var info = PD.info(df);
    var html = '<p class="result-note">' + esc(t('src.rowsCols', { rows: info.rows, cols: info.cols })) + '</p>';
    html += '<table><thead><tr><th>' + esc(t('res.col.name')) + '</th><th>' + esc(t('res.col.dtype')) +
      '</th><th>' + esc(t('res.col.nonNull')) + '</th><th>' + esc(t('res.col.nulls')) +
      '</th><th>' + esc(t('res.col.unique')) + '</th></tr></thead><tbody>';
    info.columns.forEach(function (c) {
      html += '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.dtype) + '</td><td class="num">' + c.nonNull +
        '</td><td class="num">' + c.nulls + '</td><td class="num">' + c.unique + '</td></tr>';
    });
    html += '</tbody></table>';
    var node = el('div'); node.innerHTML = html;
    return { title: t('res.info'), node: node };
  }

  function resultDescribe(df) {
    var desc = PD.describe(df);
    var stats = ['count', 'mean', 'std', 'min', 'q25', 'q50', 'q75', 'max'];
    var numCols = desc.filter(function (d) { return d.kind === 'number' && d.stats; });
    var html = '<p class="result-note">' + esc(t('res.summary.num', { n: numCols.length })) + '</p>';
    if (numCols.length) {
      html += '<table><thead><tr><th>' + esc(t('res.stat')) + '</th>';
      numCols.forEach(function (d) { html += '<th>' + esc(d.column) + '</th>'; });
      html += '</tr></thead><tbody>';
      stats.forEach(function (s) {
        html += '<tr><td>' + s + '</td>';
        numCols.forEach(function (d) {
          html += '<td class="num">' + esc(PD.formatValue(d.stats[s])) + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
    }
    var others = desc.filter(function (d) { return d.kind !== 'number'; });
    if (others.length) {
      html += '<p class="result-note" style="margin-top:12px">count / unique / top / freq</p>';
      html += '<table><thead><tr><th>' + esc(t('res.col.name')) + '</th><th>count</th><th>unique</th><th>top</th><th>freq</th></tr></thead><tbody>';
      others.forEach(function (d) {
        html += '<tr><td>' + esc(d.column) + '</td><td class="num">' + d.stats.count +
          '</td><td class="num">' + d.stats.unique + '</td><td>' + esc(d.stats.top || '') +
          '</td><td class="num">' + d.stats.freq + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    var node = el('div'); node.innerHTML = html;
    return { title: t('res.describe'), node: node };
  }

  /* 逐列缺失统计:返回 [{col, cnt, rate}] ,按缺失数降序 */
  function missingStats(df) {
    return df.columns.map(function (c) {
      var vals = PD.colValues(df, c);
      var cnt = 0;
      vals.forEach(function (v) { if (PD.isNull(v)) cnt++; });
      return { col: c, cnt: cnt, rate: vals.length ? cnt / vals.length * 100 : 0 };
    }).sort(function (a, b) { return b.cnt - a.cnt; });
  }

  /* 缺失值地图:三列表格(列 / 缺失数 / 缺失率%),全表无缺失时给提示文案 */
  function resultMissingMap(df) {
    var stats = missingStats(df);
    var total = 0;
    stats.forEach(function (s) { total += s.cnt; });
    var html;
    if (!total) {
      html = '<p class="result-note">' + esc(t('msg.noMissing')) + '</p>';
    } else {
      html = '<table><thead><tr><th>' + esc(t('res.missCol')) + '</th><th>' + esc(t('res.missCnt')) +
        '</th><th>' + esc(t('res.missRate')) + '</th></tr></thead><tbody>';
      stats.forEach(function (s) {
        html += '<tr><td>' + esc(s.col) + '</td><td class="num">' + s.cnt +
          '</td><td class="num">' + s.rate.toFixed(1) + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    var node = el('div'); node.innerHTML = html;
    return { title: t('op.missingmap'), node: node };
  }

  function resultValueCounts(df, col) {
    var counts = PD.valueCounts(df, col);
    var html = '<table><thead><tr><th>' + esc(col) + '</th><th>' + esc(t('res.count')) +
      '</th><th>' + esc(t('res.pct')) + '</th></tr></thead><tbody>';
    counts.slice(0, 100).forEach(function (c) {
      html += '<tr><td>' + (c.value === null ? '<span class="cell-null">NaN</span>' : esc(c.value)) +
        '</td><td class="num">' + c.count + '</td><td class="num">' + c.pct.toFixed(1) + '</td></tr>';
    });
    html += '</tbody></table>';
    var node = el('div'); node.innerHTML = html;
    return { title: 'value_counts · ' + col, node: node };
  }

  function resultCorr(df) {
    var m = PD.corr(df);
    var html = '<table><thead><tr><th></th>';
    m.columns.forEach(function (c) { html += '<th>' + esc(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    m.matrix.forEach(function (row, i) {
      html += '<tr><th>' + esc(m.columns[i]) + '</th>';
      row.forEach(function (v) {
        html += '<td class="num">' + (v == null ? '—' : v.toFixed(3)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    var node = el('div'); node.innerHTML = html;
    return { title: t('op.corr'), node: node };
  }

  /* ================= 图表面板 ================= */

  var chartState = null;   /* { opKey, params, spec } —— 主题 / 语言切换后重建 */

  function showChart(opKey, params, spec) {
    if (!spec) { hideChart(); return; }   /* 操作声明了 chart 但本次无可画数据(如全表无缺失) */
    chartState = { opKey: opKey, params: params, spec: spec };
    $('chart-panel').hidden = false;
    CH.render($('chart-body'), spec);
    renderInsight(opKey, currentDf(), params);
  }
  function hideChart() { chartState = null; $('chart-panel').hidden = true; }

  function download(name, mime, content) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    toast(t('msg.exported', { name: name }));
  }

  function exportChartSvg() {
    var svg = $('chart-body').querySelector('svg');
    if (!svg) return;
    var css = '';
    ['--c-text-soft', '--c-muted', '--c-border', '--c-surface', '--s-base', '--s-base-alt',
     '--s-base-warm', '--c-accent', '--c-danger', '--c-primary',
     '--d1', '--d2', '--d3', '--d4', '--d5', '--d6'].forEach(function (v) {
      css += v + ':' + getComputedStyle(document.documentElement).getPropertyValue(v) + ';';
    });
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('style', css);
    download('chart.svg', 'image/svg+xml', new XMLSerializer().serializeToString(clone));
  }

  function exportChartPng() {
    var svg = $('chart-body').querySelector('svg');
    if (!svg) return;
    var css = '';
    ['--c-text-soft', '--c-muted', '--c-border', '--c-surface', '--s-base', '--s-base-alt',
     '--s-base-warm', '--c-accent', '--c-danger', '--c-primary',
     '--d1', '--d2', '--d3', '--d4', '--d5', '--d6'].forEach(function (v) {
      css += v + ':' + getComputedStyle(document.documentElement).getPropertyValue(v) + ';';
    });
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('style', css);
    var url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],
      { type: 'image/svg+xml' }));
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      var box = svg.viewBox.baseVal;
      canvas.width = (box && box.width ? box.width : 720) * 2;
      canvas.height = (box && box.height ? box.height : 400) * 2;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--c-surface');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (b) { download('chart.png', 'image/png', b); });
    };
    img.src = url;
  }

  /* ================= 数据源面板 ================= */

  function renderSources() {
    var builtin = $('src-builtin');
    builtin.innerHTML = '';
    DATA.builtin.forEach(function (d) {
      var name = d.key;
      var st = datasets[name];
      var meta = st ? t('src.rowsCols', { rows: st.original.rows.length, cols: st.original.columns.length }) : '';
      var btn = el('button', {
        class: 'src-item' + (name === activeName ? ' is-active' : ''), type: 'button'
      }, [el('span', { text: name }), el('span', { class: 'src-item-meta', text: meta })]);
      btn.addEventListener('click', function () {
        if (!datasets[name]) {
          var df = d.make();
          registerDataset(name, df);
        }
        switchDataset(name);
      });
      builtin.appendChild(btn);
    });
    var loaded = $('src-loaded');
    loaded.innerHTML = '';
    Object.keys(datasets).forEach(function (name) {
      var isBuiltin = DATA.builtin.some(function (d) { return d.key === name; });
      if (isBuiltin) return;
      var st = datasets[name];
      var btn = el('button', {
        class: 'src-item' + (name === activeName ? ' is-active' : ''), type: 'button'
      }, [el('span', { text: name }),
          el('span', { class: 'src-item-meta', text: t('src.rowsCols', {
            rows: st.original.rows.length, cols: st.original.columns.length }) })]);
      btn.addEventListener('click', function () { switchDataset(name); });
      loaded.appendChild(btn);
    });
    if (!loaded.children.length) {
      loaded.appendChild(el('span', { class: 'src-item-meta', text: '—' }));
    }
  }

  /* ================= 导入:文件 / 粘贴 / URL ================= */

  function loadTextAs(text, name, isJson) {
    try {
      var df = isJson ? PD.dfFromJSON(JSON.parse(text), name) : PD.dfFromCSV(text, name);
      if (!df.rows.length) throw new Error('0 rows');
      var regName = registerDataset(name, df);
      switchDataset(regName);
      toast(t('msg.loaded', { name: regName, rows: df.rows.length, cols: df.columns.length }));
    } catch (e) {
      toast(t('msg.loadFail', { err: e.message || e }), true);
    }
  }

  function bindImports() {
    $('upload-btn').addEventListener('click', function () { $('file-input').click(); });
    $('file-input').addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var name = f.name.replace(/\.(csv|json|txt)$/i, '');
        loadTextAs(String(reader.result), name, /\.json$/i.test(f.name));
      };
      reader.readAsText(f, 'utf-8');
      this.value = '';
    });

    $('paste-btn').addEventListener('click', function () {
      modalBox.innerHTML = '';
      modalBox.appendChild(el('h3', { class: 'modal-title', text: t('src.pasteTitle') }));
      var body = el('div', { class: 'modal-body' });
      body.appendChild(textField('dsname', t('src.name'), 'my_data'));
      var ta = el('textarea', { name: 'csv', placeholder: 'a,b,c\n1,x,true\n2,y,false' });
      body.appendChild(fieldWrap('CSV', ta));
      body.appendChild(el('p', { class: 'modal-note', text: t('src.pasteHint') }));
      modalBox.appendChild(body);
      var err = el('p', { class: 'field-error' });
      modalBox.appendChild(err);
      var actions = el('div', { class: 'modal-actions' });
      var cancel = el('button', { class: 'btn', type: 'button', text: t('act.cancel') });
      var ok = el('button', { class: 'btn btn-primary', type: 'button', text: t('act.apply') });
      cancel.addEventListener('click', closeModal);
      ok.addEventListener('click', function () {
        try {
          var df = PD.dfFromCSV(ta.value, val(body, 'dsname').trim() || 'my_data');
          if (!df.rows.length) throw new Error('0 rows');
          var regName = registerDataset(df.name, df);
          closeModal();
          switchDataset(regName);
          toast(t('msg.loaded', { name: regName, rows: df.rows.length, cols: df.columns.length }));
        } catch (e) { err.textContent = String(e.message || e); }
      });
      actions.appendChild(cancel); actions.appendChild(ok);
      modalBox.appendChild(actions);
      modalMask.hidden = false;
      ta.focus();
    });

    $('url-btn').addEventListener('click', function () {
      modalBox.innerHTML = '';
      modalBox.appendChild(el('h3', { class: 'modal-title', text: t('src.urlTitle') }));
      var body = el('div', { class: 'modal-body' });
      var urlInp = el('input', { name: 'url', type: 'url', placeholder: 'https://example.com/data.csv' });
      body.appendChild(fieldWrap('URL', urlInp));
      body.appendChild(el('p', { class: 'modal-note', text: t('src.urlHint') }));
      modalBox.appendChild(body);
      var err = el('p', { class: 'field-error' });
      modalBox.appendChild(err);
      var actions = el('div', { class: 'modal-actions' });
      var cancel = el('button', { class: 'btn', type: 'button', text: t('act.cancel') });
      var ok = el('button', { class: 'btn btn-primary', type: 'button', text: t('act.apply') });
      cancel.addEventListener('click', closeModal);
      ok.addEventListener('click', function () {
        var url = urlInp.value.trim();
        if (!url) { err.textContent = 'URL'; return; }
        ok.disabled = true;
        fetch(url).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        }).then(function (text) {
          var name = (url.split('/').pop() || 'remote').replace(/\.(csv|json|txt)$/i, '') || 'remote';
          closeModal();
          loadTextAs(text, name, /\.json(\?|$)/i.test(url));
        }).catch(function (e) {
          err.textContent = String(e.message || e);
        }).finally(function () { ok.disabled = false; });
      });
      actions.appendChild(cancel); actions.appendChild(ok);
      modalBox.appendChild(actions);
      modalMask.hidden = false;
      urlInp.focus();
    });
  }

  /* ================= 操作侧边栏 ================= */

  function renderOps() {
    var root = $('ops-root');
    root.innerHTML = '';
    GROUPS.forEach(function (g) {
      var grp = el('div', { class: 'op-group' });
      grp.appendChild(el('div', { class: 'op-group-label', text: t('opg.' + g.key) }));
      var grid = el('div', { class: 'op-grid' });
      g.ops.forEach(function (k) {
        var btn = el('button', { class: 'op-btn', type: 'button', text: t('op.' + k) });
        btn.addEventListener('click', function () { runOp(k); });
        grid.appendChild(btn);
      });
      grp.appendChild(grid);
      root.appendChild(grp);
    });
  }

  /* ================= 说明弹窗 ================= */

  function openHelp() {
    modalBox.innerHTML = '';
    modalBox.appendChild(el('h3', { class: 'modal-title', text: t('help.title') }));
    var body = el('div', { class: 'modal-body', html: t('help.body') });
    modalBox.appendChild(body);
    var actions = el('div', { class: 'modal-actions' });
    var ok = el('button', { class: 'btn btn-primary', type: 'button', text: t('act.close') });
    ok.addEventListener('click', closeModal);
    actions.appendChild(ok);
    modalBox.appendChild(actions);
    modalMask.hidden = false;
  }

  /* ================= 全量渲染 ================= */

  function renderAll() {
    var df = currentDf();
    renderSources();
    renderStatus(df);
    renderHistory();
    renderTable(df);
    renderCode();
  }

  /* ================= 启动 ================= */

  function boot() {
    /* 内置默认数据集 */
    DATA.builtin.forEach(function (d) {
      registerDataset(d.key, d.make());
    });
    activeName = DATA.defaultKey;

    renderOps();
    renderAll();
    bindImports();

    $('undo-btn').addEventListener('click', undo);
    $('redo-btn').addEventListener('click', redo);
    $('reset-btn').addEventListener('click', resetAll);
    $('export-btn').addEventListener('click', function () {
      download(activeName + '.csv', 'text/csv;charset=utf-8', '﻿' + PD.toCSV(currentDf()));
    });
    $('help-btn').addEventListener('click', openHelp);
    /* 代码面板开/关:宽屏收进栅格第三列,窄屏是右侧滑出层(会盖住工具栏按钮,
       所以面板里必须有自己的「关闭」按钮) */
    function setCodePanel(open) {
      if (window.innerWidth > 1200) {
        document.querySelector('.app').classList.toggle('code-hidden', !open);
      } else {
        $('code-panel').classList.toggle('open', open);
      }
    }
    $('code-btn').addEventListener('click', function () {
      var nowClosed = window.innerWidth > 1200
        ? document.querySelector('.app').classList.contains('code-hidden')
        : !$('code-panel').classList.contains('open');
      setCodePanel(nowClosed);
    });
    $('code-close').addEventListener('click', function () { setCodePanel(false); });
    $('code-copy').addEventListener('click', function () {
      var text = $('code-block').textContent;
      function done() { toast(t('act.copied')); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(); });
      } else fallback();
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* 忽略 */ }
        ta.remove();
      }
    });
    $('result-close').addEventListener('click', function () { $('result-panel').hidden = true; });
    $('chart-close').addEventListener('click', hideChart);
    $('chart-svg-btn').addEventListener('click', exportChartSvg);
    $('chart-png-btn').addEventListener('click', exportChartPng);
    $('page-prev').addEventListener('click', function () { cur().page--; renderAll(); });
    $('page-next').addEventListener('click', function () { cur().page++; renderAll(); });
    $('page-size').addEventListener('change', function () { cur().page = 1; renderAll(); });

    /* 语言切换:动态内容重绘 */
    document.addEventListener('langchange', function () {
      renderOps();
      renderAll();
      if (chartState) {
        var cop = OPS[chartState.opKey];
        chartState.spec = cop.chart(currentDf(), chartState.params);
        CH.render($('chart-body'), chartState.spec);
        renderInsight(chartState.opKey, currentDf(), chartState.params);
      }
      if (resultState && !$('result-panel').hidden) {
        showResult(OPS[resultState.opKey].run(currentDf(), resultState.params));
      }
    });
    /* 主题切换:图表重绘取新配色 */
    document.addEventListener('themechange', function () {
      if (chartState) CH.render($('chart-body'), chartState.spec);
    });

    /* 窄屏默认收起代码面板 */
    if (window.innerWidth > 1200) $('code-panel').classList.remove('open');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
