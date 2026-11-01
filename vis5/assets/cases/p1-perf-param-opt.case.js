/* =========================================================
   案例插件（静态注册版）：射孔参数智能优化（孔密/相位/穿深）
   ---------------------------------------------------------
   由 cases/p1-perf-param-opt/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "p1-perf-param-opt",
    "sceneId": "p1",
    "methods": [
      "opt"
    ],
    "title": "射孔参数智能优化（孔密/相位/穿深）",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "射孔是井筒与储层之间唯一的流体通道，孔密、相位角与穿深直接决定渗流面积和产能；但孔密越高、穿深越大，压实带损伤与成本也同步上升。",
        "judge": [
          {
            "label": "任务类型",
            "value": "参数优化 + 代理模型",
            "desc": "多目标搜索，物理模型负责可信度"
          },
          {
            "label": "标注成本",
            "value": "低",
            "desc": "无需人工标注，用数值模拟生成样本"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "同类井产能指数提升 15%—30%"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "参数空间不大，但储层差异与约束多"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>现场常见的射孔设计是一套「标准模板」：孔密 16 孔/m、相位 90°、穿深 450—500 mm。这套参数在均质砂岩中够用，但面对非均质储层会同时出现三类问题：低渗段孔密不足，渗流面积被孔道数量卡住；相位与最大水平主应力方向不匹配，孔道在弱面坍塌、出砂；穿深没有穿透近井污染带，有效渗流面积被压实带抵消。</p><p>更麻烦的是参数之间的耦合。孔密提高能增加渗流面积，却让压实带在井壁附近叠加；穿深增加能绕过污染带，但射孔弹成本与套管损伤风险上升；相位从 90° 改到 60° 能改善井周覆盖，却降低单个平面上的孔密度。</p><p>传统做法靠工程师按邻井经验微调，试错成本高：一次射孔作业按米计价，重射还要动管柱。要在孔密、相位、穿深、渗透率四维空间里找到「产能高、成本可接受、损伤可控」的组合，人工比选很难覆盖。</p><div class=\"figure\"><svg viewBox=\"0 0 640 232\" width=\"100%\" role=\"img\" aria-label=\"标准射孔模板在非均质储层的三类失效\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"232\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<rect x=\"10\" y=\"26\" width=\"196\" height=\"160\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line)\"/>\n<text x=\"24\" y=\"44\" font-size=\"10\" fill=\"var(--c-opt)\" font-weight=\"600\">① 孔密不足</text>\n<circle cx=\"108\" cy=\"112\" r=\"42\" fill=\"var(--paper-3)\" stroke=\"var(--ink-4)\"/>\n<circle cx=\"108\" cy=\"112\" r=\"30\" fill=\"none\" stroke=\"var(--ink-3)\" stroke-width=\"2\"/>\n<circle cx=\"108\" cy=\"112\" r=\"22\" fill=\"var(--paper-2)\" stroke=\"var(--ink-4)\"/>\n<line x1=\"108\" y1=\"82\" x2=\"108\" y2=\"38\" stroke=\"var(--c-opt)\" stroke-width=\"3\" stroke-linecap=\"round\"/>\n<line x1=\"108\" y1=\"142\" x2=\"108\" y2=\"154\" stroke=\"var(--c-opt)\" stroke-width=\"3\" stroke-linecap=\"round\"/>\n<text x=\"24\" y=\"166\" font-size=\"9\" fill=\"var(--ink-3)\">16 孔/m · 渗流面积不足</text>\n<text x=\"24\" y=\"180\" font-size=\"8.5\" fill=\"var(--ink-4)\">低渗段产能被孔道数量卡住</text>\n<rect x=\"222\" y=\"26\" width=\"196\" height=\"160\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line)\"/>\n<text x=\"236\" y=\"44\" font-size=\"10\" fill=\"var(--c-opt)\" font-weight=\"600\">② 相位与地应力错配</text>\n<circle cx=\"320\" cy=\"112\" r=\"42\" fill=\"var(--paper-3)\" stroke=\"var(--ink-4)\"/>\n<circle cx=\"320\" cy=\"112\" r=\"30\" fill=\"none\" stroke=\"var(--ink-3)\" stroke-width=\"2\"/>\n<circle cx=\"320\" cy=\"112\" r=\"22\" fill=\"var(--paper-2)\" stroke=\"var(--ink-4)\"/>\n<line x1=\"282\" y1=\"112\" x2=\"358\" y2=\"112\" stroke=\"var(--c-opt)\" stroke-width=\"3\"/>\n<line x1=\"320\" y1=\"78\" x2=\"320\" y2=\"146\" stroke=\"var(--c-opt)\" stroke-width=\"3\"/>\n<line x1=\"250\" y1=\"86\" x2=\"284\" y2=\"98\" stroke=\"var(--bad)\" stroke-width=\"1.4\" stroke-dasharray=\"4 3\"/>\n<text x=\"244\" y=\"80\" font-size=\"8.5\" fill=\"var(--bad)\">最小水平主应力</text>\n<text x=\"236\" y=\"166\" font-size=\"9\" fill=\"var(--ink-3)\">90° 相位 · 孔道易在弱面坍塌</text>\n<text x=\"236\" y=\"180\" font-size=\"8.5\" fill=\"var(--ink-4)\">出砂与孔道失稳风险上升</text>\n<rect x=\"434\" y=\"26\" width=\"196\" height=\"160\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line)\"/>\n<text x=\"448\" y=\"44\" font-size=\"10\" fill=\"var(--c-opt)\" font-weight=\"600\">③ 穿深未穿透污染带</text>\n<circle cx=\"532\" cy=\"112\" r=\"46\" fill=\"var(--bg-ts)\" stroke=\"var(--c-ts)\" stroke-dasharray=\"4 3\"/>\n<circle cx=\"532\" cy=\"112\" r=\"24\" fill=\"var(--paper-2)\" stroke=\"var(--ink-4)\"/>\n<line x1=\"532\" y1=\"88\" x2=\"532\" y2=\"68\" stroke=\"var(--c-opt)\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n<text x=\"546\" y=\"72\" font-size=\"8.5\" fill=\"var(--c-ts)\">污染带</text>\n<text x=\"448\" y=\"166\" font-size=\"9\" fill=\"var(--ink-3)\">450 mm 穿深 · 仍留在伤害区</text>\n<text x=\"448\" y=\"180\" font-size=\"8.5\" fill=\"var(--ink-4)\">有效渗流面积被压实带抵消</text>\n<text x=\"10\" y=\"212\" font-size=\"9.5\" fill=\"var(--ink-3)\">同一套「16 孔/m · 90° · 450 mm」模板套用到所有井段，是三类失效的共同来源。</text>\n</svg><div class=\"figcap\"><b>图 1</b><span>标准射孔模板在非均质储层的三类典型失效：孔密不足、相位与地应力错配、穿深不足。它们都不会让施工失败，却会让产能长期低于设计值。</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>把射孔设计建模成<b>带约束的多目标优化</b>：输入储层渗透率、孔隙度、地应力方位、套管与水泥环参数；决策变量是孔密、相位角、射孔弹穿深与孔径；目标一是相对产能指数最大，目标二是射孔成本最小；约束包括压实带表皮、套管安全系数与工具可达性。</p><p>直接调用数值模拟做寻优太慢，一组工况要 20 分钟以上。工程做法是先用 2,000—5,000 组模拟样本训练代理模型（GBDT 或高斯过程），把单次评估压到毫秒级，再用 NSGA-II 或贝叶斯优化搜索 Pareto 前沿。AI 在这里不是替代渗流物理，而是把「算不起的搜索」变成「算得起的搜索」。</p><div class=\"figure\"><svg viewBox=\"0 0 640 244\" width=\"100%\" role=\"img\" aria-label=\"射孔几何到产能指数的关系\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"244\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<defs><marker id=\"p1-a1\" markerWidth=\"7\" markerHeight=\"7\" refX=\"6\" refY=\"3\" orient=\"auto\"><path d=\"M0 0L6 3L0 6Z\" fill=\"var(--ink-4)\"/></marker></defs>\n<rect x=\"12\" y=\"30\" width=\"178\" height=\"86\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--c-opt)\"/>\n<text x=\"24\" y=\"49\" font-size=\"10\" font-weight=\"600\" fill=\"var(--c-opt)\">射孔几何</text>\n<text x=\"24\" y=\"68\" font-size=\"9\" fill=\"var(--ink-2)\">n：孔密 8—24 孔/m</text>\n<text x=\"24\" y=\"83\" font-size=\"9\" fill=\"var(--ink-2)\">L：穿深 200—800 mm</text>\n<text x=\"24\" y=\"98\" font-size=\"9\" fill=\"var(--ink-2)\">d：孔径 8—14 mm</text>\n<line x1=\"190\" y1=\"73\" x2=\"216\" y2=\"73\" stroke=\"var(--ink-4)\" stroke-width=\"1.2\" marker-end=\"url(#p1-a1)\"/>\n<rect x=\"220\" y=\"30\" width=\"178\" height=\"86\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--c-cv)\"/>\n<text x=\"232\" y=\"49\" font-size=\"10\" font-weight=\"600\" fill=\"var(--c-cv)\">渗流面积</text>\n<text x=\"232\" y=\"68\" font-size=\"9\" fill=\"var(--ink-2)\">孔道壁面 + 井筒连通</text>\n<text x=\"232\" y=\"86\" font-size=\"10\" fill=\"var(--ink)\" font-family=\"ui-monospace,monospace\">A = n · 2πrL</text>\n<text x=\"232\" y=\"104\" font-size=\"8.5\" fill=\"var(--ink-4)\">压实带会削减有效面积</text>\n<line x1=\"398\" y1=\"73\" x2=\"424\" y2=\"73\" stroke=\"var(--ink-4)\" stroke-width=\"1.2\" marker-end=\"url(#p1-a1)\"/>\n<rect x=\"428\" y=\"30\" width=\"200\" height=\"86\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--jade)\"/>\n<text x=\"440\" y=\"49\" font-size=\"10\" font-weight=\"600\" fill=\"var(--jade)\">产能指数</text>\n<text x=\"440\" y=\"68\" font-size=\"9\" fill=\"var(--ink-2)\">相对 PI，未射孔 = 1.00</text>\n<text x=\"440\" y=\"86\" font-size=\"9.5\" fill=\"var(--ink)\" font-family=\"ui-monospace,monospace\">PI ∝ khA / (μB(ln(re/rw)+s))</text>\n<text x=\"440\" y=\"104\" font-size=\"8.5\" fill=\"var(--ink-4)\">s 为压实带表皮</text>\n<line x1=\"318\" y1=\"126\" x2=\"318\" y2=\"150\" stroke=\"var(--ink-4)\" stroke-width=\"1.2\" marker-end=\"url(#p1-a1)\"/>\n<rect x=\"24\" y=\"154\" width=\"176\" height=\"48\" rx=\"6\" fill=\"var(--bg-opt)\" stroke=\"var(--c-opt)\"/>\n<text x=\"38\" y=\"174\" font-size=\"9.5\" fill=\"var(--ink-2)\">3,600 组数值模拟</text>\n<text x=\"38\" y=\"190\" font-size=\"8.5\" fill=\"var(--ink-3)\">孔密 × 相位 × 穿深 × 渗透率</text>\n<rect x=\"226\" y=\"154\" width=\"188\" height=\"48\" rx=\"6\" fill=\"var(--bg-cv)\" stroke=\"var(--c-cv)\"/>\n<text x=\"240\" y=\"174\" font-size=\"9.5\" fill=\"var(--ink-2)\">GBDT 代理模型</text>\n<text x=\"240\" y=\"190\" font-size=\"8.5\" fill=\"var(--ink-3)\">R² = 0.93 · 单次评估 5 ms</text>\n<rect x=\"440\" y=\"154\" width=\"188\" height=\"48\" rx=\"6\" fill=\"var(--bg-ts)\" stroke=\"var(--c-ts)\"/>\n<text x=\"454\" y=\"174\" font-size=\"9.5\" fill=\"var(--ink-2)\">多目标优化</text>\n<text x=\"454\" y=\"190\" font-size=\"8.5\" fill=\"var(--ink-3)\">产能最大 + 成本最小</text>\n<text x=\"24\" y=\"228\" font-size=\"9\" fill=\"var(--ink-4)\">代理模型替代逐组数值模拟，是让「每口井单独寻优」在工程上可行的关键。</text>\n</svg><div class=\"figcap\"><b>图 2</b><span>射孔几何通过渗流面积影响产能指数；压实带表皮是必须扣除的损失项。下方是代理模型 + 多目标优化的落地路径：先仿真生成样本，再让模型在秒级完成参数搜索。</span></div></div><p>相位角的选择还要叠加地应力方向：最大水平主应力方位已知时，孔道应尽量沿高应力方向布置，减少弱面坍塌；需要避水避气时则用 180° 定向射孔。这些工程约束应作为硬条件进入优化，而不是事后修补。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">射孔优化的数据门槛不高，但每一项都会直接影响代理模型的可信度。清单可点击，勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">储层与地应力参数</span><span class=\"cl-s\">渗透率、孔隙度、最小水平主应力与方位，每 0.5 m 一点</span></span><span class=\"cl-n\">测井解释 + 岩心</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">射孔弹性能手册</span><span class=\"cl-s\">穿深、孔径、压实带厚度，按 API RP 19B 格式</span></span><span class=\"cl-n\">厂商试验数据</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井身与套管参数</span><span class=\"cl-s\">钢级、壁厚、水泥环、井斜，单井一套</span></span><span class=\"cl-n\">钻井与固井资料</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">生产与成本数据</span><span class=\"cl-s\">日产、压差、射孔单价，至少 50 口井</span></span><span class=\"cl-n\">用于校准与回测</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中</b>。参数空间只有四维，物理关系也相对清楚，难点主要在三个地方：<b>代理模型外推</b>——高渗透率或超深穿透样本少，模型容易给出偏乐观的预测；<b>压实带参数不确定</b>——不同射孔弹、不同储层的压实带厚度差异很大；<b>多目标权重</b>——只追求产能会选出 24 孔/m、800 mm 的高成本方案，必须用 Pareto 前沿而不是单一最优解。</p><p>建议先用 3—5 口试验井校准代理模型，把预测产能与实测压差、产量对比，误差控制在 15% 以内再推广。对超出训练范围的储层，模型应主动提示「外推风险」，而不是继续给确定值。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">代理模型<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">多目标优化<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">NSGA-II<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">贝叶斯优化<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "某低渗砂岩油藏 28 口井的射孔参数优化",
        "lead": [
          "某低渗砂岩油藏 28 口开发井，储层渗透率 5—30 mD，套管 139.7 mm，原设计统一采用 16 孔/m、90°、450 mm 射孔。投产后 11 口井产液指数低于方案值 18%，其中 3 口井出现轻微出砂。",
          "项目目标是在不增加总射孔预算的前提下，把平均相对产能指数提高 15% 以上，并把压实带表皮控制在 8 以内。下面的五步把「一套模板打天下」改成「按储层分段寻优」。"
        ],
        "stats": [
          [
            "射孔井数",
            "28 口"
          ],
          [
            "平均渗透率",
            "18 mD"
          ],
          [
            "数值模拟样本",
            "3,600 组"
          ],
          [
            "孔密范围",
            "8—24 孔/m"
          ],
          [
            "平均产能指数",
            "1.00 → 1.22"
          ],
          [
            "单井射孔成本",
            "-8%"
          ]
        ],
        "steps": [
          {
            "name": "储层分段与参数提取",
            "role": "数据",
            "do": "按 0.5 m 采样提取渗透率、孔隙度与最小水平主应力方位，把 28 口井划分为 3 类储层、每井 4—6 个射孔段，形成 146 个待优化单元。",
            "effect": "每个射孔段都有独立的渗透率与地应力输入，不再全井一套参数",
            "trap": "测井渗透率与岩心分析可能相差 2 倍，必须先做标定，否则代理模型会学错"
          },
          {
            "name": "射孔参数空间定义",
            "role": "建模",
            "do": "孔密 8—24 孔/m（步长 2）、相位 60/90/120/180°、穿深 200—800 mm（步长 50 mm）、孔径 8—14 mm；同时加入套管强度与工具外径约束，剔除不可施工组合。",
            "effect": "得到 3,600 组可计算样本，覆盖现场常用射孔弹系列",
            "trap": "忽略相位与地应力夹角，会得到「数学上更优、现场不敢用」的方案"
          },
          {
            "name": "数值模拟与代理模型",
            "role": "算法核心",
            "do": "用有限元或商业射孔模拟软件计算 3,600 组样本的产能指数与压实带表皮，训练 GBDT 代理模型；用 20% 样本做验证，R² 达到 0.93。",
            "effect": "单次参数评估从 20 分钟降到 5 ms，可支持交互式寻优",
            "trap": "高穿深、高孔密样本少，训练集外推误差会明显放大"
          },
          {
            "name": "多目标优化与方案排序",
            "role": "优化",
            "do": "以相对产能指数最大、射孔成本最小为目标，约束压实带表皮小于 8、套管安全系数大于 1.5，用 NSGA-II 生成 Pareto 前沿，再按区块成本上限挑选推荐方案。",
            "effect": "28 口井平均推荐 18 孔/m、60°、600 mm，预测产能指数 1.22",
            "trap": "只优化产能会选 24 孔/m、800 mm，成本上升 60%，必须保留成本目标"
          },
          {
            "name": "现场试验与模型校准",
            "role": "落地",
            "do": "选 3 口代表性井按推荐参数施工，对比预测与实测压差、日产液；用实测结果修正代理模型的压实带系数，再推广到其余 25 口井。",
            "effect": "试验井预测产能误差 12%，校准后推广，未出现套管损伤或严重出砂",
            "trap": "试验井若只选最好的储层，无法代表全区，校准会失真"
          }
        ],
        "metrics": {
          "title": "怎么算「射孔方案好」",
          "html": "<p>核心指标是<b>相对产能指数</b>（以未射孔或原模板为 1.00），同时看<b>压实带表皮</b>与<b>单位米射孔成本</b>。三者必须一起看：产能最高的方案往往最贵，成本最低的方案往往产能不足。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>原标准模板</th><th>优化方案</th><th>变化</th></tr></thead><tbody><tr><td>孔密</td><td>16 孔/m</td><td>18 孔/m</td><td>+2 孔/m</td></tr><tr><td>相位角</td><td>90°</td><td>60°</td><td>井周覆盖更均匀</td></tr><tr><td>穿深</td><td>450 mm</td><td>600 mm</td><td>+150 mm</td></tr><tr><td>相对产能指数</td><td>1.00</td><td>1.22</td><td>+22%</td></tr><tr><td>压实带表皮</td><td>6.8</td><td>5.9</td><td>-0.9</td></tr><tr><td>射孔成本</td><td>100%</td><td>92%</td><td>-8%</td></tr></tbody></table><p class=\"small muted\">注：优化方案并非每个单指标都最好，而是「产能、损伤、成本」三项乘积更优；这正是多目标优化与单目标最大化的区别。</p>"
        },
        "fails": [
          {
            "name": "相位与地应力错配",
            "why": "最大水平主应力方位为 30° 时，固定 90° 相位会让部分孔道落在最小应力方向，易坍塌出砂。正确做法是把应力方位作为输入，相位随井段旋转，而不是全区固定。"
          },
          {
            "name": "代理模型外推失效",
            "why": "渗透率大于 100 mD 或穿深大于 700 mm 的样本很少，模型预测会偏乐观。应对超出训练范围的参数设置置信度惩罚，或补做数值模拟后再推荐。"
          },
          {
            "name": "成本约束被忽略",
            "why": "24 孔/m 加 800 mm 穿深的组合产能最高，但单位米成本比模板高 60%。若只做单目标最大化，方案在经济上不可执行，必须输出 Pareto 前沿供决策。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "* { box-sizing: border-box; }\nhtml, body { margin: 0; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #ecf0e9;\n  color: #2a2517;\n  font-size: 12px;\n  padding: 10px 12px;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n.panel { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0,1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }\nh2 { font-size: 12.5px; font-weight: 600; color: #488778; margin: 0 0 6px; letter-spacing: .03em; }\n.lead { font-size: 11.5px; color: #706b59; margin: 0 0 10px; }\n.hint { font-size: 10.5px; color: #878374; margin: 0 0 6px; }\n.section { background: #e4e9e0; border: 1px solid #d2d9cd; border-radius: 9px; padding: 8px 10px; margin-bottom: 8px; }\n\n.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }\n.chip {\n  border: 1px solid #c2ccbb; background: #eaefe6; color: #4b4636; border-radius: 18px;\n  padding: 4px 9px; font-size: 10.5px; cursor: pointer; font-family: inherit; transition: .15s;\n}\n.chip:hover { border-color: #488778; color: #488778; }\n.chip.on { background: #488778; border-color: #488778; color: #ecf0e9; font-weight: 600; }\n\n.controls { display: grid; grid-template-columns: 1fr !important; gap: 6px; }\n.ctl {\n  background: #eaefe6; border: 1px solid #d3dacf; border-radius: 7px; padding: 6px 8px;\n  display: flex; flex-direction: column; gap: 3px; min-width: 0;\n}\n.ctl label { font-size: 11.5px; color: #4b4636; display: flex; justify-content: space-between; align-items: center; gap: 6px; }\n.ctl output { font-family: ui-monospace, Consolas, monospace; color: #a37b2f; font-weight: 600; font-size: 11px; }\n.ctl input[type=\"range\"] { width: 100%; accent-color: #488778; height: 16px; margin: 0; }\n.ctl .tip { font-size: 10px; color: #8a8f7f; line-height: 1.4; }\n.ctl select {\n  background: #e1e7dd; color: #2a2517; border: 1px solid #c2ccbb; border-radius: 5px;\n  padding: 3px 5px; font-family: inherit; font-size: 11px;\n}\n\n.split { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: start; }\n.chart-wrap { background: #eef2ec; border: 1px solid #d7ded2; border-radius: 8px; padding: 4px; min-width: 0; }\nsvg { display: block; width: 100%; max-width: 100%; height: auto; }\n\n.readouts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }\n.readouts.one { grid-template-columns: repeat(3, 1fr); }\n.ro { background: #eaefe6; border: 1px solid #d3dacf; border-radius: 7px; padding: 6px 8px; min-width: 0; }\n.ro span { display: block; font-size: 9.5px; color: #878374; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.ro b { font-family: ui-monospace, Consolas, monospace; font-size: 15px; color: #a37b2f; font-weight: 600; line-height: 1.25; }\n.ro b small { font-size: 9px; color: #878374; font-weight: 400; }\n\n.rank { margin-top: 2px; }\n.rank-head { font-size: 10px; color: #878374; letter-spacing: .05em; margin-bottom: 4px; }\n.rk { display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px dashed #d3dacf; font-size: 10.5px; }\n.rk:last-child { border-bottom: 0; }\n.rk .no { font-family: ui-monospace, Consolas, monospace; color: #8a8f7f; width: 14px; flex-shrink: 0; }\n.rk .nm { width: 64px; flex-shrink: 0; color: #4b4636; }\n.rk .bar { flex: 1; height: 5px; background: #d3dacf; border-radius: 3px; overflow: hidden; min-width: 20px; }\n.rk .bar i { display: block; height: 100%; background: #70a195; border-radius: 3px; }\n.rk .val { font-family: ui-monospace, Consolas, monospace; color: #878374; width: 40px; text-align: right; flex-shrink: 0; }\n.rk.top .nm { color: #a37b2f; font-weight: 600; }\n.rk.top .bar i { background: #a37b2f; }\n.rk.top .val { color: #a37b2f; }\n\n.status {\n  display: flex; gap: 8px; align-items: flex-start; background: #eaefe6; border: 1px solid #d3dacf;\n  border-left: 3px solid #488778; border-radius: 7px; padding: 7px 9px;\n  font-size: 10.5px; color: #706b59; line-height: 1.5;\n}\n.status b { color: #488778; flex-shrink: 0; }\n.status.ok { border-left-color: #488778; }\n.status.ok b { color: #488778; }\n.status.warn { border-left-color: #a37b2f; }\n.status.warn b { color: #a37b2f; }\n.status.bad { border-left-color: #a3392b; }\n.status.bad b { color: #a3392b; }\n\n.btnrow { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 8px; }\nbutton {\n  font-family: inherit; font-size: 11px; border-radius: 6px; border: 1px solid #c2ccbb;\n  background: #e1e7dd; color: #4b4636; padding: 5px 10px; cursor: pointer; transition: .15s;\n}\nbutton:hover { border-color: #488778; color: #488778; }\nbutton.primary { background: #488778; border-color: #488778; color: #ecf0e9; font-weight: 600; }\nbutton.primary:hover { background: #377162; color: #ecf0e9; }\n.btn-note { font-size: 9.5px; color: #8a8f7f; margin-left: auto; }\n\n.legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 10px; color: #878374; margin-top: 4px; }\n.legend i { display: inline-block; width: 12px; height: 2px; vertical-align: middle; margin-right: 4px; }\n.legend i.dot { width: 6px; height: 6px; border-radius: 50%; }\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 射孔参数智能优化 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  const $ = function (id) { return document.getElementById(id); };\n  const PHASES = [60, 90, 120, 180];\n  const DEFAULTS = { d: 16, ph: 90, dp: 450, perm: 18, optimal: false };\n  let st = { d: 16, ph: 90, dp: 450, perm: 18, optimal: false };\n\n  function calc(s) {\n    s = s || st;\n    const densF = Math.pow(s.d / 16, 0.35);\n    const depF = Math.pow(s.dp / 450, 0.30);\n    const phF = { 60: 1.07, 90: 1.00, 120: 0.95, 180: 0.87 }[s.ph];\n    const permF = 0.72 + 0.18 * Math.log10(s.perm * 10);\n    const skin = 4.2 + 0.11 * s.d + 0.0022 * s.dp + (s.ph === 180 ? 1.4 : 0);\n    const pi = 1.25 * densF * depF * phF * permF * (1 - skin / 45);\n    const cost = (800 + 55 * s.d + 1.8 * s.dp) * 10 / 10000;\n    return { pi: pi, skin: skin, cost: cost };\n  }\n\n  function draw(c) {\n    const W = 430, H = 256;\n    const cx = 116, cy = 136;\n    const len = 16 + (st.dp - 200) / 600 * 28;\n    let g = '<rect x=\"0\" y=\"0\" width=\"' + W + '\" height=\"' + H + '\" fill=\"#eef2ec\" rx=\"6\"/>';\n    g += '<rect x=\"8\" y=\"12\" width=\"216\" height=\"226\" rx=\"7\" fill=\"#e6ece3\" stroke=\"#d1d8cc\"/>';\n    g += '<text x=\"18\" y=\"28\" font-size=\"9\" fill=\"#878374\">地层 · 渗透率 ' + st.perm + ' mD</text>';\n    g += '<text x=\"18\" y=\"40\" font-size=\"8\" fill=\"#8a8f7f\">横截面（俯视井眼）</text>';\n\n    g += '<circle cx=\"' + cx + '\" cy=\"' + cy + '\" r=\"56\" fill=\"#bfc7bd\" stroke=\"#afb9ab\" stroke-width=\"1\"/>';\n    g += '<circle cx=\"' + cx + '\" cy=\"' + cy + '\" r=\"47\" fill=\"#9fa79c\" stroke=\"#84907a\" stroke-width=\"1.2\"/>';\n    g += '<circle cx=\"' + cx + '\" cy=\"' + cy + '\" r=\"40\" fill=\"#ecf0e9\" stroke=\"#84907a\" stroke-width=\"1\"/>';\n\n    const n = 360 / st.ph;\n    for (let k = 0; k < n; k++) {\n      const a = -Math.PI / 2 + k * 2 * Math.PI / n;\n      const x1 = cx + Math.cos(a) * 47, y1 = cy + Math.sin(a) * 47;\n      const x2 = cx + Math.cos(a) * (47 + len), y2 = cy + Math.sin(a) * (47 + len);\n      g += '<line x1=\"' + x1.toFixed(1) + '\" y1=\"' + y1.toFixed(1) + '\" x2=\"' + x2.toFixed(1) + '\" y2=\"' + y2.toFixed(1) + '\" stroke=\"' + (st.optimal ? '#91680f' : '#a37b2f') + '\" stroke-width=\"' + (st.optimal ? 3 : 2.5) + '\" stroke-linecap=\"round\" opacity=\".92\"/>';\n      g += '<circle cx=\"' + x2.toFixed(1) + '\" cy=\"' + y2.toFixed(1) + '\" r=\"3.2\" fill=\"' + (st.optimal ? '#91680f' : '#a37b2f') + '\"/>';\n    }\n    g += '<circle cx=\"' + cx + '\" cy=\"' + cy + '\" r=\"' + (47 + len + 6) + '\" fill=\"none\" stroke=\"#a37b2f\" stroke-width=\".8\" stroke-dasharray=\"3 4\" opacity=\".5\"/>';\n    g += '<text x=\"' + (cx + 62) + '\" y=\"' + (cy + 58) + '\" font-size=\"8\" fill=\"#878374\">套管</text>';\n    g += '<text x=\"' + (cx + 34) + '\" y=\"' + (cy - 54) + '\" font-size=\"8\" fill=\"#878374\">水泥环</text>';\n    g += '<text x=\"' + (cx + 66) + '\" y=\"' + (cy - 76) + '\" font-size=\"8\" fill=\"#a37b2f\">孔道</text>';\n    g += '<text x=\"10\" y=\"250\" font-size=\"8.5\" fill=\"#4b4636\">相位角 ' + st.ph + '° · ' + n + ' 条孔道 · 穿深 ' + st.dp + ' mm</text>';\n\n    const sx = 238;\n    g += '<text x=\"' + sx + '\" y=\"28\" font-size=\"9\" fill=\"#878374\">1 m 井段展开</text>';\n    g += '<text x=\"' + sx + '\" y=\"40\" font-size=\"8\" fill=\"#8a8f7f\">金色圆点 = 射孔孔眼</text>';\n    g += '<rect x=\"' + sx + '\" y=\"48\" width=\"110\" height=\"152\" rx=\"6\" fill=\"#e6ece3\" stroke=\"#d1d8cc\"/>';\n    const rows = Math.ceil(st.d / 3);\n    for (let i = 0; i < st.d; i++) {\n      const col = i % 3, row = Math.floor(i / 3);\n      const px = sx + 27 + col * 28;\n      const py = 62 + row * (128 / Math.max(rows, 1));\n      g += '<circle cx=\"' + px + '\" cy=\"' + py.toFixed(1) + '\" r=\"3\" fill=\"' + (st.optimal ? '#91680f' : '#a37b2f') + '\"/>';\n    }\n    g += '<text x=\"' + (sx + 4) + '\" y=\"59\" font-size=\"7.5\" fill=\"#8a8f7f\">0 m</text>';\n    g += '<text x=\"' + (sx + 4) + '\" y=\"212\" font-size=\"7.5\" fill=\"#8a8f7f\">1.0 m</text>';\n    g += '<text x=\"' + (sx + 55) + '\" y=\"212\" font-size=\"9\" fill=\"#4b4636\" text-anchor=\"middle\">' + st.d + ' 孔 / m</text>';\n    g += '<text x=\"' + sx + '\" y=\"226\" font-size=\"7.5\" fill=\"#878374\">PI ∝ 孔密^0.35 × 穿深^0.30 × 相位系数</text>';\n    if (st.optimal) {\n      g += '<text x=\"' + (sx + 55) + '\" y=\"240\" font-size=\"8\" fill=\"#91680f\" text-anchor=\"middle\">★ 自动寻优组合</text>';\n    }\n    $('perf').innerHTML = g;\n    return c;\n  }\n\n  function update() {\n    const c = calc();\n    draw(c);\n    $('r-pi').textContent = c.pi.toFixed(2);\n    $('r-skin').textContent = c.skin.toFixed(1);\n    $('r-cost').innerHTML = c.cost.toFixed(2) + ' <small>万元</small>';\n    const stEl = $('status');\n    if (c.pi >= 1.38 && c.skin <= 8.0 && c.cost <= 3.0) {\n      stEl.className = 'status ok';\n      stEl.innerHTML = '<b>方案最优</b><span>产能指数 ' + c.pi.toFixed(2) + '，压实带表皮 ' + c.skin.toFixed(1) +\n        '，成本 ' + c.cost.toFixed(2) + ' 万元/10 m，三项约束同时满足。</span>';\n    } else if (c.pi >= 1.18) {\n      stEl.className = 'status warn';\n      stEl.innerHTML = '<b>可接受</b><span>产能指数 ' + c.pi.toFixed(2) +\n        '，但未同时达到「指数 ≥ 1.38、表皮 ≤ 8、成本 ≤ 3.0」的最优条件，仍有优化空间。</span>';\n    } else {\n      stEl.className = 'status bad';\n      stEl.innerHTML = '<b>不经济</b><span>产能指数仅 ' + c.pi.toFixed(2) +\n        '，孔密/穿深不足以穿透污染带，或相位与储层条件不匹配。建议先做自动寻优再比选。</span>';\n    }\n  }\n\n  function optimize() {\n    let best = null, bestObj = -Infinity;\n    for (let d = 8; d <= 24; d += 2) {\n      for (let p = 0; p < PHASES.length; p++) {\n        for (let dp = 200; dp <= 800; dp += 50) {\n          const c = calc({ d: d, ph: PHASES[p], dp: dp, perm: st.perm });\n          const obj = c.pi / Math.sqrt(c.cost) - Math.max(0, c.cost - 3) * 0.4 - Math.max(0, c.skin - 8) * 0.05;\n          if (obj > bestObj) {\n            bestObj = obj;\n            best = { d: d, ph: PHASES[p], dp: dp };\n          }\n        }\n      }\n    }\n    st.d = best.d;\n    st.ph = best.ph;\n    st.dp = best.dp;\n    st.optimal = true;\n    sync();\n    update();\n  }\n\n  function sync() {\n    $('s-d').value = st.d;\n    $('s-ph').value = String(st.ph);\n    $('s-dp').value = st.dp;\n    $('s-k').value = st.perm;\n    $('o-d').textContent = st.d;\n    $('o-ph').textContent = st.ph + '°';\n    $('o-dp').textContent = st.dp + ' mm';\n    $('o-k').textContent = st.perm + ' mD';\n  }\n\n  $('s-d').addEventListener('input', function (e) {\n    st.d = +e.target.value; st.optimal = false; $('o-d').textContent = st.d; update();\n  });\n  $('s-ph').addEventListener('change', function (e) {\n    st.ph = +e.target.value; st.optimal = false; $('o-ph').textContent = st.ph + '°'; update();\n  });\n  $('s-dp').addEventListener('input', function (e) {\n    st.dp = +e.target.value; st.optimal = false; $('o-dp').textContent = st.dp + ' mm'; update();\n  });\n  $('s-k').addEventListener('input', function (e) {\n    st.perm = +e.target.value; st.optimal = false; $('o-k').textContent = st.perm + ' mD'; update();\n  });\n  $('btn-opt').addEventListener('click', optimize);\n  $('btn-reset').addEventListener('click', function () {\n    st = Object.assign({}, DEFAULTS);\n    sync();\n    update();\n  });\n\n  sync();\n  update();\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：射孔参数智能优化</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>射孔参数智能优化 · 孔密 / 相位 / 穿深</h1>\n  <p class=\"lead\">拖动孔径参数，看孔道几何如何改变渗流面积、压实带损伤与成本。点击自动寻优，让代理模型在约束内给出推荐组合。</p>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n      <div class=\"section\">\n        <h2>① 射孔孔道剖面与井段分布</h2>\n        <p class=\"hint\">左侧为井眼横截面：灰色是套管，暗色环是水泥环，金色辐射线是射孔孔道，长度随穿深变化，方向数由相位角决定。右侧表示 1 m 井段内的孔数。</p>\n        <div class=\"split\">\n          <div class=\"chart-wrap\"><svg id=\"perf\" viewBox=\"0 0 430 256\" role=\"img\" aria-label=\"射孔孔道剖面\"></svg></div>\n          <div>\n            <div class=\"readouts one\">\n              <div class=\"ro\"><span>相对产能指数（无量纲）</span><b id=\"r-pi\">—</b></div>\n              <div class=\"ro\"><span>压实带表皮系数</span><b id=\"r-skin\">—</b></div>\n              <div class=\"ro\"><span>射孔成本（万元 / 10 m）</span><b id=\"r-cost\">—</b></div>\n            </div>\n            <div class=\"status\" id=\"status\" style=\"margin-top:8px\"></div>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <div class=\"side\">\n      <div class=\"section\">\n        <h2>② 调整射孔参数</h2>\n        <div class=\"controls\">\n          <div class=\"ctl\">\n            <label>孔密 <output id=\"o-d\">16</output></label>\n            <input type=\"range\" id=\"s-d\" min=\"8\" max=\"24\" step=\"1\" value=\"16\">\n            <span class=\"tip\">单位：孔 / m。孔密越高渗流面积越大，但压实带叠加、成本上升。</span>\n          </div>\n          <div class=\"ctl\">\n            <label>相位角 <output id=\"o-ph\">90°</output></label>\n            <select id=\"s-ph\">\n              <option value=\"60\">60°（6 相位）</option>\n              <option value=\"90\" selected>90°（4 相位）</option>\n              <option value=\"120\">120°（3 相位）</option>\n              <option value=\"180\">180°（2 相位）</option>\n            </select>\n            <span class=\"tip\">相位越密，井周覆盖越均匀；180° 定向射孔用于避水避气。</span>\n          </div>\n          <div class=\"ctl\">\n            <label>射孔弹穿深 <output id=\"o-dp\">450 mm</output></label>\n            <input type=\"range\" id=\"s-dp\" min=\"200\" max=\"800\" step=\"25\" value=\"450\">\n            <span class=\"tip\">必须穿透近井污染带，否则产能指数提升有限。</span>\n          </div>\n          <div class=\"ctl\">\n            <label>地层渗透率 <output id=\"o-k\">18 mD</output></label>\n            <input type=\"range\" id=\"s-k\" min=\"1\" max=\"100\" step=\"1\" value=\"18\">\n            <span class=\"tip\">低渗储层更依赖深穿透；高渗储层孔密收益更明显。</span>\n          </div>\n        </div>\n        <div class=\"btnrow\">\n          <button class=\"primary\" id=\"btn-opt\">自动寻优</button>\n          <button id=\"btn-reset\">恢复默认</button>\n          <span class=\"btn-note\">寻优范围：孔密 8—24 孔/m · 相位 60/90/120/180° · 穿深 200—800 mm</span>\n        </div>\n      </div>\n\n      <div class=\"section\">\n        <h2>③ 参数解释</h2>\n        <p class=\"hint\">产能指数采用代理模型近似：孔密与穿深决定渗流面积，相位决定井周覆盖均匀程度，压实带表皮抵消一部分收益。真实工程中应由数值模拟生成样本、再用代理模型加速寻优。</p>\n      </div>\n    </div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动孔密、相位角、穿深与渗透率，实时看射孔孔道剖面、相对产能指数、压实带表皮与成本的变化；点击「自动寻优」跳到约束内的推荐组合并高亮。",
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
