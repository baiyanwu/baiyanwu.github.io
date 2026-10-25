/** 语言 → 颜色，缺省用中性灰。数据里优先使用 GitHub 返回的 languageColor。 */
const LANGUAGE_COLORS: Record<string, string> = {
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Python: '#3572A5',
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Java: '#B07219',
  'C++': '#F34B7D',
  C: '#555555',
  'C#': '#178600',
  Dart: '#00B4AB',
  Ruby: '#701516',
  Shell: '#89E051',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Vue: '#41B883',
  Svelte: '#FF3E00',
  MDX: '#FCB32C',
  Lua: '#000080',
}

export function langColor(language: string | null, fallbackColor?: string | null): string {
  if (fallbackColor) return fallbackColor
  if (!language) return '#8B93A7'
  return LANGUAGE_COLORS[language] ?? '#8B93A7'
}
