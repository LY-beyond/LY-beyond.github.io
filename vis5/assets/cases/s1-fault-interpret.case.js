/* =========================================================
   案例插件（静态注册版）：三维地震断层自动解释
   ---------------------------------------------------------
   由 cases/s1-fault-interpret/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "s1-fault-interpret",
    "sceneId": "s1",
    "methods": [
      "cv"
    ],
    "title": "三维地震断层自动解释",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "一个 200 km² 的三维数据体有近 5 亿个体素，解释员要在上千条 inline 剖面上逐条追踪断面，全人工解释要 2—4 周。断层体素通常不到 1%，3D 语义分割可以先把「像断层的体素」找出来，再骨架化成断层线，人只做质检与组合修正。",
        "judge": [
          {
            "label": "任务类型",
            "value": "3D 语义分割 + 骨架提取",
            "desc": "体素级断层概率，再抽成断层线"
          },
          {
            "label": "标注成本",
            "value": "高",
            "desc": "每个工区至少要 100—200 条人工断层解释"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "解释周期从 2—4 周压到 3—5 天"
          },
          {
            "label": "难度",
            "value": "高",
            "desc": "正样本不足 1%，跨工区频率与信噪比差异大"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>三维地震数据体通常按 25 × 25 m 面元、2 ms 纵向采样采集。一个 200 km² 工区约 32 万个道集、1,500 个采样点，合计 4.8×10⁸ 个体素。解释员每 5 条 inline 解释一次，再在 crossline 方向闭合，一个工区要 2—4 周；不同解释员对同一断层的组合方案常差 15%—25%。</p><p>断层在地震剖面上的表现是<b>同相轴错断</b>：反射层在断面两侧发生垂直位移，位移量就是断距。主频 30 Hz、层速度 3,000 m/s 时波长约 100 m，调谐厚度约 λ/4 = 25 m；断距小于 20—25 m 的断层，同相轴几乎连在一起，人工只能靠相干、曲率属性间接判断，漏检率很高。</p><p>还有两类麻烦：<b>走向多样</b>——伸展断层、走滑断层、逆冲断层的断面倾角从 30° 到 90°，同一套参数很难全部覆盖；<b>属性选择</b>——相干体突出不连续性但噪声大，曲率体对挠曲敏感但会放大采集脚印，单看哪一种都不够。</p><div class='figure'><svg viewBox='0 0 720 240' width='100%' role='img' aria-label='地震剖面同相轴错断'><rect x='0' y='0' width='720' height='240' fill='var(--paper-2)' rx='6'/><text x='18' y='20' font-size='11' fill='var(--ink-2)'>A · 振幅剖面：同相轴在断面处错断</text><line x1='40' y1='58' x2='330' y2='58' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='40' y1='76' x2='330' y2='76' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='40' y1='94' x2='330' y2='94' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='40' y1='112' x2='330' y2='112' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='40' y1='130' x2='330' y2='130' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='40' y1='148' x2='330' y2='148' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='40' y1='166' x2='330' y2='166' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='40' y1='184' x2='330' y2='184' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='76' x2='600' y2='76' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='94' x2='600' y2='94' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='112' x2='600' y2='112' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='130' x2='600' y2='130' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='148' x2='600' y2='148' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='166' x2='600' y2='166' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='184' x2='600' y2='184' stroke='#cf7466' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='202' x2='600' y2='202' stroke='#7fa7cf' stroke-width='1.6' opacity='0.55'/><line x1='330' y1='34' x2='330' y2='208' stroke='var(--bad)' stroke-width='1.4' stroke-dasharray='5 3'/><text x='336' y='32' font-size='9.5' fill='var(--bad)'>断面</text><line x1='360' y1='130' x2='360' y2='112' stroke='var(--gold)' stroke-width='1.4'/><path d='M356 116 L360 108 L364 116' fill='none' stroke='var(--gold)' stroke-width='1.4'/><text x='366' y='124' font-size='9' fill='var(--gold)'>断距 24 m ≈ 9 ms</text><text x='48' y='50' font-size='9' fill='var(--ink-3)'>同相轴（红 = 波峰，蓝 = 波谷）</text><text x='320' y='226' font-size='9.5' fill='var(--ink-3)' text-anchor='middle'>Inline 方向（6 km）</text><text x='28' y='140' font-size='9.5' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 28 140)'>TWT (ms) 0 → 3000</text><text x='612' y='60' font-size='9' fill='var(--ink-4)'>上盘</text><text x='612' y='150' font-size='9' fill='var(--ink-4)'>下盘</text><text x='18' y='226' font-size='8.5' fill='var(--ink-4)'>断面两侧同相轴的垂直位移 = 断距；小于调谐厚度 25 m 时几乎连成一片</text></svg><div class='figcap'><b>图 1</b><span>断层在振幅剖面上的基本表现：同相轴被断面错断，垂直位移量即断距，是识别断层最直接的证据</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>做法是「体素级分割 + 骨架化」：把振幅体、相干体、曲率体按同一网格归一化，切成 128×128×128 的体素块，用 3D U-Net 预测每个体素属于断层的概率。输入 3 个属性通道，输出 1 个概率通道；训练标签由人工断层线按 3 个体素半径膨胀栅格化得到，正样本只占 0.3%—0.8%。</p><p>损失函数用 Focal Loss + Dice 的组合：Focal 压住海量负样本，Dice 保证断层面的连续性。后处理才是决定成果质量的一步——概率阈值 0.5 → 三维连通域 → 骨架化 → 最小断层长度 150 m → 输出断层 sticks。阈值 0.3 时候选数量会翻 3 倍，现场根本审不完。</p><p>模型不替代解释员的构造组合判断。它输出的是<b>高召回候选集</b>：把 90% 的断面体素找出来，解释员在候选上做取舍、连接和命名。这个定位比「全自动成图」现实得多，也更容易被现场接受。</p><div class='figure'><svg viewBox='0 0 720 220' width='100%' role='img' aria-label='振幅体到断层概率体再到断层线'><rect x='0' y='0' width='720' height='220' fill='var(--paper-2)' rx='6'/><text x='20' y='24' font-size='9.5' fill='var(--ink-2)'>A · 振幅体（3 个属性通道）</text><polygon points='34,48 174,48 198,62 58,62' fill='#2a3223' stroke='var(--line)'/><polygon points='34,48 58,62 58,170 34,156' fill='#1b2118' stroke='var(--line)'/><polygon points='58,62 198,62 198,170 58,170' fill='#20261b' stroke='var(--line)'/><line x1='58' y1='80' x2='198' y2='80' stroke='#cf7466' stroke-width='1.4' opacity='0.5'/><line x1='58' y1='96' x2='198' y2='96' stroke='#7fa7cf' stroke-width='1.4' opacity='0.5'/><line x1='58' y1='112' x2='198' y2='112' stroke='#cf7466' stroke-width='1.4' opacity='0.5'/><line x1='58' y1='128' x2='198' y2='128' stroke='#7fa7cf' stroke-width='1.4' opacity='0.5'/><line x1='58' y1='144' x2='198' y2='144' stroke='#cf7466' stroke-width='1.4' opacity='0.5'/><line x1='58' y1='160' x2='198' y2='160' stroke='#7fa7cf' stroke-width='1.4' opacity='0.5'/><text x='226' y='118' font-size='16' fill='var(--ink-3)'>→</text><text x='260' y='24' font-size='9.5' fill='var(--ink-2)'>B · 断层概率体</text><polygon points='274,48 414,48 438,62 298,62' fill='#2a3223' stroke='var(--line)'/><polygon points='274,48 298,62 298,170 274,156' fill='#1b2118' stroke='var(--line)'/><polygon points='298,62 438,62 438,170 298,170' fill='#20261b' stroke='var(--line)'/><ellipse cx='372' cy='116' rx='24' ry='58' fill='#d0a85c' opacity='0.16'/><polygon points='364,62 380,62 380,170 364,170' fill='#d0a85c' opacity='0.55'/><line x1='298' y1='80' x2='438' y2='80' stroke='#cf7466' stroke-width='1.2' opacity='0.28'/><line x1='298' y1='128' x2='438' y2='128' stroke='#7fa7cf' stroke-width='1.2' opacity='0.28'/><line x1='298' y1='160' x2='438' y2='160' stroke='#cf7466' stroke-width='1.2' opacity='0.28'/><text x='372' y='188' font-size='8.5' fill='var(--gold)' text-anchor='middle'>概率 > 0.5 的体素</text><text x='466' y='118' font-size='16' fill='var(--ink-3)'>→</text><text x='500' y='24' font-size='9.5' fill='var(--ink-2)'>C · 骨架化后的断层线</text><rect x='500' y='40' width='198' height='136' fill='#0e130d' stroke='var(--line)'/><path d='M518 156 C540 130 570 100 634 88' fill='none' stroke='#d0a85c' stroke-width='2.4'/><path d='M536 70 C560 102 590 136 656 158' fill='none' stroke='#78b7a8' stroke-width='2'/><path d='M604 64 C614 98 634 126 676 146' fill='none' stroke='#7fa7cf' stroke-width='1.6' stroke-dasharray='4 3'/><circle cx='540' cy='128' r='2.6' fill='#d0a85c'/><circle cx='560' cy='102' r='2.6' fill='#78b7a8'/><circle cx='632' cy='118' r='2.6' fill='#7fa7cf'/><text x='640' y='84' font-size='8.5' fill='#d0a85c'>F1</text><text x='660' y='150' font-size='8.5' fill='#78b7a8'>F2</text><text x='674' y='140' font-size='8.5' fill='#7fa7cf'>F3</text><text x='20' y='204' font-size='8.5' fill='var(--ink-4)'>128³ 体素块 × 3 属性 → 3D U-Net → 概率体 → 阈值 / 连通域 → 骨架化 → 断层 sticks（最小长度 150 m）</text></svg><div class='figcap'><b>图 2</b><span>从振幅体到断层概率体，再骨架化为断层线：概率体保留断面的三维连续性，骨架化负责把体变成可入库的线</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style='margin-bottom:14px'>地震数据本身不缺，缺的是「断层标签」和「跨工区验证集」。一个区块的标签只能说明这个区块，想证明模型能推广，至少要 5 个不同采集参数的工区。</p><div class='checklist'><div class='cl-head'><span>数据准备清单 · 5 项</span><span class='cl-prog'><span id='cl-txt'>0 / 5</span><span class='cl-bar'><i id='cl-fill'></i></span></span></div><div class='cl-item' data-cl='0'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>三维地震振幅体</span><span class='cl-s'>SEG-Y，25 × 25 m 面元，2 ms 采样，200 km² 级</span></span><span class='cl-n'>4.8×10⁸ 体素，需做增益均衡</span></div><div class='cl-item' data-cl='1'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>相干 / 曲率属性体</span><span class='cl-s'>与振幅同网格，3—5 种属性</span></span><span class='cl-n'>由振幅体自动生成，无需人工</span></div><div class='cl-item' data-cl='2'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>人工断层解释</span><span class='cl-s'>5—10 个工区，每工区 100—200 条断层</span></span><span class='cl-n'>断层 sticks 转体素标签，半径 3 体素</span></div><div class='cl-item' data-cl='3'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>正负样本配比</span><span class='cl-s'>正样本占 0.3%—0.8%，负样本 1:3 下采样</span></span><span class='cl-n'>必须按工区分别采样，避免空间泄漏</span></div><div class='cl-item' data-cl='4'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>钻井反馈（可选）</span><span class='cl-s'>过断层井的井漏、垮塌、产量异常记录</span></span><span class='cl-n'>用于验证小断层的实际影响</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>高</b>。四个挑战：① <b>极端的类别不均衡</b>——断层体素不到 1%，不加权时模型会全部预测为背景；② <b>标注昂贵且不一致</b>——一个工区 100—200 条断层要解释员干 2—4 周，两个人对同一条断层的连接方式还可能不同；③ <b>尺度跨度大</b>——断距从 5 m 到 100 m，128³ 的输入块很难同时覆盖；④ <b>跨工区迁移</b>——主频从 25 Hz 换到 35 Hz、信噪比变化，召回可能掉 15 个百分点，需要按工区做频带归一化后微调。</p><p>评估用 <b>断层概率 AUC</b>、<b>骨架 F1</b>、<b>平均位置误差（m）</b> 和 <b>每 100 km² 漏检条数</b>。不要只报像素 F1——断层体素占比太低，像素 F1 看起来很高但一条断层都没连上。</p><p style='margin-top:14px'><span style='color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em'>可借鉴的通用技术</span></p><div class='refs'><a class='ref' href='#/method/cv'>三维卷积网络<span class='ar'>↗</span></a><a class='ref' href='#/method/cv'>语义分割<span class='ar'>↗</span></a><a class='ref' href='#/method/cv'>骨架化<span class='ar'>↗</span></a><a class='ref' href='#/method/cv'>不均衡学习<span class='ar'>↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "渤海湾盆地某 200 km² 三维工区的断层解释",
        "lead": [
          "工区面积 200 km²，面元 25 × 25 m，纵向采样 2 ms，数据体约 4.8×10⁸ 个体素。人工解释一版用了 18 天，共解释断层 302 条，其中断距小于 20 m 的小断层 87 条。",
          "项目用相邻 6 个工区的历史解释做训练，本工区只留 15% 的 inline 做独立验证，避免同一断层的相邻剖面同时进训练集和验证集。"
        ],
        "stats": [
          [
            "工区面积",
            "200 km²"
          ],
          [
            "面元",
            "25 × 25 m"
          ],
          [
            "纵向采样",
            "2 ms"
          ],
          [
            "数据体规模",
            "4.8×10⁸ 体素"
          ],
          [
            "人工解释周期",
            "18 天"
          ],
          [
            "模型推理耗时",
            "6 小时（A100 40 GB）"
          ]
        ],
        "steps": [
          {
            "name": "数据加载与属性计算",
            "role": "数据",
            "do": "加载 SEG-Y 振幅体 4.8×10⁸ 体素，计算相干、最大曲率两种属性，三个通道按工区统一 z-score 归一化到 [-1, 1]，并做球面扩散补偿。",
            "effect": "得到约 5.8 GB 的 float32 三通道数据体",
            "trap": "三个属性各自归一化会破坏相对强弱关系，应统一尺度；不做增益均衡时深层信号被浅层压制"
          },
          {
            "name": "标签栅格化",
            "role": "标注",
            "do": "把 320 条人工断层 sticks 按 3 个体素半径膨胀成三维标签，正样本占 0.42%；负样本按 1:3 下采样，切 128³ patch 共 2,400 个。",
            "effect": "训练集正样本约 3.1×10⁶ 体素，覆盖大断距与小断距两类",
            "trap": "断层线只画在 inline 剖面上，不做三维插值会造成断层之间不连续，模型学成「剖面短线」"
          },
          {
            "name": "3D U-Net 训练",
            "role": "算法核心",
            "do": "4 层编码器、通道 32→256，输入 128³ × 3，Focal Loss + Dice，120 epoch，batch 2，Adam 学习率 2e-4，按工区做交叉验证。",
            "effect": "验证集断层骨架 F1 0.78，概率 AUC 0.91",
            "trap": "显存不足把 patch 缩到 64³，断层连续性明显变差；批归一化在小 batch 下不稳定，改用 GroupNorm"
          },
          {
            "name": "概率体后处理",
            "role": "推理",
            "do": "阈值 0.5 二值化，三维连通域去噪，骨架化后按走向连接断点，最小断层长度 150 m；输出断层 sticks 并计算走向、倾角、断距。",
            "effect": "候选从 320 条收敛到 287 条，误检 41 条，漏检 56 条",
            "trap": "阈值降到 0.3，候选数量翻 3 倍；骨架化会把宽断面拆成两条平行线，需按 3 体素容差合并"
          },
          {
            "name": "人工质检与成图",
            "role": "质控",
            "do": "抽检 15% 的 inline 剖面，重点核对小断层、火成岩边界和断面组合；修正后输出断层 sticks 与断面面片，进入构造建模。",
            "effect": "与人工解释重合率 86%，平均位置误差 18 m，交付周期 3 天",
            "trap": "只检查大断层，小断层漏检率仍有 25%；必须按断距分层统计"
          }
        ],
        "metrics": {
          "title": "怎么算「断层解释可用」",
          "html": "<p>断层解释的「好」不是像素精度，而是<b>断层线能不能用</b>。最低门槛建议：骨架 F1 ≥ 0.75、平均位置误差 ≤ 25 m、断距小于 20 m 的小断层召回 ≥ 0.60。低于这个水平，解释员修图的时间会超过自己重新解释。</p><table class='dtable'><thead><tr><th>指标</th><th>定义</th><th>人工解释</th><th>3D CNN</th></tr></thead><tbody><tr><td>200 km² 周期</td><td>到可入库成果</td><td>18 天</td><td>6 小时 + 3 天质检</td></tr><tr><td>断层条数</td><td>与参考解释对比</td><td>302</td><td>287</td></tr><tr><td>平均位置误差</td><td>断层线到参考线的距离</td><td>—</td><td>18 m</td></tr><tr><td>重合率（F1）</td><td>按 50 m 缓冲匹配</td><td>—</td><td>0.86</td></tr><tr><td>小断距召回</td><td>断距 < 20 m 的断层</td><td>0.41</td><td>0.67</td></tr><tr><td>解释员一致性</td><td>两次独立解释的重合度</td><td>0.72</td><td>0.98</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "火成岩体被误判为断层",
            "why": "侵入体边界产生强相干异常，与断层的响应相似，误检率会增加约 18%。需要加入火成岩掩膜或岩性约束。"
          },
          {
            "name": "大断距断层被拆成两条",
            "why": "断面破碎带概率偏低，骨架化会把一条断层断成两段。要按走向连接断点，容差给到 3 个体素。"
          },
          {
            "name": "跨工区主频变化导致召回下降",
            "why": "主频从 25 Hz 换到 35 Hz，同相轴变密，模型召回掉约 15 个百分点。需要按工区做频带归一化并微调最后一层。"
          }
        ]
      }
    }
  };

  var FILES = [
      {
        "name": "demo/demo.css",
        "data": "/* ========= 三维地震断层自动解释 · 可运行示范 ========= */\n* { box-sizing: border-box; }\n:root {\n  --bg: #12160f;\n  --card: #1a1f16;\n  --card-2: #20261b;\n  --line: #2e3527;\n  --tx: #e8e3d5;\n  --tx-2: #a9b0a0;\n  --tx-3: #7c8474;\n  --acc: #78b7a8;\n  --gold: #d0a85c;\n  --bad: #cf7466;\n  --blue: #7fa7cf;\n  --mono: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;\n}\nbody {\n  margin: 0;\n  padding: 28px 24px 36px;\n  background: var(--bg);\n  color: var(--tx);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  line-height: 1.62;\n  -webkit-font-smoothing: antialiased;\n}\n.wrap { max-width: 1040px; margin: 0 auto; }\nheader { margin-bottom: 20px; }\n.eyebrow {\n  font-family: var(--mono); font-size: 10px; letter-spacing: .18em;\n  color: var(--acc); text-transform: uppercase; margin-bottom: 6px;\n}\nh1 { font-size: 22px; font-weight: 600; margin: 0 0 6px; letter-spacing: .01em; }\n.lead { margin: 0; max-width: 820px; font-size: 13px; color: var(--tx-2); }\n.card {\n  background: var(--card); border: 1px solid var(--line);\n  border-radius: 12px; padding: 18px 20px; margin-bottom: 16px;\n}\n.card-head {\n  display: flex; align-items: center; justify-content: space-between;\n  gap: 12px; flex-wrap: wrap; margin-bottom: 6px;\n}\nh2 { font-size: 14px; font-weight: 600; margin: 0; color: var(--tx); }\nh2 .num {\n  font-family: var(--mono); font-size: 10px; color: var(--acc);\n  border: 1px solid rgba(120,183,168,.35); border-radius: 4px;\n  padding: 1px 5px; margin-right: 7px; letter-spacing: .08em;\n}\n.hint { font-size: 11.5px; color: var(--tx-3); margin: 4px 0 10px; }\n#seis { width: 100%; height: auto; display: block; background: #0e130d; border: 1px solid var(--line); border-radius: 8px; }\n\n/* 滑杆 */\n.ctl2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 8px; }\n@media (max-width: 720px) { .ctl2 { grid-template-columns: 1fr; } }\n.ctl { display: flex; flex-direction: column; gap: 5px; }\n.ctl label { font-size: 12.5px; display: flex; justify-content: space-between; color: var(--tx-2); }\n.ctl output { font-family: var(--mono); color: var(--acc); font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: var(--acc); width: 100%; }\n.ctl .tip { font-size: 11px; color: var(--tx-3); }\n\n/* 读数 */\n.readrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }\n@media (max-width: 680px) { .readrow { grid-template-columns: 1fr; } }\n.read {\n  background: var(--card-2); border: 1px solid var(--line);\n  border-radius: 8px; padding: 10px 12px;\n}\n.read span { display: block; font-size: 10.5px; color: var(--tx-3); margin-bottom: 4px; }\n.read b { font-family: var(--mono); font-size: 19px; font-weight: 500; color: var(--acc); }\n.read b.warn { color: var(--gold); }\n.read b.bad { color: var(--bad); }\n\n/* 状态 */\n.verdict {\n  margin-top: 12px; padding: 11px 14px; border-radius: 8px;\n  font-size: 12.5px; border: 1px solid var(--line); background: var(--card-2); color: var(--tx-2);\n}\n.verdict b { font-size: 13.5px; margin-right: 8px; }\n.verdict.ok { border-color: rgba(120,183,168,.38); background: rgba(120,183,168,.10); color: var(--acc); }\n.verdict.ok b { color: var(--acc); }\n.verdict.warn { border-color: rgba(208,168,92,.40); background: rgba(208,168,92,.10); color: #e2c486; }\n.verdict.warn b { color: var(--gold); }\n.verdict.bad { border-color: rgba(207,116,102,.40); background: rgba(207,116,102,.10); color: #e3a49b; }\n.verdict.bad b { color: var(--bad); }\n.tag {\n  font-family: var(--mono); font-size: 10.5px; color: var(--gold);\n  border: 1px solid rgba(208,168,92,.35); background: rgba(208,168,92,.08);\n  border-radius: 5px; padding: 3px 8px; white-space: nowrap;\n}\n.foot { font-size: 11px; color: var(--tx-3); line-height: 1.7; margin: 4px 2px 0; }\n"
      },
      {
        "name": "demo/demo.js",
        "data": "/* ======= 三维地震断层自动解释 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  var X0 = 38, X1 = 720, Y0 = 28, Y1 = 322;\n  var FAULTS = [\n    { id: 'F1', x: 250, score: 0.92, th: 42, manual: true },\n    { id: 'F2', x: 428, score: 0.79, th: 26, manual: true },\n    { id: 'F3', x: 556, score: 0.63, th: 14, manual: true },\n    { id: 'F4', x: 650, score: 0.46, th: 8, manual: false }\n  ];\n  var state = { thr: 0.60, minThrow: 12 };\n\n  function $(id) { return document.getElementById(id); }\n  function rnd(s) {\n    var v = Math.sin(s * 12.9898 + 3.71) * 43758.5453;\n    return v - Math.floor(v);\n  }\n\n  function evaluate() {\n    var det = [];\n    FAULTS.forEach(function (f, i) {\n      if (f.score < state.thr || f.th < state.minThrow) return;\n      var dx = (rnd(i * 13.7 + 2.4) - 0.5) * 10;\n      det.push({\n        f: f, dx: dx,\n        err: 3 + (1 - f.score) * 38 + Math.abs(dx) * 0.7,\n        manual: f.manual\n      });\n    });\n    var matched = det.filter(function (d) { return d.manual; });\n    var fp = det.length - matched.length;\n    var missed = 3 - matched.length;\n    var overlap = det.length ? matched.length / (3 + fp) * 100 : 0;\n    var err = matched.length\n      ? matched.reduce(function (a, d) { return a + d.err; }, 0) / matched.length\n      : null;\n    return { det: det, matched: matched.length, fp: fp, missed: missed, overlap: overlap, err: err };\n  }\n\n  function drawSeis(m) {\n    var s = '<rect x=\"0\" y=\"0\" width=\"760\" height=\"372\" fill=\"#0e130d\" rx=\"6\"/>';\n    s += '<defs><clipPath id=\"plotclip\"><rect x=\"' + X0 + '\" y=\"' + Y0 + '\" width=\"' + (X1 - X0)\n      + '\" height=\"' + (Y1 - Y0) + '\"/></clipPath>'\n      + '<pattern id=\"traces\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\">'\n      + '<line x1=\"4\" y1=\"0\" x2=\"4\" y2=\"9\" stroke=\"#1c2318\" stroke-width=\"2\"/></pattern></defs>';\n    s += '<text x=\"14\" y=\"18\" font-size=\"10\" fill=\"#a9b0a0\">振幅剖面 · Inline 方向 · 红蓝条带为同相轴</text>';\n    s += '<rect x=\"' + X0 + '\" y=\"' + Y0 + '\" width=\"' + (X1 - X0) + '\" height=\"' + (Y1 - Y0)\n      + '\" fill=\"url(#traces)\" clip-path=\"url(#plotclip)\"/>';\n\n    var i, t;\n    for (i = 0; i < 4; i++) {\n      t = Y0 + i / 3 * (Y1 - Y0);\n      s += '<line x1=\"' + X0 + '\" y1=\"' + t.toFixed(1) + '\" x2=\"' + X1 + '\" y2=\"' + t.toFixed(1)\n        + '\" stroke=\"#20261b\" stroke-width=\"1\"/>';\n      s += '<text x=\"' + (X0 - 6) + '\" y=\"' + (t + 3).toFixed(1)\n        + '\" font-size=\"9\" fill=\"#7c8474\" text-anchor=\"end\">' + (i * 1000) + '</text>';\n    }\n    s += '<text x=\"12\" y=\"' + (Y0 + 40) + '\" font-size=\"9\" fill=\"#7c8474\" transform=\"rotate(-90 12 ' + (Y0 + 40) + ')\">TWT (ms)</text>';\n\n    for (i = 0; i <= 3; i++) {\n      t = X0 + i / 3 * (X1 - X0) - (i === 3 ? 14 : 0);\n      s += '<text x=\"' + t.toFixed(1) + '\" y=\"' + (Y1 + 18) + '\" font-size=\"9\" fill=\"#7c8474\" text-anchor=\"middle\">'\n        + (i * 2) + ' km</text>';\n    }\n\n    FAULTS.forEach(function (f) {\n      var w = 10 + f.score * 12;\n      s += '<rect x=\"' + (f.x - w / 2) + '\" y=\"' + Y0 + '\" width=\"' + w + '\" height=\"' + (Y1 - Y0)\n        + '\" fill=\"#d0a85c\" opacity=\"' + (0.03 + f.score * 0.05).toFixed(3) + '\" clip-path=\"url(#plotclip)\"/>';\n    });\n\n    s += '<g clip-path=\"url(#plotclip)\">';\n    for (i = 0; i < 24; i++) {\n      var pts = [];\n      for (var x = X0; x <= X1; x += 4) {\n        var y = Y0 + 14 + i * 10.8 + 2.6 * Math.sin(x * 0.052 + i * 0.85)\n          + 1.0 * Math.sin(x * 0.13 + i * 1.7);\n        FAULTS.forEach(function (f) {\n          if (x > f.x) y += f.th / 2.4;\n        });\n        pts.push(x.toFixed(1) + ',' + y.toFixed(1));\n      }\n      var op = i % 4 === 0 ? 0.50 : 0.30;\n      s += '<polyline points=\"' + pts.join(' ') + '\" fill=\"none\" stroke=\"#c3cdb9\" stroke-width=\"'\n        + (i % 4 === 0 ? 1.5 : 1.0) + '\" opacity=\"' + op + '\"/>';\n    }\n    s += '</g>';\n\n    FAULTS.forEach(function (f) {\n      if (!f.manual) return;\n      s += '<line x1=\"' + f.x + '\" y1=\"' + Y0 + '\" x2=\"' + f.x + '\" y2=\"' + Y1\n        + '\" stroke=\"#7fa7cf\" stroke-width=\"1.2\" stroke-dasharray=\"4 4\" opacity=\"0.85\"/>';\n      s += '<text x=\"' + (f.x + 4) + '\" y=\"' + (Y0 + 12) + '\" font-size=\"9\" fill=\"#7fa7cf\">' + f.th + ' m</text>';\n    });\n\n    m.det.forEach(function (d) {\n      var x = d.f.x + d.dx;\n      var col = d.manual ? '#d0a85c' : '#cf7466';\n      s += '<line x1=\"' + x.toFixed(1) + '\" y1=\"' + Y0 + '\" x2=\"' + x.toFixed(1) + '\" y2=\"' + Y1\n        + '\" stroke=\"' + col + '\" stroke-width=\"2\"/>';\n      s += '<path d=\"M' + (x - 4).toFixed(1) + ' ' + (Y0 + 4) + ' L' + x.toFixed(1) + ' ' + Y0\n        + ' L' + (x + 4).toFixed(1) + ' ' + (Y0 + 4) + ' Z\" fill=\"' + col + '\"/>';\n      s += '<circle cx=\"' + x.toFixed(1) + '\" cy=\"' + (Y1 - 6) + '\" r=\"3.2\" fill=\"' + col + '\"/>';\n    });\n\n    if (!m.det.length) {\n      s += '<text x=\"' + ((X0 + X1) / 2) + '\" y=\"' + ((Y0 + Y1) / 2)\n        + '\" font-size=\"12\" fill=\"#cf7466\" text-anchor=\"middle\">无断层线通过当前阈值与最小断距</text>';\n    }\n\n    s += '<line x1=\"' + X0 + '\" y1=\"' + (Y1 + 32) + '\" x2=\"' + (X0 + 26) + '\" y2=\"' + (Y1 + 32)\n      + '\" stroke=\"#7fa7cf\" stroke-width=\"1.4\" stroke-dasharray=\"4 3\"/>';\n    s += '<text x=\"' + (X0 + 32) + '\" y=\"' + (Y1 + 36) + '\" font-size=\"9.5\" fill=\"#a9b0a0\">人工解释</text>';\n    s += '<line x1=\"' + (X0 + 110) + '\" y1=\"' + (Y1 + 32) + '\" x2=\"' + (X0 + 136) + '\" y2=\"' + (Y1 + 32)\n      + '\" stroke=\"#d0a85c\" stroke-width=\"2\"/>';\n    s += '<text x=\"' + (X0 + 142) + '\" y=\"' + (Y1 + 36) + '\" font-size=\"9.5\" fill=\"#a9b0a0\">模型检出</text>';\n    s += '<line x1=\"' + (X0 + 220) + '\" y1=\"' + (Y1 + 32) + '\" x2=\"' + (X0 + 246) + '\" y2=\"' + (Y1 + 32)\n      + '\" stroke=\"#c3cdb9\" stroke-width=\"1.4\" opacity=\"0.6\"/>';\n    s += '<text x=\"' + (X0 + 252) + '\" y=\"' + (Y1 + 36) + '\" font-size=\"9.5\" fill=\"#a9b0a0\">同相轴</text>';\n    s += '<text x=\"' + X1 + '\" y=\"' + (Y1 + 36) + '\" font-size=\"9.5\" fill=\"#7c8474\" text-anchor=\"end\">'\n      + '阈值 ' + state.thr.toFixed(2) + ' · 最小断距 ' + state.minThrow + ' m</text>';\n\n    $('seis').innerHTML = s;\n  }\n\n  function updateStats(m) {\n    var n = $('r-n'), e = $('r-err'), o = $('r-ov');\n    n.textContent = m.det.length + ' 条';\n    n.className = m.det.length >= 3 ? '' : 'warn';\n    e.textContent = m.err === null ? '—' : m.err.toFixed(0) + ' m';\n    e.className = m.err === null ? 'bad' : m.err <= 20 ? '' : 'warn';\n    o.textContent = m.overlap.toFixed(0) + '%';\n    o.className = m.overlap === 100 ? '' : m.overlap >= 67 ? 'warn' : 'bad';\n\n    var v = $('verdict');\n    if (m.det.length === 0) {\n      v.className = 'verdict bad';\n      v.innerHTML = '<b>漏检</b>当前阈值下没有断层线通过筛选，三条人工解释断层全部丢失。';\n    } else if (m.missed > 0) {\n      v.className = 'verdict bad';\n      v.innerHTML = '<b>漏检</b>漏掉 ' + m.missed + ' 条人工解释断层（共 3 条），重合率 '\n        + m.overlap.toFixed(0) + '%。建议降低检测阈值或放宽最小断距。';\n    } else if (m.fp > 0) {\n      v.className = 'verdict warn';\n      v.innerHTML = '<b>误检</b>在无人工解释处多检出 ' + m.fp\n        + ' 条线（多为断距小于地震调谐厚度的小断层），重合率 ' + m.overlap.toFixed(0) + '%。';\n    } else {\n      v.className = 'verdict ok';\n      v.innerHTML = '<b>可用</b>三条人工解释断层全部检出，无多余断层线；平均位置误差 '\n        + (m.err === null ? '—' : m.err.toFixed(0) + ' m') + '，可进入人工质检。';\n    }\n  }\n\n  var pending = false;\n  function render() {\n    if (pending) return;\n    pending = true;\n    requestAnimationFrame(function () {\n      pending = false;\n      var m = evaluate();\n      drawSeis(m);\n      updateStats(m);\n      $('o-thr').textContent = state.thr.toFixed(2);\n      $('o-throw').textContent = state.minThrow + ' m';\n      $('mode-tag').textContent = '概率阈值 ' + state.thr.toFixed(2);\n    });\n  }\n\n  function bind() {\n    $('s-thr').addEventListener('input', function (e) {\n      state.thr = +e.target.value;\n      render();\n    });\n    $('s-throw').addEventListener('input', function (e) {\n      state.minThrow = +e.target.value;\n      render();\n    });\n  }\n\n  bind();\n  render();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：三维地震断层自动解释</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"wrap\">\n  <header>\n    <div class=\"eyebrow\">S1 · 物探 · 计算机视觉</div>\n    <h1>三维地震断层自动解释 · 交互式演示</h1>\n    <p class=\"lead\">剖面里的水平条纹是同相轴，中间两组被错断的反射层对应两条真实断层，最右侧还有一条断距 8 m 的小断层。模型先输出断层概率，再在阈值与最小断距约束下提取断层线。</p>\n  </header>\n\n  <section class=\"card\">\n    <div class=\"card-head\">\n      <h2><span class=\"num\">01</span>地震剖面与断层线</h2>\n      <span class=\"tag\" id=\"tag\">2 ms 采样 · 25 × 25 m 面元</span>\n    </div>\n    <p class=\"hint\">蓝色虚线是人工解释结果，金色实线是模型检出。拖动下方两个滑杆，看检出的断层线、位置误差和与人工解释的重合率如何变化。</p>\n    <svg id=\"seis\" viewBox=\"0 0 760 372\" role=\"img\" aria-label=\"地震剖面与断层解释\"></svg>\n  </section>\n\n  <section class=\"card\">\n    <div class=\"card-head\">\n      <h2><span class=\"num\">02</span>检测阈值与最小断距</h2>\n      <span class=\"tag\" id=\"mode-tag\">概率阈值 0.60</span>\n    </div>\n    <div class=\"ctl2\">\n      <div class=\"ctl\">\n        <label>检测阈值 <output id=\"o-thr\">0.60</output></label>\n        <input type=\"range\" id=\"s-thr\" min=\"0.3\" max=\"0.9\" step=\"0.02\" value=\"0.6\">\n        <span class=\"tip\">概率高于该值的候选才进入后处理；调高会漏掉弱反射断层</span>\n      </div>\n      <div class=\"ctl\">\n        <label>最小断距 <output id=\"o-throw\">12 m</output></label>\n        <input type=\"range\" id=\"s-throw\" min=\"5\" max=\"60\" step=\"1\" value=\"12\">\n        <span class=\"tip\">断距小于该值的断层被过滤；地震调谐厚度约 25 m</span>\n      </div>\n    </div>\n    <div class=\"readrow\">\n      <div class=\"read\"><span>检出断层线数量</span><b id=\"r-n\">—</b></div>\n      <div class=\"read\"><span>平均位置误差</span><b id=\"r-err\">—</b></div>\n      <div class=\"read\"><span>与人工解释重合率</span><b id=\"r-ov\">—</b></div>\n    </div>\n    <div class=\"verdict\" id=\"verdict\">—</div>\n  </section>\n\n  <p class=\"foot\">示意剖面按 24 条同相轴、4 条候选断层模拟：真实断距 42 / 26 / 14 / 8 m，模型概率 0.92 / 0.79 / 0.63 / 0.46。人工解释只收录前三条，断距 8 m 的小断层作为误检诱饵。位置误差按 1 像元 ≈ 8.6 m 折算。</p>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动检测阈值与最小断距，看地震剖面上检出的断层线、平均位置误差和与人工解释的重合率如何变化。",
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
