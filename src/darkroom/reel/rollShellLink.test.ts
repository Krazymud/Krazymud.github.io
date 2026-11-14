import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('roll-link shell targeting', () => {
  it('posts roll events to FILM_V shell instead of always window.top', () => {
    const src = readFileSync(join(process.cwd(), 'public/reel-shell/roll-link.js'), 'utf8')
    expect(src).toContain("file==='index.html'")
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
    expect(frameE).toContain('paper-edit.js')
  })

  it('speaks the vault greeting and does not play dj2.mp3', () => {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell/frame-c.html'), 'utf8')
    expect(html).toContain('speechSynthesis')
    expect(html).toContain('playbackRate = 0.96')
    expect(html).not.toMatch(/DJSRC|dj2\.mp3/)
    expect(html).toContain('static.wav')
    expect(html).toContain('img/radio.svg')
    expect(html).not.toContain('img/radio.jpg')
    expect(html).toContain('《吉诺佩蒂》第一首 · 萨蒂')
    expect(html).not.toContain('.djmode .now{display:none}')
    expect(html).toContain('pointerdown')
    expect(existsSync(join(process.cwd(), 'public/reel-shell/static.wav'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'public/reel-shell/img/radio.svg'))).toBe(true)
  })

  it('keeps the sample film radio greeting in content.js', () => {
    const js = readFileSync(join(process.cwd(), 'public/reel-shell/content.js'), 'utf8')
    expect(js).toContain('Good evening. Brought to you by your love.')
  })

  it('sets the song line from the track list', () => {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell/frame-c.html'), 'utf8')
    expect(html).toContain('songT.textContent = d.list[d.cur]')
  })

  it('inserts the lists scene and does not auto-advance the letter', () => {
    const index = readFileSync(join(process.cwd(), 'public/reel-shell/index.html'), 'utf8')
    expect(index).toContain("'frame-e.html','frame-lists.html','rolls.html?enter=bag'")
    expect(index).toContain("d.roll==='paper-result'")
    expect(index).toContain('e.source===window.parent')
    const letter = readFileSync(join(process.cwd(), 'public/reel-shell/frame-e.html'), 'utf8')
    expect(letter).toContain('paper-edit.js')
    expect(letter).not.toContain("ROLL.done('cross')")
    expect(letter).toContain('id="nameW">留言')
    expect(letter).not.toContain('TT &amp; Claude')
    const lists = readFileSync(join(process.cwd(), 'public/reel-shell/frame-lists.html'), 'utf8')
    expect(lists).toContain("kind: 'list'")
    expect(lists).toContain('paper-edit.js')
    expect(lists).toContain('id="nameW">清单')
    expect(lists).toContain('第 4 幕')
    expect(lists).toContain('4 / 9')
    expect(lists).not.toContain('第 3 幕')
    expect(lists).not.toContain('3 / 9')
    expect(lists).not.toContain('TT &amp; Claude')
  })

  it('defaults to Chinese and uses the two local faces', () => {
    const zh = readFileSync(join(process.cwd(), 'public/reel-shell/zh.js'), 'utf8')
    expect(zh).toContain("lang = localStorage.getItem('aroll.lang') || 'zh'")
    expect(zh).toContain("'index.html'")
    expect(zh).toContain('宝宝，往下看')
    const link = readFileSync(join(process.cwd(), 'public/reel-shell/roll-link.js'), 'utf8')
    expect(link).toContain('font/LXGWWenKai-Regular.woff2')
    expect(link).toContain('font/MaShanZheng-Regular.ttf')
    expect(link).toContain('ZH Brush')
    const opening = readFileSync(join(process.cwd(), 'public/reel-shell/opening.html'), 'utf8')
    expect(opening).toContain('宝宝，往下看')
    expect(opening).not.toContain('roll it, darling')
  })

  it('sizes the rolls to the vault and captions the viewer from the frame line', () => {
    const html = readFileSync(join(process.cwd(), 'public/reel-shell/rolls.html'), 'utf8')
    expect(html).toContain('CONTENT.rolls[0].frames.length')
    expect(html).not.toContain("fillText('far away'")
    expect(html).toContain("fillText('聚焦'")
    expect(html).toContain('第 5 幕')
    expect(html).toContain('<h2>四卷</h2>')
    expect(html).toContain('<p>每一张都在</p>')
    expect(html).toContain('>5 / 9<')
    expect(html).not.toContain('Four rolls')
    expect(html).not.toContain('4 rolls · 96 frames')
    expect(html).not.toContain('· frame')
    expect(html).toContain('24 EXP')
  })
})
