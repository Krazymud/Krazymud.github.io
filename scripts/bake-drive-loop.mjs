#!/usr/bin/env node
/**
 * Bake FC drive loop from keyframes + dense in-between stills (frame sequence).
 *
 * Reads:
 *   docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/manifest.json
 *
 * Each listed frame is held for `holdFrames` @ `fps`, with a short
 * `dissolveFrames` crossfade into the next. Output: public/sketch/fc-drive-loop.{webm,mp4}
 * Target duration: 8–12s.
 */
import { access, mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const manifestPath = path.join(
  root,
  "docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/manifest.json",
)
const outDir = path.join(root, "public/sketch")
const webm = path.join(outDir, "fc-drive-loop.webm")
const mp4 = path.join(outDir, "fc-drive-loop.mp4")

const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const fps = Number(manifest.fps) || 24
const holdFrames = Number(manifest.holdFrames) || 3
const dissolveFrames = Number(manifest.dissolveFrames) || 2
const outWidth = Number(manifest.outWidth) || 1600
const holdSec = holdFrames / fps
const fadeSec = dissolveFrames / fps

if (!Array.isArray(manifest.frames) || manifest.frames.length < 2) {
  console.error("manifest.frames must list at least 2 images")
  process.exit(1)
}

const absFrames = manifest.frames.map((rel) =>
  path.resolve(path.dirname(manifestPath), rel),
)

for (const file of absFrames) {
  try {
    await access(file)
  } catch {
    console.error(`missing frame: ${file}`)
    process.exit(1)
  }
}

const scale = `scale=${outWidth}:-2:flags=lanczos,format=yuv420p,fps=${fps}`

function buildXfadeFilter(n) {
  const parts = []
  for (let i = 0; i < n; i++) {
    parts.push(`[${i}:v]${scale}[v${i}]`)
  }
  let prev = "v0"
  let elapsed = holdSec
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "vout" : `vx${i}`
    const offset = Math.max(0, elapsed - fadeSec)
    parts.push(
      `[${prev}][v${i}]xfade=transition=fade:duration=${fadeSec.toFixed(4)}:offset=${offset.toFixed(4)}[${out}]`,
    )
    elapsed = elapsed + holdSec - fadeSec
    prev = out
  }
  return { filter: parts.join(";"), duration: elapsed }
}

function runFfmpeg(outputPath, vcodec, extraArgs) {
  const inputs = absFrames.flatMap((file) => [
    "-loop",
    "1",
    "-t",
    String(holdSec),
    "-i",
    file,
  ])
  const { filter, duration } = buildXfadeFilter(absFrames.length)
  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    filter,
    "-map",
    "[vout]",
    "-an",
    "-c:v",
    vcodec,
    ...extraArgs,
    outputPath,
  ]
  console.log(`encoding ${path.basename(outputPath)} (~${duration.toFixed(2)}s)…`)
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" })
  if (r.status !== 0) process.exit(r.status ?? 1)
  return duration
}

await mkdir(outDir, { recursive: true })
runFfmpeg(webm, "libvpx-vp9", ["-b:v", "0", "-crf", "32"])
// main + faststart: iPhone Safari/WeChat need moov before mdat or they stick on frame 0
// until the whole file downloads.
runFfmpeg(mp4, "libx264", [
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "main",
  "-level",
  "4.0",
  "-crf",
  "23",
  "-movflags",
  "+faststart",
])

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size",
    "-of",
    "default=noprint_wrappers=1",
    webm,
  ],
  { encoding: "utf8" },
)
console.log(probe.stdout)
const duration = Number(
  /duration=([0-9.]+)/.exec(probe.stdout)?.[1] ?? NaN,
)
if (!(duration >= 8 && duration <= 12)) {
  console.error(`duration ${duration}s outside 8–12s; adjust holdFrames/dissolveFrames`)
  process.exit(1)
}

const mp4Bytes = await readFile(mp4)
const moovAt = mp4Bytes.indexOf(Buffer.from("moov"))
const mdatAt = mp4Bytes.indexOf(Buffer.from("mdat"))
if (moovAt < 0 || mdatAt < 0 || moovAt > mdatAt) {
  console.error(`mp4 is not faststart (moov@${moovAt}, mdat@${mdatAt}); iOS will stick on frame 0`)
  process.exit(1)
}
