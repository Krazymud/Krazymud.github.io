import { useCallback, useEffect, useState } from 'react'
import { createWordSource, type WordSource } from './wordsRepo'

export type WordSourceState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; source: WordSource }

export function useWordSource(): { state: WordSourceState; retry: () => void } {
  const [state, setState] = useState<WordSourceState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    createWordSource().then(
      (source) => alive && setState({ status: 'ready', source }),
      () => alive && setState({ status: 'error' }),
    )
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
