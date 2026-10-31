/* =========================================================
   案例插件（静态注册版）：遥感地质剖面岩性解译
   ---------------------------------------------------------
   由 cases/g1-remote-lithology/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "g1-remote-lithology",
    "sceneId": "g1",
    "methods": [
      "cv"
    ],
    "title": "遥感地质剖面岩性解译",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "一幅 1:5 万图幅约 1,600 km²，目视解译要 7—15 天，同一影像不同解释员勾绘的岩性界线可差 100—300 m。多光谱卫星已经把地表反射率采到 10—30 m 网格，语义分割可以把这件事变成「逐像元分类 + 边界矢量化」，人只保留质检与修正。",
        "judge": [
          {
            "label": "任务类型",
            "value": "语义分割 + 边缘提取",
            "desc": "逐像元判岩性，再追踪类间边界"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "精修掩膜稀少，可用历史地质图做弱监督"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "单幅解译从 7—15 天压到 2—3 天"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "类别不均衡、阴影与植被遮挡、跨区迁移"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>传统流程是解释员在 GIS 里对着假彩色影像逐条勾绘岩性界线和断层：一幅 1:5 万图幅约 1,600 km²，熟手要 7—15 天；两个人对同一影像勾出的同一条界线，平面位置常差 100—300 m。图幅越靠西、植被越密，差异越大。</p><p>可用影像是现成的：Sentinel-2 有 13 个波段，B2/B3/B4/B8 为 10 m，B5—B7/B11/B12 为 20 m，单幅约 1.1 亿像元；Landsat-8 全色 15 m、多光谱 30 m。岩性解译常用 <b>7-5-3</b> 组合（SWIR2/NIR/Green）突出黏土矿物与碳酸盐岩，用 B7/B5、B11/B12 比值放大差异，再叠 DEM 坡度去除地形阴影。</p><p>三个硬约束：<b>空间分辨率</b>——10—30 m 像元内常混合 2—3 种岩性，薄层与岩脉直接消失；<b>阴影与植被</b>——阴坡反射率整体下降 20%—35%，NDVI 大于 0.4 的黄土塬区有效像元不足 40%；<b>类别不均衡</b>——白云岩、玄武岩等目标岩性常不到总像元的 3%，模型容易整体偏向砂岩与泥岩。</p><div class='figure'><svg viewBox='0 0 720 250' width='100%' role='img' aria-label='多光谱波段组合与岩性光谱曲线'><rect x='0' y='0' width='720' height='250' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 三个波段 → 假彩色合成</text><rect x='18' y='34' width='140' height='44' fill='#4a3b2a' stroke='var(--line)'/><text x='24' y='51' font-size='9.5' fill='#f3efe3'>B7 SWIR2 2.2 µm</text><text x='24' y='68' font-size='9' fill='#cfc7b4'>黏土 / 碳酸盐吸收</text><rect x='18' y='90' width='140' height='44' fill='#3d4a3a' stroke='var(--line)'/><text x='24' y='107' font-size='9.5' fill='#f3efe3'>B5 NIR 0.86 µm</text><text x='24' y='124' font-size='9' fill='#cfc7b4'>植被与水体敏感</text><rect x='18' y='146' width='140' height='44' fill='#38494b' stroke='var(--line)'/><text x='24' y='163' font-size='9.5' fill='#f3efe3'>B3 Green 0.56 µm</text><text x='24' y='180' font-size='9' fill='#cfc7b4'>铁质矿物反射</text><text x='166' y='113' font-size='14' fill='var(--ink-3)'>→</text><text x='212' y='34' font-size='9.5' fill='var(--ink-2)'>B · 假彩色 R:G:B = 7:5:3</text><rect x='212' y='42' width='140' height='150' fill='#0e130d' stroke='var(--line)'/><path d='M212 150 L352 122 L352 192 L212 192 Z' fill='#b08a5f'/><path d='M212 96 L300 78 L352 96 L352 144 L212 168 Z' fill='#8a8f6d'/><path d='M212 56 L300 42 L352 58 L352 92 L300 78 L212 94 Z' fill='#9aa79a'/><path d='M268 78 L312 100 L300 132 L252 118 Z' fill='#d6cbaa' opacity='0.8'/><text x='222' y='186' font-size='8.5' fill='#e8e3d5'>碳酸盐岩呈亮黄绿</text><text x='420' y='22' font-size='11' fill='var(--ink-2)'>C · 岩性光谱曲线</text><line x1='430' y1='212' x2='700' y2='212' stroke='var(--line)'/><line x1='430' y1='44' x2='430' y2='212' stroke='var(--line)'/><text x='565' y='236' font-size='9.5' fill='var(--ink-3)' text-anchor='middle'>波长 (µm)</text><text x='420' y='120' font-size='9.5' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 420 120)'>反射率</text><text x='443' y='224' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>0.5</text><text x='509' y='224' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>1.0</text><text x='573' y='224' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>1.5</text><text x='638' y='224' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>2.0</text><text x='690' y='224' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>2.4</text><polyline points='430,121 456,106 490,94 521,106 560,128 599,134 638,139 664,145 690,150' fill='none' stroke='var(--gold)' stroke-width='2'/><polyline points='430,167 456,156 490,139 521,145 560,164 599,156 638,150 664,167 690,170' fill='none' stroke='var(--ink-3)' stroke-width='2'/><polyline points='430,94 456,80 490,72 521,83 560,91 599,100 638,117 664,128 681,156 690,150' fill='none' stroke='var(--acc)' stroke-width='2'/><polyline points='430,111 456,97 490,86 521,94 560,100 599,106 638,111 664,120 681,142 690,134' fill='none' stroke='var(--c-cv)' stroke-width='2'/><circle cx='560' cy='91' r='2.6' fill='var(--acc)'/><text x='566' y='86' font-size='8.5' fill='var(--acc)'>1.4 µm 羟基</text><circle cx='681' cy='142' r='2.6' fill='var(--c-cv)'/><text x='660' y='138' font-size='8.5' fill='var(--c-cv)'>2.33 µm 碳酸盐</text><text x='696' y='154' font-size='8.5' fill='var(--gold)' text-anchor='end'>砂岩</text><text x='696' y='176' font-size='8.5' fill='var(--ink-3)' text-anchor='end'>泥岩</text><text x='696' y='128' font-size='8.5' fill='var(--acc)' text-anchor='end'>灰岩</text><text x='696' y='90' font-size='8.5' fill='var(--c-cv)' text-anchor='end'>白云岩</text><text x='430' y='246' font-size='8.5' fill='var(--ink-4)'>波段比值 B7/B5 放大泥岩与碳酸盐岩的差异</text></svg><div class='figcap'><b>图 1</b><span>多光谱波段组合与四类岩性的反射率光谱：1.4 µm 与 2.33 µm 的吸收谷是区分泥岩、灰岩、白云岩的关键</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>把解译拆成一条可质检的链路：<b>预处理</b>（大气校正、云与云影掩膜、地形校正、10 m 重采样）→ <b>语义分割</b>（U-Net / DeepLabv3+，输入 6—8 个波段 + NDVI + DEM 坡度）→ <b>概率图</b>（每个像元 6—10 类概率）→ <b>置信度阈值与形态学去噪</b>（3×3 开闭运算、最小图斑 20 像素）→ <b>边界追踪</b>（marching squares）→ <b>矢量图层入库</b>，最后人工抽检 10%。</p><p>训练用 512 × 512 的 patch，重叠 128 像素，随机翻转与旋转做增广。类别不均衡用 Focal Loss（γ=2）加类别权重，重点岩性权重给到 1:8；空间上必须按图幅分块做 5 折交叉验证，否则相邻 patch 泄漏会把 mIoU 抬高 10—15 个百分点。</p><p>模型输出不是一个「非黑即白」的图，而是概率图。阈值决定哪些像元进入初稿、哪些交人工：阈值 0.55 时通常 10%—15% 像元未分类，集中在阴影、植被和岩性过渡带。工程上更看重<b>边界位置</b>而不是总精度——一条界线偏 50 m，后续剖面和井位就可能错一个构造。</p><div class='figure'><svg viewBox='0 0 720 214' width='100%' role='img' aria-label='影像到分类掩膜再到边界矢量'><defs><pattern id='maskhatch' width='5' height='5' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='5' height='5' fill='#20261b'/><line x1='0' y1='0' x2='0' y2='5' stroke='#4a5540' stroke-width='1.5'/></pattern></defs><rect x='0' y='0' width='720' height='214' fill='var(--paper-2)' rx='6'/><text x='20' y='24' font-size='9.5' fill='var(--ink-2)'>A · 输入影像（10 m）</text><rect x='20' y='34' width='196' height='140' fill='#0e130d' stroke='var(--line)'/><path d='M20 104 L216 76 L216 174 L20 174 Z' fill='#8d7f66'/><path d='M20 60 L112 44 L156 66 L64 90 Z' fill='#6f7a63'/><path d='M112 44 L216 34 L216 80 L156 66 Z' fill='#7f8c74'/><rect x='146' y='116' width='48' height='30' fill='#b09a72' opacity='0.85'/><circle cx='60' cy='120' r='2' fill='#0b0f0a' opacity='0.5'/><circle cx='92' cy='140' r='1.6' fill='#0b0f0a' opacity='0.5'/><circle cx='180' cy='100' r='2.2' fill='#0b0f0a' opacity='0.45'/><text x='226' y='110' font-size='16' fill='var(--ink-3)'>→</text><text x='260' y='24' font-size='9.5' fill='var(--ink-2)'>B · 类别掩膜（斜线 = 未分类）</text><rect x='260' y='34' width='196' height='140' fill='#0e130d' stroke='var(--line)'/><path d='M260 104 L456 76 L456 174 L260 174 Z' fill='#78b7a8' opacity='0.8'/><path d='M260 60 L352 44 L396 66 L304 90 Z' fill='#909a84' opacity='0.8'/><path d='M352 44 L456 34 L456 80 L396 66 Z' fill='#c9b98e' opacity='0.8'/><rect x='386' y='116' width='48' height='30' fill='url(#maskhatch)'/><text x='466' y='110' font-size='16' fill='var(--ink-3)'>→</text><text x='502' y='24' font-size='9.5' fill='var(--ink-2)'>C · 边界矢量入库</text><rect x='502' y='34' width='196' height='140' fill='#0e130d' stroke='var(--line)'/><path d='M516 150 C560 126 610 96 690 82' fill='none' stroke='#d0a85c' stroke-width='2'/><path d='M516 170 C570 150 630 118 690 108' fill='none' stroke='#78b7a8' stroke-width='2'/><path d='M600 44 C612 78 636 120 676 148' fill='none' stroke='#7fa7cf' stroke-width='1.6' stroke-dasharray='4 3'/><circle cx='560' cy='126' r='2.4' fill='#d0a85c'/><circle cx='630' cy='118' r='2.4' fill='#78b7a8'/><circle cx='636' cy='120' r='2.4' fill='#7fa7cf'/><text x='510' y='188' font-size='8.5' fill='var(--ink-3)'>简化容差 0.5 像元 = 5 m</text><text x='20' y='200' font-size='8.5' fill='var(--ink-4)'>预处理 → 语义分割 → 概率图 → 阈值 / 形态学 → marching squares → 矢量图层</text></svg><div class='figcap'><b>图 2</b><span>从假彩色影像到类别掩膜，再到可入库的岩性边界：掩膜中的未分类像元不参与成图，只交人工复核</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style='margin-bottom:14px'>数据门槛中等：公开影像不缺，缺的是「像元级岩性真值」。建议先用 20 幅精修掩膜加历史地质图弱标签起步，不要等全覆盖标注。</p><div class='checklist'><div class='cl-head'><span>数据准备清单 · 5 项</span><span class='cl-prog'><span id='cl-txt'>0 / 5</span><span class='cl-bar'><i id='cl-fill'></i></span></span></div><div class='cl-item' data-cl='0'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>多光谱影像</span><span class='cl-s'>Sentinel-2 10—20 m，单幅 1.1 亿像元，≥ 8 景不同季节</span></span><span class='cl-n'>云量 < 10%，已做 Sen2Cor 大气校正</span></div><div class='cl-item' data-cl='1'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>岩性真值掩膜</span><span class='cl-s'>20 幅 1:5 万图幅人工精修，≥ 50 万像元/幅</span></span><span class='cl-n'>6—10 类，边界误差 ≤ 2 像元</span></div><div class='cl-item' data-cl='2'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>历史地质图矢量化</span><span class='cl-s'>同区域 1:20 万 / 1:5 万，已转 WGS84 / UTM</span></span><span class='cl-n'>弱标签，直接栅格化后降权使用</span></div><div class='cl-item' data-cl='3'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>DEM 与坡度</span><span class='cl-s'>30 m SRTM / ASTER GDEM，与影像同网格</span></span><span class='cl-n'>无需标注，用于地形校正与阴影掩膜</span></div><div class='cl-item' data-cl='4'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>非地质掩膜</span><span class='cl-s'>NDVI、云影、水体、居民点</span></span><span class='cl-n'>NDVI > 0.4 的像元不参与精度统计</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中偏高</b>。挑战按影响排序：① <b>类别不均衡</b>——白云岩、玄武岩常小于 3%，不加权时召回接近 0；② <b>标签噪声</b>——历史地质图界线本身有 ±100 m 误差，直接当强标签会把模型带偏；③ <b>阴影与植被遮挡</b>——NDVI 大于 0.4 的区域不宜强行分类，正确做法是输出「基岩出露区」并留白；④ <b>跨区迁移</b>——湿润区训练的模型到干旱区，mIoU 可能掉 20 个百分点，需要目标区少量样本微调。</p><p>评估不要只看总体精度。建议同时看 <b>mIoU</b>（≥ 0.65 可用）、<b>边界 F1</b>（1 像元缓冲内，≥ 0.75）、<b>重点岩性召回</b>（≥ 0.70）和<b>图斑面积误差</b>（≤ 10%）。如果只报总体精度，大面积砂岩会把小岩体的错误完全掩盖。</p><p style='margin-top:14px'><span style='color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em'>可借鉴的通用技术</span></p><div class='refs'><a class='ref' href='#/method/cv'>语义分割<span class='ar'>↗</span></a><a class='ref' href='#/method/cv'>弱监督学习<span class='ar'>↗</span></a><a class='ref' href='#/method/cv'>多光谱特征融合<span class='ar'>↗</span></a><a class='ref' href='#/method/cv'>边缘提取<span class='ar'>↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "鄂尔多斯盆地某 1:5 万图幅的岩性解译",
        "lead": [
          "某 1:5 万图幅面积 1,600 km²，地表以黄土覆盖与基岩残丘为主，目标岩性 8 类，重点是把白云岩与灰岩的界线勾准。人工解译一版需要 12 天，解释员之间的界线差异中位数 180 m。",
          "项目用 20 幅已精修图幅做训练、2 幅做独立验证，输入 Sentinel-2 6 个 10 m 波段加 DEM 坡度。目标不是替代解释员，而是把「勾第一遍」的时间压到小时级，让人只做抽检和局部修正。"
        ],
        "stats": [
          [
            "图幅面积",
            "1,600 km²"
          ],
          [
            "影像分辨率",
            "10 m（B2—B4/B8）"
          ],
          [
            "单幅像元数",
            "1.1 亿"
          ],
          [
            "训练掩膜",
            "20 幅 / 8.2×10⁷ 像元"
          ],
          [
            "人工解译周期",
            "12 天"
          ],
          [
            "模型推理耗时",
            "3.5 小时"
          ]
        ],
        "steps": [
          {
            "name": "影像预处理与波段组合",
            "role": "数据",
            "do": "用 Sen2Cor 做大气校正，云与云影掩膜后保留 6 个 10 m 波段，按 7-5-3 合成假彩色，再用 DEM 做坡度与地形阴影校正，统一到 UTM 50N 网格。",
            "effect": "得到约 5.8 GB 的地表反射率立方体，单幅 1.1 亿像元",
            "trap": "不做地形校正，阴坡反射率整体偏低 15%—25%，会被模型学成深色岩性"
          },
          {
            "name": "样本与弱标签构建",
            "role": "标注",
            "do": "20 幅精修掩膜切 512 × 512 patch、重叠 128 像素，叠加 1:20 万地质图栅格化后的弱标签并降权 0.3；按图幅做 5 折空间分块交叉验证。",
            "effect": "训练集约 18,000 个 patch，覆盖 8 类岩性",
            "trap": "随机切 patch 会让相邻图块同时进训练和验证，mIoU 虚高 10—15 个百分点"
          },
          {
            "name": "语义分割训练",
            "role": "算法核心",
            "do": "U-Net + ResNet-34 编码器，Focal Loss（γ=2），重点岩性类别权重 1:8；Adam 学习率 1e-4，训练 80 epoch，batch 16。",
            "effect": "验证集 mIoU 0.71，重点岩性召回 0.68",
            "trap": "少数类不加权时，模型会把白云岩、玄武岩整体预测成砂岩或泥岩"
          },
          {
            "name": "阈值与后处理",
            "role": "推理",
            "do": "对 8 类概率图取最大类，置信度低于 0.55 的像元置为未分类；3×3 开闭运算去噪，最小图斑 20 像素（约 0.2 ha）以下并入邻类。",
            "effect": "未分类像元约 10%—15%，图斑碎片减少约 60%",
            "trap": "阈值降到 0.35，噪声图斑数量翻 3 倍；升到 0.75，薄层岩性成片丢失"
          },
          {
            "name": "边界矢量化与人工抽检",
            "role": "质控",
            "do": "用 marching squares 提取类间边界，按 0.5 像元（5 m）容差简化，投影入库为面图层；按 10% 图幅随机抽检，重点核对白云岩与灰岩界线。",
            "effect": "边界 F1 0.78，图斑面积误差 6.4%，单幅交付周期 2—3 天",
            "trap": "只抽检大面积岩性，会漏掉宽 30—50 m 的岩脉和孤立小岩体"
          }
        ],
        "metrics": {
          "title": "怎么算「解译可用」",
          "html": "<p>先看能不能进业务流程，再看精度。可用的最低门槛是 <b>mIoU ≥ 0.65</b>、<b>边界 F1 ≥ 0.75</b>、<b>重点岩性召回 ≥ 0.70</b>；达不到就只能当参考图，不能进数据库。另一个常被忽略的指标是<b>重复性</b>——同一影像跑两遍结果是否一致，模型应接近 1.0，人工只有 0.7 左右。</p><table class='dtable'><thead><tr><th>指标</th><th>定义</th><th>人工目视解译</th><th>语义分割</th></tr></thead><tbody><tr><td>单幅周期</td><td>从拿到影像到成图</td><td>12 天</td><td>3.5 小时 + 2 天质检</td></tr><tr><td>界线位置差异</td><td>与专家参考线的中位距离</td><td>180 m</td><td>65 m</td></tr><tr><td>重点岩性召回</td><td>白云岩、玄武岩正确检出比例</td><td>0.82</td><td>0.71</td></tr><tr><td>重复性</td><td>两次解译的边界重合度</td><td>0.74</td><td>0.98</td></tr><tr><td>相对成本</td><td>按人工为 1.0 折算</td><td>1.0</td><td>0.18</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "阴影区被误判为深色玄武岩",
            "why": "阴坡反射率整体下降 20%—35%，模型把地形阴影当成暗色岩性。必须先做地形校正并把阴影掩膜单独剔除。"
          },
          {
            "name": "植被覆盖区大面积未分类",
            "why": "黄土塬区 NDVI 常大于 0.4，有效基岩像元不足 40%。正确做法是把输出限定为「基岩出露区」，不要强行填满整幅图。"
          },
          {
            "name": "小岩体被最小图斑过滤",
            "why": "20 像素（约 0.2 ha）的阈值会抹掉宽 30—50 m 的岩脉。对岩脉、孤立小岩体应单独用低阈值和更小的最小图斑。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "/* ========= 遥感地质剖面岩性解译 · 可运行示范 ========= */\n* { box-sizing: border-box; }\n:root {\n  --bg: #12160f;\n  --card: #1a1f16;\n  --card-2: #20261b;\n  --line: #2e3527;\n  --tx: #e8e3d5;\n  --tx-2: #a9b0a0;\n  --tx-3: #7c8474;\n  --acc: #78b7a8;\n  --gold: #d0a85c;\n  --bad: #cf7466;\n  --blue: #7fa7cf;\n  --mono: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;\n}\nbody {\n  margin: 0;\n  padding: 10px 12px;\n  background: var(--bg);\n  color: var(--tx);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  font-size: 12px;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n.wrap { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\nheader { margin-bottom: 10px; }\n.eyebrow {\n  font-family: var(--mono); font-size: 9px; letter-spacing: .18em;\n  color: var(--acc); text-transform: uppercase; margin-bottom: 4px;\n}\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; letter-spacing: .01em; }\n.lead { margin: 0; font-size: 11.5px; color: var(--tx-2); }\n.card {\n  background: var(--card); border: 1px solid var(--line);\n  border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;\n}\n.card-head {\n  display: flex; align-items: center; justify-content: space-between;\n  gap: 8px; flex-wrap: wrap; margin-bottom: 4px;\n}\nh2 { font-size: 12.5px; font-weight: 600; margin: 0; color: var(--tx); }\nh2 .num {\n  font-family: var(--mono); font-size: 9px; color: var(--acc);\n  border: 1px solid rgba(120,183,168,.35); border-radius: 4px;\n  padding: 1px 4px; margin-right: 5px; letter-spacing: .08em;\n}\n.hint { font-size: 10.5px; color: var(--tx-3); margin: 2px 0 6px; }\n.grid2 { display: grid; grid-template-columns: 1fr; gap: 8px; align-items: start; }\n#img, #mask { width: 100%; max-width: 380px; height: auto; display: block; }\n#img, #mask { background: #0e130d; border: 1px solid var(--line); border-radius: 8px; }\n\n/* 图例 */\n.legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 8px; }\n.lg {\n  display: inline-flex; align-items: center; gap: 5px;\n  font-size: 10px; color: var(--tx-2);\n}\n.lg i {\n  width: 9px; height: 9px; border-radius: 2px;\n  border: 1px solid rgba(232,227,213,.25); display: inline-block;\n}\n.lg i.hatch {\n  background: repeating-linear-gradient(45deg, #141a11 0 3px, #3a4433 3px 5px);\n  border-color: #3a4433;\n}\n.lg b { font-family: var(--mono); font-weight: 500; color: var(--tx); margin-left: 2px; }\n\n/* 滑杆 */\n.ctl { display: flex; flex-direction: column; gap: 4px; margin: 6px 0 2px; padding: 6px 8px; background: var(--card-2); border: 1px solid var(--line); border-radius: 8px; }\n.ctl label { font-size: 11px; display: flex; justify-content: space-between; color: var(--tx-2); }\n.ctl output { font-family: var(--mono); color: var(--acc); font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: var(--acc); width: 100%; height: 16px; margin: 0; }\n.ctl .tip { font-size: 10px; color: var(--tx-3); }\n\n/* 开关 */\n.switch { font-size: 10.5px; color: var(--tx-2); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }\n.switch input { accent-color: var(--acc); }\n\n/* 读数 */\n.readrow { display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px; }\n.read {\n  background: var(--card-2); border: 1px solid var(--line);\n  border-radius: 8px; padding: 6px 8px;\n}\n.read span { display: block; font-size: 10px; color: var(--tx-3); margin-bottom: 2px; }\n.read b { font-family: var(--mono); font-size: 15px; font-weight: 500; color: var(--acc); }\n.read b.warn { color: var(--gold); }\n.read b.bad { color: var(--bad); }\n\n/* 状态 */\n.verdict {\n  margin-top: 8px; padding: 8px 10px; border-radius: 8px;\n  font-size: 11px; border: 1px solid var(--line); background: var(--card-2); color: var(--tx-2);\n}\n.verdict b { font-size: 12px; margin-right: 6px; }\n.verdict.ok { border-color: rgba(120,183,168,.38); background: rgba(120,183,168,.10); color: var(--acc); }\n.verdict.ok b { color: var(--acc); }\n.verdict.warn { border-color: rgba(208,168,92,.40); background: rgba(208,168,92,.10); color: #e2c486; }\n.verdict.warn b { color: var(--gold); }\n.verdict.bad { border-color: rgba(207,116,102,.40); background: rgba(207,116,102,.10); color: #e3a49b; }\n.verdict.bad b { color: var(--bad); }\n.tag {\n  font-family: var(--mono); font-size: 9.5px; color: var(--gold);\n  border: 1px solid rgba(208,168,92,.35); background: rgba(208,168,92,.08);\n  border-radius: 5px; padding: 2px 6px; white-space: nowrap;\n}\n.foot { font-size: 10px; color: var(--tx-3); line-height: 1.5; margin: 4px 2px 0; }\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 遥感地质剖面岩性解译 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  var COLS = 36, ROWS = 20, CW = 10, CH = 10, X0 = 10, Y0 = 28;\n  var CLASSES = [\n    { n: '砂岩', c: '#c9b98e' },\n    { n: '泥岩', c: '#909a84' },\n    { n: '灰岩', c: '#9fb3b4' },\n    { n: '白云岩', c: '#78b7a8' },\n    { n: '玄武岩', c: '#93839f' },\n    { n: '冲积层', c: '#c08a5c' }\n  ];\n  var CONFUSE = [0, 4, 3, 2, 1, 0];\n  var cells = [];\n  var state = { thr: 0.55, edge: true };\n\n  function $(id) { return document.getElementById(id); }\n  function rnd(s) {\n    var v = Math.sin(s * 12.9898 + 7.233) * 43758.5453;\n    return v - Math.floor(v);\n  }\n  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }\n\n  function build() {\n    for (var y = 0; y < ROWS; y++) {\n      for (var x = 0; x < COLS; x++) {\n        var nx = x / COLS, ny = y / ROWS;\n        var s = ny * 6.4 + nx * 1.9 + 0.42 * Math.sin(nx * 7.2 + 0.6);\n        var t = Math.floor(((s % 6) + 6) % 6);\n        var frac = ((s % 6) + 6) % 6;\n        var nearEdge = Math.abs(frac - Math.round(frac)) < 0.05 ? 1 : 0;\n        var veg = Math.exp(-(Math.pow((nx - 0.84) / 0.15, 2) + Math.pow((ny - 0.18) / 0.19, 2)));\n        var shadow = Math.exp(-(Math.pow((nx - 0.18) / 0.19, 2) + Math.pow((ny - 0.82) / 0.15, 2)));\n        var conf = 0.94 - 0.10 * Math.abs(Math.sin(nx * 21 + ny * 15))\n          - 0.32 * veg - 0.27 * shadow - 0.11 * nearEdge;\n        conf = clamp(conf, 0.27, 0.985);\n        var w = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05];\n        w[t] = conf * (1 - 0.30 * shadow);\n        w[CONFUSE[t]] += (1 - conf) * 0.62 + 0.50 * shadow;\n        w[(t + 3) % 6] += (1 - conf) * 0.22;\n        var sum = 0, i;\n        for (i = 0; i < 6; i++) sum += w[i];\n        var p = [];\n        for (i = 0; i < 6; i++) p.push(w[i] / sum);\n        cells.push({ t: t, p: p, veg: veg, shadow: shadow, seed: x * 37 + y * 91 + 5 });\n      }\n    }\n  }\n\n  function predict() {\n    var counts = [0, 0, 0, 0, 0, 0], un = 0, correct = 0, classified = 0;\n    cells.forEach(function (c) {\n      var best = 0, bi = 0, i;\n      for (i = 0; i < 6; i++) if (c.p[i] > best) { best = c.p[i]; bi = i; }\n      c.best = best;\n      c.pred = best >= state.thr ? bi : -1;\n      if (c.pred < 0) {\n        un++;\n      } else {\n        counts[c.pred]++;\n        classified++;\n      }\n      if (c.pred === c.t) correct++;\n    });\n    return {\n      counts: counts, un: un, classified: classified,\n      acc: correct / cells.length,\n      miss: un / cells.length,\n      ncls: counts.filter(function (v) { return v > 0; }).length\n    };\n  }\n\n  function drawImage() {\n    var s = '<rect x=\"0\" y=\"0\" width=\"380\" height=\"244\" fill=\"#0e130d\" rx=\"6\"/>';\n    s += '<text x=\"10\" y=\"17\" font-size=\"10\" fill=\"#a9b0a0\">假彩色合成 R:G:B = 7:5:3 · 10 m/像元</text>';\n    cells.forEach(function (c, k) {\n      var x = X0 + (k % COLS) * CW;\n      var y = Y0 + Math.floor(k / COLS) * CH;\n      var r1 = rnd(c.seed), r2 = rnd(c.seed + 3.1);\n      s += '<rect x=\"' + x + '\" y=\"' + y + '\" width=\"' + CW + '\" height=\"' + CH + '\" fill=\"' + CLASSES[c.t].c + '\"/>';\n      s += '<rect x=\"' + (x + r1 * 6).toFixed(1) + '\" y=\"' + (y + r2 * 6).toFixed(1)\n        + '\" width=\"2.6\" height=\"2.6\" fill=\"#0b0f0a\" opacity=\"' + (0.16 + r1 * 0.26).toFixed(2) + '\"/>';\n    });\n    s += '<path d=\"M10 228 L10 156 L120 124 L196 168 L196 228 Z\" fill=\"#0b0f0a\" opacity=\"0.40\"/>';\n    s += '<text x=\"24\" y=\"214\" font-size=\"9.5\" fill=\"#c9c2b0\">地形阴影</text>';\n    var i, cx, cy, r;\n    for (i = 0; i < 70; i++) {\n      cx = 272 + rnd(i * 4.7 + 1) * 100;\n      cy = 30 + rnd(i * 6.1 + 9) * 66;\n      r = 0.9 + rnd(i * 2.3 + 5) * 1.5;\n      s += '<circle cx=\"' + cx.toFixed(1) + '\" cy=\"' + cy.toFixed(1) + '\" r=\"' + r.toFixed(1)\n        + '\" fill=\"#5f7d4a\" opacity=\"' + (0.32 + rnd(i + 11) * 0.3).toFixed(2) + '\"/>';\n    }\n    s += '<text x=\"298\" y=\"94\" font-size=\"9.5\" fill=\"#c9c2b0\">植被</text>';\n    s += '<line x1=\"12\" y1=\"236\" x2=\"62\" y2=\"236\" stroke=\"#c9c2b0\" stroke-width=\"1.4\"/>';\n    s += '<text x=\"66\" y=\"239\" font-size=\"8.5\" fill=\"#a9b0a0\">0 — 500 m</text>';\n    $('img').innerHTML = s;\n  }\n\n  function drawMask(m) {\n    var s = '<rect x=\"0\" y=\"0\" width=\"380\" height=\"244\" fill=\"#0e130d\" rx=\"6\"/>';\n    s += '<text x=\"10\" y=\"17\" font-size=\"10\" fill=\"#a9b0a0\">语义分割掩膜 · 阈值 ' + state.thr.toFixed(2) + '</text>';\n    s += '<defs><pattern id=\"hatch\" width=\"5\" height=\"5\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\">'\n      + '<rect width=\"5\" height=\"5\" fill=\"#141a11\"/><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"5\" stroke=\"#3a4433\" stroke-width=\"1.6\"/></pattern></defs>';\n    var k, c, x, y;\n    for (k = 0; k < cells.length; k++) {\n      c = cells[k];\n      x = X0 + (k % COLS) * CW;\n      y = Y0 + Math.floor(k / COLS) * CH;\n      if (c.pred < 0) {\n        s += '<rect x=\"' + x + '\" y=\"' + y + '\" width=\"' + CW + '\" height=\"' + CH + '\" fill=\"url(#hatch)\"/>';\n      } else {\n        s += '<rect x=\"' + x + '\" y=\"' + y + '\" width=\"' + CW + '\" height=\"' + CH\n          + '\" fill=\"' + CLASSES[c.pred].c + '\" opacity=\"0.86\"/>';\n      }\n    }\n    if (state.edge) {\n      for (k = 0; k < cells.length; k++) {\n        c = cells[k];\n        x = X0 + (k % COLS) * CW;\n        y = Y0 + Math.floor(k / COLS) * CH;\n        var right = (k % COLS) < COLS - 1 ? cells[k + 1] : null;\n        var down = k + COLS < cells.length ? cells[k + COLS] : null;\n        if (right && c.pred !== right.pred) {\n          s += '<line x1=\"' + (x + CW) + '\" y1=\"' + y + '\" x2=\"' + (x + CW) + '\" y2=\"' + (y + CH)\n            + '\" stroke=\"#0b0f0a\" stroke-width=\"1.3\"/>';\n        }\n        if (down && c.pred !== down.pred) {\n          s += '<line x1=\"' + x + '\" y1=\"' + (y + CH) + '\" x2=\"' + (x + CW) + '\" y2=\"' + (y + CH)\n            + '\" stroke=\"#0b0f0a\" stroke-width=\"1.3\"/>';\n        }\n      }\n    }\n    s += '<text x=\"10\" y=\"236\" font-size=\"9\" fill=\"#7c8474\">斜线格 = 置信度不足，交人工复核</text>';\n    $('mask').innerHTML = s;\n  }\n\n  function drawLegend(m) {\n    var html = '', i;\n    for (i = 0; i < 6; i++) {\n      html += '<span class=\"lg\"><i style=\"background:' + CLASSES[i].c + '\"></i>'\n        + CLASSES[i].n + '<b>' + m.counts[i] + '</b></span>';\n    }\n    html += '<span class=\"lg\"><i class=\"hatch\"></i>未分类<b>' + m.un + '</b></span>';\n    $('legend').innerHTML = html;\n  }\n\n  function updateStats(m) {\n    var acc = m.acc * 100, miss = m.miss * 100;\n    var ae = $('r-acc'), me = $('r-miss');\n    ae.textContent = acc.toFixed(1) + '%';\n    ae.className = acc >= 88 ? '' : acc >= 78 ? 'warn' : 'bad';\n    me.textContent = miss.toFixed(1) + '%';\n    me.className = miss <= 15 ? '' : miss <= 30 ? 'warn' : 'bad';\n    $('r-cls').textContent = m.ncls + ' / 6';\n\n    var v = $('verdict');\n    if (acc >= 88 && miss <= 15) {\n      v.className = 'verdict ok';\n      v.innerHTML = '<b>可用于预筛</b>全图像元准确率 ' + acc.toFixed(1) + '%，未分类 '\n        + miss.toFixed(1) + '%。可输出 1:5 万初稿，人工只修边界与阴影区。';\n    } else if (miss > 30) {\n      v.className = 'verdict bad';\n      v.innerHTML = '<b>需人工复核</b>未分类像元达 ' + miss.toFixed(1)\n        + '%，漏判集中在阴影与植被遮挡区，不能直接成图。';\n    } else {\n      v.className = 'verdict warn';\n      v.innerHTML = '<b>需人工复核</b>准确率 ' + acc.toFixed(1) + '%、未分类 '\n        + miss.toFixed(1) + '%。边界处仍有错分，建议叠加边界后逐图斑抽检。';\n    }\n  }\n\n  var pending = false;\n  function render() {\n    if (pending) return;\n    pending = true;\n    requestAnimationFrame(function () {\n      pending = false;\n      var m = predict();\n      drawMask(m);\n      drawLegend(m);\n      updateStats(m);\n    });\n  }\n\n  function bind() {\n    $('s-thr').addEventListener('input', function (e) {\n      state.thr = +e.target.value;\n      $('o-thr').textContent = state.thr.toFixed(2);\n      render();\n    });\n    $('c-edge').addEventListener('change', function (e) {\n      state.edge = e.target.checked;\n      render();\n    });\n  }\n\n  build();\n  drawImage();\n  bind();\n  render();\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：遥感地质剖面岩性解译</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"wrap\">\n  <header>\n    <div class=\"eyebrow\">G1 · 地质勘察 · 计算机视觉</div>\n    <h1>遥感影像岩性解译 · 交互式演示</h1>\n    <p class=\"lead\">左侧是 10 m 分辨率的假彩色影像块（R:G:B = 7:5:3），右侧是同一网格的语义分割掩膜。拖动置信度阈值，看哪些像元被保留、哪些转为未分类；图例计数与精度指标同步重算。</p>\n  </header>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">01</span>影像块与分割掩膜</h2>\n          <span class=\"tag\" id=\"meta-tag\">36 × 20 像元 · 10 m</span>\n        </div>\n        <p class=\"hint\">影像中的暗色条带是地形阴影，绿色斑块是植被。模型对这两类像元的置信度会明显下降；掩膜中的斜线格表示低于阈值、需要人工复核的像元。</p>\n        <div class=\"grid2\">\n          <div>\n            <svg id=\"img\" viewBox=\"0 0 380 244\" role=\"img\" aria-label=\"多光谱遥感影像块\"></svg>\n          </div>\n          <div>\n            <svg id=\"mask\" viewBox=\"0 0 380 244\" role=\"img\" aria-label=\"岩性语义分割掩膜\"></svg>\n          </div>\n        </div>\n        <div class=\"legend\" id=\"legend\"></div>\n      </section>\n    </div>\n\n    <div class=\"side\">\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">02</span>置信度阈值与解译质量</h2>\n          <label class=\"switch\"><input type=\"checkbox\" id=\"c-edge\" checked> 叠加岩性边界</label>\n        </div>\n        <div class=\"ctl\">\n          <label>置信度阈值 <output id=\"o-thr\">0.55</output></label>\n          <input type=\"range\" id=\"s-thr\" min=\"0.3\" max=\"0.9\" step=\"0.01\" value=\"0.55\">\n          <span class=\"tip\">阈值越高，保留像元越少；漏判比例上升，像素准确率在中等阈值处最高</span>\n        </div>\n        <div class=\"readrow\">\n          <div class=\"read\"><span>像素准确率（全图，未分类计错）</span><b id=\"r-acc\">—</b></div>\n          <div class=\"read\"><span>漏判率（未分类占比）</span><b id=\"r-miss\">—</b></div>\n          <div class=\"read\"><span>预测类别数</span><b id=\"r-cls\">—</b></div>\n        </div>\n        <div class=\"verdict\" id=\"verdict\">—</div>\n      </section>\n    </div>\n  </div>\n\n  <p class=\"foot\">示意数据按 6 类岩性、36 × 20 像元模拟：阴影与植被区置信度下降 0.27—0.32，类别边界处下降约 0.11。指标用于说明阈值取舍，不代表任何单一模型的实测精度。</p>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动置信度阈值，看右侧掩膜哪些像元被保留、哪些转为未分类；图例计数、像素准确率和漏判率会同步变化。",
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
