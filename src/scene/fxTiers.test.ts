import { describe, expect, it } from 'vitest'
import { fxFor } from './fxTiers'

describe('fxFor', () => {
  it('turns everything on at full quality', () => {
    expect(fxFor(0)).toEqual({
      postFx: true,
      grade: true,
      lampGlow: true,
      atmosphere: true,
      reflection: 512,
      depthOfField: true,
      ambientOcclusion: true,
    })
  })

  it('keeps the cheap effects and halves the reflection at medium quality', () => {
    expect(fxFor(1)).toEqual({
      postFx: true,
      grade: true,
      lampGlow: true,
      atmosphere: true,
      reflection: 256,
      depthOfField: false,
      ambientOcclusion: false,
    })
  })

  it('drops every extra pass at low quality', () => {
    expect(fxFor(2)).toEqual({
      postFx: false,
      grade: false,
      lampGlow: false,
      atmosphere: false,
      reflection: null,
      depthOfField: false,
      ambientOcclusion: false,
    })
  })
})
