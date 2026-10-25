/** 全部主题共享的数据契约。由 `npm run fetch:data` 生成 `src/data/repos.json`。 */

export interface RepoEntry {
  /** 仓库名，例如 "CoinMonitor" */
  name: string
  /** 完整名，例如 "baiyanwu/CoinMonitor" */
  nameWithOwner: string
  /** GitHub 仓库地址 */
  url: string
  /** 仓库简介，可能为 null */
  description: string | null
  /** 主语言，可能为 null */
  language: string | null
  /** 主语言颜色（来自 GitHub），可能为 null */
  languageColor: string | null
  /** star 数 */
  stars: number
  /** 最近更新时间，ISO 字符串 */
  updatedAt: string
  /** 项目站地址；没有项目站时为 null */
  siteUrl: string | null
  /** 是否为私有仓库 */
  isPrivate: boolean
}

export interface Profile {
  login: string
  name: string | null
  avatarUrl: string
  bio: string | null
  followers: number
  htmlUrl: string
}

export interface SiteData {
  profile: Profile
  repos: RepoEntry[]
  /** 数据生成时间，ISO 字符串 */
  generatedAt: string
  /**
   * 运行时从 `/data/repos.json` 读到新快照时的时间戳。
   * 存在即表示页面用的是「构建后更新过」的数据，而不是打包进去的那份。
   */
  liveFetchedAt?: string
}

/** 每个主题组件都接收同样的 props。 */
export interface ThemeProps {
  data: SiteData
}
