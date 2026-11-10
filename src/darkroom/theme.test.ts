import { describe, expect, it } from 'vitest'
import { DR_COLORS } from './theme'

describe('DR_COLORS', () => {
  it('matches A Roll cream/ink/accent', () => {
    expect(DR_COLORS.cream).toBe('#f3e6d2')
    expect(DR_COLORS.ink).toBe('#040302')
    expect(DR_COLORS.accent).toBe('#ee5546')
    expect(DR_COLORS.bg).toBe('#0b0705')
    expect(DR_COLORS.woodTint).toBe('#6e4a38')
  })
})
