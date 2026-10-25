/* =========================================================
   案例插件（静态注册版）：压裂参数智能优化（排量/砂比/段簇）
   ---------------------------------------------------------
   由 cases/e1-frac-param-opt/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "e1-frac-param-opt",
    "sceneId": "e1",
    "methods": [
      "opt"
    ],
    "title": "压裂参数智能优化（排量/砂比/段簇）",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "水力压裂的段数、簇间距、排量与砂比共同决定裂缝半长、导流能力与施工成本。参数偏保守造缝不足，偏激进则砂堵、压窜或成本失控。",
        "judge": [
          {
            "label": "任务类型",
            "value": "多目标优化 + 代理模型",
            "desc": "产量、成本、风险同时权衡"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "施工曲线易得，裂缝真值需要监测"
          },
          {
            "label": "可见收益",
            "value": "极高",
            "desc": "单井 90 天累产可提升 20% 以上"
          },
          {
            "label": "难度",
            "value": "高",
            "desc": "地下裂缝不可直接观测，跨区迁移难"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>压裂设计通常沿用邻井经验：水平段 1,200—2,000 m，分 16—20 段，簇间距 20—30 m，排量 10—14 m³/min，砂比 15%—20%。这套参数在现场能施工，但不等于经济最优。</p><p>三个问题最典型：<b>规模边际递减</b>——段数增加会先提高产量，随后被缝间干扰和单段液量不足抵消，而成本近似线性上升；<b>砂堵是突变风险</b>——砂比 22% 配排量 6 m³/min，携砂能力不足，压力会在几分钟内抬升，处理不及时就砂堵；<b>裂缝不可直接观测</b>——半长、缝高、导流能力只能靠微地震、示踪剂或生产反演间接判断，试错成本高。</p><p>因此压裂优化不是「把每个参数调到最大」，而是在产量、成本与砂堵/压窜风险之间找可执行的平衡点。这个平衡点随储层应力、天然裂缝和井距变化，靠人工比选很难覆盖。</p><div class=\"figure\"><svg viewBox=\"0 0 640 240\" width=\"100%\" role=\"img\" aria-label=\"压裂段数与产量成本风险的权衡\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"240\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<line x1=\"58\" y1=\"200\" x2=\"604\" y2=\"200\" stroke=\"var(--ink-4)\"/>\n<line x1=\"58\" y1=\"34\" x2=\"58\" y2=\"200\" stroke=\"var(--ink-4)\"/>\n<rect x=\"420\" y=\"34\" width=\"184\" height=\"166\" fill=\"var(--bg-ts)\" opacity=\".45\"/>\n<text x=\"512\" y=\"50\" text-anchor=\"middle\" font-size=\"9\" fill=\"var(--c-ts)\">成本与砂堵风险上升区</text>\n<line x1=\"352\" y1=\"34\" x2=\"352\" y2=\"200\" stroke=\"var(--c-opt)\" stroke-width=\"1\" stroke-dasharray=\"4 3\"/>\n<text x=\"356\" y=\"48\" font-size=\"9\" fill=\"var(--c-opt)\">邻井经验 18 段</text>\n<polyline points=\"58,155 110,150 168,143 226,136 284,128 342,118 400,106 458,94 516,82 604,70\" fill=\"none\" stroke=\"#d0a85c\" stroke-width=\"2\"/>\n<polyline points=\"58,137 110,110 168,92 226,78 284,68 342,62 400,58 458,56 516,55 604,54\" fill=\"none\" stroke=\"var(--c-cv)\" stroke-width=\"2\"/>\n<polyline points=\"58,185 110,182 168,176 226,167 284,155 342,140 400,122 458,101 516,80 604,60\" fill=\"none\" stroke=\"var(--bad)\" stroke-width=\"1.6\" stroke-dasharray=\"4 3\"/>\n<text x=\"608\" y=\"72\" font-size=\"9\" fill=\"#d0a85c\">成本</text>\n<text x=\"608\" y=\"56\" font-size=\"9\" fill=\"var(--c-cv)\">产量</text>\n<text x=\"608\" y=\"86\" font-size=\"9\" fill=\"var(--bad)\">风险</text>\n<rect x=\"588\" y=\"44\" width=\"14\" height=\"3\" fill=\"var(--c-cv)\"/>\n<text x=\"58\" y=\"220\" font-size=\"9\" fill=\"var(--ink-4)\">段数 →</text>\n<text x=\"20\" y=\"42\" font-size=\"9\" fill=\"var(--ink-4)\" transform=\"rotate(-90 20 42)\">相对指标</text>\n<text x=\"68\" y=\"18\" font-size=\"9.5\" fill=\"var(--ink-3)\">段数增加不是线性增产：产量在 16 段后趋缓，成本与砂堵风险继续上升。</text>\n</svg><div class=\"figcap\"><b>图 1</b><span>压裂规模存在明显的边际递减：段数增加会先提高产量，随后被缝间干扰、单段液量不足与砂堵风险抵消，而成本近似线性上升。经验方案常停在 18 段，但并非经济最优。</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>把压裂设计建模成<b>代理模型辅助的多目标优化</b>。输入包括最小水平主应力、杨氏模量、泊松比、天然裂缝密度、水平段长度与井距；决策变量是段数、簇间距、排量、砂比与单段液量；输出是裂缝半长、导流能力、90 天累产、压裂成本与砂堵概率。</p><p>工程路径分三段：先用 Planar3D 或商业压裂软件生成 1,000—3,000 组样本，训练 GBDT 或高斯过程代理模型，把单次评估从小时级降到毫秒级；再用 NSGA-II 搜索「产量最大、成本最小」的 Pareto 前沿；最后叠加砂堵概率、净压力与缝高约束，筛出可施工方案。</p><div class=\"figure\"><svg viewBox=\"0 0 640 236\" width=\"100%\" role=\"img\" aria-label=\"泵注参数到裂缝几何再到产能与成本\">\n<rect x=\"0\" y=\"0\" width=\"640\" height=\"236\" rx=\"6\" fill=\"var(--paper-2)\"/>\n<defs><marker id=\"e1-a1\" markerWidth=\"7\" markerHeight=\"7\" refX=\"6\" refY=\"3\" orient=\"auto\"><path d=\"M0 0L6 3L0 6Z\" fill=\"var(--ink-4)\"/></marker></defs>\n<rect x=\"12\" y=\"30\" width=\"168\" height=\"142\" rx=\"8\" fill=\"var(--card)\" stroke=\"var(--c-opt)\"/>\n<text x=\"26\" y=\"50\" font-size=\"10.5\" font-weight=\"600\" fill=\"var(--c-opt)\">泵注与分段参数</text>\n<text x=\"26\" y=\"72\" font-size=\"9\" fill=\"var(--ink-2)\">排量 4—16 m³/min</text>\n<text x=\"26\" y=\"90\" font-size=\"9\" fill=\"var(--ink-2)\">砂比 5%—30%</text>\n<text x=\"26\" y=\"108\" font-size=\"9\" fill=\"var(--ink-2)\">段数 5—20</text>\n<text x=\"26\" y=\"126\" font-size=\"9\" fill=\"var(--ink-2)\">簇间距 15—40 m</text>\n<text x=\"26\" y=\"150\" font-size=\"8.5\" fill=\"var(--ink-4)\">决策变量 4 个</text>\n<line x1=\"182\" y1=\"101\" x2=\"214\" y2=\"101\" stroke=\"var(--ink-4)\" stroke-width=\"1.2\" marker-end=\"url(#e1-a1)\"/>\n<rect x=\"218\" y=\"30\" width=\"176\" height=\"142\" rx=\"8\" fill=\"var(--card)\" stroke=\"var(--c-cv)\"/>\n<text x=\"232\" y=\"50\" font-size=\"10.5\" font-weight=\"600\" fill=\"var(--c-cv)\">裂缝几何</text>\n<text x=\"232\" y=\"72\" font-size=\"9\" fill=\"var(--ink-2)\">半长 150—190 m</text>\n<text x=\"232\" y=\"90\" font-size=\"9\" fill=\"var(--ink-2)\">导流能力 20—50 D·cm</text>\n<text x=\"232\" y=\"108\" font-size=\"9\" fill=\"var(--ink-2)\">净压力 15—25 MPa</text>\n<text x=\"232\" y=\"126\" font-size=\"9\" fill=\"var(--ink-2)\">缝高 30—60 m</text>\n<text x=\"232\" y=\"150\" font-size=\"8.5\" fill=\"var(--ink-4)\">Planar3D 数值模拟</text>\n<line x1=\"396\" y1=\"101\" x2=\"428\" y2=\"101\" stroke=\"var(--ink-4)\" stroke-width=\"1.2\" marker-end=\"url(#e1-a1)\"/>\n<rect x=\"432\" y=\"30\" width=\"196\" height=\"142\" rx=\"8\" fill=\"var(--card)\" stroke=\"var(--jade)\"/>\n<text x=\"446\" y=\"50\" font-size=\"10.5\" font-weight=\"600\" fill=\"var(--jade)\">产能与成本</text>\n<text x=\"446\" y=\"72\" font-size=\"9\" fill=\"var(--ink-2)\">90 天累产 +26%</text>\n<text x=\"446\" y=\"90\" font-size=\"9\" fill=\"var(--ink-2)\">压裂成本 -9%</text>\n<text x=\"446\" y=\"108\" font-size=\"9\" fill=\"var(--ink-2)\">砂堵概率 ≤ 15%</text>\n<text x=\"446\" y=\"126\" font-size=\"9\" fill=\"var(--ink-2)\">Pareto 前沿 42 个方案</text>\n<text x=\"446\" y=\"150\" font-size=\"8.5\" fill=\"var(--ink-4)\">由代理模型秒级预测</text>\n<rect x=\"82\" y=\"186\" width=\"472\" height=\"34\" rx=\"6\" fill=\"var(--bg-opt)\" stroke=\"var(--c-opt)\" stroke-dasharray=\"4 3\"/>\n<text x=\"96\" y=\"207\" font-size=\"9.5\" fill=\"var(--ink-2)\">2,400 组数值模拟 → GBDT 代理（R² 0.91）→ NSGA-II 多目标搜索</text>\n<text x=\"12\" y=\"18\" font-size=\"9.5\" fill=\"var(--ink-3)\">参数不直接等于产量：必须先经过裂缝几何，再进入产能与成本评估。</text>\n</svg><div class=\"figcap\"><b>图 2</b><span>压裂优化的因果链是「泵注参数 → 裂缝几何 → 产能与成本」。代理模型负责把每组仿真从小时级压到毫秒级，多目标优化负责在产量、成本与砂堵风险之间找非支配解。</span></div></div><p>代理模型不能替代裂缝监测，但可以把「每口井都做几十组数值模拟」变成「每口井做一次快速寻优」。现场仍需用施工压力和微地震结果校准，尤其是砂堵与缝高失控这两类突变风险。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">压裂数据的特点是「施工数据多、地下真值少」。清单里前三项决定模型能不能算，第四项决定模型能不能信。勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">地质力学参数</span><span class=\"cl-s\">最小水平主应力、杨氏模量、泊松比、天然裂缝，每段一组</span></span><span class=\"cl-n\">测井 + 岩心 + 压裂测试</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">压裂施工曲线</span><span class=\"cl-s\">排量、井口压力、砂比、时间，1 Hz 采样</span></span><span class=\"cl-n\">每段一条曲线</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">裂缝监测与生产数据</span><span class=\"cl-s\">微地震或示踪剂半长、90 天日产与压力</span></span><span class=\"cl-n\">用于校准与回测</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">成本定额</span><span class=\"cl-s\">压裂液、支撑剂、泵注、分段费用，单井一套</span></span><span class=\"cl-n\">财务口径统一</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>高</b>。原因不是算法复杂，而是<b>真值稀缺</b>：裂缝半长和导流能力很难直接测量，微地震提供的是事件云，不是裂缝几何；生产数据又受井距、地层能量和作业制度影响。代理模型容易在训练集内表现很好，跨区块就失效。</p><p>三个必须正视的问题：<b>砂堵突变</b>——风险不是平滑函数，低排量高砂比附近会陡增；<b>缝高失控</b>——隔层应力差小于 3 MPa 时，裂缝可能穿层压窜；<b>多目标权重</b>——产量最高的方案往往成本也最高，必须输出 Pareto 前沿而不是单一答案。</p><p>建议先用同一区块 10—20 口井做迁移验证，把代理模型预测的半长与微地震解释对比，误差控制在 20% 以内再扩大范围；对砂堵与压窜样本，宁可单独建分类模型，也不要混进回归模型。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">多目标优化<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">代理模型<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">NSGA-II<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">帕累托前沿<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "某致密油水平井 18 段压裂参数优化",
        "lead": [
          "某致密油区块一口水平井水平段长 1,800 m，基质渗透率 0.05 mD，储层最小水平主应力 42—48 MPa。邻井采用 18 段、排量 10 m³/min、砂比 15%、簇间距 25 m，单井压裂成本约 1,150 万元，但 90 天累产差异达到 35%。",
          "项目目标是在成本不增加的前提下，把 90 天累产提高 20% 以上，并把砂堵概率控制在 15% 以内。下面的流程把「照抄邻井」改成「仿真—代理—多目标—现场校准」的闭环。"
        ],
        "stats": [
          [
            "水平段长",
            "1,800 m"
          ],
          [
            "设计段数",
            "5—20 段"
          ],
          [
            "数值模拟样本",
            "2,400 组"
          ],
          [
            "平均裂缝半长",
            "152 → 168 m"
          ],
          [
            "单井压裂成本",
            "1,150 → 1,046 万元"
          ],
          [
            "90 天累产",
            "+26%"
          ]
        ],
        "steps": [
          {
            "name": "地质工程甜点分段",
            "role": "数据",
            "do": "用测井曲线、地应力剖面与天然裂缝密度把水平段划分为 18 个候选段，段长 100 m；标出 3 个高应力段与 2 个天然裂缝发育段，作为后续约束。",
            "effect": "分段方案从「等间距切分」变成「按储层质量切分」",
            "trap": "只用自然伽马分段、不看应力，会把高应力段与甜点段混在一起"
          },
          {
            "name": "参数空间与数值仿真",
            "role": "建模",
            "do": "排量 4—16 m³/min、砂比 5%—30%、段数 5—20、簇间距 15—40 m；用 Planar3D 计算 2,400 组样本的裂缝半长、导流能力、净压力与砂堵概率。",
            "effect": "得到覆盖常见施工范围的样本库，单组仿真约 20—40 分钟",
            "trap": "仿真若忽略滤失与天然裂缝，会系统性高估裂缝半长"
          },
          {
            "name": "代理模型训练",
            "role": "算法核心",
            "do": "用 GBDT 与高斯过程分别拟合半长、导流能力、成本与砂堵概率，80% 样本训练、20% 验证，R² 达到 0.91；对砂堵概率单独做分类校正。",
            "effect": "单次评估从 30 分钟降到 5 ms，支持交互式寻优",
            "trap": "低排量高砂比样本稀疏，代理模型容易低估砂堵风险"
          },
          {
            "name": "多目标优化与约束筛选",
            "role": "优化",
            "do": "以 90 天累产最大、压裂成本最小为目标，约束砂堵概率小于 15%、净压力小于 25 MPa、缝高不穿隔层，用 NSGA-II 得到 42 个 Pareto 方案。",
            "effect": "推荐 16 段、排量 12 m³/min、砂比 18%、簇间距 22 m，预测累产 +26%",
            "trap": "只按产量排序会选中 20 段高砂比方案，成本与砂堵风险都超标"
          },
          {
            "name": "现场泵注与闭环校准",
            "role": "落地",
            "do": "按推荐方案施工，实时监测净压力与砂比，加砂后期控制提速；施工结束后用微地震半长与 90 天产量反演，更新代理模型参数。",
            "effect": "试验井未发生砂堵，成本下降 9%，90 天累产提高 26%",
            "trap": "加砂后期提速过快，会在最后 10 分钟诱发砂堵，前功尽弃"
          }
        ],
        "metrics": {
          "title": "怎么算「压裂方案好」",
          "html": "<p>压裂方案至少要看四个维度：<b>裂缝半长</b>（改造体积）、<b>导流能力</b>（支撑剂铺置质量）、<b>90 天累产</b>（直接收益）与<b>压裂成本</b>。单看产量会把方案推向「段数最多、砂比最高」，单看成本则造缝不足。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>邻井经验</th><th>优化方案</th><th>变化</th></tr></thead><tbody><tr><td>段数</td><td>18</td><td>16</td><td>-2 段</td></tr><tr><td>簇间距</td><td>25 m</td><td>22 m</td><td>-3 m</td></tr><tr><td>排量</td><td>10 m³/min</td><td>12 m³/min</td><td>+2 m³/min</td></tr><tr><td>砂比</td><td>15%</td><td>18%</td><td>+3 个百分点</td></tr><tr><td>平均裂缝半长</td><td>152 m</td><td>168 m</td><td>+10.5%</td></tr><tr><td>压裂成本</td><td>1,150 万元</td><td>1,046 万元</td><td>-9%</td></tr><tr><td>90 天累产</td><td>100%</td><td>126%</td><td>+26%</td></tr></tbody></table><p class=\"small muted\">注：优化方案减少了段数却提高了产量，原因是单段液量与砂比更合理，缝间干扰下降；这说明「规模最大」不等于「效果最好」。</p>"
        },
        "fails": [
          {
            "name": "砂堵风险被低估",
            "why": "砂比大于 22% 且排量低于 8 m³/min 时，携砂能力不足，压力会在数分钟内抬升。代理模型若缺少这类样本，会给出偏低的砂堵概率；必须单独建分类模型并设置硬约束。"
          },
          {
            "name": "裂缝高度失控",
            "why": "隔层与储层的最小水平主应力差小于 3 MPa 时，裂缝可能穿层压窜邻层或水层。仅优化半长与产量不会发现这个问题，需要把缝高约束写入优化。"
          },
          {
            "name": "成本约束缺失",
            "why": "20 段、30% 砂比、16 m³/min 的方案产量最高，但成本比邻井高 28%。若不做 Pareto 分析，推荐方案在财务上不可执行。"
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
        "data": "/* ======= 压裂参数智能优化 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  const $ = function (id) { return document.getElementById(id); };\n  const LATERAL = 1200;\n  const DEFAULTS = { q: 12, sand: 18, seg: 16 };\n  let st = { q: 12, sand: 18, seg: 16 };\n  let showPareto = false;\n\n  function calc(s) {\n    s = s || st;\n    const qF = Math.pow(s.q / 10, 0.45);\n    const sandF = Math.pow(s.sand / 15, 0.25);\n    const segF = Math.pow(16 / s.seg, 0.18);\n    const xf = 152 * qF * sandF * segF;\n    const cond = 24 * Math.pow(s.sand / 15, 0.9) * Math.pow(s.q / 10, 0.2) * Math.pow(16 / s.seg, 0.08);\n    const cost = 380 + s.seg * 38 + s.q * 9 + s.sand * 10;\n    const prod = 100 * Math.pow(xf / 152, 0.7) * Math.pow(cond / 24, 0.3) * Math.pow(s.seg / 16, 0.14);\n    const spacing = LATERAL / (s.seg * 3);\n    const risk = Math.max(0, Math.min(60, 8 + (s.sand - 15) * 1.5 + Math.max(0, 8 - s.q) * 5 +\n      Math.max(0, spacing - 30) * 0.6 - (s.seg - 10) * 0.25));\n    return { xf: xf, cond: cond, cost: cost, prod: prod, risk: risk, spacing: spacing };\n  }\n\n  function drawGeom(c) {\n    const W = 720, H = 300;\n    let g = '<rect x=\"0\" y=\"0\" width=\"' + W + '\" height=\"' + H + '\" fill=\"#0f130d\" rx=\"6\"/>';\n    g += '<rect x=\"40\" y=\"62\" width=\"640\" height=\"188\" rx=\"8\" fill=\"#161c13\" stroke=\"#2c3327\"/>';\n    g += '<text x=\"52\" y=\"80\" font-size=\"9.5\" fill=\"#8b8778\">储层段 · 水平段 ' + LATERAL + ' m</text>';\n    g += '<line x1=\"60\" y1=\"160\" x2=\"680\" y2=\"160\" stroke=\"#5b6358\" stroke-width=\"6\" stroke-linecap=\"round\"/>';\n    g += '<line x1=\"60\" y1=\"160\" x2=\"680\" y2=\"160\" stroke=\"#161c13\" stroke-width=\"2\"/>';\n    g += '<text x=\"678\" y=\"186\" text-anchor=\"end\" font-size=\"9\" fill=\"#8b8778\">水平井筒</text>';\n    const len = Math.min(100, c.xf * 0.5);\n    for (let i = 0; i < st.seg; i++) {\n      const x = 82 + (i + 0.5) / st.seg * 596;\n      g += '<line x1=\"' + x.toFixed(1) + '\" y1=\"' + (160 - len).toFixed(1) + '\" x2=\"' + x.toFixed(1) + '\" y2=\"' + (160 + len).toFixed(1) + '\" stroke=\"#d0a85c\" stroke-width=\"2.4\" opacity=\".85\"/>';\n      g += '<circle cx=\"' + x.toFixed(1) + '\" cy=\"' + (160 - len).toFixed(1) + '\" r=\"2.2\" fill=\"#d0a85c\"/>';\n      g += '<circle cx=\"' + x.toFixed(1) + '\" cy=\"' + (160 + len).toFixed(1) + '\" r=\"2.2\" fill=\"#d0a85c\"/>';\n    }\n    const x0 = 82 + 0.5 / st.seg * 596;\n    g += '<line x1=\"' + (x0 - 14) + '\" y1=\"' + (160 - len) + '\" x2=\"' + (x0 - 14) + '\" y2=\"' + (160 + len) + '\" stroke=\"#78b7a8\" stroke-width=\"1\" stroke-dasharray=\"3 3\"/>';\n    g += '<text x=\"' + (x0 - 18) + '\" y=\"' + (160 - len - 7) + '\" font-size=\"9.5\" fill=\"#78b7a8\" text-anchor=\"end\">半长 xf = ' + c.xf.toFixed(0) + ' m</text>';\n    g += '<text x=\"52\" y=\"238\" font-size=\"10\" fill=\"#c9c4b4\">段数 ' + st.seg + ' · 每段 3 簇 · 簇间距 ' + c.spacing.toFixed(1) + ' m</text>';\n    g += '<text x=\"52\" y=\"254\" font-size=\"9.5\" fill=\"#8b8778\">排量 ' + st.q.toFixed(1) + ' m³/min · 砂比 ' + st.sand + '%</text>';\n    g += '<circle cx=\"610\" cy=\"84\" r=\"3\" fill=\"#d0a85c\"/><text x=\"620\" y=\"87\" font-size=\"9\" fill=\"#8b8778\">裂缝（示意）</text>';\n    $('geom').innerHTML = g;\n  }\n\n  function mapX(v) { return 58 + (v - 650) / 1000 * 630; }\n  function mapY(v) { return 250 - (v - 40) / 130 * 220; }\n\n  function candidates() {\n    const list = [];\n    for (let q = 4; q <= 16; q += 2) {\n      for (let sand = 5; sand <= 30; sand += 5) {\n        for (let seg = 5; seg <= 20; seg += 3) {\n          list.push(calc({ q: q, sand: sand, seg: seg }));\n        }\n      }\n    }\n    return list;\n  }\n\n  function frontier(list) {\n    const sorted = list.slice().sort(function (a, b) { return a.cost - b.cost || b.prod - a.prod; });\n    const front = [];\n    let best = -Infinity;\n    sorted.forEach(function (p) {\n      if (p.prod > best + 0.01) { front.push(p); best = p.prod; }\n    });\n    return front;\n  }\n\n  function drawScatter(c) {\n    const W = 720, H = 300;\n    let g = '<rect x=\"0\" y=\"0\" width=\"' + W + '\" height=\"' + H + '\" fill=\"#0f130d\" rx=\"6\"/>';\n    [700, 900, 1100, 1300, 1500].forEach(function (v) {\n      const x = mapX(v);\n      g += '<line x1=\"' + x + '\" y1=\"30\" x2=\"' + x + '\" y2=\"250\" stroke=\"#242b20\" stroke-width=\"1\"/>';\n      g += '<text x=\"' + x + '\" y=\"266\" text-anchor=\"middle\" font-size=\"9\" fill=\"#7b8070\">' + v + '</text>';\n    });\n    [40, 60, 80, 100, 120, 140, 160].forEach(function (v) {\n      const y = mapY(v);\n      g += '<line x1=\"58\" y1=\"' + y + '\" x2=\"688\" y2=\"' + y + '\" stroke=\"#242b20\" stroke-width=\"1\"/>';\n      g += '<text x=\"50\" y=\"' + (y + 3) + '\" text-anchor=\"end\" font-size=\"9\" fill=\"#7b8070\">' + v + '</text>';\n    });\n    g += '<line x1=\"58\" y1=\"250\" x2=\"688\" y2=\"250\" stroke=\"#3a4433\"/>';\n    g += '<line x1=\"58\" y1=\"30\" x2=\"58\" y2=\"250\" stroke=\"#3a4433\"/>';\n    g += '<text x=\"688\" y=\"286\" text-anchor=\"end\" font-size=\"9.5\" fill=\"#8b8778\">压裂成本 / 万元</text>';\n    g += '<text x=\"58\" y=\"20\" font-size=\"9.5\" fill=\"#8b8778\">90 天累产（相对基准 / %）</text>';\n\n    const list = candidates();\n    list.forEach(function (p) {\n      g += '<circle cx=\"' + mapX(p.cost).toFixed(1) + '\" cy=\"' + mapY(p.prod).toFixed(1) + '\" r=\"2\" fill=\"#5e8f83\" opacity=\".38\"/>';\n    });\n    if (showPareto) {\n      const fr = frontier(list);\n      let pts = '';\n      fr.forEach(function (p) {\n        const x = mapX(p.cost).toFixed(1), y = mapY(p.prod).toFixed(1);\n        pts += x + ',' + y + ' ';\n        g += '<circle cx=\"' + x + '\" cy=\"' + y + '\" r=\"3.4\" fill=\"#78b7a8\"/>';\n      });\n      g += '<polyline points=\"' + pts.trim() + '\" fill=\"none\" stroke=\"#78b7a8\" stroke-width=\"1.4\" opacity=\".75\"/>';\n      g += '<text x=\"' + (mapX(fr[fr.length - 1].cost) - 8) + '\" y=\"' + (mapY(fr[fr.length - 1].prod) - 10) + '\" text-anchor=\"end\" font-size=\"9\" fill=\"#78b7a8\">帕累托前沿</text>';\n    }\n    g += '<circle cx=\"' + mapX(c.cost).toFixed(1) + '\" cy=\"' + mapY(c.prod).toFixed(1) + '\" r=\"5.5\" fill=\"#d0a85c\" stroke=\"#0f130d\" stroke-width=\"1.5\"/>';\n    g += '<text x=\"' + (mapX(c.cost) + 9) + '\" y=\"' + (mapY(c.prod) - 8) + '\" font-size=\"9\" fill=\"#d0a85c\">当前</text>';\n    $('scatter').innerHTML = g;\n  }\n\n  function update() {\n    const c = calc();\n    drawGeom(c);\n    drawScatter(c);\n    $('r-xf').textContent = c.xf.toFixed(0) + ' m';\n    $('r-cond').textContent = c.cond.toFixed(1) + ' D·cm';\n    $('r-cost').textContent = c.cost.toFixed(0) + ' 万元';\n    $('r-risk').textContent = c.risk.toFixed(1) + '%';\n    const stEl = $('status');\n    if (c.risk >= 20) {\n      stEl.className = 'status bad';\n      stEl.innerHTML = '<b>砂堵风险高</b><span>砂堵概率 ' + c.risk.toFixed(1) +\n        '%，当前砂比 ' + st.sand + '% 与排量 ' + st.q.toFixed(1) + ' m³/min 的组合携砂能力不足，建议降低砂比或提高排量。</span>';\n    } else if (c.cost > 1350) {\n      stEl.className = 'status warn';\n      stEl.innerHTML = '<b>成本超限</b><span>压裂成本 ' + c.cost.toFixed(0) +\n        ' 万元，超过 1,350 万元上限。可减少段数或优化单段规模，先用帕累托前沿找可接受的产量损失。</span>';\n    } else {\n      stEl.className = 'status ok';\n      stEl.innerHTML = '<b>推荐方案</b><span>半长 ' + c.xf.toFixed(0) + ' m、导流能力 ' + c.cond.toFixed(1) +\n        ' D·cm、成本 ' + c.cost.toFixed(0) + ' 万元、砂堵概率 ' + c.risk.toFixed(1) + '%，处于推荐区间。</span>';\n    }\n  }\n\n  function sync() {\n    $('s-q').value = st.q;\n    $('s-sand').value = st.sand;\n    $('s-seg').value = st.seg;\n    $('o-q').textContent = st.q.toFixed(1) + ' m³/min';\n    $('o-sand').textContent = st.sand + '%';\n    $('o-seg').textContent = st.seg;\n  }\n\n  $('s-q').addEventListener('input', function (e) { st.q = +e.target.value; sync(); update(); });\n  $('s-sand').addEventListener('input', function (e) { st.sand = +e.target.value; sync(); update(); });\n  $('s-seg').addEventListener('input', function (e) { st.seg = +e.target.value; sync(); update(); });\n  $('btn-pareto').addEventListener('click', function () {\n    showPareto = !showPareto;\n    $('btn-pareto').textContent = showPareto ? '隐藏帕累托前沿' : '帕累托寻优';\n    drawScatter(calc());\n  });\n  $('btn-reset').addEventListener('click', function () {\n    st = Object.assign({}, DEFAULTS);\n    showPareto = false;\n    $('btn-pareto').textContent = '帕累托寻优';\n    sync();\n    update();\n  });\n\n  sync();\n  update();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：压裂参数智能优化</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>压裂参数智能优化 · 排量 / 砂比 / 段簇</h1>\n  <p class=\"lead\">拖动排量、砂比与段数，看裂缝半长、导流能力、成本与砂堵风险如何联动。点击帕累托寻优，观察「成本—产量」权衡空间里的非支配前沿。</p>\n\n  <div class=\"section\">\n    <h2>① 裂缝几何与施工指标</h2>\n    <p class=\"hint\">水平井筒上方与下方对称的线条代表压裂裂缝，长度按裂缝半长缩放。段数增加会缩短簇间距，但单段液量减少，半长与导流能力都会变化。</p>\n    <div class=\"split\">\n      <div class=\"chart-wrap\"><svg id=\"geom\" viewBox=\"0 0 720 300\" role=\"img\" aria-label=\"水平井多段压裂裂缝示意\"></svg></div>\n      <div>\n        <div class=\"readouts\" style=\"grid-template-columns:repeat(2,1fr)\">\n          <div class=\"ro\"><span>裂缝半长</span><b id=\"r-xf\">—</b></div>\n          <div class=\"ro\"><span>导流能力</span><b id=\"r-cond\">—</b></div>\n          <div class=\"ro\"><span>压裂成本</span><b id=\"r-cost\">—</b></div>\n          <div class=\"ro\"><span>砂堵概率</span><b id=\"r-risk\">—</b></div>\n        </div>\n        <div class=\"status\" id=\"status\" style=\"margin-top:12px\"></div>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"section\">\n    <h2>② 调整泵注与分段参数</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>排量 <output id=\"o-q\">12 m³/min</output></label>\n        <input type=\"range\" id=\"s-q\" min=\"4\" max=\"16\" step=\"0.5\" value=\"12\">\n        <span class=\"tip\">排量越高，缝内净压力与裂缝半长越大，但设备与摩阻成本上升。</span>\n      </div>\n      <div class=\"ctl\">\n        <label>砂比 <output id=\"o-sand\">18%</output></label>\n        <input type=\"range\" id=\"s-sand\" min=\"5\" max=\"30\" step=\"1\" value=\"18\">\n        <span class=\"tip\">砂比决定支撑剂铺置浓度与导流能力；过高且排量不足时砂堵风险陡增。</span>\n      </div>\n      <div class=\"ctl\">\n        <label>段数 <output id=\"o-seg\">16</output></label>\n        <input type=\"range\" id=\"s-seg\" min=\"5\" max=\"20\" step=\"1\" value=\"16\">\n        <span class=\"tip\">水平段 1,200 m，每段 3 簇。段数越多，簇间距越密，但单段规模下降。</span>\n      </div>\n    </div>\n    <div class=\"btnrow\">\n      <button class=\"primary\" id=\"btn-pareto\">帕累托寻优</button>\n      <button id=\"btn-reset\">恢复默认</button>\n      <span class=\"btn-note\">候选空间：排量 4—16 m³/min · 砂比 5%—30% · 段数 5—20</span>\n    </div>\n  </div>\n\n  <div class=\"section\">\n    <h2>③ 成本—产量权衡空间</h2>\n    <p class=\"hint\">每个灰点是一组候选参数，金色大点是当前方案。点击帕累托寻优后，绿色点与折线表示在不增加成本的前提下无法再提高产量的非支配方案。</p>\n    <div class=\"chart-wrap\"><svg id=\"scatter\" viewBox=\"0 0 720 300\" role=\"img\" aria-label=\"压裂成本与产量散点图\"></svg></div>\n    <div class=\"legend\">\n      <span><i class=\"dot\" style=\"background:#5e8f83\"></i>候选方案</span>\n      <span><i class=\"dot\" style=\"background:#d0a85c\"></i>当前方案</span>\n      <span><i class=\"dot\" style=\"background:#78b7a8\"></i>帕累托前沿</span>\n    </div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动排量、砂比与段数，实时看裂缝几何、半长、导流能力、成本与砂堵概率的变化；点击「帕累托寻优」，在成本—产量散点图上显示非支配前沿。",
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
