/**
 * FC3S headlight loop — Initial D manga cel-color redraw from drive footage.
 *
 * Source: sketch-src/hl/fc3s-ref-drive.mp4
 *   trimmed from Bilibili BV1JM411x7yC @ t≥55s (car fills frame, night street)
 *
 * Pipeline:
 *   1) Cut open-hold / close-snap / closed-hold from the drive clip
 *   2) Optical-flow slow-mo the dual close snap; reverse = open
 *   3) Manga cel-color redraw (bold line + cool night grade — not muddy sepia)
 *   4) Compose 8s @ 24fps loop → public/sketch/fc-still.webp + fc-loop.{webm,mp4}
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
 *   0–5.2s  headlights up + lit, car centered
 *   ~5.4s   dual close snap
 *   6s+     lids flush
 */
const OPEN_PLATE_T = 2.0
const CLOSED_PLATE_T = 7.5
const SNAP_START = 5.15
const SNAP_DUR = 0.55
const SLOW = 5

const HOLD0 = Math.round(1.0 * FPS)
const OPEN_N = Math.round(2.4 * FPS)
const HOLD_UP = Math.round(1.8 * FPS)
const CLOSE_N = Math.round(2.4 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN_N - HOLD_UP - CLOSE_N

/** Prefer lower-rightish crop so the driving car fills the frame as hero. */
const scaleCrop = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-ow)*0.58:(ih-oh)*0.78`

function grabPlate(t, out) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-err_detect',
      'ignore_err',
      '-ss',
      String(t),
      '-i',
      REF,
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

console.log('cutting dual close snap…')
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-err_detect',
    'ignore_err',
    '-ss',
    String(SNAP_START),
    '-i',
    REF,
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
 * Initial D–style manga cel color:
 * clean white body, cool night blues, warm lamp glow, thick ink lines,
 * hard 4-band cel shading (not muddy sepia / neon washout).
 */
function mangaFilterComplex() {
  return [
    // Kill grain → flatter regions for cel cuts
    '[0:v]gblur=sigma=1.6,eq=contrast=1.38:saturation=1.48:brightness=0.1:gamma=0.92[col]',
    // Cool night bias; keep highlight whites near-neutral
    '[col]colorchannelmixer=rr=1.06:gg=1.02:bb=1.12:rb=-0.02:gr=-0.02,' +
      'colorbalance=bs=0.14:bm=0.06:rs=-0.06:rm=-0.03:rh=0.02[grade]',
    // Hard cel bands (neutral highs, cool mids/shadows)
    `[grade]lutrgb=` +
      `r='if(lt(val,32),10,if(lt(val,80),55,if(lt(val,140),115,if(lt(val,195),175,248))))':` +
      `g='if(lt(val,32),12,if(lt(val,80),58,if(lt(val,140),118,if(lt(val,195),178,248))))':` +
      `b='if(lt(val,32),26,if(lt(val,80),78,if(lt(val,140),135,if(lt(val,195),188,250))))'[cel]`,
    // Thick ink outlines
    '[cel]split[b][e]',
    '[e]format=gray,edgedetect=mode=colormix:low=0.025:high=0.085,negate,' +
      'eq=contrast=4.2:brightness=-0.22,dilation,gblur=sigma=0.45[lines]',
    '[b][lines]blend=all_mode=multiply:all_opacity=0.68,' +
      `curves=r='0/0 0.4/0.36 0.75/0.78 1/1':g='0/0 0.4/0.38 0.75/0.8 1/1':b='0/0.05 0.4/0.45 0.75/0.85 1/1',` +
      'eq=saturation=1.18:contrast=1.16,unsharp=5:5:1.4:3:3:0.5',
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

console.log('manga cel-color redraw…')
const openManga = path.join(TMP, 'open-manga.jpg')
const closedManga = path.join(TMP, 'closed-manga.jpg')
stylizeOne(OPEN_PLATE, openManga)
stylizeOne(CLOSED_PLATE, closedManga)
stylize(path.join(RAW, 'c%03d.jpg'), path.join(SKETCH, 'c%03d.jpg'))

const sketchClose = fs
  .readdirSync(SKETCH)
  .filter((f) => f.startsWith('c') && f.endsWith('.jpg'))
  .sort()
const arcN = sketchClose.length

/** t=0 open … t=1 closed along the real close arc */
function sampleClose(t) {
  const idx = Math.min(arcN - 1, Math.max(0, Math.round(t * (arcN - 1))))
  return path.join(SKETCH, sketchClose[idx])
}

function easeInOut(t) {
  return t * t * (3 - 2 * t)
}

console.log('composing 8s loop…')
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
// closed hold
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
  ['q1', sampleClose(0.75)], // early open (near closed end of close-arc reversed)
  ['mid', sampleClose(0.45)],
]) {
  await sharp(src)
    .extract({ left: 300, top: 220, width: 1000, height: 560 })
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

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    path.join(SKETCH, 'c%03d.jpg'),
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
console.log('style: Initial D manga cel-color (cool night, bold line)')
