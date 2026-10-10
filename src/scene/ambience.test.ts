import { describe, expect, it } from 'vitest'
import { ambienceAt, NIGHT } from './ambience'

const at = (hour: number, minute = 0) => ambienceAt(new Date(2026, 9, 10, hour, minute))

describe('ambienceAt', () => {
  it('is the current look at 2 am', () => {
    expect(at(2)).toEqual(NIGHT)
    expect(NIGHT).toEqual({ key: '#9e1c22', keyScale: 1, env: 1, strips: 1, tint: '#000000', tintAlpha: 0 })
  })

  it('hits each key moment exactly', () => {
    expect(at(7)).toMatchObject({ key: '#b4442a', keyScale: 1.1, env: 1.15, strips: 0.7, tintAlpha: 0.1 })
    expect(at(13)).toMatchObject({ key: '#b85a4e', keyScale: 1.3, env: 1.4, strips: 0.45, tintAlpha: 0.12 })
    expect(at(19)).toMatchObject({ key: '#a8361f', keyScale: 1.1, env: 1.1, strips: 0.85, tintAlpha: 0.1 })
  })

  it('blends halfway between key moments', () => {
    const mid = at(10)
    expect(mid.keyScale).toBeCloseTo(1.2)
    expect(mid.env).toBeCloseTo(1.275)
    expect(mid.strips).toBeCloseTo(0.575)
  })

  it('wraps from dusk through midnight to deep night', () => {
    expect(at(22, 30).strips).toBeCloseTo(0.85 + (1 - 0.85) * 0.5)
    expect(at(0, 45).strips).toBeCloseTo(0.85 + (1 - 0.85) * (5.75 / 7))
  })

  it('blends colours smoothly', () => {
    const colours = [at(2, 30), at(4), at(5, 30)].map((a) => a.key)
    expect(new Set(colours).size).toBe(3)
    for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('stays finite all day', () => {
    for (let minute = 0; minute < 24 * 60; minute += 17) {
      const a = at(0, minute)
      expect([a.keyScale, a.env, a.strips, a.tintAlpha].every(Number.isFinite)).toBe(true)
    }
  })
})
