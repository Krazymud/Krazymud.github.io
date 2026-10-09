// @vitest-environment node
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { checkNotBlack, encodeStill, MAX_STILL_BYTES, ORIENTATIONS, STILL_SCENES, stillFileName, StillsError } from './stills.ts'

function solid(width: number, height: number, value: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: value, g: value, b: value } } })
    .png()
    .toBuffer()
}

async function gradient(width: number, height: number): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      data[i] = Math.round((x / width) * 200)
      data[i + 1] = 20
      data[i + 2] = Math.round((y / height) * 60)
    }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

describe('stills', () => {
  it('names six files for three scenes in two orientations', () => {
    expect(STILL_SCENES).toEqual(['garage', 'track', 'vault'])
    expect(ORIENTATIONS).toEqual({ portrait: { width: 900, height: 1600 }, landscape: { width: 1600, height: 900 } })
    expect(stillFileName('vault', 'landscape')).toBe('vault-landscape.webp')
  })

  it('rejects a black screenshot', async () => {
    await expect(checkNotBlack(await solid(64, 64, 0), 'garage-portrait')).rejects.toThrow(StillsError)
    await expect(checkNotBlack(await solid(64, 64, 0), 'garage-portrait')).rejects.toThrow(/garage-portrait/)
  })

  it('accepts a lit screenshot', async () => {
    await expect(checkNotBlack(await gradient(64, 64), 'track-landscape')).resolves.toBeUndefined()
  })

  it('encodes a still as WebP within the size limit', async () => {
    const webp = await encodeStill(await gradient(900, 1600), 'garage-portrait')
    expect(webp.length).toBeLessThanOrEqual(MAX_STILL_BYTES)
    const meta = await sharp(webp).metadata()
    expect(meta.format).toBe('webp')
    expect([meta.width, meta.height]).toEqual([900, 1600])
  })

  it('gives up on a still that cannot fit the size limit', async () => {
    const noise = await sharp(randomBytes(1600 * 900 * 3), { raw: { width: 1600, height: 900, channels: 3 } })
      .png()
      .toBuffer()
    await expect(encodeStill(noise, 'vault-landscape')).rejects.toThrow(/vault-landscape/)
  }, 30_000)
})
