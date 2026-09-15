# vendor/ —— 第三方库（本地内置，不走 CDN）

## d3-force（力导向布局）

| 文件 | 版本 | 大小 |
|---|---|---|
| `d3-quadtree.min.js` | 3.x | 5.2 KB |
| `d3-dispatch.min.js` | 3.x | 1.9 KB |
| `d3-timer.min.js` | 3.x | 1.9 KB |
| `d3-force.min.js` | 3.0.0 | 8.1 KB |

- **来源**：`https://cdn.jsdelivr.net/npm/<包名>@3/dist/<包名>.min.js`（npm 包 `d3-quadtree` / `d3-dispatch` / `d3-timer` / `d3-force`）
- **许可**：ISC（版权归 Mike Bostock，文件头部的注释保留原样，请勿删除）
- **为什么本地内置**：站点要求「双击 `index.html` 就能用、断网也能用」。走 CDN 的话离线直接失效。
- **为什么是 4 个文件而不是整个 d3**：`d3-force.min.js` 的 UMD 只把 API 挂到 `window.d3`，运行时需要
  `d3.quadtree` / `d3.dispatch` / `d3.timer` 三个依赖，所以必须一起引入。
  这 4 个文件共 **17 KB**；整个 d3 是约 280 KB，而我们只需要力导向这一个能力。
- **加载顺序**（必须）：`d3-quadtree` → `d3-dispatch` → `d3-timer` → `d3-force` → `graph.js`
- **升级方式**：重新从上面的地址下载覆盖即可；`graph.js` 只用到了
  `forceSimulation` / `forceLink` / `forceManyBody` / `forceCenter` / `forceCollide`，
  这些 API 在 v3 内稳定。

> `graph.js` 里还做了保护：如果 `window.d3.forceSimulation` 不存在（比如 vendor 文件没引入），
> 图谱区块会显示一条明确的错误提示，而不是白屏或静默失败。

---

本项目其余代码见仓库根目录 `README.md` 的「技术要点」。
