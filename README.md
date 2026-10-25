# baiyanwu.github.io

个人主站 · <https://baiyanwu.github.io/>

## 技术栈

- **Vite 6 + React 19 + TypeScript**，纯静态，没有后端
- 部署：GitHub Actions 构建 → GitHub Pages
- 数据：构建/定时任务时从 GitHub 读取账号下 pinned 的仓库

## 本地开发

```bash
npm install
npm run fetch:data   # 从 GitHub 拉最新快照（需要本机已登录的 gh）
npm run dev          # http://127.0.0.1:5173
npm run build        # 产物在 dist/
```

## 数据是怎么来的

`scripts/fetch-repos.mjs` 用 `gh` 读该账号 pinned 的仓库，以及每个仓库有没有 Pages 项目站，然后写两份：

| 文件 | 用途 |
|---|---|
| `src/data/repos.json` | 打包进 JS，首屏立刻可见，也是网络失败时的兜底 |
| `public/data/repos.json` | 运行时由页面 fetch 读取，定时任务覆盖它即可更新站点 |

`.github/workflows/deploy.yml` 在 **每次 push 到 main**、**每天 08:00（北京时间）**、以及手动触发时执行：

```
拉最新快照 → 数据有变化才提交 → 构建 → 部署到 Pages
```

快照的时间戳只在数据真的变化时才更新，所以定时任务不会制造空提交。

页面加载时会 `fetch('/data/repos.json')`；右上角的刷新按钮可以立即重新读一次最新快照（不用刷新整个页面）。注意：静态页面**无法**自己去 GitHub 读取 pinned 列表（需要 token），要立刻让 GitHub 重新抓一次，请到 [Actions](https://github.com/baiyanwu/baiyanwu.github.io/actions/workflows/deploy.yml) 点「Run workflow」。

## 刷新按钮背后的 Cloudflare Worker

右上角的刷新按钮优先调用 Worker，由它带着只读令牌去读 GitHub 的 pinned 列表，所以**增删 pin 后点一下就能立刻看到**；Worker 不可用时自动退回 `/data/repos.json` 静态快照，再不行用打包进 JS 的那份。

| 项 | 值 |
|---|---|
| 地址 | `https://baiyanwu-pins.baiyanwuxu.workers.dev/pins` |
| 源码 | `workers/pins/`（约 190 行，返回结构与 `repos.json` 完全一致） |
| 缓存 | 60 秒（`CACHE_SECONDS`） |
| 跨域 | 只放行 `baiyanwu.github.io` 与本地开发地址 |
| 令牌 | Cloudflare secret `GITHUB_TOKEN`，细粒度 PAT，仅 *Public repositories (read-only)* + Pages read |

本地部署 / 更新 Worker：

```bash
cd workers/pins
npm install                 # 首次
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN   # 轮换令牌时
```

## 页面结构

- 极简编辑风：暖白纸感 / 夜间暖黑两套配色，右上角太阳·月亮图标切换（记忆在 localStorage，首次跟随系统 `prefers-color-scheme`）
- 右上角还有一个刷新图标：调用 Worker 实时读取 pinned 列表，读取时图标转圈
- Hero：头像、`@login`、大字名、一句话介绍、语言与更新时间；头像加载失败会退回仓库内的 `public/avatar.jpg`，再失败显示首字母
- 方格网格：每个格子是一个仓库（名称 / 简介 / 语言 / star / 更新时间），最后一格通往 GitHub；格子数不能整除列数时，最后一格自动跨列补满整行
- 「文字」区块：给以后的文章预留位置
