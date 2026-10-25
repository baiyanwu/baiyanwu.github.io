/**
 * Cloudflare Worker：读取 @baiyanwu 的 pinned 仓库，返回和 `public/data/repos.json` 完全一致的 JSON。
 *
 * 为什么需要它：GitHub 的 pinned 列表只有 GraphQL 有，必须带令牌；令牌不能放在公开页面里，
 * 所以放在 Worker 的 secret 里，页面只拿结果。
 *
 * 路由：GET /pins
 * 环境变量：GITHUB_TOKEN（secret）、GITHUB_LOGIN、ALLOWED_ORIGINS
 */

interface Env {
  GITHUB_TOKEN: string
  GITHUB_LOGIN?: string
  ALLOWED_ORIGINS?: string
  CACHE_SECONDS?: string
}

const DEFAULT_LOGIN = 'baiyanwu'
const DEFAULT_ORIGINS = 'https://baiyanwu.github.io,https://www.baiyanwu.github.io,http://127.0.0.1:5173,http://localhost:5173'

const QUERY = `query ($login: String!) {
  user(login: $login) {
    login
    name
    avatarUrl
    bio
    url
    followers { totalCount }
    pinnedItems(first: 6, types: [REPOSITORY]) {
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
}`

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method_not_allowed' }, 405, cors)
    }

    if (url.pathname !== '/pins' && url.pathname !== '/') {
      return json({ error: 'not_found' }, 404, cors)
    }

    // 允许不带 Origin 的直接访问（curl / 调试），但不允许未授权的站点跨域读
    if (origin && !allowedOrigins(env).includes(origin)) {
      return json({ error: 'origin_not_allowed', origin }, 403, cors)
    }

    const ttl = Number(env.CACHE_SECONDS ?? '60')
    const cache = caches.default
    const cacheKey = new Request(`${url.origin}/pins?v=1`, { method: 'GET' })

    let cached = await cache.match(cacheKey)
    if (!cached) {
      try {
        const snapshot = await buildSnapshot(env)
        const fresh = new Response(JSON.stringify(snapshot), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': `public, max-age=${ttl}`,
          },
        })
        ctx.waitUntil(cache.put(cacheKey, fresh.clone()))
        cached = fresh
      } catch (error) {
        return json(
          { error: 'upstream_failed', message: error instanceof Error ? error.message : String(error) },
          502,
          cors,
        )
      }
    }

    const response = new Response(cached.body, cached)
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value)
    return response
  },
}

async function buildSnapshot(env: Env) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN 未配置')

  const login = env.GITHUB_LOGIN || DEFAULT_LOGIN
  const headers = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'user-agent': 'baiyanwu-pins-worker',
  }

  const graphqlResponse = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  })

  if (!graphqlResponse.ok) {
    throw new Error(`GraphQL ${graphqlResponse.status}: ${(await graphqlResponse.text()).slice(0, 200)}`)
  }

  const payload = (await graphqlResponse.json()) as {
    data?: { user?: GraphQLUser | null }
    errors?: Array<{ message: string }>
  }

  const user = payload.data?.user
  if (!user) throw new Error(`没有拿到 @${login} 的数据：${JSON.stringify(payload.errors ?? payload)}`)

  // 一次性拿到公开仓库列表，用它判断每个仓库有没有 Pages 项目站
  const hasPages = new Map<string, boolean>()
  try {
    const reposResponse = await fetch(
      `https://api.github.com/users/${login}/repos?per_page=100&type=owner&sort=updated`,
      { headers },
    )
    if (reposResponse.ok) {
      const list = (await reposResponse.json()) as Array<{ name: string; has_pages: boolean }>
      for (const repo of list) hasPages.set(repo.name, Boolean(repo.has_pages))
    }
  } catch {
    // 拿不到就当作都没有项目站，退回仓库地址，不影响主流程
  }

  const pins = (user.pinnedItems?.nodes ?? []).filter(Boolean).map((node) => {
    const siteUrl =
      !node.isPrivate && hasPages.get(node.name)
        ? `https://${login.toLowerCase()}.github.io/${node.name}/`
        : null

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

  return {
    profile: {
      login: user.login,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl,
      bio: user.bio ?? null,
      followers: user.followers?.totalCount ?? 0,
      htmlUrl: user.url,
    },
    repos: pins,
    generatedAt: new Date().toISOString(),
  }
}

interface GraphQLUser {
  login: string
  name: string | null
  avatarUrl: string
  bio: string | null
  url: string
  followers: { totalCount: number } | null
  pinnedItems: {
    nodes: Array<{
      name: string
      nameWithOwner: string
      url: string
      description: string | null
      stargazerCount: number
      updatedAt: string
      isPrivate: boolean
      primaryLanguage: { name: string; color: string | null } | null
    }>
  } | null
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const list = allowedOrigins(env)
  const allow = origin && list.includes(origin) ? origin : list[0]
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'content-type, accept',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}
