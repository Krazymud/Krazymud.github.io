# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary (inferred from product specs + `src/config/site.ts`):** one intimate user — the partner addressed by nickname「婉婉儿」— opening the site on a phone for a short daily ritual.
- **Secondary (inferred):** the builder/operator who maintains vault content, COS sync, and progress exports.

## Product Purpose

青庐 is a private gift site: a calm daily English vocabulary practice (日课) paired with an encrypted personal vault of photos and notes (锦匣). Success is that she can finish today's lesson, feel the place is hers, and open the vault when she wants — without accounts, without public brand noise.

## Positioning

A single-person sanctuary named and voiced in Classical-Chinese register (青庐 / 日课 / 锦匣 / 案头), with a graphite RX-7 FC drive sketch as the living atmosphere — not a generic flashcard app, not a public portfolio, not a social product.

## Operating Context

- Mobile-first browser; GitHub Pages / COS+CDN static hosting.
- Daily study session (~20 items) with SRS; progress in local storage with export/import on 案头.
- Vault unlocks with a passphrase; optional remember-on-device; content is encrypted at rest.
- Soft feedback sounds; mute toggle; `prefers-reduced-motion` must keep every task usable.

## Capabilities and Constraints

- Routes: `/` home, `/trial` 日课, `/vault` 锦匣, `/settings` 案头 (paths stay stable).
- Do not change trial SRS/selection semantics, vault crypto/sync protocol, or progress schema in a visual redesign.
- Do not reintroduce Midnight Garage / PRIVATE VAULT / red-gold dual themes / WebGL car garage.
- Keep brand name「青庐」and Chinese nav labels unless the user later revises PRODUCT.md.
- Drive-loop sketch assets under `public/sketch/` remain the atmospheric visual anchor on home.
- **Open (inferred):** exact aesthetic world for this redesign is intentionally replaced via Impeccable new-work; product truth above stays fixed.

## Brand Commitments

- Site name: **青庐**
- Nav / feature names: **日课 · 锦匣 · 案头**
- Greeting register: intimate Classical-Chinese short forms (e.g.「安」,「相伴第 N 天」) — no English garage voice.
- Atmosphere asset: graphite sketch RX-7 FC drive loop (not water-ink calligraphy car, not 3D).

## Evidence on Hand

- Living product under `src/` with copy in `src/config/copy.ts`.
- Design history in `docs/superpowers/specs/` (Midnight Garage → 青庐 rebrand → paper-ink polish).
- Sketch media: `public/sketch/fc-drive-*.{mp4,webm,webp}`.
- No public testimonials or marketing claims; do not invent them.

## Product Principles

1. **One person, one ritual** — every surface serves her daily return, not a dashboard audience.
2. **Atmosphere without obstruction** — the drive sketch may lead; chrome must stay light.
3. **Chinese brand first** —「青庐」is the hero signal; English is for English words only.
4. **Trust over novelty** — vault and progress must feel quiet and reliable.
5. **Motion as presence** — 2–3 intentional motions; reduced-motion stays complete.

## Accessibility & Inclusion

- Honor `prefers-reduced-motion`.
- Touch targets usable on phone; vault photo viewer already portals fullscreen with pinch zoom — preserve that behavior.
- Chinese primary UI language.
