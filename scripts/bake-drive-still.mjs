#!/usr/bin/env node
/**
 * One-off: K1 straight frame → public/sketch/fc-drive-still.webp (~1600px wide).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(
  root,
  "docs/superpowers/assets/2026-10-14-qinglu-bluepencil-drive/k01-straight.jpg",
);
const out = path.join(root, "public/sketch/fc-drive-still.webp");

await mkdir(path.dirname(out), { recursive: true });
await sharp(src)
  .resize({ width: 1600, withoutEnlargement: false })
  .webp({ quality: 82 })
  .toFile(out);

console.log(`Wrote ${out}`);
