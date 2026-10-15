/* =========================================================
 * ml.js —— 迷你机器学习算法库(vis3)
 * ---------------------------------------------------------
 * 七个代表性算法,覆盖 ML 主要任务范式,全部原生 JS 实现:
 *   linreg   线性回归(最小二乘,回归)
 *   polyreg  多项式回归(最小二乘 + 标准化,非线性回归)
 *   logreg   逻辑回归(梯度下降,二分类)
 *   knn      K 近邻(距离加权投票,惰性分类)
 *   dtree    决策树(CART + Gini,可解释分类)
 *   kmeans   K-Means(k-means++ 初始化 + 标准化,聚类)
 *   pca      主成分分析(Jacobi 特征分解,无监督降维)
 * 输入都是「列值数组」,内部自动跳过缺失值对;
 * 返回结果里附带过滤后的点对,方便图表与模型严格对齐。
 * 五个有监督算法内置固定种子的训练/测试切分(splitMask,约 30% 留作测试),
 * 返回值额外带 isTest / nTrain / nTest 与测试集指标(r2Test / accuracyTest);
 * 三个分类算法(logreg / knn / dtree)再带逐样本预测 pred(0/1,与 xs/ys/labels/isTest 对齐)。
 * ========================================================= */
(function () {
  'use strict';

  /* 过滤出两列都为数值的行,返回对齐的点对 */
  function pairs(xs, ys) {
    var out = [];
    for (var i = 0; i < xs.length; i++) {
      var x = xs[i], y = ys[i];
      if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
        out.push([x, y]);
      }
    }
    return out;
  }

  function meanStd(vals) {
    var m = 0, i;
    for (i = 0; i < vals.length; i++) m += vals[i];
    m /= vals.length;
    var s = 0;
    for (i = 0; i < vals.length; i++) s += (vals[i] - m) * (vals[i] - m);
    s = Math.sqrt(s / vals.length);
    return { mean: m, std: s || 1 };
  }

  /* ---------------- 训练/测试切分 ----------------
   * 固定种子 LCG 乱序后按比例留出测试集,保证每次运行可复现;
   * n < 10 不划分(全部 false,等价于全量拟合)。 */
  function splitMask(n, testRatio) {
    var mask = new Array(n).fill(false);
    if (n < 10) return mask;
    testRatio = testRatio || 0.3;
    var seed = 42;
    function rand() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var idx = [], i, j, k, tmp;
    for (i = 0; i < n; i++) idx.push(i);
    for (j = n - 1; j > 0; j--) {          /* Fisher-Yates 洗牌 */
      k = Math.floor(rand() * (j + 1));
      tmp = idx[j]; idx[j] = idx[k]; idx[k] = tmp;
    }
    var nTest = Math.round(n * testRatio);
    for (i = 0; i < nTest; i++) mask[idx[i]] = true;
    return mask;
  }

  /* 测试集 R²(sklearn 口径:SST 分母用测试集自身的方差),样本不足或零方差返回 null */
  function r2OnTest(te, predict) {
    if (te.length < 2) return null;
    var my = 0, i;
    for (i = 0; i < te.length; i++) my += te[i][1];
    my /= te.length;
    var sse = 0, sst = 0;
    for (i = 0; i < te.length; i++) {
      var e = te[i][1] - predict(te[i][0]), dy = te[i][1] - my;
      sse += e * e; sst += dy * dy;
    }
    return sst ? 1 - sse / sst : null;
  }

  /* ---------------- 线性回归(最小二乘,训练集拟合 + 测试集评估) ---------------- */
  function linreg(xs, ys) {
    var p = pairs(xs, ys);
    if (p.length < 3) throw new Error('too few rows');
    var mask = splitMask(p.length, 0.3);
    var tr = [], te = [];
    for (var i = 0; i < p.length; i++) (mask[i] ? te : tr).push(p[i]);
    var nTr = tr.length, mx = 0, my = 0, k;
    for (k = 0; k < nTr; k++) { mx += tr[k][0]; my += tr[k][1]; }
    mx /= nTr; my /= nTr;
    var sxy = 0, sxx = 0, syy = 0;
    for (k = 0; k < nTr; k++) {
      var dx = tr[k][0] - mx, dy = tr[k][1] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx === 0) throw new Error('x has no variance');
    var slope = sxy / sxx;
    var intercept = my - slope * mx;
    var r2 = (syy === 0) ? 0 : (sxy * sxy) / (sxx * syy);   /* 训练集 R² */
    var r2Test = r2OnTest(te, function (x) { return slope * x + intercept; });
    return { slope: slope, intercept: intercept, r2: r2, n: p.length,
             r2Test: r2Test, isTest: mask, nTrain: nTr, nTest: te.length,
             xs: p.map(function (q) { return q[0]; }), ys: p.map(function (q) { return q[1]; }) };
  }

  /* ---------------- K-Means(k-means++ 初始化) ---------------- */
  function kmeans(xs, ys, k) {
    var p = pairs(xs, ys);
    if (p.length < k + 1) throw new Error('too few rows');
    var xs2 = p.map(function (q) { return q[0]; }), ys2 = p.map(function (q) { return q[1]; });
    var nx = meanStd(xs2), ny = meanStd(ys2);
    /* 标准化,避免量纲主导距离 */
    var pts = p.map(function (q) {
      return [(q[0] - nx.mean) / nx.std, (q[1] - ny.mean) / ny.std];
    });

    /* k-means++:用固定种子的伪随机,保证可复现 */
    var seed = 42;
    function rand() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var centers = [pts[Math.floor(rand() * pts.length)].slice()];
    while (centers.length < k) {
      var d2 = pts.map(function (pt) {
        var best = Infinity;
        centers.forEach(function (c) {
          var d = (pt[0] - c[0]) * (pt[0] - c[0]) + (pt[1] - c[1]) * (pt[1] - c[1]);
          if (d < best) best = d;
        });
        return best;
      });
      var sum = d2.reduce(function (a, b) { return a + b; }, 0) || 1;
      var r = rand() * sum, acc = 0, pick = 0;
      for (var i = 0; i < d2.length; i++) { acc += d2[i]; if (acc >= r) { pick = i; break; } }
      centers.push(pts[pick].slice());
    }

    var labels = new Array(pts.length).fill(0), moved = true, iters = 0;
    while (moved && iters < 100) {
      moved = false; iters++;
      for (var j = 0; j < pts.length; j++) {
        var bestK = 0, bestD = Infinity;
        for (var c = 0; c < k; c++) {
          var dd = (pts[j][0] - centers[c][0]) * (pts[j][0] - centers[c][0]) +
                   (pts[j][1] - centers[c][1]) * (pts[j][1] - centers[c][1]);
          if (dd < bestD) { bestD = dd; bestK = c; }
        }
        if (labels[j] !== bestK) { labels[j] = bestK; moved = true; }
      }
      for (var c2 = 0; c2 < k; c2++) {
        var sx = 0, sy = 0, n = 0;
        for (var j2 = 0; j2 < pts.length; j2++) {
          if (labels[j2] === c2) { sx += pts[j2][0]; sy += pts[j2][1]; n++; }
        }
        if (n) { centers[c2][0] = sx / n; centers[c2][1] = sy / n; }
      }
    }

    var counts = new Array(k).fill(0);
    labels.forEach(function (l) { counts[l]++; });
    return {
      labels: labels, iterations: iters, counts: counts,
      centers: centers.map(function (c) {
        return [c[0] * nx.std + nx.mean, c[1] * ny.std + ny.mean];   /* 换回原始尺度 */
      }),
      xs: xs2, ys: ys2
    };
  }

  /* ---------------- 逻辑回归(梯度下降,二分类,训练集拟合 + 测试集评估) ---------------- */
  function logreg(xs, ys, target) {
    var xs2 = [], ys2 = [], t2 = [];
    for (var i = 0; i < xs.length; i++) {
      if (typeof xs[i] === 'number' && !isNaN(xs[i]) &&
          typeof ys[i] === 'number' && !isNaN(ys[i]) &&
          (target[i] === 0 || target[i] === 1)) {
        xs2.push(xs[i]); ys2.push(ys[i]); t2.push(target[i]);
      }
    }
    if (t2.length < 10) throw new Error('too few rows');
    var mask = splitMask(t2.length, 0.3);
    var trIdx = [], teIdx = [];
    for (var m = 0; m < t2.length; m++) (mask[m] ? teIdx : trIdx).push(m);
    /* 标准化参数只来自训练集 */
    var nx = meanStd(trIdx.map(function (j) { return xs2[j]; }));
    var ny = meanStd(trIdx.map(function (j) { return ys2[j]; }));
    var X = trIdx.map(function (j) { return (xs2[j] - nx.mean) / nx.std; });
    var Y = trIdx.map(function (j) { return (ys2[j] - ny.mean) / ny.std; });
    var w1 = 0, w2 = 0, b = 0, lr = 0.5, epochs = 2000, n = trIdx.length;
    for (var e = 0; e < epochs; e++) {
      var g1 = 0, g2 = 0, gb = 0;
      for (var j = 0; j < n; j++) {
        var z = w1 * X[j] + w2 * Y[j] + b;
        var pr = 1 / (1 + Math.exp(-z));
        var err = pr - t2[trIdx[j]];
        g1 += err * X[j]; g2 += err * Y[j]; gb += err;
      }
      w1 -= lr * g1 / n; w2 -= lr * g2 / n; b -= lr * gb / n;
    }
    /* 训练集准确率 */
    var correct = 0;
    for (var j2 = 0; j2 < n; j2++) {
      var z2 = w1 * X[j2] + w2 * Y[j2] + b;
      var pred = z2 >= 0 ? 1 : 0;
      if (pred === t2[trIdx[j2]]) correct++;
    }
    /* 测试集准确率 */
    var correctTe = 0;
    teIdx.forEach(function (j) {
      var zx = (xs2[j] - nx.mean) / nx.std, zy = (ys2[j] - ny.mean) / ny.std;
      var predTe = (w1 * zx + w2 * zy + b) >= 0 ? 1 : 0;
      if (predTe === t2[j]) correctTe++;
    });
    /* 逐样本预测(与 xs/ys/labels/isTest 对齐):z>=0 判为 1 */
    var predAll = [];
    for (var s3 = 0; s3 < t2.length; s3++) {
      var zx2 = (xs2[s3] - nx.mean) / nx.std, zy2 = (ys2[s3] - ny.mean) / ny.std;
      predAll.push((w1 * zx2 + w2 * zy2 + b) >= 0 ? 1 : 0);
    }
    return {
      w: [w1, w2], b: b, accuracy: correct / n,
      accuracyTest: teIdx.length ? correctTe / teIdx.length : null,
      n: t2.length, isTest: mask, nTrain: trIdx.length, nTest: teIdx.length,
      epochs: epochs,
      norm: { mx: nx.mean, sx: nx.std, my: ny.mean, sy: ny.std },
      xs: xs2, ys: ys2, labels: t2, pred: predAll,
      /* 供决策边界图逐格调用:输入原始坐标,输出 0/1 */
      predictOrig: function (x, y) {
        var zx = (x - nx.mean) / nx.std, zy = (y - ny.mean) / ny.std;
        return (w1 * zx + w2 * zy + b) >= 0 ? 1 : 0;
      }
    };
  }

  /* ---------------- 多项式回归(degree 2/3,最小二乘) ----------------
     先把 x 标准化为 z 以稳定数值,再解正规方程 [1,z,z²,...] 的最小二乘。 */
  function gaussianSolve(A, b) {
    var n = A.length, M = [];
    for (var i = 0; i < n; i++) M.push(A[i].concat([b[i]]));
    for (var col = 0; col < n; col++) {
      var piv = col;
      for (var r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) throw new Error('singular matrix');
      if (piv !== col) { var tmp = M[piv]; M[piv] = M[col]; M[col] = tmp; }
      for (var r2 = col + 1; r2 < n; r2++) {
        var f = M[r2][col] / M[col][col];
        for (var c = col; c <= n; c++) M[r2][c] -= f * M[col][c];
      }
    }
    var x = new Array(n).fill(0);
    for (var i2 = n - 1; i2 >= 0; i2--) {
      var s = M[i2][n];
      for (var j = i2 + 1; j < n; j++) s -= M[i2][j] * x[j];
      x[i2] = s / M[i2][i2];
    }
    return x;
  }

  function polyreg(xs, ys, degree) {
    var p = pairs(xs, ys);
    if (p.length < degree + 2) throw new Error('too few rows');
    degree = degree === 3 ? 3 : 2;
    var mask = splitMask(p.length, 0.3);
    var tr = [], te = [];
    for (var i = 0; i < p.length; i++) (mask[i] ? te : tr).push(p[i]);
    /* 标准化参数只来自训练集 */
    var ns = meanStd(tr.map(function (q) { return q[0]; }));
    var Z = tr.map(function (q) { return (q[0] - ns.mean) / ns.std; });
    var Y = tr.map(function (q) { return q[1]; });
    /* 正规方程:A'A c = A'y */
    var d = degree + 1, A = [];
    for (var i = 0; i < d; i++) { A.push(new Array(d).fill(0)); }
    var bv = new Array(d).fill(0);
    for (var r = 0; r < Z.length; r++) {
      var zpow = new Array(d); zpow[0] = 1;
      for (var k = 1; k < d; k++) zpow[k] = zpow[k - 1] * Z[r];
      for (var a = 0; a < d; a++) {
        bv[a] += zpow[a] * Y[r];
        for (var b2 = 0; b2 < d; b2++) A[a][b2] += zpow[a] * zpow[b2];
      }
    }
    var coef = gaussianSolve(A, bv);
    function predictZ(z) {
      var s = 0, zp = 1;
      for (var i2 = 0; i2 < d; i2++) { s += coef[i2] * zp; zp *= z; }
      return s;
    }
    /* 训练集 R² */
    var my = 0; Y.forEach(function (v) { my += v; }); my /= Y.length;
    var sse = 0, sst = 0;
    for (var r2 = 0; r2 < Y.length; r2++) {
      var e = Y[r2] - predictZ(Z[r2]); sse += e * e;
      var dy = Y[r2] - my; sst += dy * dy;
    }
    var r2v = sst ? 1 - sse / sst : 0;
    /* 测试集 R²(sklearn 口径) */
    var r2Test = r2OnTest(te, function (x) {
      return predictZ((x - ns.mean) / ns.std);
    });
    var vertex = null;
    if (degree === 2 && Math.abs(coef[2]) > 1e-12) {
      var zv = -coef[1] / (2 * coef[2]);
      vertex = { x: ns.mean + zv * ns.std, y: predictZ(zv), kind: coef[2] > 0 ? 'min' : 'max' };
    }
    return {
      coef: coef, degree: degree, r2: r2v, n: p.length,
      r2Test: r2Test, isTest: mask, nTrain: tr.length, nTest: te.length,
      mean: ns.mean, std: ns.std,
      xs: p.map(function (q) { return q[0]; }), ys: p.map(function (q) { return q[1]; }),
      predictOrig: function (x) { return predictZ((x - ns.mean) / ns.std); },
      vertex: vertex
    };
  }

  /* ---------------- K 近邻分类(距离加权投票,近邻只在训练集内找) ---------------- */
  function knn(xs, ys, target, k) {
    var xs2 = [], ys2 = [], t2 = [];
    for (var i = 0; i < xs.length; i++) {
      if (typeof xs[i] === 'number' && !isNaN(xs[i]) &&
          typeof ys[i] === 'number' && !isNaN(ys[i]) &&
          (target[i] === 0 || target[i] === 1)) {
        xs2.push(xs[i]); ys2.push(ys[i]); t2.push(target[i]);
      }
    }
    if (t2.length < 10) throw new Error('too few rows');
    k = Math.max(1, Math.min(25, k || 5));
    /* 训练集过大时等距抽样,给决策边界网格的逐格预测减负(可复现) */
    var CAP = 1500, pickIdx = null;
    if (t2.length > CAP) {
      pickIdx = [];
      var step = t2.length / CAP;
      for (var s2 = 0; s2 < CAP; s2++) pickIdx.push(Math.floor(s2 * step));
      xs2 = pickIdx.map(function (j) { return xs2[j]; });
      ys2 = pickIdx.map(function (j) { return ys2[j]; });
      t2 = pickIdx.map(function (j) { return t2[j]; });
    }
    var mask = splitMask(t2.length, 0.3);
    var trIdx = [], teIdx = [];
    for (var m = 0; m < t2.length; m++) (mask[m] ? teIdx : trIdx).push(m);
    /* 标准化参数只来自训练集 */
    var nx = meanStd(trIdx.map(function (j) { return xs2[j]; }));
    var ny = meanStd(trIdx.map(function (j) { return ys2[j]; }));
    var pts = [];
    for (var i2 = 0; i2 < t2.length; i2++) {
      pts.push({ x: (xs2[i2] - nx.mean) / nx.std, y: (ys2[i2] - ny.mean) / ny.std, c: t2[i2] });
    }
    var trainPts = trIdx.map(function (j) { return pts[j]; });
    /* 投票只在训练集点里找近邻;skip 为 trainPts 内的序号,
       评估训练点时排除自己(留一法),避免「自己给自己投票」让准确率虚高 */
    function voteAmong(zx, zy, skip) {
      var ds = [];
      for (var t = 0; t < trainPts.length; t++) {
        if (t === skip) continue;
        var dx = trainPts[t].x - zx, dy = trainPts[t].y - zy;
        ds.push({ d2: dx * dx + dy * dy, c: trainPts[t].c });
      }
      ds.sort(function (a, b) { return a.d2 - b.d2; });
      var w0 = 0, w1 = 0;
      for (var j = 0; j < k && j < ds.length; j++) {
        var w = 1 / (ds[j].d2 + 1e-6);
        if (ds[j].c === 1) w1 += w; else w0 += w;
      }
      return w1 > w0 ? 1 : 0;
    }
    /* 训练准确率:训练集内部留一法 */
    var correct = 0;
    trIdx.forEach(function (j, t) { if (voteAmong(pts[j].x, pts[j].y, t) === t2[j]) correct++; });
    /* 测试准确率:每个测试点用训练集投票 */
    var correctTe = 0;
    teIdx.forEach(function (j) { if (voteAmong(pts[j].x, pts[j].y, -1) === t2[j]) correctTe++; });
    /* 逐样本预测(与 xs/ys/labels/isTest 对齐):训练样本保持留一(skip 自身) */
    var trainPos = {};
    trIdx.forEach(function (j, t) { trainPos[j] = t; });
    var pred = [];
    for (var pv = 0; pv < t2.length; pv++) {
      pred.push(voteAmong(pts[pv].x, pts[pv].y,
        Object.prototype.hasOwnProperty.call(trainPos, pv) ? trainPos[pv] : -1));
    }
    return {
      k: k, accuracy: correct / trIdx.length,
      accuracyTest: teIdx.length ? correctTe / teIdx.length : null,
      n: pts.length, isTest: mask, nTrain: trIdx.length, nTest: teIdx.length,
      xs: xs2, ys: ys2, labels: t2, pred: pred,
      predictOrig: function (x, y) {
        return voteAmong((x - nx.mean) / nx.std, (y - ny.mean) / ny.std, -1);
      }
    };
  }

  /* ---------------- 决策树(CART,二分类,Gini 增益,训练集建树 + 测试集评估) ----------------
     只在两个特征上切分;阈值取分位数候选,叶子返回多数类。 */
  function dtree(xs, ys, target, maxDepth) {
    var xs2 = [], ys2 = [], t2 = [];
    for (var i = 0; i < xs.length; i++) {
      if (typeof xs[i] === 'number' && !isNaN(xs[i]) &&
          typeof ys[i] === 'number' && !isNaN(ys[i]) &&
          (target[i] === 0 || target[i] === 1)) {
        xs2.push(xs[i]); ys2.push(ys[i]); t2.push(target[i]);
      }
    }
    if (t2.length < 10) throw new Error('too few rows');
    maxDepth = Math.max(1, Math.min(8, maxDepth || 3));
    var n = t2.length;
    var mask = splitMask(n, 0.3);
    var trIdx = [], teIdx = [];
    for (var m = 0; m < n; m++) (mask[m] ? teIdx : trIdx).push(m);
    var nTrain = trIdx.length;
    var minLeaf = Math.max(5, Math.round(nTrain * 0.03));
    var P = [];
    for (var i2 = 0; i2 < n; i2++) P.push([xs2[i2], ys2[i2]]);

    function giniOf(c0, c1) {
      var tot = c0 + c1;
      if (!tot) return 0;
      return 1 - (c0 / tot) * (c0 / tot) - (c1 / tot) * (c1 / tot);
    }
    function counts(ids) {
      var c0 = 0, c1 = 0;
      ids.forEach(function (j) { if (t2[j]) c1++; else c0++; });
      return [c0, c1];
    }
    /* 每个特征取至多 20 个分位数作为切分阈值候选 */
    function thresholds(ids, f) {
      var vals = ids.map(function (j) { return P[j][f]; }).sort(function (a, b) { return a - b; });
      var out = [], Q = 20;
      for (var q = 1; q < Q; q++) {
        var pos = (vals.length - 1) * q / Q;
        var base = Math.floor(pos), rest = pos - base;
        var v = vals[base + 1] !== undefined ? vals[base] + rest * (vals[base + 1] - vals[base]) : vals[base];
        if (!out.length || Math.abs(v - out[out.length - 1]) > 1e-9) out.push(v);
      }
      return out;
    }
    var importance = [0, 0];
    function build(ids, depth) {
      var cs = counts(ids), node = { n: ids.length, c0: cs[0], c1: cs[1], cls: cs[1] >= cs[0] ? 1 : 0 };
      var pure = cs[0] === 0 || cs[1] === 0;
      if (depth >= maxDepth || ids.length < 2 * minLeaf || pure) { node.leaf = true; return node; }
      var gP = giniOf(cs[0], cs[1]), best = null;
      for (var f = 0; f < 2; f++) {
        var ths = thresholds(ids, f);
        for (var ti = 0; ti < ths.length; ti++) {
          var th = ths[ti], L = [], R = [];
          ids.forEach(function (j) { (P[j][f] <= th ? L : R).push(j); });
          if (L.length < minLeaf || R.length < minLeaf) continue;
          var lc = counts(L), rc = counts(R);
          var gL = giniOf(lc[0], lc[1]), gR = giniOf(rc[0], rc[1]);
          var gain = gP - (L.length * gL + R.length * gR) / ids.length;
          if (!best || gain > best.gain) best = { f: f, th: th, L: L, R: R, gain: gain };
        }
      }
      if (!best || best.gain <= 1e-9) { node.leaf = true; return node; }
      importance[best.f] += best.gain * ids.length / nTrain;
      node.f = best.f; node.th = best.th; node.gain = best.gain;
      node.left = build(best.L, depth + 1);
      node.right = build(best.R, depth + 1);
      return node;
    }
    /* 树只在训练子集上构建 */
    var root = build(trIdx, 0);

    function predictOne(x, y) {
      var nd = root;
      while (!nd.leaf) nd = (nd.f === 0 ? x : y) <= nd.th ? nd.left : nd.right;
      return nd.cls;
    }
    /* 训练 / 测试准确率 */
    var correct = 0;
    trIdx.forEach(function (j) { if (predictOne(P[j][0], P[j][1]) === t2[j]) correct++; });
    var correctTe = 0;
    teIdx.forEach(function (j) { if (predictOne(P[j][0], P[j][1]) === t2[j]) correctTe++; });
    /* 逐样本预测(与 xs/ys/labels/isTest 对齐):用建好的树逐个落叶 */
    var pred = [];
    for (var pv = 0; pv < n; pv++) pred.push(predictOne(P[pv][0], P[pv][1]));

    /* 收集叶子规则 / 深度 / 叶数 */
    var leaves = 0, maxSeen = 0, rules = [];
    (function walk(nd, conds, depth) {
      if (depth > maxSeen) maxSeen = depth;
      if (nd.leaf) {
        leaves++;
        if (rules.length < 8) {
          rules.push({ conds: conds.slice(), cls: nd.cls, n: nd.n,
                       ratio: nd.n ? (nd.cls ? nd.c1 : nd.c0) / nd.n : 0 });
        }
        return;
      }
      var fname = nd.f === 0 ? 'x' : 'y';
      walk(nd.left, conds.concat([{ f: nd.f, op: '<=', th: nd.th }]), depth + 1);
      walk(nd.right, conds.concat([{ f: nd.f, op: '>', th: nd.th }]), depth + 1);
    }(root, [], 0));
    var impSum = importance[0] + importance[1];
    var importancePct = impSum ? [importance[0] / impSum, importance[1] / impSum] : [0.5, 0.5];

    return {
      maxDepth: maxDepth, depth: maxSeen, leaves: leaves, rules: rules,
      importance: importancePct,
      accuracy: nTrain ? correct / nTrain : 0,
      accuracyTest: teIdx.length ? correctTe / teIdx.length : null,
      n: n, isTest: mask, nTrain: nTrain, nTest: teIdx.length,
      xs: xs2, ys: ys2, labels: t2, pred: pred,
      predictOrig: predictOne
    };
  }

  /* ---------------- PCA 主成分分析(标准化 + Jacobi) ---------------- */
  function jacobi(A) {
    var d = A.length, E = [];
    for (var i = 0; i < d; i++) { E.push(new Array(d).fill(0)); E[i][i] = 1; }
    var J = A.map(function (r) { return r.slice(); });
    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (var p = 0; p < d - 1; p++)
        for (var q = p + 1; q < d; q++) off += J[p][q] * J[p][q];
      if (off < 1e-12) break;
      for (var p2 = 0; p2 < d - 1; p2++) {
        for (var q2 = p2 + 1; q2 < d; q2++) {
          if (Math.abs(J[p2][q2]) < 1e-14) continue;
          var tau = (J[q2][q2] - J[p2][p2]) / (2 * J[p2][q2]);
          var tt = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
          var c = 1 / Math.sqrt(1 + tt * tt), s = tt * c;
          for (var k = 0; k < d; k++) {
            if (k === p2 || k === q2) continue;
            var akp = J[k][p2], akq = J[k][q2];
            J[k][p2] = c * akp - s * akq; J[p2][k] = J[k][p2];
            J[k][q2] = s * akp + c * akq; J[q2][k] = J[k][q2];
          }
          var app = J[p2][p2], aqq = J[q2][q2], apq = J[p2][q2];
          J[p2][p2] = c * c * app - 2 * s * c * apq + s * s * aqq;
          J[q2][q2] = s * s * app + 2 * s * c * apq + c * c * aqq;
          J[p2][q2] = 0; J[q2][p2] = 0;
          for (var k2 = 0; k2 < d; k2++) {
            var vkp = E[k2][p2], vkq = E[k2][q2];
            E[k2][p2] = c * vkp - s * vkq;
            E[k2][q2] = s * vkp + c * vkq;
          }
        }
      }
    }
    var vals = [], i3;
    for (i3 = 0; i3 < d; i3++) vals.push(J[i3][i3]);
    return { values: vals, vectors: E };
  }

  function pca(names, columns) {
    var d = columns.length;
    if (d < 2) throw new Error('need >= 2 columns');
    var n = columns[0].length, rows = [];
    for (var i = 0; i < n; i++) {
      var ok = true, row = [];
      for (var f = 0; f < d; f++) {
        var v = columns[f][i];
        if (typeof v !== 'number' || isNaN(v)) { ok = false; break; }
        row.push(v);
      }
      if (ok) rows.push(row);
    }
    if (rows.length < d + 2) throw new Error('too few rows');
    var means = [], stds = [];
    for (var f2 = 0; f2 < d; f2++) {
      var col = rows.map(function (r) { return r[f2]; });
      var ms = meanStd(col);
      means.push(ms.mean); stds.push(ms.std);
    }
    var Z = rows.map(function (r) {
      return r.map(function (v, f3) { return (v - means[f3]) / stds[f3]; });
    });
    /* 协方差矩阵(标准化后即相关矩阵) */
    var cov = [];
    for (var a = 0; a < d; a++) {
      cov.push(new Array(d).fill(0));
      for (var b = 0; b < d; b++) {
        var sm = 0;
        for (var r2 = 0; r2 < Z.length; r2++) sm += Z[r2][a] * Z[r2][b];
        cov[a][b] = sm / (Z.length - 1);
      }
    }
    var ej = jacobi(cov);
    var order = ej.values.map(function (v, idx) { return { v: v, idx: idx }; })
      .sort(function (x, y) { return y.v - x.v; });
    var eigVals = order.map(function (o) { return Math.max(0, o.v); });
    var trace = eigVals.reduce(function (a2, b3) { return a2 + b3; }, 0) || 1;
    var explained = eigVals.map(function (v) { return v / trace; });
    var v1 = order[0].idx, v2 = order[1].idx;
    var scores = Z.map(function (r) {
      var s1 = 0, s2 = 0;
      for (var f4 = 0; f4 < d; f4++) {
        s1 += r[f4] * ej.vectors[f4][v1];
        s2 += r[f4] * ej.vectors[f4][v2];
      }
      return [s1, s2];
    });
    /* 载荷:特征与主成分的相关系数 = 特征向量 × √λ */
    var loadings = names.map(function (nm, f5) {
      return { name: nm,
               v: [ej.vectors[f5][v1] * Math.sqrt(eigVals[0]),
                   ej.vectors[f5][v2] * Math.sqrt(eigVals[1])] };
    });
    return {
      n: rows.length, d: d, names: names,
      eigVals: eigVals, explained: explained,
      scores: scores, loadings: loadings,
      pc1: scores.map(function (s) { return s[0]; }),
      pc2: scores.map(function (s) { return s[1]; })
    };
  }

  window.MiniML = {
    linreg: linreg, polyreg: polyreg, logreg: logreg,
    knn: knn, dtree: dtree, kmeans: kmeans, pca: pca
  };
}());
