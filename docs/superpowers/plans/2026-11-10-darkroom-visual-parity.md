# Darkroom Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the vault-backed Darkroom SPA with A Roll For Two’s gift-grade look and full reel (opening → desk → tray wall → torch → book → credits), plus polaroid take-home and multi-track radio—without copying their private media.

**Architecture:** Keep React + R3F + `VaultBridge`. Add a `ReelStage` state machine over HTML/R3F scenes. Rewrite desk props/lighting to match reverse-engineered rolls/tray recipes (procedural + CanvasTexture). Ship self-hosted fonts, public-domain music, and generated/open textures under `public/darkroom/`.

**Tech Stack:** React 19, R3F, drei, three, Vitest, Vite; optional `jszip` for polaroid ZIP; CSS grain/vignette; self-hosted woff2.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-10-darkroom-visual-parity-design.md`（已确认，含原 §3.4 全做）.
- Do **not** commit files copied from `roll.giadaserena.top` (photos, mp3, wood/steel/leather binaries, glTF). Port algorithms/parameters only; use self-made or clearly licensed assets + `LICENSE` notes.
- Vault crypto / STS / COS contracts unchanged; photos/notes/lists still from vault.
- Full 3D on iPhone; no 2.5D fallback; respect `prefers-reduced-motion` for grain/dolly.
- Copy brand remains 「暗房」; no 青庐/日课.
- Palette: cream `#f3e6d2`, ink `#040302`, accent `#ee5546`, desk wood tint `#6e4a38`, bg `#0b0705`.
- COS sync already soft-fails fonts/vault; new large assets should be skippable or hashed under `assets/`.

## File map

| Path | Responsibility |
|------|----------------|
| `src/darkroom/theme.ts` | Colors, fonts CSS vars, tone constants |
| `src/darkroom/reel/types.ts` | `ReelSceneId`, scene order |
| `src/darkroom/reel/ReelStage.tsx` | Scene switch + veil |
| `src/darkroom/reel/OpeningScene.tsx` | Title card + film belt |
| `src/darkroom/reel/CreditsScene.tsx` | Rollup credits |
| `src/darkroom/reel/TorchComicScene.tsx` | SVG desk + torch mask |
| `src/darkroom/reel/BookCoverScene.tsx` | Procedural leather book desk |
| `src/darkroom/reel/PolaroidTakeHome.tsx` | Preview + ZIP/print |
| `src/darkroom/reel/ReelRadio.tsx` | Playlist audio + aperture menu hooks |
| `src/darkroom/reel/ApertureMenu.tsx` | Settings chrome |
| `src/darkroom/scene/DeskScene.tsx` | Warm lights, wood, props rewrite |
| `src/darkroom/scene/props/*` | Canister, FilmStrip3D, Tray3D, Lightbox3D, Viewer3D, Envelope3D |
| `src/darkroom/scene/labelTex.ts` | Canvas canister labels |
| `src/darkroom/scene/DarkroomCanvas.tsx` | ACES + grain shell; desk reel beat |
| `src/darkroom/DarkroomApp.tsx` | Unlock → ReelStage |
| `public/darkroom/**` | wood, fonts, music + LICENSE |
| `src/index.css` | `@font-face`, grain, vignette, reel chrome |

---

### Task 1: Theme tokens + grain/vignette CSS + font faces

**Files:**
- Create: `src/darkroom/theme.ts`
- Create: `src/darkroom/theme.test.ts`
- Modify: `src/index.css`
- Create: `public/darkroom/fonts/LICENSE.md` (list font sources once fonts added in Task 1b below)

**Interfaces:**
- Produces: `DR_COLORS`, `DR_FONTS` constants consumed by later scenes

- [ ] **Step 1: Write the failing test**

```ts
// src/darkroom/theme.test.ts
import { describe, expect, it } from 'vitest'
import { DR_COLORS } from './theme'

describe('DR_COLORS', () => {
  it('matches A Roll cream/ink/accent', () => {
    expect(DR_COLORS.cream).toBe('#f3e6d2')
    expect(DR_COLORS.ink).toBe('#040302')
    expect(DR_COLORS.accent).toBe('#ee5546')
    expect(DR_COLORS.bg).toBe('#0b0705')
    expect(DR_COLORS.woodTint).toBe('#6e4a38')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/darkroom/theme.test.ts`  
Expected: FAIL cannot find module `./theme`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/darkroom/theme.ts
export const DR_COLORS = {
  cream: '#f3e6d2',
  ink: '#040302',
  accent: '#ee5546',
  bg: '#0b0705',
  woodTint: '#6e4a38',
  ambient: '#ffcfa0',
  spot: '#ffd2a0',
  rim: '#ff9a5a',
} as const

export const DR_FONTS = {
  display: 'Fraunces, "Source Serif 4", serif',
  hand: 'Reenie Beanie, "LXGW WenKai", cursive',
  mono: '"JB Mono", ui-monospace, monospace',
  letter: '"Courier Prime", "Courier New", monospace',
} as const
```

Add to `src/index.css` (scoped):

```css
.dr-grain {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 5;
  opacity: 0.2;
  mix-blend-mode: overlay;
  background: url("data:image/svg+xml,…feTurbulence…") repeat;
}
@media (prefers-reduced-motion: reduce) {
  .dr-grain { animation: none; }
}
.dr-vig {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 4;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(4, 3, 2, 0.55) 100%);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/darkroom/theme.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/darkroom/theme.ts src/darkroom/theme.test.ts src/index.css
git commit -m "feat(darkroom): theme tokens and film grain/vignette chrome"
```

---

### Task 2: Self-hosted fonts + procedural wood texture asset

**Files:**
- Create: `public/darkroom/fonts/*.woff2` (Fraunces, Reenie Beanie, JB Mono or legal equivalents)
- Create: `public/darkroom/fonts/LICENSE.md`
- Create: `scripts/gen-darkroom-wood.mjs` (procedural wood JPG via canvas/sharp—no third-party site fetch)
- Create: `public/darkroom/wood.jpg` (generated)
- Modify: `src/index.css` `@font-face` pointing at `/darkroom/fonts/…`

**Interfaces:**
- Produces: `/darkroom/wood.jpg`, font URLs used by DeskScene and OpeningScene

- [ ] **Step 1: Write failing check that wood asset exists in build**

```ts
// src/darkroom/assets.presence.test.ts
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('darkroom public assets', () => {
  it('ships wood texture', () => {
    expect(existsSync(path.join(process.cwd(), 'public/darkroom/wood.jpg'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/darkroom/assets.presence.test.ts`

- [ ] **Step 3: Generate wood + add fonts**

Implement `scripts/gen-darkroom-wood.mjs` that writes a seamless warm wood JPG into `public/darkroom/wood.jpg` (noise + grain streaks). Download **license-permitted** font woff2 into `public/darkroom/fonts/` and document sources in `LICENSE.md`. Wire `@font-face` in `src/index.css`.

- [ ] **Step 4: Re-run presence test — PASS**

- [ ] **Step 5: Commit**

```bash
git add public/darkroom scripts/gen-darkroom-wood.mjs src/index.css src/darkroom/assets.presence.test.ts
git commit -m "feat(darkroom): self-hosted fonts and generated wood texture"
```

---

### Task 3: Canister label canvas + horizontal film canisters

**Files:**
- Create: `src/darkroom/scene/labelTex.ts`
- Create: `src/darkroom/scene/labelTex.test.ts`
- Create: `src/darkroom/scene/props/Canister.tsx`
- Modify: `src/darkroom/scene/DeskScene.tsx`
- Modify: `src/darkroom/rolls.ts` (optional `style` fields: bg/ink/band) — keep classifier API stable

**Interfaces:**
- Consumes: `FilmRoll` from `rolls.ts` (`id`, `title`, `photoSources`)
- Produces: `makeCanisterLabelBitmap(roll, frameCount) => HTMLCanvasElement`；`Canister` R3F group

- [ ] **Step 1: Failing test for label bitmap**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { makeCanisterLabelBitmap } from './labelTex'

describe('makeCanisterLabelBitmap', () => {
  it('paints title and roll meta', () => {
    const c = document.createElement('canvas')
    // implementation returns canvas; assert non-empty pixels + size
    const out = makeCanisterLabelBitmap(
      { id: 'a', title: '远行', photoSources: ['x', 'y'] },
      { bg: '#e6d8bd', ink: '#b5301e', band: '#b5301e', iso: '400' },
    )
    expect(out.width).toBe(1024)
    expect(out.height).toBe(512)
    const ctx = out.getContext('2d')!
    const data = ctx.getImageData(512, 40, 1, 1).data
    expect(data[3]).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `labelTex.ts` + `Canister.tsx`**

Port reference recipe:
- Cylinder R≈0.38, L≈1.05, 64 segments, open-ended body with canvas map
- Metal caps/torus rings, spool tip, felt lip
- `rotation.z = Math.PI/2` so can lies on side
- Style palette cycle for up to 5 rolls (cream/orange/green/black/…)

Rewrite `DeskScene` rolls cluster to map `useVault().rolls` → one `Canister` each with spread positions like reference `STYLE.pos`.

- [ ] **Step 4: Tests pass; smoke DeskScene still mounts in existing canvas tests**

Run: `npx vitest run src/darkroom/scene/labelTex.test.ts src/darkroom/scene/cameraFocus.test.ts`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(darkroom): labeled horizontal film canisters"
```

---

### Task 4: Renderer ACES + warm lighting + wood desk + lamp follow

**Files:**
- Modify: `src/darkroom/scene/DarkroomCanvas.tsx`
- Modify: `src/darkroom/scene/DeskScene.tsx`
- Modify: `src/darkroom/scene/CameraRig.tsx` / `cameraFocus.ts` (desk home closer to FOV 32, pos ~(0,7,5.4) look ~(0,0,0.15); keep portrait aspect adaptations)

**Interfaces:**
- Consumes: `DR_COLORS`, `/darkroom/wood.jpg`
- Produces: desk look matching reconstructed rolls screenshot

- [ ] **Step 1: Extend `cameraFocus.test.ts` for rolls-like desk anchor**

```ts
it('desk home is elevated three-quarter', () => {
  const a = anchorForFocus('desk', 16 / 9)
  expect(a.position[1]).toBeGreaterThan(5)
  expect(a.fov).toBe(32)
})
```

- [ ] **Step 2: Run — FAIL if fov still old**

- [ ] **Step 3: Implement**

In `DarkroomCanvas` `onCreated`:

```ts
gl.toneMapping = THREE.ACESFilmicToneMapping
gl.toneMappingExposure = 1.05
gl.outputColorSpace = THREE.SRGBColorSpace
```

`DeskScene` lights: ambient `#ffcfa0` 0.18; SpotLight `#ffd2a0` intensity high, penumbra, shadow radius; rim Directional `#ff9a5a`. Wood plane with `useTexture('/darkroom/wood.jpg')` + `color={DR_COLORS.woodTint}`. When `focus==='rolls'`, lerp spot target toward selected canister (state lifted from canvas).

Mount `.dr-grain` + `.dr-vig` siblings of canvas.

- [ ] **Step 4: Tests PASS; manual screenshot desk**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(darkroom): ACES warm desk lighting and wood table"
```

---

### Task 5: 3D pull-out film strip + tray/lightbox/viewer polish

**Files:**
- Create: `src/darkroom/scene/props/FilmPull.tsx`
- Create: `src/darkroom/scene/props/Tray3D.tsx`
- Create: `src/darkroom/scene/props/Lightbox3D.tsx`
- Create: `src/darkroom/scene/props/Viewer3D.tsx`
- Modify: `DeskScene.tsx`, `DarkroomCanvas.tsx`
- Test: `src/darkroom/scene/props/FilmPull.test.ts` (pure geom helpers)

**Interfaces:**
- Consumes: roll frames via blob URLs from bridge; `focus` id
- Produces: visible film mesh when a roll is focused; tray with liquid material

- [ ] **Step 1: Test film length helper**

```ts
import { filmLengthForFrames } from './FilmPull'
expect(filmLengthForFrames(8)).toBeGreaterThan(filmLengthForFrames(4))
```

- [ ] **Step 2–4: Implement FilmPull (PlaneGeometry + canvas negatives OR textured planes), Tray3D (steel-ish MeshStandard + MeshPhysical liquid opacity/ior), Lightbox emissive panel, Viewer metal/lens. Wire click → existing overlays after short pull animation.**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(darkroom): film pull, steel tray, lightbox and viewer polish"
```

---

### Task 6: ReelStage shell + veil transitions

**Files:**
- Create: `src/darkroom/reel/types.ts`
- Create: `src/darkroom/reel/ReelStage.tsx`
- Create: `src/darkroom/reel/ReelStage.test.tsx`
- Modify: `src/darkroom/DarkroomApp.tsx` — after unlock render `<ReelStage/>` instead of bare canvas

**Interfaces:**
- Produces:

```ts
export type ReelSceneId =
  | 'opening'
  | 'letters'
  | 'desk'
  | 'trayWall'
  | 'torch'
  | 'book'
  | 'credits'

export const REEL_ORDER: ReelSceneId[] = [
  'opening',
  'letters',
  'desk',
  'trayWall',
  'torch',
  'book',
  'credits',
]
```

- [ ] **Step 1: Failing test — next scene**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReelStage } from './ReelStage'

it('starts on opening and advances on CTA', async () => {
  render(<ReelStage />)
  expect(screen.getByTestId('reel-scene')).toHaveAttribute('data-scene', 'opening')
  await userEvent.click(screen.getByRole('button', { name: /启封卷轴|继续|roll/i }))
  expect(screen.getByTestId('reel-scene')).toHaveAttribute('data-scene', 'letters')
})
```

(Stub child scenes as lightweight placeholders in this task.)

- [ ] **Step 2–4: Implement veil (black/white), lazy mount heavy scenes (`desk`, `trayWall`, `book`), `go(id)` / `next()` API via context `useReel()`.**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(darkroom): ReelStage scene machine with veil"
```

---

### Task 7: OpeningScene + CreditsScene

**Files:**
- Create: `src/darkroom/reel/OpeningScene.tsx`
- Create: `src/darkroom/reel/OpeningScene.test.tsx`
- Create: `src/darkroom/reel/CreditsScene.tsx`
- Create: `src/darkroom/reel/CreditsScene.test.tsx`
- Modify: `ReelStage.tsx` to use real components

**Interfaces:**
- Consumes: `useVault()` rolls/photos for belt thumbs via `readBlob`; `useReel().next`

- [ ] **Step 1: Opening shows brand 暗房 and CTA**

```tsx
it('renders title and handwritten CTA', () => {
  render(<OpeningScene onContinue={() => {}} beltUrls={[]} />)
  expect(screen.getByText(/暗房/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /继续|启卷/ })).toBeInTheDocument()
})
```

- [ ] **Step 2–4: Port opening layout (serif title, mono meta corners, vertical film belt, bokeh/specks CSS). Credits: scroll rollup from configurable lines in `src/config/copy.ts` + vault-derived stills. Prefer reduced-motion instant show.**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(darkroom): opening title card and credits rollup"
```

---

### Task 8: Letters beat + desk/trayWall integration

**Files:**
- Create: `src/darkroom/reel/LettersBeat.tsx` (HTML letter card from first note or empty invite)
- Modify: `ReelStage` — `desk` renders existing `DarkroomCanvas`; add in-canvas control 「下一幕」 / complete desk to go `trayWall`
- Modify: `TrayOverlay` / canvas — after develop, offer wall picks then `next()` to torch

- [ ] **Steps:** TDD for LettersBeat using vault note body; wire navigation without breaking unlock→desk edit flows; allow skip letters if no notes.

- [ ] **Commit:** `feat(darkroom): letters beat and desk/tray reel hooks`

---

### Task 9: TorchComicScene

**Files:**
- Create: `src/darkroom/reel/TorchComicScene.tsx`
- Create: `src/darkroom/reel/TorchComicScene.test.tsx`
- Reference algorithm: `/opt/cursor/artifacts/ref-site/scenes/torch-comic.html` (SVG items + torch mask)—**rewrite** in React, vault-driven caption/date

- [ ] **Step 1: Test renders stage and advances**

```tsx
it('moves torch with pointer and exposes continue', async () => {
  render(<TorchComicScene noteLine="测试" date="11.10" onContinue={() => {}} />)
  expect(screen.getByTestId('torch-stage')).toBeInTheDocument()
})
```

- [ ] **Step 2–4: Implement SVG wood desk clutter, red thread, flashlight `mask` following pointer/touch; CTA to next scene.**

- [ ] **Step 5: Commit** `feat(darkroom): torch comic scene`

---

### Task 10: BookCoverScene (procedural)

**Files:**
- Create: `src/darkroom/reel/BookCoverScene.tsx`
- Create: `src/darkroom/reel/bookCoverTex.ts` (canvas leather/title)
- Test: `bookCoverTex.test.ts`
- **No** dependency on reference glTF/compass models—procedural book mesh + simple props (ticket/plane photo)

- [ ] **Steps:** ACES scene, leather-like MeshStandard with procedural bump, title from copy or first note title, cover photo from vault pick; continue → credits.

- [ ] **Commit:** `feat(darkroom): procedural book cover scene`

---

### Task 11: Polaroid take-home

**Files:**
- Create: `src/darkroom/reel/PolaroidTakeHome.tsx`
- Create: `src/darkroom/reel/polaroidRender.ts` (front/back canvas)
- Create: `src/darkroom/reel/polaroidRender.test.ts`
- Add dependency only if needed: `jszip` (or minimal ZIP like reference `pola.js` without new dep—prefer zero-dep ZIP port tested)

**Interfaces:**
- Consumes: up to 8 `Blob`/`HTMLImageElement` frames + captions
- Produces: `downloadPolaroidsZip(frames)`, `openPrintSheet(frames)`

- [ ] **Step 1:**

```ts
it('front canvas is larger than photo inset', async () => {
  const img = await loadTestImage()
  const c = await renderPolaroidFront(img, { caption: 'hi', index: 1 })
  expect(c.width).toBeGreaterThan(400)
})
```

- [ ] **Step 2–4: UI modal from aperture menu / tray wall; download + print buttons.**

- [ ] **Step 5: Commit** `feat(darkroom): polaroid zip and print take-home`

---

### Task 12: ReelRadio + ApertureMenu

**Files:**
- Create: `src/darkroom/reel/ReelRadio.tsx`
- Create: `src/darkroom/reel/ApertureMenu.tsx`
- Create: `public/darkroom/music/LICENSE.txt`
- Create: `public/darkroom/music/*.mp3` — **public-domain** recordings you legally obtain (e.g. Musopen/Satie PD); do not copy reference CDN bytes
- Create: `src/darkroom/reel/playlist.ts`
- Test: `playlist.test.ts`, `ApertureMenu.test.tsx`

**Interfaces:**
- Produces: `DEFAULT_PLAYLIST: { src, title }[]`; radio context `muted`, `volume`, `trackIndex`, `next`, `prev`

- [ ] **Steps:** Loop playlist; fade-in on first unlock gesture; aperture menu rows: music on/off, volume, clarity (dpr), light full/simple (toggle shadows), polaroids entry when wall picks exist. Persist prefs in `localStorage` keys `darkroom.q` / `darkroom.light`.

- [ ] **Commit:** `feat(darkroom): aperture menu and public-domain reel radio`

---

### Task 13: Letter overlay stationery pass + copy

**Files:**
- Modify: `src/darkroom/overlays/LetterOverlay.tsx`, `src/index.css` / overlay classes
- Modify: `src/config/copy.ts` for reel CTAs
- Test: update `LetterOverlay.test.tsx` / `copy.test.ts`

- [ ] **Steps:** Cream paper, Courier body, red handwritten hints; keep mutate behavior.

- [ ] **Commit:** `feat(darkroom): letter stationery and reel copy`

---

### Task 14: Visual acceptance + deploy verification

**Files:** none required (artifacts under `/opt/cursor/artifacts/`)

- [ ] **Step 1:** `npx vitest run` — all green; `npx tsc -b`; `npm run build`
- [ ] **Step 2:** Manual/computerUse: unlock → opening → desk screenshot vs `/opt/cursor/artifacts/ref-site/ref-rolls-desk-recon.png`; walk torch/book/credits; polaroid download; radio toggle
- [ ] **Step 3:** Confirm `https://krazymud.github.io` and `https://erinamae.site` titles/assets match after Deploy; Sync log shows `uploaded site/index.html` or skip after success
- [ ] **Step 4:** Commit any fixups; open/update PR

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| 3.1 渲染/木桌/grain | 1, 2, 4 |
| 3.2 罐/拉片/盘/灯箱/观片器 | 3, 5 |
| 3.3 字体/语气 | 1, 2, 13 |
| 3.4 片头片尾 | 6, 7 |
| 3.4 火把 | 9 |
| 3.4 书封 | 10 |
| 3.4 拍立得 | 11 |
| 3.4 电台 | 12 |
| 幕序与懒加载 | 6, 8 |
| 验收 iPhone/COS | 14 |

## Placeholder scan

No TBD steps; assets that cannot be invented in-repo are constrained to “generate or obtain PD with LICENSE” with explicit paths.
