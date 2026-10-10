import { describe, expect, it } from 'vitest'
import { CALIPERS, isSwatchId, modsFor, PAINTS, RIMS } from './mods'

describe('mods', () => {
  it('starts each palette with the factory colour', () => {
    expect([PAINTS[0], RIMS[0], CALIPERS[0]].map((s) => [s.id, s.hex])).toEqual([
      ['midnight', '#090909'],
      ['gunmetal', '#b3b3b8'],
      ['red', '#9e1c22'],
    ])
  })

  it('uses unique ids and plain hex colours', () => {
    for (const list of [PAINTS, RIMS, CALIPERS]) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length)
      for (const s of list) {
        expect(s.hex).toMatch(/^#[0-9a-f]{6}$/)
        if (s.chip) expect(s.chip).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
    expect([PAINTS.length, RIMS.length, CALIPERS.length]).toEqual([8, 6, 6])
  })

  it('resolves choices and falls back to the factory colour', () => {
    expect(modsFor({ paint: 'blue', rim: 'bronze', caliper: 'gold' })).toMatchObject({
      paint: { name: '宝石蓝' },
      rim: { name: '古铜' },
      caliper: { name: '金' },
    })
    expect(modsFor({ paint: 'nope', rim: '', caliper: 'red' })).toEqual({ paint: PAINTS[0], rim: RIMS[0], caliper: CALIPERS[0] })
  })

  it('knows which ids belong to which part', () => {
    expect(isSwatchId('paint', 'pearl')).toBe(true)
    expect(isSwatchId('rim', 'pearl')).toBe(false)
    expect(isSwatchId('caliper', 3)).toBe(false)
  })
})
