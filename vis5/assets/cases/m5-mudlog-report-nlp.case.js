/* =========================================================
   案例插件（静态注册版）：录井报告自动生成与要素抽取
   ---------------------------------------------------------
   由 cases/m5-mudlog-report-nlp/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "m5-mudlog-report-nlp",
    "sceneId": "m5",
    "methods": [
      "nlp"
    ],
    "title": "录井报告自动生成与要素抽取",
    "version": "1.0.0",
    "updated": "2026-10-25",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "录井日报要在班后 1—2 h 内提交，内容却散在综合录井仪、岩屑描述、钻井液班报和工程日报里。人工抄录、换算单位、套模板，一份 2 h 上下，漏项和单位错误很常见。把字段抽取与模板生成分开做，才能既快又可核查。",
        "judge": [
          {
            "label": "任务类型",
            "value": "信息抽取 + 模板生成",
            "desc": "12 个字段的结构化抽取与受控生成"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "300 份历史日报可做字段级弱标注"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "单份 2.2 h → 3.5 min + 12 min 审核"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "模板固定，但术语、单位与手写体歧义多"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>录井日报是钻井队、地质监督和甲方每天都要看的班报：12 h 一个班次，一份日报包含井深、钻时、气测全烃与 C1—C5、钻井液密度/粘度/失水、岩性描述、工程异常、下步建议等 8—12 个字段。一口 3,000 m 的井要出 60—90 份，每份都要在班后 1—2 h 内提交。</p><p>数据却是散的：综合录井仪以 1 s 或 1 m 采样输出 WITS/WITSML 流；岩屑描述写在纸质记录本或 Excel 里；钻井液性能记在另一张班报；工程异常（憋泵、井漏、气侵）记在工程日报或即时通讯群里。值班员要在 4—6 个来源之间来回找数、换算单位，再往 Word 模板里抄。</p><p>四个具体问题：<b>漏项</b>——一份日报平均漏 1—2 个字段，氯离子、密度、迟到时间最常缺；<b>单位混用</b>——气测原始数据是 ppm，报表要写 %，3.42% 与 34,200 ppm 经常混写；<b>术语歧义</b>——「显示」与「荧光」、「气测异常」与「气测升高」在不同班组含义不同；<b>版本失控</b>——探井、开发井、水平井用不同模板，套错会缺必填段。</p><div class=\"figure\"><svg viewBox=\"0 0 720 250\" width=\"100%\" role=\"img\" aria-label=\"多源记录人工汇总录井日报\"><rect x=\"0\" y=\"0\" width=\"720\" height=\"250\" fill=\"var(--paper-2)\" rx=\"6\"/><text x=\"18\" y=\"24\" font-size=\"11\" fill=\"var(--ink-2)\">图 A · 4—6 个来源、12 个字段，靠人工汇总成一份日报</text><rect x=\"18\" y=\"42\" width=\"145\" height=\"62\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"90\" y=\"62\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">综合录井仪</text><text x=\"90\" y=\"78\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">WITS 1 s · 气测/钻时</text><text x=\"90\" y=\"92\" font-size=\"9\" fill=\"var(--ink-4)\" text-anchor=\"middle\">结构化流</text><rect x=\"171\" y=\"42\" width=\"145\" height=\"62\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"243\" y=\"62\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">岩屑描述</text><text x=\"243\" y=\"78\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">手写记录本 / Excel</text><text x=\"243\" y=\"92\" font-size=\"9\" fill=\"var(--ink-4)\" text-anchor=\"middle\">自由文本</text><rect x=\"18\" y=\"114\" width=\"145\" height=\"62\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"90\" y=\"134\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">钻井液班报</text><text x=\"90\" y=\"150\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">密度 / 粘度 / 失水</text><text x=\"90\" y=\"164\" font-size=\"9\" fill=\"var(--ink-4)\" text-anchor=\"middle\">表格</text><rect x=\"171\" y=\"114\" width=\"145\" height=\"62\" rx=\"6\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"243\" y=\"134\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">工程日报 / 群消息</text><text x=\"243\" y=\"150\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">泵压 / 漏失 / 气侵</text><text x=\"243\" y=\"164\" font-size=\"9\" fill=\"var(--ink-4)\" text-anchor=\"middle\">非结构化</text><rect x=\"344\" y=\"64\" width=\"94\" height=\"88\" rx=\"7\" fill=\"var(--card-soft)\" stroke=\"var(--c-nlp)\"/><text x=\"391\" y=\"88\" font-size=\"9.5\" fill=\"var(--ink-2)\" text-anchor=\"middle\">人工汇总</text><text x=\"391\" y=\"106\" font-size=\"11\" fill=\"var(--c-nlp)\" text-anchor=\"middle\">1.5—2.5 h</text><text x=\"391\" y=\"124\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">找数 / 换算 / 套模板</text><text x=\"391\" y=\"140\" font-size=\"9\" fill=\"var(--bad)\" text-anchor=\"middle\">平均漏 1—2 项</text><path d=\"M320 96 L338 96\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\"/><path d=\"M330 92 L338 96 L330 100\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\" fill=\"none\"/><path d=\"M320 140 L338 140\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\"/><path d=\"M330 136 L338 140 L330 144\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\" fill=\"none\"/><path d=\"M442 108 L462 108\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\"/><path d=\"M454 104 L462 108 L454 112\" stroke=\"var(--ink-3)\" stroke-width=\"1.3\" fill=\"none\"/><rect x=\"470\" y=\"38\" width=\"230\" height=\"186\" rx=\"5\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><rect x=\"470\" y=\"38\" width=\"230\" height=\"26\" rx=\"5\" fill=\"var(--paper-3)\"/><text x=\"585\" y=\"56\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">录井日报（12 h 班报）</text><text x=\"484\" y=\"86\" font-size=\"9\" fill=\"var(--ink-3)\">井深 / 钻时 / 层位</text><text x=\"484\" y=\"106\" font-size=\"9\" fill=\"var(--ink-3)\">气测全烃 / C1—C5</text><text x=\"484\" y=\"126\" font-size=\"9\" fill=\"var(--ink-3)\">钻井液密度 / 粘度</text><text x=\"484\" y=\"146\" font-size=\"9\" fill=\"var(--ink-3)\">岩性描述 / 荧光</text><text x=\"484\" y=\"166\" font-size=\"9\" fill=\"var(--ink-3)\">工程异常 / 下步建议</text><rect x=\"610\" y=\"112\" width=\"78\" height=\"20\" rx=\"3\" fill=\"var(--bad-bg)\"/><text x=\"649\" y=\"126\" font-size=\"8.5\" fill=\"var(--bad)\" text-anchor=\"middle\">缺氯离子</text><rect x=\"514\" y=\"178\" width=\"126\" height=\"20\" rx=\"3\" fill=\"var(--bad-bg)\"/><text x=\"577\" y=\"192\" font-size=\"8.5\" fill=\"var(--bad)\" text-anchor=\"middle\">3.42% 写成 34,200%</text><text x=\"18\" y=\"214\" font-size=\"9\" fill=\"var(--ink-2)\">问题：字段散、模板多、单位混、术语不统一；审核只能靠人逐项对原文</text><text x=\"18\" y=\"232\" font-size=\"9\" fill=\"var(--ink-3)\">结果：单份 2.2 h，格式一致率 82%，数值错漏约 3 处/份</text></svg><div class=\"figcap\"><b>图 1</b><span>录井日报的多源现状：结构化流、手写描述、表格班报和群消息，最后靠人工汇总进模板</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>做法是「抽取 → 校验 → 模板填充 → 审核」，而不是让大模型直接写一篇日报。第一步用正则和词典抽确定性字段：井深、时间、钻时、密度、粘度、全烃与 C1—C5 数值；第二步用微调过的 BERT 或 LLM 做命名实体识别，抽岩性描述、工程异常、下步建议这类自由文本；第三步做单位归一（ppm→%，kg/m³→g/cm³）和量程、相邻班次校验。</p><p>模板生成只允许「引用」抽取结果：固定 12 段模板，数值字段锁定 token，摘要句必须带来源行号，模型不能自己编数字。这样即使生成模型改写措辞，也不会把 3.42% 写成 4.32% 或 34,200%。</p><p>最后是人工审核闭环：置信度低于 0.75 的字段标红，审核界面左侧原文、右侧字段并排；审核员的每次修改都记录为偏好样本，每周回灌。输出直接对接日报系统与井史数据库，报告里每个数字都能点回原文行。</p><div class=\"figure\"><svg viewBox=\"0 0 720 240\" width=\"100%\" role=\"img\" aria-label=\"多源文本到字段抽取再到模板生成与人工审核\"><rect x=\"0\" y=\"0\" width=\"720\" height=\"240\" fill=\"var(--paper-2)\" rx=\"6\"/><text x=\"18\" y=\"24\" font-size=\"11\" fill=\"var(--ink-2)\">多源文本 → 字段抽取 → 模板生成 → 人工审核</text><rect x=\"18\" y=\"48\" width=\"156\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"96\" y=\"68\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">① 多源文本</text><text x=\"96\" y=\"88\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">WITS · 手写扫描件</text><text x=\"96\" y=\"104\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">Excel · 群消息</text><text x=\"96\" y=\"126\" font-size=\"9\" fill=\"var(--c-nlp)\" text-anchor=\"middle\">4 类来源 · 带行号</text><rect x=\"194\" y=\"48\" width=\"156\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"272\" y=\"68\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">② 字段抽取</text><text x=\"272\" y=\"88\" font-size=\"9\" fill=\"var(--ink-2)\" text-anchor=\"middle\">井深 3245.0—3252.0 m</text><text x=\"272\" y=\"104\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">正则 + NER + 单位归一</text><text x=\"272\" y=\"126\" font-size=\"9\" fill=\"var(--c-nlp)\" text-anchor=\"middle\">置信度 0.98 / 0.68</text><rect x=\"370\" y=\"48\" width=\"156\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"448\" y=\"68\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">③ 模板生成</text><text x=\"448\" y=\"88\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">12 段固定模板</text><text x=\"448\" y=\"104\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">数值 token 锁定</text><text x=\"448\" y=\"126\" font-size=\"9\" fill=\"var(--c-nlp)\" text-anchor=\"middle\">每句带来源行号</text><rect x=\"546\" y=\"48\" width=\"156\" height=\"96\" rx=\"7\" fill=\"var(--card)\" stroke=\"var(--line-3)\"/><text x=\"624\" y=\"68\" font-size=\"10\" fill=\"var(--ink-2)\" text-anchor=\"middle\">④ 人工审核</text><text x=\"624\" y=\"88\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">低置信标红</text><text x=\"624\" y=\"104\" font-size=\"9\" fill=\"var(--ink-3)\" text-anchor=\"middle\">左原文 / 右字段</text><text x=\"624\" y=\"126\" font-size=\"9\" fill=\"var(--c-nlp)\" text-anchor=\"middle\">修改回流为偏好样本</text><path d=\"M174 96 L188 96\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\"/><path d=\"M182 92 L190 96 L182 100\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\" fill=\"none\"/><path d=\"M350 96 L364 96\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\"/><path d=\"M358 92 L366 96 L358 100\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\" fill=\"none\"/><path d=\"M526 96 L540 96\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\"/><path d=\"M534 92 L542 96 L534 100\" stroke=\"var(--ink-3)\" stroke-width=\"1.4\" fill=\"none\"/><line x1=\"18\" y1=\"162\" x2=\"702\" y2=\"162\" stroke=\"var(--line)\"/><text x=\"18\" y=\"184\" font-size=\"9\" fill=\"var(--ink-2)\">门控：置信度 &lt; 0.75 的字段标红，人工确认前不得发布；结论性表述（漏失、气侵、井涌）必须人工确认</text><text x=\"18\" y=\"202\" font-size=\"9\" fill=\"var(--ink-3)\">生成阶段只允许引用抽取结果，禁止改写数值与单位；数值 token 回读校验，不一致直接退回</text><rect x=\"18\" y=\"212\" width=\"684\" height=\"16\" rx=\"3\" fill=\"var(--bg-nlp)\"/><text x=\"360\" y=\"224\" font-size=\"9\" fill=\"var(--ink-2)\" text-anchor=\"middle\">输出：12 个字段 + 来源行号 + 置信度 → 审核后写入日报与井史库</text></svg><div class=\"figcap\"><b>图 2</b><span>抽取式流水线：先抽字段并校验来源，再套模板生成，最后用置信度门控把低可信内容交给人</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">字段抽取的门槛不高，但需要「原文 + 字段」逐行对齐的标注；没有审核痕迹的历史日报价值最高。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">历史录井日报</span><span class=\"cl-s\">300—500 份，覆盖 6 口井</span></span><span class=\"cl-n\">含审核修改痕迹</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">综合录井仪原始数据</span><span class=\"cl-s\">WITS/WITSML，1 s 或 1 m</span></span><span class=\"cl-n\">与日报班次对齐</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩屑描述记录</span><span class=\"cl-s\">手写扫描件 + Excel 转录</span></span><span class=\"cl-n\">按包对应井深</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">字段级标注</span><span class=\"cl-s\">12 个必填字段，逐行给来源</span></span><span class=\"cl-n\">双人核对，歧义字段留备注</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">术语与单位词典</span><span class=\"cl-s\">约 200 条同义词 + 换算表</span></span><span class=\"cl-n\">区块级维护，季度更新</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>中</b>。字段位置和模板相对固定，正则加小模型就能拿到 90% 以上的召回；真正难的是<b>边界情况</b>：手写体 OCR、单位混用、术语歧义，以及生成阶段的「不许编数」。</p><p>三条经验：① 先做字段级抽取，再做模板填充，不要让一个端到端模型同时负责理解和写作；② 所有数值必须带来源行号，审核界面能一键跳回原文；③ 把「人工修改字符占比」作为核心指标，而不是只看 BLEU 或 ROUGE——业务只关心审核员改了多少。</p><p>风险：大模型可能把上一班的数值「顺」到这一班，或把「疑似漏失」写成「确认漏失」。凡是结论性表述（漏失、气侵、井涌）必须由人确认，模型只做提示。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/nlp\">命名实体识别<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/nlp\">信息抽取<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/nlp\">受控生成<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/nlp\">检索增强<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "塔里木 XX 区块 6 口井 428 份录井日报的自动生成",
        "lead": [
          "XX 区块 2025 年完成 6 口开发井，累计 428 份 12 h 班报。每份日报 12 个必填字段，原文来自综合录井仪、岩屑记录、钻井液班报和工程日报四类来源，共 1.2 GB 文本与表格。",
          "试运行目标不是「无人值守」，而是把值班员从 2.2 h 抄录压缩到 15 min 审核，同时把单位错误和漏项压到 1% 以下。"
        ],
        "stats": [
          [
            "日报份数",
            "428 份"
          ],
          [
            "必填字段",
            "12 个"
          ],
          [
            "原始记录",
            "1.2 GB / 4 类来源"
          ],
          [
            "人工编写",
            "2.2 h / 份"
          ],
          [
            "自动生成",
            "3.5 min / 份"
          ],
          [
            "字段召回",
            "94.2%"
          ]
        ],
        "steps": [
          {
            "name": "多源接入与版面解析",
            "role": "数据",
            "do": "接入 WITS 实时流（1 s）、PDF 与扫描件（OCR，中文手写 CER 约 8%）、Word/Excel 班报；统一时间戳到 UTC+8，按 12 h 班次切分，给每段文本分配来源 ID 与行号。",
            "effect": "4 类来源汇成单一时间轴，任意字段都能回溯到原文行",
            "trap": "手写「3」和「8」、「岩」和「宕」容易混，必须靠数值量程和词典做二次校验"
          },
          {
            "name": "字段抽取与单位归一",
            "role": "算法核心",
            "do": "正则加词典抽井深、时间、钻时、密度、粘度、气测；BERT 微调 NER 抽岩性、工程异常、下步建议；统一单位（ppm→%，kg/m³→g/cm³），同时保留原始值与换算值。",
            "effect": "12 字段召回 94.2%，精确率 96.8%",
            "trap": "全烃 3.42% 与 C1 2.71% 出现在同一行，正则贪婪匹配会把两个值串在一起"
          },
          {
            "name": "数值一致性校验",
            "role": "校验",
            "do": "与上一班次对比：井深回退、密度变化超过 0.08 g/cm³、气测突增 3 倍、泵压下降超过 20% 时触发复核；超量程（全烃 > 100%）直接拒收。",
            "effect": "拦截 87% 的录入错误，同时把真实气侵标成高优先级",
            "trap": "真实气侵也会让气测突增，不能一律当错误拒掉，要交人工判断"
          },
          {
            "name": "模板生成与数值回读",
            "role": "生成",
            "do": "按井型选模板（探井/开发井/水平井），固定 12 段；数值字段用占位符锁定，摘要句由检索到的字段拼接并附来源行号；生成后再做一次数值回读校验。",
            "effect": "3.5 min 出草稿，格式一致率 100%",
            "trap": "生成模型可能改写数值或把「疑似」写成「确认」，必须锁定数值 token 并禁用结论性改写"
          },
          {
            "name": "人工审核闭环",
            "role": "质控",
            "do": "置信度低于 0.75 的字段标红，审核界面左侧原文、右侧字段并排；修改记录作为偏好样本每周回灌；词典和模板按区块季度更新。",
            "effect": "人工修改字符占比 4.8%，日报返工率低于 3%",
            "trap": "审核员图省事直接点通过，会把错误固化；需要每周抽检 10% 已发布日报"
          }
        ],
        "metrics": {
          "title": "怎么算「报告生成得好」",
          "html": "<p>日报的「好」不是文采，而是<b>字段齐全、数值可核、审核省时</b>。核心指标是字段级召回与数值完全匹配率，辅以人工修改字符占比。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>人工编写</th><th>本方法</th></tr></thead><tbody><tr><td>字段完整率</td><td>12 个必填字段齐全的份数占比</td><td>86%</td><td>97.5%</td></tr><tr><td>字段召回</td><td>正确抽出的字段 / 应抽字段</td><td>100%（基准）</td><td>94.2%</td></tr><tr><td>数值错漏</td><td>每份日报错误或缺失的数值</td><td>3.1 处</td><td>0.4 处</td></tr><tr><td>单份耗时</td><td>编写 + 审核</td><td>2.2 h</td><td>3.5 min + 12 min</td></tr><tr><td>格式一致率</td><td>符合模板与必填段要求</td><td>82%</td><td>100%</td></tr><tr><td>人工修改字符</td><td>审核员改动的字符占比</td><td>—</td><td>4.8%</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "手写体连笔字",
            "why": "「砂岩」连笔被 OCR 识成「砂宕」，字段抽取直接失败。需要图像去噪、地质词典约束，并把低置信结果转人工。"
          },
          {
            "name": "单位混用",
            "why": "气测原始 ppm 与报表 % 混用，3.42% 被写成 34,200%，放大 10,000 倍。必须强制单位归一，并在模板里锁定单位。"
          },
          {
            "name": "模板套错",
            "why": "探井模板要求氯离子和迟到时间，开发井模板没有这两项；套错会缺必填段。需先判井型再选模板，并做必填段校验。"
          }
        ]
      }
    }
  };

  var FILES = [
      {
        "name": "demo/demo.css",
        "data": "/* ========= 录井报告自动生成与要素抽取 · 可运行示范 ========= */\n* { box-sizing: border-box; }\n:root {\n  --bg: #12160f;\n  --card: #1a1f16;\n  --card-2: #20261b;\n  --line: #2e3527;\n  --tx: #e8e3d5;\n  --tx-2: #a9b0a0;\n  --tx-3: #7c8474;\n  --acc: #78b7a8;\n  --gold: #d0a85c;\n  --bad: #cf7466;\n  --violet: #b49acb;\n  --mono: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;\n}\nbody {\n  margin: 0; padding: 28px 24px 36px;\n  background: var(--bg); color: var(--tx);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  line-height: 1.62; -webkit-font-smoothing: antialiased;\n}\n.wrap { max-width: 1040px; margin: 0 auto; }\nheader { margin-bottom: 20px; }\n.eyebrow {\n  font-family: var(--mono); font-size: 10px; letter-spacing: .18em;\n  color: var(--violet); text-transform: uppercase; margin-bottom: 6px;\n}\nh1 { font-size: 22px; font-weight: 600; margin: 0 0 6px; }\n.lead { margin: 0; max-width: 800px; font-size: 13px; color: var(--tx-2); }\n.card {\n  background: var(--card); border: 1px solid var(--line);\n  border-radius: 12px; padding: 18px 20px; margin-bottom: 16px;\n}\n.card-head {\n  display: flex; align-items: center; justify-content: space-between;\n  gap: 12px; flex-wrap: wrap; margin-bottom: 12px;\n}\nh2 { font-size: 14px; font-weight: 600; margin: 0; }\nh2 .num {\n  font-family: var(--mono); font-size: 10px; color: var(--acc);\n  border: 1px solid rgba(120,183,168,.35); border-radius: 4px;\n  padding: 1px 5px; margin-right: 7px; letter-spacing: .08em;\n}\n.tag {\n  font-family: var(--mono); font-size: 10.5px; color: var(--gold);\n  border: 1px solid rgba(208,168,92,.35); background: rgba(208,168,92,.08);\n  border-radius: 5px; padding: 3px 8px; white-space: nowrap;\n}\n.hint { font-size: 11.5px; color: var(--tx-3); }\n.split { display: grid; grid-template-columns: 1.02fr 1fr; gap: 16px; align-items: start; }\n@media (max-width: 800px) { .split { grid-template-columns: 1fr; } }\n.pane {\n  background: var(--card-2); border: 1px solid var(--line);\n  border-radius: 9px; overflow: hidden;\n}\n.pane-head {\n  display: flex; justify-content: space-between; align-items: center;\n  padding: 8px 12px; border-bottom: 1px solid var(--line);\n  font-size: 11px; color: var(--tx-2); background: #1c2117;\n}\n.mono { font-family: var(--mono); font-size: 10px; color: var(--tx-3); }\n\n/* 原始记录 */\n.src { padding: 10px 0; max-height: 486px; overflow-y: auto; }\n.line {\n  display: flex; gap: 10px; padding: 5px 12px;\n  font-family: var(--mono); font-size: 11.5px; line-height: 1.75;\n  color: var(--tx-2);\n}\n.line .ln { color: var(--tx-3); opacity: .65; flex-shrink: 0; user-select: none; }\n.line .tx { flex: 1; word-break: break-all; }\nmark {\n  background: rgba(120,183,168,.16); color: #dcefe9;\n  border-bottom: 1px solid rgba(120,183,168,.55);\n  padding: 0 1px; border-radius: 2px;\n}\nmark.hot { background: rgba(120,183,168,.30); color: #fff; border-bottom-color: var(--acc); }\nmark.low { background: rgba(207,116,102,.18); color: #f0c3bb; border-bottom-color: var(--bad); }\nmark.low.hot { background: rgba(207,116,102,.32); }\n\n/* 字段卡 */\n.fields { padding: 9px 10px; display: flex; flex-direction: column; gap: 7px; }\n.fld {\n  border: 1px solid var(--line); border-radius: 7px;\n  padding: 8px 10px; background: #1b2118; transition: border-color .18s, background .18s;\n}\n.fld.idle { opacity: .38; }\n.fld.on { opacity: 1; }\n.fld.hot { border-color: rgba(120,183,168,.55); background: #1e261b; }\n.fld.low { border-color: rgba(207,116,102,.55); background: rgba(207,116,102,.07); }\n.fld-top { display: flex; align-items: center; gap: 8px; }\n.nm { font-size: 11.5px; color: var(--tx); flex: 1; }\n.src-badge {\n  font-family: var(--mono); font-size: 9.5px; color: var(--tx-3);\n  border: 1px solid var(--line); border-radius: 3px; padding: 0 5px;\n}\n.cf { font-family: var(--mono); font-size: 10.5px; color: var(--acc); }\n.fld.low .cf { color: var(--bad); }\n.val {\n  font-family: var(--mono); font-size: 12.5px; color: var(--tx);\n  margin: 4px 0 5px; line-height: 1.45;\n}\n.bar { height: 3px; background: var(--line); border-radius: 2px; overflow: hidden; }\n.bar i { display: block; height: 100%; background: var(--acc); }\n.fld.low .bar i { background: var(--bad); }\n.note { font-size: 10px; color: var(--tx-3); margin-top: 4px; }\n.fld.low .note { color: #d99a90; }\n\n/* 按钮 */\n.actions { display: flex; align-items: center; gap: 9px; margin-top: 12px; flex-wrap: wrap; }\nbutton {\n  padding: 7px 15px; border-radius: 6px; font-size: 12.5px; cursor: pointer;\n  border: 1px solid var(--line); background: transparent; color: var(--tx-2);\n  transition: border-color .15s, color .15s, background .15s;\n}\nbutton:hover { border-color: var(--tx-3); color: var(--tx); }\nbutton.primary { background: var(--acc); border-color: var(--acc); color: #0f1a15; font-weight: 600; }\nbutton.primary:hover { background: #8fc9bb; color: #0b1510; }\nbutton.ghost { color: var(--tx-3); }\n.hint { margin-left: auto; }\n\n/* 滑杆 */\n.ctl { display: flex; flex-direction: column; gap: 5px; margin-bottom: 4px; max-width: 560px; }\n.ctl label { font-size: 12.5px; display: flex; justify-content: space-between; color: var(--tx-2); }\n.ctl output { font-family: var(--mono); color: var(--acc); font-weight: 600; }\n.ctl input[type=\"range\"] { width: 100%; accent-color: var(--acc); }\n.ctl .tip { font-size: 11px; color: var(--tx-3); }\n#gate { width: 100%; height: auto; display: block; margin-top: 10px; background: var(--card-2); border: 1px solid var(--line); border-radius: 8px; }\n\n/* 读数与状态 */\n.readrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }\n@media (max-width: 680px) { .readrow { grid-template-columns: 1fr; } }\n.read { background: var(--card-2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }\n.read span { display: block; font-size: 10.5px; color: var(--tx-3); margin-bottom: 4px; }\n.read b { font-family: var(--mono); font-size: 19px; font-weight: 500; color: var(--acc); }\n.read b.bad { color: var(--bad); }\n.read b.gold { color: var(--gold); }\n.verdict {\n  margin-top: 12px; padding: 11px 14px; border-radius: 8px;\n  font-size: 12.5px; border: 1px solid var(--line); background: var(--card-2); color: var(--tx-2);\n}\n.verdict b { font-size: 13.5px; margin-right: 8px; }\n.verdict.ok { border-color: rgba(120,183,168,.38); background: rgba(120,183,168,.10); color: var(--acc); }\n.verdict.ok b { color: var(--acc); }\n.verdict.bad { border-color: rgba(207,116,102,.40); background: rgba(207,116,102,.10); color: #e3a49b; }\n.verdict.bad b { color: var(--bad); }\n.foot { font-size: 11px; color: var(--tx-3); line-height: 1.7; margin: 4px 2px 0; }\n"
      },
      {
        "name": "demo/demo.js",
        "data": "/* ======= 录井报告自动生成与要素抽取 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  var LINES = [\n    { src: '班次', text: '班次 2026-10-24 08:00—20:00　井号 XX-12　井型 开发井' },\n    { src: '录井仪', text: '井深 3245.0—3252.0 m，钻时 8.5 min/m，层位 三叠系。' },\n    { src: '录井仪', text: '气测：全烃 3.42%，C1 2.71%，C2 0.38%，组分齐全。' },\n    { src: '岩屑', text: '岩性：灰色荧光细砂岩，含油迹，泥质胶结，分选中等。' },\n    { src: '钻井液', text: '钻井液密度 1.28 g/cm³，粘度 46 s，失水 4.2 mL。' },\n    { src: '工程', text: '02:40 泵压由 18.6 MPa 降至 12.4 MPa，排量 28 L/s。' },\n    { src: '工程', text: '循环观察见少量气泡，未见明显溢流。' },\n    { src: '录井仪', text: '迟到时间 42 min，捞样 7 包，烘干后描述。' },\n    { src: '工程', text: '下步建议：降低密度至 1.24 g/cm³，加强气测监控。' },\n    { src: '审核', text: '值班：张　审核：李　备注：气测异常待监督确认。' }\n  ];\n  var TEXT = LINES.map(function (l) { return l.text; }).join('\\n');\n  var OFFSETS = [];\n  (function () {\n    var p = 0;\n    LINES.forEach(function (l) { OFFSETS.push(p); p += l.text.length + 1; });\n  })();\n\n  var FIELDS = [\n    { key: 'depth', name: '井深段', short: '井深段', conf: 0.98, note: '正则命中，区间格式与上一班连续',\n      re: /(\\d{4}\\.\\d)\\s*[—~-]\\s*(\\d{4}\\.\\d)\\s*m/,\n      val: function (m) { return m[1] + '—' + m[2] + ' m'; } },\n    { key: 'rop', name: '钻时', short: '钻时', conf: 0.96, note: '数值与单位完整，与钻时曲线一致',\n      re: /钻时\\s*([\\d.]+)\\s*min\\/m/,\n      val: function (m) { return m[1] + ' min/m'; } },\n    { key: 'gas', name: '气测峰值', short: '气测', conf: 0.94, note: '全烃与 C1 分离命中，单位统一为 %',\n      re: /全烃\\s*([\\d.]+)\\s*%/,\n      val: function (m) { return '全烃 ' + m[1] + '%'; } },\n    { key: 'lith', name: '岩性', short: '岩性', conf: 0.68, note: '自由文本 NER；荧光与油迹术语存在歧义',\n      re: /岩性[：:]\\s*([^，。\\n]+)/,\n      val: function (m) { return m[1]; } },\n    { key: 'mud', name: '钻井液密度', short: '密度', conf: 0.92, note: '单位 g/cm³ 与量程校验通过',\n      re: /密度\\s*([\\d.]+)\\s*g\\/cm³/,\n      val: function (m) { return m[1] + ' g/cm³'; } },\n    { key: 'event', name: '工程异常', short: '异常', conf: 0.81, note: '事件句抽取；泵压降幅 33%，需判断漏失',\n      re: /泵压由\\s*([\\d.]+)\\s*MPa\\s*降至\\s*([\\d.]+)\\s*MPa/,\n      val: function (m) { return '泵压 ' + m[1] + ' → ' + m[2] + ' MPa'; } }\n  ];\n\n  var state = { revealed: 6, threshold: 0.75 };\n  var timer = null;\n  var spans = {};\n\n  function $(id) { return document.getElementById(id); }\n  function esc(t) {\n    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n  }\n  function lineOf(pos) {\n    for (var i = LINES.length - 1; i >= 0; i--) {\n      if (pos >= OFFSETS[i]) return i;\n    }\n    return 0;\n  }\n  function pad(n) { return (n < 10 ? '0' : '') + n; }\n\n  function buildSpans() {\n    FIELDS.forEach(function (f) {\n      var m = f.re.exec(TEXT);\n      if (!m) return;\n      spans[f.key] = {\n        start: m.index,\n        end: m.index + m[0].length,\n        line: lineOf(m.index),\n        value: f.val(m)\n      };\n    });\n  }\n\n  function shownFields() {\n    return FIELDS.slice(0, state.revealed);\n  }\n\n  function markClass(f, isHot) {\n    var cls = f.conf < state.threshold ? 'low' : '';\n    if (isHot) cls += (cls ? ' ' : '') + 'hot';\n    return cls;\n  }\n\n  function renderSource() {\n    var shown = shownFields();\n    var current = shown.length ? shown[shown.length - 1].key : '';\n    var s = '';\n    LINES.forEach(function (line, li) {\n      var base = OFFSETS[li];\n      var end = base + line.text.length;\n      var hits = [];\n      shown.forEach(function (f) {\n        var sp = spans[f.key];\n        if (!sp) return;\n        var a = Math.max(sp.start, base), b = Math.min(sp.end, end);\n        if (a < b) hits.push({ a: a - base, b: b - base, f: f });\n      });\n      hits.sort(function (p, q) { return p.a - q.a; });\n      var body = '', cur = 0;\n      hits.forEach(function (h) {\n        body += esc(line.text.slice(cur, h.a));\n        body += '<mark class=\"' + markClass(h.f, h.f.key === current) + '\" title=\"' +\n          h.f.name + ' · 置信度 ' + h.f.conf.toFixed(2) + '\">' +\n          esc(line.text.slice(h.a, h.b)) + '</mark>';\n        cur = h.b;\n      });\n      body += esc(line.text.slice(cur));\n      s += '<div class=\"line\"><span class=\"ln\">' + pad(li + 1) + '</span><span class=\"tx\">' + body + '</span></div>';\n    });\n    $('src').innerHTML = s;\n  }\n\n  function renderCards() {\n    var shown = shownFields();\n    var s = '';\n    FIELDS.forEach(function (f, i) {\n      var isShown = i < shown.length;\n      var low = f.conf < state.threshold;\n      var hot = isShown && i === shown.length - 1;\n      var cls = 'fld ' + (isShown ? 'on' : 'idle');\n      if (isShown && low) cls += ' low';\n      if (isShown && hot) cls += ' hot';\n      var sp = spans[f.key];\n      var srcTag = isShown && sp ? '来源 L' + pad(sp.line + 1) : '待抽取';\n      var cf = isShown ? (f.conf * 100).toFixed(0) + '%' : '—';\n      var val = isShown && sp ? sp.value : '—';\n      var note = isShown ? f.note : '等待生成';\n      if (isShown && low) note += ' · 低于阈值，待人工确认';\n      s += '<div class=\"' + cls + '\">' +\n        '<div class=\"fld-top\"><span class=\"nm\">' + f.name + '</span><span class=\"src-badge\">' + srcTag +\n        '</span><span class=\"cf\">' + cf + '</span></div>' +\n        '<div class=\"val\">' + esc(val) + '</div>' +\n        '<div class=\"bar\"><i style=\"width:' + (isShown ? f.conf * 100 : 0) + '%\"></i></div>' +\n        '<div class=\"note\">' + esc(note) + '</div></div>';\n    });\n    $('cards').innerHTML = s;\n  }\n\n  function drawGate() {\n    var svg = $('gate');\n    var W = 760, H = 170, L = 52, R = 744, T = 30, B = 122;\n    var pw = R - L, ph = B - T;\n    function yOf(v) { return B - (v - 0.5) / 0.5 * ph; }\n    var s = '<text x=\"14\" y=\"18\" font-size=\"9.5\" fill=\"var(--tx-3)\">字段置信度与采纳阈值（0.50—1.00）</text>';\n    var v;\n    for (v = 0.5; v <= 1.0001; v += 0.1) {\n      s += '<line x1=\"' + L + '\" y1=\"' + yOf(v) + '\" x2=\"' + R + '\" y2=\"' + yOf(v) + '\" stroke=\"var(--line)\" stroke-width=\".7\"/>';\n      s += '<text x=\"' + (L - 8) + '\" y=\"' + (yOf(v) + 3.5) + '\" font-size=\"9\" fill=\"var(--tx-3)\" text-anchor=\"end\">' + v.toFixed(1) + '</text>';\n    }\n    var yt = yOf(state.threshold);\n    s += '<line x1=\"' + L + '\" y1=\"' + yt + '\" x2=\"' + R + '\" y2=\"' + yt + '\" stroke=\"var(--gold)\" stroke-width=\"1.2\" stroke-dasharray=\"5 3\"/>';\n    s += '<text x=\"' + (R - 4) + '\" y=\"' + (yt - 6) + '\" font-size=\"9\" fill=\"var(--gold)\" text-anchor=\"end\">阈值 ' + state.threshold.toFixed(2) + '</text>';\n    FIELDS.forEach(function (f, i) {\n      var x = L + (i + 0.5) * pw / FIELDS.length;\n      var low = f.conf < state.threshold;\n      var y = yOf(f.conf);\n      s += '<rect x=\"' + (x - 19) + '\" y=\"' + y + '\" width=\"38\" height=\"' + Math.max(1, B - y) + '\" rx=\"2\" fill=\"' + (low ? 'var(--bad)' : 'var(--acc)') + '\" opacity=\".82\"/>';\n      s += '<text x=\"' + x + '\" y=\"' + (y - 5) + '\" font-size=\"9.5\" fill=\"' + (low ? 'var(--bad)' : 'var(--acc)') + '\" text-anchor=\"middle\" font-family=\"var(--mono)\">' + f.conf.toFixed(2) + '</text>';\n      s += '<text x=\"' + x + '\" y=\"' + (B + 17) + '\" font-size=\"10\" fill=\"' + (low ? 'var(--bad)' : 'var(--tx-2)') + '\" text-anchor=\"middle\">' + f.short + '</text>';\n    });\n    svg.innerHTML = s;\n  }\n\n  function renderReads() {\n    var shown = shownFields();\n    var adopted = shown.filter(function (f) { return f.conf >= state.threshold; });\n    var manual = shown.length - adopted.length;\n    var rec = shown.length ? (adopted.length / FIELDS.length * 100) : 0;\n\n    $('r-rec').textContent = shown.length ? rec.toFixed(1) + '%' : '—';\n    $('r-rec').className = rec >= 83 ? '' : 'bad';\n    $('r-man').textContent = shown.length ? String(manual) : '—';\n    $('r-man').className = manual > 0 ? 'bad' : '';\n    $('r-chk').textContent = shown.length ? adopted.length + ' / ' + shown.length + ' 通过' : '—';\n    $('r-chk').className = manual > 0 ? 'gold' : '';\n    $('field-count').textContent = shown.length + ' / ' + FIELDS.length;\n    $('gen-hint').textContent = shown.length === FIELDS.length\n      ? '已生成 6 / 6 字段 · 模板：开发井 12 h 班报'\n      : '正在生成 ' + shown.length + ' / 6 …';\n\n    var v = $('verdict');\n    if (!shown.length) {\n      v.className = 'verdict';\n      v.innerHTML = '<b>待生成</b>点击「生成报告」后，按字段逐一展示抽取来源与置信度。';\n      return;\n    }\n    if (manual === 0) {\n      v.className = 'verdict ok';\n      v.innerHTML = '<b>可直接发布</b>6 个字段全部高于阈值 ' + state.threshold.toFixed(2) +\n        '，来源行号齐全；结论性表述（气测异常）仍需值班签字确认。';\n    } else {\n      var names = shown.filter(function (f) { return f.conf < state.threshold; })\n        .map(function (f) { return f.name; }).join('、');\n      v.className = 'verdict bad';\n      v.innerHTML = '<b>需审核</b>' + names + ' 低于阈值 ' + state.threshold.toFixed(2) +\n        '，共 ' + manual + ' 个字段待人工确认；确认前不写入日报。';\n    }\n  }\n\n  function render() {\n    renderSource();\n    renderCards();\n    drawGate();\n    renderReads();\n  }\n\n  function play() {\n    if (timer) { clearInterval(timer); timer = null; }\n    state.revealed = 0;\n    render();\n    timer = setInterval(function () {\n      state.revealed += 1;\n      if (state.revealed >= FIELDS.length) {\n        state.revealed = FIELDS.length;\n        clearInterval(timer);\n        timer = null;\n      }\n      render();\n    }, 360);\n  }\n\n  function bind() {\n    $('btn').addEventListener('click', play);\n    $('btn-reset').addEventListener('click', function () {\n      if (timer) { clearInterval(timer); timer = null; }\n      state.revealed = 0;\n      render();\n    });\n    $('s-th').addEventListener('input', function (e) {\n      state.threshold = +e.target.value / 100;\n      $('o-th').textContent = state.threshold.toFixed(2);\n      $('th-tag').textContent = '阈值 ' + state.threshold.toFixed(2);\n      render();\n    });\n  }\n\n  buildSpans();\n  bind();\n  play();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：录井报告自动生成与要素抽取</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"wrap\">\n  <header>\n    <div class=\"eyebrow\">M5 · 录井 · 自然语言处理</div>\n    <h1>录井报告自动生成与要素抽取</h1>\n    <p class=\"lead\">左边是一份 12 h 班报的原始记录，来自录井仪、岩屑描述、钻井液班报和工程日报。点击「生成报告」，看 6 个核心字段怎么被逐条抽出来、每个字段来自第几行、置信度够不够发布。</p>\n  </header>\n\n  <section class=\"card\">\n    <div class=\"card-head\">\n      <h2><span class=\"num\">01</span>原始记录与字段抽取</h2>\n      <span class=\"tag\">XX-12 · 2026-10-24 08:00—20:00</span>\n    </div>\n    <div class=\"split\">\n      <div class=\"pane\">\n        <div class=\"pane-head\"><span>原始记录（多源合并）</span><span class=\"mono\" id=\"src-count\">10 行</span></div>\n        <div class=\"src\" id=\"src\"></div>\n      </div>\n      <div class=\"pane\">\n        <div class=\"pane-head\"><span>抽取结果 · 6 个核心字段</span><span class=\"mono\" id=\"field-count\">6 / 6</span></div>\n        <div class=\"fields\" id=\"cards\"></div>\n      </div>\n    </div>\n    <div class=\"actions\">\n      <button id=\"btn\" class=\"primary\">生成报告</button>\n      <button id=\"btn-reset\" class=\"ghost\">重置</button>\n      <span class=\"hint\" id=\"gen-hint\">已生成 6 / 6 字段 · 模板：开发井 12 h 班报</span>\n    </div>\n  </section>\n\n  <section class=\"card\">\n    <div class=\"card-head\">\n      <h2><span class=\"num\">02</span>抽取置信度阈值</h2>\n      <span class=\"tag\" id=\"th-tag\">阈值 0.75</span>\n    </div>\n    <div class=\"ctl\">\n      <label>采纳阈值 <output id=\"o-th\">0.75</output></label>\n      <input type=\"range\" id=\"s-th\" min=\"0.50\" max=\"0.99\" step=\"0.01\" value=\"0.75\">\n      <span class=\"tip\">低于阈值的字段标红、计入人工确认；阈值越高越安全，但审核量越大</span>\n    </div>\n    <svg id=\"gate\" viewBox=\"0 0 760 170\" role=\"img\" aria-label=\"字段置信度与采纳阈值\"></svg>\n    <div class=\"readrow\">\n      <div class=\"read\"><span>字段召回率</span><b id=\"r-rec\">—</b></div>\n      <div class=\"read\"><span>需人工确认字段</span><b id=\"r-man\">—</b></div>\n      <div class=\"read\"><span>数值 / 单位校验</span><b id=\"r-chk\">—</b></div>\n    </div>\n    <div class=\"verdict\" id=\"verdict\">—</div>\n  </section>\n\n  <p class=\"foot\">记录文本为示意样本；字段抽取、置信度门控与审核计数均在前端实时重算。真实系统还需接入 WITS 流、OCR 与井史库。</p>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "点击「生成报告」，看 6 个字段依次从原始记录里被抽出来；拖动置信度阈值，低置信字段立刻标红并计入人工确认。",
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
