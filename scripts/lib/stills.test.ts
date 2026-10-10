// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkNotBlack,
  encodeStill,
  MAX_STILL_BYTES,
  ORIENTATIONS,
  STILL_SCENES,
  stillFileName,
  StillsError,
  writeStills,
} from './stills.ts'

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
    const error = await encodeStill(noise, 'vault-landscape').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(StillsError)
    expect(error).toHaveProperty('message', expect.stringMatching(/vault-landscape/))
  }, 30_000)
})

describe('writeStills', () => {
  let dir = ''

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'stills-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes every still into the output folder', async () => {
    const outDir = join(dir, 'stills')
    await writeStills(outDir, [
      { name: 'garage-portrait.webp', data: new Uint8Array([1]) },
      { name: 'track-portrait.webp', data: new Uint8Array([2]) },
    ], () => {})
    expect((await readdir(outDir)).sort()).toEqual(['garage-portrait.webp', 'track-portrait.webp'])
    expect([...(await readFile(join(outDir, 'track-portrait.webp')))]).toEqual([2])
  })

  it('leaves no temporary file behind when a still cannot be put in place', async () => {
    await mkdir(join(dir, 'garage-portrait.webp'))
    await writeFile(join(dir, 'garage-portrait.webp', 'keep'), '')
    await expect(writeStills(dir, [{ name: 'garage-portrait.webp', data: new Uint8Array([1]) }], () => {})).rejects.toThrow()
    expect(await readdir(dir)).toEqual(['garage-portrait.webp'])
  })
})
