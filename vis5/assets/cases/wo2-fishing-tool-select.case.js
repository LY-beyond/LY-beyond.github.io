/* =========================================================
   案例插件（静态注册版）：落物打捞工具智能选型
   ---------------------------------------------------------
   由 cases/wo2-fishing-tool-select/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "wo2-fishing-tool-select",
    "sceneId": "wo2",
    "methods": [
      "kg"
    ],
    "title": "落物打捞工具智能选型",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "一次打捞起下钻 4—6 h、费用 **3—8 万元**，而现场习惯一次带 3—4 套工具下井「试着捞」，平均 **2.3 趟**才成功，一次成功率只有 61%。把落物的材质、形态、尺寸档与井身结构结构化后，用工具知识图谱匹配组合，首选命中率可到 **78%**，平均趟数降到 1.4。",
        "judge": [
          {
            "label": "任务类型",
            "value": "分类 + 知识图谱匹配",
            "desc": "落物特征分类后按规则匹配工具组合"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "300—1,000 例落物描述与图像需按类型标注"
          },
          {
            "label": "可见收益",
            "value": "中",
            "desc": "平均趟数 2.3 → 1.4，单井省 3—8 万元"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "落物描述缺尺寸，井斜与间隙约束易被忽略"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>井下落物五花八门：油管、抽油杆、钻具、牙轮、刮蜡片、电缆、钢丝绳、水泥块与金属碎屑，形态从 9 m 长的油管到 20 mm 的碎屑都有。工具选择取决于四件事——落物能不能抓（卡瓦打捞筒、一把抓）、能不能套（套铣筒、母锥）、能不能磨（磨鞋、铣鞋）、能不能吸（强磁打捞器、反循环打捞篮），再叠加落物最大外径、长度、材质、鱼顶深度、井斜与套管尺寸。现场凭经验加工具手册选型，为了少起下钻，往往一次带 3—4 套工具下去轮流试。</p><p>代价很直接：684 井次打捞记录里平均 2.3 趟，单趟 4—6 h、3—8 万元，一次成功率 61%。失败原因里，落物尺寸估错占 34%、工具外径与套管间隙不足占 21%、井斜过大工具下不到位占 17%——这三类全是「选型阶段就能避免」的。</p><p>硬约束三条：① 落物描述多来自班组口述，「大概一米多长、碗口粗」是常态，尺寸字段缺失率 41%；② 井斜 &gt;45° 后工具下入与造扣能力显著下降，直井工具不能直接套用；③ 工具手册有 46 种工具，但外径、适用落物尺寸区间、扭矩上限分散在 3 份手册里，现场很少查全。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 分两步：先把落物描述结构化并分类（材质 × 形态 × 长度档 × 最大外径 × 可磨性，5 大类 18 子型），有井下电视或井口照片的用多模态模型补尺寸；再在工具知识图谱上做匹配——46 种工具、38 条选型规则（外径间隙 ≥8 mm、打捞筒内径 ≥落物外径 + 10 mm、井斜 &gt;45° 启用加长引鞋等），输出首选 + 2 套备选，并给出「先下铅印确认」的工况。</p><p>训练与规则的关键：分类模型用 300 例精标训练，图像分支补尺寸、文本分支补材质与形态；规则库由打捞工程师一次性定义、每季度会审。定位是辅助选型：模型给组合排序与依据，打捞工程师确认后组配工具——井下落物真实形态常与描述有出入，必须先下铅印或井下电视确认，这一步不能省。</p><p>效果回写是这套系统能不能越用越准的关键：每趟起下钻的实际工具、是否捞获、失败原因都回写图谱，成功率按「工具 × 落物子型 × 井斜档」三维统计，而不是笼统的工具成功率。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">数据门槛中等：记录量够，但尺寸字段缺失严重，先补井下电视与铅印资料再训练。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">落物描述与图像</span><span class=\"cl-s\">尺寸、形态、材质、鱼顶深度，300—1,000 例</span></span><span class=\"cl-n\">按落物类型标注 5 大类 18 子型</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">打捞记录</span><span class=\"cl-s\">工具组合、趟数、是否捞获、失败原因，684 井次</span></span><span class=\"cl-n\">作为标签，失败原因必填</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井身结构</span><span class=\"cl-s\">套管尺寸、壁厚、井斜、狗腿度</span></span><span class=\"cl-n\">作为硬约束条件</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">工具手册与字典</span><span class=\"cl-s\">46 种工具的外径、适用区间、扭矩上限</span></span><span class=\"cl-n\">结构化入库，季度更新</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">铅印与井下电视资料</span><span class=\"cl-s\">213 张图像 / 铅印描述</span></span><span class=\"cl-n\">用于补全尺寸，作补标样本</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">分类不难，难在尺寸缺失与井斜、间隙约束——规则漏一条，工具就下不去。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"\"></i></div><p>难度 <b>中</b>。挑战按影响排序：① 尺寸信息缺失——41% 的记录没有落物外径，只能靠图像与井史推断，推错 5 mm 就打捞筒选错；② 约束耦合——外径间隙、井斜、狗腿度、造扣扭矩四个约束同时成立的工具组合往往只剩 1—2 套，规则写漏就无解；③ 反馈稀疏——同一工具在同一子型上可能只有 3—5 次记录，成功率统计方差极大，需要按工具族合并估计。</p><p>评估建议：落物分类准确率 ≥88%、首选命中率 ≥75%、平均趟数 ≤1.6、一次成功率提升 ≥12 个百分点；并按落物类型分层报告，不能只看总成功率。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/kg\">知识图谱<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/kg\">相似度检索<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/kg\">规则匹配<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "大港油田某采油厂 684 井次落物打捞的工具选型",
        "lead": [
          "采油厂近 5 年打捞作业 684 井次：油管 268、抽油杆 197、工具落物 121、电缆与钢丝 63、碎屑 35。平均 2.3 趟起下钻，单趟 4—6 h、3—8 万元，一次成功率 61%，落物尺寸字段缺失率 41%。",
          "项目把落物描述与 213 张井下电视 / 井口照片结构化分类，在 46 种工具的知识图谱上匹配。目标：分类准确率 ≥88%、首选命中率 ≥75%、平均趟数降到 1.6 以内。"
        ],
        "stats": [
          [
            "打捞井次",
            "684 井次"
          ],
          [
            "落物类型",
            "5 大类"
          ],
          [
            "平均趟数",
            "2.3 趟"
          ],
          [
            "单趟费用",
            "3—8 万元"
          ],
          [
            "一次成功率",
            "61%"
          ],
          [
            "工具库规模",
            "46 种"
          ]
        ],
        "steps": [
          {
            "name": "落物描述结构化",
            "role": "标注",
            "do": "684 条记录 + 213 张图像统一抽材质、形态、长度、最大外径、可磨性；缺失尺寸用井下电视测算或按同井管柱序列反推。",
            "effect": "尺寸字段完整率从 59% 提到 92%",
            "trap": "把「一米多长」直接记为 1.0 m——实际 1.6 m，打捞筒选短一档，捞到一半卡死"
          },
          {
            "name": "落物分类模型",
            "role": "算法核心",
            "do": "文本 + 图像双分支分类（5 大类 18 子型），300 例精标训练，按井分组交叉验证。",
            "effect": "分类准确率 91%，尺寸回归 MAE 11 mm",
            "trap": "只看图像不看井史——同样形态的油管与套管材质不同，可磨性差一倍，磨铣方案完全不同"
          },
          {
            "name": "工具规则图谱",
            "role": "数据",
            "do": "46 种工具入库，定义 38 条规则：外径间隙 ≥8 mm、打捞筒内径 ≥落物外径 +10 mm、井斜 >45° 启用加长引鞋、扭矩上限按扣型折减。",
            "effect": "规则覆盖 5 类落物的全部组合",
            "trap": "不校验外径与套管间隙——Φ118 mm 工具进 Φ121 mm 套管，理论能下，实际遇阻 21% 的失败都在这"
          },
          {
            "name": "组合排序与备选",
            "role": "推理",
            "do": "按「成功率 × 期望趟数 × 单趟费用」排序，输出首选 + 2 套备选；尺寸存疑的井强制附加「先下铅印确认」步骤。",
            "effect": "首选命中率 78%，平均趟数 2.3 → 1.4",
            "trap": "只给首选不给备选——首选失败后现场重新翻手册选型，又多一趟起下钻"
          },
          {
            "name": "效果回写与规则校准",
            "role": "质控",
            "do": "每趟起下钻回写工具、结果、失败原因，按「工具 × 落物子型 × 井斜档」三维统计成功率，季度校准规则权重。",
            "effect": "一次成功率 61% → 79%，年省作业费约 320 万元",
            "trap": "只记成功不记失败——图谱里所有工具成功率虚高，排序退化成按工具熟悉度推荐"
          }
        ],
        "metrics": {
          "title": "怎么算「选型到位」",
          "html": "<p>反直觉的陷阱：成功率最高的工具不一定是最优选择。强磁打捞器对小件碎屑成功率 85%，但它对 9 m 长的油管毫无办法；若按工具总成功率排序，系统会偏爱「只处理简单落物」的工具。正确口径是<b>按落物子型分层看成功率，并用期望趟数 × 单趟费用算总成本</b>——一个成功率 70% 但一趟能捞获的工具，优于成功率 85% 但要两趟的组合。另一个陷阱是分类准确率 91% 就以为万事大吉：分类对了、规则漏了间隙约束，工具照样下不去。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>经验选型</th><th>本方案</th></tr></thead><tbody><tr><td>落物分类准确率</td><td>5 大类 18 子型</td><td>—</td><td>91%</td></tr><tr><td>首选命中率</td><td>首趟捞获比例</td><td>61%</td><td>78%</td></tr><tr><td>平均趟数</td><td>单井起下钻次数</td><td>2.3</td><td>1.4</td></tr><tr><td>尺寸字段完整率</td><td>可用记录占比</td><td>59%</td><td>92%</td></tr><tr><td>年作业费</td><td>684 井次合计</td><td>约 1,570 万元</td><td>约 1,250 万元</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "尺寸缺失被默认值填平",
            "why": "41% 的记录没有落物外径，用同类型均值填充会把 1.6 m 的油管填成 9 m，打捞筒选型全错。解决：缺失值不填默认值，走图像测算或强制先下铅印，模型输出标注「尺寸存疑」。"
          },
          {
            "name": "井斜与狗腿度被忽略",
            "why": "井斜 >45° 后工具下入摩阻增大、造扣困难，直井工具直接套用会中途遇阻，21% 的失败源于此。解决：井斜与狗腿度作为硬过滤维度，分档匹配工具引鞋长度与加重方式。"
          },
          {
            "name": "工具库长期不更新",
            "why": "液压打捞器、连续油管打捞工具等新型工具未入库，系统持续推荐老工具，现场逐渐不信任推荐。解决：新工具按手册建档给冷启动权重，3 口井验证后转正。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
