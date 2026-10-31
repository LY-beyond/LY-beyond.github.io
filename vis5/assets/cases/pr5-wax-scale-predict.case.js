/* =========================================================
   案例插件（静态注册版）：结蜡 / 结垢智能预测
   ---------------------------------------------------------
   由 cases/pr5-wax-scale-predict/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "pr5-wax-scale-predict",
    "sceneId": "pr5",
    "methods": [
      "ts"
    ],
    "title": "结蜡 / 结垢智能预测",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "高含蜡原油（含蜡量 18%—26%、析蜡点 **42—48 °C**）井的清蜡周期从 15 天到 90 天差异极大，按固定周期热洗的结果是：结蜡快的井蜡卡躺井、结蜡慢的井白做功——一个 96 口井的区块年热洗 **1,800 井次**，约三成不必要。从产量递减、井口温度与压力时序预测结蜡风险，可把热洗安排到真正需要的窗口，并提前 10—20 天预警蜡卡风险。",
        "judge": [
          {
            "label": "任务类型",
            "value": "风险预测 + 生存分析",
            "desc": "预测结蜡 / 结垢风险与最佳清防时机"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "标签来自作业记录，时间精度 ±3—7 天"
          },
          {
            "label": "可见收益",
            "value": "中",
            "desc": "热洗井次降 20%—30%，蜡卡躺井减半"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "早期信号弱、标签时间模糊"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>结蜡与结垢堵塞井筒与管线：蜡在温度低于析蜡点的井段析出沉积，垢（碳酸钙、硫酸钡锶）在压力温度突变处生成，结果是产量递减加速、井口压力升高、抽油机载荷增大，严重时蜡卡躺井、管线堵死。清防措施按周期执行：热洗（单井 4—8 h、数千元）、化学加剂、机械清蜡，周期全凭经验——同一区块 15 天到 90 天不等。</p><p>「一刀切」的代价很具体：某 96 口井区块年热洗约 1,800 井次，事后复盘约 <b>30%</b> 的井次热洗前后产量无变化（白洗）；同时年均蜡卡躺井 11 起，单起作业费 8—15 万元——结蜡快的井没等到周期就躺了。结垢位置（泵、筛管、地面管线）更难预测，往往拆检时才发现。</p><p>数据与约束：日度生产数据（产量、油压、套压、井口温度）、清蜡除垢记录（时间、方式、效果）、原油物性（含蜡量、析蜡点）。硬约束：① 结蜡是渐进过程，早期信号（日递减 0.3%—0.5% 的异常加速）淹没在 ±2% 的计量噪声里；② 标签时间是「作业日期」而非「结蜡临界日期」，有 ±3—7 天模糊；③ 风险预测必须给出时间窗，只报「高风险」不报「何时」无法排产。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 替换「固定周期 + 凭感觉」：对每口井用生存分析框架建模「上次清蜡到今天」的风险曲线——输入清蜡以来的日度动态（递减斜率、井口温度压力趋势、载荷变化）与静态物性（析蜡点、含蜡量、井深温度剖面），输出未来 30 天逐日结蜡风险与「建议清防窗口」；结垢单独建模，特征侧重压力波动与离子配伍性。</p><p>训练要点：标签取作业记录，用「效果字段」（热洗后产量恢复幅度）反推该次作业是否必要，构造「真需要 / 可推迟」弱标签；标签时间模糊用区间删失处理（生存分析天然支持）。定位是排产助手：系统输出每口井的建议清防窗口与依据（递减加速贡献 0.4、井温下降贡献 0.3……），采油队按窗口合并邻近井安排热洗车路线——清防决策涉及车辆与药剂调度，不适合全自动。</p><p>机理结合兜底：井筒温度剖面 + 析蜡点给出结蜡位置的物理约束（哪些深度段低于析蜡点），模型预测与机理计算不一致时降级为「需人工复核」，避免把结垢当结蜡处置。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">动态数据现成，关键在作业记录的「效果」字段要填全，否则无法区分必要作业与过度作业。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">日度生产数据</span><span class=\"cl-s\">产量、油压、套压、井口温度、电流 / 载荷，单井 1,000+ 天</span></span><span class=\"cl-n\">无需标注</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">清蜡除垢记录</span><span class=\"cl-s\">时间、方式、用量、效果（恢复幅度），单区块年 1,000+ 井次</span></span><span class=\"cl-n\">效果字段必填，作弱标签</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">原油物性</span><span class=\"cl-s\">含蜡量、析蜡点、胶质沥青质、黏度</span></span><span class=\"cl-n\">按井 / 层位整理</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">水质与结垢离子</span><span class=\"cl-s\">Ca²⁺、Ba²⁺、HCO₃⁻、矿化度，季度化验</span></span><span class=\"cl-n\">结垢建模用</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井身与温度剖面</span><span class=\"cl-s\">井深、地温梯度、管柱结构</span></span><span class=\"cl-n\">结蜡位置机理约束</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">信号弱、演变慢、标签时间模糊——风险曲线比硬分类更适合这个问题。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"\"></i></div><p>难度 <b>中</b>。挑战排序：① 早期信号信噪比低——日递减 0.3% 的异常加速藏在 ±2% 的计量波动里，需多天累积才能确认，提前量与误报天然矛盾；② 标签时间与质量模糊——作业日期 ≠ 结蜡临界日期，且「效果」字段缺失率高；③ 结蜡与结垢成因不同却表象相似（都是递减加速 + 压力上升），分错类型推荐的药剂就是错的。</p><p>评估建议：30 天窗口内蜡卡 / 堵管事件召回率 ≥75%；热洗井次下降 ≥20% 且躺井数不升；建议窗口与事后复盘的最佳窗口偏差 ≤7 天。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">风险预测<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">生存分析<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">特征归因<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "鄂尔多斯盆地某高含蜡区块 96 口井的清蜡智能排产",
        "lead": [
          "区块原油含蜡量 18%—26%、析蜡点 42—48 °C，96 口井年热洗约 1,800 井次、蜡卡躺井 11 起；清蜡周期在 15—90 天间凭井组经验固定。日度动态数据完整，近 3 年清蜡记录 4,600 井次，其中「效果」字段完整率 72%。",
          "项目用生存分析建模逐井风险曲线，输出 30 天滚动清防窗口建议。目标：热洗总井次降 ≥20%、蜡卡躺井减半、建议窗口与复盘最佳窗口偏差 ≤7 天。"
        ],
        "stats": [
          [
            "生产井",
            "96 口"
          ],
          [
            "析蜡点",
            "42—48 °C"
          ],
          [
            "历史热洗",
            "4,600 井次"
          ],
          [
            "年蜡卡躺井",
            "11 起"
          ],
          [
            "单起躺井损失",
            "8—15 万元"
          ],
          [
            "风险更新",
            "每日滚动"
          ]
        ],
        "steps": [
          {
            "name": "标签构造与清洗",
            "role": "标注",
            "do": "4,600 井次清蜡记录按「效果」字段构造弱标签：恢复幅度 >8% 记「必要」、<2% 记「可推迟」；缺失 28% 用物性相似邻井插补并标记低置信。",
            "effect": "有效标签 3,300 井次",
            "trap": "把「可推迟」当「无结蜡」——没效果只说明没到临界，不说明没有沉积，两类标签必须分开"
          },
          {
            "name": "特征工程",
            "role": "数据",
            "do": "构造递减斜率（7 天滑动）、井口温度趋势、载荷变化、距上次清蜡天数、井筒低于析蜡点的深度段长度等 22 个特征。",
            "effect": "特征与标签对齐率 95%",
            "trap": "用当天产量而非滑动斜率——计量波动 ±2% 直接淹没 0.4%/天的真实加速"
          },
          {
            "name": "生存模型训练",
            "role": "算法核心",
            "do": "DeepSurv（Cox 深度模型）按井型分层训练，时间模糊用区间删失；输出未来 30 天逐日风险曲线，按井型校准阈值。",
            "effect": "30 天窗口蜡卡召回 78%，C-index 0.81",
            "trap": "当二分类做（30 天内是否躺井）——丢掉时间结构，无法回答「哪天洗最合适」，排产价值减半"
          },
          {
            "name": "窗口排产与路线合并",
            "role": "推理",
            "do": "风险超阈值井生成建议窗口，按地理位置与热洗车能力合并邻近井，输出周排产表。",
            "effect": "热洗井次从月均 150 降到 112（-25%）",
            "trap": "纯按风险排序派车——车辆往返时间翻倍，现场拒绝执行，路线约束必须进排产"
          },
          {
            "name": "机理一致性校验",
            "role": "质控",
            "do": "模型高风险井对照井筒温度剖面计算结蜡位置（本例集中在 400—800 m 井段），位置与拆检记录不符时降级人工复核。",
            "effect": "误建议率降 12%",
            "trap": "信模型不信机理——某井模型判高风险但全井段温度高于析蜡点，实际是结垢，按清蜡方案热洗无效"
          }
        ],
        "metrics": {
          "title": "怎么算「排产合理」",
          "html": "<p>反直觉的陷阱：热洗井次降得越多越好吗？不是——把井次砍掉 40% 同时躺井翻倍，是拿 10 万元级作业费换千元级热洗费，方向完全错了。这个场景的评估必须是「<b>井次下降率</b>」与「<b>躺井数</b>」的联合约束：先卡死「躺井数不升」这条底线，再谈井次优化。同理，召回率要按「事件」而非「井日」统计——井日准确率 97% 与事件召回 75% 是同一个系统的两面，拿前者汇报是误导。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>固定周期</th><th>本方案</th></tr></thead><tbody><tr><td>年热洗井次</td><td>96 口井合计</td><td>约 1,800</td><td>1,350（-25%）</td></tr><tr><td>年蜡卡躺井</td><td>起数</td><td>11</td><td>5</td></tr><tr><td>30 天事件召回</td><td>蜡卡 / 堵管提前预警</td><td>—</td><td>78%</td></tr><tr><td>窗口偏差</td><td>建议 vs 复盘最佳窗口</td><td>周期固定无窗口</td><td>中位 5 天</td></tr><tr><td>年费用节约</td><td>热洗 + 躺井作业</td><td>—</td><td>约 210 万元</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "标签时间模糊导致阈值漂移",
            "why": "作业日期与结蜡临界日期差 ±3—7 天，当精确时间训练时风险曲线峰值系统性偏后，建议窗口跟着偏。解决：区间删失建模 + 复盘校准，把窗口偏差中位数控制在 5 天内。"
          },
          {
            "name": "结垢被当结蜡处置",
            "why": "两者都表现为递减加速与压力上升，按蜡处理（热洗）对碳酸钙垢无效，白洗一次还延误 7—10 天。解决：水质离子特征 + 机理位置校验做类型分流，分流置信度低时强制人工判型。"
          },
          {
            "name": "季节切换期风险失准",
            "why": "入冬井口温度骤降 10—15 °C，析蜡深度段快速下移，按历史统计的阈值全面偏低，入冬第一个月躺井集中爆发。解决：井口温度预报作为外生协变量输入，季节切换期阈值自动收紧 20%。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
