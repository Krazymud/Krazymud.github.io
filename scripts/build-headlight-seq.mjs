/**
 * Mechanical dual pop-up headlight loop: body locked to fc-still.webp.
 * Near + far lids open as rigid FC box pods about rear hinges.
 * Lid tops reuse still graphite texture so early frames don't "pop" gray.
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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-mech-'))
const SEQ = path.join(TMP, 'seq')
fs.mkdirSync(SEQ)
fs.mkdirSync(ART, { recursive: true })

const FPS = 24
const TOTAL = 8 * FPS
const HOLD0 = Math.round(1.2 * FPS)
const OPEN_N = Math.round(2.2 * FPS)
const HOLD_UP = Math.round(1.6 * FPS)
const CLOSE_N = Math.round(2.2 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN_N - HOLD_UP - CLOSE_N

/**
 * Shut-lines on fc-still (1600×900).
 * Order: rear-left, rear-right, front-right, front-left.
 */
const NEAR = [
  [520, 398],
  [586, 397],
  [568, 440],
  [498, 438],
]
/**
 * Far lid: foreshortened FC passenger pod on the hood,
 * between near lid and the wheel-arch (not on the fender).
 */
const FAR = [
  [675, 402],
  [738, 400],
  [742, 418],
  [682, 419],
]

const MAX_ANG_NEAR = (50 * Math.PI) / 180
const MAX_ANG_FAR = (62 * Math.PI) / 180

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
  const planarUp0 = [-forward[1], forward[0]]
  const planarUp = planarUp0[1] > 0 ? mul(planarUp0, -1) : planarUp0
  const lift = norm(add(mul([0, -1], 0.9), mul(planarUp, 0.1)))

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

  // Lid texture patch from still (keeps graphite look — avoids gray pop)
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const pad = 3
  const box = {
    x: Math.max(0, Math.floor(Math.min(...xs)) - pad),
    y: Math.max(0, Math.floor(Math.min(...ys)) - pad),
    w: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)) + pad * 2,
    h: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)) + pad * 2,
  }
  const local = corners.map(([x, y]) => [x - box.x, y - box.y])
  const lidMask = Buffer.from(
    `<svg width="${box.w}" height="${box.h}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${pts(local)}" fill="white"/>
    </svg>`,
  )
  const lidPatch = await sharp(CLOSED)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .ensureAlpha()
    .composite([{ input: lidMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return { name, corners, rl, rr, fr, fl, hingeL, hingeR, hinge, raise, maxAng, box, lidPatch, lift }
}

const meta = await sharp(CLOSED).metadata()
const width = meta.width
const height = meta.height
const base = await sharp(CLOSED).ensureAlpha().png().toBuffer()

const nearPod = await makePod(NEAR, MAX_ANG_NEAR, 'near')
const farPod = await makePod(FAR, MAX_ANG_FAR, 'far')
const pods = [
  { pod: nearPod, scale: 1 },
  { pod: farPod, scale: 0.88 },
]

// Sample tone for well/face fills
const { data: sdata, info: sinfo } = await sharp(CLOSED)
  .extract({
    left: Math.floor(Math.min(...NEAR.map((p) => p[0]))),
    top: Math.floor(Math.min(...NEAR.map((p) => p[1]))),
    width: 40,
    height: 30,
  })
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

function podSvgParts(pod, open, scale = 1) {
  if (open < 0.015) return []

  const ang = open * pod.maxAng
  const { rl, rr, fr, fl, hingeL, hingeR, raise, corners } = pod

  const fl2 = raise(fl, ang)
  const fr2 = raise(fr, ang)
  const lidTop = [hingeL, hingeR, fr2, fl2]
  const frontFace = [fl2, fr2, fr, fl]
  const sideL = [hingeL, fl, fl2]
  const sideR = [hingeR, fr, fr2]

  const cx = (rl[0] + rr[0] + fr[0] + fl[0]) / 4
  const cy = (rl[1] + rr[1] + fr[1] + fl[1]) / 4

  // Gentle appear — geometry still grows with angle; this only softens the first crack
  const appear = smoothstep(0.015, 0.28, open)

  const lidStroke = cssRgb(color, -105, appear)
  // Opaque well early so closed shut-lines don't ghost under the rising pod
  const wellFill = cssRgb(color, -140, appear * smoothstep(0.02, 0.2, open))
  const wellFloor = cssRgb(color, -95)
  const faceFill = cssRgb(color, -52, appear)
  const sideFillL = cssRgb(color, -72, appear)
  const sideFillR = cssRgb(color, -58, appear)
  // Lid fill is mostly the textured patch; SVG fill is a fallback under the patch
  const lidFill = cssRgb(color, 4, appear * 0.35)

  const faceC = [(fl2[0] + fr2[0] + fr[0] + fl[0]) / 4, (fl2[1] + fr2[1] + fr[1] + fl[1]) / 4]
  const faceW = len(sub(fr2, fl2)) * scale
  const faceHt = Math.max(len(sub(fl2, fl)), 2) * scale
  const lampSize = Math.min(faceW * 0.66, faceHt * 0.7) * (0.88 + open * 0.12)
  const lampReveal = appear * smoothstep(0.28, 0.9, open)

  const parts = []
  parts.push(`<polygon points="${pts(corners)}" fill="${wellFill}"/>`)
  if (open > 0.1) {
    parts.push(
      `<polygon points="${pts(corners.map((p) => [lerp(p[0], cx, 0.22), lerp(p[1], cy, 0.22)]))}" fill="${wellFloor}" opacity="${(appear * (0.18 + open * 0.38)).toFixed(3)}"/>`,
    )
  }
  parts.push(
    `<polygon points="${pts(sideL)}" fill="${sideFillL}" stroke="${lidStroke}" stroke-width="${(0.65 * scale).toFixed(2)}"/>`,
  )
  parts.push(
    `<polygon points="${pts(sideR)}" fill="${sideFillR}" stroke="${lidStroke}" stroke-width="${(0.65 * scale).toFixed(2)}"/>`,
  )
  parts.push(
    `<polygon points="${pts(frontFace)}" fill="${faceFill}" stroke="${lidStroke}" stroke-width="${(1.0 * scale).toFixed(2)}"/>`,
  )
  if (lampReveal > 0.02 && faceHt > 4.5) {
    const half = Math.max(2.0, lampSize * 0.5)
    const rx = Math.max(0.6, half * 0.16)
    parts.push(
      `<rect x="${(faceC[0] - half).toFixed(2)}" y="${(faceC[1] - half).toFixed(2)}" width="${(half * 2).toFixed(2)}" height="${(half * 2).toFixed(2)}" rx="${rx.toFixed(2)}" fill="#ebe5d6" stroke="${lidStroke}" stroke-width="${(0.9 * scale).toFixed(2)}" opacity="${lampReveal.toFixed(3)}"/>`,
      `<rect x="${(faceC[0] - half * 0.45).toFixed(2)}" y="${(faceC[1] - half * 0.45).toFixed(2)}" width="${(half * 0.9).toFixed(2)}" height="${(half * 0.9).toFixed(2)}" rx="${(rx * 0.45).toFixed(2)}" fill="#ffffff" opacity="${(lampReveal * 0.4).toFixed(3)}"/>`,
    )
  }
  parts.push(
    `<polygon points="${pts(lidTop)}" fill="${lidFill}" stroke="${lidStroke}" stroke-width="${(1.2 * scale).toFixed(2)}"/>`,
  )
  parts.push(
    `<line x1="${hingeL[0]}" y1="${hingeL[1]}" x2="${hingeR[0]}" y2="${hingeR[1]}" stroke="#2a2a2c" stroke-width="${(1.2 * scale).toFixed(2)}" opacity="${(appear * (0.3 + open * 0.35)).toFixed(3)}"/>`,
  )
  return parts
}

function overlaySvg(openNear, openFar) {
  const parts = []
  parts.push(...podSvgParts(pods[1].pod, openFar, pods[1].scale))
  parts.push(...podSvgParts(pods[0].pod, openNear, pods[0].scale))
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`,
  )
}

/** Foreshortened graphite lid texture about the hinge (continuous, no pop). */
async function lidTextureLayer(pod, open) {
  if (open < 0.02 || open > 0.95) return null
  const cos = Math.cos(open * pod.maxAng)
  // Keep most of the panel early; compress toward hinge as it opens
  const newH = Math.max(2, Math.round(pod.box.h * (0.18 + 0.82 * cos)))
  const texOp = (1 - smoothstep(0.55, 0.92, open)) * smoothstep(0.02, 0.2, open)
  if (texOp < 0.03) return null
  const warped = await sharp(pod.lidPatch)
    .resize(pod.box.w, newH, { fit: 'fill' })
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from(
          `<svg width="${pod.box.w}" height="${newH}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="white" opacity="${texOp.toFixed(3)}"/>
          </svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()
  const top = Math.max(0, Math.round(Math.min(pod.hingeL[1], pod.hingeR[1]) - 1))
  return { input: warped, left: pod.box.x, top }
}

async function writeFrame(file, tNear, tFar = tNear) {
  if (tNear <= 0.001 && tFar <= 0.001) {
    await sharp(base).toFile(file)
    return
  }
  const openNear = easeInOut(Math.max(0, Math.min(1, tNear)))
  const openFar = easeInOut(Math.max(0, Math.min(1, tFar)))
  const layers = [{ input: overlaySvg(openNear, openFar), top: 0, left: 0 }]
  // Texture after SVG so graphite sits on the lids
  const farTex = await lidTextureLayer(farPod, openFar)
  const nearTex = await lidTextureLayer(nearPod, openNear)
  if (farTex) layers.push(farTex)
  if (nearTex) layers.push(nearTex)
  await sharp(base).composite(layers).png().toFile(file)
}

const FAR_LAG = 0.05
function farT(t) {
  return Math.max(0, Math.min(1, (t - FAR_LAG) / (1 - FAR_LAG)))
}

let n = 0
for (let i = 0; i < HOLD0; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0, 0)
for (let i = 0; i < OPEN_N; i++, n++) {
  const t = (i + 1) / OPEN_N
  await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), t, farT(t))
}
for (let i = 0; i < HOLD_UP; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 1, 1)
for (let i = 0; i < CLOSE_N; i++, n++) {
  const t = 1 - (i + 1) / CLOSE_N
  await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), t, farT(t))
}
for (let i = 0; i < HOLD1; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0, 0)

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
    <polygon points="${pts(NEAR)}" fill="#00aa0066" stroke="#00aa00" stroke-width="2"/>
    <polygon points="${pts(FAR)}" fill="#0088ff66" stroke="#0088ff" stroke-width="2"/>
  </svg>`)
  const footFull = path.join(TMP, 'foot.png')
  await sharp(base).composite([{ input: foot, top: 0, left: 0 }]).png().toFile(footFull)
  await sharp(footFull).jpeg({ quality: 90 }).toFile(path.join(ART, 'hl-footprint.jpg'))
  await sharp(footFull)
    .extract({ left: 480, top: 370, width: 340, height: 90 })
    .resize(1360, 360, { kernel: 'nearest' })
    .jpeg({ quality: 94 })
    .toFile(path.join(ART, 'hl-footprint-zoom.jpg'))
}

for (const [name, t] of [
  ['hl-mech-closed', 0],
  ['hl-mech-q1', 0.22],
  ['hl-mech-mid', 0.55],
  ['hl-mech-open', 1],
]) {
  const tmp = path.join(TMP, `${name}.png`)
  await writeFrame(tmp, t, farT(t))
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
    '-loop', '1', '-t', '0.9', '-i', path.join(ART, 'hl-mech-closed-zoom.jpg'),
    '-loop', '1', '-t', '0.85', '-i', path.join(ART, 'hl-mech-q1-zoom.jpg'),
    '-loop', '1', '-t', '0.85', '-i', path.join(ART, 'hl-mech-mid-zoom.jpg'),
    '-loop', '1', '-t', '1.3', '-i', path.join(ART, 'hl-mech-open-zoom.jpg'),
    '-loop', '1', '-t', '0.85', '-i', path.join(ART, 'hl-mech-mid-zoom.jpg'),
    '-loop', '1', '-t', '0.85', '-i', path.join(ART, 'hl-mech-q1-zoom.jpg'),
    '-loop', '1', '-t', '0.9', '-i', path.join(ART, 'hl-mech-closed-zoom.jpg'),
    '-filter_complex', '[0][1][2][3][4][5][6]concat=n=7:v=1:a=0,format=yuv420p',
    '-movflags', '+faststart',
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
  const y0 = Math.max(0, Math.min(...ys) - 80)
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

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`wrote ${n} frames → public/sketch/fc-loop.{webm,mp4}`)
console.log('NEAR', JSON.stringify(NEAR))
console.log('FAR', JSON.stringify(FAR))
