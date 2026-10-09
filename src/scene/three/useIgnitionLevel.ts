import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { isIgnitionPending, onIgnition } from '../events'
import { ignitionLevel } from '../motion'

export function useIgnitionLevel(): { readonly current: number } {
  const clock = useThree((state) => state.clock)
  const level = useRef(isIgnitionPending() ? 0 : 1)
  const startedAt = useRef<number | null>(null)

  useEffect(
    () =>
      onIgnition(() => {
        startedAt.current = clock.elapsedTime
      }),
    [clock],
  )

  useFrame(({ clock: frameClock }) => {
    if (startedAt.current !== null) level.current = ignitionLevel(frameClock.elapsedTime - startedAt.current)
    else if (!isIgnitionPending()) level.current = 1
  })

  return level
}
