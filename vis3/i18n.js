/* =========================================================
 * i18n.js —— 中英双语引擎与词条(vis3)
 * ---------------------------------------------------------
 * 机制与全站共享版一致:
 *   ① 静态文案:data-i18n="key" / data-i18n-attr="title:key"
 *   ② 动态文案:I18N.t(key),支持 {name} 占位插值 I18N.t(key, {name})
 *   ③ 切换时派发 'langchange',app.js 据此重绘表格 / 图表 / 代码
 *   ④ ?lang=zh|en > localStorage > 浏览器语言 > 中文
 * 中英文词条一一对应,key 缺失时回退中文、绝不裸显 key。
 * ========================================================= */
(function () {
  'use strict';

  var KEY = 'vis3-lang';

  var DICT = {
    zh: {
      'doc.title': 'Pandas功能可视化平台',
      'doc.desc': '在浏览器里以可视化方式完成 pandas 式数据分析:加载 CSV/JSON,筛选、排序、分组、透视、合并、画图,并自动生成对应的 pandas 代码。',
      'brand': 'Pandas功能可视化平台',

      /* ---------- 数据源 ---------- */
      'src.title': '数据源',
      'src.builtin': '内置数据',
      'src.loaded': '已加载',
      'src.upload': '上传 CSV / JSON',
      'src.paste': '粘贴数据',
      'src.url': '从 URL 加载',
      'src.pasteTitle': '粘贴 CSV 文本',
      'src.pasteHint': '第一行为列名,逗号分隔;支持带引号的字段。',
      'src.urlTitle': '从 URL 加载',
      'src.urlHint': '输入可公开访问的 CSV / JSON 地址(需允许跨域)。',
      'src.name': '数据集名称',
      'src.file': '选择文件',
      'src.rowsCols': '{rows} 行 × {cols} 列',
      'src.useDefault': '已载入默认数据集 sales,可直接开始分析。',

      /* ---------- 数据集简介(选中后显示在顶部工具栏) ---------- */
      'ds.sales': '零售门店 2025 年上半年的销售订单流水,含地区、品类、渠道、金额与折扣,适合分组聚合、时序与回归分析。',
      'ds.products': '在售商品主数据表,记录商品名、品类、价格与品牌,行数少,适合快速上手选择列、排序与描述统计。',
      'ds.tips': '餐厅顾客消费与小费记录,含用餐日/时段、性别、是否吸烟与聚会人数,是研究小费行为的经典数据。',
      'ds.iris': '鸢尾花经典数据集,三种鸢尾花各 50 条的花萼/花瓣尺寸测量,常用于聚类与分类入门演示。',
      'ds.titanic': '泰坦尼克号乘客名单(模拟抽样),含舱位、年龄、票价与是否生还,适合逻辑回归与决策树演示。',
      'ds.weather': '北京与上海两城 180 天的逐日天气(气温、湿度、降雨、风速),适合折线时序与城市对比分析。',
      'ds.generic': '本地导入的数据集,可先用「查看」分组了解结构,再从左侧分组挑选操作开始分析。',

      /* ---------- 操作分组 ---------- */
      'opg.inspect': '查看',
      'opg.select': '行列',
      'opg.clean': '清洗',
      'opg.transform': '变换',
      'opg.ts': '时序',
      'opg.agg': '汇总',
      'opg.viz': '可视化',

      'op.head': 'head 前几行',
      'op.tail': 'tail 后几行',
      'op.sample': 'sample 随机抽样',
      'op.info': 'info 结构信息',
      'op.describe': 'describe 描述统计',
      'op.missingmap': '缺失值地图',
      'op.select': '选择列',
      'op.drop': '删除列',
      'op.rename': '重命名列',
      'op.astype': '转换类型',
      'op.filter': 'filter 条件筛选',
      'op.sort': 'sort 排序',
      'op.dedup': '去重',
      'op.dropna': '删除缺失',
      'op.fillna': '填充缺失',
      'op.assign': 'assign 计算列',
      'op.cut': 'cut 分箱',
      'op.merge': 'merge 连接',
      'op.concat': 'concat 拼接',
      'op.groupby': 'groupby 分组聚合',
      'op.pivot': 'pivot 透视表',
      'op.valuecounts': 'value_counts 计数',
      'op.corr': 'corr 相关系数',
      'op.resample': 'resample 重采样',
      'op.rolling': 'rolling 滚动平均',
      'op.pctchange': 'pct_change 环比',
      'op.hist': '直方图',
      'op.bar': '条形图',
      'op.pie': '饼图/环形图',
      'f.catCol': '类别列',
      'f.sizeCol': '数值列(可选)',
      'f.pieCount': '计数(默认)',
      'f.pieStyle': '图形样式',
      'f.pie': '饼图',
      'f.donut': '环形图',
      'f.pieOther': '其他',
      'op.line': '折线图',
      'op.scatter': '散点图',
      'op.box': '箱线图',
      'op.heatmap': '相关热力图',
      'op.linreg': '线性回归',
      'op.kmeans': 'K-Means 聚类',
      'op.logreg': '逻辑回归(二分类)',
      'op.polyreg': '多项式回归',
      'op.knn': 'K近邻分类',
      'op.dtree': '决策树分类',
      'op.pca': 'PCA 主成分分析',
      'opg.ml': '机器学习',
      'f.target': '目标列(须恰两个取值)',
      'f.k': '簇数 k',
      'f.feat1': '特征 1(X)',
      'f.feat2': '特征 2(Y)',
      'f.degree': '多项式阶数',
      'f.degQuad': '二次(抛物线)',
      'f.degCubic': '三次(S 形)',
      'f.neighbors': '近邻数 k',
      'f.maxDepth': '最大树深',
      'f.dateCol': '日期列',
      'f.rule': '周期',
      'f.ruleD': '按日 D',
      'f.ruleW': '按周 W',
      'f.ruleM': '按月 M',
      'f.window': '窗口大小',
      'f.features': '参与降维的数值列(至少勾选 2 列)',
      'res.equation': '回归方程',
      'res.r2': '决定系数 R²',
      'res.n': '有效样本',
      'res.accuracy': '训练准确率',
      'res.centers': '聚类中心(原始尺度)',
      'res.counts': '簇样本数',
      'res.weights': '权重(标准化空间)',
      'res.mapInfo': '目标映射',
      'res.iterations': '迭代次数',
      'res.degree': '阶数',
      'res.polyEq': '拟合方程(标准化空间)',
      'res.zstd': 'z = ({x} − {mean}) / {std}',
      'res.depth': '树深度',
      'res.leaves': '叶节点数',
      'res.importance': '特征重要性',
      'res.rules': '叶节点规则(最多显示 8 条)',
      'res.when': '条件(全部满足)',
      'res.predict': '预测类别',
      'res.purity': '类别纯度',
      'res.pc': '主成分',
      'res.eigvalue': '特征值 λ',
      'res.variance': '方差解释率',
      'res.cum': '累计',
      'res.loadings': '载荷矩阵(PC1 / PC2)',
      'res.r2Train': '训练 R²',
      'res.r2Test': '测试 R²',
      'res.accTrain': '训练准确率',
      'res.accTest': '测试准确率',
      'res.split': '训练/测试样本',
      'res.confusion': '混淆矩阵（测试集）',
      'res.actualLabel': '实际',
      'res.predLabel': '预测',
      'res.newCol': '已新增列 {col}',
      'lg.train': '训练集',
      'lg.test': '测试集',
      'msg.needBinary': '目标列需要恰好两个不同取值(如 returned / channel)',
      'msg.needDateCol': '需要日期列:先用「行列 → 转换类型」把某列转成 datetime',
      'msg.need2cols': '请至少勾选 2 个数值列',

      /* ---------- 图表解读 ---------- */
      'ins.title': '图表解读',
      'ins.pd.role': '{text};对应代码已同步到右侧 pandas 代码面板。',
      'ins.pd.hist': 'pandas 的角色:分箱计数由 pd.cut + value_counts 完成,均值与分位数见 df[col].describe()',
      'ins.pd.bar': 'pandas 的角色:数据由 groupby(…).agg() 聚合并排序,图表只是这一结果的图形化',
      'ins.pd.line': 'pandas 的角色:曲线上的每个点都先经 groupby(…).sum() 或 pivot_table(…) 聚合',
      'ins.pd.scatter': 'pandas 的角色:选列、剔除缺失与抽样由 pandas 完成,相关性强弱可用 df[[x,y]].corr() 量化',
      'ins.pd.box': 'pandas 的角色:各组中位数与四分位数来自 groupby(…).describe()',
      'ins.pd.heatmap': 'pandas 的角色:整张相关矩阵由 df.corr(numeric_only=True) 一步生成',
      'ins.pie.top': '最大扇区「{cat}」占 {pct}%。',
      'ins.pd.pie': 'pandas 的角色:各扇区数值先由 value_counts() 或 groupby(…).sum() 算好,plot(kind=\'pie\') 只负责按占比切分圆面',
      'ins.pd.valuecounts': 'pandas 的角色:value_counts() 一次完成按取值分组计数与降序排列,下方环形图就是这份频数表的图形化',
      'ins.pd.resample': 'pandas 的角色:pd.to_datetime + set_index + resample(…).agg() 是时序聚合三件套',
      'ins.pd.rolling': 'pandas 的角色:df[col].rolling(w).mean() 一行完成滑动窗口统计,窗口不足 w 期自动留空',
      'ins.pd.pctchange': 'pandas 的角色:df[col].pct_change() 一步算出环比,等价于 df[col] / df[col].shift(1) - 1',
      'ins.pd.linreg': 'pandas 的角色:先用 df[[x,y]].dropna() 备料、train_test_split 切出训练/测试集,特征矩阵 df[[x]] 再交给 sklearn 求解',
      'ins.pd.kmeans': 'pandas 的角色:用 df[[f1,f2]] 选取特征;聚类前通常先 describe() 看量纲(本页已自动标准化)',
      'ins.pd.logreg': 'pandas 的角色:目标列常由条件表达式构造(如 (df["discount"]>0.15).astype(int)),train_test_split 切分前后可各用 value_counts() 检查类别平衡',
      'ins.pd.missingmap': 'pandas 的角色:df.isna().sum() 一行得到每列缺失统计,可视化后直接决定删列还是填充',
      'ins.missingmap.worst': '缺失最多的是「{col}」({n} 格,占 {pct}%):缺失率过高的列适合 dropna 整列删除,零散缺失更适合 fillna 填充。',
      'ins.hist.shape': '共 {n} 个有效值:均值 {mean},中位数 {median},标准差 {std}。',
      'ins.hist.skewPos': '均值高于中位数,分布右偏——少数偏大的值把均值拉高。',
      'ins.hist.skewNeg': '均值低于中位数,分布左偏——少数偏小的值把均值拉低。',
      'ins.hist.skewNone': '均值与中位数接近,分布大致对称。',
      'ins.hist.outlier': '约 {n} 个值落在 1.5×IQR 之外(小于 {lo} 或大于 {hi}),如需可用「清洗 → filter」剔除。',
      'ins.hist.noOutlier': '按 1.5×IQR 规则没有明显离群点。',
      'ins.bar.top': '最高项「{cat}」= {val},约占总量 {pct}%。',
      'ins.bar.top3': '前 3 项合计占 {pct}%(共 {n} 项)。',
      'ins.line.trend': '从首到尾:{first} → {last},{dir} {pct}%。',
      'ins.line.up': '上升',
      'ins.line.down': '下降',
      'ins.line.trendFlat': '从首到尾:{first} → {last},整体基本持平(变化 {pct}%)。',
      'ins.line.peak': '峰值出现在 {x}:{v}。',
      'ins.scatter.corr': '相关系数 r = {r}:{x} 与 {y} 呈{a}{b}线性相关。',
      'ins.scatter.corrNone': '相关系数 r = {r}:{x} 与 {y} 几乎无线性相关。',
      'ins.scatter.strong': '强',
      'ins.scatter.mid': '中等',
      'ins.scatter.weak': '弱',
      'ins.scatter.pos': '正',
      'ins.scatter.neg': '负',
      'ins.scatter.sampled': '行数较多,已抽样 {n} 行绘制(df.sample({n}))。',
      'ins.box.med': '中位数最高的是「{g}」({v}),最低的是「{g2}」({v2})。',
      'ins.box.spread': '「{g}」的箱体最宽(IQR ≈ {v}),组内波动最大。',
      'ins.heatmap.pos': '最强正相关:{a} ↔ {b}(r = {r})。',
      'ins.heatmap.neg': '最强负相关:{a} ↔ {b}(r = {r})。',
      'ins.heatmap.none': '各数值列之间相关性都较弱(|r| < 0.2)。',
      'ins.resample.n': '共 {n} 个「{rule}」周期,均值 {mean}。',
      'ins.rolling.win': '新列 {col} 是 {src} 的 {w} 期移动平均:抹平短期波动,便于观察长期趋势。',
      'ins.pctchange.dir': '新列 {col} 中 {up} 期环比上升、{down} 期环比下降。',
      'ins.pctchange.base': '环比 = 本期 ÷ 上期 − 1;首行或上期为 0 / 缺失时留空。',
      'ins.split.r2': '随机留出 30% 作测试集:训练 R² = {tr},测试 R² = {te}——测试值更能反映泛化能力,两者差距大提示过拟合。',
      'ins.split.acc': '训练准确率 {tr}%,测试准确率 {te}%——测试值更能反映泛化能力,两者差距大提示过拟合。',
      'ins.linreg.slope': '斜率 ≈ {slope}:{x} 每增加 1 个单位,{y} 平均随之变化 {slope}。',
      'ins.linreg.r2good': 'R² = {r2}:{x} 能解释 {y} 约 {pct}% 的方差,线性拟合较好。',
      'ins.linreg.r2mid': 'R² = {r2}:{x} 能解释 {y} 约 {pct}% 的方差,线性关系中等,可能还有其他影响因素。',
      'ins.linreg.r2bad': 'R² = {r2}:{x} 几乎解释不了 {y} 的变化(仅 {pct}%),线性关系很弱——可换一对特征,或先做数据清洗。',
      'ins.kmeans.sizes': '各簇规模:{sizes}({balance})。',
      'ins.kmeans.balanced': '较均衡',
      'ins.kmeans.uneven': '差异较大',
      'ins.kmeans.center': '「{f}」最高的是 C{i}(中心 ≈ {v}),可把该簇理解为「{f} 偏高」的群体。',
      'ins.kmeans.iter': '{n} 次迭代后收敛。',
      'ins.logreg.acc': '训练准确率 {pct}%;多数类基线为 {base}%,模型{cmp}。',
      'ins.logreg.better': '明显优于基线',
      'ins.logreg.close': '相对基线提升有限,可尝试更换特征',
      'ins.logreg.w': '标准化权重:{f1} = {w1},{f2} = {w2}。绝对值越大影响越强;正权重把样本推向「{cls}」。',
      'ins.logreg.grid': '背景网格是模型的预测区域:每个小格代表一对特征取值下的预测类别,两色交界处即决策边界。',
      'ins.pd.polyreg': 'pandas 的角色:多项式特征是用 assign 造出来的——z=(x−μ)/σ、z²=z**2;train_test_split 切分后拟合交给 sklearn',
      'ins.pd.knn': 'pandas 的角色:df[[f1,f2]] 选特征、groupby(目标)看类别分布;train_test_split 切分后标准化等价于 (df[cols]-mean)/std,距离才公平',
      'ins.pd.dtree': 'pandas 的角色:每条树规则都能用布尔索引复核,如 df[(df.discount<=0.18)&(df.quantity<=7)]["returned"].mean();train_test_split 切分后建树更客观',
      'ins.pd.pca': 'pandas 的角色:标准化一行搞定 (df[num]-df[num].mean())/df[num].std();PCA 得分再用 pd.DataFrame 接回原索引',
      'ins.poly.vertexMin': '抛物线在 {x} 处达到最低点(预测值 ≈ {y}):最低点两侧 y 都随之上升。',
      'ins.poly.vertexMax': '抛物线在 {x} 处达到最高点(预测值 ≈ {y}):最高点两侧 y 都随之下降。',
      'ins.poly.deg3': '三次项更灵活,能拐两个弯,但也更容易在数据稀疏处过拟合——留意曲线两端是否异常翘起。',
      'ins.knn.k': 'k = {k}:每个点按距离最近的 {k} 个邻居投票定类;k 越小边界越曲折(易过拟合),k 越大越平滑(易欠拟合)。',
      'ins.dtree.size': '树深 {d} 层、{leaves} 个叶节点:{leaves} 条 if-else 阈值规则覆盖全部预测。',
      'ins.dtree.imp': '最重要的切分特征是「{f}」(重要性 {pct}%):模型主要靠它区分类别。',
      'ins.dtree.boundary': '边界横平竖直:每条边都对应一个可读的阈值规则(见左侧结果表),这正是决策树可解释的原因。',
      'ins.pca.pc1': 'PC1 解释 {pct}% 的总方差,载荷最大的特征是「{f}」({v}):它主要代表这个方向。',
      'ins.pca.pc2': 'PC2 再解释 {pct}%,主要由「{f}」({v})方向构成。',
      'ins.pca.cum': '前两个主成分合计保留 {pct}% 的信息:把 {d} 个数值列压缩到 2 维用于画图。',
      'ins.pca.biplot': '红色箭头为特征载荷:同向为正相关、反向为负相关、夹角≈90°近似不相关;箭头越长对该主成分贡献越大。',

      /* ---------- 表单字段 ---------- */
      'f.column': '列',
      'f.columns': '列(可多选)',
      'f.n': '行数 n',
      'f.newname': '新列名',
      'f.newcol': '新列名',
      'f.type': '目标类型',
      'f.value': '值',
      'f.value2': '第二个值',
      'f.method': '方式',
      'f.expr': '表达式',
      'f.exprHint': '例:quantity * unit_price * (1 - discount);可用列名、+ - * / %、比较与函数 round/abs/sqrt/log/upper/lower/len/year/month/day 等。',
      'f.exprError': '表达式无法解析:',
      'f.cond': '筛选条件',
      'f.addCond': '+ 添加条件',
      'f.logic': '条件组合',
      'f.and': '且(AND)',
      'f.or': '或(OR)',
      'f.sortBy': '排序依据',
      'f.addSort': '+ 添加排序列',
      'f.asc': '升序',
      'f.desc': '降序',
      'f.subset': '作用列(默认全部)',
      'f.how': '判定',
      'f.howAny': '任一缺失即删(any)',
      'f.howAll': '全部缺失才删(all)',
      'f.keys': '分组键',
      'f.aggs': '聚合',
      'f.addAgg': '+ 添加聚合',
      'f.func': '函数',
      'f.aggcol': '聚合列',
      'f.index': '行(index)',
      'f.pivotCols': '列(columns)',
      'f.values': '值(values)',
      'f.aggfunc': '聚合方式',
      'f.on': '连接键(本表)',
      'f.onOther': '连接键(对方)',
      'f.howJoin': '连接方式',
      'f.other': '另一数据集',
      'f.bins': '分箱数',
      'f.x': 'X 轴',
      'f.y': 'Y 轴',
      'f.group': '分组着色(可选)',
      'f.groupByCat': '分组列',
      'f.series': '系列列(可选)',
      'f.chartTitle': '标题(可选)',

      /* 筛选操作符 */
      'fop.eq': '等于 ==', 'fop.ne': '不等于 !=', 'fop.gt': '大于 >', 'fop.ge': '大于等于 >=',
      'fop.lt': '小于 <', 'fop.le': '小于等于 <=', 'fop.between': '介于 between',
      'fop.contains': '包含 contains', 'fop.notcontains': '不包含',
      'fop.startswith': '开头是', 'fop.endswith': '结尾是',
      'fop.in': '在列表中 in(逗号分隔)', 'fop.isnull': '是缺失 isnull', 'fop.notnull': '非缺失 notnull',

      /* 填充方式 / 连接方式 / 类型 */
      'fill.value': '指定值', 'fill.mean': '均值 mean', 'fill.median': '中位数 median',
      'fill.mode': '众数 mode', 'fill.ffill': '向前填充 ffill', 'fill.bfill': '向后填充 bfill',
      'join.inner': '内连接 inner', 'join.left': '左连接 left', 'join.right': '右连接 right', 'join.outer': '外连接 outer',
      'type.number': '数值 number', 'type.string': '文本 string', 'type.datetime': '日期 datetime', 'type.boolean': '布尔 boolean',

      /* ---------- 状态栏 / 工具 ---------- */
      'stat.missing': '缺失 {n} 格',
      'stat.none': '无缺失',
      'stat.mem': '约 {n} KB',
      'act.undo': '撤销一步',
      'act.redo': '重做',
      'act.reset': '回到原始表',
      'act.export': '导出 CSV',
      'act.code': 'pandas 代码',
      'act.apply': '应用',
      'act.cancel': '取消',
      'act.close': '关闭',
      'act.copy': '复制代码',
      'act.copied': '已复制到剪贴板',
      'act.help': '使用说明',
      'act.exportSvg': '导出 SVG',
      'act.exportPng': '导出 PNG',

      /* ---------- 表格 / 分页 ---------- */
      'tbl.prev': '上一页',
      'tbl.next': '下一页',
      'tbl.page': '第 {p} / {n} 页',
      'tbl.pageSize': '每页',
      'tbl.rows': '行',
      'tbl.empty': '当前结果为空(0 行)。',
      'tbl.sortHint': '点击表头可按该列排序(记入操作历史)',

      /* ---------- 表格筛选条 ---------- */
      'tf.search': '搜索…',
      'tf.all': '全选',
      'tf.apply': '筛选',
      'tf.clear': '清除',
      'tf.noMatch': '没有符合筛选条件的行。',

      /* ---------- 历史 / 代码 ---------- */
      'hist.title': '操作历史',
      'hist.empty': '还没有操作。在左侧任选一个功能开始分析。',
      'hist.original': '原始数据',
      'code.title': '等价的 pandas 代码',
      'code.hint': '每一步操作都会在这里追加对应代码,可直接复制到 Python 里复现。',
      'code.header': 'import pandas as pd',

      /* ---------- 结果面板 ---------- */
      'res.title': '结果',
      'res.info': '结构信息',
      'res.describe': '描述统计',
      'res.count': '计数',
      'res.pct': '占比 %',
      'res.col.name': '列名', 'res.col.dtype': '类型', 'res.col.nonNull': '非空',
      'res.col.nulls': '缺失', 'res.col.unique': '唯一值',
      'res.stat': '统计量',
      'res.summary.num': '{n} 个数值列',
      'res.missCol': '列', 'res.missCnt': '缺失数', 'res.missRate': '缺失率(%)',
      'res.charts': '图表',

      /* ---------- 提示 ---------- */
      'msg.loaded': '已加载数据集 {name}:{rows} 行 × {cols} 列',
      'msg.loadFail': '加载失败:{err}',
      'msg.applied': '已应用:{op}',
      'msg.undone': '已撤销一步',
      'msg.redone': '已重做一步',
      'msg.resetDone': '已回到原始数据',
      'msg.opFail': '操作失败:{err}',
      'msg.noNumCol': '当前没有数值列',
      'msg.noMissing': '该数据没有缺失值',
      'msg.needOther': 'merge / concat 需要至少两个数据集:请再上传或粘贴一份数据。',
      'msg.switched': '已切换到数据集 {name}',
      'msg.exported': '已导出 {name}',
      'msg.nothing': '没有可撤销的步骤',
      'msg.nothingRedo': '没有可重做的步骤',

      /* ---------- 说明 ---------- */
      'help.title': '使用说明',
      'help.body': '<p><b>这是什么:</b>一个纯前端的「可视化 pandas」。左侧选数据与操作,中间看表与图,右侧自动生成可复制的 pandas 代码。</p>' +
        '<p><b>上手三步:</b>① 默认已加载 <code>sales</code> 订单数据,直接点左侧任意操作;② 每个操作在弹窗里选列、填参数,点「应用」;③ 随时「撤销」「回到原始表」,或把代码复制到本地 Python 复现。</p>' +
        '<p><b>载入自己的数据:</b>上传 CSV / JSON 文件、粘贴 CSV 文本,或从 URL 拉取;列类型自动推断(数值 / 日期 / 布尔 / 文本)。</p>' +
        '<p><b>内置数据集:</b><code>sales</code> 订单明细(默认)、<code>products</code> 产品维表(演示 merge)、<code>tips</code> 餐厅小费、<code>iris</code> 鸢尾花、<code>titanic</code> 泰坦尼克乘客、<code>weather</code> 气象日序列;再上传一份数据即可与内置表连接 / 拼接。</p>' +
        '<p><b>时序:</b>「时序」分组提供 resample 重采样(按日 / 周 / 月聚合)、rolling 滚动平均与 pct_change 环比,先把某列转成 datetime 再用它们,配合折线图即可观察长期趋势与短期波动。</p>' +
        '<p><b>图表:</b>直方、条形、饼图/环形图、折线、散点、箱线、相关热力图;饼图/环形图是 value_counts 的天然搭档(「汇总 → value_counts 计数」即自动联动环形图),悬停任意图形会高亮同系列并淡出其余,折线图带十字准线,可同时读取所有系列在该处的数值,底部图例悬停同样能高亮对应系列;可导出 SVG / PNG。</p>' +
        '<p><b>机器学习:</b>7 个代表性算法——回归类:线性回归、多项式回归(拟合曲线 + 顶点),散点图自动区分训练 / 测试点;分类类:逻辑回归、K近邻、决策树(决策边界 + 可读规则);聚类:K-Means(簇着色 + 质心);降维:PCA(方差解释率 + 载荷箭头)。有监督算法会自动按约 70/30 划分训练 / 测试集,同时展示两组指标,分类任务还会给出测试集混淆矩阵。代码面板同步给出 sklearn 写法。</p>' +
        '<p><b>数据洞察:</b>每个图表下方附「图表解读」,自动总结数据要点;「查看 → 缺失值地图」列出每列的缺失数与缺失率,直接指导该 dropna 删列还是 fillna 填充。</p>' +
        '<p><b>表格筛选:</b>每张表格上方都有一行筛选条——每列一个可搜索的多选下拉(勾选要保留的值,支持多列同时筛选、取交集),选好后点「筛选」按钮即按所选元组过滤表格,「清除」一键还原全部行;筛选只是视图效果,不会改动数据。</p>',

      'skip': '跳到正文',
      'footer.line1': '© 2026 · Pandas功能可视化平台 · 数据仅保存在本地浏览器',
      'footer.line2': '内置数据为固定种子生成的演示数据;上传的数据不会离开你的设备。'
    },

    en: {
      'doc.title': 'Pandas功能可视化平台',
      'doc.desc': 'Do pandas-style data analysis visually in the browser: load CSV/JSON, filter, sort, group, pivot, merge and chart — with equivalent pandas code generated for every step.',
      'brand': 'Pandas功能可视化平台',

      'src.title': 'Data Sources',
      'src.builtin': 'Built-in',
      'src.loaded': 'Loaded',
      'src.upload': 'Upload CSV / JSON',
      'src.paste': 'Paste Data',
      'src.url': 'Load from URL',
      'src.pasteTitle': 'Paste CSV Text',
      'src.pasteHint': 'First row is the header, comma-separated; quoted fields supported.',
      'src.urlTitle': 'Load from URL',
      'src.urlHint': 'Enter a publicly accessible CSV / JSON URL (CORS must be allowed).',
      'src.name': 'Dataset name',
      'src.file': 'Choose file',
      'src.rowsCols': '{rows} rows × {cols} cols',
      'src.useDefault': 'The default dataset sales is loaded — start analyzing right away.',

      /* ---------- Built-in dataset blurbs (shown in the toolbar when selected) ---------- */
      'ds.sales': 'Retail order flow for H1 2025 with region, category, channel, amount and discount — great for groupby, time series and regression.',
      'ds.products': 'Product master table with name, category, price and brand — small and handy for selecting, sorting and describe().',
      'ds.tips': 'Restaurant bills and tips with day, time, gender, smoker flag and party size — a classic dataset for studying tipping behavior.',
      'ds.iris': 'The classic iris set: 50 samples each of three species with sepal/petal measurements — a staple for clustering and classification.',
      'ds.titanic': 'Titanic passenger list (simulated sample) with class, age, fare and survival — a playground for logistic regression and decision trees.',
      'ds.weather': 'Daily weather for Beijing and Shanghai over 180 days (temperature, humidity, rainfall, wind) — good for line charts and city comparison.',
      'ds.generic': 'A locally imported dataset. Use the Inspect group to profile it, then pick operations from the groups on the left.',

      'opg.inspect': 'Inspect',
      'opg.select': 'Select',
      'opg.clean': 'Clean',
      'opg.transform': 'Transform',
      'opg.ts': 'Time Series',
      'opg.agg': 'Aggregate',
      'opg.viz': 'Visualize',

      'op.head': 'head — first rows',
      'op.tail': 'tail — last rows',
      'op.sample': 'sample — random rows',
      'op.info': 'info — structure',
      'op.describe': 'describe — statistics',
      'op.missingmap': 'Missing map',
      'op.select': 'Select columns',
      'op.drop': 'Drop columns',
      'op.rename': 'Rename column',
      'op.astype': 'Change dtype',
      'op.filter': 'filter — row filter',
      'op.sort': 'sort — order rows',
      'op.dedup': 'Drop duplicates',
      'op.dropna': 'Drop missing',
      'op.fillna': 'Fill missing',
      'op.assign': 'assign — computed column',
      'op.cut': 'cut — binning',
      'op.merge': 'merge — join',
      'op.concat': 'concat — append',
      'op.groupby': 'groupby — aggregate',
      'op.pivot': 'pivot table',
      'op.valuecounts': 'value_counts',
      'op.corr': 'corr — correlation',
      'op.resample': 'resample — resample time series',
      'op.rolling': 'rolling — moving average',
      'op.pctchange': 'pct_change — percent change',
      'op.hist': 'Histogram',
      'op.bar': 'Bar chart',
      'op.pie': 'Pie / Donut chart',
      'f.catCol': 'Category column',
      'f.sizeCol': 'Value column (optional)',
      'f.pieCount': 'Count (default)',
      'f.pieStyle': 'Chart style',
      'f.pie': 'Pie',
      'f.donut': 'Donut',
      'f.pieOther': 'Others',
      'op.line': 'Line chart',
      'op.scatter': 'Scatter plot',
      'op.box': 'Box plot',
      'op.heatmap': 'Correlation heatmap',
      'op.linreg': 'Linear regression',
      'op.kmeans': 'K-Means clustering',
      'op.logreg': 'Logistic regression (binary)',
      'op.polyreg': 'Polynomial regression',
      'op.knn': 'K-Nearest Neighbors',
      'op.dtree': 'Decision tree',
      'op.pca': 'PCA',
      'opg.ml': 'Machine Learning',
      'f.target': 'Target column (exactly 2 values)',
      'f.k': 'Clusters k',
      'f.feat1': 'Feature 1 (X)',
      'f.feat2': 'Feature 2 (Y)',
      'f.degree': 'Polynomial degree',
      'f.degQuad': 'quadratic',
      'f.degCubic': 'cubic',
      'f.neighbors': 'Neighbors k',
      'f.maxDepth': 'Max tree depth',
      'f.dateCol': 'Date column',
      'f.rule': 'Frequency',
      'f.ruleD': 'Daily (D)',
      'f.ruleW': 'Weekly (W)',
      'f.ruleM': 'Monthly (M)',
      'f.window': 'Window size',
      'f.features': 'Numeric columns to reduce (at least 2)',
      'res.equation': 'Fitted equation',
      'res.r2': 'R-squared',
      'res.n': 'Valid samples',
      'res.accuracy': 'Training accuracy',
      'res.centers': 'Cluster centers (original scale)',
      'res.counts': 'Cluster size',
      'res.weights': 'Weights (standardized)',
      'res.mapInfo': 'Target mapping',
      'res.iterations': 'Iterations',
      'res.degree': 'Degree',
      'res.polyEq': 'Fitted equation (standardized space)',
      'res.zstd': 'z = ({x} − {mean}) / {std}',
      'res.depth': 'Tree depth',
      'res.leaves': 'Leaves',
      'res.importance': 'Feature importance',
      'res.rules': 'Leaf rules (up to 8 shown)',
      'res.when': 'Conditions (all must hold)',
      'res.predict': 'Predicted class',
      'res.purity': 'Class purity',
      'res.pc': 'Component',
      'res.eigvalue': 'Eigenvalue λ',
      'res.variance': 'Variance explained',
      'res.cum': 'Cumulative',
      'res.loadings': 'Loadings (PC1 / PC2)',
      'res.r2Train': 'Train R²',
      'res.r2Test': 'Test R²',
      'res.accTrain': 'Train accuracy',
      'res.accTest': 'Test accuracy',
      'res.split': 'Train/test samples',
      'res.confusion': 'Confusion matrix (test set)',
      'res.actualLabel': 'Actual',
      'res.predLabel': 'Predicted',
      'res.newCol': 'New column added: {col}',
      'lg.train': 'Train',
      'lg.test': 'Test',
      'msg.needBinary': 'The target column must have exactly two distinct values (e.g. returned / channel)',
      'msg.needDateCol': 'A datetime column is required: first convert a column via Select → Change dtype',
      'msg.need2cols': 'Please tick at least 2 numeric columns',

      /* ---------- chart insights ---------- */
      'ins.title': 'Chart insights',
      'ins.pd.role': '{text}; the matching code has been synced to the pandas code panel on the right.',
      'ins.pd.hist': "pandas' role: binning and counting are done by pd.cut + value_counts; mean and quantiles come from df[col].describe()",
      'ins.pd.bar': "pandas' role: the data is aggregated and sorted by groupby(…).agg(); the chart is only a rendering of that result",
      'ins.pd.line': "pandas' role: every point on the curve is first aggregated by groupby(…).sum() or pivot_table(…)",
      'ins.pd.scatter': "pandas' role: column selection, null dropping and sampling are done by pandas; correlation strength can be quantified with df[[x,y]].corr()",
      'ins.pd.box': "pandas' role: per-group medians and quartiles come from groupby(…).describe()",
      'ins.pd.heatmap': "pandas' role: the whole correlation matrix is produced in one step by df.corr(numeric_only=True)",
      'ins.pie.top': 'The largest slice "{cat}" accounts for {pct}%.',
      'ins.pd.pie': "pandas' role: slice sizes are computed first by value_counts() or groupby(…).sum(); plot(kind='pie') only splits the circle by share",
      'ins.pd.valuecounts': "pandas' role: value_counts() groups, counts and sorts in one call; the donut below is that frequency table drawn",
      'ins.pd.resample': "pandas' role: pd.to_datetime + set_index + resample(…).agg() is the classic time-series aggregation trio",
      'ins.pd.rolling': "pandas' role: df[col].rolling(w).mean() does sliding-window statistics in one line; windows shorter than w stay blank automatically",
      'ins.pd.pctchange': "pandas' role: df[col].pct_change() computes period-over-period change in one step, equal to df[col] / df[col].shift(1) - 1",
      'ins.pd.linreg': "pandas' role: prepare the data with df[[x,y]].dropna(), split train/test with train_test_split, then hand the feature matrix df[[x]] to sklearn",
      'ins.pd.kmeans': "pandas' role: pick features with df[[f1,f2]]; you would normally describe() first to check scales (this page standardizes automatically)",
      'ins.pd.logreg': "pandas' role: the target column is often built from a conditional expression, e.g. (df[\"discount\"]>0.15).astype(int); check class balance with value_counts() before and after train_test_split",
      'ins.pd.missingmap': "pandas' role: df.isna().sum() gives per-column missing counts in one line — visualize it and decide whether to drop a column or fill it",
      'ins.missingmap.worst': 'Most missing: “{col}” ({n} cells, {pct}%) — columns with a very high missing rate suit dropna, scattered gaps suit fillna instead.',
      'ins.hist.shape': '{n} valid values: mean {mean}, median {median}, std {std}.',
      'ins.hist.skewPos': 'Mean is above the median — the distribution is right-skewed: a few large values pull the mean up.',
      'ins.hist.skewNeg': 'Mean is below the median — the distribution is left-skewed: a few small values pull the mean down.',
      'ins.hist.skewNone': 'Mean is close to the median — the distribution is roughly symmetric.',
      'ins.hist.outlier': 'About {n} values fall outside 1.5×IQR (below {lo} or above {hi}); use Clean → filter to remove them if needed.',
      'ins.hist.noOutlier': 'No obvious outliers under the 1.5×IQR rule.',
      'ins.bar.top': 'The top item "{cat}" = {val}, about {pct}% of the total.',
      'ins.bar.top3': 'The top 3 items together account for {pct}% (of {n} items).',
      'ins.line.trend': 'From first to last: {first} → {last}, {dir} by {pct}%.',
      'ins.line.up': 'up',
      'ins.line.down': 'down',
      'ins.line.trendFlat': 'From first to last: {first} → {last}, roughly flat overall ({pct}% change).',
      'ins.line.peak': 'The peak occurs at {x}: {v}.',
      'ins.scatter.corr': 'Correlation r = {r}: {x} and {y} show a {a} {b} linear relationship.',
      'ins.scatter.corrNone': 'Correlation r = {r}: {x} and {y} show almost no linear relationship.',
      'ins.scatter.strong': 'strong',
      'ins.scatter.mid': 'moderate',
      'ins.scatter.weak': 'weak',
      'ins.scatter.pos': 'positive',
      'ins.scatter.neg': 'negative',
      'ins.scatter.sampled': 'Many rows — sampled {n} rows for plotting (df.sample({n})).',
      'ins.box.med': 'The highest median is "{g}" ({v}); the lowest is "{g2}" ({v2}).',
      'ins.box.spread': '"{g}" has the widest box (IQR ≈ {v}) — the largest within-group spread.',
      'ins.heatmap.pos': 'Strongest positive correlation: {a} ↔ {b} (r = {r}).',
      'ins.heatmap.neg': 'Strongest negative correlation: {a} ↔ {b} (r = {r}).',
      'ins.heatmap.none': 'All numeric columns are only weakly correlated (|r| < 0.2).',
      'ins.resample.n': '{n} "{rule}" buckets in total, mean {mean}.',
      'ins.rolling.win': 'New column {col} is the {w}-period moving average of {src}: it smooths short-term noise to reveal the long-term trend.',
      'ins.pctchange.dir': 'In new column {col}, {up} periods rose and {down} periods fell versus the previous period.',
      'ins.pctchange.base': 'Percent change = current ÷ previous − 1; blank for the first row or when the previous value is 0 / missing.',
      'ins.split.r2': 'A random 30% hold-out: train R² = {tr}, test R² = {te} — the test score better reflects generalization; a large gap hints at overfitting.',
      'ins.split.acc': 'Train accuracy {tr}%, test accuracy {te}% — the test score better reflects generalization; a large gap hints at overfitting.',
      'ins.linreg.slope': 'Slope ≈ {slope}: for each extra unit of {x}, {y} changes by {slope} on average.',
      'ins.linreg.r2good': 'R² = {r2}: {x} explains about {pct}% of the variance of {y} — a good linear fit.',
      'ins.linreg.r2mid': 'R² = {r2}: {x} explains about {pct}% of the variance of {y} — a moderate relationship; other factors may matter.',
      'ins.linreg.r2bad': 'R² = {r2}: {x} barely explains {y} (only {pct}%) — very weak linear relationship; try another feature pair or clean the data first.',
      'ins.kmeans.sizes': 'Cluster sizes: {sizes} ({balance}).',
      'ins.kmeans.balanced': 'fairly balanced',
      'ins.kmeans.uneven': 'quite uneven',
      'ins.kmeans.center': 'C{i} has the highest "{f}" (center ≈ {v}) — read it as the "high-{f}" group.',
      'ins.kmeans.iter': 'Converged after {n} iterations.',
      'ins.logreg.acc': 'Training accuracy {pct}%; the majority-class baseline is {base}% — the model {cmp}.',
      'ins.logreg.better': 'clearly beats the baseline',
      'ins.logreg.close': 'barely beats the baseline — consider other features',
      'ins.logreg.w': 'Standardized weights: {f1} = {w1}, {f2} = {w2}. Larger |w| means stronger influence; a positive weight pushes samples towards "{cls}".',
      'ins.logreg.grid': 'The background grid is the model\'s prediction map: each cell is the predicted class for that feature pair, and the color boundary is the decision boundary.',
      'ins.pd.polyreg': "pandas' role: polynomial features are built with assign — z=(x−μ)/σ, z²=z**2; after train_test_split, sklearn fits the model",
      'ins.pd.knn': "pandas' role: pick features with df[[f1,f2]], check class balance with groupby(target); after train_test_split, standardizing as (df[cols]-mean)/std makes distances fair",
      'ins.pd.dtree': "pandas' role: every tree rule can be verified with boolean indexing, e.g. df[(df.discount<=0.18)&(df.quantity<=7)][\"returned\"].mean(); building the tree after train_test_split is more objective",
      'ins.pd.pca': "pandas' role: standardization is one line, (df[num]-df[num].mean())/df[num].std(); PCA scores come back as a pd.DataFrame on the same index",
      'ins.poly.vertexMin': 'The parabola bottoms out at {x} (predicted value ≈ {y}): y rises on both sides of this minimum.',
      'ins.poly.vertexMax': 'The parabola peaks at {x} (predicted value ≈ {y}): y falls on both sides of this maximum.',
      'ins.poly.deg3': 'A cubic term is more flexible (two bends) but overfits more easily in sparse regions — watch for wild swings at either end of the curve.',
      'ins.knn.k': 'k = {k}: every point is classified by a vote of its {k} nearest neighbors; small k gives a wiggly boundary (overfitting), large k a smoother one (underfitting).',
      'ins.dtree.size': 'Tree depth {d}, {leaves} leaves: {leaves} if-else threshold rules cover every prediction.',
      'ins.dtree.imp': 'The most important split feature is "{f}" ({pct}% importance): the tree mostly separates classes with it.',
      'ins.dtree.boundary': 'The boundary is axis-aligned: every edge maps to a readable threshold rule (see the result table) — this is why decision trees are interpretable.',
      'ins.pca.pc1': 'PC1 explains {pct}% of total variance; its largest loading is "{f}" ({v}): PC1 mainly represents that direction.',
      'ins.pca.pc2': 'PC2 explains another {pct}%, driven mainly by the "{f}" ({v}) direction.',
      'ins.pca.cum': 'The first two components keep {pct}% of the information: {d} numeric columns compressed to 2 dimensions for plotting.',
      'ins.pca.biplot': 'Red arrows are feature loadings: same direction = positive correlation, opposite = negative, ~90° angle ≈ uncorrelated; longer arrows contribute more to that component.',

      'f.column': 'Column',
      'f.columns': 'Columns (multi-select)',
      'f.n': 'Rows n',
      'f.newname': 'New name',
      'f.newcol': 'New column name',
      'f.type': 'Target dtype',
      'f.value': 'Value',
      'f.value2': 'Second value',
      'f.method': 'Method',
      'f.expr': 'Expression',
      'f.exprHint': 'e.g. quantity * unit_price * (1 - discount); columns, + - * / %, comparisons and functions like round/abs/sqrt/log/upper/lower/len/year/month/day are available.',
      'f.exprError': 'Cannot parse expression:',
      'f.cond': 'Conditions',
      'f.addCond': '+ Add condition',
      'f.logic': 'Combine with',
      'f.and': 'AND',
      'f.or': 'OR',
      'f.sortBy': 'Sort by',
      'f.addSort': '+ Add sort key',
      'f.asc': 'Ascending',
      'f.desc': 'Descending',
      'f.subset': 'Subset (default: all)',
      'f.how': 'Rule',
      'f.howAny': 'Drop if any missing (any)',
      'f.howAll': 'Drop only if all missing (all)',
      'f.keys': 'Group keys',
      'f.aggs': 'Aggregations',
      'f.addAgg': '+ Add aggregation',
      'f.func': 'Function',
      'f.aggcol': 'Column',
      'f.index': 'Rows (index)',
      'f.pivotCols': 'Columns',
      'f.values': 'Values',
      'f.aggfunc': 'Aggregation',
      'f.on': 'Key (this table)',
      'f.onOther': 'Key (other table)',
      'f.howJoin': 'Join type',
      'f.other': 'Other dataset',
      'f.bins': 'Bins',
      'f.x': 'X axis',
      'f.y': 'Y axis',
      'f.group': 'Color by (optional)',
      'f.groupByCat': 'Group column',
      'f.series': 'Series column (optional)',
      'f.chartTitle': 'Title (optional)',

      'fop.eq': 'equals ==', 'fop.ne': 'not equals !=', 'fop.gt': 'greater than >', 'fop.ge': 'at least >=',
      'fop.lt': 'less than <', 'fop.le': 'at most <=', 'fop.between': 'between',
      'fop.contains': 'contains', 'fop.notcontains': 'does not contain',
      'fop.startswith': 'starts with', 'fop.endswith': 'ends with',
      'fop.in': 'in list (comma-separated)', 'fop.isnull': 'is null', 'fop.notnull': 'not null',

      'fill.value': 'Fixed value', 'fill.mean': 'Mean', 'fill.median': 'Median',
      'fill.mode': 'Mode', 'fill.ffill': 'Forward fill', 'fill.bfill': 'Backward fill',
      'join.inner': 'Inner join', 'join.left': 'Left join', 'join.right': 'Right join', 'join.outer': 'Outer join',
      'type.number': 'Number', 'type.string': 'Text', 'type.datetime': 'Datetime', 'type.boolean': 'Boolean',

      'stat.missing': '{n} missing cells',
      'stat.none': 'No missing values',
      'stat.mem': '~{n} KB',
      'act.undo': 'Undo',
      'act.redo': 'Redo',
      'act.reset': 'Reset to original',
      'act.export': 'Export CSV',
      'act.code': 'pandas code',
      'act.apply': 'Apply',
      'act.cancel': 'Cancel',
      'act.close': 'Close',
      'act.copy': 'Copy code',
      'act.copied': 'Copied to clipboard',
      'act.help': 'Help',
      'act.exportSvg': 'Export SVG',
      'act.exportPng': 'Export PNG',

      'tbl.prev': 'Prev',
      'tbl.next': 'Next',
      'tbl.page': 'Page {p} / {n}',
      'tbl.pageSize': 'Per page',
      'tbl.rows': 'rows',
      'tbl.empty': 'The current result is empty (0 rows).',
      'tbl.sortHint': 'Click a header to sort by that column (recorded in history)',

      /* ---------- Table filter bar ---------- */
      'tf.search': 'Search…',
      'tf.all': 'All',
      'tf.apply': 'Filter',
      'tf.clear': 'Clear',
      'tf.noMatch': 'No rows match the current filter.',

      'hist.title': 'History',
      'hist.empty': 'No operations yet. Pick any function on the left to start.',
      'hist.original': 'Original data',
      'code.title': 'Equivalent pandas code',
      'code.hint': 'Every operation appends its code here — copy it into Python to reproduce the analysis.',
      'code.header': 'import pandas as pd',

      'res.title': 'Result',
      'res.info': 'Structure',
      'res.describe': 'Statistics',
      'res.count': 'Count',
      'res.pct': 'Percent %',
      'res.col.name': 'Column', 'res.col.dtype': 'Dtype', 'res.col.nonNull': 'Non-null',
      'res.col.nulls': 'Missing', 'res.col.unique': 'Unique',
      'res.stat': 'Statistic',
      'res.summary.num': '{n} numeric columns',
      'res.missCol': 'Column', 'res.missCnt': 'Missing', 'res.missRate': 'Missing %',
      'res.charts': 'Chart',

      'msg.loaded': 'Dataset {name} loaded: {rows} rows × {cols} cols',
      'msg.loadFail': 'Load failed: {err}',
      'msg.applied': 'Applied: {op}',
      'msg.undone': 'Undone one step',
      'msg.redone': 'Redone one step',
      'msg.resetDone': 'Back to the original data',
      'msg.opFail': 'Operation failed: {err}',
      'msg.noNumCol': 'No numeric columns available',
      'msg.noMissing': 'No missing values in this dataset',
      'msg.needOther': 'merge / concat needs at least two datasets — upload or paste another one.',
      'msg.switched': 'Switched to dataset {name}',
      'msg.exported': 'Exported {name}',
      'msg.nothing': 'Nothing to undo',
      'msg.nothingRedo': 'Nothing to redo',

      'help.title': 'User Guide',
      'help.body': '<p><b>What this is:</b> a pure front-end “visual pandas”. Pick data and operations on the left, see the table and charts in the middle, and get ready-to-copy pandas code on the right.</p>' +
        '<p><b>Three steps:</b> ① the <code>sales</code> dataset is loaded by default — click any operation on the left; ② configure columns and parameters in the dialog, then “Apply”; ③ undo or reset anytime, or copy the generated code into your local Python to reproduce.</p>' +
        '<p><b>Your own data:</b> upload a CSV / JSON file, paste CSV text, or fetch from a URL; dtypes (number / datetime / boolean / text) are inferred automatically.</p>' +
        '<p><b>Built-in datasets:</b> <code>sales</code> order details (default), <code>products</code> product dimension (merge demo), <code>tips</code> restaurant bills, <code>iris</code> flowers, <code>titanic</code> passengers and <code>weather</code> daily readings; upload a second file to join or append with a built-in table.</p>' +
        '<p><b>Time series:</b> the Time Series group offers resample (aggregate by day / week / month), rolling moving average and pct_change; convert a column to datetime first, then pair them with a line chart to watch long-term trends and short-term wiggles.</p>' +
        '<p><b>Charts:</b> histogram, bar, pie/donut, line, scatter, box and correlation heatmap — the pie/donut is the natural partner of value_counts (Aggregate → value_counts auto-draws a donut); hovering any shape highlights its series and fades the rest, the line chart has a crosshair that reads every series at that point at once, and hovering the legend at the bottom highlights the matching series too; export as SVG / PNG.</p>' +
        '<p><b>Machine learning:</b> seven classic algorithms — regression: linear regression and polynomial regression (fitted curve + vertex), with train / test points drawn apart in the scatter; classification: logistic regression, K-nearest neighbors and decision trees (decision boundary + readable rules); clustering: K-Means (colored clusters + centroids); dimensionality reduction: PCA (variance explained + loading arrows). Supervised algorithms split the data roughly 70/30 into train/test automatically, report both sets of metrics, and classifiers also show a confusion matrix on the test set. The code panel shows the matching sklearn code.</p>' +
        '<p><b>Data insights:</b> every chart carries an interpretation box summarizing the key takeaways; Inspect → Missing map lists each column’s missing count and rate, telling you straight whether to dropna a column or fillna the gaps.</p>' +
        '<p><b>Table filters:</b> above every table sits a filter bar — one searchable multi-select dropdown per column (tick the values you want to keep; several columns can be combined and intersect). Press “Filter” to keep the matching rows and “Clear” to restore everything; filtering only affects the view and never changes the data.</p>',

      'skip': 'Skip to content',
      'footer.line1': '© 2026 · Pandas功能可视化平台 · Data stays in your browser',
      'footer.line2': 'Built-in data is generated with a fixed seed for demo; uploaded data never leaves your device.'
    }
  };

  /* ---------------- 引擎(与全站共享版同一套约定) ---------------- */

  var html = document.documentElement;
  var lang = 'zh';
  var listeners = [];

  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 隐私模式忽略 */ } }
  function recall() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  (function init() {
    var forced = '';
    try { forced = new URLSearchParams(location.search).get('lang') || ''; } catch (e) { /* 老浏览器 */ }
    if (forced === 'zh' || forced === 'en') { lang = forced; store(forced); return; }
    var saved = recall();
    if (saved === 'zh' || saved === 'en') { lang = saved; return; }
    var nav = (navigator.language || navigator.userLanguage || 'zh').toLowerCase();
    lang = nav.indexOf('zh') === 0 ? 'zh' : (nav.indexOf('en') === 0 ? 'en' : 'zh');
  }());

  function t(key, vars) {
    var table = DICT[lang] || DICT.zh;
    var s = table[key] != null ? table[key] : (DICT.zh[key] != null ? DICT.zh[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return s;
  }

  function pick(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string' || typeof obj === 'number') return String(obj);
    return obj[lang] != null ? String(obj[lang]) : (obj.zh != null ? String(obj.zh) : '');
  }

  function applyStatic() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-i18n');
      var txt = t(k);
      if (nodes[i].getAttribute('data-i18n-html') === 'true') nodes[i].innerHTML = txt;
      else nodes[i].textContent = txt;
    }
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var spec = attrNodes[j].getAttribute('data-i18n-attr').split(',');
      for (var s = 0; s < spec.length; s++) {
        var pair = spec[s].split(':');
        if (pair.length === 2) attrNodes[j].setAttribute(pair[0].trim(), t(pair[1].trim()));
      }
    }
  }

  function applyMeta() {
    document.title = t('doc.title');
    var metas = document.querySelectorAll('meta[data-meta]');
    for (var i = 0; i < metas.length; i++) {
      metas[i].setAttribute('content', t(metas[i].getAttribute('data-meta') === 'title' ? 'doc.title' : 'doc.desc'));
    }
  }

  function syncSwitch() {
    var items = document.querySelectorAll('.lang-switch-item');
    for (var i = 0; i < items.length; i++) {
      var isCur = items[i].getAttribute('data-lang') === lang;
      items[i].classList.toggle('is-active', isCur);
      items[i].setAttribute('aria-pressed', isCur ? 'true' : 'false');
    }
  }

  function setLang(next, silent) {
    if (next !== 'zh' && next !== 'en') return;
    var changed = next !== lang;
    lang = next;
    store(lang);
    html.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    applyStatic();
    applyMeta();
    syncSwitch();
    if (changed && !silent) {
      for (var i = 0; i < listeners.length; i++) listeners[i](lang);
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
    }
  }

  function bind() {
    var items = document.querySelectorAll('.lang-switch-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        setLang(this.getAttribute('data-lang'));
      });
    }
    syncSwitch();
  }

  window.I18N = {
    get lang() { return lang; },
    t: t,
    pick: pick,
    setLang: setLang,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };

  html.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');

  function boot() { applyStatic(); applyMeta(); bind(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
