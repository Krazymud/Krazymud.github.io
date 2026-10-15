import { describe, expect, it } from 'vitest'
import { applyPan, applyPinch, clampScale, resetZoom } from './photoZoom'

describe('photoZoom', () => {
  it('clamps scale between 1 and 4', () => {
    expect(clampScale(0.5)).toBe(1)
    expect(clampScale(9)).toBe(4)
  })
  it('resets to identity', () => {
    expect(resetZoom()).toEqual({ scale: 1, x: 0, y: 0 })
  })
  it('scales from pinch distances', () => {
    const next = applyPinch({ scale: 1, x: 0, y: 0 }, 100, 200, 1)
    expect(next.scale).toBe(2)
  })
  it('pans only when scaled', () => {
    expect(applyPan({ scale: 1, x: 0, y: 0 }, 10, 10)).toEqual({ scale: 1, x: 0, y: 0 })
    expect(applyPan({ scale: 2, x: 0, y: 0 }, 10, -5)).toEqual({ scale: 2, x: 10, y: -5 })
  })
})
