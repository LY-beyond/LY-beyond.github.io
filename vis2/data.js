/* =========================================================
 * data.js —— 全站数据与文案（唯一数据源）
 * ---------------------------------------------------------
 * ⚠️ 本文件由 `node data/build.mjs` 从 data/*.csv 生成，请不要直接编辑；
 *    改数据 → 改 data/ 下的 CSV，再跑一次构建；改模型 → 改 data/sim-model.js。
 *    数据字典（每个 CSV 有哪些列、什么类型、对应页面哪一节）见 data/README.md。
 *
 * 约定：
 *   ① 所有文案写成 { zh: '…', en: '…' }，由 I18N.pick() 取当前语言；
 *   ② 纯数字 / 数组不加包装，图表直接读取；
 *   ③ 每一组数据都带 source（数据来源），页面上必须如实展示；
 *   ④ provenance 是每个数据集的「口径」（sourced 公开统计 / modeled 测算整理 /
 *      projected 含预测），页面按图表显示一枚徽章；口径取这批数据里最弱的一环，
 *      规则与逐数据集明细见 data/README.md。
 *
 * 数据说明：本页数据为公开资料整理（中国信通院、工信部、国家统计局、
 * 普华永道、IDC、斯坦福 AI Index 等）与合理测算的示意图，
 * 不同机构口径不完全一致，仅用于可视化表达，不作为严谨统计引用。
 * ========================================================= */
window.AI_DATA = {
  paletteKeys: [
    '--s-base',
    '--s-base-alt',
    '--s-base-warm',
    '--c-accent',
    '--c-danger',
    '--c-info',
    '--c-primary',
    '--d5',
    '--d6',
    '--d3',
    '--d4'
  ],
  paletteBase: ['--s-base', '--s-base-alt', '--s-base-warm'],
  paletteAccent: ['--c-accent', '--c-danger', '--c-info', '--c-primary', '--d5', '--d6', '--d3', '--d4'],
  define: {
    lead: { zh: '官方给出的三个来源是技术革命性突破、生产要素创新性配置、产业深度转型升级。落到实处，就是不靠多投人、多投钱，让同样的要素用得更聪明。AI 动手的地方也在这三处：下面三张卡片，就是它们各自的前后对比。', en: 'The official definition names three sources: revolutionary technological breakthroughs, innovative allocation of production factors, and deep industrial transformation. In practice that means getting more out of the same factors rather than pouring in more people and money. AI works on all three fronts: the three cards below show each of them, before and after.' },
    pillars: [
      {
        key: 'labor',
        icon: '🧑‍🏭',
        name: { zh: '劳动者', en: 'Labour force' },
        before: { zh: '靠体力、靠一门手艺吃饭的普通工人', en: 'Workers who live by physical effort and one trade' },
        after: { zh: '会看数据、能和 AI 搭班干活的新工人', en: 'New workers who read data and team up with AI' },
        metric: { zh: '人均产出提升', en: 'Output per worker' },
        value: 35,
        max: 60,
        source: { zh: '综合世界经济论坛《未来就业报告》与国内调研测算', en: 'Based on WEF Future of Jobs and domestic survey estimates' }
      },
      {
        key: 'tool',
        icon: '🧰',
        name: { zh: '劳动资料', en: 'Means of production' },
        before: { zh: '机械化、自动化的工业设备与流水线', en: 'Mechanized, automated machinery and assembly lines' },
        after: { zh: '算力 + 算法 + 大模型，成了新一代生产工具', en: 'Compute plus algorithms plus large models as the new tools of the trade' },
        metric: { zh: '换一代工具的周期变短', en: 'Tools are replaced sooner' },
        value: 60,
        max: 80,
        source: { zh: '按大模型换代节奏（约 6–12 个月）估算', en: 'Estimated from 6–12 month model generations' }
      },
      {
        key: 'object',
        icon: '🗂️',
        name: { zh: '劳动对象', en: 'Objects of labour' },
        before: { zh: '土地、矿产等一次性消耗的实体原材料', en: 'Land, minerals and other consumable physical materials' },
        after: { zh: '数据、知识和场景，能反复用，还越用越值钱', en: 'Data, knowledge and scenarios: reuse them and they gain value' },
        metric: { zh: '数据在增长里占多少', en: 'Share of growth coming from data' },
        value: 45,
        max: 60,
        source: { zh: '按「数据要素 ×」行动和市场情况估算', en: 'Based on the Data Elements initiative and market figures' }
      }
    ],
    compare: {
      caption: { zh: '传统生产力 vs 新质生产力', en: 'Traditional vs. new quality productive forces' },
      colBefore: { zh: '传统生产力', en: 'Traditional' },
      colAfter: { zh: '新质生产力', en: 'New quality productive forces' },
      rows: [
        {
          dim: { zh: '增长动能', en: 'Growth driver' },
          before: { zh: '靠多投人力、多投钱', en: 'Add more people and money' },
          after: { zh: '靠技术和数据不停换代', en: 'Iterate on technology and data' }
        },
        {
          dim: { zh: '要素结构', en: 'Factor mix' },
          before: { zh: '土地、劳动力、资本说了算', en: 'Land, labour and capital rule' },
          after: { zh: '数据成为第五大生产要素', en: 'Data becomes a fifth production factor' }
        },
        {
          dim: { zh: '效率来源', en: 'Efficiency source' },
          before: { zh: '靠规模大、流程顺', en: 'Bigger scale, smoother process' },
          after: { zh: '靠全要素生产率往上走', en: 'Total factor productivity climbing' }
        },
        {
          dim: { zh: '产业形态', en: 'Industrial form' },
          before: { zh: '行业边界清楚，各干各的', en: 'Clear industry borders, each on its own' },
          after: { zh: '线上线下、跨行业搅在一起的新业态', en: 'Online and offline, industries mixed together' }
        },
        {
          dim: { zh: '环境代价', en: 'Environmental cost' },
          before: { zh: '投入多、耗能高、排放大', en: 'Heavy inputs, heavy energy, heavy emissions' },
          after: { zh: '绿电更多，算力更省', en: 'More clean power, thriftier compute' }
        }
      ]
    }
  },
  timeline: {
    caption: { zh: '从达特茅斯到新质生产力：AI 的七十年', en: 'From Dartmouth to NQPF: seventy years of AI' },
    kinds: [
      { id: 'world', label: { zh: '技术里程碑', en: 'Technical' }, colorKey: '--c-info' },
      { id: 'cn', label: { zh: '中国实践', en: 'China' }, colorKey: '--c-accent' }
    ],
    items: [
      {
        year: 1956,
        kind: 'world',
        title: { zh: '达特茅斯会议', en: 'Dartmouth Conference' },
        desc: { zh: '「人工智能」这个词第一次出现，一门新学科就此起步。', en: 'The term artificial intelligence is coined and a new field begins.' }
      },
      {
        year: 1997,
        kind: 'world',
        title: { zh: '深蓝战胜国际象棋冠军', en: 'Deep Blue beats the chess champion' },
        desc: { zh: '在规则清楚的棋类游戏里，机器第一次赢了人类顶尖高手。', en: 'In a game with clear rules, a machine beats the best human for the first time.' }
      },
      {
        year: 2012,
        kind: 'world',
        title: { zh: 'AlexNet 引爆深度学习', en: 'AlexNet ignites deep learning' },
        desc: { zh: '图像识别错误率一路下降，AI 从实验室走进工厂和产品。', en: 'Image recognition errors fall sharply and AI leaves the lab for real products.' }
      },
      {
        year: 2016,
        kind: 'world',
        title: { zh: 'AlphaGo 战胜李世石', en: 'AlphaGo defeats Lee Sedol' },
        desc: { zh: '强化学习证明：局面复杂到人算不过来时，机器也能自己做决策。', en: 'Reinforcement learning shows a machine can decide when the space is too complex to calculate.' }
      },
      {
        year: 2017,
        kind: 'world',
        title: { zh: 'Transformer 架构提出', en: 'The Transformer architecture' },
        desc: { zh: '一套统一的注意力架构，成了后来所有大模型的底座。', en: 'One common attention architecture becomes the base of every later large model.' }
      },
      {
        year: 2020,
        kind: 'world',
        title: { zh: 'GPT-3 展示涌现能力', en: 'GPT-3 shows emergent ability' },
        desc: { zh: '参数越堆越多，能力跟着涨——「大就是强」成了新共识。', en: 'More parameters, more capability: bigger is stronger becomes the new consensus.' }
      },
      {
        year: 2022,
        kind: 'world',
        title: { zh: 'ChatGPT 走向大众', en: 'ChatGPT reaches the public' },
        desc: { zh: '两个月上亿人用上生成式 AI，AI 从此变成随手可用的工具。', en: 'Generative AI reaches 100 million users in two months and becomes an everyday tool.' }
      },
      {
        year: 2023,
        kind: 'cn',
        title: { zh: '「新质生产力」明确提出', en: '"New quality productive forces" proposed' },
        desc: { zh: '中国提出加快发展新质生产力，AI 被点名为核心驱动力。', en: 'China calls for faster development of NQPF and names AI as the core driver.' }
      },
      {
        year: 2024,
        kind: 'cn',
        title: { zh: '「人工智能+」行动', en: 'The AI+ Initiative' },
        desc: { zh: '「人工智能+」第一次写进政府工作报告，各行各业开始上 AI。', en: 'AI Plus enters the government work report for the first time; industries start adopting AI.' }
      },
      {
        year: 2025,
        kind: 'cn',
        title: { zh: '智能体与具身智能加速落地', en: 'Agents and embodied AI scale up' },
        desc: { zh: 'AI 从「会说话」走向「会干活」，直接进入生产现场。', en: 'AI moves from talking to working, entering the shop floor directly.' }
      }
    ]
  },
  scenes: {
    caption: { zh: 'AI 走进生产现场的八个场景', en: 'Eight scenarios where AI reaches the shop floor' },
    note: { zh: '下面的数字来自公开案例报道，是典型区间，只看量级', en: 'Figures come from public case reports as typical ranges: read them for scale only' },
    items: [
      {
        icon: '🏭',
        match: 'manufacturing',
        name: { zh: '智能制造', en: 'Smart manufacturing' },
        desc: { zh: '机器视觉替掉人工目检，设备提前报故障，意外停机压到最低。', en: 'Machine vision replaces manual inspection and early warnings keep unplanned downtime minimal.' },
        metrics: [
          { k: { zh: '质检效率', en: 'Inspection efficiency' }, v: '+30%' },
          { k: { zh: '非计划停机', en: 'Unplanned downtime' }, v: '-25%' }
        ]
      },
      {
        icon: '🩺',
        match: 'healthcare',
        name: { zh: '智慧医疗', en: 'Smart healthcare' },
        desc: { zh: 'AI 先看片子，初筛只要几分钟，基层医院也能有专家级的诊断水平。', en: 'AI reads the scans first: triage takes minutes and grassroots clinics get expert-level reading.' },
        metrics: [
          { k: { zh: '阅片时间', en: 'Reading time' }, v: '-40%' },
          { k: { zh: '基层覆盖率', en: 'Grassroots coverage' }, v: '60%' }
        ]
      },
      {
        icon: '🌾',
        match: 'agriculture',
        name: { zh: '智慧农业', en: 'Smart agriculture' },
        desc: { zh: '卫星遥感加无人机植保，该打药时才打药；育种周期也被算法缩短了。', en: 'Satellite and drone scouting spray only when needed, and algorithms shorten breeding cycles.' },
        metrics: [
          { k: { zh: '农药用量', en: 'Pesticide use' }, v: '-20%' },
          { k: { zh: '亩均产量', en: 'Yield per mu' }, v: '+12%' }
        ]
      },
      {
        icon: '🎓',
        match: 'education',
        name: { zh: '智慧教育', en: 'Smart education' },
        desc: { zh: 'AI 批作业、帮备课，老师把时间还给课堂；一个班几十人也能各学各的进度。', en: 'AI marks homework and drafts lessons, giving teachers time back; a class can move at many speeds.' },
        metrics: [
          { k: { zh: '备课时间', en: 'Lesson prep time' }, v: '-50%' },
          { k: { zh: '个性化学习覆盖', en: 'Personalized coverage' }, v: '45%' }
        ]
      },
      {
        icon: '💳',
        match: 'finance',
        name: { zh: '金融科技', en: 'Fintech' },
        desc: { zh: '风控模型盯着异常交易，重复的咨询交给 AI 客服。', en: 'Risk models watch transactions in real time and AI desks take the repetitive questions.' },
        metrics: [
          { k: { zh: '欺诈识别率', en: 'Fraud detection' }, v: '+35%' },
          { k: { zh: '客服成本', en: 'Service cost' }, v: '-30%' }
        ]
      },
      {
        icon: '⚡',
        match: 'energy',
        name: { zh: '智慧能源', en: 'Smart energy' },
        desc: { zh: '先算准风电光伏能发多少，电网照着调，绿电多用一点、浪费少一点。', en: 'Forecast the wind and sun first, dispatch to match: more renewables used, less power wasted.' },
        metrics: [
          { k: { zh: '风光预测准确率', en: 'Renewable forecast accuracy' }, v: '+15%' },
          { k: { zh: '综合线损', en: 'Grid losses' }, v: '-8%' }
        ]
      },
      {
        icon: '🚦',
        match: 'logistics',
        name: { zh: '智慧交通', en: 'Smart mobility' },
        desc: { zh: '红绿灯跟着车流变，风险提前几秒预警。', en: 'Lights follow the traffic, and predictions give a few seconds of warning.' },
        metrics: [
          { k: { zh: '路口通行效率', en: 'Intersection throughput' }, v: '+20%' },
          { k: { zh: '事故率', en: 'Accident rate' }, v: '-15%' }
        ]
      },
      {
        icon: '🏛️',
        match: 'public',
        name: { zh: '数字政务', en: 'Digital government' },
        desc: { zh: '材料先机审、还能复用，「最多跑一次」不再只是口号。', en: 'Documents are pre-checked and reused, so one visit really is enough.' },
        metrics: [
          { k: { zh: '平均审批时长', en: 'Approval time' }, v: '-60%' },
          { k: { zh: '群众满意度', en: 'Citizen satisfaction' }, v: '+18%' }
        ]
      }
    ]
  },
  kpis: [
    {
      value: 6964,
      decimals: 0,
      unit: { zh: '亿元', en: '×100M CNY' },
      label: { zh: '2024 年中国人工智能核心产业规模', en: 'China AI core industry scale, 2024' },
      sub: { zh: '连续多年保持在 20% 左右', en: 'Around 20% for several years running' }
    },
    {
      value: 15.7,
      decimals: 1,
      unit: { zh: '万亿美元', en: 'trillion USD' },
      label: { zh: '2030 年 AI 对全球 GDP 的增量贡献', en: 'AI incremental contribution to global GDP by 2030' },
      sub: { zh: '相当于再造一个中等发达经济体', en: 'Roughly the size of a mid-sized developed economy' }
    },
    {
      value: 26,
      decimals: 0,
      unit: { zh: '%', en: '%' },
      label: { zh: '其中中国预计可获得的份额', en: 'Share expected to be captured by China' },
      sub: { zh: '约合 7 万亿美元增量', en: 'About 7 trillion USD' }
    },
    {
      value: 30,
      decimals: 0,
      unit: { zh: '%', en: '%' },
      label: { zh: '我国算力总规模近五年年均增速', en: 'Five-year CAGR of China computing capacity' },
      sub: { zh: '算力被当成新质生产力的「基础能源」', en: 'Compute is treated as the basic energy of NQPF' }
    }
  ],
  radar: {
    caption: { zh: '六个维度：传统生产力 vs AI 赋能的新质生产力', en: 'Six dimensions: traditional productivity vs AI-enabled NQPF' },
    note: { zh: '评分是 0–100 的指数，按公开研究和产业调研整理，只用来对比，不代表绝对水平', en: 'Scores are 0–100 indices compiled from public research and industry surveys: for comparison only, not absolute levels' },
    source: { zh: '综合中国信通院、麦肯锡《生成式 AI 的经济潜力》等研究整理', en: 'Compiled from CAICT, McKinsey generative-AI research and others' },
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
    ]
  },
  forces: [
    {
      icon: '📈',
      name: { zh: '提高全要素生产率', en: 'Raising total factor productivity' },
      desc: { zh: 'AI 让同样的人、设备与资本产出更多：机器视觉替代重复质检、预测性维护减少停机、大模型压缩知识与文档处理时间，效率提升不再依赖加班加点。', en: 'AI multiplies output from the same people, machines and capital: machine vision replaces repetitive inspection, predictive maintenance cuts downtime, and large models compress knowledge work.' },
      stat: {
        value: '0.5–1.5',
        unit: { zh: '个百分点 / 年', en: 'pp per year' },
        label: { zh: '研究估算的 AI 对全要素生产率的年均拉动', en: 'Estimated yearly boost AI gives total factor productivity' }
      },
      tag: { zh: '效率革命', en: 'Efficiency' }
    },
    {
      icon: '🧬',
      name: { zh: '催生新产业新业态', en: 'Creating new industries' },
      desc: { zh: '智能驾驶、生成式内容、具身智能、AI 制药……AI 本身成为巨大的产业，同时把旧行业重新组装成新赛道，创造出过去不存在的岗位与市场。', en: 'Autonomous driving, generative content, embodied intelligence, AI drug discovery — AI is itself a huge industry that reassembles old sectors into brand-new markets and jobs.' },
      stat: {
        value: '1.3',
        unit: { zh: '万亿美元', en: 'trillion USD' },
        label: { zh: '生成式 AI 到 2032 年可能创造的新增市场价值', en: 'Potential market value created by generative AI by 2032' }
      },
      tag: { zh: '产业创新', en: 'Industry' }
    },
    {
      icon: '⚖️',
      name: { zh: '重构要素配置', en: 'Reallocating production factors' },
      desc: { zh: '数据成为可复用的生产要素，算力像水电一样按需调度；AI 让供需预测更准、库存更薄、物流更短，把资源从「平均用力」转向「精准投放」。', en: 'Data becomes a reusable factor and compute is dispatched on demand like utilities. Better forecasting means thinner inventory and shorter logistics — from average allocation to precision allocation.' },
      stat: {
        value: '7.5',
        unit: { zh: '%', en: '%' },
        label: { zh: 'AI 用得比较熟的企业，报出来的物流与库存成本降幅', en: 'Logistics and inventory cost cuts reported by firms that use AI well' }
      },
      tag: { zh: '资源配置', en: 'Allocation' }
    },
    {
      icon: '🌱',
      name: { zh: '推动绿色低碳转型', en: 'Driving green transition' },
      desc: { zh: '电网用 AI 调度削峰填谷、数据中心液冷降耗、工业用 AI 优化能耗曲线；单位 GDP 的能耗与排放正在被算法一点点「抠」下来。', en: 'AI balances power grids, liquid cooling lowers data-centre energy use, and algorithms flatten industrial energy curves — energy and emissions per unit of GDP keep falling.' },
      stat: {
        value: '8–10',
        unit: { zh: '%', en: '%' },
        label: { zh: 'AI 优化后数据中心能耗的降幅区间（示意）', en: 'Fall in data-centre energy use after AI optimisation (illustrative)' }
      },
      tag: { zh: '绿色发展', en: 'Green' }
    },
    {
      icon: '🤝',
      name: { zh: '促进人的全面发展', en: 'Advancing human development' },
      desc: { zh: 'AI 把重复劳动交给机器，把创造力、判断力和人与人的连接还给人；好医院、好学校、好服务也能下沉到县城和乡村。', en: 'AI hands repetitive work to machines and gives back creativity, judgement and human contact; good hospitals, schools and services reach counties and villages too.' },
      stat: {
        value: '60',
        unit: { zh: '%+', en: '%+' },
        label: { zh: '基层医疗机构用上 AI 辅助诊断的比例（示意）', en: 'Share of grassroots clinics using AI-assisted diagnosis (illustrative)' }
      },
      tag: { zh: '普惠共享', en: 'Inclusion' }
    }
  ],
  scale: {
    caption: { zh: '中国人工智能核心产业规模（2019–2028E）', en: 'China AI core industry scale (2019–2028E)' },
    unit: { zh: '亿元', en: '×100M CNY' },
    coreLabel: { zh: '人工智能核心产业规模', en: 'AI core industry' },
    relatedLabel: { zh: '带动相关产业规模', en: 'Related industries enabled' },
    note: { zh: '2019–2024 是公开数据；2025 是公开预测值；2026–2028E 是本页用 2019–2024 数据做的线性回归外推（95% 预测区间）。各家机构口径不一样，这里按公开报道整理', en: '2019–2024 are public figures, 2025 is a published projection, and 2026–2028E are our own linear-regression extrapolations from the 2019–2024 actuals (95% prediction interval). Definitions differ between institutions; this follows public reporting.' },
    source: { zh: '中国信通院《人工智能发展报告》、工信部公开数据整理', en: 'CAICT AI Development Report; MIIT public data' },
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
    forecast: [
      {
        year: 2026,
        core: 9627,
        coreLo: 7915,
        coreHi: 11338,
        related: 26176,
        relatedLo: 22887,
        relatedHi: 29465
      },
      {
        year: 2027,
        core: 10892,
        coreLo: 8981,
        coreHi: 12802,
        related: 29519,
        relatedLo: 25848,
        relatedHi: 33190
      },
      {
        year: 2028,
        core: 12157,
        coreLo: 10032,
        coreHi: 14281,
        related: 32862,
        relatedLo: 28779,
        relatedHi: 36945
      }
    ]
  },
  growth: {
    caption: { zh: '增长对比：AI 相关产业 vs GDP vs 全要素生产率', en: 'Growth: AI-related industry vs GDP vs TFP' },
    unit: { zh: '%／年', en: '%/yr' },
    aiLabel: { zh: '人工智能相关产业规模', en: 'AI-related industry scale' },
    gdpLabel: { zh: '中国 GDP（实际）', en: 'China real GDP' },
    tfpLabel: { zh: '全要素生产率（估算）', en: 'Total factor productivity (est.)' },
    note: { zh: 'GDP 增速为国家统计局公开数据；AI 相关产业增速由本页产业规模数据推导；全要素生产率为公开研究整理测算；2021 年 AI 增速偏高源于低基数与统计口径调整', en: 'GDP growth is from the National Bureau of Statistics; AI-related industry growth is derived from this page\'s scale data; TFP is compiled from public research; the 2021 AI spike reflects a low base and a definition change' },
    source: { zh: '国家统计局年度统计公报 + 中国信通院产业规模数据整理', en: 'NBS annual communiqués plus CAICT industry-scale data' },
    points: [
      { year: 2020, ai: 41.7, gdp: 2.2, tfp: 0.7 },
      { year: 2021, ai: 76.5, gdp: 8.4, tfp: 1.5 },
      { year: 2022, ai: 50, gdp: 3, tfp: 0.9 },
      { year: 2023, ai: 19.3, gdp: 5.2, tfp: 1.1 },
      { year: 2024, ai: 21.1, gdp: 5, tfp: 1 }
    ]
  },
  drivers: {
    caption: { zh: '谁在拉动增长：AI 与其他驱动力', en: 'Who drives growth: AI versus other drivers' },
    unit: { zh: '个百分点', en: 'percentage points' },
    v1Label: { zh: '2015–19 年均', en: '2015–19 avg' },
    v2Label: { zh: '2020–24 年均', en: '2020–24 avg' },
    note: { zh: '各驱动力对 GDP 增长的贡献（百分点）为公开研究整理测算；资本积累体量最大但在回落 — 人工智能是唯一持续上升的驱动力', en: 'Contributions to GDP growth in percentage points are compiled from public research; capital formation is the largest but declining — AI is the only driver still rising' },
    source: { zh: '依据世界银行、麦肯锡与国内公开研究整理测算', en: 'Compiled from the World Bank · McKinsey and domestic public research' },
    rows: [
      {
        id: 'ai',
        key: { zh: '人工智能', en: 'Artificial intelligence' },
        v1: 0.2,
        v2: 0.9,
        note: { zh: '唯一持续上升的驱动力 — 贡献提高到约 4 倍', en: 'The only driver still rising — contribution up about 4x' }
      },
      {
        id: 'digital',
        key: { zh: '大数据与云计算', en: 'Big data and cloud' },
        v1: 0.5,
        v2: 0.8,
        note: { zh: '数字化的底座 — 增长平稳', en: 'The digital base — steady growth' }
      },
      {
        id: 'tech',
        key: { zh: '传统技术进步', en: 'Conventional technology' },
        v1: 0.9,
        v2: 0.7,
        note: { zh: '成熟技术 — 贡献见顶', en: 'Mature technologies — contribution peaking' }
      },
      {
        id: 'capital',
        key: { zh: '资本深化', en: 'Capital deepening' },
        v1: 3.1,
        v2: 2.7,
        note: { zh: '体量最大 — 但越往后越使不上劲', en: 'Biggest slice — but it pulls less each year' }
      },
      {
        id: 'labor',
        key: { zh: '劳动投入', en: 'Labour input' },
        v1: 0.6,
        v2: 0.3,
        note: { zh: '人少了，贡献跟着降', en: 'Fewer workers, less contribution' }
      }
    ]
  },
  industry: {
    caption: { zh: 'AI 在三次产业中的渗透率与效率增益', en: 'AI penetration and efficiency gain across three sectors' },
    penetration: { zh: 'AI 渗透率', en: 'AI penetration' },
    gain: { zh: '效率增益', en: 'Efficiency gain' },
    sizeLabel: { zh: '产业增加值占 GDP 比重', en: 'Share of GDP value added' },
    note: { zh: '渗透率 = 使用 AI 技术的企业比例；效率增益为应用企业自报的均值', en: 'Penetration = share of firms using AI; gain = average self-reported improvement' },
    source: { zh: '国家统计局产业结构数据 + 行业调研整理', en: 'National Bureau of Statistics plus industry surveys' },
    rows: [
      {
        id: 'tertiary',
        key: { zh: '第三产业 · 服务业', en: 'Tertiary · Services' },
        penetration: 31,
        gain: 35,
        size: 55,
        note: { zh: '金融、零售、内容、专业服务最先被大模型改写', en: 'Finance, retail, content and professional services are rewritten first' }
      },
      {
        id: 'secondary',
        key: { zh: '第二产业 · 工业', en: 'Secondary · Industry' },
        penetration: 22,
        gain: 28,
        size: 37,
        note: { zh: '智能制造、机器质检、预测性维护是主战场', en: 'Smart manufacturing, machine inspection and predictive maintenance dominate' }
      },
      {
        id: 'primary',
        key: { zh: '第一产业 · 农业', en: 'Primary · Agriculture' },
        penetration: 8,
        gain: 12,
        size: 7,
        note: { zh: '遥感、无人机与智能育种正在打开空间', en: 'Remote sensing, drones and smart breeding open new space' }
      }
    ]
  },
  bubble: {
    caption: { zh: '15 个行业的 AI 渗透率 × 效率增益 × 市场规模', en: '15 industries: AI penetration × efficiency gain × market size' },
    xLabel: { zh: 'AI 渗透率（%）', en: 'AI penetration (%)' },
    yLabel: { zh: '效率增益（%）', en: 'Efficiency gain (%)' },
    sizeLabel: { zh: '市场规模（亿元）', en: 'Market size (×100M CNY)' },
    note: { zh: '气泡越大代表该行业可被 AI 改造的市场规模越大；纵轴为应用企业报告的效率增益中位数', en: 'Larger bubbles mean larger addressable market; the vertical axis is the median reported efficiency gain' },
    source: { zh: '综合 IDC、艾瑞咨询、行业年报整理测算', en: 'Compiled from IDC, iResearch and industry annual reports' },
    quadrants: [
      { zh: '高渗透 · 高增益', en: 'High / High' },
      { zh: '低渗透 · 高增益', en: 'Low / High' },
      { zh: '低渗透 · 低增益', en: 'Low / Low' },
      { zh: '高渗透 · 低增益', en: 'High / Low' }
    ],
    points: [
      { id: 'finance', name: { zh: '金融', en: 'Finance' }, x: 42, y: 32, size: 900, sector: 'tertiary' },
      { id: 'media', name: { zh: '传媒内容', en: 'Media' }, x: 45, y: 38, size: 650, sector: 'tertiary' },
      { id: 'security', name: { zh: '安防', en: 'Security' }, x: 40, y: 33, size: 750, sector: 'tertiary' },
      { id: 'retail', name: { zh: '零售电商', en: 'Retail' }, x: 35, y: 30, size: 800, sector: 'tertiary' },
      {
        id: 'automotive',
        name: { zh: '汽车', en: 'Automotive' },
        x: 33,
        y: 31,
        size: 1100,
        sector: 'secondary'
      },
      {
        id: 'public',
        name: { zh: '政务服务', en: 'Public service' },
        x: 30,
        y: 25,
        size: 450,
        sector: 'tertiary'
      },
      { id: 'logistics', name: { zh: '交通物流', en: 'Logistics' }, x: 28, y: 29, size: 520, sector: 'tertiary' },
      {
        id: 'manufacturing',
        name: { zh: '制造业', en: 'Manufacturing' },
        x: 25,
        y: 28,
        size: 1200,
        sector: 'secondary'
      },
      { id: 'energy', name: { zh: '能源电力', en: 'Energy' }, x: 22, y: 24, size: 400, sector: 'secondary' },
      {
        id: 'healthcare',
        name: { zh: '医疗健康', en: 'Healthcare' },
        x: 20,
        y: 26,
        size: 600,
        sector: 'tertiary'
      },
      { id: 'education', name: { zh: '教育', en: 'Education' }, x: 18, y: 22, size: 500, sector: 'tertiary' },
      { id: 'legal', name: { zh: '法律', en: 'Legal' }, x: 15, y: 20, size: 150, sector: 'tertiary' },
      {
        id: 'construction',
        name: { zh: '建筑地产', en: 'Construction' },
        x: 12,
        y: 18,
        size: 300,
        sector: 'secondary'
      },
      { id: 'agriculture', name: { zh: '农业', en: 'Agriculture' }, x: 8, y: 12, size: 200, sector: 'primary' },
      { id: 'mining', name: { zh: '矿业', en: 'Mining' }, x: 6, y: 14, size: 180, sector: 'secondary' }
    ]
  },
  heatmap: {
    caption: { zh: '15 个行业 × 5 项指标：一张热力矩阵', en: '15 industries × 5 metrics in one heat matrix' },
    legend: { zh: '同列内相对高低', en: 'Relative within a column' },
    legendLow: { zh: '低', en: 'low' },
    legendHigh: { zh: '高', en: 'high' },
    note: { zh: '每列自己从最小值排到最大值上色（不是全局统一），颜色深浅只说明「在这一列里排第几」；前三条指标和上方的气泡矩阵是同一份数据。', en: 'Each column is coloured from its own minimum to its own maximum (not globally), so shade only says where a row ranks inside that column. The first three metrics come from the same data as the bubble matrix above.' },
    source: { zh: '综合 IDC、艾瑞咨询、行业年报与招聘平台数据整理测算', en: 'Compiled from IDC, iResearch, industry annual reports and hiring platforms' },
    metrics: [
      {
        id: 'pen',
        label: { zh: 'AI 渗透率', en: 'AI penetration' },
        short: { zh: '渗透率', en: 'Penetr.' },
        unit: { zh: '%', en: '%' },
        decimals: 0
      },
      {
        id: 'gain',
        label: { zh: '效率增益', en: 'Efficiency gain' },
        short: { zh: '效率增益', en: 'Gain' },
        unit: { zh: '%', en: '%' },
        decimals: 0
      },
      {
        id: 'size',
        label: { zh: '市场规模', en: 'Market size' },
        short: { zh: '市场规模', en: 'Market' },
        unit: { zh: ' 亿元', en: ' (100M CNY)' },
        decimals: 0
      },
      {
        id: 'cagr',
        label: { zh: '市场五年增速', en: '5-year CAGR' },
        short: { zh: '五年增速', en: 'CAGR' },
        unit: { zh: '%', en: '%' },
        decimals: 0
      },
      {
        id: 'talent',
        label: { zh: '人才密度指数', en: 'Talent density' },
        short: { zh: '人才密度', en: 'Talent' },
        unit: { zh: '/100', en: '/100' },
        decimals: 0
      }
    ],
    rows: [
      { id: 'finance', name: { zh: '金融', en: 'Finance' }, pen: 42, gain: 32, size: 900, cagr: 17, talent: 78 },
      { id: 'media', name: { zh: '传媒内容', en: 'Media' }, pen: 45, gain: 38, size: 650, cagr: 21, talent: 70 },
      {
        id: 'security',
        name: { zh: '安防', en: 'Security' },
        pen: 40,
        gain: 33,
        size: 750,
        cagr: 15,
        talent: 62
      },
      { id: 'retail', name: { zh: '零售电商', en: 'Retail' }, pen: 35, gain: 30, size: 800, cagr: 19, talent: 58 },
      {
        id: 'automotive',
        name: { zh: '汽车', en: 'Automotive' },
        pen: 33,
        gain: 31,
        size: 1100,
        cagr: 24,
        talent: 66
      },
      {
        id: 'public',
        name: { zh: '政务服务', en: 'Public service' },
        pen: 30,
        gain: 25,
        size: 450,
        cagr: 13,
        talent: 55
      },
      {
        id: 'logistics',
        name: { zh: '交通物流', en: 'Logistics' },
        pen: 28,
        gain: 29,
        size: 520,
        cagr: 18,
        talent: 48
      },
      {
        id: 'manufacturing',
        name: { zh: '制造业', en: 'Manufacturing' },
        pen: 25,
        gain: 28,
        size: 1200,
        cagr: 20,
        talent: 61
      },
      { id: 'energy', name: { zh: '能源电力', en: 'Energy' }, pen: 22, gain: 24, size: 400, cagr: 16, talent: 52 },
      {
        id: 'healthcare',
        name: { zh: '医疗健康', en: 'Healthcare' },
        pen: 20,
        gain: 26,
        size: 600,
        cagr: 26,
        talent: 72
      },
      {
        id: 'education',
        name: { zh: '教育', en: 'Education' },
        pen: 18,
        gain: 22,
        size: 500,
        cagr: 22,
        talent: 64
      },
      { id: 'legal', name: { zh: '法律', en: 'Legal' }, pen: 15, gain: 20, size: 150, cagr: 12, talent: 57 },
      {
        id: 'construction',
        name: { zh: '建筑地产', en: 'Construction' },
        pen: 12,
        gain: 18,
        size: 300,
        cagr: 11,
        talent: 38
      },
      {
        id: 'agriculture',
        name: { zh: '农业', en: 'Agriculture' },
        pen: 8,
        gain: 12,
        size: 200,
        cagr: 25,
        talent: 30
      },
      { id: 'mining', name: { zh: '矿业', en: 'Mining' }, pen: 6, gain: 14, size: 180, cagr: 9, talent: 27 }
    ]
  },
  multiples: {
    caption: { zh: '三次产业：AI 渗透率与效率增益的七年轨迹（小倍数图）', en: 'Three sectors: seven-year tracks of AI penetration and efficiency gain (small multiples)' },
    seriesLabels: { penetration: { zh: 'AI 渗透率', en: 'AI penetration' }, gain: { zh: '效率增益', en: 'Efficiency gain' } },
    note: { zh: '2024 年的两个端点与上方「三次产业赋能」条形图完全一致（渗透率 31 / 22 / 8，增益 35 / 28 / 12）；2025 年为预测，用虚线表示。', en: 'The 2024 end points match the sector bars above exactly (penetration 31 / 22 / 8, gain 35 / 28 / 12); 2025 is a forecast drawn dashed.' },
    source: { zh: '国家统计局产业结构数据 + 行业调研整理推算', en: 'National Bureau of Statistics plus industry survey estimates' },
    series: [
      {
        id: 'tertiary',
        key: { zh: '第三产业 · 服务业', en: 'Tertiary · Services' },
        colorKey: '--c-accent',
        penetration: [12, 16, 19, 23, 26, 31, 36],
        gain: [14, 18, 21, 25, 29, 35, 40]
      },
      {
        id: 'secondary',
        key: { zh: '第二产业 · 工业', en: 'Secondary · Industry' },
        colorKey: '--c-primary',
        penetration: [7, 9, 12, 15, 18, 22, 27],
        gain: [10, 13, 16, 20, 23, 28, 33]
      },
      {
        id: 'primary',
        key: { zh: '第一产业 · 农业', en: 'Primary · Agriculture' },
        colorKey: '--c-info',
        penetration: [2.5, 3.2, 4, 5, 6.2, 8, 10.5],
        gain: [3, 4, 5.5, 7, 9, 12, 15]
      }
    ]
  },
  globalRank: {
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
  },
  province: {
    caption: { zh: '中国人工智能算力与企业的地理分布（示意）', en: 'Where AI compute and firms sit in China (indicative)' },
    insetLabel: { zh: '南海诸岛', en: 'South China Sea Is.' },
    noData: { zh: '暂无数据', en: 'No data' },
    leaders: { zh: '前五名', en: 'Top five' },
    note: { zh: '省级算力和企业数没有统一的权威口径，这里按公开报道和各省「人工智能 +」方案的目标折算成示意值（全国合计约 32 EFLOPS、2.2 万家企业），只看各省之间的相对结构，不看绝对水平；地图是抽稀后的示意轮廓。', en: 'Provincial compute and firm counts have no single authoritative definition, so these are indicative values converted from public reporting and provincial AI Plus targets (about 32 EFLOPS and 22,000 firms nationwide). Read the structure between provinces, not absolute levels. The map is a simplified, thinned outline.' },
    source: { zh: '工信部与各省「人工智能 +」行动方案公开数据整理；底图几何：阿里云 DataV.GeoAtlas 省级边界（抽稀后使用）', en: 'MIIT and provincial AI action plans; boundaries: DataV.GeoAtlas province outlines, simplified' },
    metrics: [
      {
        id: 'compute',
        label: { zh: '智能算力规模', en: 'Intelligent compute' },
        unit: { zh: ' EFLOPS', en: ' EFLOPS' },
        decimals: 1
      },
      {
        id: 'firms',
        label: { zh: '人工智能企业数量', en: 'AI firms' },
        unit: { zh: ' 家', en: ' firms' },
        decimals: 0
      }
    ],
    rows: [
      { id: '110000', name: { zh: '北京', en: 'Beijing' }, compute: 4.8, firms: 3900 },
      { id: '310000', name: { zh: '上海', en: 'Shanghai' }, compute: 3.6, firms: 2500 },
      { id: '440000', name: { zh: '广东', en: 'Guangdong' }, compute: 4.2, firms: 3600 },
      { id: '330000', name: { zh: '浙江', en: 'Zhejiang' }, compute: 2.8, firms: 1700 },
      { id: '320000', name: { zh: '江苏', en: 'Jiangsu' }, compute: 2.6, firms: 1500 },
      { id: '370000', name: { zh: '山东', en: 'Shandong' }, compute: 1.8, firms: 800 },
      { id: '510000', name: { zh: '四川', en: 'Sichuan' }, compute: 1.6, firms: 900 },
      { id: '420000', name: { zh: '湖北', en: 'Hubei' }, compute: 1.4, firms: 600 },
      { id: '340000', name: { zh: '安徽', en: 'Anhui' }, compute: 1.2, firms: 500 },
      { id: '350000', name: { zh: '福建', en: 'Fujian' }, compute: 1, firms: 600 },
      { id: '120000', name: { zh: '天津', en: 'Tianjin' }, compute: 0.9, firms: 380 },
      { id: '610000', name: { zh: '陕西', en: 'Shaanxi' }, compute: 0.8, firms: 400 },
      { id: '430000', name: { zh: '湖南', en: 'Hunan' }, compute: 0.8, firms: 400 },
      { id: '410000', name: { zh: '河南', en: 'Henan' }, compute: 0.8, firms: 300 },
      { id: '500000', name: { zh: '重庆', en: 'Chongqing' }, compute: 0.7, firms: 350 },
      { id: '130000', name: { zh: '河北', en: 'Hebei' }, compute: 0.6, firms: 240 },
      { id: '210000', name: { zh: '辽宁', en: 'Liaoning' }, compute: 0.6, firms: 300 },
      { id: '710000', name: { zh: '台湾', en: 'Taiwan' }, compute: 0.6, firms: 300 },
      { id: '360000', name: { zh: '江西', en: 'Jiangxi' }, compute: 0.5, firms: 250 },
      { id: '520000', name: { zh: '贵州', en: 'Guizhou' }, compute: 0.5, firms: 150 },
      { id: '140000', name: { zh: '山西', en: 'Shanxi' }, compute: 0.4, firms: 100 },
      { id: '450000', name: { zh: '广西', en: 'Guangxi' }, compute: 0.4, firms: 140 },
      { id: '530000', name: { zh: '云南', en: 'Yunnan' }, compute: 0.4, firms: 130 },
      { id: '810000', name: { zh: '香港', en: 'Hong Kong' }, compute: 0.4, firms: 260 },
      { id: '220000', name: { zh: '吉林', en: 'Jilin' }, compute: 0.3, firms: 120 },
      { id: '230000', name: { zh: '黑龙江', en: 'Heilongjiang' }, compute: 0.3, firms: 110 },
      { id: '150000', name: { zh: '内蒙古', en: 'Inner Mongolia' }, compute: 0.3, firms: 80 },
      { id: '620000', name: { zh: '甘肃', en: 'Gansu' }, compute: 0.2, firms: 70 },
      { id: '650000', name: { zh: '新疆', en: 'Xinjiang' }, compute: 0.2, firms: 60 },
      { id: '460000', name: { zh: '海南', en: 'Hainan' }, compute: 0.15, firms: 90 },
      { id: '640000', name: { zh: '宁夏', en: 'Ningxia' }, compute: 0.1, firms: 40 },
      { id: '630000', name: { zh: '青海', en: 'Qinghai' }, compute: 0.08, firms: 25 },
      { id: '540000', name: { zh: '西藏', en: 'Tibet' }, compute: 0.05, firms: 15 },
      { id: '820000', name: { zh: '澳门', en: 'Macao' }, compute: 0.06, firms: 40 }
    ]
  },
  flow: {
    caption: { zh: 'AI 投入要素 → 三要素升级 → 生产力产出', en: 'AI inputs → upgraded factors → productivity output' },
    note: { zh: '带宽代表相对贡献权重（示意）；把鼠标放到任一节点上可高亮它的流向', en: 'Band width represents relative weight; hover any node to highlight its flows' },
    source: { zh: '依据「数据要素 ×」行动方案与国家统计局投入产出结构整理测算', en: 'Based on the Data Elements × plan and NBS input-output structure' },
    columns: [
      { zh: 'AI 新型投入', en: 'AI inputs' },
      { zh: '生产力要素升级', en: 'Factor upgrade' },
      { zh: '产出与意义', en: 'Outcomes' }
    ],
    nodes: [
      {
        id: 'compute',
        col: 0,
        label: { zh: '算力基础设施', en: 'Compute infrastructure' },
        weight: 30,
        icon: '🖥️'
      },
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
      { from: 'object', to: 'tfp', value: 8 }
    ]
  },
  graph: {
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
      {
        id: 'ai',
        g: 'core',
        size: 26,
        label: { zh: '人工智能', en: 'Artificial Intelligence' },
        desc: { zh: '靠数据、算力、算法跑起来的新一代通用技术', en: 'A general-purpose technology built on data, compute and algorithms' }
      },
      {
        id: 'nqpf',
        g: 'core',
        size: 26,
        label: { zh: '新质生产力', en: 'New Quality Productive Forces' },
        desc: { zh: '技术有大突破、要素配得更合理，才会长出来的新生产力形态', en: 'A new form of productivity that appears only when technology breaks through and factors are allocated better' }
      },
      {
        id: 'dataf',
        g: 'core',
        size: 20,
        label: { zh: '数据要素', en: 'Data as a factor' },
        desc: { zh: '可复制、可复用、越用越增值的第五大生产要素', en: 'The fifth production factor: copyable, reusable and value-adding' }
      },
      {
        id: 'compute',
        g: 'tech',
        size: 17,
        label: { zh: '算力基础设施', en: 'Computing infrastructure' },
        desc: { zh: '智能算力规模快速扩张，成为新质生产力的「基础能源」', en: 'Rapidly expanding smart compute acts as the energy of NQPF' }
      },
      {
        id: 'algo',
        g: 'tech',
        size: 17,
        label: { zh: '算法与大模型', en: 'Algorithms & LLMs' },
        desc: { zh: '大模型把知识封装成可以调用的通用能力', en: 'Large models package knowledge into callable general capability' }
      },
      {
        id: 'data',
        g: 'tech',
        size: 17,
        label: { zh: '数据资源', en: 'Data resources' },
        desc: { zh: '训练与推理的燃料，也是产业知识的载体', en: 'Fuel for training and inference, and a carrier of industrial know-how' }
      },
      {
        id: 'labor',
        g: 'factor',
        size: 19,
        label: { zh: '劳动者升级', en: 'Labour upgrade' },
        desc: { zh: '从单一技能走向人机协同的高技能劳动者', en: 'From single-skilled workers to human-AI collaboration' }
      },
      {
        id: 'tool',
        g: 'factor',
        size: 19,
        label: { zh: '劳动资料升级', en: 'Tool upgrade' },
        desc: { zh: '生产工具从机械装备升级为「算法 + 算力」', en: 'Tools evolve from machinery to algorithms plus compute' }
      },
      {
        id: 'object',
        g: 'factor',
        size: 19,
        label: { zh: '劳动对象升级', en: 'Object upgrade' },
        desc: { zh: '数据、知识与场景成为新的加工对象', en: 'Data, knowledge and scenarios become new objects of labour' }
      },
      {
        id: 'tfp',
        g: 'effect',
        size: 22,
        label: { zh: '全要素生产率提升', en: 'Higher TFP' },
        desc: { zh: '同样的投入能产出更多——看新质生产力主要就看它', en: 'More output from the same input: the main measure of NQPF' }
      },
      {
        id: 'newbiz',
        g: 'effect',
        size: 20,
        label: { zh: '新产业新业态', en: 'New industries' },
        desc: { zh: '智能驾驶、具身智能、生成式内容等全新赛道', en: 'New tracks such as autonomous driving, embodied AI and generative content' }
      },
      {
        id: 'green',
        g: 'effect',
        size: 20,
        label: { zh: '绿色低碳转型', en: 'Green transition' },
        desc: { zh: '用算法把能耗和排放压下来，同样的产出少花代价', en: 'Algorithms push energy use and emissions down, so each unit of output costs less' }
      },
      {
        id: 'jobs',
        g: 'effect',
        size: 18,
        label: { zh: '就业结构重塑', en: 'Job restructuring' },
        desc: { zh: '重复岗位被替代，同时催生大量新职业', en: 'Repetitive roles decline while many new occupations emerge' }
      },
      {
        id: 'policy',
        g: 'policy',
        size: 15,
        label: { zh: '「人工智能+」行动', en: 'AI+ Initiative' },
        desc: { zh: '国家级行动：把 AI 装进各行各业', en: 'A national initiative: put AI into every industry' }
      },
      {
        id: 'datax',
        g: 'policy',
        size: 15,
        label: { zh: '「数据要素×」行动', en: 'Data Elements × Initiative' },
        desc: { zh: '让数据在更多场景里流动、反复用、越用越值钱', en: 'Let data flow, be reused and gain value in more settings' }
      },
      {
        id: 'mfg',
        g: 'app',
        size: 15,
        label: { zh: '智能制造', en: 'Smart manufacturing' },
        desc: { zh: '机器视觉质检、预测性维护、柔性排产', en: 'Vision inspection, predictive maintenance, flexible scheduling' }
      },
      {
        id: 'med',
        g: 'app',
        size: 15,
        label: { zh: '智慧医疗', en: 'Smart healthcare' },
        desc: { zh: '影像辅助诊断、AI 制药、基层远程诊疗', en: 'Imaging diagnosis, AI drug discovery, remote care' }
      },
      {
        id: 'agri',
        g: 'app',
        size: 15,
        label: { zh: '智慧农业', en: 'Smart agriculture' },
        desc: { zh: '遥感巡田、无人机植保、智能育种', en: 'Remote sensing, drone spraying, smart breeding' }
      },
      {
        id: 'edu',
        g: 'app',
        size: 15,
        label: { zh: '智慧教育', en: 'Smart education' },
        desc: { zh: '个性化学习路径与普惠优质资源', en: 'Personalized learning paths and inclusive resources' }
      },
      {
        id: 'energy',
        g: 'app',
        size: 15,
        label: { zh: '智慧能源', en: 'Smart energy' },
        desc: { zh: '电网调度、风光功率预测、能耗优化', en: 'Grid dispatch, renewable forecasting, energy optimization' }
      },
      {
        id: 'city',
        g: 'app',
        size: 15,
        label: { zh: '智慧城市', en: 'Smart city' },
        desc: { zh: '交通治理、公共安全与政务服务的智能升级', en: 'Traffic, public safety and government services' }
      }
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
  },
  sim: {
    caption: { zh: '生产力模拟器：调节四个旋钮，看看 AI 能把生产力推到多高', en: 'Productivity simulator: tune four dials and see how far AI can push productivity' },
    index: { zh: '综合新质生产力指数', en: 'Composite NQPF index' },
    baseline: { zh: '当前基线', en: 'Baseline' },
    formulaNote: { zh: '模型就是一个公开的线性加权公式，谁都能重算一遍；它只说明各要素的相对轻重，不是真实经济预测。', en: 'The model is an open, reproducible weighted-sum formula anyone can recompute. It shows which factors matter more, and is not a real economic forecast.' },
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
},
    sliders: [
      {
        id: 'penetration',
        value: 35,
        unit: '%',
        label: { zh: 'AI 渗透率', en: 'AI penetration' },
        hint: { zh: '有多少企业把 AI 真正用进生产流程', en: 'How many firms actually embed AI in operations' }
      },
      {
        id: 'dataFactor',
        value: 45,
        unit: '%',
        label: { zh: '数据要素投入强度', en: 'Data factor intensity' },
        hint: { zh: '数据能否被采集、流通、复用', en: 'Whether data can be collected, shared and reused' }
      },
      {
        id: 'talent',
        value: 40,
        unit: '%',
        label: { zh: '数字人才密度', en: 'Digital talent density' },
        hint: { zh: '劳动者中具备人机协同能力的比例', en: 'Share of workers able to collaborate with AI' }
      },
      {
        id: 'rd',
        value: 30,
        unit: '%',
        label: { zh: '研发投入强度', en: 'R&D intensity' },
        hint: { zh: '持续迭代算法与模型的投入水平', en: 'Investment in continuously iterating models' }
      }
    ],
    presets: [
      {
        id: 'base',
        name: { zh: '当前基线', en: 'Current baseline' },
        values: { penetration: 18, dataFactor: 25, talent: 22, rd: 20 }
      },
      {
        id: 'mfg',
        name: { zh: '制造强国', en: 'Manufacturing leader' },
        values: { penetration: 45, dataFactor: 55, talent: 50, rd: 45 }
      },
      {
        id: 'full',
        name: { zh: '全面智能化', en: 'Full intelligence' },
        values: { penetration: 80, dataFactor: 85, talent: 80, rd: 70 }
      }
    ],
    outputs: [
      {
        id: 'tfp',
        max: 1.8,
        decimals: 2,
        unit: { zh: '个百分点 / 年', en: 'pp / year' },
        colorKey: '--c-primary',
        label: { zh: '全要素生产率年均提升', en: 'Annual TFP growth uplift' },
        why: { zh: '看新质生产力，主要就看这一项', en: 'The headline measure of NQPF' }
      },
      {
        id: 'gdp',
        max: 3,
        decimals: 2,
        unit: { zh: '% / 年', en: '% / year' },
        colorKey: '--c-accent',
        label: { zh: '对 GDP 增速的年均拉动', en: 'Annual GDP growth boost' },
        why: { zh: '从产出端看 AI 给经济添了多少', en: 'What AI adds to the economy, seen from the output side' }
      },
      {
        id: 'cost',
        max: 25,
        decimals: 1,
        unit: { zh: '%', en: '%' },
        colorKey: '--c-info',
        label: { zh: '综合运营成本下降', en: 'Operating cost reduction' },
        why: { zh: '自动化加上预测更准，省下来的成本', en: 'Costs saved by automation and better forecasting' }
      },
      {
        id: 'green',
        max: 20,
        decimals: 1,
        unit: { zh: '%', en: '%' },
        colorKey: '--c-success',
        label: { zh: '单位产出能耗下降', en: 'Energy per unit output down' },
        why: { zh: '绿色低碳转型最直接的一个读数', en: 'The most direct reading of the green transition' }
      },
      {
        id: 'jobs',
        max: 200,
        decimals: 0,
        unit: { zh: '万个 / 年', en: '10k jobs / year' },
        colorKey: '--d5',
        label: { zh: '新增智能相关岗位', en: 'New AI-related jobs' },
        why: { zh: '有人被替代，也有新岗位冒出来', en: 'Jobs are replaced, and new ones appear too' }
      }
    ],
    sensitivity: {
      caption: { zh: '敏感性分析：哪个旋钮最关键', en: 'Sensitivity: which dial matters most' },
      target: { zh: '综合新质生产力指数', en: 'Composite NQPF index' },
      tornadoTitle: { zh: '① 单因素敏感性（龙卷风图）', en: '① One-factor sensitivity (tornado)' },
      tornadoHint: { zh: '固定其他三项、只让这一项从 0 走到 100，看指数能被拉开多大差距——条形越长，这个因素越关键。', en: 'Hold the other three fixed and sweep this one from 0 to 100; the longer the bar, the more decisive the factor.' },
      mcTitle: { zh: '② 蒙特卡洛分布（500 次抽样）', en: '② Monte Carlo spread (500 draws)' },
      mcHint: { zh: '四项投入各自在 ±15% 内随机扰动、抽 500 次，看指数落在哪里；虚线依次是 P5 / 中位数 / P95。', en: 'Jitter all four inputs by ±15% and draw 500 times to see where the index lands; dashed lines mark P5 / median / P95.' },
      sweepLabel: { zh: '指数区间', en: 'Index range' },
      lowLabel: { zh: '取最小时', en: 'at minimum' },
      highLabel: { zh: '取最大时', en: 'at maximum' },
      swingLabel: { zh: '区间宽度', en: 'Swing' },
      p5Label: { zh: 'P5', en: 'P5' },
      p50Label: { zh: '中位数', en: 'median' },
      p95Label: { zh: 'P95', en: 'P95' },
      currentLabel: { zh: '当前设定', en: 'Current setting' },
      countLabel: { zh: '抽样频次', en: 'draws' },
      lowWord: { zh: '低', en: 'low' },
      highWord: { zh: '高', en: 'high' },
      perturb: 0.15,
      draws: 500,
      seed: 20261002,
      note: { zh: '两幅图都由同一个公开模型算出：龙卷风图一次只动一个因素，回答「先调哪个」；蒙特卡洛四个一起小幅扰动，回答「结果有多不确定」。', en: 'Both panels come from the same open model: the tornado moves one factor at a time to answer “what to tune first”, while the Monte Carlo jitters all four to show how uncertain the outcome is.' }
    }
  },
  sources: [
    {
      name: { zh: '中国信息通信研究院《人工智能发展报告》', en: 'CAICT — AI Development Report' },
      note: { zh: '产业规模、算力规模', en: 'Industry and compute scale' }
    },
    {
      name: { zh: '工业和信息化部公开统计数据', en: 'Ministry of Industry and Information Technology' },
      note: { zh: '算力与产业运行', en: 'Compute and industry operations' }
    },
    {
      name: { zh: '国家统计局年度统计公报', en: 'National Bureau of Statistics of China' },
      note: { zh: '三次产业结构', en: 'Sector structure' }
    },
    {
      name: { zh: '普华永道《AI 对全球经济的影响》', en: 'PwC — Sizing the Prize' },
      note: { zh: '2030 年 GDP 增量预测', en: '2030 GDP uplift projection' }
    },
    {
      name: { zh: '麦肯锡《生成式人工智能的经济潜力》', en: 'McKinsey — The Economic Potential of Generative AI' },
      note: { zh: '生产率与市场价值', en: 'Productivity and market value' }
    },
    {
      name: { zh: 'IDC《全球人工智能支出指南》', en: 'IDC Worldwide AI Spending Guide' },
      note: { zh: '市场规模与行业渗透', en: 'Market size and penetration' }
    },
    {
      name: { zh: '斯坦福 HAI《人工智能指数报告》', en: 'Stanford HAI — AI Index Report' },
      note: { zh: '技术与国家比较', en: 'Technology and country comparison' }
    },
    {
      name: { zh: '世界经济论坛《未来就业报告》', en: 'World Economic Forum — Future of Jobs' },
      note: { zh: '就业与技能结构', en: 'Jobs and skills' }
    },
    {
      name: { zh: '工业和信息化部与各省「人工智能 +」行动方案', en: 'MIIT and provincial AI+ action plans' },
      note: { zh: '省级算力规模与企业数量（示意）', en: 'Provincial compute and AI firms (indicative)' }
    },
    {
      name: { zh: '阿里云 DataV.GeoAtlas 行政区边界', en: 'Aliyun DataV.GeoAtlas administrative boundaries' },
      note: { zh: '省级地图底图（抽稀后的示意轮廓，非审图号地图）', en: 'Province outlines, simplified for illustration' }
    },
    {
      name: { zh: '行业招聘平台与年报数据（人才密度 / 市场增速）', en: 'Hiring platforms and annual reports (talent, CAGR)' },
      note: { zh: '热力矩阵后两列指标口径', en: 'Definitions for the last two heat-map columns' }
    },
    {
      name: { zh: '本页模拟器的公开线性模型', en: 'The open linear model behind this page’s simulator' },
      note: { zh: '敏感性分析与蒙特卡洛抽样的计算依据', en: 'Basis for the sensitivity and Monte Carlo panels' }
    }
  ],
  overview: [
    {
      icon: '🧩',
      name: { zh: '内涵：三要素升级', en: 'Concept: three factors' },
      desc: { zh: '劳动者、劳动资料、劳动对象如何被 AI 各改一遍', en: 'How AI rewrites labour, tools and objects of labour' },
      href: '#what'
    },
    {
      icon: '💪',
      name: { zh: '作用力：六维雷达', en: 'Forces: six-dimension radar' },
      desc: { zh: '配合五股看得见的作用力', en: 'Plus five tangible forces of change' },
      href: '#power'
    },
    {
      icon: '📈',
      name: { zh: '产业规模：增长曲线', en: 'Scale: growth curve' },
      desc: { zh: '核心产业与带动产业的双曲线', en: 'Core and enabled industry curves' },
      href: '#scale'
    },
    {
      icon: '🎯',
      name: { zh: '行业赋能：气泡矩阵', en: 'Industries: bubble matrix' },
      desc: { zh: '15 个行业的渗透率 × 增益 × 规模', en: '15 industries in one matrix' },
      href: '#industry'
    },
    {
      icon: '🗺️',
      name: { zh: '区域格局：算力地图', en: 'Regions: compute map' },
      desc: { zh: '34 个省级单元的算力与企业分布', en: 'Compute and firms across 34 provinces' },
      href: '#region'
    },
    {
      icon: '🌍',
      name: { zh: '全球格局：实力排名', en: 'Global: ranking' },
      desc: { zh: '12 个经济体的 AI 发展指数', en: 'AI index of 12 economies' },
      href: '#global'
    },
    {
      icon: '🔀',
      name: { zh: '要素重构：流向图', en: 'Factors: flow diagram' },
      desc: { zh: '从 AI 投入到产出，资源怎么走', en: 'How inputs turn into outcomes' },
      href: '#flow'
    },
    {
      icon: '🕸️',
      name: { zh: '关系图谱：可拖动', en: 'Graph: draggable' },
      desc: { zh: '21 个节点、36 条关系的全景图', en: '21 nodes and 36 relations' },
      href: '#graph'
    },
    {
      icon: '🎛️',
      name: { zh: '模拟器：你来调参数', en: 'Simulator: your turn' },
      desc: { zh: '四个旋钮，实时算出生产力提升', en: 'Four dials, live productivity readout' },
      href: '#sim'
    },
    {
      icon: '🕰️',
      name: { zh: '时间线：七十年', en: 'Timeline: 70 years' },
      desc: { zh: '从达特茅斯会议到新质生产力', en: 'From Dartmouth to NQPF' },
      href: '#timeline'
    },
    {
      icon: '🚀',
      name: { zh: '落地场景：八个现场', en: 'Use cases: eight sites' },
      desc: { zh: 'AI 真正进入生产现场的样子', en: 'What AI looks like on the ground' },
      href: '#scene'
    },
    {
      icon: '🏁',
      name: { zh: '结论：为什么是引擎', en: 'Conclusion: why an engine' },
      desc: { zh: '增速对比 + 驱动力排名，用两条硬数据收口', en: 'Growth comparison and a driver ranking to close' },
      href: '#conclusion'
    }
  ],
  provenance: {
    bubble: 'modeled',
    define: 'modeled',
    drivers: 'modeled',
    flow: 'modeled',
    forces: 'modeled',
    globalRank: 'sourced',
    graph: 'modeled',
    growth: 'modeled',
    heatmap: 'modeled',
    industry: 'modeled',
    kpis: 'projected',
    multiples: 'projected',
    overview: 'modeled',
    paletteAccent: 'modeled',
    paletteBase: 'modeled',
    paletteKeys: 'modeled',
    province: 'modeled',
    radar: 'modeled',
    scale: 'projected',
    scenes: 'modeled',
    sim: 'modeled',
    sources: 'sourced',
    timeline: 'sourced'
  }
};
