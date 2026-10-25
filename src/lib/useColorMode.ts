import { useCallback, useEffect, useState } from 'react'

export type ColorMode = 'light' | 'dark'

const STORAGE_KEY = 'baiyanwu.mode'

/** 首屏模式由 index.html 里的内联脚本先写好，这里读回来，避免闪一下。 */
function readInitialMode(): ColorMode {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.dataset.mode
  if (attr === 'light' || attr === 'dark') return attr
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(readInitialMode)

  useEffect(() => {
    document.documentElement.dataset.mode = mode
    document.documentElement.style.colorScheme = mode
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#121210' : '#f6f2ea')
  }, [mode])

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ColorMode = prev === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // 隐私模式下不可写，忽略即可
      }
      return next
    })
  }, [])

  return { mode, toggle }
}
