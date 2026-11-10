import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/darkroom/wood.jpg')

const W = 1024
const H = 1024

/** Simple 1D value noise, tileable over [0, period). */
function tileableNoise(period, seed) {
  const table = new Float32Array(period)
  let x = seed >>> 0
  for (let i = 0; i < period; i++) {
    x = (x * 1664525 + 1013904223) >>> 0
    table[i] = (x & 0xffff) / 0xffff
  }
  return (t) => {
    const i0 = Math.floor(t) % period
    const i1 = (i0 + 1) % period
    const f = t - Math.floor(t)
    const smooth = f * f * (3 - 2 * f)
    return table[i0] * (1 - smooth) + table[i1] * smooth
  }
}

function buildWoodRgb() {
  const data = Buffer.alloc(W * H * 3)
  const grainY = tileableNoise(256, 0x6e4a38)
  const ring = tileableNoise(512, 0xc4a882)
  const micro = tileableNoise(128, 0x908070)

  const baseR = 0x6e
  const baseG = 0x4a
  const baseB = 0x38

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      const alongGrain = v * 48 + Math.sin(u * Math.PI * 2 * 3.7) * 0.15
      const g = grainY(alongGrain) * 0.55 + ring(u * 24 + v * 2) * 0.25 + micro(u * 96 + v * 96) * 0.2
      const streak = 0.85 + 0.3 * Math.sin(v * Math.PI * 2 * 180 + ring(u * 8) * 4)
      const lift = (g - 0.5) * 0.35 * streak

      const nFine = micro(u * 140 + v * 160)
      let r = baseR + lift * 90 + nFine * 14
      let gch = baseG + lift * 70 + nFine * 11
      let b = baseB + lift * 45 + nFine * 7

      const warm = 1 + (v * 0.08 - 0.04)
      r = Math.min(255, Math.max(0, r * warm))
      gch = Math.min(255, Math.max(0, gch * warm))
      b = Math.min(255, Math.max(0, b * (warm * 0.95)))

      const i = (y * W + x) * 3
      data[i] = Math.round(r)
      data[i + 1] = Math.round(gch)
      data[i + 2] = Math.round(b)
    }
  }
  return data
}

async function main() {
  const rgb = buildWoodRgb()
  await mkdir(path.dirname(OUT), { recursive: true })

  const blurred = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()

  const sharpened = await sharp(blurred)
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.25 })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()

  await writeFile(OUT, sharpened)
  const meta = await sharp(OUT).metadata()
  console.log(`Wrote ${OUT} (${meta.width}x${meta.height}, ${sharpened.length} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
