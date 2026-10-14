# 青庐占位成片、清理与体验微调

## Goal

Replace line-SVG/sine placeholders with graphite-style RX-7 FC still + headlight loop and paper/wood SFX; remove unmounted 3D garage stack; light UX polish.

## Assets

- `public/sketch/fc-still.webp` — graphite still, headlights down
- `public/sketch/fc-loop.webm` + `fc-loop.mp4` — 8s @ 24fps (192 frames) open/hold/close cycle
- Keyframes `assets-src/sketch/hl/k00..k05.webp`; rebuild via `node scripts/build-headlight-seq.mjs`
- `public/audio/{tap,confirm,unseal}.mp3` — soft wood/paper taps

## SketchStage

- Loop: muted autoplay `<video>` (webm then mp4)
- reduced-motion → still `<img>` only



## Cleanup

- Delete unmounted `src/scene/three/**`, unused Still/prefetch/stageAssets/turntable/drag/3D-only helpers as tests allow
- Prefs: drop `scene3d`, `introSeen`; drop car paint/rim/caliper if unused
- Remove `@react-three/*`, `three`, `postprocessing`, `@fontsource/rajdhani` if unused
- Trim dead ignition pending API if nothing calls it; keep `emitNitro` for trial

## UX

- Nav `NavLink` click → `play('tap')`
- `main` glass slightly more opaque so sketch lines don’t cut through type
- Home CTA stays `confirm`

## Out of scope

- Redesigning VaultDoor metaphor
- Rewriting trial gameplay
