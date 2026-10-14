import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getPrefs, readPrefs, resetPrefsCache, setPrefs, usePrefs } from './prefs'
import { PREFS_KEY } from './key'

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
  })

  it('defaults to unmuted', () => {
    expect(getPrefs()).toEqual({ muted: false })
  })

  it('persists muted and ignores unknown legacy keys', () => {
    setPrefs({ muted: true })
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ muted: true })
    expect(getPrefs().muted).toBe(true)
    localStorage.setItem(PREFS_KEY, '{"muted":true,"scene3d":false,"paint":"pearl"}')
    resetPrefsCache()
    expect(readPrefs()).toEqual({ muted: true })
  })

  it('falls back when storage is corrupt', () => {
    for (const raw of ['5', 'null', '[]', '"muted"']) {
      localStorage.setItem(PREFS_KEY, raw)
      resetPrefsCache()
      expect(readPrefs()).toEqual({ muted: false })
    }
  })

  it('usePrefs updates when prefs change', () => {
    const { result } = renderHook(() => usePrefs())
    expect(result.current.muted).toBe(false)
    act(() => setPrefs({ muted: true }))
    expect(result.current.muted).toBe(true)
  })
})
