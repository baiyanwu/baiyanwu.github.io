import type { SiteData } from '../types'

/**
 * Cloudflare Worker 地址：如果配置了，就用它实时读取 pinned 仓库
 * （增删 pin、改描述、涨 star 都会立刻反映）。
 *
 * 部署 Worker 后把地址填在这里，或者用构建变量 `VITE_PINS_ENDPOINT` 覆盖。
 * 留空则退回静态快照（构建时生成的那份）。
 */
const WORKER_ENDPOINT: string =
  (import.meta.env.VITE_PINS_ENDPOINT as string | undefined)?.trim() ||
  'https://baiyanwu-pins.baiyanwuxu.workers.dev/pins'

/** 8 秒拿不到就放弃，避免按钮一直转圈 */
const REQUEST_TIMEOUT = 8000

/**
 * 读取最新数据，按优先级依次尝试：
 *   1. Cloudflare Worker（实时，能反映 pin 增删）
 *   2. `/data/repos.json`（部署时生成的静态快照）
 *   3. 返回 null，页面继续用打包进 JS 的那份
 */
export async function loadLiveSiteData(signal?: AbortSignal): Promise<SiteData | null> {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const candidates = [
    WORKER_ENDPOINT ? `${WORKER_ENDPOINT}?ts=${Date.now()}` : '',
    `${base}/data/repos.json?ts=${Date.now()}`,
  ].filter(Boolean)

  for (const url of candidates) {
    const data = await tryLoad(url, signal)
    if (data) return { ...data, liveFetchedAt: data.generatedAt }
  }

  return null
}

async function tryLoad(url: string, signal?: AbortSignal): Promise<SiteData | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: withTimeout(signal),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null

    const data: unknown = await res.json()
    return isSiteData(data) ? data : null
  } catch {
    return null
  }
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT)
  if (!signal) return timeout
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal
}

function isSiteData(value: unknown): value is SiteData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Partial<SiteData>
  return (
    typeof data.generatedAt === 'string' &&
    typeof data.profile === 'object' &&
    data.profile !== null &&
    typeof data.profile.login === 'string' &&
    Array.isArray(data.repos) &&
    data.repos.every(
      (repo) =>
        typeof repo === 'object' &&
        repo !== null &&
        typeof repo.name === 'string' &&
        typeof repo.url === 'string',
    )
  )
}
