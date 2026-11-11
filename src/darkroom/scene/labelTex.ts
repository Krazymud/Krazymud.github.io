import type { FilmRoll } from '../rolls'
import { DR_FONTS } from '../theme'

export type CanisterLabelStyle = {
  bg: string
  ink: string
  band: string
  iso: string
}

const LABEL_STYLES: CanisterLabelStyle[] = [
  { bg: '#e6d8bd', ink: '#b5301e', band: '#b5301e', iso: '400' },
  { bg: '#f3e6d2', ink: '#2a5a3a', band: '#3d7a52', iso: '200' },
  { bg: '#d4cfc4', ink: '#040302', band: '#ee5546', iso: '800' },
  { bg: '#2b2a28', ink: '#f3e6d2', band: '#ee5546', iso: '1600' },
  { bg: '#c8d9e4', ink: '#1a3d5c', band: '#1a3d5c', iso: '100' },
]

export function rollStyle(index: number): CanisterLabelStyle {
  return LABEL_STYLES[index % LABEL_STYLES.length]!
}

/** Match reference rolls-enter labelTex: wrap-around bands + Fraunces italic + ROLL nn · ISO · 24 EXP. */
export function makeCanisterLabelBitmap(roll: FilmRoll, style: CanisterLabelStyle, rollNo = 1): HTMLCanvasElement {
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const x = canvas.getContext('2d')!
  x.fillStyle = style.bg
  x.fillRect(0, 0, W, H)
  x.fillStyle = style.band
  x.fillRect(0, 0, W, 26)
  x.fillRect(0, H - 26, W, 26)

  const name = roll.title || roll.id
  for (const cx of [W * 0.25, W * 0.75]) {
    x.save()
    x.translate(cx, H / 2)
    x.rotate(Math.PI / 2)
    x.fillStyle = style.ink
    x.textAlign = 'center'
    let fs = 104
    x.font = `italic 300 ${fs}px ${DR_FONTS.display}`
    while (fs > 36 && x.measureText(name).width > 430) {
      fs -= 4
      x.font = `italic 300 ${fs}px ${DR_FONTS.display}`
    }
    x.fillText(name, 0, 10, 430)
    x.font = `400 26px ${DR_FONTS.mono}`
    x.globalAlpha = 0.85
    x.fillText(`ROLL ${String(rollNo).padStart(2, '0')} · ${style.iso} · 24 EXP`, 0, 62)
    x.restore()

    x.save()
    x.translate(cx - 150, H / 2)
    x.rotate(Math.PI / 2)
    x.fillStyle = style.ink
    x.globalAlpha = 0.7
    x.textAlign = 'center'
    x.font = `400 20px ${DR_FONTS.mono}`
    x.fillText(roll.id.toUpperCase(), 0, 0)
    x.restore()
  }

  for (let i = 0; i < 1600; i++) {
    x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`
    x.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }

  return canvas
}
