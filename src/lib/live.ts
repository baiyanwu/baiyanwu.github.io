import type { SiteData } from '../types'

/**
 * 运行时读取「最新一版快照」。
 *
 * 数据由 GitHub Action 定时重新生成并提交到 `public/data/repos.json`，
 * 页面每次加载都用 no-store 去取，因此不需要重新构建就能看到新 pin / 新描述。
 * 取不到（离线、404、数据格式不对）就返回 null，页面继续用打包进去的那份兜底。
 */
export async function loadLiveSiteData(signal?: AbortSignal): Promise<SiteData | null> {
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base.replace(/\/$/, '')}/data/repos.json?ts=${Date.now()}`

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null

    const data: unknown = await res.json()
    if (!isSiteData(data)) return null

    // 读到就采用：即使内容与打包版本一致，也把 liveFetchedAt 记下来，
    // 页面才好显示「这份数据是刚读到的」。
    return { ...data, liveFetchedAt: data.generatedAt }
  } catch {
    return null
  }
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
