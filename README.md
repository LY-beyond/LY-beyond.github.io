# LY-beyond.github.io
Course Project for Introduction to Visualization

## 目录 / Sites

| 目录 | 内容 | Netlify 站点发布目录 |
|---|---|---|
| `vis/` | 第一次作业 | `vis` |
| `vis2/` | 第二次作业：人工智能 · 新质生产力 | `vis2` |

## 部署说明

本仓库是**纯静态站点**（没有 `package.json`，无需构建、无需依赖、无需环境变量），
用同一个 GitHub 仓库在 Netlify 上部署**两个站点**，各自设置 Publish directory（`vis` / `vis2`）。

⚠️ 根目录的 `netlify.toml` 里**故意不写 `publish`**：Netlify 的规则是「`netlify.toml` 覆盖 UI」，
若在此写死 `publish`，两个站点会互相覆盖，永远只能发布其中一个。

- 第二次作业的完整部署指导：👉 [`vis2/DEPLOY-NETLIFY.md`](vis2/DEPLOY-NETLIFY.md)
- **不部署也能预览**（不占 Netlify 额度）：双击 `vis2/index.html`；
  或执行 `python -m http.server 8099 --directory vis2` 后打开 <http://localhost:8099/>；
  或推送到 `main` 后用 GitHub Pages 看 <https://ly-beyond.github.io/vis2/>
  （⚠️ 该仓库 Pages 目前自 2026-09-14 起未成功部署，`/vis2/` 仍 404；日常预览请用上面两种方式，排查见 [`vis2/DEPLOY-NETLIFY.md`](vis2/DEPLOY-NETLIFY.md) §0.5）。
- 日常更新：`git push origin main` → Netlify 自动重新部署。

GitHub Pages 亦可直接访问本仓库：`https://ly-beyond.github.io/vis/`、`https://ly-beyond.github.io/vis2/`。

