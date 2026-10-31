/* =========================================================
   案例插件（静态注册版）：钻时曲线地层智能划分
   ---------------------------------------------------------
   由 cases/m4-ropcurve-layering/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "m4-ropcurve-layering",
    "sceneId": "m4",
    "methods": [
      "ts"
    ],
    "title": "钻时曲线地层智能划分",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "鄂尔多斯盆地某致密油区块一年钻 50 余口定向井，钻时 0.5 m 一个点、单井 3,800—5,200 点，岩屑迟到时间随井深与排量在 **18—42 min** 之间变化。解释员对照钻时、岩屑与气测卡取 26 个标志层，单井 4 h，界面深度常差 1—2 m；把钻井参数归一后的钻时做变点检测，边界误差可压到 0.7 m。",
        "judge": [
          {
            "label": "任务类型",
            "value": "时序分割 + 变点检测",
            "desc": "逐点判界面，输出深度与置信度"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "需 30—50 口井人工划分作标签"
          },
          {
            "label": "可见收益",
            "value": "中",
            "desc": "单井 4 h → 6 min，区块 9 天 → 1 天"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "迟到时间与钻头磨损的影响大于地层信号"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>钻时是每米钻进耗时，间接反映岩石可钻性，是录井阶段判断岩性变化、卡取层界面的主要依据。现场做法是解释员把钻时曲线、1 m 一包的岩屑描述、气测异常三样摆在一起看：钻时突然变大往往意味着进入硬层，变小则可能是泥岩或欠压实地层。单井 3,800—5,200 点，人工划 26 个标志层要 4 h，一个区块 52 口井要 9 天，界面深度与测井校正值常差 1—2 m。</p><p>单曲线信息量有限：钻时同时受钻压 80—140 kN、转速 60—90 r/min、排量 28—34 L/s、钻头磨损与井底清洁程度影响。同一层段在不同井的钻时可差 40%，同一口井后 500 m 因钻头磨损整体抬升 20%。把钻时换算成机械比能（MSE），或把钻井参数作为协变量回归掉，剩下的才是岩性信号。</p><p>硬约束：① 岩屑迟到时间 18—42 min，按 0.5—1 m/min 机械钻速折算就是 9—42 m 的深度错位，不校正直接对岩屑卡层会整体错层；② 可钻性相近的岩性（泥岩与泥灰岩）钻时只差 8%，低于工况噪声；③ 工区只有 30—50 口井做过系统人工分层，标签本身带 1—2 m 的主观误差。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 替换的是「看曲线找突变、手工卡层」这一步：输入钻时、钻压、转速、排量、立压、钻头型号与入井时间，先按井径与套管程序分段计算环空容积、做迟到时间校正，再算 MSE 并对钻头磨损做趋势去除，最后用 1D U-Net 或贝叶斯在线变点检测输出界面深度与概率。</p><p>标签用 30—50 口井的人工分层，按 ±1 m 容差匹配，容差内不计错；训练时把岩屑定名与气测异常作为辅助通道，强迫模型学到「钻时平缓但岩屑已变」的界面。输出不止深度，还给每个界面的依据曲线段与置信度。</p><p>定位是辅助卡层：模型给出候选界面与置信度，地质员复核后用于取心、完钻与套管程序决策。不全自动的原因：迟到时间依赖现场排量与井径实测，钻头磨损无法精确建模，且卡层错误会直接影响井身结构与地质成果。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">钻时与钻井参数都在录井仪里，缺的是迟到时间校正常量表和人工分层标签，先补这两样。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">钻时曲线</span><span class=\"cl-s\">0.5—1 m 一点，52 口井，单井 3,800—5,200 点</span></span><span class=\"cl-n\">人工划分 26 个标志层，30—50 口井</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">钻井参数</span><span class=\"cl-s\">钻压、转速、排量、立压、钻头型号与入井时间</span></span><span class=\"cl-n\">用于归一化，无需标注</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井身结构与迟到时间</span><span class=\"cl-s\">井径、套管程序、排量分段记录</span></span><span class=\"cl-n\">用于深度校正，逐段建表</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩屑描述</span><span class=\"cl-s\">1 m 一包，岩性定名与百分比</span></span><span class=\"cl-n\">交叉验证界面</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">气测曲线</span><span class=\"cl-s\">1 m 一点，全烃与组分</span></span><span class=\"cl-n\">辅助验证，无需单独标注</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">迟到时间校正不准，标签和预测会一起偏；钻头磨损是无法完全消除的系统漂移。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"\"></i></div><p>难度 <b>中</b>。挑战按影响排序：① 迟到时间——井深从 1,200 m 到 3,400 m、排量不变时环空容积差近 2 倍，全井用一个迟到时间会让界面上移 1.5—3 m；② 钻头磨损——新钻头与后期钻时差 20%，模型会把磨损当岩性变硬，制造假界面；③ 弱界面——泥岩到泥灰岩可钻性只差 8%，单靠钻时无法分辨，必须多源融合。</p><p>评估建议：界面按 ±1 m 容差匹配，查全率 ≥85%、查准率 ≥85%、边界平均误差 ≤0.8 m；界面数偏差控制在 ±2 个以内；单井分层 ≤10 min。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">变点检测<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">多源融合<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">迟到时间校正<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "鄂尔多斯盆地某致密油区块 52 口定向井的钻时分层",
        "lead": [
          "区块目的层为长 7 致密砂岩，钻井周期 9—14 天，52 口定向井井深 2,100—3,400 m，钻时 0.5 m 一点。迟到时间按井深与排量在 18—42 min 之间，岩屑 1 m 一包，26 个标志层中 8 个是区域对比关键层。",
          "项目做迟到时间校正 + 钻时归一化 + 变点检测，目标：界面查全率 ≥85%、边界误差 ≤0.8 m、单井分层 ≤10 min，区块一轮分层从 9 天压到 1 天。"
        ],
        "stats": [
          [
            "分层井数",
            "52 口"
          ],
          [
            "单井采样点",
            "3,800—5,200 点"
          ],
          [
            "标志层",
            "26 个"
          ],
          [
            "迟到时间",
            "18—42 min"
          ],
          [
            "人工分层",
            "4 h/井"
          ],
          [
            "模型分层",
            "6 min/井"
          ]
        ],
        "steps": [
          {
            "name": "迟到时间校正",
            "role": "数据",
            "do": "按井径、套管程序与排量分段计算环空容积，把 18—42 min 的迟到时间逐段折算成深度偏移，岩屑深度对齐到钻头深度。",
            "effect": "岩屑与钻时错位从 1.8 m 降到 0.4 m",
            "trap": "全井用一个迟到时间——深部井段环空大、迟到时间长，界面会整体上移 1.5—3 m"
          },
          {
            "name": "钻时归一化",
            "role": "算法核心",
            "do": "计算 MSE 并对钻压、转速、排量做回归剔除，按钻头入井时间做磨损趋势去除，再按井分段 z-score。",
            "effect": "同层跨井钻时离散度从 42% 降到 11%",
            "trap": "直接对原始钻时做滑动平均——会把真实界面抹成 3—5 m 的缓变带，边界无从谈起"
          },
          {
            "name": "变点检测模型",
            "role": "算法核心",
            "do": "1D U-Net 输入 6 通道、200 点窗口，输出逐点界面概率；标签按 ±1 m 容差，正负样本按 1:4 采样。",
            "effect": "界面 F1 0.86，边界平均误差 0.7 m",
            "trap": "只追界面数量不追匹配——过分割把 26 个标志层切成 40 个，召回上去了 F1 反而降"
          },
          {
            "name": "多源交叉验证",
            "role": "质控",
            "do": "逐界面与岩屑定名、气测异常、随钻伽马比对，钻时与岩屑冲突的界面降级为「待复核」，并记录冲突类型。",
            "effect": "31 个冲突界面，复核后修正 24 个",
            "trap": "只信钻时——泥岩与泥灰岩可钻性只差 8%，单曲线必错，且错在关键标志层上"
          },
          {
            "name": "分层成果输出",
            "role": "工程环节",
            "do": "输出分层表、置信度、依据曲线段，地质员复核后用于取心与完钻决策；低置信界面自动附邻井对比。",
            "effect": "52 口井 1 天完成，取心卡层命中 18/20",
            "trap": "只给深度不给依据——现场无法判断该不该取心，最后仍回到人工逐段看曲线"
          }
        ],
        "metrics": {
          "title": "怎么算「分层可信」",
          "html": "<p>反直觉的陷阱：按点算准确率能到 97% 以上——26 个界面在 5,000 个采样点里只占 26 个点，模型一个界面都不给也有 99.5% 的准确率。界面任务是典型的极端不平衡，必须用<b>界面级 precision / recall 加带容差匹配</b>。另一个陷阱是容差设得过宽：±3 m 容差下查全率能轻松到 95%，但 3 m 错位已经足以让取心错过目标层。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>人工基线</th><th>本方案</th></tr></thead><tbody><tr><td>界面查全率</td><td>26 个标志层，±1 m</td><td>74%</td><td>89%</td></tr><tr><td>界面查准率</td><td>预测界面中正确匹配</td><td>81%</td><td>86%</td></tr><tr><td>边界平均误差</td><td>与岩屑 / 测井校正值</td><td>1.6 m</td><td>0.7 m</td></tr><tr><td>界面数偏差</td><td>预测数 − 实际数</td><td>−3 至 +5</td><td>+1</td></tr><tr><td>单井分层耗时</td><td>3,800—5,200 点</td><td>4 h</td><td>6 min</td></tr><tr><td>区块分层周期</td><td>52 口井</td><td>9 天</td><td>1 天</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "迟到时间不随井深校正",
            "why": "全井用一个迟到时间，深部岩屑实际迟到更久，界面系统性上移 1.5—3 m，卡层直接卡错。解决：按井径、套管与排量分段算环空容积，逐段更新迟到时间并做深度偏移。"
          },
          {
            "name": "钻头磨损造成基线漂移",
            "why": "同一口井后 500 m 钻时整体抬升 20%，模型把磨损当成岩性变硬，制造假界面。解决：把钻头入井时间与新度作为协变量，或按井段做趋势去除，再谈变点。"
          },
          {
            "name": "可钻性相近的界面漏检",
            "why": "泥岩到泥灰岩钻时只降 8%，低于工况噪声，单钻时模型必然漏。解决：强制引入岩屑定名与气测，钻时只做初筛，冲突界面一律进人工复核。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
