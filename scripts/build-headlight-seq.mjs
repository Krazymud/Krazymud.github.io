/**
 * FC3S headlight loop — graphite pencil redraw for 青庐·纸窗.
 *
 * Source: sketch-src/hl/fc3s-ref-drive.mp4
 *   trimmed from Bilibili BV1JM411x7yC @ t≥55s (car fills frame)
 *
 * Pipeline:
 *   1) Zoom-crop car hero (cuts left sidewalk pedestrians)
 *   2) Cut full dual-close snap (open → flush); optical-flow slow-mo; reverse = open
 *   3) Low-sat graphite grade (warm paper wash + pencil lines — not cel / sepia wash)
 *   4) Soft vignette to hide residual walkers
 *   5) Compose 8s @ 24fps loop with long closed bookends → public/sketch/*
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
const REF = path.join(root, 'sketch-src/hl/fc3s-ref-drive.mp4')
const OUT_PUBLIC = path.join(root, 'public/sketch')
const ART = '/opt/cursor/artifacts'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fc3s-manga-'))
const SNAP = path.join(TMP, 'snap.mp4')
const RAW = path.join(TMP, 'raw')
const SKETCH = path.join(TMP, 'sketch')
const SEQ = path.join(TMP, 'seq')
const OPEN_PLATE = path.join(TMP, 'open-plate.jpg')
const CLOSED_PLATE = path.join(TMP, 'closed-plate.jpg')
for (const d of [RAW, SKETCH, SEQ, ART, OUT_PUBLIC]) fs.mkdirSync(d, { recursive: true })

if (!fs.existsSync(REF)) {
  console.error('Missing reference clip:', REF)
  console.error('Expect BV1JM411x7yC segment from t≥55s at sketch-src/hl/fc3s-ref-drive.mp4')
  process.exit(1)
}

const W = 1600
const H = 900
const FPS = 24
const TOTAL = 8 * FPS

/**
 * In fc3s-ref-drive.mp4 (original t=55…66s):
 *   ~0–5.4s  headlights up + lit
 *   ~5.5–6.1s dual close (open → flush)
 *   ~6.2s+    lids closed
 */
const OPEN_PLATE_T = 5.05
const CLOSED_PLATE_T = 7.8
const SNAP_START = 5.48
const SNAP_DUR = 0.72
const SLOW = 5

/** Balanced loop: long closed bookends so open→close reads and seams cleanly. */
const HOLD0 = Math.round(1.2 * FPS) // closed
const OPEN_N = Math.round(1.6 * FPS)
const HOLD_UP = Math.round(1.2 * FPS) // open
const CLOSE_N = Math.round(2.0 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN_N - HOLD_UP - CLOSE_N // ~2.0s closed
if (HOLD1 < Math.round(1.2 * FPS)) {
  console.error('HOLD1 too short:', HOLD1)
  process.exit(1)
}

/**
 * Zoom into the car and bias crop right/low so the left sidewalk (walkers) is out.
 * Source is ~16:9 — without extra zoom, crop X has almost no room.
 */
const ZOOM_W = Math.round(W * 1.5)
const ZOOM_H = Math.round(H * 1.5)
const scaleCrop =
  `scale=${ZOOM_W}:${ZOOM_H}:force_original_aspect_ratio=increase,` +
  `crop=${W}:${H}:(iw-ow)*0.94:(ih-oh)*0.74`

function grabPlate(t, out) {
  // Accurate seek: -ss after -i
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-err_detect',
      'ignore_err',
      '-i',
      REF,
      '-ss',
      String(t),
      '-frames:v',
      '1',
      '-vf',
      scaleCrop,
      '-q:v',
      '2',
      '-update',
      '1',
      out,
    ],
    { stdio: 'inherit' },
  )
}

console.log('grabbing open/closed plates from drive segment…')
grabPlate(OPEN_PLATE_T, OPEN_PLATE)
grabPlate(CLOSED_PLATE_T, CLOSED_PLATE)

console.log('cutting full dual-close snap (open → flush)…')
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-err_detect',
    'ignore_err',
    '-i',
    REF,
    '-ss',
    String(SNAP_START),
    '-t',
    String(SNAP_DUR),
    '-vf',
    scaleCrop,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '17',
    '-an',
    SNAP,
  ],
  { stdio: 'inherit' },
)

console.log(`optical-flow slow-mo ×${SLOW} (close arc)…`)
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    SNAP,
    '-vf',
    `setpts=${SLOW}*PTS,minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
    '-q:v',
    '2',
    path.join(RAW, 'c%03d.jpg'),
  ],
  { stdio: 'inherit' },
)

const closeFiles = fs
  .readdirSync(RAW)
  .filter((f) => f.startsWith('c') && f.endsWith('.jpg'))
  .sort()
if (closeFiles.length < 8) {
  console.error('Too few close-arc frames:', closeFiles.length)
  process.exit(1)
}
console.log(`close-arc frames: ${closeFiles.length}`)

/**
 * Graphite pencil on warm paper:
 * desaturate night footage, lift midtones toward paper, soft pencil edges.
 */
function mangaFilterComplex() {
  return [
    '[0:v]hqdn3d=7:5:9:6,bilateral=sigmaS=2.8:sigmaR=0.05,' +
      'eq=contrast=1.22:saturation=0.14:brightness=0.22:gamma=0.88[flat]',
    '[flat]colorbalance=rs=0.05:rm=0.03:gs=0.02:bs=-0.04:bm=-0.02,' +
      `curves=all='0/0.1 0.35/0.42 0.7/0.82 1/0.98'[grade]`,
    '[grade]split[b][e]',
    '[e]format=gray,edgedetect=mode=colormix:low=0.045:high=0.13,negate,' +
      'eq=contrast=2.6:brightness=-0.08,gblur=sigma=0.3[lines]',
    '[b][lines]blend=all_mode=multiply:all_opacity=0.38,' +
      'eq=saturation=0.22:contrast=1.08,unsharp=5:5:0.9',
  ].join(';')
}

function stylize(inputPattern, outPattern) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      inputPattern,
      '-filter_complex',
      mangaFilterComplex(),
      '-q:v',
      '2',
      outPattern,
    ],
    { stdio: 'inherit' },
  )
}

function stylizeOne(input, out) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      input,
      '-filter_complex',
      mangaFilterComplex(),
      '-q:v',
      '2',
      '-update',
      '1',
      out,
    ],
    { stdio: 'inherit' },
  )
}

/**
 * Soft vignette: darken left edge + upper sky/fence so walkers fade out
 * without hard composite bands.
 */
async function scrubWalkers(input, out) {
  const meta = await sharp(input).metadata()
  const width = meta.width || W
  const height = meta.height || H
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2a2824" stop-opacity="0.55"/>
          <stop offset="30%" stop-color="#2a2824" stop-opacity="0.18"/>
          <stop offset="48%" stop-color="#2a2824" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#2a2824" stop-opacity="0.4"/>
          <stop offset="10%" stop-color="#2a2824" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f7f4ec" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#f7f4ec" stop-opacity="0.32"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#paper)"/>
      <rect width="100%" height="100%" fill="url(#top)"/>
      <rect width="100%" height="100%" fill="url(#left)"/>
    </svg>`,
  )
  await sharp(input)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(out)
}

console.log('graphite paper-window redraw…')
const openRaw = path.join(TMP, 'open-raw.jpg')
const closedRaw = path.join(TMP, 'closed-raw.jpg')
stylizeOne(OPEN_PLATE, openRaw)
stylizeOne(CLOSED_PLATE, closedRaw)
stylize(path.join(RAW, 'c%03d.jpg'), path.join(SKETCH, 'c%03d.jpg'))

const openManga = path.join(TMP, 'open-manga.jpg')
const closedManga = path.join(TMP, 'closed-manga.jpg')
await scrubWalkers(openRaw, openManga)
await scrubWalkers(closedRaw, closedManga)

const sketchClose = fs
  .readdirSync(SKETCH)
  .filter((f) => f.startsWith('c') && f.endsWith('.jpg'))
  .sort()
const scrubDir = path.join(TMP, 'scrub')
fs.mkdirSync(scrubDir, { recursive: true })
for (const f of sketchClose) {
  await scrubWalkers(path.join(SKETCH, f), path.join(scrubDir, f))
}
const scrubClose = fs
  .readdirSync(scrubDir)
  .filter((f) => f.startsWith('c') && f.endsWith('.jpg'))
  .sort()
const arcN = scrubClose.length

/** t=0 open … t=1 closed along the real close arc */
function sampleClose(t) {
  const idx = Math.min(arcN - 1, Math.max(0, Math.round(t * (arcN - 1))))
  return path.join(scrubDir, scrubClose[idx])
}

function easeInOut(t) {
  return t * t * (3 - 2 * t)
}

console.log(
  `composing 8s loop… hold0=${HOLD0} open=${OPEN_N} holdUp=${HOLD_UP} close=${CLOSE_N} hold1=${HOLD1}`,
)
await sharp(closedManga).webp({ quality: 88 }).toFile(path.join(OUT_PUBLIC, 'fc-still.webp'))
await sharp(closedManga).jpeg({ quality: 92 }).toFile(path.join(ART, 'fc3s-manga-still.jpg'))
await sharp(openManga).jpeg({ quality: 92 }).toFile(path.join(ART, 'fc3s-manga-open.jpg'))

let n = 0
const copyFrame = (src, i) => {
  fs.copyFileSync(src, path.join(SEQ, `f${String(i).padStart(4, '0')}.jpg`))
}

// closed hold
for (let i = 0; i < HOLD0; i++, n++) copyFrame(closedManga, n)
// open = reverse of close arc (closed→open), end on open plate
for (let i = 0; i < OPEN_N; i++, n++) {
  const t = easeInOut(1 - (i + 1) / OPEN_N) // 1→0 along close arc
  copyFrame(i === OPEN_N - 1 ? openManga : sampleClose(t), n)
}
// open hold
for (let i = 0; i < HOLD_UP; i++, n++) copyFrame(openManga, n)
// close = forward close arc → closed plate
for (let i = 0; i < CLOSE_N; i++, n++) {
  const t = easeInOut((i + 1) / CLOSE_N)
  copyFrame(i === CLOSE_N - 1 ? closedManga : sampleClose(t), n)
}
// closed hold (must be long enough for a readable loop seam)
for (let i = 0; i < HOLD1; i++, n++) copyFrame(closedManga, n)

const pattern = path.join(SEQ, 'f%04d.jpg')
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
    '34',
    '-pix_fmt',
    'yuv420p',
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
    '20',
    '-movflags',
    '+faststart',
    '-an',
    '-t',
    '8',
    path.join(OUT_PUBLIC, 'fc-loop.mp4'),
  ],
  { stdio: 'inherit' },
)

// QA zooms — car front
for (const [name, src] of [
  ['closed', closedManga],
  ['open', openManga],
  ['q1', sampleClose(0.75)],
  ['mid', sampleClose(0.45)],
]) {
  await sharp(src)
    .extract({ left: 280, top: 180, width: 1040, height: 580 })
    .resize(1080, 600)
    .jpeg({ quality: 92 })
    .toFile(path.join(ART, `hl-mech-${name}-zoom.jpg`))
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
    path.join(ART, 'headlight-hinge-demo.mp4'),
  ],
  { stdio: 'inherit' },
)

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
    '20',
    '-movflags',
    '+faststart',
    '-an',
    path.join(ART, 'headlight-loop-preview.mp4'),
  ],
  { stdio: 'inherit' },
)

fs.copyFileSync(path.join(ART, 'hl-mech-open-zoom.jpg'), path.join(ART, 'headlight-open-zoom.jpg'))
fs.copyFileSync(path.join(ART, 'hl-mech-mid-zoom.jpg'), path.join(ART, 'headlight-mid-zoom.jpg'))
fs.copyFileSync(path.join(ART, 'hl-mech-q1-zoom.jpg'), path.join(ART, 'headlight-q1-zoom.jpg'))
fs.copyFileSync(path.join(ART, 'hl-mech-closed-zoom.jpg'), path.join(ART, 'headlight-closed-zoom.jpg'))

// Loop key strip for QA: closed → open → open-hold → mid-close → closed
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    path.join(OUT_PUBLIC, 'fc-loop.mp4'),
    '-vf',
    `select='eq(n\\,0)+eq(n\\,${HOLD0 + Math.round(OPEN_N / 2)})+eq(n\\,${HOLD0 + OPEN_N + 2})+eq(n\\,${HOLD0 + OPEN_N + HOLD_UP + Math.round(CLOSE_N / 2)})+eq(n\\,${TOTAL - 3})',` +
      'scale=360:-2,tile=5x1',
    '-frames:v',
    '1',
    '-update',
    '1',
    path.join(ART, 'manga-loop-key-strip.jpg'),
  ],
  { stdio: 'inherit' },
)

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    path.join(scrubDir, 'c%03d.jpg'),
    '-vf',
    'scale=180:-1,tile=10x5',
    '-update',
    '1',
    '-frames:v',
    '1',
    path.join(ART, 'fc3s-manga-arc-strip.jpg'),
  ],
  { stdio: 'inherit' },
)

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`wrote ${n} frames → public/sketch/fc-still.webp + fc-loop.{webm,mp4}`)
console.log('source: BV1JM411x7yC @t≥55s → sketch-src/hl/fc3s-ref-drive.mp4')
console.log('style: graphite pencil on warm paper; loop closed→open→close→closed')
console.log(
  `timing: closed ${HOLD0 / FPS}s | open ${OPEN_N / FPS}s | hold ${HOLD_UP / FPS}s | close ${CLOSE_N / FPS}s | closed ${HOLD1 / FPS}s`,
)
