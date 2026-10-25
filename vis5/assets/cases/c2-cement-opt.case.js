/* =========================================================
   案例插件（静态注册版）：注水泥参数智能优化：顶替效率与密度窗口
   ---------------------------------------------------------
   由 cases/c2-cement-opt/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "c2-cement-opt",
    "sceneId": "c2",
    "methods": [
      "opt"
    ],
    "title": "注水泥参数智能优化：顶替效率与密度窗口",
    "version": "1.0.0",
    "updated": "2026-10-23",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "固井的核心动作是注水泥：把水泥浆泵入套管与井眼之间的环空，顶替出原来的钻井液，等待凝固后形成封隔。这个过程只有一次机会——固完就不能重来。水泥浆密度、排量、替浆量三个参数的组合，决定了顶替效率和施工安全性。",
        "judge": [
          {
            "label": "任务类型",
            "value": "物理模型 + 参数优化",
            "desc": "顶替效率有成熟公式，优化器负责找最优组合"
          },
          {
            "label": "标注成本",
            "value": "低",
            "desc": "历史施工记录可作标签，也可用仿真数据"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "一次注水泥失败损失数十万元"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "多目标约束，样本量有限"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>传统注水泥设计流程是：工程师查井况数据 → 用水力计算软件逐方案试算 → 选出一个\"可行\"方案。一套参数组合（密度 × 排量 × 替浆量）的三维空间里，人工只能试几个点，很容易错过真正的最优解。</p><p>现场常见问题：<b>漏失</b>——水泥浆密度过高，压裂地层，浆液漏走，水泥返高不够；<b>窜槽</b>——排量太低或密度差不够，水泥浆驱替不干净，留下钻井液通道；<b>替空</b>——替浆量算错，要么套管内留水泥塞，要么把水泥浆顶出环空。</p><div class='figure'><svg viewBox='0 0 720 270' width='100%' role='img' aria-label='孔隙压力与破裂压力之间的水泥浆密度窗口'><rect x='0' y='0' width='720' height='270' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 地层压力梯度与水泥浆密度窗口</text><line x1='60' y1='40' x2='60' y2='230' stroke='var(--line)'/><line x1='60' y1='230' x2='660' y2='230' stroke='var(--line)'/><line x1='60' y1='135' x2='660' y2='135' stroke='var(--line)' stroke-dasharray='3 3' opacity='0.6'/><text x='52' y='44' font-size='9' fill='var(--ink-3)' text-anchor='end'>0 m</text><text x='52' y='139' font-size='9' fill='var(--ink-3)' text-anchor='end'>2500</text><text x='52' y='234' font-size='9' fill='var(--ink-3)' text-anchor='end'>5000</text><path d='M97 40 L266 40 L590 230 L355 230 Z' fill='var(--jade)' opacity='0.1'/><path d='M97 40 L355 230' fill='none' stroke='var(--ok)' stroke-width='1.8'/><path d='M266 40 L590 230' fill='none' stroke='var(--bad)' stroke-width='1.8'/><line x1='465' y1='50' x2='465' y2='228' stroke='var(--c-opt)' stroke-width='2.5'/><text x='105' y='70' font-size='9' fill='var(--ok)'>孔隙压力线（下限）</text><text x='300' y='70' font-size='9' fill='var(--bad)'>破裂压力线（上限）</text><text x='300' y='185' font-size='10' fill='var(--jade)'>密度窗口</text><text x='475' y='60' font-size='9' fill='var(--c-opt)'>设计密度 1.58</text><line x1='355' y1='218' x2='559' y2='218' stroke='var(--ink-3)' stroke-width='1'/><line x1='355' y1='214' x2='355' y2='222' stroke='var(--ink-3)'/><line x1='559' y1='214' x2='559' y2='222' stroke='var(--ink-3)'/><line x1='465' y1='214' x2='465' y2='222' stroke='var(--c-opt)'/><text x='457' y='212' font-size='9' fill='var(--ink-3)' text-anchor='middle'>窗口宽度</text><line x1='60' y1='230' x2='60' y2='235' stroke='var(--line)'/><line x1='207' y1='230' x2='207' y2='235' stroke='var(--line)'/><line x1='354' y1='230' x2='354' y2='235' stroke='var(--line)'/><line x1='501' y1='230' x2='501' y2='235' stroke='var(--line)'/><line x1='648' y1='230' x2='648' y2='235' stroke='var(--line)'/><text x='60' y='248' font-size='9' fill='var(--ink-3)' text-anchor='middle'>1.0</text><text x='207' y='248' font-size='9' fill='var(--ink-3)' text-anchor='middle'>1.2</text><text x='354' y='248' font-size='9' fill='var(--ink-3)' text-anchor='middle'>1.4</text><text x='501' y='248' font-size='9' fill='var(--ink-3)' text-anchor='middle'>1.6</text><text x='648' y='248' font-size='9' fill='var(--ink-3)' text-anchor='middle'>1.8</text><text x='360' y='266' font-size='9.5' fill='var(--ink-3)' text-anchor='middle'>当量密度 (g/cm³)</text><text x='28' y='135' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 28 135)'>深度</text></svg><div class='figcap'><b>图 1</b><span>孔隙压力与破裂压力两条包络线之间即安全密度窗口；水泥浆当量密度须落在窗口内，并保留一定裕度</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 的角色是<b>高效的方案搜索器</b>。核心公式（环空顶替效率、浆柱当量密度、摩阻压降）都是物理方程，AI 不替代它们，而是用<b>代理模型 + 多目标优化</b>在三维参数空间里快速找到\"既安全又高效\"的帕累托前沿。</p><p>优化目标通常是：① 密度在压力窗口内（不压裂、不气窜）；② 顶替效率最大化（界面混合段最小化）；③ 施工时间最短。约束条件包括：泵排量上限、套管抗内压强度、设备额定功率。AI 可以用高斯过程回归建立代理模型，再用贝叶斯优化逐点评估，几十个样本就能勾出有效前沿。</p><div class='figure'><svg viewBox='0 0 720 250' width='100%' role='img' aria-label='排量与顶替效率、泵压的关系'><rect x='0' y='0' width='720' height='250' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>B · 排量—顶替效率与泵压的折中</text><line x1='60' y1='40' x2='60' y2='195' stroke='var(--line)'/><line x1='60' y1='195' x2='660' y2='195' stroke='var(--line)'/><line x1='60' y1='79' x2='660' y2='79' stroke='var(--ink-3)' stroke-width='1' stroke-dasharray='4 3'/><text x='66' y='73' font-size='9' fill='var(--ink-3)'>η 85%</text><rect x='288' y='40' width='96' height='155' fill='var(--c-opt)' opacity='0.1'/><line x1='288' y1='40' x2='288' y2='195' stroke='var(--c-opt)' stroke-dasharray='3 3' opacity='0.7'/><line x1='384' y1='40' x2='384' y2='195' stroke='var(--c-opt)' stroke-dasharray='3 3' opacity='0.7'/><text x='336' y='56' font-size='9' fill='var(--c-opt)' text-anchor='middle'>推荐区间</text><path d='M80 178 C150 174 230 140 320 108 C410 86 520 78 640 74' fill='none' stroke='var(--jade)' stroke-width='2.2'/><path d='M80 168 C170 158 250 128 330 106 C430 80 540 66 640 58' fill='none' stroke='var(--bad)' stroke-width='1.6' stroke-dasharray='5 3'/><text x='648' y='76' font-size='9' fill='var(--jade)'>η</text><text x='648' y='54' font-size='9' fill='var(--bad)'>泵压</text><line x1='70' y1='48' x2='92' y2='48' stroke='var(--jade)' stroke-width='2'/><text x='98' y='51' font-size='9' fill='var(--ink-3)'>顶替效率</text><line x1='160' y1='48' x2='182' y2='48' stroke='var(--bad)' stroke-width='1.6' stroke-dasharray='5 3'/><text x='188' y='51' font-size='9' fill='var(--ink-3)'>泵压</text><text x='52' y='44' font-size='9' fill='var(--ink-3)' text-anchor='end'>100%</text><text x='52' y='192' font-size='9' fill='var(--ink-3)' text-anchor='end'>40%</text><text x='160' y='210' font-size='9' fill='var(--ink-3)' text-anchor='middle'>10</text><text x='320' y='210' font-size='9' fill='var(--ink-3)' text-anchor='middle'>20</text><text x='480' y='210' font-size='9' fill='var(--ink-3)' text-anchor='middle'>30</text><text x='640' y='210' font-size='9' fill='var(--ink-3)' text-anchor='middle'>40</text><text x='360' y='228' font-size='9.5' fill='var(--ink-3)' text-anchor='middle'>排量 Q (L/s)</text><text x='60' y='246' font-size='9' fill='var(--ink-3)'>低排量顶替不净易窜槽，高排量泵压与漏失风险上升；推荐区间取折中</text></svg><div class='figcap'><b>图 2</b><span>排量提高可改善顶替效率，但泵压同步上升、漏失风险增加；推荐区间取效率与安全的折中</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">注水泥优化需要的数据比居中度多，但都是常规资料：</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井况基础数据</span><span class=\"cl-s\">井深、套管程序、井径、井斜、地温梯度</span></span><span class=\"cl-n\">设计资料</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">地层压力剖面</span><span class=\"cl-s\">孔隙压力、破裂压力梯度</span></span><span class=\"cl-n\">决定密度窗口</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">水泥浆配方参数</span><span class=\"cl-s\">密度、流变性 n/k、稠化时间</span></span><span class=\"cl-n\">实验数据</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">历史施工记录</span><span class=\"cl-s\">同区块密度、排量、结果</span></span><span class=\"cl-n\">数百井次</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">设备参数</span><span class=\"cl-s\">水泥车额定排量、泵压上限</span></span><span class=\"cl-n\">现场资料</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中</b>。物理模型本身成熟，但问题在于<b>\"好\"的定义不唯一</b>——密度高安全但可能漏失，密度低不容易漏失但可能气窜；排量大顶替好但可能超泵压。多目标优化没有单一最优解，只能给决策层展示帕累托前沿，由工程师现场权衡。</p><p>更难的是<b>压力剖面的可信度</b>——破裂压力梯度通常只有钻前估算值，实际施工时可能偏差 10% 以上。这意味着模型输出必须带上不确定性区间，不能只给一个数。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">代理模型<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">贝叶斯优化<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">多目标进化算法<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">水力计算<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "一口高压气井的注水泥方案优化",
        "lead": [
          "某区块一口高压气井，设计井深 4800 m，储层段压力系数 1.55，邻井曾出现过注水泥漏失。需要设计套管鞋处的水泥浆密度和排量，确保既不漏失又能封住高压气。",
          "传统设计靠工程师手动试算 3—5 个方案，耗时半天。用代理模型优化，20 个样本就能画出有效前沿，5 分钟内找到候选方案。"
        ],
        "stats": [
          [
            "井深",
            "4800 m"
          ],
          [
            "压力系数",
            "1.55"
          ],
          [
            "密度窗口",
            "1.52—1.68 g/cm³"
          ],
          [
            "传统试算方案",
            "5 个"
          ],
          [
            "代理模型样本",
            "20 个"
          ],
          [
            "优化耗时",
            "< 5 min"
          ]
        ],
        "steps": [
          {
            "name": "压力剖面计算",
            "role": "基础",
            "do": "整合孔隙压力梯度（Eaton 法或 Miller 法）和破裂压力梯度（Hall-Niu 公式），沿井深算出两条关键曲线。两者之间就是\"密度窗口\"——水泥浆当量密度必须落在这个窗口内。",
            "effect": "得到沿井深的 [最低密度, 最高密度] 约束区间",
            "trap": "破裂压力通常只有估算值，井底处可能有 ±0.1 g/cm³ 的误差带"
          },
          {
            "name": "水力计算模型",
            "role": "物理",
            "do": "建立一维稳态环空流动模型：给定密度 ρ、排量 Q、环空几何 D，算出沿程摩阻、浆柱当量密度、顶替效率。公式是确定性的，可以批量仿真。",
            "effect": "对任意 (ρ, Q) 参数组合，输出 顶替效率 η、当量密度 ECD、泵压 P",
            "trap": "水平段摩阻计算需要考虑岩屑床，模型要分段"
          },
          {
            "name": "代理模型训练",
            "role": "算法核心",
            "do": "用水力模型批量生成 200—500 个样本点的 (ρ, Q) → (η, ECD, P) 映射。用高斯过程回归或随机森林训练代理模型，拟合物理计算的输入输出关系。",
            "effect": "代理模型可以微秒级预测任意参数组合的结果，替代秒级的物理仿真",
            "trap": "代理模型的外推能力差，超出训练范围的参数不可信"
          },
          {
            "name": "多目标优化",
            "role": "搜索",
            "do": "在代理模型上用 NSGA-II 或贝叶斯优化搜索，目标：最大化顶替效率 η，约束：ECD 落在密度窗口内、泵压 ≤ 设备上限。得到帕累托前沿上的 10—20 个候选方案。",
            "effect": "工程师不需要再试参数，只需从候选方案中挑一个最保守或最激进的",
            "trap": "纯数学最优不一定工程上可实现（比如要求排量精确到小数点后），要加离散化"
          },
          {
            "name": "方案评审与锁定",
            "role": "人",
            "do": "团队评审候选方案：结合邻井经验、设备实际能力、天气等因素，锁定一个方案。同时准备 1—2 个备份方案，防止施工中出现紧急情况。",
            "effect": "方案从\"计算出来\"变成\"能执行\"",
            "trap": "AI 不能替代最终决策，工程师要对所有约束条件负责"
          }
        ],
        "metrics": {
          "title": "怎么算\"方案好\"",
          "html": "<p>注水泥方案不能用单一指标评价。通常的评价维度：</p><table class=\"dtable\"><thead><tr><th>维度</th><th>指标</th><th>合格标准</th><th>本例最优方案</th></tr></thead><tbody><tr><td>密度安全</td><td>ECD 与破裂压力裕度</td><td>≥ 0.03 g/cm³</td><td>0.05</td></tr><tr><td>顶替效率</td><td>η</td><td>≥ 85%</td><td>91%</td></tr><tr><td>泵压</td><td>P</td><td>≤ 额定值 90%</td><td>82%</td></tr><tr><td>施工时间</td><td>T</td><td>≤ 设计时间</td><td>节省 22 min</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "代理模型预测偏差大",
            "why": "训练样本没覆盖的区域，高斯过程回归的不确定性会爆炸。解决：主动学习策略，让贝叶斯优化优先采样\"感兴趣\"的区域。"
          },
          {
            "name": "密度窗口太窄",
            "why": "当破裂压力与孔隙压力差 < 0.05 g/cm³ 时，几乎没有可行解。这种情况下优化器应该返回\"无解\"并建议改变固井程序。"
          },
          {
            "name": "水平段摩阻模型不准",
            "why": "岩屑床会显著增加水平段摩阻，导致实际泵压远超计算值。需要在物理模型里加入岩屑床修正项。"
          }
        ]
      }
    }
  };

  var FILES = [
      {
        "name": "demo/demo.css",
        "data": "/* ========= 注水泥优化示范样式 ========= */\n* { box-sizing: border-box; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #fbfaf6;\n  color: #242b2e;\n  padding: 32px 28px;\n  line-height: 1.65;\n}\n.panel { max-width: 940px; margin: 0 auto; }\nh1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }\nh2 { font-size: 15px; font-weight: 600; margin: 22px 0 8px; color: #235f51; }\n.lead { color: #4d565b; margin-bottom: 14px; }\n.hint { font-size: 12.5px; color: #79828a; margin-bottom: 10px; }\n.section { background: #fff; border: 1px solid #e9e4d8; border-radius: 9px; padding: 18px 22px; margin-bottom: 16px; }\n\n.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }\n.ctl { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: #f5f2ea; border-radius: 7px; }\n.ctl label { font-size: 13px; display: flex; justify-content: space-between; font-weight: 500; }\n.ctl output { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: #2f7d6b; }\n.ctl .tip { font-size: 11.5px; color: #9ba3a9; }\n\n.annulus-wrap { display: flex; gap: 24px; align-items: flex-start; }\n.annulus-wrap svg { background: #fdfcf9; border-radius: 8px; flex-shrink: 0; }\n.ann-info { flex: 1; }\n.ai-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e9e4d8; font-size: 13px; }\n.ai-l { color: #79828a; }\n.ai-row b { font-family: 'JetBrains Mono', Consolas, monospace; font-weight: 600; color: #235f51; }\n.verdict { margin-top: 10px; padding: 8px 12px; border-radius: 6px; font-size: 12.5px; }\n.verdict.ok { background: #e7f3ea; color: #3f8560; }\n.verdict.warn { background: #f9efd7; color: #a97a1c; }\n.verdict.bad { background: #f9e9e5; color: #b05a51; }\n\n.btn-group { display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap; }\n.btn-group button {\n  padding: 7px 14px; border-radius: 6px; border: 1px solid #c9c2b0;\n  background: #fff; cursor: pointer; font-size: 13px; font-weight: 500;\n}\n.btn-group button:hover { border-color: #2f7d6b; color: #2f7d6b; }\n.btn-group button.primary { background: #2f7d6b; border-color: #2f7d6b; color: #fff; }\n.btn-group button.primary:hover { background: #235f51; }\n.pareto-stat { font-size: 12.5px; color: #79828a; margin-left: auto; }\n.pareto-stat b { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; }\n"
      },
      {
        "name": "demo/demo.js",
        "data": "/* ======= 注水泥参数优化 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  // ---------- 状态 ----------\n  let state = {\n    rho: 1.60,    // 水泥浆密度 g/cm³\n    Q: 12,        // 顶替排量 L/s\n    mw: 1.48,     // 钻井液密度 g/cm³\n    hl: 1.15      // 井眼扩大系数\n  };\n\n  // 固定井况\n  const DEPTH_MAX = 4800;\n  const CASING_OD = 244.5;   // mm (9 5/8\")\n  const HOLE_D = 311.1 * state.hl;  // mm (12 1/4\" 扩大后)\n  const ANN_AREA = Math.PI / 4 * (HOLE_D * HOLE_D - CASING_OD * CASING_OD) / 1e6; // m²\n\n  // ---------- 压力剖面生成 ----------\n  function genPressure() {\n    const pts = [];\n    for (let d = 0; d <= DEPTH_MAX; d += 50) {\n      // 孔隙压力梯度随深度增加\n      const ppGrad = 1.03 + d / DEPTH_MAX * 0.52 + Math.sin(d / 600) * 0.02;\n      // 破裂压力梯度（孔隙压力 + 附加应力）\n      const fracGrad = ppGrad + 0.08 + Math.cos(d / 400) * 0.02;\n      pts.push({ d, ppGrad, fracGrad });\n    }\n    return pts;\n  }\n  const PRESSURE = genPressure();\n\n  // ---------- 物理计算 ----------\n  // 当量密度（简化版：静液柱 + 摩阻折算）\n  function calcECD(depth, rho, Q) {\n    const g = 9.81;\n    // 环空返速 m/s\n    const v = Q / 1000 / ANN_AREA;\n    // 摩阻梯度估算（简化）\n    const fricGrad = 0.0015 * Math.pow(v, 1.8) * state.hl / 0.01;\n    return rho + fricGrad;\n  }\n\n  // 顶替效率模型（简化：密度差 + 排量 + 井径）\n  function calcEta(rho, Q, mw, hl) {\n    const drho = rho - mw;\n    const v = Q / 1000 / ANN_AREA;\n    // 基础效率：随密度差和返速增加，但有上限\n    let eta = 75 + drho * 120 + Math.min(v, 1.5) * 25;\n    // 井眼扩大系数降低效率\n    eta -= (hl - 1) * 30;\n    // 范围限制\n    eta = Math.max(40, Math.min(98, eta));\n    return eta;\n  }\n\n  // 密度安全裕度（最深处 ECD 与破裂压力的距离）\n  function calcMargin(rho, Q) {\n    const ecdMax = calcECD(DEPTH_MAX, rho, Q);\n    const fracAtBottom = PRESSURE[PRESSURE.length - 1].fracGrad;\n    const ppAtBottom = PRESSURE[PRESSURE.length - 1].ppGrad;\n    // 裕度 = min(ECD - PP, Frac - ECD) / (Frac - PP) * 100%\n    const window = fracAtBottom - ppAtBottom;\n    if (window < 0.01) return 0;\n    const lowSide = ecdMax - ppAtBottom;\n    const highSide = fracAtBottom - ecdMax;\n    const margin = Math.max(0, Math.min(lowSide, highSide)) / window;\n    return { margin: margin * 100, inWindow: ecdMax >= ppAtBottom && ecdMax <= fracAtBottom, ecdMax };\n  }\n\n  // ---------- 压力剖面渲染 ----------\n  function drawProfile() {\n    const svg = document.getElementById('profile');\n    const W = 720, H = 340, padL = 50, padR = 14, padT = 16, padB = 26;\n    const plotW = W - padL - padR, plotH = H - padT - padB;\n\n    const maxGrad = 2.0, minGrad = 0.8;\n    const dMax = DEPTH_MAX;\n\n    function px(d) { return padL + d / dMax * plotW; }\n    function py(g) { return padT + (1 - (g - minGrad) / (maxGrad - minGrad)) * plotH; }\n\n    // ECD 曲线（沿深度）\n    const ecdVals = [];\n    for (let d = 0; d <= dMax; d += 50) {\n      ecdVals.push({ d, e: calcECD(d, state.rho, state.Q) });\n    }\n\n    // 绘制\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 网格\n    for (let g = 1.0; g <= 2.0; g += 0.2) {\n      const y = py(g);\n      s += `<line x1=\"${padL}\" y1=\"${y}\" x2=\"${padL + plotW}\" y2=\"${y}\" stroke=\"#efece1\"/>`;\n      s += `<text x=\"${padL - 6}\" y=\"${y + 3}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">${g.toFixed(1)}</text>`;\n    }\n    for (let d = 0; d <= dMax; d += 800) {\n      const x = px(d);\n      s += `<line x1=\"${x}\" y1=\"${padT}\" x2=\"${x}\" y2=\"${padT + plotH}\" stroke=\"#efece1\"/>`;\n      s += `<text x=\"${x}\" y=\"${padT + plotH + 14}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">${d}m</text>`;\n    }\n\n    // 安全窗口（破裂压力 - 孔隙压力之间的区域）\n    let winPath = '';\n    // 上边界：破裂压力\n    let topPath = '';\n    for (let i = 0; i < PRESSURE.length; i++) {\n      const x = px(PRESSURE[i].d);\n      const yF = py(PRESSURE[i].fracGrad);\n      topPath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yF.toFixed(1) + ' ';\n    }\n    // 下边界：孔隙压力\n    let botPath = '';\n    for (let i = PRESSURE.length - 1; i >= 0; i--) {\n      const x = px(PRESSURE[i].d);\n      const yP = py(PRESSURE[i].ppGrad);\n      botPath += 'L' + x.toFixed(1) + ' ' + yP.toFixed(1) + ' ';\n    }\n    winPath = topPath + botPath;\n    s += `<path d=\"${winPath}\" fill=\"#e7f3ea\" opacity=\"0.55\"/>`;\n    s += `<path d=\"${topPath}\" fill=\"none\" stroke=\"#b05a51\" stroke-width=\"1.8\" stroke-linejoin=\"round\"/>`;\n\n    // 孔隙压力曲线\n    let ppPath = '';\n    for (let i = 0; i < PRESSURE.length; i++) {\n      const x = px(PRESSURE[i].d);\n      const yP = py(PRESSURE[i].ppGrad);\n      ppPath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yP.toFixed(1) + ' ';\n    }\n    s += `<path d=\"${ppPath}\" fill=\"none\" stroke=\"#41699b\" stroke-width=\"1.8\" stroke-linejoin=\"round\"/>`;\n\n    // ECD 曲线（当前方案）\n    let ecdPath = '';\n    for (let i = 0; i < ecdVals.length; i++) {\n      const x = px(ecdVals[i].d);\n      const yE = py(Math.min(maxGrad, ecdVals[i].e));\n      ecdPath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yE.toFixed(1) + ' ';\n    }\n    // 根据是否安全选择颜色\n    const bottomOK = calcMargin(state.rho, state.Q).inWindow;\n    s += `<path d=\"${ecdPath}\" fill=\"none\" stroke=\"${bottomOK ? '#2f7d6b' : '#b05a51'}\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/>`;\n\n    // 井底点\n    const bottomEcd = ecdVals[ecdVals.length - 1].e;\n    s += `<circle cx=\"${px(DEPTH_MAX)}\" cy=\"${py(Math.min(maxGrad, bottomEcd))}\" r=\"4\" fill=\"${bottomOK ? '#2f7d6b' : '#b05a51'}\"/>`;\n\n    // 图例\n    s += `<text x=\"${padL}\" y=\"${padT - 4}\" font-size=\"10\" fill=\"#9ba3a9\" font-family=\"monospace\">压力梯度 g/cm³ →</text>`;\n    s += `<text x=\"${padL}\" y=\"${padT + 14}\" font-size=\"10\" fill=\"#41699b\">— 孔隙压力</text>`;\n    s += `<text x=\"${padL + 110}\" y=\"${padT + 14}\" font-size=\"10\" fill=\"#b05a51\">— 破裂压力</text>`;\n    s += `<text x=\"${padL + 220}\" y=\"${padT + 14}\" font-size=\"10\" fill=\"${bottomOK ? '#2f7d6b' : '#b05a51'}\">— ECD（当前方案）</text>`;\n    s += `<text x=\"${padL + 380}\" y=\"${padT + 14}\" font-size=\"10\" fill=\"#3f8560\">▮ 安全窗口</text>`;\n\n    svg.innerHTML = s;\n  }\n\n  // ---------- 环空顶替渲染 ----------\n  function drawAnnulus() {\n    const svg = document.getElementById('annulus');\n    const W = 320, H = 220;\n    // 几何：左半套管，中间环空\n    const casLeft = 130, casRight = 190;\n    const annLeft = casRight, annRight = 280;\n    const bottom = 220, top = 0;\n\n    const eta = calcEta(state.rho, state.Q, state.mw, state.hl);\n    const mixH = (100 - eta) / 100 * (bottom - top) * 0.5; // 混合段高度\n\n    // ECD 和裕度\n    const margin = calcMargin(state.rho, state.Q);\n    const v = state.Q / 1000 / ANN_AREA;\n    const drho = state.rho - state.mw;\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 环空背景（钻井液）\n    s += `<rect x=\"${annLeft}\" y=\"${top}\" width=\"${annRight - annLeft}\" height=\"${bottom - top}\" fill=\"#e7eef9\"/>`;\n\n    // 水泥浆（底部上来）\n    const cementTop = mixH;\n    s += `<rect x=\"${annLeft}\" y=\"${cementTop}\" width=\"${annRight - annLeft}\" height=\"${bottom - cementTop}\" fill=\"#e6f1ec\"/>`;\n\n    // 混合带（有颜色过渡）\n    if (mixH > 1) {\n      s += `<rect x=\"${annLeft}\" y=\"${top}\" width=\"${annRight - annLeft}\" height=\"${mixH}\" fill=\"url(#mixGrad)\" opacity=\"0.8\"/>`;\n      // 虚线标注混合带\n      s += `<line x1=\"${annLeft - 4}\" y1=\"${mixH}\" x2=\"${annRight + 4}\" y2=\"${mixH}\" stroke=\"#b26a39\" stroke-width=\"1\" stroke-dasharray=\"3 2\"/>`;\n      s += `<text x=\"${annRight + 6}\" y=\"${mixH + 3}\" font-size=\"8.5\" fill=\"#b26a39\">混合带</text>`;\n    }\n\n    // 水泥浆上升箭头\n    for (let i = 0; i < 3; i++) {\n      const y = cementTop + 30 + i * 50;\n      if (y < bottom - 10) {\n        s += `<path d=\"M${annLeft + 10} ${y} l0 -10 l6 5 z\" fill=\"#2f7d6b\"/>`;\n        s += `<path d=\"M${annLeft + 30} ${y} l0 -10 l6 5 z\" fill=\"#2f7d6b\"/>`;\n      }\n    }\n\n    // 钻井液下降箭头\n    for (let i = 0; i < 3; i++) {\n      const y = 40 + i * 50;\n      if (y > mixH + 10) {\n        s += `<path d=\"M${annRight - 20} ${y} l0 10 l-6 -5 z\" fill=\"#41699b\" opacity=\"0.6\"/>`;\n      }\n    }\n\n    // 套管\n    s += `<rect x=\"${casLeft}\" y=\"${top}\" width=\"${casRight - casLeft}\" height=\"${bottom - top}\" fill=\"#4d565b\" rx=\"2\"/>`;\n    s += `<rect x=\"${casLeft + 10}\" y=\"${top}\" width=\"${casRight - casLeft - 20}\" height=\"${bottom - top}\" fill=\"#242b2e\"/>`;\n    s += `<text x=\"${(casLeft + casRight) / 2}\" y=\"${bottom / 2}\" fill=\"#fdfcf9\" font-size=\"10\" text-anchor=\"middle\" transform=\"rotate(-90 ${(casLeft + casRight) / 2} ${bottom / 2})\">套管</text>`;\n\n    // 窜槽可视化（效率低时显示）\n    if (eta < 75) {\n      s += `<rect x=\"${annLeft + 2}\" y=\"${top + 5}\" width=\"5\" height=\"${bottom - top - 10}\" fill=\"#41699b\" opacity=\"0.55\"/>`;\n      s += `<text x=\"${annLeft + 10}\" y=\"14\" font-size=\"8.5\" fill=\"#b05a51\" font-family=\"monospace\">窜槽！</text>`;\n    }\n\n    // 渐变定义\n    s += `<defs><linearGradient id=\"mixGrad\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">`;\n    s += `<stop offset=\"0\" stop-color=\"#e7eef9\"/><stop offset=\"1\" stop-color=\"#e6f1ec\"/>`;\n    s += `</linearGradient></defs>`;\n\n    // 标签\n    s += `<text x=\"${annLeft}\" y=\"${top - 4}\" font-size=\"8.5\" fill=\"#2f7d6b\">水泥浆↑</text>`;\n    s += `<text x=\"${annRight - 30}\" y=\"${top - 4}\" font-size=\"8.5\" fill=\"#41699b\">钻井液↓</text>`;\n    s += `<text x=\"${annLeft + 10}\" y=\"${bottom + 14}\" font-size=\"9\" fill=\"#9ba3a9\">环空 (${HOLE_D.toFixed(0)}mm / ${CASING_OD}mm)</text>`;\n\n    svg.innerHTML = s;\n\n    // 更新信息\n    $('ai-eta').textContent = eta.toFixed(1) + '%';\n    $('ai-ecd').textContent = margin.ecdMax.toFixed(2) + ' g/cm³';\n    $('ai-drho').textContent = drho.toFixed(2) + ' g/cm³';\n    $('ai-v').textContent = v.toFixed(2) + ' m/s';\n    const pct = calcMargin(state.rho, state.Q);\n    $('ai-margin').textContent = pct.inWindow ? (pct.margin).toFixed(0) + '%' : '出界!';\n\n    // verdict\n    const vEl = $('verdict');\n    if (!pct.inWindow) {\n      vEl.className = 'verdict bad';\n      if (pct.ecdMax > PRESSURE[PRESSURE.length - 1].fracGrad) {\n        vEl.textContent = '❌ ECD 超过破裂压力！底部可能漏失，必须降低密度或排量。';\n      } else {\n        vEl.textContent = '❌ ECD 低于孔隙压力！底部可能气窜，必须提高密度。';\n      }\n    } else if (eta < 80) {\n      vEl.className = 'verdict warn';\n      vEl.textContent = '⚠️ 安全但顶替效率偏低（' + eta.toFixed(0) + '%）。考虑增大排量或提高密度差。';\n    } else {\n      vEl.className = 'verdict ok';\n      vEl.textContent = '✅ 方案可行！ECD 在安全窗口内，顶替效率 ' + eta.toFixed(0) + '%，安全裕度 ' + pct.margin.toFixed(0) + '%。';\n    }\n  }\n\n  // ---------- 帕累托前沿图 ----------\n  let samples = [];\n\n  function genSamples() {\n    samples = [];\n    for (let i = 0; i < 250; i++) {\n      const rho = 1.45 + Math.random() * 0.40;\n      const Q = 4 + Math.random() * 24;\n      const eta = calcEta(rho, Q, state.mw, state.hl);\n      const margin = calcMargin(rho, Q);\n      samples.push({ rho, Q, eta, marginPct: margin.inWindow ? margin.margin : -1, feasible: margin.inWindow });\n    }\n    // 按 eta 降序 + margin 降序，找非支配解\n    samples.sort((a, b) => (b.feasible - a.feasible) || (b.eta - a.eta) || (b.marginPct - a.marginPct));\n  }\n\n  function findParetoFront() {\n    const feasible = samples.filter(s => s.feasible);\n    const front = [];\n    for (const p of feasible) {\n      let dominated = false;\n      for (const q of feasible) {\n        if (q === p) continue;\n        // q 支配 p：eta ≥ p.eta 且 margin ≥ p.marginPct，至少一个严格大于\n        if (q.eta >= p.eta && q.marginPct >= p.marginPct && (q.eta > p.eta || q.marginPct > p.marginPct)) {\n          dominated = true; break;\n        }\n      }\n      if (!dominated) front.push(p);\n    }\n    return front.sort((a, b) => b.eta - a.eta);\n  }\n\n  function drawPareto() {\n    const svg = document.getElementById('pareto');\n    const W = 560, H = 320, padL = 50, padR = 18, padT = 20, padB = 36;\n    const plotW = W - padL - padR, plotH = H - padT - padB;\n\n    const etaMin = 40, etaMax = 100;\n    const marMin = 0, marMax = 100;\n\n    function xOf(v) { return padL + (v - etaMin) / (etaMax - etaMin) * plotW; }\n    function yOf(v) { return padT + (1 - (v - marMin) / (marMax - marMin)) * plotH; }\n\n    const pareto = findParetoFront();\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 网格\n    for (let g = 50; g <= 100; g += 10) {\n      const x = xOf(g);\n      s += `<line x1=\"${x}\" y1=\"${padT}\" x2=\"${x}\" y2=\"${padT + plotH}\" stroke=\"#efece1\"/>`;\n      s += `<text x=\"${x}\" y=\"${padT + plotH + 14}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">${g}%</text>`;\n    }\n    for (let g = 0; g <= 100; g += 20) {\n      const y = yOf(g);\n      s += `<line x1=\"${padL}\" y1=\"${y}\" x2=\"${padL + plotW}\" y2=\"${y}\" stroke=\"#efece1\"/>`;\n      s += `<text x=\"${padL - 6}\" y=\"${y + 3}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">${g}%</text>`;\n    }\n\n    // 不可行点（灰色）\n    samples.filter(s => !s.feasible).forEach(p => {\n      s += `<circle cx=\"${xOf(p.eta)}\" cy=\"${yOf(0)}\" r=\"2\" fill=\"#d8d2c4\" opacity=\"0.5\"/>`;\n    });\n\n    // 可行点（浅绿）\n    samples.filter(s => s.feasible).forEach(p => {\n      s += `<circle cx=\"${xOf(p.eta)}\" cy=\"${yOf(p.marginPct)}\" r=\"2.5\" fill=\"#2f7d6b\" opacity=\"0.3\"/>`;\n    });\n\n    // 帕累托前沿连线\n    let frontPath = '';\n    pareto.forEach((p, i) => {\n      frontPath += (i ? 'L' : 'M') + xOf(p.eta).toFixed(1) + ' ' + yOf(p.marginPct).toFixed(1) + ' ';\n    });\n    if (pareto.length > 1) {\n      s += `<path d=\"${frontPath}\" fill=\"none\" stroke=\"#b26a39\" stroke-width=\"2\" stroke-dasharray=\"4 3\"/>`;\n    }\n\n    // 帕累托前沿点\n    pareto.forEach(p => {\n      s += `<circle cx=\"${xOf(p.eta)}\" cy=\"${yOf(p.marginPct)}\" r=\"4\" fill=\"#b26a39\" stroke=\"#fff\" stroke-width=\"1.2\"/>`;\n    });\n\n    // 当前方案点\n    const curMargin = calcMargin(state.rho, state.Q);\n    const curEta = calcEta(state.rho, state.Q, state.mw, state.hl);\n    const curY = curMargin.inWindow ? curMargin.margin : -1;\n    const curClr = curMargin.inWindow ? '#2f7d6b' : '#b05a51';\n    s += `<circle cx=\"${xOf(curEta)}\" cy=\"${curY >= 0 ? yOf(curY) : yOf(0)}\" r=\"6\" fill=\"${curClr}\" stroke=\"#fff\" stroke-width=\"2\"/>`;\n    s += `<text x=\"${xOf(curEta) + 10}\" y=\"${curY >= 0 ? yOf(curY) - 8 : yOf(0) - 8}\" font-size=\"9\" fill=\"${curClr}\" font-weight=\"600\">当前</text>`;\n\n    // 坐标轴标签\n    s += `<text x=\"${padL + plotW / 2}\" y=\"${padT + plotH + 32}\" font-size=\"10\" fill=\"#5d666d\" text-anchor=\"middle\">顶替效率 η</text>`;\n    s += `<text x=\"14\" y=\"${padT + plotH / 2}\" font-size=\"10\" fill=\"#5d666d\" text-anchor=\"middle\" transform=\"rotate(-90 14 ${padT + plotH / 2})\">安全裕度</text>`;\n\n    svg.innerHTML = s;\n\n    // 更新统计\n    document.getElementById('pnow').textContent = curEta.toFixed(0) + '% / ' + (curY >= 0 ? curY.toFixed(0) + '%' : '不可行');\n    document.getElementById('pcount').textContent = pareto.length;\n  }\n\n  // ---------- 事件 ----------\n  function bind() {\n    const inputs = [\n      ['s-rho', 'rho', 'o-rho', v => v.toFixed(2)],\n      ['s-Q', 'Q', 'o-Q', v => v.toFixed(0)],\n      ['s-mw', 'mw', 'o-mw', v => v.toFixed(2)],\n      ['s-hl', 'hl', 'o-hl', v => v.toFixed(2)]\n    ];\n\n    inputs.forEach(([id, key, outId, fmt]) => {\n      const el = document.getElementById(id);\n      const out = document.getElementById(outId);\n      el.value = state[key];\n      out.textContent = fmt(state[key]);\n      el.addEventListener('input', () => {\n        state[key] = parseFloat(el.value);\n        out.textContent = fmt(state[key]);\n        // 更新环空面积（因为 hl 改变）\n        if (key === 'hl') {\n          HOLE_D_VAL = 311.1 * state.hl;\n          ANN_AREA_VAL = Math.PI / 4 * (HOLE_D_VAL * HOLE_D_VAL - CASING_OD * CASING_OD) / 1e6;\n        }\n        drawProfile();\n        drawAnnulus();\n        drawPareto();\n      });\n    });\n\n    document.getElementById('btn-simulate').addEventListener('click', () => {\n      genSamples();\n      drawPareto();\n    });\n\n    document.getElementById('btn-optimize').addEventListener('click', () => {\n      // 快速优化：从当前方案出发，贪心搜索帕累托前沿上最近的点\n      genSamples();\n      const pareto = findParetoFront();\n      // 选 eta 最高的点（或最安全的点）\n      pareto.sort((a, b) => b.eta - a.eta);\n      const best = pareto[0];\n      state.rho = best.rho;\n      state.Q = best.Q;\n      document.getElementById('s-rho').value = state.rho;\n      document.getElementById('s-Q').value = state.Q;\n      document.getElementById('o-rho').textContent = state.rho.toFixed(2);\n      document.getElementById('o-Q').textContent = state.Q.toFixed(0);\n      drawProfile();\n      drawAnnulus();\n      drawPareto();\n    });\n  }\n\n  // 可变变量\n  let HOLE_D_VAL = HOLE_D;\n  let ANN_AREA_VAL = ANN_AREA;\n\n  // ---------- 初始化 ----------\n  bind();\n  genSamples();\n  drawProfile();\n  drawAnnulus();\n  drawPareto();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：注水泥参数智能优化</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>注水泥参数 · 交互式优化演示</h1>\n  <p class=\"lead\">拖动水泥浆<b>密度 ρ</b> 和 <b>排量 Q</b>，看当量密度 ECD 怎么在压力窗口里滑动、顶替效率怎么变化。右下的散点图里绿色点都是可行方案，<b>帕累托前沿上的点</b>是\"最划算\"的候选。</p>\n\n  <!-- 井深压力剖面 -->\n  <div class=\"section\">\n    <h2>① 压力剖面：密度窗口在哪里</h2>\n    <p class=\"hint\">蓝色区域是安全窗口——水泥浆当量密度（ECD）必须落在孔隙压力和破裂压力之间，否则就会气窜或漏失。拖下方的密度滑杆看 ECD 线怎么移动。</p>\n    <svg id=\"profile\" viewBox=\"0 0 720 340\" role=\"img\" aria-label=\"压力剖面\"></svg>\n  </div>\n\n  <!-- 环空顶替可视化 -->\n  <div class=\"section\">\n    <h2>② 环空顶替：谁把谁挤走了</h2>\n    <p class=\"hint\">左侧是套管（内管），中间是环空（水泥浆↑ 顶钻井液↓）。排量太低或密度差太小，会出现<b>窜槽</b>——钻井液没被顶干净，留下通道。</p>\n    <div class=\"annulus-wrap\">\n      <svg id=\"annulus\" viewBox=\"0 0 320 220\" role=\"img\" aria-label=\"环空顶替\"></svg>\n      <div class=\"ann-info\">\n        <div class=\"ai-row\"><span class=\"ai-l\">顶替效率 η</span><b id=\"ai-eta\">—</b></div>\n        <div class=\"ai-row\"><span class=\"ai-l\">当量密度 ECD</span><b id=\"ai-ecd\">—</b></div>\n        <div class=\"ai-row\"><span class=\"ai-l\">密度差 Δρ</span><b id=\"ai-drho\">—</b></div>\n        <div class=\"ai-row\"><span class=\"ai-l\">环空返速</span><b id=\"ai-v\">—</b></div>\n        <div class=\"ai-row\"><span class=\"ai-l\">压力窗口裕度</span><b id=\"ai-margin\">—</b></div>\n        <div class=\"verdict\" id=\"verdict\"></div>\n      </div>\n    </div>\n  </div>\n\n  <!-- 控制参数 -->\n  <div class=\"section\">\n    <h2>③ 参数控制</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>水泥浆密度 ρ (g/cm³)<output id=\"o-rho\">1.60</output></label>\n        <input type=\"range\" id=\"s-rho\" min=\"1.40\" max=\"1.85\" step=\"0.01\" value=\"1.60\">\n        <span class=\"tip\">通常 1.50—1.85，比钻井液大 0.05—0.15</span>\n      </div>\n      <div class=\"ctl\">\n        <label>顶替排量 Q (L/s)<output id=\"o-Q\">12</output></label>\n        <input type=\"range\" id=\"s-Q\" min=\"4\" max=\"28\" step=\"0.5\" value=\"12\">\n        <span class=\"tip\">受泵车额定排量限制，一般 ≤ 25 L/s</span>\n      </div>\n      <div class=\"ctl\">\n        <label>钻井液密度 (g/cm³)<output id=\"o-mw\">1.48</output></label>\n        <input type=\"range\" id=\"s-mw\" min=\"1.20\" max=\"1.70\" step=\"0.01\" value=\"1.48\">\n        <span class=\"tip\">钻井液密度影响密度差 Δρ</span>\n      </div>\n      <div class=\"ctl\">\n        <label>井眼扩大系数<output id=\"o-hl\">1.15</output></label>\n        <input type=\"range\" id=\"s-hl\" min=\"1.00\" max=\"1.30\" step=\"0.01\" value=\"1.15\">\n        <span class=\"tip\">实际井径 / 设计井径，影响环空截面积</span>\n      </div>\n    </div>\n  </div>\n\n  <!-- 参数空间可视化 -->\n  <div class=\"section\">\n    <h2>④ 所有可行方案一览 + 帕累托前沿</h2>\n    <p class=\"hint\">x 轴：顶替效率（越高越好）。y 轴：密度安全裕度（越高越安全）。<b>右上角的点</b>在两个维度上都最优——就是帕累托前沿。</p>\n    <svg id=\"pareto\" viewBox=\"0 0 560 320\" role=\"img\" aria-label=\"帕累托前沿\"></svg>\n    <div class=\"btn-group\">\n      <button id=\"btn-simulate\">🔄 重新生成样本</button>\n      <button id=\"btn-optimize\" class=\"primary\">⚡ 快速优化（50 次迭代）</button>\n      <span class=\"pareto-stat\">当前方案：<b id=\"pnow\">—</b> · 前沿点数：<b id=\"pcount\">—</b></span>\n    </div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动密度和排量，看当量密度怎么在压力窗口里滑动、顶替效率怎么变化。帕累托前沿上的点是\"在安全前提下最有效率\"的候选方案。",
    mode: 'page',
    height: 760,
    mount: function (root, ctx) {
      if (!global.CaseDemoHost) return;
      demoHandle = global.CaseDemoHost.create(root, {
        files: FILES,
        demo: { mode: 'page', html: 'demo/index.html', js: 'demo/demo.js', height: 760 },
        meta: { title: DATA.title }
      }, ctx);
    },
    unmount: function () {
      if (demoHandle) { try { demoHandle.destroy(); } catch (e) { } demoHandle = null; }
    }
  };

  global.Cases.register(DATA);
})(window);
