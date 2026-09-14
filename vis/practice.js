// =========================================================
// practice.js —— 「实战环节」工作台引擎（中文版）
// ---------------------------------------------------------
// 依赖：practice-data.js（window.PRACTICE_CASE）+ styles.css 的 .lab-* 模块
//
// 刻意用「普通 script（IIFE）」而不是 ES Module，理由同 quiz.js：
//   这样 file:// 直接双击打开也能用（iframe srcdoc + Blob 都不需要服务器）。
//
// 五项职责：
//   ① 环节流转：起始代码 = 上一环节的参考答案，逐步累积成一个完整页面
//   ② 实时预览：沙箱 iframe 就地更新 CSS/HTML，支持 桌面/平板/手机 三档宽度
//   ③ 分层提示：文字提示逐级解锁 + 语法速查
//   ④ 检查点：在固定宽度下测量"真实渲染结果"（计算样式 + 几何），判定是否通过
//   ⑤ 存档：自动草稿 + 我的作品（localStorage）+ 导出成真正的 .html 文件
//
// ⚠️ 前端方案的固有限制：
//   · 浏览器没有 CSS 编译器，"实时编译"实为"实时渲染"；
//   · 无法批改代码质量，只能判定渲染结果是否满足检查点；
//   · 参考答案随静态文件下发（F12 可见），定位是"动手练习"而非考试。
// =========================================================
(function () {
  'use strict';

  var CASE = window.PRACTICE_CASE;
  var root = document.getElementById('lab-root');

  // 案例校验放到文案表之后（那样出错提示也能跟着语言走）
  var caseOk = !!(root && CASE && Array.isArray(CASE.steps) && CASE.steps.length);

  /* =======================================================
   * 一、配置
   * ===================================================== */
  /* -------------------------------------------------------
   * 界面文案（中英共用同一份引擎）
   *   · 默认值是中文；en/ 下由 en/practice-ui.js 提供 window.PRACTICE_UI 覆盖
   *   · 逻辑只写一份，中英不会各自漂移（与 quiz.js 同一思路）
   *   · {xxx} 是占位符，由 t() 替换
   * ----------------------------------------------------- */
  var T = {
    /* ---- 通用 ---- */
    docLang: 'zh-CN',
    chapterLabel: '第 {n} 章',
    trackDesign: '设计篇',
    trackImpl: '实现篇',
    trackCapstone: '实战篇',
    caseError: '案例数据加载失败：请确认 practice-data.js 已在 practice.js 之前引入。',

    /* ---- 预览宽度档位 ---- */
    deviceDesktop: '桌面 1180',
    deviceTablet: '平板 768',
    devicePhone: '手机 375',

    /* ---- 脚本提示 ---- */
    scriptPartTag: '{n} 个 <script>',
    scriptPartHandler: '{n} 处内联事件',
    scriptSep: '、',
    scriptNote: '⚠️ 已移除 {parts}：预览与导出的 .html 都不执行 JavaScript —— 本案例是纯 HTML/CSS 布局练习，课程不涉及脚本。',

    /* ---- 检查 ---- */
    checkUnavailable: '当前浏览器不允许读取预览文档，自动检查不可用。'
      + '请用本地服务器打开本页（python -m http.server 8080）后重试。',
    checkAllPass: '🎉 本环节 {n} 项检查全部通过，可以进入下一环节了。',
    checkSomeFail: '本环节还有 {n} 项没通过 —— 对照预览调一调，或点「💡 提示」。',
    checkEmptyIntro: '还没有检查过。写完这一段代码后，点下方的「✅ 检查这一环节」——'
      + '我会在 {width}px 宽度下测量真实的渲染结果（计算样式 + 元素位置），不比对代码文本，类名怎么写都行。',
    checkScore: '{pass} / {total} 项通过',
    checkFlagGood: '✓ 本环节完成',
    checkFlagBad: '✗ 还有 {n} 项要修',
    checkFootnote: '检查的是「效果」不是「写法」：只要浏览器真的渲染成这样就通过。'
      + '检查时会临时切到 {width}px 宽度，所以响应式也能被验到。',
    checkError: '检查出错',

    /* ---- 提示 / 参考答案 / 重置 ---- */
    btnHint: '💡 提示',
    hintLevelNote: '提示是分级的：再点一次解锁下一级',
    hintDone: '提示已全部展开。再卡住就点「查看参考答案」，先把这一关过了。',
    syntaxTitle: '🔤 语法速查（本环节会用到的属性）',
    btnSolution: '查看参考答案',
    btnSolutionConfirm: '⚠️ 确认填入参考答案',
    solutionConfirm: '这会用参考答案覆盖当前代码。再点一次「确认填入」执行。',
    solutionDone: '已填入参考答案 —— 建议对着它看一遍「为什么这么写」，再点检查。',
    btnReset: '重置本环节',
    btnResetConfirm: '⚠️ 确认重置本环节',
    resetConfirm: '这会把本环节恢复到起始代码（上一环节的成果）。再点一次「确认重置」执行。',
    resetDone: '已重置到本环节的起始代码。',
    stepSolutionFlag: '参考答案',
    btnRestart: '重新开始',
    btnRestartConfirm: '⚠️ 确认重来',
    restartConfirm: '这会清空当前进度（「我的作品」里已保存的不受影响）。再点一次「确认重来」执行。',
    restartDone: '已重新开始，加油。',

    /* ---- 环节流转 ---- */
    btnCheck: '✅ 检查这一环节',
    btnPrevStep: '← 上一环节',
    btnNextStep: '下一环节 →',
    btnFinishCase: '完成案例 🎉',
    btnSave: '💾 保存到我的作品',
    actionsState: '当前环节：{title} · 已完成 {done} / {total} 个环节',
    progressHead: '已通过 <b>{done}</b> / {total} 个环节',
    initStart: '从第 1 个环节开始：先看左栏的「案例要求」，再动手写。写不动就点「💡 提示」。',
    draftRestored: '已恢复上次的草稿（第 {step} 环节）· {time}',

    /* ---- 案例要求 ---- */
    briefGoal: '页面目标',
    briefAudience: '目标用户',
    briefSuccess: '成功标准',
    briefDeliverable: '最终交付',
    briefAssets: '📋 案例文案（点一下插入到编辑器）',
    briefLessonIntro: '配套章节：',
    briefLessonLink: '第 9 章 · 综合案例：作品集网站 →',
    insertDone: '已插入文案：{text}',

    /* ---- 我的作品 / 导出 ---- */
    btnWorks: '📁 我的作品',
    worksTitle: '📁 我的作品',
    btnCollapse: '收起',
    btnLoadWork: '载入继续',
    btnDeleteWork: '删除',
    worksItemDetail: '进度 {step}/{total} · 通过 {passed} 个环节 · 用时 {minutes} 分',
    worksItemSolution: ' · 参考过 {n} 次答案',
    worksEmpty: '还没有保存过作品。完成几个环节后点「💾 保存到我的作品」，'
      + '这里就会出现记录（只存在本机浏览器）。',
    worksNote: '最多保留最近 {max} 份；「导出 .html」会把当前代码打包成一个可以双击打开的完整网页。',
    workSaved: '已保存到「我的作品」（最多保留最近 {max} 份）。',
    workSaveFail: '保存失败：浏览器存储空间不足，或处于隐私模式。建议改用「导出 .html」。',
    workLoaded: '已载入 {time} 的作品继续编辑。',
    workDeleted: '已删除该作品。',
    btnExport: '⬇️ 导出 .html',
    exportPrefix: 'portfolio-',
    exportDone: '已导出 {name} —— 用浏览器双击打开即可，就是右侧预览的那份页面。',

    /* ---- 判定「好消息」的关键词（与语言无关的写法：改成数组匹配） ---- */
    goodWords: ['通过', '已保存', '已导出', '已恢复', '已载入', '已插入', '已重新开始'],
  };

  var UI = (window.PRACTICE_UI && typeof window.PRACTICE_UI === 'object') ? window.PRACTICE_UI : {};

  // 取词：优先用覆盖表，其次默认表；漏译时直接暴露 key，方便自检脚本发现
  function t(key, vars) {
    var s = (UI[key] !== undefined && UI[key] !== null) ? UI[key] : T[key];
    if (s === undefined) s = '[' + key + ']';
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(vars[k]);
      });
    }
    return s;
  }

  // 提示条是不是「好消息」：按关键词数组判断，不靠中文正则（这样换语言也成立）
  function isGoodNotice(text) {
    var words = (UI.goodWords && UI.goodWords.length) ? UI.goodWords : (T.goodWords || []);
    var s = String(text || '');
    for (var i = 0; i < words.length; i++) {
      if (s.indexOf(words[i]) >= 0) return true;
    }
    return false;
  }

  if (!caseOk) {
    if (root) root.innerHTML = '<p class="lab-empty">' + esc(t('caseError')) + '</p>';
    return;
  }

  // 预览宽度档位：iframe 用真实宽度布局，外层再等比缩放塞进面板
  // 这样媒体查询、vw/vh、position: fixed 都会按这个宽度真实生效
  var DEVICES = [
    { key: 'desktop', labelKey: 'deviceDesktop', width: 1180 },
    { key: 'tablet', labelKey: 'deviceTablet', width: 768 },
    { key: 'phone', labelKey: 'devicePhone', width: 375 },
  ];
  var CHECK_WIDTH = 1180;      // 运行检查点时固定使用的宽度（与预览档位无关）
  var PREVIEW_MIN_H = 560;     // 预览画布最小高度
  var KEY_DRAFT = 'layout-course-practice-draft';
  var KEY_WORKS = 'layout-course-practice-works';
  var WORKS_MAX = 10;

  /* =======================================================
   * 二、DOM 引用
   *    编辑器 textarea 与预览 iframe 是"静态 DOM"：
   *    render() 永远不重建它们，避免光标丢失与 iframe 重新加载
   * ===================================================== */
  function $(id) { return document.getElementById(id); }

  var el = {
    brief: $('lab-brief'),
    steps: $('lab-steps'),
    progress: $('lab-progress'),
    task: $('lab-task'),
    checks: $('lab-checks'),
    actions: $('lab-actions'),
    works: $('lab-works'),
    notice: $('lab-notice'),
    html: $('lab-html'),
    css: $('lab-css'),
    frame: $('lab-frame'),
    frameWrap: $('lab-frame-wrap'),
    frameHolder: $('lab-frame-holder'),
    scriptNote: $('lab-script-note'),
    devices: $('lab-devices'),
  };

  /* =======================================================
   * 三、通用工具
   * ===================================================== */
  function esc(text) {
    return String(text).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return (v === null || v === undefined) ? fallback : v;
    } catch (e) { return fallback; }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }        // 隐私模式 / 配额满：安静降级
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function num(value) {
    var n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }

  function camel(prop) {
    return String(prop).replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
  }

  function nowLabel(ts) {
    function p(n) { return n < 10 ? '0' + n : String(n); }
    var d = new Date(ts);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function deviceWidth() {
    for (var i = 0; i < DEVICES.length; i++) {
      if (DEVICES[i].key === state.device) return DEVICES[i].width;
    }
    return DEVICES[0].width;
  }

  /* =======================================================
   * 四、环节代码流
   *    起始代码 = 上一环节的参考答案（第 1 个环节用案例的 startCode）
   *    solution.html 留空 = 沿用上一环节的 HTML（只重构 CSS 的环节）
   * ===================================================== */
  function solutionOf(i) {
    var step = CASE.steps[i];
    var html = step.solution.html;
    if (!html) {
      html = i > 0 ? solutionOf(i - 1).html : (CASE.startCode ? CASE.startCode.html : '');
    }
    return { html: html, css: step.solution.css };
  }

  function starterOf(i) {
    if (i === 0) {
      return {
        html: (CASE.startCode && CASE.startCode.html) || '',
        css: (CASE.startCode && CASE.startCode.css) || '',
      };
    }
    return solutionOf(i - 1);
  }

  /* =======================================================
   * 五、状态
   * ===================================================== */
  var state = {
    step: 0,
    code: { html: '', css: '' },   // 当前编辑器的内容（累积）
    stepCode: {},                  // stepId -> 该环节离开时的代码快照
    passed: {},                    // stepId -> true（检查点全部通过）
    solutionUsed: {},              // stepId -> true（看过参考答案）
    hintLevel: {},                 // stepId -> 已解锁的提示级数
    results: null,                 // { stepId, items: [] }
    device: 'desktop',
    showWorks: false,
    confirm: '',                   // '' | 'solution' | 'reset'（两步确认）
    notice: '',
    startedAt: Date.now(),
  };

  /* =======================================================
   * 六、输入净化
   *    预览文档用了 sandbox="allow-same-origin"（没有 allow-scripts），
   *    脚本本来就不会执行；这里再剥一层，属于纵深防御。
   *
   *    为什么刻意不给 allow-scripts？
   *      · allow-scripts + allow-same-origin 是已知的沙箱逃逸组合
   *        （iframe 内的脚本能把自己重新加载成非沙箱文档）；
   *      · 而「检查点」必须同源读取 iframe 文档（getComputedStyle /
   *        getBoundingClientRect），所以 allow-same-origin 不能去掉；
   *      · 本案例是纯 HTML/CSS 布局练习，脚本不在课程范围内。
   *    代价：学生在预览里写 JS 不会运行 —— 所以下面会把
   *    「被剥掉了多少脚本」明确显示出来，而不是静默失败。
   * ===================================================== */
  var stripInfo = { scripts: 0, handlers: 0 };

  function cleanHtml(src) {
    stripInfo.scripts = 0;
    stripInfo.handlers = 0;

    var doc;
    try {
      doc = new DOMParser().parseFromString(String(src || ''), 'text/html');
    } catch (e) {
      return '';
    }

    // 先统计脚本数量（用于给学生明确反馈），再移除
    stripInfo.scripts = doc.querySelectorAll('script').length;

    // 危险标签直接删掉（link/meta/base 也删：案例不依赖任何外部资源）
    var kill = doc.querySelectorAll('script, iframe, object, embed, link, meta, base, style');
    for (var i = 0; i < kill.length; i++) kill[i].parentNode.removeChild(kill[i]);

    var all = doc.body.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      var attrs = all[j].attributes;
      for (var k = attrs.length - 1; k >= 0; k--) {
        var name = attrs[k].name.toLowerCase();
        var value = String(attrs[k].value);
        if (/^on/.test(name) || name === 'srcdoc' || /javascript:/i.test(value)) {
          all[j].removeAttribute(attrs[k].name);
          stripInfo.handlers++;
        }
      }
    }
    return doc.body.innerHTML;
  }

  // 把「脚本被移除」这件事讲明白，而不是让学生对着没反应的预览发懵
  function renderScriptNote() {
    if (!el.scriptNote) return;
    var parts = [];
    if (stripInfo.scripts) parts.push(t('scriptPartTag', { n: stripInfo.scripts }));
    if (stripInfo.handlers) parts.push(t('scriptPartHandler', { n: stripInfo.handlers }));

    el.scriptNote.hidden = parts.length === 0;
    el.scriptNote.textContent = parts.length
      ? t('scriptNote', { parts: parts.join(t('scriptSep')) })
      : '';
  }

  // 学生若把 CSS 整段包在 <style> 里，这里自动剥壳
  function cleanCss(src) {
    var css = String(src || '');
    var m = css.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    return m ? m[1] : css;
  }

  function buildDoc() {
    return '<!DOCTYPE html><html lang="' + t('docLang') + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>' + CASE.baseCss + '</style>' +
      '<style id="lab-user-css">' + cleanCss(state.code.css) + '</style>' +
      '</head><body id="lab-preview-body">' + cleanHtml(state.code.html) + '</body></html>';
  }

  var SHELL = '<!DOCTYPE html><html lang="' + t('docLang') + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' + CASE.baseCss + '</style>' +
    '<style id="lab-user-css"></style>' +
    '</head><body id="lab-preview-body"></body></html>';

  var frameReady = false;
  var canMeasure = false;    // 能否访问 iframe 内部文档（决定"自动检查"可不可用）
  var pendingFallback = false;

  function initFrame() {
    el.frame.addEventListener('load', onFrameLoad);
    el.frame.setAttribute('sandbox', 'allow-same-origin');   // 无 allow-scripts：脚本不执行，但同源可读
    el.frame.srcdoc = SHELL;
  }

  function onFrameLoad() {
    frameReady = true;
    try {
      canMeasure = !!(el.frame.contentDocument &&
        el.frame.contentDocument.getElementById('lab-preview-body'));
    } catch (e) {
      canMeasure = false;      // 浏览器拒绝同源访问 → 降级为"只预览、不检查"
    }
    if (pendingFallback) { pendingFallback = false; fitFrame(); return; }
    updatePreview();
  }

  function updatePreview() {
    if (!frameReady) return;

    if (!canMeasure) {
      // 降级路径：整份文档重新灌进 srcdoc（预览仍然可用，只是不能自动检查）
      pendingFallback = true;
      el.frame.srcdoc = buildDoc();
      renderScriptNote();
      return;
    }

    var doc = el.frame.contentDocument;
    var styleTag = doc.getElementById('lab-user-css');
    var body = doc.getElementById('lab-preview-body');
    if (!styleTag || !body) {
      pendingFallback = true;
      el.frame.srcdoc = buildDoc();
      renderScriptNote();
      return;
    }

    // 就地更新：不重载文档 → 不闪屏、预览区滚动位置也保得住
    styleTag.textContent = cleanCss(state.code.css);
    body.innerHTML = cleanHtml(state.code.html);
    renderScriptNote();
    fitFrame();
  }

  // 预览画布：iframe 用"真实宽度"布局，外层 holder 按比例缩小显示
  function fitFrame() {
    if (!frameReady) return;
    var w = deviceWidth();
    var avail = el.frameWrap.clientWidth || w;
    var scale = Math.min(1, avail / w);
    var h = PREVIEW_MIN_H;

    try {
      var doc = el.frame.contentDocument;
      if (doc) h = Math.max(PREVIEW_MIN_H, doc.documentElement.scrollHeight);
    } catch (e) { /* 忽略：用默认高度 */ }

    el.frame.style.width = w + 'px';
    el.frame.style.height = h + 'px';
    el.frame.style.transform = scale === 1 ? 'none' : 'scale(' + scale + ')';
    el.frameHolder.style.width = Math.round(w * scale) + 'px';
    el.frameHolder.style.height = Math.round(h * scale) + 'px';
  }

  // 在指定宽度下临时测量（检查点专用），测完恢复原样
  function withWidth(width, fn) {
    if (!canMeasure) return null;
    var f = el.frame;
    var holder = el.frameHolder;
    var prev = {
      w: f.style.width, h: f.style.height, t: f.style.transform,
      hw: holder.style.width, hh: holder.style.height,
    };
    var avail = el.frameWrap.clientWidth || width;
    var scale = Math.min(1, avail / width);

    f.style.width = width + 'px';
    f.style.height = '1600px';
    f.style.transform = scale === 1 ? 'none' : 'scale(' + scale + ')';
    holder.style.width = Math.round(width * scale) + 'px';
    holder.style.height = '1200px';

    var out = null;
    try {
      var doc = f.contentDocument;
      if (doc) void doc.documentElement.offsetHeight;   // 强制回流，让媒体查询按新宽度生效
      out = fn(doc, f.contentWindow);
    } finally {
      f.style.width = prev.w;
      f.style.height = prev.h;
      f.style.transform = prev.t;
      holder.style.width = prev.hw;
      holder.style.height = prev.hh;
    }
    return out;
  }

  /* =======================================================
   * 七、检查点判定
   *    全部基于"最终渲染结果"：计算样式 + 几何位置
   *    不比对代码文本 —— 学生怎么写、类名取什么，只要效果达标就算过
   * ===================================================== */
  function evalCheck(c, doc, win) {
    if (c.type === 'atWidth') {
      var sub = withWidth(c.width, function (d, w) {
        if (!d) return false;
        return c.checks.every(function (one) { return evalCheck(one, d, w); });
      });
      return !!sub;
    }
    if (!doc) return false;

    if (c.type === 'cssVar') {
      var value = win.getComputedStyle(doc.documentElement).getPropertyValue(c.name);
      return String(value).trim() === c.expect;
    }
    if (c.type === 'count') {
      return doc.querySelectorAll(c.selector).length >= (c.min || 1);
    }
    if (c.type === 'sameRow') {
      var nodes = [].slice.call(doc.querySelectorAll(c.selector));
      var want = c.min || 2;
      if (nodes.length < want) return false;
      var rows = [];
      nodes.forEach(function (n) {
        var top = Math.round(n.getBoundingClientRect().top);
        var found = null;
        for (var i = 0; i < rows.length; i++) {
          if (Math.abs(rows[i].top - top) <= 2) { found = rows[i]; break; }
        }
        if (!found) { found = { top: top, count: 0 }; rows.push(found); }
        found.count++;
      });
      return rows.some(function (r) { return r.count >= want; });
    }
    if (c.type === 'order') {
      var els = c.selectors.map(function (sel) { return doc.querySelector(sel); });
      if (els.indexOf(null) >= 0) return false;
      for (var i = 1; i < els.length; i++) {
        var prev = els[i - 1].getBoundingClientRect();
        var cur = els[i].getBoundingClientRect();
        if (cur.top + 1 < prev.bottom - 1) return false;   // 顺序颠倒
      }
      return true;
    }

    var node = doc.querySelector(c.selector);
    if (!node) return false;
    if (c.type === 'exists') return true;

    var cs = win.getComputedStyle(node);
    var val = cs[camel(c.prop)];

    if (c.type === 'style') return String(val) === c.expect;
    if (c.type === 'styleMin') return num(val) >= c.min;
    if (c.type === 'styleMax') return num(val) <= c.max;
    if (c.type === 'weightMin') return parseInt(cs.fontWeight, 10) >= c.min;

    if (c.type === 'bgSet') {
      var bg = String(cs.backgroundColor || '');
      return bg !== '' && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
    }
    if (c.type === 'columns') {
      var tracks = String(cs.gridTemplateColumns || '').split(/\s+/).filter(Boolean).length;
      if (!tracks) return false;
      if (c.min !== undefined && tracks < c.min) return false;
      if (c.max !== undefined && tracks > c.max) return false;
      return true;
    }
    if (c.type === 'colsCompare') {
      var t = String(cs.gridTemplateColumns || '').split(/\s+/).filter(Boolean);
      if (t.length < 2) return false;
      var a = num(t[0]);
      var b = num(t[1]);
      return c.expect === 'firstGreater' ? a > b + 1 : b > a + 1;
    }
    if (c.type === 'ratio') {
      var box = node.getBoundingClientRect();
      if (!box.height) return false;
      return Math.abs((box.width / box.height) - c.expect) <= (c.tolerance || 0.25);
    }
    if (c.type === 'centered') {
      var r = node.getBoundingClientRect();
      var docWidth = doc.documentElement.clientWidth;
      return Math.abs(r.left - (docWidth - r.right)) <= 4;
    }
    return false;
  }

  function runChecks() {
    var step = CASE.steps[state.step];

    if (!canMeasure) {
      state.results = null;
      state.notice = t('checkUnavailable');
      render();
      return;
    }

    var items = withWidth(CHECK_WIDTH, function (doc, win) {
      return step.checks.map(function (c) {
        var ok = false;
        var err = '';
        try { ok = !!evalCheck(c, doc, win); }
        catch (e) { err = e.message || t('checkError'); }
        return { label: c.label, ok: ok, err: err };
      });
    }) || [];

    var failed = items.filter(function (it) { return !it.ok; }).length;
    state.results = { stepId: step.id, items: items };
    state.passed[step.id] = failed === 0;
    state.notice = failed === 0
      ? t('checkAllPass', { n: items.length })
      : t('checkSomeFail', { n: failed });
    fitFrame();
    render();
  }

  /* =======================================================
   * 八、动作：环节流转 / 提示 / 参考答案 / 重置
   * ===================================================== */
  var lastEditor = null;   // 最近获得焦点的编辑器（"一键插入文案"插到这里）

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // 把当前代码记到当前环节名下（用于"我的作品"里回看每一步）
  function snapshot() {
    var step = CASE.steps[state.step];
    state.stepCode[step.id] = { html: state.code.html, css: state.code.css };
  }

  function passedCount() {
    return CASE.steps.filter(function (s) { return state.passed[s.id]; }).length;
  }

  function setEditors() {
    el.html.value = state.code.html;
    el.css.value = state.code.css;
  }

  // 把光标送到"本环节该改的地方"：优先 HTML 锚点，其次 CSS 锚点，都找不到就退到末尾
  function focusForStep(i, withFocus) {
    var focus = CASE.steps[i].focus || {};
    var target = null;

    if (focus.html && el.html.value.indexOf(focus.html) >= 0) {
      target = { ta: el.html, anchor: focus.html };
    } else if (focus.css && el.css.value.indexOf(focus.css) >= 0) {
      target = { ta: el.css, anchor: focus.css };
    }

    var ta = target ? target.ta : el.css;
    // 光标停在锚点之后（不选中）：既把编辑位置指出来，
    // 又不会让「插入文案」把锚点整段覆盖掉
    var pos = target ? (ta.value.indexOf(target.anchor) + target.anchor.length) : ta.value.length;
    if (pos < 0 || pos > ta.value.length) pos = ta.value.length;

    try { ta.setSelectionRange(pos, pos); } catch (e) { /* 忽略 */ }

    // 把目标行滚到可视区（不抢焦点，避免一进页面就跳）
    var line = ta.value.slice(0, pos).split('\n').length - 1;
    var lh = parseFloat(getComputedStyle(ta).lineHeight) || 21;
    ta.scrollTop = Math.max(0, line * lh - ta.clientHeight / 3);

    if (withFocus) ta.focus();
  }

  function gotoStep(i, withFocus) {
    if (i < 0 || i >= CASE.steps.length) return;
    snapshot();
    state.step = i;
    state.confirm = '';
    state.results = null;
    state.notice = '';
    focusForStep(i, withFocus !== false);
    saveDraftSoon();
    render();
  }

  function revealHint() {
    var step = CASE.steps[state.step];
    var level = state.hintLevel[step.id] || 0;
    if (level >= step.hints.length) {
      state.notice = t('hintDone');
    } else {
      state.hintLevel[step.id] = level + 1;
      state.notice = '';
    }
    saveDraftSoon();
    render();
  }

  // 参考答案 / 重置：都要"再点一次确认"，避免一键抹掉学生写的代码
  function applySolution() {
    var step = CASE.steps[state.step];
    if (state.confirm !== 'solution') {
      state.confirm = 'solution';
      state.notice = t('solutionConfirm');
      render();
      return;
    }
    var sol = solutionOf(state.step);
    state.code.html = sol.html;
    state.code.css = sol.css;
    setEditors();
    state.solutionUsed[step.id] = true;
    state.confirm = '';
    state.results = null;
    state.notice = t('solutionDone');
    updatePreview();
    saveDraft();
    render();
  }

  function resetStep() {
    if (state.confirm !== 'reset') {
      state.confirm = 'reset';
      state.notice = t('resetConfirm');
      render();
      return;
    }
    var start = starterOf(state.step);
    state.code.html = start.html;
    state.code.css = start.css;
    setEditors();
    state.confirm = '';
    state.results = null;
    state.notice = t('resetDone');
    updatePreview();
    saveDraft();
    render();
  }

  function restartAll() {
    if (state.confirm !== 'restart') {
      state.confirm = 'restart';
      state.notice = t('restartConfirm');
      render();
      return;
    }
    removeStore(KEY_DRAFT);
    state.step = 0;
    state.code = {
      html: (CASE.startCode && CASE.startCode.html) || '',
      css: (CASE.startCode && CASE.startCode.css) || '',
    };
    state.stepCode = {};
    state.passed = {};
    state.solutionUsed = {};
    state.hintLevel = {};
    state.results = null;
    state.confirm = '';
    state.startedAt = Date.now();
    setEditors();
    focusForStep(0, false);
    state.notice = t('restartDone');
    updatePreview();
    render();
  }

  function insertAsset(text) {
    var ta = lastEditor || el.html;
    var active = document.activeElement === ta;
    var start = active ? (ta.selectionStart || 0) : ta.value.length;
    var end = active ? (ta.selectionEnd || 0) : ta.value.length;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    var pos = start + text.length;
    if (ta === el.html) state.code.html = ta.value; else state.code.css = ta.value;
    ta.focus();
    try { ta.setSelectionRange(pos, pos); } catch (e) { /* 忽略 */ }
    state.notice = t('insertDone', { text: text });
    updatePreview();
    saveDraftSoon();
    render();
  }

  /* =======================================================
   * 九、存档：草稿（自动）/ 我的作品（手动）/ 导出 .html
   * ===================================================== */
  function removeStore(key) {
    try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
  }

  function saveDraft() {
    writeStore(KEY_DRAFT, {
      caseId: CASE.id,
      at: Date.now(),
      step: state.step,
      code: state.code,
      stepCode: state.stepCode,
      passed: state.passed,
      solutionUsed: state.solutionUsed,
      hintLevel: state.hintLevel,
      seconds: Math.round((Date.now() - state.startedAt) / 1000),
    });
  }
  var saveDraftSoon = debounce(saveDraft, 700);

  function loadDraft() {
    var d = readStore(KEY_DRAFT, null);
    if (!d || d.caseId !== CASE.id || !d.code) return false;
    state.step = Math.min(Math.max(0, parseInt(d.step, 10) || 0), CASE.steps.length - 1);
    state.code = { html: d.code.html || '', css: d.code.css || '' };
    state.stepCode = d.stepCode || {};
    state.passed = d.passed || {};
    state.solutionUsed = d.solutionUsed || {};
    state.hintLevel = d.hintLevel || {};
    state.startedAt = Date.now() - (num(d.seconds) * 1000);
    state.notice = t('draftRestored', { step: state.step + 1, time: nowLabel(d.at) });
    return true;
  }

  function worksList() {
    var list = readStore(KEY_WORKS, []);
    return Array.isArray(list) ? list : [];
  }

  function saveWork() {
    snapshot();
    var list = worksList();
    list.unshift({
      at: Date.now(),
      step: state.step,
      passed: passedCount(),
      total: CASE.steps.length,
      solutionUsed: Object.keys(state.solutionUsed).length,
      seconds: Math.round((Date.now() - state.startedAt) / 1000),
      code: state.code,
      stepCode: state.stepCode,
    });
    var ok = writeStore(KEY_WORKS, list.slice(0, WORKS_MAX));
    state.showWorks = true;
    state.notice = ok
      ? t('workSaved', { max: WORKS_MAX })
      : t('workSaveFail');
    render();
  }

  function loadWork(index) {
    var item = worksList()[index];
    if (!item) return;
    state.step = Math.min(Math.max(0, parseInt(item.step, 10) || 0), CASE.steps.length - 1);
    state.code = { html: (item.code && item.code.html) || '', css: (item.code && item.code.css) || '' };
    state.stepCode = item.stepCode || {};
    state.results = null;
    state.showWorks = false;
    setEditors();
    focusForStep(state.step, false);
    state.notice = t('workLoaded', { time: nowLabel(item.at) });
    updatePreview();
    saveDraft();
    render();
  }

  function deleteWork(index) {
    var list = worksList();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    writeStore(KEY_WORKS, list);
    state.notice = t('workDeleted');
    render();
  }

  function exportHtml() {
    var html = buildDoc();
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var d = new Date();
    var name = t('exportPrefix') + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + '.html';
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    state.notice = t('exportDone', { name: name });
    render();
  }

  /* =======================================================
   * 十、渲染
   *    只重建"数据区"（侧栏 / 题干 / 检查结果 / 按钮 / 作品列表），
   *    编辑器与 iframe 是静态 DOM，永远不重建
   * ===================================================== */
  function render() {
    renderBrief();
    renderSteps();
    renderProgress();
    renderTask();
    renderChecks();
    renderActions();
    renderWorks();
    renderDevices();
    renderScriptNote();
    renderNotice();
  }

  function renderProgress() {
    if (!el.progress) return;
    var done = passedCount();
    var total = CASE.steps.length;
    var pct = Math.round(done / total * 100);
    el.progress.innerHTML =
      '<div class="lab-progress-head">' +
        '<span>' + t('progressHead', { done: done, total: total }) + '</span>' +
        '<span class="lab-progress-pct">' + pct + '%</span>' +
      '</div>' +
      '<div class="lab-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
        '<span style="width:' + pct + '%"></span>' +
      '</div>';
  }

  function renderNotice() {
    el.notice.hidden = !state.notice;
    el.notice.textContent = state.notice || '';
    el.notice.classList.toggle('is-good', isGoodNotice(state.notice));
  }

  function renderBrief() {
    var b = CASE.brief;
    var assets = CASE.assets.map(function (a) {
      return '<li><button type="button" class="lab-asset" data-lab-act="insert" data-lab-value="' + esc(a.value) + '">' +
        '<span class="lab-asset-label">' + esc(a.label) + '</span>' +
        '<span class="lab-asset-value">' + esc(a.value) + '</span>' +
      '</button></li>';
    }).join('');

    el.brief.innerHTML =
      '<dl class="lab-brief-list">' +
        '<dt>' + esc(t('briefGoal')) + '</dt><dd>' + esc(b.goal) + '</dd>' +
        '<dt>' + esc(t('briefAudience')) + '</dt><dd>' + esc(b.audience) + '</dd>' +
        '<dt>' + esc(t('briefSuccess')) + '</dt><dd>' + esc(b.success) + '</dd>' +
        '<dt>' + esc(t('briefDeliverable')) + '</dt><dd>' + esc(b.deliverable) + '</dd>' +
      '</dl>' +
      '<p class="lab-note">' + esc(CASE.baseNote) + '</p>' +
      '<details class="lab-assets">' +
        '<summary>' + esc(t('briefAssets')) + '</summary>' +
        '<ul>' + assets + '</ul>' +
      '</details>' +
      '<p class="lab-note">' + esc(t('briefLessonIntro')) +
        '<a href="' + esc(CASE.lesson) + '">' + esc(t('briefLessonLink')) + '</a></p>';
  }

  // 侧栏用的短标题：'环节 1 · 搭出页面骨架' / 'Step 1 · Build the page skeleton' → 去掉 '·' 之前的部分
  // 用分隔符切分而不是中文正则，这样换语言也成立
  function shortTitle(title) {
    var s = String(title || '');
    var i = s.indexOf('·');
    var out = i >= 0 ? s.slice(i + 1).trim() : s;
    return out || s;
  }

  function renderSteps() {
    el.steps.innerHTML = '<ol class="lab-step-list">' + CASE.steps.map(function (s, i) {
      var cls = 'lab-step' + (i === state.step ? ' is-current' : '') + (state.passed[s.id] ? ' is-done' : '');
      return '<li>' +
        '<button type="button" class="' + cls + '" data-lab-act="goto" data-lab-step="' + i + '">' +
          '<span class="lab-step-no">' + (state.passed[s.id] ? '✓' : (i + 1)) + '</span>' +
          '<span class="lab-step-title">' + esc(shortTitle(s.title)) + '</span>' +
          (state.solutionUsed[s.id] ? '<span class="lab-step-flag">' + esc(t('stepSolutionFlag')) + '</span>' : '') +
        '</button>' +
      '</li>';
    }).join('') + '</ol>';
  }

  function renderTask() {
    var s = CASE.steps[state.step];
    var level = state.hintLevel[s.id] || 0;

    var taskHtml = '<ol class="lab-task-list">' + s.task.map(function (t) {
      return '<li>' + esc(t) + '</li>';
    }).join('') + '</ol>';

    var hintsHtml = '';
    if (level > 0) {
      hintsHtml =
        '<div class="lab-hint-box">' +
          '<ol class="lab-hint-list">' +
            s.hints.slice(0, level).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') +
          '</ol>' +
          '<details class="lab-syntax" open>' +
            '<summary>' + esc(t('syntaxTitle')) + '</summary>' +
            '<ul>' + s.syntax.map(function (k) {
              return '<li><code>' + esc(k.code) + '</code><span class="lab-syntax-note">' + esc(k.note) + '</span></li>';
            }).join('') + '</ul>' +
          '</details>' +
        '</div>';
    }

    el.task.innerHTML =
      '<div class="lab-tags">' + s.learn.map(function (t) {
        return '<span class="lab-tag">' + esc(t) + '</span>';
      }).join('') + '</div>' +
      '<h2 class="lab-task-title">' + esc(s.title) + '</h2>' +
      '<p class="lab-task-sub">' + esc(s.subtitle) + '</p>' +
      taskHtml +
      '<div class="lab-task-actions">' +
        '<button type="button" class="lab-btn lab-btn--hint" data-lab-act="hint">' +
          esc(t('btnHint')) + ' <span class="lab-hint-count">' + level + ' / ' + s.hints.length + '</span>' +
        '</button>' +
        (level > 0 ? '<span class="lab-task-hint-note">' + esc(t('hintLevelNote')) + '</span>' : '') +
      '</div>' +
      hintsHtml;
  }

  function renderChecks() {
    var s = CASE.steps[state.step];
    var res = (state.results && state.results.stepId === s.id) ? state.results : null;

    if (!res) {
      el.checks.innerHTML = '<p class="lab-empty">' + esc(t('checkEmptyIntro', { width: CHECK_WIDTH })) + '</p>';
      return;
    }

    var pass = res.items.filter(function (it) { return it.ok; }).length;
    var all = res.items.length;

    el.checks.innerHTML =
      '<div class="lab-check-head">' +
        '<span class="lab-check-score">' + esc(t('checkScore', { pass: pass, total: all })) + '</span>' +
        '<span class="lab-check-flag ' + (pass === all ? 'is-good' : 'is-warn') + '">' +
          esc(pass === all ? t('checkFlagGood') : t('checkFlagBad', { n: all - pass })) +
        '</span>' +
      '</div>' +
      '<ul class="lab-check-list">' + res.items.map(function (it) {
        return '<li class="' + (it.ok ? 'is-ok' : 'is-bad') + '">' +
          '<span class="lab-check-mark" aria-hidden="true">' + (it.ok ? '✓' : '✗') + '</span>' +
          '<span>' + esc(it.label) + (it.err ? '（' + esc(it.err) + '）' : '') + '</span>' +
        '</li>';
      }).join('') + '</ul>' +
      '<p class="lab-note">' + esc(t('checkFootnote', { width: CHECK_WIDTH })) + '</p>';
  }

  function renderActions() {
    var s = CASE.steps[state.step];
    var isFirst = state.step === 0;
    var isLast = state.step === CASE.steps.length - 1;
    var works = worksList().length;
    var nextLabel = isLast ? t('btnFinishCase') : t('btnNextStep');

    el.actions.innerHTML =
      '<div class="lab-action-row">' +
        '<button type="button" class="lab-btn lab-btn--primary" data-lab-act="check">' + esc(t('btnCheck')) + '</button>' +
        '<button type="button" class="lab-btn" data-lab-act="prev"' + (isFirst ? ' disabled' : '') + '>' +
          esc(t('btnPrevStep')) + '</button>' +
        '<button type="button" class="lab-btn" data-lab-act="next"' + (isLast ? ' disabled' : '') + '>' +
          esc(nextLabel) + '</button>' +
        (isLast ? '<button type="button" class="lab-btn lab-btn--primary" data-lab-act="save">' +
          esc(t('btnSave')) + '</button>' : '') +
      '</div>' +

      '<div class="lab-action-row lab-action-row--sub">' +
        '<button type="button" class="lab-btn lab-btn--ghost' + (state.confirm === 'solution' ? ' is-confirm' : '') + '" data-lab-act="solution">' +
          esc(state.confirm === 'solution' ? t('btnSolutionConfirm') : t('btnSolution')) +
        '</button>' +
        '<button type="button" class="lab-btn lab-btn--ghost' + (state.confirm === 'reset' ? ' is-confirm' : '') + '" data-lab-act="reset">' +
          esc(state.confirm === 'reset' ? t('btnResetConfirm') : t('btnReset')) +
        '</button>' +
        '<span class="lab-action-gap" aria-hidden="true"></span>' +
        '<button type="button" class="lab-btn" data-lab-act="save">' + esc(t('btnSave')) + '</button>' +
        '<button type="button" class="lab-btn" data-lab-act="works">' + esc(t('btnWorks')) +
          (works ? '<span class="lab-count">' + works + '</span>' : '') + '</button>' +
        '<button type="button" class="lab-btn" data-lab-act="export">' + esc(t('btnExport')) + '</button>' +
        '<button type="button" class="lab-btn lab-btn--danger' + (state.confirm === 'restart' ? ' is-confirm' : '') + '" data-lab-act="restart">' +
          esc(state.confirm === 'restart' ? t('btnRestartConfirm') : t('btnRestart')) +
        '</button>' +
      '</div>' +

      '<p class="lab-hint-note">' + esc(t('actionsState', {
        title: s.title, done: passedCount(), total: CASE.steps.length,
      })) + '</p>';
  }

  function renderDevices() {
    var html = DEVICES.map(function (d) {
      return '<button type="button" class="lab-device' + (state.device === d.key ? ' is-active' : '') + '"' +
        ' data-lab-act="device" data-lab-device="' + d.key + '"' +
        ' aria-pressed="' + (state.device === d.key) + '">' + esc(t(d.labelKey)) + '</button>';
    }).join('');
    el.devices.innerHTML = html;
  }

  function renderWorks() {
    el.works.hidden = !state.showWorks;
    if (!state.showWorks) { el.works.innerHTML = ''; return; }

    var list = worksList();
    el.works.innerHTML =
      '<div class="lab-works-head">' +
        '<h3 class="lab-works-title">' + esc(t('worksTitle')) +
          ' <span class="lab-count">' + list.length + '</span></h3>' +
        '<button type="button" class="lab-btn lab-btn--ghost" data-lab-act="works-close">' +
          esc(t('btnCollapse')) + '</button>' +
      '</div>' +
      (list.length
        ? '<ul class="lab-works-list">' + list.map(function (w, i) {
            return '<li class="lab-work-item">' +
              '<span class="lab-work-time">' + nowLabel(w.at) + '</span>' +
              '<span class="lab-work-detail">' +
                esc(t('worksItemDetail', {
                  step: num(w.step) + 1,
                  total: CASE.steps.length,
                  passed: num(w.passed),
                  minutes: Math.max(1, Math.round(num(w.seconds) / 60)),
                })) +
                (w.solutionUsed ? esc(t('worksItemSolution', { n: num(w.solutionUsed) })) : '') +
              '</span>' +
              '<span class="lab-work-actions">' +
                '<button type="button" class="lab-btn lab-btn--ghost" data-lab-act="work-load" data-lab-index="' + i + '">' +
                  esc(t('btnLoadWork')) + '</button>' +
                '<button type="button" class="lab-btn lab-btn--danger" data-lab-act="work-delete" data-lab-index="' + i + '">' +
                  esc(t('btnDeleteWork')) + '</button>' +
              '</span>' +
            '</li>';
          }).join('') + '</ul>'
        : '<p class="lab-empty">' + esc(t('worksEmpty')) + '</p>') +
      '<p class="lab-note">' + esc(t('worksNote', { max: WORKS_MAX })) + '</p>';
  }

  /* =======================================================
   * 十一、事件（统一委托到 #lab-root，只挂一个监听）
   * ===================================================== */
  var updatePreviewSoon = debounce(updatePreview, 320);

  root.addEventListener('click', function (e) {
    var target = e.target;
    if (target && target.nodeType !== 1) target = target.parentElement;
    var btn = (target && target.closest) ? target.closest('[data-lab-act]') : null;
    if (!btn || !root.contains(btn) || btn.disabled) return;

    var act = btn.getAttribute('data-lab-act');
    var index = parseInt(btn.getAttribute('data-lab-index'), 10);
    var stepIndex = parseInt(btn.getAttribute('data-lab-step'), 10);

    // 除"两步确认"本身外，任何其它操作都取消待确认状态
    if (act !== 'solution' && act !== 'reset' && act !== 'restart' && state.confirm) {
      state.confirm = '';
    }

    if (act === 'goto') { gotoStep(isNaN(stepIndex) ? 0 : stepIndex); return; }
    if (act === 'prev') { gotoStep(state.step - 1); return; }
    if (act === 'next') { gotoStep(state.step + 1); return; }
    if (act === 'check') { runChecks(); return; }
    if (act === 'hint') { revealHint(); return; }
    if (act === 'solution') { applySolution(); return; }
    if (act === 'reset') { resetStep(); return; }
    if (act === 'restart') { restartAll(); return; }
    if (act === 'insert') { insertAsset(btn.getAttribute('data-lab-value') || ''); return; }
    if (act === 'save') { saveWork(); return; }
    if (act === 'export') { exportHtml(); return; }
    if (act === 'works') { state.showWorks = true; render(); return; }
    if (act === 'works-close') { state.showWorks = false; render(); return; }
    if (act === 'work-load') { loadWork(isNaN(index) ? -1 : index); return; }
    if (act === 'work-delete') { deleteWork(isNaN(index) ? -1 : index); return; }
    if (act === 'device') {
      state.device = btn.getAttribute('data-lab-device') || 'desktop';
      renderDevices();
      fitFrame();
      return;
    }
  });

  /* ---------------- 编辑器增强：Tab 缩进 / 回车继承缩进 ---------------- */
  function bindEditors() {
    [['html', el.html], ['css', el.css]].forEach(function (pair) {
      var key = pair[0];
      var ta = pair[1];
      if (!ta) return;

      ta.addEventListener('focus', function () { lastEditor = ta; });

      ta.addEventListener('input', function () {
        state.code[key] = ta.value;
        updatePreviewSoon();
        saveDraftSoon();
      });

      ta.addEventListener('keydown', function (e) {
        var start = ta.selectionStart;
        var end = ta.selectionEnd;

        // Tab 不移动焦点，而是插入两个空格（写代码的肌肉记忆）
        if (e.key === 'Tab') {
          e.preventDefault();
          ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
          if (ta.setSelectionRange) ta.setSelectionRange(start + 2, start + 2);
        } else if (e.key === 'Enter' && start === end) {
          // 回车时继承上一行缩进，省掉手打空格
          var lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
          var indent = (ta.value.slice(lineStart, start).match(/^[ \t]*/) || [''])[0];
          if (!indent) return;
          e.preventDefault();
          var insert = '\n' + indent;
          ta.value = ta.value.slice(0, start) + insert + ta.value.slice(start);
          if (ta.setSelectionRange) ta.setSelectionRange(start + insert.length, start + insert.length);
        } else {
          return;
        }

        state.code[key] = ta.value;
        updatePreviewSoon();
        saveDraftSoon();
      });
    });
  }

  /* =======================================================
   * 十二、启动
   * ===================================================== */
  function init() {
    initFrame();
    bindEditors();

    if (!loadDraft()) {
      state.code = {
        html: (CASE.startCode && CASE.startCode.html) || '',
        css: (CASE.startCode && CASE.startCode.css) || '',
      };
      state.notice = t('initStart');
    }

    setEditors();
    focusForStep(state.step, false);
    render();

    window.addEventListener('resize', debounce(function () {
      fitFrame();
    }, 150));

    console.log('[practice] 已就绪 · 案例「' + CASE.title + '」· ' + CASE.steps.length + ' 个环节');
  }

  init();
})();
