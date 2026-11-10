import { DR_FONTS } from '../theme'

export const DEFAULT_BOOK_TITLE = '一卷相片'

export type BookCoverInput = {
  title: string
  byline?: string
  photo?: CanvasImageSource | null
}

function leatherNoise(x: number, y: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return v - Math.floor(v)
}

export function resolveBookTitle(opts: { noteTitle?: string | null }): string {
  const t = opts.noteTitle?.trim()
  return t ? t : DEFAULT_BOOK_TITLE
}

export function makeLeatherBumpBitmap(size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const n = 95 + Math.floor(leatherNoise(x, y) * 110)
      img.data[i] = n
      img.data[i + 1] = n - 8
      img.data[i + 2] = n - 18
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  for (let k = 0; k < 28; k++) {
    const y = (k / 28) * size
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y + 6)
    ctx.stroke()
  }
  return canvas
}

export function makeBookCoverBitmap({ title, byline, photo }: BookCoverInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1365
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height

  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#6b3a22')
  grad.addColorStop(0.45, '#4a2514')
  grad.addColorStop(1, '#2f1408')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 900; i++) {
    const x = leatherNoise(i, 1) * w
    const y = leatherNoise(i, 2) * h
    const r = 1 + leatherNoise(i, 3) * 2.2
    ctx.fillStyle = `rgba(0,0,0,${0.03 + leatherNoise(i, 4) * 0.06})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const insetW = w * 0.52
  const insetH = h * 0.34
  const ix = (w - insetW) / 2
  const iy = h * 0.22
  ctx.strokeStyle = 'rgba(212,175,95,0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(ix, iy, insetW, insetH)

  if (photo) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(ix + 4, iy + 4, insetW - 8, insetH - 8)
    ctx.clip()
    ctx.drawImage(photo, ix + 4, iy + 4, insetW - 8, insetH - 8)
    ctx.restore()
    ctx.strokeStyle = 'rgba(20,10,6,0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(ix + 4, iy + 4, insetW - 8, insetH - 8)
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(ix + 4, iy + 4, insetW - 8, insetH - 8)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e8c98a'
  ctx.font = `700 96px ${DR_FONTS.display}`
  const titleY = photo ? h * 0.72 : h * 0.58
  ctx.fillText(title, w / 2, titleY)

  if (byline?.trim()) {
    ctx.font = `italic 42px ${DR_FONTS.hand}`
    ctx.globalAlpha = 0.82
    ctx.fillText(byline.trim(), w / 2, titleY + 88)
    ctx.globalAlpha = 1
  }

  ctx.strokeStyle = 'rgba(212,175,95,0.25)'
  ctx.lineWidth = 10
  ctx.strokeRect(24, 24, w - 48, h - 48)

  return canvas
}
