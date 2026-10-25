/* =========================================================
   案例插件（静态注册版）：固井质量智能评价：CBL/VDL 波形自动分级
   ---------------------------------------------------------
   由 cases/c1-quality-eval/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "c1-quality-eval",
    "sceneId": "c1",
    "methods": [
      "cv",
      "ts"
    ],
    "title": "固井质量智能评价：CBL/VDL 波形自动分级",
    "version": "1.0.0",
    "updated": "2026-10-23",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "固井质量好不好，最终要靠测井验证。CBL（水泥胶结测井）和 VDL（变密度测井）是行业标准：声波从井眼内发射，穿过套管、水泥环、地层后被接收，各层之间的胶结好坏会在波形上呈现不同的衰减特征。传统做法是解释员逐段目视评级，一个区块几百口井，重复且主观。",
        "judge": [
          {
            "label": "任务类型",
            "value": "波形分类 + 分段",
            "desc": "按深度段输出 A/B/C/D 等级"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "历史 CBL/VDL 图带人工评级"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "大幅提高固井质量评价效率"
          },
          {
            "label": "难度",
            "value": "高",
            "desc": "等级边界模糊，不同解释员一致性差"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>解释员看 CBL/VDL 图的方式：逐段目视 CBL 曲线幅度（强胶结 = 低幅度 = 套管波被水泥吸收；弱胶结 = 高幅度 = 套管波直接穿过），同时看 VDL 上套管波 vs 地层波的相对强度，综合给出 A/B/C/D 等级。</p><p>问题有三：<b>慢</b>——一口井 CBL/VDL 图长 3000+ 米，逐段看要 1—2 小时；<b>主观性强</b>——同一口井两位解释员给的等级能差一档，尤其是 B/C 边界附近；<b>标准不统一</b>——有些单位按 CBL 幅度阈值硬分，有些单位综合 VDL 形态判断。</p><div class='figure'><svg viewBox='0 0 720 260' width='100%' role='img' aria-label='套管波与地层波能量对比决定胶结等级'><rect x='0' y='0' width='720' height='260' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 声波路径与胶结等级</text><rect x='40' y='54' width='250' height='150' fill='none' stroke='var(--line)'/><rect x='88' y='54' width='30' height='150' fill='var(--jade)' opacity='0.12'/><rect x='118' y='54' width='8' height='150' fill='var(--ink-3)'/><rect x='194' y='54' width='8' height='150' fill='var(--ink-3)'/><rect x='202' y='54' width='30' height='150' fill='var(--jade)' opacity='0.12'/><rect x='158' y='70' width='8' height='134' fill='var(--ink-3)'/><path d='M124 80 q-7 14 0 28 q7 14 0 28 q-7 14 0 28 q7 14 0 28' fill='none' stroke='var(--bad)' stroke-width='1.6'/><path d='M166 115 L232 92 L278 115 L232 138 Z' fill='none' stroke='var(--jade)' stroke-width='1.6' stroke-dasharray='4 3'/><text x='92' y='70' font-size='9' fill='var(--bad)'>套管波</text><text x='240' y='84' font-size='9' fill='var(--jade)'>地层波</text><text x='335' y='48' font-size='9.5' fill='var(--ink-2)'>套管波弱 + 地层波强 → 等级</text><rect x='535' y='58' width='8' height='8' fill='var(--bad)'/><text x='547' y='65' font-size='9' fill='var(--ink-3)'>套管波</text><rect x='600' y='58' width='8' height='8' fill='var(--jade)'/><text x='612' y='65' font-size='9' fill='var(--ink-3)'>地层波</text><line x1='335' y1='200' x2='690' y2='200' stroke='var(--line)'/><rect x='350' y='166' width='16' height='34' fill='var(--bad)'/><rect x='378' y='120' width='16' height='80' fill='var(--jade)'/><rect x='430' y='144' width='16' height='56' fill='var(--bad)'/><rect x='458' y='148' width='16' height='52' fill='var(--jade)'/><rect x='510' y='120' width='16' height='80' fill='var(--bad)'/><rect x='538' y='174' width='16' height='26' fill='var(--jade)'/><rect x='590' y='104' width='16' height='96' fill='var(--bad)'/><rect x='618' y='190' width='16' height='10' fill='var(--jade)'/><text x='372' y='218' font-size='9.5' fill='var(--ok)' text-anchor='middle'>A 好</text><text x='452' y='218' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>B 中</text><text x='532' y='218' font-size='9.5' fill='var(--warn)' text-anchor='middle'>C 差</text><text x='612' y='218' font-size='9.5' fill='var(--bad)' text-anchor='middle'>D 窜</text><text x='18' y='250' font-size='9' fill='var(--ink-3)'>胶结好时水泥—地层阻抗连续，套管波被吸收减弱、能量进入地层；胶结差时套管波强、地层波弱</text></svg><div class='figcap'><b>图 1</b><span>套管波沿套管传播，胶结好时能量被水泥环导入地层；套管波强、地层波弱即弱胶结，按两者能量比划分 A/B/C/D</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 把评级问题拆成两步：<b>特征提取 → 分类</b>。先从原始波形里提取定量特征（CBL 幅度、VDL 上套管波能量、地层波能量比、波形形态熵），再用 1D CNN 或 Transformer 对每个深度点预测等级概率，最后沿深度方向做平滑约束（相邻点等级不应跳变）。</p><p>这里的难点不在于\"模型精度\"，而在于<b>标签本身的不确定性</b>——不同解释员对 B/C 边界的判断可差 20% 的幅度阈值。所以模型输出的不是单值等级，而是<b>每个等级的概率分布</b>：比如某段 P(A)=0.12, P(B)=0.68, P(C)=0.18, P(D)=0.02。解释员看到这个分布，就能判断\"这段是典型的 B，还是 B/C 边界需要人工复核\"。</p><div class='figure'><svg viewBox='0 0 720 240' width='100%' role='img' aria-label='从 CBL 曲线到分级模型流程'><rect x='0' y='0' width='720' height='240' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>B · 从 CBL 曲线到分级模型</text><line x1='120' y1='42' x2='120' y2='205' stroke='var(--ink-3)'/><text x='112' y='46' font-size='9' fill='var(--ink-3)' text-anchor='end'>0 m</text><text x='112' y='125' font-size='9' fill='var(--ink-3)' text-anchor='end'>1500</text><text x='112' y='204' font-size='9' fill='var(--ink-3)' text-anchor='end'>3000</text><rect x='96' y='46' width='24' height='36' fill='var(--ok)' opacity='0.3' stroke='var(--ok)'/><rect x='84' y='86' width='36' height='38' fill='var(--jade)' opacity='0.3' stroke='var(--jade)'/><rect x='70' y='128' width='50' height='44' fill='var(--warn)' opacity='0.3' stroke='var(--warn)'/><rect x='60' y='176' width='60' height='28' fill='var(--bad)' opacity='0.3' stroke='var(--bad)'/><text x='88' y='68' font-size='9' fill='var(--ok)' text-anchor='end'>A</text><text x='76' y='108' font-size='9' fill='var(--ink-2)' text-anchor='end'>B</text><text x='62' y='154' font-size='9' fill='var(--warn)' text-anchor='end'>C</text><text x='52' y='194' font-size='9' fill='var(--bad)' text-anchor='end'>D</text><text x='128' y='68' font-size='9' fill='var(--ink-3)'>胶结好</text><text x='128' y='108' font-size='9' fill='var(--ink-3)'>中等</text><text x='128' y='154' font-size='9' fill='var(--ink-3)'>差</text><text x='128' y='194' font-size='9' fill='var(--ink-3)'>窜槽</text><text x='58' y='222' font-size='9' fill='var(--ink-3)'>← CBL 幅度</text><path d='M172 125 L208 125' stroke='var(--ink-3)' stroke-width='1.4'/><path d='M208 121 L216 125 L208 129 Z' fill='var(--ink-3)'/><rect x='225' y='82' width='108' height='50' rx='5' fill='var(--paper-2)' stroke='var(--line)'/><text x='235' y='102' font-size='9.5' fill='var(--ink-2)'>12 维特征</text><text x='235' y='118' font-size='9' fill='var(--ink-3)'>幅度·能量比·熵</text><rect x='351' y='82' width='108' height='50' rx='5' fill='var(--paper-2)' stroke='var(--line)'/><text x='361' y='102' font-size='9.5' fill='var(--ink-2)'>1D U-Net</text><text x='361' y='118' font-size='9' fill='var(--ink-3)'>逐点四分类</text><rect x='477' y='82' width='108' height='50' rx='5' fill='var(--paper-2)' stroke='var(--line)'/><text x='487' y='102' font-size='9.5' fill='var(--ink-2)'>等级概率</text><text x='487' y='118' font-size='9' fill='var(--ink-3)'>P(A) 至 P(D)</text><rect x='603' y='82' width='108' height='50' rx='5' fill='var(--paper-2)' stroke='var(--line)'/><text x='613' y='102' font-size='9.5' fill='var(--ink-2)'>CRF + 段长</text><text x='613' y='118' font-size='9' fill='var(--ink-3)'>输出 A/B/C/D 段</text><path d='M333 107 L345 107' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M345 104 L351 107 L345 110 Z' fill='var(--ink-3)'/><path d='M459 107 L471 107' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M471 104 L477 107 L471 110 Z' fill='var(--ink-3)'/><path d='M585 107 L597 107' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M597 104 L603 107 L597 110 Z' fill='var(--ink-3)'/><text x='225' y='162' font-size='9' fill='var(--ink-3)'>示例：P(B)=0.68，P(A)=0.12，P(C)=0.18 → 置信度不足则标记待复核</text><text x='225' y='184' font-size='9' fill='var(--ink-3)'>相邻深度点等级不跳变；短于 0.5 m 的段合并后再输出</text></svg><div class='figcap'><b>图 2</b><span>CBL 幅度逐点输入 1D U-Net，输出四类概率；CRF 平滑与最小段长后得到沿井深的段级等级</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">CBL/VDL 数据比之前几个场景的门槛稍高——需要处理声波测井的原始数据格式：</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">CBL 原始数据（LAI 格式）</span><span class=\"cl-s\">0.125 m 采样，全井段</span></span><span class=\"cl-n\">每口井 1 份</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">VDL 变密度图</span><span class=\"cl-s\">时间 × 深度灰度图</span></span><span class=\"cl-n\">含套管波 / 地层波能量</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">历史评级标签</span><span class=\"cl-s\">至少 50 口井</span></span><span class=\"cl-n\">按深度段给 A/B/C/D</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">验窜结果（真值）</span><span class=\"cl-s\">挤水泥试压 / 生产验证</span></span><span class=\"cl-n\">用于校准等级含义</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>高</b>。核心瓶颈：<b>标签质量</b>。如果训练标签本身不一致，模型不可能学到比标签更准的东西。解决方向：① 多位解释员交叉标注，取中位数标签，保留标签一致性指标作为样本权重；② 用弱监督学习——先在有标签的井上学，再用无标签井的 VDL 形态聚类扩充训练集。</p><p>另一个陷阱：<b>微环隙</b>——注水泥过程中套管受热膨胀，冷却后水泥环与套管之间出现微小间隙，CBL 上表现为弱胶结但实际不窜槽。这是假正例，模型要学会区分。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/cv\">1D CNN<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">序列分割<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">多标签分类<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">弱监督学习<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "XX 区块 87 口井的 CBL 自动评级",
        "lead": [
          "XX 区块完成固井 3 年，已有 87 口井的 CBL/VDL 数据和人工评级记录。需要对新完钻的井实现快速质量评价，从单井 1.5 小时压缩到 5 分钟。",
          "模型训练中发现：加入 VDL 的地层波/套管波能量比特征后，B/C 边界的预测准确率从 62% 提升到 84%——说明 VDL 确实提供了 CBL 没有的信息。"
        ],
        "stats": [
          [
            "训练井数",
            "62"
          ],
          [
            "验证井数",
            "25"
          ],
          [
            "深度采样点",
            "230 万"
          ],
          [
            "等级一致率",
            "87% vs 人工"
          ],
          [
            "单井评级耗时",
            "5 min vs 1.5 h"
          ]
        ],
        "steps": [
          {
            "name": "数据整理与对齐",
            "role": "数据",
            "do": "把 87 口井的 CBL/VDL 原始数据从 LAI 格式解码，统一采样率（0.125 m），与深度对齐。同时把人工评级的 PDF 扫描件里的分段结果数字化，得到每个深度段的 A/B/C/D 标签。",
            "effect": "得到\"深度 × 特征 × 标签\"的结构化数据集",
            "trap": "有些井的 VDL 与 CBL 深度基准不一致，需要做校正"
          },
          {
            "name": "特征工程",
            "role": "特征",
            "do": "从 CBL/VDL 计算 12 个特征：CBL 幅度均值/方差、套管波能量、地层波能量、两者比值、波形偏度、峰态、局部坡度等。用滑窗（±1 m）计算多尺度特征。",
            "effect": "每个深度点从 1 维幅度值变成 12 维特征向量",
            "trap": "特征之间高度相关（如 CBL 幅度与套管波能量），需要做 PCA 或只用关键特征"
          },
          {
            "name": "模型训练",
            "role": "算法核心",
            "do": "用 1D U-Net 做序列分割（逐深度点分类），损失函数用加权交叉熵（D 类样本少，权重大）。按\"井\"划分训练/验证集，避免同井泄漏。Early stopping 监控验证集宏平均 F1。",
            "effect": "验证集宏平均 F1 0.81，等级一致率 87%（与人工对比）",
            "trap": "逐点 F1 会偏高，实际业务关心\"段级\"评级——相邻 10 点以上同等级才算一段"
          },
          {
            "name": "后处理与段级输出",
            "role": "工程",
            "do": "对模型输出的逐点概率做：① 条件随机场（CRF）平滑——相邻点等级不应跳变；② 最小段长规则——短于 0.5 m 的段合并到邻段；③ 置信度标注——低于 0.6 的段标记为\"待人工复核\"。",
            "effect": "输出结果与人工评级的差异缩小到\"段级\"而非\"点级\"",
            "trap": "CRF 太强硬会把真实的薄弱胶结段抹平——这是业务需要关注的"
          },
          {
            "name": "与验窜结果校准",
            "role": "质控",
            "do": "找区块内有挤水泥验窜记录的井，对比模型评级与实际验窜结果。如果\"模型给 B 但验窜需挤水泥\"的比例高，说明 B/C 阈值偏严，需要调整模型输出的概率阈值。",
            "effect": "等级含义与业务动作对应起来（A/B = 合格，C/D = 需要补救）",
            "trap": "验窜本身也是判断，不是绝对真值——需要多井次交叉验证"
          }
        ],
        "metrics": {
          "title": "怎么算\"评级准了\"",
          "html": "<p>固井质量评级的评测有两个层次：<b>逐点</b>（每个 0.125 m 采样点）和 <b>逐段</b>（每段 ≥ 0.5 m 连续同等级）。业务关心的是<b>逐段一致率</b>——因为挤水泥决策是按段做的。</p><table class=\"dtable\"><thead><tr><th>等级</th><th>含义</th><th>样例占比</th><th>精确率</th><th>召回率</th></tr></thead><tbody><tr><td>A</td><td>胶结好</td><td>32%</td><td>0.91</td><td>0.93</td></tr><tr><td>B</td><td>胶结中等</td><td>38%</td><td>0.82</td><td>0.85</td></tr><tr><td>C</td><td>胶结差</td><td>22%</td><td>0.78</td><td>0.74</td></tr><tr><td>D</td><td>窜槽</td><td>8%</td><td>0.88</td><td>0.81</td></tr></tbody></table><p class=\"small muted\">注：B/C 边界是最难的——不同解释员的判定标准差异最大。召回率偏低的 C 类是后续优化的重点。</p>"
        },
        "fails": [
          {
            "name": "微环隙假阳性",
            "why": "CBL 幅度显示弱胶结，但实际是微环隙（热胀冷缩造成），不影响封隔。模型需要用 VDL 的地层波特征来区分。"
          },
          {
            "name": "薄层漏检",
            "why": "厚度 < 0.5 m 的 D 级薄层被最小段长规则合并掉了。但这种薄层恰恰是窜槽通道，需要在合并前单独检查。"
          },
          {
            "name": "水泥塞误判",
            "why": "井底水泥塞段的波形特征与正常段不同，模型容易给 D 级但实际是正常水泥塞。需要在井段开头/结尾禁用评级或特殊处理。"
          }
        ]
      }
    }
  };

  var FILES = [
      {
        "name": "demo/demo.css",
        "data": "/* ========= 固井质量评价示范样式 ========= */\n* { box-sizing: border-box; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #fbfaf6;\n  color: #242b2e;\n  padding: 32px 28px;\n  line-height: 1.65;\n}\n.panel { max-width: 960px; margin: 0 auto; }\nh1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }\nh2 { font-size: 15px; font-weight: 600; margin: 20px 0 8px; color: #235f51; }\n.lead { color: #4d565b; margin-bottom: 14px; }\n.hint { font-size: 12.5px; color: #79828a; margin-bottom: 10px; }\n.section { background: #fff; border: 1px solid #e9e4d8; border-radius: 9px; padding: 18px 22px; margin-bottom: 16px; }\n\n.cbl-legend { display: flex; gap: 16px; font-size: 12px; color: #5d666d; margin-top: 8px; flex-wrap: wrap; }\n.cbl-legend span { display: flex; align-items: center; gap: 5px; }\n.cbl-legend i { width: 12px; height: 12px; border-radius: 2px; }\n.cbl-legend .ai-line { width: 16px; height: 2px; background: #235f51; }\n.cbl-legend .truth-line { width: 16px; height: 2px; background: #b05a51; border-style: dashed; border-width: 0; border-top: 2px dashed #b05a51; }\n\n.vdl-wrap { background: #fdfcf9; border-radius: 6px; padding: 8px; overflow-x: auto; }\n\n.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n.ctl { display: flex; flex-direction: column; gap: 4px; padding: 11px 14px; background: #f5f2ea; border-radius: 7px; }\n.ctl label { font-size: 13px; display: flex; justify-content: space-between; font-weight: 500; }\n.ctl output { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: #2f7d6b; }\n.ctl .tip { font-size: 11.5px; color: #9ba3a9; }\n.ctl input[type=\"checkbox\"] { accent-color: #2f7d6b; }\n\n.btn-row { display: flex; gap: 12px; align-items: center; margin-top: 12px; }\n.btn-row button {\n  padding: 8px 18px; border-radius: 6px; border: 1px solid #c9c2b0;\n  background: #fff; cursor: pointer; font-size: 13px; font-weight: 500;\n}\n.btn-row button:hover { border-color: #2f7d6b; color: #2f7d6b; }\n.btn-row button.primary { background: #2f7d6b; border-color: #2f7d6b; color: #fff; }\n.btn-row button.primary:hover { background: #235f51; }\n.result-stat { font-size: 12.5px; color: #79828a; }\n\n.seg-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }\n.seg-table th { background: #f5f2ea; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 12px; }\n.seg-table td { padding: 7px 10px; border-bottom: 1px solid #efece1; }\n.seg-table tr:hover { background: #f5f2ea; }\n.seg-table .grade { font-family: 'JetBrains Mono', Consolas, monospace; font-weight: 600; }\n.seg-table .grade.a { color: #3f8560; }\n.seg-table .grade.b { color: #5a9a70; }\n.seg-table .grade.c { color: #b58a38; }\n.seg-table .grade.d { color: #b05a51; }\n.prob-cell { display: flex; gap: 2px; height: 14px; align-items: center; }\n.prob-cell .pb { height: 100%; border-radius: 2px; min-width: 1px; }\n"
      },
      {
        "name": "demo/demo.js",
        "data": "/* ======= 固井质量 CBL/VDL 智能评价 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  // ---------- 状态 ----------\n  let S = { gapS: 55, gapL: 8, noise: 2, microGap: false };\n\n  const N = 800;       // 采样点数\n  const DEPTH = 3000;  // 总深度 m\n  const STEP = DEPTH / N;\n\n  // 等级颜色\n  const GRADE = {\n    A: { color: '#3f8560', bg: 'rgba(63,133,96,0.18)', label: '好' },\n    B: { color: '#7ab890', bg: 'rgba(122,184,144,0.18)', label: '中' },\n    C: { color: '#c9a15a', bg: 'rgba(201,161,90,0.18)', label: '差' },\n    D: { color: '#b05a51', bg: 'rgba(176,90,81,0.20)', label: '窜槽' }\n  };\n\n  // ---------- 随机数 ----------\n  function mulberry32(a) {\n    return function () {\n      a |= 0; a = a + 0x6D2B79F5 | 0;\n      var t = Math.imul(a ^ a >>> 15, 1 | a);\n      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;\n      return ((t ^ t >>> 14) >>> 0) / 4294967296;\n    };\n  }\n\n  // ---------- 合成 CBL ----------\n  // 基准分级：A 低幅度 / B 中低 / C 高 / D 极高\n  // 基础构造：几段 A + B + C + D\n  function generateWell() {\n    const rnd = mulberry32(20261023);\n    const gauss = () => {\n      let u = 0, v = 0;\n      while (u === 0) u = rnd();\n      while (v === 0) v = rnd();\n      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);\n    };\n\n    // 基础真实等级（沿井深）\n    const truth = new Array(N).fill(null);\n\n    // 主体：交替的好胶结段\n    let pos = 0;\n    while (pos < N) {\n      // 随机段长和等级\n      const segLen = Math.floor(N * (0.04 + rnd() * 0.08)); // 4-12%\n      const r = rnd();\n      let grade;\n      if (r < 0.45) grade = 'A';\n      else if (r < 0.75) grade = 'B';\n      else if (r < 0.92) grade = 'C';\n      else grade = 'D';\n      for (let i = 0; i < segLen && pos + i < N; i++) truth[pos + i] = grade;\n      pos += segLen;\n    }\n\n    // 用户指定的窜槽段（覆盖）\n    const gs = Math.floor(S.gapS / 100 * N);\n    const gl = Math.floor(S.gapL / 100 * N);\n    for (let i = gs; i < gs + gl && i < N; i++) truth[i] = 'D';\n\n    // 微环隙（假弱胶结）\n    if (S.microGap) {\n      const ms = Math.floor(0.35 * N);\n      const ml = Math.floor(N * 0.03);\n      for (let i = ms; i < ms + ml && i < N; i++) truth[i] = truth[i] === 'A' ? 'B' : truth[i];\n    }\n\n    // 合成 CBL 幅度：不同等级 + 噪声\n    const cbl = new Float64Array(N);\n    for (let i = 0; i < N; i++) {\n      let base;\n      if (truth[i] === 'A') base = 80 + gauss() * 12;\n      else if (truth[i] === 'B') base = 115 + gauss() * 15;\n      else if (truth[i] === 'C') base = 165 + gauss() * 18;\n      else base = 240 + gauss() * 25;\n      cbl[i] = Math.max(20, base + gauss() * S.noise * 5);\n    }\n\n    return { truth, cbl };\n  }\n\n  // ---------- AI 分类（简化版 1D CNN 逻辑）----------\n  function aiClassify(cbl) {\n    const N = cbl.length;\n    // 1. 滑窗特征（均值 + 方差）\n    const W = 12; // 窗宽（~ 1.5 m）\n    const mean = new Float64Array(N), var_ = new Float64Array(N);\n    for (let i = 0; i < N; i++) {\n      let s = 0, count = 0;\n      for (let j = Math.max(0, i - W); j <= Math.min(N - 1, i + W); j++) { s += cbl[j]; count++; }\n      mean[i] = s / count;\n      let sv = 0;\n      for (let j = Math.max(0, i - W); j <= Math.min(N - 1, i + W); j++) sv += Math.pow(cbl[j] - mean[i], 2);\n      var_[i] = sv / count;\n    }\n\n    // 2. 基于均值阈值的概率分布（模拟 softmax 输出）\n    // 阈值：A<95, B 95-140, C 140-200, D>200\n    const probs = new Array(N).fill(null);\n    for (let i = 0; i < N; i++) {\n      const m = mean[i];\n      const v = Math.sqrt(var_[i]);\n      // 用高斯分布计算每个等级的 logit\n      const pA = Math.exp(-Math.pow((m - 80) / 30, 2));\n      const pB = Math.exp(-Math.pow((m - 120) / 35, 2));\n      const pC = Math.exp(-Math.pow((m - 175) / 45, 2));\n      const pD = Math.exp(-Math.pow((m - 240) / 55, 2));\n      const sum = pA + pB + pC + pD + 1e-9;\n      probs[i] = {\n        A: Math.max(0.05, pA / sum),\n        B: Math.max(0.05, pB / sum),\n        C: Math.max(0.05, pC / sum),\n        D: Math.max(0.05, pD / sum)\n      };\n      // 归一化\n      const s2 = probs[i].A + probs[i].B + probs[i].C + probs[i].D;\n      probs[i].A /= s2; probs[i].B /= s2; probs[i].C /= s2; probs[i].D /= s2;\n    }\n\n    // 3. CRF-like 平滑：相邻点不能差太远\n    const smooth = probs.map(p => ({ ...p }));\n    for (let iter = 0; iter < 3; iter++) {\n      const old = smooth.map(p => ({ ...p }));\n      for (let i = 2; i < N - 2; i++) {\n        ['A', 'B', 'C', 'D'].forEach(g => {\n          smooth[i][g] = old[i][g] * 0.6 + (old[i-1][g] + old[i+1][g]) * 0.2;\n        });\n        const s = smooth[i].A + smooth[i].B + smooth[i].C + smooth[i].D;\n        smooth[i].A /= s; smooth[i].B /= s; smooth[i].C /= s; smooth[i].D /= s;\n      }\n    }\n\n    // 4. 取 argmax\n    const pred = new Array(N);\n    for (let i = 0; i < N; i++) {\n      const p = smooth[i];\n      let best = 'A', bv = 0;\n      ['A', 'B', 'C', 'D'].forEach(g => { if (p[g] > bv) { bv = p[g]; best = g; } });\n      pred[i] = { grade: best, prob: smooth[i] };\n    }\n\n    // 5. 后处理：合并短段（< 10 点 = ~ 0.1125 m 的段合并）\n    const MERGE_THRESH = 12;\n    const segs = [];\n    let cur = { start: 0, grade: pred[0].grade };\n    for (let i = 1; i < N; i++) {\n      if (pred[i].grade !== cur.grade) {\n        cur.end = i;\n        segs.push(cur);\n        cur = { start: i, grade: pred[i].grade };\n      }\n    }\n    cur.end = N; segs.push(cur);\n\n    // 合并短段到相邻长段\n    const merged = [];\n    for (let i = 0; i < segs.length; i++) {\n      const seg = segs[i];\n      if (seg.end - seg.start < MERGE_THRESH && merged.length > 0) {\n        // 合并到前一段\n        merged[merged.length - 1].end = seg.end;\n      } else {\n        merged.push({ ...seg });\n      }\n    }\n\n    return { probs: smooth, pred, segs: merged };\n  }\n\n  // ---------- CBL 曲线渲染 ----------\n  function drawCBL(data, ai) {\n    const svg = document.getElementById('cbl');\n    const W = 760, H = 300, padL = 54, padR = 14, padT = 20, padB = 32;\n    const plotW = W - padL - padR, plotH = H - padT - padB;\n    const YMAX = 300;\n\n    function xOf(i) { return padL + i / (N - 1) * plotW; }\n    function yOf(v) { return padT + (1 - v / YMAX) * plotH; }\n    function depthOf(i) { return (i / N * DEPTH).toFixed(0); }\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 背景：真实等级段\n    for (let g of ['A', 'B', 'C', 'D']) {\n      let inSeg = false, ss = 0;\n      for (let i = 0; i < N; i++) {\n        if (data.truth[i] === g && !inSeg) { inSeg = true; ss = i; }\n        if (data.truth[i] !== g && inSeg) {\n          s += `<rect x=\"${xOf(ss)}\" y=\"${padT}\" width=\"${xOf(i) - xOf(ss)}\" height=\"${plotH}\" fill=\"${GRADE[g].bg}\"/>`;\n          inSeg = false;\n        }\n      }\n      if (inSeg) s += `<rect x=\"${xOf(ss)}\" y=\"${padT}\" width=\"${xOf(N - 1) - xOf(ss)}\" height=\"${plotH}\" fill=\"${GRADE[g].bg}\"/>`;\n    }\n\n    // 网格\n    [0, 100, 200, 300].forEach(v => {\n      const y = yOf(v);\n      s += `<line x1=\"${padL}\" y1=\"${y}\" x2=\"${padL + plotW}\" y2=\"${y}\" stroke=\"#efece1\"/>`;\n      s += `<text x=\"${padL - 6}\" y=\"${y + 3}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">${v}</text>`;\n    });\n    for (let d = 0; d <= DEPTH; d += 600) {\n      const x = padL + d / DEPTH * plotW;\n      s += `<text x=\"${x}\" y=\"${H - 10}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">${d}m</text>`;\n    }\n\n    // AI 分段边界\n    ai.segs.forEach(seg => {\n      s += `<line x1=\"${xOf(seg.start)}\" y1=\"${padT}\" x2=\"${xOf(seg.start)}\" y2=\"${padT + plotH}\" stroke=\"#235f51\" stroke-width=\"1\" stroke-dasharray=\"4 3\"/>`;\n      // 等级标签\n      const mid = Math.floor((seg.start + seg.end) / 2);\n      s += `<text x=\"${xOf(mid)}\" y=\"${padT + 14}\" font-size=\"11\" font-weight=\"600\" fill=\"${GRADE[seg.grade].color}\" text-anchor=\"middle\">${seg.grade}</text>`;\n    });\n    // 最后一条边界\n    if (ai.segs.length > 0) {\n      s += `<line x1=\"${xOf(ai.segs[ai.segs.length - 1].end)}\" y1=\"${padT}\" x2=\"${xOf(ai.segs[ai.segs.length - 1].end)}\" y2=\"${padT + plotH}\" stroke=\"#235f51\" stroke-width=\"1\" stroke-dasharray=\"4 3\"/>`;\n    }\n\n    // CBL 曲线\n    let path = '';\n    for (let i = 0; i < N; i++) path += (i ? 'L' : 'M') + xOf(i).toFixed(1) + ' ' + yOf(Math.min(YMAX, data.cbl[i])).toFixed(1) + ' ';\n    s += `<path d=\"${path}\" fill=\"none\" stroke=\"#242b2e\" stroke-width=\"1.1\" stroke-linejoin=\"round\"/>`;\n\n    // 真实边界（红色虚线）\n    let inSeg = false, ss = 0, lastGrade = null;\n    for (let i = 0; i < N; i++) {\n      if (!inSeg || data.truth[i] !== lastGrade) {\n        if (inSeg) {\n          s += `<line x1=\"${xOf(ss)}\" y1=\"${padT}\" x2=\"${xOf(ss)}\" y2=\"${padT + plotH}\" stroke=\"#b05a51\" stroke-width=\"1\" stroke-dasharray=\"2 2\"/>`;\n        }\n        ss = i; inSeg = true; lastGrade = data.truth[i];\n      }\n    }\n    if (inSeg) s += `<line x1=\"${xOf(N - 1)}\" y1=\"${padT}\" x2=\"${xOf(N - 1)}\" y2=\"${padT + plotH}\" stroke=\"#b05a51\" stroke-width=\"1\" stroke-dasharray=\"2 2\"/>`;\n\n    s += `<text x=\"${padL}\" y=\"${padT - 6}\" font-size=\"10\" fill=\"#9ba3a9\" font-family=\"monospace\">CBL 幅度 (mV) →</text>`;\n    svg.innerHTML = s;\n\n    return { xOf, depthOf };\n  }\n\n  // ---------- VDL 渲染（简化）----------\n  function drawVDL(data, ai) {\n    const canvas = document.getElementById('vdl');\n    const ctx = canvas.getContext('2d');\n    const W = canvas.width, H = canvas.height;\n    const Nt = 80;   // 时间采样\n    const Nd = N;    // 深度采样\n\n    // 清空\n    ctx.fillStyle = '#fdfcf9';\n    ctx.fillRect(0, 0, W, H);\n\n    const cellW = W / Nd, cellH = H / Nt;\n\n    // 每个深度点生成简化的 VDL 图像\n    for (let d = 0; d < Nd; d++) {\n      const grade = ai.pred[d].grade;\n      let casingStrong, formationStrong;\n      if (grade === 'A') { casingStrong = 0.3; formationStrong = 0.9; }\n      else if (grade === 'B') { casingStrong = 0.5; formationStrong = 0.7; }\n      else if (grade === 'C') { casingStrong = 0.8; formationStrong = 0.3; }\n      else { casingStrong = 0.95; formationStrong = 0.1; }\n\n      // 时间上：套管波早（t < 25），地层波晚（t > 30）\n      for (let t = 0; t < Nt; t++) {\n        let intensity;\n        if (t < 25) intensity = casingStrong * Math.exp(-Math.pow((t - 12) / 6, 2));\n        else if (t > 30) intensity = formationStrong * Math.exp(-Math.pow((t - 55) / 15, 2));\n        else intensity = 0;\n        intensity = Math.min(1, intensity + (Math.random() - 0.5) * S.noise * 0.08);\n\n        // 颜色：灰度 + 胶结等级轻微色调\n        let r, g, b;\n        const base = Math.floor(intensity * 255);\n        if (grade === 'A') { r = base * 0.7; g = base; b = base * 0.85; }\n        else if (grade === 'B') { r = base * 0.9; g = base; b = base * 0.8; }\n        else if (grade === 'C') { r = base; g = base * 0.92; b = base * 0.7; }\n        else { r = base; g = base * 0.78; b = base * 0.72; }\n\n        ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;\n        ctx.fillRect(d * cellW, t * cellH, Math.ceil(cellW), Math.ceil(cellH));\n      }\n    }\n\n    // 套管波 / 地层波 标注\n    ctx.fillStyle = '#9ba3a9';\n    ctx.font = '9px monospace';\n    ctx.fillText('← 套管波早', 2, 12);\n    ctx.fillText('地层波晚 →', W - 60, 12);\n  }\n\n  // ---------- 结果表格 ----------\n  function drawTable(data, ai) {\n    const tbody = document.querySelector('#seg-table tbody');\n    const xOf = (i) => (i / N * DEPTH);\n\n    let html = '';\n    let tp = 0, fp = 0, fn = 0, tn = 0;\n\n    ai.segs.forEach((seg, idx) => {\n      // 真实等级（取段内多数）\n      const counts = {};\n      for (let i = seg.start; i < seg.end; i++) {\n        counts[data.truth[i]] = (counts[data.truth[i]] || 0) + 1;\n      }\n      let trueGrade = 'A', maxC = 0;\n      ['A', 'B', 'C', 'D'].forEach(g => { if ((counts[g] || 0) > maxC) { maxC = counts[g]; trueGrade = g; } });\n\n      const meanCBL = (() => {\n        let s = 0, c = 0;\n        for (let i = seg.start; i < seg.end; i++) { s += data.cbl[i]; c++; }\n        return (s / c).toFixed(1);\n      })();\n\n      // 段中点概率\n      const mid = Math.floor((seg.start + seg.end) / 2);\n      const p = ai.probs[mid];\n\n      // 统计\n      if (seg.grade === trueGrade) {\n        if (trueGrade === 'D' || trueGrade === 'C') tp++; else tn++;\n      } else {\n        if (seg.grade === 'D' || seg.grade === 'C') fp++; else fn++;\n      }\n\n      // 概率条颜色\n      const gColors = { A: '#3f8560', B: '#7ab890', C: '#c9a15a', D: '#b05a51' };\n\n      html += `<tr>\n        <td>${idx + 1}</td>\n        <td>${xOf(seg.start).toFixed(0)} – ${xOf(seg.end).toFixed(0)}</td>\n        <td>${(xOf(seg.end) - xOf(seg.start)).toFixed(0)} m</td>\n        <td>${meanCBL}</td>\n        <td><span class=\"grade ${seg.grade.toLowerCase()}\">${seg.grade}</span></td>\n        <td>\n          <div class=\"prob-cell\">\n            ${['A', 'B', 'C', 'D'].map(g => `<div class=\"pb\" style=\"width:${(p[g] * 40).toFixed(1)}px;background:${gColors[g]}\"></div>`).join('')}\n          </div>\n        </td>\n        <td><span class=\"grade ${trueGrade.toLowerCase()}\">${trueGrade}</span></td>\n      </tr>`;\n    });\n\n    tbody.innerHTML = html;\n\n    // 统计\n    const total = ai.segs.length;\n    const correct = tp + tn;\n    const acc = (correct / total * 100).toFixed(0);\n    document.getElementById('result-stat').innerHTML =\n      `共 ${total} 段 · 一致 ${correct} 段 · <b>段级一致率 ${acc}%</b>`;\n  }\n\n  // ---------- 主流程 ----------\n  function run() {\n    const data = generateWell();\n    const ai = aiClassify(data.cbl);\n    drawCBL(data, ai);\n    drawVDL(data, ai);\n    drawTable(data, ai);\n  }\n\n  // ---------- 事件 ----------\n  function bind() {\n    document.getElementById('s-gap-s').addEventListener('input', e => {\n      S.gapS = +e.target.value;\n      document.getElementById('o-gap-s').textContent = S.gapS;\n    });\n    document.getElementById('s-gap-l').addEventListener('input', e => {\n      S.gapL = +e.target.value;\n      document.getElementById('o-gap-l').textContent = S.gapL;\n    });\n    document.getElementById('s-noise').addEventListener('input', e => {\n      S.noise = +e.target.value;\n      document.getElementById('o-noise').textContent = ['低', '较低', '中', '较高', '高'][S.noise - 1];\n    });\n    document.getElementById('c-micro').addEventListener('change', e => {\n      S.microGap = e.target.checked;\n      document.getElementById('o-micro').textContent = S.microGap ? '开' : '关';\n    });\n    document.getElementById('btn-run').addEventListener('click', run);\n  }\n\n  bind();\n  run();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：固井质量 CBL/VDL 智能评价</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>CBL/VDL 固井质量 · 智能评价演示</h1>\n  <p class=\"lead\">下面是一口<b>程序合成的\"半真半假\"井</b>——真实井段里被人工塞了一段窜槽（D 级），看 AI 能不能找到它。拖动滑杆调整窜槽位置和长度。</p>\n\n  <!-- CBL 曲线 + 评级结果 -->\n  <div class=\"section\">\n    <h2>① CBL 曲线 + AI 分段评级</h2>\n    <p class=\"hint\">绿色 = A（好，低幅度），浅绿 = B（中低幅度），橙色 = C（差，高幅度），红色 = D（窜槽，极高幅度）。AI 自动识别每一段的等级，相邻同等级段合并。</p>\n    <svg id=\"cbl\" viewBox=\"0 0 760 300\" role=\"img\" aria-label=\"CBL 曲线\"></svg>\n    <div class=\"cbl-legend\">\n      <span><i style=\"background:#3f8560\"></i>A 好</span>\n      <span><i style=\"background:#7ab890\"></i>B 中</span>\n      <span><i style=\"background:#c9a15a\"></i>C 差</span>\n      <span><i style=\"background:#b05a51\"></i>D 窜槽</span>\n      <span><i class=\"ai-line\"></i>AI 分段</span>\n      <span><i class=\"truth-line\"></i>真实边界</span>\n    </div>\n  </div>\n\n  <!-- VDL 变密度图 -->\n  <div class=\"section\">\n    <h2>② VDL 变密度图（简化版）</h2>\n    <p class=\"hint\">VDL 展示\"时间 × 深度 × 能量\"。好胶结段：左侧强套管波衰减、右侧出现地层波。差胶结段：套管波强、地层波弱——声波没被水泥环吸收，直接穿过套管。</p>\n    <div class=\"vdl-wrap\">\n      <canvas id=\"vdl\" width=\"720\" height=\"180\"></canvas>\n    </div>\n  </div>\n\n  <!-- 控制参数 -->\n  <div class=\"section\">\n    <h2>③ 模拟控制</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>窜槽起始位置 (%)<output id=\"o-gap-s\">55</output></label>\n        <input type=\"range\" id=\"s-gap-s\" min=\"10\" max=\"90\" step=\"1\" value=\"55\">\n        <span class=\"tip\">在井段的 % 位置开始窜槽</span>\n      </div>\n      <div class=\"ctl\">\n        <label>窜槽长度 (%)<output id=\"o-gap-l\">8</output></label>\n        <input type=\"range\" id=\"s-gap-l\" min=\"1\" max=\"25\" step=\"1\" value=\"8\">\n        <span class=\"tip\">模拟窜槽占总长度的比例</span>\n      </div>\n      <div class=\"ctl\">\n        <label>背景噪声<output id=\"o-noise\">低</output></label>\n        <input type=\"range\" id=\"s-noise\" min=\"1\" max=\"5\" step=\"1\" value=\"2\">\n        <span class=\"tip\">高噪声 = 真实井况，AI 更难评级</span>\n      </div>\n      <div class=\"ctl\">\n        <label>微环隙模拟<output id=\"o-micro\">关</output></label>\n        <input type=\"checkbox\" id=\"c-micro\">\n        <span class=\"tip\">加一段假弱胶结，测试 AI 能否区分</span>\n      </div>\n    </div>\n    <div class=\"btn-row\">\n      <button id=\"btn-run\" class=\"primary\">🔍 运行 AI 评级</button>\n      <span class=\"result-stat\" id=\"result-stat\">等待分析…</span>\n    </div>\n  </div>\n\n  <!-- 评级结果详情 -->\n  <div class=\"section\">\n    <h2>④ AI 评级详情（逐段）</h2>\n    <table class=\"seg-table\" id=\"seg-table\">\n      <thead><tr><th>段#</th><th>深度 (m)</th><th>长度 (m)</th><th>CBL 均值</th><th>AI 评级</th><th>各等级概率</th><th>真实等级</th></tr></thead>\n      <tbody></tbody>\n    </table>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动不同胶结质量的比例，看合成 CBL 曲线怎么变化，AI 怎么自动分段评级。绿色段 = A/B 合格，橙红色段 = C/D 需要关注。",
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
