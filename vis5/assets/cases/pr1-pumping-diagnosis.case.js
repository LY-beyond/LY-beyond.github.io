/* =========================================================
   案例插件（静态注册版）：抽油机井工况诊断：示功图深度学习分类
   ---------------------------------------------------------
   由 cases/pr1-pumping-diagnosis/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "pr1-pumping-diagnosis",
    "sceneId": "pr1",
    "methods": [
      "cv"
    ],
    "title": "抽油机井工况诊断：示功图深度学习分类",
    "version": "1.0.0",
    "updated": "2026-10-23",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "中国陆上油田 80% 的原油来自有杆泵抽油井，每口井每天产出一张示功图——光杆载荷 vs 位移的闭合曲线。不同工况在曲线上呈现不同形态：供液不足是\"瘦梨形\"，气锁顶部有平段，泵漏回程载荷下不去……熟练的采油工程师能一眼认出，但全国几万口井每天几万张图，靠人一张张看不现实。",
        "judge": [
          {
            "label": "任务类型",
            "value": "图像分类",
            "desc": "把示功图曲线当\"图\"来分类"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "历史示功图有工程师评级，但可能不统一"
          },
          {
            "label": "可见收益",
            "value": "极高",
            "desc": "自动异常报警 = 几十小时巡检工时"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "数据量大，工况类别定义清晰"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>一个采油厂管理数千口抽油机井，每口井每天采 1—24 张示功图。传统做法是：值班人员每天扫一遍\"异常榜单\"（载荷超阈值），然后人工逐点开看。能靠阈值抓出极端异常（如断脱），但很多工况（如供液不足、气锁）的载荷不超阈值，只是<b>形态不对</b>，扫榜单扫不出来。</p><p>问题有三：<b>覆盖不全</b>——只靠阈值告警漏了 60% 以上的常见工况；<b>响应滞后</b>——巡检周期通常 1—3 天，气锁拖一天产量损失 5—10%；<b>标准不统一</b>——不同工程师对同一示功图的工况判断可能不一致（尤其是泵漏和游动阀漏的边界）。</p><div class='figure'><svg viewBox='0 0 720 255' width='100%' role='img' aria-label='地面示功图与折算泵功图形态对比'><rect x='0' y='0' width='720' height='255' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 地面示功图 → 泵功图</text><text x='60' y='44' font-size='9.5' fill='var(--ink-2)'>地面示功图</text><text x='420' y='44' font-size='9.5' fill='var(--ink-2)'>泵功图（折算后）</text><line x1='60' y1='58' x2='60' y2='205' stroke='var(--line)'/><line x1='60' y1='205' x2='310' y2='205' stroke='var(--line)'/><line x1='420' y1='58' x2='420' y2='205' stroke='var(--line)'/><line x1='420' y1='205' x2='665' y2='205' stroke='var(--line)'/><path d='M82 186 C105 178 130 166 160 155 C205 140 255 130 290 124 L292 138 C288 164 262 180 222 187 C180 194 120 194 88 191 Z' fill='var(--jade)' opacity='0.1' stroke='var(--ink-2)' stroke-width='1.8'/><path d='M442 180 C468 172 500 162 535 155 C578 148 625 143 650 140 L650 152 C646 168 620 180 585 185 C545 190 490 188 450 184 Z' fill='var(--jade)' opacity='0.1' stroke='var(--ink-2)' stroke-width='1.8'/><text x='132' y='118' font-size='9' fill='var(--ink-3)'>面积 = 光杆做功</text><text x='492' y='128' font-size='9' fill='var(--ink-3)'>面积 = 泵做功</text><path d='M316 150 L400 150' stroke='var(--ink-3)' stroke-width='1.4'/><path d='M400 146 L410 150 L400 154 Z' fill='var(--ink-3)'/><text x='358' y='141' font-size='9' fill='var(--ink-3)' text-anchor='middle'>泵功图折算</text><text x='185' y='232' font-size='9' fill='var(--ink-3)' text-anchor='middle'>位移</text><text x='545' y='232' font-size='9' fill='var(--ink-3)' text-anchor='middle'>位移</text><text x='42' y='130' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 42 130)'>载荷</text><text x='402' y='130' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 402 130)'>载荷</text><text x='18' y='250' font-size='9' fill='var(--ink-3)'>地面示功图叠加惯性力、摩擦与液柱载荷；泵功图更接近泵实际受力，面积反映有效做功</text></svg><div class='figcap'><b>图 1</b><span>地面示功图叠加了惯性力、摩擦与液柱载荷；折算为泵功图后面积更接近泵实际做功</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 把示功图看成一张\"图\"——把载荷-位移序列规范化后画成固定大小的二值图/灰度图，输入卷积网络（如 ResNet、EfficientNet）输出多分类概率。7 个常见工况：正常、供液不足、气锁、泵漏、断脱、游动阀漏、固定阀漏。</p><p>为什么这是 CV 任务而不是时序任务？因为关键信息在<b>曲线形状</b>而不是序列顺序——上下冲程的闭合形态、顶部/底部的平坦段、边角的突刺……这些都是\"形态学\"特征，用 CV 的卷积核天然适合捕捉。实际工程中通常做两条路线：① CV 路线（图像化 + 2D CNN）和② 时序路线（1D CNN + LSTM），两者融合效果最好。</p><div class='figure'><svg viewBox='0 0 720 245' width='100%' role='img' aria-label='供液不足气锁泵漏三类故障示功图形态'><rect x='0' y='0' width='720' height='245' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>B · 典型故障示功图形态对比</text><text x='28' y='44' font-size='10' fill='var(--ink-2)'>供液不足（瘦梨形）</text><text x='258' y='44' font-size='10' fill='var(--ink-2)'>气锁（顶部平段）</text><text x='488' y='44' font-size='10' fill='var(--ink-2)'>泵漏（回程载荷不降）</text><line x1='50' y1='56' x2='50' y2='165' stroke='var(--line)'/><line x1='45' y1='165' x2='205' y2='165' stroke='var(--line)'/><line x1='280' y1='56' x2='280' y2='165' stroke='var(--line)'/><line x1='275' y1='165' x2='435' y2='165' stroke='var(--line)'/><line x1='510' y1='56' x2='510' y2='165' stroke='var(--line)'/><line x1='505' y1='165' x2='665' y2='165' stroke='var(--line)'/><path d='M62 150 C92 146 140 142 185 136 L185 150 C145 155 100 157 68 155 Z' fill='var(--jade)' opacity='0.1' stroke='var(--ink-2)' stroke-width='1.6'/><text x='88' y='126' font-size='9' fill='var(--ink-3)'>瘦梨形</text><path d='M292 148 L292 92 C292 76 312 70 340 70 L410 68 L410 82 C404 118 386 142 360 150 Z' fill='var(--jade)' opacity='0.1' stroke='var(--ink-2)' stroke-width='1.6'/><text x='326' y='62' font-size='9' fill='var(--ink-3)'>顶部平段</text><path d='M600 62 L520 74 L508 138 L602 112 Z' fill='var(--jade)' opacity='0.1' stroke='var(--ink-2)' stroke-width='1.6'/><text x='522' y='158' font-size='9' fill='var(--bad)'>回程载荷高</text><text x='25' y='198' font-size='9' fill='var(--ink-3)'>上下冲程载荷差小，泵充满度低</text><text x='255' y='198' font-size='9' fill='var(--ink-3)'>气体未压缩，上冲程顶部出现平段</text><text x='485' y='198' font-size='9' fill='var(--ink-3)'>游动阀关闭不严，下冲程载荷下降缓慢</text><text x='28' y='180' font-size='9' fill='var(--ink-3)'>位移</text><text x='258' y='180' font-size='9' fill='var(--ink-3)'>位移</text><text x='488' y='180' font-size='9' fill='var(--ink-3)'>位移</text><text x='34' y='112' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 34 112)'>载荷</text><text x='264' y='112' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 264 112)'>载荷</text><text x='494' y='112' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 494 112)'>载荷</text></svg><div class='figcap'><b>图 2</b><span>供液不足呈瘦梨形，气锁顶部有平段，泵漏下冲程载荷不下降——三类形态是分类模型的主要依据</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">示功图是采油环节最丰富的数据类型之一——每口井每天多张：</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">示功图原始数据</span><span class=\"cl-s\">50—200 Hz，单冲程 500—2000 点</span></span><span class=\"cl-n\">单井每日 1—24 幅</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">工况标注</span><span class=\"cl-s\">至少 5 万张，覆盖 7 类</span></span><span class=\"cl-n\">历史工程师评级</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">生产辅助参数</span><span class=\"cl-s\">冲程、冲次、泵径、液量、含水、油压套压</span></span><span class=\"cl-n\">单井日数据</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">作业真值</span><span class=\"cl-s\">检泵作业结论</span></span><span class=\"cl-n\">断脱位置、泵况、阀况</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中</b>。核心挑战有二：<b>工况边界模糊</b>——泵漏和游动阀漏的示功图形态高度相似，很多样本即使专家也难分；<b>概念漂移</b>——同一口井随泵磨损加剧，示功图逐渐从\"正常\"变成\"泵漏\"，这个渐变过程会让模型困惑。</p><p>反直觉的发现：<b>做二分类（正常 vs 异常）比做多分类容易得多</b>。先做\"有没有问题\"的粗筛，异常图再进多分类模型细分——比直接做 7 分类的召回率高很多，因为粗筛阶段可以用\"异常检出即警报\"的策略。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/cv\">卷积网络<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">形态学特征<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">孪生网络<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">概念漂移检测<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "某采油厂 36 万张示功图的工况分类系统",
        "lead": [
          "某采油厂 3 年积累了 36 万张抽油机井示功图，覆盖 7 类常见工况。目标是训练一个实时分类模型，替代人工巡检，并对接自动巡检系统。",
          "一个有趣的发现：加入冲程/冲次/泵径等生产参数后，\"泵漏 vs 游动阀漏\"的分类 F1 从 0.58 提升到 0.81——说明\"同样的示功图形态，不同生产参数下含义不同\"这个直觉是对的。"
        ],
        "stats": [
          [
            "示功图总数",
            "36 万"
          ],
          [
            "工况类别",
            "7"
          ],
          [
            "验证集 Macro F1",
            "0.84"
          ],
          [
            "异常召回率",
            "92%"
          ],
          [
            "日均巡检井次",
            "2300 → 0 (自动)"
          ]
        ],
        "steps": [
          {
            "name": "数据清洗与规范化",
            "role": "工程环节",
            "do": "把 36 万张示功图的载荷-位移序列统一格式，消除采集系统差异。每张图：截取一个完整冲程、归一化到 [0,1] 载荷和 [0,1] 位移、统一为 256×256 像素的二值图（曲线宽度 2px）。",
            "effect": "得到统一输入格式的图像数据集",
            "trap": "有些示功图是\"半个冲程\"或不完整闭合曲线，需要过滤或特殊处理"
          },
          {
            "name": "标签整理与一致性校验",
            "role": "数据",
            "do": "历史标签可能来自不同时期不同工程师，需要标准化：合并同义词（如\"供液不足\"和\"气供不足\"统一成一类）、对有争议的样本请两位专家复核、删除标注不确定的样本。最终保留 28 万张高置信度标注。",
            "effect": "标签置信度 ≥ 0.7 的干净数据集",
            "trap": "删除太多样本导致某些少数类（如断脱）样本量不足"
          },
          {
            "name": "模型训练",
            "role": "算法核心",
            "do": "双分支架构：CV 分支（EfficientNet-B0 处理 256×256 图像）+ 数值分支（MLP 处理冲程/冲次/泵径/液量等参数），特征拼接后接 7 类 softmax。数据增强：随机缩放、平移、小角度旋转（模拟采集抖动）。",
            "effect": "验证集 Macro F1 0.84，异常召回率 92%",
            "trap": "只用图像分支的 F1 是 0.76——数值特征很重要"
          },
          {
            "name": "热启动部署 + 闭环",
            "role": "落地",
            "do": "模型导出为 TorchScript 或 ONNX，部署在边缘计算节点上，实时接收示功图。每张图 50ms 内返回分类概率 + 置信度。置信度 < 0.6 的样本自动推送到\"待复核\"队列，由值班工程师标记后回流到训练集。",
            "effect": "每天自动处理 5000+ 张图，复核队列 50—100 张",
            "trap": "没有闭环回流，模型 3 个月后会因概念漂移而性能下降"
          },
          {
            "name": "与巡检系统对接",
            "role": "集成",
            "do": "分类结果推送到巡检调度系统：正常井 → 标记通过；异常井（非\"正常\"类）→ 按严重程度排序派单；断脱/泵漏 → 红色告警，自动推送井号+建议措施给调度。",
            "effect": "从\"人工巡检 → 发现异常 → 派工\"变成\"自动扫描 → 异常告警 → 派工\"",
            "trap": "假阳性太多会让调度麻木——初期需要阈值调节"
          }
        ],
        "metrics": {
          "title": "怎么算\"分类对了\"",
          "html": "<p>示功图分类看两个指标：<b>宏平均 F1</b>（每类 F1 取平均，对少数类公平）和 <b>异常召回率</b>（所有非\"正常\"工况被找出来的比例，业务最关心）。</p><table class=\"dtable\"><thead><tr><th>工况</th><th>占比</th><th>精确率</th><th>召回率</th><th>F1</th></tr></thead><tbody><tr><td>正常</td><td>62%</td><td>0.94</td><td>0.93</td><td>0.93</td></tr><tr><td>供液不足</td><td>14%</td><td>0.85</td><td>0.88</td><td>0.86</td></tr><tr><td>气锁</td><td>8%</td><td>0.82</td><td>0.85</td><td>0.83</td></tr><tr><td>泵漏</td><td>7%</td><td>0.78</td><td>0.80</td><td>0.79</td></tr><tr><td>断脱</td><td>4%</td><td>0.90</td><td>0.86</td><td>0.88</td></tr><tr><td>游动阀漏</td><td>3%</td><td>0.72</td><td>0.75</td><td>0.73</td></tr><tr><td>固定阀漏</td><td>2%</td><td>0.70</td><td>0.73</td><td>0.71</td></tr></tbody></table><p class=\"small muted\">注：泵漏 vs 游动阀漏 vs 固定阀漏 是公认的\"三难分类\"，三者形态高度相似，必须结合生产参数才能区分。</p>"
        },
        "fails": [
          {
            "name": "漂移导致性能下降",
            "why": "同一台泵使用半年后，示功图会因为磨损逐渐变形，但标签还是\"正常\"。模型会困惑，把渐变的\"正常磨损\"误判成\"泵漏\"。解决：持续学习 + 漂移检测。"
          },
          {
            "name": "采集系统差异",
            "why": "不同采油厂的示功图采集系统有不同的缩放和平移习惯，导致模型在跨区块部署时 AUC 下降。解决：加入域适应层或用多区块混合训练。"
          },
          {
            "name": "假阳性疲劳",
            "why": "模型在\"泵漏 vs 游动阀漏\"的边界样本上可能一半概率猜错，导致巡检队每天收到 50 条告警但 30 条是错的，逐渐麻木。解决：分层阈值——高置信度直接告警，低置信度进复核队列。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "/* ========= 示功图工况诊断示范样式 ========= */\n* { box-sizing: border-box; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #fbfaf6;\n  color: #242b2e;\n  font-size: 12px;\n  padding: 10px 12px;\n  line-height: 1.5;\n}\n.panel { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0,1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }\nh2 { font-size: 12.5px; font-weight: 600; margin: 2px 0 6px; color: #235f51; }\nh3 { font-size: 11.5px; font-weight: 600; margin: 8px 0 4px; color: #235f51; }\n.lead { font-size: 11.5px; color: #4d565b; margin: 0 0 10px; }\n.hint { font-size: 10.5px; color: #79828a; margin: 0 0 6px; }\n.section { background: #fff; border: 1px solid #e9e4d8; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }\n\n/* 工况按钮 */\n.case-grid { display: grid; grid-template-columns: 1fr; gap: 6px; }\n.case-btn {\n  display: flex; flex-direction: column; align-items: flex-start;\n  padding: 6px 8px; border-radius: 7px;\n  border: 1.5px solid #e9e4d8; background: #fdfcf9;\n  cursor: pointer; transition: all .15s;\n  text-align: left; font-family: inherit;\n}\n.case-btn b { font-size: 11.5px; font-weight: 600; color: #242b2e; }\n.case-btn span { font-size: 10px; color: #79828a; margin-top: 1px; }\n.case-btn:hover { border-color: #2f7d6b; }\n.case-btn.active { border-color: #2f7d6b; background: #e6f1ec; }\n\n/* 主面板 */\n.section.main { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }\n.well-diag { min-width: 0; }\n.well-diag svg { background: #fdfcf9; border-radius: 8px; }\n.ai-panel { min-width: 0; }\nsvg { display: block; width: 100%; max-width: 100%; height: auto; }\n\n/* AI 概率条 */\n.probs { display: flex; flex-direction: column; gap: 4px; }\n.prob-row { display: flex; align-items: center; gap: 6px; font-size: 10.5px; }\n.prob-row .pl { width: 56px; color: #5d666d; flex-shrink: 0; font-weight: 500; }\n.prob-row .pb { flex: 1; height: 10px; background: #f5f2ea; border-radius: 4px; overflow: hidden; position: relative; }\n.prob-row .pf { height: 100%; border-radius: 4px; transition: width .35s; }\n.prob-row .pv { width: 34px; text-align: right; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 9.5px; color: #235f51; font-weight: 600; }\n\n/* AI 判定 */\n.verdict-wrap { margin-top: 8px; padding: 7px 9px; border-radius: 6px; background: #f5f2ea; }\n.ai-verdict { font-size: 15px; font-weight: 700; color: #235f51; font-family: 'JetBrains Mono', Consolas, monospace; }\n.ai-confidence { font-size: 10px; color: #79828a; margin-top: 2px; }\n.ai-desc { margin-top: 6px; font-size: 11px; color: #4d565b; line-height: 1.5; }\n\n/* 特征 */\n.features { display: flex; flex-direction: column; gap: 3px; }\n.feat { display: flex; gap: 5px; font-size: 10.5px; padding: 2px 0; color: #4d565b; }\n.feat b { color: #235f51; font-weight: 600; flex-shrink: 0; }\n\n/* 参数控制 */\n.controls { display: grid; grid-template-columns: 1fr !important; gap: 6px; }\n.ctl { display: flex; flex-direction: column; gap: 3px; padding: 6px 8px; background: #f5f2ea; border-radius: 7px; }\n.ctl label { font-size: 11.5px; display: flex; justify-content: space-between; font-weight: 500; }\n.ctl output { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: #2f7d6b; width: 100%; }\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 抽油机井示功图工况诊断 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  // ---------- 状态 ----------\n  let S = {\n    case: 'normal',\n    S: 3.0,     // 冲程 m\n    N: 6,       // 冲次 次/分\n    d: 56,      // 泵径 mm\n    noise: 1    // 噪声 1-4\n  };\n\n  const CASES = [\n    { key: 'normal', label: '正常' },\n    { key: 'underfill', label: '供液不足' },\n    { key: 'gaslock', label: '气锁' },\n    { key: 'pumploss', label: '泵漏' },\n    { key: 'rodbreak', label: '断脱' },\n    { key: 'ballleak', label: '游动阀漏' }\n  ];\n\n  // ---------- 随机数 ----------\n  function mulberry32(a) {\n    return function () {\n      a |= 0; a = a + 0x6D2B79F5 | 0;\n      var t = Math.imul(a ^ a >>> 15, 1 | a);\n      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;\n      return ((t ^ t >>> 14) >>> 0) / 4294967296;\n    };\n  }\n\n  // ---------- 示功图生成 ----------\n  function generateDyn(caseKey, params, seed) {\n    const rnd = mulberry32(seed || 42);\n    const gauss = () => {\n      let u = 0, v = 0;\n      while (u === 0) u = rnd();\n      while (v === 0) v = rnd();\n      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);\n    };\n\n    const N = 200; // 采样点（整个冲程）\n    const stroke = params.S; // m\n    const maxLoad = params.d * params.S * 0.18 + 30; // kN（简化估算）\n\n    // 载荷随位移的函数（0→stroke→0，上冲程 + 下冲程）\n    const points = [];\n    for (let i = 0; i <= N; i++) {\n      const t = i / N;\n      let x, load;\n      const noiseAmp = params.noise * 4;\n\n      if (t < 0.5) {\n        // 上冲程：位移 0 → stroke\n        x = t * 2 * stroke;\n        // 基本加载曲线（从最小载荷开始）\n        const base = 0.4 + t * 0.6; // 0.4 → 1.0\n        load = base;\n\n        if (caseKey === 'normal') {\n          // 正常：平滑上升\n          load = 0.35 + Math.sin(t * Math.PI) * 0.65;\n        } else if (caseKey === 'underfill') {\n          // 供液不足：上冲程正常，但泵未充满\n          load = 0.4 + Math.sin(t * Math.PI) * 0.55;\n        } else if (caseKey === 'gaslock') {\n          // 气锁：上冲程顶部平段（气体先被压缩）\n          if (t < 0.3) load = 0.35 + (t / 0.3) * 0.25;\n          else if (t < 0.6) load = 0.6 + Math.sin((t - 0.3) / 0.3 * Math.PI) * 0.25;\n          else load = 0.85; // 平段\n        } else if (caseKey === 'pumploss') {\n          // 泵漏：上冲程基本正常\n          load = 0.4 + Math.sin(t * Math.PI) * 0.55;\n        } else if (caseKey === 'rodbreak') {\n          // 断脱：上冲程到一半载荷突然掉\n          if (t < 0.35) load = 0.35 + (t / 0.35) * 0.55;\n          else load = 0.05; // 掉为 0\n        } else if (caseKey === 'ballleak') {\n          // 游动阀漏：上冲程载荷缓慢上升（液体漏回）\n          load = 0.35 + Math.pow(t, 0.6) * 0.55; // 缓上升\n        }\n      } else {\n        // 下冲程：位移 stroke → 0\n        const t2 = t - 0.5;\n        x = stroke - t2 * 2 * stroke;\n\n        if (caseKey === 'normal') {\n          load = 0.85 - Math.sin(t2 * Math.PI) * 0.55;\n        } else if (caseKey === 'underfill') {\n          // 供液不足：下冲程前半段载荷很低（空段）\n          if (t2 < 0.35) load = 0.25 + t2 * 0.3; // 低载荷段\n          else load = 0.35 + Math.sin((t2 - 0.35) / 0.65 * Math.PI) * 0.55;\n        } else if (caseKey === 'gaslock') {\n          load = 0.85 - Math.sin(t2 * Math.PI) * 0.55;\n        } else if (caseKey === 'pumploss') {\n          // 泵漏：回程载荷下不去（液体漏失）\n          load = 0.85 - Math.pow(t2, 1.5) * 0.35; // 缓下降，末端仍高\n        } else if (caseKey === 'rodbreak') {\n          load = 0.05; // 全程 0\n        } else if (caseKey === 'ballleak') {\n          load = 0.85 - Math.sin(t2 * Math.PI) * 0.55;\n        }\n      }\n\n      // 噪声\n      load += gauss() * noiseAmp / maxLoad;\n      load = Math.max(0.02, Math.min(1, load));\n\n      points.push({ x, y: load * maxLoad });\n    }\n\n    return { points, stroke, maxLoad };\n  }\n\n  // ---------- AI 分类（基于形态特征的规则引擎）----------\n  function aiClassify(dyn) {\n    const pts = dyn.points;\n    const N = pts.length;\n    const half = Math.floor(N / 2);\n\n    // 特征提取\n    const up = pts.slice(0, half);     // 上冲程\n    const down = pts.slice(half);      // 下冲程\n\n    // F1: 上冲程顶部是否有平段（气锁特征）\n    let flatTop = 0;\n    for (let i = half - 20; i < half; i++) {\n      flatTop += Math.abs(pts[i].y - pts[i-1].y);\n    }\n    flatTop = flatTop / 20;\n\n    // F2: 最大载荷位置（断脱特征）\n    const maxY = Math.max(...pts.map(p => p.y));\n    const maxYIdx = pts.findIndex(p => p.y === maxY);\n    const loadDrop = pts.slice(maxYIdx + 1).reduce((a, p) => a + (p.y < maxY * 0.3 ? 1 : 0), 0);\n\n    // F3: 下冲程起始段载荷（供液不足）\n    const downFirstY = down.slice(0, 15).reduce((a, p) => a + p.y, 0) / 15;\n\n    // F4: 下冲程末端载荷（泵漏特征）\n    const downEndY = down.slice(-15).reduce((a, p) => a + p.y, 0) / 15;\n\n    // F5: 上冲程开头载荷上升速度（游动阀漏）\n    const upSlope = (up[10].y - up[0].y) / 10;\n\n    // F6: 闭合度（正常 vs 异常）\n    const closeDiff = Math.abs(pts[0].y - pts[N-1].y);\n\n    // 规则分类（带置信度）\n    let probs = { normal: 0.15, underfill: 0.1, gaslock: 0.1, pumploss: 0.1, rodbreak: 0.1, ballleak: 0.1 };\n\n    // 断脱：载荷突然掉到很低\n    if (maxYIdx < half * 0.6 && loadDrop > half) {\n      probs.rodbreak += 0.55;\n    }\n\n    // 气锁：顶部有明显平段\n    if (flatTop < 2 && up[half-1].y > maxY * 0.8) {\n      probs.gaslock += 0.45;\n    }\n\n    // 供液不足：下冲程起始载荷低\n    if (downFirstY < maxY * 0.38) {\n      probs.underfill += 0.45;\n    }\n\n    // 泵漏：下冲程末端载荷仍高（回程下不去）\n    if (downEndY > maxY * 0.55) {\n      probs.pumploss += 0.35;\n    }\n\n    // 游动阀漏：上冲程开头斜率小（缓慢上升）\n    if (upSlope < 1.5 && pts[half * 0.7].y < maxY * 0.6) {\n      probs.ballleak += 0.30;\n    }\n\n    // 正常：没有明显异常特征\n    const abnormalScore = probs.rodbreak + probs.gaslock + probs.underfill + probs.pumploss + probs.ballleak - 0.5;\n    if (abnormalScore < 0.2) {\n      probs.normal += 0.55;\n    } else {\n      probs.normal += Math.max(0, 0.35 - abnormalScore * 0.3);\n    }\n\n    // 归一化\n    const sum = Object.values(probs).reduce((a, b) => a + b, 0);\n    Object.keys(probs).forEach(k => probs[k] = probs[k] / sum);\n\n    // 特征描述\n    const features = [];\n    if (flatTop < 2) features.push({ k: '顶部平段', v: '明显（气锁）' });\n    if (maxYIdx < half * 0.6) features.push({ k: '载荷突变', v: '上冲程中部掉载（疑似断脱）' });\n    if (downFirstY < maxY * 0.38) features.push({ k: '下冲程起始', v: '载荷偏低（泵未充满）' });\n    if (downEndY > maxY * 0.55) features.push({ k: '下冲程末端', v: '载荷仍高（泵漏液）' });\n    if (upSlope < 1.5) features.push({ k: '上冲程加载', v: '缓慢（游动阀漏）' });\n    if (features.length === 0) features.push({ k: '整体形态', v: '饱满四边形，上下对称' });\n\n    return { probs, features };\n  }\n\n  // ---------- 主示功图渲染 ----------\n  function drawDyn(dyn) {\n    const svg = document.getElementById('dyn');\n    const W = 360, H = 216;\n    const padL = 36, padR = 8, padT = 16, padB = 26;\n    const plotW = W - padL - padR, plotH = H - padT - padB;\n\n    const XMAX = dyn.stroke * 1.1;\n    const YMAX = dyn.maxLoad * 1.15;\n\n    function xOf(v) { return padL + v / XMAX * plotW; }\n    function yOf(v) { return padT + (1 - v / YMAX) * plotH; }\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 网格\n    for (let v = 0; v <= XMAX; v += 1) {\n      s += `<line x1=\"${xOf(v)}\" y1=\"${padT}\" x2=\"${xOf(v)}\" y2=\"${padT + plotH}\" stroke=\"#efece1\"/>`;\n      s += `<text x=\"${xOf(v)}\" y=\"${H - 16}\" font-size=\"8\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">${v.toFixed(0)}</text>`;\n    }\n    for (let v = 0; v <= YMAX; v += Math.round(YMAX / 5)) {\n      const y = yOf(v);\n      s += `<line x1=\"${padL}\" y1=\"${y}\" x2=\"${padL + plotW}\" y2=\"${y}\" stroke=\"#efece1\"/>`;\n      s += `<text x=\"${padL - 6}\" y=\"${y + 3}\" font-size=\"8\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">${v.toFixed(0)}</text>`;\n    }\n\n    // 冲程中心线\n    s += `<line x1=\"${xOf(dyn.stroke / 2)}\" y1=\"${padT}\" x2=\"${xOf(dyn.stroke / 2)}\" y2=\"${padT + plotH}\" stroke=\"#ddd7c8\" stroke-width=\"1\" stroke-dasharray=\"2 2\"/>`;\n\n    // 示功图路径\n    let path = '';\n    for (let i = 0; i < dyn.points.length; i++) {\n      const p = dyn.points[i];\n      path += (i ? 'L' : 'M') + xOf(p.x).toFixed(1) + ' ' + yOf(p.y).toFixed(1) + ' ';\n    }\n    path += 'Z';\n\n    // 填充（半透明）\n    s += `<path d=\"${path}\" fill=\"rgba(47,125,107,0.18)\" stroke=\"none\"/>`;\n    s += `<path d=\"${path}\" fill=\"none\" stroke=\"#235f51\" stroke-width=\"2\" stroke-linejoin=\"round\"/>`;\n\n    // 冲程起止点标注\n    s += `<circle cx=\"${xOf(0)}\" cy=\"${yOf(dyn.points[0].y)}\" r=\"3\" fill=\"#2f7d6b\"/>`;\n    s += `<text x=\"${xOf(0) - 5}\" y=\"${yOf(dyn.points[0].y) - 5}\" font-size=\"8\" fill=\"#2f7d6b\" font-family=\"monospace\" text-anchor=\"end\">起</text>`;\n    const midPt = dyn.points[Math.floor(dyn.points.length / 2)];\n    s += `<circle cx=\"${xOf(midPt.x)}\" cy=\"${yOf(midPt.y)}\" r=\"3\" fill=\"#b26a39\"/>`;\n    s += `<text x=\"${xOf(midPt.x) + 5}\" y=\"${yOf(midPt.y) - 5}\" font-size=\"8\" fill=\"#b26a39\" font-family=\"monospace\">满</text>`;\n\n    // 轴标签\n    s += `<text x=\"${padL}\" y=\"${padT - 6}\" font-size=\"8.5\" fill=\"#9ba3a9\" font-family=\"monospace\">载荷 kN ↑</text>`;\n    s += `<text x=\"${padL + plotW / 2}\" y=\"${padT + plotH + 20}\" font-size=\"8.5\" fill=\"#9ba3a9\" text-anchor=\"middle\">位移 m →</text>`;\n\n    svg.innerHTML = s;\n  }\n\n  // ---------- AI 结果渲染 ----------\n  function drawAI(probs, features) {\n    const labels = {\n      normal: '正常',\n      underfill: '供液不足',\n      gaslock: '气锁',\n      pumploss: '泵漏',\n      rodbreak: '断脱',\n      ballleak: '游动阀漏'\n    };\n\n    // 概率条\n    const order = Object.keys(probs).sort((a, b) => probs[b] - probs[a]);\n    const probEl = document.getElementById('probs');\n    probEl.innerHTML = order.map(k => `\n      <div class=\"prob-row\">\n        <span class=\"pl\">${labels[k]}</span>\n        <div class=\"pb\"><div class=\"pf\" style=\"width:${(probs[k] * 100).toFixed(1)}%;background:${k === order[0] ? '#235f51' : '#b26a39'}\"></div></div>\n        <span class=\"pv\">${(probs[k] * 100).toFixed(0)}%</span>\n      </div>\n    `).join('');\n\n    // 判定\n    const best = order[0];\n    const conf = probs[best];\n    document.getElementById('ai-verdict').textContent = labels[best];\n    document.getElementById('ai-confidence').textContent = `置信度 ${(conf * 100).toFixed(0)}% · 次选 ${labels[order[1]]} ${(probs[order[1]] * 100).toFixed(0)}%`;\n\n    // 描述\n    const descs = {\n      normal: '示功图形态饱满，上下冲程载荷对称，无明显异常特征。当前井工况正常，可继续按制度生产。',\n      underfill: '下冲程前半段载荷偏低，说明泵未被液体充满。可能原因：供液能力不足、油井缺液。建议排查液面。',\n      gaslock: '上冲程顶部出现明显平段，是气体被压缩后不传递压力的典型特征。建议：提高泵深或增加放气频率。',\n      pumploss: '下冲程末端载荷仍偏高，回程压力下不去——活塞与缸套之间存在漏失。建议安排检泵作业。',\n      rodbreak: '载荷在上冲程中部突然掉到 0，典型的光杆断脱特征。需要立即停机检泵，更换光杆或打捞断杆。',\n      ballleak: '上冲程载荷缓慢上升，游动阀关闭滞后。可能是游动阀磨损或有杂质卡滞，影响泵效。'\n    };\n    document.getElementById('ai-desc').textContent = descs[best] || '';\n\n    // 特征\n    document.getElementById('features').innerHTML = features.map(f =>\n      `<div class=\"feat\"><b>${f.k}</b>: ${f.v}</div>`\n    ).join('');\n  }\n\n  // ---------- 典型工况一览 ----------\n  function drawGallery() {\n    const svg = document.getElementById('gallery');\n    const W = 430, H = 230;\n    const cols = 3, rows = 2;\n    const pad = 8, margin = 12;\n    const cellW = (W - margin * 2 - pad * (cols - 1)) / cols;\n    const cellH = (H - margin * 2 - pad * (rows - 1)) / rows;\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    CASES.forEach((c, idx) => {\n      const col = idx % cols, row = Math.floor(idx / cols);\n      const cx = margin + col * (cellW + pad);\n      const cy = margin + row * (cellH + pad);\n      const innerPad = 10;\n      const iW = cellW - innerPad * 2;\n      const iH = cellH - innerPad * 2;\n\n      const dyn = generateDyn(c.key, { S: 3.0, d: 56, noise: 1 }, idx * 7 + 1);\n      const XMAX = 3.5, YMAX = dyn.maxLoad * 1.15;\n\n      // 背景\n      s += `<rect x=\"${cx}\" y=\"${cy}\" width=\"${cellW}\" height=\"${cellH}\" rx=\"6\" fill=\"#f5f2ea\"/>`;\n\n      // 小网格\n      for (let v = 0; v <= XMAX; v += 1) {\n        s += `<line x1=\"${cx + innerPad + v / XMAX * iW}\" y1=\"${cy + innerPad}\" x2=\"${cx + innerPad + v / XMAX * iW}\" y2=\"${cy + innerPad + iH}\" stroke=\"#e9e4d8\"/>`;\n      }\n      for (let v = 0; v <= YMAX; v += Math.round(YMAX / 3)) {\n        s += `<line x1=\"${cx + innerPad}\" y1=\"${cy + innerPad + (1 - v / YMAX) * iH}\" x2=\"${cx + innerPad + iW}\" y2=\"${cy + innerPad + (1 - v / YMAX) * iH}\" stroke=\"#e9e4d8\"/>`;\n      }\n\n      // 路径\n      let path = '';\n      for (let i = 0; i < dyn.points.length; i++) {\n        const p = dyn.points[i];\n        const x = cx + innerPad + (p.x / XMAX) * iW;\n        const y = cy + innerPad + (1 - p.y / YMAX) * iH;\n        path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';\n      }\n      path += 'Z';\n      s += `<path d=\"${path}\" fill=\"rgba(47,125,107,0.18)\" stroke=\"#235f51\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/>`;\n\n      // 标签\n      s += `<text x=\"${cx + cellW / 2}\" y=\"${cy + cellH - 4}\" font-size=\"8.5\" font-weight=\"600\" text-anchor=\"middle\" fill=\"#235f51\">${c.label}</text>`;\n    });\n\n    svg.innerHTML = s;\n  }\n\n  // ---------- 主流程 ----------\n  function paint() {\n    const dyn = generateDyn(S.case, { S: S.S, d: S.d, noise: S.noise }, 20261023);\n    drawDyn(dyn);\n    const { probs, features } = aiClassify(dyn);\n    drawAI(probs, features);\n  }\n\n  // ---------- 事件 ----------\n  function bind() {\n    // 工况按钮\n    document.querySelectorAll('.case-btn').forEach(btn => {\n      btn.addEventListener('click', () => {\n        document.querySelectorAll('.case-btn').forEach(b => b.classList.remove('active'));\n        btn.classList.add('active');\n        S.case = btn.dataset.c;\n        paint();\n      });\n    });\n\n    // 参数滑块\n    document.getElementById('s-S').addEventListener('input', e => {\n      S.S = parseFloat(e.target.value);\n      document.getElementById('o-S').textContent = S.S.toFixed(1);\n      paint();\n    });\n    document.getElementById('s-N').addEventListener('input', e => {\n      S.N = +e.target.value;\n      document.getElementById('o-N').textContent = S.N;\n      paint();\n    });\n    document.getElementById('s-d').addEventListener('input', e => {\n      S.d = +e.target.value;\n      document.getElementById('o-d').textContent = S.d;\n      paint();\n    });\n    document.getElementById('s-noise').addEventListener('input', e => {\n      S.noise = +e.target.value;\n      document.getElementById('o-noise').textContent = ['低', '中', '较高', '高'][S.noise - 1];\n      paint();\n    });\n  }\n\n  bind();\n  paint();\n  drawGallery();\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：抽油机井示功图工况诊断</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>示功图工况诊断 · 深度学习分类演示</h1>\n  <p class=\"lead\">示功图 = 光杆载荷（纵轴） × 位移（横轴） 的闭合曲线。不同工况在图上有不同\"签名形状\"。下面是程序合成的典型示功图——调整生产参数，看曲线怎么变形，AI 怎么分类。</p>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n      <!-- 示功图 + AI 结果 -->\n      <div class=\"section main\">\n        <div class=\"well-diag\">\n          <svg id=\"dyn\" viewBox=\"0 0 360 216\" role=\"img\" aria-label=\"示功图\"></svg>\n        </div>\n        <div class=\"ai-panel\">\n          <h3>AI 分类概率</h3>\n          <div class=\"probs\" id=\"probs\"></div>\n          <div class=\"verdict-wrap\">\n            <div class=\"ai-verdict\" id=\"ai-verdict\">—</div>\n            <div class=\"ai-confidence\" id=\"ai-confidence\"></div>\n          </div>\n          <div class=\"ai-desc\" id=\"ai-desc\"></div>\n\n          <h3 style=\"margin-top:10px\">关键形态特征</h3>\n          <div class=\"features\" id=\"features\"></div>\n        </div>\n      </div>\n\n      <!-- 所有工况对比 -->\n      <div class=\"section\">\n        <h2>③ 典型示功图一览</h2>\n        <p class=\"hint\">6 类常见工况的标准形态对比——这是分类模型\"认识\"的\"模板\"。</p>\n        <svg id=\"gallery\" viewBox=\"0 0 430 230\" role=\"img\" aria-label=\"工况对比\"></svg>\n      </div>\n    </div>\n\n    <div class=\"side\">\n      <!-- 工况选择 -->\n      <div class=\"section\">\n        <h2>① 选择工况类型</h2>\n        <div class=\"case-grid\">\n          <button class=\"case-btn active\" data-c=\"normal\">\n            <b>正常</b><span>饱满四边形，上下冲程载荷对称</span>\n          </button>\n          <button class=\"case-btn\" data-c=\"underfill\">\n            <b>供液不足</b><span>瘦梨形，下冲程空段</span>\n          </button>\n          <button class=\"case-btn\" data-c=\"gaslock\">\n            <b>气锁</b><span>顶部平段，气体没被排出</span>\n          </button>\n          <button class=\"case-btn\" data-c=\"pumploss\">\n            <b>泵漏</b><span>回程载荷下不去</span>\n          </button>\n          <button class=\"case-btn\" data-c=\"rodbreak\">\n            <b>断脱</b><span>高冲次段载荷掉为 0</span>\n          </button>\n          <button class=\"case-btn\" data-c=\"ballleak\">\n            <b>游动阀漏</b><span>上冲程载荷缓慢上升</span>\n          </button>\n        </div>\n      </div>\n\n      <!-- 参数控制 -->\n      <div class=\"section\">\n        <h2>② 生产参数控制</h2>\n        <div class=\"controls\">\n          <div class=\"ctl\">\n            <label>冲程 S (m)<output id=\"o-S\">3.0</output></label>\n            <input type=\"range\" id=\"s-S\" min=\"1.5\" max=\"6.0\" step=\"0.1\" value=\"3.0\">\n          </div>\n          <div class=\"ctl\">\n            <label>冲次 N (次/分)<output id=\"o-N\">6</output></label>\n            <input type=\"range\" id=\"s-N\" min=\"2\" max=\"12\" step=\"1\" value=\"6\">\n          </div>\n          <div class=\"ctl\">\n            <label>泵径 d (mm)<output id=\"o-d\">56</output></label>\n            <input type=\"range\" id=\"s-d\" min=\"28\" max=\"95\" step=\"1\" value=\"56\">\n          </div>\n          <div class=\"ctl\">\n            <label>噪声<output id=\"o-noise\">低</output></label>\n            <input type=\"range\" id=\"s-noise\" min=\"1\" max=\"4\" step=\"1\" value=\"1\">\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "选择不同工况，看 AI 怎么识别示功图的形态特征。拖动生产参数（冲程、冲次），看同一个\"泵漏\"工况在不同参数下的示功图长什么样——以及模型还能不能认出来。",
    mode: 'page',
    height: 700,
    mount: function (root, ctx) {
      if (!global.CaseDemoHost) return;
      demoHandle = global.CaseDemoHost.create(root, {
        files: FILES,
        demo: { mode: 'page', html: 'demo/index.html', js: 'demo/demo.js', height: 700 },
        meta: { title: DATA.title }
      }, ctx);
    },
    unmount: function () {
      if (demoHandle) { try { demoHandle.destroy(); } catch (e) { } demoHandle = null; }
    }
  };

  global.Cases.register(DATA);
})(window);
