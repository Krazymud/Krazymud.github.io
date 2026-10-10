export interface Turntable {
  angle: number
  velocity: number
  dragging: boolean
  idle: number
}

export const SPIN_SPEED = (2 * Math.PI) / 40
export const RESUME_AFTER = 2
export const FRICTION = 3
export const RAD_PER_PX = 0.008
export const ALIGN_LAMBDA = 4
export const FLICK_WINDOW = 0.12
export const MIN_DRAG_DT = 0.002
export const MIN_COAST_SPEED = 0.01

export function initialTurntable(angle = 0): Turntable {
  return { angle, velocity: 0, dragging: false, idle: RESUME_AFTER }
}

export function grab(t: Turntable): Turntable {
  return { ...t, dragging: true, velocity: 0 }
}

export function dragBy(t: Turntable, dx: number, dt: number): Turntable {
  if (!t.dragging) return t
  const delta = dx * RAD_PER_PX
  return { ...t, angle: t.angle + delta, velocity: dt > 0 ? delta / Math.max(dt, MIN_DRAG_DT) : t.velocity }
}

export function release(t: Turntable, sinceLastMove: number): Turntable {
  return { ...t, dragging: false, idle: 0, velocity: sinceLastMove > FLICK_WINDOW ? 0 : t.velocity }
}

export function nearestEquivalent(angle: number, target: number): number {
  const turns = Math.round((angle - target) / (2 * Math.PI))
  return target + turns * 2 * Math.PI
}

export interface TurntableMode {
  spin: boolean
  holdYaw: number | null
}

export function stepTurntable(t: Turntable, dt: number, mode: TurntableMode): Turntable {
  if (t.dragging) return t
  const idle = t.idle + dt
  if (mode.holdYaw !== null) {
    const goal = nearestEquivalent(t.angle, mode.holdYaw)
    return { ...t, idle, velocity: 0, angle: goal + (t.angle - goal) * Math.exp(-ALIGN_LAMBDA * dt) }
  }
  const coasting = t.velocity * Math.exp(-FRICTION * dt)
  const velocity = Math.abs(coasting) < MIN_COAST_SPEED ? 0 : coasting
  const spin = mode.spin && idle >= RESUME_AFTER ? SPIN_SPEED : 0
  if (velocity === 0 && spin === 0) return { ...t, idle, velocity }
  return { ...t, idle, velocity, angle: t.angle + (velocity + spin) * dt }
}
