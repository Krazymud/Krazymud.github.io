import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '../progress/store'
import { DEFAULT_PREFS, getPrefs, PREFS_KEY, readPrefs, resetPrefsCache, setPrefs, usePrefs } from './prefs'

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
  })
  afterEach(() => vi.restoreAllMocks())

  it('defaults to scene3d: true, muted: false and introSeen: false', () => {
    expect(getPrefs()).toEqual({ scene3d: true, muted: false, introSeen: false })
  })

  it('saves the switch apart from the progress data', () => {
    localStorage.setItem(STORAGE_KEY, '{"version":1}')
    setPrefs({ scene3d: false })
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false, muted: false, introSeen: false })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"version":1}')
    resetPrefsCache()
    expect(getPrefs().scene3d).toBe(false)
  })

  it('ignores damaged values', () => {
    localStorage.setItem(PREFS_KEY, '{oops')
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
    localStorage.setItem(PREFS_KEY, '{"scene3d":"no"}')
    expect(readPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('falls back to the defaults when the stored value is not an object', () => {
    for (const raw of ['5', 'null', '[]', '"scene3d"']) {
      localStorage.setItem(PREFS_KEY, raw)
      expect(readPrefs()).toEqual(DEFAULT_PREFS)
    }
  })

  it('does not store undefined fields', () => {
    setPrefs({ scene3d: false })
    setPrefs({ scene3d: undefined, muted: true })
    expect(getPrefs()).toEqual({ scene3d: false, muted: true, introSeen: false })
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ scene3d: false, muted: true, introSeen: false })
  })

  it('does not notify hook users when nothing changes', () => {
    let renders = 0
    renderHook(() => {
      renders++
      return usePrefs()
    })
    const before = renders
    act(() => setPrefs({ scene3d: true }))
    act(() => setPrefs({}))
    expect(renders).toBe(before)
  })

  it('checks each field on its own', () => {
    localStorage.setItem(PREFS_KEY, '{"scene3d":false,"muted":"yes","introSeen":1}')
    expect(readPrefs()).toEqual({ scene3d: false, muted: false, introSeen: false })
    localStorage.setItem(PREFS_KEY, '{"muted":true,"introSeen":true}')
    expect(readPrefs()).toEqual({ scene3d: true, muted: true, introSeen: true })
  })

  it('still works for this visit when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getPrefs()).toEqual(DEFAULT_PREFS)
    setPrefs({ scene3d: false })
    expect(getPrefs().scene3d).toBe(false)
  })

  it('re-renders hook users when the switch changes', () => {
    const { result } = renderHook(() => usePrefs())
    expect(result.current.scene3d).toBe(true)
    act(() => setPrefs({ scene3d: false }))
    expect(result.current.scene3d).toBe(false)
  })
})
