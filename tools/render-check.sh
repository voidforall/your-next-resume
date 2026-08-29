#!/usr/bin/env bash
# Render the projection and assert the invariants the honesty model depends on.
# Usage: tools/render-check.sh [path-to-html]
# Today this points at the diptych prototype; it moves to the real template when one exists.
set -euo pipefail

PAGE="${1:-spikes/resume-diptych/diptych.prototype.html}"
OUT="$(mktemp -d)/projection.pdf"

find_chrome() {
  [[ -n "${CHROME_PATH:-}" && -x "${CHROME_PATH}" ]] && { echo "$CHROME_PATH"; return; }
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
    [[ -x "$c" ]] && { echo "$c"; return; }
  done
  for c in google-chrome-stable google-chrome chromium-browser chromium microsoft-edge-stable; do
    command -v "$c" >/dev/null && { command -v "$c"; return; }
  done
  echo "no Chrome-family browser found" >&2; exit 1
}

CHROME="$(find_chrome)"
"$CHROME" --headless --no-pdf-header-footer --disable-gpu \
  --print-to-pdf="$OUT" "file://$PWD/$PAGE" 2>/dev/null

fail() { echo "  ✗ $1" >&2; FAILED=1; }
FAILED=0

pdfinfo "$OUT" | grep -q "A4" || fail "page size is not A4"
[[ "$(pdfinfo "$OUT" | awk -F': *' '/^Pages/{print $2}')" -ge 1 ]] || fail "no pages"
TEXT="$(pdftotext "$OUT" -)"
grep -qi "earned only if the roadmap is completed" <<<"$TEXT" || fail "stamp condition missing from the text layer"
grep -qi "not a record of experience" <<<"$TEXT" || fail "stamp negation missing from the text layer"
grep -qi "was:" <<<"$TEXT" || fail "reframed bullet lost its original wording"
[[ "$(wc -c <"$OUT")" -gt 20000 ]] || fail "PDF is suspiciously small — fonts may not have embedded"

if [[ "$FAILED" -eq 1 ]]; then echo "render check failed ($PAGE)" >&2; exit 1; fi
echo "✓ rendered $PAGE — A4, stamp intact in the text layer, reframe preserved"
