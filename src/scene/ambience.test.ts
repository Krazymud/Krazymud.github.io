import { describe, expect, it } from 'vitest'
import { ambienceAt, NIGHT } from './ambience'

const at = (hour: number, minute = 0) => ambienceAt(new Date(2026, 9, 10, hour, minute))

describe('ambienceAt', () => {
  it('is the current look at 2 am', () => {
    expect(at(2)).toEqual(NIGHT)
    expect(NIGHT).toEqual({ key: '#9e1c22', keyScale: 1, env: 1, strips: 1, tint: '#000000', tintAlpha: 0 })
  })

  it('hits each key moment exactly', () => {
    expect(at(7)).toMatchObject({ key: '#d2643a', keyScale: 1.35, env: 1.5, strips: 0.55, tint: '#ff9a55', tintAlpha: 0.14 })
    expect(at(13)).toMatchObject({ key: '#e2b49c', keyScale: 1.7, env: 2, strips: 0.3, tint: '#fff2e0', tintAlpha: 0.16 })
    expect(at(19)).toMatchObject({ key: '#cc4a1c', keyScale: 1.3, env: 1.3, strips: 0.8, tint: '#ffb347', tintAlpha: 0.14 })
  })

  it('blends halfway between key moments', () => {
    const mid = at(10)
    expect(mid.keyScale).toBeCloseTo(1.525)
    expect(mid.env).toBeCloseTo(1.75)
    expect(mid.strips).toBeCloseTo(0.425)
  })

  it('wraps from dusk through midnight to deep night', () => {
    expect(at(22, 30).strips).toBeCloseTo(0.8 + (1 - 0.8) * 0.5)
    expect(at(0, 45).strips).toBeCloseTo(0.8 + (1 - 0.8) * (5.75 / 7))
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
