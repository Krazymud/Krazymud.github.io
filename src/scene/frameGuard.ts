export type Quality = 0 | 1 | 2

export interface GuardState {
  quality: Quality
  lowFor: number
  highFor: number
  failed: boolean
  upgradeLocked: boolean
}

export const MIN_FPS = 24
export const DOWNGRADE_AFTER = 3
export const GIVE_UP_AFTER = 5
export const UPGRADE_FPS = 50
export const UPGRADE_AFTER = 5

export function guardFrom(quality: Quality): GuardState {
  return { quality, lowFor: 0, highFor: 0, failed: false, upgradeLocked: false }
}

export const initialGuard: GuardState = guardFrom(0)

export function startQuality(coarsePointer: boolean): Quality {
  return coarsePointer ? 1 : 0
}

// 降过一次档就不再升档，免得在两档之间来回切换。
export function guardStep(state: GuardState, fps: number, seconds: number): GuardState {
  if (state.failed || !Number.isFinite(fps) || !Number.isFinite(seconds)) return state
  if (fps >= MIN_FPS) {
    if (state.quality === 0 || state.upgradeLocked) {
      return state.lowFor === 0 && state.highFor === 0 ? state : { ...state, lowFor: 0, highFor: 0 }
    }
    const highFor = fps >= UPGRADE_FPS ? state.highFor + seconds : 0
    if (highFor >= UPGRADE_AFTER) return { ...state, quality: (state.quality - 1) as Quality, lowFor: 0, highFor: 0 }
    return { ...state, lowFor: 0, highFor }
  }
  const lowFor = state.lowFor + seconds
  if (state.quality < 2) {
    if (lowFor < DOWNGRADE_AFTER) return { ...state, lowFor, highFor: 0 }
    return { ...state, quality: (state.quality + 1) as Quality, lowFor: 0, highFor: 0, upgradeLocked: true }
  }
  return { ...state, lowFor, highFor: 0, failed: lowFor >= GIVE_UP_AFTER }
}

export function dprFor(quality: Quality): [number, number] {
  return quality === 0 ? [1, 1.5] : [1, 1]
}
