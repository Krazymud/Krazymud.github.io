import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg
const base = process.env.REEL_ORIGIN || 'http://127.0.0.1:50149/reel-shell'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
async function open(path) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  return page.evaluate(() => {
    const s = document.getElementById('stage')
    const proj = document.querySelector('.proj').getBoundingClientRect()
    return { portrait: s.classList.contains('portrait'), phonewide: s.classList.contains('phonewide'), projH: proj.height, innerH: innerHeight }
  })
}
const opening = await open('/opening.html')
if (!opening.portrait || opening.phonewide) throw new Error('opening class ' + JSON.stringify(opening))
if (opening.projH < opening.innerH * 0.7) throw new Error('opening frame short ' + opening.projH)
const cue = await page.evaluate(() => {
  const el = document.querySelector('.mark span')
  const b = document.querySelector('.mark').getBoundingClientRect()
  return { font: parseFloat(getComputedStyle(el).fontSize), w: b.width, h: b.height }
})
if (cue.font < 24 || cue.w < 44 || cue.h < 44) throw new Error('cue ' + JSON.stringify(cue))

await page.setViewportSize({ width: 1440, height: 900 })
const desk = await open('/opening.html')
if (desk.portrait || desk.phonewide) throw new Error('desk class ' + JSON.stringify(desk))
const scaled = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).transform)
if (!scaled.includes('matrix')) throw new Error('desk transform ' + scaled)

await page.setViewportSize({ width: 390, height: 844 })
await open('/frame-c.html?on')
const song = await page.evaluate(() => {
  const el = document.querySelector('.now .song')
  const cord = document.querySelector('.cord').getBoundingClientRect()
  return { font: parseFloat(getComputedStyle(el).fontSize), w: cord.width, h: cord.height }
})
if (song.font < 20 || song.w < 44 || song.h < 44) throw new Error('radio ' + JSON.stringify(song))

const phoneCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const letterPage = await phoneCtx.newPage()
await letterPage.goto(base + '/frame-e.html?open', { waitUntil: 'domcontentloaded' })
await letterPage.waitForSelector('.pe-bar')
const letter = await letterPage.evaluate(() => {
  const pre = document.querySelector('.letter pre') || document.querySelector('.pe-text')
  const buttons = [...document.querySelectorAll('.pe-bar button')].map((b) => b.getBoundingClientRect())
  const paper = document.querySelector('.letter').getBoundingClientRect()
  const bar = document.querySelector('.pe-bar').getBoundingClientRect()
  return {
    font: pre ? parseFloat(getComputedStyle(pre).fontSize) : 0,
    n: buttons.length,
    inView: buttons.every((b) => b.top >= 0 && b.bottom <= innerHeight && b.height >= 44),
    clear: paper.bottom <= bar.top + 1,
  }
})
await phoneCtx.close()
if (letter.font < 16 || letter.n < 5 || !letter.inView || !letter.clear) throw new Error('letter ' + JSON.stringify(letter))

for (const path of ['/rolls.html', '/tray.html?lt', '/book-cover.html']) {
  await open(path)
  await page.waitForTimeout(2000)
  const gl = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    const b = c ? c.getBoundingClientRect() : { width: 0, height: 0 }
    return { w: b.width, h: b.height, portrait: document.getElementById('stage').classList.contains('portrait') }
  })
  if (!gl.portrait || gl.w < 300 || gl.h < 500) throw new Error(path + ' canvas ' + JSON.stringify(gl))
}

await browser.close()
console.log('portrait measure ok', opening, cue)