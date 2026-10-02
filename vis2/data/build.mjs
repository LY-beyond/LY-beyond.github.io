/* =========================================================
 * data/build.mjs —— 数据链路：CSV（人可读的数据源）→ data.js（页面加载的产物）
 * ---------------------------------------------------------
 * 三种跑法：
 *   node data/build.mjs           从 data/*.csv 重新生成 ../data.js
 *   node data/build.mjs --check   只检查：data.js 是否与 CSV 一致（供 selfcheck 调用）
 *   node data/build.mjs --docs    重新生成数据字典 data/README.md
 *   node data/build.mjs --extract 反向：把 data.js 重新拆成 CSV + manifest.json
 *                                 （只有在你直接手改了 data.js、想把改动同步回 CSV 时才用）
 *   node data/build.mjs --verify <另一个 data.js>   逐字段比对两份数据（迁移/重构时的保险绳）
 *
 * 为什么要有这一层：
 *   · 数据与代码分开：改数字不用碰渲染逻辑，改渲染不用碰数据；
 *   · 数据可被 diff：CSV 一行一个记录，git diff 能看清「哪个省、哪一年」被改了；
 *   · 数据可被校验：build.mjs --check 断言「仓库里的 data.js 就是这些 CSV 生成的」，
 *     从此不存在「手改 data.js 忘了同步」这种漂移；
 *   · 数据可被解释：--docs 从 CSV 表头 + 每列的取值类型生成数据字典。
 *
 * 类型化表头：CSV 第一行形如 `name.zh:text,name.en:text,compute:number`，
 * 冒号后面是这一列的取值类型（text / number / boolean / json）。
 * 这样「看起来像数字的字符串」（如行政区划代码 '110000'）不会被悄悄变成数字。
 *
 * 自动切表规则（--extract 时）：容器里「元素是对象的数组（≥2 项）」「键数 ≥5 的嵌套对象」
 * 会被切到自己的 CSV；更小的数组作为父行的一个 json 单元，避免碎成一堆两行的文件。
 * ========================================================= */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const HERE = fileURLToPath(new URL('.', import.meta.url));      /* vis2/data/ */
const SITE = join(HERE, '..');                                  /* vis2/ */
const TARGET = join(SITE, 'data.js');
const MANIFEST = join(HERE, 'manifest.json');
const INLINE = [{ path: 'sim.model', file: 'sim-model.js', note: '模拟器模型（函数，无法进 CSV）' }];

const problems = [];
const bad = (m) => problems.push(m);

/* =========================================================
 * 一、CSV 读写（带 BOM，Excel 打开不乱码）
 * ========================================================= */
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
function toCSV(header, rows) {
  return '\ufeff' + header.join(',') + '\r\n' +
    rows.map((r) => header.map((h) => cell(r[h])).join(',')).join('\r\n') + '\r\n';
}
function parseCSV(text) {
  const src = text.replace(/^\ufeff/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/* =========================================================
 * 二、结构工具
 * ========================================================= */
const isBilingual = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'zh' in v && 'en' in v;
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !isBilingual(v);
const isRecord = (v) => isPlain(v) && Object.keys(v).length >= 2;
const typeOf = (v) => v === null ? 'json'
  : Array.isArray(v) || isPlain(v) ? 'json'
    : typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : 'text';

/* 记录 → 一行（扁平列名；数组作为 JSON 单元；双语对象拆成 .zh / .en 两列） */
function flattenRecord(rec) {
  const out = {};
  const put = (v, pre) => {
    if (v === undefined) return;   /* 未定义的字段等于「没有这个字段」，不要写成 null */
    if (isBilingual(v)) { out[pre + '.zh'] = { t: 'text', v: v.zh }; out[pre + '.en'] = { t: 'text', v: v.en }; return; }
    if (Array.isArray(v)) { out[pre] = { t: 'json', v: JSON.stringify(v) }; return; }
    if (isPlain(v)) { Object.keys(v).forEach((k) => put(v[k], pre ? pre + '.' + k : k)); return; }
    out[pre] = { t: typeOf(v), v: v };
  };
  Object.keys(rec).forEach((k) => put(rec[k], k));
  return out;
}


/* 容器 → 数据集列表：[{ path, kind:'object'|'array'|'pairs', row|rows }] */
function collectDatasets(root) {
  const datasets = [];
  const hoistArray = (v) => Array.isArray(v) && v.length >= 2 && v[0] !== null && typeof v[0] === 'object';
  const hoistObject = (v) => isPlain(v) && Object.keys(v).length >= 5;

  function walkArray(v, path) {
    const pairs = v.every(isBilingual);
    datasets.push({ path, kind: pairs ? 'pairs' : 'array', rows: v });
  }
  function walkObject(v, path) {
    const row = {};
    /* 先占位（row 是引用，随后被填满）：保证父对象的输出顺序在子数据集之前 */
    datasets.push({ path, kind: 'object', row });
    for (const k of Object.keys(v)) {
      const child = v[k];
      const childPath = path ? path + '.' + k : k;
      if (hoistArray(child)) { walkArray(child, childPath); continue; }
      if (hoistObject(child)) { walkObject(child, childPath); continue; }
      if (isPlain(child)) {
        /* 小对象：按深路径摊平到本行 */
        const flat = flattenRecord(child);
        for (const c of Object.keys(flat)) row[k + '.' + c] = flat[c];
        continue;
      }
      if (isBilingual(child)) {
        row[k + '.zh'] = { t: 'text', v: child.zh };
        row[k + '.en'] = { t: 'text', v: child.en };
        continue;
      }
      if (Array.isArray(child)) { row[k] = { t: 'json', v: JSON.stringify(child) }; continue; }
      row[k] = { t: typeOf(child), v: child };
    }
  }

  walkObject(root, '');
  return datasets;
}

/* 数据集 → CSV 文本；列顺序 = 首次出现顺序（稳定，diff 友好） */
function datasetToCSV(ds) {
  const columns = [];
  const rows = ds.kind === 'object' ? [ds.row] : ds.rows.map(flattenRecord);
  for (const r of rows) for (const c of Object.keys(r)) if (!columns.includes(c)) columns.push(c);
  const header = columns.map((c) => {
    const hit = rows.find((r) => r[c] != null);
    return c + ':' + (hit ? hit[c].t : 'text');
  });
  const body = rows.map((r) => {
    const o = {};
    columns.forEach((c, i) => { o[header[i]] = r[c] == null ? '' : r[c].v; });
    return o;
  });
  return toCSV(header, body);
}

/* CSV 文本 → 数据集（按 manifest 里的类型还原取值） */
function csvToDataset(ds, text) {
  const table = parseCSV(text);
  if (!table.length) throw new Error(`${ds.file}: CSV 是空的`);
  const rawHeader = table[0];
  const header = rawHeader.map((h) => {
    const i = h.lastIndexOf(':');
    return { name: h.slice(0, i), type: h.slice(i + 1), raw: h };
  });
  const want = ds.columns.map((c) => c.raw);
  if (rawHeader.join('|') !== want.join('|')) {
    throw new Error(`${ds.file}: 表头与 manifest 不一致\n  现在：${rawHeader.join(',')}\n  期望：${want.join(',')}\n  （改过 CSV 表头的话，跑 node data/build.mjs --extract 重新索引）`);
  }
  const rows = table.slice(1).map((cells) => {
    const rec = {};
    header.forEach((h, i) => {
      const raw = cells[i] == null ? '' : cells[i];
      /* 空的非文本单元 = 这一行没有这个字段（data.js 里就不出现这个键）；文本单元的空 = 空字符串 */
      if (raw === '' && h.type !== 'text') return;
      rec[h.name] = h.type === 'number' ? Number(raw)
        : h.type === 'boolean' ? raw === 'true'
          : h.type === 'json' ? JSON.parse(raw)
            : raw;
    });
    return rec;
  });
  if (ds.kind === 'object') {
    if (rows.length !== 1) throw new Error(`${ds.file}: object 数据集应只有 1 行，实际 ${rows.length} 行`);
    return rows[0];
  }
  return rows;
}

/* =========================================================
 * 三、组装：扁平记录 → 嵌套对象；再打印成 JS
 * ========================================================= */
function unflatten(rec) {
  const out = {};
  for (const k of Object.keys(rec)) {
    const parts = k.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = rec[k];
  }
  return out;
}
function setPath(tree, path, value) {
  if (!path) { Object.assign(tree, value); return; }
  const parts = path.split('.');
  let node = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] == null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  const last = parts[parts.length - 1];
  const cur = node[last];
  /* 同一父对象可能被多个数据集拼出来（父行 + 被切出去的子数组）—— 对象要合并而不是覆盖 */
  if (isPlain(cur) && isPlain(value)) Object.assign(cur, value);
  else node[last] = value;
}

const quote = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
const keyName = (k) => /^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k);
const pad = (n) => '  '.repeat(n);

function ser(v, ind) {
  if (v && v.__raw) return v.__raw;   /* 函数片段：原样输出 */
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return quote(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (isBilingual(v)) return '{ zh: ' + quote(v.zh) + ', en: ' + quote(v.en) + ' }';
  if (Array.isArray(v)) {
    const one = '[' + v.map((x) => ser(x, ind + 1)).join(', ') + ']';
    if (!one.includes('\n') && one.length + ind * 2 <= 110) return one;
    return '[\n' + v.map((x) => pad(ind + 1) + ser(x, ind + 1)).join(',\n') + '\n' + pad(ind) + ']';
  }
  const parts = Object.keys(v).map((k) => keyName(k) + ': ' + ser(v[k], ind + 1));
  const one = '{ ' + parts.join(', ') + ' }';
  if (!one.includes('\n') && one.length + ind * 2 <= 110) return one;
  return '{\n' + parts.map((p) => pad(ind + 1) + p).join(',\n') + '\n' + pad(ind) + '}';
}

/* 由 CSV 生成 data.js 文本（不写盘，便于 --check 比对） */
function buildDataJs() {
  if (!existsSync(MANIFEST)) throw new Error('data/manifest.json 不存在：先跑 node data/build.mjs --extract');
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const tree = {};
  for (const ds of manifest.datasets) {
    const file = join(HERE, ds.file);
    if (!existsSync(file)) { bad(`manifest 里的 ${ds.file} 不存在`); continue; }
    const value = csvToDataset(ds, readFileSync(file, 'utf8'));
    if (ds.kind !== 'object' && value.length !== ds.rows) {
      bad(`${ds.file}: 行数 ${value.length} 与 manifest 记录 ${ds.rows} 不一致（增删了数据行？跑 --extract 重新索引）`);
    }
    /* 记录数组：每行先摊反成对象；pairs 数组：{zh,en} 原样 */
    let built;
    try {
      built = ds.kind === 'object' ? unflatten(value)
        : ds.kind === 'pairs' ? value
          : value.map(unflatten);
    } catch (e) {
      bad(`${ds.file}（${ds.path}）在摊平回嵌套结构时报错：${e.message}｜列：${Object.keys(ds.kind === 'object' ? value : value[0]).join(', ')}`);
      continue;
    }
    setPath(tree, ds.path, built);
  }
  /* 函数类字段：从片段文件原样内联 */
  for (const inl of manifest.inline || INLINE) {
    const frag = readFileSync(join(HERE, inl.file), 'utf8');
    /* 去掉说明注释块，只留函数体（片段文件里以 `function (` 开头的那一段） */
    const at = frag.indexOf('function (');
    if (at === -1) { bad(`${inl.file}: 找不到 \`function (\` 开头，无法内联到 ${inl.path}`); continue; }
    setPath(tree, inl.path, { __raw: frag.slice(at).trim().replace(/\s+$/, '') });
  }
  const body = Object.keys(tree).map((k) => pad(1) + keyName(k) + ': ' + ser(tree[k], 1) + ',').join('\n');
  const header = [
    '/* =========================================================',
    ' * data.js —— 全站数据与文案（唯一数据源）',
    ' * ---------------------------------------------------------',
    ' * ⚠️ 本文件由 `node data/build.mjs` 从 data/*.csv 生成，请不要直接编辑；',
    ' *    改数据 → 改 data/ 下的 CSV，再跑一次构建；改模型 → 改 data/sim-model.js。',
    ' *    数据字典（每个 CSV 有哪些列、什么类型、对应页面哪一节）见 data/README.md。',
    ' *',
    ' * 约定：',
    ' *   ① 所有文案写成 { zh: \'…\', en: \'…\' }，由 I18N.pick() 取当前语言；',
    ' *   ② 纯数字 / 数组不加包装，图表直接读取；',
    ' *   ③ 每一组数据都带 source（数据来源），页面上必须如实展示。',
    ' *',
    ' * 数据说明：本页数据为公开资料整理（中国信通院、工信部、国家统计局、',
    ' * 普华永道、IDC、斯坦福 AI Index 等）与合理测算的示意图，',
    ' * 不同机构口径不完全一致，仅用于可视化表达，不作为严谨统计引用。',
    ' * ========================================================= */',
    'window.AI_DATA = {',
    body.replace(/,$/, ''),
    '};',
    ''
  ].join('\n');
  return { text: header, tree, manifest };
}

/* =========================================================
 * 四、读回 data.js（用于 --extract / --verify / 覆盖度自检）
 * ========================================================= */
function loadDataJs(file) {
  const src = readFileSync(file, 'utf8');
  const sandbox = {
    window: {}, console,
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), body: {}, readyState: 'complete' },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: {}, setTimeout, clearTimeout, addEventListener() {}, dispatchEvent() {}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  runInContext(src, createContext(sandbox), { filename: file });
  return sandbox.AI_DATA;
}

/* =========================================================
 * 五、--extract：data.js → data/*.csv + manifest.json
 * ========================================================= */
function extract() {
  const data = loadDataJs(TARGET);
  /* 保留上一份 manifest 里手写的 note（人写的说明不该被机器抹掉） */
  const oldNotes = {};
  if (existsSync(MANIFEST)) {
    try {
      for (const ds of JSON.parse(readFileSync(MANIFEST, 'utf8')).datasets) oldNotes[ds.path] = ds.note;
    } catch (e) { /* manifest 坏了就重来 */ }
  }
  const datasets = collectDatasets(data);
  const manifest = { note: '本文件由 node data/build.mjs --extract 生成：数据集索引（文件 ↔ 数据路径 ↔ 列与类型）。手写的 note 会被保留。', datasets: [], inline: INLINE };
  let rows = 0, cols = 0;
  for (const ds of datasets) {
    const csv = datasetToCSV(ds);
    const header = parseCSV(csv)[0];
    const file = ds.path === '' ? 'root.csv' : ds.path.replace(/\./g, '-').replace(/[^a-z0-9-]/gi, '') + '.csv';
    writeFileSync(join(HERE, file), csv, 'utf8');
    const columns = header.map((h) => {
      const i = h.lastIndexOf(':');
      return { name: h.slice(0, i), type: h.slice(i + 1), raw: h };
    });
    const rowCount = ds.kind === 'object' ? 1 : ds.rows.length;
    manifest.datasets.push({ file, path: ds.path, kind: ds.kind, rows: rowCount, columns, note: oldNotes[ds.path] || '' });
    rows += rowCount; cols += columns.length;
    console.log(`  ${file.padEnd(26)} ${ds.kind.padEnd(7)} ${String(rowCount).padStart(3)} 行 × ${String(columns.length).padStart(2)} 列  ← ${ds.path || '(根对象)'}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  /* 覆盖度自检：AI_DATA 里的每个叶子都必须落在某个数据集里 */
  const covered = new Set();
  const datasetPaths = new Set(datasets.map((d) => d.path).filter(Boolean));
  for (const ds of datasets) {
    const cols = ds.kind === 'object' ? Object.keys(ds.row) : Object.keys(flattenRecord(ds.rows[0]));
    cols.forEach((c) => covered.add((ds.path ? ds.path + '.' : '') + c));
  }
  const leaves = [];
  (function walk(o, p) {
    if (isBilingual(o)) { leaves.push(p + '.zh', p + '.en'); return; }
    if (typeof o === 'function') { leaves.push(p); return; }
    if (Array.isArray(o)) { if (o.some((x) => x && typeof x === 'object' && !isBilingual(x))) return; leaves.push(p); return; }
    if (isPlain(o)) { Object.keys(o).forEach((k) => walk(o[k], p ? p + '.' + k : k)); return; }
    leaves.push(p);
  })(data, '');
  const missed = leaves.filter((l) => {
    if (covered.has(l)) return false;
    /* 往回退：只要某个祖先被覆盖就算覆盖（数组/对象整体由一个数据集承载时就是这种情况） */
    const seg = l.split('.');
    while (seg.length) {
      const p = seg.join('.');
      if ((p && datasetPaths.has(p)) || covered.has(p)) return false;
      seg.pop();
    }
    return true;
  });
  const inlinePaths = new Set((manifest.inline || []).map((i) => i.path));
  const reallyMissed = missed.filter((m) => !inlinePaths.has(m.split('.').slice(0, -1).join('.')) && !inlinePaths.has(m));
  if (reallyMissed.length) {
    console.log('\n✗ 有数据没被任何数据集覆盖（会静默丢数据）：');
    reallyMissed.slice(0, 20).forEach((m) => console.log('   ' + m));
    problems.push(`${reallyMissed.length} 个叶子没被 CSV 覆盖`);
  }
  console.log(`\n共 ${manifest.datasets.length} 个数据集 / ${rows} 行 / ${cols} 列，覆盖 ${leaves.length} 个叶子${reallyMissed.length ? '' : '（无遗漏）'}`);
  if (problems.length) { problems.forEach((p) => console.log('✗  ' + p)); process.exit(1); }
  console.log('✓ manifest.json 与 CSV 已更新 —— 接着跑 `node data/build.mjs` 生成 data.js');
}



/* =========================================================
 * 六、--docs：生成数据字典
 * ========================================================= */
function docs() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const colHint = (n, t) => /\.zh$/.test(n) ? '中文文案' : /\.en$/.test(n) ? '英文文案'
    : t === 'number' ? '数值' : t === 'boolean' ? '真假值'
      : t === 'json' ? '结构化数据（数组 / 对象，CSV 里是 JSON 单元）' : '文本';
  const kindName = { object: '单行对象', array: '记录表', pairs: '双语对照' };
  const lines = [];
  lines.push('# 数据字典 · `vis2/data/`');
  lines.push('');
  lines.push('> ⚠️ 本文件由 `node data/build.mjs --docs` 生成，请勿手改；要补说明请改 `data/manifest.json` 里对应数据集的 `note`。');
  lines.push('');
  lines.push('## 数据链路');
  lines.push('');
  lines.push('```text');
  lines.push('data/*.csv        人可读、可 diff 的数据源（一行一个记录，UTF-8 带 BOM，Excel 可直接打开）');
  lines.push('data/sim-model.js 模拟器的模型函数（函数没法进 CSV，构建时原样内联进 data.js）');
  lines.push('        │  node data/build.mjs              ← 生成');
  lines.push('        ▼');
  lines.push('data.js           页面加载的数据模块（构建产物，请勿手改）');
  lines.push('        ▲  node data/build.mjs --extract    ← 反向：把对 data.js 的手改同步回 CSV');
  lines.push('```');
  lines.push('');
  lines.push('- **改数据**：改 `data/` 下的 CSV（一行一个记录，`git diff` 能看清是哪个省、哪一年），再跑 `node data/build.mjs`；');
  lines.push('- **改来源与口径说明**：`source` / `note` 也是数据，就在对应 CSV 的列里；');
  lines.push('- **改模型**：改 `data/sim-model.js`（模拟器、龙卷风敏感性图、蒙特卡洛分布共用它）；');
  lines.push('- **忘记重新构建**：`node data/build.mjs --check` 会断言「仓库里的 data.js 就是这些 CSV 生成的」，`node selfcheck.mjs` 已带上这一步。');
  lines.push('');
  lines.push('## 类型化表头');
  lines.push('');
  lines.push('CSV 第一行每一列写成 `列名:类型`，类型有 `text` / `number` / `boolean` / `json` 四种。');
  lines.push('这样「看起来像数字的字符串」（如行政区划代码 `110000`）不会被悄悄变成数字，单位与千分位也不会在往返中丢失。');
  lines.push('文案列一律成对出现：`xxx.zh` / `xxx.en`（页面按当前语言取其中一列），`selfcheck` 会核对两侧都在。');
  lines.push('');
  lines.push('## 数据集一览');
  lines.push('');
  lines.push('| 文件 | 数据路径（`AI_DATA` 里的位置） | 形态 | 行 × 列 | 说明 |');
  lines.push('|---|---|---|---|---|');
  for (const ds of manifest.datasets) {
    lines.push(`| \`${ds.file}\` | \`${ds.path || '(根对象)'}\` | ${kindName[ds.kind]} | ${ds.rows} × ${ds.columns.length} | ${ds.note || ''} |`);
  }
  for (const inl of manifest.inline || []) {
    lines.push(`| \`${inl.file}\` | \`${inl.path}\` | 函数片段 | — | ${inl.note || ''} |`);
  }
  lines.push('');
  lines.push('## 各数据集字段');
  for (const ds of manifest.datasets) {
    lines.push('');
    lines.push(`### \`${ds.file}\` → \`${ds.path || '(根对象)'}\`（${ds.rows} 行）`);
    lines.push('');
    lines.push('| 列 | 类型 | 含义 |');
    lines.push('|---|---|---|');
    for (const c of ds.columns) lines.push(`| \`${c.name}\` | ${c.type} | ${colHint(c.name, c.type)} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  const rows = manifest.datasets.reduce((s, d) => s + d.rows, 0);
  const cols = manifest.datasets.reduce((s, d) => s + d.columns.length, 0);
  lines.push(`共 ${manifest.datasets.length} 个数据集、${rows} 行、${cols} 列。数据来源与口径说明见页面第 13 节与 \`README.md\` 的「数据说明」。`);
  lines.push('');
  writeFileSync(join(HERE, 'README.md'), lines.join('\n'), 'utf8');
  console.log(`✓ 数据字典已生成：data/README.md（${manifest.datasets.length} 个数据集 / ${rows} 行 / ${cols} 列）`);
  console.log(`\n===== SUMMARY script=data/build.mjs checks=${manifest.datasets.length} failed=0 =====`);
}

/* =========================================================
 * 七、--verify：逐字段比对两份 data.js（重构 / 迁移时的保险绳）
 * ========================================================= */
function verify(other) {
  const a = loadDataJs(TARGET), b = loadDataJs(other);
  const diffs = [];
  const cmp = (x, y, path) => {
    if (typeof x === 'function' || typeof y === 'function') {
      if (typeof x !== 'function' || typeof y !== 'function') { diffs.push(`${path}: 一边是函数、一边不是`); return; }
      const probes = [{ penetration: 0, dataFactor: 0, talent: 0, rd: 0 },
        { penetration: 100, dataFactor: 100, talent: 100, rd: 100 },
        { penetration: 35, dataFactor: 45, talent: 40, rd: 30 }];
      probes.forEach((v, i) => {
        const ra = JSON.stringify(x(v)), rb = JSON.stringify(y(v));
        if (ra !== rb) diffs.push(`${path}: 第 ${i + 1} 组输入下输出不同 ${ra} ≠ ${rb}`);
      });
      return;
    }
    if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') {
      if (String(x) !== String(y)) diffs.push(`${path}: ${JSON.stringify(x)} ≠ ${JSON.stringify(y)}`);
      return;
    }
    if (Array.isArray(x) !== Array.isArray(y)) { diffs.push(`${path}: 一边是数组、一边是对象`); return; }
    if (Array.isArray(x)) {
      if (x.length !== y.length) { diffs.push(`${path}: 长度 ${x.length} ≠ ${y.length}`); return; }
      x.forEach((v, i) => cmp(v, y[i], path + '[' + i + ']'));
      return;
    }
    const keys = new Set(Object.keys(x).concat(Object.keys(y)));
    keys.forEach((k) => {
      if (!(k in x)) { diffs.push(`${path}.${k}: 只在 ${basename(TARGET)} 里有`); return; }
      if (!(k in y)) { diffs.push(`${path}.${k}: 只在 ${basename(other)} 里有`); return; }
      cmp(x[k], y[k], path + '.' + k);
    });
  };
  cmp(a, b, 'AI_DATA');
  if (diffs.length) {
    console.log(`✗ 两份数据有 ${diffs.length} 处不同：`);
    diffs.slice(0, 40).forEach((d) => console.log('   ' + d));
    console.log(`\n===== SUMMARY script=data/build.mjs checks=1 failed=1 =====`);
    process.exit(1);
  }
  console.log('✓ 两份 data.js 逐字段一致（含 sim.model 在 3 组输入下的输出）');
  console.log(`\n===== SUMMARY script=data/build.mjs checks=1 failed=0 =====`);
}

/* =========================================================
 * 八、入口
 * ========================================================= */
const argv = process.argv.slice(2);
try {
  if (argv.includes('--extract')) {
    extract();
  } else if (argv.includes('--docs')) {
    docs();
  } else if (argv.includes('--verify')) {
    const other = argv[argv.indexOf('--verify') + 1];
    if (!other || !existsSync(other)) { console.error('用法：node data/build.mjs --verify <另一个 data.js>'); process.exit(2); }
    verify(other);
  } else if (argv.includes('--check')) {
    const built = buildDataJs();
    const onDisk = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
    const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
    if (norm(built.text) !== norm(onDisk)) {
      const a = norm(built.text).split('\n'), b = norm(onDisk).split('\n');
      let i = 0;
      while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
      console.log('✗ data.js 与 data/*.csv 不一致（第 ' + (i + 1) + ' 行起不同）：');
      console.log('   CSV 生成：' + (a[i] || '(空)').trim().slice(0, 120));
      console.log('   仓库里：  ' + (b[i] || '(空)').trim().slice(0, 120));
      console.log('   → 改完 CSV / 模型后请跑 `node data/build.mjs` 重新生成（不要手改 data.js）');
      problems.push('data.js 与 CSV 不一致');
    }
    if (problems.length) {
      problems.forEach((p) => console.log('✗  ' + p));
      console.log(`\n===== SUMMARY script=data/build.mjs checks=${built.manifest.datasets.length} failed=${problems.length} =====`);
      process.exit(1);
    }
    const rows = built.manifest.datasets.reduce((s, d) => s + d.rows, 0);
    const cols = built.manifest.datasets.reduce((s, d) => s + d.columns.length, 0);
    console.log(`✓ data.js 与 data/*.csv 完全一致（${built.manifest.datasets.length} 个数据集 / ${rows} 行 / ${cols} 列）`);
    console.log(`\n===== SUMMARY script=data/build.mjs checks=${built.manifest.datasets.length} failed=0 =====`);
  } else {
    const built = buildDataJs();
    if (problems.length) {
      problems.forEach((p) => console.log('✗  ' + p));
      console.log(`\n===== SUMMARY script=data/build.mjs checks=${built.manifest.datasets.length} failed=${problems.length} =====`);
      process.exit(1);
    }
    writeFileSync(TARGET, built.text, 'utf8');
    const rows = built.manifest.datasets.reduce((s, d) => s + d.rows, 0);
    const cols = built.manifest.datasets.reduce((s, d) => s + d.columns.length, 0);
    const kb = (Buffer.byteLength(built.text, 'utf8') / 1024).toFixed(1);
    console.log(`✓ data.js 已重新生成：${built.manifest.datasets.length} 个数据集 / ${rows} 行 / ${cols} 列 / ${kb} KB`);
    console.log('  下一步：node ../check.mjs（结构）与 node ../smoke.mjs（真机）');
    console.log(`\n===== SUMMARY script=data/build.mjs checks=${built.manifest.datasets.length} failed=0 =====`);
  }
} catch (e) {
  console.error('✗ ' + (e && e.message ? e.message : e));
  console.log(`\n===== SUMMARY script=data/build.mjs checks=0 failed=1 =====`);
  process.exit(1);
}
