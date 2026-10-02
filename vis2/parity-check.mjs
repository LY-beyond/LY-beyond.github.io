/* =========================================================
 * parity-check.mjs —— 中英双语「对齐」体检
 * ---------------------------------------------------------
 * 跑法：node parity-check.mjs
 * 本站是「一份代码 + 两张文案表」，所以「漏翻」和「翻译不同步」是最大的
 * 长期风险：改中文忘了改英文，页面上就会中英混排。本脚本把这件事变成
 * 可以自动判定的规则：
 *
 *   ① i18n.js 的 zh / en 两张表键完全一致（少一个键，切语言就会露出裸 key）
 *   ② en 表里不能残留中日韩字符
 *   ③ zh 与 en 相同的值，必须是「与语言无关」的字面量（%、EFLOPS、P5…）
 *   ④ 占位符集合一致（{n} / {name} 少一个，插值就会变成 undefined）
 *   ⑤ 数字同步：中文文案里的每个数字都必须在英文里出现
 *      （「12 个国家」翻成「Economies」这种丢数字的翻译，肉眼极难发现）
 *   ⑥ data.js 的双语叶子：两侧都非空、英文无中文、同值规则同 ③
 *   ⑦ index.html：出现中文文本的元素必须有 data-i18n；
 *      含中文的属性（aria-label / title / alt / placeholder）必须有 data-i18n-attr
 *      （否则切英文后读屏仍在念中文 —— 这类漏洞肉眼完全看不出来）
 *   ⑧ app.js / charts.js：注释之外的中文字符串字面量只允许出现在 { zh: '…', en: '…' }
 *      里（P({...}) 的行内文案），其余必须走词表，否则切英文不会跟着变
 *
 * 纯静态：不联网、不开浏览器、毫秒级返回。
 * ========================================================= */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(join(HERE, f), 'utf8');

const problems = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) problems.push(msg); };

const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
/* 「与语言无关」：不含中文也不含小写字母（% / EFLOPS / P5 / + 这类单位与缩写） */
const langNeutral = (s) => !CJK.test(s) && !/[a-z]/.test(s);

/* ---------------- ① 词表：两语言键一致 ---------------- */
const i18n = read('i18n.js');
const dict = i18n.slice(i18n.indexOf('var DICT'));
const zhBlock = dict.split(/^\s{4}zh:\s*\{/m)[1].split(/^\s{4}en:/m)[0];
const enBlock = dict.split(/^\s{4}en:\s*\{/m)[1];
const parseDict = (block) => {
  const map = new Map();
  const re = /^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm;
  let m;
  while ((m = re.exec(block))) map.set(m[1], m[2].replace(/\\'/g, "'"));
  return map;
};
const zh = parseDict(zhBlock);
const en = parseDict(enBlock);
ok(zh.size > 60, `i18n.js: zh 表只解析到 ${zh.size} 个键，DICT 结构可能变了`);
ok(zh.size === en.size, `i18n.js: zh ${zh.size} 键 ≠ en ${en.size} 键`);
[...zh.keys()].forEach((k) => ok(en.has(k), `i18n.js: en 表缺少键 '${k}'`));
[...en.keys()].forEach((k) => ok(zh.has(k), `i18n.js: zh 表缺少键 '${k}'`));

/* ---------------- ②③④⑤ 逐键的翻译质量规则 ---------------- */
for (const [k, zv] of zh) {
  const ev = en.get(k);
  if (ev == null) continue;
  ok(!CJK.test(ev), `i18n.js: en['${k}'] 里残留中文字符 → ${JSON.stringify(ev)}`);
  if (zv === ev) ok(langNeutral(zv), `i18n.js: '${k}' 中英完全相同，但内容像句子而非单位/缩写 → ${JSON.stringify(zv)}`);
  const zph = (zv.match(/\{[\w]+\}/g) || []).sort().join(',');
  const eph = (ev.match(/\{[\w]+\}/g) || []).sort().join(',');
  ok(zph === eph, `i18n.js: '${k}' 占位符不一致 zh=[${zph}] en=[${eph}]`);
  const znum = zv.match(/\d+(?:[.,]\d+)?/g) || [];
  const missing = znum.filter((n) => !ev.includes(n));
  ok(missing.length === 0, `i18n.js: '${k}' 英文里丢了数字 ${missing.join('/')} → ${JSON.stringify(ev)}`);
}


/* ---------------- ⑥ data.js 的双语叶子 ---------------- */
const sandbox = {
  window: {}, console,
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), body: {}, readyState: 'complete' },
  localStorage: { getItem: () => null, setItem() {} },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  navigator: {}, setTimeout, clearTimeout, addEventListener() {}, dispatchEvent() {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
runInContext(read('data.js'), createContext(sandbox));
const DATA = sandbox.AI_DATA;
const leaves = [];
(function walk(o, path) {
  if (o == null || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((v, i) => walk(v, path + '[' + i + ']')); return; }
  if ('zh' in o && 'en' in o) { leaves.push({ path, zh: String(o.zh), en: String(o.en) }); return; }
  for (const k of Object.keys(o)) walk(o[k], path ? path + '.' + k : k);
})(DATA, '');
ok(leaves.length > 300, `data.js: 只有 ${leaves.length} 个双语叶子，数据可能没加载成功`);
for (const l of leaves) {
  ok(l.zh.trim() !== '' && l.en.trim() !== '', `data.js ${l.path}: 有一侧是空字符串`);
  ok(!CJK.test(l.en), `data.js ${l.path}: en 里残留中文 → ${JSON.stringify(l.en)}`);
  if (l.zh === l.en) ok(langNeutral(l.zh), `data.js ${l.path}: 中英完全相同 → ${JSON.stringify(l.zh)}`);
}
/* 模拟器模型是函数，不属于「数据」，单独确认它没在数据重构里丢掉 */
ok(typeof DATA.sim.model === 'function', 'data.js: sim.model 应该是一个函数（模拟器与两张敏感性图共用）');

/* ---------------- ⑦ index.html 的静态文案 ---------------- */
const html = read('index.html');
const body = html.slice(html.indexOf('<body')).replace(/<!--[\s\S]*?-->/g, '');   /* 注释里的中文不算文案 */
const tagRe = /<([a-zA-Z][\w-]*)([^>]*)>([^<]*)/g;
let m;
const ALLOW_TEXT = new Set(['script', 'style', 'title']);
while ((m = tagRe.exec(body))) {
  const [, tag, attrs, text] = m;
  if (ALLOW_TEXT.has(tag.toLowerCase())) continue;
  if (!CJK.test(text)) continue;
  if (/data-i18n-/.test(attrs) || /data-i18n[=\s>]/.test(attrs)) continue;
  if (/lang-switch-item/.test(attrs)) continue;   /* 语言切换器上的「中」不随语言变 */
  ok(false, `index.html: <${tag}> 里有中文但没写 data-i18n → ${JSON.stringify(text.trim().slice(0, 40))}`);
}
let attrCount = 0;
for (const a of body.matchAll(/(aria-label|title|alt|placeholder)="([^"]*)"/g)) {
  if (!CJK.test(a[2])) continue;
  attrCount++;
  const tagStart = body.lastIndexOf('<', a.index);
  const tagEnd = body.indexOf('>', a.index);
  const tagText = body.slice(tagStart, tagEnd === -1 ? undefined : tagEnd);   /* 属性可能写在 data-i18n-attr 之前或之后 */
  if (/data-i18n-attr=/.test(tagText)) continue;
  if (/[A-Za-z]{3,}/.test(a[2])) continue;        /* 刻意双语（如「语言 / Language」） */
  ok(false, `index.html: 属性 ${a[1]}="${a[2]}" 是纯中文且没有 data-i18n-attr → 切英文后读屏仍念中文`);
}

/* ---------------- ⑧ 脚本里的裸中文 ---------------- */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\])\/\/[^\n]*/gm, (c, p1) => p1 + ' '.repeat(c.length - p1.length));
for (const f of ['app.js', 'charts.js']) {
  const src = stripComments(read(f));
  src.split('\n').forEach((line, i) => {
    /* 唯一豁免：按语言分支的「排版字面量」（如 withUnit() 里中文用全角括号、英文用半角）。
       这类字面量的职责就是「随语言变」，所以必须显式读 I18N.lang —— 用这个条件把它们挑出来。 */
    if (/I18N\.lang/.test(line)) return;
    for (const lit of line.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      if (!CJK.test(lit[1])) continue;
      const before = line.slice(0, lit.index).replace(/\s+$/, '');
      if (/zh:$/.test(before)) continue;   /* 行内双语对象的 zh 半边：{ zh: '…', en: '…' } */
      ok(false, `${f}:${i + 1}: 裸中文字符串 ${JSON.stringify(lit[1].slice(0, 40))} 不走词表 → 切英文不会变`);
    }
  });
}

/* ---------------- 输出 ---------------- */
if (problems.length) {
  problems.forEach((p) => console.log('✗  ' + p));
  console.log(`\n===== SUMMARY script=parity-check.mjs checks=${checks} failed=${problems.length} =====`);
  process.exit(1);
}
console.log(`✓ 词表 ${zh.size} 键中英对齐（键 / 占位符 / 数字三项同步）`);
console.log(`✓ data.js ${leaves.length} 个双语叶子：两侧非空、英文无中文`);
console.log(`✓ index.html 静态文案与 ${attrCount} 处可读属性都有 i18n 归属；脚本里没有裸中文`);
console.log(`\n===== SUMMARY script=parity-check.mjs checks=${checks} failed=0 =====`);
