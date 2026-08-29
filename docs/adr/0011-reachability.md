# 11. When the target is out of reach

Date: 2026-08-29
Status: Accepted
Ticket: [#10](https://github.com/voidforall/your-next-resume/issues/10)

## Context

Someone points this at a role they cannot credibly reach inside the window. The tool must not become a fantasy machine, and must not become a demoraliser. [ADR 0002](0002-roadmap-schema.md) carries no effort model, so reachability is judged from the target's requirements, the current resume, the window, and the coarse capacity answer from [ADR 0008](0008-where-the-work-happens.md).

## Decision

### Judgement: classify every requirement

For each requirement the target names, assign a gap class:

| Class | Meaning |
| --- | --- |
| **Closeable** | can be earned inside the window |
| **Longer** | earnable, but needs more time than the window allows |
| **Needs a different job first** | cannot be earned from where the user currently sits — you cannot earn "led a team of eight" without a team |

The target is **out of reach** when any requirement falls in the third class, or when too many fall in the second. Qualitative and transparent: the user can argue with a specific line rather than a verdict, and there is no fake precision to attack. Explicitly rejected: a readiness score out of 100 — prior art ([#4](https://github.com/voidforall/your-next-resume/issues/4)) found the same resume scoring 90/74/88 across scanners, so a number would be the first thing critics reach for.

### Output: two hops

Keep the window the user asked for. Project to the role they can credibly reach inside it, and name the real target as the **next hop** with a rough horizon:

> Six months gets you to *X*. *Y* is roughly another eighteen months beyond that, and this is the first leg of it.

The dream stays on the page as a destination rather than as a claim.

### Override

If the user says do it anyway, generate against the original target — **and keep the gap classification visible on the roadmap page**, including every requirement marked as needing a different job first. What we decline is to make the honest assessment disappear, not to make the document.

### Where it sits in the run

Between reading the target and generating the roadmap ([ADR 0010](0010-the-run.md) step 5), so the classification informs which milestones exist at all. When the target is out of reach, checkpoint 2 is where the two-hop plan is presented and where the override is offered.

### Schema

`roadmap.md` frontmatter gains, when the target is out of reach:

```yaml
target: Senior Machine Learning Engineer      # the hop being planned
ultimate_target: Staff ML Engineer — <archetype>
next_hop_horizon: roughly 18 months beyond this window
```

and a `## Reachability` section listing each requirement under its gap class. Both are additive and absent on a reachable target.

## Consequences

- Shipped in [#23](https://github.com/voidforall/your-next-resume/issues/23): the masthead names both hops, and the gap classes render as three cards — "needs a different job first" in red, last and loudest, because it is the reason the plan is two hops. `parse.mjs` exposes `parseReachability`; `tools/validate.mjs` requires `ultimate_target`, `next_hop_horizon` and the section to travel together and rejects an unknown gap class. Fixture: `fixtures/out-of-reach/` (Sam Ortiz, bootcamp grad → Staff ML Engineer).
- On an overridden run the projection still obeys [ADR 0001](0001-projection-contract.md): a requirement no milestone can earn produces no bullet. The gap section is where that absence is explained.
- Nothing changes for a reachable target: no extra frontmatter, no extra section, no extra prose.
