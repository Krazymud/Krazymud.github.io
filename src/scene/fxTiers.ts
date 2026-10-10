import type { Quality } from './frameGuard'

export interface Fx {
  postFx: boolean
  grade: boolean
  lampGlow: boolean
  atmosphere: boolean
  reflection: 512 | 256 | null
  depthOfField: boolean
  ambientOcclusion: boolean
}

export function fxFor(quality: Quality): Fx {
  const high = quality === 0
  const shown = quality < 2
  return {
    postFx: shown,
    grade: shown,
    lampGlow: shown,
    atmosphere: shown,
    reflection: high ? 512 : shown ? 256 : null,
    depthOfField: high,
    ambientOcclusion: high,
  }
}
