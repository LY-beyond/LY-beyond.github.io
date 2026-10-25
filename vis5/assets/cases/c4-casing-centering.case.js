/* =========================================================
   案例插件（静态注册版）：套管居中度智能评估与扶正器优化
   ---------------------------------------------------------
   由 cases/c4-casing-centering/case.json 与 demo/ 目录生成。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "c4-casing-centering",
    "sceneId": "c4",
    "methods": [
      "opt"
    ],
    "title": "套管居中度智能评估与扶正器优化",
    "version": "1.0.0",
    "updated": "2026-10-23",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "固井时，套管在井眼里是否\"居中\"，直接决定水泥环能不能均匀包住整个圆周。如果套管贴在井壁一侧，另一侧水泥环会很薄甚至完全缺失，形成窜槽通道——后续任何层间封隔都会失效。居中度就是量化这件事的核心指标。",
        "judge": [
          {
            "label": "任务类型",
            "value": "几何计算 + 组合优化",
            "desc": "以物理公式为主，AI 负责方案搜索"
          },
          {
            "label": "标注成本",
            "value": "低",
            "desc": "井径井斜数据现成，不需要人工标注"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "差的居中度 = 直接的固井失败风险"
          },
          {
            "label": "难度",
            "value": "低",
            "desc": "几何模型清晰，可解释性强"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>套管居中度由<b>井径、井斜、套管尺寸、扶正器外径与安放间距</b>共同决定。传统做法是工程师用 Excel 或简单公式逐井计算，扶正器间距多沿用\"经验公式\"（通常每 2—3 根套管一个）。</p><p>问题有三：<b>井径不规则时误差大</b>——实际井径沿井段起伏，经验公式假设井径恒定；<b>井斜变化处估算偏差</b>——水平段和大斜度段的居中度与垂直段完全不同；<b>扶正器安放缺乏全局优化</b>——只按局部规则放，无法保证整井段居中度达标。</p><div class='figure'><svg viewBox='0 0 720 270' width='100%' role='img' aria-label='套管偏心导致水泥环厚度不均'><rect x='0' y='0' width='720' height='270' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>A · 井眼截面：套管偏心与水泥环厚度</text><text x='180' y='44' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>居中（e = 0）</text><text x='470' y='44' font-size='9.5' fill='var(--ink-2)' text-anchor='middle'>偏心（e = 30）</text><circle cx='180' cy='135' r='75' fill='none' stroke='var(--ink-2)' stroke-width='1.4'/><circle cx='180' cy='135' r='52' fill='var(--jade)' opacity='0.12'/><circle cx='180' cy='135' r='34' fill='var(--paper-2)' stroke='var(--ink)' stroke-width='1.4'/><circle cx='470' cy='135' r='75' fill='none' stroke='var(--ink-2)' stroke-width='1.4'/><circle cx='500' cy='135' r='52' fill='var(--jade)' opacity='0.12'/><circle cx='500' cy='135' r='34' fill='var(--paper-2)' stroke='var(--ink)' stroke-width='1.4'/><line x1='470' y1='135' x2='500' y2='135' stroke='var(--bad)' stroke-width='1.2'/><line x1='470' y1='130' x2='470' y2='140' stroke='var(--bad)'/><line x1='500' y1='130' x2='500' y2='140' stroke='var(--bad)'/><text x='485' y='124' font-size='9' fill='var(--bad)' text-anchor='middle'>e = 30</text><path d='M540 135 L588 104' stroke='var(--bad)' stroke-width='1'/><text x='592' y='102' font-size='9' fill='var(--bad)'>薄边 → 窜槽</text><path d='M430 135 L392 110' stroke='var(--jade)' stroke-width='1'/><text x='388' y='106' font-size='9' fill='var(--jade)' text-anchor='end'>厚边</text><text x='180' y='244' font-size='10' fill='var(--ok)' text-anchor='middle'>居中度 100%</text><text x='470' y='244' font-size='10' fill='var(--bad)' text-anchor='middle'>居中度 27%</text><text x='18' y='264' font-size='9' fill='var(--ink-3)'>居中度 = 1 − e /（井眼半径 − 套管半径）；薄边水泥环缺失即形成窜槽通道</text></svg><div class='figcap'><b>图 1</b><span>套管偏心距 e 使水泥环一侧变薄甚至缺失，薄边即窜槽通道；居中度随偏心增大而下降</span></div></div>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>核心是<b>居中度的物理计算公式</b>（不是黑箱模型）：给定井径、井斜、套管尺寸和扶正器位置，可以精确算出每个深度点的居中度。AI 的价值在于<b>方案搜索</b>——在\"哪些位置放扶正器、放多大外径\"这个组合空间里，找到总数量最少但整井段居中度都达标的方案。</p><p>具体做法：① 用井径测井数据沿井段逐点计算无扶正器时的居中度曲线；② 在低居中度段插入扶正器候选位置；③ 用贪心或遗传算法搜索\"最少扶正器数 + 所有关键点居中度 ≥ 67%\"的方案。这里 AI 是<b>优化器</b>，不是替代物理模型。</p><div class='figure'><svg viewBox='0 0 720 255' width='100%' role='img' aria-label='井径井斜计算居中度曲线并优化扶正器'><rect x='0' y='0' width='720' height='255' fill='var(--paper-2)' rx='6'/><text x='18' y='22' font-size='11' fill='var(--ink-2)'>B · 井径 + 井斜 → 居中度曲线 → 扶正器方案</text><rect x='22' y='48' width='150' height='30' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='97' y='67' font-size='9' fill='var(--ink-2)' text-anchor='middle'>井径 D(z)</text><rect x='22' y='86' width='150' height='30' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='97' y='105' font-size='9' fill='var(--ink-2)' text-anchor='middle'>井斜 θ(z)</text><rect x='22' y='124' width='150' height='30' rx='4' fill='var(--paper-2)' stroke='var(--line)'/><text x='97' y='143' font-size='9' fill='var(--ink-2)' text-anchor='middle'>套管外径 d</text><rect x='22' y='168' width='150' height='34' rx='4' fill='none' stroke='var(--line)' stroke-dasharray='3 3'/><text x='97' y='189' font-size='9' fill='var(--ink-3)' text-anchor='middle'>CL = 1 − Δ·sinθ / (D−d)</text><path d='M180 128 L232 128' stroke='var(--ink-3)' stroke-width='1.2'/><path d='M232 124.5 L238 128 L232 131.5 Z' fill='var(--ink-3)'/><line x1='240' y1='42' x2='240' y2='225' stroke='var(--line)'/><line x1='421' y1='42' x2='421' y2='225' stroke='var(--warn)' stroke-dasharray='4 3'/><text x='425' y='54' font-size='9' fill='var(--warn)'>67%</text><path d='M334 55 L362 80 L402 105 L456 130 L434 160 L389 190 L334 215' fill='none' stroke='var(--bad)' stroke-width='1.6' stroke-dasharray='5 3'/><path d='M461 55 L443 80 L452 105 L467 130 L456 160 L429 190 L410 215' fill='none' stroke='var(--jade)' stroke-width='2'/><path d='M350 88 l5 9 h-10 z' fill='var(--c-opt)'/><path d='M374 114 l5 9 h-10 z' fill='var(--c-opt)'/><path d='M396 144 l5 9 h-10 z' fill='var(--c-opt)'/><path d='M410 174 l5 9 h-10 z' fill='var(--c-opt)'/><text x='300' y='203' font-size='9' fill='var(--bad)'>优化前</text><text x='500' y='98' font-size='9' fill='var(--jade)'>优化后</text><text x='252' y='52' font-size='9' fill='var(--ink-3)'>CL (%)</text><text x='226' y='135' font-size='9' fill='var(--ink-3)' text-anchor='middle' transform='rotate(-90 226 135)'>深度</text><text x='240' y='240' font-size='9' fill='var(--ink-3)' text-anchor='middle'>0</text><text x='375' y='240' font-size='9' fill='var(--ink-3)' text-anchor='middle'>50</text><text x='510' y='240' font-size='9' fill='var(--ink-3)' text-anchor='middle'>100</text><text x='375' y='252' font-size='9' fill='var(--ink-3)' text-anchor='middle'>居中度 (%)</text><line x1='535' y1='42' x2='535' y2='225' stroke='var(--line)'/><text x='552' y='60' font-size='10' fill='var(--ink-2)'>扶正器方案</text><text x='552' y='90' font-size='18' fill='var(--c-opt)'>31</text><text x='580' y='90' font-size='9' fill='var(--ink-3)'>个</text><text x='552' y='114' font-size='9' fill='var(--ink-3)'>经验方案 48 个</text><text x='552' y='144' font-size='10' fill='var(--ok)'>达标率 96%</text><text x='552' y='164' font-size='9' fill='var(--ink-2)'>平均居中度 81%</text><text x='552' y='190' font-size='9' fill='var(--ink-3)'>▲ 每个 = 1 个扶正器</text></svg><div class='figcap'><b>图 2</b><span>由井径与井斜逐点算居中度曲线，在低于 67% 的井段插入扶正器候选，优化后达标率与用量同时改善</span></div></div>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。数据门槛很低——只要有井径测井和井眼轨迹就能开始。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 4 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 4</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井径测井曲线（CAL）</span><span class=\"cl-s\">0.125 m 采样，全井段</span></span><span class=\"cl-n\">常规测井必测项</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井眼轨迹数据</span><span class=\"cl-s\">每 10—30 m 一个测点</span></span><span class=\"cl-n\">井深 / 井斜角 / 方位角</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">套管与扶正器参数</span><span class=\"cl-s\">外径、壁厚、钢级；扶正器外径系列</span></span><span class=\"cl-n\">设计资料</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">固井质量反馈（可选）</span><span class=\"cl-s\">历史 CBL 评价结果</span></span><span class=\"cl-n\">用于校准居中度阈值</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<p>难度 <b>低</b>——居中度公式是确定性的，几何计算不会出\"反直觉\"的结果；优化空间的搜索也有成熟算法。真正的工程挑战在于：<b>扶正器安放还要考虑套管扶正力、下放摩阻、遇阻风险</b>，不能只看居中度一个指标。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">组合优化<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">贪心算法<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">遗传算法<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">几何建模<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "一个水平井的扶正器优化安放",
        "lead": [
          "某区块一口水平井，完钻井深 3200 m，水平段长 800 m。固井前需要设计扶正器安放方案，目标是整井段居中度 ≥ 67%，且扶正器用量最少。",
          "下面的流程把\"凭经验放扶正器\"变成\"数据驱动的优化方案\"——物理公式保证结果可信，优化算法负责搜索空间。"
        ],
        "stats": [
          [
            "井深",
            "3200 m"
          ],
          [
            "水平段",
            "800 m"
          ],
          [
            "井径采样",
            "25,600 点"
          ],
          [
            "经验方案扶正器",
            "48 个"
          ],
          [
            "优化方案扶正器",
            "31 个"
          ],
          [
            "平均居中度",
            "72% → 81%"
          ]
        ],
        "steps": [
          {
            "name": "数据准备与对齐",
            "role": "数据",
            "do": "读取井径曲线（0.125 m 采样，25,600 点）和测斜数据（100 个测点），沿深度对齐到同一采样率。井斜角用线性插值补密。",
            "effect": "得到每 0.125 m 一个深度点的井径 D(zi) 和井斜角 θ(zi)",
            "trap": "井径测井可能有套管鞋附近的异常值，需要预先剔除"
          },
          {
            "name": "无扶正器居中度基线计算",
            "role": "计算",
            "do": "逐深度点用公式 CL(zi) = 100 × (1 - (Δ × sinθ(zi)) / (D(zi) - d)) 计算无扶正器时的居中度，其中 Δ 是套管线重、d 是套管外径。",
            "effect": "得到一条\"裸管\"居中度曲线，直接暴露哪些井段会贴壁",
            "trap": "井斜角为 0（垂直段）时居中度恒为 100%，不需要扶正器"
          },
          {
            "name": "候选扶正器位置生成",
            "role": "预处理",
            "do": "在居中度 < 67% 的井段内，按最小间距 9 m（约 3 根套管）生成候选安放位置。每个位置有 2—3 种可选扶正器外径（略大于套管外径）。",
            "effect": "把连续搜索空间变成有限候选集，便于后续优化",
            "trap": "候选位置太密会导致组合爆炸，太稀又可能漏放"
          },
          {
            "name": "贪心 + 局部搜索优化",
            "role": "算法核心",
            "do": "① 贪心：每次选\"能提升最多低居中度段\"的位置放扶正器；② 局部搜索：尝试移除/替换某个扶正器，看能否用更少数量维持达标。循环直到无法改进。",
            "effect": "扶正器数量从经验方案的 48 个降到 31 个，同时居中度更高",
            "trap": "纯贪心容易陷入局部最优，局部搜索是必须的"
          },
          {
            "name": "工程约束校验",
            "role": "质控",
            "do": "检查扶正器间距是否满足套管接头避让、水平段末端加密是否合理、下放摩阻是否超限。必要时调整方案。",
            "effect": "输出的不只是\"数学最优\"，而是\"能下得去\"的方案",
            "trap": "只看居中度不管工程约束，方案在现场无法实施"
          }
        ],
        "metrics": {
          "title": "怎么算\"方案好\"",
          "html": "<p>居中度不是越高越好——超过 85% 后，再增加扶正器带来的边际收益很小，却显著增加下放阻力和成本。通常以<b>全井段 ≥ 67%</b> 为合格线，<b>≥ 80%</b> 为优良。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>经验方案</th><th>优化方案</th></tr></thead><tbody><tr><td>平均居中度</td><td>全井段算术平均</td><td>72%</td><td>81%</td></tr><tr><td>最低居中度</td><td>最差点的值</td><td>31%</td><td>58%</td></tr><tr><td>达标率</td><td>≥ 67% 的井段占比</td><td>78%</td><td>96%</td></tr><tr><td>扶正器数</td><td>总个数</td><td>48</td><td>31</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "扶正器放不下",
            "why": "候选位置恰好卡在套管接箍处，需要调整 1—2 m。优化时必须加入接箍位置约束。"
          },
          {
            "name": "水平段末端居中度仍低",
            "why": "扶正器在水平段的扶正力随摩擦减小，末端可能需要加密到每 2 根一个。"
          },
          {
            "name": "井径异常段误判",
            "why": "井径测井遇扩径段读数偏大，算法以为居中度够了，实际水泥环还是薄。需要对扩径段做特殊处理。"
          }
        ]
      }
    }
  };

  var FILES = [
      {
        "name": "demo/demo.css",
        "data": "/* ========= 居中度示范样式 ========= */\n* { box-sizing: border-box; }\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  background: #fbfaf6;\n  color: #242b2e;\n  padding: 32px 28px;\n  line-height: 1.65;\n}\n.panel { max-width: 900px; margin: 0 auto; }\nh1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }\nh2 { font-size: 15px; font-weight: 600; margin: 24px 0 8px; color: #235f51; }\n.lead { color: #4d565b; margin-bottom: 16px; }\n.hint { font-size: 12.5px; color: #79828a; margin-bottom: 12px; }\n.section { background: #fff; border: 1px solid #e9e4d8; border-radius: 9px; padding: 20px 22px; margin-bottom: 18px; }\n\n/* ---------- 控制 ---------- */\n.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }\n.ctl { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: #f5f2ea; border-radius: 7px; }\n.ctl label { font-size: 13px; display: flex; justify-content: space-between; font-weight: 500; }\n.ctl output { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; font-weight: 600; }\n.ctl input[type=\"range\"] { accent-color: #2f7d6b; }\n.ctl .tip { font-size: 11.5px; color: #9ba3a9; }\n\n/* ---------- 横截面 ---------- */\n.cross-wrap { display: flex; gap: 28px; align-items: center; }\n.cross-wrap svg { background: #fdfcf9; border-radius: 8px; flex-shrink: 0; }\n.cross-info { flex: 1; }\n.ci-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e9e4d8; font-size: 13px; }\n.ci-row.big { margin-top: 8px; padding: 12px 14px; background: #e6f1ec; border-radius: 6px; border-bottom: none; }\n.ci-l { color: #79828a; }\n.ci-row.big .ci-l { font-size: 11px; letter-spacing: .15em; text-transform: uppercase; }\n.ci-row b { font-family: 'JetBrains Mono', Consolas, monospace; font-weight: 600; }\n.ci-row.big b { font-size: 26px; color: #235f51; }\n.verdict { margin-top: 10px; padding: 8px 12px; border-radius: 6px; font-size: 12.5px; }\n.verdict.ok { background: #e7f3ea; color: #3f8560; }\n.verdict.warn { background: #f9efd7; color: #a97a1c; }\n.verdict.bad { background: #f9e9e5; color: #b05a51; }\n\n/* ---------- 井段曲线 ---------- */\n.well-ctl { display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap; }\n.well-ctl button {\n  padding: 7px 14px; border-radius: 6px; border: 1px solid #c9c2b0;\n  background: #fff; cursor: pointer; font-size: 13px; font-weight: 500;\n}\n.well-ctl button:hover { border-color: #2f7d6b; color: #2f7d6b; }\n.well-ctl button.primary { background: #2f7d6b; border-color: #2f7d6b; color: #fff; }\n.well-ctl button.primary:hover { background: #235f51; }\n.well-stat { font-size: 12.5px; color: #79828a; margin-left: auto; }\n.well-stat b { font-family: 'JetBrains Mono', Consolas, monospace; color: #235f51; }\n\n/* ---------- 公式 ---------- */\n.formula { background: #f5f2ea; border-radius: 7px; padding: 16px 18px; }\n.eqn {\n  font-family: 'JetBrains Mono', Consolas, monospace;\n  text-align: center;\n  margin: 10px 0;\n  font-size: 14px;\n}\n.frac { display: inline-block; vertical-align: middle; text-align: center; }\n.frac span { display: block; padding: 0 4px; }\n.frac span:first-child { border-bottom: 1px solid #242b2e; }\n"
      },
      {
        "name": "demo/demo.js",
        "data": "/* ======= 套管居中度智能评估 · 可运行示范 ======= */\n(function () {\n  'use strict';\n\n  // ---------- 常量 ----------\n  const CASING_OD = 178;      // 套管外径 mm\n  const MAX_OFF = 60;         // 屏幕上最大半径 px\n  const CROSS_CENTER = 200;   // 横截面中心\n\n  // ---------- 状态 ----------\n  let state = {\n    d: 216,        // 井径 mm\n    theta: 60,     // 井斜角 deg\n    wt: 260,       // 套管线重 N/m\n    f: 196,        // 扶正器外径 mm\n    hasF: true     // 是否考虑扶正器\n  };\n\n  // 沿井段数据（模拟井）\n  const N = 200;   // 采样点数\n  const K = 0.045; // 偏心系数\n  let boosters = []; // 扶正器位置（索引）\n\n  // ---------- 工具 ----------\n  function $(id) { return document.getElementById(id); }\n  function mm2px(v) { return v / state.d * MAX_OFF; }\n\n  // 无扶正器偏心距（mm）\n  function eccNoBoost() {\n    const sin = Math.sin(state.theta * Math.PI / 180);\n    return Math.min(state.d - CASING_OD, K * state.wt * sin * 10);\n  }\n  // 居中度 %\n  function centering(ecc, boosterOut) {\n    if (state.theta < 1) return 100;\n    let eff = ecc;\n    if (boosterOut) {\n      // 有扶正器，偏心距被扶正器外径限制\n      eff = Math.min(ecc, Math.max(0, (state.d - state.f) / 2));\n    }\n    const maxEcc = (state.d - CASING_OD) / 2;\n    return Math.max(0, Math.min(100, 100 * (1 - eff / maxEcc)));\n  }\n\n  // ---------- 横截面渲染 ----------\n  function drawCross() {\n    const svg = $('cross');\n    const R = MAX_OFF;\n    const r = CASING_OD / state.d * R;  // 套管半径 px\n    const ecc = mm2px(eccNoBoost());     // 偏心距 px\n\n    // 扶正器位置（沿井斜方向）\n    const ang = state.theta * Math.PI / 180;\n    const dirX = Math.sin(ang);  // 向下方向（重力）\n    const dirY = Math.cos(ang);\n\n    // 实际套管位置（被扶正器限制）\n    let effEccPx = Math.min(ecc, Math.max(0, (state.d - state.f) / 2) / state.d * R);\n\n    let s = '';\n    // 井眼（大圆）\n    s += `<circle cx=\"${CROSS_CENTER}\" cy=\"${CROSS_CENTER}\" r=\"${R}\" fill=\"#f5f2ea\" stroke=\"#c9c2b0\" stroke-width=\"1.5\"/>`;\n\n    // 水泥环（环形，根据居中度改变显示）\n    const clNow = centering(eccNoBoost(), true);\n    // 水泥环：从套管外壁到井眼内壁，但减去偏心部分\n    // 简化画两段弧：上半部分（厚的一侧）和下半部分（薄的一侧）\n    const casCx = CROSS_CENTER + effEccPx * dirX;\n    const casCy = CROSS_CENTER + effEccPx * dirY;\n\n    // 水泥环用路径画：井眼内圆 到 套管外圆 之间的部分\n    if (effEccPx < 0.5) {\n      // 完全居中，画完整环形\n      s += `<circle cx=\"${CROSS_CENTER}\" cy=\"${CROSS_CENTER}\" r=\"${R}\" fill=\"none\" stroke=\"#2f7d6b\" stroke-width=\"${R - r}\" opacity=\"0.55\"/>`;\n    } else {\n      // 偏心：画井眼和套管之间的区域\n      // 用更简洁的方式：井眼减去套管，填绿色\n      s += `<path d=\"M ${CROSS_CENTER - R} ${CROSS_CENTER} A ${R} ${R} 0 1 0 ${CROSS_CENTER + R} ${CROSS_CENTER} A ${R} ${R} 0 1 0 ${CROSS_CENTER - R} ${CROSS_CENTER} Z\" fill=\"#e6f1ec\" opacity=\"0.7\"/>`;\n      s += `<path d=\"M ${casCx - r} ${casCy} A ${r} ${r} 0 1 0 ${casCx + r} ${casCy} A ${r} ${r} 0 1 0 ${casCx - r} ${casCy} Z\" fill=\"#fbfaf6\"/>`;\n    }\n\n    // 井眼描边\n    s += `<circle cx=\"${CROSS_CENTER}\" cy=\"${CROSS_CENTER}\" r=\"${R}\" fill=\"none\" stroke=\"#c9c2b0\" stroke-width=\"1.5\"/>`;\n\n    // 扶正器（画在套管外壁上方，沿重力反方向）\n    const boostCx = casCx - (state.f - CASING_OD) / state.d * R / 2 * dirX;\n    const boostCy = casCy - (state.f - CASING_OD) / state.d * R / 2 * dirY;\n    const boostR = state.f / state.d * R / 2;\n    s += `<circle cx=\"${boostCx}\" cy=\"${boostCy}\" r=\"${boostR}\" fill=\"none\" stroke=\"#b26a39\" stroke-width=\"2\" stroke-dasharray=\"3 2\" opacity=\"0.7\"/>`;\n\n    // 套管\n    s += `<circle cx=\"${casCx}\" cy=\"${casCy}\" r=\"${r}\" fill=\"#4d565b\" stroke=\"#242b2e\" stroke-width=\"1.5\"/>`;\n    // 套管内孔\n    s += `<circle cx=\"${casCx}\" cy=\"${casCy}\" r=\"${r * 0.6}\" fill=\"#242b2e\"/>`;\n\n    // 偏心线\n    if (effEccPx > 1) {\n      s += `<line x1=\"${CROSS_CENTER}\" y1=\"${CROSS_CENTER}\" x2=\"${casCx}\" y2=\"${casCy}\" stroke=\"#b05a51\" stroke-width=\"1.2\" stroke-dasharray=\"3 2\"/>`;\n      const midX = (CROSS_CENTER + casCx) / 2;\n      const midY = (CROSS_CENTER + casCy) / 2;\n      s += `<text x=\"${midX + 4}\" y=\"${midY - 4}\" font-size=\"10\" fill=\"#b05a51\" font-family=\"monospace\">e=${((CROSS_CENTER - casCx) * state.d / R).toFixed(1)}mm</text>`;\n    }\n\n    // 图例\n    s += `<text x=\"12\" y=\"20\" font-size=\"10\" fill=\"#9ba3a9\" font-family=\"monospace\">D=${state.d}mm  d=${CASING_OD}mm  θ=${state.theta}°</text>`;\n\n    svg.innerHTML = s;\n\n    // 更新信息\n    const eccMm = eccNoBoost();\n    const cl = centering(eccMm, true);\n    $('ci-d').textContent = state.d + ' mm';\n    $('ci-do').textContent = CASING_OD + ' mm';\n    $('ci-f').textContent = state.f + ' mm';\n    $('ci-theta').textContent = state.theta + '°';\n    $('ci-e').textContent = eccMm.toFixed(1) + ' mm';\n    $('ci-cl').textContent = cl.toFixed(0) + '%';\n\n    const v = $('verdict');\n    v.className = 'verdict ' + (cl >= 80 ? 'ok' : cl >= 67 ? 'warn' : 'bad');\n    v.textContent = cl >= 80 ? '✅ 居 ≥ 80%，优良。水泥环均匀，窜槽风险极低。'\n                  : cl >= 67 ? '⚠️ 67%—80%，合格。仍有薄层水泥环，注意工程风险。'\n                  : '❌ < 67%，不合格！套管严重偏心，水泥环太薄，强烈建议增大扶正器外径。';\n  }\n\n  // ---------- 沿井段数据生成 ----------\n  function genWell() {\n    // 生成井斜角曲线：0 → 90 → 90（垂直 → 增斜 → 水平）\n    const thetaArr = new Float64Array(N);\n    for (let i = 0; i < N; i++) {\n      const t = i / N;\n      if (t < 0.3) thetaArr[i] = t / 0.3 * 45;\n      else if (t < 0.5) thetaArr[i] = 45 + (t - 0.3) / 0.2 * 45;\n      else thetaArr[i] = 90 - (Math.random() - 0.5) * 6;\n    }\n    // 井径曲线（加一些起伏）\n    const dArr = new Float64Array(N);\n    for (let i = 0; i < N; i++) {\n      const base = 216 + Math.sin(i * 0.15) * 6 + Math.sin(i * 0.03) * 4;\n      dArr[i] = base;\n    }\n    return { theta: thetaArr, d: dArr };\n  }\n\n  const well = genWell();\n\n  // 计算沿井段居中度曲线（考虑扶正器位置）\n  function computeCL() {\n    const cl = new Float64Array(N);\n    for (let i = 0; i < N; i++) {\n      const localD = well.d[i];\n      const localTheta = well.theta[i];\n      // 临时用当前井径和井斜\n      const ecc = Math.min(localD - CASING_OD, K * state.wt * Math.sin(localTheta * Math.PI / 180) * 10);\n      // 检查附近是否有扶正器（±5 点范围）\n      let near = false;\n      for (const b of boosters) {\n        if (Math.abs(b - i) <= 5) { near = true; break; }\n      }\n      let effEcc = ecc;\n      if (near) {\n        effEcc = Math.min(ecc, Math.max(0, (localD - state.f) / 2));\n      }\n      const maxEcc = (localD - CASING_OD) / 2;\n      cl[i] = Math.max(0, Math.min(100, 100 * (1 - effEcc / maxEcc)));\n    }\n    return cl;\n  }\n\n  // ---------- 井段曲线渲染 ----------\n  function drawWell() {\n    const svg = $('well');\n    const W = 760, H = 280, padL = 40, padR = 14, padT = 22, padB = 30;\n    const plotW = W - padL - padR, plotH = H - padT - padB;\n\n    const cl = computeCL();\n\n    let s = `<rect x=\"0\" y=\"0\" width=\"${W}\" height=\"${H}\" fill=\"#fdfcf9\" rx=\"4\"/>`;\n\n    // 背景区域（达标/不达标）\n    const yAxis = padT + plotH;\n    // 水平段标注\n    s += `<rect x=\"${padL + 0.5 * plotW}\" y=\"${padT}\" width=\"${0.5 * plotW}\" height=\"${plotH}\" fill=\"#f5f2ea\" opacity=\"0.5\"/>`;\n    s += `<text x=\"${padL + 0.25 * plotW}\" y=\"${padT + 14}\" font-size=\"10\" fill=\"#9ba3a9\" font-family=\"monospace\" text-anchor=\"middle\">增斜段</text>`;\n    s += `<text x=\"${padL + 0.75 * plotW}\" y=\"${padT + 14}\" font-size=\"10\" fill=\"#9ba3a9\" font-family=\"monospace\" text-anchor=\"middle\">水平段 (θ≈90°)</text>`;\n\n    // 网格\n    [0, 20, 40, 60, 67, 80, 100].forEach(v => {\n      const y = yAxis - v / 100 * plotH;\n      s += `<line x1=\"${padL}\" y1=\"${y}\" x2=\"${padL + plotW}\" y2=\"${y}\" stroke=\"#efece1\" stroke-width=\"1\"/>`;\n      s += `<text x=\"${padL - 6}\" y=\"${y + 3}\" font-size=\"9\" fill=\"#9ba3a9\" text-anchor=\"end\" font-family=\"monospace\">${v}</text>`;\n    });\n\n    // 67% 达标线\n    const y67 = yAxis - 0.67 * plotH;\n    s += `<line x1=\"${padL}\" y1=\"${y67}\" x2=\"${padL + plotW}\" y2=\"${y67}\" stroke=\"#a97a1c\" stroke-width=\"1\" stroke-dasharray=\"4 3\"/>`;\n    s += `<text x=\"${padL + plotW + 2}\" y=\"${y67 + 3}\" font-size=\"9\" fill=\"#a97a1c\" font-family=\"monospace\">67%</text>`;\n\n    // 低居中度区域（红色填充）\n    let inLow = false, lowStart = 0;\n    for (let i = 0; i < N; i++) {\n      if (cl[i] < 67 && !inLow) { inLow = true; lowStart = i; }\n      if (cl[i] >= 67 && inLow) {\n        const x1 = padL + lowStart / N * plotW;\n        const x2 = padL + i / N * plotW;\n        s += `<rect x=\"${x1}\" y=\"${padT}\" width=\"${x2 - x1}\" height=\"${plotH}\" fill=\"#b05a51\" opacity=\"0.08\"/>`;\n        inLow = false;\n      }\n    }\n    if (inLow) {\n      const x1 = padL + lowStart / N * plotW;\n      const x2 = padL + plotW;\n      s += `<rect x=\"${x1}\" y=\"${padT}\" width=\"${x2 - x1}\" height=\"${plotH}\" fill=\"#b05a51\" opacity=\"0.08\"/>`;\n    }\n\n    // 居中度曲线\n    let path = '';\n    for (let i = 0; i < N; i++) {\n      const x = padL + i / N * plotW;\n      const y = yAxis - cl[i] / 100 * plotH;\n      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';\n    }\n    s += `<path d=\"${path}\" fill=\"none\" stroke=\"#2f7d6b\" stroke-width=\"2\" stroke-linejoin=\"round\"/>`;\n\n    // 扶正器位置\n    boosters.forEach(b => {\n      const x = padL + b / N * plotW;\n      s += `<line x1=\"${x}\" y1=\"${padT}\" x2=\"${x}\" y2=\"${padT + plotH}\" stroke=\"#b26a39\" stroke-width=\"1.5\" stroke-dasharray=\"2 2\"/>`;\n      s += `<circle cx=\"${x}\" cy=\"${padT + plotH + 4}\" r=\"4\" fill=\"#b26a39\"/>`;\n    });\n\n    // 井斜角曲线（细线）\n    let tpath = '';\n    for (let i = 0; i < N; i++) {\n      const x = padL + i / N * plotW;\n      const y = yAxis - well.theta[i] / 100 * plotH;\n      tpath += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';\n    }\n    s += `<path d=\"${tpath}\" fill=\"none\" stroke=\"#41699b\" stroke-width=\"1\" stroke-dasharray=\"3 3\" opacity=\"0.6\"/>`;\n\n    // 图例\n    s += `<rect x=\"${padL}\" y=\"${H - 20}\" width=\"10\" height=\"2\" fill=\"#2f7d6b\"/>`;\n    s += `<text x=\"${padL + 14}\" y=\"${H - 15}\" font-size=\"9\" fill=\"#5d666d\">居中度 %</text>`;\n    s += `<rect x=\"${padL + 90}\" y=\"${H - 20}\" width=\"10\" height=\"2\" fill=\"#41699b\"/>`;\n    s += `<text x=\"${padL + 104}\" y=\"${H - 15}\" font-size=\"9\" fill=\"#5d666d\">井斜角 θ</text>`;\n    s += `<rect x=\"${padL + 190}\" y=\"${H - 20}\" width=\"10\" height=\"2\" fill=\"#b26a39\"/>`;\n    s += `<text x=\"${padL + 204}\" y=\"${H - 15}\" font-size=\"9\" fill=\"#5d666d\">扶正器</text>`;\n\n    svg.innerHTML = s;\n\n    // 统计\n    let minCL = 100;\n    for (let i = 0; i < N; i++) if (cl[i] < minCL) minCL = cl[i];\n    $('fcount').textContent = boosters.length;\n    $('fmin').textContent = minCL.toFixed(1) + '%';\n  }\n\n  // ---------- 扶正器操作 ----------\n  function addBoosterAt(idx) {\n    if (boosters.some(b => Math.abs(b - idx) < 8)) return;\n    boosters.push(idx);\n    boosters.sort((a, b) => a - b);\n  }\n\n  // 找最低居中度位置\n  function findWorst() {\n    const cl = computeCL();\n    let minVal = 100, minIdx = 0;\n    for (let i = 10; i < N - 10; i++) {\n      if (cl[i] < minVal) { minVal = cl[i]; minIdx = i; }\n    }\n    return minIdx;\n  }\n\n  // 一键优化（贪心）\n  function optimize() {\n    boosters = [];\n    for (let iter = 0; iter < 30; iter++) {\n      const worstIdx = findWorst();\n      const cl = computeCL();\n      if (cl[worstIdx] >= 67) break;\n      addBoosterAt(worstIdx);\n    }\n    // 局部搜索：尝试移除冗余扶正器\n    let improved = true;\n    while (improved) {\n      improved = false;\n      for (let i = boosters.length - 1; i >= 0; i--) {\n        const saved = boosters[i];\n        boosters.splice(i, 1);\n        const cl = computeCL();\n        let minV = 100;\n        for (let j = 0; j < N; j++) if (cl[j] < minV) minV = cl[j];\n        if (minV >= 65) {\n          improved = true;\n        } else {\n          boosters.splice(i, 0, saved);\n        }\n      }\n    }\n  }\n\n  // ---------- 事件绑定 ----------\n  function bind() {\n    $('s-d').addEventListener('input', e => {\n      state.d = +e.target.value;\n      $('o-d').textContent = state.d;\n      drawCross();\n      drawWell();\n    });\n    $('s-theta').addEventListener('input', e => {\n      state.theta = +e.target.value;\n      $('o-theta').textContent = state.theta;\n      drawCross();\n      drawWell();\n    });\n    $('s-wt').addEventListener('input', e => {\n      state.wt = +e.target.value;\n      $('o-wt').textContent = state.wt;\n      drawCross();\n      drawWell();\n    });\n    $('s-f').addEventListener('input', e => {\n      state.f = +e.target.value;\n      $('o-f').textContent = state.f;\n      drawCross();\n      drawWell();\n    });\n    $('btn-add').addEventListener('click', () => {\n      addBoosterAt(findWorst());\n      drawWell();\n    });\n    $('btn-auto').addEventListener('click', () => {\n      optimize();\n      drawWell();\n    });\n    $('btn-reset').addEventListener('click', () => {\n      boosters = [];\n      drawWell();\n    });\n  }\n\n  // ---------- 初始化 ----------\n  bind();\n  drawCross();\n  drawWell();\n})();\n"
      },
      {
        "name": "demo/index.html",
        "data": "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>示范：套管居中度智能评估</title>\n<link rel=\"stylesheet\" href=\"demo.css\">\n</head>\n<body>\n<div class=\"panel\">\n  <h1>套管居中度 · 交互式演示</h1>\n  <p class=\"lead\">居中度 = 1 − (套管偏心距 / 最大可能偏心距)。拖动下面的滑杆，看井径、井斜、扶正器怎么改变水泥环的均匀程度。</p>\n\n  <!-- 井眼横截面视图 -->\n  <div class=\"section\">\n    <h2>① 井眼横截面：套管在里面的位置</h2>\n    <p class=\"hint\">灰色大圆是井眼，深灰小圆是套管，外侧圆环是理想水泥环。绿色区域是\"有水泥\"，白色间隙是\"没水泥\"——这就是窜槽的源头。</p>\n    <div class=\"cross-wrap\">\n      <svg id=\"cross\" viewBox=\"0 0 400 400\" role=\"img\" aria-label=\"井眼横截面\"></svg>\n      <div class=\"cross-info\">\n        <div class=\"ci-row\"><span class=\"ci-l\">井径 D</span><b id=\"ci-d\">216 mm</b></div>\n        <div class=\"ci-row\"><span class=\"ci-l\">套管外径 d</span><b id=\"ci-do\">178 mm</b></div>\n        <div class=\"ci-row\"><span class=\"ci-l\">扶正器外径</span><b id=\"ci-f\">196 mm</b></div>\n        <div class=\"ci-row\"><span class=\"ci-l\">井斜角 θ</span><b id=\"ci-theta\">60°</b></div>\n        <div class=\"ci-row\"><span class=\"ci-l\">偏心距 e</span><b id=\"ci-e\">24 mm</b></div>\n        <div class=\"ci-row big\"><span class=\"ci-l\">居中度</span><b id=\"ci-cl\">48%</b></div>\n        <div class=\"verdict\" id=\"verdict\"></div>\n      </div>\n    </div>\n  </div>\n\n  <!-- 控制面板 -->\n  <div class=\"section\">\n    <h2>② 改变条件，看居中度怎么变</h2>\n    <div class=\"controls\">\n      <div class=\"ctl\">\n        <label>井径 D (mm)<output id=\"o-d\">216</output></label>\n        <input type=\"range\" id=\"s-d\" min=\"180\" max=\"300\" step=\"2\" value=\"216\">\n        <span class=\"tip\">井径越大，套管越容易偏</span>\n      </div>\n      <div class=\"ctl\">\n        <label>井斜角 θ (°)<output id=\"o-theta\">60</output></label>\n        <input type=\"range\" id=\"s-theta\" min=\"0\" max=\"90\" step=\"1\" value=\"60\">\n        <span class=\"tip\">90° = 水平段，0° = 垂直段</span>\n      </div>\n      <div class=\"ctl\">\n        <label>套管线重 (N/m)<output id=\"o-wt\">260</output></label>\n        <input type=\"range\" id=\"s-wt\" min=\"100\" max=\"500\" step=\"10\" value=\"260\">\n        <span class=\"tip\">越重越容易贴壁，但也能靠扶正器撑住</span>\n      </div>\n      <div class=\"ctl\">\n        <label>扶正器外径 (mm)<output id=\"o-f\">196</output></label>\n        <input type=\"range\" id=\"s-f\" min=\"180\" max=\"216\" step=\"2\" value=\"196\">\n        <span class=\"tip\">等于井径时居中度 = 100%（但放不进去）</span>\n      </div>\n    </div>\n  </div>\n\n  <!-- 沿井段曲线视图 -->\n  <div class=\"section\">\n    <h2>③ 沿井段的居中度曲线</h2>\n    <p class=\"hint\">这是一口\"模拟井\"：左边是垂直段（井斜 0°），中间是增斜段，右边是水平段（井斜 90°）。<b>红色区域</b>是居中度不足 67% 的段——就是需要加扶正器的地方。</p>\n    <svg id=\"well\" viewBox=\"0 0 760 280\" role=\"img\" aria-label=\"沿井段居中度曲线\"></svg>\n    <div class=\"well-ctl\">\n      <button id=\"btn-add\">＋ 在最差点加扶正器</button>\n      <button id=\"btn-auto\" class=\"primary\">⚡ 一键优化（贪心 + 局部搜索）</button>\n      <button id=\"btn-reset\">↻ 重置</button>\n      <span class=\"well-stat\">已放扶正器：<b id=\"fcount\">0</b> 个 · 最低居中度：<b id=\"fmin\">—</b></span>\n    </div>\n  </div>\n\n  <!-- 公式说明 -->\n  <div class=\"section\">\n    <h2>④ 计算公式</h2>\n    <div class=\"formula\">\n      <p><b>无扶正器时</b>：套管在重力分量作用下贴向下井壁，偏心距 e = (套管线重 × sinθ) / (单位扶正力近似)。简化为：</p>\n      <p class=\"eqn\">e = k × sinθ &nbsp;,&nbsp; k 由套管线重与井径决定</p>\n      <p><b>居中度</b>：套管从井眼中心偏移了 e，占了最大可能偏移 (D/2 − d/2) 的比例：</p>\n      <p class=\"eqn\">CL = 100 × (1 − <span class=\"frac\"><span>e</span><span>(D − d) / 2</span></span>)</p>\n      <p><b>有扶正器时</b>：偏心距被限制到 (井径 − 扶正器外径) / 2：</p>\n      <p class=\"eqn\">CL = 100 × <span class=\"frac\"><span>2 × (扶正器外径 − d)</span><span>D − d</span></span> &nbsp;,&nbsp; 仅在扶正器覆盖的井段生效</p>\n    </div>\n  </div>\n</div>\n<script src=\"demo.js\"></script>\n</body>\n</html>\n"
      }
    ];

  var demoHandle = null;
  DATA.tabs.demo = {
    label: "可运行示范",
    intro: "拖动井径、井斜角和扶正器位置，实时看居中度怎么变化。体验\"裸管曲线 → 发现问题 → 加扶正器 → 优化\"的完整流程。",
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
