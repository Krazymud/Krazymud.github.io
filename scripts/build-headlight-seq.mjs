/**
 * Mechanical pop-up headlight loop: body locked to fc-still.webp every frame;
 * hinged pods rotate open/closed in place (no whole-frame dissolve).
 *
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
const OPEN = Math.round(1.8 * FPS)
const HOLD_UP = Math.round(2.0 * FPS)
const CLOSE = Math.round(1.8 * FPS)
const HOLD1 = TOTAL - HOLD0 - OPEN - HOLD_UP - CLOSE

/**
 * Trapezoid lids on fc-still.webp (1600×900).
 * Corners: rear-left, rear-right, front-right, front-left (hinge = rear edge).
 */
const PODS = [
  {
    id: 'near',
    corners: [
      [470, 398],
      [582, 405],
      [555, 445],
      [455, 438],
    ],
    side: 'left',
  },
  {
    id: 'far',
    corners: [
      [575, 385],
      [655, 380],
      [640, 418],
      [560, 422],
    ],
    side: 'right',
  },
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

function lerp2(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
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

function bboxOf(corners, pad = 2) {
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const x = Math.max(0, Math.floor(Math.min(...xs) - pad))
  const y = Math.max(0, Math.floor(Math.min(...ys) - pad))
  const x2 = Math.ceil(Math.max(...xs) + pad)
  const y2 = Math.ceil(Math.max(...ys) + pad)
  return { x, y, w: x2 - x, h: y2 - y }
}

async function sampleColor(imgPath, box) {
  const { data, info } = await sharp(imgPath)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .resize(8, 8, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let r = 0,
    g = 0,
    b = 0,
    n = 0
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    n++
  }
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
  }
}

function cssRgb({ r, g, b }, shade = 0) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + shade)))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

/**
 * Rotate point P about hinge point H by angle (radians) in the
 * (forward, up) basis where forward = closed front direction.
 */
function rotateAboutHinge(p, hinge, forward, up, ang) {
  const v = sub(p, hinge)
  const x = v[0] * forward[0] + v[1] * forward[1]
  const y = v[0] * up[0] + v[1] * up[1]
  const cos = Math.cos(ang)
  const sin = Math.sin(ang)
  const xr = x * cos - y * sin
  const yr = x * sin + y * cos
  return add(hinge, add(mul(forward, xr), mul(up, yr)))
}

/** Pod geometry at open 0..1 — rigid rotation about rear hinge */
function podGeom(pod, open) {
  const [rl, rr, fr, fl] = pod.corners
  const hinge = mid(rl, rr)
  const front0 = mid(fl, fr)
  const forward = norm(sub(front0, hinge))
  let up = [-forward[1], forward[0]]
  // Prefer image-up (negative Y) for "popping up"
  if (up[1] > 0) up = mul(up, -1)

  // 0 → flush, ~78° up when fully open
  const ang = open * (Math.PI / 2) * 0.87
  const cos = Math.cos(ang)
  const sin = Math.sin(ang)

  // Rigidly rotate front corners toward image-up; rear (hinge) stays put
  const fl2 = rotateAboutHinge(fl, hinge, forward, up, ang)
  const fr2 = rotateAboutHinge(fr, hinge, forward, up, ang)
  // Slight lift of rear edge so lid clears the hood skin
  const lift = open * 1.5
  const rl2 = add(rl, mul(up, lift))
  const rr2 = add(rr, mul(up, lift))

  const lidTop = [rl2, rr2, fr2, fl2]
  const well = [rl, rr, fr, fl]

  // Front face: from raised front edge down to original front edge (well lip)
  const frontFace = [fl2, fr2, fr, fl]

  // Side cheeks
  const outward = pod.side === 'left' ? norm(sub(fl, fr)) : norm(sub(fr, fl))
  const sideRaised = pod.side === 'left' ? fl2 : fr2
  const sideWell = pod.side === 'left' ? fl : fr
  const cheek =
    open > 0.04
      ? [
          sideWell,
          sideRaised,
          add(sideRaised, mul(outward, 4 + open * 8)),
          add(sideWell, mul(outward, 2 + open * 3)),
        ]
      : null

  // Lamp on front face centroid
  const faceC = [
    (fl2[0] + fr2[0] + fr[0] + fl[0]) / 4,
    (fl2[1] + fr2[1] + fr[1] + fl[1]) / 4,
  ]
  const faceW = len(sub(fr2, fl2)) * 0.5
  const faceH = len(sub(mid(fl2, fr2), mid(fl, fr)))
  const lamp = {
    cx: faceC[0],
    cy: faceC[1],
    rx: faceW * (0.5 + open * 0.12),
    ry: Math.max(3.5, faceH * 0.32 + open * 4),
  }

  return { well, lidTop, frontFace, cheek, lamp, cos, sin, open, ang }
}

function overlaySvg(width, height, t, colors) {
  const open = easeInOut(t)
  const parts = []

  for (let i = 0; i < PODS.length; i++) {
    const pod = PODS[i]
    const color = colors[i]
    const g = podGeom(pod, open)

    const lidFill = cssRgb(color, 6)
    const lidDark = cssRgb(color, -22)
    const lidStroke = cssRgb(color, -78)
    const wellFill = cssRgb(color, -110)
    const wellMid = cssRgb(color, -70)
    const cheekFill = cssRgb(color, -28)
    const faceFill = cssRgb(color, -40)

    // Opaque cover over closed lid drawing (critical — no ghost of closed panel)
    parts.push(
      `<polygon points="${pts(g.well)}" fill="${wellFill}" opacity="1"/>`,
    )
    // Soft floor of well
    const inset = g.well.map((p, idx) => {
      const c = [
        (g.well[0][0] + g.well[1][0] + g.well[2][0] + g.well[3][0]) / 4,
        (g.well[0][1] + g.well[1][1] + g.well[2][1] + g.well[3][1]) / 4,
      ]
      return lerp2(p, c, 0.18)
    })
    parts.push(
      `<polygon points="${pts(inset)}" fill="${wellMid}" opacity="${(0.35 + open * 0.35).toFixed(3)}"/>`,
    )

    // Front face (lamp housing) — grows with sin(open)
    const faceOp = smoothstep(0.05, 0.55, open)
    if (faceOp > 0.01) {
      parts.push(
        `<polygon points="${pts(g.frontFace)}" fill="${faceFill}" stroke="${lidStroke}" stroke-width="1.15" opacity="${faceOp.toFixed(3)}"/>`,
      )
    }

    // Lamp
    const lampOp = smoothstep(0.25, 0.8, open)
    if (lampOp > 0.01) {
      const { cx, cy, rx, ry } = g.lamp
      parts.push(
        `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${(rx * 1.3).toFixed(2)}" ry="${(ry * 1.4).toFixed(2)}" fill="#f6f1e4" opacity="${(lampOp * 0.3).toFixed(3)}"/>`,
        `<rect x="${(cx - rx).toFixed(2)}" y="${(cy - ry).toFixed(2)}" width="${(rx * 2).toFixed(2)}" height="${(ry * 2).toFixed(2)}" rx="${Math.min(rx, ry) * 0.2}" fill="#ebe5d6" stroke="${lidStroke}" stroke-width="1.15" opacity="${lampOp.toFixed(3)}"/>`,
        `<rect x="${(cx - rx * 0.52).toFixed(2)}" y="${(cy - ry * 0.42).toFixed(2)}" width="${(rx * 1.05).toFixed(2)}" height="${(ry * 0.8).toFixed(2)}" rx="1.5" fill="#ffffff" opacity="${(lampOp * 0.55).toFixed(3)}"/>`,
        `<line x1="${(cx - rx * 0.28).toFixed(2)}" y1="${(cy - ry * 0.65).toFixed(2)}" x2="${(cx - rx * 0.28).toFixed(2)}" y2="${(cy + ry * 0.65).toFixed(2)}" stroke="#9a968c" stroke-width="0.7" opacity="${(lampOp * 0.45).toFixed(3)}"/>`,
        `<line x1="${(cx + rx * 0.22).toFixed(2)}" y1="${(cy - ry * 0.65).toFixed(2)}" x2="${(cx + rx * 0.22).toFixed(2)}" y2="${(cy + ry * 0.65).toFixed(2)}" stroke="#9a968c" stroke-width="0.7" opacity="${(lampOp * 0.4).toFixed(3)}"/>`,
      )
    }

    // Side cheek
    if (g.cheek) {
      parts.push(
        `<polygon points="${pts(g.cheek)}" fill="${cheekFill}" stroke="${lidStroke}" stroke-width="1" opacity="${(0.65 + open * 0.3).toFixed(3)}"/>`,
      )
    }

    // Lid top — always opaque so it reads as a solid panel swinging up
    // When nearly closed, match hood; when open, slightly darker top
    const lidMix = open * 0.15
    parts.push(
      `<polygon points="${pts(g.lidTop)}" fill="${lidFill}" stroke="${lidStroke}" stroke-width="1.5" opacity="1"/>`,
    )
    // Darken leading underside edge
    const lip = [g.lidTop[3], g.lidTop[2], lerp2(g.lidTop[2], g.lidTop[1], 0.12), lerp2(g.lidTop[3], g.lidTop[0], 0.12)]
    parts.push(
      `<polygon points="${pts(lip)}" fill="${lidDark}" opacity="${(0.15 + open * 0.45).toFixed(3)}"/>`,
    )
    // Hatch lines on lid for graphite match
    for (const u of [0.3, 0.5, 0.7]) {
      const a = lerp2(g.lidTop[0], g.lidTop[3], u)
      const b = lerp2(g.lidTop[1], g.lidTop[2], u)
      parts.push(
        `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" stroke="${lidStroke}" stroke-width="0.65" opacity="${(0.12 + lidMix * 0.15).toFixed(3)}"/>`,
      )
    }

    // Hinge line
    parts.push(
      `<line x1="${g.lidTop[0][0].toFixed(2)}" y1="${g.lidTop[0][1].toFixed(2)}" x2="${g.lidTop[1][0].toFixed(2)}" y2="${g.lidTop[1][1].toFixed(2)}" stroke="#2a2a2c" stroke-width="1.5" opacity="${(0.45 + open * 0.35).toFixed(3)}"/>`,
    )

    // Cast shadow on hood behind hinge (toward windshield)
    if (open > 0.08) {
      const [rl, rr] = pod.corners
      let up = norm(sub(mid(g.lidTop[0], g.lidTop[1]), mid(rl, rr)))
      if (len(up) < 0.1) {
        const forward = norm(sub(mid(pod.corners[3], pod.corners[2]), mid(rl, rr)))
        up = [-forward[1], forward[0]]
        if (up[1] > 0) up = mul(up, -1)
      }
      const shadow = [
        rl,
        rr,
        add(rr, mul(up, 6 + open * 14)),
        add(rl, mul(up, 6 + open * 14)),
      ]
      parts.push(
        `<polygon points="${pts(shadow)}" fill="#2c2c2e" opacity="${(0.08 + open * 0.14).toFixed(3)}"/>`,
      )
    }
  }

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`,
  )
}

const meta = await sharp(CLOSED).metadata()
const width = meta.width
const height = meta.height
const base = await sharp(CLOSED).ensureAlpha().png().toBuffer()

const colors = []
for (const pod of PODS) {
  colors.push(await sampleColor(CLOSED, bboxOf(pod.corners, 0)))
}

async function writeFrame(file, t) {
  if (t <= 0.001) {
    await sharp(base).toFile(file)
    return
  }
  await sharp(base)
    .composite([{ input: overlaySvg(width, height, t, colors), top: 0, left: 0 }])
    .png()
    .toFile(file)
}

let n = 0
for (let i = 0; i < HOLD0; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0)
for (let i = 0; i < OPEN; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), (i + 1) / OPEN)
for (let i = 0; i < HOLD_UP; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 1)
for (let i = 0; i < CLOSE; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 1 - (i + 1) / CLOSE)
for (let i = 0; i < HOLD1; i++, n++) await writeFrame(path.join(SEQ, `f${String(n).padStart(4, '0')}.png`), 0)

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
    '40',
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
    '26',
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
  ['hl-mech-closed', 0],
  ['hl-mech-q1', 0.25],
  ['hl-mech-mid', 0.5],
  ['hl-mech-q3', 0.75],
  ['hl-mech-open', 1],
]) {
  const tmp = path.join(TMP, `${name}.png`)
  await writeFrame(tmp, t)
  fs.copyFileSync(tmp, path.join(ART, `${name}.png`))
  await sharp(tmp)
    .extract({ left: 430, top: 340, width: 280, height: 140 })
    .resize(840, 420)
    .jpeg({ quality: 92 })
    .toFile(path.join(ART, `${name}-zoom.jpg`))
}

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`wrote ${n} mechanical frames → public/sketch/fc-loop.{webm,mp4}`)
console.log(`timing hold0=${HOLD0} open=${OPEN} holdUp=${HOLD_UP} close=${CLOSE} hold1=${HOLD1}`)
