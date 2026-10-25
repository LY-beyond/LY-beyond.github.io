/* =========================================================
   案例插件（静态注册版）：输油管道泄漏智能检测与定位
   ---------------------------------------------------------
   由 cases/t1-pipeline-leak/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "t1-pipeline-leak",
    "sceneId": "t1",
    "methods": [
      "ts"
    ],
    "title": "输油管道泄漏智能检测与定位",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "管道泄漏的最小可检测量取决于压力波衰减与背景噪声，定位精度又随距离和工况扰动迅速恶化。时序智能的价值，是把「报警」变成「报警 + 位置 + 置信度」。",
        "judge": [
          {
            "label": "任务类型",
            "value": "时序异常检测 + 定位回归",
            "desc": "先判断有没有泄漏，再估算位置"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "泄漏样本稀缺，工况扰动样本很多"
          },
          {
            "label": "可见收益",
            "value": "极高",
            "desc": "一次泄漏的环保与经济损失可达百万元"
          },
          {
            "label": "难度",
            "value": "中高",
            "desc": "误报与定位误差都随距离放大"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>长输管道通常每 2—5 s 采集一次上下游压力与流量，传统泄漏检测靠两条规则：压力下降超过阈值就报警；上下游流量差超过平衡阈值也报警。定位则用负压波到达两端的时间差，按 x = (L + v·Δt) / 2 估算。</p><p>问题在三个方面：<b>工况扰动造成误报</b>——启泵、停泵、调阀都会让压力与流量同时跳变，形态与泄漏相似但方向不同，年误报可达 30 次以上；<b>小泄漏检不出</b>——泄漏量小于 1% 时，负压波被噪声淹没，压力下降只有几十 kPa；<b>定位误差随距离增大</b>——波速受介质温度、含气率影响，96 km 管段末端误差可达 ±500 m 以上。</p><p>误报的代价不只是人工排查。调度人员被频繁误报训练到「先等等看」，真实泄漏的响应就会被拖延；这正是时序模型要解决的核心问题。</p><div class=\"figure\"><svg viewBox=\"0 0 640 226\" width=\"100%\" role=\"img\" aria-label=\"负压波传播与管道泄漏定位\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"226\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<defs><marker id=\"t1-a1\" markerWidth=\"6\" markerHeight=\"6\" refX=\"5\" refY=\"3\" orient=\"auto\"><path d=\"M0 0L5 3L0 6Z\" fill=\"var(--c-ts)\"/></marker>\n<marker id=\"t1-a2\" markerWidth=\"6\" markerHeight=\"6\" refX=\"5\" refY=\"3\" orient=\"auto\"><path d=\"M0 0L5 3L0 6Z\" fill=\"var(--bad)\"/></marker></defs>\n<line x1=\"42\" y1=\"108\" x2=\"602\" y2=\"108\" stroke=\"var(--ink-4)\" stroke-width=\"8\" stroke-linecap=\"round\"/>\n<line x1=\"42\" y1=\"108\" x2=\"602\" y2=\"108\" stroke=\"var(--paper)\" stroke-width=\"3\" stroke-dasharray=\"2 8\" opacity=\".5\"/>\n<circle cx=\"42\" cy=\"108\" r=\"8\" fill=\"var(--c-cv)\"/><text x=\"42\" y=\"84\" text-anchor=\"middle\" font-size=\"9\" fill=\"var(--ink-2)\">上游压力测点</text>\n<circle cx=\"602\" cy=\"108\" r=\"8\" fill=\"var(--c-cv)\"/><text x=\"602\" y=\"84\" text-anchor=\"middle\" font-size=\"9\" fill=\"var(--ink-2)\">下游流量测点</text>\n<polygon points=\"350,98 350,118 342,108\" fill=\"var(--bad)\"/>\n<text x=\"350\" y=\"136\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"var(--bad)\">泄漏点 x</text>\n<path d=\"M350 96 C300 76 240 72 180 72\" fill=\"none\" stroke=\"var(--c-ts)\" stroke-width=\"1.6\" stroke-dasharray=\"4 3\" marker-end=\"url(#t1-a1)\"/>\n<path d=\"M350 96 C400 76 460 72 520 72\" fill=\"none\" stroke=\"var(--c-ts)\" stroke-width=\"1.6\" stroke-dasharray=\"4 3\" marker-end=\"url(#t1-a1)\"/>\n<text x=\"350\" y=\"60\" text-anchor=\"middle\" font-size=\"9\" fill=\"var(--c-ts)\">负压波向两端传播 · v ≈ 1,100 m/s</text>\n<path d=\"M120 108 L120 90 L108 96 L126 82 L114 78 L132 64\" fill=\"none\" stroke=\"var(--bad)\" stroke-width=\"1.4\"/>\n<text x=\"136\" y=\"70\" font-size=\"8.5\" fill=\"var(--bad)\">启泵 / 调阀扰动</text>\n<text x=\"136\" y=\"82\" font-size=\"8.5\" fill=\"var(--bad)\">压力突升 · 误报来源</text>\n<text x=\"42\" y=\"170\" font-size=\"9.5\" fill=\"var(--ink-3)\">定位原理：x = (L + v · Δt) / 2</text>\n<text x=\"42\" y=\"186\" font-size=\"9\" fill=\"var(--ink-4)\">Δt = 上游检测时刻 − 下游检测时刻，L = 管道全长</text>\n<text x=\"42\" y=\"206\" font-size=\"9\" fill=\"var(--ink-4)\">距离越远，压力波衰减越大，微小泄漏越容易被噪声淹没。</text>\n<text x=\"596\" y=\"206\" text-anchor=\"end\" font-size=\"9\" fill=\"var(--ink-3)\">96 km 管段示例</text>\n</svg><div class=\"figcap\"><b>图 1</b><span>泄漏产生的负压波沿管道向上下游传播，理论上可由两端检测时差定位。现实里波速受介质与温度影响，压力波随距离衰减，启停泵和阀门操作又会产生类似响应，误报与定位误差由此而来。</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>把泄漏检测拆成三个子问题：<b>异常检测</b>——用上下游压力、流量、泵阀状态的多变量时序模型判断是否发生泄漏；<b>工况识别</b>——把启停泵、调阀等操作作为显式输入，避免模型把正常扰动学成泄漏；<b>定位回归</b>——在负压波时差的基础上，用时序模型预测的到达时刻、衰减系数与管道高程做残差修正。</p><p>模型可以选择 TCN、1D CNN 或轻量 Transformer，输入 60—120 s 滑窗，输出泄漏概率与置信度。训练时以「召回优先」为原则：宁可多报几个候选，也不漏掉真实泄漏；再用置信度分级把复核工作量压下来。定位则必须与物理模型结合，纯数据模型在小样本下很难外推。</p><div class=\"figure\"><svg viewBox=\"0 0 640 244\" width=\"100%\" role=\"img\" aria-label=\"管道泄漏检测的数据流与模型分工\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"244\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<defs><marker id=\"t1-a3\" markerWidth=\"6\" markerHeight=\"6\" refX=\"5\" refY=\"3\" orient=\"auto\"><path d=\"M0 0L5 3L0 6Z\" fill=\"var(--ink-4)\"/></marker></defs>\n<rect x=\"14\" y=\"36\" width=\"112\" height=\"104\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--c-ts)\"/>\n<text x=\"26\" y=\"55\" font-size=\"9.5\" font-weight=\"600\" fill=\"var(--c-ts)\">高频测点</text>\n<text x=\"26\" y=\"76\" font-size=\"8.8\" fill=\"var(--ink-2)\">压力 / 流量</text>\n<text x=\"26\" y=\"92\" font-size=\"8.8\" fill=\"var(--ink-2)\">1—10 Hz</text>\n<text x=\"26\" y=\"108\" font-size=\"8.8\" fill=\"var(--ink-2)\">上下游时钟同步</text>\n<text x=\"26\" y=\"124\" font-size=\"8.5\" fill=\"var(--ink-4)\">±10 ms</text>\n<line x1=\"128\" y1=\"88\" x2=\"145\" y2=\"88\" stroke=\"var(--ink-4)\" marker-end=\"url(#t1-a3)\"/>\n<rect x=\"150\" y=\"36\" width=\"112\" height=\"104\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--c-opt)\"/>\n<text x=\"162\" y=\"55\" font-size=\"9.5\" font-weight=\"600\" fill=\"var(--c-opt)\">工况标签</text>\n<text x=\"162\" y=\"76\" font-size=\"8.8\" fill=\"var(--ink-2)\">启停泵 / 调阀</text>\n<text x=\"162\" y=\"92\" font-size=\"8.8\" fill=\"var(--ink-2)\">操作日志</text>\n<text x=\"162\" y=\"108\" font-size=\"8.8\" fill=\"var(--ink-2)\">流量平衡</text>\n<text x=\"162\" y=\"124\" font-size=\"8.5\" fill=\"var(--ink-4)\">区分真实泄漏</text>\n<line x1=\"264\" y1=\"88\" x2=\"281\" y2=\"88\" stroke=\"var(--ink-4)\" marker-end=\"url(#t1-a3)\"/>\n<rect x=\"286\" y=\"36\" width=\"112\" height=\"104\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--c-cv)\"/>\n<text x=\"298\" y=\"55\" font-size=\"9.5\" font-weight=\"600\" fill=\"var(--c-cv)\">异常检测</text>\n<text x=\"298\" y=\"76\" font-size=\"8.8\" fill=\"var(--ink-2)\">60 s 滑窗</text>\n<text x=\"298\" y=\"92\" font-size=\"8.8\" fill=\"var(--ink-2)\">TCN / 1D CNN</text>\n<text x=\"298\" y=\"108\" font-size=\"8.8\" fill=\"var(--ink-2)\">输出泄漏概率</text>\n<text x=\"298\" y=\"124\" font-size=\"8.5\" fill=\"var(--ink-4)\">召回优先</text>\n<line x1=\"400\" y1=\"88\" x2=\"417\" y2=\"88\" stroke=\"var(--ink-4)\" marker-end=\"url(#t1-a3)\"/>\n<rect x=\"422\" y=\"36\" width=\"112\" height=\"104\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--c-cv)\"/>\n<text x=\"434\" y=\"55\" font-size=\"9.5\" font-weight=\"600\" fill=\"var(--c-cv)\">定位回归</text>\n<text x=\"434\" y=\"76\" font-size=\"8.8\" fill=\"var(--ink-2)\">负压波时差</text>\n<text x=\"434\" y=\"92\" font-size=\"8.8\" fill=\"var(--ink-2)\">衰减系数</text>\n<text x=\"434\" y=\"108\" font-size=\"8.8\" fill=\"var(--ink-2)\">GBDT 残差修正</text>\n<text x=\"434\" y=\"124\" font-size=\"8.5\" fill=\"var(--ink-4)\">输出 km + 置信度</text>\n<line x1=\"536\" y1=\"88\" x2=\"553\" y2=\"88\" stroke=\"var(--ink-4)\" marker-end=\"url(#t1-a3)\"/>\n<rect x=\"558\" y=\"36\" width=\"76\" height=\"104\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--jade)\"/>\n<text x=\"568\" y=\"55\" font-size=\"9.5\" font-weight=\"600\" fill=\"var(--jade)\">报警分级</text>\n<text x=\"568\" y=\"76\" font-size=\"8.6\" fill=\"var(--ink-2)\">大于 0.8</text>\n<text x=\"568\" y=\"92\" font-size=\"8.6\" fill=\"var(--ink-2)\">0.5—0.8</text>\n<text x=\"568\" y=\"108\" font-size=\"8.6\" fill=\"var(--ink-2)\">小于 0.5</text>\n<text x=\"568\" y=\"124\" font-size=\"8.5\" fill=\"var(--ink-4)\">分级处置</text>\n<rect x=\"14\" y=\"162\" width=\"612\" height=\"54\" rx=\"7\" fill=\"var(--bg-ts)\" stroke=\"var(--c-ts)\" stroke-dasharray=\"4 3\"/>\n<text x=\"28\" y=\"182\" font-size=\"9.5\" fill=\"var(--ink-2)\">试点结果：泄漏召回 94% · 年误报 34 → 6 次 · 平均定位误差 ±620 → ±180 m</text>\n<text x=\"28\" y=\"200\" font-size=\"8.8\" fill=\"var(--ink-3)\">关键不在模型有多深，而在把泵阀状态、流量平衡与负压波时差放在同一个决策链里。</text>\n<text x=\"14\" y=\"22\" font-size=\"9.5\" fill=\"var(--ink-3)\">时序模型负责「有没有泄漏」，物理定位负责「在哪里」，工况标签负责「是不是扰动」。</text>\n</svg><div class=\"figcap\"><b>图 2</b><span>泄漏检测的数据流：高频压力流量与泵阀状态一起进入异常检测，再由负压波时差与回归模型定位，最后按置信度分级处置。三者分工明确，任何一环缺失都会让误报或定位误差失控。</span></div></div><p>落地时要把报警分级写进流程：高置信度直接推送调度，中置信度进入人工复核队列，低置信度只记录不打扰。这样既能保住召回，又不会让值班人员被误报淹没。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">泄漏检测的难点是「异常样本少、工况扰动多」。清单前三项决定能不能训练，第四项决定定位能不能可信。勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">高频压力与流量</span><span class=\"cl-s\">1—10 Hz，上下游时钟同步误差 ≤ 10 ms</span></span><span class=\"cl-n\">SCADA 历史数据</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">泵阀状态与操作日志</span><span class=\"cl-s\">启停泵、调阀时刻，秒级</span></span><span class=\"cl-n\">用于剔除工况扰动</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">泄漏事件库</span><span class=\"cl-s\">至少 50 次，含泄漏位置、泄漏量与处置结果</span></span><span class=\"cl-n\">作为监督标签</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">管道基础数据</span><span class=\"cl-s\">长度、壁厚、介质声速、高程与站场位置</span></span><span class=\"cl-n\">定位模型必需</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中高</b>。模型结构不是主要障碍，真正的难点是<b>样本不对称</b>：一年可能只有几次真实泄漏，却有上百次工况扰动。直接训练分类模型会偏向「正常」，小泄漏召回率很难超过 80%。</p><p>三个关键工程点：<b>时钟同步</b>——上下游差 1 s，定位就会偏 550 m，必须做硬件对时或软件对齐；<b>工况标签</b>——泵阀操作日志必须与压力流量严格对齐，否则模型会把扰动学成泄漏；<b>距离相关误差</b>——波速与衰减随管段变化，单一全局模型不够，通常要分段建模或加入中继测点。</p><p>建议先用 1—2 年历史数据做离线回测，把误报率、召回率与定位误差同时纳入验收；上线后保留人工复核与事件回流，模型才能逐步适应介质与工况变化。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">时序异常检测<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">负压波定位<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">变点检测<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">迁移学习<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "某 96 km 输油管道泄漏检测试点",
        "lead": [
          "某 96 km 原油管道，管径 323.9 mm，输送量约 1,200 m³/d，沿线 2 座泵站，上下游各设压力与流量测点，SCADA 采样间隔 5 s。过去两年发生 7 次泄漏，同时记录了 34 次误报，调度人员对报警已明显麻木。",
          "项目目标是把泄漏召回率提高到 90% 以上、年误报降到 10 次以内，并把平均定位误差压到 ±200 m。下面的流程把「单点阈值」升级成「时序检测 + 工况识别 + 物理定位」的组合。"
        ],
        "stats": [
          [
            "管道长度",
            "96 km"
          ],
          [
            "历史泄漏",
            "7 次 / 2 年"
          ],
          [
            "年误报",
            "34 → 6 次"
          ],
          [
            "泄漏召回率",
            "76% → 94%"
          ],
          [
            "平均检测延迟",
            "58 → 32 s"
          ],
          [
            "平均定位误差",
            "±620 → ±180 m"
          ]
        ],
        "steps": [
          {
            "name": "数据同步与清洗",
            "role": "数据",
            "do": "把上下游压力、流量按 5 s 重采样，用硬件对时与互相关校正把时钟误差压到 20 ms 以内；剔除传感器故障、停输和通信中断片段，保留 2 年有效数据。",
            "effect": "上下游时序严格对齐，为负压波时差定位提供基础",
            "trap": "时钟漂移 1 s 就会带来约 550 m 的定位偏差，必须优先解决"
          },
          {
            "name": "工况标签与扰动库",
            "role": "数据",
            "do": "从调度日志中标注 212 次启停泵、调阀和切换流程操作，与压力流量曲线逐条对齐；把 7 次泄漏的位置、泄漏量与处置结果整理成事件表。",
            "effect": "形成「泄漏 + 工况扰动 + 正常」三类标签，扰动样本量是泄漏的 30 倍",
            "trap": "把工况扰动误标为泄漏，会让模型学会「一有波动就报警」"
          },
          {
            "name": "时序异常检测",
            "role": "算法核心",
            "do": "用 TCN 输入 60 s 滑窗的上游压力、下游流量、压差与泵阀状态，输出泄漏概率；按井划分训练与验证，采用召回优先的阈值策略。",
            "effect": "泄漏召回率 94%，年误报从 34 次降到 6 次",
            "trap": "只用单一压力信号，小于 1% 的泄漏几乎全部漏检"
          },
          {
            "name": "负压波时差与定位回归",
            "role": "算法",
            "do": "在报警窗口内检测上下游压力波的到达时刻，按 x = (L + v·Δt)/2 得到初值；再用 GBDT 对波速、衰减与高程差做残差修正，输出位置与置信区间。",
            "effect": "平均定位误差从 ±620 m 降到 ±180 m",
            "trap": "距离越远衰减越大，单一波速假设会让末端误差显著放大"
          },
          {
            "name": "报警分级与闭环",
            "role": "落地",
            "do": "概率大于 0.8 直接推送调度并附位置；0.5—0.8 进入人工复核队列；小于 0.5 只记录。每次现场确认结果回流，更新模型与工况库。",
            "effect": "日均复核量控制在 5 条以内，真实泄漏平均响应时间缩短 40%",
            "trap": "阈值过低会让复核队列重新堆积，误报疲劳再次出现"
          }
        ],
        "metrics": {
          "title": "怎么算「检得准」",
          "html": "<p>泄漏检测必须同时看<b>召回率</b>（真实泄漏被检出多少）、<b>误报次数</b>（每年打扰调度的次数）与<b>定位误差</b>（估算位置与真实位置的距离）。只看召回会把阈值压到极低，误报随之爆炸；只看误报又会漏掉小泄漏。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>传统负压波</th><th>本方法</th><th>说明</th></tr></thead><tbody><tr><td>泄漏召回率</td><td>76%</td><td>94%</td><td>7 次历史泄漏的回测结果</td></tr><tr><td>年误报次数</td><td>34</td><td>6</td><td>按 2 年数据年化</td></tr><tr><td>平均检测延迟</td><td>58 s</td><td>32 s</td><td>从泄漏注入到报警</td></tr><tr><td>平均定位误差</td><td>±620 m</td><td>±180 m</td><td>距上游 5—90 km 平均</td></tr><tr><td>最小可检泄漏</td><td>1.8%</td><td>0.6%</td><td>占输送流量比例</td></tr></tbody></table><p class=\"small muted\">注：定位误差随距离增大而非线性上升；末端 90 km 处即使在本方法下也可能达到 ±300 m，需要中继测点或分段模型。</p>"
        },
        "fails": [
          {
            "name": "工况扰动误报",
            "why": "启泵会让上游压力突升、流量阶跃，形态与泄漏负压波相反但幅值更大。若模型不接入泵阀状态，就会把正常操作当成泄漏。必须把操作日志作为显式输入。"
          },
          {
            "name": "小泄漏被噪声淹没",
            "why": "泄漏量小于 0.5% 时，负压波幅值只有几十 kPa，与正常波动同量级。单靠压力阈值无法检出，需要流量平衡、长期趋势与多测点联合判断。"
          },
          {
            "name": "定位误差随距离增大",
            "why": "96 km 管段末端，波速偏差 1% 就会带来约 480 m 误差，压力波衰减又让到达时刻难以精确提取。解决方向是增加中继压力测点或按管段分段建模。"
          }
        ]
      }
    }
  };

  var FILES = [
      {
        "name": "demo/demo.css",
        "data": "* { box-sizing: border-box; }\nhtml, body { margin: 0; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #12160f;\n  color: #e8e3d5;\n  padding: 22px 20px 36px;\n  line-height: 1.62;\n  -webkit-font-smoothing: antialiased;\n}\n.panel { max-width: 1020px; margin: 0 auto; }\nh1 { font-size: 20px; font-weight: 600; margin: 0 0 5px; }\nh2 { font-size: 13px; font-weight: 600; color: #78b7a8; margin: 0 0 9px; letter-spacing: .03em; }\n.lead { font-size: 12.5px; color: #a6a18f; margin: 0 0 16px; }\n.hint { font-size: 11.5px; color: #8b8778; margin: 0 0 10px; }\n.section { background: #1a1f16; border: 1px solid #2b3226; border-radius: 10px; padding: 15px 17px; margin-bottom: 14px; }\n\n.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }\n.chip {\n  border: 1px solid #3a4433; background: #141910; color: #c9c4b4; border-radius: 18px;\n  padding: 6px 13px; font-size: 12px; cursor: pointer; font-family: inherit; transition: .15s;\n}\n.chip:hover { border-color: #78b7a8; color: #78b7a8; }\n.chip.on { background: #78b7a8; border-color: #78b7a8; color: #12160f; font-weight: 600; }\n\n.controls { display: grid; grid-template-columns: repeat(2, 1fr); gap: 11px; }\n.ctl {\n  background: #141910; border: 1px solid #293025; border-radius: 8px; padding: 9px 12px;\n  display: flex; flex-direction: column; gap: 4px; min-width: 0;\n}\n.ctl label { font-size: 12px; color: #c9c4b4; display: flex; justify-content: space-between; align-items: center; gap: 8px; }\n.ctl output { font-family: ui-monospace, Consolas, monospace; color: #d0a85c; font-weight: 600; font-size: 12px; }\n.ctl input[type=\"range\"] { width: 100%; accent-color: #78b7a8; height: 18px; margin: 0; }\n.ctl .tip { font-size: 10.5px; color: #7b8070; line-height: 1.45; }\n.ctl select {\n  background: #1c2218; color: #e8e3d5; border: 1px solid #3a4433; border-radius: 5px;\n  padding: 4px 6px; font-family: inherit; font-size: 12px;\n}\n\n.split { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(240px, .85fr); gap: 14px; align-items: start; }\n.chart-wrap { background: #0f130d; border: 1px solid #262d21; border-radius: 8px; padding: 5px; min-width: 0; }\nsvg { display: block; width: 100%; height: auto; }\n\n.readouts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }\n.readouts.one { grid-template-columns: 1fr; }\n.ro { background: #141910; border: 1px solid #293025; border-radius: 8px; padding: 9px 11px; min-width: 0; }\n.ro span { display: block; font-size: 10.5px; color: #8b8778; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.ro b { font-family: ui-monospace, Consolas, monospace; font-size: 18px; color: #d0a85c; font-weight: 600; line-height: 1.25; }\n.ro b small { font-size: 10px; color: #8b8778; font-weight: 400; }\n\n.rank { margin-top: 2px; }\n.rank-head { font-size: 10.5px; color: #8b8778; letter-spacing: .05em; margin-bottom: 6px; }\n.rk { display: flex; align-items: center; gap: 7px; padding: 6px 0; border-bottom: 1px dashed #293025; font-size: 11.5px; }\n.rk:last-child { border-bottom: 0; }\n.rk .no { font-family: ui-monospace, Consolas, monospace; color: #7b8070; width: 14px; flex-shrink: 0; }\n.rk .nm { width: 70px; flex-shrink: 0; color: #c9c4b4; }\n.rk .bar { flex: 1; height: 6px; background: #293025; border-radius: 3px; overflow: hidden; min-width: 20px; }\n.rk .bar i { display: block; height: 100%; background: #5e8f83; border-radius: 3px; }\n.rk .val { font-family: ui-monospace, Consolas, monospace; color: #8b8778; width: 44px; text-align: right; flex-shrink: 0; }\n.rk.top .nm { color: #d0a85c; font-weight: 600; }\n.rk.top .bar i { background: #d0a85c; }\n.rk.top .val { color: #d0a85c; }\n\n.status {\n  display: flex; gap: 10px; align-items: flex-start; background: #141910; border: 1px solid #293025;\n  border-left: 3px solid #78b7a8; border-radius: 7px; padding: 10px 12px;\n  font-size: 11.8px; color: #a6a18f; line-height: 1.55;\n}\n.status b { color: #78b7a8; flex-shrink: 0; }\n.status.ok { border-left-color: #78b7a8; }\n.status.ok b { color: #78b7a8; }\n.status.warn { border-left-color: #d0a85c; }\n.status.warn b { color: #d0a85c; }\n.status.bad { border-left-color: #d46a5c; }\n.status.bad b { color: #d46a5c; }\n\n.btnrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }\nbutton {\n  font-family: inherit; font-size: 12px; border-radius: 7px; border: 1px solid #3a4433;\n  background: #1c2218; color: #c9c4b4; padding: 7px 13px; cursor: pointer; transition: .15s;\n}\nbutton:hover { border-color: #78b7a8; color: #78b7a8; }\nbutton.primary { background: #78b7a8; border-color: #78b7a8; color: #12160f; font-weight: 600; }\nbutton.primary:hover { background: #8ec8b9; color: #12160f; }\n.btn-note { font-size: 10.5px; color: #7b8070; margin-left: auto; }\n\n.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 10.5px; color: #8b8778; margin-top: 4px; }\n.legend i { display: inline-block; width: 14px; height: 2px; vertical-align: middle; margin-right: 4px; }\n.legend i.dot { width: 7px; height: 7px; border-radius: 50%; }\n"
      },
      {
        "name": "demo/demo.js",
        "data": "/* ======= 输油管道泄漏智能检测与定位 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  const $ = function (id) { return document.getElementById(id); };\n  const D_KM = 96, V = 1100, T = 240, DT = 0.2, T0 = 50;\n  const DEFAULTS = { thr: 0.12, pos: 48, leak: 2.0, dist: false };\n  let st = { thr: 0.12, pos: 48, leak: 2.0, dist: false };\n\n  function simulate() {\n    const n = Math.round(T / DT) + 1;\n    const p = new Float64Array(n), q = new Float64Array(n);\n    const amp = 0.04 + 0.08 * st.leak;\n    const ampUp = amp * (1 - 0.45 * st.pos / D_KM);\n    const ampDown = amp * (1 - 0.20 * st.pos / D_KM);\n    const tUp = T0 + st.pos * 1000 / V;\n    const tDown = T0 + (D_KM - st.pos) * 1000 / V;\n    for (let i = 0; i < n; i++) {\n      const t = i * DT;\n      let pv = 8.2 + 0.004 * Math.sin(t * 0.7) + 0.002 * Math.sin(t * 2.3);\n      let qv = 1200 + 5 * Math.sin(t * 0.4 + 0.5) + 2 * Math.sin(t * 1.9);\n      if (t >= tUp) pv -= ampUp * (1 - Math.exp(-(t - tUp) / 2.5));\n      if (t >= tDown) qv -= ampDown * 130 * (1 - Math.exp(-(t - tDown) / 2.5));\n      if (st.dist && t >= 120) {\n        const d = Math.exp(-(t - 120) / 4);\n        pv += 0.14 * d;\n        qv += 26 * d;\n      }\n      p[i] = pv;\n      q[i] = qv;\n    }\n    return { p: p, q: q, n: n };\n  }\n\n  function findCross(arr) {\n    for (let i = 0; i < arr.length; i++) {\n      const t = i * DT;\n      if (t >= T0 && 8.2 - arr[i] >= st.thr) return t;\n    }\n    return null;\n  }\n\n  function px(i, n) { return 80 + i / (n - 1) * 620; }\n  function py(v) { return 350 - (v - 7.6) / 0.8 * 255; }\n  function qy(v) { return 350 - (v - 1080) / 180 * 255; }\n\n  function linePath(arr, n, mapper) {\n    let d = '';\n    for (let i = 0; i < n; i += 2) {\n      d += (i ? 'L' : 'M') + px(i, n).toFixed(1) + ' ' + mapper(arr[i]).toFixed(1);\n    }\n    return d;\n  }\n\n  function draw(data, tDet, est) {\n    const W = 760, H = 430;\n    const n = data.n;\n    let g = '<rect x=\"0\" y=\"0\" width=\"' + W + '\" height=\"' + H + '\" fill=\"#0f130d\" rx=\"6\"/>';\n\n    g += '<line x1=\"80\" y1=\"30\" x2=\"700\" y2=\"30\" stroke=\"#5b6358\" stroke-width=\"6\" stroke-linecap=\"round\"/>';\n    g += '<circle cx=\"80\" cy=\"30\" r=\"4.5\" fill=\"#78b7a8\"/><circle cx=\"700\" cy=\"30\" r=\"4.5\" fill=\"#78b7a8\"/>';\n    g += '<text x=\"80\" y=\"56\" font-size=\"9\" fill=\"#8b8778\">上游泵站 · 压力测点</text>';\n    g += '<text x=\"700\" y=\"56\" text-anchor=\"end\" font-size=\"9\" fill=\"#8b8778\">下游阀室 · 流量测点</text>';\n    const lx = 80 + st.pos / D_KM * 620;\n    g += '<polygon points=\"' + (lx - 6).toFixed(1) + ',18 ' + (lx + 6).toFixed(1) + ',18 ' + lx.toFixed(1) + ',30\" fill=\"#d46a5c\"/>';\n    g += '<text x=\"' + lx.toFixed(1) + '\" y=\"14\" text-anchor=\"middle\" font-size=\"9\" fill=\"#d46a5c\">真实泄漏 ' + st.pos + ' km</text>';\n    if (est !== null) {\n      const ex = 80 + est / 96000 * 620;\n      g += '<circle cx=\"' + ex.toFixed(1) + '\" cy=\"30\" r=\"7\" fill=\"none\" stroke=\"#78b7a8\" stroke-width=\"2\" stroke-dasharray=\"3 2\"/>';\n      g += '<text x=\"' + ex.toFixed(1) + '\" y=\"72\" text-anchor=\"middle\" font-size=\"9\" fill=\"#78b7a8\">估算 ' + (est / 1000).toFixed(1) + ' km</text>';\n    }\n\n    [7.6, 7.8, 8.0, 8.2, 8.4].forEach(function (v) {\n      g += '<line x1=\"80\" y1=\"' + py(v) + '\" x2=\"700\" y2=\"' + py(v) + '\" stroke=\"#242b20\"/>';\n      g += '<text x=\"72\" y=\"' + (py(v) + 3) + '\" text-anchor=\"end\" font-size=\"9\" fill=\"#7b8070\">' + v.toFixed(1) + '</text>';\n    });\n    [1100, 1150, 1200, 1250].forEach(function (v) {\n      g += '<text x=\"708\" y=\"' + (qy(v) + 3) + '\" font-size=\"9\" fill=\"#7b8070\">' + v + '</text>';\n    });\n    for (let t = 0; t <= T; t += 40) {\n      const x = 80 + t / T * 620;\n      g += '<line x1=\"' + x + '\" y1=\"95\" x2=\"' + x + '\" y2=\"350\" stroke=\"#242b20\"/>';\n      g += '<text x=\"' + x + '\" y=\"368\" text-anchor=\"middle\" font-size=\"9\" fill=\"#7b8070\">' + t + '</text>';\n    }\n    g += '<line x1=\"80\" y1=\"350\" x2=\"700\" y2=\"350\" stroke=\"#3a4433\"/>';\n    g += '<line x1=\"80\" y1=\"95\" x2=\"80\" y2=\"350\" stroke=\"#3a4433\"/>';\n    g += '<line x1=\"700\" y1=\"95\" x2=\"700\" y2=\"350\" stroke=\"#3a4433\"/>';\n    g += '<text x=\"80\" y=\"390\" font-size=\"9.5\" fill=\"#8b8778\">上游压力 / MPa</text>';\n    g += '<text x=\"700\" y=\"390\" text-anchor=\"end\" font-size=\"9.5\" fill=\"#8b8778\">下游流量 / (m³/h)</text>';\n    g += '<text x=\"390\" y=\"390\" text-anchor=\"middle\" font-size=\"9.5\" fill=\"#8b8778\">时间 / s</text>';\n\n    const ty = py(8.2 - st.thr);\n    g += '<line x1=\"80\" y1=\"' + ty + '\" x2=\"700\" y2=\"' + ty + '\" stroke=\"#d0a85c\" stroke-width=\"1\" stroke-dasharray=\"5 4\"/>';\n    g += '<text x=\"694\" y=\"' + (ty - 5) + '\" text-anchor=\"end\" font-size=\"8.5\" fill=\"#d0a85c\">检测阈值</text>';\n    const t0x = 80 + T0 / T * 620;\n    g += '<line x1=\"' + t0x + '\" y1=\"95\" x2=\"' + t0x + '\" y2=\"350\" stroke=\"#d46a5c\" stroke-width=\"1\" stroke-dasharray=\"3 3\" opacity=\".7\"/>';\n    g += '<text x=\"' + (t0x + 4) + '\" y=\"108\" font-size=\"8.5\" fill=\"#d46a5c\">泄漏注入 t=50 s</text>';\n    if (tDet !== null) {\n      const dx = 80 + tDet / T * 620;\n      g += '<line x1=\"' + dx + '\" y1=\"95\" x2=\"' + dx + '\" y2=\"350\" stroke=\"#78b7a8\" stroke-width=\"1\" stroke-dasharray=\"2 2\"/>';\n      g += '<polygon points=\"' + (dx - 4) + ',' + (ty - 3) + ' ' + (dx + 4) + ',' + (ty - 3) + ' ' + dx + ',' + (ty + 6) + '\" fill=\"#78b7a8\"/>';\n      g += '<text x=\"' + (dx + 5) + '\" y=\"' + (ty + 18) + '\" font-size=\"8.5\" fill=\"#78b7a8\">检测 ' + tDet.toFixed(1) + ' s</text>';\n    }\n    if (st.dist) {\n      const dxx = 80 + 120 / T * 620;\n      g += '<line x1=\"' + dxx + '\" y1=\"95\" x2=\"' + dxx + '\" y2=\"350\" stroke=\"#d0a85c\" stroke-width=\"1\" stroke-dasharray=\"2 3\" opacity=\".8\"/>';\n      g += '<text x=\"' + (dxx + 4) + '\" y=\"' + (py(8.4) + 14) + '\" font-size=\"8.5\" fill=\"#d0a85c\">启泵扰动</text>';\n    }\n\n    g += '<path d=\"' + linePath(data.p, n, py) + '\" fill=\"none\" stroke=\"#78b7a8\" stroke-width=\"1.8\" stroke-linejoin=\"round\"/>';\n    g += '<path d=\"' + linePath(data.q, n, qy) + '\" fill=\"none\" stroke=\"#d0a85c\" stroke-width=\"1.6\" stroke-linejoin=\"round\" opacity=\".92\"/>';\n\n    g += '<line x1=\"80\" y1=\"406\" x2=\"94\" y2=\"406\" stroke=\"#78b7a8\" stroke-width=\"2\"/><text x=\"99\" y=\"409\" font-size=\"9\" fill=\"#8b8778\">上游压力</text>';\n    g += '<line x1=\"160\" y1=\"406\" x2=\"174\" y2=\"406\" stroke=\"#d0a85c\" stroke-width=\"2\"/><text x=\"179\" y=\"409\" font-size=\"9\" fill=\"#8b8778\">下游流量</text>';\n    g += '<line x1=\"240\" y1=\"406\" x2=\"254\" y2=\"406\" stroke=\"#d0a85c\" stroke-width=\"1\" stroke-dasharray=\"4 3\"/><text x=\"259\" y=\"409\" font-size=\"9\" fill=\"#8b8778\">检测阈值</text>';\n    g += '<line x1=\"330\" y1=\"406\" x2=\"344\" y2=\"406\" stroke=\"#d46a5c\" stroke-width=\"1\" stroke-dasharray=\"3 3\"/><text x=\"349\" y=\"409\" font-size=\"9\" fill=\"#8b8778\">泄漏注入</text>';\n    $('chart').innerHTML = g;\n  }\n\n  function update() {\n    const data = simulate();\n    const tDet = findCross(data.p);\n    const detected = tDet !== null;\n    const err = detected ? Math.round(60 + 1.8 * st.pos + 300 * Math.max(0, 0.12 - st.thr)) : null;\n    const est = detected ? Math.min(96000, st.pos * 1000 + err) : null;\n    const fp = Math.round(34 * Math.exp(-st.thr / 0.06)) + (st.dist ? 3 : 0);\n\n    draw(data, tDet, est);\n    $('r-delay').innerHTML = detected ? (tDet - T0).toFixed(1) + ' <small>s</small>' : '未检出';\n    $('r-err').innerHTML = detected ? '±' + err + ' <small>m</small>' : '—';\n    $('r-fp').innerHTML = fp + ' <small>次/年</small>';\n\n    const stEl = $('status');\n    if (!detected) {\n      stEl.className = 'status ok';\n      stEl.innerHTML = '<b>正常（未检出）</b><span>当前泄漏量 ' + st.leak.toFixed(1) +\n        '% 与阈值 ' + st.thr.toFixed(2) + ' MPa 的组合下，压力下降未超过阈值。小泄漏需要流量平衡或长期趋势模型补充。</span>';\n    } else if (st.dist && st.thr < 0.12) {\n      stEl.className = 'status warn';\n      stEl.innerHTML = '<b>工况扰动</b><span>启泵压力尖峰与泄漏负压波叠加，当前阈值 ' + st.thr.toFixed(2) +\n        ' MPa 过低，年误报约 ' + fp + ' 次。应接入泵阀状态做工况识别，再判断是否为真实泄漏。</span>';\n    } else {\n      stEl.className = 'status bad';\n      stEl.innerHTML = '<b>泄漏报警</b><span>检测延迟 ' + (tDet - T0).toFixed(1) +\n        ' s，估算泄漏位置距上游 ' + (est / 1000).toFixed(1) + ' km，定位误差约 ±' + err +\n        ' m。建议调取该管段压力波与流量平衡复核。</span>';\n    }\n  }\n\n  function sync() {\n    $('s-thr').value = st.thr;\n    $('s-pos').value = st.pos;\n    $('s-leak').value = st.leak;\n    $('o-thr').textContent = st.thr.toFixed(2) + ' MPa';\n    $('o-pos').textContent = st.pos + ' km';\n    $('o-leak').textContent = st.leak.toFixed(1) + '%';\n  }\n\n  $('s-thr').addEventListener('input', function (e) { st.thr = +e.target.value; sync(); update(); });\n  $('s-pos').addEventListener('input', function (e) { st.pos = +e.target.value; sync(); update(); });\n  $('s-leak').addEventListener('input', function (e) { st.leak = +e.target.value; sync(); update(); });\n  $('btn-dist').addEventListener('click', function () {\n    st.dist = !st.dist;\n    $('btn-dist').textContent = st.dist ? '关闭启泵扰动' : '叠加启泵扰动';\n    update();\n  });\n  $('btn-reset').addEventListener('click', function () {\n    st = Object.assign({}, DEFAULTS);\n    $('btn-dist').textContent = '叠加启泵扰动';\n    sync();\n    update();\n  });\n\n  sync();\n  update();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：输油管道泄漏智能检测与定位</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>输油管道泄漏智能检测与定位</h1>\n  <p class=\"lead\">拖动检测阈值、泄漏位置与泄漏量，看上下游压力与流量的时序响应。阈值越低越容易检出，但工况扰动带来的误报也越多。</p>\n\n  <div class=\"section\">\n    <h2>① 上下游压力 / 流量时序</h2>\n    <p class=\"hint\">青线为上游压力，金线为下游流量。泄漏在 50 s 注入，负压波沿管道向两端传播；虚线是检测阈值，三角标记是报警时刻。</p>\n    <div class=\"chart-wrap\"><svg id=\"chart\" viewBox=\"0 0 760 430\" role=\"img\" aria-label=\"管道上下游压力流量时序\"></svg></div>\n    <div class=\"readouts\" style=\"margin-top:10px\">\n      <div class=\"ro\"><span>检测延迟（相对泄漏注入）</span><b id=\"r-delay\">—</b></div>\n      <div class=\"ro\"><span>定位误差</span><b id=\"r-err\">—</b></div>\n      <div class=\"ro\"><span>年误报次数（估算）</span><b id=\"r-fp\">—</b></div>\n    </div>\n    <div class=\"status\" id=\"status\" style=\"margin-top:12px\"></div>\n  </div>\n\n  <div class=\"section\">\n    <h2>② 调整检测条件</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>检测阈值 <output id=\"o-thr\">0.12 MPa</output></label>\n        <input type=\"range\" id=\"s-thr\" min=\"0.02\" max=\"0.30\" step=\"0.01\" value=\"0.12\">\n        <span class=\"tip\">压力下降超过阈值即报警。阈值降低会缩短检测延迟，也会放大噪声误报。</span>\n      </div>\n      <div class=\"ctl\">\n        <label>泄漏位置（距上游）<output id=\"o-pos\">48 km</output></label>\n        <input type=\"range\" id=\"s-pos\" min=\"5\" max=\"90\" step=\"1\" value=\"48\">\n        <span class=\"tip\">管道全长 96 km。距离越远，负压波衰减越大、定位误差越大。</span>\n      </div>\n      <div class=\"ctl\">\n        <label>泄漏量（占输送流量）<output id=\"o-leak\">2.0%</output></label>\n        <input type=\"range\" id=\"s-leak\" min=\"0.5\" max=\"8\" step=\"0.5\" value=\"2\">\n        <span class=\"tip\">小于 1% 的泄漏压力波很弱，常被噪声淹没，需要流量平衡辅助。</span>\n      </div>\n    </div>\n    <div class=\"btnrow\">\n      <button id=\"btn-dist\">叠加启泵扰动</button>\n      <button id=\"btn-reset\">恢复默认</button>\n      <span class=\"btn-note\">管道 96 km · 负压波速 1,100 m/s · 采样 0.2 s</span>\n    </div>\n  </div>\n\n  <div class=\"section\">\n    <h2>③ 为什么不能只靠单一阈值</h2>\n    <p class=\"hint\">启停泵与阀门操作会造成压力、流量同时跳变，形态与泄漏相似但方向不同。实际系统需要接入泵阀状态做工况识别，再用负压波时差与流量平衡联合定位，才能把误报压到可接受水平。</p>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动检测阈值、泄漏位置与泄漏量，观察上游压力与下游流量的时序响应、报警时刻、定位误差与年误报估算；点击「叠加启泵扰动」，看工况扰动如何制造误报风险。",
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
