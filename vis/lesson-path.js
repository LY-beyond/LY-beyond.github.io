// =========================================================
// lesson-path.js —— 章节页顶部「小节流动路径带」
// ---------------------------------------------------------
// 纯装饰、零依赖、零数据文件：
//   1. 读取左侧目录 .chapter-nav a[data-chapter]（中英各页自动取到本地语言）
//   2. 在 .lesson-header 下方注入一条路径带：
//      SVG 波浪贝塞尔轨道（底层静态灰线 + 流动虚线）+ 绝对定位的编号节点
//   3. 节点仅展示，不可点击；当前小节徽章跟随 .chapter.active 高亮
//
// 「流动」原理：给 <path pathLength="1"> 做归一化后，
// stroke-dasharray 用小数周期（与真实像素长度无关），
// 再用 CSS 动画持续改变 stroke-dashoffset，虚线即沿线跑动且任意段长无缝循环。
// =========================================================

const TRACK_H = 176;          // 路径带轨道高度（px，需容下低位节点的两行标题）
const PAD_X = 56;             // 首尾节点中心距轨道边缘
const MIN_W = 560;            // 窄屏横向滚动的临界宽度
const MAX_W = 1320;           // 轨道最大宽度
const STEP = 108;             // 每多一个小节需要的水平空间

// 8 档波浪 y（每章 3~8 个小节），上下交替，手工调出的节奏
const WAVE = [96, 50, 110, 58, 100, 54, 106, 62];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 去掉目录文本里的小节编号前缀，如 "1.1 对齐：建立秩序" -> "对齐：建立秩序"
function stripNumber(label) {
  return label.replace(/^\s*\d+(?:\.\d+)*[\s、.．:：-]*/, '').trim();
}

// 相邻四点推导三次贝塞尔控制点（Catmull-Rom -> Bézier，系数 0.18），
// 与参考站同款：逐段绘制、拼接处方向连续，没有折角。
function smoothSegment(points, i) {
  const prev = points[Math.max(i - 1, 0)];
  const from = points[i];
  const to = points[i + 1];
  const next = points[Math.min(i + 2, points.length - 1)];
  const k = 0.18;
  const c1x = from.x + (to.x - prev.x) * k;
  const c1y = from.y + (to.y - prev.y) * k;
  const c2x = to.x - (next.x - from.x) * k;
  const c2y = to.y - (next.y - from.y) * k;
  return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
}

function routePath(points) {
  return points.slice(1).map((_p, i) => smoothSegment(points, i)).join(' ');
}

export function initLessonPath() {
  const nav = document.querySelector('.chapter-nav');
  const header = document.querySelector('.lesson-header');
  if (!nav || !header) return;

  const items = [...nav.querySelectorAll('a[data-chapter]')].map((a) => ({
    id: a.dataset.chapter,
    label: stripNumber(a.textContent),
  }));
  if (items.length < 2) return;

  const band = document.createElement('div');
  band.className = 'lesson-path';
  band.setAttribute('aria-hidden', 'true'); // 纯装饰：信息在左侧目录里已完整提供
  header.insertAdjacentElement('afterend', band);

  let nodeEls = [];

  function measureWidth() {
    // clientWidth 含左右 padding，必须扣除，否则轨道会比内容区宽、凭空出现横向滚动
    const styles = getComputedStyle(band);
    const avail = band.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const fitted = Math.max(MIN_W, items.length * STEP + PAD_X * 0.8);
    return Math.round(Math.min(MAX_W, Math.max(fitted, avail)));
  }

  function syncCurrent() {
    const active = document.querySelector('.chapter.active');
    const id = active ? active.id : '';
    nodeEls.forEach((el) => {
      el.classList.toggle('is-current', el.dataset.id === id);
    });
  }

  function render() {
    const n = items.length;
    const w = measureWidth();
    const span = Math.max(w - PAD_X * 2, 1);
    const points = items.map((_item, i) => ({
      x: PAD_X + span * (n <= 1 ? 0.5 : i / (n - 1)),
      y: WAVE[i % WAVE.length],
    }));
    const d = routePath(points);

    band.innerHTML = `
      <div class="lesson-path__track" style="width:${w}px;height:${TRACK_H}px">
        <svg class="lesson-path__svg" viewBox="0 0 ${w} ${TRACK_H}" focusable="false">
          <path class="lesson-path__base" d="${d}" />
          <path class="lesson-path__flow" d="${d}" pathLength="1" />
        </svg>
        ${items.map((item, i) => `
          <div class="lesson-path__node"
               data-id="${escapeHtml(item.id)}"
               style="--x:${points[i].x}px;--y:${points[i].y}px;--i:${i}">
            <span class="lesson-path__badge">${String(i + 1).padStart(2, '0')}</span>
            <span class="lesson-path__label">${escapeHtml(item.label)}</span>
          </div>
        `).join('')}
      </div>
    `;

    nodeEls = [...band.querySelectorAll('.lesson-path__node')];
    syncCurrent();
  }

  // 当前小节由 lesson-core 的 activateChapter() 切换（点目录 / hashchange），
  // 监听各 article 的 class 变化即可联动，无需改动 lesson-core。
  document.querySelectorAll('.chapter').forEach((chapter) => {
    new MutationObserver(syncCurrent).observe(chapter, {
      attributes: true,
      attributeFilter: ['class'],
    });
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 120);
  });

  render();
  requestAnimationFrame(() => band.classList.add('is-revealed'));
}
