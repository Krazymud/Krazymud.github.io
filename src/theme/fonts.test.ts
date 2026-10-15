import { accessSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('paper fonts', () => {
  const css = readFileSync(resolve('src/index.css'), 'utf8')

  it('declares LXGW WenKai and Source Serif 4 faces', () => {
    expect(css).toMatch(/LXGW WenKai/)
    expect(css).toMatch(/Source Serif 4/)
    expect(css).toMatch(/lxgw-wenkai/)
    expect(css).toMatch(/source-serif-4/)
  })

  it('sets body to paper stack', () => {
    expect(css).toMatch(/--font-paper/)
    expect(css).toMatch(/font-family:\s*var\(--font-paper\)/)
  })

  it('ships self-hosted woff2 assets', () => {
    accessSync(resolve('public/fonts/lxgw-wenkai-regular.woff2'))
    accessSync(resolve('public/fonts/source-serif-4-latin-400.woff2'))
  })
})
