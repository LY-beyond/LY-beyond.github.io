/* =========================================================
   案例插件（静态注册版）：岩屑岩性细粒度自动识别
   ---------------------------------------------------------
   由 cases/m1-cuttings-lithology/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "m1-cuttings-lithology",
    "sceneId": "m1",
    "methods": [
      "cv"
    ],
    "title": "岩屑岩性细粒度自动识别",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "岩屑是钻井过程中最连续的地层实物证据，每 1 m 一包、单井 2,000—3,000 包。人工在显微镜下逐包描述要 5—8 h，而颗粒只有 1—5 mm，还常被油膜与泥饼包裹。把这一步做成细粒度图像分类，能同时提升描述频次和一致性。",
        "judge": [
          {
            "label": "任务类型",
            "value": "细粒度图像分类",
            "desc": "5 大类 + 过渡岩性，颗粒级到样品级"
          },
          {
            "label": "标注成本",
            "value": "高",
            "desc": "需颗粒级岩性标签，少数类样本稀缺"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "单井描述 6.5 h 压缩到 25 min"
          },
          {
            "label": "难度",
            "value": "高",
            "desc": "类间差异小、油污遮挡、类别极不均衡"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>岩屑录井是现场最连续的地层实物资料：每钻进 1 m 从振动筛捞取一包岩屑，洗样、烘干后在地质显微镜下描述颜色、成分、粒度、分选、胶结与含油荧光。一口 3,000 m 的井约有 2,500—3,000 包样品，人工描述需要 5—8 h，而且必须跟着钻头进度连夜完成。</p><p>难点首先在「小」和「脏」：颗粒粒径通常 1—5 mm，PDC 钻头剪切后多呈棱角状；油基钻井液会在表面形成 0.1—0.5 mm 的油膜，泥饼和堵漏材料（碳酸钙、核桃壳）混入后，颜色与纹理被完全遮蔽。</p><p>第二个难点是「归位」：岩屑从井底返到地面需要 30—60 min，5,000 m 深井可达 90 min，迟到时间随井深、排量与井径变化。若按捞样时刻直接记深，岩性柱会整体错位 10—30 m，薄储层可能被划到错误层段。</p><p>第三是「不均衡」：区块统计砂岩约 52%、泥岩 31%、灰岩 9%、白云岩 3%、过渡岩性 5%。白云岩样本少、又与灰岩纹理接近，人工描述的一致性 Kappa 只有 0.62—0.71。</p><div class=\"figure\"><svg viewBox=\"0 0 720 260\" width=\"100%\" role=\"img\" aria-label=\"岩屑迟到时间造成井深错位\"><rect x=\"0\" y=\"0\" width=\"720\" height=\"260\" fill=\"var(--paper-2)\" rx=\"6\"/><text x=\"20\" y=\"24\" font-size=\"11\" fill=\"var(--ink-2)\">图 A · 钻头破碎到振动筛捞样，存在 30—60 min 迟到时间</text><rect x=\"96\" y=\"46\" width=\"84\" height=\"186\" rx=\"10\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"138\" y=\"62\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">井筒</text><path d=\"M120 200 L120 96\" stroke=\"var(--c-cv)\" stroke-width=\"2\" fill=\"none\"/><path d=\"M114 108 L120 96 L126 108\" stroke=\"var(--c-cv)\" stroke-width=\"2\" fill=\"none\"/><text x=\"128\" y=\"152\" font-size=\"9\" fill=\"var(--ink-3)\">上返 0.6—1.0 m/s</text><circle cx=\"110\" cy=\"184\" r=\"3\" fill=\"var(--clay)\"/><circle cx=\"124\" cy=\"166\" r=\"2.5\" fill=\"var(--clay)\"/><circle cx=\"114\" cy=\"142\" r=\"3\" fill=\"var(--clay)\"/><circle cx=\"128\" cy=\"120\" r=\"2.5\" fill=\"var(--clay)\"/><path d=\"M108 206 L168 206 L138 222 Z\" fill=\"var(--ink-3)\"/><text x=\"138\" y=\"240\" font-size=\"9\" fill=\"var(--ink-2)\" text-anchor=\"middle\">钻头 2,850 m</text><rect x=\"200\" y=\"70\" width=\"76\" height=\"34\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><path d=\"M206 78 L270 78 M206 86 L270 86 M206 94 L270 94\" stroke=\"var(--ink-4)\" stroke-width=\"1\"/><text x=\"238\" y=\"64\" font-size=\"9\" fill=\"var(--ink-2)\" text-anchor=\"middle\">振动筛捞样</text><text x=\"238\" y=\"118\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">每 1 m 一包</text><path d=\"M180 152 C205 142 216 112 226 104\" stroke=\"var(--clay)\" stroke-width=\"1.4\" fill=\"none\" stroke-dasharray=\"4 3\"/><text x=\"196\" y=\"170\" font-size=\"9\" fill=\"var(--clay)\">岩屑</text><rect x=\"330\" y=\"44\" width=\"370\" height=\"186\" rx=\"4\" fill=\"var(--card-soft)\" stroke=\"var(--line)\"/><text x=\"344\" y=\"62\" font-size=\"9\" fill=\"var(--ink-3)\">井深对比（同一包岩屑）</text><line x1=\"515\" y1=\"76\" x2=\"515\" y2=\"204\" stroke=\"var(--line-3)\" stroke-width=\"2\"/><line x1=\"500\" y1=\"112\" x2=\"530\" y2=\"112\" stroke=\"var(--clay)\" stroke-width=\"2\"/><text x=\"496\" y=\"116\" font-size=\"9\" fill=\"var(--ink-2)\" text-anchor=\"end\">捞样记录 2,850 m</text><line x1=\"500\" y1=\"160\" x2=\"530\" y2=\"160\" stroke=\"var(--bad)\" stroke-width=\"2\"/><text x=\"540\" y=\"164\" font-size=\"9\" fill=\"var(--bad)\">真实层位 2,864 m</text><path d=\"M562 120 L562 152\" stroke=\"var(--bad)\" stroke-width=\"1.2\" stroke-dasharray=\"3 2\"/><path d=\"M558 126 L562 118 L566 126\" stroke=\"var(--bad)\" stroke-width=\"1.2\" fill=\"none\"/><path d=\"M558 146 L562 154 L566 146\" stroke=\"var(--bad)\" stroke-width=\"1.2\" fill=\"none\"/><text x=\"572\" y=\"140\" font-size=\"9\" fill=\"var(--bad)\">错位 14 m</text><text x=\"344\" y=\"212\" font-size=\"9\" fill=\"var(--ink-3)\">迟到 38 min × 钻速 22 m/h ≈ 14 m；岩性柱整体上移</text></svg><div class=\"figcap\"><b>图 1</b><span>岩屑迟到时间造成的井深错位：捞样时刻的井深与岩屑真实层位不是同一个深度</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>把问题定义为「颗粒级细粒度分类 + 样品级投票」：输入每包 20—30 颗粒的 40× 显微图像（2048×1536，白光与偏振光各一张），先做白平衡、背景分割和颗粒实例分割，裁成 256×256 小图；主干用 ConvNeXt-T 或 ResNet-50，输出 5 大类 + 4 类过渡岩性（砂质泥岩、灰质泥岩、泥质灰岩、白云质灰岩）的概率。</p><p>单颗粒不可靠，所以一包 30—80 颗粒做概率加权投票，再沿井深做 3—5 包平滑；置信度低于 0.65 的样品标红交地质员复核。迟到时间用示踪法每 200 m 实测一次并插值，把捞样时刻映射回真实井深后，才写入岩性柱。</p><p>模型不替代地质认识：它的价值是把「逐包肉眼描述」变成「全井连续概率 + 少量复核」，让地质员把时间花在油气显示、断层和储层边界这些真正需要判断的地方。训练用类别平衡 focal loss，按井划分训练/验证集，避免同包颗粒泄漏。</p><div class=\"figure\"><svg viewBox=\"0 0 720 240\" width=\"100%\" role=\"img\" aria-label=\"岩屑返出到细粒度分类流程\"><rect x=\"0\" y=\"0\" width=\"720\" height=\"240\" fill=\"var(--paper-2)\" rx=\"6\"/><text x=\"20\" y=\"24\" font-size=\"11\" fill=\"var(--ink-2)\">从振动筛到岩性柱：岩屑返出 → 图像采集 → 细粒度分类</text><rect x=\"24\" y=\"48\" width=\"190\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"119\" y=\"70\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">① 岩屑返出</text><path d=\"M46 86 L178 86 M46 96 L178 96 M46 106 L178 106\" stroke=\"var(--ink-4)\" stroke-width=\"1\"/><circle cx=\"60\" cy=\"86\" r=\"3\" fill=\"var(--clay)\"/><circle cx=\"84\" cy=\"96\" r=\"2.5\" fill=\"var(--clay)\"/><circle cx=\"110\" cy=\"86\" r=\"3.5\" fill=\"var(--clay)\"/><circle cx=\"136\" cy=\"96\" r=\"2\" fill=\"var(--clay)\"/><circle cx=\"160\" cy=\"86\" r=\"3\" fill=\"var(--clay)\"/><text x=\"119\" y=\"126\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">振动筛 · 1 m/包 · 1—5 mm</text><text x=\"119\" y=\"138\" font-size=\"9\" fill=\"var(--clay)\" text-anchor=\"middle\">油污 / 泥饼包裹</text><rect x=\"264\" y=\"48\" width=\"190\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"359\" y=\"70\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">② 图像采集</text><rect x=\"326\" y=\"82\" width=\"48\" height=\"30\" rx=\"3\" fill=\"var(--ink-3)\"/><circle cx=\"350\" cy=\"97\" r=\"9\" fill=\"var(--card-soft)\" stroke=\"var(--ink-2)\"/><circle cx=\"350\" cy=\"97\" r=\"4\" fill=\"var(--c-cv)\"/><path d=\"M380 82 L390 74 L390 120 L380 112\" fill=\"none\" stroke=\"var(--ink-3)\" stroke-width=\"2\"/><text x=\"359\" y=\"126\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">40× 显微 · 2048×1536</text><text x=\"359\" y=\"138\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">白光 + 偏振光</text><rect x=\"504\" y=\"48\" width=\"190\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"599\" y=\"70\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">③ 细粒度分类</text><rect x=\"528\" y=\"82\" width=\"96\" height=\"9\" rx=\"2\" fill=\"var(--line-2)\"/><rect x=\"528\" y=\"82\" width=\"62\" height=\"9\" rx=\"2\" fill=\"var(--c-cv)\"/><text x=\"630\" y=\"90\" font-size=\"9\" fill=\"var(--ink-3)\">砂岩 64%</text><rect x=\"528\" y=\"97\" width=\"96\" height=\"9\" rx=\"2\" fill=\"var(--line-2)\"/><rect x=\"528\" y=\"97\" width=\"26\" height=\"9\" rx=\"2\" fill=\"var(--clay)\"/><text x=\"630\" y=\"105\" font-size=\"9\" fill=\"var(--ink-3)\">泥岩 27%</text><rect x=\"528\" y=\"112\" width=\"96\" height=\"9\" rx=\"2\" fill=\"var(--line-2)\"/><rect x=\"528\" y=\"112\" width=\"8\" height=\"9\" rx=\"2\" fill=\"var(--ink-4)\"/><text x=\"630\" y=\"120\" font-size=\"9\" fill=\"var(--ink-4)\">过渡 9%</text><text x=\"599\" y=\"138\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">5 类 + 过渡 · top-5 概率</text><path d=\"M216 96 L258 96\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\"/><path d=\"M250 92 L258 96 L250 100\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\" fill=\"none\"/><path d=\"M456 96 L498 96\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\"/><path d=\"M490 92 L498 96 L490 100\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\" fill=\"none\"/><text x=\"20\" y=\"184\" font-size=\"9\" fill=\"var(--ink-2)\">① 一包取 20—30 颗粒　② 颗粒实例分割后逐颗推理　③ 30—80 颗概率加权投票 → 样品级岩性</text><text x=\"20\" y=\"202\" font-size=\"9\" fill=\"var(--ink-3)\">关键前置：用示踪法实测迟到时间，把捞样时刻映射回真实井深；否则再准的分类也会写错层位</text><rect x=\"20\" y=\"214\" width=\"680\" height=\"14\" rx=\"3\" fill=\"var(--jade-l)\"/><text x=\"360\" y=\"224\" font-size=\"9\" fill=\"var(--ink-2)\" text-anchor=\"middle\">输出：岩性柱 + 每包置信度；置信度 &lt; 0.65 转人工复核</text></svg><div class=\"figcap\"><b>图 2</b><span>岩屑自动描述的处理链：返出、显微采集、颗粒级分类、样品级投票，最后与迟到时间对齐写入岩性柱</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">岩屑图像不难采，难在标签体系与井深对齐。先对着这张清单打勾：</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩屑显微图像库</span><span class=\"cl-s\">≥ 25,000 张，40×/100×，8—10 口井</span></span><span class=\"cl-n\">颗粒级岩性标签</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩性标签体系</span><span class=\"cl-s\">5 大类 + 4 类过渡岩性</span></span><span class=\"cl-n\">双人背靠背 + 第三人仲裁</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">迟到时间对照表</span><span class=\"cl-s\">每 100—200 m 一个实测点</span></span><span class=\"cl-n\">与捞样记录逐包对应</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">钻井液与污染记录</span><span class=\"cl-s\">油基/水基、混油、堵漏材料</span></span><span class=\"cl-n\">标记油膜与泥饼样本</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">现场采集设备</span><span class=\"cl-s\">防爆相机 + 环形光源，≥ 1,200 万像素</span></span><span class=\"cl-n\">固定白平衡与照度</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>高</b>。核心不是网络结构，而是<b>标签与域偏移</b>：灰岩与白云岩在显微图像上只差在晶体自形程度和白云石含量，往往要靠薄片或茜素红染色确认；油膜、泥饼、堵漏材料会造成系统性误判；不同区块的钻头类型、钻井液体系和返出速度都会改变颗粒形态。</p><p>可行路径是「小样本 + 人机协同」：先用 8—10 口井、2.5 万张颗粒图建立基线，宏平均 F1 做到 0.80 以上再上线；线上只自动通过高置信样品，低置信转人工，人工纠错每周回灌。评估必须看<b>少数类召回</b>和<b>井深段一致率</b>，只看总体准确率会被 52% 的砂岩样本掩盖问题。</p><p>风险提示：岩屑经过钻头研磨，原始结构已被破坏，某些岩性（如泥质白云岩）无法单靠岩屑定名。模型输出应写成「岩性概率 + 建议定名」，最终定名权仍在地质员。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/cv\">细粒度分类<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">实例分割<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">类别不平衡<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/cv\">迁移学习<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "松辽盆地 XX 区块 12 口探井的岩屑自动描述",
        "lead": [
          "松辽盆地 XX 区块 12 口探井，设计井深 2,600—3,100 m，岩屑录井间距 1 m，共 2,860 包样品。2025 年完成 8 口井的颗粒级图像采集，2026 年在一个新井组上试运行自动描述。",
          "现场最关心两件事：白云岩和过渡岩性这类少数类能不能检出来；迟到时间校正后，岩性柱能不能和测井曲线对上。下面的流程围绕这两件事展开。"
        ],
        "stats": [
          [
            "井深",
            "2,850 m"
          ],
          [
            "捞样间距",
            "1 m / 包"
          ],
          [
            "岩屑样品",
            "2,860 包"
          ],
          [
            "颗粒图像",
            "26,400 张（78 万颗粒）"
          ],
          [
            "人工描述耗时",
            "6.5 h / 井"
          ],
          [
            "自动描述耗时",
            "25 min / 井（含复核）"
          ]
        ],
        "steps": [
          {
            "name": "颗粒图像采集与预处理",
            "role": "数据",
            "do": "每包取 20—30 颗粒，40× 显微白光与偏振光各拍一张，分辨率 2048×1536；做白平衡、背景分割和颗粒实例分割，裁成 256×256 小图，剔除小于 0.5 mm 的碎屑。",
            "effect": "得到 78 万张尺寸统一的颗粒图，油膜反光样本单独打标",
            "trap": "环形光直射会让油膜产生镜面高光，必须加偏振片或漫射板，否则表面纹理被完全吃掉"
          },
          {
            "name": "迟到时间标定与井深对齐",
            "role": "预处理",
            "do": "用示踪法每 200 m 实测一次迟到时间（投入 2 mm 塑料示踪粒，振动筛处计时），线性插值到 1 m；再按泵冲、排量、井径实时修正，把捞样时刻映射回真实井深。",
            "effect": "岩屑归位误差从 ±18 m 降到 ±2.5 m",
            "trap": "停泵、起下钻、堵漏会打乱迟到时间，必须按班次重新标定，不能沿用上一个班的值"
          },
          {
            "name": "细粒度分类模型训练",
            "role": "算法核心",
            "do": "ConvNeXt-T 迁移学习，5 大类 + 4 类过渡岩性，类别平衡 focal loss（γ=2），按井划分训练/验证集；推理时用翻转与亮度扰动做 TTA。",
            "effect": "验证集宏平均 F1 0.84，白云岩召回 0.71",
            "trap": "按图像随机划分会让同包颗粒同时进训练集和验证集，指标虚高 8—12 个百分点"
          },
          {
            "name": "颗粒投票与井深段聚合",
            "role": "后处理",
            "do": "一包 30—80 颗粒按 top-5 概率加权投票，再沿井深做 3—5 包滑动平滑；只有连续 5 包同类的段才写入岩性柱，短于 0.5 m 的薄层单独标记。",
            "effect": "样品级准确率 88.6%，岩性柱与测井曲线吻合率 91%",
            "trap": "平滑窗太宽会把 0.3—0.5 m 的薄储层抹掉，太窄又会把单颗粒噪声写进柱子"
          },
          {
            "name": "现场闭环与人工复核",
            "role": "质控",
            "do": "输出岩性柱与每包置信度，低于 0.65 的样品标红交地质员复核（约占 12%—15%）；每周把人工纠错样本回灌训练集，按月检查少数类召回是否漂移。",
            "effect": "描述耗时 6.5 h → 25 min，复核工作量控制在 1.5 h 以内",
            "trap": "只训练不更新，换钻头或换钻井液体系后准确率会掉 5—8 个百分点"
          }
        ],
        "metrics": {
          "title": "怎么算「识别对了」",
          "html": "<p>岩性描述没有绝对真值，只有「与专家组定名一致」。因此要同时看<b>样品级准确率</b>、<b>宏平均 F1</b> 和<b>少数类召回</b>；业务上还要看岩性柱与测井曲线的吻合程度。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>人工描述</th><th>本方法</th></tr></thead><tbody><tr><td>样品级准确率</td><td>与地质员最终定名一致</td><td>100%（基准）</td><td>88.6%</td></tr><tr><td>宏平均 F1</td><td>5 大类等权平均</td><td>—</td><td>0.84</td></tr><tr><td>白云岩召回</td><td>少数类被正确检出的比例</td><td>0.62</td><td>0.71</td></tr><tr><td>单井描述耗时</td><td>2,860 包全流程</td><td>6.5 h</td><td>25 min（含复核）</td></tr><tr><td>描述一致性</td><td>与专家组的 Kappa</td><td>0.68</td><td>0.83</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "油基钻井液油膜误判",
            "why": "油膜把颗粒表面纹理抹平，砂岩容易被判成泥岩。需要偏振光与洗样前后对照，并在训练集中保留油膜样本。"
          },
          {
            "name": "迟到时间跳变",
            "why": "停泵 20 min 后迟到时间增加约 6 min，整包岩屑上移 15 m，岩性柱出现假薄层。必须按泵冲实时重算并重新对齐。"
          },
          {
            "name": "过渡岩性被硬分",
            "why": "砂质泥岩处在砂岩与泥岩边界，模型强行归到泥岩，储层被漏掉。应保留过渡类并输出混合比例，而不是二选一。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "/* ========= 岩屑岩性细粒度识别 · 可运行示范 ========= */\n* { box-sizing: border-box; }\n:root {\n  --bg: #12160f;\n  --card: #1a1f16;\n  --card-2: #20261b;\n  --line: #2e3527;\n  --tx: #e8e3d5;\n  --tx-2: #a9b0a0;\n  --tx-3: #7c8474;\n  --acc: #78b7a8;\n  --gold: #d0a85c;\n  --bad: #cf7466;\n  --violet: #a99ac9;\n  --blue: #7fa7cf;\n  --clay: #c98d5e;\n  --mono: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;\n}\nbody {\n  margin: 0;\n  padding: 10px 12px;\n  background: var(--bg);\n  color: var(--tx);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  font-size: 12px;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n.wrap { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0,1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\nheader { margin-bottom: 10px; }\n.eyebrow {\n  font-family: var(--mono); font-size: 9px; letter-spacing: .18em;\n  color: var(--acc); text-transform: uppercase; margin-bottom: 4px;\n}\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; letter-spacing: .01em; }\n.lead { margin: 0; max-width: 780px; font-size: 11.5px; color: var(--tx-2); }\n.card {\n  background: var(--card); border: 1px solid var(--line);\n  border-radius: 9px; padding: 8px 10px; margin-bottom: 8px;\n}\n.card-head {\n  display: flex; align-items: center; justify-content: space-between;\n  gap: 8px; flex-wrap: wrap; margin-bottom: 4px;\n}\nh2 { font-size: 12.5px; font-weight: 600; margin: 0; color: var(--tx); }\nh2 .num {\n  font-family: var(--mono); font-size: 9px; color: var(--acc);\n  border: 1px solid rgba(120,183,168,.35); border-radius: 4px;\n  padding: 1px 4px; margin-right: 6px; letter-spacing: .08em;\n}\n.hint { font-size: 10.5px; color: var(--tx-3); margin: 3px 0 6px; }\n.grid2 { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: start; }\n@media (max-width: 780px) { .grid2 { grid-template-columns: 1fr; } }\n\n/* 标签页 */\n.tabs { display: flex; gap: 5px; flex-wrap: wrap; }\n.tab {\n  background: transparent; border: 1px solid var(--line); color: var(--tx-2);\n  font-size: 10.5px; padding: 3px 8px; border-radius: 99px; cursor: pointer;\n  transition: border-color .15s, color .15s, background .15s;\n}\n.tab:hover { border-color: var(--tx-3); color: var(--tx); }\n.tab.on { border-color: var(--acc); color: var(--acc); background: rgba(120,183,168,.12); }\n\n/* 样本 */\n#samples, #probs, #curve { width: 100%; max-width: 100%; height: auto; display: block; }\n#samples { background: #0e130d; border: 1px solid var(--line); border-radius: 8px; }\n.particle { cursor: pointer; }\n.particle circle { transition: stroke .15s; }\n\n/* 滑杆 */\n.ctl { display: flex; flex-direction: column; gap: 4px; margin: 0; max-width: none; }\n.side .ctl {\n  background: var(--card); border: 1px solid var(--line);\n  border-radius: 9px; padding: 8px 10px;\n}\n.ctl label { font-size: 11.5px; display: flex; justify-content: space-between; color: var(--tx-2); }\n.ctl output { font-family: var(--mono); color: var(--acc); font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: var(--acc); width: 100%; }\n.ctl .tip { font-size: 10px; color: var(--tx-3); }\n\n/* 读数 */\n.readrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }\n@media (max-width: 680px) { .readrow { grid-template-columns: 1fr; } }\n.read {\n  background: var(--card-2); border: 1px solid var(--line);\n  border-radius: 8px; padding: 6px 9px;\n}\n.read span { display: block; font-size: 9.5px; color: var(--tx-3); margin-bottom: 2px; }\n.read b { font-family: var(--mono); font-size: 15px; font-weight: 500; color: var(--acc); }\n.read b.warn { color: var(--gold); }\n.read b.bad { color: var(--bad); }\n\n/* 状态 */\n.verdict {\n  margin-top: 8px; padding: 7px 10px; border-radius: 7px;\n  font-size: 11.5px; border: 1px solid var(--line); background: var(--card-2); color: var(--tx-2);\n}\n.verdict b { font-size: 12px; margin-right: 6px; }\n.verdict.ok { border-color: rgba(120,183,168,.38); background: rgba(120,183,168,.10); color: var(--acc); }\n.verdict.ok b { color: var(--acc); }\n.verdict.bad { border-color: rgba(207,116,102,.40); background: rgba(207,116,102,.10); color: #e3a49b; }\n.verdict.bad b { color: var(--bad); }\n.tag {\n  font-family: var(--mono); font-size: 9.5px; color: var(--gold);\n  border: 1px solid rgba(208,168,92,.35); background: rgba(208,168,92,.08);\n  border-radius: 5px; padding: 2px 6px; white-space: nowrap;\n}\n.foot { font-size: 10px; color: var(--tx-3); line-height: 1.6; margin: 4px 2px 0; }\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 岩屑岩性细粒度识别 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  var CLASSES = [\n    { name: '砂岩', color: 'var(--clay)' },\n    { name: '泥岩', color: 'var(--violet)' },\n    { name: '灰岩', color: 'var(--blue)' },\n    { name: '白云岩', color: 'var(--acc)' },\n    { name: '过渡岩性', color: 'var(--gold)' }\n  ];\n  var FILL = ['#b9a179', '#87906f', '#a3aeae', '#cfccb8', '#a3a06a'];\n  var EDGE = ['#d8c49b', '#aab393', '#c3cdcd', '#e8e5d2', '#c4c189'];\n\n  var GROUP_DEF = [\n    { key: 'A', name: '细砂岩', classes: [0, 0, 0, 0, 4, 0, 1, 0], hard: 0.25, pair: [0, 4] },\n    { key: 'B', name: '灰质泥岩', classes: [1, 1, 4, 1, 2, 1, 4, 1], hard: 0.30, pair: [1, 4] },\n    { key: 'C', name: '白云岩', classes: [3, 2, 3, 3, 2, 3, 4, 3], hard: 0.38, pair: [2, 3] }\n  ];\n\n  var state = { g: 0, i: 0, n: 800 };\n  var groups = [];\n  var raf = false;\n\n  function $(id) { return document.getElementById(id); }\n  function rnd(s) {\n    var v = Math.sin(s * 12.9898) * 43758.5453;\n    return v - Math.floor(v);\n  }\n  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }\n\n  function buildGroups() {\n    GROUP_DEF.forEach(function (def, gi) {\n      var list = [];\n      for (var i = 0; i < 8; i++) {\n        var seed = gi * 100 + i * 7.13 + 3.7;\n        var r = rnd(seed);\n        list.push({\n          seed: seed,\n          trueCls: def.classes[i],\n          confused: def.pair[1] === def.classes[i] ? def.pair[0] : def.pair[1],\n          size: 23 + r * 9,\n          sides: 5 + Math.floor(rnd(seed + 1.9) * 3),\n          rot: rnd(seed + 4.4) * 180,\n          oil: rnd(seed + 8.2) > 0.55 ? '中' : '轻',\n          mm: (1.4 + r * 2.6).toFixed(1)\n        });\n      }\n      groups.push({ def: def, parts: list });\n    });\n  }\n\n  function metricsFor(n, g) {\n    var acc = 0.50 + 0.37 * (1 - Math.exp(-n / 900)) - GROUP_DEF[g].hard * 0.02;\n    var minor = acc - 0.17 - 0.08 * Math.exp(-n / 700);\n    return { acc: clamp(acc, 0.05, 0.965), minor: clamp(minor, 0.03, 0.95) };\n  }\n\n  function probsFor(p, n) {\n    var conf = 0.30 + 0.55 * (1 - Math.exp(-n / 1200));\n    var diff = GROUP_DEF[state.g].hard;\n    var w = [0.09, 0.09, 0.09, 0.09, 0.09];\n    w[p.trueCls] = 0.35 + 0.62 * conf - diff * 0.16;\n    w[p.confused] += 0.14 + 0.24 * (1 - conf) + diff * 0.10;\n    for (var i = 0; i < 5; i++) {\n      if (i !== p.trueCls && i !== p.confused) {\n        w[i] += 0.05 * Math.abs(Math.sin(p.seed * 1.7 + i));\n      }\n    }\n    var sum = w.reduce(function (a, b) { return a + b; }, 0);\n    return w.map(function (v) { return v / sum; });\n  }\n\n  function texture(p, r) {\n    var cls = p.trueCls, s = '', k, x, y;\n    for (k = 0; k < 5; k++) {\n      x = (rnd(p.seed + k * 2.3) - 0.5) * r * 1.05;\n      y = (rnd(p.seed + k * 3.1 + 5) - 0.5) * r * 1.05;\n      if (cls === 0 || cls === 4) {\n        s += '<circle cx=\"' + x.toFixed(1) + '\" cy=\"' + y.toFixed(1) + '\" r=\"1.4\" fill=\"#3c3a2a\" opacity=\".55\"/>';\n      } else if (cls === 1) {\n        s += '<path d=\"M' + (x - 4).toFixed(1) + ' ' + y.toFixed(1) + ' L' + (x + 4).toFixed(1) + ' ' + y.toFixed(1) + '\" stroke=\"#31352a\" stroke-width=\"1.1\" opacity=\".55\"/>';\n      } else {\n        s += '<path d=\"M' + x.toFixed(1) + ' ' + (y - 2.6).toFixed(1) + ' L' + (x + 2.6).toFixed(1) + ' ' + y.toFixed(1) + ' L' + x.toFixed(1) + ' ' + (y + 2.6).toFixed(1) + ' L' + (x - 2.6).toFixed(1) + ' ' + y.toFixed(1) + ' Z\" fill=\"#2f3a3a\" opacity=\".42\"/>';\n      }\n    }\n    if (cls === 4) {\n      s += '<path d=\"M' + (-r * 0.5) + ' ' + (r * 0.2) + ' L' + (r * 0.5) + ' ' + (r * 0.2) + '\" stroke=\"#31352a\" stroke-width=\"1\" opacity=\".4\"/>';\n    }\n    return s;\n  }\n\n  function particleShape(p, idx) {\n    var r = p.size, pts = [], k, a, rad;\n    if (p.trueCls === 1) {\n      return '<ellipse rx=\"' + (r * 1.06).toFixed(1) + '\" ry=\"' + (r * 0.82).toFixed(1) + '\" transform=\"rotate(' + p.rot.toFixed(0) + ')\" fill=\"' + FILL[p.trueCls] + '\" stroke=\"' + EDGE[p.trueCls] + '\" stroke-width=\"1.4\"/>';\n    }\n    for (k = 0; k < p.sides; k++) {\n      a = (k / p.sides) * Math.PI * 2 + p.rot * Math.PI / 180;\n      rad = r * (0.82 + 0.26 * rnd(p.seed + k * 2.7));\n      pts.push((Math.cos(a) * rad).toFixed(1) + ',' + (Math.sin(a) * rad).toFixed(1));\n    }\n    return '<polygon points=\"' + pts.join(' ') + '\" fill=\"' + FILL[p.trueCls] + '\" stroke=\"' + EDGE[p.trueCls] + '\" stroke-width=\"1.4\"/>';\n  }\n\n  function drawSamples() {\n    var svg = $('samples');\n    var grp = groups[state.g], s = '';\n    s += '<text x=\"16\" y=\"16\" font-size=\"9\" fill=\"var(--tx-3)\">颗粒缩略图（点击选择）· 40× 显微</text>';\n    for (var i = 0; i < grp.parts.length; i++) {\n      var p = grp.parts[i];\n      var cx = 60 + (i % 4) * 100, cy = 62 + Math.floor(i / 4) * 84;\n      var sel = i === state.i;\n      s += '<g class=\"particle\" data-i=\"' + i + '\" transform=\"translate(' + cx + ',' + cy + ')\">';\n      if (sel) {\n        s += '<circle r=\"' + (p.size + 8) + '\" fill=\"none\" stroke=\"var(--acc)\" stroke-width=\"1.4\" stroke-dasharray=\"4 3\"/>';\n      }\n      s += '<circle r=\"' + (p.size + 3) + '\" fill=\"#0a0e09\" opacity=\".55\"/>';\n      s += '<g transform=\"rotate(' + (i * 9 - 20) + ')\">' + particleShape(p, i) + texture(p, p.size) + '</g>';\n      if (p.oil === '中') {\n        s += '<path d=\"M' + (-p.size * 0.7) + ' ' + (-p.size * 0.6) + ' Q0 ' + (-p.size * 0.95) + ' ' + (p.size * 0.6) + ' ' + (-p.size * 0.55) + '\" fill=\"none\" stroke=\"#8a6a3a\" stroke-width=\"1.1\" opacity=\".55\"/>';\n      }\n      s += '<text x=\"0\" y=\"' + (p.size + 18) + '\" font-size=\"9\" fill=\"' + (sel ? 'var(--acc)' : 'var(--tx-3)') + '\" text-anchor=\"middle\">' + grp.def.key + '-0' + (i + 1) + '</text>';\n      s += '</g>';\n    }\n    s += '<text x=\"16\" y=\"212\" font-size=\"9\" fill=\"var(--tx-3)\">颗粒 1—5 mm；油膜与泥饼会遮蔽表面纹理</text>';\n    svg.innerHTML = s;\n    var p2 = grp.parts[state.i];\n    $('sample-hint').textContent = '当前 ' + grp.def.key + '-0' + (state.i + 1) + ' · 粒径 ' + p2.mm +\n      ' mm · 油膜' + p2.oil + ' · 人工标注：' + CLASSES[p2.trueCls].name;\n  }\n\n  function drawProbs() {\n    var svg = $('probs');\n    var grp = groups[state.g], p = grp.parts[state.i];\n    var probs = probsFor(p, state.n);\n    var top = probs.indexOf(Math.max.apply(null, probs));\n    var s = '<text x=\"14\" y=\"16\" font-size=\"9\" fill=\"var(--tx-3)\">类别概率（%）· 单颗粒</text>';\n    for (var i = 0; i < 5; i++) {\n      var y = 36 + i * 34, w = probs[i] * 235;\n      s += '<text x=\"96\" y=\"' + (y + 11) + '\" font-size=\"10\" fill=\"' + (i === top ? 'var(--tx)' : 'var(--tx-2)') + '\" text-anchor=\"end\">' + CLASSES[i].name + '</text>';\n      s += '<rect x=\"104\" y=\"' + y + '\" width=\"235\" height=\"14\" rx=\"3\" fill=\"var(--line)\"/>';\n      s += '<rect x=\"104\" y=\"' + y + '\" width=\"' + w.toFixed(1) + '\" height=\"14\" rx=\"3\" fill=\"' + CLASSES[i].color + '\" opacity=\"' + (i === top ? '.95' : '.5') + '\"/>';\n      s += '<text x=\"347\" y=\"' + (y + 11) + '\" font-size=\"9.5\" fill=\"' + (i === top ? 'var(--tx)' : 'var(--tx-3)') + '\" font-family=\"var(--mono)\">' + (probs[i] * 100).toFixed(1) + '</text>';\n    }\n    s += '<line x1=\"104\" y1=\"196\" x2=\"339\" y2=\"196\" stroke=\"var(--line)\"/>';\n    s += '<text x=\"14\" y=\"208\" font-size=\"9\" fill=\"var(--tx-3)\">预测：' + CLASSES[top].name + '　真值：' + CLASSES[p.trueCls].name;\n    s += (top === p.trueCls ? '　判对' : '　判错，全部转人工') + '</text>';\n    if (top !== p.trueCls) {\n      s += '<text x=\"352\" y=\"208\" font-size=\"9\" fill=\"var(--bad)\" text-anchor=\"end\">低置信</text>';\n    }\n    svg.innerHTML = s;\n  }\n\n  function drawCurve() {\n    var svg = $('curve');\n    var padL = 36, padR = 14, padT = 22, padB = 30;\n    var W = 430, H = 180, pw = W - padL - padR, ph = H - padT - padB;\n    var lo = Math.log(50), hi = Math.log(5000);\n    function xOf(n) { return padL + (Math.log(n) - lo) / (hi - lo) * pw; }\n    function yOf(v) { return padT + ph - v * ph; }\n    var s = '<text x=\"14\" y=\"14\" font-size=\"9\" fill=\"var(--tx-3)\">准确率 (%)</text>';\n    for (var v = 0; v <= 1.0001; v += 0.2) {\n      s += '<line x1=\"' + padL + '\" y1=\"' + yOf(v) + '\" x2=\"' + (padL + pw) + '\" y2=\"' + yOf(v) + '\" stroke=\"var(--line)\"/>';\n      s += '<text x=\"' + (padL - 8) + '\" y=\"' + (yOf(v) + 3) + '\" font-size=\"8\" fill=\"var(--tx-3)\" text-anchor=\"end\">' + Math.round(v * 100) + '</text>';\n    }\n    var ticks = [50, 100, 200, 500, 1000, 2000, 5000];\n    ticks.forEach(function (t) {\n      s += '<text x=\"' + xOf(t) + '\" y=\"' + (padT + ph + 14) + '\" font-size=\"8\" fill=\"var(--tx-3)\" text-anchor=\"middle\">' + t + '</text>';\n    });\n    s += '<text x=\"' + (padL + pw / 2) + '\" y=\"' + (H - 3) + '\" font-size=\"8.5\" fill=\"var(--tx-3)\" text-anchor=\"middle\">训练样本数（对数刻度）</text>';\n    s += '<line x1=\"' + padL + '\" y1=\"' + yOf(0.65) + '\" x2=\"' + (padL + pw) + '\" y2=\"' + yOf(0.65) + '\" stroke=\"var(--tx-3)\" stroke-width=\"1\" stroke-dasharray=\"4 3\"/>';\n    s += '<text x=\"' + (padL + 4) + '\" y=\"' + (yOf(0.65) - 4) + '\" font-size=\"8\" fill=\"var(--tx-3)\">少数类可用线 65%</text>';\n\n    var accPath = '', minPath = '', n, m, x, y1, y2;\n    for (n = 50; n <= 5000; n += 50) {\n      m = metricsFor(n, state.g);\n      x = xOf(n); y1 = yOf(m.acc); y2 = yOf(m.minor);\n      accPath += (n === 50 ? 'M' : 'L') + x.toFixed(1) + ' ' + y1.toFixed(1) + ' ';\n      minPath += (n === 50 ? 'M' : 'L') + x.toFixed(1) + ' ' + y2.toFixed(1) + ' ';\n    }\n    s += '<path d=\"' + accPath + '\" fill=\"none\" stroke=\"var(--acc)\" stroke-width=\"2\"/>';\n    s += '<path d=\"' + minPath + '\" fill=\"none\" stroke=\"var(--gold)\" stroke-width=\"2\"/>';\n\n    var cur = metricsFor(state.n, state.g), xc = xOf(state.n);\n    s += '<line x1=\"' + xc + '\" y1=\"' + padT + '\" x2=\"' + xc + '\" y2=\"' + (padT + ph) + '\" stroke=\"var(--tx-3)\" stroke-dasharray=\"3 3\" opacity=\".7\"/>';\n    s += '<circle cx=\"' + xc + '\" cy=\"' + yOf(cur.acc) + '\" r=\"4\" fill=\"var(--acc)\" stroke=\"var(--card)\" stroke-width=\"2\"/>';\n    s += '<circle cx=\"' + xc + '\" cy=\"' + yOf(cur.minor) + '\" r=\"4\" fill=\"var(--gold)\" stroke=\"var(--card)\" stroke-width=\"2\"/>';\n    s += '<text x=\"' + (padL + 8) + '\" y=\"' + (padT + 10) + '\" font-size=\"8\" fill=\"var(--acc)\">■ 总准确率</text>';\n    s += '<text x=\"' + (padL + 78) + '\" y=\"' + (padT + 10) + '\" font-size=\"8\" fill=\"var(--gold)\">■ 少数类召回</text>';\n    svg.innerHTML = s;\n  }\n\n  function updateReads() {\n    var m = metricsFor(state.n, state.g);\n    var conf = probsFor(groups[state.g].parts[state.i], state.n);\n    var confMax = Math.max.apply(null, conf);\n    var pair = GROUP_DEF[state.g].pair;\n    var gap = (1.4 + 10 * (1 - m.acc)).toFixed(1);\n\n    $('r-acc').textContent = (m.acc * 100).toFixed(1) + '%';\n    $('r-min').textContent = (m.minor * 100).toFixed(1) + '%';\n    $('r-min').className = m.minor >= 0.65 ? '' : 'bad';\n    $('r-conf').textContent = CLASSES[pair[0]].name + ' ↔ ' + CLASSES[pair[1]].name + ' · 差 ' + gap + ' 个百分点';\n    $('r-conf').style.fontSize = '12px';\n    $('n-tag').textContent = 'N = ' + state.n + ' 张';\n\n    var v = $('verdict');\n    var ok = m.acc >= 0.80 && m.minor >= 0.65;\n    v.className = 'verdict ' + (ok ? 'ok' : 'bad');\n    v.innerHTML = ok\n      ? '<b>可辅助</b>总准确率 ' + (m.acc * 100).toFixed(1) + '%、少数类召回 ' + (m.minor * 100).toFixed(1) +\n        '%，达到上线门槛。单颗粒置信度低于 ' + (confMax * 100).toFixed(0) + '% 的样本仍应转人工复核。'\n      : '<b>需人工复核</b>总准确率 ' + (m.acc * 100).toFixed(1) + '%、少数类召回 ' + (m.minor * 100).toFixed(1) +\n        '%，白云岩仅占样本 3% 左右，建议补采 800—1,500 颗白云岩与过渡岩性颗粒后再上线。';\n  }\n\n  function render() {\n    drawSamples();\n    drawProbs();\n    drawCurve();\n    updateReads();\n  }\n\n  function schedule() {\n    if (raf) return;\n    raf = true;\n    requestAnimationFrame(function () { raf = false; render(); });\n  }\n\n  function bind() {\n    $('tabs').addEventListener('click', function (e) {\n      var b = e.target.closest('.tab');\n      if (!b) return;\n      state.g = +b.getAttribute('data-g');\n      state.i = 0;\n      [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.remove('on'); });\n      b.classList.add('on');\n      render();\n    });\n    $('samples').addEventListener('click', function (e) {\n      var g = e.target.closest('g[data-i]');\n      if (!g) return;\n      state.i = +g.getAttribute('data-i');\n      render();\n    });\n    $('s-n').addEventListener('input', function (e) {\n      state.n = +e.target.value;\n      $('o-n').textContent = state.n;\n      schedule();\n    });\n  }\n\n  buildGroups();\n  bind();\n  render();\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：岩屑岩性细粒度识别</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"wrap\">\n  <header>\n    <div class=\"eyebrow\">M1 · 录井 · 计算机视觉</div>\n    <h1>岩屑岩性细粒度识别</h1>\n    <p class=\"lead\">一包岩屑里有 30—80 颗 1—5 mm 的颗粒，人工在显微镜下逐包定名。这里把颗粒级概率、样品级投票和训练样本量的影响放在一起，看模型什么时候能辅助、什么时候必须转人工。</p>\n  </header>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">01</span>颗粒样本与五类概率</h2>\n          <div class=\"tabs\" id=\"tabs\">\n            <button class=\"tab on\" data-g=\"0\">样本组 A · 细砂岩</button>\n            <button class=\"tab\" data-g=\"1\">样本组 B · 灰质泥岩</button>\n            <button class=\"tab\" data-g=\"2\">样本组 C · 白云岩</button>\n          </div>\n        </div>\n        <p class=\"hint\">点击任意颗粒切换目标；右侧条形图为该颗粒的类别概率。真值标注显示在下方，方便对照模型是否判对。</p>\n        <div class=\"grid2\">\n          <div>\n            <svg id=\"samples\" viewBox=\"0 0 420 220\" role=\"img\" aria-label=\"岩屑颗粒样本缩略图\"></svg>\n            <p class=\"hint\" id=\"sample-hint\">—</p>\n          </div>\n          <div>\n            <svg id=\"probs\" viewBox=\"0 0 430 215\" role=\"img\" aria-label=\"五类岩性概率条形图\"></svg>\n          </div>\n        </div>\n      </section>\n\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">02</span>训练样本数与少数类召回</h2>\n          <span class=\"tag\" id=\"n-tag\">N = 800 张</span>\n        </div>\n        <svg id=\"curve\" viewBox=\"0 0 430 180\" role=\"img\" aria-label=\"准确率与少数类召回随样本数变化\"></svg>\n        <div class=\"readrow\">\n          <div class=\"read\"><span>总准确率</span><b id=\"r-acc\">—</b></div>\n          <div class=\"read\"><span>少数类召回（白云岩）</span><b id=\"r-min\">—</b></div>\n          <div class=\"read\"><span>混淆最多</span><b id=\"r-conf\">—</b></div>\n        </div>\n        <div class=\"verdict\" id=\"verdict\">—</div>\n      </section>\n    </div>\n\n    <div class=\"side\">\n      <div class=\"ctl\">\n        <label>训练样本数 <output id=\"o-n\">800</output></label>\n        <input type=\"range\" id=\"s-n\" min=\"50\" max=\"5000\" step=\"50\" value=\"800\">\n        <span class=\"tip\">50—5000 张颗粒图。样本越多，总准确率上升，但少数类召回提升更慢</span>\n      </div>\n    </div>\n  </div>\n\n  <p class=\"foot\">示意数据基于松辽盆地某区块 12 口探井的岩屑图像统计；概率与指标随样本量实时重算，用于说明趋势，不代表任何单一模型的实测精度。</p>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "切换三组岩屑样本、点击任一颗粒，再拖动训练样本数，实时看五类概率、总准确率和少数类召回怎么变——以及模型到底能不能直接用于现场。",
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
