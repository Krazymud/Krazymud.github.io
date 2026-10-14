# 青庐占位成片、清理与体验微调

## Goal

Replace line-SVG/sine placeholders with graphite-style RX-7 FC still + headlight loop and paper/wood SFX; remove unmounted 3D garage stack; light UX polish.

## Assets

- `public/sketch/fc-still.webp` — graphite still, headlights down, warm paper `#f1ebdd`
- `public/sketch/fc-loop.webp` — short loop (or dual-frame animated webp) of pop-up headlights up/down
- Keep `fc-still.svg` only if needed for fallback; primary paths are webp
- `public/audio/{tap,confirm,unseal}.mp3` — soft wood/paper taps, no engine character

## SketchStage

- `SKETCH_STILL` → `fc-still.webp`
- `SKETCH_LOOP` → `fc-loop.webp`
- reduced-motion → still only
- Drop CSS breathe once real loop exists (or keep as last-resort fallback if loop fails)

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
