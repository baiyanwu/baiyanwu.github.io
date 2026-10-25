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

`.github/workflows/deploy.yml` 在 **每次 push 到 main**、**每 15 分钟**、以及手动触发时执行：

```
拉最新快照 → 有变化就提交 → 构建 → 部署到 Pages
```

页面加载时会 `fetch('/data/repos.json')`，所以多 pin 一个仓库，最多一个周期后站点自己就会多出一个格子，不需要本地重新构建。

## 页面结构

- 极简编辑风：暖白纸感 / 夜间暖黑两套配色，右上角太阳·月亮图标切换（记忆在 localStorage，首次跟随系统 `prefers-color-scheme`）
- Hero：头像、`@login`、大字名、一句话介绍、语言与更新时间
- 方格网格：每个格子是一个仓库（名称 / 简介 / 语言 / star / 更新时间），最后一格通往 GitHub；格子数不能整除列数时，最后一格自动跨列补满整行
- 「文字」区块：给以后的文章预留位置
