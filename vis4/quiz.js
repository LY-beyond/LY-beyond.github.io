// =========================================================
// quiz.js —— 章节测验 · 答题引擎（中文版；en 版由 P8 镜像）
// ---------------------------------------------------------
// 依赖：
//   quiz-data.js  →  window.QUIZ_BANK（26 道选择题 + 18 道判断题）
//   quiz.css      →  .quiz-* 模块样式（配色全部来自 tokens.css）
//
// 刻意用「普通 script（IIFE）」而不是 ES Module：
//   它在 file:// 下也能直接答题，不会被 CORS 拦下。
//
// 六项职责：
//   ① 出题：可选「题量（10 / 20 / 全部）」与「范围（全部章 / 指定单章）」
//           按章节均衡随机抽题，同一题不重复
//   ② 答题：单题流（上一题 / 下一题 / 进度条 / 未答引导），选项用 radio
//   ③ 判分：提交后一次性判分，给出总分、正确率、逐题解析、薄弱章节跳转
//   ④ 错题本：答错自动收录、答对自动移出、可一键重做（localStorage）
//   ⑤ 历史成绩：最近 20 次记录 + 平均分 / 最高分（localStorage）
//   ⑥ 得分环：内联 SVG circle + stroke-dasharray / dashoffset + CSS transition
//
// ⚠️ 前端方案的固有限制：答案随静态文件下发，F12 可见。
//    本系统定位为「自学自测」，不是防作弊的正式考试。
// =========================================================
(function () {
  'use strict';

  var root = document.getElementById('quiz-root');
  if (!root) return;

  var BANK = window.QUIZ_BANK;

  /* =======================================================
   * 一、配置
   * ===================================================== */
  var DEFAULT_SIZE = 10;     // 默认题量（可切到 20 / 全部）
  var HISTORY_MAX  = 20;     // 历史成绩最多保留 20 条
  var REVIEW_MAX   = 20;     // 一次最多重做 20 道错题
  var RING_R       = 52;     // 得分环半径（viewBox 120 × 120）
  var RING_C       = 2 * Math.PI * RING_R;      // 周长，用作 dasharray

  // 存储键：统一 vis4- 前缀，与门户 / 章节页的命名风格保持一致
  var KEY_WRONG    = 'vis4-quiz-wrong';
  var KEY_HISTORY  = 'vis4-quiz-history';
  var KEY_ACT      = 'vis4-activity';   // 每日活动计数（与 progress.js 同键同格式）

  /* =======================================================
   * 二、界面文案表
   *   · 默认值是中文；en/ 下由 en/quiz-ui.js 提供 window.QUIZ_UI 覆盖
   *   · 逻辑只写一份，中英不会各自漂移（与 lesson-core.js / i18n.js 同思路）
   *   · {xxx} 是占位符，由 t() 替换；漏译会显示 [key]，方便自检脚本发现
   * ===================================================== */
  var T = {
    /* ---- 通用 ---- */
    scoreUnit: '分',
    typeChoice: '选择题',
    typeJudge: '判断题',
    judgeTrue: '正确',
    judgeFalse: '错误',
    unanswered: '未作答',
    listSep: '、',
    durationMin: '{m} 分 {s} 秒',
    durationSec: '{s} 秒',

    /* ---- 章名（第 6 章是专题） ---- */
    ch1: '第 1 章 数据 · 属性与通道',
    ch2: '第 2 章 流程 · 数据流与自动化',
    ch3: '第 3 章 色彩 · 颜色空间与 colormap',
    ch4: '第 4 章 低维 · 平行坐标与散点矩阵',
    ch5: '第 5 章 时序 · 日历热图与螺旋',
    ch6: '专题 · 选图指南',

    /* ---- 评级 ---- */
    gradeBest: '优秀',
    gradeBestHint: '知识点掌握得很扎实 —— 可以回到章节页做完整回顾了。',
    gradeGood: '良好',
    gradeGoodHint: '主干已经清楚，把错题解析再过一遍就更稳了。',
    gradePass: '合格',
    gradePassHint: '刚刚及格，仍有明显漏洞，建议按下面的薄弱章节回看。',
    gradeLow: '需要复习',
    gradeLowHint: '先把相关章节读一遍，再回来重做错题本。',

    /* ---- 起始页 ---- */
    idleTitle: '章节测验 · {n} 题',
    idleDesc: '题库覆盖 5 章正文与「选图指南」专题，共 {bank} 道题（{choice} 道选择题 + {judge} 道判断题）。先选好题量与范围，系统再按章节均衡随机抽题。',
    sizeLabel: '题量',
    size10: '10 题',
    size20: '20 题',
    sizeAll: '全部（{n} 题）',
    scopeLabel: '范围',
    scopeAll: '全部章 + 专题',
    idleRuleScore: '按章节均衡抽题：尽量覆盖更多章节，同一题不重复',
    idleRuleShuffle: '选项顺序会打乱，答案下标随之重算；界面不显示字母',
    idleRuleJudge: '提交后一次性判分，给出总分、正确率、逐题解析与薄弱章节跳转',
    idleRuleWrong: '答错的题自动进入「错题本」，之后答对会自动移出',
    idleRuleHistory: '已记录 {n} 次成绩，最高 {best} 分',
    idleRuleLocal: '成绩只保存在本机浏览器（localStorage），换设备不会同步',
    btnStart: '开始答题',
    btnWrongBook: '错题本',
    btnHistory: '历史成绩',

    /* ---- 答题页 ---- */
    modeReview: '错题重做',
    modeQuiz: '章节测验',
    progress: '{mode} · 第 <b>{i}</b> / {total} 题',
    answeredCount: '已答 {n} / {total}',
    ariaOptions: '选项',
    btnPrev: '← 上一题',
    btnNext: '下一题 →',
    btnSubmit: '提交答卷',
    btnQuitReview: '退出重做',
    btnQuitQuiz: '放弃本局',

    /* ---- 结果页 ---- */
    resultTitleReview: '错题重做完成 · {grade}',
    resultTitleQuiz: '本次成绩 · {grade}',
    resultMeta: '答对 <b>{correct}</b> / {total} 题 · 正确率 {rate}% · 用时 {duration}',
    resultMetaReview: ' · 重做不计入历史成绩',
    weakTitle: '需要回看的章节',
    weakItem: '{name} · {n} 题出错',
    flagOk: '✓ 正确',
    flagBad: '✗ 错误',
    yourAnswer: '所选答案：',
    correctAnswer: '正确答案：',
    answerSep: '　',
    explainTag: '解析',
    resultEmpty: '本局没有错题，很干净。',
    btnAgain: '再来一局',
    btnSeeAll: '查看全部解析',
    btnOnlyWrong: '只看错题',
    subtitleReview: '逐题解析',
    ariaScore: '得分 {n} 分',

    /* ---- 错题本 ---- */
    wrongTitle: '错题本',
    wrongDesc: '答错的题会自动收录在这里，下次答对时自动移出。记录只保存在本机浏览器（localStorage）。',
    btnRedoWrong: '重做错题',
    btnNewQuiz: '开始新测验',
    btnBack: '返回',
    lastPick: '　上次选择：',
    wrongCount: '错 {n} 次',
    btnRemove: '移出错题本',
    btnBackToChapter: '回看：{name}',
    wrongEmpty: '错题本是空的 —— 要么答得不错，要么还没开始测验。',

    /* ---- 历史成绩 ---- */
    historyTitle: '历史成绩',
    historyDesc: '只记录「章节测验」的成绩，重做错题不计入（避免刷分）；最多保留最近 {max} 次，数据只存在本机浏览器。',
    statRuns: '已完成测验',
    statAvg: '平均分',
    statBest: '最高分',
    historyCorrect: '答对 {c} / {t} 题',
    historyDuration: '用时 {d}',
    historyEmpty: '还没有成绩记录 —— 做一局测验就会自动记下来。',
    btnClear: '清空成绩记录',
    btnClearConfirm: '确认清空全部记录？',

    /* ---- 动态提示 ---- */
    noticeUnanswered: '还有 {n} 题未作答（第 {list} 题），已跳到第一道未答题。',
    noticeRemoved: '已从错题本移出。',
    noticeCleared: '成绩记录已清空。',
    noticeReviewEmpty: '错题本是空的 —— 先在测验里答几题吧。',
    noticeScopeShort: '「{name}」可用题目不足 {n} 道，已按实际题量抽取。',
    bankError: '题库加载失败：请确认 quiz-data.js 已在 quiz.js 之前引入。'
  };

  var UI = (window.QUIZ_UI && typeof window.QUIZ_UI === 'object') ? window.QUIZ_UI : {};

  // 取词：优先覆盖表，其次默认表；漏译时直接暴露 key
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

  var JUDGE_OPTIONS = [t('judgeTrue'), t('judgeFalse')];   // 判断题固定顺序，不参与洗牌

  // 题库校验放在文案表之后，这样出错提示也能跟着语言走
  if (!BANK || !BANK.choice || !BANK.judge) {
    root.innerHTML = '<p class="quiz-empty">' + esc(t('bankError')) + '</p>';
    return;
  }

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
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function chapterName(c) {
    return t('ch' + c);
  }

  // 第 1–5 章 → 对应章节页；第 6 章 → 「选图指南」专题页
  function chapterLink(c) {
    return c === 6 ? 'topic-chart-guide/' : 'lesson-0' + c + '/';
  }

  /* =======================================================
   * 四、抽题
   * ===================================================== */

  // 按章分桶 → 打乱桶序 → 轮流从每桶取 1 题 → 不够再从剩余里补
  // 目的：纯随机会出现「抽到的题全落在同一章」，那样测验就失去检验意义了
  function pickBalanced(pool, n) {
    if (n <= 0 || !pool.length) return [];
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

  // 按题库比例把总题量拆成「选择题 + 判断题」，并受可用池上限约束
  function splitCounts(n, cLen, jLen) {
    if (n === 0) return { choice: cLen, judge: jLen };   // 0 = 全部
    var ratio = BANK.choice.length / (BANK.choice.length + BANK.judge.length);
    var c = Math.min(Math.round(n * ratio), cLen);
    var j = Math.min(n - c, jLen);
    if (c + j < n) c = Math.min(n - j, cLen);            // 判断题不够时用选择题补齐
    return { choice: c, judge: j };
  }

  // 把两种题型统一成同一种「可渲染结构」，渲染与判分因此只需写一份
  //   choice：选项顺序也打乱，防止靠「答案总在同一位置」蒙对
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

  function buildPaper(size, scope) {
    var cp = scope ? BANK.choice.filter(function (q) { return q.chapter === scope; }) : BANK.choice.slice();
    var jp = scope ? BANK.judge.filter(function (q) { return q.chapter === scope; }) : BANK.judge.slice();
    var want = splitCounts(size, cp.length, jp.length);

    var paper = pickBalanced(cp, want.choice).map(function (q) { return toQuestion(q, 'choice'); })
      .concat(pickBalanced(jp, want.judge).map(function (q) { return toQuestion(q, 'judge'); }));
    // 合并后再洗一次：避免题序永远是「先选择题、后判断题」
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
   * 五、状态
   * ===================================================== */
  var state = {
    phase: 'idle',        // idle | answering | result | wrong | history
    mode: 'quiz',         // quiz = 正式测验（计入历史）；review = 重做错题（不计入）
    size: DEFAULT_SIZE,   // 起始页选择的题量（0 = 全部）
    scope: 0,             // 起始页选择的范围（0 = 全部章）
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

  // 学习动作计数：与 progress.js 的 vis4-activity 同键同格式（首页热力图数据源）。
  // quiz.js 是普通脚本无法 import ES Module，故就地实现一份，两边互不依赖。
  // pad2 是函数声明（第六节），存在变量提升，这里可以直接调用。
  function bumpActivity() {
    var all = readStore(KEY_ACT, {});
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    var d = new Date();
    var day = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    all[day] = (all[day] || 0) + 1;
    writeStore(KEY_ACT, all);
  }

  /* =======================================================
   * 六、时间 / 评级
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
    return m > 0 ? t('durationMin', { m: m, s: s }) : t('durationSec', { s: s });
  }

  function gradeOf(score) {
    if (score >= 90) return { text: t('gradeBest'), level: 'best', hint: t('gradeBestHint') };
    if (score >= 70) return { text: t('gradeGood'), level: 'good', hint: t('gradeGoodHint') };
    if (score >= 60) return { text: t('gradePass'), level: 'pass', hint: t('gradePassHint') };
    return { text: t('gradeLow'), level: 'low', hint: t('gradeLowHint') };
  }

  function optionText(q, idx) {
    if (idx === null || idx === undefined || idx < 0) return t('unanswered');
    return q.options[idx];
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
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      /* 老浏览器不支持 options：直接忽略 */
    }
  }

  /* =======================================================
   * 七、开局 / 判分
   * ===================================================== */
  function beginPaper(paper, mode, notice) {
    state.mode = mode;
    state.paper = paper;
    state.answers = paper.map(function () { return null; });
    state.index = 0;
    state.startedAt = Date.now();
    state.result = null;
    state.wrongOnly = false;
    state.notice = notice || '';
    state.phase = 'answering';
    render();
    scrollToQuiz();
  }

  function startQuiz() {
    var paper = buildPaper(state.size, state.scope);
    var notice = '';
    if (state.size && paper.length < state.size) {
      notice = t('noticeScopeShort', { name: chapterName(state.scope), n: state.size });
    }
    beginPaper(paper, 'quiz', notice);
  }

  // 重做错题：按最近答错排序取最多 REVIEW_MAX 道；结果不写入历史成绩
  function startReview() {
    var book = wrongBook();
    var ids = Object.keys(book).filter(function (id) { return !!findQuestion(id); });
    if (!ids.length) {
      state.notice = t('noticeReviewEmpty');
      renderWrong();
      return;
    }
    ids.sort(function (a, b) { return (book[b].lastAt || 0) - (book[a].lastAt || 0); });

    var paper = ids.slice(0, REVIEW_MAX).map(function (id) {
      var raw = findQuestion(id);
      return toQuestion(raw, raw.options ? 'choice' : 'judge');
    });
    beginPaper(shuffled(paper), 'review', '');
  }

  function submit() {
    var unanswered = [];
    state.answers.forEach(function (a, i) {
      if (a === null || a === undefined) unanswered.push(i + 1);
    });
    if (unanswered.length) {
      state.notice = t('noticeUnanswered', {
        n: unanswered.length,
        list: unanswered.join(t('listSep'))
      });
      state.index = unanswered[0] - 1;
      renderQuestion();
      return;
    }

    var details = state.paper.map(function (q, i) {
      return { q: q, picked: state.answers[i], ok: state.answers[i] === q.answer };
    });
    var correct = details.filter(function (d) { return d.ok; }).length;
    var total = details.length;
    // 得分按百分比计算：总分 0–100，便于与「10 题 / 20 题 / 全部」不同题量横向比较
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
        rec.chapter = d.q.chapter;      // 章节归属：门户「学习画像」雷达按章统计薄弱点
        rec.count = (rec.count || 0) + 1;
        rec.lastAt = Date.now();
        rec.myAnswer = d.picked;
        book[d.q.id] = rec;
      }
    });
    writeStore(KEY_WRONG, book);
    bumpActivity();   // 一次完整的答题提交 = 一次学习动作

    // 历史成绩：只记正式测验
    if (state.mode === 'quiz') {
      var list = historyList();
      list.unshift({ at: Date.now(), score: score, correct: correct, total: total, seconds: seconds });
      writeStore(KEY_HISTORY, list.slice(0, HISTORY_MAX));
    }

    state.result = {
      details: details, correct: correct, total: total,
      score: score, seconds: seconds, mode: state.mode
    };
    state.phase = 'result';
    state.wrongOnly = false;
    state.notice = '';
    render();
    scrollToQuiz();
  }

  // 选中某个选项后只做局部更新：不重建 DOM，键盘焦点不会丢
  function syncPick() {
    var picked = state.answers[state.index];
    var opts = root.querySelectorAll('.quiz-option');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('is-picked', i === picked);
    }

    var total = state.paper.length;
    var answered = state.answers.filter(function (a) { return a !== null && a !== undefined; }).length;
    var progress = Math.round(answered / total * 100);

    var count = root.querySelector('.quiz-progress-count');
    if (count) count.textContent = t('answeredCount', { n: answered, total: total });

    var bar = root.querySelector('.quiz-progress-bar span');
    if (bar) bar.style.width = progress + '%';

    var track = root.querySelector('.quiz-progress-bar');
    if (track) track.setAttribute('aria-valuenow', String(progress));
  }

  /* =======================================================
   * 八、视图渲染
   * ===================================================== */
  function render() {
    if (state.phase === 'answering') { renderQuestion(); return; }
    if (state.phase === 'result')    { renderResult();   return; }
    if (state.phase === 'wrong')     { renderWrong();    return; }
    if (state.phase === 'history')   { renderHistory();  return; }
    renderIdle();
  }

  // 起始页的配置单选组：题量 / 范围
  function sizeOptionsHtml() {
    var opts = [
      { v: 10, key: 'size10' },
      { v: 20, key: 'size20' },
      { v: 0,  key: 'sizeAll' }
    ];
    return opts.map(function (o) {
      var label = o.v === 0
        ? t('sizeAll', { n: BANK.choice.length + BANK.judge.length })
        : t(o.key);
      return '<label class="quiz-radio"><input type="radio" name="quiz-size" value="' + o.v + '"' +
        (state.size === o.v ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
    }).join('');
  }

  function scopeOptionsHtml() {
    var opts = [{ v: 0, label: t('scopeAll') }];
    for (var c = 1; c <= 6; c++) opts.push({ v: c, label: chapterName(c) });
    return opts.map(function (o) {
      return '<label class="quiz-radio"><input type="radio" name="quiz-scope" value="' + o.v + '"' +
        (state.scope === o.v ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>';
    }).join('');
  }

  /* ---------- 8.1 起始页 ---------- */
  function renderIdle() {
    var book = wrongBook();
    var wrongCount = Object.keys(book).filter(function (id) { return !!findQuestion(id); }).length;
    var list = historyList();
    var best = list.reduce(function (max, r) { return Math.max(max, r.score || 0); }, 0);
    var totalQ = state.size === 0 ? (BANK.choice.length + BANK.judge.length) : state.size;

    root.innerHTML =
      '<div class="quiz-card quiz-card--intro">' +
        '<h3 class="quiz-title">' + esc(t('idleTitle', { n: totalQ })) + '</h3>' +
        '<p class="quiz-desc">' + t('idleDesc', {
          bank: BANK.choice.length + BANK.judge.length,
          choice: BANK.choice.length,
          judge: BANK.judge.length
        }) + '</p>' +
        '<div class="quiz-config">' +
          '<fieldset class="quiz-field">' +
            '<legend>' + esc(t('sizeLabel')) + '</legend>' +
            '<div class="quiz-choices">' + sizeOptionsHtml() + '</div>' +
          '</fieldset>' +
          '<fieldset class="quiz-field">' +
            '<legend>' + esc(t('scopeLabel')) + '</legend>' +
            '<div class="quiz-choices quiz-choices--scope">' + scopeOptionsHtml() + '</div>' +
          '</fieldset>' +
        '</div>' +
        '<ul class="quiz-rules">' +
          '<li>' + esc(t('idleRuleScore')) + '</li>' +
          '<li>' + esc(t('idleRuleShuffle')) + '</li>' +
          '<li>' + esc(t('idleRuleJudge')) + '</li>' +
          '<li>' + esc(t('idleRuleWrong')) + '</li>' +
          (list.length
            ? '<li>' + esc(t('idleRuleHistory', { n: list.length, best: best })) + '</li>'
            : '<li>' + esc(t('idleRuleLocal')) + '</li>') +
        '</ul>' +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="start">' + esc(t('btnStart')) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="wrong">' + esc(t('btnWrongBook')) + badge(wrongCount) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="history">' + esc(t('btnHistory')) + badge(list.length) + '</button>' +
        '</div>' +
      '</div>' +
      noticeHtml();
  }

  /* ---------- 8.2 答题页 ---------- */
  function renderQuestion() {
    var q = state.paper[state.index];
    var picked = state.answers[state.index];
    var total = state.paper.length;
    var answered = state.answers.filter(function (a) { return a !== null && a !== undefined; }).length;
    var progress = Math.round(answered / total * 100);
    var isReview = state.mode === 'review';

    var optionsHtml = q.options.map(function (text, i) {
      var on = picked === i;
      return '<label class="quiz-option' + (on ? ' is-picked' : '') + '">' +
        '<input type="radio" name="quiz-answer" value="' + i + '"' + (on ? ' checked' : '') + '>' +
        '<span class="quiz-option-text">' + esc(text) + '</span>' +
      '</label>';
    }).join('');

    var modeLabel = isReview ? t('modeReview') : t('modeQuiz');

    root.innerHTML =
      '<div class="quiz-card">' +
        '<div class="quiz-progress">' +
          '<div class="quiz-progress-head">' +
            '<span>' + t('progress', { mode: modeLabel, i: state.index + 1, total: total }) + '</span>' +
            '<span class="quiz-progress-count">' + esc(t('answeredCount', { n: answered, total: total })) + '</span>' +
          '</div>' +
          '<div class="quiz-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"' +
            ' aria-valuenow="' + progress + '"><span style="width:' + progress + '%"></span></div>' +
        '</div>' +

        '<div class="quiz-qmeta">' +
          '<span class="quiz-tag quiz-tag--chapter">' + esc(chapterName(q.chapter)) + '</span>' +
          '<span class="quiz-tag quiz-tag--type">' + esc(q.type === 'choice' ? t('typeChoice') : t('typeJudge')) + '</span>' +
          '<span class="quiz-tag">' + esc(q.topic) + '</span>' +
        '</div>' +

        '<p class="quiz-qtext">' + esc(q.q) + '</p>' +
        '<div class="quiz-options" role="radiogroup" aria-label="' + esc(t('ariaOptions')) + '">' + optionsHtml + '</div>' +

        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn" data-quiz-act="prev"' + (state.index === 0 ? ' disabled' : '') + '>' +
            esc(t('btnPrev')) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="next"' + (state.index === total - 1 ? ' disabled' : '') + '>' +
            esc(t('btnNext')) + '</button>' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="submit">' + esc(t('btnSubmit')) + '</button>' +
          '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="quit">' +
            esc(isReview ? t('btnQuitReview') : t('btnQuitQuiz')) + '</button>' +
        '</div>' +
      '</div>' +
      noticeHtml();
  }

  /* ---------- 8.3 结果页 ---------- */
  function renderResult() {
    var r = state.result;
    var g = gradeOf(r.score);
    var isReview = r.mode === 'review';
    var rate = r.total ? Math.round(r.correct / r.total * 100) : 0;

    // 薄弱章节：按章聚合，直接给出回看链接（第 6 章指向选图指南专题）
    var weak = {};
    r.details.forEach(function (d) {
      if (!d.ok) weak[d.q.chapter] = (weak[d.q.chapter] || 0) + 1;
    });
    var weakKeys = Object.keys(weak).sort(function (a, b) { return a - b; });
    var weakHtml = weakKeys.length
      ? '<div class="quiz-weak-box"><h4>' + esc(t('weakTitle')) + '</h4><div class="quiz-weak-list">' +
          weakKeys.map(function (c) {
            return '<a class="quiz-weak" href="' + chapterLink(Number(c)) + '">' +
              esc(t('weakItem', { name: chapterName(Number(c)), n: weak[c] })) +
              ' <span aria-hidden="true">→</span></a>';
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
              '<span class="quiz-tag quiz-tag--chapter">' + esc(chapterName(d.q.chapter)) + '</span>' +
              '<span class="quiz-tag">' + esc(d.q.topic) + '</span>' +
              '<span class="quiz-review-flag">' + esc(d.ok ? t('flagOk') : t('flagBad')) + '</span>' +
            '</div>' +
            '<p class="quiz-review-q">' + esc(d.q.q) + '</p>' +
            '<p class="quiz-review-line">' + esc(t('yourAnswer')) +
              '<b class="' + (d.ok ? 'is-ok' : 'is-bad') + '">' + esc(optionText(d.q, d.picked)) + '</b>' +
              (d.ok ? '' : esc(t('answerSep')) + esc(t('correctAnswer')) + '<b class="is-ok">' +
                esc(optionText(d.q, d.q.answer)) + '</b>') +
            '</p>' +
            '<p class="quiz-review-explain"><span>' + esc(t('explainTag')) + '</span>' + esc(d.q.explain) + '</p>' +
          '</li>';
        }).join('') + '</ul>'
      : '<p class="quiz-empty">' + esc(t('resultEmpty')) + '</p>';

    var wrongCount = Object.keys(wrongBook()).length;

    root.innerHTML =
      '<div class="quiz-card quiz-card--result">' +
        '<div class="quiz-result-top">' +
          '<div class="quiz-score is-' + g.level + '" style="--quiz-score:' + r.score + '">' +
            '<svg class="quiz-score-ring" viewBox="0 0 120 120" role="img" aria-label="' +
              esc(t('ariaScore', { n: r.score })) + '">' +
              '<circle class="quiz-score-track" cx="60" cy="60" r="' + RING_R + '"></circle>' +
              '<circle class="quiz-score-fill" cx="60" cy="60" r="' + RING_R + '" ' +
                'style="stroke-dasharray:' + RING_C.toFixed(2) + ';stroke-dashoffset:' + RING_C.toFixed(2) + '"></circle>' +
            '</svg>' +
            '<span class="quiz-score-num">' + r.score + '</span>' +
            '<span class="quiz-score-unit">' + esc(t('scoreUnit')) + '</span>' +
          '</div>' +
          '<div class="quiz-result-msg">' +
            '<h3 class="quiz-title">' +
              t(isReview ? 'resultTitleReview' : 'resultTitleQuiz', { grade: esc(g.text) }) + '</h3>' +
            '<p class="quiz-result-meta">' +
              t('resultMeta', { correct: r.correct, total: r.total, rate: rate, duration: formatDuration(r.seconds) }) +
              (isReview ? esc(t('resultMetaReview')) : '') + '</p>' +
            '<p class="quiz-result-hint">' + esc(g.hint) + '</p>' +
          '</div>' +
        '</div>' +
        weakHtml +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="start">' + esc(t('btnAgain')) + '</button>' +
          (state.wrongOnly
            ? '<button type="button" class="quiz-btn" data-quiz-act="toggle-wrong-only">' + esc(t('btnSeeAll')) + '</button>'
            : '<button type="button" class="quiz-btn" data-quiz-act="toggle-wrong-only"' +
              (r.correct === r.total ? ' disabled' : '') + '>' + esc(t('btnOnlyWrong')) + '</button>') +
          '<button type="button" class="quiz-btn" data-quiz-act="wrong">' + esc(t('btnWrongBook')) + badge(wrongCount) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="history">' + esc(t('btnHistory')) + '</button>' +
        '</div>' +
      '</div>' +
      '<h4 class="quiz-subtitle">' + esc(t('subtitleReview')) + '</h4>' +
      reviewHtml;

    // 得分环：先画成「空的」，下一帧再靠 CSS transition 增长到目标弧长
    // —— 不用 requestAnimationFrame（全站约束），只用 setTimeout + CSS
    var fill = root.querySelector('.quiz-score-fill');
    if (fill) {
      setTimeout(function () {
        fill.style.strokeDashoffset = (RING_C * (1 - r.score / 100)).toFixed(2);
      }, 60);
    }
  }

  /* ---------- 8.4 错题本 ---------- */
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
            : esc(t('lastPick')) + '<b class="is-bad">' + esc(optionText(q, rec.myAnswer)) + '</b>';
          return '<li class="quiz-wrong-item">' +
            '<div class="quiz-review-head">' +
              '<span class="quiz-tag quiz-tag--chapter">' + esc(chapterName(q.chapter)) + '</span>' +
              '<span class="quiz-tag quiz-tag--type">' + esc(q.type === 'choice' ? t('typeChoice') : t('typeJudge')) + '</span>' +
              '<span class="quiz-tag">' + esc(q.topic) + '</span>' +
              '<span class="quiz-wrong-count">' + esc(t('wrongCount', { n: rec.count || 1 })) + '</span>' +
            '</div>' +
            '<p class="quiz-review-q">' + esc(q.q) + '</p>' +
            '<p class="quiz-review-line">' + esc(t('correctAnswer')) +
              '<b class="is-ok">' + esc(optionText(q, q.answer)) + '</b>' + mine + '</p>' +
            '<p class="quiz-review-explain"><span>' + esc(t('explainTag')) + '</span>' + esc(q.explain) + '</p>' +
            '<div class="quiz-actions quiz-actions--tight">' +
              '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="remove-wrong" data-quiz-id="' +
                esc(id) + '">' + esc(t('btnRemove')) + '</button>' +
              '<a class="quiz-btn quiz-btn--ghost" href="' + chapterLink(q.chapter) + '">' +
                esc(t('btnBackToChapter', { name: chapterName(q.chapter) })) + '</a>' +
            '</div>' +
          '</li>';
        }).join('') + '</ul>'
      : '<p class="quiz-empty">' + esc(t('wrongEmpty')) + '</p>';

    root.innerHTML =
      '<div class="quiz-card">' +
        '<h3 class="quiz-title">' + esc(t('wrongTitle')) + badge(ids.length) + '</h3>' +
        '<p class="quiz-desc">' + esc(t('wrongDesc')) + '</p>' +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="review"' +
            (ids.length ? '' : ' disabled') + '>' + esc(t('btnRedoWrong')) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="start">' + esc(t('btnNewQuiz')) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="history">' + esc(t('btnHistory')) + '</button>' +
          '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="home">' + esc(t('btnBack')) + '</button>' +
        '</div>' +
      '</div>' +
      noticeHtml() +
      listHtml;
  }

  /* ---------- 8.5 历史成绩 ---------- */
  function renderHistory() {
    var list = historyList();
    var count = list.length;
    var avg = count ? Math.round(list.reduce(function (s, r) { return s + (r.score || 0); }, 0) / count) : 0;
    var best = list.reduce(function (m, r) { return Math.max(m, r.score || 0); }, 0);

    var statsHtml = count
      ? '<div class="quiz-stats">' +
          '<div class="quiz-stat"><span class="quiz-stat-num">' + count + '</span><span class="quiz-stat-label">' +
            esc(t('statRuns')) + '</span></div>' +
          '<div class="quiz-stat"><span class="quiz-stat-num">' + avg + '</span><span class="quiz-stat-label">' +
            esc(t('statAvg')) + '</span></div>' +
          '<div class="quiz-stat"><span class="quiz-stat-num">' + best + '</span><span class="quiz-stat-label">' +
            esc(t('statBest')) + '</span></div>' +
        '</div>'
      : '';

    var rowsHtml = count
      ? '<ol class="quiz-history">' + list.map(function (r, i) {
          var g = gradeOf(r.score || 0);
          return '<li class="quiz-history-item">' +
            '<span class="quiz-history-no">' + (count - i) + '</span>' +
            '<span class="quiz-history-time">' + formatTime(r.at || 0) + '</span>' +
            '<span class="quiz-history-score is-' + g.level + '">' + (r.score || 0) + ' ' +
              esc(t('scoreUnit')) + '</span>' +
            '<span class="quiz-history-detail">' +
              esc(t('historyCorrect', { c: r.correct || 0, t: r.total || 0 })) + '</span>' +
            '<span class="quiz-history-detail">' +
              esc(t('historyDuration', { d: formatDuration(r.seconds || 0) })) + '</span>' +
          '</li>';
        }).join('') + '</ol>'
      : '<p class="quiz-empty">' + esc(t('historyEmpty')) + '</p>';

    root.innerHTML =
      '<div class="quiz-card">' +
        '<h3 class="quiz-title">' + esc(t('historyTitle')) + badge(count) + '</h3>' +
        '<p class="quiz-desc">' + esc(t('historyDesc', { max: HISTORY_MAX })) + '</p>' +
        statsHtml +
        '<div class="quiz-actions">' +
          '<button type="button" class="quiz-btn quiz-btn--primary" data-quiz-act="start">' + esc(t('btnNewQuiz')) + '</button>' +
          '<button type="button" class="quiz-btn" data-quiz-act="wrong">' + esc(t('btnWrongBook')) + '</button>' +
          (count
            ? '<button type="button" class="quiz-btn quiz-btn--danger" data-quiz-act="clear-history">' +
              esc(state.confirmClear ? t('btnClearConfirm') : t('btnClear')) + '</button>'
            : '') +
          '<button type="button" class="quiz-btn quiz-btn--ghost" data-quiz-act="home">' + esc(t('btnBack')) + '</button>' +
        '</div>' +
      '</div>' +
      noticeHtml() +
      rowsHtml;
  }

  /* =======================================================
   * 九、交互动作
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

  // 选项用 radio：change 事件委托在容器上，重渲染后无需重新绑定
  root.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (el.name === 'quiz-size')  { state.size  = Number(el.value); return; }
    if (el.name === 'quiz-scope') { state.scope = Number(el.value); return; }
    if (el.name === 'quiz-answer') { pickOption(Number(el.value)); }
  });

  // 只挂一个委托监听：所有按钮都靠 data-quiz-act 分发，
  // 重新渲染后无需重新绑定（与 lesson-core.js 的 data-* 驱动风格一致）
  root.addEventListener('click', function (e) {
    var el = e.target;
    if (el && el.nodeType !== 1) el = el.parentElement;      // 兜底：点到了文本节点
    var btn = (el && el.closest) ? el.closest('[data-quiz-act]') : null;
    if (!btn || !root.contains(btn) || btn.disabled) return;

    var act = btn.getAttribute('data-quiz-act');

    if (act === 'start')  { startQuiz(); return; }
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
      state.notice = t('noticeRemoved');
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
      state.notice = t('noticeCleared');
      renderHistory();
      return;
    }
  });

  /* =======================================================
   * 十、启动（支持门户「学习画像」卡深链：
   *      quiz.html#review → 直接重做错题；quiz.html#wrong → 打开错题本）
   * ===================================================== */
  var entryHash = (location.hash || '').replace(/^#/, '');
  render();
  if (entryHash === 'review') {
    startReview();                 // 错题本为空时自动给出提示并转入错题本视图
  } else if (entryHash === 'wrong') {
    state.phase = 'wrong';
    state.notice = '';
    render();
  }
})();
