// =========================================================
// lesson-04/lesson.js —— 第 4 章 布局模式选型
//   演示：d-4-1 圣杯布局 / d-4-2 卡片墙 / d-4-3 仪表盘栅格
// =========================================================

import { initLesson } from '../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * 演示 6.1 —— 圣杯布局变体
 * ------------------------------------------------------- */
window.DEMOS['d-4-1'] = function (mount) {
  const VARIANTS = {
    经典三栏: {
      cols: '80px 1fr 70px',
      areas: ['header header header', 'left main right', 'footer footer footer'],
    },
    去掉右栏: {
      cols: '80px 1fr',
      areas: ['header header', 'left main', 'footer footer'],
    },
    单列堆叠: {
      cols: '1fr',
      areas: ['header', 'left', 'main', 'right', 'footer'],
    },
  };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">布局变体
          <select class="js-v">
            ${Object.keys(VARIANTS).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="js-stage"
           style="display:grid;gap:8px;padding:10px;background:var(--c-surface-2);border-radius:8px;min-height:230px;font-size:12px;font-weight:700;">
        <div style="grid-area:header;background:var(--d1);color:#fff;padding:10px;border-radius:6px;">header 页头</div>
        <div style="grid-area:left;background:var(--d2);color:#fff;padding:10px;border-radius:6px;">left<br>侧栏</div>
        <div style="grid-area:main;background:var(--d3);color:#fff;padding:10px;border-radius:6px;">main 主内容区</div>
        <div style="grid-area:right;background:var(--d5);color:#fff;padding:10px;border-radius:6px;">right<br>侧栏</div>
        <div style="grid-area:footer;background:var(--d4);color:#fff;padding:10px;border-radius:6px;">footer 页脚</div>
      </div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-v');
  const code  = mount.querySelector('.js-code');

  function update() {
    const v = VARIANTS[sel.value];
    const areasCss = v.areas.map(a => `"${a}"`).join(' ');

    stage.style.gridTemplateColumns = v.cols;
    stage.style.gridTemplateAreas   = areasCss;

    code.textContent =
`.layout {
  display: grid;
  grid-template-columns: ${v.cols};
  grid-template-areas:
${v.areas.map(a => `    "${a}"`).join('\n')};
}`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 6.2 —— 卡片墙
 * ------------------------------------------------------- */
window.DEMOS['d-4-2'] = function (mount) {
  const N = 9;

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">最小列宽
          <input type="range" min="120" max="320" value="200" data-c="min">
          <span class="val" data-out="min">200</span>
        </label>
        <label class="demo-control">间距 gap
          <input type="range" min="4" max="40" value="20" data-c="gap">
          <span class="val" data-out="gap">20</span>
        </label>
      </div>

      <div class="js-stage" style="display:grid;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = Array.from({ length: N }, (_, i) => `
    <div style="padding:16px;border-radius:8px;background:var(--c-surface);border:1px solid var(--c-border);font-size:12.5px;font-weight:700;color:var(--c-primary);">
      卡片 ${i + 1}
    </div>`).join('');

  function update() {
    const min = +mount.querySelector('[data-c="min"]').value;
    const gap = +mount.querySelector('[data-c="gap"]').value;

    mount.querySelector('[data-out="min"]').textContent = min;
    mount.querySelector('[data-out="gap"]').textContent = gap;

    stage.style.gridTemplateColumns = `repeat(auto-fit, minmax(${min}px, 1fr))`;
    stage.style.gap = gap + 'px';

    code.textContent =
`.wall {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${min}px, 1fr));
  gap: ${gap}px;
}`;
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * 演示 6.3 —— 仪表盘栅格
 * ------------------------------------------------------- */
window.DEMOS['d-4-3'] = function (mount) {
  const MODULES = ['指标 A', '指标 B', '指标 C', '趋势图', '分布图', '明细表'];

  const PRESETS = {
    '标准（4 列）':     { cols: 4, spans: [1, 1, 1, 1, 2, 2] },
    '大图优先（4 列）': { cols: 4, spans: [2, 2, 4, 4, 2, 2] },
    '窄屏堆叠（2 列）': { cols: 2, spans: [1, 1, 2, 2, 2, 2] },
  };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">布局预设
          <select class="js-p">
            ${Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="js-stage" style="display:grid;gap:10px;min-height:230px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-p');
  const code  = mount.querySelector('.js-code');

  stage.innerHTML = MODULES.map((m, i) => `
    <div data-i="${i}"
         style="padding:16px;border-radius:8px;background:var(--d${(i % 6) + 1});color:#fff;
                font-weight:700;font-size:12.5px;display:grid;place-items:center;min-height:54px;">
      ${m}
    </div>`).join('');

  function update() {
    const p = PRESETS[sel.value];

    stage.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;
    stage.querySelectorAll('[data-i]').forEach((el, i) => {
      el.style.gridColumn = `span ${p.spans[i]}`;
    });

    code.textContent =
`.dashboard {
  display: grid;
  grid-template-columns: repeat(${p.cols}, 1fr);
  gap: 10px;
}
/* 模块跨列：${p.spans.map((s, i) => `模块${i + 1} = span ${s}`).join('，')} */`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 启动
 * ------------------------------------------------------- */
initLesson('lesson-04');
