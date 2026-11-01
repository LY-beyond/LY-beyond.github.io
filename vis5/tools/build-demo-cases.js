/* =========================================================
   示范案例编译器 build-demo-cases.js
   ---------------------------------------------------------
   读取 cases/<id>/case.json 与 cases/<id>/demo/ 下的三个源文件，
   生成 assets/cases/<id>.case.js（静态注册版插件，内含示范文件）。

   用法：
     node tools/build-demo-cases.js               编译 cases 下所有含 demo/ 的案例
     node tools/build-demo-cases.js c1 c2 ...     只编译指定场景或案例
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CASES_DIR = path.join(ROOT, 'cases');
const OUT_DIR = path.join(ROOT, 'assets', 'cases');

const CORE_FILES = ['demo/index.html', 'demo/demo.js', 'demo/demo.css'];
const EXT_FILES = /\.(html|htm|js|mjs|css|json|csv|txt)$/i;

function padJson(obj) {
  return JSON.stringify(obj, null, 2).split('\n').join('\n  ');
}

function build(id) {
  const dir = path.join(CASES_DIR, id);
  const casePath = path.join(dir, 'case.json');
  if (!fs.existsSync(casePath)) throw new Error('缺少 ' + casePath);

  const data = JSON.parse(fs.readFileSync(casePath, 'utf8'));
  const meta = Object.assign({}, data.tabs.demo || {});
  delete data.tabs.demo;

  CORE_FILES.forEach(function (name) {
    if (!fs.existsSync(path.join(dir, name))) throw new Error(id + ' 缺少 ' + name);
  });

  const demoDir = path.join(dir, 'demo');
  const files = fs.readdirSync(demoDir).filter(function (name) {
    return EXT_FILES.test(name);
  }).map(function (name) {
    return { name: 'demo/' + name, data: fs.readFileSync(path.join(demoDir, name), 'utf8') };
  });

  const label = meta.label || '可运行示范';
  const intro = meta.intro || '';
  const height = Number(meta.height) || 760;

  const out =
    '/* =========================================================\n' +
    '   案例插件（静态注册版）：' + data.title + '\n' +
    '   ---------------------------------------------------------\n' +
    '   由 cases/' + id + '/case.json 与 demo/ 目录生成。\n' +
    '   修改案例内容请改源文件后重新生成，不要直接改本文件。\n' +
    '   ========================================================= */\n' +
    '(function (global) {\n' +
    '  \'use strict\';\n\n' +
    '  var DATA = ' + padJson(data) + ';\n\n' +
    '  var FILES = ' + padJson(files) + ';\n\n' +
    '  var demoHandle = null;\n' +
    '  DATA.tabs.demo = {\n' +
    '    label: ' + JSON.stringify(label) + ',\n' +
    '    intro: ' + JSON.stringify(intro) + ',\n' +
    '    mode: \'page\',\n' +
    '    height: ' + height + ',\n' +
    '    mount: function (root, ctx) {\n' +
    '      if (!global.CaseDemoHost) return;\n' +
    '      demoHandle = global.CaseDemoHost.create(root, {\n' +
    '        files: FILES,\n' +
    '        demo: { mode: \'page\', html: \'demo/index.html\', js: \'demo/demo.js\', height: ' + height + ' },\n' +
    '        meta: { title: DATA.title }\n' +
    '      }, ctx);\n' +
    '    },\n' +
    '    unmount: function () {\n' +
    '      if (demoHandle) { try { demoHandle.destroy(); } catch (e) { } demoHandle = null; }\n' +
    '    }\n' +
    '  };\n\n' +
    '  global.Cases.register(DATA);\n' +
    '})(window);\n';

  fs.writeFileSync(path.join(OUT_DIR, id + '.case.js'), out, 'utf8');
  return id;
}

function main() {
  const only = process.argv.slice(2);
  const ids = fs.readdirSync(CASES_DIR).filter(function (id) {
    return fs.existsSync(path.join(CASES_DIR, id, 'demo'));
  });
  let done = 0;
  ids.forEach(function (id) {
    const data = JSON.parse(fs.readFileSync(path.join(CASES_DIR, id, 'case.json'), 'utf8'));
    if (only.length && only.indexOf(id) < 0 && only.indexOf(data.sceneId) < 0) return;
    try {
      build(id);
      done++;
      console.log('OK  ' + data.sceneId + '  ' + id);
    } catch (e) {
      console.log('✗  ' + id + ': ' + e.message);
      process.exitCode = 1;
    }
  });
  console.log('\n示范案例编译完成 ' + done + ' 个');
}

main();
