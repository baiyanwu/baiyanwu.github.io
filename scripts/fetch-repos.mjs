#!/usr/bin/env node
/**
 * 从 GitHub 拉取 pinned 仓库快照，同时写入：
 *   src/data/repos.json     打包兜底
 *   public/data/repos.json  运行时读取（Action 定时覆盖它即可更新站点）
 *
 *   npm run fetch:data
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OWNER = process.env.GH_OWNER ?? 'baiyanwu'
const MAX_PINS = 6

function gh(args) {
  const out = execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(out)
}

const QUERY = `
query ($login: String!) {
  user(login: $login) {
    login
    name
    avatarUrl
    bio
    url
    followers { totalCount }
    pinnedItems(first: ${MAX_PINS}, types: [REPOSITORY]) {
      nodes {
        ... on Repository {
          name
          nameWithOwner
          url
          description
          stargazerCount
          updatedAt
          isPrivate
          primaryLanguage { name color }
        }
      }
    }
  }
}
`

/**
 * 判断某个仓库有没有 Pages 项目站，有就返回地址。
 *
 * 注意：在 Actions 里 GITHUB_TOKEN 只对当前仓库有权限，逐个去读别的仓库的
 * Pages 配置会 404，所以先用「公开仓库列表」里的 has_pages 判断（公开数据，
 * 任何 token 都能读），再尽量用 Pages API 拿真实地址（带自定义域名时更准），
 * 拿不到就退回 github.io 的约定路径。
 */
function resolveSiteUrl(meta, name) {
  if (!meta?.has_pages) return null

  try {
    const pages = gh(['api', `repos/${OWNER}/${name}/pages`])
    if (pages?.html_url) return pages.html_url
  } catch {
    // 跨仓库读 Pages 配置需要更高权限，退回约定地址
  }

  return `https://${OWNER.toLowerCase()}.github.io/${name}/`
}

console.log(`→ 读取 @${OWNER} 的 pinned 仓库…`)
const payload = gh(['api', 'graphql', '-f', `query=${QUERY}`, '-f', `login=${OWNER}`])
const user = payload?.data?.user
if (!user) {
  console.error('✗ GraphQL 没有返回用户数据：', JSON.stringify(payload, null, 2))
  process.exit(1)
}

// 一次拿全公开仓库，供 has_pages 判断用（私有仓库不在其中）
const ownedRepos = new Map()
try {
  const list = gh(['api', `users/${OWNER}/repos?per_page=100&type=owner&sort=updated`])
  for (const repo of list) ownedRepos.set(repo.name, repo)
} catch (error) {
  console.warn('! 读取公开仓库列表失败，项目站链接将全部退回仓库地址：', String(error).split('\n')[0])
}

const repos = (user.pinnedItems?.nodes ?? [])
  .filter(Boolean)
  .map((node) => {
    const meta = ownedRepos.get(node.name)
    const siteUrl = node.isPrivate ? null : resolveSiteUrl(meta, node.name)
    return {
      name: node.name,
      nameWithOwner: node.nameWithOwner,
      url: node.url,
      description: node.description ?? null,
      language: node.primaryLanguage?.name ?? null,
      languageColor: node.primaryLanguage?.color ?? null,
      stars: node.stargazerCount ?? 0,
      updatedAt: node.updatedAt,
      siteUrl,
      isPrivate: Boolean(node.isPrivate),
    }
  })

const data = {
  profile: {
    login: user.login,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl,
    bio: user.bio ?? null,
    followers: user.followers?.totalCount ?? 0,
    htmlUrl: user.url,
  },
  repos,
  generatedAt: new Date().toISOString(),
}

const json = `${JSON.stringify(data, null, 2)}\n`

/**
 * 写两份：
 *  - src/data/repos.json  打包进 JS，首屏立刻可见，离线/接口失败时兜底
 *  - public/data/repos.json 运行时由页面 fetch 读取，定时任务覆盖它即可实现「不重新构建也更新」
 */
const outputs = [
  join(ROOT, 'src', 'data', 'repos.json'),
  join(ROOT, 'public', 'data', 'repos.json'),
]

/**
 * 内容签名：不含 generatedAt，用来判断「数据本身有没有变化」。
 * 没变化就沿用旧时间戳，这样定时任务不会因为时间变了就制造一次提交。
 */
const signature = (value) => JSON.stringify({ profile: value.profile, repos: value.repos })

let previous = null
try {
  previous = JSON.parse(readFileSync(outputs[0], 'utf8'))
} catch {
  // 首次运行或文件损坏，忽略
}

if (previous?.generatedAt && signature(previous) === signature(data)) {
  data.generatedAt = previous.generatedAt
  console.log('· 数据没有变化，沿用上一版时间戳')
}

for (const file of outputs) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log(`✓ 写入 ${relative(ROOT, file)}`)
}

console.log(`  共 ${repos.length} 个仓库`)
for (const r of repos) {
  console.log(`  · ${r.nameWithOwner.padEnd(24)} ${r.siteUrl ? `站点 ${r.siteUrl}` : '仓库（无项目站）'}`)
}

/**
 * 顺手把头像同步到 public/avatar.jpg：
 * 页面和图标都用同源的这张，完全不依赖 GitHub 的 CDN（国内网络下更稳）。
 */
async function syncAvatar(url) {
  if (!url) return
  try {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}s=256`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 500) throw new Error('返回内容太小，可能不是图片')
    writeFileSync(join(ROOT, 'public', 'avatar.jpg'), buffer)
    console.log('✓ 更新 public/avatar.jpg')
  } catch (error) {
    console.warn(`! 头像下载失败，保留现有文件：${String(error).split('\n')[0]}`)
  }
}

await syncAvatar(user.avatarUrl)
