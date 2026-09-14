// =========================================================
// i18n.js —— 中英双语切换（全站共享）
// ---------------------------------------------------------
// 刻意用「普通 script（IIFE）」而不是 ES Module，原因：
//   lesson.js 是 ES Module，一旦用户用 file:// 打开页面，
//   浏览器会以 CORS 拦截它 —— 此时切换器仍然必须能用，
//   否则用户连“换个语言试试”的机会都没有。
//
// 页面约定：每个页面用 <a data-lang-link="en|zh" href="指向另一种语言的同类页面">
// 标记「另一种语言」的地址（相对路径，任意子目录部署都成立）。
// 本脚本据此实现三件事：
//   ① 切换链接携带当前 #hash —— 切完语言仍停在同一个小节
//   ② 记住用户的选择（localStorage）
//   ③ 下次直接访问另一种语言的页面时，自动送到用户选过的语言
// 另外支持 ?lang=zh / ?lang=en 强制指定（分享链接、二维码用），
// 该参数优先级高于记忆，用来“摆脱”自动跳转。
// =========================================================
(function () {
  'use strict';

  var KEY = 'layout-course-lang';
  var html = document.documentElement;
  var CUR = /^zh/i.test(html.lang || '') ? 'zh' : 'en';   // 当前页面语言

  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 隐私模式忽略 */ } }
  function recall() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  // ① ?lang= 显式指定时，只记录，不做任何跳转
  var forced = '';
  try { forced = new URLSearchParams(location.search).get('lang') || ''; } catch (e) {}
  if (forced !== 'zh' && forced !== 'en') forced = '';
  if (forced) store(forced);

  // ② 找到「另一种语言」的链接；没有就什么都不做
  var other = document.querySelector('[data-lang-link]');
  if (!other) return;

  // ③ 让切换链接始终带上当前锚点
  var base = (other.getAttribute('href') || '').split('#')[0];
  other.setAttribute('href', base + location.hash);

  // ④ 用户点击切换时，记住这次选择
  other.addEventListener('click', function () {
    store(other.getAttribute('data-lang-link') || '');
  });

  // ⑤ 之前选过另一种语言，且这次没带 ?lang= —— 自动送过去
  //    （首次访问没有记忆，不跳，避免把访客弹来弹去）
  var saved = recall();
  if (saved && saved !== CUR && !forced) location.replace(base + location.hash);
})();
