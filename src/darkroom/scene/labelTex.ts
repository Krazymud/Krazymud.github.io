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

export function makeCanisterLabelBitmap(roll: FilmRoll, style: CanisterLabelStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = style.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const bandH = 72
  ctx.fillStyle = style.band
  ctx.fillRect(0, 0, canvas.width, bandH)

  ctx.fillStyle = style.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.font = `600 72px ${DR_FONTS.display}`
  ctx.fillText(roll.title, canvas.width / 2, canvas.height * 0.42)

  const frameCount = roll.photoSources.length
  ctx.font = `32px ${DR_FONTS.mono}`
  ctx.fillText(`ISO ${style.iso} · ${frameCount} 帧`, canvas.width / 2, canvas.height * 0.72)

  ctx.font = `28px ${DR_FONTS.letter}`
  ctx.globalAlpha = 0.75
  ctx.fillText(roll.id.toUpperCase(), canvas.width / 2, canvas.height * 0.88)
  ctx.globalAlpha = 1

  return canvas
}
