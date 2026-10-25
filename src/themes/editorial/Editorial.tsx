import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ThemeProps } from '../../types'
import { compactNumber, formatDate, formatStamp, fromNow, truncate } from '../../lib/format'
import { langColor } from '../../lib/langColor'
import { useColorMode } from '../../lib/useColorMode'
import './Editorial.css'

const pad2 = (value: number) => String(value).padStart(2, '0')

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.3" />
      <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6 8.8 8.8 0 1 0 20.4 14.3Z" />
    </svg>
  )
}

export default function Editorial({ data }: ThemeProps) {
  const { profile, repos } = data
  const visible = repos.filter((repo) => !repo.isPrivate)
  const name = profile.name ?? profile.login
  const { mode, toggle } = useColorMode()

  const languages = Array.from(
    new Set(
      visible
        .map((repo) => repo.language)
        .filter((language): language is string => Boolean(language)),
    ),
  ).slice(0, 4)

  const year = new Date().getFullYear()

  // 格子数量会随 pin 变化，所以量一下当前列数，让最后一格跨列把整行填满，
  // 不然 7 个格子时最后一行会留一块空白。
  const gridRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(3)

  useEffect(() => {
    const el = gridRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const measure = () => {
      const template = getComputedStyle(el).gridTemplateColumns
      const count = template.split(' ').filter(Boolean).length
      if (count > 0) setCols((prev) => (prev === count ? prev : count))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible.length])

  const cellCount = visible.length + 1
  const rest = cols > 1 ? cellCount % cols : 0
  const lastSpan = rest === 0 ? 1 : cols - rest + 1

  return (
    <main className="ed-root">
      <div className="ed-sheet">
        <header className="ed-bar">
          <span className="ed-bar__label">{name.toUpperCase()}</span>

          <div className="ed-bar__actions">
            <button
              type="button"
              className="ed-mode"
              onClick={toggle}
              aria-label={mode === 'dark' ? '切换到白天模式' : '切换到夜间模式'}
              title={mode === 'dark' ? '白天' : '夜间'}
            >
              {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <a
              className="ed-bar__link"
              href={profile.htmlUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              GITHUB
              <span className="ed-bar__arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </div>
        </header>

        <section className="ed-hero">
          <div className="ed-hero__eyebrow">
            <img
              className="ed-hero__avatar"
              src={profile.avatarUrl}
              alt={`${name} 的头像`}
              width={34}
              height={34}
              decoding="async"
            />
            <span className="ed-hero__handle">@{profile.login}</span>
          </div>

          <h1 className="ed-hero__name">{name}</h1>

          <p className="ed-hero__lede">写点小工具，改改喜欢的项目，偶尔也写字。</p>

          <hr className="ed-hero__rule" />

          <p className="ed-hero__meta">
            <span>{languages.length > 0 ? languages.join(' · ') : 'GitHub'}</span>
            <span>
              {data.liveFetchedAt ? (
                <span className="ed-hero__live" title="已读取最新一版快照" aria-hidden="true" />
              ) : null}
              更新于 {formatStamp(data.liveFetchedAt ?? data.generatedAt)}
            </span>
          </p>
        </section>

        <section className="ed-tools" aria-labelledby="ed-tools-title">
          <div className="ed-section-head">
            <h2 className="ed-section-head__title" id="ed-tools-title">
              工具与改造
            </h2>
            <span className="ed-section-head__meta">{pad2(visible.length)} 个</span>
          </div>

          {visible.length === 0 ? (
            <p className="ed-empty">还没有可以展示的东西。</p>
          ) : (
            <div className="ed-grid" ref={gridRef}>
              {visible.map((repo, index) => {
                const href = repo.siteUrl ?? repo.url

                return (
                  <a
                    className="ed-cell"
                    key={repo.nameWithOwner}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ '--i': index } as CSSProperties}
                    aria-label={`${repo.name}，${repo.description ?? '还没写简介'}`}
                  >
                    <span className="ed-cell__top">
                      <span className="ed-cell__no" aria-hidden="true">
                        {pad2(index + 1)}
                      </span>
                      <span className="ed-cell__arrow" aria-hidden="true">
                        ↗
                      </span>
                    </span>

                    <span className="ed-cell__name">{repo.name}</span>

                    <span className="ed-cell__desc">
                      {repo.description ? truncate(repo.description, 120) : '还没写简介。'}
                    </span>

                    <span className="ed-cell__meta">
                      <span className="ed-cell__lang">
                        <span
                          className="ed-cell__dot"
                          style={
                            {
                              '--dot': langColor(repo.language, repo.languageColor),
                            } as CSSProperties
                          }
                          aria-hidden="true"
                        />
                        {repo.language ?? '未标注'}
                      </span>
                      <span>★ {compactNumber(repo.stars)}</span>
                      <span title={`更新于 ${formatDate(repo.updatedAt)}`}>
                        {fromNow(repo.updatedAt)}
                      </span>
                    </span>
                  </a>
                )
              })}

              <a
                className={`ed-cell ed-cell--more${lastSpan > 1 ? ' ed-cell--wide' : ''}`}
                href={profile.htmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                style={
                  {
                    '--i': visible.length,
                    gridColumn: `span ${lastSpan}`,
                  } as CSSProperties
                }
                aria-label="在 GitHub 上查看更多"
              >
                <span className="ed-cell__top">
                  <span className="ed-cell__no" aria-hidden="true">
                    {pad2(visible.length + 1)}
                  </span>
                  <span className="ed-cell__arrow" aria-hidden="true">
                    ↗
                  </span>
                </span>
                <span className="ed-cell__name ed-cell__name--quiet">还有别的</span>
                <span className="ed-cell__desc">都在 GitHub 上。</span>
              </a>
            </div>
          )}
        </section>

        <section className="ed-writing" aria-labelledby="ed-writing-title">
          <div className="ed-section-head">
            <h2 className="ed-section-head__title" id="ed-writing-title">
              文字
            </h2>
            <span className="ed-section-head__meta">等有想说的话</span>
          </div>
          <p className="ed-quiet">还没开始写。之后会放一些记录和想法在这里。</p>
        </section>

        <footer className="ed-footer">
          <span className="ed-footer__meta">
            © {year} {name}
          </span>
          <span className="ed-footer__note">{profile.login} @ github</span>
        </footer>
      </div>
    </main>
  )
}
