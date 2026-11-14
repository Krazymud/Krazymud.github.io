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

it('maps roll taps and viewer labels with the frame', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/rolls.html'), 'utf8')
  expect(html).toContain('const framePx=()=>[fr.clientWidth,fr.clientHeight]')
  expect(html).toContain('const [w,h]=framePx()')
  expect(html).toContain('const [fw,fh]=framePx()')
  expect(html).not.toContain('x/1040*2-1')
  expect(html).not.toContain('/2*1040')
  expect(html).not.toContain('/2*694')
})

it('resizes the light table with the portrait frame', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/tray.html'), 'utf8')
  expect(html).toContain("box.mode==='portrait'")
  expect(html).toContain('renderer.setSize(r.width,r.height,false)')
  expect(html).toContain('Box3')
  const portrait = html.slice(html.indexOf("if(box.mode==='portrait')"), html.indexOf('}else{'))
  expect(portrait).toContain("cv.style.width='100%'")
  expect(portrait).toContain("cv.style.height='100%'")
  const desk = html.slice(html.indexOf('}else{'), html.indexOf('layout3d(ROLL.fitStage(s))'))
  expect(desk).toContain("cv.style.width='1040px'")
  expect(desk).toContain("cv.style.height='694px'")
  expect(html).toContain('const framePx=()=>[fr.clientWidth,fr.clientHeight]')
  expect(html).toContain('const [w,h]=framePx()')
  expect(html).not.toContain('x/1040*2-1')
  expect(html).not.toContain('/2*1040')
})

it('keeps light-table hints and the crane on the portrait camera', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/tray.html'), 'utf8')
  const flow = readFileSync(join(process.cwd(), 'public/reel-shell/tray-lt-flow.js'), 'utf8')
  expect(flow).toContain('frameEl.clientWidth')
  expect(flow).toContain('frameEl.clientHeight')
  expect(flow).toContain("contains('portrait')")
  expect(flow).not.toContain('/2*1040')
  expect(flow).not.toContain('/2*694')
  expect(html).toContain('y:(1-_b.y)/2*694')
  expect(html).toContain('if(!developed&&!camHold&&!leave)')
  expect(html).toContain('dollyFrom(deskPos,deskLook)')
  expect(html).toContain('developed=true')
  expect(html).toContain('CAM0=[cam.position.y,cam.position.z]')
  expect(html).toContain('tray-lt-flow.js?v=tnqe1a')
})

it('frames the book cover at 72% of the portrait width', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/book-cover.html'), 'utf8')
  expect(html).toContain('BW/(2*Math.tan(30*Math.PI/360)*cam.aspect*0.72)')
  expect(html).toContain('cam.lookAt(1.15,0,-.1)')
})

