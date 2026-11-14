import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function compactFromSource(): (w: number, h: number) => boolean {
  const src = readFileSync(join(process.cwd(), 'public/reel-shell/roll-link.js'), 'utf8')
  const m = src.match(/compact\(w,h\)\{return ([^}]+)\}/)
  if (!m) throw new Error('ROLL.compact missing')
  return new Function('w', 'h', 'return (' + m[1] + ')') as (w: number, h: number) => boolean
}

describe('ROLL.compact', () => {
  const compact = compactFromSource()
  it('is true for phones and a tall iPad', () => {
    expect(compact(390, 844)).toBe(true)
    expect(compact(390, 664)).toBe(true)
    expect(compact(844, 390)).toBe(true)
    expect(compact(820, 1180)).toBe(true)
  })
  it('is false for a desktop and a landscape iPad', () => {
    expect(compact(1440, 900)).toBe(false)
    expect(compact(1180, 820)).toBe(false)
  })
})

const PAGES = ['opening.html','frame-c.html','frame-e.html','frame-lists.html','rolls.html','tray.html','torch-comic.html','book-cover.html','credits.html']

it('gives the opening a readable portrait title and cue', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .title h1{font-size:clamp(40px,12vw,64px)}')
  expect(css).toContain('#stage.portrait .mark span{font-size:30px}')
  expect(css).toContain('#stage.portrait .mark{min-width:44px;min-height:44px}')
})

it('points every scene at fitStage and the portrait sheet', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell', page), 'utf8')
    expect(html, page).toContain('portrait.css?v=portrait1')
    expect(html, page).toContain('ROLL.fitStage(')
    expect(html, page).not.toContain('innerWidth/1600')
  }
})