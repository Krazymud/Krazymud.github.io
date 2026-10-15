# 青庐纸墨抛光 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship portal photo viewer with pinch zoom, LXGW WenKai + Source Serif 4 sitewide, paper-ink trial UX, and garage-DNA cleanup per `docs/superpowers/specs/2026-10-15-qinglu-paper-ink-polish-design.md`.

**Architecture:** Keep business logic (SRS, vault crypto, drive loop) untouched. Work outward from P0 `PhotoViewer` portal + gestures, then font/CSS tokens, then trial skin + sticky grade bar, then dashboard/settings copy polish. Prefer `createPortal` and pointer events over new heavy deps.

**Tech Stack:** React 19, Vite, Tailwind 4, Motion, Vitest, Testing Library; self-hosted `woff2` in `public/fonts/`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-15-qinglu-paper-ink-polish-design.md` (approved).
- Do not change trial engine / SRS / daily 20 / vault encryption / FC dual-quality assets.
- Do not migrate CDN; do not re-apply vault cold-open #49–#51 in this plan.
- User-visible export filenames must use `qinglu-progress-`, not `midnight-garage-progress-`.
- Storage keys like `midnight-garage/progress` may remain (legacy); UI must not expose old brand.
- Touch targets ≥44px where specified; honor `prefers-reduced-motion`.
- Pinch: self-implement with pointer events (no new gesture library unless blocked).
- Commit after each task; run targeted vitest before commit.

## File map

| Path | Role |
|------|------|
| `src/vault/components/PhotoViewer.tsx` | Portal overlay, chrome, pinch/pan |
| `src/vault/components/photoZoom.ts` | Pure pinch/pan math helpers (testable) |
| `src/vault/components/PhotoViewer.test.tsx` | Portal + lock scroll + chrome + zoom helpers |
| `src/vault/components/tabs.test.tsx` | Update if dialog assertions need body parent |
| `public/fonts/*` | LXGW WenKai + Source Serif 4 woff2 |
| `src/index.css` | `@font-face`, font tokens, button/panel utilities |
| `src/theme/fonts.test.ts` | Assert CSS exposes paper font stacks |
| `src/trial/components/Effects.tsx` | Replace nitro/track with paper feedback |
| `src/trial/components/QuestionCard.tsx` | Larger options, Latin display class |
| `src/trial/components/GradeBar.tsx` | Thumb-sized buttons |
| `src/trial/components/Gauge.tsx` | Drop wide tracking / garage feel |
| `src/trial/TrialScreen.tsx` | Sticky grade zone; use new effects |
| `src/trial/TrialScreen.test.tsx` | Update nitro visual expectations |
| `src/trial/components/ResultPanel.tsx` | Panel + primary CTA classes |
| `src/garage/Dashboard.tsx` | aria + panel classes |
| `src/pages/SettingsPage.tsx` | Export filename |
| `src/pages/SettingsPage.test.tsx` | Assert `qinglu-progress-` |
| `src/app/Layout.tsx` | Optional inner-route enter motion |

---

### Task 1: PhotoViewer portal + viewport chrome + scroll lock

**Files:**
- Modify: `src/vault/components/PhotoViewer.tsx`
- Create: `src/vault/components/PhotoViewer.test.tsx`
- Modify: `src/vault/components/tabs.test.tsx` (only if needed)

**Interfaces:**
- Consumes: existing `PhotoViewerProps`, `useBlobUrl`, `ReadBlob`
- Produces: dialog portaled to `document.body`; body scroll locked while open

- [ ] **Step 1: Write the failing portal test**

Create `src/vault/components/PhotoViewer.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PhotoViewer } from './PhotoViewer'
import type { PhotoEntry } from '../types'

const photos: PhotoEntry[] = [
  { date: '2024-05-01', caption: '海边', width: 100, height: 100, full: 'f1', thumb: 't1', source: 'a', hash: 'h1' },
  { date: '2024-05-02', caption: '', width: 100, height: 100, full: 'f2', thumb: 't2', source: 'b', hash: 'h2' },
]

function read(name: string) {
  return Promise.resolve(new TextEncoder().encode(name === 'f1' || name === 'f2' ? 'x' : ''))
}

describe('PhotoViewer', () => {
  it('portals the dialog to document.body and locks background scroll', () => {
    const onClose = vi.fn()
    render(
      <div data-testid="host">
        <PhotoViewer photos={photos} index={0} read={read} onIndex={() => {}} onClose={onClose} />
      </div>,
    )
    const dialog = screen.getByRole('dialog', { name: '照片' })
    expect(dialog.parentElement).toBe(document.body)
    expect(document.body.style.overflow).toBe('hidden')
    expect(within(dialog).getByRole('button', { name: '关闭' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '上一张' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

Adjust `PhotoEntry` fields to match `src/vault/types.ts` exactly if the stub above differs.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/vault/components/PhotoViewer.test.tsx`
Expected: FAIL (dialog not direct child of `body`, or overflow not locked)

- [ ] **Step 3: Implement portal + chrome + scroll lock**

In `PhotoViewer.tsx`:
- Import `createPortal` from `react-dom`
- On mount: save `document.body.style.overflow`, set to `hidden`; on unmount restore
- Structure:

```tsx
const ui = (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="照片"
    className="fixed inset-0 z-50 flex flex-col bg-ink/95"
    style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    {/* keep existing swipe handlers for scale===1; pinch added in Task 2 */}
  >
    <div className="flex shrink-0 items-center justify-between bg-ink/70 px-4 py-3 text-sm text-muted">
      <span>{index + 1} / {photos.length}</span>
      <button type="button" onClick={onClose} className="min-h-11 min-w-11 px-3 hover:text-fg">
        关闭
      </button>
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center px-2">
      {/* img / loading / failed — same as today */}
    </div>
    <div className="shrink-0 bg-ink/70 px-4 py-3 text-center">
      {photo.caption && <p className="text-sm text-fg">{photo.caption}</p>}
      <p className="mt-1 text-xs text-muted">{photo.date}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="min-h-11 border border-line disabled:opacity-30">
          上一张
        </button>
        <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} className="min-h-11 border border-line disabled:opacity-30">
          下一张
        </button>
      </div>
    </div>
  </div>
)
return createPortal(ui, document.body)
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/vault/components/PhotoViewer.test.tsx src/vault/components/tabs.test.tsx src/vault/components/MemoryCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/vault/components/PhotoViewer.tsx src/vault/components/PhotoViewer.test.tsx src/vault/components/tabs.test.tsx
git commit -m "fix(vault): portal photo viewer to viewport with thumb chrome"
```

---

### Task 2: Pinch zoom + pan helpers and wire into PhotoViewer

**Files:**
- Create: `src/vault/components/photoZoom.ts`
- Create: `src/vault/components/photoZoom.test.ts`
- Modify: `src/vault/components/PhotoViewer.tsx`
- Modify: `src/vault/components/PhotoViewer.test.tsx`

**Interfaces:**
- Produces:

```ts
export type ZoomState = { scale: number; x: number; y: number }
export const MIN_SCALE = 1
export const MAX_SCALE = 4
export function clampScale(scale: number): number
export function resetZoom(): ZoomState // { scale: 1, x: 0, y: 0 }
export function applyPinch(prev: ZoomState, startDist: number, dist: number, startScale: number): ZoomState
export function applyPan(prev: ZoomState, dx: number, dy: number): ZoomState
```

- When `scale <= 1.02`, treat as 1 and allow horizontal swipe to change photo; when `scale > 1.02`, pan only.

- [ ] **Step 1: Write failing unit tests for zoom math**

```ts
import { describe, expect, it } from 'vitest'
import { applyPan, applyPinch, clampScale, resetZoom } from './photoZoom'

describe('photoZoom', () => {
  it('clamps scale between 1 and 4', () => {
    expect(clampScale(0.5)).toBe(1)
    expect(clampScale(9)).toBe(4)
  })
  it('resets to identity', () => {
    expect(resetZoom()).toEqual({ scale: 1, x: 0, y: 0 })
  })
  it('scales from pinch distances', () => {
    const next = applyPinch({ scale: 1, x: 0, y: 0 }, 100, 200, 1)
    expect(next.scale).toBe(2)
  })
  it('pans only when scaled', () => {
    expect(applyPan({ scale: 1, x: 0, y: 0 }, 10, 10)).toEqual({ scale: 1, x: 0, y: 0 })
    expect(applyPan({ scale: 2, x: 0, y: 0 }, 10, -5)).toEqual({ scale: 2, x: 10, y: -5 })
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/vault/components/photoZoom.test.ts`
Expected: FAIL module missing

- [ ] **Step 3: Implement `photoZoom.ts`**

Implement the functions above with the stated behavior.

- [ ] **Step 4: Wire pointers into PhotoViewer**

- Track active pointers in a `Map<number, {x,y}>`
- On 2 pointers: pinch via `applyPinch`
- On 1 pointer + scale>1.02: pan via `applyPan`
- On 1 pointer + scale≈1: keep existing horizontal swipe-to-`go`
- Double-click / double-tap on image: `resetZoom()`
- Apply transform to img: `translate(x,y) scale(scale)` with `transformOrigin: 'center center'`
- Reset zoom whenever `index` changes (`useEffect`)

- [ ] **Step 5: Add a render test that double-click resets** (optional but preferred)

Simulate two-pointer math via exporting helpers (already covered). For UI, assert img has style transform after calling internal path is hard — keep unit tests as primary.

- [ ] **Step 6: Run tests + commit**

```bash
npx vitest run src/vault/components/photoZoom.test.ts src/vault/components/PhotoViewer.test.tsx src/vault/components/tabs.test.tsx
git add src/vault/components/photoZoom.ts src/vault/components/photoZoom.test.ts src/vault/components/PhotoViewer.tsx src/vault/components/PhotoViewer.test.tsx
git commit -m "feat(vault): pinch-zoom and pan in photo viewer"
```

---

### Task 3: Self-host fonts + CSS font tokens

**Files:**
- Create: `public/fonts/lxgw-wenkai-regular.woff2` (and bold if used)
- Create: `public/fonts/source-serif-4-latin.woff2` (regular + possibly 600)
- Modify: `src/index.css`
- Create: `src/theme/fonts.test.ts`
- Optional script: `scripts/fetch-fonts.mjs` documenting download URLs

**Interfaces:**
- CSS variables:
  - `--font-paper: 'LXGW WenKai', 'Songti SC', 'STSong', ui-serif, serif`
  - `--font-latin: 'Source Serif 4', 'LXGW WenKai', ui-serif, serif`
  - Map `--font-display` → `var(--font-paper)`
- Body `font-family: var(--font-paper)`
- Utility: `.font-latin { font-family: var(--font-latin); }` (for trial English headwords)

- [ ] **Step 1: Obtain woff2 files**

Preferred sources (pin exact release in commit message):
- LXGW WenKai: official release Lite/Regular woff2 (keep under ~8MB if possible; subset further if needed)
- Source Serif 4: `@fontsource/source-serif-4` files copied from `node_modules` latin woff2, **or** download from Google Fonts helper / fontsource CDN once into `public/fonts/`

If adding a package only to copy files, remove it after copy (do not leave unused runtime dep) **or** keep `@fontsource/source-serif-4` as a build-time copy source — prefer committed `public/fonts/*.woff2` with no runtime package.

- [ ] **Step 2: Write failing font CSS test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('paper fonts', () => {
  const css = readFileSync(resolve('src/index.css'), 'utf8')
  it('declares LXGW WenKai and Source Serif 4 faces', () => {
    expect(css).toMatch(/LXGW WenKai/)
    expect(css).toMatch(/Source Serif 4/)
    expect(css).toMatch(/lxgw-wenkai/)
    expect(css).toMatch(/source-serif-4/)
  })
  it('sets body to paper stack', () => {
    expect(css).toMatch(/--font-paper/)
    expect(css).toMatch(/font-family:\s*var\(--font-paper\)/)
  })
})
```

Also assert files exist:

```ts
import { accessSync } from 'node:fs'
accessSync(resolve('public/fonts/lxgw-wenkai-regular.woff2'))
accessSync(resolve('public/fonts/source-serif-4-latin-400.woff2'))
```

- [ ] **Step 3: Run to fail, then add `@font-face` + token updates in `src/index.css`**

```css
@font-face {
  font-family: 'LXGW WenKai';
  src: url('/fonts/lxgw-wenkai-regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Source Serif 4';
  src: url('/fonts/source-serif-4-latin-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@theme {
  --font-paper: 'LXGW WenKai', 'Songti SC', 'STSong', 'Noto Serif SC', ui-serif, serif;
  --font-latin: 'Source Serif 4', 'LXGW WenKai', ui-serif, serif;
  --font-display: var(--font-paper);
  /* keep existing color tokens */
}

body {
  font-family: var(--font-paper);
}

@utility font-latin {
  font-family: var(--font-latin);
}
```

Respect Vite `BASE_URL`: if site is served under a subpath, use relative `url('./fonts/...')` from CSS carefully — this project uses `import.meta.env.BASE_URL` in TS; for CSS prefer root-relative `${base}` via checking `vite.config` `base`. If `base` is `./` or `/`, match existing asset patterns. Inspect `vite.config.ts` and use the same base as other public assets (`/fonts/...` when base is `/`).

- [ ] **Step 4: Run tests + commit**

```bash
npx vitest run src/theme/fonts.test.ts
git add public/fonts src/index.css src/theme/fonts.test.ts scripts/fetch-fonts.mjs
git commit -m "feat(theme): self-host LXGW WenKai and Source Serif 4"
```

---

### Task 4: Shared button/panel utilities + Layout enter motion

**Files:**
- Modify: `src/index.css`
- Modify: `src/app/Layout.tsx`
- Create or modify: `src/app/Layout.test.tsx`

- [ ] **Step 1: Add utilities**

```css
@utility btn-primary {
  border: 1px solid var(--color-accent-hi);
  background: color-mix(in srgb, var(--color-accent) 20%, transparent);
  min-height: 2.75rem;
  border-radius: 0.5rem;
  padding-inline: 1rem;
}
@utility btn-secondary {
  border: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-muted);
  min-height: 2.75rem;
  border-radius: 0.5rem;
}
@utility panel-ink {
  border: 1px solid var(--color-line);
  background: color-mix(in srgb, var(--color-panel) 90%, transparent);
  border-radius: 0.5rem;
}
```

(If `@utility` with those names conflicts, use plain CSS classes `.btn-primary` etc.)

- [ ] **Step 2: Inner route enter**

On non-home `main`, add a short Motion fade/translate (≤280ms) gated by `useReducedMotion` from `motion/react`. Skip on home shell.

- [ ] **Step 3: Test Layout still renders nav labels 青庐/日课/锦匣/案头**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): paper button/panel utilities and inner-route fade"
```

---

### Task 5: Trial skin — QuestionCard, GradeBar, Gauge, Effects, TrialScreen

**Files:**
- Modify: `src/trial/components/QuestionCard.tsx`
- Modify: `src/trial/components/GradeBar.tsx`
- Modify: `src/trial/components/Gauge.tsx`
- Modify: `src/trial/components/Effects.tsx`
- Modify: `src/trial/TrialScreen.tsx`
- Modify: `src/trial/TrialScreen.test.tsx`
- Modify: `src/trial/components/ResultPanel.tsx`

**Interfaces:**
- Replace visual use of `TrackStreak` / `NitroFlash` with `PaperPulse` (name flexible) shown on nitro combos only
- Keep `emitNitro()` calls for now (tests listen to event) OR update tests — **choose: keep `emitNitro`, remove visual components**

- [ ] **Step 1: Update failing expectations in TrialScreen tests**

- Remove assertions that look for nitro flash DOM if any; keep `onNitro` event tests
- Ensure 「还行」「会了」「下一题」 still found

- [ ] **Step 2: QuestionCard**

- English headword: add `font-latin` class on `h2`
- Options: `min-h-12`, `text-base`, keep state colors but use ink accents (no white flash text if it hurts paper look — prefer `text-fg` on right state)

- [ ] **Step 3: GradeBar**

```tsx
<div className="mt-4">
  <div className="h-0.5 w-full bg-line">...</div>
  <div className="mt-3 grid grid-cols-2 gap-3">
    <button type="button" className="btn-secondary py-3" onClick={() => onGrade('ok')}>还行</button>
    <button type="button" className="btn-primary py-3 font-bold" onClick={() => onGrade('good')}>会了</button>
  </div>
</div>
```

- [ ] **Step 4: TrialScreen layout**

```tsx
<section className="flex min-h-[60dvh] flex-col">
  <Gauge ... />
  <div className="mt-6 w-full flex-1">
    <QuestionCard ... />
  </div>
  <div className="sticky bottom-0 -mx-1 bg-ink/80 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
    {correct && <GradeBar ... />}
    {picked !== null && !correct && (
      <button type="button" className="btn-primary w-full font-bold" onClick={() => commit('again')}>下一题</button>
    )}
  </div>
  {nitro && <PaperPulse key={...} />}
</section>
```

Remove `<TrackStreak />` and `<NitroFlash />` imports/usage.

- [ ] **Step 5: Effects.tsx**

Implement `PaperPulse` as a brief opacity pulse on a soft ink radial (≤400ms), null when reduced motion. Delete or stop exporting `TrackStreak` / `NitroFlash` if unused.

- [ ] **Step 6: Gauge + ResultPanel**

- Drop `tracking-wide` exaggeration on combo / eyebrow
- Result cells use `panel-ink`; back link uses `btn-primary w-full text-center`

- [ ] **Step 7: Run trial tests + commit**

```bash
npx vitest run src/trial
git add src/trial
git commit -m "feat(trial): paper-ink skin, sticky grade bar, drop nitro visuals"
```

---

### Task 6: Dashboard aria, settings export name, tracking cleanup

**Files:**
- Modify: `src/garage/Dashboard.tsx`
- Modify: `src/garage/Dashboard.test.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.test.tsx` (create if missing export assertion)
- Sweep: vault titles `tracking-wide` → milder or none where it fights WenKai

- [ ] **Step 1: Dashboard**

```tsx
aria-label="学习进度"
className="panel-ink flex items-center justify-between px-4 py-3"
```

Update tests from `青庐仪表` → `学习进度`.

- [ ] **Step 2: Settings export**

```ts
link.download = `qinglu-progress-${studyDay(new Date())}.json`
```

Test: spy on `URL.createObjectURL` / click and assert download attribute, or extract helper:

```ts
export function progressFilename(day: string) {
  return `qinglu-progress-${day}.json`
}
```

- [ ] **Step 3: Run**

```bash
npx vitest run src/garage/Dashboard.test.tsx src/pages/HomePage.test.tsx src/pages/SettingsPage.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(qinglu): rename progress export and neutralize dashboard label"
```

---

### Task 7: Full regression + spec status + manual checklist

- [ ] **Step 1: Run full suite**

```bash
npm test
npm run build
```

Expected: all pass; build succeeds (font files copied as static assets).

- [ ] **Step 2: Update spec status line**

In `docs/superpowers/specs/2026-10-15-qinglu-paper-ink-polish-design.md`, set `状态：已实现` (or `实现中` until deploy).

- [ ] **Step 3: Manual checklist (computerUse or device)**

- [ ] Phone/narrow: open vault photo — visible without scrolling; close in top-right; pinch zooms; swipe changes when scale=1
- [ ] Trial: options tappable; grade bar sticky; no track/nitro streaks
- [ ] Fonts: WenKai visible on Chinese UI; English word uses Source Serif 4
- [ ] Settings export downloads `qinglu-progress-*.json`

- [ ] **Step 4: Final commit if docs/status changed**

```bash
git commit -m "docs(qinglu): mark paper-ink polish spec implemented"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Portal viewer + scroll lock | Task 1 |
| Viewport top/bottom chrome | Task 1 |
| Pinch zoom / pan / double-tap reset | Task 2 |
| LXGW WenKai + Source Serif 4 self-host | Task 3 |
| Glass/button tokens + enter motion | Task 4 |
| Trial layout / sticky grades / paper pulse | Task 5 |
| Remove TrackStreak/NitroFlash visuals | Task 5 |
| Dashboard label + qinglu export name | Task 6 |
| reduced-motion honored | Tasks 2, 4, 5 |
| No CDN / no SRS / no FC / no cold-open | Global constraints |

## Plan self-review notes

- No TBD placeholders in tasks.
- `emitNitro` kept for event tests; visuals removed in Task 5.
- Font paths must match Vite `base` — verify in Task 3 against `vite.config.ts`.
- Pinch logic isolated in `photoZoom.ts` for reliable unit tests without jsdom Touch quirks.
