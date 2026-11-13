import { existsSync, readFileSync } from 'node:fs'
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
    expect(opening).toMatch(/roll-link\.js\?v=/)
    const frameE = readFileSync(join(process.cwd(), 'public/reel-shell/frame-e.html'), 'utf8')
    expect(frameE).toContain('overflow:hidden')
    expect(frameE).toContain('hurry')
    expect(frameE).toContain('TEXT.length>24')
  })

  it('speaks the vault greeting and does not play dj2.mp3', () => {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell/frame-c.html'), 'utf8')
    expect(html).toContain('speechSynthesis')
    expect(html).toContain('playbackRate = 0.96')
    expect(html).not.toMatch(/DJSRC|dj2\.mp3/)
    expect(html).toContain('static.wav')
    expect(existsSync(join(process.cwd(), 'public/reel-shell/static.wav'))).toBe(true)
  })

  it('sets the song line from the track list', () => {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell/frame-c.html'), 'utf8')
    expect(html).toContain('songT.textContent = d.list[d.cur]')
  })
})
