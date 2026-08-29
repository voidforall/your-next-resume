#!/usr/bin/env bash
# Render both documents through the shipped pipeline and assert what the honesty
# model depends on — in both directions:
#   the projection MUST carry the stamp, visibly and in /Info;
#   the present-day resume MUST NOT, because everything in it is true (ADR 0012).
# These failures are silent in a browser, so they are checked here rather than by eye.
set -euo pipefail

SKILLS="skills/your-next-resume/scripts"
OUT="$(mktemp -d)"
FAILED=0
fail() { echo "  ✗ $1" >&2; FAILED=1; }

node "$SKILLS/render-projection.mjs" "$OUT/projection.html" >/dev/null
node "$SKILLS/render-projection.mjs" "$OUT/today.html" --mode today >/dev/null
node "$SKILLS/render-pdf.mjs" "$OUT/projection.html" "$OUT/projection.pdf" >/dev/null
node "$SKILLS/render-pdf.mjs" "$OUT/today.html" "$OUT/today.pdf" >/dev/null

# ---- the projection: stamped, visibly and in metadata
info="$(pdfinfo "$OUT/projection.pdf")"
text="$(pdftotext "$OUT/projection.pdf" -)"
grep -q "A4" <<<"$info" || fail "projection: page size is not A4"
grep -qi "earned only if the roadmap is completed" <<<"$text" || fail "projection: stamp condition missing from the text layer"
grep -qi "not a record of experience" <<<"$text" || fail "projection: stamp negation missing from the text layer"
grep -qi "^Subject:.*not a record of experience" <<<"$info" || fail "projection: /Info Subject does not carry the negation"
grep -qi "^Keywords:.*projection" <<<"$info" || fail "projection: /Info Keywords not populated"
grep -qi "was:" <<<"$text" || fail "projection: reframed bullet lost its original wording"
[[ "$(wc -c <"$OUT/projection.pdf")" -gt 20000 ]] || fail "projection: PDF suspiciously small — fonts may not have embedded"

# ---- the present-day resume: true, therefore unmarked
info_t="$(pdfinfo "$OUT/today.pdf")"
text_t="$(pdftotext "$OUT/today.pdf" -)"
grep -q "A4" <<<"$info_t" || fail "today: page size is not A4"
if grep -qi "not a record of experience\|projected state\|earned only if" <<<"$text_t"; then fail "today: carries stamp text, but nothing in it is projected"; fi
if grep -qi "^Subject:" <<<"$info_t"; then fail "today: /Info Subject claims a projection"; fi
if grep -qi "^Keywords:" <<<"$info_t"; then fail "today: /Info Keywords claim a projection"; fi
if grep -q "PROJECTED" <<<"$text_t"; then fail "today: a projected bullet leaked into the present-day resume"; fi

if [[ "$FAILED" -eq 1 ]]; then echo "render check failed" >&2; exit 1; fi
echo "✓ projection stamped in text and /Info; present-day resume unmarked and free of projections"
