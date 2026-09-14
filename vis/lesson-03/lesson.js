// =========================================================
// lesson-03/lesson.js —— 第 3 章 栅格系统与间距节奏
//   演示：d-3-1 12 列栅格 / d-3-2 8pt 间距节奏 / d-3-3 对齐检查
// =========================================================

import { initLesson } from '../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * 演示 3.1 —— 12 列栅格
 * ------------------------------------------------------- */
window.DEMOS['d-3-1'] = function (mount) {
  const BLOCKS = [
    { name: '主内容区', span: 8,  color: 'var(--c-primary)' },
    { name: '侧栏',     span: 4,  color: 'var(--d2)' },
    { name: '通栏横幅', span: 12, color: 'var(--d3)' },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls js-c"></div>

      <div class="demo-stage js-stage"
           style="position:relative;display:grid;grid-template-columns:repeat(12,1fr);gap:8px;background:var(--c-surface);padding:0;">
        <div class="js-guides"
             style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);gap:8px;pointer-events:none;"></div>
      </div>

      <pre class="demo-code js-code"></pre>
    </div>`;

  const wrap   = mount.querySelector('.js-c');
  const stage  = mount.querySelector('.js-stage');
  const guides = mount.querySelector('.js-guides');
  const code   = mount.querySelector('.js-code');

  guides.innerHTML = Array.from({ length: 12 }, () =>
    `<div style="background:rgba(15,118,110,.10);border-radius:3px;"></div>`).join('');

  wrap.innerHTML = BLOCKS.map((b, i) => `
    <label class="demo-control">${b.name}
      <input type="range" min="1" max="12" value="${b.span}" data-b="${i}">
      <span class="val" data-out="${i}">${b.span}</span>
    </label>`).join('');

  stage.insertAdjacentHTML('beforeend', BLOCKS.map((b, i) => `
    <div class="js-blk" data-i="${i}"
         style="position:relative;z-index:1;grid-column:span ${b.span};background:${b.color};color:#fff;
                border-radius:8px;padding:14px;font-size:13px;font-weight:700;text-align:center;">
      ${b.name}
    </div>`).join(''));

  function update() {
    const spans = [...mount.querySelectorAll('[data-b]')].map(i => +i.value);

    spans.forEach((s, i) => {
      mount.querySelector(`[data-out="${i}"]`).textContent = s;
      mount.querySelector(`.js-blk[data-i="${i}"]`).style.gridColumn = `span ${s}`;
    });

    code.textContent =
`.grid-12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; }

${BLOCKS.map((b, i) => `.col-${spans[i]} { grid-column: span ${spans[i]}; }`).join('\n')}`;
  }

  mount.querySelectorAll('[data-b]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * 演示 3.2 —— 随手值 vs 8pt 节奏
 * ------------------------------------------------------- */
window.DEMOS['d-3-2'] = function (mount) {
  // 同一份内容，两套间距
  const RANDOM  = { pad: 13, gapIn: 7,  gapOut: 19, titleGap: 11, pad2: 23, gapIn2: 9,  gapOut2: 17 };
  const SCALE   = { pad: 16, gapIn: 8,  gapOut: 24, titleGap: 8,  pad2: 24, gapIn2: 8,  gapOut2: 16 };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">间距方案
          <select class="js-mode">
            <option value="rand">随手值（13 / 7 / 19 …）</option>
            <option value="scale">8pt 节奏（8 / 16 / 24）</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const code  = mount.querySelector('.js-code');

  function update() {
    const isRand = sel.value === 'rand';
    const S = isRand ? RANDOM : SCALE;

    stage.innerHTML = `
      <div style="margin-bottom:${S.gapOut}px;">
        <div style="padding:${S.pad}px;background:var(--c-primary);color:#fff;border-radius:8px;font-weight:700;font-size:14px;">
          第一个分组
        </div>
        <div style="display:flex;flex-direction:column;gap:${S.gapIn}px;margin-top:${S.titleGap}px;">
          <div style="padding:${S.pad}px;background:var(--c-surface-2);border-radius:8px;font-size:13px;">条目 A</div>
          <div style="padding:${S.pad}px;background:var(--c-surface-2);border-radius:8px;font-size:13px;">条目 B</div>
        </div>
      </div>

      <div style="margin-bottom:${S.gapOut2}px;">
        <div style="padding:${S.pad2}px;background:var(--c-primary-weak);color:var(--c-primary);border-radius:8px;font-weight:700;font-size:14px;">
          第二个分组
        </div>
        <div style="display:flex;flex-direction:column;gap:${S.gapIn2}px;margin-top:${S.titleGap}px;">
          <div style="padding:${S.pad2}px;background:var(--c-surface-2);border-radius:8px;font-size:13px;">条目 C</div>
        </div>
      </div>`;

    code.textContent = isRand
      ? `/* 随手值：每个数字都不成体系 */
padding: 13px;   gap: 7px;    margin: 19px;
padding: 23px;   gap: 9px;    margin: 17px;   /* 节奏被打断 */`
      : `/* 8pt 节奏：所有值都来自同一套档位 */
padding: 16px;   gap: 8px;    margin: 24px;
padding: 24px;   gap: 8px;    margin: 16px;   /* 整齐且可复用 */`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 3.3 —— 栅格叠加层检查对齐
 * ------------------------------------------------------- */
window.DEMOS['d-3-3'] = function (mount) {
  const MODES = {
    ok:  { head: 12, cards: [4, 4, 4], jitter: [0, 0, 0], pads: [14, 14, 14] },
    bad: { head: 11, cards: [4, 4, 3], jitter: [0, 10, 0], pads: [14, 18, 14] },
  };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">状态
          <select class="js-mode">
            <option value="ok">对齐到栅格</option>
            <option value="bad">跑偏（常见问题）</option>
          </select>
        </label>
        <label class="demo-control">
          <input type="checkbox" class="js-overlay" checked> 显示栅格叠加层
        </label>
      </div>

      <div class="demo-stage js-stage"
           style="position:relative;background:var(--c-surface);padding:0;overflow:hidden;">
        <div class="js-guides"
             style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(12,1fr);
                    gap:8px;padding:12px;box-sizing:border-box;pointer-events:none;"></div>
        <div class="js-content"
             style="position:relative;z-index:1;padding:12px;display:grid;
                    grid-template-columns:repeat(12,1fr);gap:8px;"></div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;"></p>
    </div>`;

  const guides  = mount.querySelector('.js-guides');
  const content = mount.querySelector('.js-content');
  const sel     = mount.querySelector('.js-mode');
  const over    = mount.querySelector('.js-overlay');
  const note    = mount.querySelector('.js-note');

  guides.innerHTML = Array.from({ length: 12 }, () =>
    `<div style="background:rgba(15,118,110,.10);border-radius:3px;"></div>`).join('');

  function update() {
    const m = MODES[sel.value];

    content.innerHTML = `
      <div style="grid-column:span ${m.head};background:var(--c-primary);color:#fff;border-radius:8px;
                  padding:12px;font-size:13px;font-weight:700;text-align:center;">页头</div>
      ${m.cards.map((c, i) => `
        <div style="grid-column:span ${c};margin-left:${m.jitter[i]}px;padding:${m.pads[i]}px;
                    background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:8px;
                    font-size:12.5px;text-align:center;">卡片 ${i + 1}</div>`).join('')}`;

    guides.style.display = over.checked ? 'grid' : 'none';

    if (sel.value === 'ok') {
      note.textContent = '→ 所有元素都落在列线上：左边齐、右边齐、间距一致 ✔';
      note.style.color = 'var(--c-success)';
    } else {
      note.textContent = '→ 打开栅格后一眼可见：页头少占 1 列、第二张卡片额外偏移、第三张宽度不足 ✘';
      note.style.color = 'var(--c-danger)';
    }
  }

  sel.addEventListener('change', update);
  over.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 启动
 * ------------------------------------------------------- */
initLesson('lesson-03');
