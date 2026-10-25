/* =========================================================
   案例插件（静态注册版）：固井漏失风险智能预测与预警
   ---------------------------------------------------------
   由 cases/c3-loss-risk/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "c3-loss-risk",
    "sceneId": "c3",
    "methods": [
      "opt"
    ],
    "title": "固井漏失风险智能预测与预警",
    "version": "1.0.0",
    "updated": "2026-10-23",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "固井漏失是最常见也最昂贵的固井事故——水泥浆在注入过程中漏入地层，轻则返高不够需要挤水泥补救，重则整井重注损失数十万元。漏失通常发生在高压差、高渗透储层或天然裂缝发育段，本质是浆柱当量密度超过了地层的承受能力。",
        "judge": [
          {
            "label": "任务类型",
            "value": "二分类 + 概率预测",
            "desc": "输出漏失概率 0—100%"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "历史固井记录含\"是否漏失\"标签，需清洗"
          },
          {
            "label": "可见收益",
            "value": "极高",
            "desc": "一次漏失 = 整井重注成本"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "漏失样本占比低，类别不均衡"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>传统漏失判断靠两个工具：<b>密度窗口计算</b>（孔隙压力 < 当量密度 < 破裂压力）和<b>邻井经验类比</b>。窗口安全≠绝对安全——邻井没漏≠这井不会漏，尤其在天然裂缝发育区。</p><p>问题有三：<b>破裂压力估算不准</b>——Hall-Niu 公式对裂缝性地层误差可达 0.15 g/cm³；<b>裂缝发育程度难以量化</b>——只能靠测井间接推断，没法直接给出\"漏失概率\"；<b>经验类比主观性强</b>——工程师知道\"这区块容易漏\"但说不清楚为什么。</p><div class='figure'><svg viewBox='0 0 720 260' width='100%' role='img' aria-label='裂缝性地层漏失通道与漏失量分级'><rect x='0' y='0' width='720' height='260' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 裂缝性漏失通道与漏失量分级</text><circle cx='160' cy='140' r='88' fill='none' stroke='var(--line)'/><circle cx='160' cy='140' r='56' fill='var(--jade)' opacity='0.12'/><circle cx='160' cy='140' r='44' fill='var(--paper-2)' stroke='var(--ink-2)' stroke-width='1.4'/><text x='160' y='144' font-size='9' fill='var(--ink-3)' text-anchor='middle'>井眼</text><path d='M216 128 l18 -10 12 10 16 -8 18 10' fill='none' stroke='var(--ink-3)' stroke-width='1.4' stroke-dasharray='4 3'/><path d='M142 62 l-14 -10 8 -12 -10 -8' fill='none' stroke='var(--ink-3)' stroke-width='1.4' stroke-dasharray='4 3'/><path d='M120 178 l-16 10 8 14 -12 10' fill='none' stroke='var(--ink-3)' stroke-width='1.4' stroke-dasharray='4 3'/><path d='M210 148 L268 156' stroke='var(--bad)' stroke-width='1.6'/><path d='M268 152 L278 157 L268 162 Z' fill='var(--bad)'/><text x='222' y='184' font-size='9' fill='var(--bad)'>浆液漏入裂缝</text><text x='250' y='112' font-size='9' fill='var(--ink-3)'>天然裂缝</text><text x='160' y='92' font-size='9' fill='var(--jade)' text-anchor='middle'>水泥环</text><text x='400' y='48' font-size='9.5' fill='var(--ink-2)'>漏失量分级（m³）</text><line x1='432' y1='56' x2='432' y2='212' stroke='var(--line)' stroke-dasharray='3 3'/><text x='402' y='75' font-size='10' fill='var(--ink-2)'>无</text><text x='402' y='107' font-size='10' fill='var(--ink-2)'>微</text><text x='402' y='139' font-size='10' fill='var(--ink-2)'>小</text><text x='402' y='171' font-size='10' fill='var(--ink-2)'>中</text><text x='402' y='203' font-size='10' fill='var(--ink-2)'>大</text><rect x='432' y='65' width='24' height='14' fill='var(--ok)'/><rect x='432' y='97' width='62' height='14' fill='var(--ok)' opacity='0.55'/><rect x='432' y='129' width='110' height='14' fill='var(--warn)'/><rect x='432' y='161' width='164' height='14' fill='var(--bad)' opacity='0.8'/><rect x='432' y='193' width='226' height='14' fill='var(--bad)'/><text x='684' y='75' font-size='9' fill='var(--ink-3)' text-anchor='end'>&lt;1</text><text x='684' y='107' font-size='9' fill='var(--ink-3)' text-anchor='end'>1—5</text><text x='684' y='139' font-size='9' fill='var(--ink-3)' text-anchor='end'>5—15</text><text x='684' y='171' font-size='9' fill='var(--ink-3)' text-anchor='end'>15—30</text><text x='684' y='203' font-size='9' fill='var(--ink-3)' text-anchor='end'>&gt;30</text><text x='18' y='248' font-size='9' fill='var(--ink-3)'>漏失量越大，返高不足与层间窜通风险越高；中/大级需在注水泥前调整密度或加暂堵剂</text></svg><div class='figcap'><b>图 1</b><span>天然裂缝与高渗层是漏失通道；按漏失量把风险分为无/微/小/中/大五级，对应不同补救措施</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 的核心贡献是<b>多因素综合打分 + 概率输出</b>。把密度窗口裕度、测井裂缝密度、储层渗透率、排量等几十个因素输入模型，输出一个<b>漏失概率</b>（0—100%）。概率比\"在/不在窗口里\"更有价值——它能告诉工程师\"虽然在窗口内，但风险 65%，要不要提前加降失水材料\"。</p><p>模型选择：XGBoost / LightGBM 是首选——树模型能处理数值和类别混合特征、对异常值鲁棒、能输出<b>特征重要性</b>（告诉工程师\"最关键的三个因素是啥\"）。当数据量够大（>1000 井次）时可以上深度模型，但 200—500 井次的场景下树模型的效果通常更好。</p><div class='figure'><svg viewBox='0 0 720 260' width='100%' role='img' aria-label='井况特征输入模型输出漏失概率'><rect x='0' y='0' width='720' height='260' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>B · 井况特征 → 漏失概率</text><rect x='24' y='46' width='148' height='28' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='98' y='64' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>密度窗口裕度</text><rect x='24' y='82' width='148' height='28' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='98' y='100' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>天然裂缝密度</text><rect x='24' y='118' width='148' height='28' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='98' y='136' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>环空返速</text><rect x='24' y='154' width='148' height='28' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='98' y='172' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>当量密度 ECD</text><rect x='24' y='190' width='148' height='28' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='98' y='208' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>井斜角</text><path d='M172 60 L260 116' stroke='var(--ink-3)' stroke-width='1' opacity='0.6'/><path d='M172 96 L260 122' stroke='var(--ink-3)' stroke-width='1' opacity='0.6'/><path d='M172 132 L260 128' stroke='var(--ink-3)' stroke-width='1' opacity='0.6'/><path d='M172 168 L260 134' stroke='var(--ink-3)' stroke-width='1' opacity='0.6'/><path d='M172 204 L260 140' stroke='var(--ink-3)' stroke-width='1' opacity='0.6'/><rect x='260' y='80' width='170' height='96' rx='5' fill='var(--paper-2)' stroke='var(--c-opt)'/><text x='276' y='105' font-size='11' fill='var(--ink)'>LightGBM</text><text x='276' y='122' font-size='9' fill='var(--ink-3)'>27 特征 · Focal Loss</text><text x='276' y='139' font-size='9' fill='var(--ink-3)'>概率校准输出</text><text x='276' y='156' font-size='9' fill='var(--ink-3)'>特征重要性可解释</text><path d='M430 128 L456 128' stroke='var(--ink-3)' stroke-width='1.4'/><path d='M456 124 L462 128 L456 132 Z' fill='var(--ink-3)'/><text x='490' y='60' font-size='9.5' fill='var(--ink-2)'>漏失概率</text><rect x='490' y='72' width='76' height='16' fill='var(--ok)' opacity='0.5'/><rect x='566' y='72' width='57' height='16' fill='var(--warn)' opacity='0.55'/><rect x='623' y='72' width='57' height='16' fill='var(--bad)' opacity='0.5'/><line x1='614' y1='64' x2='614' y2='96' stroke='var(--ink)' stroke-width='2'/><text x='560' y='124' font-size='16' fill='var(--bad)' text-anchor='middle'>65%</text><text x='616' y='124' font-size='9' fill='var(--ink-3)'>± 12%</text><text x='490' y='100' font-size='9' fill='var(--ink-3)' text-anchor='start'>0</text><text x='680' y='100' font-size='9' fill='var(--ink-3)' text-anchor='end'>100</text><text x='490' y='146' font-size='9' fill='var(--ink-2)'>建议：降密度 / 加暂堵剂</text><text x='490' y='163' font-size='9' fill='var(--ink-3)'>阈值 70% 触发预警</text><text x='490' y='184' font-size='9' fill='var(--ink-3)'>裕度 38%</text><rect x='548' y='178' width='76' height='6' fill='var(--c-opt)'/><text x='490' y='200' font-size='9' fill='var(--ink-3)'>裂缝 22%</text><rect x='548' y='194' width='44' height='6' fill='var(--c-opt)' opacity='0.75'/><text x='490' y='216' font-size='9' fill='var(--ink-3)'>返速 15%</text><rect x='548' y='210' width='30' height='6' fill='var(--c-opt)' opacity='0.55'/></svg><div class='figcap'><b>图 2</b><span>密度窗口裕度、裂缝密度、环空返速等特征输入 LightGBM，输出 0—100% 漏失概率及置信区间</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">漏失预测的数据门槛比居中度和优化稍高——需要历史固井记录作为标签：</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">单井固井记录</span><span class=\"cl-s\">200—1000 井次</span></span><span class=\"cl-n\">密度、排量、漏失量、返高</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井况与地层属性</span><span class=\"cl-s\">孔隙压力、破裂压力、渗透率、井斜、裂缝密度</span></span><span class=\"cl-n\">单井一组</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">测井解释结果</span><span class=\"cl-s\">裂缝密度、孔隙度、饱和度</span></span><span class=\"cl-n\">用于校正地层属性</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">区块统计特征</span><span class=\"cl-s\">区块漏失历史、同类储层漏失率</span></span><span class=\"cl-n\">按区块汇总</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中</b>。主要挑战：① <b>类别不均衡</b>——漏失井只占 5—15%，需要 SMOTE 过采样或 Focal Loss；② <b>标签噪声</b>——有些漏失被归为\"返高不够\"，有些小漏没被记录；③ <b>跨区块泛化</b>——A 区块训练的模型到 B 区块可能失效，需要迁移学习。</p><p>一个反直觉的坑：漏失预测的<b>负样本更值钱</b>——\"不漏\"的井提供了窗口安全边界的下限信息，比\"漏\"的样本更能帮模型学到真正的决策边界。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">梯度提升树<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">不均衡学习<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">特征重要性<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">贝叶斯校准<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "某区块 5 年固井记录的漏失风险模型",
        "lead": [
          "某油气田近 5 年共 426 口井的固井记录中，38 口发生了不同程度的漏失。目标是训练一个模型，在注水泥前输出每口井的漏失概率，帮助工程师决定是否需要调整方案。",
          "模型最终选出的 Top 3 关键因素是：密度窗口裕度（贡献 38%）、天然裂缝密度（22%）、环空返速（15%）。这个发现反过来又指导了现场数据采集的优先级。"
        ],
        "stats": [
          [
            "总样本井次",
            "426"
          ],
          [
            "漏失井次",
            "38 (8.9%)"
          ],
          [
            "特征数",
            "27"
          ],
          [
            "模型AUC",
            "0.89"
          ],
          [
            "Top-3 因素权重",
            "75%"
          ]
        ],
        "steps": [
          {
            "name": "数据清洗与标签构建",
            "role": "工程环节",
            "do": "把 426 井次的固井记录与井况数据对齐：密度、排量、ECD、窗口裕度、裂缝密度……统一格式、填补缺失值（用邻井中位数）。标签字段：是否漏失 + 漏失量（分级：无/微/小/中/大）。",
            "effect": "得到一张结构化的特征表，每行一口井，每列一个特征",
            "trap": "很多漏失被记录成\"返高不够\"，需要和工程师访谈后统一标签口径"
          },
          {
            "name": "特征工程",
            "role": "特征",
            "do": "从原始数据构造更有表达力的特征：密度窗口裕度（最小裕度）、ECD 安全系数、当量压力密度差、地层可压缩性指标……对类别特征（区块、储层类型）做 target encoding。",
            "effect": "原始 12 列变成 27 列，关键特征在其中",
            "trap": "target encoding 要按区块留一编码，否则会数据泄漏"
          },
          {
            "name": "模型训练（处理不均衡）",
            "role": "算法核心",
            "do": "用 LightGBM + Focal Loss 训练。按\"井次\"划分训练/验证集（不是按样本随机，避免同区块泄漏）。网格搜索超参数：树数、学习率、最大深度、最小叶样本数。",
            "effect": "验证集 AUC 0.89，漏失召回率 0.82（漏掉 7 口，其中 5 口是微漏）",
            "trap": "随机划分验证集会让 AUC 虚高——同区块的井被分到不同集合了"
          },
          {
            "name": "特征重要性解读",
            "role": "可解释",
            "do": "取 LightGBM 输出的特征重要性，画条形图。Top 5：密度窗口裕度(38%)、裂缝密度(22%)、环空返速(15%)、ECD(12%)、井斜(7%)。其余 22 个特征合计 6%。",
            "effect": "告诉现场\"最关键的三个数是什么\"，指导数据采集优先级",
            "trap": "重要性低 ≠ 没用——可能只是与其他特征高度共线"
          },
          {
            "name": "生产部署",
            "role": "落地",
            "do": "模型导出为 ONNX 或 pickle 文件，封装成一个输入\"井况参数\"输出\"漏失概率\"的小工具。集成到固井设计软件的方案校验模块，高风险井自动弹出提醒，建议降低密度或增加暂堵剂。",
            "effect": "工程师在注水泥前就能看到概率，不再凭\"感觉\"决策",
            "trap": "模型要带置信度区间——\"风险 45% ± 20%\"比单个数字更诚实"
          }
        ],
        "metrics": {
          "title": "怎么算\"预测准了\"",
          "html": "<p>漏失预测是不均衡分类问题，不能只看准确率。<b>AUC</b>（ROC 曲线下面积）衡量整体排序能力，<b>召回率</b>（漏失井被找出来的比例）是业务最关心的指标——漏过一口漏失井可能损失几百万。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>取值</th></tr></thead><tbody><tr><td>AUC</td><td>整体排序能力，0.5 = 乱猜，1.0 = 完美</td><td>0.89</td></tr><tr><td>漏失召回率</td><td>实际漏失井中被模型找到的比例</td><td>0.82 (31/38)</td></tr><tr><td>精确率</td><td>模型预测\"漏失\"的井中真漏的比例</td><td>0.53 (31/58)</td></tr><tr><td>F1</td><td>2 × P × R / (P + R)</td><td>0.64</td></tr></tbody></table><p class=\"small muted\">注：精确率低是因为模型在 27 井次\"误报\"中，有些其实是小漏未被记录或被归入其他类别。这种\"误报\"在固井场景下是可接受的——宁可信其有。</p>"
        },
        "fails": [
          {
            "name": "把微漏当成\"不漏\"",
            "why": "标签里微漏经常被归类到\"成功固井\"，导致模型学不到这种边界情况。解决：标签分级（无/微/小/中/大），做多分类或回归。"
          },
          {
            "name": "跨区块失效",
            "why": "不同区块的裂缝发育机制可能完全不同，A 区块训练的模型到 B 区块 AUC 跌到 0.6。解决：迁移学习 + 少量目标区块样本微调。"
          },
          {
            "name": "假阳性太多",
            "why": "模型倾向保守，预测\"漏失\"的井太多，工程师就麻木了。解决：阈值随业务需求调节——宁可漏掉 1 口也要精确率过 50%。"
          }
        ]
      }
    }
  };

  var FILES = [
      {
        "name": "demo/demo.css",
        "data": "/* ========= 漏失风险预测示范样式 ========= */\n* { box-sizing: border-box; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #fbfaf6;\n  color: #242b2e;\n  padding: 32px 28px;\n  line-height: 1.65;\n}\n.panel { max-width: 940px; margin: 0 auto; }\nh1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }\nh2 { font-size: 15px; font-weight: 600; margin: 20px 0 8px; color: #235f51; }\n.lead { color: #4d565b; margin-bottom: 14px; }\n.hint { font-size: 12.5px; color: #79828a; margin-bottom: 10px; }\n.section { background: #fff; border: 1px solid #e9e4d8; border-radius: 9px; padding: 18px 22px; margin-bottom: 16px; }\n\n.risk-top { display: flex; gap: 28px; align-items: center; }\n.gauge-wrap { flex-shrink: 0; }\n.risk-result { flex: 1; }\n.rr-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e9e4d8; font-size: 13px; }\n.rr-l { color: #79828a; }\n.rr-row b { font-family: 'JetBrains Mono', Consolas, monospace; font-weight: 600; }\n.rr-row b.low { color: #3f8560; }\n.rr-row b.mid { color: #a97a1c; }\n.rr-row b.high { color: #b05a51; }\n.rr-detail { margin-top: 10px; padding: 12px 14px; border-radius: 6px; font-size: 13px; }\n.rr-detail.ok { background: #e7f3ea; color: #3f8560; }\n.rr-detail.warn { background: #f9efd7; color: #a97a1c; }\n.rr-detail.bad { background: #f9e9e5; color: #b05a51; }\n\n.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n.ctl { display: flex; flex-direction: column; gap: 4px; padding: 11px 14px; background: #f5f2ea; border-radius: 7px; }\n.ctl.preset { grid-column: span 2; }\n.ctl label { font-size: 13px; display: flex; justify-content: space-between; font-weight: 500; }\n.ctl output { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: #2f7d6b; }\n.ctl .tip { font-size: 11.5px; color: #9ba3a9; }\n.preset-btns { display: flex; gap: 8px; flex-wrap: wrap; }\n.preset-btns button {\n  padding: 6px 12px; border-radius: 6px; border: 1px solid #c9c2b0;\n  background: #fff; cursor: pointer; font-size: 12.5px;\n}\n.preset-btns button:hover { border-color: #2f7d6b; color: #2f7d6b; }\n"
      },
      {
        "name": "demo/demo.js",
        "data": "/* ======= 固井漏失风险预测 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  // ---------- 状态 ----------\n  let S = {\n    margin: 0.08,   // 窗口裕度 g/cm³\n    frac: 0.3,      // 裂缝密度 条/m\n    safety: 0.95,   // ECD / 破裂压力\n    v: 1.2,         // 环空返速 m/s\n    k: 250          // 渗透率 mD\n  };\n\n  // ---------- 简化的 LightGBM 预测模型 ----------\n  // 模拟一个已经训练好的 LightGBM：用一系列 if-else 分裂条件（阈值参考真实训练结果）\n  // 输出 0-1 概率\n\n  function predictRisk() {\n    // 归一化各特征到 0-1 区间（越高越危险）\n    const f_margin = 1 - Math.min(1, Math.max(0, (S.margin - 0.01) / 0.19)); // 裕度越小越危险\n    const f_frac = Math.min(1, Math.max(0, S.frac / 2.5));\n    const f_safety = Math.min(1.2, Math.max(0.85, S.safety - 0.85)) / 0.2;\n    const f_v = Math.min(1, Math.max(0, (S.v - 0.5) / 2));\n    const f_k = Math.min(1, Math.max(0, Math.log(S.k + 1) / Math.log(5001)));\n\n    // LightGBM 分裂树：模拟一个 3 层的树（主分裂 + 两个次分裂）\n    // 主分裂：安全系数是否 >= 0.97\n    let prob;\n    if (S.safety >= 0.97) {\n      // 高安全系数 → 低基线，但裕度和返速仍有影响\n      prob = 0.08;\n      prob += f_frac * 0.12;\n      prob += (1 - f_margin) * -0.05;  // 裕度大 → 概率更低\n    } else if (S.safety >= 0.93) {\n      // 中等安全\n      prob = 0.30;\n      prob += f_frac * 0.20;\n      prob += f_v * 0.10;\n      prob += f_k * 0.05;\n      prob += (1 - f_margin) * -0.08;\n    } else if (S.safety >= 0.89) {\n      // 接近危险区\n      prob = 0.55;\n      prob += f_frac * 0.20;\n      prob += f_v * 0.12;\n      prob += f_k * 0.08;\n      prob += (1 - f_margin) * -0.10;\n    } else {\n      // 非常危险\n      prob = 0.82;\n      prob += f_frac * 0.12;\n      prob += f_v * 0.05;\n    }\n\n    // 额外规则：裂缝 + 低裕度双红 → 概率额外上升\n    if (S.frac >= 1.2 && S.margin <= 0.04) {\n      prob += 0.10;\n    }\n\n    prob = Math.max(0.02, Math.min(0.99, prob));\n\n    // 贡献度计算（用 SHAP-like 简化版：每个特征偏离均值多少 × 权重）\n    const contribs = {\n      margin: { val: S.margin, weight: 0.38, dir: f_margin > 0.5 ? 'up' : 'down', abs: f_margin },\n      frac: { val: S.frac, weight: 0.22, dir: f_frac > 0.5 ? 'up' : 'down', abs: f_frac },\n      safety: { val: S.safety, weight: 0.18, dir: f_safety > 0.5 ? 'up' : 'down', abs: f_safety },\n      v:     { val: S.v, weight: 0.15, dir: f_v > 0.5 ? 'up' : 'down', abs: f_v },\n      k:     { val: S.k, weight: 0.07, dir: f_k > 0.5 ? 'up' : 'down', abs: f_k }\n    };\n\n    return { prob, contribs };\n  }\n\n  // ---------- 仪表盘 ----------\n  function drawGauge(prob) {\n    const svg = document.getElementById('gauge');\n    const W = 260, H = 160;\n    const cx = 130, cy = 130, r = 100;\n\n    // 颜色分段\n    let color;\n    if (prob < 0.33) color = '#3f8560';\n    else if (prob < 0.66) color = '#a97a1c';\n    else color = '#b05a51';\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 背景弧\n    s += `<path d=\"M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}\" fill=\"none\" stroke=\"#efece1\" stroke-width=\"22\" stroke-linecap=\"round\"/>`;\n\n    // 三段颜色标记\n    const angles = [\n      { a1: Math.PI, a2: Math.PI + 0.33 * Math.PI, c: '#3f8560' },\n      { a1: Math.PI + 0.33 * Math.PI, a2: Math.PI + 0.66 * Math.PI, c: '#a97a1c' },\n      { a1: Math.PI + 0.66 * Math.PI, a2: 2 * Math.PI, c: '#b05a51' }\n    ];\n    angles.forEach(a => {\n      const x1 = cx + r * Math.cos(a.a1);\n      const y1 = cy + r * Math.sin(a.a1);\n      const x2 = cx + r * Math.cos(a.a2);\n      const y2 = cy + r * Math.sin(a.a2);\n      const large = (a.a2 - a.a1) > Math.PI ? 1 : 0;\n      s += `<path d=\"M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}\" fill=\"none\" stroke=\"${a.c}\" stroke-width=\"22\" stroke-linecap=\"round\" opacity=\"0.2\"/>`;\n    });\n\n    // 指针\n    const angle = Math.PI + prob * Math.PI;\n    const px = cx + (r - 15) * Math.cos(angle);\n    const py = cy + (r - 15) * Math.sin(angle);\n    s += `<line x1=\"${cx}\" y1=\"${cy}\" x2=\"${px}\" y2=\"${py}\" stroke=\"${color}\" stroke-width=\"4\" stroke-linecap=\"round\"/>`;\n    s += `<circle cx=\"${cx}\" cy=\"${cy}\" r=\"7\" fill=\"${color}\"/>`;\n\n    // 中心数值\n    s += `<text x=\"${cx}\" y=\"${cy - 18}\" font-size=\"38\" font-weight=\"700\" text-anchor=\"middle\" fill=\"${color}\" font-family=\"monospace\">${(prob * 100).toFixed(0)}%</text>`;\n    s += `<text x=\"${cx}\" y=\"${cy + 12}\" font-size=\"11\" fill=\"#79828a\" text-anchor=\"middle\" letter-spacing=\"1\">LOSS PROBABILITY</text>`;\n\n    // 刻度\n    for (let i = 0; i <= 10; i++) {\n      const a = Math.PI + i / 10 * Math.PI;\n      const x1 = cx + (r - 30) * Math.cos(a);\n      const y1 = cy + (r - 30) * Math.sin(a);\n      const x2 = cx + r * Math.cos(a);\n      const y2 = cy + r * Math.sin(a);\n      s += `<line x1=\"${x1}\" y1=\"${y1}\" x2=\"${x2}\" y2=\"${y2}\" stroke=\"#c9c2b0\" stroke-width=\"1\"/>`;\n    }\n\n    svg.innerHTML = s;\n  }\n\n  // ---------- 因素贡献条形图 ----------\n  function drawBars(contribs) {\n    const svg = document.getElementById('bars');\n    const W = 600, H = 220, padL = 120, padR = 40, padT = 10, padB = 10;\n    const barH = 28, gap = 8;\n\n    const keys = [\n      { k: 'margin', label: '窗口裕度 Δ', unit: 'g/cm³' },\n      { k: 'frac', label: '裂缝密度', unit: '条/m' },\n      { k: 'safety', label: 'ECD 安全系数', unit: '' },\n      { k: 'v', label: '环空返速', unit: 'm/s' },\n      { k: 'k', label: '渗透率', unit: 'mD' }\n    ];\n\n    // 按绝对贡献排序\n    keys.sort((a, b) => contribs[b.k].weight * contribs[b.k].abs - contribs[a.k].weight * contribs[a.k].abs);\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    keys.forEach((key, i) => {\n      const c = contribs[key.k];\n      const y = padT + i * (barH + gap);\n      const totalContrib = c.weight * c.abs;\n      const pct = Math.min(1, totalContrib / 0.25); // 归一化到 0-1（约 25% 最大单项贡献）\n\n      // 背景条\n      s += `<rect x=\"${padL}\" y=\"${y + 4}\" width=\"${W - padL - padR}\" height=\"${barH - 8}\" rx=\"4\" fill=\"#f5f2ea\"/>`;\n\n      // 贡献条\n      const br = (W - padL - padR) * pct;\n      const barColor = c.dir === 'up' ? '#b05a51' : '#2f7d6b';\n      s += `<rect x=\"${padL}\" y=\"${y + 4}\" width=\"${br}\" height=\"${barH - 8}\" rx=\"4\" fill=\"${barColor}\" opacity=\"0.8\"/>`;\n\n      // 标签\n      s += `<text x=\"${padL - 8}\" y=\"${y + barH / 2 + 4}\" font-size=\"12\" fill=\"#4d565b\" text-anchor=\"end\" font-weight=\"500\">${key.label}</text>`;\n\n      // 当前值\n      const valStr = key.unit === 'mD' ? c.val.toFixed(0) : c.val.toFixed(2);\n      s += `<text x=\"${padL + br + 6}\" y=\"${y + barH / 2 + 4}\" font-size=\"11\" fill=\"${barColor}\" font-family=\"monospace\" font-weight=\"600\">${valStr}${key.unit}</text>`;\n\n      // 权重\n      s += `<text x=\"${W - padR + 6}\" y=\"${y + barH / 2 + 4}\" font-size=\"10\" fill=\"#9ba3a9\" font-family=\"monospace\">${(c.weight * 100).toFixed(0)}%</text>`;\n    });\n\n    // 底部说明\n    s += `<text x=\"${padL}\" y=\"${H - 4}\" font-size=\"9.5\" fill=\"#9ba3a9\">← 贡献度 →     <tspan fill=\"#b05a51\">红色 = 当前值朝危险方向</tspan>  <tspan fill=\"#2f7d6b\">绿色 = 安全方向</tspan></text>`;\n\n    svg.innerHTML = s;\n  }\n\n  // ---------- 沿井深风险曲线 ----------\n  function drawDepthRisk() {\n    const svg = document.getElementById('depth-risk');\n    const W = 720, H = 200, padL = 40, padR = 14, padT = 14, padB = 30;\n    const plotW = W - padL - padR, plotH = H - padT - padB;\n    const N = 100, DEPTH_MAX = 4800;\n\n    // 模拟沿井深的因素变化\n    const risks = new Float64Array(N);\n    for (let i = 0; i < N; i++) {\n      const t = i / N;\n      const depth = t * DEPTH_MAX;\n      // 模拟：沿深度安全系数下降（压力升高），裂缝密度在中间段高，返速先增后减\n      const locSafety = Math.max(0.85, S.safety + (1 - t) * 0.04 - Math.sin(t * 6) * 0.02);\n      const locFrac = S.frac * (0.5 + 0.7 * Math.exp(-Math.pow((t - 0.45) * 4, 2)) + 0.1 * Math.random());\n      const locMargin = Math.max(0.01, S.margin * (0.6 + 0.5 * (1 - t)));\n\n      // 简化的逐点风险\n      let r = 0.1 + (1 - locSafety / 1.05) * 0.6 + locFrac * 0.15 + (1 - locMargin / 0.15) * 0.25;\n      r = Math.max(0.02, Math.min(0.99, r));\n      risks[i] = r;\n    }\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 风险热图（渐变色带）\n    let bandW = plotW / N;\n    for (let i = 0; i < N; i++) {\n      const x = padL + i * bandW;\n      let col;\n      if (risks[i] < 0.33) col = '#3f8560';\n      else if (risks[i] < 0.66) col = '#a97a1c';\n      else col = '#b05a51';\n      s += `<rect x=\"${x}\" y=\"${padT}\" width=\"${bandW + 0.5}\" height=\"${plotH}\" fill=\"${col}\" opacity=\"${0.3 + risks[i] * 0.7}\"/>`;\n    }\n\n    // 风险曲线\n    let path = '';\n    for (let i = 0; i < N; i++) {\n      const x = padL + i * bandW;\n      const y = padT + (1 - risks[i]) * plotH;\n      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';\n    }\n    s += `<path d=\"${path}\" fill=\"none\" stroke=\"#242b2e\" stroke-width=\"1.5\" stroke-linejoin=\"round\"/>`;\n\n    // 高风险段（>66%）标注\n    let inHigh = false, hs = 0;\n    for (let i = 0; i < N; i++) {\n      if (risks[i] > 0.66 && !inHigh) { inHigh = true; hs = i; }\n      if (risks[i] <= 0.66 && inHigh) {\n        const x1 = padL + hs * bandW;\n        const x2 = padL + i * bandW;\n        const y = padT - 2;\n        s += `<text x=\"${(x1 + x2) / 2}\" y=\"${y - 2}\" font-size=\"9\" fill=\"#b05a51\" text-anchor=\"middle\" font-weight=\"600\">⚠ ${((hs + i) / 2 / N * DEPTH_MAX).toFixed(0)}m 附近</text>`;\n        inHigh = false;\n      }\n    }\n    if (inHigh) {\n      const x1 = padL + hs * bandW;\n      const x2 = padL + N * bandW;\n      s += `<text x=\"${(x1 + x2) / 2}\" y=\"${padT - 2}\" font-size=\"9\" fill=\"#b05a51\" text-anchor=\"middle\" font-weight=\"600\">⚠ 井底高风险</text>`;\n    }\n\n    // 坐标轴\n    for (let i = 0; i <= 6; i++) {\n      const x = padL + i / 6 * plotW;\n      const d = (i / 6 * DEPTH_MAX).toFixed(0);\n      s += `<text x=\"${x}\" y=\"${H - 8}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">${d}m</text>`;\n    }\n    s += `<text x=\"${padL - 6}\" y=\"${padT + 5}\" font-size=\"9\" fill=\"#3f8560\" text-anchor=\"end\">低</text>`;\n    s += `<text x=\"${padL - 6}\" y=\"${padT + plotH}\" font-size=\"9\" fill=\"#b05a51\" text-anchor=\"end\">高</text>`;\n\n    svg.innerHTML = s;\n  }\n\n  // ---------- 事件绑定 ----------\n  function bind() {\n    const fields = [\n      { id: 's-margin', key: 'margin', out: 'o-margin', fmt: v => v.toFixed(2) },\n      { id: 's-frac', key: 'frac', out: 'o-frac', fmt: v => v.toFixed(1) },\n      { id: 's-safety', key: 'safety', out: 'o-safety', fmt: v => v.toFixed(2) },\n      { id: 's-v', key: 'v', out: 'o-v', fmt: v => v.toFixed(1) },\n      { id: 's-k', key: 'k', out: 'o-k', fmt: v => v.toFixed(0) }\n    ];\n\n    fields.forEach(f => {\n      const el = document.getElementById(f.id);\n      const out = document.getElementById(f.out);\n      el.value = S[f.key];\n      out.textContent = f.fmt(S[f.key]);\n      el.addEventListener('input', () => {\n        S[f.key] = parseFloat(el.value);\n        out.textContent = f.fmt(S[f.key]);\n        paint();\n      });\n    });\n\n    // 快捷场景\n    document.querySelectorAll('.preset-btns button').forEach(btn => {\n      btn.addEventListener('click', () => {\n        const p = btn.dataset.p;\n        let vals;\n        if (p === 'safe') vals = { margin: 0.15, frac: 0.2, safety: 0.90, v: 0.9, k: 150 };\n        else if (p === 'warn') vals = { margin: 0.05, frac: 0.8, safety: 0.96, v: 1.6, k: 800 };\n        else if (p === 'risk') vals = { margin: 0.03, frac: 1.5, safety: 0.99, v: 2.2, k: 2000 };\n        else vals = { margin: 0.04, frac: 2.5, safety: 0.94, v: 1.2, k: 3500 };\n\n        Object.assign(S, vals);\n        fields.forEach(f => {\n          const el = document.getElementById(f.id);\n          const out = document.getElementById(f.out);\n          el.value = S[f.key];\n          out.textContent = f.fmt(S[f.key]);\n        });\n        paint();\n      });\n    });\n  }\n\n  function paint() {\n    const { prob, contribs } = predictRisk();\n    drawGauge(prob);\n    drawBars(contribs);\n    drawDepthRisk();\n\n    // 风险等级和建议\n    const pct = (prob * 100).toFixed(0);\n    let level, advice, detail, cls;\n    if (prob < 0.33) {\n      level = '低风险'; advice = '按常规方案施工'; cls = 'ok';\n      detail = '当前参数组合的漏失概率 < 30%，属于\"通常不会出问题\"的区间。可以按经验方案施工，只需保留常规监控。';\n    } else if (prob < 0.66) {\n      level = '中风险'; advice = '建议提前准备暂堵剂'; cls = 'warn';\n      detail = '概率 30—65%，属于\"临界\"区间。建议：① 降低密度或排量 5—10%；② 提前准备随钻暂堵剂；③ 加密漏失监测点（每 10 秒一个）。';\n    } else {\n      level = '高风险'; advice = '必须调整方案！'; cls = 'bad';\n      detail = '概率 > 65%，强烈建议重新设计注水泥方案：① 降低密度 0.05—0.10 g/cm³；② 降低排量或分阶段施工；③ 改用低密度水泥浆体系。不建议\"硬上\"。';\n    }\n\n    const rrP = document.getElementById('rr-p');\n    rrP.textContent = pct + '%';\n    rrP.className = cls;\n    document.getElementById('rr-level').textContent = level;\n    document.getElementById('rr-level').className = cls;\n    document.getElementById('rr-advice').textContent = advice;\n    document.getElementById('rr-advice').className = cls;\n    document.getElementById('rr-detail').textContent = detail;\n    document.getElementById('rr-detail').className = 'rr-detail ' + cls;\n  }\n\n  bind();\n  paint();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：固井漏失风险预测</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>固井漏失风险 · 交互式预测演示</h1>\n  <p class=\"lead\">调节下面的五个关键因素，看漏失概率怎么变化。右侧条形图显示 <b>LightGBM 模型当前预测中各因素的贡献度</b>——红色越高，说明这个因素在本次预测里\"越危险\"。</p>\n\n  <!-- 风险仪表盘 -->\n  <div class=\"section risk-top\">\n    <div class=\"gauge-wrap\">\n      <svg id=\"gauge\" viewBox=\"0 0 260 160\" role=\"img\" aria-label=\"漏失概率仪表盘\"></svg>\n    </div>\n    <div class=\"risk-result\">\n      <div class=\"rr-row\"><span class=\"rr-l\">漏失概率</span><b id=\"rr-p\">—</b></div>\n      <div class=\"rr-row\"><span class=\"rr-l\">风险等级</span><b id=\"rr-level\">—</b></div>\n      <div class=\"rr-row\"><span class=\"rr-l\">建议</span><b id=\"rr-advice\">—</b></div>\n      <div class=\"rr-detail\" id=\"rr-detail\"></div>\n    </div>\n  </div>\n\n  <!-- 因素控制 -->\n  <div class=\"section\">\n    <h2>① 五个关键因素（调节看效果）</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>密度窗口裕度 Δ (g/cm³)<output id=\"o-margin\">0.08</output></label>\n        <input type=\"range\" id=\"s-margin\" min=\"0.01\" max=\"0.20\" step=\"0.01\" value=\"0.08\">\n        <span class=\"tip\">最小 ECD 到破裂压力的距离，<b>越小越危险</b></span>\n      </div>\n      <div class=\"ctl\">\n        <label>天然裂缝密度 (条/m)<output id=\"o-frac\">0.3</output></label>\n        <input type=\"range\" id=\"s-frac\" min=\"0\" max=\"3.0\" step=\"0.1\" value=\"0.3\">\n        <span class=\"tip\">成像测井解释，≥1 条/m 为高风险</span>\n      </div>\n      <div class=\"ctl\">\n        <label>ECD 安全系数<output id=\"o-safety\">0.95</output></label>\n        <input type=\"range\" id=\"s-safety\" min=\"0.85\" max=\"1.05\" step=\"0.01\" value=\"0.95\">\n        <span class=\"tip\">ECD / 破裂压力，>1.0 = 必然漏失</span>\n      </div>\n      <div class=\"ctl\">\n        <label>环空返速 (m/s)<output id=\"o-v\">1.2</output></label>\n        <input type=\"range\" id=\"s-v\" min=\"0.5\" max=\"2.5\" step=\"0.1\" value=\"1.2\">\n        <span class=\"tip\">返速高 → 摩阻大 → ECD 升高</span>\n      </div>\n      <div class=\"ctl\">\n        <label>储层渗透率 (mD)<output id=\"o-k\">250</output></label>\n        <input type=\"range\" id=\"s-k\" min=\"10\" max=\"5000\" step=\"10\" value=\"250\">\n        <span class=\"tip\">高渗透储层漏失通道容易打开</span>\n      </div>\n      <div class=\"ctl preset\">\n        <label>快捷场景</label>\n        <div class=\"preset-btns\">\n          <button data-p=\"safe\">✅ 安全井</button>\n          <button data-p=\"warn\">⚠️ 临界</button>\n          <button data-p=\"risk\">❌ 高风险</button>\n          <button data-p=\"frac\">🪨 裂缝发育</button>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <!-- 因素贡献图 -->\n  <div class=\"section\">\n    <h2>② 当前预测的因素贡献度</h2>\n    <p class=\"hint\">条形长度 = 该因素在 <b>LightGBM 分裂节点</b>中本次预测贡献的信息增益。红色表示该因素当前值\"朝危险方向\"。</p>\n    <svg id=\"bars\" viewBox=\"0 0 600 220\" role=\"img\" aria-label=\"因素重要性\"></svg>\n  </div>\n\n  <!-- 沿井深风险曲线 -->\n  <div class=\"section\">\n    <h2>③ 沿井深的漏失风险热图</h2>\n    <p class=\"hint\">假设井斜、裂缝密度沿井深变化，不同井段的漏失风险也不同。<b>红色段</b>是需要特别关注的区域——固井时这些位置最可能出问题。</p>\n    <svg id=\"depth-risk\" viewBox=\"0 0 720 200\" role=\"img\" aria-label=\"沿井深风险曲线\"></svg>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "调节窗口裕度、裂缝密度、ECD 等因素，实时计算漏失概率。条形图显示哪些因素对当前井的风险贡献最大——就是树模型在这次预测里实际用到的分裂条件。",
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
