// =========================================================
// en/practice-ui.js —— 实战环节界面文案（英文覆盖表）
// ---------------------------------------------------------
// 引擎只有一份（../practice.js），默认文案是中文；本文件提供
// window.PRACTICE_UI 覆盖成英文。这样逻辑改一处、中英不会各自漂移。
// 键名必须与 practice.js 里的 T 表逐一对齐（少一个键会在页面上露出 [key]）。
// 只在 en/practice.html 里引入，且必须在 ../practice.js 之前。
// =========================================================
window.PRACTICE_UI = {

  /* ---- 通用 ---- */
  docLang: 'en',
  chapterLabel: 'Chapter {n}',
  trackDesign: 'Design track',
  trackImpl: 'Implementation track',
  trackCapstone: 'Capstone',
  caseError: 'Could not load the case data: make sure practice-data.js is included before practice.js.',

  /* ---- 预览宽度档位 ---- */
  deviceDesktop: 'Desktop 1180',
  deviceTablet: 'Tablet 768',
  devicePhone: 'Phone 375',

  /* ---- 脚本提示 ---- */
  scriptPartTag: '{n} <script> block(s)',
  scriptPartHandler: '{n} inline handler(s)',
  scriptSep: ', ',
  scriptNote: '⚠️ Removed {parts}: neither the preview nor the exported .html runs JavaScript — '
    + 'this case is a pure HTML/CSS layout exercise and scripts are out of scope.',

  /* ---- 检查 ---- */
  checkUnavailable: 'This browser does not allow reading the preview document, so automatic checking is '
    + 'unavailable. Open the page from a local server (python -m http.server 8080) and try again.',
  checkAllPass: '🎉 All {n} checks in this step passed — you can move on to the next one.',
  checkSomeFail: '{n} check(s) still failing — compare with the preview, or hit “💡 Hint”.',
  checkEmptyIntro: 'Not checked yet. Once this step’s code is written, hit “✅ Check this step” below — '
    + 'I measure the real rendered result (computed styles + element geometry) at {width}px wide; the code '
    + 'text is never compared, so name your classes however you like.',
  checkScore: '{pass} / {total} passed',
  checkFlagGood: '✓ Step complete',
  checkFlagBad: '✗ {n} to fix',
  checkFootnote: 'What is checked is the “effect”, not the “writing”: as long as the browser really renders it '
    + 'this way, it passes. The check temporarily switches the preview to {width}px, so responsiveness is '
    + 'verified as well.',
  checkError: 'Check failed',

  /* ---- 提示 / 参考答案 / 重置 ---- */
  btnHint: '💡 Hint',
  hintLevelNote: 'Hints unlock one level at a time — click again for the next',
  hintDone: 'All hints are open. Still stuck? Hit “View reference answer” and get this step done.',
  syntaxTitle: '🔤 Cheat sheet (the properties this step needs)',
  btnSolution: 'View reference answer',
  btnSolutionConfirm: '⚠️ Confirm: use the reference',
  solutionConfirm: 'This overwrites your current code with the reference answer. Click again to confirm.',
  solutionDone: 'Reference answer loaded — read it once for the “why”, then hit Check.',
  btnReset: 'Reset this step',
  btnResetConfirm: '⚠️ Confirm reset',
  resetConfirm: 'This restores this step’s starting code (the previous step’s result). Click again to confirm.',
  resetDone: 'Reset to this step’s starting code.',
  stepSolutionFlag: 'answer used',
  btnRestart: 'Start over',
  btnRestartConfirm: '⚠️ Confirm restart',
  restartConfirm: 'This clears the current progress (anything saved under “My work” is safe). '
    + 'Click again to confirm.',
  restartDone: 'Started over — good luck.',

  /* ---- 环节流转 ---- */
  btnCheck: '✅ Check this step',
  btnPrevStep: '← Previous step',
  btnNextStep: 'Next step →',
  btnFinishCase: 'Finish 🎉',
  btnSave: '💾 Save to my work',
  actionsState: 'Step: {title} · {done} / {total} steps passed',
  progressHead: 'Passed <b>{done}</b> / {total} steps',
  initStart: 'Starting from step 1: read the “Case brief” in the left column, then start typing. '
    + 'Stuck? Hit “💡 Hint”.',
  draftRestored: 'Restored your last draft (step {step}) · {time}',

  /* ---- 案例要求 ---- */
  briefGoal: 'Page goal',
  briefAudience: 'Audience',
  briefSuccess: 'Success criteria',
  briefDeliverable: 'Deliverable',
  briefAssets: '📋 Case copy (click to insert into the editor)',
  briefLessonIntro: 'Companion chapter: ',
  briefLessonLink: 'Chapter 9 · Capstone: a portfolio website →',
  insertDone: 'Inserted: {text}',

  /* ---- 我的作品 / 导出 ---- */
  btnWorks: '📁 My work',
  worksTitle: '📁 My work',
  btnCollapse: 'Collapse',
  btnLoadWork: 'Load and continue',
  btnDeleteWork: 'Delete',
  worksItemDetail: 'step {step}/{total} · {passed} steps passed · {minutes} min',
  worksItemSolution: ' · answer used {n}×',
  worksEmpty: 'Nothing saved yet. Finish a few steps and hit “💾 Save to my work” — the record shows up '
    + 'here (this browser only).',
  worksNote: 'The last {max} saves are kept; “Export .html” packs the current code into a complete web page '
    + 'you can open by double-clicking.',
  workSaved: 'Saved to “My work” (the last {max} saves are kept).',
  workSaveFail: 'Save failed: browser storage is full, or you are in private mode. Use “Export .html” instead.',
  workLoaded: 'Loaded the work from {time} — carry on editing.',
  workDeleted: 'That work was deleted.',
  btnExport: '⬇️ Export .html',
  exportPrefix: 'portfolio-',
  exportDone: 'Exported {name} — double-click it to open the very page you see in the preview.',

  /* ---- 「好消息」关键词（与中文默认表同一套判定方式：数组匹配） ---- */
  goodWords: ['passed', 'Saved', 'Exported', 'Restored', 'Inserted', 'Started over', 'loaded'],
};
