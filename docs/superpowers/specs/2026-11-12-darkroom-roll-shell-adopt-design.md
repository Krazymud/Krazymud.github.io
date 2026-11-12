# Darkroom: Adopt blackpeng roll-for-two shell

**Date:** 2026-11-12 (Asia/Shanghai)  
**Status:** approved for implementation (user: pick higher-quality clone, keep only vault photos/notes/lists)

## Verdict

| Repo | Level | Notes |
|------|-------|-------|
| [DDeng25/roll-for-two](https://github.com/DDeng25/roll-for-two) | Prototype | CSS/Web Audio parody; incomplete reel |
| [blackpeng21-lang/a-roll-for-two](https://github.com/blackpeng21-lang/a-roll-for-two) | Near-complete | Full iframe Three.js shell, scenes, props, transitions |

**Winner:** blackpeng. Adopt its **shell** (HTML/JS/scenes/assets), not its baked guest album.

## Goal

After vault unlock on erinamae.site, play the blackpeng reel experience 1:1 for non-personal chrome, while every photo, letter, and list comes only from the user’s vault. Do not ship Tong&CCC `u/` media or their `window.CONTENT` blob.

## Architecture

```
UnlockGate → VaultBridge → ReelShellHost
                              │ build CONTENT (blob: URLs)
                              │ sessionStorage + iframe /reel-shell/
                              ▼
                     vendored blackpeng index.html
                     (vault-bridge.js → content.js → scenes)
```

- Keep React unlock / vault crypto / mutate / COS sync unchanged.
- Replace post-unlock `ReelStage` (R3F parody) with `ReelShellHost` iframe of vendored shell.
- Map vault → `window.CONTENT` before `content.js` merge helpers run.
- Music: site PD tracks under `/darkroom/music/` (not blackpeng’s mixed playlist).
- Sample `img/p*.jpg` stay as shell fallbacks when vault frames are sparse; never commit `u/`.

## CONTENT mapping

| Vault | CONTENT |
|-------|---------|
| photos (rolls / chronological) | `rolls[].frames`, `picks.*`, `torch`, `book.cover/collage/theater/compass/map` |
| notes (text blobs) | `letter`, `book.endWords`, `book.burnt.pencil`, frame `line` where useful |
| lists (items) | `ticket.back`, `book.collageNotes`, optional radio song label |
| brand | `names.both` / credits → 「暗房」; strip Giada/Tong defaults when vault injects |

## Non-goals

- Do not redistribute another couple’s private photos or guest fonts (`g/`, `u/`).
- Do not re-implement the shell in R3F.
- Do not remove UnlockGate.

## Risks

- ~16MB+ static shell under `public/reel-shell/` (COS sync / Pages size).
- Shell assumes ≥4 rolls × 8 frames; adapter must pad with fallbacks.
- Blob URLs + sessionStorage must be same-origin; revoke URLs on lock/unmount.
