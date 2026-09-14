// 临时脚本：由中文 lesson.js 生成英文版（只替换文案，演示逻辑保持逐字不变）
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'lesson-01/lesson.js';
const DST = 'en/lesson-01/lesson.js';

const PAIRS = [
  // ---- 文件头与注释 ----
  ['—— 第 1 章 布局设计的基本原则', '—— Chapter 1: Core Principles of Layout Design'],
  ['//   演示：d-1-1 对齐 / d-1-2 亲密性与留白 / d-1-3 对比与视觉层次',
   '//   Demos: d-1-1 alignment / d-1-2 proximity & whitespace / d-1-3 contrast & hierarchy'],
  [' * 演示 1.1 —— 对齐与不对齐', ' * Demo 1.1 — aligned vs misaligned'],
  [' * 演示 1.2 —— 亲密性与留白（组内间距 / 组间间距）',
   ' * Demo 1.2 — proximity and whitespace (within-group / between-group spacing)'],
  [' * 演示 1.3 —— 对比与视觉层次', ' * Demo 1.3 — contrast and visual hierarchy'],
  [' * 演示 1.4 —— 重复与统一', ' * Demo 1.4 — repetition and unity'],
  [' * 演示 1.5 —— 格式塔：间距 / 共同区域 / 相似',
   ' * Demo 1.5 — Gestalt: spacing / common region / similarity'],
  [' * 演示 1.6 —— 视觉平衡与节奏', ' * Demo 1.6 — visual balance and rhythm'],
  [' * 启动', ' * Bootstrap'],
  ['// 未对齐时的"随手写"偏移量', '// The "eyeballed" offsets used in the misaligned state'],
  ['// 对齐后：统一间距 + 拉开分组', '// Once aligned: one shared spacing + clearer grouping'],
  ['// "各自为政"：每个卡片一套不同的圆角/内边距/阴影/主色',
   '// "Every card for itself": a different radius / padding / shadow / accent per card'],
  ['// "统一规范"：全部来自同一套令牌',
   '// "One shared spec": everything comes from the same tokens'],
  ['import { initLesson } from \'../lesson-core.js\';',
   'import { initLesson } from \'../../lesson-core.js\';'],

  // ---- 演示 1.1 数据 ----
  ["'仪表盘布局'", "'Dashboard layout'"],
  ["'罗辑 · 2 小时前'", "'Luo Ji · 2 hours ago'"],
  ["'图表与坐标轴'", "'Charts and axes'"],
  ["'汪淼 · 5 小时前'", "'Wang Miao · 5 hours ago'"],
  ["'网格系统'", "'Grid system'"],
  ["'刘洋 · 1 天前'", "'Liu Yang · 1 day ago'"],
  ["'响应式设计'", "'Responsive design'"],
  ["'赵敏 · 2 天前'", "'Zhao Min · 2 days ago'"],

  // ---- 演示 1.2 数据 ----
  ["'基本信息'", "'Basic information'"],
  ["'姓名 · 李越'", "'Name · Li Yue'"],
  ["'学号 · 202406'", "'Student ID · 202406'"],
  ["'班级 · 智能科学与技术 1 班'", "'Class · Intelligent Science and Technology 1'"],
  ["'联系方式'", "'Contact details'"],
  ["'邮箱 · li@example.com'", "'Email · li@example.com'"],
  ["'电话 · 138****0000'", "'Phone · 138****0000'"],
  ["'地址 · 山东青岛'", "'Address · Qingdao, Shandong'"],

  // ---- 演示 1.4 / 1.5 数据 ----
  ["'设计系统', '组件库', '样式指南'", "'Design system', 'Component library', 'Style guide'"],
  ["'前端技能'", "'Front-end skills'"],
  ["'HTML 语义化'", "'Semantic HTML'"],
  ["'CSS 布局'", "'CSS layout'"],
  ["'设计技能'", "'Design skills'"],
  ["'栅格系统'", "'Grid systems'"],
  ["'配色体系'", "'Color systems'"],
  ["'交互规范'", "'Interaction guidelines'"],

  // ---- 演示控件标签 / 选项 ----
  ['>状态', '>State'],
  ['未对齐（凭感觉摆）', 'Misaligned (placed by feel)'],
  ['已对齐（共用一条线）', 'Aligned (sharing one line)'],
  ['红色虚线 = 参考对齐线', 'Red dashed line = the reference alignment line'],
  ['>组内间距', '>Within-group spacing'],
  ['>组间间距', '>Between-group spacing'],
  ['>标题字号', '>Heading size'],
  ['>正文字号', '>Body size'],
  ['>强调色', '>Accent color'],
  ['>开启', '>On'],
  ['>关闭', '>Off'],
  ['>样式来源', '>Style source'],
  ['各自为政（每个单独调）', 'Every card for itself (tuned individually)'],
  ['统一规范（共用一套令牌）', 'One shared spec (reusing the same tokens)'],
  ['>查看', '>View'],
  ['>分组手段', '>Grouping device'],
  ['① 纯间距', '① Spacing only'],
  ['② 加"共同区域"', '② Add a "common region"'],
  ['③ 再加"相似"区分', '③ Also add "similarity"'],
  ['>左侧主视觉大小', '>Left hero size'],
  ['>右侧小块数量', '>Number of right-hand blocks'],
  ['>主视觉', '>Hero'],
  ['小模块 ', 'Small block '],

  // ---- 演示 1.3 里的示例卡片文案 ----
  ['三个提升布局质感的细节', 'Three details that lift the quality of a layout'],
  ['让页面显得专业的，往往不是花哨的效果，而是',
   'What makes a page look professional is rarely a flashy effect — it is whether'],
  ['对齐、分组与层次', 'alignment, grouping and hierarchy'],
  ['这三件事做得是否扎实。', 'these three things are done solidly.'],

  // ---- 提示条文案 ----
  ["'→ 所有元素左边缘落在同一条线上，间距一致——秩序感立刻出现。'",
   "'→ Every element shares the same left edge and the same spacing — a sense of order appears instantly.'"],
  ["'→ 左边缘参差不齐、间距忽大忽小，读者的第一感受就是\"乱\"。'",
   "'→ Ragged left edges and uneven spacing: the first impression a reader gets is \"messy\".'"],
  ['→ 组间 / 组内 = ', '→ Between / within = '],
  [' 倍，分组清晰 ✔', '× — grouping reads clearly ✔'],
  ['→ 组间 / 组内 只有 ', '→ Between / within is only '],
  [' 倍，看不出哪几项是一组 ✘（建议 ≥ 2 倍）',
   '× — you cannot tell which items belong together ✘ (aim for ≥ 2×)'],
  ['→ 字号跨度 ', '→ A type-size jump of '],
  ['，主次分明 ✔ 读者一眼就知道该先看标题。',
   ' — primary and secondary are clear ✔ readers know to look at the heading first.'],
  ['→ 字号跨度只有 ', '→ A type-size jump of only '],
  ['，层次几乎看不出来 ✘ 建议拉到 12px 以上。',
   ' — the hierarchy is almost invisible ✘ aim for 12px or more.'],
  ['→ 只靠间距分组：能看出两伙，但边界比较模糊。',
   '→ Spacing alone: you can see two clusters, but the boundary is fuzzy.'],
  ['→ 加了"共同区域"（底色 + 圆角）：分组立刻清晰，不需要额外说明。',
   '→ Adding a "common region" (tint + radius): the grouping snaps into focus with no extra explanation needed.'],
  ['→ 再用"相似"做区分（两组不同色系）：不仅知道是两组，还知道"类型不同"。',
   '→ Then "similarity" (a different color family per group): you know not only that there are two groups, but that they are different kinds.'],
  ['→ 左 ', '→ Left '],
  ['px vs 右 ', 'px vs right '],
  ['px：视觉重量接近，页面是【平衡】的 ✔',
   'px: the visual weights are close, so the page is BALANCED ✔'],
  ["'左重右轻' : '左轻右重'", "'left-heavy, right-light' : 'left-light, right-heavy'"],
  ['，页面【失衡】 ✘', ', so the page is UNBALANCED ✘'],
  ['，差距 ${diff}px：', ', a gap of ${diff}px: '],

  // ---- 演示 1.4 里展示的"代码"文案 ----
  ['/* 统一：一次定义，多处复用 */', '/* Consistent: defined once, reused everywhere */'],
  ['/* 各自为政：每个卡片一套值，迟早失控 */',
   '/* Every card for itself: one set of values per card — it will drift sooner or later */'],
];

let src = readFileSync(SRC, 'utf8');

/* 逐对替换；任何一对没匹配上都视为失败，避免"静默漏译" */
const missed = [];
for (const [zh, en] of PAIRS) {
  if (!src.includes(zh)) { missed.push(zh); continue; }
  src = src.split(zh).join(en);
}

if (missed.length) {
  console.error(`✗ 有 ${missed.length} 条替换规则没匹配上：`);
  for (const m of missed) console.error('   ' + m);
  process.exit(1);
}

writeFileSync(DST, src, 'utf8');

/* 校验：不应再有任何汉字残留 */
const left = src.match(/[\u4e00-\u9fa5]/g) || [];
if (left.length) {
  console.error(`\n✗ 仍有 ${left.length} 个汉字未翻译：`);
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    if (/[\u4e00-\u9fa5]/.test(l)) console.error(`   ${i + 1}| ${l}`);
  });
  process.exit(1);
}

console.log(`✓ 已生成 ${DST}`);
console.log(`  替换规则 ${PAIRS.length} 条，全部命中`);
console.log(`  汉字残留 0 个`);
console.log(`  字符数 ${src.length}（源文件 ${readFileSync(SRC, 'utf8').length}）`);

