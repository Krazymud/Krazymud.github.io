import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AMBIENCE_REFRESH_MS, ambienceAt } from './ambience'
import { useAmbience } from './useAmbience'

describe('useAmbience', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('follows the clock minute by minute', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 10, 12, 59, 30))
    const { result } = renderHook(() => useAmbience())
    expect(result.current).toEqual(ambienceAt(new Date(2026, 9, 10, 12, 59, 30)))
    act(() => {
      vi.advanceTimersByTime(AMBIENCE_REFRESH_MS)
    })
    expect(result.current).toEqual(ambienceAt(new Date(2026, 9, 10, 13, 0, 30)))
  })

  it('lets the dev build pin the hour with ?hour=', () => {
    window.history.replaceState(null, '', '/?hour=13')
    const { result } = renderHook(() => useAmbience())
    const pinned = new Date()
    pinned.setHours(13, 0, 0, 0)
    expect(result.current).toEqual(ambienceAt(pinned))
  })
})
