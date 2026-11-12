import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('roll-link shell targeting', () => {
  it('posts roll events to FILM_V shell instead of always window.top', () => {
    const src = readFileSync(join(process.cwd(), 'public/reel-shell/roll-link.js'), 'utf8')
    expect(src).toContain('function rollShell()')
    expect(src).toContain('w.FILM_V!=null')
    expect(src).toContain('rollShell().postMessage({roll:\'done\'')
    expect(src).not.toMatch(/done\(fx\)\{if\(this\.in\)top\.postMessage/)
  })

  it('cache-busts roll-link on scene pages', () => {
    const opening = readFileSync(join(process.cwd(), 'public/reel-shell/opening.html'), 'utf8')
    expect(opening).toContain('roll-link.js?v=vaultcta1')
  })
})
