/* =========================================================
 * theme.js —— 亮 / 暗色手动切换器（全站共享）
 * ---------------------------------------------------------
 * 本文件必须在 <head> 里尽早加载（不带 defer）：
 * 第一段代码在页面首次渲染前就把 data-theme 写到 <html>，
 * tokens.css 的 :root[data-theme="dark"] 随即生效，不闪白。
 *
 * 优先级：localStorage 手动选择 > 默认暗色。
 * 首次访问（无手动选择记录）一律进入暗色模式；
 * 一旦点过切换按钮，全站记住偏好，之后以手动选择为准。
 * 切换后派发 document 级 'themechange' 事件（知识图谱据此重绘）。
 * ========================================================= */
(function () {
  'use strict';

  var KEY = 'vis4-theme';
  var root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; } /* 隐私模式等场景降级 */
  }
  function persist(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* 忽略写入失败 */ }
  }
  function resolveTheme() {
    var s = saved();
    if (s === 'dark' || s === 'light') return s;
    return 'dark'; /* 首次访问默认暗色 */
  }
  function apply(t) {
    root.setAttribute('data-theme', t);
  }

  /* ① 渲染前定主题（防 FOUC 的关键一行） */
  apply(resolveTheme());

  /* =========================================================
   * CVD 色觉模拟（全站）—— 关闭 → 红色盲 → 绿色盲 → 蓝色盲 循环
   * 滤镜矩阵与 lesson-03 演示的 CVD_MATRICES 同源（Machado 2009 一类近似）。
   * 实现：body 上的 CSS filter 引用下方注入的 SVG feColorMatrix；
   * 各页顶栏均为 position: sticky，不会被 filter 破坏吸顶。
   * ======================================================= */
  var CVD_KEY = 'vis4-cvd';
  var CVD_DEFS =
    '<svg class="cvd-defs" aria-hidden="true" focusable="false" ' +
    'style="position:absolute;width:0;height:0;overflow:hidden">' +
    '<defs>' +
    '<filter id="cvd-prot" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' +
    '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter>' +
    '<filter id="cvd-deut" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' +
    '0.625 0.375 0 0 0  0.700 0.300 0 0 0  0 0.300 0.700 0 0  0 0 0 1 0"/></filter>' +
    '<filter id="cvd-trit" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' +
    '0.950 0.050 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter>' +
    '</defs></svg>';
  var CVD_MODES = [
    { v: '',     short: { zh: '色觉模拟', en: 'CVD' },  full: { zh: '关闭', en: 'off' } },
    { v: 'prot', short: { zh: '红色盲', en: 'Prot' },   full: { zh: '红色盲（protanopia）', en: 'Protanopia' } },
    { v: 'deut', short: { zh: '绿色盲', en: 'Deut' },   full: { zh: '绿色盲（deuteranopia）', en: 'Deuteranopia' } },
    { v: 'trit', short: { zh: '蓝色盲', en: 'Trit' },   full: { zh: '蓝色盲（tritanopia）', en: 'Tritanopia' } }
  ];

  function savedCvd() {
    try { return localStorage.getItem(CVD_KEY) || ''; } catch (e) { return ''; } /* 隐私模式等场景降级 */
  }
  function persistCvd(v) {
    try { localStorage.setItem(CVD_KEY, v); } catch (e) { /* 忽略写入失败 */ }
  }
  function cvdModeOf(v) {
    for (var i = 0; i < CVD_MODES.length; i++) {
      if (CVD_MODES[i].v === v) return CVD_MODES[i];
    }
    return CVD_MODES[0];
  }
  function cvdLang() {
    return (root.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh';
  }
  function applyCvd(v) {
    if (v) { root.setAttribute('data-cvd', v); } else { root.removeAttribute('data-cvd'); }
  }
  /* 滤镜定义挂在 <html> 上（0×0 绝对定位不可见）：
     head 阶段就注入，data-cvd 生效时 filter 引用的滤镜一定存在，不闪空屏 */
  function injectCvdDefs() {
    if (document.getElementById('cvd-prot')) return;
    try {
      document.documentElement.insertAdjacentHTML('beforeend', CVD_DEFS);
    } catch (e) { /* 极端环境：mount 时还会兜底一次 */ }
  }

  /* ② 滤镜定义尽早注入 + 恢复上次的模拟状态 */
  injectCvdDefs();
  applyCvd(cvdModeOf(savedCvd()).v);

  /* ③ 多标签页同步：主题与 CVD 模拟状态都跟随 */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { apply(resolveTheme()); syncButton(); }
    if (e.key === CVD_KEY) { applyCvd(cvdModeOf(e.newValue || '').v); syncCvdButton(); }
  });

  /* ---------- 顶栏按钮（DOM 就绪后注入，HTML 无需逐个改动） ---------- */

  /* 月亮 = 当前是亮色、点按去暗色；太阳 = 当前是暗色、点按去亮色 */
  var ICON_MOON =
    '<svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" width="16" height="16" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var ICON_SUN =
    '<svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" width="16" height="16" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

  var LABELS = {
    zh: { toDark: '切换到暗色模式', toLight: '切换到亮色模式' },
    en: { toDark: 'Switch to dark mode', toLight: 'Switch to light mode' }
  };

  /* CVD 按钮：眼睛图标 + 当前模式短词（见 theme.css 的 .cvd-toggle） */
  var ICON_EYE =
    '<svg class="cvd-toggle__icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';

  var btn = null;
  var cvdBtn = null;
  function labels() {
    var lang = (root.getAttribute('lang') || '').toLowerCase();
    return lang.indexOf('en') === 0 ? LABELS.en : LABELS.zh;
  }
  function syncButton() {
    if (!btn) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    var text = dark ? labels().toLight : labels().toDark;
    btn.setAttribute('aria-label', text);
    btn.setAttribute('title', text);
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }

  function syncCvdButton() {
    if (!cvdBtn) return;
    var cur = cvdModeOf(root.getAttribute('data-cvd') || '');
    var next = CVD_MODES[(CVD_MODES.indexOf(cur) + 1) % CVD_MODES.length];
    var lg = cvdLang();
    var text = lg === 'en'
      ? 'CVD simulation: ' + cur.full.en + ' — click to switch to ' + next.full.en
      : '色觉模拟：' + cur.full.zh + '，点击切换为' + next.full.zh;
    var textEl = cvdBtn.querySelector('.cvd-toggle__text');
    if (textEl) textEl.textContent = cur.short[lg];
    cvdBtn.setAttribute('aria-label', text);
    cvdBtn.setAttribute('title', text);
    cvdBtn.setAttribute('aria-pressed', cur.v ? 'true' : 'false');
    cvdBtn.classList.toggle('cvd-toggle--active', !!cur.v);
  }

  function mount() {
    if (btn) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.innerHTML = ICON_MOON + ICON_SUN;
    syncButton();

    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      persist(next);
      apply(next);
      syncButton();
      /* 通知页面内自行读取令牌的组件（如知识图谱 SVG）即时重绘 */
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    });

    /* CVD 色觉模拟按钮：紧跟主题按钮之后（仍在语言切换器左侧） */
    cvdBtn = document.createElement('button');
    cvdBtn.type = 'button';
    cvdBtn.className = 'cvd-toggle';
    cvdBtn.innerHTML = ICON_EYE + '<span class="cvd-toggle__text"></span>';
    syncCvdButton();
    cvdBtn.addEventListener('click', function () {
      var cur = cvdModeOf(root.getAttribute('data-cvd') || '');
      var next = CVD_MODES[(CVD_MODES.indexOf(cur) + 1) % CVD_MODES.length];
      persistCvd(next.v);
      applyCvd(next.v);
      syncCvdButton();
    });

    /* 门户 / 章节页：放在「中 | EN」语言切换器左侧；
       实战页（无语言切换器）：贴到横向顶栏最右端 */
    var langSwitch = document.querySelector('.lang-switch');
    if (langSwitch && langSwitch.parentNode) {
      langSwitch.parentNode.insertBefore(btn, langSwitch);
      langSwitch.parentNode.insertBefore(cvdBtn, langSwitch);
    } else {
      var bar = document.querySelector('.course-topbar') || document.querySelector('.topbar-inner');
      if (bar) {
        btn.classList.add('theme-toggle--bar');
        cvdBtn.classList.add('cvd-toggle--bar');
        bar.appendChild(btn);
        bar.appendChild(cvdBtn);
      } else {
        document.body.appendChild(btn); /* 兜底：不因为找不到容器而缺失功能 */
        document.body.appendChild(cvdBtn);
      }
    }

    /* 兜底：head 阶段注入滤镜失败时再补一次 */
    injectCvdDefs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}());
