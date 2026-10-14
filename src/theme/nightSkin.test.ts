import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'

describe('night skin tokens', () => {
  it('uses cool paper ink instead of warm cream as the default page ground', () => {
    expect(css).toMatch(/--color-ink:\s*#eef1f5/)
    expect(css).not.toMatch(/--color-ink:\s*#f7f4ec/)
    expect(css).toMatch(/--color-fg:\s*#1a2433/)
    expect(css).toMatch(/\.home-hero-fade[\s\S]*#eef1f5/)
  })
})
