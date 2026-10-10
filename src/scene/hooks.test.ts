import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePageVisible, usePrefersReducedMotion } from './hooks'

function fakeQuery(matches: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    matches,
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    change(next: boolean) {
      query.matches = next
      listeners.forEach((listener) => listener())
    },
    listeners,
  }
  return query
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is false when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false)
  })

  it('follows the system setting', () => {
    const query = { ...fakeQuery(false), addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.stubGlobal('matchMedia', () => query)
    const { result, unmount } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
    expect(query.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    const listener = query.addEventListener.mock.calls[0][1] as () => void
    act(() => {
      query.matches = true
      listener()
    })
    expect(result.current).toBe(true)
    unmount()
    expect(query.removeEventListener).toHaveBeenCalledWith('change', listener)
  })

  it('falls back to addListener on older browsers', () => {
    const query = fakeQuery(false)
    vi.stubGlobal('matchMedia', () => query)
    const { result, unmount } = renderHook(() => usePrefersReducedMotion())
    act(() => query.change(true))
    expect(result.current).toBe(true)
    unmount()
    expect(query.listeners.size).toBe(0)
  })
})

describe('usePageVisible', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('follows the page visibility', () => {
    const { result } = renderHook(() => usePageVisible())
    expect(result.current).toBe(true)
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(false)
  })
})
