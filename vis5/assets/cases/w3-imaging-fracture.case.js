/* =========================================================
   案例插件（静态注册版）：成像测井裂缝智能识别
   ---------------------------------------------------------
   由 cases/w3-imaging-fracture/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "w3-imaging-fracture",
    "sceneId": "w3",
    "methods": [
      "cv"
    ],
    "title": "成像测井裂缝智能识别",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "电成像与声成像把井壁展开成「方位—深度」图像，裂缝表现为正弦状亮暗条纹。人工逐条解释 100 m 要 30—60 min，不同解释员一致率只有 70%—85%。用正弦检测加属性反演，能把解释压到分钟级，并把倾角、走向、密度量化。",
        "judge": [
          {
            "label": "任务类型",
            "value": "图像检测 + 几何反演",
            "desc": "正弦裂缝检测，输出倾角、走向、密度"
          },
          {
            "label": "标注成本",
            "value": "中高",
            "desc": "依赖人工裂缝表与岩心标定"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "100 m 解释 40 min 压缩到 5 min"
          },
          {
            "label": "难度",
            "value": "高",
            "desc": "覆盖盲区、诱导缝伪影、正弦重叠"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>电成像（FMI/XRMI）用 24—192 个极板贴井壁测量，声成像（CAST）用旋转换能器扫描，深度采样 0.0025—0.005 m、方位 64—192 个扇区。把一圈测量按方位展开，就得到「横轴方位角 0—360°、纵轴井深」的展开图：井壁上的倾斜裂缝被展开后，变成一条正弦曲线，正弦的<b>振幅</b>对应倾角，<b>相位</b>对应走向。</p><p>几何关系：设井径 D（m），裂缝面与水平面夹角 α，则展开图上的正弦振幅 A = (D/2)·tanα；相位 φ 就是裂缝倾向的方位。倾角 0° 是水平缝（展开后近似直线），倾角 90° 是垂直缝（展开后近似竖线），中间角度才是典型正弦。</p><p>现场有三个硬约束：<b>覆盖不全</b>——极板式成像覆盖率通常 60%—80%，井壁有盲区，盲区里的裂缝必然漏检；<b>伪影多</b>——钻井诱导缝、钻具刮痕、泥浆侵入都会形成类似正弦的条带，诱导缝常呈 180° 对称双正弦；<b>低角度裂缝</b>——倾角小于 10° 时正弦振幅不到井径的 3%，和层理几乎分不开。</p><p>人工解释一条裂缝要来回量振幅、读相位、算倾角，100 m 井段 30—60 min；两口井之间、两位解释员之间，倾角能差 5°—10°，裂缝条数能差 20%。</p><div class=\"figure\"><svg viewBox=\"0 0 720 270\" width=\"100%\" role=\"img\" aria-label=\"井壁圆柱展开为方位深度图像\"><rect x=\"0\" y=\"0\" width=\"720\" height=\"270\" fill=\"var(--paper-2)\" rx=\"6\"/><text x=\"18\" y=\"24\" font-size=\"11\" fill=\"var(--ink-2)\">图 A · 井壁圆柱展开：倾斜裂缝在展开图上变成正弦</text><ellipse cx=\"140\" cy=\"60\" rx=\"70\" ry=\"18\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><path d=\"M70 60 L70 204\" stroke=\"var(--line-3)\"/><path d=\"M210 60 L210 204\" stroke=\"var(--line-3)\"/><path d=\"M70 204 A70 18 0 0 0 210 204\" fill=\"none\" stroke=\"var(--line-3)\" stroke-dasharray=\"4 3\"/><ellipse cx=\"140\" cy=\"136\" rx=\"70\" ry=\"23\" transform=\"rotate(-12 140 136)\" fill=\"none\" stroke=\"var(--c-cv)\" stroke-width=\"2\"/><text x=\"214\" y=\"132\" font-size=\"9\" fill=\"var(--c-cv)\">裂缝面</text><text x=\"140\" y=\"42\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">0°</text><text x=\"218\" y=\"64\" font-size=\"9\" fill=\"var(--ink-3)\">90°</text><text x=\"140\" y=\"92\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">180°</text><text x=\"62\" y=\"64\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"end\">270°</text><text x=\"140\" y=\"232\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">井壁圆柱（井径 D）</text><path d=\"M250 130 L300 130\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\"/><path d=\"M292 126 L300 130 L292 134\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\" fill=\"none\"/><text x=\"275\" y=\"120\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">展开</text><rect x=\"330\" y=\"54\" width=\"360\" height=\"156\" fill=\"#f8f6ef\" stroke=\"var(--line-3)\"/><line x1=\"420\" y1=\"54\" x2=\"420\" y2=\"210\" stroke=\"var(--line)\"/><line x1=\"510\" y1=\"54\" x2=\"510\" y2=\"210\" stroke=\"var(--line)\"/><line x1=\"600\" y1=\"54\" x2=\"600\" y2=\"210\" stroke=\"var(--line)\"/><path d=\"M330 156 C375 96, 375 96, 420 156 S465 216, 510 156 S555 96, 600 156 S645 216, 690 156\" fill=\"none\" stroke=\"var(--clay)\" stroke-width=\"2.2\"/><text x=\"330\" y=\"46\" font-size=\"9\" fill=\"var(--ink-3)\">0°</text><text x=\"420\" y=\"46\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">90°</text><text x=\"510\" y=\"46\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">180°</text><text x=\"600\" y=\"46\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">270°</text><text x=\"690\" y=\"46\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"end\">360°</text><text x=\"510\" y=\"226\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">方位角 (°)</text><text x=\"322\" y=\"134\" font-size=\"9.5\" fill=\"var(--ink-3)\" text-anchor=\"end\" transform=\"rotate(-90 322 134)\">井深 (m)</text><path d=\"M676 96 L676 216\" stroke=\"var(--bad)\" stroke-width=\"1.2\" stroke-dasharray=\"3 2\"/><path d=\"M672 102 L676 94 L680 102\" stroke=\"var(--bad)\" stroke-width=\"1.2\" fill=\"none\"/><path d=\"M672 210 L676 218 L680 210\" stroke=\"var(--bad)\" stroke-width=\"1.2\" fill=\"none\"/><text x=\"684\" y=\"160\" font-size=\"9\" fill=\"var(--bad)\">2A</text><text x=\"332\" y=\"236\" font-size=\"9\" fill=\"var(--ink-2)\">A = (D/2)·tanα　→　α = arctan(2A / D)；相位 φ 对应走向</text></svg><div class=\"figcap\"><b>图 1</b><span>井壁圆柱展开后，倾斜裂缝变为正弦；振幅 A 决定倾角，相位 φ 决定走向</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>处理链是确定的：预处理（坏极板剔除、井径归一、方位校正）→ 裂缝增强（Frangi 各向异性滤波 + 形态学闭运算）→ 正弦 Hough 检测 → 伪影剔除 → 属性计算。正弦 Hough 在（倾角 α，走向 φ）二维参数空间投票：对每个边缘点，按不同 α、φ 反算它应该落在哪条正弦上，票数最高的参数就是裂缝。</p><p>检测之后算四个属性：倾角 α、走向 φ（倾向 ±90°）、线密度（条/m）、开度（由条带宽度估算）。诱导缝用两条判据剔除：与井轴夹角接近 0°、且呈 180° 对称双正弦；钻具刮痕则是固定方位上的短竖线，不随深度连续。</p><p>除裂缝外，溶蚀孔洞在展开图上多呈近圆形暗斑或亮斑，用形态学斑点检测单独输出，按孔洞密度（个/m²）统计，避免与正弦裂缝共用一套参数。</p><p>输出不是一张图，而是「裂缝表 + 置信度 + 覆盖盲区标记」：低置信裂缝标黄，盲区不外推，密度按有效覆盖面积归一，避免覆盖率 65% 的井段被误判为「裂缝少」。</p><div class=\"figure\"><svg viewBox=\"0 0 720 250\" width=\"100%\" role=\"img\" aria-label=\"展开图到正弦检测再到倾角计算\"><rect x=\"0\" y=\"0\" width=\"720\" height=\"250\" fill=\"var(--paper-2)\" rx=\"6\"/><text x=\"18\" y=\"24\" font-size=\"11\" fill=\"var(--ink-2)\">展开图 → 正弦裂缝 → 倾角计算</text><rect x=\"18\" y=\"50\" width=\"158\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"97\" y=\"68\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">① 成像展开图</text><rect x=\"36\" y=\"76\" width=\"122\" height=\"56\" fill=\"#1f2520\"/><path d=\"M40 112 C52 92, 66 92, 78 112 S102 132, 114 112 S138 92, 152 112\" fill=\"none\" stroke=\"var(--gold)\" stroke-width=\"1.6\"/><path d=\"M40 94 L152 94\" stroke=\"var(--line-3)\" stroke-width=\".8\" stroke-dasharray=\"2 2\"/><text x=\"97\" y=\"146\" font-size=\"8.5\" fill=\"var(--ink-3)\" text-anchor=\"middle\">0—360° × 井深</text><rect x=\"246\" y=\"50\" width=\"158\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"325\" y=\"68\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">② 增强 + 正弦检测</text><rect x=\"264\" y=\"76\" width=\"122\" height=\"56\" fill=\"#1f2520\"/><path d=\"M268 112 C280 92, 294 92, 306 112 S330 132, 342 112 S366 92, 380 112\" fill=\"none\" stroke=\"var(--gold)\" stroke-width=\"1.4\"/><path d=\"M268 114 C280 94, 294 94, 306 114 S330 134, 342 114 S366 94, 380 114\" fill=\"none\" stroke=\"var(--acc)\" stroke-width=\"1\" stroke-dasharray=\"3 2\"/><text x=\"325\" y=\"146\" font-size=\"8.5\" fill=\"var(--ink-3)\" text-anchor=\"middle\">Hough 参数空间投票</text><rect x=\"474\" y=\"50\" width=\"158\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"553\" y=\"68\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">③ 属性计算</text><text x=\"490\" y=\"90\" font-size=\"9\" fill=\"var(--ink-3)\">倾角 α</text><text x=\"620\" y=\"90\" font-size=\"10\" fill=\"var(--c-cv)\" text-anchor=\"end\">42°</text><text x=\"490\" y=\"108\" font-size=\"9\" fill=\"var(--ink-3)\">走向 φ</text><text x=\"620\" y=\"108\" font-size=\"10\" fill=\"var(--c-cv)\" text-anchor=\"end\">118°</text><text x=\"490\" y=\"126\" font-size=\"9\" fill=\"var(--ink-3)\">线密度</text><text x=\"620\" y=\"126\" font-size=\"10\" fill=\"var(--c-cv)\" text-anchor=\"end\">2.6 条/m</text><path d=\"M180 98 L240 98\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\"/><path d=\"M232 94 L240 98 L232 102\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\" fill=\"none\"/><path d=\"M408 98 L468 98\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\"/><path d=\"M460 94 L468 98 L460 102\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\" fill=\"none\"/><line x1=\"18\" y1=\"166\" x2=\"702\" y2=\"166\" stroke=\"var(--line)\"/><text x=\"18\" y=\"188\" font-size=\"9\" fill=\"var(--ink-2)\">伪影剔除：诱导缝 180° 对称、走向沿最大主应力；钻具刮痕为固定方位短竖线；泥浆侵入呈宽条带</text><text x=\"18\" y=\"206\" font-size=\"9\" fill=\"var(--ink-3)\">覆盖归一：密度 = 检出条数 / 有效覆盖井段长度；盲区单独标注，不外推到全井壁</text><rect x=\"18\" y=\"216\" width=\"684\" height=\"16\" rx=\"3\" fill=\"var(--jade-l)\"/><text x=\"360\" y=\"228\" font-size=\"9\" fill=\"var(--ink-2)\" text-anchor=\"middle\">输出：裂缝表（倾角/走向/密度/开度）+ 置信度 + 盲区掩膜</text></svg><div class=\"figcap\"><b>图 2</b><span>裂缝识别链路：展开图增强后做正弦 Hough 检测，再由振幅与相位反演倾角、走向和密度</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">成像数据本身是现成的，门槛在于方位校正、人工裂缝表和伪影样本。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">电成像原始数据</span><span class=\"cl-s\">FMI/XRMI，0.0025 m 采样，64 扇区</span></span><span class=\"cl-n\">全井段，含方位</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井径与测斜校正</span><span class=\"cl-s\">井径曲线 + 测斜数据</span></span><span class=\"cl-n\">方位误差小于 2°</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">人工裂缝解释表</span><span class=\"cl-s\">至少 30 口井</span></span><span class=\"cl-n\">倾角 / 走向 / 条数 / 类型</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">伪影样本库</span><span class=\"cl-s\">诱导缝、刮痕、泥浆侵入</span></span><span class=\"cl-n\">逐条标注伪影类型</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩心裂缝标定</span><span class=\"cl-s\">3—5 口取心井</span></span><span class=\"cl-n\">验证倾角与开度</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>高</b>。算法本身不复杂，难的是<b>图像质量与真值</b>：覆盖盲区让召回率天然有上限；诱导缝和构造缝形态接近；低角度裂缝与层理混淆；井径变化会让正弦畸变，若不做井径归一，倾角会系统性偏大 3°—8°。</p><p>可落地的做法：先用 30 口井的人工裂缝表做监督，报告「召回—精确」曲线而不是单一准确率；把覆盖率作为协变量，按有效覆盖井段统计密度；低置信和盲区一律转人工。倾角误差中位数控制在 5° 以内、与人工一致率 85% 以上，才具备生产可用性。</p><p>风险：不要把「检测到的条数」直接当裂缝密度——不同井覆盖率不同；也不要用模型结果替代岩心标定，成像对开度的估计误差可达 50%。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/cv\">正弦 Hough 变换<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">各向异性滤波<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">边缘检测<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">几何参数反演<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "塔里木 XX 区块 3 口井 1,850 m 成像测井裂缝解释",
        "lead": [
          "XX 区块 3 口直井与水平井完成 FMI 成像，有效井段 1,850 m，方位 64 扇区、深度采样 0.0025 m。人工解释共 1,260 条裂缝，单井耗时 2.5 h。",
          "目标是把解释时间压到 25 min，同时把倾角误差控制在 4° 以内；覆盖盲区和诱导缝必须显式标注，不能假装没看见。"
        ],
        "stats": [
          [
            "成像井段",
            "1,850 m"
          ],
          [
            "深度采样",
            "0.0025 m"
          ],
          [
            "方位扇区",
            "64 个"
          ],
          [
            "人工解释裂缝",
            "1,260 条"
          ],
          [
            "人工耗时",
            "2.5 h / 井"
          ],
          [
            "倾角误差中位数",
            "3.1°"
          ]
        ],
        "steps": [
          {
            "name": "图像预处理与方位校正",
            "role": "数据",
            "do": "剔除坏极板（响应异常超过 3σ），按井径做灰度归一，用测斜数据校正方位；把 64 扇区重采样到 360 列，深度保持 0.0025 m 采样。",
            "effect": "展开图方位误差小于 2°，井径变化造成的正弦畸变压到 1% 以内",
            "trap": "方位接反 180° 会让所有走向反向，必须用已知地层产状或岩心核对"
          },
          {
            "name": "裂缝增强",
            "role": "特征",
            "do": "Frangi 多尺度各向异性滤波（σ=1—4 像素）加形态学闭运算，突出高导缝的暗亮条带；再做局部对比度均衡。",
            "effect": "裂缝响应信噪比提升约 6 dB，弱缝可见性明显改善",
            "trap": "层理和裂缝都会被增强，单靠响应强度分不开，必须看正弦形态"
          },
          {
            "name": "正弦 Hough 检测",
            "role": "算法核心",
            "do": "在（倾角 0—90°，走向 0—360°）空间投票，倾角步长 2°、走向步长 5°，票数阈值取全局峰值的 55%；同一参数簇内做非极大抑制，合并重叠裂缝。",
            "effect": "单条裂缝召回 91.5%，精确率 88.7%",
            "trap": "两条裂缝正弦交叉时投票峰粘连，会把两条并成一条，需按深度分段检测"
          },
          {
            "name": "伪影剔除与属性计算",
            "role": "后处理",
            "do": "诱导缝判据：与井轴夹角小于 15° 且呈 180° 对称双正弦；刮痕判据：固定方位短竖线、不连续；输出倾角、走向、线密度（条/m）与开度。",
            "effect": "假阳性率从 14% 降到 5%，密度按有效覆盖归一",
            "trap": "真实构造缝也可能 180° 对称，不能只靠对称性一票否决"
          },
          {
            "name": "人工复核与裂缝网络输出",
            "role": "质控",
            "do": "低置信（低于 0.6）裂缝标黄，盲区单独出图；输出裂缝表、倾角玫瑰图与密度曲线，供地质建模和压裂设计使用。",
            "effect": "单井解释 2.5 h → 25 min，与人工一致率 86%",
            "trap": "盲区不能外推，覆盖率 65% 的井段直接比密度会低估 20%—30%"
          }
        ],
        "metrics": {
          "title": "怎么算「识别准了」",
          "html": "<p>成像裂缝解释的评测要分三层：<b>条数</b>（召回/精确）、<b>参数</b>（倾角/走向误差）、<b>业务</b>（解释耗时与一致率）。只报一个「准确率」没有意义。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>人工解释</th><th>本方法</th></tr></thead><tbody><tr><td>裂缝召回</td><td>人工解释裂缝中被检出的比例</td><td>100%（基准）</td><td>91.5%</td></tr><tr><td>裂缝精确率</td><td>检出中被人工确认的比例</td><td>100%（基准）</td><td>88.7%</td></tr><tr><td>倾角误差</td><td>与人工及岩心对比的中位绝对误差</td><td>±5°</td><td>3.1°</td></tr><tr><td>走向误差</td><td>中位绝对误差</td><td>±10°</td><td>6.4°</td></tr><tr><td>单井解释耗时</td><td>1,850 m 全井段</td><td>2.5 h</td><td>25 min</td></tr><tr><td>与人工一致率</td><td>逐条裂缝类型与参数一致</td><td>—</td><td>86%</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "诱导缝误判",
            "why": "钻井诱导缝呈 180° 对称双正弦、走向沿最大主应力，容易被当成构造缝。需结合对称性、应力方向与开度综合判断。"
          },
          {
            "name": "低角度裂缝漏检",
            "why": "倾角小于 10° 时正弦振幅不到井径的 3%，与层理混在一起，模型召回明显下降。需提高深度分辨率并逐条人工复核。"
          },
          {
            "name": "覆盖盲区",
            "why": "覆盖率 65% 时约三分之一井壁没有数据，检出条数天然少 20%—30%。密度必须按有效覆盖归一，盲区不能外推。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "/* ========= 成像测井裂缝智能识别 · 可运行示范 ========= */\n* { box-sizing: border-box; }\n:root {\n  --bg: #ecf0e9;\n  --card: #e4e9e0;\n  --card-2: #dee4d9;\n  --line: #d1d8ca;\n  --tx: #2a2517;\n  --tx-2: #585f4f;\n  --tx-3: #838b7b;\n  --acc: #488778;\n  --gold: #a37b2f;\n  --bad: #993e30;\n  --mono: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;\n}\nbody {\n  margin: 0; padding: 10px 12px;\n  background: var(--bg); color: var(--tx);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  font-size: 12px; line-height: 1.5; -webkit-font-smoothing: antialiased;\n}\n.wrap { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\nheader { margin-bottom: 10px; }\n.eyebrow {\n  font-family: var(--mono); font-size: 10px; letter-spacing: .18em;\n  color: var(--acc); text-transform: uppercase; margin-bottom: 6px;\n}\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }\n.lead { margin: 0; max-width: 820px; font-size: 11.5px; color: var(--tx-2); }\n.card {\n  background: var(--card); border: 1px solid var(--line);\n  border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;\n}\n.card-head {\n  display: flex; align-items: center; justify-content: space-between;\n  gap: 8px; flex-wrap: wrap; margin-bottom: 4px;\n}\nh2 { font-size: 12.5px; font-weight: 600; margin: 0; }\nh2 .num {\n  font-family: var(--mono); font-size: 10px; color: var(--acc);\n  border: 1px solid rgba(72,135,120,.35); border-radius: 4px;\n  padding: 1px 5px; margin-right: 7px; letter-spacing: .08em;\n}\n.tag {\n  font-family: var(--mono); font-size: 9.5px; color: var(--gold);\n  border: 1px solid rgba(163,123,47,.35); background: rgba(163,123,47,.08);\n  border-radius: 5px; padding: 2px 6px; white-space: nowrap;\n}\n.hint { font-size: 10.5px; color: var(--tx-3); margin: 2px 0 6px; }\nsvg, canvas { max-width: 100%; height: auto; display: block; }\n#img, #curve { width: 100%; height: auto; display: block; }\n#img { background: #eef3ef; border: 1px solid var(--line); border-radius: 8px; }\n\n/* 图例 */\n.legend {\n  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;\n  margin-top: 6px; font-size: 10px; color: var(--tx-3);\n}\n.legend span { display: inline-flex; align-items: center; gap: 5px; }\n.lg-line { width: 16px; height: 2px; display: inline-block; }\n.lg-line.gold { background: var(--gold); }\n.lg-line.jade { background: repeating-linear-gradient(90deg, var(--acc) 0 4px, transparent 4px 7px); }\n.lg-box {\n  width: 13px; height: 9px; display: inline-block;\n  border: 1px dashed var(--acc); border-radius: 2px;\n}\n.lg-blind { width: 13px; height: 9px; display: inline-block; background: #f1f5f3; border: 1px solid #c9d0bf; }\n.lg-note { margin-left: auto; font-family: var(--mono); font-size: 9px; }\n\n/* 控件 */\n.ctls { display: grid; grid-template-columns: 1fr !important; gap: 6px; margin: 6px 0 2px; }\n.ctl {\n  display: flex; flex-direction: column; gap: 3px;\n  background: var(--card-2); border: 1px solid var(--line);\n  border-radius: 8px; padding: 6px 8px;\n}\n.ctl label { font-size: 11.5px; display: flex; justify-content: space-between; color: var(--tx-2); }\n.ctl output { font-family: var(--mono); color: var(--acc); font-weight: 600; }\n.ctl input[type=\"range\"] { width: 100%; accent-color: var(--acc); }\n.ctl .tip { font-size: 10px; color: var(--tx-3); line-height: 1.45; }\n\n/* 读数 */\n.readrow { display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px; }\n.read { background: var(--card-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }\n.read span { display: block; font-size: 10px; color: var(--tx-3); margin-bottom: 2px; }\n.read b { font-family: var(--mono); font-size: 15px; font-weight: 500; color: var(--acc); }\n.read b.gold { color: var(--gold); }\n.read b.bad { color: var(--bad); }\n\n/* 状态 */\n.verdict {\n  margin-top: 8px; padding: 7px 9px; border-radius: 8px;\n  font-size: 11px; border: 1px solid var(--line); background: var(--card-2); color: var(--tx-2);\n}\n.verdict b { font-size: 11.5px; margin-right: 6px; }\n.verdict.ok { border-color: rgba(72,135,120,.38); background: rgba(72,135,120,.10); color: var(--acc); }\n.verdict.ok b { color: var(--acc); }\n.verdict.bad { border-color: rgba(153,62,48,.40); background: rgba(153,62,48,.10); color: #64251c; }\n.verdict.bad b { color: var(--bad); }\n.foot { font-size: 10px; color: var(--tx-3); line-height: 1.5; margin: 4px 2px 0; }\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 成像测井裂缝智能识别 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  var state = { dip: 45, den: 2.5, cov: 85 };\n  var D0 = 3320, D1 = 3325;\n  var raf = false;\n\n  function $(id) { return document.getElementById(id); }\n  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }\n  function rnd(s) {\n    var v = Math.sin(s * 12.9898) * 43758.5453;\n    return v - Math.floor(v);\n  }\n  function errAt(dip, covFrac) {\n    var e = 2.2 + 4.6 * Math.exp(-dip / 10) + 3.6 * Math.exp(-(90 - dip) / 12);\n    return e * (1 + (1 - covFrac) * 1.6);\n  }\n  function recallAt(dip) {\n    return 0.95 - 0.22 * Math.pow((dip - 45) / 45, 2);\n  }\n\n  function fractureList() {\n    var count = Math.max(2, Math.round(state.den * (D1 - D0)));\n    var cov = state.cov / 100, rec = recallAt(state.dip), list = [];\n    for (var j = 0; j < count; j++) {\n      var seed = j * 3.717 + 1.3;\n      list.push({\n        seed: seed,\n        y0: j,\n        phase: (j * 137.508) % 360,\n        detected: rnd(seed) < cov * rec\n      });\n    }\n    return list;\n  }\n\n  function sinePath(y0, amp, phase, L, Wp) {\n    var d = '', i, x, y, t, ang;\n    for (i = 0; i <= 60; i++) {\n      t = i / 60;\n      x = L + t * Wp;\n      ang = t * Math.PI * 2 + phase * Math.PI / 180;\n      y = y0 + amp * Math.cos(ang);\n      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';\n    }\n    return d;\n  }\n\n  function axisMarkup(L, T, Wp, Hp) {\n    var s = '', i, x, y, az, dep;\n    for (i = 0; i <= 4; i++) {\n      x = L + Wp * i / 4;\n      az = i * 90;\n      s += '<line x1=\"' + x + '\" y1=\"' + T + '\" x2=\"' + x + '\" y2=\"' + (T + Hp) + '\" stroke=\"var(--line)\" stroke-width=\".7\"/>';\n      s += '<text x=\"' + x + '\" y=\"' + (T - 5) + '\" font-size=\"8\" fill=\"var(--tx-3)\" text-anchor=\"middle\">' + az + '°</text>';\n    }\n    for (i = 0; i <= 5; i++) {\n      y = T + Hp * i / 5;\n      dep = D0 + i;\n      s += '<line x1=\"' + L + '\" y1=\"' + y + '\" x2=\"' + (L + Wp) + '\" y2=\"' + y + '\" stroke=\"var(--line)\" stroke-width=\".7\"/>';\n      s += '<text x=\"' + (L - 5) + '\" y=\"' + (y + 3) + '\" font-size=\"7.5\" fill=\"var(--tx-3)\" text-anchor=\"end\">' + dep + ' m</text>';\n    }\n    s += '<text x=\"' + (L + Wp / 2) + '\" y=\"' + (T - 13) + '\" font-size=\"8\" fill=\"var(--tx-2)\" text-anchor=\"middle\">方位角 (°)</text>';\n    s += '<text x=\"' + (L - 36) + '\" y=\"' + (T + Hp / 2) + '\" font-size=\"8\" fill=\"var(--tx-2)\" text-anchor=\"middle\" transform=\"rotate(-90 ' + (L - 36) + ' ' + (T + Hp / 2) + ')\">井深 (m)</text>';\n    return s;\n  }\n\n  function fractureMarkup(L, T, Wp, Hp, list) {\n    var s = '', count = list.length, spacing = Hp / count;\n    var dipRad = state.dip * Math.PI / 180;\n    var amp = Math.min(Hp * 6, Hp * 0.30 * Math.tan(dipRad) / Math.tan(Math.PI / 3));\n    var cov = state.cov / 100;\n    list.forEach(function (f, j) {\n      var y0 = T + spacing * (j + 0.5);\n      var op = 0.55 + 0.4 * rnd(f.seed + 2.1);\n      s += '<path d=\"' + sinePath(y0, amp, f.phase, L, Wp) + '\" fill=\"none\" stroke=\"var(--gold)\" stroke-width=\"1.5\" opacity=\"' + op.toFixed(2) + '\"/>';\n      if (f.detected) {\n        var estAmp = Math.min(Hp * 6, Hp * 0.30 * Math.tan(clamp(state.dip + (rnd(f.seed + 4.4) - 0.5) * 4, 0, 89) * Math.PI / 180) / Math.tan(Math.PI / 3));\n        s += '<path d=\"' + sinePath(y0, estAmp, f.phase + (rnd(f.seed + 6.2) - 0.5) * 8, L, Wp) + '\" fill=\"none\" stroke=\"var(--acc)\" stroke-width=\"1\" stroke-dasharray=\"4 3\" opacity=\".72\"/>';\n      }\n    });\n    var boxIdx = [Math.floor(count * 0.22), Math.floor(count * 0.52), Math.floor(count * 0.8)];\n    boxIdx.forEach(function (j, k) {\n      if (j >= count || !list[j].detected) return;\n      var by = T + spacing * (j + 0.5) - 14;\n      s += '<rect x=\"' + (L + Wp * 0.34) + '\" y=\"' + by + '\" width=\"68\" height=\"28\" rx=\"3\" fill=\"none\" stroke=\"var(--acc)\" stroke-width=\"1\" stroke-dasharray=\"4 3\"/>';\n      if (k === 0) {\n        s += '<text x=\"' + (L + Wp * 0.34 + 3) + '\" y=\"' + (by - 3) + '\" font-size=\"7.5\" fill=\"var(--acc)\">检测框</text>';\n      }\n    });\n    var missed = 0;\n    list.forEach(function (f, j) {\n      if (f.detected || missed >= 2 || j % 5 !== 0) return;\n      missed += 1;\n      s += '<text x=\"' + (L + 8) + '\" y=\"' + (T + spacing * (j + 0.5) + 2.5) + '\" font-size=\"7.5\" fill=\"var(--bad)\">漏检</text>';\n    });\n    if (cov < 0.999) {\n      var x0 = L + Wp * cov;\n      s += '<rect x=\"' + x0 + '\" y=\"' + T + '\" width=\"' + (L + Wp - x0) + '\" height=\"' + Hp + '\" fill=\"#f3f7f3\" opacity=\".93\"/>';\n      for (var h = 0; h < 14; h++) {\n        s += '<line x1=\"' + (x0 + h * 5.5) + '\" y1=\"' + (T + Hp) + '\" x2=\"' + (x0 + h * 5.5 + 14) + '\" y2=\"' + (T + Hp - 14) + '\" stroke=\"#c9d0bf\" stroke-width=\".6\" opacity=\".6\"/>';\n      }\n      s += '<text x=\"' + ((x0 + L + Wp) / 2) + '\" y=\"' + (T + Hp / 2) + '\" font-size=\"8\" fill=\"var(--tx-3)\" text-anchor=\"middle\">无覆盖</text>';\n      s += '<text x=\"' + ((x0 + L + Wp) / 2) + '\" y=\"' + (T + Hp / 2 + 8) + '\" font-size=\"7.5\" fill=\"var(--tx-3)\" text-anchor=\"middle\">' + Math.round((1 - cov) * 360) + '°</text>';\n    }\n    return s;\n  }\n\n  function drawImage() {\n    var svg = $('img');\n    var W = 430, H = 243, L = 44, T = 25, Wp = 368, Hp = 197;\n    var list = fractureList();\n    var s = '<defs><clipPath id=\"plotClip\"><rect x=\"' + L + '\" y=\"' + T + '\" width=\"' + Wp + '\" height=\"' + Hp + '\"/></clipPath></defs>';\n    s += '<text x=\"10\" y=\"14\" font-size=\"8.5\" fill=\"var(--tx-2)\">电成像展开图 · 深度拉伸显示</text>';\n    s += '<text x=\"420\" y=\"14\" font-size=\"7.5\" fill=\"var(--tx-3)\" text-anchor=\"end\">方位 64 扇区 · 采样 0.0025 m</text>';\n    s += '<rect x=\"' + L + '\" y=\"' + T + '\" width=\"' + Wp + '\" height=\"' + Hp + '\" fill=\"#ebf1ed\" stroke=\"var(--line-2)\"/>';\n    var i, x, y;\n    for (i = 0; i < 150; i++) {\n      x = L + rnd(i * 1.7) * Wp;\n      y = T + rnd(i * 2.9 + 4) * Hp;\n      s += '<circle cx=\"' + x.toFixed(1) + '\" cy=\"' + y.toFixed(1) + '\" r=\"' + (0.5 + rnd(i) * 0.9).toFixed(1) + '\" fill=\"#bac9b5\" opacity=\".5\"/>';\n    }\n    for (i = 0; i < 8; i++) {\n      y = T + Hp * (0.06 + i * 0.118);\n      s += '<line x1=\"' + L + '\" y1=\"' + y + '\" x2=\"' + (L + Wp) + '\" y2=\"' + y + '\" stroke=\"#a5b19e\" stroke-width=\".7\" opacity=\".45\"/>';\n    }\n    s += axisMarkup(L, T, Wp, Hp);\n    s += '<g clip-path=\"url(#plotClip)\">' + fractureMarkup(L, T, Wp, Hp, list) + '</g>';\n    s += '<rect x=\"' + L + '\" y=\"' + T + '\" width=\"' + Wp + '\" height=\"' + Hp + '\" fill=\"none\" stroke=\"var(--line-2)\"/>';\n    s += '<text x=\"' + (L + 5) + '\" y=\"' + (T + Hp + 12) + '\" font-size=\"7.5\" fill=\"var(--tx-3)\">检出 ' + list.filter(function (f) { return f.detected; }).length + ' / ' + list.length + ' 条</text>';\n    s += '<text x=\"' + (L + Wp) + '\" y=\"' + (T + Hp + 12) + '\" font-size=\"7.5\" fill=\"var(--tx-3)\" text-anchor=\"end\">盲区 ' + Math.round((1 - state.cov / 100) * 360) + '°，密度按有效覆盖归一</text>';\n    svg.innerHTML = s;\n  }\n\n  function drawCurve() {\n    var svg = $('curve');\n    var W = 430, H = 113, L = 33, T = 17, R = 417, B = 90;\n    var pw = R - L, ph = B - T;\n    function xOf(d) { return L + d / 90 * pw; }\n    function yOf(e) { return B - clamp(e, 0, 8) / 8 * ph; }\n    var s = '<text x=\"8\" y=\"10\" font-size=\"8\" fill=\"var(--tx-3)\">倾角误差 (°)</text>';\n    var v, d;\n    for (v = 0; v <= 8.0001; v += 2) {\n      s += '<line x1=\"' + L + '\" y1=\"' + yOf(v) + '\" x2=\"' + R + '\" y2=\"' + yOf(v) + '\" stroke=\"var(--line)\"/>';\n      s += '<text x=\"' + (L - 5) + '\" y=\"' + (yOf(v) + 3) + '\" font-size=\"7.5\" fill=\"var(--tx-3)\" text-anchor=\"end\">' + v + '</text>';\n    }\n    for (d = 0; d <= 90; d += 15) {\n      s += '<text x=\"' + xOf(d) + '\" y=\"' + (B + 9) + '\" font-size=\"7.5\" fill=\"var(--tx-3)\" text-anchor=\"middle\">' + d + '</text>';\n    }\n    s += '<rect x=\"' + L + '\" y=\"' + T + '\" width=\"' + (xOf(10) - L) + '\" height=\"' + ph + '\" fill=\"var(--bad)\" opacity=\".07\"/>';\n    s += '<rect x=\"' + xOf(80) + '\" y=\"' + T + '\" width=\"' + (R - xOf(80)) + '\" height=\"' + ph + '\" fill=\"var(--bad)\" opacity=\".07\"/>';\n    s += '<text x=\"' + (xOf(5)) + '\" y=\"' + (T + 8) + '\" font-size=\"7.5\" fill=\"var(--bad)\" text-anchor=\"middle\">低角度</text>';\n    s += '<text x=\"' + (xOf(85)) + '\" y=\"' + (T + 8) + '\" font-size=\"7.5\" fill=\"var(--bad)\" text-anchor=\"middle\">近垂直</text>';\n    s += '<line x1=\"' + L + '\" y1=\"' + yOf(4) + '\" x2=\"' + R + '\" y2=\"' + yOf(4) + '\" stroke=\"var(--tx-3)\" stroke-dasharray=\"4 3\"/>';\n    s += '<text x=\"' + (L + 4) + '\" y=\"' + (yOf(4) - 3) + '\" font-size=\"7.5\" fill=\"var(--tx-3)\">可用门槛 4°</text>';\n\n    var path = '', dip;\n    for (dip = 0; dip <= 90; dip += 1) {\n      path += (dip === 0 ? 'M' : 'L') + xOf(dip).toFixed(1) + ' ' + yOf(errAt(dip, state.cov / 100)).toFixed(1) + ' ';\n    }\n    s += '<path d=\"' + path + '\" fill=\"none\" stroke=\"var(--acc)\" stroke-width=\"2\"/>';\n    var e = errAt(state.dip, state.cov / 100);\n    s += '<line x1=\"' + xOf(state.dip) + '\" y1=\"' + T + '\" x2=\"' + xOf(state.dip) + '\" y2=\"' + B + '\" stroke=\"var(--tx-3)\" stroke-dasharray=\"3 3\" opacity=\".7\"/>';\n    s += '<circle cx=\"' + xOf(state.dip) + '\" cy=\"' + yOf(e) + '\" r=\"3.5\" fill=\"var(--acc)\" stroke=\"var(--card)\" stroke-width=\"2\"/>';\n    s += '<text x=\"' + (xOf(state.dip) + 5) + '\" y=\"' + (yOf(e) - 5) + '\" font-size=\"7.5\" fill=\"var(--acc)\" font-family=\"var(--mono)\">±' + e.toFixed(1) + '°</text>';\n    s += '<text x=\"' + ((L + R) / 2) + '\" y=\"' + (H - 4) + '\" font-size=\"8\" fill=\"var(--tx-3)\" text-anchor=\"middle\">真实倾角 (°)</text>';\n    svg.innerHTML = s;\n  }\n\n  function updateReads() {\n    var list = fractureList();\n    var det = list.filter(function (f) { return f.detected; }).length;\n    var err = errAt(state.dip, state.cov / 100);\n    var agr = clamp(100 - err * 3.8 - (1 - state.cov / 100) * 35 - (state.dip < 12 ? 4 : 0), 40, 98);\n    var ok = agr >= 82 && err <= 4;\n\n    $('r-num').textContent = det + ' 条';\n    $('r-err').textContent = '±' + err.toFixed(1) + '°';\n    $('r-agr').textContent = agr.toFixed(1) + '%';\n    $('r-cov').textContent = state.cov + '%';\n    $('r-err').className = err > 6 ? 'bad' : (err > 4 ? 'gold' : '');\n    $('r-agr').className = agr < 82 ? 'bad' : '';\n    $('r-cov').className = state.cov < 70 ? 'gold' : '';\n    $('cov-tag').textContent = '井壁覆盖 ' + state.cov + '%';\n    $('curve-tag').textContent = '覆盖率 ' + state.cov + '%';\n\n    var v = $('verdict');\n    v.className = 'verdict ' + (ok ? 'ok' : 'bad');\n    v.innerHTML = ok\n      ? '<b>可用</b>倾角误差 ±' + err.toFixed(1) + '°、与人工解释一致率 ' + agr.toFixed(1) +\n        '%，满足生产门限；' + Math.round((1 - state.cov / 100) * 360) + '° 盲区已单独标注，密度按有效覆盖归一。'\n      : '<b>需复核</b>倾角误差 ±' + err.toFixed(1) + '°、一致率 ' + agr.toFixed(1) +\n        '%；' + (state.cov < 80 ? '井壁覆盖不足，盲区外推风险高；' : '') +\n        (state.dip < 12 || state.dip > 80 ? '近水平或近垂直裂缝的正弦拟合不稳定；' : '') +\n        '建议逐条人工确认后再用于裂缝建模。';\n  }\n\n  function render() {\n    drawImage();\n    drawCurve();\n    updateReads();\n  }\n\n  function schedule() {\n    if (raf) return;\n    raf = true;\n    requestAnimationFrame(function () { raf = false; render(); });\n  }\n\n  function bind() {\n    $('s-dip').addEventListener('input', function (e) {\n      state.dip = +e.target.value;\n      $('o-dip').textContent = state.dip + '°';\n      schedule();\n    });\n    $('s-den').addEventListener('input', function (e) {\n      state.den = +e.target.value;\n      $('o-den').textContent = state.den.toFixed(1) + ' 条/m';\n      schedule();\n    });\n    $('s-cov').addEventListener('input', function (e) {\n      state.cov = +e.target.value;\n      $('o-cov').textContent = state.cov + '%';\n      schedule();\n    });\n  }\n\n  bind();\n  render();\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：成像测井裂缝智能识别</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"wrap\">\n  <header>\n    <div class=\"eyebrow\">W3 · 测井 · 计算机视觉</div>\n    <h1>成像测井裂缝智能识别</h1>\n    <p class=\"lead\">深色底是电成像展开图，横轴方位角 0—360°，纵轴井深。亮条纹是裂缝响应，倾斜裂缝在展开图上呈正弦。拖动倾角与密度，看正弦形态怎么变，自动检测线、倾角误差和人工一致率如何同步变化。</p>\n  </header>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">01</span>成像展开图与正弦裂缝</h2>\n          <span class=\"tag\" id=\"depth-tag\">3320—3325 m · 井径 0.20 m · 64 扇区</span>\n        </div>\n        <p class=\"hint\">深度方向做了拉伸显示，便于观察正弦形态；右侧灰色区域为极板覆盖盲区。金色实线为成像裂缝响应，青色虚线为自动检测的拟合正弦。</p>\n        <svg id=\"img\" viewBox=\"0 0 430 243\" role=\"img\" aria-label=\"成像测井展开图与裂缝检测\"></svg>\n        <div class=\"legend\">\n          <span><i class=\"lg-line gold\"></i>裂缝响应（成像）</span>\n          <span><i class=\"lg-line jade\"></i>自动检测拟合</span>\n          <span><i class=\"lg-box\"></i>检测框</span>\n          <span><i class=\"lg-blind\"></i>无覆盖盲区</span>\n          <span class=\"lg-note\">方位角 0°—360°，井深 3320—3325 m</span>\n        </div>\n      </section>\n\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">03</span>倾角估计误差随真实倾角的变化</h2>\n          <span class=\"tag\" id=\"curve-tag\">覆盖率 85%</span>\n        </div>\n        <p class=\"hint\">近水平（&lt;10°）与近垂直（&gt;80°）裂缝的正弦振幅过小或过大，拟合误差显著上升；虚线为 4° 可用门槛。</p>\n        <svg id=\"curve\" viewBox=\"0 0 430 113\" role=\"img\" aria-label=\"倾角估计误差曲线\"></svg>\n      </section>\n    </div>\n\n    <div class=\"side\">\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">02</span>检测参数与读数</h2>\n          <span class=\"tag\" id=\"cov-tag\">井壁覆盖 85%</span>\n        </div>\n        <div class=\"ctls\">\n          <div class=\"ctl\">\n            <label>裂缝倾角 α <output id=\"o-dip\">45°</output></label>\n            <input type=\"range\" id=\"s-dip\" min=\"0\" max=\"90\" step=\"1\" value=\"45\">\n            <span class=\"tip\">0° = 水平缝，90° = 垂直缝；低角度与层理最难分</span>\n          </div>\n          <div class=\"ctl\">\n            <label>裂缝线密度 <output id=\"o-den\">2.5 条/m</output></label>\n            <input type=\"range\" id=\"s-den\" min=\"0.5\" max=\"5\" step=\"0.1\" value=\"2.5\">\n            <span class=\"tip\">每米井段的裂缝条数，5 m 窗口约 13 条</span>\n          </div>\n          <div class=\"ctl\">\n            <label>井壁覆盖率 <output id=\"o-cov\">85%</output></label>\n            <input type=\"range\" id=\"s-cov\" min=\"55\" max=\"100\" step=\"1\" value=\"85\">\n            <span class=\"tip\">极板贴壁比例；覆盖率越低，盲区越大、一致率越低</span>\n          </div>\n        </div>\n        <div class=\"readrow\">\n          <div class=\"read\"><span>检出裂缝</span><b id=\"r-num\">—</b></div>\n          <div class=\"read\"><span>倾角估计误差</span><b id=\"r-err\">—</b></div>\n          <div class=\"read\"><span>与人工解释一致率</span><b id=\"r-agr\">—</b></div>\n          <div class=\"read\"><span>有效覆盖</span><b id=\"r-cov\">—</b></div>\n        </div>\n        <div class=\"verdict\" id=\"verdict\">—</div>\n      </section>\n    </div>\n  </div>\n\n  <p class=\"foot\">示意展开图与检测结果由前端实时生成，用于说明参数关系，不代表任何单一成像仪器的实测精度。真实解释还需方位校正、井径归一、诱导缝剔除与岩心标定。</p>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动倾角、密度和井壁覆盖率，实时重绘成像展开图与正弦裂缝；自动检测线、倾角误差和一致率会同步更新。",
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
