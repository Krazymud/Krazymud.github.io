import { describe, expect, it } from 'vitest'
import { facingFade, FRONT, lampsFor } from './lamps'

const box = { min: [-1, 0, -2] as [number, number, number], max: [1, 1.2, 2] as [number, number, number] }

describe('lampsFor', () => {
  it('puts a pair of head lamps at the front and a pair of tail lamps at the back', () => {
    const lamps = lampsFor(box)
    const heads = lamps.filter((lamp) => lamp.kind === 'head')
    const tails = lamps.filter((lamp) => lamp.kind === 'tail')
    expect(heads).toHaveLength(2)
    expect(tails).toHaveLength(2)
    for (const lamp of heads) expect(Math.sign(lamp.position[2])).toBe(FRONT)
    for (const lamp of tails) expect(Math.sign(lamp.position[2])).toBe(-FRONT)
    expect(heads[0].position[0]).toBeCloseTo(-heads[1].position[0])
    for (const lamp of lamps) {
      expect(lamp.position[1]).toBeGreaterThan(box.min[1])
      expect(lamp.position[1]).toBeLessThan(box.max[1])
    }
  })
})

describe('facingFade', () => {
  it('shows a lamp facing the camera and hides one facing away', () => {
    expect(facingFade(1)).toBe(1)
    expect(facingFade(0)).toBe(0)
    expect(facingFade(-1)).toBe(0)
    expect(facingFade(0.3)).toBeGreaterThan(0)
    expect(facingFade(0.3)).toBeLessThan(1)
  })
})
