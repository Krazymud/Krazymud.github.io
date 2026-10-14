/**
 * Mechanical pop-up headlight loop: body locked to fc-still.webp.
 * Open pod is difference-masked from the artist keyframe k05.webp
 * (aligned dy=2), foreshortened about the rear hinge — no whole-frame
 * dissolve, no procedural origami shards.
 *
 * Usage: node scripts/build-headlight-seq.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLOSED = path.join(root, 'public/sketch/fc-still.webp')
const OPEN_KF = path.join(root, 'sketch-src/hl/k05.webp')
const OUT_PUBLIC = path.join(root, 'public/sketch')
const ART = '/opt/cursor/artifacts'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-mech-'))
const SEQ = path.join(TMP, 'seq')
fs.mkdirSync(SEQ)
fs.mkdirSync(ART, { recursive: true })

const FPS = 24
const TOTAL = 8 * FPS
const HOLD0 = Math.round(1.2 * FPS)
const OPEN_N = Math.round(1.8 * FPS)
const HOLD_UP = Math.round(2.0 * FPS)
const CLOSE_N = Math.round(1.8 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN_N - HOLD_UP - CLOSE_N

/** k05 aligns to still with a +2py content shift (content moves up). */
const KF_DY = 2

/**
 * Near lid shut-lines on fc-still (1600×900) — edge-energy fit.
 * Order: rear-left, rear-right, front-right, front-left.
 */
const NEAR = [
  [528, 397],
  [590, 396],
  [572, 440],
  [498, 438],
]

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function pts(list) {
  return list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
}

const meta = await sharp(CLOSED).metadata()
const width = meta.width
const height = meta.height
const base = await sharp(CLOSED).ensureAlpha().png().toBuffer()

// Align k05 onto still
const kAlignedPath = path.join(TMP, 'k05-aligned.png')
await sharp(OPEN_KF)
  .extract({ left: 0, top: KF_DY, width, height: height - KF_DY })
  .extend({
    top: 0,
    bottom: KF_DY,
    left: 0,
    right: 0,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .ensureAlpha()
  .png()
  .toFile(kAlignedPath)

const stillRaw = await sharp(CLOSED).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const openRaw = await sharp(kAlignedPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const ch = stillRaw.info.channels

// Build pod alpha mask from per-pixel difference, restricted to hood ROI
const ROI = { x0: 450, y0: 300, x1: 680, y1: 520 }
const mask = Buffer.alloc(width * height) // 0..255 alpha
let minX = 9999,
  minY = 9999,
  maxX = 0,
  maxY = 0,
  count = 0
for (let y = ROI.y0; y <= ROI.y1; y++) {
  for (let x = ROI.x0; x <= ROI.x1; x++) {
    const i = (y * width + x) * ch
    let d = 0
    for (let c = 0; c < 3; c++) d += Math.abs(stillRaw.data[i + c] - openRaw.data[i + c])
    // Soft threshold
    let a = 0
    if (d > 28) a = Math.min(255, Math.round(((d - 28) / 50) * 255))
    if (a > 20) {
      mask[y * width + x] = a
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      count++
    }
  }
}
// Dilate mask slightly for cleaner edges
const mask2 = Buffer.from(mask)
for (let y = minY; y <= maxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    let m = mask[y * width + x]
    if (m > 200) continue
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy
        if (nx < ROI.x0 || ny < ROI.y0 || nx > ROI.x1 || ny > ROI.y1) continue
        m = Math.max(m, Math.floor(mask[ny * width + nx] * 0.7))
      }
    }
    mask2[y * width + x] = m
  }
}

console.log('pod mask bbox', { minX, maxX, minY, maxY, count, w: maxX - minX, h: maxY - minY })

// Extract masked open pod patch (full-frame RGBA with transparency outside pod)
const podRgba = Buffer.alloc(width * height * 4)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    const a = mask2[y * width + x]
    if (a < 8) {
      podRgba[i + 3] = 0
      continue
    }
    podRgba[i] = openRaw.data[i]
    podRgba[i + 1] = openRaw.data[i + 1]
    podRgba[i + 2] = openRaw.data[i + 2]
    podRgba[i + 3] = a
  }
}
const podFull = path.join(TMP, 'pod-full.png')
await sharp(podRgba, { raw: { width, height, channels: 4 } }).png().toFile(podFull)

// Crop tight pod patch for foreshortening about hinge
const hingeY = Math.round((NEAR[0][1] + NEAR[1][1]) / 2)
const padX = 8
const padTop = 8
const padBot = 6
const crop = {
  left: Math.max(0, minX - padX),
  top: Math.max(0, Math.min(minY, hingeY) - padTop),
  width: 0,
  height: 0,
}
crop.width = Math.min(width - crop.left, maxX + padX - crop.left)
crop.height = Math.min(height - crop.top, maxY + padBot - crop.top)
const hingeLocalY = hingeY - crop.top

const podCropPath = path.join(TMP, 'pod-crop.png')
await sharp(podFull).extract(crop).png().toFile(podCropPath)

// Sample well fill color from still lid
const xs = NEAR.map((c) => c[0])
const ys = NEAR.map((c) => c[1])
const bx = Math.max(0, Math.floor(Math.min(...xs)))
const by = Math.max(0, Math.floor(Math.min(...ys)))
const bw = Math.ceil(Math.max(...xs)) - bx
const bh = Math.ceil(Math.max(...ys)) - by
const { data: sdata, info: sinfo } = await sharp(CLOSED)
  .extract({ left: bx, top: by, width: bw, height: bh })
  .resize(4, 4, { fit: 'fill' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
let sr = 0,
  sg = 0,
  sb = 0,
  sn = 0
for (let i = 0; i < sdata.length; i += sinfo.channels) {
  sr += sdata[i]
  sg += sdata[i + 1]
  sb += sdata[i + 2]
  sn++
}
const wellRgb = {
  r: Math.max(0, Math.round(sr / sn) - 120),
  g: Math.max(0, Math.round(sg / sn) - 120),
  b: Math.max(0, Math.round(sb / sn) - 120),
}

function wellSvg(op) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts(NEAR)}" fill="rgb(${wellRgb.r},${wellRgb.g},${wellRgb.b})" opacity="${op.toFixed(3)}"/>
  </svg>`)
}

/**
 * Build one frame at open amount 0..1.
 * - Dark well fades in under the footprint
 * - Artist pod stamp foreshortens from the rear hinge (vertical scale about hingeY)
 */
async function writeFrame(file, t) {
  if (t <= 0.001) {
    await sharp(base).toFile(file)
    return
  }
  const open = easeInOut(t)
  const layers = []

  // Well under lid
  const wellOp = 0.15 + open * 0.75
  layers.push({ input: wellSvg(wellOp), top: 0, left: 0 })

  // Foreshorten pod about hinge: scale Y from hinge downward/upward
  // At open=0: height ~0; at open=1: full crop height
  const fullH = crop.height
  const above = Math.max(1, hingeLocalY)
  const below = Math.max(1, fullH - hingeLocalY)

  // Collapse toward hinge early, expand to full open
  const scale = 0.12 + 0.88 * open
  const newAbove = Math.max(1, Math.round(above * scale))
  const newBelow = Math.max(1, Math.round(below * scale))
  const newH = newAbove + newBelow

  // Split crop into above-hinge / below-hinge, scale each, rejoin
  const aboveBuf = await sharp(podCropPath)
    .extract({ left: 0, top: 0, width: crop.width, height: above })
    .resize(crop.width, newAbove, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .png()
    .toBuffer()
  const belowBuf = await sharp(podCropPath)
    .extract({ left: 0, top: hingeLocalY, width: crop.width, height: below })
    .resize(crop.width, newBelow, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .png()
    .toBuffer()

  const warped = await sharp({
    create: { width: crop.width, height: newH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: aboveBuf, top: 0, left: 0 },
      { input: belowBuf, top: newAbove, left: 0 },
    ])
    .ensureAlpha()
    .png()
    .toBuffer()

  // Fade stamp in (avoids a hard cut at first frames)
  const stampOp = smoothstep(0.05, 0.55, open)
  const faded = await sharp(warped)
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from(
          `<svg width="${crop.width}" height="${newH}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="white" opacity="${stampOp.toFixed(3)}"/>
          </svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()

  const top = Math.max(0, crop.top + hingeLocalY - newAbove)
  layers.push({ input: faded, left: crop.left, top })

  await sharp(base).composite(layers).png().toFile(file)
}

let n = 0
for (let i = 0; i < HOLD0; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0)
for (let i = 0; i < OPEN_N; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), (i + 1) / OPEN_N)
for (let i = 0; i < HOLD_UP; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 1)
for (let i = 0; i < CLOSE_N; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 1 - (i + 1) / CLOSE_N)
for (let i = 0; i < HOLD1; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0)

const pattern = path.join(SEQ, 'f%04d.png')
execFileSync(
  'ffmpeg',
  ['-y', '-framerate', String(FPS), '-i', pattern, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-an', '-t', '8', path.join(OUT_PUBLIC, 'fc-loop.webm')],
  { stdio: 'inherit' },
)
execFileSync(
  'ffmpeg',
  ['-y', '-framerate', String(FPS), '-i', pattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-crf', '24', '-movflags', '+faststart', '-an', '-t', '8', path.join(OUT_PUBLIC, 'fc-loop.mp4')],
  { stdio: 'inherit' },
)

{
  const foot = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts(NEAR)}" fill="#00aa0066" stroke="#00aa00" stroke-width="2.5"/>
    ${NEAR.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#007700"/><text x="${p[0] + 5}" y="${p[1] - 4}" font-size="12" fill="#007700">${i}</text>`).join('')}
  </svg>`)
  const footFull = path.join(TMP, 'foot.png')
  await sharp(base).composite([{ input: foot, top: 0, left: 0 }]).png().toFile(footFull)
  await sharp(footFull).jpeg({ quality: 90 }).toFile(path.join(ART, 'hl-footprint.jpg'))
  await sharp(footFull)
    .extract({ left: 470, top: 380, width: 150, height: 80 })
    .resize(900, 480, { kernel: 'nearest' })
    .jpeg({ quality: 94 })
    .toFile(path.join(ART, 'hl-footprint-zoom.jpg'))
}

for (const [name, t] of [
  ['hl-mech-closed', 0],
  ['hl-mech-q1', 0.28],
  ['hl-mech-mid', 0.55],
  ['hl-mech-open', 1],
]) {
  const tmp = path.join(TMP, `${name}.png`)
  await writeFrame(tmp, t)
  fs.copyFileSync(tmp, path.join(ART, `${name}.png`))
  await sharp(tmp)
    .extract({ left: 450, top: 310, width: 230, height: 180 })
    .resize(920, 720)
    .jpeg({ quality: 92 })
    .toFile(path.join(ART, `${name}-zoom.jpg`))
}

// Save pod mask preview
await sharp(mask2, { raw: { width, height, channels: 1 } })
  .extract({ left: 450, top: 310, width: 230, height: 180 })
  .resize(920, 720, { kernel: 'nearest' })
  .jpeg({ quality: 90 })
  .toFile(path.join(ART, 'hl-k05-mask-zoom.jpg'))

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loop', '1', '-t', '1.0', '-i', path.join(ART, 'hl-mech-closed-zoom.jpg'),
    '-loop', '1', '-t', '0.9', '-i', path.join(ART, 'hl-mech-q1-zoom.jpg'),
    '-loop', '1', '-t', '0.9', '-i', path.join(ART, 'hl-mech-mid-zoom.jpg'),
    '-loop', '1', '-t', '1.4', '-i', path.join(ART, 'hl-mech-open-zoom.jpg'),
    '-loop', '1', '-t', '0.9', '-i', path.join(ART, 'hl-mech-mid-zoom.jpg'),
    '-loop', '1', '-t', '0.9', '-i', path.join(ART, 'hl-mech-q1-zoom.jpg'),
    '-loop', '1', '-t', '1.0', '-i', path.join(ART, 'hl-mech-closed-zoom.jpg'),
    '-filter_complex', '[0][1][2][3][4][5][6]concat=n=7:v=1:a=0,format=yuv420p',
    '-movflags', '+faststart',
    path.join(ART, 'hl-mech-hinge-demo.mp4'),
  ],
  { stdio: 'inherit' },
)

// Body-lock check
{
  const closedBuf = await sharp(base).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const openTmp = path.join(TMP, 'open-check.png')
  await writeFrame(openTmp, 1)
  const openBuf = await sharp(openTmp).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const x0 = Math.max(0, minX - 4)
  const y0 = Math.max(0, minY - 4)
  const x1 = Math.min(width - 1, maxX + 4)
  const y1 = Math.min(height - 1, maxY + 4)
  let seOut = 0,
    nOut = 0,
    seIn = 0,
    nIn = 0
  const cch = closedBuf.info.channels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * cch
      let d = 0
      for (let c = 0; c < 3; c++) {
        const dd = closedBuf.data[i + c] - openBuf.data[i + c]
        d += dd * dd
      }
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1
      if (inside) {
        seIn += d
        nIn += 3
      } else {
        seOut += d
        nOut += 3
      }
    }
  }
  console.log(`body-lock RMSE outside pod=${Math.sqrt(seOut / nOut).toFixed(3)} inside=${Math.sqrt(seIn / nIn).toFixed(3)}`)
}

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`wrote ${n} frames → public/sketch/fc-loop.{webm,mp4}`)
console.log('NEAR', JSON.stringify(NEAR))
console.log('pod crop', crop, 'hingeLocalY', hingeLocalY)
