#!/usr/bin/env node
/**
 * Bake FC drive animatic: six canon blue-pencil keyframes → 8–12s loop (webm + mp4).
 *
 * Method: ffmpeg xfade chain (no AI video / no Aleph reference pixels).
 * Alt path noted in brief: PNG sequence from generative in-betweens — not used here.
 *
 * Inputs (1280×720 JPEG):
 *   docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/
 *     k01-straight, k02-entry, k03-drift, k03b-side, k04-exit, k05-loop
 *
 * Timing (hold per beat, seconds): K1 1.5 → K2 1.5 → K3 2 → K3b 2 → K4 1.5 → K5 1.5 (= 10s)
 * Crossfade: 0.25s fade between adjacent beats → ~8.75s encoded duration.
 *
 * Encode: 24 fps, scale width 1600 (lanczos), no audio.
 *   webm: libvpx-vp9 -b:v 0 -crf 32
 *   mp4:  libx264 -pix_fmt yuv420p -crf 23
 *
 * Loop: ends on k05-loop (matches k01-straight for seamless HTML loop K5→K1).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = path.join(
  root,
  "docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive",
);

const keyframes = [
  { file: "k01-straight.jpg", hold: 1.5 },
  { file: "k02-entry.jpg", hold: 1.5 },
  { file: "k03-drift.jpg", hold: 2 },
  { file: "k03b-side.jpg", hold: 2 },
  { file: "k04-exit.jpg", hold: 1.5 },
  { file: "k05-loop.jpg", hold: 1.5 },
];

const FADE = 0.25;
const FPS = 24;
const OUT_W = 1600;
const outDir = path.join(root, "public/sketch");
const webm = path.join(outDir, "fc-drive-loop.webm");
const mp4 = path.join(outDir, "fc-drive-loop.mp4");

const scale = `scale=${OUT_W}:-2:flags=lanczos,format=yuv420p,fps=${FPS}`;

function buildXfadeFilter() {
  const parts = [];
  for (let i = 0; i < keyframes.length; i++) {
    parts.push(`[${i}:v]${scale}[v${i}]`);
  }
  let prev = "v0";
  let elapsed = keyframes[0].hold;
  for (let i = 1; i < keyframes.length; i++) {
    const out = i === keyframes.length - 1 ? "vout" : `vx${i}`;
    const offset = elapsed - FADE;
    parts.push(
      `[${prev}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${out}]`,
    );
    elapsed = elapsed + keyframes[i].hold - FADE;
    prev = out;
  }
  return parts.join(";");
}

function runFfmpeg(outputPath, vcodec, extraArgs) {
  const inputs = keyframes.flatMap((k) => [
    "-loop",
    "1",
    "-t",
    String(k.hold),
    "-i",
    path.join(assetDir, k.file),
  ]);

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    buildXfadeFilter(),
    "-map",
    "[vout]",
    "-an",
    "-c:v",
    vcodec,
    ...extraArgs,
    outputPath,
  ];

  const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

await mkdir(outDir, { recursive: true });

console.log("Encoding webm…");
runFfmpeg(webm, "libvpx-vp9", ["-b:v", "0", "-crf", "32"]);

console.log("Encoding mp4…");
runFfmpeg(mp4, "libx264", ["-pix_fmt", "yuv420p", "-crf", "23"]);

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
);
console.log(probe.stdout);
