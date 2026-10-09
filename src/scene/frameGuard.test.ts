import { describe, expect, it } from 'vitest'
import { dprFor, guardStep, initialGuard, MIN_FPS, type GuardState } from './frameGuard'

function feed(state: GuardState, fps: number, seconds: number): GuardState {
  let next = state
  for (let i = 0; i < seconds; i++) next = guardStep(next, fps, 1)
  return next
}

describe('frame guard', () => {
  it('keeps full quality at a healthy frame rate', () => {
    expect(feed(initialGuard, 58, 30)).toEqual(initialGuard)
  })

  it('keeps a device capped near 30 fps at full quality', () => {
    expect(feed(initialGuard, 29, 30)).toEqual(initialGuard)
  })

  it('still downgrades a steady 20 fps', () => {
    expect(feed(initialGuard, 20, 3).quality).toBe(1)
  })

  it('lowers resolution, then drops post effects, then gives up', () => {
    const lower = feed(initialGuard, 20, 3)
    expect(lower.quality).toBe(1)
    const plain = feed(lower, 20, 3)
    expect(plain.quality).toBe(2)
    expect(feed(plain, 20, 4).failed).toBe(false)
    expect(feed(plain, 20, 5).failed).toBe(true)
  })

  it('forgives a short stutter', () => {
    const stutter = feed(feed(initialGuard, 20, 2), 60, 1)
    expect(feed(stutter, 20, 2).quality).toBe(0)
  })

  it('stays failed once it has given up', () => {
    const failed: GuardState = { quality: 2, lowFor: 5, failed: true }
    expect(guardStep(failed, 60, 1)).toBe(failed)
  })

  it('counts exactly the minimum frame rate as healthy', () => {
    const slow: GuardState = { quality: 0, lowFor: 2, failed: false }
    expect(guardStep(slow, MIN_FPS, 1)).toEqual(initialGuard)
    expect(guardStep(slow, MIN_FPS - 0.1, 1).quality).toBe(1)
  })

  it('ignores samples that are not finite numbers', () => {
    const slow: GuardState = { quality: 2, lowFor: 2, failed: false }
    for (const [fps, seconds] of [[NaN, 1], [20, NaN], [Infinity, 1], [20, Infinity], [-Infinity, 1]]) {
      expect(guardStep(slow, fps, seconds)).toBe(slow)
      expect(guardStep(initialGuard, fps, seconds)).toBe(initialGuard)
    }
  })

  it('caps the pixel ratio at 1.5, then 1', () => {
    expect(dprFor(0)).toEqual([1, 1.5])
    expect(dprFor(1)).toEqual([1, 1])
    expect(dprFor(2)).toEqual([1, 1])
  })
})
