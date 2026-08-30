# 13. Milestone Steps checklist

Date: 2026-08-29
Status: Accepted

## Context

The roadmap page (ADR 0004) shows each milestone as Deliverable, Evidence, dependencies and one
optional `Learning:` line — what to build and what proves it, not how to get there. Feedback from a
projection run: the roadmap reads as "a brief description and deliverable," not "a real roadmap,"
missing a concrete list of action items and the resources (books, videos, public codebases) that go
with each one, and missing any expandable structure to drill into.

ADR 0002 already calls the labelled-line format additive ("can be added later as one more field
without breaking existing files"). ADR 0004 already splits "when" (timeline) from "why" (by resume
line). This ADR adds "how" — scoped to the timeline view only, consistent with that split.

## Decision

- A new, optional `**Steps**` block per milestone, placed after the labelled fields and before
  `**Earns**` — mirrors the render order inside `card()` (what → how → what it earns).
- Grammar: a `**Steps**` heading, then one `- [ ] text` / `- [x] text` line per action item.
  Resources are inline markdown (`[label](url)`, `` `code` ``) — the same grammar every other free
  text field already uses. No new syntax invented.
- Rendered as a native `<details open>` disclosure inside the milestone's card, in the timeline
  view only (the by-resume-line view stays bullet-centric proof, per ADR 0004).
- The file is still the source of truth for step completion, exactly mirroring the existing
  milestone-done convention. Browser ticks live in a separately-namespaced localStorage key/object
  (`ynr.roadmap.steps.<key>`, composite key `"<milestoneId>:<stepIndex>"`) that never writes back
  and never touches the milestone's own done state or the page's progress meter.
- Defaults open on every render — nothing hidden by default, consistent with ADR 0004 rejecting a
  hidden "Later" bucket.
- A milestone with no `**Steps**` block renders exactly as before — fully additive.
- A step's text must never be exactly `"done"` (case-insensitive): the milestone's own `done`
  detection (`/^- \[x\] done$/m`) tests the whole section, not just the preamble, so an identically
  worded step would be indistinguishable from the milestone's own done marker.
  `check-output.mjs` fails loudly on this rather than let it silently corrupt milestone state.

## Consequences

- `parse.mjs` gains `steps: [{ done, text }]` and `hasStepsHeading` per milestone; the "single
  source of parsing truth" boundary holds — `check-output.mjs` reads these fields rather than
  re-parsing raw text.
- `check-output.mjs` gains a check for a `**Steps**` heading that parses to zero items (the same
  "a plausible-looking variant must not silently parse to nothing" principle already used
  elsewhere in this schema), and for the `"done"`-collision case above.
- `roadmap.client.js`'s former single-checkbox-per-card assumption no longer holds — a step `<li>`
  sits inside a `<details>` inside `.card[data-m]`, so both a step checkbox and the milestone's own
  checkbox resolve to the same `closest("[data-m]")`. The change listener now checks for
  `li[data-s]` ancestry first and handles that case separately before falling through to the
  existing milestone-done branch, unchanged.
- `roadmap-schema.md`'s worked example and `fixtures/alex-moreau/roadmap.md`'s M1 both gain a
  Steps block, kept identical in structure as they already are today.
- No change needed to `render-roadmap.mjs`'s `validate()`, `render-pdf.mjs`, `render-check.sh`,
  `evals.json`, or the CI workflow — Steps is optional and degrades to "no block rendered," which
  is not misleading, just absent.
