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

it('places the radio under the bulb with a 22px song', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .now .song{font-size:22px}')
  expect(css).toContain('#stage.portrait .cord{min-width:44px;min-height:44px}')
  expect(css).toContain('#stage.portrait .radio{left:8%;top:36%;width:74%')
})

it('keeps the letter body at 17px in portrait and 44px tall buttons', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  const js = readFileSync(join(process.cwd(), 'public/reel-shell/paper-edit.js'), 'utf8')
  expect(css).toContain('#stage.portrait .letter pre{font-size:17px}')
  expect(js).toContain("minHeight = mode ? '44px'")
  expect(js).toContain("reel-fit")
  expect(js).toContain("liveBodySize = '17px'")
  expect(js).toContain('16 / cover')
  expect(js).toContain("b.style.fontSize = mode ? '15px' : ''")
  expect(js).toContain('fitBar({ detail: { cover: mountCover } })')
})

it('points every scene at fitStage and the portrait sheet', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell', page), 'utf8')
    expect(html, page).toContain('portrait.css?v=portrait1')
    expect(html, page).toContain('ROLL.fitStage(')
    expect(html, page).not.toContain('innerWidth/1600')
  }
})

it('stores both can rows and resizes the portrait canvas', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/rolls.html'), 'utf8')
  expect(html).toContain('const POS_PORT=[[0.15,-1.6],[-0.2,-0.45],[0.2,0.7],[-0.1,1.85]]')
  expect(html).toContain('const POS_DESK=[[-2.5,-.35],[-.75,.95],[1.05,-.75],[2.75,.7]]')
  expect(html).toContain('renderer.setSize(r.width,r.height,false)')
  expect(html).toContain('cam.aspect=r.width/Math.max(1,r.height)')
  const portrait = html.slice(html.indexOf("if(box.mode==='portrait')"), html.indexOf('}else{'))
  expect(portrait).toContain("cv.style.width='100%'")
  expect(portrait).toContain("cv.style.height='100%'")
  const desk = html.slice(html.indexOf('}else{'), html.indexOf('layout3d(ROLL.fitStage(s))'))
  expect(desk).toContain("cv.style.width='1040px'")
  expect(desk).toContain("cv.style.height='694px'")
})