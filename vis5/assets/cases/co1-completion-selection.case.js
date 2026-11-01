/* =========================================================
   案例插件（静态注册版）：完井方式智能优选（知识图谱 + 规则优化）
   ---------------------------------------------------------
   由 cases/co1-completion-selection/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "co1-completion-selection",
    "sceneId": "co1",
    "methods": [
      "kg",
      "opt"
    ],
    "title": "完井方式智能优选（知识图谱 + 规则优化）",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "完井方式决定井筒与储层如何连通，也决定后续防砂、控水和增产有没有施展空间。一次选择错了，往往要用修井或二次完井来纠正。",
        "judge": [
          {
            "label": "任务类型",
            "value": "知识推理 + 方案排序",
            "desc": "图谱约束规则，排序给出候选"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "需要历史井例与专家规则，不必逐条标注"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "一次误选影响全井寿命与修井成本"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "规则可解释，但条件冲突多、长尾井例少"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>常见完井方式有四类，各有明确适用边界：<b>裸眼完井</b>要求井壁稳定、成本低；<b>射孔完井</b>便于分段改造与控水；<b>筛管完井</b>靠挡砂精度防砂；<b>砾石充填完井</b>适用于高含砂、疏松砂岩和出砂严重的水平井。</p><p>现场选择通常由工程师对照邻井、钻井报告、测井解释和试油资料完成。真正的困难不是记住四种方式，而是条件组合：储层类型、岩性、出砂倾向、出水风险、井深、套管尺寸六类条件交叉后可达数百种组合，而可参考的井例往往只有几十口。</p><p>由此产生三个问题：<b>经验不一致</b>——不同工程师对同一组条件可能给出不同方案；<b>标准与经验分散</b>——条款、井史、专家判断散落在报告和人的脑子里，难以复用；<b>目标冲突</b>——出砂要求防砂，出水要求控水，分段压裂又要求井筒畅通，单条经验很难同时满足。</p><div class=\"figure\"><svg viewBox=\"0 0 640 240\" width=\"100%\" role=\"img\" aria-label=\"储层条件到完井方式的决策图谱示意\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"240\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<text x=\"10\" y=\"18\" font-size=\"10\" fill=\"var(--ink-4)\" font-family=\"ui-monospace,monospace\">RESERVOIR &amp; WELL</text>\n<text x=\"272\" y=\"18\" font-size=\"10\" fill=\"var(--c-kg)\" font-family=\"ui-monospace,monospace\">RULES</text>\n<text x=\"450\" y=\"18\" font-size=\"10\" fill=\"var(--c-opt)\" font-family=\"ui-monospace,monospace\">COMPLETION</text>\n<defs><marker id=\"co1-a1\" markerWidth=\"7\" markerHeight=\"7\" refX=\"6\" refY=\"3\" orient=\"auto\"><path d=\"M0 0L6 3L0 6Z\" fill=\"var(--ink-4)\"/></marker></defs>\n<rect x=\"10\" y=\"28\" width=\"96\" height=\"28\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"58\" y=\"46\" text-anchor=\"middle\" font-size=\"10\" fill=\"var(--ink-2)\">储层类型</text>\n<rect x=\"116\" y=\"28\" width=\"96\" height=\"28\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"164\" y=\"46\" text-anchor=\"middle\" font-size=\"10\" fill=\"var(--ink-2)\">岩性</text>\n<rect x=\"10\" y=\"64\" width=\"96\" height=\"28\" rx=\"5\" fill=\"var(--bg-ts)\" stroke=\"var(--c-ts)\"/><text x=\"58\" y=\"82\" text-anchor=\"middle\" font-size=\"10\" fill=\"var(--ink-2)\">出砂倾向</text>\n<rect x=\"116\" y=\"64\" width=\"96\" height=\"28\" rx=\"5\" fill=\"var(--bg-opt)\" stroke=\"var(--c-opt)\"/><text x=\"164\" y=\"82\" text-anchor=\"middle\" font-size=\"10\" fill=\"var(--ink-2)\">出水风险</text>\n<rect x=\"10\" y=\"100\" width=\"96\" height=\"28\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"58\" y=\"118\" text-anchor=\"middle\" font-size=\"10\" fill=\"var(--ink-2)\">井深</text>\n<rect x=\"116\" y=\"100\" width=\"96\" height=\"28\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"164\" y=\"118\" text-anchor=\"middle\" font-size=\"10\" fill=\"var(--ink-2)\">套管尺寸</text>\n<line x1=\"216\" y1=\"78\" x2=\"248\" y2=\"78\" stroke=\"var(--ink-4)\" stroke-width=\"1.2\" marker-end=\"url(#co1-a1)\"/>\n<rect x=\"252\" y=\"34\" width=\"148\" height=\"150\" rx=\"8\" fill=\"var(--card)\" stroke=\"var(--c-kg)\" stroke-width=\"1.2\"/>\n<text x=\"264\" y=\"54\" font-size=\"11\" font-weight=\"600\" fill=\"var(--c-kg)\">决策规则库</text>\n<text x=\"264\" y=\"75\" font-size=\"9\" fill=\"var(--ink-2)\">防砂：出砂 → 筛管/砾石</text>\n<text x=\"264\" y=\"93\" font-size=\"9\" fill=\"var(--ink-2)\">控水：出水 → 射孔/分段</text>\n<text x=\"264\" y=\"111\" font-size=\"9\" fill=\"var(--ink-2)\">井壁：岩性 → 裸眼约束</text>\n<text x=\"264\" y=\"129\" font-size=\"9\" fill=\"var(--ink-2)\">成本：井深/套管 → 可行性</text>\n<text x=\"264\" y=\"147\" font-size=\"9\" fill=\"var(--ink-2)\">标准：SY/T 5724 条款</text>\n<text x=\"264\" y=\"165\" font-size=\"9\" fill=\"var(--ink-4)\">边权 = 标准 0.4 + 井例 0.4</text>\n<text x=\"264\" y=\"178\" font-size=\"9\" fill=\"var(--ink-4)\">+ 专家 0.2</text>\n<line x1=\"400\" y1=\"92\" x2=\"432\" y2=\"92\" stroke=\"var(--ink-4)\" stroke-width=\"1.2\" marker-end=\"url(#co1-a1)\"/>\n<rect x=\"436\" y=\"24\" width=\"190\" height=\"32\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"450\" y=\"45\" font-size=\"10.5\" fill=\"var(--ink-2)\">裸眼完井</text>\n<rect x=\"436\" y=\"68\" width=\"190\" height=\"32\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"450\" y=\"89\" font-size=\"10.5\" fill=\"var(--ink-2)\">射孔完井</text>\n<rect x=\"436\" y=\"112\" width=\"190\" height=\"32\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"450\" y=\"133\" font-size=\"10.5\" fill=\"var(--ink-2)\">筛管完井</text>\n<rect x=\"436\" y=\"156\" width=\"190\" height=\"32\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"450\" y=\"177\" font-size=\"10.5\" fill=\"var(--ink-2)\">砾石充填完井</text>\n<text x=\"436\" y=\"208\" font-size=\"9\" fill=\"var(--ink-4)\">同一组条件可对应 2—3 种候选</text>\n<text x=\"10\" y=\"212\" font-size=\"9.5\" fill=\"var(--bad)\">冲突：出砂要求防砂，出水要求控水</text>\n<text x=\"10\" y=\"228\" font-size=\"9\" fill=\"var(--ink-4)\">条件组合可达数百种，经验难以覆盖</text>\n</svg><div class=\"figcap\"><b>图 1</b><span>完井方式选择的本质是「储层与工程条件 → 决策规则 → 完井方式」的映射。六类条件交叉后组合很多，而防砂与控水经常指向相反方案，冲突是常态而不是例外。</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>把完井选择建模成<b>知识图谱上的约束推理</b>，而不是端到端黑箱预测。图谱定义三类节点：条件节点（储层类型、岩性、出砂倾向、出水风险、井深、套管尺寸）、风险节点（出砂、出水、井壁失稳）和方式节点（裸眼、射孔、筛管、砾石充填）。边表示「条件满足会抬高某风险」或「某风险下该方式适用」，边权来自标准条款、历史井例统计和专家置信度。</p><p>推理分两步：先用硬约束过滤不可施工方案，例如 139.7 mm 套管下砾石充填工具外径不足、井深超过工具耐温耐压极限；再用软规则加权打分，输出四种方式的排序、风险评分和 3—5 条证据路径。优化器只负责校准权重与阈值，让排序与历史井例的吻合率最大化，不需要替代物理判断。</p><div class=\"figure\"><svg viewBox=\"0 0 640 250\" width=\"100%\" role=\"img\" aria-label=\"条件风险方式三层知识图谱与高置信路径\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"250\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<text x=\"22\" y=\"18\" font-size=\"9.5\" fill=\"var(--ink-4)\">条件层</text><text x=\"260\" y=\"18\" font-size=\"9.5\" fill=\"var(--ink-4)\">风险层</text><text x=\"470\" y=\"18\" font-size=\"9.5\" fill=\"var(--ink-4)\">方式层</text>\n<defs><marker id=\"co1-a2\" markerWidth=\"6\" markerHeight=\"6\" refX=\"5\" refY=\"3\" orient=\"auto\"><path d=\"M0 0L5 3L0 6Z\" fill=\"var(--ink-4)\"/></marker></defs>\n<rect x=\"18\" y=\"34\" width=\"92\" height=\"26\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"64\" y=\"51\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">储层类型</text>\n<rect x=\"18\" y=\"72\" width=\"92\" height=\"26\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"64\" y=\"89\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">岩性</text>\n<rect x=\"18\" y=\"110\" width=\"92\" height=\"26\" rx=\"5\" fill=\"var(--bg-ts)\" stroke=\"var(--c-ts)\"/><text x=\"64\" y=\"127\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">出砂倾向</text>\n<rect x=\"18\" y=\"148\" width=\"92\" height=\"26\" rx=\"5\" fill=\"var(--bg-opt)\" stroke=\"var(--c-opt)\"/><text x=\"64\" y=\"165\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">出水风险</text>\n<rect x=\"18\" y=\"186\" width=\"92\" height=\"26\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"64\" y=\"203\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">井深 / 套管</text>\n<rect x=\"250\" y=\"44\" width=\"118\" height=\"34\" rx=\"6\" fill=\"var(--bg-ts)\" stroke=\"var(--c-ts)\"/><text x=\"309\" y=\"65\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">出砂风险</text>\n<rect x=\"250\" y=\"108\" width=\"118\" height=\"34\" rx=\"6\" fill=\"var(--bg-opt)\" stroke=\"var(--c-opt)\"/><text x=\"309\" y=\"129\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">出水风险</text>\n<rect x=\"250\" y=\"172\" width=\"118\" height=\"34\" rx=\"6\" fill=\"var(--bg-cv)\" stroke=\"var(--c-cv)\"/><text x=\"309\" y=\"193\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">井壁稳定</text>\n<rect x=\"468\" y=\"30\" width=\"148\" height=\"30\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"542\" y=\"49\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">裸眼完井</text>\n<rect x=\"468\" y=\"74\" width=\"148\" height=\"30\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"542\" y=\"93\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">射孔完井</text>\n<rect x=\"468\" y=\"118\" width=\"148\" height=\"30\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"542\" y=\"137\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">筛管完井</text>\n<rect x=\"468\" y=\"162\" width=\"148\" height=\"30\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line)\"/><text x=\"542\" y=\"181\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--ink-2)\">砾石充填完井</text>\n<path d=\"M110 123 C160 123 200 60 250 60\" fill=\"none\" stroke=\"var(--c-ts)\" stroke-width=\"1.6\" marker-end=\"url(#co1-a2)\"/>\n<path d=\"M368 60 C420 60 430 130 468 130\" fill=\"none\" stroke=\"var(--c-ts)\" stroke-width=\"2\" marker-end=\"url(#co1-a2)\"/>\n<path d=\"M110 123 C180 123 210 176 250 188\" fill=\"none\" stroke=\"var(--line)\" stroke-width=\"1\"/>\n<path d=\"M368 188 C420 188 430 177 468 177\" fill=\"none\" stroke=\"var(--line)\" stroke-width=\"1\"/>\n<path d=\"M110 196 C170 196 200 188 250 188\" fill=\"none\" stroke=\"var(--line)\" stroke-width=\"1\"/>\n<path d=\"M110 160 C180 160 210 126 250 124\" fill=\"none\" stroke=\"var(--line)\" stroke-width=\"1\"/>\n<path d=\"M110 47 C170 47 210 58 250 60\" fill=\"none\" stroke=\"var(--line)\" stroke-width=\"1\"/>\n<text x=\"382\" y=\"94\" font-size=\"8.5\" fill=\"var(--c-ts)\">边权 0.86</text>\n<text x=\"382\" y=\"106\" font-size=\"8.5\" fill=\"var(--c-ts)\">支持井例 23 口</text>\n<text x=\"22\" y=\"236\" font-size=\"9\" fill=\"var(--ink-4)\">亮色路径：出砂倾向 → 出砂风险 → 筛管/砾石充填，置信度 86%</text>\n<text x=\"410\" y=\"236\" font-size=\"9\" fill=\"var(--ink-4)\">图谱：420 节点 · 1,100 条边</text>\n</svg><div class=\"figcap\"><b>图 2</b><span>三层图谱把「条件—风险—方式」拆成可查询的节点与边。每条推荐都能回溯到 3—5 条路径，边权由标准条款、历史井例和专家置信度合成，而不是黑箱打分。</span></div></div><p>这样输出的不只是一个方案名，而是「为什么选它、哪些条件支持、哪些风险仍需复核」。工程师可以沿着路径逐条质疑，这比一个概率值更适合完井这种低容错决策。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。完井决策的数据门槛不在体量，而在「井例是否覆盖你关心的条件组合」。清单可点击，勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井史与地质静态数据</span><span class=\"cl-s\">储层类型、岩性、孔渗、流体，单井 20 项以上</span></span><span class=\"cl-n\">测井解释 + 试油</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">出砂与出水记录</span><span class=\"cl-s\">出砂浓度、粒径中值、含水率，连续 12 个月</span></span><span class=\"cl-n\">生产动态 + 化验</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">完井与生产历史</span><span class=\"cl-s\">完井方式、产量、修井原因，100 口井以上</span></span><span class=\"cl-n\">作为监督标签</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">标准条款与专家规则</span><span class=\"cl-s\">SY/T 5724 等，80—120 条规则</span></span><span class=\"cl-n\">专家访谈校准</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中</b>。图谱模式和推理流程并不复杂，真正的挑战有三：<b>规则冲突</b>——防砂与控水经常给出相反排序，系统应明确输出「存在冲突」而不是强行二选一；<b>长尾井例稀疏</b>——特殊井型只有几口参考井，相似度容易虚高；<b>图谱质量</b>——边权拍脑袋会让推荐看起来合理但经不起复盘。</p><p>可行的工程做法是：先用 100 口以上历史井做回测校准权重，再把每次修井结果回流成新的井例节点；对相似井少于 5 口的条件组合，强制降低置信度并提示人工复核。可解释性不是附加项，而是这个场景能落地的前提。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/kg\">知识图谱<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/kg\">规则推理<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/kg\">图检索<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/kg\">专家系统<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "某致密砂岩气田 12 口开发井的完井方式优选",
        "lead": [
          "某致密砂岩气田计划投产 12 口开发井，井深 3,200—3,800 m，主体套管 139.7 mm，储层渗透率 0.05—0.3 mD，部分井段出砂倾向中等、局部含水上升。可选方案为裸眼、射孔、筛管、砾石充填四类。",
          "此前的 3 口井沿用邻井经验直接选筛管，其中 1 口因套管尺寸与工具外径不匹配被迫简化施工，另 2 口在高含水段无法有效控水。项目目标是把「凭经验选」变成「图谱推理 + 井例校准」，并把单井决策时间从 3 小时压到 15 分钟。"
        ],
        "stats": [
          [
            "开发井数",
            "12 口"
          ],
          [
            "井深范围",
            "3,200—3,800 m"
          ],
          [
            "历史井例",
            "126 口"
          ],
          [
            "规则条数",
            "86 条"
          ],
          [
            "单井决策耗时",
            "3 h → 15 min"
          ],
          [
            "首选方案吻合率",
            "68% → 82%"
          ]
        ],
        "steps": [
          {
            "name": "条件标准化与井例对齐",
            "role": "数据",
            "do": "从钻井日报、测井解释、试油报告和生产动态中抽取储层类型、岩性、出砂、出水、井深、套管尺寸六类条件，统一单位并补齐缺失值，形成 126 口井 × 42 字段的结构化表。",
            "effect": "得到可直接进入图谱查询的条件表，字段缺失率从 18% 降到 3%",
            "trap": "出砂记录常只有「轻微」「较严重」的定性描述，必须转成粒径中值与浓度分级"
          },
          {
            "name": "知识图谱构建",
            "role": "知识工程",
            "do": "建立条件、风险、方式三类节点共约 420 个，规则边约 1,100 条。每条边记录来源（标准条款、井例统计、专家判断）与置信度，避免把互斥规则建成同一条路径。",
            "effect": "任意一组井况都能查询「条件—风险—方式」路径及支持井例数",
            "trap": "把防砂与控水规则混在一条边里，会让冲突被平均掉，输出看似合理但无法解释"
          },
          {
            "name": "硬约束过滤与软规则打分",
            "role": "算法核心",
            "do": "先剔除不可施工方案：139.7 mm 套管对应的砾石充填工具外径、井深对应的耐温耐压、水平段长度对应的筛管下入能力。再按出砂、出水、井壁、成本四组软规则加权打分。",
            "effect": "12 口井中 4 口被硬约束排除砾石充填，候选从 4 个降到 2—3 个",
            "trap": "只做软打分不做硬过滤，会推荐现场根本下不进去的工具组合"
          },
          {
            "name": "排序、置信度与冲突检测",
            "role": "算法",
            "do": "用 126 口历史井回测校准规则权重，置信度取「支持边权 × 相似井例数」；当前两方案得分差小于 5 分时标记为冲突，输出两条相反的证据链。",
            "effect": "回测首选吻合率 82%，次选覆盖 94%，12 口新井中 3 口被标记为冲突",
            "trap": "相似井例不足 5 口时置信度会虚高，必须设置样本数惩罚项"
          },
          {
            "name": "工程复核与结果回流",
            "role": "质控",
            "do": "工程师核对井壁稳定、套管强度、完井成本与工期，确认或修改方案；投产后把产量、出砂、含水与修井结果写回图谱，每月更新一次边权。",
            "effect": "形成「推荐—复核—投产—回流」闭环，规则库每月迭代",
            "trap": "没有回流机制，图谱会停留在立项时的经验，半年后就与现场脱节"
          }
        ],
        "metrics": {
          "title": "怎么算「选得对」",
          "html": "<p>完井选择不是单点分类，核心指标是<b>首选方案与工程师最终决策的吻合率</b>，以及更重要的<b>严重误选率</b>——把高出砂井选成裸眼或射孔，导致投产即出砂、被迫修井的比例。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>传统经验</th><th>本方法</th><th>说明</th></tr></thead><tbody><tr><td>首选吻合率</td><td>68%</td><td>82%</td><td>与专家复核后的最终方案一致</td></tr><tr><td>次选覆盖率</td><td>—</td><td>94%</td><td>最终方案落在前两名的比例</td></tr><tr><td>严重误选率</td><td>21%</td><td>6%</td><td>高出砂井误选裸眼/射孔</td></tr><tr><td>单井决策耗时</td><td>3 h</td><td>15 min</td><td>不含现场复核</td></tr><tr><td>单井完井成本偏差</td><td>±12%</td><td>±5%</td><td>相对批复预算</td></tr></tbody></table><p class=\"small muted\">注：吻合率不是越高越好，系统对冲突井应主动输出「需复核」，而不是追求一个看似确定的答案。</p>"
        },
        "fails": [
          {
            "name": "防砂与控水目标冲突",
            "why": "高含砂井倾向筛管或砾石充填，但含水上升又要求射孔分段控水。单一路径无法同时满足，正确做法是输出冲突证据链并交由工程师权衡，而不是强行排序。"
          },
          {
            "name": "套管尺寸约束被忽略",
            "why": "139.7 mm 套管下砾石充填工具外径余量很小，软规则打分若只看防砂收益，会推荐现场无法下入的方案。硬约束必须在打分之前执行。"
          },
          {
            "name": "相似井例失真",
            "why": "老直井的完井与生产条件与当前水平井差异很大，按区块和井型粗放计算相似度会虚高。需要按井型、完井年代和生产方式分层，并对小样本降权。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "* { box-sizing: border-box; }\nhtml, body { margin: 0; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #ecf0e9;\n  color: #2a2517;\n  font-size: 12px;\n  padding: 10px 12px;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n.panel { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }\nh2 { font-size: 12.5px; font-weight: 600; color: #488778; margin: 0 0 6px; letter-spacing: .03em; }\n.lead { font-size: 11.5px; color: #706b59; margin: 0 0 10px; }\n.hint { font-size: 10.5px; color: #878374; margin: 0 0 6px; }\n.section { background: #e4e9e0; border: 1px solid #d2d9cd; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }\n\n.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }\n.chip {\n  border: 1px solid #c2ccbb; background: #eaefe6; color: #4b4636; border-radius: 14px;\n  padding: 4px 9px; font-size: 11px; cursor: pointer; font-family: inherit; transition: .15s;\n}\n.chip:hover { border-color: #488778; color: #488778; }\n.chip.on { background: #488778; border-color: #488778; color: #ecf0e9; font-weight: 600; }\n\n.controls { display: grid; grid-template-columns: 1fr !important; gap: 6px; }\n.ctl {\n  background: #eaefe6; border: 1px solid #d3dacf; border-radius: 8px; padding: 6px 8px;\n  display: flex; flex-direction: column; gap: 4px; min-width: 0;\n}\n.ctl label { font-size: 11px; color: #4b4636; display: flex; justify-content: space-between; align-items: center; gap: 8px; }\n.ctl output { font-family: ui-monospace, Consolas, monospace; color: #a37b2f; font-weight: 600; font-size: 11px; }\n.ctl input[type=\"range\"] { width: 100%; accent-color: #488778; height: 16px; margin: 0; }\n.ctl .tip { font-size: 10px; color: #8a8f7f; line-height: 1.45; }\n.ctl select {\n  background: #e1e7dd; color: #2a2517; border: 1px solid #c2ccbb; border-radius: 5px;\n  padding: 3px 5px; font-family: inherit; font-size: 11px;\n}\n\n.split { display: grid; grid-template-columns: 1fr; gap: 8px; align-items: start; }\n.chart-wrap { background: #eef2ec; border: 1px solid #d7ded2; border-radius: 8px; padding: 4px; min-width: 0; }\nsvg { display: block; width: 100%; max-width: 100%; height: auto; }\n\n.readouts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }\n.readouts.one { grid-template-columns: repeat(3, 1fr); }\n.ro { background: #eaefe6; border: 1px solid #d3dacf; border-radius: 8px; padding: 6px 8px; min-width: 0; }\n.ro span { display: block; font-size: 10px; color: #878374; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.ro b { font-family: ui-monospace, Consolas, monospace; font-size: 15px; color: #a37b2f; font-weight: 600; line-height: 1.25; }\n.ro b small { font-size: 9.5px; color: #878374; font-weight: 400; }\n\n.rank { margin-top: 2px; }\n.rank-head { font-size: 10px; color: #878374; letter-spacing: .05em; margin-bottom: 4px; }\n.rk { display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px dashed #d3dacf; font-size: 10.5px; }\n.rk:last-child { border-bottom: 0; }\n.rk .no { font-family: ui-monospace, Consolas, monospace; color: #8a8f7f; width: 12px; flex-shrink: 0; }\n.rk .nm { width: 60px; flex-shrink: 0; color: #4b4636; }\n.rk .bar { flex: 1; height: 5px; background: #d3dacf; border-radius: 3px; overflow: hidden; min-width: 20px; }\n.rk .bar i { display: block; height: 100%; background: #70a195; border-radius: 3px; }\n.rk .val { font-family: ui-monospace, Consolas, monospace; color: #878374; width: 38px; text-align: right; flex-shrink: 0; }\n.rk.top .nm { color: #a37b2f; font-weight: 600; }\n.rk.top .bar i { background: #a37b2f; }\n.rk.top .val { color: #a37b2f; }\n\n.status {\n  display: flex; gap: 8px; align-items: flex-start; background: #eaefe6; border: 1px solid #d3dacf;\n  border-left: 3px solid #488778; border-radius: 7px; padding: 8px 10px;\n  font-size: 11px; color: #706b59; line-height: 1.5;\n}\n.status b { color: #488778; flex-shrink: 0; }\n.status.ok { border-left-color: #488778; }\n.status.ok b { color: #488778; }\n.status.warn { border-left-color: #a37b2f; }\n.status.warn b { color: #a37b2f; }\n.status.bad { border-left-color: #a3392b; }\n.status.bad b { color: #a3392b; }\n\n.btnrow { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 8px; }\nbutton {\n  font-family: inherit; font-size: 11px; border-radius: 6px; border: 1px solid #c2ccbb;\n  background: #e1e7dd; color: #4b4636; padding: 5px 10px; cursor: pointer; transition: .15s;\n}\nbutton:hover { border-color: #488778; color: #488778; }\nbutton.primary { background: #488778; border-color: #488778; color: #ecf0e9; font-weight: 600; }\nbutton.primary:hover { background: #377162; color: #ecf0e9; }\n.btn-note { font-size: 10px; color: #8a8f7f; margin-left: auto; }\n\n.legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 10px; color: #878374; margin-top: 4px; }\n.legend i { display: inline-block; width: 12px; height: 2px; vertical-align: middle; margin-right: 4px; }\n.legend i.dot { width: 6px; height: 6px; border-radius: 50%; }\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 完井方式智能优选 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  const $ = function (id) { return document.getElementById(id); };\n  const METHODS = ['裸眼完井', '射孔完井', '筛管完井', '砾石充填'];\n  const SCEN = [\n    {\n      name: '致密砂岩 · 直井', res: '致密砂岩', lith: '细砂岩', sand: '低', water: '低',\n      depth: '3,650 m', casing: '139.7 mm', base: [38, 72, 52, 30],\n      sandCoef: [-18, 4, 24, 30], waterCoef: [-10, 2, 8, 4], riskBase: 28\n    },\n    {\n      name: '疏松砂岩 · 水平井', res: '疏松砂岩', lith: '中砂岩', sand: '高', water: '中',\n      depth: '2,100 m', casing: '177.8 mm', base: [22, 44, 84, 90],\n      sandCoef: [-25, -8, 20, 26], waterCoef: [-8, 2, 6, 5], riskBase: 74\n    },\n    {\n      name: '高含水 · 定向井', res: '中砂岩', lith: '细砂岩', sand: '中', water: '高',\n      depth: '2,800 m', casing: '139.7 mm', base: [30, 80, 58, 50],\n      sandCoef: [-20, 0, 18, 24], waterCoef: [-12, 6, 4, -2], riskBase: 60\n    }\n  ];\n  const COND_EDGES = [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [3, 1], [4, 2], [5, 2]];\n  const RISK_EDGES = [[0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3]];\n  const ACT_COND = [[0, 4], [0, 3, 4], [1, 2, 5], [1, 2, 5]];\n  const ACT_RISK = [[2], [1, 2], [0, 2], [0, 2]];\n  const RISK_POS = [\n    { x: 162, y: 34, w: 82, h: 28 },\n    { x: 162, y: 100, w: 82, h: 28 },\n    { x: 162, y: 166, w: 82, h: 28 }\n  ];\n  const METH_POS = [\n    { x: 302, y: 15, w: 122, h: 26 },\n    { x: 302, y: 69, w: 122, h: 26 },\n    { x: 302, y: 123, w: 122, h: 26 },\n    { x: 302, y: 177, w: 122, h: 26 }\n  ];\n  let si = 0;\n  let weight = 60;\n\n  function condPos(i) { return { x: 6, y: 16 + i * 33, w: 94, h: 24 }; }\n\n  function calcScores() {\n    const s = SCEN[si];\n    const sandF = { '低': 0.25, '中': 0.7, '高': 1 }[s.sand];\n    const waterF = { '低': 0.2, '中': 0.6, '高': 1 }[s.water];\n    const k = weight / 100;\n    return s.base.map(function (b, i) {\n      const v = b + k * sandF * s.sandCoef[i] + waterF * s.waterCoef[i];\n      return Math.round(Math.max(5, Math.min(99, v)));\n    });\n  }\n\n  function calcRisk(topScore) {\n    const s = SCEN[si];\n    const sandF = { '低': 0.25, '中': 0.7, '高': 1 }[s.sand];\n    const raw = s.riskBase + (weight - 50) * 0.15 * sandF - (topScore - 70) * 0.2;\n    return Math.round(Math.max(8, Math.min(96, raw)));\n  }\n\n  function edge(x1, y1, x2, y2, on) {\n    const c1 = x1 + 30, c2 = x2 - 30;\n    const d = 'M' + x1 + ' ' + y1 + ' C' + c1 + ' ' + y1 + ',' + c2 + ' ' + y2 + ',' + x2 + ' ' + y2;\n    return '<path d=\"' + d + '\" fill=\"none\" stroke=\"' + (on ? '#488778' : '#cad3c3') +\n      '\" stroke-width=\"' + (on ? 2.4 : 1) + '\" opacity=\"' + (on ? 0.95 : 0.5) + '\"/>';\n  }\n\n  function node(p, on, fill) {\n    return '<rect x=\"' + p.x + '\" y=\"' + p.y + '\" width=\"' + p.w + '\" height=\"' + p.h +\n      '\" rx=\"7\" fill=\"' + fill + '\" stroke=\"' + (on ? '#488778' : '#cad3c3') + '\" stroke-width=\"' + (on ? 1.4 : 1) + '\"/>';\n  }\n\n  function drawGraph(sc, order, risk) {\n    const s = SCEN[si];\n    const top = order[0];\n    const risks = [\n      s.sand === '高' ? '高 · 需防砂' : s.sand === '中' ? '中 · 需评估' : '低 · 可容忍',\n      s.water === '高' ? '高 · 需控水' : s.water === '中' ? '中 · 需观察' : '低 · 影响小',\n      s.res === '疏松砂岩' ? '差 · 易坍塌' : parseInt(s.depth.replace(/[^0-9]/g, ''), 10) > 3000 ? '中 · 深井' : '良好'\n    ];\n    let g = '<rect x=\"0\" y=\"0\" width=\"430\" height=\"228\" fill=\"#eef2ec\" rx=\"6\"/>';\n    COND_EDGES.forEach(function (e) {\n      const a = condPos(e[0]), b = RISK_POS[e[1]];\n      const on = ACT_COND[top].indexOf(e[0]) >= 0 && ACT_RISK[top].indexOf(e[1]) >= 0;\n      g += edge(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, on);\n    });\n    RISK_EDGES.forEach(function (e) {\n      const a = RISK_POS[e[0]], b = METH_POS[e[1]];\n      const on = ACT_RISK[top].indexOf(e[0]) >= 0 && e[1] === top;\n      g += edge(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, on);\n    });\n\n    const vals = [\n      ['储层类型', s.res], ['岩性', s.lith], ['出砂倾向', s.sand],\n      ['出水风险', s.water], ['井深', s.depth], ['套管尺寸', s.casing]\n    ];\n    vals.forEach(function (c, i) {\n      const p = condPos(i);\n      const on = ACT_COND[top].indexOf(i) >= 0;\n      g += node(p, on, on ? '#d5e1d7' : '#e3e9e0');\n      g += '<text x=\"' + (p.x + 7) + '\" y=\"' + (p.y + 9) + '\" font-size=\"7.5\" fill=\"#878374\">' + c[0] + '</text>';\n      g += '<text x=\"' + (p.x + 7) + '\" y=\"' + (p.y + 19) + '\" font-size=\"8.5\" font-weight=\"600\" fill=\"#2a2517\">' + c[1] + '</text>';\n    });\n    ['出砂风险', '出水风险', '井壁稳定'].forEach(function (nm, i) {\n      const p = RISK_POS[i];\n      const on = ACT_RISK[top].indexOf(i) >= 0;\n      g += node(p, on, on ? '#e8e2d5' : '#e9eae2');\n      g += '<text x=\"' + (p.x + 8) + '\" y=\"' + (p.y + 11) + '\" font-size=\"8\" fill=\"#a37b2f\" font-weight=\"600\">' + nm + '</text>';\n      g += '<text x=\"' + (p.x + 8) + '\" y=\"' + (p.y + 21) + '\" font-size=\"7.5\" fill=\"#5e5847\">' + risks[i] + '</text>';\n    });\n    METHODS.forEach(function (nm, i) {\n      const p = METH_POS[i];\n      const on = i === top;\n      g += node(p, on, on ? '#e8e2d5' : '#e3e9e0');\n      g += '<text x=\"' + (p.x + 8) + '\" y=\"' + (p.y + 11) + '\" font-size=\"8.5\" font-weight=\"600\" fill=\"' + (on ? '#a37b2f' : '#4b4636') + '\">' + (on ? '★ ' : '') + nm + '</text>';\n      g += '<text x=\"' + (p.x + 8) + '\" y=\"' + (p.y + 20) + '\" font-size=\"7.5\" fill=\"#878374\">规则得分 ' + sc[i] + ' / 100</text>';\n      g += '<text x=\"' + (p.x + p.w - 8) + '\" y=\"' + (p.y + 17) + '\" text-anchor=\"end\" font-size=\"10\" font-family=\"ui-monospace,monospace\" fill=\"' + (on ? '#a37b2f' : '#488778') + '\">' + sc[i] + '</text>';\n    });\n    g += '<text x=\"6\" y=\"222\" font-size=\"7.5\" fill=\"#8a8f7f\">亮线：首选方案证据链 · 灰线：其他规则路径 · 图谱规模 420 节点 / 1,100 条边</text>';\n    $('graph').innerHTML = g;\n  }\n\n  function drawRank(sc, order, gap) {\n    const conf = Math.min(96, Math.round(sc[order[0]] + 4 + gap * 0.4));\n    let h = '<div class=\"rank-head\">推荐排序 · 首选置信度 ' + conf + '%</div>';\n    order.forEach(function (idx, k) {\n      h += '<div class=\"rk' + (k === 0 ? ' top' : '') + '\">' +\n        '<span class=\"no\">' + (k + 1) + '</span>' +\n        '<span class=\"nm\">' + METHODS[idx] + '</span>' +\n        '<span class=\"bar\"><i style=\"width:' + sc[idx] + '%\"></i></span>' +\n        '<span class=\"val\">' + sc[idx] + ' 分</span></div>';\n    });\n    $('rank').innerHTML = h;\n  }\n\n  function update() {\n    const sc = calcScores();\n    const order = [0, 1, 2, 3].sort(function (a, b) { return sc[b] - sc[a]; });\n    const top = order[0], second = order[1];\n    const gap = sc[top] - sc[second];\n    const risk = calcRisk(sc[top]);\n    const riskLabel = risk >= 70 ? '高' : risk >= 45 ? '中' : '低';\n\n    drawGraph(sc, order, risk);\n    drawRank(sc, order, gap);\n    $('r-first').innerHTML = METHODS[top] + ' <small>' + sc[top] + ' 分</small>';\n    $('r-second').innerHTML = METHODS[second] + ' <small>' + sc[second] + ' 分</small>';\n    $('r-risk').innerHTML = risk + ' <small>/ 100</small>';\n\n    const st = $('status');\n    if (gap < 5) {\n      st.className = 'status warn';\n      st.innerHTML = '<b>存在冲突</b><span>' + METHODS[top] + ' 与 ' + METHODS[second] +\n        ' 仅差 ' + gap + ' 分，防砂与控水目标可能互相牵制，风险评分 ' + risk + '（' + riskLabel + '）。建议工程师复核井壁稳定性与完井成本。</span>';\n    } else if (sc[top] < 60) {\n      st.className = 'status bad';\n      st.innerHTML = '<b>证据不足</b><span>首选 ' + METHODS[top] + ' 仅 ' + sc[top] +\n        ' 分，图谱中缺少高支持度井例。建议补充邻井生产与出砂记录后再决策。</span>';\n    } else {\n      st.className = 'status ok';\n      st.innerHTML = '<b>推荐明确</b><span>' + METHODS[top] + ' 得分 ' + sc[top] +\n        '，领先次选 ' + gap + ' 分；风险评分 ' + risk + '（' + riskLabel + '）。主要证据链来自' +\n        (top >= 2 ? '出砂倾向、岩性与套管尺寸' : '储层类型、出水风险与井深') + '。</span>';\n    }\n  }\n\n  function buildChips() {\n    SCEN.forEach(function (s, i) {\n      const b = document.createElement('button');\n      b.className = 'chip' + (i === si ? ' on' : '');\n      b.textContent = s.name;\n      b.addEventListener('click', function () {\n        si = i;\n        document.querySelectorAll('#chips .chip').forEach(function (c, k) {\n          c.className = 'chip' + (k === si ? ' on' : '');\n        });\n        update();\n      });\n      $('chips').appendChild(b);\n    });\n  }\n\n  $('s-w').addEventListener('input', function (e) {\n    weight = +e.target.value;\n    $('o-w').textContent = weight;\n    update();\n  });\n\n  buildChips();\n  update();\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：完井方式智能优选</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>完井方式智能优选 · 知识图谱 + 规则优化</h1>\n  <p class=\"lead\">选择一组井况，看知识图谱沿「条件 → 风险 → 方式」路径给出推荐。拖动出砂风险权重，观察筛管与砾石充填的排序变化。</p>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n      <div class=\"section\">\n        <h2>② 知识图谱：条件—风险—方式</h2>\n        <p class=\"hint\">亮色路径为当前首选方案的证据链，灰线为图谱中的其他规则。节点上方是属性，下方是当前井况取值。</p>\n        <div class=\"split\">\n          <div class=\"chart-wrap\"><svg id=\"graph\" viewBox=\"0 0 430 228\" role=\"img\" aria-label=\"完井方式知识图谱\"></svg></div>\n          <div>\n            <div class=\"rank\" id=\"rank\"></div>\n            <div class=\"readouts one\" style=\"margin-top:8px\">\n              <div class=\"ro\"><span>首选方案</span><b id=\"r-first\">—</b></div>\n              <div class=\"ro\"><span>次选方案</span><b id=\"r-second\">—</b></div>\n              <div class=\"ro\"><span>风险评分</span><b id=\"r-risk\">—</b></div>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <div class=\"section\">\n        <h2>③ 决策结论</h2>\n        <div class=\"status\" id=\"status\"></div>\n        <p class=\"hint\" style=\"margin-top:8px\">置信度由「规则边权 × 相似井例支持度」合成；首选与次选得分差小于 5 分时判为存在冲突，交由工程师复核。图中数值为教学用简化模型，现场需按区块标定。</p>\n      </div>\n    </div>\n\n    <div class=\"side\">\n      <div class=\"section\">\n        <h2>① 井况条件</h2>\n        <div class=\"chips\" id=\"chips\"></div>\n        <div class=\"ctl\">\n          <label>出砂风险权重 <output id=\"o-w\">60</output></label>\n          <input type=\"range\" id=\"s-w\" min=\"0\" max=\"100\" step=\"1\" value=\"60\">\n          <span class=\"tip\">权重越高，防砂类完井方式的规则得分与优先级越高；低出砂倾向时权重影响会被削弱。</span>\n        </div>\n      </div>\n    </div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "切换致密砂岩、出砂水平井、高含水定向井三组井况，拖动「出砂风险权重」，观察知识图谱中证据链的高亮变化、四种完井方式的排序与置信度，以及何时出现「存在冲突」。",
    mode: 'page',
    height: 720,
    mount: function (root, ctx) {
      if (!global.CaseDemoHost) return;
      demoHandle = global.CaseDemoHost.create(root, {
        files: FILES,
        demo: { mode: 'page', html: 'demo/index.html', js: 'demo/demo.js', height: 720 },
        meta: { title: DATA.title }
      }, ctx);
    },
    unmount: function () {
      if (demoHandle) { try { demoHandle.destroy(); } catch (e) { } demoHandle = null; }
    }
  };

  global.Cases.register(DATA);
})(window);
