/* =========================================================
   c5 真实参数切片（构建时内联，运行时不联网）
   ---------------------------------------------------------
   来源：Diez, Viggen & Johansen (2024). Simulated ultrasonic
   pulse-echo well-integrity dataset. Mendeley Data, v1.
   DOI: 10.17632/3bs65nzpv2.1   许可：CC BY 4.0
   说明：原始数据集共 1406 个 COMSOL 数值模型，含波形 JSON 与
   真值元数据（Metadata_overview.csv）。本示范只取 5 个典型模型
   的**真实几何与材料参数**；波形由页面内 1D 回波模型按这些参数
   重建，并在界面明确标注“重建波形”，不是原始记录。
   材料参数均为数据集中给出的真值：
     steel aisi 4340 : rho 7850 kg/m3, vp 5778 m/s (vp/vs 见原表)
     cement            : rho 1980, vp 3350
     shale             : rho 2110, vp 2106
     oil based mud     : rho 1250, vp 1301
     water based mud   : rho 2160, vp 1360（作微环隙充填）
     methane           : rho 58,  vp 477
   ========================================================= */
window.__C5_REAL__ = {
  dataset: 'Simulated ultrasonic pulse-echo well-integrity dataset',
  authors: 'A. Diez, E. M. Viggen, T. F. Johansen',
  doi: '10.17632/3bs65nzpv2.1',
  source: 'https://data.mendeley.com/datasets/3bs65nzpv2/1',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  models: 1406,
  steel: { rho: 7850, vp: 5778 },
  cases: [
    {
      id: 'cement', fileId: 579, label: '胶结良好（水泥）',
      out: { material: 'cement', rho: 1980, vp: 3350 },
      gap: null, thickness: 0.013, inner: 'oil based mud',
      ref: '胶结良好', tone: 'ok'
    },
    {
      id: 'shale', fileId: 580, label: '地层接触（页岩）',
      out: { material: 'shale', rho: 2110, vp: 2106 },
      gap: null, thickness: 0.013, inner: 'oil based mud',
      ref: '胶结良好', tone: 'ok'
    },
    {
      id: 'mud', fileId: 581, label: '自由套管（油基泥浆）',
      out: { material: 'oil based mud', rho: 1250, vp: 1301 },
      gap: null, thickness: 0.013, inner: 'oil based mud',
      ref: '自由套管/液环', tone: 'warn'
    },
    {
      id: 'gap', fileId: 949, label: '微环隙（1 mm 水膜）',
      out: { material: 'cement', rho: 1980, vp: 3350 },
      gap: { material: 'water based mud', thickness: 0.001, rho: 2160, vp: 1360 },
      thickness: 0.013, inner: 'water based mud',
      ref: '微环隙/液膜', tone: 'warn'
    },
    {
      id: 'gas', fileId: 585, label: '气环（甲烷）',
      out: { material: 'methane', rho: 58, vp: 477 },
      gap: null, thickness: 0.013, inner: 'oil based mud',
      ref: '气窜通道', tone: 'bad'
    }
  ]
};
