import sharp from 'sharp'

export const STILL_SCENES = ['garage', 'track', 'vault'] as const
export type StillName = (typeof STILL_SCENES)[number]

export const ORIENTATIONS = {
  portrait: { width: 900, height: 1600 },
  landscape: { width: 1600, height: 900 },
} as const
export type Orientation = keyof typeof ORIENTATIONS

export const MAX_STILL_BYTES = 120 * 1024

const QUALITY_START = 80
const QUALITY_FLOOR = 48
const QUALITY_STEP = 8

export class StillsError extends Error {
  name = 'StillsError'
}

export function stillFileName(scene: StillName, orientation: Orientation): string {
  return `${scene}-${orientation}.webp`
}

export async function checkNotBlack(png: Uint8Array, label: string): Promise<void> {
  const { channels } = await sharp(png).removeAlpha().stats()
  const mean = channels.reduce((sum, channel) => sum + channel.mean, 0) / channels.length
  const max = Math.max(...channels.map((channel) => channel.max))
  if (mean < 4 || max < 48) throw new StillsError(`${label}：截图几乎全黑（平均亮度 ${mean.toFixed(1)}，最高 ${max}）`)
}

export async function encodeStill(png: Uint8Array, label: string): Promise<Uint8Array> {
  for (let quality = QUALITY_START; quality >= QUALITY_FLOOR; quality -= QUALITY_STEP) {
    const webp = await sharp(png).webp({ quality, effort: 6 }).toBuffer()
    if (webp.length <= MAX_STILL_BYTES) return webp
  }
  throw new StillsError(`${label}：WebP 质量降到 ${QUALITY_FLOOR} 仍超过 ${MAX_STILL_BYTES / 1024} KB`)
}
