export type Quality = 0 | 1 | 2

export interface GuardState {
  quality: Quality
  lowFor: number
  failed: boolean
}

export const MIN_FPS = 30
export const DOWNGRADE_AFTER = 3
export const GIVE_UP_AFTER = 5

export const initialGuard: GuardState = { quality: 0, lowFor: 0, failed: false }

export function guardStep(state: GuardState, fps: number, seconds: number): GuardState {
  if (state.failed) return state
  if (fps >= MIN_FPS) return state.lowFor === 0 ? state : { ...state, lowFor: 0 }
  const lowFor = state.lowFor + seconds
  if (state.quality < 2) {
    if (lowFor < DOWNGRADE_AFTER) return { ...state, lowFor }
    return { quality: (state.quality + 1) as Quality, lowFor: 0, failed: false }
  }
  return { ...state, lowFor, failed: lowFor >= GIVE_UP_AFTER }
}

export function dprFor(quality: Quality): [number, number] {
  return quality === 0 ? [1, 1.5] : [1, 1]
}
