import { describe, expect, it } from 'vitest'
import { GRADE, GradeEffect } from './GradeEffect'

describe('GradeEffect', () => {
  it('exposes its look as uniforms so it can be tuned live', () => {
    const effect = new GradeEffect()
    expect(effect.uniforms.get('contrast')?.value).toBe(GRADE.contrast)
    expect(effect.uniforms.get('saturation')?.value).toBe(GRADE.saturation)
    expect(effect.uniforms.get('shadowTint')?.value.toArray()).toEqual(GRADE.shadowTint)
    expect(effect.uniforms.get('highlightTint')?.value.toArray()).toEqual(GRADE.highlightTint)
    effect.dispose()
  })
})
