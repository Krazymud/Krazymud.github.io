import { describe, expect, it } from 'vitest'
import { damp, dampFactor, IGNITION_FLICKER_S, ignitionLevel, NITRO_DURATION, NITRO_OFFSET, nitroOffset, SWEEP_DURATION, SWEEP_RANGE, sweepX, TRANSITION_LAMBDA } from './motion'

describe('damp', () => {
  it('settles within 1% in about 1.2 seconds', () => {
    let value = 0
    for (let i = 0; i < 120; i++) value = damp(value, 1, TRANSITION_LAMBDA, 0.01)
    expect(value).toBeGreaterThan(0.99)
    expect(dampFactor(TRANSITION_LAMBDA, 1.2)).toBeGreaterThan(0.99)
  })

  it('does not depend on frame rate', () => {
    let fast = 0
    for (let i = 0; i < 60; i++) fast = damp(fast, 1, 4, 1 / 60)
    let slow = 0
    for (let i = 0; i < 30; i++) slow = damp(slow, 1, 4, 1 / 30)
    expect(fast).toBeCloseTo(slow, 10)
  })
})

describe('sweepX', () => {
  it('crosses the car once every 6 seconds and is gone in between', () => {
    expect(sweepX(0)).toBe(-SWEEP_RANGE)
    expect(sweepX(SWEEP_DURATION / 2)).toBeCloseTo(0)
    expect(sweepX(SWEEP_DURATION + 0.1)).toBeNull()
    expect(sweepX(6)).toBe(-SWEEP_RANGE)
    expect(sweepX(9)).toBeNull()
  })
})

describe('nitroOffset', () => {
  it('flashes and fades within 0.6 seconds', () => {
    expect(nitroOffset(0)).toBe(NITRO_OFFSET)
    expect(nitroOffset(NITRO_DURATION / 2)).toBeCloseTo(NITRO_OFFSET / 2)
    expect(nitroOffset(NITRO_DURATION)).toBe(0)
    expect(nitroOffset(-1)).toBe(0)
    expect(nitroOffset(Infinity)).toBe(0)
  })
})

describe('ignitionLevel', () => {
  it('is dark before ignition and fully on after the flicker', () => {
    expect(ignitionLevel(-1)).toBe(0)
    expect(ignitionLevel(IGNITION_FLICKER_S)).toBe(1)
    expect(ignitionLevel(10)).toBe(1)
  })

  it('flickers on twice before settling', () => {
    const samples = [0.05, 0.15, 0.27, 0.4].map(ignitionLevel)
    expect(samples).toEqual([1, 0.1, 1, 0.1])
  })

  it('ramps up steadily after the second flicker', () => {
    const ramp = [0.5, 0.6, 0.7, 0.79].map(ignitionLevel)
    for (let i = 1; i < ramp.length; i++) expect(ramp[i]).toBeGreaterThan(ramp[i - 1])
  })
})
