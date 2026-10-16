// =========================================================
// practice.js —— 「D3 实战工作台」引擎（普通 script，非 ES Module）
// ---------------------------------------------------------
// 机制参考源站 vis/practice.js（分栏工作台 / 环节导航 / 分级提示 /
// 检查点 / 进度持久化 / 导出），但预览与判定整段重写：
//
//   · 预览：把骨架 + 用户 JS 写进沙箱 iframe（contentDocument.write），
//     用户 JS 会被真正执行；d3 从本机 vendor/d3.min.js 加载（绝对 URL，
//     由 new URL('vendor/d3.min.js', location.href).href 解析，不引 CDN）。
//   · 判定：在主页面读 iframe.contentDocument（同源），
//     看真实渲染出来的 SVG DOM —— 只判效果，不判写法。
//   · 刷新：setTimeout 做 debounce，绝不用 requestAnimationFrame。
//
// 文案全部走 T 表，可用 window.PRACTICE_UI 覆盖（P8 做英文镜像）。
// =========================================================
(function () {
  'use strict';

  var CASE = window.PRACTICE_CASE;
  if (!CASE || !CASE.steps || !CASE.steps.length) return;

  /* =============== 文案表 =============== */
  var T = {
    goal: '目标',
    audience: '读者',
    constraints: '约束',
    assetsTitle: '可插入片段（点一下插到光标处）',
    stepsTitle: '搭建环节',
    syntaxTitle: '语法速查',

    progress: '{done} / {total} 个环节已通过',
    run: '▶ 运行',
    check: '✅ 检查本环节',
    checkOk: '本环节检查点全部通过 ✅',
    checkNo: '还有 {n} 项没达到要求',
    checkIdle: '点「✅ 检查本环节」或「▶ 运行」开始判定；停止输入 500 ms 会自动重跑。',
    checkNoDoc: '读不到预览文档，无法判定：请点一次「▶ 运行」重载预览。',
    checkErr: '检查执行出错：{msg}',
    runError: '运行出错：{msg}',
    slow: '预览里还没有 <svg>：先把画布画出来（环节 1 的 TODO ①）；如果代码已经写了却仍无输出，检查有没有死循环或被条件挡住。',
    prev: '← 上一环节',
    next: '下一环节 →',
    hintMore: '再看一条提示（{n} / {total}）',
    hintLevel: '提示 {n}',
    solution: '参考答案',
    solutionConfirm: '⚠ 参考答案会替换掉当前编辑器里的内容。再点一次确认。',
    reset: '↺ 重置本关',
    resetConfirm: '⚠ 会把本关代码恢复成起始代码。再点一次确认。',
    restart: '清空全部进度',
    restartConfirm: '⚠ 会清空 8 个环节的进度与草稿。再点一次确认。',
    copy: '复制代码',
    copied: '已复制到剪贴板。',
    copyFail: '复制失败：请手动全选（Ctrl/Cmd + A）后复制。',
    export: '⬇ 导出 SVG',
    exportNone: '预览里还没有 <svg>，先把画布画出来再导出。',
    exportDone: '已导出 {name}。',
    exportFail: '导出失败：{msg}',
    worksTitle: '我的作品（各环节草稿）',
    allPassed: '🎉 8 个环节全部通过 —— 试试点「⬇ 导出 SVG」把它存下来。',
    passed: '已通过',
  };

  function t(key, vars) {
    var s = (window.PRACTICE_UI && window.PRACTICE_UI[key]) || T[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  /* =============== 常量 =============== */
  var KEY_PROGRESS = 'vis4-lab-progress';
  var KEY_CODE = 'vis4-lab-code';
  var DEBOUNCE = 500;      // 停止输入 500 ms 后自动重跑
  var MEASURE = 240;       // 写入 iframe 后等它解析完再判定
  var SLOW_MS = 3000;      // 3 秒没有 SVG 就提示
  var DEVICES = [
    { key: 'fit', label: '等比 720', width: 720, height: 430 },
    { key: 'phone', label: '手机 375', width: 375, height: 470 },
  ];

  /* =============== 元素 =============== */
  var els = {
    brief: document.getElementById('lab-brief'),
    steps: document.getElementById('lab-steps'),
    progress: document.getElementById('lab-progress'),
    notice: document.getElementById('lab-notice'),
    task: document.getElementById('lab-task'),
    code: document.getElementById('lab-code'),
    checks: document.getElementById('lab-checks'),
    actions: document.getElementById('lab-actions'),
    works: document.getElementById('lab-works'),
    devices: document.getElementById('lab-devices'),
    frame: document.getElementById('lab-frame'),
    frameWrap: document.getElementById('lab-frame-wrap'),
    holder: document.getElementById('lab-frame-holder'),
    error: document.getElementById('lab-error'),
  };

  /* =============== 状态 =============== */
  var state = {
    step: 0,
    code: '',
    passed: {},        // { stepId: true }
    hintLevel: {},     // { stepId: n }
    used: {},          // { stepId: true } 用过参考答案
    stepCode: {},      // { stepId: '…' } 各环节草稿
    results: null,     // 上一次检查结果
    device: 'fit',
    confirm: null,     // 两步确认：{ act, at } 或 null
  };

  var runSeq = 0;
  var timers = { input: 0, measure: 0, slow: 0 };

  /* =============== 本地存储（隐私模式降级） =============== */
  function readStore(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : null;
    } catch (e) {
      return null;
    }
  }

  function writeStore(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 忽略：隐私模式 */ }
  }

  function dropStore(key) {
    try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
  }

  function saveProgress() {
    writeStore(KEY_PROGRESS, {
      caseId: CASE.id || 'd3-bar-lab',
      step: state.step,
      passed: state.passed,
      hintLevel: state.hintLevel,
      used: state.used,
      at: Date.now(),
    });
  }

  function saveCode() {
    writeStore(KEY_CODE, {
      caseId: CASE.id || 'd3-bar-lab',
      step: state.step,
      stepCode: state.stepCode,
      code: state.code,
      at: Date.now(),
    });
  }

  function restore() {
    var p = readStore(KEY_PROGRESS);
    if (p) {
      if (p.passed && typeof p.passed === 'object') state.passed = p.passed;
      if (p.hintLevel && typeof p.hintLevel === 'object') state.hintLevel = p.hintLevel;
      if (p.used && typeof p.used === 'object') state.used = p.used;
      if (typeof p.step === 'number' && p.step >= 0 && p.step < CASE.steps.length) state.step = p.step;
    }
    var c = readStore(KEY_CODE);
    if (c && c.stepCode && typeof c.stepCode === 'object') {
      state.stepCode = c.stepCode;
      if (typeof c.code === 'string') state.code = c.code;
      if (typeof c.step === 'number' && c.step >= 0 && c.step < CASE.steps.length) state.step = c.step;
    }
    if (!state.code) state.code = codeOf(state.step);
  }

  /* =============== 环节代码 =============== */
  function starterOf(i) {
    return i === 0 ? CASE.startCode.js : CASE.steps[i - 1].solution.js;
  }

  function codeOf(i) {
    var id = CASE.steps[i].id;
    if (typeof state.stepCode[id] === 'string') return state.stepCode[id];
    return starterOf(i);
  }

  /* =============== 渲染：案例要求 =============== */
  function renderBrief() {
    if (!els.brief) return;
    var b = CASE.brief || {};
    var html = '<div class="lab-brief">';
    if (b.goal) html += '<p class="lab-brief__goal"><b>' + t('goal') + '：</b>' + esc(b.goal) + '</p>';
    if (b.audience) html += '<p class="lab-brief__audience"><b>' + t('audience') + '：</b>' + esc(b.audience) + '</p>';
    if (b.constraints && b.constraints.length) {
      html += '<b>' + t('constraints') + '</b><ul>';
      b.constraints.forEach(function (c) { html += '<li>' + esc(c) + '</li>'; });
      html += '</ul>';
    }
    html += '</div>';
    els.brief.innerHTML = html;
  }

  /* =============== 渲染：环节列表（<ol> + <button>） =============== */
  function renderSteps() {
    if (!els.steps) return;
    var html = '<ol class="lab-step-list">';
    CASE.steps.forEach(function (s, i) {
      var cls = 'lab-step' + (i === state.step ? ' is-current' : '') + (state.passed[s.id] ? ' is-done' : '');
      var mark = state.passed[s.id] ? '<span class="lab-step__mark">✓ ' + t('passed') + '</span>' : '';
      html += '<li><button type="button" class="' + cls + '" data-lab-step="' + i + '">' +
        '<span class="lab-step__n">' + (i + 1) + '</span>' +
        '<span class="lab-step__txt">' + esc(s.title) + '</span>' + mark + '</button></li>';
    });
    html += '</ol>';
    els.steps.innerHTML = html;
  }

  /* =============== 渲染：进度 =============== */
  function renderProgress() {
    if (!els.progress) return;
    var done = 0;
    CASE.steps.forEach(function (s) { if (state.passed[s.id]) done++; });
    var pct = Math.round((done / CASE.steps.length) * 100);
    els.progress.innerHTML =
      '<div class="lab-progress__bar"><span class="lab-progress__fill" style="width:' + pct + '%"></span></div>' +
      '<p class="lab-progress__text">' + t('progress', { done: done, total: CASE.steps.length }) + '</p>';
  }

  /* =============== 渲染：任务卡 =============== */
  function renderTask() {
    if (!els.task) return;
    var s = CASE.steps[state.step];
    var html = '<h2 class="lab-task-title">' + esc(s.title) + '</h2>';
    if (s.subtitle) html += '<p class="lab-task-sub">' + esc(s.subtitle) + '</p>';

    html += '<h3 class="lab-block-title">动手写</h3><ol class="lab-req">';
    (s.task || []).forEach(function (x) { html += '<li>' + esc(x) + '</li>'; });
    html += '</ol>';

    if (CASE.assets && CASE.assets.length) {
      html += '<h3 class="lab-block-title">' + t('assetsTitle') + '</h3><div class="lab-assets">';
      CASE.assets.forEach(function (a, i) {
        html += '<button type="button" class="lab-btn" data-lab-asset="' + i + '">' + esc(a.label) + '</button>';
      });
      html += '</div>';
    }

    // 分级提示：已解锁 N 条，其余靠按钮解锁
    var total = (s.hints || []).length;
    var open = Math.max(0, Math.min(total, state.hintLevel[s.id] || 0));
    html += '<h3 class="lab-block-title">提示</h3><ul class="lab-hints">';
    for (var i = 0; i < open; i++) {
      html += '<li class="lab-hint"><span class="lab-hint__level">' + t('hintLevel', { n: i + 1 }) + '</span>' + esc(s.hints[i]) + '</li>';
    }
    html += '</ul>';
    if (open < total) {
      html += '<button type="button" class="lab-btn" data-lab-act="hint">' +
        t('hintMore', { n: open + 1, total: total }) + '</button>';
    }

    if (s.syntax && s.syntax.length) {
      html += '<h3 class="lab-block-title">' + t('syntaxTitle') + '</h3><ul class="lab-syntax">';
      s.syntax.forEach(function (y) {
        html += '<li><code>' + esc(y.code) + '</code><span>' + esc(y.note) + '</span></li>';
      });
      html += '</ul>';
    }
    els.task.innerHTML = html;
  }

  /* =============== 渲染：操作区 =============== */
  function renderActions() {
    if (!els.actions) return;
    var html = '';
    if (state.confirm) {
      html += '<p class="lab-quick">' + esc(state.confirm.text) + '<span class="lab-quick__acts">' +
        '<button type="button" class="lab-btn lab-btn--primary" data-lab-act="confirm">确认</button>' +
        '<button type="button" class="lab-btn" data-lab-act="cancel">取消</button></span></p>';
    }
    html += '<button type="button" class="lab-btn lab-btn--primary" data-lab-act="run">' + t('run') + '</button>';
    html += '<button type="button" class="lab-btn" data-lab-act="check">' + t('check') + '</button>';
    html += '<button type="button" class="lab-btn" data-lab-act="prev"' + (state.step === 0 ? ' disabled' : '') + '>' + t('prev') + '</button>';
    var last = state.step === CASE.steps.length - 1;
    html += '<button type="button" class="lab-btn" data-lab-act="next"' + (last ? ' disabled' : '') + '>' + t('next') + '</button>';
    html += '<span class="lab-actions__end">';
    html += '<button type="button" class="lab-btn" data-lab-act="export">' + t('export') + '</button>';
    html += '<button type="button" class="lab-btn" data-lab-act="copy">' + t('copy') + '</button>';
    html += '<button type="button" class="lab-btn" data-lab-act="solution">' + t('solution') + '</button>';
    html += '<button type="button" class="lab-btn lab-btn--danger" data-lab-act="reset">' + t('reset') + '</button>';
    html += '<button type="button" class="lab-btn lab-btn--danger" data-lab-act="restart">' + t('restart') + '</button>';
    html += '</span>';
    els.actions.innerHTML = html;
  }

  /* =============== 渲染：我的作品 =============== */
  function renderWorks() {
    if (!els.works) return;
    var html = '<b>' + t('worksTitle') + '</b><div>';
    CASE.steps.forEach(function (s, i) {
      var has = typeof state.stepCode[s.id] === 'string' && state.stepCode[s.id].length > 0;
      if (!has) return;
      html += '<button type="button" class="lab-btn" data-lab-work="' + i + '">' + esc(s.title) + '</button>';
    });
    html += '</div>';
    els.works.innerHTML = html;
    els.works.hidden = !/<button/.test(html);
  }

  /* =============== 渲染：检查结果 =============== */
  function renderChecks(opts) {
    if (!els.checks) return;
    var r = state.results;
    if (!r) {
      els.checks.innerHTML = '<p class="lab-checks__sum">' + esc(t('checkIdle')) + '</p>';
      return;
    }
    var html = '<p class="lab-checks__sum">' + esc(r.summary) + '</p><ul class="lab-checks__list">';
    r.items.forEach(function (it) {
      var cls = it.ok ? 'lab-check lab-check--ok' : 'lab-check lab-check--bad';
      var mark = it.ok ? '✓' : '✗';
      var detail = it.detail ? ('　' + esc(it.detail)) : '';
      html += '<li class="' + cls + '"><span class="lab-check__mark">' + mark + '</span><span class="lab-check__body">' +
        '<span class="lab-check__label">' + esc(it.label) + detail + '</span>';
      if (!it.ok && it.hint) html += '<span class="lab-check__hint">提示：' + esc(it.hint) + '</span>';
      html += '</span></li>';
    });
    html += '</ul>';
    els.checks.innerHTML = html;
    if (opts && opts.focus) els.checks.scrollIntoView({ block: 'nearest' });
  }

  /* =============== 渲染：预览宽度按钮 =============== */
  function renderDevices() {
    if (!els.devices) return;
    var html = '';
    DEVICES.forEach(function (d) {
      html += '<button type="button" class="lab-device' + (state.device === d.key ? ' is-on' : '') +
        '" data-lab-device="' + d.key + '" aria-pressed="' + (state.device === d.key) + '">' + esc(d.label) + '</button>';
    });
    els.devices.innerHTML = html;
  }

  function device() {
    for (var i = 0; i < DEVICES.length; i++) if (DEVICES[i].key === state.device) return DEVICES[i];
    return DEVICES[0];
  }

  /* =============== 预览：写入沙箱 iframe =============== */
  // 以 practice.js 自身位置为基准解析 vendor 路径：
  // 这样无论页面放在根目录还是 en/ 镜像里，都能找到同一份 vendor/d3.min.js
  var LAB_SCRIPT = document.currentScript;
  function d3Href() {
    var base = (LAB_SCRIPT && LAB_SCRIPT.src) || location.href;
    try { return new URL('vendor/d3.min.js', base).href; }
    catch (e) { return 'vendor/d3.min.js'; }
  }

  function buildDoc() {
    var report =
      "function __labPost(m){try{parent.__labError=m;}catch(e){}try{parent.postMessage({source:'vis4-lab',type:'error',message:m},'*');}catch(e){}}" +
      "window.addEventListener('error',function(ev){__labPost((ev&&ev.message)||'脚本错误');});";
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<style>' + CASE.baseCss + '</style></head><body>' +
      '<div id="stage"></div>' +
      '<script src="' + d3Href() + '"><\/script>' +
      '<script>' + report +
      'try{\n' + state.code + '\n}catch(e){__labPost((e&&e.message)||String(e));}' +
      "try{parent.postMessage({source:'vis4-lab',type:'ready'},'*');}catch(e){}" +
      '<\/script></body></html>';
  }

  function frameDoc() {
    try { return els.frame.contentDocument || (els.frame.contentWindow && els.frame.contentWindow.document); }
    catch (e) { return null; }
  }

  function writeFrame() {
    var doc = frameDoc();
    if (!doc) { state.noDoc = true; return; }
    state.noDoc = false;
    try {
      doc.open();
      doc.write(buildDoc());
      doc.close();
    } catch (e) {
      state.noDoc = true;
    }
  }

  function fitFrame() {
    var d = device();
    var wrap = els.frameWrap;
    var avail = wrap ? wrap.clientWidth : d.width;
    var scale = avail > 0 ? Math.min(1, avail / d.width) : 1;
    var h = d.height;
    var doc = frameDoc();
    if (doc && doc.body) {
      var need = doc.body.scrollHeight + 6;
      if (need > h) h = Math.min(900, need);
    }
    els.frame.style.width = d.width + 'px';
    els.frame.style.height = h + 'px';
    els.frame.style.transformOrigin = 'top center';
    els.frame.style.transform = scale < 1 ? 'scale(' + scale + ')' : 'none';
    if (els.holder) { els.holder.style.height = Math.round(h * scale) + 'px'; els.holder.style.overflow = 'hidden'; }
  }

  /* =============== 运行 =============== */
  function runPreview() {
    window.__labError = null;
    state.results = null;
    state.slow = false;
    state.noDoc = false;
    hideError();
    writeFrame();
    fitFrame();
    var seq = ++runSeq;
    clearTimeout(timers.measure);
    clearTimeout(timers.slow);
    timers.measure = setTimeout(function () { if (seq === runSeq) doCheck(); }, MEASURE);
    timers.slow = setTimeout(function () { if (seq === runSeq) slowCheck(seq); }, SLOW_MS);
  }

  function slowCheck(seq) {
    if (seq !== runSeq) return;
    if (window.__labError) return;                   // 已有报错，别用超时提示盖掉它
    var doc = frameDoc();
    var has = doc && doc.querySelector('svg');
    if (!has) showError(t('slow'));
  }

  function hideError() {
    if (!els.error) return;
    els.error.hidden = true;
    els.error.textContent = '';
  }

  function showError(msg) {
    if (!els.error) return;
    els.error.textContent = msg;
    els.error.hidden = false;
  }

  /* =============== 判定（读 iframe 真实 DOM） =============== */
  function doCheck() {
    var s = CASE.steps[state.step];
    var doc = frameDoc();
    if (!doc || state.noDoc) {
      state.results = {
        summary: t('checkNoDoc'),
        items: [],
      };
      renderChecks();
      return;
    }
    var prevTransform = els.frame.style.transform;
    els.frame.style.transform = 'none';              // 关掉预览缩放，让像素量度回到 1:1
    var items;
    try {
      items = s.checks.map(function (c) { return evalCheck(c, doc); });
    } finally {
      els.frame.style.transform = prevTransform;
    }

    var bad = items.filter(function (it) { return !it.ok; }).length;
    var err = window.__labError;
    if (err) showError(t('runError', { msg: err })); else hideError();

    state.results = {
      summary: bad === 0 ? t('checkOk') : t('checkNo', { n: bad }),
      items: items,
    };
    renderChecks();

    if (bad === 0) {
      if (!state.passed[s.id]) {
        state.passed[s.id] = true;
        saveProgress();
        renderSteps();
        renderProgress();
        var allDone = CASE.steps.every(function (x) { return state.passed[x.id]; });
        showNotice(allDone ? t('allPassed') : t('checkOk'));
      }
    } else if (err) {
      showNotice(t('runError', { msg: err }));
    }
  }

  function evalCheck(chk, doc) {
    var base = { ok: false, label: chk.label || chk.type, hint: chk.hint || '', detail: '' };
    try {
      switch (chk.type) {
        case 'noError': {
          var msg = window.__labError;
          if (!msg) return ok(base);
          base.ok = false;
          base.detail = t('runError', { msg: msg });
          return base;
        }
        case 'svgCount': {
          var nSvg = doc.querySelectorAll('svg').length;
          return pass(base, nSvg >= (chk.n || 1), '当前 ' + nSvg + ' 个');
        }
        case 'exists': {
          var one = q(doc, chk.selector);
          return pass(base, !!one, one ? '' : '没找到 ' + chk.selector);
        }
        case 'count': {
          var list = qa(doc, chk.selector);
          var c = list.length;
          var good = true;
          if (typeof chk.eq === 'number') good = c === chk.eq;
          else if (typeof chk.min === 'number' && c < chk.min) good = false;
          else if (typeof chk.max === 'number' && c > chk.max) good = false;
          return pass(base, good, '当前 ' + c + ' 个');
        }
        case 'attr': {
          var elA = q(doc, chk.selector);
          if (!elA) return pass(base, false, '没找到 ' + chk.selector);
          var v = attrOf(elA, chk.prop);
          return pass(base, compare(v, chk), '当前 ' + chk.prop + ' = ' + fmt(v));
        }
        case 'bbox': {
          var elB = q(doc, chk.selector);
          if (!elB) return pass(base, false, '没找到 ' + chk.selector);
          var bb = bboxOf(elB);
          var dim = chk.dim === 'height' ? bb.height : bb.width;
          var okB = true;
          if (typeof chk.min === 'number' && dim < chk.min - 0.5) okB = false;
          if (typeof chk.max === 'number' && dim > chk.max + 0.5) okB = false;
          return pass(base, okB, dim + '' === 'NaN' ? '' : chk.dim + ' ≈ ' + Math.round(dim) + 'px');
        }
        case 'order': {
          var seq = qa(doc, chk.selector);
          if (seq.length < 2) return pass(base, false, '命中元素不足 2 个');
          var key = chk.by || 'x';
          var sign = chk.dir === 'desc' ? -1 : 1;
          var prev = null;
          var badAt = -1;
          for (var i = 0; i < seq.length; i++) {
            var b = bboxOf(seq[i]);
            var val = key === 'width' ? b.width : key === 'height' ? b.height : key === 'y' ? b.y : b.x;
            if (prev !== null) {
              var delta = sign === 1 ? val - prev : prev - val;
              if (delta < -1) { badAt = i; break; }
            }
            prev = val;
          }
          return pass(base, badAt === -1, badAt === -1 ? '' : '第 ' + (badAt + 1) + ' 个不满足' + (sign === 1 ? '递增' : '递减'));
        }
        case 'style': {
          var elS = q(doc, chk.selector);
          if (!elS) return pass(base, false, '没找到 ' + chk.selector);
          var sv = styleOf(elS, chk.prop);
          var okS;
          if (chk.mode === 'set') okS = !!(sv && sv !== 'none' && sv !== 'transparent' && sv !== 'rgba(0, 0, 0, 0)');
          else okS = compare(sv, chk);
          return pass(base, okS, '当前 ' + chk.prop + ' = ' + fmt(sv));
        }
        case 'text': {
          var elT = qa(doc, chk.selector);
          if (!elT.length) return pass(base, false, '没找到 ' + chk.selector);
          var all = elT.map(function (e) { return e.textContent || ''; }).join(' ');
          var wants = chk.contains || [];
          var miss = wants.filter(function (w) { return all.indexOf(w) < 0; });
          return pass(base, miss.length === 0, miss.length ? '缺少：' + miss.join('、') : '');
        }
        case 'vary': {
          var elV = qa(doc, chk.selector);
          if (!elV.length) return pass(base, false, '没找到 ' + chk.selector);
          var set = {};
          elV.forEach(function (e) { set[styleOf(e, chk.prop)] = 1; });
          var kinds = Object.keys(set).length;
          return pass(base, kinds >= (chk.min || 2), '当前有 ' + kinds + ' 种取值');
        }
        case 'any': {
          var subs = (chk.checks || []).map(function (c) { return evalCheck(c, doc); });
          var anyOk = subs.some(function (x) { return x.ok; });
          return pass(base, anyOk, anyOk ? '' : subs.map(function (x, i) { return '选项' + (i + 1) + '：' + (x.detail || '未通过'); }).join('；'));
        }
        case 'atWidth': {
          var w = chk.width || 375;
          var prevW = els.frame.style.width;
          els.frame.style.transform = 'none';
          els.frame.style.width = w + 'px';
          var subs2;
          try { subs2 = (chk.checks || []).map(function (c) { return evalCheck(c, doc); }); }
          finally { els.frame.style.width = prevW; els.frame.style.transform = 'none'; }
          var allOk = subs2.every(function (x) { return x.ok; });
          return pass(base, allOk, '在 ' + w + 'px 下：' + (allOk ? '通过' : subs2.map(function (x) { return x.detail; }).join('；')));
        }
        default:
          return pass(base, false, '未知检查类型 ' + chk.type);
      }
    } catch (e) {
      base.ok = false;
      base.detail = t('checkErr', { msg: (e && e.message) || String(e) });
      return base;
    }
  }

  function ok(base) { base.ok = true; return base; }
  function pass(base, cond, detail) {
    base.ok = !!cond;
    base.detail = detail || '';
    return base;
  }

  function q(doc, sel) {
    if (!sel) return null;
    try { return doc.querySelector(sel); } catch (e) { return null; }
  }

  function qa(doc, sel) {
    if (!sel) return [];
    try { return Array.prototype.slice.call(doc.querySelectorAll(sel)); } catch (e) { return []; }
  }

  function attrOf(el, prop) {
    if (!el) return null;
    var v = null;
    try { v = el.getAttribute(prop); } catch (e) { v = null; }
    if (v === null) {
      try { if (el[prop] !== undefined && typeof el[prop] !== 'function') v = String(el[prop]); } catch (e) { /* 忽略 */ }
    }
    return v;
  }

  function styleOf(el, prop) {
    try { return window.getComputedStyle(el).getPropertyValue(prop).trim(); }
    catch (e) { return ''; }
  }

  function bboxOf(el) {
    var tag = (el.tagName || '').toLowerCase();
    if (el.namespaceURI === 'http://www.w3.org/2000/svg' && tag !== 'svg' && typeof el.getBBox === 'function') {
      try {
        var b = el.getBBox();
        if (b && (b.width || b.height || b.x || b.y)) return { x: b.x, y: b.y, width: b.width, height: b.height };
      } catch (e) { /* 落到 getBoundingClientRect */ }
    }
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  function numOf(v) {
    var n = parseFloat(String(v));
    return isNaN(n) ? null : n;
  }

  function compare(raw, chk) {
    if (raw === null || raw === undefined) return false;
    var s = String(raw).trim();
    if (chk.mode === 'contains') return s.indexOf(String(chk.value)) >= 0;
    if (chk.mode === 'eq') {
      if (chk.value === undefined) return false;
      var a = numOf(s), b = numOf(chk.value);
      if (a !== null && b !== null) return Math.abs(a - b) < 1e-6;
      return s === String(chk.value).trim();
    }
    var n = numOf(s);
    if (n === null) return false;
    if (typeof chk.min === 'number' && n < chk.min) return false;
    if (typeof chk.max === 'number' && n > chk.max) return false;
    if (typeof chk.value === 'number' && Math.abs(n - chk.value) > 1e-6) return false;
    return true;
  }

  function fmt(v) {
    if (v === null || v === undefined || v === '') return '（空）';
    return String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v);
  }

  /* =============== 消息（iframe → 主页面） =============== */
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'vis4-lab') return;
    if (d.type === 'error' && d.message) {
      window.__labError = d.message;
    }
  });

  /* =============== 通知 =============== */
  function showNotice(msg) {
    if (!els.notice) return;
    els.notice.textContent = msg;
    els.notice.hidden = false;
  }

  /* =============== 编辑器 =============== */
  function setCode(code, focusAnchor) {
    state.code = code;
    els.code.value = code;
    saveCode();
    if (focusAnchor) focusIn(focusAnchor);
    runPreview();
  }

  function focusIn(anchor) {
    var text = els.code.value;
    var at = text.indexOf(anchor);
    if (at < 0) at = text.length;               // 找不到就退化到文末，不报错
    try {
      els.code.focus();
      els.code.setSelectionRange(at, at);
    } catch (e) { /* 忽略 */ }
  }

  function addAsset(i) {
    var a = CASE.assets && CASE.assets[i];
    if (!a) return;
    var el = els.code;
    var start = el.selectionStart;
    var end = el.selectionEnd;
    var before = state.code.slice(0, start);
    var after = state.code.slice(end);
    var pad = before && !/\n$/.test(before) ? '\n' : '';
    var next = before + pad + a.value + '\n' + after;
    var caret = (before + pad + a.value).length;
    state.code = next;
    el.value = next;
    saveCode();
    try { el.focus(); el.setSelectionRange(caret, caret); } catch (e) { /* 忽略 */ }
    runPreview();
  }

  /* =============== 环节切换 =============== */
  function gotoStep(n, focusAnchor) {
    if (n < 0 || n >= CASE.steps.length) return;
    var curId = CASE.steps[state.step].id;
    state.stepCode[curId] = state.code;
    state.step = n;
    state.results = null;
    state.hintLevel[CASE.steps[n].id] = state.hintLevel[CASE.steps[n].id] || 0;
    state.code = codeOf(n);
    els.code.value = state.code;
    state.confirm = null;
    saveProgress();
    saveCode();
    renderSteps();
    renderProgress();
    renderTask();
    renderActions();
    renderWorks();
    renderChecks();
    if (focusAnchor) focusIn(CASE.steps[n].focus && CASE.steps[n].focus.js);
    runPreview();
    if (els.task) els.task.scrollIntoView({ block: 'start' });
  }

  function useHint() {
    var s = CASE.steps[state.step];
    var total = (s.hints || []).length;
    var cur = state.hintLevel[s.id] || 0;
    if (cur < total) state.hintLevel[s.id] = cur + 1;
    saveProgress();
    renderTask();
  }

  /* =============== 导出 SVG / 复制代码 =============== */
  function exportSvg() {
    var doc = frameDoc();
    var svg = doc && doc.querySelector('svg');
    if (!svg) { showError(t('exportNone')); return; }
    try {
      var clone = svg.cloneNode(true);
      if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      var src = new XMLSerializer().serializeToString(clone);
      var name = 'chart-' + stamp() + '.svg';
      var blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + src], { type: 'image/svg+xml' });
      var url = (window.URL || window.webkitURL).createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { (window.URL || window.webkitURL).revokeObjectURL(url); } catch (e) { /* 忽略 */ } }, 4000);
      showNotice(t('exportDone', { name: name }));
    } catch (e) {
      showError(t('exportFail', { msg: (e && e.message) || String(e) }));
    }
  }

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function copyCode() {
    var code = state.code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        function () { showNotice(t('copied')); },
        function () { fallbackCopy(code); }
      );
      return;
    }
    fallbackCopy(code);
  }

  function fallbackCopy(code) {
    try {
      var ta = document.createElement('textarea');
      ta.value = code;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showNotice(t('copied'));
    } catch (e) {
      showError(t('copyFail'));
    }
  }

  /* =============== 两步确认 =============== */
  function askConfirm(key, text, act) {
    if (state.confirm && state.confirm.key === key) {
      state.confirm = null;
      act();
      renderActions();
      return;
    }
    state.confirm = { key: key, text: text };
    renderActions();
  }

  function confirmAct(name) {
    var s = CASE.steps[state.step];
    if (name === 'solution') {
      askConfirm('solution', t('solutionConfirm'), function () {
        state.used[s.id] = true;
        saveProgress();
        setCode(s.solution.js, null);
        renderWorks();
      });
    } else if (name === 'reset') {
      askConfirm('reset', t('resetConfirm'), function () {
        delete state.stepCode[s.id];
        setCode(starterOf(state.step), s.focus && s.focus.js);
        renderWorks();
      });
    } else if (name === 'restart') {
      askConfirm('restart', t('restartConfirm'), function () {
        dropStore(KEY_PROGRESS);
        dropStore(KEY_CODE);
        state.passed = {};
        state.hintLevel = {};
        state.used = {};
        state.stepCode = {};
        state.step = 0;
        state.code = starterOf(0);
        els.code.value = state.code;
        renderSteps();
        renderProgress();
        renderTask();
        renderActions();
        renderWorks();
        renderChecks();
        runPreview();
      });
    }
  }

  /* =============== 事件绑定 =============== */
  function bind() {
    if (els.code) {
      els.code.addEventListener('input', function () {
        state.code = els.code.value;
        saveCode();
        clearTimeout(timers.input);
        timers.input = setTimeout(function () { runPreview(); }, DEBOUNCE);
      });
      els.code.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Tab') return;
        ev.preventDefault();
        var el = els.code;
        var start = el.selectionStart, end = el.selectionEnd;
        var next = state.code.slice(0, start) + '  ' + state.code.slice(end);
        state.code = next;
        el.value = next;
        try { el.setSelectionRange(start + 2, start + 2); } catch (e) { /* 忽略 */ }
        saveCode();
      });
    }

    document.addEventListener('click', function (ev) {
      var el = ev.target;
      if (!el || !el.closest) return;

      var step = el.closest('[data-lab-step]');
      if (step) { gotoStep(parseInt(step.getAttribute('data-lab-step'), 10), true); return; }

      var asset = el.closest('[data-lab-asset]');
      if (asset) { addAsset(parseInt(asset.getAttribute('data-lab-asset'), 10)); return; }

      var work = el.closest('[data-lab-work]');
      if (work) {
        var wi = parseInt(work.getAttribute('data-lab-work'), 10);
        setCode(codeOf(wi), CASE.steps[wi].focus && CASE.steps[wi].focus.js);
        return;
      }

      var dev = el.closest('[data-lab-device]');
      if (dev) {
        state.device = dev.getAttribute('data-lab-device');
        renderDevices();
        fitFrame();
        return;
      }

      var act = el.closest('[data-lab-act]');
      if (!act) return;
      var name = act.getAttribute('data-lab-act');
      if (name === 'run') { runPreview(); }
      else if (name === 'check') { runPreview(); }
      else if (name === 'prev') { gotoStep(state.step - 1, true); }
      else if (name === 'next') { gotoStep(state.step + 1, true); }
      else if (name === 'hint') { useHint(); }
      else if (name === 'export') { exportSvg(); }
      else if (name === 'copy') { copyCode(); }
      else if (name === 'solution' || name === 'reset' || name === 'restart') { confirmAct(name); }
      else if (name === 'confirm') {
        var key = state.confirm && state.confirm.key;
        state.confirm = null;
        if (key) confirmAct(key);
      } else if (name === 'cancel') { state.confirm = null; renderActions(); }
    });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitFrame, 160);
    });
  }

  /* =============== 工具 =============== */
  function esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;');
  }

  /* =============== 启动 =============== */
  function init() {
    restore();
    renderBrief();
    renderSteps();
    renderProgress();
    renderTask();
    renderActions();
    renderDevices();
    renderWorks();
    renderChecks();
    bind();
    els.code.value = state.code;
    runPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
