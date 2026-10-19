// =========================================================
// quiz-ui.js —— English UI strings for the chapter quiz
// ---------------------------------------------------------
// The key set mirrors `var T` in ../quiz.js exactly (same names, same
// count). {xxx} placeholders and inline tags such as <b>…</b> must be
// kept verbatim. en/quiz.html loads this file BEFORE ../quiz.js, and
// quiz-check.mjs compares the key sets automatically.
//
// Plain script (not an ES Module) so it also loads over file://.
// =========================================================
window.QUIZ_UI = {
  /* ---- Generic ---- */
  scoreUnit: 'pts',
  typeChoice: 'Multiple choice',
  typeJudge: 'True / False',
  judgeTrue: 'True',
  judgeFalse: 'False',
  unanswered: 'Not answered',
  listSep: ', ',
  durationMin: '{m} min {s} s',
  durationSec: '{s} s',

  /* ---- Chapter names (chapter 6 is the special topic) ---- */
  ch1: 'Chapter 1 Data · Attributes & Channels',
  ch2: 'Chapter 2 Process · Data Flow & Automation',
  ch3: 'Chapter 3 Color · Color Spaces & Colormaps',
  ch4: 'Chapter 4 Low-dimensional · Parallel Coordinates & Scatterplot Matrices',
  ch5: 'Chapter 5 Temporal · Calendar Heatmaps & Spirals',
  ch6: 'Special Topic · Chart Guide',

  /* ---- Grades ---- */
  gradeBest: 'Excellent',
  gradeBestHint: 'Solid grasp of the key ideas — head back to the chapter pages for a full review.',
  gradeGood: 'Good',
  gradeGoodHint: 'The fundamentals are clear; one more pass over the wrong-answer explanations will make them stick.',
  gradePass: 'Pass',
  gradePassHint: 'Just barely passed, with clear gaps — revisit the weak chapters listed below.',
  gradeLow: 'Needs review',
  gradeLowHint: 'Read the relevant chapters first, then come back and redo the wrong-answer book.',

  /* ---- Start page ---- */
  idleTitle: 'Chapter Quiz · {n} Questions',
  idleDesc: 'The bank covers the 5 chapters plus the "Chart Guide" special topic: {bank} questions in total ({choice} multiple-choice + {judge} true/false). Pick the length and scope first; the system then samples randomly with balanced chapter coverage.',
  sizeLabel: 'Length',
  size10: '10 questions',
  size20: '20 questions',
  sizeAll: 'All ({n} questions)',
  scopeLabel: 'Scope',
  scopeAll: 'All chapters + special topic',
  idleRuleScore: 'Chapter-balanced sampling: spreads picks across as many chapters as possible, with no repeated question',
  idleRuleShuffle: 'Option order is shuffled and answer indexes are recomputed; no letter labels are shown',
  idleRuleJudge: 'Scoring happens once on submit, with the total score, accuracy, per-question explanations and links to weak chapters',
  idleRuleWrong: 'Wrong answers enter the "wrong-answer book" automatically and leave it once answered correctly',
  idleRuleHistory: '{n} attempts recorded so far, best {best} pts',
  idleRuleLocal: 'Scores are stored only in this browser (localStorage) and never sync across devices',
  btnStart: 'Start the quiz',
  btnWrongBook: 'Wrong-answer book',
  btnHistory: 'History',

  /* ---- Question page ---- */
  modeReview: 'Redoing wrong answers',
  modeQuiz: 'Chapter quiz',
  progress: '{mode} · Question <b>{i}</b> / {total}',
  answeredCount: '{n} / {total} answered',
  ariaOptions: 'Options',
  btnPrev: '← Previous',
  btnNext: 'Next →',
  btnSubmit: 'Submit answers',
  btnQuitReview: 'Exit redo',
  btnQuitQuiz: 'Abandon this attempt',

  /* ---- Result page ---- */
  resultTitleReview: 'Redo complete · {grade}',
  resultTitleQuiz: 'This attempt · {grade}',
  resultMeta: '<b>{correct}</b> / {total} correct · accuracy {rate}% · time {duration}',
  resultMetaReview: ' · Redo attempts are not recorded in history',
  weakTitle: 'Chapters to revisit',
  weakItem: '{name} · {n} wrong',
  flagOk: '✓ Correct',
  flagBad: '✗ Wrong',
  yourAnswer: 'Selected answer: ',
  correctAnswer: 'Correct answer: ',
  answerSep: ' — ',
  explainTag: 'Explanation',
  resultEmpty: 'No wrong answers this round — spotless.',
  btnAgain: 'One more round',
  btnSeeAll: 'See all explanations',
  btnOnlyWrong: 'Only wrong answers',
  subtitleReview: 'Question-by-question review',
  ariaScore: 'Score: {n} points',

  /* ---- Wrong-answer book ---- */
  wrongTitle: 'Wrong-answer book',
  wrongDesc: 'Questions answered wrong are collected here automatically and removed once answered correctly. Records are stored only in this browser (localStorage).',
  btnRedoWrong: 'Redo wrong answers',
  btnNewQuiz: 'Start a new quiz',
  btnBack: 'Back',
  lastPick: ' — last pick: ',
  wrongCount: 'Wrong ×{n}',
  btnRemove: 'Remove from book',
  btnBackToChapter: 'Revisit: {name}',
  wrongEmpty: 'The wrong-answer book is empty — either the answers were solid, or no quiz has been taken yet.',

  /* ---- History ---- */
  historyTitle: 'History',
  historyDesc: 'Only "Chapter quiz" attempts are recorded; redoing wrong answers does not count (to prevent score grinding). At most the last {max} attempts are kept, and data lives only in this browser.',
  statRuns: 'Quizzes taken',
  statAvg: 'Average score',
  statBest: 'Best score',
  historyCorrect: '{c} / {t} correct',
  historyDuration: 'Time {d}',
  historyEmpty: 'No records yet — take a quiz and it will be logged automatically.',
  btnClear: 'Clear all records',
  btnClearConfirm: 'Confirm: clear all records?',

  /* ---- Dynamic notices ---- */
  noticeUnanswered: '{n} question(s) still unanswered (No. {list}); jumped to the first unanswered question.',
  noticeRemoved: 'Removed from the wrong-answer book.',
  noticeCleared: 'Score records cleared.',
  noticeReviewEmpty: 'The wrong-answer book is empty — answer a few questions in a quiz first.',
  noticeScopeShort: '"{name}" has fewer than {n} available questions; the actual count was drawn instead.',
  bankError: 'Failed to load the question bank: make sure quiz-data.js is included before quiz.js.'
};