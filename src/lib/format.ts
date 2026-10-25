/** 统一的格式化工具，三个主题共用。 */

const pad = (n: number) => String(n).padStart(2, '0')

/** 2026.10.24 */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/** 2026-10-24 */
export function formatDateDash(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 同一天显示 22:31，跨天显示 2026.10.24 —— 用于「更新于…」这类时间戳 */
export function formatStamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : formatDate(iso)
}

/** 相对时间：3 天前 / 2 个月前 */
export function fromNow(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, now - t)
  const day = 86_400_000
  if (diff < day) return '今天'
  const days = Math.floor(diff / day)
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 个月前`
  return `${Math.floor(months / 12)} 年前`
}

/** 按字符截断（中文安全），超出补省略号 */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  return chars.slice(0, max).join('').trimEnd() + '…'
}

/** star 数：1234 → 1.2k */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
}
