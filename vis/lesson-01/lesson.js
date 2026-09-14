// =========================================================
// lesson-01/lesson.js —— 第 1 章 布局设计的基本原则
//   演示：d-1-1 对齐 / d-1-2 亲密性与留白 / d-1-3 对比与视觉层次
// =========================================================

import { initLesson } from '../lesson-core.js';

window.DEMOS = window.DEMOS || {};

/* ---------------------------------------------------------
 * 演示 1.1 —— 对齐与不对齐
 * ------------------------------------------------------- */
window.DEMOS['d-1-1'] = function (mount) {
  const ROWS = [
    { t: '仪表盘布局', s: '罗辑 · 2 小时前' },
    { t: '图表与坐标轴', s: '汪淼 · 5 小时前' },
    { t: '网格系统', s: '刘洋 · 1 天前' },
    { t: '响应式设计', s: '赵敏 · 2 天前' },
  ];

  // 未对齐时的"随手写"偏移量
  const OFF_PAD   = [28, 46, 16, 58];
  const OFF_GAP   = [12, 22, 8, 18];
  const OFF_ICON  = [34, 26, 40, 30];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">状态
          <select class="js-mode">
            <option value="off">未对齐（凭感觉摆）</option>
            <option value="on">已对齐（共用一条线）</option>
          </select>
        </label>
        <span style="font-size:12.5px;color:var(--c-text-soft);">红色虚线 = 参考对齐线</span>
      </div>

      <div class="demo-stage js-stage" style="position:relative;display:flex;flex-direction:column;background:var(--c-surface);padding:16px 0;gap:0;">
        <div class="js-guide" style="position:absolute;left:calc(16px + 28px);top:0;bottom:0;border-left:1px dashed var(--d4);opacity:.75;"></div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const guide = mount.querySelector('.js-guide');
  const sel   = mount.querySelector('.js-mode');
  const note  = mount.querySelector('.js-note');

  stage.insertAdjacentHTML('beforeend', ROWS.map((r, i) => `
    <div class="js-row" data-i="${i}"
         style="display:flex;align-items:center;padding:10px 0;">
      <div class="js-icon" style="flex:none;border-radius:8px;background:var(--d${i + 1});"></div>
      <div>
        <div style="font-weight:700;font-size:14px;">${r.t}</div>
        <div style="font-size:12.5px;color:var(--c-text-soft);">${r.s}</div>
      </div>
    </div>`).join(''));

  const rows = [...stage.querySelectorAll('.js-row')];

  function update() {
    const aligned = sel.value === 'on';

    rows.forEach((row, i) => {
      const icon = row.querySelector('.js-icon');
      row.style.paddingLeft = (aligned ? 28 : OFF_PAD[i]) + 'px';
      row.style.gap         = (aligned ? 14 : OFF_GAP[i]) + 'px';
      icon.style.width      = (aligned ? 34 : OFF_ICON[i]) + 'px';
      icon.style.height     = (aligned ? 34 : OFF_ICON[i]) + 'px';
    });

    // 对齐后：统一间距 + 拉开分组
    stage.style.gap = aligned ? '0px' : '6px';
    rows.forEach(r => { r.style.marginBottom = aligned ? '8px' : '0px'; });

    guide.style.opacity = aligned ? '.9' : '.25';
    note.textContent = aligned
      ? '→ 所有元素左边缘落在同一条线上，间距一致——秩序感立刻出现。'
      : '→ 左边缘参差不齐、间距忽大忽小，读者的第一感受就是"乱"。';
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 1.2 —— 亲密性与留白（组内间距 / 组间间距）
 * ------------------------------------------------------- */
window.DEMOS['d-1-2'] = function (mount) {
  const GROUPS = [
    { name: '基本信息', items: ['姓名 · 李越', '学号 · 202406', '班级 · 智能科学与技术 1 班'] },
    { name: '联系方式', items: ['邮箱 · li@example.com', '电话 · 138****0000', '地址 · 山东青岛'] },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">组内间距
          <input type="range" min="2" max="28" value="6" data-c="inner">
          <span class="val" data-out="inner">6</span>
        </label>
        <label class="demo-control">组间间距
          <input type="range" min="4" max="56" value="28" data-c="outer">
          <span class="val" data-out="outer">28</span>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;color:var(--c-text-soft);font-weight:600;"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const note  = mount.querySelector('.js-note');

  function update() {
    const inner = +mount.querySelector('[data-c="inner"]').value;
    const outer = +mount.querySelector('[data-c="outer"]').value;

    mount.querySelector('[data-out="inner"]').textContent = inner;
    mount.querySelector('[data-out="outer"]').textContent = outer;

    stage.innerHTML = GROUPS.map(g => `
      <div style="margin-bottom:${outer}px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-primary);letter-spacing:.06em;margin-bottom:${Math.max(4, inner / 2)}px;">
          ${g.name}
        </div>
        <div style="display:flex;flex-direction:column;gap:${inner}px;">
          ${g.items.map(t => `<div style="padding:6px 10px;border-radius:6px;background:var(--c-surface-2);font-size:13px;">${t}</div>`).join('')}
        </div>
      </div>`).join('');

    const ratio = outer / Math.max(inner, 1);
    note.textContent = ratio >= 2
      ? `→ 组间 / 组内 = ${ratio.toFixed(1)} 倍，分组清晰 ✔`
      : `→ 组间 / 组内 只有 ${ratio.toFixed(1)} 倍，看不出哪几项是一组 ✘（建议 ≥ 2 倍）`;
    note.style.color = ratio >= 2 ? 'var(--c-success)' : 'var(--c-danger)';
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * 演示 1.3 —— 对比与视觉层次
 * ------------------------------------------------------- */
window.DEMOS['d-1-3'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">标题字号
          <input type="range" min="16" max="52" value="32" data-c="title">
          <span class="val" data-out="title">32</span>
        </label>
        <label class="demo-control">正文字号
          <input type="range" min="12" max="22" value="16" data-c="body">
          <span class="val" data-out="body">16</span>
        </label>
        <label class="demo-control">强调色
          <select class="js-acc">
            <option value="on">开启</option>
            <option value="off">关闭</option>
          </select>
        </label>
      </div>

      <div class="demo-stage js-stage" style="background:var(--c-surface);padding:22px;"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const acc   = mount.querySelector('.js-acc');
  const note  = mount.querySelector('.js-note');

  function update() {
    const t = +mount.querySelector('[data-c="title"]').value;
    const b = +mount.querySelector('[data-c="body"]').value;
    const accentOn = acc.value === 'on';

    mount.querySelector('[data-out="title"]').textContent = t;
    mount.querySelector('[data-out="body"]').textContent  = b;

    const span = t - b;

    stage.innerHTML = `
      <div style="font-size:${t}px;font-weight:700;line-height:1.25;margin-bottom:12px;color:var(--c-text);">
        三个提升布局质感的细节
      </div>
      <div style="font-size:${b}px;color:var(--c-text-soft);line-height:1.85;">
        让页面显得专业的，往往不是花哨的效果，而是
        <span style="color:${accentOn ? 'var(--c-primary)' : 'inherit'};font-weight:${accentOn ? 700 : 'inherit'};">对齐、分组与层次</span>
        这三件事做得是否扎实。
      </div>`;

    if (span >= 12) {
      note.textContent = `→ 字号跨度 ${span}px，主次分明 ✔ 读者一眼就知道该先看标题。`;
      note.style.color = 'var(--c-success)';
    } else {
      note.textContent = `→ 字号跨度只有 ${span}px，层次几乎看不出来 ✘ 建议拉到 12px 以上。`;
      note.style.color = 'var(--c-danger)';
    }
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  acc.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 1.4 —— 重复与统一
 * ------------------------------------------------------- */
window.DEMOS['d-1-4'] = function (mount) {
  const CARDS = ['设计系统', '组件库', '样式指南'];

  // "各自为政"：每个卡片一套不同的圆角/内边距/阴影/主色
  const OFF = [
    { r: 4,  pad: 12, sh: 'none',                        color: 'var(--d1)' },
    { r: 20, pad: 24, sh: '0 10px 24px rgba(0,0,0,.22)',  color: 'var(--d4)' },
    { r: 8,  pad: 16, sh: '0 2px 4px rgba(0,0,0,.40)',    color: 'var(--d3)' },
  ];
  // "统一规范"：全部来自同一套令牌
  const ON = { r: 12, pad: 18, sh: '0 4px 16px rgba(30,42,50,.10)', color: 'var(--c-primary)' };

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">样式来源
          <select class="js-mode">
            <option value="off">各自为政（每个单独调）</option>
            <option value="on">统一规范（共用一套令牌）</option>
          </select>
        </label>
      </div>

      <div class="js-stage" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;"></div>
      <pre class="demo-code js-code"></pre>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const code  = mount.querySelector('.js-code');

  function update() {
    const unified = sel.value === 'on';

    stage.innerHTML = CARDS.map((t, i) => {
      const s = unified ? ON : OFF[i];
      return `
        <div style="border-radius:${s.r}px;padding:${s.pad}px;box-shadow:${s.sh};
                    background:var(--c-surface);border:1px solid var(--c-border);">
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${t}</div>
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;
                      background:${s.color};color:#fff;font-size:12px;font-weight:700;">查看</div>
        </div>`;
    }).join('');

    code.textContent = unified
      ? `/* 统一：一次定义，多处复用 */
:root { --radius: 12px; --space: 18px; }

.card { border-radius: var(--radius); padding: var(--space); }
.btn  { background: var(--c-primary); }`
      : `/* 各自为政：每个卡片一套值，迟早失控 */
.card-a { border-radius: 4px;  padding: 12px; }
.card-b { border-radius: 20px; padding: 24px; }
.card-c { border-radius: 8px;  padding: 16px; }`;
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 1.5 —— 格式塔：间距 / 共同区域 / 相似
 * ------------------------------------------------------- */
window.DEMOS['d-1-5'] = function (mount) {
  const GROUPS = [
    { name: '前端技能', items: ['HTML 语义化', 'CSS 布局', 'JavaScript'] },
    { name: '设计技能', items: ['栅格系统', '配色体系', '交互规范'] },
  ];

  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">分组手段
          <select class="js-mode">
            <option value="spacing">① 纯间距</option>
            <option value="region">② 加"共同区域"</option>
            <option value="similar">③ 再加"相似"区分</option>
          </select>
        </label>
      </div>

      <div class="js-stage" style="background:var(--c-surface);"></div>
      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:600;color:var(--c-text-soft);"></p>
    </div>`;

  const stage = mount.querySelector('.js-stage');
  const sel   = mount.querySelector('.js-mode');
  const note  = mount.querySelector('.js-note');

  function update() {
    const m = sel.value;
    const useRegion  = m !== 'spacing';
    const useSimilar = m === 'similar';

    stage.innerHTML = GROUPS.map((g, gi) => {
      const regionStyle = useRegion
        ? `background:${useSimilar ? (gi === 0 ? 'var(--c-primary-weak)' : 'var(--c-accent-weak)') : 'var(--c-surface-2)'};
           border:1px solid var(--c-border);border-radius:12px;padding:16px;`
        : `padding:0;`;

      return `
        <div style="margin-bottom:${useRegion ? 20 : 32}px;${regionStyle}">
          <div style="font-size:12px;font-weight:700;letter-spacing:.06em;margin-bottom:10px;
                      color:${useSimilar ? (gi === 0 ? 'var(--c-primary)' : 'var(--c-accent)') : 'var(--c-muted)'};">
            ${g.name}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${g.items.map(t => `
              <div style="padding:8px 12px;border-radius:8px;font-size:13px;
                          background:${useSimilar ? 'var(--c-surface)' : 'var(--c-surface-2)'};
                          color:var(--c-text);">${t}</div>`).join('')}
          </div>
        </div>`;
    }).join('');

    const msgs = {
      spacing: '→ 只靠间距分组：能看出两伙，但边界比较模糊。',
      region:  '→ 加了"共同区域"（底色 + 圆角）：分组立刻清晰，不需要额外说明。',
      similar: '→ 再用"相似"做区分（两组不同色系）：不仅知道是两组，还知道"类型不同"。',
    };
    note.textContent = msgs[m];
  }

  sel.addEventListener('change', update);
  update();
};

/* ---------------------------------------------------------
 * 演示 1.6 —— 视觉平衡与节奏
 * ------------------------------------------------------- */
window.DEMOS['d-1-6'] = function (mount) {
  mount.innerHTML = `
    <div class="demo-card">
      <div class="demo-controls">
        <label class="demo-control">左侧主视觉大小
          <input type="range" min="90" max="260" value="180" data-c="left">
          <span class="val" data-out="left">180</span>
        </label>
        <label class="demo-control">右侧小块数量
          <input type="range" min="1" max="5" value="3" data-c="right">
          <span class="val" data-out="right">3</span>
        </label>
      </div>

      <div class="demo-stage" style="background:var(--c-surface);padding:18px;">
        <div style="display:grid;grid-template-columns:7fr 5fr;gap:16px;align-items:start;">
          <div class="js-left" style="border-radius:12px;background:var(--c-primary);color:#fff;
                     display:grid;place-items:center;font-weight:700;font-size:14px;">主视觉</div>
          <div class="js-right" style="display:flex;flex-direction:column;gap:10px;"></div>
        </div>
      </div>

      <p class="js-note" style="margin:14px 0 0;font-size:13px;font-weight:700;"></p>
    </div>`;

  const left  = mount.querySelector('.js-left');
  const right = mount.querySelector('.js-right');
  const note  = mount.querySelector('.js-note');

  function update() {
    const H = +mount.querySelector('[data-c="left"]').value;
    const N = +mount.querySelector('[data-c="right"]').value;

    mount.querySelector('[data-out="left"]').textContent  = H;
    mount.querySelector('[data-out="right"]').textContent = N;

    left.style.height = H + 'px';

    right.innerHTML = Array.from({ length: N }, (_, i) => `
      <div style="height:44px;border-radius:10px;background:var(--c-surface-2);
                  border:1px solid var(--c-border);display:grid;place-items:center;
                  font-size:12.5px;font-weight:700;color:var(--c-text-soft);">小模块 ${i + 1}</div>`).join('');

    const rightWeight = N * 44 + (N - 1) * 10;
    const diff = Math.abs(H - rightWeight);

    if (diff <= 40) {
      note.textContent = `→ 左 ${H}px vs 右 ${rightWeight}px：视觉重量接近，页面是【平衡】的 ✔`;
      note.style.color = 'var(--c-success)';
    } else {
      const side = H > rightWeight ? '左重右轻' : '左轻右重';
      note.textContent = `→ 左 ${H}px vs 右 ${rightWeight}px，差距 ${diff}px：${side}，页面【失衡】 ✘`;
      note.style.color = 'var(--c-danger)';
    }
  }

  mount.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', update));
  update();
};

/* ---------------------------------------------------------
 * 启动
 * ------------------------------------------------------- */
initLesson('lesson-01');
