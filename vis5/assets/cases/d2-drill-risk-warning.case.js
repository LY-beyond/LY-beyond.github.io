/* =========================================================
   案例插件（静态注册版）：井下复杂事故前兆智能预警（卡钻/井漏/气侵）
   ---------------------------------------------------------
   由 cases/d2-drill-risk-warning/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "d2-drill-risk-warning",
    "sceneId": "d2",
    "methods": [
      "ts"
    ],
    "title": "井下复杂事故前兆智能预警（卡钻/井漏/气侵）",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "卡钻、井漏、气侵一旦发生，损失以小时到天计，一次卡钻的处理成本常在 50—500 万元。多数事故在发生前 5—30 min 就有前兆：扭矩抬升、立压异常、出口流量下降或总烃升高。难点不是「看不见」，而是十几条曲线同时变化、正常工况波动又很大。",
        "judge": [
          {
            "label": "任务类型",
            "value": "多变量时序异常检测",
            "desc": "分工况建基线，输出分级预警"
          },
          {
            "label": "标注成本",
            "value": "高",
            "desc": "单区块事故样本只有 20—60 起"
          },
          {
            "label": "可见收益",
            "value": "极高",
            "desc": "一次卡钻损失 50—500 万元"
          },
          {
            "label": "难度",
            "value": "高",
            "desc": "样本稀少、工况切换、误报成本高"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>钻井现场每秒采一次数据：立压 18—22 MPa、扭矩 6—12 kN·m、出口流量 30—35 L/s、总烃 0.1%—2%、转速 60—120 r/min，典型配置 10—16 个通道。单井一天就是 86,400 点/通道，12 口井 18 个月约 4.7×10⁸ 个数据点。</p><p>传统做法是给每个参数设固定阈值，超限就响铃。问题是<b>工况一直在变</b>：钻进、接单根、起下钻、循环的基线完全不同。接单根时扭矩从 8 猛增到 16 kN·m 只持续 1—2 min，固定阈值必然误报；而卡钻前兆的扭矩只抬升 15%—30%，又常常低于阈值。现场统计，固定阈值每班误报 3—10 次，司钻干脆把报警关掉。</p><p>三类事故的前兆模式也不一样：<b>卡钻</b>是扭矩升、立压升、流量降；<b>井漏</b>是立压降、返出流量降、总池体积降；<b>气侵</b>是总烃升、钻井液密度降、出口流量波动。单通道阈值只能抓住其中一条，组合前兆才是关键。</p><div class='figure'><svg viewBox='0 0 720 240' width='100%' role='img' aria-label='立压扭矩流量三通道时序与卡钻前兆'><rect x='0' y='0' width='720' height='240' fill='var(--paper-2)' rx='6'/><text x='18' y='20' font-size='11' fill='var(--ink-2)'>A · 三通道归一化时序（1 min 聚合）</text><line x1='40' y1='40' x2='40' y2='190' stroke='var(--line)'/><line x1='40' y1='190' x2='690' y2='190' stroke='var(--line)'/><line x1='40' y1='55' x2='690' y2='55' stroke='var(--line)' stroke-dasharray='3 3' opacity='0.5'/><line x1='40' y1='115' x2='690' y2='115' stroke='var(--line)' stroke-dasharray='3 3' opacity='0.5'/><line x1='40' y1='175' x2='690' y2='175' stroke='var(--line)' stroke-dasharray='3 3' opacity='0.5'/><text x='34' y='58' font-size='8.5' fill='var(--ink-3)' text-anchor='end'>100</text><text x='34' y='118' font-size='8.5' fill='var(--ink-3)' text-anchor='end'>50</text><text x='34' y='178' font-size='8.5' fill='var(--ink-3)' text-anchor='end'>0</text><text x='30' y='120' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 30 120)'>归一化幅值</text><rect x='387' y='40' width='59' height='150' fill='var(--gold)' opacity='0.10'/><line x1='387' y1='34' x2='387' y2='196' stroke='var(--gold)' stroke-width='1.2' stroke-dasharray='4 3'/><text x='390' y='33' font-size='8.5' fill='var(--gold)'>前兆 128 min</text><line x1='446' y1='34' x2='446' y2='196' stroke='var(--bad)' stroke-width='1.6'/><text x='450' y='33' font-size='8.5' fill='var(--bad)'>卡钻 150 min</text><path d='M40 116 C120 110 200 118 280 113 S380 118 446 112 L500 96 L560 80 L690 74' fill='none' stroke='var(--c-ts)' stroke-width='2'/><path d='M40 118 C120 124 200 116 280 120 S380 118 387 118 L430 98 L470 82 L560 72 L690 70' fill='none' stroke='var(--gold)' stroke-width='2'/><path d='M40 112 C120 118 200 110 280 114 S380 116 387 116 L430 132 L470 146 L560 155 L690 160' fill='none' stroke='var(--c-cv)' stroke-width='2'/><text x='400' y='62' font-size='8.5' fill='var(--gold)'>前兆：扭矩 ↑、立压 ↑、流量 ↓</text><text x='40' y='212' font-size='8.5' fill='var(--ink-3)'>0</text><text x='202' y='212' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>60</text><text x='365' y='212' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>120</text><text x='527' y='212' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>180</text><text x='690' y='212' font-size='8.5' fill='var(--ink-3)' text-anchor='middle'>240</text><text x='365' y='230' font-size='9.5' fill='var(--ink-3)' text-anchor='middle'>时间 (min)</text><line x1='40' y1='226' x2='58' y2='226' stroke='var(--c-ts)' stroke-width='2'/><text x='63' y='229' font-size='8.5' fill='var(--ink-2)'>立压</text><line x1='110' y1='226' x2='128' y2='226' stroke='var(--gold)' stroke-width='2'/><text x='133' y='229' font-size='8.5' fill='var(--ink-2)'>扭矩</text><line x1='180' y1='226' x2='198' y2='226' stroke='var(--c-cv)' stroke-width='2'/><text x='203' y='229' font-size='8.5' fill='var(--ink-2)'>出口流量</text></svg><div class='figcap'><b>图 1</b><span>卡钻前 20 min 的三通道前兆：扭矩持续抬升、立压上升、出口流量下降；单看任何一条都不足以判断</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>核心是「<b>先分工况，再比基线</b>」：① 用规则加聚类把时间轴切成钻进、接单根、起下钻、循环四类工况；② 每个工况单独估计 30 min 滑窗的均值与协方差；③ 用 Mahalanobis 距离或 PCA 残差计算多变量偏离分数；④ 分数连续 3 min 超阈值、并带 0.3 的迟滞才报警；⑤ 按偏离幅度分黄、橙、红三级。</p><p>数据少的时候不要一上来就上深度模型。12 口井、23 起事故的样本量，先用「工况分段 + 统计基线 + 多变量距离」就能拿到大部分收益；LSTM 自编码器适合作为第二阶段的残差模型，但需要至少 50—100 起事故才能稳定训练。</p><p>报警必须给理由：输出「扭矩贡献 52%、流量贡献 31%、立压贡献 17%」，司钻才会信。只给一个红点、不说哪条曲线异常，现场三次之后就会把报警静音。</p><div class='figure'><svg viewBox='0 0 720 220' width='100%' role='img' aria-label='正常工况到前兆特征再到分级报警'><rect x='0' y='0' width='720' height='220' fill='var(--paper-2)' rx='6'/><text x='20' y='24' font-size='9.5' fill='var(--ink-2)'>A · 正常工况基线</text><rect x='18' y='40' width='200' height='132' fill='#0e130d' stroke='var(--line)'/><rect x='30' y='86' width='176' height='40' fill='var(--acc)' opacity='0.15'/><line x1='30' y1='106' x2='206' y2='106' stroke='var(--acc)' stroke-width='1.2' stroke-dasharray='4 3'/><circle cx='46' cy='102' r='2.2' fill='var(--acc)'/><circle cx='72' cy='110' r='2.2' fill='var(--acc)'/><circle cx='98' cy='100' r='2.2' fill='var(--acc)'/><circle cx='124' cy='112' r='2.2' fill='var(--acc)'/><circle cx='150' cy='104' r='2.2' fill='var(--acc)'/><circle cx='176' cy='108' r='2.2' fill='var(--acc)'/><text x='30' y='58' font-size='8.5' fill='var(--ink-3)'>立压 18.2 MPa</text><text x='30' y='72' font-size='8.5' fill='var(--ink-3)'>扭矩 8.1 kN·m</text><text x='30' y='150' font-size='8.5' fill='var(--acc)'>±2σ 基线带</text><text x='30' y='166' font-size='8.5' fill='var(--ink-4)'>按工况分别统计</text><text x='226' y='110' font-size='16' fill='var(--ink-3)'>→</text><text x='260' y='24' font-size='9.5' fill='var(--ink-2)'>B · 前兆特征</text><rect x='258' y='40' width='200' height='132' fill='#0e130d' stroke='var(--line)'/><path d='M270 118 C300 116 330 114 360 108 C390 102 410 94 446 84' fill='none' stroke='var(--gold)' stroke-width='2'/><path d='M270 112 C300 114 330 116 360 120 C390 126 410 132 446 142' fill='none' stroke='var(--c-cv)' stroke-width='2'/><line x1='270' y1='100' x2='446' y2='100' stroke='var(--bad)' stroke-width='1' stroke-dasharray='3 3'/><text x='272' y='96' font-size='8.5' fill='var(--bad)'>报警线</text><text x='272' y='64' font-size='8.5' fill='var(--gold)'>扭矩</text><text x='272' y='78' font-size='8.5' fill='var(--c-cv)'>流量</text><text x='272' y='160' font-size='8.5' fill='var(--ink-4)'>两条曲线反向背离</text><text x='466' y='110' font-size='16' fill='var(--ink-3)'>→</text><text x='500' y='24' font-size='9.5' fill='var(--ink-2)'>C · 分级预警</text><rect x='498' y='40' width='200' height='132' fill='#0e130d' stroke='var(--line)'/><circle cx='540' cy='72' r='12' fill='var(--gold)'/><text x='540' y='77' font-size='12' fill='#12160f' text-anchor='middle'>!</text><text x='560' y='66' font-size='9.5' fill='var(--gold)'>卡钻前兆</text><text x='560' y='82' font-size='9' fill='var(--ink-2)'>提前 14 min</text><rect x='518' y='108' width='160' height='9' rx='4' fill='#20261b'/><rect x='518' y='108' width='104' height='9' rx='4' fill='var(--gold)'/><text x='518' y='136' font-size='8.5' fill='var(--ink-3)'>阈值 3.2σ</text><text x='678' y='136' font-size='8.5' fill='var(--gold)' text-anchor='end'>黄 / 橙 / 红</text><text x='518' y='158' font-size='8.5' fill='var(--ink-4)'>扭矩 52% · 流量 31% · 立压 17%</text><text x='20' y='204' font-size='8.5' fill='var(--ink-4)'>工况分段 → 正常基线 → 多变量残差 → 持续 3 min 确认 → 分级预警（带通道贡献）</text></svg><div class='figcap'><b>图 2</b><span>先把正常工况建成基线，再检测多通道的联合偏离，最后给出带原因的分级预警</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style='margin-bottom:14px'>时序数据量很大，但「事故标签」极少。真正的门槛不是存储，而是把 20—60 起事故的时间、类型、处理过程对上秒级数据，并标出工况切换。</p><div class='checklist'><div class='cl-head'><span>数据准备清单 · 5 项</span><span class='cl-prog'><span id='cl-txt'>0 / 5</span><span class='cl-bar'><i id='cl-fill'></i></span></span></div><div class='cl-item' data-cl='0'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>多通道钻井时序</span><span class='cl-s'>立压、扭矩、流量、总烃等 10—16 通道，1 Hz，≥ 12 个月</span></span><span class='cl-n'>缺测段 < 5%，时间戳统一到 UTC</span></div><div class='cl-item' data-cl='1'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>事故台账</span><span class='cl-s'>单区块 20—60 起，时间精确到 1 min</span></span><span class='cl-n'>类型、处理过程、损失工时</span></div><div class='cl-item' data-cl='2'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>工况标签</span><span class='cl-s'>钻进 / 接单根 / 起下钻 / 循环，4 类</span></span><span class='cl-n'>规则自动分段，人工抽检 5%</span></div><div class='cl-item' data-cl='3'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>传感器元数据</span><span class='cl-s'>量程、精度、采样延迟，流量计延迟 5—15 s</span></span><span class='cl-n'>用于时间对齐与漂移校正</span></div><div class='cl-item' data-cl='4'><span class='cl-box'><svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12.5l5 5L20 6.5'/></svg></span><span><span class='cl-t'>井身与钻具组合</span><span class='cl-s'>井深、钻头类型、排量、钻具组合</span></span><span class='cl-n'>用于跨井归一化，避免把井差异当异常</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>高</b>。① <b>标签稀少</b>——一个区块 18 个月只有 20—60 起事故，异常样本占比不到 0.5%，监督学习很难直接训；② <b>工况切换</b>——接单根、起下钻会让扭矩和立压瞬间跳变，占误报的 60% 以上；③ <b>误报成本</b>——每班超过 3 次误报，司钻就会关报警，模型再准也没用；④ <b>传感器问题</b>——流量计零点漂移 2 L/s、时钟漂移 30—90 s，足够把前兆淹没。</p><p>评估不能只看召回。建议用「<b>提前量 ≥ 10 min 的召回率</b>」加「<b>每班误报次数 ≤ 1</b>」双指标；只优化召回会把阈值压得很低，误报爆炸。另一个关键指标是<b>首次报警时刻误差</b>，中位数应控制在 ±3 min。</p><p style='margin-top:14px'><span style='color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em'>可借鉴的通用技术</span></p><div class='refs'><a class='ref' href='#/method/ts'>多变量异常检测<span class='ar'>↗</span></a><a class='ref' href='#/method/ts'>时序分段<span class='ar'>↗</span></a><a class='ref' href='#/method/ts'>自编码器残差<span class='ar'>↗</span></a><a class='ref' href='#/method/ts'>变化点检测<span class='ar'>↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "四川盆地某区块 12 口井的卡钻前兆预警",
        "lead": [
          "区块 12 口井、12 个通道、18 个月共约 4.7×10⁸ 个数据点，事故台账记录 23 起：卡钻 11 起、井漏 7 起、气侵 5 起。目标是提前 10 min 以上给出预警，同时把每班误报压到 1 次以内。",
          "第一版没有上深度模型，只用「工况分段 + 30 min 滑窗协方差 + Mahalanobis 距离」，在 23 起事故上做到中位提前 14 min、每班误报 0.8 次。第二版才用 LSTM 自编码器补残差。"
        ],
        "stats": [
          [
            "监测井数",
            "12 口"
          ],
          [
            "采样率",
            "1 Hz"
          ],
          [
            "通道数",
            "12"
          ],
          [
            "累计数据量",
            "18 个月 / 4.7×10⁸ 点"
          ],
          [
            "事故样本",
            "23 起（卡钻 11 / 井漏 7 / 气侵 5）"
          ],
          [
            "预警提前量",
            "中位 14 min"
          ]
        ],
        "steps": [
          {
            "name": "数据清洗与时间对齐",
            "role": "数据",
            "do": "12 通道 1 Hz 数据统一到 UTC，流量计按 8 s 延迟做补偿，剔除起下钻段与检修段，缺测超过 2 min 的片段整体丢弃。",
            "effect": "4.7×10⁸ 点清洗后保留约 3.1×10⁸ 有效点",
            "trap": "不同设备时钟漂移 30—90 s，不对齐会把因果关系错位，前兆看起来像噪声"
          },
          {
            "name": "工况分段",
            "role": "预处理",
            "do": "用转速、扭矩、大钩负荷规则先粗分，再用 K-means 聚类修正，得到钻进、接单根、起下钻、循环四类工况；每种工况单独建模。",
            "effect": "工况识别准确率 94%，接单根段与钻进段彻底分开",
            "trap": "不分工况时，接单根扭矩尖峰占全部误报的 62%"
          },
          {
            "name": "正常基线建模",
            "role": "算法核心",
            "do": "每个工况用 30 min 滑窗估计 12 通道均值与协方差，计算 Mahalanobis 距离；协方差奇异时用 PCA 保留前 5 个主成分做残差。",
            "effect": "正常钻进段 95% 的分数低于 2.5，前兆段升到 4—8",
            "trap": "基线随井深和钻头磨损漂移，固定基线两周后失效，必须滚动更新"
          },
          {
            "name": "异常评分与报警",
            "role": "推理",
            "do": "多变量分数取 3 min 滑动平均，连续 2 min 超过阈值且带 0.3 迟滞才确认报警；输出各通道贡献度，按 3.0σ / 4.5σ / 6.0σ 分黄、橙、红。",
            "effect": "召回 0.78（提前 ≥ 10 min），每班误报 0.8 次",
            "trap": "单通道阈值会漏掉「扭矩升 + 流量降」的组合前兆；只看瞬时值又会把噪声当异常"
          },
          {
            "name": "分级预警与闭环",
            "role": "质控",
            "do": "黄级推送司钻平板，橙级同步值班工程师，红级触发电话；每次处置结果回标到台账，按月重估阈值并更新基线。",
            "effect": "23 起事故中 18 起提前 ≥ 10 min，中位提前 14 min，卡钻平均处理时间从 6.5 h 降到 3.1 h",
            "trap": "只报警不给原因，司钻会关闭报警；不回标处置结果，阈值永远调不准"
          }
        ],
        "metrics": {
          "title": "怎么算「预警好用」",
          "html": "<p>预警系统的价值是<b>用可接受的误报换提前量</b>。只报召回没有意义——把阈值降到 1.5σ，召回能到 0.95，但每班误报 20 次，现场一定关掉。建议双门槛：提前 ≥ 10 min 的召回 ≥ 0.70，且每班误报 ≤ 1.0。</p><table class='dtable'><thead><tr><th>指标</th><th>定义</th><th>固定阈值</th><th>多变量模型</th></tr></thead><tbody><tr><td>召回（提前 ≥ 10 min）</td><td>23 起事故中及时预警的比例</td><td>0.39</td><td>0.78</td></tr><tr><td>每班误报</td><td>12 h 班内的误报次数</td><td>5.2</td><td>0.8</td></tr><tr><td>中位提前量</td><td>首次报警到事故的时间</td><td>—</td><td>14 min</td></tr><tr><td>卡钻平均处理时间</td><td>从发生到解卡</td><td>6.5 h</td><td>3.1 h</td></tr><tr><td>非生产时间占比</td><td>事故导致的停钻比例</td><td>4.2%</td><td>2.7%</td></tr><tr><td>工况切换误报占比</td><td>误报中发生在工况切换的比例</td><td>62%</td><td>18%</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "接单根误报",
            "why": "扭矩从 8 瞬间升到 16 kN·m，只持续 1—2 min，和卡钻前兆很像。需要 90 s 的工况切换屏蔽窗口，并在新工况稳定 3 min 后再开始计分。"
          },
          {
            "name": "流量计零点漂移",
            "why": "零点漂移 2 L/s 会让基线整体偏移，连续 3 天误报。必须做日校准和自适应基线，不能用三个月前标定的均值。"
          },
          {
            "name": "前兆被工况切换切断",
            "why": "钻进转循环时基线突变，异常分数瞬间归零，提前量从 18 min 掉到 4 min。需要跨工况累积证据，切换后保留前 3 min 的分数。"
          }
        ]
      }
    }
  };

  var FILES = [
    {
      "name": "demo/demo.css",
      "data": "/* ========= 井下复杂事故前兆智能预警 · 可运行示范 ========= */\n* { box-sizing: border-box; }\n:root {\n  --bg: #ecf0e9;\n  --card: #e4e9e0;\n  --card-2: #dee4d9;\n  --line: #d1d8ca;\n  --tx: #2a2517;\n  --tx-2: #585f4f;\n  --tx-3: #838b7b;\n  --acc: #488778;\n  --gold: #a37b2f;\n  --bad: #993e30;\n  --blue: #305880;\n  --mono: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;\n}\nbody {\n  margin: 0;\n  padding: 10px 12px;\n  background: var(--bg);\n  color: var(--tx);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  font-size: 12px;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n.wrap { max-width: none; margin: 0; }\n.layout { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 10px; align-items: start; }\n.side { position: sticky; top: 6px; }\nheader { margin-bottom: 10px; }\n.eyebrow {\n  font-family: var(--mono); font-size: 9px; letter-spacing: .18em;\n  color: var(--acc); text-transform: uppercase; margin-bottom: 4px;\n}\nh1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; letter-spacing: .01em; }\n.lead { margin: 0; font-size: 11.5px; color: var(--tx-2); }\n.card {\n  background: var(--card); border: 1px solid var(--line);\n  border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;\n}\n.card-head {\n  display: flex; align-items: center; justify-content: space-between;\n  gap: 8px; flex-wrap: wrap; margin-bottom: 4px;\n}\nh2 { font-size: 12.5px; font-weight: 600; margin: 0; color: var(--tx); }\nh2 .num {\n  font-family: var(--mono); font-size: 9px; color: var(--acc);\n  border: 1px solid rgba(72,135,120,.35); border-radius: 4px;\n  padding: 1px 4px; margin-right: 5px; letter-spacing: .08em;\n}\n.hint { font-size: 10.5px; color: var(--tx-3); margin: 2px 0 6px; }\n#chart { width: 100%; max-width: 100%; height: auto; display: block; background: #edf2ec; border: 1px solid var(--line); border-radius: 8px; }\n\n/* 滑杆 */\n.ctl2 { display: grid; grid-template-columns: 1fr !important; gap: 6px; margin-top: 6px; }\n.ctl { display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; background: var(--card-2); border: 1px solid var(--line); border-radius: 8px; }\n.ctl label { font-size: 11px; display: flex; justify-content: space-between; color: var(--tx-2); }\n.ctl output { font-family: var(--mono); color: var(--acc); font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: var(--acc); width: 100%; height: 16px; margin: 0; }\n.ctl .tip { font-size: 10px; color: var(--tx-3); }\n\n/* 读数 */\n.readrow { display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px; }\n.read {\n  background: var(--card-2); border: 1px solid var(--line);\n  border-radius: 8px; padding: 6px 8px;\n}\n.read span { display: block; font-size: 10px; color: var(--tx-3); margin-bottom: 2px; }\n.read b { font-family: var(--mono); font-size: 15px; font-weight: 500; color: var(--acc); }\n.read b.warn { color: var(--gold); }\n.read b.bad { color: var(--bad); }\n\n/* 状态 */\n.verdict {\n  margin-top: 8px; padding: 8px 10px; border-radius: 8px;\n  font-size: 11px; border: 1px solid var(--line); background: var(--card-2); color: var(--tx-2);\n}\n.verdict b { font-size: 12px; margin-right: 6px; }\n.verdict.ok { border-color: rgba(72,135,120,.38); background: rgba(72,135,120,.10); color: var(--acc); }\n.verdict.ok b { color: var(--acc); }\n.verdict.warn { border-color: rgba(163,123,47,.40); background: rgba(163,123,47,.10); color: #795b1d; }\n.verdict.warn b { color: var(--gold); }\n.verdict.bad { border-color: rgba(153,62,48,.40); background: rgba(153,62,48,.10); color: #64251c; }\n.verdict.bad b { color: var(--bad); }\n.tag {\n  font-family: var(--mono); font-size: 9.5px; color: var(--gold);\n  border: 1px solid rgba(163,123,47,.35); background: rgba(163,123,47,.08);\n  border-radius: 5px; padding: 2px 6px; white-space: nowrap;\n}\n.foot { font-size: 10px; color: var(--tx-3); line-height: 1.5; margin: 4px 2px 0; }\n"
    },
    {
      "name": "demo/demo.js",
      "data": "/* ======= 井下复杂事故前兆智能预警 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  var N = 241, EVENT = 150, PRE = 128, BASE_FROM = 20, BASE_TO = 100, SCAN_FROM = 110;\n  var CH = [\n    { key: 'spp', name: '立压', unit: 'MPa', color: '#488778' },\n    { key: 'tor', name: '扭矩', unit: 'kN·m', color: '#a37b2f' },\n    { key: 'flow', name: '出口流量', unit: 'L/s', color: '#305880' }\n  ];\n  var raw = [];\n  var score = [];\n  var base = {};\n  var state = { thr: 3.2, lead: 12 };\n\n  function $(id) { return document.getElementById(id); }\n  function rnd(s) {\n    var v = Math.sin(s * 12.9898 + 4.117) * 43758.5453;\n    return v - Math.floor(v);\n  }\n  function gauss(s) {\n    return (rnd(s) + rnd(s + 0.7) + rnd(s + 1.9) + rnd(s + 3.3) - 2) / 1.2;\n  }\n  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }\n\n  function build() {\n    for (var t = 0; t < N; t++) {\n      var spp = 18.2 + 0.22 * Math.sin(t / 9) + 0.16 * gauss(t * 1.13);\n      var tor = 8.1 + 0.12 * Math.sin(t / 7 + 1) + 0.10 * gauss(t * 2.31);\n      var flow = 32.2 + 0.20 * Math.sin(t / 11 + 2) + 0.22 * gauss(t * 3.73);\n      if (t >= 38 && t <= 40) { tor += 0.38; flow -= 0.18; }\n      if (t >= 74 && t <= 76) { tor += 0.33; flow -= 0.15; }\n      if (t >= 96 && t <= 98) { tor += 0.42; flow -= 0.20; }\n      if (t >= PRE) {\n        var r = Math.min(1, (t - PRE) / 14);\n        tor += 0.65 * r + 0.035 * (t - PRE);\n        spp += 0.45 * r;\n        flow -= 0.55 * r;\n      }\n      if (t >= EVENT) {\n        var d = t - EVENT;\n        tor += 4.2 * (1 - Math.exp(-d / 4));\n        spp += 1.8 * (1 - Math.exp(-d / 6));\n        flow -= 4.6 * (1 - Math.exp(-d / 5));\n      }\n      raw.push({ spp: spp, tor: tor, flow: flow });\n    }\n    CH.forEach(function (c) {\n      var sum = 0, sum2 = 0, n = 0, t;\n      for (t = BASE_FROM; t <= BASE_TO; t++) { sum += raw[t][c.key]; sum2 += raw[t][c.key] * raw[t][c.key]; n++; }\n      var mean = sum / n;\n      var std = Math.sqrt(Math.max(1e-6, sum2 / n - mean * mean));\n      base[c.key] = { mean: mean, std: std };\n    });\n    for (t = 0; t < N; t++) {\n      var z2 = 0;\n      CH.forEach(function (c) {\n        var z = clamp((raw[t][c.key] - base[c.key].mean) / base[c.key].std, -8, 8);\n        z2 += z * z;\n      });\n      score.push(Math.sqrt(z2 / CH.length));\n    }\n    var smooth = score.slice();\n    for (t = 1; t < N - 1; t++) smooth[t] = (score[t - 1] + score[t] + score[t + 1]) / 3;\n    score = smooth;\n  }\n\n  function scan(from, to, thr) {\n    var out = [], above = false, start = 0, t;\n    for (t = from; t < to; t++) {\n      if (!above && score[t] >= thr) { above = true; start = t; }\n      else if (above && score[t] < thr - 0.35) {\n        above = false;\n        if (t - start >= 2) out.push(start);\n      }\n    }\n    if (above && to - start >= 2) out.push(start);\n    return out;\n  }\n\n  function evaluate() {\n    var episodes = scan(SCAN_FROM, N, state.thr);\n    var falseAlarms = scan(20, SCAN_FROM, state.thr).length;\n    var first = episodes.length ? episodes[0] : null;\n    var lead = first === null ? null : EVENT - first;\n    var timely = lead !== null && lead >= state.lead;\n    return { first: first, lead: lead, timely: timely, fa: falseAlarms, episodes: episodes };\n  }\n\n  function yOf(v) {\n    return 20 + (100 - v) / 100 * 152;\n  }\n  function xOf(t) {\n    return 30 + t / 240 * 394;\n  }\n\n  function drawChart(m) {\n    var s = '<rect x=\"0\" y=\"0\" width=\"430\" height=\"216\" fill=\"#edf2ec\" rx=\"6\"/>';\n    s += '<text x=\"10\" y=\"13\" font-size=\"8.5\" fill=\"#585f4f\">三通道归一化幅值（基线 ±4σ → 0—100）· 时间 min</text>';\n\n    var i, v, y;\n    for (i = 0; i <= 5; i++) {\n      v = i * 20;\n      y = yOf(v);\n      s += '<line x1=\"30\" y1=\"' + y.toFixed(1) + '\" x2=\"424\" y2=\"' + y.toFixed(1) + '\" stroke=\"#dee4d9\"/>';\n      s += '<text x=\"26\" y=\"' + (y + 2.5).toFixed(1) + '\" font-size=\"7.5\" fill=\"#838b7b\" text-anchor=\"end\">' + v + '</text>';\n    }\n    s += '<rect x=\"30\" y=\"' + yOf(75).toFixed(1) + '\" width=\"394\" height=\"' + (yOf(25) - yOf(75)).toFixed(1)\n      + '\" fill=\"#dee4d9\" opacity=\"0.55\"/>';\n    s += '<line x1=\"30\" y1=\"' + yOf(75).toFixed(1) + '\" x2=\"424\" y2=\"' + yOf(75).toFixed(1)\n      + '\" stroke=\"#838b7b\" stroke-width=\"0.8\" stroke-dasharray=\"4 4\" opacity=\"0.6\"/>';\n    s += '<text x=\"34\" y=\"' + (yOf(75) - 3).toFixed(1) + '\" font-size=\"7.5\" fill=\"#838b7b\">基线 ±2σ</text>';\n\n    for (i = 0; i <= 4; i++) {\n      s += '<text x=\"' + xOf(i * 60).toFixed(1) + '\" y=\"184\" font-size=\"7.5\" fill=\"#838b7b\" text-anchor=\"middle\">'\n        + (i * 60) + '</text>';\n    }\n\n    if (m.lead !== null && m.lead > 0) {\n      var xa = xOf(EVENT - state.lead), xb = xOf(EVENT);\n      s += '<rect x=\"' + xa.toFixed(1) + '\" y=\"20\" width=\"' + (xb - xa).toFixed(1) + '\" height=\"152\" fill=\"#a37b2f\" opacity=\"0.07\"/>';\n      s += '<text x=\"' + ((xa + xb) / 2).toFixed(1) + '\" y=\"31\" font-size=\"7.5\" fill=\"#a37b2f\" text-anchor=\"middle\">目标预警窗口</text>';\n    }\n\n    CH.forEach(function (c) {\n      var pts = [], t;\n      for (t = 0; t < N; t++) {\n        var val = clamp(50 + (raw[t][c.key] - base[c.key].mean) / base[c.key].std * 12.5, 3, 97);\n        pts.push(xOf(t).toFixed(1) + ',' + yOf(val).toFixed(1));\n      }\n      s += '<polyline points=\"' + pts.join(' ') + '\" fill=\"none\" stroke=\"' + c.color + '\" stroke-width=\"1.2\" opacity=\"0.9\"/>';\n    });\n\n    s += '<line x1=\"' + xOf(PRE).toFixed(1) + '\" y1=\"20\" x2=\"' + xOf(PRE).toFixed(1) + '\" y2=\"172\" stroke=\"#a37b2f\" stroke-width=\"1.2\" stroke-dasharray=\"4 3\"/>';\n    s += '<text x=\"' + (xOf(PRE) - 4).toFixed(1) + '\" y=\"34\" font-size=\"7.5\" fill=\"#a37b2f\" text-anchor=\"end\">前兆 128</text>';\n    s += '<line x1=\"' + xOf(EVENT).toFixed(1) + '\" y1=\"20\" x2=\"' + xOf(EVENT).toFixed(1) + '\" y2=\"172\" stroke=\"#993e30\" stroke-width=\"1.5\"/>';\n    s += '<text x=\"' + (xOf(EVENT) + 4).toFixed(1) + '\" y=\"46\" font-size=\"7.5\" fill=\"#993e30\">卡钻 150</text>';\n\n    if (m.first !== null) {\n      s += '<line x1=\"' + xOf(m.first).toFixed(1) + '\" y1=\"20\" x2=\"' + xOf(m.first).toFixed(1) + '\" y2=\"172\" stroke=\"#2a2517\" stroke-width=\"1.2\" opacity=\"0.9\"/>';\n      s += '<circle cx=\"' + xOf(m.first).toFixed(1) + '\" cy=\"20\" r=\"2.5\" fill=\"#2a2517\"/>';\n      s += '<text x=\"' + (xOf(m.first) + 4).toFixed(1) + '\" y=\"58\" font-size=\"7.5\" fill=\"#2a2517\">'\n        + (m.first <= EVENT ? '首次报警 ' + m.first : '报警 ' + m.first) + '</text>';\n    }\n\n    var lx = 34, ly = 196;\n    CH.forEach(function (c, k) {\n      s += '<line x1=\"' + (lx + k * 86) + '\" y1=\"' + ly + '\" x2=\"' + (lx + 16 + k * 86) + '\" y2=\"' + ly\n        + '\" stroke=\"' + c.color + '\" stroke-width=\"2\"/>';\n      s += '<text x=\"' + (lx + 21 + k * 86) + '\" y=\"' + (ly + 3) + '\" font-size=\"8\" fill=\"#585f4f\">' + c.name + '</text>';\n    });\n    s += '<line x1=\"34\" y1=\"' + (ly + 12) + '\" x2=\"50\" y2=\"' + (ly + 12) + '\" stroke=\"#993e30\" stroke-width=\"1.5\"/>';\n    s += '<text x=\"54\" y=\"' + (ly + 15) + '\" font-size=\"8\" fill=\"#585f4f\">事故时刻</text>';\n    s += '<line x1=\"120\" y1=\"' + (ly + 12) + '\" x2=\"136\" y2=\"' + (ly + 12) + '\" stroke=\"#2a2517\" stroke-width=\"1.2\"/>';\n    s += '<text x=\"140\" y=\"' + (ly + 15) + '\" font-size=\"8\" fill=\"#585f4f\">首次报警</text>';\n\n    $('chart').innerHTML = s;\n  }\n\n  function updateStats(m) {\n    var f = $('r-first'), l = $('r-lead'), fa = $('r-fa');\n    f.textContent = m.first === null ? '—' : m.first + ' min';\n    f.className = m.first === null ? 'bad' : '';\n    if (m.lead === null) {\n      l.textContent = '—';\n      l.className = 'bad';\n    } else if (m.lead >= 0) {\n      l.textContent = m.lead + ' min';\n      l.className = m.timely ? '' : 'warn';\n    } else {\n      l.textContent = '事故后 ' + (-m.lead) + ' min';\n      l.className = 'bad';\n    }\n    fa.textContent = m.fa + ' 次';\n    fa.className = m.fa === 0 ? '' : m.fa <= 2 ? 'warn' : 'bad';\n\n    var v = $('verdict');\n    if (m.first === null) {\n      v.className = 'verdict warn';\n      v.innerHTML = '<b>安全</b>当前阈值下未触发任何报警；本次卡钻前兆未被检出（漏报），建议把阈值下调到 3.0 以下再评估。';\n    } else if (m.timely) {\n      v.className = 'verdict warn';\n      v.innerHTML = '<b>预警</b>提前 ' + m.lead + ' 分钟报警，满足 ' + state.lead\n        + ' 分钟目标；120 min 前累计误报 ' + m.fa + ' 次' + (m.fa > 2 ? '，偏高，需检查传感器零点。' : '。');\n    } else {\n      v.className = 'verdict bad';\n      v.innerHTML = '<b>报警</b>首次报警' + (m.lead >= 0 ? '仅提前 ' + m.lead : '晚于事故 ' + (-m.lead))\n        + ' 分钟，未达到 ' + state.lead + ' 分钟目标，司钻来不及处置。';\n    }\n  }\n\n  var pending = false;\n  function render() {\n    if (pending) return;\n    pending = true;\n    requestAnimationFrame(function () {\n      pending = false;\n      var m = evaluate();\n      drawChart(m);\n      updateStats(m);\n      $('o-thr').textContent = state.thr.toFixed(1);\n      $('o-lead').textContent = state.lead + ' min';\n      $('mode-tag').textContent = '阈值 ' + state.thr.toFixed(1) + 'σ';\n    });\n  }\n\n  function bind() {\n    $('s-thr').addEventListener('input', function (e) {\n      state.thr = +e.target.value;\n      render();\n    });\n    $('s-lead').addEventListener('input', function (e) {\n      state.lead = +e.target.value;\n      render();\n    });\n  }\n\n  build();\n  bind();\n  render();\n})();\n"
    },
    {
      "name": "demo/index.html",
      "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：井下复杂事故前兆智能预警</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"wrap\">\n  <header>\n    <div class=\"eyebrow\">D2 · 钻井 · 时序预测</div>\n    <h1>井下复杂事故前兆预警 · 交互式演示</h1>\n    <p class=\"lead\">三条曲线是立压、扭矩、出口流量的归一化幅值（按各自基线 ±4σ 映射到 0—100）。第 128 分钟起扭矩抬升、流量下降，第 150 分钟发展为卡钻。拖动阈值与提前量，看预警时间和误报怎么权衡。</p>\n  </header>\n\n  <div class=\"layout\">\n    <div class=\"viz\">\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">01</span>多通道时序与报警时刻</h2>\n          <span class=\"tag\" id=\"tag\">1 Hz 采样 · 按 1 min 聚合</span>\n        </div>\n        <p class=\"hint\">红色竖线是卡钻发生时刻，金色虚线是前兆起点。蓝色竖线是模型首次报警；两条竖线之间的距离就是提前分钟数。</p>\n        <svg id=\"chart\" viewBox=\"0 0 430 216\" role=\"img\" aria-label=\"立压、扭矩、出口流量时序与报警\"></svg>\n      </section>\n    </div>\n\n    <div class=\"side\">\n      <section class=\"card\">\n        <div class=\"card-head\">\n          <h2><span class=\"num\">02</span>报警阈值与提前量目标</h2>\n          <span class=\"tag\" id=\"mode-tag\">阈值 3.2σ</span>\n        </div>\n        <div class=\"ctl2\">\n          <div class=\"ctl\">\n            <label>报警阈值 <output id=\"o-thr\">3.2</output></label>\n            <input type=\"range\" id=\"s-thr\" min=\"1.5\" max=\"6\" step=\"0.1\" value=\"3.2\">\n            <span class=\"tip\">多变量异常分数（各通道 z 值的均方根）超过该值并持续 2 min 才报警</span>\n          </div>\n          <div class=\"ctl\">\n            <label>提前量目标 <output id=\"o-lead\">12 min</output></label>\n            <input type=\"range\" id=\"s-lead\" min=\"5\" max=\"40\" step=\"1\" value=\"12\">\n            <span class=\"tip\">现场要求的预警提前时间；达到该目标才算有效预警</span>\n          </div>\n        </div>\n        <div class=\"readrow\">\n          <div class=\"read\"><span>首次报警时刻</span><b id=\"r-first\">—</b></div>\n          <div class=\"read\"><span>提前分钟数</span><b id=\"r-lead\">—</b></div>\n          <div class=\"read\"><span>误报次数</span><b id=\"r-fa\">—</b></div>\n        </div>\n        <div class=\"verdict\" id=\"verdict\">—</div>\n      </section>\n    </div>\n  </div>\n\n  <p class=\"foot\">示意数据：正常段 0—127 min，前兆 128—149 min，卡钻 150 min 起；各通道叠加确定性噪声。异常分数取三通道 z 值的均方根，120 min 前的越限计为误报。数值用于说明阈值与提前量的取舍，不代表现场实测。</p>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
    }
  ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动报警阈值与提前量目标，看首次报警时刻、提前分钟数和误报次数如何变化，以及系统给出安全、预警还是报警。",
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
