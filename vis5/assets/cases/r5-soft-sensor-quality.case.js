/* =========================================================
   案例插件（静态注册版）：柴油质量指标在线软测量
   ---------------------------------------------------------
   由 cases/r5-soft-sensor-quality/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "r5-soft-sensor-quality",
    "sceneId": "r5",
    "methods": [
      "ts"
    ],
    "title": "柴油质量指标在线软测量",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "某 **220 万吨/年**柴油加氢精制装置（**260 t/h**）的闪点、倾点与硫含量，只能靠化验室每班 1 次取样，从采样到出结果 **3—5 h**；等结果出来，不合格品已经进了调合罐，一次回炼损失 **10—30 万元**。软测量用 1 s 级过程变量实时估计三个指标并给出置信区间，把「事后发现」提前到「当时可见」。",
        "judge": [
          {
            "label": "任务类型",
            "value": "软测量 + 区间估计",
            "desc": "过程变量回归质量指标，输出点值与置信区间"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "化验样本稀疏（每日 3—6 条），需半监督与机理约束"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "质量卡边多出 0.3—0.6 个百分点收率，回炼减少"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "样本稀疏、分析滞后，区间可信度比点精度更难做"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>柴油加氢精制的产品质量有三条硬线：闪点（需 ≥55 ℃，太高说明轻组分被过度拔走）、倾点（需 ≤0 ℃，反映重馏分与蜡含量）、硫含量（需 &lt;10 ppm，取决于反应深度）。这三项都没法用仪表直接测，只能取样送化验室：采样 10 min、样品输送 20—30 min、分析 2—4 h，合计 <b>3—5 h</b> 的滞后。一个班 8 h 只取 1 次样，等于 8 h 里装置都在「盲操」，等闪点报出 52 ℃ 时，不合格柴油已经进了调合罐，回炼一次损失 10—30 万元。</p><p>在线分析仪是另一条路，但代价高：一台在线闪点仪 80—150 万元、在线硫分析仪 120—200 万元，单套装置配齐要数百万元，且维护量大——采样预处理管线易堵、标定每月一次，实际投用率常年在 70%—85%。多数炼厂只在关键装置配一两台，其余靠化验。</p><p>软测量的数据基础是有的：反应温度 340—370 ℃、氢分压、氢油比、进料量、循环氢纯度、床层温升等 1 s 级过程变量，与三个质量指标有明确的物理关联——闪点主要由分馏塔切割点与汽提塔操作决定，倾点与反应深度和重馏分含量相关，硫含量与反应温度、氢分压、空速直接挂钩。问题在于标签太稀疏：每天 3—6 条化验，3 年累计约 <b>3,300 条</b>，且化验时刻与过程变量要对齐到同一股物料，还要扣掉 3—5 h 的分析滞后。</p><p>硬约束：① 必须给区间而不是点值——质量控制要的是「P10 下界是否已接近卡边」，只给点估计会让操作员误判；② 模型在工况切换（换原料、改负荷、催化剂再生）后 1—2 h 内不可信，必须自动降级；③ 输出要能追到具体变量——操作员要知道「哪个变量导致闪点偏低」，否则无法处置。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 替换「取样等化验」这一步：以分钟级过程变量为输入（反应温度、氢分压、氢油比、进料量、循环氢纯度、分馏塔各侧线温度与回流量等 18—22 维，含 10—60 min 的滑动统计量），用梯度提升 + 分位数回归（或 MC Dropout 的时序网络）输出闪点、倾点、硫含量的 P10 / P50 / P90。带滞后的化验值只用于训练与校准，不参与实时推理。</p><p>训练的两个关键：一是<b>滞后对齐</b>——化验时间戳要回推到采样时刻（扣掉 20—30 min 输送与 2—4 h 分析），再按物料停留时间对齐到过程变量窗口，否则模型会把「3 h 前的操作」当成「当前操作」；二是<b>半监督与机理约束</b>——化验样本只有 3,300 条，用大量无标签过程数据做预训练与一致性正则，损失里加物理约束（闪点随切割点上升、硫随反应温度上升而下降、倾点随重馏分比例上升），把违反物理方向的解压下去。</p><p>区间校准用保形预测（conformal）：留出最近 6 个月的化验样本做校准集，让 P10—P90 的实际覆盖率贴近 80%；工况切换或模型残差连续超标时，区间自动放大并标注「低置信」。定位是「卡边操作的仪表」：模型给实时值与区间，操作员据此把闪点控制在 55—58 ℃ 的窄带内，而不是留 5 ℃ 的安全余量；是否调整反应温度、分馏塔回流仍由人决定，催化剂再生、原料切换期间系统自动切回「仅监视」。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">过程数据现成，核心工作是把稀疏化验值按滞后回推对齐，并建立区间校准集。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">DCS 过程变量</span><span class=\"cl-s\">反应温度、氢分压、氢油比、进料量、循环氢纯度、分馏侧线温度，1 s 采集</span></span><span class=\"cl-n\">无需标注，聚合为 1 min 均值 + 滑窗统计</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">化验质量数据</span><span class=\"cl-s\">闪点、倾点、硫含量，每班 1 次，3 年约 3,300 条</span></span><span class=\"cl-n\">按采样时刻回推，扣 3—5 h 分析滞后</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">在线分析仪数据</span><span class=\"cl-s\">若配置闪点 / 硫分析仪，1 h 一次</span></span><span class=\"cl-n\">作为交叉校验，不直接作标签</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">工况与事件</span><span class=\"cl-s\">原料切换、负荷调整、催化剂再生、开停车</span></span><span class=\"cl-n\">事件级标注，用于分段与降级</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">产品标准与内控</span><span class=\"cl-s\">闪点 ≥55 ℃、倾点 ≤0 ℃、硫 &lt;10 ppm 及内控窄带</span></span><span class=\"cl-n\">卡边控制的边界条件</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">样本稀疏与化验滞后是硬伤，区间可信度比点估计精度更难做。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"\"></i></div><p>难度 <b>中</b>。挑战排序：① 标签稀疏且滞后——每天 3—6 条，模型很容易把「不同工况混在一起」学成平均关系，且滞后对齐错 1 h 就足以让模型学到错误因果；② 区间校准——点预测误差 1.2 ℃ 看起来不错，但工况切换后误差会到 3 ℃ 以上，固定宽度的区间会严重欠覆盖；③ 漂移——催化剂活性下降、换热器结垢会让同样的操作条件产出不同质量，模型需按月校正。</p><p>评估建议：点估计 MAE 闪点 ≤1.5 ℃、倾点 ≤1.2 ℃、硫 ≤1.2 ppm；区间覆盖率 75%—85%（标称 80%）；另报「工况切换后 2 h 内」的分层误差，这一段是卡边控制最不敢用的时段。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">软测量<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">半监督回归<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">不确定度估计<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">机理约束<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "某 220 万吨/年柴油加氢装置的闪点与倾点软测量",
        "lead": [
          "装置处理能力 220 万吨/年（260 t/h），反应温度 340—370 ℃、氢分压 6.5—8.0 MPa、氢油比 300—450；产品闪点内控 55—62 ℃、倾点 ≤0 ℃、硫 <10 ppm。化验每班 1 次，3 年 3,280 条，采样到出结果滞后 3—5 h。",
          "项目用 20 维过程变量训练分位数软测量模型，保形预测校准区间。目标：闪点 MAE ≤1.5 ℃、80% 区间覆盖 75%—85%，卡边合格率提升且回炼次数下降 40%。"
        ],
        "stats": [
          [
            "加工能力",
            "220 万吨/年"
          ],
          [
            "过程变量",
            "20 维 / 1 s"
          ],
          [
            "化验样本",
            "3,280 条"
          ],
          [
            "分析滞后",
            "3—5 h"
          ],
          [
            "推理刷新",
            "1 min"
          ],
          [
            "闪点目标误差",
            "≤1.5 ℃"
          ]
        ],
        "steps": [
          {
            "name": "滞后回推对齐",
            "role": "数据",
            "do": "把每条化验记录的时间戳回推：扣掉样品输送 20—30 min 与分析 2—4 h，得到真实采样时刻，再按分馏塔停留时间对齐到过程变量的 10—60 min 窗口。",
            "effect": "有效对齐样本 3,050 条，对齐前后闪点误差差 1.1 ℃",
            "trap": "直接用化验出结果时间对齐——整体错位 3—5 h，模型学到的是「几小时前的操作决定现在的质量」，上线后完全反向"
          },
          {
            "name": "工况分段与特征",
            "role": "数据",
            "do": "按原料切换、负荷档（80% / 100%）、催化剂再生切分 214 段，剔除开停车与仪表故障段；构造 20 维特征含 10 / 30 / 60 min 滑窗均值与标准差。",
            "effect": "可用样本 2,860 条，覆盖 6 种原料",
            "trap": "不分工况混训——轻质与重质原料的闪点基线差 6 ℃，混在一起模型只能学到中间值，两头都不准"
          },
          {
            "name": "半监督分位数模型",
            "role": "算法核心",
            "do": "用 2.86 万条无标签过程数据做预训练，再以 2,860 条标签微调分位数头（τ = 0.1 / 0.5 / 0.9），损失加物理约束：闪点随切割点单调上升、硫随反应温度上升而下降。",
            "effect": "闪点 MAE 1.3 ℃，倾点 1.1 ℃，硫 0.9 ppm",
            "trap": "只用标签样本训练——3,000 条覆盖不了 3 年工况，换原料后误差立刻翻倍"
          },
          {
            "name": "区间校准",
            "role": "算法核心",
            "do": "留最近 6 个月化验样本做保形校准，按工况分组校正 P10—P90 宽度；残差连续 3 点超 2 倍标准差时区间放大 1.5 倍并标「低置信」。",
            "effect": "80% 区间实测覆盖 78%，工况切换段覆盖 74%",
            "trap": "用训练集残差直接定区间——训练集误差偏小，上线后覆盖率只有 62%，卡边控制据此操作会频繁越线"
          },
          {
            "name": "卡边控制接口",
            "role": "推理",
            "do": "实时输出闪点 P50 与 P10，操作员按「P10 ≥ 55.5 ℃」控制，目标带从 55—62 ℃ 收窄到 55.5—58 ℃；硫按 P90 卡 9.5 ppm 留余量。",
            "effect": "闪点平均值从 59.8 降到 57.2 ℃，柴油收率 +0.4 个百分点",
            "trap": "按 P50 卡边——一半时间会低于内控线，越线批次全部回炼，收益被吃光"
          },
          {
            "name": "漂移监控与月校正",
            "role": "工程环节",
            "do": "每月用新化验做输出侧加性校正，监控残差均值漂移；催化剂活性下降超 5 个单位或换热器结垢报警时触发重训，切换期间系统降级为「仅监视」。",
            "effect": "连续 9 个月 MAE 保持在 1.5 ℃ 内，回炼次数下降 43%",
            "trap": "模型上线后不再校正——催化剂跑损后同样操作温度下硫含量系统性偏高 1.5 ppm，模型却毫无察觉"
          }
        ],
        "metrics": {
          "title": "怎么算「软测量敢用于卡边」",
          "html": "<p>反直觉的陷阱：点估计 MAE 1.3 ℃ 已经不错，但真正决定能不能卡边的是<b>区间</b>——如果 P10 实际覆盖只有 62%，按它卡边就会有近四成时间越线，回炼损失远大于卡边多出的收率。另一个陷阱是拿全时段覆盖率汇报：工况稳定段覆盖 85%、切换段只有 60%，平均下来 78% 很好看，而切换段恰恰是最容易出不合格品的时段。区间必须<b>按工况分层报覆盖率</b>，并在切换期主动放大宽度。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>化验滞后基线</th><th>本方案</th></tr></thead><tbody><tr><td>闪点 MAE</td><td>对留出 6 个月化验</td><td>—</td><td>1.3 ℃</td></tr><tr><td>倾点 MAE</td><td>同上</td><td>—</td><td>1.1 ℃</td></tr><tr><td>硫含量 MAE</td><td>同上</td><td>—</td><td>0.9 ppm</td></tr><tr><td>区间覆盖率</td><td>标称 80% 的实测</td><td>—</td><td>78%（稳定段 85%）</td></tr><tr><td>质量可见时延</td><td>调整到可见结果</td><td>3—5 h</td><td>1 min</td></tr><tr><td>回炼次数</td><td>年度</td><td>基准 100</td><td>57</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "化验滞后未回推导致因果倒置",
            "why": "用出结果时间配对过程变量，模型学的是几小时前的工况，实时推理时给出的是「过去的质量」。解决：时间戳回推 + 物料停留对齐，对齐后用已知阶跃试验验证方向性。"
          },
          {
            "name": "区间宽度用训练残差定",
            "why": "训练集误差天然偏小，上线后覆盖率骤降，卡边操作频繁越线。解决：独立校准集 + 保形预测，按工况分组校准，切换期主动放大。"
          },
          {
            "name": "工况切换后仍按原模型卡边",
            "why": "换原料或催化剂再生后 2 h 内误差翻倍，模型却照常输出窄区间。解决：事件触发降级为「仅监视」，2 h 后重新校准再恢复卡边建议。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "/* ========= 柴油质量指标在线软测量 ========= */\n* { box-sizing: border-box; }\nhtml, body { margin: 0; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #f5f4ef;\n  color: #242b2e;\n  font-size: 12px;\n  padding: 10px 12px;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n.panel { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\n.data-note {\n  font-size: 10.5px; color: #8a9298; margin: 0 0 6px; line-height: 1.5;\n  border-left: 3px solid #c9a15a; padding-left: 8px;\n}\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 3px; color: #2f7d6b; letter-spacing: .3px; }\n.lead { color: #4d565b; font-size: 11.5px; margin: 0 0 8px; max-width: none; }\n\n.section { background: #fff; border: 1px solid #e6e0d2; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }\n.section h2 { font-size: 12.5px; font-weight: 600; margin: 0 0 4px; color: #2f7d6b; }\n.hint { font-size: 10.5px; color: #79828a; margin: 4px 0 0; line-height: 1.45; }\n\nsvg { display: block; width: 100%; max-width: 100%; height: auto; background: #fdfcf8; border-radius: 6px; }\n\n/* 图表显示尺寸收敛：避免在宽 viz 列里被放大得过高 */\n.viz > .section > svg { max-width: 480px; margin-left: auto; margin-right: auto; }\n\n.legend { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 10px; color: #5d666d; margin-top: 4px; }\n.legend span { display: flex; align-items: center; gap: 4px; }\n.legend i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }\n\n.metric-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }\n.metric { background: #f5f2ea; border-radius: 7px; padding: 6px 8px; display: flex; flex-direction: column; gap: 1px; }\n.metric span { font-size: 10.5px; color: #79828a; }\n.metric b { font-family: ui-monospace, Consolas, monospace; font-size: 15px; color: #2f7d6b; font-weight: 600; line-height: 1.25; }\n.metric.warn b { color: #c9a15a; }\n.metric.bad b { color: #b05a51; }\n\n.controls { display: grid; grid-template-columns: 1fr !important; gap: 6px; }\n.ctl { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; background: #f5f2ea; border-radius: 7px; min-width: 0; }\n.ctl-top { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }\n.ctl label { font-size: 10.5px; font-weight: 500; color: #3c4448; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.ctl output { font-family: ui-monospace, Consolas, monospace; color: #2f7d6b; font-weight: 600; font-size: 10.5px; white-space: nowrap; }\n.ctl input[type=\"range\"] { width: 100%; margin: 2px 0 0; accent-color: #2f7d6b; height: 14px; }\n\n.table-wrap { max-height: 170px; overflow: auto; margin-top: 4px; border: 1px solid #efece1; border-radius: 6px; }\ntable { width: 100%; border-collapse: collapse; font-size: 10.5px; }\nth { position: sticky; top: 0; z-index: 1; background: #f5f2ea; padding: 4px 6px; text-align: left; font-weight: 600; font-size: 9.5px; color: #4d565b; white-space: nowrap; }\ntd { padding: 3px 6px; border-bottom: 1px solid #f2efe5; white-space: nowrap; }\ntr:last-child td { border-bottom: none; }\ntr:hover td { background: #faf8f2; }\n.mono { font-family: ui-monospace, Consolas, monospace; }\n.ok { color: #2f7d6b; font-weight: 600; }\n.no { color: #b05a51; font-weight: 600; }\n\n/* ===== 方案对比面板 ===== */\n.compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }\n.compare-col { background: #f9f7f0; border: 1px solid #e9e4d8; border-radius: 8px; padding: 8px 10px; }\n.compare-col.rec { border-color: #2f7d6b; background: #f1f7f4; }\n.compare-col h3 { font-size: 11.5px; margin: 0 0 6px; color: #2f7d6b; }\n.compare-col.rec h3 { color: #235f51; }\n.compare-col .metric { background: #fff; border-radius: 6px; padding: 5px 8px; margin-bottom: 5px; display: flex; flex-direction: column; gap: 1px; }\n.compare-col .metric span { font-size: 10px; color: #79828a; }\n.compare-col .metric b { font-family: ui-monospace, Consolas, monospace; font-size: 14px; color: #2f7d6b; font-weight: 600; }\n.compare-actions { margin-top: 8px; display: flex; gap: 8px; }\n.compare-actions button { padding: 5px 10px; border-radius: 6px; border: 1px solid #2f7d6b; background: #2f7d6b; color: #fff; cursor: pointer; font-size: 11px; }\n.compare-actions button:hover { background: #235f51; }\n.compare-actions button.secondary { background: #fff; color: #2f7d6b; }\n.compare-actions button.secondary:hover { background: #f1f7f4; }\n\n@media (max-width: 720px) {\n  body { padding: 8px 10px; }\n  .layout { grid-template-columns: 1fr; }\n  .side { position: static; }\n  .controls { grid-template-columns: 1fr; }\n  .metric-row { grid-template-columns: 1fr 1fr; }\n}\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 柴油质量指标在线软测量 ======= */\n(function () {\n  'use strict';\n\n  var N = 720;              // 2 min / 点\n  var HOURS = 24;\n  var STEP = HOURS / N;\n  var FP_LOW = 55, FP_HIGH = 62;\n\n  var PARAMS = [\n    { id: 'temp', label: '反应温度', unit: '℃', min: 335, max: 375, step: 1, value: 355 },\n    { id: 'h2', label: '氢分压', unit: 'MPa', min: 6.0, max: 8.5, step: 0.1, value: 7.2 },\n    { id: 'cut', label: '分馏切割点', unit: '℃', min: 255, max: 285, step: 1, value: 268 },\n    { id: 'load', label: '装置负荷', unit: '%', min: 70, max: 110, step: 1, value: 100 },\n    { id: 'lag', label: '化验滞后', unit: 'h', min: 1, max: 6, step: 0.5, value: 4 },\n    { id: 'margin', label: '控制余量', unit: '℃', min: 1, max: 6, step: 0.5, value: 5 },\n    { id: 'switch', label: '工况切换', unit: '', kind: 'toggle', labels: ['稳定', '切换中'], min: 0, max: 1, step: 1, value: 0 },\n    { id: 'calib', label: '保形校准', unit: '', kind: 'toggle', labels: ['关闭', '开启'], min: 0, max: 1, step: 1, value: 1 },\n    { id: 'model', label: '软测量模型', unit: '', kind: 'toggle', labels: ['关闭', '开启'], min: 0, max: 1, step: 1, value: 1 }\n  ];\n\n  var DEFAULTS = {};\n  PARAMS.forEach(function (p) { DEFAULTS[p.id] = p.value; });\n  var S = {};\n  Object.keys(DEFAULTS).forEach(function (k) { S[k] = DEFAULTS[k]; });\n\n  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }\n\n  function mulberry32(seed) {\n    return function () {\n      seed |= 0; seed = seed + 0x6D2B79F5 | 0;\n      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);\n      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;\n      return ((t ^ t >>> 14) >>> 0) / 4294967296;\n    };\n  }\n  function gauss(rnd) {\n    var u = 0, v = 0;\n    while (u === 0) u = rnd();\n    while (v === 0) v = rnd();\n    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);\n  }\n  function hhmm(h) {\n    var hh = Math.floor(h + 1e-9);\n    var mm = Math.round((h - hh) * 60);\n    if (mm === 60) { hh += 1; mm = 0; }\n    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;\n  }\n\n  /* ================= 仿真：过程变量 → 真值 → 软测量 ================= */\n  function simulate(st) {\n    var rnd = mulberry32(20261031);\n    var i, h;\n\n    var temp = new Float64Array(N), cut = new Float64Array(N);\n    var fpTrue = new Float64Array(N);\n    var p50 = new Float64Array(N), p10 = new Float64Array(N), p90 = new Float64Array(N);\n    var hasModel = !!st.model;\n\n    for (i = 0; i < N; i++) {\n      h = i * STEP;\n      temp[i] = st.temp + 2.2 * Math.sin(2 * Math.PI * h / 6.4 + 0.4) + gauss(rnd) * 0.5;\n      cut[i] = st.cut + 2.6 * Math.sin(2 * Math.PI * h / 5.1 + 1.3) + gauss(rnd) * 0.4;\n\n      var drift = 0.45 * Math.sin(2 * Math.PI * h / 9 + 0.6) + 0.30 * Math.sin(2 * Math.PI * h / 4.3 + 2.1);\n      var bump = st.switch ? 2.2 * Math.exp(-Math.pow((h - 9.5) / 1.15, 2)) : 0;\n\n      fpTrue[i] = 57 + 0.22 * (st.cut - 268) + 0.05 * (st.temp - 355) + 0.06 * (st.load - 100)\n        + drift + bump + gauss(rnd) * 0.12;\n\n      if (hasModel) {\n        var sg = 0.55 + 0.18 * (st.lag - 1) + (st.switch ? 0.95 * Math.exp(-Math.pow((h - 10.5) / 1.6, 2)) : 0);\n        p50[i] = fpTrue[i] + 0.25 * Math.sin(2 * Math.PI * h / 7 + 2) + gauss(rnd) * sg;\n        var w = st.calib ? 1.28 * sg : 1.15;\n        p10[i] = p50[i] - w;\n        p90[i] = p50[i] + w;\n      }\n    }\n\n    // 化验样本：每 8 h 一次，报出滞后 st.lag 小时\n    var labs = [1, 9, 17].map(function (sampleH) {\n      var idx = Math.round(sampleH / STEP);\n      return {\n        idx: idx, sampleH: sampleH, resultH: sampleH + st.lag,\n        val: fpTrue[idx] + gauss(rnd) * 0.7\n      };\n    });\n\n    // 指标\n    var mae = null, cov = null, inCtrl = 0;\n    if (hasModel) {\n      var sumAbs = 0, inBand = 0;\n      for (i = 0; i < N; i++) {\n        sumAbs += Math.abs(p50[i] - fpTrue[i]);\n        if (fpTrue[i] >= p10[i] && fpTrue[i] <= p90[i]) inBand++;\n      }\n      mae = sumAbs / N;\n      cov = inBand / N * 100;\n    }\n    for (i = 0; i < N; i++) if (fpTrue[i] >= FP_LOW && fpTrue[i] <= FP_HIGH) inCtrl++;\n\n    return {\n      temp: temp, cut: cut, fpTrue: fpTrue,\n      p50: p50, p10: p10, p90: p90,\n      labs: labs, hasModel: hasModel,\n      mae: mae, cov: cov, pass: inCtrl / N * 100,\n      delay: hasModel ? 0 : st.lag\n    };\n  }\n\n  /* ================= 绘图 ================= */\n  function drawTrend(st, d) {\n    var svg = document.getElementById('trend');\n    var W = 430, H = 170, padL = 34, padR = 34, padT = 14, padB = 20;\n    var plotW = W - padL - padR, plotH = H - padT - padB;\n\n    function xOf(h) { return padL + h / HOURS * plotW; }\n    function yT(v) { return padT + (1 - (v - 335) / 40) * plotH; }\n    function yC(v) { return padT + (1 - (v - 255) / 30) * plotH; }\n\n    var s = '<rect x=\"0\" y=\"0\" width=\"' + W + '\" height=\"' + H + '\" fill=\"#fdfcf8\" rx=\"6\"/>';\n\n    if (st.switch) {\n      s += '<rect x=\"' + xOf(9) + '\" y=\"' + padT + '\" width=\"' + (xOf(11) - xOf(9)) + '\" height=\"' + plotH + '\" fill=\"rgba(201,161,90,0.12)\"/>';\n      s += '<text x=\"' + ((xOf(9) + xOf(11)) / 2) + '\" y=\"' + (padT + 10) + '\" font-size=\"8\" fill=\"#a97a1c\" text-anchor=\"middle\">切换</text>';\n    }\n\n    [340, 350, 360, 370].forEach(function (v) {\n      var y = yT(v);\n      s += '<line x1=\"' + padL + '\" y1=\"' + y + '\" x2=\"' + (padL + plotW) + '\" y2=\"' + y + '\" stroke=\"#ece7d8\"/>';\n      s += '<text x=\"' + (padL - 5) + '\" y=\"' + (y + 3) + '\" font-size=\"7.5\" fill=\"#2f7d6b\" text-anchor=\"end\" font-family=\"monospace\">' + v + '</text>';\n    });\n    [260, 270, 280].forEach(function (v) {\n      var y = yC(v);\n      s += '<text x=\"' + (padL + plotW + 5) + '\" y=\"' + (y + 3) + '\" font-size=\"7.5\" fill=\"#c9a15a\" text-anchor=\"start\" font-family=\"monospace\">' + v + '</text>';\n    });\n    [0, 6, 12, 18, 24].forEach(function (h) {\n      var x = xOf(h);\n      s += '<text x=\"' + x + '\" y=\"' + (H - 7) + '\" font-size=\"7.5\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">' + h + '</text>';\n    });\n\n    var pathT = '', pathC = '';\n    for (var i = 0; i < N; i += 3) {\n      pathT += (i ? 'L' : 'M') + xOf(i * STEP).toFixed(1) + ' ' + yT(d.temp[i]).toFixed(1) + ' ';\n      pathC += (i ? 'L' : 'M') + xOf(i * STEP).toFixed(1) + ' ' + yC(d.cut[i]).toFixed(1) + ' ';\n    }\n    s += '<path d=\"' + pathT + '\" fill=\"none\" stroke=\"#2f7d6b\" stroke-width=\"1.6\"/>';\n    s += '<path d=\"' + pathC + '\" fill=\"none\" stroke=\"#c9a15a\" stroke-width=\"1.3\" stroke-dasharray=\"5 3\"/>';\n\n    s += '<text x=\"' + padL + '\" y=\"' + (padT - 4) + '\" font-size=\"7.5\" fill=\"#2f7d6b\" font-family=\"monospace\">反应温度 ℃</text>';\n    s += '<text x=\"' + (padL + plotW) + '\" y=\"' + (padT - 4) + '\" font-size=\"7.5\" fill=\"#c9a15a\" text-anchor=\"end\" font-family=\"monospace\">切割点 ℃</text>';\n    s += '<text x=\"' + (padL + plotW / 2) + '\" y=\"' + (H - 1) + '\" font-size=\"8\" fill=\"#9ba3a9\" text-anchor=\"middle\">时刻 h</text>';\n\n    svg.innerHTML = s;\n  }\n\n  function drawQuality(st, d) {\n    var svg = document.getElementById('quality');\n    var W = 430, H = 210, padL = 34, padR = 12, padT = 12, padB = 22;\n    var plotW = W - padL - padR, plotH = H - padT - padB;\n\n    var lo = 54.5, hi = 62.5;\n    for (var i = 0; i < N; i++) {\n      lo = Math.min(lo, d.fpTrue[i]);\n      hi = Math.max(hi, d.fpTrue[i]);\n      if (d.hasModel) { lo = Math.min(lo, d.p10[i]); hi = Math.max(hi, d.p90[i]); }\n    }\n    lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5);\n    if (hi - lo < 4) hi = lo + 4;\n\n    function xOf(h) { return padL + h / HOURS * plotW; }\n    function yOf(v) { return padT + (1 - (clamp(v, lo, hi) - lo) / (hi - lo)) * plotH; }\n\n    var s = '<rect x=\"0\" y=\"0\" width=\"' + W + '\" height=\"' + H + '\" fill=\"#fdfcf8\" rx=\"6\"/>';\n\n    // 内控窗口\n    s += '<rect x=\"' + padL + '\" y=\"' + yOf(FP_HIGH) + '\" width=\"' + plotW + '\" height=\"' + Math.max(0, yOf(FP_LOW) - yOf(FP_HIGH)) + '\" fill=\"rgba(47,125,107,0.10)\"/>';\n\n    // 操作控制目标（下限 + 余量），余量越大越保守\n    var tgt = FP_LOW + st.margin;\n    if (tgt < hi) {\n      s += '<line x1=\"' + padL + '\" y1=\"' + yOf(tgt) + '\" x2=\"' + (padL + plotW) + '\" y2=\"' + yOf(tgt) + '\" stroke=\"#c9a15a\" stroke-width=\"1\" stroke-dasharray=\"2 3\" opacity=\"0.85\"/>';\n      s += '<text x=\"' + (padL + 4) + '\" y=\"' + (yOf(tgt) - 3) + '\" font-size=\"7.5\" fill=\"#a97a1c\" font-family=\"monospace\">控制目标 ≥' + tgt.toFixed(1) + '</text>';\n    }\n\n    // 网格与纵轴\n    var step = hi - lo <= 4 ? 1 : hi - lo <= 8 ? 2 : 4;\n    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {\n      var y = yOf(v);\n      s += '<line x1=\"' + padL + '\" y1=\"' + y + '\" x2=\"' + (padL + plotW) + '\" y2=\"' + y + '\" stroke=\"#ece7d8\"/>';\n      s += '<text x=\"' + (padL - 5) + '\" y=\"' + (y + 3) + '\" font-size=\"7.5\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">' + v + '</text>';\n    }\n    [0, 6, 12, 18, 24].forEach(function (h) {\n      var x = xOf(h);\n      s += '<text x=\"' + x + '\" y=\"' + (H - 7) + '\" font-size=\"7.5\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">' + h + '</text>';\n    });\n\n    // 上下限\n    s += '<line x1=\"' + padL + '\" y1=\"' + yOf(FP_LOW) + '\" x2=\"' + (padL + plotW) + '\" y2=\"' + yOf(FP_LOW) + '\" stroke=\"#b05a51\" stroke-width=\"1\" stroke-dasharray=\"5 3\"/>';\n    s += '<text x=\"' + (padL + plotW - 4) + '\" y=\"' + (yOf(FP_LOW) - 3) + '\" font-size=\"7.5\" fill=\"#b05a51\" text-anchor=\"end\" font-family=\"monospace\">下限 55</text>';\n    s += '<line x1=\"' + padL + '\" y1=\"' + yOf(FP_HIGH) + '\" x2=\"' + (padL + plotW) + '\" y2=\"' + yOf(FP_HIGH) + '\" stroke=\"#c9a15a\" stroke-width=\"1\" stroke-dasharray=\"5 3\"/>';\n    s += '<text x=\"' + (padL + plotW - 4) + '\" y=\"' + (yOf(FP_HIGH) - 3) + '\" font-size=\"7.5\" fill=\"#a97a1c\" text-anchor=\"end\" font-family=\"monospace\">内控 62</text>';\n\n    // 真值\n    var pathT = '';\n    for (var i2 = 0; i2 < N; i2 += 3) pathT += (i2 ? 'L' : 'M') + xOf(i2 * STEP).toFixed(1) + ' ' + yOf(d.fpTrue[i2]).toFixed(1) + ' ';\n    s += '<path d=\"' + pathT + '\" fill=\"none\" stroke=\"#242b2e\" stroke-width=\"1.1\" stroke-dasharray=\"3 2\" opacity=\"0.75\"/>';\n\n    if (d.hasModel) {\n      // P10—P90 区间\n      var band = '';\n      for (var i3 = 0; i3 < N; i3 += 3) band += (i3 ? 'L' : 'M') + xOf(i3 * STEP).toFixed(1) + ' ' + yOf(d.p90[i3]).toFixed(1) + ' ';\n      for (var i4 = N - 1; i4 >= 0; i4 -= 3) band += 'L' + xOf(i4 * STEP).toFixed(1) + ' ' + yOf(d.p10[i4]).toFixed(1) + ' ';\n      s += '<path d=\"' + band + 'Z\" fill=\"rgba(47,125,107,0.18)\" stroke=\"none\"/>';\n\n      var pathP = '';\n      for (var i5 = 0; i5 < N; i5 += 3) pathP += (i5 ? 'L' : 'M') + xOf(i5 * STEP).toFixed(1) + ' ' + yOf(d.p50[i5]).toFixed(1) + ' ';\n      s += '<path d=\"' + pathP + '\" fill=\"none\" stroke=\"#2f7d6b\" stroke-width=\"1.6\"/>';\n    } else {\n      s += '<text x=\"' + (padL + plotW / 2) + '\" y=\"' + (padT + 24) + '\" font-size=\"9.5\" fill=\"#b05a51\" text-anchor=\"middle\">软测量关闭：只能看到滞后报出的化验点</text>';\n    }\n\n    // 化验点：采样（空心）→ 报出（实心）\n    d.labs.forEach(function (lab) {\n      var x0 = xOf(lab.sampleH), y0 = yOf(lab.val);\n      var x1 = xOf(Math.min(HOURS, lab.resultH)), y1 = y0;\n      s += '<line x1=\"' + x0 + '\" y1=\"' + y0 + '\" x2=\"' + x1 + '\" y2=\"' + y1 + '\" stroke=\"#c9a15a\" stroke-width=\"1\" stroke-dasharray=\"3 2\"/>';\n      s += '<circle cx=\"' + x0 + '\" cy=\"' + y0 + '\" r=\"3\" fill=\"#fdfcf8\" stroke=\"#c9a15a\" stroke-width=\"1.4\"/>';\n      s += '<circle cx=\"' + x1 + '\" cy=\"' + y1 + '\" r=\"3.2\" fill=\"#c9a15a\"/>';\n      s += '<text x=\"' + (x0 + 5) + '\" y=\"' + (y0 - 6) + '\" font-size=\"7.5\" fill=\"#a97a1c\" font-family=\"monospace\">' + lab.val.toFixed(1) + '</text>';\n    });\n\n    s += '<text x=\"' + (padL + plotW / 2) + '\" y=\"' + (H - 1) + '\" font-size=\"8\" fill=\"#9ba3a9\" text-anchor=\"middle\">时刻 h</text>';\n    s += '<text x=\"' + padL + '\" y=\"' + (padT - 3) + '\" font-size=\"7.5\" fill=\"#9ba3a9\" font-family=\"monospace\">闪点 ℃</text>';\n\n    svg.innerHTML = s;\n  }\n\n  function drawAttrib(st) {\n    var svg = document.getElementById('attrib');\n    var W = 430, H = 160, padL = 96, padR = 16, padT = 12, padB = 18;\n    var plotW = W - padL - padR, plotH = H - padT - padB;\n\n    var items = [\n      { name: '分馏切割点', v: 0.22 * (st.cut - 268) },\n      { name: '反应温度', v: 0.05 * (st.temp - 355) },\n      { name: '装置负荷', v: 0.06 * (st.load - 100) },\n      { name: '原料切换', v: st.switch ? 0.9 : 0 },\n      { name: '环境 / 催化剂漂移', v: 0.4 }\n    ];\n    var maxAbs = 0.5;\n    items.forEach(function (it) { maxAbs = Math.max(maxAbs, Math.abs(it.v)); });\n\n    var zeroX = padL + 8 + (plotW - 16) / 2;\n    var halfW = (plotW - 16) / 2;\n    var rowH = plotH / items.length;\n\n    var s = '<rect x=\"0\" y=\"0\" width=\"' + W + '\" height=\"' + H + '\" fill=\"#fdfcf8\" rx=\"6\"/>';\n    s += '<line x1=\"' + zeroX + '\" y1=\"' + padT + '\" x2=\"' + zeroX + '\" y2=\"' + (padT + plotH) + '\" stroke=\"#c9c3b4\"/>';\n\n    items.forEach(function (it, i) {\n      var cy = padT + rowH * (i + 0.5);\n      var w = Math.abs(it.v) / maxAbs * (halfW - 4);\n      var x = it.v >= 0 ? zeroX : zeroX - w;\n      var color = it.v >= 0 ? '#b05a51' : '#2f7d6b';\n      s += '<rect x=\"' + x + '\" y=\"' + (cy - 4) + '\" width=\"' + Math.max(1, w) + '\" height=\"8\" rx=\"2\" fill=\"' + color + '\" opacity=\"0.82\"/>';\n      s += '<text x=\"' + (padL - 2) + '\" y=\"' + (cy + 3) + '\" font-size=\"8\" fill=\"#4d565b\" text-anchor=\"end\">' + it.name + '</text>';\n      s += '<text x=\"' + (it.v >= 0 ? x + w + 3 : x - 3) + '\" y=\"' + (cy + 3) + '\" font-size=\"7.5\" fill=\"' + color + '\" font-family=\"monospace\" text-anchor=\"' + (it.v >= 0 ? 'start' : 'end') + '\">' + (it.v >= 0 ? '+' : '') + it.v.toFixed(2) + '</text>';\n    });\n    s += '<text x=\"' + zeroX + '\" y=\"' + (H - 4) + '\" font-size=\"7.5\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">贡献 ℃（相对 57 ℃ 基准）</text>';\n\n    svg.innerHTML = s;\n  }\n\n  function drawMetrics(d) {\n    var maeEl = document.getElementById('m-mae');\n    maeEl.textContent = d.mae === null ? '—' : d.mae.toFixed(2) + ' ℃';\n    var maeW = document.getElementById('m-mae-wrap');\n    maeW.className = 'metric' + (d.mae !== null && d.mae > 1.5 ? ' warn' : '');\n\n    var covEl = document.getElementById('m-cov');\n    covEl.textContent = d.cov === null ? '—' : d.cov.toFixed(0) + '%';\n    var covW = document.getElementById('m-cov-wrap');\n    covW.className = 'metric' + (d.cov !== null && d.cov < 75 ? ' bad' : '');\n\n    var delEl = document.getElementById('m-delay');\n    delEl.textContent = d.hasModel ? '0 min' : d.delay + ' h';\n    delEl.parentElement.className = 'metric' + (d.hasModel ? '' : ' bad');\n\n    var passEl = document.getElementById('m-pass');\n    passEl.textContent = d.pass.toFixed(0) + '%';\n    passEl.parentElement.className = 'metric' + (d.pass < 95 ? ' warn' : '');\n  }\n\n  function drawLabs(d) {\n    var tbody = document.getElementById('lab-body');\n    var html = '';\n    d.labs.forEach(function (lab, i) {\n      var p50 = d.hasModel ? d.p50[lab.idx] : null;\n      var err = p50 === null ? null : p50 - lab.val;\n      var covered = d.hasModel ? (lab.val >= d.p10[lab.idx] && lab.val <= d.p90[lab.idx]) : null;\n      html += '<tr>' +\n        '<td>' + (i + 1) + '</td>' +\n        '<td class=\"mono\">' + hhmm(lab.sampleH) + '</td>' +\n        '<td class=\"mono\">' + lab.val.toFixed(1) + '</td>' +\n        '<td class=\"mono\">' + hhmm(lab.resultH) + '</td>' +\n        '<td class=\"mono\">' + (p50 === null ? '—' : p50.toFixed(1)) + '</td>' +\n        '<td class=\"mono\">' + (err === null ? '—' : (err >= 0 ? '+' : '') + err.toFixed(2)) + '</td>' +\n        '<td class=\"' + (covered === null ? '' : covered ? 'ok' : 'no') + '\">' + (covered === null ? '—' : covered ? '✓' : '✗') + '</td>' +\n        '</tr>';\n    });\n    tbody.innerHTML = html;\n  }\n\n  /* ================= 对比面板 ================= */\n  function renderCompare() {\n    var rec = simulate(Object.assign({}, S, { model: 1, margin: 2 }));\n    var base = 5;   // 基准：化验 + 5 ℃ 安全余量\n    var tight = base - S.margin;                       // 收窄的余量\n    var curYield = Math.max(0, tight * 0.25);          // 卡边多出的收率（pp）\n    var curRe = 2.6 * Math.pow(base / Math.max(1, S.margin), 0.55);  // 无实时值，余量越小回炼越多\n    var recYield = rec.cov !== null && rec.cov >= 75 ? 0.75 : 0;\n    var recRe = recYield ? 0.9 : 2.6;\n\n    var head = document.getElementById('c-cur-head');\n    if (head) head.textContent = '当前（化验 + ' + S.margin + ' ℃ 余量）';\n\n    document.getElementById('c-cur-delay').textContent = S.lag + ' h';\n    document.getElementById('c-cur-cov').textContent = '—';\n    document.getElementById('c-cur-yield').textContent = curYield.toFixed(2) + ' pp';\n    document.getElementById('c-cur-re').textContent = curRe.toFixed(1) + ' 次';\n\n    document.getElementById('c-rec-delay').textContent = '0 min';\n    document.getElementById('c-rec-cov').textContent = rec.cov === null ? '—' : rec.cov.toFixed(0) + '%';\n    document.getElementById('c-rec-yield').textContent = recYield.toFixed(2) + ' pp';\n    document.getElementById('c-rec-re').textContent = recRe.toFixed(1) + ' 次';\n  }\n\n  /* ================= 控件与主循环 ================= */\n  function outText(p) {\n    if (p.kind === 'toggle') return p.labels[S[p.id] ? 1 : 0];\n    return String(S[p.id]);\n  }\n\n  function buildControls() {\n    var wrap = document.getElementById('controls');\n    wrap.innerHTML = PARAMS.map(function (p) {\n      return '<div class=\"ctl\">' +\n        '<div class=\"ctl-top\"><label>' + p.label + (p.unit ? ' (' + p.unit + ')' : '') + '</label>' +\n        '<output id=\"o-' + p.id + '\">' + outText(p) + '</output></div>' +\n        '<input type=\"range\" id=\"s-' + p.id + '\" min=\"' + p.min + '\" max=\"' + p.max + '\" step=\"' + p.step + '\" value=\"' + p.value + '\">' +\n        '</div>';\n    }).join('');\n\n    PARAMS.forEach(function (p) {\n      var el = document.getElementById('s-' + p.id);\n      var out = document.getElementById('o-' + p.id);\n      el.addEventListener('input', function (e) {\n        S[p.id] = +e.target.value;\n        out.textContent = outText(p);\n        run();\n      });\n    });\n  }\n\n  function syncControls() {\n    PARAMS.forEach(function (p) {\n      var el = document.getElementById('s-' + p.id);\n      var out = document.getElementById('o-' + p.id);\n      if (el) { el.value = S[p.id]; out.textContent = outText(p); }\n    });\n  }\n\n  function run() {\n    var d = simulate(S);\n    drawTrend(S, d);\n    drawQuality(S, d);\n    drawAttrib(S);\n    drawMetrics(d);\n    drawLabs(d);\n    renderCompare();\n    var lagTxt = document.getElementById('lag-txt');\n    if (lagTxt) lagTxt.textContent = S.lag;\n  }\n\n  function applyRecommended() {\n    S.model = 1; S.calib = 1; S.margin = 2;\n    syncControls();\n    run();\n  }\n\n  buildControls();\n  run();\n\n  document.getElementById('btn-apply-rec').addEventListener('click', applyRecommended);\n  document.getElementById('btn-cur').addEventListener('click', renderCompare);\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>柴油质量指标在线软测量</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n\n  <p class=\"data-note\">数据口径：柴油闪点硬线 ≥55 ℃、内控窄带 55—62 ℃；倾点 ≤0 ℃；硫含量 &lt;10 ppm。化验每班 1 次，采样→化验→报出合计 3—5 h；过程变量 1 s 采集、聚合为 1 min。参考 GB 19147、NB/SH/T 0606。</p>\n\n  <h1>柴油质量指标在线软测量</h1>\n  <p class=\"lead\">调节反应温度、氢分压、分馏切割点与装置负荷，观察闪点真值、软测量 P50 与 P10—P90 区间。打开「工况切换」可看到模型在 1—2 h 内误差放大、保形区间自动放宽；关闭软测量则退回「每班一次化验」的滞后状态。</p>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n\n      <div class=\"section\">\n        <h2>① 过程变量趋势（24 h）</h2>\n        <svg id=\"trend\" viewBox=\"0 0 430 170\" role=\"img\" aria-label=\"反应温度与分馏切割点趋势\"></svg>\n        <p class=\"hint\">实线为反应温度（左轴），虚线为分馏塔切割点（右轴）；灰色带为原料切换后的过渡窗口，这一段过程变量尚未稳定。</p>\n      </div>\n\n      <div class=\"section\">\n        <h2>② 闪点跟踪：真值 · 软测量 · 化验</h2>\n        <svg id=\"quality\" viewBox=\"0 0 430 210\" role=\"img\" aria-label=\"闪点跟踪曲线\"></svg>\n        <div class=\"legend\">\n          <span><i style=\"background:#242b2e\"></i>真值</span>\n          <span><i style=\"background:#2f7d6b\"></i>软测量 P50</span>\n          <span><i style=\"background:rgba(47,125,107,0.22)\"></i>P10—P90</span>\n          <span><i style=\"background:#c9a15a\"></i>化验样本</span>\n        </div>\n        <p class=\"hint\">浅绿带为 55—62 ℃ 内控窗口；空心点为采样时刻，实心点为化验报出时刻（滞后 <b id=\"lag-txt\">4</b> h），虚线连接两点即「信息迟到」的时长。</p>\n      </div>\n\n      <div class=\"section\">\n        <h2>③ 变量归因（对闪点预测的贡献）</h2>\n        <svg id=\"attrib\" viewBox=\"0 0 430 160\" role=\"img\" aria-label=\"变量归因条形图\"></svg>\n        <p class=\"hint\">向右为正贡献（抬高清点）、向左为负贡献；软测量必须能追到具体变量，操作员才知道该动哪一个。</p>\n      </div>\n\n      <div class=\"section\">\n        <h2>④ 评价指标</h2>\n        <div class=\"metric-row\">\n          <div class=\"metric\" id=\"m-mae-wrap\"><span>闪点 MAE</span><b id=\"m-mae\">—</b></div>\n          <div class=\"metric\" id=\"m-cov-wrap\"><span>80% 区间覆盖率</span><b id=\"m-cov\">—</b></div>\n          <div class=\"metric\" id=\"m-delay-wrap\"><span>超标发现延迟</span><b id=\"m-delay\">—</b></div>\n          <div class=\"metric\" id=\"m-pass-wrap\"><span>内控合格率</span><b id=\"m-pass\">—</b></div>\n        </div>\n        <p class=\"hint\">覆盖率标称 80%，低于 75% 说明区间偏窄、卡边操作会踩线；依靠化验时延迟等于整个分析周期。</p>\n      </div>\n\n      <div class=\"section\">\n        <h2>⑤ 化验对账</h2>\n        <div class=\"table-wrap\">\n          <table>\n            <thead><tr><th>#</th><th>采样时刻</th><th>化验闪点 (℃)</th><th>报出时刻</th><th>软测量 P50</th><th>误差 (℃)</th><th>区间覆盖</th></tr></thead>\n            <tbody id=\"lab-body\"></tbody>\n          </table>\n        </div>\n        <p class=\"hint\">化验值本身带有 ±0.7 ℃ 分析误差，故与 P50 不一定相等；覆盖列表示该化验值是否落在当时的 P10—P90 区间内。</p>\n      </div>\n\n      <div class=\"section\">\n        <h2>⑦ 方案对比：当前 vs 推荐</h2>\n        <div class=\"compare-grid\">\n          <div class=\"compare-col\">\n            <h3 id=\"c-cur-head\">当前（化验 + 5 ℃ 余量）</h3>\n            <div class=\"metric\"><span>发现延迟</span><b id=\"c-cur-delay\">—</b></div>\n            <div class=\"metric\"><span>区间覆盖率</span><b id=\"c-cur-cov\">—</b></div>\n            <div class=\"metric\"><span>卡边收率增益</span><b id=\"c-cur-yield\">—</b></div>\n            <div class=\"metric\"><span>回炼次数 / 月</span><b id=\"c-cur-re\">—</b></div>\n          </div>\n          <div class=\"compare-col rec\">\n            <h3>推荐（软测量 + 保形校准 + 2 ℃ 余量）</h3>\n            <div class=\"metric\"><span>发现延迟</span><b id=\"c-rec-delay\">—</b></div>\n            <div class=\"metric\"><span>区间覆盖率</span><b id=\"c-rec-cov\">—</b></div>\n            <div class=\"metric\"><span>卡边收率增益</span><b id=\"c-rec-yield\">—</b></div>\n            <div class=\"metric\"><span>回炼次数 / 月</span><b id=\"c-rec-re\">—</b></div>\n          </div>\n        </div>\n        <div class=\"compare-actions\">\n          <button id=\"btn-apply-rec\">应用推荐方案</button>\n          <button id=\"btn-cur\" class=\"secondary\">刷新当前对比</button>\n        </div>\n        <p class=\"hint\">从 5 ℃ 安全余量收到 2 ℃ 卡边，靠的是区间可信而不是胆子大；区间覆盖率掉到 75% 以下时不允许收窄余量。</p>\n      </div>\n\n    </div>\n    <div class=\"side\">\n\n      <div class=\"section\">\n        <h2>⑥ 参数控制</h2>\n        <div class=\"controls\" id=\"controls\"></div>\n      </div>\n\n    </div>\n  </div>\n\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "",
    mode: 'page',
    height: 760,
    mount: function (root, ctx) {
      if (!global.CaseDemoHost) return;
      demoHandle = global.CaseDemoHost.create(root, {
        files: FILES,
        demo: { mode: 'page', html: 'demo/index.html', js: 'demo/demo.js', height: 760 },
        meta: { title: DATA.title }
      }, ctx);
    },
    unmount: function () {
      if (demoHandle) { try { demoHandle.destroy(); } catch (e) { } demoHandle = null; }
    }
  };

  global.Cases.register(DATA);
})(window);
