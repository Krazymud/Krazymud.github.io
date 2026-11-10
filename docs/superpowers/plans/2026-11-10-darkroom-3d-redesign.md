# 暗房全站 3D 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public site shell with a passphrase-gated full-3D Darkroom that reads/writes the existing encrypted vault (photos as film rolls, notes/lists as letters) and removes trial/vocab and 青庐 chrome.

**Architecture:** Root route mounts unlock → `VaultSession` → R3F `DarkroomApp` (scene graph + camera rig + HTML overlays). Vault crypto/mutate/COS/STS stay behind a thin `VaultBridge`. Film rolls are derived from photo captions/dates and persisted as vault-adjacent metadata. No 2.5D product path; iPhone targets full visual quality.

**Tech Stack:** React 19, React Router 8, Vite 8, Vitest, Tailwind 4, `@react-three/fiber`, `@react-three/drei`, `three`, existing `src/vault/**`, Motion only where overlays need it.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-10-darkroom-3d-redesign-design.md` (approved).
- Outward copy: working title 「暗房」/ Darkroom — **no** 「青庐 / 日课 / 锦匣 / 案头」 in UI chrome.
- Remove trial/vocab product surface; stop shipping `public/words/**` in the app graph.
- Do not change vault encryption (`encryptJson` / DEK / passphrase KDF).
- Full 3D only; **no** 2.5D fallback UI; iPhone **no** visual downgrade (engineering streaming/budget OK; design target unchanged).
- Honor `prefers-reduced-motion` by reducing camera motion, staying in the 3D scene graph.
- Feature branch prefix `cursor/darkroom-*-8bae`; PR base `master`.
- Tests: Vitest + Testing Library; fake `fetch`; mock R3F canvas in unit tests where needed.

## File map

| Path | Responsibility |
|------|----------------|
| `src/config/copy.ts` | Darkroom-facing strings only |
| `src/app/routes.tsx` | `/` → Darkroom entry (unlock + canvas); drop trial/home/settings shell |
| `src/app/Layout.tsx` | Minimal or passthrough (no old nav) |
| `src/darkroom/rolls.ts` | Pure: classify photos → rolls |
| `src/darkroom/rolls.test.ts` | Caption/date classification fixtures |
| `src/darkroom/DarkroomApp.tsx` | Session gate + R3F provider + overlays |
| `src/darkroom/scene/DarkroomCanvas.tsx` | Canvas, lights, fog, grain post optional |
| `src/darkroom/scene/DeskScene.tsx` | Desk + placers for props |
| `src/darkroom/scene/CameraRig.tsx` | Dolly between focus targets |
| `src/darkroom/scene/props/*` | Envelope, Canister, Lightbox, Tray, Viewer meshes |
| `src/darkroom/overlays/UnlockGate.tsx` | Reuse unlock UX, rebranded |
| `src/darkroom/overlays/LetterOverlay.tsx` | Note vs list letter chrome + edit |
| `src/darkroom/overlays/SyncDrawer.tsx` | STS gate save/forget |
| `src/darkroom/VaultBridge.tsx` | Wraps `useVaultMutate` + blob read for scene |
| `src/pages/DarkroomPage.tsx` | Lazy page entry |
| `index.html` | Title/meta → 暗房 |
| `package.json` | Add R3F/drei/three; drop `words` script usage from app |

---

### Task 1: Copy + routes — Darkroom-only entry, kill trial

**Files:**
- Modify: `src/config/copy.ts`
- Modify: `src/config/copy.test.ts`
- Modify: `src/app/routes.tsx`
- Modify: `src/app/App.test.tsx` (and any Layout nav tests)
- Modify: `index.html`

**Interfaces:**
- Consumes: existing `UnlockPanel` / `VaultScreen` patterns (later tasks rewire)
- Produces: `copy.siteName === '暗房'`; routes without `trial`; `/` loads Darkroom page stub

- [ ] **Step 1: Write failing copy test**

```ts
// src/config/copy.test.ts
it('exposes 暗房 naming without 青庐 chrome', () => {
  expect(copy.siteName).toBe('暗房')
  expect(copy.nav).toEqual({ home: '暗房', unlock: '启封', lock: '锁上' })
  expect(JSON.stringify(copy)).not.toMatch(/青庐|日课|锦匣|案头/)
})
```

- [ ] **Step 2: Run test — expect fail**

Run: `npx vitest run src/config/copy.test.ts`
Expected: FAIL on `siteName` / nav assertions

- [ ] **Step 3: Update `copy.ts` minimally**

```ts
export const copy = {
  siteName: '暗房',
  nav: { home: '暗房', unlock: '启封', lock: '锁上' },
  darkroom: {
    opening: '正在进入暗房…',
    empty: '暗房里还没有东西。',
    broken: '暗房暂时打不开',
    unseal: '启封',
    unsealing: '正在启封…',
    holdHint: '按住启封',
    tapHint: '点一下启封',
    syncGate: '同步口令',
    saveGate: '保存口令',
    forgetGate: '忘记口令',
    unsynced: '还没同步',
  },
} as const
```

Remove `home.*trial*`, `trial`, old `vault`/`settings` blocks or replace usages in the same commit by updating imports to `copy.darkroom`.

- [ ] **Step 4: Change routes to Darkroom stub**

```tsx
// src/app/routes.tsx
const DarkroomPage = lazy(() =>
  import('../pages/DarkroomPage').then((m) => ({ default: m.DarkroomPage })),
)
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<p className="mt-10 text-center text-sm text-muted">{copy.darkroom.opening}</p>}>
            <DarkroomPage />
          </Suspense>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
```

Create stub:

```tsx
// src/pages/DarkroomPage.tsx
export function DarkroomPage() {
  return <p>{/* Task 3 replaces */}'暗房'}</p>
}
```

Update `index.html` `<title>暗房</title>`.

- [ ] **Step 5: Fix broken tests referencing 青庐/日课/trial routes; run suite subset**

Run: `npx vitest run src/config/copy.test.ts src/app/App.test.tsx`
Expected: PASS (update App tests to assert `/` shows 暗房 stub, `/trial` redirects home)

- [ ] **Step 6: Commit**

```bash
git add src/config/copy.ts src/config/copy.test.ts src/app/routes.tsx src/pages/DarkroomPage.tsx index.html src/app/App.test.tsx
git commit -m "feat(darkroom): rebrand copy and route site through Darkroom entry"
```

---

### Task 2: Film roll classifier (pure)

**Files:**
- Create: `src/darkroom/rolls.ts`
- Create: `src/darkroom/rolls.test.ts`

**Interfaces:**
- Consumes: `PhotoEntry` from `src/vault/types.ts`
- Produces:

```ts
export type FilmRoll = { id: string; title: string; photoSources: string[] }
export function classifyPhotosIntoRolls(photos: PhotoEntry[]): FilmRoll[]
```

- [ ] **Step 1: Failing tests**

```ts
import { classifyPhotosIntoRolls } from './rolls'
import type { PhotoEntry } from '../vault/types'

function photo(partial: Partial<PhotoEntry> & Pick<PhotoEntry, 'source' | 'caption' | 'date'>): PhotoEntry {
  return {
    width: 1,
    height: 1,
    thumb: 't',
    full: 'f',
    hash: 'h',
    ...partial,
  }
}

it('groups by caption keywords into multiple rolls and parks unknowns', () => {
  const rolls = classifyPhotosIntoRolls([
    photo({ source: 'a', caption: '海边日落', date: '2024-06-01' }),
    photo({ source: 'b', caption: '沙滩脚印', date: '2024-06-02' }),
    photo({ source: 'c', caption: '厨房早餐', date: '2024-07-01' }),
    photo({ source: 'd', caption: '', date: '2024-08-01' }),
  ])
  expect(rolls.length).toBeGreaterThanOrEqual(2)
  expect(rolls.some((r) => r.photoSources.includes('d'))).toBe(true)
  const untitled = rolls.find((r) => r.id === 'unfiled' || /未分类/.test(r.title))
  expect(untitled?.photoSources).toContain('d')
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/darkroom/rolls.test.ts`
Expected: FAIL cannot find module / function

- [ ] **Step 3: Implement classifier**

Implement keyword buckets (中文/英文轻量词典：海/山/城/家/食/旅/nature/city/home…）+ date proximity merge so buckets stay **3–5** rolls when possible; empty caption → `unfiled` / 「未分类」. Export stable `id` slugs (`sea`, `home`, `unfiled`, …).

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/darkroom/rolls.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/darkroom/rolls.ts src/darkroom/rolls.test.ts
git commit -m "feat(darkroom): classify vault photos into film rolls"
```

---

### Task 3: Unlock gate → DarkroomApp shell (no WebGL content yet)

**Files:**
- Create: `src/darkroom/DarkroomApp.tsx`
- Create: `src/darkroom/overlays/UnlockGate.tsx` (wrap/adapt `UnlockPanel`)
- Modify: `src/pages/DarkroomPage.tsx`
- Modify: `src/vault/VaultScreen.tsx` **or** extract shared unlock+load into bridge used by Darkroom (prefer extract to avoid dual shells)
- Test: `src/darkroom/DarkroomApp.test.tsx`

**Interfaces:**
- Consumes: `loadVaultFile` / `unlockWithPassphrase` / `defaultKeyStore` from vault
- Produces: `DarkroomApp` renders unlock until session ready, then children placeholder `data-testid="darkroom-ready"`

- [ ] **Step 1: Failing test — unlock path**

```tsx
it('shows unlock then ready after successful passphrase', async () => {
  // mount DarkroomApp with test vault fetchBytes + in-memory keyStore
  expect(screen.getByLabelText(/口令|启封/i)).toBeTruthy()
  // submit correct passphrase from testVault
  expect(await screen.findByTestId('darkroom-ready')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/darkroom/DarkroomApp.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement load+unlock wiring**

Reuse patterns from `VaultScreen.tsx` (remembered key, passphrase unlock). On success set session state and render:

```tsx
<div data-testid="darkroom-ready">
  {/* Task 4 mounts Canvas here */}
  <p>ready</p>
</div>
```

`DarkroomPage` → `<DarkroomApp />`.

- [ ] **Step 4: Tests pass**

Run: `npx vitest run src/darkroom/DarkroomApp.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/darkroom src/pages/DarkroomPage.tsx
git commit -m "feat(darkroom): passphrase gate into DarkroomApp shell"
```

---

### Task 4: R3F canvas + desk + camera rig

**Files:**
- Modify: `package.json` / lockfile — add `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`
- Create: `src/darkroom/scene/DarkroomCanvas.tsx`
- Create: `src/darkroom/scene/DeskScene.tsx`
- Create: `src/darkroom/scene/CameraRig.tsx`
- Modify: `src/darkroom/DarkroomApp.tsx`
- Test: logic tests for camera focus ids (pure helper), smoke mock for Canvas

**Interfaces:**
- Produces: `FocusId = 'desk' | 'envelope' | 'rolls' | 'lightbox' | 'tray' | 'viewer'`
- Produces: `CameraRig({ focus: FocusId })` animates camera toward named anchors
- Produces: clickable group `userData.focusId` on each prop placeholder mesh

- [ ] **Step 1: Install deps**

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

- [ ] **Step 2: Failing test for focus helper**

```ts
// src/darkroom/scene/cameraFocus.test.ts
import { anchorForFocus } from './cameraFocus'
expect(anchorForFocus('desk').position[1]).toBeGreaterThan(0)
expect(anchorForFocus('envelope')).not.toEqual(anchorForFocus('rolls'))
```

- [ ] **Step 3: Implement canvas**

`DarkroomCanvas` wraps `<Canvas>` with dark clear color, desk plane, five placeholder meshes (box/cylinder) with `onClick` → `setFocus`. `CameraRig` lerps to `anchorForFocus(focus)`. Respect `prefers-reduced-motion`: snap instead of lerp.

Wire into `DarkroomApp` replacing ready placeholder.

- [ ] **Step 4: Manual check**

Run: `npm run dev` — unlock (local test vault or remembered) → see dark desk and clickable props.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/darkroom/scene src/darkroom/DarkroomApp.tsx
git commit -m "feat(darkroom): R3F desk canvas and camera focus rig"
```

---

### Task 5: VaultBridge — manifest to scene + rolls

**Files:**
- Create: `src/darkroom/VaultBridge.tsx`
- Modify: `src/darkroom/DarkroomApp.tsx`
- Create: `src/darkroom/VaultBridge.test.tsx`

**Interfaces:**
- Consumes: `useVaultMutate`, `classifyPhotosIntoRolls`, session `dek`/`file`/`manifest`/`fetchBytes`
- Produces: context value

```ts
type DarkroomVault = {
  rolls: FilmRoll[]
  notes: NoteEntry[]
  lists: ListEntry[]
  readBlob: (name: string) => Promise<Uint8Array>
  saveNote: ... // mirror mutate API subset
  saveList: ...
  addPhoto: ...
  deletePhoto: ...
  tokenSaved: boolean
  saveToken: (gate: string) => Promise<void>
  forgetToken: () => Promise<void>
  unsynced: boolean
  lock: () => void
}
```

- [ ] **Step 1: Failing test** — bridge exposes rolls from fixture manifest photos

- [ ] **Step 2: Implement provider** wrapping `useVaultMutate` after unlock

- [ ] **Step 3: Desk labels show roll count / note count from context (HTML or sprite text)**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(darkroom): VaultBridge exposes rolls and mutate API to scene"
```

---

### Task 6: Letters — notes + lists overlays

**Files:**
- Create: `src/darkroom/overlays/LetterOverlay.tsx`
- Create: `src/darkroom/overlays/LetterOverlay.test.tsx`
- Modify: envelope prop click → `focus='envelope'` + open overlay mode `notes | lists`

**Interfaces:**
- Note letter: typewriter chrome; fields title/date/body; save via `saveNote`
- List letter: punched-form chrome; toggles via `toggleListItem` / `saveList`
- Visual distinction required (paper tint, stamp, monospace vs form labels)

- [ ] **Step 1: Failing tests for note save and list toggle calling bridge mocks**

- [ ] **Step 2: Implement overlay UI + create-new affordances (“blank sheet” / “blank form”)**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(darkroom): note and list letters with distinct stationery"
```

---

### Task 7: Rolls → strip → lightbox frames

**Files:**
- Create: `src/darkroom/overlays/RollSelect.tsx`
- Create: `src/darkroom/overlays/FilmStrip.tsx`
- Create: `src/darkroom/overlays/FrameView.tsx`
- Modify: canister / lightbox props

**Interfaces:**
- Selecting a roll sets `activeRollId`; strip lists `photoSources`
- Thumbs via `readBlob(thumb)` → object URL; revoke on unmount
- Lightbox focus shows selected frame full blob

- [ ] **Step 1: Tests for roll select → active roll photos ordering**

- [ ] **Step 2: Implement strip + frame; wire tray later for add**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(darkroom): film roll select, strip, and lightbox frame view"
```

---

### Task 8: In-world create photo + sync drawer + lock

**Files:**
- Modify: tray prop → file input hidden + `addPhoto` (reuse `photoProcess`)
- Create: `src/darkroom/overlays/SyncDrawer.tsx`
- Modify: UnlockGate / DarkroomApp for lock clearing keyStore session

**Interfaces:**
- Tray click → choose image → process → `addPhoto` → short “develop” animation (opacity/scale on a plane)
- Sync drawer: gate input using `copy.darkroom.*`; shows `unsynced`
- Lock: `keyStore.clear` + drop session → unlock UI

- [ ] **Step 1: Tests for sync drawer saveToken mock; lock returns to unlock**

- [ ] **Step 2: Implement tray upload + drawer + lock control**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(darkroom): tray capture, sync drawer, and lock"
```

---

### Task 9: Remove trial surface + words from product graph

**Files:**
- Delete or stop importing: `src/pages/TrialPage.tsx`, `src/trial/**` from app entry (keep deleting in one commit if tests allow)
- Modify: `package.json` — remove `words` script if unused
- Delete: `public/words/**` (large) in same or follow-up commit
- Fix any remaining imports/tests

- [ ] **Step 1: `rg` for `trial|public/words|日课|青庐` under `src/` — zero product references**

- [ ] **Step 2: Remove files; fix tests; `npx vitest run` green**

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(darkroom): remove trial vocab product and 青庐 leftovers"
```

---

### Task 10: Prop polish + iPhone acceptance

**Files:**
- Replace placeholder meshes with higher-quality glTF/textures under `public/darkroom/`
- Tune lights, bloom/grain if used
- Manual checklist on iPhone Safari

**Checklist:**
- [ ] Cold load → 启封 only
- [ ] Unlock → full 3D desk (not flat fallback)
- [ ] Open note letter + list letter; edit persists after reload
- [ ] Rolls reflect classification; open frame
- [ ] Add photo via tray; appears in a roll
- [ ] Sync gate + unsynced strip behavior
- [ ] Lock returns to 启封
- [ ] `prefers-reduced-motion`: reduced camera lerp

- [ ] **Step 1: Asset pass + commit**

```bash
git commit -m "feat(darkroom): polish 3D props and lighting for ship target"
```

- [ ] **Step 2: Record iPhone walkthrough under `/opt/cursor/artifacts/`**

---

## Spec coverage check

| Spec section | Tasks |
|--------------|-------|
| §2 Entry IA / remove trial nav | 1, 3, 9 |
| §3 Scenes / camera / props | 4, 7, 10 |
| §4 Vault map / letters / rolls / edit | 2, 5, 6, 7, 8 |
| Full 3D, no 2.5D, iPhone no downgrade | 4, 10 |
| COS/STS unchanged | 5, 8 (reuse) |
| Brand 暗房, no 青庐 | 1, 9 |

## Placeholder scan

No TBD steps; classifier keyword lists live in Task 2 implementation; formal English product name deferred by using 「暗房」 everywhere in UI.
