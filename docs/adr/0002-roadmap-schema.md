# 2. The roadmap and projection source files

Date: 2026-08-29
Status: Accepted
Ticket: [#7](https://github.com/voidforall/your-next-resume/issues/7)

## Context

The HTML roadmap and the projection PDF are both renderings. Something has to be the source of truth that the agent owns, a human can hand-edit, and a later check-in command could re-read. Terms are defined in [CONTEXT.md](../../CONTEXT.md); the rules these files must enforce come from [ADR 0001](0001-projection-contract.md).

## Decision

### Two files, split by what justifies a line

- **`roadmap.md`** — the Milestones, and the Projected Bullets each one earns. A Projected Bullet is written *inside* its Milestone.
- **`projection.md`** — only Carried and Reframed Bullets, which need no Milestone, arranged in resume order.

This makes ADR 0001's "no Milestone, no Projected Bullet" structurally impossible to violate: an orphan projected bullet has nowhere to be written. The Projection is assembled by taking `projection.md`'s sections and inserting each Projected Bullet into the section it names.

### Format

Markdown. YAML frontmatter for document metadata; one `##` section per Milestone; labelled bold lines for fields. The reader is an agent, so unambiguous beats machine-strict, and the file stays pleasant to hand-edit.

### Bullet ids

Stable, unique, prefixed by kind: `C1`, `C2` (carried), `R1` (reframed), `P1` (projected). Ids are what the roadmap HTML and the resume template use to draw the bullet↔milestone link, and what a later check-in would match on.

### Scheduling

**Absolute dates only.** Each Milestone carries `Start:` and `Due:`, both inside the Projection Window. No weekly-hours budget and no relative windows.

### Done state

The `- [ ] done` checkbox plus a `Completed:` date in `roadmap.md` is the durable record. The roadmap HTML's localStorage ticks are a per-browser convenience that never write back, and the page must say so plainly rather than implying a sync it cannot perform.

## The schema

### `roadmap.md`

````markdown
---
target: Staff Machine Learning Engineer — <company or archetype>
target_source: jd/anthropic-staff-mle.txt
window_start: 2026-09-01
window_end: 2027-02-28
generated: 2026-08-29
---

# Roadmap — Staff Machine Learning Engineer

## M1 — Ship a multi-GPU training harness

- [ ] done
- **Start:** 2026-09-01
- **Due:** 2026-10-15
- **Deliverable:** A public repo that trains a small LM across 4 GPUs with FSDP, with benchmarks and a written teardown.
- **Evidence:** `github.com/<user>/fsdp-harness` — public repo, README with benchmark table
- **Depends on:** —
- **Learning:** [PyTorch FSDP tutorial](https://…), [paper](https://…)
- **Completed:** —

**Earns**

- `P1` · *Projects* — Built and benchmarked a multi-GPU training harness on PyTorch FSDP against a single-GPU baseline.
- `P2` · *Skills* — PyTorch FSDP, distributed training
````

Field rules:

| Field | Required | Rule |
| --- | --- | --- |
| `## M<n> — <title>` | Yes | id unique, sequential; title is a verb phrase |
| `- [ ] done` | Yes | `- [x]` once the Evidence exists |
| `Start:` / `Due:` | Yes | ISO dates, both inside the window |
| `Where:` | Yes | `At work` or `Own time` — added by [ADR 0008](0008-where-the-work-happens.md) |
| `Deliverable:` | Yes | what gets built, written or published |
| `Evidence:` | Yes | third-party-checkable artifact; "learned X" is not Evidence |
| `Depends on:` | Yes | Milestone ids or `—`; must reference existing ids, no cycles |
| `Learning:` | No | links |
| `Completed:` | Yes | date or `—` |
| `**Earns**` list | Yes | ≥1 bullet: `` `<id>` · *<section>* — <text>`` |

### `projection.md`

````markdown
---
name: Jane Doe
headline: Machine Learning Engineer
contact: jane@example.com · github.com/janedoe
---

## Experience — Acme, Senior ML Engineer, 2023–present

- `C1` — Owned the feature store serving 40M daily inferences.
- `R2` — Led the migration of training pipelines to Kubernetes, cutting job setup from days to hours.
  - **Was:** Moved our training pipelines onto Kubernetes.

## Projects

## Skills
````

Frontmatter may also carry `ultimate_target:` and `next_hop_horizon:`, and the body a `## Reachability` section, when the target is out of reach ([ADR 0011](0011-reachability.md)). All three are absent on a reachable target.

Frontmatter may carry `headline_was:` — the headline is reframed by a Milestone earning an `R` bullet into the `Header` section, and ADR 0001 requires every reframe to be marked, so the original wording has to live somewhere. It is the one reframe whose `Was:` is not a bullet-level line.

A Reframed Bullet must carry its `Was:` line — the diptych needs the original text to show the reframe honestly. Empty sections are legal: they are the landing places Projected Bullets name.

### Validation

Every projected bullet id unique; every Milestone has non-empty `Evidence`; every projected bullet names a section that exists in `projection.md`; every reframed bullet has `Was:`; all dates inside the window; `Depends on:` acyclic and resolvable.

### A worked example must not model fabrication

The first version of this example claimed a projected bullet "cutting step time 2.1× over the naive baseline" — a precise figure invented before the work exists. An eval agent flagged that the skill's only concrete example pointed the opposite way from its own contract. A projected bullet names what will be built and measured, not the number the measurement will produce.

## Consequences

- The renderers (#8, #9) read ids, not text, to draw the bullet↔milestone link.
- The labelled-line format is additive: the at-risk dependency marker left un-taken in ADR 0001 can be added later as one more field without breaking existing files.
- Frontmatter also carries optional `own_time_capacity` ([ADR 0008](0008-where-the-work-happens.md)).
- **Absolute dates only means there is no effort model in the schema.** Reachability (#10) therefore cannot be judged from hours-versus-capacity; it has to be judged from the milestone count and calendar span, or #10 must introduce its own field. Flagged on that ticket.
- A check-in command remains possible without schema change: it would diff `Evidence` against reality and set `- [x]` plus `Completed:`.
