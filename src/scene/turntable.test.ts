import { describe, expect, it } from 'vitest'
import {
  dragBy,
  FLICK_WINDOW,
  FRICTION,
  grab,
  initialTurntable,
  MIN_DRAG_DT,
  nearestEquivalent,
  RAD_PER_PX,
  release,
  RESUME_AFTER,
  stepTurntable,
  type Turntable,
  type TurntableMode,
} from './turntable'

const SPIN: TurntableMode = { spin: true, holdYaw: null }
const STILL: TurntableMode = { spin: false, holdYaw: null }

function run(t: Turntable, seconds: number, mode: TurntableMode, dt = 0.01): Turntable {
  let state = t
  for (let i = 0; i < Math.round(seconds / dt); i++) state = stepTurntable(state, dt, mode)
  return state
}

describe('turntable', () => {
  it('spins one full turn in about 40 seconds', () => {
    expect(run(initialTurntable(), 40, SPIN).angle).toBeCloseTo(2 * Math.PI, 3)
  })

  it('stands still on the settings page', () => {
    expect(run(initialTurntable(1), 5, STILL).angle).toBe(1)
  })

  it('follows the finger while held', () => {
    let t = grab(initialTurntable())
    t = dragBy(t, 100, 0.1)
    expect(t.angle).toBeCloseTo(100 * RAD_PER_PX)
    expect(t.velocity).toBeCloseTo((100 * RAD_PER_PX) / 0.1)
    expect(run(t, 1, SPIN).angle).toBe(t.angle)
  })

  it('coasts after a flick and slows down', () => {
    const flicked = release(dragBy(grab(initialTurntable()), 100, 0.1), 0.02)
    const later = run(flicked, 1.5, STILL)
    const travelled = later.angle - flicked.angle
    expect(travelled).toBeGreaterThan(0)
    expect(travelled).toBeLessThan(flicked.velocity / FRICTION)
    expect(Math.abs(later.velocity)).toBeLessThan(flicked.velocity * 0.05)
  })

  it('coasts the other way after a flick to the left', () => {
    const flicked = release(dragBy(grab(initialTurntable()), -100, 0.1), 0.02)
    expect(flicked.velocity).toBeLessThan(0)
    expect(run(flicked, 0.5, STILL).angle).toBeLessThan(flicked.angle)
  })

  it('comes to a full stop once the coasting dies down', () => {
    const flicked = release(dragBy(grab(initialTurntable()), 100, 0.1), 0.02)
    const stopped = run(flicked, 10, STILL)
    expect(stopped.velocity).toBe(0)
    expect(stepTurntable(stopped, 0.01, STILL).angle).toBe(stopped.angle)
  })

  it('ignores drag steps when the car is not held', () => {
    const t = initialTurntable(1)
    expect(dragBy(t, 100, 0.1)).toBe(t)
  })

  it('does not spike the speed when two moves arrive almost together', () => {
    const t = dragBy(grab(initialTurntable()), 10, 0.0001)
    expect(t.angle).toBeCloseTo(10 * RAD_PER_PX)
    expect(t.velocity).toBeLessThanOrEqual((10 * RAD_PER_PX) / MIN_DRAG_DT)
  })

  it('keeps the flick when released right at the end of the flick window', () => {
    const dragged = dragBy(grab(initialTurntable()), 100, 0.1)
    expect(release(dragged, FLICK_WINDOW).velocity).toBe(dragged.velocity)
    expect(release(dragged, FLICK_WINDOW + 0.001).velocity).toBe(0)
  })

  it('does not coast when the finger rested before letting go', () => {
    const rested = release(dragBy(grab(initialTurntable()), 100, 0.1), 0.5)
    expect(rested.velocity).toBe(0)
  })

  it('waits 2 seconds after release before spinning again', () => {
    const released = release(grab(initialTurntable()), 1)
    const before = run(released, RESUME_AFTER - 0.1, SPIN)
    expect(before.angle).toBe(released.angle)
    expect(run(before, 0.5, SPIN).angle).toBeGreaterThan(released.angle)
  })

  it('turns back to the requested angle the short way', () => {
    const t = initialTurntable(2 * Math.PI + 0.3)
    expect(run(t, 3, { spin: false, holdYaw: 0 }).angle).toBeCloseTo(2 * Math.PI, 3)
  })

  it('turns back the short way from the other side too', () => {
    const t = initialTurntable(2 * Math.PI - 0.3)
    const turning = run(t, 0.1, { spin: false, holdYaw: 0 })
    expect(turning.angle).toBeGreaterThan(t.angle)
    expect(run(t, 3, { spin: false, holdYaw: 0 }).angle).toBeCloseTo(2 * Math.PI, 3)
  })

  it('finds the nearest equivalent angle', () => {
    expect(nearestEquivalent(0.2, 0)).toBe(0)
    expect(nearestEquivalent(7, 0)).toBeCloseTo(2 * Math.PI)
    expect(nearestEquivalent(-3.5, 0)).toBeCloseTo(-2 * Math.PI)
  })
})
