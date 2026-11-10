/** Mini Instax-style layout: 54×86 mm at 16 px/mm (reference pola.js). */
export const MM = 16
export const POLAROID_W = 54 * MM
export const POLAROID_H = 86 * MM
const INSET_X = 4 * MM
const INSET_Y = 6 * MM
const INSET_W = 46 * MM
const INSET_H = 62 * MM

export type PolaroidRenderOpts = {
  caption?: string
  date?: string
  index: number
  rollLabel?: string
}

export type PolaroidZipEntry = { name: string; data: Uint8Array }

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function buildPolaroidZip(files: PolaroidZipEntry[]): Blob {
  const parts: Array<ArrayBuffer | Uint8Array> = []
  const dir: Array<ArrayBuffer | Uint8Array> = []
  let off = 0
  const enc = new TextEncoder()
  for (const { name, data } of files) {
    const n = enc.encode(name)
    const crc = crc32(data)
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 20, true)
    h.setUint16(6, 0x0800, true)
    h.setUint16(12, 33, true)
    h.setUint32(14, crc, true)
    h.setUint32(18, data.length, true)
    h.setUint32(22, data.length, true)
    h.setUint16(26, n.length, true)
    parts.push(h.buffer, n, data)
    const d = new DataView(new ArrayBuffer(46))
    d.setUint32(0, 0x02014b50, true)
    d.setUint16(4, 20, true)
    d.setUint16(6, 20, true)
    d.setUint16(8, 0x0800, true)
    d.setUint16(14, 33, true)
    d.setUint32(16, crc, true)
    d.setUint32(20, data.length, true)
    d.setUint32(24, data.length, true)
    d.setUint16(28, n.length, true)
    d.setUint32(42, off, true)
    dir.push(d.buffer, n)
    off += 30 + n.length + data.length
  }
  const dirSize = dir.reduce((a, p) => a + p.byteLength, 0)
  const e = new DataView(new ArrayBuffer(22))
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, files.length, true)
  e.setUint16(10, files.length, true)
  e.setUint32(12, dirSize, true)
  e.setUint32(16, off, true)
  return new Blob([...parts, ...dir, e.buffer] as BlobPart[], { type: 'application/zip' })
}

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = POLAROID_W
  c.height = POLAROID_H
  return c
}

let grainSeed = 11
function rand(): number {
  grainSeed = (grainSeed * 16807) % 2147483647
  return grainSeed / 2147483647
}

function paper(ctx: CanvasRenderingContext2D, tint: string) {
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, POLAROID_W, POLAROID_H)
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = rand() < 0.5 ? `rgba(90,60,30,${rand() * 0.05})` : `rgba(255,255,255,${rand() * 0.05})`
    ctx.fillRect(rand() * POLAROID_W, rand() * POLAROID_H, 2, 2)
  }
  const g = ctx.createRadialGradient(POLAROID_W / 2, POLAROID_H / 2, POLAROID_W * 0.35, POLAROID_W / 2, POLAROID_H / 2, POLAROID_W * 0.95)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(60,35,15,.12)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, POLAROID_W, POLAROID_H)
}

function sourceSize(img: CanvasImageSource): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight }
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) return { w: img.width, h: img.height }
  const sized = img as { width?: number; height?: number }
  if (typeof sized.width === 'number' && typeof sized.height === 'number') return { w: sized.width, h: sized.height }
  return { w: INSET_W, h: INSET_H }
}

/** Vitest maps DOM canvases to node-canvas; draw from the backing surface when present. */
function resolveDrawSource(img: CanvasImageSource): CanvasImageSource {
  if (img instanceof HTMLCanvasElement) {
    const ctx = img.getContext('2d')
    if (ctx) {
      const backing = ctx.canvas
      if (backing && backing !== img) return backing as unknown as CanvasImageSource
    }
  }
  return img
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) {
  const source = resolveDrawSource(img)
  const { w, h } = sourceSize(source)
  const scale = Math.max(dw / w, dh / h)
  const sw = dw / scale
  const sh = dh / scale
  const sx = (w - sw) / 2
  const sy = (h - sh) / 2
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = ['']
  for (const ch of String(text || '')) {
    const cur = lines[lines.length - 1] + ch
    if (ctx.measureText(cur).width <= maxW || !lines[lines.length - 1]) {
      lines[lines.length - 1] = cur
      continue
    }
    const sp = cur.lastIndexOf(' ')
    if (sp > 0 && ch !== ' ') {
      lines[lines.length - 1] = cur.slice(0, sp)
      lines.push(cur.slice(sp + 1))
    } else {
      lines.push(ch.trim())
    }
  }
  return lines.filter(Boolean)
}

export async function renderPolaroidFront(image: CanvasImageSource, opts: PolaroidRenderOpts): Promise<HTMLCanvasElement> {
  const c = makeCanvas()
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  paper(ctx, '#f1eadc')
  ctx.save()
  ctx.filter = 'sepia(0.12) saturate(0.95) contrast(1.03)'
  drawCover(ctx, image, INSET_X, INSET_Y, INSET_W, INSET_H)
  ctx.restore()
  ctx.strokeStyle = 'rgba(40,25,10,.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(INSET_X, INSET_Y, INSET_W, INSET_H)
  const date = opts.date || ''
  const roll = (opts.rollLabel || '暗房').toUpperCase()
  const no = String(opts.index + 1).padStart(2, '0')
  ctx.fillStyle = '#b0281e'
  ctx.font = `400 ${9 * MM}px Georgia, "Times New Roman", serif`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'right'
  ctx.fillText(date, POLAROID_W - INSET_X - MM, POLAROID_H - 6 * MM)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(60,40,20,.5)'
  ctx.font = `400 ${2.2 * MM}px ui-monospace, monospace`
  ctx.fillText(`${roll} · ${no}`, INSET_X + MM, POLAROID_H - 6.2 * MM)
  return c
}

export async function renderPolaroidBack(opts: PolaroidRenderOpts): Promise<HTMLCanvasElement> {
  const c = makeCanvas()
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  paper(ctx, '#ece2cf')
  const date = opts.date || ''
  const caption = opts.caption || ''
  const roll = opts.rollLabel || '暗房'
  const no = String(opts.index + 1).padStart(2, '0')
  ctx.fillStyle = '#b0281e'
  ctx.font = `400 ${10 * MM}px Georgia, "Times New Roman", serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(date, 6 * MM, 16 * MM)
  ctx.fillStyle = '#2a1a0e'
  ctx.font = `400 ${3.4 * MM}px ui-monospace, "Courier New", monospace`
  wrapLines(ctx, caption, POLAROID_W - 12 * MM)
    .slice(0, 12)
    .forEach((line, j) => ctx.fillText(line, 6 * MM, 26 * MM + j * 5.6 * MM))
  ctx.fillStyle = 'rgba(60,40,20,.45)'
  ctx.font = `400 ${2 * MM}px ui-monospace, monospace`
  ctx.fillText(`${roll.toUpperCase()} · FRAME ${no}`, 6 * MM, POLAROID_H - 7 * MM)
  return c
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
  })
}

export type PolaroidFrameInput = PolaroidRenderOpts & {
  image: CanvasImageSource
}

async function loadImageFromSource(src: string | Blob | CanvasImageSource): Promise<CanvasImageSource> {
  if (typeof src === 'string' || src instanceof Blob) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('image load failed'))
        img.src = url
      })
    } finally {
      if (src instanceof Blob) URL.revokeObjectURL(url)
    }
  }
  return src
}

export async function renderPolaroidPair(frame: PolaroidFrameInput) {
  const image = await loadImageFromSource(frame.image)
  const opts: PolaroidRenderOpts = {
    caption: frame.caption,
    date: frame.date,
    index: frame.index,
    rollLabel: frame.rollLabel,
  }
  const front = await renderPolaroidFront(image, opts)
  const back = await renderPolaroidBack(opts)
  return { front, back }
}

export async function downloadPolaroidsZip(frames: PolaroidFrameInput[], zipName = 'darkroom-polaroids.zip') {
  const files: PolaroidZipEntry[] = []
  for (let i = 0; i < frames.length; i++) {
    const frame = { ...frames[i], index: frames[i].index ?? i }
    const { front, back } = await renderPolaroidPair(frame)
    const no = String(frame.index + 1).padStart(2, '0')
    for (const [side, canvas] of [
      ['front', front],
      ['back', back],
    ] as const) {
      const blob = await canvasToJpegBlob(canvas)
      files.push({ name: `polaroid-${no}-${side}.jpg`, data: new Uint8Array(await blob.arrayBuffer()) })
    }
  }
  const zip = buildPolaroidZip(files)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(zip)
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 4000)
}

export async function openPrintSheet(frames: PolaroidFrameInput[], targetWindow?: Window | null) {
  const w = targetWindow ?? window.open('', '_blank')
  if (!w) return
  w.document.write('<p style="font:14px monospace;padding:30px">正在准备打印页…</p>')
  const pairs = await Promise.all(
    frames.map(async (frame, i) => {
      const f = { ...frame, index: frame.index ?? i }
      const { front, back } = await renderPolaroidPair(f)
      return {
        f: URL.createObjectURL(await canvasToJpegBlob(front, 0.95)),
        b: URL.createObjectURL(await canvasToJpegBlob(back, 0.95)),
      }
    }),
  )
  const pages: (typeof pairs)[] = []
  for (let i = 0; i < pairs.length; i += 4) pages.push(pairs.slice(i, i + 4))
  const pageHtml = pages
    .map(
      (pg) => `<div class="page"><div class="grid">${pg
        .map((s) => `<div class="pair"><img src="${s.f}" alt=""><img src="${s.b}" alt=""></div>`)
        .join('')}</div>
<div class="note">沿虚线剪裁 · 点线对折 · 背面涂胶粘合 · 打印缩放 100%</div></div>`,
    )
    .join('')
  w.document.open()
  w.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>暗房 · 拍立得</title>
<style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;font:10px/1.4 monospace;color:#888}
.page{width:297mm;height:210mm;position:relative;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}
.grid{position:absolute;left:40mm;top:15mm;display:grid;grid-template-columns:108mm 108mm;grid-template-rows:86mm 86mm;gap:9mm}
.pair{position:relative;display:flex;outline:.2mm dashed #bbb}.pair img{width:54mm;height:86mm;display:block;object-fit:cover}
.pair::after{content:"";position:absolute;left:54mm;top:0;bottom:0;border-left:.2mm dotted #999}
.note{position:absolute;left:40mm;bottom:8mm}
@media screen{body{background:#555}.page{background:#fff;margin:10mm auto;box-shadow:0 4px 20px rgba(0,0,0,.4)}}
</style></head><body>${pageHtml}</body></html>`)
  w.document.close()
  const imgs = [...w.document.images]
  await Promise.all(imgs.map((img) => (img.complete ? undefined : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r() }))))
  window.setTimeout(() => w.print(), 300)
}
