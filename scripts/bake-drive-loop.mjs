#!/usr/bin/env node
/**
 * Bake FC drive loop from keyframes + dense in-between stills (frame sequence).
 *
 * Reads:
 *   docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/manifest.json
 *
 * Each listed frame is held for `holdFrames` @ `fps`, with a short
 * `dissolveFrames` crossfade into the next.
 *
 * Outputs:
 *   public/sketch/fc-drive-loop.{webm,mp4}         — desktop / original width
 *   public/sketch/fc-drive-loop-mobile.{webm,mp4}  — phone dock lean encode
 *
 * Target duration: 8–12s. Both mp4s use +faststart (moov before mdat).
 */
import { access, mkdir, readFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const manifestPath = path.join(
  root,
  "docs/superpowers/assets/2026-10-14-qinglu-drive-inbetweens/manifest.json",
)
const outDir = path.join(root, "public/sketch")
const desktopWebm = path.join(outDir, "fc-drive-loop.webm")
const desktopMp4 = path.join(outDir, "fc-drive-loop.mp4")
const mobileWebm = path.join(outDir, "fc-drive-loop-mobile.webm")
const mobileMp4 = path.join(outDir, "fc-drive-loop-mobile.mp4")

const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const fps = Number(manifest.fps) || 24
const holdFrames = Number(manifest.holdFrames) || 3
const dissolveFrames = Number(manifest.dissolveFrames) || 2
const outWidth = Number(manifest.outWidth) || 1600
const mobileOutWidth = Number(manifest.mobileOutWidth) || 1280
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

function buildXfadeFilter(n, width) {
  const scale = `scale=${width}:-2:flags=lanczos,format=yuv420p,fps=${fps}`
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

function runFfmpeg(outputPath, width, vcodec, extraArgs) {
  const inputs = absFrames.flatMap((file) => [
    "-loop",
    "1",
    "-t",
    String(holdSec),
    "-i",
    file,
  ])
  const { filter, duration } = buildXfadeFilter(absFrames.length, width)
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
  console.log(`encoding ${path.basename(outputPath)} @${width} (~${duration.toFixed(2)}s)…`)
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" })
  if (r.status !== 0) process.exit(r.status ?? 1)
  return duration
}

function assertFaststart(filePath) {
  const bytes = readFileSync(filePath)
  const moovAt = bytes.indexOf("moov")
  const mdatAt = bytes.indexOf("mdat")
  if (moovAt < 0 || mdatAt < 0 || moovAt > mdatAt) {
    console.error(
      `${path.basename(filePath)} is not faststart (moov@${moovAt}, mdat@${mdatAt}); iOS will stick on frame 0`,
    )
    process.exit(1)
  }
  return bytes.byteLength
}

await mkdir(outDir, { recursive: true })

// Desktop: original width / quality.
runFfmpeg(desktopWebm, outWidth, "libvpx-vp9", ["-b:v", "0", "-crf", "32", "-row-mt", "1"])
runFfmpeg(desktopMp4, outWidth, "libx264", [
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "high",
  "-level",
  "4.0",
  "-crf",
  "23",
  "-movflags",
  "+faststart",
])

// Mobile: leaner for cellular start; 1280 is still sharp in the ~400px dock.
runFfmpeg(mobileWebm, mobileOutWidth, "libvpx-vp9", [
  "-b:v",
  "0",
  "-crf",
  "34",
  "-row-mt",
  "1",
])
runFfmpeg(mobileMp4, mobileOutWidth, "libx264", [
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "high",
  "-level",
  "4.0",
  "-crf",
  "26",
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
    desktopWebm,
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

assertFaststart(desktopMp4)
const mobileBytes = assertFaststart(mobileMp4)
const maxMobileMp4Bytes = 4.5 * 1024 * 1024
if (mobileBytes > maxMobileMp4Bytes) {
  console.error(
    `mobile mp4 is ${(mobileBytes / 1024 / 1024).toFixed(1)}MB (max ${maxMobileMp4Bytes / 1024 / 1024}MB); raise crf or lower mobileOutWidth`,
  )
  process.exit(1)
}
