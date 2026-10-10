import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MAX_WAIT_MS, STALL_MS, usePatience } from './patience'

function wait(fraction: number, now: number) {
  return { fraction, now }
}

describe('usePatience', () => {
  it('keeps waiting while the progress keeps moving', () => {
    const { result, rerender } = renderHook(({ fraction, now }) => usePatience(fraction, 0, now), { initialProps: wait(0, 0) })
    for (let now = 1000; now < MAX_WAIT_MS; now += STALL_MS - 1000) {
      rerender(wait(now / MAX_WAIT_MS, now))
      expect(result.current).toBe(false)
    }
  })

  it('gives up once the progress has stalled', () => {
    const { result, rerender } = renderHook(({ fraction, now }) => usePatience(fraction, 0, now), { initialProps: wait(0, 0) })
    rerender(wait(0.4, 5000))
    rerender(wait(0.4, 5000 + STALL_MS - 1))
    expect(result.current).toBe(false)
    rerender(wait(0.4, 5000 + STALL_MS))
    expect(result.current).toBe(true)
  })

  it('gives up after the longest wait even while moving', () => {
    const { result, rerender } = renderHook(({ fraction, now }) => usePatience(fraction, 0, now), { initialProps: wait(0, 0) })
    rerender(wait(0.5, MAX_WAIT_MS - 1))
    expect(result.current).toBe(false)
    rerender(wait(0.6, MAX_WAIT_MS))
    expect(result.current).toBe(true)
  })
})
