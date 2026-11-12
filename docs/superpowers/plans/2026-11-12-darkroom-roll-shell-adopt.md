# Darkroom Roll Shell Adopt — Implementation Plan

> **For agentic workers:** Execute task-by-task. Spec: `docs/superpowers/specs/2026-11-12-darkroom-roll-shell-adopt-design.md`.

**Goal:** Vendor blackpeng shell (sans private media) under `public/reel-shell/`, map vault → CONTENT, host after unlock.

**Tech:** Vite static `public/`, React host, Vitest for mapper.

## File map

| Path | Responsibility |
|------|----------------|
| `public/reel-shell/**` | Vendored shell (no `u/`, no guest CONTENT) |
| `public/reel-shell/vault-bridge.js` | Read sessionStorage → `window.CONTENT` |
| `public/reel-shell/SOURCE.md` | Upstream URL + scrub notes |
| `src/darkroom/reel/vaultToReelContent.ts` | Vault → CONTENT JSON |
| `src/darkroom/reel/ReelShellHost.tsx` | Blob URLs + iframe |
| `src/darkroom/DarkroomApp.tsx` | Use ReelShellHost when ready |
| `scripts/vendor-reel-shell.sh` | Re-copy scrubbed shell |

---

### Task 1: Vendor scrubbed shell

- [ ] Copy root HTML/JS/img/font/models/lib/sfx + short dj clips; exclude `u/`, `scene/`, `bc/`, `g/`, guest lines in `content.js`
- [ ] Add `vault-bridge.js`; load it before `content.js` in `index.html`
- [ ] Point MUSIC to `/darkroom/music/*.mp3`
- [ ] Write `SOURCE.md` + keep music LICENSE pointer

### Task 2: vaultToReelContent + tests

- [ ] Pad to 4×8 frames from photos; notes → letter; lists → ticket.back / collageNotes
- [ ] Vitest covers empty vault + photo mapping

### Task 3: ReelShellHost + wire DarkroomApp

- [ ] Create blob URLs via `readBlob`; stash CONTENT; iframe `?vault=1`
- [ ] Replace `ReelStage` in ready state; keep DeskCounts optional / hide inside shell
- [ ] Update tests; revoke blobs on unmount

### Task 4: Verify

- [ ] `npx vitest` for new tests; smoke iframe loads without `u/` paths in CONTENT
