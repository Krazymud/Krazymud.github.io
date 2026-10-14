/**
 * FC3S pop-up headlight loop — body locked to fc-still.webp.
 *
 * Mechanical model taken from real Mazda RX-7 FC3S footage
 * (Bilibili BV1JM411x7yC — 转子引擎启动): both lids rise together
 * about a rear hinge, front edge arcs up, lamps light near full open,
 * then reverse. No dissolve / soft-appear pop.
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
const OUT_PUBLIC = path.join(root, 'public/sketch')
const ART = '/opt/cursor/artifacts'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-fc3s-'))
const SEQ = path.join(TMP, 'seq')
fs.mkdirSync(SEQ)
fs.mkdirSync(ART, { recursive: true })

const FPS = 24
const TOTAL = 8 * FPS
const HOLD0 = Math.round(1.0 * FPS)
const OPEN_N = Math.round(2.4 * FPS)
const HOLD_UP = Math.round(1.8 * FPS)
const CLOSE_N = Math.round(2.4 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN_N - HOLD_UP - CLOSE_N

/**
 * Shut-line footprints on fc-still (1600×900).
 * Order: rear-left, rear-right, front-right, front-left.
 * Near = viewer-left lid (clear panel). Far = second lid inboard of
 * the hood/fender gap — not the fender panel itself.
 */
const NEAR = [
  [518, 397],
  [586, 396],
  [568, 439],
  [496, 437],
]
/**
 * Far lid: across the hood center strip from near, before the hood/fender
 * gap (~x630–650). Sized from FC3S 3/4 foreshortening in BV1JM411x7yC —
 * smaller than near but deep enough that the open pod clearly reads.
 */
const FAR = [
  [608, 399],
  [656, 397],
  [662, 429],
  [612, 431],
]

/** Real FC lids tilt ~35–40° at full open; far needs more image lift. */
const MAX_ANG_NEAR = (38 * Math.PI) / 180
const MAX_ANG_FAR = (48 * Math.PI) / 180

function easeInOut(t) {
  return t * t * (3 - 2 * t)
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mid(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]]
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]]
}

function mul(a, s) {
  return [a[0] * s, a[1] * s]
}

function len(a) {
  return Math.hypot(a[0], a[1]) || 1
}

function norm(a) {
  const L = len(a)
  return [a[0] / L, a[1] / L]
}

function pts(list) {
  return list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
}

function cssRgb({ r, g, b }, shade = 0, alpha = 1) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + shade)))
  if (alpha >= 0.999) return `rgb(${f(r)},${f(g)},${f(b)})`
  return `rgba(${f(r)},${f(g)},${f(b)},${alpha.toFixed(3)})`
}

async function makePod(corners, maxAng, name) {
  const [rl, rr, fr, fl] = corners
  const hingeL = rl
  const hingeR = rr
  const hinge = mid(hingeL, hingeR)
  const hingeAxis = norm(sub(hingeR, hingeL))
  const hingeLen = len(sub(hingeR, hingeL))
  const front0 = mid(fl, fr)
  const forward = norm(sub(front0, hinge))
  // Screen-up bias (matches FC: front edge lifts toward camera/sky)
  const planarUp0 = [-forward[1], forward[0]]
  const planarUp = planarUp0[1] > 0 ? mul(planarUp0, -1) : planarUp0
  const lift = norm(add(mul([0, -1], 0.92), mul(planarUp, 0.08)))

  function raise(p, ang) {
    const fromL = sub(p, hingeL)
    const t = fromL[0] * hingeAxis[0] + fromL[1] * hingeAxis[1]
    const anchor = add(hingeL, mul(hingeAxis, Math.max(0, Math.min(hingeLen, t))))
    const out = sub(p, anchor)
    const d = len(out)
    const outDir = norm(out)
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    return add(anchor, add(mul(outDir, d * c), mul(lift, d * s)))
  }

  return { name, corners, rl, rr, fr, fl, hingeL, hingeR, hinge, raise, maxAng, lift }
}

const meta = await sharp(CLOSED).metadata()
const width = meta.width
const height = meta.height
const base = await sharp(CLOSED).ensureAlpha().png().toBuffer()

const nearPod = await makePod(NEAR, MAX_ANG_NEAR, 'near')
const farPod = await makePod(FAR, MAX_ANG_FAR, 'far')

// Sample graphite tone from near lid interior (avoid shut-line pixels)
const { data: sdata, info: sinfo } = await sharp(CLOSED)
  .extract({ left: 530, top: 410, width: 36, height: 20 })
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
const color = { r: Math.round(sr / sn), g: Math.round(sg / sn), b: Math.round(sb / sn) }

/**
 * Draw one FC box pod. open in [0,1] after easing.
 * At open≈0 geometry is coplanar with the footprint (no soft-appear gate),
 * so the first moving frames cannot "pop" a gray shard onto the still.
 */
function podSvgParts(pod, open, scale = 1) {
  if (open < 0.0005) return []

  const ang = open * pod.maxAng
  const { rl, rr, fr, fl, hingeL, hingeR, raise, corners } = pod

  const fl2 = raise(fl, ang)
  const fr2 = raise(fr, ang)
  // Slight rear-edge settle so the hinge reads as planted
  const rl2 = raise(rl, ang * 0.04)
  const rr2 = raise(rr, ang * 0.04)
  const lidTop = [rl2, rr2, fr2, fl2]
  const frontFace = [fl2, fr2, fr, fl]
  const sideL = [rl2, fl, fl2]
  const sideR = [rr2, fr, fr2]

  const cx = (rl[0] + rr[0] + fr[0] + fl[0]) / 4
  const cy = (rl[1] + rr[1] + fr[1] + fl[1]) / 4

  // Continuous reveal with angle — no hard opacity cliff
  const rise = smoothstep(0, 0.12, open)
  const wellA = rise * smoothstep(0.02, 0.35, open)
  const bodyA = Math.min(1, 0.15 + rise * 0.85)

  const lidStroke = cssRgb(color, -118, bodyA)
  const wellFill = cssRgb(color, -155, wellA)
  const wellFloor = cssRgb(color, -110)
  const faceFill = cssRgb(color, -48, bodyA)
  const sideFillL = cssRgb(color, -78, bodyA)
  const sideFillR = cssRgb(color, -62, bodyA)
  // Lid top stays close to graphite body tone (no gray CGI pop)
  const lidFill = cssRgb(color, 6, bodyA * 0.92)

  const faceC = [(fl2[0] + fr2[0] + fr[0] + fl[0]) / 4, (fl2[1] + fr2[1] + fr[1] + fl[1]) / 4]
  const faceW = len(sub(fr2, fl2)) * scale
  const faceHt = Math.max(len(sub(fl2, fl)), 0.5) * scale
  const lampSize = Math.min(faceW * 0.62, faceHt * 0.72) * (0.9 + open * 0.1)
  // Real FC: lamps come on near full open
  const lampReveal = smoothstep(0.72, 0.95, open) * bodyA

  const sw = (1.05 * scale).toFixed(2)
  const swThin = (0.7 * scale).toFixed(2)
  const parts = []

  // Well under rising pod (covers closed shut-lines as lid leaves)
  parts.push(`<polygon points="${pts(corners)}" fill="${wellFill}"/>`)
  if (open > 0.08) {
    const inset = corners.map((p) => [lerp(p[0], cx, 0.2), lerp(p[1], cy, 0.2)])
    parts.push(
      `<polygon points="${pts(inset)}" fill="${wellFloor}" opacity="${(wellA * (0.2 + open * 0.45)).toFixed(3)}"/>`,
    )
  }

  parts.push(
    `<polygon points="${pts(sideL)}" fill="${sideFillL}" stroke="${lidStroke}" stroke-width="${swThin}"/>`,
  )
  parts.push(
    `<polygon points="${pts(sideR)}" fill="${sideFillR}" stroke="${lidStroke}" stroke-width="${swThin}"/>`,
  )
  parts.push(
    `<polygon points="${pts(frontFace)}" fill="${faceFill}" stroke="${lidStroke}" stroke-width="${sw}"/>`,
  )

  if (lampReveal > 0.02 && faceHt > 3.5) {
    const half = Math.max(1.8, lampSize * 0.5)
    const rx = Math.max(0.5, half * 0.18)
    parts.push(
      `<rect x="${(faceC[0] - half).toFixed(2)}" y="${(faceC[1] - half).toFixed(2)}" width="${(half * 2).toFixed(2)}" height="${(half * 2).toFixed(2)}" rx="${rx.toFixed(2)}" fill="#f0e6c8" stroke="${lidStroke}" stroke-width="${(0.85 * scale).toFixed(2)}" opacity="${lampReveal.toFixed(3)}"/>`,
      `<rect x="${(faceC[0] - half * 0.42).toFixed(2)}" y="${(faceC[1] - half * 0.42).toFixed(2)}" width="${(half * 0.84).toFixed(2)}" height="${(half * 0.84).toFixed(2)}" rx="${(rx * 0.4).toFixed(2)}" fill="#fffaf0" opacity="${(lampReveal * 0.55).toFixed(3)}"/>`,
    )
  }

  parts.push(
    `<polygon points="${pts(lidTop)}" fill="${lidFill}" stroke="${lidStroke}" stroke-width="${(1.15 * scale).toFixed(2)}"/>`,
  )
  // Hinge crease
  parts.push(
    `<line x1="${hingeL[0]}" y1="${hingeL[1]}" x2="${hingeR[0]}" y2="${hingeR[1]}" stroke="#2a2a2c" stroke-width="${(1.1 * scale).toFixed(2)}" opacity="${(bodyA * (0.25 + open * 0.4)).toFixed(3)}"/>`,
  )
  return parts
}

function overlaySvg(openNear, openFar) {
  const parts = []
  // Far first so near draws on top where they meet
  parts.push(...podSvgParts(farPod, openFar, 1))
  parts.push(...podSvgParts(nearPod, openNear, 1))
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`,
  )
}

async function writeFrame(file, tNear, tFar = tNear) {
  if (tNear <= 0.0005 && tFar <= 0.0005) {
    await sharp(base).toFile(file)
    return
  }
  const openNear = easeInOut(Math.max(0, Math.min(1, tNear)))
  const openFar = easeInOut(Math.max(0, Math.min(1, tFar)))
  await sharp(base)
    .composite([{ input: overlaySvg(openNear, openFar), top: 0, left: 0 }])
    .png()
    .toFile(file)
}

/** Both lids track the same phase — real FC opens in sync. */
function phaseT(t) {
  return Math.max(0, Math.min(1, t))
}

let n = 0
for (let i = 0; i < HOLD0; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0, 0)
for (let i = 0; i < OPEN_N; i++, n++) {
  const t = phaseT((i + 1) / OPEN_N)
  await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), t, t)
}
for (let i = 0; i < HOLD_UP; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 1, 1)
for (let i = 0; i < CLOSE_N; i++, n++) {
  const t = phaseT(1 - (i + 1) / CLOSE_N)
  await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), t, t)
}
for (let i = 0; i < HOLD1; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0, 0)

const pattern = path.join(SEQ, 'f%04d.png')
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    pattern,
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    '38',
    '-row-mt',
    '1',
    '-an',
    '-t',
    '8',
    path.join(OUT_PUBLIC, 'fc-loop.webm'),
  ],
  { stdio: 'inherit' },
)
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    pattern,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'main',
    '-crf',
    '24',
    '-movflags',
    '+faststart',
    '-an',
    '-t',
    '8',
    path.join(OUT_PUBLIC, 'fc-loop.mp4'),
  ],
  { stdio: 'inherit' },
)

{
  const foot = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts(NEAR)}" fill="#00aa0066" stroke="#00aa00" stroke-width="2"/>
    <polygon points="${pts(FAR)}" fill="#0088ff66" stroke="#0088ff" stroke-width="2"/>
  </svg>`)
  const footFull = path.join(TMP, 'foot.png')
  await sharp(base).composite([{ input: foot, top: 0, left: 0 }]).png().toFile(footFull)
  await sharp(footFull).jpeg({ quality: 90 }).toFile(path.join(ART, 'hl-footprint.jpg'))
  await sharp(footFull)
    .extract({ left: 480, top: 370, width: 220, height: 90 })
    .resize(1100, 450, { kernel: 'nearest' })
    .jpeg({ quality: 94 })
    .toFile(path.join(ART, 'hl-footprint-zoom.jpg'))
  await sharp(footFull)
    .extract({ left: 480, top: 370, width: 220, height: 90 })
    .resize(1100, 450, { kernel: 'nearest' })
    .jpeg({ quality: 94 })
    .toFile(path.join(ART, 'headlight-footprint-zoom.jpg'))
}

for (const [name, t] of [
  ['hl-mech-closed', 0],
  ['hl-mech-q1', 0.18],
  ['hl-mech-mid', 0.5],
  ['hl-mech-open', 1],
]) {
  const tmp = path.join(TMP, `${name}.png`)
  await writeFrame(tmp, t, t)
  fs.copyFileSync(tmp, path.join(ART, `${name}.png`))
  await sharp(tmp)
    .extract({ left: 470, top: 300, width: 360, height: 200 })
    .resize(1080, 600)
    .jpeg({ quality: 92 })
    .toFile(path.join(ART, `${name}-zoom.jpg`))
}

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loop',
    '1',
    '-t',
    '0.85',
    '-i',
    path.join(ART, 'hl-mech-closed-zoom.jpg'),
    '-loop',
    '1',
    '-t',
    '0.8',
    '-i',
    path.join(ART, 'hl-mech-q1-zoom.jpg'),
    '-loop',
    '1',
    '-t',
    '0.8',
    '-i',
    path.join(ART, 'hl-mech-mid-zoom.jpg'),
    '-loop',
    '1',
    '-t',
    '1.4',
    '-i',
    path.join(ART, 'hl-mech-open-zoom.jpg'),
    '-loop',
    '1',
    '-t',
    '0.8',
    '-i',
    path.join(ART, 'hl-mech-mid-zoom.jpg'),
    '-loop',
    '1',
    '-t',
    '0.8',
    '-i',
    path.join(ART, 'hl-mech-q1-zoom.jpg'),
    '-loop',
    '1',
    '-t',
    '0.85',
    '-i',
    path.join(ART, 'hl-mech-closed-zoom.jpg'),
    '-filter_complex',
    '[0][1][2][3][4][5][6]concat=n=7:v=1:a=0,format=yuv420p',
    '-movflags',
    '+faststart',
    path.join(ART, 'hl-mech-hinge-demo.mp4'),
  ],
  { stdio: 'inherit' },
)

{
  const closedBuf = await sharp(base).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const openTmp = path.join(TMP, 'open-check.png')
  await writeFrame(openTmp, 1, 1)
  const openBuf = await sharp(openTmp).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const all = [...NEAR, ...FAR]
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const x0 = Math.max(0, Math.min(...xs) - 12)
  const y0 = Math.max(0, Math.min(...ys) - 90)
  const x1 = Math.min(width - 1, Math.max(...xs) + 12)
  const y1 = Math.min(height - 1, Math.max(...ys) + 12)
  let seOut = 0,
    nOut = 0
  const cch = closedBuf.info.channels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue
      const i = (y * width + x) * cch
      let d = 0
      for (let c = 0; c < 3; c++) {
        const dd = closedBuf.data[i + c] - openBuf.data[i + c]
        d += dd * dd
      }
      seOut += d
      nOut += 3
    }
  }
  console.log(`body-lock RMSE outside=${Math.sqrt(seOut / nOut).toFixed(3)}`)
}

fs.copyFileSync(path.join(ART, 'hl-mech-hinge-demo.mp4'), path.join(ART, 'headlight-hinge-demo.mp4'))
fs.copyFileSync(path.join(ART, 'hl-mech-open-zoom.jpg'), path.join(ART, 'headlight-open-zoom.jpg'))
fs.copyFileSync(path.join(ART, 'hl-mech-mid-zoom.jpg'), path.join(ART, 'headlight-mid-zoom.jpg'))
fs.copyFileSync(path.join(ART, 'hl-mech-q1-zoom.jpg'), path.join(ART, 'headlight-q1-zoom.jpg'))

// Preview loop for artifacts
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    path.join(OUT_PUBLIC, 'fc-loop.mp4'),
    '-vf',
    'scale=1080:-2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '22',
    '-movflags',
    '+faststart',
    '-an',
    path.join(ART, 'headlight-loop-preview.mp4'),
  ],
  { stdio: 'inherit' },
)

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`wrote ${n} frames → public/sketch/fc-loop.{webm,mp4}`)
console.log('NEAR', JSON.stringify(NEAR))
console.log('FAR', JSON.stringify(FAR))
console.log('ref: Bilibili BV1JM411x7yC FC3S dual sync rear-hinge')
