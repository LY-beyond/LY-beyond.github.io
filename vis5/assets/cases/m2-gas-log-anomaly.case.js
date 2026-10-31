/* =========================================================
   案例插件（静态注册版）：气测异常智能解释
   ---------------------------------------------------------
   由 cases/m2-gas-log-anomaly/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "m2-gas-log-anomaly",
    "sceneId": "m2",
    "methods": [
      "ts"
    ],
    "title": "气测异常智能解释",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "塔里木盆地库车坳陷某气田每年新钻开发井 40 余口，气测 1 m 一个采样点、单井 4,000—6,000 点，全烃从背景 0.05% 到异常峰值 6.8%。解释员要在这几千个点上凭峰值形态划出含气段，一轮 46 口井要 18 天；而 0.8—1.5 m 的薄层在 1.85—2.20 g/cm³ 钻井液下常被压成背景，漏失率超过四成。",
        "judge": [
          {
            "label": "任务类型",
            "value": "时序分割 + 序列分类",
            "desc": "逐点划异常段，再按段判别油 / 气 / 水"
          },
          {
            "label": "标注成本",
            "value": "中",
            "desc": "段级标签只能来自试油，单井仅 3—8 段"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "单井解释 4 h → 15 min，全气田 18 天 → 2 天"
          },
          {
            "label": "难度",
            "value": "中",
            "desc": "工况干扰强，薄层信号弱于背景波动"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>气测解释的产出是「异常段 + 流体性质 + 含气丰度」三件事：解释员先把全烃、C1—C4 组分与钻时对齐，按峰值起落、组分配套关系划段，再根据 C1/C2、C1/C3 与湿度比、平衡比判断是油层、气层还是水层。单井 4,000—6,000 个点要逐段看，一名解释员一天只能完成 2—3 口井，一个气田一轮解释 18 天，往往等不到成果就先射孔了。同一层段两人划出的顶底界可差 2—4 m，流体性质判对率约 71%。</p><p>数据的物理基础是清楚的：全烃读数取决于钻井液密度、脱气效率（现场 60%—85%）、排量与起下钻工况；组分比反映地层流体组成——C1/C2 高、C1/C3 更高的偏气，C2—C4 齐全且湿度比高的偏油，水层则表现为全烃低而组分以 C1 为主、伴随泵压与钻时异常。这些关系可以写成特征，也可以从历史井中学出来。</p><p>硬约束有三条：① 钻井液密度 1.85—2.20 g/cm³、井底压差 3—8 MPa，过平衡时气显示被压制，同一层在不同钻井液密度下全烃可差 40%，不校正就无法跨井比较；② 接单根气与后效气是 2—5 min 的尖峰，全烃可瞬间冲到 3% 以上，形态与薄油气层极像；③ 真正的产能只能靠试油，工区 46 口井里只有 38 个层段有试油结论，段级标签极其稀疏。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 替换的是「逐点看形态、手工划段」这一步：输入全烃、C1—C4、钻时、钻井液密度、排量、泵状态与接单根标记共 9 个通道，先按工况把全烃折算到标准脱气效率，再用 TCN + BiLSTM + CRF 做逐点「背景 / 异常」分割，最后在异常段内用稳定段的组分比做油 / 气 / 水三分类，并输出每段的置信度与依据点。</p><p>标签策略是这类任务的关键：试油结论只到「段」这一级，不能直接当逐点标签用。做法是把段级标签通过多示例学习下沉到点级——一段内只要有若干点被判为异常，整段就算命中；再用人机协同补 200—300 个高不确定段的点级标注。损失对水层样本单独加权，因为水层只占 9 段，不加权就会被气层淹没。</p><p>定位是辅助：模型给出异常段清单、流体倾向与置信度，解释员复核后决定试油建议。不全自动的原因很直接——气测只证明「有显示」，证明不了「有产能」，气水同层、含气水层在曲线上几乎同形，最终结论必须结合测井与试油。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">数据现成但脏，准备顺序是：先补齐工况与泵状态记录，再做段级标签清洗，最后才是模型。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">气测全烃与组分</span><span class=\"cl-s\">1 m 一点，单井 4,000—6,000 点，46 口井</span></span><span class=\"cl-n\">异常段标注 420 段，按试油结论分级</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">钻井液与工况参数</span><span class=\"cl-s\">密度、排量、钻时、泵状态、接单根记录</span></span><span class=\"cl-n\">用于校正，无需标注</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">试油 / 生产验证</span><span class=\"cl-s\">38 个层段的产液性质与产量</span></span><span class=\"cl-n\">作为段级真值，单列气水同层</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">区域背景井</span><span class=\"cl-s\">同区块 20 口井的稳定泥岩段全烃</span></span><span class=\"cl-n\">建立背景气基线与脱气效率参考</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">岩屑描述</span><span class=\"cl-s\">同井段 1 m 一包</span></span><span class=\"cl-n\">交叉验证岩性与显示级别</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">难点不在模型结构，而在把工况干扰从地层信号里剥出来，以及用稀疏的段级标签训出点级边界。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"\"></i></div><p>难度 <b>中</b>。挑战按影响排序：① 工况干扰——接单根、后效、提下钻、钻井液加重都会改变全烃基线，未过滤时假异常能占到 30% 以上；② 薄层弱信号——0.8—1.5 m 薄层峰值只比背景高 0.2—0.4 个百分点，低于正常波动幅度，单靠阈值必漏；③ 标签稀疏且不精确——试油段本身含夹层，段级标签直接当点级用会把非储层也标成异常。</p><p>评估建议：异常段按 ±1 m 容差匹配，查全率 ≥90%、查准率 ≥85%；流体三分类的宏平均 F1 ≥0.80，水层召回单独报（不低于 75%）；边界平均误差 ≤1.0 m。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">序列分类<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">基线校正<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">弱标签学习<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "塔里木盆地库车坳陷某气田 46 口井的气测异常复查",
        "lead": [
          "气田目的层为裂缝型砂岩气藏，地层压力系数 1.6—1.9，钻井液密度 1.85—2.20 g/cm³。46 口井气测采样 1 m 一点，单井 4,000—6,000 点；历史异常段解释 420 段，其中有试油结论的只有 38 段（气层 21、气水同层 9、水层 8）。",
          "项目用工况校正 + 序列分割 + 段级流体判别重做全部 46 口井。目标：异常段查全率 ≥90%、边界误差 ≤1.0 m、流体判别符合率 ≥85%，把全气田解释周期从 18 天压到 2 天。"
        ],
        "stats": [
          [
            "解释井数",
            "46 口"
          ],
          [
            "单井采样点",
            "4,000—6,000 点"
          ],
          [
            "异常段标注",
            "420 段"
          ],
          [
            "试油验证层",
            "38 层"
          ],
          [
            "人工解释周期",
            "18 天"
          ],
          [
            "模型解释耗时",
            "15 min/井"
          ]
        ],
        "steps": [
          {
            "name": "工况校正与尖峰剔除",
            "role": "数据",
            "do": "按密度与排量把全烃折算到标准脱气效率，用泵状态标记剔除接单根、停泵、提下钻段，保留持续 ≥8 min 且组分同步上升的异常。",
            "effect": "有效点保留 94%，假异常下降 62%",
            "trap": "按固定时长一刀切会连薄层真异常一起删掉——薄层峰值只持续 3—5 min，必须同时看组分是否同步、钻时是否变慢"
          },
          {
            "name": "段级标签清洗",
            "role": "标注",
            "do": "把 420 段按试油结论重分为气层 / 气水同层 / 水层 / 未验证四类，剔除试油干层中被测井判为含气层的矛盾段 27 段。",
            "effect": "可信段级标签 366 段，气水同层单列",
            "trap": "把试油干层直接当负样本——干层可能产水，实际是气水同层，混进负样本会让模型对水层特别保守"
          },
          {
            "name": "序列分割模型",
            "role": "算法核心",
            "do": "TCN + BiLSTM + CRF，9 通道输入、感受野 120 m，逐点输出背景 / 异常概率；段级标签用多示例学习下沉到点级，正样本取段内全烃前 30% 点。",
            "effect": "段级查全率 93%，边界平均误差 0.9 m",
            "trap": "只在峰值附近取正样本训练——模型学不到背景形态，上线后任何基线波动都被判成异常"
          },
          {
            "name": "流体性质判别",
            "role": "推理",
            "do": "取异常段内最稳定的 5—8 个点计算 C1/C2、C1/C3、湿度比与平衡比，输入梯度提升树做四分类，输出概率与依据组分。",
            "effect": "38 个试油层符合率 86%，其中气层 19/21",
            "trap": "把接单根气段也算进组分统计——尖峰期 C1 占比异常高，会把水层误判成气层，只能用稳定段"
          },
          {
            "name": "解释成果复核",
            "role": "质控",
            "do": "按置信度分两档交付：高置信段直接进成果表，低置信段（概率 <0.6）生成复核清单，附曲线截图与邻井对比。",
            "effect": "46 口井复核 2 天完成，改判 31 段",
            "trap": "只交结论不交依据点——解释员无法判断是算法错还是工况错，最后会全部重做一遍"
          }
        ],
        "metrics": {
          "title": "怎么算「解释可用」",
          "html": "<p>反直觉的陷阱：段级准确率做到 94% 也不能说明边界可用——420 段里负样本（背景段）占绝大多数，模型只要少报就能把准确率做高。真正决定射孔成败的是<b>边界误差</b>：顶底各偏 2 m，射孔段就可能把水层打开。另一个陷阱是流体判别的总体准确率：水层只有 8 段，全判成气层也有 80% 以上的准确率，必须单独看水层召回与宏平均 F1。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>人工基线</th><th>本方案</th></tr></thead><tbody><tr><td>异常段查全率</td><td>420 段，±1 m 容差</td><td>78%</td><td>93%</td></tr><tr><td>边界平均误差</td><td>段顶底与实际显示</td><td>±1.8 m</td><td>±0.9 m</td></tr><tr><td>流体判别符合率</td><td>38 个试油层</td><td>71%</td><td>86%</td></tr><tr><td>薄层（&lt;1.5 m）召回</td><td>89 个薄层段</td><td>54%</td><td>81%</td></tr><tr><td>全气田解释周期</td><td>46 口井</td><td>18 天</td><td>2 天</td></tr><tr><td>单井解释耗时</td><td>4,000—6,000 点</td><td>4 h</td><td>15 min</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "接单根气被当成油气显示",
            "why": "接单根时停泵再启泵，2—5 min 内全烃可冲到 3% 以上，形态与薄油气层几乎一致，人工也常误判。解决：把泵状态、接单根时刻作为硬特征，要求异常持续 ≥8 min 且 C1—C4 同步上升才保留。"
          },
          {
            "name": "钻井液密度变化未校正",
            "why": "密度从 1.85 加到 2.20 g/cm³ 后全烃被压低 40%，同一层在两趟钻得出「有显示 / 无显示」两个结论。解决：全烃统一折算到标准脱气效率，跨井比较只用折算值。"
          },
          {
            "name": "薄层被背景气掩盖",
            "why": "背景全烃 0.3%—0.5%，0.8 m 薄层峰值只到 0.8%，低于正常波动，单阈值必然漏失。解决：用组分异常 + 钻时变慢 + 局部斜率三个弱信号联合判定，并单独设薄层召回门槛。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
