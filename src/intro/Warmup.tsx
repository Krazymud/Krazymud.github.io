import { useEffect, useState } from 'react'
import { perfMark } from '../perf/perf'
import { useLoading } from '../scene/loading'
import { INTRO_FADE_MS, INTRO_FALLBACK_MS } from './Intro'
import { Tachometer } from './Tachometer'

export const WARMUP_GRACE_MS = 400
const TICK_MS = 50

interface WarmupProps {
  onDone: () => void
}

export function Warmup({ onDone }: WarmupProps) {
  const loading = useLoading()
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const elapsed = now - startedAt
  const loaded = loading.kind === 'still' || loading.fraction >= 1
  const ready = loaded || elapsed >= INTRO_FALLBACK_MS
  if (!loaded && ready) perfMark('预热超时，露出静态图')
  const [shown, setShown] = useState(false)
  if (!shown && !ready && elapsed >= WARMUP_GRACE_MS) setShown(true)

  useEffect(() => {
    if (ready) return
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [ready])

  useEffect(() => {
    if (!ready) return
    if (!shown) {
      onDone()
      return
    }
    const id = window.setTimeout(onDone, INTRO_FADE_MS)
    return () => window.clearTimeout(id)
  }, [ready, shown, onDone])

  if (!shown) return null
  const value = Math.min(loading.fraction, 1)
  return (
    <div
      role="status"
      aria-label="引擎预热"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink text-fg transition-opacity ease-out"
      style={{ opacity: ready ? 0 : 1, transitionDuration: `${INTRO_FADE_MS}ms` }}
    >
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">MIDNIGHT GARAGE</p>
      <div className="mt-6 text-muted">
        <Tachometer value={value} animate />
      </div>
      <p className="font-display text-lg tabular-nums">{Math.round(value * 100)}%</p>
      <div className="mt-8 flex h-32 items-center">
        <p className="text-xs text-muted">引擎预热中…</p>
      </div>
    </div>
  )
}
