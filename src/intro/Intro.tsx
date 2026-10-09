import { useEffect, useState } from 'react'
import { play, unlockAudio } from '../audio/sound'
import { setPrefs } from '../prefs/prefs'
import { emitIgnition } from '../scene/events'
import { usePrefersReducedMotion } from '../scene/hooks'
import { useLoading } from '../scene/loading'
import { Tachometer } from './Tachometer'

export const INTRO_MIN_MS = 1500
export const INTRO_FALLBACK_MS = 8000
export const STILL_FILL_MS = 1200
export const INTRO_FADE_MS = 600
const TICK_MS = 50

interface IntroProps {
  onDone: () => void
}

export function Intro({ onDone }: IntroProps) {
  const loading = useLoading()
  const reduced = usePrefersReducedMotion()
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = now - startedAt
  const value = loading.kind === 'still' ? (reduced ? 1 : Math.min(1, elapsed / STILL_FILL_MS)) : loading.fraction
  const canIgnite = (value >= 1 && elapsed >= INTRO_MIN_MS) || elapsed >= INTRO_FALLBACK_MS

  function ignite() {
    if (leaving) return
    setLeaving(true)
    unlockAudio()
    void play('ignition')
    emitIgnition()
    setPrefs({ introSeen: true })
    window.setTimeout(onDone, reduced ? 0 : INTRO_FADE_MS)
  }

  return (
    <div
      role="dialog"
      aria-label="点火开场"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink text-fg transition-opacity ease-out"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: reduced ? '0ms' : `${INTRO_FADE_MS}ms` }}
    >
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">MIDNIGHT GARAGE</p>
      <div className="mt-6 text-muted">
        <Tachometer value={value} animate={!reduced} />
      </div>
      <p className="font-display text-lg tabular-nums">{Math.round(Math.min(value, 1) * 100)}%</p>
      <div className="mt-8 flex h-32 items-center">
        {canIgnite ? (
          <button
            type="button"
            onClick={ignite}
            disabled={leaving}
            className="flex h-28 w-28 items-center justify-center rounded-full border border-accent-hi bg-accent/20 font-display text-lg tracking-[0.3em]"
          >
            点火
          </button>
        ) : (
          <p className="text-xs text-muted">引擎预热中…</p>
        )}
      </div>
    </div>
  )
}
