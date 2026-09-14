// =========================================================
// quiz.js —— 学习成果检验 · 答题系统（门户首页专用，中文版）
// ---------------------------------------------------------
// 依赖：
//   quiz-data.js  →  window.QUIZ_BANK（30 道选择题 + 20 道判断题）
//   styles.css    →  .quiz-* 模块样式（配色全部来自 tokens.css）
//
// 刻意用「普通 script（IIFE）」而不是 ES Module，理由同 quiz-data.js：
//   门户首页只加载普通脚本，这样 file:// 直接打开也能答题。
//
// 五项职责：
//   ① 抽题：按「章节均衡」随机抽 8 道选择题 + 2 道判断题
//   ② 答题：单题流（上一题 / 下一题 / 进度条 / 未答引导）
//   ③ 判分：提交后出分、评级、逐题解析、薄弱章节跳转
//   ④ 错题本：答错自动收录、答对自动移出、可一键重做（localStorage）
//   ⑤ 历史成绩：最近 20 次记录 + 平均分 / 最高分（localStorage）
//
// ⚠️ 前端方案的固有限制：答案随静态文件下发，F12 可见。
//    本系统定位为「自学自测」，不是防作弊的正式考试。
// =========================================================
(function () {
  'use strict';

  var root = document.getElementById('quiz-root');
  if (!root) return;

  var BANK = window.QUIZ_BANK;
  if (!BANK || !BANK.choice || !BANK.judge) {
    root.innerHTML = '<p class="quiz-empty">题库加载失败：请确认 quiz-data.js 已在 quiz.js 之前引入。</p>';
    return;
  }

  /* =======================================================
   * 一、配置
   * ===================================================== */
  var PICK_CHOICE  = 8;      // 每次抽 8 道选择题
  var PICK_JUDGE   = 2;      // 每次抽 2 道判断题
  var PER_SCORE    = 10;     // 每题 10 分 → 10 题正好 100 分
  var HISTORY_MAX  = 20;     // 历史成绩最多保留 20 条
  var REVIEW_MAX   = 10;     // 一次最多重做 10 道错题（与一次测验题量对齐）

  // 存储键：与 i18n.js 的 'layout-course-lang' 命名风格保持一致
  var KEY_WRONG    = 'layout-course-quiz-wrong';
  var KEY_HISTORY  = 'layout-course-quiz-history';

  var JUDGE_OPTIONS = ['正确', '错误'];   // 判断题固定顺序，不参与洗牌

  /* =======================================================
   * 二、通用工具
   * ===================================================== */

  // HTML 转义：题干里含 → 、{} 等符号，统一转义后再拼字符串更稳妥
  function esc(text) {
    return String(text).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (e) {
      return fallback;      // 隐私模式 / 数据损坏：安静降级，不影响本次答题
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 隐私模式或配额已满：忽略即可，本局功能不受影响 */
    }
  }

  // Fisher-Yates 洗牌（不改动原数组）
  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* =======================================================
   * 三、抽题
   * ===================================================== */

  // 按章分桶 → 打乱桶序 → 轮流从每桶取 1 题 → 不够再从剩余里补
  // 目的：纯随机会出现「8 道题全落在同一章」，那样测验就失去检验意义了
  function pickBalanced(pool, n) {
    var buckets = {};
    pool.forEach(function (q) {
      (buckets[q.chapter] = buckets[q.chapter] || []).push(q);
    });

    var keys = shuffled(Object.keys(buckets));
    keys.forEach(function (k) { buckets[k] = shuffled(buckets[k]); });

    var picked = [];
    var round = 0;
    while (picked.length < n && round < pool.length) {
      var added = false;
      for (var i = 0; i < keys.length && picked.length < n; i++) {
        var bucket = buckets[keys[i]];
        if (round < bucket.length) { picked.push(bucket[round]); added = true; }
      }
      if (!added) break;
      round++;
    }
    return picked;
  }

  // 把两种题型统一成同一种「可渲染结构」，渲染与判分因此只需写一份
  //   choice：选项顺序也打乱，防止靠「答案总在 B」蒙对
  //   judge ：选项固定为 正确 / 错误，答案换算成下标 0 / 1
  function toQuestion(raw, type) {
    var options, answer;
    if (type === 'choice') {
      var order = shuffled(raw.options.map(function (unused, i) { return i; }));
      options = order.map(function (i) { return raw.options[i]; });
      answer = order.indexOf(raw.answer);
    } else {
      options = JUDGE_OPTIONS.slice();
      answer = raw.answer ? 0 : 1;
    }
    return {
      id: raw.id, type: type, chapter: raw.chapter, topic: raw.topic,
      q: raw.q, options: options, answer: answer, explain: raw.explain
    };
  }

  function buildPaper() {
    var paper = pickBalanced(BANK.choice, PICK_CHOICE)
      .map(function (q) { return toQuestion(q, 'choice'); })
      .concat(pickBalanced(BANK.judge, PICK_JUDGE)
        .map(function (q) { return toQuestion(q, 'judge'); }));
    // 合并后再洗一次：避免题序永远是「先 8 道选择、后 2 道判断」
    return shuffled(paper);
  }

  function findQuestion(id) {
    var all = BANK.choice.concat(BANK.judge);
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  /* =======================================================
   * 四、状态
   * ===================================================== */
  var state = {
    phase: 'idle',        // idle | answering | result | wrong | history
    mode: 'quiz',         // quiz = 正式测验（计入历史）；review = 重做错题（不计入）
    paper: [],            // 本局题目（已洗牌、选项已洗牌）
    answers: [],          // 与 paper 一一对应；null 表示未作答
    index: 0,             // 当前题号
    startedAt: 0,         // 本局开始时间戳（毫秒）
    result: null,         // 判分结果
    wrongOnly: false,     // 结果页是否只看错题
    confirmClear: false,  // 历史成绩「清空」的两步确认
    notice: ''            // 行内提示（替代 alert）
  };

  function wrongBook() {
    var book = readStore(KEY_WRONG, {});
    return (book && typeof book === 'object' && !Array.isArray(book)) ? book : {};
  }

  function historyList() {
    var list = readStore(KEY_HISTORY, []);
    return Array.isArray(list) ? list : [];
  }

  function removeWrong(id) {
    var book = wrongBook();
    if (book[id]) { delete book[id]; writeStore(KEY_WRONG, book); }
  }

  /* =======================================================
   * 五、时间 / 评级
   * ===================================================== */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function formatTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function formatDuration(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m > 0 ? m + ' 分 ' + s + ' 秒' : s + ' 秒';
  }

  function gradeOf(score) {
    if (score >= 90) return { text: '优秀', level: 'best', hint: '知识点掌握得很扎实 —— 可以去做第 9 章的完整实战了。' };
    if (score >= 70) return { text: '良好', level: 'good', hint: '主干已经清楚，把错题解析再过一遍就更稳了。' };
    if (score >= 60) return { text: '合格', level: 'pass', hint: '刚刚及格，仍有明显漏洞，建议按下面的薄弱章节回看。' };
    return { text: '需要复习', level: 'low', hint: '先把相关章节的「讲解」读一遍，再回来重做错题本。' };
  }

  function trackOf(chapter) {
    if (chapter <= 4) return '设计篇';
    if (chapter <= 8) return '实现篇';
    return '实战篇';
  }

  function optionKey(q, i) {
    return q.type === 'judge' ? (i === 0 ? '✓' : '✗') : 'ABCD'.charAt(i);
  }

  function optionText(q, idx) {
    if (idx === null || idx === undefined || idx < 0) return '未作答';
    return (q.type === 'judge' ? '' : optionKey(q, idx) + '. ') + q.options[idx];
  }

  function badge(n) {
    return n ? '<span class="quiz-badge">' + n + '</span>' : '';
  }

  function noticeHtml() {
    return state.notice
      ? '<p class="quiz-notice" role="status">' + esc(state.notice) + '</p>'
      : '';
  }

  function scrollToQuiz() {
    var section = document.getElementById('quiz');
    if (!section) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  /* =======================================================
   * 六、开局 / 判分
   * ===================================================== */
  function beginPaper(paper, mode) {
    state.mode = mode;
    state.paper = paper;
    state.answers = paper.map(function () { return null; });
    state.index = 0;
    state.startedAt = Date.now();
    state.result = null;
    state.wrongOnly = false;
    state.notice = '';
    state.phase = 'answering';
    render();
    scrollToQuiz();
  }

  function startQuiz() {
    beginPaper(buildPaper(), 'quiz');
  }

  // 重做错题：按最近答错排序取最多 10 道；结果不写入历史成绩，避免刷分
  function startReview() {
    var book = wrongBook();
    var ids = Object.keys(book).filter(function (id) { return !!findQuestion(id); });
    if (!ids.length) {
      state.notice = '错题本是空的 —— 先在测验里答几题吧。';
      renderWrong();
      return;
    }
    ids.sort(function (a, b) { return (book[b].lastAt || 0) - (book[a].lastAt || 0); });

    var paper = ids.slice(0, REVIEW_MAX).map(function (id) {
      var raw = findQuestion(id);
      return toQuestion(raw, raw.options ? 'choice' : 'judge');
    });
    beginPaper(shuffled(paper), 'review');
  }

  function submit() {
    var unanswered = [];
    state.answers.forEach(function (a, i) {
      if (a === null || a === undefined) unanswered.push(i + 1);
    });
    if (unanswered.length) {
      state.notice = '还有 ' + unanswered.length + ' 题未作答（第 ' + unanswered.join('、') + ' 题），已跳到第一道未答题。';
      state.index = unanswered[0] - 1;
      renderQuestion();
      return;
    }

    var details = state.paper.map(function (q, i) {
      return { q: q, picked: state.answers[i], ok: state.answers[i] === q.answer };
    });
    var correct = details.filter(function (d) { return d.ok; }).length;
    var total = details.length;
    // 得分按百分比计算：一次测验 10 题时正好等价于「每题 10 分」
    var score = Math.round(correct / total * 100);
    var seconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));

    // 错题本：答错的收录（累计次数），答对的移出（掌握即出本）
    var book = wrongBook();
    details.forEach(function (d) {
      if (d.ok) {
        delete book[d.q.id];
      } else {
        var rec = book[d.q.id] || { count: 0 };
        rec.type = d.q.type;
        rec.count = (rec.count || 0) + 1;
        rec.lastAt = Date.now();
        rec.myAnswer = d.picked;
        book[d.q.id] = rec;
      }
    });
    writeStore(KEY_WRONG, book);

    // 历史成绩：只记正式测验
    if (state.mode === 'quiz') {
      var list = historyList();
      list.unshift({ at: Date.now(), score: score, correct: correct, total: total, seconds: seconds });
      writeStore(KEY_HISTORY, list.slice(0, HISTORY_MAX));
    }

    state.result = { details: details, correct: correct, total: total, score: score, seconds: seconds, mode: state.mode };
    state.phase = 'result';
    state.wrongOnly = false;
    state.notice = '';
    render();
    scrollToQuiz();
  }

  // 选中某个选项后只做局部更新：不重建 DOM，键盘焦点不会丢
  function syncPick() {
    var picked = state.answers[state.index];
    var btns = root.querySelectorAll('.quiz-option');
    for (var i = 0; i < btns.length; i++) {
      var on = i === picked;
      btns[i].classList.toggle('is-picked', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    var total = state.paper.length;
    var answered = state.answers.filter(function (a) { return a !== null && a !== undefined; }).length;
    var progress = Math.round(answered / total * 100);

    var count = root.querySelector('.quiz-progress-count');
    if (count) count.textContent = '已答 ' + answered + ' / ' + total;

    var bar = root.querySelector('.quiz-progress-bar span');
    if (bar) bar.style.width = progress + '%';

    var track = root.querySelector('.quiz-progress-bar');
    if (track) track.setAttribute('aria-valuenow', String(progress));
  }

  /* =======================================================
   * 七、视图渲染
   * ===================================================== */
  function render() {
    if (state.phase === 'answering') { renderQuestion(); return; }
    if (state.phase === 'result')    { renderResult();   return; }
    if (state.phase === 'wrong')     { renderWrong();    return; }
    if (state.phase === 'history')   { renderHistory();  return; }
    renderIdle();
  }

  /* ---------- 7.1 起始页 ---------- */
  function renderIdle() {
    var book = wrongBook();
    var wrongCount = Object.keys(book).filter(function (id) { return !!findQuestion(id); }).length;
    var list = historyList();
    var best = list.reduce(function (max, r) { return Math.max(max, r.score || 0); }, 0);
    var totalQ = PICK_CHOICE + PICK_JUDGE;

    root.innerHTML =
      '<div class="quiz-card quiz-card--intro">' +
        '<h3 class="quiz-title">随机测验 · ' + totalQ + ' 题</h3>' +
        '<p class="quiz-desc">题库覆盖 9 章全部知识点，共 ' +
          (BANK.choice.length + BANK.judge.length) + ' 道题（' + BANK.choice.length + ' 道选择题 + ' +
          BANK.judge.length + ' 道判断题）。每次随机抽取 <strong>' + PICK_CHOICE + ' 道选择题</strong>与 <strong>' +
          PICK_JUDGE + ' 道判断题</strong>，并让题目尽量分布在不同章节。</p>' +
        '<ul class="quiz-rules">' +
          '<li>共 ' + totalQ + ' 题，每题 ' + PER_SCORE + ' 分，满分 ' + (totalQ * PER_SCORE) + ' 分</li>' +
          '<li>提交后立即判分，并给出逐题解析与薄弱章节跳转</li>' +
          '<li>答错的题自动进入「错题本」，之后答对会自动移出</li>' +
          (list.length
            ? '<li>已记录 ' + list.length + ' 次成绩，最高 ' + best + ' 分</li>'
            : '<li>成绩保存在本机浏览器里（localStorage），换设备不会同步</li>') +
        '</ul>' +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="start">开始答题</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="wrong">错题本' + badge(wrongCount) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="history">历史成绩' + badge(list.length) + '</button>' +
        '</div>' +
      '</div>' +
      noticeHtml();
  }

  /* ---------- 7.2 答题页 ---------- */
  function renderQuestion() {
    var q = state.paper[state.index];
    var picked = state.answers[state.index];
    var total = state.paper.length;
    var answered = state.answers.filter(function (a) { return a !== null && a !== undefined; }).length;
    var progress = Math.round(answered / total * 100);
    var isReview = state.mode === 'review';

    var optionsHtml = q.options.map(function (text, i) {
      var on = picked === i;
      return '<button type="button" class="quiz-option' + (on ? ' is-picked' : '') + '"' +
        ' data-quiz-act="pick" data-quiz-index="' + i + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="quiz-option-key">' + esc(optionKey(q, i)) + '</span>' +
        '<span class="quiz-option-text">' + esc(text) + '</span>' +
      '</button>';
    }).join('');

    root.innerHTML =
      '<div class="quiz-card">' +
        '<div class="quiz-progress">' +
          '<div class="quiz-progress-head">' +
            '<span>' + (isReview ? '错题重做' : '随机测验') + ' · 第 <b>' + (state.index + 1) + '</b> / ' + total + ' 题</span>' +
            '<span class="quiz-progress-count">已答 ' + answered + ' / ' + total + '</span>' +
          '</div>' +
          '<div class="quiz-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"' +
            ' aria-valuenow="' + progress + '"><span style="width:' + progress + '%"></span></div>' +
        '</div>' +

        '<div class="quiz-qmeta">' +
          '<span class="quiz-tag quiz-tag--chapter">第 ' + q.chapter + ' 章 · ' + trackOf(q.chapter) + '</span>' +
          '<span class="quiz-tag quiz-tag--type">' + (q.type === 'choice' ? '选择题' : '判断题') + '</span>' +
          '<span class="quiz-tag">' + esc(q.topic) + '</span>' +
        '</div>' +

        '<p class="quiz-qtext">' + esc(q.q) + '</p>' +
        '<div class="quiz-options" role="group" aria-label="选项">' + optionsHtml + '</div>' +

        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn" data-quiz-act="prev"' + (state.index === 0 ? ' disabled' : '') + '>← 上一题</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="next"' + (state.index === total - 1 ? ' disabled' : '') + '>下一题 →</button>' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="submit">提交答卷</button>' +
          '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="quit">' + (isReview ? '退出重做' : '放弃本局') + '</button>' +
        '</div>' +
      '</div>' +
      noticeHtml();
  }

  /* ---------- 7.3 结果页 ---------- */
  function renderResult() {
    var r = state.result;
    var g = gradeOf(r.score);
    var isReview = r.mode === 'review';

    // 薄弱章节：按「第 N 章」聚合，直接给出回看链接
    var weak = {};
    r.details.forEach(function (d) {
      if (!d.ok) weak[d.q.chapter] = (weak[d.q.chapter] || 0) + 1;
    });
    var weakKeys = Object.keys(weak).sort(function (a, b) { return a - b; });
    var weakHtml = weakKeys.length
      ? '<div class="quiz-weak-box"><h4>需要回看的章节</h4><div class="quiz-weak-list">' +
          weakKeys.map(function (c) {
            return '<a class="quiz-weak" href="lesson-0' + c + '/">第 ' + c + ' 章 · ' + weak[c] +
              ' 题出错 <span aria-hidden="true">→</span></a>';
          }).join('') +
        '</div></div>'
      : '';

    var shown = r.details.map(function (d, i) { return { d: d, no: i + 1 }; })
      .filter(function (x) { return state.wrongOnly ? !x.d.ok : true; });

    var reviewHtml = shown.length
      ? '<ul class="quiz-review">' + shown.map(function (x) {
          var d = x.d;
          return '<li class="quiz-review-item ' + (d.ok ? 'is-ok' : 'is-bad') + '">' +
            '<div class="quiz-review-head">' +
              '<span class="quiz-review-no">' + x.no + '</span>' +
              '<span class="quiz-tag quiz-tag--chapter">第 ' + d.q.chapter + ' 章</span>' +
              '<span class="quiz-tag">' + esc(d.q.topic) + '</span>' +
              '<span class="quiz-review-flag">' + (d.ok ? '✓ 正确' : '✗ 错误') + '</span>' +
            '</div>' +
            '<p class="quiz-review-q">' + esc(d.q.q) + '</p>' +
            '<p class="quiz-review-line">你的答案：<b class="' + (d.ok ? 'is-ok' : 'is-bad') + '">' +
              esc(optionText(d.q, d.picked)) + '</b>' +
              (d.ok ? '' : '　正确答案：<b class="is-ok">' + esc(optionText(d.q, d.q.answer)) + '</b>') +
            '</p>' +
            '<p class="quiz-review-explain"><span>解析</span>' + esc(d.q.explain) + '</p>' +
          '</li>';
        }).join('') + '</ul>'
      : '<p class="quiz-empty">本局没有错题，很干净 🎉</p>';

    var wrongCount = Object.keys(wrongBook()).length;

    root.innerHTML =
      '<div class="quiz-card quiz-card--result">' +
        '<div class="quiz-result-top">' +
          '<div class="quiz-score is-' + g.level + '" style="--quiz-score:' + r.score + '" role="img"' +
            ' aria-label="得分 ' + r.score + ' 分">' +
            '<span class="quiz-score-num">' + r.score + '</span>' +
            '<span class="quiz-score-unit">分</span>' +
          '</div>' +
          '<div class="quiz-result-msg">' +
            '<h3 class="quiz-title">' + (isReview ? '错题重做完成 · ' : '本次成绩 · ') + g.text + '</h3>' +
            '<p class="quiz-result-meta">答对 <b>' + r.correct + '</b> / ' + r.total + ' 题 · 用时 ' +
              formatDuration(r.seconds) + (isReview ? ' · 重做不计入历史成绩' : '') + '</p>' +
            '<p class="quiz-result-hint">' + esc(g.hint) + '</p>' +
          '</div>' +
        '</div>' +
        weakHtml +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="start">再来一局</button>' +
          (state.wrongOnly
            ? '<button type="button" class="quiz-btn" data-quiz-act="toggle-wrong-only">查看全部解析</button>'
            : '<button type="button" class="quiz-btn" data-quiz-act="toggle-wrong-only"' +
              (r.correct === r.total ? ' disabled' : '') + '>只看错题</button>') +
          '<button type="button" class="quiz-btn" data-quiz-act="wrong">错题本' + badge(wrongCount) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="history">历史成绩</button>' +
        '</div>' +
      '</div>' +
      '<h4 class="quiz-subtitle">逐题解析</h4>' +
      reviewHtml;
  }

  /* ---------- 7.4 错题本 ---------- */
  function renderWrong() {
    var book = wrongBook();
    var ids = Object.keys(book).filter(function (id) { return !!findQuestion(id); });
    ids.sort(function (a, b) { return (book[b].lastAt || 0) - (book[a].lastAt || 0); });

    var listHtml = ids.length
      ? '<ul class="quiz-wrong-list">' + ids.map(function (id) {
          var raw = findQuestion(id);
          var q = toQuestion(raw, raw.options ? 'choice' : 'judge');
          var rec = book[id];
          var mine = (rec.myAnswer === undefined || rec.myAnswer === null)
            ? ''
            : '　上次你选：<b class="is-bad">' + esc(optionText(q, rec.myAnswer)) + '</b>';
          return '<li class="quiz-wrong-item">' +
            '<div class="quiz-review-head">' +
              '<span class="quiz-tag quiz-tag--chapter">第 ' + q.chapter + ' 章 · ' + trackOf(q.chapter) + '</span>' +
              '<span class="quiz-tag quiz-tag--type">' + (q.type === 'choice' ? '选择题' : '判断题') + '</span>' +
              '<span class="quiz-tag">' + esc(q.topic) + '</span>' +
              '<span class="quiz-wrong-count">错 ' + (rec.count || 1) + ' 次</span>' +
            '</div>' +
            '<p class="quiz-review-q">' + esc(q.q) + '</p>' +
            '<p class="quiz-review-line">正确答案：<b class="is-ok">' + esc(optionText(q, q.answer)) + '</b>' + mine + '</p>' +
            '<p class="quiz-review-explain"><span>解析</span>' + esc(q.explain) + '</p>' +
            '<div class="quiz-actions quiz-actions--tight">' +
              '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="remove-wrong" data-quiz-id="' +
                esc(id) + '">移出错题本</button>' +
              '<a class="quiz-btn quiz-btn--ghost" href="lesson-0' + q.chapter + '/">回看第 ' + q.chapter + ' 章</a>' +
            '</div>' +
          '</li>';
        }).join('') + '</ul>'
      : '<p class="quiz-empty">错题本是空的 —— 要么你答得不错，要么还没开始测验。</p>';

    root.innerHTML =
      '<div class="quiz-card">' +
        '<h3 class="quiz-title">错题本' + badge(ids.length) + '</h3>' +
        '<p class="quiz-desc">答错的题会自动收录在这里，下次答对时自动移出。记录只保存在本机浏览器（localStorage）。</p>' +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="review"' +
            (ids.length ? '' : ' disabled') + '>重做错题</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="start">开始新测验</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="history">历史成绩</button>' +
          '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="home">返回</button>' +
        '</div>' +
      '</div>' +
      noticeHtml() +
      listHtml;
  }

  /* ---------- 7.5 历史成绩 ---------- */
  function renderHistory() {
    var list = historyList();
    var count = list.length;
    var avg = count ? Math.round(list.reduce(function (s, r) { return s + (r.score || 0); }, 0) / count) : 0;
    var best = list.reduce(function (m, r) { return Math.max(m, r.score || 0); }, 0);

    var statsHtml = count
      ? '<div class="quiz-stats">' +
          '<div class="quiz-stat"><span class="quiz-stat-num">' + count + '</span><span class="quiz-stat-label">已完成测验</span></div>' +
          '<div class="quiz-stat"><span class="quiz-stat-num">' + avg + '</span><span class="quiz-stat-label">平均分</span></div>' +
          '<div class="quiz-stat"><span class="quiz-stat-num">' + best + '</span><span class="quiz-stat-label">最高分</span></div>' +
        '</div>'
      : '';

    var rowsHtml = count
      ? '<ol class="quiz-history">' + list.map(function (r, i) {
          var g = gradeOf(r.score || 0);
          return '<li class="quiz-history-item">' +
            '<span class="quiz-history-no">' + (count - i) + '</span>' +
            '<span class="quiz-history-time">' + formatTime(r.at || 0) + '</span>' +
            '<span class="quiz-history-score is-' + g.level + '">' + (r.score || 0) + ' 分</span>' +
            '<span class="quiz-history-detail">答对 ' + (r.correct || 0) + ' / ' + (r.total || 0) + ' 题</span>' +
            '<span class="quiz-history-detail">用时 ' + formatDuration(r.seconds || 0) + '</span>' +
          '</li>';
        }).join('') + '</ol>'
      : '<p class="quiz-empty">还没有成绩记录 —— 做一局测验就会自动记下来。</p>';

    root.innerHTML =
      '<div class="quiz-card">' +
        '<h3 class="quiz-title">历史成绩' + badge(count) + '</h3>' +
        '<p class="quiz-desc">只记录「随机测验」的成绩，重做错题不计入（避免刷分）；最多保留最近 ' +
          HISTORY_MAX + ' 次，数据只存在本机浏览器。</p>' +
        statsHtml +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="start">开始新测验</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="wrong">错题本</button>' +
          (count
            ? '<button type="button" class="quiz-btn quiz-btn--danger" data-quiz-act="clear-history">' +
              (state.confirmClear ? '确认清空全部记录？' : '清空成绩记录') + '</button>'
            : '') +
          '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="home">返回</button>' +
        '</div>' +
      '</div>' +
      noticeHtml() +
      rowsHtml;
  }

  /* =======================================================
   * 八、交互动作
   * ===================================================== */
  function pickOption(i) {
    if (isNaN(i)) return;
    state.answers[state.index] = i;
    state.notice = '';
    syncPick();
  }

  function gotoQuestion(i) {
    if (i < 0 || i >= state.paper.length) return;
    state.index = i;
    state.notice = '';
    renderQuestion();
  }

  function goHome() {
    state.phase = 'idle';
    state.mode = 'quiz';
    state.paper = [];
    state.answers = [];
    state.index = 0;
    state.result = null;
    state.wrongOnly = false;
    state.confirmClear = false;
    state.notice = '';
    render();
  }

  // 只挂一个委托监听：所有按钮都靠 data-quiz-act 分发，
  // 重新渲染后无需重新绑定（与 lesson-core.js 的 data-* 驱动风格一致）
  root.addEventListener('click', function (e) {
    var el = e.target;
    if (el && el.nodeType !== 1) el = el.parentElement;      // 兜底：点到了文本节点
    var btn = (el && el.closest) ? el.closest('[data-quiz-act]') : null;
    if (!btn || !root.contains(btn) || btn.disabled) return;

    var act = btn.getAttribute('data-quiz-act');

    if (act === 'start')  { startQuiz(); return; }
    if (act === 'pick')   { pickOption(Number(btn.getAttribute('data-quiz-index'))); return; }
    if (act === 'prev')   { gotoQuestion(state.index - 1); return; }
    if (act === 'next')   { gotoQuestion(state.index + 1); return; }
    if (act === 'submit') { submit(); return; }

    if (act === 'quit' || act === 'home') { goHome(); return; }

    if (act === 'wrong') {
      state.phase = 'wrong'; state.notice = ''; state.confirmClear = false; render(); return;
    }
    if (act === 'history') {
      state.phase = 'history'; state.notice = ''; state.confirmClear = false; render(); return;
    }
    if (act === 'review') { startReview(); return; }

    if (act === 'remove-wrong') {
      removeWrong(btn.getAttribute('data-quiz-id'));
      state.notice = '已从错题本移出。';
      renderWrong();
      return;
    }

    if (act === 'toggle-wrong-only') {
      state.wrongOnly = !state.wrongOnly;
      renderResult();
      return;
    }

    // 清空成绩记录：两步确认，避免误触（也不弹原生 confirm）
    if (act === 'clear-history') {
      if (!state.confirmClear) { state.confirmClear = true; renderHistory(); return; }
      writeStore(KEY_HISTORY, []);
      state.confirmClear = false;
      state.notice = '成绩记录已清空。';
      renderHistory();
      return;
    }
  });

  /* =======================================================
   * 九、启动
   * ===================================================== */
  render();
})();
