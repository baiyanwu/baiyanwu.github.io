import { useCallback, useEffect, useRef, useState } from 'react'
import raw from '../data/repos.json'
import type { SiteData } from '../types'
import { loadLiveSiteData } from './live'

/** 打包时那一版快照：首屏立刻能画出来，也是网络失败时的兜底。 */
const bundledSite = raw as unknown as SiteData

/**
 * 站点数据。
 *  - 首屏用打包进 JS 的那份，立刻可见
 *  - 挂载后再去读 `/data/repos.json`（每份部署时生成，定时任务每天更新）
 *  - refresh() 供页面上的刷新按钮调用：重新读一次最新快照
 */
export function useSiteData() {
  const [site, setSite] = useState<SiteData>(bundledSite)
  const [refreshing, setRefreshing] = useState(false)
  const [justRefreshed, setJustRefreshed] = useState(false)
  const alive = useRef(true)

  const pull = useCallback(async () => {
    const live = await loadLiveSiteData()
    if (live && alive.current) setSite(live)
    return live
  }, [])

  useEffect(() => {
    alive.current = true
    void pull()
    return () => {
      alive.current = false
    }
  }, [pull])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await pull()
      if (alive.current) {
        setJustRefreshed(true)
        window.setTimeout(() => {
          if (alive.current) setJustRefreshed(false)
        }, 1400)
      }
      // 让按钮的转动有个最小可见时长，避免一闪而过
      await new Promise((resolve) => window.setTimeout(resolve, 420))
    } finally {
      if (alive.current) setRefreshing(false)
    }
  }, [pull])

  return { site, refresh, refreshing, justRefreshed }
}
