/**
 * FC3S headlight loop — full redraw from real video (no still SVG overlays).
 *
 * Source: sketch-src/hl/fc3s-ref-open.mp4
 *   trimmed from Bilibili BV1JM411x7yC (马自达RX-7 FC3S 转子引擎启动)
 *
 * Pipeline:
 *   1) Cut the real dual-sync open snap from the clip
 *   2) Optical-flow slow-mo so the mechanical arc is readable
 *   3) Graphite redraw onto site paper tone
 *   4) Compose closed → open → hold → close → closed (8s @ 24fps)
 *   5) Write public/sketch/fc-still.webp + fc-loop.{webm,mp4}
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
const REF = path.join(root, 'sketch-src/hl/fc3s-ref-open.mp4')
const OUT_PUBLIC = path.join(root, 'public/sketch')
const ART = '/opt/cursor/artifacts'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fc3s-redraw-'))
const SNAP = path.join(TMP, 'snap.mp4')
const RAW = path.join(TMP, 'raw')
const SKETCH = path.join(TMP, 'sketch')
const SEQ = path.join(TMP, 'seq')
for (const d of [RAW, SKETCH, SEQ, ART, OUT_PUBLIC]) fs.mkdirSync(d, { recursive: true })

if (!fs.existsSync(REF)) {
  console.error('Missing reference clip:', REF)
  process.exit(1)
}

const W = 1600
const H = 900
const FPS = 24
const TOTAL = 8 * FPS

/**
 * In fc3s-ref-open.mp4 (original video t=20…30s):
 * lids flush ~4.4–4.85s, dual snap open ~4.90s, lit hold after.
 */
const CUT_START = 4.4
const CUT_DUR = 1.05
const SLOW = 4.5

const HOLD0 = Math.round(1.0 * FPS)
const OPEN_N = Math.round(2.4 * FPS)
const HOLD_UP = Math.round(1.8 * FPS)
const CLOSE_N = Math.round(2.4 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN_N - HOLD_UP - CLOSE_N

const scaleCrop = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`

console.log('cutting FC3S open snap from reference…')
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-err_detect',
    'ignore_err',
    '-ss',
    String(CUT_START),
    '-i',
    REF,
    '-t',
    String(CUT_DUR),
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

console.log(`optical-flow slow-mo ×${SLOW}…`)
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
    path.join(RAW, 'a%03d.jpg'),
  ],
  { stdio: 'inherit' },
)

const rawFiles = fs
  .readdirSync(RAW)
  .filter((f) => f.endsWith('.jpg'))
  .sort()
if (rawFiles.length < 12) {
  console.error('Too few slow-mo frames:', rawFiles.length)
  process.exit(1)
}
console.log(`slow-mo frames: ${rawFiles.length}`)

/** Night → graphite on cream paper (#f1ebdd). */
function graphiteFilterComplex() {
  return [
    '[0:v]eq=contrast=1.45:brightness=0.38:gamma=0.78,format=gray,eq=contrast=0.92:brightness=0.12[base]',
    '[0:v]eq=contrast=1.7:brightness=0.35:gamma=0.7,format=gray,edgedetect=mode=colormix:low=0.03:high=0.1,negate[edges]',
    `[base][edges]blend=all_mode=multiply:all_opacity=0.85,` +
      `colorchannelmixer=rr=0.90:rg=0.05:rb=0.02:gr=0.06:gg=0.84:gb=0.04:br=0.04:bg=0.05:bb=0.72,` +
      `curves=r='0/0.10 0.55/0.62 1/0.96':g='0/0.09 0.55/0.58 1/0.93':b='0/0.07 0.55/0.50 1/0.88'`,
  ].join(';')
}

console.log('redrawing as graphite…')
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    path.join(RAW, 'a%03d.jpg'),
    '-filter_complex',
    graphiteFilterComplex(),
    '-q:v',
    '2',
    path.join(SKETCH, 's%03d.jpg'),
  ],
  { stdio: 'inherit' },
)

const sketchFiles = fs
  .readdirSync(SKETCH)
  .filter((f) => f.endsWith('.jpg'))
  .sort()
const arcN = sketchFiles.length

function sampleArc(t) {
  const idx = Math.min(arcN - 1, Math.max(0, Math.round(t * (arcN - 1))))
  return path.join(SKETCH, sketchFiles[idx])
}

function easeInOut(t) {
  return t * t * (3 - 2 * t)
}

console.log('composing 8s loop…')
const closedSrc = sampleArc(0)
await sharp(closedSrc).webp({ quality: 86 }).toFile(path.join(OUT_PUBLIC, 'fc-still.webp'))
await sharp(closedSrc).jpeg({ quality: 92 }).toFile(path.join(ART, 'fc3s-redraw-still.jpg'))

let n = 0
const copyFrame = (src, i) => {
  fs.copyFileSync(src, path.join(SEQ, `f${String(i).padStart(4, '0')}.jpg`))
}

for (let i = 0; i < HOLD0; i++, n++) copyFrame(sampleArc(0), n)
for (let i = 0; i < OPEN_N; i++, n++) copyFrame(sampleArc(easeInOut((i + 1) / OPEN_N)), n)
for (let i = 0; i < HOLD_UP; i++, n++) copyFrame(sampleArc(1), n)
for (let i = 0; i < CLOSE_N; i++, n++) copyFrame(sampleArc(easeInOut(1 - (i + 1) / CLOSE_N)), n)
for (let i = 0; i < HOLD1; i++, n++) copyFrame(sampleArc(0), n)

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
    '36',
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
    '22',
    '-movflags',
    '+faststart',
    '-an',
    '-t',
    '8',
    path.join(OUT_PUBLIC, 'fc-loop.mp4'),
  ],
  { stdio: 'inherit' },
)

for (const [name, t] of [
  ['closed', 0],
  ['q1', 0.22],
  ['mid', 0.55],
  ['open', 1],
]) {
  const src = sampleArc(t)
  await sharp(src)
    .extract({ left: 380, top: 200, width: 900, height: 500 })
    .resize(1080, 600)
    .jpeg({ quality: 92 })
    .toFile(path.join(ART, `hl-mech-${name}-zoom.jpg`))
  await sharp(src).jpeg({ quality: 90 }).toFile(path.join(ART, `hl-mech-${name}.jpg`))
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
    '22',
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

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    path.join(SKETCH, 's%03d.jpg'),
    '-vf',
    'crop=iw*0.5:ih*0.36:iw*0.25:ih*0.26,scale=160:-1,tile=10x6',
    '-update',
    '1',
    '-frames:v',
    '1',
    path.join(ART, 'fc3s-sketch-arc-strip.jpg'),
  ],
  { stdio: 'inherit' },
)
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    path.join(RAW, 'a%03d.jpg'),
    '-vf',
    'crop=iw*0.5:ih*0.36:iw*0.25:ih*0.26,scale=160:-1,tile=10x6',
    '-update',
    '1',
    '-frames:v',
    '1',
    path.join(ART, 'fc3s-raw-arc-strip.jpg'),
  ],
  { stdio: 'inherit' },
)

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`wrote ${n} frames → public/sketch/fc-still.webp + fc-loop.{webm,mp4}`)
console.log('source: Bilibili BV1JM411x7yC → sketch-src/hl/fc3s-ref-open.mp4')
console.log('method: video snap + optical-flow slow-mo + graphite redraw')
