# Design · 青庐

<!-- impeccable:design-schema 1 -->

## World

Celadon tea tray for a private daily ritual. Soft glaze ground, iron rim chrome, porcelain work panels. The graphite RX-7 FC drive sketch remains the atmospheric plate on home — UI never competes with it.

## Palette

| Role | Token | Value |
|------|-------|-------|
| Ground | `--color-ink` | `#d8e4dc` |
| Porcelain | `--porcelain` | `#f4f7f3` |
| Ink / text | `--color-fg` | `#1a2420` |
| Muted | `--color-muted` | `#4a5a52` |
| Line | `--color-line` | `#8fa396` |
| Iron accent | `--accent` | `#3a4840` |
| Glaze | `--accent-hi` / `--glaze` | `#6b8f7e` |

Ground may drift with soft radial washes toward `#eef5ef` and `#c5d4c8`. Avoid cream paper, purple accents, neon, and dual red/gold themes.

## Type

- Chinese brand and body: LXGW WenKai (`--font-paper` / `--font-display`)
- English word faces: Source Serif 4 (`--font-latin`)
- Tracking on brand titles may open to ~0.2em; captions use light tracking (~0.14em)

## Materials

- Porcelain panels replace decorative liquid glass: opaque celadon-tinted fill, iron hairline border, soft drop shadow; no backdrop blur by default.
- Nav is a lighter porcelain strip with a bottom iron rule.
- Signature move: `.glaze-cta` rising celadon fill driven by `--glaze-fill` (session progress).
- Week marks are tea rings (`.tea-ring` / `.tea-ring-lit`); brand seal is a small glaze dot.

## Motion

- Route enter: short opacity + y ease `[0.19, 1, 0.22, 1]`
- Glaze fill: transform scaleY from bottom, ~0.55s
- Today ring: breathe opacity when incomplete
- Honor `prefers-reduced-motion`

## Shell

- Brand-first home: 「青庐」hero, greeting, one CTA, sketch atmosphere; dashboard and 锦匣 below the fold.
- Standard top nav labels: 青庐 · 日课 · 锦匣 · 案头
- Inner routes sit in a porcelain main column (`max-w-md`)

## Seed

`seed:d9e766a19ffaa31a` · grounded direction #4 Celadon tea ware tray · Operate mode · code-led
