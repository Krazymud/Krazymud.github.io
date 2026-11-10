import { describe, expect, it } from 'vitest'
import { anchorForFocus, fitDistance, FOCUS_IDS, layoutForAspect, type Anchor } from './cameraFocus'

const PORTRAIT = 390 / 844
const LANDSCAPE = 16 / 9

function dist(a: Anchor) {
  return Math.hypot(...a.position.map((v, i) => v - a.target[i]))
}

describe('anchorForFocus', () => {
  it('desk is above the table', () => {
    expect(anchorForFocus('desk').position[1]).toBeGreaterThan(0)
  })
  it('props have distinct anchors', () => {
    expect(anchorForFocus('envelope')).not.toEqual(anchorForFocus('rolls'))
  })
  it('keeps the original landscape desk framing', () => {
    expect(anchorForFocus('desk', LANDSCAPE)).toEqual({ position: [0, 3.2, 4.6], target: [0, 0.3, 0] })
  })
})

describe('portrait framing', () => {
  it('uses a stacked layout on a tall screen and the wide row otherwise', () => {
    expect(layoutForAspect(PORTRAIT).portrait).toBe(true)
    expect(layoutForAspect(LANDSCAPE).portrait).toBe(false)
    const { props } = layoutForAspect(PORTRAIT)
    expect(Math.max(...Object.values(props).map((p) => Math.abs(p[0])))).toBeLessThan(1.5)
  })

  it('pulls the desk camera back so the full prop span fits a 390x844 viewport', () => {
    const portrait = anchorForFocus('desk', PORTRAIT)
    const landscape = anchorForFocus('desk', LANDSCAPE)
    expect(portrait.position[2]).not.toBe(landscape.position[2])
    expect(dist(portrait)).toBeGreaterThan(dist(landscape))
    expect(dist(portrait)).toBeGreaterThanOrEqual(fitDistance(layoutForAspect(PORTRAIT).halfWidth, PORTRAIT) - 1e-9)
  })

  it('keeps every prop inside the horizontal view in portrait', () => {
    const { props } = layoutForAspect(PORTRAIT)
    const desk = anchorForFocus('desk', PORTRAIT)
    const halfVisible = dist(desk) * Math.tan((25 * Math.PI) / 180) * PORTRAIT
    for (const [id, pos] of Object.entries(props)) {
      expect(Math.abs(pos[0]) + 0.35, id).toBeLessThan(halfVisible)
    }
  })

  it('every focus anchor is finite and close-ups also fit a portrait width', () => {
    for (const id of FOCUS_IDS) {
      const a = anchorForFocus(id, PORTRAIT)
      expect([...a.position, ...a.target].every(Number.isFinite)).toBe(true)
    }
    expect(dist(anchorForFocus('tray', PORTRAIT))).toBeGreaterThan(dist(anchorForFocus('tray', LANDSCAPE)))
  })
})
