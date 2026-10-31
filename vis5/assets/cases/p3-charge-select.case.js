/* =========================================================
   案例插件（静态注册版）：射孔弹型智能选型
   ---------------------------------------------------------
   由 cases/p3-charge-select/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "p3-charge-select",
    "sceneId": "p3",
    "methods": [
      "kg"
    ],
    "title": "射孔弹型智能选型",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "国内在用射孔弹超过 **150 个型号**，穿深从 400 mm 到 1,200 mm、入口孔径从 8 mm 到 14 mm，适用套管钢级与壁厚各不相同；人工查手册选一口井要 **0.5—1 天**，手册更新还常滞后半年以上。知识图谱把「弹型—性能—适用条件」结构化后，单井选型检索与排序只需几分钟。",
        "judge": [
          {
            "label": "任务类型",
            "value": "知识图谱 + 规则匹配",
            "desc": "结构化检索与排序，无复杂模型"
          },
          {
            "label": "标注成本",
            "value": "低",
            "desc": "手册一次性结构化，使用反馈少量标注"
          },
          {
            "label": "可见收益",
            "value": "中",
            "desc": "单井选型 0.5 天 → 10 min，错配率下降"
          },
          {
            "label": "难度",
            "value": "低",
            "desc": "数据规整、规则明确，风险可控"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>射孔弹选型要同时匹配四类条件：储层（岩性、强度、出砂倾向）、井筒（套管钢级、壁厚、井斜）、完井方式（电缆 / 油管传输、负压设计）与性能取舍——深穿透弹穿深长但孔径小，大孔径弹反之，低伤害弹保护套管但穿深折减 10%—20%。手册以 PDF 与纸质形式分散在各厂商，一个工程组常备 5—8 份，逐页比对单井要 0.5—1 天。</p><p>两类实际代价：① 手册滞后——弹型换代与改名频繁，某油田抽查发现在用弹型中 <b>18%</b> 已停产或有升级替代型号；② 「常用弹」依赖——现场 70% 以上的井只用 2—3 种熟悉弹型，致密层该用深穿透弹的井用了常规弹，实测穿深不足设计值的 60%，产能比直接受损。</p><p>硬约束：选型输出必须满足安全底线（射孔对套管的损伤深度低于剩余壁厚安全阈值、射孔枪与接箍兼容），且推荐结果要给出依据链——命中了哪条规则、历史上同类井用了什么，工程师不会接受「黑箱推荐」。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 做的是把分散知识结构化再按井况排序：从厂商手册、API 靶试报告与区块使用反馈中抽取「弹型 → 穿深 / 孔径 / 适用岩性 / 适用套管 / 作业方式」关系，建成 1,000 条以上三元组的知识图谱；输入井况参数（岩性、强度、套管钢级与壁厚、完井方式、产能目标），先用规则做安全硬过滤（排除不满足套管损伤约束的弹型），再按适配度打分排序输出前 3—5 个候选。</p><p>本体与规则由射孔专家一次性定义，工作量约 10 人天；排序权重用 200—400 井次的历史选型与效果反馈校准。定位是「检索增强的助手」：图谱负责召回与过滤，排序附带理由（哪条规则命中、相似井案例），工程师复核后才下发采购与作业单。不全自动的原因：手册数据本身有错漏，安全过滤规则也可能不完整，必须保留人工确认节点。</p><p>维护闭环是这类系统的生命力：新弹型入库后自动与存量型号对比，提示「同参数替代」或「性能升级」，从根上解决手册滞后问题。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">数据门槛很低，核心是把各家手册一次性结构化并统一到同一穿深基准，反馈数据随用随攒。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">射孔弹参数库</span><span class=\"cl-s\">150—300 个型号的穿深、孔径、适用套管、作业方式</span></span><span class=\"cl-n\">厂家手册结构化，字段级双人校对</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">API 靶试报告</span><span class=\"cl-s\">穿深 / 孔径实测与重复性数据</span></span><span class=\"cl-n\">与参数库交叉校验基准</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井况参数</span><span class=\"cl-s\">岩性、强度、套管钢级、壁厚、井斜</span></span><span class=\"cl-n\">按井自动读取，无需标注</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">安全规则表</span><span class=\"cl-s\">套管损伤阈值、枪身兼容、负压约束，30—60 条</span></span><span class=\"cl-n\">专家定义并会审定稿</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">使用反馈</span><span class=\"cl-s\">单区块 200—400 井次效果评价</span></span><span class=\"cl-n\">用于排序权重校准</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"低\">难度 低</span><span class=\"small muted\">技术不难，难在手册数据的持续更新与规则库的权威维护。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"\"></i><i class=\"\"></i></div><p>难度 <b>低</b>。本质是结构化检索与规则匹配，但三件事决定好不好用：① 手册数据质量——不同厂商的穿深基准靶不同（混凝土靶 vs 岩心靶），不做基准统一，跨品牌比较就是错的；② 规则完备性——井斜 &gt;60° 时贴壁间隙对穿深的影响、超深井高温对炸药性能的影响，漏一条规则就可能推荐出不安全方案；③ 排序可解释——每个推荐必须附命中规则与历史案例，否则现场不会采纳。</p><p>评估建议：安全过滤召回率 100%（不允许漏掉违规弹型）、Top-3 命中率（专家认可的弹型进入前三的比例）≥90%、单井选型耗时 ≤15 min。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/kg\">知识图谱<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/kg\">规则匹配<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/kg\">语义检索<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "渤海湾盆地某油田 62 口井的射孔弹集中选型",
        "lead": [
          "油田年度射孔计划 62 口井，覆盖疏松砂岩、致密砂岩与灰岩三类储层，套管钢级 N80 / P110、壁厚 7.72—12.09 mm。弹型库收录 186 个型号，其中在用 27 种。",
          "项目用知识图谱统一三家厂商手册基准（全部折算为岩心靶等效穿深），按井况自动过滤 + 排序。目标：单井选型 ≤15 min、安全过滤零遗漏、Top-3 命中率 ≥90%，并把停产型号全部替换。"
        ],
        "stats": [
          [
            "弹型库规模",
            "186 个型号"
          ],
          [
            "三元组",
            "1,240 条"
          ],
          [
            "待选型井",
            "62 口"
          ],
          [
            "安全规则",
            "42 条"
          ],
          [
            "人工基线",
            "0.5 天/井"
          ],
          [
            "选型耗时",
            "8 min/井"
          ]
        ],
        "steps": [
          {
            "name": "手册结构化",
            "role": "数据",
            "do": "对 3 家厂商 12 份手册做表格抽取与单位归一，穿深统一折算岩心靶等效值（混凝土靶 ×0.55—0.65 经验折算），字段级双人校对。",
            "effect": "186 个型号、1,240 条三元组入库",
            "trap": "直接抄混凝土靶穿深做横向对比——各品牌基准不同，穿深被虚高 40% 以上"
          },
          {
            "name": "规则库定义",
            "role": "标注",
            "do": "与 3 名射孔专家梳理 42 条安全与适配规则：套管损伤深度阈值、井斜 >45° 的相位补偿、出砂层位孔径下限 10 mm 等。",
            "effect": "规则经 2 轮会审定稿",
            "trap": "规则写成「建议」而非「硬过滤」，违规弹型会混进候选集"
          },
          {
            "name": "图谱构建与排序",
            "role": "算法核心",
            "do": "构建弹型—性能—适用条件图谱，井况参数自动读取，先规则硬过滤再按适配度打分（穿深 0.4、孔径 0.25、套管兼容 0.2、历史效果 0.15）。",
            "effect": "62 口井全部产出 Top-5 候选",
            "trap": "权重凭感觉设定且不回看——用 380 井次历史数据校准后，致密层 Top-1 命中率从 61% 提到 87%"
          },
          {
            "name": "选型复核下发",
            "role": "质控",
            "do": "工程师逐井复核推荐理由与命中规则，标记不合理项回流规则库。",
            "effect": "复核采纳率 91%，8 条规则被修订",
            "trap": "复核流于形式——首批 10 口井必须双人复核并记录分歧，否则错误规则会被固化"
          },
          {
            "name": "作业反馈闭环",
            "role": "工程环节",
            "do": "射孔后收集产能比与套管探伤结果回写图谱，标记 14 个停产 / 升级型号并推送替代建议。",
            "effect": "当季停产型号替换率 100%，下季度 Top-1 命中率再升 4 个百分点",
            "trap": "只记录「用了什么」不记录问题井，反馈样本失真，排序权重被采购倾向带偏"
          }
        ],
        "metrics": {
          "title": "怎么算「选型合格」",
          "html": "<p>反直觉的陷阱：Top-1 命中率不是越高越好——专家标注的「标准答案」本身就是常用弹，模型越贴合历史越像在模仿习惯而非优化方案。真正有价值的是「改判采纳率」：系统推荐与历史习惯不同、但经复核被采纳，说明它纠正了常用弹依赖。评估要同时看命中率与改判采纳率，并把<b>安全过滤召回率作为不可妥协的 100% 门槛</b>。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>人工选型</th><th>本方案</th></tr></thead><tbody><tr><td>单井选型耗时</td><td>含手册查阅比对</td><td>0.5—1 天</td><td>8 min + 10 min 复核</td></tr><tr><td>安全过滤召回</td><td>违规弹型被拦下的比例</td><td>依赖个人经验</td><td>100%（42 条规则）</td></tr><tr><td>Top-3 命中率</td><td>专家认可弹型进前三</td><td>—</td><td>91%</td></tr><tr><td>停产型号在用率</td><td>抽查在用弹型</td><td>18%</td><td>0%</td></tr><tr><td>致密层穿深达标率</td><td>实测 / 设计穿深</td><td>约 60%</td><td>85%</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "穿深基准混用导致跨品牌误判",
            "why": "A 厂商标混凝土靶、B 厂商标岩心靶，直接比较会把实际更好的弹排在后面。解决：入库强制折算到同一基准，折算系数按弹型类别分别标定。"
          },
          {
            "name": "规则库长期不更新",
            "why": "新型套管（13Cr）与新型弹（自清洁、复合射孔）出现后规则未覆盖，推荐逐渐过时。解决：每季度专家会审规则库，新弹型入库自动触发规则完整性检查。"
          },
          {
            "name": "反馈数据只进不出",
            "why": "只积累「用了什么」、不关联效果与事故，排序权重被采购惯性带偏。解决：反馈表强制关联产能比与探伤结果，缺字段不允许闭环。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
