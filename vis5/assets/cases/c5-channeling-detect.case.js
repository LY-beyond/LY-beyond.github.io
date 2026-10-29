/* =========================================================
   案例插件（静态注册版）：环空窜槽智能识别：超声成像语义分割
   ---------------------------------------------------------
   由 cases/c5-channeling-detect/case.json 与 demo/ 目录生成。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
  "id": "c5-channeling-detect",
  "sceneId": "c5",
  "methods": [
    "cv"
  ],
  "title": "环空窜槽智能识别：超声成像语义分割",
  "version": "1.0.0",
  "updated": "2026-10-26",
  "status": "ready",
  "tabs": {
    "background": {
      "label": "专业背景",
      "lede": "固井的终极目标是层间封隔。如果水泥环里残留了未胶结的通道（窜槽），高压层的油气水就会沿着通道窜到低压层甚至井口，整口井的封隔就失效了。CBL 只能看套管-水泥界面的整体胶结，看不到水泥环内部的窜流通道；超声成像能看到截面，但人工判读既慢又主观。",
      "judge": [
        {
          "label": "任务类型",
          "value": "图像语义分割",
          "desc": "在水泥环截面上标出窜槽区域"
        },
        {
          "label": "标注成本",
          "value": "中",
          "desc": "需要验窜结果做真值，标注窜槽位置"
        },
        {
          "label": "可见收益",
          "value": "高",
          "desc": "漏判窜槽 = 后续层间封隔彻底失效"
        },
        {
          "label": "难度",
          "value": "中",
          "desc": "窜槽形态多样，易与微环隙混淆"
        }
      ],
      "sections": [
        {
          "no": 1,
          "en": "PROBLEM",
          "title": "当前做法与问题",
          "html": "<p>判断固井后有没有窜槽，传统做法是看 <b>CBL 幅度</b>：套管波强说明套管-水泥界面胶结差，可能有窜。但 CBL 是一维曲线，只能反映套管外壁一圈的平均胶结，<b>看不到水泥环内部的通道分布</b>。</p><p>超声成像 / 扇区水泥胶结测井（SBT）能给出 360° 水泥环截面，理论上可以直接看到窜槽。但实际判读有三个问题：<b>慢</b>——一口井几千帧，人工逐幅看要数小时；<b>主观</b>——不同解释员对同一帧的窜槽判定可不一致；<b>易混淆</b>——微环隙（套管与水泥间有缝隙但水泥本身完好）、仪器偏心造成的假特征，和真窜槽在图像上很像。</p><div class='figure'><svg viewBox='0 0 720 280' width='100%' role='img' aria-label='水泥环截面：正常 vs 窜槽 vs 微环隙'><rect x='0' y='0' width='720' height='280' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 水泥环截面三种状态</text><text x='160' y='46' font-size='10' fill='var(--ink-2)' text-anchor='middle'>正常胶结</text><circle cx='160' cy='140' r='68' fill='none' stroke='var(--ink-2)' stroke-width='1.2'/><circle cx='160' cy='140' r='50' fill='var(--jade)' opacity='0.18'/><circle cx='160' cy='140' r='30' fill='var(--paper-2)' stroke='var(--ink)' stroke-width='1.2'/><text x='160' y='240' font-size='10' fill='var(--ok)' text-anchor='middle'>水泥环连续完整</text><text x='380' y='46' font-size='10' fill='var(--ink-2)' text-anchor='middle'>窜槽（通道）</text><circle cx='380' cy='140' r='68' fill='none' stroke='var(--ink-2)' stroke-width='1.2'/><path d='M380 72 A68 68 0 0 1 448 140 A68 68 0 0 1 380 208 A68 68 0 0 1 312 140 A68 68 0 0 1 380 72 Z M350 92 A50 50 0 0 0 330 140 A50 50 0 0 0 350 188 A50 50 0 0 0 410 140 A50 50 0 0 0 350 92 Z' fill='var(--jade)' opacity='0.18'/><path d='M362 96 A44 44 0 0 1 424 140 A44 44 0 0 1 362 184 A44 44 0 0 1 300 140 A44 44 0 0 1 362 96 Z M358 100 A40 40 0 0 0 320 140 A40 40 0 0 0 358 180 A40 40 0 0 0 396 140 A40 40 0 0 0 358 100 Z' fill='var(--bad)' opacity='0.25'/><circle cx='380' cy='140' r='30' fill='var(--paper-2)' stroke='var(--ink)' stroke-width='1.2'/><text x='380' y='240' font-size='10' fill='var(--bad)' text-anchor='middle'>水泥环有缺口，形成通道</text><text x='600' y='46' font-size='10' fill='var(--ink-2)' text-anchor='middle'>微环隙</text><circle cx='600' cy='140' r='68' fill='none' stroke='var(--ink-2)' stroke-width='1.2'/><circle cx='600' cy='140' r='52' fill='var(--jade)' opacity='0.18'/><circle cx='600' cy='140' r='48' fill='none' stroke='var(--warn)' stroke-width='1.6' stroke-dasharray='3 2'/><circle cx='600' cy='140' r='30' fill='var(--paper-2)' stroke='var(--ink)' stroke-width='1.2'/><text x='600' y='240' font-size='10' fill='var(--warn)' text-anchor='middle'>套管-水泥间缝隙，水泥完好</text><text x='18' y='268' font-size='9' fill='var(--ink-3)'>CBL 对微环隙和真窜槽都表现为套管波增强，无法区分；超声成像可直接看到截面差异</text></svg><div class='figcap'><b>图 1</b><span>水泥环截面三种状态：正常胶结水泥连续；窜槽有贯穿通道；微环隙只是套管与水泥间有缝，水泥环本身完好</span></div></div>"
        },
        {
          "no": 2,
          "en": "INTERVENTION",
          "title": "AI 能做什么",
          "html": "<p>把问题转成<b>图像语义分割</b>：输入一帧 360° 水泥环截面图，输出一张同尺寸的 mask，标出哪些像素属于窜槽。模型用 U-Net 或 DeepLab 这类编码器-解码器结构，在标注好的成像图上训练。</p><p>关键在于<b>区分真窜槽和微环隙</b>。两者在单帧截面图上都表现为\"套管外有一圈低密度\"，区别在于：微环隙是整圈均匀的薄缝，窜槽是局部、不规则、且沿深度方向连续延伸的通道。所以模型不能只看单帧，还要<b>叠加相邻深度帧的时间/深度维度</b>（用 3D 卷积或把连续几帧拼成 2.5D 输入），沿深度方向的连续性是区分两者的关键特征。</p><p>输出不只是\"有无窜槽\"，而是<b>窜槽的角度范围、径向位置、沿深度延伸长度</b>，工程师据此判断是否需要挤水泥补救。</p><div class='figure'><svg viewBox='0 0 720 255' width='100%' role='img' aria-label='超声成像帧输入分割模型输出窜槽掩码'><rect x='0' y='0' width='720' height='255' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>B · 连续深度帧 → 分割模型 → 窜槽 mask</text><g transform='translate(30,44)'><rect x='0' y='0' width='70' height='70' fill='none' stroke='var(--line)'/><circle cx='35' cy='35' r='28' fill='var(--ink-3)' opacity='0.15'/><path d='M35 7 A28 28 0 0 1 63 35 A28 28 0 0 1 35 63 A28 28 0 0 1 7 35 A28 28 0 0 1 35 7 Z' fill='var(--jade)' opacity='0.2'/><path d='M20 15 A20 20 0 0 0 15 35 A20 20 0 0 0 20 55' fill='var(--bad)' opacity='0.3'/><text x='35' y='86' font-size='9' fill='var(--ink-3)' text-anchor='middle'>z = 1000m</text></g><g transform='translate(30,110)'><rect x='0' y='0' width='70' height='70' fill='none' stroke='var(--line)'/><circle cx='35' cy='35' r='28' fill='var(--ink-3)' opacity='0.15'/><path d='M35 7 A28 28 0 0 1 63 35 A28 28 0 0 1 35 63 A28 28 0 0 1 7 35 A28 28 0 0 1 35 7 Z' fill='var(--jade)' opacity='0.2'/><path d='M18 12 A20 20 0 0 0 12 35 A20 20 0 0 0 18 58' fill='var(--bad)' opacity='0.35'/><text x='35' y='86' font-size='9' fill='var(--ink-3)' text-anchor='middle'>z = 1001m</text></g><g transform='translate(30,176)'><rect x='0' y='0' width='70' height='70' fill='none' stroke='var(--line)'/><circle cx='35' cy='35' r='28' fill='var(--ink-3)' opacity='0.15'/><path d='M35 7 A28 28 0 0 1 63 35 A28 28 0 0 1 35 63 A28 28 0 0 1 7 35 A28 28 0 0 1 35 7 Z' fill='var(--jade)' opacity='0.2'/><path d='M22 18 A20 20 0 0 0 16 35 A20 20 0 0 0 22 52' fill='var(--bad)' opacity='0.4'/><text x='35' y='86' font-size='9' fill='var(--ink-3)' text-anchor='middle'>z = 1002m</text></g><path d='M108 140 L200 140' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M200 136 L208 140 L200 144 Z' fill='var(--ink-3)'/><rect x='220' y='70' width='140' height='140' rx='5' fill='var(--paper-2)' stroke='var(--line)'/><text x='290' y='92' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>2.5D U-Net</text><text x='290' y='108' font-size='9' fill='var(--ink-3)' text-anchor='middle'>连续 3 帧拼接输入</text><text x='290' y='124' font-size='9' fill='var(--ink-3)' text-anchor='middle'>编码器-解码器</text><text x='290' y='140' font-size='9' fill='var(--ink-3)' text-anchor='middle'>输出窜槽概率图</text><path d='M368 140 L430 140' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M430 136 L438 140 L430 144 Z' fill='var(--ink-3)'/><g transform='translate(450,70)'><rect x='0' y='0' width='140' height='140' rx='5' fill='var(--paper-2)' stroke='var(--line)'/><circle cx='70' cy='70' r='56' fill='var(--jade)' opacity='0.15'/><path d='M70 14 A56 56 0 0 1 126 70 A56 56 0 0 1 70 126 A56 56 0 0 1 14 70 A56 56 0 0 1 70 14 Z' fill='none' stroke='var(--line)'/><path d='M40 24 A40 40 0 0 0 28 70 A40 40 0 0 0 40 116' fill='var(--bad)' opacity='0.5'/><path d='M40 24 A40 40 0 0 0 28 70 A40 40 0 0 0 40 116' fill='none' stroke='var(--bad)' stroke-width='1.6'/><text x='70' y='156' font-size='9' fill='var(--ink-3)' text-anchor='middle'>窜槽 mask（红色 = 通道）</text></g><text x='450' y='236' font-size='9' fill='var(--ink-2)'>输出：窜槽角度范围、径向位置、深度延伸长度</text><text x='18' y='248' font-size='9' fill='var(--ink-3)'>沿深度方向的连续性是区分真窜槽与微环隙的关键特征</text></svg><div class='figcap'><b>图 2</b><span>连续 3 帧深度截面拼成 2.5D 输入 U-Net，输出窜槽 mask；模型利用沿深度的连续性区分真窜槽与微环隙</span></div></div>"
        },
        {
          "no": 3,
          "en": "DATA",
          "title": "你需要准备什么",
          "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。核心数据是超声成像图，配合验窜结果做真值。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">超声成像 / 扇区胶结测井图</span><span class=\"cl-s\">全井段，每帧 360° 扇区</span></span><span class=\"cl-n\">最好有同井段多帧连续数据</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">CBL / VDL 曲线</span><span class=\"cl-s\">同井段，0.5 m 采样</span></span><span class=\"cl-n\">作为辅助特征输入</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">验窜 / 试压结果</span><span class=\"cl-s\">是否窜、窜通层位</span></span><span class=\"cl-n\">作为真值，决定标签质量</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">图像标注（窜槽 mask）</span><span class=\"cl-s\">由解释员在成像图上勾出</span></span><span class=\"cl-n\">至少 200 井段，含正负样本</span></div></div>"
        },
        {
          "no": 4,
          "en": "DIFFICULTY",
          "title": "技术难度与参考方向",
          "html": "<p>难度 <b>中</b>——成像图本身信息量够，模型架构也成熟（U-Net 是分割标配），真正的难点在<b>标签</b>：验窜结果是二值的（窜/不窜），但模型需要像素级 mask，所以需要解释员在成像图上手动勾出窜槽区域，标注成本不低。另一个难点是<b>类不均衡</b>——窜槽像素通常只占水泥环截面的 5%—15%，训练时需要 dice loss 或加权交叉熵。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/cv\">语义分割<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">U-Net<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">图像形态学<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">多模态融合<span class=\"ar\">↗</span></a></div>"
        }
      ]
    },
    "workflow": {
      "label": "案例流程",
      "title": "一口问题井的窜槽识别与补救决策",
      "lead": [
        "某区块一口固井后验窜发现油层与水层之间窜通，需要定位窜槽位置和形态，决定挤水泥补救方案。",
        "下面的流程把\"看 CBL 猜有没有窜\"变成\"成像图分割 + 量化窜槽参数\"——模型给出窜槽的角度范围和深度延伸，工程师据此决定挤水泥量。"
      ],
      "stats": [
        [
          "成像井段",
          "1200—1500 m"
        ],
        [
          "成像帧率",
          "每 0.1 m 一帧"
        ],
        [
          "总帧数",
          "3000 帧"
        ],
        [
          "人工判读耗时",
          "6—8 小时"
        ],
        [
          "模型推理耗时",
          "约 3 分钟"
        ],
        [
          "识别窜槽段",
          "3 处，共 18 m"
        ]
      ],
      "steps": [
        {
          "name": "成像数据预处理",
          "role": "数据",
          "do": "读取超声成像原始数据，对每帧做去噪、强度归一化、仪器偏心校正。把 360° 扇区展开成 2D 图像（深度 × 角度），相邻 3 帧拼成 2.5D 输入。",
          "effect": "得到标准化的连续深度帧序列，消除仪器偏心造成的假特征",
          "trap": "偏心校正不到位会让模型把偏心造成的一侧低密度误判为窜槽"
        },
        {
          "name": "窜槽 mask 分割",
          "role": "推理",
          "do": "用训练好的 2.5D U-Net 对每帧输出窜槽概率图，阈值 0.5 二值化得到 mask。对连续帧的 mask 做沿深度的连通域分析，合并相邻的窜槽区域。",
          "effect": "得到沿井深分布的窜槽段，每段带角度范围和径向位置",
          "trap": "单帧独立预测会产生孤立噪点，必须做深度方向的连通域过滤"
        },
        {
          "name": "窜槽参数量化",
          "role": "后处理",
          "do": "对每个连通的窜槽段计算：深度起止、角度范围（几度到几度）、径向位置（套管侧/地层侧/中间）、最大宽度。与验窜结果交叉验证。",
          "effect": "输出结构化的窜槽报告，不再是\"有窜/没窜\"的二值判断",
          "trap": "微环隙是整圈均匀薄缝，角度范围接近 360°，据此可与真窜槽区分"
        },
        {
          "name": "补救方案推荐",
          "role": "决策",
          "do": "根据窜槽参数推荐挤水泥方案：窜槽角度 < 90° 且深度短 → 定点挤水泥；角度大或多段 → 全井段重注。给出挤水泥量估算。",
          "effect": "工程师不再凭经验决定挤水泥量，有量化依据",
          "trap": "模型识别的窜槽可能与验窜结果不完全吻合，需要人工复核边界"
        }
      ],
      "metrics": {
        "title": "怎么算\"识别准不准\"",
        "html": "<p>窜槽识别的精度不能只用\"准确率\"，因为窜槽像素占比很低（类不均衡）。核心指标是<b>Dice 系数</b>（预测 mask 与真值 mask 的重叠度）和<b>漏检率</b>（漏判的窜槽段占比）——漏检比误检代价高得多，因为漏判的窜槽会直接导致层间封隔失效。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>目标值</th></tr></thead><tbody><tr><td>Dice 系数</td><td>预测与真值 mask 的重叠度</td><td>≥ 0.75</td></tr><tr><td>窜槽段漏检率</td><td>漏判窜槽段 / 真值窜槽段</td><td>≤ 10%</td></tr><tr><td>段级准确率</td><td>正确识别段 / 预测段</td><td>≥ 85%</td></tr><tr><td>单井处理时间</td><td>3000 帧推理</td><td>≤ 5 分钟</td></tr></tbody></table>"
      },
      "fails": [
        {
          "name": "把微环隙判成窜槽",
          "why": "微环隙是套管-水泥间的整圈缝隙，单帧看和窜槽相似。需要用沿深度方向的均匀性来区分——微环隙整圈均匀且沿深度连续，真窜槽局部不规则。"
        },
        {
          "name": "仪器偏心造成假窜槽",
          "why": "仪器不在井眼中心时，一侧距离远导致回波弱，看起来像低密度。预处理必须做偏心校正。"
        },
        {
          "name": "标注一致性差",
          "why": "不同解释员对同一帧窜槽边界的勾画可差 10—20 度，训练标签本身有噪声，需要多人标注取交集。"
        }
      ]
    },
    "demo": {
      "mode": "auto",
      "html": "demo/index.html",
      "js": "demo/demo.js",
      "label": "可运行示范",
      "intro": "调节水泥环偏心、窜槽角度和微环隙，实时生成模拟超声成像图，看分割模型怎么识别窜槽区域。",
      "height": 720
    }
  }
};

  var FILES = [
      { "name": "demo/demo.css", "data": "/* ========= 窜槽识别示范样式 ========= */\n* { box-sizing: border-box; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #fbfaf6;\n  color: #242b2e;\n  padding: 32px 28px;\n  line-height: 1.65;\n}\n.panel { max-width: 920px; margin: 0 auto; }\nh1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }\nh2 { font-size: 15px; font-weight: 600; margin: 24px 0 8px; color: #235f51; }\n.lead { color: #4d565b; margin-bottom: 16px; }\n.hint { font-size: 12.5px; color: #79828a; margin-bottom: 12px; }\n.section { background: #fff; border: 1px solid #e9e4d8; border-radius: 9px; padding: 20px 22px; margin-bottom: 18px; }\n\n.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }\n.ctl { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: #f5f2ea; border-radius: 7px; }\n.ctl label { font-size: 13px; display: flex; justify-content: space-between; font-weight: 500; }\n.ctl output { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: #2f7d6b; }\n.ctl .tip { font-size: 11.5px; color: #9ba3a9; }\n\n.view-row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }\n.view-col { flex: 1; min-width: 280px; }\n.view-col h3 { font-size: 12px; color: #79828a; margin: 0 0 6px; letter-spacing: .1em; text-transform: uppercase; }\n.view-col svg { background: #fdfcf9; border-radius: 8px; width: 100%; }\n\n.info-list { font-size: 13px; }\n.info-list .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e9e4d8; }\n.info-list .row b { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; }\n.info-list .row.warn b { color: #a97a1c; }\n.info-list .row.bad b { color: #b05a51; }\n\n.verdict { margin-top: 12px; padding: 10px 14px; border-radius: 6px; font-size: 13px; }\n.verdict.ok { background: #e7f3ea; color: #3f8560; }\n.verdict.warn { background: #f9efd7; color: #a97a1c; }\n.verdict.bad { background: #f9e9e5; color: #b05a51; }\n\n.legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; font-size: 11.5px; color: #5d666d; }\n.legend i { display: inline-block; width: 12px; height: 12px; vertical-align: middle; margin-right: 4px; border-radius: 2px; }\n" },
      { "name": "demo/demo.js", "data": "/* ======= 环空窜槽智能识别 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  const W = 300, H = 300, CX = 150, CY = 150;\n  const R_WELL = 110;      // 井眼半径\n  const R_CASING = 60;     // 套管外径半径\n\n  let state = {\n    ecc: 0,       // 套管偏心 mm（屏幕 px 近似）\n    chAng: 45,    // 窜槽角度范围\n    chStart: 0,   // 窜槽起始角\n    mic: 0,       // 微环隙 mm\n    th: 0.45,     // 分割阈值\n    noise: 8      // 噪声 %\n  };\n\n  function $(id) { return document.getElementById(id); }\n\n  // 在某角度的水泥环厚度（考虑偏心 + 窜槽 + 微环隙）\n  function cementThicknessAt(angleDeg) {\n    // 偏心方向设为 0°（右侧），计算该方向井壁到套管外壁的距离\n    const a = angleDeg * Math.PI / 180;\n    // 套管中心偏移\n    const casX = CX + state.ecc;\n    const casY = CY;\n    // 从套管中心沿 angle 方向到井壁的距离\n    // 井壁圆心在 (CX,CY) 半径 R_WELL；套管圆心 (casX,casY) 半径 R_CASING\n    const dx = Math.cos(a), dy = Math.sin(a);\n    // 射线从套管中心出发，与井壁交点\n    // |(casX + t*dx - CX, casY + t*dy - CY)| = R_WELL\n    const ex = casX - CX, ey = casY - CY;\n    const b = 2 * (ex * dx + ey * dy);\n    const c = ex * ex + ey * ey - R_WELL * R_WELL;\n    const disc = b * b - 4 * c;\n    const t1 = (-b + Math.sqrt(Math.max(0, disc))) / 2;\n    const distToWell = t1; // 套管外壁到井壁的径向距离\n    let thick = distToWell - R_CASING;\n    if (thick < 0) thick = 0;\n\n    // 微环隙：整圈减薄\n    thick -= state.mic;\n    if (thick < 0) thick = 0;\n\n    // 窜槽：在 [chStart, chStart+chAng] 范围内厚度清零\n    if (state.chAng > 0.5) {\n      const s = state.chStart % 360;\n      const e = (s + state.chAng) % 360;\n      const inChannel = s < e ? (angleDeg >= s && angleDeg < e) : (angleDeg >= s || angleDeg < e);\n      if (inChannel) thick = 0;\n    }\n    return thick;\n  }\n\n  // 超声回波强度：水泥越厚回波越强（胶结好）；越薄越弱\n  function echoIntensity(thick) {\n    const maxT = R_WELL - R_CASING - state.ecc;\n    let v = maxT > 0 ? thick / maxT : 0;\n    v = Math.max(0, Math.min(1, v));\n    // 加噪声\n    v += (Math.random() - 0.5) * state.noise / 100;\n    return Math.max(0, Math.min(1, v));\n  }\n\n  // 渲染物理截面\n  function drawCross() {\n    const svg = $('cross');\n    const casX = CX + state.ecc;\n    let s = '';\n    // 井眼\n    s += `<circle cx=\"${CX}\" cy=\"${CY}\" r=\"${R_WELL}\" fill=\"#f5f2ea\" stroke=\"#c9c2b0\" stroke-width=\"1.5\"/>`;\n    // 水泥环（沿角度画扇形段）\n    const N = 360;\n    for (let i = 0; i < N; i++) {\n      const a0 = (i - 0.5) * Math.PI / 180;\n      const a1 = (i + 0.5) * Math.PI / 180;\n      const thick = cementThicknessAt(i);\n      const intensity = thick / (R_WELL - R_CASING);\n      let color;\n      if (thick < 0.5) color = '#b05a51'; // 窜槽\n      else if (state.mic > 0.1 && thick < R_WELL - R_CASING - state.ecc) {\n        // 微环隙情况下，整圈偏薄\n        color = '#a97a1c';\n      } else {\n        const g = Math.floor(122 + intensity * 50);\n        color = `rgb(${47 + (1 - intensity) * 40}, ${g}, ${107 + (1 - intensity) * 30})`;\n      }\n      // 从套管外壁到井壁的扇形\n      const r1 = R_CASING;\n      const r2 = r1 + thick + 0.5;\n      const x1 = casX + r1 * Math.cos(a0), y1 = CY + r1 * Math.sin(a0);\n      const x2 = casX + r2 * Math.cos(a0), y2 = CY + r2 * Math.sin(a0);\n      const x3 = casX + r2 * Math.cos(a1), y3 = CY + r2 * Math.sin(a1);\n      const x4 = casX + r1 * Math.cos(a1), y4 = CY + r1 * Math.sin(a1);\n      s += `<polygon points=\"${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)} ${x4.toFixed(1)},${y4.toFixed(1)}\" fill=\"${color}\" opacity=\"0.85\"/>`;\n    }\n    // 套管\n    s += `<circle cx=\"${casX}\" cy=\"${CY}\" r=\"${R_CASING}\" fill=\"#4d565b\" stroke=\"#242b2e\" stroke-width=\"1.5\"/>`;\n    s += `<circle cx=\"${casX}\" cy=\"${CY}\" r=\"${R_CASING * 0.6}\" fill=\"#242b2e\"/>`;\n    // 偏心线\n    if (state.ecc > 1) {\n      s += `<line x1=\"${CX}\" y1=\"${CY}\" x2=\"${casX}\" y2=\"${CY}\" stroke=\"#b05a51\" stroke-width=\"1.2\" stroke-dasharray=\"3 2\"/>`;\n      s += `<text x=\"${(CX + casX) / 2}\" y=\"${CY - 6}\" font-size=\"9\" fill=\"#b05a51\" text-anchor=\"middle\" font-family=\"monospace\">e=${state.ecc}</text>`;\n    }\n    s += `<text x=\"${CX}\" y=\"${H - 8}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">井径 ${R_WELL * 2} · 套管 ${R_CASING * 2}</text>`;\n    svg.innerHTML = s;\n  }\n\n  // 渲染模拟超声成像图（360° 展开为矩形，角度→x，径向厚度→颜色）\n  function drawImage() {\n    const svg = $('image');\n    const pad = 8;\n    const plotW = W - pad * 2, plotH = H - pad * 2;\n    const N = 360;\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#1a1d1f\"/>`;\n    // 逐角度画竖条\n    const segW = plotW / N;\n    for (let i = 0; i < N; i++) {\n      const thick = cementThicknessAt(i);\n      const intensity = echoIntensity(thick);\n      // 颜色：暗=低强度(窜槽)，亮=高强度(胶结好)\n      const v = Math.floor(intensity * 255);\n      const color = `rgb(${v},${Math.floor(v * 0.95)},${Math.floor(v * 0.8)})`;\n      const x = pad + i * segW;\n      s += `<rect x=\"${x.toFixed(1)}\" y=\"${pad}\" width=\"${(segW + 0.5).toFixed(1)}\" height=\"${plotH}\" fill=\"${color}\"/>`;\n    }\n    // 轴标\n    s += `<text x=\"${pad}\" y=\"${H - 2}\" font-size=\"8\" fill=\"#9ba3a9\" font-family=\"monospace\">0°</text>`;\n    s += `<text x=\"${W / 2}\" y=\"${H - 2}\" font-size=\"8\" fill=\"#9ba3a9\" text-anchor=\"middle\" font-family=\"monospace\">180°</text>`;\n    s += `<text x=\"${W - pad}\" y=\"${H - 2}\" font-size=\"8\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">360°</text>`;\n    s += `<text x=\"${pad}\" y=\"${pad - 2}\" font-size=\"8\" fill=\"#9ba3a9\" font-family=\"monospace\">← 暗 = 低密度 = 可能窜槽</text>`;\n    svg.innerHTML = s;\n  }\n\n  // 分割：在成像图上找低于阈值的连续区域\n  function segment() {\n    const N = 360;\n    const mask = new Array(N).fill(false);\n    for (let i = 0; i < N; i++) {\n      const thick = cementThicknessAt(i);\n      const intensity = echoIntensity(thick);\n      mask[i] = intensity < state.th;\n    }\n    return mask;\n  }\n\n  function drawMask() {\n    const svg = $('mask');\n    const pad = 8;\n    const plotW = W - pad * 2, plotH = H - pad * 2;\n    const N = 360;\n    const mask = segment();\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#1a1d1f\"/>`;\n    const segW = plotW / N;\n    for (let i = 0; i < N; i++) {\n      const x = pad + i * segW;\n      const color = mask[i] ? '#b05a51' : '#2a3033';\n      s += `<rect x=\"${x.toFixed(1)}\" y=\"${pad}\" width=\"${(segW + 0.5).toFixed(1)}\" height=\"${plotH}\" fill=\"${color}\" opacity=\"${mask[i] ? 0.85 : 0.6}\"/>`;\n    }\n    // 圈出检测到的窜槽段\n    let inSeg = false, start = 0;\n    const segments = [];\n    for (let i = 0; i <= N; i++) {\n      const v = i < N ? mask[i] : false;\n      if (v && !inSeg) { inSeg = true; start = i; }\n      if (!v && inSeg) { inSeg = false; segments.push([start, i - 1]); }\n    }\n    segments.forEach(([a, b]) => {\n      const x1 = pad + a * segW;\n      const x2 = pad + (b + 1) * segW;\n      s += `<rect x=\"${x1.toFixed(1)}\" y=\"${pad}\" width=\"${(x2 - x1).toFixed(1)}\" height=\"${plotH}\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.5\" stroke-dasharray=\"4 2\"/>`;\n    });\n    s += `<text x=\"${pad}\" y=\"${H - 2}\" font-size=\"8\" fill=\"#9ba3a9\" font-family=\"monospace\">0°</text>`;\n    s += `<text x=\"${W - pad}\" y=\"${H - 2}\" font-size=\"8\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">360°</text>`;\n    svg.innerHTML = s;\n    return segments;\n  }\n\n  function updateResults(segments) {\n    const totalAng = segments.reduce((s, [a, b]) => s + (b - a + 1), 0);\n    const nSeg = segments.length;\n    const realAng = state.chAng;\n    const detected = segments.map(([a, b]) => `${a}°–${b}°`).join('，') || '无';\n\n    const html = `\n      <div class=\"row\"><span>检测到窜槽段数</span><b>${nSeg}</b></div>\n      <div class=\"row ${totalAng > 0 ? 'bad' : ''}\"><span>检测窜槽角度合计</span><b>${totalAng}°</b></div>\n      <div class=\"row\"><span>真实窜槽角度</span><b>${realAng}°</b></div>\n      <div class=\"row\"><span>检测位置</span><b style=\"font-size:11px\">${detected}</b></div>\n      <div class=\"row\"><span>微环隙</span><b>${state.mic > 0.1 ? state.mic.toFixed(1) + ' mm（整圈）' : '无'}</b></div>\n    `;\n    $('results').innerHTML = html;\n\n    const v = $('verdict');\n    if (realAng < 0.5 && totalAng < 5) {\n      v.className = 'verdict ok';\n      v.textContent = '✅ 无窜槽，模型也未检出。胶结良好。';\n    } else if (realAng > 0.5 && Math.abs(totalAng - realAng) < 15) {\n      v.className = 'verdict ok';\n      v.textContent = `✅ 检出窜槽 ${totalAng}°（真实 ${realAng}°），误差 < 15°，结果可信。`;\n    } else if (realAng > 0.5 && totalAng === 0) {\n      v.className = 'verdict bad';\n      v.textContent = '❌ 漏检！真实有窜槽但模型未检出。降低阈值或检查噪声。';\n    } else if (realAng < 0.5 && totalAng > 5) {\n      v.className = 'verdict warn';\n      v.textContent = `⚠️ 误检！真实无窜槽但检出 ${totalAng}°。可能是偏心或微环隙造成，提高阈值。`;\n    } else {\n      v.className = 'verdict warn';\n      v.textContent = `⚠️ 检出 ${totalAng}° 与真实 ${realAng}° 偏差较大，检查偏心校正与阈值。`;\n    }\n  }\n\n  function render() {\n    drawCross();\n    drawImage();\n    const segs = drawMask();\n    updateResults(segs);\n  }\n\n  function bind() {\n    $('s-ecc').addEventListener('input', e => { state.ecc = +e.target.value; $('o-ecc').textContent = state.ecc; render(); });\n    $('s-ch').addEventListener('input', e => { state.chAng = +e.target.value; $('o-ch').textContent = state.chAng; render(); });\n    $('s-cs').addEventListener('input', e => { state.chStart = +e.target.value; $('o-cs').textContent = state.chStart; render(); });\n    $('s-mic').addEventListener('input', e => { state.mic = +e.target.value; $('o-mic').textContent = state.mic; render(); });\n    $('s-th').addEventListener('input', e => { state.th = +e.target.value; $('o-th').textContent = state.th.toFixed(2); render(); });\n    $('s-noise').addEventListener('input', e => { state.noise = +e.target.value; $('o-noise').textContent = state.noise; render(); });\n  }\n\n  bind();\n  render();\n})();\n" },
      { "name": "demo/index.html", "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：环空窜槽智能识别</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>环空窜槽识别 · 交互式演示</h1>\n  <p class=\"lead\">模拟一口井的水泥环截面：调节偏心、窜槽角度、微环隙，看超声成像图怎么变，以及分割模型如何标出窜槽区域。</p>\n\n  <div class=\"section\">\n    <h2>① 水泥环截面与模拟超声成像</h2>\n    <p class=\"hint\">左图是物理截面（井眼=灰大圆、套管=深灰圆、水泥环=绿色环、窜槽=红色缺口）；中图是模拟超声成像强度图（颜色越暗回波越弱=低密度=可能窜槽）；右图是模型分割出的窜槽 mask。</p>\n    <div class=\"view-row\">\n      <div class=\"view-col\">\n        <h3>物理截面</h3>\n        <svg id=\"cross\" viewBox=\"0 0 300 300\" role=\"img\" aria-label=\"水泥环物理截面\"></svg>\n      </div>\n      <div class=\"view-col\">\n        <h3>模拟超声成像（360° 展开）</h3>\n        <svg id=\"image\" viewBox=\"0 0 300 300\" role=\"img\" aria-label=\"模拟超声成像图\"></svg>\n      </div>\n      <div class=\"view-col\">\n        <h3>分割结果（窜槽 mask）</h3>\n        <svg id=\"mask\" viewBox=\"0 0 300 300\" role=\"img\" aria-label=\"窜槽分割结果\"></svg>\n      </div>\n    </div>\n    <div class=\"legend\">\n      <span><i style=\"background:#2f7d6b\"></i>水泥（胶结好）</span>\n      <span><i style=\"background:#b05a51\"></i>窜槽（低密度）</span>\n      <span><i style=\"background:#a97a1c\"></i>微环隙</span>\n      <span><i style=\"background:#4d565b\"></i>套管</span>\n    </div>\n  </div>\n\n  <div class=\"section\">\n    <h2>② 调节条件</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>套管偏心 (mm)<output id=\"o-ecc\">0</output></label>\n        <input type=\"range\" id=\"s-ecc\" min=\"0\" max=\"25\" step=\"1\" value=\"0\">\n        <span class=\"tip\">套管偏离井眼中心</span>\n      </div>\n      <div class=\"ctl\">\n        <label>窜槽角度 (°)<output id=\"o-ch\">45</output></label>\n        <input type=\"range\" id=\"s-ch\" min=\"0\" max=\"360\" step=\"1\" value=\"45\">\n        <span class=\"tip\">0° = 无窜槽；45° = 45° 扇区有窜槽</span>\n      </div>\n      <div class=\"ctl\">\n        <label>窜槽起始角 (°)<output id=\"o-cs\">0</output></label>\n        <input type=\"range\" id=\"s-cs\" min=\"0\" max=\"360\" step=\"1\" value=\"0\">\n        <span class=\"tip\">窜槽在圆周上的起始位置</span>\n      </div>\n      <div class=\"ctl\">\n        <label>微环隙 (mm)<output id=\"o-mic\">0</output></label>\n        <input type=\"range\" id=\"s-mic\" min=\"0\" max=\"2\" step=\"0.1\" value=\"0\">\n        <span class=\"tip\">套管-水泥间的整圈缝隙</span>\n      </div>\n      <div class=\"ctl\">\n        <label>分割阈值<output id=\"o-th\">0.45</output></label>\n        <input type=\"range\" id=\"s-th\" min=\"0.1\" max=\"0.9\" step=\"0.01\" value=\"0.45\">\n        <span class=\"tip\">低于此强度被判为窜槽</span>\n      </div>\n      <div class=\"ctl\">\n        <label>噪声<output id=\"o-noise\">8</output></label>\n        <input type=\"range\" id=\"s-noise\" min=\"0\" max=\"30\" step=\"1\" value=\"8\">\n        <span class=\"tip\">成像图随机噪声（%）</span>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"section\">\n    <h2>③ 识别结果</h2>\n    <div class=\"info-list\" id=\"results\"></div>\n    <div class=\"verdict\" id=\"verdict\"></div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n" }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "调节水泥环偏心、窜槽角度和微环隙，实时生成模拟超声成像图，看分割模型怎么识别窜槽区域。",
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
