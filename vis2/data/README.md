# 数据字典 · `vis2/data/`

> ⚠️ 本文件由 `node data/build.mjs --docs` 生成，请勿手改；要补说明请改 `data/manifest.json` 里对应数据集的 `note`。

## 数据链路

```text
data/*.csv        人可读、可 diff 的数据源（一行一个记录，UTF-8 带 BOM，Excel 可直接打开）
data/sim-model.js 模拟器的模型函数（函数没法进 CSV，构建时原样内联进 data.js）
        │  node data/build.mjs              ← 生成
        ▼
data.js           页面加载的数据模块（构建产物，请勿手改）
        ▲  node data/build.mjs --extract    ← 反向：把对 data.js 的手改同步回 CSV
```

- **改数据**：改 `data/` 下的 CSV（一行一个记录，`git diff` 能看清是哪个省、哪一年），再跑 `node data/build.mjs`；
- **改来源与口径说明**：`source` / `note` 也是数据，就在对应 CSV 的列里；
- **改模型**：改 `data/sim-model.js`（模拟器、龙卷风敏感性图、蒙特卡洛分布共用它）；
- **忘记重新构建**：`node data/build.mjs --check` 会断言「仓库里的 data.js 就是这些 CSV 生成的」，`node selfcheck.mjs` 已带上这一步。

## 类型化表头

CSV 第一行每一列写成 `列名:类型`，类型有 `text` / `number` / `boolean` / `json` 四种。
这样「看起来像数字的字符串」（如行政区划代码 `110000`）不会被悄悄变成数字，单位与千分位也不会在往返中丢失。
文案列一律成对出现：`xxx.zh` / `xxx.en`（页面按当前语言取其中一列），`selfcheck` 会核对两侧都在。

## 口径标注（provenance）

每张图表卡片上有一枚来源徽章，取值来自 `data/manifest.json` 里每个数据集的 `provenance`：

| 取值 | 徽章 | 含义 |
|---|---|---|
| `sourced` | 公开统计 | 数值整理自公开报告，能在页面第 13 节的来源清单里对上 |
| `modeled` | 测算整理 | 本页按公开资料测算 / 构造的指数与权重（示意口径） |
| `projected` | 含预测 | 含未来年份的预测值（如 2025E / 2030E） |

规则只有一条，**保守取最弱一环**：一个数据集里只要出现了测算值或预测值，这一组就按更弱的
那一类标注（由强到弱：`sourced` > `modeled` > `projected`）。构建时 `data/build.mjs` 把
每个数据集的口径汇总成 `AI_DATA.provenance`（顶层数据路径 → 口径），页面据此渲染徽章：
`check.mjs` 静态断言取值合法、覆盖全部图表数据路径，`smoke.mjs` 真机核对每张图都有徽章。

## 数据集一览

| 文件 | 数据路径（`AI_DATA` 里的位置） | 形态 | 行 × 列 | 口径 | 说明 |
|---|---|---|---|---|---|
| `root.csv` | `(根对象)` | 单行对象 | 1 × 22 | paletteKeys = 测算整理、paletteBase = 测算整理、paletteAccent = 测算整理、define = 测算整理、timeline = 公开统计、scenes = 测算整理 | 调色板键名：charts.js 按这些键去 tokens.css 取当前主题下的真实色值（改配色只需改 tokens.css） |
| `kpis.csv` | `kpis` | 记录表 | 4 × 8 | 含预测 | 第 1 节四个数字：核心产业规模 / 2030 全球 GDP 增量 / 中国份额 / 算力年均增速 |
| `radar.csv` | `radar` | 单行对象 | 1 × 6 | 测算整理 | 第 3 节雷达图：图题、口径说明与来源 |
| `radar-axes.csv` | `radar.axes` | 双语对照 | 6 × 2 | 测算整理 | 第 3 节雷达图六个能力维度 |
| `radar-series.csv` | `radar.series` | 记录表 | 2 × 3 | 测算整理 | 第 3 节雷达图两条系列（传统生产力 / AI 赋能）的 0–100 指数 |
| `forces.csv` | `forces` | 记录表 | 5 × 12 | 测算整理 | 第 3 节五股作用力卡片：图标 / 名称 / 解释 / 一个可验证的数字 / 标签 |
| `scale.csv` | `scale` | 单行对象 | 1 × 12 | 含预测 | 第 4 节产业规模折线图：图题、单位、两条曲线名与口径 |
| `scale-series.csv` | `scale.series` | 记录表 | 7 × 3 | 含预测 | 第 4 节核心产业规模 2019–2025E（2025 为预测） |
| `scale-related.csv` | `scale.related` | 记录表 | 7 × 3 | 含预测 | 第 4 节带动相关产业规模 2019–2025E（2025 为预测） |
| `scale-forecast.csv` | `scale.forecast` | 记录表 | 3 × 7 | 含预测 | 第 4 节产业规模 2026–2028E：由 2019–2024 实际值线性回归外推的点估计与 95% 预测区间（生成：node data/build.mjs --forecast） |
| `industry.csv` | `industry` | 单行对象 | 1 × 12 | 测算整理 | 第 5 节三次产业赋能条形图：图题与两个指标名 / 口径 |
| `industry-rows.csv` | `industry.rows` | 记录表 | 3 × 8 | 测算整理 | 第 5 节三次产业（三产 / 二产 / 一产）的渗透率、效率增益、占 GDP 比重 |
| `bubble.csv` | `bubble` | 单行对象 | 1 × 12 | 测算整理 | 第 5 节气泡矩阵：坐标轴含义、象限名与来源 |
| `bubble-quadrants.csv` | `bubble.quadrants` | 双语对照 | 4 × 2 | 测算整理 | 第 5 节气泡矩阵四个象限的名称 |
| `bubble-points.csv` | `bubble.points` | 记录表 | 15 × 7 | 测算整理 | 第 5 节 15 个行业：渗透率 / 效率增益 / 市场规模与所属产业（跨图联动靠 id 匹配） |
| `heatmap.csv` | `heatmap` | 单行对象 | 1 × 12 | 测算整理 | 第 5 节热力矩阵：图题、图例与「列内归一化」说明 |
| `heatmap-metrics.csv` | `heatmap.metrics` | 记录表 | 5 × 8 | 测算整理 | 第 5 节热力矩阵 5 列指标（渗透率 / 效率增益 / 市场规模 / 五年增速 / 人才密度） |
| `heatmap-rows.csv` | `heatmap.rows` | 记录表 | 15 × 8 | 测算整理 | 第 5 节 15 行业 × 5 指标原始值（前三列与气泡矩阵同源） |
| `multiples.csv` | `multiples` | 单行对象 | 1 × 10 | 含预测 | 第 5 节小倍数图：图题与两条序列名 |
| `multiples-series.csv` | `multiples.series` | 记录表 | 3 × 6 | 含预测 | 第 5 节三次产业 2019–2025E 渗透率与效率增益（2024 端点与 industry.rows 一致，由 check.mjs 断言） |
| `globalRank.csv` | `globalRank` | 单行对象 | 1 × 8 | 公开统计 | 第 7 节全球格局排名：图题、指数口径与来源 |
| `globalRank-rows.csv` | `globalRank.rows` | 记录表 | 12 × 4 | 公开统计 | 第 7 节 12 个经济体的 AI 发展指数（按数值降序） |
| `province.csv` | `province` | 单行对象 | 1 × 12 | 测算整理 | 第 6 节区域格局地图：图题、五档分位说明、前五名与南海诸岛标注文案 |
| `province-metrics.csv` | `province.metrics` | 记录表 | 2 × 6 | 测算整理 | 第 6 节地图可切换的两个指标：智能算力规模 / AI 企业数量（示意口径） |
| `province-rows.csv` | `province.rows` | 记录表 | 34 × 5 | 测算整理 | 第 6 节 34 个省级单元的算力与企业数量（id 与 map-china.js 的几何 id 双向对齐） |
| `flow.csv` | `flow` | 单行对象 | 1 × 6 | 测算整理 | 第 8 节要素重构流向图：图题与分组名 |
| `flow-columns.csv` | `flow.columns` | 双语对照 | 3 × 2 | 测算整理 | 第 8 节流向图三个纵向分栏（投入 / 要素 / 产出） |
| `flow-nodes.csv` | `flow.nodes` | 记录表 | 10 × 6 | 测算整理 | 第 8 节流向图 10 个节点：名称、宽度（权重）与一句话说明 |
| `flow-links.csv` | `flow.links` | 记录表 | 16 × 3 | 测算整理 | 第 8 节流向图 16 条流量关系（源 → 目标，带宽即权重） |
| `graph.csv` | `graph` | 单行对象 | 1 × 4 | 测算整理 | 第 9 节关系图谱：图题与「分组 / 关系」两套图例 |
| `graph-groups.csv` | `graph.groups` | 记录表 | 6 × 4 | 测算整理 | 第 9 节图谱 6 个分组（算力 / 算法 / 数据 / 要素 / 效应 / 政策 / 应用） |
| `graph-relations.csv` | `graph.relations` | 记录表 | 5 × 3 | 测算整理 | 第 9 节图谱 5 种语义关系（支撑 / 组成 / 赋能 / 驱动 / 引导） |
| `graph-nodes.csv` | `graph.nodes` | 记录表 | 21 × 7 | 测算整理 | 第 9 节图谱 21 个节点：分组、半径、名称与说明 |
| `graph-links.csv` | `graph.links` | 记录表 | 36 × 3 | 测算整理 | 第 9 节图谱 36 条关系（源 / 目标 / 关系类型） |
| `sim.csv` | `sim` | 单行对象 | 1 × 9 | 测算整理 | 第 10 节模拟器：图题、综合指数名与模型说明 |
| `sim-sliders.csv` | `sim.sliders` | 记录表 | 4 × 7 | 测算整理 | 第 10 节四个旋钮（渗透率 / 数据要素 / 人才 / 研发）与默认值、单位、提示语 |
| `sim-presets.csv` | `sim.presets` | 记录表 | 3 × 7 | 测算整理 | 第 10 节三套预设（当前基线 / 制造强国 / 全面智能化） |
| `sim-outputs.csv` | `sim.outputs` | 记录表 | 5 × 10 | 测算整理 | 第 10 节五项输出（全要素生产率 / GDP / 成本 / 能耗 / 岗位）与量程、单位、颜色 |
| `sim-sensitivity.csv` | `sim.sensitivity` | 单行对象 | 1 × 39 | 测算整理 | 第 10 节龙卷风图与蒙特卡洛的文案与参数（±15% 扰动、500 次抽样、固定随机种子） |
| `sources.csv` | `sources` | 记录表 | 12 × 4 | 公开统计 | 第 13 节数据来源 12 条（名称 + 对应口径） |
| `overview.csv` | `overview` | 记录表 | 11 × 6 | 测算整理 | 第 0 节阅读地图 11 张跳转卡片（图标 / 名称 / 说明 / 锚点） |
| `sim-model.js` | `sim.model` | 函数片段 | — | — | 模拟器模型（函数，无法进 CSV） |

> 口径是**人写的数据**：`--extract` 重新索引时与 `note` 一样会被保留，新数据集默认 `modeled`（最保守）。

## 各数据集字段

### `root.csv` → `(根对象)`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `paletteKeys` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `paletteBase` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `paletteAccent` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `define.lead.zh` | text | 中文文案 |
| `define.lead.en` | text | 英文文案 |
| `define.pillars` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `define.compare.caption.zh` | text | 中文文案 |
| `define.compare.caption.en` | text | 英文文案 |
| `define.compare.colBefore.zh` | text | 中文文案 |
| `define.compare.colBefore.en` | text | 英文文案 |
| `define.compare.colAfter.zh` | text | 中文文案 |
| `define.compare.colAfter.en` | text | 英文文案 |
| `define.compare.rows` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `timeline.caption.zh` | text | 中文文案 |
| `timeline.caption.en` | text | 英文文案 |
| `timeline.kinds` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `timeline.items` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `scenes.caption.zh` | text | 中文文案 |
| `scenes.caption.en` | text | 英文文案 |
| `scenes.note.zh` | text | 中文文案 |
| `scenes.note.en` | text | 英文文案 |
| `scenes.items` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |

### `kpis.csv` → `kpis`（4 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `value` | number | 数值 |
| `decimals` | number | 数值 |
| `unit.zh` | text | 中文文案 |
| `unit.en` | text | 英文文案 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `sub.zh` | text | 中文文案 |
| `sub.en` | text | 英文文案 |

### `radar.csv` → `radar`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `radar-axes.csv` → `radar.axes`（6 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `zh` | text | 文本 |
| `en` | text | 文本 |

### `radar-series.csv` → `radar.series`（2 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `values` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |

### `forces.csv` → `forces`（5 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `icon` | text | 文本 |
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `desc.zh` | text | 中文文案 |
| `desc.en` | text | 英文文案 |
| `stat.value` | text | 文本 |
| `stat.unit.zh` | text | 中文文案 |
| `stat.unit.en` | text | 英文文案 |
| `stat.label.zh` | text | 中文文案 |
| `stat.label.en` | text | 英文文案 |
| `tag.zh` | text | 中文文案 |
| `tag.en` | text | 英文文案 |

### `scale.csv` → `scale`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `unit.zh` | text | 中文文案 |
| `unit.en` | text | 英文文案 |
| `coreLabel.zh` | text | 中文文案 |
| `coreLabel.en` | text | 英文文案 |
| `relatedLabel.zh` | text | 中文文案 |
| `relatedLabel.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `scale-series.csv` → `scale.series`（7 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `year` | number | 数值 |
| `value` | number | 数值 |
| `forecast` | boolean | 真假值 |

### `scale-related.csv` → `scale.related`（7 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `year` | number | 数值 |
| `value` | number | 数值 |
| `forecast` | boolean | 真假值 |

### `scale-forecast.csv` → `scale.forecast`（3 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `year` | number | 数值 |
| `core` | number | 数值 |
| `coreLo` | number | 数值 |
| `coreHi` | number | 数值 |
| `related` | number | 数值 |
| `relatedLo` | number | 数值 |
| `relatedHi` | number | 数值 |

### `industry.csv` → `industry`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `penetration.zh` | text | 中文文案 |
| `penetration.en` | text | 英文文案 |
| `gain.zh` | text | 中文文案 |
| `gain.en` | text | 英文文案 |
| `sizeLabel.zh` | text | 中文文案 |
| `sizeLabel.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `industry-rows.csv` → `industry.rows`（3 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `key.zh` | text | 中文文案 |
| `key.en` | text | 英文文案 |
| `penetration` | number | 数值 |
| `gain` | number | 数值 |
| `size` | number | 数值 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |

### `bubble.csv` → `bubble`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `xLabel.zh` | text | 中文文案 |
| `xLabel.en` | text | 英文文案 |
| `yLabel.zh` | text | 中文文案 |
| `yLabel.en` | text | 英文文案 |
| `sizeLabel.zh` | text | 中文文案 |
| `sizeLabel.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `bubble-quadrants.csv` → `bubble.quadrants`（4 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `zh` | text | 文本 |
| `en` | text | 文本 |

### `bubble-points.csv` → `bubble.points`（15 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `x` | number | 数值 |
| `y` | number | 数值 |
| `size` | number | 数值 |
| `sector` | text | 文本 |

### `heatmap.csv` → `heatmap`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `legend.zh` | text | 中文文案 |
| `legend.en` | text | 英文文案 |
| `legendLow.zh` | text | 中文文案 |
| `legendLow.en` | text | 英文文案 |
| `legendHigh.zh` | text | 中文文案 |
| `legendHigh.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `heatmap-metrics.csv` → `heatmap.metrics`（5 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `short.zh` | text | 中文文案 |
| `short.en` | text | 英文文案 |
| `unit.zh` | text | 中文文案 |
| `unit.en` | text | 英文文案 |
| `decimals` | number | 数值 |

### `heatmap-rows.csv` → `heatmap.rows`（15 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `pen` | number | 数值 |
| `gain` | number | 数值 |
| `size` | number | 数值 |
| `cagr` | number | 数值 |
| `talent` | number | 数值 |

### `multiples.csv` → `multiples`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `seriesLabels.penetration.zh` | text | 中文文案 |
| `seriesLabels.penetration.en` | text | 英文文案 |
| `seriesLabels.gain.zh` | text | 中文文案 |
| `seriesLabels.gain.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `multiples-series.csv` → `multiples.series`（3 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `key.zh` | text | 中文文案 |
| `key.en` | text | 英文文案 |
| `colorKey` | text | 文本 |
| `penetration` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |
| `gain` | json | 结构化数据（数组 / 对象，CSV 里是 JSON 单元） |

### `globalRank.csv` → `globalRank`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `metric.zh` | text | 中文文案 |
| `metric.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `globalRank-rows.csv` → `globalRank.rows`（12 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `value` | number | 数值 |
| `flag` | text | 文本 |

### `province.csv` → `province`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `insetLabel.zh` | text | 中文文案 |
| `insetLabel.en` | text | 英文文案 |
| `noData.zh` | text | 中文文案 |
| `noData.en` | text | 英文文案 |
| `leaders.zh` | text | 中文文案 |
| `leaders.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `province-metrics.csv` → `province.metrics`（2 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `unit.zh` | text | 中文文案 |
| `unit.en` | text | 英文文案 |
| `decimals` | number | 数值 |

### `province-rows.csv` → `province.rows`（34 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `compute` | number | 数值 |
| `firms` | number | 数值 |

### `flow.csv` → `flow`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |
| `source.zh` | text | 中文文案 |
| `source.en` | text | 英文文案 |

### `flow-columns.csv` → `flow.columns`（3 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `zh` | text | 文本 |
| `en` | text | 文本 |

### `flow-nodes.csv` → `flow.nodes`（10 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `col` | number | 数值 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `weight` | number | 数值 |
| `icon` | text | 文本 |

### `flow-links.csv` → `flow.links`（16 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `from` | text | 文本 |
| `to` | text | 文本 |
| `value` | number | 数值 |

### `graph.csv` → `graph`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |

### `graph-groups.csv` → `graph.groups`（6 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `colorKey` | text | 文本 |

### `graph-relations.csv` → `graph.relations`（5 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |

### `graph-nodes.csv` → `graph.nodes`（21 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `g` | text | 文本 |
| `size` | number | 数值 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `desc.zh` | text | 中文文案 |
| `desc.en` | text | 英文文案 |

### `graph-links.csv` → `graph.links`（36 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `s` | text | 文本 |
| `t` | text | 文本 |
| `r` | text | 文本 |

### `sim.csv` → `sim`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `index.zh` | text | 中文文案 |
| `index.en` | text | 英文文案 |
| `baseline.zh` | text | 中文文案 |
| `baseline.en` | text | 英文文案 |
| `formulaNote.zh` | text | 中文文案 |
| `formulaNote.en` | text | 英文文案 |
| `model` | text | 文本 |

### `sim-sliders.csv` → `sim.sliders`（4 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `value` | number | 数值 |
| `unit` | text | 文本 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `hint.zh` | text | 中文文案 |
| `hint.en` | text | 英文文案 |

### `sim-presets.csv` → `sim.presets`（3 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `values.penetration` | number | 数值 |
| `values.dataFactor` | number | 数值 |
| `values.talent` | number | 数值 |
| `values.rd` | number | 数值 |

### `sim-outputs.csv` → `sim.outputs`（5 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | text | 文本 |
| `max` | number | 数值 |
| `decimals` | number | 数值 |
| `unit.zh` | text | 中文文案 |
| `unit.en` | text | 英文文案 |
| `colorKey` | text | 文本 |
| `label.zh` | text | 中文文案 |
| `label.en` | text | 英文文案 |
| `why.zh` | text | 中文文案 |
| `why.en` | text | 英文文案 |

### `sim-sensitivity.csv` → `sim.sensitivity`（1 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `caption.zh` | text | 中文文案 |
| `caption.en` | text | 英文文案 |
| `target.zh` | text | 中文文案 |
| `target.en` | text | 英文文案 |
| `tornadoTitle.zh` | text | 中文文案 |
| `tornadoTitle.en` | text | 英文文案 |
| `tornadoHint.zh` | text | 中文文案 |
| `tornadoHint.en` | text | 英文文案 |
| `mcTitle.zh` | text | 中文文案 |
| `mcTitle.en` | text | 英文文案 |
| `mcHint.zh` | text | 中文文案 |
| `mcHint.en` | text | 英文文案 |
| `sweepLabel.zh` | text | 中文文案 |
| `sweepLabel.en` | text | 英文文案 |
| `lowLabel.zh` | text | 中文文案 |
| `lowLabel.en` | text | 英文文案 |
| `highLabel.zh` | text | 中文文案 |
| `highLabel.en` | text | 英文文案 |
| `swingLabel.zh` | text | 中文文案 |
| `swingLabel.en` | text | 英文文案 |
| `p5Label.zh` | text | 中文文案 |
| `p5Label.en` | text | 英文文案 |
| `p50Label.zh` | text | 中文文案 |
| `p50Label.en` | text | 英文文案 |
| `p95Label.zh` | text | 中文文案 |
| `p95Label.en` | text | 英文文案 |
| `currentLabel.zh` | text | 中文文案 |
| `currentLabel.en` | text | 英文文案 |
| `countLabel.zh` | text | 中文文案 |
| `countLabel.en` | text | 英文文案 |
| `lowWord.zh` | text | 中文文案 |
| `lowWord.en` | text | 英文文案 |
| `highWord.zh` | text | 中文文案 |
| `highWord.en` | text | 英文文案 |
| `perturb` | number | 数值 |
| `draws` | number | 数值 |
| `seed` | number | 数值 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |

### `sources.csv` → `sources`（12 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `note.zh` | text | 中文文案 |
| `note.en` | text | 英文文案 |

### `overview.csv` → `overview`（11 行）

| 列 | 类型 | 含义 |
|---|---|---|
| `icon` | text | 文本 |
| `name.zh` | text | 中文文案 |
| `name.en` | text | 英文文案 |
| `desc.zh` | text | 中文文案 |
| `desc.en` | text | 英文文案 |
| `href` | text | 文本 |

---

共 41 个数据集、272 行、318 列。数据来源与口径说明见页面第 13 节与 `README.md` 的「数据说明」。
