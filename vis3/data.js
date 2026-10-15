/* =========================================================
 * data.js —— 内置默认数据集(vis3)
 * ---------------------------------------------------------
 * 打开页面即有一份可分析的数据,无需先上传:
 *   sales    电商订单明细(约 240 行 × 14 列,含日期 / 类别 / 数值,
 *            故意掺入缺失值与重复行,方便演示 dropna / fillna / 去重)
 *   products 产品维表(16 行,配合 sales 演示 merge 连接)
 *   tips     餐厅账单与小费(180 行,groupby / 相关性的 EDA 经典集)
 *   iris     鸢尾花形态(150 行,分类 / 聚类 / PCA 的经典集)
 *   titanic  泰坦尼克乘客(220 行,二分类经典集,含缺失的 age)
 *   weather  两座城市的气象日序列(360 行,折线 / 时间序列演示)
 * 数据由固定种子的伪随机数生成:每次打开完全一致,可复现、可分享。
 * ========================================================= */
(function () {
  'use strict';

  /* mulberry32:定长种子 → 确定性伪随机序列 */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Box-Muller:均匀随机 → 标准正态 */
  function gauss(rand) {
    var u = rand();
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }

  /* 按权重抽取一项 */
  function pickWeighted(rand, arr, weights) {
    var r = rand(), acc = 0;
    for (var i = 0; i < arr.length; i++) {
      acc += weights[i];
      if (r < acc) return arr[i];
    }
    return arr[arr.length - 1];
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function buildSales() {
    var rand = rng(20261013);
    var regions = ['East', 'South', 'North', 'West'];
    var categories = ['Electronics', 'Furniture', 'Apparel', 'Food'];
    var products = {
      Electronics: ['Laptop', 'Tablet', 'Headphones', 'Smartwatch'],
      Furniture: ['Desk', 'Chair', 'Bookshelf', 'Lamp'],
      Apparel: ['Jacket', 'Sneakers', 'Backpack', 'Cap'],
      Food: ['Coffee', 'Tea', 'Chocolate', 'Nuts']
    };
    var basePrice = {
      Laptop: 899, Tablet: 459, Headphones: 129, Smartwatch: 249,
      Desk: 329, Chair: 189, Bookshelf: 119, Lamp: 59,
      Jacket: 139, Sneakers: 99, Backpack: 69, Cap: 25,
      Coffee: 18, Tea: 12, Chocolate: 9, Nuts: 14
    };
    var channels = ['Online', 'Store'];
    var ctypes = ['Member', 'Guest'];

    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    var rows = [];
    var id = 10001;
    for (var i = 0; i < 240; i++) {
      var cat = pick(categories);
      var prod = pick(products[cat]);
      var month = Math.floor(rand() * 12);            /* 2025 全年均匀分布 */
      var day = 1 + Math.floor(rand() * 28);
      var date = new Date(2025, month, day);
      var qty = 1 + Math.floor(rand() * 8);
      var price = basePrice[prod] * (0.9 + rand() * 0.2);
      var discount = rand() < 0.35 ? Math.round(rand() * 40) / 100 : 0;
      var revenue = Math.round(qty * price * (1 - discount) * 100) / 100;
      var rating = rand() < 0.08 ? null : Math.round((3 + rand() * 2) * 10) / 10;   /* ~8% 缺失 */
      var delivery = rand() < 0.05 ? null : 1 + Math.floor(rand() * 9);            /* ~5% 缺失 */
      /* 退货与高折扣强相关:让逻辑回归能学到一条看得见的决策边界 */
      var returned = rand() < (discount > 0.15 ? 0.6 : 0.03);
      rows.push([
        id++, date, pick(regions), cat, prod, pick(channels), pick(ctypes),
        qty, Math.round(price * 100) / 100, discount, revenue, rating, delivery, returned
      ]);
    }
    /* 3 条完全重复:演示 drop_duplicates */
    rows.push(rows[3].slice(), rows[10].slice(), rows[42].slice());

    var df = MiniPD.create(
      ['order_id', 'order_date', 'region', 'category', 'product', 'channel',
       'customer_type', 'quantity', 'unit_price', 'discount', 'revenue',
       'rating', 'delivery_days', 'returned'],
      rows, 'sales');
    /* create() 会把日期列推成 datetime,这里显式兜底,防止口径漂移 */
    df.dtypes.order_date = 'datetime';
    df.dtypes.returned = 'boolean';
    return df;
  }

  function buildProducts() {
    var rows = [
      ['Laptop', 'Electronics', 620, 'ApexTech'],
      ['Tablet', 'Electronics', 300, 'ApexTech'],
      ['Headphones', 'Electronics', 55, 'SoundWave'],
      ['Smartwatch', 'Electronics', 140, 'SoundWave'],
      ['Desk', 'Furniture', 210, 'WoodWorks'],
      ['Chair', 'Furniture', 95, 'WoodWorks'],
      ['Bookshelf', 'Furniture', 60, 'WoodWorks'],
      ['Lamp', 'Furniture', 22, 'BrightHome'],
      ['Jacket', 'Apparel', 70, 'UrbanWear'],
      ['Sneakers', 'Apparel', 48, 'UrbanWear'],
      ['Backpack', 'Apparel', 30, 'UrbanWear'],
      ['Cap', 'Apparel', 9, 'UrbanWear'],
      ['Coffee', 'Food', 8, 'DailyFresh'],
      ['Tea', 'Food', 5, 'DailyFresh'],
      ['Chocolate', 'Food', 4, 'DailyFresh'],
      ['Nuts', 'Food', 6, 'DailyFresh']
    ];
    return MiniPD.create(['product', 'category', 'cost', 'supplier'], rows, 'products');
  }

  /* tips:餐厅账单与小费——groupby 聚合、箱线图与相关性的经典 EDA 数据集 */
  function buildTips() {
    var rand = rng(20260215);
    var days = ['Thur', 'Fri', 'Sat', 'Sun'];
    var dayW = [0.24, 0.10, 0.37, 0.29];
    var sexes = ['Male', 'Female'];
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    var rows = [];
    for (var i = 0; i < 180; i++) {
      var day = pickWeighted(rand, days, dayW);
      var meal = (day === 'Thur' || day === 'Fri') ? (rand() < 0.7 ? 'Lunch' : 'Dinner')
                                                   : (rand() < 0.12 ? 'Lunch' : 'Dinner');
      var size = rand() < 0.12 ? 6 : 1 + Math.floor(rand() * 5);
      var total = Math.round((size * (9 + rand() * 7) + rand() * 6) * 100) / 100;
      /* 晚餐小费率略高于午餐,再加一点随机波动 */
      var rate = (meal === 'Dinner' ? 0.175 : 0.145) + (rand() - 0.5) * 0.07;
      if (rand() < 0.06) rate += 0.1;
      var tip = Math.round(total * clamp(rate, 0.03, 0.35) * 100) / 100;
      rows.push([i + 1, day, meal, pick(sexes), rand() < 0.38 ? 'Yes' : 'No', size, total, tip]);
    }
    /* 少量缺失:演示 dropna / fillna 的口径 */
    rows[17][7] = null;
    rows[63][7] = null;
    rows[121][6] = null;

    return MiniPD.create(
      ['bill_id', 'day', 'meal', 'sex', 'smoker', 'party_size', 'total_bill', 'tip'],
      rows, 'tips');
  }

  /* iris:鸢尾花形态——分类 / 聚类 / PCA 的经典数据集 */
  function buildIris() {
    var rand = rng(20260216);
    /* 每种花:名称 + 花萼长/宽、花瓣长/宽的均值与标准差 */
    var specs = [
      ['setosa',     5.006, 0.352, 3.418, 0.381, 1.464, 0.174, 0.244, 0.107],
      ['versicolor', 5.936, 0.516, 2.770, 0.314, 4.260, 0.470, 1.326, 0.198],
      ['virginica',  6.588, 0.636, 2.974, 0.322, 5.552, 0.552, 2.026, 0.275]
    ];
    var rows = [];
    var id = 1;
    specs.forEach(function (s) {
      for (var i = 0; i < 50; i++) {
        rows.push([
          id++, s[0],
          Math.round(clamp(s[1] + gauss(rand) * s[2], 0.5, 12) * 10) / 10,
          Math.round(clamp(s[3] + gauss(rand) * s[4], 0.3, 8) * 10) / 10,
          Math.round(clamp(s[5] + gauss(rand) * s[6], 0.2, 12) * 10) / 10,
          Math.round(clamp(s[7] + gauss(rand) * s[8], 0.05, 6) * 10) / 10
        ]);
      }
    });
    return MiniPD.create(
      ['iris_id', 'species', 'sepal_length', 'sepal_width', 'petal_length', 'petal_width'],
      rows, 'iris');
  }

  /* titanic:泰坦尼克乘客——二分类经典数据集,age 有缺失 */
  function buildTitanic() {
    var rand = rng(20260217);
    var rows = [];
    for (var i = 0; i < 220; i++) {
      var pclass = pickWeighted(rand, [1, 2, 3], [0.24, 0.21, 0.55]);
      var sex = rand() < 0.36 ? 'female' : 'male';
      var age = Math.round(clamp(26 + gauss(rand) * 14, 1, 78) * 10) / 10;
      var sibsp = rand() < 0.55 ? 0 : 1 + Math.floor(rand() * 3);
      var parch = rand() < 0.72 ? 0 : 1 + Math.floor(rand() * 2);
      var fare = pclass === 1 ? 60 + rand() * 140
               : pclass === 2 ? 15 + rand() * 25
                              : 5 + rand() * 12;
      fare = Math.round(fare * 100) / 100;
      var embarked = pickWeighted(rand, ['S', 'C', 'Q'], [0.70, 0.20, 0.10]);
      /* 存活概率:票价越高、越年轻、女性 → 越可能获救(让分类边界可见) */
      var logit = -2.2 + 0.022 * fare - 0.025 * (age - 26) + (sex === 'female' ? 1.7 : 0);
      var survived = rand() < 1 / (1 + Math.exp(-logit)) ? 1 : 0;
      if (rand() < 0.16) age = null;      /* 缺失年龄,演示 fillna */
      rows.push([i + 1, pclass, sex, age, sibsp, parch, fare, embarked, survived]);
    }
    return MiniPD.create(
      ['passenger_id', 'pclass', 'sex', 'age', 'sibsp', 'parch', 'fare', 'embarked', 'survived'],
      rows, 'titanic');
  }

  /* weather:两座城市的气象日序列(1/1 起 180 天)——折线 / 时间序列演示 */
  function buildWeather() {
    var rand = rng(20260218);
    var cities = [
      { name: 'Beijing', base: 13, amp: 12, humidity: 52, rain: 1.6, wind: 18 },
      { name: 'Shanghai', base: 17, amp: 9, humidity: 74, rain: 2.8, wind: 14 }
    ];
    var rows = [];
    var id = 1;
    for (var d = 0; d < 180; d++) {
      var date = new Date(2025, 0, 1 + d);
      var m = date.getMonth() + 1;
      var month = '2025-' + (m < 10 ? '0' : '') + m;
      /* 1/1 取 -1(冬),入夏升到 +1 */
      var season = Math.sin(d / 365 * 2 * Math.PI - Math.PI / 2);
      cities.forEach(function (c) {
        var temp = Math.round((c.base + c.amp * season + gauss(rand) * 2.4) * 10) / 10;
        var hum = Math.round(clamp(c.humidity - 8 * season + gauss(rand) * 12, 20, 99));
        var rain = rand() < 0.65 ? 0 : Math.round(rand() * c.rain * 8 * 10) / 10;
        var wind = Math.round(clamp(c.wind + gauss(rand) * 5, 2, 45));
        rows.push([id++, date, month, c.name, temp, hum, rain, wind]);
      });
    }
    /* 少量湿度缺失 */
    rows[33][5] = null;
    rows[150][5] = null;
    rows[260][5] = null;
    return MiniPD.create(
      ['rec_id', 'date', 'month', 'city', 'temp_c', 'humidity', 'rainfall_mm', 'wind_kmh'],
      rows, 'weather');
  }

  window.VIS3_DATA = {
    /* 注册表:数据源面板按这里列出的条目渲染「内置数据」分组 */
    builtin: [
      { key: 'sales', make: buildSales },
      { key: 'products', make: buildProducts },
      { key: 'tips', make: buildTips },
      { key: 'iris', make: buildIris },
      { key: 'titanic', make: buildTitanic },
      { key: 'weather', make: buildWeather }
    ],
    defaultKey: 'sales'
  };
}());
