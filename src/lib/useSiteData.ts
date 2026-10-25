import { useEffect, useRef, useState } from 'react'
import raw from '../data/repos.json'
import type { SiteData } from '../types'
import { loadLiveSiteData } from './live'

/** 打包时那一版快照：首屏立刻能画出来，也是网络失败时的兜底。 */
const bundledSite = raw as unknown as SiteData

/**
 * 站点数据。
 *  - 首屏用打包进 JS 的那份，立刻可见
 *  - 挂载后自动去读一次最新数据（Cloudflare Worker 优先，取不到退回静态快照）
 */
export function useSiteData() {
  const [site, setSite] = useState<SiteData>(bundledSite)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true

    loadLiveSiteData().then((live) => {
      if (live && alive.current) setSite(live)
    })

    return () => {
      alive.current = false
    }
  }, [])

  return { site }
}
