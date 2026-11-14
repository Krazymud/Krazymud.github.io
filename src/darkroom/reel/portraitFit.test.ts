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
  expect(js).toContain("b.style.fontSize = mode ? '15px' : btnFont.get(b)")
  expect(js).toContain('fitBar({ detail: { cover: mountCover } })')
})

it('stops the portrait letter above the measured edit bar', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  const js = readFileSync(join(process.cwd(), 'public/reel-shell/paper-edit.js'), 'utf8')
  expect(css).toContain('#stage.portrait .letter{left:16px;top:48px;width:calc(100% - 32px);height:calc(100% - 56px - var(--pe-bar,92px));transform:none}')
  expect(css).toContain('#stage.portrait .opened .letter{animation-name:pletter}')
  expect(css).not.toContain('height:calc(100% - 148px)')
  expect(js).toContain("root.style.setProperty('--pe-bar'")
  expect(js).toContain("addEventListener('reel-fit', pinBar)")
})

it('covers the phone-wide screen with the gate even while it jitters', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.phonewide .proj{left:50%;top:50%;width:1040px;height:694px;translate:-50% -50%;scale:var(--cover)}')
  expect(css).not.toContain('scale(var(--cover))')
  expect(css).toMatch(/#stage\.portrait \.frame\{-webkit-mask:url\("[^"]*preserveAspectRatio='none'/)
})

it('keeps the envelope at desk size and scales the tear with it', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .env{left:calc(16px + 22px * var(--env,1));top:auto;bottom:30%;transform-origin:0 100%;scale:var(--env,1)}')
  expect(css).toContain('#stage.portrait .frame>.strip{left:auto;right:3%;width:78px}')
  expect(css).not.toContain('#stage.portrait .strip{')
  expect(css).not.toMatch(/\.env\{[^}]*height:auto/)
  for (const page of ['frame-e.html', 'frame-lists.html']) {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell', page), 'utf8')
    expect(html, page).toContain("es=box.mode==='portrait'?Math.min(1,(f.clientWidth-32)/470):1")
    expect(html, page).toContain('const tearX=e=>local(e)[0]/es')
    expect(html, page).toContain('startX=tearX(e)-p')
    expect(html, page).toContain('tearX(e)-startX')
  }
})

it('lets the comic be finished in both phone modes', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/torch-comic.html'), 'utf8')
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .side,#stage.phonewide .side{z-index:9;pointer-events:none}')
  for (const id of ['p0', 'p1', 'p2', 'p3']) {
    expect(css).toContain(`#stage.portrait .done #${id}{left:16px;`)
    expect(html).not.toMatch(new RegExp(`id="${id}"[^>]*style=`))
  }
  expect(html).toContain('#p0{left:684px;top:30px;width:326px;height:148px}')
  expect(html).toContain('.slot{background:transparent;border:2px dashed rgba(22,16,11,.28);pointer-events:none}')
  expect(html).toContain("document.getElementById('side').classList.add('done')")
})

it('puts the relocated hints and exits on screen in phone modes', () => {
  const js = readFileSync(join(process.cwd(), 'public/reel-shell/roll-link.js'), 'utf8')
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(js).toContain("'calc(100% - 110px)'")
  expect(js).toContain("addEventListener('reel-fit',place)")
  expect(css).toContain('#stage.portrait .hint.pair{left:0;right:0;transform:none}')
  expect(css).toContain('#stage.portrait .below>.tocred{left:0;right:0;margin-left:0;text-align:center;top:58px!important}')
})

it('wraps a custom opening title in portrait instead of shrinking it', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/opening.html'), 'utf8')
  expect(html).toContain("if(s.classList.contains('portrait')){h.style.whiteSpace='';return}")
  expect(html).toContain("addEventListener('reel-fit',e=>{const t=e.detail.mode==='portrait';if(t!==tall){tall=t;shrink()}})")
})

it('warms the scene versions of roll-link and the light-table flow', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/index.html'), 'utf8')
  expect(html).toContain('"roll-link.js":"portrait1"')
  expect(html).toContain('"tray-lt-flow.js":"tnqe1a"')
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

it('frames an opened roll and the way back with the portrait camera', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/rolls.html'), 'utf8')
  expect(html).toContain('dist=dir.length()*(1040/694)/cam.aspect')
  expect(html).toContain('camTo=aimShot(focusShot);camT=0}')
  expect(html).toContain('camTo=overview();camT=0}')
  expect(html).not.toContain('camTo={pos:HOME.pos.clone(),look:HOME.look.clone()}')
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
  expect(html).toContain('const lookAt=new THREE.Vector3(1.15,0,-.1)')
  expect(html).toContain('if(p.equals(SHOT.book.p)&&l.equals(SHOT.book.l))return bookFit()')
})

it('aims the portrait wide shot at the letter so the book can start', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/book-cover.html'), 'utf8')
  expect(html).toContain("const to=stage==='wide'?aimAt(SHOT.letter.p,SHOT.letter.l,true):aimAt(pose.p,pose.l,portrait)")
  expect(html).toContain("if(stage==='wide'&&!portrait){")
})

it('rolls the credits at a readable size', () => {
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(css).toContain('#stage.portrait .credits{left:12%;width:76%;top:8%;bottom:8%}')
  expect(css).toContain('#stage.portrait .rollup .name{font-size:22px}')
  expect(css).toContain('#stage.portrait .thend{left:12%;width:76%}')
})

it('opens a tall window on the comic desk', () => {
  const html = readFileSync(join(process.cwd(), 'public/reel-shell/torch-comic.html'), 'utf8')
  const css = readFileSync(join(process.cwd(), 'public/reel-shell/portrait.css'), 'utf8')
  expect(html).toContain("s.classList.contains('portrait')?IMG_H*(r.width/Math.max(1,r.height)):VW")
  expect(html).toContain('(mx-90)/460')
  expect(html).toContain('(px-r.left)/Math.max(1,r.width)')
  expect(html).not.toContain('frame.clientWidth')
  expect(html).not.toMatch(/id="main"[^>]*width:640px/)
  expect(html).toContain('#main{cursor:none;left:30px;top:30px;width:640px;height:470px}')
  expect(css).toContain('#stage.portrait #main{left:0;top:0;width:100%;height:100%}')
  expect(css).toContain('#stage.portrait #desk{width:100%;height:100%}')
  expect(css).not.toContain('height:calc(100% - 72px)')
})

