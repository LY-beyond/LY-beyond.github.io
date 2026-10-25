/* =========================================================
   案例插件（静态注册版）：水泥候凝强度预测：水化动力学与时序回归
   ---------------------------------------------------------
   由 cases/c6-strength-predict/case.json 与 demo/ 目录生成。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
  "id": "c6-strength-predict",
  "sceneId": "c6",
  "methods": [
    "ts"
  ],
  "title": "水泥候凝强度预测：水化动力学与时序回归",
  "version": "1.0.0",
  "updated": "2026-10-25",
  "tabs": {
    "background": {
      "label": "专业背景",
      "lede": "固井注完水泥浆后，不能立刻进行试压、钻塞等作业——水泥需要时间水化凝固，达到足够的抗压强度。候凝时间凭经验常取 24—48 小时，但井底温度、水泥浆配方、外加剂都会显著改变强度发展速度。等太久浪费工期，太早试压又会破坏尚未凝固的水泥环。",
      "judge": [
        {
          "label": "任务类型",
          "value": "时序回归",
          "desc": "预测强度随时间的发展曲线"
        },
        {
          "label": "标注成本",
          "value": "低",
          "desc": "室内强度试验数据可批量获得"
        },
        {
          "label": "可见收益",
          "value": "中",
          "desc": "缩短候凝时间 = 加快钻井周期"
        },
        {
          "label": "难度",
          "value": "中",
          "desc": "多因素耦合，需分水泥体系建模"
        }
      ],
      "sections": [
        {
          "no": 1,
          "en": "PROBLEM",
          "title": "当前做法与问题",
          "html": "<p>固井后候凝时间通常按经验取<b>24—48 小时</b>，到点就试压或钻塞。但水泥强度发展速度受三个因素主导：<b>井底温度</b>（温度每升 10℃，水化速率约翻倍）、<b>水灰比</b>（水越多后期强度越低）、<b>外加剂</b>（缓凝剂延缓、促凝剂加速）。</p><p>问题有三：<b>高温井候凝过剩</b>——井底 80℃ 的井，水泥 8 小时就达标，却仍等 24 小时，浪费工期；<b>低温井候凝不足</b>——井底 30℃ 的深井段，24 小时强度可能还不到 5 MPa，提前试压导致水泥环开裂；<b>配方变化无感知</b>——同一区块换了水泥厂家或外加剂批次，强度曲线完全不同，但候凝时间没变。</p><div class='figure'><svg viewBox='0 0 720 280' width='100%' role='img' aria-label='温度与水灰比对水泥强度发展曲线的影响'><rect x='0' y='0' width='720' height='280' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 温度与水灰比对强度发展的影响</text><line x1='70' y1='230' x2='690' y2='230' stroke='var(--ink-3)'/><line x1='70' y1='40' x2='70' y2='230' stroke='var(--ink-3)'/><text x='70' y='250' font-size='9' fill='var(--ink-3)' text-anchor='middle'>0</text><text x='380' y='250' font-size='9' fill='var(--ink-3)' text-anchor='middle'>候凝时间 (h)</text><text x='690' y='250' font-size='9' fill='var(--ink-3)' text-anchor='end'>48</text><text x='58' y='230' font-size='9' fill='var(--ink-3)' text-anchor='end'>0</text><text x='58' y='135' font-size='9' fill='var(--ink-3)' text-anchor='end'>强度</text><text x='58' y='45' font-size='9' fill='var(--ink-3)' text-anchor='end'>高</text><line x1='70' y1='150' x2='690' y2='150' stroke='#a97a1c' stroke-width='1' stroke-dasharray='4 3'/><text x='695' y='153' font-size='9' fill='#a97a1c'>试压阈值 14 MPa</text><path d='M70 228 C 200 225, 320 200, 420 150 S 620 70, 690 60' fill='none' stroke='#2f7d6b' stroke-width='2'/><text x='640' y='56' font-size='9' fill='#2f7d6b'>80℃</text><path d='M70 229 C 200 228, 360 215, 500 175 S 660 130, 690 120' fill='none' stroke='#41699b' stroke-width='2'/><text x='640' y='116' font-size='9' fill='#41699b'>50℃</text><path d='M70 229 C 260 228, 480 222, 620 195 S 690 175, 690 172' fill='none' stroke='#b26a39' stroke-width='2'/><text x='640' y='168' font-size='9' fill='#b26a39'>30℃</text><path d='M70 228 C 180 226, 300 210, 400 175 S 580 110, 690 95' fill='none' stroke='#7a5296' stroke-width='2' stroke-dasharray='6 3'/><text x='600' y='88' font-size='9' fill='#7a5296'>80℃ + 缓凝剂</text><line x1='420' y1='150' x2='420' y2='230' stroke='#2f7d6b' stroke-width='1' opacity='0.4'/><text x='420' y='240' font-size='8.5' fill='#2f7d6b' text-anchor='middle'>8h 达标</text><line x1='690' y1='172' x2='690' y2='230' stroke='#b26a39' stroke-width='1' opacity='0.4'/><text x='672' y='240' font-size='8.5' fill='#b26a39' text-anchor='end'>30℃ 48h 未达标</text><text x='18' y='270' font-size='9' fill='var(--ink-3)'>温度越高水化越快；缓凝剂整体推迟曲线；30℃ 深井段 48h 可能仍未达试压强度</text></svg><div class='figcap'><b>图 1</b><span>不同井底温度与外加剂下的水泥抗压强度-时间曲线：高温井 8h 即可试压，低温深井 48h 仍可能不达标</span></div></div>"
        },
        {
          "no": 2,
          "en": "INTERVENTION",
          "title": "AI 能做什么",
          "html": "<p>核心是<b>预测强度发展曲线</b>：给定水泥浆配方（水灰比、水泥级别、外加剂掺量）和井底温度剖面，输出候凝期间每个时间点的抗压强度。模型不用纯黑箱，而是<b>水化动力学 + 数据驱动校准</b>的混合路线。</p><p>物理骨架用<b>Arrhenius 水化动力学</b>：水化反应速率随温度按 Arrhenius 方程加速，强度发展是水化程度的函数。数据驱动部分用<b>时序回归模型</b>（如 LSTM 或高斯过程回归）学习配方参数对强度曲线的修正——因为不同水泥体系的水化产物不同，纯物理公式覆盖不了。</p><p>输出不只是一条曲线，还要给出<b>关键时间点</b>：达到试压强度（通常 14 MPa）的时间、达到钻塞强度（通常 21 MPa）的时间、以及 95% 置信区间。工程师据此决定候凝时间，而不是一刀切等 24 小时。</p><div class='figure'><svg viewBox='0 0 720 250' width='100%' role='img' aria-label='配方温度输入模型输出强度曲线与关键时间点'><rect x='0' y='0' width='720' height='250' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>B · 配方 + 温度 → 强度曲线 → 候凝决策</text><rect x='20' y='44' width='130' height='30' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='85' y='63' font-size='9' fill='var(--ink-2)' text-anchor='middle'>水灰比 w/c</text><rect x='20' y='82' width='130' height='30' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='85' y='101' font-size='9' fill='var(--ink-2)' text-anchor='middle'>水泥级别 + 外加剂</text><rect x='20' y='120' width='130' height='30' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='85' y='139' font-size='9' fill='var(--ink-2)' text-anchor='middle'>井底温度 T(z)</text><path d='M158 100 L210 100' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M210 96.5 L216 100 L210 103.5 Z' fill='var(--ink-3)'/><rect x='220' y='60' width='120' height='80' rx='5' fill='var(--paper-2)' stroke='var(--line)'/><text x='280' y='82' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>Arrhenius 骨架</text><text x='280' y='100' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>水化速率 ∝ exp(-Ea/RT)</text><text x='280' y='116' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>强度 = f(水化程度)</text><text x='280' y='132' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>+ LSTM 校准配方修正</text><path d='M348 100 L400 100' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M400 96.5 L406 100 L400 103.5 Z' fill='var(--ink-3)'/><line x1='410' y1='44' x2='410' y2='215' stroke='var(--line)'/><line x1='690' y1='44' x2='690' y2='215' stroke='var(--line)'/><line x1='410' y1='215' x2='690' y2='215' stroke='var(--line)'/><line x1='410' y1='44' x2='690' y2='44' stroke='var(--line)'/><line x1='410' y1='150' x2='690' y2='150' stroke='#a97a1c' stroke-width='1' stroke-dasharray='4 3'/><text x='695' y='153' font-size='8.5' fill='#a97a1c'>14 MPa</text><path d='M420 210 C 480 205, 540 180, 580 140 S 660 90, 685 80' fill='none' stroke='#2f7d6b' stroke-width='2'/><path d='M420 212 C 470 208, 520 195, 560 165 S 640 120, 685 110' fill='none' stroke='#2f7d6b' stroke-width='1' stroke-dasharray='3 3' opacity='0.5'/><path d='M420 208 C 490 202, 560 168, 600 125 S 670 70, 685 55' fill='none' stroke='#2f7d6b' stroke-width='1' stroke-dasharray='3 3' opacity='0.5'/><line x1='566' y1='150' x2='566' y2='215' stroke='#2f7d6b' stroke-width='1'/><text x='566' y='228' font-size='8.5' fill='#2f7d6b' text-anchor='middle'>t试压 ≈ 11h</text><text x='430' y='60' font-size='8.5' fill='var(--ink-3)'>抗压强度 (MPa)</text><text x='550' y='228' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>候凝时间 (h)</text><text x='420' y='238' font-size='8' fill='var(--ink-3)'>0</text><text x='685' y='238' font-size='8' fill='var(--ink-3)' text-anchor='end'>48</text><text x='18' y='240' font-size='9' fill='var(--ink-3)'>阴影为 95% 置信区间；输出 t试压 与 t钻塞 两个关键时间点</text></svg><div class='figcap'><b>图 2</b><span>Arrhenius 水化动力学做骨架，LSTM 校准配方差异，输出带置信区间的强度曲线与关键时间点</span></div></div>"
        },
        {
          "no": 3,
          "en": "DATA",
          "title": "你需要准备什么",
          "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。数据主要来自室内试验和施工记录。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">水泥浆配方</span><span class=\"cl-s\">水灰比、水泥级别、外加剂掺量</span></span><span class=\"cl-n\">每口井的设计配方</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井底温度剖面</span><span class=\"cl-s\">随井深的温度分布</span></span><span class=\"cl-n\">来自测井或地温梯度</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">候凝强度试验数据</span><span class=\"cl-s\">不同时间的抗压强度</span></span><span class=\"cl-n\">室内养护试验，作为标签</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">现场候凝记录（可选）</span><span class=\"cl-s\">实际试压时间与结果</span></span><span class=\"cl-n\">用于验证模型预测</span></div></div>"
        },
        {
          "no": 4,
          "en": "DIFFICULTY",
          "title": "技术难度与参考方向",
          "html": "<p>难度 <b>中</b>——水化动力学有成熟的物理模型（Arrhenius），强度试验数据也容易批量获取。难点在于<b>配方空间巨大</b>：不同水泥级别、外加剂种类和掺量的组合成千上万，不可能每种都做试验。所以模型必须有<b>外推能力</b>——在已试验配方上训练，能预测未试验配方的强度曲线。高斯过程回归在这方面比 LSTM 更合适，因为它自带不确定性估计。</p><p>另一个挑战是<b>井底温度随井深变化</b>，同一柱水泥浆的上下段温度不同，强度发展速度也不同，需要分段预测后综合判断。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">时序回归<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">Arrhenius 动力学<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">高斯过程回归<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">代理模型<span class=\"ar\">↗</span></a></div>"
        }
      ]
    },
    "workflow": {
      "label": "案例流程",
      "title": "一口高温井的候凝时间优化",
      "lead": [
        "某区块一口井井底温度 85℃，按经验候凝 24 小时。实际上水泥在 85℃ 下水化很快，约 5 小时就达到试压强度。优化后候凝时间从 24h 缩短到 6h，单井节省工期 18 小时。",
        "下面的流程把\"凭经验等 24 小时\"变成\"配方+温度驱动的强度预测\"——物理模型保证趋势正确，数据校准修正配方差异。"
      ],
      "stats": [
        [
          "井底温度",
          "85℃"
        ],
        [
          "水灰比",
          "0.44"
        ],
        [
          "缓凝剂掺量",
          "0.3%"
        ],
        [
          "经验候凝",
          "24 h"
        ],
        [
          "预测达标时间",
          "5.2 h"
        ],
        [
          "实际候凝",
          "6 h"
        ],
        [
          "节省工期",
          "18 h / 井"
        ]
      ],
      "steps": [
        {
          "name": "配方与温度输入",
          "role": "数据",
          "do": "读取本井水泥浆配方（水灰比 0.44、G 级水泥、缓凝剂 0.3%）和井底温度剖面（井口 25℃ 到井底 85℃）。按井深把水泥柱分成 5 段，每段取平均温度。",
          "effect": "得到 5 个温度段的配方-温度组合",
          "trap": "温度剖面不能只取井底最高值，上部低温段强度发展慢，可能是瓶颈"
        },
        {
          "name": "Arrhenius 骨架预测",
          "role": "物理模型",
          "do": "用 Arrhenius 方程计算每个温度段的水化速率常数 k(T) = A·exp(-Ea/RT)，再用水化程度→强度的映射得到各段的强度-时间曲线。取 5 段中最慢的作为瓶颈段。",
          "effect": "得到强度发展趋势曲线，但未考虑配方细节",
          "trap": "活化能 Ea 对不同水泥体系不同，需要用试验数据校准"
        },
        {
          "name": "LSTM 配方校准",
          "role": "数据驱动",
          "do": "把配方参数（水灰比、外加剂掺量）作为输入，用训练好的 LSTM 输出对物理曲线的修正量。训练数据来自 200 组室内强度试验。",
          "effect": "修正后的曲线与同配方试验数据误差 < 1.5 MPa",
          "trap": "外推到未见过的配方组合时，置信区间会变宽，需要人工复核"
        },
        {
          "name": "关键时间点输出",
          "role": "决策",
          "do": "在修正后的曲线上找到达到 14 MPa（试压）和 21 MPa（钻塞）的时间点，输出 95% 置信区间。取上限作为保守候凝时间。",
          "effect": "本井预测 t试压 = 9.5h，取 10h 作为候凝时间",
          "trap": "必须取置信区间上限，不能取预测值本身——提前试压的代价远大于多等几小时"
        },
        {
          "name": "现场验证与反馈",
          "role": "质控",
          "do": "候凝 10h 后试压，记录试压结果和实际强度。把数据回填到训练集，持续校准模型。",
          "effect": "模型随使用越来越准，同区块后续井可进一步缩短候凝",
          "trap": "试压失败的数据尤其重要，能显著提升模型对边界情况的判断"
        }
      ],
      "metrics": {
        "title": "怎么算\"预测准不准\"",
        "html": "<p>强度预测的精度用<b>均方根误差（RMSE）</b>衡量，但更重要的是<b>达标时间的预测误差</b>——工程师真正用的是时间点，不是强度值本身。达标时间误差应控制在 ±2 小时以内。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>目标值</th></tr></thead><tbody><tr><td>强度 RMSE</td><td>预测强度与试验值的均方根误差</td><td>≤ 1.5 MPa</td></tr><tr><td>达标时间误差</td><td>预测 t试压 与实际的差</td><td>≤ ±2 h</td></tr><tr><td>置信区间覆盖率</td><td>真值落在 95% 区间内的比例</td><td>≥ 90%</td></tr><tr><td>工期节省</td><td>经验候凝 − 预测候凝</td><td>≥ 8 h / 井</td></tr></tbody></table>"
      },
      "fails": [
        {
          "name": "低温段成为瓶颈",
          "why": "只看井底高温段预测 8h 达标，但上部 30℃ 段 24h 才达标。必须分段预测取最慢段。"
        },
        {
          "name": "外加剂批次变化",
          "why": "同掺量不同批次的缓凝剂效果可差 10%—15%，需要每批次做小样试验校准。"
        },
        {
          "name": "外推配方置信区间过宽",
          "why": "模型未见过的配方组合，预测不确定性大，此时应回归经验值或补做试验。"
        }
      ]
    },
    "demo": {
      "mode": "auto",
      "html": "demo/index.html",
      "js": "demo/demo.js",
      "label": "可运行示范",
      "intro": "调节井底温度、水灰比、缓凝剂掺量，实时看水泥强度发展曲线怎么变，以及什么时候达到试压强度。",
      "height": 720
    }
  }
};

  var FILES = [
      { "name": "demo/demo.css", "data": "/* ========= 水泥候凝强度预测示范样式 ========= */\n* { box-sizing: border-box; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #fbfaf6;\n  color: #242b2e;\n  padding: 32px 28px;\n  line-height: 1.65;\n}\n.panel { max-width: 920px; margin: 0 auto; }\nh1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }\nh2 { font-size: 15px; font-weight: 600; margin: 24px 0 8px; color: #235f51; }\n.lead { color: #4d565b; margin-bottom: 16px; }\n.hint { font-size: 12.5px; color: #79828a; margin-bottom: 12px; }\n.section { background: #fff; border: 1px solid #e9e4d8; border-radius: 9px; padding: 20px 22px; margin-bottom: 18px; }\n\n.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }\n.ctl { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: #f5f2ea; border-radius: 7px; }\n.ctl label { font-size: 13px; display: flex; justify-content: space-between; font-weight: 500; }\n.ctl output { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: #2f7d6b; }\n.ctl .tip { font-size: 11.5px; color: #9ba3a9; }\n\n.chart-wrap { background: #fdfcf9; border-radius: 8px; padding: 8px; }\n.chart-wrap svg { width: 100%; }\n\n.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }\n.info-card { background: #f5f2ea; border-radius: 7px; padding: 12px 14px; }\n.info-card .k { font-size: 11px; color: #79828a; letter-spacing: .1em; text-transform: uppercase; }\n.info-card .v { font-size: 22px; font-weight: 700; color: #235f51; font-family: 'JetBrains Mono', Consolas, monospace; margin-top: 2px; }\n.info-card .v.warn { color: #a97a1c; }\n.info-card .v.bad { color: #b05a51; }\n.info-card .sub { font-size: 11.5px; color: #9ba3a9; margin-top: 2px; }\n\n.verdict { margin-top: 12px; padding: 10px 14px; border-radius: 6px; font-size: 13px; }\n.verdict.ok { background: #e7f3ea; color: #3f8560; }\n.verdict.warn { background: #f9efd7; color: #a97a1c; }\n.verdict.bad { background: #f9e9e5; color: #b05a51; }\n\n.legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; font-size: 11.5px; color: #5d666d; }\n.legend i { display: inline-block; width: 14px; height: 3px; vertical-align: middle; margin-right: 5px; border-radius: 1px; }\n" },
      { "name": "demo/demo.js", "data": "/* ======= 水泥候凝强度预测 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  let state = {\n    temp: 85,      // 井底温度 ℃\n    wc: 0.44,      // 水灰比\n    ret: 0.3,      // 缓凝剂 %\n    acc: 0         // 促凝剂 %\n  };\n\n  const T_TEST = 14;   // 试压强度 MPa\n  const T_DRILL = 21;  // 钻塞强度 MPa\n  const T_MAX = 48;    // 最大展示时间 h\n\n  function $(id) { return document.getElementById(id); }\n\n  // 水化速率常数（简化 Arrhenius：温度每升 10℃ 翻倍）\n  function rateConstant() {\n    const Tref = 50;\n    const kRef = 0.008; // 50℃ 时的基准速率（标定为 85℃ 约 5h 达试压强度）\n    let k = kRef * Math.pow(2, (state.temp - Tref) / 10);\n    // 缓凝剂：指数衰减\n    k *= Math.exp(-1.3 * state.ret);\n    // 促凝剂：线性加速\n    k *= (1 + 0.45 * state.acc);\n    return k;\n  }\n\n  // 极限强度（水灰比越低越高）\n  function maxStrength() {\n    // 经验：w/c 0.35 → ~62 MPa, w/c 0.60 → ~32 MPa\n    return Math.max(25, 62 - 120 * (state.wc - 0.35));\n  }\n\n  // t 时刻的强度\n  function strengthAt(t) {\n    const k = rateConstant();\n    const Smax = maxStrength();\n    return Smax * (1 - Math.exp(-k * t));\n  }\n\n  // 达到目标强度的时间\n  function timeToReach(target) {\n    const k = rateConstant();\n    const Smax = maxStrength();\n    if (target >= Smax) return null;\n    return -Math.log(1 - target / Smax) / k;\n  }\n\n  function drawChart() {\n    const svg = $('chart');\n    const W = 800, H = 360, padL = 52, padR = 20, padT = 20, padB = 44;\n    const plotW = W - padL - padR, plotH = H - padT - padB;\n    const Smax = maxStrength();\n    const yMax = Math.max(30, Smax + 5);\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"6\"/>`;\n\n    // 网格\n    [0, 10, 20, 30, 40, 50, 60].forEach(v => {\n      if (v > yMax + 2) return;\n      const y = padT + plotH - v / yMax * plotH;\n      s += `<line x1=\"${padL}\" y1=\"${y}\" x2=\"${padL + plotW}\" y2=\"${y}\" stroke=\"#efece1\" stroke-width=\"1\"/>`;\n      s += `<text x=\"${padL - 8}\" y=\"${y + 3}\" font-size=\"10\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">${v}</text>`;\n    });\n    [0, 6, 12, 18, 24, 30, 36, 42, 48].forEach(t => {\n      const x = padL + t / T_MAX * plotW;\n      s += `<line x1=\"${x}\" y1=\"${padT}\" x2=\"${x}\" y2=\"${padT + plotH}\" stroke=\"#efece1\" stroke-width=\"1\"/>`;\n      s += `<text x=\"${x}\" y=\"${padT + plotH + 16}\" font-size=\"10\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">${t}</text>`;\n    });\n\n    // 试压阈值线\n    const yTest = padT + plotH - T_TEST / yMax * plotH;\n    s += `<line x1=\"${padL}\" y1=\"${yTest}\" x2=\"${padL + plotW}\" y2=\"${yTest}\" stroke=\"#a97a1c\" stroke-width=\"1.2\" stroke-dasharray=\"5 3\"/>`;\n    s += `<text x=\"${padL + plotW + 4}\" y=\"${yTest + 3}\" font-size=\"10\" fill=\"#a97a1c\" font-family=\"monospace\">14 MPa 试压</text>`;\n\n    // 钻塞阈值线\n    const yDrill = padT + plotH - T_DRILL / yMax * plotH;\n    s += `<line x1=\"${padL}\" y1=\"${yDrill}\" x2=\"${padL + plotW}\" y2=\"${yDrill}\" stroke=\"#3f8560\" stroke-width=\"1.2\" stroke-dasharray=\"5 3\"/>`;\n    s += `<text x=\"${padL + plotW + 4}\" y=\"${yDrill + 3}\" font-size=\"10\" fill=\"#3f8560\" font-family=\"monospace\">21 MPa 钻塞</text>`;\n\n    // 经验候凝 24h 线\n    const x24 = padL + 24 / T_MAX * plotW;\n    s += `<line x1=\"${x24}\" y1=\"${padT}\" x2=\"${x24}\" y2=\"${padT + plotH}\" stroke=\"#b26a39\" stroke-width=\"1.2\" stroke-dasharray=\"4 2\"/>`;\n    s += `<text x=\"${x24}\" y=\"${padT - 4}\" font-size=\"9\" fill=\"#b26a39\" text-anchor=\"middle\" font-family=\"monospace\">经验 24h</text>`;\n\n    // 置信区间带\n    const N = 200;\n    let upper = '', lower = '';\n    for (let i = 0; i <= N; i++) {\n      const t = i / N * T_MAX;\n      const str = strengthAt(t);\n      const up = Math.min(yMax, str * 1.15);\n      const lo = Math.max(0, str * 0.85);\n      const x = padL + t / T_MAX * plotW;\n      const yu = padT + plotH - up / yMax * plotH;\n      const yl = padT + plotH - lo / yMax * plotH;\n      upper += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yu.toFixed(1) + ' ';\n      lower += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yl.toFixed(1) + ' ';\n    }\n    // 填充带（upper 正序 + lower 逆序）\n    let fillPath = upper;\n    for (let i = N; i >= 0; i--) {\n      const t = i / N * T_MAX;\n      const str = strengthAt(t);\n      const lo = Math.max(0, str * 0.85);\n      const x = padL + t / T_MAX * plotW;\n      const yl = padT + plotH - lo / yMax * plotH;\n      fillPath += 'L' + x.toFixed(1) + ' ' + yl.toFixed(1) + ' ';\n    }\n    fillPath += 'Z';\n    s += `<path d=\"${fillPath}\" fill=\"#2f7d6b\" opacity=\"0.15\"/>`;\n\n    // 主曲线\n    let main = '';\n    for (let i = 0; i <= N; i++) {\n      const t = i / N * T_MAX;\n      const str = strengthAt(t);\n      const x = padL + t / T_MAX * plotW;\n      const y = padT + plotH - str / yMax * plotH;\n      main += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';\n    }\n    s += `<path d=\"${main}\" fill=\"none\" stroke=\"#2f7d6b\" stroke-width=\"2.5\"/>`;\n\n    // 达标时间点\n    const tTest = timeToReach(T_TEST);\n    const tDrill = timeToReach(T_DRILL);\n    if (tTest && tTest <= T_MAX) {\n      const x = padL + tTest / T_MAX * plotW;\n      s += `<circle cx=\"${x.toFixed(1)}\" cy=\"${yTest}\" r=\"5\" fill=\"#a97a1c\" stroke=\"#fff\" stroke-width=\"2\"/>`;\n      s += `<text x=\"${x.toFixed(1)}\" y=\"${yTest - 10}\" font-size=\"10\" fill=\"#a97a1c\" text-anchor=\"middle\" font-family=\"monospace\" font-weight=\"600\">${tTest.toFixed(1)}h</text>`;\n    }\n    if (tDrill && tDrill <= T_MAX) {\n      const x = padL + tDrill / T_MAX * plotW;\n      s += `<circle cx=\"${x.toFixed(1)}\" cy=\"${yDrill}\" r=\"5\" fill=\"#3f8560\" stroke=\"#fff\" stroke-width=\"2\"/>`;\n      s += `<text x=\"${x.toFixed(1)}\" y=\"${yDrill - 10}\" font-size=\"10\" fill=\"#3f8560\" text-anchor=\"middle\" font-family=\"monospace\" font-weight=\"600\">${tDrill.toFixed(1)}h</text>`;\n    }\n\n    // 轴标签\n    s += `<text x=\"${padL / 2}\" y=\"${padT + plotH / 2}\" font-size=\"11\" fill=\"#5d666d\" text-anchor=\"middle\" transform=\"rotate(-90 ${padL / 2} ${padT + plotH / 2})\">抗压强度 (MPa)</text>`;\n    s += `<text x=\"${padL + plotW / 2}\" y=\"${H - 6}\" font-size=\"11\" fill=\"#5d666d\" text-anchor=\"middle\">候凝时间 (h)</text>`;\n\n    svg.innerHTML = s;\n    return { tTest, tDrill };\n  }\n\n  function render() {\n    const { tTest, tDrill } = drawChart();\n\n    const elTest = $('t-test');\n    const elDrill = $('t-drill');\n    const elRec = $('t-rec');\n\n    if (tTest === null) {\n      elTest.textContent = '>48h'; elTest.className = 'v bad';\n    } else if (tTest > T_MAX) {\n      elTest.textContent = tTest.toFixed(1) + 'h'; elTest.className = 'v bad';\n    } else {\n      elTest.textContent = tTest.toFixed(1) + 'h'; elTest.className = 'v';\n    }\n\n    if (tDrill === null || tDrill > T_MAX) {\n      elDrill.textContent = tDrill ? tDrill.toFixed(1) + 'h' : '极限内不达'; elDrill.className = 'v warn';\n    } else {\n      elDrill.textContent = tDrill.toFixed(1) + 'h'; elDrill.className = 'v';\n    }\n\n    // 推荐候凝 = tTest 上限（+15% 置信）\n    let rec = null;\n    if (tTest !== null) {\n      rec = tTest * 1.15;\n      elRec.textContent = rec.toFixed(1) + 'h';\n      elRec.className = rec <= 24 ? 'v' : 'v warn';\n    } else {\n      elRec.textContent = '>48h';\n      elRec.className = 'v bad';\n    }\n\n    const v = $('verdict');\n    if (rec === null) {\n      v.className = 'verdict bad';\n      v.textContent = '❌ 当前配方在 48h 内无法达到试压强度，需提高温度或减少水灰比。';\n    } else if (rec <= 12) {\n      v.className = 'verdict ok';\n      v.textContent = `✅ 推荐候凝 ${rec.toFixed(1)}h，比经验 24h 节省 ${(24 - rec).toFixed(1)}h。温度足、配方合理。`;\n    } else if (rec <= 24) {\n      v.className = 'verdict ok';\n      v.textContent = `✅ 推荐候凝 ${rec.toFixed(1)}h，略少于经验 24h，可节省 ${(24 - rec).toFixed(1)}h。`;\n    } else {\n      v.className = 'verdict warn';\n      v.textContent = `⚠️ 推荐候凝 ${rec.toFixed(1)}h，超过经验 24h。低温或水灰比偏高，建议加促凝剂或降低水灰比。`;\n    }\n  }\n\n  function bind() {\n    $('s-temp').addEventListener('input', e => { state.temp = +e.target.value; $('o-temp').textContent = state.temp; render(); });\n    $('s-wc').addEventListener('input', e => { state.wc = +e.target.value; $('o-wc').textContent = state.wc.toFixed(2); render(); });\n    $('s-ret').addEventListener('input', e => { state.ret = +e.target.value; $('o-ret').textContent = state.ret.toFixed(2); render(); });\n    $('s-acc').addEventListener('input', e => { state.acc = +e.target.value; $('o-acc').textContent = state.acc.toFixed(1); render(); });\n  }\n\n  bind();\n  render();\n})();\n" },
      { "name": "demo/index.html", "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：水泥候凝强度预测</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>水泥候凝强度预测 · 交互式演示</h1>\n  <p class=\"lead\">调节井底温度、水灰比、缓凝剂/促凝剂掺量，看水泥抗压强度随时间的发展曲线，以及达到试压强度的时间点。</p>\n\n  <div class=\"section\">\n    <h2>① 强度发展曲线</h2>\n    <p class=\"hint\">实线是预测强度，虚线是 95% 置信区间。<b style=\"color:#a97a1c\">黄色虚线</b>是试压强度阈值（14 MPa），<b style=\"color:#3f8560\">绿色虚线</b>是钻塞强度阈值（21 MPa）。</p>\n    <div class=\"chart-wrap\">\n      <svg id=\"chart\" viewBox=\"0 0 800 360\" role=\"img\" aria-label=\"水泥强度发展曲线\"></svg>\n    </div>\n    <div class=\"legend\">\n      <span><i style=\"background:#2f7d6b\"></i>预测强度</span>\n      <span><i style=\"background:#2f7d6b;opacity:0.4\"></i>95% 置信区间</span>\n      <span><i style=\"background:#a97a1c\"></i>试压阈值 14 MPa</span>\n      <span><i style=\"background:#3f8560\"></i>钻塞阈值 21 MPa</span>\n      <span><i style=\"background:#b26a39\"></i>经验候凝 24h</span>\n    </div>\n  </div>\n\n  <div class=\"section\">\n    <h2>② 调节条件</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>井底温度 (℃)<output id=\"o-temp\">85</output></label>\n        <input type=\"range\" id=\"s-temp\" min=\"20\" max=\"120\" step=\"1\" value=\"85\">\n        <span class=\"tip\">温度每升 10℃ 水化速率约翻倍</span>\n      </div>\n      <div class=\"ctl\">\n        <label>水灰比 w/c<output id=\"o-wc\">0.44</output></label>\n        <input type=\"range\" id=\"s-wc\" min=\"0.35\" max=\"0.6\" step=\"0.01\" value=\"0.44\">\n        <span class=\"tip\">水越多后期强度越低</span>\n      </div>\n      <div class=\"ctl\">\n        <label>缓凝剂掺量 (%)<output id=\"o-ret\">0.3</output></label>\n        <input type=\"range\" id=\"s-ret\" min=\"0\" max=\"1.5\" step=\"0.05\" value=\"0.3\">\n        <span class=\"tip\">推迟水化，高温井常用</span>\n      </div>\n      <div class=\"ctl\">\n        <label>促凝剂掺量 (%)<output id=\"o-acc\">0</output></label>\n        <input type=\"range\" id=\"s-acc\" min=\"0\" max=\"4\" step=\"0.1\" value=\"0\">\n        <span class=\"tip\">加速水化，低温井常用</span>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"section\">\n    <h2>③ 预测结果</h2>\n    <div class=\"info-grid\">\n      <div class=\"info-card\">\n        <div class=\"k\">达到试压强度 (14 MPa)</div>\n        <div class=\"v\" id=\"t-test\">—</div>\n        <div class=\"sub\">可进行套管试压</div>\n      </div>\n      <div class=\"info-card\">\n        <div class=\"k\">达到钻塞强度 (21 MPa)</div>\n        <div class=\"v\" id=\"t-drill\">—</div>\n        <div class=\"sub\">可钻水泥塞</div>\n      </div>\n      <div class=\"info-card\">\n        <div class=\"k\">推荐候凝时间</div>\n        <div class=\"v\" id=\"t-rec\">—</div>\n        <div class=\"sub\">取置信区间上限</div>\n      </div>\n    </div>\n    <div class=\"verdict\" id=\"verdict\"></div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n" }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "调节井底温度、水灰比、缓凝剂掺量，实时看水泥强度发展曲线怎么变，以及什么时候达到试压强度。",
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
