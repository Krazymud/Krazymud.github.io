import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'

describe('night skin tokens', () => {
  it('uses cool paper ink instead of warm cream as the default page ground', () => {
    expect(css).toMatch(/--color-ink:\s*#eef1f5/)
    expect(css).not.toMatch(/--color-ink:\s*#f7f4ec/)
    expect(css).toMatch(/--color-fg:\s*#1a2433/)
    expect(css).toMatch(/\.home-hero-fade[\s\S]*#eef1f5/)
  })

  it('uses cool glass on the nav header override', () => {
    expect(css).toMatch(/\.glass-panel-nav\s*\{[^}]*rgba\(245,\s*248,\s*252,\s*0\.42\)/)
    expect(css).not.toMatch(/\.glass-panel-nav\s*\{[^}]*rgba\(255,\s*255,\s*255/)
  })
})
