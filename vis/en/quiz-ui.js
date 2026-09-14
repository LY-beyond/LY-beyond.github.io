// =========================================================
// en/quiz-ui.js —— 答题系统界面文案（英文覆盖表）
// ---------------------------------------------------------
// 引擎只有一份（../quiz.js），默认文案是中文；本文件提供 window.QUIZ_UI
// 覆盖成英文。这样逻辑改一处、中英不会各自漂移。
// 键名必须与 quiz.js 里的 T 表逐一对齐（少一个键会在页面上露出 [key]，便于发现）。
// 只在 en/index.html 里引入，且必须在 ../quiz.js 之前。
// =========================================================
window.QUIZ_UI = {

  /* ---- 通用 ---- */
  chapterLabel: 'Chapter {n}',
  typeChoice: 'Multiple choice',
  typeJudge: 'True / false',
  judgeTrue: 'True',
  judgeFalse: 'False',
  scoreUnit: 'pts',
  unanswered: 'Not answered',
  listSep: ', ',
  durationMin: '{m} min {s} s',
  durationSec: '{s} s',

  /* ---- 三个篇 ---- */
  trackDesign: 'Design track',
  trackImpl: 'Implementation track',
  trackCapstone: 'Capstone',

  /* ---- 评级 ---- */
  gradeBest: 'Excellent',
  gradeBestHint: 'A very solid grasp of the concepts — you are ready for the full Chapter 9 build.',
  gradeGood: 'Good',
  gradeGoodHint: 'The essentials are in place; go over the explanations of what you missed and it will stick.',
  gradePass: 'Pass',
  gradePassHint: 'A pass, but there are real gaps — review the weak chapters listed below.',
  gradeLow: 'Needs review',
  gradeLowHint: 'Read the Explanation tab of the relevant chapters first, then come back and redo the wrong-answer list.',

  /* ---- 起始页 ---- */
  idleTitle: 'Random quiz · {n} questions',
  idleDesc: 'The bank covers every concept in the 9 chapters: {bank} questions in total '
    + '({choice} multiple-choice + {judge} true/false). Each round draws <strong>{pick} multiple-choice</strong> '
    + 'and <strong>{pickJudge} true/false</strong> questions, spread across chapters as evenly as possible.',
  idleRuleScore: '{n} questions, {per} pts each, {full} pts in total',
  idleRuleJudge: 'Graded the moment you submit, with per-question explanations and links to weak chapters',
  idleRuleWrong: 'Wrong answers go to the wrong-answer list automatically, and leave it once you get them right',
  idleRuleHistory: '{n} attempts recorded so far, best score {best}',
  idleRuleLocal: 'Scores are stored in this browser only (localStorage) — they do not follow you to another device',
  btnStart: 'Start the quiz',
  btnWrongBook: 'Wrong answers',
  btnHistory: 'Score history',

  /* ---- 答题页 ---- */
  modeReview: 'Redoing wrong answers',
  modeQuiz: 'Random quiz',
  progress: '{mode} · question <b>{i}</b> / {total}',
  answeredCount: 'Answered {n} / {total}',
  ariaOptions: 'Options',
  btnPrev: '← Previous',
  btnNext: 'Next →',
  btnSubmit: 'Submit answers',
  btnQuitReview: 'Quit the redo',
  btnQuitQuiz: 'Give up this round',

  /* ---- 结果页 ---- */
  resultTitleReview: 'Redo finished · {grade}',
  resultTitleQuiz: 'This round · {grade}',
  resultMeta: '<b>{correct}</b> / {total} correct · {duration}',
  resultMetaReview: ' · redos are not recorded in your history',
  weakTitle: 'Chapters worth revisiting',
  weakItem: 'Chapter {chapter} · {n} wrong',
  flagOk: '✓ Correct',
  flagBad: '✗ Wrong',
  yourAnswer: 'Your answer: ',
  correctAnswer: 'Correct answer: ',
  answerSep: ' · ',
  explainTag: 'Explanation',
  resultEmpty: 'No wrong answers this round — spotless 🎉',
  btnAgain: 'Play again',
  btnSeeAll: 'Show all explanations',
  btnOnlyWrong: 'Wrong ones only',
  subtitleReview: 'Question-by-question review',
  ariaScore: 'Score {n} points',

  /* ---- 错题本 ---- */
  wrongTitle: 'Wrong-answer list',
  wrongDesc: 'Questions you missed are collected here, and leave the list automatically once you answer them '
    + 'correctly. Stored in this browser only (localStorage).',
  btnRedoWrong: 'Redo wrong answers',
  btnNewQuiz: 'Start a new quiz',
  btnBack: 'Back',
  lastPick: ' · Last time you chose: ',
  wrongCount: '{n}× wrong',
  btnRemove: 'Remove',
  btnBackToChapter: 'Review Chapter {n}',
  wrongEmpty: 'The wrong-answer list is empty — either you are doing well, or you have not started yet.',

  /* ---- 历史成绩 ---- */
  historyTitle: 'Score history',
  historyDesc: 'Only “random quiz” rounds are recorded; redos are excluded so the average cannot be farmed. '
    + 'The last {max} attempts are kept, in this browser only.',
  statRuns: 'Attempts',
  statAvg: 'Average',
  statBest: 'Best',
  historyCorrect: '{c} / {t} correct',
  historyDuration: 'Time {d}',
  historyEmpty: 'Nothing recorded yet — finish one quiz and it shows up here.',
  btnClear: 'Clear score history',
  btnClearConfirm: 'Clear everything?',

  /* ---- 动态提示 ---- */
  noticeUnanswered: '{n} question(s) are still unanswered (no. {list}) — jumped to the first one.',
  noticeRemoved: 'Removed from the wrong-answer list.',
  noticeCleared: 'Score history cleared.',
  noticeReviewEmpty: 'The wrong-answer list is empty — answer some questions first.',
  bankError: 'Could not load the question bank: make sure quiz-data.js is included before quiz.js.',
};
