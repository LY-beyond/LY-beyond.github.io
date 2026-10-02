/* =========================================================
 * data.js —— 全站内容与数据（唯一数据源）
 * ---------------------------------------------------------
 * 约定：
 *   ① 所有文案写成 { zh: '…', en: '…' }，由 I18N.pick() 取当前语言；
 *   ② 纯数字 / 数组不加包装，图表直接读取；
 *   ③ 每一组数据都带 source（数据来源），页面上必须如实展示。
 *
 * 数据说明：本页数据为公开资料整理（中国信通院、工信部、国家统计局、
 * 普华永道、IDC、斯坦福 AI Index 等）与合理测算的示意图，
 * 不同机构口径不完全一致，仅用于可视化表达，不作为严谨统计引用。
 * ========================================================= */
window.AI_DATA = (function () {
  'use strict';

  /* 图表调色板（渲染时会被 charts.js 替换为 tokens.css 里的真实色值） */
  var PALETTE_KEYS = ['--c-primary', '--c-accent', '--c-info', '--d5', '--c-success', '--d6', '--d3', '--d4'];

  /* ---------------- ① 首页 KPI ---------------- */
  var kpis = [
    {
      value: 6964, decimals: 0,
      unit: { zh: '亿元', en: '×100M CNY' },
      label: { zh: '2024 年中国人工智能核心产业规模', en: 'China AI core industry scale, 2024' },
      sub: { zh: '连续多年保持约 20% 的高速增长', en: 'Sustained ~20% annual growth' }
    },
    {
      value: 15.7, decimals: 1,
      unit: { zh: '万亿美元', en: 'trillion USD' },
      label: { zh: '2030 年 AI 对全球 GDP 的增量贡献', en: 'AI incremental contribution to global GDP by 2030' },
      sub: { zh: '相当于再造一个中等发达经济体', en: 'Roughly the size of a mid-sized developed economy' }
    },
    {
      value: 26, decimals: 0,
      unit: { zh: '%', en: '%' },
      label: { zh: '其中中国预计可获得的份额', en: 'Share expected to be captured by China' },
      sub: { zh: '约合 7 万亿美元增量', en: 'About 7 trillion USD' }
    },
    {
      value: 30, decimals: 0,
      unit: { zh: '%', en: '%' },
      label: { zh: '我国算力总规模近五年年均增速', en: 'Five-year CAGR of China computing capacity' },
      sub: { zh: '算力被视为新质生产力的「基础能源」', en: 'Compute is the "energy" of new quality productive forces' }
    }
  ];

  /* ---------------- ② 内涵：三要素升级 ---------------- */
  var define = {
    lead: {
      zh: '新质生产力由技术革命性突破、生产要素创新性配置、产业深度转型升级而催生。它的核心，是生产要素从「量的堆叠」转向「质的跃迁」——而人工智能，恰好同时改写了生产力的三个基本要素。',
      en: 'New quality productive forces arise from revolutionary technological breakthroughs, innovative allocation of production factors and deep industrial transformation. Their essence is a shift from quantitative stacking to qualitative leaps — and AI rewrites all three basic factors of productivity at once.'
    },
    pillars: [
      {
        key: 'labor',
        icon: '🧑‍🏭',
        name: { zh: '劳动者', en: 'Labour force' },
        before: { zh: '以体力与单一技能为主的传统劳动者', en: 'Traditional workers relying on physical labour and a single skill' },
        after: { zh: '具备数据素养、善于人机协同的「新劳动者」', en: 'Data-literate "new workers" who collaborate with AI' },
        metric: { zh: '单位劳动生产率提升', en: 'Labour productivity gain' },
        value: 35, max: 60,
        source: { zh: '综合世界经济论坛《未来就业报告》与国内调研测算', en: 'Based on WEF Future of Jobs and domestic survey estimates' }
      },
      {
        key: 'tool',
        icon: '🧰',
        name: { zh: '劳动资料', en: 'Means of production' },
        before: { zh: '机械化、自动化的工业设备与流水线', en: 'Mechanized, automated machinery and assembly lines' },
        after: { zh: '「算力 + 算法 + 大模型」构成的新型生产工具', en: 'Compute + algorithms + large models as new production tools' },
        metric: { zh: '生产工具迭代周期缩短', en: 'Shorter tool renewal cycle' },
        value: 60, max: 80,
        source: { zh: '依据大模型能力代际更迭节奏（约 6–12 个月）测算', en: 'Estimated from 6–12 month model generation cycles' }
      },
      {
        key: 'object',
        icon: '🗂️',
        name: { zh: '劳动对象', en: 'Objects of labour' },
        before: { zh: '土地、矿产等一次性消耗的实体原材料', en: 'Land, minerals and other consumable physical materials' },
        after: { zh: '数据、知识与场景，可无限复用且越用越增值', en: 'Data, knowledge and scenarios — reusable and value-adding' },
        metric: { zh: '数据要素对增长的贡献占比', en: 'Share of data factor in growth' },
        value: 45, max: 60,
        source: { zh: '依据「数据要素 ×」行动与数据要素市场测算', en: 'Based on the Data Elements × initiative and market estimates' }
      }
    ],
    compare: {
      caption: { zh: '传统生产力 vs 新质生产力', en: 'Traditional vs. new quality productive forces' },
      colBefore: { zh: '传统生产力', en: 'Traditional' },
      colAfter: { zh: '新质生产力', en: 'New quality productive forces' },
      rows: [
        { dim: { zh: '增长动能', en: 'Growth driver' }, before: { zh: '要素投入驱动，靠人力与资本堆叠', en: 'Input-driven, stacking labour and capital' }, after: { zh: '创新驱动，靠技术与数据迭代', en: 'Innovation-driven, iterating on technology and data' } },
        { dim: { zh: '要素结构', en: 'Factor mix' }, before: { zh: '土地、劳动力、资本为主导', en: 'Land, labour and capital dominate' }, after: { zh: '数据成为第五大生产要素', en: 'Data becomes a fifth production factor' } },
        { dim: { zh: '效率来源', en: 'Efficiency source' }, before: { zh: '规模经济与流程优化', en: 'Economies of scale and process optimization' }, after: { zh: '全要素生产率持续提升', en: 'Continuous growth in total factor productivity' } },
        { dim: { zh: '产业形态', en: 'Industrial form' }, before: { zh: '边界清晰的传统产业分工', en: 'Clearly bounded traditional division of labour' }, after: { zh: '数实融合、跨界融合的新业态', en: 'Blended digital-physical, cross-sector new business forms' } },
        { dim: { zh: '环境代价', en: 'Environmental cost' }, before: { zh: '高投入、高消耗、高排放', en: 'High input, high consumption, high emission' }, after: { zh: '绿色低碳，算力效率持续优化', en: 'Green and low-carbon with improving compute efficiency' } }
      ]
    }
  };

  /* ---------------- ③ 作用力：AI 赋能前后雷达 ---------------- */
  var radar = {
    caption: { zh: '传统生产力 与 AI 赋能新质生产力 的六维对比', en: 'Six-dimension comparison: traditional vs. AI-enabled' },
    axes: [
      { zh: '全要素生产率', en: 'Total factor productivity' },
      { zh: '创新迭代速度', en: 'Innovation speed' },
      { zh: '要素配置效率', en: 'Resource allocation' },
      { zh: '边际成本下降', en: 'Marginal cost reduction' },
      { zh: '绿色低碳水平', en: 'Green & low-carbon' },
      { zh: '规模化复制能力', en: 'Scalability' }
    ],
    series: [
      { name: { zh: '传统生产力', en: 'Traditional' }, values: [38, 30, 42, 25, 35, 40] },
      { name: { zh: 'AI 赋能新质生产力', en: 'AI-enabled NQPF' }, values: [82, 92, 86, 78, 74, 90] }
    ],
    note: { zh: '指数化评分（0–100），依据公开研究与产业调研整理，仅用于对比示意', en: 'Index score (0–100) compiled from public research and industry surveys for illustration' },
    source: { zh: '综合中国信通院、麦肯锡《生成式 AI 的经济潜力》等研究整理', en: 'Compiled from CAICT, McKinsey generative-AI research and others' }
  };

  /* ---------------- ④ 五股作用力卡片 ---------------- */
  var forces = [
    {
      icon: '📈',
      name: { zh: '提高全要素生产率', en: 'Raising total factor productivity' },
      desc: {
        zh: 'AI 让同样的人、设备与资本产出更多：机器视觉替代重复质检、预测性维护减少停机、大模型压缩知识与文档处理时间，效率提升不再依赖加班加点。',
        en: 'AI multiplies output from the same people, machines and capital: machine vision replaces repetitive inspection, predictive maintenance cuts downtime, and large models compress knowledge work.'
      },
      stat: { value: '0.5–1.5', unit: { zh: '个百分点 / 年', en: 'pp per year' }, label: { zh: '研究估计 AI 对全要素生产率年均增速的拉动', en: 'Estimated annual TFP growth uplift from AI' } },
      tag: { zh: '效率革命', en: 'Efficiency' }
    },
    {
      icon: '🧬',
      name: { zh: '催生新产业新业态', en: 'Creating new industries' },
      desc: {
        zh: '智能驾驶、生成式内容、具身智能、AI 制药……AI 本身成为巨大的产业，同时把旧行业重新组装成新赛道，创造出过去不存在的岗位与市场。',
        en: 'Autonomous driving, generative content, embodied intelligence, AI drug discovery — AI is itself a huge industry that reassembles old sectors into brand-new markets and jobs.'
      },
      stat: { value: '1.3', unit: { zh: '万亿美元', en: 'trillion USD' }, label: { zh: '生成式 AI 到 2032 年可能创造的新增市场价值', en: 'Potential market value created by generative AI by 2032' } },
      tag: { zh: '产业创新', en: 'Industry' }
    },
    {
      icon: '⚖️',
      name: { zh: '重构要素配置', en: 'Reallocating production factors' },
      desc: {
        zh: '数据成为可复用的生产要素，算力像水电一样按需调度；AI 让供需预测更准、库存更薄、物流更短，把资源从「平均用力」转向「精准投放」。',
        en: 'Data becomes a reusable factor and compute is dispatched on demand like utilities. Better forecasting means thinner inventory and shorter logistics — from average allocation to precision allocation.'
      },
      stat: { value: '7.5', unit: { zh: '%', en: '%' }, label: { zh: 'AI 应用成熟企业报告的物流与库存成本下降幅度', en: 'Logistics and inventory cost reduction reported by mature adopters' } },
      tag: { zh: '资源配置', en: 'Allocation' }
    },
    {
      icon: '🌱',
      name: { zh: '推动绿色低碳转型', en: 'Driving green transition' },
      desc: {
        zh: '电网用 AI 调度削峰填谷、数据中心液冷降耗、工业用 AI 优化能耗曲线；单位 GDP 的能耗与排放正在被算法一点点「抠」下来。',
        en: 'AI balances power grids, liquid cooling lowers data-centre energy use, and algorithms flatten industrial energy curves — energy and emissions per unit of GDP keep falling.'
      },
      stat: { value: '8–10', unit: { zh: '%', en: '%' }, label: { zh: 'AI 优化带来的数据中心能耗下降区间（示意）', en: 'Indicative data-centre energy savings from AI optimization' } },
      tag: { zh: '绿色发展', en: 'Green' }
    },
    {
      icon: '🤝',
      name: { zh: '促进人的全面发展', en: 'Advancing human development' },
      desc: {
        zh: 'AI 把重复劳动交还机器，把创造力、判断力与情感连接还给人；优质医疗、教育与政务资源通过 AI 下沉到县域与乡村，让发展成果更可及。',
        en: 'AI hands repetitive work to machines and gives creativity, judgement and empathy back to people; quality healthcare, education and public services reach smaller counties and villages.'
      },
      stat: { value: '60', unit: { zh: '%+', en: '%+' }, label: { zh: 'AI 辅助诊断在基层医疗机构中的覆盖率示意', en: 'Indicative coverage of AI-assisted diagnosis in grassroots clinics' } },
      tag: { zh: '普惠共享', en: 'Inclusion' }
    }
  ];

  /* ---------------- ⑤ 产业规模增长 ---------------- */
  var scale = {
    caption: { zh: '中国人工智能核心产业规模（2019–2025E）', en: 'China AI core industry scale (2019–2025E)' },
    unit: { zh: '亿元', en: '×100M CNY' },
    coreLabel: { zh: '人工智能核心产业规模', en: 'AI core industry' },
    relatedLabel: { zh: '带动相关产业规模', en: 'Related industries enabled' },
    series: [
      { year: 2019, value: 1050 },
      { year: 2020, value: 1500 },
      { year: 2021, value: 3228 },
      { year: 2022, value: 5080 },
      { year: 2023, value: 5784 },
      { year: 2024, value: 6964 },
      { year: 2025, value: 8600, forecast: true }
    ],
    related: [
      { year: 2019, value: 3600 },
      { year: 2020, value: 5100 },
      { year: 2021, value: 9000 },
      { year: 2022, value: 13500 },
      { year: 2023, value: 16100 },
      { year: 2024, value: 19500 },
      { year: 2025, value: 23000, forecast: true }
    ],
    note: { zh: '2025 年为预测值（虚线部分）；不同机构口径不一，此处按公开报道整理', en: '2025 is a forecast (dashed part); institutions differ in scope, figures follow public reports' },
    source: { zh: '中国信通院《人工智能发展报告》、工信部公开数据整理', en: 'CAICT AI Development Report; MIIT public data' }
  };

  /* ---------------- ⑥ 三次产业赋能 ---------------- */
  var industry = {
    caption: { zh: 'AI 在三次产业中的渗透率与效率增益', en: 'AI penetration and efficiency gain across three sectors' },
    penetration: { zh: 'AI 渗透率', en: 'AI penetration' },
    gain: { zh: '效率增益', en: 'Efficiency gain' },
    sizeLabel: { zh: '产业增加值占 GDP 比重', en: 'Share of GDP value added' },
    rows: [
      { key: { zh: '第三产业 · 服务业', en: 'Tertiary · Services' }, penetration: 31, gain: 35, size: 55, note: { zh: '金融、零售、内容与专业服务最先被大模型重塑', en: 'Finance, retail, content and professional services lead adoption' } },
      { key: { zh: '第二产业 · 工业', en: 'Secondary · Industry' }, penetration: 22, gain: 28, size: 37, note: { zh: '智能制造、机器质检、预测性维护是主战场', en: 'Smart manufacturing, machine inspection and predictive maintenance dominate' } },
      { key: { zh: '第一产业 · 农业', en: 'Primary · Agriculture' }, penetration: 8, gain: 12, size: 7, note: { zh: '遥感、无人机与智能育种正在打开空间', en: 'Remote sensing, drones and smart breeding open new space' } }
    ],
    note: { zh: '渗透率 = 使用 AI 技术的企业比例；效率增益为应用企业自报的均值', en: 'Penetration = share of firms using AI; gain = average self-reported improvement' },
    source: { zh: '国家统计局产业结构数据 + 行业调研整理', en: 'National Bureau of Statistics plus industry surveys' }
  };

  /* ---------------- ⑦ 行业渗透气泡矩阵 ---------------- */
  var bubble = {
    caption: { zh: '15 个行业的 AI 渗透率 × 效率增益 × 市场规模', en: '15 industries: AI penetration × efficiency gain × market size' },
    xLabel: { zh: 'AI 渗透率（%）', en: 'AI penetration (%)' },
    yLabel: { zh: '效率增益（%）', en: 'Efficiency gain (%)' },
    sizeLabel: { zh: '市场规模（亿元）', en: 'Market size (×100M CNY)' },
    quadrants: [
      { zh: '高渗透 · 高增益', en: 'High / High' },
      { zh: '低渗透 · 高增益', en: 'Low / High' },
      { zh: '低渗透 · 低增益', en: 'Low / Low' },
      { zh: '高渗透 · 低增益', en: 'High / Low' }
    ],
    points: [
      { name: { zh: '金融', en: 'Finance' }, x: 42, y: 32, size: 900 },
      { name: { zh: '传媒内容', en: 'Media' }, x: 45, y: 38, size: 650 },
      { name: { zh: '安防', en: 'Security' }, x: 40, y: 33, size: 750 },
      { name: { zh: '零售电商', en: 'Retail' }, x: 35, y: 30, size: 800 },
      { name: { zh: '汽车', en: 'Automotive' }, x: 33, y: 31, size: 1100 },
      { name: { zh: '政务服务', en: 'Public service' }, x: 30, y: 25, size: 450 },
      { name: { zh: '交通物流', en: 'Logistics' }, x: 28, y: 29, size: 520 },
      { name: { zh: '制造业', en: 'Manufacturing' }, x: 25, y: 28, size: 1200 },
      { name: { zh: '能源电力', en: 'Energy' }, x: 22, y: 24, size: 400 },
      { name: { zh: '医疗健康', en: 'Healthcare' }, x: 20, y: 26, size: 600 },
      { name: { zh: '教育', en: 'Education' }, x: 18, y: 22, size: 500 },
      { name: { zh: '法律', en: 'Legal' }, x: 15, y: 20, size: 150 },
      { name: { zh: '建筑地产', en: 'Construction' }, x: 12, y: 18, size: 300 },
      { name: { zh: '农业', en: 'Agriculture' }, x: 8, y: 12, size: 200 },
      { name: { zh: '矿业', en: 'Mining' }, x: 6, y: 14, size: 180 }
    ],
    note: { zh: '气泡越大代表该行业可被 AI 改造的市场规模越大；纵轴为应用企业报告的效率增益中位数', en: 'Larger bubbles mean larger addressable market; the vertical axis is the median reported efficiency gain' },
    source: { zh: '综合 IDC、艾瑞咨询、行业年报整理测算', en: 'Compiled from IDC, iResearch and industry annual reports' }
  };

  /* ---------------- ⑧ 全球格局排名 ---------------- */
  var globalRank = {
    caption: { zh: '主要经济体人工智能发展指数（示意）', en: 'AI development index of major economies (indicative)' },
    metric: { zh: 'AI 发展指数', en: 'AI index' },
    note: { zh: '综合算力、人才、论文、专利、投资与企业数量六个维度折算为 0–100 指数', en: 'A 0–100 index combining compute, talent, papers, patents, investment and firms' },
    source: { zh: '依据斯坦福 HAI《AI Index》、Tortoise Global AI Index 等公开报告整理', en: 'Based on Stanford HAI AI Index, Tortoise Global AI Index and others' },
    rows: [
      { name: { zh: '美国', en: 'United States' }, value: 100, flag: '🇺🇸' },
      { name: { zh: '中国', en: 'China' }, value: 92, flag: '🇨🇳' },
      { name: { zh: '英国', en: 'United Kingdom' }, value: 68, flag: '🇬🇧' },
      { name: { zh: '新加坡', en: 'Singapore' }, value: 64, flag: '🇸🇬' },
      { name: { zh: '以色列', en: 'Israel' }, value: 62, flag: '🇮🇱' },
      { name: { zh: '韩国', en: 'South Korea' }, value: 60, flag: '🇰🇷' },
      { name: { zh: '日本', en: 'Japan' }, value: 55, flag: '🇯🇵' },
      { name: { zh: '德国', en: 'Germany' }, value: 52, flag: '🇩🇪' },
      { name: { zh: '法国', en: 'France' }, value: 48, flag: '🇫🇷' },
      { name: { zh: '印度', en: 'India' }, value: 45, flag: '🇮🇳' },
      { name: { zh: '加拿大', en: 'Canada' }, value: 44, flag: '🇨🇦' },
      { name: { zh: '阿联酋', en: 'UAE' }, value: 40, flag: '🇦🇪' }
    ]
  };

  /* ---------------- ⑨ 要素重构流向图 ---------------- */
  var flow = {
    caption: { zh: 'AI 投入要素 → 三要素升级 → 生产力产出', en: 'AI inputs → upgraded factors → productivity output' },
    note: { zh: '带宽代表相对贡献权重（示意）；把鼠标放到任一节点上可高亮它的流向', en: 'Band width represents relative weight; hover any node to highlight its flows' },
    source: { zh: '依据「数据要素 ×」行动方案与国家统计局投入产出结构整理测算', en: 'Based on the Data Elements × plan and NBS input-output structure' },
    columns: [
      { zh: 'AI 新型投入', en: 'AI inputs' },
      { zh: '生产力要素升级', en: 'Factor upgrade' },
      { zh: '产出与意义', en: 'Outcomes' }
    ],
    nodes: [
      { id: 'compute', col: 0, label: { zh: '算力基础设施', en: 'Compute infrastructure' }, weight: 30, icon: '🖥️' },
      { id: 'data', col: 0, label: { zh: '数据要素', en: 'Data elements' }, weight: 26, icon: '🗄️' },
      { id: 'algo', col: 0, label: { zh: '算法与大模型', en: 'Algorithms & models' }, weight: 24, icon: '🧠' },
      { id: 'talent', col: 0, label: { zh: '人才与研发', en: 'Talent & R&D' }, weight: 20, icon: '🎓' },

      { id: 'labor', col: 1, label: { zh: '劳动者升级', en: 'Labour upgrade' }, weight: 28, icon: '🧑‍🏭' },
      { id: 'tool', col: 1, label: { zh: '劳动资料升级', en: 'Tool upgrade' }, weight: 40, icon: '🧰' },
      { id: 'object', col: 1, label: { zh: '劳动对象升级', en: 'Object upgrade' }, weight: 32, icon: '🗂️' },

      { id: 'tfp', col: 2, label: { zh: '全要素生产率提升', en: 'Higher TFP' }, weight: 38, icon: '📈' },
      { id: 'newbiz', col: 2, label: { zh: '新业态新模式', en: 'New business forms' }, weight: 34, icon: '🧬' },
      { id: 'green', col: 2, label: { zh: '绿色低碳转型', en: 'Green transition' }, weight: 28, icon: '🌱' }
    ],
    links: [
      { from: 'compute', to: 'tool', value: 22 },
      { from: 'compute', to: 'object', value: 8 },
      { from: 'data', to: 'object', value: 18 },
      { from: 'data', to: 'tool', value: 8 },
      { from: 'algo', to: 'tool', value: 10 },
      { from: 'algo', to: 'labor', value: 14 },
      { from: 'talent', to: 'labor', value: 14 },
      { from: 'talent', to: 'object', value: 6 },
      { from: 'labor', to: 'newbiz', value: 12 },
      { from: 'labor', to: 'tfp', value: 16 },
      { from: 'tool', to: 'tfp', value: 22 },
      { from: 'tool', to: 'green', value: 10 },
      { from: 'tool', to: 'newbiz', value: 8 },
      { from: 'object', to: 'newbiz', value: 14 },
      { from: 'object', to: 'green', value: 10 },
      { from: 'object', to: 'tfp', value: 8 },
    ]
  };

  /* ---------------- ⑩ 关系图谱（力导向） ---------------- */
  var graph = {
    caption: { zh: '「人工智能 → 新质生产力」关系图谱', en: 'AI → New Quality Productive Forces knowledge graph' },
    note: { zh: '按住节点可自由拖动，松手停住；悬停高亮邻接，滚轮缩放，空白处拖拽平移。节点颜色代表不同类别。', en: 'Drag any node freely; hover to highlight neighbours, scroll to zoom, drag the background to pan. Colours indicate categories.' },
    groups: [
      { id: 'core', label: { zh: '核心概念', en: 'Core concept' }, colorKey: '--c-accent' },
      { id: 'tech', label: { zh: '技术基础', en: 'Technology' }, colorKey: '--c-info' },
      { id: 'factor', label: { zh: '生产力要素', en: 'Production factor' }, colorKey: '--c-primary' },
      { id: 'effect', label: { zh: '产出与意义', en: 'Outcome' }, colorKey: '--c-success' },
      { id: 'policy', label: { zh: '政策牵引', en: 'Policy' }, colorKey: '--d5' },
      { id: 'app', label: { zh: '落地场景', en: 'Application' }, colorKey: '--d6' }
    ],
    relations: [
      { id: 'drive', label: { zh: '驱动', en: 'drives' } },
      { id: 'support', label: { zh: '支撑', en: 'supports' } },
      { id: 'enable', label: { zh: '赋能', en: 'enables' } },
      { id: 'guide', label: { zh: '牵引', en: 'guides' } },
      { id: 'part', label: { zh: '构成', en: 'composes' } }
    ],
    nodes: [
      { id: 'ai', g: 'core', size: 26, label: { zh: '人工智能', en: 'Artificial Intelligence' }, desc: { zh: '以数据、算力、算法为核心的新一代通用目的技术', en: 'A general-purpose technology built on data, compute and algorithms' } },
      { id: 'nqpf', g: 'core', size: 26, label: { zh: '新质生产力', en: 'New Quality Productive Forces' }, desc: { zh: '由技术革命性突破与要素创新性配置催生的先进生产力质态', en: 'An advanced form of productivity born from breakthroughs and innovative factor allocation' } },
      { id: 'dataf', g: 'core', size: 20, label: { zh: '数据要素', en: 'Data as a factor' }, desc: { zh: '可复制、可复用、越用越增值的第五大生产要素', en: 'The fifth production factor: copyable, reusable and value-adding' } },

      { id: 'compute', g: 'tech', size: 17, label: { zh: '算力基础设施', en: 'Computing infrastructure' }, desc: { zh: '智能算力规模快速扩张，成为新质生产力的「基础能源」', en: 'Rapidly expanding smart compute acts as the energy of NQPF' } },
      { id: 'algo', g: 'tech', size: 17, label: { zh: '算法与大模型', en: 'Algorithms & LLMs' }, desc: { zh: '大模型把知识封装成可以调用的通用能力', en: 'Large models package knowledge into callable general capability' } },
      { id: 'data', g: 'tech', size: 17, label: { zh: '数据资源', en: 'Data resources' }, desc: { zh: '训练与推理的燃料，也是产业知识的载体', en: 'Fuel for training and inference, and a carrier of industrial know-how' } },

      { id: 'labor', g: 'factor', size: 19, label: { zh: '劳动者升级', en: 'Labour upgrade' }, desc: { zh: '从单一技能走向人机协同的高技能劳动者', en: 'From single-skilled workers to human-AI collaboration' } },
      { id: 'tool', g: 'factor', size: 19, label: { zh: '劳动资料升级', en: 'Tool upgrade' }, desc: { zh: '生产工具从机械装备升级为「算法 + 算力」', en: 'Tools evolve from machinery to algorithms plus compute' } },
      { id: 'object', g: 'factor', size: 19, label: { zh: '劳动对象升级', en: 'Object upgrade' }, desc: { zh: '数据、知识与场景成为新的加工对象', en: 'Data, knowledge and scenarios become new objects of labour' } },

      { id: 'tfp', g: 'effect', size: 22, label: { zh: '全要素生产率提升', en: 'Higher TFP' }, desc: { zh: '同样的投入产出更多，是衡量新质生产力的核心指标', en: 'More output from the same input — the core metric of NQPF' } },
      { id: 'newbiz', g: 'effect', size: 20, label: { zh: '新产业新业态', en: 'New industries' }, desc: { zh: '智能驾驶、具身智能、生成式内容等全新赛道', en: 'New tracks such as autonomous driving, embodied AI and generative content' } },
      { id: 'green', g: 'effect', size: 20, label: { zh: '绿色低碳转型', en: 'Green transition' }, desc: { zh: '用算法优化能源与排放曲线，降低单位产出代价', en: 'Algorithms flatten energy and emission curves per unit of output' } },
      { id: 'jobs', g: 'effect', size: 18, label: { zh: '就业结构重塑', en: 'Job restructuring' }, desc: { zh: '重复岗位被替代，同时催生大量新职业', en: 'Repetitive roles decline while many new occupations emerge' } },

      { id: 'policy', g: 'policy', size: 15, label: { zh: '「人工智能+」行动', en: 'AI+ Initiative' }, desc: { zh: '推动 AI 与千行百业深度融合的国家行动', en: 'A national initiative to integrate AI into every industry' } },
      { id: 'datax', g: 'policy', size: 15, label: { zh: '「数据要素×」行动', en: 'Data Elements × Initiative' }, desc: { zh: '让数据在更多场景中流通、复用与增值', en: 'Letting data flow, be reused and multiply value' } },

      { id: 'mfg', g: 'app', size: 15, label: { zh: '智能制造', en: 'Smart manufacturing' }, desc: { zh: '机器视觉质检、预测性维护、柔性排产', en: 'Vision inspection, predictive maintenance, flexible scheduling' } },
      { id: 'med', g: 'app', size: 15, label: { zh: '智慧医疗', en: 'Smart healthcare' }, desc: { zh: '影像辅助诊断、AI 制药、基层远程诊疗', en: 'Imaging diagnosis, AI drug discovery, remote care' } },
      { id: 'agri', g: 'app', size: 15, label: { zh: '智慧农业', en: 'Smart agriculture' }, desc: { zh: '遥感巡田、无人机植保、智能育种', en: 'Remote sensing, drone spraying, smart breeding' } },
      { id: 'edu', g: 'app', size: 15, label: { zh: '智慧教育', en: 'Smart education' }, desc: { zh: '个性化学习路径与普惠优质资源', en: 'Personalized learning paths and inclusive resources' } },
      { id: 'energy', g: 'app', size: 15, label: { zh: '智慧能源', en: 'Smart energy' }, desc: { zh: '电网调度、风光功率预测、能耗优化', en: 'Grid dispatch, renewable forecasting, energy optimization' } },
      { id: 'city', g: 'app', size: 15, label: { zh: '智慧城市', en: 'Smart city' }, desc: { zh: '交通治理、公共安全与政务服务的智能升级', en: 'Traffic, public safety and government services' } }
    ],
    links: [
      { s: 'compute', t: 'ai', r: 'support' },
      { s: 'algo', t: 'ai', r: 'support' },
      { s: 'data', t: 'ai', r: 'support' },
      { s: 'data', t: 'dataf', r: 'part' },
      { s: 'nqpf', t: 'dataf', r: 'part' },
      { s: 'ai', t: 'labor', r: 'enable' },
      { s: 'ai', t: 'tool', r: 'enable' },
      { s: 'ai', t: 'object', r: 'enable' },
      { s: 'tool', t: 'nqpf', r: 'part' },
      { s: 'labor', t: 'nqpf', r: 'part' },
      { s: 'object', t: 'nqpf', r: 'part' },
      { s: 'nqpf', t: 'tfp', r: 'drive' },
      { s: 'nqpf', t: 'newbiz', r: 'drive' },
      { s: 'nqpf', t: 'green', r: 'drive' },
      { s: 'nqpf', t: 'jobs', r: 'drive' },
      { s: 'policy', t: 'ai', r: 'guide' },
      { s: 'datax', t: 'dataf', r: 'guide' },
      { s: 'policy', t: 'mfg', r: 'guide' },
      { s: 'policy', t: 'med', r: 'guide' },
      { s: 'policy', t: 'agri', r: 'guide' },
      { s: 'policy', t: 'edu', r: 'guide' },
      { s: 'policy', t: 'energy', r: 'guide' },
      { s: 'policy', t: 'city', r: 'guide' },
      { s: 'ai', t: 'mfg', r: 'enable' },
      { s: 'ai', t: 'med', r: 'enable' },
      { s: 'ai', t: 'agri', r: 'enable' },
      { s: 'ai', t: 'edu', r: 'enable' },
      { s: 'ai', t: 'energy', r: 'enable' },
      { s: 'ai', t: 'city', r: 'enable' },
      { s: 'mfg', t: 'newbiz', r: 'drive' },
      { s: 'med', t: 'newbiz', r: 'drive' },
      { s: 'energy', t: 'green', r: 'drive' },
      { s: 'agri', t: 'green', r: 'drive' },
      { s: 'edu', t: 'jobs', r: 'drive' },
      { s: 'city', t: 'tfp', r: 'drive' },
      { s: 'mfg', t: 'tfp', r: 'drive' }
    ]
  };

  /* ---------------- ⑪ 生产力模拟器 ---------------- */
  var sim = {
    caption: { zh: '生产力模拟器：调节四个旋钮，看看 AI 能把生产力推到多高', en: 'Productivity simulator: tune four dials and see how far AI can push productivity' },
    sliders: [
      { id: 'penetration', value: 35, unit: '%', label: { zh: 'AI 渗透率', en: 'AI penetration' }, hint: { zh: '有多少企业把 AI 真正用进生产流程', en: 'How many firms actually embed AI in operations' } },
      { id: 'dataFactor', value: 45, unit: '%', label: { zh: '数据要素投入强度', en: 'Data factor intensity' }, hint: { zh: '数据能否被采集、流通、复用', en: 'Whether data can be collected, shared and reused' } },
      { id: 'talent', value: 40, unit: '%', label: { zh: '数字人才密度', en: 'Digital talent density' }, hint: { zh: '劳动者中具备人机协同能力的比例', en: 'Share of workers able to collaborate with AI' } },
      { id: 'rd', value: 30, unit: '%', label: { zh: '研发投入强度', en: 'R&D intensity' }, hint: { zh: '持续迭代算法与模型的投入水平', en: 'Investment in continuously iterating models' } }
    ],
    presets: [
      { id: 'base', name: { zh: '当前基线', en: 'Current baseline' }, values: { penetration: 18, dataFactor: 25, talent: 22, rd: 20 } },
      { id: 'mfg', name: { zh: '制造强国', en: 'Manufacturing leader' }, values: { penetration: 45, dataFactor: 55, talent: 50, rd: 45 } },
      { id: 'full', name: { zh: '全面智能化', en: 'Full intelligence' }, values: { penetration: 80, dataFactor: 85, talent: 80, rd: 70 } }
    ],
    outputs: [
      { id: 'tfp', max: 1.8, decimals: 2, unit: { zh: '个百分点 / 年', en: 'pp / year' }, colorKey: '--c-primary', label: { zh: '全要素生产率年均提升', en: 'Annual TFP growth uplift' }, why: { zh: '新质生产力最核心的指标', en: 'The core metric of NQPF' } },
      { id: 'gdp', max: 3, decimals: 2, unit: { zh: '% / 年', en: '% / year' }, colorKey: '--c-accent', label: { zh: '对 GDP 增速的年均拉动', en: 'Annual GDP growth boost' }, why: { zh: '从产出端看 AI 的宏观贡献', en: 'Macro contribution from the output side' } },
      { id: 'cost', max: 25, decimals: 1, unit: { zh: '%', en: '%' }, colorKey: '--c-info', label: { zh: '综合运营成本下降', en: 'Operating cost reduction' }, why: { zh: '自动化与预测优化带来的成本红利', en: 'Cost dividend from automation and forecasting' } },
      { id: 'green', max: 20, decimals: 1, unit: { zh: '%', en: '%' }, colorKey: '--c-success', label: { zh: '单位产出能耗下降', en: 'Energy per unit output down' }, why: { zh: '绿色低碳转型的直接体现', en: 'A direct sign of the green transition' } },
      { id: 'jobs', max: 200, decimals: 0, unit: { zh: '万个 / 年', en: '10k jobs / year' }, colorKey: '--d5', label: { zh: '新增智能相关岗位', en: 'New AI-related jobs' }, why: { zh: '结构重塑不只是「替代」', en: 'Restructuring is not only about replacement' } }
    ],
    index: { zh: '综合新质生产力指数', en: 'Composite NQPF index' },
    baseline: { zh: '当前基线', en: 'Baseline' },
    formulaNote: {
      zh: '模型是一个公开、可复现的线性加权示意模型，用于说明各要素的相对重要性，不代表真实经济预测。',
      en: 'The model is an open, reproducible linear-weight illustration of relative importance rather than a real economic forecast.'
    },
    /* 公开可复现的示意模型：四个输入均为 0–1 */
    model: function (v) {
      var p = (v.penetration || 0) / 100;
      var d = (v.dataFactor || 0) / 100;
      var t = (v.talent || 0) / 100;
      var r = (v.rd || 0) / 100;
      var tfp = 0.20 + 0.55 * p + 0.30 * d + 0.35 * t + 0.30 * r;
      return {
        tfp: tfp,
        gdp: tfp * 1.5,
        cost: 3 + 13 * p + 5 * t,
        green: 2 + 9 * p + 7 * r,
        jobs: 15 + 120 * p + 60 * t,
        index: Math.round((0.40 * p + 0.20 * d + 0.20 * t + 0.20 * r) * 100)
      };
    }
  };

  /* ---------------- ⑫ 时间线 ---------------- */
  var timeline = {
    caption: { zh: '从达特茅斯到新质生产力：AI 的七十年', en: 'From Dartmouth to NQPF: seventy years of AI' },
    kinds: [
      { id: 'world', label: { zh: '技术里程碑', en: 'Technical' }, colorKey: '--c-info' },
      { id: 'cn', label: { zh: '中国实践', en: 'China' }, colorKey: '--c-accent' }
    ],
    items: [
      { year: 1956, kind: 'world', title: { zh: '达特茅斯会议', en: 'Dartmouth Conference' }, desc: { zh: '「人工智能」一词首次被提出，学科诞生。', en: 'The term artificial intelligence is coined and the field begins.' } },
      { year: 1997, kind: 'world', title: { zh: '深蓝战胜国际象棋冠军', en: 'Deep Blue beats the chess champion' }, desc: { zh: '机器在规则明确的智力游戏中首次超越人类顶尖水平。', en: 'Machines first surpass top humans in a rule-bounded intellectual game.' } },
      { year: 2012, kind: 'world', title: { zh: 'AlexNet 引爆深度学习', en: 'AlexNet ignites deep learning' }, desc: { zh: '图像识别错误率断崖式下降，AI 从实验室走向产业。', en: 'Image-recognition error rates plummet and AI moves from lab to industry.' } },
      { year: 2016, kind: 'world', title: { zh: 'AlphaGo 战胜李世石', en: 'AlphaGo defeats Lee Sedol' }, desc: { zh: '强化学习展示出在超复杂空间中的决策潜力。', en: 'Reinforcement learning reveals decision-making power in vast spaces.' } },
      { year: 2017, kind: 'world', title: { zh: 'Transformer 架构提出', en: 'The Transformer architecture' }, desc: { zh: '统一的注意力架构奠定大模型时代的技术底座。', en: 'A unified attention architecture becomes the foundation of the LLM era.' } },
      { year: 2020, kind: 'world', title: { zh: 'GPT-3 展示涌现能力', en: 'GPT-3 shows emergent ability' }, desc: { zh: '参数量跃升带来「规模即能力」的新范式。', en: 'Scale itself becomes capability.' } },
      { year: 2022, kind: 'world', title: { zh: 'ChatGPT 走向大众', en: 'ChatGPT reaches the public' }, desc: { zh: '生成式 AI 在两个月内获得上亿用户，AI 成为通用工具。', en: 'Generative AI gains 100M users in two months and becomes a general tool.' } },
      { year: 2023, kind: 'cn', title: { zh: '「新质生产力」明确提出', en: '"New quality productive forces" proposed' }, desc: { zh: '中国提出加快发展新质生产力，AI 被确立为核心驱动力。', en: 'China calls for faster development of NQPF, positioning AI as a core driver.' } },
      { year: 2024, kind: 'cn', title: { zh: '「人工智能+」行动', en: 'The AI+ Initiative' }, desc: { zh: '首次写入政府工作报告，推动 AI 与千行百业深度融合。', en: 'Written into the government work report to deepen AI integration across industries.' } },
      { year: 2025, kind: 'cn', title: { zh: '智能体与具身智能加速落地', en: 'Agents and embodied AI scale up' }, desc: { zh: 'AI 从「会说话」走向「会干活」，直接进入生产现场。', en: 'AI moves from talking to working, entering the shop floor directly.' } }
    ]
  };

  /* ---------------- ⑬ 落地场景 ---------------- */
  var scenes = {
    caption: { zh: 'AI 走进生产现场的八个场景', en: 'Eight scenarios where AI reaches the shop floor' },
    note: { zh: '以下数字为公开案例报道中的典型值区间，用于说明量级', en: 'Figures below are typical ranges reported in public case studies' },
    items: [
      { icon: '🏭', name: { zh: '智能制造', en: 'Smart manufacturing' }, desc: { zh: '机器视觉替代人工目检，预测性维护把非计划停机压到最低。', en: 'Machine vision replaces manual inspection; predictive maintenance minimizes unplanned downtime.' }, metrics: [{ k: { zh: '质检效率', en: 'Inspection efficiency' }, v: '+30%' }, { k: { zh: '非计划停机', en: 'Unplanned downtime' }, v: '-25%' }] },
      { icon: '🩺', name: { zh: '智慧医疗', en: 'Smart healthcare' }, desc: { zh: '影像辅助诊断把初筛时间压到分钟级，并让优质诊断能力下沉到基层。', en: 'AI-assisted imaging shortens triage to minutes and brings quality diagnosis to grassroots clinics.' }, metrics: [{ k: { zh: '阅片时间', en: 'Reading time' }, v: '-40%' }, { k: { zh: '基层覆盖率', en: 'Grassroots coverage' }, v: '60%' }] },
      { icon: '🌾', name: { zh: '智慧农业', en: 'Smart agriculture' }, desc: { zh: '遥感巡田与无人机植保按需施药，育种周期被算法显著压缩。', en: 'Remote sensing and drone spraying apply inputs on demand; breeding cycles shrink.' }, metrics: [{ k: { zh: '农药用量', en: 'Pesticide use' }, v: '-20%' }, { k: { zh: '亩均产量', en: 'Yield per mu' }, v: '+12%' }] },
      { icon: '🎓', name: { zh: '智慧教育', en: 'Smart education' }, desc: { zh: 'AI 助教批改与备课，教师把时间还给学生；个性化路径让因材施教可规模复制。', en: 'AI assistants grade and prepare lessons, returning time to students; personalization scales.' }, metrics: [{ k: { zh: '备课时间', en: 'Lesson prep time' }, v: '-50%' }, { k: { zh: '个性化学习覆盖', en: 'Personalized coverage' }, v: '45%' }] },
      { icon: '💳', name: { zh: '金融科技', en: 'Fintech' }, desc: { zh: '风控模型实时识别异常交易，智能客服承接大部分重复咨询。', en: 'Risk models flag anomalies in real time; AI service desks absorb repetitive enquiries.' }, metrics: [{ k: { zh: '欺诈识别率', en: 'Fraud detection' }, v: '+35%' }, { k: { zh: '客服成本', en: 'Service cost' }, v: '-30%' }] },
      { icon: '⚡', name: { zh: '智慧能源', en: 'Smart energy' }, desc: { zh: '功率预测与电网调度协同，让更多绿电被消纳、更少电能被浪费。', en: 'Forecasting and dispatch work together so more renewables are absorbed and less power wasted.' }, metrics: [{ k: { zh: '风光预测准确率', en: 'Renewable forecast accuracy' }, v: '+15%' }, { k: { zh: '综合线损', en: 'Grid losses' }, v: '-8%' }] },
      { icon: '🚦', name: { zh: '智慧交通', en: 'Smart mobility' }, desc: { zh: '信号配时随车流自适应，轨迹预测让安全预警提前几秒。', en: 'Adaptive signal timing follows traffic; trajectory prediction buys seconds of warning.' }, metrics: [{ k: { zh: '路口通行效率', en: 'Intersection throughput' }, v: '+20%' }, { k: { zh: '事故率', en: 'Accident rate' }, v: '-15%' }] },
      { icon: '🏛️', name: { zh: '数字政务', en: 'Digital government' }, desc: { zh: '智能预审与材料复用让「最多跑一次」落到实处。', en: 'Smart pre-review and document reuse make one-visit service real.' }, metrics: [{ k: { zh: '平均审批时长', en: 'Approval time' }, v: '-60%' }, { k: { zh: '群众满意度', en: 'Citizen satisfaction' }, v: '+18%' }] }
    ]
  };

  /* ---------------- ⑭ 数据来源 ---------------- */
  var sources = [
    { name: { zh: '中国信息通信研究院《人工智能发展报告》', en: 'CAICT — AI Development Report' }, note: { zh: '产业规模、算力规模', en: 'Industry and compute scale' } },
    { name: { zh: '工业和信息化部公开统计数据', en: 'Ministry of Industry and Information Technology' }, note: { zh: '算力与产业运行', en: 'Compute and industry operations' } },
    { name: { zh: '国家统计局年度统计公报', en: 'National Bureau of Statistics of China' }, note: { zh: '三次产业结构', en: 'Sector structure' } },
    { name: { zh: '普华永道《AI 对全球经济的影响》', en: 'PwC — Sizing the Prize' }, note: { zh: '2030 年 GDP 增量预测', en: '2030 GDP uplift projection' } },
    { name: { zh: '麦肯锡《生成式人工智能的经济潜力》', en: 'McKinsey — The Economic Potential of Generative AI' }, note: { zh: '生产率与市场价值', en: 'Productivity and market value' } },
    { name: { zh: 'IDC《全球人工智能支出指南》', en: 'IDC Worldwide AI Spending Guide' }, note: { zh: '市场规模与行业渗透', en: 'Market size and penetration' } },
    { name: { zh: '斯坦福 HAI《人工智能指数报告》', en: 'Stanford HAI — AI Index Report' }, note: { zh: '技术与国家比较', en: 'Technology and country comparison' } },
    { name: { zh: '世界经济论坛《未来就业报告》', en: 'World Economic Forum — Future of Jobs' }, note: { zh: '就业与技能结构', en: 'Jobs and skills' } }
  ];

  /* ---------------- ⑮ 阅读地图 ---------------- */
  var overview = [
    { icon: '🧩', name: { zh: '内涵：三要素升级', en: 'Concept: three factors' }, desc: { zh: '劳动者、劳动资料、劳动对象如何被 AI 各改一遍', en: 'How AI rewrites labour, tools and objects of labour' }, href: '#what' },
    { icon: '💪', name: { zh: '作用力：六维雷达', en: 'Forces: six-dimension radar' }, desc: { zh: '配合五股看得见的作用力', en: 'Plus five tangible forces of change' }, href: '#power' },
    { icon: '📈', name: { zh: '产业规模：增长曲线', en: 'Scale: growth curve' }, desc: { zh: '核心产业与带动产业的双曲线', en: 'Core and enabled industry curves' }, href: '#scale' },
    { icon: '🎯', name: { zh: '行业赋能：气泡矩阵', en: 'Industries: bubble matrix' }, desc: { zh: '15 个行业的渗透率 × 增益 × 规模', en: '15 industries in one matrix' }, href: '#industry' },
    { icon: '🌍', name: { zh: '全球格局：实力排名', en: 'Global: ranking' }, desc: { zh: '12 个经济体的 AI 发展指数', en: 'AI index of 12 economies' }, href: '#global' },
    { icon: '🔀', name: { zh: '要素重构：流向图', en: 'Factors: flow diagram' }, desc: { zh: '从 AI 投入到产出，资源怎么走', en: 'How inputs turn into outcomes' }, href: '#flow' },
    { icon: '🕸️', name: { zh: '关系图谱：可拖动', en: 'Graph: draggable' }, desc: { zh: '21 个节点、36 条关系的全景图', en: '21 nodes and 36 relations' }, href: '#graph' },
    { icon: '🎛️', name: { zh: '模拟器：你来调参数', en: 'Simulator: your turn' }, desc: { zh: '四个旋钮，实时算出生产力提升', en: 'Four dials, live productivity readout' }, href: '#sim' },
    { icon: '🕰️', name: { zh: '时间线：七十年', en: 'Timeline: 70 years' }, desc: { zh: '从达特茅斯会议到新质生产力', en: 'From Dartmouth to NQPF' }, href: '#timeline' },
    { icon: '🚀', name: { zh: '落地场景：八个现场', en: 'Use cases: eight sites' }, desc: { zh: 'AI 真正进入生产现场的样子', en: 'What AI looks like on the ground' }, href: '#scene' }
  ];

  /* ---------------- 导出 ---------------- */
  return {
    paletteKeys: PALETTE_KEYS,
    kpis: kpis,
    define: define,
    radar: radar,
    forces: forces,
    scale: scale,
    industry: industry,
    bubble: bubble,
    globalRank: globalRank,
    flow: flow,
    graph: graph,
    sim: sim,
    timeline: timeline,
    scenes: scenes,
    sources: sources,
    overview: overview,
    disclaimer: {
      zh: '本站所有数据来自公开资料整理与示意测算，不同机构统计口径存在差异，仅用于可视化表达与课堂讨论，不作为严谨的统计引用。',
      en: 'All data on this site is compiled from public sources and illustrative estimates. Statistical scopes differ between institutions; figures are for visualization and classroom discussion only.'
    }
  };
}());

