/**
 * 本地视觉验收工具（dev only）：
 * 用本机 Chrome 打开 dev server，输出白天/夜间 × 桌面/手机的整页截图 + 溢出诊断。
 *   node scripts/dev-shots.mjs
 */
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(process.cwd())
const OUT = join(ROOT, '.cache', 'shots')
mkdirSync(OUT, { recursive: true })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:5173'
const MODES = ['light', 'dark']
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 430, height: 932 },
]

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-breakpad'],
})

const report = {}

for (const mode of MODES) {
  report[mode] = {}
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage()
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: mode }])
    await page.goto(BASE, { waitUntil: 'networkidle0' })
    await new Promise((r) => setTimeout(r, 1200))

    const diag = await page.evaluate(() => {
      const doc = document.documentElement
      const vw = doc.clientWidth
      const offenders = []
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right > vw + 1 || r.left < -1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && String(el.className).slice(0, 60)) || '',
            right: Math.round(r.right),
          })
        }
      }
      return {
        mode: doc.dataset.mode ?? null,
        scrollWidth: doc.scrollWidth,
        clientWidth: vw,
        scrollHeight: doc.scrollHeight,
        overflowX: doc.scrollWidth > vw,
        offenders: offenders.slice(0, 5),
        liveDot: Boolean(document.querySelector('.ed-hero__live')),
        h1: document.querySelectorAll('h1').length,
        nestedAnchors: document.querySelectorAll('a a').length,
        modeButtonLabel: document.querySelector('.ed-mode')?.getAttribute('aria-label') ?? null,
      }
    })

    await page.screenshot({ path: join(OUT, `editorial-${mode}-${vp.name}.png`), fullPage: true })
    report[mode][vp.name] = diag
    await page.close()
  }
}

await browser.close()
console.log(JSON.stringify(report, null, 2))
