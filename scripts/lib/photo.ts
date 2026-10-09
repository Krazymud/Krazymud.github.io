import exifr from 'exifr'
import decodeHeic from 'heic-decode'
import sharp from 'sharp'
import { isHeicFile } from './vaultSource.ts'

export const FULL_MAX_EDGE = 2000
export const THUMB_EDGE = 400

export interface ProcessedPhoto {
  full: Uint8Array
  thumb: Uint8Array
  width: number
  height: number
}

export type HeicDecoder = (input: {
  buffer: Uint8Array
}) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>

type Pipeline = ReturnType<typeof sharp>

export async function processPhoto(
  name: string,
  bytes: Uint8Array,
  decode: HeicDecoder = decodeHeic,
): Promise<ProcessedPhoto> {
  let open: () => Pipeline
  if (isHeicFile(name)) {
    // libheif already applies the container's rotation, and raw pixels carry no EXIF.
    const image = await decode({ buffer: bytes })
    const pixels = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength)
    open = () => sharp(pixels, { raw: { width: image.width, height: image.height, channels: 4 } })
  } else {
    open = () => sharp(bytes).rotate()
  }

  const full = await open()
    .resize({ width: FULL_MAX_EDGE, height: FULL_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
  const thumb = await open().resize(THUMB_EDGE, THUMB_EDGE, { fit: 'cover' }).webp({ quality: 70 }).toBuffer()
  return { full: full.data, thumb, width: full.info.width, height: full.info.height }
}

function formatDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function photoDate(bytes: Uint8Array, fallback: Date): Promise<string> {
  const tags: { DateTimeOriginal?: unknown; CreateDate?: unknown } | undefined = await exifr
    .parse(bytes, { pick: ['DateTimeOriginal', 'CreateDate'] })
    .catch(() => undefined)
  const taken = tags?.DateTimeOriginal ?? tags?.CreateDate
  return formatDay(taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken : fallback)
}
