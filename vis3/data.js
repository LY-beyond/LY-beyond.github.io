/* =========================================================
 * data.js —— 内置示例数据集（默认数据 + 一键切换）
 * ---------------------------------------------------------
 * 设计约定：
 *   ① 列名统一用英文标识符（revenue / units …），这样「生成的
 *      pandas 代码」可以直接复制去跑；界面文案才是中英双语，
 *      所以两种语言看到的是同一份数据、同一段代码。
 *   ② 数据全部在前端确定性生成（固定随机种子），不联网、
 *      体积小、可复现；「国家指标」表为手写，便于讲解与校验。
 *   ③ 用 TSV / CSV 字符串承载，交给 PD.readCSV 解析 —— 顺带演示读取器。
 * ========================================================= */
window.PD_DATA = (function () {
  'use strict';

  /* 确定性伪随机（mulberry32）：同一 seed 永远得到同一份数据 */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function rint(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function rfix(r, a, b, d) { var v = a + r() * (b - a); var p = Math.pow(10, d); return Math.round(v * p) / p; }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 把「表头 + 行」拼成 TSV（列名无空格，保证分隔符嗅探稳定） */
  function tsv(header, rows) {
    return [header.join('\t')].concat(rows.map(function (r) { return r.join('\t'); })).join('\n');
  }

  /* ---------------- ① 销售流水（默认数据） ---------------- */
  function sales() {
    var r = rng(20240101);
    var regions = ['East', 'North', 'South', 'Southwest', 'Northeast'];
    var cats = ['Digital', 'Home', 'Apparel', 'Grocery', 'Beauty'];
    var channels = ['Online', 'Store', 'Partner'];
    var price = { Digital: 820, Home: 260, Apparel: 180, Grocery: 45, Beauty: 130 };
    var margin = { Digital: 0.86, Home: 0.74, Apparel: 0.68, Grocery: 0.62, Beauty: 0.71 };
    var rows = [];
    for (var i = 0; i < 320; i++) {
      var cat = pick(r, cats);
      var month = rint(r, 1, 12);
      var day = rint(r, 1, 28);
      var units = rint(r, 1, cat === 'Grocery' ? 60 : 24);
      var disc = rfix(r, 0, 0.3, 2);
      var up = Math.round(price[cat] * (0.85 + r() * 0.35));
      var revenue = Math.round(units * up * (1 - disc) * 100) / 100;
      var cost = Math.round(revenue * (margin[cat] * (0.93 + r() * 0.14)) * 100) / 100;
      var rating = r() < 0.06 ? '' : rfix(r, 3.0, 5.0, 1);   /* 约 6% 缺失，演示 fillna */
      rows.push([
        'SO-' + (1001 + i),
        '2024-' + pad(month) + '-' + pad(day),
        pick(r, regions), cat, pick(r, channels),
        units, up, disc, revenue, cost, rating
      ]);
    }
    return tsv(['order_id', 'date', 'region', 'category', 'channel', 'units',
      'unit_price', 'discount', 'revenue', 'cost', 'rating'], rows);
  }

  /* ---------------- ② 学生成绩 ---------------- */
  function students() {
    var r = rng(777);
    var cls = ['A', 'B', 'C', 'D'];
    var rows = [];
    for (var i = 0; i < 160; i++) {
      var gender = r() < 0.5 ? 'F' : 'M';
      var math = rint(r, 45, 100), english = rint(r, 48, 100), science = rint(r, 40, 100);
      var attendance = rfix(r, 0.72, 1, 3);
      var avg = (math + english + science) / 3;
      rows.push(['S' + pad(i + 1), pick(r, cls), gender, math, english, science, attendance,
        (avg >= 60 && attendance >= 0.8) ? 'true' : 'false']);
    }
    return tsv(['student_id', 'class', 'gender', 'math', 'english', 'science', 'attendance', 'pass'], rows);
  }

  /* ---------------- ③ 城市月度气候 ---------------- */
  function weather() {
    var r = rng(4242);
    var cities = [
      ['Beijing', 12.5, 22, 550], ['Shanghai', 17.0, 19, 1100],
      ['Guangzhou', 22.5, 10, 1700], ['Chengdu', 16.5, 15, 900],
      ['Harbin', 4.5, 28, 500], ['Kunming', 15.0, 9, 1000],
      ['Urumqi', 7.5, 30, 280], ['Haikou', 24.5, 7, 1600]
    ];
    var rows = [];
    cities.forEach(function (c) {
      var base = c[1], amp = c[2], rain = c[3];
      for (var m = 1; m <= 12; m++) {
        var seasonal = Math.cos((m - 7) / 12 * Math.PI * 2);   /* 7 月最热 */
        var temp = Math.round((base + amp * seasonal + (r() - 0.5) * 1.2) * 10) / 10;
        var wet = 0.5 + 0.5 * Math.cos((m - 7) / 12 * Math.PI * 2);
        var mm = Math.max(1, Math.round(rain * wet / 12 * (0.75 + r() * 0.5)));
        rows.push([c[0], '2024-' + pad(m), temp, mm, rint(r, 40, 85), rint(r, 90, 260)]);
      }
    });
    return tsv(['city', 'month', 'avg_temp', 'rainfall_mm', 'humidity', 'sunshine_h'], rows);
  }

  /* ---------------- ④ 股票日线（随机游走） ---------------- */
  function stocks() {
    var r = rng(31415);
    var syms = [['AAPL', 180], ['MSFT', 400], ['TSLA', 250], ['NVDA', 120]];
    var rows = [];
    var start = Date.UTC(2024, 0, 2);
    syms.forEach(function (s) {
      var price = s[1];
      for (var d = 0; d < 168; d++) {
        var dt = new Date(start + d * 86400000);
        if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;   /* 跳过周末 */
        var open = price;
        var close = Math.max(1, Math.round(open * (1 + (r() - 0.48) * 0.035) * 100) / 100);
        var high = Math.round(Math.max(open, close) * (1 + r() * 0.015) * 100) / 100;
        var low = Math.round(Math.min(open, close) * (1 - r() * 0.015) * 100) / 100;
        rows.push([iso(dt), s[0], open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2),
          rint(r, 12, 160) * 100000]);
        price = close;
      }
    });
    return tsv(['date', 'symbol', 'open', 'high', 'low', 'close', 'volume'], rows);
  }

  /* ---------------- ⑤ 员工信息 ---------------- */
  function employees() {
    var r = rng(90210);
    var depts = ['Engineering', 'Sales', 'Marketing', 'Support', 'HR'];
    var levels = ['L1', 'L2', 'L3', 'L4', 'L5'];
    var base = { Engineering: 22000, Sales: 15000, Marketing: 16000, Support: 12000, HR: 13000 };
    var rows = [];
    for (var i = 0; i < 140; i++) {
      var dept = pick(r, depts), lv = pick(r, levels), k = levels.indexOf(lv) + 1;
      var salary = Math.round((base[dept] * (0.7 + 0.16 * k) * (0.9 + r() * 0.25)) / 100) * 100;
      rows.push(['E' + pad(i + 1), dept, lv, salary, rfix(r, 0.2, 12, 1), rfix(r, 1.5, 5, 1),
        (r() < 0.35) ? 'true' : 'false']);
    }
    return tsv(['emp_id', 'department', 'level', 'salary', 'tenure_years', 'performance', 'remote'], rows);
  }

  /* ---------------- ⑥ 国家指标（手写，便于讲解） ---------------- */
  var COUNTRIES_CSV = [
    'country,continent,population_m,gdp_per_capita,life_expectancy,co2_per_capita,internet_pct',
    'China,Asia,1412.0,12720,78.2,8.0,76.4',
    'India,Asia,1428.0,2480,70.4,1.9,46.3',
    'United States,North America,335.0,76330,76.3,14.3,91.8',
    'Indonesia,Asia,277.5,4780,71.7,2.6,66.5',
    'Pakistan,Asia,240.5,1590,66.4,1.0,25.0',
    'Brazil,South America,216.4,8920,72.8,2.2,80.7',
    'Nigeria,Africa,223.8,2170,53.6,0.6,55.4',
    'Bangladesh,Asia,172.9,2690,73.7,0.6,38.9',
    'Russia,Europe,144.4,12190,73.2,11.4,88.2',
    'Mexico,North America,128.5,11500,75.1,3.6,76.0',
    'Japan,Asia,124.5,33800,84.0,8.5,82.9',
    'Ethiopia,Africa,126.5,1030,65.6,0.2,16.7',
    'Philippines,Asia,117.3,3730,69.3,1.3,73.1',
    'Egypt,Africa,112.7,4290,70.2,2.3,72.2',
    'Germany,Europe,84.5,48720,80.9,7.9,91.4',
    'Turkey,Asia,85.3,10620,76.0,5.3,81.4',
    'France,Europe,68.2,40880,82.5,4.6,92.3',
    'United Kingdom,Europe,67.7,46120,80.7,4.9,96.7',
    'Thailand,Asia,71.8,7180,78.7,3.8,88.0',
    'South Africa,Africa,60.4,6770,62.3,6.7,72.3',
    'Italy,Europe,58.9,35620,82.9,5.3,85.1',
    'Myanmar,Asia,54.6,1190,65.7,0.7,44.0',
    'South Korea,Asia,51.7,32550,83.5,11.6,97.6',
    'Colombia,South America,52.1,6630,72.8,1.8,72.8',
    'Spain,Europe,47.5,29350,83.3,5.0,93.9',
    'Kenya,Africa,55.1,2100,61.4,0.4,28.8',
    'Argentina,South America,46.2,13650,75.4,4.1,87.2',
    'Australia,Oceania,26.4,64490,83.2,15.0,96.2',
    'Netherlands,Europe,17.6,57030,81.7,7.1,92.1',
    'Saudi Arabia,Asia,36.9,27720,77.9,18.0,100.0',
    'Canada,North America,38.8,52080,82.6,14.2,92.8',
    'Poland,Europe,41.0,18690,77.9,7.8,85.4',
    'Vietnam,Asia,98.9,4160,73.7,2.7,74.2',
    'Iran,Asia,88.6,4380,74.6,7.8,78.6',
    'Sweden,Europe,10.5,56400,83.1,3.6,94.7',
    'Switzerland,Europe,8.8,93390,84.0,4.0,95.6',
    'Norway,Europe,5.5,87280,83.2,7.5,97.0',
    'Singapore,Asia,5.9,82810,83.2,8.9,96.0',
    'New Zealand,Oceania,5.2,48420,82.5,6.6,95.9'
  ].join('\n');

  return {
    lists: [
      {
        id: 'sales', format: 'tsv', default: true,
        name: { zh: '销售流水', en: 'Sales Orders' },
        desc: { zh: '5 地区 · 5 品类 · 3 渠道 · 12 个月，含约 6% 缺失评分',
          en: '5 regions · 5 categories · 3 channels · 12 months, ~6% missing ratings' },
        build: sales
      },
      {
        id: 'students', format: 'tsv',
        name: { zh: '学生成绩', en: 'Student Scores' },
        desc: { zh: '4 个班级，三科成绩 + 出勤率 + 是否及格',
          en: '4 classes, three subjects with attendance and a pass flag' },
        build: students
      },
      {
        id: 'countries', format: 'csv',
        name: { zh: '国家指标', en: 'Country Indicators' },
        desc: { zh: '39 个国家：人口、人均 GDP、预期寿命、碳排放、互联网普及',
          en: '39 countries: population, GDP per capita, life expectancy, CO₂, internet' },
        build: function () { return COUNTRIES_CSV; }
      },
      {
        id: 'weather', format: 'tsv',
        name: { zh: '城市月度气候', en: 'City Climate' },
        desc: { zh: '8 座城市 × 12 个月的均温、降水、湿度、日照',
          en: '8 cities × 12 months of temperature, rainfall, humidity and sunshine' },
        build: weather
      },
      {
        id: 'stocks', format: 'tsv',
        name: { zh: '股票日线', en: 'Stock Daily' },
        desc: { zh: '4 只股票约 120 个交易日的 OHLC 与成交量',
          en: 'OHLC and volume for 4 tickers over ~120 trading days' },
        build: stocks
      },
      {
        id: 'employees', format: 'tsv',
        name: { zh: '员工信息', en: 'Employees' },
        desc: { zh: '5 个部门 × 5 个职级：薪资 / 司龄 / 绩效 / 是否远程',
          en: '5 departments × 5 levels: salary, tenure, performance, remote' },
        build: employees
      }
    ]
  };
}());
