import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'

describe('celadon tray tokens', () => {
  it('uses celadon glaze ink as the default page ground', () => {
    expect(css).toMatch(/--color-ink:\s*#d8e4dc/)
    expect(css).not.toMatch(/--color-ink:\s*#f7f4ec/)
    expect(css).not.toMatch(/--color-ink:\s*#eef1f5/)
    expect(css).toMatch(/--color-fg:\s*#1a2420/)
    expect(css).toMatch(/\.home-hero-fade[\s\S]*#d8e4dc/)
  })

  it('uses porcelain nav without decorative glass blur', () => {
    expect(css).toMatch(/\.glass-panel-nav\s*\{[^}]*--porcelain/)
    expect(css).toMatch(/\.glass-panel\s*\{[\s\S]*?backdrop-filter:\s*none/)
  })

  it('defines the glaze-fill signature move', () => {
    expect(css).toMatch(/\.glaze-cta/)
    expect(css).toMatch(/--glaze-fill/)
    expect(css).toMatch(/\.tea-ring/)
  })
})
