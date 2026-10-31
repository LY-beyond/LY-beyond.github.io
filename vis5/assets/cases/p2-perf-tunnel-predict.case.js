/* =========================================================
   案例插件（静态注册版）：射孔孔道形态智能预测
   ---------------------------------------------------------
   由 cases/p2-perf-tunnel-predict/case.json 生成（tools/build-cases.js）。
   修改案例内容请改源文件后重新生成，不要直接改本文件。
   ========================================================= */
(function (global) {
  'use strict';

  var DATA = {
    "id": "p2-perf-tunnel-predict",
    "sceneId": "p2",
    "methods": [
      "opt"
    ],
    "title": "射孔孔道形态智能预测",
    "version": "1.0.0",
    "updated": "2026-10-30",
    "status": "ready",
    "tabs": {
      "background": {
        "label": "专业背景",
        "lede": "一发聚能射孔弹从引爆到射流消散不到 **200 μs**，在混凝土靶里能穿出 **800—1,200 mm** 的孔道；但真实地层中的穿深只能靠靶试与数值模拟间接获得——单次三维显式动力学仿真要跑 **20—60 h**，设计阶段根本没法逐方案比较。代理模型把单次预测压到毫秒级，穿深误差可控制在 10% 以内。",
        "judge": [
          {
            "label": "任务类型",
            "value": "回归 + 代理建模",
            "desc": "由弹型 / 岩性 / 应力预测穿深、孔径与压实带"
          },
          {
            "label": "标注成本",
            "value": "高",
            "desc": "靶试单发数千元，真值样本通常 <100 发"
          },
          {
            "label": "可见收益",
            "value": "高",
            "desc": "方案比选从 2 周缩到 1 小时级"
          },
          {
            "label": "难度",
            "value": "高",
            "desc": "仿真—实测存在系统偏差，必须标定"
          }
        ],
        "sections": [
          {
            "no": 1,
            "en": "PROBLEM",
            "title": "当前做法与问题",
            "html": "<p>射孔孔道形态（穿深、入口孔径、压实带厚度）决定有效流动面积与产能比。行业通行做法是按 API RP-19B 做混凝土靶或岩心靶试验：单发靶试含靶件加工、射孔与 CT 扫描要 3—5 天、数千到上万元，一个区块负担得起的真值样本通常只有 <b>20—80 发</b>。设计阶段更多依赖厂家手册的混凝土靶标称穿深，除以经验系数折算地层穿深，误差常达 30% 以上。</p><p>数据的物理基础是高速侵彻力学：药型罩材质与锥角、装药量、炸高，与岩心抗压强度、孔隙度、围压共同决定射流成型与侵彻过程，AUTODYN / LS-DYNA 等显式动力学软件可以复现射流侵彻、扩孔与压实带形成全过程，输出孔道三维形态。仿真可以批量跑——一次拉丁超立方抽样 2,000 组参数方案，就能把设计空间铺满，这是纯数据驱动不具备的条件。</p><p>硬约束有三条：① 仿真必须用少量真值标定——混凝土靶仿真与实测的系统偏差普遍在 8%—15%，不标定就直接训练的代理模型是在放大仿真误差；② 高地应力、高围压地层中射流被提前减速，用常压靶结果外推会高估穿深 20% 以上；③ 压实带渗透率只剩原岩的 <b>10%—30%</b>，只预测穿深不预测压实带，产能评价仍然失真。</p>"
          },
          {
            "no": 2,
            "en": "INTERVENTION",
            "title": "AI 能做什么",
            "html": "<p>AI 替换的是「逐方案跑仿真」这一步：先用数值模拟批量生成 2,000—5,000 组「弹型—岩性—应力 → 孔道形态」样本，再训练代理模型（高斯过程回归或梯度提升树与浅层网络的混合），输入弹型结构参数、装药量、炸高、岩心强度、孔隙度、围压等 10—14 个变量，输出穿深、平均孔径、压实带厚度与压实带渗透率比。设计阶段调用一次只需毫秒。</p><p>训练的关键是<b>仿真—实测标定</b>：用 20—80 发靶试真值对仿真输出做偏差校正（贝叶斯校准或残差学习），把系统偏差从 12% 左右压到 5% 以内；再用主动学习「哪里不确定就往哪里补仿真」，通常补 200—400 组就能把敏感区误差减半。定位是辅助而非全自动：代理模型给出候选方案排序与置信区间，最终 1—2 个优选方案仍要做靶试闭环验证后才允许下井。</p><p>不全自动的原因很现实：孔道形态是射流—岩石耦合的强非线性问题，样本覆盖之外的岩性（砾岩、煤层、盐膏层）外推不可靠；且射孔方案直接关系井筒完整性与产能，必须保留「模型排序 → 靶试确认 → 工程下发」的闭环。</p>"
          },
          {
            "no": 3,
            "en": "DATA",
            "title": "你需要准备什么",
            "html": "<p style=\"margin-bottom:14px\">数据门槛集中在两件事：仿真样本的批量生成能力与靶试真值的标定质量，先建仿真流水线，再攒真值。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">射孔弹结构参数</span><span class=\"cl-s\">弹型、装药量、药型罩锥角与材质、炸高，50—200 种</span></span><span class=\"cl-n\">按型号结构化入库</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">数值仿真样本</span><span class=\"cl-s\">显式动力学批量计算 2,000—5,000 组</span></span><span class=\"cl-n\">无需标注，输出穿深 / 孔径 / 压实带</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">靶试实测真值</span><span class=\"cl-s\">混凝土靶 + 岩心靶 20—80 发</span></span><span class=\"cl-n\">逐发测量穿深、孔径，精度 ±2 mm</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">孔道 CT / 铸体</span><span class=\"cl-s\">三维孔道形态 10—30 发</span></span><span class=\"cl-n\">用于压实带标定</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">地层岩石力学参数</span><span class=\"cl-s\">抗压强度、孔隙度、围压，按层段整理</span></span><span class=\"cl-n\">作为仿真输入条件</span></div></div>"
          },
          {
            "no": 4,
            "en": "DIFFICULTY",
            "title": "技术难度与参考方向",
            "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px\"><span class=\"dtag\" data-d=\"高\">难度 高</span><span class=\"small muted\">真值昂贵、仿真—实测有系统偏差，标定质量与外推边界是成败关键。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"on hi\"></i></div><p>难度 <b>高</b>。三个挑战：① 真值样本极少且测量分散——同一弹型重复靶试的穿深离散度可达 ±10%，小样本下标定本身就不稳；② 仿真—实测域差——网格尺度与材料本构（JHB / RHT）参数稍有偏差，穿深就系统性偏高或偏低，必须先校准再谈代理建模；③ 多目标耦合——穿深最大不等于产能最优，大孔径弹穿深短但孔道干净、压实带占比小，评价要落到产能比而不是单一穿深。</p><p>评估建议：穿深相对误差 ≤10%、孔径相对误差 ≤15%（以留出的复核靶试为准），并报告置信区间覆盖率；不要只看 R²——设计空间边缘的外推误差才是风险所在。</p><p style=\"margin-top:14px\"><span style=\"color:var(--ink-4);font-family:var(--mono);font-size:10px;letter-spacing:.15em\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">代理模型<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">数值模拟<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">仿真—实测标定<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">主动学习<span class=\"ar\">↗</span></a></div>"
          }
        ]
      },
      "workflow": {
        "label": "案例流程",
        "title": "准噶尔盆地某致密砂岩区块的射孔方案快速比选",
        "lead": [
          "区块目的层为致密砂岩，孔隙度 8%—12%、抗压强度 60—90 MPa，地应力高；待射孔井 35 口，候选射孔弹 12 种、孔密 12—20 孔/m、相位角 60°/90°/120°，组合方案超过 2,000 套。历史靶试真值只有 47 发（混凝土靶 34 发、岩心靶 13 发）。",
          "项目用显式动力学仿真批量生成 2,400 组训练样本，以靶试真值做偏差校准后训练代理模型。目标：穿深预测相对误差 ≤10%，单套方案评估 <1 s，把方案比选周期从 2 周压到 1 天。"
        ],
        "stats": [
          [
            "仿真样本",
            "2,400 组"
          ],
          [
            "靶试真值",
            "47 发"
          ],
          [
            "输入变量",
            "12 个"
          ],
          [
            "单次仿真耗时",
            "32 h"
          ],
          [
            "代理模型耗时",
            "<1 s"
          ],
          [
            "穿深目标误差",
            "≤10%"
          ]
        ],
        "steps": [
          {
            "name": "仿真流水线搭建",
            "role": "数据",
            "do": "建立 12 种射孔弹的三维显式动力学模型（网格 1—2 mm、JHB 岩体本构），拉丁超立方抽样 2,400 组参数组合，集群批量计算，单组约 32 h，总机时约 7.7 万核时。",
            "effect": "得到穿深、孔径、压实带厚度三组标签的数据集",
            "trap": "网格粗放到 5 mm 时射流侵彻被低估、穿深系统性偏高 15%，必须先做单组网格收敛性验证"
          },
          {
            "name": "靶试偏差标定",
            "role": "质控",
            "do": "用 47 发靶试真值对仿真输出做贝叶斯校准：混凝土靶系统偏差 9.6%、岩心靶 13.2%，学习偏差项并把残差作为模型不确定度来源。",
            "effect": "校准后仿真与实测偏差中位数降到 4.8%",
            "trap": "不分靶型混着校准——混凝土靶与岩心靶的偏差方向相反，混在一起会把两组都带偏"
          },
          {
            "name": "代理模型训练",
            "role": "算法核心",
            "do": "以 12 个输入变量训练梯度提升树 + 高斯过程残差的混合模型，按弹型分组交叉验证，输出穿深 / 孔径 / 压实带三个目标及置信区间。",
            "effect": "留一弹型验证穿深相对误差 8.7%，R² 0.93",
            "trap": "随机划分会让同弹型的相邻参数点同时进训练与验证，误差被低估一半，必须按弹型留一验证"
          },
          {
            "name": "主动学习补样本",
            "role": "算法核心",
            "do": "在置信区间最宽的高强度 + 高围压区域补做 320 组仿真，迭代两轮。",
            "effect": "敏感区穿深误差从 14.2% 降到 9.1%",
            "trap": "只补极端角点会让边界过拟合、中间区域反而变差，补样要兼顾空间覆盖"
          },
          {
            "name": "方案比选排序",
            "role": "推理",
            "do": "对 2,000 余套「弹型 × 孔密 × 相位」组合调用代理模型排序，按产能比（计入压实带损害）输出前 5 套方案。",
            "effect": "比选全程 40 min；优选方案预测产能比 0.82，经验默认方案 0.71",
            "trap": "只按穿深排序会选中深穿透弹——其孔径小、压实带占比高，产能比未必最优"
          },
          {
            "name": "靶试闭环验证",
            "role": "工程环节",
            "do": "对优选方案补做 6 发岩心靶试，验证通过后随 35 口井作业推广。",
            "effect": "实测与预测偏差 6.3%，满足 ≤10% 门槛",
            "trap": "跳过闭环直接推广——代理模型不掌握弹药批次差异，新批次装药必须留 1—2 发复核"
          }
        ],
        "metrics": {
          "title": "怎么算「预测可信」",
          "html": "<p>反直觉的陷阱：训练集 R² 到 0.95 不代表能用——同一弹型的相邻参数点高度相关，随机划分时模型等于在「插值背答案」。真正要盯的是<b>留一弹型 / 留一岩性下的外推误差</b>，以及置信区间覆盖率：标称 95% 的区间应覆盖约 95% 的复核靶试点，覆盖率低于 85% 说明不确定度被低估，方案排序随时可能翻盘。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>传统做法</th><th>本方案</th></tr></thead><tbody><tr><td>单方案评估耗时</td><td>给定参数到孔道形态</td><td>仿真 32 h</td><td>&lt;1 s（代理模型）</td></tr><tr><td>穿深相对误差</td><td>对留出复核靶试</td><td>经验折算 30%+</td><td>8.7%</td></tr><tr><td>孔径相对误差</td><td>对留出复核靶试</td><td>—</td><td>11.5%</td></tr><tr><td>方案比选周期</td><td>2,000 套组合排序</td><td>约 2 周（抽样仿真）</td><td>40 min</td></tr><tr><td>闭环验证偏差</td><td>6 发新靶试</td><td>—</td><td>6.3%</td></tr></tbody></table>"
        },
        "fails": [
          {
            "name": "仿真本构参数照搬文献",
            "why": "JHB / RHT 本构参数直接取文献值，与本区块岩心三轴试验不符，穿深系统性偏差 15%—25%。解决：先用 3—5 组本区岩心的力学试验反演本构参数，再批量仿真。"
          },
          {
            "name": "跨岩性外推失效",
            "why": "在砂岩样本上训练的代理模型直接外推到砾岩或煤层，射流侵彻机制改变（非均质绕流、层理劈裂），误差可超 40%。解决：输出侧强制给出适用域判定，域外方案一律回到数值仿真或靶试。"
          },
          {
            "name": "只优化穿深、忽略压实带",
            "why": "深穿透弹压实带占比高、孔径小，产能比反而低于大孔径弹。解决：目标函数换产能比或流动效率，把压实带渗透率比纳入输出。"
          }
        ]
      }
    }
  };

  global.Cases.register(DATA);
})(window);
