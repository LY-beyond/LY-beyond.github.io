// =========================================================
// lesson-02/lesson.js —— 第 2 章 从需求到页面骨架
//   演示：d-2-1 内容优先级 / d-2-2 阅读模式 / d-2-3 线框图
// =========================================================

import { initLesson } from '../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * 演示 2.1 —— 内容优先级排序
 * ------------------------------------------------------- */
window.DEMOS['d-2-1'] = function (mount) {
  const BLOCKS = {
    hero:     { name: '主标题 / 主视觉', h: 96 },
    cta:      { name: '行动按钮',        h: 44 },
    features: { name: '功能卡片 × 3',    h: 72 },
    footer:   { name: '页脚信息',        h: 36 },
  };

  let order = ['hero', 'features', 'cta', 'footer'];

  mount.innerHTML = `
    <div class="demo-card">
      <div style="display:grid;grid-template-columns:minmax(200px, 260px) 1fr;gap:20px;align-items:start;">
        <div>
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:var(--c-muted);letter-spacing:.08em;">内容清单（调整顺序）</p>
          <div class="js-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
        <div>
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:var(--c-muted);letter-spacing:.08em;">页面骨架预览</p>
          <div class="demo-stage js-preview" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
      </div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
    </div>`;

  const list    = mount.querySelector('.js-list');
  const preview = mount.querySelector('.js-preview');
  const note    = mount.querySelector('.js-note');

  function render() {
    list.innerHTML = order.map((k, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--c-border);border-radius:8px;background:var(--c-surface);font-size:13px;">
        <span style="font-family:var(--font-mono);color:var(--c-primary);font-weight:700;">${i + 1}</span>
        <span style="flex:1;">${BLOCKS[k].name}</span>
        <button data-up="${i}" style="border:1px solid var(--c-border);background:var(--c-surface-2);border-radius:6px;width:26px;height:26px;cursor:pointer;">↑</button>
        <button data-down="${i}" style="border:1px solid var(--c-border);background:var(--c-surface-2);border-radius:6px;width:26px;height:26px;cursor:pointer;">↓</button>
      </div>`).join('');

    preview.innerHTML = order.map((k, i) => `
      <div style="height:${BLOCKS[k].h}px;border-radius:8px;display:grid;place-items:center;
                  font-size:13px;font-weight:700;
                  background:${i === 0 ? 'var(--c-primary)' : 'var(--c-primary-weak)'};
                  color:${i === 0 ? '#fff' : 'var(--c-primary)'};">
        ${BLOCKS[k].name}
      </div>`).join('');

    note.textContent = `→ 排第一的「${BLOCKS[order[0]].name}」拿到了最大的版面和高亮色——这就是优先级在布局上的体现。`;

    list.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.up;
      if (i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; render(); }
    }));
    list.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.down;
      if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; render(); }
    }));
  }

  render();
};

/* ---------------------------------------------------------
 * 演示 2.2 —— 阅读模式与视线路径
 * ------------------------------------------------------- */
window.DEMOS['d-2-2'] = function (mount) {
  const MODES = {
    'F 型': {
      desc: '适合文字为主的页面：先横向扫两遍，再沿左边界纵向快速下拉。',
      lines: [[8, 16, 92, 16], [8, 46, 60, 46], [8, 16, 8, 86]],
      zones: [
        { l: 8,  t: 8,  w: 84, h: 16, n: '①' },
        { l: 8,  t: 38, w: 52, h: 16, n: '②' },
        { l: 8,  t: 58, w: 34, h: 34, n: '③' },
      ],
    },
    'Z 型': {
      desc: '适合单屏落地页：视线沿对角线走，行动按钮应落在右下终点。',
      lines: [[8, 16, 92, 16], [92, 16, 8, 86], [8, 86, 92, 86]],
      zones: [
        { l: 8,  t: 6,  w: 40, h: 20, n: '①' },
        { l: 52, t: 6,  w: 40, h: 20, n: '②' },
        { l: 8,  t: 72, w: 40, h: 20, n: '③' },
        { l: 52, t: 72, w: 40, h: 20, n: '④' },
      ],
    },
    '古腾堡图': {
      desc: '四象限模型：左上为主视觉区，右下为行动区，中段是容易被忽略的"弱视区"。',
      lines: [[8, 16, 92, 16], [92, 16, 92, 86], [92, 86, 8, 86], [8, 86, 8, 16]],
      zones: [
        { l: 8,  t: 6,  w: 40, h: 20, n: '主视觉' },
        { l: 52, t: 6,  w: 40, h: 20, n: '②' },
        { l: 8,  t: 72, w: 40, h: 20, n: '③' },
        { l: 52, t: 72, w: 40, h: 20, n: '行动区' },
      ],
    },
  };

  // 背景里的"页面骨架"（灰块）
  const MOCK = [
    { l: 8,  t: 4,  w: 84, h: 8 },
    { l: 8,  t: 30, w: 84, h: 6 },
    { l: 8,  t: 40, w: 84, h: 6 },
    { l: 8,  t: 62, w: 38, h: 6 },
    { l: 54, t: 62, w: 38, h: 6 },
    { l: 8,  t: 74, w: 84, h: 6 },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">阅读模式
          <select class="js-m">
            ${Object.keys(MODES).map(k => `<option>${k}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="position:relative;height:270px;background:var(--c-surface);overflow:hidden;">
        <svg class="js-svg" viewBox="0 0 100 100" preserveAspectRatio="none"
             style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></svg>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const svg   = mount.querySelector('.js-svg');
  const sel   = mount.querySelector('.js-m');
  const note  = mount.querySelector('.js-note');

  function update() {
    const m = MODES[sel.value];

    // 1) 背景骨架
    stage.querySelectorAll('.mock').forEach(e => e.remove());
    MOCK.forEach(b => {
      const d = document.createElement('div');
      d.className = 'mock';
      d.style.cssText =
        `position:absolute;left:${b.l}%;top:${b.t}%;width:${b.w}%;height:${b.h}px;` +
        `background:var(--c-surface-2);border-radius:4px;`;
      stage.appendChild(d);
    });

    // 2) 重点区
    stage.querySelectorAll('.zone').forEach(e => e.remove());
    m.zones.forEach(z => {
      const d = document.createElement('div');
      d.className = 'zone';
      d.textContent = z.n;
      d.style.cssText =
        `position:absolute;left:${z.l}%;top:${z.t}%;width:${z.w}%;height:${z.h}px;` +
        `background:rgba(234,88,12,.16);border:1px solid var(--c-accent);border-radius:6px;` +
        `color:var(--c-accent);font-size:11px;font-weight:700;display:grid;place-items:center;`;
      stage.appendChild(d);
    });

    // 3) 视线路径
    svg.innerHTML = m.lines.map(([x1, y1, x2, y2]) => `
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
            stroke="var(--d4)" stroke-width="2.5" stroke-dasharray="7 5"
            stroke-linecap="round" vector-effect="non-scaling-stroke" />`).join('');

    note.textContent = '→ ' + m.desc;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 2.3 —— 线框图 vs 高保真
 * ------------------------------------------------------- */
window.DEMOS['d-2-3'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">呈现方式
          <select class="js-mode">
            <option value="wire">线框图（先定骨架）</option>
            <option value="hi">高保真（后上皮肤）</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);display:flex;flex-direction:column;gap:10px;"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const note  = mount.querySelector('.js-note');

  // 骨架构架：两种皮肤共用同一套区块与顺序
  const LAYOUT = ['header', 'hero', 'cards', 'footer'];
  const META = {
    header: { wire: '页头导航', hi: '页面布局入门' },
    hero:   { wire: '主标题 / 主视觉', hi: '如何进行页面布局' },
    cards:  { wire: '功能卡片 ×3', hi: '三大原则 · 阅读模式 · 线框图' },
    footer: { wire: '页脚信息', hi: '© 2026 教学站' },
  };

  function styleFor(kind, key) {
    if (kind === 'wire') {
      return `background:#e8e6e1;border:1px dashed #b8b2a8;border-radius:6px;` +
             `color:#8b8578;font-size:12px;display:grid;place-items:center;`;
    }
    const map = {
      header: `background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:10px;` +
              `color:var(--c-primary);font-weight:700;font-size:14px;display:grid;place-items:center;`,
      hero:   `background:var(--c-primary-weak);border-radius:12px;color:var(--c-primary);` +
              `font-weight:700;font-size:19px;display:grid;place-items:center;`,
      cards:  `background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;` +
              `color:var(--c-text-soft);font-size:13px;display:grid;place-items:center;`,
      footer: `background:var(--c-surface-2);border-radius:8px;color:var(--c-muted);` +
              `font-size:12px;display:grid;place-items:center;`,
    };
    return map[key];
  }

  const HEIGHT = { wire: { header: 32, hero: 76, cards: 68, footer: 28 },
                   hi:   { header: 40, hero: 96, cards: 84, footer: 34 } };

  function update() {
    const kind = sel.value === 'wire' ? 'wire' : 'hi';

    stage.innerHTML = LAYOUT.map(k => `
      <div style="${styleFor(kind, k)}height:${HEIGHT[kind][k]}px;">
        ${META[k][kind]}
      </div>`).join('');

    note.textContent = kind === 'wire'
      ? '→ 只有灰块和占位文字：结构一眼看清，改起来几乎零成本。'
      : '→ 换成真实颜色与文案：区块位置、顺序、比例完全没变——骨架没动，只换了皮肤。';
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 启动
 * ------------------------------------------------------- */
initLesson('lesson-02');
