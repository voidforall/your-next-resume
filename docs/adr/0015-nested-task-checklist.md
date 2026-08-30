# 15. Nested Task checklist under Steps

Date: 2026-08-30
Status: Accepted

## Context

Feedback on the shipped Steps checklist (ADR 0013): each Step still reads like "a small milestone"
— a goal, not something concretely actionable — and action items should become more layered
(nested, not flat) and more granular (roughly an hour of work each). The user explicitly worried
this could make the page too dense, and wants the detail presented in a collapsed/abbreviated form
by default. Critically, they want visible, cascading positive feedback: ticking one small task
should move the needle at the step level, the milestone level, and the overall roadmap level —
"this is what would make more people want to use it."

## Decision

- One new optional nested layer, **Task**, under a Step: `- [ ]`/`- [x]` text, indented **exactly
  two spaces** — the same convention `projection.md` already uses for its `  - **Was:**` sub-line.
  No new syntax invented.
- **Indentation is the collision guard, for free.** The milestone's own `- [x] done` line and the
  flat Step regex both require column 0; an indented Task line can never match either, so ADR
  0013's "a Step's text must not be exactly 'done'" hazard does not recur one level down.
  `check-output.mjs` instead guards the one real near-miss: a checkbox-looking line at the *wrong*
  indent silently fails to parse as a Task — caught via a diagnostic loose-match count
  (`hasTaskIndentIssue`) and turned into a loud, specific failure.
- **A Step's own done-ness is derived, not independently settable, once it has Tasks**: 100% of its
  Tasks done ⇒ the Step is done. Its own checkbox renders `disabled` in that case — one source of
  truth, enforced structurally. A zero-task Step is untouched from ADR 0013.
- **Task/Step completion is never Evidence and never touches a milestone's real `- [x] done` gate**
  (ADR 0001/0002). Enforced visually: every rollup — per-step tally, per-milestone supplementary
  bar, roadmap-wide header meter, Tech Tree node fill — uses a deliberately grayscale/`--accent`
  palette, never the green `--proj`/`--proj-rule` tokens that mean real done-state elsewhere.
- **Collapsed by default at the Task layer only** — a narrow, documented exception to ADR 0013's
  "nothing hidden by default": the Steps list itself stays open; each Step's nested Task list is a
  `<details class="tasks">` closed by default.
- **Cascading feedback, recomputed live on every tick**: a per-step "N of M tasks" tally; a
  per-milestone "N of M action items done" bar; a roadmap-wide second header meter; a thin fill
  strip on each Tech Tree node (hidden once the milestone is actually done).
- **Reuses the exact existing architecture**: a new `TASKS_KEY` localStorage, namespaced exactly
  like `TICKS_KEY`/`STEPS_KEY`; same file-state-plus-browser-override pattern; same ES5 style; same
  "count once from the canonical (non-`.tt-detail`) card, paint every copy" pattern the ADR 0014
  double-count bug already taught this codebase.
- **Change-listener ordering gains a new, most-specific-first branch**: a Task checkbox's
  `closest("li[data-s]")` also matches its parent Step's `<li>`, so the listener tests `li[data-t]`
  before `li[data-s]` before `[data-m]` — the same structural hazard ADR 0013 already solved once
  one level up. A Step-with-Tasks' own checkbox is `disabled`, so it never dispatches `change`.

## Consequences

- `parse.mjs`'s `steps` entries gain `tasks: [{done, text}]` and `hasTaskIndentIssue`.
- `render-roadmap.mjs` gains `actionItems()`/`actionTally()` helpers; `stepsBlock()` renders nested
  Tasks and a supplementary progress bar; `treeNode()` gains an additive fill strip; `header()`
  gains a second, gated meter.
- `roadmap.client.js` gains `TASKS_KEY`/`paintTasks()`/`paintProgress()`; `isStepDone()` now derives
  from Tasks when present; the change listener gains the new first branch.
- `roadmap-schema.md` and `fixtures/alex-moreau/roadmap.md` both gain a worked Tasks example.
- ADR 0014's `paintTree()`, `selectNode()`/`relatedSet()`, and `computeTiers` are untouched — they
  operate purely on `milestone.done` and `dependsOn`, neither of which Task/Step completion affects.
