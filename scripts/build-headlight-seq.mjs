/**
 * Build public/sketch/fc-loop.{webm,mp4} from sketch-src/hl/k00..k05.webp
 * Usage: node scripts/build-headlight-seq.mjs
 * Requires: sharp, ffmpeg on PATH
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'sketch-src/hl')
const OUT_PUBLIC = path.join(root, 'public/sketch')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-seq-'))
const NORM = path.join(TMP, 'norm')
const SEQ = path.join(TMP, 'seq')
fs.mkdirSync(NORM)
fs.mkdirSync(SEQ)

const keys = ['k00', 'k01', 'k02', 'k03', 'k04', 'k05']
const FPS = 24
const TOTAL = 8 * FPS
const HOLD0 = Math.round(1.2 * FPS)
const OPEN = Math.round(1.8 * FPS)
const HOLD_UP = Math.round(2.0 * FPS)
const CLOSE = Math.round(1.8 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN - HOLD_UP - CLOSE

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

async function load(name) {
  return sharp(path.join(NORM, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

for (const k of keys) {
  await sharp(path.join(SRC, `${k}.webp`))
    .resize(1600, 900, { fit: 'contain', background: '#f1ebdd' })
    .png()
    .toFile(path.join(NORM, `${k}.png`))
}

const imgs = []
for (const k of keys) imgs.push(await load(k))
const { width, height, channels } = imgs[0].info
const size = width * height * channels

function blend(a, b, t) {
  const out = Buffer.allocUnsafe(size)
  const u = 1 - t
  for (let i = 0; i < size; i++) out[i] = Math.round(a[i] * u + b[i] * t)
  return out
}

function samplePath(keysIdx, t) {
  const segs = keysIdx.length - 1
  const x = Math.min(1, Math.max(0, t)) * segs
  const i = Math.min(segs - 1, Math.floor(x))
  return blend(imgs[keysIdx[i]].data, imgs[keysIdx[i + 1]].data, easeInOut(x - i))
}

async function writeFrame(n, buf) {
  await sharp(buf, { raw: { width, height, channels } })
    .png()
    .toFile(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`))
}

let n = 0
for (let i = 0; i < HOLD0; i++, n++) await writeFrame(n, imgs[0].data)
for (let i = 0; i < OPEN; i++, n++) await writeFrame(n, samplePath([0, 1, 2, 3, 4, 5], (i + 1) / OPEN))
for (let i = 0; i < HOLD_UP; i++, n++) await writeFrame(n, imgs[5].data)
for (let i = 0; i < CLOSE; i++, n++) await writeFrame(n, samplePath([5, 4, 3, 2, 1, 0], (i + 1) / CLOSE))
for (let i = 0; i < HOLD1; i++, n++) await writeFrame(n, imgs[0].data)

const pattern = path.join(SEQ, 'f%04d.png')
execFileSync(
  'ffmpeg',
  ['-y', '-framerate', String(FPS), '-i', pattern, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '44', '-row-mt', '1', '-an', '-t', '8', path.join(OUT_PUBLIC, 'fc-loop.webm')],
  { stdio: 'inherit' },
)
execFileSync(
  'ffmpeg',
  ['-y', '-framerate', String(FPS), '-i', pattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-crf', '30', '-movflags', '+faststart', '-an', '-t', '8', path.join(OUT_PUBLIC, 'fc-loop.mp4')],
  { stdio: 'inherit' },
)

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`wrote ${n} frames → public/sketch/fc-loop.{webm,mp4}`)
