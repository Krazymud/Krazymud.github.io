import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { stopAll, unlockAudio } from '../audio/sound'
import { Intro } from '../intro/Intro'
import { getPrefs, setPrefs, usePrefs } from '../prefs/prefs'
import { useProgress } from '../progress/ProgressProvider'
import { setIgnitionPending } from '../scene/events'
import { sceneFor } from '../scene/poses'
import { SceneHost } from '../scene/SceneHost'

const NAV = [
  { to: '/', label: '车库', end: true },
  { to: '/trial', label: '赛道试炼', end: false },
  { to: '/vault', label: '保险库', end: false },
  { to: '/settings', label: '设置', end: false },
]

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const { saveFailed } = useProgress()
  const { muted } = usePrefs()
  const scene = sceneFor(pathname)
  const [intro, setIntro] = useState(() => {
    const show = !getPrefs().introSeen && pathname === '/'
    if (show) setIgnitionPending(true)
    return show
  })

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopAll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  function toggleMute() {
    setPrefs({ muted: !muted })
    if (!muted) stopAll()
  }

  return (
    <div
      data-theme={scene === 'vault' ? 'vault' : undefined}
      onPointerDownCapture={unlockAudio}
      onClickCapture={unlockAudio}
      onKeyDownCapture={unlockAudio}
      className={
        scene === 'garage'
          ? 'relative min-h-dvh bg-ink text-fg touch-pan-y touch-pinch-zoom select-none'
          : 'relative min-h-dvh bg-ink text-fg'
      }
    >
      <SceneHost scene={scene} />
      <header inert={intro} className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4 text-xs">
        <span className="font-display tracking-[0.35em] text-accent-hi">MIDNIGHT GARAGE</span>
        <nav className="flex items-center gap-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'border-b border-accent-hi text-fg' : 'text-muted hover:text-fg')}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-label={muted ? '取消静音' : '静音'}
            aria-pressed={muted}
            onClick={toggleMute}
            className="text-muted hover:text-fg"
          >
            <SpeakerIcon muted={muted} />
          </button>
        </nav>
      </header>
      {saveFailed && (
        <p role="alert" className="relative z-10 mx-5 mt-3 border border-accent px-3 py-2 text-xs">
          进度暂时无法保存到这台设备，建议去「设置」导出进度。
        </p>
      )}
      <main inert={intro} className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-6 pb-10">
        <Outlet />
      </main>
      {intro && <Intro onDone={() => setIntro(false)} />}
    </div>
  )
}
