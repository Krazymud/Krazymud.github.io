# 青庐占位成片、清理与体验微调

## Goal

Replace line-SVG/sine placeholders with graphite-style RX-7 FC still + headlight loop and paper/wood SFX; remove unmounted 3D garage stack; light UX polish.

## Assets

- `public/sketch/fc-still.webp` — graphite still, headlights down, warm paper `#f1ebdd`
- `public/sketch/fc-up.webp` — matched pose, headlights up
- Loop via CSS crossfade (`sketch-headlights`, ~8s ease-in-out), not hard-cut animated webp
- `public/audio/{tap,confirm,unseal}.mp3` — soft wood/paper taps, no engine character

## SketchStage

- Base layer `fc-still.webp`; overlay `fc-up.webp` with opacity cycle
- reduced-motion → still only (no overlay animation)


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
