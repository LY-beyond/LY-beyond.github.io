/* =========================================================
   案例编译器 build-cases.js
   ---------------------------------------------------------
   读取 tools/content/*.js 中的结构化案例定义，生成：
     1. cases/<id>/case.json          —— 与既有案例同构的源文件
     2. assets/cases/<id>.case.js     —— 静态注册版插件

   用法：
     node tools/build-cases.js            编译 tools/content 下全部
     node tools/build-cases.js g2 s3      只编译指定 sceneId 的案例

   结构化定义格式见 tools/content/_SPEC.js（仅供参考，不参与编译）。
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(__dirname, 'content');
const CASES_DIR = path.join(ROOT, 'cases');
const OUT_DIR = path.join(ROOT, 'assets', 'cases');

/* ---------- 文本 → 安全 HTML（与 kit.js rich() 保持一致） ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function rich(s) {
  var out = esc(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/`([^`]+)`/g, '<code style="font-family:var(--mono);font-size:.92em;background:var(--paper-2);padding:1px 4px;border-radius:3px">$1</code>');
  return out;
}
function paras(list) {
  return (list || []).map(function (p) { return '<p>' + rich(p) + '</p>'; }).join('');
}

/* ---------- 与 kit.js 同构的 HTML 片段（编译期烘焙） ---------- */
function dtagHTML(d) {
  return '<span class="dtag" data-d="' + esc(d) + '">难度 ' + esc(d) + '</span>';
}
function meterHTML(diff) {
  var lv = diff === '低' ? 1 : diff === '高' ? 3 : 2;
  return '<div class="meter">' + [1, 2, 3].map(function (i) {
    return '<i class="' + (i <= lv ? 'on' : '') + (i === 3 && lv === 3 ? ' hi' : '') + '"></i>';
  }).join('') + '</div>';
}
function refsHTML(list, method) {
  var href = '#/method/' + (method || 'cv');
  return '<p style="margin-top:14px"><span style="color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em">可借鉴的通用技术</span></p>' +
    '<div class="refs">' + list.map(function (r) {
      return '<a class="ref" href="' + href + '">' + esc(r) + '<span class="ar">↗</span></a>';
    }).join('') + '</div>';
}
function checklistHTML(items) {
  var rows = items.map(function (d, i) {
    return '<div class="cl-item" data-cl="' + i + '">' +
      '<span class="cl-box"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg></span>' +
      '<span><span class="cl-t">' + esc(d[0]) + '</span>' +
      '<span class="cl-s">' + esc(d[1]) + '</span></span>' +
      '<span class="cl-n">' + esc(d[2]) + '</span></div>';
  }).join('');
  return '<div class="checklist"><div class="cl-head">' +
    '<span>数据准备清单 · ' + items.length + ' 项</span>' +
    '<span class="cl-prog"><span id="cl-txt">0 / ' + items.length + '</span>' +
    '<span class="cl-bar"><i id="cl-fill"></i></span></span></div>' + rows + '</div>';
}
function dtableHTML(head, rows) {
  return '<table class="dtable"><thead><tr>' +
    head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
    '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td>' + rich(c) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
}

/* ---------- 结构化 spec → 标准 case 对象 ---------- */
function bake(spec) {
  if (!spec.id || !spec.sceneId) throw new Error('spec 缺 id / sceneId: ' + JSON.stringify(spec).slice(0, 80));
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(spec.id)) throw new Error('id 不规范: ' + spec.id);
  var bg = spec.bg || {}, wf = spec.wf || {};
  if (!bg.lede) throw new Error(spec.id + ' 缺 bg.lede');
  if (!Array.isArray(bg.judge) || bg.judge.length !== 4) throw new Error(spec.id + ' judge 必须恰好 4 格');
  if (!Array.isArray(bg.checklist) || bg.checklist.length < 3) throw new Error(spec.id + ' checklist 至少 3 项');
  if (!Array.isArray(wf.steps) || wf.steps.length < 3) throw new Error(spec.id + ' steps 至少 3 步');
  if (!Array.isArray(wf.fails) || wf.fails.length < 2) throw new Error(spec.id + ' fails 至少 2 条');
  if (!wf.metrics || !wf.metrics.table) throw new Error(spec.id + ' 缺 metrics.table');

  var method0 = (spec.methods && spec.methods[0]) || 'cv';

  var sections = [
    { no: 1, en: 'PROBLEM', title: '当前做法与问题', html: paras(bg.problem) },
    { no: 2, en: 'INTERVENTION', title: 'AI 能做什么', html: paras(bg.intervention) },
    {
      no: 3, en: 'DATA', title: '你需要准备什么',
      html: '<p style="margin-bottom:14px">' + rich(bg.dataIntro || '数据清单如下，按「先有再补」的顺序准备。') + '</p>' +
        checklistHTML(bg.checklist)
    },
    {
      no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
      html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px">' +
        dtagHTML(spec.diff || '中') +
        '<span class="small muted">' + rich(bg.diffNote || '') + '</span></div>' +
        meterHTML(spec.diff || '中') +
        paras(bg.difficulty) +
        refsHTML(bg.refs || [], method0)
    }
  ];

  var metricsHTML = paras(wf.metrics.paras) +
    dtableHTML(wf.metrics.table.head, wf.metrics.table.rows);

  return {
    id: spec.id,
    sceneId: spec.sceneId,
    methods: spec.methods || [method0],
    title: spec.title,
    version: spec.version || '1.0.0',
    updated: spec.updated || '2026-10-30',
    status: 'ready',
    tabs: {
      background: {
        label: '专业背景',
        lede: bg.lede,
        judge: bg.judge,
        sections: sections
      },
      workflow: {
        label: '案例流程',
        title: wf.title,
        lead: wf.lead || [],
        stats: wf.stats || [],
        steps: wf.steps,
        metrics: { title: wf.metrics.title || '怎么算"做对了"', html: metricsHTML },
        fails: wf.fails
      }
    }
  };
}

/* ---------- 输出 ---------- */
function emitJs(data) {
  var json = JSON.stringify(data, null, 2).split('\n').join('\n  ');
  return '/* =========================================================\n' +
    '   案例插件（静态注册版）：' + data.title + '\n' +
    '   ---------------------------------------------------------\n' +
    '   由 cases/' + data.id + '/case.json 生成（tools/build-cases.js）。\n' +
    '   修改案例内容请改源文件后重新生成，不要直接改本文件。\n' +
    '   ========================================================= */\n' +
    '(function (global) {\n' +
    '  \'use strict\';\n\n' +
    '  var DATA = ' + json + ';\n\n' +
    '  global.Cases.register(DATA);\n' +
    '})(window);\n';
}

function main() {
  var only = process.argv.slice(2);
  var files = fs.readdirSync(CONTENT_DIR).filter(function (f) {
    return f.endsWith('.js') && !f.startsWith('_');
  });
  var specs = [];
  files.forEach(function (f) {
    var arr = require(path.join(CONTENT_DIR, f));
    (Array.isArray(arr) ? arr : [arr]).forEach(function (s) { specs.push(s); });
  });

  var done = 0, errors = [];
  specs.forEach(function (spec) {
    if (only.length && only.indexOf(spec.sceneId) < 0 && only.indexOf(spec.id) < 0) return;
    try {
      var data = bake(spec);
      var caseDir = path.join(CASES_DIR, data.id);
      fs.mkdirSync(caseDir, { recursive: true });
      fs.writeFileSync(path.join(caseDir, 'case.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.writeFileSync(path.join(OUT_DIR, data.id + '.case.js'), emitJs(data), 'utf8');
      done++;
      console.log('OK  ' + data.sceneId + '  ' + data.id);
    } catch (e) {
      errors.push((spec.id || '?') + ': ' + e.message);
    }
  });

  console.log('\n编译完成 ' + done + ' / ' + specs.length);
  if (errors.length) {
    console.log('失败 ' + errors.length + ' 个:');
    errors.forEach(function (e) { console.log('  ✗ ' + e); });
    process.exitCode = 1;
  }
}

main();
