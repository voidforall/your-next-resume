#!/usr/bin/env bash
# Render the projection through the real pipeline and assert the invariants the honesty
# model depends on. This runs the shipped script — browser probe, Chrome flags and the
# /Info metadata stamp — so CI fails if any stage of it regresses, not just the flags.
#
# Usage: tools/render-check.sh [path-to-html]
#
# Today this points at the diptych prototype; it moves to the real generated projection
# when #18's renderer produces one. Needs Node 18+, a Chrome-family browser and poppler
# (pdfinfo/pdftotext). Set CHROME_PATH to override the probe.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RENDERER="$ROOT/skills/your-next-resume/scripts/render-pdf.mjs"

PAGE="${1:-$ROOT/spikes/resume-diptych/diptych.prototype.html}"
[[ "$PAGE" == /* ]] || PAGE="$PWD/$PAGE"
OUT="$(mktemp -d)/projection.pdf"

node "$RENDERER" "$PAGE" "$OUT"

fail() { echo "  ✗ $1" >&2; FAILED=1; }
FAILED=0

INFO="$(pdfinfo "$OUT")"
grep -q "A4" <<<"$INFO" || fail "page size is not A4"
[[ "$(awk -F': *' '/^Pages/{print $2}' <<<"$INFO")" -ge 1 ]] || fail "no pages"

TEXT="$(pdftotext "$OUT" -)"
grep -qi "earned only if the roadmap is completed" <<<"$TEXT" || fail "stamp condition missing from the text layer"
grep -qi "not a record of experience" <<<"$TEXT" || fail "stamp negation missing from the text layer"
grep -qi "was:" <<<"$TEXT" || fail "reframed bullet lost its original wording"
[[ "$(wc -c <"$OUT")" -gt 20000 ]] || fail "PDF is suspiciously small — fonts may not have embedded"

# ADR 0001 §5's metadata layer. Chrome sets /Title and nothing else, so a populated
# /Subject is proof that set-pdf-metadata.mjs ran and its incremental update parsed.
# (pdfinfo, not mdls — mdls reports (null) for a correct PDF. See FINDINGS §4.)
grep -qi "^Subject: .*not a record of experience" <<<"$INFO" || fail "/Subject missing the stamp statement — the metadata step did not run"
grep -qi "^Keywords: .*projection" <<<"$INFO" || fail "/Keywords missing — the metadata step did not run"
grep -qi "^Title: .*projection" <<<"$INFO" || fail "/Title is not the stamp statement"

if [[ "$FAILED" -eq 1 ]]; then echo "render check failed ($PAGE)" >&2; exit 1; fi
echo "✓ rendered $PAGE — A4, stamp intact in the text layer and in /Info, reframe preserved"
