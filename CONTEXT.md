# Domain model

The vocabulary of `your-next-resume`. Every skill file, template and roadmap field uses these terms and no synonyms.

## Core terms

**Current Resume** — the true document the user hands over. Never modified in place; it is the left panel of the diptych and the input to everything else.

**Target** — the job the user is aiming at, expressed as a real job description where possible, otherwise as role + level + company archetype.

**Projection Window** — the time span the projection covers (6 months by default). Every date in the roadmap falls inside it.

**Projection** — the output resume: the Current Resume's content plus what the roadmap earns, as of the end of the Projection Window. A Projection is never a record of experience and always carries the Stamp.

**Roadmap** — the ordered set of Milestones that turns the Current Resume into the Projection. Source of truth is `roadmap.md`; the HTML page renders it.

## The three kinds of line on a Projection

**Carried Bullet** — true today, reproduced unchanged.

**Reframed Bullet** — true today, reworded or reordered to speak the Target's language. A reframe may change emphasis and wording only. It may never add a fact, a metric, a technology or a scope that was not already in the Current Resume. Marked as a reframe.

**Projected Bullet** — not true yet. Describes what the user will be able to claim once the Milestones that earn it are done. Marked as projected, and subject to the Traceability Rule.

## Milestones and proof

**Milestone** — one unit of work in the Roadmap: what to do, by when, and what it produces. A Milestone may earn several Projected Bullets, and a Projected Bullet may draw on several Milestones.

**Evidence** — the concrete, third-party-checkable artifact a Milestone produces: a repository, a merged pull request, a published post or talk, a certification id, a deployed URL. Every Milestone names its Evidence. "Learned X" is not Evidence; "shipped X, here" is.

**Traceability Rule** — a Projected Bullet may exist only if at least one Milestone earns it. If no Milestone earns a bullet, the bullet is deleted, not softened.

**Stamp** — the layered declaration that a Projection is a projection: a header band beneath the name giving the target date and stating it is not a record of experience, per-bullet marks distinguishing Projected and Reframed content, and the same statement in the PDF's document metadata.

## What may be projected

Projectable: skills; artifacts the user can ship themselves (side projects, open-source contributions, writing, talks); certifications; outcomes measurable from those artifacts; and continued tenure at the **current** employer, where the dates simply extend.

Never projectable: a new job title, a new employer, a promotion, headcount or reports, compensation, degrees, or any achievement attributable to a company the user does not work at.

The test is: **could the user make this true by themselves, inside the Projection Window?**
