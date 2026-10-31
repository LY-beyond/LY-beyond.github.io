/* =========================================================
   案例插件（静态注册版）：管道腐蚀缺陷智能评估
   ---------------------------------------------------------
   由 cases/t2-corrosion-assess/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "t2-corrosion-assess",
    "sceneId": "t2",
    "methods": [
      "cv",
      "ts"
    ],
    "title": "管道腐蚀缺陷智能评估",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "中俄原油管道漠河—大庆段 **1,020 km**、DN 813 mm、X70 螺旋焊管，壁厚 8.0—12.7 mm，设计压力 8.5 MPa、年输量 1,500 万 t。一次内检测（漏磁 + 超声）报出 **3.8 万条**金属损失缺陷，两次检测间隔 5 年；人工逐条比对要 6 人 × 5 周，而真正决定维修计划的是「哪些缺陷在 5 年里长到了危险尺寸」。",
        "judge": [
          {
            "label": "任务类型",
            "value": "缺陷识别 + 退化建模",
            "desc": "两次内检测缺陷匹配、增长率估计与剩余强度评估"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "开挖验证 86 处，逐处实测深度成本数千元"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "比对从 6 人 × 5 周压到 2 天，误修减少 22 处"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "检测误差与配准误差会放大增长率不确定性"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>完整性评估的现行做法是：内检测完成后导出缺陷列表，完整性工程师按里程排序，把两次检测的同位置缺陷手工配对，增长率 = 深度差 / 间隔年数，再按最大深度排序排维修计划。1,020 km 管段单次 3.6—3.8 万条缺陷，两名工程师配 4 名助手要干 5 周；实际匹配率只有 82%，配不上的要么新建、要么被当成「已修复」漏掉。</p><p>数据基础是充分的：两次内检测的缺陷里程、环向角、长度、宽度、深度、类型；漏磁原始信号与超声测厚；86 处开挖验证的实测深度（超声测厚 ±0.1 mm）；运行压力、温度、流量与介质含水、CO₂ / H₂S 含量。腐蚀速率受含水率、流速、细菌与防腐层状态影响，这些协变量决定了「长得多快」而不只是「长了多少」。</p><p>硬约束：① 检测误差——同一缺陷重复测深的偏差可达 ±10% 壁厚，两次差 0.5 mm 时真实年增长可能只有 0.05 mm，直接相除得到的增长率噪声占七成；② 配准误差——里程累计误差 ±0.2%（约 ±2 km）、环向 ±5°，错配会把两条不同缺陷配成「增长 1.8 mm」；③ 维修决策受停输窗口与补强 / 换管成本约束，不能只按深度排序。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 替换「逐条人工配对 + 深度排序」：先用 10 km 地面锚点做分段里程校正，再结合环向角、长度、宽度与类型做多级缺陷匹配（规则 + 匈牙利算法，冲突处用图匹配复核）；匹配后用贝叶斯退化模型估计每条缺陷的增长率后验，把检测误差与配准不确定度都写进似然，输出「增长快 / 稳定 / 不可判」三类。</p><p>图像侧负责缺陷识别与尺寸反演：对内检测漏磁信号做一维卷积 / U-Net 分割，输出缺陷框与深度初值，减少人工读图；时序侧负责增长与剩余强度：按 ASME B31G 与 DNV RP-F101 计算失效压力，结合 MAOP 与安全系数给剩余寿命，按「失效压力裕度 × 增长率 × 开挖成本」排序维修清单。</p><p>定位是辅助：模型输出 Top-50 维修清单、每条缺陷的后验区间与依据（哪次检测、哪段信号、哪条强度公式），完整性工程师复核并安排开挖验证后才进维修计划。不自动的原因：检测器换代、管段工况变化与错配风险都在数据之外，错误维修或漏修的代价是停输与环境事故。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">数据门槛在两次检测的可比性与开挖真值——先把检测批次归一、把配准误差量化，再谈增长率。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">两次内检测缺陷表</span><span class=\"cl-s\">里程、环向角、长度、宽度、深度、类型，3.6 万 / 3.8 万条</span></span><span class=\"cl-n\">缺陷级结构化，按检测批次与工具型号入库</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">内检测原始信号</span><span class=\"cl-s\">漏磁通道信号、超声测厚，采样间距 10 mm</span></span><span class=\"cl-n\">缺陷框标注 5,000—8,000 条，用于信号反演</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">开挖验证</span><span class=\"cl-s\">86 处实测深度与长度，超声测厚 ±0.1 mm</span></span><span class=\"cl-n\">作为真值，覆盖各深度档与焊缝 / 母材</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">运行工况</span><span class=\"cl-s\">压力、温度、流量、含水、CO₂ / H₂S，小时级</span></span><span class=\"cl-n\">作为腐蚀速率协变量</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">管段属性</span><span class=\"cl-s\">钢级、壁厚、焊缝类型、防腐层、服役年限</span></span><span class=\"cl-n\">按管段结构化，作为强度评估输入</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">难点不在模型精度，而在检测误差与配准误差——它们直接决定增长率有没有意义。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"\"></i></div><p>难度 <b>中</b>。挑战按影响排序：① 检测误差放大——重复测深偏差 ±10% 壁厚，5 年真实增长 0.25 mm 时信噪比只有 1:2，单条缺陷增长率不可信，必须按「同管段、同腐蚀环境」族群 pooling 后再估；② 配准错位——里程 ±2 km 的累积误差下，人工匹配里 20% 以上的「增长」其实是错配，模型必须先做分段校正再匹配；③ 剩余强度公式的选择——B31G 对长而浅的缺陷比短而深的点蚀更敏感，按深度排序维修会漏掉长度 300 mm、深度 40% 壁厚的长缺陷。</p><p>评估建议：缺陷匹配准确率 ≥95%（以开挖与人工复核为准）、增长率后验 90% 区间覆盖率 ≥90%、剩余强度评估与开挖实测偏差 ≤8%、Top-50 维修清单命中率 ≥80%。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/cv\">缺陷匹配<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">退化建模<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">可靠性评估<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "中俄原油管道漠河—大庆段 1,020 km 的两次内检测缺陷评估",
        "lead": [
          "2019 与 2024 两次内检测，缺陷 3.6 万 / 3.8 万条，壁厚 8.0—12.7 mm，运行压力 6.2—8.1 MPa，介质含水 0.3%—1.2%。86 处开挖验证，实测深度覆盖 12%—68% 壁厚。人工比对 6 人 × 5 周，维修计划按最大深度排序。",
          "项目做缺陷自动匹配、贝叶斯增长率与剩余强度评估。目标：匹配准确率 ≥95%、剩余寿命评估偏差 ≤8%、Top-50 清单命中率 ≥80%，比对周期 ≤2 天。"
        ],
        "stats": [
          [
            "管段长度",
            "1,020 km"
          ],
          [
            "缺陷总数",
            "3.8 万条"
          ],
          [
            "检测间隔",
            "5 年"
          ],
          [
            "壁厚",
            "8.0—12.7 mm"
          ],
          [
            "开挖验证",
            "86 处"
          ],
          [
            "比对周期",
            "≤2 天"
          ]
        ],
        "steps": [
          {
            "name": "检测批次归一",
            "role": "数据",
            "do": "两代检测器（2019 高分辨率漏磁、2024 漏磁 + 超声）按 86 处开挖实测做深度偏差校正，浅缺陷灵敏度差异单独建模，统一到同一深度基准。",
            "effect": "批次间深度偏差从 7.4% 降到 2.1%",
            "trap": "直接比较两代工具读数——2024 超声对浅缺陷更敏感，新增缺陷里 30% 是首次检出而非新生长"
          },
          {
            "name": "分段配准与缺陷匹配",
            "role": "算法核心",
            "do": "每 10 km 用地面锚点校正里程，环向角按管径反算弧长，再用「里程 ±30 m + 环向 ±5° + 尺寸相似」多级匹配，冲突用匈牙利算法求解最优配对。",
            "effect": "自动匹配率 96.2%，错配率 2.3%",
            "trap": "全局按里程线性配准——中间段累积误差 2 km，错配率升到 18%，增长率全部失真"
          },
          {
            "name": "误匹配剔除",
            "role": "质控",
            "do": "用开挖验证点与尺寸一致性复核：两次长度、宽度差异超过 25% 的配对降级为「疑似新建」，不参与增长率估计。",
            "effect": "剔除误配 870 条，增长率样本纯度 97%",
            "trap": "把错配当增长——两条不同缺陷配成「5 年长 1.8 mm」，这类假增长会挤进维修清单前列"
          },
          {
            "name": "贝叶斯增长率估计",
            "role": "算法核心",
            "do": "以检测误差 N(0, 0.4 mm)、配准不确定度为先验，按同管段同腐蚀环境族群 pooling，估计每条缺陷的增长率后验与 90% 区间。",
            "effect": "后验区间覆盖率 92%，增长率中位误差 0.012 mm/a",
            "trap": "深度差直接除以 5 年——0.8 mm 的差里 70% 是检测噪声，算出的「0.16 mm/a」根本不存在"
          },
          {
            "name": "剩余强度与排序",
            "role": "推理",
            "do": "按 B31G 与 DNV RP-F101 计算每条缺陷的失效压力，结合 MAOP、安全系数与增长率给剩余寿命，按风险裕度排序。",
            "effect": "Top-50 清单命中 42 条（84%），其中 11 条为长度 >200 mm 的长缺陷",
            "trap": "只按最大深度排序——长度 300 mm、深度 40% 壁厚的长缺陷比深度 60%、长度 20 mm 的点蚀更接近失效"
          },
          {
            "name": "开挖复核与计划",
            "role": "工程环节",
            "do": "对清单前 12 处开挖实测，复核深度、长度与剩余强度计算，结果回写模型；按复核后的清单编维修计划。",
            "effect": "实测与评估偏差 6.8%，误修从 31 处降到 9 处",
            "trap": "复核只测最深点——长缺陷的失效由长度控制，只测一点会把长缺陷判成安全"
          }
        ],
        "metrics": {
          "title": "怎么算「这条缺陷真的在长」",
          "html": "<p>反直觉的陷阱：两次检测深度差 0.8 mm 的缺陷，真实增长率可能是 0.02 mm/a，也可能根本不存在——在 ±0.4 mm 的检测误差下，5 年差 0.8 mm 的信噪比只有 2:1，单条缺陷的增长率不可信，必须按缺陷族群 pooling 后再估，再单独看该缺陷相对族群的偏离。另一个陷阱是按最大深度排序维修：B31G 里长度对失效压力的影响比深度更敏感，长而浅的缺陷常被漏掉，这正是「修了最深的、爆了最长的」的来源。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>人工比对</th><th>本方案</th></tr></thead><tbody><tr><td>缺陷匹配准确率</td><td>对 86 处开挖与人工复核</td><td>82%</td><td>96.2%</td></tr><tr><td>增长率区间覆盖率</td><td>90% 后验区间</td><td>—</td><td>92%</td></tr><tr><td>剩余强度偏差</td><td>对开挖实测</td><td>—</td><td>6.8%</td></tr><tr><td>比对周期</td><td>两次全量比对</td><td>6 人 × 5 周</td><td>2 天</td></tr><tr><td>Top-50 命中率</td><td>复核确认需维修</td><td>—</td><td>84%</td></tr><tr><td>误修数量</td><td>按原深度排序</td><td>31 处</td><td>9 处</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "两代检测器混比",
            "why": "不同工具的灵敏度与量化误差不同，直接比较会把「首次检出」当成「新生长」，新建缺陷数量虚高 30%。解决：按工具型号建误差模型，用开挖真值做批次校正后再比。"
          },
          {
            "name": "配准误差当成增长",
            "why": "里程累积误差让相邻两条缺陷被错配，算出巨大的假增长率并挤进维修清单。解决：分段锚点校正 + 环向与尺寸一致性约束，配不准的一律标「不可判」而不是硬配。"
          },
          {
            "name": "只按深度排序漏掉长缺陷",
            "why": "剩余强度由深度与长度共同决定，长而浅的缺陷在 B31G 下更危险。解决：排序指标换成失效压力裕度与剩余寿命，深度只作为输入之一。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
