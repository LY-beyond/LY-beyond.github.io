// =========================================================
// a11y-check.mjs —— 对比度自检（WCAG AA）
// ---------------------------------------------------------
// 从 tokens.css 解析亮 / 暗两套令牌，对「文字 / 背景」关键组合
// 逐组计算对比度：
//   · 正文类组合要求 >= 4.5:1（AA 正文）
//   · 弱化文字（muted，仅用于大号 / 装饰性文字）要求 >= 3.0:1（AA 大字）
//   · 图表系列色（非文字图形）对照卡面给出提示（< 3.0:1 仅 WARN）
// 任一 FAIL 项不达标即 exit 1。
// 说明：本脚本只做开发期自检，不被网站加载，不影响静态部署。
// =========================================================
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector) {
  const i = css.indexOf(selector);
  if (i < 0) return '';
  const open = css.indexOf('{', i);
  let depth = 1, j = open + 1;
  while (depth > 0 && j < css.length) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') depth--;
    j++;
  }
  return css.slice(open + 1, j - 1);
}

function parseHexVars(text) {
  const out = {};
  const re = /--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2];
  return out;
}

const lightVars = parseHexVars(block(':root'));
const darkVars = Object.assign({}, lightVars, parseHexVars(block(':root[data-theme="dark"]')));
const themes = { '亮色 light': lightVars, '暗色 dark': darkVars };

function lum(hex) {
  let c = hex.slice(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const lin = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function ratio(a, b) {
  const l = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}

/* [前景令牌, 背景令牌, 最低要求, 用途说明] */
const TEXT_PAIRS = [
  ['c-text',      'c-bg',      4.5, '正文 / 页面底色'],
  ['c-text',      'c-surface', 4.5, '正文 / 卡片'],
  ['c-text-soft', 'c-bg',      4.5, '次级文字 / 页面底色'],
  ['c-text-soft', 'c-surface', 4.5, '次级文字 / 卡片'],
  ['c-muted',     'c-bg',      3.0, '弱文字（大号/装饰） / 页面底色'],
  ['c-muted',     'c-surface', 3.0, '弱文字（大号/装饰） / 卡片'],
  ['c-primary',   'c-bg',      4.5, '主色文字 / 页面底色'],
  ['c-primary',   'c-surface', 4.5, '主色文字 / 卡片'],
  ['c-accent',    'c-surface', 4.5, '强调色文字 / 卡片'],
  ['c-on-primary','c-primary', 4.5, '按钮文字 / 主色底'],
  ['c-on-accent', 'c-accent',  4.5, '强调按钮文字 / 强调底'],
  ['c-info',      'c-surface', 4.5, '信息色文字 / 卡片'],
  ['c-success',   'c-surface', 4.5, '成功色文字 / 卡片'],
  ['c-warn',      'c-surface', 4.5, '警告色文字 / 卡片'],
  ['c-danger',    'c-surface', 4.5, '危险色文字 / 卡片'],
];
const SERIES = ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5', 'ch-6', 'ch-7', 'ch-8'];

let fails = 0, warns = 0;
for (const [tName, vars] of Object.entries(themes)) {
  console.log('\n===== ' + tName + ' =====');
  for (const [fg, bg, min, label] of TEXT_PAIRS) {
    if (!vars[fg] || !vars[bg]) { console.log('?  ' + label + ': 缺少令牌 ' + fg + ' / ' + bg); continue; }
    const r = ratio(vars[fg], vars[bg]);
    const ok = r >= min;
    if (!ok) fails++;
    console.log((ok ? '✓' : '✗') + '  ' + r.toFixed(2).padStart(5) + ':1（要求 ' + min.toFixed(1) + '）  ' + label + '   ' + vars[fg] + ' on ' + vars[bg]);
  }
  for (const s of SERIES) {
    if (!vars[s]) continue;
    const r = ratio(vars[s], vars['c-surface']);
    if (r < 3.0) { warns++; console.log('⚠  ' + r.toFixed(2).padStart(5) + ':1  图形色 ' + s + ' 对照卡面低于 3:1（非文字图形，需配合描边/位置线索）'); }
  }
}

console.log('\n===== 汇总：' + fails + ' 项不达标，' + warns + ' 项图形色提示 =====');
process.exit(fails === 0 ? 0 : 1);
