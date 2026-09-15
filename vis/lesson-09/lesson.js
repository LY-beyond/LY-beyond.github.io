// =========================================================
// lesson-09/lesson.js —— 第 9 章 综合案例：作品集网站
//   8 个演示，逐步搭建：d-9-1 … d-9-8
// =========================================================

import { initLesson } from '../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* =========================================================
 * 9.1 案例规划与线框图
 * ======================================================= */
window.DEMOS['d-9-1'] = function (mount) {
  const BLOCKS = [
    { name: 'site-header', desc: '导航' },
    { name: 'hero',        desc: '首屏介绍' },
    { name: 'about',       desc: '关于我' },
    { name: 'works',       desc: '作品集' },
    { name: 'stats',       desc: '数据统计' },
    { name: 'site-footer', desc: '联系 + 页脚' },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">阶段
          <select class="js-mode">
            <option value="wire">① 线框图（只有骨架）</option>
            <option value="fill">② 内容填充</option>
          </select>
        </label>
      </div>

      <div class="js-stage" style="display:flex;flex-direction:column;gap:8px;background:var(--c-surface);padding:14px;"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const note  = mount.querySelector('.js-note');

  function update() {
    const wire = sel.value === 'wire';

    stage.innerHTML = BLOCKS.map((b, i) => {
      if (wire) {
        return `<div style="height:38px;border:1px dashed #b8b2a8;background:#e8e6e1;
                    border-radius:6px;display:grid;place-items:center;color:#8b8578;font-size:12px;">
                  ${b.name}
                </div>`;
      }
      const colors = ['var(--c-surface-2)', 'var(--c-primary-weak)', 'var(--c-surface-2)',
                      'var(--c-surface-2)', 'var(--c-surface-2)', 'var(--c-surface-2)'];
      return `<div style="height:38px;background:${colors[i]};border:1px solid var(--c-border);
                  border-radius:6px;display:flex;align-items:center;justify-content:space-between;
                  padding:0 14px;font-size:12.5px;">
                <span style="font-family:var(--font-mono);color:var(--c-muted);">${b.name}</span>
                <span style="font-weight:700;color:var(--c-primary);">${b.desc}</span>
              </div>`;
    }).join('');

    note.textContent = wire
      ? '→ 线框阶段：只有区块名和顺序，不纠结颜色与文案——这时改结构最便宜。'
      : '→ 内容填充：骨架（顺序、高度、位置）完全没变，只是把真实内容放进去。';
  }

  sel.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.2 页面骨架与栅格
 * ======================================================= */
window.DEMOS['d-9-2'] = function (mount) {
  const BLOCKS = ['nav', 'hero', 'about', 'works', 'stats', 'footer'];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">容器最大宽度
          <input type="range" min="520" max="1000" value="820" data-c="w">
          <span class="val" data-out="w">820</span>
        </label>
        <label class="demo-control">列间距 gap
          <input type="range" min="4" max="40" value="16" data-c="g">
          <span class="val" data-out="g">16</span>
        </label>
      </div>

      <div class="js-wrap" style="overflow:auto;padding-bottom:6px;">
        <div class="js-container" style="margin:0 auto;position:relative;transition:width .15s;">
          <div class="js-guides"
               style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);pointer-events:none;"></div>
          <div class="js-content" style="position:relative;z-index:1;display:grid;grid-template-columns:repeat(12,1fr);"></div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const wrap = mount.querySelector('.js-container');
  const guides = mount.querySelector('.js-guides');
  const content = mount.querySelector('.js-content');
  const note = mount.querySelector('.js-note');

  guides.innerHTML = Array.from({ length: 12 }, () =>
    `<div style="background:rgba(15,118,110,.09);border-radius:3px;"></div>`).join('');

  function update() {
    const w = +mount.querySelector('[data-c="w"]').value;
    const g = +mount.querySelector('[data-c="g"]').value;

    mount.querySelector('[data-out="w"]').textContent = w;
    mount.querySelector('[data-out="g"]').textContent = g;

    wrap.style.width = w + 'px';
    guides.style.gap = g + 'px';
    content.style.gap = g + 'px';

    content.innerHTML = BLOCKS.map((b, i) => `
      <div style="grid-column:span 12;height:32px;border-radius:6px;margin-bottom:${g}px;
                  background:${i === 1 ? 'var(--c-primary)' : 'var(--c-surface-2)'};
                  color:${i === 1 ? '#fff' : 'var(--c-text-soft)'};
                  border:1px solid var(--c-border);display:grid;place-items:center;font-size:12px;font-weight:700;">
        ${b}
      </div>`).join('');

    note.textContent = '→ 无论容器多宽、间距多大，六个区块的左右边界始终一致——因为它们共用同一个容器与栅格。';
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* =========================================================
 * 9.3 顶部导航栏
 * ======================================================= */
window.DEMOS['d-9-3'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">菜单项数量
          <input type="range" min="2" max="6" value="4" data-c="n">
          <span class="val" data-out="n">4</span>
        </label>
        <label class="demo-control">分布方式
          <select class="js-justify">
            <option value="space-between">space-between（推荐）</option>
            <option value="center">center</option>
            <option value="flex-start">flex-start</option>
          </select>
        </label>
      </div>

      <div class="demo-stage" style="padding:0;overflow:hidden;background:var(--c-surface);">
        <div class="js-bar" style="display:flex;align-items:center;height:56px;padding:0 18px;
                    border-bottom:1px solid var(--c-border);background:var(--c-surface-2);">
          <div style="font-weight:800;color:var(--c-primary);font-family:var(--font-mono);">LX.</div>
          <nav class="js-menu" style="display:flex;gap:6px;"></nav>
        </div>
      </div>

      <pre class="demo-code js-code"></pre>
    </div>`;

  const bar  = mount.querySelector('.js-bar');
  const menu = mount.querySelector('.js-menu');
  const jus  = mount.querySelector('.js-justify');
  const code = mount.querySelector('.js-code');

  const ITEMS = ['首页', '作品', '关于', '博客', '联系', '更多'];

  function update() {
    const n = +mount.querySelector('[data-c="n"]').value;
    mount.querySelector('[data-out="n"]').textContent = n;

    menu.innerHTML = ITEMS.slice(0, n)
      .map(t => `<a style="padding:6px 10px;border-radius:6px;font-size:13px;
                     font-weight:600;color:var(--c-text-soft);background:var(--c-surface);">${t}</a>`)
      .join('');

    bar.style.justifyContent = jus.value;

    code.textContent =
`.site-header .inner {
  display: flex;
  align-items: center;
  justify-content: ${jus.value};
  height: 56px;
}
nav { display: flex; gap: 6px; }   /* 菜单项之间：紧 */`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  jus.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.4 首屏 Hero
 * ======================================================= */
window.DEMOS['d-9-4'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">标题字号
          <input type="range" min="22" max="52" value="38" data-c="fs">
          <span class="val" data-out="fs">38</span>
        </label>
        <label class="demo-control">上下留白
          <input type="range" min="10" max="64" value="36" data-c="pad">
          <span class="val" data-out="pad">36</span>
        </label>
        <label class="demo-control">左右比例
          <select class="js-ratio">
            <option value="7fr 5fr">7 : 5（推荐）</option>
            <option value="1fr 1fr">1 : 1</option>
            <option value="5fr 7fr">5 : 7</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);padding:0;overflow:hidden;">
        <div class="js-grid" style="display:grid;gap:20px;align-items:center;padding:0 18px;">
          <div>
            <h4 class="js-title" style="margin:0 0 10px;line-height:1.2;">你好，我是李雷</h4>
            <p style="margin:0 0 16px;font-size:14px;color:var(--c-text-soft);">
              专注于 Web 前端与数据可视化，喜欢把复杂的信息整理得清晰好看。
            </p>
            <span class="js-cta" style="display:inline-block;background:var(--c-primary);color:#fff;
                         padding:10px 20px;border-radius:999px;font-size:13px;font-weight:700;">联系我</span>
          </div>
          <div style="aspect-ratio:1/1;border-radius:16px;background:var(--c-primary-weak);
                      display:grid;place-items:center;color:var(--c-primary);font-weight:700;font-size:13px;">
            头像 / 主视觉
          </div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const grid  = mount.querySelector('.js-grid');
  const title = mount.querySelector('.js-title');
  const ratio = mount.querySelector('.js-ratio');
  const note  = mount.querySelector('.js-note');

  function update() {
    const fs  = +mount.querySelector('[data-c="fs"]').value;
    const pad = +mount.querySelector('[data-c="pad"]').value;

    mount.querySelector('[data-out="fs"]').textContent  = fs;
    mount.querySelector('[data-out="pad"]').textContent = pad;

    title.style.fontSize = fs + 'px';
    grid.style.paddingTop = pad + 'px';
    grid.style.paddingBottom = pad + 'px';
    grid.style.gridTemplateColumns = ratio.value;

    const span = fs - 14;   // 标题与正文的字号跨度
    note.textContent = span >= 18
      ? `→ 标题 ${fs}px / 正文 14px，跨度 ${span}px：层次清晰，主角明确 ✔`
      : `→ 标题 ${fs}px / 正文 14px，跨度只有 ${span}px：主次不够分明，访客会"找不到重点" ✘`;
    note.style.color = span >= 18 ? 'var(--c-success)' : 'var(--c-danger)';
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  ratio.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.5 关于我（双栏）
 * ======================================================= */
window.DEMOS['d-9-5'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">图文比例
          <select class="js-ratio">
            <option value="3fr 9fr">3 : 9</option>
            <option value="4fr 8fr" selected>4 : 8（推荐）</option>
            <option value="5fr 7fr">5 : 7</option>
            <option value="6fr 6fr">6 : 6（均分）</option>
          </select>
        </label>
        <label class="demo-control">对齐方式
          <select class="js-align">
            <option value="start">start（长文推荐）</option>
            <option value="center">center（短文）</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);padding:18px;">
        <div class="js-grid" style="display:grid;gap:22px;">
          <div style="aspect-ratio:4/5;border-radius:14px;background:var(--c-primary-weak);
                      display:grid;place-items:center;color:var(--c-primary);font-weight:700;font-size:13px;">
            头像 / 照片
          </div>
          <div>
            <h4 style="margin:0 0 10px;font-size:19px;">关于我</h4>
            <p style="margin:0 0 12px;font-size:13.5px;line-height:1.9;color:var(--c-text-soft);">
              我是一名在校学生，主修软件工程。过去两年里做过若干课程项目与小型产品，
              逐步把兴趣锁定在<b>前端布局与信息设计</b>上。
            </p>
            <p style="margin:0;font-size:13.5px;line-height:1.9;color:var(--c-text-soft);">
              我相信"把复杂的东西讲清楚"本身就是一种能力，
              所以也喜欢写教程、做教学页面。
            </p>
          </div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const grid  = mount.querySelector('.js-grid');
  const ratio = mount.querySelector('.js-ratio');
  const align = mount.querySelector('.js-align');
  const note  = mount.querySelector('.js-note');

  function update() {
    grid.style.gridTemplateColumns = ratio.value;
    grid.style.alignItems = align.value;

    const even = ratio.value.startsWith('6fr');
    note.textContent = even
      ? '→ 1:1 均分：图片偏大、文字行偏长，两边都不太舒服 ✘'
      : `→ 图片栏较小、文字栏较宽（${ratio.value.replace('fr', ' : ').replace(' ', '')}），阅读更顺畅 ✔`;
    note.style.color = even ? 'var(--c-danger)' : 'var(--c-success)';
  }

  ratio.addEventListener('change', update);
  align.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.6 作品集卡片墙
 * ======================================================= */
window.DEMOS['d-9-6'] = function (mount) {
  const TITLES = ['课程作业：天气可视化', '校园导航小程序', '数据看板原型',
                  '个人博客模板', '图表组件库', '在线简历生成器',
                  '读书笔记系统', '旅行足迹地图'];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">最小卡片宽度
          <input type="range" min="150" max="320" value="220" data-c="m">
          <span class="val" data-out="m">220</span>
        </label>
        <label class="demo-control">卡片间距
          <input type="range" min="8" max="40" value="20" data-c="g">
          <span class="val" data-out="g">20</span>
        </label>
        <label class="demo-control">卡片数量
          <input type="range" min="2" max="8" value="6" data-c="n">
          <span class="val" data-out="n">6</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface-2);padding:16px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  function update() {
    const m = +mount.querySelector('[data-c="m"]').value;
    const g = +mount.querySelector('[data-c="g"]').value;
    const n = +mount.querySelector('[data-c="n"]').value;

    mount.querySelector('[data-out="m"]').textContent = m;
    mount.querySelector('[data-out="g"]').textContent = g;
    mount.querySelector('[data-out="n"]').textContent = n;

    stage.style.gridTemplateColumns = `repeat(auto-fit, minmax(${m}px, 1fr))`;
    stage.style.gap = g + 'px';
    stage.style.display = 'grid';

    stage.innerHTML = TITLES.slice(0, n).map((t, i) => `
      <div style="display:flex;flex-direction:column;padding:14px;background:var(--c-surface);
                  border:1px solid var(--c-border);border-radius:12px;">
        <div style="aspect-ratio:16/10;border-radius:8px;margin-bottom:10px;
                    background:linear-gradient(135deg, var(--d${(i % 6) + 1}), var(--c-primary-weak));"></div>
        <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;">${t}</div>
        <div style="font-size:11.5px;color:var(--c-muted);">Web · 2026</div>
        <div style="margin-top:auto;padding-top:10px;border-top:1px dashed var(--c-border);
                    font-size:12.5px;font-weight:700;color:var(--c-primary);">查看详情 →</div>
      </div>`).join('');

    code.textContent =
`.wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${m}px, 1fr));
  gap: ${g}px;
}
/* 卡片 + aspect-ratio 统一缩略图高度 → 整面墙对齐 */`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* =========================================================
 * 9.7 数据统计区
 * ======================================================= */
window.DEMOS['d-9-7'] = function (mount) {
  const PRESETS = {
    '标准（4 列 + 通栏图表）': { cols: 4, chart: 4 },
    '图表优先（大图占半行）':  { cols: 4, chart: 2 },
    '窄屏（2 列 + 通栏）':     { cols: 2, chart: 2 },
  };

  const STATS = [
    { num: '24',  lbl: '完成项目' },
    { num: '6',   lbl: '课程 A+' },
    { num: '380', lbl: '提交次数' },
    { num: '2',   lbl: '实习经历' },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">跨列方案
          <select class="js-p">
            ${Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="display:grid;gap:12px;background:var(--c-surface-2);padding:16px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-p');
  const code  = mount.querySelector('.js-code');

  function update() {
    const p = PRESETS[sel.value];
    stage.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;

    stage.innerHTML = STATS.map(s => `
      <div style="display:flex;flex-direction:column;gap:4px;padding:14px;
                  background:var(--c-surface);border:1px solid var(--c-border);border-radius:10px;">
        <span style="font-size:26px;font-weight:700;color:var(--c-primary);line-height:1.1;">${s.num}</span>
        <span style="font-size:12px;color:var(--c-muted);">${s.lbl}</span>
      </div>`).join('') + `
      <div style="grid-column:span ${p.chart};min-height:120px;border-radius:10px;
                  background:var(--c-surface);border:1px dashed var(--c-border-2);
                  display:grid;place-items:center;color:var(--c-muted);font-size:13px;font-weight:700;">
        大图表（趋势图）
      </div>`;

    code.textContent =
`.stats .grid { display: grid; grid-template-columns: repeat(${p.cols}, 1fr); gap: 12px; }

.stat        { display: flex; flex-direction: column; gap: 4px; }  /* 数字与说明：紧 */
.stat .num   { font-size: 26px; font-weight: 700; }
.stat .lbl   { font-size: 12px; color: var(--c-muted); }

.chart       { grid-column: span ${p.chart}; }   /* 跨列 → 大图占位 */`;
  }

  sel.addEventListener('change', update);
  update();
};

/* =========================================================
 * 9.8 响应式与设计自查
 * ======================================================= */
window.DEMOS['d-9-8'] = function (mount) {
  const CHECKLIST = [
    '所有元素对齐到同一条线',
    '组内间距 < 组间间距',
    '最重要内容的字号跨度 ≥ 18px',
    '同类元素圆角 / 阴影一致',
    '分组清晰到不需要文字说明',
    '左右视觉重量基本平衡',
    '间距全部来自同一套档位',
    '手机宽度下仍可顺畅阅读',
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">屏幕宽度
          <input type="range" min="320" max="900" value="860" data-c="w">
          <span class="val" data-out="w">860</span>
        </label>
        <span class="js-bp" style="font-size:12.5px;font-weight:700;color:var(--c-primary);"></span>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:16px;align-items:start;">
        <div style="overflow:auto;">
          <div class="js-frame" style="margin:0 auto;border:1px solid var(--c-border);border-radius:10px;
                      overflow:hidden;background:var(--c-surface);transition:width .15s;"></div>
        </div>
        <div class="js-check" style="font-size:12px;color:var(--c-text-soft);"></div>
      </div>
    </div>`;

  const frame = mount.querySelector('.js-frame');
  const bp    = mount.querySelector('.js-bp');
  const check = mount.querySelector('.js-check');

  function render(w) {
    const narrow = w < 520;
    const mid    = w < 760;
    const pad    = narrow ? 12 : 20;

    frame.innerHTML = `
      <div style="height:34px;display:flex;align-items:center;justify-content:space-between;
                  padding:0 ${pad}px;border-bottom:1px solid var(--c-border);background:var(--c-surface-2);">
        <span style="font-weight:800;font-family:var(--font-mono);color:var(--c-primary);font-size:12px;">LX.</span>
        <span style="font-size:11px;color:var(--c-text-soft);">${narrow ? '☰' : '首页 · 作品 · 关于 · 联系'}</span>
      </div>

      <div style="display:grid;gap:14px;padding:${pad}px;
                  grid-template-columns:${narrow ? '1fr' : '7fr 5fr'};align-items:center;">
        <div>
          <div style="font-size:${narrow ? 18 : 24}px;font-weight:700;line-height:1.25;margin-bottom:6px;">
            你好，我是李雷
          </div>
          <div style="font-size:11.5px;color:var(--c-text-soft);margin-bottom:10px;">
            专注于 Web 前端与数据可视化
          </div>
          <span style="display:inline-block;background:var(--c-primary);color:#fff;padding:6px 14px;
                       border-radius:999px;font-size:11px;font-weight:700;">联系我</span>
        </div>
        <div style="aspect-ratio:1/1;border-radius:12px;background:var(--c-primary-weak);
                    display:grid;place-items:center;color:var(--c-primary);font-size:11px;font-weight:700;">头像</div>
      </div>

      <div style="display:grid;gap:14px;padding:0 ${pad}px ${pad}px;
                  grid-template-columns:${narrow ? '1fr' : '4fr 8fr'};">
        <div style="aspect-ratio:4/5;border-radius:10px;background:var(--c-surface-2);"></div>
        <div style="font-size:11.5px;line-height:1.9;color:var(--c-text-soft);">
          我是一名在校学生，主修软件工程。过去两年做过若干课程项目与小型产品，
          逐步把兴趣锁定在前端布局与信息设计上。
        </div>
      </div>

      <div style="padding:0 ${pad}px ${pad}px;">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;">作品集</div>
        <div style="display:grid;gap:10px;
                    grid-template-columns:repeat(auto-fit, minmax(${narrow ? 110 : 130}px, 1fr));">
          ${Array.from({ length: 4 }, (_, i) => `
            <div style="padding:8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:8px;">
              <div style="aspect-ratio:16/10;border-radius:5px;margin-bottom:6px;
                          background:linear-gradient(135deg, var(--d${i + 1}), var(--c-primary-weak));"></div>
              <div style="font-size:10.5px;font-weight:700;color:var(--c-text-soft);">项目 ${i + 1}</div>
            </div>`).join('')}
        </div>
      </div>

      <div style="background:var(--c-surface-2);padding:14px ${pad}px;border-top:1px solid var(--c-border);
                  text-align:center;font-size:10.5px;color:var(--c-muted);">
        © 2026 李雷 · 保持联系
      </div>`;

    frame.style.width = w + 'px';
    bp.textContent = narrow ? '→ 手机布局（单列）' : (mid ? '→ 平板布局' : '→ 桌面布局（双栏）');

    check.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;color:var(--c-text);">✅ 设计自查清单</div>
      ${CHECKLIST.map(t => `
        <div style="display:flex;gap:6px;padding:3px 0;line-height:1.5;">
          <span style="color:var(--c-success);">✓</span><span>${t}</span>
        </div>`).join('')}`;
  }

  function update() {
    const w = +mount.querySelector('[data-c="w"]').value;
    mount.querySelector('[data-out="w"]').textContent = w;
    render(w);
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* =========================================================
 * 启动
 * ======================================================= */
initLesson('lesson-09');
