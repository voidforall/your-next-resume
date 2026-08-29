# 8. Where the work happens

Date: 2026-08-29
Status: Accepted
Ticket: [#16](https://github.com/voidforall/your-next-resume/issues/16)

## Context

Prior-art research ([#4](https://github.com/voidforall/your-next-resume/issues/4)) found that the sharpest critique aimed at tools like this is not "fabricated resume" — it is that a projectable set of side projects, open-source contributions, writing and talks is structurally a prescription for unpaid evenings and weekends, and lands hardest on people with caring responsibilities. The attack already exists, fully formed and well-upvoted.

## Decision

**1. The generator prefers work doable inside the user's current job.** It looks first for milestones sourced from work hours — scope taken at work, an internal migration, documentation, mentoring, an internal talk, taking ownership of a service — before proposing evening projects. This is better career advice independent of fairness: work done at work is higher-signal and more verifiable than a weekend repo.

**2. Every milestone is labelled.** A new required field, `Where: At work` or `Where: Own time`, and the roadmap page shows the split. The label makes the cost visible whichever way the plan falls.

**3. Intake asks about capacity, once and optionally.** Inside the intake already happening: roughly how much time outside work, if any — none / an hour or two a week / evenings and weekends. Skippable. It caps how many **Own time** milestones the roadmap proposes.

This does not re-open [ADR 0002](0002-roadmap-schema.md)'s rejection of an effort model. Capacity shapes *what gets proposed*; milestones still carry dates and no hours.

**4. The README says nothing about it.** The labelled output and the in-job preference carry the answer. [#13](https://github.com/voidforall/your-next-resume/issues/13) may revisit this when it writes the launch copy.

### Internal evidence counts

*Added 2026-08-29 after eval (#24).* Preferring at-work milestones collided with [ADR 0001](0001-projection-contract.md)'s evidence rule, whose examples are all public — a repo, a merged PR, a published post. Both eval agents hit the contradiction and invented their own answer. Resolved: evidence must be checkable **by someone**, not necessarily by a stranger. Internal work counts when named precisely enough that a colleague could confirm it and a hiring manager could ask about it. The alternative quietly pushes every milestone back into unpaid evenings, which is what this ADR exists to prevent.

## Consequences

- `roadmap.md` gains a required `Where:` field and an optional `own_time_capacity` frontmatter key — additive, exactly as ADR 0002's labelled-line format was designed to allow.
- The roadmap page shows the at-work / own-time split ([#19](https://github.com/voidforall/your-next-resume/issues/19)).
- Intake gains one optional question ([#12](https://github.com/voidforall/your-next-resume/issues/12)).
- `tools/validate.mjs` requires the field and rejects any other value.
- The fixture persona is labelled honestly rather than flatteringly: eight of its twelve milestones are **Own time**, because a backend engineer at a logistics company has no ML work to take at his day job. That is precisely the fact the label exists to surface — a demo that hid it would defeat the decision.
