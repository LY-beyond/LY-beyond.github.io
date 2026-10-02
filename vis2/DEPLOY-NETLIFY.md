# 用 Netlify 部署 vis2 —— 从 GitHub 导入的完整指导方案

> 面向本仓库 `LY-beyond.github.io`：里面同时有
> `vis/`（第一次作业，已用 Netlify 部署过）和 `vis2/`（第二次作业，本次要部署）。
>
> 适用范围：Netlify 免费版（Starter），纯静态站点，**不需要构建、不需要 Node 版本、不需要环境变量**。

---

## 0. 先看结论（TL;DR）

| 问题 | 答案 |
|---|---|
| 一个 Netlify 站点能同时发布 `vis/` 和 `vis2/` 吗？ | 不能，**一个站点只能有一个 Publish directory**。 |
| 推荐做法 | **同一个 GitHub 仓库 → 建两个 Netlify 站点**：旧站点发布 `vis`，新站点发布 `vis2`。 |
| 最大的坑 | `netlify.toml` 里的设置**会覆盖** UI 设置（Netlify 官方规则）。根目录原来写死 `publish = "vis"`，会导致新站点也去发布 `vis`。 |
| 本方案怎么解决 | 已把根 `netlify.toml` 的 `publish` 去掉（只留说明注释），两个站点各自在 UI 里声明 Publish directory。 |
| 需要几条命令 | 只有 4 条（见 §1），其余全在网页上点。 |
| 预计耗时 | 首次约 10 分钟；之后再更新只要 `git push`，Netlify 自动重新部署。 |
| 可以先不部署、改完再一次性部署吗？ | **可以**，完全没问题；预览方式见 §0.5（**本地预览已实测可用**；GitHub Pages 这个通道当前不可用，原因见 §0.5）。 |

---

## 0.5 先不部署：不花额度也能看效果的 3 条通道

**结论：随意推迟部署。** `vis2/` 只是静态文件，放在本地或 GitHub 上随时都能看，
真正"必须"部署的时刻只有一个 —— **你要交最终 URL 的时候**（详见本节末尾）。

### 三种预览方式对比

| 方式 | 怎么用 | 地址 | 说明 |
|---|---|---|---|
| ① **双击打开**（最省事） | 双击 `D:\Vis\LY-beyond.github.io\vis2\index.html` | `file:///D:/.../vis2/index.html` | 本页**特意全部使用普通 `<script src>`**：无 `type="module"`、无 `fetch`/XHR，所以 `file://` 下功能完整、完全离线 |
| ② **本地 HTTP 服务器**（最接近线上） | 仓库根目录执行 `python -m http.server 8099 --directory vis2` | <http://localhost:8099/> | 已在本机验证（Python 3.8）；也可用 VS Code 的 **Live Server** 扩展，或 `npx serve vis2` |
| ③ **GitHub Pages**（不占额度，但 ⚠️ **当前不可用**，见下） | `git push origin main` 后自动生效 | <https://ly-beyond.github.io/vis2/> | 本该是最方便的真机预览通道，但本仓库的 Pages 自 2026-09-14 起没部署成功过（实测数据见下） |

> ⚠️ **实测（2026-10-02）：这个仓库的 GitHub Pages 目前是"卡住"状态，自 2026-09-14 起就没有成功部署过**，
> 所以方式 ③ **现在还不能当预览用**：
>
> | 探测项 | Pages 上 | 本地 | 结论 |
> |---|---|---|---|
> | `/vis/index.html` | 200，10,359 B | 16,504 B | 还是 9/14 的旧版 |
> | `/vis/theme.js`、`vis/graph.js`、`vis/FEATURES.md`、`vis/practice-data.js` | **404** | 存在 | 这些是 **9/15** 才加入的文件，没被部署 |
> | `/vis2/index.html` | **404** | 14,887 B | vis2 是 **10/02** 提交的，自然没有 |
>
> **结论：日常预览请用方式 ① 和 ②（都已验证可用）**，别等 Pages。
> 想让 Pages 恢复（可选，作业不依赖它）：
>
> 1. 打开 **仓库 → Settings → Pages**，确认 Source 是 `Deploy from a branch` → `main` → `/ (root)`；
>    然后看 **Actions → 左侧 "pages build and deployment"** 最近几次是不是红色失败，并翻一下邮箱里的 *Page build failed* 通知；
> 2. 或者改用 **GitHub Actions 发布**（新增一个 `.github/workflows/pages.yml`，把 `vis/` 与 `vis2/` 目录直接上传，绕开 Jekyll 构建），
>    再到 Settings → Pages → Source 选 **GitHub Actions**。需要的话说一声，我可以直接帮你加上这个工作流文件。
>
> 💡 也可以完全不折腾：**交作业用 Netlify 的 URL（见 §4）即可**，预览用本地 ①②。

### 本地预览的 3 个小提示

1. **强刷**：改了 CSS/JS 后按 `Ctrl+F5`（或开无痕窗口），避免浏览器缓存旧文件；
2. **`localStorage`**：`file://` 下个别浏览器/隐身模式会禁用（本页已用 `try/catch` 兜底，语言与主题回落到默认值）；
   用方式 ② 则与线上完全一致；
3. **真机**：手机与电脑连同一 WiFi 时，可用 `python -m http.server 8099 --directory vis2 --bind 0.0.0.0`，
   然后手机访问 `http://<电脑局域网 IP>:8099/`。

### Netlify 额度到底怎么算（决定你要不要省）

| 你的账号类型 | 计量方式 | 关键数字 |
|---|---|---|
| **2025-09-04 之后新建**（Credit-based） | 按 **credits** 计，Free = **300 credits/月**，硬上限 | **带宽 20 credits/GB**；**网页请求 2 credits / 1 万次**；额度耗尽后站点显示 `Site not available` |
| **2025-09-04 之前创建**（Legacy Free/Starter） | 按 **build minutes + 带宽** 计 | 通常 300 build minutes/月、100 GB 带宽/月 |

- **部署次数本身不单独计费**（计的是带宽与请求量）；
- 粗算本页的消耗：一次完整访问约 **400 KB、约 25 个请求**
  → 带宽 0.0004 GB × 20 ≈ **0.008 credit**，请求 25/10000 × 2 ≈ **0.005 credit**，
  即约 **0.013 credit / 次访问**；**1000 次访问 ≈ 13 credits**，相对 300 credits/月 很宽裕；
- 真正的额度大头通常是**上一份作业里的高清图片/视频**，请在
  **Usage & billing → Monitor credit usage** 里看当前用量，再决定要不要省。

### 开发期间想让 Netlify 完全不动？（可选）

每次 `git push origin main` 都会让已连接的旧站点跑一次部署（本页很小，成本可忽略）。
若你想在这几天**一次部署都不产生**：

1. 进旧站点 → **Project configuration > Developer settings > Continuous deployment > Build settings**；
2. 点 **Configure** → 把 **Build status** 切到 **Stopped builds**。

⚠️ 代价：停用后 Netlify **不会**因 push / build hook / API / UI 触发任何构建（
**Deploys 页面的 `Trigger deploy` 按钮也会变灰**）。
想重新部署时，再切回 **Active builds**（激活本身不会立即构建，需要再触发一次）。

> 如果你的旧站点还需要随时能重发，就别停用，直接让它跟着 push 跑，成本可以忽略。

### 那什么时候"必须"部署？

只有**你要交最终 URL 的时刻**。中间所有修改用 §0.5 的 **①②** 预览即可（③ Pages 通道当前不可用）；
最后按 §4 建好站点后，之后每次 `git push` 都会自动重新部署，
所以完全可以"**开发期本地看 → 收尾时一次性部署**"。

---

## 1. 前置条件：先把 vis2 推上 GitHub

现在 `vis2/` **还没有被提交**（`git status` 显示 `?? vis2/`），Netlify 只能部署仓库里已有的文件，所以这一步必须先做：

```powershell
cd D:\Vis\LY-beyond.github.io

# 1) 先在本地体检一遍（零依赖静态自检，应为「✓ 全部通过」）
node vis2/check.mjs

# 2) 提交 vis2 与本次的 netlify.toml 调整
git add vis2 netlify.toml
git commit -m "第二次作业：AI 新质生产力可视化 + 多站点部署配置"
git push origin main
```

推送后自检：

```powershell
git status --short        # 应该没有未跟踪的 vis2/
```

然后在浏览器打开 `https://github.com/LY-beyond/LY-beyond.github.io/tree/main/vis2`，
能看到 `index.html` 等一系列文件即成功。

> 若 `git push` 要求登录：用 GitHub 用户名 + **Personal Access Token**（或 VS Code / Git Credential Manager 弹窗）即可，与本方案无关。

---

## 2. 动手前必做：把旧站点的 Publish directory 显式写进 UI

**为什么必须做**：本方案要去掉根 `netlify.toml` 里的 `publish = "vis"`。
去掉之后，旧站点就必须自己在 UI 里记住「发布目录 = vis」；否则它下次重新部署时会找不到页面（默认变成仓库根目录，而根目录没有 `index.html`）。

**操作（约 30 秒，只做一次）**

> ⚠️ **如果你已经 push 过了**（例如 `63abbd2` 已在 `origin/main`）：那次推送很可能已经让旧站点重建过一次，
> 而当时 UI 里若没写 `vis`，旧站点现在**可能已经挂掉**。请立刻打开旧站点 URL 看一眼：
> 首页 404 或出现的是目录/空白 → 说明 UI 里没有 `publish = vis`，现在按下面 1–5 步设成 `vis` 并
> **Trigger deploy** 一次即可恢复（约 10 秒）；一切正常也建议按 1–5 步把设置写死，避免以后再踩。

1. 打开 <https://app.netlify.com/>，进入**旧站点**（上次部署 vis 的那个）。
2. 左侧 **Site configuration → Build & deployment → Build settings**。
3. 点 **Edit settings** → 找到 **Publish directory** → 填 `vis`（若已经是 `vis` 就保持不变）。
4. **Save**。
5. 顺手验证一次：**Deploys → Trigger deploy → Deploy site**，
   在部署日志里应能看到：

   ```
   Publish directory: vis
   ```

   并且站点首页仍能正常打开。

> ✅ 做到这里，旧站点已经「自给自足」，之后无论 `netlify.toml` 怎么改都不受影响。

---

## 3. 仓库侧改动（已由我完成，你只需一起提交）

根目录 `netlify.toml` 已从：

```toml
[build]
  publish = "vis"
```

改为**不含 `publish` 的说明性文件**（保留注释解释「为什么不能写死」）。这样：

- 旧站点：UI 里 `Publish directory = vis` → 生效；
- 新站点：UI 里 `Publish directory = vis2` → 生效；
- 两者互不干扰。

> ⚠️ **提交顺序**：请**先完成 §2 的 UI 设置，再执行 §1 的 `git push`**。
> 顺序反了会让旧站点在两次部署之间短暂变成 404（改完 UI 再 Trigger deploy 一次即可恢复）。

---

## 4. 新建 Netlify 站点并从 GitHub 导入（本次核心步骤）

### 4.1 导入

1. 打开 <https://app.netlify.com/start>（或团队面板 → **Add new project**）。
2. 选择 **Import an existing project**。
3. 选择 **GitHub**（Deploy with GitHub）。
   - 首次使用需授权：**Authorize Netlify**；
   - 若仓库不在列表里，点 **Configure the Netlify app on GitHub** →
     `Repository access` 选 *All repositories* 或把 `LY-beyond.github.io` 加入白名单。
4. 在列表里选中 **`LY-beyond/LY-beyond.github.io`**（已部署过 vis 的同一个仓库，**可以重复导入**）。

### 4.2 填写站点设置（这一屏最关键）

| 字段 | 填什么 | 说明 |
|---|---|---|
| Branch to deploy | `main` | 生产分支，默认就是 main |
| Base directory | **留空** | 仓库根目录 |
| Build command | **留空** | 纯静态站，无 `package.json`，不构建 |
| Publish directory | **`vis2`** | ⚠️ 必填对，否则发布不到本次作业 |
| Functions directory | 留空 | 不用 |
| Environment variables | 不填 | 不需要 |

> 若页面顶部提示类似 **"We detected a monorepo" / Choose a directory**：
> 那是 Netlify 自动探测到仓库里不止一个站点，**选 `vis2`** 即可，它会把上面几项自动填好。
>
> 若它自动填的 Publish directory 是 `vis` 或 `/`，**手动改成 `vis2`**。

5. 点 **Deploy site**。

### 4.3 等部署完成

- 大约 **10~30 秒**（本次发布内容很小：20 个文件 / 约 401 KB，无构建步骤，
  其中 5 个 d3 脚本累计只有约 30 KB）。
- 完成后得到形如 `https://sparkly-otter-1a2b3c.netlify.app` 的地址；
  在站点 **Deploys** 页面可以看到这次部署日志，其中会打印发布目录：

  ```
  Publish directory: vis2
  ```

  这一行是**判断配错了没有的权威依据**——如果它显示 `vis`，说明 §3 的改动没生效（见 §6 排查）。

---

## 5. 部署后验证清单（逐项打勾）

打开新站点首页，逐项确认：

**加载与渲染**
- [ ] 标题为「人工智能 · 新质生产力｜数据可视化」，首屏 KPI 有数字滚动；
- [ ] F12 → Network 面板全部 **200**，尤其这 5 个必须来自部署站自身：
      `vendor/d3-dispatch.min.js`、`d3-selection.min.js`、`d3-quadtree.min.js`、`d3-timer.min.js`、`d3-force.min.js`；
- [ ] F12 → Console **没有红色报错**（HTTP 站点下不会有 `file://` 相关提示，正常）；
- [ ] 8 张图表都画出来了：雷达 / 折线 / 双组条形 / 气泡 / 排名 / 流向 / 关系图谱 / 时间轴。

**交互**
- [ ] 右上角 **中 / EN** 切换正常，英文模式无残留中文；
- [ ] 右上角 **亮 / 暗主题**切换，图表颜色跟随重绘；
- [ ] 第 09 节 4 个旋钮拖动 / 预设 / 重置实时联动；
- [ ] 第 08 节图谱可拖动、滚轮缩放、空白平移、双击释放；
- [ ] 第 10 节时间轴点选、第 04/05/06 节悬停读数；
- [ ] 滚动时顶栏目录高亮当前章节、「回到顶部」按钮、窄屏导航抽屉。

**「发布目录是否正确」的两个探针（很好用）**
- [ ] 访问 `https://<你的站点>/vendor/d3-force.min.js` → 应下载/显示 JS（若 404，说明发布目录没指到 vis2）；
- [ ] 访问 `https://<你的站点>/check.mjs` → 会下载到自检脚本（同理是 vis2 目录的探针）。

**移动端**
- [ ] F12 切到手机宽度（如 iPhone 14），布局不错位、图表自适应、抽屉导航可用。

---

## 6. 站点改名与可选配置

### 6.1 把随机域名改成好记的（建议做，交作业好看）

**Site configuration → Site details → Change site name** →
例如填 `ai-nqpf`，则访问地址变为 **https://ai-nqpf.netlify.app**（旧域名会 301 到新域名）。

> 建议命名：`ai-nqpf-vis2`、`nqpf-ly-beyond` 之类，避免与旧站点重名。

### 6.2 可选增强（都不是必需）

| 功能 | 在哪设置 | 有什么用 |
|---|---|---|
| **Deploy Previews** | Site configuration → Build & deploy → Deploy Previews | 以后推别的分支/提 PR 会自动生成预览站，不影响正式站 |
| **Branch deploys** | 同上 → Branches | 指定额外分支也自动部署 |
| **Rollback 回滚** | Deploys → 选一个旧部署 → **Publish deploy** | 改坏了秒回上一个版本 |
| **自定义域名 + HTTPS** | Domain management | 有域名时用；Netlify 自动签 Let's Encrypt 证书 |
| **长缓存头** | 根 `netlify.toml` 里取消注释 `[[headers]]` | 给 `vis2/vendor/*` 加 `immutable` 缓存 |

---

## 7. 以后怎么更新页面（日常流程）

> 💡 **还没定稿 / 想省额度？** 中间修改**不用 push**：本地预览（§0.5 的 ①②）就够了。
> 每次 `git push origin main` 都会触发一次部署与少量带宽/请求计量，收尾时一起推即可。

```
改代码  →  node vis2/check.mjs  →  git add/commit/push  →  Netlify 自动重新部署（约 10 秒）
```

命令速查：

```powershell
cd D:\Vis\LY-beyond.github.io
node vis2/check.mjs
git add vis2
git commit -m "更新 vis2：xxx"
git push origin main
```

> 注意：因为两个站点都监听 `main` 分支，**推 `vis2` 的改动也会触发旧站点重新部署一次**
> （旧站点内容不变，只是多跑一次部署，属正常现象；免费版额度足够）。
> 若不希望这样，可以给两个站点各配一个 `ignore` 命令，见
> <https://docs.netlify.com/build/configure-builds/ignore-builds>。

---

## 8. 备选方案（如果不想用方案 A）

### 方案 B：一个站点同时放两次作业（只维护一个 URL）

把根 `netlify.toml` 改成 `[build] publish = "."`，并在仓库根目录放一个 `index.html` 导航页
（链接到 `/vis/` 与 `/vis2/`）。

- 优点：只有一个站点、一个 URL，回顾两次作业很方便；
- 缺点：**旧作业的 URL 从根路径变成了 `/vis/`**，如果旧链接已经交上去了，根路径会变成导航页（但 `301 重定向` 可以保证旧链接仍可访问）。

### 方案 C：完全不动旧站点（零风险）

不修改仓库任何配置，直接把 `vis2` 目录**手动部署**出去，两者互不干扰：

1. **拖拽部署**：登录后打开 <https://app.netlify.com/drop>，
   把 `D:\Vis\LY-beyond.github.io\vis2` 整个文件夹拖进 Drop 区 → 立刻得到 URL。
   （缺点：不会随 Git 自动更新，适合应急演示。）
2. **CLI 手动部署**：
   ```powershell
   cd D:\Vis\LY-beyond.github.io
   npx netlify-cli deploy --prod --dir=vis2
   ```
   首次会提示登录并选择一个已有站点或新建站点；`--dir=vis2` 直接指定发布目录，绕过 `netlify.toml`。

### 方案 D：把 vis2 拆成独立仓库

新建仓库（如 `LY-beyond/ai-nqpf`），把 `vis2` 的内容推到该仓库根目录，再导入 Netlify。
新仓库没有 `netlify.toml`，UI 里 `Publish directory` 留空即可，**完全不会碰到旧站点**。
（缺点：同一份作业的代码分散在两个仓库，后续维护略麻烦。）

---

## 9. 常见问题排查表

| 现象 | 原因 | 处理 |
|---|---|---|
| 新站点打开是**上一次的作业页面** | 根 `netlify.toml` 里的 `publish = "vis"` 生效了（覆盖了 UI） | 确认 §3 的改动已提交并推送；或在 UI 把 **Base directory/Package directory** 设为 `vis2` 后重新部署。看部署日志的 `Publish directory:` |
| 打开是 **404 / Page not found** | Publish directory 填错（如填了仓库根 `/`、`./vis2/`、`vis`） | 填 **`vis2`**（相对仓库根，不加斜杠），改完 **Trigger deploy** |
| 页面能开但**图表全空白 / 图谱不动** | `vendor/` 里的 d3 文件没被发布（发布目录不是 vis2） | 访问 `/vendor/d3-force.min.js` 验证；为 404 就是发布目录错 |
| 打开的是**旧站点**的地址 | 两个站点 URL 混了 | 在 Netlify 站点列表里点开对应站点；给新站点改个好记的名字（§6.1） |
| **旧站点**突然 404 | 去掉了 `publish = "vis"` 但旧站点 UI 里没设 Publish directory | 按 §2 在旧站点 UI 里设 `Publish directory = vis` → Trigger deploy |
| 部署日志报 **Build failed / command not found** | Build command 被自动填了东西 | **清空 Build command**（本仓库无构建步骤），重新部署 |
| 推了代码但**页面没变** | 浏览器缓存 / 部署还没完成 | 看站点的 Deploys 是否 Success；`Ctrl+F5` 强刷，或开无痕窗口 |
| 想回到上一版 | —— | Deploys 列表里选旧部署 → **Publish deploy** |

---

## 10. 一句话总结

> **先在旧站点 UI 里把 Publish directory 设为 `vis` → 提交并推送仓库改动（含已去掉 `publish` 的 `netlify.toml`）→
> 新建站点从 GitHub 导入同一仓库，Publish directory 填 `vis2` → 部署 → 改个好记的站点名 → 交 URL。**

之后每次改 `vis2` 只要 `git push`，Netlify 会在十秒内自动更新线上版本。


