import exifr from 'exifr'
import { localCalendarToday } from './web'

export const PHOTO_FULL_MAX_EDGE = 2000
export const PHOTO_THUMB_EDGE = 400

const FULL_WEBP_QUALITY = 82
const THUMB_WEBP_QUALITY = 70

export class PhotoProcessError extends Error {
  constructor(cause?: unknown) {
    super('这张照片打不开', { cause })
    this.name = 'PhotoProcessError'
  }
}

export type HeicDecoder = (input: {
  buffer: Uint8Array
}) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>

function isHeicFile(file: File): boolean {
  if (/\.(heic|heif)$/i.test(file.name)) return true
  const type = file.type.toLowerCase()
  return type === 'image/heic' || type === 'image/heif'
}

function fitInside(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (width <= maxEdge && height <= maxEdge) return { width, height }
  const scale = Math.min(maxEdge / width, maxEdge / height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

// Safari cannot encode webp and hands back a PNG instead; any other miss is re-encoded as PNG.
// Blob names carry no extension and useBlobUrl sniffs the bytes, so either format can be stored.
async function canvasToImage(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  const webp = await encodeCanvas(canvas, 'image/webp', quality)
  if (webp && (webp.type === 'image/webp' || webp.type === 'image/png')) return blobToBytes(webp)
  const png = await encodeCanvas(canvas, 'image/png')
  if (!png || png.type !== 'image/png') throw new PhotoProcessError()
  return blobToBytes(png)
}

function drawInside(ctx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number) {
  ctx.drawImage(source, 0, 0, width, height)
}

function drawCover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, sw: number, sh: number, size: number) {
  const scale = Math.max(size / sw, size / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = (size - dw) / 2
  const dy = (size - dh) / 2
  ctx.drawImage(source, dx, dy, dw, dh)
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new PhotoProcessError())
      image.src = url
    })
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function loadBitmapSource(
  file: File,
  decodeHeic?: HeicDecoder,
): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (isHeicFile(file)) {
    try {
      const decode = decodeHeic ?? (await import('heic-decode')).default
      const image = await decode({ buffer: bytes })
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new PhotoProcessError()
      const rgba = new Uint8ClampedArray(image.data)
      ctx.putImageData(new ImageData(rgba, image.width, image.height), 0, 0)
      return { source: canvas, width: image.width, height: image.height }
    } catch (cause) {
      throw new PhotoProcessError(cause)
    }
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  } catch {
    const image = await loadImageElement(file)
    return { source: image, width: image.naturalWidth, height: image.naturalHeight }
  }
}

async function photoDate(bytes: Uint8Array, fallback: Date): Promise<string> {
  const tags: { DateTimeOriginal?: unknown; CreateDate?: unknown } | undefined = await exifr
    .parse(bytes, { pick: ['DateTimeOriginal', 'CreateDate'] })
    .catch(() => undefined)
  const taken = tags?.DateTimeOriginal ?? tags?.CreateDate
  return localCalendarToday(taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken : fallback)
}

export async function processVaultPhoto(
  file: File,
  options?: { decodeHeic?: HeicDecoder; now?: Date },
): Promise<{ full: Uint8Array; thumb: Uint8Array; width: number; height: number; date: string }> {
  const now = options?.now ?? new Date()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { source, width: srcWidth, height: srcHeight, close } = await loadBitmapSource(file, options?.decodeHeic)

  try {
    const { width, height } = fitInside(srcWidth, srcHeight, PHOTO_FULL_MAX_EDGE)

    const fullCanvas = document.createElement('canvas')
    fullCanvas.width = width
    fullCanvas.height = height
    const fullCtx = fullCanvas.getContext('2d')
    if (!fullCtx) throw new PhotoProcessError()
    drawInside(fullCtx, source, width, height)
    const full = await canvasToImage(fullCanvas, FULL_WEBP_QUALITY)

    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = PHOTO_THUMB_EDGE
    thumbCanvas.height = PHOTO_THUMB_EDGE
    const thumbCtx = thumbCanvas.getContext('2d')
    if (!thumbCtx) throw new PhotoProcessError()
    drawCover(thumbCtx, source, srcWidth, srcHeight, PHOTO_THUMB_EDGE)
    const thumb = await canvasToImage(thumbCanvas, THUMB_WEBP_QUALITY)

    const date = await photoDate(bytes, now)
    return { full, thumb, width, height, date }
  } finally {
    close?.()
  }
}
