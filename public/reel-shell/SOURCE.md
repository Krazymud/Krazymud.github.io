# Reel shell source

Vendored (scrubbed) from [blackpeng21-lang/a-roll-for-two](https://github.com/blackpeng21-lang/a-roll-for-two) — a near-complete static clone of the Douyin “A Roll For Two” gift site.

## Scrubbed / not included

- Guest album `u/` (private photos)
- Prefixed `window.CONTENT` / `window.ZH_GUEST` blobs (Tong&CCC / subset fonts)
- Nested duplicate trees `scene/`, `bc/`
- Upstream `music/*.mp3` playlist (replaced by this site’s public-domain tracks under `/darkroom/music/`)

## Local additions

- `vault-bridge.js` — inherits `top`/`parent` CONTENT or `sessionStorage['reel-vault-content']` before `content.js` (required on every scene page; nested iframes otherwise fall back to sample film)
- Scene HTML loads `vault-bridge.js` immediately before `content.js`
- `index.html` redirects top-level visits to `/` (site entry is erinamae.site); embed via `?embed=1` / `?vault=1` from the Darkroom host
- MUSIC paths in `index.html` point at `/darkroom/music/*.mp3`

Re-run `scripts/vendor-reel-shell.sh` only from a fresh clone when updating the shell; always re-apply scrub steps.
