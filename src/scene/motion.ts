export const TRANSITION_LAMBDA = 4

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}

export function dampFactor(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt)
}

export const SWEEP_PERIOD = 6
export const SWEEP_DURATION = 1.5
export const SWEEP_RANGE = 9
export const STILL_SWEEP_X = 1.2

export function sweepX(time: number): number | null {
  const phase = ((time % SWEEP_PERIOD) + SWEEP_PERIOD) % SWEEP_PERIOD
  if (phase >= SWEEP_DURATION) return null
  return -SWEEP_RANGE + (2 * SWEEP_RANGE * phase) / SWEEP_DURATION
}

export const NITRO_DURATION = 0.6
export const NITRO_OFFSET = 0.006

export function nitroOffset(elapsed: number): number {
  if (!(elapsed >= 0 && elapsed < NITRO_DURATION)) return 0
  return NITRO_OFFSET * (1 - elapsed / NITRO_DURATION)
}

export const TRACK_SPEED = 1.2
export const WHEEL_SPEED = 20
