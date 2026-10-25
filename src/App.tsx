import { useEffect, useState } from 'react'
import raw from './data/repos.json'
import type { SiteData } from './types'
import { loadLiveSiteData } from './lib/live'
import Editorial from './themes/editorial/Editorial'
import './styles/global.css'

/** 打包时那一版快照：首屏立刻能画出来，也是网络失败时的兜底。 */
const bundledSite = raw as unknown as SiteData

export default function App() {
  const [site, setSite] = useState<SiteData>(bundledSite)

  // 运行时拉一次最新快照：多 pin 了仓库 / 改了描述，刷新页面就能看到。
  // 数据由 GitHub Action 定时重新生成，不需要重新构建站点。
  useEffect(() => {
    const controller = new AbortController()
    let alive = true

    loadLiveSiteData(controller.signal).then((live) => {
      if (alive && live) setSite(live)
    })

    return () => {
      alive = false
      controller.abort()
    }
  }, [])

  return <Editorial data={site} />
}
