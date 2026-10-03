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
 * 口径标注（provenance）：
 *   每个数据集在 manifest.json 里声明一个口径 —— sourced（公开统计）/ modeled（测算整理）/
 *   projected（含预测年份）。构建时汇总成 AI_DATA.provenance（顶层数据路径 → 口径），
 *   页面据此在图表卡片上显示一枚徽章。规则是**保守取最弱一环**：一个数据集里只要含预测值，
 *   整组就标 projected。复合数据集（root.csv 一个文件供出多组数据）用 { 路径: 口径 } 逐个声明。
 *   --extract 重新索引时与 note 一样会被保留，新数据集默认 modeled（最保守）。
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
/* 口径标注的合法取值（顺序 = 由强到弱，页面的徽章说明按这个顺序讲规则） */
const PROV_KINDS = ['sourced', 'modeled', 'projected'];
const PROV_DEFAULT = 'modeled';   /* 新数据集先按最保守的「测算整理」标，等作者核实 */
const PROV_NAME = { sourced: '公开统计', modeled: '测算整理', projected: '含预测' };
const MANIFEST_NOTE = '本文件由 node data/build.mjs --extract 生成：数据集索引（文件 ↔ 数据路径 ↔ 列与类型 ↔ 口径标注 provenance）。' +
  '手写的 note 与 provenance 会被保留；新数据集默认 modeled（最保守）。';

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
  /* 口径表：顶层数据路径 → 口径。同一个顶层路径可能由多个数据集拼出来
     （scale 由 scale.csv + scale-series.csv + scale-related.csv），这时口径必须一致 ——
     页面徽章只认一个值，不能让三个文件各说各话。 */
  const provenance = {};
  const setProv = (key, value, file) => {
    if (PROV_KINDS.indexOf(value) === -1) {
      bad(`${file}: provenance 里 '${key}' 的取值 '${value}' 不在 ${PROV_KINDS.join(' / ')} 之内`);
      return;
    }
    if (provenance[key] == null) provenance[key] = value;
    else if (provenance[key] !== value) {
      bad(`provenance 冲突：'${key}' 已经被标为 ${provenance[key]}，${file} 又标成 ${value}`);
    }
  };
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
    /* 口径标注：字符串 = 这一组数据集的顶层路径；对象 = 复合文件按顶层键逐个声明 */
    const prov = ds.provenance;
    if (prov == null) {
      bad(`${ds.file}: manifest 里缺 provenance（取值为 ${PROV_KINDS.join(' / ')}；复合文件用 { 路径: 口径 }）`);
    } else if (typeof prov === 'string') {
      setProv(ds.path ? ds.path.split('.')[0] : ds.file.replace(/\.csv$/, ''), prov, ds.file);
    } else if (isPlain(prov)) {
      for (const k of Object.keys(prov)) {
        if (!(k in built)) bad(`${ds.file}: provenance 里的 '${k}' 不是这个数据集的顶层键`);
        setProv(k, prov[k], ds.file);
      }
    } else {
      bad(`${ds.file}: provenance 形状不对（应为字符串或 { 路径: 口径 }）`);
    }
  }
  /* 函数类字段：从片段文件原样内联 */
  for (const inl of manifest.inline || INLINE) {
    const frag = readFileSync(join(HERE, inl.file), 'utf8');
    /* 去掉说明注释块，只留函数体（片段文件里以 `function (` 开头的那一段） */
    const at = frag.indexOf('function (');
    if (at === -1) { bad(`${inl.file}: 找不到 \`function (\` 开头，无法内联到 ${inl.path}`); continue; }
    setPath(tree, inl.path, { __raw: frag.slice(at).trim().replace(/\s+$/, '') });
  }
  /* 口径表按路径排序输出（对象键顺序 = 输出顺序，排序后 data.js 的 diff 才稳定）。
     页面读的就是 AI_DATA.provenance：顶层数据路径 → sourced / modeled / projected。 */
  const provOut = {};
  Object.keys(provenance).sort().forEach((k) => { provOut[k] = provenance[k]; });
  if (Object.keys(provOut).length) tree.provenance = provOut;
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
    ' *   ③ 每一组数据都带 source（数据来源），页面上必须如实展示；',
    ' *   ④ provenance 是每个数据集的「口径」（sourced 公开统计 / modeled 测算整理 /',
    ' *      projected 含预测），页面按图表显示一枚徽章；口径取这批数据里最弱的一环，',
    ' *      规则与逐数据集明细见 data/README.md。',
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
  /* provenance 是 manifest 派生的元数据（不在任何 CSV 里），重新索引时不参与数据集切分 */
  delete data.provenance;
  /* 保留上一份 manifest 里手写的 note 与 provenance（人写的说明不该被机器抹掉） */
  const oldNotes = {}, oldProv = {};
  if (existsSync(MANIFEST)) {
    try {
      for (const ds of JSON.parse(readFileSync(MANIFEST, 'utf8')).datasets) {
        oldNotes[ds.path] = ds.note;
        oldProv[ds.path] = ds.provenance;
      }
    } catch (e) { /* manifest 坏了就重来 */ }
  }
  const datasets = collectDatasets(data);
  const manifest = { note: MANIFEST_NOTE, datasets: [], inline: INLINE };
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
    manifest.datasets.push({ file, path: ds.path, kind: ds.kind, provenance: oldProv[ds.path] || PROV_DEFAULT, rows: rowCount, columns, note: oldNotes[ds.path] || '' });
    rows += rowCount; cols += columns.length;
    console.log(`  ${file.padEnd(26)} ${ds.kind.padEnd(7)} ${String(rowCount).padStart(3)} 行 × ${String(columns.length).padStart(2)} 列  ← ${ds.path || '(根对象)'}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  /* 口径标注的兜底：AI_DATA 的每个顶层数据组都得有口径，否则页面上那张图的徽章是空的 */
  const provKeys = new Set();
  for (const ds of manifest.datasets) {
    if (ds.provenance && typeof ds.provenance === 'object') Object.keys(ds.provenance).forEach((k) => provKeys.add(k));
    else if (ds.path) provKeys.add(ds.path.split('.')[0]);
  }
  const noProv = Object.keys(data).filter((k) => !provKeys.has(k));
  if (noProv.length) problems.push(`这些顶层数据组没有口径标注（provenance）：${noProv.join(', ')}`);
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
  const defaulted = manifest.datasets.filter((d) => !oldProv[d.path]).map((d) => d.file);
  if (defaulted.length) {
    console.log(`⚠ 这些数据集没有历史口径，已按最保守的 ${PROV_DEFAULT} 写入，请核实后改 manifest.json 里的 provenance：`);
    console.log('   ' + defaulted.join(', '));
  }
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
  /* 口径列：复合数据集（一个 CSV 供出多组数据）把逐个键列出来 */
  const provText = (p) => (p && typeof p === 'object')
    ? Object.keys(p).map((k) => k + ' = ' + (PROV_NAME[p[k]] || p[k])).join('、')
    : (PROV_NAME[p] || '—');
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
  lines.push('## 口径标注（provenance）');
  lines.push('');
  lines.push('每张图表卡片上有一枚来源徽章，取值来自 `data/manifest.json` 里每个数据集的 `provenance`：');
  lines.push('');
  lines.push('| 取值 | 徽章 | 含义 |');
  lines.push('|---|---|---|');
  lines.push('| `sourced` | 公开统计 | 数值整理自公开报告，能在页面第 13 节的来源清单里对上 |');
  lines.push('| `modeled` | 测算整理 | 本页按公开资料测算 / 构造的指数与权重（示意口径） |');
  lines.push('| `projected` | 含预测 | 含未来年份的预测值（如 2025E / 2030E） |');
  lines.push('');
  lines.push('规则只有一条，**保守取最弱一环**：一个数据集里只要出现了测算值或预测值，这一组就按更弱的');
  lines.push('那一类标注（由强到弱：`sourced` > `modeled` > `projected`）。构建时 `data/build.mjs` 把');
  lines.push('每个数据集的口径汇总成 `AI_DATA.provenance`（顶层数据路径 → 口径），页面据此渲染徽章：');
  lines.push('`check.mjs` 静态断言取值合法、覆盖全部图表数据路径，`smoke.mjs` 真机核对每张图都有徽章。');
  lines.push('');
  lines.push('## 数据集一览');
  lines.push('');
  lines.push('| 文件 | 数据路径（`AI_DATA` 里的位置） | 形态 | 行 × 列 | 口径 | 说明 |');
  lines.push('|---|---|---|---|---|---|');
  for (const ds of manifest.datasets) {
    lines.push(`| \`${ds.file}\` | \`${ds.path || '(根对象)'}\` | ${kindName[ds.kind]} | ${ds.rows} × ${ds.columns.length} | ${provText(ds.provenance)} | ${ds.note || ''} |`);
  }
  for (const inl of manifest.inline || []) {
    lines.push(`| \`${inl.file}\` | \`${inl.path}\` | 函数片段 | — | — | ${inl.note || ''} |`);
  }
  lines.push('');
  lines.push('> 口径是**人写的数据**：`--extract` 重新索引时与 `note` 一样会被保留，新数据集默认 `modeled`（最保守）。');
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
 * 九、--forecast：产业规模外推（线性回归 + 95% 预测区间）
 * ---------------------------------------------------------
 * 页面侧保持「零依赖、零构建」，但仓库本来就有 Node 构建步骤 ——
 * 所以把外推当成一次**数据生成**（和 CSV 一样可复核），而不是运行时的隐藏计算。
 *
 * 模型：对 2019–2024 的「实际值」做时间线性回归 y = a + b·t（t = 年份 − 2019），
 *       2026–2028 的点估计 = a + b·t。选线性而不是指数 / 对数线性，是因为这条曲线在
 *       减速：实测线性 R²=0.98、且能复现给定的 2025E（8362 ≈ 8600）；对数线性会把
 *       2025 高估到 12860。逻辑回归是分类算法，不适用。
 * 区间：95% **预测区间**（prediction interval，针对「未来某年的实际值」），
 *       而不是「回归均值的置信区间」：
 *         ŷ ± t(0.975, n−2) · s · sqrt(1 + 1/n + (t−t̄)²/Sxx)
 *       样本只有 6 个点（自由度 4 → t=2.776），所以区间偏宽 —— 这是诚实的代价。
 *
 * 生成 data/scale-forecast.csv；check.mjs 会据此重新拟合、断言这份 CSV 没过期
 * （改了 2019–2024 的实际值却忘了重跑 --forecast，自检会红）。
 * ========================================================= */
const FORECAST_FILE = join(HERE, 'scale-forecast.csv');
const FORECAST_YEARS = [2026, 2027, 2028];
/* t_{0.975, 4}：n=6、dof=n−2=4 的双侧 95% 临界值 */
const T95_DOF4 = 2.776;

function olsForecast(actual, aheadIdx) {
  const n = actual.length;
  const tbar = (n - 1) / 2;
  const ybar = actual.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0;
  for (let t = 0; t < n; t++) { sxy += (t - tbar) * (actual[t] - ybar); sxx += (t - tbar) ** 2; }
  const b = sxy / sxx, a = ybar - b * tbar;
  let sse = 0;
  for (let t = 0; t < n; t++) sse += (actual[t] - (a + b * t)) ** 2;
  const s = Math.sqrt(sse / (n - 2));
  return aheadIdx.map((t) => {
    const hat = a + b * t;
    const half = T95_DOF4 * s * Math.sqrt(1 + 1 / n + (t - tbar) ** 2 / sxx);
    return { point: Math.round(hat), lo: Math.round(hat - half), hi: Math.round(hat + half) };
  });
}

function forecast() {
  const series = (file) => readFileSync(join(HERE, file), 'utf8').replace(/^\ufeff/, '').trim()
    .split(/\r?\n/).slice(1).map((l) => l.split(','))
    .map((c) => ({ year: Number(c[0]), value: Number(c[1]) }));
  const actual = (rows) => rows.filter((r) => r.year <= 2024).map((r) => r.value);
  const core = actual(series('scale-series.csv'));
  const related = actual(series('scale-related.csv'));
  if (core.length !== 6 || related.length !== 6) {
    throw new Error(`--forecast 需要 2019–2024 共 6 个实际值，实际拿到 core=${core.length} / related=${related.length}`);
  }
  const idx = FORECAST_YEARS.map((y) => y - 2019);
  const cf = olsForecast(core, idx);
  const rf = olsForecast(related, idx);
  const header = 'year:number,core:number,coreLo:number,coreHi:number,related:number,relatedLo:number,relatedHi:number';
  const lines = [header].concat(FORECAST_YEARS.map((y, i) =>
    [y, cf[i].point, cf[i].lo, cf[i].hi, rf[i].point, rf[i].lo, rf[i].hi].join(',')));
  writeFileSync(FORECAST_FILE, lines.join('\n') + '\n');
  console.log('✓ 已生成 data/scale-forecast.csv（线性回归 + 95% 预测区间，拟合样本 2019–2024）');
  FORECAST_YEARS.forEach((y, i) => console.log(
    `  ${y}E  核心 ${cf[i].point} [${cf[i].lo}, ${cf[i].hi}]   带动 ${rf[i].point} [${rf[i].lo}, ${rf[i].hi}]`));
  console.log('  → 别忘了重跑 `node data/build.mjs`（把 CSV 编进 data.js）与 `--docs`');
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
  } else if (argv.includes('--forecast')) {
    forecast();
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
