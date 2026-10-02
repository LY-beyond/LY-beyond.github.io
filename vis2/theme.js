/* =========================================================
 * theme.js —— 亮 / 暗色手动切换器（全站共享）
 * ---------------------------------------------------------
 * 本文件必须在 <head> 里尽早加载（不带 defer）：
 * 第一段代码在页面首次渲染前就把 data-theme 写到 <html>，
 * tokens.css 的 :root[data-theme="dark"] 随即生效，不闪白。
 *
 * 优先级：localStorage 手动选择 > 系统 prefers-color-scheme。
 * 未手动选择时自动跟随系统；一旦点过按钮，全站记住偏好。
 * 切换后派发 document 级 'themechange' 事件（知识图谱据此重绘）。
 * ========================================================= */
(function () {
  'use strict';

  var KEY = 'theme-preference';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; } /* 隐私模式等场景降级 */
  }
  function persist(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* 忽略写入失败 */ }
  }
  function resolveTheme() {
    var s = saved();
    if (s === 'dark' || s === 'light') return s;
    return mq && mq.matches ? 'dark' : 'light';
  }
  function apply(t) {
    root.setAttribute('data-theme', t);
  }

  /* ① 渲染前定主题（防 FOUC 的关键一行） */
  apply(resolveTheme());

  /* ② 系统主题变化：仅在用户未手动选择（自动模式）时跟随 */
  if (mq) {
    var onSystem = function (e) {
      if (!saved()) {
        apply(e.matches ? 'dark' : 'light');
        syncButton();
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystem);
    else if (mq.addListener) mq.addListener(onSystem); /* 旧 Safari */
  }

  /* ③ 多标签页同步 */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { apply(resolveTheme()); syncButton(); }
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

  var btn = null;
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

    /* 门户 / 章节页：放在「中 | EN」语言切换器左侧；
       实战页（无语言切换器）：贴到横向顶栏最右端 */
    var langSwitch = document.querySelector('.lang-switch');
    if (langSwitch && langSwitch.parentNode) {
      langSwitch.parentNode.insertBefore(btn, langSwitch);
    } else {
      var bar = document.querySelector('.course-topbar') || document.querySelector('.topbar-inner');
      if (bar) {
        btn.classList.add('theme-toggle--bar');
        bar.appendChild(btn);
      } else {
        document.body.appendChild(btn); /* 兜底：不因为找不到容器而缺失功能 */
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}());
