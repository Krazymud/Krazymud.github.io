import { useEffect, useState } from 'react'
import { AMBIENCE_REFRESH_MS, ambienceAt, type Ambience } from './ambience'

function now(): Date {
  const date = new Date()
  if (import.meta.env.DEV) {
    const hour = Number(new URLSearchParams(window.location.search).get('hour'))
    if (new URLSearchParams(window.location.search).has('hour') && hour >= 0 && hour < 24) date.setHours(hour, 0, 0, 0)
  }
  return date
}

export function useAmbience(): Ambience {
  const [ambience, setAmbience] = useState(() => ambienceAt(now()))
  useEffect(() => {
    const id = window.setInterval(
      () =>
        setAmbience((prev) => {
          const next = ambienceAt(now())
          return (Object.keys(next) as (keyof Ambience)[]).every((k) => next[k] === prev[k]) ? prev : next
        }),
      AMBIENCE_REFRESH_MS,
    )
    return () => window.clearInterval(id)
  }, [])
  return ambience
}
