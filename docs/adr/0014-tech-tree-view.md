# 14. Tech Tree view

Date: 2026-08-30
Status: Accepted

## Context

Feedback on the rendered roadmap: it should look like a real, game-style tech tree — milestones as
nodes connected by their dependencies, with the ability to select one and see what it needs and
what it unlocks. Confirmed directly with the user:

1. This is an **added third view**, not a replacement for Timeline (ADR 0004) — Timeline stays the
   print-safe default and what the tick-tracking UX is built around.
2. Clicking a node selects it: dims everything unrelated, highlights the full dependency chain
   (ancestors it needs, descendants it unlocks), and opens a detail panel with the milestone's full
   Deliverable/Evidence/Steps (ADR 0013)/Earns.

`parse.mjs` already exposes `dependsOn: string[]` per milestone — no schema or parser change is
needed; this is purely a `render-roadmap.mjs` + `roadmap.client.js` + `roadmap.css` feature.

## Decision

- **Tiers from `dependsOn`**: tier 0 = no dependencies, else `1 + max(tier of each dependency)`.
  `computeTiers` is a Kahn-style layered BFS, not recursive, so it cannot blow the stack.
- **Cycles are a schema error, reported by `validate()`**, the same "a half-rendered roadmap is
  worse than no page" gate ADR 0002's grammar already relies on elsewhere.
  `computeTiers` itself degrades any unresolved (cyclic) node to tier 0 as an internal backstop —
  so the function can never hang even if called before validation — but a cyclic file is rejected
  before it ever reaches the renderer.
- **Server-computed, fixed-position layout — no client-side layout pass.** Nodes are uniform boxes
  placed with server-emitted inline `left`/`top`, not CSS Grid (which would need the same pixel
  math anyway to feed the connector overlay). Ties within a tier break by the existing `byDue`
  helper, top-aligned.
- **Connectors are a hand-rolled inline `<svg>` overlay**, one cubic-bezier path per
  dependency→dependent edge, computed from the same coordinates as the nodes. No charting library.
- **Node face is compact** (id, title, status); full detail lives in a side panel built by reusing
  `card()` (which gained an additive `extraClass` option) for every milestone, hidden by default,
  toggled to `.is-active` by a click listener matching on `data-m`. No HTML injection.
- **Node status reflects real state**: `done`, `available` (every dependency done, not yet started),
  `locked` (a dependency isn't done) — computed server-side for first paint and recomputed
  client-side by `paintTree()`, called as the last statement inside the existing `paint()` so every
  existing tick path (milestone or step) triggers it for free.
- **One data source for both the reverse-dependency graph and live lock state**: each node carries
  `data-deps`, its own `dependsOn`. The client derives the forward map and the reverse map from it
  once at load — no server-emitted JSON island, no second mechanism.
- **Print safety fix**: the existing view-hide CSS is unconditional, not print-scoped, so whatever
  view is on screen also prints. Hiding `.view-tree` only under `@media print` without also forcing
  Timeline back on would print a blank page when Tech Tree is the active screen view. Fixed with an
  explicit print-only override that forces `.view-timeline` visible and `.view-tree` hidden
  whenever `data-view=tree`, leaving prior Timeline/Bullets print behavior untouched.

## Consequences

- No change to `parse.mjs`, `check-output.mjs`, `render-pdf.mjs`, `render-projection.mjs`,
  `tools/render-check.sh`, or `evals/evals.json` — this view only consumes fields the existing
  pipeline already validates, the same conclusion ADR 0013 reached for the Steps checklist.
- `card()` gains an additive `extraClass` parameter (default `""`); existing call sites in
  `timelineView()` are unaffected.
- The detail panel reusing `card()` means ticking a step or the done-checkbox inside it already
  syncs everywhere else via the existing global `paint()`/`paintSteps()` — no new sync logic.
- A milestone graph with a dependency cycle now fails validation with a specific message rather
  than being silently laid out incorrectly or hanging the renderer.
