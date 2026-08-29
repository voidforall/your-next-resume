# 10. The run, end to end

Date: 2026-08-29
Status: Accepted
Ticket: [#12](https://github.com/voidforall/your-next-resume/issues/12)

## Context

One command, and a fixed generation order: the roadmap exists before the projection it justifies ([ADR 0001](0001-projection-contract.md)). The parse confirmation is already fixed as a checkpoint ([ADR 0009](0009-resume-intake.md)), and intake carries one optional capacity question ([ADR 0008](0008-where-the-work-happens.md)). This ADR fixes the sequence those constraints leave open.

## Decision

### The sequence

1. **Ask two things:** the resume, and the target job — a real job description by file, paste or URL, falling back to role + level + company archetype.
2. **Read the resume** by the ADR 0009 ladder and write `./your-next-resume/projection.md`. With no resume, the five-question interview produces the same file.
3. **Checkpoint 1 — confirm the parse.** Show what was read. *This is what I have; correct anything wrong before I plan against it.*
4. **Ask the window** (default six months) **and capacity** — roughly how much time outside work, if any. Skippable. It lands here, after the user has seen the tool do something real, because it is the personal question.
5. **Generate `roadmap.md`:** milestones preferring work doable inside the current job, each labelled `Where:`, each naming its Evidence, each earning at least one bullet.
6. **Checkpoint 2 — approve the roadmap.** The roadmap is what makes projected bullets legitimate; if it proposes work the user will not do, every bullet it earns is worthless. Cheaper to fix as markdown than as a rendered PDF.
7. **On approval, render everything:** the projected and reframed bullets into `projection.md`, the roadmap HTML, the diptych HTML, and the PDF through `render-pdf.mjs`.
8. **Close** (below).

Two questions to the first artifact; two checkpoints in the whole run.

### Output

All seven files land in **`./your-next-resume/`** in the working directory: `projection.md`, `roadmap.md`, `roadmap.html`, `projection.html`, `projection.pdf`, `resume-today.html` and `resume-today.pdf` ([ADR 0012](0012-present-day-resume.md)).

**Re-runs do not clobber.** If the folder already exists, the skill says so and asks whether to regenerate from scratch or re-render from the markdown already there. The user is invited to edit `roadmap.md` by hand — silently overwriting those edits would punish exactly the behaviour the design asks for.

### The closing message

States, in this order: the seven files and where they are, naming which is submittable today and which is not; that the PDF is a projection and the roadmap is what makes it true; whether the metadata layer was written, if it was not ([ADR 0005](0005-node-runtime-dependency.md)); and one next action — open `roadmap.html` and start the first milestone. It does not congratulate.

### Refusals

The four from ADR 0001 — un-stamping, presenting projections as experience, backdating, experience at an employer the user has not worked for — each declined in a sentence, with the two alternatives offered: an honest present-day resume, or a shorter window with fewer projected bullets.

## Consequences

- [#21](https://github.com/voidforall/your-next-resume/issues/21) writes this sequence as the spine of SKILL.md.
- Checkpoint 2 means `roadmap.md` is written before it is rendered, so a user can edit and re-render without regenerating.
- The re-run rule is the one decision here not put to the user; it follows from inviting hand edits, and it is reversible.
