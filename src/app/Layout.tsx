import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { play, stopAll, unlockAudio } from '../audio/sound'
import { perfEnabled } from '../perf/perf'
import { PerfOverlay } from '../perf/PerfOverlay'
import { setPrefs, usePrefs } from '../prefs/prefs'
import { useProgress } from '../progress/ProgressProvider'
import { copy } from '../config/copy'
import { sceneFor } from '../scene/poses'
import { SceneHost } from '../scene/SceneHost'

const NAV = [
  { to: '/', label: copy.nav.home, end: true },
  { to: '/trial', label: copy.nav.trial, end: false },
  { to: '/vault', label: copy.nav.vault, end: false },
  { to: '/settings', label: copy.nav.settings, end: false },
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

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopAll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  function toggleMute() {
    setPrefs({ muted: !muted })
    if (muted) unlockAudio()
    else stopAll()
  }

  return (
    <div
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
      <header className="glass-panel relative z-10 mx-5 mt-4 flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-xs">
        <span className="font-display text-accent-hi">{copy.siteName}</span>
        <nav className="flex items-center gap-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => void play('tap')}
              className={({ isActive }) => (isActive ? 'border-b border-accent-hi text-fg' : 'text-muted hover:text-fg')}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-label="静音"
            aria-pressed={muted}
            onClick={toggleMute}
            className="text-muted hover:text-fg"
          >
            <SpeakerIcon muted={muted} />
          </button>
        </nav>
      </header>
      {saveFailed && (
        <p role="alert" className="glass-panel relative z-10 mx-5 mt-3 rounded-lg px-3 py-2 text-xs">
          {copy.layout.progressSaveFailed}
        </p>
      )}
      <main className="glass-panel glass-panel-solid relative z-10 mx-auto mt-4 flex w-full max-w-md flex-col rounded-lg px-5 pt-6 pb-10">
        <Outlet />
      </main>
      {perfEnabled && <PerfOverlay />}
    </div>
  )
}
