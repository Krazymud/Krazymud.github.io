# Chosen drive loop sources

## Landscape (desktop `sm+`)

- Model: `kwaivgi/kling-v3-omni-video` (pro, 10s, 16:9)
- Start: `k01-straight.jpg`, End: `k05-loop.jpg`
- Source: `kling-v3-omni-video-10s.mp4`
- Baked to `public/sketch/fc-drive-loop.{webm,mp4}` + `fc-drive-still.webp`

## Portrait (narrow `<sm`)

- Model: `kwaivgi/kling-v3-omni-video` (pro, 10s, 9:16) — no fallback models
- Start / end: center-cropped K1/K5 → `k01-straight-portrait.jpg`, `k05-loop-portrait.jpg`
- Source: `kling-v3-omni-portrait-10s.mp4`
- Baked to `public/sketch/fc-drive-loop-portrait.{webm,mp4}` + `fc-drive-still-portrait.webp`
