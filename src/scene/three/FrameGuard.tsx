import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { guardStep, initialGuard, type Quality } from '../frameGuard'
import { usePageVisible } from '../hooks'

const WARMUP_SECONDS = 2
const SAMPLE_SECONDS = 1
const MAX_FRAME_GAP = 0.5

interface FrameGuardProps {
  onQuality: (quality: Quality) => void
  onGiveUp: () => void
}

export function FrameGuard({ onQuality, onGiveUp }: FrameGuardProps) {
  const state = useRef(initialGuard)
  const frames = useRef(0)
  const elapsed = useRef(0)
  const visible = usePageVisible()

  useEffect(() => {
    frames.current = 0
    elapsed.current = 0
    state.current = { ...state.current, lowFor: 0 }
  }, [visible])

  useFrame(({ clock }, delta) => {
    if (clock.elapsedTime < WARMUP_SECONDS || delta > MAX_FRAME_GAP) {
      frames.current = 0
      elapsed.current = 0
      return
    }
    frames.current += 1
    elapsed.current += delta
    if (elapsed.current < SAMPLE_SECONDS) return
    const previous = state.current
    const next = guardStep(previous, frames.current / elapsed.current, elapsed.current)
    frames.current = 0
    elapsed.current = 0
    state.current = next
    if (next.failed && !previous.failed) onGiveUp()
    else if (next.quality !== previous.quality) onQuality(next.quality)
  })

  return null
}
