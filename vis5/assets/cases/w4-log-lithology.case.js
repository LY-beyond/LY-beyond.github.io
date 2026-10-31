/* =========================================================
   案例插件（静态注册版）：测井岩性智能识别
   ---------------------------------------------------------
   由 cases/w4-log-lithology/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "w4-log-lithology",
    "sceneId": "w4",
    "methods": [
      "ts"
    ],
    "title": "测井岩性智能识别",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "二连盆地某火山岩油藏 26 口井，岩性要在玄武岩、安山岩、凝灰岩、砂砾岩、泥岩五类之间分清，而凝灰岩只占定名层点的 **4%**、薄层常不足 0.5 m。人工 GR—DEN 交会图判对率约 68%，凝灰岩几乎全被判成泥岩；多曲线融合加类别加权后，总体准确率 89%、宏平均 F1 0.79。",
        "judge": [
          {
            "label": "任务类型",
            "value": "多曲线分类 + 序列标注",
            "desc": "逐点输出五类岩性概率并做层序平滑"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "岩心与薄片定名，单井 100—300 个层点"
          },
          {
            "label": "可见收益",
            "value": "中",
            "desc": "单井岩性解释 2.5 h → 8 min，稀有类可辨"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "类别不均衡，同岩性不同响应"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>岩性识别是测井解释的基础任务。传统做法是拉 GR—DEN、GR—CNL 交会图，人工划出岩性分区，再把每口井的落点映射成岩性名。火山岩油藏的问题在于同一岩性响应漂移大：玄武岩 GR 低、密度高，安山岩居中，凝灰岩 GR 高、密度低，但蚀变安山岩 GR 可升高 20 API、密度降 0.15 g/cm³，直接落进凝灰岩区；裂缝与含油也会让密度测井失真。26 口井人工解释单井 2.5 h，两名解释员对同一段的岩性定名有 12% 不一致。</p><p>可用的信息比交会图多：常规 GR、DEN、CNL、RT 之外还有伽马能谱的 K、Th、U——凝灰质富 K、泥质富 Th、铀与有机质及裂缝相关，能谱能把凝灰岩从泥岩里分开。9 口取心井、1,240 个定名层点、320 片薄片提供了标签，薄片还能把「凝灰岩」细分为凝灰质砂砾岩等过渡类型。</p><p>硬约束：① 类别极不均衡——泥岩占 46%、凝灰岩只占 4%，任何以总体准确率为目标的模型都会把凝灰岩全判成泥岩；② 薄层——0.3—0.5 m 的凝灰岩夹层只有 2—4 个采样点，层序平滑一不小心就抹掉；③ 跨井刻度——老井 GR 刻度比新井高 10—15 API，不归一化会被学成岩性差异。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 替换的是「交会图分区 + 人工定名」：输入 GR、DEN、CNL、RT 与 K、Th、U 共 8 条曲线、17 点窗口，用梯度提升树与 1D CNN 集成输出五类概率，再叠加层序约束（CRF）抑制 0.25 m 内反复跳类。输出不止一个岩性名，还有 top-2 概率、依据曲线与「岩性组合」标记。</p><p>训练要点：类权重按频率的 −1/2 次方设置，凝灰岩样本过采样；模型选择看宏平均 F1 与每类召回，不看总体准确率；验证按井留出，避免同井相邻层点泄漏。薄层单独构造样本，并对层序平滑设置「薄层保护」规则。</p><p>定位是辅助定名：模型给出岩性概率与证据，解释员复核低置信段、蚀变段与凝灰岩段。不全自动的原因：蚀变、裂缝、含油都会改变测井响应，过渡岩性本身没有唯一答案，且岩性直接决定射孔与压裂选层。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">标签质量比数据量重要，先做薄片校验把凝灰岩从泥岩里拆出来，再谈类别加权。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">测井曲线</span><span class=\"cl-s\">GR、DEN、CNL、RT 加 K、Th、U，0.125 m，26 口井</span></span><span class=\"cl-n\">无需逐点标注</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩心定名</span><span class=\"cl-s\">9 口取心井、1,240 个层点</span></span><span class=\"cl-n\">五类岩性，逐层入库</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">薄片鉴定</span><span class=\"cl-s\">320 片，覆盖凝灰岩与过渡岩性</span></span><span class=\"cl-n\">提高标签质量，拆分混淆类</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩屑描述</span><span class=\"cl-s\">1 m 一包</span></span><span class=\"cl-n\">补充未取心段标签，需剔除混样</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">区域岩性剖面</span><span class=\"cl-s\">邻井连井对比与层序格架</span></span><span class=\"cl-n\">作为层序约束，无需标注</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">难点是稀有类与响应漂移，模型很容易在总体指标上「看起来很好」。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"\"></i></div><p>难度 <b>中</b>。挑战按影响排序：① 类别不均衡——泥岩近半，全判泥岩总体准确率就有 46%，凝灰岩召回为 0；② 同岩性不同响应——蚀变、裂缝、含油让落点漂移，固定边界必然失效；③ 薄层与过渡段——0.3 m 夹层只有 2 个采样点，平滑与保留之间需要显式规则。</p><p>评估建议：宏平均 F1 ≥0.75、凝灰岩 F1 ≥0.55、薄层（&lt;0.5 m）召回 ≥70%；总体准确率只作参考；混淆矩阵必须逐类报。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">序列分类<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">多曲线融合<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">交会图对比基线<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "二连盆地某火山岩油藏 26 口井的岩性识别",
        "lead": [
          "油藏岩性为玄武岩、安山岩、凝灰岩、砂砾岩与泥岩五类，泥岩占 46%、玄武岩 27%、安山岩 14%、砂砾岩 9%、凝灰岩 4%。9 口取心井提供 1,240 个定名层点、320 片薄片，人工交会图判对率 68%。",
          "项目做多曲线融合分类与层序平滑。目标：总体准确率 ≥88%、宏平均 F1 ≥0.75、凝灰岩 F1 ≥0.55，单井解释从 2.5 h 压到 8 min。"
        ],
        "stats": [
          [
            "识别井数",
            "26 口"
          ],
          [
            "岩性类别",
            "5 类"
          ],
          [
            "定名层点",
            "1,240 个"
          ],
          [
            "稀缺类占比",
            "4%（凝灰岩）"
          ],
          [
            "人工解释",
            "2.5 h/井"
          ],
          [
            "模型识别",
            "8 min/井"
          ]
        ],
        "steps": [
          {
            "name": "标签整理与薄片校验",
            "role": "标注",
            "do": "把 9 口取心井 1,240 个层点统一到五类，用 320 片薄片把凝灰岩从泥岩中拆出，剔除蚀变无定名段 88 点。",
            "effect": "标签一致率从 82% 提到 94%",
            "trap": "直接用岩屑定名当标签——岩屑混杂且迟到，凝灰岩与泥岩常混样，稀有类标签先被噪声毁掉"
          },
          {
            "name": "曲线标准化",
            "role": "数据",
            "do": "按井对 GR、DEN、CNL 做刻度校正，以稳定泥岩段作刻度锚点；能谱用 Th—K 交会检查仪器一致性。",
            "effect": "同岩性跨井曲线中位数离散度从 18% 降到 7%",
            "trap": "不做井间标准化——老井 GR 偏高 10—15 API，模型会把仪器差异学成岩性差异"
          },
          {
            "name": "类别加权分类",
            "role": "算法核心",
            "do": "GBDT 与 1D CNN 集成，8 条曲线、17 点窗口，类权重按频率 −1/2 次方，凝灰岩过采样 3 倍，按井留出验证。",
            "effect": "总体准确率 89%，宏平均 F1 0.79，凝灰岩 F1 0.63",
            "trap": "用总体准确率挑模型——全判泥岩也有 46%，会把真正能识别稀有类的模型全部淘汰"
          },
          {
            "name": "层序平滑",
            "role": "算法核心",
            "do": "用 CRF 对逐点概率加深度连续性约束，禁止 0.25 m 内反复跳类；对 <0.5 m 的薄层设保护规则，概率超过 0.7 不清除。",
            "effect": "薄层误判下降 37%，界面更完整",
            "trap": "平滑权重过大——0.3 m 凝灰岩夹层被整段抹掉，储层段被错判成泥岩"
          },
          {
            "name": "复核与成果输出",
            "role": "质控",
            "do": "输出 top-2 概率与依据曲线，低置信（<0.6）段、凝灰岩段、蚀变段进人工复核清单，允许标注「岩性组合」。",
            "effect": "26 口井复核 1.5 天，改判率 6.8%",
            "trap": "只输出单一岩性名——过渡段与蚀变段本无唯一答案，强制单标签会让解释员不信任结果"
          }
        ],
        "metrics": {
          "title": "怎么算「识别得住」",
          "html": "<p>反直觉的陷阱：总体准确率 92% 的模型，宏平均 F1 可能只有 0.60——泥岩占近一半，稀有类全错也能很漂亮。火山岩储层恰恰靠凝灰岩、安山岩这些少数类来划分有利相带，所以模型选择必须看<b>宏平均 F1 与每类召回</b>，并逐类看混淆矩阵。第二个陷阱是薄层：层序平滑能把整体指标抬高，但代价可能是把 0.3 m 凝灰岩夹层抹平。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>交会图基线</th><th>本方案</th></tr></thead><tbody><tr><td>总体准确率</td><td>井留出逐点</td><td>68%</td><td>89%</td></tr><tr><td>宏平均 F1</td><td>五类等权</td><td>0.52</td><td>0.79</td></tr><tr><td>凝灰岩 F1</td><td>最稀缺类</td><td>0.28</td><td>0.63</td></tr><tr><td>薄层（&lt;0.5 m）召回</td><td>78 个薄层</td><td>41%</td><td>72%</td></tr><tr><td>单井解释耗时</td><td>26 口井</td><td>2.5 h</td><td>8 min</td></tr><tr><td>复核改判率</td><td>人工复核后改判</td><td>—</td><td>6.8%</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "类别不均衡被总体准确率掩盖",
            "why": "泥岩占 46%，全判泥岩准确率接近一半，凝灰岩召回可以是 0，但报表很好看。解决：类加权 + 按类报指标，模型选择以宏平均 F1 为准，并对凝灰岩单独设门槛。"
          },
          {
            "name": "同岩性不同响应",
            "why": "蚀变安山岩 GR 升高 20 API、密度降 0.15 g/cm³，落进凝灰岩区，固定交会边界必错。解决：加入 K、Th、U 能谱与蚀变指示特征，蚀变段单列「蚀变岩」类或直接降级人工。"
          },
          {
            "name": "跨井刻度差异",
            "why": "老井 GR 比新井高 10—15 API，模型把仪器差异学成岩性差异，跨井迁移时整段错判。解决：井间标准化，以稳定泥岩段做刻度锚点，并把刻度校正写入处理流程。"
          },
          {
            "name": "层序平滑抹掉薄层",
            "why": "平滑能提高整体一致率，但 0.3 m 凝灰岩夹层只占 2 个采样点，最容易被清掉，而它可能是有利储层。解决：薄层保护规则 + 高频残差监督，交付时标出低置信薄层。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
