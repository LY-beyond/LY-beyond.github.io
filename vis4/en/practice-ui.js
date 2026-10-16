// =========================================================
// practice-ui.js —— English UI strings for the practice workbench
// ---------------------------------------------------------
// The key set mirrors `var T` in ../practice.js exactly (same names, same
// count, none added, none removed). {xxx} placeholders and inline tags
// such as <svg> must be kept verbatim. en/practice.html loads this file
// BEFORE ../practice.js, so the overrides are in place before rendering.
//
// Plain script (not an ES Module) so it also loads over file://.
// =========================================================
window.PRACTICE_UI = {
  goal: 'Goal',
  audience: 'Audience',
  constraints: 'Constraints',
  assetsTitle: 'Snippets to insert (click to insert at the cursor)',
  stepsTitle: 'Build stages',
  syntaxTitle: 'Syntax cheat sheet',

  progress: '{done} / {total} stages passed',
  run: '▶ Run',
  check: '✅ Check this stage',
  checkOk: 'All checkpoints of this stage passed ✅',
  checkNo: '{n} item(s) still short of the goal',
  checkIdle: 'Click “✅ Check this stage” or “▶ Run” to start judging; 500 ms after you stop typing it re-runs automatically.',
  checkNoDoc: 'The preview document cannot be read, so judging is impossible: click “▶ Run” once to reload the preview.',
  checkErr: 'The checker itself failed: {msg}',
  runError: 'Run error: {msg}',
  slow: 'There is no <svg> in the preview yet: draw the canvas first (TODO ① of stage 1); if the code is already there but nothing renders, check for an infinite loop or code blocked behind a condition.',
  prev: '← Previous stage',
  next: 'Next stage →',
  hintMore: 'Reveal one more hint ({n} / {total})',
  hintLevel: 'Hint {n}',
  solution: 'Reference solution',
  solutionConfirm: '⚠ The reference solution will replace the current editor content. Click again to confirm.',
  reset: '↺ Reset this stage',
  resetConfirm: '⚠ This restores the stage’s starting code. Click again to confirm.',
  restart: 'Clear all progress',
  restartConfirm: '⚠ This clears the progress and drafts of all 8 stages. Click again to confirm.',
  copy: 'Copy code',
  copied: 'Copied to the clipboard.',
  copyFail: 'Copy failed: select everything manually (Ctrl/Cmd + A) and copy.',
  export: '⬇ Export SVG',
  exportNone: 'There is no <svg> in the preview yet; draw the canvas before exporting.',
  exportDone: 'Exported {name}.',
  exportFail: 'Export failed: {msg}',
  worksTitle: 'My works (per-stage drafts)',
  allPassed: '🎉 All 8 stages passed — try “⬇ Export SVG” to save the chart.',
  passed: 'Passed',
};
