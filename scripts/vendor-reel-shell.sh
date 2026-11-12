#!/usr/bin/env bash
# Re-vendor scrubbed blackpeng shell into public/reel-shell.
# Usage: scripts/vendor-reel-shell.sh /path/to/a-roll-for-two
set -euo pipefail
SRC="${1:?path to blackpeng clone}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/public/reel-shell"
rm -rf "$DST"
mkdir -p "$DST"
cp -a "$SRC"/*.html "$SRC"/*.js "$SRC"/placeholder.svg "$DST"/
cp -a "$SRC"/dj.mp3 "$SRC"/dj2.mp3 "$SRC"/goodnight.mp3 "$DST"/ 2>/dev/null || true
for d in img font models lib sfx; do
  mkdir -p "$DST/$d"
  cp -a "$SRC/$d/." "$DST/$d/"
done
find "$DST" -type d -name u -prune -exec rm -rf {} +
python3 - <<'PY' "$DST/content.js"
from pathlib import Path
import sys
p = Path(sys.argv[1])
lines = p.read_text("utf-8").splitlines(True)
out = [l for l in lines if not (l.startswith("window.ZH_GUEST") or l.startswith("window.CONTENT="))]
text = "".join(out)
if "Tong&CCC" in text or "u/11c5f62a" in text:
    raise SystemExit("guest content still present")
p.write_text(text, "utf-8")
PY
mkdir -p "$DST/music"
cp "$ROOT/public/darkroom/music/LICENSE.txt" "$DST/music/LICENSE.txt"
echo "Vendored to $DST — re-apply vault-bridge.js + MUSIC patch from git history if overwritten."
